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
- **Upstream integration compatibility decisions:** [Compatibility overrides](docs/architecture/COMPATIBILITY-OVERRIDES.md).

## Product scope

- Point of Sale (POS), cashier shifts, receipts, barcode scanning, returns, and promotions
- Product catalog with hierarchical item groups, variants, units of measure, and multiple barcodes
- Inventory, stock ledger, warehouses, batches, serial numbers, and stock transfers
- Purchasing, suppliers, purchase orders, goods receipt, and supplier invoices
- Sales, customers, credit limits, customer balances, and loyalty
- Accounting, cash management, payment reconciliation, and financial reports
- Multi-warehouse and multi-branch operations with role-based access control
- Arabic RTL and English LTR interfaces
- Local-network operation with a controlled offline workflow and later synchronization
- Desktop, tablet, and phone access

## Target technical foundation (new direction)

The target runtime is a native Windows desktop application:

- **Electron + bundled Chromium** for the Windows desktop shell and offline installer.
- **React + TypeScript** for the Arabic RTL / English LTR user interface.
- **Node.js LTS** for local business services and the authenticated LAN API.
- **SQLite** as the sole local operational database.
- **Electron Builder / NSIS** for a conventional single-file Windows installer.
- **Android companion** connects to the Windows host API over the local network; it never opens the SQLite file directly.

ERPNext, Frappe and X POS are no longer runtime dependencies in the target architecture. Their source and existing acceptance scenarios may be consulted as functional references only, subject to license obligations. SQLite cannot be substituted underneath ERPNext/Frappe by changing a connection setting.

Read [the native Windows + SQLite architecture decision](docs/architecture/NATIVE-WINDOWS-SQLITE-ADR.md). The new desktop scaffold is under `desktop/`. It is an early implementation, not a production-ready system or a completed installer.

## Historical upstream prototype

The repository retains the earlier Frappe / ERPNext / X POS integration baseline and pinned upstream revisions for reference and audit. Those components are not part of the new target runtime. Existing Docker and WSL installer prototypes are historical, unmerged drafts and must not be represented as the final offline product.

## Architecture principles

1. SQLite is opened only by the Windows host process; Android and other clients communicate through an authenticated API.
2. Core business operations must work without internet access.
3. Use transactions, immutable stock/accounting ledgers, idempotency keys and auditable corrections.
4. Preserve owner data across upgrades and ordinary uninstall; backups must be verified.
5. Keep LAN access disabled or loopback-only until explicitly enabled and paired by the owner.
6. No production secrets, customer data, credentials, signing keys or database dumps belong in this repository.
7. Do not claim release readiness until clean-machine offline installation, real business workflows, LAN/Android and recovery acceptance all pass.

## Repository status

**Status: Foundation and initial brand assets / not production-ready.**

- Repository initialized and custom Frappe app scaffold created.
- Frappe, ERPNext, and X POS are pinned as recursive Git submodules; GitHub Actions verified their exact upstream commit SHAs.
- A clean disposable Bench integration passed on 2026-11-14: all three apps installed, migrations completed on temporary MariaDB, application contracts and HTTP health passed. See [runtime integration run #43604127743](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43604127743).
- Initial AL-NASR brand wordmark, mark, favicon, and brand documentation added.
- Custom app metadata is branded; full ERPNext/X POS screen, receipt, email, login, and desktop-client branding remains to be integrated and tested.
- Installation, offline recovery, LAN multi-terminal synchronization, mobile behavior, barcode hardware, thermal printing, and accounting flows require integration tests before release.

## Upstream references

- [ERPNext](https://github.com/frappe/erpnext) — GNU GPL v3.0
- [Frappe Framework](https://github.com/frappe/frappe) — MIT License
- [X POS](https://github.com/kodlyft/xpos) — MIT License; selected candidate branch: version-16
- [Original POS Awesome](https://github.com/ucraft-com/POS-Awesome) — GNU GPL v3.0; not the default v16 choice.

## License and attribution

This repository may contain components under different licenses. Preserve all upstream LICENSE files, copyright notices, and attribution requirements. Do not assume that the entire repository is covered by one license until the component and distribution model has been reviewed.
