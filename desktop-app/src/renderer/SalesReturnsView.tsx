import { useCallback, useEffect, useState } from "react";

type Sale = { id: string; document_no: string; customer_name: string | null; total_minor: number; created_at: string; returnable_line_count: number };
type SaleLine = { sale_line_id: string; product_id: string; sku: string; product_name: string; sold_quantity: number; reserved_quantity: number; remaining_quantity: number; unit_price_minor: number };
type ReturnRecord = { id: string; document_no: string; status: "draft" | "posted" | "voided"; reason: string; total_minor: number; created_at: string };

const money = (value: number) => new Intl.NumberFormat("ar-YE").format(value);

export default function SalesReturnsView({ token, canReturn }: { token: string; canReturn: boolean }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSales = useCallback(async () => {
    const response = await window.alnasr.request<{ items: Sale[] }>({ path: "/api/v1/sales/returnable", token });
    if (response.status !== 200) throw new Error("تعذر تحميل فواتير البيع القابلة للإرجاع.");
    setSales(response.data.items);
  }, [token]);

  const loadSelected = useCallback(async (saleId: string) => {
    if (!saleId) { setLines([]); setReturns([]); return; }
    const [lineResponse, returnResponse] = await Promise.all([
      window.alnasr.request<{ items: SaleLine[] }>({ path: `/api/v1/sales/${saleId}/returnable-lines`, token }),
      window.alnasr.request<{ items: ReturnRecord[] }>({ path: `/api/v1/sales/${saleId}/returns`, token })
    ]);
    if (lineResponse.status !== 200 || returnResponse.status !== 200) throw new Error("تعذر تحميل تفاصيل الفاتورة والمرتجعات.");
    setLines(lineResponse.data.items);
    setReturns(returnResponse.data.items);
    setQuantities({});
  }, [token]);

  useEffect(() => {
    let active = true;
    void loadSales().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل البيانات."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadSales]);

  async function selectSale(id: string) {
    setSelectedSaleId(id); setError(""); setNotice("");
    try { await loadSelected(id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل تفاصيل الفاتورة."); }
  }

  async function createAndPostReturn() {
    if (!canReturn || !selectedSaleId) return;
    const selected = lines.filter(line => (quantities[line.sale_line_id] ?? 0) > 0);
    if (!selected.length) { setError("حدد كمية واحدة على الأقل من الأصناف."); return; }
    if (selected.some(line => (quantities[line.sale_line_id] ?? 0) > line.remaining_quantity)) {
      setError("إحدى الكميات تتجاوز الرصيد المتاح للإرجاع."); return;
    }
    if (reason.trim().length < 3) { setError("أدخل سبباً واضحاً للمرتجع."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const documentNo = `RET-${Date.now()}`;
      const created = await window.alnasr.request<{ returnId: string; totalMinor: number }>({
        path: `/api/v1/sales/${selectedSaleId}/returns`, method: "POST", token,
        body: {
          documentNo, reason: reason.trim(),
          lines: selected.map(line => ({ saleLineId: line.sale_line_id, quantity: quantities[line.sale_line_id] })),
          idempotencyKey: crypto.randomUUID()
        }
      });
      if (created.status !== 201) {
        const data = created.data as { message?: string };
        throw new Error(data.message ?? "تعذر إنشاء المرتجع.");
      }
      const posted = await window.alnasr.request<{ status: string }>({
        path: `/api/v1/sale-returns/${created.data.returnId}/post`, method: "POST", token
      });
      if (posted.status !== 200) {
        const data = posted.data as { message?: string };
        throw new Error(data.message ?? "تم إنشاء مسودة المرتجع لكن تعذر ترحيلها. راجع سجل المرتجعات قبل إعادة المحاولة.");
      }
      setNotice(`تم ترحيل المرتجع ${documentNo} بقيمة ${money(created.data.totalMinor)} وإعادة الكميات إلى المستودع.`);
      setReason("");
      await Promise.all([loadSales(), loadSelected(selectedSaleId)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إكمال المرتجع.");
      await loadSelected(selectedSaleId).catch(() => undefined);
    } finally { setBusy(false); }
  }

  async function voidDraft(returnId: string) {
    if (!canReturn || !window.confirm("هل تريد إلغاء مسودة المرتجع وتحرير الكميات المحجوزة؟")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await window.alnasr.request({
        path: `/api/v1/sale-returns/${returnId}/void`, method: "POST", token
      });
      if (response.status !== 200) throw new Error("تعذر إلغاء مسودة المرتجع.");
      setNotice("تم إلغاء المسودة وتحرير الكميات.");
      await Promise.all([loadSales(), loadSelected(selectedSaleId)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إلغاء المسودة."); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="data-panel"><div className="empty-state">جارٍ تحميل فواتير البيع...</div></section>;
  return <div>
    <div className="list-toolbar"><div><h2>مرتجعات المبيعات</h2><p>اختر فاتورة مرحّلة، وحدد الكميات المراد إرجاعها. لا تُعاد الكمية للمخزون إلا بعد الترحيل.</p></div></div>
    {error && <div className="error page-error" role="alert">{error}</div>}
    {notice && <div className="success-note" role="status">{notice}</div>}
    <section className="data-panel">
      <div className="section-heading"><h2>فواتير قابلة للإرجاع</h2><p>تظهر الفواتير التي تحتوي على كميات لم تُرجع بعد.</p></div>
      {sales.length === 0 ? <div className="empty-state">لا توجد فواتير بيع متاحة للإرجاع.</div> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>أصناف متاحة</th><th>التاريخ</th><th>اختيار</th></tr></thead>
        <tbody>{sales.map(sale => <tr key={sale.id}><td dir="ltr">{sale.document_no}</td><td>{sale.customer_name || "عميل نقدي"}</td><td>{money(sale.total_minor)}</td><td>{sale.returnable_line_count}</td><td dir="ltr">{new Date(sale.created_at).toLocaleString("ar-YE")}</td><td><button className="table-action" onClick={() => void selectSale(sale.id)}>عرض التفاصيل</button></td></tr>)}</tbody>
      </table></div>}
    </section>
    {selectedSaleId && <section className="data-panel">
      <div className="section-heading"><h2>أصناف الفاتورة المحددة</h2><p>أدخل كمية الإرجاع لكل صنف ضمن الحد المتاح.</p></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>الصنف</th><th>SKU</th><th>المباع</th><th>محجوز للإرجاع</th><th>المتاح</th><th>سعر الوحدة</th><th>كمية الإرجاع</th></tr></thead>
        <tbody>{lines.map(line => <tr key={line.sale_line_id}><td>{line.product_name}</td><td dir="ltr">{line.sku}</td><td>{line.sold_quantity}</td><td>{line.reserved_quantity}</td><td>{line.remaining_quantity}</td><td>{money(line.unit_price_minor)}</td><td><input aria-label={`كمية إرجاع ${line.product_name}`} type="number" min="0" max={line.remaining_quantity} step="1" disabled={!canReturn || busy || line.remaining_quantity === 0} value={quantities[line.sale_line_id] ?? 0} onChange={e => setQuantities(current => ({ ...current, [line.sale_line_id]: Math.max(0, Math.min(line.remaining_quantity, Number(e.target.value) || 0)) }))} /></td></tr>)}</tbody>
      </table></div>
      <label>سبب الإرجاع<input value={reason} maxLength={240} disabled={!canReturn || busy} onChange={e => setReason(e.target.value)} placeholder="مثال: تلف الصنف أو خطأ في الطلب" /></label>
      <div className="form-actions"><strong>قيمة المرتجع: {money(lines.reduce((sum, line) => sum + (quantities[line.sale_line_id] ?? 0) * line.unit_price_minor, 0))}</strong>
        <button className="primary action-button" disabled={!canReturn || busy || !lines.some(line => (quantities[line.sale_line_id] ?? 0) > 0)} onClick={() => void createAndPostReturn()}>{busy ? "جارٍ ترحيل المرتجع..." : "إنشاء وترحيل المرتجع"}</button></div>
      {!canReturn && <p className="muted">يمكنك عرض الفواتير، لكن حسابك لا يملك صلاحية إنشاء أو ترحيل المرتجعات.</p>}
    </section>}
    {selectedSaleId && <section className="data-panel"><div className="section-heading"><h2>سجل المرتجعات</h2><p>المسودات لا تؤثر على المخزون حتى ترحيلها.</p></div>
      {returns.length === 0 ? <div className="empty-state">لا توجد مرتجعات لهذه الفاتورة.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>المرتجع</th><th>السبب</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th><th>الإجراء</th></tr></thead><tbody>
        {returns.map(item => <tr key={item.id}><td dir="ltr">{item.document_no}</td><td>{item.reason}</td><td>{money(item.total_minor)}</td><td>{item.status === "posted" ? "مرحّل" : item.status === "draft" ? "مسودة" : "ملغى"}</td><td dir="ltr">{new Date(item.created_at).toLocaleString("ar-YE")}</td><td>{item.status === "draft" && canReturn ? <button className="table-action" disabled={busy} onClick={() => void voidDraft(item.id)}>إلغاء المسودة</button> : "—"}</td></tr>)}
      </tbody></table></div>}
    </section>}
  </div>;
}
