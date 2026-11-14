# AL-NASR WSL2 host rootfs (engineering preview)

This directory builds the Linux userspace that will be imported as a dedicated WSL2 distribution. It is intended to remove the Docker Desktop dependency by running the open-source Docker Engine and Compose plugin inside AL-NASR's own WSL distribution.

## Build

Run `scripts/build-wsl-rootfs.sh` on a Linux host with Docker Engine. The output is:
- `dist/wsl/alnasr-wsl-rootfs.tar`
- `dist/wsl/SHA256SUMS.txt`

The rootfs contains Ubuntu 24.04, systemd, Docker Engine, Docker Compose v2 and basic networking utilities. It does not contain the AL-NASR application images; those remain in the separate verified runtime image archive.

## Current boundary

This is a build-time rootfs prototype only. It is not yet imported or boot-tested under WSL2, and it is not yet included in the Windows installer. Before distribution, the project must:
1. Test WSL import, systemd boot, Docker daemon startup, Compose and image loading on clean Windows 11 x64 hosts.
2. Test Windows 10 support separately or explicitly exclude it.
3. Pin and record the exact Ubuntu and Docker package versions and generate an SBOM.
4. Review all licenses and redistribution terms for the rootfs packages.
5. Add a signed/pinned WSL offline installer payload and handle Windows optional-feature enablement/reboot without internet.
6. Verify LAN networking and firewall behavior with a physical Android phone.

Never use this rootfs prototype as a production host until those gates pass.
