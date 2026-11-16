import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { addLinkedCashMovement } from "../cash-register/cash-register.js";

export type SalePaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_wallet";

export interface RecordSalePaymentInput {
  saleId: string;
  method: SalePaymentMethod;
  amountMinor: number;
  reference?: string | null;
  idempotencyKey: string;
  actorUserId?: string | null;
}

export interface SalePaymentResult {
  paymentId: string;
  saleId: string;
  amountMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  duplicate: boolean;
}

interface SalePaymentRow {
  id: string;
  sale_id: string;
  method: SalePaymentMethod;
  amount_minor: number;
  reference: string | null;
  idempotency_key: string;
  created_at: string;
}

function saleTotals(db: Database.Database, saleId: string) {
  const sale = db.prepare(
    "SELECT id, status, total_minor, store_id FROM sales WHERE id = ?"
  ).get(saleId) as { id: string; status: string; total_minor: number; store_id: string } | undefined;
  if (!sale) throw new Error("Sale not found.");

  const paid = db.prepare(
    "SELECT COALESCE(SUM(amount_minor), 0) AS paid_minor FROM payments WHERE sale_id = ?"
  ).get(saleId) as { paid_minor: number };

  return {
    sale,
    paidMinor: Number(paid.paid_minor),
    outstandingMinor: sale.total_minor - Number(paid.paid_minor)
  };
}

export function recordSalePayment(
  db: Database.Database,
  input: RecordSalePaymentInput
): SalePaymentResult {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Payment amount must be a positive safe integer.");
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 160) {
    throw new Error("A valid payment idempotency key is required.");
  }
  if (input.reference != null && input.reference.length > 120) {
    throw new Error("Payment reference must not exceed 120 characters.");
  }

  const normalizedReference = input.reference?.trim() || null;
  const normalizedIdempotencyKey = input.idempotencyKey.trim();

  const record = db.transaction((): SalePaymentResult => {
    const existing = db.prepare(
      "SELECT id, sale_id, method, amount_minor, reference FROM payments WHERE idempotency_key = ?"
    ).get(normalizedIdempotencyKey) as {
      id: string; sale_id: string; method: SalePaymentMethod;
      amount_minor: number; reference: string | null;
    } | undefined;

    if (existing) {
      const sameRequest = existing.sale_id === input.saleId
        && existing.method === input.method
        && existing.amount_minor === input.amountMinor
        && existing.reference === normalizedReference;
      if (!sameRequest) throw new Error("Payment idempotency key conflict.");
      const totals = saleTotals(db, input.saleId);
      return {
        paymentId: existing.id,
        saleId: input.saleId,
        amountMinor: input.amountMinor,
        paidMinor: totals.paidMinor,
        outstandingMinor: totals.outstandingMinor,
        duplicate: true
      };
    }

    const totals = saleTotals(db, input.saleId);
    if (totals.sale.status !== "posted") {
      throw new Error("Payments can only be recorded against posted sales.");
    }
    if (input.amountMinor > totals.outstandingMinor) {
      throw new Error("Payment exceeds the outstanding sale balance.");
    }

    const paymentId = randomUUID();
    db.prepare(`
      INSERT INTO payments(id, sale_id, method, amount_minor, reference, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      input.saleId,
      input.method,
      input.amountMinor,
      normalizedReference,
      normalizedIdempotencyKey
    );

    if (input.method === "cash") {
      addLinkedCashMovement(db, {
        storeId: totals.sale.store_id, direction: "in", movementType: "sale_receipt",
        amountMinor: input.amountMinor, description: `تحصيل نقدي من فاتورة البيع`,
        sourceId: paymentId, idempotencyKey: `sale-cash:${normalizedIdempotencyKey}`,
        actorUserId: input.actorUserId
      });
    }

    const paidMinor = totals.paidMinor + input.amountMinor;
    const outstandingMinor = totals.sale.total_minor - paidMinor;
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, 'sale.payment.recorded', 'sale_payment', ?, ?)
    `).run(
      randomUUID(),
      input.actorUserId ?? null,
      paymentId,
      JSON.stringify({
        saleId: input.saleId,
        method: input.method,
        amountMinor: input.amountMinor,
        outstandingMinor
      })
    );

    return {
      paymentId,
      saleId: input.saleId,
      amountMinor: input.amountMinor,
      paidMinor,
      outstandingMinor,
      duplicate: false
    };
  });

  return record();
}

export function listSalePayments(
  db: Database.Database,
  saleId: string
): { items: SalePaymentRow[]; totalMinor: number; paidMinor: number; outstandingMinor: number; status: string } {
  const totals = saleTotals(db, saleId);
  const items = db.prepare(`
    SELECT id, sale_id, method, amount_minor, reference, idempotency_key, created_at
    FROM payments WHERE sale_id = ? ORDER BY created_at, id
  `).all(saleId) as SalePaymentRow[];

  return {
    items,
    totalMinor: totals.sale.total_minor,
    paidMinor: totals.paidMinor,
    outstandingMinor: totals.outstandingMinor,
    status: totals.sale.status
  };
}
