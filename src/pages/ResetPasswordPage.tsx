import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, RefreshCw } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button, TextField } from "../components/ui";
import { auth } from "../config/firebase";
import {
  completePasswordReset,
  MINIMUM_PASSWORD_LENGTH,
  passwordRecoveryErrorMessage,
  readPasswordResetAction,
  validatePasswordResetCode,
} from "../services/passwordRecovery";

type ResetPageState = "checking" | "ready" | "error";

export function ResetPasswordPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const location = useLocation();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<ResetPageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const action = useMemo(() => {
    try {
      return readPasswordResetAction(location.search);
    } catch (caught) {
      return { error: caught };
    }
  }, [location.search]);
  const text = locale === "ar" ? {
    title: "تعيين كلمة مرور جديدة",
    description: "تحقق من الرابط، ثم اختر كلمة مرور جديدة لحسابك.",
    checking: "جارٍ التحقق من رابط إعادة التعيين...",
    password: "كلمة المرور الجديدة",
    confirmation: "تأكيد كلمة المرور الجديدة",
    hint: `استخدم ${MINIMUM_PASSWORD_LENGTH} أحرف على الأقل.`,
    submit: "حفظ كلمة المرور الجديدة",
    saving: "جارٍ الحفظ...",
    request: "طلب رابط جديد",
    back: "العودة إلى تسجيل الدخول",
  } : {
    title: "Set a new password",
    description: "We will verify the link before you choose a new password for your account.",
    checking: "Checking the password reset link...",
    password: "New password",
    confirmation: "Confirm new password",
    hint: `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    submit: "Save new password",
    saving: "Saving...",
    request: "Request a new link",
    back: "Back to login",
  };

  useEffect(() => {
    let active = true;
    setPageState("checking");
    setError("");
    const configuredAuth = auth;

    if ("error" in action || !configuredAuth) {
      setError(passwordRecoveryErrorMessage("error" in action ? action.error : null, locale, "validation"));
      setPageState("error");
      return () => {
        active = false;
      };
    }

    void validatePasswordResetCode({
      code: action.code,
      verifyResetCode: (code) => verifyPasswordResetCode(configuredAuth, code),
    }).then(() => {
      if (active) setPageState("ready");
    }).catch((caught) => {
      if (!active) return;
      setError(passwordRecoveryErrorMessage(caught, locale, "validation"));
      setPageState("error");
    });

    return () => {
      active = false;
    };
  }, [action, locale]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const configuredAuth = auth;
    if (busy || pageState !== "ready" || "error" in action || !configuredAuth) return;
    setBusy(true);
    setError("");
    try {
      await completePasswordReset({
        code: action.code,
        password,
        confirmation,
        confirmReset: (code, nextPassword) => confirmPasswordReset(configuredAuth, code, nextPassword),
      });
      setPassword("");
      setConfirmation("");
      navigate("/login", { replace: true, state: { passwordReset: "success" } });
    } catch (caught) {
      setError(passwordRecoveryErrorMessage(caught, locale, "confirmation"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicAuthShell title={text.title} description={text.description}>
      <div className="grid gap-4">
        {pageState === "checking" ? (
          <div className="grid justify-items-center gap-3 py-5 text-center text-sm font-bold text-muted" role="status">
            <RefreshCw className="h-8 w-8 animate-spin text-amber" aria-hidden="true" />
            {text.checking}
          </div>
        ) : null}
        {pageState === "ready" ? (
          <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cream text-amber">
              <KeyRound className="h-7 w-7" aria-hidden="true" />
            </span>
            <TextField
              label={text.password}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={MINIMUM_PASSWORD_LENGTH}
              hint={text.hint}
              required
            />
            <TextField
              label={text.confirmation}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={MINIMUM_PASSWORD_LENGTH}
              required
            />
            {error ? <div className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-3 text-sm font-bold leading-6 text-clay" role="alert">{error}</div> : null}
            <Button className="w-full" disabled={busy} type="submit">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {busy ? text.saving : text.submit}
            </Button>
          </form>
        ) : null}
        {pageState === "error" ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-3 text-sm font-bold leading-6 text-clay" role="alert">{error}</div>
            <Link to="/forgot-password"><Button className="w-full" type="button">{text.request}</Button></Link>
          </div>
        ) : null}
        <Link className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-river hover:text-amber" to="/login">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {text.back}
        </Link>
      </div>
    </PublicAuthShell>
  );
}
