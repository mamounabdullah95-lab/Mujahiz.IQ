import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, EmptyState, Section } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { confidenceLevels, labelFor } from "../../data/constants";
import { approveSupplierSubmission, decideSupplierSubmission, getPlatformSettings, listSupplierSubmissions } from "../../services/firestore";
import type { SupplierSubmission } from "../../types/domain";

export function AdminSubmissionsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, refreshUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [items, setItems] = useState<SupplierSubmission[]>([]);
  const [busyId, setBusyId] = useState("");

  const load = () => listSupplierSubmissions().then(setItems);
  useEffect(() => {
    void load();
  }, []);

  async function approve(item: SupplierSubmission) {
    if (!firebaseUser) return;
    setBusyId(item.id);
    const settings = await getPlatformSettings();
    await approveSupplierSubmission(item, firebaseUser.uid, settings);
    await refreshUser();
    await load();
    setBusyId("");
  }

  async function reject(item: SupplierSubmission) {
    if (!firebaseUser) return;
    setBusyId(item.id);
    await decideSupplierSubmission(item, firebaseUser.uid, "rejected", t("rejectedByReviewer"));
    await load();
    setBusyId("");
  }

  return (
    <Section title={t("reviewQueue")} description={t("suggestedDecision")}>
      {!items.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <div className="rounded-md border border-slate-200 p-4" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">{item.supplierData.displayName || item.supplierData.nameOriginal}</h3>
                <p className="text-sm text-slate-500">
                  {item.supplierData.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")} · {item.supplierData.city}
                </p>
              </div>
              <StatusBadge value={item.submissionStatus} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <div>{t("completionScore")}: <b>{item.supplierData.completionScore}%</b></div>
              <div>{t("duplicateWarning")}: <b>{item.duplicateCheck.matches.length}</b></div>
              <div>{t("confidence")}: <b>{labelFor(confidenceLevels, item.supplierData.confidenceLevel, locale)}</b></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-river hover:text-river" to={`/admin/submissions/${item.id}`}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                {t("details")}
              </Link>
              <Button disabled={busyId === item.id} type="button" onClick={() => void approve(item)}>
                <Check className="h-4 w-4" aria-hidden="true" />
                {t("approve")}
              </Button>
              <Button disabled={busyId === item.id} type="button" variant="danger" onClick={() => void reject(item)}>
                <X className="h-4 w-4" aria-hidden="true" />
                {t("reject")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

