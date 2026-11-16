import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export interface ProductInput {
  sku: string;
  nameAr: string;
  nameEn?: string | null;
  baseUnit: string;
  salePriceMinor: number;
  costPriceMinor: number;
  barcode?: string | null;
  actorUserId?: string | null;
}

export interface ProductRecord {
  id: string;
  sku: string;
  name_ar: string;
  name_en: string | null;
  base_unit: string;
  sale_price_minor: number;
  cost_price_minor: number;
  is_active: number;
}

function validate(input: ProductInput): void {
  if (!/^[A-Za-z0-9._/-]{1,64}$/.test(input.sku.trim())) throw new Error("Invalid product SKU.");
  if (input.nameAr.trim().length < 1 || input.nameAr.trim().length > 160) throw new Error("Arabic product name is required.");
  if (input.nameEn && input.nameEn.trim().length > 160) throw new Error("English product name is too long.");
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(input.baseUnit)) throw new Error("Invalid base unit.");
  for (const [key, value] of [["salePriceMinor", input.salePriceMinor], ["costPriceMinor", input.costPriceMinor]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${key} must be a non-negative safe integer.`);
  }
  if (input.barcode && !/^[0-9A-Za-z-]{4,64}$/.test(input.barcode)) throw new Error("Invalid barcode.");
}

export function createProduct(db: Database.Database, input: ProductInput): ProductRecord {
  validate(input);
  const id = randomUUID();
  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO products(id, sku, name_ar, name_en, base_unit, sale_price_minor, cost_price_minor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.sku.trim(), input.nameAr.trim(), input.nameEn?.trim() || null,
      input.baseUnit, input.salePriceMinor, input.costPriceMinor);
    if (input.barcode) {
      db.prepare("INSERT INTO product_barcodes(id, product_id, barcode, unit_code) VALUES (?, ?, ?, ?)")
        .run(randomUUID(), id, input.barcode, input.baseUnit);
    }
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'product.created', 'product', ?, ?)
    `).run(randomUUID(), input.actorUserId ?? null, id, JSON.stringify({ sku: input.sku.trim() }));
  });
  create();
  return getProduct(db, id)!;
}

export function getProduct(db: Database.Database, id: string): ProductRecord | null {
  return (db.prepare(`
    SELECT id, sku, name_ar, name_en, base_unit, sale_price_minor, cost_price_minor, is_active
    FROM products WHERE id = ?
  `).get(id) as ProductRecord | undefined) ?? null;
}

export function listProducts(db: Database.Database, search = "", limit = 100, offset = 0): ProductRecord[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Limit must be between 1 and 200.");
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Offset must be a non-negative integer.");
  const term = `%${search.trim().slice(0, 80)}%`;
  return db.prepare(`
    SELECT id, sku, name_ar, name_en, base_unit, sale_price_minor, cost_price_minor, is_active
    FROM products
    WHERE is_active = 1 AND (sku LIKE ? OR name_ar LIKE ? OR name_en LIKE ?)
    ORDER BY name_ar COLLATE NOCASE, sku
    LIMIT ? OFFSET ?
  `).all(term, term, term, limit, offset) as ProductRecord[];
}

export function updateProduct(db: Database.Database, id: string, input: ProductInput): ProductRecord {
  validate(input);
  const update = db.transaction(() => {
    const current = getProduct(db, id);
    if (!current) throw new Error("Product not found.");
    if (!current.is_active) throw new Error("Inactive products cannot be edited.");
    db.prepare(`
      UPDATE products
      SET sku = ?, name_ar = ?, name_en = ?, base_unit = ?, sale_price_minor = ?, cost_price_minor = ?
      WHERE id = ?
    `).run(input.sku.trim(), input.nameAr.trim(), input.nameEn?.trim() || null,
      input.baseUnit, input.salePriceMinor, input.costPriceMinor, id);

    if (input.barcode !== undefined) {
      db.prepare("DELETE FROM product_barcodes WHERE product_id = ?").run(id);
      if (input.barcode) {
        db.prepare("INSERT INTO product_barcodes(id, product_id, barcode, unit_code) VALUES (?, ?, ?, ?)")
          .run(randomUUID(), id, input.barcode, input.baseUnit);
      }
    }
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'product.updated', 'product', ?, ?)
    `).run(randomUUID(), input.actorUserId ?? null, id, JSON.stringify({ sku: input.sku.trim() }));
  });
  update();
  return getProduct(db, id)!;
}

export function deactivateProduct(db: Database.Database, id: string, actorUserId: string): void {
  const update = db.transaction(() => {
    const product = getProduct(db, id);
    if (!product) throw new Error("Product not found.");
    db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(id);
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'product.deactivated', 'product', ?, '{}')
    `).run(randomUUID(), actorUserId, id);
  });
  update();
}
