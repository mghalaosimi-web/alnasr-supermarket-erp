# AL-NASR acceptance matrix

| Area | Required evidence | Status |
|---|---|---|
| Brand source assets | SVG XML validity, approved palette, required Arabic labels, wordmark hierarchy, accessible title | Source contract tests passed in clean CI; browser/font/print rendering still not run |
| Clean install | Reproducible Frappe/ERPNext v16 install | Passed on pinned commits in disposable MariaDB CI; Bench, all apps, migrations and HTTP ping verified |
| Custom app runtime contracts | Installed app list, standard ERPNext DocTypes, X POS operational DocTypes, API imports and app metadata | Tests added; new Frappe test gate pending CI result |
| Catalog | UOM conversions, variants, multiple barcodes, price lists | Not run |
| POS | Checkout, split tender, discounts, receipt | Not run |
| Shifts | Open, cash movements, close, variance | Not run |
| Returns | Partial/full returns, refund and stock/accounting effects | Not run |
| Inventory | Receipt, transfer, count, adjustment, valuation | Not run |
| Purchasing | PO, receipt, invoice, supplier return | Not run |
| Credit | Limits, due dates, collections, aging | Not run |
| Roles | Cashier, supervisor, inventory, buyer, accountant, owner | Not run |
| Offline | Queue durability, idempotency, reconnect, conflict handling and device restart | Source inspected; no AL-NASR runtime/device acceptance test passed |
| LAN | Multiple terminals and server interruption | Not run |
| Hardware | Barcode scanner, thermal printer, cash drawer, scale if used | Not run |
| Arabic | RTL, numerals, currency, printed receipt | Source direction documented; runtime visual/print validation not run |
| Recovery | Backup restore and disaster recovery drill | Not run |
| Security | Permission tests, audit trail, secret scan | Not run |

A row may be marked passed only when the test evidence, tested revision, and environment are recorded. A successful app installation does not count as passing a business workflow.
