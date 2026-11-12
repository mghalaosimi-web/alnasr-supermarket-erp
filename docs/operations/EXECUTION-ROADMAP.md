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

- [x] Resolve immutable Frappe v16.56.0 and ERPNext v16.55.0 commits; ERPNext's declared Frappe minimum is satisfied by the selected Frappe revision.
- [x] Resolve and verify the immutable X POS v2.13.4 commit object.
- [ ] Verify X POS install hooks and runtime dependencies in a clean Bench.
- [x] Link Frappe, ERPNext, and X POS as pinned Git submodules; recursively check out and verify all three exact SHAs in GitHub Actions.
- [x] Initialize a clean Bench from the pinned local Frappe source in disposable CI.
- [ ] Add the monorepo AL-NASR package to Bench and complete app installation; the first attempt exposed a Git-repository assumption and the corrected workflow is running.
- [ ] Create a disposable site, install apps, run migrations, and verify HTTP health.
- [x] Source/package validation passed on previous head in run [#100](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43296072126).
- [ ] Re-run source validation after the current workflow correction in [#102](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43297298964).

**Exit gate:** A clean, reproducible installation from documented immutable revisions with successful migrations.

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

- The custom app scaffold, brand assets, and architecture documentation are on branch `foundation/alnasr-custom-app`.
- Immutable source revisions are recorded: Frappe `49789a1711d4dde2be9c6888efe35651465f4b64` (16.56.0), ERPNext `8e10a348daaa93853de8c36dc55ec789a440c219` (16.55.0), and X POS `3668fca6ffcab737347d4d223ac93f5d74aa90b3` (2.13.4). These revisions are selected but not yet installed together.
- Draft PR #1 is open against `main`; it remains unmerged.
- The first disposable runtime attempt initialized Bench successfully but failed when Bench treated the monorepo app directory as a standalone Git repository. The workflow has been corrected to symlink the package and install it editable; runtime attempt [#2](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43297299228) is pending.
- Source validation run [#100](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43296072126) passed on the previous head. Run [#102](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43297298964) is running against the current correction commit.
- No site installation, migration, business workflow, hardware, offline, or backup/restore test has yet passed.
- The primary SVG wordmark is source-verified at 165 px with an 18 px burgundy outer outline and 12 px antique-gold inner outline. Browser rendering, Arabic font shaping, vector-path conversion, and print checks remain pending.

## Release policy

Do not merge this foundation PR or deploy the system solely because GitHub reports the branch as mergeable. Merge only after code review and a successful CI run. Do not launch until all applicable exit gates above have evidence.
