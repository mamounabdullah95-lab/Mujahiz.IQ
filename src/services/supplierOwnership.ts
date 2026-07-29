import { httpsCallable } from "firebase/functions";
import { features } from "../config/features";
import { cloudFunctions } from "../config/firebase";
import type {
  SupplierClaimSearchResult,
  SupplierDraft,
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
}

export interface SupplierOwnershipDecisionResult {
  claimId: string;
  status: SupplierOwnershipClaimStatus;
  idempotent: boolean;
}

function requireClaimFeature() {
  if (!features.supplierProfileClaim || !cloudFunctions) {
    throw new Error("SUPPLIER_PROFILE_CLAIM_DISABLED");
  }
  return cloudFunctions;
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
) {
  if (!cloudFunctions) throw new Error("FIREBASE_FUNCTIONS_UNAVAILABLE");
  const callable = httpsCallable<
    { submissionId: string; editedSupplierData?: SupplierDraft },
    { supplierProfileId: string; idempotent: boolean }
  >(cloudFunctions, "approveSupplierSubmissionTrusted");
  const result = await callable({
    submissionId,
    ...(editedSupplierData ? { editedSupplierData } : {}),
  });
  return result.data;
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
