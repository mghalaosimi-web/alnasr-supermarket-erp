import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { postStockMovement } from "../inventory/stock-ledger.js";

export interface SaleReturnLineInput {
  saleLineId: string;
  quantity: number;
}
export interface CreateSaleReturnInput {
  documentNo: string;
  saleId: string;
  reason: string;
  lines: SaleReturnLineInput[];
  idempotencyKey: string;
  actorUserId?: string | null;
}
export interface CreateSaleReturnResult {
  returnId: string;
  saleId: string;
  subtotalMinor: number;
  totalMinor: number;
  duplicate: boolean;
}

type OriginalLine = {
  id: string; product_id: string; quantity: number; unit_price_minor: number;
};
function assertReturnAvailability(db: Database.Database, saleId: string, lines: SaleReturnLineInput[]) {
  const sale = db.prepare("SELECT id, status, store_id, warehouse_id FROM sales WHERE id = ?")
    .get(saleId) as { id: string; status: string; store_id: string; warehouse_id: string | null } | undefined;
  if (!sale) throw new Error("Sale not found.");
  if (sale.status !== "posted" || !sale.warehouse_id) throw new Error("Returns are only allowed for a posted sale.");
  if (lines.length === 0 || lines.length > 500) throw new Error("A return must contain between 1 and 500 lines.");
  const seen = new Set<string>();
  const originals: OriginalLine[] = [];
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Return quantity must be a positive safe integer.");
    if (seen.has(line.saleLineId)) throw new Error("A sale line can only appear once in a return.");
    seen.add(line.saleLineId);
    const original = db.prepare(
      "SELECT id, product_id, quantity, unit_price_minor FROM sale_lines WHERE id = ? AND sale_id = ?"
    ).get(line.saleLineId, saleId) as OriginalLine | undefined;
    if (!original) throw new Error("Return line does not belong to the selected sale.");
    const alreadyReserved = db.prepare(`
      SELECT COALESCE(SUM(srl.quantity), 0) AS quantity
      FROM sale_return_lines srl
      JOIN sale_returns sr ON sr.id = srl.sale_return_id
      WHERE srl.sale_line_id = ? AND sr.status <> 'voided'
    `).get(line.saleLineId) as { quantity: number };
    if (alreadyReserved.quantity + line.quantity > original.quantity) {
      throw new Error("Return quantity exceeds the unreturned quantity for this sale line.");
    }
    originals.push(original);
  }
  return { sale, originals };
}

export function createSaleReturn(
  db: Database.Database,
  input: CreateSaleReturnInput
): CreateSaleReturnResult {
  if (!input.documentNo.trim() || !input.reason.trim() || !input.idempotencyKey.trim()) {
    throw new Error("Return document number, reason and idempotency key are required.");
  }
  if (input.reason.length > 240 || input.idempotencyKey.length > 160) throw new Error("Return reason or idempotency key is too long.");
  const create = db.transaction((): CreateSaleReturnResult => {
    const existing = db.prepare(`
      SELECT id, sale_id, subtotal_minor FROM sale_returns WHERE idempotency_key = ?
    `).get(input.idempotencyKey) as { id: string; sale_id: string; subtotal_minor: number } | undefined;
    if (existing) {
      const oldLines = db.prepare(
        "SELECT sale_line_id, quantity FROM sale_return_lines WHERE sale_return_id = ? ORDER BY rowid"
      ).all(existing.id) as Array<{ sale_line_id: string; quantity: number }>;
      const sameLines = oldLines.length === input.lines.length && oldLines.every((line, i) =>
        line.sale_line_id === input.lines[i]!.saleLineId && line.quantity === input.lines[i]!.quantity
      );
      const { originals } = assertReturnAvailability(db, input.saleId, input.lines);
      const subtotal = originals.reduce((sum, original, i) => sum + original.unit_price_minor * input.lines[i]!.quantity, 0);
      if (existing.sale_id !== input.saleId || existing.subtotal_minor !== subtotal || !sameLines) {
        throw new Error("Sales return idempotency key conflict.");
      }
      return { returnId: existing.id, saleId: input.saleId, subtotalMinor: subtotal, totalMinor: subtotal, duplicate: true };
    }
    const { sale, originals } = assertReturnAvailability(db, input.saleId, input.lines);
    let subtotalMinor = 0;
    for (let i = 0; i < originals.length; i++) {
      const amount = originals[i]!.unit_price_minor * input.lines[i]!.quantity;
      if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(subtotalMinor + amount)) {
        throw new Error("Sales return total exceeds the supported integer range.");
      }
      subtotalMinor += amount;
    }
    const returnId = randomUUID();
    db.prepare(`
      INSERT INTO sale_returns(id, document_no, sale_id, store_id, warehouse_id, status,
        subtotal_minor, total_minor, reason, idempotency_key)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
    `).run(returnId, input.documentNo, input.saleId, sale.store_id, sale.warehouse_id,
      subtotalMinor, subtotalMinor, input.reason.trim(), input.idempotencyKey.trim());
    const insert = db.prepare(`
      INSERT INTO sale_return_lines(id, sale_return_id, sale_line_id, product_id, quantity, unit_price_minor, line_total_minor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (let i = 0; i < originals.length; i++) {
      const original = originals[i]!, requested = input.lines[i]!;
      insert.run(randomUUID(), returnId, original.id, original.product_id, requested.quantity,
        original.unit_price_minor, original.unit_price_minor * requested.quantity);
    }
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'sale.return.created', 'sale_return', ?, ?)
    `).run(randomUUID(), input.actorUserId ?? null, returnId,
      JSON.stringify({ saleId: input.saleId, subtotalMinor, reason: input.reason.trim() }));
    return { returnId, saleId: input.saleId, subtotalMinor, totalMinor: subtotalMinor, duplicate: false };
  });
  return create();
}

export function postSaleReturn(
  db: Database.Database, returnId: string, actorUserId?: string | null
): { returnId: string; status: "posted"; duplicate: boolean } {
  const post = db.transaction(() => {
    const record = db.prepare(`
      SELECT id, sale_id, warehouse_id, status FROM sale_returns WHERE id = ?
    `).get(returnId) as { id: string; sale_id: string; warehouse_id: string; status: string } | undefined;
    if (!record) throw new Error("Sales return not found.");
    if (record.status === "posted") return { returnId, status: "posted" as const, duplicate: true };
    if (record.status !== "draft") throw new Error("Only a draft sales return can be posted.");
    const lines = db.prepare(`
      SELECT srl.id, srl.sale_line_id, srl.product_id, srl.quantity, sl.id AS original_line_id
      FROM sale_return_lines srl JOIN sale_lines sl ON sl.id = srl.sale_line_id
      WHERE srl.sale_return_id = ? ORDER BY srl.rowid
    `).all(returnId) as Array<{ id: string; sale_line_id: string; product_id: string; quantity: number; original_line_id: string }>;
    assertReturnAvailability(db, record.sale_id, lines.map(line => ({ saleLineId: line.sale_line_id, quantity: line.quantity })));
    for (const line of lines) {
      const originalMovement = db.prepare(`
        SELECT unit_cost_minor FROM stock_ledger
        WHERE source_type = 'sale' AND source_id = ? AND idempotency_key = ?
      `).get(record.sale_id, `sale:${record.sale_id}:line:${line.original_line_id}:post`) as { unit_cost_minor: number } | undefined;
      if (!originalMovement) throw new Error("Original sale stock cost is unavailable; return was not posted.");
      postStockMovement(db, {
        productId: line.product_id, warehouseId: record.warehouse_id,
        quantityDelta: line.quantity, unitCostMinor: originalMovement.unit_cost_minor,
        sourceType: "sale_return", sourceId: returnId,
        idempotencyKey: `sale-return:${returnId}:line:${line.id}:post`, actorUserId
      });
    }
    db.prepare("UPDATE sale_returns SET status = 'posted' WHERE id = ? AND status = 'draft'").run(returnId);
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'sale.return.posted', 'sale_return', ?, '{}')
    `).run(randomUUID(), actorUserId ?? null, returnId);
    return { returnId, status: "posted" as const, duplicate: false };
  });
  return post();
}
