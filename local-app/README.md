# AL-NASR Local Runtime — SQLite foundation

This is the replacement local-first runtime defined in [ADR-0002](../docs/architecture/ADR-0002-sqlite-local-first-no-docker.md). It is intentionally independent of the historical ERPNext/Frappe runtime.

## Implemented

- SQLite database outside the installation directory, with foreign keys, WAL, FULL synchronous writes, busy timeout, and versioned migrations (schema v3).
- Core tables for stores, users, roles, permissions, audit events, warehouses, products/barcodes, customers, suppliers, stock ledger, sales, sale lines, and payments.
- First-run owner bootstrap, scrypt password hashing, hashed bearer-token sessions, role/permission resolution, logout, and a per-account failed-login lockout.
- Fastify local endpoints for health, first-run setup, login, current session, and logout.
- Transactional stock ledger posting with non-negative stock enforcement, audit events, and idempotent retries.
- Unit tests for schema migrations, authentication, owner bootstrap, session lifecycle, RBAC, lockout, stock ledger, sale posting, and purchase receiving.

## API

The service binds to 127.0.0.1:4317 by default. LAN binding is deliberately disabled until authenticated HTTPS pairing and device authorization are implemented.

- `GET /api/v1/health`
- `GET /api/v1/setup/status`
- `POST /api/v1/setup/owner` — only succeeds while the users table is empty; create a strong owner password.
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` — requires `Authorization: Bearer <token>`.
- `POST /api/v1/auth/logout` — requires the same bearer header.

The owner bootstrap endpoint is intended for first-run setup on the local machine. Do not expose the API to a LAN or public network.

## Development and validation

Requires Node.js 24 and a supported native build toolchain for better-sqlite3.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

The committed package-lock.json pins the dependency graph for reproducible installs.

By default, Windows data is stored under %ProgramData%\\AL-NASR\\data\\alnasr.sqlite; other operating systems use ~/.local/share/al-nasr/data/alnasr.sqlite. Set AL_NASR_DATABASE_PATH to override it for tests or development.

## Not yet implemented

This remains a backend foundation, not the complete ERP. POS user interface and payment capture, returns/refunds, accounting journals and reconciliation, shifts/cash management, full product/customer/supplier APIs, React renderer, Electron lifecycle, Android app, secure LAN pairing/TLS, backup/restore, Windows installer, and clean-machine/hardware acceptance are still outstanding.
