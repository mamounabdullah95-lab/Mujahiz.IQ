import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getVerificationResendCooldown,
  refreshVerifiedEmail,
  resendVerificationEmail,
  synchronizeVerifiedProfile,
  verificationErrorCode,
  verificationErrorMessage,
} from "../src/services/emailVerification.ts";
import { portalHome } from "../src/utils/authorization.ts";

const authContext = readFileSync(new URL("../src/contexts/AuthContext.tsx", import.meta.url), "utf8");
const registrationService = readFileSync(new URL("../src/services/registration.ts", import.meta.url), "utf8");
const verifyPage = readFileSync(new URL("../src/pages/VerifyEmailPage.tsx", import.meta.url), "utf8");
const rules = readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
const actionSettings = { url: "https://mujahiz.com/verify-email", handleCodeInApp: false };

function fakeUser(uid, { verified = false, verifiedAfterReload = verified } = {}) {
  const calls = { reload: 0, token: 0 };
  const user = {
    uid,
    emailVerified: verified,
    async reload() {
      calls.reload += 1;
      user.emailVerified = verifiedAfterReload;
    },
    async getIdToken(forceRefresh) {
      assert.equal(forceRefresh, true);
      calls.token += 1;
      return "test-token-not-logged";
    },
  };
  return { user, calls };
}

test("resend reloads Auth and calls the Firebase email API only for an unverified user", async () => {
  const { user, calls } = fakeUser("resend-unverified");
  const sent = [];
  let synchronized = 0;
  const cooldowns = new Map();
  const result = await resendVerificationEmail({
    user,
    getCurrentUser: () => user,
    synchronize: async () => { synchronized += 1; },
    actionSettings,
    sendEmail: async (recipient, settings) => sent.push({ recipient, settings }),
    cooldowns,
    now: () => 1_000,
  });

  assert.equal(result, "sent");
  assert.equal(calls.reload, 1);
  assert.equal(calls.token, 0);
  assert.equal(synchronized, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient, user);
  assert.deepEqual(sent[0].settings, actionSettings);
  assert.equal(getVerificationResendCooldown(user.uid, 1_000, cooldowns), 60);
});

test("resend does not send when reload shows that Auth is already verified", async () => {
  const { user, calls } = fakeUser("resend-already-verified", { verifiedAfterReload: true });
  let sent = 0;
  let synchronized = 0;
  const result = await resendVerificationEmail({
    user,
    getCurrentUser: () => user,
    synchronize: async () => { synchronized += 1; },
    actionSettings,
    sendEmail: async () => { sent += 1; },
    cooldowns: new Map(),
  });

  assert.equal(result, "already_verified");
  assert.equal(calls.reload, 1);
  assert.equal(calls.token, 1);
  assert.equal(synchronized, 1);
  assert.equal(sent, 0);
});

test("an already verified user bypasses resend cooldown and synchronizes immediately", async () => {
  const { user, calls } = fakeUser("verified-during-cooldown", { verifiedAfterReload: true });
  const cooldowns = new Map([[user.uid, 120_000]]);
  let sent = 0;
  let synchronized = 0;
  const result = await resendVerificationEmail({
    user,
    getCurrentUser: () => user,
    synchronize: async () => { synchronized += 1; },
    actionSettings,
    sendEmail: async () => { sent += 1; },
    cooldowns,
    now: () => 100_000,
  });

  assert.equal(result, "already_verified");
  assert.equal(calls.reload, 1);
  assert.equal(calls.token, 1);
  assert.equal(synchronized, 1);
  assert.equal(sent, 0);
});

test("verification refresh reloads first and never synchronizes an unverified Auth state", async () => {
  const { user, calls } = fakeUser("refresh-unverified");
  let synchronized = 0;
  const result = await refreshVerifiedEmail({
    user,
    getCurrentUser: () => user,
    synchronize: async () => { synchronized += 1; },
  });
  assert.equal(result, false);
  assert.equal(calls.reload, 1);
  assert.equal(calls.token, 0);
  assert.equal(synchronized, 0);
});

test("verification refresh force-refreshes the token and synchronizes a verified Auth state", async () => {
  const { user, calls } = fakeUser("refresh-verified", { verifiedAfterReload: true });
  let synchronized = 0;
  const result = await refreshVerifiedEmail({
    user,
    getCurrentUser: () => user,
    synchronize: async () => { synchronized += 1; },
  });
  assert.equal(result, true);
  assert.equal(calls.reload, 1);
  assert.equal(calls.token, 1);
  assert.equal(synchronized, 1);
});

test("a failed send shows no success state and does not start the resend cooldown", async () => {
  const { user } = fakeUser("resend-failure");
  const cooldowns = new Map();
  const failure = Object.assign(new Error("network"), { code: "auth/network-request-failed" });
  await assert.rejects(resendVerificationEmail({
    user,
    getCurrentUser: () => user,
    synchronize: async () => {},
    actionSettings,
    sendEmail: async () => { throw failure; },
    cooldowns,
    now: () => 5_000,
  }), failure);
  assert.equal(getVerificationResendCooldown(user.uid, 5_000, cooldowns), 0);
  assert.match(verifyPage, /const result = await sendVerification\(\);[\s\S]*?setMessage\(result === "sent"/);
});

test("resend cooldown blocks a second Firebase email request", async () => {
  const { user } = fakeUser("resend-cooldown");
  const cooldowns = new Map();
  let sent = 0;
  const dependencies = {
    user,
    getCurrentUser: () => user,
    synchronize: async () => {},
    actionSettings,
    sendEmail: async () => { sent += 1; },
    cooldowns,
    now: () => 10_000,
  };
  await resendVerificationEmail(dependencies);
  await assert.rejects(
    resendVerificationEmail(dependencies),
    (error) => verificationErrorCode(error) === "verification/resend-cooldown",
  );
  assert.equal(sent, 1);
});

test("known verification failures have clear localized messages", () => {
  assert.match(
    verificationErrorMessage({ code: "auth/too-many-requests" }, "en"),
    /Too many requests/,
  );
  assert.match(
    verificationErrorMessage({ code: "auth/expired-action-code" }, "ar"),
    /انتهت صلاحية/,
  );
  assert.match(verifyPage, /text\.resend/);
});

test("concurrent background synchronization is deduplicated and later retries remain possible", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const synchronize = async () => {
    calls += 1;
    await pending;
  };
  const first = synchronizeVerifiedProfile("deduplicated-sync", synchronize);
  const second = synchronizeVerifiedProfile("deduplicated-sync", synchronize);
  assert.equal(first, second);
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  await synchronizeVerifiedProfile("deduplicated-sync", synchronize);
  assert.equal(calls, 2);
});

test("Admin and Owner with null accountType route without Buyer or Supplier misclassification", () => {
  assert.equal(portalHome({ role: "admin", accountType: null }), "/admin");
  assert.equal(portalHome({ role: "owner", accountType: null }), "/super-admin");
  assert.match(verifyPage, /appUser\?\.role === "admin" \|\| appUser\?\.role === "owner"/);
});

test("registration and Rules keep Trial and audit writes deterministic and role-bound", () => {
  assert.match(registrationService, /profile\.role === "contributor"[\s\S]*?profile\.accountType === "buyer"/);
  assert.match(registrationService, /existingGrant\.exists\(\) \|\| existingAudit\.exists\(\)/);
  assert.match(registrationService, /details: \{ trialStarted: false \}/);
  assert.doesNotMatch(registrationService, /accountType: profile\.accountType \|\| null/);
  assert.match(rules, /before\.role == "contributor"[\s\S]*?before\.accountType == "buyer"/);
  assert.match(rules, /audit\.details\.keys\(\)\.hasOnly\(\["trialStarted"\]\)/);
  assert.match(rules, /allow update, delete: if false;/);
});

test("Auth uses the official Firebase SDK and centralized canonical ActionCodeSettings", () => {
  assert.match(authContext, /sendEmail: sendEmailVerification/);
  assert.match(authContext, /getEmailActionSettings\("\/verify-email"\)/);
  assert.match(authContext, /applyAuthLanguage\(appUser\?\.language\)/);
  assert.match(authContext, /if \(!verificationSynchronized\)[\s\S]*?synchronizeVerifiedProfile/);
});
