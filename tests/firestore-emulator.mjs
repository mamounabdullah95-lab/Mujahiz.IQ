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
  doc,
  setDoc,
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

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all(Object.values(users).map((user) => setDoc(doc(database, "users", user.uid), user)));
  });
});

after(async () => {
  await environment?.cleanup();
});

function contextFor(key) {
  const user = users[key];
  return environment.authenticatedContext(user.uid, { email: `${user.uid}@example.test` }).firestore();
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