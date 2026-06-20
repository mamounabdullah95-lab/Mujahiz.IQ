import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, CalendarClock, CheckCircle2, ClipboardCheck, Plus, X, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../components/StatusBadge";
import { Button, Section, StatCard } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { badgeDefinitions, defaultSettings, labelFor } from "../data/constants";
import { getPlatformSettings } from "../services/firestore";
import type { PlatformSettings } from "../types/domain";
import { formatDate } from "../utils/date";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, hasActiveAccess } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

  useEffect(() => {
    void getPlatformSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("mujahiz-iq-registration-success") === "1") {
      setShowRegistrationSuccess(true);
      sessionStorage.removeItem("mujahiz-iq-registration-success");
    }
  }, []);

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

  return (
    <Section
      title={t("dashboard")}
      description={
        months > 0
          ? t("dashboardAccessEarned", { months, remaining: available % required })
          : t("dashboardAccessProgress", { available, remaining, days })
      }
      actions={
        <Link to="/suppliers/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addSupplier")}
          </Button>
        </Link>
      }
    >
      {showRegistrationSuccess ? (
        <div className="flex items-start gap-3 rounded-md border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-ink">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden="true" />
          <p className="flex-1 leading-6">{t("registrationSuccessMessage")}</p>
          <button
            className="rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-ink"
            type="button"
            aria-label={t("dismiss")}
            onClick={() => setShowRegistrationSuccess(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("access")} value={<StatusBadge value={hasActiveAccess ? "active" : appUser.accessStatus} />} tone={hasActiveAccess ? "good" : "warning"} />
        <StatCard label={t("accessExpires")} value={formatDate(appUser.accessExpiresAt, locale)} />
        <StatCard label={t("points")} value={appUser.points || 0} />
        <StatCard label={t("qualityRatio")} value={`${Math.round((appUser.qualityRatio || 0) * 100)}%`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 p-4">
          <ClipboardCheck className="h-5 w-5 text-river" aria-hidden="true" />
          <h3 className="mt-3 font-bold text-ink">{t("pendingSubmissions")}</h3>
          <p className="mt-1 text-3xl font-black text-ink">{appUser.totalSubmissions - appUser.approvedSubmissions - appUser.rejectedSubmissions - appUser.duplicateSubmissions}</p>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <CalendarClock className="h-5 w-5 text-river" aria-hidden="true" />
          <h3 className="mt-3 font-bold text-ink">{t("availableCredits")}</h3>
          <p className="mt-1 text-3xl font-black text-ink">{available}</p>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <Star className="h-5 w-5 text-river" aria-hidden="true" />
          <h3 className="mt-3 font-bold text-ink">{t("reviews")}</h3>
          <p className="mt-1 text-3xl font-black text-ink">{appUser.approvedReviews || 0}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber" aria-hidden="true" />
          <h3 className="font-bold text-ink">{t("badges")}</h3>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(appUser.badges || []).length ? (
            appUser.badges.map((badge) => (
              <span className="rounded bg-amber/10 px-2 py-1 text-xs font-bold text-ink" key={badge}>
                {labelFor(badgeDefinitions, badge, locale)}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">{t("monthlyChallengeDescription", { required })}</span>
          )}
        </div>
      </div>
    </Section>
  );
}
