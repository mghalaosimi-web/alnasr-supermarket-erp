import { useEffect, useState, type FormEvent } from "react";
import PurchasesView from "./PurchasesView";
import SalesReturnsView from "./SalesReturnsView";
import SupplierStatementView from "./SupplierStatementView";
import CustomerStatementView from "./CustomerStatementView";
import CashRegisterView from "./CashRegisterView";
import AccountingView from "./AccountingView";

type User = { id: string; username: string; displayName: string; roles: string[]; permissions: string[] };
type LoginResult = { token: string; expiresAt: string; user: User };
type Health = { status: string; product: string; database: string; schemaVersion: number };
type Screen = "checking" | "setup" | "login" | "dashboard" | "error";
type View = "dashboard" | "pos" | "products" | "customers" | "suppliers" | "inventory" | "purchases" | "returns" | "cash" | "accounting";
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
  { key: "pos", label: "نقطة البيع", description: "إنشاء فاتورة وخصم المخزون" },
  { key: "cash", label: "الصندوق والورديات", description: "إدارة العهدة والحركات والإقفال" },
  { key: "accounting", label: "المحاسبة", description: "دليل الحسابات والقيود وميزان المراجعة" },
  { key: "products", label: "المنتجات", description: "إدارة الأصناف والأسعار" },
  { key: "customers", label: "العملاء", description: "سجل العملاء وحدود الائتمان" },
  { key: "suppliers", label: "الموردون", description: "سجل الموردين وبياناتهم" },
  { key: "inventory", label: "المخزون", description: "أرصدة الأصناف وتسويات المخزون" },
  { key: "purchases", label: "المشتريات", description: "فواتير الشراء واستلام الأصناف" },
  { key: "returns", label: "المرتجعات", description: "مرتجعات المبيعات وإعادة المخزون" }
];
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
  const [rows, setRows] = useState<Array<ProductRow | PartnerRow | InventoryRow>>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [notice, setNotice] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [productOptions, setProductOptions] = useState<ProductRow[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [posProducts, setPosProducts] = useState<ProductRow[]>([]);
  const [posCustomers, setPosCustomers] = useState<PartnerRow[]>([]);
  const [posCustomerId, setPosCustomerId] = useState("");
  const [posCart, setPosCart] = useState<Record<string, number>>({});
  const [posStoreId, setPosStoreId] = useState("");
  const [posWarehouseId, setPosWarehouseId] = useState("");
  const [posCashSessionOpen, setPosCashSessionOpen] = useState(false);
  const [posBusy, setPosBusy] = useState(false);
  const [posMessage, setPosMessage] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<PartnerRow | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<PartnerRow | null>(null);

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

  async function createBackup() {
    setBackupBusy(true);
    setBackupMessage("");
    setError("");
    try {
      const response = await window.alnasr.request<{ backup: { path: string; integrity: string; schemaVersion: number } }>({
        path: "/api/v1/backups", method: "POST", token
      });
      if (response.status !== 201 || response.data.backup.integrity !== "ok") {
        throw new Error("تعذر إنشاء نسخة احتياطية سليمة.");
      }
      setBackupMessage("تم إنشاء نسخة احتياطية والتحقق منها. المسار: " + response.data.backup.path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل إنشاء النسخة الاحتياطية.");
    } finally {
      setBackupBusy(false);
    }
  }

  function changeCart(productId: string, delta: number) {
    setPosCart(current => {
      const next = { ...current };
      const quantity = (next[productId] ?? 0) + delta;
      if (quantity <= 0) delete next[productId]; else next[productId] = quantity;
      return next;
    });
  }

  async function completePosSale() {
    const lines = Object.entries(posCart).map(([productId, quantity]) => {
      const product = posProducts.find(item => item.id === productId);
      return product ? { productId, quantity, unitPriceMinor: product.sale_price_minor } : null;
    }).filter((line): line is { productId: string; quantity: number; unitPriceMinor: number } => line !== null);
    if (!posCashSessionOpen) { setError("يجب فتح وردية نقدية قبل إتمام البيع. افتح وحدة الصندوق أولاً."); return; }
    if (!lines.length || !posStoreId || !posWarehouseId) { setError("أضف صنفاً واحداً على الأقل إلى الفاتورة."); return; }
    setPosBusy(true); setError(""); setPosMessage("");
    try {
      const created = await window.alnasr.request<{ saleId: string; totalMinor: number }>({
        path: "/api/v1/sales", method: "POST", token,
        body: { documentNo: `POS-${Date.now()}`, storeId: posStoreId, warehouseId: posWarehouseId,
          customerId: posCustomerId || null, lines, idempotencyKey: crypto.randomUUID() }
      });
      if (created.status !== 201) throw new Error("تعذر إنشاء فاتورة البيع.");
      const posted = await window.alnasr.request({ path: `/api/v1/sales/${created.data.saleId}/post`, method: "POST", token });
      if (posted.status !== 200) throw new Error("تم إنشاء الفاتورة كمسودة، لكن تعذر ترحيلها وخصم المخزون.");
      const paid = await window.alnasr.request({ path: `/api/v1/sales/${created.data.saleId}/payments`, method: "POST", token,
        body: { method: "cash", amountMinor: created.data.totalMinor, idempotencyKey: crypto.randomUUID() } });
      if (paid.status !== 201 && paid.status !== 200) {
        setPosCart({}); setPosCustomerId(""); setPosMessage(`تم ترحيل الفاتورة ${created.data.saleId} وخصم المخزون، لكن تعذر تسجيل التحصيل النقدي. راجع المدفوعات.`);
      } else {
        setPosCart({}); setPosCustomerId(""); setPosMessage(`اكتملت الفاتورة ${created.data.saleId} وتم تسجيل التحصيل النقدي.`);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إكمال عملية البيع."); }
    finally { setPosBusy(false); }
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
    if (view === "dashboard" || view === "purchases" || view === "returns" || view === "cash" || view === "accounting") return;
    setLoadingRows(true);
    setError("");
    try {
      if (view === "pos") {
        const [locations, products, customers] = await Promise.all([
          window.alnasr.request<{ stores: Array<{ id: string; name: string }>; warehouses: Warehouse[] }>({ path: "/api/v1/locations", token }),
          window.alnasr.request<{ items: ProductRow[] }>({ path: "/api/v1/products", token }),
          user?.permissions.includes("customers:read")
            ? window.alnasr.request<{ items: PartnerRow[] }>({ path: "/api/v1/customers", token })
            : Promise.resolve({ status: 200, data: { items: [] as PartnerRow[] } })
        ]);
        if (locations.status !== 200 || products.status !== 200 || customers.status !== 200) throw new Error("تعذر تحميل بيانات نقطة البيع.");
        const store = locations.data.stores[0];
        const warehouse = locations.data.warehouses.find(item => item.store_id === store?.id);
        if (!store || !warehouse) throw new Error("يجب إعداد متجر ومستودع نشط قبل البيع.");
        const cashStatus = await window.alnasr.request<{ session: { id: string } | null }>({
          path: `/api/v1/cash/register?storeId=${encodeURIComponent(store.id)}`, token
        });
        if (cashStatus.status !== 200) throw new Error("تعذر التحقق من الوردية النقدية. تحقق من صلاحية الصندوق.");
        const hasOpenSession = Boolean(cashStatus.data.session);
        setPosCashSessionOpen(hasOpenSession);
        setPosStoreId(store.id); setPosWarehouseId(warehouse.id); setWarehouses(locations.data.warehouses);
        setPosProducts(products.data.items); setPosCustomers(customers.data.items); setPosCustomerId(""); setPosCart({});
        setPosMessage(hasOpenSession ? "" : "افتح وردية نقدية من وحدة الصندوق قبل إتمام البيع.");
      } else if (view === "inventory") {
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
    if (screen === "dashboard" && activeView !== "dashboard" && activeView !== "purchases" && token) void loadRows(activeView);
  }, [screen, activeView, token]);

  function openView(view: View) {
    setSelectedSupplier(null);
    setSelectedCustomer(null);
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
      } else if (activeView === "suppliers") {
        route = "/api/v1/suppliers";
        body = { code: form.code, name: form.name, phone: form.phone || null };
      } else {
        route = "/api/v1/inventory/adjustments";
        body = {
          productId: form.productId, warehouseId: selectedWarehouseId,
          quantityDelta: Number(form.quantityDelta), unitCostMinor: Number(form.unitCost),
          reason: form.reason, idempotencyKey: crypto.randomUUID()
        };
      }
      const response = await window.alnasr.request<ApiError>({
        path: route, method: "POST", token, body
      });
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
    : activeView === "suppliers" ? user?.permissions.includes("suppliers:write")
    : activeView === "purchases" ? user?.permissions.includes("purchases:write")
    : user?.permissions.includes("inventory:adjust");

  return (
    <main className="workspace" dir="rtl">
      <aside className="sidebar">
        <Brand compact />
        <div className="nav-caption">مساحة العمل</div>
        {navigation.filter(item => item.key !== "accounting" || user?.permissions.includes("accounting:read")).map(item => <button key={item.key} className={`nav-button ${activeView === item.key ? "active" : ""}`}
          onClick={() => openView(item.key)}>{item.label}</button>)}
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
            {navigation.filter(item => item.key !== "dashboard" && (item.key !== "accounting" || user?.permissions.includes("accounting:read"))).map((item, index) => <button className="module-card module-action" key={item.key} onClick={() => openView(item.key)}>
              <span className="module-number">{String(index + 1).padStart(2, "0")}</span><h3>{item.label}</h3><p>{item.description}</p><span className="module-state available-state">متاح</span>
            </button>)}
          </div>
          <section className="system-panel"><div><h3>حالة النظام المحلي</h3><p>الخادم وقاعدة البيانات يعملان على هذا الجهاز.</p>
              {user?.permissions.includes("settings:write") && <button className="secondary-button backup-button" onClick={() => void createBackup()} disabled={backupBusy}>{backupBusy ? "جارٍ إنشاء النسخة..." : "إنشاء نسخة احتياطية الآن"}</button>}
            </div>
            <div className="facts"><div><small>الخادم</small><b>Fastify · 127.0.0.1</b></div>
              <div><small>قاعدة البيانات</small><b>{health?.database?.toUpperCase() ?? "SQLITE"}</b></div>
              <div><small>إصدار المخطط</small><b>{health?.schemaVersion ?? 8}</b></div></div>
          </section>
          {backupMessage && <div className="success-note backup-result" role="status">{backupMessage}</div>}
          {error && <div className="error page-error" role="alert">{error}</div>}
        </> : activeView === "accounting" ? <AccountingView token={token} canRead={Boolean(user?.permissions.includes("accounting:read"))} /> : activeView === "cash" ? <CashRegisterView token={token} canManage={Boolean(user?.permissions.includes("cash:manage"))} /> : activeView === "pos" ? <>
          <div className="list-toolbar"><div><h2>نقطة البيع</h2><p>إنشاء فاتورة وترحيلها وخصم الكميات من المستودع المحدد.</p></div></div>
          {error && <div className="error page-error" role="alert">{error}</div>}
          {posMessage && <div className="success-note" role="status">{posMessage}</div>}
          {!posCashSessionOpen && <div className="error" role="alert">لا توجد وردية نقدية مفتوحة. يجب فتح الوردية قبل تسجيل البيع والتحصيل. <button className="table-action" onClick={() => openView("cash")}>فتح وحدة الصندوق</button></div>}
          {user?.permissions.includes("customers:read") && <section className="data-panel">
            <div className="section-heading"><h2>بيانات العميل</h2><p>اختياري: اربط الفاتورة بحساب عميل لمتابعة الرصيد وكشف الحساب.</p></div>
            <label>العميل
              <select value={posCustomerId} onChange={event => setPosCustomerId(event.target.value)}>
                <option value="">بيع نقدي مباشر / دون ربط عميل</option>
                {posCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} — {customer.code}</option>)}
              </select>
            </label>
          </section>}
          <section className="data-panel">
            <div className="section-heading"><h2>الأصناف المتاحة</h2><p>اختر الأصناف لإضافتها إلى الفاتورة.</p></div>
            {loadingRows ? <div className="empty-state">جارٍ تحميل الأصناف...</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>الصنف</th><th>SKU</th><th>سعر البيع</th><th>إضافة</th></tr></thead><tbody>
              {posProducts.map(product => <tr key={product.id}><td>{product.name_ar}</td><td dir="ltr">{product.sku}</td><td>{formatMinor(product.sale_price_minor)}</td><td><button className="table-action" onClick={() => changeCart(product.id, 1)}>إضافة +</button></td></tr>)}
            </tbody></table></div>}
          </section>
          <section className="data-panel"><div className="section-heading"><h2>الفاتورة الحالية</h2><p>العملة بوحدتها الصغرى كما هي مخزنة في قاعدة البيانات.</p></div>
            {Object.keys(posCart).length === 0 ? <div className="empty-state">السلة فارغة. أضف أصنافاً من القائمة أعلاه.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th>تعديل</th></tr></thead><tbody>
              {Object.entries(posCart).map(([id, quantity]) => { const product = posProducts.find(item => item.id === id); if (!product) return null; return <tr key={id}><td>{product.name_ar}</td><td>{formatQuantity(quantity)}</td><td>{formatMinor(product.sale_price_minor)}</td><td>{formatMinor(quantity * product.sale_price_minor)}</td><td><button className="table-action" onClick={() => changeCart(id, -1)}>−</button> <button className="table-action" onClick={() => changeCart(id, 1)}>+</button></td></tr>; })}
            </tbody></table></div>}
            <div className="form-actions"><strong>الإجمالي: {formatMinor(Object.entries(posCart).reduce((sum, [id, quantity]) => sum + quantity * (posProducts.find(item => item.id === id)?.sale_price_minor ?? 0), 0))}</strong>
              <button className="primary action-button" disabled={posBusy || !posCashSessionOpen || Object.keys(posCart).length === 0 || !user?.permissions.includes("sales:create") || !user?.permissions.includes("sales:post") || !user?.permissions.includes("sales:pay")} onClick={() => void completePosSale()}>{posBusy ? "جارٍ إكمال البيع..." : "إتمام البيع والتحصيل نقداً"}</button></div>
            {!user?.permissions.includes("sales:pay") && <p className="muted">حسابك لا يملك صلاحية تسجيل التحصيل النقدي.</p>}
          </section>
        </> : activeView === "purchases" ? <PurchasesView token={token} canWrite={Boolean(user?.permissions.includes("purchases:write"))} canPay={Boolean(user?.permissions.includes("purchases:pay"))} />
        : activeView === "returns" ? <SalesReturnsView token={token} canReturn={Boolean(user?.permissions.includes("sales:return"))} /> : <>
          <div className="list-toolbar"><div><h2>{title}</h2><p>بيانات محفوظة في قاعدة SQLite المحلية{activeView === "inventory" && warehouses[0] ? " · " + (warehouses.find(item => item.id === selectedWarehouseId)?.name ?? warehouses[0].name) : ""}.</p></div>
            {canWrite && <button className="primary action-button" onClick={() => { setFormOpen(value => !value); setForm({ ...emptyForm, productId: productOptions[0]?.id ?? "" }); setError(""); }}>
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
            {activeView === "inventory" && <>
              <label>الصنف<select value={form.productId} onChange={e => setField("productId", e.target.value)} required>
                <option value="">اختر الصنف</option>{productOptions.map(product => <option key={product.id} value={product.id}>{product.name_ar} — {product.sku}</option>)}
              </select></label>
              <label>كمية التسوية (+ إضافة / − صرف)<input type="number" step="1" value={form.quantityDelta} onChange={e => setField("quantityDelta", e.target.value)} required /></label>
              <label>تكلفة الوحدة (بالوحدة الصغرى)<input type="number" min="0" step="1" value={form.unitCost} onChange={e => setField("unitCost", e.target.value)} required /></label>
              <label className="wide-field">سبب التسوية<input value={form.reason} onChange={e => setField("reason", e.target.value)} required minLength={3} maxLength={240} /></label>
            </>}
            <div className="form-actions"><button className="primary action-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ السجل"}</button>
              <button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>إلغاء</button></div>
          </form>}
          <section className="data-panel">
            {loadingRows ? <div className="empty-state"><div className="spinner" /><p>جارٍ تحميل البيانات...</p></div>
              : rows.length === 0 ? <div className="empty-state"><h3>لا توجد سجلات بعد</h3><p>أضف أول سجل ليظهر هنا.</p></div>
              : <div className="table-scroll"><table className="data-table"><thead><tr>
                {activeView === "products" ? <><th>رمز الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>سعر البيع</th><th>التكلفة</th></>
                  : activeView === "inventory" ? <><th>رمز الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>الرصيد الحالي</th></>
                  : <><th>الرمز</th><th>الاسم</th><th>الهاتف</th>{activeView === "customers" && <th>حد الائتمان</th>}<th>الحالة</th><th>إجراء</th></>}
              </tr></thead><tbody>
                {activeView === "products" ? (rows as ProductRow[]).map(row => <tr key={row.id}>
                  <td dir="ltr">{row.sku}</td><td>{row.name_ar}{row.name_en && <small className="secondary-name">{row.name_en}</small>}</td>
                  <td dir="ltr">{row.base_unit}</td><td>{formatMinor(row.sale_price_minor)}</td><td>{formatMinor(row.cost_price_minor)}</td>
                </tr>) : activeView === "inventory" ? (rows as InventoryRow[]).map(row => <tr key={row.product_id}>
                  <td dir="ltr">{row.sku}</td><td>{row.name_ar}</td><td dir="ltr">{row.base_unit}</td>
                  <td><strong className={row.quantity < 0 ? "negative-stock" : ""}>{formatQuantity(row.quantity)}</strong></td>
                </tr>) : (rows as PartnerRow[]).map(row => <tr key={row.id}>
                  <td dir="ltr">{row.code}</td><td>{row.name}</td><td dir="ltr">{row.phone ?? "—"}</td>
                  {activeView === "customers" && <td>{formatMinor(row.credit_limit_minor ?? 0)}</td>}
                  <td><span className="active-pill">نشط</span></td>
                  <td>{activeView === "suppliers" && <button className="table-action" onClick={() => setSelectedSupplier(row)}>كشف الحساب</button>} {activeView === "customers" && <button className="table-action" onClick={() => setSelectedCustomer(row)}>كشف الحساب</button>} {canWrite && <button className="table-action" disabled={busy} onClick={() => void deactivatePartner(row)}>تعطيل</button>}</td>
                </tr>)}
              </tbody></table></div>}
          </section>
          {activeView === "suppliers" && selectedSupplier && <SupplierStatementView token={token} supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />}
          {activeView === "customers" && selectedCustomer && <CustomerStatementView token={token} customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}
        </>}
        <footer>AL-NASR ERP · جميع البيانات محفوظة محلياً على جهازك</footer>
      </section>
    </main>
  );
}

function formatMinor(value: number): string {
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 3 }).format(value);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "brand compact" : "brand"}>
    <span className="brand-mark">N</span><span><strong>النصر</strong><small>AL-NASR ERP</small></span>
  </div>;
}
