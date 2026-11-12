"""Validate that every declared Frappe module has an importable package."""
from pathlib import Path
import re
import unittest


APP_ROOT = Path(__file__).resolve().parents[1] / "alnasr"


class FrappeModulePackageTests(unittest.TestCase):
    def test_declared_modules_have_python_packages(self) -> None:
        modules_file = APP_ROOT / "modules.txt"
        self.assertTrue(modules_file.is_file())
        modules = [line.strip() for line in modules_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        self.assertTrue(modules, "At least one Frappe module must be declared")

        for label in modules:
            with self.subTest(module=label):
                slug = re.sub(r"[^a-zA-Z0-9_]", "_", label.strip()).lower()
                package = APP_ROOT / slug / "__init__.py"
                self.assertTrue(
                    package.is_file(),
                    f"Frappe module '{label}' resolves to '{slug}' but {package} is missing",
                )


if __name__ == "__main__":
    unittest.main()
