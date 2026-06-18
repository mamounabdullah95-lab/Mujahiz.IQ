import { ArrowRight, Database, Search, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isFirebaseConfigured } from "../config/firebase";
import { Button } from "../components/ui";

export function LandingPage() {
  const { t } = useTranslation();
  const showDeveloperNotice = import.meta.env.DEV && !isFirebaseConfigured;

  return (
    <div className="bg-white">
      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f6_45%,#fff8eb_100%)]">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl content-center gap-8 px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-md bg-white px-3 py-1 text-sm font-bold text-river shadow-soft">
                {t("tagline")}
              </div>
              <h1 className="max-w-3xl text-4xl font-black text-ink sm:text-5xl">{t("landingHeadline")}</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{t("landingLead")}</p>
              {showDeveloperNotice ? (
                <div className="mt-5 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-semibold text-ink">
                  {t("buildNotice")}
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button>
                    {t("landingAction")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="secondary">{t("requestAccess")}</Button>
                </Link>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                { icon: Search, title: t("landingDirectoryTitle"), body: t("landingDirectoryBody") },
                { icon: ShieldCheck, title: t("landingReviewTitle"), body: t("landingReviewBody") },
                { icon: Database, title: t("landingAccessTitle"), body: t("landingAccessBody") },
                { icon: UsersRound, title: t("landingBadgesTitle"), body: t("landingBadgesBody") },
              ].map((item) => (
                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft" key={item.title}>
                  <item.icon className="h-5 w-5 text-river" aria-hidden="true" />
                  <div className="mt-3 font-bold text-ink">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
