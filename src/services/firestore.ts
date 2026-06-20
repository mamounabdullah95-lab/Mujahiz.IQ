import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
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
import type {
  AccessCredit,
  AppUser,
  AuditLog,
  DuplicateCheck,
  PlatformSettings,
  Supplier,
  SupplierDraft,
  SupplierDuplicateIndex,
  SupplierReview,
  SupplierSubmission,
  SupplierSubmissionStatus,
  TimestampLike,
} from "../types/domain";
import { addDays, maxDate, toDate } from "../utils/date";
import { calculateAccessGrant, deriveBadges, qualityRatio } from "../utils/scoring";
import { normalizeEmail, normalizeUrl } from "../utils/normalization";

const usersRef = collection(db, "users");
const suppliersRef = collection(db, "suppliers");
const submissionsRef = collection(db, "supplierSubmissions");
const reviewsRef = collection(db, "reviews");
const duplicateIndexRef = collection(db, "supplierDuplicateIndex");
const settingsRef = collection(db, "settings");
const categoriesRef = collection(db, "categories");
const accessCreditsRef = collection(db, "accessCredits");
const contributionLogsRef = collection(db, "contributionLogs");
const auditLogsRef = collection(db, "auditLogs");

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

export async function createUserProfile(
  uid: string,
  email: string,
  profile: Pick<AppUser, "fullName" | "phone" | "jobTitle" | "organization" | "governorate" | "sector"> &
    Partial<Pick<AppUser, "city" | "reasonForJoining" | "language">>,
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
  const batch = writeBatch(db);
  const patch: Partial<AppUser> = {
    role,
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "suspended") {
    patch.accessStatus = "suspended";
  }
  batch.update(doc(usersRef, userId), patch);
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
  await addDoc(submissionsRef, {
    submittedBy: userId,
    submissionStatus: duplicateCheck.hasPossibleDuplicate ? "possible_duplicate" : "pending_review",
    supplierData: draft,
    duplicateCheck: {
      ...duplicateCheck,
      checkedAt: serverTimestamp(),
    },
    countsForAccess: false,
    creditConsumed: false,
    createdAt: serverTimestamp(),
  } satisfies Omit<SupplierSubmission, "id" | "createdAt"> & { createdAt: unknown });
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
      supplierData: draft,
      duplicateCheck: {
        ...duplicateCheck,
        checkedAt: serverTimestamp(),
      },
      reviewedAt: null,
      countsForAccess: false,
      creditConsumed: false,
    });
    transaction.set(auditDoc, {
      actorId: userId,
      action: "supplier_submission.resubmitted",
      targetType: "supplierSubmission",
      targetId: submissionId,
      details: {},
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
}

export async function listMySubmissions(userId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoListMySubmissions(userId);
  }
  const snapshot = await getDocs(query(submissionsRef, where("submittedBy", "==", userId)));
  return sortByCreatedAtDesc(
    snapshot.docs.map((item) => withId<SupplierSubmission>(item)),
    100,
  );
}

export async function listSupplierSubmissions(statuses: SupplierSubmissionStatus[] = ["pending_review", "possible_duplicate"]) {
  if (!isFirebaseConfigured) {
    return demo.demoListSupplierSubmissions(statuses);
  }
  const snapshot = await getDocs(query(submissionsRef, where("submissionStatus", "in", statuses)));
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
  const snapshot = await getDocs(query(suppliersRef, where("status", "==", "approved"), limit(250)));
  return snapshot.docs.map((item) => withId<Supplier>(item));
}

export async function getSupplier(supplierId: string) {
  if (!isFirebaseConfigured) {
    return demo.demoGetSupplier(supplierId);
  }
  const snapshot = await getDoc(doc(suppliersRef, supplierId));
  return snapshot.exists() ? withId<Supplier>(snapshot) : null;
}

export async function approveSupplierSubmission(
  submission: SupplierSubmission,
  actorId: string,
  settings: PlatformSettings,
  editedSupplierData?: SupplierDraft,
) {
  if (!isFirebaseConfigured) {
    return demo.demoApproveSupplierSubmission(submission, actorId, settings, editedSupplierData);
  }
  const supplierData = editedSupplierData || submission.supplierData;
  const supplierDoc = doc(suppliersRef);
  const submissionDoc = doc(submissionsRef, submission.id);
  const userDocRef = doc(usersRef, submission.submittedBy);
  const duplicateDoc = doc(duplicateIndexRef, supplierDoc.id);
  const accessCreditDoc = doc(accessCreditsRef);
  const contributionLogDoc = doc(contributionLogsRef);
  const auditDoc = doc(auditLogsRef);

  await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userDocRef);
    if (!userSnapshot.exists()) {
      throw new Error("Contributor profile was not found.");
    }

    const user = userSnapshot.data() as AppUser;
    const approvedSubmissions = (user.approvedSubmissions || 0) + 1;
    const rejectedSubmissions = user.rejectedSubmissions || 0;
    const duplicateSubmissions = user.duplicateSubmissions || 0;
    const approvedNewSupplierContributions = (user.approvedNewSupplierContributions || 0) + 1;
    const previewUser = {
      ...user,
      approvedSubmissions,
      rejectedSubmissions,
      duplicateSubmissions,
      approvedNewSupplierContributions,
    };
    const accessGrant = calculateAccessGrant(previewUser, settings);
    const existingAccessDate = toDate(user.accessExpiresAt);
    const now = new Date();
    const baseAccessDate = existingAccessDate ? maxDate(now, existingAccessDate) : now;
    const maxStackDate = addDays(now, settings.maximumStackableMonths * settings.daysGrantedPerBatch);
    let daysToGrant = accessGrant.daysToGrant;
    let consumedForAccess = accessGrant.consumed;
    if (daysToGrant > 0 && addDays(baseAccessDate, daysToGrant).getTime() > maxStackDate.getTime()) {
      const allowedDays = Math.max(0, Math.floor((maxStackDate.getTime() - baseAccessDate.getTime()) / 86_400_000));
      const allowedMonths = Math.floor(allowedDays / settings.daysGrantedPerBatch);
      daysToGrant = allowedMonths * settings.daysGrantedPerBatch;
      consumedForAccess = allowedMonths * settings.requiredApprovedSuppliersPerMonth;
    }
    const newAccessExpiresAt =
      daysToGrant > 0 ? addDays(baseAccessDate, daysToGrant) : user.accessExpiresAt || null;
    const nextQualityRatio = qualityRatio(approvedSubmissions, rejectedSubmissions, duplicateSubmissions);
    const nextBadges = deriveBadges({
      ...previewUser,
      qualityRatio: nextQualityRatio,
      badges: user.badges || [],
      approvedReviews: user.approvedReviews || 0,
    });

    transaction.set(supplierDoc, {
      ...supplierData,
      id: supplierDoc.id,
      status: "approved",
      verificationStatus: "community_submitted",
      sourceSummary: supplierData.sourceNote || supplierData.sourceType,
      averageRating: 0,
      reviewCount: 0,
      createdBy: submission.submittedBy,
      approvedBy: actorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies Supplier);

    transaction.set(duplicateDoc, {
      supplierId: supplierDoc.id,
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
    } satisfies SupplierDuplicateIndex);

    transaction.update(submissionDoc, {
      submissionStatus: "approved",
      adminDecision: "approved",
      countsForAccess: true,
      creditConsumed: consumedForAccess > 0,
      reviewedAt: serverTimestamp(),
      adminNotes: "",
    });

    transaction.update(userDocRef, {
      approvedSubmissions,
      approvedNewSupplierContributions,
      consumedApprovedSupplierContributions:
        (user.consumedApprovedSupplierContributions || 0) + consumedForAccess,
      accessStatus: daysToGrant > 0 || (existingAccessDate && existingAccessDate > now) ? "active" : user.accessStatus,
      accessExpiresAt: newAccessExpiresAt,
      points: (user.points || 0) + 10 + (supplierData.phones.length || supplierData.email ? 2 : 0) + (supplierData.categories.length && supplierData.capabilityTags.length ? 2 : 0),
      qualityRatio: nextQualityRatio,
      badges: nextBadges,
      updatedAt: serverTimestamp(),
    });

    transaction.set(contributionLogDoc, {
      userId: submission.submittedBy,
      type: "new_supplier",
      supplierSubmissionId: submission.id,
      supplierId: supplierDoc.id,
      points: 10,
      countsForAccess: true,
      createdAt: serverTimestamp(),
    });

    if (daysToGrant > 0) {
      transaction.set(accessCreditDoc, {
        userId: submission.submittedBy,
        source: "supplier_contribution",
        approvedSupplierCount: consumedForAccess,
        daysGranted: daysToGrant,
        status: "applied",
        createdAt: serverTimestamp(),
        appliedAt: serverTimestamp(),
      } satisfies Omit<AccessCredit, "id">);
    }

    transaction.set(auditDoc, {
      actorId,
      action: "supplier_submission.approved",
      targetType: "supplierSubmission",
      targetId: submission.id,
      details: {
        supplierId: supplierDoc.id,
        contributorId: submission.submittedBy,
        daysGranted: daysToGrant,
      },
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
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
  const userRef = doc(usersRef, submission.submittedBy);
  const submissionRef = doc(submissionsRef, submission.id);
  await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const user = userSnapshot.exists() ? (userSnapshot.data() as AppUser) : null;
    const rejectedSubmissions = decision === "rejected" ? (user?.rejectedSubmissions || 0) + 1 : user?.rejectedSubmissions || 0;
    const duplicateSubmissions =
      decision === "possible_duplicate" || decision === "merged"
        ? (user?.duplicateSubmissions || 0) + 1
        : user?.duplicateSubmissions || 0;
    const approvedSubmissions = user?.approvedSubmissions || 0;

    transaction.update(submissionRef, {
      submissionStatus: decision,
      adminDecision: decision,
      adminNotes,
      countsForAccess: false,
      creditConsumed: false,
      reviewedAt: serverTimestamp(),
    });

    if (user) {
      transaction.update(userRef, {
        rejectedSubmissions,
        duplicateSubmissions,
        points: decision === "rejected" ? Math.max(0, (user.points || 0) - 2) : user.points || 0,
        qualityRatio: qualityRatio(approvedSubmissions, rejectedSubmissions, duplicateSubmissions),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(doc(auditLogsRef), {
      actorId,
      action: `supplier_submission.${decision}`,
      targetType: "supplierSubmission",
      targetId: submission.id,
      details: { adminNotes },
      createdAt: serverTimestamp(),
    } satisfies Omit<AuditLog, "id">);
  });
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
  const snapshot = await getDocs(query(reviewsRef, where("status", "==", "pending_review")));
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

export async function listAuditLogs() {
  if (!isFirebaseConfigured) {
    return demo.demoListAuditLogs();
  }
  const snapshot = await getDocs(query(auditLogsRef, orderBy("createdAt", "desc"), limit(100)));
  return snapshot.docs.map((item) => withId<AuditLog>(item));
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
