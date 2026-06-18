import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StarRating } from "../components/StarRating";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, Section } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { listMyReviews } from "../services/firestore";
import type { SupplierReview } from "../types/domain";
import { formatDate } from "../utils/date";

export function MyReviewsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser } = useAuth();
  const [reviews, setReviews] = useState<SupplierReview[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    void listMyReviews(firebaseUser.uid).then(setReviews);
  }, [firebaseUser]);

  return (
    <Section title={t("myReviews")} description={t("reviewModeration")}>
      {!reviews.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="grid gap-3">
        {reviews.map((review) => (
          <div className="rounded-md border border-slate-200 p-4" key={review.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">{review.supplierName || review.supplierId}</h3>
                <p className="mt-1 text-sm text-slate-500">{formatDate(review.createdAt, locale)}</p>
              </div>
              <StatusBadge value={review.status} />
            </div>
            <div className="mt-3">
              <StarRating readOnly value={review.overall} />
            </div>
            {review.comment ? <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">{review.comment}</p> : null}
          </div>
        ))}
      </div>
    </Section>
  );
}
