import { type FormEvent, useEffect, useState } from "react";
import { Flag, MessageSquareText, Pencil, Send, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
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
  creditStarts,
  interactionTypes,
  labelFor,
  paymentOptions,
  positiveReviewTags,
} from "../data/constants";
import {
  getSupplier,
  listMySupplierFeedback,
  listSupplierReviews,
  submitSupplierFeedback,
  submitSupplierReview,
} from "../services/firestore";
import type { Supplier, SupplierFeedback, SupplierFeedbackType, SupplierReview } from "../types/domain";
import { formatDate } from "../utils/date";
import { localizedCity, localizedSupplierGovernorates, localizedSupplierName, localizedSupplierText } from "../utils/supplierDisplay";

const reviewCriteria = [
  "overall",
  "responseSpeed",
  "technicalCompliance",
  "technicalKnowledge",
  "deliveryCommitment",
  "contractCommitment",
  "quality",
  "communication",
  "documentation",
] as const;

const feedbackTypes: SupplierFeedbackType[] = [
  "incorrect_information",
  "contact_issue",
  "location_issue",
  "category_issue",
  "duplicate_supplier",
  "business_closed",
  "other",
];

const blockedCommentTerms = ["idiot", "liar", "scam", "حرامي", "نصاب", "كذاب"];

export function SupplierProfilePage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, firebaseUser, isAdmin } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [reviews, setReviews] = useState<SupplierReview[]>([]);
  const [myFeedback, setMyFeedback] = useState<SupplierFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewMessage, setReviewMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({
    type: "incorrect_information" as SupplierFeedbackType,
    message: "",
    suggestedCorrection: "",
  });
  const [review, setReview] = useState({
    overall: 5,
    responseSpeed: 5,
    technicalCompliance: 5,
    technicalKnowledge: 5,
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
      setReviewMessage("");
      try {
        const supplierResult = await getSupplier(supplierId);
        if (!active) return;
        setSupplier(supplierResult);
        if (!supplierResult) {
          setReviews([]);
          setMyFeedback([]);
          return;
        }
        const [reviewResult, feedbackResult] = await Promise.all([
          listSupplierReviews(supplierId).catch(() => []),
          firebaseUser ? listMySupplierFeedback(firebaseUser.uid).catch(() => []) : Promise.resolve([]),
        ]);
        if (!active) return;
        setReviews(reviewResult);
        setMyFeedback(feedbackResult.filter((item) => item.supplierId === supplierId));
      } catch (reason) {
        if (!active) return;
        setSupplier(null);
        setReviews([]);
        setMyFeedback([]);
        setReviewMessage(reason instanceof Error ? reason.message : t("noResults"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [firebaseUser, id, t]);

  if (!id) return null;

  if (loading) {
    return <Section title={t("details")}><EmptyState title={t("loading")} /></Section>;
  }

  if (!supplier) {
    return (
      <Section title={t("details")}>
        <EmptyState title={t("noResults")} body={reviewMessage || undefined} />
      </Section>
    );
  }

  const canContribute = appUser?.role !== "viewer" && appUser?.role !== "suspended" && appUser?.status !== "suspended";
  const averageRating = Number(supplier.averageRating || 0);

  const setRating = (key: (typeof reviewCriteria)[number], value: number) =>
    setReview((current) => ({ ...current, [key]: value }));
  const setReviewText = (key: "interactionType" | "relatedCategory" | "comment" | "interactionYear", value: string) =>
    setReview((current) => ({ ...current, [key]: value }));
  const setTagValue = (key: "positiveTags" | "concernTags", value: string[]) =>
    setReview((current) => ({ ...current, [key]: value }));

  async function handleReviewSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser || !supplier) return;
    if (review.comment.length > 500) {
      setReviewMessage(t("commentTooLong"));
      return;
    }
    if (blockedCommentTerms.some((term) => review.comment.toLowerCase().includes(term))) {
      setReviewMessage(t("professionalReviewRequired"));
      return;
    }
    setBusy(true);
    try {
      await submitSupplierReview({
        supplierId: supplier.id,
        supplierName: supplier.displayName || supplier.nameOriginal,
        reviewedBy: firebaseUser.uid,
        ...review,
      });
      setReviewMessage(t("reviewSentForModeration"));
      setReview((current) => ({ ...current, comment: "", positiveTags: [], concernTags: [] }));
      setShowReviewForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleFeedbackSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser || !supplier || feedback.message.trim().length < 10) return;
    setBusy(true);
    setFeedbackMessage("");
    try {
      await submitSupplierFeedback(
        firebaseUser.uid,
        supplier,
        feedback.type,
        feedback.message,
        feedback.suggestedCorrection,
      );
      const nextFeedback = await listMySupplierFeedback(firebaseUser.uid);
      setMyFeedback(nextFeedback.filter((item) => item.supplierId === supplier.id));
      setFeedback({ type: "incorrect_information", message: "", suggestedCorrection: "" });
      setFeedbackMessage(t("feedbackSubmitted"));
      setShowFeedbackForm(false);
    } catch {
      setFeedbackMessage(t("feedbackSubmitFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={localizedSupplierName(supplier, locale)}
      description={`${localizedSupplierGovernorates(supplier, taxonomy, locale)} - ${localizedCity(supplier.city, locale)}`}
      actions={
        <>
          {canContribute ? (
            <Button type="button" variant="secondary" onClick={() => setShowFeedbackForm((current) => !current)}>
              {showFeedbackForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Flag className="h-4 w-4" aria-hidden="true" />}
              {t("supplierFeedback")}
            </Button>
          ) : null}
          {isAdmin ? (
            <Link to={`/admin/suppliers/${supplier.id}/edit`}>
              <Button type="button" variant="secondary">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t("edit")}
              </Button>
            </Link>
          ) : null}
        </>
      }
    >
      {feedbackMessage ? (
        <div className="rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
          {feedbackMessage}
        </div>
      ) : null}

      {showFeedbackForm ? (
        <form className="grid gap-4 rounded-md border border-amber/40 bg-amber/5 p-4" onSubmit={(event) => void handleFeedbackSubmit(event)}>
          <div>
            <h3 className="font-bold text-ink">{t("supplierFeedback")}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{t("supplierFeedbackDescription")}</p>
          </div>
          <SelectField
            label={t("feedbackType")}
            value={feedback.type}
            onChange={(event) => setFeedback((current) => ({ ...current, type: event.target.value as SupplierFeedbackType }))}
          >
            {feedbackTypes.map((type) => (
              <option key={type} value={type}>{t(`feedbackType_${type}`)}</option>
            ))}
          </SelectField>
          <TextAreaField
            label={t("feedbackMessage")}
            value={feedback.message}
            onChange={(event) => setFeedback((current) => ({ ...current, message: event.target.value }))}
            placeholder={t("feedbackMessagePlaceholder")}
            minLength={10}
            maxLength={1000}
            required
          />
          <TextAreaField
            label={t("suggestedCorrection")}
            value={feedback.suggestedCorrection}
            onChange={(event) => setFeedback((current) => ({ ...current, suggestedCorrection: event.target.value }))}
            placeholder={t("suggestedCorrectionPlaceholder")}
            maxLength={1000}
          />
          <div>
            <Button disabled={busy || feedback.message.trim().length < 10} type="submit">
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("submitFeedback")}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <StatusBadge value={supplier.verificationStatus} />
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {localizedSupplierText(supplier.shortDescription || supplier.sourceSummary, locale) || t("noDescription")}
            </p>
          </div>
          <div className="shrink-0 rounded-md bg-slate-50 p-3 text-center">
            <StarRating readOnly value={Math.round(averageRating)} />
            <div className="mt-1 font-bold text-ink">{t("ratingOutOfFive", { rating: averageRating.toFixed(1) })}</div>
            <div className="text-xs font-semibold text-slate-500">{supplier.reviewCount || 0} {t("reviews")}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
          <div><b>{t("businessType")}:</b> {labelFor(businessTypes, supplier.businessType, locale)}</div>
          <div><b>{t("marketArea")}:</b> {localizedSupplierText(supplier.marketArea, locale) || "-"}</div>
          <div><b>{t("phone")}:</b> {supplier.phones.join(", ") || "-"}</div>
          <div><b>{t("whatsapp")}:</b> {t(supplier.whatsappAvailable)}</div>
          <div><b>{t("email")}:</b> {supplier.email || "-"}</div>
          <div><b>{t("website")}:</b> {supplier.website || "-"}</div>
          <div><b>{t("contactPerson")}:</b> {localizedSupplierText(supplier.contactPerson, locale) || "-"}</div>
          <div><b>{t("confidenceLevel")}:</b> {labelFor(confidenceLevels, supplier.confidenceLevel, locale)}</div>
          <div><b>{t("lastUpdated")}:</b> {formatDate(supplier.updatedAt, locale)}</div>
          <div><b>{t("paymentOptions")}:</b> {supplier.paymentOptions?.map((item) => labelFor(paymentOptions, item, locale)).join(", ") || "-"}</div>
          <div><b>{t("acceptsCredit")}:</b> {supplier.acceptsCredit === true ? t("yes") : supplier.acceptsCredit === false ? t("no") : t("unknown")}</div>
          <div><b>{t("creditDays")}:</b> {supplier.creditDays?.join(", ") || "-"}</div>
          <div><b>{t("creditStart")}:</b> {supplier.creditStart ? labelFor(creditStarts, supplier.creditStart, locale) : "-"}</div>
        </div>
        {supplier.creditTermsNote ? (
          <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">
            {localizedSupplierText(supplier.creditTermsNote, locale)}
          </p>
        ) : null}
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
        {supplier.subcategories?.length ? (
          <p className="mt-3 text-sm text-slate-600">
            <b>{t("subcategories")}:</b> {supplier.subcategories.map((item) => localizedSupplierText(item, locale)).join(", ")}
          </p>
        ) : null}
      </div>

      {supplier.branches?.length ? (
        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="font-bold text-ink">{t("supplierBranches")}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {supplier.branches.map((branch, index) => (
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700" key={`${branch.governorate}-${branch.city}-${index}`}>
                <div className="font-bold text-ink">
                  {labelFor(taxonomy.governorates, branch.governorate, locale)} - {localizedCity(branch.city, locale)}
                </div>
                {branch.marketArea ? <div className="mt-2"><b>{t("marketArea")}:</b> {localizedSupplierText(branch.marketArea, locale)}</div> : null}
                {branch.address ? <div className="mt-1"><b>{t("address")}:</b> {localizedSupplierText(branch.address, locale)}</div> : null}
                {branch.phone ? <div className="mt-1"><b>{t("phone")}:</b> {branch.phone}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {myFeedback.length ? (
        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="font-bold text-ink">{t("feedbackHistory")}</h3>
          <div className="mt-3 grid gap-2">
            {myFeedback.map((item) => (
              <div className="rounded-md bg-slate-50 p-3 text-sm" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-ink">{t(`feedbackType_${item.type}`)}</span>
                  <span className="rounded bg-white px-2 py-1 text-xs font-bold text-slate-600">
                    {t(`feedbackStatus_${item.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-slate-600">{item.message}</p>
                {item.adminNotes ? <p className="mt-2 border-t border-slate-200 pt-2 text-slate-600"><b>{t("feedbackAdminNotes")}:</b> {item.adminNotes}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-ink">{t("reviews")}</h3>
          {canContribute ? (
            <Button type="button" variant="secondary" onClick={() => setShowReviewForm((current) => !current)}>
              {showReviewForm ? <X className="h-4 w-4" aria-hidden="true" /> : <MessageSquareText className="h-4 w-4" aria-hidden="true" />}
              {t(showReviewForm ? "hideReviewForm" : "writeReview")}
            </Button>
          ) : null}
        </div>

        {showReviewForm && canContribute ? (
          <form className="mt-4 grid gap-4 rounded-md bg-slate-50 p-4" onSubmit={(event) => void handleReviewSubmit(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              {reviewCriteria.map((item) => (
                <StarRating key={item} label={t(item)} value={review[item]} onChange={(value) => setRating(item, value)} />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label={t("interactionType")} value={review.interactionType} onChange={(event) => setReviewText("interactionType", event.target.value)} required>
                <option value=""></option>
                {interactionTypes.map((item) => (
                  <option key={item.value} value={item.value}>{labelFor(interactionTypes, item.value, locale)}</option>
                ))}
              </SelectField>
              <SelectField label={t("relatedCategory")} value={review.relatedCategory} onChange={(event) => setReviewText("relatedCategory", event.target.value)} required>
                <option value=""></option>
                {taxonomy.supplierCategories.map((item) => (
                  <option key={item.value} value={item.value}>{labelFor(taxonomy.supplierCategories, item.value, locale)}</option>
                ))}
              </SelectField>
              <TextField label={t("lastInteractionYear")} value={review.interactionYear} onChange={(event) => setReviewText("interactionYear", event.target.value)} inputMode="numeric" />
            </div>
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">{t("positiveTags")}</div>
              <ChipGroup options={positiveReviewTags.map((item) => ({ value: item.value, label: labelFor(positiveReviewTags, item.value, locale) }))} values={review.positiveTags} onChange={(values) => setTagValue("positiveTags", values)} />
            </div>
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">{t("concernTags")}</div>
              <ChipGroup options={concernReviewTags.map((item) => ({ value: item.value, label: labelFor(concernReviewTags, item.value, locale) }))} values={review.concernTags} onChange={(values) => setTagValue("concernTags", values)} />
            </div>
            <TextAreaField label={t("comment")} maxLength={500} placeholder={t("professionalCommentPlaceholder")} value={review.comment} onChange={(event) => setReviewText("comment", event.target.value)} />
            {reviewMessage ? <div className="text-sm font-semibold text-river">{reviewMessage}</div> : null}
            <div>
              <Button disabled={busy} type="submit">
                <Send className="h-4 w-4" aria-hidden="true" />
                {t("submitReview")}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 grid gap-3">
          {reviews.length ? (
            reviews.map((item) => (
              <div className="rounded border border-slate-200 p-3" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StarRating readOnly value={item.overall} />
                    <b className="text-sm text-ink">{t("ratingOutOfFive", { rating: Number(item.overall || 0).toFixed(1) })}</b>
                  </div>
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
    </Section>
  );
}
