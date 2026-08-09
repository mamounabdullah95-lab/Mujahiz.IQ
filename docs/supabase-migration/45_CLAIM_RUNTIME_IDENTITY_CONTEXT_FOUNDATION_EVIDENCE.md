# Claim runtime identity-context foundation implementation evidence

Status: **Local-only security foundation implemented and validated; no RLS, Claim command, Auth bridge runtime, hosted capability, data, or Production activation**

Date: 2026-08-09

Starting `origin/main`: `1d1d916ce9a71a85ab8a11a38b23707468347c2e`, the merge of PR #97

Primary task profile: Authentication and Accounts

## 1. Result and boundary

The sixteenth tracked local migration implements the smallest database-side identity-context boundary authorized by the approved Claim-v1 SEC-001 architecture:

- one dedicated `mujahiz_claim_runtime` PostgreSQL role;
- one non-exposed `claim_security` helper schema;
- one transaction-local context setter that accepts only `public.user_profiles.id` as a UUID; and
- one fail-closed accessor that returns only the provider-neutral UUID when every required Claim-v1 binding is valid in the same database transaction.

The migration creates zero physical tables and zero Core Phase 1 concepts. It creates no RLS, policy, Claim projection, Claim command, reviewer command, application endpoint, Firebase gateway, provider-link resolver, role/access resolver, audit/event/idempotency writer, notification runtime, browser credential, hosted Supabase resource, or row.

## 2. SEC-001 object and grant mapping

| Object or privilege | Implemented boundary | SEC-001 requirement |
|---|---|---|
| `mujahiz_claim_runtime` | `NOLOGIN`, `NOINHERIT`, non-superuser, non-owner, non-`BYPASSRLS`, no database/role creation, no replication, no password, and no inherited authority | Dedicated least-privilege non-browser Claim runtime role; not `anon`, `authenticated`, `service_role`, a platform role, or a reusable browser identity |
| Supabase-managed membership | The local Supabase PostgreSQL image records `postgres` as a non-inheriting, non-`SET` administrative member of the new role; the runtime role inherits no role and no role can use it through that membership | Preserve the verified local platform convention without granting runtime capability or a gateway login path |
| `claim_security` | Separate schema outside local Data API exposure; runtime receives `USAGE` only and cannot create objects; `PUBLIC`, `anon`, `authenticated`, and `service_role` receive no schema privilege | Non-exposed helper boundary without granting the runtime role generic access to `internal.*` |
| `claim_security.establish_claim_runtime_context(uuid)` | `SECURITY INVOKER`, fixed `pg_catalog` search path, runtime-only `EXECUTE`, typed provider-neutral UUID input, and `set_config(..., true)` for every setting | Trusted server establishes only transaction-local, server-derived Claim principal context; no Firebase UID, provider subject, email, role, or target ID is accepted |
| `claim_security.current_claim_user_profile_id()` | `SECURITY INVOKER`, fixed `pg_catalog` search path, runtime-only `EXECUTE`, UUID-only result, explicit null/malformed/wrong-binding denial | One reviewed current-principal accessor for later RLS/trusted commands; no fallback identity and no provider-link enumeration |
| Base objects | Runtime role has no table, view, sequence, or public/internal routine authority; protected Claim, ownership, role, provider-link, audit, idempotency, and event tables remain ungranted | No direct unrestricted base-table privilege and no browser/Data API grant before later RLS/projection/trusted-command slices |
| Helper default privileges | Future functions created by the migration owner in `claim_security` do not inherit `PUBLIC` or API/runtime execution automatically | New helpers must remain opt-in and individually reviewed |

Both routines are invoker functions. No `SECURITY DEFINER` pattern was required or introduced.

## 3. Final local context contract

The project-scoped setting names are:

| Setting | Required local value | Purpose |
|---|---|---|
| `mujahiz.claim.user_profile_id` | Valid UUID supplied as the typed setter argument | Provider-neutral domain principal |
| `mujahiz.claim.purpose` | `claim_v1` | Prevent another database action class from reusing the assertion |
| `mujahiz.claim.environment` | `local` | Keep this implementation explicitly local-only; staging/Production requires a later reviewed migration and environment binding |
| `mujahiz.claim.policy_version` | `sec-001-claim-v1` | Reject a context produced for another authorization contract/version |
| `mujahiz.claim.transaction_id` | Current `pg_current_xact_id()` | Bind the assertion to the exact PostgreSQL transaction and deny reuse even if a caller mistakenly persisted custom settings at session scope |

Purpose, environment, and policy version are required by SEC-001 for the first Claim authorization boundary, so they are fixed by the setter rather than caller-selectable inputs. The transaction identifier is the minimum database-verifiable safeguard for transaction reuse.

Firebase UID, provider subject, provider-link ID, email, platform role, reviewer assignment, Supplier ownership, Claim ID, and target ID are not context keys. The trusted server remains responsible for Firebase token/current-user validation, exact active provider-link resolution, active profile resolution, and current provider observation before calling the setter. Provider observation evidence, request/correlation identity, real bridge transport, login-role membership, pool behavior, and environment configuration remain part of the later gateway/runtime slice because this local accessor neither needs nor has authority to validate or expose them.

## 4. Fail-closed and isolation proof

Focused pgTAP proves:

- the runtime role and helper schema/function attributes and grants;
- no runtime base-table/internal-schema authority;
- no new API-role Claim authority;
- exact five-setting vocabulary and absence of Firebase/provider/email identity settings;
- valid provider-neutral UUID context resolution;
- denial for missing or malformed principal, purpose, environment, policy version, or transaction binding;
- denial for wrong purpose, environment, policy version, or transaction identifier;
- principal-setting cleanup after commit and rollback;
- the same physical backend PID receives no principal in the next transaction; and
- no RLS, policy, Claim command, Claim row, physical table, or browser/API runtime was added.

The accessor explicitly checks null values before comparisons. This avoids PostgreSQL three-valued-logic behavior that could otherwise let a missing context field bypass a simple `<>` predicate.

## 5. Validation evidence

- Focused disposable PostgreSQL 17.6 pgTAP: **52/52 passed**.
- Complete repository SQL validator: **16 migrations applied; 16 pgTAP files; 1,005/1,005 assertions passed; 0 failed**.
- Physical PostgreSQL tables: **22**.
- Database roles introduced: **1** (`mujahiz_claim_runtime`).
- Schemas introduced: **1** (`claim_security`).
- Functions introduced: **2**.
- RLS policies introduced: **0**.
- Core Phase 1 concepts: **20 implemented / 16 deferred**.

The first complete-validator invocation encountered a disposable-container startup restart before any migration ran. The unchanged validator was retried after cleanup and passed fully; this was not a SQL or assertion failure.

## 6. Production impact, residual gates, and stop point

Production impact is **none**. No Firebase or hosted Supabase service was accessed; no real user, provider link, Claim, ownership, role, audit, event, idempotency, notification, TEST, or Production row was read or written; and no migration was applied outside disposable local PostgreSQL.

This foundation is not a usable Claim feature or gateway. A later separately approved slice must provide the real trusted server/login-role mechanism, signed-token validation, provider observation, selected driver/pool isolation proof, environment binding, RLS/projections, role/access/security eligibility, and trusted Claim commands. The seven Open gates remain unchanged.

Exact stop point: local identity-context migration, focused/full validation, evidence, commit/push, and Draft PR only. Stop before RLS, Claim commands, Auth bridge runtime, hosted Supabase, data movement, Production activation, Ready-for-review status, merge, or deployment.
