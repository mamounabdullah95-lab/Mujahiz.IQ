import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const trustedApproval = fs.readFileSync(new URL("../functions/src/supplierSubmissionApproval.ts", import.meta.url), "utf8");
const demoService = fs.readFileSync(new URL("../src/services/localDemo.ts", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");

test("first approved supplier profile is linked to a supplier account", () => {
  assert.match(trustedApproval, /const establishOwnership = contributor\.accountType === "supplier"[\s\S]*?supplierProfileId: supplierId/);
  assert.match(trustedApproval, /accountOwnerId: contributorId, canReceiveRfqs: true/);
  assert.match(demoService, /user\.accountType === "supplier" && !user\.supplierProfileId[\s\S]*?supplierProfileId: supplierId/);
});

test("supplier can only read the approved profile linked to their account", () => {
  assert.match(rules, /function isOwnSupplierProfile\(supplierId\)[\s\S]*?myUser\(\)\.supplierProfileId == supplierId[\s\S]*?supplierDoc\(supplierId\)\.data\.accountOwnerId == request\.auth\.uid/);
});

test("supplierProfileId is not a self-editable profile field", () => {
  const editableFields = rules.match(/function onlySelfEditableProfileFields\(\)[\s\S]*?\]\);/)?.[0] || "";
  assert.equal(editableFields.includes('"supplierProfileId"'), false);
});
