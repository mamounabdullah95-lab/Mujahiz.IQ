import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button, TextField } from "../components/ui";

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  const passwordResetComplete = (location.state as { passwordReset?: string } | null)?.passwordReset === "success";
  const resetSuccessMessage = locale === "ar"
    ? "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن."
    : "Your password was changed successfully. You can now log in.";

  return (
    <PublicAuthShell title={t("login")} description={t("loginDescription")}>
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <TextField label={t("email")} value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" required />
        <TextField label={t("password")} value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={t("loginPasswordPlaceholder")} required />
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-ink/70">
          <label className="inline-flex items-center gap-2">
            <input className="h-4 w-4 accent-amber" type="checkbox" />
            {t("rememberMe")}
          </label>
          <Link className="inline-flex items-center gap-1 text-river hover:text-amber" to="/forgot-password">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {t("forgotPassword")}
          </Link>
        </div>
        {passwordResetComplete ? <div className="rounded-xl bg-successBg px-3 py-2 text-sm font-bold text-mint" role="status">{resetSuccessMessage}</div> : null}
        {error ? <div className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-bold text-clay">{error}</div> : null}
        <Button className="w-full" disabled={busy} type="submit">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {t("login")}
        </Button>
        <div className="flex items-center justify-center gap-4 border-t border-borderSoft pt-4 text-sm font-bold">
          <span className="text-muted">{t("noAccount")}</span>
          <Link className="inline-flex items-center gap-1 text-amber hover:text-ink" to="/register">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("register")}
          </Link>
        </div>
      </form>
    </PublicAuthShell>
  );
}
