# AL-NASR acceptance matrix

| Area | Required evidence | Status |
|---|---|---|
| Brand source assets | SVG XML validity, approved palette, required Arabic labels, wordmark hierarchy, accessible title | Source contract tests passed in clean CI; browser/font/print rendering still not run |
| Clean install | Reproducible Frappe/ERPNext v16 install | Passed on pinned commits in disposable MariaDB CI; Bench, all apps, migrations and HTTP ping verified |
| Custom app runtime contracts | Installed app list, standard ERPNext DocTypes, X POS operational DocTypes, API imports and app metadata | Passed: 5 Frappe-native tests in [run #43329925389](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43329925389) |
| X POS upstream frontend/backend contracts | Offline queue, invoice retry/idempotency, payments and shift unit tests | Passed: 449 frontend tests across 24 files, 1 invoice-retry backend test and 25 shift backend tests in [run #43330277075](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43330277075) |\n| Catalog | UOM conversions, variants, multiple barcodes, price lists | Not run |
| POS | Checkout, split tender, discounts, receipt | Upstream payment-processing and shift unit suites passed; full server-posted sale and financial reconciliation not run |
| Shifts | Open, cash movements, close, variance | 25 upstream backend shift tests and 21 frontend shift-management tests passed; end-to-end cash/GL reconciliation not run |
| Returns | Partial/full returns, refund and stock/accounting effects | Not run |
| Inventory | Receipt, transfer, count, adjustment, valuation | Not run |
| Purchasing | PO, receipt, invoice, supplier return | Not run |
| Credit | Limits, due dates, collections, aging | Not run |
| Roles | Cashier, supervisor, inventory, buyer, accountant, owner | Not run |
| Offline | Queue logic, durable submission, idempotency, reconnect, conflict handling and device restart | Offline-related frontend unit cases passed (12 queue, 6 receipt storage, 7 offline sale, 5 durable submission); real browser/device restart, LAN/server outage and end-to-end replay remain untested |
| LAN | Multiple terminals and server interruption | Not run |
| Hardware | Barcode scanner, thermal printer, cash drawer, scale if used | Not run |
| Arabic | RTL, numerals, currency, printed receipt | Source direction documented; runtime visual/print validation not run |
| Recovery | Backup restore and disaster recovery drill | Not run |
| Security | Permission tests, audit trail, secret scan | Not run |

A row may be marked passed only when the test evidence, tested revision, and environment are recorded. A successful app installation does not count as passing a business workflow.
