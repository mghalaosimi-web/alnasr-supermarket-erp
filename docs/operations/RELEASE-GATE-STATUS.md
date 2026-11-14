# AL-NASR release gate status

**Checked:** 2026-11-14  
**Development branch:** `foundation/offline-release-bundle`  
**Latest verified source commit:** `3a93a6d1dd86f1f6ade25221a7670a4df5403334`  
**Draft PR:** [#4](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/pull/4) → `foundation/alnasr-commerce-acceptance`

## Exact-head CI evidence

All three validation workflows below ran against the exact source commit above:

| Workflow | Run | Result |
|---|---:|---|
| AL-NASR app validation | [#466](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43632113826) | Passed |
| AL-NASR Android client validation | [#43](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43632113819) | Passed |
| AL-NASR local deployment validation | [#109](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43632113820) | Runtime build, disposable Compose/site install, health, TLS, offline image export/upload, cleanup and image app-version checks passed; Windows installer build was queued separately when this record was updated |

### Exact-head artifacts

- **Offline runtime image bundle:** run #109 → artifact `AL-NASR-Offline-Runtime-Images`; 2,277,966,602 bytes; GitHub artifact ZIP digest `sha256:7d441c0d97a2ea24bd6b4ab3b614e3d6286c1693e870ac2a4e78d9204154a1aa`. [Open run #109](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43632113820).
- **Android Debug preview:** run #43 → artifact `AL-NASR-Android-Debug-Preview`; 811,827 bytes; GitHub artifact ZIP digest `sha256:a5a575b09d594a3c508f10e5ae7746346c7af66d28ee372622ce8bb01072b997`. The extracted APK SHA-256 is `34ffd7003e8d91af7775f416f9f7a1262f295edb69b7cda3238eae60ad41e349`. It is an unsigned Debug build, not a release-signed Android package.

The offline image artifact is approximately 2.28 GB. It is retained as a GitHub Actions artifact for 30 days. Large artifact downloads may be constrained by the client or transfer limits.

## Verified runtime scope

- ERPNext/Frappe v16 base image pinned to an immutable upstream digest.
- X POS v16 and AL-NASR custom app included in the local runtime image.
- MariaDB 11.8, Redis 8.6-alpine and Caddy 2.10-alpine service images included in the offline runtime export.
- Every Compose service image uses `pull_policy: never`.
- CI successfully built the AL-NASR runtime image, initialized a disposable Compose site, installed ERPNext/X POS/AL-NASR, ran HTTP health and local TLS smoke checks, exercised backup/restore, exported the complete runtime image bundle, uploaded it, cleaned up disposable services, and verified app versions are importable in the image.
- Windows lifecycle script parses successfully on a Windows runner.
- X POS branding is configured through the supported `XPOS Branding Settings` singleton; source tests cover default branding, administrator overrides, idempotency and absent DocType behavior.
- Android companion Debug APK builds successfully.

## Not yet proven / release blockers

| Gate | Status | Remaining evidence |
|---|---|---|
| Windows installer build | Queued at update time | Wait for Windows installer job to complete and inspect its artifact |
| Windows installer first-run on actual Windows host | Not tested | Import bundled images, initialize the site, reboot, start and use it |
| Docker Desktop / WSL2 bootstrap | Not implemented | Current installer requires Docker Desktop with WSL2 Linux engine installed and running |
| Clean-PC zero-internet installation | Not met | No bundled Docker Desktop/WSL2/kernel/Windows optional-feature payloads |
| Android LAN + HTTPS | Not tested on physical device | Pairing, trusted certificate, authentication, firewall, barcode/printing and reconnect |
| Full unified visual theme | Partial | ERPNext screens, X POS screens, login, invoices, reports and print formats need visual review and UAT |
| Business acceptance | Partial | Cashier, purchasing, stock valuation, accounting/GL, roles and hardware acceptance |
| Release signing | Not done | Owner-controlled Windows and Android signing credentials must remain outside source control |
| Distribution size | Needs optimization | Offline image bundle is approximately 2.28 GB |

## Installer lifecycle behavior

The Windows setup script imports the bundled images only after verifying the archive SHA-256, checks the required local image tags, and intentionally has no internet-build fallback. First-run initialization detects an existing site and can reconcile missing apps/apply migrations instead of blindly recreating the site. This behavior has passed source validation and PowerShell parsing; it still requires a real Windows runtime test.

## Non-negotiable release rule

Do not label this a complete, ready-to-use, zero-internet release until:
1. Docker/WSL prerequisites are present or provisioned from approved offline media on a supported clean Windows machine.
2. The actual Windows host imports images, initializes the site, survives reboot and performs a sale with internet disconnected.
3. Android pairs over the private LAN using trusted HTTPS and completes representative workflows without internet.
4. Backup and restore pass on the actual Windows-hosted deployment.
5. POS, inventory, accounting, permissions, Arabic RTL, English LTR, receipts, barcode and printer acceptance is recorded.
6. Exact release artifacts are signed, checksummed and tested.

No production deployment, production-data migration or PR merge is authorized by this status record.
