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

## Current execution constraint

The available GitHub integration supports individual file/blob/tree/commit operations, but does not expose a repository fork/import operation or a bulk archive push. The previous temporary Git transport environment did not have working GitHub push credentials and its compute allowance was exhausted. Therefore, attempting to reconstruct and push 894 files one by one would be error-prone and would not preserve upstream commit history.

**Decision:** Do not create a partial or misleading source import. Do not replace the upstream history with a fabricated snapshot. Complete the import through an authenticated Git transport or GitHub fork/import workflow, then verify the resulting tree against the pinned upstream commit.

## Next required operation

Use an authenticated Git client with permission to push to this repository, or a GitHub fork/import workflow that can preserve upstream history. Once the source is present, continue with a clean Frappe/ERPNext v16 installation, X POS integration tests, and the AL-NASR custom app.

## Public repository safety

Because this repository is public, commit only source code, public documentation, sanitized examples, and non-sensitive configuration templates. Keep all secrets in deployment environment variables or a secrets manager. Never commit production database dumps, customer records, real invoices, or backup archives.
