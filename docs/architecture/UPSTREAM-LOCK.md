# AL-NASR upstream source lock

**Status:** Immutable upstream revisions verified and linked as Git submodules. A clean disposable Bench integration run passed on 2026-11-14; production deployment and physical-device acceptance remain unverified.

| Component | Source | Immutable revision | Upstream version/date | Status |
|---|---|---|---|---|
| Frappe Framework | https://github.com/frappe/frappe | `49789a1711d4dde2be9c6888efe35651465f4b64` | 16.56.0 · 2026-11-10 | Verified and pinned; clean Bench initialization and framework import passed in CI run `43604127743` |
| ERPNext | https://github.com/frappe/erpnext | `8e10a348daaa93853de8c36dc55ec789a440c219` | 16.55.0 · 2026-11-12 | Verified and pinned; installed and migrated on disposable CI site; six core suites passed in run `43604127743` |
| X POS | https://github.com/kodlyft/xpos | `3668fca6ffcab737347d4d223ac93f5d74aa90b3` | 2.13.4 · 2026-11-10 | Verified and pinned; frontend build, 449 frontend tests, backend retry/shift tests and AL-NASR integration passed in run `43604127743` |

## Runtime and Bench dependency metadata

The Frappe `version-16` branch `pyproject.toml` inspected for this baseline declares Python `>=3.14,<3.15`. The X POS `version-16` README also lists Python >=3.14, Frappe v16, ERPNext v16, and Node.js >=24 for builds.

The AL-NASR app therefore declares Python `>=3.14,<3.15`. The inspected ERPNext v16.55.0 metadata requires Frappe `>=16.55.0`, so the AL-NASR app now sets both Bench compatibility lower bounds to `16.55.0` and upper bounds below `17.0.0`. Frappe and ERPNext compatibility ranges are declared under `[tool.bench.frappe-dependencies]`, not as ordinary PyPI project dependencies. The immutable upstream revisions are now recorded in the table above. They were installed together in a clean disposable Bench during GitHub Actions run `43604127743` (commit `3611f92c9f3df6adc2b915e15e4abbdda34b7c71`). The run installed ERPNext, X POS, and AL-NASR, ran migrations against its temporary MariaDB site, verified the installed apps, and passed the Frappe HTTP health check. This evidence does not establish a persistent production deployment, Windows host runtime, Android client, or hardware compatibility.

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

The three upstream commit objects are pinned as recursive Git submodules. A clean Bench installation, app installation, disposable-site migrations, POS runtime contracts, and HTTP health check passed in CI run `43604127743`. Remaining acceptance includes a repeatable local deployment lifecycle, persistent database backup/restore, offline/LAN reconciliation under device conditions, physical Windows/Android installation, printers/barcode scanners, and full visual brand verification.
