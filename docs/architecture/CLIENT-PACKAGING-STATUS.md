# AL-NASR client packaging assessment

**Assessment date:** 2026-11-14  
**Target topology:** one Windows PC hosting the authoritative ERP server and one Android phone connecting over the same local Wi-Fi/LAN.

## Decision

Do not publish a Windows installer or Android APK from the current source state. There are upstream client build capabilities, but neither one is yet an end-to-end AL-NASR deployment package. Adding a green packaging job now would prove only that a client shell compiles; it would not install the local ERP server or establish a safe phone-to-PC connection.

## Windows: what exists and what is missing

The pinned X POS v2.13.4 source includes an Electron application and an electron-builder NSIS target for Windows x64:

- `frontend/electron/main.ts` starts an Electron renderer and uses a configurable ERPNext server URL (default `http://localhost:8000`).
- `frontend/package.json` exposes `build:electron`, `dist`, and `dist:win`.
- `frontend/scripts/build-win.mjs` runs `electron-builder --win --dir` and verifies `release/win-unpacked/X POS.exe`; this is an unpacked client directory, not the NSIS installer artifact.
- `frontend/electron-builder.yml` identifies the product as **X POS**, uses upstream application identity/icon assets, and configures publishing to the upstream `kodlyft/xpos` GitHub repository.
- The Electron client uses a local MariaDB-backed cache and a hub/till synchronization service. Its `electron/database/dbService.ts` connects to `127.0.0.1:3306` (default database `xpos_local`) and creates the client schema; the Electron package includes `schema.sql`, not a MariaDB server. It is not the Frappe/ERPNext server installer.

A Windows x64 Electron client can therefore be built from upstream, but it is not an AL-NASR-branded installer and does not install or operate the authoritative Frappe + ERPNext + X POS + AL-NASR server stack. The current repository has no supported Windows server lifecycle package, Docker Compose deployment, persistent MariaDB/Redis service definition, firewall configuration, backup/restore workflow, or upgrade/rollback orchestration.

**Required before producing `AL-NASR-Setup.exe`:**

1. Define and test a supported Windows host runtime for Bench (most likely Docker Desktop/WSL2 with Linux containers, not a native Windows Bench install).
2. Add a pinned, reproducible compose/runtime definition for Frappe, MariaDB and Redis, with persistent volumes and no embedded credentials.
3. Implement health checks, first-run setup, local-only port exposure, firewall guidance, backup/restore and versioned upgrade/rollback.
4. Add an AL-NASR Electron product overlay (application ID, product name, icons, installer metadata and update policy) without modifying the X POS submodule or publishing to its upstream repository.
5. Build on a Windows runner, inspect the NSIS artifact, and test install/start/stop/upgrade/uninstall on a clean Windows VM.

## Android: what exists and what is missing

The pinned X POS tree contains a browser/PWA frontend but no Capacitor project, Android Gradle project, Android manifest, or APK build pipeline. A PWA is not an APK.

The local ERP server is expected to be reached over Wi-Fi/LAN. Android WebView blocks cleartext HTTP by default for modern target SDKs. Enabling unrestricted cleartext traffic or trusting arbitrary certificates would weaken transport security. A safe APK requires:

1. A defined LAN endpoint and TLS plan (trusted local CA/certificate provisioning or another explicitly reviewed secure transport design).
2. A configurable server-discovery/manual pairing flow that does not hardcode a private IP address.
3. Validated Frappe authentication, CSRF/session persistence, CORS/origin policy and reconnect behavior in Android WebView.
4. Android app identity, signing-key custody outside the repository, Gradle/Capacitor build configuration and a CI build that never exposes signing secrets.
5. A real Android-device test for login, catalog, sale, return, printer/barcode integration, Wi-Fi loss/recovery and session renewal.

Until those conditions are implemented, an APK build would either be a nonfunctional wrapper or require insecure network exceptions.

## CI policy

- Keep the current Linux runtime integration and app validation workflows as source/runtime gates.
- Do not add a Windows or Android artifact job until its actual packaging inputs and supported host/client architecture are present.
- When added, upload unsigned test artifacts only from CI; production signing and release publication require a separate owner-controlled secret and explicit approval.
- A successful source build is not evidence of an installable deployment or hardware acceptance.

## Current status

| Deliverable | Status |
|---|---|
| Pinned X POS Electron upstream build capability | Verified by source inspection; not AL-NASR packaged |
| AL-NASR Windows server installer/launcher | Blocked by missing supported Windows server runtime and deployment lifecycle |
| Android APK | Blocked by missing native Android project and reviewed TLS/LAN/auth design |
| Physical Windows installation test | Not run; requires a clean Windows VM/device |
| Physical Android test | Not run; requires a real Android device |
