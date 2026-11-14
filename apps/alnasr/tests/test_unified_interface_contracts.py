"""Cross-surface contracts for the single AL-NASR product identity."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / "apps" / "alnasr" / "alnasr"
ANDROID = ROOT / "android" / "app" / "src" / "main"


class UnifiedInterfaceContracts(unittest.TestCase):
    def test_main_desk_is_arabic_rtl_and_links_all_three_product_surfaces(self):
        js = (APP / "al_nasr" / "page" / "alnasr" / "alnasr.js").read_text(encoding="utf-8")
        workspace = (APP / "al_nasr" / "workspace" / "al_nasr" / "al_nasr.json").read_text(encoding="utf-8")
        self.assertIn('dir="rtl"', js)
        self.assertIn('"/xpos/pos"', js)
        self.assertIn('"/app/alnasr"', workspace)
        for doctype in ("Sales Invoice", "Item", "Purchase Invoice", "Stock Entry", "Customer", "Supplier", "Payment Entry"):
            with self.subTest(doctype=doctype):
                self.assertIn(doctype, js)

    def test_shared_brand_tokens_and_responsive_layout_are_registered(self):
        hooks = (APP / "hooks.py").read_text(encoding="utf-8")
        css = (APP / "public" / "css" / "alnasr.css").read_text(encoding="utf-8")
        for token in ("#0F2537", "#4A0E17", "#C5A059"):
            with self.subTest(token=token):
                self.assertIn(token, css)
        self.assertIn("app_include_css", hooks)
        self.assertIn("@media (max-width: 640px)", css)

    def test_android_client_uses_the_same_brand_and_rejects_non_https_hosts(self):
        activity = (ANDROID / "java" / "com" / "alnasr" / "mobile" / "MainActivity.kt").read_text(encoding="utf-8")
        manifest = (ANDROID / "AndroidManifest.xml").read_text(encoding="utf-8")
        self.assertIn("Color.rgb(15, 37, 55)", activity)
        self.assertIn('uri.scheme != "https"', activity)
        self.assertIn('uri.host != "alnasr.local"', activity)
        self.assertIn('android:usesCleartextTraffic="false"', manifest)
        self.assertIn("handler?.cancel()", activity)


if __name__ == "__main__":
    unittest.main()
