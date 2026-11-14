# AL-NASR local runtime deployment

This folder contains the first implementation of the single-Windows-PC runtime path.

## Current contents

- `Dockerfile`: builds an AL-NASR image from the pinned ERPNext v16.55.0 image and adds the custom app from this repository.
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

1. Copy `.env.example` to `.env` in this directory.
2. Replace `DB_PASSWORD` with a strong unique random value. Keep `.env` private; Git ignores it.
3. From PowerShell at the repository root, run:

   ```powershell
   .\deploy\windows\alnasr.ps1 -Action build
   .\deploy\windows\alnasr.ps1 -Action init
   .\deploy\windows\alnasr.ps1 -Action status
   .\deploy\windows\alnasr.ps1 -Action open
   ```

4. Create a unique Administrator password when prompted. The setup script passes it to the one-time site-creation process through standard input rather than writing it to the repository.
5. Use `-Action backup` to create a Frappe backup.

## Important limitations — not a release installer

This is an engineering deployment scaffold, not the promised consumer installer. It has not yet been built or run on a real Windows PC. The following remain release blockers:

- Build the custom image and verify the upstream image tag, pinned X POS/AL-NASR Python packages, frontend build, and runtime version compatibility end to end.
- Verify clean site creation, migrations, health, restart persistence, and complete backup/restore.
- Verify the Caddy TLS gateway, CA export/trust process, mDNS hostname resolution, and explicit Android pairing on the actual private LAN. The default bind address is loopback only; do not change it to `0.0.0.0` until firewall and certificate acceptance are complete.
- Add a tested installer wizard (for example, NSIS/Inno Setup) that checks prerequisites and installs/updates the launcher without deleting database volumes.
- Add signed Android packaging only after HTTPS, session, navigation, file handling, and device tests pass.
- Validate receipt printing, barcode scanning, offline/retry behavior, and owner acceptance on actual devices.

Do not use production data or real store credentials in this preview. Do not run `docker compose down -v`; that deletes persistent database/site volumes.
