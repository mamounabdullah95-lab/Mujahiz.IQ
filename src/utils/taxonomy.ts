import { defaultTaxonomyLists, labelFor } from "../data/constants";
import type { Locale, PlatformSettings, TaxonomyItem, TaxonomyLists } from "../types/domain";

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
  const seen = new Set<string>();
  return source
    .map((item) => ({
      value: item.value?.trim() || slugFromLabel(item.labelEn || item.labelAr),
      labelEn: item.labelEn?.trim() || item.value?.replaceAll("_", " ") || item.labelAr,
      labelAr: item.labelAr?.trim() || item.labelEn?.trim() || item.value?.replaceAll("_", " "),
    }))
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
