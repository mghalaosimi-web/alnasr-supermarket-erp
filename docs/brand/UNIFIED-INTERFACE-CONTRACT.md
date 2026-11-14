# AL-NASR unified interface contract

**Product:** النصر | AL-NASR  
**Scope:** ERPNext/Frappe Desk + X POS v16 + AL-NASR custom app + Android companion client  
**Status:** shared navigation and identity foundation exists; full visual unification is not yet accepted.

## One product, three application surfaces

The product must feel like one system while retaining each component's supported extension boundaries:

1. **ERPNext/Frappe:** accounting, inventory, purchasing, sales documents, suppliers, customers, permissions and reporting.
2. **X POS:** cashier checkout, shifts, payment collection, returns and POS-specific offline queue.
3. **AL-NASR custom app:** the product landing page, common navigation, store-specific workflows, brand tokens and owner-specific features.

The AL-NASR Desk page at `/app/alnasr` is the intended common entry point. It links to ERPNext DocTypes and the X POS route at `/xpos/pos`. The Android application is a secure local-network client for the same server; it is not a fourth database or a second ERP.

## Shared visual contract

- Product display name: `النصر | AL-NASR`.
- Arabic default with semantic RTL; English must use LTR.
- Approved brand colors: Royal Navy `#0F2537`, Royal Burgundy `#4A0E17`, Antique Gold `#C5A059`, and white.
- Common logo assets: `alnasr-logo.svg`, `alnasr-mark.svg`, and `favicon.svg`.
- Consistent spacing, typography, focus states, button hierarchy, field sizing, navigation labels, responsive breakpoints and empty/error/loading states.
- Preserve upstream ERPNext/Frappe and X POS licenses, copyright notices, and required attribution.
- Do not patch upstream source merely to replace logos. Prefer Frappe hooks, app assets, X POS supported settings/extension points, and an AL-NASR-owned wrapper.

## Required acceptance surfaces

| Surface | Acceptance requirement | Current status |
|---|---|---|
| AL-NASR Desk landing | One branded home with links to POS and core ERP workflows | Source implemented; browser visual and role acceptance pending |
| ERPNext Desk/navbar/workspaces | Consistent AL-NASR product identity without breaking upstream apps | Not fully implemented |
| X POS checkout | Same palette, logo, Arabic RTL, cashier navigation and accessible controls | Branding defaults exist; full screen-by-screen visual/UAT pending |
| Android client | Same name/colors, secure HTTPS pairing, correct back navigation and connection recovery | Debug wrapper source exists; physical-device and LAN tests pending |
| Documents and print | Sales/purchase forms, invoices, receipts, A4/thermal layouts | Pending |
| Reports and exports | Product identity, Arabic formatting and correct values | Pending |
| Login/setup | Branded first-run and login flow with safe setup | Pending |
| Small screens | Responsive behavior for supported phone/tablet sizes | CSS baseline exists; device acceptance pending |

## Release evidence required

A source-level contract test is not a visual acceptance test. Each surface is accepted only with:
- the exact tested commit and environment,
- a successful clean install and migration,
- screenshots or device recordings for Arabic and English,
- functional navigation and role checks,
- representative business workflow tests,
- no console/runtime errors in the tested paths.

The Android wrapper connects to the Windows-hosted Frappe system over the private LAN using HTTPS. The Android APK does not contain the authoritative database or server; the Windows host remains the system of record.

## Current truthful completion statement

The common AL-NASR entry page, links to ERPNext and X POS, shared CSS tokens, and a secure Android WebView shell are present in source. This does **not** establish that every screen is visually unified, that the Android client works on a physical phone, or that the complete offline installer is ready. Those remain explicit release gates.
