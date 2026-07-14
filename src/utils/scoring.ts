import { defaultSettings } from "../data/constants";
import type { AppUser, PlatformSettings, SupplierDraft } from "../types/domain";

export function calculateCompletionScore(draft: Partial<SupplierDraft>) {
  const requiredChecks: Array<[boolean, number]> = [
    [Boolean(draft.nameOriginal), 8],
    [Boolean(draft.businessType), 6],
    [Boolean(draft.nameAr), 7],
    [Boolean(draft.nameEn), 7],
    [Boolean(draft.shortDescription), 8],
    [Boolean(draft.governorate), 7],
    [Boolean(draft.city || draft.marketArea), 5],
    [Boolean(draft.address), 8],
    [Boolean(draft.phones?.length), 8],
    [Boolean(draft.email), 8],
    [Boolean(draft.categories?.length), 7],
    [Boolean(draft.capabilityTags?.length), 7],
    [Boolean(draft.sourceType), 7],
    [Boolean(draft.confidenceLevel), 7],
  ];

  return requiredChecks.reduce((score, [complete, weight]) => score + (complete ? weight : 0), 0);
}

export function qualityRatio(approved: number, rejected: number, duplicates: number) {
  const reviewed = approved + rejected + duplicates;
  if (!reviewed) {
    return 0;
  }
  return Number((approved / reviewed).toFixed(2));
}

export function calculateAccessGrant(
  user: Pick<AppUser, "approvedNewSupplierContributions" | "consumedApprovedSupplierContributions" | "accessExpiresAt">,
  settings: PlatformSettings = defaultSettings,
) {
  const available =
    Math.max(0, user.approvedNewSupplierContributions - user.consumedApprovedSupplierContributions);
  const monthsToGrant = Math.floor(available / settings.requiredApprovedSuppliersPerMonth);
  const clampedMonths = Math.min(monthsToGrant, settings.maximumStackableMonths);
  const daysToGrant = clampedMonths * settings.daysGrantedPerBatch;
  const consumed = clampedMonths * settings.requiredApprovedSuppliersPerMonth;
  return {
    available,
    monthsToGrant: clampedMonths,
    daysToGrant,
    consumed,
    remainingAfterGrant: available - consumed,
  };
}

export function deriveBadges(user: Pick<AppUser, "approvedSubmissions" | "approvedReviews" | "qualityRatio" | "duplicateSubmissions" | "badges">) {
  const badges = new Set(user.badges || []);
  if (user.approvedSubmissions >= 10) badges.add("first_10_suppliers");
  if (user.approvedSubmissions >= 50) badges.add("approved_50_suppliers");
  if (user.approvedSubmissions >= 100) badges.add("approved_100_suppliers");
  if (user.qualityRatio >= 0.85 && user.approvedSubmissions >= 20) badges.add("quality_contributor");
  if (user.approvedReviews >= 10) badges.add("review_contributor");
  if (user.duplicateSubmissions >= 5) badges.add("duplicate_hunter");
  if (user.approvedSubmissions >= 25 && user.qualityRatio >= 0.75) badges.add("trusted_contributor");
  return Array.from(badges);
}

export function missingRequiredSupplierFields(draft: Partial<SupplierDraft>) {
  const missing: string[] = [];
  if (!draft.nameOriginal) missing.push("Supplier name");
  if (!draft.businessType) missing.push("Business type");
  if (!draft.nameAr) missing.push("Arabic company name");
  if (!draft.nameEn) missing.push("English company name");
  if (!draft.shortDescription) missing.push("Short description");
  if (!draft.governorate) missing.push("Governorate");
  if (!draft.city && !draft.marketArea) missing.push("City or market area");
  if (!draft.address) missing.push("Full address");
  if (!draft.phones?.length) missing.push("Primary phone");
  if (!draft.email) missing.push("Email");
  if (!draft.categories?.length) missing.push("Main category");
  if (!draft.sourceType) missing.push("Source of information");
  if (!draft.confidenceLevel) missing.push("Confidence level");
  if (!draft.capabilityTags?.length) missing.push("Capability tag");
  return missing;
}

export function missingRequiredSupplierFieldKeys(draft: Partial<SupplierDraft>) {
  const missing: string[] = [];
  if (!draft.nameOriginal) missing.push("supplierName");
  if (!draft.businessType) missing.push("businessType");
  if (!draft.nameAr) missing.push("arabicCompanyName");
  if (!draft.nameEn) missing.push("englishCompanyName");
  if (!draft.shortDescription) missing.push("shortDescription");
  if (!draft.governorate) missing.push("governorate");
  if (!draft.city && !draft.marketArea) missing.push("cityOrMarketArea");
  if (!draft.address) missing.push("address");
  if (!draft.phones?.length) missing.push("primaryPhone");
  if (!draft.email) missing.push("email");
  if (!draft.categories?.length) missing.push("mainCategory");
  if (!draft.sourceType) missing.push("sourceType");
  if (!draft.confidenceLevel) missing.push("confidenceLevel");
  if (!draft.capabilityTags?.length) missing.push("capabilityTag");
  return missing;
}
