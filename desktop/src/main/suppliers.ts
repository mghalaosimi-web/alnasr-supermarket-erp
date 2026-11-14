import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type SupplierRow = { id: string; code: string; name: string; phone: string | null; isActive: number };

export function listSuppliers(db: Database.Database): SupplierRow[] {
  return db.prepare("SELECT id, code, name, phone, is_active AS isActive FROM suppliers ORDER BY name COLLATE NOCASE, code")
    .all() as SupplierRow[];
}

export function createSupplier(
  db: Database.Database,
  input: { code: string; name: string; phone?: string; actorUserId: string }
): SupplierRow {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  if (!/^[A-Z0-9._-]{2,40}$/.test(code)) throw new Error("رمز المورد يجب أن يكون من حرفين إلى 40 حرفاً");
  if (name.length < 2 || name.length > 160) throw new Error("اسم المورد غير صحيح");
  if (phone && phone.length > 40) throw new Error("رقم هاتف المورد طويل جداً");

  const supplier: SupplierRow = { id: randomUUID(), code, name, phone, isActive: 1 };
  const create = db.transaction(() => {
    db.prepare("INSERT INTO suppliers (id, code, name, phone) VALUES (?, ?, ?, ?)")
      .run(supplier.id, code, name, phone);
    db.prepare("INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'supplier.create', 'supplier', ?, ?)")
      .run(randomUUID(), input.actorUserId, supplier.id, JSON.stringify({ code, name }));
  });
  create.immediate();
  return supplier;
}
