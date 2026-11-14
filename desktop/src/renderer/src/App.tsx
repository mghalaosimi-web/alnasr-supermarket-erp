import { FormEvent, useEffect, useState } from "react";

type Health = { app: string; status: string; database: string };
type PublicUser = { id: string; username: string; displayName: string };
type OwnerSetupInput = { username: string; displayName: string; password: string };
type ProductInput = { sku: string; nameAr: string; nameEn?: string; barcode?: string; costMinor: number; priceMinor: number; openingQuantity?: number };
type ProductRow = { id: string; sku: string; nameAr: string; nameEn: string | null; barcode: string | null; costMinor: number; priceMinor: number; isActive: number; stockOnHand: number };
type CashierShift = { id: string; openingCashMinor: number; openedAt?: string; status?: "open" };
type SaleResult = { id: string; saleNumber: string; totalMinor: number; status: "posted"; lines: Array<{ productId: string; sku: string; nameAr: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }> };

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
      currentShift: () => Promise<CashierShift | null>;
      openShift: (openingCashMinor: number) => Promise<CashierShift>;
      closeShift: (input: { shiftId: string; closingCashMinor: number }) => Promise<{ id: string; closingCashMinor: number; status: "closed" }>;
      createSale: (input: { lines: Array<{ productId: string; quantity: number }>; paymentMethod: "cash" | "card" | "transfer"; idempotencyKey: string }) => Promise<SaleResult>;
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
  const [shift, setShift] = useState<CashierShift | null>(null);
  const [shiftOpeningCash, setShiftOpeningCash] = useState("0");
  const [shiftClosingCash, setShiftClosingCash] = useState("0");
  const [shiftBusy, setShiftBusy] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [cart, setCart] = useState<Array<{ productId: string; sku: string; nameAr: string; priceMinor: number; quantity: number }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [saleBusy, setSaleBusy] = useState(false);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [saleKey, setSaleKey] = useState(() => window.crypto.randomUUID());

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
      setShift(await window.alnasr.currentShift());
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
    setShift(null);
    setCart([]);
    setLastSale(null);
  }


  async function startShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShiftBusy(true);
    setError(null);
    try {
      const opened = await window.alnasr.openShift(Math.round(Number(shiftOpeningCash) * 100));
      setShift(opened);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر فتح الوردية");
    } finally {
      setShiftBusy(false);
    }
  }

  async function finishShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shift) return;
    setShiftBusy(true);
    setError(null);
    try {
      await window.alnasr.closeShift({ shiftId: shift.id, closingCashMinor: Math.round(Number(shiftClosingCash) * 100) });
      setShift(null);
      setCart([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إغلاق الوردية");
    } finally {
      setShiftBusy(false);
    }
  }

  function addToCart() {
    const product = products.find((item) => item.id === selectedProductId);
    const quantity = Number(saleQuantity);
    if (!product || !Number.isSafeInteger(quantity) || quantity <= 0) {
      setError("اختر منتجاً وأدخل كمية صحيحة");
      return;
    }
    if (product.stockOnHand < quantity) {
      setError("الكمية المطلوبة أكبر من المخزون المتاح");
      return;
    }
    const existing = cart.find((item) => item.productId === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > product.stockOnHand) {
      setError("إجمالي الكمية في السلة يتجاوز المخزون المتاح");
      return;
    }
    setError(null);
    setCart(existing
      ? cart.map((item) => item.productId === product.id ? { ...item, quantity: nextQuantity } : item)
      : [...cart, { productId: product.id, sku: product.sku, nameAr: product.nameAr, priceMinor: product.priceMinor, quantity }]);
  }

  async function completeSale() {
    if (!cart.length) return;
    setSaleBusy(true);
    setError(null);
    try {
      const result = await window.alnasr.createSale({
        lines: cart.map(({ productId, quantity }) => ({ productId, quantity })),
        paymentMethod,
        idempotencyKey: saleKey
      });
      setLastSale(result);
      setCart([]);
      setProducts(await window.alnasr.listProducts());
      setSaleKey(window.crypto.randomUUID());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إتمام البيع");
    } finally {
      setSaleBusy(false);
    }
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


          <section className="pos-workspace">
            <div className="product-heading">
              <div><span className="eyebrow">نقطة البيع</span><h2>الوردية والفواتير</h2></div>
              <span className="product-count">{shift ? "الوردية مفتوحة" : "لا توجد وردية مفتوحة"}</span>
            </div>
            {!shift ? (
              <form className="shift-form" onSubmit={startShift}>
                <label>رصيد افتتاح الصندوق<input type="number" min="0" step="0.01" value={shiftOpeningCash} onChange={(event) => setShiftOpeningCash(event.target.value)} required /></label>
                <button type="submit" disabled={shiftBusy}>{shiftBusy ? "جارٍ الفتح..." : "فتح وردية جديدة"}</button>
              </form>
            ) : (
              <>
                <div className="pos-entry">
                  <label>المنتج
                    <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                      <option value="">اختر منتجاً</option>
                      {products.filter((product) => product.stockOnHand > 0).map((product) => (
                        <option key={product.id} value={product.id}>{product.nameAr} — متاح {product.stockOnHand}</option>
                      ))}
                    </select>
                  </label>
                  <label>الكمية<input type="number" min="1" step="1" value={saleQuantity} onChange={(event) => setSaleQuantity(event.target.value)} /></label>
                  <button type="button" onClick={addToCart}>إضافة للسلة</button>
                </div>
                <div className="cart-list">
                  {cart.length === 0 ? <p className="empty-products">السلة فارغة. اختر المنتجات لإضافتها إلى الفاتورة.</p> : cart.map((item) => (
                    <article className="product-row" key={item.productId}>
                      <div><strong>{item.nameAr}</strong><small>{item.sku} · الكمية {item.quantity}</small></div>
                      <strong>{((item.priceMinor * item.quantity) / 100).toFixed(2)}</strong>
                    </article>
                  ))}
                </div>
                <div className="checkout-row">
                  <label>طريقة الدفع
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "card" | "transfer")}>
                      <option value="cash">نقداً</option><option value="card">بطاقة</option><option value="transfer">تحويل</option>
                    </select>
                  </label>
                  <div className="cart-total"><small>الإجمالي</small><strong>{(cart.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0) / 100).toFixed(2)}</strong></div>
                  <button type="button" onClick={() => void completeSale()} disabled={saleBusy || cart.length === 0}>{saleBusy ? "جارٍ اعتماد الفاتورة..." : "اعتماد البيع"}</button>
                </div>
                {lastSale && <p className="sale-success">تم اعتماد الفاتورة {lastSale.saleNumber} · الإجمالي {(lastSale.totalMinor / 100).toFixed(2)}</p>}
                <form className="shift-form shift-close" onSubmit={finishShift}>
                  <label>الرصيد الفعلي عند الإغلاق<input type="number" min="0" step="0.01" value={shiftClosingCash} onChange={(event) => setShiftClosingCash(event.target.value)} required /></label>
                  <button type="submit" disabled={shiftBusy}>إغلاق الوردية</button>
                </form>
              </>
            )}
          </section>
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
