# AL-NASR device packaging readiness

**Checked:** 2026-11-15  
**Accepted architecture:** [ADR-0002 — SQLite local-first, no Docker](architecture/ADR-0002-sqlite-local-first-no-docker.md)  
**Decision:** Do not publish a Windows installer or declare Android companion readiness from the current source state.

## Windows: upstream Electron client is not the SQLite ERP desktop product

The pinned historical X POS source contains an Electron client and an NSIS configuration, but it targets the former ERPNext/Frappe architecture, uses X POS identity, and depends on a MariaDB-backed client cache. It is not the Windows host for the new Fastify + SQLite implementation.

The current SQLite app has only a Fastify backend package under `local-app/`. It does not yet include a React renderer, Electron main/preload process, desktop lifecycle, tray/single-instance implementation, native module Electron ABI packaging, or AL-NASR Windows installer.

**Windows exit evidence required:**
1. Build the actual SQLite application with the React renderer and Electron shell.
2. Verify `better-sqlite3` against the target Electron ABI.
3. Build an NSIS installer on Windows CI.
4. Install on a clean Windows 10/11 x64 VM with no external Node.js/Python/Docker/WSL requirement.
5. Verify first-run owner setup, database location, app restart, upgrade preservation, uninstall preservation, and recovery.

## Android: Kotlin WebView preview exists, but is not the companion client

A Kotlin Android Gradle project exists in `android/`. Its only current activity opens a fixed allowed HTTPS origin (`alnasr.local`) inside WebView and cancels certificate errors. Cleartext traffic is disabled.

This is a useful source-level preview shell, but it does **not** yet implement the selected SQLite application's Fastify API contract. Specifically, it has no pairing codes/QR flow, no public-key/certificate fingerprint pinning, no device registration/revocation endpoints, no API session integration, no native permission-scoped workflows, and no durable idempotent sync queue. No physical Android device or LAN acceptance has been recorded.

The network-security configuration trusts user-installed CA certificates for `alnasr.local`; this is not equivalent to certificate pinning. Do not enable LAN binding until the actual TLS trust model and pairing protocol are implemented and tested.

**Android exit evidence required:**
1. Replace the WebView-only preview with the approved Kotlin API client and workflows.
2. Implement secure pairing, certificate/public-key fingerprint validation, device registration, revocation and protected token storage.
3. Integrate authentication and server-side permission checks for every mobile operation.
4. Define offline read versus queued write behavior, idempotency, conflict handling and authoritative server confirmation.
5. Build a debug APK and verify the Windows-hosted Fastify server connection on a physical Android device.

## CI and release boundaries

- The local runtime CI validates TypeScript/backend only; it does not prove a desktop or mobile release.
- The Android workflow must target the authorized SQLite branch before being treated as a CI gate for this project.
- Do not commit Android signing keys or credentials. Keep release signing material outside Git.
- A generated APK does not prove Android-to-Windows connectivity; a Windows EXE does not prove installability.
- No release artifact should be labeled production-ready until clean install, startup, upgrade/recovery and real-device acceptance pass.

## Current exit evidence

| Deliverable | Evidence |
|---|---|
| SQLite backend | CI run #94: typecheck, 28 tests and build passed |
| Android source | Kotlin WebView preview project present |
| Android API integration | Not implemented |
| Android TLS pinning/pairing | Not implemented |
| Debug APK from authorized branch | Not verified |
| Windows Electron/NSIS package | Not implemented for SQLite architecture |
| Clean Windows VM | Not tested |
| Physical Android device | Not tested |
