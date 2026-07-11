import test from "node:test";
import assert from "node:assert/strict";
import type { AppUser } from "../src/types/domain.ts";
import { canAccessPortalRole, portalHome, resolvePortalRole } from "../src/utils/authorization.ts";

function user(patch: Partial<AppUser>): AppUser {
  return {
    uid: "user-1",
    email: "user@example.com",
    fullName: "Test User",
    phone: "",
    jobTitle: "",
    organization: "",
    governorate: "",
    sector: "",
    role: "contributor",
    status: "approved",
    accessStatus: "temporary",
    accessExpiresAt: null,
    trustScore: 0,
    points: 0,
    qualityRatio: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    duplicateSubmissions: 0,
    approvedReviews: 0,
    approvedNewSupplierContributions: 0,
    consumedApprovedSupplierContributions: 0,
    badges: [],
    createdAt: null,
    updatedAt: null,
    ...patch,
  };
}

test("owner is always resolved as super admin", () => {
  const profile = user({ role: "owner", accountType: "supplier" });
  assert.equal(resolvePortalRole(profile), "super_admin");
  assert.equal(portalHome(profile), "/super-admin");
});

test("admin role takes precedence over account type", () => {
  const profile = user({ role: "admin", accountType: "buyer" });
  assert.equal(resolvePortalRole(profile), "admin");
  assert.equal(portalHome(profile), "/admin");
});

test("buyer and supplier accounts have separate homes", () => {
  assert.equal(portalHome(user({ accountType: "buyer" })), "/buyer");
  assert.equal(portalHome(user({ accountType: "supplier" })), "/supplier");
});

test("legacy contributor without accountType is treated as buyer", () => {
  assert.equal(resolvePortalRole(user({ accountType: undefined })), "buyer");
});

test("unknown accountType fails closed", () => {
  const profile = user({ accountType: "invalid" as AppUser["accountType"] });
  assert.equal(resolvePortalRole(profile), null);
  assert.equal(portalHome(profile), "/no-access?reason=invalid-account-type");
});

test("role allow-list blocks cross-role access", () => {
  assert.equal(canAccessPortalRole("buyer", ["buyer"]), true);
  assert.equal(canAccessPortalRole("buyer", ["supplier"]), false);
  assert.equal(canAccessPortalRole("admin", ["admin", "super_admin"]), true);
  assert.equal(canAccessPortalRole("admin", ["super_admin"]), false);
});
