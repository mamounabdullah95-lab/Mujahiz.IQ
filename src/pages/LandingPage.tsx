import { ArrowRight, BadgeCheck, Database, Search, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isFirebaseConfigured } from "../config/firebase";
import { Button } from "../components/ui";
import brandLogoUrl from "../assets/brand/mujahiz-iq-logo-horizontal-final.svg";
import heroImageUrl from "../assets/brand/mujahiz-iq-login-hero-1920x1080.png";

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
    <div className="bg-[#f7fbfc]">
      <section className="relative isolate overflow-hidden border-b border-slate-200">
        <img className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.18]" src={heroImageUrl} alt="" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgba(247,251,252,0.99)_0%,rgba(247,251,252,0.94)_48%,rgba(255,255,255,0.78)_100%)]" />
        <div className="mx-auto grid min-h-[74vh] max-w-7xl content-center gap-10 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#00a7a7]/20 bg-white/85 px-3 py-1 text-sm font-bold text-river shadow-soft backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t("tagline")}
            </div>
            <img className="mt-7 h-32 w-auto sm:h-40" src={brandLogoUrl} alt={t("appName")} />
            <h1 className="sr-only">{t("landingHeadline")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{t("landingLead")}</p>
            {showDeveloperNotice ? (
              <div className="mt-5 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-semibold text-ink">
                {t("buildNotice")}
              </div>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login">
                <Button className="!bg-[#061e46] hover:!bg-[#00a7a7]">
                  {t("landingAction")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/register">
                <Button className="border-[#00a7a7]/30 bg-white/90 hover:border-[#061e46] hover:text-[#061e46]" variant="secondary">
                  {t("requestAccess")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {features.map((item) => (
            <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft" key={item.title}>
              <item.icon className="h-5 w-5 text-[#00a7a7]" aria-hidden="true" />
              <div className="mt-3 font-bold text-ink">{item.title}</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#061e46] text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[#11c8d3]">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              {t("landingProcurementFocusTitle")}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">{t("landingProcurementFocusBody")}</p>
          </div>
          <Link to="/login">
            <Button className="!bg-white text-[#061e46] hover:!bg-[#11c8d3] hover:text-[#061e46]">{t("landingAction")}</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
