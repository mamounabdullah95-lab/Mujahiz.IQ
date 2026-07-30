import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");

test("self registration only accepts buyer or supplier account types", () => {
  assert.match(rules, /request\.resource\.data\.accountType in \["buyer", "supplier"\]/);
});

test("accountType is not self editable", () => {
  const editableFields = rules.match(/function onlySelfEditableProfileFields\(\)[\s\S]*?\]\);/)?.[0] || "";
  assert.equal(editableFields.includes('"accountType"'), false);
});

test("company submission creation supports buyers, suppliers, and admins", () => {
  assert.match(rules, /function canSubmitCompany\(\)[\s\S]*?\(isBuyer\(\) \|\| isSupplierAccount\(\) \|\| isAdmin\(\)\)/);
  const submissionRules = rules.match(/match \/supplierSubmissions\/\{submissionId\}[\s\S]*?(?=\n    match \/)/)?.[0] || "";
  assert.match(submissionRules, /canSubmitCompany\(\)/);
  assert.match(submissionRules, /validExcelImportSubmission/);
});

test("review creation is buyer only", () => {
  assert.match(rules, /match \/reviews\/\{reviewId\}[\s\S]*?allow create: if isBuyer\(\)/);
});

test("all role, status, and access changes require the trusted backend", () => {
  const userRules = rules.match(/match \/users\/\{userId\}[\s\S]*?(?=\n    match \/)/)?.[0] || "";
  assert.match(userRules, /allow update: if isSelf\(userId\)/);
  assert.match(userRules, /onlySelfEditableProfileFields\(\)/);
  const updateRule = userRules.match(/allow update:[^;]+;/)?.[0] || "";
  assert.doesNotMatch(updateRule, /isAdmin\(\)/);
  assert.match(userRules, /allow delete: if false;/);
});

test("audit logs remain append-only", () => {
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*?allow update, delete: if false;/);
});
