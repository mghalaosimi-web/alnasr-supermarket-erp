import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2, applySchemaV3 } from "../db/schema.js";
import { getStockBalance, postStockMovement } from "../inventory/stock-ledger.js";
import { createSale, postSale } from "./sales.js";

describe("POS sale lifecycle", () => {
  let db: Database.Database | undefined;

  function setup(): Database.Database {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    applySchemaV2(db);
    applySchemaV3(db);
    db.prepare("INSERT INTO stores(id, name) VALUES ('store-1', 'Store')").run();
    db.prepare("INSERT INTO warehouses(id, store_id, code, name) VALUES ('wh-1', 'store-1', 'MAIN', 'Main')").run();
    db.prepare("INSERT INTO products(id, sku, name_ar, base_unit, cost_price_minor) VALUES ('prod-1', 'SKU-1', 'منتج', 'piece', 100)").run();
    return db;
  }

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  const saleInput = (overrides: Partial<Parameters<typeof createSale>[1]> = {}) => ({
    documentNo: "INV-0001",
    storeId: "store-1",
    warehouseId: "wh-1",
    lines: [{ productId: "prod-1", quantity: 2, unitPriceMinor: 250 }],
    discountMinor: 50,
    taxMinor: 20,
    idempotencyKey: "sale-create-0001",
    ...overrides
  });

  it("creates a draft sale and handles identical idempotent retries", () => {
    const database = setup();
    const first = createSale(database, saleInput());
    const retry = createSale(database, saleInput());
    expect(first.duplicate).toBe(false);
    expect(first.subtotalMinor).toBe(500);
    expect(first.totalMinor).toBe(470);
    expect(retry.saleId).toBe(first.saleId);
    expect(retry.duplicate).toBe(true);
    expect(database.prepare("SELECT status FROM sales WHERE id = ?").get(first.saleId)).toEqual({ status: "draft" });
  });

  it("posts sale stock deductions atomically and is safe to retry", () => {
    const database = setup();
    postStockMovement(database, {
      productId: "prod-1", warehouseId: "wh-1", quantityDelta: 5, unitCostMinor: 100,
      sourceType: "opening_balance", sourceId: "opening-1", idempotencyKey: "opening-1"
    });
    const sale = createSale(database, saleInput());
    const first = postSale(database, sale.saleId);
    const retry = postSale(database, sale.saleId);
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(getStockBalance(database, "prod-1", "wh-1")).toBe(3);
    expect(database.prepare("SELECT status FROM sales WHERE id = ?").get(sale.saleId)).toEqual({ status: "posted" });
  });

  it("rolls back the posting when stock is insufficient", () => {
    const database = setup();
    const sale = createSale(database, saleInput());
    expect(() => postSale(database, sale.saleId)).toThrow(/Insufficient stock/);
    expect(database.prepare("SELECT status FROM sales WHERE id = ?").get(sale.saleId)).toEqual({ status: "draft" });
    expect(database.prepare("SELECT COUNT(*) AS count FROM stock_ledger").get()).toEqual({ count: 0 });
  });

  it("rejects discounts greater than subtotal", () => {
    const database = setup();
    expect(() => createSale(database, saleInput({ discountMinor: 501 }))).toThrow(/Discount cannot exceed/);
  });
});
