import clsx from "clsx";
import { useTranslation } from "react-i18next";

const toneMap = {
  approved: "bg-mint/10 text-mint ring-mint/20",
  active: "bg-mint/10 text-mint ring-mint/20",
  pending: "bg-amber/10 text-amber ring-amber/20",
  pending_approval: "bg-amber/10 text-amber ring-amber/20",
  pending_review: "bg-amber/10 text-amber ring-amber/20",
  possible_duplicate: "bg-amber/10 text-amber ring-amber/20",
  needs_correction: "bg-amber/10 text-amber ring-amber/20",
  rejected: "bg-clay/10 text-clay ring-clay/20",
  suspended: "bg-clay/10 text-clay ring-clay/20",
  expired: "bg-clay/10 text-clay ring-clay/20",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
  default: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation();
  const tone = toneMap[value as keyof typeof toneMap] || toneMap.default;
  const fallback = value.replaceAll("_", " ");
  return (
    <span className={clsx("inline-flex items-center rounded px-2 py-1 text-xs font-bold ring-1", tone)}>
      {label || t(`status_${value}`, { defaultValue: t(value, { defaultValue: fallback }) })}
    </span>
  );
}
