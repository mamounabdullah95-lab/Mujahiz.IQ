import type { UserRecord } from "firebase-admin/auth";
import type { DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { adminAuth } from "./firebaseAdmin.js";

export interface CallableAuthContext {
  uid: string;
  token: {
    email?: unknown;
    email_verified?: unknown;
    [key: string]: unknown;
  };
}

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function getCurrentVerifiedAuthUser(uid: string) {
  let user: UserRecord;
  try {
    user = await adminAuth.getUser(uid);
  } catch {
    throw new HttpsError("unauthenticated", "The authenticated account no longer exists.");
  }
  if (user.disabled || !user.emailVerified) {
    throw new HttpsError("permission-denied", "A current verified Firebase Auth account is required.");
  }
  return user;
}

export async function requireCurrentVerifiedAuth(auth: CallableAuthContext | undefined) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  const user = await getCurrentVerifiedAuthUser(auth.uid);
  if (
    auth.token.email_verified !== true
    || normalizedEmail(auth.token.email) !== normalizedEmail(user.email)
  ) {
    throw new HttpsError("permission-denied", "The Firebase Auth token is stale or inconsistent.");
  }
  return user;
}

export function assertAuthUserAndFirestoreAgree(
  uid: string,
  authUser: UserRecord,
  firestoreUser: DocumentData | undefined,
): asserts firestoreUser is DocumentData {
  if (
    !firestoreUser
    || (typeof firestoreUser.uid === "string" && firestoreUser.uid !== uid)
    || firestoreUser.emailVerified !== true
    || normalizedEmail(firestoreUser.email) !== normalizedEmail(authUser.email)
  ) {
    throw new HttpsError("permission-denied", "Firebase Auth and the account profile are inconsistent.");
  }
}

export function assertAuthAndFirestoreAgree(
  auth: CallableAuthContext,
  authUser: UserRecord,
  firestoreUser: DocumentData | undefined,
) {
  assertAuthUserAndFirestoreAgree(auth.uid, authUser, firestoreUser);
  for (const field of ["role", "accountType", "status", "accessStatus"]) {
    if (auth.token[field] !== undefined && auth.token[field] !== firestoreUser[field]) {
      throw new HttpsError("permission-denied", "Firebase Auth claims and the account profile are inconsistent.");
    }
  }
}

export function timestampMillis(value: unknown) {
  if (
    value
    && typeof value === "object"
    && "toMillis" in value
    && typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return Number.NaN;
}

export function hasCurrentAccess(user: DocumentData, nowMillis = Date.now()) {
  if (user.accessStatus === "active") {
    const expiry = timestampMillis(user.accessExpiresAt);
    return !Number.isFinite(expiry) || expiry > nowMillis;
  }
  return user.accessStatus === "temporary" && timestampMillis(user.accessExpiresAt) > nowMillis;
}

export function assertCurrentAdminOrOwner(
  auth: CallableAuthContext,
  authUser: UserRecord,
  user: DocumentData | undefined,
) {
  assertAuthAndFirestoreAgree(auth, authUser, user);
  if (
    !user
    || !["admin", "owner"].includes(user.role)
    || (user.accountType != null && user.accountType !== "buyer")
    || user.status !== "approved"
    || !hasCurrentAccess(user)
  ) {
    throw new HttpsError("permission-denied", "A current approved Admin or Owner account is required.");
  }
}

function assertSupplierContributorEligibility(
  user: DocumentData | undefined,
  options: { requireUnlinked?: boolean } = {},
) {
  if (
    !user
    || user.accountType !== "supplier"
    || user.role !== "contributor"
    || user.status !== "approved"
    || !hasCurrentAccess(user)
  ) {
    throw new HttpsError("permission-denied", "A current eligible Supplier contributor is required.");
  }
  if (options.requireUnlinked !== false && typeof user.supplierProfileId === "string" && user.supplierProfileId.trim()) {
    throw new HttpsError("failed-precondition", "The Supplier account is already linked.");
  }
}

export function assertCurrentSupplierContributor(
  auth: CallableAuthContext,
  authUser: UserRecord,
  user: DocumentData | undefined,
  options: { requireUnlinked?: boolean } = {},
) {
  assertAuthAndFirestoreAgree(auth, authUser, user);
  assertSupplierContributorEligibility(user, options);
}

export function assertCurrentSupplierContributorUser(
  uid: string,
  authUser: UserRecord,
  user: DocumentData | undefined,
  options: { requireUnlinked?: boolean } = {},
) {
  assertAuthUserAndFirestoreAgree(uid, authUser, user);
  assertSupplierContributorEligibility(user, options);
}

export function assertCurrentDuplicateCheckActor(
  auth: CallableAuthContext,
  authUser: UserRecord,
  user: DocumentData | undefined,
) {
  assertAuthAndFirestoreAgree(auth, authUser, user);
  if (!user || user.status !== "approved" || user.accessStatus === "suspended") {
    throw new HttpsError("permission-denied", "The account is not eligible to check Supplier duplicates.");
  }
  const admin = ["admin", "owner"].includes(user.role)
    && (user.accountType == null || user.accountType === "buyer")
    && hasCurrentAccess(user);
  const contributor = user.role === "contributor"
    && ["buyer", "supplier"].includes(user.accountType)
    && ["pending", "active", "temporary"].includes(user.accessStatus);
  if (!admin && !contributor) {
    throw new HttpsError("permission-denied", "The account is not eligible to check Supplier duplicates.");
  }
}
