# Relational privileged-actor resolver implementation readiness

Status: **Blocked before SQL by one unresolved Product/Security/Data policy-version binding decision; documentation-only readiness result**

Date: 2026-08-11

Primary task profile: `AUTH`

Repository: `mamounabdullah95-lab/Mujahiz.IQ`

Verified starting `origin/main`: `d606d4fca8a90c9ffe3444982ead48757245aeec`, the merge of PR #115

Branch: `codex/privileged-actor-resolver`

## 1. Readiness verdict and hard boundary

The relational privileged-actor predicate is structurally ready but **not policy-version ready**.

Current SQL can represent the required profile, Firebase provider-link mirror, platform role, role-backed administration access, and security assessment facts. The Claim context also fixes local purpose, environment, and Claim policy to `claim_v1`, `local`, and `sec-001-claim-v1`. However, no Owner-approved contract or merged SQL defines the supported runtime values or compatibility mapping for:

- `internal.identity_provider_links.provider_state_version`;
- `public.platform_role_assignments.authorization_policy_version`;
- `public.access_grants.authorization_policy_version`;
- `internal.security_eligibility_assessments.security_policy_version`;
- `internal.security_eligibility_assessments.required_coverage_version`; and
- `internal.security_eligibility_assessments.evidence_minimization_version`.

The approved contracts require unsupported policy or coverage versions to fail closed. They also prohibit caller-selected policy and silently equating unrelated version namespaces. A resolver cannot return `eligible` until the exact compatibility tuple is approved.

This task therefore stops before resolver SQL. It adds no migration, pgTAP file, helper, runtime grant, table, policy, view, trigger, row, seed, backfill, migration execution, hosted resource, Firebase change, or Production action.

## 2. Starting-point and ancestry verification

The task fetched `origin/main` before analysis. The fetched SHA remained exactly:

```text
d606d4fca8a90c9ffe3444982ead48757245aeec
```

The following implementation and merge commits are ancestors of that SHA:

| Pull request | Relevant head | Merge commit | Ancestry result |
|---|---|---|---|
| #113 | `270df65b8848ed1eab2ddab5a475085b048a1ceb` | `3ef4d0230d9b705fda942894a7cc6448ef5ef8e7` | Present |
| #114 | `7c353f7` | `d78d491877573f55012e7eac29d7b5ed41772be9` | Present |
| #115 | `1d561a1889d57abecda5dc89723460bfa9a15134` | `d606d4fca8a90c9ffe3444982ead48757245aeec` | Present |

No newer `origin/main` delta required reconciliation.

## 3. Authoritative evidence reviewed

The readiness audit used:

- the current baseline, security/Production guardrails, `AUTH` task profile, and testing/definition-of-done guidance;
- the authoritative PostgreSQL schema design and schema decision register;
- documents 33, 34, 35, 42, 46, 51, 52, 55, 56, and 57;
- the provider-neutral identity, platform-role, access-grant, security-assessment, Claim transaction-context, and Claimant self-read migrations and focused pgTAP files; and
- the submit/withdraw trusted-command migrations only for the established narrow `SECURITY DEFINER`, fixed-search-path, ACL, and safe-output conventions.

Document 55's Owner-approved contract remains authoritative. Documents 56/57 and current SQL supersede its historical statements that the access and security tables were absent.

## 4. Exact relational predicate

For the current transaction-local Claim principal `p` and one internally captured trusted PostgreSQL timestamp `t`, `eligible` requires every conjunct below:

1. `claim_security.current_claim_user_profile_id()` returns exactly one current transaction-bound provider-neutral principal under purpose `claim_v1`, environment `local`, and Claim policy `sec-001-claim-v1`.
2. Exactly one `public.user_profiles` row exists for `p`.
3. The profile has `account_status = 'active'`.
4. The profile has `account_context = 'buyer'` for the Claim Reviewer path.
5. The profile has `verification_mirror_status = 'verified'`.
6. Exactly one qualifying `internal.identity_provider_links` row belongs to the same profile and has `provider_code = 'firebase'`, `link_status = 'linked'`, `is_primary = true`, `identity_status = 'active'`, and `verification_status = 'verified'`, under the supported provider-state version rule.
7. Exactly one current `public.platform_role_assignments` row belongs to the profile, has `assignment_status = 'active'`, is inside its half-open interval, has `role_code in ('owner', 'admin')`, and uses the supported role-policy version.
8. Exactly one current `public.access_grants` row has `access_purpose = 'platform_administration'`, `access_status = 'active'`, is inside its half-open interval, belongs to the same profile, binds the exact current role-assignment ID and role code, and uses the supported access-policy version.
9. Exactly one current `internal.security_eligibility_assessments` row has `assessment_scope = 'platform_administration'`, `assessment_status = 'active'`, is inside its half-open interval, uses the supported security/coverage/minimization tuple, and has `assessment_result = 'clear'` plus `condition_type = 'complete_clear'`.
10. No missing, duplicate, ambiguous, contradictory, unsupported, or unreadable required state exists.

All temporal predicates use the same `t` and exact half-open semantics:

```text
valid_from <= t
AND (valid_until IS NULL OR t < valid_until)
```

The resolver must independently treat a finite active row at or after `valid_until` as non-current. It does not wait for an expiry job or lifecycle terminalization.

The predicate never reads authority from `legacy_role`, `legacy_account_type`, `legacy_organization`, normalized email, email domain, Firebase UID alone, provider subject alone, a role row alone, an access row alone, `security_eligibility_reference`, Supplier ownership, Firestore text, or `service_role`.

## 5. Exact version-binding gap

### 5.1 What current SQL proves

| Input | Current structural rule | What remains undefined |
|---|---|---|
| Claim context | Exact local value `sec-001-claim-v1` | How this Claim policy selects compatible provider/role/access/security versions |
| Provider link | `provider_state_version` is nullable and, when present, only length-bounded | Required supported value, whether null is ever supported, and exact compatibility with the Claim policy |
| Platform role | `authorization_policy_version` is required but only length-bounded | Supported value and compatibility with Claim/access policy |
| Access grant | `authorization_policy_version` is required but only length-bounded | Supported value and whether it must equal or map to the role version |
| Security assessment | Security, coverage, and minimization versions are required but only length-bounded | Supported tuple and compatibility with the Claim policy |
| Security uniqueness | The exclusion key includes security-policy and coverage versions | Which tuple is current, and how simultaneous active rows under different tuples are classified |

The access/security foundation tests use `platform_roles_v1`, `access_v1`, `security_v1`, `coverage_v1`, and `min_v1`. Those are synthetic fixture strings proving table shape. Documents 56/57 explicitly describe the tests as synthetic. They are not approved runtime policy values.

The gateway readiness contract calls `local`, `local_v1`, and `sec-001-claim-v1` local evidence only and requires later environment-specific bindings. It does not equate `sec-001-claim-v1` with any role, access, security, coverage, minimization, or provider-state version.

### 5.2 Why implementation without the decision is unsafe

Any resolver SQL written now would have to choose one of these unauthorized behaviors:

- accept every nonempty version, contrary to the explicit unsupported-version fail-closed rule;
- copy synthetic pgTAP labels into runtime authority;
- equate unrelated version namespaces merely because they end in `v1`;
- treat `sec-001-claim-v1` as every table's version without approval;
- accept caller-supplied versions or a caller-selected weaker policy;
- ignore version fields while claiming policy-complete eligibility; or
- pick one active security row among different version tuples by precedence not present in the approved contract.

Each choice could authorize a stale, incomplete, incompatible, or attacker-influenced authority row. Returning `unknown` for every row would fail closed but would not implement the requested positive resolver and would misrepresent the task as complete.

## 6. Bounded decision options

### Option A — fixed Claim-v1 compatibility tuple

Approve one exact server-owned local compatibility tuple for this resolver:

- existing Claim context policy `sec-001-claim-v1`;
- one exact supported provider-state version and explicit null handling;
- one exact supported role authorization-policy version;
- one exact supported access authorization-policy version;
- one exact supported security-policy version;
- one exact supported required-coverage version; and
- one exact supported evidence-minimization version.

Also approve that eligibility requires the exact tuple, that role/access subject and assignment binding remains exact, and that any additional current row under an unsupported tuple is `unknown`/reconciliation-required rather than ignored.

**Recommendation:** approve Option A. It is the minimum change, keeps the resolver caller-independent, requires no registry table, and is easy to prove with focused negative tests. The exact values must come from the Product/Security/Data Owner; this document does not propose or infer them.

### Option B — code-owned compatibility map

Approve a versioned, code-owned mapping from the fixed Claim context policy to an exact provider/role/access/security/coverage/minimization tuple. The caller still supplies no version. Unknown mapping, duplicate mapping, or unmatched row returns `unknown`.

This supports future policy transitions more explicitly but expands the initial implementation and test surface. A database table or caller-editable registry is not justified for the first resolver.

### Rejected shortcuts

- Do not treat any nonempty value as supported.
- Do not infer authority from the synthetic fixture labels.
- Do not require all unrelated columns to equal `sec-001-claim-v1` without approval.
- Do not accept a version, policy, role list, profile, or timestamp from the caller.
- Do not give version precedence to lexical order, creation time, record version, or role rank.

## 7. Exact Owner decision required

The Product/Security/Data Owner must approve one statement equivalent to:

> For local Claim-v1 privileged relational eligibility, the fixed context policy `sec-001-claim-v1` is compatible with exactly the approved provider-state, role-authorization, access-authorization, security-policy, required-coverage, and evidence-minimization values recorded in the decision. The resolver accepts no caller-selected version. Missing, null where unsupported, mismatched, additional-current, contradictory, or otherwise unsupported version state returns `unknown` and never authorizes. A supported current explicit deny/hold/quarantine returns `denied`; a supported reconciliation-required result returns `unknown`; only the exact supported complete-clear tuple can contribute to `eligible`.

The approval must provide the six exact version values and explicitly decide whether the role and access authorization versions are identical values or distinct mapped values. It must also confirm that an active unsupported security tuple alongside a supported tuple is contradictory/`unknown`, not ignored and not precedence-resolved.

No other Product, Security, Data, schema, or Open-gate decision is required for the bounded local resolver.

## 8. Resolver design ready after approval

### 8.1 API and output

Implement one versioned non-public routine:

```text
claim_security.current_privileged_actor_v1()
  -> (decision, role_code)
```

The function has no arguments. `decision` is exactly `eligible|denied|unknown`. `role_code` is `owner|admin` only when the current role is exact, supported, and conclusive; otherwise it is null. No detailed reason is returned in v1 because no reason taxonomy is required for authorization and omitting it minimizes leakage.

The function returns no profile UUID, provider-link ID, provider subject, Firebase UID, access/security/audit/evidence reference, correlation value, PII, arbitrary JSON, SQL error, or raw source reason.

Only `eligible` is authorization-positive. `denied` and `unknown` are externally indistinguishable non-authorizing results.

### 8.2 Decision classification

- `eligible`: every conjunct in section 4 is exact, current, supported, compatible, and complete.
- `denied`: a conclusive supported current blocker exists, including suspended/deactivated profile, non-buyer context, unverified profile/link state, unlinked/disabled link, revoked/expired/superseded current authority lifecycle, or supported current security `explicit_deny|security_hold|identity_quarantine`.
- `unknown`: context/principal/row/coverage/version/currentness/integrity is missing, malformed, ambiguous, contradictory, unsupported, or unreadable, including reconciliation-required security state.

Where one conclusive deny and one ambiguity coexist, the resolver remains non-authorizing. The implementation test plan must lock the internal classification precedence to the Owner-approved conclusive-outcome semantics without exposing it to clients.

### 8.3 Trusted time and function volatility

Capture `pg_catalog.clock_timestamp()` once into a local variable at the start of the relational evaluation. Use that single trusted value for role, access, and security half-open comparisons. The runtime function accepts no time and should be declared `VOLATILE` to match `clock_timestamp()` semantics even though it performs no writes.

### 8.4 Definer and ACL model

One narrow `SECURITY DEFINER` routine is required because the runtime role must not receive raw reads on the protected bases. For this local-only slice:

- owner remains local `postgres` only;
- `search_path` is fixed to `pg_catalog`;
- every application relation, type, and helper is schema-qualified;
- there is no dynamic SQL, caller-controlled identifier, polymorphic input, temporary-object dependency, or unsafe schema lookup;
- execute is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`;
- only `mujahiz_claim_runtime` receives execute on the exact no-argument v1 entry point; and
- the runtime receives no new table, sequence, schema, or other function privilege.

Local `postgres` definer ownership is not hosted release readiness. Replacing it with a dedicated non-login, non-superuser, non-owner, non-`BYPASSRLS` command/helper owner with exact column rights remains a hosted gate.

### 8.5 Private helper decision

Do not add an arbitrary-profile helper in this slice. The current-principal resolver can query the protected bases directly inside its one narrow definer boundary. A future candidate-reviewer use case does not justify exposing or prebuilding arbitrary-profile lookup now.

### 8.6 Read-only and TOCTOU boundary

The resolver performs no insert, update, delete, audit, event, Claim mutation, role/access/security mutation, notification, cache write, or materialization. Every call re-reads current relational facts.

Its result is a current decision, not an authorization reservation or token. A later trusted mutation must acquire its approved principal/Supplier/domain locks, re-read all authorization-critical facts inside the mutation transaction, and fail closed if authority changed. No later command may trust a cached earlier resolver result.

## 9. Planned implementation slice after approval

After the exact Owner decision is recorded, one separate implementation change should add only:

1. one tracked migration semantically named `privileged_actor_resolver` containing the single runtime-facing function and exact ACLs; and
2. one focused `privileged_actor_resolver.sql` pgTAP file.

No table, view, RLS policy, mutation policy, trigger, persistent row, private arbitrary-profile helper, target-Supplier conflict logic, Reviewer projection, assignment command, gateway, or application code belongs in that slice.

Expected structural state after that later implementation, absent unrelated `main` changes:

- 23 migrations;
- 23 pgTAP files;
- 24 physical tables;
- 80 logical concepts;
- 37 Core Phase 1 concepts, 22 implemented and 15 unimplemented;
- exactly one Claim RLS policy and zero Claim mutation policies; and
- two of six Claim business mutations implemented.

A function does not increment the table/concept implementation count.

## 10. Complete planned validation

### 10.1 Function and ACL

Prove exact schema/name/signature/output, `SECURITY DEFINER`, fixed `pg_catalog` search path, local owner, runtime-only execute, API/`service_role` denial, no protected-table grants, no dynamic SQL, no new table/view/trigger/policy, and no mutation statement.

### 10.2 Context and principal

Prove missing/null/malformed context, wrong purpose, wrong environment, wrong Claim policy, prior-commit reuse, prior-rollback reuse, and caller substitution are non-authorizing. Prove a correct current transaction resolves only its bound principal through the existing establish/current helpers.

### 10.3 Profile and identity mirror

Cover active Buyer verified positive state; missing, suspended, deactivated, Supplier/unknown context, unverified/unknown mirror; exact linked primary Firebase positive state; wrong provider, non-primary, unlinked, disabled/unknown identity, unverified/unknown verification, different-profile link, and structural ambiguity. Prove legacy role/account/organization/email text cannot rescue eligibility and provider subject never appears in output.

### 10.4 Role and access

Cover current Owner and Admin; missing, future, expired-by-time, revoked, expired, superseded, other-subject, ambiguous, unsupported-version, and mismatched-version roles. Cover exact role-backed Owner/Admin access; missing, future, expired-by-time, revoked, expired, superseded, other subject/assignment, mismatched role, unsupported version, inactive referenced role, and exact `t = valid_until` denial.

### 10.5 Security

Cover indefinite and finite in-time complete clear; explicit deny, hold, and quarantine as conclusive denial; reconciliation-required as unknown; missing, future, finite-active-after-horizon, resolved, expired, superseded, unsupported policy, unsupported coverage, unsupported minimization, incomplete coverage, additional active unsupported tuple, and exact `t = valid_until` non-current behavior.

### 10.6 Combinations and taxonomy

Prove role alone, role plus access, role plus security, access plus security without current role, all facts without context, all facts without Firebase mirror, and all facts without profile verification are never eligible. Prove Owner and Admin may both be globally eligible while the resolver decides no command-specific Owner-only permission. Verify representative `eligible`, `denied`, and `unknown` results and null/non-null role output.

### 10.7 Transaction-context harness

Add `scripts/test-privileged-resolver-context.ps1` only if the implementation task proceeds. On one reused disposable local PostgreSQL backend it should prove commit and rollback cleanup, a second principal replacing the first only in a new valid transaction, no context survival, and state re-read after one synthetic authority fact changes. It is not real driver/pool/pooler evidence and exposes no host port.

### 10.8 Full validation and red-team pass

Run the focused pgTAP first, then the complete local SQL validator and the context harness. Record exact assertion totals rather than estimating them. Also run ACL, ownership, definer, search-path, dynamic-SQL, direct-table-grant, `service_role`, sensitive-output, no-write, no-new-RLS, no-new-table, exact-count, stale-container, and `git diff --check` scans.

The adversarial review must attempt caller substitution, caller-controlled time/version, legacy fallback, role-only/missing-access/missing-security authorization, expired-row authorization, provider/evidence leakage, API/`service_role` execution, table-grant expansion, search-path/dynamic-SQL/definer escalation, helper exposure, context leakage, stale caching, target-Supplier logic, and Reviewer authorization. Defects found before merge belong in the same implementation PR.

## 11. Current verified counts and unchanged boundary

Static catalog-source verification at the starting SHA found:

- 22 tracked migrations;
- 22 pgTAP files;
- 24 `create table` statements / physical tables;
- 80 logical concepts;
- 37 Core Phase 1 concepts, 22 implemented and 15 unimplemented;
- exactly one Claim RLS policy;
- zero Claim mutation policies;
- no created privileged-actor resolver routine;
- `supplier_claim.submit` and `supplier_claim.withdraw` remain the only two of six implemented Claim business mutations; and
- access/security foundations remain empty, local-only, fully revoked, and non-authoritative.

No SQL validator or resolver/context harness was run because the required policy decision blocked SQL creation before an implementation test target existed.

## 12. Open gates, residual release gates, and impact

The seven Open gates remain exactly:

- `ORG-001`
- `ORG-002`
- `MSG-002`
- `FILE-001`
- `BILL-001`
- `RES-001`
- `MIG-002`

This readiness finding creates or closes no gate. The later local relational resolver would not close `RES-001` or `MIG-002` and would not prove Firebase authentication, signed-token validation, a gateway login/role-assumption path, HMAC rotation, real driver/pool isolation, dedicated hosted function ownership, authority-manifest reconciliation, real role/access/security population, target-Supplier conflict coverage, Reviewer reads/assignment, hosted Supabase, or Production readiness.

All investigation was repository-read-only. The only repository change is this documentation file. No Firebase, hosted Supabase, Production/TEST data, real identity/provider/role/access/security row, migration execution, seed, backfill, deployment, DNS, billing, Auth configuration, or Firestore change occurred.

## 13. Exact stop point

Stop after this bounded readiness document is committed and pushed on `codex/privileged-actor-resolver` and one Draft PR is open. Do not add resolver SQL or pgTAP until the Product/Security/Data Owner approves the exact version compatibility tuple. Do not start target-Supplier conflict resolution, Reviewer private-read substrate, `supplier_claim.assign_reviewer`, or any hosted/Production work.
