# Fully offline Windows release acceptance gates

This checklist applies to the WSL2-hosted AL-NASR Windows release proposed in [WINDOWS-OFFLINE-HOST-ADR.md](../architecture/WINDOWS-OFFLINE-HOST-ADR.md). A checked box requires retained CI or physical-device evidence; source inspection alone is insufficient.

## Build-time payloads

- [ ] Pinned WSL x64 offline installer package included, Authenticode signature and SHA-256 verified.
- [ ] License and redistribution review recorded for WSL package and every bundled component.
- [ ] AL-NASR WSL rootfs built reproducibly from pinned base image and package versions.
- [ ] systemd, Docker Engine and Compose plugin start inside the imported WSL distribution.
- [ ] All four current runtime images (AL-NASR, MariaDB, Redis, Caddy) and any future dependencies included.
- [ ] Release manifest covers every payload and validates before installation.
- [ ] SBOM and third-party notices included.
- [ ] Installer size, free-space preflight and extraction capacity validated.

## Windows bootstrap

- [ ] Supported Windows editions/builds and x64-only scope documented.
- [ ] Firmware virtualization and Virtual Machine Platform checks implemented.
- [ ] WSL and Virtual Machine Platform features enabled with no online fallback.
- [ ] Missing Windows feature payload produces a clear local-media remediation message.
- [ ] Reboot/resume state machine tested; no duplicate distribution or destructive re-import.
- [ ] WSL package install is offline and signature-verified.
- [ ] Distribution import and first-run setup are idempotent.
- [ ] Docker Desktop is not required or invoked.

## Runtime and data

- [ ] Runtime image archive hash verified before import.
- [ ] Docker Engine starts automatically after Windows reboot.
- [ ] Compose uses local images only; no pull/build/apt/network registry fallback.
- [ ] ERPNext, X POS and AL-NASR site initialization succeeds offline.
- [ ] Database and files persist across stop/start, reboot, upgrade and launcher uninstall.
- [ ] Backup and restore are verified with a real test dataset.
- [ ] Logs and diagnostics are locally accessible without uploading data.

## Network and Android

- [ ] Loopback-only default retained.
- [ ] Explicit LAN enablement opens only required ports on Private profile.
- [ ] Mirrored mode tested on supported Windows 11 22H2+; NAT fallback tested separately.
- [ ] Android can connect using a manually entered LAN IP and trusted HTTPS CA.
- [ ] mDNS is optional, not a hard dependency.
- [ ] Sales and other representative flows complete with WAN disconnected.
- [ ] Reconnect after phone sleep, Windows reboot and Wi-Fi reconnect verified.

## Business acceptance

- [ ] Cashier roles and permissions.
- [ ] Product search, variants, barcode and price lists.
- [ ] POS cash sale, discounts, returns and receipt printing.
- [ ] Purchase order / purchase receipt / supplier invoice.
- [ ] Stock movement, valuation and stock reconciliation.
- [ ] Accounting entries and general ledger balance.
- [ ] Backup restore and data integrity after recovery.
- [ ] Arabic RTL, English LTR, reports and print formats.
- [ ] Owner acceptance recorded.

## Release

- [ ] Windows EXE signed with owner-controlled certificate.
- [ ] Android release APK signed with owner-controlled keystore.
- [ ] No signing key or production secret committed to Git.
- [ ] SHA-256 checksums, SBOM, version, supported Windows matrix and installation guide published.
- [ ] Clean supported Windows host completed install and acceptance with internet disconnected.
- [ ] Final PR review approved; merge and production actions separately authorized.
