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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-navy text-white shadow-soft hover:bg-river",
        variant === "secondary" && "border border-amber bg-white/85 text-amber hover:bg-amber hover:text-white",
        variant === "ghost" && "text-ink hover:bg-cream hover:text-amber",
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
    <label className={clsx("grid gap-1.5 text-sm font-bold text-ink", className)}>
      <span>{label}</span>
      <input
        className="min-h-12 rounded-[10px] border border-borderSoft bg-white/95 px-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-amber focus:ring-2 focus:ring-amber/15"
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
    <label className={clsx("grid gap-1.5 text-sm font-bold text-ink", className)}>
      <span>{label}</span>
      <textarea
        className="min-h-28 rounded-[10px] border border-borderSoft bg-white/95 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-amber focus:ring-2 focus:ring-amber/15"
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
    <label className={clsx("grid gap-1.5 text-sm font-bold text-ink", className)}>
      <span>{label}</span>
      <select
        className="min-h-12 rounded-[10px] border border-borderSoft bg-white/95 px-3 text-sm text-ink outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/15"
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
    <section className="bg-creamLight">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-[18px] border border-borderSoft bg-white/92 p-5 shadow-card sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-ink">{title}</h2>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{description}</p> : null}
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
        "rounded-[18px] border bg-white/96 p-5 shadow-card",
        tone === "neutral" && "border-borderSoft",
        tone === "good" && "border-mint/30",
        tone === "warning" && "border-amber/40",
        tone === "danger" && "border-clay/40",
      )}
    >
      <div className="text-sm font-bold text-ink">{label}</div>
      <div className="mt-3 text-3xl font-black text-ink">{value}</div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-borderSoft bg-cream px-4 py-10 text-center">
      <div className="font-bold text-ink">{title}</div>
      {body ? <p className="mx-auto mt-1 max-w-xl text-sm leading-7 text-muted">{body}</p> : null}
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
              "min-h-10 rounded-xl border px-3 text-sm font-bold transition",
              active
                ? "border-navy bg-navy text-white"
                : "border-borderSoft bg-white text-ink hover:border-amber hover:text-amber",
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
