import { FormEvent, useEffect, useState } from "react";

type Health = { app: string; status: string; database: string };
type PublicUser = { id: string; username: string; displayName: string };
type OwnerSetupInput = { username: string; displayName: string; password: string };

declare global {
  interface Window {
    alnasr: {
      health: () => Promise<Health>;
      setupStatus: () => Promise<{ ownerSetupRequired: boolean }>;
      bootstrapOwner: (input: OwnerSetupInput) => Promise<PublicUser>;
      login: (input: { username: string; password: string }) => Promise<PublicUser>;
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
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إتمام العملية");
    } finally {
      setBusy(false);
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
            <button className="secondary-button" onClick={() => setUser(null)}>تسجيل الخروج</button>
          </div>
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
