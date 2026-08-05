# Core Phase 1 fifth SQL slice: administrative areas selection

Status: **Selected planning boundary; implementation not authorized or started**
Decision date: 5 August 2026
Verified start: `origin/main` `f37d46bd875987a6c2d177b21df31a8ecb8e0b71`
Primary task profile: Documentation

## 1. Selection

SUP-004 is Resolved under `21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`.

The proposed fifth SQL slice is exactly:

- `public.administrative_areas`

The future implementation must create an empty local-only foundation. It must not create reference rows, Supplier assignments, aliases/mappings, or any application/data behavior.

## 2. Current state and projected count

Merged PR #59 contains 10 physical tables representing 8 implemented Core Phase 1 concepts, with 28 of 36 deferred.

If a separately authorized fifth implementation later creates exactly `public.administrative_areas`, the local foundation would contain 11 physical tables representing 9 implemented Core Phase 1 concepts, with 27 of 36 deferred. This is a projection, not current implementation state.

Twelve approval gates remain Open: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 3. Dependency safety

- The relation is a reference root and requires no Supplier, Auth, organization, category, RFQ, RLS, hosted, or Production row.
- DB-001 already supplies the local UUIDv4 convention.
- SUP-004 supplies stable internal identity, governorate-only first-slice shape, bilingual-name, lifecycle, official-code separation, and historical-compatibility boundaries.
- Parent/depth fields may keep the structure hierarchy-ready, but the first slice must accept only governorate rows with no parent and depth 1. District/subdistrict acceptance and population remain a later approved slice.
- Zero API-role access keeps the empty foundation outside browser/application authority; RLS and projections remain separate.
- An empty table is locally reversible and does not require an official reference snapshot or data transformation.

## 4. Required future implementation contract

A separately authorized SQL task must prove only the bounded structural contract:

- database-generated UUIDv4 primary key;
- immutable canonical-code shape and uniqueness, with update-time enforcement explicitly included or deferred by the authorized SQL boundary;
- `area_type=governorate`, `hierarchy_depth=1`, and `parent_area_id IS NULL` for the fifth slice;
- required bounded Arabic and English names plus deterministic normalized comparison values;
- lifecycle/status, ordering, optional separately namespaced official/reference code metadata, timestamps, and nullable trusted actors consistent with existing foundations;
- restrictive foreign keys and no cascade deletion;
- zero rows after tests, zero API-role privileges, and no RLS/policy/view/RPC/function/application trigger unless separately authorized; and
- focused synthetic pgTAP/catalog checks in the later implementation PR.

This planning document is not SQL authorization. Exact columns, constraints, indexes, comments, and test counts belong to the later implementation task.

## 5. Exact exclusions

- no SQL migration or pgTAP in PR #61;
- no governorate seed or population, including no direct copy of the current 18 constants;
- no Firebase read, export, mapping, migration, backfill, reconciliation, or write;
- no `supplier_locations`, Supplier physical assignment, service coverage, or capability table;
- no district, subdistrict, city, locality, postal, coordinate, boundary, geometry, or spatial-extension support;
- no hosted Supabase access, remote SQL, RLS, policy, grant, Auth, Storage, Realtime, Edge Function, or application integration;
- no Production or TEST data access/change; and
- no merge or deployment.

## 6. Later sequencing

After a separately approved and merged fifth SQL implementation:

1. obtain and review a dated official source for all 19 governorates, including Halabja;
2. approve canonical codes, bilingual labels, external identifiers, and exception/collision evidence in a separate reference-data task;
3. populate only through a separately authorized local/data workflow;
4. design district/subdistrict support in its own approved slice if needed; and
5. select `supplier_locations` only after its SQL boundary, trusted mapping artifacts, contact dependency, and access/projection constraints are separately reviewed.

`imports_outside_iraq` belongs to future Supplier capability work and must never be introduced as an administrative-area or service-coverage row.

## 7. Validation and stop point

Focused documentation checks only: decision synchronization, 12 Open-gate count, 10 current physical tables, 8/28 current concepts, relative links, sensitive-value scan, Markdown structure, documentation-only diff, and `git diff --check`.

Exact stop point: Ready PR #61 after checks pass. Do not implement the fifth slice, populate areas, add Supplier assignments, merge, or deploy.

## 8. References

- [`21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`](21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`20_FOURTH_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md`](20_FOURTH_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md)
