import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, SCHEMA_VERSION } from "./schema.js";

describe("AL-NASR SQLite schema v1", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("creates core tables and seeds built-in roles", () => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all().map((row) => (row as { name: string }).name);

    expect(tables).toContain("users");
    expect(tables).toContain("products");
    expect(tables).toContain("stock_ledger");
    expect(tables).toContain("sales");
    expect(tables).toContain("payments");

    const roles = db.prepare("SELECT code FROM roles ORDER BY code").all()
      .map((row) => (row as { code: string }).code);
    expect(roles).toEqual(["accountant", "admin", "cashier", "inventory", "owner"]);
  });

  it("enforces unique sale idempotency keys", () => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    db.prepare("INSERT INTO stores(id, name) VALUES ('s1', 'متجر الاختبار')").run();

    const insert = db.prepare(`
      INSERT INTO sales(id, document_no, store_id, status, subtotal_minor, total_minor, idempotency_key)
      VALUES (?, ?, 's1', 'draft', 1000, 1000, ?)
    `);
    insert.run("sale1", "INV-1", "idem-1");
    expect(() => insert.run("sale2", "INV-2", "idem-1")).toThrow();
  });

  it("declares the first schema version", () => {
    expect(SCHEMA_VERSION).toBe(2);
  });
});
