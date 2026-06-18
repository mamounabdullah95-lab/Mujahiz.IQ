import { defaultSettings } from "../data/constants";
import type { AppUser, PlatformSettings, SupplierDraft } from "../types/domain";

export function calculateCompletionScore(draft: Partial<SupplierDraft>) {
  let score = 0;
  if (draft.nameOriginal && draft.displayName && draft.businessType) score += 18;
  if (draft.governorate && draft.city && draft.marketArea) score += 16;
  if ((draft.phones?.length || 0) > 0 || draft.email || draft.website || draft.facebook) score += 18;
  if ((draft.categories?.length || 0) > 0 && (draft.capabilityTags?.length || 0) > 0) score += 18;
  if (draft.sourceType && draft.confidenceLevel && draft.hasDirectExperience) score += 18;
  if (draft.address) score += 3;
  if (draft.contactPerson) score += 3;
  if (draft.shortDescription) score += 3;
  if (draft.googleMapsLink || draft.website || draft.facebook) score += 3;
  return Math.min(score, 100);
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
  if (!draft.governorate) missing.push("Governorate");
  if (!draft.city && !draft.marketArea) missing.push("City or market area");
  if (!(draft.phones?.length || draft.email || draft.website || draft.facebook)) missing.push("Contact method");
  if (!(draft.categories?.length || 0)) missing.push("Main category");
  if (!draft.sourceType) missing.push("Source of information");
  if (!draft.confidenceLevel) missing.push("Confidence level");
  if (!(draft.capabilityTags?.length || 0)) missing.push("Capability tag");
  return missing;
}

export function missingRequiredSupplierFieldKeys(draft: Partial<SupplierDraft>) {
  const missing: string[] = [];
  if (!draft.nameOriginal) missing.push("supplierName");
  if (!draft.governorate) missing.push("governorate");
  if (!draft.city && !draft.marketArea) missing.push("cityOrMarketArea");
  if (!(draft.phones?.length || draft.email || draft.website || draft.facebook)) missing.push("contactMethod");
  if (!(draft.categories?.length || 0)) missing.push("mainCategory");
  if (!draft.sourceType) missing.push("sourceType");
  if (!draft.confidenceLevel) missing.push("confidenceLevel");
  if (!(draft.capabilityTags?.length || 0)) missing.push("capabilityTag");
  return missing;
}
