# Windows-first execution plan — AL-NASR ERP

**Status:** Active execution priority  
**Scope:** Main Phase 1 only  
**Decision:** Complete and accept the Windows desktop product before resuming Android implementation.

## 1. Priority freeze

- Windows desktop is the sole active client-delivery target.
- Android source is preserved as-is. Do not add features, pairing, LAN, synchronization, native screens, or device workflows until Windows release acceptance is complete.
- Android CI is manual-only during this freeze; it must not consume routine CI time on unrelated backend or Windows commits.
- Do not delete Android code or artifacts.

## 2. Windows product acceptance target

Deliver an offline-capable Windows 10/11 x64 installer that:

1. Installs the complete Electron + React desktop application and its runtime dependencies.
2. Does not require Docker, WSL2, Python, a separately installed Node.js, internet access, or any cloud account for normal operation.
3. Starts the local Fastify API within the desktop application's lifecycle; the local UI communicates through a controlled Electron IPC bridge, not an unrestricted renderer network surface.
4. Uses one authoritative SQLite database under `%ProgramData%\AL-NASR\data\alnasr.sqlite`, outside the installation directory and ASAR archive.
5. Creates data, logs, backups, and certificate directories with least-privilege Windows ACLs. The live database is not stored in a user profile or the install folder.
6. Supports first-run owner bootstrap, login, role/permission enforcement, and safe startup after reboot.
7. Supports validated backup, restore, and rollback-safe schema migrations.
8. Preserves the database and backups across application upgrade and uninstall by default. Data deletion requires a separate explicit owner operation.
9. Includes signed/release-ready packaging and a documented clean-machine installation procedure. Do not claim signing until a real certificate and signed artifact are available.

## 3. Execution sequence

### W0 — Windows baseline and build gate
- Validate the current SQLite runtime on Windows x64 with Node 24 and native `better-sqlite3`.
- Run dependency installation, TypeScript typecheck, all unit/integration tests, and build on a Windows runner.
- Verify the default ProgramData database path and that the app can create/open/checkpoint the database there.
- Keep the current loopback-only API boundary.

### W1 — Electron host and lifecycle
- Add Electron main process and secure preload.
- Embed/start Fastify inside the Electron main process and stop it cleanly on app exit.
- Enforce single-instance behavior, startup error reporting, graceful close, and no orphaned server process.
- Keep context isolation and sandbox enabled; no Node integration in the renderer.

### W2 — React desktop UI
- Build a real RTL Arabic / LTR English desktop shell.
- Implement first-run setup, login/logout, session expiry handling, navigation, error/loading states, and accessible forms.
- Use typed IPC methods with a strict allowlist. Never expose raw filesystem, shell, arbitrary IPC, or unrestricted Node APIs to React.

### W3 — Windows data protection and operations
- Create protected ProgramData directories and explicit ACLs.
- Add log rotation/redaction, crash diagnostics, SQLite integrity/backup checks, restore with pre-restore safety backup, and migration recovery.
- Verify multi-user Windows permissions and single-writer SQLite lifecycle.

### W4 — ERP workflows on Windows
- Complete and integrate catalog, customers/suppliers, inventory, purchasing, POS, payment allocations, returns/refunds, shifts/cash, accounting, reports, and settings.
- Every posted financial or inventory document must be transactional, idempotent where appropriate, auditable, and reversible through business documents rather than destructive edits.
- Add end-to-end workflow acceptance tests.

### W5 — Native Windows packaging
- Replace the legacy Docker/ERPNext installer path with a new SQLite-native installer.
- Bundle the Electron runtime and rebuilt native SQLite module; no separately installed Node runtime.
- Add install, upgrade, repair, launch-at-login (opt-in), uninstall-preserve-data, and explicit data-removal paths.
- Produce an actual x64 installer artifact from Windows CI and verify its hash and contents.

### W6 — Release acceptance
- Test on clean Windows 10 and Windows 11 x64 machines without developer tools or internet.
- Test fresh install, first-run setup, login, core workflows, app/PC restart, backup/restore, upgrade from previous schema, uninstall/reinstall with data retention, permissions, and crash recovery.
- Verify no Docker/WSL/Node prerequisites, no hidden cloud dependency, and no data loss.
- Only after all Windows gates pass may Android work resume.

## 4. Current verified starting point

- Local Fastify/SQLite backend exists in `local-app/`.
- Latest verified local runtime CI: [run 43748469553](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43748469553), 9 test files / 35 tests, typecheck and build passed on the CI runner.
- SQLite schema is v4. Default Windows database path resolves beneath `%ProgramData%\AL-NASR\data\`.
- API currently binds to loopback by default.
- No Electron main/preload, React desktop renderer, Windows-native SQLite installer, or clean-machine Windows acceptance evidence exists yet.
- The current `deploy/windows/installer.iss` and `deploy/windows/alnasr.ps1` belong to the superseded Docker/ERPNext deployment. They are explicitly not the Windows deliverable and must not be used.

## 5. Hard release gates

A green backend workflow is not a Windows desktop release. Do not close W1–W6 based on source presence alone. Each gate requires a successful CI run and, where specified, a real Windows machine acceptance record with OS version, artifact SHA-256, test results, and known limitations.

**Current state:** W0 is being established. W1–W6 remain open. Android is frozen pending W6 acceptance.
