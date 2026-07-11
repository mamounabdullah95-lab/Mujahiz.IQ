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
  assert.match(rules, /match \/supplierSubmissions\/\{submissionId\}[\s\S]*?allow create: if canSubmitCompany\(\)/);
});

test("review creation is buyer only", () => {
  assert.match(rules, /match \/reviews\/\{reviewId\}[\s\S]*?allow create: if isBuyer\(\)/);
});

test("regular admins cannot modify admin or owner roles", () => {
  assert.match(rules, /resource\.data\.role in \["contributor", "viewer", "suspended"\]/);
  assert.match(rules, /request\.resource\.data\.role in \["contributor", "viewer", "suspended"\]/);
});

test("audit logs remain append-only", () => {
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*?allow update, delete: if false;/);
});
