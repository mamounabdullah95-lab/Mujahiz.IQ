# REL-001 idempotency and domain-events foundation contract

Status: **REL-001 resolved for Option D; decision-complete with no SQL slice selected or runtime implementation authorized**
Contract date: 8 August 2026
Verified refresh: `origin/main` `1849d12dc52ca99f215fd90762948a67b95117c9` after merged PR #80
Primary task profile: Documentation

## 1. Decision and implementation boundary

This document makes the architecture and data contract for future `internal.idempotency_keys` and `internal.domain_events` decision-ready. It does not approve either table for implementation.

For REL-001, this document is the specific successor contract to the earlier high-level recommendations in documents 02, 09, 10, and 11. Those documents remain historical design context; any apparent implementation timing difference is resolved by this document's Option D hard stop.

**Selected option: D — no-go until a first trusted command and its first real event consumer are approved.**

The approved first future producer path is a Supabase-authoritative `supplier_ownership.decide_claim` trusted command. Its first concrete consumer is one future claim-decision notification materializer for the affected claimant. That pairing is concrete and follows the existing Firebase Claim decision, event, audit, and notification behavior, but implementation is not currently authorized: Claim Supplier is undeployed, its relational command/aggregate is unimplemented, and `ID-001`, `AUD-001`, and `MSG-003` remain Open.

The two concepts are not universally inseparable. A trusted command that has no asynchronous consequence may use idempotency without a domain event. A domain event must never be created without a named producer, at least one approved consumer or durable integration use, and a replay/retention policy. For the selected first Claim decision path, both concepts belong to one later coherent implementation because that command needs request replay protection and emits a notification-driving fact.

The minimum safe foundation **now is no new table**. Once the first command, registry entries, consumer, and blocking gates are approved, the smallest empty local-only SQL foundation is exactly the two fully revoked internal tables, structural constraints/indexes, comments, and focused synthetic tests. It includes no rows, audit table, notification table, trigger, worker, RPC, RLS/policy, API grant, Auth bridge, Firebase access, hosted operation, or data movement.

## 2. Verified starting state and authority separation

- Merged PR #80 is the refreshed `origin/main` at `1849d12dc52ca99f215fd90762948a67b95117c9`.
- The tracked local migrations contain 16 physical tables representing 14 implemented Core Phase 1 concepts; 22 of 36 remain deferred.
- `internal.idempotency_keys` and `internal.domain_events` are deferred Core Phase 1 concepts and do not exist in local SQL.
- Merged PR #80 implemented exactly the approved empty, revoked, local-only `public.supplier_contacts` tenth slice plus focused synthetic pgTAP. This contract does not modify or depend on that implementation.
- Firebase remains authoritative in Production. Supabase remains local-only, unhosted, and non-authoritative.
- All 12 Open approval gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.
- REL-001 is `Resolved` for the approved Option D planning decision only. It is not implemented and selects no SQL slice.

Current Firebase behavior is evidence, not authority to copy its storage shape. The implemented but undeployed Claim creation command hashes a caller-supplied key, binds it to claimant and payload, returns the same claim for an identical retry, rejects changed-payload or cross-user reuse, and uses a 30-day Claim horizon. Claim decisions create deterministic ownership events, audit rows, and claimant notifications in one Firestore transaction. The relational design preserves those invariants while separating replay protection, integration facts, audit, and notification delivery.

## 3. Separation of responsibilities

| Concern | Canonical responsibility | Explicit exclusions |
|---|---|---|
| `idempotency_keys` | Serialize one logical trusted-command request and bind identical retries to one safe terminal result | Not a rate limiter, lock table for aggregate invariants, request log, audit record, response cache, or domain history |
| `domain_events` | Record one immutable committed integration fact and provide one transactional outbox processing lifecycle | Not event sourcing, an audit log, notification content, a queue for arbitrary jobs, or mutable aggregate state |
| `audit_logs` | Later AUD-001 design for accountable action/outcome/reason and security/business investigation | Never used as an outbox or idempotency store; not designed here |
| `notifications` | Later MSG-003 materialized recipient/channel snapshot and user read state | Never created directly by a domain command after the outbox path is active; not designed here |

Both reliability tables remain in a non-exposed `internal` schema. Browser/API roles receive no direct read or write path. Trusted access, Auth identity, grants, and RLS remain separate security work.

## 4. Idempotency scope, key generation, and stable namespace

One idempotency record represents one accepted logical invocation of one registered command.

### 4.1 Required scope bindings

The record binds all of the following:

- immutable `command_name` from a code-owned registry, such as `supplier_ownership.decide_claim`;
- positive `command_contract_version`, changed only for a deliberately non-replay-compatible command contract;
- stable environment identity, so local, development, staging, Firebase Production, and any future Supabase Production authority never share a replay namespace;
- authenticated caller principal type and provider-neutral principal identity; a service acting for a user records both the service source and human actor where applicable;
- target aggregate type and UUID when known before execution; creation commands bind the known parent/slot and allocate the result UUID once inside the authoritative attempt;
- caller-supplied request identity through the idempotency key; and
- optional upstream source system/request identity for webhook, migration, scheduler, or reconciliation callers.

Email, display name, role label, network address, bearer token, session ID, release SHA, worker instance, and request timestamp never define scope. Role snapshots may be audit evidence later but are not durable principal identity.

### 4.2 Caller key and namespace

- Interactive/API callers generate at least 128 bits from a cryptographically secure random source; canonical UUIDv4 text is recommended.
- The caller creates the key before its first attempt and reuses the exact value after timeout, disconnect, or retryable failure. A new key means a new logical command.
- Webhook commands use the provider event ID; migration and scheduled commands use a durable source-item/job identity. They never derive a key from retry count, wall-clock time, worker identity, or payload alone.
- The stable namespace is `environment_identity + command_name + command_contract_version`. It changes only through an explicit compatibility decision and never per deployment.
- Raw keys are accepted only through the trusted command boundary and are never stored, logged, placed in event payloads, returned in errors, or exposed to clients after intake.
- Store an HMAC-SHA-256 key digest over a versioned, length-delimited namespace and raw key, plus the digest-key version. Environment secrets remain outside the database. Prior digest keys must remain available for the longest unexpired replay horizon after rotation.
- Uniqueness is `(environment_identity, command_name, command_contract_version, key_digest)`. Actor, source, target aggregate, and request fingerprint are immutable bindings checked after lookup. This makes same-key reuse by another actor, source, or aggregate a conflict instead of a second command.

## 5. Request fingerprint and mismatch behavior

Each command registry entry owns a versioned canonical request projection. The projection contains every authoritative semantic input and precondition that could change the domain result, including the target aggregate/slot, expected aggregate version where used, normalized ordered children, explicit nulls, and immutable referenced-object identifiers/checksums.

It excludes transport headers, the raw idempotency key, correlation/tracing headers, authentication tokens, retry count, server-generated timestamps, worker identity, presentation-only defaults, and fields the trusted command recomputes authoritatively.

- Canonicalize the projection with a fixed reviewed JSON canonicalization profile: UTF-8, sorted object keys, command-defined array ordering, exact decimal strings, explicit missing-versus-null rules, and command-owned normalization versions.
- Store only a versioned HMAC-SHA-256 request fingerprint and digest-key version. Do not store the request body or low-entropy sensitive values in this table.
- The command registry must version any change to normalization, ordering, rounding, defaulting, or included fields. A deployment must continue recognizing fingerprints created under every unexpired supported contract version.
- An identical scoped key and fingerprint follows the lifecycle/replay rules in section 7.
- The same namespaced key with a different actor, source, aggregate binding, request fingerprint, or fingerprint version fails closed as `idempotency_key_conflict`. It performs no domain mutation, reveals no prior result or actor, and never overwrites or forks the existing record.

Malformed input, missing authentication, and clearly unauthorized calls fail before idempotency reservation. Authorization and mutable business preconditions are rechecked before the first execution; a completed replay does not re-execute the command, but its result is rehydrated only through current authorization and field-minimization rules.

## 6. Result and response semantics

`idempotency_keys` stores a safe result binding, not an HTTP body or serialized application response:

- bounded terminal `outcome_code`;
- optional typed result resource and UUID, constrained by the command registry;
- optional immutable result/version token needed to prove the committed outcome; and
- for failure, only a bounded stable error class/code and retry disposition.

On completed replay, the trusted command loads the recorded result reference, verifies that it is internally consistent, re-applies current read authorization, and renders the current response schema. Loss or mismatch of the referenced result is an integrity error requiring reconciliation; it never authorizes command re-execution. A caller that no longer has read authority receives the normal minimized denial without learning the prior result.

Do not store localized messages, complete result snapshots, credentials, PII, commercial payloads, stack traces, SQL errors, or external signed URLs. A command with no resource result uses a registered bounded outcome and deterministic result token rather than a fabricated UUID.

## 7. Lease, processing, completed, failed, retry, and retention lifecycle

The allowed states are `processing`, `completed`, and `failed`. `failed` also records `retry_disposition = retryable|terminal`.

1. A short reservation transaction creates or atomically claims the record as `processing`, sets a random unguessable lease token digest, lease expiry, and attempt number, and returns the existing state on conflict.
2. An unexpired `processing` lease never permits a parallel execution. The caller receives a bounded in-progress response and retry-after hint.
3. After lease expiry, a retry may claim a new fenced lease and increment the attempt. Every completion/failure update must match the current lease token and attempt; a stale worker cannot commit.
4. The authoritative domain transaction locks/revalidates the aggregate, performs the domain change, inserts any required domain event, and changes the idempotency record to `completed` with its result binding in the same commit. A crash before commit leaves no domain change and no false completed result.
5. If no domain transaction commits, a separate fenced update may mark `failed`. Retryable failure records a safe code and `next_attempt_at`; terminal failure replays the same safe failure until expiry. Failed state never implies a partial domain commit.
6. A retryable failure may return to `processing` only after backoff and a new fenced lease. Exceeding the command's bounded attempts becomes terminal failed and requires approved reconciliation, not a fresh hidden key.
7. Completed identity, scope, request fingerprint, result binding, and completion time are immutable. Corrections are new trusted commands with new keys and, where applicable, compensating events.

The initial registry recommendation is a maximum 60-second processing lease, exponential backoff with jitter, and at most 10 automated attempts. A command may choose a shorter lease/fewer attempts; a longer lease or more attempts requires evidence from its runtime timeout and side-effect model.

Retention is class-based rather than one universal TTL:

- retain a complete replay record for at least 30 days, matching the current Claim request horizon, and never shorter than the client retry, external-effect, cutover, and rollback window;
- for irreversible, privileged, financial, ownership, access-grant, publication, or externally visible commands, retain a minimized conflict tombstone after the response replay horizon until a reviewed domain uniqueness rule makes re-execution safe;
- terminal failed rows may be compacted after 30 days only when no domain change or external side effect occurred and operational/security review no longer needs the guard;
- abandoned processing rows become reclaimable after lease expiry but are not deleted while an attempt can still reconcile; and
- expiry authorizes no cleanup job by itself. Exact class durations, compaction fields, legal hold, and deletion execution require Technical/Security/Privacy/Operations approval before implementation.

## 8. Domain-event identity, aggregate sequence, and duplicate prevention

Every event has one database-generated opaque UUID identity that remains stable through processing and replay. Duplicate prevention does not depend on regenerating that UUID.

Required identity constraints are:

- one primary aggregate type and UUID;
- a positive monotonically increasing `aggregate_sequence`, unique within `(aggregate_type, aggregate_id)`;
- producer command name/version, optional idempotency record ID, and positive event ordinal;
- unique `(producer_idempotency_key_id, event_ordinal)` for idempotent commands;
- a durable source-operation identity plus ordinal for approved internal commands without caller keys; and
- unique `(source_system, source_stream, source_event_id)` for imported authoritative legacy events.

An event-producing command must have either an idempotency record or another reviewed durable source-operation identity. A random event UUID, payload hash, timestamp, or `max(sequence)+1` without aggregate serialization is not duplicate prevention.

The command locks the aggregate/version guard before allocating sequence. Sequences order facts for one aggregate only; there is no global business order. Multiple facts for one aggregate in one transaction use deterministic consecutive ordinals. A multi-aggregate command chooses one primary aggregate per event and uses additional typed references only when the registry permits them. Sequence gaps are acceptable after reviewed recovery; sequence reuse and silent renumbering are not.

## 9. Event-type registry and versioning

The minimum foundation uses a code- and documentation-owned registry, not a third generic SQL registry table. Every entry names:

- stable lower-snake dotted event type, past-tense fact, and owning bounded context;
- allowed aggregate type;
- producing command and event ordinal rule;
- positive event schema version and canonical JSON schema;
- minimum payload fields and forbidden/sensitive fields;
- actor/source/provenance rules;
- named consumer or durable integration use;
- processing retry/dead-letter class;
- retention/replay classification; and
- compatibility and deprecation rules.

Version is separate from event type. Additive optional fields may keep a version only when all registered consumers demonstrably tolerate them; removing, renaming, changing meaning/type/nullability, or changing normalization increments the version. Historical event type/version/payload rows are never rewritten. Consumers explicitly accept supported versions and dead-letter unsupported versions with a safe error code.

The first proposed registry entries are `supplier_ownership.claim_approved` version 1 and `supplier_ownership.claim_rejected` version 1, produced by `supplier_ownership.decide_claim`. Their initial named consumer is `supplier_claim_decision_notification_materializer`. Decision-ready document 32 also proposes a bounded `supplier_ownership.claim_superseded` event for competing claimants and exact minimal payload fields. Those successor proposals remain unapproved with SUP-001, `AUD-001`, and `MSG-003`; no registry or notification behavior is implemented.

## 10. Payload envelope, provenance, and timestamps

Envelope columns, rather than duplicated payload fields, carry event ID/type/version, aggregate type/ID/sequence, producer command and idempotency/source identity, actor/source, correlation/causation, occurrence/persistence time, and processing lifecycle.

The JSONB payload contains only the minimum immutable transition facts required by the registered consumer. It may contain typed stable identifiers, bounded status transition codes, and a small non-sensitive snapshot only when later reads cannot reproduce the committed fact. It must not contain audit before/after details, request bodies, notification copy, localized UI text, user contact data, credentials/tokens, private file URLs, raw legacy documents, workbooks, stack traces, or unrestricted metadata. The recommended maximum is 16 KiB per payload and 8 KiB for bounded metadata; a registry entry must justify anything smaller or any later increase.

Provenance includes producer service/code, command/version, source system, environment identity, optional provider-neutral actor, and migration classification. Actor records who initiated the transition; source records the trusted system that asserted it. Neither grants authorization. Network/security evidence belongs in later audit/security records, not event metadata.

- `correlation_id` is an opaque server-validated UUID propagated through one logical workflow and generated at trusted ingress when absent.
- `causation_event_id` is a nullable restrictive self-reference to the earlier event that directly caused this event. Direct user/service commands have no causation event and instead retain their producer request link.
- One event has at most one direct cause. Self-causation, cycles, caller-forged event IDs, and correlation IDs containing business/PII values are prohibited.
- `occurred_at` is when the authoritative domain transition occurred. New database commands use trusted database time in the domain transaction. Imported events use a source occurrence time only when source evidence proves it.
- `persisted_at` is immutable database time when the outbox row commits. It is never replaced by an imported timestamp.
- `available_at`, lease, retry, processed, and dead-letter timestamps are operational processing times. They never rewrite occurrence or persistence history.

## 11. Outbox processing, retries, and dead letter

The minimum `domain_events` foundation supports one approved internal processor path. Its mutable processing state is `pending`, `processing`, `processed`, `retryable_failed`, or `dead_letter`.

- The worker claims eligible rows atomically in persistence order with a fenced lease; parallel workers cannot own the same attempt.
- Attempt count increases on each claim. Retryable errors use bounded exponential backoff with jitter and `next_attempt_at`. The initial recommendation is 10 attempts; registry entries may require fewer.
- Unsupported schema, invalid registered payload, missing aggregate integrity, or a permanent consumer contract violation goes directly to dead letter. Store only bounded safe error class/code, never full exception text or payload copies.
- For the first in-database notification materializer, deterministic notification inserts and transition to `processed` occur in one transaction. Notification uniqueness remains `(event_id, recipient_id, channel)` under the later MSG-003 contract.
- Reclaim and completion require the current lease token/attempt. An expired worker cannot mark an event processed.
- Manual dead-letter requeue requires an approved operator, evidence that the defect is corrected, the same immutable event ID/payload, and the future audit record required by AUD-001. It never clones the event or resets attempt history.
- A second independent consumer must not share this single status. It requires a separately approved per-consumer delivery/receipt relation or external broker contract. That expansion is outside REL-001's minimum foundation.

`processed` means the registered internal consumer transaction committed. It does not prove email/SMS/webhook delivery. External channel attempts and receipts belong to a later notification-delivery design, not `domain_events`.

## 12. First trusted command and consumer dependency

[`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md) is the decision-ready successor for the version-1 command inputs, outputs, locks, aggregate effects, Claim lifecycle, event payload proposal, and same-Supplier security boundary. SUP-001 remains Recommended pending explicit Owner approval, so that document narrows the contract without authorizing this reliability foundation or runtime work.

The proposed first command is `supplier_ownership.decide_claim` because it has a real aggregate transition and an already evidenced claimant-notification consequence. A later command approval must define, at minimum:

1. current actor/authentication and Admin/Owner authorization under the resolved ID-001 boundary;
2. Claim, claimant, Supplier, current owner, competing-claim, and lock reads plus serialization order;
3. request fingerprint fields, expected Claim state/version, and idempotency result contract;
4. approval/rejection/supersession transaction, affected aggregate sequence rules, and compensation;
5. the exact version-1 approved/rejected event payloads and stable recipient derivation;
6. required audit outcome under the separately resolved AUD-001 contract;
7. one MSG-003-approved notification materializer, deterministic recipient/channel uniqueness, bilingual snapshot/retention, and no command-side notification insert;
8. lease, retry, dead-letter, observability, and operator ownership; and
9. focused concurrency, mismatch, crash, stale-lease, duplicate-event, duplicate-notification, replay, and authorization tests.

Until the implementation approvals corresponding to all nine requirements are satisfied, `domain_events` has no authorized first processor and the two-table SQL foundation remains no-go. A decision-ready command contract does not enable the undeployed Firebase Claim feature or authorize a Supabase Claim implementation.

## 13. Boundary with audit logs and notifications

### Audit

A domain event states that an approved domain transition committed. A future audit record states who attempted or performed an action, under which authority, with what outcome/reason and safe investigation evidence. Rejected authorization and failed attempts may need audit but produce no success domain event. Events avoid audit summaries; audit avoids worker lifecycle. They may share correlation ID and, for committed transitions, an optional event reference.

AUD-001 remains Open. This document chooses no audit retention duration, partition, legal-hold behavior, pseudonymization rule, before/after shape, actor access, or append-only implementation. `audit_logs` is not part of a later REL-001 SQL slice unless separately approved.

### Notifications

The domain command commits its aggregate, idempotency completion, and domain event; it does not insert a notification. The one approved materializer derives the recipient/channel and safe bilingual snapshot, inserts at most one notification per `(event, recipient, channel)`, and marks the event processed in the same database transaction.

The event carries no notification title/body/read status and is never user-readable. A notification is a delivery/read projection, not a durable domain fact. MSG-003 remains Open, so this contract does not select retention classes, protected-notice rules, rendering inputs, preferences, external channels, or delivery receipts.

## 14. Migration and replay implications

- Existing `rfqPublishEvents`, `rfqResponseEvents`, and `supplierOwnershipEvents` may map only after a versioned event-type/source mapping is approved. Preserve legacy source identity and authoritative occurrence time; never invent missing sequence, actor, causation, or payload facts.
- Imported events are marked historical/fan-out-suppressed and terminal for the initial processor. The six already-materialized Production notifications are mapped separately and never regenerated from historical events.
- Historical replay reprocesses the same event ID through a consumer's duplicate guard; it never inserts a new event row or changes event payload/version.
- `domain_events` is not sufficient to rebuild aggregate state. Reconciliation reads authoritative aggregate/history tables and uses events only as committed integration evidence.
- Current `supplierOwnershipClaimRequests` has a zero verified Production count. If a later bounded refresh finds rows, preserve source digests and mappings only under an approved retention decision; never treat an opaque legacy digest as a raw reusable Supabase key.
- Idempotency rows are authority- and environment-scoped. A Firebase key cannot silently execute the corresponding Supabase command during cutover or rollback. An ambiguous request is reconciled against the one provider manifest authority before any retry.

No migration, replay, seed, backfill, TTL cleanup, event import, notification fan-out, or Production/TEST operation is authorized here.

## 15. Rollback and reconciliation implications

- Rollback changes the provider manifest/authority only through a separately approved runbook. It does not delete or rewrite completed keys or domain events.
- A committed transition is reversed by a new compensating trusted command with a new idempotency key and new causally linked event, never by erasing the original fact.
- Reconciliation compares producer request/result bindings, aggregate versions/sequences, source identities, event ordinals, processing state, and downstream uniqueness without exposing payloads or complete records.
- Any completed key with missing/mismatched result, event without its committed aggregate state, duplicate sequence/producer ordinal, processed event without the registered materialization, or materialization without its event is a fail-closed integrity exception.
- Cutover/rollback horizons determine the minimum replay guard and event retention class. Cleanup cannot shorten those horizons before reconciliation and rollback authority approve it.
- Dead-letter rows and ambiguous in-flight leases block authoritative cutover for their affected command/aggregate until reconciled.

## 16. Options and minimum-safe conclusion

| Option | Boundary | Benefit | Cost/risk | Disposition |
|---|---|---|---|---|
| A | `idempotency_keys` only | Useful once one approved trusted command needs replay protection but emits no asynchronous fact | Empty table before a command cannot prove fingerprint, result, retention, or lease behavior | Not selected now; valid only with a separately approved concrete command |
| B | `domain_events` only | Outbox for a named producer/consumer | Without request/source dedupe, a retried producer can duplicate facts; no approved consumer exists | Reject for the current state |
| C | Both tables treated as universally inseparable | One reliability slice for commands that need both | Overstates the architecture; some commands need only idempotency and some imported events use source identity | Not selected as a universal rule; expected for the proposed first Claim decision path |
| D | No SQL until the first trusted command, registry entries, consumer, and blocking gates are approved | Prevents an abstract unused outbox and premature identity/retention choices while preserving a complete contract | Defers any reliability SQL slice and runtime proof | **Selected and owner-approved** |

Therefore the current minimum safe empty local-only foundation is zero new relations. After approval of the Claim decision path, the minimum coherent foundation becomes exactly `internal.idempotency_keys` plus `internal.domain_events`; it does not include `audit_logs`, `notifications`, a registry table, or a general delivery table.

## 17. Recorded decision and remaining delivery gates

On 8 August 2026, the owner approved REL-001 Option D:

1. implement neither `internal.idempotency_keys` nor `internal.domain_events` now and select no REL-001 SQL slice;
2. use future `supplier_ownership.decide_claim` as the first trusted producer path;
3. use one claim-decision notification materializer as the first concrete consumer;
4. introduce the two reliability tables later as one coherent foundation only when that producer/consumer path and its delivery dependencies are approved; and
5. keep `audit_logs` and notification-delivery implementation outside this contract while AUD-001 and MSG-003 remain Open.

The following delivery approvals remain before any SQL selection or implementation:

1. ID-001 approval for the authoritative principal/actor identity used by the command.
2. AUD-001 approval for the separately required decision audit contract; this document does not design it.
3. MSG-003 approval for the notification materializer's rendering inputs, protected-notice behavior, and notification retention; this document does not design notification delivery.
4. Technical/Security/Operations approval of the 60-second lease, 10-attempt cap, error classes, alert/operator ownership, and dead-letter requeue runbook.
5. Product/Technical/Security/Privacy approval of document 32's proposed aggregate effects/result contract, approved/rejected/superseded version-1 registry payloads, payload fields/limits, event retention classes, idempotency compaction/tombstone classes, and exact durations beyond the 30-day minimum.
6. Migration/Data approval of legacy event classification, fan-out suppression, replay eligibility, and cutover/rollback reconciliation horizon.
7. A later exact SQL/pgTAP selection and implementation task after the preceding decisions; SEC-001 remains required before any client-accessible path, while RES-001 and MIG-002 remain required before hosted work.

No Open gate changes status. REL-001 is Resolved for the Option D architecture/planning decision only; this resolution intentionally selects no SQL slice and implements no command, event, audit, notification, worker, or table.

## 18. Validation and exact stop point

Required validation is documentation-only: refreshed `origin/main` after merged PR #80; 16 physical tables; 14 implemented and 22 deferred Core Phase 1 concepts; 12 unchanged Open gates; cross-document links and terminology; sensitive-content patterns; documentation-only diff; and `git diff --check`.

Do not start Supabase, execute migrations, run pgTAP, access Firebase, inspect Production/TEST data, run worker/runtime tests, implement SQL, modify the merged Supplier Contacts foundation, merge, or deploy.

Exact stop point: existing PR #81 rebased onto merged PR #80, updated with the owner-approved Option D decision, and marked Ready for review after focused checks. Stop before SQL/pgTAP selection or implementation, command/worker implementation, audit/notification design, RLS/Auth, data movement, hosted access, merge, or deployment.

## 19. References

- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md`](06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`30_SUPPLIER_CONTACTS_PRODUCT_AND_DATA_CONTRACT.md`](30_SUPPLIER_CONTACTS_PRODUCT_AND_DATA_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`../claim-supplier-backend-deployment.md`](../claim-supplier-backend-deployment.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
