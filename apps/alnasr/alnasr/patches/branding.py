"""Apply AL-NASR visual defaults to the X POS branding singleton.

Existing non-empty administrator settings are preserved. This lets the
AL-NASR identity be applied on first installation without overwriting a
previously customized X POS branding configuration.
"""
import frappe


def apply_xpos_branding_defaults():
    if not frappe.db.exists("DocType", "XPOS Branding Settings"):
        return

    values = {
        "logo_light": "/assets/alnasr/images/alnasr-mark.svg",
        "logo_dark": "/assets/alnasr/images/alnasr-mark-light.svg",
        "favicon": "/assets/alnasr/images/favicon.svg",
        "enable_splash": 1,
        "splash_background_color": "#0F2537",
        "light_background": "#FFFFFF",
        "light_foreground": "#0F2537",
        "light_card": "#FFFFFF",
        "light_card_foreground": "#0F2537",
        "light_popover": "#FFFFFF",
        "light_popover_foreground": "#0F2537",
        "light_primary": "#0F2537",
        "light_primary_foreground": "#FFFFFF",
        "light_ring": "#C5A059",
        "light_secondary": "#F3F5F7",
        "light_secondary_foreground": "#0F2537",
        "light_accent": "#F3F5F7",
        "light_accent_foreground": "#0F2537",
        "light_muted": "#F3F5F7",
        "light_muted_foreground": "#667482",
        "light_border": "#D9E0E6",
        "light_input": "#D9E0E6",
        "dark_background": "#0F2537",
        "dark_foreground": "#FFFFFF",
        "dark_card": "#173348",
        "dark_card_foreground": "#FFFFFF",
        "dark_popover": "#173348",
        "dark_popover_foreground": "#FFFFFF",
        "dark_primary": "#C5A059",
        "dark_primary_foreground": "#0F2537",
        "dark_ring": "#C5A059",
        "dark_secondary": "#20394D",
        "dark_secondary_foreground": "#FFFFFF",
        "dark_accent": "#20394D",
        "dark_accent_foreground": "#FFFFFF",
        "dark_muted": "#20394D",
        "dark_muted_foreground": "#C8D1D9",
        "dark_border": "#385064",
        "dark_input": "#385064",
        "radius": 0.625,
    }

    for fieldname, value in values.items():
        current = frappe.db.get_single_value("XPOS Branding Settings", fieldname)
        if current in (None, ""):
            frappe.db.set_single_value("XPOS Branding Settings", fieldname, value)

    frappe.clear_cache(doctype="XPOS Branding Settings")
    frappe.cache().delete_value("xpos_branding")
