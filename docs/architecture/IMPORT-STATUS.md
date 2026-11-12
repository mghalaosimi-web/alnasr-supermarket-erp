# Upstream source import status

**Review date:** 2026-11-12  
**Target repository:** `mghalaosimi-web/alnasr-supermarket-erp`  
**Development branch:** `foundation/alnasr-custom-app`  
**Verified branch commit:** `a475ea63dd3cb73d0a27a372e6c1a0b5c0669d99`

## Confirmed repository state

- The AL-NASR repository is public; do not commit secrets, real store data, customer records, invoices, or database dumps.
- Frappe, ERPNext, and X POS are configured as recursive Git submodules under the conventional `apps/` paths.
- The parent repository records immutable upstream gitlinks; this preserves each upstream repository's provenance and history. It is not a copied source snapshot or a fork.
- The custom AL-NASR Frappe app is maintained separately at `apps/alnasr`.
- No Bench installation, site creation, migrations, or end-to-end retail workflow has yet been verified.

## Pinned upstream revisions

| Component | Upstream | Branch / version | Pinned commit | Repository path |
|---|---|---|---|---|
| Frappe Framework | `frappe/frappe` | v16.56.0 | `49789a1711d4dde2be9c6888efe35651465f4b64` | `apps/frappe` |
| ERPNext | `frappe/erpnext` | v16.55.0 | `8e10a348daaa93853de8c36dc55ec789a440c219` | `apps/erpnext` |
| X POS | `kodlyft/xpos` | version-16 / 2.13.4 | `3668fca6ffcab737347d4d223ac93f5d74aa90b3` | `apps/xpos` |
| AL-NASR | this repository | custom app 0.1.0 | branch-owned source | `apps/alnasr` |

The exact SHA values are pinned by the parent repository's submodule entries and checked by `scripts/bootstrap-upstream.sh`.

## Source checkout verification

- GitHub Actions run [#94](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43295257507) completed successfully on commit `a475ea63dd3cb73d0a27a372e6c1a0b5c0669d99`.
- The run passed recursive checkout, exact upstream SHA verification, custom-app metadata validation, Python compilation, SVG contract tests, source/wheel package builds, and `git diff --check`.
- This proves that CI can retrieve the pinned source trees and that the custom app passes the listed source/package checks. It does **not** prove that Bench can install the apps or that the applications run together.

## Import and modification policy

1. Preserve upstream Git history, immutable commit IDs, license files, and copyright notices.
2. Do not patch files inside the Frappe, ERPNext, or X POS submodules.
3. Implement AL-NASR behavior in `apps/alnasr` and supported extension points.
4. Do not duplicate standard ERPNext DocTypes for items, warehouses, stock ledger, sales/purchase invoices, suppliers, customers, payments, or general ledger.
5. Keep local databases, caches, build outputs, secrets, credentials, and live business data out of Git.
6. Do not describe submodule linking or CI source checkout as a completed runtime installation.

## Next required operation

Build a disposable integration environment using the Frappe v16 system prerequisites, then:

1. Initialize a clean Bench using the pinned local Frappe source.
2. Add ERPNext, X POS, and AL-NASR from their local repository paths without changing their pinned commits.
3. Create a disposable MariaDB-backed test site.
4. Install the apps in dependency order and record any failures, missing dependencies, hooks, or build issues.
5. Run migrations only on that disposable site.
6. Verify the site boots, the Desk loads, and the installed app list and versions match the pinned baseline.
7. Continue to POS, inventory, accounting, permissions, RTL, and device-level acceptance tests only after the install gate passes.

Frappe's current v16 installation guide specifies Python 3.14, Node.js 24, MariaDB 11.8, Redis 6+, Yarn 1.22+, and pip 25.3+; confirm the exact runner packages and service health before implementing the integration workflow.

## Current release boundary

Draft PR #1 remains unmerged. Do not mark it ready for review, merge it, deploy it, or run production migrations without explicit authorization. The project is a source-integrated foundation, not a production-ready supermarket system.
