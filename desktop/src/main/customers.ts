import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type CustomerRow = { id: string; code: string; name: string; phone: string | null; creditLimitMinor: number; isActive: number };

export function listCustomers(db: Database.Database): CustomerRow[] {
  return db.prepare("SELECT id, code, name, phone, credit_limit_minor AS creditLimitMinor, is_active AS isActive FROM customers ORDER BY name COLLATE NOCASE, code")
    .all() as CustomerRow[];
}

export function createCustomer(
  db: Database.Database,
  input: { code: string; name: string; phone?: string; creditLimitMinor?: number; actorUserId: string }
): CustomerRow {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  const creditLimitMinor = input.creditLimitMinor ?? 0;
  if (!/^[A-Z0-9._-]{2,40}$/.test(code)) throw new Error("رمز العميل يجب أن يكون من حرفين إلى 40 حرفاً");
  if (name.length < 2 || name.length > 160) throw new Error("اسم العميل غير صحيح");
  if (phone && phone.length > 40) throw new Error("رقم هاتف العميل طويل جداً");
  if (!Number.isSafeInteger(creditLimitMinor) || creditLimitMinor < 0) throw new Error("حد الائتمان غير صحيح");

  const customer: CustomerRow = { id: randomUUID(), code, name, phone, creditLimitMinor, isActive: 1 };
  const create = db.transaction(() => {
    db.prepare("INSERT INTO customers (id, code, name, phone, credit_limit_minor) VALUES (?, ?, ?, ?, ?)")
      .run(customer.id, code, name, phone, creditLimitMinor);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'customer.create', 'customer', ?, ?)")
      .run(randomUUID(), input.actorUserId, customer.id, JSON.stringify({ code, name, creditLimitMinor }));
  });
  create.immediate();
  return customer;
}
