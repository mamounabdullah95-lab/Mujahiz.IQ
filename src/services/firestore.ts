import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import * as demo from "./localDemo";
import {
  approveSupplierSubmissionTrusted,
  decideSupplierSubmissionTrusted,
  grantTemporaryAccessTrusted,
  setUserRoleAndStatusTrusted,
} from "./supplierOwnership";
import {
  badgeDefinitions,
  capabilityTags,
  confidenceLevels,
  defaultSettings,
  governorates,
  interactionTypes,
  sourceTypes,
  supplierCategories,
} from "../data/constants";
import { mergeMaterialTerms } from "../data/materialTerms";
import type {
  AccessCredit,
  AppUser,
  AuditLog,
  DuplicateCheck,
  MaterialTerm,
  PlatformSettings,
  Supplier,
  SupplierDraft,
  SupplierDuplicateIndex,
  SupplierFeedback,
  SupplierFeedbackStatus,
  SupplierFeedbackType,
  SupplierReview,
  SupplierSubmission,
  SupplierSubmissionStatus,
  TermSuggestion,
  TermSuggestionSource,
  TimestampLike,
} from "../types/domain";
import { addDays, maxDate, toDate } from "../utils/date";
import { qualityRatio } from "../utils/scoring";
import { ReadThroughCache, type CacheReadOptions } from "../utils/readThroughCache";
import { normalizeEmail, normalizeUrl } from "../utils/normalization";
import { normalizeDictionaryText } from "../utils/materialDictionary";

const usersRef = collection(db, "users");
const suppliersRef = collection(db, "suppliers");
const submissionsRef = collection(db, "supplierSubmissions");
const reviewsRef = collection(db, "reviews");
const duplicateIndexRef = collection(db, "supplierDuplicateIndex");
const settingsRef = collection(db, "settings");
const categoriesRef = collection(db, "categories");
const accessCreditsRef = collection(db, "accessCredits");
const accessGrantsRef = collection(db, "accessGrants");
const notificationsRef = collection(db, "notifications");
const contributionLogsRef = collection(db, "contributionLogs");
const auditLogsRef = collection(db, "auditLogs");
const supplierFeedbackRef = collection(db, "supplierFeedback");
const materialTermsRef = collection(db, "materialTerms");
const termSuggestionsRef = collection(db, "termSuggestions");

function withId<T>(snapshot: { id: string; data: () => DocumentData }) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T;
}

function createdAtMillis(value: TimestampLike) {
  return toDate(value)?.getTime() ?? 0;
}

function sortByCreatedAtDesc<T extends { createdAt: TimestampLike }>(items: T[], maxItems: number) {
  return [...items].sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt)).slice(0, maxItems);
}

function withoutUndefinedFields<T extends object>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
}

export async function createUserProfile(
  uid: string,
  email: string,
  profile: Pick<AppUser, "fullName" | "phone" | "jobTitle" | "organization" | "governorate" | "sector"> &
    Partial<Pick<AppUser, "city" | "reasonForJoining" | "accountType" | "language">>,
) {
  const now = serverTimestamp();
  const trialExpiresAt = addDays(new Date(), defaultSettings.trialAccessDays);
  const user: Omit<AppUser, "createdAt" | "updatedAt" | "accessExpiresAt"> = {
    uid,
    email,
    fullName: profile.fullName,
    phone: profile.phone,
    jobTitle: profile.jobTitle,
    organization: profile.organization,
    governorate: profile.governorate,
    city: profile.city || "",
    sector: profile.sector,
    reasonForJoining: profile.reasonForJoining || "",
    accountType: profile.accountType || "buyer",
    role: "contributor",
    status: "approved",
    accessStatus: "temporary",
    trustScore: 0,
    points: 5,
    qualityRatio: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    duplicateSubmissions: 0,
    approvedReviews: 0,
    approvedNewSupplierContributions: 0,
    consumedApprovedSupplierContributions: 0,
    badges: [],
    language: profile.language || "en",
  };

  const batch = writeBatch(db);
  batch.set(doc(usersRef, uid), {
    ...user,
    accessExpiresAt: trialExpiresAt,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(doc(accessCreditsRef), {
    userId: uid,
    source: "trial_access",
    approvedSupplierCount: 0,
    daysGranted: defaultSettings.trialAccessDays,
    status: "applied",
    createdAt: now,
    appliedAt: now,
  } satisfies Omit<AccessCredit, "id">);
  batch.set(doc(auditLogsRef), {
    actorId: uid,
    action: "user.trial_access_started",
    targetType: "user",
    targetId: uid,
    details: { days: defaultSettings.trialAccessDays },
    createdAt: now,
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
}

export async function getUserProfile(uid: string) {
  if (!isFirebaseConfigured) {
    return demo.demoGetUserProfile(uid);
  }
  const snapshot = await getDoc(doc(usersRef, uid));
  return snapshot.exists() ? withId<AppUser>(snapshot) : null;
}

export async function updateUserProfile(uid: string, patch: Partial<AppUser>) {
  if (!isFirebaseConfigured) {
    return demo.demoUpdateUserProfile(uid, patch);
  }
  await updateDoc(doc(usersRef, uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function listUsers(status?: AppUser["status"]) {
  if (!isFirebaseConfigured) {
    return demo.demoListUsers(status);
  }
  const snapshot = await getDocs(status
    ? query(usersRef, where("status", "==", status), orderBy("createdAt", "desc"), limit(100))
    : query(usersRef, orderBy("createdAt", "desc"), limit(100)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<AppUser>(item)),
    100,
  );
}

export async function approveUser(userId: string, actorId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoApproveUser(userId, actorId);
  }
  const targetSnapshot = await getDoc(doc(usersRef, userId));
  if (!targetSnapshot.exists()) throw new Error("User profile was not found.");
  const target = targetSnapshot.data() as AppUser;
  await setUserRoleAndStatusTrusted(userId, target.role, "approved");
  window.dispatchEvent(new CustomEvent("mujahiz-iq-taxonomy-updated"));
}
export async function setUserRoleAndStatus(
  userId: string,
  actorId: string,
  role: AppUser["role"],
  status: AppUser["status"],
) {
  if (!isFirebaseConfigured) {
    return demo.demoSetUserRoleAndStatus(userId, actorId, role, status);
  }
  return setUserRoleAndStatusTrusted(userId, role, status);
}

export async function grantTemporaryAccess(userId: string, actorId: string, days: number) {
  if (!isFirebaseConfigured) {
    return demo.demoGrantTemporaryAccess(userId, actorId, days);
  }
  return grantTemporaryAccessTrusted(userId, days);
}
export async function getPlatformSettings() {
  if (!isFirebaseConfigured) {
    return demo.demoGetPlatformSettings();
  }
  const snapshot = await getDoc(doc(settingsRef, "platform"));
  if (!snapshot.exists()) {
    return defaultSettings;
  }
  return {
    ...defaultSettings,
    ...snapshot.data(),
  } as PlatformSettings;
}

export async function savePlatformSettings(settings: PlatformSettings, actorId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoSavePlatformSettings(settings, actorId);
  }
  const batch = writeBatch(db);
  batch.set(
    doc(settingsRef, "platform"),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(doc(auditLogsRef), {
    actorId,
    action: "settings.updated",
    targetType: "settings",
    targetId: "platform",
    details: { settings },
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
}

export async function seedDefaultLists(actorId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoSeedDefaultLists(actorId);
  }
  const batch = writeBatch(db);
  const groups = [
    ["governorates", governorates],
    ["supplierCategories", supplierCategories],
    ["capabilityTags", capabilityTags],
    ["sourceTypes", sourceTypes],
    ["confidenceLevels", confidenceLevels],
    ["interactionTypes", interactionTypes],
    ["badges", badgeDefinitions],
  ] as const;

  groups.forEach(([group, items]) => {
    items.forEach((item) => {
      batch.set(doc(categoriesRef, `${group}_${item.value}`), {
        group,
        ...item,
        active: true,
        updatedAt: serverTimestamp(),
      });
    });
  });
  batch.set(doc(settingsRef, "platform"), { ...defaultSettings, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(auditLogsRef), {
    actorId,
    action: "seed.defaults",
    targetType: "settings",
    targetId: "platform",
    details: { groups: groups.map(([group]) => group) },
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
}


export async function submitSupplierDraft(userId: string, draft: SupplierDraft, duplicateCheck: DuplicateCheck) {
  if (!isFirebaseConfigured) {
    return demo.demoSubmitSupplierDraft(userId, draft, duplicateCheck);
  }
  const submissionDoc = doc(submissionsRef);
  const pendingIndexDoc = doc(db, "supplierSubmissionDuplicateIndex", submissionDoc.id);
  const batch = writeBatch(db);
  batch.set(submissionDoc, {
    submittedBy: userId,
    submissionStatus: duplicateCheck.hasPossibleDuplicate ? "possible_duplicate" : "pending_review",
    supplierData: withoutUndefinedFields(draft),
    duplicateCheck: {
      ...duplicateCheck,
      checkedAt: serverTimestamp(),
    },
    countsForAccess: false,
    creditConsumed: false,
    source: "manual",
    createdAt: serverTimestamp(),
  } satisfies Omit<SupplierSubmission, "id" | "createdAt"> & { createdAt: unknown });
  batch.set(pendingIndexDoc, withoutUndefinedFields({
    submissionId: submissionDoc.id,
    submittedBy: userId,
    supplierName: draft.nameOriginal,
    normalizedName: draft.normalizedName,
    normalizedPhones: draft.normalizedPhones,
    normalizedEmail: draft.normalizedEmail,
    website: draft.website,
    googleMapsLink: draft.googleMapsLink,
    governorate: draft.governorate,
    categories: draft.categories,
    source: "pending_submission",
    createdAt: serverTimestamp(),
  }));
  await batch.commit();
}
export async function resubmitSupplierSubmission(
  submissionId: string,
  userId: string,
  draft: SupplierDraft,
  duplicateCheck: DuplicateCheck,
) {
  if (!isFirebaseConfigured) {
    return demo.demoResubmitSupplierSubmission(submissionId, userId, draft, duplicateCheck);
  }
  const submissionDoc = doc(submissionsRef, submissionId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(submissionDoc);
    if (!snapshot.exists()) {
      throw new Error("supplierSubmissionNotFound");
    }
    const submission = snapshot.data() as SupplierSubmission;
    if (submission.submittedBy !== userId || submission.submissionStatus !== "needs_correction") {
      throw new Error("supplierSubmissionCannotEdit");
    }
    transaction.update(submissionDoc, {
      submissionStatus: duplicateCheck.hasPossibleDuplicate ? "possible_duplicate" : "pending_review",
      supplierData: withoutUndefinedFields(draft),
      duplicateCheck: {
        ...duplicateCheck,
        checkedAt: serverTimestamp(),
      },
      countsForAccess: false,
      creditConsumed: false,
    });
    transaction.set(doc(db, "supplierSubmissionDuplicateIndex", submissionId), withoutUndefinedFields({
      submissionId,
      submittedBy: userId,
      supplierName: draft.nameOriginal,
      normalizedName: draft.normalizedName,
      normalizedPhones: draft.normalizedPhones,
      normalizedEmail: draft.normalizedEmail,
      website: draft.website,
      googleMapsLink: draft.googleMapsLink,
      governorate: draft.governorate,
      categories: draft.categories,
      source: "pending_submission",
      createdAt: serverTimestamp(),
    }));
  });
}

export async function listMySubmissions(userId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoListMySubmissions(userId);
  }
  const snapshot = await getDocs(query(submissionsRef, where("submittedBy", "==", userId), orderBy("createdAt", "desc"), limit(100)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierSubmission>(item)),
    100,
  );
}

export async function listSupplierSubmissions(statuses: SupplierSubmissionStatus[] = ["pending_review", "possible_duplicate"]) {
  if (!isFirebaseConfigured) {
    return demo.demoListSupplierSubmissions(statuses);
  }
  const snapshot = await getDocs(query(submissionsRef, where("submissionStatus", "in", statuses), orderBy("createdAt", "desc"), limit(100)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierSubmission>(item)),
    100,
  );
}

export async function getSupplierSubmission(submissionId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoGetSupplierSubmission(submissionId);
  }
  const snapshot = await getDoc(doc(submissionsRef, submissionId));
  return snapshot.exists() ? withId<SupplierSubmission>(snapshot) : null;
}

export async function listSuppliers() {
  if (!isFirebaseConfigured) {
    return demo.demoListSuppliers();
  }
  const snapshot = await getDocs(query(suppliersRef, where("status", "==", "approved")));
  return snapshot.docs.map((item) => withId<Supplier>(item));
}

export type SupplierPageCursor = QueryDocumentSnapshot<DocumentData> | number | null;

export async function listSuppliersPage(pageSize = 50, cursor: SupplierPageCursor = null) {
  if (!isFirebaseConfigured) {
    return demo.demoListSuppliersPage(pageSize, typeof cursor === "number" ? cursor : 0);
  }
  const baseQuery = [
    where("status", "==", "approved"),
    ...(cursor && typeof cursor !== "number" ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];
  const snapshot = await getDocs(query(suppliersRef, ...baseQuery));
  return {
    items: snapshot.docs.map((item) => withId<Supplier>(item)),
    cursor: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export async function listSupplierCandidates(categories: string[]) {
  if (!isFirebaseConfigured) {
    return demo.demoListSupplierCandidates(categories);
  }
  if (!categories.length) {
    return [];
  }
  const snapshot = await getDocs(query(
    suppliersRef,
    where("categories", "array-contains-any", categories.slice(0, 10)),
    limit(100),
  ));
  return snapshot.docs
    .map((item) => withId<Supplier>(item))
    .filter((item) => item.status === "approved" && item.canReceiveRfqs === true);
}

export async function listMaterialTerms() {
  if (!isFirebaseConfigured) {
    return demo.demoListMaterialTerms();
  }
  const snapshot = await getDocs(query(materialTermsRef, where("status", "==", "active"), limit(500)));
  return mergeMaterialTerms(snapshot.docs.map((item) => withId<MaterialTerm>(item)));
}

export async function recordTermSuggestions(
  terms: string[],
  options: {
    source: TermSuggestionSource;
    queryText: string;
    userId?: string;
  },
) {
  const uniqueTerms = Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean))).slice(0, 8);
  if (!uniqueTerms.length) {
    return;
  }
  if (!isFirebaseConfigured) {
    return demo.demoRecordTermSuggestions(uniqueTerms, options);
  }
  const batch = writeBatch(db);
  const seenAt = new Date().toISOString();
  uniqueTerms.forEach((term) => {
    const normalizedTerm = normalizeDictionaryText(term);
    if (!normalizedTerm) return;
    const suggestionDoc = doc(termSuggestionsRef, stableSuggestionId(normalizedTerm));
    batch.set(
      suggestionDoc,
      {
        term,
        normalizedTerm,
        status: "pending",
        count: increment(1),
        sources: arrayUnion(options.source),
        examples: arrayUnion({
          queryText: options.queryText.slice(0, 280),
          source: options.source,
          createdBy: options.userId || "",
          seenAt,
        }),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
}

export async function listTermSuggestions(status: TermSuggestion["status"] = "pending") {
  if (!isFirebaseConfigured) {
    return demo.demoListTermSuggestions(status);
  }
  const snapshot = await getDocs(query(termSuggestionsRef, where("status", "==", status), limit(120)));
  return snapshot.docs
    .map((item) => withId<TermSuggestion>(item))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
}

export async function approveTermSuggestion(
  suggestion: TermSuggestion,
  actorId: string,
  material: Pick<MaterialTerm, "canonicalEn" | "canonicalAr" | "category" | "subcategories" | "synonyms" | "brands" | "standards">,
) {
  if (!isFirebaseConfigured) {
    return demo.demoApproveTermSuggestion(suggestion, actorId, material);
  }
  const materialDoc = doc(materialTermsRef);
  const suggestionDoc = doc(termSuggestionsRef, suggestion.id);
  const auditDoc = doc(auditLogsRef);
  const normalizedSynonyms = Array.from(new Set([suggestion.term, ...material.synonyms].map((item) => item.trim()).filter(Boolean)));
  const payload: MaterialTerm = {
    id: materialDoc.id,
    canonicalEn: material.canonicalEn.trim(),
    canonicalAr: material.canonicalAr.trim(),
    category: material.category,
    subcategories: material.subcategories,
    synonyms: normalizedSynonyms,
    brands: material.brands,
    standards: material.standards,
    status: "active",
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(materialDoc, payload);
  batch.update(suggestionDoc, {
    status: "approved",
    materialTermId: materialDoc.id,
    reviewedAt: serverTimestamp(),
    reviewedBy: actorId,
    updatedAt: serverTimestamp(),
  });
  batch.set(auditDoc, {
    actorId,
    action: "term_suggestion.approved",
    targetType: "termSuggestion",
    targetId: suggestion.id,
    details: { term: suggestion.term, materialTermId: materialDoc.id },
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
}

export async function ignoreTermSuggestion(suggestion: TermSuggestion, actorId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoIgnoreTermSuggestion(suggestion, actorId);
  }
  await updateDoc(doc(termSuggestionsRef, suggestion.id), {
    status: "ignored",
    reviewedAt: serverTimestamp(),
    reviewedBy: actorId,
    updatedAt: serverTimestamp(),
  });
  await addDoc(auditLogsRef, {
    actorId,
    action: "term_suggestion.ignored",
    targetType: "termSuggestion",
    targetId: suggestion.id,
    details: { term: suggestion.term },
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
}

function stableSuggestionId(normalizedTerm: string) {
  let hash = 0;
  for (let index = 0; index < normalizedTerm.length; index += 1) {
    hash = (hash * 31 + normalizedTerm.charCodeAt(index)) | 0;
  }
  const suffix = normalizedTerm.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28);
  return `term_${Math.abs(hash)}${suffix ? `_${suffix}` : ""}`;
}

export async function getSupplier(supplierId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoGetSupplier(supplierId);
  }
  const snapshot = await getDoc(doc(suppliersRef, supplierId));
  return snapshot.exists() ? withId<Supplier>(snapshot) : null;
}

export async function updateApprovedSupplier(supplierId: string, actorId: string, supplierData: SupplierDraft) {
  if (!isFirebaseConfigured) {
    return demo.demoUpdateApprovedSupplier(supplierId, actorId, supplierData);
  }
  const supplierDoc = doc(suppliersRef, supplierId);
  const duplicateDoc = doc(duplicateIndexRef, supplierId);
  const auditDoc = doc(auditLogsRef);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(supplierDoc);
    if (!snapshot.exists()) {
      throw new Error("supplierNotFound");
    }

    transaction.update(supplierDoc, {
      ...withoutUndefinedFields(supplierData),
      ...(supplierData.acceptsCredit === undefined ? { acceptsCredit: deleteField() } : {}),
      ...(supplierData.creditStart === undefined ? { creditStart: deleteField() } : {}),
      sourceSummary: supplierData.sourceNote || supplierData.sourceType,
      updatedAt: serverTimestamp(),
    });
    transaction.set(
      duplicateDoc,
      {
        supplierId,
        supplierName: supplierData.displayName || supplierData.nameOriginal,
        normalizedName: supplierData.normalizedName,
        normalizedPhones: supplierData.normalizedPhones,
        normalizedEmail: normalizeEmail(supplierData.email),
        website: normalizeUrl(supplierData.website),
        facebook: normalizeUrl(supplierData.facebook),
        contactPerson: supplierData.contactPerson || "",
        governorate: supplierData.governorate,
        governorates: supplierData.governorates || (supplierData.governorate ? [supplierData.governorate] : []),
        categories: supplierData.categories,
      } satisfies SupplierDuplicateIndex,
      { merge: true },
    );
    transaction.set(auditDoc, {
      actorId,
      action: "supplier.updated",
      targetType: "supplier",
      targetId: supplierId,
      details: {
        supplierName: supplierData.displayName || supplierData.nameOriginal,
      },
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
}

export async function deleteApprovedSupplier(supplierId: string, actorId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoDeleteApprovedSupplier(supplierId, actorId);
  }
  const supplierDoc = doc(suppliersRef, supplierId);
  const duplicateDoc = doc(duplicateIndexRef, supplierId);
  const auditDoc = doc(auditLogsRef);
  const snapshot = await getDoc(supplierDoc);
  if (!snapshot.exists()) {
    throw new Error("supplierNotFound");
  }
  const supplier = snapshot.data() as Supplier;
  const batch = writeBatch(db);
  batch.delete(supplierDoc);
  batch.delete(duplicateDoc);
  batch.set(auditDoc, {
    actorId,
    action: "supplier.deleted",
    targetType: "supplier",
    targetId: supplierId,
    details: {
      supplierName: supplier.displayName || supplier.nameOriginal,
    },
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
}

export async function approveSupplierSubmission(
  submission: SupplierSubmission,
  actorId: string,
  settings: PlatformSettings,
  editedSupplierData?: SupplierDraft,
  duplicateOverrideReason?: string,
) {
  if (!isFirebaseConfigured) {
    return demo.demoApproveSupplierSubmission(submission, actorId, settings, editedSupplierData);
  }
  return approveSupplierSubmissionTrusted(submission.id, editedSupplierData, duplicateOverrideReason);
}

export async function decideSupplierSubmission(
  submission: SupplierSubmission,
  actorId: string,
  decision: "needs_correction" | "rejected" | "possible_duplicate" | "merged" | "archived",
  adminNotes: string,
) {
  if (!isFirebaseConfigured) {
    return demo.demoDecideSupplierSubmission(submission, actorId, decision, adminNotes);
  }
  return decideSupplierSubmissionTrusted(submission.id, decision, adminNotes);
}
export async function listSupplierReviews(supplierId: string, includePending = false) {
  if (!isFirebaseConfigured) {
    return demo.demoListSupplierReviews(supplierId, includePending);
  }
  const snapshot = await getDocs(
    includePending
      ? query(reviewsRef, where("supplierId", "==", supplierId))
      : query(reviewsRef, where("supplierId", "==", supplierId), where("status", "==", "approved")),
  );
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierReview>(item)),
    50,
  );
}

export async function listMyReviews(userId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoListMyReviews(userId);
  }
  const snapshot = await getDocs(query(reviewsRef, where("reviewedBy", "==", userId)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierReview>(item)),
    100,
  );
}

export async function submitSupplierReview(review: Omit<SupplierReview, "id" | "status" | "createdAt">) {
  if (!isFirebaseConfigured) {
    return demo.demoSubmitSupplierReview(review);
  }
  await addDoc(reviewsRef, {
    ...review,
    status: "pending_review",
    createdAt: serverTimestamp(),
  });
}

export async function listPendingReviews() {
  if (!isFirebaseConfigured) {
    return demo.demoListPendingReviews();
  }
  const snapshot = await getDocs(query(reviewsRef, where("status", "==", "pending_review"), orderBy("createdAt", "desc"), limit(100)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierReview>(item)),
    100,
  );
}

export async function moderateReview(review: SupplierReview, actorId: string, decision: "approved" | "rejected") {
  if (!isFirebaseConfigured) {
    return demo.demoModerateReview(review, actorId, decision);
  }
  const reviewDoc = doc(reviewsRef, review.id);
  const supplierDoc = doc(suppliersRef, review.supplierId);
  const userDocRef = doc(usersRef, review.reviewedBy);
  const settings = await getPlatformSettings();

  await runTransaction(db, async (transaction) => {
    const supplierSnapshot = await transaction.get(supplierDoc);
    const userSnapshot = await transaction.get(userDocRef);
    const supplier = supplierSnapshot.exists() ? (supplierSnapshot.data() as Supplier) : null;
    const user = userSnapshot.exists() ? (userSnapshot.data() as AppUser) : null;

    transaction.update(reviewDoc, {
      status: decision,
      approvedAt: decision === "approved" ? serverTimestamp() : null,
    });

    if (decision === "approved" && supplier) {
      const count = supplier.reviewCount || 0;
      const averageRating = Number((((supplier.averageRating || 0) * count + review.overall) / (count + 1)).toFixed(2));
      transaction.update(supplierDoc, {
        reviewCount: count + 1,
        averageRating,
        updatedAt: serverTimestamp(),
      });
    }

    if (decision === "approved" && user) {
      transaction.update(userDocRef, {
        approvedReviews: (user.approvedReviews || 0) + 1,
        points: (user.points || 0) + (settings.reviewsEarnBonusPoints ? 4 : 0),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(doc(auditLogsRef), {
      actorId,
      action: `review.${decision}`,
      targetType: "review",
      targetId: review.id,
      details: { supplierId: review.supplierId },
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
}

const auditLogCache = new ReadThroughCache<AuditLog[]>(30_000);

export function listAuditLogs(pageSize = 100, options: CacheReadOptions = {}) {
  const boundedPageSize = Math.max(1, Math.min(pageSize, 100));
  return auditLogCache.read(String(boundedPageSize), async () => {
    if (!isFirebaseConfigured) {
      return (await demo.demoListAuditLogs()).slice(0, boundedPageSize);
    }
    const snapshot = await getDocs(query(auditLogsRef, orderBy("createdAt", "desc"), limit(boundedPageSize)));
    return snapshot.docs.map((item) => withId<AuditLog>(item));
  }, options);
}

export async function listAccessCredits(userId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoListAccessCredits(userId);
  }
  const snapshot = await getDocs(query(accessCreditsRef, where("userId", "==", userId)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<AccessCredit>(item)),
    50,
  );
}

export async function submitSupplierFeedback(
  userId: string,
  supplier: Pick<Supplier, "id" | "displayName" | "nameOriginal" | "nameAr" | "nameEn">,
  type: SupplierFeedbackType,
  message: string,
  suggestedCorrection: string,
) {
  if (!isFirebaseConfigured) {
    return demo.demoSubmitSupplierFeedback(userId, supplier, type, message, suggestedCorrection);
  }
  await addDoc(supplierFeedbackRef, {
    supplierId: supplier.id,
    supplierName: supplier.displayName || supplier.nameOriginal,
    supplierNameAr: supplier.nameAr || "",
    supplierNameEn: supplier.nameEn || "",
    submittedBy: userId,
    type,
    message: message.trim(),
    suggestedCorrection: suggestedCorrection.trim(),
    status: "pending",
    adminNotes: "",
    createdAt: serverTimestamp(),
  } satisfies Omit<SupplierFeedback, "id" | "createdAt"> & { createdAt: unknown });
}

export async function listMySupplierFeedback(userId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoListMySupplierFeedback(userId);
  }
  const snapshot = await getDocs(query(supplierFeedbackRef, where("submittedBy", "==", userId), orderBy("createdAt", "desc"), limit(100)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierFeedback>(item)),
    100,
  );
}

export async function listSupplierFeedback(
  statuses: SupplierFeedbackStatus[] = ["pending", "in_review"],
) {
  if (!isFirebaseConfigured) {
    return demo.demoListSupplierFeedback(statuses);
  }
  const snapshot = await getDocs(
    statuses.length === 1
      ? query(supplierFeedbackRef, where("status", "==", statuses[0]), orderBy("createdAt", "desc"), limit(100))
      : query(supplierFeedbackRef, where("status", "in", statuses), orderBy("createdAt", "desc"), limit(100)),
  );
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierFeedback>(item)),
    100,
  );
}

export async function updateSupplierFeedbackStatus(
  feedback: SupplierFeedback,
  actorId: string,
  status: Exclude<SupplierFeedbackStatus, "pending">,
  adminNotes: string,
) {
  if (!isFirebaseConfigured) {
    return demo.demoUpdateSupplierFeedbackStatus(feedback, actorId, status, adminNotes);
  }
  const feedbackDoc = doc(supplierFeedbackRef, feedback.id);
  await runTransaction(db, async (transaction) => {
    transaction.update(feedbackDoc, {
      status,
      adminNotes: adminNotes.trim(),
      reviewedAt: serverTimestamp(),
      reviewedBy: actorId,
    });
    transaction.set(doc(auditLogsRef), {
      actorId,
      action: `supplier_feedback.${status}`,
      targetType: "supplierFeedback",
      targetId: feedback.id,
      details: {
        supplierId: feedback.supplierId,
        feedbackType: feedback.type,
      },
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
}


