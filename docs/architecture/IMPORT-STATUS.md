# Upstream source import status

**Review date:** 2026-11-12  
**Target repository:** `mghalaosimi-web/alnasr-supermarket-erp`  
**Development branch:** `foundation/alnasr-custom-app`  
**Latest reviewed commit:** `ed8c9e737e451f41171c47e3fcfaf8ca3f78428d`

## Confirmed repository state

- The AL-NASR repository is public; do not commit secrets, real store data, customer records, invoices, or database dumps.
- Frappe, ERPNext, and X POS are configured as recursive Git submodules under the conventional `apps/` paths.
- The parent repository records immutable upstream gitlinks; this preserves each upstream repository's provenance and history. It is not a copied source snapshot or a fork.
- The custom AL-NASR Frappe app is a Python package inside this monorepo at `apps/alnasr`; it is not an independent Git repository.
- Bench initialization from the pinned local Frappe source has succeeded in CI. The first integration attempt then failed because `bench get-app` expected the monorepo package path to be a Git repository. The workflow was corrected to symlink the package into the disposable Bench and install it editable.
- The corrected integration run is pending. Site creation, migrations, and app runtime have not yet been verified.

## Pinned upstream revisions

| Component | Upstream | Branch / version | Pinned commit | Repository path |
|---|---|---|---|---|
| Frappe Framework | `frappe/frappe` | v16.56.0 | `49789a1711d4dde2be9c6888efe35651465f4b64` | `apps/frappe` |
| ERPNext | `frappe/erpnext` | v16.55.0 | `8e10a348daaa93853de8c36dc55ec789a440c219` | `apps/erpnext` |
| X POS | `kodlyft/xpos` | version-16 / 2.13.4 | `3668fca6ffcab737347d4d223ac93f5d74aa90b3` | `apps/xpos` |
| AL-NASR | this repository | custom app 0.1.0 | branch-owned source | `apps/alnasr` |

The exact SHA values are pinned by the parent repository's submodule entries and checked by `scripts/bootstrap-upstream.sh`.

## Source checkout and validation

- Source validation run [#100](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43296072126) passed on commit `773de827cba56f4ef8111dbe3511bcb48d476403`.
- The run passed recursive checkout, exact upstream SHA verification, custom-app metadata validation, Python compilation, SVG contract tests, source/wheel package builds, and `git diff --check`.
- The latest source validation run [#102](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43297298964) is running against the workflow correction commit `ed8c9e737e451f41171c47e3fcfaf8ca3f78428d`.
- These checks prove source retrieval and package-level contracts only; they do not prove successful site installation or business workflows.

## Runtime integration attempts

- Runtime attempt [#1](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43296072340) successfully checked out the pinned sources, installed system prerequisites, set up Python 3.14 and Node.js 24, installed Bench, and initialized a clean Bench from local Frappe.
- That attempt failed when `bench get-app file://.../apps/alnasr` raised `InvalidGitRepositoryError`: the custom app is inside the parent monorepo, not a standalone Git repository. It did not create a site or run migrations.
- The integration workflow now links `apps/alnasr` into the disposable Bench and installs it editable with the Bench virtual environment's pip, without inventing a nested Git repository.
- Corrected runtime attempt [#2](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43297299228) is running. The app-add step, build, site creation, migrations, and HTTP health check are not yet confirmed.

## Import and modification policy

1. Preserve upstream Git history, immutable commit IDs, license files, and copyright notices.
2. Do not patch files inside the Frappe, ERPNext, or X POS submodules.
3. Implement AL-NASR behavior in `apps/alnasr` and supported extension points.
4. Do not duplicate standard ERPNext DocTypes for items, warehouses, stock ledger, sales/purchase invoices, suppliers, customers, payments, or general ledger.
5. Keep local databases, caches, build outputs, secrets, credentials, and live business data out of Git.
6. Do not describe submodule linking, Bench initialization, or source validation as a completed runtime installation.

## Next required operation

Complete the corrected disposable integration workflow:

1. Add ERPNext and X POS from their pinned local Git checkouts.
2. Link and install the monorepo AL-NASR package into Bench's virtual environment.
3. Build X POS and Frappe assets.
4. Create a disposable MariaDB-backed test site.
5. Install the apps in dependency order and record any failures, missing dependencies, hooks, or build issues.
6. Run migrations only on that disposable site.
7. Verify the site boots, the Desk loads, and the installed app list and versions match the pinned baseline.
8. Continue to POS, inventory, accounting, permissions, RTL, and device-level acceptance tests only after the install gate passes.

## Current release boundary

Draft PR #1 remains unmerged. Do not mark it ready for review, merge it, deploy it, or run production migrations without explicit authorization. The project is a source-integrated foundation, not a production-ready supermarket system.
