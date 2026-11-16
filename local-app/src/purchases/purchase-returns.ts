import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { postSystemJournalEntry } from "../accounting/journal.js";
import { getStockBalance, postStockMovement } from "../inventory/stock-ledger.js";

export interface PurchaseReturnLineInput { purchaseLineId: string; quantity: number }
export interface CreatePurchaseReturnInput { purchaseId: string; documentNo: string; reason: string; lines: PurchaseReturnLineInput[]; idempotencyKey: string; actorUserId?: string | null }

export function listReturnablePurchases(db: Database.Database) {
  return db.prepare(`
    SELECT p.id, p.document_no, s.name AS supplier_name, p.total_minor, p.created_at,
      COUNT(pl.id) AS returnable_line_count
    FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
    JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE p.status = 'posted' AND pl.quantity > COALESCE((
      SELECT SUM(prl.quantity) FROM purchase_return_lines prl
      JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
      WHERE prl.purchase_line_id = pl.id AND pr.status <> 'voided'
    ), 0)
    GROUP BY p.id ORDER BY p.created_at DESC, p.document_no DESC LIMIT 200
  `).all();
}

export function listPurchaseReturnableLines(db: Database.Database, purchaseId: string) {
  const purchase = db.prepare("SELECT id, status FROM purchases WHERE id = ?").get(purchaseId) as { id: string; status: string } | undefined;
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.status !== "posted") throw new Error("Returns are only allowed for a posted purchase.");
  return db.prepare(`
    SELECT pl.id AS purchase_line_id, pl.product_id, p.sku, p.name_ar AS product_name,
      pl.quantity AS received_quantity,
      COALESCE((SELECT SUM(prl.quantity) FROM purchase_return_lines prl JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
        WHERE prl.purchase_line_id = pl.id AND pr.status <> 'voided'), 0) AS returned_quantity,
      pl.quantity - COALESCE((SELECT SUM(prl.quantity) FROM purchase_return_lines prl JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
        WHERE prl.purchase_line_id = pl.id AND pr.status <> 'voided'), 0) AS remaining_quantity,
      pl.unit_cost_minor
    FROM purchase_lines pl JOIN products p ON p.id = pl.product_id
    WHERE pl.purchase_id = ? ORDER BY pl.rowid
  `).all(purchaseId);
}

export function createPurchaseReturn(db: Database.Database, input: CreatePurchaseReturnInput) {
  const documentNo = input.documentNo.trim(), reason = input.reason.trim(), key = input.idempotencyKey.trim();
  if (!documentNo || documentNo.length > 64 || reason.length < 3 || reason.length > 240 || key.length < 8 || key.length > 160) throw new Error("Invalid purchase return header.");
  if (input.lines.length < 1 || input.lines.length > 500) throw new Error("A purchase return requires between 1 and 500 lines.");
  return db.transaction(() => {
    const existing = db.prepare("SELECT id, purchase_id, total_minor, reason FROM purchase_returns WHERE idempotency_key = ?").get(key) as { id: string; purchase_id: string; total_minor: number; reason: string } | undefined;
    if (existing) {
      if (existing.purchase_id !== input.purchaseId || existing.reason !== reason) throw new Error("Purchase return idempotency key conflict.");
      return { returnId: existing.id, totalMinor: existing.total_minor, duplicate: true };
    }
    const purchase = db.prepare("SELECT id, store_id, warehouse_id, status FROM purchases WHERE id = ?").get(input.purchaseId) as { id: string; store_id: string; warehouse_id: string; status: string } | undefined;
    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.status !== "posted") throw new Error("Returns are only allowed for a posted purchase.");
    let totalMinor = 0;
    const normalized = input.lines.map(line => {
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Return quantity must be a positive safe integer.");
      const original = db.prepare("SELECT id, product_id, quantity, unit_cost_minor FROM purchase_lines WHERE id = ? AND purchase_id = ?").get(line.purchaseLineId, input.purchaseId) as { id: string; product_id: string; quantity: number; unit_cost_minor: number } | undefined;
      if (!original) throw new Error("Purchase line does not belong to this purchase.");
      const returned = db.prepare("SELECT COALESCE(SUM(prl.quantity), 0) AS quantity FROM purchase_return_lines prl JOIN purchase_returns pr ON pr.id = prl.purchase_return_id WHERE prl.purchase_line_id = ? AND pr.status <> 'voided'").get(original.id) as { quantity: number };
      const remaining = original.quantity - Number(returned.quantity);
      if (line.quantity > remaining) throw new Error("Return quantity exceeds the unreturned received quantity.");
      const lineTotal = line.quantity * original.unit_cost_minor;
      if (!Number.isSafeInteger(lineTotal)) throw new Error("Purchase return line total exceeds the supported range.");
      totalMinor += lineTotal;
      if (!Number.isSafeInteger(totalMinor)) throw new Error("Purchase return total exceeds the supported range.");
      return { ...original, quantity: line.quantity, lineTotal };
    });
    const id = randomUUID();
    db.prepare("INSERT INTO purchase_returns(id, document_no, purchase_id, store_id, warehouse_id, status, subtotal_minor, total_minor, reason, idempotency_key) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)")
      .run(id, documentNo, input.purchaseId, purchase.store_id, purchase.warehouse_id, totalMinor, totalMinor, reason, key);
    const insert = db.prepare("INSERT INTO purchase_return_lines(id, purchase_return_id, purchase_line_id, product_id, quantity, unit_cost_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const line of normalized) insert.run(randomUUID(), id, line.id, line.product_id, line.quantity, line.unit_cost_minor, line.lineTotal);
    db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'purchase.return.created', 'purchase_return', ?, ?)")
      .run(randomUUID(), input.actorUserId ?? null, id, JSON.stringify({ purchaseId: input.purchaseId, totalMinor }));
    return { returnId: id, totalMinor, duplicate: false };
  })();
}

export function postPurchaseReturn(db: Database.Database, returnId: string, actorUserId?: string | null) {
  return db.transaction(() => {
    const record = db.prepare("SELECT id, document_no, purchase_id, warehouse_id, status, total_minor FROM purchase_returns WHERE id = ?").get(returnId) as { id: string; document_no: string; purchase_id: string; warehouse_id: string; status: string; total_minor: number } | undefined;
    if (!record) throw new Error("Purchase return not found.");
    if (record.status === "posted") return { returnId, status: "posted" as const, duplicate: true };
    if (record.status !== "draft") throw new Error("Only a draft purchase return can be posted.");
    const lines = db.prepare("SELECT id, product_id, quantity, unit_cost_minor FROM purchase_return_lines WHERE purchase_return_id = ? ORDER BY rowid").all(returnId) as Array<{ id: string; product_id: string; quantity: number; unit_cost_minor: number }>;
    for (const line of lines) {
      const balance = getStockBalance(db, line.product_id, record.warehouse_id);
      if (balance < line.quantity) throw new Error("Insufficient stock to post this purchase return.");
      postStockMovement(db, { productId: line.product_id, warehouseId: record.warehouse_id, quantityDelta: -line.quantity, unitCostMinor: line.unit_cost_minor, sourceType: "purchase_return", sourceId: returnId, idempotencyKey: `purchase-return:${returnId}:line:${line.id}:post`, actorUserId });
    }
    db.prepare("UPDATE purchase_returns SET status = 'posted' WHERE id = ? AND status = 'draft'").run(returnId);
    if (record.total_minor > 0) postSystemJournalEntry(db, {
      sourceType: "purchase_return", sourceId: returnId, idempotencyKey: `journal:purchase-return:${returnId}`,
      description: `ترحيل مرتجع الشراء ${record.document_no}`, actorUserId,
      lines: [
        { accountCode: "2000", debitMinor: record.total_minor, description: "تخفيض ذمم المورد" },
        { accountCode: "1200", creditMinor: record.total_minor, description: "إخراج البضاعة المرتجعة من المخزون" }
      ]
    });
    db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'purchase.return.posted', 'purchase_return', ?, '{}')")
      .run(randomUUID(), actorUserId ?? null, returnId);
    return { returnId, status: "posted" as const, duplicate: false };
  })();
}

export function voidPurchaseReturn(db: Database.Database, returnId: string, actorUserId?: string | null) {
  return db.transaction(() => {
    const record = db.prepare("SELECT id, status FROM purchase_returns WHERE id = ?").get(returnId) as { id: string; status: string } | undefined;
    if (!record) throw new Error("Purchase return not found.");
    if (record.status === "voided") return { returnId, status: "voided" as const, duplicate: true };
    if (record.status !== "draft") throw new Error("Only a draft purchase return can be voided.");
    db.prepare("UPDATE purchase_returns SET status = 'voided' WHERE id = ? AND status = 'draft'").run(returnId);
    db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'purchase.return.voided', 'purchase_return', ?, '{}')")
      .run(randomUUID(), actorUserId ?? null, returnId);
    return { returnId, status: "voided" as const, duplicate: false };
  })();
}

export function listPurchaseReturns(db: Database.Database, purchaseId: string) {
  const exists = db.prepare("SELECT id FROM purchases WHERE id = ?").get(purchaseId);
  if (!exists) throw new Error("Purchase not found.");
  return db.prepare("SELECT id, document_no, status, reason, total_minor, created_at FROM purchase_returns WHERE purchase_id = ? ORDER BY created_at DESC, document_no DESC").all(purchaseId);
}