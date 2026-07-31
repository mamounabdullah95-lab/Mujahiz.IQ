import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  assertAuthUserAndFirestoreAgree,
  assertCurrentAdminOrOwner,
  getCurrentVerifiedAuthUser,
  hasCurrentAccess,
  requireCurrentVerifiedAuth,
} from "./callableAuth.js";
import { FIREBASE_FUNCTIONS_REGION } from "./callableRegion.js";
import { adminAuth, db } from "./firebaseAdmin.js";
import { OwnershipValidationError, validateDocumentId } from "./supplierOwnershipCore.js";

const callableOptions = {
  region: FIREBASE_FUNCTIONS_REGION,
  timeoutSeconds: 30,
  memory: "256MiB" as const,
  maxInstances: 10,
  concurrency: 20,
};

const roles = new Set(["owner", "admin", "contributor", "viewer", "suspended"]);
const statuses = new Set(["pending_approval", "approved", "suspended"]);

function throwCallableError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof OwnershipValidationError) throw new HttpsError(error.code, error.message);
  logger.error("Trusted user administration callable failed", {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  });
  throw new HttpsError("internal", "The account update could not be completed.");
}

function assertLegalCombination(target: DocumentData, role: string, status: string) {
  if (["owner", "admin"].includes(role)) {
    if (target.accountType != null && target.accountType !== "buyer") {
      throw new HttpsError("failed-precondition", "Privileged roles are incompatible with this account type.");
    }
    if (status !== "approved") {
      throw new HttpsError("failed-precondition", "Privileged roles must remain approved and usable.");
    }
  }
  if (target.accountType === "supplier" && !["contributor", "suspended"].includes(role)) {
    throw new HttpsError("failed-precondition", "Supplier accounts require a Supplier-compatible role.");
  }
  if (role === "suspended" && status !== "suspended") {
    throw new HttpsError("failed-precondition", "The suspended role requires suspended account status.");
  }
  if (
    typeof target.supplierProfileId === "string"
    && target.supplierProfileId.trim()
    && target.accountType !== "supplier"
  ) {
    throw new HttpsError("failed-precondition", "A linked Supplier profile requires Supplier accountType.");
  }
}

function nextAccessStatus(target: DocumentData, status: string) {
  if (status === "suspended") return "suspended";
  if (target.accessStatus === "suspended") return "pending";
  return target.accessStatus;
}

function usableOwner(user: DocumentData) {
  return user.role === "owner"
    && user.status === "approved"
    && user.emailVerified === true
    && (user.accountType == null || user.accountType === "buyer")
    && hasCurrentAccess(user);
}

async function assertTargetAuthEligible(userId: string, target: DocumentData, role: string, status: string) {
  if (status !== "approved" && !["owner", "admin"].includes(role)) return;
  const authUser = await getCurrentVerifiedAuthUser(userId);
  assertAuthUserAndFirestoreAgree(userId, authUser, target);
}

export const setUserRoleAndStatusTrusted = onCall(callableOptions, async (request) => {
  try {
    const auth = request.auth!;
    const authUser = await requireCurrentVerifiedAuth(auth);
    const data = request.data as { userId?: unknown; role?: unknown; status?: unknown };
    const userId = validateDocumentId(data?.userId, "userId");
    if (typeof data?.role !== "string" || !roles.has(data.role)) {
      throw new HttpsError("invalid-argument", "The requested role is invalid.");
    }
    if (typeof data?.status !== "string" || !statuses.has(data.status)) {
      throw new HttpsError("invalid-argument", "The requested status is invalid.");
    }
    const role = data.role;
    const status = data.status;
    const actorRef = db.doc(`users/${auth.uid}`);
    const targetRef = db.doc(`users/${userId}`);
    const targetPreview = await targetRef.get();
    if (!targetPreview.exists) throw new HttpsError("not-found", "The target user profile was not found.");
    await assertTargetAuthEligible(userId, targetPreview.data() as DocumentData, role, status);

    return await db.runTransaction(async (transaction) => {
      const [actorSnapshot, targetSnapshot] = await transaction.getAll(actorRef, targetRef);
      if (!actorSnapshot.exists) throw new HttpsError("permission-denied", "The administrative account profile is missing.");
      assertCurrentAdminOrOwner(auth, authUser, actorSnapshot.data());
      if (!targetSnapshot.exists) throw new HttpsError("not-found", "The target user profile was not found.");
      const actor = actorSnapshot.data() as DocumentData;
      const target = targetSnapshot.data() as DocumentData;
      if (target.role !== targetPreview.data()?.role || target.status !== targetPreview.data()?.status) {
        throw new HttpsError("aborted", "The target account changed during authorization.");
      }
      if (
        actor.role !== "owner"
        && (
          userId === auth.uid
          || !["contributor", "viewer", "suspended"].includes(target.role)
          || !["contributor", "viewer", "suspended"].includes(role)
        )
      ) {
        throw new HttpsError("permission-denied", "Only an Owner may modify privileged accounts.");
      }
      assertLegalCombination(target, role, status);

      const accessStatus = nextAccessStatus(target, status);
      const targetAfter = { ...target, role, status, accessStatus };
      if (target.role === "owner" || role === "owner") {
        const owners = await transaction.get(db.collection("users").where("role", "==", "owner").limit(51));
        if (owners.size > 50) throw new HttpsError("resource-exhausted", "The Owner safety check exceeded its bounded limit.");
        const authOwners = await adminAuth.getUsers(owners.docs.map((item) => ({ uid: item.id })));
        const currentAuthOwnerIds = new Set(authOwners.users
          .filter((item) => item.emailVerified && !item.disabled).map((item) => item.uid));
        const usableOwnersAfter = owners.docs.filter((item) => item.id !== userId
          && currentAuthOwnerIds.has(item.id) && usableOwner(item.data())).length
          + (usableOwner(targetAfter) ? 1 : 0);
        if (usableOwnersAfter < 1) {
          throw new HttpsError("failed-precondition", "The final usable Owner account is protected.");
        }
      }

      let supplierSnapshot = null;
      if (target.accountType === "supplier" && typeof target.supplierProfileId === "string" && target.supplierProfileId.trim()) {
        supplierSnapshot = await transaction.get(db.doc(`suppliers/${validateDocumentId(target.supplierProfileId, "supplierProfileId")}`));
        if (!supplierSnapshot.exists || supplierSnapshot.data()?.accountOwnerId !== userId) {
          throw new HttpsError("failed-precondition", "The Supplier ownership link is not canonical.");
        }
      }
      const canReceiveRfqs = Boolean(
        supplierSnapshot
        && role === "contributor"
        && status === "approved"
        && ["active", "temporary"].includes(accessStatus)
        && hasCurrentAccess(targetAfter),
      );
      const idempotent = target.role === role
        && target.status === status
        && target.accessStatus === accessStatus
        && (!supplierSnapshot || supplierSnapshot.data()?.canReceiveRfqs === canReceiveRfqs);
      if (idempotent) return { userId, idempotent: true };

      transaction.update(targetRef, {
        role,
        status,
        accessStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (supplierSnapshot) {
        transaction.update(supplierSnapshot.ref, {
          canReceiveRfqs,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(db.collection("auditLogs").doc(), {
        actorId: auth.uid,
        action: "user.role_status_updated",
        targetType: "user",
        targetId: userId,
        details: { role, status, accessStatus },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { userId, idempotent: false };
    });
  } catch (error) {
    throwCallableError(error);
  }
});

export const grantTemporaryAccessTrusted = onCall(callableOptions, async (request) => {
  try {
    const auth = request.auth!;
    const authUser = await requireCurrentVerifiedAuth(auth);
    const data = request.data as { userId?: unknown; days?: unknown };
    const userId = validateDocumentId(data?.userId, "userId");
    if (!Number.isInteger(data?.days) || (data.days as number) < 1 || (data.days as number) > 90) {
      throw new HttpsError("invalid-argument", "days must be an integer from 1 to 90.");
    }
    const days = data.days as number;
    const targetAuthUser = await getCurrentVerifiedAuthUser(userId);
    const actorRef = db.doc(`users/${auth.uid}`);
    const targetRef = db.doc(`users/${userId}`);
    return await db.runTransaction(async (transaction) => {
      const [actorSnapshot, targetSnapshot] = await transaction.getAll(actorRef, targetRef);
      if (!actorSnapshot.exists || !targetSnapshot.exists) {
        throw new HttpsError("not-found", "The actor or target account profile was not found.");
      }
      assertCurrentAdminOrOwner(auth, authUser, actorSnapshot.data());
      const target = targetSnapshot.data() as DocumentData;
      assertAuthUserAndFirestoreAgree(userId, targetAuthUser, target);
      if (target.status !== "approved" || target.role === "suspended" || target.accountType === "supplier" && target.role !== "contributor") {
        throw new HttpsError("failed-precondition", "The target account is not eligible for temporary access.");
      }
      const now = Timestamp.now();
      const currentExpiry = target.accessExpiresAt instanceof Timestamp ? target.accessExpiresAt.toMillis() : 0;
      const baseMillis = Math.max(now.toMillis(), currentExpiry);
      const newExpiry = Timestamp.fromMillis(baseMillis + days * 86_400_000);
      let supplierSnapshot = null;
      if (target.accountType === "supplier" && typeof target.supplierProfileId === "string" && target.supplierProfileId.trim()) {
        supplierSnapshot = await transaction.get(db.doc(`suppliers/${validateDocumentId(target.supplierProfileId, "supplierProfileId")}`));
        if (!supplierSnapshot.exists || supplierSnapshot.data()?.accountOwnerId !== userId) {
          throw new HttpsError("failed-precondition", "The Supplier ownership link is not canonical.");
        }
      }
      transaction.update(targetRef, {
        accessStatus: "temporary",
        accessExpiresAt: newExpiry,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (supplierSnapshot) {
        transaction.update(supplierSnapshot.ref, { canReceiveRfqs: true, updatedAt: FieldValue.serverTimestamp() });
      }
      const operationId = db.collection("accessCredits").doc();
      transaction.create(operationId, {
        userId,
        source: "manual_grace",
        approvedSupplierCount: 0,
        daysGranted: days,
        status: "applied",
        createdAt: FieldValue.serverTimestamp(),
        appliedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection("auditLogs").doc(), {
        actorId: auth.uid,
        action: "access.temporary_granted",
        targetType: "user",
        targetId: userId,
        details: { days, accessCreditId: operationId.id },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { userId, accessExpiresAt: newExpiry.toDate().toISOString() };
    });
  } catch (error) {
    throwCallableError(error);
  }
});