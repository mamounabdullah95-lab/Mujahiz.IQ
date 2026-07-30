import { ArrowLeft, ArrowRight, Building2, Check, Clock, RefreshCw, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DecisionConfirmation,
  SafeEvidenceLinks,
  SupplierOwnershipStatusBadge,
} from "../../components/supplierOwnership/SupplierOwnershipComponents";
import { Button, EmptyState, Section, TextAreaField } from "../../components/ui";
import { supplierOwnershipCopy, type SupplierOwnershipLocale } from "../../config/supplierOwnershipCopy";
import {
  decideSupplierOwnershipClaim,
  getSupplierOwnershipClaim,
  getSupplierOwnershipReviewProfile,
  listSupplierProfileOwnershipClaims,
  type SupplierOwnershipReviewProfile,
} from "../../services/supplierOwnership";
import type { SupplierOwnershipClaim } from "../../types/domain";
import { formatDate } from "../../utils/date";
import {
  claimIsExpired,
  mapSupplierOwnershipError,
  type SupplierOwnershipErrorKey,
} from "../../utils/supplierOwnershipUi";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl bg-creamLight p-3"><div className="text-xs font-black uppercase text-muted">{label}</div><div className="mt-1 break-words text-sm font-bold text-ink">{value || "—"}</div></div>;
}

function profileName(profile: SupplierOwnershipReviewProfile, locale: SupplierOwnershipLocale) {
  return (locale === "ar" ? profile.nameAr || profile.nameEn : profile.nameEn || profile.nameAr)
    || profile.displayName
    || profile.nameOriginal
    || "—";
}

export function SupplierOwnershipClaimDetailPage() {
  const { claimId } = useParams();
  const { i18n } = useTranslation();
  const locale: SupplierOwnershipLocale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = supplierOwnershipCopy[locale];
  const [claim, setClaim] = useState<SupplierOwnershipClaim | null>(null);
  const [profile, setProfile] = useState<SupplierOwnershipReviewProfile | null>(null);
  const [conflicts, setConflicts] = useState<SupplierOwnershipClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<SupplierOwnershipErrorKey | null>(null);
  const [success, setSuccess] = useState<"approved" | "rejected" | null>(null);
  const [notesError, setNotesError] = useState(false);

  const load = useCallback(async () => {
    if (!claimId) {
      setError("not_found");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loadedClaim = await getSupplierOwnershipClaim(claimId);
      if (!loadedClaim) {
        setClaim(null);
        setError("not_found");
        return;
      }
      const [loadedProfile, pendingClaims] = await Promise.all([
        getSupplierOwnershipReviewProfile(loadedClaim.supplierProfileId),
        listSupplierProfileOwnershipClaims(loadedClaim.supplierProfileId, "pending_review", 21),
      ]);
      setClaim(loadedClaim);
      setProfile(loadedProfile);
      setNotes(loadedClaim.adminNotes || "");
      setConflicts(pendingClaims.items.filter((item) => item.id !== loadedClaim.id).slice(0, 20));
    } catch (caught) {
      setError(mapSupplierOwnershipError(caught));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { void load(); }, [load]);

  function requestDecision(nextDecision: "approve" | "reject") {
    if (!claim || claim.status !== "pending_review" || claimIsExpired(claim.expiresAt) || busy) return;
    if (nextDecision === "reject" && !notes.trim()) {
      setNotesError(true);
      return;
    }
    setNotesError(false);
    setDecision(nextDecision);
  }

  async function submitDecision() {
    if (!claim || !decision || busy) return;
    if (claim.status !== "pending_review" || claimIsExpired(claim.expiresAt)) {
      setDecision(null);
      await load();
      setError("stale_claim");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    const requestedDecision = decision;
    try {
      await decideSupplierOwnershipClaim(claim.id, requestedDecision, notes.trim());
      setDecision(null);
      setSuccess(requestedDecision === "approve" ? "approved" : "rejected");
      await load();
    } catch (caught) {
      const semanticError = mapSupplierOwnershipError(caught);
      setDecision(null);
      if (["stale_claim", "claim_conflict", "claim_expired", "supplier_already_owned"].includes(semanticError)) {
        await load();
      }
      setError(semanticError);
    } finally {
      setBusy(false);
    }
  }

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  if (loading) return <div dir={text.direction}><Section title={text.admin.detailTitle}><EmptyState title={text.admin.loading} /></Section></div>;
  if (!claim || error === "not_found") return <div dir={text.direction}><Section title={text.admin.detailTitle}><EmptyState title={text.errors.not_found} /><Link className="mt-4 inline-flex" to="/admin/ownership-claims"><Button variant="secondary"><BackIcon className="h-4 w-4" />{text.admin.backToQueue}</Button></Link></Section></div>;

  const pending = claim.status === "pending_review" && !claimIsExpired(claim.expiresAt);
  return (
    <div dir={text.direction}>
      <Section
        title={text.admin.detailTitle}
        description={text.admin.detailDescription}
        actions={<Link to="/admin/ownership-claims"><Button variant="secondary"><BackIcon className="h-4 w-4" />{text.admin.backToQueue}</Button></Link>}
      >
        <div className="grid gap-5">
          {error ? <div className="rounded-[14px] border border-clay/25 bg-clay/5 p-4 text-sm font-bold text-clay" role="alert">{text.errors[error]}<Button className="ms-3" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" />{text.admin.refresh}</Button></div> : null}
          {success ? <div className="rounded-[14px] border border-mint/30 bg-successBg p-4 text-sm font-bold text-mint" role="status">{text.admin[success]}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-borderSoft bg-white p-4 shadow-card">
            <SupplierOwnershipStatusBadge locale={locale} status={claim.status} />
            <div className="flex flex-wrap gap-4 text-xs font-bold text-muted"><span>{text.claim.created}: {formatDate(claim.createdAt, locale)}</span><span>{text.claim.expires}: {formatDate(claim.expiresAt, locale)}</span>{claim.reviewedAt ? <span>{text.claim.reviewed}: {formatDate(claim.reviewedAt, locale)}</span> : null}</div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-black text-ink"><UserRound className="h-5 w-5 text-river" />{text.admin.claimantSnapshot}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoRow label={locale === "ar" ? "الاسم" : "Name"} value={claim.claimantSnapshot.fullName} />
                <InfoRow label={locale === "ar" ? "الشركة" : "Organization"} value={claim.claimantSnapshot.organization} />
                <InfoRow label={locale === "ar" ? "المسمى الوظيفي" : "Job title"} value={claim.claimantSnapshot.jobTitle} />
                <InfoRow label={locale === "ar" ? "البريد الإلكتروني" : "Email"} value={claim.claimantSnapshot.email} />
                <InfoRow label={locale === "ar" ? "رقم الهاتف" : "Phone"} value={claim.claimantSnapshot.phone} />
              </div>
            </section>
            <section className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-black text-ink"><Building2 className="h-5 w-5 text-amber" />{text.admin.selectedProfile}</h2>
              {profile ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoRow label={text.admin.company} value={profileName(profile, locale)} /><InfoRow label={text.claim.location} value={[profile.governorate, profile.city].filter(Boolean).join(" · ")} /><InfoRow label={text.claim.categories} value={profile.categories.join(" · ")} /><InfoRow label={text.claim.website} value={profile.website ? (() => { try { return new URL(/^https?:\/\//i.test(profile.website) ? profile.website : `https://${profile.website}`).hostname; } catch { return "—"; } })() : "—"} /></div> : <EmptyState title={text.admin.profileUnavailable} />}
            </section>
          </div>

          <section className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card">
            <h2 className="text-lg font-black text-ink">{text.claim.evidence}</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2"><InfoRow label={text.claim.claimReason} value={claim.claimReason} /><InfoRow label={text.claim.evidenceType} value={text.evidenceTypes[claim.evidenceType]} /><InfoRow label={text.claim.evidenceSummary} value={claim.evidenceSummary} /><InfoRow label={text.claim.referenceLinks} value={<SafeEvidenceLinks links={claim.referenceLinks || []} locale={locale} />} /></div>
          </section>

          <section className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink"><Clock className="h-5 w-5 text-amber" />{text.admin.conflictingClaims}</h2>
            <div className="mt-4 grid gap-2">{conflicts.length ? conflicts.map((conflict) => <Link className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream p-3 text-sm font-bold text-ink hover:ring-2 hover:ring-amber/30" key={conflict.id} to={`/admin/ownership-claims/${conflict.id}`}><span>{conflict.claimantSnapshot.fullName || conflict.claimantSnapshot.organization || "—"}</span><span className="text-xs text-muted">{formatDate(conflict.createdAt, locale)}</span></Link>) : <EmptyState title={text.admin.noConflicts} />}</div>
          </section>

          <section className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card">
            <h2 className="text-lg font-black text-ink">{text.admin.decisionHistory}</h2>
            {claim.decisionEventId || claim.adminNotes ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoRow label={text.admin.eventReference} value={claim.decisionEventId} /><InfoRow label={text.claim.adminNotes} value={claim.adminNotes} /></div> : <p className="mt-3 text-sm font-semibold text-muted">{pending ? text.claim.pendingBody : text.admin.terminal}</p>}
          </section>

          <section className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card">
            {pending ? <div className="grid gap-4"><TextAreaField hint={notesError ? text.validation.adminNotesRequired : text.admin.adminNotesHint} label={text.admin.adminNotes} maxLength={1000} value={notes} onChange={(event) => { setNotes(event.target.value); setNotesError(false); }} /><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => requestDecision("approve")}><Check className="h-4 w-4" />{text.admin.approve}</Button><Button disabled={busy} variant="danger" onClick={() => requestDecision("reject")}><X className="h-4 w-4" />{text.admin.reject}</Button></div></div> : <p className="text-sm font-bold text-muted">{claim.status === "expired" ? text.admin.expired : text.admin.terminal}</p>}
          </section>
        </div>
      </Section>
      <DecisionConfirmation
        busy={busy}
        cancelLabel={text.claim.cancel}
        confirmLabel={decision === "approve" ? (busy ? text.admin.approving : text.admin.approve) : (busy ? text.admin.rejecting : text.admin.reject)}
        danger={decision === "reject"}
        open={decision !== null}
        title={decision === "approve" ? text.admin.approvalTitle : text.admin.rejectionTitle}
        body={decision === "approve" ? text.admin.approvalBody : text.admin.rejectionBody}
        onClose={() => { if (!busy) setDecision(null); }}
        onConfirm={() => void submitDecision()}
      />
    </div>
  );
}