# AL-NASR acceptance matrix

| Area | Required evidence | Status |
|---|---|---|
| Brand source assets | SVG XML validity, approved palette, required Arabic labels, wordmark hierarchy, accessible title | Source contract tests added; GitHub Actions run #82 passed; browser/font/print rendering still not run |
| Clean install | Reproducible Frappe/ERPNext v16 install | Not run |
| Custom app | Install, migrate, uninstall/rollback behavior | Scaffold only |
| Catalog | UOM conversions, variants, multiple barcodes, price lists | Not run |
| POS | Checkout, split tender, discounts, receipt | Not run |
| Shifts | Open, cash movements, close, variance | Not run |
| Returns | Partial/full returns, refund and stock/accounting effects | Not run |
| Inventory | Receipt, transfer, count, adjustment, valuation | Not run |
| Purchasing | PO, receipt, invoice, supplier return | Not run |
| Credit | Limits, due dates, collections, aging | Not run |
| Roles | Cashier, supervisor, inventory, buyer, accountant, owner | Not run |
| Offline | Queue durability, idempotency, reconnect, conflict handling | Not run |
| LAN | Multiple terminals and server interruption | Not run |
| Hardware | Barcode scanner, thermal printer, cash drawer, scale if used | Not run |
| Arabic | RTL, numerals, currency, printed receipt | Not run |
| Recovery | Backup restore and disaster recovery drill | Not run |
| Security | Permission tests, audit trail, secret scan | Not run |

A row may be marked passed only when the test evidence, tested revision, and environment are recorded.
