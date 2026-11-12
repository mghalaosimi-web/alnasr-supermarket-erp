# AL-NASR platform baseline

**Decision status:** Provisional engineering baseline  
**Date:** 2026-11-12

## Decision

Use ERPNext/Frappe v16 as the ERP foundation and evaluate X POS from the upstream kodlyft/xpos repository, branch version-16, as the primary point-of-sale foundation. Build AL-NASR-specific functionality in a separate custom Frappe app rather than patching ERPNext core.

## Evidence inspected

### ERPNext

- Upstream: https://github.com/frappe/erpnext
- Latest release observed during this review: v16.55.0 (2026-11-12).
- Repository metadata identifies the license as GNU GPL-3.0.
- ERPNext README describes accounting, order management, stock, procurement-related workflows, and the Frappe Framework foundation.

### X POS

- Upstream: https://github.com/kodlyft/xpos
- Selected candidate branch: version-16
- Reviewed commit: 3668fca6ffcab737347d4d223ac93f5d74aa90b3
- Commit date: 2026-11-10
- Upstream release noted in commit: 2.13.4
- License: MIT (upstream LICENSE copyright notice must remain).
- The branch README documents ERPNext/Frappe v16 support, Electron desktop builds, local database operation, PWA, offline sales, and hub-and-spoke multi-terminal operation.
- The upstream CI workflow provisions Frappe/ERPNext v16, MariaDB 11.8, Redis, and runs backend tests. This is evidence of an automated test path, not proof that this AL-NASR integration has passed it.

### Original POS Awesome

- Upstream: https://github.com/ucraft-com/POS-Awesome
- License: GNU GPL-3.0.
- Its README advertises ERPNext v14 and the repository's latest source push observed during this review was 2024-08-12.
- It is not selected as the initial v16 POS base because the published compatibility statement is older than the target ERPNext major version.

## Why X POS v16 is the leading POS candidate

It is the closest inspected candidate to the requested combination of:
- ERPNext v16 compatibility
- Windows/macOS/Linux desktop packaging through Electron
- local offline data and queued transactions
- a documented hub-and-spoke architecture for multiple tills
- browser/PWA access and responsive user interface

The newer X POS develop branch is not the selected production base: its own documentation describes a browser/PWA-only redesign and removal of the Electron desktop and hub/till LAN sync paths. The v16 maintenance branch is therefore the relevant branch for the required desktop/LAN evaluation.

## Important limitations to verify

These claims are upstream-documented capabilities, not yet verified in an AL-NASR deployment:

1. Confirm hub/spoke topology, network discovery/configuration, conflict resolution, and recovery after power loss.
2. Confirm which operations work offline: opening/closing shifts, returns, credit sales, purchases, stock checks, and payment modes may have different restrictions.
3. Confirm data durability and idempotency when a till reconnects after a long outage.
4. Confirm whether phone access is browser/PWA only on this branch. A native Flutter app is not part of this baseline.
5. Validate barcode scanners, weighing scales, thermal printers, cash drawers, and receipt layouts on the actual target hardware.
6. Validate Arabic RTL, number/currency formatting, tax setup, and multi-branch accounting.
7. Pin exact Frappe and ERPNext versions and run a full clean installation plus automated tests before production.

## Target deployment shape

- One self-hosted ERPNext/Frappe server on the store's local network.
- POS terminals connect to the local server over LAN; internet access is not required for local LAN connectivity.
- Desktop tills may use the X POS Electron client and its documented hub/spoke mode, subject to verification.
- Phones and tablets use the responsive browser/PWA path until native mobile support is separately engineered and tested.
- Remote access, backups, monitoring, and off-site synchronization are separate deployment concerns and must be secured explicitly.

## Licensing and branding

- Preserve the X POS MIT license and copyright notice in every distributed copy or substantial portion.
- Preserve ERPNext/Frappe GPL notices and comply with GPLv3 when conveying those components or derivative works.
- Do not remove upstream copyright, authorship, or license files.
- AL-NASR may use its own product name, colors, layouts, icons, and original assets, but must not imply that upstream trademarks or logos belong to AL-NASR.
- A legal review is required before commercial redistribution of a combined installer or hosted distribution. This record is engineering guidance, not legal advice.

## Next engineering gates

1. Confirm repository visibility and decide whether the source repository should remain public or be private.
2. Import the pinned X POS v16 source while preserving its upstream history and license.
3. Add an AL-NASR custom Frappe app and a reproducible Frappe Docker deployment definition.
4. Run installation, backend, frontend, desktop packaging, and offline/LAN integration tests.
5. Apply AL-NASR branding only after the baseline passes and record every changed upstream file.
6. Create a verified release checklist and backups before any live deployment.
