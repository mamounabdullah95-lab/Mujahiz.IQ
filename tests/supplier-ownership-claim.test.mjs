import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EVIDENCE_TYPES,
  MAX_CONFLICTING_CLAIMS,
  OwnershipValidationError,
  isClaimExpired,
  normalizeSupplierSearchQuery,
  ownershipAuditId,
  ownershipEventId,
  ownershipNotificationId,
  resolveDecisionTransition,
  sanitizeBoundedText,
  submissionSideEffectId,
  terminalStatusReleasesLock,
  validateClaimInput,
  validateReferenceLinks,
} from "../functions/src/supplierOwnershipCore.js";

const claimFunctionSource = fs.readFileSync(
  new URL("../functions/src/supplierOwnership.ts", import.meta.url),
  "utf8",
);
const appRoutesSource = fs.readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");
const appNavigationSource = fs.readFileSync(
  new URL("../src/components/AppLayoutV2.tsx", import.meta.url),
  "utf8",
);

const validClaim = {
  supplierProfileId: "supplier-profile-1",
  claimReason: "I am authorized to manage this Supplier company profile.",
  evidenceType: "company_domain_email",
  evidenceSummary: "My verified company role and domain establish this relationship.",
  referenceLinks: ["https://example.test/about"],
};

test("claim input is bounded, sanitized, and preserves only supported evidence", () => {
  const result = validateClaimInput({
    ...validClaim,
    claimReason: "  Authorized\u0000   company representative with supporting records.  ",
  });
  assert.equal(result.claimReason, "Authorized company representative with supporting records.");
  assert.deepEqual(EVIDENCE_TYPES, [
    "company_domain_email",
    "company_website",
    "commercial_registration",
    "authorization_letter",
    "other",
  ]);
  assert.throws(() => validateClaimInput({ ...validClaim, evidenceType: "email_match" }), OwnershipValidationError);
  assert.throws(() => validateClaimInput({ ...validClaim, claimReason: "too short" }), /20-1200/);
  assert.throws(() => sanitizeBoundedText("x".repeat(1601), "evidenceSummary", 20, 1600), /20-1600/);
});

test("reference evidence is HTTPS-only, unique, bounded, and never accepts embedded data", () => {
  assert.deepEqual(validateReferenceLinks(["https://example.test/evidence"]), ["https://example.test/evidence"]);
  assert.throws(() => validateReferenceLinks(["http://example.test"]), /HTTPS/);
  assert.throws(() => validateReferenceLinks(["data:text/plain;base64,Zm9yZ2Vk"]), /HTTPS/);
  assert.throws(() => validateReferenceLinks(["https://user:secret@example.test"]), /without credentials/);
  assert.throws(() => validateReferenceLinks([
    "https://one.example.test",
    "https://two.example.test",
    "https://three.example.test",
    "https://four.example.test",
  ]), /no more than 3/);
  assert.throws(() => validateReferenceLinks(["https://example.test", "https://example.test"]), /Duplicate/);
});

test("claim search normalization matches the directory index and contains no contact matching", () => {
  assert.equal(normalizeSupplierSearchQuery("  ACME Company & Industrial  "), "acme and industrial");
  assert.equal(normalizeSupplierSearchQuery("\u0623\u0641\u0642"), "\u0627\u0641\u0642");
  assert.throws(() => normalizeSupplierSearchQuery("a"), /2-80/);
  assert.throws(() => normalizeSupplierSearchQuery("x".repeat(81)), /2-80/);
});

test("claim search never reads the duplicate/contact index and PR1 exposes no route or navigation", () => {
  assert.doesNotMatch(claimFunctionSource, /supplierDuplicateIndex/);
  assert.doesNotMatch(appRoutesSource, /supplierProfileClaim|supplierOwnershipClaim|claim-supplier/i);
  assert.doesNotMatch(appNavigationSource, /supplierProfileClaim|supplierOwnershipClaim|claim-supplier/i);
});

test("the decision state machine permits only pending to approved or rejected", () => {
  assert.deepEqual(resolveDecisionTransition("pending_review", "approve"), {
    targetStatus: "approved",
    idempotent: false,
  });
  assert.deepEqual(resolveDecisionTransition("pending_review", "reject"), {
    targetStatus: "rejected",
    idempotent: false,
  });
  for (const status of ["withdrawn", "expired", "superseded"]) {
    assert.throws(() => resolveDecisionTransition(status, "approve"), /cannot transition/);
    assert.throws(() => resolveDecisionTransition(status, "reject"), /cannot transition/);
  }
});

test("identical terminal decisions are idempotent and different later decisions fail", () => {
  assert.deepEqual(resolveDecisionTransition("approved", "approve"), {
    targetStatus: "approved",
    idempotent: true,
  });
  assert.deepEqual(resolveDecisionTransition("rejected", "reject"), {
    targetStatus: "rejected",
    idempotent: true,
  });
  assert.throws(() => resolveDecisionTransition("approved", "reject"), /cannot transition/);
  assert.throws(() => resolveDecisionTransition("rejected", "approve"), /cannot transition/);
});

test("deterministic ownership and submission side-effect IDs are stable", () => {
  assert.equal(ownershipEventId("claim-1", "approved"), "supplier-ownership-claim-1-approved");
  assert.equal(ownershipAuditId("claim-1", "approved"), "supplier-ownership-claim-1-approved-audit");
  assert.equal(ownershipNotificationId("claim-1", "approved"), "supplier-ownership-claim-1-approved-notification");
  assert.equal(submissionSideEffectId("submission-1", "profile"), "supplier-submission-submission-1-profile");
  assert.equal(MAX_CONFLICTING_CLAIMS, 20);
});

test("expiry is fail closed and every terminal status releases its claimant lock", () => {
  assert.equal(isClaimExpired(999, 1000), true);
  assert.equal(isClaimExpired(1001, 1000), false);
  assert.equal(isClaimExpired(Number.NaN, 1000), true);
  for (const status of ["approved", "rejected", "withdrawn", "expired", "superseded"]) {
    assert.equal(terminalStatusReleasesLock(status), true);
  }
  assert.equal(terminalStatusReleasesLock("pending_review"), false);
});
