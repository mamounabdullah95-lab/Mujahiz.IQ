import type { CreditStart, Locale, Supplier, TaxonomyLists } from "../types/domain";
import { creditStarts, labelFor, paymentOptions } from "../data/constants";
import { toDate } from "./date";
import { supplierGovernorates, supplierSearchText } from "./supplierDisplay";

export interface SupplierSearchIntent {
  acceptsCredit?: boolean;
  categories: string[];
  creditDays?: number;
  creditStart?: CreditStart;
  governorates: string[];
  minRating?: number;
  paymentOptions: string[];
  query: string;
  searchTerms: string[];
}

export interface SupplierRecommendation {
  reasons: Array<"category" | "credit" | "freshness" | "location" | "payment" | "quality" | "text">;
  score: number;
  supplier: Supplier;
}

const paymentAliases: Record<string, string[]> = {
  bank_transfer: ["bank transfer", "bank payment", "wire transfer", "تحويل مصرفي", "حوالة مصرفية", "دفع مصرفي"],
  cash: ["cash", "cash payment", "نقد", "نقدا", "دفع نقدي"],
  official_invoice: ["official invoice", "tax invoice", "فاتورة رسمية", "فاتورة"],
  iqd: ["iqd", "iraqi dinar", "دينار", "دينار عراقي"],
  usd: ["usd", "dollar", "دولار"],
};

const creditWords = [
  "credit",
  "deferred",
  "pay later",
  "payment term",
  "net 30",
  "دفع آجل",
  "دفع اجل",
  "بالآجل",
  "بالاجل",
  "ائتمان",
  "بعد الفاتورة",
  "بعد الفوترة",
];

const stopWords = new Set([
  "اريد",
  "أريد",
  "احتاج",
  "أحتاج",
  "مجهز",
  "مجهزين",
  "شركة",
  "شركات",
  "في",
  "او",
  "أو",
  "مع",
  "من",
  "لديه",
  "لديها",
  "يقبل",
  "تقبل",
  "دفع",
  "بعد",
  "find",
  "need",
  "want",
  "supplier",
  "suppliers",
  "company",
  "companies",
  "in",
  "or",
  "with",
  "that",
  "accepts",
  "payment",
]);

export function parseSupplierSearchLocally(query: string, taxonomy: TaxonomyLists): SupplierSearchIntent {
  const normalized = normalizeText(query);
  const governorates = taxonomy.governorates
    .filter((item) => optionMentioned(normalized, item.value, item.labelEn, item.labelAr))
    .map((item) => item.value);
  const categories = taxonomy.supplierCategories
    .filter((item) => optionMentioned(normalized, item.value, item.labelEn, item.labelAr))
    .map((item) => item.value);
  const matchedPayments = Object.entries(paymentAliases)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeText(alias))))
    .map(([value]) => value);
  const creditDays = extractCreditDays(normalized);
  const creditStart = detectCreditStart(normalized);
  const acceptsCredit = creditWords.some((word) => normalized.includes(normalizeText(word))) || Boolean(creditDays || creditStart);
  const minRatingMatch = normalized.match(/(?:تقييم|rating)\s*(?:لا يقل عن|at least|minimum|min)?\s*([1-5](?:\.\d)?)/);
  const searchTerms = Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 1 && !stopWords.has(item) && !/^\d+$/.test(item))
        .filter((item) => !creditWords.some((word) => normalizeText(word).includes(item)))
        .filter((item) => !taxonomy.governorates.some((option) => optionMentioned(item, option.value, option.labelEn, option.labelAr))),
    ),
  );

  return {
    acceptsCredit: acceptsCredit || undefined,
    categories,
    creditDays,
    creditStart,
    governorates,
    minRating: minRatingMatch ? Number(minRatingMatch[1]) : undefined,
    paymentOptions: matchedPayments,
    query,
    searchTerms,
  };
}

export function mergeSupplierSearchIntents(local: SupplierSearchIntent, ai?: Partial<SupplierSearchIntent> | null) {
  if (!ai) {
    return local;
  }
  return {
    ...local,
    acceptsCredit: ai.acceptsCredit ?? local.acceptsCredit,
    categories: unique([...local.categories, ...(ai.categories || [])]),
    creditDays: ai.creditDays || local.creditDays,
    creditStart: ai.creditStart || local.creditStart,
    governorates: unique([...local.governorates, ...(ai.governorates || [])]),
    minRating: ai.minRating || local.minRating,
    paymentOptions: unique([...local.paymentOptions, ...(ai.paymentOptions || [])]),
    searchTerms: unique([...(ai.searchTerms || []), ...local.searchTerms]),
  } satisfies SupplierSearchIntent;
}

export function recommendSuppliers(
  suppliers: Supplier[],
  intent: SupplierSearchIntent,
  taxonomy: TaxonomyLists,
  _locale: Locale,
  limit = 5,
) {
  const hasProductCriteria = intent.searchTerms.length > 0 || intent.categories.length > 0;
  const maxScore =
    (hasProductCriteria ? 30 : 0) +
    (intent.governorates.length ? 20 : 0) +
    (intent.paymentOptions.length ? 15 : 0) +
    (intent.acceptsCredit || intent.creditDays || intent.creditStart ? 15 : 0) +
    20;

  return suppliers
    .map((supplier): SupplierRecommendation & { rawScore: number } => {
      const reasons = new Set<SupplierRecommendation["reasons"][number]>();
      let rawScore = 0;
      const haystack = normalizeText(supplierSearchText(supplier, taxonomy));

      if (hasProductCriteria) {
        const categoryMatches = intent.categories.filter((item) => supplier.categories.includes(item)).length;
        const termMatches = intent.searchTerms.filter((term) => haystack.includes(normalizeText(term))).length;
        const categoryRatio = intent.categories.length ? categoryMatches / intent.categories.length : 0;
        const termRatio = intent.searchTerms.length ? termMatches / intent.searchTerms.length : 0;
        const productRatio = Math.max(categoryRatio, termRatio);
        rawScore += productRatio * 30;
        if (categoryMatches) reasons.add("category");
        if (termMatches) reasons.add("text");
      }

      if (intent.governorates.length) {
        const supplierLocations = supplierGovernorates(supplier);
        const matchesLocation =
          intent.governorates.some((item) => supplierLocations.includes(item)) ||
          supplier.coverageAreas?.includes("all_iraq");
        if (matchesLocation) {
          rawScore += 20;
          reasons.add("location");
        }
      }

      if (intent.paymentOptions.length) {
        const matches = intent.paymentOptions.filter((item) => supplier.paymentOptions?.includes(item)).length;
        if (matches) {
          rawScore += (matches / intent.paymentOptions.length) * 15;
          reasons.add("payment");
        }
      }

      if (intent.acceptsCredit || intent.creditDays || intent.creditStart) {
        let creditScore = 0;
        if (supplier.acceptsCredit) creditScore += 5;
        if (intent.creditDays && supplier.creditDays?.length) {
          if (supplier.creditDays.includes(intent.creditDays)) creditScore += 7;
          else if (supplier.creditDays.some((days) => days >= intent.creditDays!)) creditScore += 5;
        } else if (!intent.creditDays && supplier.acceptsCredit) {
          creditScore += 7;
        }
        if (intent.creditStart && supplier.creditStart === intent.creditStart) creditScore += 3;
        rawScore += Math.min(15, creditScore);
        if (creditScore) reasons.add("credit");
      }

      const rating = Math.max(0, Math.min(5, supplier.averageRating || 0));
      if (!intent.minRating || rating >= intent.minRating) {
        rawScore += (rating / 5) * 10;
        if (rating > 0) reasons.add("quality");
      }
      const confidenceScore = supplier.confidenceLevel === "high" ? 5 : supplier.confidenceLevel === "medium" ? 3 : 1;
      rawScore += confidenceScore;
      if (confidenceScore >= 3) reasons.add("quality");

      const updatedAt = toDate(supplier.updatedAt);
      const ageDays = updatedAt ? Math.max(0, (Date.now() - updatedAt.getTime()) / 86_400_000) : 9999;
      const freshnessScore = ageDays <= 180 ? 5 : ageDays <= 365 ? 3 : ageDays <= 730 ? 1 : 0;
      rawScore += freshnessScore;
      if (freshnessScore >= 3) reasons.add("freshness");

      return {
        rawScore,
        reasons: Array.from(reasons),
        score: Math.round((rawScore / Math.max(1, maxScore)) * 100),
        supplier,
      };
    })
    .filter((item) => !hasProductCriteria || item.reasons.includes("text") || item.reasons.includes("category"))
    .sort((a, b) => b.rawScore - a.rawScore || (b.supplier.averageRating || 0) - (a.supplier.averageRating || 0))
    .slice(0, limit)
    .map(({ rawScore: _rawScore, ...item }) => item);
}

export function describeIntent(intent: SupplierSearchIntent, taxonomy: TaxonomyLists, locale: Locale) {
  return [
    ...intent.searchTerms,
    ...intent.categories.map((value) => labelFor(taxonomy.supplierCategories, value, locale)),
    ...intent.governorates.map((value) => labelFor(taxonomy.governorates, value, locale)),
    ...intent.paymentOptions.map((value) => labelFor(paymentOptions, value, locale)),
    intent.acceptsCredit ? (locale === "ar" ? "دفع آجل" : "Credit payment") : "",
    intent.creditDays ? (locale === "ar" ? `${intent.creditDays} يوم` : `${intent.creditDays} days`) : "",
    intent.creditStart ? labelFor(creditStarts, intent.creditStart, locale) : "",
  ].filter(Boolean);
}

function extractCreditDays(value: string) {
  const days = value.match(/(\d{1,3})\s*(?:يوم|يوما|يومًا|day|days)/);
  if (days) return Number(days[1]);
  const months = value.match(/(\d{1,2})?\s*(?:شهر|اشهر|أشهر|month|months)/);
  if (months) return (Number(months[1]) || 1) * 30;
  const net = value.match(/\bnet\s*(\d{1,3})\b/);
  return net ? Number(net[1]) : undefined;
}

function detectCreditStart(value: string): CreditStart | undefined {
  if (/(بعد|من).*(اعتماد الفاتورة)|invoice approval/.test(value)) return "invoice_approval";
  if (/(بعد|من).*(الاستلام|التسليم)|delivery date|after delivery/.test(value)) return "delivery_date";
  if (/(بعد|من).*(الفاتورة|الفوترة)|invoice date|after invoice/.test(value)) return "invoice_date";
  return undefined;
}

function optionMentioned(normalizedQuery: string, value: string, labelEn: string, labelAr: string) {
  return [value.replaceAll("_", " "), labelEn, labelAr]
    .map(normalizeText)
    .some((candidate) => candidate.length > 1 && normalizedQuery.includes(candidate));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
