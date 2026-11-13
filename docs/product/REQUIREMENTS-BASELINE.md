# AL-NASR product requirements baseline

**Status:** Initial scope baseline; requirements need owner validation before production.  
**Product:** النصر | AL-NASR  
**Business owner:** نصر عثمان عبدالله العصيمي

## 1. Product objective

Deliver a reliable, Arabic-first supermarket and retail management system under the **النصر | AL-NASR** identity. The system must support small-item retail through wholesale operations, barcode-based checkout, auditable stock and accounting, and resilient local-network operation.

## 2. Product description

**Arabic:** النصر نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة، يجمع المبيعات ونقاط البيع والمشتريات والمخزون والموردين والعملاء والحسابات والتقارير في منظومة واحدة مترابطة، مع واجهة عربية تدعم اتجاه الكتابة من اليمين إلى اليسار، وإمكانية استخدام اللغة الإنجليزية.

**English:** AL-NASR is an integrated supermarket, retail, and wholesale management system that connects point of sale, sales, purchasing, inventory, suppliers, customers, accounting, and operational reporting in one auditable platform, with Arabic RTL and English LTR interfaces.

## 3. Brand and interface requirements

- Use the product name consistently as **النصر | AL-NASR** in AL-NASR-owned UI surfaces.
- Use the approved AL-NASR logo assets and palette; do not substitute ERPNext or X POS logos on AL-NASR-owned screens.
- Arabic is the default experience and must use correct RTL layout, alignment, navigation, numbers, and form behavior.
- English must remain available with correct LTR behavior.
- Apply the same identity to app launcher, navigation, login/landing surfaces, dashboards, POS, receipts, invoices, quotations, purchase documents, reports, exports, email templates, and desktop packaging where those surfaces are owned or safely extensible.
- Preserve third-party product identity and legal notices where required; do not remove upstream copyright or license attribution.
- Do not globally replace ERPNext branding through a broad hook until the impact on all installed apps and supported screens has been reviewed.

## 4. Functional domains

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

## 5. Non-functional requirements

- No silent loss or duplication of sales during retry or synchronization.
- Idempotency keys for transaction synchronization.
- Explicit conflict handling and an auditable reconciliation queue.
- Least-privilege roles; privileged overrides require a reason and audit event.
- No credentials or live business data in source control.
- All monetary values use currency-aware decimal arithmetic, never binary floating-point for financial calculations.
- Timezone, currency, tax and rounding rules must be configured for the actual business jurisdiction before go-live.
- Backups must be encrypted, access-controlled and restore-tested.

## 6. Release gates

1. Confirm business workflows, units, taxes, currency, branches, warehouses and payment methods with the owner.
2. Complete upstream source import and license inventory.
3. Pass clean install and migration tests on the pinned Frappe/ERPNext v16 versions.
4. Pass POS checkout, return, shift, payment, stock ledger and accounting integration tests.
5. Pass offline/LAN outage, retry, duplicate prevention, conflict and power-loss recovery tests.
6. Validate actual barcode scanners, receipt printers, cash drawers and any weighing scales.
7. Run user acceptance testing with representative products and synthetic data.
8. Complete backup/restore, security and operational readiness review before live data.
9. Complete the brand implementation matrix for every supported AL-NASR-owned surface.

## 7. Explicitly not claimed as complete

This baseline is not a delivered ERP, POS, mobile application, or production deployment. It records the intended scope and acceptance gates only.
