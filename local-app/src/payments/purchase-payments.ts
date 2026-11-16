import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { addLinkedCashMovement } from "../cash-register/cash-register.js";

export type PurchasePaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_wallet";

export interface RecordPurchasePaymentInput {
  purchaseId: string;
  method: PurchasePaymentMethod;
  amountMinor: number;
  reference?: string | null;
  idempotencyKey: string;
  actorUserId?: string | null;
}

export interface PurchasePaymentResult {
  paymentId: string;
  purchaseId: string;
  amountMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  duplicate: boolean;
}

interface PurchasePaymentRow {
  id: string;
  purchase_id: string;
  method: PurchasePaymentMethod;
  amount_minor: number;
  reference: string | null;
  idempotency_key: string;
  created_at: string;
}

function purchaseTotals(db: Database.Database, purchaseId: string) {
  const purchase = db.prepare(
    "SELECT id, status, total_minor, store_id FROM purchases WHERE id = ?"
  ).get(purchaseId) as { id: string; status: string; total_minor: number; store_id: string } | undefined;
  if (!purchase) throw new Error("Purchase not found.");

  const paid = db.prepare(
    "SELECT COALESCE(SUM(amount_minor), 0) AS paid_minor FROM purchase_payments WHERE purchase_id = ?"
  ).get(purchaseId) as { paid_minor: number };

  const paidMinor = Number(paid.paid_minor);
  return {
    purchase,
    paidMinor,
    outstandingMinor: purchase.total_minor - paidMinor
  };
}

export function recordPurchasePayment(
  db: Database.Database,
  input: RecordPurchasePaymentInput
): PurchasePaymentResult {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Payment amount must be a positive safe integer.");
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 160) {
    throw new Error("A valid payment idempotency key is required.");
  }
  if (input.reference != null && input.reference.length > 120) {
    throw new Error("Payment reference must not exceed 120 characters.");
  }

  const reference = input.reference?.trim() || null;
  const idempotencyKey = input.idempotencyKey.trim();

  const record = db.transaction((): PurchasePaymentResult => {
    const existing = db.prepare(
      "SELECT id, purchase_id, method, amount_minor, reference FROM purchase_payments WHERE idempotency_key = ?"
    ).get(idempotencyKey) as {
      id: string; purchase_id: string; method: PurchasePaymentMethod;
      amount_minor: number; reference: string | null;
    } | undefined;

    if (existing) {
      const sameRequest = existing.purchase_id === input.purchaseId
        && existing.method === input.method
        && existing.amount_minor === input.amountMinor
        && existing.reference === reference;
      if (!sameRequest) throw new Error("Purchase payment idempotency key conflict.");
      const totals = purchaseTotals(db, input.purchaseId);
      return {
        paymentId: existing.id, purchaseId: input.purchaseId,
        amountMinor: input.amountMinor, paidMinor: totals.paidMinor,
        outstandingMinor: totals.outstandingMinor, duplicate: true
      };
    }

    const totals = purchaseTotals(db, input.purchaseId);
    if (totals.purchase.status !== "posted") {
      throw new Error("Payments can only be recorded against posted purchases.");
    }
    if (input.amountMinor > totals.outstandingMinor) {
      throw new Error("Payment exceeds the outstanding purchase balance.");
    }

    const paymentId = randomUUID();
    db.prepare(`
      INSERT INTO purchase_payments(id, purchase_id, method, amount_minor, reference, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(paymentId, input.purchaseId, input.method, input.amountMinor, reference, idempotencyKey);

    if (input.method === "cash") {
      addLinkedCashMovement(db, {
        storeId: totals.purchase.store_id, direction: "out", movementType: "purchase_payment",
        amountMinor: input.amountMinor, description: "سداد نقدي للمورد",
        sourceId: paymentId, idempotencyKey: `purchase-cash:${idempotencyKey}`,
        actorUserId: input.actorUserId
      });
    }

    const paidMinor = totals.paidMinor + input.amountMinor;
    const outstandingMinor = totals.purchase.total_minor - paidMinor;
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'purchase.payment.recorded', 'purchase_payment', ?, ?)
    `).run(randomUUID(), input.actorUserId ?? null, paymentId, JSON.stringify({
      purchaseId: input.purchaseId, method: input.method,
      amountMinor: input.amountMinor, outstandingMinor
    }));

    return {
      paymentId, purchaseId: input.purchaseId, amountMinor: input.amountMinor,
      paidMinor, outstandingMinor, duplicate: false
    };
  });

  return record();
}

export function listPurchasePayments(
  db: Database.Database,
  purchaseId: string
): {
  items: PurchasePaymentRow[];
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  status: string;
} {
  const totals = purchaseTotals(db, purchaseId);
  const items = db.prepare(`
    SELECT id, purchase_id, method, amount_minor, reference, idempotency_key, created_at
    FROM purchase_payments WHERE purchase_id = ? ORDER BY created_at, id
  `).all(purchaseId) as PurchasePaymentRow[];

  return {
    items, totalMinor: totals.purchase.total_minor,
    paidMinor: totals.paidMinor, outstandingMinor: totals.outstandingMinor,
    status: totals.purchase.status
  };
}
