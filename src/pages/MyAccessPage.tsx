import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Section, StatCard } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { defaultSettings } from "../data/constants";
import { getPlatformSettings, listAccessCredits } from "../services/firestore";
import type { AccessCredit, PlatformSettings } from "../types/domain";
import { formatDate, toDate } from "../utils/date";

export function MyAccessPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, firebaseUser } = useAuth();
  const [credits, setCredits] = useState<AccessCredit[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);

  useEffect(() => {
    if (!firebaseUser) return;
    void listAccessCredits(firebaseUser.uid).then(setCredits);
    void getPlatformSettings().then(setSettings);
  }, [firebaseUser]);

  if (!appUser) {
    return null;
  }

  const available = Math.max(
    0,
    (appUser.approvedNewSupplierContributions || 0) - (appUser.consumedApprovedSupplierContributions || 0),
  );
  const required = settings.requiredApprovedSuppliersPerMonth || defaultSettings.requiredApprovedSuppliersPerMonth;
  const days = settings.daysGrantedPerBatch || defaultSettings.daysGrantedPerBatch;
  const accessExpiresAt = toDate(appUser.accessExpiresAt);
  const daysRemaining = accessExpiresAt
    ? Math.max(0, Math.ceil((accessExpiresAt.getTime() - Date.now()) / 86400000))
    : 0;
  const showContributionChallenge = daysRemaining <= days;

  return (
    <Section
      title={t("myAccess")}
      description={showContributionChallenge ? t("noAccessBody") : t("myAccessCoveredDescription", { days: daysRemaining })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("accessExpires")} value={formatDate(appUser.accessExpiresAt, locale)} />
        <StatCard label={showContributionChallenge ? t("availableCredits") : t("accessDaysRemaining")} value={showContributionChallenge ? available : daysRemaining} />
        {showContributionChallenge ? (
          <StatCard label={t("remainingForNextMonth")} value={available % required === 0 ? required : required - (available % required)} />
        ) : (
          <StatCard label={t("accessCovered")} value={t("status_active")} tone="good" />
        )}
      </div>
      <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-[620px] w-full text-sm">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-3 py-2 text-start">{t("source")}</th>
              <th className="px-3 py-2 text-start">{t("access")}</th>
              <th className="px-3 py-2 text-start">{t("createdAt")}</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((credit) => (
              <tr className="border-t border-slate-200" key={credit.id}>
                <td className="px-3 py-2">{t(`accessSource_${credit.source}`)}</td>
                <td className="px-3 py-2">{t("daysCount", { count: credit.daysGranted })}</td>
                <td className="px-3 py-2">{formatDate(credit.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
