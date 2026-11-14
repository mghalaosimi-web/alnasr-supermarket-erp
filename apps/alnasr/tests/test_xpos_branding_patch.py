"""Regression tests for AL-NASR's supported X POS branding integration.

The patch is deliberately tested with a small Frappe boundary fake so this
suite can run in source-validation CI without starting a Bench site.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
PATCH_PATH = ROOT / "apps" / "alnasr" / "alnasr" / "patches" / "branding.py"


class FakeField:
    def __init__(self, default=None):
        self.default = default


class FakeMeta:
    def __init__(self, defaults):
        self.defaults = defaults

    def get_field(self, fieldname):
        return FakeField(self.defaults.get(fieldname))


class FakeDB:
    def __init__(self, values):
        self.values = dict(values)
        self.writes = []
        self.doctype_exists = True

    def exists(self, doctype, name):
        return self.doctype_exists and doctype == "DocType" and name == "XPOS Branding Settings"

    def get_single_value(self, doctype, fieldname):
        return self.values.get(fieldname)

    def set_single_value(self, doctype, fieldname, value):
        self.values[fieldname] = value
        self.writes.append((fieldname, value))


class FakeCache:
    def __init__(self):
        self.deleted = []

    def delete_value(self, key):
        self.deleted.append(key)


class FakeFrappe(types.ModuleType):
    def __init__(self, values, defaults):
        super().__init__("frappe")
        self.db = FakeDB(values)
        self.meta = FakeMeta(defaults)
        self.cache_instance = FakeCache()
        self.cleared_doctypes = []

    def get_meta(self, doctype):
        assert doctype == "XPOS Branding Settings"
        return self.meta

    def clear_cache(self, doctype=None):
        self.cleared_doctypes.append(doctype)

    def cache(self):
        return self.cache_instance


def load_patch(fake_frappe):
    spec = spec_from_file_location("alnasr_test_branding_patch", PATCH_PATH)
    module = module_from_spec(spec)
    with patch.dict(sys.modules, {"frappe": fake_frappe}):
        spec.loader.exec_module(module)
    return module


class XPOSBrandingPatchTests(unittest.TestCase):
    def test_applies_brand_tokens_to_empty_and_untouched_upstream_defaults(self):
        fake = FakeFrappe(
            values={
                "light_primary": "#5048e5",  # pinned X POS upstream default
                "dark_primary": "#6a63e9",  # pinned X POS upstream default
                "logo_light": None,
            },
            defaults={
                "light_primary": "#5048e5",
                "dark_primary": "#6a63e9",
                "logo_light": None,
            },
        )
        load_patch(fake).apply_xpos_branding_defaults()

        self.assertEqual(fake.db.values["light_primary"], "#0F2537")
        self.assertEqual(fake.db.values["dark_primary"], "#C5A059")
        self.assertEqual(fake.db.values["logo_light"], "/assets/alnasr/images/alnasr-mark.svg")
        self.assertIn(("light_primary", "#0F2537"), fake.db.writes)
        self.assertEqual(fake.cache_instance.deleted, ["xpos_branding"])
        self.assertEqual(fake.cleared_doctypes, ["XPOS Branding Settings"])

    def test_preserves_administrator_custom_values(self):
        fake = FakeFrappe(
            values={"light_primary": "#123456", "radius": 0.9},
            defaults={"light_primary": "#5048e5", "radius": 0.625},
        )
        load_patch(fake).apply_xpos_branding_defaults()

        self.assertEqual(fake.db.values["light_primary"], "#123456")
        self.assertEqual(fake.db.values["radius"], 0.9)
        self.assertNotIn("light_primary", [name for name, _ in fake.db.writes])
        self.assertNotIn("radius", [name for name, _ in fake.db.writes])

    def test_is_idempotent_when_alnasr_values_are_already_applied(self):
        fake = FakeFrappe(
            values={"light_primary": "#0F2537"},
            defaults={"light_primary": "#5048e5"},
        )
        load_patch(fake).apply_xpos_branding_defaults()
        self.assertEqual(fake.db.values["light_primary"], "#0F2537")

    def test_skips_cleanly_when_xpos_branding_doctype_is_not_installed(self):
        fake = FakeFrappe(values={}, defaults={})
        fake.db.doctype_exists = False
        load_patch(fake).apply_xpos_branding_defaults()

        self.assertEqual(fake.db.writes, [])
        self.assertEqual(fake.cleared_doctypes, [])
        self.assertEqual(fake.cache_instance.deleted, [])


if __name__ == "__main__":
    unittest.main()
