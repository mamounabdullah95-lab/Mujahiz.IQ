import type { ActionCodeSettings, User } from "firebase/auth";
import type { Locale } from "../types/domain";

export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export type VerificationResendResult = "sent" | "already_verified";

interface VerificationBaseDependencies {
  user: User;
  getCurrentUser: () => User | null;
  synchronize: (uid: string) => Promise<void>;
}

interface VerificationResendDependencies extends VerificationBaseDependencies {
  actionSettings: ActionCodeSettings;
  sendEmail: (user: User, settings: ActionCodeSettings) => Promise<void>;
  cooldowns?: Map<string, number>;
  now?: () => number;
}

const defaultCooldowns = new Map<string, number>();
const synchronizationInFlight = new Map<string, Promise<void>>();

function verificationError(code: string, retryAfterSeconds?: number) {
  const error = new Error(code) as Error & { code: string; retryAfterSeconds?: number };
  error.code = code;
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function refreshedUser(user: User, getCurrentUser: () => User | null) {
  const current = getCurrentUser() || user;
  if (current.uid !== user.uid) throw verificationError("auth/user-mismatch");
  return current;
}

export function verificationErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "");
}

export function verificationErrorMessage(error: unknown, locale: Locale) {
  const code = verificationErrorCode(error);
  const arabic = locale === "ar";
  const messages: Record<string, [string, string]> = {
    "verification/resend-cooldown": ["يرجى الانتظار قليلاً قبل إعادة الإرسال.", "Please wait before requesting another email."],
    "auth/expired-action-code": ["انتهت صلاحية رابط التفعيل. أعد إرسال رسالة جديدة.", "This verification link has expired. Request a new email."],
    "auth/invalid-action-code": ["رابط التفعيل غير صالح. أعد إرسال رسالة جديدة.", "This verification link is invalid. Request a new email."],
    "auth/user-disabled": ["هذا الحساب معطّل. تواصل مع إدارة المنصة.", "This account is disabled. Contact platform support."],
    "auth/user-not-found": ["لم يعد الحساب موجوداً. سجّل الخروج ثم حاول مجدداً.", "This account no longer exists. Sign out and try again."],
    "auth/user-token-expired": ["انتهت جلسة الدخول. سجّل الدخول مجدداً.", "Your session expired. Sign in again."],
    "auth/invalid-user-token": ["جلسة الدخول غير صالحة. سجّل الدخول مجدداً.", "Your session is invalid. Sign in again."],
    "auth/too-many-requests": ["تم تجاوز عدد المحاولات مؤقتاً. حاول لاحقاً.", "Too many requests. Please try again later."],
    "auth/network-request-failed": ["تعذر الاتصال بالشبكة. تحقق من الاتصال ثم حاول مجدداً.", "Network request failed. Check your connection and try again."],
    "auth/unauthorized-continue-uri": ["رابط المتابعة غير مصرح به. تواصل مع إدارة المنصة.", "The verification continuation URL is not authorized."],
    "auth/unauthorized-domain": ["نطاق المنصة غير مصرح به لإرسال التفعيل.", "The platform domain is not authorized for verification."],
    "permission-denied": ["تم تفعيل البريد، لكن تعذرت مزامنة الحساب. حاول مجدداً.", "Your email is verified, but account synchronization failed. Try again."],
    "profile_setup_incomplete": ["ملف الحساب غير مكتمل. أكمل بيانات الحساب أولاً.", "Your account profile is incomplete. Complete it first."],
  };
  const message = messages[code];
  if (message) return arabic ? message[0] : message[1];
  return arabic
    ? "تعذر إكمال عملية التفعيل الآن. حاول مجدداً."
    : "Verification could not be completed. Please try again.";
}

export function getVerificationResendCooldown(
  uid: string,
  now = Date.now(),
  cooldowns = defaultCooldowns,
) {
  const remainingMs = (cooldowns.get(uid) || 0) - now;
  if (remainingMs <= 0) {
    cooldowns.delete(uid);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export function synchronizeVerifiedProfile(
  uid: string,
  synchronize: (uid: string) => Promise<void>,
) {
  const existing = synchronizationInFlight.get(uid);
  if (existing) return existing;
  const pending = synchronize(uid).finally(() => {
    if (synchronizationInFlight.get(uid) === pending) synchronizationInFlight.delete(uid);
  });
  synchronizationInFlight.set(uid, pending);
  return pending;
}

export async function resendVerificationEmail({
  user,
  getCurrentUser,
  synchronize,
  actionSettings,
  sendEmail,
  cooldowns = defaultCooldowns,
  now = Date.now,
}: VerificationResendDependencies): Promise<VerificationResendResult> {
  await user.reload();
  const current = refreshedUser(user, getCurrentUser);
  if (current.emailVerified) {
    await current.getIdToken(true);
    await synchronizeVerifiedProfile(current.uid, synchronize);
    return "already_verified";
  }

  const remaining = getVerificationResendCooldown(current.uid, now(), cooldowns);
  if (remaining > 0) throw verificationError("verification/resend-cooldown", remaining);

  await sendEmail(current, actionSettings);
  cooldowns.set(current.uid, now() + (VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000));
  return "sent";
}

export async function refreshVerifiedEmail({
  user,
  getCurrentUser,
  synchronize,
}: VerificationBaseDependencies) {
  await user.reload();
  const current = refreshedUser(user, getCurrentUser);
  if (!current.emailVerified) return false;

  await current.getIdToken(true);
  await synchronizeVerifiedProfile(current.uid, synchronize);
  return true;
}
