# AL-NASR Native Windows Offline Preview

## Scope

This preview is a native Windows x64 desktop application built with Electron, React and SQLite. Docker, WSL, MariaDB and cloud services are not runtime requirements.

The current preview includes:
- First-run owner account creation and local login.
- Local SQLite database initialization and migrations.
- Product creation and listing with SKU, barcode, cost, selling price and opening stock.
- A main warehouse and default piece unit.
- Manual stock receiving, physical stock-count reconciliation, stock movement history and weighted-average cost updates.
- A built-in SQLite online-backup action with a native Save dialog.
- Barcode/SKU scanner input on the POS page.
- Supplier and customer directories; sales can be associated with a customer.
- Supplier-linked multi-line purchase invoices, initial and subsequent supplier payments, outstanding-balance settlement, stock receipt movements and weighted-average cost updates with atomic posting and audit history.
- Customer credit sales with partial upfront collection, customer credit-limit enforcement, receivables listing and subsequent payment collection.
- Cashier shift opening and closing.
- Basic point-of-sale checkout with cash/card/transfer method selection.
- Atomic sale posting, stock decrement, payment record and audit event.
- Arabic RTL interface with separate dashboard, POS and product pages.

## Installation

1. Download the latest successful `AL-NASR-Native-Windows-Installer-Preview` artifact from the PR's GitHub Actions run.
2. Extract the ZIP archive.
3. Run `AL-NASR-Setup-0.1.0-x64.exe`.
4. Follow the NSIS wizard and finish installation.
5. Launch **AL-NASR** from the Start Menu or desktop shortcut.
6. On first launch, create the owner account. Use a strong password of at least 12 characters.
7. Sign in and create products with their opening stock before using the POS page.

## Local data

The SQLite database is created under Electron's per-user application data directory:

`%APPDATA%\AL-NASR\data\alnasr.sqlite`

The database is stored outside the installation directory. The NSIS configuration is set not to delete application data during uninstall.

Use the **النسخ الاحتياطي** page in AL-NASR to create a consistent SQLite backup while the application is running. Store the resulting file on an external drive or another safe location. A built-in restore workflow is not implemented yet; do not overwrite the live database manually while AL-NASR is running.

## Important limitations

This is an engineering preview, not the completed AL-NASR ERP release.

Not yet included:
- Customer credit sales, receivables, statements and credit-limit enforcement.
- Inter-warehouse transfers.
- Returns, voids and refund workflows.
- Split tender across multiple payment methods within one transaction, discounts, taxes, and full customer account statements. Purchases and sales support successive payments, but a unified cash/bank ledger is not implemented.
- Printable receipts and receipt-printer integration.
- Full accounting, financial reports and period closing.
- Android client and authenticated LAN pairing.
- Database restore workflow and business acceptance testing.

The current sales implementation supports whole-number quantities, one payment method per payment event, partial upfront collection and subsequent receivable settlement. It enforces customer credit limits, checks stock availability and posts sale, payment, stock movement and audit records in one SQLite transaction. It does not yet implement all supermarket pricing, weighing or accounting rules.

## Trust and installation notes

The preview installer is not code-signed. Windows SmartScreen or antivirus software may display a warning. Do not bypass warnings on a file that was not downloaded from this repository's official Actions artifact.

A successful CI build proves compilation, automated tests and packaging. It does not replace a clean Windows-device installation test, physical offline test, printer test or acceptance by the business owner.
