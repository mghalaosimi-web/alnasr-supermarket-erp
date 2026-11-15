import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDatabase, openDatabase } from "./database.js";
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


  it("reopens the same on-disk database and preserves committed data", () => {
    const directory = mkdtempSync(join(tmpdir(), "alnasr-persistence-"));
    const file = join(directory, "store.sqlite");
    try {
      const first = openDatabase(file);
      first.prepare("INSERT INTO stores(id, name) VALUES (?, ?)").run("store-persist", "Persistent Store");
      closeDatabase(first);

      const second = openDatabase(file);
      const row = second.prepare("SELECT name FROM stores WHERE id = ?").get("store-persist");
      expect(row).toEqual({ name: "Persistent Store" });
      expect(second.pragma("user_version", { simple: true })).toBe(SCHEMA_VERSION);
      closeDatabase(second);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses a database created by a newer application version", () => {
    const directory = mkdtempSync(join(tmpdir(), "alnasr-forward-schema-"));
    const file = join(directory, "newer.sqlite");
    try {
      const newer = new Database(file);
      newer.pragma("user_version = 999");
      newer.close();
      expect(() => openDatabase(file)).toThrow(/newer than this application supports/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("declares the current schema version", () => {
    expect(SCHEMA_VERSION).toBe(4);
  });
});
