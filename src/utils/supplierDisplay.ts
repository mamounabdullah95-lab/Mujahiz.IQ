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

const phrasePairs = [
  ["al majal", "\u0627\u0644\u0645\u062c\u0627\u0644"],
  ["al usool", "\u0627\u0644\u0627\u0635\u0648\u0644"],
  ["al usool general trading", "\u0627\u0644\u0627\u0635\u0648\u0644 \u0644\u0644\u062a\u062c\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629"],
  ["general trading", "\u062a\u062c\u0627\u0631\u0629 \u0639\u0627\u0645\u0629"],
  ["trading", "\u062a\u062c\u0627\u0631\u0629"],
  ["company", "\u0634\u0631\u0643\u0629"],
  ["co", "\u0634\u0631\u0643\u0629"],
  ["ltd", "\u0645\u062d\u062f\u0648\u062f\u0629"],
  ["limited", "\u0645\u062d\u062f\u0648\u062f\u0629"],
  ["services", "\u062e\u062f\u0645\u0627\u062a"],
  ["service", "\u062e\u062f\u0645\u0629"],
  ["energy services", "\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0637\u0627\u0642\u0629"],
  ["energy", "\u0627\u0644\u0637\u0627\u0642\u0629"],
  ["oil and gas", "\u0627\u0644\u0646\u0641\u0637 \u0648\u0627\u0644\u063a\u0627\u0632"],
  ["oil & gas", "\u0627\u0644\u0646\u0641\u0637 \u0648\u0627\u0644\u063a\u0627\u0632"],
  ["gas", "\u0627\u0644\u063a\u0627\u0632"],
  ["oil", "\u0627\u0644\u0646\u0641\u0637"],
  ["valves", "\u0635\u0645\u0627\u0645\u0627\u062a"],
  ["valve", "\u0635\u0645\u0627\u0645"],
  ["pumps", "\u0645\u0636\u062e\u0627\u062a"],
  ["pump", "\u0645\u0636\u062e\u0629"],
  ["fittings", "\u062a\u0648\u0635\u064a\u0644\u0627\u062a"],
  ["pipes", "\u0627\u0646\u0627\u0628\u064a\u0628"],
  ["pipe", "\u0627\u0646\u0628\u0648\u0628"],
  ["mechanical", "\u0645\u064a\u0643\u0627\u0646\u064a\u0643\u064a"],
  ["electrical", "\u0643\u0647\u0631\u0628\u0627\u0626\u064a"],
  ["safety", "\u0633\u0644\u0627\u0645\u0629"],
  ["industrial", "\u0635\u0646\u0627\u0639\u064a"],
  ["construction", "\u0627\u0646\u0634\u0627\u0621\u0627\u062a"],
  ["equipment", "\u0645\u0639\u062f\u0627\u062a"],
  ["materials", "\u0645\u0648\u0627\u062f"],
  ["material", "\u0645\u0627\u062f\u0629"],
  ["transporting", "\u0646\u0642\u0644"],
  ["transport", "\u0646\u0642\u0644"],
  ["maritime", "\u0628\u062d\u0631\u064a\u0629"],
  ["international", "\u062f\u0648\u0644\u064a\u0629"],
  ["local", "\u0645\u062d\u0644\u064a"],
  ["market", "\u0633\u0648\u0642"],
  ["area", "\u0645\u0646\u0637\u0642\u0629"],
  ["street", "\u0634\u0627\u0631\u0639"],
  ["district", "\u0645\u0646\u0637\u0642\u0629"],
  ["baghdad", "\u0628\u063a\u062f\u0627\u062f"],
  ["basra", "\u0627\u0644\u0628\u0635\u0631\u0629"],
  ["erbil", "\u0627\u0631\u0628\u064a\u0644"],
  ["ramadi", "\u0627\u0644\u0631\u0645\u0627\u062f\u064a"],
  ["mosul", "\u0627\u0644\u0645\u0648\u0635\u0644"],
  ["manual grace", "\u0645\u0646\u062d\u0629 \u064a\u062f\u0648\u064a\u0629"],
  ["trial access", "\u0648\u0635\u0648\u0644 \u062a\u062c\u0631\u064a\u0628\u064a"],
  ["purchased before", "\u062a\u0645 \u0627\u0644\u0634\u0631\u0627\u0621 \u0633\u0627\u0628\u0642\u0627"],
  ["requested quotation", "\u062a\u0645 \u0637\u0644\u0628 \u0639\u0631\u0636 \u0633\u0639\u0631"],
  ["trusted recommendation", "\u062a\u0648\u0635\u064a\u0629 \u0645\u0648\u062b\u0648\u0642\u0629"],
  ["market visit", "\u0632\u064a\u0627\u0631\u0629 \u0645\u064a\u062f\u0627\u0646\u064a\u0629 \u0644\u0644\u0633\u0648\u0642"],
  ["found online", "\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u064a\u0647 \u0639\u0628\u0631 \u0627\u0644\u0627\u0646\u062a\u0631\u0646\u062a"],
  ["known market supplier", "\u0645\u062c\u0647\u0632 \u0645\u0639\u0631\u0648\u0641 \u0641\u064a \u0627\u0644\u0633\u0648\u0642"],
] as const;

const phrasePairsByLength = [...phrasePairs].sort((a, b) => b[0].length - a[0].length);

const arabicPhrasePairs = phrasePairsByLength.map(([en, ar]) => [ar, titleCase(en.replaceAll("_", " "))] as const);

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
  const fallback = supplier.displayName || supplier.nameOriginal || "-";
  if (locale === "ar") {
    return supplier.nameAr || localizedSupplierText(fallback, locale);
  }
  return supplier.nameEn || localizedSupplierText(fallback, locale);
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
  return localizedSupplierText(text, locale);
}

export function localizedSupplierText(value: string | undefined, locale: Locale) {
  const text = value?.trim();
  if (!text) {
    return "";
  }

  const readableText = text.replaceAll("_", " ");
  if (locale === "ar") {
    return hasLatin(readableText) ? translateEnglishLikeText(readableText) : readableText;
  }

  return hasArabic(readableText) ? translateArabicLikeText(readableText) : readableText;
}

export function supplierGovernorates(supplier: Pick<SupplierDraft, "governorate" | "governorates">) {
  const values = supplier.governorates?.length ? supplier.governorates : supplier.governorate ? [supplier.governorate] : [];
  return Array.from(new Set(values.filter(Boolean)));
}

export function localizedSupplierGovernorates(
  supplier: Pick<SupplierDraft, "governorate" | "governorates">,
  taxonomy: TaxonomyLists,
  locale: Locale,
) {
  return supplierGovernorates(supplier)
    .map((governorate) => labelFor(taxonomy.governorates, governorate, locale))
    .join(", ");
}

export function supplierSearchText(supplier: Supplier, taxonomy: TaxonomyLists) {
  const governorates = supplierGovernorates(supplier);
  const taxonomyLabels = [
    ...governorates.flatMap((governorate) => [
      labelFor(taxonomy.governorates, governorate, "en"),
      labelFor(taxonomy.governorates, governorate, "ar"),
    ]),
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
    localizedSupplierText(supplier.marketArea, "en"),
    localizedSupplierText(supplier.marketArea, "ar"),
    supplier.address,
    localizedSupplierText(supplier.address, "en"),
    localizedSupplierText(supplier.address, "ar"),
    supplier.shortDescription,
    localizedSupplierText(supplier.shortDescription, "en"),
    localizedSupplierText(supplier.shortDescription, "ar"),
    supplier.sourceSummary,
    localizedSupplierText(supplier.sourceSummary, "en"),
    localizedSupplierText(supplier.sourceSummary, "ar"),
    supplier.relatedMaterialService,
    localizedSupplierText(supplier.relatedMaterialService, "en"),
    localizedSupplierText(supplier.relatedMaterialService, "ar"),
    supplier.sourceNote,
    localizedSupplierText(supplier.sourceNote, "en"),
    localizedSupplierText(supplier.sourceNote, "ar"),
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

function hasLatin(value?: string) {
  return /[A-Za-z]/.test(value || "");
}

function translateEnglishLikeText(value: string) {
  const phraseTranslated = replacePhrases(value, phrasePairsByLength, "gi");
  return phraseTranslated.replace(/[A-Za-z][A-Za-z.'-]*/g, (word) => {
    if (word.length <= 2 && word.toUpperCase() === word) {
      return word;
    }
    return transliterateLatinToArabic(word);
  });
}

function translateArabicLikeText(value: string) {
  const phraseTranslated = replacePhrases(value, arabicPhrasePairs, "g");
  return phraseTranslated.replace(/[\u0600-\u06ff]+/g, (word) => transliterateArabic(word));
}

function replacePhrases(value: string, phrases: readonly (readonly [string, string])[], flags: string) {
  return phrases.reduce((current, [from, to]) => {
    const pattern = hasLatin(from)
      ? `\\b${escapeRegExp(from)}\\b`
      : escapeRegExp(from);
    return current.replace(new RegExp(pattern, flags), to);
  }, value);
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

function transliterateLatinToArabic(value?: string) {
  let text = (value || "").toLowerCase();
  if (!text) {
    return "";
  }
  text = text
    .replace(/^al(?=[a-z])/, "\u0627\u0644")
    .replace(/kh/g, "\u062e")
    .replace(/sh/g, "\u0634")
    .replace(/ch/g, "\u062c")
    .replace(/th/g, "\u062b")
    .replace(/dh/g, "\u0630")
    .replace(/gh/g, "\u063a")
    .replace(/ph/g, "\u0641");

  const latinToArabic: Record<string, string> = {
    a: "\u0627",
    b: "\u0628",
    c: "\u0643",
    d: "\u062f",
    e: "\u064a",
    f: "\u0641",
    g: "\u0643",
    h: "\u0647",
    i: "\u064a",
    j: "\u062c",
    k: "\u0643",
    l: "\u0644",
    m: "\u0645",
    n: "\u0646",
    o: "\u0648",
    p: "\u0628",
    q: "\u0642",
    r: "\u0631",
    s: "\u0633",
    t: "\u062a",
    u: "\u0648",
    v: "\u0641",
    w: "\u0648",
    x: "\u0643\u0633",
    y: "\u064a",
    z: "\u0632",
  };

  return text
    .split("")
    .map((char) => latinToArabic[char] ?? char)
    .join("")
    .replace(/\u0627\u0627+/g, "\u0627")
    .replace(/\u064a\u064a+/g, "\u064a")
    .replace(/\u0648\u0648+/g, "\u0648")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
