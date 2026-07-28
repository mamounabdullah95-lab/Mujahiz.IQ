import assert from "node:assert/strict";
import test from "node:test";
import {
  requireInternalEmulatorConfiguration,
} from "./helpers/internal-emulator-accounts.mjs";

async function authEmulatorRequest(path, init = {}) {
  const { auth } = requireInternalEmulatorConfiguration();
  const response = await fetch(`${auth.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) : {};
  if (!response.ok) {
    const error = new Error(`Auth Emulator request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function identityRequest(endpoint, body) {
  return authEmulatorRequest(
    `/identitytoolkit.googleapis.com/v1/${endpoint}?key=demo-api-key`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

async function createAccount(email) {
  return identityRequest("accounts:signUp", {
    email,
    password: "LocalEmailActionOnly!1",
    returnSecureToken: true,
  });
}

async function requestVerification(idToken) {
  return identityRequest("accounts:sendOobCode", {
    requestType: "VERIFY_EMAIL",
    idToken,
    continueUrl: "https://mujahiz.com/login",
  });
}

async function findActionCode(requestType, email) {
  const { projectId } = requireInternalEmulatorConfiguration();
  const result = await authEmulatorRequest(`/emulator/v1/projects/${projectId}/oobCodes`);
  const match = result.oobCodes?.find(
    (candidate) => candidate.requestType === requestType && candidate.email === email,
  );
  assert.ok(match?.oobCode, `Auth Emulator did not capture a ${requestType} action code.`);
  return match.oobCode;
}

async function checkActionCode(code) {
  return identityRequest("accounts:resetPassword", { oobCode: code });
}

async function applyActionCode(code) {
  return identityRequest("accounts:update", { oobCode: code });
}

async function lookupAccount(idToken) {
  const result = await identityRequest("accounts:lookup", { idToken });
  assert.equal(result.users?.length, 1);
  return result.users[0];
}

test("Auth Emulator applies a verifyEmail code once", async () => {
  const email = "handler-verify@example.test";
  const created = await createAccount(email);
  await requestVerification(created.idToken);
  const code = await findActionCode("VERIFY_EMAIL", email);

  const inspected = await checkActionCode(code);
  assert.equal(inspected.requestType, "VERIFY_EMAIL");
  await applyActionCode(code);

  const account = await lookupAccount(created.idToken);
  assert.equal(account.email, email);
  assert.equal(account.emailVerified, true);
  await assert.rejects(checkActionCode(code));
  await assert.rejects(applyActionCode(code));
});

test("Auth Emulator checks then applies recoverEmail without starting a password reset", async () => {
  const originalEmail = "handler-recover-original@example.test";
  const changedEmail = "handler-recover-changed@example.test";
  const created = await createAccount(originalEmail);
  const changed = await identityRequest("accounts:update", {
    idToken: created.idToken,
    email: changedEmail,
    returnSecureToken: true,
  });
  const code = await findActionCode("RECOVER_EMAIL", originalEmail);

  const inspected = await checkActionCode(code);
  assert.equal(inspected.requestType, "RECOVER_EMAIL");
  await applyActionCode(code);

  const account = await lookupAccount(changed.idToken);
  assert.equal(account.email, originalEmail);
  const { projectId } = requireInternalEmulatorConfiguration();
  const codes = await authEmulatorRequest(`/emulator/v1/projects/${projectId}/oobCodes`);
  assert.equal(
    codes.oobCodes?.filter((candidate) => candidate.requestType === "PASSWORD_RESET").length || 0,
    0,
  );
});
