# النصر | AL-NASR — Brand Guidelines

**Status:** Initial proposed identity system for owner review  
**Product owner:** نصر عثمان عبدالله العصيمي

## 1. Brand definition

- Arabic brand: **النصر**
- English brand: **AL-NASR**
- Descriptor (Arabic): **نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة**
- Descriptor (English): **Integrated Supermarket, Retail & Wholesale Management System**
- Brand character: reliable, organized, modern, practical, and commerce-focused.
- Language hierarchy: Arabic-first; English is a secondary language option.

## 2. Logo concept

The original symbol combines a structured retail basket with a central vertical mark. The basket communicates commerce and product movement; the structured geometry communicates control, stock accuracy, and operational reliability. The bilingual wordmark keeps the Arabic brand prominent while retaining a consistent Latin name.

The SVG artwork is original AL-NASR project artwork. It is not an ERPNext or X POS logo and does not replace upstream attribution.

## 3. Color palette

| Token | Hex | Use |
|---|---|---|
| AL-NASR Forest | `#174A3A` | Primary brand, navigation, key actions |
| AL-NASR Green | `#247653` | Secondary actions and positive operational states |
| AL-NASR Gold | `#C49A45` | Accent, highlights, selected details |
| Ink | `#172B2A` | Primary text |
| Paper | `#FFFFFF` | Main surfaces |
| Mist | `#F3F6F4` | Secondary backgrounds |
| Border | `#DCE5DF` | Dividers and subtle borders |

Do not use the gold accent for small text on white backgrounds unless contrast is verified. Status colors must retain their semantic meaning and must not be replaced by brand colors.

## 4. Typography

- Arabic: Noto Sans Arabic, with a system sans-serif fallback.
- Latin: Inter, with a system sans-serif fallback.
- Use readable weights and clear numeric glyphs for prices, quantities, barcodes, and invoice totals.
- Never convert live interface text to images.

## 5. Logo variants and usage

- `alnasr-logo.svg`: preferred horizontal lockup for application headers and documents.
- `alnasr-mark.svg`: compact symbol for app tiles, avatars, and narrow spaces.
- `favicon.svg`: browser tab and app shortcut icon.
- Maintain clear space around the mark; do not stretch, recolor, rotate, or add effects.
- On dark backgrounds, use a separately approved light variant before deployment; do not apply arbitrary filters to the master SVG.

## 6. Interface principles

- Arabic RTL is the default. Layout direction must be semantic, not achieved by reversing individual icons indiscriminately.
- Use consistent spacing, border radii, table density, form labels, and action hierarchy.
- Prioritize fast cashier workflows: barcode input, quantity, price, payment, and receipt actions must be visually distinct and keyboard accessible.
- Keep dense ERP tables readable and avoid decorative gradients that reduce contrast.
- Use one identity across AL-NASR-owned screens, but do not overwrite third-party legal marks or attribution.

## 7. Required applications

The identity must be applied and checked across app launcher, navigation, login/landing, dashboards, POS, sales and purchase documents, print formats, reports, exports, emails, browser metadata, favicon, and Electron packaging if that client is shipped.

## 8. Approval status

This is a proposed first version of the identity, not final owner-approved artwork. The owner should approve or request changes to the logo concept and palette before broad rollout. The current implementation only registers the custom app metadata and adds source logo assets; it does not yet rebrand every screen.
