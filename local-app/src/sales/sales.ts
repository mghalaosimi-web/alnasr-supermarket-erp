import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { postSystemJournalEntry } from "../accounting/journal.js";
import { postStockMovement } from "../inventory/stock-ledger.js";

export interface SaleLineInput {
  productId: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface CreateSaleInput {
  documentNo: string;
  storeId: string;
  warehouseId: string;
  customerId?: string | null;
  lines: SaleLineInput[];
  discountMinor?: number;
  taxMinor?: number;
  idempotencyKey: string;
  actorUserId?: string | null;
}

export interface CreateSaleResult {
  saleId: string;
  subtotalMinor: number;
  totalMinor: number;
  duplicate: boolean;
}

function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer.`);
}

function calculateTotals(lines: SaleLineInput[], discountMinor: number, taxMinor: number) {
  if (lines.length === 0 || lines.length > 500) throw new Error("A sale must contain between 1 and 500 lines.");
  let subtotalMinor = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Line quantity must be a positive safe integer.");
    assertMoney(line.unitPriceMinor, "unitPriceMinor");
    const lineTotal = line.quantity * line.unitPriceMinor;
    if (!Number.isSafeInteger(lineTotal)) throw new Error("Sale line total exceeds the supported integer range.");
    subtotalMinor += lineTotal;
    if (!Number.isSafeInteger(subtotalMinor)) throw new Error("Sale subtotal exceeds the supported integer range.");
  }
  assertMoney(discountMinor, "discountMinor");
  assertMoney(taxMinor, "taxMinor");
  if (discountMinor > subtotalMinor) throw new Error("Discount cannot exceed the sale subtotal.");
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new Error("Sale total exceeds the supported integer range.");
  return { subtotalMinor, totalMinor };
}

export function createSale(db: Database.Database, input: CreateSaleInput): CreateSaleResult {
  if (!input.documentNo.trim() || !input.idempotencyKey.trim()) throw new Error("Document number and idempotency key are required.");
  const discountMinor = input.discountMinor ?? 0;
  const taxMinor = input.taxMinor ?? 0;
  const totals = calculateTotals(input.lines, discountMinor, taxMinor);

  const create = db.transaction((): CreateSaleResult => {
    const existing = db.prepare(`
      SELECT id, store_id, warehouse_id, customer_id, subtotal_minor, discount_minor, tax_minor, total_minor
      FROM sales WHERE idempotency_key = ?
    `).get(input.idempotencyKey) as {
      id: string; store_id: string; warehouse_id: string | null; customer_id: string | null;
      subtotal_minor: number; discount_minor: number; tax_minor: number; total_minor: number;
    } | undefined;

    if (existing) {
      const storedLines = db.prepare(`
        SELECT product_id, quantity, unit_price_minor FROM sale_lines
        WHERE sale_id = ? ORDER BY rowid
      `).all(existing.id) as Array<{ product_id: string; quantity: number; unit_price_minor: number }>;
      const sameLines = storedLines.length === input.lines.length && storedLines.every((line, index) => {
        const requested = input.lines[index]!;
        return line.product_id === requested.productId
          && line.quantity === requested.quantity
          && line.unit_price_minor === requested.unitPriceMinor;
      });
      const sameHeader = existing.store_id === input.storeId
        && existing.warehouse_id === input.warehouseId
        && existing.customer_id === (input.customerId ?? null)
        && existing.subtotal_minor === totals.subtotalMinor
        && existing.discount_minor === discountMinor
        && existing.tax_minor === taxMinor
        && existing.total_minor === totals.totalMinor;
      if (!sameLines || !sameHeader) throw new Error("Sale idempotency key conflict.");
      return { saleId: existing.id, ...totals, duplicate: true };
    }

    const warehouse = db.prepare("SELECT store_id FROM warehouses WHERE id = ? AND is_active = 1")
      .get(input.warehouseId) as { store_id: string } | undefined;
    if (!warehouse || warehouse.store_id !== input.storeId) throw new Error("Warehouse does not belong to the selected store.");

    const saleId = randomUUID();
    db.prepare(`
      INSERT INTO sales(
        id, document_no, store_id, warehouse_id, customer_id, status,
        subtotal_minor, discount_minor, tax_minor, total_minor, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `).run(
      saleId, input.documentNo, input.storeId, input.warehouseId, input.customerId ?? null,
      totals.subtotalMinor, discountMinor, taxMinor, totals.totalMinor, input.idempotencyKey
    );

    const insertLine = db.prepare(`
      INSERT INTO sale_lines(id, sale_id, product_id, quantity, unit_price_minor, line_total_minor)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const line of input.lines) {
      const lineTotal = line.quantity * line.unitPriceMinor;
      insertLine.run(randomUUID(), saleId, line.productId, line.quantity, line.unitPriceMinor, lineTotal);
    }

    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'sale.created', 'sale', ?, ?)
    `).run(randomUUID(), input.actorUserId ?? null, saleId, JSON.stringify(totals));

    return { saleId, ...totals, duplicate: false };
  });

  return create();
}

export function postSale(
  db: Database.Database,
  saleId: string,
  actorUserId?: string | null
): { saleId: string; status: "posted"; duplicate: boolean } {
  const post = db.transaction(() => {
    const sale = db.prepare(`
      SELECT id, document_no, warehouse_id, status, total_minor FROM sales WHERE id = ?
    `).get(saleId) as { id: string; document_no: string; warehouse_id: string | null; status: string; total_minor: number } | undefined;
    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "posted") return { saleId, status: "posted" as const, duplicate: true };
    if (sale.status !== "draft" || !sale.warehouse_id) throw new Error("Only a draft sale with a warehouse can be posted.");

    const lines = db.prepare(`
      SELECT sl.id, sl.product_id, sl.quantity, p.cost_price_minor
      FROM sale_lines sl JOIN products p ON p.id = sl.product_id
      WHERE sl.sale_id = ? ORDER BY sl.rowid
    `).all(saleId) as Array<{ id: string; product_id: string; quantity: number; cost_price_minor: number }>;

    for (const line of lines) {
      postStockMovement(db, {
        productId: line.product_id,
        warehouseId: sale.warehouse_id,
        quantityDelta: -line.quantity,
        unitCostMinor: line.cost_price_minor,
        sourceType: "sale",
        sourceId: saleId,
        idempotencyKey: `sale:${saleId}:line:${line.id}:post`,
        actorUserId
      });
    }

    db.prepare("UPDATE sales SET status = 'posted' WHERE id = ? AND status = 'draft'").run(saleId);
    const costOfGoodsMinor = lines.reduce((sum, line) => sum + line.quantity * line.cost_price_minor, 0);
    const journalLines = [];
    if (sale.total_minor > 0) {
      journalLines.push({ accountCode: "1100", debitMinor: sale.total_minor, description: "ذمم العميل" });
      journalLines.push({ accountCode: "4000", creditMinor: sale.total_minor, description: "إيراد المبيعات" });
    }
    if (costOfGoodsMinor > 0) {
      journalLines.push({ accountCode: "5000", debitMinor: costOfGoodsMinor, description: "تكلفة البضاعة المباعة" });
      journalLines.push({ accountCode: "1200", creditMinor: costOfGoodsMinor, description: "تخفيض المخزون" });
    }
    if (journalLines.length) postSystemJournalEntry(db, {
      sourceType: "sale", sourceId: saleId, idempotencyKey: `journal:sale:${saleId}`,
      description: `ترحيل فاتورة البيع ${sale.document_no}`, actorUserId, lines: journalLines
    });
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'sale.posted', 'sale', ?, '{}')
    `).run(randomUUID(), actorUserId ?? null, saleId);

    return { saleId, status: "posted" as const, duplicate: false };
  });
  return post();
}
