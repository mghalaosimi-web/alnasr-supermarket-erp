# AL-NASR Compatibility Overrides

## Scope

AL-NASR pins ERPNext v16 and X POS v16 as upstream Git submodules. Upstream source files and licenses remain unchanged. Any compatibility reconciliation belongs to the AL-NASR custom app and must be idempotent, documented, and covered by runtime tests.

## Confirmed X POS / ERPNext return-credit-note conflict

Pinned X POS revision: `3668fca6ffcab737347d4d223ac93f5d74aa90b3` (X POS 2.13.4).

X POS ships this Property Setter in `xpos/x_pos/custom/sales_invoice.json`:

- Name: `Sales Invoice-update_outstanding_for_self-default`
- Property: `default`
- Value: `0`

Pinned ERPNext v16 defines `Sales Invoice.update_outstanding_for_self` with upstream default `1`. Its field description states that a credit note updates its own outstanding amount even when `Return Against` is specified.

The X POS Property Setter overrides that ERPNext behavior and caused two upstream Sales Invoice regressions in the integrated site:

1. `test_ledger_entries_of_return_pos_invoice`: the return GL entries used the original POS invoice as `against_voucher` instead of the return credit note.
2. `test_return_sales_invoice`: the return credit note's own `outstanding_amount` remained `0` instead of `-1000`.

The same two tests passed on the ERPNext-only baseline and failed with X POS installed, which isolated the conflict to the X POS integration layer. The upstream ERPNext test expectations are not modified or skipped.

## AL-NASR reconciliation

`apps/alnasr/alnasr/patches/compatibility.py` removes only the conflicting Property Setter by its exact document name. The function then clears the Sales Invoice metadata cache and asserts that ERPNext's upstream default remains `1`.

The function is registered through Frappe's `after_migrate` hook in `apps/alnasr/alnasr/hooks.py`. This is intentional: X POS syncs its customization during migration, so a one-time patch would not be sufficient if a later migration re-imported the setter.

The runtime contract test `test_erpnext_return_credit_note_default_is_preserved` verifies both that the conflicting setter is absent and that the effective DocField default is `1`.

## Acceptance criteria

- The compatibility hook executes after every successful site migration.
- The Property Setter is absent after migration.
- ERPNext's effective DocField default is `1`.
- The full upstream Sales Invoice suite passes unchanged on the integrated site.
- Both return-credit-note regressions pass.
- No ERPNext or X POS submodule source is modified.
