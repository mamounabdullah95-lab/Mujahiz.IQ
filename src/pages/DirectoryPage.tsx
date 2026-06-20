import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleHelp, LoaderCircle, Mail, MapPin, Phone, Search, SlidersHorizontal, Sparkles, X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StarRating } from "../components/StarRating";
import { Button, EmptyState, Section, SelectField, TextAreaField, TextField } from "../components/ui";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { businessTypes, capabilityTags, confidenceLevels, coverageAreas, creditStarts, labelFor, paymentOptions, searchableCapabilityTags } from "../data/constants";
import {
  listSupplierCandidates,
  listSuppliersPage,
  type SupplierPageCursor,
} from "../services/firestore";
import type { Supplier } from "../types/domain";
import { formatDate } from "../utils/date";
import { localizedCity, localizedSupplierGovernorates, localizedSupplierName, localizedSupplierText, supplierGovernorates, supplierSearchText } from "../utils/supplierDisplay";
import {
  describeIntent,
  mergeSupplierSearchIntents,
  parseSupplierSearchLocally,
  recommendSuppliers,
  type SupplierRecommendation,
  type SupplierSearchIntent,
} from "../utils/supplierRecommendations";

export function DirectoryPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { taxonomy } = useTaxonomy();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [supplierCursor, setSupplierCursor] = useState<SupplierPageCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contactOpenId, setContactOpenId] = useState("");
  const [smartQuery, setSmartQuery] = useState("");
  const [smartSearching, setSmartSearching] = useState(false);
  const [smartIntent, setSmartIntent] = useState<SupplierSearchIntent | null>(null);
  const [recommendations, setRecommendations] = useState<SupplierRecommendation[]>([]);
  const [smartSearchMessage, setSmartSearchMessage] = useState("");
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
    void listSuppliersPage(100)
      .then((page) => {
        setSuppliers(page.items);
        setSupplierCursor(page.cursor);
        setHasMore(page.hasMore);
      })
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
      if (filters.governorate && !supplierGovernorates(supplier).includes(filters.governorate)) return false;
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

  async function runSmartSearch() {
    const query = smartQuery.trim();
    if (!query) return;
    setSmartSearching(true);
    setSmartSearchMessage("");
    try {
      const localIntent = parseSupplierSearchLocally(query, taxonomy);
      let aiIntent: Partial<SupplierSearchIntent> | null = null;
      const supplierSearchAI = await import("../services/supplierSearchAI");
      if (supplierSearchAI.isGeminiSupplierSearchEnabled()) {
        try {
          aiIntent = await supplierSearchAI.parseSupplierSearchWithGemini(query, taxonomy);
        } catch {
          setSmartSearchMessage(t("geminiSearchFallback"));
        }
      }
      const intent = mergeSupplierSearchIntents(localIntent, aiIntent);
      setSmartIntent(intent);
      const serverCandidates = intent.categories.length
        ? await listSupplierCandidates(intent.categories).catch(() => [])
        : [];
      const candidatePool = serverCandidates.length
        ? Array.from(new Map([...serverCandidates, ...suppliers].map((item) => [item.id, item])).values())
        : suppliers;
      setRecommendations(recommendSuppliers(candidatePool, intent, taxonomy, locale));
    } finally {
      setSmartSearching(false);
    }
  }

  async function loadMoreSuppliers() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listSuppliersPage(100, supplierCursor);
      setSuppliers((current) =>
        Array.from(new Map([...current, ...page.items].map((item) => [item.id, item])).values()),
      );
      setSupplierCursor(page.cursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Section title={t("directory")} description={t("directoryDescription")}>
      <div className="rounded-md border border-river/25 bg-river/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-river" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-ink">{t("askSupplierDirectory")}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{t("askSupplierDirectoryDescription")}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <TextAreaField
            label={t("procurementRequest")}
            value={smartQuery}
            onChange={(event) => setSmartQuery(event.target.value)}
            placeholder={t("procurementRequestPlaceholder")}
            rows={3}
          />
          <Button disabled={smartSearching || !smartQuery.trim()} type="button" onClick={() => void runSmartSearch()}>
            {smartSearching ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {t("recommendSuppliers")}
          </Button>
        </div>
        {smartSearchMessage ? <p className="mt-2 text-xs font-semibold text-amber">{smartSearchMessage}</p> : null}
        {smartIntent ? (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {describeIntent(smartIntent, taxonomy, locale).map((item) => (
                <span className="rounded bg-white px-2 py-1 text-xs font-bold text-river ring-1 ring-river/15" key={item}>{item}</span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="font-bold text-ink">{t("topSupplierRecommendations")}</h3>
              <span className="text-xs font-semibold text-slate-500">{t("recommendationCount", { count: recommendations.length })}</span>
            </div>
            {recommendations.length ? (
              <div className="mt-3 grid gap-3">
                {recommendations.map((item, index) => (
                  <article className="rounded-md border border-slate-200 bg-white p-4" key={item.supplier.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-river">#{index + 1}</div>
                        <h4 className="mt-1 text-lg font-black text-ink">{localizedSupplierName(item.supplier, locale)}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {localizedSupplierGovernorates(item.supplier, taxonomy, locale)} ·{" "}
                          {item.supplier.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-md bg-mint/10 px-3 py-2 text-center text-mint">
                        <div className="text-2xl font-black">{item.score}%</div>
                        <div className="text-xs font-bold">{t("matchScore")}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.reasons.map((reason) => (
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600" key={reason}>
                          {t(`recommendationReason_${reason}`)}
                        </span>
                      ))}
                    </div>
                    {item.criteria.length ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {item.criteria.map((criterion) => {
                          const Icon = criterion.status === "matched"
                            ? CheckCircle2
                            : criterion.status === "unconfirmed"
                              ? CircleHelp
                              : XCircle;
                          const tone = criterion.status === "matched"
                            ? "border-mint/30 bg-mint/10 text-mint"
                            : criterion.status === "unconfirmed"
                              ? "border-amber/40 bg-amber/10 text-amber"
                              : "border-clay/30 bg-clay/10 text-clay";
                          return (
                            <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${tone}`} key={criterion.key}>
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{t(`recommendationReason_${criterion.key}`)}: {t(
                                criterion.status === "matched"
                                  ? "recommendationMatched"
                                  : criterion.status === "unconfirmed"
                                    ? "recommendationUnconfirmed"
                                    : "recommendationNotMatched",
                              )}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <div><b>{t("paymentOptions")}:</b> {item.supplier.paymentOptions?.map((value) => labelFor(paymentOptions, value, locale)).join(", ") || "-"}</div>
                      <div><b>{t("creditDays")}:</b> {item.supplier.acceptsCredit && item.supplier.creditDays?.length ? item.supplier.creditDays.join(", ") : "-"}</div>
                      <div><b>{t("creditStart")}:</b> {item.supplier.creditStart ? labelFor(creditStarts, item.supplier.creditStart, locale) : "-"}</div>
                    </div>
                    <div className="mt-4">
                      <Link className="inline-flex min-h-9 items-center gap-2 rounded-md bg-river px-3 text-sm font-semibold text-white hover:bg-ink" to={`/suppliers/${item.supplier.id}`}>
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {t("details")}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm font-semibold text-slate-500">{t("noMatchingRecommendations")}</div>
            )}
          </div>
        ) : null}
      </div>

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
            {searchableCapabilityTags.map((item) => (
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
                    {localizedSupplierGovernorates(supplier, taxonomy, locale)} - {localizedCity(supplier.city, locale)}
                  </span>
                  <span>{supplier.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ")}</span>
                </div>
              </div>
              <div className="grid shrink-0 gap-1">
                <StarRating readOnly value={Math.round(supplier.averageRating || 0)} />
                <span className="text-xs font-bold text-ink">{t("ratingOutOfFive", { rating: Number(supplier.averageRating || 0).toFixed(1) })}</span>
                <span className="text-xs font-semibold text-slate-500">{supplier.reviewCount || 0} {t("reviews")}</span>
                <span className="text-xs text-slate-500">{t("lastUpdated")}: {formatDate(supplier.updatedAt, locale)}</span>
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
                <div><b>{t("contactPerson")}:</b> {localizedSupplierText(supplier.contactPerson, locale) || "-"}</div>
                <div><b>{t("address")}:</b> {localizedSupplierText(supplier.address, locale) || "-"}</div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {hasMore ? (
        <div className="flex justify-center">
          <Button disabled={loadingMore} type="button" variant="secondary" onClick={() => void loadMoreSuppliers()}>
            {loadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

