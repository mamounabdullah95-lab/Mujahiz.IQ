import type { RfqRecord, RfqResponse } from "../types/workspace";
import { toDate } from "../utils/date";
import { currentRfqRevision, isHistoricalRfq, localizedRfqStatus } from "../utils/rfqLifecycle";

function formatTimelineDate(value: unknown, locale: "ar" | "en") {
  const date = toDate(value as never);
  return date
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : (locale === "ar" ? "الوقت غير متاح في السجل القديم" : "Time unavailable for this legacy record");
}

export function RfqLifecycleTimeline({ rfq, response, locale }: { rfq: RfqRecord; response: RfqResponse; locale: "ar" | "en" }) {
  const revision = currentRfqRevision(response);
  const terminal = isHistoricalRfq(rfq);
  const items = [
    { label: locale === "ar" ? "نشر طلب عرض الأسعار" : "RFQ published", value: null },
    { label: locale === "ar" ? "إرسال عرض السعر" : "Quotation submitted", value: response.firstSubmittedAt || response.createdAt },
    ...(revision > 1 ? [{ label: locale === "ar" ? `تحديث عرض السعر إلى النسخة V${revision}` : `Quotation updated to revision V${revision}`, value: response.updatedAt }] : []),
    ...(terminal ? [{ label: locale === "ar" ? `حالة الطلب: ${localizedRfqStatus(rfq, locale)}` : `RFQ status: ${localizedRfqStatus(rfq, locale)}`, value: null }] : []),
  ];

  return <section className="mb-5 rounded-xl border border-borderSoft bg-white p-4" aria-label={locale === "ar" ? "الخط الزمني للطلب والعرض" : "RFQ and quotation timeline"}>
    <h3 className="text-sm font-black text-ink">{locale === "ar" ? "الخط الزمني" : "Timeline"}</h3>
    <ol className="mt-3 grid gap-3">
      {items.map((item) => <li className="grid grid-cols-[auto_1fr] gap-3 text-sm" key={item.label}>
        <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-amber" aria-hidden="true" />
        <div><strong className="block text-ink">{item.label}</strong><span className="mt-1 block text-xs font-semibold text-muted">{formatTimelineDate(item.value, locale)}</span></div>
      </li>)}
    </ol>
  </section>;
}
