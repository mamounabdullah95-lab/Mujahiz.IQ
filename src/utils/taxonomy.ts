import { defaultTaxonomyLists, labelFor } from "../data/constants";
import type { Locale, PlatformSettings, TaxonomyItem, TaxonomyLists } from "../types/domain";

const legacyArabicLabels = new Set([
  "فلنجات ووصلات",
  "أجهزة قياس وسيطرة",
  "حديد وتصنيع",
  "لحام وخراطة",
  "سلامة ومعدات حماية",
  "عدد ومعدات",
  "نقل ولوجستيات",
  "تقنية ومعدات إلكترونية",
  "مواد كيمياوية",
]);

export function slugFromLabel(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `item_${Date.now().toString(36)}`;
}

export function normalizeTaxonomyItems(items: TaxonomyItem[] | undefined, fallback: TaxonomyItem[]) {
  const source = items?.length ? items : fallback;
  const fallbackByValue = new Map(fallback.map((item) => [item.value, item]));
  const seen = new Set<string>();
  return source
    .map((item) => {
      const value = item.value?.trim() || slugFromLabel(item.labelEn || item.labelAr);
      const defaultItem = fallbackByValue.get(value);
      const storedArabicLabel = item.labelAr?.trim();
      return {
        value,
        labelEn: item.labelEn?.trim() || item.value?.replaceAll("_", " ") || item.labelAr,
        labelAr: storedArabicLabel && !legacyArabicLabels.has(storedArabicLabel)
          ? storedArabicLabel
          : defaultItem?.labelAr || item.labelEn?.trim() || item.value?.replaceAll("_", " "),
      };
    })
    .filter((item) => {
      if (!item.value || seen.has(item.value)) {
        return false;
      }
      seen.add(item.value);
      return true;
    });
}

export function taxonomyFromSettings(settings?: PlatformSettings | null): TaxonomyLists {
  return {
    governorates: normalizeTaxonomyItems(settings?.taxonomy?.governorates, defaultTaxonomyLists.governorates),
    supplierCategories: normalizeTaxonomyItems(
      settings?.taxonomy?.supplierCategories,
      defaultTaxonomyLists.supplierCategories,
    ),
  };
}

export function taxonomyLabel(options: TaxonomyItem[], value: string, locale: Locale) {
  return labelFor(options, value, locale);
}
