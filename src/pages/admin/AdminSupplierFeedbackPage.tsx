import { CheckCircle2, ExternalLink, SearchCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Section, TextAreaField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { listSupplierFeedback, updateSupplierFeedbackStatus } from "../../services/firestore";
import type { SupplierFeedback, SupplierFeedbackStatus } from "../../types/domain";
import { formatDate } from "../../utils/date";

const allStatuses: SupplierFeedbackStatus[] = ["pending", "in_review", "resolved", "rejected"];

export function AdminSupplierFeedbackPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<SupplierFeedback[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const result = await listSupplierFeedback(allStatuses);
    setItems(result);
    setNotes((current) =>
      Object.fromEntries(result.map((item) => [item.id, current[item.id] ?? item.adminNotes ?? ""])),
    );
  };

  useEffect(() => {
    void load();
  }, []);

  async function decide(
    feedback: SupplierFeedback,
    status: Exclude<SupplierFeedbackStatus, "pending">,
  ) {
    if (!firebaseUser) return;
    setBusyId(feedback.id);
    setMessage("");
    try {
      await updateSupplierFeedbackStatus(feedback, firebaseUser.uid, status, notes[feedback.id] || "");
      setMessage(t("feedbackDecisionSaved"));
      await load();
    } finally {
      setBusyId("");
    }
  }

  return (
    <Section title={t("supplierFeedbackAdmin")} description={t("feedbackAdminDescription")}>
      {message ? (
        <div className="rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
          {message}
        </div>
      ) : null}
      {!items.length ? <EmptyState title={t("noSupplierFeedback")} /> : null}
      <div className="grid gap-4">
        {items.map((feedback) => (
          <article className="rounded-md border border-slate-200 p-4" key={feedback.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-ink">
                    {locale === "ar"
                      ? feedback.supplierNameAr || feedback.supplierName
                      : feedback.supplierNameEn || feedback.supplierName}
                  </h3>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                    {t(`feedbackStatus_${feedback.status}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-river">{t(`feedbackType_${feedback.type}`)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(feedback.createdAt, locale)}</p>
              </div>
              <Link
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-ink hover:border-river hover:text-river"
                to={`/suppliers/${feedback.supplierId}`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("feedbackOpenSupplier")}
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-xs font-bold text-slate-500">{t("feedbackMessage")}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{feedback.message}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-xs font-bold text-slate-500">{t("suggestedCorrection")}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {feedback.suggestedCorrection || "-"}
                </p>
              </div>
            </div>

            <TextAreaField
              className="mt-4"
              label={t("feedbackAdminNotes")}
              value={notes[feedback.id] || ""}
              onChange={(event) => setNotes((current) => ({ ...current, [feedback.id]: event.target.value }))}
              maxLength={1000}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busyId === feedback.id || feedback.status === "in_review"}
                type="button"
                variant="secondary"
                onClick={() => void decide(feedback, "in_review")}
              >
                <SearchCheck className="h-4 w-4" aria-hidden="true" />
                {t("feedbackDecision_in_review")}
              </Button>
              <Button
                disabled={busyId === feedback.id || feedback.status === "resolved"}
                type="button"
                onClick={() => void decide(feedback, "resolved")}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t("feedbackDecision_resolved")}
              </Button>
              <Button
                disabled={busyId === feedback.id || feedback.status === "rejected"}
                type="button"
                variant="danger"
                onClick={() => void decide(feedback, "rejected")}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {t("feedbackDecision_rejected")}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
