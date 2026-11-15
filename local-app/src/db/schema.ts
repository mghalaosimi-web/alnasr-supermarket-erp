import type Database from "better-sqlite3";

export const SCHEMA_VERSION = 4;

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


const migrationV2 = `
CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expiry
  ON user_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  username_key TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_started_at TEXT NOT NULL,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO permissions(code, description) VALUES
  ('dashboard:read', 'View dashboard'),
  ('products:read', 'View products'),
  ('products:write', 'Create and update products'),
  ('inventory:read', 'View stock and warehouses'),
  ('inventory:adjust', 'Post inventory adjustments'),
  ('sales:read', 'View sales'),
  ('sales:create', 'Create sales'),
  ('sales:post', 'Post sales'),
  ('sales:void', 'Void sales'),
  ('customers:read', 'View customers'),
  ('customers:write', 'Manage customers'),
  ('suppliers:read', 'View suppliers'),
  ('suppliers:write', 'Manage suppliers'),
  ('purchases:read', 'View purchases'),
  ('purchases:write', 'Manage purchases'),
  ('accounting:read', 'View accounting records'),
  ('accounting:post', 'Post accounting entries'),
  ('reports:read', 'View reports'),
  ('users:read', 'View users'),
  ('users:write', 'Manage users'),
  ('settings:write', 'Manage store settings'),
  ('audit:read', 'View audit log');

INSERT OR IGNORE INTO role_permissions(role_id, permission_code)
SELECT 'role-owner', code FROM permissions;

INSERT OR IGNORE INTO role_permissions(role_id, permission_code)
SELECT 'role-admin', code FROM permissions
WHERE code NOT IN ('users:write', 'settings:write');

INSERT OR IGNORE INTO role_permissions(role_id, permission_code) VALUES
  ('role-cashier', 'dashboard:read'),
  ('role-cashier', 'products:read'),
  ('role-cashier', 'sales:read'),
  ('role-cashier', 'sales:create'),
  ('role-cashier', 'sales:post'),
  ('role-cashier', 'customers:read'),
  ('role-cashier', 'customers:write'),
  ('role-inventory', 'dashboard:read'),
  ('role-inventory', 'products:read'),
  ('role-inventory', 'products:write'),
  ('role-inventory', 'inventory:read'),
  ('role-inventory', 'inventory:adjust'),
  ('role-inventory', 'suppliers:read'),
  ('role-inventory', 'purchases:read'),
  ('role-inventory', 'purchases:write'),
  ('role-accountant', 'dashboard:read'),
  ('role-accountant', 'sales:read'),
  ('role-accountant', 'purchases:read'),
  ('role-accountant', 'accounting:read'),
  ('role-accountant', 'accounting:post'),
  ('role-accountant', 'reports:read');
`;

export function applySchemaV2(db: Database.Database): void {
  db.exec(migrationV2);
}

const migrationV3 = `
ALTER TABLE sales ADD COLUMN warehouse_id TEXT REFERENCES warehouses(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  document_no TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'posted', 'voided')),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS purchase_lines (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_minor INTEGER NOT NULL CHECK (unit_cost_minor >= 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_created
  ON purchases(supplier_id, created_at);

CREATE INDEX IF NOT EXISTS idx_purchase_lines_product
  ON purchase_lines(product_id);
`;

export function applySchemaV3(db: Database.Database): void {
  db.exec(migrationV3);
}


const migrationV4 = `
INSERT OR IGNORE INTO permissions(code, description)
VALUES ('sales:pay', 'Record and view sale payment allocations');

INSERT OR IGNORE INTO role_permissions(role_id, permission_code) VALUES
  ('role-owner', 'sales:pay'),
  ('role-admin', 'sales:pay'),
  ('role-cashier', 'sales:pay');
`;

export function applySchemaV4(db: Database.Database): void {
  db.exec(migrationV4);
}
