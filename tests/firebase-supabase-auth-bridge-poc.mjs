import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireFromFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { deleteApp, initializeApp } = requireFromFunctions("firebase-admin/app");
const { getAuth } = requireFromFunctions("firebase-admin/auth");

const PROJECT_ID = "demo-mujahiziq-auth-bridge-poc";
const POSTGRES_IMAGE = "supabase/postgres:17.6.1.064";
const repoRoot = fileURLToPath(new URL("../", import.meta.url)).replace(/[\\/]$/, "");
const containerName = `mujahiz-auth-bridge-poc-${process.pid}`;
const password = "LocalAuthBridgePocOnly!2026";
const fixtureIds = Object.freeze({
  validProfile: "00000000-0000-4000-8000-000000000101",
  inactiveLinkProfile: "00000000-0000-4000-8000-000000000102",
  inactiveProfile: "00000000-0000-4000-8000-000000000103",
  otherProfile: "00000000-0000-4000-8000-000000000104",
  duplicateTargetProfile: "00000000-0000-4000-8000-000000000105",
  validLink: "00000000-0000-4000-8000-000000000201",
  inactiveLink: "00000000-0000-4000-8000-000000000202",
  inactiveProfileLink: "00000000-0000-4000-8000-000000000203",
  otherLink: "00000000-0000-4000-8000-000000000204",
});

let adminApp;
let adminAuth;
let containerStarted = false;
const tokens = new Map();

class BridgeDenied extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function docker(args, { input, allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: repoRoot,
    encoding: "utf8",
    input,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const detail = (result.stderr || result.stdout || result.error?.message || "unknown Docker failure").trim();
    throw new Error(`Docker command failed: ${detail}`);
  }
  return result;
}

function psql(sql, { variables = {}, allowFailure = false } = {}) {
  const args = [
    "exec", "--interactive", containerName,
    "psql", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--username=postgres", "--dbname=postgres",
    "--quiet", "--tuples-only", "--no-align", "--pset", "footer=off",
  ];
  for (const [name, value] of Object.entries(variables)) args.push(`--set=${name}=${value}`);
  return docker(args, { input: sql, allowFailure });
}

function applyMigration(fileName) {
  const containerPath = `/workspace/supabase/migrations/${fileName}`;
  const result = docker([
    "exec", containerName, "psql", "--no-psqlrc", "--set=ON_ERROR_STOP=1",
    "--username=postgres", "--dbname=postgres", "--quiet", "--file", containerPath,
  ]);
  assert.equal(result.status, 0);
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = docker(
      ["exec", containerName, "pg_isready", "--username=postgres", "--dbname=postgres"],
      { allowFailure: true },
    );
    const initializing = docker(
      ["exec", containerName, "sh", "-c", "ps -eo args | grep '[m]igrate.sh' > /dev/null"],
      { allowFailure: true },
    );
    if (ready.status === 0 && initializing.status !== 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}

async function authEmulatorRequest(path, options = {}) {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) {
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST must be an explicit loopback Emulator endpoint.");
  }
  if (!PROJECT_ID.startsWith("demo-")) throw new Error("The POC requires a Firebase demo project ID.");
  const response = await fetch(`http://${host}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Auth Emulator request failed (${response.status}).`);
  return body;
}

async function createUser({ uid, verified = true }) {
  const email = `${uid}@auth-bridge-poc.example.test`;
  await adminAuth.createUser({ uid, email, emailVerified: verified, password });
  const signedIn = await authEmulatorRequest(
    "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    { method: "POST", body: JSON.stringify({ email, password, returnSecureToken: true }) },
  );
  tokens.set(uid, signedIn.idToken);
  return signedIn.idToken;
}

function databaseFixturesSql() {
  return String.raw`
insert into public.user_profiles (
  id, full_name, account_status, account_context, verification_mirror_status,
  verification_mirror_observed_at, created_at, updated_at
) values
  ('${fixtureIds.validProfile}', 'Synthetic valid profile', 'active', 'supplier', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z'),
  ('${fixtureIds.inactiveLinkProfile}', 'Synthetic inactive-link profile', 'active', 'supplier', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z'),
  ('${fixtureIds.inactiveProfile}', 'Synthetic inactive profile', 'active', 'supplier', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:02Z'),
  ('${fixtureIds.otherProfile}', 'Synthetic caller-attack profile', 'active', 'supplier', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z'),
  ('${fixtureIds.duplicateTargetProfile}', 'Synthetic duplicate target', 'active', 'supplier', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z');

update public.user_profiles
set account_status = 'deactivated', deactivated_at = '2026-08-09T00:00:02Z',
  deactivation_reason = 'synthetic POC state'
where id = '${fixtureIds.inactiveProfile}';

insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject, is_primary, link_status,
  identity_status, verification_status, provider_state_observed_at, linked_at,
  verified_at, unlinked_at, created_at
) values
  ('${fixtureIds.validLink}', '${fixtureIds.validProfile}', 'firebase', 'bridge-valid-user', true, 'linked', 'active', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z', null, '2026-08-09T00:00:00Z'),
  ('${fixtureIds.inactiveLink}', '${fixtureIds.inactiveLinkProfile}', 'firebase', 'bridge-inactive-link', false, 'unlinked', 'unknown', 'unknown', '2026-08-09T00:00:02Z', '2026-08-09T00:00:00Z', null, '2026-08-09T00:00:02Z', '2026-08-09T00:00:00Z'),
  ('${fixtureIds.inactiveProfileLink}', '${fixtureIds.inactiveProfile}', 'firebase', 'bridge-inactive-profile', true, 'linked', 'active', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z', null, '2026-08-09T00:00:00Z'),
  ('${fixtureIds.otherLink}', '${fixtureIds.otherProfile}', 'firebase', 'bridge-other-user', true, 'linked', 'active', 'verified', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z', null, '2026-08-09T00:00:00Z');
`;
}

function resolvePrincipalByFirebaseUid(firebaseUid) {
  const result = psql(String.raw`
with candidates as (
  select p.id::text as profile_id, l.id::text as provider_link_id
  from internal.identity_provider_links l
  join public.user_profiles p on p.id = l.user_profile_id
  where l.provider_code = 'firebase'
    and l.provider_subject = :'provider_subject'
    and l.is_primary
    and l.link_status = 'linked'
    and l.identity_status = 'active'
    and l.verification_status = 'verified'
    and p.account_status = 'active'
    and p.verification_mirror_status = 'verified'
)
select count(*)::text || '|' || coalesce(min(profile_id), '') || '|' || coalesce(min(provider_link_id), '')
from candidates;
`, { variables: { provider_subject: firebaseUid } });
  const [count, userProfileId, providerLinkId] = result.stdout.trim().split("|");
  if (count !== "1" || !userProfileId || !providerLinkId) throw new BridgeDenied("identity_mapping_unavailable");
  return { userProfileId, providerLinkId };
}

async function authorizeRequest({ idToken, caller = {}, resolvePrincipal = resolvePrincipalByFirebaseUid }) {
  void caller;
  if (!idToken) throw new BridgeDenied("missing_token");

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    if (error?.code === "auth/user-disabled") throw new BridgeDenied("current_user_disabled");
    if (error?.code === "auth/user-not-found") throw new BridgeDenied("current_user_not_found");
    throw new BridgeDenied("invalid_token");
  }
  if (decoded.aud !== PROJECT_ID || decoded.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new BridgeDenied("wrong_project");
  }

  let currentUser;
  try {
    currentUser = await adminAuth.getUser(decoded.uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") throw new BridgeDenied("current_user_not_found");
    throw new BridgeDenied("current_user_unavailable");
  }
  if (currentUser.disabled) throw new BridgeDenied("current_user_disabled");
  if (!currentUser.emailVerified || decoded.email_verified !== true) {
    throw new BridgeDenied("current_user_unverified");
  }

  const resolved = resolvePrincipal(decoded.uid);
  return Object.freeze({ userProfileId: resolved.userProfileId });
}

function decodeEmulatorTokenPayload(idToken) {
  const [, encodedPayload] = idToken.split(".");
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
}

function tokenWithWrongAudience(idToken) {
  const [encodedHeader] = idToken.split(".");
  const payload = decodeEmulatorTokenPayload(idToken);
  payload.aud = "demo-wrong-auth-bridge-project";
  payload.iss = "https://securetoken.google.com/demo-wrong-auth-bridge-project";
  return `${encodedHeader}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.`;
}

function assertDenied(promise, code) {
  return assert.rejects(promise, (error) => error instanceof BridgeDenied && error.code === code);
}

before(async () => {
  assert.ok(existsSync(`${repoRoot}\\supabase\\migrations\\20260804000136_migration_control_foundation.sql`));
  assert.equal(
    docker(["image", "inspect", POSTGRES_IMAGE], { allowFailure: true }).status,
    0,
    `${POSTGRES_IMAGE} must already exist locally`,
  );

  docker([
    "run", "--detach", "--rm", "--name", containerName,
    "--mount", `type=bind,source=${repoRoot},target=/workspace,readonly`,
    "--env", "POSTGRES_PASSWORD=postgres", "--env", "POSTGRES_DB=postgres", POSTGRES_IMAGE,
  ]);
  containerStarted = true;
  await waitForPostgres();

  psql(String.raw`
create schema if not exists extensions;
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;
end
$$;
`);
  applyMigration("20260804000136_migration_control_foundation.sql");
  applyMigration("20260804000200_provider_neutral_identity_foundation.sql");
  psql(databaseFixturesSql());

  adminApp = initializeApp({ projectId: PROJECT_ID }, `auth-bridge-poc-${process.pid}`);
  adminAuth = getAuth(adminApp);
  await authEmulatorRequest(`/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  for (const user of [
    { uid: "bridge-valid-user" },
    { uid: "bridge-unverified-user", verified: false },
    { uid: "bridge-disabled-user" },
    { uid: "bridge-deleted-user" },
    { uid: "bridge-unmapped-user" },
    { uid: "bridge-inactive-link" },
    { uid: "bridge-inactive-profile" },
    { uid: "bridge-other-user" },
  ]) await createUser(user);
});

after(async () => {
  try {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      await authEmulatorRequest(`/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
    }
  } finally {
    if (adminApp) await deleteApp(adminApp);
    if (containerStarted) docker(["rm", "--force", containerName], { allowFailure: true });
  }
});

test("valid Emulator token and current user resolve one provider-neutral profile", async () => {
  const result = await authorizeRequest({ idToken: tokens.get("bridge-valid-user") });
  assert.deepEqual(result, { userProfileId: fixtureIds.validProfile });
  assert.deepEqual(Object.keys(result), ["userProfileId"]);
});

test("missing, malformed, and wrong-project tokens fail before database resolution", async () => {
  let databaseLookups = 0;
  const resolver = () => { databaseLookups += 1; throw new Error("must not run"); };
  await assertDenied(authorizeRequest({ resolvePrincipal: resolver }), "missing_token");
  await assertDenied(authorizeRequest({ idToken: "not-a-token", resolvePrincipal: resolver }), "invalid_token");
  await assertDenied(authorizeRequest({
    idToken: tokenWithWrongAudience(tokens.get("bridge-valid-user")),
    resolvePrincipal: resolver,
  }), "invalid_token");
  assert.equal(databaseLookups, 0);
});

test("unverified current Firebase user fails before database resolution", async () => {
  let databaseLookups = 0;
  await assertDenied(authorizeRequest({
    idToken: tokens.get("bridge-unverified-user"),
    resolvePrincipal: () => { databaseLookups += 1; },
  }), "current_user_unverified");
  assert.equal(databaseLookups, 0);
});

test("a still-parseable token is denied after the current Firebase user is disabled", async () => {
  const token = tokens.get("bridge-disabled-user");
  await adminAuth.updateUser("bridge-disabled-user", { disabled: true });
  const unchangedToken = decodeEmulatorTokenPayload(token);
  assert.equal(unchangedToken.sub, "bridge-disabled-user");
  assert.ok(unchangedToken.exp > Math.floor(Date.now() / 1000));
  await assertDenied(authorizeRequest({ idToken: token }), "current_user_disabled");
});

test("a still-parseable token is denied after the current Firebase user is deleted", async () => {
  const token = tokens.get("bridge-deleted-user");
  await adminAuth.deleteUser("bridge-deleted-user");
  const unchangedToken = decodeEmulatorTokenPayload(token);
  assert.equal(unchangedToken.sub, "bridge-deleted-user");
  assert.ok(unchangedToken.exp > Math.floor(Date.now() / 1000));
  await assertDenied(authorizeRequest({ idToken: token }), "current_user_not_found");
});

test("unmapped, inactive-link, and inactive-profile identities fail closed", async () => {
  await assertDenied(authorizeRequest({ idToken: tokens.get("bridge-unmapped-user") }), "identity_mapping_unavailable");
  await assertDenied(authorizeRequest({ idToken: tokens.get("bridge-inactive-link") }), "identity_mapping_unavailable");
  await assertDenied(authorizeRequest({ idToken: tokens.get("bridge-inactive-profile") }), "identity_mapping_unavailable");
});

test("caller-supplied profile, Firebase UID, and provider-link IDs cannot substitute identity", async () => {
  const result = await authorizeRequest({
    idToken: tokens.get("bridge-valid-user"),
    caller: {
      user_profile_id: fixtureIds.otherProfile,
      firebase_uid: "bridge-other-user",
      provider_link_id: fixtureIds.otherLink,
    },
  });
  assert.deepEqual(result, { userProfileId: fixtureIds.validProfile });
});

test("database constraints reject a second active mapping for the verified token subject", () => {
  const result = psql(String.raw`
insert into internal.identity_provider_links (
  user_profile_id, provider_code, provider_subject, identity_status, verification_status,
  provider_state_observed_at, linked_at, verified_at, created_at
) values (
  '${fixtureIds.duplicateTargetProfile}', 'firebase', 'bridge-valid-user', 'active', 'verified',
  '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z', '2026-08-09T00:00:01Z', '2026-08-09T00:00:00Z'
);
`, { allowFailure: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /identity_provider_links_active_provider_subject_uidx/);
});

test("transaction-local principal clears on commit and rollback on the same reused connection", () => {
  const result = psql(String.raw`
select 'pid_a=' || pg_backend_pid()::text;
begin;
select set_config('mujahiz_poc.user_profile_id', :'profile_id', true);
select 'during_commit=' || current_setting('mujahiz_poc.user_profile_id');
commit;
select 'pid_b=' || pg_backend_pid()::text;
select 'after_commit=' || coalesce(nullif(current_setting('mujahiz_poc.user_profile_id', true), ''), '<absent>');
begin;
select 'before_rollback=' || coalesce(nullif(current_setting('mujahiz_poc.user_profile_id', true), ''), '<absent>');
select set_config('mujahiz_poc.user_profile_id', :'profile_id', true);
select 'during_rollback=' || current_setting('mujahiz_poc.user_profile_id');
rollback;
select 'pid_c=' || pg_backend_pid()::text;
select 'after_rollback=' || coalesce(nullif(current_setting('mujahiz_poc.user_profile_id', true), ''), '<absent>');
`, { variables: { profile_id: fixtureIds.validProfile } });
  const values = Object.fromEntries(
    result.stdout.trim().split(/\r?\n/).filter((line) => line.includes("=")).map((line) => line.split("=", 2)),
  );
  assert.equal(values.during_commit, fixtureIds.validProfile);
  assert.equal(values.after_commit, "<absent>");
  assert.equal(values.before_rollback, "<absent>");
  assert.equal(values.during_rollback, fixtureIds.validProfile);
  assert.equal(values.after_rollback, "<absent>");
  assert.equal(values.pid_a, values.pid_b);
  assert.equal(values.pid_b, values.pid_c);
});
