import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../components/StatusBadge";
import { Button, EmptyState, Section } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";
import { listMySubmissions } from "../services/firestore";
import type { SupplierSubmission } from "../types/domain";
import { formatDate } from "../utils/date";
import { localizedCity, localizedSupplierName, localizedSupplierText } from "../utils/supplierDisplay";

export function MySubmissionsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [items, setItems] = useState<SupplierSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    void listMySubmissions(firebaseUser.uid)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  return (
    <Section title={t("mySubmissions")} description={t("submissionThanks")}>
      {loading ? <EmptyState title={t("loading")} /> : null}
      {!loading && !items.length ? <EmptyState title={t("noResults")} body={t("addSupplier")} /> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <div className="rounded-md border border-slate-200 p-4" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">{localizedSupplierName(item.supplierData, locale)}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {item.supplierData.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")} ·{" "}
                  {localizedCity(item.supplierData.city || item.supplierData.marketArea, locale)}
                </p>
              </div>
              <StatusBadge value={item.submissionStatus} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                {t("completionScore")}: <b>{item.supplierData.completionScore}%</b>
              </div>
              <div>
                {t("createdAt")}: <b>{formatDate(item.createdAt, locale)}</b>
              </div>
              <div>
                {t("duplicateWarning")}: <b>{item.duplicateCheck?.matches?.length || 0}</b>
              </div>
            </div>
            {item.adminNotes ? <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">{localizedSupplierText(item.adminNotes, locale)}</p> : null}
            {item.submissionStatus === "needs_correction" ? (
              <div className="mt-3">
                <Link to={`/suppliers/submissions/${item.id}/edit`}>
                  <Button type="button">{t("editCorrection")}</Button>
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}
