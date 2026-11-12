# AL-NASR Frappe App

Custom application boundary for AL-NASR supermarket workflows.

## Compatibility

- Target framework: Frappe v16
- Target ERP: ERPNext v16
- Python/runtime versions must match the pinned upstream Frappe v16 environment.
- This app is a scaffold only; no production DocTypes or workflows are declared complete.

## Principles

- Do not patch ERPNext core.
- Keep store-specific DocTypes, permissions, reports, integrations, and UI in this app.
- Every stock or accounting mutation must use supported ERPNext business APIs and preserve ledger integrity.
- Add tests before enabling workflows in a live store.
