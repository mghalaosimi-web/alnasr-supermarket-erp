# ADR-0002: SQLite local-first architecture without Docker

**Status:** Accepted — target architecture  
**Date:** 2026-11-15  
**Supersedes:** The provisional ERPNext/Frappe + MariaDB + Redis + Docker deployment baseline in ADR-0001 / `docs/architecture/BASELINE.md`.

## Context

The product owner has explicitly selected a fully local Windows deployment with SQLite and no Docker. The current ERPNext/Frappe stack depends on MariaDB and Redis and does not support SQLite as its persistence backend. Changing a connection string cannot make ERPNext compatible with SQLite.

The existing ERPNext/Frappe/X POS work and its passing CI results remain historical engineering evidence. They do not prove that the new SQLite application exists, and they must not be represented as tests of the replacement architecture.

## Decision

Build AL-NASR as a local-first application with one authoritative SQLite database hosted by the Windows PC.

- **Windows UI:** React + TypeScript, packaged as an AL-NASR Electron desktop application.
- **Local application/API host:** TypeScript running in the Electron main process, exposing a versioned Fastify REST API.
- **Persistence:** SQLite through `better-sqlite3`, with explicit migrations, foreign keys, WAL mode, busy timeout, integrity checks, and transactional domain operations.
- **Database location:** machine-wide application data directory, e.g. `%ProgramData%\\AL-NASR\\data\\alnasr.sqlite`; never store the live database inside the install directory or Electron ASAR.
- **Android:** native Kotlin client connecting to the Windows host over the store's private Wi-Fi/LAN. The phone is a client, not a second authority or a direct SQLite file editor.
- **Offline behavior:** the Windows PC is authoritative and remains fully usable without internet. Android may queue eligible operations while disconnected and submit them with stable idempotency keys after reconnecting. The queue must expose pending, accepted, rejected, and conflict states; no silent data loss.
- **Distribution:** Windows installer includes the application runtime and required dependencies. No Docker, WSL2, MariaDB, Redis, external Node.js installation, or internet connection is required for normal local use.

## Runtime topology

```text
Windows PC
  AL-NASR Electron (React UI)
       |
  Embedded Fastify API
       |
  Domain services + authorization
       |
  SQLite (single authoritative file)
       ^
       | HTTPS over private LAN, paired device
Android Kotlin client
```

The API listens on loopback for the Windows UI and on the private LAN interface only when LAN access is enabled. It must not expose an unauthenticated public listener.

## LAN security and pairing

- Use HTTPS for Android-to-PC traffic. Generate a per-installation server certificate and pin its public-key fingerprint in the paired Android client.
- Pair a device through a one-time, short-lived pairing code or QR code displayed by an authenticated Windows administrator.
- Issue a revocable device credential scoped to the store and device; rotate/revoke credentials from the Windows owner settings.
- Do not disable TLS verification, trust every certificate, or silently downgrade financial operations to cleartext HTTP.
- Bind LAN access to private network interfaces, require authentication and authorization on every API operation, rate-limit pairing, and record security/audit events.
- If secure certificate provisioning/pinning cannot be completed, Android LAN access remains disabled rather than falling back to insecure transport.

## Data integrity and business rules

- All financial and inventory mutations execute in SQLite transactions.
- Use integer minor units for monetary amounts where currency precision permits; define explicit rounding rules and never use binary floating-point for posted ledger amounts.
- Enforce unique document numbers, foreign keys, check constraints, and append-only audit events for posted financial documents.
- Use idempotency keys for sale creation, payment posting, returns, and Android replay.
- Posted documents are corrected through reversals/credit notes/returns, not destructive edits.
- Use a durable outbox/inbox for Android queued operations, with server-side deduplication and explicit conflict responses.
- Define a single-writer policy for the database. Android never opens the SQLite file over SMB or a shared folder.

## Required modules

1. Identity, users, roles, permissions, sessions, and audit log.
2. Product catalog, categories, units, variants, and multiple barcodes.
3. Warehouses, stock ledger, receipts, transfers, counts, adjustments, and valuation.
4. POS, cashier shifts, cash movements, sales, discounts, taxes, payments, receipts, returns, and refunds.
5. Purchasing, suppliers, purchase orders, goods receipt, supplier invoices, and supplier returns.
6. Customers, credit limits, balances, collections, and loyalty.
7. Accounting, chart of accounts, journals, cash/bank accounts, reconciliation, trial balance, profit/loss, and balance sheet.
8. Reports, settings, backup/restore, import/export, and device management.

The module list is the acceptance scope, not a claim that each module is already implemented.

## Migration strategy

- Keep the existing ERPNext/Frappe/X POS source and PRs intact as a historical baseline; do not merge or delete them as part of this ADR.
- Implement the SQLite product in a separate branch and new application boundaries. Do not attempt to point ERPNext at SQLite.
- Reuse business requirements and validated test scenarios, not framework-specific persistence code or unverified claims.
- Do not import production/customer data. Any future migration must be a separate, explicitly approved, reconciled process.

## Windows installation and operations

The installer must:
- install without Docker, WSL2, MariaDB, Redis, Python, or a separately installed Node.js;
- create protected data, logs, backup, and certificate directories outside the installation directory;
- initialize or migrate the SQLite schema safely;
- create desktop/start-menu shortcuts and a clear first-run owner setup;
- start/stop the local API with the desktop app and recover cleanly after app/PC restart;
- preserve business data across application upgrades and uninstall; data deletion must require a separate explicit owner action;
- provide validated backup and restore with integrity verification;
- support offline installation from the installer package alone.

## Quality gates — no release claim before evidence

1. Unit and integration tests for migrations, transactions, inventory valuation, POS totals, tax rounding, returns, accounting postings, permissions, and idempotency.
2. Property/invariant tests: stock cannot become negative unless explicitly configured; debits equal credits; posted documents cannot be silently duplicated; return quantities cannot exceed source quantities.
3. Crash/restart tests during sale posting and database writes; SQLite integrity check after recovery.
4. Backup/restore test on a clean Windows VM, including checksum and restored row/document counts.
5. LAN pairing, TLS pinning, device revocation, Wi-Fi loss/reconnect, duplicate replay, and conflict tests on a real Android device.
6. Hardware acceptance for barcode scanner, thermal printer, cash drawer, and supported scales.
7. Full business acceptance: purchase → receipt → stock → sale → return → cash close → accounting reconciliation.
8. Installer acceptance on clean Windows 10/11 x64 machines without developer tools or internet.

## Explicit non-goals

- No Docker or WSL2.
- No ERPNext/Frappe runtime in the final SQLite product.
- No MariaDB or Redis.
- No mandatory cloud account or internet dependency.
- No direct shared-file access to SQLite from Android.
- No claim of parity with ERPNext until every required AL-NASR workflow passes acceptance tests.

## Consequences

This is a replacement application, not a deployment tweak. The existing ERPNext baseline provides product research and test scenarios, but the SQLite domain model, API, UI, Windows runtime, Android client, migration system, and packaging must be implemented and independently tested. The delivery timeline and completion percentage must be recalculated from this decision.
