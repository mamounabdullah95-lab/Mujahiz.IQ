# Core Phase 1 fourth SQL slice: categories selection

Status: **Selected for a future implementation PR; not implemented**
Decision date: 5 August 2026
Verified start: `origin/main` `995feeda072f345fdc0f00d101cdc598713c43c9`
Primary task profile: Documentation

## 1. Superseding decision

SUP-003 is Approved under the contract in [18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md). That approval supplies the minimum taxonomy contract for the smallest dependency-safe fourth SQL boundary:

**Future included table: `public.categories` only.**

This document supersedes the selection outcome in [17_FOURTH_SQL_SLICE_SELECTION.md](17_FOURTH_SQL_SLICE_SELECTION.md) only after SUP-003 approval. The historical no-go finding remains valid for the period when SUP-003 was Open; it is not rewritten as though `categories` was previously safe.

## 2. Dependency-safety analysis

- SUP-003 approves the Supplier-offering taxonomy contract: database-generated UUIDv4 identity, immutable canonical codes, one-parent hierarchy with maximum depth three, required Arabic and English labels, lifecycle and replacement rules, assignability rules, alias/mapping outcomes, and the zero-API-access boundary.
- `public.categories` can be created independently as an empty local-only table. It needs no Supplier, organization, Auth, hosted, or Production rows to establish its structural contract.
- `category_aliases` is a later physical child relation. It requires the category parent plus separately authorized alias lookup, provenance, normalization, lifecycle, and collision enforcement; it is excluded from this slice.
- `supplier_category_assignments` remains a later Core Phase 1 slice after category/alias mapping workflow, assignment rules, and transformation evidence are separately authorized. It is excluded from this slice.
- No other Open gate is required for an empty categories-only local slice. `SUP-004`, identity, organization, RFQ, messaging, search, files, billing, audit, resilience, and migration-environment decisions remain outside this boundary.

The other thirteen approval gates remain Open and unchanged: `ID-001`, `ORG-001`, `ORG-002`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 3. Exact future implementation boundary

A separately reviewed future implementation PR may contain only:

- one migration creating `public.categories`;
- one focused synthetic pgTAP file;
- minimum evidence and checklist updates;
- database-generated UUIDv4;
- an approved immutable canonical code;
- required Arabic and English labels;
- the approved hierarchy, lifecycle, replacement, and assignability fields;
- zero API-role privileges and no RLS or application access; and
- an empty table except for disposable synthetic tests.

The future PR remains local-only and synthetic-data-only. It must not link to or access hosted Supabase, Firebase, Production, or TEST data.

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
- migration, import, export, seed, or deployment.

No Core Phase 1 count changes in this documentation-only selection. The verified merged state remains **7 implemented / 29 deferred**. Only after a future implementation PR is merged would the counts become **8 implemented / 28 deferred**.

## 5. Validation and stop point

This selection was checked against the SUP-003 contract, schema decision register, PostgreSQL schema design, and review checklist. The change is documentation-only; no tests or builds are run by this task. The exact stop point is after this document is pushed and its Draft PR is opened. Do not mark it Ready, merge it, implement SQL, create taxonomy rows, or begin another task without explicit approval.
