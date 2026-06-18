import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Locale } from "../types/domain";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";

  const setLocale = (nextLocale: Locale) => {
    localStorage.setItem("mujahiz-iq-locale", nextLocale);
    void i18n.changeLanguage(nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1" aria-label={t("language")}>
      <Languages className="ms-1 h-4 w-4 text-slate-500" aria-hidden="true" />
      {(["en", "ar"] as const).map((item) => (
        <button
          className={`rounded px-2 py-1 text-xs font-bold ${locale === item ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-100"}`}
          key={item}
          type="button"
          onClick={() => setLocale(item)}
        >
          {t(item)}
        </button>
      ))}
    </div>
  );
}
