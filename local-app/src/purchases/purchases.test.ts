import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2, applySchemaV3 } from "../db/schema.js";
import { getStockBalance, postStockMovement } from "../inventory/stock-ledger.js";
import { createPurchase, postPurchase } from "./purchases.js";

describe("purchase receiving lifecycle", () => {
  let db: Database.Database | undefined;

  function setup(): Database.Database {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    applySchemaV2(db);
    applySchemaV3(db);
    db.prepare("INSERT INTO stores(id, name) VALUES ('store-1', 'Store')").run();
    db.prepare("INSERT INTO warehouses(id, store_id, code, name) VALUES ('wh-1', 'store-1', 'MAIN', 'Main')").run();
    db.prepare("INSERT INTO products(id, sku, name_ar, base_unit) VALUES ('prod-1', 'SKU-1', 'منتج', 'piece')").run();
    db.prepare("INSERT INTO suppliers(id, code, name) VALUES ('sup-1', 'SUP-1', 'Supplier')").run();
    return db;
  }

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  const purchaseInput = (overrides: Partial<Parameters<typeof createPurchase>[1]> = {}) => ({
    documentNo: "PO-0001",
    storeId: "store-1",
    warehouseId: "wh-1",
    supplierId: "sup-1",
    lines: [{ productId: "prod-1", quantity: 20, unitCostMinor: 100 }],
    discountMinor: 100,
    taxMinor: 50,
    idempotencyKey: "purchase-create-0001",
    ...overrides
  });

  it("creates a draft purchase and handles identical retries", () => {
    const database = setup();
    const first = createPurchase(database, purchaseInput());
    const retry = createPurchase(database, purchaseInput());
    expect(first.subtotalMinor).toBe(2000);
    expect(first.totalMinor).toBe(1950);
    expect(retry.purchaseId).toBe(first.purchaseId);
    expect(retry.duplicate).toBe(true);
  });

  it("receives stock exactly once when a purchase is posted", () => {
    const database = setup();
    const purchase = createPurchase(database, purchaseInput());
    const first = postPurchase(database, purchase.purchaseId);
    const retry = postPurchase(database, purchase.purchaseId);
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(getStockBalance(database, "prod-1", "wh-1")).toBe(20);
    expect(database.prepare("SELECT status FROM purchases WHERE id = ?").get(purchase.purchaseId)).toEqual({ status: "posted" });
  });

  it("rejects posting a purchase that does not exist", () => {
    const database = setup();
    expect(() => postPurchase(database, "missing-purchase")).toThrow(/Purchase not found/);
    expect(database.prepare("SELECT COUNT(*) AS count FROM stock_ledger").get()).toEqual({ count: 0 });
  });

  it("rejects purchase discount greater than subtotal", () => {
    const database = setup();
    expect(() => createPurchase(database, purchaseInput({ discountMinor: 2001 }))).toThrow(/Discount cannot exceed/);
  });
});
