import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { closeDatabase, openDatabase, resolveDatabasePath } from "./db/database.js";
import { createDatabaseBackup } from "./backup/backup.js";
import { authenticateSession, bootstrapOwner, hasPermission, login, logout } from "./auth/auth.js";
import { createProduct, listProducts } from "./catalog/products.js";
import { getStockBalance, postStockMovement } from "./inventory/stock-ledger.js";
import { createSale, postSale } from "./sales/sales.js";
import { createPurchase, postPurchase } from "./purchases/purchases.js";
import { listSalePayments, recordSalePayment } from "./payments/payments.js";
import { createCustomer, createSupplier, deactivateCustomer, deactivateSupplier, listCustomers, listSuppliers, updateCustomer, updateSupplier } from "./partners/partners.js";

const bootstrapSchema = z.object({
  username: z.string().trim().min(3).max(40),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(256)
});

const productSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  nameAr: z.string().trim().min(1).max(160),
  nameEn: z.string().trim().max(160).nullable().optional(),
  baseUnit: z.string().min(1).max(24),
  salePriceMinor: z.number().int().nonnegative().safe(),
  costPriceMinor: z.number().int().nonnegative().safe(),
  barcode: z.string().trim().min(4).max(64).nullable().optional()
});

const saleSchema = z.object({
  documentNo: z.string().trim().min(1).max(64),
  storeId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().safe(),
    unitPriceMinor: z.number().int().nonnegative().safe()
  })).min(1).max(500),
  discountMinor: z.number().int().nonnegative().safe().optional(),
  taxMinor: z.number().int().nonnegative().safe().optional(),
  idempotencyKey: z.string().trim().min(8).max(160)
});

const paymentSchema = z.object({
  method: z.enum(["cash", "card", "bank_transfer", "mobile_wallet"]),
  amountMinor: z.number().int().positive().safe(),
  reference: z.string().trim().max(120).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(160)
}).strict();

const purchaseSchema = z.object({
  documentNo: z.string().trim().min(1).max(64),
  storeId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  supplierId: z.string().uuid(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().safe(),
    unitCostMinor: z.number().int().nonnegative().safe()
  })).min(1).max(500),
  discountMinor: z.number().int().nonnegative().safe().optional(),
  taxMinor: z.number().int().nonnegative().safe().optional(),
  idempotencyKey: z.string().trim().min(8).max(160)
});

const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantityDelta: z.number().int().safe().refine(value => value !== 0),
  unitCostMinor: z.number().int().nonnegative().safe(),
  reason: z.string().trim().min(3).max(240),
  idempotencyKey: z.string().trim().min(8).max(160)
});

const customerSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).nullable().optional(),
  creditLimitMinor: z.number().int().nonnegative().safe().optional()
}).strict();

const supplierSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).nullable().optional()
}).strict();

const partnersQuerySchema = z.object({
  search: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});

const loginSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(1).max(256)
});

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(header);
  return match?.[1] ?? null;
}

export function buildServer() {
  const db = openDatabase();
  const app = Fastify({ logger: true, bodyLimit: 1_048_576 });

  function authorize(request: FastifyRequest, reply: FastifyReply, permission: string) {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    const user = authenticateSession(db, token);
    if (!user) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    if (!hasPermission(user, permission)) {
      reply.code(403).send({ error: "forbidden" });
      return null;
    }
    return user;
  }

  app.get("/api/v1/health", async () => {
    const result = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    const version = db.pragma("user_version", { simple: true });
    return {
      status: result.ok === 1 ? "ok" : "error",
      product: "AL-NASR",
      database: "sqlite",
      schemaVersion: version
    };
  });


  app.get("/api/v1/setup/status", async () => {
    const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    return { setupRequired: row.count === 0 };
  });

  app.post("/api/v1/setup/owner", async (request, reply) => {
    const parsed = bootstrapSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      const userId = bootstrapOwner(db, parsed.data);
      return reply.code(201).send({ userId, setupRequired: false });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already been completed")) {
        return reply.code(409).send({ error: "setup_already_completed" });
      }
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        return reply.code(409).send({ error: "username_already_exists" });
      }
      throw error;
    }
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const result = login(db, parsed.data.username, parsed.data.password);
    if (!result) return reply.code(401).send({ error: "invalid_credentials" });
    return reply.code(200).send(result);
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    const user = authenticateSession(db, token);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    return { user };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    logout(db, token);
    return reply.code(204).send();
  });


  app.get("/api/v1/products", async (request, reply) => {
    if (!authorize(request, reply, "products:read")) return;
    const query = z.object({
      search: z.string().max(80).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(100),
      offset: z.coerce.number().int().min(0).default(0)
    }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });
    return { items: listProducts(db, query.data.search ?? "", query.data.limit, query.data.offset) };
  });

  app.post("/api/v1/products", async (request, reply) => {
    const user = authorize(request, reply, "products:write");
    if (!user) return;
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      const product = createProduct(db, { ...parsed.data, actorUserId: user.id });
      return reply.code(201).send({ product });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        return reply.code(409).send({ error: "sku_or_barcode_already_exists" });
      }
      if (error instanceof Error) return reply.code(400).send({ error: "product_rejected", message: error.message });
      throw error;
    }
  });

  app.get("/api/v1/customers", async (request, reply) => {
    if (!authorize(request, reply, "customers:read")) return;
    const query = partnersQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });
    return { items: listCustomers(db, query.data.search ?? "", query.data.limit, query.data.offset) };
  });

  app.post("/api/v1/customers", async (request, reply) => {
    const user = authorize(request, reply, "customers:write");
    if (!user) return;
    const parsed = customerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return reply.code(201).send({ customer: createCustomer(db, parsed.data, user.id) });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        return reply.code(409).send({ error: "customer_code_already_exists" });
      }
      if (error instanceof Error) return reply.code(400).send({ error: "customer_rejected" });
      throw error;
    }
  });

  app.put("/api/v1/customers/:customerId", async (request, reply) => {
    const user = authorize(request, reply, "customers:write");
    if (!user) return;
    const params = z.object({ customerId: z.string().uuid() }).safeParse(request.params);
    const parsed = customerSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return { customer: updateCustomer(db, params.data.customerId, parsed.data, user.id) };
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) return reply.code(404).send({ error: "customer_not_found" });
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) return reply.code(409).send({ error: "customer_code_already_exists" });
      if (error instanceof Error) return reply.code(409).send({ error: "customer_update_rejected" });
      throw error;
    }
  });

  app.post("/api/v1/customers/:customerId/deactivate", async (request, reply) => {
    const user = authorize(request, reply, "customers:write");
    if (!user) return;
    const params = z.object({ customerId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      deactivateCustomer(db, params.data.customerId, user.id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) return reply.code(404).send({ error: "customer_not_found" });
      throw error;
    }
  });

  app.get("/api/v1/suppliers", async (request, reply) => {
    if (!authorize(request, reply, "suppliers:read")) return;
    const query = partnersQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });
    return { items: listSuppliers(db, query.data.search ?? "", query.data.limit, query.data.offset) };
  });

  app.post("/api/v1/suppliers", async (request, reply) => {
    const user = authorize(request, reply, "suppliers:write");
    if (!user) return;
    const parsed = supplierSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return reply.code(201).send({ supplier: createSupplier(db, parsed.data, user.id) });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        return reply.code(409).send({ error: "supplier_code_already_exists" });
      }
      if (error instanceof Error) return reply.code(400).send({ error: "supplier_rejected" });
      throw error;
    }
  });

  app.put("/api/v1/suppliers/:supplierId", async (request, reply) => {
    const user = authorize(request, reply, "suppliers:write");
    if (!user) return;
    const params = z.object({ supplierId: z.string().uuid() }).safeParse(request.params);
    const parsed = supplierSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return { supplier: updateSupplier(db, params.data.supplierId, parsed.data, user.id) };
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) return reply.code(404).send({ error: "supplier_not_found" });
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) return reply.code(409).send({ error: "supplier_code_already_exists" });
      if (error instanceof Error) return reply.code(409).send({ error: "supplier_update_rejected" });
      throw error;
    }
  });

  app.post("/api/v1/suppliers/:supplierId/deactivate", async (request, reply) => {
    const user = authorize(request, reply, "suppliers:write");
    if (!user) return;
    const params = z.object({ supplierId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      deactivateSupplier(db, params.data.supplierId, user.id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) return reply.code(404).send({ error: "supplier_not_found" });
      throw error;
    }
  });

  app.get("/api/v1/inventory/balance", async (request, reply) => {
    if (!authorize(request, reply, "inventory:read")) return;
    const query = z.object({ productId: z.string().uuid(), warehouseId: z.string().uuid() }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });
    return { productId: query.data.productId, warehouseId: query.data.warehouseId,
      quantity: getStockBalance(db, query.data.productId, query.data.warehouseId) };
  });

  app.post("/api/v1/inventory/adjustments", async (request, reply) => {
    const user = authorize(request, reply, "inventory:adjust");
    if (!user) return;
    const parsed = stockAdjustmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      const movement = postStockMovement(db, {
        ...parsed.data, sourceType: "manual_adjustment", sourceId: parsed.data.idempotencyKey,
        actorUserId: user.id
      });
      db.prepare("UPDATE audit_events SET payload_json = json_set(payload_json, '$.reason', ?) WHERE entity_type = 'stock_movement' AND entity_id = ?")
        .run(parsed.data.reason, movement.movementId);
      return reply.code(201).send(movement);
    } catch (error) {
      if (error instanceof Error) return reply.code(409).send({ error: "stock_adjustment_rejected", message: error.message });
      throw error;
    }
  });

  app.post("/api/v1/sales", async (request, reply) => {
    const user = authorize(request, reply, "sales:create");
    if (!user) return;
    const parsed = saleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return reply.code(201).send(createSale(db, { ...parsed.data, actorUserId: user.id }));
    } catch (error) {
      if (error instanceof Error) return reply.code(409).send({ error: "sale_rejected", message: error.message });
      throw error;
    }
  });

  app.post("/api/v1/sales/:saleId/post", async (request, reply) => {
    const user = authorize(request, reply, "sales:post");
    if (!user) return;
    const params = z.object({ saleId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return postSale(db, params.data.saleId, user.id);
    } catch (error) {
      if (error instanceof Error) return reply.code(409).send({ error: "sale_post_rejected", message: error.message });
      throw error;
    }
  });

  app.get("/api/v1/sales/:saleId/payments", async (request, reply) => {
    if (!authorize(request, reply, "sales:read")) return;
    const params = z.object({ saleId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return listSalePayments(db, params.data.saleId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sale not found")) {
        return reply.code(404).send({ error: "sale_not_found" });
      }
      throw error;
    }
  });

  app.post("/api/v1/sales/:saleId/payments", async (request, reply) => {
    const user = authorize(request, reply, "sales:pay");
    if (!user) return;
    const params = z.object({ saleId: z.string().uuid() }).safeParse(request.params);
    const parsed = paymentSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      const payment = recordSalePayment(db, {
        ...parsed.data,
        saleId: params.data.saleId,
        actorUserId: user.id
      });
      return reply.code(payment.duplicate ? 200 : 201).send({ payment });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sale not found")) {
        return reply.code(404).send({ error: "sale_not_found" });
      }
      if (error instanceof Error) {
        return reply.code(409).send({ error: "payment_rejected", message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/v1/purchases", async (request, reply) => {
    const user = authorize(request, reply, "purchases:write");
    if (!user) return;
    const parsed = purchaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return reply.code(201).send(createPurchase(db, { ...parsed.data, actorUserId: user.id }));
    } catch (error) {
      if (error instanceof Error) return reply.code(409).send({ error: "purchase_rejected", message: error.message });
      throw error;
    }
  });

  app.post("/api/v1/purchases/:purchaseId/post", async (request, reply) => {
    const user = authorize(request, reply, "purchases:write");
    if (!user) return;
    const params = z.object({ purchaseId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_request" });
    try {
      return postPurchase(db, params.data.purchaseId, user.id);
    } catch (error) {
      if (error instanceof Error) return reply.code(409).send({ error: "purchase_post_rejected", message: error.message });
      throw error;
    }
  });


  app.post("/api/v1/backups", async (request, reply) => {
    const user = authorize(request, reply, "settings:write");
    if (!user) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = join(dirname(resolveDatabasePath()), "backups", `alnasr-${stamp}.sqlite`);
    try {
      const backup = await createDatabaseBackup(db, destination);
      db.prepare(`
        INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
        VALUES (?, ?, 'database.backup.created', 'database_backup', ?, ?)
      `).run(randomUUID(), user.id, backup.path, JSON.stringify({ schemaVersion: backup.schemaVersion }));
      return reply.code(201).send({ backup });
    } catch (error) {
      request.log.error({ err: error }, "Database backup failed");
      return reply.code(500).send({ error: "backup_failed" });
    }
  });

  app.addHook("onClose", async () => {
    closeDatabase(db);
  });

  return app;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  const app = buildServer();
  const host = process.env.AL_NASR_API_HOST ?? "127.0.0.1";
  const port = Number(process.env.AL_NASR_API_PORT ?? 4317);
  await app.listen({ host, port });
}
