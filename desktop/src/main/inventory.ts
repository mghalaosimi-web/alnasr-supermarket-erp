import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type StockMovementRow = {
  id: string;
  sku: string;
  productName: string;
  warehouseName: string;
  movementType: string;
  quantityDelta: number;
  unitCostMinor: number;
  occurredAt: string;
};

export function listStockMovements(db: Database.Database, limit = 50): StockMovementRow[] {
  const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
  return db.prepare(
    "SELECT sm.id, p.sku, p.name_ar AS productName, w.name_ar AS warehouseName, sm.movement_type AS movementType, sm.quantity_delta AS quantityDelta, sm.unit_cost_minor AS unitCostMinor, sm.occurred_at AS occurredAt FROM stock_movements sm JOIN products p ON p.id = sm.product_id JOIN warehouses w ON w.id = sm.warehouse_id ORDER BY sm.occurred_at DESC, sm.rowid DESC LIMIT ?"
  ).all(safeLimit) as StockMovementRow[];
}

export function receiveStock(
  db: Database.Database,
  input: { productId: string; quantity: number; unitCostMinor: number; actorUserId: string }
): { movementId: string; quantityOnHand: number } {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error("كمية الاستلام يجب أن تكون عدداً صحيحاً أكبر من صفر");
  if (!Number.isSafeInteger(input.unitCostMinor) || input.unitCostMinor < 0) throw new Error("تكلفة الوحدة غير صحيحة");

  const receive = db.transaction(() => {
    const product = db.prepare("SELECT id, is_active AS isActive FROM products WHERE id = ?")
      .get(input.productId) as { id: string; isActive: number } | undefined;
    if (!product || product.isActive !== 1) throw new Error("المنتج غير موجود أو غير نشط");
    const warehouse = db.prepare("SELECT id FROM warehouses WHERE code = 'MAIN'").get() as { id: string } | undefined;
    if (!warehouse) throw new Error("المستودع الرئيسي غير مهيأ");
    const movementId = randomUUID();
    db.prepare("INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity_delta, unit_cost_minor, reference_type, reference_id, created_by) VALUES (?, ?, ?, 'purchase', ?, ?, 'manual_receipt', ?, ?)")
      .run(movementId, input.productId, warehouse.id, input.quantity, input.unitCostMinor, movementId, input.actorUserId);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'stock.receive', 'product', ?, ?)")
      .run(randomUUID(), input.actorUserId, input.productId, JSON.stringify({ quantity: input.quantity, unitCostMinor: input.unitCostMinor, movementId }));
    const balance = db.prepare("SELECT COALESCE(SUM(quantity_delta), 0) AS quantity FROM stock_movements WHERE product_id = ? AND warehouse_id = ?")
      .get(input.productId, warehouse.id) as { quantity: number };
    return { movementId, quantityOnHand: balance.quantity };
  });
  return receive.immediate();
}

export function adjustStockCount(
  db: Database.Database,
  input: { productId: string; countedQuantity: number; actorUserId: string }
): { movementId: string | null; previousQuantity: number; countedQuantity: number; difference: number } {
  if (!Number.isSafeInteger(input.countedQuantity) || input.countedQuantity < 0) {
    throw new Error("الكمية الفعلية يجب أن تكون صفراً أو أكثر");
  }
  const adjust = db.transaction(() => {
    const product = db.prepare("SELECT id, cost_minor AS costMinor, is_active AS isActive FROM products WHERE id = ?")
      .get(input.productId) as { id: string; costMinor: number; isActive: number } | undefined;
    if (!product || product.isActive !== 1) throw new Error("المنتج غير موجود أو غير نشط");
    const warehouse = db.prepare("SELECT id FROM warehouses WHERE code = 'MAIN'").get() as { id: string } | undefined;
    if (!warehouse) throw new Error("المستودع الرئيسي غير مهيأ");
    const balance = db.prepare("SELECT COALESCE(SUM(quantity_delta), 0) AS quantity FROM stock_movements WHERE product_id = ? AND warehouse_id = ?")
      .get(input.productId, warehouse.id) as { quantity: number };
    const difference = input.countedQuantity - balance.quantity;
    if (difference === 0) return { movementId: null, previousQuantity: balance.quantity, countedQuantity: input.countedQuantity, difference: 0 };
    const movementId = randomUUID();
    db.prepare("INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity_delta, unit_cost_minor, reference_type, reference_id, created_by) VALUES (?, ?, ?, 'adjustment', ?, ?, 'stock_count', ?, ?)")
      .run(movementId, input.productId, warehouse.id, difference, product.costMinor, movementId, input.actorUserId);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'stock.adjust', 'product', ?, ?)")
      .run(randomUUID(), input.actorUserId, input.productId, JSON.stringify({ previousQuantity: balance.quantity, countedQuantity: input.countedQuantity, difference, movementId }));
    return { movementId, previousQuantity: balance.quantity, countedQuantity: input.countedQuantity, difference };
  });
  return adjust.immediate();
}
