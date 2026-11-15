import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export interface CustomerInput {
  code: string;
  name: string;
  phone?: string | null;
  creditLimitMinor?: number;
}

export interface SupplierInput {
  code: string;
  name: string;
  phone?: string | null;
}

export interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  credit_limit_minor: number;
  is_active: number;
}

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  is_active: number;
}

type PartnerKind = "customer" | "supplier";

function validateIdentity(input: { code: string; name: string; phone?: string | null }): void {
  if (!/^[A-Za-z0-9._/-]{1,64}$/.test(input.code.trim())) {
    throw new Error("Partner code must contain 1–64 supported characters.");
  }
  if (input.name.trim().length < 2 || input.name.trim().length > 160) {
    throw new Error("Partner name must contain 2–160 characters.");
  }
  if (input.phone != null && input.phone.trim().length > 40) {
    throw new Error("Partner phone must not exceed 40 characters.");
  }
}

function tableFor(kind: PartnerKind): "customers" | "suppliers" {
  return kind === "customer" ? "customers" : "suppliers";
}

function getPartner<T extends CustomerRecord | SupplierRecord>(
  db: Database.Database,
  kind: PartnerKind,
  id: string
): T | null {
  const table = tableFor(kind);
  return (db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as T | undefined) ?? null;
}

function createPartner<T extends CustomerRecord | SupplierRecord>(
  db: Database.Database,
  kind: PartnerKind,
  input: CustomerInput | SupplierInput,
  actorUserId?: string | null
): T {
  validateIdentity(input);
  const creditLimitMinor = kind === "customer" && "creditLimitMinor" in input
    ? input.creditLimitMinor ?? 0
    : 0;
  if (!Number.isSafeInteger(creditLimitMinor) || creditLimitMinor < 0) {
    throw new Error("creditLimitMinor must be a non-negative safe integer.");
  }

  const table = tableFor(kind);
  const id = randomUUID();
  const insert = db.transaction(() => {
    if (kind === "customer") {
      db.prepare(`
        INSERT INTO customers(id, code, name, phone, credit_limit_minor)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, input.code.trim(), input.name.trim(), input.phone?.trim() || null, creditLimitMinor);
    } else {
      db.prepare(`
        INSERT INTO suppliers(id, code, name, phone)
        VALUES (?, ?, ?, ?)
      `).run(id, input.code.trim(), input.name.trim(), input.phone?.trim() || null);
    }

    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      actorUserId ?? null,
      `${kind}.created`,
      kind,
      id,
      JSON.stringify({ code: input.code.trim() })
    );
  });
  insert();

  return getPartner<T>(db, kind, id)!;
}

function updatePartner<T extends CustomerRecord | SupplierRecord>(
  db: Database.Database,
  kind: PartnerKind,
  id: string,
  input: CustomerInput | SupplierInput,
  actorUserId?: string | null
): T {
  validateIdentity(input);
  const current = getPartner<T>(db, kind, id);
  if (!current) throw new Error(`${kind} not found.`);
  if (current.is_active !== 1) throw new Error(`Inactive ${kind}s cannot be updated.`);

  const creditLimitMinor = kind === "customer" && "creditLimitMinor" in input
    ? input.creditLimitMinor ?? 0
    : 0;
  if (!Number.isSafeInteger(creditLimitMinor) || creditLimitMinor < 0) {
    throw new Error("creditLimitMinor must be a non-negative safe integer.");
  }

  const table = tableFor(kind);
  const update = db.transaction(() => {
    if (kind === "customer") {
      db.prepare(`
        UPDATE customers SET code = ?, name = ?, phone = ?, credit_limit_minor = ? WHERE id = ?
      `).run(id ? input.code.trim() : input.code.trim(), input.name.trim(), input.phone?.trim() || null, creditLimitMinor, id);
    } else {
      db.prepare(`
        UPDATE suppliers SET code = ?, name = ?, phone = ? WHERE id = ?
      `).run(input.code.trim(), input.name.trim(), input.phone?.trim() || null, id);
    }
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      actorUserId ?? null,
      `${kind}.updated`,
      kind,
      id,
      JSON.stringify({ code: input.code.trim() })
    );
  });
  void table;
  update();

  return getPartner<T>(db, kind, id)!;
}

function listPartners<T extends CustomerRecord | SupplierRecord>(
  db: Database.Database,
  kind: PartnerKind,
  search = "",
  limit = 100,
  offset = 0
): T[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Limit must be between 1 and 200.");
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Offset must be a non-negative integer.");
  const table = tableFor(kind);
  const term = `%${search.trim().slice(0, 80)}%`;
  return db.prepare(`
    SELECT * FROM ${table}
    WHERE is_active = 1 AND (code LIKE ? OR name LIKE ? OR phone LIKE ?)
    ORDER BY name COLLATE NOCASE, code
    LIMIT ? OFFSET ?
  `).all(term, term, term, limit, offset) as T[];
}

function deactivatePartner(
  db: Database.Database,
  kind: PartnerKind,
  id: string,
  actorUserId?: string | null
): void {
  const table = tableFor(kind);
  const deactivate = db.transaction(() => {
    const current = db.prepare(`SELECT id, is_active FROM ${table} WHERE id = ?`)
      .get(id) as { id: string; is_active: number } | undefined;
    if (!current) throw new Error(`${kind} not found.`);
    if (current.is_active === 0) return;

    db.prepare(`UPDATE ${table} SET is_active = 0 WHERE id = ?`).run(id);
    db.prepare(`
      INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, ?, ?, ?, '{}')
    `).run(randomUUID(), actorUserId ?? null, `${kind}.deactivated`, kind, id);
  });
  deactivate();
}

export const createCustomer = (db: Database.Database, input: CustomerInput, actorUserId?: string | null) =>
  createPartner<CustomerRecord>(db, "customer", input, actorUserId);

export const updateCustomer = (db: Database.Database, id: string, input: CustomerInput, actorUserId?: string | null) =>
  updatePartner<CustomerRecord>(db, "customer", id, input, actorUserId);

export const listCustomers = (db: Database.Database, search = "", limit = 100, offset = 0) =>
  listPartners<CustomerRecord>(db, "customer", search, limit, offset);

export const deactivateCustomer = (db: Database.Database, id: string, actorUserId?: string | null) =>
  deactivatePartner(db, "customer", id, actorUserId);

export const createSupplier = (db: Database.Database, input: SupplierInput, actorUserId?: string | null) =>
  createPartner<SupplierRecord>(db, "supplier", input, actorUserId);

export const updateSupplier = (db: Database.Database, id: string, input: SupplierInput, actorUserId?: string | null) =>
  updatePartner<SupplierRecord>(db, "supplier", id, input, actorUserId);

export const listSuppliers = (db: Database.Database, search = "", limit = 100, offset = 0) =>
  listPartners<SupplierRecord>(db, "supplier", search, limit, offset);

export const deactivateSupplier = (db: Database.Database, id: string, actorUserId?: string | null) =>
  deactivatePartner(db, "supplier", id, actorUserId);
