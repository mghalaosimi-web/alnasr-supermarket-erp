import { useEffect, useState, type FormEvent } from "react";

type User = { id: string; username: string; displayName: string; roles: string[]; permissions: string[] };
type LoginResult = { token: string; expiresAt: string; user: User };
type Health = { status: string; product: string; database: string; schemaVersion: number };
type Screen = "checking" | "setup" | "login" | "dashboard" | "error";

const modules = [
  ["نقطة البيع", "المبيعات والفواتير والتحصيل"],
  ["المخزون", "الأصناف والأرصدة وحركات المخزون"],
  ["المشتريات", "الموردون وأوامر الشراء والاستلام"],
  ["العملاء", "بيانات العملاء وحساباتهم"],
  ["الموردون", "بيانات الموردين"],
  ["المحاسبة", "الحسابات والقيود والتقارير المالية"]
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void window.alnasr.request<{ setupRequired: boolean }>({ path: "/api/v1/setup/status" })
      .then((response) => {
        if (!active) return;
        if (response.status !== 200) throw new Error("تعذر فحص حالة التهيئة الأولية.");
        setScreen(response.data.setupRequired ? "setup" : "login");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "تعذر الاتصال بالخادم المحلي.");
        setScreen("error");
      });
    return () => { active = false; };
  }, []);

  async function finishLogin(result: LoginResult) {
    setToken(result.token);
    setUser(result.user);
    setPassword("");
    const response = await window.alnasr.request<Health>({ path: "/api/v1/health" });
    if (response.status === 200) setHealth(response.data);
    setScreen("dashboard");
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await window.alnasr.request({
        path: "/api/v1/setup/owner",
        method: "POST",
        body: { username, displayName, password }
      });
      if (created.status !== 201) throw new Error("تعذر إنشاء حساب المالك. تحقق من البيانات.");
      const response = await window.alnasr.request<LoginResult>({
        path: "/api/v1/auth/login",
        method: "POST",
        body: { username, password }
      });
      if (response.status !== 200) throw new Error("تم إنشاء الحساب، لكن تعذر تسجيل الدخول.");
      await finishLogin(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء التهيئة.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await window.alnasr.request<LoginResult>({
        path: "/api/v1/auth/login",
        method: "POST",
        body: { username, password }
      });
      if (response.status !== 200) throw new Error(response.status === 401
        ? "اسم المستخدم أو كلمة المرور غير صحيحة."
        : "تعذر تسجيل الدخول.");
      await finishLogin(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await window.alnasr.request({ path: "/api/v1/auth/logout", method: "POST", token });
    } finally {
      setToken("");
      setUser(null);
      setHealth(null);
      setPassword("");
      setScreen("login");
    }
  }

  if (screen === "checking") return <main className="center"><div className="spinner" /><p>جارٍ تشغيل النظام المحلي...</p></main>;
  if (screen === "error") return (
    <main className="center">
      <section className="auth-card">
        <Brand />
        <div className="error">{error}</div>
        <button className="primary" onClick={() => window.location.reload()}>إعادة المحاولة</button>
      </section>
    </main>
  );

  if (screen === "setup" || screen === "login") {
    const setup = screen === "setup";
    return (
      <main className="auth-layout">
        <section className="auth-aside">
          <Brand />
          <div className="aside-copy">
            <span className="eyebrow">LOCAL-FIRST BUSINESS PLATFORM</span>
            <h1>إدارة أعمالك،<br />من مكان واحد.</h1>
            <p>نظام النصر لإدارة المبيعات والمخزون والمشتريات والحسابات، بقاعدة بيانات محلية تعمل دون اتصال بالإنترنت.</p>
            <div className="online"><i /> قاعدة البيانات المحلية — SQLite</div>
          </div>
          <span className="aside-footer">AL-NASR ERP · WINDOWS EDITION</span>
        </section>
        <section className="auth-main">
          <form className="auth-card" onSubmit={setup ? handleSetup : handleLogin}>
            <span className="eyebrow">{setup ? "INITIAL CONFIGURATION" : "SECURE SIGN IN"}</span>
            <h2>{setup ? "تهيئة النظام لأول مرة" : "مرحباً بعودتك"}</h2>
            <p className="muted">{setup ? "أنشئ حساب المالك الرئيسي لإدارة النظام والصلاحيات." : "سجّل الدخول للمتابعة إلى مساحة العمل."}</p>
            {setup && <label>الاسم الظاهر<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={100} required autoComplete="name" /></label>}
            <label>اسم المستخدم<input value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={40} required autoComplete="username" /></label>
            <label>كلمة المرور<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={setup ? 12 : 1} maxLength={256} required autoComplete={setup ? "new-password" : "current-password"} />{setup && <small>يجب ألا تقل كلمة المرور عن 12 حرفاً.</small>}</label>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" type="submit" disabled={busy}>{busy ? "يرجى الانتظار..." : setup ? "إنشاء حساب المالك" : "تسجيل الدخول"}</button>
            <div className="security-note">جلسة محلية محمية وصلاحيات على مستوى الخادم</div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace" dir="rtl">
      <aside className="sidebar">
        <Brand compact />
        <div className="nav-caption">مساحة العمل</div>
        <div className="nav active">نظرة عامة</div>
        {modules.map(([title]) => <div className="nav disabled" key={title}>{title}</div>)}
        <div className="sidebar-bottom">
          <div className="user"><span className="avatar">{user?.displayName.slice(0, 1) ?? "م"}</span><div><b>{user?.displayName}</b><small>{user?.roles.join("، ")}</small></div></div>
          <button className="logout" onClick={logout}>تسجيل الخروج</button>
        </div>
      </aside>
      <section className="workspace-main">
        <header className="topbar">
          <div><span className="eyebrow">AL-NASR ERP / WORKSPACE</span><h1>نظرة عامة</h1></div>
          <div className="online status"><i /> يعمل محلياً دون إنترنت</div>
        </header>
        <section className="welcome">
          <div><span className="eyebrow">WINDOWS EDITION</span><h2>أهلاً بك، {user?.displayName}</h2><p>تم تسجيل الدخول بنجاح إلى قاعدة بيانات النظام المحلية.</p></div>
          <div className="welcome-mark">N</div>
        </section>
        <div className="section-heading"><h2>وحدات النظام</h2><p>يجري تجهيز الوحدات وربطها بواجهة سطح المكتب.</p></div>
        <div className="module-grid">
          {modules.map(([title, description], index) => <article className="module-card" key={title}>
            <span className="module-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3><p>{description}</p><span className="module-state">قيد التنفيذ</span>
          </article>)}
        </div>
        <section className="system-panel">
          <div><h3>حالة النظام المحلي</h3><p>الخادم وقاعدة البيانات يعملان على هذا الجهاز.</p></div>
          <div className="facts">
            <div><small>الخادم</small><b>Fastify · 127.0.0.1</b></div>
            <div><small>قاعدة البيانات</small><b>{health?.database?.toUpperCase() ?? "SQLITE"}</b></div>
            <div><small>إصدار المخطط</small><b>{health?.schemaVersion ?? 4}</b></div>
          </div>
        </section>
        <footer>AL-NASR ERP · جميع البيانات محفوظة محلياً على جهازك</footer>
      </section>
    </main>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "brand compact" : "brand"}>
    <span className="brand-mark">N</span>
    <span><strong>النصر</strong><small>AL-NASR ERP</small></span>
  </div>;
}