# AL-NASR local runtime deployment

This folder contains the first implementation of the single-Windows-PC runtime path.

## Current contents

- `Dockerfile`: builds an AL-NASR image from the immutable multi-architecture ERPNext v16.55.0 image digest and adds the custom app from this repository.
- `compose.yaml`: local Frappe services, MariaDB 11.8, Redis cache/queue, workers, scheduler, and frontend.
- `.env.example`: non-secret configuration template.
- `windows/alnasr.ps1`: Windows lifecycle commands for image build, start, stop, restart, status, open, first-site initialization, and backup.

## Prerequisites

- Supported 64-bit Windows version with virtualization enabled.
- Docker Desktop using its WSL2 Linux engine.
- Docker Compose v2.
- Enough disk space for the Linux images, MariaDB volume, site files, and backups.

The script does not silently enable Windows features, install Docker Desktop, or bypass Administrator approval. Those steps require the PC owner's consent and may require a reboot.

## First local setup (engineering preview)

1. Install Docker Desktop with the WSL2 Linux engine and start it.
2. Install the AL-NASR Windows installer preview and choose **First-time setup** from the Start Menu, or run the PowerShell setup action from the repository root.
3. The setup action generates a unique database secret under `%LOCALAPPDATA%\\AL-NASR ERP\\.env`, builds the local image, initializes the site with ERPNext, X POS and AL-NASR, then starts the services.
4. Create a unique Administrator password when prompted. The script passes it through standard input rather than writing it to the repository or command history.
5. Use the Backup shortcut to create a Frappe backup. The Restore shortcut lists complete database/public/private backups, creates a safety backup first, requires typing RESTORE, then restores and checks HTTP health.
6. For phone pairing, export the Caddy CA with the export-cert action, install it on Android, then change `LAN_BIND_ADDRESS=0.0.0.0` in the private local .env only on a trusted private Wi-Fi network. Configure Windows Firewall for TCP 443 on the Private profile. Do not expose the service publicly.

## Important limitations — not a release installer

This is an engineering deployment scaffold plus an unsigned installer preview, not an accepted consumer release. It has not yet been built or run on a real Windows PC. The following remain release blockers:

- Build the custom image and verify the upstream image tag, pinned X POS/AL-NASR Python packages, frontend build, and runtime version compatibility end to end.
- Verify clean site creation, migrations, health, restart persistence, and complete backup/restore.
- Verify the Caddy TLS gateway, CA export/trust process, mDNS hostname resolution, and explicit Android pairing on the actual private LAN. The default bind address is loopback only; do not change it to `0.0.0.0` until firewall and certificate acceptance are complete.
- Validate the Inno Setup installer on a clean Windows PC, including prerequisites, upgrades, uninstall preservation, and the unsigned SmartScreen experience. The current installer is a CI preview, not a signed release.
- Build a signed Android release only after the debug APK, HTTPS pairing, session, navigation, file handling, and physical-device tests pass.
- Validate receipt printing, barcode scanning, offline/retry behavior, and owner acceptance on actual devices.

Do not use production data or real store credentials in this preview. Do not run `docker compose down -v`; that deletes persistent database/site volumes.
