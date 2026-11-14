"""Apply AL-NASR visual defaults to X POS without erasing administrator choices.

A field that still equals its pinned X POS DocField default is considered
unmodified upstream configuration and receives the AL-NASR default. Values
that differ from both the upstream default and AL-NASR's target are preserved.
"""
import frappe


def _normalized(value):
    if value is None:
        return None
    return str(value).strip().lower()


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

    meta = frappe.get_meta("XPOS Branding Settings")
    for fieldname, value in values.items():
        current = frappe.db.get_single_value("XPOS Branding Settings", fieldname)
        field = meta.get_field(fieldname)
        upstream_default = field.default if field else None

        # Empty values and untouched X POS defaults are safe to brand.
        # Preserve administrator values that differ from both defaults.
        if (
            current in (None, "")
            or _normalized(current) == _normalized(upstream_default)
            or _normalized(current) == _normalized(value)
        ):
            frappe.db.set_single_value("XPOS Branding Settings", fieldname, value)

    frappe.clear_cache(doctype="XPOS Branding Settings")
    frappe.cache().delete_value("xpos_branding")
