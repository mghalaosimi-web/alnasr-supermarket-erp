import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { postSystemJournalEntry } from "../accounting/journal.js";

export interface StockMovementInput {
  productId: string;
  warehouseId: string;
  quantityDelta: number;
  unitCostMinor: number;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  actorUserId?: string | null;
}

export interface StockMovementResult {
  movementId: string;
  balance: number;
  duplicate: boolean;
}

export class InsufficientStockError extends Error {
  constructor() {
    super("Insufficient stock for this movement.");
    this.name = "InsufficientStockError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different request.");
    this.name = "IdempotencyConflictError";
  }
}

export function getStockBalance(db: Database.Database, productId: string, warehouseId: string): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(quantity_delta), 0) AS balance
    FROM stock_ledger
    WHERE product_id = ? AND warehouse_id = ?
  `).get(productId, warehouseId) as { balance: number };
  return row.balance;
}

export function postStockMovement(
  db: Database.Database,
  input: StockMovementInput
): StockMovementResult {
  if (!Number.isSafeInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error("quantityDelta must be a non-zero safe integer.");
  }
  if (!Number.isSafeInteger(input.unitCostMinor) || input.unitCostMinor < 0) {
    throw new Error("unitCostMinor must be a non-negative safe integer.");
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 160) {
    throw new Error("A valid idempotency key is required.");
  }
  if (!input.sourceType.trim() || !input.sourceId.trim()) {
    throw new Error("A source type and source id are required.");
  }

  const post = db.transaction((): StockMovementResult => {
    const existing = db.prepare(`
      SELECT id, product_id, warehouse_id, quantity_delta, unit_cost_minor, source_type, source_id
      FROM stock_ledger WHERE idempotency_key = ?
    `).get(input.idempotencyKey) as {
      id: string; product_id: string; warehouse_id: string; quantity_delta: number;
      unit_cost_minor: number; source_type: string; source_id: string;
    } | undefined;

    if (existing) {
      const same = existing.product_id === input.productId
        && existing.warehouse_id === input.warehouseId
        && existing.quantity_delta === input.quantityDelta
        && existing.unit_cost_minor === input.unitCostMinor
        && existing.source_type === input.sourceType
        && existing.source_id === input.sourceId;
      if (!same) throw new IdempotencyConflictError();
      return {
        movementId: existing.id,
        balance: getStockBalance(db, input.productId, input.warehouseId),
        duplicate: true
      };
    }

    const balance = getStockBalance(db, input.productId, input.warehouseId);
    if (balance + input.quantityDelta < 0) throw new InsufficientStockError();

    const movementId = randomUUID();
    db.prepare(`
      INSERT INTO stock_ledger(
        id, product_id, warehouse_id, quantity_delta, unit_cost_minor,
        source_type, source_id, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      movementId, input.productId, input.warehouseId, input.quantityDelta,
      input.unitCostMinor, input.sourceType, input.sourceId, input.idempotencyKey
    );

    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'stock.movement.posted', 'stock_movement', ?, ?)
    `).run(
      randomUUID(),
      input.actorUserId ?? null,
      movementId,
      JSON.stringify({
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantityDelta: input.quantityDelta,
        sourceType: input.sourceType,
        sourceId: input.sourceId
      })
    );

    if ((input.sourceType === "opening_balance" || input.sourceType === "adjustment") && input.unitCostMinor > 0) {
      const accountingReady = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'accounts'").get();
      if (accountingReady) {
        const adjustmentValue = Math.abs(input.quantityDelta) * input.unitCostMinor;
        if (!Number.isSafeInteger(adjustmentValue)) throw new Error("Stock adjustment value exceeds the supported range.");
        postSystemJournalEntry(db, {
          sourceType: "stock_movement", sourceId: movementId,
          idempotencyKey: `journal:stock-movement:${movementId}`,
          description: input.sourceType === "opening_balance" ? "إثبات رصيد مخزون افتتاحي" : "تسوية قيمة المخزون",
          actorUserId: input.actorUserId,
          lines: input.quantityDelta > 0
            ? [
                { accountCode: "1200", debitMinor: adjustmentValue, description: "زيادة المخزون" },
                { accountCode: "3100", creditMinor: adjustmentValue, description: "رصيد افتتاحي / تسوية" }
              ]
            : [
                { accountCode: "3100", debitMinor: adjustmentValue, description: "رصيد افتتاحي / تسوية" },
                { accountCode: "1200", creditMinor: adjustmentValue, description: "تخفيض المخزون" }
              ]
        });
      }
    }
    return {
      movementId,
      balance: balance + input.quantityDelta,
      duplicate: false
    };
  });

  return post();
}
