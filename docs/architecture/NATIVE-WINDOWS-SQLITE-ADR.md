# ADR: Native Windows Desktop with Local SQLite

- **Status:** Proposed target architecture; implementation and acceptance tests pending.
- **Date:** 2026-11-14
- **Supersedes:** Docker Desktop runtime path (PR #4) and WSL2-host prototype (PR #5) as target architecture for the requested single-PC offline product. Both PRs remain historical, unmerged drafts.
- **Decision owner:** AL-NASR product owner.

## 1. Product requirement

Deliver one Windows installer EXE that installs and runs AL-NASR on a supported Windows PC without internet, Docker Desktop, Docker Engine, WSL, a cloud database, or a separately administered server. The PC owns the local database and exposes a controlled API to companion Android devices on the same LAN.

The installer must contain the application runtime and all application dependencies required for first launch. Windows itself remains a platform prerequisite: supported Windows version, CPU architecture, storage, and normal installer permissions are required. The installer cannot bundle or replace Windows OS components or firmware capabilities.

## 2. Decision

Build a native desktop product using:

- Electron as the Windows desktop shell and bundled Chromium runtime.
- React + TypeScript for the complete Arabic-first RTL / English LTR interface.
- Node.js LTS in the Electron main process for application services and the LAN API.
- SQLite as the sole operational database, stored locally on the Windows host.
- better-sqlite3 as the SQLite driver, subject to native-module rebuild and Windows packaging tests.
- Electron Builder / NSIS to produce a conventional single-file Windows installer (Next / Install / Finish). The installer embeds the app, Electron runtime, native database binding, and frontend assets.
- Capacitor Android (or the existing verified Android shell after repository audit) as the phone client. Android communicates with the PC over the AL-NASR API; it never opens the SQLite database file directly.

This is a deliberate reimplementation of product business capabilities, not a database switch for ERPNext.

## 3. Explicitly rejected approaches

1. ERPNext/Frappe on SQLite: unsupported. ERPNext/Frappe's supported database architecture depends on MariaDB; changing a connection string does not make it SQLite-compatible.
2. Docker / WSL / Docker Desktop: not part of the target runtime.
3. SQLite file shared over SMB/Wi-Fi: prohibited. Only the Windows host process opens the database file; clients use the API.
4. Cloud database as a runtime dependency: prohibited. Core sales, inventory and accounting workflows must work without internet.

ERPNext, Frappe and X POS may be used as functional reference material for workflows and acceptance coverage, subject to their respective licenses. They are not runtime dependencies in this architecture.

## 4. Runtime topology

```text
Windows PC
  AL-NASR.exe (Electron + bundled Chromium)
    React UI
    Electron main process
      Domain services
      Authentication / RBAC
      Local LAN API (disabled or loopback-only by default)
      Backup / restore / update coordinator
      SQLite repository
        %ProgramData%\AL-NASR\data\alnasr.sqlite

Android phone(s)
  AL-NASR Android app
    HTTPS API client
      Wi-Fi / LAN
        Windows PC API
```

The Windows application is the single source of truth. LAN access is explicitly enabled by the owner, protected by authenticated sessions and role permissions, and restricted by Windows Firewall to private networks. The API must not bind to public interfaces by default. Use a pairing flow and a locally trusted certificate before exposing sensitive data over HTTPS.

## 5. SQLite operational rules

- Enable PRAGMA foreign_keys=ON on every connection.
- Use WAL mode for normal operation and configure a bounded busy_timeout.
- Use explicit transactions for every business operation that changes multiple records.
- Keep a single controlled write path in the host process; do not create a connection per UI component.
- Use schema migrations with immutable, ordered migration IDs and a migration ledger.
- Store monetary values as integer minor units; never use binary floating point for money.
- Store timestamps in a consistent UTC representation and render in the configured local timezone.
- Use append-only stock movements, payment events and accounting journal entries; correct mistakes with reversal/adjustment records, not silent mutation of history.
- Use stable UUID/ULID identifiers for records that may be created on Android while temporarily disconnected.
- Create backups using SQLite's online backup mechanism or a consistent checkpoint-and-copy procedure. Verify every backup by opening it and running PRAGMA integrity_check.
- Keep database files, backups and logs outside the installation directory so upgrades and uninstall do not erase owner data.
- Apply Windows ACLs to the data directory. Do not claim database-at-rest encryption unless a separately reviewed, tested encryption implementation is included.

SQLite is suitable for the initial single-PC host and a modest number of LAN clients when writes are serialized. It is not a multi-writer distributed database. Load testing must establish practical client and transaction limits before release.

## 6. Offline and synchronization behavior

- The Windows host must complete first-run setup, database creation, migrations, and normal business operations without internet access.
- Android may cache permitted read data and queue explicitly supported offline actions with idempotency keys.
- On reconnect, the API validates authorization, deduplicates requests and applies domain-specific conflict rules. A sale must never be silently dropped or double-posted.
- Financial and stock-changing operations require server acknowledgement before being represented as committed to the central ledger.
- Define conflict handling per entity; do not implement blind last-write-wins for stock, cash, invoices or accounting records.

## 7. Data model boundaries

The first vertical slice must include:

- Business settings and branches (single business initially).
- Users, roles, permissions, sessions and audit events.
- Products, categories, units, barcodes and price lists.
- Warehouses, stock balances derived from a stock movement ledger, and stock transfers.
- Customers, suppliers and payment methods.
- Sales, sale lines, discounts, returns, payments and cashier shifts.
- Purchases, receipts and supplier balances.
- Cash movements and double-entry accounting journals.
- Number sequences, tax/configuration settings, and print templates.

Do not build every module in one untestable batch. Deliver vertical slices with migrations, domain tests, UI tests and business acceptance scenarios.

## 8. Security requirements

- Electron renderer uses context isolation, sandboxing, and no Node integration.
- Expose a narrow, typed preload API; validate all IPC payloads.
- Treat all LAN requests as untrusted; authenticate, authorize per operation, validate schemas, rate-limit login attempts and audit privileged actions.
- Store password hashes using a modern password-hashing algorithm with per-user salts; never store plaintext passwords.
- Generate and rotate session tokens securely; do not put secrets in renderer storage.
- LAN listener starts loopback-only until the owner enables pairing/LAN mode.
- Firewall rules are narrow and removable on uninstall; do not silently open public-network access.
- Do not bundle signing keys, production credentials or customer data.

## 9. Installer and lifecycle requirements

The installer must:
1. Verify Windows version, x64 architecture, available disk space and permissions.
2. Install all application-owned runtime files from the local EXE payload; no network downloads.
3. Create the data directory and initial database on first launch, not during a potentially interrupted file-copy phase.
4. Create a desktop/start-menu shortcut and register a clean uninstall path.
5. Preserve the database and backups during application upgrades and ordinary uninstall; offer a separate, explicit data-removal action.
6. Apply database migrations transactionally and create a verified pre-migration backup.
7. Support rollback to the previous application version if startup health checks fail.
8. Produce a signed release installer when owner-controlled signing credentials are available. CI preview builds may remain unsigned and must be labeled as such.

## 10. Release acceptance gates

No release may be called complete until all gates pass with recorded evidence:

- Clean Windows 11 x64 install on a machine with internet physically disconnected.
- No Docker, WSL, Docker Desktop, Node.js or developer tooling installed on the target PC.
- First launch creates the local database and completes migrations offline.
- Restart, shutdown and power-loss recovery tests preserve committed transactions.
- Sales, returns, purchasing, inventory, shifts and accounting workflows pass.
- Concurrent LAN clients pass load and consistency tests with documented limits.
- Android physical-device pairing, authentication, reconnect and duplicate-request tests pass.
- Backup, restore, upgrade, rollback and uninstall/data-preservation tests pass.
- Arabic RTL, English LTR, barcode scanner, receipt printer and cash-drawer acceptance tests pass where hardware is in scope.
- Security review, dependency/license inventory, SBOM and installer hash verification complete.

## 11. Migration from the previous prototype

The old ERPNext/Frappe Docker and WSL prototypes are not migrated into this runtime. Rebuild domain behavior in the native application and use their existing acceptance scenarios as a requirements checklist. No existing production data migration is assumed. If real business data exists in a prototype, inventory and export it through a separately approved, validated migration plan.

## 12. Immediate implementation sequence

1. Audit the current repository and identify reusable React UI, Android shell, brand assets, acceptance tests and upstream-derived code.
2. Create the Electron + React + TypeScript workspace and Windows packaging pipeline.
3. Implement SQLite connection lifecycle, migrations, repository layer, audit log and automated integrity/backup tests.
4. Deliver the first vertical slice: products + barcode + inventory + cashier shift + sale + receipt.
5. Add purchases, customers/suppliers, returns, accounting and reports in tested slices.
6. Add authenticated LAN API and Android pairing/client.
7. Build and test the single offline installer on a clean Windows VM with network disabled.

**Current status:** architecture decision recorded only. No native SQLite runtime, Windows EXE, Android LAN pairing, or clean-machine offline acceptance is claimed by this ADR.
