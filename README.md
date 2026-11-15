# النصر | AL-NASR

**نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة**

**AL-NASR — Integrated Supermarket, Retail & Wholesale Management System**

AL-NASR is an independently branded supermarket and retail-management product for **نصر عثمان عبدالله العصيمي**. Its Arabic-first experience is designed for supermarket operations from small-item retail to wholesale workflows.

## Product identity

- **Arabic name:** النصر
- **English name:** AL-NASR
- **Owner:** نصر عثمان عبدالله العصيمي
- **Product description:** نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة.
- **Languages:** Arabic RTL first, with English LTR support.
- **Brand assets and usage:** [Brand guidelines](docs/brand/BRAND-GUIDELINES.md).
- **Branding coverage and remaining work:** [Brand implementation matrix](docs/brand/BRAND-IMPLEMENTATION-MATRIX.md).

## Product scope

- Point of Sale (POS), cashier shifts, receipts, barcode scanning, returns, and promotions
- Product catalog with hierarchical item groups, variants, units of measure, and multiple barcodes
- Inventory, stock ledger, warehouses, batches, serial numbers, and stock transfers
- Purchasing, suppliers, purchase orders, goods receipt, and supplier invoices
- Sales, customers, credit limits, customer balances, and loyalty
- Accounting, cash management, payment reconciliation, and financial reports
- Multi-warehouse and multi-branch operations with role-based access control
- Arabic RTL and English LTR interfaces
- Fully local operation without internet; Android access over private Wi-Fi/LAN
- Windows desktop and Android client

## Accepted target architecture

**SQLite local-first — no Docker.** The accepted architecture is recorded in [ADR-0002](docs/architecture/ADR-0002-sqlite-local-first-no-docker.md).

- **Windows desktop:** React + TypeScript packaged with Electron.
- **Local API:** TypeScript + Fastify hosted by the Windows desktop runtime.
- **Database:** one authoritative local SQLite database using `better-sqlite3`, migrations, transactions, and integrity checks.
- **Android:** native Kotlin client connecting to the Windows PC over authenticated HTTPS on the private LAN.
- **Offline:** Windows works without internet. Android queues eligible operations while disconnected and replays them using idempotency keys after reconnecting.
- **No Docker, WSL2, MariaDB, Redis, cloud account, or separately installed Node.js** is required for normal local operation.

The previous ERPNext/Frappe + MariaDB + Redis baseline is superseded. It remains in the repository as historical research and CI evidence only; it is not the target runtime and cannot be made SQLite-compatible by changing a connection string.

## Architecture and integrity principles

1. Keep one authoritative SQLite database on the Windows host; Android must never open the database file directly or over a shared folder.
2. Execute inventory and financial mutations transactionally and preserve an auditable history.
3. Use idempotency keys and durable synchronization queues to prevent duplicate Android replay.
4. Never silently discard queued offline operations; expose pending, accepted, rejected, and conflict states.
5. Posted financial documents are corrected through reversals/returns, not destructive edits.
6. Protect LAN access with HTTPS, explicit device pairing, revocable credentials, and authorization on every operation.
7. Keep business data, credentials, signing keys, and production configuration out of Git.
8. Do not claim a module or installer is complete until its acceptance tests pass on the target environment.

## Repository status

**Status: Existing ERPNext foundation retained; SQLite replacement architecture accepted; replacement implementation not yet complete.**

- Existing Frappe/ERPNext/X POS source pins, custom app, and historical CI runs remain available for reference.
- The historical disposable integration run reported 1,268 passing test executions on its tested revision. Those results validate that historical ERPNext-based baseline only; they do not validate the new SQLite architecture.
- The prior Windows installer and Android artifacts were built from the previous packaging approach and must not be treated as final AL-NASR SQLite deliverables.
- The accepted SQLite architecture and required quality gates are documented in [ADR-0002](docs/architecture/ADR-0002-sqlite-local-first-no-docker.md).
- The next work is to create the new application workspace, schema/migrations, domain services, local API, React desktop shell, Android LAN pairing/client, and clean-machine installer tests.

## Historical upstream references

These projects informed the previous ERPNext-based prototype and are not dependencies of the accepted SQLite target:

- [ERPNext](https://github.com/frappe/erpnext) — GNU GPL v3.0
- [Frappe Framework](https://github.com/frappe/frappe) — MIT License
- [X POS](https://github.com/kodlyft/xpos) — MIT License
- [Original POS Awesome](https://github.com/ucraft-com/POS-Awesome) — GNU GPL v3.0

## License and attribution

This repository contains historical components under different licenses. Preserve upstream LICENSE files, copyright notices, and attribution requirements for retained source. Review the license of each component before reuse or distribution. The new SQLite application must declare and audit its own dependencies and licenses before release.
