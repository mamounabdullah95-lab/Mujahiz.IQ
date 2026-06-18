import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StarRating } from "../components/StarRating";
import { Button, EmptyState, Section, SelectField, TextField } from "../components/ui";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { businessTypes, capabilityTags, confidenceLevels, coverageAreas, labelFor } from "../data/constants";
import { listSuppliers } from "../services/firestore";
import type { Supplier } from "../types/domain";
import { localizedCity, localizedSupplierName, supplierSearchText } from "../utils/supplierDisplay";

export function DirectoryPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { taxonomy } = useTaxonomy();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contactOpenId, setContactOpenId] = useState("");
  const [filters, setFilters] = useState({
    query: "",
    governorate: "",
    category: "",
    minRating: "",
    capabilityTag: "",
    businessType: "",
    confidenceLevel: "",
    coverageArea: "",
  });

  useEffect(() => {
    void listSuppliers()
      .then(setSuppliers)
      .finally(() => setLoading(false));
  }, []);

  const searchableSuppliers = useMemo(
    () => suppliers.map((supplier) => ({ supplier, searchText: supplierSearchText(supplier, taxonomy) })),
    [suppliers, taxonomy],
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchableSuppliers, {
        keys: ["searchText"],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [searchableSuppliers],
  );

  const filtered = useMemo(() => {
    const source = filters.query ? fuse.search(filters.query).map((result) => result.item.supplier) : suppliers;
    return source.filter((supplier) => {
      if (filters.governorate && supplier.governorate !== filters.governorate) return false;
      if (filters.category && !supplier.categories.includes(filters.category)) return false;
      if (filters.minRating && supplier.averageRating < Number(filters.minRating)) return false;
      if (filters.capabilityTag && !supplier.capabilityTags.includes(filters.capabilityTag)) return false;
      if (filters.businessType && supplier.businessType !== filters.businessType) return false;
      if (filters.confidenceLevel && supplier.confidenceLevel !== filters.confidenceLevel) return false;
      if (filters.coverageArea && !supplier.coverageAreas.includes(filters.coverageArea)) return false;
      return true;
    });
  }, [filters, fuse, suppliers]);

  const setValue = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () =>
    setFilters({
      query: "",
      governorate: "",
      category: "",
      minRating: "",
      capabilityTag: "",
      businessType: "",
      confidenceLevel: "",
      coverageArea: "",
    });

  return (
    <Section title={t("directory")} description={t("search")}>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <TextField label={t("search")} value={filters.query} onChange={(event) => setValue("query", event.target.value)} />
        <SelectField label={t("governorate")} value={filters.governorate} onChange={(event) => setValue("governorate", event.target.value)}>
          <option value="">{t("allIraq")}</option>
          {taxonomy.governorates.map((item) => (
            <option key={item.value} value={item.value}>
              {labelFor(taxonomy.governorates, item.value, locale)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("mainCategory")} value={filters.category} onChange={(event) => setValue("category", event.target.value)}>
          <option value="">{t("all")}</option>
          {taxonomy.supplierCategories.map((item) => (
            <option key={item.value} value={item.value}>
              {labelFor(taxonomy.supplierCategories, item.value, locale)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("rating")} value={filters.minRating} onChange={(event) => setValue("minRating", event.target.value)}>
          <option value="">{t("all")}</option>
          <option value="4">4+</option>
          <option value="3">3+</option>
          <option value="2">2+</option>
        </SelectField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setValue("query", filters.query.trim())}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {t("search")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowAdvanced((current) => !current)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("advancedSearch")}
        </Button>
      </div>

      {showAdvanced ? (
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2 xl:grid-cols-4">
          <SelectField label={t("capabilityTags")} value={filters.capabilityTag} onChange={(event) => setValue("capabilityTag", event.target.value)}>
            <option value="">{t("all")}</option>
            {capabilityTags.map((item) => (
              <option key={item.value} value={item.value}>{labelFor(capabilityTags, item.value, locale)}</option>
            ))}
          </SelectField>
          <SelectField label={t("businessType")} value={filters.businessType} onChange={(event) => setValue("businessType", event.target.value)}>
            <option value="">{t("all")}</option>
            {businessTypes.map((item) => (
              <option key={item.value} value={item.value}>{labelFor(businessTypes, item.value, locale)}</option>
            ))}
          </SelectField>
          <SelectField label={t("confidenceLevel")} value={filters.confidenceLevel} onChange={(event) => setValue("confidenceLevel", event.target.value)}>
            <option value="">{t("all")}</option>
            {confidenceLevels.map((item) => (
              <option key={item.value} value={item.value}>{labelFor(confidenceLevels, item.value, locale)}</option>
            ))}
          </SelectField>
          <SelectField label={t("coverageAreas")} value={filters.coverageArea} onChange={(event) => setValue("coverageArea", event.target.value)}>
            <option value="">{t("all")}</option>
            {coverageAreas.map((item) => (
              <option key={item.value} value={item.value}>{labelFor(coverageAreas, item.value, locale)}</option>
            ))}
          </SelectField>
          <div className="lg:col-span-2 xl:col-span-4">
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              {t("clear")}
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? <EmptyState title={t("loading")} /> : null}
      {!loading && !filtered.length ? <EmptyState title={t("noResults")} /> : null}

      <div className="grid gap-3">
        {filtered.map((supplier) => (
          <article className="rounded-md border border-slate-200 p-4" key={supplier.id}>
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-ink">{localizedSupplierName(supplier, locale)}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {labelFor(taxonomy.governorates, supplier.governorate, locale)} - {localizedCity(supplier.city, locale)}
                  </span>
                  <span>{supplier.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")}</span>
                </div>
              </div>
              <div className="grid shrink-0 gap-1">
                <StarRating readOnly value={Math.round(supplier.averageRating || 0)} />
                <span className="text-xs font-semibold text-slate-500">{supplier.reviewCount || 0} {t("reviews")}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {supplier.capabilityTags.slice(0, 6).map((tag) => (
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600" key={tag}>
                  {labelFor(capabilityTags, tag, locale)}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {supplier.phones[0] ? (
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-river hover:text-river" type="button" onClick={() => setContactOpenId(contactOpenId === supplier.id ? "" : supplier.id)}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {t("contactInfo")}
                </button>
              ) : null}
              {supplier.email ? (
                <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-river hover:text-river" href={`mailto:${supplier.email.trim()}`}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {t("email")}
                </a>
              ) : null}
              <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-river px-3 text-sm font-semibold text-white hover:bg-ink" to={`/suppliers/${supplier.id}`}>
                <Search className="h-4 w-4" aria-hidden="true" />
                {t("details")}
              </Link>
            </div>
            {contactOpenId === supplier.id ? (
              <div className="mt-3 grid gap-2 break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-2">
                <div><b>{t("phone")}:</b> {supplier.phones.join(", ") || "-"}</div>
                <div><b>{t("whatsapp")}:</b> {t(supplier.whatsappAvailable)}</div>
                <div><b>{t("email")}:</b> {supplier.email || "-"}</div>
                <div><b>{t("website")}:</b> {supplier.website || "-"}</div>
                <div><b>{t("contactPerson")}:</b> {supplier.contactPerson || "-"}</div>
                <div><b>{t("address")}:</b> {supplier.address || "-"}</div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}

