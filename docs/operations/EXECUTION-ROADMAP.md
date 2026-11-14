# AL-NASR execution roadmap and release gates

**Owner:** AL-NASR / Nasr Othman Abdullah Al-Aosimi  
**Current phase:** Foundation and source integration  
**Status:** Active planning baseline; tasks are not complete merely because they are listed here.

## Delivery principles

1. Reuse upstream ERPNext and X POS capabilities before adding custom code.
2. Never duplicate ERPNext stock, sales, purchasing, payment, or general-ledger records.
3. Preserve upstream Git history, license files, notices, and source attribution.
4. Keep secrets, production credentials, customer data, and real transaction data out of this public repository.
5. Mark every task as implemented, verified, blocked, or not started. A commit is not a passing test.
6. No production deployment before backup/restore, permission, accounting, stock, and recovery acceptance gates pass.

## Workstream A — source and runtime foundation

- [x] Resolve and lock exact Frappe v16.56.0, ERPNext v16.55.0 and X POS v2.13.4 source revisions.
- [x] Preserve the three upstream repositories as recursive Git submodules and verify their exact SHAs in CI.
- [x] Initialize a clean Bench from the pinned local Frappe source in disposable CI.
- [x] Link the monorepo AL-NASR package into Bench and install it editable without inventing a separate Git repository.
- [x] Build the X POS frontend and Frappe assets in a clean runtime job.
- [x] Create a disposable MariaDB-backed site, install ERPNext, X POS and AL-NASR, and run migrations.
- [x] Verify installed app names, import the Frappe framework, and receive a successful HTTP ping.
- [x] Source validation and clean runtime integration passed on commit `891786162d696d9a54c892e66b3270b226300c1d`.
- [x] Run the Frappe-native AL-NASR runtime contract suite: all 5 tests passed in [PR runtime run #43329925389](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43329925389).
- [x] Run expanded X POS suites: 449 frontend tests across 24 files, 1 backend invoice-retry/idempotency test, and 25 backend shift tests passed in [runtime run #43330277075](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43330277075).
- [x] Add business-level POS sale and tax integration tests: submitted invoice, stock decrement, idempotent retry, tax-inclusive/exclusive totals and balanced GL verified in runtime run #43524108112.\n- [x] Add dedicated X POS partial/full return scenarios: partial return restores one unit, final return restores the remainder, original/credit-note GL entries balance, and over-return beyond the remaining sold quantity is rejected. Passed in runtime run [#43528341526](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43528341526) on commit `da7250d116901fc7c06778e1afb5d70447e4e355`.

**Exit gate:** Clean install/migrate/HTTP gate, Frappe-native app contracts, ERPNext upstream regression baseline (779 tests), POS sale/idempotency, tax-inclusive/exclusive integration, partial/full returns, stock restoration, GL balance, and over-return rejection passed on commit `da7250d116901fc7c06778e1afb5d70447e4e355` in runtime run [#43528341526](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43528341526). Broader operations acceptance remains open.
## Workstream B — business configuration

- [ ] Company, fiscal year, currency, taxes, chart of accounts, and cost centers approved by the owner/accountant.
- [ ] Warehouses and branch structure approved.
- [ ] Item groups, brands, UOMs, conversions, and multiple barcodes validated.
- [ ] Retail and wholesale price lists, pricing rules, promotions, and discount limits configured.
- [ ] Supplier/customer masters, credit limits, and due-date policies configured.
- [ ] POS profiles, payment modes, cashier users, and shift controls configured.

**Exit gate:** Representative opening balances and master data imported into a test site and reconciled.

## Workstream C — POS and retail operations

- [ ] Barcode scan and item search.
- [ ] Cash, split tender, and configured payment methods.
- [ ] Draft/suspended cart persistence and recovery.
- [ ] Discount and price override permissions.
- [ ] Partial/full returns, refunds, voids, and cancellation.
- [ ] Cash shift opening, closing, variance, expenses, and deposits.
- [ ] Thermal receipt layout in Arabic RTL and English LTR.
- [ ] Purchasing, receiving, purchase returns, and supplier invoice workflow.

**Exit gate:** End-to-end scenarios reconcile invoice totals, stock ledger, payment records, and GL effects.

## Workstream D — stock, accounting, and governance

- [ ] Multi-warehouse transfers and stock counts.
- [ ] Batch/serial/expiry tracking where required.
- [ ] Costing and valuation method approved and tested.
- [ ] Purchase/sales tax behavior tested.
- [ ] Cash/bank reconciliation and expenses tested.
- [ ] Roles for owner, manager, cashier, buyer, stock controller, and accountant.
- [ ] Segregation of duties for discounts, refunds, voids, and stock adjustments.
- [ ] Audit trail and approval evidence verified.

**Exit gate:** Stock valuation and general-ledger balances reconcile after sales, returns, purchases, cancellations, and stock adjustments.

## Workstream E — network, offline, and recovery

Test these failure modes separately:
- [ ] Internet unavailable while local LAN and ERP server remain reachable.
- [ ] LAN/server unavailable.
- [ ] Client device restarts while transactions are queued.
- [ ] Browser/PWA storage is cleared or quota is exhausted.
- [ ] Reconnection and repeated synchronization attempts.
- [ ] Duplicate submission and idempotent replay.
- [ ] Conflicting stock/pricing/customer updates.
- [ ] Backup restore into a clean environment.

**Exit gate:** No silent transaction loss, duplicate invoices/payments, or untraceable stock/GL divergence. Offline support remains disabled for production until this gate passes.

## Workstream F — launch readiness

- [ ] Owner acceptance of workflows, labels, reports, and permissions.
- [ ] Staff training and operating procedures.
- [ ] Backup schedule and restore drill.
- [ ] Monitoring, error reporting, and update/rollback procedure.
- [ ] Production credentials stored only in deployment secret management.
- [ ] Final data migration and reconciliation plan.
- [ ] Signed go-live checklist and rollback plan.


## Workstream G — one Windows computer + one Android phone

**Scope decision:** one Windows computer hosts the local Frappe/ERPNext/X POS server and is also the desktop client; one Android phone connects over the same local Wi-Fi/LAN. No cloud dependency or extra terminals are in scope.

- [x] Record the target topology, shared-data rules, unified UI requirements, packaging boundaries and acceptance gates in [CLIENT-DELIVERY-ONE-PC-ONE-ANDROID.md](../architecture/CLIENT-DELIVERY-ONE-PC-ONE-ANDROID.md).
- [x] Add an AL-NASR Desk landing page at `/app/alnasr` with shared brand styling, responsive layout, quick actions and navigation into X POS and ERPNext standard workflows; source contracts added to app validation. Runtime rendering and role-based access verification remain open.
- [ ] Integrate ERPNext management surfaces and X POS into one branded navigation without iframe-based coupling or upstream source patches.
- [ ] Validate the local Frappe server lifecycle on a clean supported Windows installation.
- [ ] Produce and test the Windows installer/desktop launcher.
- [ ] Produce and test the Android APK client connecting to the PC server over LAN.
- [ ] Verify login/session behavior, same catalog/invoice/stock state on both devices, restart/reconnect and duplicate prevention.
- [ ] Validate target barcode scanner and receipt printer.
- [ ] Complete backup/restore and owner acceptance before any live use.

**Exit gate:** A clean Windows installation starts the local server reliably; the Android phone connects over LAN; both clients show the same authoritative data; sale, return and cash-close flows reconcile; and packaged EXE/APK installation, update and recovery are tested. Offline sales remain disabled until their own failure/reconciliation gate passes.

## Latest integration finding — return credit notes

- Confirmed the pinned X POS v2.13.4 customization `Sales Invoice-update_outstanding_for_self-default` forces the ERPNext v16 field default to `0`, while ERPNext's upstream default is `1`.
- The override caused the two remaining upstream Sales Invoice regressions: return GL `against_voucher` linkage and the credit note's own negative outstanding balance.
- Added an AL-NASR `after_migrate` compatibility hook to remove only that conflicting Property Setter and assert the ERPNext default remains `1`; added a runtime contract test and documented the decision in `docs/architecture/COMPATIBILITY-OVERRIDES.md`.
- This correction is committed on the Draft PR branch. The integrated runtime run #43524108112 passed the unchanged ERPNext Sales Invoice regression module (163 tests) and the full 779-test ERPNext baseline. This verifies the upstream credit-note regressions against the compatibility hook; dedicated X POS refund settlement scenarios remain open.

## Latest verified integration — POS sale and tax\n\n- Runtime run [#43524108112](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43524108112) passed on commit `7308762c4677fd0c26d8d3c350c62dd3cb28fb94`.\n- ERPNext upstream regression baseline passed unchanged: Sales Invoice 163, Purchase Receipt 160, Purchase Invoice 111, Delivery Note 122, Stock Entry 148, Payment Entry 75 (779 total).\n- POS integration passed: a real X POS API sale submitted a Sales Invoice, reduced stock, and returned the same invoice on retry without a second stock issue.\n- Tax integration passed for both tax-inclusive and tax-exclusive POS profiles, checking invoice totals, tax flags and balanced GL.\n- The CI site was disposable MariaDB. This is not production deployment, real hardware validation, LAN/offline recovery, or full business UAT.\n\n
## Latest verified integration — POS returns

- Runtime run [#43528341526](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43528341526) passed on commit `da7250d116901fc7c06778e1afb5d70447e4e355`.
- The six unchanged ERPNext upstream suites passed: Sales Invoice 163, Purchase Receipt 160, Purchase Invoice 111, Delivery Note 122, Stock Entry 148, and Payment Entry 75 (779 total).
- Four X POS business integration tests passed: tax-inclusive/exclusive sale totals and GL; sale retry without a second stock issue; partial then full returns restoring stock and balancing GL; and rejection of returns exceeding the remaining original sale quantity.
- The runtime also passed the AL-NASR contract suite (6 tests), X POS shift suite (25 tests), installed-app verification, and Frappe HTTP ping.
- The CI database was disposable. This does not prove real printer/scanner compatibility, desktop EXE packaging, Android APK packaging, LAN/device behavior, offline recovery, or production readiness.

## Current verified state

- The active development branch is `foundation/alnasr-commerce-acceptance`; PR #2 remains open and Draft against `main` (not merged).
- Exact source locks: Frappe `49789a1711d4dde2be9c6888efe35651465f4b64` (16.56.0), ERPNext `8e10a348daaa93853de8c36dc55ec789a440c219` (16.55.0), X POS `3668fca6ffcab737347d4d223ac93f5d74aa90b3` (2.13.4).
- Clean source validation passed on commit `891786162d696d9a54c892e66b3270b226300c1d` in [run #43327483463](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43327483463).
- Clean runtime integration passed on the same commit in [run #43327483473](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43327483473): X POS assets built; disposable site created; ERPNext, X POS and AL-NASR installed; migrations completed; installed apps and Frappe HTTP ping verified.
- The Frappe-native AL-NASR runtime contract suite passed all 5 tests in [PR run #43329925389](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43329925389): installed apps, standard ERPNext DocTypes, X POS operational DocTypes, API imports and AL-NASR brand metadata.
- Expanded X POS tests passed in [runtime run #43330277075](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43330277075): 449 frontend unit tests across 24 files; one backend idempotent invoice-retry test; and 25 backend shift tests. The frontend suite includes offline queue (12), offline receipt storage (6), offline sale (7), durable invoice submission (5), payment processing (24), and shift management (21) test cases.
- These are unit/contract tests, not a complete browser-to-database sale, device restart, LAN outage, hardware, or financial reconciliation acceptance test.
- X POS source inspection confirms an IndexedDB-backed offline queue, stable local sale identity and server-side duplicate detection/fingerprint checks. This is source-level evidence only; no AL-NASR offline recovery or device failure test has passed.
- No end-to-end sale/return/purchase, stock valuation, GL reconciliation, real hardware, Arabic receipt, multi-terminal LAN, backup/restore or production test has passed.
- The primary SVG wordmark source is contract-tested at 165 px with 18 px burgundy outer and 12 px antique-gold inner outlines. Browser rendering, Arabic font shaping, vector-path conversion and print checks remain open.
## Release policy

Do not merge this foundation PR or deploy the system solely because GitHub reports the branch as mergeable. Merge only after code review and a successful CI run. Do not launch until all applicable exit gates above have evidence.
