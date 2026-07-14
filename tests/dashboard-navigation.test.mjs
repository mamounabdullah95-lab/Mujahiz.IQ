import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard metric cards support accessible route navigation", () => {
  const primitives = read("src/components/DashboardPrimitives.tsx");
  assert.match(primitives, /to\?: string/);
  assert.match(primitives, /return to \? <Link className=\{className\} to=\{to\}>/);
  assert.match(primitives, /focus-visible:ring-2/);
});

test("admin and owner metrics link to their operational destinations", () => {
  const admin = read("src/pages/AdminOperationsDashboardPage.tsx");
  const owner = read("src/pages/SuperAdminDashboardPage.tsx");
  assert.match(admin, /pendingCompanies[\s\S]*?to="\/admin\/submissions"/);
  assert.match(admin, /pendingReviews[\s\S]*?to="\/admin\/reviews"/);
  assert.match(admin, /pendingFeedback[\s\S]*?to="\/admin\/supplier-feedback"/);
  assert.match(owner, /pendingCompanies[\s\S]*?to="\/admin\/submissions"/);
  assert.match(owner, /approvedSuppliers[\s\S]*?to="\/admin\/suppliers"/);
});

test("company approvals are always visible in admin and owner sidebars", () => {
  const navigation = read("src/config/portalNavigation.ts");
  const matches = navigation.match(/to: "\/admin\/submissions"/g) ?? [];
  assert.equal(matches.length, 2);
  assert.match(navigation, /طلبات اعتماد الشركات/);
  assert.match(navigation, /Company approvals/);
});
