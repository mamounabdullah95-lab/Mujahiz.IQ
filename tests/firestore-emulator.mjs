import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(emulatorHost, "FIRESTORE_EMULATOR_HOST must be set by firebase emulators:exec");
const separator = emulatorHost.lastIndexOf(":");
const host = emulatorHost.slice(0, separator);
const port = Number(emulatorHost.slice(separator + 1));
const projectId = "demo-mujahiziq-integration";
const rules = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
let environment;

const users = {
  buyer: { uid: "buyer-1", role: "contributor", accountType: "buyer", status: "approved" },
  supplier: { uid: "supplier-1", role: "contributor", accountType: "supplier", status: "approved" },
  admin: { uid: "admin-1", role: "admin", accountType: "buyer", status: "approved" },
  owner: { uid: "owner-1", role: "owner", accountType: "buyer", status: "approved" },
};

function pendingVerificationUser(uid, accountType) {
  return {
    uid,
    email: `${uid}@example.test`,
    role: "contributor",
    accountType,
    status: "approved",
    accessStatus: "pending",
    accessExpiresAt: null,
    trialStartedAt: null,
    trialEndsAt: null,
    emailVerified: false,
    emailVerifiedAt: null,
  };
}

const verificationUsers = {
  buyer: pendingVerificationUser("buyer-verify", "buyer"),
  supplier: pendingVerificationUser("supplier-verify", "supplier"),
  unverifiedBuyer: pendingVerificationUser("buyer-token-stale", "buyer"),
  protectedProbe: pendingVerificationUser("verification-protected-probe", "supplier"),
  auditProbe: pendingVerificationUser("verification-audit-probe", "supplier"),
  trialCompletenessProbe: pendingVerificationUser("verification-trial-completeness", "buyer"),
  alreadyVerified: {
    ...pendingVerificationUser("verification-already-complete", "supplier"),
    emailVerified: true,
    emailVerifiedAt: Timestamp.now(),
  },
  legacyAdmin: {
    uid: "legacy-admin-verify",
    email: "legacy-admin-verify@example.test",
    role: "admin",
    status: "approved",
    accessStatus: "active",
  },
  legacyOwner: {
    uid: "legacy-owner-verify",
    email: "legacy-owner-verify@example.test",
    role: "owner",
    accountType: null,
    status: "approved",
    accessStatus: "active",
  },
  legacyAdminWithAudit: {
    uid: "legacy-admin-existing-audit",
    email: "legacy-admin-existing-audit@example.test",
    role: "admin",
    status: "approved",
    accessStatus: "active",
  },
};

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all(
      [...Object.values(users), ...Object.values(verificationUsers)]
        .map((user) => setDoc(doc(database, "users", user.uid), user)),
    );
    await setDoc(doc(database, "auditLogs", "email-verification-legacy-admin-existing-audit"), {
      actorId: verificationUsers.legacyAdminWithAudit.uid,
      action: "user.email_verified",
      targetType: "user",
      targetId: verificationUsers.legacyAdminWithAudit.uid,
      details: { accountType: null, trialStarted: false },
      createdAt: Timestamp.now(),
    });
  });
});

after(async () => {
  await environment?.cleanup();
});

function contextFor(key) {
  const user = users[key];
  return environment.authenticatedContext(user.uid, { email: `${user.uid}@example.test` }).firestore();
}

function verificationContextFor(key, emailVerified = true) {
  const user = verificationUsers[key];
  return environment.authenticatedContext(user.uid, {
    email: user.email,
    email_verified: emailVerified,
  }).firestore();
}

async function synchronizeVerification(key, emailVerified = true) {
  const user = verificationUsers[key];
  const database = verificationContextFor(key, emailVerified);
  const userRef = doc(database, "users", user.uid);
  const trialCreditRef = doc(database, "accessCredits", `trial-${user.uid}`);
  const trialGrantRef = doc(database, "accessGrants", `trial-${user.uid}`);
  const auditRef = doc(database, "auditLogs", `email-verification-${user.uid}`);

  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const profile = snapshot.data();
    if (profile.emailVerified === true) return;

    const existingAudit = await transaction.get(auditRef);
    const existingGrant = await transaction.get(trialGrantRef);
    const isNewBuyer =
      profile.role === "contributor"
      && profile.accountType === "buyer"
      && profile.accessStatus === "pending"
      && !profile.accessExpiresAt
      && !profile.trialStartedAt
      && !profile.trialEndsAt;
    const trialAlreadyGranted = existingGrant.exists() || existingAudit.exists();

    if (!isNewBuyer || trialAlreadyGranted) {
      transaction.update(userRef, {
        emailVerified: true,
        emailVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (!existingAudit.exists()) {
        transaction.set(auditRef, {
          actorId: user.uid,
          action: "user.email_verified",
          targetType: "user",
          targetId: user.uid,
          details: { trialStarted: false },
          createdAt: serverTimestamp(),
        });
      }
      return;
    }

    const trialEndsAt = Timestamp.fromMillis(Date.now() + (3 * 86_400_000));
    transaction.update(userRef, {
      emailVerified: true,
      emailVerifiedAt: serverTimestamp(),
      trialStartedAt: serverTimestamp(),
      trialEndsAt,
      accessStatus: "temporary",
      accessExpiresAt: trialEndsAt,
      updatedAt: serverTimestamp(),
    });
    const grantData = {
      userId: user.uid,
      source: "trial_access",
      grantType: "trial_access",
      approvedSubmissionIds: [],
      approvedSupplierCount: 0,
      daysGranted: 3,
      status: "applied",
      grantedAt: serverTimestamp(),
      previousExpiry: null,
      newExpiry: trialEndsAt,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };
    transaction.set(trialCreditRef, { ...grantData, appliedAt: serverTimestamp() });
    transaction.set(trialGrantRef, { ...grantData, auditReference: auditRef.id });
    transaction.set(auditRef, {
      actorId: user.uid,
      action: "user.email_verified_trial_started",
      targetType: "user",
      targetId: user.uid,
      details: { accountType: "buyer", days: 3, trialStarted: true },
      createdAt: serverTimestamp(),
    });
  });
}

async function commitEmailOnlyVerification(
  key,
  { userPatch = {}, auditPatch = {}, emailVerified = true, targetKey = key } = {},
) {
  const actor = verificationUsers[key];
  const target = verificationUsers[targetKey];
  const database = verificationContextFor(key, emailVerified);
  const batch = writeBatch(database);
  batch.update(doc(database, "users", target.uid), {
    emailVerified: true,
    emailVerifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...userPatch,
  });
  batch.set(doc(database, "auditLogs", `email-verification-${actor.uid}`), {
    actorId: actor.uid,
    action: "user.email_verified",
    targetType: "user",
    targetId: actor.uid,
    details: { trialStarted: false },
    createdAt: serverTimestamp(),
    ...auditPatch,
  });
  return batch.commit();
}

async function commitIncompleteBuyerTrial(key) {
  const actor = verificationUsers[key];
  const database = verificationContextFor(key);
  const trialEndsAt = Timestamp.fromMillis(Date.now() + (3 * 86_400_000));
  const batch = writeBatch(database);
  batch.update(doc(database, "users", actor.uid), {
    emailVerified: true,
    emailVerifiedAt: serverTimestamp(),
    trialStartedAt: serverTimestamp(),
    trialEndsAt,
    accessStatus: "temporary",
    accessExpiresAt: trialEndsAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(database, "auditLogs", `email-verification-${actor.uid}`), {
    actorId: actor.uid,
    action: "user.email_verified_trial_started",
    targetType: "user",
    targetId: actor.uid,
    details: { accountType: "buyer", days: 3, trialStarted: true },
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}

async function readVerificationState(uid) {
  let state;
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const [profile, credits, grants, audits] = await Promise.all([
      getDoc(doc(database, "users", uid)),
      getDocs(collection(database, "accessCredits")),
      getDocs(collection(database, "accessGrants")),
      getDocs(collection(database, "auditLogs")),
    ]);
    state = {
      profile: profile.data(),
      credits: credits.docs.filter((item) => item.data().userId === uid),
      grants: grants.docs.filter((item) => item.data().userId === uid),
      audits: audits.docs.filter((item) => item.data().actorId === uid),
    };
  });
  return state;
}

function importBatchData(user, role, suffix, overrides = {}) {
  return {
    source: "excel_import",
    importedBy: user.uid,
    importedByRole: role,
    originalFileName: `suppliers-${suffix}.xlsx`,
    fileSizeBytes: 1024,
    totalRowsDetected: 1,
    acceptedRows: 1,
    incompleteRows: 0,
    invalidRows: 0,
    exactDuplicateRows: 0,
    possibleDuplicateRows: 0,
    averageCompleteness: 82,
    createdAt: Timestamp.now(),
    completedAt: Timestamp.now(),
    status: "completed",
    ...overrides,
  };
}

function supplierData(suffix, extra = {}) {
  return {
    nameOriginal: `Supplier ${suffix}`,
    displayName: `Supplier ${suffix}`,
    normalizedName: `supplier ${suffix}`,
    normalizedPhones: [`+964770000${suffix.padStart(4, "0").slice(-4)}`],
    phones: [`+964770000${suffix.padStart(4, "0").slice(-4)}`],
    governorate: "baghdad",
    city: "baghdad",
    marketArea: "industrial",
    categories: ["industrial_supplies"],
    capabilityTags: ["local_stock"],
    sourceType: "company_submitted",
    confidenceLevel: "medium",
    hasDirectExperience: false,
    ...extra,
  };
}

function excelSubmissionData(user, role, batchId, rowNumber = 2, extra = {}, nestedExtra = {}) {
  const submissionId = `${batchId}_${rowNumber}`;
  return {
    id: submissionId,
    data: {
      submittedBy: user.uid,
      submissionStatus: "pending_review",
      supplierData: supplierData(submissionId, nestedExtra),
      duplicateCheck: { hasPossibleDuplicate: false, matches: [], checkedAt: Timestamp.now() },
      countsForAccess: false,
      creditConsumed: false,
      source: "excel_import",
      importBatchId: batchId,
      originalRowNumber: rowNumber,
      importedBy: user.uid,
      importedByRole: role,
      importedAt: Timestamp.now(),
      profileCompleteness: 82,
      validationStatus: "valid",
      idempotencyKey: submissionId,
      createdAt: Timestamp.now(),
      ...extra,
    },
  };
}

function pendingIndexData(user, submissionId) {
  return {
    submissionId,
    submittedBy: user.uid,
    supplierName: `Supplier ${submissionId}`,
    normalizedName: `supplier ${submissionId}`,
    normalizedPhones: ["+9647700000000"],
    categories: ["industrial_supplies"],
    source: "pending_submission",
    createdAt: Timestamp.now(),
  };
}

function commitImport(key, suffix) {
  const user = users[key];
  const role = key === "owner" ? "owner" : key === "admin" ? "admin" : "buyer";
  const database = contextFor(key);
  const batchId = `batch-${key}-${suffix}`;
  const submission = excelSubmissionData(user, role, batchId);
  const batch = writeBatch(database);
  batch.set(doc(database, "supplierImportBatches", batchId), importBatchData(user, role, suffix));
  batch.set(doc(database, "supplierSubmissions", submission.id), submission.data);
  batch.set(doc(database, "supplierSubmissionDuplicateIndex", submission.id), pendingIndexData(user, submission.id));
  batch.set(doc(database, "auditLogs", `audit-${key}-${suffix}`), {
    actorId: user.uid,
    action: "supplier_import.completed",
    targetType: "supplierImportBatch",
    targetId: batchId,
    details: { acceptedRows: 1, totalRowsDetected: 1, importedByRole: role },
    createdAt: Timestamp.now(),
  });
  return batch.commit();
}

async function commitManualSubmission(key, suffix) {
  const user = users[key];
  const database = contextFor(key);
  const submissionId = `manual-${key}-${suffix}`;
  const batch = writeBatch(database);
  batch.set(doc(database, "supplierSubmissions", submissionId), {
    submittedBy: user.uid,
    submissionStatus: "pending_review",
    supplierData: supplierData(submissionId),
    duplicateCheck: { hasPossibleDuplicate: false, matches: [], checkedAt: Timestamp.now() },
    countsForAccess: false,
    creditConsumed: false,
    source: "manual",
    createdAt: Timestamp.now(),
  });
  batch.set(doc(database, "supplierSubmissionDuplicateIndex", submissionId), pendingIndexData(user, submissionId));
  return batch.commit();
}

test("buyer, admin, and owner can submit metadata-only Excel imports", async () => {
  await assertSucceeds(commitImport("buyer", "roles"));
  await assertSucceeds(commitImport("admin", "roles"));
  await assertSucceeds(commitImport("owner", "roles"));
});

test("supplier accounts cannot use Excel import", async () => {
  const database = contextFor("supplier");
  await assertFails(setDoc(
    doc(database, "supplierImportBatches", "batch-supplier-denied"),
    importBatchData(users.supplier, "buyer", "supplier-denied"),
  ));
});

test("buyer and supplier manual submissions remain allowed", async () => {
  await assertSucceeds(commitManualSubmission("buyer", "allowed"));
  await assertSucceeds(commitManualSubmission("supplier", "allowed"));
});

test("the 200 KB workbook metadata boundary is enforced", async () => {
  const database = contextFor("buyer");
  await assertSucceeds(setDoc(
    doc(database, "supplierImportBatches", "batch-size-allowed"),
    importBatchData(users.buyer, "buyer", "size-allowed", { fileSizeBytes: 204800 }),
  ));
  await assertFails(setDoc(
    doc(database, "supplierImportBatches", "batch-size-denied"),
    importBatchData(users.buyer, "buyer", "size-denied", { fileSizeBytes: 204801 }),
  ));
});

test("the 50-company metadata boundary is enforced", async () => {
  const database = contextFor("buyer");
  await assertSucceeds(setDoc(
    doc(database, "supplierImportBatches", "batch-rows-allowed"),
    importBatchData(users.buyer, "buyer", "rows-allowed", { totalRowsDetected: 50, acceptedRows: 50 }),
  ));
  await assertFails(setDoc(
    doc(database, "supplierImportBatches", "batch-rows-denied"),
    importBatchData(users.buyer, "buyer", "rows-denied", { totalRowsDetected: 51, acceptedRows: 50 }),
  ));
});

test("workbook, Blob, Base64, and raw file fields are rejected", async () => {
  const database = contextFor("buyer");
  await assertFails(setDoc(
    doc(database, "supplierImportBatches", "batch-workbook-denied"),
    importBatchData(users.buyer, "buyer", "workbook-denied", { workbook: "raw-workbook" }),
  ));
  const blobSubmission = excelSubmissionData(users.buyer, "buyer", "batch-blob-denied", 2, { blob: "blob-data" });
  await assertFails(setDoc(doc(database, "supplierSubmissions", blobSubmission.id), blobSubmission.data));
  const base64Submission = excelSubmissionData(users.buyer, "buyer", "batch-base64-denied", 2, {}, { base64: "AAAA" });
  await assertFails(setDoc(doc(database, "supplierSubmissions", base64Submission.id), base64Submission.data));
  const rawSubmission = excelSubmissionData(users.buyer, "buyer", "batch-raw-denied", 2, {}, { rawData: "bytes" });
  await assertFails(setDoc(doc(database, "supplierSubmissions", rawSubmission.id), rawSubmission.data));
});

test("verified buyer synchronizes stale Firestore state and receives one three-day trial", async () => {
  await assertSucceeds(synchronizeVerification("buyer"));
  const first = await readVerificationState(verificationUsers.buyer.uid);
  assert.equal(first.profile.emailVerified, true);
  assert.ok(first.profile.emailVerifiedAt instanceof Timestamp);
  assert.ok(first.profile.trialStartedAt instanceof Timestamp);
  assert.ok(first.profile.trialEndsAt instanceof Timestamp);
  assert.equal(first.profile.accessStatus, "temporary");
  assert.equal(first.profile.accessExpiresAt.toMillis(), first.profile.trialEndsAt.toMillis());
  const duration = first.profile.trialEndsAt.toMillis() - first.profile.trialStartedAt.toMillis();
  assert.ok(duration >= (3 * 86_400_000) - 5_000 && duration <= (3 * 86_400_000) + 5_000);
  assert.equal(first.credits.length, 1);
  assert.equal(first.grants.length, 1);
  assert.equal(first.audits.length, 1);
  assert.equal(first.audits[0].data().action, "user.email_verified_trial_started");

  await assertSucceeds(synchronizeVerification("buyer"));
  const repeated = await readVerificationState(verificationUsers.buyer.uid);
  assert.equal(repeated.credits.length, 1);
  assert.equal(repeated.grants.length, 1);
  assert.equal(repeated.audits.length, 1);
});

test("verified supplier synchronizes email without receiving buyer trial access", async () => {
  await assertSucceeds(synchronizeVerification("supplier"));
  const state = await readVerificationState(verificationUsers.supplier.uid);
  assert.equal(state.profile.emailVerified, true);
  assert.ok(state.profile.emailVerifiedAt instanceof Timestamp);
  assert.equal(state.profile.accessStatus, "pending");
  assert.equal(state.profile.accessExpiresAt, null);
  assert.equal(state.profile.trialStartedAt, null);
  assert.equal(state.profile.trialEndsAt, null);
  assert.equal(state.credits.length, 0);
  assert.equal(state.grants.length, 0);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].data().action, "user.email_verified");
});

test("stale Auth token cannot synchronize Firestore verification", async () => {
  await assertFails(synchronizeVerification("unverifiedBuyer", false));
  const state = await readVerificationState(verificationUsers.unverifiedBuyer.uid);
  assert.equal(state.profile.emailVerified, false);
  assert.equal(state.grants.length, 0);
  assert.equal(state.audits.length, 0);
});

test("buyer Trial activation rejects a partial transaction without credit and grant records", async () => {
  await assertFails(commitIncompleteBuyerTrial("trialCompletenessProbe"));
  const state = await readVerificationState(verificationUsers.trialCompletenessProbe.uid);
  assert.equal(state.profile.emailVerified, false);
  assert.equal(state.profile.accessStatus, "pending");
  assert.equal(state.credits.length, 0);
  assert.equal(state.grants.length, 0);
  assert.equal(state.audits.length, 0);
});

test("legacy Admin and Owner profiles synchronize missing or false verification without receiving a Trial", async () => {
  for (const key of ["legacyAdmin", "legacyOwner"]) {
    await assertSucceeds(synchronizeVerification(key));
    const state = await readVerificationState(verificationUsers[key].uid);
    assert.equal(state.profile.emailVerified, true);
    assert.ok(state.profile.emailVerifiedAt instanceof Timestamp);
    assert.equal(state.profile.role, verificationUsers[key].role);
    assert.equal(state.profile.accountType, verificationUsers[key].accountType);
    assert.equal(state.profile.accessStatus, "active");
    assert.equal(state.credits.length, 0);
    assert.equal(state.grants.length, 0);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].data().action, "user.email_verified");
    assert.deepEqual(state.audits[0].data().details, { trialStarted: false });
  }
});

test("a legacy deterministic audit keeps stale-profile synchronization idempotent", async () => {
  await assertSucceeds(synchronizeVerification("legacyAdminWithAudit"));
  const state = await readVerificationState(verificationUsers.legacyAdminWithAudit.uid);
  assert.equal(state.profile.emailVerified, true);
  assert.equal(state.credits.length, 0);
  assert.equal(state.grants.length, 0);
  assert.equal(state.audits.length, 1);
});

test("verification cannot target another user or run without the atomic deterministic audit", async () => {
  await assertFails(commitEmailOnlyVerification("protectedProbe", { targetKey: "legacyAdminWithAudit" }));
  const database = verificationContextFor("protectedProbe");
  await assertFails(updateDoc(doc(database, "users", verificationUsers.protectedProbe.uid), {
    emailVerified: true,
    emailVerifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test("verification cannot change protected profile fields in the same write", async () => {
  const protectedChanges = [
    { role: "admin" },
    { accountType: "buyer" },
    { status: "suspended" },
    { accessExpiresAt: Timestamp.fromMillis(Date.now() + 86_400_000) },
    { supplierProfileId: "supplier-hijack" },
  ];
  for (const userPatch of protectedChanges) {
    await assertFails(commitEmailOnlyVerification("protectedProbe", { userPatch }));
  }
});

test("verification cannot transition true to false", async () => {
  const database = verificationContextFor("alreadyVerified");
  await assertFails(updateDoc(doc(database, "users", verificationUsers.alreadyVerified.uid), {
    emailVerified: false,
    emailVerifiedAt: null,
    updatedAt: serverTimestamp(),
  }));
});

test("verification audit creation is atomic, exact, immutable, and non-repeatable", async () => {
  const actor = verificationUsers.auditProbe;
  const database = verificationContextFor("auditProbe");
  const auditRef = doc(database, "auditLogs", `email-verification-${actor.uid}`);
  const validAudit = {
    actorId: actor.uid,
    action: "user.email_verified",
    targetType: "user",
    targetId: actor.uid,
    details: { trialStarted: false },
    createdAt: serverTimestamp(),
  };

  await assertFails(setDoc(auditRef, validAudit));
  await assertFails(commitEmailOnlyVerification("auditProbe", {
    auditPatch: { action: "platform.settings.changed" },
  }));
  await assertFails(commitEmailOnlyVerification("auditProbe", {
    auditPatch: { targetId: verificationUsers.legacyAdmin.uid },
  }));
  await assertFails(commitEmailOnlyVerification("auditProbe", {
    auditPatch: { details: { accountType: null, trialStarted: false } },
  }));

  await assertSucceeds(commitEmailOnlyVerification("auditProbe"));
  await assertFails(setDoc(auditRef, validAudit));
  await assertFails(updateDoc(auditRef, { details: { trialStarted: true } }));
  await assertFails(deleteDoc(auditRef));
});
