import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  assertCurrentDuplicateCheckActor,
  requireCurrentVerifiedAuth,
} from "./callableAuth.js";
import { db } from "./firebaseAdmin.js";
import {
  canonicalSupplierFingerprints,
  duplicateIdentityFromSupplierData,
  normalizeSupplierUrl,
} from "./supplierDataCore.js";
import { OwnershipValidationError, validateDocumentId } from "./supplierOwnershipCore.js";

const MAX_BATCH_ITEMS = 50;
const MAX_QUERY_RESULTS = 8;
const MAX_PREFIX_RESULTS = 12;
const MAX_RETURNED_MATCHES = 6;

const callableOptions = {
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "256MiB" as const,
  maxInstances: 10,
  concurrency: 20,
};

interface DuplicateIdentity {
  normalizedName: string;
  normalizedPhones: string[];
  normalizedEmail: string;
  website: string;
  facebook: string;
  governorates: string[];
  categories: string[];
}

interface DuplicateSource {
  id: string;
  data: DocumentData;
  source: "approved_supplier" | "pending_submission";
}

function throwCallableError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof OwnershipValidationError) throw new HttpsError(error.code, error.message);
  logger.error("Supplier duplicate check callable failed", {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  });
  throw new HttpsError("internal", "The Supplier duplicate check could not be completed.");
}

function diceCoefficient(first: string, second: string) {
  if (!first || !second) return 0;
  if (first === second) return 1;
  const grams = (value: string) => {
    const compact = value.replace(/\s+/g, "");
    return Array.from({ length: Math.max(0, compact.length - 1) }, (_, index) => compact.slice(index, index + 2));
  };
  const firstGrams = grams(first);
  const remaining = grams(second);
  if (!firstGrams.length || !remaining.length) return 0;
  let matches = 0;
  for (const gram of firstGrams) {
    const index = remaining.indexOf(gram);
    if (index >= 0) {
      matches += 1;
      remaining.splice(index, 1);
    }
  }
  return (2 * matches) / (firstGrams.length + grams(second).length);
}

function safePublicText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 160)
    : fallback;
}

function queryShapes(collectionName: string, identity: DuplicateIdentity) {
  const collection = db.collection(collectionName);
  const queries: Query<DocumentData>[] = [];
  if (identity.normalizedName) {
    queries.push(collection.where("normalizedName", "==", identity.normalizedName).limit(MAX_QUERY_RESULTS));
    const prefix = identity.normalizedName.slice(0, Math.min(12, Math.max(2, identity.normalizedName.indexOf(" ") + 1 || 8)));
    queries.push(collection.orderBy("normalizedName").startAt(prefix).endAt(`${prefix}\uf8ff`).limit(MAX_PREFIX_RESULTS));
  }
  if (identity.normalizedPhones.length) {
    queries.push(collection.where("normalizedPhones", "array-contains-any", identity.normalizedPhones).limit(MAX_QUERY_RESULTS));
  }
  if (identity.normalizedEmail) queries.push(collection.where("normalizedEmail", "==", identity.normalizedEmail).limit(MAX_QUERY_RESULTS));
  if (identity.website) queries.push(collection.where("website", "==", identity.website).limit(MAX_QUERY_RESULTS));
  if (identity.facebook) queries.push(collection.where("facebook", "==", identity.facebook).limit(MAX_QUERY_RESULTS));
  return queries;
}

async function boundedSources(identity: DuplicateIdentity) {
  const collections = ["supplierDuplicateIndex", "supplierSubmissionDuplicateIndex"] as const;
  const results = await Promise.all(collections.flatMap((name) => queryShapes(name, identity).map((query) => query.get())));
  const sources = new Map<string, DuplicateSource>();
  let snapshotIndex = 0;
  for (const name of collections) {
    const count = queryShapes(name, identity).length;
    for (const snapshot of results.slice(snapshotIndex, snapshotIndex + count)) {
      for (const item of snapshot.docs) {
        const key = `${name}/${item.id}`;
        sources.set(key, {
          id: item.id,
          data: item.data(),
          source: name === "supplierDuplicateIndex" ? "approved_supplier" : "pending_submission",
        });
      }
    }
    snapshotIndex += count;
  }
  return [...sources.values()];
}

function toMatch(identity: DuplicateIdentity, source: DuplicateSource) {
  const item = source.data;
  const sharedPhone = Array.isArray(item.normalizedPhones)
    && item.normalizedPhones.some((phone: unknown) => typeof phone === "string" && identity.normalizedPhones.includes(phone));
  let reason: "same_phone" | "same_email" | "same_website" | "same_facebook" | "similar_name" | null = null;
  let score = 0;
  let exact = false;
  if (sharedPhone) {
    reason = "same_phone"; score = 100; exact = true;
  } else if (identity.normalizedEmail && item.normalizedEmail === identity.normalizedEmail) {
    reason = "same_email"; score = 95; exact = true;
  } else if (identity.website && normalizeSupplierUrl(item.website) === identity.website) {
    reason = "same_website"; score = 90; exact = true;
  } else if (identity.facebook && normalizeSupplierUrl(item.facebook) === identity.facebook) {
    reason = "same_facebook"; score = 90; exact = true;
  } else {
    const nameScore = diceCoefficient(identity.normalizedName, typeof item.normalizedName === "string" ? item.normalizedName : "");
    const itemGovernorates = Array.isArray(item.governorates)
      ? item.governorates
      : typeof item.governorate === "string" ? [item.governorate] : [];
    const sameGovernorate = identity.governorates.some((value) => itemGovernorates.includes(value));
    const sharedCategory = Array.isArray(item.categories)
      && identity.categories.some((value) => item.categories.includes(value));
    if (nameScore >= 0.72 && (sameGovernorate || sharedCategory || nameScore === 1)) {
      reason = "similar_name";
      score = Math.round(nameScore * 100);
      exact = nameScore === 1 && (sameGovernorate || !identity.governorates.length);
    }
  }
  if (!reason) return null;
  return {
    supplierId: typeof item.supplierId === "string"
      ? item.supplierId
      : typeof item.submissionId === "string" ? item.submissionId : source.id,
    supplierName: safePublicText(item.supplierName, "Similar Supplier"),
    reason,
    confidence: score >= 87 ? "high" as const : "medium" as const,
    score,
    source: source.source,
    exact,
  };
}

async function checkOne(
  supplierData: unknown,
  excludeSupplierId?: unknown,
  excludeSubmissionId?: unknown,
) {
  const identity = duplicateIdentityFromSupplierData(supplierData) as DuplicateIdentity;
  const excluded = new Set([
    typeof excludeSupplierId === "string" ? validateDocumentId(excludeSupplierId, "excludeSupplierId") : "",
    typeof excludeSubmissionId === "string" ? validateDocumentId(excludeSubmissionId, "excludeSubmissionId") : "",
  ]);
  const matches = (await boundedSources(identity))
    .filter((source) => !excluded.has(source.id)
      && !excluded.has(source.data.supplierId)
      && !excluded.has(source.data.submissionId))
    .map((source) => toMatch(identity, source))
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort((first, second) => second.score - first.score)
    .slice(0, MAX_RETURNED_MATCHES);
  return {
    hasPossibleDuplicate: matches.length > 0,
    hasExactDuplicate: matches.some((match) => match.exact),
    matches: matches.map(({ exact: _exact, source: _source, ...match }) => match),
  };
}

export const checkSupplierDuplicatesTrusted = onCall(callableOptions, async (request) => {
  try {
    const auth = request.auth!;
    const authUser = await requireCurrentVerifiedAuth(auth);
    const actorSnapshot = await db.doc(`users/${auth.uid}`).get();
    assertCurrentDuplicateCheckActor(auth, authUser, actorSnapshot.data());
    const items = (request.data as { items?: unknown })?.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_BATCH_ITEMS) {
      throw new HttpsError("invalid-argument", `items must contain 1-${MAX_BATCH_ITEMS} Supplier drafts.`);
    }
    const checks = await Promise.all(items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new HttpsError("invalid-argument", "Each duplicate-check item must be an object.");
      }
      const input = item as { supplierData?: unknown; excludeSupplierId?: unknown; excludeSubmissionId?: unknown };
      return checkOne(input.supplierData, input.excludeSupplierId, input.excludeSubmissionId);
    }));
    return { checks };
  } catch (error) {
    throwCallableError(error);
  }
});

function exactQueries(identity: DuplicateIdentity) {
  const queries: Query<DocumentData>[] = [];
  for (const collectionName of ["supplierDuplicateIndex", "supplierSubmissionDuplicateIndex"]) {
    const collection = db.collection(collectionName);
    queries.push(collection.where("normalizedName", "==", identity.normalizedName).limit(MAX_QUERY_RESULTS));
    if (identity.normalizedPhones.length) {
      queries.push(collection.where("normalizedPhones", "array-contains-any", identity.normalizedPhones).limit(MAX_QUERY_RESULTS));
    }
    if (identity.normalizedEmail) queries.push(collection.where("normalizedEmail", "==", identity.normalizedEmail).limit(MAX_QUERY_RESULTS));
    if (identity.website) queries.push(collection.where("website", "==", identity.website).limit(MAX_QUERY_RESULTS));
    if (identity.facebook) queries.push(collection.where("facebook", "==", identity.facebook).limit(MAX_QUERY_RESULTS));
  }
  queries.push(db.collection("suppliers").where("normalizedName", "==", identity.normalizedName).limit(MAX_QUERY_RESULTS));
  queries.push(db.collection("supplierSubmissions").where("supplierData.normalizedName", "==", identity.normalizedName).limit(MAX_QUERY_RESULTS));
  return queries;
}

export async function readApprovalDuplicateGuard(
  transaction: Transaction,
  supplierData: DocumentData,
  submissionId: string,
) {
  const identity = duplicateIdentityFromSupplierData(supplierData) as DuplicateIdentity;
  const fingerprints = canonicalSupplierFingerprints(supplierData) as Array<{ id: string; kind: string }>;
  const fingerprintRefs = fingerprints.map((item) => db.doc(`supplierCanonicalUniqueness/${item.id}`));
  const fingerprintSnapshots = fingerprintRefs.length ? await transaction.getAll(...fingerprintRefs) : [];
  const querySnapshots = await Promise.all(exactQueries(identity).map((query) => transaction.get(query)));
  const conflicts = new Set<string>();
  fingerprintSnapshots.filter((item) => item.exists).forEach((item) => conflicts.add(item.ref.path));
  querySnapshots.forEach((snapshot) => snapshot.docs.forEach((item: QueryDocumentSnapshot) => {
    const data = item.data();
    if (item.id === submissionId || data.submissionId === submissionId) return;
    if (item.ref.parent.id === "supplierSubmissions" && data.submissionStatus !== "approved") return;
    conflicts.add(item.ref.path);
  }));
  return { fingerprints, fingerprintRefs, conflicts: [...conflicts] };
}
