import { ArrowRight, BadgeCheck, BarChart3, BookOpen, LockKeyhole, ShieldCheck, Truck, UserPlus, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isFirebaseConfigured } from "../config/firebase";
import { Button } from "../components/ui";
import logoLockupUrl from "../assets/identity/logo-lockup.png";
import heroLogisticsUrl from "../assets/identity/hero-logistics-full.png";

const features = [
  { icon: BookOpen, titleKey: "landingDirectoryTitle", bodyKey: "landingDirectoryBody" },
  { icon: ShieldCheck, titleKey: "landingReviewTitle", bodyKey: "landingReviewBody" },
  { icon: UsersRound, titleKey: "landingAccessTitle", bodyKey: "landingAccessBody" },
  { icon: BarChart3, titleKey: "landingBadgesTitle", bodyKey: "landingBadgesBody" },
];

const trustPoints = [
  { icon: ShieldCheck, labelKey: "trustVerifiedSuppliers" },
  { icon: LockKeyhole, labelKey: "trustSecureData" },
  { icon: BarChart3, labelKey: "trustRealSavings" },
];

const footerLinks = ["navAbout", "navHowItWorks", "navSuppliers", "navBuyers", "navFaqs"];
const resourceLinks = ["userGuide", "termsOfUse", "privacyPolicy", "securityPolicy"];

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const showDeveloperNotice = import.meta.env.DEV && !isFirebaseConfigured;

  return (
    <div className="bg-creamLight text-ink">
      <section className="relative isolate overflow-hidden border-b border-borderSoft bg-creamLight">
        <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_18%_18%,rgba(243,112,33,0.1),transparent_26rem),linear-gradient(180deg,#fff9f1_0%,#fff6ea_100%)]" />
        <img
          className="pointer-events-none absolute bottom-0 left-0 -z-20 h-[72%] w-[50rem] max-w-[45%] object-contain object-left-bottom opacity-92"
          src={heroLogisticsUrl}
          alt=""
        />
        <div className="mx-auto grid min-h-[calc(100vh-11rem)] max-w-7xl items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8" style={{ direction: "ltr" }}>
          <div className="hidden min-h-[22rem] lg:block" aria-hidden="true" />

          <div className="rounded-[28px] border border-white/80 bg-creamLight/84 p-5 text-center shadow-soft backdrop-blur-sm sm:p-7 lg:text-start" style={{ direction: locale === "ar" ? "rtl" : "ltr" }}>
            <img className="mx-auto h-24 w-auto object-contain lg:mx-0 lg:h-28" src={logoLockupUrl} alt={t("appName")} />
            <h1 className="mt-5 text-3xl font-black leading-tight text-amber sm:text-4xl">{t("homepageSlogan")}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-8 text-ink/80 lg:mx-0">{t("homepageHeroText")}</p>

            {showDeveloperNotice ? (
              <div className="mt-5 rounded-xl border border-amber/40 bg-white/88 px-4 py-3 text-sm font-bold text-ink">
                {t("buildNotice")}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link to="/login">
                <Button className="min-w-44">
                  {t("landingAction")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/register">
                <Button className="min-w-44" variant="secondary">
                  {t("requestAccess")}
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {trustPoints.map((item) => (
                <div className="flex items-center justify-center gap-2 border-borderSoft px-2 text-sm font-bold text-ink sm:border-e" key={item.labelKey}>
                  <item.icon className="h-5 w-5 text-amber" aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/86">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {features.map((item) => (
            <article className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card" key={item.titleKey}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber/20 bg-cream text-amber">
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-4 text-lg font-black text-ink">{t(item.titleKey)}</div>
              <p className="mt-2 text-sm leading-7 text-muted">{t(item.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:px-6 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1fr] lg:px-8">
          <div>
            <img className="h-20 w-auto rounded-xl bg-white/95 p-2" src={logoLockupUrl} alt={t("appName")} />
            <p className="mt-4 max-w-md text-sm leading-7 text-white/78">{t("footerDescription")}</p>
          </div>
          <div>
            <div className="font-black">{t("quickLinks")}</div>
            <div className="mt-3 grid gap-2 text-sm text-white/78">
              {footerLinks.map((key) => <span key={key}>{t(key)}</span>)}
            </div>
          </div>
          <div>
            <div className="font-black">{t("resources")}</div>
            <div className="mt-3 grid gap-2 text-sm text-white/78">
              {resourceLinks.map((key) => <span key={key}>{t(key)}</span>)}
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 font-black text-orange-100">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              {t("trustRealSavings")}
            </div>
            <p className="mt-3 text-sm leading-7 text-white/78">{t("landingProcurementFocusBody")}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/78">
              <Truck className="h-4 w-4 text-amber" aria-hidden="true" />
              {t("copyright")}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}







