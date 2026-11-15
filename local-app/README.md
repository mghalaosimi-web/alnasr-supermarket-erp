# AL-NASR Local Runtime — initial SQLite foundation

This directory is the beginning of the replacement local-first runtime accepted in [ADR-0002](../docs/architecture/ADR-0002-sqlite-local-first-no-docker.md).

## Current scope

- SQLite database path outside the installation directory.
- Foreign keys, WAL, FULL synchronous writes, and a bounded busy timeout.
- Initial schema for stores, roles, users, audit events, warehouses, products/barcodes, customers, suppliers, stock ledger, sales, sale lines, and payments.
- Initial local Fastify health endpoint at `/api/v1/health`.
- Schema-level tests for core tables, seeded roles, and sale idempotency uniqueness.

This is a foundation only. Authentication, authorization enforcement, business services, complete accounting, inventory posting, Android pairing, TLS, Electron lifecycle, backup/restore, and installer packaging are not implemented yet.

## Development

Requires Node.js 24 and a supported native build toolchain for `better-sqlite3`.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

By default the database is stored under `%ProgramData%\\AL-NASR\\data\\alnasr.sqlite` on Windows or `~/.local/share/al-nasr/data/alnasr.sqlite` elsewhere. Set `AL_NASR_DATABASE_PATH` to override it for tests or development.

The API binds to loopback by default. Do not expose it to a LAN until authenticated HTTPS pairing and authorization are implemented.
