import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  filterSuppliersForAdmin,
  normalizeSupplierAdminQuery,
  supplierMatchesAdminQuery,
} from "../src/utils/supplierAdminSearch.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const supplier = {
  id: "SUP-ABC-2026",
  nameAr: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0627\u0641\u062f\u064a\u0646 \u0644\u0644\u0642\u064a\u0627\u0633",
  nameEn: "Rafidain Control Systems",
  nameOriginal: "Al Rafidain Instrumentation",
  displayName: "Rafidain Control",
  email: "Sales@Rafidain.example",
  normalizedEmail: "sales@rafidain.example",
  phones: ["+964 770 123 4567"],
  normalizedPhones: ["9647701234567"],
  whatsappNumber: "+964 780 765 4321",
  contactPerson: "Ali Hassan",
  contactPersonRole: "Sales manager",
  governorate: "baghdad",
  governorates: ["baghdad", "basra"],
  city: "Karrada",
  marketArea: "Industrial district",
  address: "Street 62",
  branches: [{ governorate: "erbil", city: "Ankawa", phone: "+964 750 100 2000" }],
  categories: ["instrumentation"],
  subcategories: ["pressure_gauges"],
  capabilityTags: ["technical_support"],
  searchKeywords: ["differential pressure"],
  relatedMaterialService: "Mechanical gauges",
  sourceSummary: "UAT controlled supplier",
  sourceNote: "Registration UAT-SUPPLIER-20260719-01",
  uatIdentifier: "UAT-SUPPLIER-20260719-01",
};

test("admin supplier search normalizes whitespace and letter case", () => {
  assert.equal(normalizeSupplierAdminQuery("  RAFIDAIN   Control  "), "rafidain control");
  assert.ok(supplierMatchesAdminQuery(supplier, " RAFIDAIN   systems "));
});

test("admin supplier search matches Arabic and English company names", () => {
  assert.ok(supplierMatchesAdminQuery(supplier, "\u0627\u0644\u0631\u0627\u0641\u062f\u064a\u0646"));
  assert.ok(supplierMatchesAdminQuery(supplier, "control systems"));
});

test("admin supplier search matches IDs, contact data, locations, categories, and references", () => {
  for (const query of [
    "SUP-ABC-2026",
    "sales@rafidain.example",
    "770 123",
    "780765",
    "Ali Hassan",
    "Ankawa",
    "instrumentation",
    "technical_support",
    "UAT-SUPPLIER-20260719-01",
  ]) assert.ok(supplierMatchesAdminQuery(supplier, query), query);
});

test("admin supplier search returns a correct empty result", () => {
  assert.deepEqual(filterSuppliersForAdmin([supplier], "unrelated company"), []);
  assert.deepEqual(filterSuppliersForAdmin([supplier], ""), [supplier]);
});

test("admin and owner supplier page honors URL query changes with local filtering", () => {
  const page = read("src/pages/admin/AdminApprovedSuppliersPage.tsx");
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /searchParams\.get\("q"\)/);
  assert.match(page, /filterSuppliersForAdmin\(suppliers, query\)/);
  assert.match(page, /setSearchParams\(next, \{ replace \}\)/);
  assert.match(page, /updateSearchQuery\("", false\)/);
  assert.match(page, /filteredSuppliers\.map/);
  assert.match(page, /filteredSuppliers\.filter/);
  assert.equal((page.match(/listSuppliers\(\)/g) || []).length, 1);
});

test("portal search routes buyers and administrators while hiding the misleading supplier control", () => {
  const shell = read("src/components/AppLayoutV2.tsx");
  const directory = read("src/pages/DirectoryPage.tsx");
  assert.match(shell, /role === "buyer"\) navigate\(`\/directory\?q=/);
  assert.match(shell, /role === "admin" \|\| role === "super_admin"/);
  assert.match(shell, /role !== "supplier" \? \(/);
  assert.doesNotMatch(shell, /navigate\("\/supplier"\)/);
  assert.match(directory, /useSearchParams\(\)/);
  assert.match(directory, /searchParams\.get\("q"\)/);
  assert.match(directory, /\}, \[searchParams\]\);/);
});

test("future supplier approval notifications use the role-safe submissions route", () => {
  const service = read("src/services/firestore.ts");
  const app = read("src/AppV2.tsx");
  assert.match(service, /userId: submission\.submittedBy/);
  assert.match(service, /link: "\/my-submissions"/);
  assert.doesNotMatch(service, /link: "\/buyer\/suppliers\/submissions"/);
  assert.match(app, /allowedRoles=\{supplierRoles\}[\s\S]*?path="my-submissions"/);
});

test("notifications remain one self-only bounded source with loading, error, and empty states", () => {
  const bootstrap = read("src/bootstrap.tsx");
  const provider = read("src/contexts/NotificationContext.tsx");
  const workspace = read("src/services/workspace.ts");
  const bell = read("src/components/NotificationBell.tsx");
  assert.equal((bootstrap.match(/<NotificationProvider>/g) || []).length, 1);
  assert.equal((provider.match(/subscribeNotifications\(/g) || []).length, 1);
  assert.match(provider, /unsubscribe\(\)/);
  assert.match(workspace, /where\("userId", "==", userId\)/);
  assert.doesNotMatch(provider, /setInterval|setTimeout/);
  assert.match(bell, /loading/);
  assert.match(bell, /error/);
  assert.match(bell, /items\.length/);
});

test("approval recipient stays the supplier and no admin cross-user notification is introduced", () => {
  const service = read("src/services/firestore.ts");
  const approvalStart = service.indexOf("export async function approveSupplierSubmission");
  const approvalEnd = service.indexOf("export async function rejectSupplierSubmission", approvalStart);
  const approval = service.slice(approvalStart, approvalEnd);
  assert.match(approval, /userId: submission\.submittedBy/);
  assert.doesNotMatch(approval, /reviewNotifications|adminIds|ownerIds|super_admin/);
});

