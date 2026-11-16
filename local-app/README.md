# AL-NASR Local Runtime — SQLite foundation

This is the replacement local-first runtime defined in [ADR-0002](../docs/architecture/ADR-0002-sqlite-local-first-no-docker.md). It is independent of the historical ERPNext/Frappe runtime.

## Implemented

- SQLite schema migrations v1–v4, stored outside the application installation directory.
- Foreign keys, WAL mode, FULL synchronous writes, busy timeout, WAL auto-checkpoint, startup integrity check, and graceful WAL checkpoint at shutdown.
- Refusal to open a database created by a newer unsupported application schema.
- First-run owner bootstrap creates the owner account, default store, and main warehouse atomically.
- Scrypt password hashing, hashed bearer-token sessions, session expiry/revocation, role/permission resolution, and per-account failed-login lockout.
- Permission-checked Fastify API for setup, authentication, product catalog, customer/supplier master-data CRUD, stock balances, inventory adjustments, sales, partial sale-payment allocations, purchases, and verified database backup creation.
- Product creation/search/deactivation with validation and audit records.
- Transactional stock ledger with non-negative stock enforcement and idempotent retries.
- POS sale drafts and atomic posting that deducts stock.
- Partial payment allocations for posted sales using cash, card, bank transfer, or mobile wallet records; outstanding balance checks, idempotency-key replay protection, and audit events. No external payment processor is integrated.
- Purchase drafts and receiving that adds stock.
- SQLite backup creation through the online backup API, integrity verification, temporary-file creation, and atomic finalization.
- Automated tests for schema, persistent reopen, forward-schema protection, authentication, owner setup, RBAC, catalog, stock ledger, sales, purchasing, backup, and API integration.

## API

The service binds to `127.0.0.1:4317` by default. It is intentionally not exposed to the LAN until secure pairing, TLS, and device authorization are implemented.

- `GET /api/v1/health`
- `GET /api/v1/setup/status`
- `POST /api/v1/setup/owner`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/inventory/balance`
- `POST /api/v1/inventory/adjustments`
- `POST /api/v1/sales`
- `POST /api/v1/sales/:saleId/post`
- `POST /api/v1/purchases`
- `POST /api/v1/purchases/:purchaseId/post`
- `POST /api/v1/backups`

All business endpoints require a valid bearer session and the relevant permission. The first-run setup endpoint is one-time only and must remain local.

## Development and validation

Requires Node.js 24 and a supported native build toolchain for `better-sqlite3`.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

The committed `package-lock.json` pins the dependency graph.

By default, Windows data is stored under `%ProgramData%\\AL-NASR\\data\\alnasr.sqlite`; other operating systems use `~/.local/share/al-nasr/data/alnasr.sqlite`. Set `AL_NASR_DATABASE_PATH` to override it for tests or development.

## Not yet implemented

This is a verified backend foundation, not the finished desktop product. Still outstanding: React user interface, Electron desktop lifecycle and single-instance protection, Windows installer and startup behavior, Android client and secure LAN pairing/TLS, backup restore and retention policy, payment settlement/reconciliation, returns/refunds, accounting journals and reconciliation, shifts/cash management, full Windows React screens, Electron lifecycle, Windows-native installer, backup restore/retention, and clean Windows/hardware acceptance.
