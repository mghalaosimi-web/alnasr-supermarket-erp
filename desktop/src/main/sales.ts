import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type SaleLineInput = { productId: string; quantity: number };
export type CreateSaleInput = {
  lines: SaleLineInput[];
  paymentMethod?: "cash" | "card" | "transfer";
  paidMinor?: number;
  idempotencyKey: string;
  customerId?: string;
  actorUserId: string;
};
export type SaleResult = {
  id: string;
  saleNumber: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  status: "posted";
  lines: Array<{ productId: string; sku: string; nameAr: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }>;
};

export type ReceivableRow = {
  id: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  occurredAt: string;
};

export type AddSalePaymentInput = {
  saleId: string;
  amountMinor: number;
  method: "cash" | "card" | "transfer";
  actorUserId: string;
};

export function listReceivables(db: Database.Database, limit = 200): ReceivableRow[] {
  const safeLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
  return db.prepare(`
    SELECT s.id, s.sale_number AS saleNumber, s.customer_id AS customerId,
      c.name AS customerName, s.total_minor AS totalMinor, s.paid_minor AS paidMinor,
      (s.total_minor - s.paid_minor) AS outstandingMinor, s.occurred_at AS occurredAt
    FROM sales s JOIN customers c ON c.id = s.customer_id
    WHERE s.status = 'posted' AND s.paid_minor < s.total_minor
    ORDER BY s.occurred_at DESC, s.rowid DESC
    LIMIT ?
  `).all(safeLimit) as ReceivableRow[];
}

export function addSalePayment(db: Database.Database, input: AddSalePaymentInput): ReceivableRow {
  if (!input.saleId || !input.actorUserId) throw new Error("بيانات تحصيل العميل غير مكتملة");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("يجب أن يكون مبلغ التحصيل أكبر من صفر");
  }
  if (!["cash", "card", "transfer"].includes(input.method)) throw new Error("طريقة الدفع غير مدعومة");

  const settle = db.transaction((): ReceivableRow => {
    const sale = db.prepare(`
      SELECT s.id, s.sale_number AS saleNumber, s.customer_id AS customerId,
        c.name AS customerName, s.total_minor AS totalMinor, s.paid_minor AS paidMinor
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = ? AND s.status = 'posted'
    `).get(input.saleId) as {
      id: string; saleNumber: string; customerId: string | null; customerName: string | null;
      totalMinor: number; paidMinor: number;
    } | undefined;
    if (!sale || !sale.customerId || !sale.customerName) throw new Error("فاتورة العميل غير موجودة أو غير مؤهلة للتحصيل");
    const outstandingMinor = sale.totalMinor - sale.paidMinor;
    if (outstandingMinor <= 0) throw new Error("فاتورة العميل مسددة بالكامل");
    if (input.amountMinor > outstandingMinor) throw new Error("مبلغ التحصيل يتجاوز المبلغ المستحق من العميل");

    db.prepare("INSERT INTO payments (id, sale_id, method, amount_minor) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), sale.id, input.method, input.amountMinor);
    db.prepare("UPDATE sales SET paid_minor = paid_minor + ? WHERE id = ?")
      .run(input.amountMinor, sale.id);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'sale.payment', 'sale', ?, ?)")
      .run(randomUUID(), input.actorUserId, sale.id, JSON.stringify({
        saleNumber: sale.saleNumber,
        amountMinor: input.amountMinor,
        method: input.method,
        previousOutstandingMinor: outstandingMinor,
        outstandingMinor: outstandingMinor - input.amountMinor
      }));

    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      customerId: sale.customerId,
      customerName: sale.customerName,
      totalMinor: sale.totalMinor,
      paidMinor: sale.paidMinor + input.amountMinor,
      outstandingMinor: outstandingMinor - input.amountMinor,
      occurredAt: (db.prepare("SELECT occurred_at AS occurredAt FROM sales WHERE id = ?").get(sale.id) as { occurredAt: string }).occurredAt
    };
  });
  return settle.immediate();
}

export function openCashierShift(
  db: Database.Database,
  input: { openingCashMinor: number; cashierUserId: string }
): { id: string; openingCashMinor: number; status: "open" } {
  if (!Number.isSafeInteger(input.openingCashMinor) || input.openingCashMinor < 0) {
    throw new Error("رصيد افتتاح الصندوق غير صحيح");
  }
  const create = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM cashier_shifts WHERE cashier_user_id = ? AND status = 'open' LIMIT 1")
      .get(input.cashierUserId) as { id: string } | undefined;
    if (existing) throw new Error("يوجد وردية مفتوحة لهذا المستخدم بالفعل");
    const id = randomUUID();
    db.prepare("INSERT INTO cashier_shifts (id, cashier_user_id, opening_cash_minor, status) VALUES (?, ?, ?, 'open')")
      .run(id, input.cashierUserId, input.openingCashMinor);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'shift.open', 'cashier_shift', ?, ?)")
      .run(randomUUID(), input.cashierUserId, id, JSON.stringify({ openingCashMinor: input.openingCashMinor }));
    return { id, openingCashMinor: input.openingCashMinor, status: "open" as const };
  });
  return create.immediate();
}

export function closeCashierShift(
  db: Database.Database,
  input: { shiftId: string; closingCashMinor: number; actorUserId: string }
): { id: string; closingCashMinor: number; status: "closed" } {
  if (!Number.isSafeInteger(input.closingCashMinor) || input.closingCashMinor < 0) {
    throw new Error("رصيد إغلاق الصندوق غير صحيح");
  }
  const close = db.transaction(() => {
    const shift = db.prepare("SELECT id, cashier_user_id AS cashierUserId, status FROM cashier_shifts WHERE id = ?")
      .get(input.shiftId) as { id: string; cashierUserId: string; status: string } | undefined;
    if (!shift || shift.cashierUserId !== input.actorUserId || shift.status !== "open") {
      throw new Error("الوردية غير موجودة أو لا يمكن إغلاقها");
    }
    db.prepare("UPDATE cashier_shifts SET closing_cash_minor = ?, closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), status = 'closed' WHERE id = ? AND status = 'open'")
      .run(input.closingCashMinor, input.shiftId);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'shift.close', 'cashier_shift', ?, ?)")
      .run(randomUUID(), input.actorUserId, input.shiftId, JSON.stringify({ closingCashMinor: input.closingCashMinor }));
    return { id: input.shiftId, closingCashMinor: input.closingCashMinor, status: "closed" as const };
  });
  return close.immediate();
}


export function getOpenCashierShift(
  db: Database.Database,
  cashierUserId: string
): { id: string; openingCashMinor: number; openedAt: string } | null {
  return (db.prepare("SELECT id, opening_cash_minor AS openingCashMinor, opened_at AS openedAt FROM cashier_shifts WHERE cashier_user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1")
    .get(cashierUserId) as { id: string; openingCashMinor: number; openedAt: string } | undefined) ?? null;
}

export function createSale(db: Database.Database, input: CreateSaleInput): SaleResult {
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100) {
    throw new Error("أضف منتجاً واحداً على الأقل إلى الفاتورة");
  }
  if (input.paymentMethod !== undefined && !["cash", "card", "transfer"].includes(input.paymentMethod)) {
    throw new Error("طريقة الدفع غير مدعومة");
  }
  if (input.paidMinor !== undefined && (!Number.isSafeInteger(input.paidMinor) || input.paidMinor < 0)) {
    throw new Error("قيمة المدفوع غير صحيحة");
  }
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 120) {
    throw new Error("مفتاح العملية غير صحيح");
  }
  const normalized = new Map<string, number>();
  for (const line of input.lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("كمية أحد المنتجات غير صحيحة");
    }
    normalized.set(line.productId, (normalized.get(line.productId) ?? 0) + line.quantity);
  }

  const post = db.transaction((): SaleResult => {
    const existing = db.prepare("SELECT id, sale_number AS saleNumber, total_minor AS totalMinor, paid_minor AS paidMinor, status FROM sales WHERE idempotency_key = ? AND created_by = ?")
      .get(input.idempotencyKey, input.actorUserId) as { id: string; saleNumber: string; totalMinor: number; paidMinor: number; status: "posted" } | undefined;
    if (existing) {
      const lines = db.prepare("SELECT product_id AS productId, p.sku, p.name_ar AS nameAr, quantity, unit_price_minor AS unitPriceMinor, line_total_minor AS lineTotalMinor FROM sale_lines sl JOIN products p ON p.id = sl.product_id WHERE sale_id = ?")
        .all(existing.id) as SaleResult["lines"];
      return { ...existing, outstandingMinor: existing.totalMinor - existing.paidMinor, lines };
    }

    const customerId = input.customerId ?? null;
    if (customerId) {
      const customer = db.prepare("SELECT id, credit_limit_minor AS creditLimitMinor FROM customers WHERE id = ? AND is_active = 1")
        .get(customerId) as { id: string; creditLimitMinor: number } | undefined;
      if (!customer) throw new Error("العميل المحدد غير موجود أو غير نشط");
    }

    const shift = db.prepare("SELECT id FROM cashier_shifts WHERE cashier_user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1")
      .get(input.actorUserId) as { id: string } | undefined;
    if (!shift) throw new Error("افتح وردية الصندوق قبل تسجيل المبيعات");

    const warehouse = db.prepare("SELECT id FROM warehouses WHERE code = 'MAIN'").get() as { id: string } | undefined;
    if (!warehouse) throw new Error("المستودع الرئيسي غير مهيأ");

    const preparedLines = [...normalized.entries()].map(([productId, quantity]) => {
      const product = db.prepare("SELECT id, sku, name_ar AS nameAr, price_minor AS priceMinor, cost_minor AS costMinor, is_active AS isActive FROM products WHERE id = ?")
        .get(productId) as { id: string; sku: string; nameAr: string; priceMinor: number; costMinor: number; isActive: number } | undefined;
      if (!product || product.isActive !== 1) throw new Error("أحد المنتجات غير متاح للبيع");
      const stock = db.prepare("SELECT COALESCE(SUM(quantity_delta), 0) AS quantity FROM stock_movements WHERE product_id = ? AND warehouse_id = ?")
        .get(productId, warehouse.id) as { quantity: number };
      if (stock.quantity < quantity) throw new Error("المخزون غير كافٍ للمنتج: " + product.nameAr);
      const lineTotalMinor = product.priceMinor * quantity;
      if (!Number.isSafeInteger(lineTotalMinor)) throw new Error("قيمة أحد بنود الفاتورة تجاوزت الحد المسموح");
      return { productId, sku: product.sku, nameAr: product.nameAr, quantity, unitPriceMinor: product.priceMinor, unitCostMinor: product.costMinor, lineTotalMinor };
    });

    const totalMinor = preparedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) throw new Error("إجمالي الفاتورة غير صحيح");
    const paidMinor = input.paidMinor ?? totalMinor;
    if (paidMinor > totalMinor) throw new Error("المبلغ المدفوع يتجاوز إجمالي الفاتورة");
    if (paidMinor > 0 && !input.paymentMethod) throw new Error("حدد طريقة الدفع للمبلغ المحصل");
    const outstandingMinor = totalMinor - paidMinor;
    if (outstandingMinor > 0) {
      if (!customerId) throw new Error("اختر عميلاً لتسجيل البيع الآجل");
      const customer = db.prepare("SELECT credit_limit_minor AS creditLimitMinor FROM customers WHERE id = ? AND is_active = 1")
        .get(customerId) as { creditLimitMinor: number } | undefined;
      if (!customer) throw new Error("العميل المحدد غير موجود أو غير نشط");
      const balance = db.prepare("SELECT COALESCE(SUM(total_minor - paid_minor), 0) AS outstandingMinor FROM sales WHERE customer_id = ? AND status = 'posted'")
        .get(customerId) as { outstandingMinor: number };
      if (balance.outstandingMinor + outstandingMinor > customer.creditLimitMinor) {
        throw new Error("تجاوز البيع الآجل حد ائتمان العميل");
      }
    }

    const saleId = randomUUID();
    const dateStamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const saleNumber = "NSR-" + dateStamp + "-" + saleId.slice(0, 6).toUpperCase();

    db.prepare("INSERT INTO sales (id, sale_number, customer_id, cashier_shift_id, status, subtotal_minor, discount_minor, tax_minor, total_minor, paid_minor, idempotency_key, created_by) VALUES (?, ?, ?, ?, 'posted', ?, 0, 0, ?, ?, ?, ?)")
      .run(saleId, saleNumber, customerId, shift.id, totalMinor, totalMinor, paidMinor, input.idempotencyKey, input.actorUserId);

    for (const line of preparedLines) {
      db.prepare("INSERT INTO sale_lines (id, sale_id, product_id, quantity, unit_price_minor, discount_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, 0, ?)")
        .run(randomUUID(), saleId, line.productId, line.quantity, line.unitPriceMinor, line.lineTotalMinor);
      db.prepare("INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity_delta, unit_cost_minor, reference_type, reference_id, created_by) VALUES (?, ?, ?, 'sale', ?, ?, 'sale', ?, ?)")
        .run(randomUUID(), line.productId, warehouse.id, -line.quantity, line.unitCostMinor, saleId, input.actorUserId);
    }

    if (paidMinor > 0) {
      db.prepare("INSERT INTO payments (id, sale_id, method, amount_minor) VALUES (?, ?, ?, ?)")
        .run(randomUUID(), saleId, input.paymentMethod, paidMinor);
    }
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'sale.post', 'sale', ?, ?)")
      .run(randomUUID(), input.actorUserId, saleId, JSON.stringify({ saleNumber, totalMinor, paidMinor, outstandingMinor, lineCount: preparedLines.length }));

    return {
      id: saleId,
      saleNumber,
      totalMinor,
      paidMinor,
      outstandingMinor,
      status: "posted",
      lines: preparedLines.map(({ productId, sku, nameAr, quantity, unitPriceMinor, lineTotalMinor }) => ({
        productId, sku, nameAr, quantity, unitPriceMinor, lineTotalMinor
      }))
    };
  });
  return post.immediate();
}
