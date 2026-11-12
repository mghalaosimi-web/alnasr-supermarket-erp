app_name = "alnasr"
app_title = "النصر | AL-NASR"
app_publisher = "AL-NASR"
app_description = "نظام النصر لإدارة السوبرماركت وتجارة التجزئة والجملة | AL-NASR Supermarket, Retail and Wholesale Management System"
app_email = ""
app_license = "MIT"

# AL-NASR product identity assets.
app_logo_url = "/assets/alnasr/images/alnasr-logo.svg"
app_icon = "octicon octicon-shop"
app_color = "#0F2537"  # Royal Navy; approved AL-NASR primary brand token.

# Keep ERPNext core untouched. AL-NASR behavior belongs in this custom app.
# Do not use a global brand_html override: it would replace ERPNext's shared
# navbar branding rather than safely branding only AL-NASR-owned surfaces.
# Add DocType overrides, fixtures, scheduler events, and hooks only with tests.
