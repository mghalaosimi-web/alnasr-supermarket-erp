import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type PurchaseLineInput = { productId: string; quantity: number; unitCostMinor: number };
export type CreatePurchaseInput = {
  supplierId: string;
  documentNumber?: string;
  lines: PurchaseLineInput[];
  paidMinor?: number;
  paymentMethod?: "cash" | "card" | "transfer";
  actorUserId: string;
};
export type PurchaseRow = {
  id: string;
  documentNumber: string;
  supplierId: string;
  supplierName: string;
  subtotalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  occurredAt: string;
  lineCount: number;
};

export function listPurchases(db: Database.Database, limit = 100): PurchaseRow[] {
  const safeLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
  return db.prepare(`
    SELECT pd.id, pd.document_number AS documentNumber, pd.supplier_id AS supplierId,
      s.name AS supplierName, pd.subtotal_minor AS subtotalMinor, pd.paid_minor AS paidMinor,
      (pd.subtotal_minor - pd.paid_minor) AS outstandingMinor, pd.occurred_at AS occurredAt,
      (SELECT COUNT(*) FROM purchase_lines pl WHERE pl.purchase_id = pd.id) AS lineCount
    FROM purchase_documents pd
    JOIN suppliers s ON s.id = pd.supplier_id
    WHERE pd.status = 'posted'
    ORDER BY pd.occurred_at DESC, pd.rowid DESC
    LIMIT ?
  `).all(safeLimit) as PurchaseRow[];
}

export function createPurchase(db: Database.Database, input: CreatePurchaseInput): PurchaseRow {
  if (!input.supplierId || !input.actorUserId) throw new Error("اختر المورد والمستخدم المسجل");
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 200) {
    throw new Error("يجب أن يحتوي مستند الشراء على صنف واحد على الأقل");
  }
  const paidMinor = input.paidMinor ?? 0;
  if (!Number.isSafeInteger(paidMinor) || paidMinor < 0) throw new Error("قيمة المدفوع غير صحيحة");
  if (paidMinor > 0 && !input.paymentMethod) throw new Error("حدد طريقة دفع المبلغ المدفوع");
  if (input.paymentMethod && !["cash", "card", "transfer"].includes(input.paymentMethod)) {
    throw new Error("طريقة الدفع غير مدعومة");
  }
  const normalized = new Map<string, { quantity: number; unitCostMinor: number }>();
  for (const line of input.lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
        !Number.isSafeInteger(line.unitCostMinor) || line.unitCostMinor < 0) {
      throw new Error("بيانات أحد أصناف الشراء غير صحيحة");
    }
    const existing = normalized.get(line.productId);
    if (existing && existing.unitCostMinor !== line.unitCostMinor) {
      throw new Error("لا يمكن تكرار الصنف بتكاليف مختلفة في المستند نفسه");
    }
    normalized.set(line.productId, {
      quantity: (existing?.quantity ?? 0) + line.quantity,
      unitCostMinor: line.unitCostMinor
    });
  }

  const post = db.transaction((): PurchaseRow => {
    const supplier = db.prepare("SELECT id, name FROM suppliers WHERE id = ? AND is_active = 1")
      .get(input.supplierId) as { id: string; name: string } | undefined;
    if (!supplier) throw new Error("المورد غير موجود أو غير نشط");
    const warehouse = db.prepare("SELECT id FROM warehouses WHERE code = 'MAIN' AND is_active = 1")
      .get() as { id: string } | undefined;
    if (!warehouse) throw new Error("المستودع الرئيسي غير مهيأ");

    const lines = [...normalized.entries()].map(([productId, item]) => {
      const product = db.prepare("SELECT id, cost_minor AS costMinor, is_active AS isActive FROM products WHERE id = ?")
        .get(productId) as { id: string; costMinor: number; isActive: number } | undefined;
      if (!product || product.isActive !== 1) throw new Error("أحد المنتجات غير موجود أو غير نشط");
      const lineTotalMinor = item.quantity * item.unitCostMinor;
      if (!Number.isSafeInteger(lineTotalMinor) || lineTotalMinor < 0) {
        throw new Error("قيمة أحد أصناف الشراء غير صحيحة");
      }
      return { productId, quantity: item.quantity, unitCostMinor: item.unitCostMinor, lineTotalMinor, previousCostMinor: product.costMinor };
    });
    const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 0 || paidMinor > subtotalMinor) {
      throw new Error("إجمالي مستند الشراء أو المبلغ المدفوع غير صحيح");
    }

    const id = randomUUID();
    const requestedNumber = input.documentNumber?.trim();
    const documentNumber = requestedNumber || "PUR-" + new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14) + "-" + id.slice(0, 6).toUpperCase();
    if (documentNumber.length < 3 || documentNumber.length > 64) throw new Error("رقم مستند الشراء يجب أن يكون بين 3 و64 حرفاً");

    db.prepare("INSERT INTO purchase_documents (id, document_number, supplier_id, status, subtotal_minor, paid_minor, created_by) VALUES (?, ?, ?, 'posted', ?, ?, ?)")
      .run(id, documentNumber, supplier.id, subtotalMinor, paidMinor, input.actorUserId);

    for (const line of lines) {
      db.prepare("INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_cost_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), id, line.productId, line.quantity, line.unitCostMinor, line.lineTotalMinor);
      const balance = db.prepare("SELECT COALESCE(SUM(quantity_delta), 0) AS quantity FROM stock_movements WHERE product_id = ? AND warehouse_id = ?")
        .get(line.productId, warehouse.id) as { quantity: number };
      const denominator = Math.max(0, balance.quantity) + line.quantity;
      const averageCost = denominator > 0
        ? Math.round((Math.max(0, balance.quantity) * line.previousCostMinor + line.quantity * line.unitCostMinor) / denominator)
        : line.unitCostMinor;
      db.prepare("UPDATE products SET cost_minor = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .run(averageCost, line.productId);
      db.prepare("INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity_delta, unit_cost_minor, reference_type, reference_id, created_by) VALUES (?, ?, ?, 'purchase', ?, ?, 'purchase', ?, ?)")
        .run(randomUUID(), line.productId, warehouse.id, line.quantity, line.unitCostMinor, id, input.actorUserId);
    }

    if (paidMinor > 0) {
      db.prepare("INSERT INTO purchase_payments (id, purchase_id, method, amount_minor) VALUES (?, ?, ?, ?)")
        .run(randomUUID(), id, input.paymentMethod, paidMinor);
    }
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'purchase.post', 'purchase', ?, ?)")
      .run(randomUUID(), input.actorUserId, id, JSON.stringify({ documentNumber, supplierId: supplier.id, subtotalMinor, paidMinor, lineCount: lines.length }));

    return {
      id, documentNumber, supplierId: supplier.id, supplierName: supplier.name,
      subtotalMinor, paidMinor, outstandingMinor: subtotalMinor - paidMinor,
      occurredAt: (db.prepare("SELECT occurred_at AS occurredAt FROM purchase_documents WHERE id = ?").get(id) as { occurredAt: string }).occurredAt,
      lineCount: lines.length
    };
  });
  return post.immediate();
}
