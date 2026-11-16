import { useCallback, useEffect, useState } from "react";
type Account = { id: string; code: string; name_ar: string; name_en: string | null; account_type: string; normal_balance: "debit" | "credit"; is_active: number };
type TrialBalance = { asOf: string; items: Array<Account & { debitMinor: number; creditMinor: number; debitBalanceMinor: number; creditBalanceMinor: number }>; totals: { debitMinor: number; creditMinor: number; debitMovementsMinor: number; creditMovementsMinor: number } };
type JournalLine = { account_code: string; account_name: string; debit_minor: number; credit_minor: number; description: string | null };
type Journal = { id: string; entry_no: string; source_type: string | null; description: string; entry_date: string; status: string; lines: JournalLine[] };
type Props = { token: string; canRead: boolean };

export default function AccountingView({ token, canRead }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trial, setTrial] = useState<TrialBalance | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async (date: string) => {
    setLoading(true); setError("");
    try {
      const [accountResponse, trialResponse, journalResponse] = await Promise.all([
        window.alnasr.request<{ items: Account[] }>({ path: "/api/v1/accounting/accounts", token }),
        window.alnasr.request<TrialBalance>({ path: `/api/v1/accounting/trial-balance?asOf=${encodeURIComponent(date)}`, token }),
        window.alnasr.request<{ items: Journal[] }>({ path: "/api/v1/accounting/journals?limit=100&offset=0", token })
      ]);
      if (accountResponse.status !== 200 || trialResponse.status !== 200 || journalResponse.status !== 200) throw new Error("تعذر تحميل السجلات المحاسبية. تحقق من صلاحية الحساب.");
      setAccounts(accountResponse.data.items); setTrial(trialResponse.data); setJournals(journalResponse.data.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل المحاسبة."); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { if (canRead) void refresh(asOf); else setLoading(false); }, [canRead, refresh]);
  const money = (value: number) => new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(value);
  if (!canRead) return <div className="error">لا يملك حسابك صلاحية قراءة السجلات المحاسبية.</div>;
  return <>
    <div className="list-toolbar"><div><h2>المحاسبة والقيد المزدوج</h2><p>دليل الحسابات، القيود الآلية، وميزان المراجعة من الحركات المرحلة.</p></div>
      <label>حتى تاريخ <input type="date" value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
      <button className="secondary-button" disabled={loading} onClick={() => void refresh(asOf)}>تحديث التقرير</button>
    </div>
    {error && <div className="error page-error" role="alert">{error}</div>}
    {loading ? <section className="data-panel"><div className="empty-state">جارٍ تحميل البيانات المحاسبية...</div></section> : trial && <>
      <section className="data-panel accounting-summary"><div className="facts">
        <div><small>إجمالي أرصدة المدين</small><b>{money(trial.totals.debitMinor)}</b></div>
        <div><small>إجمالي أرصدة الدائن</small><b>{money(trial.totals.creditMinor)}</b></div>
        <div><small>حركة المدين</small><b>{money(trial.totals.debitMovementsMinor)}</b></div>
        <div><small>حركة الدائن</small><b>{money(trial.totals.creditMovementsMinor)}</b></div>
      </div><p className={trial.totals.debitMinor === trial.totals.creditMinor ? "success-note" : "error"}>{trial.totals.debitMinor === trial.totals.creditMinor ? "ميزان المراجعة متوازن حسب القيود المرحلة." : "تنبيه: يوجد فرق في ميزان المراجعة؛ يلزم التحقيق قبل اعتماد التقارير."}</p></section>
      <div className="section-heading"><h2>ميزان المراجعة</h2><p>الأرصدة حتى {trial.asOf} · جميع المبالغ بالوحدة الصغرى.</p></div>
      <section className="data-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>التصنيف</th><th>إجمالي المدين</th><th>إجمالي الدائن</th><th>رصيد مدين</th><th>رصيد دائن</th></tr></thead><tbody>
        {trial.items.map(item => <tr key={item.id}><td dir="ltr">{item.code}</td><td>{item.name_ar}</td><td>{item.account_type}</td><td>{money(item.debitMinor)}</td><td>{money(item.creditMinor)}</td><td>{money(item.debitBalanceMinor)}</td><td>{money(item.creditBalanceMinor)}</td></tr>)}
      </tbody></table></div></section>
      <div className="section-heading"><h2>دليل الحسابات</h2><p>الحسابات الأساسية المعرفة للنظام.</p></div>
      <section className="data-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>الرمز</th><th>الحساب</th><th>النوع</th><th>الرصيد الطبيعي</th><th>الحالة</th></tr></thead><tbody>
        {accounts.map(account => <tr key={account.id}><td dir="ltr">{account.code}</td><td>{account.name_ar}</td><td>{account.account_type}</td><td>{account.normal_balance === "debit" ? "مدين" : "دائن"}</td><td>{account.is_active ? "نشط" : "معطل"}</td></tr>)}
      </tbody></table></div></section>
      <div className="section-heading"><h2>دفتر اليومية</h2><p>آخر 100 قيد محاسبي مرحّل، مع تفاصيل أطراف القيد.</p></div>
      <section className="data-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>المصدر</th><th>تفاصيل القيد</th></tr></thead><tbody>
        {journals.map(entry => <tr key={entry.id}><td dir="ltr">{entry.entry_no}</td><td dir="ltr">{entry.entry_date}</td><td>{entry.description}</td><td>{entry.source_type ?? "—"}</td><td><details><summary>عرض {entry.lines.length} سطور</summary><table className="data-table"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody>{entry.lines.map((line, index) => <tr key={`${entry.id}-${index}`}><td>{line.account_code} · {line.account_name}</td><td>{money(line.debit_minor)}</td><td>{money(line.credit_minor)}</td></tr>)}</tbody></table></details></td></tr>)}
      </tbody></table></div>{journals.length === 0 && <div className="empty-state">لا توجد قيود مرحلة بعد. ستظهر القيود تلقائياً عند ترحيل المبيعات والمشتريات والتحصيلات.</div>}</section>
    </>}
  </>;
}