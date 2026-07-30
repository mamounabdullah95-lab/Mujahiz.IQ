import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OwnershipClaimCard } from "../../components/supplierOwnership/SupplierOwnershipComponents";
import { Button, EmptyState, Section } from "../../components/ui";
import { supplierOwnershipCopy, type SupplierOwnershipLocale } from "../../config/supplierOwnershipCopy";
import { useAuth } from "../../contexts/AuthContext";
import {
  listMySupplierOwnershipClaims,
  type SupplierOwnershipClaimCursor,
} from "../../services/supplierOwnership";
import type { SupplierOwnershipClaim } from "../../types/domain";
import { mapSupplierOwnershipError, type SupplierOwnershipErrorKey } from "../../utils/supplierOwnershipUi";

export function SupplierOwnershipClaimHistoryPage() {
  const { i18n } = useTranslation();
  const locale: SupplierOwnershipLocale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = supplierOwnershipCopy[locale];
  const { firebaseUser, refreshUser } = useAuth();
  const [claims, setClaims] = useState<SupplierOwnershipClaim[]>([]);
  const [cursor, setCursor] = useState<SupplierOwnershipClaimCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<SupplierOwnershipErrorKey | null>(null);

  const load = useCallback(async (append = false) => {
    if (!firebaseUser?.uid) return;
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await listMySupplierOwnershipClaims(firebaseUser.uid, 20, append ? cursor : null);
      setClaims((current) => append ? [...current, ...page.items] : page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      if (page.items.some((claim) => claim.status === "approved")) await refreshUser();
    } catch (caught) {
      setError(mapSupplierOwnershipError(caught));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, firebaseUser?.uid, refreshUser]);

  useEffect(() => { void load(false); }, [firebaseUser?.uid]);

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  return (
    <div dir={text.direction}>
      <Section
        title={text.claim.history}
        description={text.claim.noHistoryBody}
        actions={<Link to="/supplier/claim-company"><Button variant="secondary"><BackIcon className="h-4 w-4" />{text.claim.backToClaim}</Button></Link>}
      >
        {loading ? <EmptyState title={text.claim.loading} /> : error ? (
          <div className="rounded-[16px] border border-clay/30 bg-clay/5 p-5 text-sm font-bold text-clay" role="alert">
            <p>{text.errors[error]}</p>
            <Button className="mt-4" variant="secondary" onClick={() => void load(false)}><RefreshCw className="h-4 w-4" />{text.claim.retry}</Button>
          </div>
        ) : claims.length ? (
          <div className="grid gap-4">
            {claims.map((claim) => <OwnershipClaimCard claim={claim} key={claim.id} locale={locale} />)}
            {hasMore ? <Button className="justify-self-center" disabled={loadingMore} variant="secondary" onClick={() => void load(true)}>{loadingMore ? text.claim.loading : text.claim.loadMore}</Button> : null}
          </div>
        ) : <EmptyState title={text.claim.noHistory} body={text.claim.noHistoryBody} />}
      </Section>
    </div>
  );
}