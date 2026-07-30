import { Building2, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { SupplierOwnershipStatusBadge } from "./SupplierOwnershipComponents";
import { supplierOwnershipCopy, type SupplierOwnershipLocale } from "../../config/supplierOwnershipCopy";
import { useAuth } from "../../contexts/AuthContext";
import { listMySupplierOwnershipClaims } from "../../services/supplierOwnership";
import type { SupplierOwnershipClaim } from "../../types/domain";
import { supplierClaimEligibility } from "../../utils/supplierOwnershipUi";

export function SupplierOwnershipDashboardCard() {
  const { i18n } = useTranslation();
  const locale: SupplierOwnershipLocale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = supplierOwnershipCopy[locale];
  const { appUser, emailVerified, firebaseUser } = useAuth();
  const [latest, setLatest] = useState<SupplierOwnershipClaim | null>(null);
  const eligibility = supplierClaimEligibility(appUser, emailVerified);

  useEffect(() => {
    let active = true;
    if (!firebaseUser?.uid || appUser?.supplierProfileId || eligibility !== "eligible") return () => { active = false; };
    void listMySupplierOwnershipClaims(firebaseUser.uid, 1).then((page) => {
      if (active) setLatest(page.items[0] || null);
    }).catch(() => { if (active) setLatest(null); });
    return () => { active = false; };
  }, [appUser?.supplierProfileId, eligibility, firebaseUser?.uid]);

  const linked = Boolean(appUser?.supplierProfileId);
  const pending = latest?.status === "pending_review";
  const terminal = latest && latest.status !== "pending_review" ? latest : null;
  const Icon = linked ? CheckCircle2 : pending ? Clock : eligibility === "eligible" ? Building2 : ShieldAlert;
  const title = linked
    ? text.claim.linkedTitle
    : pending
      ? text.claim.pendingTitle
      : terminal
        ? `${text.claim.history}: ${text.statuses[terminal.status]}`
        : eligibility === "eligible"
          ? text.claim.title
          : text.claim.ineligibleTitle;
  const body = linked
    ? text.claim.linkedBody
    : pending
      ? text.claim.pendingBody
      : terminal
        ? text.claim.noHistoryBody
        : eligibility === "eligible"
          ? text.claim.description
          : text.claim.ineligibleBody;
  const to = linked ? "/supplier" : pending || terminal ? "/supplier/ownership-claims" : eligibility === "eligible" ? "/supplier/claim-company" : null;
  const action = linked ? text.claim.openWorkspace : pending || terminal ? text.claim.historyAction : text.claim.submit;

  return (
    <section className="rounded-[16px] border border-amber/30 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-amber"><Icon className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-ink">{title}</h3>{latest ? <SupplierOwnershipStatusBadge locale={locale} status={latest.status} /> : null}</div><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-muted">{body}</p></div></div>
        {to ? <Link className="shrink-0" to={to}><Button variant="secondary">{action}</Button></Link> : null}
      </div>
    </section>
  );
}