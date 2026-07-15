import { Link2, Plus, Trash2 } from "lucide-react";

const MAX_LINKS = 5;

export function RfqReferenceLinks({
  locale,
  links,
  onChange,
}: {
  locale: "ar" | "en";
  links: string[];
  onChange: (links: string[]) => void;
}) {
  const text = locale === "ar"
    ? {
        title: "روابط صور أو مستندات داعمة",
        hint: "أضف روابط عامة وآمنة فقط (HTTPS). لا يتم رفع أي ملف أو نسخه إلى المنصة.",
        placeholder: "https://example.com/specification.pdf",
        add: "إضافة رابط",
        remove: "حذف الرابط",
      }
    : {
        title: "Supporting image or document links",
        hint: "Add safe public HTTPS links only. No file is uploaded or copied to the platform.",
        placeholder: "https://example.com/specification.pdf",
        add: "Add link",
        remove: "Remove link",
      };
  const visibleLinks = links.length ? links : [""];

  function update(index: number, value: string) {
    const next = [...visibleLinks];
    next[index] = value;
    onChange(next);
  }

  function remove(index: number) {
    onChange(visibleLinks.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <fieldset className="grid gap-3 rounded-xl border border-borderSoft bg-creamLight p-4">
      <legend className="px-1 text-sm font-black text-ink">{text.title}</legend>
      <p className="text-xs font-medium leading-5 text-muted">{text.hint}</p>
      {visibleLinks.map((value, index) => (
        <div className="flex items-center gap-2" key={index}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-amber">
            <Link2 className="h-4 w-4" />
          </span>
          <input
            aria-label={text.title + " " + (index + 1)}
            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-borderSoft bg-white px-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-amber focus:ring-2 focus:ring-amber/15"
            dir="ltr"
            inputMode="url"
            maxLength={500}
            onChange={(event) => update(index, event.target.value)}
            placeholder={text.placeholder}
            type="url"
            value={value}
          />
          {visibleLinks.length > 1 || value ? (
            <button
              aria-label={text.remove}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-clay transition hover:bg-clay/10"
              onClick={() => remove(index)}
              title={text.remove}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      {visibleLinks.length < MAX_LINKS ? (
        <button
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-amber px-3 text-xs font-black text-amber transition hover:bg-amber hover:text-white"
          onClick={() => onChange([...visibleLinks, ""])}
          type="button"
        >
          <Plus className="h-4 w-4" />
          {text.add}
        </button>
      ) : null}
    </fieldset>
  );
}
