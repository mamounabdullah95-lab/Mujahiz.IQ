# Core Phase 1 seventh SQL slice selection

Status: **Verified hard stop; no seventh SQL migration is selected**
Selection date: 6 August 2026
Verified start: `origin/main` `95b31b11d6c5509dd7aedfc6b53a296ead2dd2ae`
Merged sixth-slice evidence: PR #68 merge `95b31b11d6c5509dd7aedfc6b53a296ead2dd2ae`; reviewed head `b72c9d2`
Primary task profile: Documentation

## 1. Decision

Apply Hard Stop A. Do not implement a seventh SQL slice.

The smallest apparent successor is `public.supplier_category_assignments`. Its direct parent tables, `public.supplier_profiles` and `public.categories`, are merged locally, and SUP-003 is Resolved. However, the approved SUP-003 contract does not authorize assignment SQL. Section 12.2 of [`18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md`](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md) expressly keeps `supplier_category_assignments` for a later slice after category aliases/mapping rules, the assignment workflow, and transformation evidence are separately approved.

The exact blockers are:

- no later approval decides whether the empty assignment table may precede `public.category_aliases` or must wait for the separately authorized alias/mapping boundary;
- no reviewed repository artifact supplies the required versioned source-to-category mapping manifest, alias-collision outcome, assignment transformation evidence, or reconciliation boundary;
- no exact row-lifecycle contract explains how active canonical assignments, later reassignment, deprecation, archive, and historically resolvable assignments coexist;
- no approved enforcement boundary explains how a new assignment is restricted to an active assignable leaf without preventing later category deprecation or rewriting assignment history;
- the contract deliberately leaves proposer, reviewer, actor, trusted mutation, and authorization ownership unselected; and
- no exact DDL selection has approved the FK, CHECK, UNIQUE, index, comment, and synthetic pgTAP boundary for this table.

These are product/data, mapping, ownership, and security dependencies. Implementing the table would silently choose among them, so the high-level SUP-003 approval is insufficient implementation authority. This finding does not reopen SUP-003 and does not change any approval-gate status.

The next permissible task is a focused Supplier-category-assignment contract review. It must decide only the empty local structural boundary and must not create aliases or taxonomy rows, map Supplier data, execute transformation artifacts, add RLS or API access, or access Firebase, hosted Supabase, Production, or TEST data.

## 2. Verified current state

- `origin/main` is exactly `95b31b11d6c5509dd7aedfc6b53a296ead2dd2ae`.
- PR #68 is merged at that SHA and adds `public.supplier_locations` through `20260806000100_supplier_locations_foundation.sql` plus focused synthetic pgTAP.
- The local SQL foundation contains 12 physical tables representing 10 implemented Core Phase 1 concepts; 26 of 36 Core Phase 1 concepts remain deferred.
- `public.category_aliases` and `public.supplier_category_assignments` are absent. `public.categories` remains an empty structural foundation with no approved vocabulary rows or mapping execution.
- Firebase remains the live Production backend. Supabase remains local-only.
- The 12 Open gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.
- The checked-in Current Baseline and the sixth-slice planning addenda still describe the pre-PR-68 11/9/27 state. Git history and the merged sixth-slice migration prove the current 12/10/26 state; that documentation lag is not approval for a seventh slice and is not broadened into this focused no-go change.

## 3. Remaining-candidate comparison

| Candidate chain | Direct merged dependencies | Remaining blocking contract or gate | Result |
|---|---|---|---|
| `supplier_category_assignments` | `supplier_profiles`, `categories`, migration-control foundation, SUP-003 | Alias/mapping dependency, versioned mapping artifacts, exact assignment lifecycle/enforcement, reviewer ownership, and DDL/test boundary remain separately unapproved | **Smallest apparent candidate; Hard Stop A** |
| `supplier_contacts` | `supplier_profiles`, optional `supplier_locations`, provider-neutral actor root | Contact-person separation, same-Supplier location enforcement, consent, verification, retention, and audience projection under SUP-005/security review remain incomplete | No-go |
| `supplier_capabilities`, `supplier_payment_options` | `supplier_profiles`; categories optionally affect capabilities | Controlled capability vocabulary and `imports_outside_iraq` mapping, or indicative-versus-contractual commercial semantics and lifecycle, remain incomplete | No-go |
| `supplier_ownerships`, `platform_role_assignments`, access ledgers | User/provider and Supplier roots | ID-001, usable-Owner safety, verified-benefit lifecycle, trusted commands, audit, and concurrency enforcement remain incomplete | No-go |
| Supplier submission/import/duplicate chain | Supplier, user, taxonomy/location, and migration-control roots | Review/idempotency, full graph mapping, protected-digest promotion, retention, command, and reconciliation contracts remain incomplete | No-go |
| `audit_logs`, `idempotency_keys`, `domain_events` | Actor and internal-schema roots | AUD-001 blocks audit; idempotency retention and the first consuming trusted command are unselected; no aggregate/event registry and worker contract is authorized for implementation | No-go |
| RFQ, quotation, and notification chain | User, Supplier, taxonomy/location, ownership/eligibility, and reliability roots | ORG-001/002, RFQ-003, FILE-001, MSG-003, ownership/eligibility, trusted-command, and chained-child dependencies remain unresolved | No-go |

All other remaining Core Phase 1 concepts are children in one of those blocked chains. Core Later, Future-Compatible, Deferred, Remove/Merge, and the non-manifest `category_aliases` physical child are outside this seventh-slice review.

## 4. Exact Core Phase 1 exclusions

The 26 remaining Core Phase 1 concepts remain deferred:

`platform_role_assignments`, `access_credits`, `access_grants`, `contribution_logs`, `supplier_contacts`, `supplier_category_assignments`, `supplier_capabilities`, `supplier_payment_options`, `supplier_ownerships`, `supplier_submissions`, `supplier_import_batches`, `supplier_duplicate_fingerprints`, `rfqs`, `rfq_items`, `rfq_attachments`, `rfq_recipients`, `rfq_publish_events`, `quotations`, `quotation_revisions`, `quotation_revision_items`, `quotation_revision_attachments`, `quotation_events`, `notifications`, `audit_logs`, `idempotency_keys`, and `domain_events`.

No SQL migration, pgTAP file, schema object, alias, taxonomy or reference row, mapping artifact execution, seed, import, export, migration, backfill, reconciliation run, or data operation is authorized. RLS, policies, grants, Auth bridge, Firebase integration, hosted Supabase, Production/TEST access or change, application work, Ready status, merge, and deployment also remain excluded.

## 5. Required contract before reconsideration

A later focused review must approve all of the following before another assignment-slice selection:

1. Whether `category_aliases` is a structural prerequisite for empty assignment DDL, and the exact boundary between alias infrastructure, repository mapping artifacts, and assignment rows.
2. The assignment row identity, primary/secondary representation, lifecycle, ordering, provenance, review, correction, supersession, and restrictive-delete contract.
3. Declarative versus trusted-command enforcement for active assignable leaves, duplicate active Supplier/category assignments, at most one active primary assignment, category lifecycle changes, and preservation of historical assignments.
4. The proposer/reviewer/actor ownership model and the zero-API local security boundary without resolving ID-001, RLS, or application permissions.
5. The versioned mapping-manifest, ambiguity/collision, deterministic child-key, zero/one/many, reconciliation, and rollback artifact boundary required before any later data transformation.
6. An explicit owner approval record and a separately reviewed exact SQL/test selection after the contract is approved.

## 6. Validation and stop point

This is a documentation-only hard stop. Validate the verified SHA and PR #68 ancestry, 12 physical tables, 10 implemented / 26 deferred Core Phase 1 concepts, absence of alias/assignment tables, the unchanged 12 Open gates, relative references, documentation-only diff, sensitive-content scan, and `git diff --check`.

Do not start local Supabase, replay migrations, run pgTAP, or run application/repository suites because no SQL or shared executable file is changed.

Exact stop point: Draft PR containing this no-go decision. Stop before SQL or pgTAP implementation, contract approval, Ready status, merge, hosted work, data work, or deployment.

## 7. References

- [`18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md`](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md)
- [`19_FOURTH_SQL_SLICE_CATEGORIES_SELECTION.md`](19_FOURTH_SQL_SLICE_CATEGORIES_SELECTION.md)
- [`25_SIXTH_SQL_SLICE_SUPPLIER_LOCATIONS_SELECTION.md`](25_SIXTH_SQL_SLICE_SUPPLIER_LOCATIONS_SELECTION.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
