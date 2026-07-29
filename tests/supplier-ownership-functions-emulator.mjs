import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import {
  ownershipAuditId,
  ownershipEventId,
  ownershipNotificationId,
  submissionSideEffectId,
} from "../functions/src/supplierOwnershipCore.js";

const requireFromFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { deleteApp: deleteAdminApp, initializeApp: initializeAdminApp } = requireFromFunctions("firebase-admin/app");
const { getAuth: getAdminAuth } = requireFromFunctions("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = requireFromFunctions("firebase-admin/firestore");

const projectId = "demo-mujahiziq-integration";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.ok(firestoreHost, "FIRESTORE_EMULATOR_HOST must be set");
assert.ok(authHost, "FIREBASE_AUTH_EMULATOR_HOST must be set");
const [functionsHost, functionsPortText] = (process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001").split(":");
const functionsPort = Number(functionsPortText || "5001");

const accounts = {
  claimant1: { uid: "fn-claimant-1", email: "fn-claimant-1@example.test", verified: true },
  claimant2: { uid: "fn-claimant-2", email: "fn-claimant-2@example.test", verified: true },
  suspended: { uid: "fn-claimant-suspended", email: "fn-claimant-suspended@example.test", verified: true },
  unverified: { uid: "fn-claimant-unverified", email: "fn-claimant-unverified@example.test", verified: false },
  buyer: { uid: "fn-buyer", email: "fn-buyer@example.test", verified: true },
  admin: { uid: "fn-admin", email: "fn-admin@example.test", verified: true },
  owner: { uid: "fn-owner", email: "fn-owner@example.test", verified: true },
};
const password = "Synthetic-Password-2026!";
let adminApp;
let adminDb;
let adminAuth;
const clients = new Map();

function userData(key, overrides = {}) {
  const account = accounts[key];
  return {
    uid: account.uid,
    email: account.email,
    fullName: `Synthetic ${key}`,
    organization: "Synthetic Industrial Company",
    jobTitle: "Authorized Manager",
    phone: "+9640000000000",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    accessStatus: "active",
    emailVerified: account.verified,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    duplicateSubmissions: 0,
    approvedReviews: 0,
    approvedNewSupplierContributions: 0,
    consumedApprovedSupplierContributions: 0,
    points: 5,
    badges: [],
    ...overrides,
  };
}

async function clearFirestore() {
  const response = await fetch(
    `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  assert.equal(response.ok, true, `Firestore clear failed: ${response.status}`);
}

async function resetAuth() {
  const response = await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
  assert.equal(response.ok, true, `Auth clear failed: ${response.status}`);
}

async function createClient(key) {
  const account = accounts[key];
  const app = initializeApp({
    apiKey: "demo-api-key",
    authDomain: "demo.firebaseapp.com",
    projectId,
    appId: `1:000000000000:web:${key}`,
  }, `ownership-${key}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, account.email, password);
  const functions = getFunctions(app, "us-central1");
  connectFunctionsEmulator(functions, functionsHost, functionsPort);
  clients.set(key, { app, auth, functions });
}

async function call(key, name, data) {
  const client = clients.get(key);
  assert.ok(client, `Missing client ${key}`);
  const result = await httpsCallable(client.functions, name)(data);
  return result.data;
}

async function expectCallableError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, `functions/${code}`);
    return true;
  });
}

function supplierData(id, overrides = {}) {
  return {
    id,
    normalizedName: id === "profile-b" ? "acme bearings" : "acme industrial",
    nameOriginal: id === "profile-b" ? "Acme Bearings" : "Acme Industrial",
    displayName: id === "profile-b" ? "Acme Bearings" : "Acme Industrial",
    nameAr: id === "profile-b" ? "اكمي للمحامل" : "اكمي الصناعية",
    nameEn: id === "profile-b" ? "Acme Bearings" : "Acme Industrial",
    governorate: "baghdad",
    city: "baghdad",
    categories: ["tools_equipment", "maintenance_services", "general_trading", "other"],
    website: "https://public.example.test/private/path",
    status: "approved",
    verificationStatus: "community_submitted",
    ...overrides,
  };
}

async function seedBase() {
  const batch = adminDb.batch();
  batch.set(adminDb.doc(`users/${accounts.claimant1.uid}`), userData("claimant1"));
  batch.set(adminDb.doc(`users/${accounts.claimant2.uid}`), userData("claimant2"));
  batch.set(adminDb.doc(`users/${accounts.suspended.uid}`), userData("suspended", { accessStatus: "suspended" }));
  batch.set(adminDb.doc(`users/${accounts.unverified.uid}`), userData("unverified"));
  batch.set(adminDb.doc(`users/${accounts.buyer.uid}`), userData("buyer", { accountType: "buyer" }));
  batch.set(adminDb.doc(`users/${accounts.admin.uid}`), userData("admin", { role: "admin", accountType: "buyer" }));
  batch.set(adminDb.doc(`users/${accounts.owner.uid}`), userData("owner", { role: "owner", accountType: "buyer" }));
  batch.set(adminDb.doc("suppliers/profile-a"), supplierData("profile-a"));
  batch.set(adminDb.doc("suppliers/profile-b"), supplierData("profile-b"));
  batch.set(adminDb.doc("suppliers/profile-owned"), supplierData("profile-owned", {
    normalizedName: "acme owned",
    accountOwnerId: "existing-owner",
    canReceiveRfqs: true,
  }));
  batch.set(adminDb.doc("suppliers/profile-archived"), supplierData("profile-archived", {
    normalizedName: "acme archived",
    status: "archived",
  }));
  batch.set(adminDb.doc("supplierDuplicateIndex/profile-a"), {
    supplierId: "profile-a",
    normalizedEmail: "private@example.test",
    normalizedPhones: ["9647000000000"],
  });
  await batch.commit();
}

function validClaimInput(supplierProfileId = "profile-a") {
  return {
    supplierProfileId,
    claimReason: "I am the authorized representative for this synthetic Supplier company.",
    evidenceType: "company_domain_email",
    evidenceSummary: "The synthetic company domain and authorization record support this request.",
    referenceLinks: ["https://evidence.example.test/company"],
  };
}

before(async () => {
  process.env.GCLOUD_PROJECT = projectId;
  adminApp = initializeAdminApp({ projectId }, "ownership-functions-tests");
  adminDb = getFirestore(adminApp);
  adminAuth = getAdminAuth(adminApp);
  await resetAuth();
  for (const account of Object.values(accounts)) {
    await adminAuth.createUser({
      uid: account.uid,
      email: account.email,
      password,
      emailVerified: account.verified,
    });
  }
  for (const key of Object.keys(accounts)) await createClient(key);
});

beforeEach(async () => {
  await clearFirestore();
  await seedBase();
});

after(async () => {
  for (const client of clients.values()) {
    await signOut(client.auth);
    await deleteApp(client.app);
  }
  await deleteAdminApp(adminApp);
});

test("bounded search returns safe unowned display fields without duplicate-index contact data", async () => {
  const prefix = await call("claimant1", "searchSupplierProfilesForClaim", { query: "acme", mode: "prefix" });
  assert.deepEqual(prefix.items.map((item) => item.supplierProfileId).sort(), ["profile-a", "profile-b"]);
  for (const item of prefix.items) {
    assert.deepEqual(Object.keys(item).sort(), [
      "categories", "city", "governorate", "nameAr", "nameEn", "supplierProfileId", "website",
    ]);
    assert.equal(item.categories.length, 3);
    assert.equal(item.website, "public.example.test");
    assert.equal("normalizedEmail" in item, false);
    assert.equal("accountOwnerId" in item, false);
  }
  const exact = await call("claimant1", "searchSupplierProfilesForClaim", { query: "Acme Industrial", mode: "exact" });
  assert.deepEqual(exact.items.map((item) => item.supplierProfileId), ["profile-a"]);
  await expectCallableError(call("buyer", "searchSupplierProfilesForClaim", { query: "acme", mode: "prefix" }), "permission-denied");
});

test("claim creation and claimant lock are atomic, powerless, and duplicate-safe", async () => {
  const created = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  const [claim, lock, user, supplier] = await Promise.all([
    adminDb.doc(`supplierOwnershipClaims/${created.claimId}`).get(),
    adminDb.doc(`supplierClaimantLocks/${accounts.claimant1.uid}`).get(),
    adminDb.doc(`users/${accounts.claimant1.uid}`).get(),
    adminDb.doc("suppliers/profile-a").get(),
  ]);
  assert.equal(claim.data().status, "pending_review");
  assert.equal(lock.data().claimId, created.claimId);
  assert.equal(user.data().supplierProfileId, undefined);
  assert.equal(supplier.data().accountOwnerId, undefined);
  assert.equal(supplier.data().canReceiveRfqs, undefined);
  await expectCallableError(call("claimant1", "createSupplierOwnershipClaim", validClaimInput("profile-b")), "already-exists");
});

test("concurrent approvals for one Supplier commit exactly one canonical owner and supersede the conflict", async () => {
  const first = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  const second = await call("claimant2", "createSupplierOwnershipClaim", validClaimInput());
  const outcomes = await Promise.allSettled([
    call("admin", "decideSupplierOwnershipClaim", { claimId: first.claimId, decision: "approve", adminNotes: "Synthetic approval" }),
    call("owner", "decideSupplierOwnershipClaim", { claimId: second.claimId, decision: "approve", adminNotes: "Synthetic approval" }),
  ]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  const claims = await adminDb.collection("supplierOwnershipClaims").get();
  assert.deepEqual(claims.docs.map((item) => item.data().status).sort(), ["approved", "superseded"]);
  const supplier = (await adminDb.doc("suppliers/profile-a").get()).data();
  const linkedUsers = await Promise.all([
    adminDb.doc(`users/${accounts.claimant1.uid}`).get(),
    adminDb.doc(`users/${accounts.claimant2.uid}`).get(),
  ]);
  assert.equal(linkedUsers.filter((item) => item.data().supplierProfileId === "profile-a").length, 1);
  assert.equal(supplier.accountOwnerId, linkedUsers.find((item) => item.data().supplierProfileId === "profile-a").id);
  assert.equal(supplier.canReceiveRfqs, true);
  assert.equal((await adminDb.collection("supplierClaimantLocks").get()).empty, true);
});

test("approval writes every required record and repeated identical decisions are idempotent", async () => {
  const created = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  const approved = await call("admin", "decideSupplierOwnershipClaim", {
    claimId: created.claimId,
    decision: "approve",
    adminNotes: "Synthetic evidence verified.",
  });
  assert.equal(approved.status, "approved");
  const eventId = ownershipEventId(created.claimId, "approved");
  const [claim, lock, user, supplier, event, audit, notification] = await Promise.all([
    adminDb.doc(`supplierOwnershipClaims/${created.claimId}`).get(),
    adminDb.doc(`supplierClaimantLocks/${accounts.claimant1.uid}`).get(),
    adminDb.doc(`users/${accounts.claimant1.uid}`).get(),
    adminDb.doc("suppliers/profile-a").get(),
    adminDb.doc(`supplierOwnershipEvents/${eventId}`).get(),
    adminDb.doc(`auditLogs/${ownershipAuditId(created.claimId, "approved")}`).get(),
    adminDb.doc(`notifications/${ownershipNotificationId(created.claimId, "approved")}`).get(),
  ]);
  assert.equal(claim.data().status, "approved");
  assert.equal(lock.exists, false);
  assert.equal(user.data().supplierProfileId, "profile-a");
  assert.equal(supplier.data().accountOwnerId, accounts.claimant1.uid);
  assert.equal(supplier.data().canReceiveRfqs, true);
  assert.equal(event.exists && audit.exists && notification.exists, true);
  const repeated = await call("admin", "decideSupplierOwnershipClaim", {
    claimId: created.claimId,
    decision: "approve",
    adminNotes: "Ignored on idempotent replay.",
  });
  assert.equal(repeated.idempotent, true);
  await expectCallableError(call("admin", "decideSupplierOwnershipClaim", {
    claimId: created.claimId,
    decision: "reject",
    adminNotes: "Conflicting later decision",
  }), "failed-precondition");
});

test("a stale or missing claimant lock makes approval fail with zero ownership writes", async () => {
  const created = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  await adminDb.doc(`supplierClaimantLocks/${accounts.claimant1.uid}`).delete();
  await expectCallableError(call("admin", "decideSupplierOwnershipClaim", {
    claimId: created.claimId,
    decision: "approve",
    adminNotes: "Must fail",
  }), "failed-precondition");
  assert.equal((await adminDb.doc(`supplierOwnershipClaims/${created.claimId}`).get()).data().status, "pending_review");
  assert.equal((await adminDb.doc(`users/${accounts.claimant1.uid}`).get()).data().supplierProfileId, undefined);
  assert.equal((await adminDb.doc("suppliers/profile-a").get()).data().accountOwnerId, undefined);
  assert.equal((await adminDb.collection("supplierOwnershipEvents").get()).empty, true);
});

test("withdrawal, rejection, and expiry are terminal and release claimant locks without ownership", async () => {
  const withdrawnClaim = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  const withdrawn = await call("claimant1", "withdrawSupplierOwnershipClaim", { claimId: withdrawnClaim.claimId });
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal((await call("claimant1", "withdrawSupplierOwnershipClaim", { claimId: withdrawnClaim.claimId })).idempotent, true);

  const rejectedClaim = await call("claimant2", "createSupplierOwnershipClaim", validClaimInput("profile-b"));
  const rejected = await call("admin", "decideSupplierOwnershipClaim", {
    claimId: rejectedClaim.claimId,
    decision: "reject",
    adminNotes: "Synthetic evidence insufficient.",
  });
  assert.equal(rejected.status, "rejected");

  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({ accessStatus: "active" });
  const expiredClaim = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  const past = Timestamp.fromMillis(Date.now() - 60_000);
  await Promise.all([
    adminDb.doc(`supplierOwnershipClaims/${expiredClaim.claimId}`).update({ expiresAt: past }),
    adminDb.doc(`supplierClaimantLocks/${accounts.claimant1.uid}`).update({ expiresAt: past }),
  ]);
  await expectCallableError(call("claimant1", "withdrawSupplierOwnershipClaim", { claimId: expiredClaim.claimId }), "failed-precondition");
  assert.equal((await adminDb.doc(`supplierOwnershipClaims/${expiredClaim.claimId}`).get()).data().status, "expired");
  assert.equal((await adminDb.doc(`supplierClaimantLocks/${accounts.claimant1.uid}`).get()).exists, false);
  assert.equal((await adminDb.doc("suppliers/profile-a").get()).data().accountOwnerId, undefined);
});

test("conflict safe-cap overflow aborts the approval with no writes", async () => {
  const selected = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  const batch = adminDb.batch();
  for (let index = 0; index < 20; index += 1) {
    const claimId = `overflow-claim-${index}`;
    const claimantUserId = `overflow-user-${index}`;
    batch.set(adminDb.doc(`supplierOwnershipClaims/${claimId}`), {
      claimantUserId,
      supplierProfileId: "profile-a",
      status: "pending_review",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    });
    batch.set(adminDb.doc(`supplierClaimantLocks/${claimantUserId}`), {
      claimantUserId,
      claimId,
      supplierProfileId: "profile-a",
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    });
  }
  await batch.commit();
  await expectCallableError(call("admin", "decideSupplierOwnershipClaim", {
    claimId: selected.claimId,
    decision: "approve",
    adminNotes: "Must exceed safe cap",
  }), "resource-exhausted");
  assert.equal((await adminDb.doc(`supplierOwnershipClaims/${selected.claimId}`).get()).data().status, "pending_review");
  assert.equal((await adminDb.doc("suppliers/profile-a").get()).data().accountOwnerId, undefined);
});

test("inactive, suspended, unverified, linked, and stale claimants are denied", async () => {
  await expectCallableError(call("suspended", "createSupplierOwnershipClaim", validClaimInput()), "permission-denied");
  await expectCallableError(call("unverified", "createSupplierOwnershipClaim", validClaimInput()), "permission-denied");
  await adminDb.doc(`users/${accounts.claimant2.uid}`).update({ supplierProfileId: "profile-b" });
  await expectCallableError(call("claimant2", "createSupplierOwnershipClaim", validClaimInput()), "failed-precondition");
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({ accessStatus: "pending" });
  await expectCallableError(call("claimant1", "searchSupplierProfilesForClaim", { query: "acme" }), "permission-denied");
  await expectCallableError(call("claimant1", "createSupplierOwnershipClaim", validClaimInput()), "permission-denied");
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({ accessStatus: "active" });
  const created = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({ accessStatus: "suspended" });
  await expectCallableError(call("admin", "decideSupplierOwnershipClaim", {
    claimId: created.claimId,
    decision: "approve",
    adminNotes: "Claimant is suspended",
  }), "permission-denied");
  assert.equal((await adminDb.doc(`supplierOwnershipClaims/${created.claimId}`).get()).data().status, "pending_review");
});

test("existing new-company approval is deterministic, concurrent-safe, and idempotent", async () => {
  const priorIds = Array.from({ length: 9 }, (_, index) => `prior-${index}`);
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({
    approvedSubmissions: 9,
    approvedNewSupplierContributions: 9,
    consumedApprovedSupplierContributions: 0,
    unconsumedApprovedSubmissionIds: priorIds,
  });
  await adminDb.doc("supplierSubmissions/submission-1").set({
    submittedBy: accounts.claimant1.uid,
    submissionStatus: "pending_review",
    supplierData: {
      nameOriginal: "Synthetic New Supplier",
      displayName: "Synthetic New Supplier",
      nameLanguage: "english",
      nameEn: "Synthetic New Supplier",
      businessType: "company",
      governorate: "baghdad",
      city: "baghdad",
      marketArea: "test",
      coverageAreas: ["baghdad"],
      phones: ["+9640000000000"],
      normalizedPhones: ["9640000000000"],
      whatsappAvailable: "unknown",
      categories: ["tools_equipment"],
      subcategories: [],
      capabilityTags: ["local_stock"],
      paymentOptions: [],
      sourceType: "found_online",
      confidenceLevel: "medium",
      hasDirectExperience: "not_sure",
      completionScore: 80,
      normalizedName: "synthetic new supplier",
      searchKeywords: ["synthetic", "supplier"],
    },
    countsForAccess: false,
    creditConsumed: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  const first = await call("admin", "approveSupplierSubmissionTrusted", { submissionId: "submission-1" });
  const second = await call("admin", "approveSupplierSubmissionTrusted", { submissionId: "submission-1" });
  const supplierId = submissionSideEffectId("submission-1", "profile");
  assert.equal(first.supplierProfileId, supplierId);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  const [submission, contributor, supplier] = await Promise.all([
    adminDb.doc("supplierSubmissions/submission-1").get(),
    adminDb.doc(`users/${accounts.claimant1.uid}`).get(),
    adminDb.doc(`suppliers/${supplierId}`).get(),
  ]);
  assert.equal(submission.data().approvedSupplierId, supplierId);
  assert.equal(contributor.data().approvedSubmissions, 10);
  assert.equal(contributor.data().approvedNewSupplierContributions, 10);
  assert.equal(contributor.data().supplierProfileId, supplierId);
  assert.equal(supplier.data().accountOwnerId, accounts.claimant1.uid);
  assert.equal((await adminDb.doc(`accessCredits/${submissionSideEffectId("submission-1", "credit")}`).get()).exists, true);
  assert.equal((await adminDb.doc(`accessGrants/${submissionSideEffectId("submission-1", "grant")}`).get()).exists, true);
  assert.equal((await adminDb.doc(`auditLogs/${submissionSideEffectId("submission-1", "audit")}`).get()).exists, true);
  assert.equal((await adminDb.doc(`notifications/${submissionSideEffectId("submission-1", "notification")}`).get()).exists, true);
  assert.equal((await adminDb.doc(`supplierOwnershipEvents/${submissionSideEffectId("submission-1", "ownership-event")}`).get()).exists, true);
  assert.equal((await adminDb.collection("suppliers").where("createdBy", "==", accounts.claimant1.uid).get()).size, 1);
});

test("trusted role/status updates preserve two-sided Supplier ownership", async () => {
  await adminDb.doc(`users/${accounts.claimant2.uid}`).update({ supplierProfileId: "profile-b" });
  await adminDb.doc("suppliers/profile-b").update({
    accountOwnerId: accounts.claimant2.uid,
    canReceiveRfqs: true,
  });
  const result = await call("admin", "setUserRoleAndStatusTrusted", {
    userId: accounts.claimant2.uid,
    role: "contributor",
    status: "suspended",
  });
  assert.equal(result.idempotent, false);
  assert.equal((await adminDb.doc(`users/${accounts.claimant2.uid}`).get()).data().accessStatus, "suspended");
  assert.equal((await adminDb.doc("suppliers/profile-b").get()).data().canReceiveRfqs, false);
});
