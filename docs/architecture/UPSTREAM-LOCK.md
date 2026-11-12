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

## X POS branch and desktop caveat

The selected `version-16` README advertises web/PWA operation and offline sales queueing. It also contains desktop/Electron feature descriptions but explicitly notes that the desktop app is under development and not ready for production. Therefore AL-NASR's initial deployment baseline is web/PWA; desktop is not a launch dependency.

The separate `develop` branch is preparing XPOS v3 and is not the stable v16 maintenance branch. Do not transfer its feature claims or architecture assumptions to the selected `version-16` branch.

## Licensing

- Frappe Framework and ERPNext are distributed under their upstream licenses; preserve their license files and notices.
- X POS upstream declares MIT; preserve its license and copyright notices if imported.
- AL-NASR custom code has its own license declaration. This does not relicense upstream components or remove their attribution.
- Complete a file-level license inventory before publishing any imported source snapshot.

## Import policy

Do not copy a partial tree and describe it as a complete upstream import. Prefer a Git fork/submodule/subtree or authenticated Git transport that preserves upstream provenance and history. Record source URL, immutable commit, import method, license, and verification evidence.

## Current status

No ERPNext, Frappe, or X POS source tree has been imported into this repository. No runtime install, migration, POS, or hardware test has been completed.
