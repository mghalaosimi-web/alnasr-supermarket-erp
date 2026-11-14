import { FormEvent, useEffect, useState } from "react";

type Health = { app: string; status: string; database: string };
type PublicUser = { id: string; username: string; displayName: string };
type OwnerSetupInput = { username: string; displayName: string; password: string };
type ProductInput = { sku: string; nameAr: string; nameEn?: string; barcode?: string; costMinor: number; priceMinor: number; openingQuantity?: number };
type ProductRow = { id: string; sku: string; nameAr: string; nameEn: string | null; barcode: string | null; costMinor: number; priceMinor: number; isActive: number; stockOnHand: number };

declare global {
  interface Window {
    alnasr: {
      health: () => Promise<Health>;
      setupStatus: () => Promise<{ ownerSetupRequired: boolean }>;
      bootstrapOwner: (input: OwnerSetupInput) => Promise<PublicUser>;
      login: (input: { username: string; password: string }) => Promise<PublicUser>;
      logout: () => Promise<{ success: boolean }>;
      listProducts: () => Promise<ProductRow[]>;
      createProduct: (input: ProductInput) => Promise<ProductRow>;
    };
  }
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [ownerSetupRequired, setOwnerSetupRequired] = useState<boolean | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productSku, setProductSku] = useState("");
  const [productName, setProductName] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productCost, setProductCost] = useState("0");
  const [productPrice, setProductPrice] = useState("0");
  const [openingQuantity, setOpeningQuantity] = useState("0");
  const [productBusy, setProductBusy] = useState(false);

  useEffect(() => {
    Promise.all([window.alnasr.health(), window.alnasr.setupStatus()])
      .then(([healthState, setupState]) => {
        setHealth(healthState);
        setOwnerSetupRequired(setupState.ownerSetupRequired);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "تعذر فحص النظام"));
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = ownerSetupRequired
        ? await window.alnasr.bootstrapOwner({ username, displayName, password })
        : await window.alnasr.login({ username, password });
      setUser(result);
      setOwnerSetupRequired(false);
      setProducts(await window.alnasr.listProducts());
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إتمام العملية");
    } finally {
      setBusy(false);
    }
  }


  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductBusy(true);
    setError(null);
    try {
      await window.alnasr.createProduct({
        sku: productSku,
        nameAr: productName,
        barcode: productBarcode || undefined,
        costMinor: Math.round(Number(productCost) * 100),
        priceMinor: Math.round(Number(productPrice) * 100),
        openingQuantity: Math.max(0, Math.trunc(Number(openingQuantity)))
      });
      setProducts(await window.alnasr.listProducts());
      setProductSku("");
      setProductName("");
      setProductBarcode("");
      setProductCost("0");
      setProductPrice("0");
      setOpeningQuantity("0");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ المنتج");
    } finally {
      setProductBusy(false);
    }
  }

  async function logout() {
    await window.alnasr.logout();
    setUser(null);
    setProducts([]);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">ن</div>
        <div>
          <strong>النصر</strong>
          <span>AL-NASR MANAGEMENT SYSTEM</span>
        </div>
        <div className="topbar-spacer" />
        <span className="version">نسخة التطوير 0.1.0</span>
      </header>
      <section className="welcome">
        <p className="eyebrow">نظام إدارة التجارة والمبيعات</p>
        <h1>مرحباً بك في نظام النصر</h1>
        <p className="description">قاعدة بيانات محلية، تشغيل مستقل، وإدارة موحدة لعمليات النشاط التجاري.</p>
        <div className="status-card">
          <div className="status-indicator" />
          <div>
            <strong>{error && !health ? "تعذر الاتصال بقاعدة البيانات" : health ? "محرك النظام يعمل" : "جارٍ فحص محرك النظام..."}</strong>
            <p>{health ? `SQLite: ${health.database} · التطبيق: ${health.status}` : "يتم التحقق من الاتصال المحلي"}</p>
          </div>
        </div>
      </section>

      {!user && ownerSetupRequired !== null && (
        <section className="auth-section">
          <form className="auth-card" onSubmit={submitAuth}>
            <p className="eyebrow">{ownerSetupRequired ? "الإعداد الأول للنظام" : "تسجيل الدخول"}</p>
            <h2>{ownerSetupRequired ? "إنشاء حساب مالك النظام" : "تسجيل الدخول إلى النصر"}</h2>
            {ownerSetupRequired && (
              <label>الاسم الكامل
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
              </label>
            )}
            <label>اسم المستخدم
              <input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} autoComplete="username" />
            </label>
            <label>كلمة المرور
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={ownerSetupRequired ? 12 : 1} maxLength={128} autoComplete={ownerSetupRequired ? "new-password" : "current-password"} />
            </label>
            {ownerSetupRequired && <small className="form-hint">استخدم كلمة مرور قوية لا تقل عن 12 حرفاً. سيتم حفظها محلياً بصيغة تجزئة آمنة.</small>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || !health}>{busy ? "يرجى الانتظار..." : ownerSetupRequired ? "إنشاء حساب المالك" : "دخول"}</button>
          </form>
        </section>
      )}

      {user && (
        <section className="modules">
          <div className="signed-in">
            <div><span className="eyebrow">تم تسجيل الدخول</span><h2>أهلاً، {user.displayName}</h2></div>
            <button className="secondary-button" onClick={() => void logout()}>تسجيل الخروج</button>
          </div>

          <section className="product-workspace">
            <div className="product-heading">
              <div><span className="eyebrow">الكتالوج الأساسي</span><h2>إدارة المنتجات</h2></div>
              <span className="product-count">{products.length} منتج</span>
            </div>
            <form className="product-form" onSubmit={submitProduct}>
              <label>رمز المنتج (SKU)<input value={productSku} onChange={(event) => setProductSku(event.target.value)} required minLength={2} maxLength={40} placeholder="P-001" /></label>
              <label>اسم المنتج<input value={productName} onChange={(event) => setProductName(event.target.value)} required minLength={2} maxLength={160} placeholder="اسم المنتج بالعربية" /></label>
              <label>الباركود (اختياري)<input value={productBarcode} onChange={(event) => setProductBarcode(event.target.value)} maxLength={64} placeholder="628..." /></label>
              <label>التكلفة<input type="number" min="0" step="0.01" value={productCost} onChange={(event) => setProductCost(event.target.value)} required /></label>
              <label>سعر البيع<input type="number" min="0" step="0.01" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} required /></label>
              <label>الكمية الافتتاحية<input type="number" min="0" step="1" value={openingQuantity} onChange={(event) => setOpeningQuantity(event.target.value)} required /></label>
              <button type="submit" disabled={productBusy}>{productBusy ? "جارٍ الحفظ..." : "إضافة المنتج"}</button>
            </form>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="product-list">
              {products.length === 0 ? <p className="empty-products">لا توجد منتجات بعد. أضف أول منتج للبدء.</p> : products.map((product) => (
                <article className="product-row" key={product.id}>
                  <div><strong>{product.nameAr}</strong><small>{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</small></div>
                  <div className="product-metrics"><small>المتوفر: {product.stockOnHand}</small><strong>{(product.priceMinor / 100).toFixed(2)}</strong></div>
                </article>
              ))}
            </div>
          </section>
          <h2>وحدات النظام</h2>
          <div className="module-grid">
            {["نقطة البيع", "المنتجات والباركود", "المخزون والمستودعات", "المشتريات والموردون", "العملاء", "الحسابات والتقارير"].map((name) => (
              <article className="module-card" key={name}>
                <span className="module-dot" />
                <strong>{name}</strong>
                <small>الوحدة ضمن مراحل التنفيذ والاختبار</small>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer>AL-NASR · يعمل محلياً على هذا الجهاز</footer>
    </main>
  );
}
