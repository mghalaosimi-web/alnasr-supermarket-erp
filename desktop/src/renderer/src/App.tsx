import { FormEvent, useEffect, useState } from "react";

type Health = { app: string; status: string; database: string };
type PublicUser = { id: string; username: string; displayName: string };
type OwnerSetupInput = { username: string; displayName: string; password: string };
type ProductInput = { sku: string; nameAr: string; nameEn?: string; barcode?: string; costMinor: number; priceMinor: number; openingQuantity?: number };
type ProductRow = { id: string; sku: string; nameAr: string; nameEn: string | null; barcode: string | null; costMinor: number; priceMinor: number; isActive: number; stockOnHand: number };
type CashierShift = { id: string; openingCashMinor: number; openedAt?: string; status?: "open" };
type SaleResult = { id: string; saleNumber: string; totalMinor: number; status: "posted"; lines: Array<{ productId: string; sku: string; nameAr: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }> };
type StockMovementRow = { id: string; sku: string; productName: string; warehouseName: string; movementType: string; quantityDelta: number; unitCostMinor: number; occurredAt: string };
type SupplierRow = { id: string; code: string; name: string; phone: string | null; isActive: number };

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
      listSuppliers: () => Promise<SupplierRow[]>;
      createSupplier: (input: { code: string; name: string; phone?: string }) => Promise<SupplierRow>;
      createBackup: () => Promise<{ canceled: boolean; filePath?: string }>;
      listStockMovements: () => Promise<StockMovementRow[]>;
      receiveStock: (input: { productId: string; quantity: number; unitCostMinor: number }) => Promise<{ movementId: string; quantityOnHand: number }>;
      adjustStock: (input: { productId: string; countedQuantity: number }) => Promise<{ movementId: string | null; previousQuantity: number; countedQuantity: number; difference: number }>;
    };
  }
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [ownerSetupRequired, setOwnerSetupRequired] = useState<boolean | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [activePage, setActivePage] = useState<"dashboard" | "pos" | "products" | "inventory" | "backup" | "suppliers">("dashboard");
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
  const [barcodeScan, setBarcodeScan] = useState("");
  const [cart, setCart] = useState<Array<{ productId: string; sku: string; nameAr: string; priceMinor: number; quantity: number }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [saleBusy, setSaleBusy] = useState(false);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [saleKey, setSaleKey] = useState(() => window.crypto.randomUUID());
  const [stockMovements, setStockMovements] = useState<StockMovementRow[]>([]);
  const [stockProductId, setStockProductId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState("1");
  const [receiveUnitCost, setReceiveUnitCost] = useState("0");
  const [countedQuantity, setCountedQuantity] = useState("0");
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierBusy, setSupplierBusy] = useState(false);

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
      setActivePage("dashboard");
      setOwnerSetupRequired(false);
      const loadedProducts = await window.alnasr.listProducts();
      setProducts(loadedProducts);
      setStockProductId(loadedProducts[0]?.id ?? "");
      setStockMovements(await window.alnasr.listStockMovements());
      setSuppliers(await window.alnasr.listSuppliers());
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
      const updatedProducts = await window.alnasr.listProducts();
      setProducts(updatedProducts);
      setStockMovements(await window.alnasr.listStockMovements());
      if (!stockProductId) setStockProductId(updatedProducts[0]?.id ?? "");
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
    setActivePage("dashboard");
    setProducts([]);
    setStockMovements([]);
    setSuppliers([]);
    setStockProductId("");
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

  function addToCart(productIdOverride?: string, quantityOverride?: number) {
    const product = products.find((item) => item.id === (productIdOverride ?? selectedProductId));
    const quantity = quantityOverride ?? Number(saleQuantity);
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


  function scanBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = barcodeScan.trim();
    const product = products.find((item) => item.barcode === code || item.sku.toLowerCase() === code.toLowerCase());
    if (!product) {
      setError("لم يتم العثور على منتج بهذا الباركود أو الرمز");
      return;
    }
    addToCart(product.id, 1);
    setBarcodeScan("");
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
      setStockMovements(await window.alnasr.listStockMovements());
      setSaleKey(window.crypto.randomUUID());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إتمام البيع");
    } finally {
      setSaleBusy(false);
    }
  }


  async function submitStockReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInventoryBusy(true);
    setError(null);
    try {
      await window.alnasr.receiveStock({
        productId: stockProductId,
        quantity: Number(receiveQuantity),
        unitCostMinor: Math.round(Number(receiveUnitCost) * 100)
      });
      setProducts(await window.alnasr.listProducts());
      setStockMovements(await window.alnasr.listStockMovements());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر استلام المخزون");
    } finally {
      setInventoryBusy(false);
    }
  }

  async function submitStockCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInventoryBusy(true);
    setError(null);
    try {
      const result = await window.alnasr.adjustStock({
        productId: stockProductId,
        countedQuantity: Number(countedQuantity)
      });
      setProducts(await window.alnasr.listProducts());
      setStockMovements(await window.alnasr.listStockMovements());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر اعتماد الجرد");
    } finally {
      setInventoryBusy(false);
    }
  }



  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupplierBusy(true);
    setError(null);
    try {
      await window.alnasr.createSupplier({ code: supplierCode, name: supplierName, phone: supplierPhone || undefined });
      setSuppliers(await window.alnasr.listSuppliers());
      setSupplierCode("");
      setSupplierName("");
      setSupplierPhone("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ المورد");
    } finally {
      setSupplierBusy(false);
    }
  }

  async function createDatabaseBackup() {
    setBackupBusy(true);
    setBackupMessage(null);
    setError(null);
    try {
      const result = await window.alnasr.createBackup();
      if (!result.canceled) setBackupMessage("تم إنشاء النسخة الاحتياطية بنجاح: " + result.filePath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إنشاء النسخة الاحتياطية");
    } finally {
      setBackupBusy(false);
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
        {user && <nav className="top-nav" aria-label="التنقل الرئيسي">
          <button type="button" className={activePage === "dashboard" ? "nav-link active" : "nav-link"} onClick={() => setActivePage("dashboard")}>الرئيسية</button>
          <button type="button" className={activePage === "pos" ? "nav-link active" : "nav-link"} onClick={() => setActivePage("pos")}>نقطة البيع</button>
          <button type="button" className={activePage === "products" ? "nav-link active" : "nav-link"} onClick={() => setActivePage("products")}>المنتجات</button>
          <button type="button" className={activePage === "inventory" ? "nav-link active" : "nav-link"} onClick={() => setActivePage("inventory")}>المخزون</button>
          <button type="button" className={activePage === "backup" ? "nav-link active" : "nav-link"} onClick={() => setActivePage("backup")}>النسخ الاحتياطي</button>
          <button type="button" className={activePage === "suppliers" ? "nav-link active" : "nav-link"} onClick={() => setActivePage("suppliers")}>الموردون</button>
        </nav>}
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


          {activePage === "pos" && <section className="pos-workspace">
            <div className="product-heading">
              <div><span className="eyebrow">نقطة البيع</span><h2>الوردية والفواتير</h2></div>
              <span className="product-count">{shift ? "الوردية مفتوحة" : "لا توجد وردية مفتوحة"}</span>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            {!shift ? (
              <form className="shift-form" onSubmit={startShift}>
                <label>رصيد افتتاح الصندوق<input type="number" min="0" step="0.01" value={shiftOpeningCash} onChange={(event) => setShiftOpeningCash(event.target.value)} required /></label>
                <button type="submit" disabled={shiftBusy}>{shiftBusy ? "جارٍ الفتح..." : "فتح وردية جديدة"}</button>
              </form>
            ) : (
              <>

                <form className="barcode-scan" onSubmit={scanBarcode}>
                  <label>مسح الباركود أو إدخال رمز المنتج
                    <input value={barcodeScan} onChange={(event) => setBarcodeScan(event.target.value)} autoComplete="off" placeholder="امسح الباركود ثم اضغط Enter" />
                  </label>
                  <button type="submit">إضافة المنتج</button>
                </form>
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
          </section>}
          {activePage === "products" && <section className="product-workspace">
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

          </section>}
          {activePage === "inventory" && <section className="inventory-workspace">
            <div className="product-heading">
              <div><span className="eyebrow">المستودع الرئيسي</span><h2>استلام المخزون والجرد</h2></div>
              <span className="product-count">{stockMovements.length} حركة حديثة</span>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <label className="inventory-product-select">المنتج
              <select value={stockProductId} onChange={(event) => { const id = event.target.value; setStockProductId(id); setCountedQuantity(String(products.find((product) => product.id === id)?.stockOnHand ?? 0)); }} required>
                <option value="">اختر منتجاً</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.nameAr} · المتوفر {product.stockOnHand}</option>)}
              </select>
            </label>
            <div className="inventory-forms">
              <form className="inventory-form" onSubmit={submitStockReceipt}>
                <h3>استلام كمية جديدة</h3>
                <label>الكمية المستلمة<input type="number" min="1" step="1" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} required /></label>
                <label>تكلفة الوحدة<input type="number" min="0" step="0.01" value={receiveUnitCost} onChange={(event) => setReceiveUnitCost(event.target.value)} required /></label>
                <button type="submit" disabled={inventoryBusy || !stockProductId}>{inventoryBusy ? "جارٍ الحفظ..." : "تسجيل الاستلام"}</button>
              </form>
              <form className="inventory-form" onSubmit={submitStockCount}>
                <h3>تسوية الجرد الفعلي</h3>
                <label>الكمية الموجودة فعلياً<input type="number" min="0" step="1" value={countedQuantity} onChange={(event) => setCountedQuantity(event.target.value)} required /></label>
                <p className="form-hint">سيُسجل فرق الجرد كحركة تعديل، دون حذف الحركات السابقة.</p>
                <button type="submit" disabled={inventoryBusy || !stockProductId}>{inventoryBusy ? "جارٍ الحفظ..." : "اعتماد نتيجة الجرد"}</button>
              </form>
            </div>
            <h3 className="movement-title">سجل حركات المخزون</h3>
            <div className="product-list">
              {stockMovements.length === 0 ? <p className="empty-products">لا توجد حركات مخزون مسجلة.</p> : stockMovements.map((movement) => (
                <article className="product-row" key={movement.id}>
                  <div><strong>{movement.productName}</strong><small>{movement.sku} · {movement.warehouseName} · {({ opening: "رصيد افتتاحي", purchase: "استلام", sale: "بيع", sale_return: "مرتجع بيع", purchase_return: "مرتجع شراء", transfer_in: "تحويل وارد", transfer_out: "تحويل صادر", adjustment: "تسوية جرد" } as Record<string, string>)[movement.movementType] ?? movement.movementType}</small></div>
                  <strong className={movement.quantityDelta < 0 ? "movement-negative" : "movement-positive"}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</strong>
                </article>
              ))}
            </div>
          </section>}

          {activePage === "backup" && <section className="backup-workspace">
            <span className="eyebrow">حماية البيانات المحلية</span>
            <h2>النسخ الاحتياطي</h2>
            <p>أنشئ نسخة SQLite متسقة من قاعدة بيانات النظام باستخدام آلية SQLite Backup، حتى أثناء تشغيل التطبيق.</p>
            <button type="button" onClick={() => void createDatabaseBackup()} disabled={backupBusy}>{backupBusy ? "جارٍ إنشاء النسخة..." : "إنشاء نسخة احتياطية"}</button>
            {backupMessage && <p className="backup-success">{backupMessage}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <small className="form-hint">احفظ النسخة في قرص خارجي أو مكان آمن منفصل عن جهاز التشغيل. استعادة النسخ الاحتياطية لم تُضف بعد.</small>
          </section>}

          {activePage === "suppliers" && <section className="supplier-workspace">
            <div className="product-heading">
              <div><span className="eyebrow">دليل الشركاء</span><h2>إدارة الموردين</h2></div>
              <span className="product-count">{suppliers.length} مورد</span>
            </div>
            <form className="supplier-form" onSubmit={submitSupplier}>
              <label>رمز المورد<input value={supplierCode} onChange={(event) => setSupplierCode(event.target.value)} required minLength={2} maxLength={40} placeholder="SUP-001" /></label>
              <label>اسم المورد<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} required minLength={2} maxLength={160} placeholder="اسم المؤسسة أو المورد" /></label>
              <label>رقم الهاتف<input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} maxLength={40} placeholder="اختياري" /></label>
              <button type="submit" disabled={supplierBusy}>{supplierBusy ? "جارٍ الحفظ..." : "إضافة المورد"}</button>
            </form>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="product-list">
              {suppliers.length === 0 ? <p className="empty-products">لا يوجد موردون مسجلون بعد.</p> : suppliers.map((supplier) => (
                <article className="product-row" key={supplier.id}>
                  <div><strong>{supplier.name}</strong><small>{supplier.code}{supplier.phone ? " · " + supplier.phone : ""}</small></div>
                  <span className="supplier-status">{supplier.isActive ? "نشط" : "موقوف"}</span>
                </article>
              ))}
            </div>
          </section>}
          {activePage === "dashboard" && <>
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
          </>}
        </section>
      )}
      <footer>AL-NASR · يعمل محلياً على هذا الجهاز</footer>
    </main>
  );
}
