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

- [ ] Resolve immutable Frappe v16 and ERPNext v16 commits that are mutually compatible.
- [ ] Verify the selected X POS v16 commit and its install hooks/dependencies.
- [ ] Import source using a provenance-preserving Git method; do not publish a partial source snapshot as a complete import.
- [ ] Build a clean Bench using Python 3.14 and Node.js 24 or the exact upstream-supported versions.
- [ ] Install Frappe, ERPNext, X POS, and the AL-NASR app on a disposable test site.
- [ ] Run migrations and record exact commands, versions, and logs.
- [ ] Verify the GitHub Actions workflow on the branch and resolve failures.

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

- A custom app scaffold and architecture documentation exist on branch `foundation/alnasr-custom-app`.
- Draft PR #1 is open against `main`.
- No ERPNext/Frappe/X POS upstream source has been imported into this repository.
- No Bench installation, migration, business workflow, hardware, offline, or backup/restore test has been executed.
- GitHub Actions run [#6](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43272278320) passed on commit `dab47c577b0b91d03648f783a6c88eb6afde6b3a`, including metadata validation, Python compileall, package builds, and diff whitespace checks. This verifies the scaffold/package only; it is not a Frappe/ERPNext runtime or business-workflow test.

## Release policy

Do not merge this foundation PR or deploy the system solely because GitHub reports the branch as mergeable. Merge only after code review and a successful CI run. Do not launch until all applicable exit gates above have evidence.
