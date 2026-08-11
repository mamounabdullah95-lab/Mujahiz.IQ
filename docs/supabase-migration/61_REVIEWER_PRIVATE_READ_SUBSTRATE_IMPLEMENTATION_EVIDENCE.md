# Reviewer Private-Read Substrate — Implementation Evidence

## 1. Scope and starting point

This bounded LOCAL-only slice implements the Reviewer private-read substrate required before `supplier_claim.assign_reviewer`. It creates no Claim mutation, business table, hosted capability, seed, backfill, gateway, Firebase change, or Production action.

Work started from fetched `origin/main` at exactly:

```text
22826f5f60baf5892cd75a4e0331df1130c97535
```

That commit is the merge of PR #119. The following exact merge commits were verified as ancestors of the starting head:

| PR | Merge commit |
|---|---|
| #113 | `3ef4d0230d9b705fda942894a7cc6448ef5ef8e7` |
| #114 | `d78d491877573f55012e7eac29d7b5ed41772be9` |
| #115 | `d606d4fca8a90c9ffe3444982ead48757245aeec` |
| #116 | `ecf60e756ffba5f04a79fc71dcbcdf6c60bf7004` |
| #117 | `7f2eb39f8acca356635509de1060fac2e3dec689` |
| #118 | `3c66e52c011ec686c3a9b7d1dbe9db18a4800a07` |
| #119 | `22826f5f60baf5892cd75a4e0331df1130c97535` |

The verified pre-task state was 24 tracked migrations, 24 pgTAP files, 24 physical `public`/`internal` tables, 80 logical concepts, 37 Core Phase 1 concepts, 22 implemented and 15 unimplemented Core concepts, one Claim SELECT policy, zero Claim mutation policies, and exactly two of six Claim business mutations (`submit` and `withdraw`).

## 2. Readiness verdict

The approved contracts are complete enough for this bounded implementation.

- The existing current-principal relational predicate can be shared safely through one private arbitrary-profile evaluator; maintaining a second predicate copy is unnecessary.
- The arbitrary-profile evaluator is required for the claim-scoped candidate list.
- `claim_api` is the approved dedicated schema for fixed Claim projection RPCs.
- Separate Owner and assigned-reviewer projection roles are compatible with the approved PostgreSQL model.
- Two new audience-separated policies are sufficient. The claimant policy remains unchanged.
- The approved evidence contract permits only typed descriptors. Raw URLs remain hidden until a later FILE-policy slice.
- No material Product/Security/Data architecture decision remains open for local synthetic read proof.

## 3. Root security findings and corrections

Four scoped findings were corrected in this branch.

1. PR #118 ended by revoking all Claim-table privileges from `mujahiz_claim_runtime`. That unintentionally removed the eleven historical source-column grants required by the unchanged SECURITY INVOKER claimant projection. The new migration restores exactly those original eleven safe columns and no private Claim column.
2. The assigned-reviewer policy correctly hides rejected historical Claims, so reviewer detail cannot join a prior rejected Claim directly through that RLS principal. Broadening Reviewer RLS would create historical browsing. A private fixed-output prior-context helper now validates the same-claimant/same-Supplier rejected row and returns only the approved safe subset.
3. Moving `current_privileged_actor_v1()` from `postgres` ownership to the least-privilege Owner projection role removed `postgres`'s former implicit execute capability. The reused-backend harness caught the regression. An explicit `postgres` execute grant is now made by the new function owner after ownership transfer, preserving the pre-refactor administrative/runtime ACL without exposing the arbitrary-profile helper.
4. Adversarial review found that unexpected dependency/read errors in the new eligibility and evidence helpers could otherwise surface SQL detail. Those helpers now convert unexpected errors to `unknown`/NULL and NULL respectively. An unreadable-dependency pgTAP case proves the eligibility path returns `unknown` with no role result.

## 4. Eligibility core and current-resolver refactor

The migration adds:

```text
claim_security.privileged_actor_for_profile_v1(uuid)
  -> (decision text, role_code text)
```

It is relational only. It accepts no provider subject, email, role, policy/version, time, Supplier, Claim, or evidence input. It returns only the existing `eligible|denied|unknown` decision and a conclusive `owner|admin` role code. It authenticates no Firebase principal.

The helper owns the exact approved six-value compatibility tuple:

- `firebase-provider-state-v1`;
- `platform-role-policy-v1`;
- `platform-access-policy-v1`;
- `platform-admin-security-v1`;
- `platform-admin-coverage-v1`; and
- `platform-admin-minimization-v1`.

It is `VOLATILE SECURITY DEFINER`, captures `clock_timestamp()` exactly once, uses `search_path=pg_catalog`, and is owned by `mujahiz_claim_owner_projection`. `PUBLIC`, `anon`, `authenticated`, `service_role`, `mujahiz_claim_runtime`, and the Reviewer projection role cannot execute it.

`claim_security.current_privileged_actor_v1()` keeps its exact no-argument result contract, volatility, fixed search path, runtime ACL, and current-principal-only API. It now resolves the transaction-local principal once and delegates to the private evaluator. Normal eligible, denied, unknown, expiry, and unsupported-version outcomes have parity in pgTAP. The existing reused-backend context harness also passes.

## 5. Projection-role model

The migration adds:

- `mujahiz_claim_owner_projection`;
- `mujahiz_claim_reviewer_projection`.

Both are `NOLOGIN`, `NOINHERIT`, non-superuser, and non-`BYPASSRLS`. Neither owns a table, view, materialized view, or sequence. Neither has Claim mutation privileges or schema CREATE after migration completion.

PostgreSQL 17/Supabase role creation leaves the creating database administrator (`postgres`, grantor `supabase_admin`) with `ADMIN=true`, `INHERIT=false`, and `SET=false` membership for each new role. This is catalog administration only, not a role-assumption or execution path. No runtime, browser, API, or service role receives membership.

The Owner and Reviewer function owners receive only the source columns needed by their fixed routines. The runtime caller does not inherit those privileges and still cannot select Reviewer-private base columns.

## 6. Fixed APIs

### Owner assignment queue

```text
claim_api.owner_assignment_queue_v1(
  cursor_expires_at timestamptz?,
  cursor_claim_id uuid?,
  result_limit integer = 50
)
```

The result is exactly `claim_id`, `claim_version`, `supplier_profile_id`, safe Supplier names, `submitted_at`, `expires_at`, and literal `submitted`. It uses bounded limits from 1 through 100 and keyset order `(expires_at, claim_id)`. RLS requires a current eligible Owner, coherent wholly unassigned submitted state, trusted non-expiry, and clear target-Supplier conflict.

### Claim-scoped reviewer candidates

```text
claim_api.owner_reviewer_candidates_v1(
  p_claim_id uuid,
  cursor_reviewer_user_profile_id uuid?,
  result_limit integer = 50
)
```

The result is exactly `reviewer_user_profile_id`, `reviewer_display_name`, and `role_code`. Candidates are omitted unless the full relational predicate is `eligible`, role is `owner|admin`, candidate differs from assigner and claimant, and candidate conflict is `clear`. The list is advisory only. A future `assign_reviewer` must repeat the entire predicate after deterministic locks.

### Assigned-reviewer queue

```text
claim_api.reviewer_queue_v1(
  cursor_expires_at timestamptz?,
  cursor_claim_id uuid?,
  result_limit integer = 50
)
```

The result is exactly the approved Claim/Supplier queue metadata and assignment version/time. It uses bounded limits and `(expires_at, claim_id)` keyset order. Only the exact current assigned eligible Owner/Admin reviewer receives a coherent supported `under_review` row with clear conflict before expiry.

### Assigned-reviewer detail

```text
claim_api.reviewer_detail_v1(p_claim_id uuid)
```

The result is the fixed document-51 subset:

- approved Claim state, immutable reason, evidence version, and typed evidence descriptors;
- claimant-submitted `full_name`, nullable `organization`, and nullable `job_title` labels only;
- approved Supplier review summary plus `eligible|already_owned|unavailable`;
- validated safe prior Claim ID/status/result/decision time only.

The private evidence projection accepts only the five approved kinds: `company_domain_email`, `company_website`, `commercial_registration`, `authorization_letter`, and `other`. It rejects extra fields and malformed/oversized data. Raw reference URLs, paths, queries, credentials, and file identities are not returned. A syntactically acceptable public HTTPS reference yields only a normalized hostname and `reference_unavailable=true`; no fetch, preview, redirect, credential use, or signed URL occurs.

The private prior-context helper is `STABLE SECURITY DEFINER`, fixed-search-path, owned by the existing trusted `postgres` principal, and executable only by the isolated Reviewer projection role. It is not an exposed Reviewer routine or runtime oracle.

## 7. RLS and privilege result

`public.supplier_ownership_claims` remains RLS-enabled and FORCE RLS.

The unchanged claimant policy is:

```text
supplier_ownership_claims_claimant_self_select
```

Exactly two audience-specific permissive SELECT policies are added:

```text
supplier_ownership_claims_owner_assignment_select
supplier_ownership_claims_assigned_reviewer_select
```

The resulting Claim policy inventory is exactly three SELECT policies and zero mutation policies. `anon`, browser `authenticated`, and generic `service_role` have no Claim policy, `claim_api` schema usage, or fixed-RPC execute capability.

`mujahiz_claim_runtime` can execute the four fixed APIs but cannot directly execute the arbitrary-profile or prior-context helpers and cannot select Reviewer-private base columns. `claim_security.target_supplier_conflict_v1` remains unavailable to runtime and browser/API/service roles; only the exact two projection roles receive internal execute capability.

## 8. Hidden-field boundary

Catalog output-name scans found zero Claim API hits for email, phone, Firebase/provider identity, controller identity, assigned-by/source/policy, fingerprint, reviewer notes, audit, event, idempotency, raw URL, or reference URL.

Fixtures additionally prove no output contains claimant email/phone/city, provider data, submission fingerprint, reviewer notes, Supplier source note/provenance, assignment actor/source/policy, controller identity, security/conflict reason, raw reference path/query, audit/event/idempotency data, or unrestricted row JSON.

## 9. Expiry and conflict behavior

Every exposed routine captures trusted PostgreSQL time internally and accepts no authorization time. Visibility requires `trusted_now < expires_at`. Submitted and under-review rows disappear at the exclusive boundary even if no later expire command has terminalized them.

Every relevant Owner/candidate/reviewer path composes current principal, relational eligibility, operation role, exact Claim lifecycle/assignment shape, non-expiry, target-Supplier conflict `clear`, and fixed output minimization. `unknown` and `conflict` never authorize. Presence of the known future Supplier-membership relation forces conflict coverage to `unknown` and removes queue/candidate/detail results even when the future relation is empty.

## 10. Validation evidence

### Focused pgTAP

The final focused disposable run applied all 25 migrations and ran only `reviewer_private_read_substrate.sql`:

```text
137 assertions passed, 0 failed
```

Coverage includes object signatures, exact output columns, role attributes/membership, table/column/function/schema ACLs, resolver version tuple and one-clock capture, current/private parity, positive and negative Owner/candidate/reviewer behavior, all evidence kinds, extra-field rejection, hidden-marker scans, trusted expiry boundaries, future-relation gating, unreadable dependency containment, direct-base denial, no mutation, and no side-effect rows.

### Reused-backend context harness

```text
Privileged resolver context harness passed: one reused PostgreSQL backend proved commit/rollback cleanup and current-state re-read; disposable local container only, not driver/pool/pooler evidence.
```

### Complete repository validator

```text
Local SQL validation passed: 25 migrations applied; 25 test files run; 1776 assertions passed, 0 failed; 76.4s elapsed.
```

### Catalog and source scans

Final disposable catalog/source checks proved:

- 24 physical `public`/`internal` tables;
- three Claim SELECT policies and zero mutation policies;
- exact NOLOGIN/NOINHERIT/non-superuser/non-BYPASSRLS role attributes;
- only non-executable database-admin membership (`ADMIN=true`, `INHERIT=false`, `SET=false`);
- all four fixed API functions owned by the correct dedicated projection role;
- every new/refactored SECURITY DEFINER uses `search_path=pg_catalog`;
- zero dynamic-SQL functions and zero write-capable functions in this slice;
- zero browser/API/service `claim_api` usage or execute capability;
- zero runtime execute capability on private arbitrary-profile/prior-context helpers;
- zero forbidden output-name hits;
- `supplier_claim.assign_reviewer` remains absent;
- `submit` and `withdraw` remain present;
- `git diff --check` passes; and
- zero task validation containers remain.

Firebase suites, real gateway/pool proof, and submit/withdraw concurrency were not rerun because this slice changes no Firebase integration, hosted ingress, or mutation implementation.

## 11. Adversarial review

All 30 required cases were explicitly reviewed. Four scoped findings are recorded in section 3 and were fixed before final validation. No unresolved in-scope finding remains.

1. Generic Owner Claim browsing: denied by Owner-only submitted/unassigned RLS plus fixed metadata output.
2. Generic Admin Claim browsing: denied; Admin fails the Owner queue role condition.
3. Candidate relationship oracle: candidate output is claim-scoped and three fields only; non-clear candidates are omitted without reason.
4. Arbitrary-profile privilege oracle: private helper has no runtime/browser/API/service execute path.
5. Caller-selected candidate as principal: candidate UUID is evaluated relationally and never replaces transaction-local current principal.
6. Role-only admission: denied without exact access/security/provider/profile tuple.
7. Access-only admission: denied without exact supported role binding and all other conjuncts.
8. Security-unknown admission: omitted/denied.
9. Conflict-unknown admission: omitted/denied.
10. Expired Claim read: denied at `trusted_now >= expires_at`.
11. Withdrawn/rejected/approved/superseded read: denied by exact active-state policies.
12. Stale durable assignment read: current eligibility/conflict and expiry are re-read on every request.
13. Unsupported assignment policy read: denied.
14. Claimant seeing Reviewer detail: denied.
15. Cross-reviewer access: denied by exact reviewer equality.
16. Projection-role RLS bypass: roles are non-BYPASSRLS and not table owners.
17. Permissive-policy audience union: separate roles isolate Owner and Reviewer policies.
18. Table-owner bypass: exposed APIs are owned by non-table-owner projection roles.
19. `service_role` execution: revoked.
20. Browser/API execution: revoked and schema usage denied.
21. Raw base-column access: runtime and projection grants are exact; runtime cannot read private columns.
22. Claimant UUID leakage: absent from every fixed output.
23. Provider/PII leakage: absent from outputs and hidden-marker scans.
24. Conflict/security-reason leakage: only allow/omit behavior is observable; no reason is returned.
25. Evidence JSON overexposure: fixed typed descriptor allowlist; extra fields fail closed; raw URL hidden.
26. SQL error leakage: private helpers contain unexpected errors and return non-authorizing results.
27. Dynamic SQL/search-path escalation: zero dynamic SQL; fixed `pg_catalog` search path everywhere.
28. Unintended writes: zero write statements in the new runtime functions and zero audit/event/idempotency/Claim side effects.
29. Accidental `assign_reviewer`: function remains absent.
30. LOCAL clear as hosted proof: explicitly rejected; this evidence is synthetic local proof only.

## 12. Exact resulting state and residual risk

- 25 tracked SQL migrations.
- 25 pgTAP files.
- 24 physical PostgreSQL business/internal tables.
- 80 logical concepts.
- 37 Core Phase 1 concepts.
- 22 implemented / 15 unimplemented Core table concepts.
- Three Claim SELECT policies.
- Zero Claim mutation policies.
- Exactly two of six Claim business mutations remain implemented: `submit` and `withdraw`.
- Reviewer Private-Read Substrate is implemented locally.
- `supplier_claim.assign_reviewer`, `approve`, `reject`, and `expire` remain absent.

Residual risks are intentionally outside this slice: Firebase remains Production authority; no real gateway, hosted Supabase authority, driver/pool/pooler isolation, Production role provisioning, migrated-person mapping, or real-data proof exists. A future assignment command must repeat all candidate and target checks after approved locks. Raw evidence URLs remain hidden until a separate pre-FILE read-time policy is approved.

The seven Open gates remain exactly:

```text
ORG-001
ORG-002
MSG-002
FILE-001
BILL-001
RES-001
MIG-002
```

## 13. Production/data impact and stop point

Production/data impact is none. Validation used disposable local PostgreSQL containers, a read-only repository mount, synthetic fixtures, no public ports, and cleanup in all paths. No Firebase Production, hosted Supabase, Production/TEST data, real user/Claim/Supplier, deployment, migration execution, seed, backfill, DNS, billing, Auth/config, Firestore rule/index, or hosted RLS/grant action occurred.

Exact stop point: private candidate eligibility, Owner queue, candidate projection, assigned-reviewer queue/detail, RLS/ACL isolation, focused/full/context validation, adversarial review, and this evidence are complete. No Claim assignment/decision/expiry mutation, access/security administration, gateway, or hosted work is implemented.
