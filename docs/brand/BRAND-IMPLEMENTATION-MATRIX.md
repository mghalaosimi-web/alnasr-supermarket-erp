# AL-NASR Brand Implementation Matrix

**Baseline:** initial identity commit  
**Rule:** A surface is complete only after implementation and a visual check in the running system.

| Surface | Intended AL-NASR treatment | Current status | Acceptance evidence |
|---|---|---|---|
| Repository and project documentation | النصر | AL-NASR name and full product description | Implemented in docs | Review README and product baseline |
| Frappe app metadata | Arabic/English title, description, publisher, logo URL, icon, color | Implemented in custom app hooks; runtime unverified | Inspect installed app metadata |
| Custom app module entry | النصر | AL-NASR label and description | Implemented in source; runtime unverified | Verify app/module tile in Desk |
| Original logo artwork | Horizontal wordmark, standalone mark, favicon | Source assets created | Render SVG in browsers and print test |
| ERPNext global navbar | AL-NASR brand only where safely supported | Not implemented | Review global hook impact before changing |
| ERPNext login and setup pages | AL-NASR-owned login/landing presentation | Not implemented | Screenshot and RTL/LTR acceptance |
| Workspaces and navigation | Arabic labels, AL-NASR palette, consistent iconography | Not implemented | Review every workspace and role |
| POS main screen | AL-NASR logo, palette, Arabic RTL, cashier workflow hierarchy | Not implemented | Checkout UAT on target devices |
| POS Electron shell | AL-NASR app icon, window title, installer identity | Not implemented | Build and inspect packaged client |
| Sales and purchase forms | AL-NASR document labels and layout where extensible | Not implemented | Form-by-form visual review |
| Receipts and invoices | Logo, legal business details, Arabic layout, print sizing | Not implemented | Thermal/A4 printer tests |
| Reports and dashboards | AL-NASR headings, colors, Arabic formatting | Not implemented | Role-based report screenshots |
| Emails and notifications | Bilingual AL-NASR templates and footer | Not implemented | Send test messages |
| Browser title and favicon | AL-NASR title and favicon | Asset created; registration/runtime check pending | Browser inspection |
| Exports and generated files | Correct product name, logo and language where supported | Not implemented | Export sample files |
| Mobile/tablet | Responsive AL-NASR experience | Not implemented | Device matrix tests |

## Implementation rules

1. Never edit upstream source files merely to replace names or logos before source import and license review.
2. Prefer Frappe hooks, custom app assets, supported POS configuration, and maintained extension points.
3. Do not set a global `brand_html` override without reviewing its impact on every installed app and public website.
4. Keep ERPNext/Frappe/X POS copyright and license notices intact.
5. Do not claim full rebranding until all applicable rows are implemented and verified.
6. Update this matrix with evidence links or test identifiers as each surface passes.

## Current completion statement

Initial brand documentation, SVG assets, and custom app metadata are present in the development branch. Full-system branding remains an open implementation stream and cannot be verified until the upstream applications are imported and running.
