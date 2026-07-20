import type { RfqRecord, RfqResponse, RfqResponseRevision } from "../types/workspace";

export const RFQ_HISTORY_PAGE_SIZE = 25;
export const RFQ_COMMERCIAL_FIELDS = [
  "message", "price", "currency", "deliveryDays", "paymentTerms",
  "paymentTermsOther", "deliveryTerms", "deliveryTermsOther", "referenceLinks",
] as const;
export type RfqCommercialField = typeof RFQ_COMMERCIAL_FIELDS[number];
export interface RfqCommercialValues {
  message: string;
  price: number | undefined;
  currency: RfqResponse["currency"];
  deliveryDays: number | undefined;
  paymentTerms: string;
  paymentTermsOther: string;
  deliveryTerms: string;
  deliveryTermsOther: string;
  referenceLinks: string[];
}

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeRfqCommercialValues(value: Partial<RfqCommercialValues>): RfqCommercialValues {
  return {
    message: normalizedText(value.message),
    price: value.price === undefined ? undefined : Number(value.price),
    currency: value.currency,
    deliveryDays: value.deliveryDays === undefined ? undefined : Math.trunc(Number(value.deliveryDays)),
    paymentTerms: normalizedText(value.paymentTerms),
    paymentTermsOther: normalizedText(value.paymentTermsOther),
    deliveryTerms: normalizedText(value.deliveryTerms),
    deliveryTermsOther: normalizedText(value.deliveryTermsOther),
    referenceLinks: [...new Set((value.referenceLinks || []).map((item) => item.trim()).filter(Boolean))],
  };
}

function fieldValue(value: RfqCommercialValues, field: RfqCommercialField) {
  const item = value[field];
  return Array.isArray(item) ? JSON.stringify(item) : item ?? null;
}

export function changedRfqResponseFields(previous: Partial<RfqCommercialValues>, current: Partial<RfqCommercialValues>) {
  const left = normalizeRfqCommercialValues(previous);
  const right = normalizeRfqCommercialValues(current);
  return RFQ_COMMERCIAL_FIELDS.filter((field) => fieldValue(left, field) !== fieldValue(right, field));
}

export function hasMaterialRfqResponseChange(previous: Partial<RfqCommercialValues>, current: Partial<RfqCommercialValues>) {
  return changedRfqResponseFields(previous, current).length > 0;
}

export function currentRfqRevision(response: Pick<RfqResponse, "revisionNumber">) {
  return Number.isInteger(response.revisionNumber) && Number(response.revisionNumber) > 0
    ? Number(response.revisionNumber)
    : 1;
}

export function rfqResponseRevisionId(responseId: string, revisionNumber: number) {
  return `${responseId}_v${revisionNumber}`;
}

export function rfqResponseUpdatedNotificationId(responseId: string, revisionNumber: number) {
  return `rfq-response-updated_${responseId}_v${revisionNumber}`;
}

export function rfqResponseUpdatedEventId(responseId: string, revisionNumber: number) {
  return rfqResponseRevisionId(responseId, revisionNumber);
}

export function isHistoricalRfq(rfq: Pick<RfqRecord, "status" | "closingAt" | "closingDate">, now = Date.now()) {
  if (["closed", "cancelled"].includes(rfq.status)) return true;
  if (!["published", "receiving"].includes(rfq.status)) return false;
  const raw = rfq.closingAt as { toDate?: () => Date } | string | Date | null | undefined;
  const closing = raw instanceof Date ? raw.getTime()
    : typeof raw === "string" ? Date.parse(raw)
      : raw?.toDate ? raw.toDate().getTime()
        : Date.parse(`${rfq.closingDate}T23:59:59`);
  return Number.isFinite(closing) && closing < now;
}

export interface SupplierRfqLifecycleItem {
  rfq: RfqRecord;
  response: RfqResponse | null;
}

export function partitionSupplierRfqLifecycle(items: SupplierRfqLifecycleItem[], now = Date.now()) {
  const open = items.filter(({ rfq }) => !isHistoricalRfq(rfq, now));
  return {
    invitations: open.filter(({ response }) => !response),
    quotations: open.filter(({ response }) => Boolean(response)),
    history: items.filter(({ rfq, response }) => Boolean(response) && isHistoricalRfq(rfq, now)),
  };
}

export function localizedRfqStatus(rfq: Pick<RfqRecord, "status" | "closingAt" | "closingDate">, locale: "ar" | "en") {
  if (isHistoricalRfq(rfq) && ["published", "receiving"].includes(rfq.status)) {
    return locale === "ar" ? "منتهي" : "Expired";
  }
  const labels = {
    draft: { ar: "مسودة", en: "Draft" },
    published: { ar: "مفتوح", en: "Open" },
    receiving: { ar: "يستقبل العروض", en: "Receiving quotations" },
    closed: { ar: "مغلق", en: "Closed" },
    cancelled: { ar: "ملغى", en: "Cancelled" },
  } as const;
  return labels[rfq.status][locale];
}

export function localizedRfqResponseStatus(status: RfqResponse["status"], locale: "ar" | "en") {
  return status === "withdrawn"
    ? (locale === "ar" ? "مسحوب" : "Withdrawn")
    : (locale === "ar" ? "مقدم" : "Submitted");
}

export function revisionChangedFields(previous: RfqResponseRevision, current: RfqResponseRevision) {
  return changedRfqResponseFields(previous, current);
}
