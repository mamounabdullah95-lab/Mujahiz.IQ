# Security eligibility structural foundation ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â implementation evidence

Status: **implemented locally as an empty, fully revoked structural foundation; no resolver, runtime, or data authority**

Date: 2026-08-11

Primary task profile: `AUTH`

Branch: `codex/security-eligibility-foundation`

## Starting point and boundary

The exact fetched `origin/main` SHA was `3ef4d0230d9b705fda942894a7cc6448ef5ef8e7` (merged PR #113). PR #112 merge commit `f87352170893bbf5b2a9a796ab4ca7ed3391a26b` and PR #113 final implementation head `270df65b8848ed1eab2ddab5a475085b048a1ceb` are ancestors of that starting main.

This implementation adds exactly one physical table: `internal.security_eligibility_assessments`. It does not add a privileged-actor resolver, target-Supplier conflict resolver, Reviewer RLS/projection, `supplier_claim.assign_reviewer`, security administration command, bootstrap runtime, emergency recovery runtime, security data, hosted configuration, Firebase integration, data migration, seed, backfill, deployment, or Claim policy change.

## DDL and integrity boundary

Migration `20260810000400_security_eligibility_assessments_foundation.sql` creates a provider-neutral, internal-schema security-assessment history bound by restrictive foreign key to `public.user_profiles.id`. It uses database-generated UUID IDs, the fixed `platform_administration` scope, trusted half-open validity, lifecycle/version fields, bounded policy/coverage/minimization/evidence/correlation references, accountable human or bounded system/bootstrap provenance, terminal provenance, successor lineage, and trusted timestamps.

The exact result and condition compatibility matrix is:

| Result | Permitted condition type |
|---|---|
| `clear` | `complete_clear` |
| `deny` | `explicit_deny`, `security_hold`, `identity_quarantine` |
| `unknown` | `reconciliation_required` |

The migration declaratively enforces `active|resolved|expired|superseded` lifecycle shape, terminal provenance, successor only for `superseded`, `record_version >= 1`, bounded values, and a `btree_gist` half-open exclusion over subject, scope, security-policy version, and required-coverage version. Active assessments may be indefinite or finite; their validity is half-open and has no default duration. A future resolver must evaluate trusted current time: a row reaching `valid_until` is non-current for authorization even before a maintenance process persists `expired`. This foundation implements no resolver or automatic status transition. The exclusion permits non-overlapping assessment history and blocks overlapping effective assessments at an identical supported policy/coverage boundary.

The bounded source model is `bootstrap_manifest`, `security_administration`, `trusted_security_system`, `legacy_reconciliation`, and `correction`. Bootstrap can represent a complete clear without fabricated human actors. A trusted security system may represent only restrictive `deny` or `unknown` outcomes; it cannot clear. Human clear requires distinct accountable actor and reviewer, neither the assessment subject. This shape records the future dual-control seam but does not prove current Owner usability or implement any command.

## Privilege and future-runtime boundary

`PUBLIC`, `anon`, `authenticated`, `service_role`, and `mujahiz_claim_runtime` have no table privilege. The relation has no RLS, policy, trigger, function, RPC, view, resolver, or browser/API exposure. It stores no Firebase UID, provider subject, token, session, contact, raw evidence, arbitrary JSON, audit payload, or target-Supplier conflict detail.

The future final-Owner behavior remains outside this table: genuine authoritative security loss may make a final Owner unusable and requires governed emergency recovery; ordinary discretionary role/access administration must not intentionally leave zero usable Owners. No trigger or function implements either behavior here.

## Validation

Focused synthetic pgTAP `security_eligibility_assessments_foundation.sql` passed **59/59** assertions. It covers catalog shape, generated UUID, scope/result/condition constraints, lifecycle, overlap, provenance, minimization, ACL/RLS/trigger absence, Claim-policy regression, access-grant regression, and cleanup.

The repository validator completed successfully:

```text
Local SQL validation passed: 22 migrations applied; 22 test files run; 1458 assertions passed, 0 failed.
```

## Structural counts and production/data impact

The verified structural result is 80 logical concepts, 37 Core Phase 1 concepts, 22 implemented and 15 unimplemented Core concepts, 22 tracked migrations, 22 pgTAP files, and 24 physical PostgreSQL tables. `public.access_grants` remains unchanged and empty; Claim policy count remains one and Claim mutation policy count remains zero.

All validation used disposable local PostgreSQL with synthetic pgTAP fixtures only. No Firebase, hosted Supabase, Production/TEST data, real security/access rows, migration execution outside the disposable container, deployment, bootstrap, DNS, billing, Auth configuration, or RLS expansion occurred.
