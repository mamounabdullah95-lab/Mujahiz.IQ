import { type FormEvent, useState } from "react";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button, TextField } from "../components/ui";
import { auth } from "../config/firebase";
import { getEmailActionSettings } from "../config/site";
import {
  passwordRecoveryErrorMessage,
  passwordResetRequestMessage,
  requestPasswordReset,
  type PasswordResetRequestResult,
} from "../services/passwordRecovery";
import type { Locale } from "../types/domain";

type PasswordRecoveryFailure = {
  error: unknown;
};

export function PasswordRecoveryFeedback({
  locale,
  result,
  failure,
}: {
  locale: Locale;
  result: PasswordResetRequestResult["status"] | null;
  failure: PasswordRecoveryFailure | null;
}) {
  if (result) {
    return (
      <div
        className="rounded-xl bg-successBg px-3 py-3 text-sm font-bold leading-6 text-mint"
        dir={locale === "ar" ? "rtl" : "ltr"}
        role="status"
      >
        {passwordResetRequestMessage(locale)}
      </div>
    );
  }

  if (failure) {
    return (
      <div
        className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-3 text-sm font-bold leading-6 text-clay"
        dir={locale === "ar" ? "rtl" : "ltr"}
        role="alert"
      >
        {passwordRecoveryErrorMessage(failure.error, locale, "request")}
      </div>
    );
  }

  return null;
}

export function ForgotPasswordPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PasswordResetRequestResult["status"] | null>(null);
  const [failure, setFailure] = useState<PasswordRecoveryFailure | null>(null);
  const text = locale === "ar" ? {
    title: "استعادة الحساب",
    description: "أدخل بريدك الإلكتروني لطلب رابط آمن لإعادة تعيين كلمة المرور.",
    email: "البريد الإلكتروني",
    emailPlaceholder: "",
    submit: "إرسال رابط إعادة التعيين",
    sending: "جارٍ الإرسال...",
    back: "العودة إلى تسجيل الدخول",
  } : {
    title: "Account recovery",
    description: "Enter your email to request a secure password reset link.",
    email: "Email",
    emailPlaceholder: "name@company.com",
    submit: "Send reset link",
    sending: "Sending...",
    back: "Back to login",
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    setFailure(null);
    try {
      const configuredAuth = auth;
      if (!configuredAuth) throw new Error("password-recovery/unavailable");
      const requestResult = await requestPasswordReset({
        email,
        actionSettings: getEmailActionSettings("/login"),
        sendResetEmail: (normalizedEmail, settings) => sendPasswordResetEmail(configuredAuth, normalizedEmail, settings),
      });
      setResult(requestResult.status);
    } catch (caught) {
      setFailure({ error: caught });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicAuthShell title={text.title} description={text.description}>
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cream text-amber">
          <Mail className="h-7 w-7" aria-hidden="true" />
        </span>
        <TextField
          label={text.email}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={text.emailPlaceholder}
          required
        />
        <PasswordRecoveryFeedback locale={locale} result={result} failure={failure} />
        <Button className="w-full" disabled={busy} type="submit">
          <Send className="h-4 w-4" aria-hidden="true" />
          {busy ? text.sending : text.submit}
        </Button>
        <Link className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-river hover:text-amber" to="/login">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {text.back}
        </Link>
      </form>
    </PublicAuthShell>
  );
}
