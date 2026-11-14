# AL-NASR release gate status

**Checked:** 2026-11-14  
**Development branch:** `foundation/offline-release-bundle`  
**Latest validated source commit:** `d1d3e3e02df9f9c0d2406b627c91465a30d613f9`  
**Draft PR:** [#4](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/pull/4) → `foundation/alnasr-commerce-acceptance`

## Latest exact-head CI evidence

All workflows below completed successfully against the latest source commit:

| Workflow | Run | Result |
|---|---:|---|
| AL-NASR app validation | [#464](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43631002178) | Passed |
| AL-NASR Android client validation | [#42](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43631002197) | Passed |
| AL-NASR local deployment validation | [#108](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43631002204) | Passed |

### What deployment run #108 verified

- Verified immutable upstream revisions and built the AL-NASR runtime image from the pinned ERPNext/Frappe base plus X POS and AL-NASR apps.
- Validated Compose configuration without image pulls and checked that every service image uses `pull_policy: never`.
- Created a disposable Frappe site and installed ERPNext, X POS and AL-NASR; verified all three apps are registered.
- Passed HTTP health and local HTTPS/TLS checks using the generated Caddy internal CA.
- Created a full backup with files, restored the disposable site, ran migrations and rechecked health.
- Exported the complete runtime image bundle and uploaded it.
- Compiled the Windows installer on a Windows runner, verified the embedded archive SHA-256, installed and uninstalled the installer in an isolated Windows profile, and confirmed owner data survives uninstall.
- Parsed the Windows PowerShell lifecycle script successfully.

**Important test boundary:** the Windows runner tested installer compilation, file layout, installation and uninstall preservation. It did not launch Docker, import the images into a Windows Docker Engine, initialize the ERP site on Windows, or perform a real sale on a Windows host. The operational Compose/site/backup/restore/TLS tests ran in Linux CI.

## Latest build artifacts

All artifacts below were produced by run #108 or run #42 from the latest validated commit and are retained by GitHub Actions until **2026-12-14** (30-day retention):

- **Windows installer preview:** artifact `AL-NASR-Windows-Installer-Preview` in [run #108](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43631002204). ZIP size: 2,280,762,351 bytes. Artifact SHA-256: `c1d0eec5589d7dbe5fca2a755ab3d79be62cd7a0bd758c95e3a6bb704e34d5ed`. The EXE is an unsigned release preview; it is not production-signed.
- **Offline runtime image bundle:** artifact `AL-NASR-Offline-Runtime-Images` in [run #108](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43631002204). ZIP size: 2,277,965,742 bytes. Artifact SHA-256: `669ac7b4a6fb01b2626611c7add2bb918960e70e565e94889c9dc83c2399e2f5`.
- **Android Debug preview:** artifact `AL-NASR-Android-Debug-Preview` in [run #42](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43631002197). ZIP size: 811,827 bytes. Artifact SHA-256: `5714320c7d6639c55798af6c437e734da96af2e914e28cc9d7b5d98a75df488f`. Extracted APK SHA-256: `5a7aff78ac8f7395b07b2ab84b0a23ac53f5beb7cc88227f82c84d9438c96d56`. This is a Debug build using the Android debug signing configuration, not a production-signed release APK.

The Windows installer and image bundle are about 2.28 GB each. Some artifact clients enforce a 512 MB transfer limit; download these large artifacts directly from the GitHub Actions run page. The artifacts expire after the retention date unless preserved in a separately approved release.

## Implemented in source

- ERPNext/Frappe v16 base image pinned by digest.
- X POS v16 and AL-NASR custom app included in the local runtime image.
- Compose services for MariaDB, Redis, workers, scheduler, frontend, websocket and Caddy.
- Complete runtime image archive export and SHA-256 manifest.
- Windows installer embeds the runtime image archive and manifest.
- First-run script verifies the archive, imports images locally, checks all required image tags, and has no network-build fallback.
- Compose uses `pull_policy: never` for all image-backed services.
- Windows setup is retry-safe: it distinguishes an existing site from a missing site, installs missing required apps, migrates an existing site, and fails closed if site state cannot be determined.
- AL-NASR Desk landing page links to ERPNext workflows and X POS.
- X POS brand defaults are applied through its supported `XPOS Branding Settings` singleton fields; upstream Vue source is not patched.
- Regression tests cover X POS brand defaults, administrator overrides, idempotency and missing-DocType behavior.
- Android HTTPS WebView companion client and source-contract tests.
- Unified interface contract and brand implementation matrix.

## Verified versus not verified

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Latest app validation | Passed | Run #464 |
| Latest Android Debug build | Passed | Run #42; no physical-device acceptance yet |
| Latest runtime image build | Passed | Run #108 |
| Disposable Compose/site initialization | Passed | Run #108; ERPNext, X POS and AL-NASR registered |
| HTTP health and local TLS | Passed | Run #108 |
| Backup and restore smoke test | Passed | Run #108; disposable Linux CI site, not Windows host |
| Offline image export and checksum | Passed | Run #108 |
| Latest Windows EXE compilation | Passed | Run #108; unsigned preview |
| Latest Windows installer file-layout/install/uninstall test | Passed | Run #108; owner data sentinel survived uninstall |
| Windows first-run Docker import and site creation | Not tested on Windows | PowerShell parser and installer test passed, but Windows Docker runtime was not launched |
| Docker Desktop / WSL2 bootstrap | Not implemented | Installer requires Docker Desktop with WSL2 Linux engine installed and running |
| Clean-PC zero-internet install | Not met | Docker Desktop, WSL2 kernel and Windows optional-feature payloads are not bundled |
| Full unified visual theme | Partial | Supported X POS palette/logo integration and AL-NASR Desk shell exist; global ERPNext screens, full X POS screen review, login, forms, reports, documents and print layouts still need visual implementation/acceptance |
| Android LAN + HTTPS | Not tested on physical devices | mDNS, CA installation/trust, firewall, authentication, reconnect and real cashier workflows need device testing |
| Business acceptance | Partial | CI smoke/regression is not a substitute for cashier, purchasing, stock valuation, GL, roles, barcode, printer and receipt UAT |
| Production signing | Not done | Windows EXE is unsigned; Android artifact is Debug-signed only. Owner-controlled release signing credentials must remain outside source control |
| Distribution optimization | Pending | Current Windows installer and runtime image artifacts are each about 2.28 GB |

## Non-negotiable release rule

Do not label this a complete, ready-to-use, zero-internet release until all of the following are true:

1. Windows runtime prerequisites are installed from approved offline media or already present; no hidden internet download is required.
2. A clean supported Windows machine imports the runtime images, initializes the site, reboots, starts services, opens the system and completes a real sale with internet disconnected.
3. The Android phone pairs over the private LAN using trusted HTTPS and completes representative workflows without internet.
4. Backup and restore pass against the actual Windows-hosted deployment, not only the Linux CI disposable environment.
5. POS, inventory, accounting, permissions, Arabic RTL, English LTR, receipts, barcode and printer acceptance is recorded.
6. The exact release artifacts are production-signed, checksummed and tested.

No production deployment, production-data migration, or PR merge is authorized by this status record.
