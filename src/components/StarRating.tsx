import { Star } from "lucide-react";

export function StarRating({
  value,
  onChange,
  readOnly = false,
  label,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  label?: string;
}) {
  return (
    <div className="grid gap-1">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            aria-label={`${item} stars`}
            className="rounded p-0.5 text-amber outline-none transition hover:scale-105 focus:ring-2 focus:ring-amber/30 disabled:hover:scale-100"
            disabled={readOnly}
            key={item}
            type="button"
            onClick={() => onChange?.(item)}
          >
            <Star className="h-5 w-5" fill={item <= value ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}
