import type { FieldValue, Timestamp } from "firebase/firestore";

export type Locale = "en" | "ar";

export type UserRole = "owner" | "admin" | "contributor" | "viewer" | "suspended";

export type UserStatus = "pending_approval" | "approved" | "suspended";

export type AccessStatus = "pending" | "active" | "expired" | "temporary" | "suspended";

export type SupplierSubmissionStatus =
  | "draft"
  | "pending_review"
  | "needs_correction"
  | "approved"
  | "rejected"
  | "possible_duplicate"
  | "merged"
  | "archived";

export type SupplierStatus = "approved" | "watchlist" | "archived";

export type VerificationStatus =
  | "verified"
  | "community_submitted"
  | "needs_more_info"
  | "watchlist";

export type ConfidenceLevel = "high" | "medium" | "low" | "needs_verification";

export type SourceType =
  | "purchased_before"
  | "requested_quotation"
  | "trusted_recommendation"
  | "market_visit"
  | "found_online"
  | "known_market_supplier"
  | "other";

export type BusinessType =
  | "company"
  | "office"
  | "workshop"
  | "factory"
  | "trader"
  | "authorized_distributor"
  | "importer"
  | "service_provider"
  | "individual_supplier"
  | "other";

export type TimestampLike = Timestamp | Date | FieldValue | string | null | undefined;

export interface AppUser {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  organization: string;
  governorate: string;
  city?: string;
  sector: string;
  reasonForJoining?: string;
  role: UserRole;
  status: UserStatus;
  accessStatus: AccessStatus;
  accessExpiresAt: TimestampLike;
  trustScore: number;
  points: number;
  qualityRatio: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  duplicateSubmissions: number;
  approvedReviews: number;
  approvedNewSupplierContributions: number;
  consumedApprovedSupplierContributions: number;
  badges: string[];
  language?: Locale;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface PlatformSettings {
  requiredApprovedSuppliersPerMonth: number;
  daysGrantedPerBatch: number;
  maximumStackableMonths: number;
  gracePeriodDays: number;
  trialAccessDays: number;
  reviewsEarnBonusPoints: boolean;
  updateContributionsCanEarnAccessBonus: boolean;
  taxonomy?: TaxonomyLists;
}

export interface TaxonomyItem {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface TaxonomyLists {
  governorates: TaxonomyItem[];
  supplierCategories: TaxonomyItem[];
}

export interface DuplicateMatch {
  supplierId: string;
  supplierName: string;
  reason: "same_phone" | "same_email" | "same_website" | "same_facebook" | "similar_name" | "contact_phone";
  confidence: "high" | "medium" | "low";
  score: number;
}

export interface DuplicateCheck {
  hasPossibleDuplicate: boolean;
  matches: DuplicateMatch[];
  checkedAt?: TimestampLike;
}

export interface SupplierDraft {
  nameOriginal: string;
  displayName: string;
  nameLanguage: "arabic" | "english" | "mixed";
  nameAr?: string;
  nameEn?: string;
  shortDescription?: string;
  businessType: BusinessType;
  governorate: string;
  city: string;
  marketArea: string;
  address?: string;
  googleMapsLink?: string;
  coverageAreas: string[];
  phones: string[];
  normalizedPhones: string[];
  whatsappAvailable: "yes" | "no" | "unknown";
  email?: string;
  normalizedEmail?: string;
  website?: string;
  facebook?: string;
  instagramLinkedin?: string;
  contactPerson?: string;
  contactPersonRole?: string;
  categories: string[];
  subcategories: string[];
  capabilityTags: string[];
  paymentOptions: string[];
  sourceType: SourceType;
  confidenceLevel: ConfidenceLevel;
  hasDirectExperience: "yes" | "no" | "not_sure";
  lastInteractionYear?: string;
  relatedMaterialService?: string;
  sourceNote?: string;
  completionScore: number;
  normalizedName: string;
  searchKeywords: string[];
}

export interface Supplier extends SupplierDraft {
  id: string;
  nameOriginal: string;
  status: SupplierStatus;
  verificationStatus: VerificationStatus;
  sourceSummary: string;
  averageRating: number;
  reviewCount: number;
  createdBy: string;
  approvedBy: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface SupplierSubmission {
  id: string;
  submittedBy: string;
  submissionStatus: SupplierSubmissionStatus;
  supplierData: SupplierDraft;
  duplicateCheck: DuplicateCheck;
  adminDecision?: string;
  adminNotes?: string;
  countsForAccess: boolean;
  creditConsumed: boolean;
  createdAt: TimestampLike;
  reviewedAt?: TimestampLike;
}

export interface SupplierDuplicateIndex {
  supplierId: string;
  supplierName: string;
  normalizedName: string;
  normalizedPhones: string[];
  normalizedEmail?: string;
  website?: string;
  facebook?: string;
  contactPerson?: string;
  governorate: string;
  categories: string[];
}

export interface SupplierReview {
  id: string;
  supplierId: string;
  supplierName?: string;
  reviewedBy: string;
  status: "pending_review" | "approved" | "rejected";
  overall: number;
  responseSpeed: number;
  priceClarity: number;
  flexibility: number;
  deliveryCommitment: number;
  contractCommitment: number;
  quality: number;
  communication: number;
  documentation: number;
  interactionType: string;
  relatedCategory: string;
  positiveTags: string[];
  concernTags: string[];
  comment: string;
  interactionYear: string;
  createdAt: TimestampLike;
  approvedAt?: TimestampLike;
}

export interface ContributionLog {
  id: string;
  userId: string;
  type: "new_supplier" | "supplier_update" | "review" | "duplicate_report" | "profile_completed";
  supplierSubmissionId?: string;
  supplierId?: string;
  reviewId?: string;
  points: number;
  countsForAccess: boolean;
  createdAt: TimestampLike;
}

export interface AccessCredit {
  id: string;
  userId: string;
  source: "supplier_contribution" | "manual_grace" | "trial_access";
  approvedSupplierCount: number;
  daysGranted: number;
  status: "applied" | "pending";
  createdAt: TimestampLike;
  appliedAt?: TimestampLike;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: TimestampLike;
}
