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
- [ ] Run the expanded X POS frontend unit suite and targeted backend invoice-retry/shift tests added to CI; latest run is pending.
- [ ] Add business-level transaction tests for POS sale, return, stock and GL reconciliation.

**Exit gate:** Clean install/migrate/HTTP gate passed. The remaining source/runtime gate is the newly added app contract suite plus business-level integration tests.
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

## Current verified state

- The development branch is `foundation/alnasr-custom-app`; PR #1 remains open and Draft against `main`.
- Exact source locks: Frappe `49789a1711d4dde2be9c6888efe35651465f4b64` (16.56.0), ERPNext `8e10a348daaa93853de8c36dc55ec789a440c219` (16.55.0), X POS `3668fca6ffcab737347d4d223ac93f5d74aa90b3` (2.13.4).
- Clean source validation passed on commit `891786162d696d9a54c892e66b3270b226300c1d` in [run #43327483463](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43327483463).
- Clean runtime integration passed on the same commit in [run #43327483473](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43327483473): X POS assets built; disposable site created; ERPNext, X POS and AL-NASR installed; migrations completed; installed apps and Frappe HTTP ping verified.
- The Frappe-native AL-NASR runtime contract suite passed all 5 tests in [PR run #43329925389](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43329925389): installed apps, standard ERPNext DocTypes, X POS operational DocTypes, API imports and AL-NASR brand metadata. The newer workflow also adds X POS frontend unit tests and targeted backend invoice-retry/shift tests; those expanded checks are pending.
- X POS source inspection confirms an IndexedDB-backed offline queue, stable local sale identity and server-side duplicate detection/fingerprint checks. This is source-level evidence only; no AL-NASR offline recovery or device failure test has passed.
- No end-to-end sale/return/purchase, stock valuation, GL reconciliation, real hardware, Arabic receipt, multi-terminal LAN, backup/restore or production test has passed.
- The primary SVG wordmark source is contract-tested at 165 px with 18 px burgundy outer and 12 px antique-gold inner outlines. Browser rendering, Arabic font shaping, vector-path conversion and print checks remain open.
## Release policy

Do not merge this foundation PR or deploy the system solely because GitHub reports the branch as mergeable. Merge only after code review and a successful CI run. Do not launch until all applicable exit gates above have evidence.
