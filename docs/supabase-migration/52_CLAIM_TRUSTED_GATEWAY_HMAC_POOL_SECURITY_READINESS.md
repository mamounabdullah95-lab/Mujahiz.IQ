# Claim trusted gateway — Firebase, HMAC, driver and pool security readiness

Status: **Documentation-only runtime security-readiness boundary; no gateway, credential, role membership, driver/pool, hosted resource, Firebase change, data action, deployment, or activation is implemented or authorized**

Date: 2026-08-10

Verified starting `origin/main`: `fce7a0b3b0f8c5f8f130d91b16f748b6d9f2966c`

Starting-SHA evidence: the verified commit is the merge of PR #103, `Implement supplier_claim.submit trusted command`. This document does not assume PR #103's state: it records the merge proved by the starting commit and the merged tree. Repository merge evidence is not hosted, deployed, staging, Firebase, Supabase, or Production evidence.

Branch/worktree: `codex/claim-gateway-runtime-readiness` / `.worktrees/claim-gateway-runtime-readiness`

Primary task profile: Documentation

## 1. Purpose, authority, and hard boundary

This document defines the exact future runtime security boundary required to turn the locally proved Firebase-to-PostgreSQL identity path and the local Claim command substrate into a real trusted gateway. It is a readiness specification, not an activation decision.

The required boundary is:

> A server-only gateway validates one current Firebase identity, resolves one provider-neutral PostgreSQL principal, assumes one transaction-scoped least-privilege database role, injects one environment/version-bound HMAC key context, invokes one fixed Claim surface, and commits or rolls back before the physical connection is released. No user principal, role, HMAC material, purpose, environment, policy, or search path is selected by the request or survives transaction reuse.

This document does not:

- choose or access a hosted Supabase project;
- choose a gateway host, region, driver, pool, pooler, paid secret product, or Production topology;
- resolve `RES-001` or `MIG-002`;
- access Firebase, hosted Supabase, Production, or controlled TEST data;
- add SQL, application code, configuration, credentials, roles, memberships, grants, or tests;
- authorize real identity/provider-link rows, migration, reconciliation writes, deployment, or feature activation; or
- make `supplier_claim.submit` or any other Claim command reachable by a browser or deployed service.

## 2. Evidence and current-state findings

| Evidence | What it proves | What it does not prove |
|---|---|---|
| [ID-001](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) | Firebase Auth remains the hybrid authentication, account-state, session, and email-verification authority; `user_profiles.id` is the provider-neutral domain principal; exact active Firebase linkage is required | A gateway, provider reconciler, hosted identity migration, or runtime credential path |
| [SEC-001](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md) | Claim v1 uses a server-mediated bridge, default-deny objects, field-minimized surfaces, current Firebase observation, dedicated roles, and no `service_role` authorization | Delivery of the gateway, signed-token staging proof, real pool isolation, or activation |
| [PR #98 POC](43_FIREBASE_SUPABASE_REQUEST_SCOPED_AUTH_BRIDGE_POC.md) | Synthetic Auth Emulator identity resolution and transaction-local principal cleanup after commit and rollback on one reused backend connection | Real signed tokens, certificate rotation, Firebase/Admin outage behavior, a non-superuser login path, or a real driver/pool/pooler |
| [PR #101 evidence](45_CLAIM_RUNTIME_IDENTITY_CONTEXT_FOUNDATION_EVIDENCE.md) | Local `NOLOGIN NOINHERIT` `mujahiz_claim_runtime`, non-exposed `claim_security`, and transaction-bound principal/purpose/environment/policy context | A gateway login, role-assumption membership, provider resolver, staging/Production environment binding, or complete Auth bridge |
| [Claim command contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md) | Six-command model, deterministic locks, exact 720-hour validity, shared idempotency/events, atomicity, safe results, and no Firebase fallback | Delivery of five remaining commands or the complete shippable Claim vertical slice |
| [PR #103 evidence](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md) | The local `supplier_claim.submit` candidate derives the claimant from context, requires `mujahiz.claim.hmac_key`, writes HMAC digests, and grants only the local runtime role its command surface | Current Firebase validation, HMAC custody/rotation, a login/driver/pool, hosted behavior, or real authority |
| Current Firebase server code | Node 22 callable Functions are configured for `europe-west1`; Admin initialization uses ambient application credentials; current Claim callables re-read Firebase users and Firestore profiles; Claim is feature-flagged fail-closed | A deployed gateway. The verified baseline records zero deployed Functions, and Firebase Hosting rewrites only to the SPA |

Additional verified findings at the starting SHA:

- PR #103 is merged into the starting tree, but the shared baseline still describes the pre-PR #103 checkpoint. This file records the exact starting SHA without editing that shared baseline.
- The repository has no direct application dependency or integration selecting a real PostgreSQL driver, connection pool, or hosted pooler. PostgreSQL packages present transitively under local tooling are not a runtime selection.
- No application code calls `mujahiz_claim_runtime`, `claim_security.establish_claim_runtime_context`, the HMAC setting, or `supplier_claim.submit`.
- `mujahiz_claim_runtime` has no login credential. Its current membership invariant admits only the local platform's non-inheriting, non-assumable administrative membership; a gateway login cannot currently become this role.
- The local context is fixed to environment `local` and policy `sec-001-claim-v1`. PR #103 also fixes HMAC digest version `local_v1` and its idempotency namespace to `local`.
- The submit routine is currently a `SECURITY DEFINER` routine owned by `postgres`. Its fixed `pg_catalog` search path and fully qualified object references are positive local evidence, but a hosted activation still requires a dedicated, non-login, non-superuser command-owner model with only its exact object rights.
- The Firebase callable error wrapper currently logs error name and message for unexpected failures. A future gateway must not carry raw provider, driver, database, token, credential, or HMAC-bearing error text into logs.

## 3. Threat model

### 3.1 Assets and trust zones

Protected assets are Firebase sessions and ID tokens, Firebase Admin authority, exact provider-to-profile mappings, provider-neutral principal IDs, Claim and ownership state, database login credentials, the HMAC key ring, idempotency bindings, audit/events, connection state, and safe error/telemetry boundaries.

The browser and every request value are untrusted. The gateway process, its approved workload identity, its secret adapter, and its fixed database wrapper form one trusted computing boundary. PostgreSQL constraints, RLS, grants, transaction-local context, and fixed routines are independent defenses inside that boundary. Firebase remains the external identity authority during the hybrid phase.

The boundary protects against a malicious or compromised request. It cannot make a fully compromised gateway process harmless: code execution inside the trusted gateway could use its Firebase authority, database login, and HMAC key to impersonate a principal. Gateway process compromise is therefore a credential-compromise incident requiring feature shutdown, credential rotation, reconciliation, and review; RLS cannot repair that trust loss.

### 3.2 Threat and control matrix

| Threat | Required control | Fail-closed result |
|---|---|---|
| Forged, expired, wrong-project, or wrong-issuer Firebase token | Firebase Admin signed-token verification against the gateway's pinned environment project; no hand-written JWT acceptance | Deny before principal context or command invocation |
| Valid token for a disabled, deleted, revoked, or no-longer-verified user | Revocation-aware verification plus a current exact Firebase user lookup on every protected request | Deny; no PostgreSQL mirror or cached positive result may override Firebase |
| Request supplies another UID, provider-link ID, or `user_profile_id` | Derive subject only from the verified token; exact protected provider resolver returns the profile; typed command has no actor input | Ignore supplied identity and deny any mapping ambiguity |
| Structurally valid but semantically stale/wrong provider link | Exact active-primary link, active profile, mirror/policy comparison, collision lineage, and quarantine checks | Deny and reconcile through a separate trusted path; never match by email |
| Database login leak | Environment-specific login with no direct object authority, no inheritance, no superuser/owner/`BYPASSRLS`, and only transaction-local assumption of the runtime role | Disable gateway, revoke login, rotate, and reconcile; no alternate broad credential |
| HMAC key leak or blind rotation | Dedicated environment key ring, versioned digests, dual-key replay lookup during planned rotation, zero logging, and emergency shutdown | Disable commands; never replace the key blindly and risk duplicate logical commands |
| Principal/HMAC context leaks through a pool | Explicit transaction, transaction-local role and settings, rollback-on-every-error, destroy-on-uncertain-cleanup, and same-backend reuse tests | Connection is not released as reusable until known idle/clean |
| Request changes purpose, environment, policy, database role, or search path | Values are deployment-owned/fixed; role assumption and settings occur only inside the wrapper; functions use fixed minimal search paths and qualified objects | Deny invalid binding; request value has no effect |
| SQL injection or generic SQL access | Fixed routine signatures, bound parameters, no caller-selected object/filter/SQL fragment, no multi-statement request surface | Reject input; no generic query endpoint exists |
| `service_role` bypass | Exclude `service_role` from browser, gateway, workers, and Claim object grants; use purpose-specific identities | Generic service identity has no Claim path |
| Firebase/Admin, key, pool, pooler, or database outage | Bounded timeouts, rollback, safe unavailable response, same-key retry only after rollback/unknown-commit reconciliation | Claim unavailable; never authorize through mirrors or Firebase Claim storage |
| Ambiguous commit after disconnect/timeout | Shared idempotency key and replay lookup on a fresh fully re-authorized transaction | Reconcile or replay the same Supabase command; never create a Firebase write |
| Sensitive logs or tracing | Allowlisted structured events, parameter/body capture disabled, raw exceptions redacted, no query/secret dumps | Operational signal remains; credential and private content do not |
| Supabase Claim outage after authority cutover | Explicit authority manifest and backend-level disabling of old Firebase Claim writes | Fail closed; no silent read/write/notification fallback |

## 4. Required gateway sequence

The repository convention supports Mermaid, so the required sequence is recorded below. It is normative for the later wrapper; names and hosting products remain unselected.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant G as Trusted gateway
    participant F as Firebase Admin/Auth
    participant P as Selected pool/pooler
    participant D as PostgreSQL

    B->>G: Firebase ID token + typed Claim request
    G->>P: Acquire one exclusive connection
    G->>D: Begin explicit transaction
    G->>D: Assume Claim runtime role transaction-locally
    G->>F: Verify signed token and fetch current user
    F-->>G: Verified subject and current account state
    G->>D: Resolve exact active Firebase link and active profile
    D-->>G: One provider-neutral user_profile_id
    G->>D: Establish principal/fixed bindings and HMAC transaction-locally
    G->>D: Invoke one fixed Claim command or read surface
    alt successful bounded result
        D-->>G: Safe typed result
        G->>D: Commit
    else denial, exception, timeout, or cancellation
        G->>D: Roll back
    end
    G->>P: Release only when idle and clean; otherwise destroy
    G-->>B: Safe mapped response
```

### 4.1 Exact transaction order

1. **Request intake before acquisition:** enforce TLS termination, method/content type, body/token size, rate/abuse limits, endpoint/feature flag, and typed envelope. These checks do not establish identity or authorize a database action. Never log the token or body.
2. **Acquire connection:** obtain one exclusive client from the selected gateway-only pool. Pool-acquire timeout returns unavailable without database context. A connection already in a transaction, failed state, assumed role, or nonempty request context is destroyed, not repaired and reused.
3. **Begin:** start one explicit transaction immediately. Configure only transaction-local timeouts. No user, HMAC, role, purpose, environment, policy, request ID, or search-path state may have been set on the database session before this point.
4. **Assume the runtime role:** inside the transaction, use the approved transaction-local role-assumption path to `mujahiz_claim_runtime`. Prove the fixed gateway `session_user` and runtime `current_user`; the request cannot select either.
5. **Verify Firebase:** use the environment-pinned Firebase Admin verifier for signature/issuer/audience/expiry/revocation, then fetch the exact current user. Require existing, enabled, currently email-verified state and token/current-user agreement. Firebase/Admin timeout or outage rolls back.
6. **Resolve provider identity:** on the same connection and transaction, call one non-exposed, fixed resolver that requires the verified Firebase subject and returns exactly one active primary Firebase link to one active profile. It must return no provider subject/link detail. No direct base-table grant to the login/runtime role is implied; the resolver boundary is not yet implemented.
7. **Establish context and HMAC:** call the existing typed principal setter, retain fixed purpose/environment/policy/transaction binding, and inject the approved HMAC key/version through a bound, transaction-local database setting. The key is never placed in SQL text. Verify only a boolean context-ready result; never read the raw key back.
8. **Invoke one surface:** call exactly one allowlisted Claim read or command signature with bound typed parameters. No generic SQL, arbitrary routine name, multi-command batch, or caller-selected role is allowed.
9. **Finish:** commit only after a complete safe result. Any authorization/business error expressed as a database exception, unknown error, Firebase error, timeout, cancellation, or wrapper failure rolls back. Notification work remains outside the Claim command transaction under its approved event/materializer boundary.
10. **Release:** release only after commit or confirmed rollback and driver confirmation that the connection is idle. If cleanup, cancellation, socket, or server state is uncertain, destroy the connection. A retry acquires a new connection and repeats Firebase/current-user/provider resolution and context establishment.

Optional pre-acquisition token parsing may reject an obviously missing or oversized bearer value for load shedding, but it is never authorization evidence. The authoritative signed-token verification and current-user observation for the command occur in step 5.

### 4.2 State that must never be session-global

The following database state must be absent before `BEGIN` and absent after `COMMIT` or `ROLLBACK`:

- `mujahiz.claim.user_profile_id`;
- `mujahiz.claim.purpose`;
- `mujahiz.claim.environment`;
- `mujahiz.claim.policy_version`;
- `mujahiz.claim.transaction_id`;
- `mujahiz.claim.hmac_key` and every future active/retiring HMAC setting;
- a request/correlation principal binding;
- assumed `mujahiz_claim_runtime` role state;
- request-specific search path, time zone, statement/lock timeout, or application name;
- session advisory locks, temporary objects, or prepared statements containing request values or secrets; and
- any cached authorization decision tied to a prior Firebase user.

Only pool-wide non-principal configuration, such as a constant sanitized application identifier and TLS settings, may be connection-scoped. Transaction-level advisory locks used by Claim commands release with transaction end.

## 5. Firebase signed-token and current-user validation

The future gateway must use the Firebase Admin SDK rather than decode-and-trust or implement its own signature rules. The Admin app is initialized for one deployment-pinned Firebase project. Project ID, issuer, accepted audience, emulator mode, certificate endpoint, or tenant mode cannot come from the request.

For Claim v1, the gateway performs revocation-aware ID-token verification and a separate current `getUser`-equivalent lookup on every protected request. If an approved hosting transport already verifies a callable token, the staging proof must still demonstrate the exact signature/issuer/audience/expiry/revocation guarantees and the separate current-user lookup; transport convenience cannot weaken this matrix.

### 5.1 Signed-token validation matrix

| Check | Required accepted state | Required denial/failure behavior |
|---|---|---|
| Transport | One bounded bearer token received only over the approved HTTPS gateway endpoint | Missing, duplicate, oversized, malformed, query-string, or body-logged token is rejected before database identity context |
| Admin environment | Named/configured Admin app is pinned to the gateway environment's approved Firebase project | Missing/ambiguous project config, Emulator variables outside approved local tests, or request-selected project fails gateway startup/health and keeps Claim disabled |
| Signature and key | Admin SDK validates the real signature, supported algorithm, key ID, and trusted certificate chain/key set | Bad signature/algorithm/key, unknown key with failed refresh, or certificate/key retrieval failure denies |
| Issuer | Exact issuer for the pinned Firebase project | Wrong issuer denies; no multi-project fallback |
| Audience | Exact pinned Firebase project audience | Wrong or missing audience denies; no token-provided project selection |
| Time | Token is not expired and satisfies SDK-issued-at/time validity with no application-added grace | Expired, future/invalid issued-at, or malformed time claims deny |
| Subject | Nonempty verified Firebase UID/subject from the validated token | Missing/malformed subject denies; request UID is ignored |
| Session revocation | Token remains valid against Firebase's current revocation boundary | Revoked session/password-reset/sign-out-all boundary denies |
| Current user | Exact subject still resolves to one current Firebase user | Not found/deleted or lookup failure denies |
| Disabled state | Current user is enabled | Disabled denies even when the token remains cryptographically valid |
| Email verification | Current user `emailVerified` and token `email_verified` are both true | Missing/false/disagreement denies |
| Email agreement | Where Claim requires email, normalized token email equals the current Firebase user email | Missing/mismatch/stale token denies; email never links a profile |
| Provider link | Exactly one active, primary, linked `firebase` row has exact `provider_subject = verified subject`, active/verified noncontradictory mirror state, and approved lineage | Zero, duplicate, inactive, non-primary, quarantined, historically conflicting, stale-policy, or contradictory links deny |
| User profile | Link resolves to exactly one active, non-suspended/non-deactivated `user_profiles.id` | Missing, duplicate, inactive, or incompatible profile denies |
| Command eligibility | PostgreSQL re-reads account context, Supplier, ownership, Claim, role/access/assignment/holds required by that exact surface | Token claims or gateway context never replace current relational authorization |

The Firebase signing-key cache may be used only according to the Admin SDK's verified cache semantics. Even if a cached signing key permits cryptographic verification during a key-service interruption, the separately mandatory current-user lookup must still succeed. Firebase/Admin unavailability therefore denies every Claim-v1 protected request. There is no PostgreSQL-mirror, Firestore-profile, cached-user, or stale-token fallback.

### 5.2 Outage and key-rotation validation

The signed-token staging gate must cover:

- a token signed by a real approved non-Production Firebase project;
- unknown/invalid key ID and signature;
- certificate/key retrieval success, cache use, refresh failure, and recovery;
- a token issued before disablement, deletion, verification loss, email change, revocation, and signing-key rotation where the non-Production platform permits proof;
- current-user lookup timeout, quota/transient failure, and unavailable service;
- wrong issuer/audience/project and accidental Emulator configuration; and
- safe response/logging with no token, UID, email, certificate payload, Admin credential, or provider response body.

If natural signing-key rotation cannot be scheduled, the staging plan must at minimum prove valid cached-key behavior, unknown-key refresh failure, and successful refresh/recovery, then record natural-rotation evidence before Production activation. An unproved rotation path remains a blocker.

## 6. Credential custody and role matrix

Firebase browser configuration and a user's own Firebase ID token are not gateway secrets, but the token is a bearer credential and must be transiently protected. Every server/database key below is a secret unless explicitly marked otherwise.

| Material/identity | Purpose | Approved future holder/custody class | Must not exist in |
|---|---|---|---|
| User Firebase ID token | Authenticate one request to the gateway | Browser Firebase session and gateway request memory only; HTTPS; shortest practical lifetime | URLs, analytics, logs, traces, error reports, database context/rows, audit/events/notifications, PRs |
| Firebase Admin authority | Verify/revoke-check tokens and fetch current users | Prefer host-attached workload identity/default application identity when the approved host supports it; otherwise protected server-only secret injection | Browser/Vite variables, repository, build artifact, database, logs, audit/events/notifications |
| Gateway database login credential or short-lived database auth material | Authenticate pool connections as one environment-specific gateway login | Selected host's server-only secret/workload identity mechanism and the database driver only | Browser, repository, migration files, rows, traces, query logs, audit/events/notifications |
| `mujahiz_claim_runtime` | Bound Claim execution privileges after transaction-local assumption | `NOLOGIN`; no password, key, or browser token exists | Any credential store; it must remain a role, not a reusable credential |
| Claim HMAC active/retiring key ring | Protect idempotency-key digests, request fingerprints, and lease digests | Server-only secret injection or OS-protected read-only secret file exposed only to the gateway transaction wrapper | Browser, repository, database rows/defaults, command arguments returned to clients, logs, audit/events/notifications |
| HMAC version labels | Identify the nonsecret key version stored with digests | Deployment configuration and version columns; labels contain no secret material | Request-controlled fields; labels must not embed secret fragments |
| Command-owner role | Own narrow definer routines and exact base-object rights | Dedicated `NOLOGIN`, non-superuser, non-`BYPASSRLS` PostgreSQL role; no external credential | Gateway membership, browser credential, general migration authority |
| Migration/operator credential | Apply approved migrations and role/grant changes | Separate protected deployment workflow, time-bounded where possible | Online gateway, worker, browser, application config, logs |
| TLS trust anchors and public endpoint names | Authenticate the server/network; not secret | Deployment image/config with pinned validation rules | Request overrides; private keys remain secret even though public CAs are not |
| Supabase `service_role` | No purpose in the Claim gateway | Outside this runtime path; not provisioned to the gateway | Browser, gateway, Claim workers, Claim command configuration |

Acceptable secret-storage **classes**, without selecting a paid product, are:

1. hosting-native encrypted secret injection or workload identity available in the later approved platform;
2. an OS-protected, read-only mounted secret file backed by an encrypted operator-controlled store and readable only by the gateway service identity; or
3. protected server-only environment injection when the selected host prevents untrusted enumeration, disables environment/debug dumps, and supports audited rotation.

Plain `.env` files with live values, repository/CI artifacts, container images, command-line arguments, Vite-prefixed variables, shared operator notes, database settings/defaults, and database rows are prohibited custody locations. CI may carry only the separately approved deployment injection reference or protected value needed for that workflow; it must not print it.

## 7. How a gateway login reaches `mujahiz_claim_runtime`

### 7.1 Required conceptual role path

`mujahiz_claim_runtime` must remain `NOLOGIN`. The future selected path is one environment-specific gateway `LOGIN` role with no direct table, sequence, internal-schema, command-owner, migration, schema-creation, database-creation, role-creation, replication, superuser, or `BYPASSRLS` authority. It receives one non-inheriting, non-admin membership that permits explicit assumption of `mujahiz_claim_runtime`.

The gateway authenticates the physical connection as the login role, begins a transaction, and assumes `mujahiz_claim_runtime` only for that transaction. `session_user` remains the gateway login for attribution; `current_user` becomes `mujahiz_claim_runtime` for the bounded operation. Commit/rollback restores the login role before pool release.

This preserves the reasons for `NOLOGIN`: the privileged capability is a role bundle, not a credential; the credential can be rotated without altering grants; and a pool connection has no inherited Claim authority before the wrapper begins and assumes the role.

The current PR #101 migration deliberately rejects this future membership, so a separately reviewed role/grant migration and catalog tests are required. The exact membership must be environment-specific, non-inheriting, non-admin, and role-assumable only by the named gateway login. No human/operator, API role, generic worker, `service_role`, or migration role receives that membership.

### 7.2 Options rejected for the trusted path

| Option | Result | Reason |
|---|---|---|
| Make `mujahiz_claim_runtime` a login role | Reject | Couples secrets to the capability role and contradicts the reviewed `NOLOGIN` boundary |
| Copy command grants directly to the login role | Reject | Creates two drifting privilege bundles and weakens role/audit/isolation tests |
| Give the login inherited runtime authority | Reject | A pooled session would hold Claim capability before `BEGIN`; explicit transaction scope is lost |
| Use superuser, database owner, migration role, `postgres`, or `service_role` as the gateway login | Reject | Broad bypass and role-management authority defeat least privilege and RLS/object-grant defenses |
| Use session-global role assumption or connection-startup role options | Reject | Role state can cross requests and is harder to prove clean under pooling |
| Let the request select a role | Reject | Direct privilege escalation |

### 7.3 Definer-owner and resolver requirements

The gateway/runtime login receives no direct read of `internal.identity_provider_links`. A later fixed, non-exposed provider resolver must be owned by a dedicated non-login owner with only the exact profile/link columns it needs and must return only an opaque `user_profiles.id` or no principal.

Before hosted activation, the local `postgres` ownership of `supplier_claim.submit` must be replaced or proven equivalent through a dedicated non-login, non-superuser, non-`BYPASSRLS` command owner with only the command's exact object privileges. The command owner is not granted to the gateway or runtime role. Fixed `pg_catalog` search paths, qualified object references, no dynamic SQL, no attacker-writable schema ownership, and catalog assertions remain mandatory.

## 8. HMAC lifecycle

### 8.1 Purpose and key requirements

The Claim HMAC key is a server/database shared secret used only to derive:

- the stored digest of a raw caller idempotency key in a versioned environment/command namespace;
- the keyed fingerprint of the command-owned canonical semantic request; and
- transient lease-token digests.

It is not a Firebase signer, encryption key, database password, JWT key, audit signer, CSRF secret, telemetry hash key, or user authentication factor. It grants no application role by itself. The raw caller idempotency key and raw HMAC key are never persisted.

Each environment gets a distinct dedicated key generated from at least **32 random bytes (256 bits) of cryptographically secure entropy**. Encode it as one control-character-free base64url or equivalent opaque value whose UTF-8 representation remains within PR #103's current 32–256-byte acceptance range. Human-chosen text, reused credentials, UUIDs alone, deterministic derivation from project names, and copied keys across environments are prohibited.

### 8.2 Storage, injection, and zero logging

The active/retiring key ring is loaded from one approved server-only custody class in section 6 and exposed only to the transaction wrapper. The wrapper injects the selected key and nonsecret version with bound parameters after Firebase/provider resolution and after `BEGIN`; PR #103's command consumes the key through transaction-local database context.

Mandatory controls are:

- never concatenate the key into statement text, connection URLs, role options, application names, comments, exceptions, or retry metadata;
- disable driver parameter/query debug output, APM database parameter capture, HTTP body/header capture, process environment dumps, core dumps containing secrets, and server parameter logging for the injection statement;
- never include the key, raw idempotency key, key digest, request fingerprint, lease digest, or key fragment in application logs, database logs, audit rows, domain events, notifications, safe results, metrics labels, or traces;
- never read the raw HMAC setting back into application code; readiness checks return only a boolean;
- keep the key out of persistent database role/database defaults and rows; transaction-local backend memory is the only database-side location; and
- minimize copies and lifetime in gateway memory and clear/replace the in-memory reference on rotation as supported by the selected runtime.

If no valid active key is available at startup, the Claim gateway is unhealthy and the Claim feature remains disabled. If the key becomes unavailable during a request, do not invoke the command; roll back and return generic service unavailable. PR #103's `claim_context_invalid` is an internal fail-closed guard, not a reason to blame or prompt the user. No unkeyed digest, static fallback key, previous environment key, or Firebase command fallback is permitted.

### 8.3 Planned rotation and dual-key implications

PR #103 is **not rotation-ready by simple replacement**. It accepts one HMAC key and hard-codes `local_v1`. Because the raw idempotency key is not stored, replacing the key changes its digest; the same logical retry would not find the old row and could reserve a second namespace entry. Existing key-version columns record provenance but do not by themselves perform old-key lookup.

Before activation, a later reviewed implementation must support a bounded key ring of exactly one **active** and at most one **retiring** key per environment/command family:

1. Deploy version-aware lookup capable of computing candidate key and request digests with the current and retiring keys while the old key still writes new records.
2. Inject the newly generated key/version and switch new reservations to it. New rows use only the active version; lookup/replay tries the active version and then the one retiring version.
3. When an old-version row matches, validate its actor/target/fingerprint using that row's recorded key versions. Do not rewrite old key/fingerprint digests, because the raw original key/request may no longer be available outside the retry.
4. Retain the retiring key until every replay row, failed-result binding, processing lease, and required conflict tombstone using that version is past its approved maximum horizon and a protected count proves no retained dependency remains.
5. Remove the retiring key, record only the nonsecret rotation evidence/version/time, and prove old-key absence plus same-key replay behavior in staging.

The future key-ring design must keep lookup order and timing bounded and must not reveal which key version matched. More than one retiring key requires a new review; an unbounded key ring is prohibited.

For suspected compromise, do not perform a blind online rotation. Disable the Claim gateway, revoke the gateway/database/Firebase credentials as applicable, preserve rows and nonsecret key-version evidence, assess whether old-key verification can be used safely in an isolated reconciliation path, and approve a replay/reconciliation plan before re-enabling. Loss of the only old key can make old raw idempotency keys impossible to match; that is an incident and reconciliation condition, not authority to create a new command or fall back to Firebase.

### 8.4 Environment separation

Local, development, staging, and Production must use different HMAC secrets, version namespaces, gateway logins, Firebase projects, database targets, and authority manifests. No environment may accept another environment's key/version or token audience. The current fixed values `local`, `local_v1`, and `sec-001-claim-v1` are local evidence only; staging/Production bindings require a reviewed implementation after `MIG-002`, and remain server/deployment-selected rather than caller-selected.

## 9. Driver, pool, and pooler readiness

No real runtime driver/pool/pooler is selected. Selection must record exact package/product and version, pooling layers, pooler mode, TLS verification, authentication mechanism, connection limits, acquire/idle/lifetime/statement/lock timeouts, cancellation method, prepared-statement behavior, retry ownership, and connection-destroy semantics.

Statement pooling is incompatible because one Claim operation requires a single backend transaction, transaction-local role/settings, and advisory locks. Transaction pooling is eligible only if it pins one backend from begin through commit/rollback and proves support for transaction-local role/settings, cancellation, advisory locks, and the selected prepared-statement mode. Direct/session pooling is eligible only with the same cleanup proof. No driver-level transparent transaction retry is allowed.

### 9.1 Mandatory pool isolation matrix

Every case uses synthetic principals and synthetic HMAC sentinels only. The test captures a backend identifier and, where needed, constrains the pool to force physical connection reuse. After the terminal action, a new transaction under a different synthetic request proves that the old principal, purpose, environment, policy, transaction ID, HMAC sentinel, request role, timeout, search path, and transaction advisory locks are absent. Production checks must never read back a real HMAC value; the reusable readiness helper returns only clean/not-clean.

| Case | Fault/action | Required wrapper behavior | Mandatory reuse proof |
|---|---|---|---|
| Begin/commit | Establish context, invoke a successful bounded operation, commit | Release only after commit acknowledgement and idle state | Same backend can be reused; prior principal/HMAC are absent; role is login until the new transaction assumes runtime; new principal sees only its own result |
| Explicit rollback | Establish context, then roll back intentionally | Confirm rollback and idle state before release | Same backend has no prior context/role/locks and accepts a different synthetic principal safely |
| Thrown application/database exception | Throw after role/context/HMAC and before commit, including a stable command error | Catch, roll back in `finally`, map safely; destroy if rollback fails | Reused backend contains no prior context; no partial Claim/idempotency/event state |
| Statement timeout | Trigger timeout while command/context exists | Treat transaction as aborted, cancel if required, roll back; destroy on uncertain server completion | Old settings/role absent; timed-out work has not committed; same idempotency key can be reconciled on a fresh transaction |
| Client/request cancellation | Cancel while Firebase lookup, provider resolution, or database command is active | Abort bounded work, roll back; never release while server work may continue; destroy if cancellation/rollback is unconfirmed | No old context on reuse and no late result commits outside the idempotency contract |
| Server disconnect | Disconnect before command, during command, and around commit acknowledgement | Remove/destroy socket; never return it to pool; classify commit as ambiguous when appropriate | Fresh connection repeats full Firebase/provider validation and uses the same idempotency key; one safe result and no duplicate effects |
| Pooler/backend restart | Backend changes or pooler drops transaction state | Fail request safely, discard client, respect pool backoff/circuit limits | No state is assumed to survive; retry begins a completely new transaction and context |
| Retryable serialization/deadlock/transient error | Database aborts the transaction | Retry only after confirmed rollback on a fresh transaction, bounded attempts/backoff, same key, and renewed Firebase/current-user/provider checks | Each attempt has a new transaction binding; one committed result; no hidden automatic driver retry |
| Non-retryable/business error | Stable authorization, validation, conflict, or integrity result | Roll back and return the mapped safe result; do not retry with a new key | Connection is clean; no mutation or context leakage |
| Acquire timeout | Pool cannot provide a connection | Return service unavailable; no database context was established | Later acquired connection starts clean; no request state was queued onto it |
| Release/reuse | Normal and error paths call release | Release only from known idle state; double release is prevented; uncertain clients are destroyed | Reacquire the same backend repeatedly across alternating principals/HMAC sentinels with zero cross-request visibility |
| Process crash after commit | Database may have committed but response was lost | On restart, use new pool/connection, full auth, same idempotency key | Completed replay returns the original safe result without a duplicate Claim/event |
| HMAC rotation during pool reuse | Active version changes while old rows remain | Existing transaction finishes with its captured version; new transaction loads the new active plus retiring key ring | No connection retains the old key setting; old-key replay and new-key reservation both work as specified |

### 9.2 Required connection and pool assertions

The selected integration must additionally prove:

- one connection is exclusively leased for the entire transaction;
- the gateway login has no useful base authority before role assumption;
- only the exact runtime role can be assumed, and only inside the transaction;
- release never performs an implicit commit;
- a failed transaction cannot be returned without rollback;
- connection lifetime/idle eviction cannot interrupt cleanup silently;
- cancellation targets the correct backend/request and cannot cancel another pooled request;
- retry classification is allowlisted and unknown errors do not retry automatically;
- an ambiguous commit is reconciled by the same Supabase idempotency key, never by Firebase;
- pool size and host concurrency cannot exceed the approved database/pooler connection budget;
- TLS hostname and certificate verification remain enabled through direct and pooled routes;
- secrets are absent from connection names, URLs in logs, driver diagnostics, metrics, and tracing; and
- driver/pool/pooler versions and configuration hashes are recorded in test evidence without credentials.

## 10. Context spoofing analysis

| Attempted request manipulation | Why it must fail | Residual trust/risk |
|---|---|---|
| `user_profile_id`, Firebase UID, or provider-link ID | Typed request schema has no actor field; token subject is SDK-derived; resolver returns the sole principal; context setter receives only server-held result | A compromised gateway process can call the setter with another UUID; gateway compromise is outside malicious-request containment |
| HMAC key or version | Request schema/header has no secret/version input; wrapper loads deployment key ring and fixed version | Gateway/secret-store compromise can forge digests; incident shutdown and reconciliation required |
| Purpose/environment/policy | Values are compiled/deployment-bound and verified by the accessor/command; request values are ignored | Current `local` bindings must be replaced through reviewed environment-specific implementation before hosted use |
| Database role | Pool authenticates one fixed login and the wrapper assumes one fixed runtime role transaction-locally; role name is not a parameter | Leaked login credential plus membership is a trusted-service compromise; narrow grants limit but do not eliminate impact |
| Platform Owner/Admin/reviewer role | Never placed in bridge context; PostgreSQL re-reads current role/access/assignment/conflict state | Missing role/access/security infrastructure continues to block reviewer/decision paths |
| Function or schema name | Endpoint maps to one fixed qualified routine signature; no dynamic SQL or generic RPC dispatcher | Every new routine requires independent ownership/grant/search-path tests |
| SQL function `search_path` | Current helpers/submit fix `pg_catalog`; all non-built-in objects are qualified; gateway/runtime cannot create in consulted schemas | Current superuser definer ownership remains a hosted-readiness blocker until narrowed |
| Connection options, time zone, timeout, application name | Fixed by deployment/wrapper and transaction; request cannot supply driver options | Pooler/driver must prove no request option escapes into session state |
| Target Supplier/Claim/idempotency inputs | May be typed business inputs but never authority; command re-reads state under locks and binds idempotency fingerprint | Anti-oracle safe errors and exact command tests remain required |

No browser endpoint, debug console, health route, background job payload, or operator API may expose the context setter, HMAC injection, role assumption, provider resolver, or arbitrary command name. Health checks report only ready/not-ready and dependency class.

## 11. `service_role` boundary

`service_role` remains entirely outside the Claim trusted gateway path.

- The browser never receives it.
- The gateway does not use, store, or rotate it.
- Claim commands, provider resolution, reviewer paths, expiry workers, notification materializers, reconciliation, and migration each use separately reviewed identities; none receives a generic `service_role` fallback.
- Current Claim/runtime/internal privileges revoked from `service_role` remain revoked unless an unrelated explicitly approved surface proves a need; convenience is not a need.
- RLS denial, pool failure, Firebase outage, missing HMAC, or command error never triggers a retry with `service_role`.
- If a hosted platform requires a `service_role` key for its own unrelated management plane, its custody and use are isolated from this gateway and do not make it an application authorization identity.

## 12. Error mapping and logging

### 12.1 External mapping

| Internal class | External result | Retry behavior |
|---|---|---|
| Missing/malformed/invalid/expired/revoked token | `authentication_required` with generic unauthorized response | Obtain a current Firebase token; do not retry blindly |
| Disabled/deleted/unverified user, stale email, unmapped/ambiguous link, inactive profile | `identity_unavailable` with one generic denied response | No automatic retry/fallback; user/support resolution only where appropriate |
| Typed request/evidence invalid | `invalid_request` with allowlisted field-safe guidance | Caller may correct using a new logical request/key only as the command contract permits |
| Known Claim/idempotency/version/business conflict | Existing stable safe command code, without hidden actor/row detail | Follow the command's same-key and refresh rules |
| Command processing or retryable database conflict | `command_in_progress` or `retry_later` with bounded hint | Same idempotency key only; full re-authorization |
| Firebase/Admin, HMAC, pool/pooler, database, audit/event prerequisite unavailable | Generic `service_unavailable` / `result_unavailable` | Same key only after bounded backoff; no Firebase data fallback |
| Unknown database/provider/driver/integrity error | `result_unavailable` | No automatic retry unless a separately allowlisted transient class and confirmed rollback |
| Client cancellation/disconnect | No sensitive response; cancel/rollback/destroy as required | Client may later reconcile with the same key |

Unknown Firebase error codes, SQLSTATE values, driver exceptions, and database messages never pass through. Known PR #103 stable command codes may be mapped through an allowlist; `P5100` caused by missing HMAC/server context is mapped to service unavailable internally, not exposed as a user authentication defect.

### 12.2 Log allowlist

Operational logs may contain only:

- generated correlation/request ID that is not a credential or raw idempotency key;
- environment, gateway build/config version, endpoint/command name and contract version;
- coarse outcome class and allowlisted safe error code;
- HTTP status, bounded duration, timeout/cancellation stage, retry attempt, and pool acquire/use/release/destroy event;
- allowlisted Firebase Admin error class without message/body, UID, email, or token;
- allowlisted SQLSTATE/driver class without SQL text, parameters, connection string, server detail/hint/context, or stack payload; and
- nonsecret HMAC key version label and rotation phase only when operationally necessary.

The following are prohibited from application, provider, database, pooler, APM, audit, event, notification, analytics, or crash logs:

- Firebase ID/refresh tokens, Authorization headers, cookies, session material, Admin credentials, Firebase UID/provider subject, and email;
- database URLs, passwords, auth tokens, TLS private keys, `service_role`, migration credentials, or role-assumption secrets;
- HMAC keys/fragments, raw idempotency keys, key/request/lease digests, transaction-local settings, or environment dumps;
- request/response bodies, private Claim reason/evidence/snapshot, reviewer notes, owner/competitor identities, raw URLs, or notification payloads;
- executed SQL, bound parameter arrays, unrestricted exceptions/stacks, certificate response bodies, or query plans containing values; and
- connection names/application names containing a user, Claim, Supplier, token, key, or raw correlation secret.

Pre-auth failures use rate-limited security telemetry, not one durable business audit row per request. Post-auth durable audit follows AUD-001 and the command contract. Audit failure never turns denial into permission; required success-audit failure rolls back the mutation.

## 13. Provider-link detection and reconciliation

PostgreSQL mirrors never override Firebase. The gateway's current Firebase observation is authoritative for existence, disablement, revocation/session eligibility, and email verification; PostgreSQL supplies the approved exact subject-to-domain-principal link and application profile/authorization state.

### 13.1 Drift detected at request time

The request is denied when any of these occurs:

- verified token subject has no exact active primary Firebase link;
- more than one candidate, competing active subjects, or contradictory historical subject/profile lineage exists;
- link/provider subject disagrees with the verified Firebase subject;
- mirror says active/verified while current Firebase says disabled, deleted, revoked, unverified, or changed;
- mirror is inactive/unknown/quarantined or uses an unsupported observation/policy version even when Firebase is currently usable;
- token email/verification disagrees with the current Firebase user;
- the linked profile is missing, inactive, suspended, deactivated, or incompatible with the command; or
- the required observation/reconciliation dependency is unavailable.

The gateway returns only `identity_unavailable`, emits bounded telemetry, rolls back, and does not repair, relink, merge, reactivate, or choose a profile in the Claim transaction.

### 13.2 Separate trusted reconciliation path

A later approved reconciler must:

1. use current Firebase Admin evidence for the exact UID and protected PostgreSQL linkage/migration lineage;
2. classify same-link state drift separately from structural identity collision;
3. serialize provider/profile eligibility changes with the same versioned principal-authority lock used by Claim commands;
4. permit only bounded same-subject/same-profile mirror refresh through a named trusted action;
5. preserve disabled/deleted/unlinked/corrected history and make it non-authorizing rather than delete it;
6. quarantine missing, duplicate, historical-collision, same-subject/different-profile, or multiple-primary cases;
7. require reviewed accountable evidence for correction/relink and never infer identity from email, phone, name, domain, organization, Firestore backlink, or legacy role text;
8. write minimized audit/reconciliation evidence without tokens, full Firebase records, or ordinary-log UIDs/emails;
9. never write Firebase account state from PostgreSQL or treat PostgreSQL `verified/active` as authority over Firebase; and
10. keep the Claim gateway role unable to mutate provider links, profiles, or reconciliation evidence.

Re-enablement or verification recovery requires a fresh Firebase observation and an approved trusted mirror refresh. Deleted/not-found users retain lineage but authorize nothing. A reconciliation outage leaves the request denied; it does not permit a stale mirror window. Any later nonzero cache/freshness window requires a separate revocation-latency decision and evidence; none is approved here.

## 14. Future non-Production validation plan

No hosted action occurs in this task. After `RES-001` and `MIG-002` make their decisions and a separately approved implementation exists, run this plan in an isolated non-Production environment using only synthetic identities and rows.

### 14.1 Environment and evidence prerequisites

Record without secrets:

- exact repository SHA and gateway build/config version;
- approved non-Production Firebase project identity and PostgreSQL environment identity;
- selected gateway host/region, driver/pool/pooler versions and pooler mode;
- TLS route, connection budget, timeout/cancellation/retry configuration, and authority manifest;
- database migration/catalog/grant checksum and runtime/login/owner role assertions;
- HMAC nonsecret active/retiring version labels and rotation phase;
- synthetic fixture manifest and proof that no Production/controlled TEST data is present; and
- feature flag disabled by default outside the bounded test window.

### 14.2 Validation stages

| Stage | Required proof |
|---|---|
| Startup/custody | Gateway starts only with the correct environment identity, Admin authority, DB login/TLS config, and HMAC key ring; each missing/wrong dependency keeps Claim disabled; logs/traces/build artifacts contain no secret |
| Signed tokens | Complete section 5 matrix with real signed non-Production tokens, including disable/delete/revoke/verification/email changes after issuance, wrong project, key refresh/rotation behavior, and Admin outage fault injection |
| Provider resolution | Exact mapped principal succeeds; unmapped, inactive, duplicate, historical collision, wrong profile, stale version, and mirror contradiction deny; caller identity fields have no effect |
| Role/grants | Login has no direct object access; transaction-local runtime assumption works; command owner/resolver owners are non-login/non-superuser/non-`BYPASSRLS`; API roles and `service_role` remain denied; fixed search paths and schema creation restrictions pass catalog tests |
| HMAC | Missing/short/invalid/wrong-environment key denies; raw material appears nowhere; same-key replay works; planned active/retiring rotation preserves old replay and makes new reservations under the active version; blind replacement test demonstrates the guard |
| Pool isolation | Every row in section 9.1 passes on the exact real driver/pool/pooler path, including same-backend reuse, cancellation, timeout, restart/disconnect, ambiguous commit, retry, and destroy-on-uncertain-cleanup |
| End-to-end submit | Valid current Firebase identity creates one synthetic Claim/event/idempotency result through the gateway; same key/payload replays; changed payload conflicts; no direct table or Firebase Claim write occurs |
| Spoof/negative | Principal, UID/link, HMAC/version, purpose/environment/policy, role, search path, routine name, multi-statement, SQL fragment, and hidden-column attempts all fail without an oracle |
| Failure atomicity | Firebase failure before context, resolver failure, command exception, event failure, timeout, cancellation, and audit/event prerequisite failures leave no prohibited partial state |
| Load and exhaustion | Approved concurrency stays within connection budget; acquire timeout/backpressure works; no pool starvation from Firebase outage/open transactions; rate/size limits fail safely |
| Observability | Required metrics/alerts identify dependency class and pool health without sensitive values; token/secret/private-data scans and raw-error injection tests pass |
| Disable/recovery | Authority/feature flag disables the gateway, all Supabase Claim calls fail closed, old Firebase Claim writes stay disabled, and recovery reconciles the same idempotency key before resuming |

### 14.3 Exit criteria

Activation evidence requires all applicable tests to pass on the exact selected versions/configuration with an independent security review. No unresolved context leak, credential log, generic SQL path, role/grant drift, signed-token case, HMAC rotation gap, ambiguous retry duplication, or provider-authority contradiction may be waived. Any configuration/version change to the host, driver, pool, pooler, TLS route, Firebase project, database role path, context contract, or key-ring behavior invalidates the affected evidence and requires rerun.

## 15. Hosting boundary: decisions reserved to `RES-001` and `MIG-002`

This document does not choose Firebase Functions, another application service, Supabase Edge Functions, self-hosting, or any region. Repository Firebase Functions are implementation evidence and one possible future candidate only; zero are deployed, and Hosting has no gateway rewrite.

| Gate | Must decide before gateway activation | Not decided here |
|---|---|---|
| `RES-001` — data residency/hosted resource | Gateway compute/provider and region; hosted PostgreSQL provider/project/region; Supplier/identity/log residency; network path and public/private ingress/egress; TLS termination and certificate validation; Firebase Admin and database connectivity; backup/recovery posture; legal/security review; connection limits/compute availability; secret/workload-identity capability; monitoring/incident/break-glass boundary | Provider, region, plan, topology, pooler, public/private network, or secret product |
| `MIG-002` — environment strategy | Separate local/development/staging/Production Firebase, gateway, database, secret, HMAC, role/login, authority-manifest, project-reference, backup, CI, promotion, and rollback identities; migration ordering/promotion; provider-link provisioning/reconciliation; synthetic staging boundary; cutover/freeze/checkpoint/reverse-delta rules; config/key/policy-version promotion and approval evidence | Environment projects, promotion mechanism, data movement, cutover date, or rollback authority |

`RES-001` blocks creation/selection of the hosted execution and data-residency boundary. `MIG-002` blocks environment creation/promotion, secrets/project references, provider-link/data movement, and authority cutover. Neither gate is resolved by documenting required questions or by PR #103's local implementation.

## 16. Rollback and fail-closed availability

Before any Supabase Claim authority cutover, the gateway route and Supabase Claim provider remain disabled by default. Missing/invalid feature flag, authority manifest, environment binding, Admin authority, DB credential/TLS path, HMAC key ring, role/grant version, migration version, or pool readiness keeps the feature disabled.

After Supabase Claim becomes authoritative:

- gateway/Firebase Admin/HMAC/database/pool failure makes Claim reads and commands unavailable;
- the UI may show a generic unavailable state and preserve the user's unsent local form according to a later privacy-safe UI decision, but it cannot write elsewhere;
- retries use the same Supabase idempotency key and repeat full current Firebase/provider validation;
- ambiguous commit is reconciled against Supabase idempotency/domain state before a result is returned;
- Firebase Claim callable writes, Firestore Claim writes, Firebase Claim reads, and Firebase Claim notifications remain backend-disabled, not merely hidden in the UI;
- no configuration flip silently resumes Firebase writes, no Production dual write occurs, and no `service_role` bypass is used; and
- recovery restores the approved gateway path, reconciles incomplete/ambiguous operations, proves pool/context cleanliness, and then re-enables through an explicit authority/feature change.

An actual post-cutover authority rollback requires the freeze, reconciliation, reverse-delta, and checkpoint procedure that `MIG-002` must decide plus explicit approval. This document does not define that data-authority rollback and does not treat Firebase as a hot standby.

## 17. Exact blockers before activation

The trusted gateway and Claim feature remain blocked until all applicable items are implemented, approved, and evidenced:

1. `RES-001` is resolved for the hosted gateway/database region, topology, network, recovery, secret, and operational boundary.
2. `MIG-002` is resolved for isolated environments, project/secret references, promotion, provider-link/data reconciliation, cutover, rollback, and authority manifests.
3. A gateway host/transport is selected with TLS, CORS/origin/CSRF-as-applicable, abuse/rate/size limits, bounded timeouts, concurrency/backpressure, monitoring, incident, and break-glass controls.
4. The real signed-token/current-user matrix passes in approved non-Production, including Firebase/Admin and signing-key rotation/outage behavior.
5. Firebase Admin authority uses approved workload identity or injected custody and no secret-bearing artifact/log path.
6. An environment-specific gateway login and exact non-inheriting transaction-local membership path to `mujahiz_claim_runtime` are implemented and catalog-tested; the runtime role stays `NOLOGIN`.
7. A narrow provider-link/profile resolver and separate provider reconciler exist with exact least-privilege owners, collision/quarantine behavior, shared principal locking, and no email inference.
8. The local superuser/`postgres` definer ownership is replaced or equivalently narrowed to dedicated command-owner roles with exact privileges and independent review.
9. The local-only environment/policy/HMAC namespace is replaced by server-fixed environment-specific bindings without request selection.
10. A real driver/pool/pooler is selected and every isolation case in section 9 passes on the exact deployed configuration; statement pooling and transparent transaction retry remain prohibited.
11. HMAC custody, CSPRNG generation, active/retiring key-ring lookup, zero logging, planned/emergency rotation, startup failure, and cross-environment separation are implemented and rehearsed. Blind replacement of PR #103's single `local_v1` key is prohibited.
12. Safe error mapping, telemetry redaction, secret/PII scanning, alerting, and log retention/access are reviewed; raw Firebase/driver/database errors are eliminated.
13. The authority manifest and feature flags prove fail-closed disablement and no Firebase Claim read/write/notification fallback.
14. The complete SEC-001 client surface is implemented and reviewed: default-deny grants, forced RLS, field-minimized claimant/controller/reviewer projections, direct-mutation denial, and negative/oracle tests.
15. The remaining five Claim commands, reviewer/role-backed access/security inputs, final-Owner protections where applicable, ownership decision path, expiry, audit, REL operations, event consumer, and MSG-003 notification materializer required by the smallest shippable Claim vertical slice are implemented. PR #103 submit alone is not a shippable Claim feature.
16. Provider-link/role/access bootstrap and at least two usable Owners are established through approved non-Production then Production governance before privileged review/decision activation.
17. Required audit action registry, retention/access/enforcement, idempotency/event lease/retry/dead-letter/reconciliation operations, privacy/retention rules, backups, and incident runbooks are approved and tested.
18. `FILE-001` is resolved before any managed-file evidence; until then only the already approved bounded non-file Claim evidence may exist.
19. Complete signed-token, pool, HMAC rotation, spoofing, race/replay, atomicity, outage, rollback/disable, load, and observability validation passes with independent security review.
20. A new explicit Owner approval authorizes hosted staging/Production promotion and later feature activation. No approval in this document authorizes deployment or activation.

## 18. Readiness conclusion and exact stop point

The locally proved architecture can become a trusted gateway only through a server-mediated, current-Firebase, provider-neutral, transaction-scoped path. The conceptual database identity is resolved: an environment-specific least-privilege login assumes the existing `NOLOGIN` runtime role only inside one explicit transaction. The HMAC boundary is also resolved conceptually: a dedicated environment key ring is injected transaction-locally with replay-safe active/retiring rotation and zero logging. Hosting, environment, driver/pool/pooler, secret mechanism, migration/cutover, and Production activation remain intentionally unresolved and gated.

Exact stop point: this one documentation file, committed and pushed on the requested branch, one Draft PR, and no merge. Stop before SQL/application/config/test changes, Docker, Firebase or hosted Supabase access, secrets, Production/TEST data, role/grant creation, migration, deployment, gate resolution, Ready-for-review status, or activation.

## 19. References

- [Target hybrid architecture](01_TARGET_HYBRID_ARCHITECTURE.md)
- [ID-001 identity authority and privileged actor contract](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [SEC-001 Claim-first RLS and trusted authorization security contract](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [PR #98 Firebase-to-PostgreSQL request-scoped Auth bridge POC](43_FIREBASE_SUPABASE_REQUEST_SCOPED_AUTH_BRIDGE_POC.md)
- [PR #101 Claim runtime identity-context foundation evidence](45_CLAIM_RUNTIME_IDENTITY_CONTEXT_FOUNDATION_EVIDENCE.md)
- [Claim-v1 trusted-command atomicity and locking contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [PR #103 Claim submit trusted-command implementation evidence](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [Current verified baseline](../ai-context/01_CURRENT_BASELINE.md)
- [Architecture and environments](../ai-context/02_ARCHITECTURE_AND_ENVIRONMENTS.md)
- [Security and Production guardrails](../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md)
- [Testing and definition of done](../ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md)
