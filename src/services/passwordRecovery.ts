import type { ActionCodeSettings } from "firebase/auth";
import type { Locale } from "../types/domain";

export const MINIMUM_PASSWORD_LENGTH = 8;

export type PasswordResetRequestResult = {
  status: "accepted";
};

function normalizeRecoveryEmail(value: string) {
  const trimmed = value.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex < 1) return trimmed;
  return `${trimmed.slice(0, atIndex)}@${trimmed.slice(atIndex + 1).toLowerCase()}`;
}

function isValidRecoveryEmail(value: string) {
  const normalized = normalizeRecoveryEmail(value);
  if (/\s/.test(normalized) || normalized.length > 254) return false;
  const [local, domain, ...rest] = normalized.split("@");
  return Boolean(
    !rest.length
    && local
    && domain
    && local.length <= 64
    && /^[^<>()[\]\\,;:\s@"]+$/.test(local)
    && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain),
  );
}

type SendResetEmail = (email: string, settings: ActionCodeSettings) => Promise<void>;
type VerifyResetCode = (code: string) => Promise<string>;
type ConfirmReset = (code: string, password: string) => Promise<void>;

function recoveryError(code: string) {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

export function passwordRecoveryErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "");
}

export async function requestPasswordReset({
  email,
  actionSettings,
  sendResetEmail,
}: {
  email: string;
  actionSettings: ActionCodeSettings;
  sendResetEmail: SendResetEmail;
}): Promise<PasswordResetRequestResult> {
  const normalizedEmail = normalizeRecoveryEmail(email);
  if (!isValidRecoveryEmail(normalizedEmail)) {
    throw recoveryError("password-recovery/invalid-email");
  }

  try {
    await sendResetEmail(normalizedEmail, actionSettings);
  } catch (error) {
    // Firebase projects with email-enumeration protection normally resolve unknown
    // addresses. Preserve the same public result for projects that still return this code.
    if (passwordRecoveryErrorCode(error) !== "auth/user-not-found") throw error;
  }

  return { status: "accepted" };
}

export function readPasswordResetAction(search: string) {
  const parameters = new URLSearchParams(search);
  const mode = parameters.get("mode");
  const code = parameters.get("oobCode") || "";
  if (mode !== "resetPassword" || !code) {
    throw recoveryError("password-recovery/invalid-action-link");
  }
  return { code };
}

export async function validatePasswordResetCode({
  code,
  verifyResetCode,
}: {
  code: string;
  verifyResetCode: VerifyResetCode;
}) {
  if (!code) throw recoveryError("password-recovery/invalid-action-link");
  await verifyResetCode(code);
  return { status: "valid" as const };
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw recoveryError("auth/weak-password");
  }
  if (password !== confirmation) {
    throw recoveryError("password-recovery/password-mismatch");
  }
}

export async function completePasswordReset({
  code,
  password,
  confirmation,
  confirmReset,
}: {
  code: string;
  password: string;
  confirmation: string;
  confirmReset: ConfirmReset;
}) {
  validateNewPassword(password, confirmation);
  await confirmReset(code, password);
  return { status: "complete" as const };
}

export function passwordResetRequestMessage(locale: Locale) {
  return locale === "ar"
    ? "إذا كان هناك حساب مرتبط بهذا البريد، فستصلك رسالة لإعادة تعيين كلمة المرور. تحقق من صندوق الوارد ومجلد الرسائل غير المرغوب فيها."
    : "If an account is linked to this email, a password reset message will arrive. Check your inbox and Spam or Junk folder.";
}

export function passwordRecoveryErrorMessage(
  error: unknown,
  locale: Locale,
  phase: "request" | "validation" | "confirmation" = "request",
) {
  const code = passwordRecoveryErrorCode(error);
  const arabic = locale === "ar";
  const messages: Record<string, [string, string]> = {
    "password-recovery/invalid-email": [
      "أدخل بريداً إلكترونياً صالحاً دون مسافات.",
      "Enter a valid email address without spaces.",
    ],
    "password-recovery/invalid-action-link": [
      "رابط إعادة تعيين كلمة المرور غير مكتمل. اطلب رابطاً جديداً.",
      "This password reset link is incomplete. Request a new link.",
    ],
    "password-recovery/password-mismatch": [
      "كلمتا المرور غير متطابقتين.",
      "The passwords do not match.",
    ],
    "auth/weak-password": [
      `كلمة المرور ضعيفة. استخدم ${MINIMUM_PASSWORD_LENGTH} أحرف على الأقل.`,
      `The password is too weak. Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    ],
    "auth/expired-action-code": [
      "انتهت صلاحية رابط إعادة تعيين كلمة المرور. اطلب رابطاً جديداً.",
      "This password reset link has expired. Request a new link.",
    ],
    "auth/too-many-requests": [
      "تم تجاوز عدد المحاولات مؤقتاً. انتظر قليلاً ثم حاول مجدداً.",
      "Too many requests were made. Please wait and try again later.",
    ],
    "auth/network-request-failed": [
      "تعذر الاتصال بالشبكة. تحقق من الاتصال ثم حاول مجدداً.",
      "The network request failed. Check your connection and try again.",
    ],
    "auth/unauthorized-continue-uri": [
      "تعذر إنشاء رابط آمن لإعادة التعيين. تواصل مع دعم المنصة.",
      "A secure reset link could not be created. Contact platform support.",
    ],
    "auth/unauthorized-domain": [
      "نطاق المنصة غير مصرح به لإرسال رابط إعادة التعيين. تواصل مع دعم المنصة.",
      "The platform domain is not authorized to send reset links. Contact platform support.",
    ],
  };

  if (code === "auth/invalid-action-code") {
    if (phase === "confirmation") {
      return arabic
        ? "تم استخدام رابط إعادة تعيين كلمة المرور بالفعل أو لم يعد صالحاً. اطلب رابطاً جديداً."
        : "This password reset link was already used or is no longer valid. Request a new link.";
    }
    return arabic
      ? "رابط إعادة تعيين كلمة المرور غير صالح. ربما تم استخدامه بالفعل. اطلب رابطاً جديداً."
      : "This password reset link is invalid. It may already have been used. Request a new link.";
  }

  const message = messages[code];
  if (message) return arabic ? message[0] : message[1];
  return arabic
    ? "تعذر إكمال عملية إعادة تعيين كلمة المرور الآن. حاول مجدداً."
    : "Password reset could not be completed right now. Please try again.";
}
