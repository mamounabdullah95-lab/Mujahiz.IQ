import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildResetPasswordSearch,
  completeEmailAction,
  emailActionErrorState,
  parseEmailAction,
  safeContinuePath,
} from "../src/services/emailActions.ts";

const app = readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/AppLayoutV2.tsx", import.meta.url), "utf8");
const actionPage = readFileSync(new URL("../src/pages/EmailActionPage.tsx", import.meta.url), "utf8");
const actionService = readFileSync(new URL("../src/services/emailActions.ts", import.meta.url), "utf8");
const actionSources = `${actionPage}\n${actionService}`;

function firebaseError(code) {
  return Object.assign(new Error("Synthetic Firebase error"), { code });
}

test("unified email action handler is a public route without broadening protected routes", () => {
  assert.match(app, /path="auth\/action" element=\{<EmailActionPage \/>\}/);
  assert.match(layout, /"\/auth\/action"/);
  assert.doesNotMatch(actionPage, /RoleProtectedRoute|allowedRoles|requireAccess|allowPending/);
});

test("resetPassword is safely routed into the existing reset completion UI", () => {
  const action = parseEmailAction(
    "?mode=resetPassword&oobCode=synthetic-code&continueUrl=https%3A%2F%2Fmujahiz.com%2Flogin&lang=en&apiKey=synthetic-api-key",
  );
  const search = buildResetPasswordSearch(action);

  assert.equal(action.mode, "resetPassword");
  assert.match(search, /^\?mode=resetPassword&oobCode=synthetic-code/);
  assert.match(search, /continueUrl=%2Flogin/);
  assert.match(search, /lang=en/);
  assert.doesNotMatch(search, /apiKey|synthetic-api-key/);
  assert.match(actionPage, /navigate\(`\/reset-password\$\{buildResetPasswordSearch\(action\)\}`/);
});

test("verifyEmail checks the operation and applies a valid code exactly once", async () => {
  const action = parseEmailAction("?mode=verifyEmail&oobCode=verify-code");
  const calls = [];
  const result = await completeEmailAction({
    action,
    checkCode: async (code) => {
      calls.push(["check", code]);
      return { operation: "VERIFY_EMAIL" };
    },
    applyCode: async (code) => {
      calls.push(["apply", code]);
    },
  });

  assert.equal(result, "success");
  assert.deepEqual(calls, [["check", "verify-code"], ["apply", "verify-code"]]);
});

test("verifyEmail exposes safe invalid, expired, and already-used states", async () => {
  for (const [code, expected] of [
    ["auth/invalid-action-code", "invalid"],
    ["auth/expired-action-code", "expired"],
  ]) {
    const result = await completeEmailAction({
      action: parseEmailAction("?mode=verifyEmail&oobCode=verify-code"),
      checkCode: async () => {
        throw firebaseError(code);
      },
      applyCode: async () => {},
    });
    assert.equal(result, expected);
  }

  const used = await completeEmailAction({
    action: parseEmailAction("?mode=verifyEmail&oobCode=verify-code"),
    checkCode: async () => ({ operation: "VERIFY_EMAIL" }),
    applyCode: async () => {
      throw firebaseError("auth/invalid-action-code");
    },
  });
  assert.equal(used, "used");
  assert.match(actionPage, /invalid: "This link is invalid or has already been used/);
  assert.match(actionPage, /used: "This link has already been used/);
});

test("recoverEmail inspects the code before applying it and never sends a password reset", async () => {
  const action = parseEmailAction("?mode=recoverEmail&oobCode=recovery-code");
  const calls = [];
  const result = await completeEmailAction({
    action,
    checkCode: async (code) => {
      calls.push(["check", code]);
      return { operation: "RECOVER_EMAIL", data: { email: "not-rendered@example.test" } };
    },
    applyCode: async (code) => {
      calls.push(["apply", code]);
    },
  });

  assert.equal(result, "success");
  assert.deepEqual(calls, [["check", "recovery-code"], ["apply", "recovery-code"]]);
  assert.doesNotMatch(actionSources, /sendPasswordResetEmail/);
  assert.doesNotMatch(actionPage, /information\.data|restoredEmail|previousEmail/);
});

test("recoverEmail rejects invalid and mismatched action codes without applying them", async () => {
  let applied = 0;
  const invalid = await completeEmailAction({
    action: parseEmailAction("?mode=recoverEmail&oobCode=recovery-code"),
    checkCode: async () => {
      throw firebaseError("auth/invalid-action-code");
    },
    applyCode: async () => {
      applied += 1;
    },
  });
  const mismatched = await completeEmailAction({
    action: parseEmailAction("?mode=recoverEmail&oobCode=verification-code"),
    checkCode: async () => ({ operation: "VERIFY_EMAIL" }),
    applyCode: async () => {
      applied += 1;
    },
  });

  assert.equal(invalid, "invalid");
  assert.equal(mismatched, "invalid");
  assert.equal(applied, 0);
});

test("unknown or missing modes and missing action codes fail without an action", () => {
  for (const search of [
    "",
    "?oobCode=synthetic",
    "?mode=unknown&oobCode=synthetic",
    "?mode=verifyEmail",
    "?mode=recoverEmail&oobCode=",
  ]) {
    assert.throws(() => parseEmailAction(search));
  }
  assert.equal(emailActionErrorState({ code: "email-action/invalid-mode" }), "invalid");
  assert.equal(emailActionErrorState({ code: "email-action/missing-code" }), "invalid");
});

test("continue URL allowlist preserves approved internal paths and rejects open redirects", () => {
  const accepted = [
    ["/login?from=email#done", "/login?from=email#done"],
    ["https://mujahiz.com/verify-email?from=action", "/verify-email?from=action"],
    ["https://www.mujahiz.com/login", "/login"],
    ["https://mujahiziq.web.app/login?legacy=1", "/login?legacy=1"],
  ];
  for (const [input, expected] of accepted) assert.equal(safeContinuePath(input), expected);

  for (const input of [
    "https://evil.example/login",
    "http://mujahiz.com/login",
    "//evil.example/login",
    "/\\evil.example/login",
    "javascript:alert(1)",
    "https://mujahiz.com.evil.example/login",
    "https://user:password@mujahiz.com/login",
  ]) {
    assert.equal(safeContinuePath(input), "/login", input);
  }
  assert.equal(safeContinuePath(null), "/login");
});

test("valid Firebase language parameters select separated Arabic RTL or English LTR UI", () => {
  assert.equal(parseEmailAction("?mode=verifyEmail&oobCode=x&lang=ar-IQ").locale, "ar");
  assert.equal(parseEmailAction("?mode=verifyEmail&oobCode=x&lang=en-US", "ar").locale, "en");
  assert.equal(parseEmailAction("?mode=verifyEmail&oobCode=x&lang=fr", "ar").locale, "ar");
  assert.match(actionPage, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);

  const arabicBlock = actionPage.match(/const text = locale === "ar" \? \{([\s\S]*?)\n  \} : \{/);
  const englishBlock = actionPage.match(/\n  \} : \{([\s\S]*?)\n  \};/);
  assert.ok(arabicBlock);
  assert.ok(englishBlock);
  const arabicValues = [...arabicBlock[1].matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
  const englishValues = [...englishBlock[1].matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
  for (const value of arabicValues) assert.doesNotMatch(value, /[A-Za-z]/);
  for (const value of englishValues) assert.doesNotMatch(value, /[\u0600-\u06ff]/);
});

test("action codes and action URLs are never logged, stored, analyzed, or written to profiles", () => {
  assert.doesNotMatch(actionSources, /console\.(?:log|info|warn|error|debug)/);
  assert.doesNotMatch(actionSources, /localStorage|sessionStorage/);
  assert.doesNotMatch(actionSources, /analytics|logEvent/);
  assert.doesNotMatch(actionSources, /firebase\/firestore|setDoc|updateDoc|addDoc|writeBatch/);
  assert.doesNotMatch(actionSources, /\baccountType\b|supplierProfileId|accessStatus|trialStartedAt|trialEndsAt|\brole\s*:/i);
  assert.doesNotMatch(actionPage, /window\.location|location\.href|location\.search\).*console/);
  assert.match(actionService, /const apiKey = parameters\.get\("apiKey"\) \|\| undefined/);
  assert.doesNotMatch(actionService, /initializeApp|VITE_FIREBASE|firebaseConfig/);
});
