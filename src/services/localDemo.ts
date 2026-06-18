import { defaultSettings } from "../data/constants";
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
  UserRole,
  UserStatus,
} from "../types/domain";
import { addDays, maxDate, toDate } from "../utils/date";
import { normalizeEmail, normalizeUrl } from "../utils/normalization";
import { calculateAccessGrant, deriveBadges, qualityRatio } from "../utils/scoring";

const dbKey = "mujahiz-iq-demo-db";
const sessionKey = "mujahiz-iq-demo-session";

interface DemoDb {
  users: AppUser[];
  credentials: Array<{ uid: string; email: string; password: string }>;
  suppliers: Supplier[];
  submissions: SupplierSubmission[];
  reviews: SupplierReview[];
  accessCredits: AccessCredit[];
  contributionLogs: unknown[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
}

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function readDb(): DemoDb {
  const raw = localStorage.getItem(dbKey);
  if (raw) {
    const parsed = JSON.parse(raw) as DemoDb;
    return {
      ...parsed,
      settings: { ...defaultSettings, ...parsed.settings },
    };
  }
  return {
    users: [],
    credentials: [],
    suppliers: [],
    submissions: [],
    reviews: [],
    accessCredits: [],
    contributionLogs: [],
    auditLogs: [],
    settings: defaultSettings,
  };
}

function writeDb(db: DemoDb) {
  localStorage.setItem(dbKey, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("mujahiz-iq-demo-db-updated"));
}

function withoutPassword<T extends { password?: string }>(value: T) {
  const copy = { ...value };
  delete copy.password;
  return copy;
}

export function demoCurrentUid() {
  return localStorage.getItem(sessionKey);
}

export function demoSetSession(uid: string) {
  localStorage.setItem(sessionKey, uid);
}

export function demoClearSession() {
  localStorage.removeItem(sessionKey);
}

export async function demoRegister(
  email: string,
  password: string,
  profile: Pick<AppUser, "fullName" | "phone" | "jobTitle" | "organization" | "governorate" | "sector"> &
    Partial<Pick<AppUser, "city" | "reasonForJoining" | "language">>,
) {
  const db = readDb();
  if (db.credentials.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("This email is already registered in demo mode.");
  }
  const firstUser = db.users.length === 0;
  const trialDays = db.settings.trialAccessDays || defaultSettings.trialAccessDays;
  const uid = id("user");
  const user: AppUser = {
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
    role: firstUser ? "owner" : "contributor",
    status: "approved",
    accessStatus: firstUser ? "active" : "temporary",
    accessExpiresAt: addDays(new Date(), firstUser ? 365 : trialDays).toISOString(),
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
    badges: firstUser ? ["trusted_contributor"] : [],
    language: profile.language || "en",
    createdAt: now(),
    updatedAt: now(),
  };
  db.users.push(user);
  db.credentials.push({ uid, email, password });
  if (!firstUser) {
    db.accessCredits.push({
      id: id("credit"),
      userId: uid,
      source: "trial_access",
      approvedSupplierCount: 0,
      daysGranted: trialDays,
      status: "applied",
      createdAt: now(),
      appliedAt: now(),
    });
  }
  db.auditLogs.push({
    id: id("audit"),
    actorId: uid,
    action: "demo.user_registered",
    targetType: "user",
    targetId: uid,
    details: { firstUser, trialDays: firstUser ? 365 : trialDays },
    createdAt: now(),
  });
  writeDb(db);
  demoSetSession(uid);
  return user;
}

export async function demoLogin(email: string, password: string) {
  const db = readDb();
  const credential = db.credentials.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
  );
  if (!credential) {
    throw new Error("Invalid demo email or password.");
  }
  demoSetSession(credential.uid);
  const user = db.users.find((item) => item.uid === credential.uid);
  if (!user) {
    throw new Error("Demo user was not found.");
  }
  const hasTrialCredit = db.accessCredits.some((credit) => credit.userId === user.uid && credit.source === "trial_access");
  if (!hasTrialCredit && !toDate(user.accessExpiresAt)) {
    const trialDays = db.settings.trialAccessDays || defaultSettings.trialAccessDays;
    user.status = "approved";
    user.accessStatus = "temporary";
    user.accessExpiresAt = addDays(new Date(), trialDays).toISOString();
    user.updatedAt = now();
    db.accessCredits.push({
      id: id("credit"),
      userId: user.uid,
      source: "trial_access",
      approvedSupplierCount: 0,
      daysGranted: trialDays,
      status: "applied",
      createdAt: now(),
      appliedAt: now(),
    });
    writeDb(db);
  }
  return user;
}

export async function demoGetCurrentUser() {
  const uid = demoCurrentUid();
  if (!uid) return null;
  return demoGetUserProfile(uid);
}

export async function demoGetUserProfile(uid: string) {
  return readDb().users.find((item) => item.uid === uid) || null;
}

export async function demoUpdateUserProfile(uid: string, patch: Partial<AppUser>) {
  const db = readDb();
  db.users = db.users.map((user) => (user.uid === uid ? { ...user, ...patch, updatedAt: now() } : user));
  writeDb(db);
}

export async function demoListUsers(status?: AppUser["status"]) {
  const users = readDb().users;
  return status ? users.filter((user) => user.status === status) : users;
}

export async function demoApproveUser(userId: string, actorId: string) {
  const db = readDb();
  db.users = db.users.map((user) => (user.uid === userId ? { ...user, status: "approved", updatedAt: now() } : user));
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: "user.approved",
    targetType: "user",
    targetId: userId,
    details: {},
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoSetUserRoleAndStatus(userId: string, actorId: string, role: UserRole, status: UserStatus) {
  const db = readDb();
  db.users = db.users.map((user) => (user.uid === userId ? { ...user, role, status, updatedAt: now() } : user));
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: "user.role_status_updated",
    targetType: "user",
    targetId: userId,
    details: { role, status },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoGrantTemporaryAccess(userId: string, actorId: string, days: number) {
  const db = readDb();
  const user = db.users.find((item) => item.uid === userId);
  if (!user) throw new Error("Demo user was not found.");
  const base = toDate(user.accessExpiresAt);
  const expiresAt = addDays(base ? maxDate(new Date(), base) : new Date(), days).toISOString();
  user.accessStatus = "temporary";
  user.accessExpiresAt = expiresAt;
  user.updatedAt = now();
  db.accessCredits.push({
    id: id("credit"),
    userId,
    source: "manual_grace",
    approvedSupplierCount: 0,
    daysGranted: days,
    status: "applied",
    createdAt: now(),
    appliedAt: now(),
  });
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: "access.temporary_granted",
    targetType: "user",
    targetId: userId,
    details: { days },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoGetPlatformSettings() {
  return { ...defaultSettings, ...readDb().settings };
}

export async function demoSavePlatformSettings(settings: PlatformSettings, actorId: string) {
  const db = readDb();
  db.settings = settings;
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: "settings.updated",
    targetType: "settings",
    targetId: "platform",
    details: { settings },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoSeedDefaultLists(actorId: string) {
  const db = readDb();
  db.settings = { ...defaultSettings, ...db.settings };
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: "seed.defaults",
    targetType: "settings",
    targetId: "platform",
    details: { mode: "demo" },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoFetchDuplicateIndexes(): Promise<SupplierDuplicateIndex[]> {
  return readDb().suppliers.map((supplier) => ({
    supplierId: supplier.id,
    supplierName: supplier.displayName || supplier.nameOriginal,
    normalizedName: supplier.normalizedName,
    normalizedPhones: supplier.normalizedPhones,
    normalizedEmail: normalizeEmail(supplier.email),
    website: normalizeUrl(supplier.website),
    facebook: normalizeUrl(supplier.facebook),
    contactPerson: supplier.contactPerson || "",
    governorate: supplier.governorate,
    categories: supplier.categories,
  }));
}

export async function demoSubmitSupplierDraft(userId: string, draft: SupplierDraft, duplicateCheck: DuplicateCheck) {
  const db = readDb();
  db.submissions.push({
    id: id("submission"),
    submittedBy: userId,
    submissionStatus: duplicateCheck.hasPossibleDuplicate ? "possible_duplicate" : "pending_review",
    supplierData: draft,
    duplicateCheck: { ...duplicateCheck, checkedAt: now() },
    countsForAccess: false,
    creditConsumed: false,
    createdAt: now(),
  });
  db.users = db.users.map((user) =>
    user.uid === userId ? { ...user, totalSubmissions: (user.totalSubmissions || 0) + 1, updatedAt: now() } : user,
  );
  writeDb(db);
}

export async function demoResubmitSupplierSubmission(
  submissionId: string,
  userId: string,
  draft: SupplierDraft,
  duplicateCheck: DuplicateCheck,
) {
  const db = readDb();
  const submission = db.submissions.find((item) => item.id === submissionId);
  if (!submission) {
    throw new Error("supplierSubmissionNotFound");
  }
  if (submission.submittedBy !== userId || submission.submissionStatus !== "needs_correction") {
    throw new Error("supplierSubmissionCannotEdit");
  }
  Object.assign(submission, {
    submissionStatus: duplicateCheck.hasPossibleDuplicate ? "possible_duplicate" : "pending_review",
    adminDecision: "resubmitted",
    adminNotes: "",
    supplierData: draft,
    duplicateCheck: { ...duplicateCheck, checkedAt: now() },
    reviewedAt: undefined,
    countsForAccess: false,
    creditConsumed: false,
  });
  db.auditLogs.push({
    id: id("audit"),
    actorId: userId,
    action: "supplier_submission.resubmitted",
    targetType: "supplierSubmission",
    targetId: submissionId,
    details: {},
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoListMySubmissions(userId: string) {
  return readDb()
    .submissions.filter((item) => item.submittedBy === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function demoListSupplierSubmissions(statuses: SupplierSubmissionStatus[] = ["pending_review", "possible_duplicate"]) {
  return readDb()
    .submissions.filter((item) => statuses.includes(item.submissionStatus))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function demoGetSupplierSubmission(submissionId: string) {
  return readDb().submissions.find((item) => item.id === submissionId) || null;
}

export async function demoListSuppliers() {
  return readDb().suppliers.filter((supplier) => supplier.status === "approved");
}

export async function demoGetSupplier(supplierId: string) {
  return readDb().suppliers.find((supplier) => supplier.id === supplierId) || null;
}

export async function demoApproveSupplierSubmission(
  submission: SupplierSubmission,
  actorId: string,
  settings: PlatformSettings,
  editedSupplierData?: SupplierDraft,
) {
  const db = readDb();
  const supplierData = editedSupplierData || submission.supplierData;
  const supplierId = id("supplier");
  const user = db.users.find((item) => item.uid === submission.submittedBy);
  if (!user) throw new Error("Demo contributor was not found.");

  const approvedSubmissions = (user.approvedSubmissions || 0) + 1;
  const approvedNewSupplierContributions = (user.approvedNewSupplierContributions || 0) + 1;
  const accessGrant = calculateAccessGrant(
    { ...user, approvedNewSupplierContributions },
    settings,
  );
  const base = toDate(user.accessExpiresAt);
  const expiresAt = accessGrant.daysToGrant
    ? addDays(base ? maxDate(new Date(), base) : new Date(), accessGrant.daysToGrant).toISOString()
    : user.accessExpiresAt;
  const nextQualityRatio = qualityRatio(approvedSubmissions, user.rejectedSubmissions || 0, user.duplicateSubmissions || 0);

  db.suppliers.push({
    ...supplierData,
    id: supplierId,
    status: "approved",
    verificationStatus: "community_submitted",
    sourceSummary: supplierData.sourceNote || supplierData.sourceType,
    averageRating: 0,
    reviewCount: 0,
    createdBy: submission.submittedBy,
    approvedBy: actorId,
    createdAt: now(),
    updatedAt: now(),
  });

  db.submissions = db.submissions.map((item) =>
    item.id === submission.id
      ? {
          ...item,
          submissionStatus: "approved",
          adminDecision: "approved",
          countsForAccess: true,
          creditConsumed: accessGrant.consumed > 0,
          reviewedAt: now(),
        }
      : item,
  );

  Object.assign(user, {
    approvedSubmissions,
    approvedNewSupplierContributions,
    consumedApprovedSupplierContributions: (user.consumedApprovedSupplierContributions || 0) + accessGrant.consumed,
    accessStatus: accessGrant.daysToGrant > 0 ? "active" : user.accessStatus,
    accessExpiresAt: expiresAt,
    points:
      (user.points || 0) +
      10 +
      (supplierData.phones.length || supplierData.email ? 2 : 0) +
      (supplierData.categories.length && supplierData.capabilityTags.length ? 2 : 0),
    qualityRatio: nextQualityRatio,
    badges: deriveBadges({
      ...user,
      approvedSubmissions,
      qualityRatio: nextQualityRatio,
      approvedReviews: user.approvedReviews || 0,
      badges: user.badges || [],
    }),
    updatedAt: now(),
  });

  if (accessGrant.daysToGrant > 0) {
    db.accessCredits.push({
      id: id("credit"),
      userId: submission.submittedBy,
      source: "supplier_contribution",
      approvedSupplierCount: accessGrant.consumed,
      daysGranted: accessGrant.daysToGrant,
      status: "applied",
      createdAt: now(),
      appliedAt: now(),
    });
  }

  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: "supplier_submission.approved",
    targetType: "supplierSubmission",
    targetId: submission.id,
    details: { supplierId, daysGranted: accessGrant.daysToGrant },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoDecideSupplierSubmission(
  submission: SupplierSubmission,
  actorId: string,
  decision: "needs_correction" | "rejected" | "possible_duplicate" | "merged" | "archived",
  adminNotes: string,
) {
  const db = readDb();
  const user = db.users.find((item) => item.uid === submission.submittedBy);
  db.submissions = db.submissions.map((item) =>
    item.id === submission.id
      ? { ...item, submissionStatus: decision, adminDecision: decision, adminNotes, reviewedAt: now() }
      : item,
  );
  if (user) {
    if (decision === "rejected") user.rejectedSubmissions = (user.rejectedSubmissions || 0) + 1;
    if (decision === "possible_duplicate" || decision === "merged") {
      user.duplicateSubmissions = (user.duplicateSubmissions || 0) + 1;
    }
    user.qualityRatio = qualityRatio(user.approvedSubmissions || 0, user.rejectedSubmissions || 0, user.duplicateSubmissions || 0);
    user.updatedAt = now();
  }
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: `supplier_submission.${decision}`,
    targetType: "supplierSubmission",
    targetId: submission.id,
    details: { adminNotes },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoListSupplierReviews(supplierId: string, includePending = false) {
  return readDb().reviews.filter((review) => review.supplierId === supplierId && (includePending || review.status === "approved"));
}

export async function demoListMyReviews(userId: string) {
  return readDb().reviews.filter((review) => review.reviewedBy === userId);
}

export async function demoSubmitSupplierReview(review: Omit<SupplierReview, "id" | "status" | "createdAt">) {
  const db = readDb();
  db.reviews.push({ ...review, id: id("review"), status: "pending_review", createdAt: now() });
  writeDb(db);
}

export async function demoListPendingReviews() {
  return readDb().reviews.filter((review) => review.status === "pending_review");
}

export async function demoModerateReview(review: SupplierReview, actorId: string, decision: "approved" | "rejected") {
  const db = readDb();
  db.reviews = db.reviews.map((item) =>
    item.id === review.id ? { ...item, status: decision, approvedAt: decision === "approved" ? now() : undefined } : item,
  );
  if (decision === "approved") {
    const supplier = db.suppliers.find((item) => item.id === review.supplierId);
    if (supplier) {
      const count = supplier.reviewCount || 0;
      supplier.averageRating = Number((((supplier.averageRating || 0) * count + review.overall) / (count + 1)).toFixed(2));
      supplier.reviewCount = count + 1;
      supplier.updatedAt = now();
    }
    const user = db.users.find((item) => item.uid === review.reviewedBy);
    if (user) {
      user.approvedReviews = (user.approvedReviews || 0) + 1;
      user.points = (user.points || 0) + (db.settings.reviewsEarnBonusPoints ? 4 : 0);
      user.updatedAt = now();
    }
  }
  db.auditLogs.push({
    id: id("audit"),
    actorId,
    action: `review.${decision}`,
    targetType: "review",
    targetId: review.id,
    details: { supplierId: review.supplierId },
    createdAt: now(),
  });
  writeDb(db);
}

export async function demoListAuditLogs() {
  return readDb().auditLogs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function demoListAccessCredits(userId: string) {
  return readDb().accessCredits.filter((credit) => credit.userId === userId);
}
