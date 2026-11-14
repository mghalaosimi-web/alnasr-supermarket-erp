"""Runtime contract tests for the pinned ERPNext + X POS stack.

These tests run inside a disposable Frappe site after all three apps migrate.
They deliberately validate integration contracts, not pretend to test a full
cashier transaction or offline recovery.
"""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestALNasrRuntimeContracts(FrappeTestCase):
    def test_expected_apps_are_installed(self):
        installed = set(frappe.get_installed_apps())
        self.assertTrue({"erpnext", "xpos", "alnasr"}.issubset(installed))

    def test_standard_erpnext_business_doctypes_are_available(self):
        required = (
            "Company",
            "Item",
            "Item Group",
            "UOM",
            "Warehouse",
            "Stock Ledger Entry",
            "Customer",
            "Supplier",
            "Sales Invoice",
            "Purchase Invoice",
            "Purchase Receipt",
            "Payment Entry",
            "GL Entry",
        )
        missing = [name for name in required if not frappe.db.exists("DocType", name)]
        self.assertEqual(missing, [], f"Missing standard ERPNext DocTypes: {missing}")

    def test_xpos_operational_doctypes_are_available(self):
        required = (
            "POS Profile",
            "POS Opening Shift",
            "POS Closing Shift",
            "POS Permission",
            "POS Role",
            "POS Cash Movement",
        )
        missing = [name for name in required if not frappe.db.exists("DocType", name)]
        self.assertEqual(missing, [], f"Missing X POS DocTypes: {missing}")

    def test_xpos_invoice_and_shift_api_contracts_are_importable(self):
        from xpos.api.invoices import create_invoice
        from xpos.api.shifts import check_open_shift, close_shift, open_shift

        for endpoint in (create_invoice, check_open_shift, close_shift, open_shift):
            self.assertTrue(callable(endpoint))


    def test_erpnext_return_credit_note_default_is_preserved(self):
        # X POS 2.13.4 ships a Property Setter forcing this field to 0,
        # overriding ERPNext v16's default of 1 and breaking return GL links
        # plus the credit note's own outstanding balance.
        setter_name = "Sales Invoice-update_outstanding_for_self-default"
        self.assertFalse(
            frappe.db.exists("Property Setter", setter_name),
            "X POS must not override ERPNext's return-credit-note default",
        )
        field = frappe.get_meta("Sales Invoice").get_field("update_outstanding_for_self")
        self.assertIsNotNone(field)
        self.assertEqual(str(field.default), "1")

    def test_alnasr_desk_page_is_registered(self):
        page = frappe.get_doc("Page", "alnasr")
        self.assertEqual(page.module, "AL-NASR")
        self.assertEqual(page.title, "النصر | AL-NASR")
        self.assertEqual(page.standard, "Yes")

    def test_alnasr_workspace_fixture_is_installed(self):
        self.assertTrue(
            frappe.db.exists("Workspace", "AL-NASR"),
            "The AL-NASR unified workspace fixture must be installed",
        )
        workspace = frappe.get_doc("Workspace", "AL-NASR")
        self.assertEqual(workspace.module, "AL-NASR")
        self.assertEqual(workspace.label, "النصر")
        shortcut_urls = {shortcut.url for shortcut in workspace.shortcuts}
        self.assertIn("/app/alnasr", shortcut_urls)
        self.assertIn("/xpos/pos", shortcut_urls)

    def test_alnasr_brand_metadata_is_registered(self):
        from alnasr import hooks

        self.assertEqual(hooks.app_title, "النصر | AL-NASR")
        self.assertEqual(hooks.app_color, "#0F2537")
        self.assertEqual(
            hooks.app_logo_url,
            "/assets/alnasr/images/alnasr-logo.svg",
        )
