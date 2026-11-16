import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2, applySchemaV3, applySchemaV4, applySchemaV5, applySchemaV6, applySchemaV7, applySchemaV8, applySchemaV9 } from "../db/schema.js";
import { getStockBalance, postStockMovement } from "../inventory/stock-ledger.js";
import { createPurchase, listPurchases, postPurchase } from "./purchases.js";
import { createPurchaseReturn, listPurchaseReturnableLines, postPurchaseReturn } from "./purchase-returns.js";

describe("purchase receiving lifecycle", () => {
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
    applySchemaV7(db);
    applySchemaV8(db);
    applySchemaV9(db);
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

  it("lists purchases with supplier and warehouse context and supports search", () => {
    const database = setup();
    const purchase = createPurchase(database, purchaseInput());
    const all = listPurchases(database);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id: purchase.purchaseId,
      document_no: "PO-0001",
      status: "draft",
      supplier_name: "Supplier",
      store_name: "Store",
      warehouse_name: "Main",
      subtotal_minor: 2000,
      total_minor: 1950,
      line_count: 1,
      unit_count: 20
    });
    expect(listPurchases(database, "Supplier")).toHaveLength(1);
    expect(listPurchases(database, "missing")).toHaveLength(0);
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
    const journal = database.prepare("SELECT COUNT(*) AS count FROM journal_entries WHERE source_type = 'purchase' AND source_id = ?").get(purchase.purchaseId);
    expect(journal).toEqual({ count: 1 });
    const trial = database.prepare("SELECT SUM(jl.debit_minor) AS debit, SUM(jl.credit_minor) AS credit FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE je.source_type = 'purchase' AND je.source_id = ?").get(purchase.purchaseId);
    expect(trial).toEqual({ debit: 1950, credit: 1950 });
  });

  it("posts supplier purchase returns once and restores payable balance", () => {
    const database = setup();
    const purchase = createPurchase(database, purchaseInput());
    postPurchase(database, purchase.purchaseId);
    const line = database.prepare("SELECT id FROM purchase_lines WHERE purchase_id = ?").get(purchase.purchaseId) as { id: string };
    const draft = createPurchaseReturn(database, {
      purchaseId: purchase.purchaseId, documentNo: "PR-0001", reason: "Damaged units",
      lines: [{ purchaseLineId: line.id, quantity: 3 }], idempotencyKey: "purchase-return-0001"
    });
    expect(draft.totalMinor).toBe(300);
    expect(listPurchaseReturnableLines(database, purchase.purchaseId)[0]).toMatchObject({ received_quantity: 20, returned_quantity: 3, remaining_quantity: 17 });
    const posted = postPurchaseReturn(database, draft.returnId);
    const retry = postPurchaseReturn(database, draft.returnId);
    expect(posted.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(getStockBalance(database, "prod-1", "wh-1")).toBe(17);
    expect(database.prepare("SELECT COUNT(*) AS count FROM journal_entries WHERE source_type = 'purchase_return' AND source_id = ?").get(draft.returnId)).toEqual({ count: 1 });
    expect(database.prepare("SELECT SUM(debit_minor) AS debit, SUM(credit_minor) AS credit FROM journal_lines WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE source_type = 'purchase_return' AND source_id = ?)").get(draft.returnId)).toEqual({ debit: 300, credit: 300 });
  });

  it("prevents purchase returns exceeding received or available stock", () => {
    const database = setup();
    const purchase = createPurchase(database, purchaseInput());
    postPurchase(database, purchase.purchaseId);
    const line = database.prepare("SELECT id FROM purchase_lines WHERE purchase_id = ?").get(purchase.purchaseId) as { id: string };
    expect(() => createPurchaseReturn(database, {
      purchaseId: purchase.purchaseId, documentNo: "PR-OVER", reason: "Too many",
      lines: [{ purchaseLineId: line.id, quantity: 21 }], idempotencyKey: "purchase-return-over-001"
    })).toThrow(/unreturned received quantity/);
    const draft = createPurchaseReturn(database, {
      purchaseId: purchase.purchaseId, documentNo: "PR-STOCK", reason: "Not enough stock",
      lines: [{ purchaseLineId: line.id, quantity: 2 }], idempotencyKey: "purchase-return-stock-001"
    });
    database.prepare("UPDATE stock_ledger SET quantity_delta = 0 WHERE source_type = 'purchase'").run();
    expect(() => postPurchaseReturn(database, draft.returnId)).toThrow(/Insufficient stock/);
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
