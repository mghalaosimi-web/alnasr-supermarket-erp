import { useEffect, useState } from "react";

type Health = { app: string; status: string; database: string };

declare global {
  interface Window {
    alnasr: {
      health: () => Promise<Health>;
    };
  }
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.alnasr.health()
      .then(setHealth)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "تعذر فحص النظام"));
  }, []);

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
            <strong>{error ? "تعذر الاتصال بقاعدة البيانات" : health ? "محرك النظام يعمل" : "جارٍ فحص محرك النظام..."}</strong>
            <p>{error ?? (health ? `SQLite: ${health.database} · التطبيق: ${health.status}` : "يتم التحقق من الاتصال المحلي")}</p>
          </div>
        </div>
      </section>
      <section className="modules">
        <h2>وحدات النظام</h2>
        <div className="module-grid">
          {["نقطة البيع", "المنتجات والباركود", "المخزون والمستودعات", "المشتريات والموردون", "العملاء", "الحسابات والتقارير"].map((name) => (
            <article className="module-card" key={name}>
              <span className="module-dot" />
              <strong>{name}</strong>
              <small>سيتم تفعيل الوحدة ضمن مراحل التنفيذ والاختبار</small>
            </article>
          ))}
        </div>
      </section>
      <footer>AL-NASR · يعمل محلياً على هذا الجهاز</footer>
    </main>
  );
}
