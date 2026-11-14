# AL-NASR Brand Implementation Matrix

**Baseline:** owner-approved royal falcon identity direction  
**Rule:** A surface is complete only after implementation and a visual check in the running system.

| Surface | Intended AL-NASR treatment | Current status | Acceptance evidence |
|---|---|---|---|
| Repository and project documentation | النصر | AL-NASR name and full product description | Implemented in docs | Review README and product baseline |
| Brand guidelines and color tokens | Falcon/shield symbol; navy, burgundy, antique gold, white | Approved direction documented | Owner approval recorded in brand guidelines |
| Primary logo artwork | Vertical lockup: emblem, oversized dominant النصر wordmark, smaller سوبر ماركت descriptor, quiet نصر عثمان العصيمي signature | SVG source updated; font rendering and vector-path conversion pending | Render in browser; inspect Arabic shaping, spacing, and outlines |
| Standalone emblem | Falcon in ن-inspired shield, wings, pillars, star and diamond | SVG source updated; optical-size review pending | Inspect at 16, 24, 32, 64, and 128 px |
| Favicon | Simplified high-contrast emblem | SVG source updated; browser/runtime registration pending | Inspect browser tab and shortcut |
| Frappe app metadata | Arabic/English title, description, publisher, logo URL, icon, color | Implemented in custom app hooks; runtime unverified | Inspect installed app metadata |
| Custom app module entry | النصر | AL-NASR label and description | Implemented in source; runtime unverified | Verify app/module tile in Desk |
| ERPNext global navbar | AL-NASR brand only where safely supported | Not implemented | Review global hook impact before changing |
| ERPNext login and setup pages | AL-NASR-owned login/landing presentation | Not implemented | Screenshot and RTL/LTR acceptance |
| AL-NASR Desk landing page | One branded entry point with Arabic RTL navigation to POS and core ERP workflows | Implemented in custom app source; runtime verification pending | Install on clean Bench, open `/app/alnasr`, test role access and all destinations |
| POS main screen | AL-NASR logo, accessible palette, Arabic RTL, cashier workflow hierarchy | Not implemented; dashboard links to pinned X POS route | Checkout UAT on target devices |
| POS Electron shell | AL-NASR app icon, window title, installer identity | Not implemented | Build and inspect packaged client |
| Sales and purchase forms | AL-NASR document labels and layout where extensible | Not implemented | Form-by-form visual review |
| Receipts and invoices | Logo, legal business details, Arabic layout, print sizing | Not implemented | Thermal/A4 printer tests |
| Reports and dashboards | AL-NASR headings, colors, Arabic formatting | Not implemented | Role-based report screenshots |
| Emails and notifications | Bilingual AL-NASR templates and footer | Not implemented | Send test messages |
| Browser title and favicon | AL-NASR title and approved favicon | Asset updated; registration/runtime check pending | Browser inspection |
| Exports and generated files | Correct product name, logo and language where supported | Not implemented | Export sample files |
| Mobile/tablet | Responsive AL-NASR experience | Not implemented | Device matrix tests |

## Implementation rules

1. Never edit upstream source files merely to replace names or logos before source import and license review.
2. Prefer Frappe hooks, custom app assets, supported POS configuration, and maintained extension points.
3. Do not set a global `brand_html` override without reviewing its impact on every installed app and public website.
4. Keep ERPNext/Frappe/X POS copyright and license notices intact.
5. Do not claim full rebranding until all applicable rows are implemented and verified.
6. Update this matrix with evidence links or test identifiers as each surface passes.
7. Use the four approved logo colors for brand artwork; separately verify WCAG contrast and semantic status colors for application UI.
8. Keep the registered full owner name in legal/project records; use the approved shorter signature only in the logo.

## Current completion statement

The approved identity direction, four logo color tokens, primary SVG lockup, standalone emblem, favicon source, and brand guidelines are now recorded in the development branch. This is a source-level identity update only. Browser rendering, final font/path conversion, runtime registration, print validation, and all ERPNext/X POS surface integrations remain open.
