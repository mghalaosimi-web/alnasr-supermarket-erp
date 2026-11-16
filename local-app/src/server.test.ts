import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "./server.js";
import { closeDatabase, openDatabase } from "./db/database.js";

describe("local API integration", () => {
  const originalPath = process.env.AL_NASR_DATABASE_PATH;
  let directory: string | undefined;
  let app: ReturnType<typeof buildServer> | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
    if (originalPath === undefined) delete process.env.AL_NASR_DATABASE_PATH;
    else process.env.AL_NASR_DATABASE_PATH = originalPath;
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  it("sets up the store, authenticates, creates a product and posts a sale with stock control", async () => {
    directory = mkdtempSync(join(tmpdir(), "alnasr-api-"));
    const databasePath = join(directory, "api.sqlite");
    process.env.AL_NASR_DATABASE_PATH = databasePath;
    app = buildServer();

    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/setup/owner",
      payload: {
        username: "ownerapi",
        displayName: "API Owner",
        password: "A-Strong-Password-2026"
      }
    });
    expect(setup.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "ownerapi", password: "A-Strong-Password-2026" }
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().token as string;
    const authorization = { authorization: `Bearer ${token}` };

    const db = openDatabase(databasePath);
    const store = db.prepare("SELECT id FROM stores LIMIT 1").get() as { id: string };
    const warehouse = db.prepare("SELECT id FROM warehouses LIMIT 1").get() as { id: string };
    closeDatabase(db);

    const productResponse = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization,
      payload: {
        sku: "API-001", nameAr: "ماء", nameEn: "Water", baseUnit: "piece",
        salePriceMinor: 100, costPriceMinor: 50, barcode: "628100009999"
      }
    });
    expect(productResponse.statusCode).toBe(201);
    const productId = productResponse.json().product.id as string;

    const adjustment = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/adjustments",
      headers: authorization,
      payload: {
        productId, warehouseId: warehouse.id, quantityDelta: 5, unitCostMinor: 50,
        reason: "رصيد افتتاحي", idempotencyKey: "api-opening-stock-001"
      }
    });
    expect(adjustment.statusCode).toBe(201);
    expect(adjustment.json().balance).toBe(5);

    const customerResponse = await app.inject({
      method: "POST", url: "/api/v1/customers", headers: authorization,
      payload: { code: "CUST-API-001", name: "عميل اختبار", phone: null, creditLimitMinor: 5000 }
    });
    expect(customerResponse.statusCode).toBe(201);
    const customerId = customerResponse.json().customer.id as string;

    const sale = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: authorization,
      payload: {
        documentNo: "API-INV-001", storeId: store.id, warehouseId: warehouse.id, customerId,
        lines: [{ productId, quantity: 2, unitPriceMinor: 100 }],
        idempotencyKey: "api-sale-create-001"
      }
    });
    expect(sale.statusCode).toBe(201);

    const posting = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${sale.json().saleId}/post`,
      headers: authorization
    });
    expect(posting.statusCode).toBe(200);
    expect(posting.json().status).toBe("posted");

    const saleId = sale.json().saleId as string;
    const cashWithoutShift = await app.inject({
      method: "POST", url: `/api/v1/sales/${saleId}/payments`, headers: authorization,
      payload: { method: "cash", amountMinor: 100, idempotencyKey: "cash-without-shift-001" }
    });
    expect(cashWithoutShift.statusCode).toBe(409);
    const openedShift = await app.inject({
      method: "POST", url: "/api/v1/cash/register/open", headers: authorization,
      payload: { storeId: store.id, openingFloatMinor: 0, note: "وردية اختبار" }
    });
    expect(openedShift.statusCode).toBe(201);
    const duplicateOpenShift = await app.inject({
      method: "POST", url: "/api/v1/cash/register/open", headers: authorization,
      payload: { storeId: store.id, openingFloatMinor: 0 }
    });
    expect(duplicateOpenShift.statusCode).toBe(409);
    const firstPayment = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${saleId}/payments`,
      headers: authorization,
      payload: {
        method: "cash", amountMinor: 100, reference: null,
        idempotencyKey: "api-sale-payment-001"
      }
    });
    expect(firstPayment.statusCode).toBe(201);
    expect(firstPayment.json().payment.outstandingMinor).toBe(100);

    const duplicatePayment = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${saleId}/payments`,
      headers: authorization,
      payload: {
        method: "cash", amountMinor: 100, reference: null,
        idempotencyKey: "api-sale-payment-001"
      }
    });
    expect(duplicatePayment.statusCode).toBe(200);
    expect(duplicatePayment.json().payment.duplicate).toBe(true);

    const conflictingPayment = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${saleId}/payments`,
      headers: authorization,
      payload: {
        method: "cash", amountMinor: 99, reference: null,
        idempotencyKey: "api-sale-payment-001"
      }
    });
    expect(conflictingPayment.statusCode).toBe(409);

    const secondPayment = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${saleId}/payments`,
      headers: authorization,
      payload: {
        method: "mobile_wallet", amountMinor: 100, reference: "wallet-ref-001",
        idempotencyKey: "api-sale-payment-002"
      }
    });
    expect(secondPayment.statusCode).toBe(201);
    expect(secondPayment.json().payment.outstandingMinor).toBe(0);

    const overpayment = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${saleId}/payments`,
      headers: authorization,
      payload: {
        method: "cash", amountMinor: 1, idempotencyKey: "api-sale-payment-003"
      }
    });
    expect(overpayment.statusCode).toBe(409);

    const cashIn = await app.inject({
      method: "POST", url: "/api/v1/cash/register/movements", headers: authorization,
      payload: { storeId: store.id, direction: "in", amountMinor: 50, description: "إيداع نقدي إضافي", idempotencyKey: "cash-manual-in-001" }
    });
    expect(cashIn.statusCode).toBe(201);
    const cashOut = await app.inject({
      method: "POST", url: "/api/v1/cash/register/movements", headers: authorization,
      payload: { storeId: store.id, direction: "out", amountMinor: 25, description: "مصروف تشغيلي", idempotencyKey: "cash-manual-out-001" }
    });
    expect(cashOut.statusCode).toBe(201);
    const overdraw = await app.inject({
      method: "POST", url: "/api/v1/cash/register/movements", headers: authorization,
      payload: { storeId: store.id, direction: "out", amountMinor: 126, description: "سحب يتجاوز الرصيد", idempotencyKey: "cash-overdraw-001" }
    });
    expect(overdraw.statusCode).toBe(409);
    const cashStatus = await app.inject({
      method: "GET", url: `/api/v1/cash/register?storeId=${store.id}`, headers: authorization
    });
    expect(cashStatus.statusCode).toBe(200);
    expect(cashStatus.json().totals).toMatchObject({ openingFloatMinor: 0, inflowMinor: 150, outflowMinor: 25, expectedCashMinor: 125, movementCount: 3 });
    const closedShift = await app.inject({
      method: "POST", url: "/api/v1/cash/register/close", headers: authorization,
      payload: { storeId: store.id, countedCashMinor: 120, note: "فرق خمسة" }
    });
    expect(closedShift.statusCode).toBe(200);
    expect(closedShift.json()).toMatchObject({ expectedCashMinor: 125, countedCashMinor: 120, varianceMinor: -5 });
    const closedStatus = await app.inject({
      method: "GET", url: `/api/v1/cash/register?storeId=${store.id}`, headers: authorization
    });
    expect(closedStatus.statusCode).toBe(200);
    expect(closedStatus.json().session).toBeNull();

    const paymentSummary = await app.inject({
      method: "GET",
      url: `/api/v1/sales/${saleId}/payments`,
      headers: authorization
    });
    expect(paymentSummary.statusCode).toBe(200);
    expect(paymentSummary.json().paidMinor).toBe(200);
    expect(paymentSummary.json().outstandingMinor).toBe(0);
    expect(paymentSummary.json().items).toHaveLength(2);

    const balance = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/balance?productId=${productId}&warehouseId=${warehouse.id}`,
      headers: authorization
    });
    expect(balance.statusCode).toBe(200);
    expect(balance.json().quantity).toBe(3);

    const locations = await app.inject({
      method: "GET",
      url: "/api/v1/locations",
      headers: authorization
    });
    expect(locations.statusCode).toBe(200);
    expect(locations.json().warehouses).toHaveLength(1);
    expect(locations.json().warehouses[0].id).toBe(warehouse.id);

    const stockBalances = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/balances?warehouseId=" + warehouse.id,
      headers: authorization
    });
    expect(stockBalances.statusCode).toBe(200);
    expect(stockBalances.json().items).toHaveLength(1);
    expect(stockBalances.json().items[0].quantity).toBe(3);

    const dbForReturn = openDatabase(databasePath);
    const saleLine = dbForReturn.prepare("SELECT id FROM sale_lines WHERE sale_id = ?").get(saleId) as { id: string };
    closeDatabase(dbForReturn);
    const returnDraft = await app.inject({
      method: "POST", url: `/api/v1/sales/${saleId}/returns`, headers: authorization,
      payload: {
        documentNo: "API-RET-001", reason: "Damaged product",
        lines: [{ saleLineId: saleLine.id, quantity: 1 }],
        idempotencyKey: "api-sale-return-001"
      }
    });
    expect(returnDraft.statusCode).toBe(201);
    expect(returnDraft.json().totalMinor).toBe(100);
    const returnPost = await app.inject({
      method: "POST", url: `/api/v1/sale-returns/${returnDraft.json().returnId}/post`, headers: authorization
    });
    expect(returnPost.statusCode).toBe(200);
    expect(returnPost.json().status).toBe("posted");
    const returnedBalance = await app.inject({
      method: "GET", url: `/api/v1/inventory/balance?productId=${productId}&warehouseId=${warehouse.id}`,
      headers: authorization
    });
    expect(returnedBalance.statusCode).toBe(200);
    expect(returnedBalance.json().quantity).toBe(4);
    const duplicateReturnPost = await app.inject({
      method: "POST", url: `/api/v1/sale-returns/${returnDraft.json().returnId}/post`, headers: authorization
    });
    expect(duplicateReturnPost.statusCode).toBe(200);
    expect(duplicateReturnPost.json().duplicate).toBe(true);

    const returnableSales = await app.inject({
      method: "GET", url: "/api/v1/sales/returnable", headers: authorization
    });
    expect(returnableSales.statusCode).toBe(200);
    expect(returnableSales.json().items).toHaveLength(1);
    expect(returnableSales.json().items[0].id).toBe(saleId);
    const returnableLines = await app.inject({
      method: "GET", url: `/api/v1/sales/${saleId}/returnable-lines`, headers: authorization
    });
    expect(returnableLines.statusCode).toBe(200);
    expect(returnableLines.json().items[0].remaining_quantity).toBe(1);
    const returnHistory = await app.inject({
      method: "GET", url: `/api/v1/sales/${saleId}/returns`, headers: authorization
    });
    expect(returnHistory.statusCode).toBe(200);
    expect(returnHistory.json().items).toHaveLength(1);
    expect(returnHistory.json().items[0].status).toBe("posted");

    const accountList = await app.inject({ method: "GET", url: "/api/v1/accounting/accounts", headers: authorization });
    expect(accountList.statusCode).toBe(200);
    expect(accountList.json().items).toHaveLength(11);
    const journals = await app.inject({ method: "GET", url: "/api/v1/accounting/journals?limit=50", headers: authorization });
    expect(journals.statusCode).toBe(200);
    expect(journals.json().items).toHaveLength(4);
    const trialBalance = await app.inject({ method: "GET", url: "/api/v1/accounting/trial-balance", headers: authorization });
    expect(trialBalance.statusCode).toBe(200);
    expect(trialBalance.json().totals).toMatchObject({ debitMovementsMinor: 650, creditMovementsMinor: 650 });
    const invalidTrialBalance = await app.inject({
      method: "GET", url: "/api/v1/accounting/trial-balance?asOf=2026-02-30", headers: authorization
    });
    expect(invalidTrialBalance.statusCode).toBe(400);

    const statements = await app.inject({
      method: "GET", url: "/api/v1/accounting/financial-statements?from=2026-01-01&to=2026-12-31", headers: authorization
    });
    expect(statements.statusCode).toBe(200);
    expect(statements.json().profitAndLoss).toMatchObject({ revenueMinor: 200, expensesMinor: 50, netIncomeMinor: 150 });
    expect(statements.json().balanceSheet.balanced).toBe(true);
    const invalidStatements = await app.inject({
      method: "GET", url: "/api/v1/accounting/financial-statements?from=2026-12-31&to=2026-01-01", headers: authorization
    });
    expect(invalidStatements.statusCode).toBe(400);

    const customerStatement = await app.inject({
      method: "GET", url: `/api/v1/customers/${customerId}/statement?limit=50&offset=0`, headers: authorization
    });
    expect(customerStatement.statusCode).toBe(200);
    expect(customerStatement.json().summary).toMatchObject({
      salesMinor: 200, paymentsMinor: 200, returnsMinor: 100, outstandingMinor: -100
    });
    expect(customerStatement.json().items).toHaveLength(4);
    expect(customerStatement.json().items.map((item: { entryType: string }) => item.entryType).sort())
      .toEqual(["payment", "payment", "return", "sale"]);

    const unauthenticatedBalances = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/balances?warehouseId=" + warehouse.id
    });
    expect(unauthenticatedBalances.statusCode).toBe(401);

    const backup = await app.inject({
      method: "POST",
      url: "/api/v1/backups",
      headers: authorization
    });
    expect(backup.statusCode).toBe(201);
    expect(backup.json().backup.integrity).toBe("ok");
    expect(existsSync(backup.json().backup.path)).toBe(true);
  });

  it("updates and deactivates products through the authorized API", async () => {
    directory = mkdtempSync(join(tmpdir(), "alnasr-products-"));
    process.env.AL_NASR_DATABASE_PATH = join(directory, "products.sqlite");
    app = buildServer();

    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/setup/owner",
      payload: { username: "productowner", displayName: "Product Owner", password: "A-Strong-Password-2026" }
    });
    expect(setup.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "productowner", password: "A-Strong-Password-2026" }
    });
    expect(login.statusCode).toBe(200);
    const authorization = { authorization: `Bearer ${login.json().token as string}` };

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization,
      payload: { sku: "EDIT-001", nameAr: "صنف قبل التعديل", nameEn: "Before", baseUnit: "piece",
        salePriceMinor: 100, costPriceMinor: 50, barcode: "628100001111" }
    });
    expect(created.statusCode).toBe(201);
    const productId = created.json().product.id as string;

    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/products/${productId}`,
      headers: authorization,
      payload: { sku: "EDIT-001", nameAr: "صنف بعد التعديل", nameEn: "After", baseUnit: "piece",
        salePriceMinor: 125, costPriceMinor: 60, barcode: "628100001112" }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().product.name_ar).toBe("صنف بعد التعديل");
    expect(updated.json().product.sale_price_minor).toBe(125);

    const unauthenticatedUpdate = await app.inject({
      method: "PUT",
      url: `/api/v1/products/${productId}`,
      payload: { sku: "EDIT-001", nameAr: "اختراق", baseUnit: "piece", salePriceMinor: 1, costPriceMinor: 1 }
    });
    expect(unauthenticatedUpdate.statusCode).toBe(401);

    const deactivated = await app.inject({
      method: "POST",
      url: `/api/v1/products/${productId}/deactivate`,
      headers: authorization
    });
    expect(deactivated.statusCode).toBe(204);
    const listed = await app.inject({ method: "GET", url: "/api/v1/products", headers: authorization });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(0);

    const inactiveEdit = await app.inject({
      method: "PUT",
      url: `/api/v1/products/${productId}`,
      headers: authorization,
      payload: { sku: "EDIT-001", nameAr: "تعديل غير مسموح", baseUnit: "piece",
        salePriceMinor: 125, costPriceMinor: 60 }
    });
    expect(inactiveEdit.statusCode).toBe(409);
  });

  it("enforces authenticated customer and supplier API workflows", async () => {
    directory = mkdtempSync(join(tmpdir(), "alnasr-partners-"));
    process.env.AL_NASR_DATABASE_PATH = join(directory, "partners.sqlite");
    app = buildServer();

    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/setup/owner",
      payload: {
        username: "partnerowner",
        displayName: "Partner Owner",
        password: "A-Strong-Password-2026"
      }
    });
    expect(setup.statusCode).toBe(201);

    const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/customers" });
    expect(unauthenticated.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "partnerowner", password: "A-Strong-Password-2026" }
    });
    expect(login.statusCode).toBe(200);
    const authorization = { authorization: `Bearer ${login.json().token as string}` };

    const createdCustomer = await app.inject({
      method: "POST",
      url: "/api/v1/customers",
      headers: authorization,
      payload: { code: "C-API-001", name: "عميل API", phone: "777000001", creditLimitMinor: 5000 }
    });
    expect(createdCustomer.statusCode).toBe(201);
    const customerId = createdCustomer.json().customer.id as string;

    const listedCustomers = await app.inject({
      method: "GET",
      url: "/api/v1/customers?search=C-API-001",
      headers: authorization
    });
    expect(listedCustomers.statusCode).toBe(200);
    expect(listedCustomers.json().items).toHaveLength(1);

    const updatedCustomer = await app.inject({
      method: "PUT",
      url: `/api/v1/customers/${customerId}`,
      headers: authorization,
      payload: { code: "C-API-001", name: "عميل API محدث", creditLimitMinor: 7500 }
    });
    expect(updatedCustomer.statusCode).toBe(200);
    expect(updatedCustomer.json().customer.credit_limit_minor).toBe(7500);

    const duplicateCustomer = await app.inject({
      method: "POST",
      url: "/api/v1/customers",
      headers: authorization,
      payload: { code: "C-API-001", name: "عميل مكرر" }
    });
    expect(duplicateCustomer.statusCode).toBe(409);

    const deactivatedCustomer = await app.inject({
      method: "POST",
      url: `/api/v1/customers/${customerId}/deactivate`,
      headers: authorization
    });
    expect(deactivatedCustomer.statusCode).toBe(204);

    const createdSupplier = await app.inject({
      method: "POST",
      url: "/api/v1/suppliers",
      headers: authorization,
      payload: { code: "S-API-001", name: "مورد API", phone: "777000002" }
    });
    expect(createdSupplier.statusCode).toBe(201);
    const supplierId = createdSupplier.json().supplier.id as string;

    const updatedSupplier = await app.inject({
      method: "PUT",
      url: `/api/v1/suppliers/${supplierId}`,
      headers: authorization,
      payload: { code: "S-API-002", name: "مورد API محدث" }
    });
    expect(updatedSupplier.statusCode).toBe(200);
    expect(updatedSupplier.json().supplier.code).toBe("S-API-002");

    const deactivatedSupplier = await app.inject({
      method: "POST",
      url: `/api/v1/suppliers/${supplierId}/deactivate`,
      headers: authorization
    });
    expect(deactivatedSupplier.statusCode).toBe(204);

    const remainingSuppliers = await app.inject({
      method: "GET",
      url: "/api/v1/suppliers",
      headers: authorization
    });
    expect(remainingSuppliers.statusCode).toBe(200);
    expect(remainingSuppliers.json().items).toHaveLength(0);
  });
  it("creates, posts, searches, and protects purchase history through the API", async () => {
    directory = mkdtempSync(join(tmpdir(), "alnasr-purchases-"));
    const databasePath = join(directory, "purchases.sqlite");
    process.env.AL_NASR_DATABASE_PATH = databasePath;
    app = buildServer();

    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/setup/owner",
      payload: {
        username: "purchaseowner",
        displayName: "Purchase Owner",
        password: "A-Strong-Password-2026"
      }
    });
    expect(setup.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "purchaseowner", password: "A-Strong-Password-2026" }
    });
    expect(login.statusCode).toBe(200);
    const authorization = { authorization: `Bearer ${login.json().token as string}` };

    const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/purchases" });
    expect(unauthenticated.statusCode).toBe(401);

    const db = openDatabase(databasePath);
    const store = db.prepare("SELECT id FROM stores LIMIT 1").get() as { id: string };
    const warehouse = db.prepare("SELECT id FROM warehouses LIMIT 1").get() as { id: string };
    closeDatabase(db);

    const supplierResponse = await app.inject({
      method: "POST",
      url: "/api/v1/suppliers",
      headers: authorization,
      payload: { code: "PUR-SUP-001", name: "مورد الاختبار", phone: "777123456" }
    });
    expect(supplierResponse.statusCode).toBe(201);
    const supplierId = supplierResponse.json().supplier.id as string;

    const productResponse = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization,
      payload: {
        sku: "PUR-API-001", nameAr: "صنف مشتريات", nameEn: "Purchase Item",
        baseUnit: "piece", salePriceMinor: 150, costPriceMinor: 80,
        barcode: "628100008888"
      }
    });
    expect(productResponse.statusCode).toBe(201);
    const productId = productResponse.json().product.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/purchases",
      headers: authorization,
      payload: {
        documentNo: "PUR-API-INV-001",
        storeId: store.id,
        warehouseId: warehouse.id,
        supplierId,
        lines: [{ productId, quantity: 12, unitCostMinor: 80 }],
        discountMinor: 100,
        taxMinor: 50,
        idempotencyKey: "purchase-api-create-001"
      }
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().subtotalMinor).toBe(960);
    expect(created.json().totalMinor).toBe(910);

    const draftHistory = await app.inject({
      method: "GET",
      url: "/api/v1/purchases?search=PUR-API-INV-001&limit=10&offset=0",
      headers: authorization
    });
    expect(draftHistory.statusCode).toBe(200);
    expect(draftHistory.json().items).toHaveLength(1);
    expect(draftHistory.json().items[0]).toMatchObject({
      document_no: "PUR-API-INV-001",
      supplier_name: "مورد الاختبار",
      warehouse_name: "المستودع الرئيسي",
      status: "draft",
      subtotal_minor: 960,
      total_minor: 910,
      line_count: 1,
      unit_count: 12
    });

    const post = await app.inject({
      method: "POST",
      url: `/api/v1/purchases/${created.json().purchaseId as string}/post`,
      headers: authorization
    });
    expect(post.statusCode).toBe(200);
    expect(post.json().status).toBe("posted");

    const postedHistory = await app.inject({
      method: "GET",
      url: "/api/v1/purchases?search=مورد الاختبار",
      headers: authorization
    });
    expect(postedHistory.statusCode).toBe(200);
    expect(postedHistory.json().items[0].status).toBe("posted");

    const inventory = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/balance?productId=${productId}&warehouseId=${warehouse.id}`,
      headers: authorization
    });
    expect(inventory.statusCode).toBe(200);
    expect(inventory.json().quantity).toBe(12);

    const purchaseId = created.json().purchaseId as string;
    const returnablePurchases = await app.inject({ method: "GET", url: "/api/v1/purchases/returnable", headers: authorization });
    expect(returnablePurchases.statusCode).toBe(200);
    expect(returnablePurchases.json().items).toHaveLength(1);
    const purchaseLineDb = openDatabase(databasePath);
    const purchaseLine = purchaseLineDb.prepare("SELECT id FROM purchase_lines WHERE purchase_id = ?").get(purchaseId) as { id: string };
    closeDatabase(purchaseLineDb);

    const openCash = await app.inject({
      method: "POST", url: "/api/v1/cash/register/open", headers: authorization,
      payload: { storeId: store.id, openingFloatMinor: 1000, note: "وردية مشتريات" }
    });
    expect(openCash.statusCode).toBe(201);

    const payment = await app.inject({
      method: "POST",
      url: `/api/v1/purchases/${purchaseId}/payments`,
      headers: authorization,
      payload: { method: "cash", amountMinor: 400, reference: "CASH-001", idempotencyKey: "purchase-pay-001" }
    });
    expect(payment.statusCode).toBe(201);
    expect(payment.json().payment).toMatchObject({ amountMinor: 400, paidMinor: 400, outstandingMinor: 510, duplicate: false });

    const duplicatePayment = await app.inject({
      method: "POST",
      url: `/api/v1/purchases/${purchaseId}/payments`,
      headers: authorization,
      payload: { method: "cash", amountMinor: 400, reference: "CASH-001", idempotencyKey: "purchase-pay-001" }
    });
    expect(duplicatePayment.statusCode).toBe(200);
    expect(duplicatePayment.json().payment.paidMinor).toBe(400);

    const overpayment = await app.inject({
      method: "POST",
      url: `/api/v1/purchases/${purchaseId}/payments`,
      headers: authorization,
      payload: { method: "bank_transfer", amountMinor: 511, idempotencyKey: "purchase-pay-002" }
    });
    expect(overpayment.statusCode).toBe(409);

    const paymentHistory = await app.inject({
      method: "GET",
      url: `/api/v1/purchases/${purchaseId}/payments`,
      headers: authorization
    });
    expect(paymentHistory.statusCode).toBe(200);
    expect(paymentHistory.json()).toMatchObject({ totalMinor: 910, paidMinor: 400, outstandingMinor: 510 });
    expect(paymentHistory.json().items).toHaveLength(1);

    const purchaseHistoryWithBalance = await app.inject({
      method: "GET",
      url: "/api/v1/purchases?search=PUR-API-INV-001",
      headers: authorization
    });
    expect(purchaseHistoryWithBalance.json().items[0]).toMatchObject({
      paid_minor: 400, outstanding_minor: 510
    });

    const invalidQuery = await app.inject({
      method: "GET",
      url: "/api/v1/purchases?limit=0",
      headers: authorization
    });
    expect(invalidQuery.statusCode).toBe(400);

    const createdReturn = await app.inject({
      method: "POST", url: `/api/v1/purchases/${purchaseId}/returns`, headers: authorization,
      payload: {
        documentNo: "PUR-RET-001", reason: "وحدات تالفة",
        lines: [{ purchaseLineId: purchaseLine.id, quantity: 2 }],
        idempotencyKey: "purchase-return-api-001"
      }
    });
    expect(createdReturn.statusCode).toBe(201);
    expect(createdReturn.json().totalMinor).toBe(160);
    const postedReturn = await app.inject({
      method: "POST", url: `/api/v1/purchase-returns/${createdReturn.json().returnId}/post`, headers: authorization
    });
    expect(postedReturn.statusCode).toBe(200);
    expect(postedReturn.json().duplicate).toBe(false);
    const returnedInventory = await app.inject({
      method: "GET", url: `/api/v1/inventory/balance?productId=${productId}&warehouseId=${warehouse.id}`, headers: authorization
    });
    expect(returnedInventory.json().quantity).toBe(10);
    const afterReturnPayments = await app.inject({
      method: "GET", url: `/api/v1/purchases/${purchaseId}/payments`, headers: authorization
    });
    expect(afterReturnPayments.json()).toMatchObject({ totalMinor: 910, paidMinor: 400, outstandingMinor: 350 });
    const afterReturnHistory = await app.inject({
      method: "GET", url: "/api/v1/purchases?search=PUR-API-INV-001", headers: authorization
    });
    expect(afterReturnHistory.json().items[0]).toMatchObject({ paid_minor: 400, returned_minor: 160, outstanding_minor: 350 });

    const supplierStatement = await app.inject({
      method: "GET",
      url: `/api/v1/suppliers/${supplierId}/statement`,
      headers: authorization
    });
    expect(supplierStatement.statusCode).toBe(200);
    expect(supplierStatement.json()).toMatchObject({
      supplier: { id: supplierId, code: "PUR-SUP-001", name: "مورد الاختبار" },
      summary: { purchasesMinor: 910, paymentsMinor: 400, returnsMinor: 160, outstandingMinor: 350 },
      items: [
        { entryType: "purchase", debitMinor: 910, creditMinor: 0, balanceMinor: 910 },
        { entryType: "payment", debitMinor: 0, creditMinor: 400, balanceMinor: 510 },
        { entryType: "return", debitMinor: 0, creditMinor: 160, balanceMinor: 350 }
      ]
    });

    const unauthenticatedStatement = await app.inject({
      method: "GET", url: `/api/v1/suppliers/${supplierId}/statement`
    });
    expect(unauthenticatedStatement.statusCode).toBe(401);

    const invalidStatementQuery = await app.inject({
      method: "GET", url: `/api/v1/suppliers/${supplierId}/statement?limit=0`, headers: authorization
    });
    expect(invalidStatementQuery.statusCode).toBe(400);
  });

});
