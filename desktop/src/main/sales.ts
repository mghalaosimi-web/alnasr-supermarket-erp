import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type SaleLineInput = { productId: string; quantity: number };
export type CreateSaleInput = {
  lines: SaleLineInput[];
  paymentMethod: "cash" | "card" | "transfer";
  idempotencyKey: string;
  actorUserId: string;
};
export type SaleResult = {
  id: string;
  saleNumber: string;
  totalMinor: number;
  status: "posted";
  lines: Array<{ productId: string; sku: string; nameAr: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }>;
};

export function openCashierShift(
  db: Database.Database,
  input: { openingCashMinor: number; cashierUserId: string }
): { id: string; openingCashMinor: number; status: "open" } {
  if (!Number.isSafeInteger(input.openingCashMinor) || input.openingCashMinor < 0) {
    throw new Error("رصيد افتتاح الصندوق غير صحيح");
  }
  const existing = db.prepare(
    "SELECT id FROM cashier_shifts WHERE cashier_user_id = ? AND status = 'open' LIMIT 1"
  ).get(input.cashierUserId) as { id: string } | undefined;
  if (existing) throw new Error("يوجد وردية مفتوحة لهذا المستخدم بالفعل");

  const id = randomUUID();
  const create = db.transaction(() => {
    db.prepare(
      "INSERT INTO cashier_shifts (id, cashier_user_id, opening_cash_minor, status) VALUES (?, ?, ?, 'open')"
    ).run(id, input.cashierUserId, input.openingCashMinor);
    db.prepare(
      "INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'shift.open', 'cashier_shift', ?, ?)"
    ).run(randomUUID(), input.cashierUserId, id, JSON.stringify({ openingCashMinor: input.openingCashMinor }));
  });
  create();
  return { id, openingCashMinor: input.openingCashMinor, status: "open" };
}

export function closeCashierShift(
  db: Database.Database,
  input: { shiftId: string; closingCashMinor: number; actorUserId: string }
): { id: string; closingCashMinor: number; status: "closed" } {
  if (!Number.isSafeInteger(input.closingCashMinor) || input.closingCashMinor < 0) {
    throw new Error("رصيد إغلاق الصندوق غير صحيح");
  }
  const shift = db.prepare(
    "SELECT id, cashier_user_id AS cashierUserId, status FROM cashier_shifts WHERE id = ?"
  ).get(input.shiftId) as { id: string; cashierUserId: string; status: string } | undefined;
  if (!shift || shift.cashierUserId !== input.actorUserId || shift.status !== "open") {
    throw new Error("الوردية غير موجودة أو لا يمكن إغلاقها");
  }
  const close = db.transaction(() => {
    db.prepare(
      "UPDATE cashier_shifts SET closing_cash_minor = ?, closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), status = 'closed' WHERE id = ? AND status = 'open'"
    ).run(input.closingCashMinor, input.shiftId);
    db.prepare(
      "INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'shift.close', 'cashier_shift', ?, ?)"
    ).run(randomUUID(), input.actorUserId, input.shiftId, JSON.stringify({ closingCashMinor: input.closingCashMinor }));
  });
  close();
  return { id: input.shiftId, closingCashMinor: input.closingCashMinor, status: "closed" };
}

export function createSale(db: Database.Database, input: CreateSaleInput): SaleResult {
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100) {
    throw new Error("أضف منتجاً واحداً على الأقل إلى الفاتورة");
  }
  if (!["cash", "card", "transfer"].includes(input.paymentMethod)) {
    throw new Error("طريقة الدفع غير مدعومة");
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 120) {
    throw new Error("مفتاح العملية غير صحيح");
  }

  const existing = db.prepare(
    "SELECT id, sale_number AS saleNumber, total_minor AS totalMinor, status FROM sales WHERE idempotency_key = ?"
  ).get(input.idempotencyKey) as { id: string; saleNumber: string; totalMinor: number; status: "posted" } | undefined;
  if (existing) {
    const lines = db.prepare(
      "SELECT product_id AS productId, p.sku, p.name_ar AS nameAr, quantity, unit_price_minor AS unitPriceMinor, line_total_minor AS lineTotalMinor FROM sale_lines sl JOIN products p ON p.id = sl.product_id WHERE sale_id = ?"
    ).all(existing.id) as SaleResult["lines"];
    return { ...existing, lines };
  }

  const shift = db.prepare(
    "SELECT id FROM cashier_shifts WHERE cashier_user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1"
  ).get(input.actorUserId) as { id: string } | undefined;
  if (!shift) throw new Error("افتح وردية الصندوق قبل تسجيل المبيعات");

  const warehouse = db.prepare("SELECT id FROM warehouses WHERE code = 'MAIN'").get() as { id: string } | undefined;
  if (!warehouse) throw new Error("المستودع الرئيسي غير مهيأ");

  const normalized = new Map<string, number>();
  for (const line of input.lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("كمية أحد المنتجات غير صحيحة");
    }
    normalized.set(line.productId, (normalized.get(line.productId) ?? 0) + line.quantity);
  }

  const preparedLines = [...normalized.entries()].map(([productId, quantity]) => {
    const product = db.prepare(
      "SELECT id, sku, name_ar AS nameAr, price_minor AS priceMinor, is_active AS isActive FROM products WHERE id = ?"
    ).get(productId) as { id: string; sku: string; nameAr: string; priceMinor: number; isActive: number } | undefined;
    if (!product || product.isActive !== 1) throw new Error("أحد المنتجات غير متاح للبيع");
    const stock = db.prepare(
      "SELECT COALESCE(SUM(quantity_delta), 0) AS quantity FROM stock_movements WHERE product_id = ? AND warehouse_id = ?"
    ).get(productId, warehouse.id) as { quantity: number };
    if (stock.quantity < quantity) throw new Error(`المخزون غير كافٍ للمنتج: ${product.nameAr}`);
    const lineTotalMinor = product.priceMinor * quantity;
    if (!Number.isSafeInteger(lineTotalMinor)) throw new Error("قيمة أحد بنود الفاتورة تجاوزت الحد المسموح");
    return { productId, sku: product.sku, nameAr: product.nameAr, quantity, unitPriceMinor: product.priceMinor, lineTotalMinor };
  });

  const totalMinor = preparedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) throw new Error("إجمالي الفاتورة غير صحيح");
  const saleId = randomUUID();
  const saleNumber = `NSR-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${saleId.slice(0, 6).toUpperCase()}`;

  const post = db.transaction(() => {
    db.prepare(`
      INSERT INTO sales (id, sale_number, cashier_shift_id, status, subtotal_minor, discount_minor, tax_minor, total_minor, idempotency_key, created_by)
      VALUES (?, ?, ?, 'posted', ?, 0, 0, ?, ?, ?)
    `).run(saleId, saleNumber, shift.id, totalMinor, totalMinor, input.idempotencyKey, input.actorUserId);

    for (const line of preparedLines) {
      db.prepare(`
        INSERT INTO sale_lines (id, sale_id, product_id, quantity, unit_price_minor, discount_minor, line_total_minor)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).run(randomUUID(), saleId, line.productId, line.quantity, line.unitPriceMinor, line.lineTotalMinor);
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity_delta, unit_cost_minor, reference_type, reference_id, created_by)
        VALUES (?, ?, ?, 'sale', ?, 0, 'sale', ?, ?)
      `).run(randomUUID(), line.productId, warehouse.id, -line.quantity, saleId, input.actorUserId);
    }

    db.prepare(
      "INSERT INTO payments (id, sale_id, method, amount_minor) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), saleId, input.paymentMethod, totalMinor);
    db.prepare(
      "INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'sale.post', 'sale', ?, ?)"
    ).run(randomUUID(), input.actorUserId, saleId, JSON.stringify({ saleNumber, totalMinor, lineCount: preparedLines.length }));
  });
  post();
  return { id: saleId, saleNumber, totalMinor, status: "posted", lines: preparedLines };
}
