import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState, Section } from "../../components/ui";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { labelFor } from "../../data/constants";
import { listSuppliers } from "../../services/firestore";
import type { Supplier } from "../../types/domain";
import { localizedSupplierName } from "../../utils/supplierDisplay";

export function AdminApprovedSuppliersPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { taxonomy } = useTaxonomy();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    void listSuppliers().then(setSuppliers);
  }, []);

  return (
    <Section title={t("approvedSuppliers")} description={t("directory")}>
      {!suppliers.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-start">{t("supplierName")}</th>
              <th className="px-3 py-2 text-start">{t("mainCategory")}</th>
              <th className="px-3 py-2 text-start">{t("rating")}</th>
              <th className="px-3 py-2 text-start">{t("details")}</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr className="border-t border-slate-200" key={supplier.id}>
                <td className="px-3 py-2 font-semibold text-ink">{localizedSupplierName(supplier, locale)}</td>
                <td className="px-3 py-2">{supplier.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")}</td>
                <td className="px-3 py-2">{supplier.averageRating || 0}</td>
                <td className="px-3 py-2"><Link className="font-semibold text-river" to={`/suppliers/${supplier.id}`}>{t("details")}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
