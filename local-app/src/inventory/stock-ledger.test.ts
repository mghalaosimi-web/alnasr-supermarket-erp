import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2 } from "../db/schema.js";
import {
  getStockBalance,
  IdempotencyConflictError,
  InsufficientStockError,
  postStockMovement
} from "./stock-ledger.js";

describe("transactional stock ledger", () => {
  let db: Database.Database | undefined;

  function setup(): Database.Database {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    applySchemaV2(db);
    db.prepare("INSERT INTO stores(id, name) VALUES ('store-1', 'Store')").run();
    db.prepare("INSERT INTO warehouses(id, store_id, code, name) VALUES ('wh-1', 'store-1', 'MAIN', 'Main')").run();
    db.prepare("INSERT INTO products(id, sku, name_ar, base_unit) VALUES ('prod-1', 'SKU-1', 'منتج اختبار', 'piece')").run();
    return db;
  }

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  const movement = (overrides: Partial<Parameters<typeof postStockMovement>[1]> = {}) => ({
    productId: "prod-1",
    warehouseId: "wh-1",
    quantityDelta: 10,
    unitCostMinor: 250,
    sourceType: "opening_balance",
    sourceId: "opening-1",
    idempotencyKey: "stock-open-1",
    ...overrides
  });

  it("posts a movement once and returns the same result for an identical retry", () => {
    const database = setup();
    const first = postStockMovement(database, movement());
    const retry = postStockMovement(database, movement());
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(retry.movementId).toBe(first.movementId);
    expect(getStockBalance(database, "prod-1", "wh-1")).toBe(10);
    expect(database.prepare("SELECT COUNT(*) AS count FROM audit_events").get()).toEqual({ count: 1 });
  });

  it("rejects a reused idempotency key with a different payload", () => {
    const database = setup();
    postStockMovement(database, movement());
    expect(() => postStockMovement(database, movement({ quantityDelta: 9 })))
      .toThrow(IdempotencyConflictError);
  });

  it("prevents stock from going below zero", () => {
    const database = setup();
    expect(() => postStockMovement(database, movement({ quantityDelta: -1 })))
      .toThrow(InsufficientStockError);
    expect(getStockBalance(database, "prod-1", "wh-1")).toBe(0);
  });

  it("rejects zero or unsafe quantity values", () => {
    const database = setup();
    expect(() => postStockMovement(database, movement({ quantityDelta: 0 }))).toThrow(/non-zero/);
    expect(() => postStockMovement(database, movement({ quantityDelta: Number.MAX_SAFE_INTEGER + 1 })))
      .toThrow(/safe integer/);
  });
});
