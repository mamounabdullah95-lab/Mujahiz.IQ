import { capabilityTags, labelFor, type OptionItem } from "../data/constants";
import type { Locale, Supplier, SupplierDraft, TaxonomyLists } from "../types/domain";

const cityPairs = [
  ["baghdad", "Baghdad", "بغداد"],
  ["basra", "Basra", "البصرة"],
  ["mosul", "Mosul", "الموصل"],
  ["erbil", "Erbil", "أربيل"],
  ["ramadi", "Ramadi", "الرمادي"],
  ["fallujah", "Fallujah", "الفلوجة"],
  ["najaf", "Najaf", "النجف"],
  ["karbala", "Karbala", "كربلاء"],
  ["hillah", "Hillah", "الحلة"],
  ["nasiriyah", "Nasiriyah", "الناصرية"],
  ["amara", "Amarah", "العمارة"],
  ["kut", "Kut", "الكوت"],
  ["diwaniyah", "Diwaniyah", "الديوانية"],
  ["samawah", "Samawah", "السماوة"],
  ["tikrit", "Tikrit", "تكريت"],
  ["baqubah", "Baqubah", "بعقوبة"],
  ["kirkuk", "Kirkuk", "كركوك"],
  ["duhok", "Duhok", "دهوك"],
  ["sulaymaniyah", "Sulaymaniyah", "السليمانية"],
] as const;

const arabicToLatin: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ة: "a",
  ء: "",
  ئ: "e",
  ؤ: "o",
};

export function localizedSupplierName(supplier: Pick<SupplierDraft, "nameAr" | "nameEn" | "displayName" | "nameOriginal">, locale: Locale) {
  if (locale === "ar") {
    return supplier.nameAr || supplier.displayName || supplier.nameOriginal || "-";
  }
  return supplier.nameEn || (hasArabic(supplier.displayName || supplier.nameOriginal) ? transliterateArabic(supplier.displayName || supplier.nameOriginal) : supplier.displayName || supplier.nameOriginal || "-");
}

export function localizedCity(value: string | undefined, locale: Locale) {
  const text = value?.trim();
  if (!text) {
    return "";
  }
  const normalized = normalizeDisplayText(text);
  const pair = cityPairs.find(([key, en, ar]) => [key, en, ar].some((item) => normalizeDisplayText(item) === normalized));
  if (pair) {
    return locale === "ar" ? pair[2] : pair[1];
  }
  if (locale === "en" && hasArabic(text)) {
    return transliterateArabic(text);
  }
  return text;
}

export function supplierSearchText(supplier: Supplier, taxonomy: TaxonomyLists) {
  const taxonomyLabels = [
    labelFor(taxonomy.governorates, supplier.governorate, "en"),
    labelFor(taxonomy.governorates, supplier.governorate, "ar"),
    ...supplier.categories.flatMap((category) => [
      labelFor(taxonomy.supplierCategories, category, "en"),
      labelFor(taxonomy.supplierCategories, category, "ar"),
    ]),
    ...supplier.capabilityTags.flatMap((tag) => [labelFor(capabilityTags, tag, "en"), labelFor(capabilityTags, tag, "ar")]),
  ];
  const cityAliases = cityPairs
    .filter(([, en, ar]) => [supplier.city, supplier.marketArea].some((value) => [en, ar].some((item) => normalizeDisplayText(item) === normalizeDisplayText(value || ""))))
    .flatMap(([, en, ar]) => [en, ar]);

  return [
    supplier.nameOriginal,
    supplier.displayName,
    supplier.nameAr,
    supplier.nameEn,
    localizedSupplierName(supplier, "en"),
    localizedSupplierName(supplier, "ar"),
    supplier.city,
    supplier.marketArea,
    localizedCity(supplier.city, "en"),
    localizedCity(supplier.city, "ar"),
    supplier.address,
    supplier.shortDescription,
    supplier.sourceSummary,
    supplier.relatedMaterialService,
    supplier.sourceNote,
    ...supplier.searchKeywords,
    ...supplier.subcategories,
    ...supplier.categories,
    ...supplier.capabilityTags,
    ...taxonomyLabels,
    ...cityAliases,
  ]
    .filter(Boolean)
    .join(" ");
}

export function allIraqOption(locale: Locale): OptionItem {
  return { value: "", labelEn: "All Iraq", labelAr: locale === "ar" ? "كل العراق" : "All Iraq" };
}

function hasArabic(value?: string) {
  return /[\u0600-\u06ff]/.test(value || "");
}

function transliterateArabic(value?: string) {
  const transliterated = (value || "")
    .split("")
    .map((char) => arabicToLatin[char] ?? char)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return transliterated
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function normalizeDisplayText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
