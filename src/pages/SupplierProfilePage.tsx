import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StarRating } from "../components/StarRating";
import { StatusBadge } from "../components/StatusBadge";
import { Button, ChipGroup, EmptyState, Section, SelectField, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import {
  businessTypes,
  capabilityTags,
  confidenceLevels,
  concernReviewTags,
  interactionTypes,
  labelFor,
  positiveReviewTags,
} from "../data/constants";
import { getSupplier, listSupplierReviews, submitSupplierReview } from "../services/firestore";
import type { Supplier, SupplierReview } from "../types/domain";
import { formatDate } from "../utils/date";
import { localizedCity, localizedSupplierGovernorates, localizedSupplierName } from "../utils/supplierDisplay";

const criteria = [
  "overall",
  "responseSpeed",
  "priceClarity",
  "flexibility",
  "deliveryCommitment",
  "contractCommitment",
  "quality",
  "communication",
  "documentation",
] as const;

const blockedCommentTerms = ["idiot", "liar", "scam", "ط­ط±ط§ظ…ظٹ", "ظ†طµط§ط¨", "ظƒط°ط§ط¨"];

export function SupplierProfilePage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, firebaseUser, isAdmin } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [reviews, setReviews] = useState<SupplierReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({
    overall: 5,
    responseSpeed: 5,
    priceClarity: 5,
    flexibility: 5,
    deliveryCommitment: 5,
    contractCommitment: 5,
    quality: 5,
    communication: 5,
    documentation: 5,
    interactionType: "",
    relatedCategory: "",
    positiveTags: [] as string[],
    concernTags: [] as string[],
    comment: "",
    interactionYear: "",
  });

  useEffect(() => {
    if (!id) return;
    const supplierId = id;
    let active = true;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const supplierResult = await getSupplier(supplierId);
        if (!active) return;
        setSupplier(supplierResult);
        if (!supplierResult) {
          setReviews([]);
          return;
        }
        const reviewResult = await listSupplierReviews(supplierId).catch(() => []);
        if (!active) return;
        setReviews(reviewResult);
      } catch (reason) {
        if (!active) return;
        setSupplier(null);
        setReviews([]);
        setMessage(reason instanceof Error ? reason.message : t("noResults"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  if (!id) {
    return null;
  }

  if (loading) {
    return <Section title={t("details")}><EmptyState title={t("loading")} /></Section>;
  }

  if (!supplier) {
    return (
      <Section title={t("details")}>
        <EmptyState title={t("noResults")} body={message || undefined} />
      </Section>
    );
  }

  const setRating = (key: (typeof criteria)[number], value: number) => setReview((current) => ({ ...current, [key]: value }));
  const setTextValue = (key: "interactionType" | "relatedCategory" | "comment" | "interactionYear", value: string) =>
    setReview((current) => ({ ...current, [key]: value }));
  const setTagValue = (key: "positiveTags" | "concernTags", value: string[]) =>
    setReview((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser || !supplier) return;
    if (review.comment.length > 500) {
      setMessage(t("commentTooLong"));
      return;
    }
    if (blockedCommentTerms.some((term) => review.comment.toLowerCase().includes(term))) {
      setMessage(t("professionalReviewRequired"));
      return;
    }
    await submitSupplierReview({
      supplierId: supplier.id,
      supplierName: supplier.displayName || supplier.nameOriginal,
      reviewedBy: firebaseUser.uid,
      ...review,
    });
    setMessage(t("reviewSentForModeration"));
    setReview((current) => ({ ...current, comment: "", positiveTags: [], concernTags: [] }));
  }

  return (
    <Section title={localizedSupplierName(supplier, locale)} description={`${localizedSupplierGovernorates(supplier, taxonomy, locale)} - ${localizedCity(supplier.city, locale)}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-4">
          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <StatusBadge value={supplier.verificationStatus} />
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{supplier.shortDescription || supplier.sourceSummary}</p>
              </div>
              <div>
                <StarRating readOnly value={Math.round(supplier.averageRating || 0)} />
                <div className="mt-1 text-xs font-semibold text-slate-500">{supplier.reviewCount || 0} {t("reviews")}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <div><b>{t("businessType")}:</b> {labelFor(businessTypes, supplier.businessType, locale)}</div>
              <div><b>{t("marketArea")}:</b> {supplier.marketArea}</div>
              <div><b>{t("phone")}:</b> {supplier.phones.join(", ") || "-"}</div>
              <div><b>{t("whatsapp")}:</b> {t(supplier.whatsappAvailable)}</div>
              <div><b>{t("email")}:</b> {supplier.email || "-"}</div>
              <div><b>{t("website")}:</b> {supplier.website || "-"}</div>
              <div><b>{t("contactPerson")}:</b> {supplier.contactPerson || "-"}</div>
              <div><b>{t("confidenceLevel")}:</b> {labelFor(confidenceLevels, supplier.confidenceLevel, locale)}</div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <h3 className="font-bold text-ink">{t("capabilities")}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {supplier.categories.map((category) => (
                <span className="rounded bg-river/10 px-2 py-1 text-xs font-bold text-river" key={category}>
                  {labelFor(taxonomy.supplierCategories, category, locale)}
                </span>
              ))}
              {supplier.capabilityTags.map((tag) => (
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600" key={tag}>
                  {labelFor(capabilityTags, tag, locale)}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <h3 className="font-bold text-ink">{t("reviews")}</h3>
            <div className="mt-3 grid gap-3">
              {reviews.length ? (
                reviews.map((item) => (
                  <div className="rounded border border-slate-200 p-3" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StarRating readOnly value={item.overall} />
                      <span className="text-xs text-slate-500">{formatDate(item.createdAt, locale)}</span>
                    </div>
                    {item.comment ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.comment}</p> : null}
                  </div>
                ))
              ) : (
                <EmptyState title={t("noResults")} />
              )}
            </div>
          </div>
        </div>

        {appUser?.role === "viewer" || appUser?.status === "suspended" ? (
          <div className="h-fit rounded-md border border-slate-200 p-4 text-sm font-semibold text-slate-600">
            {t("submitReview")} · {t("noAccessTitle")}
          </div>
        ) : (
          <form className="grid h-fit gap-4 rounded-md border border-slate-200 p-4" onSubmit={(event) => void handleSubmit(event)}>
            <h3 className="font-bold text-ink">{t("submitReview")}</h3>
            {criteria.map((item) => (
              <StarRating key={item} label={t(item)} value={review[item]} onChange={(value) => setRating(item, value)} />
            ))}
            <SelectField label={t("interactionType")} value={review.interactionType} onChange={(event) => setTextValue("interactionType", event.target.value)} required>
              <option value=""></option>
              {interactionTypes.map((item) => (
                <option key={item.value} value={item.value}>{labelFor(interactionTypes, item.value, locale)}</option>
              ))}
            </SelectField>
            <SelectField label={t("relatedCategory")} value={review.relatedCategory} onChange={(event) => setTextValue("relatedCategory", event.target.value)} required>
              <option value=""></option>
              {taxonomy.supplierCategories.map((item) => (
                <option key={item.value} value={item.value}>{labelFor(taxonomy.supplierCategories, item.value, locale)}</option>
              ))}
            </SelectField>
            <TextField label={t("lastInteractionYear")} value={review.interactionYear} onChange={(event) => setTextValue("interactionYear", event.target.value)} inputMode="numeric" />
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">{t("positiveTags")}</div>
              <ChipGroup options={positiveReviewTags.map((item) => ({ value: item.value, label: labelFor(positiveReviewTags, item.value, locale) }))} values={review.positiveTags} onChange={(values) => setTagValue("positiveTags", values)} />
            </div>
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">{t("concernTags")}</div>
              <ChipGroup options={concernReviewTags.map((item) => ({ value: item.value, label: labelFor(concernReviewTags, item.value, locale) }))} values={review.concernTags} onChange={(values) => setTagValue("concernTags", values)} />
            </div>
            <TextAreaField label={t("comment")} maxLength={500} placeholder={t("professionalCommentPlaceholder")} value={review.comment} onChange={(event) => setTextValue("comment", event.target.value)} />
            {isAdmin ? <div className="rounded bg-slate-50 p-3 text-xs text-slate-500">{t("adminNotes")}: {supplier.sourceSummary}</div> : null}
            {message ? <div className="text-sm font-semibold text-river">{message}</div> : null}
            <Button type="submit">
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("submitReview")}
            </Button>
          </form>
        )}
      </div>
    </Section>
  );
}

