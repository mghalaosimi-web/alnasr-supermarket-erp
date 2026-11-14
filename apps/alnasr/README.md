# النصر | AL-NASR

**نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة**

AL-NASR is a separately branded retail-management product built on Frappe and ERPNext. The custom app owns AL-NASR-specific configuration, workflows, permissions, reports, integrations, and original brand assets.

## Brand identity

- Arabic product name: **النصر**
- English product name: **AL-NASR**
- Business owner: **نصر عثمان عبدالله العصيمي**
- Product category: Supermarket, retail, and wholesale management
- Primary interface language: Arabic (RTL); English (LTR) is also required.
- Proposed brand palette and logo specifications: [Brand guidelines](../../docs/brand/BRAND-GUIDELINES.md).

## Compatibility

- Target framework: Frappe v16
- Target ERP: ERPNext v16
- Python/runtime versions must match the pinned upstream Frappe v16 environment.
- This app remains a foundation scaffold; no production DocTypes or workflows are declared complete.

## Principles

- Do not patch ERPNext core.
- Keep store-specific DocTypes, permissions, reports, integrations, and UI in this app.
- Every stock or accounting mutation must use supported ERPNext business APIs and preserve ledger integrity.
- Add tests before enabling workflows in a live store.
- Preserve upstream license notices and distinguish AL-NASR original assets from upstream assets.

## Brand assets

- `alnasr-logo.svg`: vertical primary lockup with the falcon/shield emblem, oversized Arabic wordmark, descriptor, and owner signature.
- `alnasr-mark.svg`: standalone falcon/shield symbol for compact surfaces.
- `favicon.svg`: simplified browser/application icon.
- Public asset source directory: `alnasr/public/images/`.

## Unified Desk entry point\n\nThe custom app now provides an AL-NASR Desk landing page at `/app/alnasr`, with Arabic-first sections and shortcuts into the existing X POS route and ERPNext standard DocTypes. The page uses shared AL-NASR CSS tokens and responsive desktop/mobile layout. It is a unified navigation entry point, not yet a complete replacement of every ERPNext/X POS screen. Runtime route loading, role-specific visibility, and visual review remain CI/UAT acceptance items.\n\n## Current branding coverage

The custom app metadata and its module entry use the AL-NASR name, primary logo asset, and Royal Navy brand color. Runtime rendering and module-tile appearance remain unverified until installed in a Frappe site. This does not automatically rebrand every ERPNext, X POS, print format, login, email, report, or Electron screen. See [Brand implementation matrix](../../docs/brand/BRAND-IMPLEMENTATION-MATRIX.md) for the remaining integration work and acceptance checks.
