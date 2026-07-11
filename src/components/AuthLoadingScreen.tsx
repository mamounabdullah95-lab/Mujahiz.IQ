import { useTranslation } from "react-i18next";
import logoLockupUrl from "../assets/identity/logo-lockup.png";

export function AuthLoadingScreen() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  return (
    <div className="grid min-h-[70vh] place-items-center bg-creamLight px-4" role="status" aria-live="polite">
      <div className="grid w-full max-w-sm justify-items-center gap-5 rounded-[18px] border border-borderSoft bg-white p-8 text-center shadow-card">
        <img className="h-16 w-auto object-contain" src={logoLockupUrl} alt="Mujahiz IQ" />
        <div className="h-2 w-full overflow-hidden rounded-full bg-cream">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-amber" />
        </div>
        <p className="text-sm font-bold text-muted">{isArabic ? "جاري التحقق من الحساب والصلاحيات..." : "Checking your account and permissions..."}</p>
      </div>
    </div>
  );
}
