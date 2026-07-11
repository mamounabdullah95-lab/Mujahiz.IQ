import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");

test("each portal role has a dedicated dashboard route", () => {
  for (const route of ["buyer", "supplier", "admin", "super-admin"]) {
    assert.ok(app.includes(`path=\"${route}\"`), `missing /${route}`);
  }
});

test("buyer and supplier routes use separate guards", () => {
  assert.match(app, /allowedRoles=\{\["buyer"\]\}/);
  assert.match(app, /allowedRoles=\{supplierRoles\}/);
});

test("super admin routes have a dedicated allow-list", () => {
  assert.match(app, /allowedRoles=\{superAdminRoles\}/);
  assert.ok(app.includes('path="super-admin/audit-logs"'));
});

test("legacy dashboard route resolves through the role router", () => {
  assert.match(app, /path="dashboard" element=\{<DashboardRouterPage \/>\}/);
});
