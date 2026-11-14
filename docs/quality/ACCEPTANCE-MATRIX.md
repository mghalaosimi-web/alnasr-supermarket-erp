# AL-NASR acceptance matrix

**Tested revision:** `b8911fc4d07416d9bd405633ce35e39e664b148d`
**Runtime environment:** disposable GitHub Actions Bench + MariaDB 11.8; no production database or live business data.
**Latest runtime evidence:** [run #43588327281](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43588327281)
**Latest source-validation evidence:** [run #43588327377](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43588327377)

## Verified test totals on the tested revision

| Suite | Passed | Failed |
|---|---:|---:|
| ERPNext upstream regression baseline: Sales Invoice, Purchase Receipt, Purchase Invoice, Delivery Note, Stock Entry, Payment Entry | 779 | 0 |
| AL-NASR POS sale/tax/return integration tests | 4 | 0 |
| AL-NASR runtime contract tests | 10 | 0 |
| X POS invoice retry backend test | 1 | 0 |
| X POS shift backend tests | 25 | 0 |
| X POS frontend unit tests (24 files) | 449 | 0 |
| **Total in latest runtime job** | **1,268** | **0** |

The 779 ERPNext tests are 163 + 160 + 111 + 122 + 148 + 75. The 819 Python tests and 449 frontend tests were observed in the logs of the same successful runtime job #43588327281. These are test-case executions, not a count of CI jobs.

## Acceptance status

| Area | Required evidence | Status |
|---|---|---|
| Source/package validation | Metadata, dashboard JS syntax, module document paths, Python compilation, brand asset contracts, source/wheel builds, whitespace | Passed in validation run #43588327377 |
| Clean install | Reproducible pinned Frappe/ERPNext/X POS install, disposable site creation, migrations, installed-app verification and HTTP ping | Passed in runtime run #43588327281 |
| ERPNext regression baseline | Sales Invoice, Purchase Receipt, Purchase Invoice, Delivery Note, Stock Entry, Payment Entry | Passed: 779 tests in runtime run #43588327281 |
| POS sale | Server-posted sale, stock decrement, retry/idempotency | Passed: invoice submission, stock decrement and duplicate retry without a second stock issue |
| POS tax | Tax-inclusive and tax-exclusive checkout, invoice totals and GL balance | Passed in AL-NASR POS integration suite |
| POS returns | Partial return followed by final return, stock restoration, source invoice linkage, balanced GL, over-return rejection | Passed in AL-NASR POS integration suite |
| Shifts | Open, cash movements, close, variance and expected-amount calculations | Passed: 25 X POS backend shift tests; end-to-end cash/GL reconciliation remains open |
| X POS frontend/backend contracts | Offline queue, invoice retry/idempotency, payments, returns, shift and frontend behavior | Passed: 449 frontend tests across 24 files, 1 invoice-retry backend test and 25 shift backend tests |
| Catalog | UOM conversions, variants, multiple barcodes, price lists | Not run as AL-NASR end-to-end acceptance |
| Inventory | Receipt, transfer, count, adjustment, valuation | ERPNext upstream regressions passed; AL-NASR end-to-end warehouse/count/valuation scenarios remain open |
| Purchasing | PO, receipt, invoice, supplier return and supplier payment | ERPNext receipt/invoice regression tests passed; complete PO-to-payment and supplier-return scenarios remain open |
| Credit | Limits, due dates, collections and aging | Not run as AL-NASR end-to-end acceptance |
| Roles | Cashier, supervisor, inventory, buyer, accountant and owner | Not run as a complete role/permission acceptance matrix |
| Offline | Durable queue, retry and duplicate prevention | Unit-level frontend tests passed; real browser/device restart, LAN/server outage and end-to-end replay remain untested |
| LAN | Multiple terminals and server interruption | Not run |
| Hardware | Barcode scanner, thermal printer, cash drawer and scale if used | Not run |
| Arabic | RTL, numerals, currency and printed receipt | Source direction documented; runtime visual and print validation not run |
| Recovery | Backup restore and disaster recovery drill | Not run |
| Security | Permission tests, audit trail and secret scan | Not run as a release acceptance suite |
| Client packaging | AL-NASR Windows server installer and Android APK/PWA device acceptance | Not ready; see `docs/architecture/CLIENT-PACKAGING-STATUS.md` |

A row may be marked passed only when test evidence, tested revision and environment are recorded. A successful app installation does not establish a complete business workflow. Offline support and production deployment remain blocked until their respective acceptance gates pass.
