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

    const sale = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: authorization,
      payload: {
        documentNo: "API-INV-001", storeId: store.id, warehouseId: warehouse.id,
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
});
