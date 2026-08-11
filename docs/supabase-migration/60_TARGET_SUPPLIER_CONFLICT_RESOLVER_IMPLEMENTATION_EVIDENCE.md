# Target-Supplier Conflict Resolver — Implementation Evidence

Status: **Implemented and validated for bounded LOCAL synthetic use only**

Primary task profile: `AUTH`

Branch: `codex/target-supplier-conflict-resolver`

## Starting point and ancestry

The branch was created directly from fetched `origin/main` at:

`7f2eb39f8acca356635509de1060fac2e3dec689`

That commit is the merge of PR #117. The following exact merge commits were verified as ancestors of the starting commit:

| Pull request | Merge commit | Ancestor of starting main |
|---|---|---|
| #113 | `3ef4d0230d9b705fda942894a7cc6448ef5ef8e7` | yes |
| #114 | `d78d491877573f55012e7eac29d7b5ed41772be9` | yes |
| #115 | `d606d4fca8a90c9ffe3444982ead48757245aeec` | yes |
| #116 | `ecf60e756ffba5f04a79fc71dcbcdf6c60bf7004` | yes |
| #117 | `7f2eb39f8acca356635509de1060fac2e3dec689` | yes |

No later relevant `origin/main` delta existed when the task began.

## Authoritative contracts reviewed

- `docs/ai-context/01_CURRENT_BASELINE.md`
- `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
- `docs/supabase-migration/09_POSTGRESQL_SCHEMA_DESIGN.md`
- `docs/supabase-migration/10_SCHEMA_DECISION_REGISTER.md`
- `docs/supabase-migration/32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`
- `docs/supabase-migration/33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`
- `docs/supabase-migration/41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md`
- `docs/supabase-migration/42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md`
- `docs/supabase-migration/46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md`
- `docs/supabase-migration/51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md`
- `docs/supabase-migration/55_PRIVILEGED_ACTOR_ACCESS_AND_SECURITY_ELIGIBILITY_READINESS.md`
- `docs/supabase-migration/58_PRIVILEGED_ACTOR_RESOLVER_IMPLEMENTATION_READINESS.md`
- `docs/supabase-migration/59_PRIVILEGED_ACTOR_RESOLVER_IMPLEMENTATION_EVIDENCE.md`

Direct schemas and helper dependencies were inspected without a repository-wide review.

## Readiness verdict

The Owner-approved contract is complete enough for the bounded LOCAL helper, so no separate readiness-only document is required.

- Document 51 fixes the exact result vocabulary as `clear`, `conflict`, and `unknown`; only `clear` may authorize a later Reviewer path.
- No separate caller-supplied conflict-policy identifier is required or approved. The private API itself is versioned as `target_supplier_conflict_v1`.
- The supported ownership contract is the current unversioned `public.supplier_ownerships` schema.
- The supported active Claim assignment contract is exact: `reviewer_assignment_version = 1`, `reviewer_assignment_source_code = 'owner_assignment'`, and `reviewer_assignment_policy_version = 'claim_reviewer_assignment_v1'`.
- Current ownership uses one trusted database observation and half-open validity: `valid_from <= t` and `t < valid_until`, with null `valid_until` unbounded.
- Only `active` primary-controller ownership and `submitted`/`under_review` competing Claims are conflicts. Historical ownership and terminal Claims are not current conflicts, but contradictory history or provenance returns `unknown`.
- Documents 51 and 55 permit `clear` for the complete current LOCAL relational subset because no Supplier membership/delegation or organization-membership authority is enabled locally. This is synthetic local proof only, never proof about a hosted or migrated person.

## Implemented API and predicate

The migration adds exactly one private function:

```sql
claim_security.target_supplier_conflict_v1(
  actor_user_profile_id uuid,
  target_supplier_profile_id uuid,
  target_claim_id uuid
) returns text
```

Inputs are limited to the actor, target Supplier, and target Claim identifiers. The target Claim is required to preserve an explicit claimant comparison and exact Claim-to-Supplier binding. There is no current-principal wrapper and no Supplier-only overload.

For a structurally supported active target Claim bound to the target Supplier:

1. actor equals the target Claim claimant: `conflict`;
2. actor is the effective current active primary controller: `conflict`;
3. actor is claimant on another same-Supplier Claim in `submitted` or `under_review`: `conflict`;
4. otherwise, after every supported completeness/integrity check passes: `clear`.

Missing, ambiguous, contradictory, unreadable, or unsupported state returns `unknown` before any conclusive conflict fact. Representative examples include missing inputs/rows, target Claim substitution or terminal state, malformed ownership lifecycle or overlap, invalid transfer-successor binding, duplicate active same-pair Claims, malformed assignment shape, unsupported assignment version/policy, approved Claim/resulting-ownership binding mismatch, and multiple effective current controllers.

The function returns no detailed reason and therefore exposes no relationship or PII explanation.

## Evidence sources and non-evidence

Implemented relational evidence is limited to:

- `public.user_profiles`: actor existence only;
- `public.supplier_profiles`: target Supplier existence only;
- `public.supplier_ownerships`: current primary-controller conflict plus ownership integrity/currentness;
- `public.supplier_ownership_claims`: target claimant, competing active Claim, active assignment shape, duplicate ambiguity, and approved-result binding;
- catalog existence checks for the known future relationship tables.

The function does not read or infer authority from email/domain, Supplier contacts, provider data, role text, account context, legacy organization, Supplier names, creator/updater provenance, or other profile/source free text. A concrete test adds a Supplier contact endpoint exactly matching the actor and proves the result remains `clear`.

## Self-assignment boundary

The generic resolver has one actor input, so it cannot safely compare the later reviewer candidate with the separately server-derived assigning Owner. That comparison remains mandatory in the later trusted `assign_reviewer` command/helper layer. This slice does not implement that command behavior. A persisted active assignment where reviewer equals assigning owner is treated as contradictory and returns `unknown`.

## Future and unavailable coverage

No Supplier membership/admin/delegate relation, organization relation, organization-membership relation, or general conflict/recusal relation exists locally, and none is created here.

The v1 helper checks for the known future `public.supplier_memberships`, `public.organizations`, and `public.organization_memberships` relations. Their existence forces `unknown` even when empty, so an empty future table cannot be treated as proof of no conflict.

An environment with external or differently named relationship authority cannot interpret LOCAL absence as `clear`. Before hosted use, an approved environment capability manifest and complete successor coverage must identify every enabled relationship authority; unavailable required coverage must return `unknown`. ORG-001 and ORG-002 remain Open.

## Trusted time and precedence

`pg_catalog.clock_timestamp()` is captured exactly once per evaluation. Callers cannot supply time. Current ownership uses the approved half-open interval, so the exclusive boundary is non-current.

Decision precedence is:

1. missing/ambiguous/contradictory/unsupported/unreadable coverage: `unknown`;
2. otherwise, a conclusive supported conflict fact: `conflict`;
3. only otherwise, complete supported LOCAL state: `clear`.

Only `clear` is authorization-positive.

## Privilege and write boundary

The helper is `VOLATILE`, `SECURITY DEFINER`, owned locally by `postgres`, and fixes `search_path = pg_catalog`. Application relations are fully qualified. There is no dynamic SQL, caller-selected object, polymorphic input, or temp-object dependency.

`EXECUTE` is explicitly revoked from `PUBLIC`, `anon`, `authenticated`, `service_role`, and `mujahiz_claim_runtime`. No non-owner executor is granted. The runtime has zero direct `SELECT`, `INSERT`, `UPDATE`, or `DELETE` privileges on the four resolver source tables.

The resolver is read-only: no Claim/ownership/audit/event/notification/cache/materialization write occurs. Local `postgres` ownership is not hosted release readiness.

## Focused validation

The final focused disposable run used `supabase/postgres:17.6.1.064`, mounted the repository read-only, published no ports, applied all 24 migrations, ran only `target_supplier_conflict_resolver.sql`, and removed its container.

Result: **69 assertions passed, 0 failed**.

Coverage includes object/signature/owner/ACL, fixed search path, one trusted clock call, no dynamic SQL/writes/PII inference, no new table/view/RLS/trigger, clear baseline, null/missing/substituted inputs, claimant conflict, current/future/historical/exclusive-boundary ownership, submitted and under-review competing Claims, all terminal Claim statuses, cross-user/cross-Supplier isolation, concrete non-evidence fixtures, unsupported assignment policy/version, persisted self-assignment contradiction, malformed/binding/duplicate/multiple-controller ambiguity, future empty-table gating, read-only row counts, unreadable relations, and ambiguity-before-conflict precedence.

No separate trusted-time harness was needed because the function definition and pgTAP catalog assertion prove one `clock_timestamp()` capture, the predicate is explicitly half-open, and the boundary fixture proves the row is historical at or after the exclusive endpoint.

## Full validation and scans

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-local-supabase-sql.ps1
```

Final result: **24 migrations applied; 24 test files run; 1,639 assertions passed, 0 failed; 73.8 seconds elapsed**.

Additional disposable catalog and source scans proved:

- 24 physical tables;
- exactly one RLS policy and zero Claim mutation policies;
- zero relations in `claim_security`;
- resolver owner `postgres`, `SECURITY DEFINER`, `VOLATILE`, and `search_path=pg_catalog`;
- exactly one `pg_catalog.clock_timestamp()` call;
- no dynamic SQL or mutation statement in the function;
- no PII/free-text relationship inference;
- no execution by `PUBLIC`, `anon`, `authenticated`, `service_role`, or `mujahiz_claim_runtime`;
- zero runtime privileges on resolver source tables;
- no new table, view, RLS policy, trigger, or Reviewer surface in the migration;
- half-open currentness and known-future-relation gating are present;
- zero resolver validation containers remain;
- `git diff --check` passes.

Firebase suites and submit/withdraw concurrency harnesses were not rerun because this slice changes neither Firebase nor those command/privilege dependencies.

## Adversarial review

All 28 requested attack/failure classes were reviewed. No scoped resolver defect remains.

- Arbitrary relationship-oracle exposure, actor/Supplier substitution, caller-selected time/policy, API/service/runtime execution, raw table grants, search-path injection, dynamic SQL, SECURITY DEFINER escalation, relationship/PII/reason leakage, and writes are blocked by the signature, ACL, qualification, fixed path, and read-only implementation.
- Current/historical confusion, exclusive expiry, inactive/wrong-Supplier Claims, explicit target claimant handling, multiple-controller precedence, missing/unreadable/empty coverage, and ambiguity precedence are covered by deterministic tests.
- Email/domain, contacts, organization text, creator/updater, account context, provider data, and role are never relationship evidence.
- No Reviewer RLS, queue/read surface, `assign_reviewer`, approve/reject/expire command, membership relation, ORG decision, gateway, hosting, or Production capability is introduced.

The first full run caught an invalid synthetic `expired` Claim fixture whose terminal fields did not satisfy the canonical lifecycle shape. The fixture was corrected to canonical expiry/supersession/withdrawal provenance. The adversarial pass also strengthened contact non-evidence from source-only proof to a concrete matching contact-row proof. Focused and full validation were rerun after both changes.

## Exact structural state

- 24 tracked SQL migrations.
- 24 focused pgTAP files.
- 24 physical PostgreSQL tables.
- 80 logical concepts.
- 37 Core Phase 1 concepts: 22 implemented and 15 unimplemented.
- Exactly one Claim RLS policy.
- Zero Claim mutation RLS policies.
- Exactly two of six Claim business mutations implemented: `supplier_claim.submit` and `supplier_claim.withdraw`.
- The resolver adds a function only; it does not change table or logical-concept counts.

## Open gates

Exactly seven gates remain Open and unchanged:

- `ORG-001`
- `ORG-002`
- `MSG-002`
- `FILE-001`
- `BILL-001`
- `RES-001`
- `MIG-002`

## Production and data impact

None. Work used disposable local PostgreSQL and deterministic synthetic rows only, with no public ports. It did not access or change Firebase Production, hosted Supabase, Production/TEST data, real users, real Suppliers/relationships/Claims, DNS, billing, Auth/config, Firestore, hosted grants, seeds, backfills, migrations, or deployments.

## Exact stop point

Stop after this resolver migration, its focused/full validation and adversarial review, this evidence record, commit/push, and one Draft PR. Do not proceed into Reviewer private reads, Reviewer RLS/queues, `assign_reviewer`, approve/reject, expiry, gateway, hosting, migration, or Production.
