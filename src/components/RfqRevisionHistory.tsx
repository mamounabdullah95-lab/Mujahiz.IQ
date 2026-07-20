import { ChevronDown, History, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listRfqResponseRevisions } from "../services/workspace";
import type { RfqResponseRevisionViewerScope } from "../services/workspace";
import type { RfqResponse, RfqResponseRevision } from "../types/workspace";
import { toDate } from "../utils/date";
import { currentRfqRevision, revisionChangedFields } from "../utils/rfqLifecycle";

function formatRevisionDate(value: unknown, locale: "ar" | "en") {
  const date = toDate(value as never);
  return date
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "—";
}

export function RfqRevisionHistory({
  response,
  locale,
  scope,
}: {
  response: RfqResponse;
  locale: "ar" | "en";
  scope: RfqResponseRevisionViewerScope;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RfqResponseRevision[]>([]);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const text = locale === "ar" ? {
    button: "سجل نسخ العرض",
    current: "النسخة الحالية",
    revision: "النسخة",
    changed: "الحقول المتغيرة",
    original: "الإرسال الأول",
    none: "لا توجد نسخ محفوظة لهذا العرض القديم حتى الآن.",
    failed: "تعذر تحميل سجل نسخ العرض.",
    price: "السعر",
    leadTime: "مدة التجهيز",
    fieldLabels: { message: "تفاصيل العرض", price: "السعر", currency: "العملة", deliveryDays: "مدة التجهيز", paymentTerms: "شروط الدفع", paymentTermsOther: "تفاصيل شروط الدفع", deliveryTerms: "شروط التسليم", deliveryTermsOther: "تفاصيل شروط التسليم", referenceLinks: "الروابط الداعمة" },
  } : {
    button: "Quotation version history",
    current: "Current revision",
    revision: "Revision",
    changed: "Changed fields",
    original: "Initial submission",
    none: "No preserved revisions exist for this legacy quotation yet.",
    failed: "Quotation revision history could not be loaded.",
    price: "Price",
    leadTime: "Lead time",
    fieldLabels: { message: "Quotation details", price: "Price", currency: "Currency", deliveryDays: "Lead time", paymentTerms: "Payment terms", paymentTermsOther: "Payment details", deliveryTerms: "Delivery terms", deliveryTermsOther: "Delivery details", referenceLinks: "Supporting links" },
  };

  useEffect(() => {
    setOpen(false);
    setItems([]);
    setError("");
    requestRef.current += 1;
  }, [
    response.id,
    scope.buyerId,
    scope.viewer,
    scope.viewer === "supplier" ? scope.supplierUserId : "",
    scope.viewer === "supplier" ? scope.supplierProfileId : "",
  ]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items.length || loading) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const revisions = await listRfqResponseRevisions({ ...scope, responseId: response.id });
      if (requestRef.current === requestId) setItems(revisions);
    } catch {
      if (requestRef.current === requestId) setError(text.failed);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }

  return <div className="mt-4 rounded-xl border border-borderSoft bg-creamLight p-4">
    <button className="flex w-full items-center justify-between gap-3 text-start text-sm font-black text-river" type="button" onClick={() => void toggle()} aria-expanded={open}>
      <span className="flex items-center gap-2"><History className="h-4 w-4 text-amber" />{text.button} · {text.current} V{currentRfqRevision(response)}</span>
      <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <div className="mt-4 grid gap-3">
      {loading ? <div className="flex items-center gap-2 text-sm font-bold text-muted"><Loader2 className="h-4 w-4 animate-spin" />{text.button}</div> : null}
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
      {!loading && !error && !items.length ? <p className="text-sm font-semibold text-muted">{text.none}</p> : null}
      {items.map((item, index) => {
        const previous = items[index + 1];
        const changed = previous ? revisionChangedFields(previous, item) : [];
        return <article className="rounded-lg border border-borderSoft bg-white p-3" key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{text.revision} V{item.revisionNumber}</strong><span className="text-xs font-semibold text-muted">{formatRevisionDate(item.createdAt, locale)}</span></div>
          <p className="mt-2 text-xs font-semibold text-muted">{item.changeType === "submitted" ? text.original : `${text.changed}: ${changed.length ? changed.map((field) => text.fieldLabels[field]).join(", ") : "—"}`}</p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div><dt className="font-bold text-muted">{text.price}</dt><dd className="font-black">{item.price ?? "—"} {item.price === undefined ? "" : item.currency}</dd></div>
            <div><dt className="font-bold text-muted">{text.leadTime}</dt><dd className="font-black">{item.deliveryDays ?? "—"}</dd></div>
          </dl>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{item.message}</p>
        </article>;
      })}
    </div> : null}
  </div>;
}
