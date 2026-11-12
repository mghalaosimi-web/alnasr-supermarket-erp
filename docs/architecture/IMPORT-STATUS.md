# Upstream source import status

**Review date:** 2026-11-12  
**Target repository:** `mghalaosimi-web/alnasr-supermarket-erp`  
**Selected upstream:** `kodlyft/xpos`  
**Upstream ref:** `version-16`  
**Pinned commit:** `3668fca6ffcab737347d4d223ac93f5d74aa90b3`

## Confirmed repository state

- AL-NASR repository visibility is **public**.
- Default branch is `main`.
- GitHub reports write/admin permission for the connected account.
- The repository currently contains the AL-NASR bootstrap documentation and ignore rules only; the X POS source has **not** been imported.
- No customer, sales, employee, supplier, or other live store data has been committed.

## Upstream tree inventory

The pinned X POS commit exposes a recursive Git tree containing 1,050 entries: 894 files and 156 directories. This is a substantial source import, not a small collection of files.

## Import integrity requirements

The import must:
1. Preserve the exact upstream commit identity and, preferably, the upstream Git history.
2. Retain the complete MIT LICENSE and upstream copyright notices.
3. Avoid copying build outputs, caches, local databases, credentials, or environment files.
4. Record the upstream URL, branch, commit SHA, import date, and all AL-NASR patches.
5. Keep upstream X POS changes separable from AL-NASR customizations.

## Import method selected: pinned Git submodules

The three immutable upstream commits were rechecked directly against their official Git repositories on 2026-11-12 and all three commit objects resolve:

- Frappe: `49789a1711d4dde2be9c6888efe35651465f4b64`
- ERPNext: `8e10a348daaa93853de8c36dc55ec789a440c219`
- X POS: `3668fca6ffcab737347d4d223ac93f5d74aa90b3`

Use Git submodules at the conventional Bench paths so each component retains its own upstream Git history and license metadata:

- `apps/frappe` → `https://github.com/frappe/frappe.git`
- `apps/erpnext` → `https://github.com/frappe/erpnext.git`
- `apps/xpos` → `https://github.com/kodlyft/xpos.git`
- `apps/alnasr` remains the AL-NASR-owned custom app.

The parent repository records each exact upstream commit as a gitlink. A recursive clone or `git submodule update --init --recursive` materializes the source trees. The submodule pointer is not a fork and does not transfer ownership of upstream code.

## Import integrity and verification

1. Keep the exact immutable commit IDs in the parent repository's gitlinks.
2. Preserve each upstream LICENSE file and commit history through the submodule relationship.
3. Add a bootstrap verification script that checks the checked-out commit for each submodule.
4. Do not patch upstream submodule files; maintain AL-NASR behavior in `apps/alnasr` and supported extension points.
5. Verify submodule status after clone and before any Bench installation.

**Current execution boundary:** The selected upstream commits are verified, but the gitlinks and submodule initialization have not yet been confirmed in a clean clone. A submodule pointer alone is not proof that the runtime or integration works.

## Next required operation

Commit the three pinned submodule references and bootstrap verifier, then perform a recursive clean clone and verify each submodule SHA before building a disposable Frappe Bench.

## Public repository safety

Because this repository is public, commit only source code, public documentation, sanitized examples, and non-sensitive configuration templates. Keep all secrets in deployment environment variables or a secrets manager. Never commit production database dumps, customer records, real invoices, or backup archives.
