import type { Timestamp, FieldValue } from "firebase/firestore";
import type { Locale, TimestampLike } from "../types/domain";

export function toDate(value: TimestampLike | FieldValue) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

export function formatDate(value: TimestampLike, locale: Locale = "en") {
  const date = toDate(value);
  if (!date) {
    return locale === "ar" ? "غير محدد" : "Not set";
  }
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-IQ", {
    dateStyle: "medium",
  }).format(date);
}

export function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function maxDate(a: Date, b: Date) {
  return a.getTime() > b.getTime() ? a : b;
}

export function isFuture(value: TimestampLike) {
  const date = toDate(value);
  return Boolean(date && date.getTime() > Date.now());
}
