import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin.js";
import { OwnershipValidationError, validateDocumentId } from "./supplierOwnershipCore.js";

const callableOptions = {
  region: "us-central1",
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
  logger.error("Trusted user role/status callable failed", {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  });
  throw new HttpsError("internal", "The account update could not be completed.");
}

function assertAdminActor(actor: DocumentData | undefined, tokenVerified: boolean) {
  if (
    !tokenVerified
    || !actor
    || !["admin", "owner"].includes(actor.role)
    || actor.status === "suspended"
    || actor.accessStatus === "suspended"
  ) {
    throw new HttpsError("permission-denied", "Admin or Owner authorization is required.");
  }
}

export const setUserRoleAndStatusTrusted = onCall(callableOptions, async (request) => {
  try {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
    const auth = request.auth;
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

    return await db.runTransaction(async (transaction) => {
      const [actorSnapshot, targetSnapshot] = await transaction.getAll(actorRef, targetRef);
      assertAdminActor(actorSnapshot.data(), auth.token.email_verified === true);
      if (!targetSnapshot.exists) throw new HttpsError("not-found", "The target user profile was not found.");
      const actor = actorSnapshot.data() as DocumentData;
      const target = targetSnapshot.data() as DocumentData;
      if (
        actor.role !== "owner"
        && (
          !["contributor", "viewer", "suspended"].includes(target.role)
          || !["contributor", "viewer", "suspended"].includes(role)
        )
      ) {
        throw new HttpsError("permission-denied", "Only an Owner may modify privileged accounts.");
      }

      const removesOwnerAccess = target.role === "owner" && (role !== "owner" || status === "suspended");
      if (removesOwnerAccess) {
        const owners = await transaction.get(db.collection("users").where("role", "==", "owner").limit(2));
        if (owners.size <= 1) throw new HttpsError("failed-precondition", "The final Owner account is protected.");
      }

      let supplierSnapshot = null;
      if (target.accountType === "supplier" && typeof target.supplierProfileId === "string" && target.supplierProfileId) {
        supplierSnapshot = await transaction.get(db.doc(`suppliers/${validateDocumentId(target.supplierProfileId, "supplierProfileId")}`));
        if (!supplierSnapshot.exists || supplierSnapshot.data()?.accountOwnerId !== userId) {
          throw new HttpsError("failed-precondition", "The Supplier ownership link is not canonical.");
        }
      }

      const idempotent = target.role === role
        && target.status === status
        && (!supplierSnapshot || supplierSnapshot.data()?.canReceiveRfqs === (status === "approved"));
      if (idempotent) return { userId, idempotent: true };
      transaction.update(targetRef, {
        role,
        status,
        ...(status === "suspended" ? { accessStatus: "suspended" } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (supplierSnapshot) {
        transaction.update(supplierSnapshot.ref, {
          canReceiveRfqs: status === "approved",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(db.collection("auditLogs").doc(), {
        actorId: auth.uid,
        action: "user.role_status_updated",
        targetType: "user",
        targetId: userId,
        details: { role, status },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { userId, idempotent: false };
    });
  } catch (error) {
    throwCallableError(error);
  }
});
