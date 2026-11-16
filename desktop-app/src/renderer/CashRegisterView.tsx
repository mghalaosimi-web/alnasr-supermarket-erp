import { useCallback, useEffect, useState } from "react";

type Store = { id: string; name: string; currency_code?: string };
type Session = { id: string; opening_float_minor: number; opened_at: string; status: "open" | "closed" };
type Movement = { id: string; direction: "in" | "out"; movement_type: string; amount_minor: number; description: string; created_at: string };
type RegisterStatus = { store: Store; session: Session | null; totals: { openingFloatMinor: number; inflowMinor: number; outflowMinor: number; expectedCashMinor: number; movementCount: number } | null; items: Movement[] };
type HistorySession = { id: string; status: "open" | "closed"; opening_float_minor: number; expected_cash_minor: number | null; counted_cash_minor: number | null; variance_minor: number | null; opened_at: string; closed_at: string | null; opened_by_name: string; closed_by_name: string | null; inflow_minor: number; outflow_minor: number; movement_count: number };
type Props = { token: string; canManage: boolean };

export default function CashRegisterView({ token, canManage }: Props) {
  const [store, setStore] = useState<Store | null>(null);
  const [status, setStatus] = useState<RegisterStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState("0");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(async (storeId: string) => {
    const [response, historyResponse] = await Promise.all([
      window.alnasr.request<RegisterStatus>({ path: `/api/v1/cash/register?storeId=${encodeURIComponent(storeId)}`, token }),
      window.alnasr.request<{ items: HistorySession[] }>({ path: `/api/v1/cash/register/sessions?storeId=${encodeURIComponent(storeId)}&limit=50`, token })
    ]);
    if (response.status !== 200 || historyResponse.status !== 200) throw new Error("تعذر تحميل حالة الصندوق وسجل الورديات. تحقق من صلاحية العرض.");
    setStatus(response.data);
    setHistory(historyResponse.data.items);
    setStore(response.data.store);
    if (response.data.totals) setCounted(String(response.data.totals.expectedCashMinor));
  }, [token]);

  useEffect(() => {
    let active = true;
    void window.alnasr.request<{ stores: Store[] }>({ path: "/api/v1/locations", token })
      .then(async response => {
        if (response.status !== 200 || !response.data.stores[0]) throw new Error("لا يوجد متجر نشط لربط الصندوق به.");
        const selected = response.data.stores[0];
        if (!active) return;
        await refresh(selected.id);
      }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل الصندوق."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refresh]);

  async function runAction(path: string, body: Record<string, unknown>, success: string) {
    if (!store) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await window.alnasr.request<{ message?: string; varianceMinor?: number }>({ path, method: "POST", token, body });
      if (response.status !== 200 && response.status !== 201) throw new Error(response.data.message ?? "رفض الخادم العملية.");
      setNotice(success);
      await refresh(store.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تنفيذ العملية."); }
    finally { setBusy(false); }
  }

  const money = (value: number) => new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(value);
  if (loading) return <section className="data-panel"><div className="empty-state">جارٍ تحميل الصندوق...</div></section>;
  return <>
    <div className="list-toolbar"><div><h2>الصندوق والورديات</h2><p>إدارة العهدة النقدية، المقبوضات والمدفوعات، وإقفال الوردية بفارق الجرد الفعلي.</p></div></div>
    {error && <div className="error page-error" role="alert">{error}</div>}
    {notice && <div className="success-note" role="status">{notice}</div>}
    {!canManage && <div className="error">حسابك يملك صلاحية العرض فقط. اطلب من المدير منح صلاحية إدارة الصندوق لتنفيذ الحركات.</div>}
    {store && status && <section className="data-panel cash-panel">
      <div className="section-heading"><h2>{store.name}</h2><p>{status.session ? `وردية مفتوحة منذ ${new Date(status.session.opened_at).toLocaleString("ar-YE")}` : "لا توجد وردية مفتوحة حالياً."}</p></div>
      {!status.session ? <div className="record-form">
        <label>العهدة الافتتاحية<input type="number" min="0" step="1" value={opening} onChange={event => setOpening(event.target.value)} /></label>
        <div className="form-actions"><button className="primary action-button" disabled={!canManage || busy || !Number.isSafeInteger(Number(opening)) || Number(opening) < 0} onClick={() => void runAction("/api/v1/cash/register/open", { storeId: store.id, openingFloatMinor: Number(opening) }, "تم فتح الوردية بنجاح.")}>{busy ? "جارٍ التنفيذ..." : "فتح وردية جديدة"}</button></div>
      </div> : <>
        <div className="facts cash-facts">
          <div><small>العهدة الافتتاحية</small><b>{money(status.totals?.openingFloatMinor ?? 0)}</b></div>
          <div><small>إجمالي المقبوضات</small><b>{money(status.totals?.inflowMinor ?? 0)}</b></div>
          <div><small>إجمالي المدفوعات</small><b>{money(status.totals?.outflowMinor ?? 0)}</b></div>
          <div><small>النقد المتوقع بالصندوق</small><b>{money(status.totals?.expectedCashMinor ?? 0)}</b></div>
        </div>
        <div className="record-form cash-forms">
          <label>نوع الحركة<select value={direction} onChange={event => setDirection(event.target.value as "in" | "out")}><option value="in">إيداع / زيادة نقدية</option><option value="out">مصروف / سحب نقدي</option></select></label>
          <label>المبلغ بالوحدة الصغرى<input type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label>
          <label>البيان<input value={description} onChange={event => setDescription(event.target.value)} minLength={3} maxLength={240} /></label>
          <div className="form-actions"><button className="secondary-button" disabled={!canManage || busy || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || description.trim().length < 3} onClick={() => void runAction("/api/v1/cash/register/movements", { storeId: store.id, direction, amountMinor: Number(amount), description, idempotencyKey: crypto.randomUUID() }, "تم تسجيل الحركة النقدية.")}>تسجيل الحركة</button></div>
        </div>
        <div className="record-form cash-forms">
          <label>النقد الفعلي بعد الجرد<input type="number" min="0" step="1" value={counted} onChange={event => setCounted(event.target.value)} /></label>
          <div className="form-actions"><button className="primary action-button" disabled={!canManage || busy || !Number.isSafeInteger(Number(counted)) || Number(counted) < 0} onClick={() => { if (window.confirm("سيتم إقفال الوردية نهائياً وتسجيل فرق الجرد. هل تريد المتابعة؟")) void runAction("/api/v1/cash/register/close", { storeId: store.id, countedCashMinor: Number(counted) }, "تم إقفال الوردية وحفظ فرق الجرد."); }}>{busy ? "جارٍ الإقفال..." : "إقفال الوردية"}</button></div>
        </div>
      </>}
      <div className="section-heading"><h2>حركات الوردية</h2><p>يتم ترحيل التحصيلات النقدية من المبيعات والمدفوعات النقدية للموردين تلقائياً.</p></div>
      {!status.items.length ? <div className="empty-state">لا توجد حركات في الوردية الحالية.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>البيان</th><th>داخل</th><th>خارج</th></tr></thead><tbody>{status.items.map(item => <tr key={item.id}><td dir="ltr">{new Date(item.created_at).toLocaleString("ar-YE")}</td><td>{item.movement_type === "sale_receipt" ? "تحصيل مبيعات" : item.movement_type === "purchase_payment" ? "سداد مورد" : item.movement_type === "manual_in" ? "إيداع" : "مصروف"}</td><td>{item.description}</td><td>{item.direction === "in" ? money(item.amount_minor) : "—"}</td><td>{item.direction === "out" ? money(item.amount_minor) : "—"}</td></tr>)}</tbody></table></div>}
    </section>}
    {store && status && <section className="data-panel">
      <div className="section-heading"><h2>سجل الورديات السابقة</h2><p>آخر 50 وردية مع إجماليات الحركات ونتيجة الجرد والإقفال.</p></div>
      {!history.length ? <div className="empty-state">لا توجد ورديات مسجلة بعد.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>بداية الوردية</th><th>الإقفال</th><th>المستخدم</th><th>العهدة</th><th>المقبوضات</th><th>المدفوعات</th><th>المتوقع</th><th>المعدود</th><th>الفرق</th><th>الحالة</th></tr></thead><tbody>
        {history.map(item => <tr key={item.id}><td dir="ltr">{new Date(item.opened_at).toLocaleString("ar-YE")}</td><td dir="ltr">{item.closed_at ? new Date(item.closed_at).toLocaleString("ar-YE") : "—"}</td><td>{item.opened_by_name}</td><td>{money(item.opening_float_minor)}</td><td>{money(item.inflow_minor)}</td><td>{money(item.outflow_minor)}</td><td>{item.expected_cash_minor == null ? "—" : money(item.expected_cash_minor)}</td><td>{item.counted_cash_minor == null ? "—" : money(item.counted_cash_minor)}</td><td>{item.variance_minor == null ? "—" : money(item.variance_minor)}</td><td>{item.status === "open" ? "مفتوحة" : "مغلقة"}</td></tr>)}
      </tbody></table></div>}
    </section>}
  </>;
}