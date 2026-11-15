## Windows-first delivery priority

The active Phase 1 client target is now **Windows desktop first**. Android implementation is frozen until Windows installation, offline operation, core ERP workflows, backup/restore, upgrade, and clean-machine acceptance are complete. The existing Android preview source is preserved; its CI is manual-only during this freeze.

See [Windows-first Phase 1 execution plan](docs/implementation/WINDOWS-FIRST-EXECUTION-PLAN.md). The old `deploy/windows/installer.iss` is intentionally blocked because it installs the superseded Docker/ERPNext stack; it is not the SQLite Windows installer.

# النصر | AL-NASR

**نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة**

**AL-NASR — Integrated Supermarket, Retail & Wholesale Management System**

AL-NASR is an independently branded supermarket and retail-management product. The accepted implementation target is an Arabic-first local Windows ERP with SQLite as its authoritative database and an Android companion connected only through a secured LAN API.

## Product identity

- **Arabic name:** النصر
- **English name:** AL-NASR
- **Languages:** Arabic RTL first, with English LTR support.
- **Brand assets and usage:** [Brand guidelines](docs/brand/BRAND-GUIDELINES.md).
- **Branding coverage and remaining work:** [Brand implementation matrix](docs/brand/BRAND-IMPLEMENTATION-MATRIX.md).

## Product scope

The intended product scope includes POS, sales, returns, purchase receiving, inventory and stock transfers, customer and supplier accounts, cash registers and shifts, double-entry accounting, reports, audit, backups, device management, Arabic RTL/English LTR interfaces, Windows desktop installation, and a secured Kotlin Android companion. This is the acceptance scope, not a claim that all those modules are currently implemented.

## Accepted target architecture

**SQLite local-first — no Docker.** The accepted architecture is [ADR-0002](docs/architecture/ADR-0002-sqlite-local-first-no-docker.md).

- **Windows desktop:** React + TypeScript packaged with Electron.
- **Local API:** TypeScript + Fastify managed by the Windows desktop runtime.
- **Database:** one authoritative local SQLite database using `better-sqlite3`, versioned migrations, transactions, and integrity checks.
- **Android:** native Kotlin client connecting to the Windows PC over authenticated HTTPS on the private LAN.
- **Ordinary local operation:** no Docker, WSL2, MariaDB, MySQL, Redis, mandatory cloud services, or separately installed Node.js/Python.
- **Data:** persistent store data and backups remain outside the application installation directory.

The former ERPNext/Frappe + MariaDB + Redis + Docker design is superseded by ADR-0002. Its source, submodules, and CI records remain historical research and are not evidence that the SQLite replacement implements equivalent functionality.

## Verified implementation snapshot — 2026-11-15

**Status: SQLite backend foundation implemented and CI-verified; Phase 1 is not complete.**

The current `local-app/` is a TypeScript/Fastify backend foundation. It includes SQLite schema migrations v1–v4; database durability/integrity settings; one-time owner setup; scrypt password hashing; hashed bearer sessions, expiration/revocation and seeded RBAC; product create/list; customer and supplier master-data CRUD; stock balance and adjustment ledger; sale draft/post; partial sale-payment allocation with idempotency and audit; purchase draft/receipt; and verified online database backup creation.

The latest inspected local-runtime workflow is [run 43748469553](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43748469553) on source head `8b65139cfa1fe3d48f2cd5babdae6595daaeac5e`. It passed dependency installation, Typecheck, all 9 test files / 35 tests, and TypeScript build, including schema-v3-to-v4 migration and partial sale-payment tests. This validates only `local-app/`; it is not whole-product acceptance.

The Android Gradle validation workflow [run #48](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43747506964) passed on the same PR head and uploaded the debug-preview artifact `AL-NASR-Android-Debug-Preview` for controlled device testing. This is not a production release or device-acceptance result.

An Android Kotlin/Gradle WebView preview project exists, but it is not yet a secure Fastify API companion: it lacks the required pairing protocol, certificate/public-key pinning, device registration/revocation, API session integration, and synchronization workflows. The old `deploy/windows` Inno Setup/PowerShell scaffold still packages the superseded Docker/ERPNext stack; it is not a SQLite Windows installer.

## Major Phase 1 work still outstanding

- Full domain schema and workflows for customers, suppliers, payments/allocations, returns/refunds, cash registers, shifts, and accounting journals.
- Double-entry posting, receivable/payable reconciliation, inventory valuation, and data-backed operational/financial reports.
- Restore, scheduled backups, retention and disaster-recovery validation.
- Complete React desktop frontend with real API integration, localization, RTL/LTR and screen-level tests.
- Electron main/preload/lifecycle, secure IPC, tray/single-instance behavior, persistent data-path management and Windows NSIS installer.
- Secure Kotlin Android REST client, TLS fingerprint verification, pairing, device revocation, authorization-scoped workflows and tested sync behavior.
- CI coverage for the entire application, Windows packaging, Android build and external acceptance.
- Clean Windows installation/upgrade/uninstall testing, physical Android/LAN testing and peripheral acceptance.

## Project status and execution record

- **Implementation PR:** [#7](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/pull/7) — open, Draft, not merged.
- **Authorized branch:** `architecture/sqlite-offline-no-docker`.
- **Detailed evidence and remaining work:** [Phase 1 execution status](docs/implementation/PHASE-1-EXECUTION-STATUS.md).
- **Architecture source of truth:** [ADR-0002](docs/architecture/ADR-0002-sqlite-local-first-no-docker.md).

Do not treat the historical ERPNext/X POS test totals, upstream Electron packaging, or an Android WebView preview as proof that a SQLite-based AL-NASR installer and companion app are ready.

## Historical upstream references

These projects informed the former ERPNext-based prototype and are not runtime dependencies of the accepted SQLite target:

- [ERPNext](https://github.com/frappe/erpnext) — GNU GPL v3.0
- [Frappe Framework](https://github.com/frappe/frappe) — MIT License
- [X POS](https://github.com/kodlyft/xpos) — MIT License
- [Original POS Awesome](https://github.com/ucraft-com/POS-Awesome) — GNU GPL v3.0

## License and attribution

This repository contains historical components under different licenses. Preserve upstream LICENSE files, copyright notices, and attribution requirements for retained source. Review the license of each component before reuse or distribution. Audit and publish the license inventory of the SQLite application's dependencies before release.
