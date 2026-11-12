"""Disposable-site integration coverage for X POS sale submission and retry safety.

Uses ERPNext's own test fixtures and document controllers; no live store data is
created and all writes are rolled back by the test runner.
"""

import frappe
from erpnext.accounts.doctype.pos_closing_entry.test_pos_closing_entry import init_user_and_profile
from erpnext.stock.doctype.stock_entry.stock_entry_utils import make_stock_entry
from erpnext.tests.utils import ERPNextTestSuite

from xpos.api.invoices import create_invoice
from xpos.api.shifts import open_shift


class TestALNasrPosSaleIntegration(ERPNextTestSuite):
    def setUp(self):
        super().setUp()
        self.load_test_records("Stock Entry")
        self.load_test_records("Item")
        self.load_test_records("Customer")

        frappe.set_user("Administrator")
        frappe.db.set_single_value("Selling Settings", "validate_selling_price", 0)
        frappe.db.set_single_value("POS Settings", "invoice_type", "Sales Invoice")

        self.cashier, self.profile = init_user_and_profile()
        self.profile.update_stock = 1
        self.profile.save(ignore_permissions=True)

        make_stock_entry(
            item_code="_Test Item",
            qty=20,
            to_warehouse=self.profile.warehouse,
            company=self.profile.company,
            rate=100,
        )

        self.customer = "_Test Customer"
        if not frappe.db.exists("Customer", self.customer):
            frappe.throw("ERPNext test fixture _Test Customer is missing.")

        self.price = frappe.db.get_value(
            "Item Price",
            {
                "item_code": "_Test Item",
                "price_list": self.profile.selling_price_list,
                "selling": 1,
            },
            "price_list_rate",
        )
        if not self.price:
            frappe.throw("ERPNext test fixture price for _Test Item is missing.")

        self.uom = frappe.db.get_value("Item", "_Test Item", "stock_uom")
        self.opening_shift = open_shift(
            pos_profile=self.profile.name,
            company=self.profile.company,
            balance_details=[{"mode_of_payment": "Cash", "opening_amount": 0}],
        )["pos_opening_shift"]["name"]

    def tearDown(self):
        frappe.set_user("Administrator")
        super().tearDown()

    def test_sale_retry_returns_original_invoice_without_second_stock_issue(self):
        local_id = "alnasr-ci-" + frappe.generate_hash(length=16)
        quantity = 1
        warehouse = self.profile.warehouse
        before_qty = frappe.db.get_value(
            "Bin", {"item_code": "_Test Item", "warehouse": warehouse}, "actual_qty"
        )

        payload = {
            "pos_profile": self.profile.name,
            "pos_opening_shift": self.opening_shift,
            "customer": self.customer,
            "warehouse": warehouse,
            "currency": self.profile.currency,
            "selling_price_list": self.profile.selling_price_list,
            "items": [
                {
                    "item_code": "_Test Item",
                    "qty": quantity,
                    "rate": self.price,
                    "uom": self.uom,
                    "warehouse": warehouse,
                }
            ],
            "payments": [{"mode_of_payment": "Cash", "amount": self.price * quantity}],
        }

        first = create_invoice(payload, local_id=local_id)
        self.assertTrue(first.get("name"), first)
        self.assertNotEqual(first.get("status"), "reprice_required", first)

        invoice = frappe.get_doc("Sales Invoice", first["name"])
        self.assertEqual(invoice.docstatus, 1)
        self.assertEqual(invoice.xpos_local_id, local_id)
        self.assertEqual(invoice.update_stock, 1)

        after_first_qty = frappe.db.get_value(
            "Bin", {"item_code": "_Test Item", "warehouse": warehouse}, "actual_qty"
        )
        self.assertAlmostEqual(after_first_qty, before_qty - quantity)

        retry = create_invoice(payload, local_id=local_id)
        self.assertEqual(retry.get("name"), first["name"])
        self.assertTrue(retry.get("duplicate"), retry)

        after_retry_qty = frappe.db.get_value(
            "Bin", {"item_code": "_Test Item", "warehouse": warehouse}, "actual_qty"
        )
        self.assertAlmostEqual(after_retry_qty, after_first_qty)
        self.assertEqual(
            frappe.db.count("Sales Invoice", {"xpos_local_id": local_id, "docstatus": 1}),
            1,
        )
