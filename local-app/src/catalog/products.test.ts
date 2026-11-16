import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2, applySchemaV3 } from "../db/schema.js";
import { createProduct, deactivateProduct, listProducts } from "./products.js";

describe("product catalog", () => {
  let db: Database.Database | undefined;

  function setup(): Database.Database {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    applySchemaV2(db);
    applySchemaV3(db);
    return db;
  }

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("creates a product and its barcode atomically", () => {
    const database = setup();
    const product = createProduct(database, {
      sku: "SKU-100", nameAr: "قهوة", nameEn: "Coffee", baseUnit: "piece",
      salePriceMinor: 1500, costPriceMinor: 900, barcode: "628100000001"
    });
    expect(product.sku).toBe("SKU-100");
    expect(database.prepare("SELECT barcode FROM product_barcodes WHERE product_id = ?").get(product.id))
      .toEqual({ barcode: "628100000001" });
  });

  it("rejects invalid prices and duplicate barcode without partial product creation", () => {
    const database = setup();
    expect(() => createProduct(database, {
      sku: "SKU-101", nameAr: "منتج", baseUnit: "piece",
      salePriceMinor: -1, costPriceMinor: 0
    })).toThrow(/salePriceMinor/);
    createProduct(database, {
      sku: "SKU-102", nameAr: "منتج أول", baseUnit: "piece",
      salePriceMinor: 100, costPriceMinor: 50, barcode: "628100000002"
    });
    expect(() => createProduct(database, {
      sku: "SKU-103", nameAr: "منتج ثان", baseUnit: "piece",
      salePriceMinor: 100, costPriceMinor: 50, barcode: "628100000002"
    })).toThrow();
    expect(database.prepare("SELECT COUNT(*) AS count FROM products").get()).toEqual({ count: 1 });
  });

  it("searches active products and deactivates without deleting history", () => {
    const database = setup();
    const product = createProduct(database, {
      sku: "SKU-200", nameAr: "أرز بسمتي", baseUnit: "kg",
      salePriceMinor: 2500, costPriceMinor: 1800
    });
    expect(listProducts(database, "بسمتي")).toHaveLength(1);
    database.prepare("INSERT INTO users(id, username, password_hash, display_name) VALUES (?, ?, ?, ?)")
      .run("test-actor", "testactor", "test-hash", "Test Actor");
    deactivateProduct(database, product.id, "test-actor");
    expect(listProducts(database, "بسمتي")).toHaveLength(0);
    expect(database.prepare("SELECT is_active FROM products WHERE id = ?").get(product.id)).toEqual({ is_active: 0 });
  });
});
