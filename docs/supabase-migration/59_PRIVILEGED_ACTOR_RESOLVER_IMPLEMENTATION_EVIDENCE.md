# Relational privileged-actor resolver implementation evidence

Status: **Implemented and validated for bounded LOCAL Claim-v1 use only**

Date: 2026-08-11

Primary task profile: `AUTH`

Repository: `mamounabdullah95-lab/Mujahiz.IQ`

Branch: `codex/privileged-actor-resolver`

Existing Draft PR: #116

Verified starting `origin/main`: `d606d4fca8a90c9ffe3444982ead48757245aeec`

Reviewed readiness head: `5ec4075d44e4f9dffa54060a9100aa66e2240fc6`

## 1. Owner decision and fixed compatibility binding

The first PR #116 revision correctly stopped before SQL because no approved
policy-version tuple existed. On 11 August 2026, the Product/Security/Data Owner
approved document 58 Option A, resolving that one blocker for this bounded local
resolver.

The existing Claim transaction context remains exactly
`sec-001-claim-v1`. It maps in this versioned, server-owned routine to exactly:

| Authority namespace | Exact supported runtime value |
|---|---|
| Provider state | `firebase-provider-state-v1` |
| Platform-role authorization | `platform-role-policy-v1` |
| Platform-access authorization | `platform-access-policy-v1` |
| Security policy | `platform-admin-security-v1` |
| Required coverage | `platform-admin-coverage-v1` |
| Evidence minimization | `platform-admin-minimization-v1` |

Equality is exact. There is no prefix, suffix, range, lexical, latest-row,
record-version, creation-time, fallback, synthetic-fixture, or caller-selected
version behavior. Role and access versions are intentionally distinct.
`provider_state_version IS NULL` is unsupported. V1 has no runtime registry; any
future binding change requires a separately approved successor or update.

## 2. API and classification

The migration adds only:

```text
claim_security.current_privileged_actor_v1()
  -> (decision text, role_code text)
```

The function has no arguments and returns exactly one row. `decision` is exactly
`eligible`, `denied`, or `unknown`. `role_code` is `owner` or `admin` only when
one current exact supported role is conclusive; it is `NULL` otherwise. No reason,
profile UUID, provider subject, Firebase UID, source row ID, reference, PII, raw
state, or arbitrary JSON is returned.

Classification precedence is fixed:

1. Any missing, ambiguous, contradictory, unsupported, or
   integrity-indeterminate required state produces `unknown`.
2. Otherwise, a conclusive supported blocker produces `denied`.
3. Only an exact all-positive result produces `eligible`.

Thus ambiguity takes precedence over a conclusive blocker. Only `eligible` is
authorization-positive; `denied` and `unknown` are externally non-authorizing.

For the exact supported security tuple, `clear + complete_clear` is positive;
`deny + explicit_deny|security_hold|identity_quarantine` is denied; and
`unknown + reconciliation_required` is unknown. An additional current
unsupported security tuple is contradictory and therefore unknown.

## 3. Exact relational predicate

For the principal returned only by
`claim_security.current_claim_user_profile_id()`, eligibility requires all of:

1. Valid current transaction-local Claim-v1 context.
2. One exact profile with active Buyer context and verified provider-state mirror.
3. One exact same-profile linked, primary, active, verified Firebase relational
   link with `firebase-provider-state-v1`.
4. Exactly one effective current active Owner/Admin role with
   `platform-role-policy-v1`.
5. Exactly one current active `platform_administration` access grant bound to the
   exact role assignment and role code with `platform-access-policy-v1`.
6. Exactly one current active assessment under the exact approved
   security/coverage/minimization tuple with `clear + complete_clear`.
7. No missing, ambiguous, contradictory, unsupported, or integrity-indeterminate
   required authority state.

Role, access, and security currentness use one captured trusted timestamp and
half-open intervals: `valid_from <= t AND (valid_until IS NULL OR t < valid_until)`.
The function captures `pg_catalog.clock_timestamp()` exactly once and is
`VOLATILE`. It accepts no time, profile, role, target, policy, or version.

Legacy role/account/organization/email fields, provider subject, Firebase UID
alone, role alone, access alone, `security_eligibility_reference`, Supplier
ownership, and `service_role` never authorize. No arbitrary-profile helper was
added; a future candidate-reviewer resolver is a separate task.

## 4. Definer, ACL, and read-only boundary

Direct table reads remain revoked from `mujahiz_claim_runtime`, so the one narrow
resolver is `SECURITY DEFINER`. Its local owner is explicitly `postgres`, its
`search_path` is fixed to `pg_catalog`, and every application object is
schema-qualified. It has no dynamic SQL, caller-controlled identifier,
polymorphic input, temporary-object dependency, or unqualified application lookup.

Execute is explicitly revoked from `PUBLIC`, `anon`, `authenticated`,
`service_role`, and `mujahiz_claim_runtime`, then granted only to
`mujahiz_claim_runtime`. The runtime receives no source-table privilege.

The resolver performs no insert, update, delete, audit/event write, Claim or
authority mutation, notification, cache, or materialization. Each call re-reads
current relational facts. Its result is an observation, not a reservation,
authorization token, or durable privilege lease. A future trusted mutation must
still take its approved locks, re-read authority-critical facts in its own
transaction, and fail closed if authority changed.

## 5. Focused and full validation

Focused pgTAP was run first in disposable local PostgreSQL:

```text
privileged_actor_resolver.sql: 112 assertions passed, 0 failed
```

It proves function metadata, exact two-field API, volatility, trusted time,
definer/search-path/owner/ACL boundaries, absence of table grants and new schema
objects, context failures, profile/provider/role/access/security classifications,
every exact version component, synthetic-label rejection, role/access namespace
separation, half-open time behavior, combination failures, structural ambiguity,
taxonomy precedence, sensitive-output minimization, and read-only execution.

The reused-backend harness passed:

```text
scripts/test-privileged-resolver-context.ps1: passed
```

On one disposable PostgreSQL backend it proves eligible principal A followed by
commit cleanup, eligible principal B followed by rollback cleanup, no principal
survival, no cross-principal reuse, and no decision caching after a synthetic
authority fact changes and is restored. This is deliberately not driver, pool, or
pooler evidence. The container exposes no host port and is removed in `finally`.

The complete repository validator passed:

```text
Local SQL validation passed: 23 migrations applied; 23 test files run;
1570 assertions passed, 0 failed; 63.3s elapsed.
```

Additional scans verified exact migration/test counts, one trusted clock capture,
exact runtime policy strings, no synthetic runtime labels, explicit owner/definer/
fixed-search-path ACLs, no runtime table grants or `service_role` exposure, no
dynamic SQL, no write statement, no new table/view/RLS/mutation policy/trigger,
no sensitive output field, disposable-container cleanup, and `git diff --check`.

Firebase suites and submit/withdraw concurrency harnesses were not rerun because
this slice changes neither Firebase nor those commands' direct dependencies or
privileges.

## 6. Adversarial review and fixes

The required 26-point red-team pass found no remaining path for
arbitrary-principal, caller-time, caller-policy, wildcard/synthetic/null-version,
role-only/access-only/security-only, expired-row, ignored-unsupported-tuple, or
ambiguity-precedence authorization. It also found no provider-subject, PII, or
reference leakage; API/`service_role` execute; direct runtime table grant;
search-path/dynamic-SQL/definer escalation; commit/rollback context leak; stale
decision cache; target-Supplier or Reviewer logic; or resolver write.

Validation surfaced and fixed three bounded implementation/test issues before the
final pass:

- an exact unlinked provider row was initially double-classified as ambiguous
  because the schema necessarily clears `is_primary`; non-primary ambiguity now
  applies only to linked state;
- a mismatched-assignment fixture used per-statement timestamps and could overlap
  by microseconds; it now uses one transaction timestamp for the shared boundary;
  and
- the harness variable `current_role` collided with PostgreSQL's `CURRENT_ROLE`
  keyword; it was renamed to `resolved_role_code`.

The affected focused tests and complete validation passed after the fixes.

## 7. Exact resulting state

- 23 tracked migrations.
- 23 pgTAP files.
- 24 physical PostgreSQL tables.
- 80 logical concepts.
- 37 Core Phase 1 concepts: 22 implemented and 15 unimplemented.
- Exactly one Claim RLS policy.
- Zero Claim mutation RLS policies.
- Exactly two of six Claim business mutations implemented:
  `supplier_claim.submit` and `supplier_claim.withdraw`.
- `claim_security.current_privileged_actor_v1()` implemented locally.
- Target-Supplier conflict resolver absent.
- Reviewer private-read substrate absent.
- `supplier_claim.assign_reviewer` absent.

The function adds no table/concept and therefore does not change the catalog or
Core implementation counts.

## 8. Gates, residual risk, and Production impact

The seven Open gates remain exactly:

- `ORG-001`
- `ORG-002`
- `MSG-002`
- `FILE-001`
- `BILL-001`
- `RES-001`
- `MIG-002`

No gate is created or closed. In particular, this local resolver does not close
`RES-001` or `MIG-002`.

Residual hosted/release work includes Firebase signed-token/current-account
verification, a trusted gateway/login and real driver/pool isolation proof,
dedicated non-login/non-superuser/non-owner/non-`BYPASSRLS` function ownership
with exact column rights, environment-specific approved bindings and authority
manifests, real authority provisioning/reconciliation, target-Supplier conflict
coverage, Reviewer read/assignment delivery, and explicit hosted/Production
approval. The local `postgres` owner is not hosted least privilege.

Production and data impact is none. Work used disposable local PostgreSQL and
synthetic rows only. It made no Firebase, hosted Supabase, Production/TEST-data,
seed, backfill, migration, deployment, DNS, billing, Auth/config, Firestore,
hosted RLS/grant, credential, or public-port change. All disposable containers
were cleaned up.

Shared baseline, schema-design, and decision-register synchronization remains a
separate post-merge task.
