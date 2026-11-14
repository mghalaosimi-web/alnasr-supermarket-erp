# AL-NASR client delivery architecture — one Windows PC + one Android phone

**Decision scope:** one store, one Windows computer, one Android phone. No multi-terminal cluster, no cloud dependency, and no additional client devices are included in this delivery target.

## Product outcome

Deliver one AL-NASR product with one identity, one navigation model, one permission model, and one authoritative database, distributed through:
- A Windows installer named `AL-NASR-Setup.exe`.
- An Android package named `AL-NASR.apk`.
- A local server/runtime installed and operated on the Windows computer.

The EXE is an installer/desktop launcher deliverable, not a claim that the complete Frappe, database, Redis, and application stack can be embedded in one portable executable. The installation method must be selected and proven before promising a one-click offline installer.


## Windows host decision

Frappe's official installation guide requires a Unix-like environment and explicitly directs Windows users to Ubuntu in WSL; the documented v16 stack requires MariaDB 11.8, Python 3.14 and Node.js 24. The official Frappe deployment guidance recommends Docker images for production rather than a bare-metal Bench install.

Therefore the Windows computer will host the server through the supported Linux/container layer (Docker Desktop with its WSL2 backend, using the official Frappe Docker deployment model), subject to a clean-machine proof before final packaging. Native Windows Bench installation is not the target.

The requested EXE is the branded AL-NASR Windows installer/launcher. It must:
- check that the supported Windows/WSL2 and Docker runtime prerequisites are available;
- guide the owner through missing prerequisites rather than silently installing privileged system components;
- start/stop and health-check the local AL-NASR server;
- open the AL-NASR Desk/POS client;
- preserve database volumes across app upgrades and provide backup/restore actions.

It is **not** a claim that the complete ERPNext runtime is a small self-contained portable EXE. Docker Desktop/WSL2 remain host prerequisites unless a separately tested distribution strategy proves otherwise.

## Android connection security

The Android client must not silently downgrade to plain HTTP for login and financial operations. Android 9+ disables cleartext traffic by default for apps targeting modern API levels. The local-LAN pairing design must therefore provide authenticated HTTPS (for example, a local certificate authority and a deliberate trust/pairing flow) before production credentials are entered. Do not work around certificate errors with unconditional WebView SSL bypasses.

## Official implementation references

- Frappe v16 installation requirements and Windows/WSL guidance: https://docs.frappe.io/framework/user/en/installation
- Frappe deployment guidance: https://frappe.io/framework/deployment
- Official Frappe Docker project: https://github.com/frappe/frappe_docker
- Android network security and cleartext behavior: https://developer.android.com/privacy-and-security/security-config

## Runtime topology

The Windows computer has two roles:
1. Local AL-NASR server: Frappe, ERPNext, X POS, the AL-NASR custom app, MariaDB, Redis, and background workers.
2. Windows client: opens the AL-NASR interface locally, preferably through a branded desktop shell/launcher after packaging is validated.

The Android phone is a client only. It connects to the computer's local server over the same Wi-Fi/LAN and uses the same AL-NASR application UI and backend APIs.

No separate Android database is authoritative. No cloud service is required for normal local operation. If the computer/server is shut down, the phone cannot reach the authoritative system; any offline transaction queue must be explicitly designed and tested before being enabled.

## Application layers

| Layer | Responsibility |
|---|---|
| AL-NASR interface | Brand, Arabic RTL/English LTR, responsive layout, unified navigation, dashboards, forms and user feedback |
| POS experience | X POS checkout, cart, payments, shifts, returns and receipt workflow |
| ERP domain | ERPNext items, customers, suppliers, stock, purchasing, invoices, payments and GL |
| Framework/runtime | Frappe authentication, roles, API, background jobs, sessions and app lifecycle |
| Persistence | One MariaDB database on the Windows computer |

ERPNext remains the source of truth for standard business documents. X POS remains the POS workflow implementation. AL-NASR owns product-level navigation, branding, approved custom workflows and integration glue. Do not create duplicate Item, Customer, Supplier, Sales Invoice, Stock Ledger or GL records.

## Unified experience requirements

- One AL-NASR login entry and product identity.
- One main navigation and consistent page title/breadcrumb behavior.
- POS and management pages appear as destinations inside the same product navigation; users must not be asked to choose between separate products.
- Shared design tokens, typography, icon treatment, buttons, dialogs, tables, empty states, notifications and RTL/LTR behavior.
- Desktop layout may use a persistent sidebar; phone layout uses compact navigation and touch-sized controls.
- Preserve upstream ERPNext/X POS functionality and licenses. Do not patch upstream source merely to change branding.
- Prefer supported Frappe hooks, custom app routes, workspace configuration, POS extension points and scoped CSS.
- Avoid an iframe-based integration as the default: it complicates sizing, keyboard behavior, authentication, printing, accessibility and navigation.

## Packaging strategy

### Windows
- First prove the server can be installed, started, stopped, upgraded, backed up and restored reliably on a clean supported Windows machine.
- Use the official Frappe Docker/WSL2 host strategy on Windows after testing the target computer. Separately evaluate reuse of the pinned X POS Electron client for the branded Windows cashier app; do not confuse the client installer with the local ERP server installer.
- Package the branded Windows installer/launcher only after the local server lifecycle is deterministic.
- The launcher must show clear server state, open the local AL-NASR UI, and provide safe start/stop/recovery actions.
- Never bundle production credentials or a pre-populated live database.

### Android
- Reuse the responsive AL-NASR web interface; do not build a second ERP frontend.
- Produce an APK shell only if it materially improves installation, full-screen use, status/navigation behavior, and device integration over an installable PWA.
- Configure the server address safely and allow changing it without rebuilding the APK.
- Validate Android network security, local certificate/trust behavior, session expiry, reconnect handling, back navigation, file/receipt handling and supported printer/scanner paths.
- Do not claim native Android or offline parity merely because a WebView APK launches.

## Delivery gates

1. **UI integration:** unified navigation and brand across AL-NASR, ERPNext workspaces/forms and X POS; verify desktop and phone screenshots.
2. **Local server:** repeatable install/start/stop/restart, health check, database persistence and backup/restore on a clean Windows target.
3. **LAN connection:** Android connects to the PC server, logs in, reads the same catalog, creates a test sale, and sees the same invoice/stock state on the PC.
4. **Failure behavior:** server shutdown, Wi-Fi loss, app restart, expired session, retry and duplicate prevention; no silent loss.
5. **Hardware:** actual barcode scanner and receipt printer tests on the target PC/phone where applicable.
6. **Packaging:** signed or otherwise safely distributed EXE installer and APK; clean install/uninstall/update tests.
7. **Owner acceptance:** complete sample purchase-to-sale-to-return-to-cash-close flow with reconciled stock and GL.

## Current evidence and gaps

- Frappe 16.56.0, ERPNext 16.55.0, X POS 2.13.4 and AL-NASR install and pass the disposable CI runtime.
- In runtime run [#43604127743](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43604127743) on commit `3611f92c9f3df6adc2b915e15e4abbdda34b7c71`, the six ERPNext regression suites passed (779 tests), X POS frontend passed (449 tests), AL-NASR passed 14 runtime tests, and X POS backend passed 26 retry/shift tests: **1,268 tests total**. POS coverage includes retry idempotency, tax-inclusive/exclusive sales, partial/full returns, stock restoration, GL balance, over-return rejection, and shift calculations.
- The repository contains an AL-NASR Desk landing page/workspace and responsive brand styles. Runtime contract tests verified app metadata, Desk page registration, workspace installation, and X POS branding defaults in run `43604127743`; browser visual inspection and role/destination acceptance remain pending. The pinned X POS submodule contains an upstream Electron client (`frontend/electron`, `electron-builder.yml`, and Windows NSIS build configuration), but it remains X POS-branded and is not an AL-NASR Windows installer. No Android APK project/pipeline or Windows local-server installer has been implemented.
- The brand implementation matrix still marks POS/workspaces/mobile/print surfaces incomplete.
- A successful disposable Linux CI Bench is not evidence that the full stack is installable on Windows or that an Android APK can connect to it.

## Release boundaries

No PR merge, production deployment, live database migration, or real-store data import is authorized by this architecture note. Build and verify the local test environment first. Do not enable offline sales until device restart, server outage, retry, idempotency and reconciliation acceptance tests pass.


## Windows installer user experience contract

The Windows deliverable must behave like a conventional desktop-software installer. The store owner must not be asked to open a terminal, type shell commands, install Python/Node/Bench manually, or configure Docker Compose by hand.

### Setup wizard

1. **Welcome** — AL-NASR name/logo, supported Windows versions, and a concise explanation that this PC will host the store's local ERP server.
2. **License and notices** — present the AL-NASR license and required Frappe/ERPNext/X POS third-party notices. Do not imply that upstream licenses are replaced by the AL-NASR license.
3. **Install location** — default application binaries to `C:\Program Files\AL-NASR ERP\`. Keep operational database files and backups outside the application directory so upgrades and uninstalling the client do not erase business data.
4. **System readiness** — automatically detect Windows edition/build, x64 architecture, available disk/RAM, WSL2, virtualization support, and the supported Docker Desktop runtime. Show the exact missing prerequisite and explain any Administrator approval or restart. Where permitted, the installer may launch the official prerequisite installer after explicit user approval; it must not silently enable privileged Windows features or bypass a required reboot.
5. **Installing** — show clear progress while installing the AL-NASR launcher, preparing the supported Linux/container runtime, loading pinned application images, initializing persistent storage, and registering the local service. Never expose passwords or secret environment values in logs or UI.
6. **First-run setup** — open a local first-run page to create the store owner account and company profile. Generate credentials securely; do not ship a shared default administrator password.
7. **Finish** — offer “Launch AL-NASR”, a desktop shortcut, Start Menu entry, and optional start-on-Windows-login behavior. Display the local server health state and a clear recovery/help path.

### Installed application behavior

- The branded AL-NASR launcher must provide Start, Stop, Restart, Open System, Backup, and Restore actions with health checks and actionable error messages.
- Bind database and application ports to loopback by default. LAN access for the paired Android phone must be enabled only through the reviewed pairing and TLS flow; do not expose MariaDB, Redis, or internal service ports to the LAN.
- Persist database files, site files, encryption material, and backups in documented data locations with restrictive Windows ACLs. Application upgrades must preserve these locations.
- Uninstall must remove application binaries and registered services only after confirmation. It must preserve business data by default and provide a separate, explicit data-removal path with a backup warning.
- An upgrade must run a pre-upgrade backup, verify image/app compatibility, apply migrations to the local installation only, and retain a tested rollback/recovery path.
- Do not claim that the wizard, managed prerequisites, service lifecycle, LAN pairing, backup/restore, or rollback are implemented until each is exercised on a clean Windows 10/11 x64 machine.

### Packaging acceptance checklist

- [ ] Clean Windows 10/11 x64 installation from the downloaded `AL-NASR-Setup.exe`, using only the wizard UI.
- [ ] Missing WSL2/virtualization/runtime prerequisites are detected and explained; elevation and restart are handled explicitly.
- [ ] First install creates a healthy local site and owner account without embedded credentials.
- [ ] Restarting Windows restores the server according to the selected startup preference.
- [ ] Backup and restore are verified against a disposable test company.
- [ ] Upgrade preserves company data; uninstall preserves data unless the owner explicitly selects removal.
- [ ] Android pairing uses authenticated HTTPS and shares the same catalog, invoices, stock, and ledger state.
- [ ] The final installer is inspected, checksummed, and published as a versioned GitHub artifact/release only after clean-machine acceptance.
