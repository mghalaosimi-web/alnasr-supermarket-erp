# AL-NASR acceptance matrix

Tested revision: `7308762c4677fd0c26d8d3c350c62dd3cb28fb94`  
Runtime environment: disposable GitHub Actions Bench + MariaDB; no production database or live business data.

| Area | Required evidence | Status |
|---|---|---|
| Brand source assets | SVG XML validity, approved palette, Arabic labels, wordmark hierarchy, accessible title | Source contract tests passed; browser/font/print rendering still not run |
| Clean install | Reproducible pinned Frappe/ERPNext/X POS install | Passed: clean Bench, all apps installed, migrations completed, app metadata verified, HTTP ping returned pong |
| ERPNext regression baseline | Sales Invoice, Purchase Receipt, Purchase Invoice, Delivery Note, Stock Entry, Payment Entry | Passed: 779 upstream tests (163, 160, 111, 122, 148, 75) in [runtime run #43524108112](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43524108112) |
| POS sale | Server-posted sale, stock decrement, retry/idempotency | Passed: integration test creates a submitted invoice, verifies stock decrement, then confirms retry returns the same invoice without a second stock issue |
| POS tax | Tax-inclusive and tax-exclusive checkout, invoice totals and GL balance | Passed: `test_pos_tax_inclusive_and_exclusive_sales_match_invoice_and_gl_totals` in runtime run #43524108112 |
| Returns | Partial/full returns, refund settlement and stock/accounting effects | Partially covered by unchanged ERPNext Sales Invoice regression suite and compatibility correction; dedicated X POS partial/full refund end-to-end scenarios remain not run |
| Shifts | Open, cash movements, close, variance | 25 upstream backend shift tests passed; end-to-end cash/GL reconciliation not run |
| X POS frontend/backend contracts | Offline queue, invoice retry/idempotency, payments and shift unit tests | Passed in earlier recorded run #43330277075: 449 frontend tests across 24 files, 1 invoice-retry backend test and 25 shift backend tests |
| Catalog | UOM conversions, variants, multiple barcodes, price lists | Not run |
| Inventory | Receipt, transfer, count, adjustment, valuation | ERPNext upstream regression modules passed; AL-NASR end-to-end warehouse/count/valuation scenarios not run |
| Purchasing | PO, receipt, invoice, supplier return | ERPNext Purchase Receipt and Purchase Invoice upstream regressions passed; complete PO-to-payment and supplier-return scenarios not run |
| Credit | Limits, due dates, collections, aging | Not run |
| Roles | Cashier, supervisor, inventory, buyer, accountant, owner | Not run |
| Offline | Durable queue, retry, duplicate prevention, reconnect, conflict handling and device restart | Unit-level offline queue/storage/sale/durable-submission cases passed in earlier frontend suite; real browser/device restart, LAN/server outage and end-to-end replay remain untested |
| LAN | Multiple terminals and server interruption | Not run |
| Hardware | Barcode scanner, thermal printer, cash drawer, scale if used | Not run |
| Arabic | RTL, numerals, currency, printed receipt | Source direction documented; runtime visual/print validation not run |
| Recovery | Backup restore and disaster recovery drill | Not run |
| Security | Permission tests, audit trail, secret scan | Not run |

A row may be marked passed only when the test evidence, tested revision, and environment are recorded. A successful app installation does not count as passing a business workflow. Offline support and production deployment remain blocked until their respective acceptance gates pass.
