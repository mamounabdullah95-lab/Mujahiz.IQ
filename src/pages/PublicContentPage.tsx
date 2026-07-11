import { ArrowRight, BookOpen, CheckCircle2, HelpCircle, Mail, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui";
import { publicFaqItems, publicPages, type PublicPageKey } from "../data/publicContent";
import logoLockupUrl from "../assets/identity/logo-lockup.png";

const pageIcons = [BookOpen, ShieldCheck, UsersRound, Sparkles];

function localized(text: { ar: string; en: string }, locale: "ar" | "en") {
  return text[locale] || text.en || text.ar;
}

function pageActionTarget(pageKey: PublicPageKey) {
  if (pageKey === "join_request" || pageKey === "suppliers") return "/register";
  if (pageKey === "buyers" || pageKey === "supplier_directory") return "/login";
  if (pageKey === "contact") return "mailto:mujahiziq@gmail.com";
  return "/register";
}

export function PublicContentPage({ pageKey }: { pageKey: PublicPageKey }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const page = publicPages[pageKey];
  const isFaq = pageKey === "faq";
  const isLegal = pageKey === "terms" || pageKey === "privacy" || pageKey === "security";

  useEffect(() => {
    document.title = localized(page.metaTitle, locale);
  }, [locale, page]);

  return (
    <div className="bg-creamLight text-ink">
      <section className="relative isolate overflow-hidden border-b border-borderSoft bg-creamLight">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_12%,rgba(243,112,33,0.11),transparent_24rem),radial-gradient(circle_at_85%_24%,rgba(6,43,77,0.045),transparent_28rem),linear-gradient(180deg,#fff9f1_0%,#fff6ea_100%)]" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.56fr] lg:items-center lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-white/76 px-4 py-2 text-sm font-black text-amber shadow-card">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t("homepageSlogan")}
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-ink sm:text-5xl">{localized(page.title, locale)}</h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-9 text-ink/72">{localized(page.subtitle, locale)}</p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">{localized(page.metaDescription, locale)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={pageActionTarget(pageKey)}>
                <Button>
                  {pageKey === "buyers" || pageKey === "supplier_directory" ? t("landingAction") : t("requestAccess")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="secondary">
                  {t("contactUs")}
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
          <aside className="rounded-[28px] border border-borderSoft bg-white/88 p-7 text-center shadow-soft">
            <img className="mx-auto h-24 w-auto object-contain" src={logoLockupUrl} alt={t("appName")} />
            <div className="mt-6 rounded-[22px] bg-cream p-5 text-start">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
                <p className="text-sm font-bold leading-7 text-ink/78">{localized(page.cta, locale)}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {isFaq ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {publicFaqItems.map((item, index) => (
              <article className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card" key={`${item.question.en}-${index}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cream text-amber">
                    <HelpCircle className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink">{localized(item.question, locale)}</h2>
                    <p className="mt-2 text-sm font-medium leading-7 text-muted">{localized(item.answer, locale)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={isLegal ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
            {page.sections.map((section, index) => {
              const Icon = pageIcons[index % pageIcons.length];
              return (
                <article className="rounded-[18px] border border-borderSoft bg-white p-6 shadow-card" key={`${section.title.en}-${index}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber/20 bg-cream text-amber">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-ink">{localized(section.title, locale)}</h2>
                      <p className="mt-3 text-sm font-medium leading-8 text-muted">{localized(section.body, locale)}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-9 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <div className="text-2xl font-black text-orange-100">{localized(page.cta, locale)}</div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/72">{t("footerDescription")}</p>
          </div>
          <Link to={pageActionTarget(pageKey)}>
            <Button className="!bg-white text-navy hover:!bg-orange-100 hover:text-navy">
              {pageKey === "buyers" || pageKey === "supplier_directory" ? t("landingAction") : t("requestAccess")}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
