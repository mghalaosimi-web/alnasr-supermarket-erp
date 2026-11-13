"""Compatibility reconciliation for the pinned ERPNext v16 + X POS v16 stack."""

import frappe


def remove_xpos_return_self_outstanding_override():
    """Preserve ERPNext's native credit-note outstanding behavior.

    X POS 2.13.4 syncs a Property Setter that forces
    Sales Invoice.update_outstanding_for_self to 0. ERPNext v16 defines the
    field default as 1. That override changes return GL against_voucher links
    and suppresses the credit note's own outstanding amount. Remove only this
    conflicting setter; do not modify ERPNext or X POS source files.
    """
    setter_name = "Sales Invoice-update_outstanding_for_self-default"
    if frappe.db.exists("Property Setter", setter_name):
        frappe.delete_doc("Property Setter", setter_name, force=True)

    frappe.clear_cache(doctype="Sales Invoice")
    field = frappe.get_meta("Sales Invoice").get_field("update_outstanding_for_self")
    if not field or str(field.default) != "1":
        raise RuntimeError(
            "AL-NASR compatibility check failed: ERPNext Sales Invoice "
            "update_outstanding_for_self must retain its upstream default of 1."
        )
