import { useEffect, useMemo, useState } from "react";

type Product = { id: string; sku: string; name_ar: string; cost_price_minor: number; is_active: number };
type Supplier = { id: string; code: string; name: string };
type Warehouse = { id: string; store_id: string; name: string };
type Store = { id: string; name: string };
type ApiResult<T> = { status: number; data: T };
type CartLine = { quantity: number; unitCostMinor: number };

export default function PurchasesView({ token, canWrite }: { token: string; canWrite: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [storeId, setStoreId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      window.alnasr.request<{ items: Product[] }>({ path: "/api/v1/products", token }),
      window.alnasr.request<{ items: Supplier[] }>({ path: "/api/v1/suppliers", token }),
      window.alnasr.request<{ stores: Store[]; warehouses: Warehouse[] }>({ path: "/api/v1/locations", token })
    ]).then(([productResponse, supplierResponse, locationResponse]) => {
      if (!active) return;
      if (productResponse.status !== 200 || supplierResponse.status !== 200 || locationResponse.status !== 200) {
        throw new Error("تعذر تحميل بيانات المشتريات. تحقق من صلاحيات الحساب.");
      }
      const store = locationResponse.data.stores[0];
      const warehouse = locationResponse.data.warehouses.find(item => item.store_id === store?.id);
      setProducts(productResponse.data.items);
      setSuppliers(supplierResponse.data.items);
      setSupplierId(supplierResponse.data.items[0]?.id ?? "");
      setStoreId(store?.id ?? "");
      setWarehouseId(warehouse?.id ?? "");
      if (!store || !warehouse) setError("لا يوجد متجر ومستودع نشط متوافق. أعد إعداد المواقع قبل تسجيل المشتريات.");
      if (!supplierResponse.data.items.length) setError("أضف مورداً نشطاً قبل تسجيل فاتورة شراء.");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات المشتريات.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const totalMinor = useMemo(() => Object.entries(cart).reduce((sum, [id, line]) => {
    const product = products.find(item => item.id === id);
    return sum + (product ? line.quantity * line.unitCostMinor : 0);
  }, 0), [cart, products]);

  function addProduct(product: Product) {
    setCart(current => ({
      ...current,
      [product.id]: current[product.id]
        ? { ...current[product.id], quantity: current[product.id].quantity + 1 }
        : { quantity: 1, unitCostMinor: product.cost_price_minor }
    }));
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart(current => {
      const existing = current[productId];
      if (!existing) return current;
      const next = { ...current, [productId]: { ...existing, ...patch } };
      if (next[productId].quantity <= 0) delete next[productId];
      return next;
    });
  }

  async function postPurchase() {
    if (!canWrite) { setError("حسابك لا يملك صلاحية تسجيل المشتريات."); return; }
    const lines = Object.entries(cart).map(([productId, line]) => ({
      productId, quantity: line.quantity, unitCostMinor: line.unitCostMinor
    }));
    if (!storeId || !warehouseId || !supplierId || !lines.length) {
      setError("اختر مورداً وأضف صنفاً واحداً على الأقل إلى فاتورة الشراء.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    let purchaseId = "";
    try {
      const created = await window.alnasr.request<{ purchaseId: string; totalMinor: number }>({
        path: "/api/v1/purchases", method: "POST", token,
        body: {
          documentNo: `PUR-${Date.now()}`, storeId, warehouseId, supplierId,
          lines, idempotencyKey: crypto.randomUUID()
        }
      });
      if (created.status !== 201) {
        const body = created.data as { message?: string };
        throw new Error(body.message ?? "تعذر إنشاء مسودة فاتورة الشراء.");
      }
      purchaseId = created.data.purchaseId;
      const posted = await window.alnasr.request({
        path: `/api/v1/purchases/${purchaseId}/post`, method: "POST", token
      });
      if (posted.status !== 200) {
        const body = posted.data as { message?: string };
        setNotice(`حُفظت فاتورة الشراء ${purchaseId} كمسودة. لم يُرحّل المخزون؛ راجع الفاتورة قبل إعادة المحاولة.`);
        throw new Error(body.message ?? "تعذر ترحيل فاتورة الشراء.");
      }
      setCart({});
      setNotice(`تم ترحيل فاتورة الشراء ${purchaseId} وإضافة الكميات إلى المخزون. الإجمالي: ${new Intl.NumberFormat("ar-YE").format(created.data.totalMinor)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إكمال فاتورة الشراء.");
    } finally { setBusy(false); }
  }

  if (loading) return <section className="data-panel"><div className="empty-state">جارٍ تحميل بيانات المشتريات...</div></section>;

  return <>
    <div className="list-toolbar"><div><h2>المشتريات والاستلام</h2><p>إنشاء فاتورة شراء وترحيلها لإضافة الكميات إلى المستودع المحدد.</p></div></div>
    {error && <div className="error page-error" role="alert">{error}</div>}
    {notice && <div className="success-note" role="status">{notice}</div>}
    <section className="data-panel">
      <div className="section-heading"><h2>بيانات الفاتورة</h2><p>يتم ترحيل الفاتورة كاملة في معاملة مخزون واحدة.</p></div>
      <div className="record-form">
        <label>المورد<select value={supplierId} onChange={event => setSupplierId(event.target.value)} disabled={!canWrite || busy}>
          <option value="">اختر المورد</option>{suppliers.map(item => <option key={item.id} value={item.id}>{item.name} — {item.code}</option>)}
        </select></label>
        <label>المستودع<select value={warehouseId} onChange={event => setWarehouseId(event.target.value)} disabled>
          {warehouseId && <option value={warehouseId}>المستودع الافتراضي</option>}
        </select></label>
      </div>
    </section>
    <section className="data-panel">
      <div className="section-heading"><h2>الأصناف</h2><p>أضف الأصناف وحدد الكمية وتكلفة الوحدة بالوحدة النقدية الصغرى.</p></div>
      {products.length === 0 ? <div className="empty-state">لا توجد أصناف نشطة. أضف الأصناف أولاً.</div> :
        <div className="table-scroll"><table className="data-table"><thead><tr><th>الصنف</th><th>SKU</th><th>تكلفة الوحدة</th><th>إضافة</th></tr></thead><tbody>
          {products.map(product => <tr key={product.id}><td>{product.name_ar}</td><td dir="ltr">{product.sku}</td>
            <td>{new Intl.NumberFormat("ar-YE").format(product.cost_price_minor)}</td>
            <td><button className="table-action" disabled={!canWrite || busy} onClick={() => addProduct(product)}>إضافة +</button></td></tr>)}
        </tbody></table></div>}
    </section>
    <section className="data-panel">
      <div className="section-heading"><h2>بنود فاتورة الشراء</h2><p>راجع الكميات والتكاليف قبل الترحيل.</p></div>
      {Object.keys(cart).length === 0 ? <div className="empty-state">لم تتم إضافة أصناف إلى الفاتورة.</div> :
        <div className="table-scroll"><table className="data-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الإجمالي</th><th>تعديل</th></tr></thead><tbody>
          {Object.entries(cart).map(([id, line]) => {
            const product = products.find(item => item.id === id);
            if (!product) return null;
            return <tr key={id}><td>{product.name_ar}</td><td>{line.quantity}</td>
              <td><input aria-label={`تكلفة ${product.name_ar}`} type="number" min="0" step="1" value={line.unitCostMinor}
                disabled={!canWrite || busy} onChange={event => updateLine(id, { unitCostMinor: Math.max(0, Number(event.target.value)) })} /></td>
              <td>{new Intl.NumberFormat("ar-YE").format(line.quantity * line.unitCostMinor)}</td>
              <td><button className="table-action" disabled={busy} onClick={() => updateLine(id, { quantity: line.quantity - 1 })}>−</button>{" "}
                <button className="table-action" disabled={busy} onClick={() => updateLine(id, { quantity: line.quantity + 1 })}>+</button></td></tr>;
          })}
        </tbody></table></div>}
      <div className="form-actions"><strong>إجمالي الشراء: {new Intl.NumberFormat("ar-YE").format(totalMinor)}</strong>
        <button className="primary action-button" disabled={!canWrite || busy || !supplierId || !storeId || !warehouseId || !Object.keys(cart).length}
          onClick={() => void postPurchase()}>{busy ? "جارٍ ترحيل فاتورة الشراء..." : "حفظ وترحيل فاتورة الشراء"}</button>
      </div>
      {!canWrite && <p className="muted">حسابك لا يملك صلاحية تسجيل المشتريات.</p>}
    </section>
  </>;
}
