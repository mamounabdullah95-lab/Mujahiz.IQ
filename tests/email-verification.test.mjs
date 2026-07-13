import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authContext = readFileSync(new URL("../src/contexts/AuthContext.tsx", import.meta.url), "utf8");
const registrationService = readFileSync(new URL("../src/services/registration.ts", import.meta.url), "utf8");
const rules = readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");

test("verification reloads Auth and force-refreshes the ID token before Firestore sync", () => {
  assert.match(
    authContext,
    /await current\.reload\(\);[\s\S]*?await refreshed\.getIdToken\(true\);[\s\S]*?await activateVerifiedUser\(refreshed\.uid\)/,
  );
  assert.match(
    authContext,
    /if \(user\.emailVerified && profile\)[\s\S]*?await user\.getIdToken\(true\);[\s\S]*?await activateVerifiedUser\(user\.uid\)/,
  );
});

test("Firestore email verification remains stale until synchronization succeeds", () => {
  assert.match(authContext, /verificationSynchronized = Boolean\(profile\?\.emailVerified\)/);
  assert.match(authContext, /setVerified\(verificationSynchronized\)/);
});

test("new buyers receive one deterministic trial grant and audit record", () => {
  assert.match(registrationService, /profile\.accountType === "buyer"/);
  assert.match(registrationService, /doc\(db, "accessGrants", `trial-\$\{uid\}`\)/);
  assert.match(registrationService, /doc\(db, "accessCredits", `trial-\$\{uid\}`\)/);
  assert.match(registrationService, /doc\(db, "auditLogs", `email-verification-\$\{uid\}`\)/);
  assert.match(registrationService, /if \(profile\.emailVerified === true\) return;/);
  assert.match(registrationService, /trialAlreadyGranted = existingGrant\.exists\(\)/);
});

test("supplier verification updates email state without buyer trial fields", () => {
  assert.match(
    registrationService,
    /if \(!isNewBuyer \|\| trialAlreadyGranted\)[\s\S]*?emailVerified: true[\s\S]*?action: "user\.email_verified"[\s\S]*?return;/,
  );
  const emailOnlyBranch = registrationService.match(/if \(!isNewBuyer \|\| trialAlreadyGranted\)[\s\S]*?\n    }\n\n    const now/)?.[0] || "";
  assert.equal(emailOnlyBranch.includes("trialStartedAt:"), false);
  assert.equal(emailOnlyBranch.includes("accessExpiresAt:"), false);
});

test("rules separate email-only sync from buyer trial activation", () => {
  assert.match(rules, /function isValidEmailVerificationSync\(\)/);
  assert.match(rules, /function isValidBuyerTrialActivation\(\)[\s\S]*?resource\.data\.accountType == "buyer"/);
  assert.match(rules, /documentId == "trial-" \+ request\.auth\.uid/);
  assert.match(rules, /documentId == "email-verification-" \+ request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.action in \["user\.email_verified", "user\.email_verified_trial_started"\]/);
});
