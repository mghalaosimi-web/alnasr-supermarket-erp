# AL-NASR release gate status

**Checked:** 2026-11-14  
**Development branch:** `foundation/offline-release-bundle`  
**Latest source commit:** `1d3df65198eeabd1fd6c8343235d3da5d0ec083b`  
**Draft PR:** [#4](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/pull/4) → `foundation/alnasr-commerce-acceptance`

## What is present in source

- ERPNext/Frappe v16 base image pinned by digest.
- X POS v16 and AL-NASR custom app included in the application image build.
- Compose services for MariaDB, Redis, workers, scheduler, frontend, websocket and Caddy.
- Runtime image archive export and SHA-256 manifest in the deployment workflow.
- Windows installer source embeds the runtime image archive and manifest.
- First-run script verifies the archive hash, imports images locally, checks required image tags, and does not fall back to a network build.
- Every Compose service image has `pull_policy: never`.
- AL-NASR Desk landing page links to core ERPNext workflows and X POS.
- Android HTTPS WebView companion source and cross-surface source-contract tests.
- Unified interface contract document.

## Verified versus not verified

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Earlier ERPNext/X POS/AL-NASR automated tests | Passed on an earlier revision | 1,268 tests, 0 failures in run #43588327281; this is not the latest offline packaging commit |
| Earlier source validation | Passed on an earlier revision | Run #43588327377 |
| Offline Compose policy in source | Implemented, CI not confirmed on latest head | Four image families use `pull_policy: never`; latest exact-head check run not available |
| Offline archive creation | Workflow source present | Need successful run and inspect artifact size, manifest and hash |
| Windows EXE compilation | Workflow source present | Need successful Windows job and verified artifact |
| Installer file-layout test | Workflow source present | Need successful clean Windows runner install/uninstall |
| Docker Desktop / WSL2 bootstrap | Not implemented | Current installer requires them installed and running; therefore clean-PC zero-internet install is not met |
| Full unified visual theme | Partial | Shared Desk shell exists; global ERPNext, X POS, documents, reports and login require visual implementation and acceptance |
| Android debug APK | Build workflow/source present | No exact-head CI evidence and no physical-device test |
| Android LAN + HTTPS | Not tested on physical devices | mDNS, certificate trust, firewall, authentication and reconnect must pass |
| Business acceptance | Partial | POS/stock/tax/return regression coverage exists; full cashier, purchasing, stock valuation, GL, roles, hardware and receipt UAT remain |
| Release signing | Not done | Owner-controlled Windows/Android signing credentials must remain outside source control |

## Non-negotiable release rule

Do not label this build a complete, ready-to-use, zero-internet release until all of the following are true:
1. The Windows runtime prerequisites are installed from the same offline media or are already present; no hidden internet download is required.
2. A clean Windows machine installs the package, initializes the site, reboots, starts services, opens the system, and performs a sale with its network disconnected from the internet.
3. The Android phone pairs over the private LAN using trusted HTTPS and completes representative workflows without internet access.
4. Backup and restore pass against a disposable copy.
5. POS, inventory, accounting, permissions, Arabic RTL, English LTR, receipts, barcode and printer acceptance is recorded.
6. The exact release artifacts are signed, checksummed, and tested.

No production deployment, production migration, or PR merge is authorized by this status record.
