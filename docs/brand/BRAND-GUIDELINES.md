# النصر | AL-NASR — Brand Guidelines

**Identity status:** Owner-approved direction and color tokens; final artwork still requires rendering and acceptance checks.  
**Product owner (registered full name):** نصر عثمان عبدالله العصيمي  
**Logo signature (approved display form):** نصر عثمان العصيمي

## 1. Brand definition

- Arabic brand: **النصر**
- English brand: **AL-NASR**
- Logo descriptor: **سوبر ماركت**
- Product descriptor (Arabic): **نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة**
- Product descriptor (English): **Integrated Supermarket, Retail & Wholesale Management System**
- Brand character: royal, confident, disciplined, trustworthy, and commerce-focused.
- Language hierarchy: Arabic-first; English is a secondary product-language option.

## 2. Approved symbol architecture

The primary emblem is a geometric royal falcon integrated into a vertical shield inspired by the Arabic letter **ن**:

- A central upright U-shaped shield forms the structural core and references the letter ن.
- The falcon head sits inside the shield.
- Three sharp, coordinated feather layers form each wing.
- Retail barcode/structural pillars flank the emblem and continue into the lower side structure and tail.
- A five-point antique-gold star crowns the symbol.
- A diamond-shaped mark beneath the star represents the dot of ن.
- The tail uses a compact fan of geometric feathers.

The mark must remain symmetrical and legible. Do not add photorealistic bird details, gradients, 3D effects, or unrelated shopping-cart imagery.

## 3. Approved color tokens

| Token | Hex | Primary use |
|---|---|---|
| Pure White | `#FFFFFF` | Main background and clear space |
| Royal Navy | `#0F2537` | Falcon/shield, primary wordmark, owner signature |
| Royal Burgundy | `#4A0E17` | Wing accents and outer wordmark outline |
| Antique Gold | `#C5A059` | Star, structural accents, inner wordmark outline, descriptor |

These four colors are the approved logo palette. Do not silently reintroduce the earlier forest-green palette into logo artwork. Interface status colors remain semantic and must not be replaced by brand colors.

## 4. Typography hierarchy

1. **النصر** — dominant Arabic wordmark; heavy geometric Arabic sans/Kufi style, navy fill, antique-gold inner outline and burgundy outer outline.
2. **سوبر ماركت** — directly below the main wordmark, smaller and medium/heavy weight in antique gold.
3. **نصر عثمان العصيمي** — at the lower baseline in a clear, calm navy Arabic sans.

The source SVG currently uses Cairo/Reem Kufi font-family fallbacks. For production artwork, convert final approved Arabic lettering to vector paths after selecting and checking the exact font rendering. Do not depend on remote Google Fonts at runtime, and never convert live application UI text into images.

## 5. Logo assets and variants

- `alnasr-logo.svg`: vertical primary lockup with emblem, Arabic wordmark, descriptor, and owner signature.
- `alnasr-mark.svg`: standalone falcon/shield emblem for compact brand surfaces.
- `favicon.svg`: simplified high-contrast emblem for browser tabs and shortcuts.

Required follow-up variants:
- Horizontal lockup for narrow headers.
- Single-color black and white marks for stamps and low-cost printing.
- Dark-background version with verified contrast.
- Small-size optical variant with simplified pillar details.
- Raster exports only when a consuming platform requires them.

Maintain clear space around the mark. Never stretch, rotate, arbitrarily recolor, or add shadows/gradients.

## 6. Interface and product principles

- Arabic RTL is the default. Layout direction must be semantic, not achieved by reversing individual icons indiscriminately.
- Use the approved logo tokens in AL-NASR-owned visual surfaces. Define separate accessible UI tokens where needed; gold text on white must pass contrast checks before use for small text.
- Keep prices, quantities, barcodes, totals, tables, and cashier actions highly legible.
- Do not overwrite ERPNext/Frappe/X POS legal marks, copyright notices, or upstream attribution.
- Prefer supported Frappe hooks, custom app assets, and POS extension points. Do not modify upstream source just to replace a logo.

## 7. Ownership and naming

- Product name: **النصر | AL-NASR**
- Registered owner name in project records: **نصر عثمان عبدالله العصيمي**
- Approved logo signature: **نصر عثمان العصيمي**

The shorter signature is a display decision for the logo; it does not alter the full registered owner name in project records or legal documents.

## 8. Approval and implementation boundary

The owner has approved the symbol direction, logo hierarchy, display signature, and four logo color tokens. The source assets and this guideline record that decision. However, the artwork is not yet production-verified: render it in supported browsers, validate Arabic shaping and font metrics, test print and small-size legibility, and convert final lettering to paths before treating the master artwork as final.

Full-system branding is not complete. ERPNext global navigation, login/setup, workspaces, POS, Electron packaging, sales/purchase forms, receipts, invoices, reports, emails, notifications, browser metadata, exports, and mobile/tablet surfaces must each be implemented through supported extension points and visually accepted. Do not claim full rebranding until the implementation matrix has evidence for each applicable surface.
