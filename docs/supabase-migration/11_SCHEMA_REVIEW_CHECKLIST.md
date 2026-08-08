# Mujahiz IQ PostgreSQL Schema Review Checklist

Status: Reviewer gate for documentation only
Baseline: `origin/main` at `25536e09d84adac950023e5903c855cbf847b236`
Review together: `09_POSTGRESQL_SCHEMA_DESIGN.md` and `10_SCHEMA_DECISION_REGISTER.md`
Checklist items: 119

Check an item only when the cited design is explicit and evidence supports it. Record disagreements as stable decision IDs or review comments; do not resolve ambiguity by implementing SQL.

## A. Scope and evidence

- [ ] The work contains only the three requested Markdown documents.
- [ ] The design is based on exact SHA `1a4e5a59a37b2f1eb05d5cf8fa555d8f7dfe84d6`.
- [ ] Current Firestore collections, Functions, services, rules, indexes, tests, migration docs, and exact verified counts were inspected.
- [ ] Controlled TEST RFQ/quotation data is distinguished from Production and mixed audit/notification classifications.
- [ ] GitHub-only ownership-claim code is not described as deployed.
- [ ] Empty collections and future tables are not described as implemented or populated.
- [ ] Every asserted invariant is either evidenced, recommended, or explicitly Open/Deferred.
- [ ] The phase manifest lists all 79 proposed tables exactly once and reconciles Core Phase 1 36, Core Later 10, Future-Compatible 13, Deferred 13, and Remove/Merge 7; `supplier_ownership_claims` remains authoritative but is Core Later, not in the initial slice.
- [ ] Future-Compatible and Deferred entries explicitly say "do not create yet," and every Remove/Merge entry identifies its replacement.
- [ ] All 36 decision IDs have one canonical topic/status across design, register, checklist, and cross-references; resolution date, evidence/reference, and resolved state fields are present.
- [ ] ID-001, ORG-001, ORG-002, RFQ-003, MSG-002, MSG-003, SEARCH-001, FILE-001, BILL-001, AUD-001, RES-001, and MIG-002 remain Open approval gates; SUP-003 and SUP-004 are Approved, and DB-001 is resolved for the implemented local SQL slices only.
### Second SQL-slice implementation evidence

- [x] Local implementation branch adds exactly public.user_profiles and internal.identity_provider_links in migration 20260804000200; no third identity/access table, RLS, policy, Auth bridge, browser/API grant, hosted operation, or data operation is included.
- [x] Synthetic focused pgTAP covers accepted/rejected profile and provider-link states, Firebase text-subject traceability, active uniqueness, lifecycle coherence, RESTRICT delete behavior, migration-control compatibility, and absent API access; the focused result is 78/78 and the complete local suite is 138/138.
- [x] Local warning-level lint and catalog checks verify expected constraints/indexes and zero application triggers, functions, policies, and direct anon/authenticated/service API table privileges.
- [ ] ID-001, MIG-002, RES-001, and every other listed Open gate remain unresolved; Firebase Auth remains authoritative and a later trusted validation/reconciliation phase is required before integration.

### Third SQL-slice implementation evidence

- [x] Local implementation branch adds exactly `public.supplier_profiles` in migration `20260804000300`; no Supplier child, ownership, organization, eligibility, Auth, RLS, policy, browser/API grant, hosted operation, or data operation is included.
- [x] Synthetic focused pgTAP covers the Supplier root shape, UUID default, bounded bilingual names and lifecycle/provenance values, nullable/restricting actor references, legacy-ID uniqueness, migration-control compatibility, deferred-table absence, and absent API access; the focused result is 84/84 and the complete local suite is 222/222.
- [x] Local warning-level lint and catalog checks verify expected constraints/indexes and zero application triggers, functions, policies, and direct anon/authenticated/service API table privileges.
- [ ] At the third-slice merge, ID-001, ORG-001, ORG-002, SUP-003, SUP-004, MIG-002, RES-001, and every other listed Open gate remained unresolved; Firebase Auth remained authoritative and Supplier ownership/RLS/Auth work remained a later separately approved phase.
### Fourth SQL-slice implementation evidence

- [x] Merged PR #59 adds exactly `public.categories` in migration `20260805000100`; no taxonomy vocabulary, alias, Supplier assignment, RLS, policy, browser/API grant, hosted operation, or data operation is included.
- [x] The focused synthetic pgTAP contract covers table shape, UUIDv4, depth/type/leaf and archive boundaries, bilingual collision indexes, lifecycle/replacement state combinations, nullable/restricting actors, migration-control compatibility, deferred-table absence, and absent API access.
- [x] Clean local reset applied all four migrations; focused synthetic pgTAP passed 118/118, complete local pgTAP passed 340/340, warning-level lint found no schema errors, and catalog checks confirmed 26 columns, 27 named constraints, 13 exact indexes, five exact RESTRICT FKs, zero API/RLS/policy/trigger/routine/view access objects, one table, and zero taxonomy rows.
- [ ] `SUP-003` and `SUP-004` are Approved; `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002` remain Open. Merged PR #62 adds `public.administrative_areas`; `main` is 12 implemented / 24 deferred across 14 physical tables.

### Sixth SQL-slice planning decision (not part of the 119 design-review items)

- [x] Verified `origin/main` `11f78fa23a7254a7a3f48e21830ba13fee9bbcfb` contains merged PR #66 and its reviewed Supplier-location contract head `b69988fcbd0e899eeb57c75b4372811c81f2f4d2`.
- [x] Option A is selected: a later implementation may create exactly one empty `public.supplier_locations` table plus its own declarative enforcement, structural indexes, comments, privilege revocations, and disposable synthetic pgTAP coverage.
- [x] The selected row contract provides UUIDv4 identity, restrictive Supplier/area/actor relationships, physical-versus-coverage classification, bounded address/map evidence, mapping/source/review provenance, lifecycle, active uniqueness, and archive/no-normal-hard-delete semantics.
- [x] Contacts remain a later dependency on locations through nullable `supplier_contacts.location_id`; branch phone evidence is neither copied into the location row nor discarded, and no contact table or FK from locations is selected.
- [x] Mapping manifests, precedence/deduplication rules, collision/exception reports, reconciliation, and rollback artifacts are mandatory before future data transformation but do not block an empty local table.
- [x] Base rows remain non-public and revoked from API roles; RLS, policies, projections, Auth, organizations, RFQ logic, search ranking, audit/event routines, hosted Supabase, Firebase access, data movement, and Production behavior remain excluded.
- [x] At the sixth-slice selection point the count was 11 physical / 9 implemented / 27 deferred. PR #68 moved that historical state to 12 / 10 / 26; merged PR #73 and PR #75 later moved the verified current state to 14 / 12 / 24. The 12 gates remain Open.

### Supplier-category assignment contract review (not part of the 119 design-review items)

- [x] Historical contract review started from `origin/main` `a28229a6171c5ab7f13dd2c06fbbef769726b82b` with 12 physical / 10 implemented / 26 deferred; merged PR #73 at current `origin/main` `cb51da7267f3fa61af9d35ade66890f096f2c51a` now implements the selected assignment boundary at 13 / 11 / 25.
- [x] The approved assignment meaning is one reviewed temporal Supplier/category classification with `primary`/`secondary` role, unique active Supplier/category identity, at most one active primary, and exactly one primary after a trusted mutation leaves a non-empty active set.
- [x] Legacy array order never selects primary; broad-only, ambiguous, global `other`, unmapped, and rejected evidence creates no canonical assignment row.
- [x] `category_aliases` is not a prerequisite for empty assignment DDL, but any alias-based transformation requires the alias relation to be separately authorized, implemented, populated, and collision-reviewed first.
- [x] Provenance, lifecycle, reviewer/owner responsibility, declarative-versus-trusted enforcement, category deprecation behavior, transformation evidence, and future field-minimized projection constraints are explicit.
- [x] Merged PR #73 implements the selected one empty, revoked, local-only assignment table plus structural enforcement and disposable synthetic pgTAP; no alias table, rows, mapping execution, RLS, Auth, application access, hosted work, Firebase, or Production behavior is included.
- [x] On 6 August 2026, the founder-led Product/Data Owner explicitly approved Option B and the complete `27_SUPPLIER_CATEGORY_ASSIGNMENT_PRODUCT_AND_DATA_CONTRACT.md` as written.
- [x] The same owner decision selected the exact seventh-slice SQL/test boundary; merged PR #73 implemented it without scope expansion. Current state is 14 physical / 12 implemented / 24 deferred.
- [x] SUP-003 was already Resolved and remains closed. All 12 Open gates remain unresolved and unchanged; this contract approval neither closes nor weakens any of them.

### Supplier capabilities and payment-options contract review (not part of the 119 design-review items)

- [x] Verified current `origin/main` `25536e09d84adac950023e5903c855cbf847b236`, merged PR #73 and PR #75 lineage, 14 physical tables, 12 implemented / 24 deferred Core Phase 1 concepts, and 12 unchanged Open gates.
- [x] Capability and payment assertions remain separate from categories, locations/coverage, RFQ/quotation terms, platform billing, eligibility, and contractual acceptance.
- [x] `imports_outside_iraq` has one positive capability meaning and creates no geographic row; `import_only` remains pending rather than being silently equated.
- [x] Controlled and custom capabilities have mutually exclusive shapes, reviewed moderation, versioned normalization, category-scope rules, semantic duplicate prevention, and historical lifecycle.
- [x] Payment methods, currencies, credit terms, and advance payment use distinct type-specific semantics; cash/bank transfer/cheque/LC, ISO currencies, explicit no-credit, days/start, and advance percentages do not imply one another.
- [x] Supplier payment options are recommended as indicative profile assertions; quotations/contracts independently snapshot accepted terms. RFQ-003 and BILL-001 remain Open and separate.
- [x] Mixed current Firebase values, `official_invoice`, credit contradictions, free text, unknowns, and unmapped values have explicit lossless routing or review outcomes.
- [x] Provenance, lifecycle, reviewer/owner responsibility, type-specific uniqueness, future field-minimized projection boundaries, and the complete pre-migration evidence package are explicit.
- [x] On 7 August 2026, the Product/Data Owner approved the capability contract and selected exactly one future empty local-only `public.supplier_capabilities` table as the eighth SQL slice; both tables together remain rejected as the smallest slice.
- [x] The owner decision approves `imports_outside_iraq`, excludes unresolved `import_only`, permits controlled/reviewed-custom capabilities with optional category scope, makes capabilities indicative, limits a future public projection to approved active labels, restricts evidence/reviewer data, and routes `official_invoice` to documentary capability.
- [x] `public.supplier_payment_options` remains deferred; its detailed semantics, mappings, audience, DDL, and tests are not approved by this decision.
- [ ] A separate implementation-selection task has fixed and authorized the exact capability DDL/pgTAP boundary. This documentation task includes no SQL, data, RLS, Auth, hosted, Firebase, Production/TEST, merge, or deployment work.

## B. Relational model and integrity

- [ ] Every proposed table concept has a clear logical purpose/catalog entry and exactly one phase disposition; Remove/Merge entries are not mistaken for tables to create.
- [ ] `legacy_firestore_id` is required for directly migrated root/event rows, nullable for new and normalized-child rows, preserved as an alternate key when present, and never reused blindly as the relational PK.
- [ ] Arrays/maps used for relationships are normalized into child/join tables.
- [ ] JSONB is limited to bounded/versioned snapshots or flexible metadata that does not require relational filtering or integrity.
- [ ] Exact numerics are specified for money/quantities; floats are rejected.
- [ ] Timestamp, locale, URL, normalized-identifier, and status conventions are consistent.
- [ ] Derived quality/search/aggregate/access fields have one canonical source or are explicitly versioned trusted projections with invalidation, recomputation, reason, and reconciliation contracts.
- [ ] Foreign-key delete behavior defaults to restrict; cascades are limited to unpublished drafts/disposable preferences.
- [ ] Immutability, supersession, and archive semantics are unambiguous for historical rows.
- [ ] Every required trusted command contract names authoritative inputs, actor/authorization, locks/reads, transaction, idempotency, validation, outputs, audit, events/notices, failure, compensation, and browser/server authority.

## C. Identity, organization, and authorization readiness

- [ ] Application user UUID is separated from provider subject/Firebase UID under ID-002.
- [ ] Authentication authority and migration duration remain Open under ID-001; Stage 1 idempotently bootstraps an unverified Firebase profile/link with current account context and no verified-only benefit, while Stage 2 refreshes Firebase-authoritative verification/disablement and grants the first verified trial/access benefit at most once.
- [ ] Platform Owner/Admin assignments follow ID-003: temporal, trusted-only, one effective active role absent reviewed exception, and Owner/Admin incompatible.
- [ ] The usable-Owner predicate requires an active profile, approved account status, compatible current account context, active Firebase link, Firebase-verified/non-disabled identity, active Owner assignment, valid trusted administration access, and all repository-backed trusted-admin/security eligibility conditions.
- [ ] Provider unlink/disable, verification loss/mirror correction, profile suspension, account-status/context change, role demotion/removal/expiry, access revocation/correction/expiry, identity disablement, and future eligibility corrections all serialize on and re-evaluate the complete usable-Owner set.
- [ ] Direct commands and background expiry/correction/reconciliation jobs share the same locks, fail-closed postcondition, audit/security outcome, compensation, and recovery contract; the role-backed Owner administration grant is non-expiring while usable authority is held, so expiry cannot silently strand administration.
- [ ] ORG-001/ORG-002 keep organization linkage nullable/deferred; current users and 480 Suppliers migrate without fabricated organizations or inferred memberships.
- [ ] Free-text organization/sector, legacy role, `accountType`, and Buyer/Supplier context remain restricted migration evidence through bootstrap.
- [ ] Supplier verified ownership is separate from future operational Supplier membership, and current Supplier profiles exist independently of both organization and membership rows.
- [ ] Active-row uniqueness is explicit for provider links, organization memberships, Supplier ownerships, and Supplier memberships.
- [ ] Authorization never relies on cached display names, client-supplied role, email, or object key.
- [ ] Owner/Admin/support access is not assumed without an explicit policy.
- [ ] `can_receive_rfqs` has exact derivation inputs, policy version, invalidation-to-false behavior, reason codes, recomputation triggers, timestamp, and reconciliation path.
- [ ] The future RLS PR is classified Extra High Security and requires positive and negative tests.
- [ ] No client-accessible table can ship before its RLS and trusted-operation design is approved.

## D. Supplier integrity and duplicate prevention

- [ ] Base Supplier tables are non-public; approved audiences use field-minimized security-invoker view/RPC projections, and anonymous exposure is a future approval.
- [ ] Supplier profile, contacts, locations/coverage, category assignments, capabilities, payment options, products, and documents have distinct visibility/retention rules.
- [ ] Physical locations and service coverage are distinguishable; area FK is conditional; original text/exceptions are retained; `all_iraq` is a bounded non-area coverage value; and `imports_outside_iraq` belongs to Supplier capabilities, not administrative areas or service coverage.
- [ ] One-active-primary-owner and current one-profile-per-owner constraints are represented without blocking future memberships.
- [ ] Claim creation, expiry, approval, rejection, withdrawal, supersession, transfer, and revoke history remains in the authoritative Core Later design; zero Production rows and undeployed GitHub-only behavior do not require a Core Phase 1 Claim table.
- [ ] Claim evidence is merged as bounded immutable private Claim metadata/snapshot with the controlled pre-FILE-001 reference rules; `supplier_ownership_claim_evidence` and `supplier_ownership_events` are not created.
- [ ] Approval revalidates current Auth/app eligibility, current canonical owner, and claimant lock within one trusted operation.
- [ ] Exact duplicate fingerprints are protected, key/normalizer-versioned, trusted-only, unique while active, and promoted from pending to approved atomically.
- [ ] Fuzzy duplicate candidates use versioned normalized names, bounded Dice/equivalent lookup, area/category/supporting evidence, a review queue, and never auto-merge/delete.
- [ ] `supplierDuplicateIndex`, canonical uniqueness, and submission duplicate guards map to one coherent relational design.
- [ ] Supplier import keeps safe metadata and row results but never persists the raw workbook by default.
- [ ] Submission approval atomically writes Supplier graph, review state, contribution/access ledgers, temporal ownership where justified, audit, and a domain event; only the worker creates notifications.
- [ ] SUP-003 category and SUP-004 address/coverage mappings define explicit exception paths rather than inventing values.

## E. RFQ, quotation, and Buyer privacy

- [ ] RFQ-001 preserves transitional Buyer creator/context while organization linkage is Open; publication still fixes an auditable Supplier recipient set.
- [ ] Recipient visibility and quotation authorization are anchored to exactly one `rfq_recipients` row, not owner UID arrays or duplicated RFQ/Supplier fields.
- [ ] A Supplier can access only its recipient/quotation; a Buyer can access only its own transitional or future organization party RFQs; competitors cannot read each other.
- [ ] One canonical quotation per `rfq_recipient_id` is enforced.
- [ ] First submission creates quotation with a temporarily nullable pointer, inserts immutable revision/items/attachments, then sets the pointer in one trusted transaction before commit.
- [ ] Composite same-parent integrity guarantees `current_revision_id` belongs to that quotation; revision number is unique/monotonic per quotation and browser-unwritable.
- [ ] `quotation_items` is Remove/Merge; current items are queried through the current immutable revision and any later projection is derived/rebuildable.
- [ ] Identical updates are no-ops under the exact versioned field/order/rounding/null/attachment hash contract and create no revision, audit, event, or notification.
- [ ] Legacy `price`, currency, totals, tax/freight, alternate, and partial-bid semantics are resolved before data transformation.
- [ ] Buyer notes, shortlists, approvals, awards, value baselines, and Supplier disclosure are Buyer-private and remain disabled until their decisions are approved.
- [ ] Published procurement data, quotation revisions, decisions, and events cannot be cascade-deleted.

## F. Messaging, notifications, events, and idempotency

- [ ] MSG-001 conversation party identity and temporal participant history replace participant arrays/maps.
- [ ] Participant `valid_from` is inclusive, `valid_until` is exclusive, and reads are limited to messages created inside the reader's authorized interval.
- [ ] Ownership transfer/revocation and RFQ close/cancel forbid later messages; a new Supplier owner does not inherit prior private history automatically.
- [ ] Message sender is active at creation time and message body/history remains private under the same interval rule.
- [ ] Receipt mutation is self-only and monotonic.
- [ ] MSG-002 message edit/delete, attachment, export, moderation, exceptional quarantine, and retention policies remain explicit gates.
- [ ] REL-001 `domain_events` is a transactional outbox plus durable minimal integration fact, not full event sourcing and not a replacement for domain history/audit.
- [ ] Exactly one worker creates notifications; domain commands write only their aggregate, audit, and domain event.
- [ ] Notifications include channel, are unique per event/recipient/channel, and recipients may mutate only their own read state.
- [ ] Notification body/reference contains the minimum information and class-based retention is approved.
- [ ] Idempotency scope, subject, request digest, replay result, expiry, and mismatch handling are defined per trusted command.
- [ ] Retry/lease/dead-letter behavior cannot duplicate ownership, revisions, access grants, audit facts, or notifications, and poison events have bounded failure handling.

## G. Security, privacy, deletion, and audit

- [ ] Public, authenticated, self, organization, Supplier-member, reviewer, Owner/Admin, server-only, and migration-service visibility classes are distinguishable.
- [ ] RLS is not treated as column security; private Supplier/contact/ownership/fingerprint/source fields never appear in a public/anonymous projection.
- [ ] Audit, event, idempotency, security, import-error, and migration relations are recommended in a non-exposed internal schema with trusted-only access.
- [ ] PII, claimant evidence, Supplier contacts, commercial responses, messages, billing data, fingerprints, and security signals receive least-privilege treatment.
- [ ] Secrets, credentials, raw tokens, payment credentials, full source documents, raw workbooks, and permanent object URLs are prohibited.
- [ ] Audit fields are trusted, immutable, safely summarized, and correlated without copying sensitive records.
- [ ] Deletion/retention matrix covers user identity, ownership, Supplier data, procurement, messaging, notifications, audit/events, files, billing, and migration evidence.
- [ ] Privacy deletion, legal hold, pseudonymization, backups, and dependent-history behavior receive legal/security approval before implementation.
- [ ] Any Production purge or classification requires a separate approved dry run and rollback plan.

## H. Files, search, content, and billing compatibility

- [ ] Uploads remain disabled until storage provider, signed access, size/media limits, scanning, retention, and authorization are implemented and tested.
- [ ] File authorization/custody comes from typed parent relationships; opaque object keys, uploader identity, and creating user alone confer no continuing access.
- [ ] File finalization validates object proof/scan/parent authority atomically and defines quarantine plus provider-orphan compensation.
- [ ] Before FILE-001, RFQ/quotation attachments, later message attachments, and Claim evidence permit only allowlisted HTTPS or preserved restricted legacy references; reject unsafe schemes/local paths, retain source/provider/reference metadata, allow unknown legacy size/MIME/hash, include no `file_objects` column/FK, assume no Storage, prohibit permanent public URLs for private files, and preserve an audited later path to provider-neutral file IDs.
- [ ] Directory/search queries are server-side, field-minimized, keyset-paginated, and do not depend on Supplier keyword arrays.
- [ ] FTS/trigram/external-search choice is supported by bilingual relevance and query-plan evidence before index implementation.
- [ ] Taxonomy, administrative area, registration sector, and content localization models have stable codes and explicit fallback behavior.
- [ ] Term suggestions store only a bounded/minimized evidence sample and atomic count; `term_suggestion_examples` is not created initially.
- [ ] Billing customer/subscription/event/entitlement tables cannot be client-authored and store no payment credentials.
- [ ] Organization-versus-user billing ownership and finance/legal retention are resolved before billing implementation.

## I. Migration traceability and operability

- [ ] All 35 verified Firestore collections retain a complete destination/no-target, transformation, legacy-ID rule, relationship validation, classification, and exception path.
- [ ] Count reconciliation does not substitute for relationship/content validation.
- [ ] Migration batches record source snapshot marker, environment, schema/code version, actor, status, and rollback marker.
- [ ] Every batch/source collection/document/source-version key has exactly one active disposition with transformation version, migrated/skipped/quarantined/merged/rejected/no-target/pending state, reason/error/quarantine evidence, and explicit supersession history.
- [ ] Every active target mapping has exactly one mutually exclusive semantic `child_key` or deterministic `child_ordinal`; active logical-slot uniqueness excludes target UUID, so a source child slot cannot fork.
- [ ] Active reverse uniqueness over target logical type/UUID/mapping role normally maps a target to exactly one active source child.
- [ ] Reviewed many-source-to-one exceptions use a separate merge-group/reconciliation record that binds the canonical target once and lists every contributing source child; ordinary uniqueness is never relaxed.
- [ ] Supplier contacts, categories, capabilities, payment options, physical locations, service coverage, and map/array children use versioned semantic keys where possible and deterministic canonical ordering/ordinals otherwise, not transient array indexes alone.
- [ ] Insertion locks logical slots/reverse targets; identical replay returns existing targets; corrections atomically supersede mappings; inactive history cannot authorize replay or active counts.
- [ ] Reconciliation and rollback prove forward/reverse traces, merge contributors, target fingerprints and dependency order; exceptions quarantine deterministically with no partial graph or shared-target deletion.
- [ ] No Firestore mapping has an active destination in any Remove/Merge concept: Claim evidence, term-suggestion samples, and review tags remain bounded parent representations, and other removed concepts retain explicit no-target/replacement handling.
- [ ] Validation results contain counts and safe sample keys only, not complete Production records.
- [ ] Source-to-target checks cover identity/account context, Supplier ownership agreement, exact/fuzzy evidence, recipient eligibility, revision sequence/parent integrity, event/notification idempotency, and access ledgers.
- [ ] Historical RFQ/quotation events and six existing notifications are classified/mapped as already materialized with explicit fan-out suppression and are never replayed.
- [ ] Local/dev/staging/Production project separation, region, backups, secrets, CI, promotion, rollback, and observability are approved before hosted work.
- [ ] Read-path cutover, dual-write policy, freeze window, rollback authority, and evidence retention are resolved in a later migration runbook.
- [ ] Design section `I` and document 06 use the PR #46-synchronized deterministic zero-to-many child-expansion contract while preserving traceability, non-ambiguity, replay, reconciliation, and rollback intent.

## J. Query and performance review

- [ ] Every launch-critical query has filters, deterministic order, candidate index, expected cardinality, keyset cursor, result projection, and privacy boundary.
- [ ] Supplier directory, duplicate/claim search, RFQ lists, quotation comparison/history, inbox, conversations/messages, audit investigation, and material dictionary are covered.
- [ ] Candidate indexes are treated as hypotheses until tested with representative data and `EXPLAIN`.
- [ ] Partial/composite/GIN/trigram indexes have measured selectivity and write-cost justification.
- [ ] N+1 query patterns and client-side load/filter/sort paths are removed by the eventual read-path design.
- [ ] Query budgets and performance acceptance thresholds are defined before cutover.

## K. Negative scope confirmation

- [ ] No SQL migration, table, index, trigger, function, RPC, view, policy, bucket, seed, generated type, or configuration was created.
- [ ] No Supabase start/link/login/project creation, Firebase change, emulator mutation, deployment, migration, backfill, or Production read/write occurred.
- [ ] No application/runtime/test code was changed.
- [ ] Documentation does not claim that proposed constraints, RLS, trusted operations, files, billing, or hosted environments are implemented.
- [ ] Review approval authorizes only the design baseline; every implementation phase still needs its own scoped PR and verification.

## L. Reviewer sign-off

| Role | Reviewer | Decision | Date | Required follow-up / decision IDs |
|---|---|---|---|---|
| Product owner |  | Approve / changes requested |  |  |
| Technical owner |  | Approve / changes requested |  |  |
| Security/authorization reviewer |  | Approve / changes requested |  |  |
| Data/migration reviewer |  | Approve / changes requested |  |  |
| Legal/privacy/retention reviewer |  | Approve / changes requested |  |  |

Final design disposition: **Not reviewed / Approved for implementation planning / Changes required**
Approval commit SHA:
Next authorized phase and explicit exclusions:

## M. First SQL-slice implementation evidence (not part of the 119 design-review items)

- [x] The implementation starts from verified `main` merge commit `206f7daa524228abfa83793c39a03045491f1316` after PR #46.
- [x] The local-only `internal` schema contains the five requested governance relations plus only the required `migration_merge_group_members` physical relation.
- [x] DB-001 is resolved for this local slice from PostgreSQL `17.6` catalog evidence to `pg_catalog.gen_random_uuid()` UUIDv4; no UUIDv7 function, custom function, extension, or client-selected primary key was added.
- [x] The MIG-001 declarative schema portion is implemented; Migration Engine locking, replay lookup, atomic graph supersession, transformation, reconciliation orchestration, and rollback execution remain unimplemented.
- [x] MIG-002 remains Open because no hosted environment strategy, project, secret, backup, promotion, or deployment evidence was created.
- [x] Active source identity and parent coupling, batch transformation/version coupling, key/ordinal child slots, reverse targets, target-qualified merge contributors, same-lineage reasoned supersession, validation consistency, bounded error severity/retry state, and referenced-evidence delete protection have 60 focused local database assertions.
- [x] Ordinary and merge-group target bindings share one reverse-target unique index; ordinary uniqueness was not weakened for many-source-to-one cases.
- [x] All metadata, messages, paths, references, and evidence values are bounded; full source records, workbooks, credentials, tokens, and unrestricted raw payloads remain prohibited.
- [x] No RLS, policy, browser/API grant, view, RPC, trigger, custom function, seed, business table, Auth integration, Storage, frontend integration, data migration, hosted linkage, or deployment is included.
