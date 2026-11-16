import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { postSystemJournalEntry } from "../accounting/journal.js";
import { postStockMovement } from "../inventory/stock-ledger.js";

export interface PurchaseLineInput {
  productId: string;
  quantity: number;
  unitCostMinor: number;
}

export interface CreatePurchaseInput {
  documentNo: string;
  storeId: string;
  warehouseId: string;
  supplierId: string;
  lines: PurchaseLineInput[];
  discountMinor?: number;
  taxMinor?: number;
  idempotencyKey: string;
  actorUserId?: string | null;
}

export interface CreatePurchaseResult {
  purchaseId: string;
  subtotalMinor: number;
  totalMinor: number;
  duplicate: boolean;
}

function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer.`);
}

function totalsFor(lines: PurchaseLineInput[], discountMinor: number, taxMinor: number) {
  if (lines.length === 0 || lines.length > 500) throw new Error("A purchase must contain between 1 and 500 lines.");
  let subtotalMinor = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Line quantity must be a positive safe integer.");
    assertMoney(line.unitCostMinor, "unitCostMinor");
    const lineTotal = line.quantity * line.unitCostMinor;
    if (!Number.isSafeInteger(lineTotal)) throw new Error("Purchase line total exceeds the supported integer range.");
    subtotalMinor += lineTotal;
    if (!Number.isSafeInteger(subtotalMinor)) throw new Error("Purchase subtotal exceeds the supported integer range.");
  }
  assertMoney(discountMinor, "discountMinor");
  assertMoney(taxMinor, "taxMinor");
  if (discountMinor > subtotalMinor) throw new Error("Discount cannot exceed the purchase subtotal.");
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new Error("Purchase total exceeds the supported integer range.");
  return { subtotalMinor, totalMinor };
}

export function createPurchase(db: Database.Database, input: CreatePurchaseInput): CreatePurchaseResult {
  if (!input.documentNo.trim() || !input.idempotencyKey.trim()) throw new Error("Document number and idempotency key are required.");
  const discountMinor = input.discountMinor ?? 0;
  const taxMinor = input.taxMinor ?? 0;
  const totals = totalsFor(input.lines, discountMinor, taxMinor);

  const create = db.transaction((): CreatePurchaseResult => {
    const existing = db.prepare(`
      SELECT id, store_id, warehouse_id, supplier_id, subtotal_minor, discount_minor, tax_minor, total_minor
      FROM purchases WHERE idempotency_key = ?
    `).get(input.idempotencyKey) as {
      id: string; store_id: string; warehouse_id: string; supplier_id: string;
      subtotal_minor: number; discount_minor: number; tax_minor: number; total_minor: number;
    } | undefined;

    if (existing) {
      const storedLines = db.prepare(`
        SELECT product_id, quantity, unit_cost_minor FROM purchase_lines
        WHERE purchase_id = ? ORDER BY rowid
      `).all(existing.id) as Array<{ product_id: string; quantity: number; unit_cost_minor: number }>;
      const sameLines = storedLines.length === input.lines.length && storedLines.every((line, index) => {
        const requested = input.lines[index]!;
        return line.product_id === requested.productId
          && line.quantity === requested.quantity
          && line.unit_cost_minor === requested.unitCostMinor;
      });
      const sameHeader = existing.store_id === input.storeId
        && existing.warehouse_id === input.warehouseId
        && existing.supplier_id === input.supplierId
        && existing.subtotal_minor === totals.subtotalMinor
        && existing.discount_minor === discountMinor
        && existing.tax_minor === taxMinor
        && existing.total_minor === totals.totalMinor;
      if (!sameLines || !sameHeader) throw new Error("Purchase idempotency key conflict.");
      return { purchaseId: existing.id, ...totals, duplicate: true };
    }

    const warehouse = db.prepare("SELECT store_id FROM warehouses WHERE id = ? AND is_active = 1")
      .get(input.warehouseId) as { store_id: string } | undefined;
    if (!warehouse || warehouse.store_id !== input.storeId) throw new Error("Warehouse does not belong to the selected store.");
    const supplier = db.prepare("SELECT id FROM suppliers WHERE id = ? AND is_active = 1")
      .get(input.supplierId);
    if (!supplier) throw new Error("Supplier is not active or does not exist.");

    const purchaseId = randomUUID();
    db.prepare(`
      INSERT INTO purchases(
        id, document_no, store_id, warehouse_id, supplier_id, status,
        subtotal_minor, discount_minor, tax_minor, total_minor, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `).run(
      purchaseId, input.documentNo, input.storeId, input.warehouseId, input.supplierId,
      totals.subtotalMinor, discountMinor, taxMinor, totals.totalMinor, input.idempotencyKey
    );

    const insertLine = db.prepare(`
      INSERT INTO purchase_lines(id, purchase_id, product_id, quantity, unit_cost_minor, line_total_minor)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const line of input.lines) {
      insertLine.run(randomUUID(), purchaseId, line.productId, line.quantity, line.unitCostMinor, line.quantity * line.unitCostMinor);
    }

    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'purchase.created', 'purchase', ?, ?)
    `).run(randomUUID(), input.actorUserId ?? null, purchaseId, JSON.stringify(totals));

    return { purchaseId, ...totals, duplicate: false };
  });

  return create();
}

export function postPurchase(
  db: Database.Database,
  purchaseId: string,
  actorUserId?: string | null
): { purchaseId: string; status: "posted"; duplicate: boolean } {
  const post = db.transaction(() => {
    const purchase = db.prepare("SELECT id, document_no, warehouse_id, status, total_minor FROM purchases WHERE id = ?")
      .get(purchaseId) as { id: string; document_no: string; warehouse_id: string; status: string; total_minor: number } | undefined;
    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.status === "posted") return { purchaseId, status: "posted" as const, duplicate: true };
    if (purchase.status !== "draft") throw new Error("Only a draft purchase can be posted.");

    const lines = db.prepare(`
      SELECT id, product_id, quantity, unit_cost_minor
      FROM purchase_lines WHERE purchase_id = ? ORDER BY rowid
    `).all(purchaseId) as Array<{ id: string; product_id: string; quantity: number; unit_cost_minor: number }>;

    for (const line of lines) {
      postStockMovement(db, {
        productId: line.product_id,
        warehouseId: purchase.warehouse_id,
        quantityDelta: line.quantity,
        unitCostMinor: line.unit_cost_minor,
        sourceType: "purchase",
        sourceId: purchaseId,
        idempotencyKey: `purchase:${purchaseId}:line:${line.id}:post`,
        actorUserId
      });
    }

    db.prepare("UPDATE purchases SET status = 'posted' WHERE id = ? AND status = 'draft'").run(purchaseId);
    if (purchase.total_minor > 0) postSystemJournalEntry(db, {
      sourceType: "purchase", sourceId: purchaseId, idempotencyKey: `journal:purchase:${purchaseId}`,
      description: `ترحيل فاتورة الشراء ${purchase.document_no}`, actorUserId,
      lines: [
        { accountCode: "1200", debitMinor: purchase.total_minor, description: "إضافة المخزون" },
        { accountCode: "2000", creditMinor: purchase.total_minor, description: "ذمم المورد" }
      ]
    });
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'purchase.posted', 'purchase', ?, '{}')
    `).run(randomUUID(), actorUserId ?? null, purchaseId);

    return { purchaseId, status: "posted" as const, duplicate: false };
  });
  return post();
}


export interface PurchaseListItem {
  id: string;
  document_no: string;
  status: "draft" | "posted" | "voided";
  supplier_id: string;
  supplier_name: string;
  store_id: string;
  store_name: string;
  warehouse_id: string;
  warehouse_name: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  line_count: number;
  unit_count: number;
  paid_minor: number;
  outstanding_minor: number;
  created_at: string;
}

export function listPurchases(
  db: Database.Database,
  search = "",
  limit = 100,
  offset = 0
): PurchaseListItem[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("Limit must be between 1 and 200.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Offset must be a non-negative integer.");
  }
  const term = `%${search.trim().slice(0, 80)}%`;
  return db.prepare(`
    SELECT
      p.id, p.document_no, p.status, p.supplier_id, s.name AS supplier_name,
      p.store_id, st.name AS store_name, p.warehouse_id, w.name AS warehouse_name,
      p.subtotal_minor, p.discount_minor, p.tax_minor, p.total_minor,
      COALESCE(pl.line_count, 0) AS line_count, COALESCE(pl.unit_count, 0) AS unit_count,
      COALESCE(pp.paid_minor, 0) AS paid_minor,
      p.total_minor - COALESCE(pp.paid_minor, 0) AS outstanding_minor,
      p.created_at
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    JOIN stores st ON st.id = p.store_id
    JOIN warehouses w ON w.id = p.warehouse_id
    LEFT JOIN (
      SELECT purchase_id, COUNT(*) AS line_count, SUM(quantity) AS unit_count
      FROM purchase_lines GROUP BY purchase_id
    ) pl ON pl.purchase_id = p.id
    LEFT JOIN (
      SELECT purchase_id, SUM(amount_minor) AS paid_minor
      FROM purchase_payments GROUP BY purchase_id
    ) pp ON pp.purchase_id = p.id
    LEFT JOIN (
      SELECT purchase_id, SUM(total_minor) AS returned_minor
      FROM purchase_returns WHERE status = 'posted' GROUP BY purchase_id
    ) pr ON pr.purchase_id = p.id
    WHERE p.document_no LIKE ? OR s.name LIKE ? OR s.code LIKE ?
    ORDER BY p.created_at DESC, p.document_no DESC
    LIMIT ? OFFSET ?
  `).all(term, term, term, limit, offset) as PurchaseListItem[];
}
