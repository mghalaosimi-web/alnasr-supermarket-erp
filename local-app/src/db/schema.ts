import type Database from "better-sqlite3";

export const SCHEMA_VERSION = 1;

const migrationV1 = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'YER',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON audit_events(entity_type, entity_id, occurred_at);

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  base_unit TEXT NOT NULL,
  sale_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (sale_price_minor >= 0),
  cost_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (cost_price_minor >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS product_barcodes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL UNIQUE,
  unit_code TEXT NOT NULL,
  quantity_per_unit INTEGER NOT NULL DEFAULT 1 CHECK (quantity_per_unit > 0)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  credit_limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_limit_minor >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_minor >= 0),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_warehouse
  ON stock_ledger(product_id, warehouse_id, occurred_at);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  document_no TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'posted', 'voided')),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  method TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO roles(id, code, name) VALUES
  ('role-owner', 'owner', 'مالك النظام'),
  ('role-admin', 'admin', 'مدير'),
  ('role-cashier', 'cashier', 'كاشير'),
  ('role-inventory', 'inventory', 'مسؤول المخزون'),
  ('role-accountant', 'accountant', 'محاسب');

INSERT OR IGNORE INTO app_meta(key, value) VALUES
  ('product_name', 'AL-NASR'),
  ('database_schema_version', '1');
`;

export function applySchemaV1(db: Database.Database): void {
  db.exec(migrationV1);
}
