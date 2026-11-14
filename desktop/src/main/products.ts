import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type CreateProductInput = {
  sku: string;
  nameAr: string;
  nameEn?: string;
  barcode?: string;
  costMinor: number;
  priceMinor: number;
  openingQuantity?: number;
  actorUserId: string;
};

export type ProductRow = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string | null;
  barcode: string | null;
  costMinor: number;
  priceMinor: number;
  isActive: number;
  stockOnHand: number;
};

export function listProducts(db: Database.Database): ProductRow[] {
  return db.prepare(`
    SELECT p.id, p.sku, p.name_ar AS nameAr, p.name_en AS nameEn,
      (SELECT b.barcode FROM product_barcodes b WHERE b.product_id = p.id AND b.is_primary = 1 LIMIT 1) AS barcode,
      p.cost_minor AS costMinor, p.price_minor AS priceMinor, p.is_active AS isActive,
      COALESCE((SELECT SUM(sm.quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0) AS stockOnHand
    FROM products p
    ORDER BY p.name_ar COLLATE NOCASE, p.sku
  `).all() as ProductRow[];
}

export function createProduct(db: Database.Database, input: CreateProductInput): ProductRow {
  const sku = input.sku.trim().toUpperCase();
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn?.trim() || null;
  const barcode = input.barcode?.trim() || null;

  if (!/^[A-Z0-9._-]{2,40}$/.test(sku)) throw new Error("رمز المنتج يجب أن يكون من حرفين إلى 40 حرفاً");
  if (nameAr.length < 2 || nameAr.length > 160) throw new Error("اسم المنتج العربي غير صحيح");
  if (nameEn && nameEn.length > 160) throw new Error("اسم المنتج الإنجليزي طويل جداً");
  if (!Number.isSafeInteger(input.costMinor) || input.costMinor < 0) throw new Error("تكلفة المنتج غير صحيحة");
  if (!Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0) throw new Error("سعر البيع غير صحيح");
  const openingQuantity = input.openingQuantity ?? 0;
  if (!Number.isSafeInteger(openingQuantity) || openingQuantity < 0) throw new Error("الكمية الافتتاحية يجب أن تكون صفراً أو أكثر");
  if (barcode && !/^[0-9A-Za-z-]{4,64}$/.test(barcode)) throw new Error("الباركود غير صحيح");

  const unit = db.prepare("SELECT id FROM units WHERE code = 'PCS'").get() as { id: string } | undefined;
  if (!unit) throw new Error("وحدة القطعة غير مهيأة");

  const product: ProductRow = {
    id: randomUUID(), sku, nameAr, nameEn, barcode,
    costMinor: input.costMinor, priceMinor: input.priceMinor, isActive: 1, stockOnHand: openingQuantity
  };

  const warehouse = openingQuantity > 0
    ? db.prepare("SELECT id FROM warehouses WHERE code = 'MAIN'").get() as { id: string } | undefined
    : undefined;
  if (openingQuantity > 0 && !warehouse) throw new Error("المستودع الرئيسي غير مهيأ");

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO products (id, unit_id, sku, name_ar, name_en, cost_minor, price_minor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(product.id, unit.id, sku, nameAr, nameEn, input.costMinor, input.priceMinor);

    if (barcode) {
      db.prepare("INSERT INTO product_barcodes (id, product_id, barcode, is_primary) VALUES (?, ?, ?, 1)")
        .run(randomUUID(), product.id, barcode);
    }

    if (openingQuantity > 0 && warehouse) {
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity_delta, unit_cost_minor, reference_type, reference_id, created_by)
        VALUES (?, ?, ?, 'opening', ?, ?, 'product_initial_stock', ?, ?)
      `).run(randomUUID(), product.id, warehouse.id, openingQuantity, input.costMinor, product.id, input.actorUserId);
    }

    db.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, 'product.create', 'product', ?, ?)
    `).run(randomUUID(), input.actorUserId, product.id, JSON.stringify({ sku, nameAr, openingQuantity }));
  });
  insert();
  return product;
}
