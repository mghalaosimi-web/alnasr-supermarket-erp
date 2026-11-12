# AL-NASR upstream source lock

**Status:** Candidate pins recorded; not yet imported or installed in this repository.

| Component | Candidate source | Candidate revision | Status |
|---|---|---|---|
| Frappe Framework | https://github.com/frappe/frappe | `version-16` branch | Branch is moving; resolve to an immutable commit before deployment |
| ERPNext | https://github.com/frappe/erpnext | `version-16` branch | Branch is moving; resolve to an immutable commit before deployment |
| X POS | https://github.com/kodlyft/xpos | `version-16`, commit `3668fca6ffcab737347d4d223ac93f5d74aa90b3` | Candidate pinned revision; source import and integration tests not completed |

## Runtime and Bench dependency metadata

The Frappe `version-16` branch `pyproject.toml` inspected for this baseline declares Python `>=3.14,<3.15`. The X POS `version-16` README also lists Python >=3.14, Frappe v16, ERPNext v16, and Node.js >=24 for builds.

The AL-NASR app therefore declares Python `>=3.14,<3.15`. Frappe and ERPNext compatibility ranges are declared under `[tool.bench.frappe-dependencies]`, not as ordinary PyPI project dependencies. The exact installed revisions must still be pinned in the deployment lock record.

## X POS branch and desktop status

The current `version-16` README advertises Web, PWA, Electron desktop, and Hub & Spoke deployment, alongside offline queueing, split payments, returns, purchasing, shift management, barcode scanning, and RTL. These are upstream claims, not AL-NASR acceptance results.

The README identifies `develop` as the preparation branch for XPOS v3 and says the existing v16 release line is maintained separately. It also states that `version-16-hotfix` is not yet published and asks contributors to open an issue first for fixes to the existing v16 release.

AL-NASR must evaluate Web/PWA and Electron on actual target devices. Do not declare either desktop or offline behavior production-ready until packaging, device compatibility, persistence, recovery, idempotency, and reconciliation tests pass.

The separate `develop` branch is preparing XPOS v3 and is not the selected v16 baseline. Do not transfer its feature claims or architecture assumptions to the selected `version-16` branch.

## Licensing

- Frappe Framework and ERPNext are distributed under their upstream licenses; preserve their license files and notices.
- X POS upstream declares MIT; preserve its license and copyright notices if imported.
- AL-NASR custom code has its own license declaration. This does not relicense upstream components or remove their attribution.
- Complete a file-level license inventory before publishing any imported source snapshot.

## Import policy

Do not copy a partial tree and describe it as a complete upstream import. Prefer a Git fork/submodule/subtree or authenticated Git transport that preserves upstream provenance and history. Record source URL, immutable commit, import method, license, and verification evidence.

## Current status

No ERPNext, Frappe, or X POS source tree has been imported into this repository. No runtime install, migration, POS, or hardware test has been completed.
