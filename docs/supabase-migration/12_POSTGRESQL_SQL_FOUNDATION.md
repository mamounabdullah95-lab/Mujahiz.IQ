# PostgreSQL SQL Foundation — Migration Control and Traceability

Status: merged in repository `main`; not hosted, remotely applied, deployed, or Production-active
Merged by PR #47: `0760ee6f498c58ceb966ef766b1928c7549bc702` (approved head `217f3b49b697c03fae78396d0730d39d30486f94`; review parent `206f7daa524228abfa83793c39a03045491f1316`)
Migration: `supabase/migrations/20260804000136_migration_control_foundation.sql`

## Scope

This first executable SQL slice creates only trusted migration-governance structure in the non-exposed `internal` schema. `supabase/config.toml` exposes only `public` and `graphql_public`; browser clients must never access these relations directly. The migration contains no RLS, grants, policies, views, RPCs, application functions, triggers, seeds, business tables, application integration, or data.

The six physical tables are:

- `migration_batches`
- `migration_source_dispositions`
- `migration_record_mappings`
- `migration_merge_group_members`
- `migration_validation_results`
- `import_errors`

The authoritative design's logical target-mapping model is physically decomposed into disposition, target-binding, and merge-member relations. A reviewed merge-group header is a `merge_group` record inside `migration_record_mappings`, so one active reverse-target index covers ordinary and reviewed-merge target bindings. The separate member table records contributing `merged` source children without weakening ordinary mapping uniqueness. No trigger or database function is used.

## Decision evidence

### DB-001

The pinned local stack uses Supabase CLI `2.111.0` and PostgreSQL `17.6`. Catalog inspection found no built-in or installed UUIDv7 function. It found `pg_catalog.gen_random_uuid()` and installed `pgcrypto`/`uuid-ossp` UUIDv4 mechanisms. This slice therefore resolves DB-001 locally to database-generated UUIDv4 with `pg_catalog.gen_random_uuid()`.

The resolution is limited to this local first slice. It adds no custom UUID function or extension and makes no hosted-Supabase compatibility claim. Hosted PostgreSQL version and UUID capability remain a later read-only validation gate before remote promotion.

### MIG-001 and MIG-002

The current decision register assigns the mapping/disposition contract to `MIG-001`, not `MIG-002`. This migration implements the declarative MIG-001 schema portion: one active disposition per source version, deterministic zero-to-many child slots, active reverse-target uniqueness, explicit merge isolation, same-lineage reasoned supersession, versioned validation evidence, bounded errors, and dependency-ranked rollback traces.

The future Migration Engine must still provide transactional slot/target locking, identical-replay lookup, minimum and complete merge-member validation, atomic multi-row graph supersession, transformation execution, reconciliation orchestration, and rollback execution. A later trusted access-control layer must enforce owner-level immutability and retention. No runtime behavior is claimed here.

`MIG-002` remains Open because it governs local/development/staging/Production environment strategy. This local schema provides no evidence about hosted projects, secrets, promotion, backups, region, or deployment.

## Declarative invariants

- Batch replay identity includes environment, source system, source snapshot, scope, transformation version, and target schema version.
- Batch status/timestamp/failure combinations are bounded. JSON metadata has a fixed schema version, a three-key allowlist, type/length checks, and no unrestricted payload channel.
- Transformation-bearing dispositions, mappings, and merge members must use their batch's transformation version through composite foreign keys.
- Each active batch/source collection/document/version has at most one disposition. Supersession pointers preserve the same source identity and require a bounded reason code.
- Ordinary mappings require a non-null `migrated` or `merged` source outcome and exactly one semantic `child_key` or nonnegative deterministic `child_ordinal`.
- Active logical-child-slot uniqueness excludes target UUID; active reverse-target uniqueness spans ordinary and reviewed merge-group target bindings.
- Active ordinary mappings must reference active dispositions. Active merge members must reference both an active merged disposition and active merge-group binding; the deferrable status foreign keys support a future atomic graph-supersession transaction.
- Mapping and member successors must copy the predecessor's database-generated lineage ID. Mapping supersession also preserves record kind, target type, role, and logical-child locator; both successor types require bounded reason codes.
- Merge-group headers require bounded approval plus a reconciliation reference, SHA-256 evidence digest, and `passed` state. Member target type/role must match the group, and member slot uniqueness includes source disposition, target type, target role, and child key/ordinal.
- Validation results pair expected/actual evidence, require equality for a `passed` outcome, and allow versioned reruns without overwriting earlier evidence.
- Import errors bound category, code, severity, safe message, path, references, digest, and resolution state; `retry_pending` requires `retryable=true`.
- Evidence foreign keys use `ON DELETE RESTRICT`, so referenced history cannot be cascade-deleted.

This table-only slice cannot declaratively require an active merge-group header to already have a complete contributor set without a cyclic activation contract. The future Migration Engine must insert and validate at least one canonical member and every contributor in one controlled transaction before treating a group as usable. Because this PR intentionally adds no grants, trusted commands, or triggers, PostgreSQL owners can still mutate or delete unreferenced rows; append-only owner-level enforcement remains future access-control/runtime work.

## Index purpose

| Index family | Supported invariant or query |
|---|---|
| Batch replay identity | Idempotent lookup for one source snapshot, transformation version, and target schema version. |
| Active disposition identity | One active outcome per source document/version. |
| Disposition outcome and identity history | Batch reconciliation counts and complete source supersession history. |
| Active mapping/member lineage | At most one active row per database-generated successor lineage. |
| Active key/ordinal child slots | Non-forking deterministic zero-to-many source expansion. |
| Active reverse target | One active ordinary owner or reviewed merge-group binding per target/type/role. |
| Source, target, and batch mapping history | Forward/reverse trace, complete batch reconciliation, FK checks, comparison, and supersession review. |
| Rollback trace | Active targets ordered by explicit dependency rank for a later approved rollback planner. |
| Merge member source/type/role/order/canonical | Target-qualified non-forking contributors, deterministic reviewed order, and at most one active canonical source. |
| Validation run/check | One result per check in a run while allowing later reruns. |
| Error occurrence and severity/resolution queue | Deterministic error replay plus bounded operational resolution queries. |

## Local verification

- Locked dependency install passed with npm `11.19.0`; Supabase CLI resolved to `2.111.0`.
- Docker `29.6.2` was healthy and configured ports were free before startup.
- `supabase db reset` applied the migration to a clean disposable PostgreSQL `17.6` database.
- `supabase test db` passed 60/60 focused assertions using synthetic records.
- `supabase db lint --level warning` returned no schema errors.
- The final clean reset and 60-test run passed; the stack then stopped normally with no project containers or listeners on ports `54321`–`54324` remaining.
- Catalog inspection confirmed six `internal` tables and the intended constraints/indexes.
- Repository tests passed 181/181; the Production application build and supplier-template reproducibility check passed.
- Scoped secret/sensitive-data scans and `git diff --check` passed; final independent SQL review found no residual actionable issue.

Firebase Production, hosted Supabase, Production data, Auth, Storage, DNS, billing, and deployment were outside this slice and remain untouched. PR #47's exact-head GitHub gate passed; the authoritative baseline separately records the stale GitHub PR metadata anomaly and the verified merge history.
