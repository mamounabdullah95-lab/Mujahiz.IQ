# Access grants structural foundation — implementation evidence

Status: **implemented locally as an empty, fully revoked structural foundation; no runtime or data authority**

Date: 2026-08-10

Primary task profile: `AUTH`

Branch: `codex/access-grants-foundation`

## Starting point and boundary

The exact starting `origin/main` SHA was `f87352170893bbf5b2a9a796ab4ca7ed3391a26b` (merged PR #112). The PR #112 implementation head `b2a9cac` is an ancestor of that starting main.

This implementation adds exactly one physical table: `public.access_grants`. It does not add `internal.security_eligibility_assessments`, a privileged-actor resolver, a target-Supplier conflict resolver, Reviewer RLS/projections, an access command, bootstrap runtime, access data, hosted configuration, Firebase integration, data migration, seed, backfill, deployment, or Claim policy change.

## DDL and relational integrity

Migration `20260810000300_access_grants_foundation.sql` adds the minimum supporting unique constraint `platform_role_assignments_id_user_role_uk` on `public.platform_role_assignments (id, user_profile_id, role_code)`. This enables the restrictive composite foreign key from each grant’s `(platform_role_assignment_id, user_profile_id, role_code)` to the exact assignment. The duplicated role code is therefore binding evidence only, never an independent role authority.

`public.access_grants` uses a database-generated UUID primary key and records only provider-neutral subject/assignment binding, the fixed `platform_administration` purpose, `owner|admin` role code, lifecycle/validity/version fields, bounded source/reason/policy/evidence/correlation references, human-or-system grant provenance, optional distinct reviewer, terminal provenance, successor lineage, and trusted timestamps.

The table declaratively enforces:

- purpose exactly `platform_administration`;
- lifecycle exactly `active|revoked|expired|superseded`;
- half-open, non-empty validity intervals and `record_version >= 1`;
- active Owner rows with `valid_until is null`;
- finite Admin horizons no longer than `valid_from + interval '180 days'`;
- complete terminal provenance and restrictive successor shape;
- mutually exclusive human versus bootstrap/system grant provenance;
- reviewer distinctness from subject and human grantor;
- restrictive profile, role-binding, provenance, and successor foreign keys; and
- two `btree_gist` exclusion constraints: no overlapping effective access for a subject/purpose and no overlapping effective access for a role-assignment/purpose.

The migration adds active subject, active role-assignment, and subject lifecycle lookup indexes. It reuses the existing `btree_gist` repository convention and adds no extension.

## Privilege and exposure boundary

`PUBLIC`, `anon`, `authenticated`, `service_role`, and `mujahiz_claim_runtime` have no direct privilege on `public.access_grants`. The table has no RLS, policies, triggers, functions, RPCs, views, resolver, or runtime mutation path.

The local catalog verification found zero access rows, zero access policies, zero non-internal access triggers, and zero forbidden ACL entries. Claim policy count remains exactly one; Claim mutation policy count remains zero.

## Validation

Focused `access_grants_foundation.sql` pgTAP coverage passed **50/50** assertions. It covers catalog shape, generated UUID, composite binding, lifecycle/purpose/version/bounded-field checks, Owner/Admin horizons, overlap, terminal/successor shape, dual-control provenance seam, privilege boundary, absence of later dependencies, and synthetic cleanup.

The repository validator completed successfully:

```text
Local SQL validation passed: 21 migrations applied; 21 test files run; 1399 assertions passed, 0 failed.
```

Independent disposable-container verification reported 23 physical tables, 21 migrations, 21 pgTAP files, zero `access_grants` rows, zero access policies, one Claim policy, zero forbidden access ACLs, an absent `internal.security_eligibility_assessments` relation, and zero `current_privileged_actor` routines. The migration sensitive-value scan found no prohibited stored identifiers or payload fields, and `git diff --check` passed.

## Structural counts and future boundary

The verified structural result is 80 logical concepts, 37 Core Phase 1 concepts, 21 implemented and 16 unimplemented Core concepts, 21 tracked migrations, 21 pgTAP files, and 23 physical PostgreSQL tables.

This slice is only the role-backed platform-administration access substrate. A future resolver must still evaluate the referenced role’s lifecycle/time horizon, profile, Firebase identity-link mirror, security eligibility, and command-specific predicates. A later-inactive role therefore remains unusable at runtime even if its historical access row is structurally retained.

## Production and data impact

All work used disposable local PostgreSQL and synthetic pgTAP fixtures. No Firebase, hosted Supabase, Production/TEST data, real role/access rows, migration execution outside the disposable container, deployment, bootstrap, DNS, billing, Auth configuration, or RLS expansion occurred.
