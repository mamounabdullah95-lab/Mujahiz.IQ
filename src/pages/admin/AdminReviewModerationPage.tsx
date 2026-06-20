import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StarRating } from "../../components/StarRating";
import { Button, EmptyState, Section } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { interactionTypes, labelFor } from "../../data/constants";
import { listPendingReviews, moderateReview } from "../../services/firestore";
import type { SupplierReview } from "../../types/domain";

export function AdminReviewModerationPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [reviews, setReviews] = useState<SupplierReview[]>([]);
  const [busyId, setBusyId] = useState("");

  const load = () => listPendingReviews().then(setReviews);
  useEffect(() => {
    void load();
  }, []);

  async function decide(review: SupplierReview, decision: "approved" | "rejected") {
    if (!firebaseUser) return;
    setBusyId(review.id);
    await moderateReview(review, firebaseUser.uid, decision);
    await load();
    setBusyId("");
  }

  return (
    <Section title={t("reviewModeration")} description={t("professionalCommentPlaceholder")}>
      {!reviews.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="grid gap-3">
        {reviews.map((review) => (
          <div className="rounded-md border border-slate-200 p-4" key={review.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">{review.supplierName || review.supplierId}</h3>
                <p className="text-sm text-slate-500">
                  {labelFor(interactionTypes, review.interactionType, locale)} · {labelFor(taxonomy.supplierCategories, review.relatedCategory, locale)}
                </p>
              </div>
              <StarRating readOnly value={review.overall} />
            </div>
            {review.comment ? <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">{review.comment}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button disabled={busyId === review.id} type="button" onClick={() => void decide(review, "approved")}>{t("approve")}</Button>
              <Button disabled={busyId === review.id} type="button" variant="danger" onClick={() => void decide(review, "rejected")}>{t("reject")}</Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
