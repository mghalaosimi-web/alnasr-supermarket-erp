# X POS v16 fit-gap assessment for AL-NASR

**Evidence source:** X POS `version-16` README at the candidate upstream revision recorded in `UPSTREAM-LOCK.md`.
**Assessment status:** Documentation-based assessment only. No source import, installation, code review, or runtime acceptance test has been completed.

## Capabilities advertised by upstream

| Requirement | X POS v16 README claim | AL-NASR decision |
|---|---|---|
| Barcode-first checkout | Barcode scanning and automatic item lookup | Reuse; test the actual scanner model and barcode formats |
| Multiple payments | Split payment across payment modes | Reuse; verify Yemen-relevant payment modes and cash rounding |
| Draft carts | Draft invoices and multiple open orders per session | Reuse; test recovery and cashier isolation |
| Returns | Return mode linked to original invoices and credit notes | Reuse; test partial returns, refund permissions, stock and GL |
| Offline selling | Local pending invoice queue, cached master data, background retry | Candidate only; prove durability, idempotency, replay and reconciliation |
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
