# Mujahiz IQ PostgreSQL Schema Review Checklist

Status: Reviewer gate for documentation only
Baseline: `main` at `1a4e5a59a37b2f1eb05d5cf8fa555d8f7dfe84d6`
Review together: `09_POSTGRESQL_SCHEMA_DESIGN.md` and `10_SCHEMA_DECISION_REGISTER.md`

Check an item only when the cited design is explicit and evidence supports it. Record disagreements as stable decision IDs or review comments; do not resolve ambiguity by implementing SQL.

## A. Scope and evidence

- [ ] The work contains only the three requested Markdown documents.
- [ ] The design is based on exact SHA `1a4e5a59a37b2f1eb05d5cf8fa555d8f7dfe84d6`.
- [ ] Current Firestore collections, Functions, services, rules, indexes, tests, migration docs, and exact verified counts were inspected.
- [ ] Controlled TEST RFQ/quotation data is distinguished from Production and mixed audit/notification classifications.
- [ ] GitHub-only ownership-claim code is not described as deployed.
- [ ] Empty collections and future tables are not described as implemented or populated.
- [ ] Every asserted invariant is either evidenced, recommended, or explicitly Open/Deferred.

## B. Relational model and integrity

- [ ] Every proposed table has a clear purpose, UUID primary key strategy, required/optional columns, foreign keys, uniqueness/check rules, candidate indexes, sensitivity, deletion behavior, and Firestore transformation note.
- [ ] Legacy Firestore IDs are preserved as alternate keys and migration mappings, not reused blindly as relational PKs.
- [ ] Arrays/maps used for relationships are normalized into child/join tables.
- [ ] JSONB is limited to bounded/versioned snapshots or flexible metadata that does not require relational filtering or integrity.
- [ ] Exact numerics are specified for money/quantities; floats are rejected.
- [ ] Timestamp, locale, URL, normalized-identifier, and status conventions are consistent.
- [ ] Derived quality/search/aggregate/access fields have one canonical source or are explicitly trusted projections.
- [ ] Foreign-key delete behavior defaults to restrict; cascades are limited to unpublished drafts/disposable preferences.
- [ ] Immutability, supersession, and archive semantics are unambiguous for historical rows.

## C. Identity, organization, and authorization readiness

- [ ] Application user UUID is separated from provider subject/Firebase UID.
- [ ] Authentication authority and migration duration remain an explicit decision.
- [ ] Platform roles are separated from user profile and recorded temporally.
- [ ] Buyer organization and membership model has an owner and resolution deadline.
- [ ] Supplier verified ownership is separate from operational Supplier membership.
- [ ] Authorization never relies on cached display names, client-supplied role, email, or object key.
- [ ] Owner/Admin/support access is not assumed without an explicit policy.
- [ ] The future RLS PR is classified Extra High Security and requires positive and negative tests.
- [ ] No client-accessible table can ship before its RLS and trusted-operation design is approved.

## D. Supplier integrity and duplicate prevention

- [ ] Supplier profile, contacts, locations, category assignments, capabilities, payment options, products, and documents have distinct visibility/retention rules.
- [ ] One-active-primary-owner and current one-profile-per-owner constraints are represented without blocking future memberships.
- [ ] Claim creation, expiry, approval, rejection, withdrawal, supersession, transfer, and revoke history can be expressed.
- [ ] Claim evidence is separate, bounded, private, and retention-controlled.
- [ ] Approval revalidates current Auth/app eligibility, current canonical owner, and claimant lock within one trusted operation.
- [ ] Duplicate fingerprints are protected, versioned, exact, trusted-only, and reserved/released atomically.
- [ ] `supplierDuplicateIndex`, canonical uniqueness, and submission duplicate guards map to one coherent relational design.
- [ ] Supplier import keeps safe metadata and row results but never persists the raw workbook by default.
- [ ] Submission approval can atomically write Supplier graph, review state, contribution/access ledgers, ownership event, notification, and audit evidence.
- [ ] Bilingual category/address mappings define an exception path rather than inventing values.

## E. RFQ, quotation, and Buyer privacy

- [ ] RFQ ownership is organization-scoped and publication fixes an auditable Supplier recipient set.
- [ ] Recipient visibility is anchored to Supplier profile/membership, not owner UID arrays.
- [ ] A Supplier can access only its own invitation/quotation; a Buyer can access only its organization's RFQs; competitors cannot read each other.
- [ ] One canonical quotation per RFQ/Supplier is enforced.
- [ ] First submission and every material update create an atomic immutable revision, item snapshot, event, notification, and current projection update.
- [ ] Identical updates are no-ops under a documented normalized-content comparison.
- [ ] Revision numbers are monotonic and browser-unwritable.
- [ ] Legacy `price`, currency, totals, tax/freight, alternate, and partial-bid semantics are resolved before data transformation.
- [ ] Buyer notes, shortlists, approvals, awards, value baselines, and Supplier disclosure are Buyer-private and remain disabled until their decisions are approved.
- [ ] Published procurement data, quotation revisions, decisions, and events cannot be cascade-deleted.

## F. Messaging, notifications, events, and idempotency

- [ ] Conversation party identity and participant history replace participant arrays/maps.
- [ ] Message sender must be an active participant and message body/history is private.
- [ ] Receipt mutation is self-only and monotonic.
- [ ] Message edit/delete, attachment, export, moderation, and retention policies remain explicit gates.
- [ ] Domain events are transactional outbox facts and do not replace domain-specific history or security audit.
- [ ] Notifications are idempotent per event/recipient/channel and recipients may mutate only their own read state.
- [ ] Notification body/reference contains the minimum information and class-based retention is approved.
- [ ] Idempotency scope, subject, request digest, replay result, expiry, and mismatch handling are defined per trusted command.
- [ ] Retry behavior cannot duplicate ownership, revisions, access grants, audit facts, or notifications.

## G. Security, privacy, deletion, and audit

- [ ] Public, authenticated, self, organization, Supplier-member, reviewer, Owner/Admin, server-only, and migration-service visibility classes are distinguishable.
- [ ] PII, claimant evidence, Supplier contacts, commercial responses, messages, billing data, fingerprints, and security signals receive least-privilege treatment.
- [ ] Secrets, credentials, raw tokens, payment credentials, full source documents, raw workbooks, and permanent object URLs are prohibited.
- [ ] Audit fields are trusted, immutable, safely summarized, and correlated without copying sensitive records.
- [ ] Deletion/retention matrix covers user identity, ownership, Supplier data, procurement, messaging, notifications, audit/events, files, billing, and migration evidence.
- [ ] Privacy deletion, legal hold, pseudonymization, backups, and dependent-history behavior receive legal/security approval before implementation.
- [ ] Any Production purge or classification requires a separate approved dry run and rollback plan.

## H. Files, search, content, and billing compatibility

- [ ] Uploads remain disabled until storage provider, signed access, size/media limits, scanning, retention, and authorization are implemented and tested.
- [ ] File authorization comes from typed parent relationships; opaque object keys alone confer no access.
- [ ] Existing HTTPS reference links are preserved as links and placeholders do not create fake file objects.
- [ ] Directory/search queries are server-side, field-minimized, keyset-paginated, and do not depend on Supplier keyword arrays.
- [ ] FTS/trigram/external-search choice is supported by bilingual relevance and query-plan evidence before index implementation.
- [ ] Taxonomy, administrative area, registration sector, and content localization models have stable codes and explicit fallback behavior.
- [ ] Term suggestions store bounded/minimized examples and atomic counts.
- [ ] Billing customer/subscription/event/entitlement tables cannot be client-authored and store no payment credentials.
- [ ] Organization-versus-user billing ownership and finance/legal retention are resolved before billing implementation.

## I. Migration traceability and operability

- [ ] Every Firestore collection in the verified baseline has a destination, transformation, legacy-ID rule, relationship validation, classification, and exception path.
- [ ] Count reconciliation does not substitute for relationship/content validation.
- [ ] Migration batches record source snapshot marker, environment, schema/code version, actor, status, and rollback marker.
- [ ] Every source record receives a mapping/disposition, including skipped, duplicate, TEST, invalid, and superseded records.
- [ ] Validation results contain counts and safe sample keys only, not complete Production records.
- [ ] Source-to-target checks cover identity agreement, Supplier ownership, fingerprints, recipient eligibility, revision sequence, event/notification idempotency, and access ledgers.
- [ ] Local/dev/staging/Production project separation, region, backups, secrets, CI, promotion, rollback, and observability are approved before hosted work.
- [ ] Read-path cutover, dual-write policy, freeze window, rollback authority, and evidence retention are resolved in a later migration runbook.

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
