# AL-NASR release gate status

**Checked:** 2026-11-14 22:03 Yemen time  
**Development branch:** `foundation/offline-release-bundle`  
**Verified source commit:** `fba1294e1c8337d91b9665ae385aa85564293747`  
**Draft PR:** [#4](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/pull/4) → `foundation/alnasr-commerce-acceptance`

## Exact-head CI evidence

All three workflows below ran against the exact source commit above:

| Workflow | Run | Result | What this proves |
|---|---:|---|---|
| AL-NASR app validation | [#450](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43626011522) | Passed | Automated app validation, including Python source contracts and app checks |
| AL-NASR Android client validation | [#35](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43626011525) | Passed | Android Debug APK build completed and artifact uploaded |
| AL-NASR local deployment validation | [#96](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43626011472) | Passed | Immutable upstream verification, custom runtime image build, Compose no-pull config, disposable site installation, app registration, HTTP health, backup/restore, TLS smoke tests, image export, Windows installer compile and isolated install/uninstall file-layout test |

### Build artifacts from the exact commit

- **Windows installer preview:** [Actions run #96](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43626011472) → artifact `AL-NASR-Windows-Installer-Preview`; ZIP size 2,280,759,195 bytes; artifact SHA-256 `5bd0138802057f909151af5be22975ced9f3d2d6e41e44f026cc7bcf3d297181`.
- **Offline runtime image bundle:** same run #96 → artifact `AL-NASR-Offline-Runtime-Images`; ZIP size 2,277,963,954 bytes; artifact SHA-256 `de744cc3ac3f14527d2fa8e550e01b30f05c2f1d3f4103031a1f8eeaa22464a5`.
- **Android Debug preview:** [Actions run #35](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43626011525) → artifact `AL-NASR-Android-Debug-Preview`; ZIP size 811,828 bytes; artifact SHA-256 `278e91a4caaa338b1a4f8d7e32754d782bb05385b1a7d026f2c31438240bfd1a`.

The Windows installer and offline image artifact are very large (about 2.28 GB each). They are retained as GitHub Actions artifacts for 30 days and may not be downloadable through clients that impose a 512 MB artifact-transfer limit. This is a distribution-size concern, not a failed build.

## What is present in source

- ERPNext/Frappe v16 base image pinned by digest.
- X POS v16 and AL-NASR custom app included in the application image build.
- Compose services for MariaDB, Redis, workers, scheduler, frontend, websocket and Caddy.
- Offline runtime image archive export and SHA-256 manifest.
- Windows installer embeds the archive and checksum manifest.
- First-run script verifies the archive hash, imports images locally, checks required image tags, and has no network-build fallback.
- Every Compose service image has `pull_policy: never`.
- AL-NASR Desk landing page links to core ERPNext workflows and X POS.
- Android HTTPS WebView companion source and cross-surface source-contract tests.
- Unified interface contract document.

## Verified versus not verified

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Exact-head app validation | Passed | Workflow run #43626011522 |
| Exact-head Android Debug build | Passed | Workflow run #43626011525; APK is unsigned Debug preview |
| Runtime image build | Passed | Workflow run #43626011472 |
| Disposable Compose/site initialization | Passed | ERPNext, X POS and AL-NASR app installation/list-apps checks passed |
| HTTP health and local TLS | Passed | CI smoke checks passed using generated local Caddy CA |
| Backup and restore smoke test | Passed | CI ran backup with files, restored the disposable site, migrated and rechecked health |
| Offline image export and checksum | Passed | Artifact uploaded; Windows job verified archive size and SHA-256 |
| Windows EXE compilation | Passed | Unsigned installer preview artifact created |
| Windows installer file layout + uninstall preservation | Passed | Isolated Windows runner installed/uninstalled preview and confirmed owner data sentinel survived |
| Windows first-run Docker import and site creation | Not tested on Windows | Runtime execution was exercised in Linux CI; Windows runner test only checked installer layout/uninstall |
| Docker Desktop / WSL2 bootstrap | Not implemented | Current installer requires Docker Desktop with WSL2 Linux engine installed and running |
| Clean-PC zero-internet install | Not met | No bundled Docker Desktop/WSL2/kernel/Windows optional-feature payloads |
| Full unified visual theme | Partial | Shared Desk shell exists; ERPNext screens, X POS screens, documents, reports and login need implementation and visual acceptance |
| Android LAN + HTTPS | Not tested on physical devices | mDNS, certificate installation/trust, firewall, authentication and reconnect need device testing |
| Business acceptance | Partial | Automated regression and smoke tests are not a substitute for cashier/purchasing/stock valuation/GL/roles/hardware/receipt UAT |
| Release signing | Not done | Owner-controlled Windows and Android signing credentials must remain outside source control |
| Distribution optimization | Pending | Current Windows artifact is about 2.28 GB; evaluate split downloads or better compression without breaking offline integrity |

## Non-negotiable release rule

Do not label this build a complete, ready-to-use, zero-internet release until all of the following are true:

1. Windows runtime prerequisites are installed from approved offline media or already present; no hidden internet download is required.
2. A clean Windows machine imports the runtime images, initializes the site, reboots, starts services, opens the system and performs a sale with internet disconnected.
3. The Android phone pairs over the private LAN using trusted HTTPS and completes representative workflows without internet.
4. Backup and restore pass on the actual Windows-hosted deployment, not only the Linux CI disposable environment.
5. POS, inventory, accounting, permissions, Arabic RTL, English LTR, receipts, barcode and printer acceptance is recorded.
6. The exact release artifacts are signed, checksummed, and tested.

No production deployment, production-data migration, or PR merge is authorized by this status record.
