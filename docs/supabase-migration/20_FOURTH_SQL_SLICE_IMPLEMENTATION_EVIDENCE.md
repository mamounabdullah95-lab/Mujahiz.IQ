# Fourth SQL Slice — Categories Foundation Implementation Evidence

Status: PR #59 merged implementation evidence; local-only, not hosted, remotely applied, deployed, or Production-active

## Exact scope

PR #59 adds exactly one application table, `public.categories`, through `20260805000100_categories_foundation.sql`. It remains empty except for disposable synthetic pgTAP rows.

The table provides database-generated UUIDv4 identity; a unique lowercase ASCII snake-case canonical code; a nullable legacy Firestore alternate key; required Arabic and English labels plus versioned normalized comparison values; the single `supplier_offering` taxonomy type; bounded hierarchy depth; lifecycle, assignability, ordering, replacement, timestamps, and nullable trusted actor references.

It creates no category vocabulary, current application code, `other` category, alias, Supplier assignment, mapping manifest, application integration, RLS, policy, grant, view, RPC, trigger, function, Auth bridge, hosted linkage, or data operation.

## Declarative enforcement and boundary

Composite self-references enforce parent type/depth coherence, a maximum of three hierarchy levels, root shape, acyclicity through strictly decreasing parent depth, non-assignable parents, active replacement targets, and restrictive delete behavior. A separate archived-parent guard blocks archiving a parent until each direct child is archived; recursive depth means this produces the approved bottom-up boundary. Partial `NULLS NOT DISTINCT` indexes enforce active/deprecated Arabic/English normalized sibling-label uniqueness, including roots, while provisional draft and historical archived values remain outside that uniqueness predicate.

The selected one-table/no-trigger boundary cannot enforce canonical-code update immutability, active/deprecated parent immutability, lifecycle transition history, or derivation of normalized labels from their display values. Those rules are documented on the columns and are deferred to the separately authorized trusted mutation path. This branch does not claim that those update-time rules are database-enforced.

## Core Phase 1 and approval-gate state

Merged `main` is **8 implemented / 28 deferred / 36 total**.

`SUP-003` is Approved. The remaining 13 Open gates are: `ID-001`, `ORG-001`, `ORG-002`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## Validation record

A clean local Supabase reset applied all four migrations. Focused synthetic pgTAP passed **118/118** and the complete local pgTAP suite passed **340/340**. Warning-level lint returned no schema errors. Catalog checks confirmed 26 columns, 27 named constraints, 13 exact indexes, five exact `ON DELETE RESTRICT` foreign keys, zero RLS/policies/application triggers/public routines/public views/API-role table privileges, one taxonomy application table, and zero taxonomy rows. The focused test file contains only synthetic values and rolls back its rows. Unicode-whitespace cases cover both display labels and stored normalized values.

## Critical self-review corrections

- Corrected the migration default so a valid minimal root receives `hierarchy_depth = 1` rather than failing a required-column check.
- Corrected focused test fixtures so the replacement-negative case targets a draft node, archive transitions clear `is_assignable`, and provenance target IDs are unambiguous.
- Rejected leading/trailing Unicode whitespace in both display labels and stored normalized values; `btrim` alone did not reject a single non-breaking-space boundary.
- Added exact constraint-name/type, foreign-key-definition, and index-shape catalog assertions, and aligned sibling-index names with their active/deprecated predicate.
- Reused the existing catalog-based PUBLIC/API-role ACL assertion pattern instead of a portability-risky direct `PUBLIC` privilege helper call.
- Confirmed that no trigger or function is authorized for code/parent immutability, lifecycle transition history, or normalized-value derivation; those material update-time rules remain an explicit later trusted-mutation-path blocker.
No Firebase, hosted Supabase, Production, TEST, taxonomy, Supplier, migration, seed, import, export, backfill, or deletion operation is included.
