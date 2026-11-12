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
- Local-network operation with a controlled offline workflow and later synchronization
- Desktop, tablet, and phone access

## Intended technical foundation

- **ERPNext / Frappe v16** for ERP, inventory, purchasing, accounting, users, permissions, and APIs.
- **X POS v16** as the selected POS candidate for evaluation.
- **AL-NASR custom Frappe app** for supermarket-specific workflows, configuration, integrations, Arabic product experience, and original branding.

The upstream source revisions are pinned in [UPSTREAM-LOCK.md](docs/architecture/UPSTREAM-LOCK.md). This is an engineering baseline under verification, not a declaration that every feature is already implemented or production-ready.

## Architecture principles

1. Keep ERPNext core unmodified; implement AL-NASR-specific behavior in custom Frappe apps and supported extension points.
2. Keep upstream components identifiable and their original license/copyright notices intact.
3. Separate the AL-NASR commercial identity from upstream project names, logos, and trademarks.
4. Do not treat browser offline caching as equivalent to multi-terminal LAN synchronization.
5. Never silently discard queued offline sales; use idempotent synchronization, conflict review, and audit trails.
6. No production secrets, customer data, credentials, or database dumps belong in this repository.
7. Do not claim complete rebranding until every owned surface in the brand implementation matrix has passed visual and functional review.

## Repository status

**Status: Foundation and initial brand assets / not production-ready.**

- Repository initialized and custom Frappe app scaffold created.
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
