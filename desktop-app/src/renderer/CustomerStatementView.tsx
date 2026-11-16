import { useEffect, useState } from "react";

type Customer = { id: string; code: string; name: string; phone: string | null; credit_limit_minor: number; is_active: number };
type StatementItem = {
  id: string;
  entryType: "sale" | "payment" | "return";
  documentNo: string;
  reference: string | null;
  method: string | null;
  createdAt: string;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
};
type Statement = {
  customer: Customer;
  summary: { salesMinor: number; paymentsMinor: number; returnsMinor: number; outstandingMinor: number };
  items: StatementItem[];
  pagination: { limit: number; offset: number };
};
type Props = { token: string; customer: Customer; onClose: () => void };

export default function CustomerStatementView({ token, customer, onClose }: Props) {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void window.alnasr.request<Statement>({
      path: `/api/v1/customers/${customer.id}/statement?limit=50&offset=${offset}`, token
    }).then(response => {
      if (!active) return;
      if (response.status !== 200) throw new Error("تعذر تحميل كشف حساب العميل.");
      setStatement(response.data);
    }).catch(cause => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تحميل الكشف.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer.id, token, offset]);

  return (
    <section className="data-panel">
      <div className="list-toolbar">
        <div><h2>كشف حساب العميل: {customer.name}</h2><p>الرمز {customer.code} · الفواتير والدفعات والمرتجعات المرحلة فقط.</p></div>
        <button className="secondary-button" onClick={onClose}>إغلاق الكشف</button>
      </div>
      {error && <div className="error page-error" role="alert">{error}</div>}
      {loading ? <div className="empty-state">جارٍ تحميل كشف الحساب...</div> : statement && <>
        <div className="facts">
          <div><small>إجمالي المبيعات</small><b>{formatMinor(statement.summary.salesMinor)}</b></div>
          <div><small>الدفعات المستلمة</small><b>{formatMinor(statement.summary.paymentsMinor)}</b></div>
          <div><small>مرتجعات المبيعات</small><b>{formatMinor(statement.summary.returnsMinor)}</b></div>
          <div><small>الرصيد (السالب رصيد دائن للعميل)</small><b>{formatMinor(statement.summary.outstandingMinor)}</b></div>
        </div>
        {statement.items.length === 0 ? <div className="empty-state">لا توجد حركات مالية مرحلة لهذا العميل.</div> : <div className="table-scroll">
          <table className="data-table"><thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>رقم المستند</th><th>المرجع / الطريقة</th><th>مدين</th><th>دائن</th><th>الرصيد التراكمي</th></tr></thead>
            <tbody>{statement.items.map(item => <tr key={item.id}>
              <td dir="ltr">{new Date(item.createdAt).toLocaleString("ar-YE")}</td>
              <td>{item.entryType === "sale" ? "فاتورة بيع" : item.entryType === "payment" ? "تحصيل من العميل" : "مرتجع مبيعات"}</td>
              <td dir="ltr">{item.documentNo}</td>
              <td>{item.reference ?? item.method ?? "—"}</td>
              <td>{formatMinor(item.debitMinor)}</td><td>{formatMinor(item.creditMinor)}</td><td><strong>{formatMinor(item.balanceMinor)}</strong></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="form-actions">
          <button className="secondary-button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>السابق</button>
          <span className="muted">عرض الحركات · {offset + 1}–{offset + statement.items.length}</span>
          <button className="secondary-button" disabled={statement.items.length < 50} onClick={() => setOffset(value => value + 50)}>التالي</button>
        </div>
      </>}
    </section>
  );
}

function formatMinor(value: number): string {
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(value);
}
