import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-river text-white hover:bg-ink",
        variant === "secondary" && "border border-slate-200 bg-white text-ink hover:border-river hover:text-river",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        variant === "danger" && "bg-clay text-white hover:bg-red-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  className,
  ...props
}: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={clsx("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      <input
        className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-river focus:ring-2 focus:ring-river/15"
        {...props}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  className,
  ...props
}: { label: string; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={clsx("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      <textarea
        className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-river focus:ring-2 focus:ring-river/15"
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: { label: string; className?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={clsx("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      <select
        className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-river focus:ring-2 focus:ring-river/15"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Section({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  return (
    <div
      className={clsx(
        "rounded-md border bg-white p-4 shadow-soft",
        tone === "neutral" && "border-slate-200",
        tone === "good" && "border-mint/30",
        tone === "warning" && "border-amber/40",
        tone === "danger" && "border-clay/40",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
      <div className="font-semibold text-ink">{title}</div>
      {body ? <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">{body}</p> : null}
    </div>
  );
}

export function ChipGroup({
  options,
  values,
  onChange,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = values.includes(option.value);
        return (
          <button
            className={clsx(
              "min-h-9 rounded-md border px-3 text-sm font-medium transition",
              active
                ? "border-river bg-river text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-river hover:text-river",
            )}
            key={option.value}
            type="button"
            onClick={() => {
              onChange(active ? values.filter((item) => item !== option.value) : [...values, option.value]);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
