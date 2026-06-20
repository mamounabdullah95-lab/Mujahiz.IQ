import { capabilityTags, creditStarts, labelFor, paymentOptions, type OptionItem } from "../data/constants";
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
  ["subject to company approval", "خاضع لموافقة الشركة"],
  ["verified by procurement team", "تم التحقق بواسطة فريق المشتريات"],
  ["industrial valves", "صمامات صناعية"],
  ["mechanical supplies", "تجهيزات ميكانيكية"],
  ["industrial supplies", "تجهيزات صناعية"],
  ["electrical supplies", "تجهيزات كهربائية"],
  ["main branch", "الفرع الرئيسي"],
  ["sales office", "مكتب المبيعات"],
  ["industrial area", "المنطقة الصناعية"],
  ["authorized distributor", "موزّع معتمد"],
  ["authorized agent", "وكيل معتمد"],
  ["distributor", "موزّع"],
  ["distribution", "توزيع"],
  ["service provider", "مقدّم خدمات"],
  ["technical support", "دعم فني"],
  ["technical services", "خدمات فنية"],
  ["instrumentation and control", "أجهزة القياس والتحكم"],
  ["instrumentation", "أجهزة القياس والتحكم"],
  ["flanges and fittings", "الفلنجات وملحقات الأنابيب"],
  ["welding and machining", "اللحام والتشغيل الميكانيكي"],
  ["safety and ppe", "معدات السلامة والوقاية الشخصية"],
  ["transportation and logistics", "النقل والخدمات اللوجستية"],
  ["company profile", "ملف تعريفي للشركة"],
  ["power plants", "محطات الطاقة"],
  ["power plant", "محطة طاقة"],
  ["power projects", "مشاريع الطاقة"],
  ["sales engineer", "مهندس مبيعات"],
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
  ["supplies", "تجهيزات"],
  ["supply", "تجهيز"],
  ["for", "لـ"],
  ["and", "و"],
] as const;

const phrasePairsByLength = [...phrasePairs].sort((a, b) => b[0].length - a[0].length);

const arabicPhrasePairs = phrasePairsByLength.map(([en, ar]) => [ar, titleCase(en.replaceAll("_", " "))] as const);

export function localizedSupplierName(supplier: Pick<SupplierDraft, "nameAr" | "nameEn" | "displayName" | "nameOriginal">, locale: Locale) {
  const fallback = supplier.displayName || supplier.nameOriginal || "-";
  if (locale === "ar") {
    return supplier.nameAr || fallback;
  }
  return supplier.nameEn || fallback;
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
    ...supplier.paymentOptions.flatMap((option) => [labelFor(paymentOptions, option, "en"), labelFor(paymentOptions, option, "ar")]),
    ...(supplier.creditStart ? [labelFor(creditStarts, supplier.creditStart, "en"), labelFor(creditStarts, supplier.creditStart, "ar")] : []),
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
    ...(supplier.branches || []).flatMap((branch) => [
      branch.governorate,
      branch.city,
      localizedCity(branch.city, "en"),
      localizedCity(branch.city, "ar"),
      branch.marketArea,
      branch.address,
      branch.phone,
    ]),
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
    ...supplier.paymentOptions,
    ...(supplier.creditDays || []).map(String),
    supplier.creditTermsNote,
    localizedSupplierText(supplier.creditTermsNote, "en"),
    localizedSupplierText(supplier.creditTermsNote, "ar"),
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
  return replacePhrases(value, phrasePairsByLength, "gi");
}

function translateArabicLikeText(value: string) {
  return replacePhrases(value, arabicPhrasePairs, "g");
}

function replacePhrases(value: string, phrases: readonly (readonly [string, string])[], flags: string) {
  return phrases.reduce((current, [from, to]) => {
    const pattern = hasLatin(from)
      ? `\\b${escapeRegExp(from)}\\b`
      : escapeRegExp(from);
    return current.replace(new RegExp(pattern, flags), to);
  }, value);
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
