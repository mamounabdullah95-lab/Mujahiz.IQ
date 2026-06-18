import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Section } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { defaultSettings } from "../data/constants";
import { getPlatformSettings } from "../services/firestore";
import type { PlatformSettings } from "../types/domain";

export function NoAccessPage() {
  const { t } = useTranslation();
  const { appUser } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);

  useEffect(() => {
    void getPlatformSettings().then(setSettings);
  }, []);

  const approved = appUser?.approvedNewSupplierContributions || 0;
  const consumed = appUser?.consumedApprovedSupplierContributions || 0;
  const available = Math.max(0, approved - consumed);
  const required = settings.requiredApprovedSuppliersPerMonth || defaultSettings.requiredApprovedSuppliersPerMonth;
  const remaining = available % required === 0 ? required : required - (available % required);

  return (
    <Section title={t("noAccessTitle")} description={t("noAccessBody")}>
      <div className="rounded-md border border-amber/40 bg-amber/10 p-4 text-sm font-semibold text-ink">
        {available > 0
          ? t("noAccessProgress", { available, remaining, days: settings.daysGrantedPerBatch })
          : t("startSubmittingSuppliers")}
      </div>
      <div className="mt-4">
        <Link to="/suppliers/new">
          <Button>{t("addSupplier")}</Button>
        </Link>
      </div>
    </Section>
  );
}
