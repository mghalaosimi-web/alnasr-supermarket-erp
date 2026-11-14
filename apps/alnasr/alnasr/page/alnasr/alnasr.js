frappe.pages["alnasr"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "النصر | AL-NASR",
    single_column: true,
  });

  page.set_title("النصر | AL-NASR");
  page.main.addClass("alnasr-home");

  const sections = [
    {
      title: "نقطة البيع",
      description: "ابدأ عملية البيع وإدارة وردية الصندوق",
      items: [
        { label: "فتح نقطة البيع", detail: "شاشة الكاشير", icon: "shopping-cart", route: "/xpos/pos", external: true, primary: true },
        { label: "فواتير المبيعات", detail: "عرض ومتابعة الفواتير", icon: "file-text", route: ["List", "Sales Invoice"] },
        { label: "ورديات نقاط البيع", detail: "الفتح والإغلاق والمراجعة", icon: "clock", route: ["List", "POS Opening Shift"] },
      ],
    },
    {
      title: "إدارة المتجر",
      description: "المنتجات والمخزون والمشتريات والعملاء",
      items: [
        { label: "المنتجات", detail: "الأصناف والباركود والأسعار", icon: "package", route: ["List", "Item"] },
        { label: "المخزون", detail: "الأرصدة وحركات المخزون", icon: "warehouse", route: ["List", "Stock Entry"] },
        { label: "المشتريات", detail: "طلبات وفواتير الشراء", icon: "shopping-bag", route: ["List", "Purchase Invoice"] },
        { label: "العملاء", detail: "ملفات العملاء وأرصدتهم", icon: "users", route: ["List", "Customer"] },
        { label: "الموردون", detail: "ملفات الموردين", icon: "truck", route: ["List", "Supplier"] },
      ],
    },
    {
      title: "المالية والتقارير",
      description: "الحسابات والمدفوعات ومراجعة الأداء",
      items: [
        { label: "المدفوعات", detail: "سندات القبض والصرف", icon: "wallet", route: ["List", "Payment Entry"] },
        { label: "القيود المحاسبية", detail: "دفتر الأستاذ والقيود", icon: "calculator", route: ["List", "Journal Entry"] },
        { label: "التقارير", detail: "تقارير المبيعات والمخزون", icon: "chart-line", route: ["query-report", "Sales Analytics"] },
      ],
    },
    {
      title: "إعدادات النظام",
      description: "تهيئة المتجر وإدارة الوصول",
      items: [
        { label: "ملف نقطة البيع", detail: "إعدادات البيع وطرق الدفع", icon: "settings", route: ["List", "POS Profile"] },
        { label: "المستخدمون", detail: "الحسابات والأدوار والصلاحيات", icon: "user-cog", route: ["List", "User"] },
      ],
    },
  ];

  const icon = (name) => frappe.utils.icon(name, "lg");
  const escape = (value) => frappe.utils.escape_html(value);

  const $root = $(
    '<div class="alnasr-dashboard" dir="rtl">' +
      '<section class="alnasr-welcome">' +
        '<div class="alnasr-welcome-copy">' +
          '<span class="alnasr-eyebrow">نظام إدارة المتجر</span>' +
          '<h2>مرحباً بك في النصر</h2>' +
          '<p>كل أعمال متجرك في مكان واحد، من نقطة البيع إلى المخزون والحسابات.</p>' +
        '</div>' +
        '<img class="alnasr-welcome-mark" src="/assets/alnasr/images/alnasr-mark.svg" alt="شعار النصر">' +
      '</section>' +
      '<section class="alnasr-quick" aria-label="اختصارات سريعة">' +
        '<button type="button" class="alnasr-quick-action" data-action="pos"><span class="alnasr-quick-icon">' + icon("shopping-cart") + '</span><span><strong>بدء البيع</strong><small>فتح شاشة نقطة البيع</small></span></button>' +
        '<button type="button" class="alnasr-quick-action" data-action="item"><span class="alnasr-quick-icon">' + icon("package") + '</span><span><strong>إضافة منتج</strong><small>تسجيل صنف جديد</small></span></button>' +
        '<button type="button" class="alnasr-quick-action" data-action="purchase"><span class="alnasr-quick-icon">' + icon("shopping-bag") + '</span><span><strong>فاتورة شراء</strong><small>تسجيل مشتريات المتجر</small></span></button>' +
      '</section>' +
      '<div class="alnasr-section-grid"></div>' +
      '<footer class="alnasr-footer">النصر | AL-NASR <span>نظام واحد لإدارة أعمال متجرك</span></footer>' +
    '</div>'
  );

  const $grid = $root.find(".alnasr-section-grid");
  sections.forEach((section) => {
    const $section = $('<section class="alnasr-section"></section>');
    $section.append($('<div class="alnasr-section-heading"></div>').append(
      $("<h3></h3>").text(section.title),
      $("<p></p>").text(section.description)
    ));
    const $items = $('<div class="alnasr-link-grid"></div>');
    section.items.forEach((item) => {
      const $button = $('<button type="button" class="alnasr-link-card"></button>');
      $button.append(
        $('<span class="alnasr-link-icon"></span>').html(icon(item.icon)),
        $('<span class="alnasr-link-copy"></span>').append(
          $("<strong></strong>").text(item.label),
          $("<small></small>").text(item.detail)
        ),
        $('<span class="alnasr-link-arrow"></span>').html(frappe.utils.icon("arrow-up-left", "sm"))
      );
      $button.on("click", () => {
        if (item.external) {
          window.location.assign(item.route);
        } else {
          frappe.set_route(...item.route);
        }
      });
      $items.append($button);
    });
    $section.append($items);
    $grid.append($section);
  });

  $root.find('[data-action="pos"]').on("click", () => window.location.assign("/xpos/pos"));
  $root.find('[data-action="item"]').on("click", () => frappe.new_doc("Item"));
  $root.find('[data-action="purchase"]').on("click", () => frappe.new_doc("Purchase Invoice"));

  page.main.empty().append($root);
};
