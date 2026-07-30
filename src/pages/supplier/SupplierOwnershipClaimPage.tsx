import { Building2, CheckCircle2, ExternalLink, History, Search, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DecisionConfirmation,
  OwnershipClaimCard,
} from "../../components/supplierOwnership/SupplierOwnershipComponents";
import { Button, EmptyState, Section, SelectField, TextAreaField, TextField } from "../../components/ui";
import { supplierOwnershipCopy, type SupplierOwnershipLocale } from "../../config/supplierOwnershipCopy";
import { useAuth } from "../../contexts/AuthContext";
import {
  createSupplierOwnershipClaim,
  listMySupplierOwnershipClaims,
  searchSupplierProfilesForClaim,
  withdrawSupplierOwnershipClaim,
} from "../../services/supplierOwnership";
import type {
  SupplierClaimSearchResult,
  SupplierOwnershipClaim,
  SupplierOwnershipEvidenceType,
} from "../../types/domain";
import {
  claimIsExpired,
  generateSupplierOwnershipIdempotencyKey,
  isRetryableSupplierOwnershipError,
  mapSupplierOwnershipError,
  normalizePublicHttpsLink,
  supplierClaimEligibility,
  supplierOwnershipEvidenceTypes,
  supplierOwnershipPayloadSignature,
  validateSupplierOwnershipClaimForm,
  type SupplierOwnershipErrorKey,
  type SupplierOwnershipValidationErrors,
} from "../../utils/supplierOwnershipUi";

const SEARCH_DEBOUNCE_MS = 650;

function resultName(result: SupplierClaimSearchResult, locale: SupplierOwnershipLocale) {
  return (locale === "ar" ? result.nameAr || result.nameEn : result.nameEn || result.nameAr).trim();
}

export function SupplierOwnershipClaimPage() {
  const { i18n } = useTranslation();
  const locale: SupplierOwnershipLocale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = supplierOwnershipCopy[locale];
  const { appUser, emailVerified, firebaseUser, refreshUser } = useAuth();
  const eligibility = supplierClaimEligibility(appUser, emailVerified);
  const [claims, setClaims] = useState<SupplierOwnershipClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<SupplierClaimSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SupplierClaimSearchResult | null>(null);
  const [claimReason, setClaimReason] = useState("");
  const [evidenceType, setEvidenceType] = useState<SupplierOwnershipEvidenceType | "">("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [referenceLinks, setReferenceLinks] = useState(["", "", ""]);
  const [validation, setValidation] = useState<SupplierOwnershipValidationErrors>({});
  const [error, setError] = useState<SupplierOwnershipErrorKey | null>(null);
  const [success, setSuccess] = useState<"submitted" | "withdrawn" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const lastSearchRef = useRef("");
  const searchRequestRef = useRef(0);
  const submissionAttemptRef = useRef<{ signature: string; key: string } | null>(null);

  const loadClaims = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    setClaimsLoading(true);
    try {
      const page = await listMySupplierOwnershipClaims(firebaseUser.uid, 20);
      setClaims(page.items);
      if (page.items.some((claim) => claim.status === "approved")) await refreshUser();
    } catch (caught) {
      setError(mapSupplierOwnershipError(caught));
    } finally {
      setClaimsLoading(false);
    }
  }, [firebaseUser?.uid, refreshUser]);

  useEffect(() => { void loadClaims(); }, [loadClaims]);

  const pendingClaim = useMemo(
    () => claims.find((claim) => claim.status === "pending_review") || null,
    [claims],
  );

  const runSearch = useCallback(async (rawQuery: string) => {
    const normalizedQuery = rawQuery.normalize("NFKC").trim();
    if (normalizedQuery.length < 2 || eligibility !== "eligible" || pendingClaim) return;
    if (lastSearchRef.current === normalizedQuery) return;
    lastSearchRef.current = normalizedQuery;
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      const items = await searchSupplierProfilesForClaim(normalizedQuery, "prefix");
      if (searchRequestRef.current === requestId) setSearchResults(items.slice(0, 10));
    } catch (caught) {
      if (searchRequestRef.current !== requestId) return;
      setSearchResults([]);
      setError(mapSupplierOwnershipError(caught));
    } finally {
      if (searchRequestRef.current === requestId) setSearching(false);
    }
  }, [eligibility, pendingClaim]);

  useEffect(() => {
    const normalizedQuery = searchText.normalize("NFKC").trim();
    if (normalizedQuery.length < 2) {
      searchRequestRef.current += 1;
      lastSearchRef.current = "";
      setSearchResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(() => { void runSearch(normalizedQuery); }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [runSearch, searchText]);

  function updateLink(index: number, value: string) {
    setReferenceLinks((current) => current.map((link, linkIndex) => linkIndex === index ? value : link));
  }

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    if (submitting || !selected) {
      if (!selected) setValidation((current) => ({ ...current, evidenceType: current.evidenceType }));
      return;
    }
    const currentEligibility = supplierClaimEligibility(appUser, emailVerified);
    if (currentEligibility !== "eligible" || pendingClaim) {
      setError(currentEligibility === "eligible" ? "active_claim_exists" : currentEligibility);
      return;
    }
    const nextValidation = validateSupplierOwnershipClaimForm({
      claimReason,
      evidenceType,
      evidenceSummary,
      referenceLinks,
    });
    setValidation(nextValidation);
    if (Object.keys(nextValidation).length) {
      setError("invalid_input");
      return;
    }
    const normalizedLinks = referenceLinks.map((link) => link.trim()).filter(Boolean).map(normalizePublicHttpsLink);
    const payloadBase = {
      supplierProfileId: selected.supplierProfileId,
      claimReason: claimReason.normalize("NFKC").trim(),
      evidenceType: evidenceType as SupplierOwnershipEvidenceType,
      evidenceSummary: evidenceSummary.normalize("NFKC").trim(),
      referenceLinks: normalizedLinks,
    };
    const signature = supplierOwnershipPayloadSignature(payloadBase);
    if (!submissionAttemptRef.current || submissionAttemptRef.current.signature !== signature) {
      submissionAttemptRef.current = { signature, key: generateSupplierOwnershipIdempotencyKey() };
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createSupplierOwnershipClaim({
        ...payloadBase,
        idempotencyKey: submissionAttemptRef.current.key,
      });
      submissionAttemptRef.current = null;
      setSuccess("submitted");
      await loadClaims();
      await refreshUser();
    } catch (caught) {
      const semanticError = mapSupplierOwnershipError(caught);
      setError(semanticError);
      if (!isRetryableSupplierOwnershipError(semanticError)) submissionAttemptRef.current = null;
      if (["already_linked", "active_claim_exists", "supplier_already_owned"].includes(semanticError)) {
        await loadClaims();
        await refreshUser();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function withdrawPendingClaim() {
    if (!pendingClaim || withdrawing || claimIsExpired(pendingClaim.expiresAt)) return;
    setWithdrawing(true);
    setError(null);
    setSuccess(null);
    try {
      await withdrawSupplierOwnershipClaim(pendingClaim.id);
      setConfirmWithdraw(false);
      setSuccess("withdrawn");
      await loadClaims();
      await refreshUser();
    } catch (caught) {
      setError(mapSupplierOwnershipError(caught));
      setConfirmWithdraw(false);
      await loadClaims();
    } finally {
      setWithdrawing(false);
    }
  }

  if (appUser?.supplierProfileId) {
    return (
      <div dir={text.direction}>
        <Section title={text.claim.linkedTitle} description={text.claim.linkedBody}>
          <div className="rounded-[18px] border border-mint/30 bg-successBg p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-mint" />
            <Link className="mt-5 inline-flex" to="/supplier"><Button>{text.claim.openWorkspace}</Button></Link>
          </div>
        </Section>
      </div>
    );
  }

  if (eligibility !== "eligible" && eligibility !== "already_linked") {
    const verification = eligibility === "email_verification_required";
    return (
      <div dir={text.direction}>
        <Section title={verification ? text.claim.verifyTitle : text.claim.ineligibleTitle} description={verification ? text.claim.verifyBody : text.claim.ineligibleBody}>
          <div className="rounded-[18px] border border-amber/30 bg-cream p-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber" />
            {verification ? <Link className="mt-5 inline-flex" to="/verify-email"><Button>{text.claim.verifyAction}</Button></Link> : null}
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div dir={text.direction}>
      <Section
        title={text.claim.title}
        description={text.claim.description}
        actions={<Link to="/supplier/ownership-claims"><Button variant="secondary"><History className="h-4 w-4" />{text.claim.historyAction}</Button></Link>}
      >
        {error ? <div className="rounded-[14px] border border-clay/25 bg-clay/5 p-4 text-sm font-bold text-clay" role="alert">{text.errors[error]}</div> : null}
        {success ? <div className="rounded-[14px] border border-mint/30 bg-successBg p-4 text-sm font-bold text-mint" role="status">{success === "submitted" ? text.claim.submitted : text.claim.withdrawn}</div> : null}
        {claimsLoading ? <EmptyState title={text.claim.loading} /> : pendingClaim ? (
          <div className="grid gap-4 rounded-[18px] border border-amber/30 bg-cream p-5">
            <div><h3 className="text-lg font-black text-ink">{text.claim.pendingTitle}</h3><p className="mt-1 text-sm font-semibold leading-7 text-muted">{text.claim.pendingBody}</p></div>
            <OwnershipClaimCard
              actions={!claimIsExpired(pendingClaim.expiresAt) ? <Button disabled={withdrawing} variant="danger" onClick={() => setConfirmWithdraw(true)}>{text.claim.withdraw}</Button> : undefined}
              claim={pendingClaim}
              locale={locale}
            />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
              <h3 className="text-lg font-black text-ink">{text.claim.searchTitle}</h3>
              <p className="mt-1 text-sm font-semibold leading-7 text-muted">{text.claim.searchDescription}</p>
              <div className="relative mt-4">
                <TextField
                  autoComplete="off"
                  label={text.claim.searchLabel}
                  maxLength={80}
                  minLength={2}
                  placeholder={text.claim.searchPlaceholder}
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    setSelected(null);
                    setError(null);
                  }}
                />
                <Search className="pointer-events-none absolute bottom-3.5 end-3 h-4 w-4 text-muted" />
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted">{text.claim.searchHint}</p>
              <Button className="mt-3" disabled={searching || searchText.trim().length < 2} type="button" variant="secondary" onClick={() => { lastSearchRef.current = ""; void runSearch(searchText); }}><Search className="h-4 w-4" />{text.claim.searchAction}</Button>
              <div className="mt-4 grid gap-3" aria-live="polite">
                {searching ? <EmptyState title={text.claim.searchBusy} /> : searchResults.length ? searchResults.map((result) => (
                  <button
                    className="rounded-[14px] border border-borderSoft bg-creamLight p-4 text-start transition hover:border-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                    key={result.supplierProfileId}
                    type="button"
                    onClick={() => setSelected(result)}
                  >
                    <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber" /><div><div className="font-black text-ink">{resultName(result, locale)}</div><div className="mt-1 text-xs font-semibold text-muted">{[result.governorate, result.city].filter(Boolean).join(" · ") || "—"}</div>{result.website ? <div className="mt-1 text-xs font-bold text-river">{result.website}</div> : null}</div></div>
                  </button>
                )) : searched ? <div><EmptyState title={text.claim.searchEmpty} body={text.claim.searchEmptyBody} /><Link className="mt-3 inline-flex" to="/suppliers/new"><Button variant="secondary">{text.claim.addSupplier}</Button></Link></div> : null}
              </div>
            </div>

            <div className="rounded-[18px] border border-borderSoft bg-white p-5 shadow-card">
              {selected ? (
                <form className="grid gap-4" onSubmit={submitClaim}>
                  <div className="rounded-[14px] border border-mint/30 bg-successBg p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase text-mint">{text.claim.selectedTitle}</div><h3 className="mt-1 text-lg font-black text-ink">{resultName(selected, locale)}</h3><p className="mt-1 text-xs font-semibold text-muted">{[selected.governorate, selected.city].filter(Boolean).join(" · ") || "—"}</p></div><Button type="button" variant="ghost" onClick={() => setSelected(null)}>{text.claim.changeSelection}</Button></div>
                    {selected.website ? <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-river"><ExternalLink className="h-4 w-4" />{selected.website}</div> : null}
                  </div>
                  <div><h3 className="text-lg font-black text-ink">{text.claim.formTitle}</h3><p className="mt-1 text-sm font-semibold leading-7 text-muted">{text.claim.formDescription}</p></div>
                  <TextAreaField label={text.claim.claimReason} maxLength={1200} required hint={validation.claimReason ? (validation.claimReason === "required" ? text.validation.required : text.validation.claimReasonLength) : text.claim.claimReasonHint} value={claimReason} onChange={(event) => setClaimReason(event.target.value)} />
                  <SelectField label={text.claim.evidenceType} required value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as SupplierOwnershipEvidenceType)}>
                    <option value="">—</option>
                    {supplierOwnershipEvidenceTypes.map((type) => <option key={type} value={type}>{text.evidenceTypes[type]}</option>)}
                  </SelectField>
                  {validation.evidenceType ? <p className="-mt-3 text-xs font-bold text-clay">{text.validation.required}</p> : null}
                  <TextAreaField label={text.claim.evidenceSummary} maxLength={1600} required hint={validation.evidenceSummary ? (validation.evidenceSummary === "required" ? text.validation.required : text.validation.evidenceSummaryLength) : text.claim.evidenceSummaryHint} value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} />
                  <fieldset className="grid gap-3"><legend className="text-sm font-bold text-ink">{text.claim.referenceLinks}</legend><p className="text-xs font-semibold leading-5 text-muted">{text.claim.referenceLinksHint}</p>{referenceLinks.map((link, index) => <TextField aria-label={text.claim.referenceLink.replace("{{index}}", String(index + 1))} key={index} label={text.claim.referenceLink.replace("{{index}}", String(index + 1))} maxLength={500} placeholder="https://" type="url" value={link} onChange={(event) => updateLink(index, event.target.value)} />)}{validation.referenceLinks ? <p className="text-xs font-bold text-clay">{validation.referenceLinks === "too_many" ? text.validation.tooManyLinks : validation.referenceLinks === "duplicate" ? text.validation.duplicateLink : text.validation.unsafeLink}</p> : null}</fieldset>
                  <Button disabled={submitting} type="submit">{submitting ? text.claim.submitting : text.claim.submit}</Button>
                </form>
              ) : <EmptyState title={text.claim.selectedTitle} body={text.validation.selectCompany} />}
            </div>
          </div>
        )}
      </Section>
      <DecisionConfirmation
        busy={withdrawing}
        cancelLabel={text.claim.cancel}
        confirmLabel={withdrawing ? text.claim.withdrawing : text.claim.withdraw}
        danger
        open={confirmWithdraw}
        title={text.claim.withdrawTitle}
        body={text.claim.withdrawBody}
        onClose={() => setConfirmWithdraw(false)}
        onConfirm={() => void withdrawPendingClaim()}
      />
    </div>
  );
}