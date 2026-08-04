# Core Phase 1 third SQL slice selection

Status: **Historical planning boundary implemented and merged by PR #54; this selection does not authorize any further scope**
Selection date: 4 August 2026
Planning start: `origin/main` `e191a044471a192819d6e029e7e08d7b4d82b6c1`
Primary task profile: Documentation

## 1. Recommendation

The selected smallest Supplier prerequisite is exactly one local-only, synthetic-data-only table, `public.supplier_profiles`. Its implementation evidence is recorded in `16_THIRD_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md`.

This is a schema root for later Supplier child relations, temporal ownership, submissions/imports, duplicate protection, RFQ recipients, and Supplier-linked audit/event facts. It can reference the merged provider-neutral profile key for trusted actors while leaving ownership, categories, locations, contacts, eligibility, browser access, and all data movement out of scope.

This selection did **not** itself authorize SQL implementation. The separately approved implementation task preserved every boundary in section 7; that boundary remains binding for all later work.

## 2. Reconciled current state

Current merged `main` contains three local slices representing seven of the 36 Core Phase 1 logical concepts, with 29 deferred. PR #54 merged the previously selected `supplier_profiles` boundary without expanding it.

| State | Logical concepts | Count |
|---|---|---:|
| Implemented by first local slice | `migration_batches`, `migration_record_mappings` (physically decomposed with source-disposition and merge-member relations), `migration_validation_results`, `import_errors` | 4 |
| Implemented by second local slice | `user_profiles`, `identity_provider_links` | 2 |
| Implemented by third local slice (PR #54) | `supplier_profiles` | 1 |
| Still deferred on merged `main` | Remaining Core Phase 1 concepts | 29 |

This selection began from the merged PR #52 documentation state. PR #54 later implemented only the selected local Supplier root; the authoritative Baseline records the current merged state and does not treat this historical planning record as an implementation authorization.

## 3. Remaining dependency chains

| Chain | Remaining Core Phase 1 concepts | Dependency position | Selection result |
|---|---|---|---|
| Access and trial | `platform_role_assignments`, `access_credits`, `access_grants`, `contribution_logs` | Requires the merged profile root; roles also require the complete usable-Owner, grant, command, audit/security, and concurrency contract. | Defer. |
| Supplier and ownership | `supplier_profiles`, `supplier_locations`, `supplier_contacts`, `supplier_category_assignments`, `supplier_capabilities`, `supplier_payment_options`, `supplier_ownerships`, `supplier_submissions`, `supplier_import_batches`, `supplier_duplicate_fingerprints` | `supplier_profiles` is the root. Categories/areas precede mapped child data; ownership, submissions, fingerprints, and eligibility require additional trusted contracts. | Select only the root profile. |
| Procurement, notification, and reference data | `rfqs`, `rfq_items`, `rfq_attachments`, `rfq_recipients`, `rfq_publish_events`, `quotations`, `quotation_revisions`, `quotation_revision_items`, `quotation_revision_attachments`, `quotation_events`, `notifications`, `categories`, `administrative_areas` | Needs Supplier graph, trusted commands, and, where applicable, approved taxonomy/area, price, file, and notification contracts. | Defer. |
| Audit, actor, and event foundations | `audit_logs`, `idempotency_keys`, `domain_events` | Can use merged profile actors, but audit retention and trusted command/aggregate contracts are not ready. | Defer. |

## 4. Candidate comparison

Risk and size use Low as safer/smaller. Migration usefulness is higher when the empty local schema creates a stable future dependency without requiring data movement.

| Candidate | Dependency readiness | Open-gate position | Auth / future RLS | Rollback and migration usefulness | Production and implementation risk | Result |
|---|---|---|---|---|---|---|
| **A. `supplier_profiles` only** | **Ready:** trusted actor FKs can use `user_profiles`; organization remains nullable; no Supplier child table is required. | No gate is silently resolved. ID-001 and ORG-001/ORG-002 are deferred; SUP-003/SUP-004 are not represented. | No Auth bridge. Keep the table unreachable to API roles; RLS remains a later security task. | High value as the Supplier root; one empty local table is simple to reset or drop locally. | Low with synthetic-only tests and no data; Medium review attention because Supplier data is sensitive. One table. | **Recommend.** |
| B. Access/trial ledgers: `access_credits`, `access_grants`, `contribution_logs` | Profile beneficiary FK is ready, but credit/grant/contribution provenance forms a coupled ledger and grants have a future role-assignment/audit relationship. | ID-001 is deferred only for inert DDL, but verification-triggered grants and the Owner administration grant are not safe without their later contracts. | Strong future Auth and RLS consequences; creates entitlement-shaped records before trusted commands exist. | Useful later, but rollback and correction semantics must be designed as a unit. | Medium size and rework risk. | Defer. |
| C. Supplier plus ownership foundation | Profile actors are ready, but ownership requires Supplier root, two-way legacy ownership reconciliation, eligibility, and trusted mutation/audit/event contracts. Supplier children need taxonomy/area roots. | SUP-003 and SUP-004 block mapped categories/locations; ID-001 blocks verified identity integration; AUD-001 blocks audit migration. | High future RLS/authorization sensitivity. | High strategic value but not a reversible small slice. | High data and review risk; many tables. | Defer; do not add ownership to A. |
| D. Audit/actor/event foundation: `audit_logs`, `idempotency_keys`, `domain_events` | Profile actor FK is ready, but no consuming trusted command or aggregate contract exists. | AUD-001 blocks `audit_logs`; REL-001 remains a recommended delivery design, not an implementation contract. | No immediate Auth bridge, but future RLS and trusted-worker boundaries are material. | Internal placement is reversible while empty, but event types/scopes would be speculative. | Medium size; premature durable-history semantics. | Defer. |
| E. Reference roots: `categories` and/or `administrative_areas` | Structurally independent, but no approved hierarchy, codes, labels, depth, mapping, or exception contract is available. | SUP-003 blocks categories; SUP-004 blocks administrative areas. | No Auth effect; later directory projection is security-sensitive. | Empty tables would provide little value and prematurely freeze an unresolved vocabulary. | Small SQL, high decision/rework risk. | No-go until the respective gate is approved. |

## 5. Exact boundary

### Included table

- `public.supplier_profiles`

The table is a provider- and organization-independent canonical Supplier business profile. The implementation branch uses the existing `public.user_profiles` UUID only for nullable trusted creation/update actor references. It adds no ownership, member, category, area, contact, capability, payment, product, document, submission, duplicate, eligibility, RLS, policy, privilege, trigger, function, view, RPC, API, Auth, or data behavior.

### Exact Core Phase 1 exclusions

The following 29 remaining Core Phase 1 concepts are excluded from the proposed implementation:

- `platform_role_assignments`
- `access_credits`, `access_grants`, `contribution_logs`
- `supplier_locations`, `supplier_contacts`, `supplier_category_assignments`, `supplier_capabilities`, `supplier_payment_options`, `supplier_ownerships`, `supplier_submissions`, `supplier_import_batches`, `supplier_duplicate_fingerprints`
- `rfqs`, `rfq_items`, `rfq_attachments`, `rfq_recipients`, `rfq_publish_events`
- `quotations`, `quotation_revisions`, `quotation_revision_items`, `quotation_revision_attachments`, `quotation_events`
- `notifications`, `categories`, `administrative_areas`
- `audit_logs`, `idempotency_keys`, `domain_events`

All 43 non-Core-Phase-1 concepts remain excluded without reclassification: the 10 Core Later concepts, 13 Future-Compatible concepts, 13 Deferred concepts, and 7 Remove/Merge concepts in the authoritative phase manifest. In particular, do not create organizations, memberships, invitations, Supplier claims/memberships/products/documents, messaging, files, billing, security events, or any Remove/Merge relation.

## 6. Dependencies and blockers

### Already satisfied

- The local UUIDv4 convention from DB-001 is implemented.
- `internal.migration_batches`, migration dispositions/mappings, validation results, and import errors provide the existing declarative traceability boundary.
- `public.user_profiles` provides the provider-neutral application actor key.
- `internal.identity_provider_links` preserves provider subjects separately from profile keys; Firebase Auth remains authoritative and unchanged.
- The merged identity slice proves the local-only, synthetic-data-only, zero-API-access pattern.

### Remaining blockers and Open gates

All fourteen approval gates remain Open: `ID-001`, `ORG-001`, `ORG-002`, `SUP-003`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

For this narrow table, none is a required decision for empty local DDL:

- **ID-001** remains deferred: no Firebase validation, verification refresh, Auth authority, session, role, access benefit, or data migration is introduced.
- **ORG-001/ORG-002** remain deferred: organization linkage stays absent/nullable and no organization or membership is created.
- **SUP-003/SUP-004** remain deferred: no category assignment, taxonomy, location, coverage, or reference table is introduced.
- **AUD-001** remains deferred: no audit row, audit table, or mandatory audit command is introduced.
- **RES-001/MIG-002** remain deferred: the slice stays local-only and no hosted project, remote SQL, environment promotion, or Production action is allowed.

The other gates do not apply to the selected table, but remain Open and block their registered later phases.

## 7. Implemented boundary and continuing stop conditions

The merged PR #54 implementation contains one new migration for `public.supplier_profiles`, one focused synthetic pgTAP file, and the minimum direct evidence/status updates. It proves the exact table contract, UUID default, bounded fields and status checks, nullable/restricting actor references, uniqueness for a non-null legacy Supplier ID, zero API-role privileges, no RLS/policy/function/trigger/view/RPC, and compatibility with the existing migration mapping contract. The local stack remained stopped after verification.

Stop immediately, with no scope expansion, if any of these occurs:

- the current `main` or authoritative design materially changes;
- an implementation needs an ownership, category, area, contact, eligibility, organization, access, audit, event, RLS, Auth, browser/API, function, trigger, or data contract;
- zero API access cannot be proved without adding grants or RLS;
- any Open approval gate would need to be resolved or weakened implicitly;
- Firebase, a hosted Supabase project, remote SQL, Production/TEST data, an import/export/seed/backfill, or deployment becomes necessary;
- the selected table cannot remain empty except for synthetic local test rows.

## 8. Why this is safer

`supplier_profiles` is the first remaining real domain root whose prerequisite—the provider-neutral actor key—is now merged. Unlike the access ledgers, it does not force a verified-benefit lifecycle or the complete usable-Owner predicate. Unlike Supplier ownership and children, it does not encode mapping, custody, duplicate, or authorization decisions that are still gated. Unlike audit/event tables, it does not invent durable command scopes, retention, or event payloads. Its empty local schema gains a stable FK destination for later work while retaining an uncomplicated local rollback and no Production or Auth consequence.

## 9. Stop point

This document selected only the one-table local planning boundary now merged by PR #54. That implementation adds no RLS, policy, grant, Auth bridge, provider integration, application code, hosted Supabase linkage, Firebase access/change, data operation, or deployment. Await explicit approval before any later Supplier SQL, ownership, access, integration, migration, or deployment work.
