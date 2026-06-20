import type { DuplicateMatch, SupplierDraft, SupplierDuplicateIndex } from "../types/domain";

const arabicCommonWords = [
  "شركة",
  "مكتب",
  "مجموعة",
  "للتجارة",
  "التجارة",
  "العامة",
  "المحدودة",
  "للمقاولات",
  "مجهز",
  "مجهيز",
  "مؤسسة",
];

const englishCommonWords = [
  "company",
  "co",
  "ltd",
  "llc",
  "trading",
  "general",
  "group",
  "office",
  "services",
  "contracting",
  "corp",
  "corporation",
];

export function normalizeArabicName(value: string) {
  return value
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !arabicCommonWords.includes(word))
    .join(" ")
    .trim();
}

export function normalizeEnglishName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !englishCommonWords.includes(word))
    .join(" ")
    .trim();
}

export function normalizeName(value: string) {
  const normalizedArabic = normalizeArabicName(value);
  const normalizedEnglish = normalizeEnglishName(value);
  return `${normalizedArabic} ${normalizedEnglish}`.replace(/\s+/g, " ").trim();
}

export function normalizePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("00964")) {
    return `964${digits.slice(5)}`;
  }
  if (digits.startsWith("964")) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `964${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("7")) {
    return `964${digits}`;
  }
  return digits;
}

export function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() || "";
}

export function normalizeUrl(value?: string) {
  if (!value) {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export function tokenizeSearch(value: string) {
  return normalizeName(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function createSearchKeywords(draft: Pick<SupplierDraft, "nameOriginal" | "nameAr" | "nameEn" | "governorate" | "governorates" | "categories" | "subcategories" | "capabilityTags" | "city" | "marketArea">) {
  const governorates = draft.governorates?.length ? draft.governorates : draft.governorate ? [draft.governorate] : [];
  return Array.from(
    new Set([
      ...tokenizeSearch(draft.nameOriginal),
      ...tokenizeSearch(draft.nameAr || ""),
      ...tokenizeSearch(draft.nameEn || ""),
      ...draft.categories,
      ...draft.subcategories,
      ...draft.capabilityTags,
      ...governorates,
      draft.city,
      draft.marketArea,
    ].filter(Boolean)),
  );
}

function diceCoefficient(a: string, b: string) {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  const bigrams = (value: string) => {
    const normalized = value.replace(/\s+/g, "");
    const grams: string[] = [];
    for (let index = 0; index < normalized.length - 1; index += 1) {
      grams.push(normalized.slice(index, index + 2));
    }
    return grams;
  };
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  if (!aBigrams.length || !bBigrams.length) {
    return 0;
  }
  const bCopy = [...bBigrams];
  let matches = 0;
  for (const gram of aBigrams) {
    const foundIndex = bCopy.indexOf(gram);
    if (foundIndex >= 0) {
      matches += 1;
      bCopy.splice(foundIndex, 1);
    }
  }
  return (2 * matches) / (aBigrams.length + bBigrams.length);
}

export function findDuplicateMatches(draft: SupplierDraft, indexes: SupplierDuplicateIndex[]) {
  const matches: DuplicateMatch[] = [];
  const phones = new Set(draft.normalizedPhones.filter(Boolean));
  const email = normalizeEmail(draft.email);
  const website = normalizeUrl(draft.website);
  const facebook = normalizeUrl(draft.facebook);

  for (const item of indexes) {
    const sharedPhone = item.normalizedPhones.find((phone) => phones.has(phone));
    if (sharedPhone) {
      matches.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        reason: "same_phone",
        confidence: "high",
        score: 100,
      });
      continue;
    }

    if (email && item.normalizedEmail === email) {
      matches.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        reason: "same_email",
        confidence: "high",
        score: 95,
      });
      continue;
    }

    if (website && normalizeUrl(item.website) === website) {
      matches.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        reason: "same_website",
        confidence: "high",
        score: 90,
      });
      continue;
    }

    if (facebook && normalizeUrl(item.facebook) === facebook) {
      matches.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        reason: "same_facebook",
        confidence: "high",
        score: 90,
      });
      continue;
    }

    const nameScore = diceCoefficient(draft.normalizedName, item.normalizedName);
    const draftGovernorates = draft.governorates?.length ? draft.governorates : draft.governorate ? [draft.governorate] : [];
    const indexGovernorates = item.governorates?.length ? item.governorates : item.governorate ? [item.governorate] : [];
    const sameGovernorate = draftGovernorates.some((governorate) => indexGovernorates.includes(governorate));
    const sharedCategory = draft.categories.some((category) => item.categories.includes(category));
    if (nameScore >= 0.72 && (sameGovernorate || sharedCategory)) {
      matches.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        reason: "similar_name",
        confidence: nameScore > 0.86 ? "high" : "medium",
        score: Math.round(nameScore * 100),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 6);
}
