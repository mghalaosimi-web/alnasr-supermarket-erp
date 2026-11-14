# AL-NASR domain mapping to ERPNext v16

**Status:** Architecture baseline; verify every field and workflow against the exact pinned ERPNext revision before implementation.

## Principle

Prefer standard ERPNext DocTypes and controllers for stock, selling, buying, payments, and accounting. AL-NASR must not create parallel ledgers or duplicate core master data. Customization belongs in the `alnasr` app through supported hooks, custom fields, fixtures, reports, workspaces, and narrowly scoped DocTypes only where a proven gap exists.

## Reuse map

| Business capability | ERPNext baseline to reuse | AL-NASR work still requiring validation |
|---|---|---|
| Products and categories | Item, Item Group, Brand, UOM, Item Barcode | Barcode policy, retail-friendly item entry, import templates |
| Unit conversions | UOM, UOM Conversion Detail | Validate pack/carton/piece conversion and selling-unit barcode behavior |
| Warehouses and stock | Warehouse, Bin, Stock Entry, Stock Reconciliation, Stock Ledger Entry | Branch conventions, stock count UX, approval thresholds |
| Buying | Supplier, Purchase Order, Purchase Receipt, Purchase Invoice, Purchase Return via return documents | Receiving workflow, landed-cost policy, supplier-specific barcode/catalog imports |
| Selling | Customer, Quotation, Sales Order, Delivery Note, Sales Invoice, POS Invoice | Retail/wholesale price policy, cashier UX, receipt layout |
| Pricing and discounts | Price List, Item Price, Pricing Rule, Promotional Scheme | Customer tiers, approval limits, date and quantity boundary tests |
| Payments | Mode of Payment, Payment Entry, POS payment configuration | Split tender and cash reconciliation behavior on selected POS build |
| Finance | Company, Account, Cost Center, Journal Entry, Payment Entry, GL Entry | Owner-approved chart of accounts, cash controls, management reports |
| People and permissions | User, Role, Role Permission Manager, User Permissions | Cashier/supervisor/stock/buyer/accountant role matrix and separation of duties |
| Traceability | Batch, Serial No, Item-level batch/serial settings | Expiry handling and FEFO policy where the store needs it |
| Audit | Version, Activity Log, document timeline and built-in audit facilities | Explicit audit evidence for overrides, voids, refunds, and privileged actions |

## Do not duplicate these ledgers

Do not introduce AL-NASR-specific replacements for Item, Warehouse, Stock Ledger Entry, Bin, Sales Invoice, POS Invoice, Purchase Receipt, Purchase Invoice, Supplier, Customer, Payment Entry, or GL Entry without a documented upstream limitation and an approved migration design.

Never write stock or general-ledger rows directly. Use ERPNext document controllers and supported business operations so valuation, reposting, taxes, and accounting dimensions remain consistent.

## Candidate AL-NASR extensions (not implemented)

1. Store configuration and owner-approved operational policies.
2. Cashier shift orchestration only if the chosen POS app does not already provide a suitable implementation.
3. Approval workflow metadata for discounts, voids, refunds, and stock adjustments if standard workflows are insufficient.
4. Reconciliation/audit queue for offline POS synchronization, only after the upstream POS sync contract is inspected.
5. Localized workspaces, reports, print formats, and guided setup.

Each candidate requires a gap statement, data ownership definition, permission matrix, migration plan, and automated tests before a DocType is created.

## Compatibility and evidence gates

- Pin exact Frappe, ERPNext, and POS app commits/tags in a deployment lock document.
- Confirm the selected Frappe v16 Python requirement from the pinned upstream `pyproject.toml`; current branch baseline inspected during this change requires Python `>=3.14,<3.15`.
- Verify the selected POS app's supported ERPNext version, install hooks, DocTypes, APIs, and license before integration.
- Test stock ledger and GL effects for checkout, return, refund, purchase receipt, and cancellation.
- No offline capability is considered accepted until durable local storage, idempotent replay, conflict resolution, duplicate prevention, and recovery tests pass.

## Current implementation status

This document is a design map, not evidence that these workflows have been implemented or tested in AL-NASR.
