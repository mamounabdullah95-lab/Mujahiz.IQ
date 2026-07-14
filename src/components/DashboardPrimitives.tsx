import clsx from "clsx";
import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-borderSoft bg-white px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-xs font-black uppercase text-amber">{eyebrow}</div> : null}
        <h2 className="text-2xl font-black text-ink sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  to,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "warning" | "danger";
  to?: string;
}) {
  const className = clsx(
    "min-w-0 rounded-[16px] border bg-white p-5 shadow-card",
    tone === "neutral" && "border-borderSoft",
    tone === "good" && "border-mint/30",
    tone === "warning" && "border-amber/35",
    tone === "danger" && "border-clay/30",
    to && "group cursor-pointer transition hover:-translate-y-0.5 hover:border-amber hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2",
  );
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-muted">{label}</div>
          <div className="mt-2 text-3xl font-black text-ink">{value}</div>
        </div>
        <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[12px]", tone === "good" && "bg-successBg text-mint", tone === "warning" && "bg-cream text-amber", tone === "danger" && "bg-clay/10 text-clay", tone === "neutral" && "bg-[#eef4f8] text-river")}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      </div>
      {helper ? <p className="mt-3 text-xs font-semibold leading-5 text-muted">{helper}</p> : null}
    </>
  );

  return to ? <Link className={className} to={to}>{content}</Link> : <div className={className}>{content}</div>;
}

export function DashboardPanel({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-[16px] border border-borderSoft bg-white p-5 shadow-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-base font-black text-ink">{title}</h3>{description ? <p className="mt-1 text-xs font-semibold leading-5 text-muted">{description}</p> : null}</div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-black text-ink"><span>{label}</span><span>{safeValue}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-amber transition-[width]" style={{ width: `${safeValue}%` }} /></div>
    </div>
  );
}

export function InlineEmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={clsx("rounded-[14px] border border-dashed border-borderSoft bg-creamLight text-center", compact ? "px-4 py-6" : "px-5 py-9")}>
      <Inbox className="mx-auto h-6 w-6 text-amber" aria-hidden="true" />
      <div className="mt-3 text-sm font-black text-ink">{title}</div>
      <p className="mx-auto mt-1 max-w-lg text-xs font-semibold leading-6 text-muted">{body}</p>
    </div>
  );
}

export function DashboardError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-clay/25 bg-clay/5 p-4 text-sm font-bold text-clay" role="alert">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {retry ? <button className="underline" type="button" onClick={retry}>Retry</button> : null}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-5 p-5 sm:p-7" aria-hidden="true">
      <div className="h-32 animate-pulse rounded-[16px] bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div className="h-32 animate-pulse rounded-[16px] bg-white" key={index} />)}</div>
      <div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, index) => <div className="h-64 animate-pulse rounded-[16px] bg-white" key={index} />)}</div>
    </div>
  );
}
