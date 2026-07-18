import { CheckCircle2, LogOut, MailCheck, RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  verificationErrorMessage,
} from "../services/emailVerification";
import { portalHome } from "../utils/authorization";

export function VerifyEmailPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, appUser, emailVerified, sendVerification, refreshEmailVerification, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const text = locale === "ar" ? {
    title: "فعّل بريدك الإلكتروني",
    description: "أرسلنا رسالة تفعيل إلى بريدك. افتح الرابط، ثم عد إلى هذه الصفحة لتحديث الحالة.",
    sent: "تم إرسال رسالة تفعيل جديدة.",
    alreadyVerified: "البريد مفعّل بالفعل، وتمت مزامنة حالة الحساب.",
    resend: "إعادة إرسال رسالة التفعيل",
    refresh: "تحقق من حالة التفعيل",
    buyerSuccess: "تم تفعيل البريد بنجاح، وبدأت فترة الوصول المجانية للمشتري.",
    supplierSuccess: "تم تفعيل البريد ومزامنة حساب المجهز بنجاح.",
    adminSuccess: "تم تفعيل البريد ومزامنة الحساب الإداري بنجاح.",
    waiting: "لم يظهر التفعيل بعد. افتح الرابط في بريدك ثم حاول مجدداً.",
    logout: "تسجيل الخروج",
  } : {
    title: "Verify your email",
    description: "A verification email was sent to your address. Open the link, then return here to refresh your status.",
    sent: "A new verification email was sent.",
    alreadyVerified: "Your email is already verified and the account state is synchronized.",
    resend: "Resend verification email",
    refresh: "Refresh verification status",
    buyerSuccess: "Your email is verified and the buyer free-access period has started.",
    supplierSuccess: "Your email and supplier account are now verified.",
    adminSuccess: "Your email and administrative account are now synchronized.",
    waiting: "Verification is not visible yet. Open the email link and try again.",
    logout: "Logout",
  };
  const successMessage = appUser?.role === "admin" || appUser?.role === "owner"
    ? text.adminSuccess
    : appUser?.accountType === "buyer"
      ? text.buyerSuccess
      : text.supplierSuccess;
  useEffect(() => { if (emailVerified && appUser) navigate(portalHome(appUser), { replace: true }); }, [emailVerified, appUser, navigate]);
  useEffect(() => { if (!cooldown) return; const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [cooldown]);
  async function resend() {
    if (cooldown) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await sendVerification();
      setMessage(result === "sent" ? text.sent : text.alreadyVerified);
      if (result === "sent") setCooldown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      setError(verificationErrorMessage(caught, locale));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const verified = await refreshEmailVerification();
      setMessage(verified ? successMessage : text.waiting);
    } catch (caught) {
      setError(verificationErrorMessage(caught, locale));
    } finally {
      setBusy(false);
    }
  }
  if (!firebaseUser) return null;
  return <PublicAuthShell title={text.title} description={text.description}><div className="grid gap-4 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cream text-amber"><MailCheck className="h-8 w-8" /></span><div className="rounded-xl border border-borderSoft bg-white p-3 text-sm font-black text-ink">{firebaseUser.email}</div>{message ? <div className="flex items-center gap-2 rounded-xl bg-successBg p-3 text-sm font-bold text-mint"><CheckCircle2 className="h-5 w-5" />{message}</div> : null}{error ? <div className="rounded-xl bg-clay/10 p-3 text-sm font-bold text-clay">{error}</div> : null}<Button disabled={busy} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />{text.refresh}</Button><Button variant="secondary" disabled={busy || cooldown > 0} onClick={() => void resend()}><Send className="h-4 w-4" />{cooldown ? `${text.resend} (${cooldown})` : text.resend}</Button><Button variant="ghost" onClick={() => void logout().then(() => navigate("/login"))}><LogOut className="h-4 w-4" />{text.logout}</Button></div></PublicAuthShell>;
}
