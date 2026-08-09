# Firebase Auth to PostgreSQL request-scoped identity bridge local POC

Status: **Local technical-feasibility POC PASS; synthetic evidence only; not Production-ready or architecture approval**

Date: 2026-08-09

Starting SHA: `8dcf556aea1460dd4ed9510854a644225ee0ad3a`

Primary task profile: Authentication and Accounts

## 1. Question and result

The local POC answers **yes** to the bounded technical question: Mujahiz IQ can keep Firebase Auth authoritative while a trusted server resolves a provider-neutral PostgreSQL principal and places that principal in transaction-local database context without leaking it into a later transaction on the same reused PostgreSQL connection.

The proved chain is:

1. receive a Firebase Auth Emulator ID token at a trusted test bridge;
2. validate it with Firebase Admin for the exact demo project;
3. observe the exact current Firebase user and require an existing, enabled, email-verified account;
4. use only the verified token subject to query an exact active primary `firebase` provider link;
5. join that link to one active, verified-mirror `public.user_profiles` row;
6. return only `user_profiles.id` to domain/database logic; and
7. set that UUID through POC-only `set_config(..., true)` transaction-local context, which PostgreSQL clears on commit or rollback.

This is a feasibility result, not approval of SEC-001, document 42, a setting name, a database role, RLS, a trusted command, a hosted environment, or Production activation.

## 2. Isolation and test environment

- Branch/worktree: `codex/firebase-supabase-auth-bridge-poc` in the requested isolated worktree.
- Firebase target: Auth Emulator only, project `demo-mujahiziq-auth-bridge-poc`, loopback port managed by `firebase emulators:exec`.
- Firebase packages: repository versions `firebase-tools` `15.23.0` and `firebase-admin` `14.2.0`.
- PostgreSQL target: disposable local Docker container from the already-used `supabase/postgres:17.6.1.064` image.
- Database inputs: only migrations `20260804000136_migration_control_foundation.sql` and `20260804000200_provider_neutral_identity_foundation.sql`, mounted read-only.
- Data: deterministic synthetic UUIDs, Emulator-only users, and `example.test` email addresses.
- Cleanup: Auth Emulator accounts are deleted, the Emulator exits, and the disposable database container is force-removed by the test teardown.

The harness does not start or link the Supabase hosted stack, authenticate to a hosted project, use Firebase Production credentials, call Firebase Production, read Firestore, deploy Functions, or retain database rows.

## 3. POC architecture

The test-only `authorizeRequest` boundary ignores the caller's asserted identity fields. Firebase Admin derives the UID from the token, checks the exact project/issuer, and reads current user state. Only then does the bridge resolve the relational identity with a parameterized exact-subject query.

The resolver requires all of the following:

- `provider_code = 'firebase'`;
- provider subject exactly equal to the verified token UID;
- primary and `linked` provider link;
- active provider identity and verified link mirror;
- active profile and verified profile mirror; and
- exactly one joined candidate.

Database uniqueness already prevents two active links for the same provider subject. The bridge still checks candidate count and fails closed. Its public result contains only `userProfileId`; neither Firebase UID nor provider-link ID crosses into domain logic.

For request scope, the harness uses the deliberately unapproved POC name `mujahiz_poc.user_profile_id`. The value is set only after successful resolution with PostgreSQL's transaction-local `set_config` mode. One `psql` process records the same `pg_backend_pid()` before and after commit and rollback, proving connection reuse while the old value is absent.

## 4. Evidence matrix

| Case | Result | Evidence |
|---|---|---|
| Valid Emulator token/current user | PASS | Firebase Admin accepts the exact demo-project token; current user exists, is enabled and verified; exact link resolves one profile UUID. |
| Missing token | PASS | Denied before any database resolver call. |
| Invalid token | PASS | Denied by Firebase Admin before any database resolver call. |
| Wrong project/audience | PASS | An Emulator token payload changed to a different project is rejected before database resolution. |
| Unverified account | PASS | Current Firebase verification is false and the request is denied before database resolution. |
| Disabled account after token issuance | PASS with Emulator limitation | The unchanged token payload remains unexpired, but Emulator-mode Firebase Admin rejects it as disabled before the separate `getUser` step. No database lookup occurs. |
| Deleted account after token issuance | PASS with Emulator limitation | The unchanged token payload remains unexpired, but Emulator-mode Firebase Admin rejects it as not found before the separate `getUser` step. No database lookup occurs. |
| Unmapped UID | PASS | Exact provider query returns no candidate and denies. |
| Inactive provider link | PASS | An unlinked synthetic row is excluded and denies. |
| Inactive/deactivated profile | PASS | An otherwise active provider link joined to a deactivated profile is excluded and denies. |
| Duplicate active subject mapping | PASS | The existing partial unique index rejects a second active Firebase-subject mapping. |
| Caller profile/UID/link substitution | PASS | Supplying another profile UUID, Firebase UID, and provider-link UUID does not change the token-derived profile result. |
| Transaction A context | PASS | The resolved profile UUID is readable inside the setting transaction. |
| Transaction B after commit | PASS | The value is absent on the same backend PID. |
| Reuse after rollback | PASS | The value is absent on the same backend PID after rollback. |

The focused run produced 9 passing Node test cases and 0 failures. Several table rows above are grouped into one test case.

## 5. Emulator and pooling limitations

Firebase Auth Emulator ID tokens are unsigned test tokens. This POC therefore does not prove Production certificate retrieval, TLS, key rotation, or real signed-token validation. The Admin SDK in Emulator mode also consults Emulator account state during `verifyIdToken`; after disablement or deletion it rejects the token before the explicit `getUser` call. The harness proves the desired fail-closed result and demonstrates explicit `getUser` on accepted requests, but it cannot isolate ?cryptographically valid after disablement? from current-account state in this Emulator implementation. A non-Production signed-token environment must repeat that separation before release.

The local Supabase pooler is disabled. The POC nevertheless proves the core reuse invariant on one physical PostgreSQL backend connection: transaction-local context is absent after commit and rollback. The selected Production/staging pool and driver must repeat this test for commit, rollback, exceptions, cancellation, timeout, and connection return. Session-level `SET`, non-local `set_config`, or a connection-scoped principal is unsafe for this bridge.

The test connects as the disposable PostgreSQL superuser because no runtime role exists. It proves scoping, not the future role/grant boundary. A real bridge requires a dedicated non-owner, non-`BYPASSRLS`, non-browser runtime role that cannot expose arbitrary SQL or let a browser set the context.

## 6. Bridge options for Claim v1

| Option | Security and revocation | Complexity and operations | RLS/client effect | Hybrid rollback |
|---|---|---|---|---|
| A. Server Firebase Admin validation plus transaction-local PostgreSQL principal | Best fit for a current Firebase observation on every protected request; no reusable database credential reaches the browser | Adds a trusted gateway and disciplined transaction/pool handling, but reuses current Firebase authority | RLS/trusted commands can consume a server-established provider-neutral principal; browser cannot bypass the gateway | Smallest authority change and clearest feature-level rollback during the hybrid phase |
| B. Exchange Firebase identity for custom Supabase/PostgREST JWT | Browser receives another reusable credential; disablement freshness depends on token lifetime, refresh and revocation design | Requires signer custody, issuer/audience/expiry/replay rules, refresh flow and incident rotation | Direct Data API integration is convenient after a complete RLS design | More moving parts and harder immediate revocation/rollback |
| C. Migrate immediately to Supabase Auth | Can integrate natively with Supabase tokens after a complete migration | Highest migration, recovery, email-action, session, support and cutover burden | Direct RLS integration is strongest after migration completion | Largest blast radius and weakest fit for the current Firebase-authoritative hybrid state |

**Recommendation, not Owner approval:** use Option A for Claim v1. It best preserves Firebase disablement/verification freshness, keeps database credentials out of the browser, minimizes the authority cutover, and supports provider-neutral RLS/trusted commands later. Option B may be reconsidered only after a separate short-lived-token and revocation design. Option C belongs to a future Auth migration decision, not the first Claim bridge.

No option permits silent fallback. After a feature cuts over, failure to establish Supabase identity must deny the feature rather than authorize through Firestore.

## 7. Exact gaps before a real Claim Auth bridge

The immediate blocking gap is **an approved and implemented trusted gateway plus restricted database runtime/context contract**. SEC-001 remains unapproved, and the repository has no production server path, dedicated runtime role, hardened current-principal resolver, or approved context-setting protocol.

Before implementation or activation, the project still needs:

1. Product/Security/Data Owner approval of the SEC-001 bridge direction without modifying this POC into that approval.
2. A reviewed server transport and deployment boundary, Firebase Admin credential custody, TLS, CSRF/anti-replay/abuse controls, request size/time limits, and safe error mapping.
3. A dedicated least-privilege PostgreSQL runtime role and hardened transaction wrapper that begins, sets the server-derived principal, executes one bounded operation, and always commits/rolls back before releasing the connection.
4. The final context fields/name, purpose/environment/policy binding, current-principal resolver, schema placement, grants, and tests proving callers cannot execute arbitrary `SET` or SQL.
5. Trusted provider-link provisioning, reconciliation, correction/quarantine lineage, and proof that a structurally valid but semantically wrong internal mapping cannot be silently created.
6. A signed-token non-Production test and the selected real driver/pool reuse matrix, including exceptions, cancellation, timeouts, retries, and connection-return behavior.
7. Claim structures, role-backed administration access, security deny/hold inputs, reviewer assignment/conflict rules, trusted commands, audit, idempotency/domain events, notifications, RLS, field-minimized projections, and their negative/race tests.
8. Approved hosted environment/residency and migration/cutover/rollback decisions (`RES-001` and `MIG-002`) before any hosted use, plus explicit Production activation approval.

## 8. Scope and stop point

Files added by this POC are a narrow test, its runner, and this single evidence document; `package.json` gains one test script. There is no migration, RLS policy, grant, persistent setting, Firebase configuration change, application runtime integration, hosted operation, real identity row, or Production/data impact.

Exact stop point: local POC evidence, cleanup, commit/push, and one Draft PR. Stop before SEC-001 approval, Production bridge implementation, RLS, Claim runtime, hosted Supabase, Firebase Production, deployment, or merge.
