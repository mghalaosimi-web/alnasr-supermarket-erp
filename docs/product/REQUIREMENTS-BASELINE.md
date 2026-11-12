# AL-NASR product requirements baseline

**Status:** Initial scope baseline; requirements need owner validation before production.
**Product:** النصر | AL-NASR
**Business owner:** نصر عثمان عبدالله العصيمي

## 1. Product objective

Deliver a reliable supermarket and retail management system that supports small-item retail through wholesale operations, with Arabic-first usability, barcode-based checkout, auditable stock and accounting, and resilient local-network operation.

## 2. Functional domains

### Catalog and pricing
- Hierarchical item groups and categories.
- Stock and non-stock items, variants, multiple units of measure and conversion factors.
- Multiple barcodes per item and unit.
- Cost, retail, wholesale, tiered and customer-specific prices.
- Price lists, promotions, discounts, expiry dates, and approval thresholds.

### Point of sale
- Fast barcode-first checkout and keyboard operation.
- Cashier shifts, opening float, cash in/out, closing count and variance.
- Multiple payment methods and split tender.
- Returns, exchanges, voids, refunds and manager approvals.
- Printed and electronic receipts.
- Suspended carts and customer lookup.
- Offline queue only where the selected POS implementation proves safe transaction durability and reconciliation.

### Inventory and supply
- Multiple warehouses and branches.
- Receipts, issues, transfers, adjustments and stock counts.
- Batch/expiry and serial tracking where required.
- Reorder levels and replenishment.
- Supplier records, purchase orders, goods receipts, purchase invoices and returns.
- Traceable stock ledger and valuation.

### Sales and customers
- Walk-in and named customers.
- Customer balances, credit limits and due-date tracking.
- Retail and wholesale workflows.
- Sales orders, invoices, returns and delivery where applicable.
- Loyalty only after core accounting and privacy requirements are validated.

### Finance and control
- Cash and bank accounts, payment reconciliation and expenses.
- Chart of accounts and cost centers.
- Daily sales, gross margin, stock valuation, cashier variance and receivables reports.
- Role-based permissions and separation of duties.
- Immutable audit trail for sensitive actions.

### Operations
- Multiple tills connected over local network.
- Backup and tested restore procedures.
- Arabic RTL and English LTR.
- Responsive tablet/phone access.
- Import/export templates with validation and error reports.

## 3. Non-functional requirements

- No silent loss or duplication of sales during retry or synchronization.
- Idempotency keys for transaction synchronization.
- Explicit conflict handling and an auditable reconciliation queue.
- Least-privilege roles; privileged overrides require a reason and audit event.
- No credentials or live business data in source control.
- All monetary values use currency-aware decimal arithmetic, never binary floating-point for financial calculations.
- Timezone, currency, tax and rounding rules must be configured for the actual business jurisdiction before go-live.
- Backups must be encrypted, access-controlled and restore-tested.

## 4. Release gates

1. Confirm business workflows, units, taxes, currency, branches, warehouses and payment methods with the owner.
2. Complete upstream source import and license inventory.
3. Pass clean install and migration tests on the pinned Frappe/ERPNext v16 versions.
4. Pass POS checkout, return, shift, payment, stock ledger and accounting integration tests.
5. Pass offline/LAN outage, retry, duplicate prevention, conflict and power-loss recovery tests.
6. Validate actual barcode scanners, receipt printers, cash drawers and any weighing scales.
7. Run user acceptance testing with representative products and synthetic data.
8. Complete backup/restore, security and operational readiness review before live data.

## 5. Explicitly not claimed as complete

This baseline is not a delivered ERP, POS, mobile application, or production deployment. It records the intended scope and acceptance gates only.
