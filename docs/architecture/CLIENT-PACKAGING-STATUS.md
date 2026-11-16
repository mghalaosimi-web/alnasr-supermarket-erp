# AL-NASR client packaging assessment

**Assessment date:** 2026-11-15  
**Target topology:** one Windows PC hosting the authoritative SQLite ERP and one Android phone connecting over the same private Wi-Fi/LAN.  
**Architecture authority:** [ADR-0002 — SQLite local-first, no Docker](ADR-0002-sqlite-local-first-no-docker.md).

## Decision

Do not publish a Windows installer or claim Android companion readiness from the current source state. Some client source exists, but neither device deliverable is an end-to-end AL-NASR product package.

The former X POS / ERPNext Electron client and its packaging configuration belong to the superseded MariaDB/Frappe architecture. They do not install or operate the current SQLite Fastify application and must not be reused as a completed AL-NASR SQLite installer without a separately reviewed adaptation.

## Windows: current SQLite implementation

The SQLite implementation currently contains `local-app/`, a Node.js 24 TypeScript/Fastify API using `better-sqlite3`. It has no React renderer, Electron main/preload process, Electron lifecycle manager, tray/single-instance logic, or Windows NSIS installer.

The existing upstream X POS source contains a separate Electron client with X POS identity and a MariaDB-backed local cache; it is not an embedded SQLite AL-NASR server. Its build cannot be represented as the required standalone local-first installer.

**Required before producing `AL-NASR-Setup.exe`:**

1. Implement the React renderer and explicit typed API client.
2. Implement Electron main/preload lifecycle, secure IPC, loopback API management, single-instance, tray, startup preference, graceful shutdown, diagnostics and persistent data paths.
3. Package Fastify and the native `better-sqlite3` dependency against the Electron ABI; validate the packaged runtime.
4. Configure NSIS install/upgrade/uninstall behavior that preserves `%ProgramData%\\AL-NASR\\` by default.
5. Build on Windows CI and test fresh install, first run, database initialization, sale workflow, restart, upgrade and uninstall preservation on a clean Windows 10/11 x64 VM.

## Android: current source reality

A native Kotlin/Gradle project exists under `android/`, but it is currently a **WebView preview**, not the required native companion client.

Its current behavior:
- accepts only `https://alnasr.local`;
- stores that URL locally and renders it in Android WebView;
- rejects TLS certificate errors and disallows cleartext traffic;
- trusts system certificate authorities generally and user-installed CAs for `alnasr.local`.

Missing from the current project:
- secure pairing code/QR protocol;
- certificate or public-key fingerprint pinning;
- pairing endpoint and device registration;
- revocation and device credential lifecycle;
- authentication against the Fastify API and protected REST calls;
- role/permission-scoped native workflows;
- idempotent offline operation queue and synchronization state;
- automated Android tests and a recorded physical-device acceptance run.

The WebView preview has no verified connection to the SQLite Fastify API. Do not enable LAN binding or weaken TLS to make it appear connected. The API remains loopback-only until secure pairing and transport are complete.

## CI policy

- The SQLite backend workflow validates `local-app/` only.
- The Android build workflow currently does not trigger on push to `architecture/sqlite-offline-no-docker`; its branch filters must include the authorized implementation branch before Android source changes can be continuously validated.
- Android debug APK builds, when available, are controlled test artifacts only. They do not prove API connectivity or production signing.
- Windows packaging CI must build the actual Electron + Fastify + SQLite application, not the historical upstream X POS client.

## Current status

| Deliverable | Status |
|---|---|
| SQLite Fastify backend | Implemented foundation; CI run #94 passed |
| React renderer | Not implemented |
| AL-NASR SQLite Electron shell | Not implemented |
| AL-NASR Windows installer | Not implemented |
| Kotlin Android WebView preview | Source exists; not accepted as the companion app |
| Secure Android pairing/API integration | Not implemented |
| TLS fingerprint verification | Not implemented |
| Windows clean installation test | Not run |
| Physical Android/LAN test | Not run |
| Printer/scanner/cash-drawer acceptance | Not run |

See [Phase 1 execution status](../implementation/PHASE-1-EXECUTION-STATUS.md) for the evidence-based module inventory and blockers.
