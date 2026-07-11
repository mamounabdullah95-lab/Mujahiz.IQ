import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");

test("buyer, supplier, admin, and owner workflow routes are active", () => {
  for (const route of [
    "buyer/favorites", "buyer/rfqs", "buyer/messages",
    "supplier/products", "supplier/documents", "supplier/rfqs",
    "admin/reports", "super-admin/roles", "super-admin/branding", "super-admin/content",
  ]) assert.ok(app.includes('path="' + route + '"'));
});

test("email verification and missing-profile recovery routes exist", () => {
  assert.match(app, /path="verify-email"/);
  assert.match(app, /path="complete-profile"/);
});
