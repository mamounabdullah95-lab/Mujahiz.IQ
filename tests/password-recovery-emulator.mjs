import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { getDoc, doc } from "firebase/firestore";
import {
  createInternalEmulatorTestEnvironment,
  internalAccountContext,
  internalEmulatorAccounts,
  LOCAL_EMULATOR_TEST_PASSWORD,
  requireInternalEmulatorConfiguration,
  resetInternalEmulatorState,
  seedInternalEmulatorAccounts,
} from "./helpers/internal-emulator-accounts.mjs";

let environment;

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

async function requestReset(email) {
  return authEmulatorRequest(
    "/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=demo-api-key",
    {
      method: "POST",
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl: "https://mujahiz.com/login",
      }),
    },
  );
}

async function findResetCode(email) {
  const { projectId } = requireInternalEmulatorConfiguration();
  const result = await authEmulatorRequest(`/emulator/v1/projects/${projectId}/oobCodes`);
  const match = result.oobCodes?.find(
    (candidate) => candidate.requestType === "PASSWORD_RESET" && candidate.email === email,
  );
  assert.ok(match?.oobCode, "Auth Emulator did not capture a password-reset action code.");
  return match.oobCode;
}

async function inspectResetCode(code) {
  return authEmulatorRequest(
    "/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-api-key",
    {
      method: "POST",
      body: JSON.stringify({ oobCode: code }),
    },
  );
}

async function confirmReset(code, newPassword) {
  return authEmulatorRequest(
    "/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-api-key",
    {
      method: "POST",
      body: JSON.stringify({ oobCode: code, newPassword }),
    },
  );
}

async function signIn(email, password) {
  return authEmulatorRequest(
    "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    {
      method: "POST",
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
}

before(async () => {
  environment = await createInternalEmulatorTestEnvironment();
  await resetInternalEmulatorState(environment);
  await seedInternalEmulatorAccounts(environment);
});

after(async () => {
  if (!environment) return;
  await resetInternalEmulatorState(environment);
  await environment.cleanup();
});

test("Auth Emulator resets Buyer and Supplier passwords without changing role or profile linkage", async () => {
  const fixtures = [internalEmulatorAccounts.buyer01, internalEmulatorAccounts.supplier01];

  for (const account of fixtures) {
    const database = internalAccountContext(environment, account.key);
    const userReference = doc(database, "users", account.uid);
    const userBefore = (await getDoc(userReference)).data();
    const supplierReference = account.supplierProfileId
      ? doc(database, "suppliers", account.supplierProfileId)
      : null;
    const supplierBefore = supplierReference ? (await getDoc(supplierReference)).data() : null;

    // The Emulator captures the action code; this does not test external email delivery.
    await requestReset(account.email);
    const code = await findResetCode(account.email);
    const inspected = await inspectResetCode(code);
    assert.equal(inspected.email, account.email);
    assert.equal(inspected.requestType, "PASSWORD_RESET");

    const nextPassword = `LocalResetOnly!${account.key}`;
    await confirmReset(code, nextPassword);
    const signedIn = await signIn(account.email, nextPassword);
    assert.equal(signedIn.localId, account.uid);
    await assert.rejects(signIn(account.email, LOCAL_EMULATOR_TEST_PASSWORD));

    const userAfter = (await getDoc(userReference)).data();
    assert.deepEqual(userAfter, userBefore);
    if (supplierReference) {
      const supplierAfter = (await getDoc(supplierReference)).data();
      assert.deepEqual(supplierAfter, supplierBefore);
    }

    await assert.rejects(inspectResetCode(code));
  }
});
