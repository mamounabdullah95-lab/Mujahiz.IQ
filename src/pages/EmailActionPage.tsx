import { ArrowLeft, CheckCircle2, MailCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button } from "../components/ui";
import { auth } from "../config/firebase";
import {
  buildResetPasswordSearch,
  completeEmailAction,
  emailActionErrorState,
  parseEmailAction,
  type EmailActionState,
} from "../services/emailActions";

export function EmailActionPage() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const fallbackLocale = useRef(i18n.language.startsWith("ar") ? "ar" as const : "en" as const).current;
  const completion = useRef<Promise<EmailActionState> | null>(null);
  const action = useMemo(() => {
    try {
      return parseEmailAction(location.search, fallbackLocale);
    } catch (error) {
      return { error };
    }
  }, [fallbackLocale, location.search]);
  const locale = "error" in action ? fallbackLocale : action.locale;
  const [state, setState] = useState<"checking" | EmailActionState>("checking");

  const text = locale === "ar" ? {
    title: "إجراء آمن للبريد الإلكتروني",
    description: "نتحقق من رابط فايربيس وننفذ الإجراء المطلوب بأمان.",
    checking: "جارٍ التحقق من الرابط...",
    verifySuccess: "تم التحقق من البريد الإلكتروني بنجاح. ستتم مزامنة حالة الحساب بعد تسجيل الدخول أو تحديث حالة التحقق.",
    recoverSuccess: "تمت استعادة عنوان البريد الإلكتروني السابق للحساب بنجاح.",
    invalid: "هذا الرابط غير صالح أو تم استخدامه بالفعل. اطلب رسالة جديدة ثم حاول مجدداً.",
    expired: "انتهت صلاحية هذا الرابط. اطلب رسالة جديدة ثم حاول مجدداً.",
    used: "تم استخدام هذا الرابط بالفعل ولم يعد صالحاً.",
    unavailable: "تعذر إكمال الإجراء الآن. تحقق من الاتصال ثم حاول مجدداً.",
    continue: "المتابعة بأمان",
    login: "العودة إلى تسجيل الدخول",
  } : {
    title: "Secure email action",
    description: "We are checking the Firebase link and safely completing the requested action.",
    checking: "Checking the link...",
    verifySuccess: "Your email was verified successfully. Account state will synchronize after sign-in or a verification refresh.",
    recoverSuccess: "The account's previous email address was restored successfully.",
    invalid: "This link is invalid or has already been used. Request a new email and try again.",
    expired: "This link has expired. Request a new email and try again.",
    used: "This link has already been used and is no longer valid.",
    unavailable: "The action could not be completed right now. Check your connection and try again.",
    continue: "Continue safely",
    login: "Back to login",
  };

  useEffect(() => {
    let active = true;

    if ("error" in action) {
      setState(emailActionErrorState(action.error));
      return () => {
        active = false;
      };
    }

    if (i18n.language !== action.locale) void i18n.changeLanguage(action.locale);

    if (action.mode === "resetPassword") {
      navigate(`/reset-password${buildResetPasswordSearch(action)}`, { replace: true });
      return () => {
        active = false;
      };
    }

    const configuredAuth = auth;
    if (!configuredAuth) {
      setState("unavailable");
      return () => {
        active = false;
      };
    }

    configuredAuth.languageCode = action.locale;
    setState("checking");
    const pending = completion.current || completeEmailAction({
      action,
      checkCode: (code) => checkActionCode(configuredAuth, code),
      applyCode: (code) => applyActionCode(configuredAuth, code),
    });
    completion.current = pending;
    void pending.then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
    };
  }, [action, i18n, navigate]);

  const isSuccess = state === "success" && !("error" in action);
  const message = isSuccess
    ? action.mode === "recoverEmail" ? text.recoverSuccess : text.verifySuccess
    : state === "expired" ? text.expired
      : state === "used" ? text.used
        : state === "unavailable" ? text.unavailable
          : text.invalid;
  const continuePath = "error" in action ? "/login" : action.continuePath;

  return (
    <PublicAuthShell title={text.title} description={text.description}>
      <div className="grid gap-4 text-center" dir={locale === "ar" ? "rtl" : "ltr"}>
        {state === "checking" ? (
          <div className="grid justify-items-center gap-3 py-5 text-sm font-bold text-muted" role="status">
            <RefreshCw className="h-8 w-8 animate-spin text-amber" aria-hidden="true" />
            {text.checking}
          </div>
        ) : (
          <>
            <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${isSuccess ? "bg-successBg text-mint" : "bg-clay/10 text-clay"}`}>
              {isSuccess ? <MailCheck className="h-8 w-8" aria-hidden="true" /> : <ShieldAlert className="h-8 w-8" aria-hidden="true" />}
            </span>
            <div
              className={`rounded-xl px-3 py-3 text-sm font-bold leading-6 ${isSuccess ? "bg-successBg text-mint" : "border border-clay/30 bg-clay/10 text-clay"}`}
              role={isSuccess ? "status" : "alert"}
            >
              {isSuccess ? <CheckCircle2 className="me-2 inline h-5 w-5" aria-hidden="true" /> : null}
              {message}
            </div>
            {isSuccess ? (
              <Link to={continuePath}><Button className="w-full" type="button">{text.continue}</Button></Link>
            ) : null}
          </>
        )}
        <Link className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-river hover:text-amber" to="/login">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {text.login}
        </Link>
      </div>
    </PublicAuthShell>
  );
}
