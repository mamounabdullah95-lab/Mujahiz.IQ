import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Plus, Search, Star, TrendingUp, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../components/StatusBadge";
import { Button, Section, StatCard } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { badgeDefinitions, defaultSettings, labelFor } from "../data/constants";
import { getPlatformSettings, listMySubmissions } from "../services/firestore";
import type { PlatformSettings } from "../types/domain";
import { formatDate, toDate } from "../utils/date";
import heroMapContainerUrl from "../assets/brand/mujahiz-iq-brand-hero.png";

const dashboardCopy = {
  ar: {
    buyer: {
      title: "لوحة المشتري",
      description: "إدارة البحث عن المجهزين، متابعة الوصول، ومراجعة مساهماتك داخل منصة مجهز.",
      note: "ابدأ من دليل المجهزين للبحث الذكي والمقارنة، أو أضف مجهزاً موثوقاً لرفع جودة قاعدة البيانات.",
      primaryLabel: "فتح دليل المجهزين",
    },
    supplier: {
      title: "لوحة المجهز",
      description: "إدارة حضور شركتك داخل المنصة، متابعة طلبات المراجعة، وتجهيز بياناتك للظهور أمام المشترين.",
      note: "أضف بيانات شركتك أو حدّثها بدقة. بعد مراجعة الإدارة يمكن ربط الحساب بملف مجهز معتمد واستقبال فرص أكثر جدية.",
      primaryLabel: "إضافة أو تحديث شركة",
    },
  },
  en: {
    buyer: {
      title: "Buyer Dashboard",
      description: "Manage supplier discovery, access status, and your contributions inside Mujahiz IQ.",
      note: "Start from the supplier directory for smart search and comparison, or add trusted supplier knowledge to improve the platform.",
      primaryLabel: "Open Supplier Directory",
    },
    supplier: {
      title: "Supplier Dashboard",
      description: "Manage your company presence, review submissions, and prepare your profile for buyer visibility.",
      note: "Add or update your company data carefully. After admin review, the account can be connected to an approved supplier profile and stronger opportunities.",
      primaryLabel: "Add or Update Company",
    },
  },
};

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, firebaseUser, hasActiveAccess } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [pendingSubmissions, setPendingSubmissions] = useState(0);

  useEffect(() => {
    void getPlatformSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setPendingSubmissions(0);
      return;
    }
    let active = true;
    void listMySubmissions(firebaseUser.uid)
      .then((items) => {
        if (!active) return;
        setPendingSubmissions(
          items.filter((item) => item.submissionStatus === "pending_review" || item.submissionStatus === "possible_duplicate").length,
        );
      })
      .catch(() => {
        if (active) {
          setPendingSubmissions(0);
        }
      });
    return () => {
      active = false;
    };
  }, [firebaseUser]);

  if (!appUser) {
    return null;
  }

  const approved = appUser.approvedNewSupplierContributions || 0;
  const consumed = appUser.consumedApprovedSupplierContributions || 0;
  const available = Math.max(0, approved - consumed);
  const required = settings.requiredApprovedSuppliersPerMonth || defaultSettings.requiredApprovedSuppliersPerMonth;
  const days = settings.daysGrantedPerBatch || defaultSettings.daysGrantedPerBatch;
  const months = Math.floor(available / required);
  const remaining = available % required === 0 ? required : required - (available % required);
  const accessExpiresAt = toDate(appUser.accessExpiresAt);
  const daysRemaining = accessExpiresAt
    ? Math.max(0, Math.ceil((accessExpiresAt.getTime() - Date.now()) / 86400000))
    : 0;
  const showContributionChallenge = !hasActiveAccess || daysRemaining <= days;
  const accountType = appUser.accountType === "supplier" ? "supplier" : "buyer";
  const isSupplierAccount = accountType === "supplier";
  const pageCopy = dashboardCopy[locale][accountType];
  const primaryDashboardLink = isSupplierAccount ? "/suppliers/new" : "/directory";
  const PrimaryDashboardIcon = isSupplierAccount ? Building2 : Search;
  const description = !showContributionChallenge
    ? t("dashboardAccessCovered", { date: formatDate(appUser.accessExpiresAt, locale), days: daysRemaining })
    : months > 0
    ? t("dashboardAccessEarned", { months, remaining: available % required })
    : t("dashboardAccessProgress", { available, remaining, days });

  return (
    <Section
      title={pageCopy.title}
      description={`${pageCopy.description} ${description}`}
      actions={
        <Link to={primaryDashboardLink}>
          <Button>
            <PrimaryDashboardIcon className="h-4 w-4" aria-hidden="true" />
            {pageCopy.primaryLabel}
          </Button>
        </Link>
      }
    >
      <div className="relative overflow-hidden rounded-[24px] border border-borderSoft bg-cream p-6 shadow-card">
        <img className="absolute inset-0 h-full w-full object-contain object-left-bottom opacity-20" src={heroMapContainerUrl} alt="" />
        <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/86 px-4 py-2 text-sm font-black text-amber shadow-card">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
              {pageCopy.title}
            </div>
            <h2 className="mt-5 text-3xl font-black text-ink">{pageCopy.title}</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-ink/72">{pageCopy.note}</p>
          </div>
          <Link to={primaryDashboardLink}>
            <Button className="bg-navy900 hover:bg-river">
              <PrimaryDashboardIcon className="h-4 w-4" aria-hidden="true" />
              {pageCopy.primaryLabel}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("access")} value={<StatusBadge value={hasActiveAccess ? "active" : appUser.accessStatus} />} tone={hasActiveAccess ? "good" : "warning"} />
        <StatCard label={t("accessExpires")} value={formatDate(appUser.accessExpiresAt, locale)} />
        <StatCard label={t("points")} value={appUser.points || 0} />
        <StatCard label={t("qualityRatio")} value={`${Math.round((appUser.qualityRatio || 0) * 100)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-ink">{t("pendingSubmissions")}</h3>
            <ClipboardCheck className="h-6 w-6 text-amber" aria-hidden="true" />
          </div>
          <p className="mt-4 text-4xl font-black text-ink">{pendingSubmissions}</p>
          <p className="mt-1 text-sm font-medium text-muted">{t("pendingRequestUnit")}</p>
        </div>
        <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-ink">{showContributionChallenge ? t("availableCredits") : t("accessDaysRemaining")}</h3>
            <CalendarClock className="h-6 w-6 text-amber" aria-hidden="true" />
          </div>
          <p className="mt-4 text-4xl font-black text-ink">{showContributionChallenge ? available : daysRemaining}</p>
          <p className="mt-1 text-sm font-medium text-muted">{showContributionChallenge ? t("availableCredits") : t("remainingDaysUnit")}</p>
        </div>
        <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-ink">{t("reviews")}</h3>
            <Star className="h-6 w-6 text-amber" aria-hidden="true" />
          </div>
          <p className="mt-4 text-4xl font-black text-ink">{appUser.approvedReviews || 0}</p>
          <p className="mt-1 text-sm font-medium text-muted">{t("approvedReviewUnit")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber" aria-hidden="true" />
            <h3 className="font-black text-ink">{t("recentActivity")}</h3>
          </div>
          <div className="mt-5 grid gap-3 text-sm font-medium text-ink/72">
            <div className="flex items-center gap-3 rounded-xl bg-cream px-3 py-3">
              <CheckCircle2 className="h-5 w-5 text-mint" aria-hidden="true" />
              <span>{t("activityAccessUpdated")}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-cream px-3 py-3">
              <ClipboardCheck className="h-5 w-5 text-amber" aria-hidden="true" />
              <span>{t("activityPendingRequests", { count: pendingSubmissions })}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber" aria-hidden="true" />
            <h3 className="font-black text-ink">{t("badges")}</h3>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {(appUser.badges || []).length ? (
              appUser.badges.map((badge) => (
                <span className="rounded-2xl border border-amber/20 bg-cream px-4 py-3 text-sm font-black text-ink" key={badge}>
                  {labelFor(badgeDefinitions, badge, locale)}
                </span>
              ))
            ) : (
              <span className="text-sm leading-7 text-muted">{t("monthlyChallengeDescription", { required })}</span>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
