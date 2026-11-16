# AL-NASR Windows Desktop

This is the first Windows desktop host scaffold for the SQLite-first application. It is not a complete ERP release.

## Architecture

- Electron 45 main process hosts the Fastify API in-process.
- React 19 + Vite renderer is isolated from Node.js.
- The renderer can call only the typed `window.alnasr.request` preload bridge.
- The main process validates renderer origin, API route, HTTP method, session token shape, and request-body size before forwarding to loopback API `127.0.0.1:4317`.
- Electron single-instance lock prevents duplicate local API hosts.
- Electron closes the Fastify API before exiting.
- The API continues to use SQLite under `%ProgramData%\AL-NASR\data\alnasr.sqlite` on Windows.
- The installer target is x64 NSIS. No external Node.js, Docker, WSL2, Python, or internet dependency is intended for normal operation.

## Development

Prerequisite for contributors only: Node.js 24 x64, npm, and Windows native build prerequisites for `better-sqlite3`.

From repository root:

```powershell
npm ci --prefix local-app
Set-Location desktop-app
npm install
npm run dev
```

## Validation and packaging

```powershell
npm run typecheck
npm run build
npx electron-builder --win nsis --x64
```

The Windows CI workflow installs dependencies, typechecks Electron and React, compiles the SQLite backend, builds the renderer and Electron host, and creates an unsigned NSIS installer preview.

## Current UI scope

Implemented:
- First-run owner setup.
- Login/logout against the local API.
- Local API health/schema display.
- Arabic RTL Windows workspace shell.
- Secure Electron IPC bridge and API lifecycle.

Not implemented in this scaffold:
- Full CRUD screens for products, inventory, sales, purchases, customers and suppliers.
- Accounting, shifts/cash, returns/refunds, reports, backup restore/retention.
- Windows ProgramData ACL hardening, log rotation and crash recovery.
- Clean Windows 10/11 install/upgrade/uninstall acceptance.
- Code signing and production release.

The dashboard deliberately labels unfinished ERP modules as "قيد التنفيذ". Do not represent this scaffold or its installer preview as the complete AL-NASR ERP.
