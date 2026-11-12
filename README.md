# النصر | AL-NASR

**نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة**

AL-NASR is an independently branded supermarket and retail management product. The repository will contain the AL-NASR custom application, integration code, deployment configuration, documentation, and verified upstream components.

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

## Intended technical foundation

The current candidate foundation is:

- **ERPNext / Frappe v16** for ERP, inventory, purchasing, accounting, users, permissions, and APIs.
- **X POS v16** as the current POS candidate because its version-16 branch documents Electron desktop operation, local data storage, offline selling, and a hub-and-spoke multi-terminal mode.
- **AL-NASR custom Frappe app** for supermarket-specific workflows, Arabic product experience, configuration, integrations, and branding.

This is an engineering baseline under verification, not a declaration that every feature is already implemented or production-ready. The exact upstream revisions and compatibility matrix will be pinned before deployment.

## Architecture principles

1. Keep ERPNext core unmodified; implement AL-NASR-specific behavior in custom Frappe apps and supported extension points.
2. Keep upstream components identifiable and their original license/copyright notices intact.
3. Separate the AL-NASR commercial identity from upstream project names, logos, and trademarks.
4. Do not treat browser offline caching as equivalent to multi-terminal LAN synchronization.
5. Never silently discard queued offline sales; use idempotent synchronization, conflict review, and audit trails.
6. No production secrets, customer data, credentials, or database dumps belong in this repository.

## Repository status

**Status: Foundation evaluation / not production-ready.**

- Repository initialized.
- ERPNext v16 and POS candidates are being checked for compatibility and operational fit.
- No live store data or production credentials are stored here.
- Installation, offline recovery, LAN multi-terminal synchronization, mobile behavior, barcode hardware, thermal printing, and accounting flows require integration tests before release.

## Upstream references

- [ERPNext](https://github.com/frappe/erpnext) — GNU GPL v3.0
- [X POS](https://github.com/kodlyft/xpos) — MIT License; candidate branch: version-16
- [Original POS Awesome](https://github.com/ucraft-com/POS-Awesome) — GNU GPL v3.0; its README advertises ERPNext v14, so it is not the default v16 choice.

See [docs/architecture/BASELINE.md](docs/architecture/BASELINE.md) for the initial platform decision and known limitations.

## License and attribution

This repository may contain components under different licenses. Their upstream LICENSE files, copyright notices, and attribution requirements must be preserved. Do not assume that the entire repository is covered by one license until the component and distribution model has been reviewed.
