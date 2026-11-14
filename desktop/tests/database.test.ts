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
    expect(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 2 });
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

  it("stores records and passes SQLite integrity_check", () => {
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

describe("AL-NASR owner authentication", () => {
  it("creates the first owner with a salted password hash and authenticates it", async () => {
    const { authenticate, createInitialOwner, isOwnerSetupRequired } = await import("../src/main/auth");
    db = new Database(":memory:");
    initializeDatabase(db);
    expect(isOwnerSetupRequired(db)).toBe(true);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    expect(owner.username).toBe("owner01");
    expect(isOwnerSetupRequired(db)).toBe(false);
    const stored = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(owner.id) as { password_hash: string };
    expect(stored.password_hash).toMatch(/^scrypt\\$/);
    expect(stored.password_hash).not.toContain("StrongPass-2026!");
    expect(authenticate(db, "OWNER01", "StrongPass-2026!")).toMatchObject({ id: owner.id, username: "owner01" });
    expect(authenticate(db, "owner01", "wrong-password")).toBeNull();
    expect(() => createInitialOwner(db!, { username: "owner02", displayName: "مالك آخر", password: "StrongPass-2026!" })).toThrow();
  });

  it("rejects weak initial owner passwords", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    db = new Database(":memory:");
    initializeDatabase(db);
    expect(() => createInitialOwner(db!, { username: "owner01", displayName: "مالك النظام", password: "weak" })).toThrow();
  });
});


describe("AL-NASR default catalog and products", () => {
  it("seeds the default piece unit and main warehouse idempotently", () => {
    db = new Database(":memory:");
    initializeDatabase(db);
    initializeDatabase(db);
    expect(db.prepare("SELECT code, name_ar FROM units WHERE code='PCS'").get()).toEqual({ code: "PCS", name_ar: "قطعة" });
    expect(db.prepare("SELECT code, name_ar FROM warehouses WHERE code='MAIN'").get()).toEqual({ code: "MAIN", name_ar: "المخزن الرئيسي" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM units WHERE code='PCS'").get()).toEqual({ count: 1 });
  });

  it("creates and lists a product with an optional unique barcode and audit event", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { createProduct, listProducts } = await import("../src/main/products");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    const created = createProduct(db, {
      sku: "P-001",
      nameAr: "حليب كامل الدسم",
      nameEn: "Whole Milk",
      barcode: "6281000000001",
      costMinor: 1200,
      priceMinor: 1500,
      openingQuantity: 18,
      actorUserId: owner.id
    });
    expect(created).toMatchObject({ sku: "P-001", nameAr: "حليب كامل الدسم", barcode: "6281000000001", costMinor: 1200, priceMinor: 1500, stockOnHand: 18 });
    expect(listProducts(db)).toHaveLength(1);
    expect(db.prepare("SELECT movement_type, quantity_delta, warehouse_id FROM stock_movements WHERE product_id=?").get(created.id)).toMatchObject({
      movement_type: "opening", quantity_delta: 18, warehouse_id: "warehouse-main"
    });
    expect(db.prepare("SELECT action, entity_type, entity_id FROM audit_events WHERE entity_id=?").get(created.id)).toMatchObject({
      action: "product.create", entity_type: "product", entity_id: created.id
    });
  });

  it("rejects duplicate product identifiers without leaving partial records", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { createProduct } = await import("../src/main/products");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    const input = { sku: "P-001", nameAr: "منتج اختبار", barcode: "6281000000001", costMinor: 100, priceMinor: 150, actorUserId: owner.id };
    createProduct(db, input);
    expect(() => createProduct(db!, input)).toThrow();
    expect(db.prepare("SELECT COUNT(*) AS count FROM products").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='product.create'").get()).toEqual({ count: 1 });
  });
});


describe("AL-NASR point of sale transactions", () => {
  it("posts a paid sale atomically, reduces stock and is idempotent", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { createProduct, listProducts } = await import("../src/main/products");
    const { createSale, openCashierShift, closeCashierShift } = await import("../src/main/sales");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    const product = createProduct(db, {
      sku: "POS-001", nameAr: "ماء شرب", costMinor: 500, priceMinor: 1500,
      openingQuantity: 5, actorUserId: owner.id
    });
    const shift = openCashierShift(db, { openingCashMinor: 10000, cashierUserId: owner.id });
    const input = {
      lines: [{ productId: product.id, quantity: 2 }],
      paymentMethod: "cash" as const,
      idempotencyKey: "pos-test-sale-0001",
      actorUserId: owner.id
    };
    const sale = createSale(db, input);
    expect(sale).toMatchObject({ totalMinor: 3000, status: "posted", lines: [{ quantity: 2, lineTotalMinor: 3000 }] });
    expect(listProducts(db)[0].stockOnHand).toBe(3);
    expect(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE sale_id=?").get(sale.id)).toEqual({ count: 1 });
    expect(db.prepare("SELECT amount_minor, method FROM payments WHERE sale_id=?").get(sale.id)).toEqual({ amount_minor: 3000, method: "cash" });
    const retry = createSale(db, input);
    expect(retry.id).toBe(sale.id);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 1 });
    expect(listProducts(db)[0].stockOnHand).toBe(3);
    expect(closeCashierShift(db, { shiftId: shift.id, closingCashMinor: 13000, actorUserId: owner.id })).toMatchObject({ status: "closed" });
  });

  it("rejects insufficient stock without writing a partial sale or payment", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { createProduct, listProducts } = await import("../src/main/products");
    const { createSale, openCashierShift } = await import("../src/main/sales");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    const product = createProduct(db, {
      sku: "POS-002", nameAr: "عصير", costMinor: 400, priceMinor: 900,
      openingQuantity: 1, actorUserId: owner.id
    });
    openCashierShift(db, { openingCashMinor: 0, cashierUserId: owner.id });
    expect(() => createSale(db!, {
      lines: [{ productId: product.id, quantity: 2 }],
      paymentMethod: "cash",
      idempotencyKey: "pos-test-insufficient-0001",
      actorUserId: owner.id
    })).toThrow("المخزون غير كافٍ");
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM payments").get()).toEqual({ count: 0 });
    expect(listProducts(db)[0].stockOnHand).toBe(1);
  });

  it("prevents opening a second cashier shift while the first is open", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { openCashierShift } = await import("../src/main/sales");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    openCashierShift(db, { openingCashMinor: 0, cashierUserId: owner.id });
    expect(() => openCashierShift(db!, { openingCashMinor: 0, cashierUserId: owner.id })).toThrow("يوجد وردية مفتوحة");
  });
});


describe("AL-NASR inventory receiving and stock counts", () => {
  it("receives stock and reconciles a physical count through immutable movements", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { createProduct, listProducts } = await import("../src/main/products");
    const { adjustStockCount, listStockMovements, receiveStock } = await import("../src/main/inventory");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    const product = createProduct(db, { sku: "INV-001", nameAr: "سكر", costMinor: 300, priceMinor: 500, openingQuantity: 5, actorUserId: owner.id });
    const received = receiveStock(db, { productId: product.id, quantity: 7, unitCostMinor: 320, actorUserId: owner.id });
    expect(received.quantityOnHand).toBe(12);
    expect(listProducts(db)[0].stockOnHand).toBe(12);
    expect(listProducts(db)[0].costMinor).toBe(312);
    const adjusted = adjustStockCount(db, { productId: product.id, countedQuantity: 9, actorUserId: owner.id });
    expect(adjusted).toMatchObject({ previousQuantity: 12, countedQuantity: 9, difference: -3 });
    expect(listProducts(db)[0].stockOnHand).toBe(9);
    const unchanged = adjustStockCount(db, { productId: product.id, countedQuantity: 9, actorUserId: owner.id });
    expect(unchanged).toMatchObject({ movementId: null, difference: 0 });
    expect(listStockMovements(db)).toHaveLength(3);
    expect(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action IN ('stock.receive','stock.adjust')").get()).toEqual({ count: 2 });
  });

  it("rejects invalid receipt and count quantities without changing stock", async () => {
    const { createInitialOwner } = await import("../src/main/auth");
    const { createProduct, listProducts } = await import("../src/main/products");
    const { adjustStockCount, receiveStock } = await import("../src/main/inventory");
    db = new Database(":memory:");
    initializeDatabase(db);
    const owner = createInitialOwner(db, { username: "owner01", displayName: "مالك النظام", password: "StrongPass-2026!" });
    const product = createProduct(db, { sku: "INV-002", nameAr: "أرز", costMinor: 400, priceMinor: 600, openingQuantity: 2, actorUserId: owner.id });
    expect(() => receiveStock(db!, { productId: product.id, quantity: 0, unitCostMinor: 400, actorUserId: owner.id })).toThrow();
    expect(() => adjustStockCount(db!, { productId: product.id, countedQuantity: -1, actorUserId: owner.id })).toThrow();
    expect(listProducts(db)[0].stockOnHand).toBe(2);
  });
});
