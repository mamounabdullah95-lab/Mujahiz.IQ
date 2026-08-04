# Fourth SQL Slice — Categories Foundation Implementation Evidence

Status: Draft-branch implementation evidence; not merged, hosted, remotely applied, deployed, or Production-active

## Exact scope

This branch adds exactly one application table, `public.categories`, through `20260805000100_categories_foundation.sql`. It remains empty except for disposable synthetic pgTAP rows.

The table provides database-generated UUIDv4 identity; a unique lowercase ASCII snake-case canonical code; a nullable legacy Firestore alternate key; required Arabic and English labels plus versioned normalized comparison values; the single `supplier_offering` taxonomy type; bounded hierarchy depth; lifecycle, assignability, ordering, replacement, timestamps, and nullable trusted actor references.

It creates no category vocabulary, current application code, `other` category, alias, Supplier assignment, mapping manifest, application integration, RLS, policy, grant, view, RPC, trigger, function, Auth bridge, hosted linkage, or data operation.

## Declarative enforcement and boundary

Composite self-references enforce parent type/depth coherence, a maximum of three hierarchy levels, root shape, acyclicity through strictly decreasing parent depth, non-assignable parents, active replacement targets, and restrictive delete behavior. A separate archived-parent guard blocks archiving a parent until each direct child is archived; recursive depth means this produces the approved bottom-up boundary. Partial `NULLS NOT DISTINCT` indexes enforce non-archived Arabic/English normalized sibling-label uniqueness, including roots.

The selected one-table/no-trigger boundary cannot enforce canonical-code update immutability, active/deprecated parent immutability, lifecycle transition history, or derivation of normalized labels from their display values. Those rules are documented on the columns and are deferred to the separately authorized trusted mutation path. This branch does not claim that those update-time rules are database-enforced.

## Core Phase 1 and approval-gate state

Merged `main` remains **7 implemented / 29 deferred / 36 total**. If this Draft branch were merged, it would be **8 implemented / 28 deferred / 36 total**.

`SUP-003` remains Approved. The remaining Open gates are unchanged: `ID-001`, `ORG-001`, `ORG-002`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## Validation record

Focused local pgTAP contains 107 planned synthetic assertions; complete local pgTAP, lint, and catalog validation are pending because this workstation has no reachable Docker Desktop daemon for the disposable local Supabase runtime. The failed CLI probe did not access a hosted project or any Production system. The focused test file contains only synthetic values and runs in a transaction that rolls back its rows.

## Critical self-review corrections

- Corrected the focused migration-control test to qualify the synthetic category target ID rather than rely on an ambiguous column reference.
- Reused the existing catalog-based PUBLIC/API-role ACL assertion pattern instead of a portability-risky direct `PUBLIC` privilege helper call.
- Confirmed that no trigger or function is authorized for code/parent immutability, lifecycle transition history, or normalized-value derivation; those material update-time rules remain an explicit later trusted-mutation-path blocker.
No Firebase, hosted Supabase, Production, TEST, taxonomy, Supplier, migration, seed, import, export, backfill, or deletion operation is included.
