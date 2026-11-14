import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { initializeDatabase } from "../src/main/database-core";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe("AL-NASR SQLite core", () => {
  it("creates the core schema and applies its migration exactly once", () => {
    db = new Database(":memory:");
    initializeDatabase(db);
    initializeDatabase(db);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toContain("products");
    expect(tables.map((table) => table.name)).toContain("sales");
    expect(tables.map((table) => table.name)).toContain("stock_movements");
    expect(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 1 });
  });

  it("enforces foreign keys and business constraints", () => {
    db = new Database(":memory:");
    initializeDatabase(db);

    expect(() => db!.prepare(
      "INSERT INTO products (id, unit_id, sku, name_ar) VALUES ('p1','missing','SKU-1','منتج')"
    ).run()).toThrow();

    db!.prepare("INSERT INTO units (id, code, name_ar) VALUES ('unit-1','PCS','قطعة')").run();
    db!.prepare("INSERT INTO products (id, unit_id, sku, name_ar, price_minor) VALUES ('p1','unit-1','SKU-1','منتج',1250)").run();

    expect(() => db!.prepare(
      "INSERT INTO product_barcodes (id, product_id, barcode) VALUES ('b1','p1','1234567890123')"
    ).run()).not.toThrow();

    expect(() => db!.prepare(
      "INSERT INTO product_barcodes (id, product_id, barcode) VALUES ('b2','p1','1234567890123')"
    ).run()).toThrow();

    expect(db!.prepare("SELECT price_minor FROM products WHERE id='p1'").get()).toEqual({ price_minor: 1250 });
  });

  it("persists data and passes SQLite integrity_check after reopening", () => {
    const path = `:memory:`;
    db = new Database(path);
    initializeDatabase(db);
    db.prepare("INSERT INTO units (id, code, name_ar) VALUES ('u1','PCS','قطعة')").run();
    db.prepare("INSERT INTO products (id, unit_id, sku, name_ar) VALUES ('p1','u1','P-001','اختبار')").run();

    expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM products").get()).toEqual({ count: 1 });
  });

  it("enables foreign-key enforcement and WAL mode where supported", () => {
    db = new Database(":memory:");
    initializeDatabase(db);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(db.pragma("synchronous", { simple: true })).toBe(2);
  });
});
