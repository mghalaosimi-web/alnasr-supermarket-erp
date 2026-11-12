# Deployment baseline

## Target topology

- One Frappe/ERPNext v16 server on the store LAN.
- Database and Redis services managed according to the pinned Frappe deployment method.
- POS terminals connect to the local server over LAN.
- Electron desktop/PWA behavior is enabled only after the selected X POS v16 build is imported and tested.
- Remote access is a separate secured path; do not expose database or Redis ports publicly.

## Source of deployment truth

Use the official Frappe Docker deployment repository and its version-appropriate configuration as the starting point:
https://github.com/frappe/frappe_docker

Do not invent a compose stack by mixing unpinned images. Record image tags/digests and the exact bench/app revisions in the deployment lock record.

## Required environment configuration

- Site hostname
- Database credentials
- Administrator bootstrap secret
- Encryption and signing secrets
- SMTP configuration if enabled
- Backup destination and encryption key
- Timezone, currency, locale, and business tax settings

All values above belong in a secret manager or deployment environment, never in Git.

## Operational gates

- Persistent volumes and database backup schedule are defined.
- Restore is tested on a separate environment.
- Health checks cover web, workers, scheduler, database, and Redis.
- LAN outage and internet outage are tested separately.
- Upgrade procedure includes backup, migration, smoke tests, and rollback plan.
