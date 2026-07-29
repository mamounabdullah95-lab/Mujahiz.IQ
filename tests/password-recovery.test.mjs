import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  completePasswordReset,
  MINIMUM_PASSWORD_LENGTH,
  passwordRecoveryErrorMessage,
  passwordResetRequestMessage,
  readPasswordResetAction,
  requestPasswordReset,
  validateNewPassword,
  validatePasswordResetCode,
} from "../src/services/passwordRecovery.ts";

const app = readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/AppLayoutV2.tsx", import.meta.url), "utf8");
const loginPage = readFileSync(new URL("../src/pages/LoginPage.tsx", import.meta.url), "utf8");
const forgotPage = readFileSync(new URL("../src/pages/ForgotPasswordPage.tsx", import.meta.url), "utf8");
const resetPage = readFileSync(new URL("../src/pages/ResetPasswordPage.tsx", import.meta.url), "utf8");
const recoveryService = readFileSync(new URL("../src/services/passwordRecovery.ts", import.meta.url), "utf8");
const recoverySources = [forgotPage, resetPage, recoveryService].join("\n");
const actionSettings = { url: "https://mujahiz.com/login", handleCodeInApp: false };

function firebaseError(code) {
  return Object.assign(new Error("Synthetic Firebase error"), { code });
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

let renderedFeedbackHarness;

async function loadRenderedFeedbackHarness() {
  if (renderedFeedbackHarness) return renderedFeedbackHarness;

  const vite = await createServer({
    appType: "custom",
    logLevel: "silent",
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true },
  });
  const { PasswordRecoveryFeedback } = await vite.ssrLoadModule("/src/pages/ForgotPasswordPage.tsx");
  renderedFeedbackHarness = {
    async close() {
      await vite.close();
    },
    render(locale, result) {
      return renderToStaticMarkup(
        createElement(PasswordRecoveryFeedback, {
          locale,
          result: result.status,
          failure: null,
        }),
      );
    },
  };
  return renderedFeedbackHarness;
}

test.after(async () => {
  await renderedFeedbackHarness?.close();
});

test("login links to public forgot-password and reset-completion routes", () => {
  assert.match(loginPage, /to="\/forgot-password"/);
  assert.doesNotMatch(loginPage, /href="#"/);
  assert.match(app, /path="forgot-password" element=\{<ForgotPasswordPage \/>\}/);
  assert.match(app, /path="reset-password" element=\{<ResetPasswordPage \/>\}/);
  assert.match(layout, /"\/forgot-password"/);
  assert.match(layout, /"\/reset-password"/);
});

test("valid reset requests normalize email and use the supplied action settings", async () => {
  const calls = [];
  const result = await requestPasswordReset({
    email: "  Buyer@EXAMPLE.TEST  ",
    actionSettings,
    sendResetEmail: async (email, settings) => calls.push({ email, settings }),
  });

  assert.deepEqual(result, { status: "accepted" });
  assert.deepEqual(calls, [{ email: "Buyer@example.test", settings: actionSettings }]);
  assert.match(forgotPage, /getEmailActionSettings\("\/login"\)/);
});

test("invalid email is rejected before Firebase is called", async () => {
  let calls = 0;
  await assert.rejects(
    requestPasswordReset({
      email: "not an email",
      actionSettings,
      sendResetEmail: async () => {
        calls += 1;
      },
    }),
    { code: "password-recovery/invalid-email" },
  );
  assert.equal(calls, 0);
});

test("unknown email returns the same accepted result without enumeration", async () => {
  const known = await requestPasswordReset({
    email: "known@example.test",
    actionSettings,
    sendResetEmail: async () => {},
  });
  const unknown = await requestPasswordReset({
    email: "unknown@example.test",
    actionSettings,
    sendResetEmail: async () => {
      throw firebaseError("auth/user-not-found");
    },
  });

  assert.deepEqual(unknown, known);
  assert.match(passwordResetRequestMessage("en"), /^If an account is linked/);
  assert.match(passwordResetRequestMessage("en"), /Spam or Junk/);
});

test("resolved reset request renders neutral English feedback in LTR", async () => {
  const result = await requestPasswordReset({
    email: "buyer@example.test",
    actionSettings,
    sendResetEmail: async () => {},
  });
  const markup = (await loadRenderedFeedbackHarness()).render("en", result);

  assert.match(markup, /role="status"/);
  assert.match(markup, /dir="ltr"/);
  assert.match(markup, /If an account is linked/);
  assert.doesNotMatch(markup, /[\u0600-\u06ff]/);
});

test("resolved reset request renders neutral Arabic feedback in RTL", async () => {
  const result = await requestPasswordReset({
    email: "buyer@example.test",
    actionSettings,
    sendResetEmail: async () => {},
  });
  const markup = (await loadRenderedFeedbackHarness()).render("ar", result);

  assert.match(markup, /role="status"/);
  assert.match(markup, /dir="rtl"/);
  assert.match(markup, /[\u0600-\u06ff]/);
  assert.doesNotMatch(markup, /If an account is linked/);
});

test("in-flight locale change renders final feedback in the current locale", async () => {
  const request = deferred();
  const pendingResult = requestPasswordReset({
    email: "buyer@example.test",
    actionSettings,
    sendResetEmail: async () => request.promise,
  });

  let currentLocale = "ar";
  currentLocale = "en";
  request.resolve();
  const result = await pendingResult;
  const markup = (await loadRenderedFeedbackHarness()).render(currentLocale, result);

  assert.match(markup, /dir="ltr"/);
  assert.match(markup, /If an account is linked/);
  assert.doesNotMatch(markup, /[\u0600-\u06ff]/);
});

test("request rate-limit and network errors map to safe bilingual messages", () => {
  for (const code of ["auth/too-many-requests", "auth/network-request-failed"]) {
    const english = passwordRecoveryErrorMessage(firebaseError(code), "en", "request");
    const arabic = passwordRecoveryErrorMessage(firebaseError(code), "ar", "request");
    assert.doesNotMatch(english, /auth\//);
    assert.doesNotMatch(arabic, /auth\//);
    assert.doesNotMatch(english, /[\u0600-\u06ff]/);
    assert.doesNotMatch(arabic, /[A-Za-z]/);
  }
});

test("request page shows loading and prevents duplicate submission", () => {
  assert.match(forgotPage, /if \(busy\) return/);
  assert.match(forgotPage, /disabled=\{busy\}/);
  assert.match(forgotPage, /busy \? text\.sending : text\.submit/);
  assert.match(forgotPage, /setResult\(requestResult\.status\)/);
  assert.doesNotMatch(forgotPage, /setMessage\(passwordResetRequestMessage\(locale\)\)/);
});

test("valid password-reset action code is checked before password entry", async () => {
  const action = readPasswordResetAction("?mode=resetPassword&oobCode=synthetic-code");
  let verified = "";
  const result = await validatePasswordResetCode({
    code: action.code,
    verifyResetCode: async (code) => {
      verified = code;
      return "buyer@example.test";
    },
  });

  assert.equal(verified, "synthetic-code");
  assert.deepEqual(result, { status: "valid" });
  assert.match(resetPage, /verifyPasswordResetCode\(configuredAuth, code\)/);
});

test("invalid, expired, and already-used action codes have recoverable states", () => {
  const invalid = passwordRecoveryErrorMessage(firebaseError("auth/invalid-action-code"), "en", "validation");
  const expired = passwordRecoveryErrorMessage(firebaseError("auth/expired-action-code"), "en", "validation");
  const used = passwordRecoveryErrorMessage(firebaseError("auth/invalid-action-code"), "en", "confirmation");

  assert.match(invalid, /invalid/);
  assert.match(expired, /expired/);
  assert.match(used, /already used/);
  assert.match(resetPage, /to="\/forgot-password"/);
  assert.throws(() => readPasswordResetAction("?mode=verifyEmail&oobCode=synthetic"), {
    code: "password-recovery/invalid-action-link",
  });
});

test("password mismatch and weak passwords are rejected consistently", () => {
  assert.equal(MINIMUM_PASSWORD_LENGTH, 8);
  assert.throws(() => validateNewPassword("short", "short"), { code: "auth/weak-password" });
  assert.throws(
    () => validateNewPassword("LongEnough1", "LongEnough2"),
    { code: "password-recovery/password-mismatch" },
  );
});

test("successful reset confirms once and returns safely to login", async () => {
  const calls = [];
  const result = await completePasswordReset({
    code: "synthetic-code",
    password: "NewPassword1",
    confirmation: "NewPassword1",
    confirmReset: async (code, password) => calls.push({ code, password }),
  });

  assert.deepEqual(result, { status: "complete" });
  assert.deepEqual(calls, [{ code: "synthetic-code", password: "NewPassword1" }]);
  assert.match(resetPage, /navigate\("\/login", \{ replace: true, state: \{ passwordReset: "success" \} \}\)/);
  assert.doesNotMatch(resetPage, /signInWithEmailAndPassword/);
});

test("Arabic and English recovery messages stay language-separated", () => {
  const arabicMessages = [
    passwordResetRequestMessage("ar"),
    passwordRecoveryErrorMessage(firebaseError("auth/expired-action-code"), "ar", "validation"),
    passwordRecoveryErrorMessage(firebaseError("auth/invalid-action-code"), "ar", "confirmation"),
  ];
  const englishMessages = [
    passwordResetRequestMessage("en"),
    passwordRecoveryErrorMessage(firebaseError("auth/expired-action-code"), "en", "validation"),
    passwordRecoveryErrorMessage(firebaseError("auth/invalid-action-code"), "en", "confirmation"),
  ];

  for (const message of arabicMessages) assert.doesNotMatch(message, /[A-Za-z]/);
  for (const message of englishMessages) assert.doesNotMatch(message, /[\u0600-\u06ff]/);
});

test("recovery code never logs, stores, or writes identity/profile state", () => {
  assert.doesNotMatch(recoverySources, /console\.(?:log|info|warn|error|debug)/);
  assert.doesNotMatch(recoverySources, /localStorage|sessionStorage/);
  assert.doesNotMatch(recoverySources, /firebase\/firestore|setDoc|updateDoc|addDoc|writeBatch/);
  assert.doesNotMatch(recoverySources, /\baccountType\b|supplierProfileId|accessStatus|trialStartedAt|trialEndsAt|\brole\s*:/i);
  assert.doesNotMatch(recoverySources, /URLSearchParams\([^)]*password/i);
});
