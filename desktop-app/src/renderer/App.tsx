import { useEffect, useState, type FormEvent } from "react";

type User = { id: string; username: string; displayName: string; roles: string[]; permissions: string[] };
type LoginResult = { token: string; expiresAt: string; user: User };
type Health = { status: string; product: string; database: string; schemaVersion: number };
type Screen = "checking" | "setup" | "login" | "dashboard" | "error";
type View = "dashboard" | "products" | "customers" | "suppliers" | "inventory";
type ProductRow = {
  id: string; sku: string; name_ar: string; name_en: string | null; base_unit: string;
  sale_price_minor: number; cost_price_minor: number; is_active: number;
};
type PartnerRow = {
  id: string; code: string; name: string; phone: string | null;
  credit_limit_minor?: number; is_active: number;
};
type InventoryRow = { product_id: string; sku: string; name_ar: string; base_unit: string; quantity: number };
type Warehouse = { id: string; store_id: string; code: string; name: string };
type ApiError = { error?: string; message?: string };
type FormValues = Record<string, string>;

const navigation: { key: View; label: string; description: string }[] = [
  { key: "dashboard", label: "نظرة عامة", description: "ملخص حالة النظام" },
  { key: "products", label: "المنتجات", description: "إدارة الأصناف والأسعار" },
  { key: "customers", label: "العملاء", description: "سجل العملاء وحدود الائتمان" },
  { key: "suppliers", label: "الموردون", description: "سجل الموردين وبياناتهم" },
  { key: "inventory", label: "المخزون", description: "أرصدة الأصناف وتسويات المخزون" }
];
const futureModules = [
  ["نقطة البيع", "المبيعات والفواتير والتحصيل"],
  ["المخزون", "الأرصدة والتسويات والتحويلات"],
  ["المشتريات", "أوامر الشراء والاستلام"],
  ["المرتجعات", "مرتجعات المبيعات والمشتريات"],
  ["الصندوق والورديات", "فتح وإغلاق الورديات وحركة النقد"],
  ["المحاسبة", "دليل الحسابات والقيود والتقارير"]
] as const;

const emptyForm: FormValues = {
  sku: "", nameAr: "", nameEn: "", baseUnit: "piece", salePrice: "0", costPrice: "0", barcode: "",
  code: "", name: "", phone: "", creditLimit: "0", productId: "", quantityDelta: "1", unitCost: "0", reason: ""
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [rows, setRows] = useState<Array<ProductRow | PartnerRow>>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [notice, setNotice] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [productOptions, setProductOptions] = useState<ProductRow[]>([]);

  useEffect(() => {
    let active = true;
    void window.alnasr.request<{ setupRequired: boolean }>({ path: "/api/v1/setup/status" })
      .then((response) => {
        if (!active) return;
        if (response.status !== 200) throw new Error("تعذر فحص حالة التهيئة الأولية.");
        setScreen(response.data.setupRequired ? "setup" : "login");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "تعذر الاتصال بالخادم المحلي.");
        setScreen("error");
      });
    return () => { active = false; };
  }, []);

  async function finishLogin(result: LoginResult) {
    setToken(result.token);
    setUser(result.user);
    setPassword("");
    const response = await window.alnasr.request<Health>({ path: "/api/v1/health" });
    if (response.status === 200) setHealth(response.data);
    setActiveView("dashboard");
    setScreen("dashboard");
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await window.alnasr.request({
        path: "/api/v1/setup/owner", method: "POST", body: { username, displayName, password }
      });
      if (created.status !== 201) throw new Error("تعذر إنشاء حساب المالك. تحقق من البيانات.");
      const response = await window.alnasr.request<LoginResult>({
        path: "/api/v1/auth/login", method: "POST", body: { username, password }
      });
      if (response.status !== 200) throw new Error("تم إنشاء الحساب، لكن تعذر تسجيل الدخول.");
      await finishLogin(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء التهيئة.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await window.alnasr.request<LoginResult>({
        path: "/api/v1/auth/login", method: "POST", body: { username, password }
      });
      if (response.status !== 200) throw new Error(response.status === 401
        ? "اسم المستخدم أو كلمة المرور غير صحيحة." : "تعذر تسجيل الدخول.");
      await finishLogin(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await window.alnasr.request({ path: "/api/v1/auth/logout", method: "POST", token });
    } finally {
      setToken(""); setUser(null); setHealth(null); setPassword(""); setRows([]);
      setScreen("login");
    }
  }

  async function loadRows(view: View) {
    if (view === "dashboard") return;
    setLoadingRows(true);
    setError("");
    try {
      if (view === "inventory") {
        const locations = await window.alnasr.request<{ warehouses: Warehouse[] }>({ path: "/api/v1/locations", token });
        if (locations.status !== 200) throw new Error("تعذر تحميل المستودعات أو لا تملك صلاحية عرض المخزون.");
        const activeWarehouses = locations.data.warehouses;
        setWarehouses(activeWarehouses);
        const warehouseId = selectedWarehouseId || activeWarehouses[0]?.id || "";
        if (!warehouseId) throw new Error("لا يوجد مستودع نشط. أنشئ مستودعاً قبل تسجيل حركة مخزون.");
        setSelectedWarehouseId(warehouseId);
        const [productsResponse, balancesResponse] = await Promise.all([
          window.alnasr.request<{ items: ProductRow[] }>({ path: "/api/v1/products", token }),
          window.alnasr.request<{ items: InventoryRow[] }>({
            path: "/api/v1/inventory/balances?warehouseId=" + encodeURIComponent(warehouseId), token
          })
        ]);
        if (productsResponse.status !== 200 || balancesResponse.status !== 200) {
          throw new Error("تعذر تحميل أصناف المستودع وأرصدتها.");
        }
        setProductOptions(productsResponse.data.items);
        setRows(balancesResponse.data.items);
      } else {
        const route = view === "products" ? "/api/v1/products"
          : view === "customers" ? "/api/v1/customers" : "/api/v1/suppliers";
        const response = await window.alnasr.request<{ items: Array<ProductRow | PartnerRow> }>({ path: route, token });
        if (response.status !== 200) throw new Error("تعذر تحميل البيانات. تحقق من صلاحيات الحساب.");
        setRows(response.data.items);
      }
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "تعذر تحميل البيانات.");
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    if (screen === "dashboard" && activeView !== "dashboard" && token) void loadRows(activeView);
  }, [screen, activeView, token]);

  function openView(view: View) {
    setError("");
    setNotice("");
    setFormOpen(false);
    setRows([]);
    setActiveView(view);
  }

  function setField(key: string, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let route = "";
      let body: Record<string, unknown> = {};
      if (activeView === "products") {
        route = "/api/v1/products";
        body = {
          sku: form.sku, nameAr: form.nameAr, nameEn: form.nameEn || null,
          baseUnit: form.baseUnit, salePriceMinor: Number(form.salePrice),
          costPriceMinor: Number(form.costPrice), barcode: form.barcode || null
        };
      } else if (activeView === "customers") {
        route = "/api/v1/customers";
        body = {
          code: form.code, name: form.name, phone: form.phone || null,
          creditLimitMinor: Number(form.creditLimit)
        };
      } else {
        route = "/api/v1/suppliers";
        body = { code: form.code, name: form.name, phone: form.phone || null };
      }
      const response = await window.alnasr.request<ApiError>({ path: route, method: "POST", token, body });
      if (response.status !== 201) {
        const apiError = response.data as ApiError;
        throw new Error(apiError.message ?? (response.status === 409
          ? "يوجد سجل آخر يستخدم الرمز أو الباركود نفسه." : "رفض الخادم حفظ السجل. راجع البيانات والصلاحيات."));
      }
      setForm(emptyForm);
      setFormOpen(false);
      setNotice("تم حفظ السجل بنجاح.");
      await loadRows(activeView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ السجل.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivatePartner(row: PartnerRow) {
    const entity = activeView === "customers" ? "العميل" : "المورد";
    if (!window.confirm(`هل تريد تعطيل ${entity} «${row.name}»؟ لن يتم حذف سجلاته التاريخية.`)) return;
    setBusy(true);
    setError("");
    try {
      const route = activeView === "customers"
        ? `/api/v1/customers/${row.id}/deactivate`
        : `/api/v1/suppliers/${row.id}/deactivate`;
      const response = await window.alnasr.request({ path: route, method: "POST", token });
      if (response.status !== 204) throw new Error("تعذر تعطيل السجل.");
      setNotice("تم تعطيل السجل مع الاحتفاظ بتاريخه.");
      await loadRows(activeView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تعطيل السجل.");
    } finally {
      setBusy(false);
    }
  }

  if (screen === "checking") return <main className="center"><div className="spinner" /><p>جارٍ تشغيل النظام المحلي...</p></main>;
  if (screen === "error") return (
    <main className="center"><section className="auth-card"><Brand /><div className="error">{error}</div>
      <button className="primary" onClick={() => window.location.reload()}>إعادة المحاولة</button></section></main>
  );

  if (screen === "setup" || screen === "login") {
    const setup = screen === "setup";
    return (
      <main className="auth-layout">
        <section className="auth-aside"><Brand /><div className="aside-copy">
          <span className="eyebrow">LOCAL-FIRST BUSINESS PLATFORM</span>
          <h1>إدارة أعمالك،<br />من مكان واحد.</h1>
          <p>نظام النصر لإدارة المبيعات والمخزون والمشتريات والحسابات، بقاعدة بيانات محلية تعمل دون اتصال بالإنترنت.</p>
          <div className="online"><i /> قاعدة البيانات المحلية — SQLite</div>
        </div><span className="aside-footer">AL-NASR ERP · WINDOWS EDITION</span></section>
        <section className="auth-main"><form className="auth-card" onSubmit={setup ? handleSetup : handleLogin}>
          <span className="eyebrow">{setup ? "INITIAL CONFIGURATION" : "SECURE SIGN IN"}</span>
          <h2>{setup ? "تهيئة النظام لأول مرة" : "مرحباً بعودتك"}</h2>
          <p className="muted">{setup ? "أنشئ حساب المالك الرئيسي لإدارة النظام والصلاحيات." : "سجّل الدخول للمتابعة إلى مساحة العمل."}</p>
          {setup && <label>الاسم الظاهر<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={100} required autoComplete="name" /></label>}
          <label>اسم المستخدم<input value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={40} required autoComplete="username" /></label>
          <label>كلمة المرور<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={setup ? 12 : 1} maxLength={256} required autoComplete={setup ? "new-password" : "current-password"} />{setup && <small>يجب ألا تقل كلمة المرور عن 12 حرفاً.</small>}</label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>{busy ? "يرجى الانتظار..." : setup ? "إنشاء حساب المالك" : "تسجيل الدخول"}</button>
          <div className="security-note">جلسة محلية محمية وصلاحيات على مستوى الخادم</div>
        </form></section>
      </main>
    );
  }

  const title = navigation.find(item => item.key === activeView)?.label ?? "نظرة عامة";
  const canWrite = activeView === "products"
    ? user?.permissions.includes("products:write")
    : activeView === "customers" ? user?.permissions.includes("customers:write")
    : user?.permissions.includes("suppliers:write");

  return (
    <main className="workspace" dir="rtl">
      <aside className="sidebar">
        <Brand compact />
        <div className="nav-caption">مساحة العمل</div>
        {navigation.map(item => <button key={item.key} className={`nav-button ${activeView === item.key ? "active" : ""}`}
          onClick={() => openView(item.key)}>{item.label}</button>)}
        <div className="nav-caption future-caption">وحدات قيد التطوير</div>
        {futureModules.map(([label]) => <div className="nav disabled" key={label}>{label}</div>)}
        <div className="sidebar-bottom">
          <div className="user"><span className="avatar">{user?.displayName.slice(0, 1) ?? "م"}</span>
            <div><b>{user?.displayName}</b><small>{user?.roles.join("، ")}</small></div></div>
          <button className="logout" onClick={logout}>تسجيل الخروج</button>
        </div>
      </aside>
      <section className="workspace-main">
        <header className="topbar"><div><span className="eyebrow">AL-NASR ERP / WORKSPACE</span><h1>{title}</h1></div>
          <div className="online status"><i /> يعمل محلياً دون إنترنت</div></header>

        {activeView === "dashboard" ? <>
          <section className="welcome"><div><span className="eyebrow">WINDOWS EDITION</span>
            <h2>أهلاً بك، {user?.displayName}</h2><p>تم تسجيل الدخول بنجاح إلى قاعدة بيانات النظام المحلية.</p></div>
            <div className="welcome-mark">N</div></section>
          <div className="section-heading"><h2>الوحدات المتاحة حالياً</h2><p>يمكنك إدارة البيانات الأساسية الآن؛ بقية الوحدات ستظهر بعد اكتمال تنفيذها.</p></div>
          <div className="module-grid">
            {navigation.filter(item => item.key !== "dashboard").map((item, index) => <button className="module-card module-action" key={item.key} onClick={() => openView(item.key)}>
              <span className="module-number">{String(index + 1).padStart(2, "0")}</span><h3>{item.label}</h3><p>{item.description}</p><span className="module-state available-state">متاح</span>
            </button>)}
            {futureModules.map(([label, description], index) => <article className="module-card" key={label}>
              <span className="module-number">{String(index + 4).padStart(2, "0")}</span><h3>{label}</h3><p>{description}</p><span className="module-state">قيد التنفيذ</span>
            </article>)}
          </div>
          <section className="system-panel"><div><h3>حالة النظام المحلي</h3><p>الخادم وقاعدة البيانات يعملان على هذا الجهاز.</p></div>
            <div className="facts"><div><small>الخادم</small><b>Fastify · 127.0.0.1</b></div>
              <div><small>قاعدة البيانات</small><b>{health?.database?.toUpperCase() ?? "SQLITE"}</b></div>
              <div><small>إصدار المخطط</small><b>{health?.schemaVersion ?? 4}</b></div></div>
          </section>
        </> : <>
          <div className="list-toolbar"><div><h2>{title}</h2><p>بيانات محفوظة في قاعدة SQLite المحلية.</p></div>
            {canWrite && <button className="primary action-button" onClick={() => { setFormOpen(value => !value); setForm(emptyForm); setError(""); }}>
              {formOpen ? "إغلاق النموذج" : "إضافة سجل جديد"}
            </button>}
          </div>
          {notice && <div className="success-note" role="status">{notice}</div>}
          {error && <div className="error page-error" role="alert">{error}</div>}
          {formOpen && <form className="record-form" onSubmit={submitRecord}>
            {activeView === "products" ? <>
              <label>رمز الصنف (SKU)<input value={form.sku} onChange={e => setField("sku", e.target.value)} required maxLength={64} /></label>
              <label>اسم الصنف بالعربية<input value={form.nameAr} onChange={e => setField("nameAr", e.target.value)} required maxLength={160} /></label>
              <label>الاسم بالإنجليزية<input value={form.nameEn} onChange={e => setField("nameEn", e.target.value)} maxLength={160} /></label>
              <label>وحدة القياس<input value={form.baseUnit} onChange={e => setField("baseUnit", e.target.value)} required maxLength={24} /></label>
              <label>سعر البيع (بالوحدة الصغرى)<input type="number" min="0" step="1" value={form.salePrice} onChange={e => setField("salePrice", e.target.value)} required /></label>
              <label>سعر التكلفة (بالوحدة الصغرى)<input type="number" min="0" step="1" value={form.costPrice} onChange={e => setField("costPrice", e.target.value)} required /></label>
              <label>الباركود<input value={form.barcode} onChange={e => setField("barcode", e.target.value)} maxLength={64} /></label>
            </> : <>
              <label>الرمز<input value={form.code} onChange={e => setField("code", e.target.value)} required maxLength={64} /></label>
              <label>الاسم<input value={form.name} onChange={e => setField("name", e.target.value)} required minLength={2} maxLength={160} /></label>
              <label>رقم الهاتف<input value={form.phone} onChange={e => setField("phone", e.target.value)} maxLength={40} /></label>
              {activeView === "customers" && <label>حد الائتمان (بالوحدة الصغرى)<input type="number" min="0" step="1" value={form.creditLimit} onChange={e => setField("creditLimit", e.target.value)} /></label>}
            </>}
            <div className="form-actions"><button className="primary action-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ السجل"}</button>
              <button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>إلغاء</button></div>
          </form>}
          <section className="data-panel">
            {loadingRows ? <div className="empty-state"><div className="spinner" /><p>جارٍ تحميل البيانات...</p></div>
              : rows.length === 0 ? <div className="empty-state"><h3>لا توجد سجلات بعد</h3><p>أضف أول سجل ليظهر هنا.</p></div>
              : <div className="table-scroll"><table className="data-table"><thead><tr>
                {activeView === "products" ? <><th>رمز الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>سعر البيع</th><th>التكلفة</th></>
                  : <><th>الرمز</th><th>الاسم</th><th>الهاتف</th>{activeView === "customers" && <th>حد الائتمان</th>}<th>الحالة</th><th>إجراء</th></>}
              </tr></thead><tbody>
                {activeView === "products" ? (rows as ProductRow[]).map(row => <tr key={row.id}>
                  <td dir="ltr">{row.sku}</td><td>{row.name_ar}{row.name_en && <small className="secondary-name">{row.name_en}</small>}</td>
                  <td dir="ltr">{row.base_unit}</td><td>{formatMinor(row.sale_price_minor)}</td><td>{formatMinor(row.cost_price_minor)}</td>
                </tr>) : (rows as PartnerRow[]).map(row => <tr key={row.id}>
                  <td dir="ltr">{row.code}</td><td>{row.name}</td><td dir="ltr">{row.phone ?? "—"}</td>
                  {activeView === "customers" && <td>{formatMinor(row.credit_limit_minor ?? 0)}</td>}
                  <td><span className="active-pill">نشط</span></td>
                  <td>{canWrite && <button className="table-action" disabled={busy} onClick={() => void deactivatePartner(row)}>تعطيل</button>}</td>
                </tr>)}
              </tbody></table></div>}
          </section>
        </>}
        <footer>AL-NASR ERP · جميع البيانات محفوظة محلياً على جهازك</footer>
      </section>
    </main>
  );
}

function formatMinor(value: number): string {
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(value);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "brand compact" : "brand"}>
    <span className="brand-mark">N</span><span><strong>النصر</strong><small>AL-NASR ERP</small></span>
  </div>;
}
