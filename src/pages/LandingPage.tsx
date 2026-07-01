import { ArrowRight, BadgeCheck, Database, Search, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isFirebaseConfigured } from "../config/firebase";
import { Button } from "../components/ui";
import brandLogoUrl from "../assets/brand/mujahiz-iq-brand-lockup-horizontal.png";
import heroImageUrl from "../assets/brand/mujahiz-iq-brand-hero.png";

export function LandingPage() {
  const { t } = useTranslation();
  const showDeveloperNotice = import.meta.env.DEV && !isFirebaseConfigured;

  const features = [
    { icon: Search, title: t("landingDirectoryTitle"), body: t("landingDirectoryBody") },
    { icon: ShieldCheck, title: t("landingReviewTitle"), body: t("landingReviewBody") },
    { icon: Database, title: t("landingAccessTitle"), body: t("landingAccessBody") },
    { icon: UsersRound, title: t("landingBadgesTitle"), body: t("landingBadgesBody") },
  ];

  return (
    <div className="bg-[#fff7ec]">
      <section className="relative isolate overflow-hidden border-b border-orange-100">
        <img className="absolute inset-0 -z-20 h-full w-full object-cover object-left-bottom opacity-[0.85]" src={heroImageUrl} alt="" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(255,248,238,0.98)_0%,rgba(255,248,238,0.9)_42%,rgba(255,255,255,0.68)_100%)]" />
        <div className="mx-auto grid min-h-[74vh] max-w-7xl content-center gap-10 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl rounded-md border border-orange-100 bg-white/78 p-5 shadow-soft backdrop-blur-sm sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-md border border-amber/25 bg-white/85 px-3 py-1 text-sm font-bold text-ink shadow-soft backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t("tagline")}
            </div>
            <img className="mt-7 h-20 w-auto sm:h-24" src={brandLogoUrl} alt={t("appName")} />
            <h1 className="sr-only">{t("landingHeadline")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{t("landingLead")}</p>
            {showDeveloperNotice ? (
              <div className="mt-5 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-semibold text-ink">
                {t("buildNotice")}
              </div>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login">
                <Button className="!bg-ink shadow-soft hover:!bg-river">
                  {t("landingAction")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/register">
                <Button className="border-amber/45 bg-white/90 text-amber hover:border-ink hover:text-ink" variant="secondary">
                  {t("requestAccess")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-orange-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {features.map((item) => (
            <article className="rounded-md border border-orange-100 bg-white p-4 shadow-soft" key={item.title}>
              <item.icon className="h-5 w-5 text-amber" aria-hidden="true" />
              <div className="mt-3 font-bold text-ink">{item.title}</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-bold text-orange-200">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              {t("landingProcurementFocusTitle")}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">{t("landingProcurementFocusBody")}</p>
          </div>
          <Link to="/login">
            <Button className="!bg-white text-ink hover:!bg-orange-100 hover:text-ink">{t("landingAction")}</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
