import { useCallback, useEffect, useState } from "react";
type Purchase = { id: string; document_no: string; supplier_name: string; total_minor: number; created_at: string; returnable_line_count: number };
type PurchaseLine = { purchase_line_id: string; product_id: string; sku: string; product_name: string; received_quantity: number; returned_quantity: number; remaining_quantity: number; unit_cost_minor: number };
type ReturnRecord = { id: string; document_no: string; status: "draft" | "posted" | "voided"; reason: string; total_minor: number; created_at: string };
const money = (value: number) => new Intl.NumberFormat("ar-YE").format(value);

export default function PurchaseReturnsView({ token, canReturn }: { token: string; canReturn: boolean }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadPurchases = useCallback(async () => {
    const response = await window.alnasr.request<{ items: Purchase[] }>({ path: "/api/v1/purchases/returnable", token });
    if (response.status !== 200) throw new Error("تعذر تحميل فواتير الشراء القابلة للإرجاع.");
    setPurchases(response.data.items);
  }, [token]);
  const loadSelected = useCallback(async (purchaseId: string) => {
    if (!purchaseId) { setLines([]); setReturns([]); return; }
    const [lineResponse, returnResponse] = await Promise.all([
      window.alnasr.request<{ items: PurchaseLine[] }>({ path: `/api/v1/purchases/${purchaseId}/returnable-lines`, token }),
      window.alnasr.request<{ items: ReturnRecord[] }>({ path: `/api/v1/purchases/${purchaseId}/returns`, token })
    ]);
    if (lineResponse.status !== 200 || returnResponse.status !== 200) throw new Error("تعذر تحميل تفاصيل فاتورة الشراء والمرتجعات.");
    setLines(lineResponse.data.items); setReturns(returnResponse.data.items); setQuantities({});
  }, [token]);
  useEffect(() => { let active = true; void loadPurchases().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل البيانات."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [loadPurchases]);
  async function selectPurchase(id: string) { setSelectedId(id); setError(""); setNotice(""); try { await loadSelected(id); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل التفاصيل."); } }
  async function createAndPost() {
    if (!canReturn || !selectedId) return;
    const selected = lines.filter(line => (quantities[line.purchase_line_id] ?? 0) > 0);
    if (!selected.length) { setError("حدد كمية واحدة على الأقل من الأصناف."); return; }
    if (selected.some(line => (quantities[line.purchase_line_id] ?? 0) > line.remaining_quantity)) { setError("إحدى الكميات تتجاوز الرصيد المتاح للإرجاع."); return; }
    if (reason.trim().length < 3) { setError("أدخل سبباً واضحاً للمرتجع."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const documentNo = `PR-${Date.now()}`;
      const created = await window.alnasr.request<{ returnId: string; totalMinor: number }>({
        path: `/api/v1/purchases/${selectedId}/returns`, method: "POST", token,
        body: { documentNo, reason: reason.trim(), lines: selected.map(line => ({ purchaseLineId: line.purchase_line_id, quantity: quantities[line.purchase_line_id] })), idempotencyKey: crypto.randomUUID() }
      });
      if (created.status !== 201) { const data = created.data as { message?: string }; throw new Error(data.message ?? "تعذر إنشاء مرتجع الشراء."); }
      const posted = await window.alnasr.request({ path: `/api/v1/purchase-returns/${created.data.returnId}/post`, method: "POST", token });
      if (posted.status !== 200) { const data = posted.data as { message?: string }; throw new Error(data.message ?? "حُفظت المسودة لكن تعذر ترحيل مرتجع الشراء."); }
      setNotice(`تم ترحيل المرتجع ${documentNo} بقيمة ${money(created.data.totalMinor)} وخفض رصيد المخزون والمورد.`); setReason("");
      await Promise.all([loadPurchases(), loadSelected(selectedId)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إكمال المرتجع."); await loadSelected(selectedId).catch(() => undefined); }
    finally { setBusy(false); }
  }
  async function voidDraft(returnId: string) {
    if (!canReturn || !window.confirm("هل تريد إلغاء مسودة مرتجع الشراء؟")) return;
    setBusy(true); setError(""); setNotice("");
    try { const response = await window.alnasr.request({ path: `/api/v1/purchase-returns/${returnId}/void`, method: "POST", token }); if (response.status !== 200) throw new Error("تعذر إلغاء المسودة."); setNotice("تم إلغاء مسودة المرتجع."); await Promise.all([loadPurchases(), loadSelected(selectedId)]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إلغاء المسودة."); } finally { setBusy(false); }
  }
  if (loading) return <section className="data-panel"><div className="empty-state">جارٍ تحميل فواتير الشراء...</div></section>;
  return <div>
    <div className="list-toolbar"><div><h2>مرتجعات المشتريات</h2><p>إرجاع الكميات المستلمة إلى المورد، مع تحديث المخزون والذمم الدائنة والقيود المحاسبية.</p></div></div>
    {error && <div className="error page-error" role="alert">{error}</div>}{notice && <div className="success-note" role="status">{notice}</div>}
    <section className="data-panel"><div className="section-heading"><h2>فواتير قابلة للإرجاع</h2><p>تظهر الفواتير المرحلة التي تحتوي على كميات لم تُرجع بعد.</p></div>
      {purchases.length === 0 ? <div className="empty-state">لا توجد فواتير شراء متاحة للإرجاع.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>الفاتورة</th><th>المورد</th><th>الإجمالي</th><th>أصناف متاحة</th><th>التاريخ</th><th>اختيار</th></tr></thead><tbody>{purchases.map(purchase => <tr key={purchase.id}><td dir="ltr">{purchase.document_no}</td><td>{purchase.supplier_name}</td><td>{money(purchase.total_minor)}</td><td>{purchase.returnable_line_count}</td><td dir="ltr">{new Date(purchase.created_at).toLocaleString("ar-YE")}</td><td><button className="table-action" onClick={() => void selectPurchase(purchase.id)}>عرض التفاصيل</button></td></tr>)}</tbody></table></div>}
    </section>
    {selectedId && <section className="data-panel"><div className="section-heading"><h2>أصناف فاتورة الشراء</h2><p>لا يمكن إرجاع كمية سبق إرجاعها أو لا توجد في المخزون.</p></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>الصنف</th><th>SKU</th><th>المستلم</th><th>مرتجع سابقاً</th><th>المتاح</th><th>تكلفة الوحدة</th><th>كمية الإرجاع</th></tr></thead><tbody>{lines.map(line => <tr key={line.purchase_line_id}><td>{line.product_name}</td><td dir="ltr">{line.sku}</td><td>{line.received_quantity}</td><td>{line.returned_quantity}</td><td>{line.remaining_quantity}</td><td>{money(line.unit_cost_minor)}</td><td><input aria-label={`كمية إرجاع ${line.product_name}`} type="number" min="0" max={line.remaining_quantity} step="1" disabled={!canReturn || busy || line.remaining_quantity === 0} value={quantities[line.purchase_line_id] ?? 0} onChange={event => setQuantities(current => ({ ...current, [line.purchase_line_id]: Math.max(0, Math.min(line.remaining_quantity, Number(event.target.value) || 0)) }))} /></td></tr>)}</tbody></table></div>
      <label>سبب الإرجاع<input value={reason} maxLength={240} disabled={!canReturn || busy} onChange={event => setReason(event.target.value)} placeholder="مثال: تلف أو اختلاف المواصفات" /></label>
      <div className="form-actions"><strong>قيمة المرتجع: {money(lines.reduce((sum, line) => sum + (quantities[line.purchase_line_id] ?? 0) * line.unit_cost_minor, 0))}</strong><button className="primary action-button" disabled={!canReturn || busy || !lines.some(line => (quantities[line.purchase_line_id] ?? 0) > 0)} onClick={() => void createAndPost()}>{busy ? "جارٍ ترحيل المرتجع..." : "إنشاء وترحيل المرتجع"}</button></div>
      {!canReturn && <p className="muted">حسابك لا يملك صلاحية إنشاء أو ترحيل مرتجعات المشتريات.</p>}
    </section>}
    {selectedId && <section className="data-panel"><div className="section-heading"><h2>سجل المرتجعات</h2><p>المسودات لا تؤثر على المخزون أو الحسابات حتى ترحيلها.</p></div>
      {returns.length === 0 ? <div className="empty-state">لا توجد مرتجعات لهذه الفاتورة.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>المرتجع</th><th>السبب</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th><th>الإجراء</th></tr></thead><tbody>{returns.map(item => <tr key={item.id}><td dir="ltr">{item.document_no}</td><td>{item.reason}</td><td>{money(item.total_minor)}</td><td>{item.status === "posted" ? "مرحّل" : item.status === "draft" ? "مسودة" : "ملغى"}</td><td dir="ltr">{new Date(item.created_at).toLocaleString("ar-YE")}</td><td>{item.status === "draft" && canReturn ? <button className="table-action" disabled={busy} onClick={() => void voidDraft(item.id)}>إلغاء المسودة</button> : "—"}</td></tr>)}</tbody></table></div>}
    </section>}
  </div>;
}