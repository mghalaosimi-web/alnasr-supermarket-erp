# AL-NASR ERP — Phase 1 Execution Status
# حالة تنفيذ المرحلة الأولى

**Snapshot date:** 2026-11-15  
**Repository:** https://github.com/mghalaosimi-web/alnasr-supermarket-erp  
**Authorized branch:** `architecture/sqlite-offline-no-docker`  
**Pull request:** [#7](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/pull/7) — open, Draft, not merged  
**Inspected source HEAD (before this status-record commit):** `54c8a5d53f6d5fc2363d6157c04a5b3706d6d2dc`  
**PR base:** `foundation/alnasr-commerce-acceptance` at `bb8efd62f88fd234a4d6100340ca172b65826628`  
**Classification:** PARTIALLY COMPLETE — REMAINING ENGINEERING WORK

> This file records a source inspection snapshot. Its own Git commit is the branch update that adds this document; therefore the source SHA above identifies the exact application code inspected before this documentation-only commit. Read the current branch ref / PR head for the commit containing this record.

## 1. Repository and branch verification

- The repository exists, is public, and its default branch is `main`.
- The authorized branch exists and its ref resolved to `54c8a5d53f6d5fc2363d6157c04a5b3706d6d2dc` at inspection time.
- PR #7 is open, Draft, and unmerged. Its head branch is the authorized branch; its base branch is `foundation/alnasr-commerce-acceptance`.
- PR snapshot: 58 commits, 24 changed files, 5,336 additions and 38 deletions at inspection time.
- Remote commit/tree state was inspected. A local clone and local Git working-tree status were not available in this execution environment; no claim is made about an unobserved local working tree.
- No merge, production deployment, production database mutation, or real business-data import was performed.

## 2. Verified current implementation

### SQLite and backend foundation

- `local-app/` contains a Node.js 24 TypeScript package using Fastify, better-sqlite3, Zod, TypeScript, and Vitest. It has no React or Electron dependency.
- SQLite schema migrations are versions 1–4. The schema includes stores, users, roles, permissions, sessions, audit events, warehouses, products, barcodes, customers and suppliers (basic records), stock ledger, sales, sale lines, sale-payment rows, purchases, and purchase lines.
- Database startup enables foreign keys, WAL, FULL synchronous writes, 5-second busy timeout, WAL auto-checkpoint at 1,000 pages, 64 MiB journal size limit, and `trusted_schema=OFF`; it rejects newer unsupported schema versions and runs `quick_check`.
- Default Windows database path is `%ProgramData%\\AL-NASR\\data\\alnasr.sqlite` when `ProgramData` is available. The fallback is under the user's local-share directory.
- Authentication uses scrypt password hashes, hashed bearer tokens, 12-hour session expiry, logout revocation, failed-login lockout (five failures in a 15-minute window), seeded roles, and backend permission checks.
- Current API endpoints cover health/setup, login/logout/current user, product list/create, stock balance/adjustment, sale draft creation/posting, purchase draft creation/posting, and backup creation.
- Stock movements and sale/purchase posting use SQLite transactions and idempotency keys. Quantities are whole integers, not fractional quantities.
- Backup creation uses the SQLite online backup API, validates `quick_check` and schema version, fsyncs the temporary file, and atomically renames it. Restore, retention, scheduling, and recovery UI are not implemented.

### Exact CI evidence

Latest inspected run for source HEAD `54c8a5d...`:

- Workflow: **AL-NASR Local Runtime Validation**
- Run: [#94 / 43742819584](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43742819584)
- Job: `SQLite runtime typecheck and tests`, job ID `132899509776`
- Runner: GitHub-hosted Ubuntu; Node.js 24.22.2; npm 11.19.1
- `npm ci --no-audit --no-fund`: passed
- `npm run typecheck`: passed
- `npm test`: passed — 8 test files, 28 tests, 0 failures, 0 skips reported
- `npm run build`: passed
- Workflow conclusion: success
- The run produced no downloadable release artifacts.
- This workflow validates only `local-app`; it does not validate Electron, React, Windows packaging, Android connectivity, peripherals, or complete ERP business acceptance.

## 3. Module implementation inventory

| Domain | Snapshot status | Evidence / missing scope |
|---|---|---|
| SQLite persistence and migrations | Partially complete | v1–v3, WAL, FK, integrity check; no complete ERP schema, recovery drill, or fractional quantity model |
| Authentication and RBAC | Partially complete | Bootstrap/login/logout/session expiry and seeded role permissions; user/role administration APIs and full policy matrix missing |
| Stores and configuration | Partially complete | Default store and warehouse created during bootstrap; branch-aware settings, currency/tax/receipt/printer/network configuration missing |
| Product catalog | Partially complete | Product create/list and barcode record; categories, multiple barcode API, units/conversions, price lists, bulk import/export, full lifecycle missing |
| Customers | Partially complete | Customer create/list/update/deactivate API, credit-limit field, audit events and tests; no statements, account balance/collections, payment history, or UI |
| Suppliers | Partially complete | Supplier create/list/update/deactivate API, audit events and tests; no payables, statements, supplier payments, or UI |
| POS | Partially complete | Sale draft and stock-deducting post; suspended sales, receipt/invoice output, shift integration, credit policy, and UI missing |
| Sale payments | Partially complete | Partial cash/card/bank-transfer/mobile-wallet payment records, outstanding balance, idempotency, audit and `sales:pay` RBAC; no refunds, settlement/reconciliation, payment gateway, or UI |
| Sales management | Partially complete | Create/post only; listing/detail, partial payment, controlled void/reversal, return/refund missing |
| Purchasing | Partially complete | Draft and all-at-once receipt posting; partial receiving, supplier payment, purchase return, workflow UI missing |
| Inventory | Partially complete | Integer stock ledger, balance, adjustment, non-negative enforcement; transfers, counts, valuation, expiry, reconciliation, UI missing |
| Returns/refunds | Not implemented | No return/refund domain service or API |
| Cash registers and shifts | Not implemented | No cash-register/shift schema or workflow |
| Accounting / general ledger | Not implemented | No chart of accounts, journal schema/service, debit-credit invariant, financial statements, or reconciliation |
| Reports and analytics | Not implemented | No database-backed report API or screens |
| Notifications and alerts | Not implemented | No persisted alert/notification subsystem |
| Import/export | Not implemented | No validated domain import/export workflows |
| Backup | Partially complete | Verified online backup creation; no restore, scheduled backup, retention, UI, or disaster-recovery acceptance |
| Audit | Partially complete | Audit events for selected operations; no full searchable audit API/UI or complete coverage |
| React application | Not implemented | No React renderer or frontend package is present in the inspected implementation branch |
| Electron desktop shell | Not implemented | No Electron main/preload lifecycle, IPC hardening, tray, single-instance behavior, or packaging configuration in the SQLite app |
| Windows startup / installer | Not implemented | No AL-NASR SQLite EXE/NSIS installer or clean Windows install/upgrade/uninstall test |
| Android companion | Partially complete | Kotlin WebView preview exists; it is not the required native/API-integrated companion |
| Android pairing / device security | Not implemented | No pairing codes, device registration/revocation, secure token lifecycle, public-key fingerprint pinning, or server pairing API |
| TLS/LAN API | Blocked by incomplete security implementation | Fastify currently binds to loopback; LAN must remain disabled |
| Printer / scanner / cash drawer | Not implemented | No verified peripheral integration |
| Logging / diagnostics | Partially complete | Fastify request logging exists; production log rotation, redaction review, desktop diagnostics, and admin UI missing |
| Installer and artifact pipeline | Not implemented | No verified Windows installer or Android APK artifact from this SQLite implementation |

## 4. Android source reality

- `android/` is a Kotlin Android Gradle project with a single `MainActivity.kt` WebView-based preview.
- It requires HTTPS and restricts navigation to `alnasr.local`; cleartext traffic is disabled.
- It trusts system certificates and user-installed certificates for `alnasr.local`. It does **not** pin a server certificate/public-key fingerprint.
- The UI asks the operator to install a local CA and connect to `https://alnasr.local`; this is not a device-pairing protocol.
- The app loads a web page; it does not implement the required authenticated Fastify REST client, device enrollment/revocation, API permission workflows, synchronization queue, or native mobile business screens.
- No physical Android device test is recorded. No Android artifact was attached to local runtime CI run #94.

## 5. Documentation inconsistencies found

- Root `README.md` still says the SQLite workspace/schema/API have not yet been created, contradicting the implementation and CI run #94.
- `docs/architecture/CLIENT-PACKAGING-STATUS.md` and `docs/DEVICE-PACKAGING-READINESS.md` say no Android Gradle project exists; a Kotlin/WebView preview project is now present.
- `docs/architecture/BASELINE.md` and older client-delivery notes still describe the superseded ERPNext/Frappe + MariaDB/Redis + Docker approach. ADR-0002 is the accepted source of truth; those documents must be clearly marked historical/superseded where they conflict.
- The Android CI workflow includes `architecture/sqlite-offline-no-docker` in its push branch filter and runs when Android files or the workflow change. Its existence does not prove an APK build passed; no successful Android run/artifact was verified in this inspection.
- A dedicated `docs/implementation/PHASE-1-EXECUTION-STATUS.md` did not exist before this record.

## 6. Commands and results

The latest verified source-level commands were run by GitHub Actions on the inspected source HEAD:

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Passed in run #94 |
| `npm run typecheck` | Passed in run #94 |
| `npm test` | Passed: 8 files / 28 tests in run #94 |
| `npm run build` | Passed in run #94 |
| `gradle -p android assembleDebug` | Not executed in this session |
| Electron build / NSIS build | Not available; Electron app does not exist |
| Windows install / startup / upgrade / uninstall test | Not executed |
| Android TLS/LAN/pairing/device acceptance | Not executed |
| Printer/scanner/cash drawer acceptance | Not executed |

## 7. Execution environment blocker

The pre-existing Upstash Box named **AL-NASR SQLite CI verification** is paused. Resuming it was rejected with HTTP 403 because its account reached the monthly compute limit (5 CPU-hours). The current container cannot resolve `github.com`, so it cannot clone the repository or run npm/Gradle locally. This prevents local code editing, test execution, and artifact generation in this session. GitHub source inspection and existing CI evidence remain available.

Do not bypass this resource boundary by claiming tests or builds were executed. Resume implementation in an execution environment with an available shell/compute allocation, or continue via a GitHub-connected build runner. The blocker does not make the remaining ERP modules complete.

## 8. Next engineering actions

1. Restore an authorized, available repository shell; clone the exact authorized branch; record `git status --short`, remotes, and HEAD before edits.
2. Complete backend domain/migration layers for customer/supplier management, payments and allocations, returns/refunds, cash registers/shifts, double-entry accounting, and reporting; add invariant and end-to-end tests.
3. Implement validated restore/recovery and scheduled/retention backup policies.
4. Build the React RTL/LTR application against the typed Fastify API; add integration/UI tests.
5. Implement Electron main/preload lifecycle, loopback-only embedded API management, secure IPC, tray, single-instance, shutdown, data path and NSIS packaging.
6. Replace the Android WebView-only preview with the approved Kotlin REST client; implement pairing, TLS fingerprint verification, device registration/revocation, permission-scoped workflows and synchronization semantics.
7. Add CI jobs for Linux backend, React frontend, Windows Electron packaging and Android Gradle build on the authorized branch; do not weaken tests or publish fake artifacts.
8. Perform clean Windows and physical Android/hardware acceptance; record actual artifact metadata and hashes.
9. Update conflicting legacy documentation and obtain complete evidence before closing Phase 1.

**Current decision:** Phase 1 remains open. The SQLite backend foundation is CI-verified, but the required ERP application, desktop installer, secure Android companion, financial workflows, restore, reports, and external acceptance are not complete.


---

## 9. Reinspection addendum — latest PR head and CI evidence (2026-11-15)

This addendum supersedes stale snapshot statements above where the repository or CI state has changed. The current inspected PR head is `c780b58c5a5f79a000cb33823858012e96cf07f2`; PR #7 remains open, Draft, and unmerged.

### New CI evidence on the current PR head

- **Local runtime workflow #108:** [run 43747507029](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43747507029) — completed successfully on the current PR head. Its `SQLite runtime typecheck and tests` job passed dependency installation, TypeScript typecheck, unit tests, and build. This is still validation of `local-app/` only; no release artifact was produced.
- **Android workflow #48:** [run 43747506964](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43747506964) — completed successfully on the current PR head. The `android-debug-apk` job passed all steps, including `gradle assembleDebug` and artifact upload.
- Android artifact: `AL-NASR-Android-Debug-Preview`, artifact ID `14174672879`, size 811,825 bytes, SHA-256 `6ad029589269a7277bd977688bb1c7aa5a6965ef710bd6d83c8b2295b82a15fc`, created 2026-11-15, expires 2026-12-15. This is a debug preview APK for controlled device testing, not a signed production release and not proof of device acceptance.
- The earlier statement that no successful Android build/artifact was verified is superseded by run #48 and this artifact record. The absence of physical-device, LAN, pairing, and peripheral acceptance remains unchanged.

### Latest source-tree inspection — architecture and packaging blockers

The current branch tree was inspected recursively at `c780b58...`:

- No Electron main process, preload, React renderer, Electron Builder, or NSIS packaging project exists for the SQLite application. The only path matching “desktop” is a legacy Frappe Python configuration file.
- `local-app/` is a standalone Fastify/SQLite backend package; it has no React or Electron dependencies.
- `android/` contains one Kotlin `MainActivity.kt` WebView preview. It validates the configured HTTPS hostname `alnasr.local`, blocks cleartext and cancels TLS errors, but it does not implement REST authentication, certificate/public-key fingerprint pinning, pairing codes/QR, device enrollment/revocation, offline operation queue, or native ERP workflows.
- The Android README itself describes a WebView preview and a manual CA-installation procedure. It explicitly lists physical-device, LAN/mDNS, barcode-camera, thermal-printer, and file-transfer tests as not accepted.
- The root tree still contains legacy ERPNext/Frappe/X-POS git submodules, Docker files (`.dockerignore`, `deploy/Dockerfile`, `deploy/compose.yaml`), and the old Windows Inno Setup/PowerShell deployment scaffold. The current `deploy/windows/installer.iss` explicitly includes Docker deployment files and says Docker Desktop is required; `deploy/windows/alnasr.ps1` invokes Docker Compose and initializes ERPNext/MariaDB. This is **not** an installer for the accepted SQLite architecture and must not be used or represented as the deliverable.
- ADR-0002 and the current root README correctly identify ERPNext/Frappe + MariaDB/Redis + Docker as superseded historical work. The legacy files remain in the repository tree and should be isolated/marked historical or retired through a reviewed change before release; they are not runtime evidence for the SQLite product.

### Corrected documentation state

- The current root `README.md` no longer says the SQLite implementation has not been created. It describes the accepted SQLite target, the backend foundation, the successful historical local-runtime run #94, and the remaining Phase 1 work. The prior claim in section 5 that the current README still contradicts the implementation is stale and superseded.
- The current README's snapshot section still references run #94 / source `54c8a5d...`; the newer run #108 on `c780b58...` is the latest current-head evidence and should be reflected in the next README refresh.
- The older packaging/acceptance docs and the legacy Windows deployment scaffold still need reconciliation against ADR-0002.

### Current verified conclusion

**Phase 1 remains open and is not release-ready.** The SQLite backend foundation passes its current GitHub Actions validation, and an Android debug-preview APK has been built. The required React/Electron desktop application, SQLite-native Windows installer, complete ERP financial and operational workflows, backup restore/retention, secure Android REST pairing and device management, and clean-machine/device/hardware acceptance remain unimplemented or unverified. No PR merge, production deployment, or real business-data mutation was performed.


---

## 10. Backend payment milestone — schema v4 (2026-11-15)

### Implemented on the authorized branch

- Added `local-app/src/payments/payments.ts` with transactional sale-payment recording and payment listing.
- Added SQLite migration v4 and the `sales:pay` permission; owner, admin and cashier roles receive this permission.
- Added authenticated API endpoints:
  - `POST /api/v1/sales/:saleId/payments`
  - `GET /api/v1/sales/:saleId/payments`
- Supported recorded payment methods: cash, card, bank transfer and mobile wallet. These are payment records only; no external payment processor is integrated.
- Payments are accepted only for posted sales. Positive safe-integer amounts are required; an allocation cannot exceed the outstanding invoice balance.
- Multiple partial payments are supported. Replayed requests with the same idempotency key and same payload return the original payment; key reuse with a different payload is rejected.
- Each payment creates an audit event. The API returns total paid and outstanding balances.
- Added integration coverage for two partial payments, idempotent replay, conflicting key reuse, overpayment rejection and payment listing.
- Added a migration test that opens an existing schema-v3 database and verifies migration to v4 plus role grants.

### CI verification

- Latest local-runtime validation: [run 43748469553](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43748469553), on source head `8b65139cfa1fe3d48f2cd5babdae6595daaeac5e).
- Result: **success** — dependency installation, TypeScript typecheck, all 9 test files / 35 tests, and TypeScript build passed.
- This validates the local backend package only. It does not validate the desktop UI, Electron packaging, Windows installer, Android API pairing, or full ERP acceptance.

### Updated conclusion

Customer and supplier master-data CRUD and sale-payment allocation are now partially implemented; older rows in the original snapshot above that label customers/suppliers as unimplemented are superseded by this section. Sale payment support is not equivalent to full accounts receivable, cash management, refunds, settlement, or general-ledger accounting. Phase 1 remains open.
