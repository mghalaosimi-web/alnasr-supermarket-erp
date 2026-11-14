# ADR: Fully offline Windows host for AL-NASR ERP

**Status:** Proposed; implementation and hardware acceptance are not complete  
**Date:** 2026-11-14  
**Decision owner:** AL-NASR project  
**Supersedes:** Docker Desktop prerequisite in the current Windows preview

## Context

The current `AL-NASR-Setup.exe` embeds the Linux runtime images (AL-NASR/Frappe/ERPNext/X POS, MariaDB, Redis and Caddy), but its PowerShell lifecycle script calls the Windows Docker CLI and explicitly requires Docker Desktop with its WSL2 Linux engine already running. The current EXE therefore is not a self-contained offline host installer.

The required product behavior is:
- One Windows installer experience (Next / Install / Finish).
- No internet connection required during installation or normal operation.
- One local Windows PC hosts the ERP and database; Android connects to that PC over the local network.
- ERPNext, X POS and AL-NASR are one installed product, not separate applications.
- Persistent business data survives application upgrades and uninstallation of the launcher.
- No paid cloud service or runtime registry access.

## Decision direction

Replace Docker Desktop as a runtime prerequisite with a **dedicated WSL2 Linux distribution owned by AL-NASR**, running the open-source Docker Engine / Compose plugin inside that distribution.

The final Windows installer should contain, subject to redistribution/license approval:
1. The pinned WSL offline installer package for supported x64 Windows versions.
2. A prebuilt, versioned AL-NASR WSL root filesystem tar containing the Linux OS baseline, systemd configuration, Docker Engine, Docker Compose plugin, and all required OS-level packages.
3. The existing verified AL-NASR container image archive and SHA-256 manifest.
4. Windows bootstrap, lifecycle, networking, backup and recovery scripts.
5. The complete ERPNext/Frappe + X POS + AL-NASR runtime configuration and documentation.

The Windows installer must not download packages, pull images, run `apt`, or contact a registry during installation. All runtime images must be imported from the bundled archive and every Compose image must retain `pull_policy: never`.

## First-run lifecycle

1. Preflight checks Windows x64, supported Windows build, CPU virtualization, available disk space, and administrator rights where needed.
2. Verify every bundled payload against a release manifest before changing Windows features or importing a distribution.
3. Enable the Windows Subsystem for Linux and Virtual Machine Platform optional features. If Windows requests a restart, stop cleanly, preserve setup state, and resume after reboot.
4. Install the bundled WSL package only after its version, signature and redistribution terms have been reviewed.
5. Import the bundled AL-NASR Linux rootfs as a dedicated WSL2 distribution (not the user's personal distro).
6. Start systemd and the Docker Engine inside the distribution; verify daemon readiness.
7. Copy the Compose project and private configuration into the Linux filesystem, set restrictive permissions, and import the verified runtime image archive.
8. Initialize the ERPNext site idempotently, install ERPNext, X POS and AL-NASR, then run migrations and health checks.
9. Configure LAN access deliberately. Prefer WSL mirrored networking only on supported Windows 11 22H2+ / WSL versions; otherwise use a tested Windows port-forwarding strategy. Open only the required private-network ports and never expose the ERP to public networks by default.
10. Create Start, Stop, Open, Backup and Restore shortcuts. Start must work after Windows reboot without internet.

## Networking and Android

- Loopback-only access is the safe default until the owner explicitly enables LAN pairing.
- The phone must connect to the Windows host's LAN address using HTTPS and a trusted local CA certificate.
- On supported Windows 11 22H2+ hosts, WSL mirrored networking can provide direct LAN reachability, but Hyper-V firewall policy must be configured explicitly and verified. The implementation must not assume that mirrored mode is available on all Windows versions.
- NAT-mode fallback must update forwarding when the WSL IP changes after reboot; a stale portproxy rule is not acceptable.
- mDNS names are optional convenience only. The Android app must support a manually entered LAN address.
- The system must not depend on internet DNS, public TLS issuance, cloud auth, remote APIs, or telemetry to complete local workflows.

## Windows platform boundary

A Windows EXE cannot replace the Windows operating system, firmware virtualization support, or missing Windows optional-feature component payloads. WSL2 requires supported Windows builds, the Virtual Machine Platform feature, hardware virtualization, and may require a reboot. Microsoft's documented offline WSL installation still requires enabling the Virtual Machine Platform optional component and installing the WSL package/distribution locally.

Accordingly, the release must declare its supported Windows editions/builds and must test clean machines. If a Windows image lacks the optional-feature payloads in its component store, the installer must stop with a precise offline-media remediation message; it must never silently access Windows Update or the internet.

## Why not bundle Docker Desktop

Docker Desktop is not the same thing as the open-source Docker Engine. Docker's current licensing distinguishes personal/small-business/education/open-source use from larger professional, government and commercial use. The AL-NASR product should not make Docker Desktop a mandatory dependency or redistribute its installer without a documented license review. Docker Engine / Moby components have separate open-source licensing.

## Payload and supply-chain requirements

- Pin WSL package version and source URL; verify Authenticode signature and SHA-256.
- Record the WSL distribution base image digest, OS package versions, Docker Engine/Compose versions, upstream Frappe/ERPNext/X POS revisions, and all image digests.
- Generate a machine-readable `release-manifest.json` containing file sizes and SHA-256 for every payload.
- Generate an SBOM and preserve upstream license notices for all bundled components.
- Never embed owner signing keys, production credentials, or database passwords in the installer.
- Keep business data in a separate persistent data directory / named volumes. Upgrade and uninstall tests must prove data preservation.
- The final EXE may be several gigabytes. Optimize compression only after the full payload is complete and verified; do not omit runtime components to reduce size.

## Required validation before calling this a complete offline release

1. Build all payloads in CI from pinned sources; verify signatures, hashes and license notices.
2. Install on a clean supported Windows x64 machine with internet physically disconnected.
3. If required, enable Windows features from the local component store, reboot, and resume installation without losing state.
4. Import the WSL distribution and runtime images without network access; verify Docker daemon and Compose.
5. Initialize the complete site; verify ERPNext, X POS and AL-NASR are installed and healthy.
6. Reboot Windows with internet disconnected; verify services auto-start and the site remains healthy.
7. Perform cashier login, product lookup, barcode input, checkout, receipt, purchase receipt, stock movement, accounting/GL posting and role restriction tests.
8. Connect Android over LAN/HTTPS with internet disabled; verify login, navigation, reconnect and supported workflows.
9. Verify backup, restore, upgrade and uninstall preservation on the actual host.
10. Sign the EXE and Android release with owner-controlled keys outside source control; publish SHA-256 checksums and SBOM.

## Current status

A first WSL rootfs build prototype now exists under `deploy/wsl/`, with `scripts/build-wsl-rootfs.sh` and a dedicated CI workflow. This only builds and inspects a Linux root filesystem; it does **not** yet import or boot that rootfs under WSL2, provision Windows features, install the WSL package, run Docker Engine as a WSL service, replace the current Docker Desktop-based lifecycle script, or prove clean-machine offline installation. The current Windows preview remains unchanged until the WSL host passes its own CI and physical-machine acceptance gates.

## References

- Microsoft, [Offline WSL installation](https://learn.microsoft.com/windows/wsl/install): install WSL from an MSI, enable Virtual Machine Platform, and install a local `.wsl` distribution.
- Microsoft, [Manual WSL installation](https://learn.microsoft.com/windows/wsl/install-manual): WSL and Virtual Machine Platform optional features, virtualization and restart requirements.
- Microsoft, [WSL networking](https://learn.microsoft.com/windows/wsl/networking): NAT behavior, mirrored networking on Windows 11 22H2+, LAN access and Hyper-V firewall configuration.
- Microsoft, [WSL configuration](https://learn.microsoft.com/windows/wsl/wsl-config): supported networking and firewall settings.
- Docker, [Docker Desktop license](https://docs.docker.com/subscription-billing/desktop-license): Docker Desktop subscription boundaries.
