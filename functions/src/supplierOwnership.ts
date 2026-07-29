import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Query,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin.js";
import {
  CLAIM_TTL_DAYS,
  MAX_CONFLICTING_CLAIMS,
  MAX_SEARCH_READS,
  MAX_SEARCH_RESULTS,
  OwnershipValidationError,
  normalizeSupplierSearchQuery,
  ownershipAuditId,
  ownershipEventId,
  ownershipNotificationId,
  resolveDecisionTransition,
  sanitizeBoundedText,
  validateClaimInput,
  validateDocumentId,
  validateSearchMode,
} from "./supplierOwnershipCore.js";

const callableOptions = {
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB" as const,
  maxInstances: 10,
  concurrency: 20,
};

interface UserData extends DocumentData {
  uid?: string;
  role?: string;
  accountType?: string;
  status?: string;
  accessStatus?: string;
  emailVerified?: boolean;
  supplierProfileId?: string;
  fullName?: string;
  organization?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
}

interface ClaimData extends DocumentData {
  claimantUserId: string;
  supplierProfileId: string;
  status: string;
  expiresAt: Timestamp;
}

interface LockData extends DocumentData {
  claimantUserId: string;
  claimId: string;
  supplierProfileId: string;
  expiresAt: Timestamp;
}

function throwCallableError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof OwnershipValidationError) {
    throw new HttpsError(error.code, error.message);
  }
  logger.error("Supplier ownership callable failed", {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  });
  throw new HttpsError("internal", "The ownership request could not be completed.");
}

function requireAuth(request: CallableRequest<unknown>) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return request.auth;
}

function requireClaimFeature() {
  if (process.env.CLAIM_SUPPLIER_PROFILE_ENABLED !== "true") {
    throw new HttpsError("failed-precondition", "Supplier profile claims are disabled.");
  }
}

function assertClaimantAccount(user: UserData, tokenVerified: boolean) {
  if (
    !tokenVerified
    || user.emailVerified !== true
    || user.role !== "contributor"
    || user.accountType !== "supplier"
    || user.status !== "approved"
    || !["active", "temporary"].includes(user.accessStatus || "")
  ) {
    throw new HttpsError("permission-denied", "An active verified Supplier account is required.");
  }
  if (typeof user.supplierProfileId === "string" && user.supplierProfileId.trim()) {
    throw new HttpsError("failed-precondition", "The Supplier account is already linked.");
  }
}

function assertAdminActor(user: UserData, tokenVerified: boolean) {
  if (
    !tokenVerified
    || !["admin", "owner"].includes(user.role || "")
    || user.status === "suspended"
    || user.accessStatus === "suspended"
  ) {
    throw new HttpsError("permission-denied", "Admin or Owner authorization is required.");
  }
}

function assertEligibleSupplierProfile(profile: DocumentData | undefined) {
  if (!profile || profile.status !== "approved" || profile.verificationStatus === "watchlist") {
    throw new HttpsError("failed-precondition", "The Supplier profile is not eligible for ownership.");
  }
  if (typeof profile.accountOwnerId === "string" && profile.accountOwnerId.trim()) {
    throw new HttpsError("already-exists", "The Supplier profile is already owned.");
  }
}

function timestampIsFuture(value: unknown, now: Timestamp) {
  return value instanceof Timestamp && value.toMillis() > now.toMillis();
}

function safeSnapshotText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return sanitizeBoundedText(value, "snapshotField", 0, maximumLength);
}

function safeWebsiteDomain(value: unknown) {
  if (typeof value !== "string" || value.length > 300) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return undefined;
    return url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function ownershipEvent(
  type: "approved" | "rejected" | "withdrawn" | "expired" | "superseded",
  claimId: string,
  claim: ClaimData,
  actorUserId: string,
  adminNotes: string,
  newOwnerUserId: string | null,
) {
  return {
    type: `supplier_ownership.${type}`,
    claimId,
    supplierProfileId: claim.supplierProfileId,
    claimantUserId: claim.claimantUserId,
    previousOwnerUserId: null,
    newOwnerUserId,
    actorUserId,
    adminNotes,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function lockMatchesClaim(lock: DocumentData | undefined, claimId: string, claim: ClaimData) {
  return lock?.claimId === claimId
    && lock.claimantUserId === claim.claimantUserId
    && lock.supplierProfileId === claim.supplierProfileId;
}

function assertPendingClaimConsistency(
  claimId: string,
  claim: ClaimData,
  lockSnapshot: DocumentSnapshot,
  claimantSnapshot: DocumentSnapshot,
  supplierSnapshot: DocumentSnapshot,
  now: Timestamp,
) {
  const lock = lockSnapshot.data() as LockData | undefined;
  if (!lockSnapshot.exists || !lockMatchesClaim(lock, claimId, claim) || !timestampIsFuture(lock?.expiresAt, now)) {
    throw new HttpsError("failed-precondition", "The claimant lock is missing, stale, or inconsistent.");
  }
  if (!claimantSnapshot.exists) throw new HttpsError("failed-precondition", "The claimant account no longer exists.");
  const claimant = claimantSnapshot.data() as UserData;
  assertClaimantAccount(claimant, true);
  if (claim.claimantUserId !== claimantSnapshot.id || claim.supplierProfileId !== supplierSnapshot.id) {
    throw new HttpsError("failed-precondition", "The claim target is inconsistent.");
  }
  if (!supplierSnapshot.exists) throw new HttpsError("not-found", "The Supplier profile no longer exists.");
  assertEligibleSupplierProfile(supplierSnapshot.data());
}

export const searchSupplierProfilesForClaim = onCall(callableOptions, async (request) => {
  try {
    requireClaimFeature();
    const auth = requireAuth(request);
    const data = request.data as { query?: unknown; mode?: unknown };
    const normalizedQuery = normalizeSupplierSearchQuery(data?.query);
    const mode = validateSearchMode(data?.mode ?? "prefix");
    const userSnapshot = await db.doc(`users/${auth.uid}`).get();
    if (!userSnapshot.exists) throw new HttpsError("failed-precondition", "The Supplier account profile is missing.");
    assertClaimantAccount(userSnapshot.data() as UserData, auth.token.email_verified === true);

    let supplierQuery: Query<DocumentData> = db.collection("suppliers");
    supplierQuery = mode === "exact"
      ? supplierQuery.where("normalizedName", "==", normalizedQuery)
      : supplierQuery.orderBy("normalizedName").startAt(normalizedQuery).endAt(`${normalizedQuery}\uf8ff`);
    const snapshot = await supplierQuery
      .limit(MAX_SEARCH_READS)
      .select(
        "nameAr",
        "nameEn",
        "nameOriginal",
        "displayName",
        "governorate",
        "city",
        "categories",
        "website",
        "status",
        "verificationStatus",
        "accountOwnerId",
      )
      .get();

    const items = snapshot.docs
      .filter((item) => {
        const supplier = item.data();
        return supplier.status === "approved"
          && supplier.verificationStatus !== "watchlist"
          && !(typeof supplier.accountOwnerId === "string" && supplier.accountOwnerId.trim());
      })
      .slice(0, MAX_SEARCH_RESULTS)
      .map((item) => {
        const supplier = item.data();
        const website = safeWebsiteDomain(supplier.website);
        return {
          supplierProfileId: item.id,
          nameAr: safeSnapshotText(supplier.nameAr || supplier.nameOriginal || supplier.displayName, 160),
          nameEn: safeSnapshotText(supplier.nameEn || supplier.displayName || supplier.nameOriginal, 160),
          governorate: safeSnapshotText(supplier.governorate, 80),
          city: safeSnapshotText(supplier.city, 80),
          categories: Array.isArray(supplier.categories)
            ? supplier.categories
              .filter((value): value is string => typeof value === "string")
              .slice(0, 3)
              .map((value) => safeSnapshotText(value, 80))
              .filter(Boolean)
            : [],
          ...(website ? { website } : {}),
        };
      });
    return { items };
  } catch (error) {
    throwCallableError(error);
  }
});

export const createSupplierOwnershipClaim = onCall(callableOptions, async (request) => {
  try {
    requireClaimFeature();
    const auth = requireAuth(request);
    const input = validateClaimInput(request.data);
    const claimRef = db.collection("supplierOwnershipClaims").doc();
    const userRef = db.doc(`users/${auth.uid}`);
    const supplierRef = db.doc(`suppliers/${input.supplierProfileId}`);
    const lockRef = db.doc(`supplierClaimantLocks/${auth.uid}`);
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + CLAIM_TTL_DAYS * 86_400_000);

    await db.runTransaction(async (transaction) => {
      const [userSnapshot, supplierSnapshot, lockSnapshot] = await transaction.getAll(userRef, supplierRef, lockRef);
      if (!userSnapshot.exists) throw new HttpsError("failed-precondition", "The Supplier account profile is missing.");
      const user = userSnapshot.data() as UserData;
      assertClaimantAccount(user, auth.token.email_verified === true);
      if (!supplierSnapshot.exists) throw new HttpsError("not-found", "The Supplier profile was not found.");
      assertEligibleSupplierProfile(supplierSnapshot.data());

      let staleClaimSnapshot: DocumentSnapshot | null = null;
      const existingLock = lockSnapshot.data() as LockData | undefined;
      if (lockSnapshot.exists) {
        if (!existingLock?.expiresAt || timestampIsFuture(existingLock.expiresAt, now)) {
          throw new HttpsError("already-exists", "The Supplier account already has an active ownership claim.");
        }
        if (typeof existingLock.claimId === "string" && !existingLock.claimId.includes("/")) {
          staleClaimSnapshot = await transaction.get(db.doc(`supplierOwnershipClaims/${existingLock.claimId}`));
        }
      }

      if (staleClaimSnapshot?.exists && staleClaimSnapshot.data()?.status === "pending_review") {
        const staleClaim = staleClaimSnapshot.data() as ClaimData;
        const eventId = ownershipEventId(staleClaimSnapshot.id, "expired");
        transaction.update(staleClaimSnapshot.ref, {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp(),
          decisionEventId: eventId,
        });
        transaction.set(
          db.doc(`supplierOwnershipEvents/${eventId}`),
          ownershipEvent("expired", staleClaimSnapshot.id, staleClaim, auth.uid, "", null),
        );
      }
      if (lockSnapshot.exists) transaction.delete(lockRef);

      transaction.create(claimRef, {
        claimantUserId: auth.uid,
        supplierProfileId: input.supplierProfileId,
        status: "pending_review",
        claimantSnapshot: {
          fullName: safeSnapshotText(user.fullName, 160),
          organization: safeSnapshotText(user.organization, 200),
          jobTitle: safeSnapshotText(user.jobTitle, 120),
          email: safeSnapshotText(user.email || auth.token.email, 320),
          phone: safeSnapshotText(user.phone, 80),
        },
        claimReason: input.claimReason,
        evidenceType: input.evidenceType,
        evidenceSummary: input.evidenceSummary,
        referenceLinks: input.referenceLinks,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt,
      });
      transaction.create(lockRef, {
        claimantUserId: auth.uid,
        claimId: claimRef.id,
        supplierProfileId: input.supplierProfileId,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
      });
    });

    return { claimId: claimRef.id, status: "pending_review" as const, expiresAt: expiresAt.toDate().toISOString() };
  } catch (error) {
    throwCallableError(error);
  }
});

export const withdrawSupplierOwnershipClaim = onCall(callableOptions, async (request) => {
  try {
    requireClaimFeature();
    const auth = requireAuth(request);
    const claimId = validateDocumentId((request.data as { claimId?: unknown })?.claimId, "claimId");
    const now = Timestamp.now();
    const result = await db.runTransaction(async (transaction) => {
      const claimRef = db.doc(`supplierOwnershipClaims/${claimId}`);
      const claimSnapshot = await transaction.get(claimRef);
      if (!claimSnapshot.exists) throw new HttpsError("not-found", "The ownership claim was not found.");
      const claim = claimSnapshot.data() as ClaimData;
      if (claim.claimantUserId !== auth.uid) throw new HttpsError("permission-denied", "Only the claimant may withdraw this claim.");
      if (claim.status === "withdrawn") return { claimId, status: "withdrawn" as const, idempotent: true };
      if (claim.status !== "pending_review") {
        throw new HttpsError("failed-precondition", `A ${claim.status} claim cannot be withdrawn.`);
      }
      const lockRef = db.doc(`supplierClaimantLocks/${auth.uid}`);
      const lockSnapshot = await transaction.get(lockRef);
      const status = timestampIsFuture(claim.expiresAt, now) ? "withdrawn" : "expired";
      const eventId = ownershipEventId(claimId, status);
      transaction.update(claimRef, {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        decisionEventId: eventId,
        ...(status === "withdrawn"
          ? { withdrawnAt: FieldValue.serverTimestamp(), withdrawnBy: auth.uid }
          : {}),
      });
      if (lockSnapshot.exists && lockMatchesClaim(lockSnapshot.data(), claimId, claim)) transaction.delete(lockRef);
      transaction.set(
        db.doc(`supplierOwnershipEvents/${eventId}`),
        ownershipEvent(status, claimId, claim, auth.uid, "", null),
      );
      return { claimId, status, idempotent: false };
    });
    if (result.status === "expired") {
      throw new HttpsError("failed-precondition", "The ownership claim has expired.");
    }
    return result;
  } catch (error) {
    throwCallableError(error);
  }
});

export const decideSupplierOwnershipClaim = onCall(callableOptions, async (request) => {
  try {
    requireClaimFeature();
    const auth = requireAuth(request);
    const input = request.data as { claimId?: unknown; decision?: unknown; adminNotes?: unknown };
    const claimId = validateDocumentId(input?.claimId, "claimId");
    const decision = input?.decision;
    const adminNotes = sanitizeBoundedText(input?.adminNotes ?? "", "adminNotes", 0, 1000);
    const now = Timestamp.now();

    const result = await db.runTransaction(async (transaction) => {
      const actorRef = db.doc(`users/${auth.uid}`);
      const claimRef = db.doc(`supplierOwnershipClaims/${claimId}`);
      const [actorSnapshot, claimSnapshot] = await transaction.getAll(actorRef, claimRef);
      if (!actorSnapshot.exists) throw new HttpsError("permission-denied", "The administrative account profile is missing.");
      assertAdminActor(actorSnapshot.data() as UserData, auth.token.email_verified === true);
      if (!claimSnapshot.exists) throw new HttpsError("not-found", "The ownership claim was not found.");
      const claim = claimSnapshot.data() as ClaimData;
      const transition = resolveDecisionTransition(claim.status, decision);
      if (transition.idempotent) return { claimId, status: transition.targetStatus, idempotent: true };

      const lockRef = db.doc(`supplierClaimantLocks/${claim.claimantUserId}`);
      if (!timestampIsFuture(claim.expiresAt, now)) {
        const lockSnapshot = await transaction.get(lockRef);
        const eventId = ownershipEventId(claimId, "expired");
        transaction.update(claimRef, {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp(),
          decisionEventId: eventId,
        });
        if (lockSnapshot.exists && lockMatchesClaim(lockSnapshot.data(), claimId, claim)) transaction.delete(lockRef);
        transaction.set(
          db.doc(`supplierOwnershipEvents/${eventId}`),
          ownershipEvent("expired", claimId, claim, auth.uid, adminNotes, null),
        );
        return { claimId, status: "expired" as const, idempotent: false };
      }

      const claimantRef = db.doc(`users/${claim.claimantUserId}`);
      const supplierRef = db.doc(`suppliers/${claim.supplierProfileId}`);
      const [lockSnapshot, claimantSnapshot, supplierSnapshot] = await transaction.getAll(
        lockRef,
        claimantRef,
        supplierRef,
      );
      assertPendingClaimConsistency(claimId, claim, lockSnapshot, claimantSnapshot, supplierSnapshot, now);

      const eventId = ownershipEventId(claimId, transition.targetStatus);
      const commonClaimUpdate = {
        status: transition.targetStatus,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid,
        adminNotes,
        updatedAt: FieldValue.serverTimestamp(),
        decisionEventId: eventId,
      };

      if (transition.targetStatus === "rejected") {
        transaction.update(claimRef, commonClaimUpdate);
        transaction.delete(lockRef);
        transaction.create(
          db.doc(`supplierOwnershipEvents/${eventId}`),
          ownershipEvent("rejected", claimId, claim, auth.uid, adminNotes, null),
        );
      } else {
        const conflictingQuery = db.collection("supplierOwnershipClaims")
          .where("supplierProfileId", "==", claim.supplierProfileId)
          .where("status", "==", "pending_review")
          .orderBy("createdAt", "desc")
          .limit(MAX_CONFLICTING_CLAIMS + 1);
        const conflicts = await transaction.get(conflictingQuery);
        if (conflicts.size > MAX_CONFLICTING_CLAIMS) {
          throw new HttpsError("resource-exhausted", "Too many conflicting claims; no decision was written.");
        }
        const otherClaims = conflicts.docs.filter((item) => item.id !== claimId);
        const otherLockRefs = otherClaims.map((item) => db.doc(`supplierClaimantLocks/${item.data().claimantUserId}`));
        const otherLocks = otherLockRefs.length ? await transaction.getAll(...otherLockRefs) : [];

        transaction.update(claimRef, commonClaimUpdate);
        transaction.delete(lockRef);
        transaction.update(claimantRef, {
          supplierProfileId: claim.supplierProfileId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(supplierRef, {
          accountOwnerId: claim.claimantUserId,
          canReceiveRfqs: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(
          db.doc(`supplierOwnershipEvents/${eventId}`),
          ownershipEvent("approved", claimId, claim, auth.uid, adminNotes, claim.claimantUserId),
        );

        otherClaims.forEach((otherClaimSnapshot, index) => {
          const otherClaim = otherClaimSnapshot.data() as ClaimData;
          const otherEventId = ownershipEventId(otherClaimSnapshot.id, "superseded");
          transaction.update(otherClaimSnapshot.ref, {
            status: "superseded",
            reviewedAt: FieldValue.serverTimestamp(),
            reviewedBy: auth.uid,
            adminNotes: "Superseded by an approved ownership claim.",
            supersededByClaimId: claimId,
            updatedAt: FieldValue.serverTimestamp(),
            decisionEventId: otherEventId,
          });
          const otherLock = otherLocks[index];
          if (otherLock?.exists && lockMatchesClaim(otherLock.data(), otherClaimSnapshot.id, otherClaim)) {
            transaction.delete(otherLock.ref);
          }
          transaction.create(
            db.doc(`supplierOwnershipEvents/${otherEventId}`),
            ownershipEvent(
              "superseded",
              otherClaimSnapshot.id,
              otherClaim,
              auth.uid,
              "Superseded by an approved ownership claim.",
              null,
            ),
          );
        });
      }

      const auditId = ownershipAuditId(claimId, transition.targetStatus);
      transaction.create(db.doc(`auditLogs/${auditId}`), {
        actorId: auth.uid,
        action: `supplier_ownership.${transition.targetStatus}`,
        targetType: "supplierOwnershipClaim",
        targetId: claimId,
        details: {
          supplierProfileId: claim.supplierProfileId,
          claimantUserId: claim.claimantUserId,
          eventId,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      const notificationId = ownershipNotificationId(claimId, transition.targetStatus);
      const approved = transition.targetStatus === "approved";
      transaction.create(db.doc(`notifications/${notificationId}`), {
        userId: claim.claimantUserId,
        actorId: auth.uid,
        type: "supplier_ownership",
        referenceType: "supplierOwnershipClaim",
        referenceId: claimId,
        eventId,
        titleAr: approved ? "تمت الموافقة على مطالبة ملف المجهز" : "تم رفض مطالبة ملف المجهز",
        titleEn: approved ? "Supplier profile claim approved" : "Supplier profile claim rejected",
        bodyAr: approved
          ? "تم ربط حسابك بملف المجهز المعتمد."
          : "تمت مراجعة مطالبتك ولم تتم الموافقة عليها.",
        bodyEn: approved
          ? "Your account is now linked to the approved Supplier profile."
          : "Your Supplier profile claim was reviewed and was not approved.",
        link: "/supplier/dashboard",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { claimId, status: transition.targetStatus, idempotent: false };
    });

    if (result.status === "expired") {
      throw new HttpsError("failed-precondition", "The ownership claim has expired.");
    }
    return result;
  } catch (error) {
    throwCallableError(error);
  }
});