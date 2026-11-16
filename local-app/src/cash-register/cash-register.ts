import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type CashDirection = "in" | "out";
export type CashMovementType = "sale_receipt" | "purchase_payment" | "manual_in" | "manual_out";

export function getOpenCashSession(db: Database.Database, storeId: string) {
  return db.prepare("SELECT * FROM cash_register_sessions WHERE store_id = ? AND status = 'open'").get(storeId) as Record<string, any> | undefined;
}

export function getCashRegisterStatus(db: Database.Database, storeId: string) {
  const store = db.prepare("SELECT id, name, currency_code FROM stores WHERE id = ? AND is_active = 1").get(storeId) as { id: string; name: string; currency_code: string } | undefined;
  if (!store) throw new Error("Active store not found.");
  const session = getOpenCashSession(db, storeId);
  if (!session) return { store, session: null, totals: null, items: [] };
  const totals = db.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_minor ELSE 0 END),0) AS inflow_minor, COALESCE(SUM(CASE WHEN direction = 'out' THEN amount_minor ELSE 0 END),0) AS outflow_minor, COUNT(*) AS movement_count FROM cash_register_movements WHERE session_id = ?").get(session.id) as { inflow_minor: number; outflow_minor: number; movement_count: number };
  const items = db.prepare("SELECT id, session_id, direction, movement_type, amount_minor, description, source_id, actor_user_id, created_at FROM cash_register_movements WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 200").all(session.id);
  return { store, session, items, totals: { openingFloatMinor: session.opening_float_minor, inflowMinor: Number(totals.inflow_minor), outflowMinor: Number(totals.outflow_minor), expectedCashMinor: session.opening_float_minor + Number(totals.inflow_minor) - Number(totals.outflow_minor), movementCount: Number(totals.movement_count) } };
}

export function openCashSession(db: Database.Database, input: { storeId: string; actorUserId: string; openingFloatMinor: number; note?: string | null }) {
  if (!Number.isSafeInteger(input.openingFloatMinor) || input.openingFloatMinor < 0) throw new Error("Opening float must be a non-negative safe integer.");
  if (!db.prepare("SELECT id FROM stores WHERE id = ? AND is_active = 1").get(input.storeId)) throw new Error("Active store not found.");
  const id = randomUUID();
  try {
    db.transaction(() => {
      db.prepare("INSERT INTO cash_register_sessions(id, store_id, opened_by, opening_float_minor, status, opening_note) VALUES (?, ?, ?, ?, 'open', ?)").run(id, input.storeId, input.actorUserId, input.openingFloatMinor, input.note?.trim() || null);
      db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'cash.session.opened', 'cash_session', ?, ?)").run(randomUUID(), input.actorUserId, id, JSON.stringify({ storeId: input.storeId, openingFloatMinor: input.openingFloatMinor }));
    })();
  } catch (error) { if (error instanceof Error && error.message.includes("UNIQUE")) throw new Error("A cash session is already open for this store."); throw error; }
  return db.prepare("SELECT * FROM cash_register_sessions WHERE id = ?").get(id);
}

export function recordCashMovement(db: Database.Database, input: { storeId: string; direction: CashDirection; amountMinor: number; description: string; actorUserId: string; idempotencyKey: string }) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Movement amount must be a positive safe integer.");
  const description = input.description.trim(), key = input.idempotencyKey.trim();
  if (description.length < 3 || description.length > 240 || key.length < 8 || key.length > 160) throw new Error("Invalid movement description or idempotency key.");
  return db.transaction(() => {
    const existing = db.prepare("SELECT id, session_id, direction, amount_minor, description FROM cash_register_movements WHERE idempotency_key = ?").get(key) as { id: string; session_id: string; direction: CashDirection; amount_minor: number; description: string } | undefined;
    if (existing) { const session = db.prepare("SELECT store_id FROM cash_register_sessions WHERE id = ?").get(existing.session_id) as { store_id: string }; if (session.store_id !== input.storeId || existing.direction !== input.direction || existing.amount_minor !== input.amountMinor || existing.description !== description) throw new Error("Cash movement idempotency key conflict."); return { movementId: existing.id, duplicate: true }; }
    const session = getOpenCashSession(db, input.storeId); if (!session) throw new Error("Open a cash session before recording cash movements.");
    if (input.direction === "out") {
      const totals = db.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_minor ELSE -amount_minor END), 0) AS balance_minor FROM cash_register_movements WHERE session_id = ?").get(session.id) as { balance_minor: number };
      const available = session.opening_float_minor + Number(totals.balance_minor);
      if (input.amountMinor > available) throw new Error("Cash outflow exceeds the available drawer balance.");
    }
    const id = randomUUID();
    db.prepare("INSERT INTO cash_register_movements(id, session_id, direction, movement_type, amount_minor, description, idempotency_key, actor_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, session.id, input.direction, input.direction === "in" ? "manual_in" : "manual_out", input.amountMinor, description, key, input.actorUserId);
    db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'cash.movement.recorded', 'cash_movement', ?, ?)").run(randomUUID(), input.actorUserId, id, JSON.stringify({ sessionId: session.id, direction: input.direction, amountMinor: input.amountMinor }));
    return { movementId: id, duplicate: false };
  })();
}

export function closeCashSession(db: Database.Database, input: { storeId: string; actorUserId: string; countedCashMinor: number; note?: string | null }) {
  if (!Number.isSafeInteger(input.countedCashMinor) || input.countedCashMinor < 0) throw new Error("Counted cash must be a non-negative safe integer.");
  return db.transaction(() => {
    const session = getOpenCashSession(db, input.storeId); if (!session) throw new Error("There is no open cash session for this store.");
    const totals = db.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_minor ELSE 0 END),0) AS inflow_minor, COALESCE(SUM(CASE WHEN direction = 'out' THEN amount_minor ELSE 0 END),0) AS outflow_minor FROM cash_register_movements WHERE session_id = ?").get(session.id) as { inflow_minor: number; outflow_minor: number };
    const expectedCashMinor = session.opening_float_minor + Number(totals.inflow_minor) - Number(totals.outflow_minor);
    const varianceMinor = input.countedCashMinor - expectedCashMinor;
    db.prepare("UPDATE cash_register_sessions SET status = 'closed', closed_by = ?, counted_cash_minor = ?, expected_cash_minor = ?, variance_minor = ?, closing_note = ?, closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'open'").run(input.actorUserId, input.countedCashMinor, expectedCashMinor, varianceMinor, input.note?.trim() || null, session.id);
    db.prepare("INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json) VALUES (?, ?, 'cash.session.closed', 'cash_session', ?, ?)").run(randomUUID(), input.actorUserId, session.id, JSON.stringify({ expectedCashMinor, countedCashMinor: input.countedCashMinor, varianceMinor }));
    return { sessionId: session.id, expectedCashMinor, countedCashMinor: input.countedCashMinor, varianceMinor };
  })();
}

export function addLinkedCashMovement(db: Database.Database, input: { storeId: string; direction: CashDirection; movementType: "sale_receipt" | "purchase_payment"; amountMinor: number; description: string; sourceId: string; idempotencyKey: string; actorUserId?: string | null }): void {
  const session = getOpenCashSession(db, input.storeId); if (!session) throw new Error("Open a cash session before recording cash payments.");
  if (input.direction === "out") {
    const totals = db.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_minor ELSE -amount_minor END), 0) AS balance_minor FROM cash_register_movements WHERE session_id = ?").get(session.id) as { balance_minor: number };
    const available = session.opening_float_minor + Number(totals.balance_minor);
    if (input.amountMinor > available) throw new Error("Cash payment exceeds the available drawer balance.");
  }
  db.prepare("INSERT INTO cash_register_movements(id, session_id, direction, movement_type, amount_minor, description, source_id, idempotency_key, actor_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), session.id, input.direction, input.movementType, input.amountMinor, input.description, input.sourceId, input.idempotencyKey, input.actorUserId ?? null);
}