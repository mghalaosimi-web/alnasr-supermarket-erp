"""Source contracts for the AL-NASR unified Desk landing page."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / "apps" / "alnasr" / "alnasr"


class DashboardShellTests(unittest.TestCase):
    def test_dashboard_page_controller_and_script_exist(self):
        self.assertTrue((APP / "page" / "alnasr" / "alnasr.py").is_file())
        self.assertTrue((APP / "public" / "js" / "alnasr-page.js").is_file())

    def test_dashboard_uses_existing_erpnext_and_xpos_routes(self):
        source = (APP / "public" / "js" / "alnasr-page.js").read_text(encoding="utf-8")
        for route in ("/xpos/pos", '"Sales Invoice"', '"Item"', '"Purchase Invoice"', '"Stock Entry"', '"Customer"', '"Supplier"', '"Payment Entry"'):
            with self.subTest(route=route):
                self.assertIn(route, source)

    def test_dashboard_has_responsive_brand_styles(self):
        css = (APP / "public" / "css" / "alnasr.css").read_text(encoding="utf-8")
        for token in ("#0F2537", "#4A0E17", "#C5A059", "@media (max-width: 640px)"):
            with self.subTest(token=token):
                self.assertIn(token, css)


if __name__ == "__main__":
    unittest.main()
