# AL-NASR Native Windows Offline Preview

## Scope

This preview is a native Windows x64 desktop application built with Electron, React and SQLite. Docker, WSL, MariaDB and cloud services are not runtime requirements.

The current preview includes:
- First-run owner account creation and local login.
- Local SQLite database initialization and migrations.
- Product creation and listing with SKU, barcode, cost, selling price and opening stock.
- A main warehouse and default piece unit.
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

Back up the database file before reinstalling Windows or moving the system to another computer. A built-in backup/restore screen is not implemented yet.

## Important limitations

This is an engineering preview, not the completed AL-NASR ERP release.

Not yet included:
- Purchase orders and supplier receiving workflows.
- Stock adjustments and transfers.
- Returns, voids and refund workflows.
- Split payments, discounts, taxes and customer credit.
- Printable receipts and receipt-printer integration.
- Full accounting, financial reports and period closing.
- Android client and authenticated LAN pairing.
- Automated backup/restore and business acceptance testing.

The current sales implementation supports whole-number quantities and one payment method per sale. It checks stock availability and posts sale, payment, stock movement and audit records in one SQLite transaction. It does not yet implement all supermarket pricing, weighing or accounting rules.

## Trust and installation notes

The preview installer is not code-signed. Windows SmartScreen or antivirus software may display a warning. Do not bypass warnings on a file that was not downloaded from this repository's official Actions artifact.

A successful CI build proves compilation, automated tests and packaging. It does not replace a clean Windows-device installation test, physical offline test, printer test or acceptance by the business owner.
