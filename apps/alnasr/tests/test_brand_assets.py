"""Source-level contract tests for AL-NASR-owned SVG brand assets.

These tests use only the Python standard library and run before a Frappe Bench
is available.
"""
from pathlib import Path
import re
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[3]
ASSET_DIR = ROOT / "apps" / "alnasr" / "alnasr" / "public" / "images"
EXPECTED_COLORS = {"#0F2537", "#4A0E17", "#C5A059", "#FFFFFF"}


class BrandAssetContractTests(unittest.TestCase):
    def parse_svg(self, filename: str) -> tuple[ET.Element, str]:
        path = ASSET_DIR / filename
        self.assertTrue(path.is_file(), f"Missing brand asset: {path}")
        source = path.read_text(encoding="utf-8")
        root = ET.fromstring(source)
        self.assertEqual(root.tag, "{http://www.w3.org/2000/svg}svg")
        self.assertNotIn("<script", source.lower())
        self.assertNotIn("foreignobject", source.lower())
        self.assertNotRegex(source, r'https?://')
        return root, source

    def test_primary_logo_has_approved_oversized_arabic_wordmark(self) -> None:
        _, source = self.parse_svg("alnasr-logo.svg")
        self.assertIn("النصر", source)
        self.assertIn("سوبر ماركت", source)
        self.assertIn("نصر عثمان العصيمي", source)
        self.assertIn("font-size: 165px", source)
        self.assertIn('stroke="#4A0E17" stroke-width="18"', source)
        self.assertIn('stroke="#C5A059" stroke-width="12"', source)
        self.assertIn('id="main-wordmark"', source)

    def test_all_svg_assets_use_only_approved_brand_colors(self) -> None:
        for filename in ("alnasr-logo.svg", "alnasr-mark.svg", "favicon.svg"):
            with self.subTest(filename=filename):
                _, source = self.parse_svg(filename)
                used_colors = set(re.findall(r"#[0-9A-Fa-f]{6}", source))
                self.assertTrue(used_colors, "SVG should declare explicit colors")
                self.assertLessEqual(used_colors, EXPECTED_COLORS)

    def test_each_asset_has_accessible_title(self) -> None:
        for filename in ("alnasr-logo.svg", "alnasr-mark.svg", "favicon.svg"):
            with self.subTest(filename=filename):
                root, _ = self.parse_svg(filename)
                title = root.find("{http://www.w3.org/2000/svg}title")
                self.assertIsNotNone(title)
                self.assertTrue((title.text or "").strip())


if __name__ == "__main__":
    unittest.main()
