import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, ChipGroup, EmptyState, Section } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import {
  businessTypes,
  confidenceLevels,
  coverageAreas,
  creditStarts,
  governorates,
  labelFor,
  paymentOptions,
  sourceTypes,
} from "../../data/constants";
import { deleteApprovedSupplier, listSuppliers } from "../../services/firestore";
import type { Locale, Supplier } from "../../types/domain";
import { formatDate } from "../../utils/date";
import { localizedCity, localizedSupplierGovernorates, localizedSupplierName } from "../../utils/supplierDisplay";

const exportLabels = {
  en: {
    exportTitle: "Export approved suppliers",
    exportBody: "Select one or more supplier categories, or leave all categories unselected to export every approved supplier.",
    exportExcel: "Download Excel",
    exportAllCategories: "All categories selected by default.",
    exportSelectedCount: "{{count}} category filter(s) selected.",
    totalSuppliers: "{{count}} approved supplier(s)",
  },
  ar: {
    exportTitle: "\u062a\u062d\u0645\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062c\u0647\u0632\u064a\u0646",
    exportBody: "\u0627\u062e\u062a\u0631 \u062a\u0635\u0646\u064a\u0641\u0627 \u0648\u0627\u062d\u062f\u0627 \u0627\u0648 \u0627\u0643\u062b\u0631\u060c \u0627\u0648 \u0627\u062a\u0631\u0643 \u0627\u0644\u062a\u0635\u0646\u064a\u0641\u0627\u062a \u0628\u062f\u0648\u0646 \u062a\u062d\u062f\u064a\u062f \u0644\u062a\u062d\u0645\u064a\u0644 \u0643\u0644 \u0627\u0644\u0645\u062c\u0647\u0632\u064a\u0646 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u064a\u0646.",
    exportExcel: "\u062a\u062d\u0645\u064a\u0644 Excel",
    exportAllCategories: "\u0633\u064a\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u062c\u0645\u064a\u0639 \u0627\u0644\u062a\u0635\u0646\u064a\u0641\u0627\u062a \u0639\u0646\u062f \u0639\u062f\u0645 \u062a\u062d\u062f\u064a\u062f \u0627\u064a \u062a\u0635\u0646\u064a\u0641.",
    exportSelectedCount: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062f {{count}} \u062a\u0635\u0646\u064a\u0641.",
    totalSuppliers: "{{count}} \u0645\u062c\u0647\u0632 \u0645\u0639\u062a\u0645\u062f",
  },
} as const;

function exportText(locale: Locale, key: keyof typeof exportLabels.en, count?: number) {
  const template = exportLabels[locale][key];
  return count === undefined ? template : template.replace("{{count}}", String(count));
}

function textValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function escapeHtml(value: unknown) {
  return textValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function joinLabels(values: string[] | undefined, options: { value: string; labelEn: string; labelAr: string }[], locale: Locale) {
  return (values || []).map((value) => labelFor(options, value, locale)).join(", ");
}

function supplierExportRows(suppliers: Supplier[], locale: Locale, taxonomy: ReturnType<typeof useTaxonomy>["taxonomy"]) {
  return suppliers.map((supplier, index) => ({
    "#": index + 1,
    "Display name": localizedSupplierName(supplier, locale),
    "Original name": supplier.nameOriginal,
    "Arabic name": supplier.nameAr || "",
    "English name": supplier.nameEn || "",
    "Name language": supplier.nameLanguage,
    "Short description": supplier.shortDescription || "",
    "Business type": labelFor(businessTypes, supplier.businessType, locale),
    "Main categories": joinLabels(supplier.categories, taxonomy.supplierCategories, locale),
    "Subcategories": textValue(supplier.subcategories),
    "Capability tags": textValue(supplier.capabilityTags),
    "Governorates": localizedSupplierGovernorates(supplier, taxonomy, locale),
    "Primary governorate": labelFor(governorates, supplier.governorate, locale),
    "City": localizedCity(supplier.city, locale),
    "Market area": supplier.marketArea,
    "Address": supplier.address || "",
    "Google Maps": supplier.googleMapsLink || "",
    "Coverage areas": joinLabels(supplier.coverageAreas, coverageAreas, locale),
    "Phones": textValue(supplier.phones),
    "WhatsApp": supplier.whatsappAvailable,
    "Email": supplier.email || "",
    "Website": supplier.website || "",
    "Facebook": supplier.facebook || "",
    "Instagram / LinkedIn": supplier.instagramLinkedin || "",
    "Contact person": supplier.contactPerson || "",
    "Contact role": supplier.contactPersonRole || "",
    "Branches": (supplier.branches || [])
      .map((branch) => [branch.governorate, branch.city, branch.marketArea, branch.address, branch.phone].filter(Boolean).join(" - "))
      .join(" | "),
    "Payment options": joinLabels(supplier.paymentOptions, paymentOptions, locale),
    "Accepts credit": supplier.acceptsCredit === undefined ? "" : supplier.acceptsCredit ? "Yes" : "No",
    "Credit days": textValue(supplier.creditDays),
    "Credit starts": supplier.creditStart ? labelFor(creditStarts, supplier.creditStart, locale) : "",
    "Credit terms note": supplier.creditTermsNote || "",
    "Source type": labelFor(sourceTypes, supplier.sourceType, locale),
    "Confidence": labelFor(confidenceLevels, supplier.confidenceLevel, locale),
    "Direct experience": supplier.hasDirectExperience,
    "Last interaction year": supplier.lastInteractionYear || "",
    "Related material/service": supplier.relatedMaterialService || "",
    "Source note": supplier.sourceNote || "",
    "Completion score": supplier.completionScore,
    "Average rating": supplier.averageRating || 0,
    "Review count": supplier.reviewCount || 0,
    "Status": supplier.status,
    "Verification": supplier.verificationStatus,
    "Created by": supplier.createdBy,
    "Approved by": supplier.approvedBy,
    "Created at": formatDate(supplier.createdAt, locale),
    "Updated at": formatDate(supplier.updatedAt, locale),
    "Supplier ID": supplier.id,
  }));
}

function downloadSuppliersExcel(suppliers: Supplier[], locale: Locale, taxonomy: ReturnType<typeof useTaxonomy>["taxonomy"]) {
  const rows = supplierExportRows(suppliers, locale, taxonomy);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<table>
<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
<tbody>
${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header as keyof typeof row])}</td>`).join("")}</tr>`).join("\n")}
</tbody>
</table>
</body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mujahiz-approved-suppliers-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AdminApprovedSuppliersPage() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, isOwner } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [exportCategories, setExportCategories] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const exportSuppliers = useMemo(
    () =>
      exportCategories.length
        ? suppliers.filter((supplier) => supplier.categories.some((category) => exportCategories.includes(category)))
        : suppliers,
    [exportCategories, suppliers],
  );

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
    <Section
      title={t("approvedSuppliers")}
      description={exportText(locale, "totalSuppliers", suppliers.length)}
      actions={
        <Button disabled={!exportSuppliers.length} type="button" variant="secondary" onClick={() => downloadSuppliersExcel(exportSuppliers, locale, taxonomy)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {exportText(locale, "exportExcel")}
        </Button>
      }
    >
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="font-bold text-ink">{exportText(locale, "exportTitle")}</div>
        <p className="mt-1 text-sm text-slate-500">{exportText(locale, "exportBody")}</p>
        <div className="mt-3">
          <ChipGroup
            options={taxonomy.supplierCategories.map((item) => ({ value: item.value, label: labelFor(taxonomy.supplierCategories, item.value, locale) }))}
            values={exportCategories}
            onChange={setExportCategories}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-600">
          <span>
            {exportCategories.length
              ? exportText(locale, "exportSelectedCount", exportCategories.length)
              : exportText(locale, "exportAllCategories")}
          </span>
          <span>{exportText(locale, "totalSuppliers", exportSuppliers.length)}</span>
        </div>
      </div>
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
