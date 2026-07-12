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
import { calculateAccessGrant, deriveBadges, qualityRatio } from "../utils/scoring";
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
  const snapshot = await getDocs(status ? query(usersRef, where("status", "==", status)) : query(usersRef));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<AppUser>(item)),
    100,
  );
}

export async function approveUser(userId: string, actorId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoApproveUser(userId, actorId);
  }
  const batch = writeBatch(db);
  batch.update(doc(usersRef, userId), {
    status: "approved",
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(auditLogsRef), {
    actorId,
    action: "user.approved",
    targetType: "user",
    targetId: userId,
    details: {},
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
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
  const targetRef = doc(usersRef, userId);
  const targetSnapshot = await getDoc(targetRef);
  if (!targetSnapshot.exists()) throw new Error("User profile was not found.");
  const targetUser = targetSnapshot.data() as AppUser;
  const removesOwnerAccess = targetUser.role === "owner" && (role !== "owner" || status === "suspended");
  if (removesOwnerAccess) {
    const ownerSnapshot = await getDocs(query(usersRef, where("role", "==", "owner"), limit(2)));
    if (ownerSnapshot.size <= 1) throw new Error("last_owner_protected");
  }

  const batch = writeBatch(db);
  const patch: Partial<AppUser> = {
    role,
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "suspended") {
    patch.accessStatus = "suspended";
  }
  batch.update(targetRef, patch);
  if (targetUser.accountType === "supplier" && targetUser.supplierProfileId) {
    batch.update(doc(suppliersRef, targetUser.supplierProfileId), {
      canReceiveRfqs: status === "approved",
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(doc(auditLogsRef), {
    actorId,
    action: "user.role_status_updated",
    targetType: "user",
    targetId: userId,
    details: { role, status },
    createdAt: serverTimestamp(),
  } satisfies Omit<AuditLog, "id">);
  await batch.commit();
}

export async function grantTemporaryAccess(userId: string, actorId: string, days: number) {
  if (!isFirebaseConfigured) {
    return demo.demoGrantTemporaryAccess(userId, actorId, days);
  }
  const userDocRef = doc(usersRef, userId);
  const creditDoc = doc(accessCreditsRef);
  const auditDoc = doc(auditLogsRef);

  await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userDocRef);
    if (!userSnapshot.exists()) {
      throw new Error("User profile was not found.");
    }
    const user = userSnapshot.data() as AppUser;
    const existingAccessDate = toDate(user.accessExpiresAt);
    const now = new Date();
    const baseAccessDate = existingAccessDate ? maxDate(now, existingAccessDate) : now;
    const newAccessExpiresAt = addDays(baseAccessDate, days);

    transaction.update(userDocRef, {
      accessStatus: "temporary",
      accessExpiresAt: newAccessExpiresAt,
      updatedAt: serverTimestamp(),
    });
    transaction.set(creditDoc, {
      userId,
      source: "manual_grace",
      approvedSupplierCount: 0,
      daysGranted: days,
      status: "applied",
      createdAt: serverTimestamp(),
      appliedAt: serverTimestamp(),
    } satisfies Omit<AccessCredit, "id">);
    transaction.set(auditDoc, {
      actorId,
      action: "access.temporary_granted",
      targetType: "user",
      targetId: userId,
      details: { days },
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
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

export async function fetchDuplicateIndexes() {
  if (!isFirebaseConfigured) {
    return demo.demoFetchDuplicateIndexes();
  }
  const snapshot = await getDocs(duplicateIndexRef);
  return snapshot.docs.map((item) => item.data() as SupplierDuplicateIndex);
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
  const auditDoc = doc(auditLogsRef);
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
      adminDecision: "resubmitted",
      adminNotes: "",
      supplierData: withoutUndefinedFields(draft),
      duplicateCheck: {
        ...duplicateCheck,
        checkedAt: serverTimestamp(),
      },
      reviewedAt: null,
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
    transaction.set(auditDoc, {
      actorId: userId,
      action: "supplier_submission.resubmitted",
      targetType: "supplierSubmission",
      targetId: submissionId,
      details: {},
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLßß7¶‰žËkºwµçUÝUÍ•È€ôì(€€€€€€¸¸¹ÕÍ•È°(€€€€€…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹Ì°(€€€€€É•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ì°(€€€€€‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ì°(€€€€€…ÁÁÉ½Ù•‘9•ÝMÕÁÁ±¥•É½¹ÑÉ¥‰ÕÑ¥½¹Ì°(€€€ôì(€€€½¹ÍÐ…•ÍÍÉ…¹Ð€ô…±Õ±…Ñ••ÍÍÉ…¹Ð¡ÁÉ•Ù¥•ÝUÍ•È°Í•ÑÑ¥¹Ì¤ì(€€€½¹ÍÐ•á¥ÍÑ¥¹•ÍÍ…Ñ”€ôÑ½…Ñ”¡ÕÍ•È¹…•ÍÍáÁ¥É•ÍÐ¤ì(€€€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì(€€€½¹ÍÐ‰…Í••ÍÍ…Ñ”€ô•á¥ÍÑ¥¹•ÍÍ…Ñ”€üµ…á…Ñ”¡¹½Ü°•á¥ÍÑ¥¹•ÍÍ…Ñ”¤€è¹½Üì(€€€½¹ÍÐµ…áMÑ…­…Ñ”€ô…‘‘…åÌ¡¹½Ü°Í•ÑÑ¥¹Ì¹µ…á¥µÕµMÑ…­…‰±•5½¹Ñ¡Ì€¨Í•ÑÑ¥¹Ì¹‘…åÍÉ…¹Ñ•‘A•É	…Ñ ¤ì(€€€±•Ð‘…åÍQ½É…¹Ð€ô…•ÍÍÉ…¹Ð¹‘…åÍQ½É…¹Ðì(€€€±•Ð½¹ÍÕµ•‘½É•ÍÌ€ô…•ÍÍÉ…¹Ð¹½¹ÍÕµ•ì(€€€¥˜€¡‘…åÍQ½É…¹Ð€ø€À€˜˜…‘‘…åÌ¡‰…Í••ÍÍ…Ñ”°‘…åÍQ½É…¹Ð¤¹•ÑQ¥µ” ¤€øµ…áMÑ…­…Ñ”¹•ÑQ¥µ” ¤¤ì(€€€€€½¹ÍÐ…±±½Ý•‘…åÌ€ô5…Ñ ¹µ…à À°5…Ñ ¹™±½½È ¡µ…áMÑ…­…Ñ”¹•ÑQ¥µ” ¤€´‰…Í••ÍÍ…Ñ”¹•ÑQ¥µ” ¤¤€¼€àÙ|ÐÀÁ|ÀÀÀ¤¤ì(€€€€€½¹ÍÐ…±±½Ý•‘5½¹Ñ¡Ì€ô5…Ñ ¹™±½½È¡…±±½Ý•‘…åÌ€¼Í•ÑÑ¥¹Ì¹‘…åÍÉ…¹Ñ•‘A•É	…Ñ ¤ì(€€€€€‘…åÍQ½É…¹Ð€ô…±±½Ý•‘5½¹Ñ¡Ì€¨Í•ÑÑ¥¹Ì¹‘…åÍÉ…¹Ñ•‘A•É	…Ñ ì(€€€€€½¹ÍÕµ•‘½É•ÍÌ€ô…±±½Ý•‘5½¹Ñ¡Ì€¨Í•ÑÑ¥¹Ì¹É•ÅÕ¥É•‘ÁÁÉ½Ù•‘MÕÁÁ±¥•ÉÍA•É5½¹Ñ ì(€€€ô(€€€½¹ÍÐ¹•Ý•ÍÍáÁ¥É•ÍÐ€ô(€€€€€‘…åÍQ½É…¹Ð€ø€À€ü…‘‘…åÌ¡‰…Í••ÍÍ…Ñ”°‘…åÍQ½É…¹Ð¤€èÕÍ•È¹…•ÍÍáÁ¥É•ÍÐñð¹Õ±°ì(€€€½¹ÍÐ¹•áÑEÕ…±¥ÑåI…Ñ¥¼€ôÅÕ…±¥ÑåI…Ñ¥¼¡…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹Ì°É•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ì°‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ì¤ì(€€€½¹ÍÐ¹•áÑ	…‘•Ì€ô‘•É¥Ù•	…‘•Ì¡ì(€€€€€€¸¸¹ÁÉ•Ù¥•ÝUÍ•È°(€€€€€ÅÕ…±¥ÑåI…Ñ¥¼è¹•áÑEÕ…±¥ÑåI…Ñ¥¼°(€€€€€‰…‘•ÌèÕÍ•È¹‰…‘•Ìñðmt°(€€€€€…ÁÁÉ½Ù•‘I•Ù¥•ÝÌèÕÍ•È¹…ÁÁÉ½Ù•‘I•Ù¥•ÝÌñð€À°(€€€ô¤ì((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡ÍÕÁÁ±¥•É½Œ°ì(€€€€€€¸¸¹ÍÕÁÁ±¥•É…Ñ„°(€€€€€¥èÍÕÁÁ±¥•É½Œ¹¥°(€€€€€ÍÑ…ÑÕÌè€‰…ÁÁÉ½Ù•ˆ°(€€€€€Ù•É¥™¥…Ñ¥½¹MÑ…ÑÕÌè€‰½µµÕ¹¥Ñå}ÍÕ‰µ¥ÑÑ•ˆ°(€€€€€Í½ÕÉ•MÕµµ…ÉäèÍÕÁÁ±¥•É…Ñ„¹Í½ÕÉ•9½Ñ”ñðÍÕÁÁ±¥•É…Ñ„¹Í½ÕÉ•QåÁ”°(€€€€€…Ù•É…•I…Ñ¥¹œè€À°(€€€€€É•Ù¥•Ý½Õ¹Ðè€À°(€€€€€É•…Ñ•‘	äèÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä°(€€€€€…½Õ¹Ñ=Ý¹•É%èÕÍ•È¹…½Õ¹ÑQåÁ”€ôôô€‰ÍÕÁÁ±¥•Èˆ€üÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä€è€ˆˆ°(€€€€€…¹I••¥Ù•I™ÅÌèÕÍ•È¹…½Õ¹ÑQåÁ”€ôôô€‰ÍÕÁÁ±¥•Èˆ°(€€€€€…ÁÁÉ½Ù•‘	äè…Ñ½É%°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€ÕÁ‘…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ôÍ…Ñ¥Í™¥•ÌMÕÁÁ±¥•È¤ì((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡‘ÕÁ±¥…Ñ•½Œ°ì(€€€€€ÍÕÁÁ±¥•É%èÍÕÁÁ±¥•É½Œ¹¥°(€€€€€ÍÕÁÁ±¥•É9…µ”èÍÕÁÁ±¥•É…Ñ„¹‘¥ÍÁ±…å9…µ”ñðÍÕÁÁ±¥•É…Ñ„¹¹…µ•=É¥¥¹…°°(€€€€€¹½Éµ…±¥é•‘9…µ”èÍÕÁÁ±¥•É…Ñ„¹¹½Éµ…±¥é•‘9…µ”°(€€€€€¹½Éµ…±¥é•‘A¡½¹•ÌèÍÕÁÁ±¥•É…Ñ„¹¹½Éµ…±¥é•‘A¡½¹•Ì°(€€€€€¹½Éµ…±¥é•‘µ…¥°è¹½Éµ…±¥é•µ…¥°¡ÍÕÁÁ±¥•É…Ñ„¹•µ…¥°¤°(€€€€€Ý•‰Í¥Ñ”è¹½Éµ…±¥é•UÉ°¡ÍÕÁÁ±¥•É…Ñ„¹Ý•‰Í¥Ñ”¤°(€€€€€™…•‰½½¬è¹½Éµ…±¥é•UÉ°¡ÍÕÁÁ±¥•É…Ñ„¹™…•‰½½¬¤°(€€€€€½¹Ñ…ÑA•ÉÍ½¸èÍÕÁÁ±¥•É…Ñ„¹½¹Ñ…ÑA•ÉÍ½¸ñð€ˆˆ°(€€€€€½Ù•É¹½É…Ñ”èÍÕÁÁ±¥•É…Ñ„¹½Ù•É¹½É…Ñ”°(€€€€€½Ù•É¹½É…Ñ•ÌèÍÕÁÁ±¥•É…Ñ„¹½Ù•É¹½É…Ñ•Ìñð€¡ÍÕÁÁ±¥•É…Ñ„¹½Ù•É¹½É…Ñ”€ümÍÕÁÁ±¥•É…Ñ„¹½Ù•É¹½É…Ñ•t€èmt¤°(€€€€€…Ñ•½É¥•ÌèÍÕÁÁ±¥•É…Ñ„¹…Ñ•½É¥•Ì°(€€€ôÍ…Ñ¥Í™¥•ÌMÕÁÁ±¥•ÉÕÁ±¥…Ñ•%¹‘•à¤ì((€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡ÍÕ‰µ¥ÍÍ¥½¹½Œ°ì(€€€€€ÍÕ‰µ¥ÍÍ¥½¹MÑ…ÑÕÌè€‰…ÁÁÉ½Ù•ˆ°(€€€€€…‘µ¥¹•¥Í¥½¸è€‰…ÁÁÉ½Ù•ˆ°(€€€€€½Õ¹ÑÍ½É•ÍÌèÑÉÕ”°(€€€€€É•‘¥Ñ½¹ÍÕµ•è½¹ÍÕµ•‘½É•ÍÌ€ø€À°(€€€€€É•Ù¥•Ý•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€…‘µ¥¹9½Ñ•Ìè€ˆˆ°(€€€ô¤ì(€€€ÑÉ…¹Í…Ñ¥½¸¹‘•±•Ñ”¡‘½Œ¡‘ˆ°€‰ÍÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¹ÕÁ±¥…Ñ•%¹‘•àˆ°ÍÕ‰µ¥ÍÍ¥½¸¹¥¤¤ì((€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡ÕÍ•É½I•˜°ì(€€€€€€¸¸¸¡ÕÍ•È¹…½Õ¹ÑQåÁ”€ôôô€‰ÍÕÁÁ±¥•Èˆ€˜˜€…ÕÍ•È¹ÍÕÁÁ±¥•ÉAÉ½™¥±•%(€€€€€€€€üìÍÕÁÁ±¥•ÉAÉ½™¥±•%èÍÕÁÁ±¥•É½Œ¹¥ô(€€€€€€€€èíô¤°(€€€€€…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹Ì°(€€€€€…ÁÁÉ½Ù•‘9•ÝMÕÁÁ±¥•É½¹ÑÉ¥‰ÕÑ¥½¹Ì°(€€€€€½¹ÍÕµ•‘ÁÁÉ½Ù•‘MÕÁÁ±¥•É½¹ÑÉ¥‰ÕÑ¥½¹Ìè(€€€€€€€€¡ÕÍ•È¹½¹ÍÕµ•‘ÁÁÉ½Ù•‘MÕÁÁ±¥•É½¹ÑÉ¥‰ÕÑ¥½¹Ìñð€À¤€¬½¹ÍÕµ•‘½É•ÍÌ°(€€€€€Õ¹½¹ÍÕµ•‘ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹%‘Ìè½¹ÍÕµ•‘½É•ÍÌ€ø€À€üÁ•¹‘¥¹MÕ‰µ¥ÍÍ¥½¹%‘Ì¹Í±¥”¡5…Ñ ¹µ¥¸¡½¹ÍÕµ•‘½É•ÍÌ°Á•¹‘¥¹MÕ‰µ¥ÍÍ¥½¹%‘Ì¹±•¹Ñ ¤¤€èÁ•¹‘¥¹MÕ‰µ¥ÍÍ¥½¹%‘Ì°(€€€€€…•ÍÍMÑ…ÑÕÌè‘…åÍQ½É…¹Ð€ø€Àñð€¡•á¥ÍÑ¥¹•ÍÍ…Ñ”€˜˜•á¥ÍÑ¥¹•ÍÍ…Ñ”€ø¹½Ü¤€ü€‰…Ñ¥Ù”ˆ€èÕÍ•È¹…•ÍÍMÑ…ÑÕÌ°(€€€€€…•ÍÍáÁ¥É•ÍÐè¹•Ý•ÍÍáÁ¥É•ÍÐ°(€€€€€Á½¥¹ÑÌè€¡ÕÍ•È¹Á½¥¹ÑÌñð€À¤€¬€ÄÀ€¬€¡ÍÕÁÁ±¥•É…Ñ„¹Á¡½¹•Ì¹±•¹Ñ ñðÍÕÁÁ±¥•É…Ñ„¹•µ…¥°€ü€È€è€À¤€¬€¡ÍÕÁÁ±¥•É…Ñ„¹…Ñ•½É¥•Ì¹±•¹Ñ €˜˜ÍÕÁÁ±¥•É…Ñ„¹…Á…‰¥±¥ÑåQ…Ì¹±•¹Ñ €ü€È€è€À¤°(€€€€€ÅÕ…±¥ÑåI…Ñ¥¼è¹•áÑEÕ…±¥ÑåI…Ñ¥¼°(€€€€€‰…‘•Ìè¹•áÑ	…‘•Ì°(€€€€€ÕÁ‘…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ô¤ì((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡½¹ÑÉ¥‰ÕÑ¥½¹1½½Œ°ì(€€€€€ÕÍ•É%èÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä°(€€€€€ÑåÁ”è€‰¹•Ý}ÍÕÁÁ±¥•Èˆ°(€€€€€ÍÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¹%èÍÕ‰µ¥ÍÍ¥½¸¹¥°(€€€€€ÍÕÁÁ±¥•É%èÍÕÁÁ±¥•É½Œ¹¥°(€€€€€Á½¥¹ÑÌè€ÄÀ°(€€€€€½Õ¹ÑÍ½É•ÍÌèÑÉÕ”°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ô¤ì((€€€¥˜€¡‘…åÍQ½É…¹Ð€ø€À¤ì(€€€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡…•ÍÍÉ•‘¥Ñ½Œ°ì(€€€€€€€ÕÍ•É%èÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä°(€€€€€€€Í½ÕÉ”è€‰ÍÕÁÁ±¥•É}½¹ÑÉ¥‰ÕÑ¥½¸ˆ°(€€€€€€€…ÁÁÉ½Ù•‘MÕÁÁ±¥•É½Õ¹Ðè½¹ÍÕµ•‘½É•ÍÌ°(€€€€€€€‘…åÍÉ…¹Ñ•è‘…åÍQ½É…¹Ð°(€€€€€€€ÍÑ…ÑÕÌè€‰…ÁÁ±¥•ˆ°(€€€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€€€…ÁÁ±¥•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€ôÍ…Ñ¥Í™¥•Ì=µ¥Ðñ•ÍÍÉ•‘¥Ð°€‰¥ˆø¤ì(€€€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡…•ÍÍÉ…¹Ñ½Œ°ì(€€€€€€€ÕÍ•É%èÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä°(€€€€€€€É…¹ÑQåÁ”è€‰ÍÕÁÁ±¥•É}½¹ÑÉ¥‰ÕÑ¥½¸ˆ°(€€€€€€€…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹%‘ÌèÁ•¹‘¥¹MÕ‰µ¥ÍÍ¥½¹%‘Ì¹Í±¥” À°5…Ñ ¹µ¥¸¡½¹ÍÕµ•‘½É•ÍÌ°Á•¹‘¥¹MÕ‰µ¥ÍÍ¥½¹%‘Ì¹±•¹Ñ ¤¤°(€€€€€€€…ÁÁÉ½Ù•‘MÕÁÁ±¥•É½Õ¹Ðè½¹ÍÕµ•‘½É•ÍÌ°(€€€€€€€‘…åÍÉ…¹Ñ•è‘…åÍQ½É…¹Ð°(€€€€€€€É…¹Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€€€ÁÉ•Ù¥½ÕÍáÁ¥Éäè•á¥ÍÑ¥¹•ÍÍ…Ñ”ñð¹Õ±°°(€€€€€€€¹•ÝáÁ¥Éäè¹•Ý•ÍÍáÁ¥É•ÍÐ°(€€€€€€€É•…Ñ•‘	äè…Ñ½É%°(€€€€€€€…Õ‘¥ÑI•™•É•¹”è…Õ‘¥Ñ½Œ¹¥°(€€€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€ô¤ì(€€€ô((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡¹½Ñ¥™¥…Ñ¥½¹½Œ°ì(€€€€€ÕÍ•É%èÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä°(€€€€€ÑåÁ”è€‰ÍÕ‰µ¥ÍÍ¥½¸ˆ°(€€€€€Ñ¥Ñ±•Èè€‹b«fƒbŸbçb«fbŸb¼ƒbŸffb³fbÈˆ°(€€€€€Ñ¥Ñ±•¸è€‰MÕÁÁ±¥•ÈÍÕ‰µ¥ÍÍ¥½¸…ÁÁÉ½Ù•ˆ°(€€€€€‰½‘åÈè‘…åÍQ½É…¹Ð€ø€À€ü€‹b«fƒbŸbçb«fbŸb¼ƒbŸfbÏb³fƒf#ffb´ƒfb«bÇb¤ƒf#b×f#fƒb—bÛbŸff+b¤¸ˆ€è€‹b«fƒbŸbçb«fbŸb¼ƒbÏb³fƒbŸffb³fbÈƒf#b—bÛbŸfb«fƒb—ff$ƒbŸfb¿ff+f¸ˆ°(€€€€€‰½‘å¸è‘…åÍQ½É…¹Ð€ø€À€ü€‰Q¡”É•½ÉÝ…Ì…ÁÁÉ½Ù•…¹…‘‘¥Ñ¥½¹…°…•ÍÌÝ…ÌÉ…¹Ñ•¸ˆ€è€‰Q¡”ÍÕÁÁ±¥•ÈÉ•½ÉÝ…Ì…ÁÁÉ½Ù•…¹…‘‘•Ñ¼Ñ¡”‘¥É•Ñ½Éä¸ˆ°(€€€€€±¥¹¬è€ˆ½‰Õå•È½ÍÕÁÁ±¥•ÉÌ½ÍÕ‰µ¥ÍÍ¥½¹Ìˆ°(€€€€€É•…è™…±Í”°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ô¤ì((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡…Õ‘¥Ñ½Œ°ì(€€€€€…Ñ½É%°(€€€€€…Ñ¥½¸è€‰ÍÕÁÁ±¥•É}ÍÕ‰µ¥ÍÍ¥½¸¹…ÁÁÉ½Ù•ˆ°(€€€€€Ñ…É•ÑQåÁ”è€‰ÍÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¸ˆ°(€€€€€Ñ…É•Ñ%èÍÕ‰µ¥ÍÍ¥½¸¹¥°(€€€€€‘•Ñ…¥±Ìèì(€€€€€€€ÍÕÁÁ±¥•É%èÍÕÁÁ±¥•É½Œ¹¥°(€€€€€€€½¹ÑÉ¥‰ÕÑ½É%èÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä°(€€€€€€€‘…åÍÉ…¹Ñ•è‘…åÍQ½É…¹Ð°(€€€€€ô°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ôÍ…Ñ¥Í™¥•Ì=µ¥ÐñÕ‘¥Ñ1½œ°€‰¥ˆø¤ì(€ô¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸‘•¥‘•MÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¸ (€ÍÕ‰µ¥ÍÍ¥½¸èMÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¸°(€…Ñ½É%èÍÑÉ¥¹œ°(€‘•¥Í¥½¸è€‰¹••‘Í}½ÉÉ•Ñ¥½¸ˆð€‰É•©•Ñ•ˆð€‰Á½ÍÍ¥‰±•}‘ÕÁ±¥…Ñ”ˆð€‰µ•É•ˆð€‰…É¡¥Ù•ˆ°(€…‘µ¥¹9½Ñ•ÌèÍÑÉ¥¹œ°(¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½•¥‘•MÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¸¡ÍÕ‰µ¥ÍÍ¥½¸°…Ñ½É%°‘•¥Í¥½¸°…‘µ¥¹9½Ñ•Ì¤ì(€ô(€½¹ÍÐÕÍ•ÉI•˜€ô‘½Œ¡ÕÍ•ÉÍI•˜°ÍÕ‰µ¥ÍÍ¥½¸¹ÍÕ‰µ¥ÑÑ•‘	ä¤ì(€½¹ÍÐÍÕ‰µ¥ÍÍ¥½¹I•˜€ô‘½Œ¡ÍÕ‰µ¥ÍÍ¥½¹ÍI•˜°ÍÕ‰µ¥ÍÍ¥½¸¹¥¤ì(€…Ý…¥ÐÉÕ¹QÉ…¹Í…Ñ¥½¸¡‘ˆ°…Íå¹Œ€¡ÑÉ…¹Í…Ñ¥½¸¤€ôøì(€€€½¹ÍÐÕÍ•ÉM¹…ÁÍ¡½Ð€ô…Ý…¥ÐÑÉ…¹Í…Ñ¥½¸¹•Ð¡ÕÍ•ÉI•˜¤ì(€€€½¹ÍÐÕÍ•È€ôÕÍ•ÉM¹…ÁÍ¡½Ð¹•á¥ÍÑÌ ¤€ü€¡ÕÍ•ÉM¹…ÁÍ¡½Ð¹‘…Ñ„ ¤…ÌÁÁUÍ•È¤€è¹Õ±°ì(€€€½¹ÍÐÉ•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ì€ô‘•¥Í¥½¸€ôôô€‰É•©•Ñ•ˆ€ü€¡ÕÍ•Èü¹É•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ìñð€À¤€¬€Ä€èÕÍ•Èü¹É•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ìñð€Àì(€€€½¹ÍÐ‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ì€ô(€€€€€‘•¥Í¥½¸€ôôô€‰Á½ÍÍ¥‰±•}‘ÕÁ±¥…Ñ”ˆñð‘•¥Í¥½¸€ôôô€‰µ•É•ˆ(€€€€€€€€ü€¡ÕÍ•Èü¹‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ìñð€À¤€¬€Ä(€€€€€€€€èÕÍ•Èü¹‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ìñð€Àì(€€€½¹ÍÐ…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹Ì€ôÕÍ•Èü¹…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹Ìñð€Àì((€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡ÍÕ‰µ¥ÍÍ¥½¹I•˜°ì(€€€€€ÍÕ‰µ¥ÍÍ¥½¹MÑ…ÑÕÌè‘•¥Í¥½¸°(€€€€€…‘µ¥¹•¥Í¥½¸è‘•¥Í¥½¸°(€€€€€…‘µ¥¹9½Ñ•Ì°(€€€€€½Õ¹ÑÍ½É•ÍÌè™…±Í”°(€€€€€É•‘¥Ñ½¹ÍÕµ•è™…±Í”°(€€€€€É•Ù¥•Ý•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ô¤ì(€€€ÑÉ…¹Í…Ñ¥½¸¹‘•±•Ñ”¡‘½Œ¡‘ˆ°€‰ÍÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¹ÕÁ±¥…Ñ•%¹‘•àˆ°ÍÕ‰µ¥ÍÍ¥½¸¹¥¤¤ì((€€€¥˜€¡ÕÍ•È¤ì(€€€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡ÕÍ•ÉI•˜°ì(€€€€€€€É•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ì°(€€€€€€€‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ì°(€€€€€€€Á½¥¹ÑÌè‘•¥Í¥½¸€ôôô€‰É•©•Ñ•ˆ€ü5…Ñ ¹µ…à À°€¡ÕÍ•È¹Á½¥¹ÑÌñð€À¤€´€È¤€èÕÍ•È¹Á½¥¹ÑÌñð€À°(€€€€€€€ÅÕ…±¥ÑåI…Ñ¥¼èÅÕ…±¥ÑåI…Ñ¥¼¡…ÁÁÉ½Ù•‘MÕ‰µ¥ÍÍ¥½¹Ì°É•©•Ñ•‘MÕ‰µ¥ÍÍ¥½¹Ì°‘ÕÁ±¥…Ñ•MÕ‰µ¥ÍÍ¥½¹Ì¤°(€€€€€€€ÕÁ‘…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€ô¤ì(€€€ô((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡‘½Œ¡…Õ‘¥Ñ1½ÍI•˜¤°ì(€€€€€…Ñ½É%°(€€€€€…Ñ¥½¸èÍÕÁÁ±¥•É}ÍÕ‰µ¥ÍÍ¥½¸¸‘í‘•¥Í¥½¹õ€°(€€€€€Ñ…É•ÑQåÁ”è€‰ÍÕÁÁ±¥•ÉMÕ‰µ¥ÍÍ¥½¸ˆ°(€€€€€Ñ…É•Ñ%èÍÕ‰µ¥ÍÍ¥½¸¹¥°(€€€€€‘•Ñ…¥±Ìèì…‘µ¥¹9½Ñ•Ìô°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ôÍ…Ñ¥Í™¥•Ì=µ¥ÐñÕ‘¥Ñ1½œ°€‰¥ˆø¤ì(€ô¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑMÕÁÁ±¥•ÉI•Ù¥•ÝÌ¡ÍÕÁÁ±¥•É%èÍÑÉ¥¹œ°¥¹±Õ‘•A•¹‘¥¹œ€ô™…±Í”¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑMÕÁÁ±¥•ÉI•Ù¥•ÝÌ¡ÍÕÁÁ±¥•É%°¥¹±Õ‘•A•¹‘¥¹œ¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì (€€€¥¹±Õ‘•A•¹‘¥¹œ(€€€€€€üÅÕ•Éä¡É•Ù¥•ÝÍI•˜°Ý¡•É” ‰ÍÕÁÁ±¥•É%ˆ°€ˆôôˆ°ÍÕÁÁ±¥•É%¤¤(€€€€€€èÅÕ•Éä¡É•Ù¥•ÝÍI•˜°Ý¡•É” ‰ÍÕÁÁ±¥•É%ˆ°€ˆôôˆ°ÍÕÁÁ±¥•É%¤°Ý¡•É” ‰ÍÑ…ÑÕÌˆ°€ˆôôˆ°€‰…ÁÁÉ½Ù•ˆ¤¤°(€€¤ì(€É•ÑÕÉ¸Í½ÉÑ	åÉ•…Ñ•‘Ñ•ÍŒ (€€€Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñMÕÁÁ±¥•ÉI•Ù¥•Üø¡¥Ñ•´¤¤°(€€€€ÔÀ°(€€¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑ5åI•Ù¥•ÝÌ¡ÕÍ•É%èÍÑÉ¥¹œ¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑ5åI•Ù¥•ÝÌ¡ÕÍ•É%¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì¡ÅÕ•Éä¡É•Ù¥•ÝÍI•˜°Ý¡•É” ‰É•Ù¥•Ý•‘	äˆ°€ˆôôˆ°ÕÍ•É%¤¤¤ì(€É•ÑÕÉ¸Í½ÉÑ	åÉ•…Ñ•‘Ñ•ÍŒ (€€€Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñMÕÁÁ±¥•ÉI•Ù¥•Üø¡¥Ñ•´¤¤°(€€€€ÄÀÀ°(€€¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸ÍÕ‰µ¥ÑMÕÁÁ±¥•ÉI•Ù¥•Ü¡É•Ù¥•Üè=µ¥ÐñMÕÁÁ±¥•ÉI•Ù¥•Ü°€‰¥ˆð€‰ÍÑ…ÑÕÌˆð€‰É•…Ñ•‘Ðˆø¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½MÕ‰µ¥ÑMÕÁÁ±¥•ÉI•Ù¥•Ü¡É•Ù¥•Ü¤ì(€ô(€…Ý…¥Ð…‘‘½Œ¡É•Ù¥•ÝÍI•˜°ì(€€€€¸¸¹É•Ù¥•Ü°(€€€ÍÑ…ÑÕÌè€‰Á•¹‘¥¹}É•Ù¥•Üˆ°(€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€ô¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑA•¹‘¥¹I•Ù¥•ÝÌ ¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑA•¹‘¥¹I•Ù¥•ÝÌ ¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì¡ÅÕ•Éä¡É•Ù¥•ÝÍI•˜°Ý¡•É” ‰ÍÑ…ÑÕÌˆ°€ˆôôˆ°€‰Á•¹‘¥¹}É•Ù¥•Üˆ¤¤¤ì(€É•ÑÕÉ¸Í½ÉÑ	åÉ•…Ñ•‘Ñ•ÍŒ (€€€Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñMÕÁÁ±¥•ÉI•Ù¥•Üø¡¥Ñ•´¤¤°(€€€€ÄÀÀ°(€€¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸µ½‘•É…Ñ•I•Ù¥•Ü¡É•Ù¥•ÜèMÕÁÁ±¥•ÉI•Ù¥•Ü°…Ñ½É%èÍÑÉ¥¹œ°‘•¥Í¥½¸è€‰…ÁÁÉ½Ù•ˆð€‰É•©•Ñ•ˆ¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½5½‘•É…Ñ•I•Ù¥•Ü¡É•Ù¥•Ü°…Ñ½É%°‘•¥Í¥½¸¤ì(€ô(€½¹ÍÐÉ•Ù¥•Ý½Œ€ô‘½Œ¡É•Ù¥•ÝÍI•˜°É•Ù¥•Ü¹¥¤ì(€½¹ÍÐÍÕÁÁ±¥•É½Œ€ô‘½Œ¡ÍÕÁÁ±¥•ÉÍI•˜°É•Ù¥•Ü¹ÍÕÁÁ±¥•É%¤ì(€½¹ÍÐÕÍ•É½I•˜€ô‘½Œ¡ÕÍ•ÉÍI•˜°É•Ù¥•Ü¹É•Ù¥•Ý•‘	ä¤ì(€½¹ÍÐÍ•ÑÑ¥¹Ì€ô…Ý…¥Ð•ÑA±…Ñ™½ÉµM•ÑÑ¥¹Ì ¤ì((€…Ý…¥ÐÉÕ¹QÉ…¹Í…Ñ¥½¸¡‘ˆ°…Íå¹Œ€¡ÑÉ…¹Í…Ñ¥½¸¤€ôøì(€€€½¹ÍÐÍÕÁÁ±¥•ÉM¹…ÁÍ¡½Ð€ô…Ý…¥ÐÑÉ…¹Í…Ñ¥½¸¹•Ð¡ÍÕÁÁ±¥•É½Œ¤ì(€€€½¹ÍÐÕÍ•ÉM¹…ÁÍ¡½Ð€ô…Ý…¥ÐÑÉ…¹Í…Ñ¥½¸¹•Ð¡ÕÍ•É½I•˜¤ì(€€€½¹ÍÐÍÕÁÁ±¥•È€ôÍÕÁÁ±¥•ÉM¹…ÁÍ¡½Ð¹•á¥ÍÑÌ ¤€ü€¡ÍÕÁÁ±¥•ÉM¹…ÁÍ¡½Ð¹‘…Ñ„ ¤…ÌMÕÁÁ±¥•È¤€è¹Õ±°ì(€€€½¹ÍÐÕÍ•È€ôÕÍ•ÉM¹…ÁÍ¡½Ð¹•á¥ÍÑÌ ¤€ü€¡ÕÍ•ÉM¹…ÁÍ¡½Ð¹‘…Ñ„ ¤…ÌÁÁUÍ•È¤€è¹Õ±°ì((€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡É•Ù¥•Ý½Œ°ì(€€€€€ÍÑ…ÑÕÌè‘•¥Í¥½¸°(€€€€€…ÁÁÉ½Ù•‘Ðè‘•¥Í¥½¸€ôôô€‰…ÁÁÉ½Ù•ˆ€üÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤€è¹Õ±°°(€€€ô¤ì((€€€¥˜€¡‘•¥Í¥½¸€ôôô€‰…ÁÁÉ½Ù•ˆ€˜˜ÍÕÁÁ±¥•È¤ì(€€€€€½¹ÍÐ½Õ¹Ð€ôÍÕÁÁ±¥•È¹É•Ù¥•Ý½Õ¹Ðñð€Àì(€€€€€½¹ÍÐ…Ù•É…•I…Ñ¥¹œ€ô9Õµ‰•È   ¡ÍÕÁÁ±¥•È¹…Ù•É…•I…Ñ¥¹œñð€À¤€¨½Õ¹Ð€¬É•Ù¥•Ü¹½Ù•É…±°¤€¼€¡½Õ¹Ð€¬€Ä¤¤¹Ñ½¥á• È¤¤ì(€€€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡ÍÕÁÁ±¥•É½Œ°ì(€€€€€€€É•Ù¥•Ý½Õ¹Ðè½Õ¹Ð€¬€Ä°(€€€€€€€…Ù•É…•I…Ñ¥¹œ°(€€€€€€€ÕÁ‘…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€ô¤ì(€€€ô((€€€¥˜€¡‘•¥Í¥½¸€ôôô€‰…ÁÁÉ½Ù•ˆ€˜˜ÕÍ•È¤ì(€€€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡ÕÍ•É½I•˜°ì(€€€€€€€…ÁÁÉ½Ù•‘I•Ù¥•ÝÌè€¡ÕÍ•È¹…ÁÁÉ½Ù•‘I•Ù¥•ÝÌñð€À¤€¬€Ä°(€€€€€€€Á½¥¹ÑÌè€¡ÕÍ•È¹Á½¥¹ÑÌñð€À¤€¬€¡Í•ÑÑ¥¹Ì¹É•Ù¥•ÝÍ…É¹	½¹ÕÍA½¥¹ÑÌ€ü€Ð€è€À¤°(€€€€€€€ÕÁ‘…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€ô¤ì(€€€ô((€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡‘½Œ¡…Õ‘¥Ñ1½ÍI•˜¤°ì(€€€€€…Ñ½É%°(€€€€€…Ñ¥½¸èÉ•Ù¥•Ü¸‘í‘•¥Í¥½¹õ€°(€€€€€Ñ…É•ÑQåÁ”è€‰É•Ù¥•Üˆ°(€€€€€Ñ…É•Ñ%èÉ•Ù¥•Ü¹¥°(€€€€€‘•Ñ…¥±ÌèìÍÕÁÁ±¥•É%èÉ•Ù¥•Ü¹ÍÕÁÁ±¥•É%ô°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ôÍ…Ñ¥Í™¥•Ì=µ¥ÐñÕ‘¥Ñ1½œ°€‰¥ˆø¤ì(€ô¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑÕ‘¥Ñ1½Ì ¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑÕ‘¥Ñ1½Ì ¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì¡ÅÕ•Éä¡…Õ‘¥Ñ1½ÍI•˜°½É‘•É	ä ‰É•…Ñ•‘Ðˆ°€‰‘•ÍŒˆ¤°±¥µ¥Ð ÄÀÀ¤¤¤ì(€É•ÑÕÉ¸Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñÕ‘¥Ñ1½œø¡¥Ñ•´¤¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑ•ÍÍÉ•‘¥ÑÌ¡ÕÍ•É%èÍÑÉ¥¹œ¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑ•ÍÍÉ•‘¥ÑÌ¡ÕÍ•É%¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì¡ÅÕ•Éä¡…•ÍÍÉ•‘¥ÑÍI•˜°Ý¡•É” ‰ÕÍ•É%ˆ°€ˆôôˆ°ÕÍ•É%¤¤¤ì(€É•ÑÕÉ¸Í½ÉÑ	åÉ•…Ñ•‘Ñ•ÍŒ (€€€Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñ•ÍÍÉ•‘¥Ðø¡¥Ñ•´¤¤°(€€€€ÔÀ°(€€¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸ÍÕ‰µ¥ÑMÕÁÁ±¥•É••‘‰…¬ (€ÕÍ•É%èÍÑÉ¥¹œ°(€ÍÕÁÁ±¥•ÈèA¥¬ñMÕÁÁ±¥•È°€‰¥ˆð€‰‘¥ÍÁ±…å9…µ”ˆð€‰¹…µ•=É¥¥¹…°ˆð€‰¹…µ•Èˆð€‰¹…µ•¸ˆø°(€ÑåÁ”èMÕÁÁ±¥•É••‘‰…­QåÁ”°(€µ•ÍÍ…”èÍÑÉ¥¹œ°(€ÍÕ•ÍÑ•‘½ÉÉ•Ñ¥½¸èÍÑÉ¥¹œ°(¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½MÕ‰µ¥ÑMÕÁÁ±¥•É••‘‰…¬¡ÕÍ•É%°ÍÕÁÁ±¥•È°ÑåÁ”°µ•ÍÍ…”°ÍÕ•ÍÑ•‘½ÉÉ•Ñ¥½¸¤ì(€ô(€…Ý…¥Ð…‘‘½Œ¡ÍÕÁÁ±¥•É••‘‰…­I•˜°ì(€€€ÍÕÁÁ±¥•É%èÍÕÁÁ±¥•È¹¥°(€€€ÍÕÁÁ±¥•É9…µ”èÍÕÁÁ±¥•È¹‘¥ÍÁ±…å9…µ”ñðÍÕÁÁ±¥•È¹¹…µ•=É¥¥¹…°°(€€€ÍÕÁÁ±¥•É9…µ•ÈèÍÕÁÁ±¥•È¹¹…µ•Èñð€ˆˆ°(€€€ÍÕÁÁ±¥•É9…µ•¸èÍÕÁÁ±¥•È¹¹…µ•¸ñð€ˆˆ°(€€€ÍÕ‰µ¥ÑÑ•‘	äèÕÍ•É%°(€€€ÑåÁ”°(€€€µ•ÍÍ…”èµ•ÍÍ…”¹ÑÉ¥´ ¤°(€€€ÍÕ•ÍÑ•‘½ÉÉ•Ñ¥½¸èÍÕ•ÍÑ•‘½ÉÉ•Ñ¥½¸¹ÑÉ¥´ ¤°(€€€ÍÑ…ÑÕÌè€‰Á•¹‘¥¹œˆ°(€€€…‘µ¥¹9½Ñ•Ìè€ˆˆ°(€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€ôÍ…Ñ¥Í™¥•Ì=µ¥ÐñMÕÁÁ±¥•É••‘‰…¬°€‰¥ˆð€‰É•…Ñ•‘Ðˆø€˜ìÉ•…Ñ•‘ÐèÕ¹­¹½Ý¸ô¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑ5åMÕÁÁ±¥•É••‘‰…¬¡ÕÍ•É%èÍÑÉ¥¹œ¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑ5åMÕÁÁ±¥•É••‘‰…¬¡ÕÍ•É%¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì¡ÅÕ•Éä¡ÍÕÁÁ±¥•É••‘‰…­I•˜°Ý¡•É” ‰ÍÕ‰µ¥ÑÑ•‘	äˆ°€ˆôôˆ°ÕÍ•É%¤¤¤ì(€É•ÑÕÉ¸Í½ÉÑ	åÉ•…Ñ•‘Ñ•ÍŒ (€€€Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñMÕÁÁ±¥•É••‘‰…¬ø¡¥Ñ•´¤¤°(€€€€ÄÀÀ°(€€¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑMÕÁÁ±¥•É••‘‰…¬ (€ÍÑ…ÑÕÍ•ÌèMÕÁÁ±¥•É••‘‰…­MÑ…ÑÕÍmt€ôl‰Á•¹‘¥¹œˆ°€‰¥¹}É•Ù¥•Ü‰t°(¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½1¥ÍÑMÕÁÁ±¥•É••‘‰…¬¡ÍÑ…ÑÕÍ•Ì¤ì(€ô(€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô…Ý…¥Ð•Ñ½Ì (€€€ÍÑ…ÑÕÍ•Ì¹±•¹Ñ €ôôô€Ä(€€€€€€üÅÕ•Éä¡ÍÕÁÁ±¥•É••‘‰…­I•˜°Ý¡•É” ‰ÍÑ…ÑÕÌˆ°€ˆôôˆ°ÍÑ…ÑÕÍ•ÍlÁt¤¤(€€€€€€èÅÕ•Éä¡ÍÕÁÁ±¥•É••‘‰…­I•˜°Ý¡•É” ‰ÍÑ…ÑÕÌˆ°€‰¥¸ˆ°ÍÑ…ÑÕÍ•Ì¤¤°(€€¤ì(€É•ÑÕÉ¸Í½ÉÑ	åÉ•…Ñ•‘Ñ•ÍŒ (€€€Í¹…ÁÍ¡½Ð¹‘½Ì¹µ…À ¡¥Ñ•´¤€ôøÝ¥Ñ¡%ñMÕÁÁ±¥•É••‘‰…¬ø¡¥Ñ•´¤¤°(€€€€ÄÀÀ°(€€¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸ÕÁ‘…Ñ•MÕÁÁ±¥•É••‘‰…­MÑ…ÑÕÌ (€™••‘‰…¬èMÕÁÁ±¥•É••‘‰…¬°(€…Ñ½É%èÍÑÉ¥¹œ°(€ÍÑ…ÑÕÌèá±Õ‘”ñMÕÁÁ±¥•É••‘‰…­MÑ…ÑÕÌ°€‰Á•¹‘¥¹œˆø°(€…‘µ¥¹9½Ñ•ÌèÍÑÉ¥¹œ°(¤ì(€¥˜€ …¥Í¥É•‰…Í•½¹™¥ÕÉ•¤ì(€€€É•ÑÕÉ¸‘•µ¼¹‘•µ½UÁ‘…Ñ•MÕÁÁ±¥•É••‘‰…­MÑ…ÑÕÌ¡™••‘‰…¬°…Ñ½É%°ÍÑ…ÑÕÌ°…‘µ¥¹9½Ñ•Ì¤ì(€ô(€½¹ÍÐ™••‘‰…­½Œ€ô‘½Œ¡ÍÕÁÁ±¥•É••‘‰…­I•˜°™••‘‰…¬¹¥¤ì(€…Ý…¥ÐÉÕ¹QÉ…¹Í…Ñ¥½¸¡‘ˆ°…Íå¹Œ€¡ÑÉ…¹Í…Ñ¥½¸¤€ôøì(€€€ÑÉ…¹Í…Ñ¥½¸¹ÕÁ‘…Ñ”¡™••‘‰…­½Œ°ì(€€€€€ÍÑ…ÑÕÌ°(€€€€€…‘µ¥¹9½Ñ•Ìè…‘µ¥¹9½Ñ•Ì¹ÑÉ¥´ ¤°(€€€€€É•Ù¥•Ý•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€€€É•Ù¥•Ý•‘	äè…Ñ½É%°(€€€ô¤ì(€€€ÑÉ…¹Í…Ñ¥½¸¹Í•Ð¡‘½Œ¡…Õ‘¥Ñ1½ÍI•˜¤°ì(€€€€€…Ñ½É%°(€€€€€…Ñ¥½¸èÍÕÁÁ±¥•É}™••‘‰…¬¸‘íÍÑ…ÑÕÍõ€°(€€€€€Ñ…É•ÑQåÁ”è€‰ÍÕÁÁ±¥•É••‘‰…¬ˆ°(€€€€€Ñ…É•Ñ%è™••‘‰…¬¹¥°(€€€€€‘•Ñ…¥±Ìèì(€€€€€€€ÍÕÁÁ±¥•É%è™••‘‰…¬¹ÍÕÁÁ±¥•É%°(€€€€€€€™••‘‰…­QåÁ”è™••‘‰…¬¹ÑåÁ”°(€€€€€ô°(€€€€€É•…Ñ•‘ÐèÍ•ÉÙ•ÉQ¥µ•ÍÑ…µÀ ¤°(€€€ôÍ…Ñ¥Í™¥•Ì=µ¥ÐñÕ‘¥Ñ1½œ°€‰¥ˆø¤ì(€ô¤ì)ô(((