import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { features } from "../config/features";
import { cloudFunctions, db, isFirebaseConfigured } from "../config/firebase";
import { findDuplicateMatches } from "../utils/normalization";
import * as demo from "./localDemo";
import type {
  DuplicateCheck,
  SupplierClaimSearchResult,
  SupplierDraft,
  SupplierOwnershipClaim,
  SupplierOwnershipClaimStatus,
  SupplierOwnershipEvidenceType,
} from "../types/domain";

export type SupplierClaimSearchMode = "exact" | "prefix";

export interface CreateSupplierOwnershipClaimInput {
  supplierProfileId: string;
  claimReason: string;
  evidenceType: SupplierOwnershipEvidenceType;
  evidenceSummary: string;
  referenceLinks: string[];
  idempotencyKey: string;
}

export interface SupplierOwnershipDecisionResult {
  claimId: string;
  status: SupplierOwnershipClaimStatus;
  idempotent: boolean;
}

export type SupplierOwnershipClaimCursor = QueryDocumentSnapshot<DocumentData> | null;

export interface SupplierOwnershipClaimPage {
  items: SupplierOwnershipClaim[];
  cursor: SupplierOwnershipClaimCursor;
  hasMore: boolean;
}

export interface SupplierOwnershipReviewProfile {
  supplierProfileId: string;
  nameAr: string;
  nameEn: string;
  displayName: string;
  nameOriginal: string;
  governorate: string;
  city: string;
  categories: string[];
  website?: string;
  status: string;
  verificationStatus: string;
  owned: boolean;
}

function requireClaimFeature() {
  if (!features.supplierProfileClaim || !cloudFunctions) {
    throw new Error("SUPPLIER_PROFILE_CLAIM_DISABLED");
  }
  return cloudFunctions;
}

function requireClaimReads() {
  if (!features.supplierProfileClaim || !isFirebaseConfigured) {
    throw new Error("SUPPLIER_PROFILE_CLAIM_DISABLED");
  }
}

function boundedPageSize(value: number, maximum = 50) {
  return Math.max(1, Math.min(maximum, Math.trunc(value) || 20));
}

function claimPage(documents: QueryDocumentSnapshot<DocumentData>[], pageSize: number): SupplierOwnershipClaimPage {
  return {
    items: documents.map((item) => ({ id: item.id, ...item.data() }) as SupplierOwnershipClaim),
    cursor: documents.length ? documents[documents.length - 1] : null,
    hasMore: documents.length === pageSize,
  };
}

async function listClaims(constraints: QueryConstraint[], pageSize: number, cursor: SupplierOwnershipClaimCursor) {
  requireClaimReads();
  const bounded = boundedPageSize(pageSize);
  const snapshot = await getDocs(query(
    collection(db, "supplierOwnershipClaims"),
    ...constraints,
    ...(cursor ? [startAfter(cursor)] : []),
    limit(bounded),
  ));
  return claimPage(snapshot.docs, bounded);
}

export function listMySupplierOwnershipClaims(
  claimantUserId: string,
  pageSize = 20,
  cursor: SupplierOwnershipClaimCursor = null,
) {
  if (!claimantUserId.trim()) throw new Error("AUTHENTICATION_REQUIRED");
  return listClaims([
    where("claimantUserId", "==", claimantUserId),
    orderBy("createdAt", "desc"),
  ], pageSize, cursor);
}

export function listAdminSupplierOwnershipClaims(
  status: SupplierOwnershipClaimStatus = "pending_review",
  pageSize = 25,
  cursor: SupplierOwnershipClaimCursor = null,
) {
  return listClaims([
    where("status", "==", status),
    orderBy("createdAt", "desc"),
  ], pageSize, cursor);
}

export function listSupplierProfileOwnershipClaims(
  supplierProfileId: string,
  status: SupplierOwnershipClaimStatus = "pending_review",
  pageSize = 21,
  cursor: SupplierOwnershipClaimCursor = null,
) {
  if (!supplierProfileId.trim()) throw new Error("INVALID_SUPPLIER_PROFILE");
  return listClaims([
    where("supplierProfileId", "==", supplierProfileId),
    where("status", "==", status),
    orderBy("createdAt", "desc"),
  ], pageSize, cursor);
}

export async function getSupplierOwnershipClaim(claimId: string) {
  requireClaimReads();
  if (!claimId.trim() || claimId.includes("/")) throw new Error("INVALID_CLAIM_ID");
  const snapshot = await getDoc(doc(db, "supplierOwnershipClaims", claimId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as SupplierOwnershipClaim) : null;
}

export async function getSupplierOwnershipReviewProfile(supplierProfileId: string) {
  requireClaimReads();
  if (!supplierProfileId.trim() || supplierProfileId.includes("/")) throw new Error("INVALID_SUPPLIER_PROFILE");
  const snapshot = await getDoc(doc(db, "suppliers", supplierProfileId));
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  return {
    supplierProfileId: snapshot.id,
    nameAr: typeof value.nameAr === "string" ? value.nameAr : "",
    nameEn: typeof value.nameEn === "string" ? value.nameEn : "",
    displayName: typeof value.displayName === "string" ? value.displayName : "",
    nameOriginal: typeof value.nameOriginal === "string" ? value.nameOriginal : "",
    governorate: typeof value.governorate === "string" ? value.governorate : "",
    city: typeof value.city === "string" ? value.city : "",
    categories: Array.isArray(value.categories)
      ? value.categories.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [],
    ...(typeof value.website === "string" && value.website ? { website: value.website } : {}),
    status: typeof value.status === "string" ? value.status : "",
    verificationStatus: typeof value.verificationStatus === "string" ? value.verificationStatus : "",
    owned: typeof value.accountOwnerId === "string" && Boolean(value.accountOwnerId.trim()),
  } satisfies SupplierOwnershipReviewProfile;
}

export async function searchSupplierProfilesForClaim(
  searchText: string,
  mode: SupplierClaimSearchMode = "prefix",
) {
  const callable = httpsCallable<
    { query: string; mode: SupplierClaimSearchMode },
    { items: SupplierClaimSearchResult[] }
  >(requireClaimFeature(), "searchSupplierProfilesForClaim");
  const result = await callable({ query: searchText, mode });
  return result.data.items;
}

export async function createSupplierOwnershipClaim(input: CreateSupplierOwnershipClaimInput) {
  const callable = httpsCallable<
    CreateSupplierOwnershipClaimInput,
    { claimId: string; status: "pending_review"; expiresAt: string }
  >(requireClaimFeature(), "createSupplierOwnershipClaim");
  const result = await callable(input);
  return result.data;
}

export async function withdrawSupplierOwnershipClaim(claimId: string) {
  const callable = httpsCallable<{ claimId: string }, SupplierOwnershipDecisionResult>(
    requireClaimFeature(),
    "withdrawSupplierOwnershipClaim",
  );
  const result = await callable({ claimId });
  return result.data;
}

export async function decideSupplierOwnershipClaim(
  claimId: string,
  decision: "approve" | "reject",
  adminNotes = "",
) {
  const callable = httpsCallable<
    { claimId: string; decision: "approve" | "reject"; adminNotes: string },
    SupplierOwnershipDecisionResult
  >(requireClaimFeature(), "decideSupplierOwnershipClaim");
  const result = await callable({ claimId, decision, adminNotes });
  return result.data;
}

export async function approveSupplierSubmissionTrusted(
  submissionId: string,
  editedSupplierData?: SupplierDraft,
  duplicateOverrideReason?: string,
) {
  if (!cloudFunctions) throw new Error("FIREBASE_FUNCTIONS_UNAVAILABLE");
  const callable = httpsCallable<
    { submissionId: string; editedSupplierData?: SupplierDraft; duplicateOverrideReason?: string },
    { supplierProfileId: string; idempotent: boolean }
  >(cloudFunctions, "approveSupplierSubmissionTrusted");
  const result = await callable({
    submissionId,
    ...(editedSupplierData ? { editedSupplierData } : {}),
    ...(duplicateOverrideReason ? { duplicateOverrideReason } : {}),
  });
  return result.data;
}

export async function decideSupplierSubmissionTrusted(
  submissionId: string,
  decision: "needs_correction" | "rejected" | "possible_duplicate" | "merged" | "archived",
  adminNotes: string,
) {
  if (!cloudFunctions) throw new Error("FIREBASE_FUNCTIONS_UNAVAILABLE");
  const callable = httpsCallable<
    { submissionId: string; decision: string; adminNotes: string },
    { submissionId: string; status: string; idempotent: boolean }
  >(cloudFunctions, "decideSupplierSubmissionTrusted");
  const result = await callable({ submissionId, decision, adminNotes });
  return result.data;
}

export async function checkSupplierDuplicatesTrusted(
  items: Array<{ supplierData: SupplierDraft; excludeSupplierId?: string; excludeSubmissionId?: string }>,
) {
  if (!cloudFunctions) {
    const indexes = await demo.demoFetchDuplicateIndexes();
    return items.map((item) => {
      const matches = findDuplicateMatches(
        item.supplierData,
        indexes.filter((index) => index.supplierId !== item.excludeSupplierId),
      );
      return {
        hasPossibleDuplicate: matches.length > 0,
        hasExactDuplicate: matches.some((match) => match.reason !== "similar_name"),
        matches,
      };
    });
  }
  const callable = httpsCallable<
    { items: Array<{ supplierData: SupplierDraft; excludeSupplierId?: string; excludeSubmissionId?: string }> },
    { checks: Array<DuplicateCheck & { hasExactDuplicate: boolean }> }
  >(cloudFunctions, "checkSupplierDuplicatesTrusted");
  const result = await callable({ items });
  return result.data.checks;
}

export async function setUserRoleAndStatusTrusted(
  userId: string,
  role: "owner" | "admin" | "contributor" | "viewer" | "suspended",
  status: "pending_approval" | "approved" | "suspended",
) {
  if (!cloudFunctions) throw new Error("FIREBASE_FUNCTIONS_UNAVAILABLE");
  const callable = httpsCallable<
    { userId: string; role: string; status: string },
    { userId: string; idempotent: boolean }
  >(cloudFunctions, "setUserRoleAndStatusTrusted");
  const result = await callable({ userId, role, status });
  return result.data;
}
export async function grantTemporaryAccessTrusted(userId: string, days: number) {
  if (!cloudFunctions) throw new Error("FIREBASE_FUNCTIONS_UNAVAILABLE");
  const callable = httpsCallable<
    { userId: string; days: number },
    { userId: string; accessExpiresAt: string }
  >(cloudFunctions, "grantTemporaryAccessTrusted");
  const result = await callable({ userId, days });
  return result.data;
}
