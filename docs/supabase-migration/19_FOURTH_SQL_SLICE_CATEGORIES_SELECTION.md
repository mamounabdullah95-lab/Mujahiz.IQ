# Core Phase 1 fourth SQL slice: categories selection

Status: **Historical PR #59 evidence; implemented and merged locally, not hosted or deployed**
Decision date: 5 August 2026
Verified start: `origin/main` `995feeda072f345fdc0f00d101cdc598713c43c9`
PR #59 merge commit: `f37d46bd875987a6c2d177b21df31a8ecb8e0b71`
Primary task profile: Documentation

## 1. Superseding decision

SUP-003 is Approved under the contract in [18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md). That approval supplies the minimum taxonomy contract for the smallest dependency-safe fourth SQL boundary:

**Included table in PR #59: `public.categories` only.**

This document supersedes the selection outcome in [17_FOURTH_SQL_SLICE_SELECTION.md](17_FOURTH_SQL_SLICE_SELECTION.md) only after SUP-003 approval. The historical no-go finding remains valid for the period when SUP-003 was Open; it is not rewritten as though `categories` was previously safe.

## 2. Dependency-safety analysis

- SUP-003 approves the Supplier-offering taxonomy contract: database-generated UUIDv4 identity, stable canonical codes whose update immutability requires later trusted mutation enforcement, one-parent hierarchy with maximum depth three, required Arabic and English labels, lifecycle and replacement rules, assignability rules, alias/mapping outcomes, and the zero-API-access boundary.
- `public.categories` can be created independently as an empty local-only table. It needs no Supplier, organization, Auth, hosted, or Production rows to establish its structural contract.
- `category_aliases` is a later physical child relation. It requires the category parent plus separately authorized alias lookup, provenance, normalization, lifecycle, and collision enforcement; it is excluded from this slice.
- `supplier_category_assignments` remains a later Core Phase 1 slice after category/alias mapping workflow, assignment rules, and transformation evidence are separately authorized. It is excluded from this slice.
- No other Open gate is required for an empty categories-only local slice. `SUP-004`, identity, organization, RFQ, messaging, search, files, billing, audit, resilience, and migration-environment decisions remain outside this boundary.

At the PR #59 historical decision point, SUP-003 was Approved and the other approval gates remained Open. The current baseline is authoritative for the current gate count and list.

## 3. Exact implementation boundary

The separately reviewed PR #59 implementation contained only:

- one migration creating `public.categories`;
- one focused synthetic pgTAP file;
- minimum evidence and checklist updates;
- database-generated UUIDv4;
- an approved canonical-code shape and uniqueness rule, with update immutability explicitly deferred;
- required Arabic and English labels;
- the approved hierarchy, lifecycle, replacement, and assignability fields;
- zero API-role privileges and no RLS or application access; and
- an empty table except for disposable synthetic tests.

The merged PR #59 implementation remained local-only and synthetic-data-only. It did not link to or access hosted Supabase, Firebase, Production, or TEST data.

## 4. Exact exclusions

This selection authorizes no taxonomy rows, current 23 category codes, aliases, mappings, Supplier assignments, or automatic adoption of any existing category value. It also excludes:

- `category_aliases`;
- `supplier_category_assignments`;
- taxonomy seeds or canonical vocabulary rows;
- Supplier data transformation;
- search synonyms or SEARCH-001 work;
- administrative areas or SUP-004;
- RLS, policies, grants, views, RPCs, triggers, Auth, browser/API access, and frontend work;
- Firebase or hosted Supabase access;
- Production or TEST data;
- data migration, import, export, seed, or deployment.

The current verified `main` state is authoritative for present implementation counts, physical-table count, and approval-gate state. Historical PR #59 implementation boundary: `public.categories` only; it must not overwrite the current baseline.

## 5. Validation and stop point

Historical PR #59 evidence: the corrected implementation passed a clean local reset, focused pgTAP 118/118, complete pgTAP 340/340, warning-level lint, exact catalog assertions, scoped scans, and `git diff --check`. These results belong to PR #59 merged head, not to the current branch. Do not create taxonomy rows, aliases, assignments, or begin another SQL slice without explicit approval.
