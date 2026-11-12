from frappe import _


def get_data():
    return [
        {
            "module_name": "AL-NASR",
            "type": "module",
            "label": _("النصر | AL-NASR"),
            "color": "green",
            "icon": "octicon octicon-shop",
            "description": _(
                "نظام متكامل لإدارة السوبرماركت وتجارة التجزئة والجملة"
            ),
        }
    ]
