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
test("buyer metrics link to access, favorites, RFQs, profile, and submissions", () => {
  const buyer = read("src/pages/BuyerDashboardPage.tsx");
  assert.match(buyer, /label=\{text\.access\}[\s\S]*?to="\/my-access"/);
  assert.match(buyer, /label=\{text\.favorites\}[\s\S]*?to="\/buyer\/favorites"/);
  assert.match(buyer, /label=\{text\.rfqs\}[\s\S]*?to="\/buyer\/rfqs"/);
  assert.match(buyer, /label=\{text\.profile\}[\s\S]*?to="\/profile"/);
  assert.match(buyer, /to="\/buyer\/suppliers\/submissions"/);
});

test("buyer access summary prefers the extended access expiry over the original trial expiry", () => {
  const buyer = read("src/pages/BuyerDashboardPage.tsx");
  const accessIndex = buyer.indexOf("const accessExpiresAt = toDate(appUser.accessExpiresAt)");
  const trialFallbackIndex = buyer.indexOf("trialEndsAt", accessIndex);
  assert.ok(accessIndex >= 0, "the access expiry must be the primary date");
  assert.ok(trialFallbackIndex > accessIndex, "the trial expiry must only be a fallback");
  assert.doesNotMatch(buyer, /const trialEndsAt = toDate\(appUser\.trialEndsAt\) \|\| toDate\(appUser\.accessExpiresAt\)/);
});

test("supplier metrics link to profile, submissions, RFQs, analytics, and messages", () => {
  const supplier = read("src/pages/SupplierDashboardPage.tsx");
  assert.match(supplier, /listSupplierRfqs/);
  assert.match(supplier, /label=\{text\.completion\}[\s\S]*?to="\/profile"/);
  assert.match(supplier, /label=\{text\.companyStatus\}[\s\S]*?to="\/my-submissions"/);
  assert.match(supplier, /label=\{text\.rfqs\}[\s\S]*?to="\/supplier\/rfqs"/);
  assert.match(supplier, /label=\{text\.views\}[\s\S]*?to="\/supplier\/analytics"/);
  assert.match(supplier, /label=\{text\.inquiries\}[\s\S]*?to="\/supplier\/messages"/);
});
