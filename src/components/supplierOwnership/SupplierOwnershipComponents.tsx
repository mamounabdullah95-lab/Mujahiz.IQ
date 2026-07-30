import { ExternalLink, ShieldCheck, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../StatusBadge";
import { Button } from "../ui";
import { supplierOwnershipCopy, type SupplierOwnershipLocale } from "../../config/supplierOwnershipCopy";
import type { SupplierOwnershipClaim, SupplierOwnershipClaimStatus } from "../../types/domain";
import { formatDate } from "../../utils/date";
import { normalizePublicHttpsLink } from "../../utils/supplierOwnershipUi";

export function SupplierOwnershipStatusBadge({
  status,
  locale,
}: {
  status: SupplierOwnershipClaimStatus;
  locale: SupplierOwnershipLocale;
}) {
  return <StatusBadge value={status} label={supplierOwnershipCopy[locale].statuses[status]} />;
}

export function SafeEvidenceLinks({ links, locale }: { links: string[]; locale: SupplierOwnershipLocale }) {
  const safeLinks = links.flatMap((link) => {
    try {
      const normalized = normalizePublicHttpsLink(link);
      return normalized ? [normalized] : [];
    } catch {
      return [];
    }
  });
  if (!safeLinks.length) return <span className="text-sm font-semibold text-muted">—</span>;
  return (
    <ul className="grid gap-2">
      {safeLinks.map((link) => (
        <li key={link}>
          <a
            className="inline-flex max-w-full items-center gap-2 break-all text-sm font-bold text-river underline decoration-river/30 underline-offset-4 hover:text-amber"
            href={link}
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{new URL(link).hostname}</span>
            <span className="sr-only">({locale === "ar" ? "يفتح في نافذة جديدة" : "opens in a new window"})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function OwnershipClaimCard({
  claim,
  locale,
  detailTo,
  actions,
}: {
  claim: SupplierOwnershipClaim;
  locale: SupplierOwnershipLocale;
  detailTo?: string;
  actions?: ReactNode;
}) {
  const text = supplierOwnershipCopy[locale];
  const content = (
    <div className="grid gap-3 rounded-[14px] border border-borderSoft bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SupplierOwnershipStatusBadge locale={locale} status={claim.status} />
        <span className="text-xs font-bold text-muted">{text.claim.created}: {formatDate(claim.createdAt, locale)}</span>
      </div>
      <div>
        <div className="text-sm font-black text-ink">{text.evidenceTypes[claim.evidenceType]}</div>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-muted">{claim.evidenceSummary}</p>
      </div>
      {claim.adminNotes ? <p className="rounded-xl bg-cream px-3 py-2 text-xs font-semibold leading-6 text-ink">{text.claim.adminNotes}: {claim.adminNotes}</p> : null}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
  return detailTo ? <Link className="block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber" to={detailTo}>{content}</Link> : content;
}

export function DecisionConfirmation({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  danger = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/60 p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <div aria-describedby="ownership-confirmation-body" aria-modal="true" className="w-full max-w-lg rounded-[18px] border border-borderSoft bg-white p-5 shadow-2xl" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-amber"><ShieldCheck className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-black text-ink">{title}</h2><p className="mt-2 text-sm font-semibold leading-7 text-muted" id="ownership-confirmation-body">{body}</p></div>
          </div>
          <button aria-label={cancelLabel} className="rounded-lg p-2 text-muted hover:bg-cream hover:text-ink" disabled={busy} type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button disabled={busy} type="button" variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button disabled={busy} type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}