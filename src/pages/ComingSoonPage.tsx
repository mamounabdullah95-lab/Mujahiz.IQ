import { ArrowRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui";
import { portalHome } from "../utils/authorization";
import { useAuth } from "../contexts/AuthContext";
import { resolvePortalRole } from "../utils/authorization";

export function ComingSoonPage({
  title,
  description,
}: {
  title: { ar: string; en: string };
  description?: { ar: string; en: string };
}) {
  const { i18n } = useTranslation();
  const { appUser } = useAuth();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const defaultDescription = locale === "ar"
    ? "تم تجهيز مكان هذه الوظيفة ضمن بنية المنصة، وستُفعّل بعد اكتمال دورة العمل والبيانات المرتبطة بها."
    : "This feature has a prepared place in the platform and will be activated when its workflow and data model are ready.";

  return (
    <section className="grid min-h-[56vh] place-items-center p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-[18px] border border-borderSoft bg-white p-7 text-center shadow-card sm:p-10">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[14px] bg-cream text-amber">
          <Clock3 className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="mt-5 inline-flex rounded-full border border-amber/25 bg-cream px-3 py-1 text-xs font-black text-amber">
          {locale === "ar" ? "قريباً" : "Coming soon"}
        </div>
        <h1 className="mt-4 text-2xl font-black text-ink sm:text-3xl">{title[locale]}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-7 text-muted">
          {description?.[locale] || defaultDescription}
        </p>
        <Link className="mt-7 inline-block" to={portalHome(resolvePortalRole(appUser))}>
          <Button>
            {locale === "ar" ? "العودة إلى النظرة العامة" : "Back to overview"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
