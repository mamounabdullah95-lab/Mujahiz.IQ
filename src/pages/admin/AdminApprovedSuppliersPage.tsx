import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Section } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { labelFor } from "../../data/constants";
import { deleteApprovedSupplier, listSuppliers } from "../../services/firestore";
import type { Supplier } from "../../types/domain";
import { localizedSupplierName } from "../../utils/supplierDisplay";

export function AdminApprovedSuppliersPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, isOwner } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listSuppliers().then(setSuppliers);
  }, []);

  async function removeSupplier(supplier: Supplier) {
    if (!firebaseUser || !isOwner) {
      return;
    }
    const supplierName = localizedSupplierName(supplier, locale);
    if (!window.confirm(t("confirmDeleteSupplier", { name: supplierName }))) {
      return;
    }
    setBusyId(supplier.id);
    setMessage("");
    try {
      await deleteApprovedSupplier(supplier.id, firebaseUser.uid);
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
      setMessage(t("supplierDeleted"));
    } catch (reason) {
      setMessage(t(reason instanceof Error ? reason.message : "supplierDeleteFailed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Section title={t("approvedSuppliers")} description={t("directory")}>
      {message ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">{message}</div> : null}
      {!suppliers.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-[680px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-start">{t("supplierName")}</th>
              <th className="px-3 py-2 text-start">{t("mainCategory")}</th>
              <th className="px-3 py-2 text-start">{t("rating")}</th>
              <th className="px-3 py-2 text-start">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr className="border-t border-slate-200" key={supplier.id}>
                <td className="px-3 py-2 font-semibold text-ink">{localizedSupplierName(supplier, locale)}</td>
                <td className="px-3 py-2">{supplier.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")}</td>
                <td className="px-3 py-2">{supplier.averageRating || 0}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-3">
                    <Link className="font-semibold text-river" to={`/suppliers/${supplier.id}`}>{t("details")}</Link>
                    <Link className="inline-flex items-center gap-1 font-semibold text-river" to={`/admin/suppliers/${supplier.id}/edit`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {t("edit")}
                    </Link>
                    {isOwner ? (
                      <Button
                        className="!min-h-0 !px-0 !py-0 text-sm"
                        disabled={busyId === supplier.id}
                        type="button"
                        variant="ghost"
                        onClick={() => void removeSupplier(supplier)}
                      >
                        <Trash2 className="h-4 w-4 text-clay" aria-hidden="true" />
                        <span className="text-clay">{t("deleteSupplier")}</span>
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
