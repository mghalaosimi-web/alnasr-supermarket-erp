import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2, applySchemaV3, applySchemaV4, applySchemaV5, applySchemaV6 } from "../db/schema.js";
import { getStockBalance, postStockMovement } from "../inventory/stock-ledger.js";
import { createSale, postSale } from "./sales.js";
import { createSaleReturn, postSaleReturn, voidSaleReturn } from "./sales-returns.js";

describe("POS sale lifecycle", () => {
  let db: Database.Database | undefined;

  function setup(): Database.Database {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    applySchemaV2(db);
    applySchemaV3(db);
    applySchemaV4(db);
    applySchemaV5(db);
    applySchemaV6(db);
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
  it("creates and posts a partial customer return, restoring stock once", () => {
    const database = setup();
    postStockMovement(database, {
      productId: "prod-1", warehouseId: "wh-1", quantityDelta: 5, unitCostMinor: 100,
      sourceType: "opening_balance", sourceId: "opening-return-1", idempotencyKey: "opening-return-1"
    });
    const sale = createSale(database, saleInput());
    postSale(database, sale.saleId);
    const saleLine = database.prepare("SELECT id FROM sale_lines WHERE sale_id = ?").get(sale.saleId) as { id: string };
    const returned = createSaleReturn(database, {
      documentNo: "RET-0001", saleId: sale.saleId, reason: "Damaged item",
      lines: [{ saleLineId: saleLine.id, quantity: 1 }],
      idempotencyKey: "return-create-0001"
    });
    expect(returned.totalMinor).toBe(250);
    const retryReturn = createSaleReturn(database, {
      documentNo: "RET-0001", saleId: sale.saleId, reason: "Damaged item",
      lines: [{ saleLineId: saleLine.id, quantity: 1 }],
      idempotencyKey: "return-create-0001"
    });
    expect(retryReturn.returnId).toBe(returned.returnId);
    expect(retryReturn.duplicate).toBe(true);
    const posted = postSaleReturn(database, returned.returnId);
    const retry = postSaleReturn(database, returned.returnId);
    expect(posted.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(getStockBalance(database, "prod-1", "wh-1")).toBe(4);
  });

  it("prevents returning more units than were sold across separate return drafts", () => {
    const database = setup();
    postStockMovement(database, {
      productId: "prod-1", warehouseId: "wh-1", quantityDelta: 5, unitCostMinor: 100,
      sourceType: "opening_balance", sourceId: "opening-return-2", idempotencyKey: "opening-return-2"
    });
    const sale = createSale(database, saleInput());
    postSale(database, sale.saleId);
    const saleLine = database.prepare("SELECT id FROM sale_lines WHERE sale_id = ?").get(sale.saleId) as { id: string };
    createSaleReturn(database, {
      documentNo: "RET-0002", saleId: sale.saleId, reason: "First partial return",
      lines: [{ saleLineId: saleLine.id, quantity: 1 }], idempotencyKey: "return-create-0002"
    });
    expect(() => createSaleReturn(database, {
      documentNo: "RET-0003", saleId: sale.saleId, reason: "Excess return",
      lines: [{ saleLineId: saleLine.id, quantity: 2 }], idempotencyKey: "return-create-0003"
    })).toThrow(/exceeds the unreturned quantity/i);
  });

  it("voids a draft return and releases its reserved return quantity", () => {
    const database = setup();
    postStockMovement(database, {
      productId: "prod-1", warehouseId: "wh-1", quantityDelta: 5, unitCostMinor: 100,
      sourceType: "opening_balance", sourceId: "opening-return-void", idempotencyKey: "opening-return-void"
    });
    const sale = createSale(database, saleInput());
    postSale(database, sale.saleId);
    const saleLine = database.prepare("SELECT id FROM sale_lines WHERE sale_id = ?").get(sale.saleId) as { id: string };
    const draft = createSaleReturn(database, {
      documentNo: "RET-VOID-1", saleId: sale.saleId, reason: "Wrong item",
      lines: [{ saleLineId: saleLine.id, quantity: 2 }], idempotencyKey: "return-void-create-1"
    });
    expect(voidSaleReturn(database, draft.returnId).status).toBe("voided");
    const replacement = createSaleReturn(database, {
      documentNo: "RET-VOID-2", saleId: sale.saleId, reason: "Corrected return",
      lines: [{ saleLineId: saleLine.id, quantity: 2 }], idempotencyKey: "return-void-create-2"
    });
    expect(replacement.duplicate).toBe(false);
  });

  it("rejects returns for unposted sales and returns without original stock cost", () => {
    const database = setup();
    const sale = createSale(database, saleInput());
    const saleLine = database.prepare("SELECT id FROM sale_lines WHERE sale_id = ?").get(sale.saleId) as { id: string };
    expect(() => createSaleReturn(database, {
      documentNo: "RET-0004", saleId: sale.saleId, reason: "Not posted",
      lines: [{ saleLineId: saleLine.id, quantity: 1 }], idempotencyKey: "return-create-0004"
    })).toThrow(/posted sale/i);
  });

});
