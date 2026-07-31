import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  assertCurrentAdminOrOwner,
  assertCurrentSupplierContributorUser,
  getCurrentVerifiedAuthUser,
  requireCurrentVerifiedAuth,
  type CallableAuthContext,
} from "./callableAuth.js";
import { FIREBASE_FUNCTIONS_REGION } from "./callableRegion.js";
import { db } from "./firebaseAdmin.js";
import { validateAndNormalizeSupplierData } from "./supplierDataCore.js";
import { readApprovalDuplicateGuard } from "./supplierDuplicate.js";
import {
  OwnershipValidationError,
  sanitizeBoundedText,
  submissionSideEffectId,
  validateDocumentId,
} from "./supplierOwnershipCore.js";

const callableOptions = {
  region: FIREBASE_FUNCTIONS_REGION,
  timeoutSeconds: 30,
  memory: "256MiB" as const,
  maxInstances: 10,
  concurrency: 20,
};

const defaultSettings = {
  requiredApprovedSuppliersPerMonth: 10,
  daysGrantedPerBatch: 30,
  maximumStackableMonths: 12,
};

function throwCallableError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof OwnershipValidationError) throw new HttpsError(error.code, error.message);
  logger.error("Supplier submission approval callable failed", {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  });
  throw new HttpsError("internal", "The Supplier submission approval could not be completed.");
}

function assertAdminActor(
  auth: CallableAuthContext,
  authUser: Awaited<ReturnType<typeof requireCurrentVerifiedAuth>>,
  actor: DocumentData | undefined,
) {
  assertCurrentAdminOrOwner(auth, authUser, actor);
}

function validateSupplierData(value: unknown) {
  try {
    return validateAndNormalizeSupplierData(value) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof OwnershipValidationError) throw new HttpsError(error.code, error.message);
    throw error;
  }
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function positiveIntegerSetting(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 86_400_000);
}

function qualityRatio(approved: number, rejected: number, duplicates: number) {
  const reviewed = approved + rejected + duplicates;
  return reviewed ? Number((approved / reviewed).toFixed(2)) : 0;
}

function deriveBadges(user: DocumentData, approvedSubmissions: number, nextQualityRatio: number) {
  const badges = new Set(Array.isArray(user.badges) ? user.badges.filter((item): item is string => typeof item === "string") : []);
  const approvedReviews = numberValue(user.approvedReviews);
  const duplicateSubmissions = numberValue(user.duplicateSubmissions);
  if (approvedSubmissions >= 10) badges.add("first_10_suppliers");
  if (approvedSubmissions >= 50) badges.add("approved_50_suppliers");
  if (approvedSubmissions >= 100) badges.add("approved_100_suppliers");
  if (nextQualityRatio >= 0.85 && approvedSubmissions >= 20) badges.add("quality_contributor");
  if (approvedReviews >= 10) badges.add("review_contributor");
  if (duplicateSubmissions >= 5) badges.add("duplicate_hunter");
  if (approvedSubmissions >= 25 && nextQualityRatio >= 0.75) badges.add("trusted_contributor");
  return [...badges];
}
function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeUrl(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")
    : "";
}

export const approveSupplierSubmissionTrusted = onCall(callableOptions, async (request) => {
  try {
    const auth = request.auth!;
    const authUser = await requireCurrentVerifiedAuth(auth);
    const data = request.data as {
      submissionId?: unknown;
      editedSupplierData?: unknown;
      duplicateOverrideReason?: unknown;
    };
    const submissionId = validateDocumentId(data?.submissionId, "submissionId");
    const actorRef = db.doc(`users/${auth.uid}`);
    const submissionRef = db.doc(`supplierSubmissions/${submissionId}`);
    const supplierId = submissionSideEffectId(submissionId, "profile");
    const submissionPreview = await submissionRef.get();
    if (!submissionPreview.exists) throw new HttpsError("not-found", "The Supplier submission was not found.");
    const contributorIdPreview = validateDocumentId(submissionPreview.data()?.submittedBy, "submittedBy");
    const contributorPreview = await db.doc(`users/${contributorIdPreview}`).get();
    if (!contributorPreview.exists) throw new HttpsError("failed-precondition", "The contributor profile was not found.");
    const contributorAuthUser = contributorPreview.data()?.accountType === "supplier"
      ? await getCurrentVerifiedAuthUser(contributorIdPreview)
      : null;
    const duplicateOverrideReason = data.duplicateOverrideReason == null
      ? ""
      : sanitizeBoundedText(data.duplicateOverrideReason, "duplicateOverrideReason", 10, 500);

    return await db.runTransaction(async (transaction) => {
      const [actorInTransaction, submissionSnapshot] = await transaction.getAll(actorRef, submissionRef);
      assertAdminActor(auth, authUser, actorInTransaction.data());
      if (!submissionSnapshot.exists) throw new HttpsError("not-found", "The Supplier submission was not found.");
      const submission = submissionSnapshot.data() as DocumentData;
      const contributorId = validateDocumentId(submission.submittedBy, "submittedBy");
      if (contributorId !== contributorIdPreview) {
        throw new HttpsError("aborted", "The Supplier submission contributor changed during authorization.");
      }
      const contributorRef = db.doc(`users/${contributorId}`);
      const supplierRef = db.doc(`suppliers/${supplierId}`);
      const settingsRef = db.doc("settings/platform");
      const [contributorSnapshot, supplierSnapshot, settingsSnapshot] = await transaction.getAll(
        contributorRef,
        supplierRef,
        settingsRef,
      );

      if (submission.submissionStatus === "approved") {
        if (submission.approvedSupplierId === supplierId && supplierSnapshot.exists) {
          return { supplierProfileId: supplierId, idempotent: true };
        }
        throw new HttpsError("failed-precondition", "This legacy approved submission cannot be replayed safely.");
      }
      if (!["pending_review", "possible_duplicate"].includes(submission.submissionStatus)) {
        throw new HttpsError("failed-precondition", "The Supplier submission is not pending approval.");
      }
      if (!contributorSnapshot.exists) throw new HttpsError("failed-precondition", "The contributor profile was not found.");
      if (supplierSnapshot.exists) throw new HttpsError("already-exists", "The deterministic Supplier profile already exists.");

      const contributor = contributorSnapshot.data() as DocumentData;
      if (
        !["buyer", "supplier"].includes(contributor.accountType)
        && !(contributor.accountType == null && contributor.role === "contributor")
      ) {
        throw new HttpsError("failed-precondition", "The contributor accountType is invalid.");
      }
      const supplierData = validateSupplierData(data?.editedSupplierData ?? submission.supplierData);
      const establishOwnership = contributor.accountType === "supplier";
      if (submission.submissionStatus === "possible_duplicate" && !duplicateOverrideReason) {
        throw new HttpsError("failed-precondition", "An explicit duplicate override reason is required.");
      }
      if (establishOwnership) {
        if (!contributorAuthUser) throw new HttpsError("permission-denied", "The Supplier contributor Auth account is unavailable.");
        assertCurrentSupplierContributorUser(
          contributorId,
          contributorAuthUser,
          contributor,
        );
        const ownedProfiles = await transaction.get(
          db.collection("suppliers").where("accountOwnerId", "==", contributorId).limit(2),
        );
        if (!ownedProfiles.empty) {
          throw new HttpsError("failed-precondition", "The Supplier contributor already has a canonical ownership relationship.");
        }
      }
      const duplicateGuard = await readApprovalDuplicateGuard(transaction, supplierData, submissionId);
      if (duplicateGuard.conflicts.length) {
        throw new HttpsError("already-exists", "An approved or pending Supplier record already represents this company.");
      }
      const configuredSettings = settingsSnapshot.data() ?? {};
      const settings = {
        requiredApprovedSuppliersPerMonth: positiveIntegerSetting(
          configuredSettings.requiredApprovedSuppliersPerMonth,
          defaultSettings.requiredApprovedSuppliersPerMonth,
        ),
        daysGrantedPerBatch: positiveIntegerSetting(
          configuredSettings.daysGrantedPerBatch,
          defaultSettings.daysGrantedPerBatch,
        ),
        maximumStackableMonths: positiveIntegerSetting(
          configuredSettings.maximumStackableMonths,
          defaultSettings.maximumStackableMonths,
        ),
      };
      const approvedSubmissions = numberValue(contributor.approvedSubmissions) + 1;
      const rejectedSubmissions = numberValue(contributor.rejectedSubmissions);
      const duplicateSubmissions = numberValue(contributor.duplicateSubmissions);
      const approvedNewSupplierContributions = numberValue(contributor.approvedNewSupplierContributions) + 1;
      const consumedBefore = numberValue(contributor.consumedApprovedSupplierContributions);
      const pendingSubmissionIds = [
        ...(Array.isArray(contributor.unconsumedApprovedSubmissionIds)
          ? contributor.unconsumedApprovedSubmissionIds.filter((item): item is string => typeof item === "string")
          : []),
        submissionId,
      ];
      const available = Math.max(0, approvedNewSupplierContributions - consumedBefore);
      const monthsToGrant = Math.min(
        Math.floor(available / numberValue(settings.requiredApprovedSuppliersPerMonth)),
        numberValue(settings.maximumStackableMonths),
      );
      let daysToGrant = monthsToGrant * numberValue(settings.daysGrantedPerBatch);
      let consumedForAccess = monthsToGrant * numberValue(settings.requiredApprovedSuppliersPerMonth);
      const now = new Date();
      const existingAccessDate = toDate(contributor.accessExpiresAt);
      const baseAccessDate = existingAccessDate && existingAccessDate > now ? existingAccessDate : now;
      const maxStackDate = addDays(now, numberValue(settings.maximumStackableMonths) * numberValue(settings.daysGrantedPerBatch));
      if (daysToGrant > 0 && addDays(baseAccessDate, daysToGrant) > maxStackDate) {
        const allowedDays = Math.max(0, Math.floor((maxStackDate.getTime() - baseAccessDate.getTime()) / 86_400_000));
        const allowedMonths = Math.floor(allowedDays / numberValue(settings.daysGrantedPerBatch));
        daysToGrant = allowedMonths * numberValue(settings.daysGrantedPerBatch);
        consumedForAccess = allowedMonths * numberValue(settings.requiredApprovedSuppliersPerMonth);
      }
      const newAccessExpiresAt = daysToGrant > 0 ? addDays(baseAccessDate, daysToGrant) : contributor.accessExpiresAt || null;
      const nextQualityRatio = qualityRatio(approvedSubmissions, rejectedSubmissions, duplicateSubmissions);

      duplicateGuard.fingerprints.forEach((fingerprint, index) => {
        transaction.create(duplicateGuard.fingerprintRefs[index], {
          fingerprintHash: fingerprint.id,
          kind: fingerprint.kind,
          supplierId,
          supplierSubmissionId: submissionId,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      transaction.create(supplierRef, {
        ...supplierData,
        id: supplierId,
        status: "approved",
        verificationStatus: "community_submitted",
        sourceSummary: supplierData.sourceNote || supplierData.sourceType,
        averageRating: 0,
        reviewCount: 0,
        createdBy: contributorId,
        ...(establishOwnership ? { accountOwnerId: contributorId, canReceiveRfqs: true } : {}),
        approvedBy: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.doc(`supplierDuplicateIndex/${supplierId}`), {
        supplierId,
        supplierName: supplierData.displayName || supplierData.nameOriginal,
        normalizedName: supplierData.normalizedName,
        normalizedPhones: supplierData.normalizedPhones,
        normalizedEmail: normalizeEmail(supplierData.email),
        website: normalizeUrl(supplierData.website),
        facebook: normalizeUrl(supplierData.facebook),
        contactPerson: supplierData.contactPerson || "",
        governorate: supplierData.governorate || "",
        governorates: supplierData.governorates || (supplierData.governorate ? [supplierData.governorate] : []),
        categories: supplierData.categories,
      });
      transaction.update(submissionRef, {
        submissionStatus: "approved",
        adminDecision: "approved",
        approvedSupplierId: supplierId,
        countsForAccess: true,
        creditConsumed: consumedForAccess > 0,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid,
        adminNotes: "",
        ...(duplicateOverrideReason ? { duplicateOverrideReason } : {}),
      });
      transaction.delete(db.doc(`supplierSubmissionDuplicateIndex/${submissionId}`));
      transaction.update(contributorRef, {
        ...(establishOwnership ? { supplierProfileId: supplierId } : {}),
        approvedSubmissions,
        approvedNewSupplierContributions,
        consumedApprovedSupplierContributions: consumedBefore + consumedForAccess,
        unconsumedApprovedSubmissionIds: consumedForAccess > 0
          ? pendingSubmissionIds.slice(Math.min(consumedForAccess, pendingSubmissionIds.length))
          : pendingSubmissionIds,
        accessStatus: daysToGrant > 0 || (existingAccessDate && existingAccessDate > now) ? "active" : contributor.accessStatus,
        accessExpiresAt: newAccessExpiresAt,
        points: numberValue(contributor.points)
          + 10
          + ((supplierData.phones as unknown[]).length || supplierData.email ? 2 : 0)
          + ((supplierData.categories as unknown[]).length && (supplierData.capabilityTags as unknown[]).length ? 2 : 0),
        qualityRatio: nextQualityRatio,
        badges: deriveBadges(contributor, approvedSubmissions, nextQualityRatio),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.create(db.doc(`contributionLogs/${submissionSideEffectId(submissionId, "contribution")}`), {
        userId: contributorId,
        type: "new_supplier",
        supplierSubmissionId: submissionId,
        supplierId,
        points: 10,
        countsForAccess: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (daysToGrant > 0) {
        transaction.create(db.doc(`accessCredits/${submissionSideEffectId(submissionId, "credit")}`), {
          userId: contributorId,
          source: "supplier_contribution",
          approvedSupplierCount: consumedForAccess,
          daysGranted: daysToGrant,
          status: "applied",
          createdAt: FieldValue.serverTimestamp(),
          appliedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.doc(`accessGrants/${submissionSideEffectId(submissionId, "grant")}`), {
          userId: contributorId,
          grantType: "supplier_contribution",
          approvedSubmissionIds: pendingSubmissionIds.slice(0, Math.min(consumedForAccess, pendingSubmissionIds.length)),
          approvedSupplierCount: consumedForAccess,
          daysGranted: daysToGrant,
          grantedAt: FieldValue.serverTimestamp(),
          previousExpiry: existingAccessDate || null,
          newExpiry: newAccessExpiresAt,
          createdBy: auth.uid,
          auditReference: submissionSideEffectId(submissionId, "audit"),
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(db.doc(`notifications/${submissionSideEffectId(submissionId, "notification")}`), {
        userId: contributorId,
        type: "submission",
        titleAr: "تم اعتماد المجهز",
        titleEn: "Supplier submission approved",
        bodyAr: daysToGrant > 0
          ? "تم اعتماد السجل ومنح فترة وصول إضافية."
          : "تم اعتماد سجل المجهز وإضافته إلى الدليل.",
        bodyEn: daysToGrant > 0
          ? "The record was approved and additional access was granted."
          : "The Supplier record was approved and added to the directory.",
        link: "/my-submissions",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.doc(`auditLogs/${submissionSideEffectId(submissionId, "audit")}`), {
        actorId: auth.uid,
        action: "supplier_submission.approved",
        targetType: "supplierSubmission",
        targetId: submissionId,
        details: { supplierId, contributorId, daysGranted: daysToGrant, ...(duplicateOverrideReason ? { duplicateOverrideReason } : {}) },
        createdAt: FieldValue.serverTimestamp(),
      });
      if (establishOwnership) {
        transaction.create(db.doc(`supplierOwnershipEvents/${submissionSideEffectId(submissionId, "ownership-event")}`), {
          type: "supplier_ownership.submission_approved",
          claimId: null,
          supplierSubmissionId: submissionId,
          supplierProfileId: supplierId,
          claimantUserId: contributorId,
          previousOwnerUserId: null,
          newOwnerUserId: contributorId,
          actorUserId: auth.uid,
          adminNotes: "",
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return { supplierProfileId: supplierId, idempotent: false };
    });
  } catch (error) {
    throwCallableError(error);
  }
});
const supplierSubmissionDecisions = new Set([
  "needs_correction", "rejected", "possible_duplicate", "merged", "archived",
]);

export const decideSupplierSubmissionTrusted = onCall(callableOptions, async (request) => {
  try {
    const auth = request.auth!;
    const authUser = await requireCurrentVerifiedAuth(auth);
    const data = request.data as { submissionId?: unknown; decision?: unknown; adminNotes?: unknown };
    const submissionId = validateDocumentId(data?.submissionId, "submissionId");
    if (typeof data?.decision !== "string" || !supplierSubmissionDecisions.has(data.decision)) {
      throw new HttpsError("invalid-argument", "The Supplier submission decision is invalid.");
    }
    const decision = data.decision;
    const adminNotes = sanitizeBoundedText(data.adminNotes ?? "", "adminNotes", 0, 1000);
    const submissionRef = db.doc(`supplierSubmissions/${submissionId}`);
    const preview = await submissionRef.get();
    if (!preview.exists) throw new HttpsError("not-found", "The Supplier submission was not found.");
    const contributorId = validateDocumentId(preview.data()?.submittedBy, "submittedBy");
    const actorRef = db.doc(`users/${auth.uid}`);
    const contributorRef = db.doc(`users/${contributorId}`);

    return await db.runTransaction(async (transaction) => {
      const [actorSnapshot, submissionSnapshot, contributorSnapshot] = await transaction.getAll(
        actorRef,
        submissionRef,
        contributorRef,
      );
      if (!actorSnapshot.exists) throw new HttpsError("permission-denied", "The administrative account profile is missing.");
      assertAdminActor(auth, authUser, actorSnapshot.data());
      if (!submissionSnapshot.exists) throw new HttpsError("not-found", "The Supplier submission was not found.");
      const submission = submissionSnapshot.data() as DocumentData;
      if (submission.submittedBy !== contributorId) {
        throw new HttpsError("aborted", "The Supplier submission contributor changed during authorization.");
      }
      if (submission.submissionStatus === decision && submission.adminDecision === decision) {
        return { submissionId, status: decision, idempotent: true };
      }
      if (!["pending_review", "possible_duplicate"].includes(submission.submissionStatus)) {
        throw new HttpsError("failed-precondition", "The Supplier submission is not reviewable.");
      }
      const contributor = contributorSnapshot.data() as DocumentData | undefined;
      const alreadyCountedDuplicate = submission.submissionStatus === "possible_duplicate";
      const countsDuplicate = ["possible_duplicate", "merged"].includes(decision) && !alreadyCountedDuplicate;
      const countsRejection = decision === "rejected";
      const approvedSubmissions = numberValue(contributor?.approvedSubmissions);
      const rejectedSubmissions = numberValue(contributor?.rejectedSubmissions) + (countsRejection ? 1 : 0);
      const duplicateSubmissions = numberValue(contributor?.duplicateSubmissions) + (countsDuplicate ? 1 : 0);
      transaction.update(submissionRef, {
        submissionStatus: decision,
        adminDecision: decision,
        adminNotes,
        countsForAccess: false,
        creditConsumed: false,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid,
      });
      if (contributorSnapshot.exists) {
        transaction.update(contributorRef, {
          rejectedSubmissions,
          duplicateSubmissions,
          points: countsRejection ? Math.max(0, numberValue(contributor?.points) - 2) : numberValue(contributor?.points),
          qualityRatio: qualityRatio(approvedSubmissions, rejectedSubmissions, duplicateSubmissions),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (["rejected", "merged", "archived"].includes(decision)) {
        transaction.delete(db.doc(`supplierSubmissionDuplicateIndex/${submissionId}`));
      }
      const auditId = submissionSideEffectId(submissionId, `decision-${decision}-audit`);
      transaction.create(db.doc(`auditLogs/${auditId}`), {
        actorId: auth.uid,
        action: `supplier_submission.${decision}`,
        targetType: "supplierSubmission",
        targetId: submissionId,
        details: { adminNotes },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { submissionId, status: decision, idempotent: false };
    });
  } catch (error) {
    throwCallableError(error);
  }
});
