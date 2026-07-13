const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export function toLatinDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit);
    return String(arabicIndex >= 0 ? arabicIndex : persianDigits.indexOf(digit));
  });
}

export function normalizeAccountEmail(value: string) {
  const trimmed = value.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex < 1) return trimmed;
  return `${trimmed.slice(0, atIndex)}@${trimmed.slice(atIndex + 1).toLowerCase()}`;
}

export function isValidEmailAddress(value: string) {
  const normalized = normalizeAccountEmail(value);
  if (/\s/.test(normalized) || normalized.length > 254) return false;
  const [local, domain, ...rest] = normalized.split("@");
  return Boolean(!rest.length && local && domain && local.length <= 64 && /^[^<>()[\]\\,;:\s@"]+$/.test(local) && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain));
}

export function normalizeIraqiPhone(value: string) {
  const digits = toLatinDigits(value).replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(digits)) return `+964${digits.slice(1)}`;
  if (/^9647\d{9}$/.test(digits)) return `+${digits}`;
  if (/^009647\d{9}$/.test(digits)) return `+${digits.slice(2)}`;
  return "";
}

export function isValidIraqiPhone(value: string) {
  return Boolean(normalizeIraqiPhone(value));
}

export function friendlyAuthError(reason: unknown, locale: "ar" | "en") {
  const raw = reason instanceof Error ? reason.message : String(reason || "");
  const code = (reason as { code?: string } | null)?.code || raw;
  const messages: Record<string, { ar: string; en: string }> = {
    "auth/email-already-in-use": { ar: "يوجد حساب بهذا البريد. استخدم تسجيل الدخول أو أعد إرسال رسالة التفعيل.", en: "An account already exists for this email. Sign in or resend the verification email." },
    "auth/invalid-email": { ar: "صيغة البريد الإلكتروني غير صحيحة.", en: "The email address format is invalid." },
    "auth/weak-password": { ar: "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.", en: "The password is too weak. Use at least 8 characters." },
    "auth/invalid-credential": { ar: "البريد أو كلمة المرور غير صحيحة.", en: "The email or password is incorrect." },
    "profile_setup_incomplete": { ar: "تم إنشاء حسابك، لكن تعذر إكمال إعداد الملف الشخصي. سجّل الدخول لإكمال الإعداد، ولن تحتاج إلى إنشاء حساب جديد.", en: "Your account was created, but profile setup could not be completed. Sign in to finish setup; you do not need to register again." },
    invalid_phone: { ar: "أدخل رقماً عراقياً صحيحاً مثل 07812345678 أو +9647812345678.", en: "Enter a valid Iraqi number such as 07812345678 or +9647812345678." },
    invalid_email: { ar: "أدخل بريداً إلكترونياً صحيحاً دون مسافات.", en: "Enter a valid email address without spaces." },
  };
  const key = Object.keys(messages).find((item) => code.includes(item));
  return key ? messages[key][locale] : (locale === "ar" ? "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى." : "The operation could not be completed. Check your details and try again.");
}
