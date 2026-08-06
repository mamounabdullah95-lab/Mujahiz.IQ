# Core Phase 1 sixth SQL slice selection

Status: **Verified no-go; no sixth SQL migration is selected**
Selection date: 6 August 2026
Verified start: `origin/main` `dafa6c3e2777f70a4d0d49ee0a12bf337b7b1200`
Primary task profile: Documentation

## 1. Recommendation

Do not implement a sixth SQL slice. The smallest apparent candidate, `supplier_locations`, is not yet dependency-safe even though its parent roots are merged.

The exact blocker is the still-unreviewed `supplier_locations` slice contract required by the approved SUP-004 record: its DDL boundary, trusted mapping artifacts, contact dependency, and access/projection constraints must be separately reviewed before selection. This is not a resolution of an Open gate and this document does not create one.

The next task is a bounded Supplier-location contract review led by the applicable Product/Data and Product/Security owners. It must decide only the empty local table boundary and must not authorize reference-data population, Firebase transformation, Supplier data movement, RLS, or client access.

## 2. Verified current state

Merged PR #62 is contained in `origin/main`. It adds `public.administrative_areas` through `20260805000200_administrative_areas_foundation.sql`.

The local SQL foundation now contains 11 physical tables representing 9 implemented Core Phase 1 concepts, with 27 of 36 deferred.

The 12 Open approval gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

Firebase remains the live Production backend. Supabase remains local-only.

## 3. Candidate comparison

| Candidate | Direct merged dependencies | Remaining blocking contract or gate | Decision |
|---|---|---|---|
| `supplier_locations` | `supplier_profiles`, `administrative_areas`, provider-neutral actor root, and SUP-004 | A separately reviewed DDL boundary, trusted mapping artifacts, contact dependency, and access/projection constraints are required. | **No-go** |
| `supplier_category_assignments` | `supplier_profiles`, `categories`, and SUP-003 | Alias/mapping workflow, assignment enforcement, and transformation evidence remain unselected. | No-go |
| `supplier_contacts`, `supplier_capabilities`, `supplier_payment_options` | Supplier root | SUP-005 audience/contact model, controlled capability vocabulary, or commercial-semantic boundary remains incomplete. | No-go |
| `platform_role_assignments`, access ledgers | User/provider roots | ID-001, usable-Owner safety, verified-benefit lifecycle, trusted command, audit, and concurrency contracts remain unimplemented. | No-go |
| Supplier submission/import/duplicate relations | Supplier, user, and migration-control roots | Trusted review/idempotency, protected-digest, retention, and command contracts remain incomplete. | No-go |
| `audit_logs`, `idempotency_keys`, `domain_events` | Actor and internal-schema roots | AUD-001 blocks audit; no consuming trusted-command or aggregate contract exists for the other two. | No-go |
| RFQ, quotation, and notification chain | User and Supplier roots | Organization, eligibility/ownership, RFQ-003, FILE-001, MSG-003, and chained-child dependencies remain unresolved. | No-go |

All other remaining Core Phase 1 concepts are children of one of these blocked chains. Core Later, Future-Compatible, Deferred, and Remove/Merge concepts are outside this review.

## 4. Exact boundary and exclusions

No SQL migration, pgTAP test, schema object, reference row, or data operation is authorized. All 27 deferred Core Phase 1 concepts remain excluded, as do RLS, policies, privileges, Auth, Firebase, hosted Supabase, migration, seed, backfill, reference-data population, Production/TEST data actions, deployment, merge, and readiness actions.

## 5. Stop point

Stop at the Draft PR for this documentation-only no-go decision. Do not implement a sixth slice. Resume only after a separately reviewed Supplier-location contract supplies the missing boundary and evidence, or after a different remaining Core Phase 1 candidate gains an equivalent complete contract without resolving an Open gate implicitly.

## 6. References

- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`](21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md)
- [`22_FIFTH_SQL_SLICE_ADMINISTRATIVE_AREAS_SELECTION.md`](22_FIFTH_SQL_SLICE_ADMINISTRATIVE_AREAS_SELECTION.md)
