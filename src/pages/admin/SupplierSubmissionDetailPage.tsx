import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, GitMerge, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, EmptyState, Section, TextAreaField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import {
  businessTypes,
  capabilityTags,
  confidenceLevels,
  coverageAreas,
  creditStarts,
  labelFor,
  paymentOptions,
  sourceTypes,
} from "../../data/constants";
import { approveSupplierSubmission, decideSupplierSubmission, getPlatformSettings, getSupplierSubmission } from "../../services/firestore";
import type { DuplicateMatch, SupplierSubmission } from "../../types/domain";
import { formatDate } from "../../utils/date";
import { localizedCity, localizedSupplierGovernorates, localizedSupplierName, localizedSupplierText } from "../../utils/supplierDisplay";

export function SupplierSubmissionDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, refreshUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SupplierSubmission | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getSupplierSubmission(id).then(setSubmission);
  }, [id]);

  if (!submission) {
    return <Section title={t("details")}><EmptyState title={t("loading")} /></Section>;
  }

  const supplier = submission.supplierData;

  async function run(decision: "approved" | "needs_correction" | "rejected" | "possible_duplicate" | "merged") {
    if (!firebaseUser || !submission) return;
    setBusy(true);
    if (decision === "approved") {
      const settings = await getPlatformSettings();
      await approveSupplierSubmission(submission, firebaseUser.uid, settings);
      await refreshUser();
    } else {
      await decideSupplierSubmission(submission, firebaseUser.uid, decision, notes);
    }
    navigate("/admin/submissions");
  }

  return (
    <Section
      title={localizedSupplierName(supplier, locale)}
      description={`${t("submittedAt")}: ${formatDate(submission.createdAt, locale)}`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <StatusBadge value={submission.submissionStatus} />
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {localizedSupplierText(supplier.shortDescription, locale) || t("noDescription")}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-ink">
                {t("completionScore")}: {supplier.completionScore}%
              </div>
            </div>
          </div>

          <InfoPanel title={t("supplierIdentity")}>
            <InfoRow label={t("supplierName")} value={localizedSupplierText(supplier.nameOriginal, locale)} />
            <InfoRow label={t("displayName")} value={localizedSupplierText(supplier.displayName, locale)} />
            <InfoRow label={t("companyNameLanguage")} value={t(`nameLanguage_${supplier.nameLanguage}`)} />
            <InfoRow label={t("businessType")} value={labelFor(businessTypes, supplier.businessType, locale)} />
            <InfoRow label={t("arabicCompanyName")} value={localizedSupplierText(supplier.nameAr, locale)} />
            <InfoRow label={t("englishCompanyName")} value={localizedSupplierText(supplier.nameEn, locale)} />
          </InfoPanel>

          <InfoPanel title={t("location")}>
            <InfoRow label={t("governorate")} value={localizedSupplierGovernorates(supplier, taxonomy, locale)} />
            <InfoRow label={t("city")} value={localizedCity(supplier.city, locale)} />
            <InfoRow label={t("marketArea")} value={localizedSupplierText(supplier.marketArea, locale)} />
            <InfoRow className="md:col-span-2" label={t("address")} value={localizedSupplierText(supplier.address, locale)} />
            <InfoRow className="md:col-span-2" label={t("googleMapsLink")} value={supplier.googleMapsLink} />
            <InfoRow
              className="md:col-span-2"
              label={t("coverageAreas")}
              value={<PillList values={supplier.coverageAreas.map((item) => labelFor(coverageAreas, item, locale))} />}
            />
            <InfoRow
              className="md:col-span-2"
              label={t("supplierBranches")}
              value={(supplier.branches || []).map((branch) =>
                [
                  labelFor(taxonomy.governorates, branch.governorate, locale),
                  localizedCity(branch.city, locale),
                  localizedSupplierText(branch.marketArea, locale),
                  branch.phone,
                ].filter(Boolean).join(" - ")
              ).join(" | ")}
            />
          </InfoPanel>

          <InfoPanel title={t("contactInfo")}>
            <InfoRow label={t("phone")} value={supplier.phones.join(", ")} />
            <InfoRow label={t("whatsapp")} value={t(supplier.whatsappAvailable)} />
            <InfoRow label={t("email")} value={supplier.email} />
            <InfoRow label={t("website")} value={supplier.website} />
            <InfoRow label={t("facebook")} value={supplier.facebook} />
            <InfoRow label={t("instagramLinkedin")} value={supplier.instagramLinkedin} />
            <InfoRow label={t("contactPerson")} value={localizedSupplierText(supplier.contactPerson, locale)} />
            <InfoRow label={t("contactPersonRole")} value={localizedSupplierText(supplier.contactPersonRole, locale)} />
          </InfoPanel>

          <InfoPanel title={t("capabilities")}>
            <InfoRow
              className="md:col-span-2"
              label={t("mainCategory")}
              value={<PillList tone="river" values={supplier.categories.map((item) => labelFor(taxonomy.supplierCategories, item, locale))} />}
            />
            <InfoRow label={t("subcategories")} value={supplier.subcategories.map((item) => localizedSupplierText(item, locale)).join(", ")} />
            <InfoRow
              className="md:col-span-2"
              label={t("capabilityTags")}
              value={<PillList values={supplier.capabilityTags.map((item) => labelFor(capabilityTags, item, locale))} />}
            />
            <InfoRow
              className="md:col-span-2"
              label={t("paymentOptions")}
              value={<PillList values={supplier.paymentOptions.map((item) => labelFor(paymentOptions, item, locale))} />}
            />
            <InfoRow label={t("acceptsCredit")} value={supplier.acceptsCredit === true ? t("yes") : supplier.acceptsCredit === false ? t("no") : t("unknown")} />
            <InfoRow label={t("creditDays")} value={supplier.creditDays?.join(", ")} />
            <InfoRow label={t("creditStart")} value={supplier.creditStart ? labelFor(creditStarts, supplier.creditStart, locale) : "-"} />
            <InfoRow label={t("creditTermsNote")} value={localizedSupplierText(supplier.creditTermsNote, locale)} />
          </InfoPanel>

          <InfoPanel title={t("sourceConfidence")}>
            <InfoRow label={t("sourceType")} value={labelFor(sourceTypes, supplier.sourceType, locale)} />
            <InfoRow label={t("confidenceLevel")} value={labelFor(confidenceLevels, supplier.confidenceLevel, locale)} />
            <InfoRow label={t("directExperience")} value={t(supplier.hasDirectExperience)} />
            <InfoRow label={t("lastInteractionYear")} value={supplier.lastInteractionYear} />
            <InfoRow label={t("relatedMaterialService")} value={localizedSupplierText(supplier.relatedMaterialService, locale)} />
            <InfoRow className="md:col-span-2" label={t("sourceNote")} value={localizedSupplierText(supplier.sourceNote, locale)} />
          </InfoPanel>

          <DuplicatePanel locale={locale} matches={submission.duplicateCheck.matches} />
        </div>

        <div className="grid h-fit gap-3 rounded-md border border-slate-200 p-4">
          <TextAreaField label={t("adminNotes")} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button disabled={busy} type="button" onClick={() => void run("approved")}>
            <Check className="h-4 w-4" aria-hidden="true" />
            {t("approve")}
          </Button>
          <Button disabled={busy} type="button" variant="secondary" onClick={() => void run("needs_correction")}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("requestCorrection")}
          </Button>
          <Button disabled={busy} type="button" variant="secondary" onClick={() => void run("possible_duplicate")}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {t("markDuplicate")}
          </Button>
          <Button disabled={busy} type="button" variant="secondary" onClick={() => void run("merged")}>
            <GitMerge className="h-4 w-4" aria-hidden="true" />
            {t("merge")}
          </Button>
          <Button disabled={busy} type="button" variant="danger" onClick={() => void run("rejected")}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("reject")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="font-bold text-ink">{title}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-ink">{value || "-"}</div>
    </div>
  );
}

function PillList({ values, tone = "slate" }: { values: string[]; tone?: "slate" | "river" }) {
  if (!values.length) return "-";
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          className={tone === "river" ? "rounded bg-river/10 px-2 py-1 text-xs font-bold text-river" : "rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600"}
          key={value}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function DuplicatePanel({ locale, matches }: { locale: "en" | "ar"; matches: DuplicateMatch[] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-amber/40 bg-amber/10 p-4">
      <h3 className="font-bold text-ink">{t("duplicateWarning")}</h3>
      <div className="mt-3 grid gap-2">
        {matches.length ? (
          matches.map((match) => (
            <div className="rounded border border-amber/30 bg-white p-3 text-sm" key={`${match.supplierId}-${match.reason}`}>
              <div className="font-bold text-ink">{localizedSupplierText(match.supplierName, locale)}</div>
              <div className="mt-1 text-slate-600">
                {t("duplicateReason")}: {t(`duplicate_${match.reason}`)} - {t(match.confidence)} - {match.score}%
              </div>
            </div>
          ))
        ) : (
          <span className="text-sm text-slate-600">{t("noDuplicateWarning")}</span>
        )}
      </div>
    </div>
  );
}
