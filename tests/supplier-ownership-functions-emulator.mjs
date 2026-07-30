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
  owner2: { uid: "fn-owner-2", email: "fn-owner-2@example.test", verified: true },
  forged: { uid: "fn-forged", email: "fn-forged@example.test", verified: true },
  expiredSupplier: { uid: "fn-expired-supplier", email: "fn-expired-supplier@example.test", verified: true },
  invalidSupplier: { uid: "fn-invalid-supplier", email: "fn-invalid-supplier@example.test", verified: true },
  invalidAccountType: { uid: "fn-invalid-account-type", email: "fn-invalid-account-type@example.test", verified: true },
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
  batch.set(adminDb.doc(`users/${accounts.owner2.uid}`), userData("owner2", { role: "owner", accountType: "buyer", status: "suspended", accessStatus: "suspended" }));
  batch.set(adminDb.doc(`users/${accounts.forged.uid}`), userData("forged"));
  batch.set(adminDb.doc(`users/${accounts.expiredSupplier.uid}`), userData("expiredSupplier", { accessExpiresAt: Timestamp.fromMillis(Date.now() - 1_000) }));
  batch.set(adminDb.doc(`users/${accounts.invalidSupplier.uid}`), userData("invalidSupplier", { role: "viewer" }));
  batch.set(adminDb.doc(`users/${accounts.invalidAccountType.uid}`), userData("invalidAccountType", { accountType: "invalid" }));
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

let claimKeyCounter = 0;
function validClaimInput(supplierProfileId = "profile-a", idempotencyKey) {
  claimKeyCounter += 1;
  return {
    supplierProfileId,
    claimReason: "I am the authorized representative for this synthetic Supplier company.",
    evidenceType: "company_domain_email",
    evidenceSummary: "The synthetic company domain and authorization record support this request.",
    referenceLinks: ["https://evidence.example.test/company"],
    idempotencyKey: idempotencyKey || `claim-request-${claimKeyCounter}`,
  };
}

function approvalSupplierData(name, overrides = {}) {
  return {
    nameOriginal: name,
    displayName: name,
    nameLanguage: "english",
    nameAr: "",
    nameEn: name,
    businessType: "company",
    governorate: "baghdad",
    governorates: ["baghdad"],
    branches: [],
    city: "baghdad",
    marketArea: "synthetic",
    coverageAreas: ["baghdad"],
    phones: ["+9647700000000"],
    normalizedPhones: ["forged-phone"],
    whatsappAvailable: "unknown",
    email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.test`,
    normalizedEmail: "forged@example.test",
    categories: ["tools_equipment"],
    subcategories: [],
    capabilityTags: ["local_stock"],
    paymentOptions: [],
    creditDays: [],
    sourceType: "found_online",
    confidenceLevel: "medium",
    hasDirectExperience: "not_sure",
    completionScore: 80,
    normalizedName: "forged normalized name",
    searchKeywords: ["forged"],
    ...overrides,
  };
}

async function seedApprovalSubmission(submissionId, contributorKey, supplierDataOverrides = {}, submissionOverrides = {}) {
  const contributor = accounts[contributorKey];
  await adminDb.doc(`supplierSubmissions/${submissionId}`).set({
    submittedBy: contributor.uid,
    submissionStatus: "pending_review",
    supplierData: approvalSupplierData("Synthetic Unique Supplier", supplierDataOverrides),
    duplicateCheck: { hasPossibleDuplicate: false, matches: [] },
    countsForAccess: false,
    creditConsumed: false,
    createdAt: FieldValue.serverTimestamp(),
    ...submissionOverrides,
  });
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
  await adminAuth.setCustomUserClaims(accounts.forged.uid, { role: "owner" });
  for (const key of Object.keys(accounts)) await createClient(key);
});

beforeEach(async () => {
  claimKeyCounter = 0;
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
test("Claim search enforces a transaction-safe per-UID fixed-window limit", async () => {
  for (let index = 0; index < 10; index += 1) {
    const result = await call("claimant1", "searchSupplierProfilesForClaim", { query: "acme", mode: "prefix" });
    assert.ok(result.items.length <= 10);
  }
  await expectCallableError(
    call("claimant1", "searchSupplierProfilesForClaim", { query: "acme", mode: "prefix" }),
    "resource-exhausted",
  );
  const limiter = (await adminDb.doc(`supplierClaimSearchRateLimits/${accounts.claimant1.uid}`).get()).data();
  assert.equal(limiter.requestCount, 10);
  assert.equal(limiter.userId, accounts.claimant1.uid);
});

test("claim creation retries return the original result and reject payload or claimant reuse", async () => {
  const input = validClaimInput("profile-a", "idempotent-request-0001");
  const first = await call("claimant1", "createSupplierOwnershipClaim", input);
  const repeated = await call("claimant1", "createSupplierOwnershipClaim", input);
  assert.equal(repeated.claimId, first.claimId);
  assert.equal(repeated.idempotent, true);
  await expectCallableError(call("claimant1", "createSupplierOwnershipClaim", {
    ...input,
    claimReason: `${input.claimReason} A different payload.`,
  }), "failed-precondition");
  await expectCallableError(call("claimant2", "createSupplierOwnershipClaim", input), "permission-denied");
  assert.equal((await adminDb.collection("supplierOwnershipClaims").get()).size, 1);
});

test("claim callables reject private evidence URLs, expired access, forged claims, and stale Auth state", async () => {
  for (const referenceLink of [
    "https://localhost/evidence",
    "https://127.0.0.1/evidence",
    "https://10.0.0.1/evidence",
    "https://[::1]/evidence",
    "https://[::ffff:127.0.0.1]/evidence",
    "https://[::ffff:10.0.0.1]/evidence",
  ]) {
    await expectCallableError(call("claimant1", "createSupplierOwnershipClaim", {
      ...validClaimInput(),
      referenceLinks: [referenceLink],
    }), "invalid-argument");
  }
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({
    accessExpiresAt: Timestamp.fromMillis(Date.now() - 1_000),
  });
  await expectCallableError(call("claimant1", "searchSupplierProfilesForClaim", { query: "acme" }), "permission-denied");
  await expectCallableError(call("forged", "createSupplierOwnershipClaim", validClaimInput()), "permission-denied");

  const claimInput = validClaimInput("profile-a", "stale-admin-claim-01");
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({ accessExpiresAt: FieldValue.delete() });
  const created = await call("claimant1", "createSupplierOwnershipClaim", claimInput);
  await adminAuth.updateUser(accounts.admin.uid, { emailVerified: false });
  try {
    await expectCallableError(call("admin", "decideSupplierOwnershipClaim", {
      claimId: created.claimId,
      decision: "approve",
      adminNotes: "Stale current Auth state must fail.",
    }), "permission-denied");
  } finally {
    await adminAuth.updateUser(accounts.admin.uid, { emailVerified: true });
  }
});

test("withdrawal requires current claimant eligibility and exact live lock consistency", async () => {
  const suspendedClaim = await call("claimant1", "createSupplierOwnershipClaim", validClaimInput());
  await adminDb.doc(`users/${accounts.claimant1.uid}`).update({ accessStatus: "suspended" });
  await expectCallableError(
    call("claimant1", "withdrawSupplierOwnershipClaim", { claimId: suspendedClaim.claimId }),
    "permission-denied",
  );
  assert.equal((await adminDb.doc(`supplierOwnershipClaims/${suspendedClaim.claimId}`).get()).data().status, "pending_review");

  await adminDb.doc(`users/${accounts.claimant2.uid}`).update({ accessStatus: "active" });
  const mismatchClaim = await call("claimant2", "createSupplierOwnershipClaim", validClaimInput("profile-b"));
  await adminDb.doc(`supplierClaimantLocks/${accounts.claimant2.uid}`).update({ supplierProfileId: "profile-a" });
  await expectCallableError(
    call("claimant2", "withdrawSupplierOwnershipClaim", { claimId: mismatchClaim.claimId }),
    "failed-precondition",
  );
  assert.equal((await adminDb.doc(`supplierOwnershipClaims/${mismatchClaim.claimId}`).get()).data().status, "pending_review");
});

test("trusted duplicate checks are bounded, role-restricted, and return no normalized contact data", async () => {
  const [check] = (await call("buyer", "checkSupplierDuplicatesTrusted", {
    items: [{ supplierData: approvalSupplierData("Acme Industrial", {
      email: "private@example.test",
      normalizedEmail: "forged@example.test",
    }) }],
  })).checks;
  assert.equal(check.hasPossibleDuplicate, true);
  assert.ok(check.matches.length <= 6);
  for (const match of check.matches) {
    assert.deepEqual(Object.keys(match).sort(), ["confidence", "reason", "score", "supplierId", "supplierName"]);
    assert.equal("normalizedEmail" in match, false);
    assert.equal("normalizedPhones" in match, false);
  }
  await expectCallableError(call("forged", "checkSupplierDuplicatesTrusted", {
    items: [{ supplierData: approvalSupplierData("Acme Industrial") }],
  }), "permission-denied");
  await expectCallableError(call("buyer", "checkSupplierDuplicatesTrusted", { items: [] }), "invalid-argument");
  await expectCallableError(call("buyer", "checkSupplierDuplicatesTrusted", {
    items: Array.from({ length: 51 }, () => ({ supplierData: approvalSupplierData("Bounded Supplier") })),
  }), "invalid-argument");
});

test("trusted approval rejects malformed nested Supplier payloads atomically", async () => {
  const invalidCases = [
    ["nested-special-key", {
      branches: [{ governorate: "baghdad", city: "baghdad", prototype: "unsafe" }],
    }],
    ["unexpected-root-field", { unexpectedRootField: "unsafe" }],
    ["oversized-array", {
      categories: Array.from({ length: 21 }, (_, index) => `category-${index}`),
    }],
  ];
  for (const [suffix, supplierDataOverrides] of invalidCases) {
    const submissionId = `invalid-supplier-${suffix}`;
    await seedApprovalSubmission(submissionId, "buyer", supplierDataOverrides);
    await expectCallableError(
      call("admin", "approveSupplierSubmissionTrusted", { submissionId }),
      "invalid-argument",
    );
    for (const documentPath of [
      `suppliers/${submissionSideEffectId(submissionId, "profile")}`,
      `auditLogs/${submissionSideEffectId(submissionId, "audit")}`,
      `notifications/${submissionSideEffectId(submissionId, "notification")}`,
      `contributionLogs/${submissionSideEffectId(submissionId, "contribution")}`,
    ]) {
      assert.equal((await adminDb.doc(documentPath).get()).exists, false);
    }
  }
  const buyer = (await adminDb.doc(`users/${accounts.buyer.uid}`).get()).data();
  assert.equal(buyer.approvedSubmissions, 0);
  assert.equal(buyer.approvedNewSupplierContributions, 0);
});

test("parallel approval of different submission IDs creates exactly one Supplier and one side-effect set", async () => {
  const shared = {
    nameOriginal: "Canonical Concurrent Company",
    displayName: "Canonical Concurrent Company",
    nameEn: "Canonical Concurrent Company",
    email: "canonical-concurrent@example.test",
    phones: ["+9647711111111"],
  };
  await seedApprovalSubmission("duplicate-submission-a", "buyer", shared);
  await seedApprovalSubmission("duplicate-submission-b", "buyer", shared);
  const outcomes = await Promise.allSettled([
    call("admin", "approveSupplierSubmissionTrusted", { submissionId: "duplicate-submission-a" }),
    call("owner", "approveSupplierSubmissionTrusted", { submissionId: "duplicate-submission-b" }),
  ]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  const supplierIds = [
    submissionSideEffectId("duplicate-submission-a", "profile"),
    submissionSideEffectId("duplicate-submission-b", "profile"),
  ];
  const suppliers = await Promise.all(supplierIds.map((id) => adminDb.doc(`suppliers/${id}`).get()));
  assert.equal(suppliers.filter((item) => item.exists).length, 1);
  const createdSupplier = suppliers.find((item) => item.exists).data();
  assert.equal(createdSupplier.normalizedName, "canonical concurrent");
  assert.deepEqual(createdSupplier.normalizedPhones, ["9647711111111"]);
  assert.equal(createdSupplier.normalizedEmail, "canonical-concurrent@example.test");
  assert.notDeepEqual(createdSupplier.searchKeywords, ["forged"]);
  const buyer = (await adminDb.doc(`users/${accounts.buyer.uid}`).get()).data();
  assert.equal(buyer.approvedSubmissions, 1);
  assert.equal(buyer.approvedNewSupplierContributions, 1);
  for (const suffix of ["contribution", "notification", "audit"]) {
    const records = await Promise.all([
      adminDb.doc(`${suffix === "contribution" ? "contributionLogs" : suffix === "notification" ? "notifications" : "auditLogs"}/${submissionSideEffectId("duplicate-submission-a", suffix)}`).get(),
      adminDb.doc(`${suffix === "contribution" ? "contributionLogs" : suffix === "notification" ? "notifications" : "auditLogs"}/${submissionSideEffectId("duplicate-submission-b", suffix)}`).get(),
    ]);
    assert.equal(records.filter((item) => item.exists).length, 1);
  }
  assert.equal((await adminDb.collection("accessCredits").get()).empty, true);
  assert.equal((await adminDb.collection("accessGrants").get()).empty, true);
});

test("Supplier submission approval fails atomically for every ineligible contributor state", async () => {
  await seedApprovalSubmission("eligibility-unverified", "unverified", { nameOriginal: "Unverified Company", displayName: "Unverified Company", nameEn: "Unverified Company" });
  await seedApprovalSubmission("eligibility-suspended", "suspended", { nameOriginal: "Suspended Company", displayName: "Suspended Company", nameEn: "Suspended Company" });
  await seedApprovalSubmission("eligibility-expired", "expiredSupplier", { nameOriginal: "Expired Company", displayName: "Expired Company", nameEn: "Expired Company" });
  await seedApprovalSubmission("eligibility-linked", "claimant2", { nameOriginal: "Linked Company", displayName: "Linked Company", nameEn: "Linked Company" });
  await adminDb.doc(`users/${accounts.claimant2.uid}`).update({ supplierProfileId: "profile-b" });
  await adminDb.doc(`users/${accounts.unverified.uid}`).update({ emailVerified: true });
  await seedApprovalSubmission("eligibility-role", "invalidSupplier", { nameOriginal: "Invalid Role Company", displayName: "Invalid Role Company", nameEn: "Invalid Role Company" });
  await seedApprovalSubmission("eligibility-account-type", "invalidAccountType", { nameOriginal: "Invalid Type Company", displayName: "Invalid Type Company", nameEn: "Invalid Type Company" });

  const cases = [
    ["eligibility-unverified", "permission-denied"],
    ["eligibility-suspended", "permission-denied"],
    ["eligibility-expired", "permission-denied"],
    ["eligibility-linked", "failed-precondition"],
    ["eligibility-role", "permission-denied"],
    ["eligibility-account-type", "failed-precondition"],
  ];
  for (const [submissionId, code] of cases) {
    await expectCallableError(call("admin", "approveSupplierSubmissionTrusted", { submissionId }), code);
    assert.equal((await adminDb.doc(`suppliers/${submissionSideEffectId(submissionId, "profile")}`).get()).exists, false);
    assert.equal((await adminDb.doc(`auditLogs/${submissionSideEffectId(submissionId, "audit")}`).get()).exists, false);
    assert.equal((await adminDb.doc(`notifications/${submissionSideEffectId(submissionId, "notification")}`).get()).exists, false);
  }
});

test("trusted Supplier rejection requires a current Admin and writes one deterministic decision audit", async () => {
  await seedApprovalSubmission("decision-reject", "buyer", { nameOriginal: "Rejected Company", displayName: "Rejected Company", nameEn: "Rejected Company" });
  await adminDb.doc(`users/${accounts.admin.uid}`).update({ accessStatus: "suspended" });
  await expectCallableError(call("admin", "decideSupplierSubmissionTrusted", {
    submissionId: "decision-reject",
    decision: "rejected",
    adminNotes: "Synthetic rejection",
  }), "permission-denied");
  const result = await call("owner", "decideSupplierSubmissionTrusted", {
    submissionId: "decision-reject",
    decision: "rejected",
    adminNotes: "Synthetic rejection",
  });
  assert.equal(result.idempotent, false);
  const repeated = await call("owner", "decideSupplierSubmissionTrusted", {
    submissionId: "decision-reject",
    decision: "rejected",
    adminNotes: "Synthetic rejection",
  });
  assert.equal(repeated.idempotent, true);
  assert.equal((await adminDb.doc(`supplierSubmissions/decision-reject`).get()).data().reviewedBy, accounts.owner.uid);
  assert.equal((await adminDb.doc(`auditLogs/${submissionSideEffectId("decision-reject", "decision-rejected-audit")}`).get()).exists, true);
});

test("trusted role/status changes deny escalation, protect the final usable Owner, and reactivate Suppliers safely", async () => {
  await expectCallableError(call("admin", "setUserRoleAndStatusTrusted", {
    userId: accounts.admin.uid,
    role: "owner",
    status: "approved",
  }), "permission-denied");
  await expectCallableError(call("owner", "setUserRoleAndStatusTrusted", {
    userId: accounts.owner.uid,
    role: "contributor",
    status: "approved",
  }), "failed-precondition");
  await adminDb.doc(`users/${accounts.owner2.uid}`).update({
    status: "approved",
    accessStatus: "active",
  });
  await adminAuth.updateUser(accounts.owner2.uid, { disabled: true });
  try {
    await expectCallableError(call("owner", "setUserRoleAndStatusTrusted", {
      userId: accounts.owner.uid,
      role: "contributor",
      status: "approved",
    }), "failed-precondition");
  } finally {
    await adminAuth.updateUser(accounts.owner2.uid, { disabled: false });
    await adminDb.doc(`users/${accounts.owner2.uid}`).update({
      status: "suspended",
      accessStatus: "suspended",
    });
  }
  await expectCallableError(call("owner", "setUserRoleAndStatusTrusted", {
    userId: accounts.claimant1.uid,
    role: "admin",
    status: "approved",
  }), "failed-precondition");

  await adminDb.doc(`users/${accounts.claimant2.uid}`).update({ supplierProfileId: "profile-b" });
  await adminDb.doc("suppliers/profile-b").update({ accountOwnerId: accounts.claimant2.uid, canReceiveRfqs: true });
  await call("admin", "setUserRoleAndStatusTrusted", {
    userId: accounts.claimant2.uid,
    role: "contributor",
    status: "suspended",
  });
  await call("admin", "setUserRoleAndStatusTrusted", {
    userId: accounts.claimant2.uid,
    role: "contributor",
    status: "approved",
  });
  const user = (await adminDb.doc(`users/${accounts.claimant2.uid}`).get()).data();
  const supplier = (await adminDb.doc("suppliers/profile-b").get()).data();
  assert.equal(user.accessStatus, "pending");
  assert.equal(supplier.canReceiveRfqs, false);
});
