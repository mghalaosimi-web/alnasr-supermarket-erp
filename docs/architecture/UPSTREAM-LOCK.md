# AL-NASR upstream source lock

**Status:** Candidate pins recorded; not yet imported or installed in this repository.

| Component | Candidate source | Candidate revision | Status |
|---|---|---|---|
| Frappe Framework | https://github.com/frappe/frappe | `version-16` branch | Branch is moving; resolve to an immutable commit before deployment |
| ERPNext | https://github.com/frappe/erpnext | `version-16` branch | Branch is moving; resolve to an immutable commit before deployment |
| X POS | https://github.com/kodlyft/xpos | `version-16`, commit `3668fca6ffcab737347d4d223ac93f5d74aa90b3` | Candidate pinned revision; source import and integration tests not completed |

## Runtime compatibility observation

The Frappe `version-16` branch `pyproject.toml` inspected for this baseline declares:

- Python: `>=3.14,<3.15`
- Build backend: Flit
- Flit build requirement: `flit_core >=3.12,<4`

The AL-NASR custom app metadata must remain compatible with the exact Frappe revision selected for deployment. Re-check these values after pinning the upstream commit.

## Licensing

- Frappe Framework and ERPNext are distributed under their upstream licenses; preserve their license files and notices.
- X POS upstream declares MIT; preserve its license and copyright notices if imported.
- AL-NASR custom code has its own license declaration. This does not relicense upstream components or remove their attribution.
- Complete a file-level license inventory before publishing any imported source snapshot.

## Import policy

Do not copy a partial tree and describe it as a complete upstream import. Prefer a Git fork/submodule/subtree or authenticated Git transport that preserves upstream provenance and history. Record source URL, immutable commit, import method, license, and verification evidence.

## Current status

No ERPNext, Frappe, or X POS source tree has been imported into this repository. No runtime install, migration, POS, or hardware test has been completed.
