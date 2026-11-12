# X POS v16 fit-gap assessment for AL-NASR

**Evidence source:** X POS v2.13.4, commit `3668fca6ffcab737347d4d223ac93f5d74aa90b3`, checked out as a pinned submodule.
**Assessment status:** Source inspected and installed successfully with Frappe/ERPNext in disposable CI. AL-NASR-specific runtime contract tests are being added; end-to-end retail workflows and device/offline acceptance remain open.

## Capabilities advertised by upstream

| Requirement | X POS v16 README claim | AL-NASR decision |
|---|---|---|
| Barcode-first checkout | Barcode scanning and automatic item lookup | Reuse; test the actual scanner model and barcode formats |
| Multiple payments | Split payment across payment modes | Reuse; verify Yemen-relevant payment modes and cash rounding |
| Draft carts | Draft invoices and multiple open orders per session | Reuse; test recovery and cashier isolation |
| Returns | Return mode linked to original invoices and credit notes | Reuse; test partial returns, refund permissions, stock and GL |
| Offline selling | IndexedDB cache/queues, pending invoice and purchase sync, periodic retry, review/dead-letter states | Source inspected; candidate for controlled testing only. Browser/device durability and recovery remain unverified |
| Pricing | Price lists, pricing rules, promotions, coupons, discounts | Reuse ERPNext/X POS; configure only owner-approved policies |
| Customer credit | Credit limits and outstanding settlement | Reuse; validate receivables and approval controls |
| Purchasing | Purchase orders, purchase invoices, stock receiving | Reuse only after workflow and permissions are tested |
| Shift management | Opening/closing shifts, cash expenses and deposits | Reuse; validate cash accounting and cashier close variance |
| Batch/serial | Selection during sale or return | Reuse where required; test expiry and stock valuation |
| Receipts | ERPNext print formats and ESC/POS thermal printer support | Reuse; test Arabic RTL, paper width, cutter and actual printer |
| Arabic RTL | Full RTL support is advertised | Candidate only; validate all screens, receipts, numerals and mixed text |
| Mobile | README describes a separate Android XPOS Mobile application | Separate deliverable; not included in this repository's custom app scaffold |

## Deployment recommendation

1. Evaluate both Web/PWA and Electron deployment on the actual cashier devices; the upstream README advertises both, but neither is certified for AL-NASR until acceptance tests pass.
2. Test Electron packaging, installation, updates, local persistence, hardware access, and recovery separately from browser/PWA behavior.
3. Evaluate Hub & Spoke only after confirming the topology, sync protocol, conflict handling, and recovery behavior in the exact pinned revision.
4. Treat Android XPOS Mobile as a separate integration and release track; verify its source, distribution, authentication, supported operations, and API compatibility before adopting it.
5. Test offline behavior with at least three distinct failure cases: internet unavailable while LAN/server remain available; store LAN/server unavailable; device power loss while transactions are queued. These are not equivalent failure modes.

## Required acceptance evidence

- Exact upstream commit installed on a clean Frappe/ERPNext v16 site.
- Checkout, split payment, draft recovery, returns, refunds, shift close, purchasing and stock ledger tests.
- Offline queue survives browser/app restart and device restart.
- Retry is idempotent; no duplicate invoice or payment can be created.
- Reconciliation detects and surfaces conflicts without silently overwriting transactions.
- Role permissions prevent cashier escalation to unauthorized discounts, refunds, voids and expenses.
- Arabic receipt output validated on the store's actual thermal printer.

## Scope boundary

This assessment does not certify any upstream feature as working in AL-NASR. All upstream claims remain unverified until tested against the exact pinned revision and target deployment.

## Source-level findings at the pinned revision

- The browser POS has an IndexedDB-backed offline store, a pending invoice queue, cached catalog/customer/stock data, and a periodic sync cycle documented at five-minute intervals.
- Offline sales are persisted locally before the cart is cleared. The browser submission path also persists a recovery record before sending, so a lost response can be retried with the same sale identity.
- The server invoice API uses xpos_local_id and a request fingerprint to find an existing sale before creating another. Reuse of an ID for a different sale is rejected; an existing invoice is returned as a duplicate response.
- Price changes during offline time can hold a sale for review rather than silently posting a different amount. Fiscalization uncertainty is held for explicit review instead of automatic blind retries.
- X POS documents separate constraints for gift-card activity, customer-specific prices, external payment verification, and shift closing. These must be included in AL-NASR's acceptance cases.
- Shift management uses the standard POS Opening Shift and POS Closing Shift DocTypes; the closing process summarizes invoices, taxes and payment modes. Cash variance and payment totals still need accounting-level reconciliation tests.
- The installed source is the Web/PWA POS code path. Electron packaging and Android are separate deployment/device tracks and are not certified by the successful Bench installation.

## Verified installation evidence

The pinned Frappe, ERPNext, X POS and AL-NASR apps were installed together on a disposable MariaDB-backed Bench site. The workflow completed asset builds, site creation, all three app installs, migrations, installed-app verification, and the Frappe HTTP ping. See [runtime integration run #43327483473](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43327483473).

The expanded CI suite also passed 449 X POS frontend unit tests across 24 files, one backend invoice-retry/idempotency test, and 25 backend shift tests in [run #43330277075](https://github.com/mghalaosimi-web/alnasr-supermarket-erp/actions/runs/43330277075). Offline-focused frontend coverage includes 12 queue tests, 6 offline receipt-storage tests, 7 offline-sale tests, and 5 durable invoice-submission tests.

These results validate source-level unit and contract behavior, not a completed browser-to-database sale, refund, stock ledger, GL posting, end-to-end shift reconciliation, real browser/device restart, LAN/server outage recovery, or physical receipt printer. Those acceptance gates remain open.
