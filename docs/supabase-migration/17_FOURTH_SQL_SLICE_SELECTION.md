# Core Phase 1 fourth SQL slice selection

Status: **Verified no-go; no fourth SQL migration is selected**
Selection date: 4 August 2026
Verified start: `origin/main` `d034cfd8bf3efdc74155f4f3aff4a6f95386a9cb`
Primary task profile: Documentation

## 1. Decision

Do not implement a fourth SQL slice yet. No remaining Core Phase 1 table is both smaller than a coupled chain and free of an unapproved required contract. An empty local table would still prematurely fix a taxonomy, area, contact/privacy, capability, commercial, ownership/eligibility, audit, Auth/access, or trusted-command boundary.

The next task is an approval task, not SQL implementation. Resolve the smallest decision gate that supplies a complete contract for a later table; the leading prerequisite is **SUP-003 or SUP-004**, but neither is selected or resolved by this document.

## 2. Verified phase snapshot

The three merged local SQL migrations create nine physical tables in this applied dependency order:

| Migration / order | Physical tables | Dependency position |
|---|---|---|
| `20260804000136_migration_control_foundation` | `internal.migration_batches` | migration-control root |
| same | `internal.migration_source_dispositions` | requires migration batch |
| same | `internal.migration_record_mappings` | requires batch and source disposition |
| same | `internal.migration_merge_group_members` | requires disposition and mapping |
| same | `internal.migration_validation_results` | requires migration batch |
| same | `internal.import_errors` | requires migration batch and optional source disposition |
| `20260804000200_provider_neutral_identity_foundation` | `public.user_profiles` | provider-neutral application actor root; self-restricting actor references only |
| same | `internal.identity_provider_links` | requires user profile and optional migration batch |
| `20260804000300_supplier_profile_foundation` | `public.supplier_profiles` | requires optional trusted user-profile actors; independent of organization and Auth |

The first six physical tables represent four Core Phase 1 logical concepts because `migration_record_mappings` is physically decomposed into source dispositions, shared target mappings, and merge-group members. Together with `user_profiles`, `identity_provider_links`, and `supplier_profiles`, this is **7 implemented + 29 deferred = 36 Core Phase 1 concepts**.

All fourteen approval gates remain Open: `ID-001`, `ORG-001`, `ORG-002`, `SUP-003`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

No merged migration creates RLS, a policy, grant, browser/API access, Auth bridge or Auth user, hosted operation, data migration, seed, backfill, or Production change. Firebase remains the live Production backend and Auth authority; Supabase remains local-only and synthetic-data-only.

## 3. Candidate comparison

| Candidate | Dependencies already satisfied | Unresolved approval / contract | Auth and future RLS implications | Rollback value, size, and rework risk | Decision |
|---|---|---|---|---|---|
| Reference roots: `categories` | Structurally independent; Supplier root exists. | `SUP-003` leaves hierarchy, codes, labels, aliases, mapping, and exception path unapproved. | Future directory projection is security-sensitive; no access projection is approved. | One empty table, but high taxonomy rework and little migration value. | No-go. |
| Reference roots: `administrative_areas` | Structurally independent; Supplier root exists. | `SUP-004` leaves hierarchy depth, coverage mapping, bounded non-area codes, and exceptions unapproved. | Later location/directory projection remains unapproved. | One empty table, but high mapping rework and little migration value. | No-go. |
| Supplier children: `supplier_locations`, `supplier_category_assignments` | `supplier_profiles` exists. | Respectively blocked by `SUP-004` and `SUP-003`. | Field-level directory exposure is later RLS/projection work. | Small tables cannot be correct without their reference roots; high rework. | No-go. |
| Supplier profile detail: `supplier_contacts`, `supplier_capabilities`, `supplier_payment_options` | Supplier root exists. | Contacts require unresolved contact-person/consent/retention and audience rules; capabilities require a controlled-vocabulary boundary; payment options leave indicative-versus-contractual meaning unresolved. | PII and Buyer-visible commercial data require a later approved access projection; Firebase identity does not authorize it. | Each is small, but an empty table would freeze sensitive or commercial semantics before approval. | No-go. |
| Supplier ownership and claim prerequisites: `supplier_ownerships` and related claim/membership work | Supplier and user roots exist. | Requires two-way ownership reconciliation, eligibility, trusted mutation, audit/event facts, and `ID-001`; Claim is Core Later and membership is Future-Compatible. | High authorization/RLS impact; verified identity must remain Firebase-authoritative. | Multi-table, high-consequence history; not reversible as an isolated semantic decision. | No-go. |
| Supplier submission, import, and duplicate foundations: `supplier_submissions`, `supplier_import_batches`, `supplier_duplicate_fingerprints` | Actor, Supplier, and migration-control roots exist. | Require idempotency, review, immutable payload, exact/fuzzy duplicate, retention, and trusted command contracts; imports must not become a data operation. | Restricted data and server-only fingerprint boundary need the future authorization design. | Coupled tables with high migration/replay rework; no value while empty. | No-go. |
| Access/trial: `platform_role_assignments`, `access_credits`, `access_grants`, `contribution_logs` | User root and provider-link shape exist. | `ID-001` and the complete usable-Owner, verified-benefit, grant, audit, and concurrency contracts remain unimplemented. | Directly coupled to Firebase verification/disablement and future RLS. | Ledger correction semantics must be designed as a unit; medium-to-high rework. | No-go. |
| Audit, event, and idempotency: `audit_logs`, `idempotency_keys`, `domain_events` | Actor root and internal schema pattern exist. | `AUD-001` blocks audit retention; no trusted command or aggregate contract exists for idempotency/outbox scopes. | Trusted-server-only boundary and future worker/RLS separation are material. | Empty internals are physically reversible but would speculate durable history/payload rules. | No-go. |
| Procurement/RFQ: `rfqs` through `quotation_events`, plus `notifications` | User and Supplier roots exist. | Needs organizations/party rules, Supplier eligibility/ownership, `RFQ-003`, `FILE-001`, and `MSG-003`; chained child tables have no independent safe root. | Strong Buyer/Supplier privacy and future RLS requirements. | Largest coupled chain and highest data/rollback risk. | No-go. |

## 4. Exact boundary

### Included tables

None. This selection authorizes no SQL, pgTAP, local-stack, or data work.

### Exact Core Phase 1 exclusions

All 29 deferred Core Phase 1 concepts remain excluded:

- `platform_role_assignments`, `access_credits`, `access_grants`, `contribution_logs`
- `supplier_locations`, `supplier_contacts`, `supplier_category_assignments`, `supplier_capabilities`, `supplier_payment_options`, `supplier_ownerships`, `supplier_submissions`, `supplier_import_batches`, `supplier_duplicate_fingerprints`
- `rfqs`, `rfq_items`, `rfq_attachments`, `rfq_recipients`, `rfq_publish_events`
- `quotations`, `quotation_revisions`, `quotation_revision_items`, `quotation_revision_attachments`, `quotation_events`
- `notifications`, `categories`, `administrative_areas`
- `audit_logs`, `idempotency_keys`, `domain_events`

The 43 non-Core-Phase-1 concepts remain excluded without reclassification: all 10 Core Later, 13 Future-Compatible, 13 Deferred, and 7 Remove/Merge concepts.

## 5. Satisfied dependencies, blockers, and future boundary

Already satisfied: local UUIDv4 convention; migration-control/traceability tables; provider-neutral user keys and provider-subject separation; an organization- and Auth-independent Supplier root; and proven zero-API-access local schema boundaries.

Still blocked: all fourteen Open gates above. In particular, `SUP-003` and `SUP-004` block reference data and mapped Supplier children; `ID-001` blocks verified identity and access integration; `AUD-001` blocks audit migration; `RFQ-003`, `FILE-001`, and `MSG-003` block procurement/notification contracts; `RES-001` and `MIG-002` prohibit hosted work.

Any future implementation must remain empty, local-only, synthetic-data-only, and inaccessible to API roles until a separately approved SQL-slice selection defines a complete table contract. It must not add RLS, policy, privileges, Auth integration, browser/API access, hosted linkage, remote SQL, application integration, seed, migration, import/export, backfill, or Production/TEST data work.

## 6. Stop conditions and recommended implementation mode

Stop without SQL implementation if a proposed table needs an unapproved taxonomy, area, ownership, organization, eligibility, audit, Auth, access, trusted-command, or retention contract; if any Open gate would be silently resolved; or if local-only, empty, synthetic, and API-inaccessible operation cannot be preserved.

After an explicit gate approval and a new focused selection, use **Terra with High reasoning** for the isolated implementation task. Do not begin implementation from this no-go record.

## 7. Reconciliation note

This review found and corrects direct stale-state wording in the prior third-slice selection/evidence: PR #54 is merged, so merged `main` has 7 implemented and 29 deferred Core Phase 1 concepts. It also corrects the authoritative Baseline's current-`main` SHA to the verified `origin/main` start SHA above. No completed independent review was repeated; no other conflict was found among the design, decision register, checklist, implementation evidence, and merged migrations.
