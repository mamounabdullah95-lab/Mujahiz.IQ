import { ArrowLeft, ArrowRight, Building2, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SupplierOwnershipStatusBadge } from "../../components/supplierOwnership/SupplierOwnershipComponents";
import { Button, EmptyState, Section, SelectField } from "../../components/ui";
import { supplierOwnershipCopy, type SupplierOwnershipLocale } from "../../config/supplierOwnershipCopy";
import {
  getSupplierOwnershipReviewProfile,
  listAdminSupplierOwnershipClaims,
  type SupplierOwnershipClaimCursor,
  type SupplierOwnershipReviewProfile,
} from "../../services/supplierOwnership";
import type { SupplierOwnershipClaim, SupplierOwnershipClaimStatus } from "../../types/domain";
import { formatDate } from "../../utils/date";
import {
  mapSupplierOwnershipError,
  supplierOwnershipStatuses,
  type SupplierOwnershipErrorKey,
} from "../../utils/supplierOwnershipUi";

function profileName(profile: SupplierOwnershipReviewProfile | null | undefined, locale: SupplierOwnershipLocale) {
  if (!profile) return "—";
  return (locale === "ar" ? profile.nameAr || profile.nameEn : profile.nameEn || profile.nameAr)
    || profile.displayName
    || profile.nameOriginal
    || "—";
}

export function AdminSupplierOwnershipClaimsPage() {
  const { i18n } = useTranslation();
  const locale: SupplierOwnershipLocale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = supplierOwnershipCopy[locale];
  const [status, setStatus] = useState<SupplierOwnershipClaimStatus>("pending_review");
  const [claims, setClaims] = useState<SupplierOwnershipClaim[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SupplierOwnershipReviewProfile | null>>({});
  const [cursor, setCursor] = useState<SupplierOwnershipClaimCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<SupplierOwnershipErrorKey | null>(null);

  const load = useCallback(async (append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await listAdminSupplierOwnershipClaims(status, 25, append ? cursor : null);
      const missingProfileIds = [...new Set(page.items.map((claim) => claim.supplierProfileId))]
        .filter((supplierProfileId) => !(supplierProfileId in profiles));
      const loadedProfiles = await Promise.all(missingProfileIds.map(async (supplierProfileId) => {
        try {
          return [supplierProfileId, await getSupplierOwnershipReviewProfile(supplierProfileId)] as const;
        } catch {
          return [supplierProfileId, null] as const;
        }
      }));
      setProfiles((current) => ({ ...current, ...Object.fromEntries(loadedProfiles) }));
      setClaims((current) => append ? [...current, ...page.items] : page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (caught) {
      setError(mapSupplierOwnershipError(caught));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, profiles, status]);

  useEffect(() => {
    setClaims([]);
    setCursor(null);
    setHasMore(false);
    void load(false);
  }, [status]);

  const DetailIcon = locale === "ar" ? ArrowLeft : ArrowRight;
  return (
    <div dir={text.direction}>
      <Section title={text.admin.queueTitle} description={text.admin.queueDescription}>
        <div className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-[16px] border border-borderSoft bg-white p-4 shadow-card">
            <SelectField className="min-w-64" label={text.admin.statusFilter} value={status} onChange={(event) => setStatus(event.target.value as SupplierOwnershipClaimStatus)}>
              {supplierOwnershipStatuses.map((value) => <option key={value} value={value}>{text.statuses[value]}</option>)}
            </SelectField>
            <div className="text-xs font-bold text-muted">{text.admin.newestFirst}</div>
          </div>
          {error ? (
            <div className="rounded-[16px] border border-clay/30 bg-clay/5 p-5 text-sm font-bold text-clay" role="alert">
              <p>{text.errors[error]}</p>
              <Button className="mt-4" variant="secondary" onClick={() => void load(false)}><RefreshCw className="h-4 w-4" />{text.admin.refresh}</Button>
            </div>
          ) : loading ? <EmptyState title={text.admin.loading} /> : claims.length ? (
            <div className="grid gap-3">
              {claims.map((claim) => (
                <Link className="grid gap-4 rounded-[16px] border border-borderSoft bg-white p-4 shadow-card transition hover:border-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber md:grid-cols-[1fr_1fr_auto] md:items-center" key={claim.id} to={`/admin/ownership-claims/${claim.id}`}>
                  <div className="flex min-w-0 items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 shrink-0 text-river" /><div className="min-w-0"><div className="text-xs font-black uppercase text-muted">{text.admin.claimant}</div><div className="truncate font-black text-ink">{claim.claimantSnapshot.fullName || "—"}</div><div className="truncate text-xs font-semibold text-muted">{claim.claimantSnapshot.organization || "—"}</div></div></div>
                  <div className="flex min-w-0 items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber" /><div className="min-w-0"><div className="text-xs font-black uppercase text-muted">{text.admin.company}</div><div className="truncate font-black text-ink">{profileName(profiles[claim.supplierProfileId], locale)}</div><div className="mt-1 flex flex-wrap items-center gap-2"><SupplierOwnershipStatusBadge locale={locale} status={claim.status} /><span className="text-xs font-semibold text-muted">{formatDate(claim.createdAt, locale)}</span></div></div></div>
                  <span className="inline-flex items-center gap-2 text-sm font-black text-amber">{text.admin.review}<DetailIcon className="h-4 w-4" /></span>
                </Link>
              ))}
              {hasMore ? <Button className="justify-self-center" disabled={loadingMore} variant="secondary" onClick={() => void load(true)}>{loadingMore ? text.admin.loading : text.admin.loadMore}</Button> : null}
            </div>
          ) : <EmptyState title={text.admin.noClaims} body={text.admin.noClaimsBody} />}
        </div>
      </Section>
    </div>
  );
}