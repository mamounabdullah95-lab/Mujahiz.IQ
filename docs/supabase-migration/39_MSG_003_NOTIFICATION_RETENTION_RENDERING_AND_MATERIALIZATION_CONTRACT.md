# MSG-003 Claim-first notification retention, rendering, and materialization contract

Status: **Proposal for explicit Product/Security/Data/Privacy Owner approval; MSG-003 remains Open; no SQL, runtime, data, or Production action is authorized**

Proposal date: 2026-08-09

Verified starting point: `origin/main` at `b76888f0d2d8a769ba67bbaa70199ca458f13f87`, after merged PR #92

Primary task profile: Documentation

## 1. Scope and decision boundary

This proposal defines the minimum notification contract needed for the first real Claim Supplier Profile workflow. It evaluates current Firebase notification behavior, fixes the future Supabase authority boundary, defines Claim-decision rendering and retention, and leaves a narrow seam for later RFQ notifications.

It does not implement or authorize a `notifications` table, SQL migration, `internal.domain_events`, `internal.idempotency_keys`, worker, trusted command, Claim runtime, RLS, Auth bridge, Firebase change, hosted Supabase access, Production/TEST data operation, migration, email provider, push/SMS/WhatsApp channel, deployment, or billing action.

Evidence labels used below are:

- **Verified current fact** — proved by the current repository, its focused tests, or the approved documents linked in section 20.
- **Approved existing contract** — already approved in a predecessor contract, but not necessarily implemented.
- **Proposal** — the recommended MSG-003 decision; it remains unapproved until the Owner explicitly accepts section 18.
- **Unknown** — cannot be proved without separately authorized evidence, including Production data inspection.

Firebase remains the live Production backend. Supabase remains local-only, unhosted, non-authoritative, and empty/synthetic-data-only. The GitHub Claim Supplier implementation remains undeployed.

## 2. Executive finding and recommendation

The current Firebase notification system already proves three useful product behaviors:

1. notifications are bilingual delivery snapshots with separate Arabic and English title/body fields;
2. the UI renders exactly the active locale rather than both languages; and
3. the canonical inbox query is self-only, bounded, ordered, and shared by the bell and notification page.

It does not provide one coherent creation or lifecycle contract. Current producers write notifications directly from trusted Functions or browser-authorized RFQ transactions. Claim decisions and quotation submissions/revisions commit their notification with the related Firebase records, while RFQ publication commits the RFQ/event first and then attempts notification writes with `Promise.allSettled`, so notification failure is not returned or retried. An exported generic notification creator uses a random Firestore document ID and has no current call site or deterministic deduplication. There is no notification expiry, archival, retention job, or user deletion workflow; Admin clients may delete non-Claim notifications, while Claim ownership notifications are protected from client deletion.

**Proposal: approve Option C in section 5.** A trusted domain command commits the aggregate, idempotency result, audit outcome, and immutable domain event. Exactly one trusted notification materializer owns live notification creation. For each eligible event it stores one immutable, safe bilingual `in_app` delivery snapshot, identified uniquely by `(domain_event_id, recipient_user_profile_id, channel)`, and then marks the event processed in the same database transaction. Domain commands never also insert notification rows after the Supabase outbox path becomes authoritative for that feature.

For Claim v1, only `approved`, `rejected`, and `superseded` require user-visible in-app notifications. Submission is acknowledged in the command result and Claim history; withdrawal is claimant-initiated; expiry remains visible in Claim state/history; and reviewer work is a queue/assignment concern, not a broadcast notification. This is the smallest useful notification set and avoids notifying users about actions they just performed or broadcasting private Claim workload.

## 3. Evidence inspected

### 3.1 Authoritative context and approved predecessor contracts

- [Current baseline](../ai-context/01_CURRENT_BASELINE.md)
- [Product and business rules](../ai-context/03_PRODUCT_AND_BUSINESS_RULES.md)
- [Security and Production guardrails](../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md)
- [Testing and definition of done](../ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md)
- [Authoritative PostgreSQL schema design](./09_POSTGRESQL_SCHEMA_DESIGN.md)
- [Schema decision register](./10_SCHEMA_DECISION_REGISTER.md)
- [REL-001 idempotency and domain-events contract](./31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [Supplier Ownership and Claim contract](./32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [ID-001 identity authority contract](./33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [Platform role assignments contract](./34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [AUD-001 audit evidence contract](./35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [SEARCH-001 PostgreSQL search contract](./37_SEARCH_001_POSTGRESQL_SEARCH_TECHNOLOGY_CONTRACT_REVIEW.md)

### 3.2 Current implementation and focused tests

- [Workspace notification model](../../src/types/workspace.ts)
- [Workspace notification producers and inbox service](../../src/services/workspace.ts)
- [Shared notification context](../../src/contexts/NotificationContext.tsx)
- [Notification bell](../../src/components/NotificationBell.tsx)
- [Workspace notification page](../../src/pages/workspace/BuyerWorkspacePages.tsx)
- [Claim callable implementation](../../functions/src/supplierOwnership.ts)
- [Claim deterministic ID helpers](../../functions/src/supplierOwnershipCore.js)
- [Supplier-submission approval callable](../../functions/src/supplierSubmissionApproval.ts)
- [RFQ lifecycle and deterministic IDs](../../src/utils/rfqLifecycle.ts)
- [Firebase configuration](../../firebase.json)
- [Firestore Rules](../../firestore.rbac.rules)
- [Firestore indexes](../../firestore.indexes.json)
- [Claim unit tests](../../tests/supplier-ownership-claim.test.mjs)
- [Claim Functions Emulator tests](../../tests/supplier-ownership-functions-emulator.mjs)
- [Claim Firestore Rules tests](../../tests/supplier-ownership-claim-firestore-emulator.mjs)
- [RFQ lifecycle tests](../../tests/rfq-lifecycle.test.mjs)
- [RFQ Firestore Emulator tests](../../tests/rfq-firestore-emulator.mjs)
- [Notification routing tests](../../tests/portal-search-notification-routing.test.mjs)
- [Notification read-optimization tests](../../tests/firestore-read-optimization.test.mjs)

No Firebase Production record was read. Earlier schema evidence reports six notification records at its bounded observation point, but this task does not independently verify their current count, contents, classification, or migration eligibility.

## 4. Verified current notification behavior

### 4.1 Current producer map

| Current producer | Business event | Recipient | Stored fields and rendering | Deduplication / atomicity | Current retention or deletion |
|---|---|---|---|---|---|
| Undeployed `decideSupplierOwnershipClaim` callable | Claim approved or rejected | Claimant Firebase UID | `type=supplier_ownership`, actor UID, Claim reference, deterministic event ID, Arabic/English title/body, dashboard link, unread state, server time | Deterministic `supplier-ownership-{claimId}-{status}-notification`; `transaction.create` commits Claim/ownership, event, audit, and notification together; identical terminal retry returns before creating another row | No expiry/archive. User cannot delete. Admin/Owner client deletion is explicitly denied for ownership/Claim notifications. |
| Undeployed Claim callable | Competing Claim superseded by another approval | No notification recipient | A deterministic ownership event is written; no notification row | Event ID is deterministic; no materialization exists | Claim history remains; no notification lifecycle exists. |
| Undeployed Claim callable | Claim submitted, withdrawn, or expired | No notification recipient | Submission returns status/expiry directly; withdrawal/expiry writes Claim state and deterministic event where applicable | Submission request has a separate hashed idempotency document; withdrawal is idempotent; no notification dedupe is needed because none is created | Status remains in Claim history. |
| `approveSupplierSubmissionTrusted` callable | Supplier submission approved, optionally with access grant and ownership establishment | Contributor/submitting user | `type=submission`, Arabic/English snapshot, role-safe `/my-submissions` link, unread state, server time | Deterministic `supplier-submission-{submissionId}-notification`; same transaction as profile/contribution/access/audit effects | No expiry/archive. Admin clients may delete because it is not protected as `supplier_ownership`. |
| Browser workspace RFQ publish path | RFQ published to selected Suppliers | Current `accountOwnerId` values resolved before publication | `type=rfq`, Buyer actor UID, RFQ/event reference, Arabic/English snapshot, Supplier RFQ link | Deterministic `rfq-published_{rfqId}_{userId}`. RFQ and publish event commit first; notifications are later `setDoc` calls under `Promise.allSettled`. Failure is swallowed, not retried, and cannot roll back publication. Rules prevent a repeated create once the ID exists. | No expiry/archive. Admin clients may delete. |
| Browser workspace quotation submission | First quotation submitted | RFQ Buyer | `type=rfq`, Supplier actor UID, RFQ/response/event references, Arabic/English snapshot, Buyer RFQ link | Deterministic `rfq-response_{responseId}`; response, V1 revision, event, and notification commit in one batch. Retry reconciliation returns the settled response where safe. | No expiry/archive. Admin clients may delete. |
| Browser workspace quotation revision | Material quotation revision submitted | RFQ Buyer | Same, plus revision number and updated-quotation snapshot | Deterministic `rfq-response-updated_{responseId}_v{revision}`; response update, immutable revision, event, and notification commit in one transaction. A normalized no-op creates no revision, event, or notification. | No expiry/archive. Admin clients may delete. |
| Exported `createNotification` helper plus Admin Rules surface | No current call site proves a business event | Caller-supplied recipient | Generic bilingual snapshot and caller-supplied type/reference/link | Random Firestore document ID through `addDoc`; no event binding or deterministic dedupe. Current Rules permit Admin-created `approval|message|access|submission|system` rows. | No expiry/archive. Admin clients may delete. |

There is no current producer for RFQ close/cancel notifications, message notifications, security notices, billing notices, Claim-submission acknowledgements, reviewer work notices, or Claim withdrawal/expiry notifications.

### 4.2 Current rendering and read path

The current `WorkspaceNotification` model stores `titleAr`, `titleEn`, `bodyAr`, and `bodyEn`. Both the bell and notification page select exactly one pair from the active UI locale. They do not concatenate languages or translate Supplier/user-entered content. This satisfies the launch-language presentation rule and is the strongest current evidence for retaining a bilingual snapshot model.

One application-level `NotificationProvider` owns the self-only subscription, pagination, optimistic mark-one/read-all behavior, loading/error/empty states, and deduplication by notification ID. Firestore Rules allow a signed-in user to read only rows whose `userId` equals the authenticated UID and to update only `read` and `readAt` on their own row. The query is bounded and indexed by recipient and descending creation time.

Current `read` plus nullable `readAt` is redundant state. The future contract should use only `read_at`: null means unread, and a timestamp means read.

### 4.3 Current reliability and privacy gaps

- There are multiple live creation authorities rather than one materializer.
- RFQ publication can commit without its notifications and silently discard write failures.
- Claim and supplier-submission Functions couple domain mutation directly to notification storage.
- The generic helper has no deterministic business identity and no current producer contract.
- Current notification rows use Firebase UID as recipient and sometimes actor identity; that is incompatible with the approved provider-neutral relational identity contract.
- Free-form `link` is stored instead of a controlled target kind/ID resolved by the application.
- Current rows have no notification class, template/version, renderer/minimization version, retention-policy version, archive state, expiry, migration disposition, or fan-out-suppression field.
- Non-Claim notification deletion is an Admin client privilege, not a class-based trusted retention operation.
- There is no exact retry, dead-letter, replay, rollback, or partial-failure contract for all producers.

These findings describe current Firebase behavior. They do not authorize modifying or redeploying it in this task.

## 5. Viable options

| Criterion | Option A — commands insert bilingual snapshots directly | Option B — event materializer stores template key/parameters and renders on read | Option C — event materializer stores a safe bilingual snapshot plus template/version |
|---|---|---|---|
| Authority | Each trusted command owns notification insertion | One materializer owns insertion; clients render later | One materializer owns insertion and final delivery content |
| Security/privacy | Copy can be safe, but every producer must repeat minimization and routing correctly | Parameters can become a durable sensitive-data bag; every reader needs template access and validation | One allowlisted renderer minimizes once; snapshot excludes evidence, notes, contacts, and provider subjects |
| Reliability | Requires every command to solve retries and duplicates; creates dual paths with REL-001 | Event/dedupe path is reliable, but read-time template failures can make old notifications unreadable | Event/dedupe path is reliable; old notifications remain renderable after template or domain changes |
| Migration safety | Historical commands/replays can re-notify unless every producer is specially fenced | Historical events can be suppressed, but legacy parameter reconstruction may be impossible | Existing safe snapshots can be selectively imported as already materialized and fan-out-suppressed |
| Simplicity | Superficially smallest, but repeats logic across commands and conflicts with approved REL-001 | Small notification row, more complex read path and template compatibility burden | Slightly wider row, simple deterministic read path and one renderer registry |
| Claim readiness | Current Firebase proves it can work, but not as the approved relational authority | Feasible, but depends on live templates/domain state at every read | Fits approved Claim events and current bilingual product behavior |
| Future RFQ compatibility | Every RFQ command would add another direct writer | Registry can expand, but parameter schemas and live lookups grow | Same worker/registry can add later event types without changing inbox ownership |
| Maintenance/operational cost | Multiple producer implementations and inconsistent failure behavior | Long-lived template compatibility and rendering availability on every read | Versioned templates at materialization time; immutable snapshot is cheap to serve |
| Replay/rollback | Highest duplicate and partial-failure risk | Safe if event suppression is correct; old reads may drift | Safe event replay plus immutable delivery; no notification rewrite on rollback |
| Disposition | Reject for future Supabase authority | Viable but not selected | **Recommend** |

Option C is a bounded hybrid, not a generic enterprise notification platform. Template key/version prove how the snapshot was made; the snapshot, not live domain state or retained parameters, is the user-visible delivery content.

## 6. Proposed authority and materialization boundary

The proposed live path is:

```text
trusted domain command
  -> aggregate + idempotency completion + audit outcome + domain event (one transaction)
  -> one trusted notification materializer
  -> one immutable recipient/channel notification snapshot + event processed (one transaction)
```

The rules are:

1. After a feature becomes Supabase-authoritative, its domain commands never insert notifications directly.
2. Exactly one code-owned materializer is authorized to create live notification rows. Its initial enabled registry contains only the three Claim-decision events in section 7.
3. The materializer derives recipient, type, channel, template, copy, and target from the registered event contract. It ignores caller-supplied notification content, recipient, locale, link, actor, and timestamps.
4. The materializer and event `processed` transition commit in one transaction. A notification is not durable proof of the Claim decision; Claim state, ownership history, audit, and domain event retain that responsibility.
5. A separately approved migration importer may insert historical notification rows only in an `already_materialized/fanout_suppressed` mode. It is not a second live producer and cannot make an event eligible for delivery.
6. Recipient read commands may set only their own mutable `read_at`. They cannot change content, target, recipient, event, channel, timestamps, retention class, or archive state.
7. Retention/archive/privacy maintenance is a separate trusted operation. Admin/Owner browser sessions receive no generic notification insert, update, or delete authority.
8. Firebase remains authoritative for any feature not cut over. There is never a simultaneous Firebase and Supabase notification fallback for the same authoritative business event.

## 7. Claim-first notification contract

### 7.1 Minimum user-visible matrix

| Claim transition | Producer event | Audience | User-visible in Phase 1? | Content boundary | Channel / suppression | Retry and audit relationship |
|---|---|---|---|---|---|---|
| Submitted | No new notification event required by this contract | Claimant; assigned reviewer work queue later | **No** | The command response and Claim history show submission and expiry. Do not duplicate the submitted reason/evidence in an inbox row. | No channel. Reviewer assignment/list query is not notification fan-out. | Submission idempotency remains a command concern. A future reviewer-assignment event needs separate approval. |
| Approved | `supplier_ownership.claim_approved` v1 | Exact claimant user profile | **Yes; mandatory protected notice** | Generic success copy; Claim/Supplier stable IDs for target; no reviewer identity, evidence, contact, or notes | `in_app`; not preference-suppressible | Event retry is deduped by event/recipient/channel. Decision audit remains the authoritative actor/evidence record. |
| Rejected | `supplier_ownership.claim_rejected` v1 | Exact claimant user profile | **Yes; mandatory protected notice** | Generic rejection copy or an allowlisted claimant-safe notice code; never private notes, security rationale, evidence details, or unrestricted reason text | `in_app`; not preference-suppressible | Same. Rejection audit retains bounded decision evidence separately. |
| Superseded by another approved Claim | `supplier_ownership.claim_superseded` v1 | Claimant of each superseded Claim | **Yes; mandatory protected notice** | State only: the Claim is no longer active. Do not identify the approved claimant, new owner, competing Claims, or evidence. | `in_app`; not preference-suppressible | One event and notification per superseded Claim; deterministic event ordinals remain stable. |
| Withdrawn | Existing Claim transition/event where implemented | Withdrawing claimant | **No** | Immediate command response and Claim history are sufficient. | No channel | Idempotent withdrawal creates no inbox side effect. |
| Expired | Existing/future expiry transition/event | Claimant | **No in Claim v1** | Claim status/history and the previously disclosed expiry timestamp are sufficient. A scheduled-expiry notice would require an approved expiry producer and operations owner. | No channel | Expiry replay creates no notification. |
| Reviewer/Admin work notice | Future reviewer assignment/work item | Assigned usable reviewer only | **No notification in Claim v1** | Review workload belongs in a bounded assigned-Claim queue. Never broadcast Claim identity/evidence to all Admins/Owners. | No channel | A later SLA/escalation need may justify a separate event and contract. |

No Claim v1 email, push, SMS, or WhatsApp is required. The in-app seam is sufficient for the first trusted producer/consumer proof.

### 7.2 Claim templates

The initial code-owned template registry should contain exactly:

- `supplier_ownership.claim_approved.in_app` version 1;
- `supplier_ownership.claim_rejected.in_app` version 1; and
- `supplier_ownership.claim_superseded.in_app` version 1.

Each version produces non-empty bounded Arabic and English title/body pairs. Copy is generic and does not require a Supplier name. Rejection may map an allowlisted claimant-safe notice code to more useful copy only when the review policy proves that disclosure is safe; unknown or restricted codes use the generic rejection copy and never leak the internal code.

## 8. Rendering and sensitive-data contract

### 8.1 Immutable bilingual delivery snapshot

For `in_app`, materialization stores both `title_ar/body_ar` and `title_en/body_en`, plus template key/version and renderer/minimization-policy versions. The UI selects exactly one language pair from the active interface locale:

- Arabic UI renders only Arabic notification copy and RTL presentation.
- English UI renders only English notification copy and LTR presentation.
- Both language pairs are required before materialization commits. A missing translation is a template failure; there is no silent copy, machine translation, mixed-language fallback, or display of both pairs.
- Changing the user's UI language changes which already-stored snapshot pair is selected. It does not rewrite the notification.

The snapshot is immutable. Template changes create a new template version for later notifications; they do not rewrite historical content. If a Supplier name or domain label changes, the old notification remains stable. Claim v1 deliberately omits the Supplier name from notification copy, while the controlled target resolves current authorized domain state when opened.

Future templates that genuinely require domain text must use an allowlisted bounded snapshot value produced by the trusted renderer. User-entered text is not naively translated and is excluded unless a separately approved presentation contract requires it.

### 8.2 Smallest safe navigation context

Store a controlled target kind and opaque target UUID, initially:

```text
target_kind = supplier_ownership_claim
target_id   = <claim UUID>
```

The application maps that pair to the recipient-safe Claim history/detail experience, currently represented by `/supplier/ownership-claims`. Do not store a caller-supplied URL, signed URL, Firebase document path, email action, or cross-role Admin route. Opening the target rechecks current authorization. If the Claim is archived or unavailable, the immutable snapshot still renders and the target shows a safe unavailable/archived state.

### 8.3 Values that must not be stored

Neither notification columns nor template parameters may contain:

- Claim evidence documents, summaries, descriptors, URLs, digests, or submitted reason;
- full contact records, claimant snapshots, email, phone, names, job titles, or organization text;
- Firebase UID, identity-provider subject, provider response, token, credential, secret, session, or email-action data;
- reviewer identity, reviewer notes, private reason text, conflict relationship, security hold, or unrestricted error detail;
- raw request/response payloads, audit rows, audit evidence, stack traces, SQL errors, or operational logs;
- competing claimant/Claim identity, approved claimant identity, or new owner identity in a superseded notice;
- raw legacy documents, migration payloads, source fingerprints, protected classifications, or rollback metadata;
- arbitrary URLs, permanent file URLs, signed URLs, object paths, file bodies, or upload metadata; or
- live-render parameter bags capable of reconstructing protected domain records.

The materializer may use the internal event payload and authorized domain reads transiently, but persists only the approved snapshot, stable target, registry/version fields, and lifecycle metadata.

## 9. Recipient ownership, authorization, and future RLS boundary

- The durable recipient is `public.user_profiles.id`, never Firebase UID, provider-link ID, email, role, Supplier ownership row, or organization membership.
- Claim v1 stores no decision actor on the notification. Reviewer accountability belongs in audit/domain evidence and is not needed for claimant rendering.
- A notification belongs permanently to its recipient profile for its approved lifecycle. Later Supplier ownership transfer, revocation, membership, or organization changes do not move the row to a successor and do not expose it to a new owner.
- A current owner, Supplier admin/delegate, assigned reviewer, Admin, or Owner cannot read another user's inbox merely because they share a Supplier or platform role.
- Admin/Owner support access, legal export, or investigation is out of Phase 1 and would require a separately approved, purpose-limited, field-minimized, audited command/projection.
- A deactivated or suspended recipient does not cause external delivery or transfer. If the provider-neutral profile still exists, the materializer may create the protected in-app row; authentication/profile/RLS eligibility prevents access until policy permits it. A missing or mismatched recipient profile is an integrity failure and dead-letters the event.
- Future RLS must permit a currently authenticated principal to select only rows whose `recipient_user_profile_id` is their exact resolved profile and to invoke only self-scoped mark-read commands. The trusted materializer and retention service use narrowly scoped non-browser authority.
- Base-table RLS is not column security. If any support or investigation audience is later approved, it uses a minimized projection rather than direct notification-table access.

No RLS, view, grant, policy, RPC, or Auth bridge is implemented here.

## 10. Deduplication, event contract, and REL-001 readiness

### 10.1 Deterministic uniqueness and retry behavior

The canonical live uniqueness is:

```text
(domain_event_id, recipient_user_profile_id, channel)
```

For Claim v1, `channel` is exactly `in_app`. The database-generated notification UUID is an opaque row identity, not the duplicate guard.

- Repeated worker execution attempts the same unique tuple.
- If the existing row matches the immutable registered event/type/template/target/snapshot binding, the attempt is a no-op and the event may be marked processed in the same transaction.
- If the tuple exists with different immutable content or target, processing fails closed as an integrity conflict; the worker does not overwrite the row or generate a second notification.
- Completed command replay reuses the original event and therefore the same notification tuple.
- A corrected business outcome is a new trusted command and new event, not a rewrite of the old notification.
- Legacy Firebase notification identity is separately unique by approved source system/collection/document/version. It never substitutes for a live event tuple.

### 10.2 Exact Claim event dependency

The approved REL-001 envelope remains authoritative: event UUID/type/version, Claim aggregate UUID/sequence, producer command/version, idempotency/source identity and event ordinal, actor/source provenance, correlation/causation, occurred/persisted timestamps, and processing lifecycle remain envelope fields rather than notification content.

The Claim materializer consumes only these version-1 payload fields:

| Event | Required payload | Materializer use |
|---|---|---|
| `supplier_ownership.claim_approved` | Claim ID, Supplier ID, claimant user-profile ID, ownership ID, committed Claim version | Recipient, protected approved template, Claim target, integrity checks |
| `supplier_ownership.claim_rejected` | Claim ID, Supplier ID, claimant user-profile ID, committed Claim version, bounded decision reason code | Recipient, generic or allowlisted claimant-safe rejected template, Claim target, integrity checks |
| `supplier_ownership.claim_superseded` | Claim ID, Supplier ID, claimant user-profile ID, approved Claim ID, committed Claim version | Recipient, generic superseded template, Claim target, integrity checks; approved Claim ID is never copied to notification content |

Payloads contain no notification copy, locale, read state, evidence, notes, contact data, names, provider subjects, or arbitrary metadata. Recipient identity comes from the committed event and must agree with the immutable Claim. The materializer does not derive a recipient from current Supplier ownership, email, or browser input.

### 10.3 Is REL-001 ready after MSG-003 approval?

**Proposal: yes for a separate empty local-only structural foundation; no for runtime.** If the Owner approves section 18, the first producer, three event registry entries, one consumer, recipient derivation, snapshot renderer, dedupe identity, replay suppression, and failure boundary are concrete enough to authorize a later exact SQL/pgTAP task for the coherent `internal.idempotency_keys` plus `internal.domain_events` foundation selected conditionally by REL-001 Option D.

That conclusion does not authorize those tables in this proposal and does not add `notifications` to the REL foundation. Before a live Claim runtime, the following still remain:

1. exact REL SQL/constraints/indexes and focused synthetic pgTAP in a separately approved task;
2. Technical/Security/Operations approval or revision of the REL-001 lease, attempt cap, retry classes, alert ownership, and audited dead-letter requeue runbook;
3. exact calendar retention/compaction/legal-hold rules for real notification, event, and privileged idempotency rows before hosted operation;
4. implementation of Claim structures, the approved ID-001 bridge behavior, platform-role/access/bootstrap behavior, AUD-001 runtime, trusted commands, reviewer/conflict enforcement, and the notification table/materializer;
5. reviewed RLS, field-minimized projections/commands, grants, negative tests, and authority-manifest cutover/rollback behavior; and
6. `RES-001`, `MIG-002`, and explicit hosted/Production approvals before hosted execution or data movement.

These are delivery prerequisites, not missing producer/consumer semantics. MSG-003 approval would satisfy the notification-specific dependency that currently holds REL-001 at Option D's no-go point.

## 11. Notification lifecycle, retention, and read state

### 11.1 Retention classes

Notification retention is user-visible delivery retention, not the authoritative retention of the underlying domain, audit, event, or evidence record.

| Class | Examples | User-visible lifecycle | Durable evidence boundary | Exact-duration status |
|---|---|---|---|---|
| `security_privilege` | Future role/security changes that genuinely require a user notice | Mandatory, non-user-deletable; visible then server-archived under policy | Audit/security/role history remains authoritative and separately retained | Requires Security/Privacy/Legal/Operations approval before real rows |
| `claim_ownership_decision` | Claim approved, rejected, superseded | Mandatory, non-user-deletable; visible through the approved review/appeal/support horizon, then server-archived; snapshot purge only after holds and dependencies clear | Claim/ownership, audit, and event records retain decision provenance without copied evidence | Requires Product/Security/Privacy/Legal/Operations approval before hosted Claim runtime |
| `procurement_transactional` | Future RFQ published, quotation received/revised, RFQ closed/cancelled | Mandatory while the transaction and approved dispute/support horizon require it; later archive/purge by policy | RFQ/recipient/quotation/domain/audit history remains authoritative | Requires Product/Legal/Privacy/Operations approval before relational RFQ runtime |
| `informational_transient` | Future low-risk informational or reminder notice | May have a short visible expiry and may later be preference-suppressible | No notification row is durable evidence | Exact horizon and delete policy remain a later class decision |

No statutory or arbitrary calendar period is invented here. The safe interim is:

- local empty/synthetic structural work may proceed with no retention job;
- no automated hard deletion, snapshot purge, or indefinite hosted accumulation is authorized;
- before the first hosted real notification row, the listed owners must approve exact `visible_until`, archive, snapshot-purge, backup-expiry, legal-hold, privacy-erasure/pseudonymization, and jurisdiction/environment rules per applicable class; and
- retention expiry alone never authorizes deletion. A trusted maintenance operation verifies holds and dependencies and records its own required audit evidence.

Archive removes a row from the normal inbox but does not mark it unread, rewrite its content, erase the domain event, or prove legal deletion. Hard deletion is allowed only after the class policy permits snapshot purge and no hold or reconciliation/rollback dependency remains. Mandatory Claim/security/procurement notices have no browser delete action.

### 11.2 Read/unread contract

- `read_at is null` means unread; a trusted database timestamp means read. Do not store a separate mutable boolean.
- Mark-one is self-only and sets `read_at` once. Repeated calls are successful no-ops and never move the timestamp backward or create audit/domain events.
- Mark-all is self-only and applies to the recipient's visible unread rows created no later than a server-established command cutoff. Rows created after that cutoff remain unread.
- Read operations never change delivery content, archive/expiry state, retention class, event processing, or target.
- Read state is mutable user state; delivery snapshot, recipient, event, channel, class, target, and materialization timestamp are immutable.
- Concurrent materialization and mark-all resolve by the cutoff rule. Concurrent mark-one calls converge on the first trusted read timestamp.
- Read state is not security evidence and does not prove that the user understood or acted on the notice.

## 12. Phase-1 channels and preferences

- Phase 1 supports exactly `in_app`.
- Claim approved/rejected/superseded notices are mandatory and not preference-suppressible.
- No `notification_preferences` table is needed for Claim v1.
- Email is a later optional channel requiring provider, address authority, localization-at-send, consent/mandatory classification, bounce/suppression, retry, delivery receipt, and retention contracts. No email address belongs in the notification row.
- Push, SMS, and WhatsApp are out of scope and have no reserved runtime infrastructure.
- Adding a channel requires a separate channel-specific delivery/receipt contract. `domain_events.processed` proves only that the registered materialization transaction committed, not external delivery.

## 13. Existing Firebase notification migration

The proposed default is **selective migration as already-materialized inbox history**, not blind migration and not event replay.

Before choosing any per-record transformation, a separately approved bounded read must establish:

- current collection count and safe fingerprints, with TEST classification preserved;
- document ID, recipient UID-to-profile mapping, created/read timestamps, type, reference kind/ID, event/cause link, and deterministic-ID validity;
- exact bilingual field presence, bounds, encoding, locale safety, and prohibited-content scan;
- whether the recipient and target map uniquely and remain permitted under the approved authority manifest;
- duplicates, orphaned references, arbitrary links, unsupported types, forged/unproved actor fields, and any admin-created generic notices;
- relationship to historical RFQ/quotation/Claim events and whether a matching notification already exists; and
- legal/privacy/retention classification for each candidate class.

Transformation rules are:

1. Migrate only rows with a unique recipient profile, safe bilingual content, supported class/type, coherent target, trustworthy source identity, and approved retention disposition.
2. Preserve the legacy source identity and original creation/read evidence where proved; mark the row `already_materialized` and `fanout_suppressed`.
3. Mark related imported events processed/suppressed for the notification consumer. Never make historical events pending merely to reconstruct a notification.
4. Quarantine ambiguous recipient, target, cause, content, classification, or duplicate evidence. Quarantine emits no notification and exposes no row to a user.
5. Discard only with an explicit no-target disposition and approved Data/Privacy retention decision. Absence of proof is not permission to delete.
6. Historical replay uses the same event ID and duplicate guard where an approved live event exists; it never clones an event, changes snapshot content, or sends a new notification.

No Production inspection, export, migration, quarantine, discard, or replay is authorized here.

## 14. Narrow future RFQ compatibility

The same single materializer may later add registered templates for:

- `rfq.published` to the immutable authorized recipient anchor;
- `quotation.submitted` to the RFQ Buyer party;
- `quotation.revised` to the RFQ Buyer party;
- `rfq.closed`; and
- `rfq.cancelled`.

This proposal does not approve those events, recipients, templates, or retention durations. A future RFQ contract must preserve the event-time recipient authorization anchor and cannot derive historical visibility from whoever owns a Supplier later. It must also preserve no-op behavior: an unchanged quotation creates no revision, event, or notification.

Future RFQ commands follow the same rule as Claim: domain commands emit events and never insert notifications after the Supabase outbox becomes authoritative. The current Firebase RFQ paths remain evidence and are not redesigned or changed by this proposal.

## 15. Conceptual future `notifications` table boundary

The minimum logical field groups are:

| Field group | Proposed content |
|---|---|
| Stable identity | Database-generated opaque notification UUID |
| Recipient | Non-null restrictive `recipient_user_profile_id` |
| Origin/dedupe | Non-null `domain_event_id` for live rows; `channel`; unique event/recipient/channel; separately unique bounded legacy source identity for approved imports |
| Classification | Stable notification type, retention class, mandatory/protected flag where not derivable from the registry |
| Rendering provenance | Template key/version, renderer version, minimization-policy version |
| Immutable snapshot | Bounded non-empty `title_ar`, `body_ar`, `title_en`, `body_en` |
| Safe target | Controlled target kind plus opaque target UUID; no arbitrary URL |
| Materialization | Trusted `materialized_at`; import classification and fan-out-suppressed state where applicable |
| User state | Nullable `read_at` only |
| Lifecycle | Retention-policy version; nullable visible-until, archived-at/reason, and snapshot-purge eligibility only after exact policy approval |

Exact names, types, lengths, constraints, indexes, partitioning, comments, RLS, grants, and pgTAP remain a separate technical task. Do not add JSONB template parameters, actor identity, recipient locale, delivery receipts, arbitrary metadata, or a generic reference polymorphism merely for future flexibility.

The table must not store any value prohibited by section 8.3. It is a delivery/read projection, not an outbox, audit log, event store, Claim history, message body, file relation, identity mapping, or migration record dump.

## 16. Failure, recovery, replay, and rollback

| Scenario | Proposed behavior |
|---|---|
| Worker crash after event commit but before materialization transaction | Event remains/reverts to eligible processing after fenced lease expiry. Retry uses the same event and unique tuple. |
| Crash during notification insert/event completion | Both changes roll back because they share one database transaction. |
| Crash after the transaction commits | Notification and processed event both exist. Redelivery observes processed state or the exact unique row and performs no duplicate insert. |
| Duplicate invocation or overlapping workers | Atomic claim/fenced lease gives one current attempt. Unique event/recipient/channel is the final guard. Stale workers cannot complete. |
| Existing unique row differs from expected immutable binding | Fail closed as integrity conflict; do not overwrite, clone, mark processed, or fall back to Firebase. Alert/reconcile under the approved operator runbook. |
| Recipient profile exists but is suspended/deactivated | Materialize only the protected in-app row; no external delivery. Current Auth/profile/RLS denies access. Retention/privacy policy governs later archive or erasure. |
| Recipient is missing, ambiguous, or mapped to a different Claimant | Permanent integrity failure/dead letter. No alternate recipient is inferred from email, Supplier ownership, Firebase UID, or name. |
| Template/renderer unavailable transiently | Retry with bounded backoff under REL-001. |
| Unsupported event version, missing translation, invalid safe code, or prohibited rendering input | Permanent contract failure/dead letter with bounded safe error code; no partial or English/Arabic fallback. |
| Domain target archived/deleted after materialization | Snapshot remains stable. Opening the controlled target returns an authorized archived/unavailable state; no content rewrite. Restrictive domain retention should normally preserve Claim history. |
| Historical migration/replay | Imported events are processed/fan-out-suppressed; imported notifications are already materialized. No new user-visible row or external channel is emitted. |
| Business correction | New trusted compensating command and event create a new notification if its registry requires one. Old event/notification are not rewritten or deleted. |
| Feature rollback | Freeze and reconcile under one authority manifest. Retain committed events and notifications. Never silently resume Firebase notification creation for Supabase-authoritative events or dual-send from both systems. |

Operational telemetry may record bounded attempt counts, latency, outcome codes, and alerts. It must not copy event payloads, notification bodies, Claim evidence, contact data, or unrestricted exceptions.

## 17. Relationship to remaining Open gates

| Open gate | Blocks this proposal or local structural design? | Blocks hosted Claim notification delivery or data movement? | Conclusion |
|---|---|---|---|
| `ORG-001` | No. Approved Claim v1 uses one human claimant/controller and no organization authority. | Only if a later design makes organizations recipients/owners/tenants. | Unrelated to the approved unowned-Supplier Claim v1 boundary. |
| `ORG-002` | No. No organization membership/bootstrap is needed for the Claimant inbox. | Only if organization-derived authority is introduced. | Unrelated to Claim v1. |
| `MSG-002` | No. Notification copy contains no message body and Claim v1 does not depend on conversations. | Blocks only future messaging retention/tombstone/export behavior. | Unrelated to Claim notifications. |
| `FILE-001` | No under the approved bounded non-file Claim evidence path. | Conditional: blocks a Claim implementation that stores managed file objects/evidence. | Avoided by Claim v1; not silently resolved. |
| `BILL-001` | No. No billing channel, entitlement, or provider behavior is used. | No for Claim. | Unrelated. |
| `RES-001` | No for documentation or empty local-only structures. | Yes for hosted environment/resource selection and operational runtime. | Hosted-only blocker. |
| `MIG-002` | No for documentation or empty local-only structures. | Yes for real Firebase-to-Supabase mapping, replay classification, cutover, rollback, and data movement. | Migration/hosted blocker. |

Therefore none of the other seven Open gates blocks this MSG-003 contract or a later empty local structural notification/reliability task. `FILE-001` becomes a runtime blocker only if the selected Claim evidence path changes to stored files. `RES-001` and `MIG-002` block hosted operation/data movement, not local structural design. `ORG-001`, `ORG-002`, `MSG-002`, and `BILL-001` are unrelated to Claim-first notification delivery.

Separate non-gate runtime blockers remain exactly those listed in section 10.3. This proposal resolves none of them.

## 18. Explicit Owner decisions required to resolve MSG-003

The Owner may resolve MSG-003 with one coherent approval of these three combined decisions:

1. **Authority and rendering:** approve Option C — trusted command to domain event to exactly one live materializer; immutable safe bilingual `in_app` snapshot with template/version provenance; no command-side insert, live rendering, arbitrary parameters, or mixed-language fallback.
2. **Claim-first behavior:** approve mandatory claimant-only notifications for `approved|rejected|superseded`; no submitted/withdrawn/expired/reviewer-work notification in Claim v1; provider-neutral recipient, controlled Claim target, sensitive-data exclusions, and no external channel or user suppression.
3. **Lifecycle and reliability:** approve event/recipient/channel uniqueness, self-only nullable `read_at`, protected class-based archive/purge boundaries, no browser deletion, selective already-materialized Firebase import with fan-out suppression, the failure/rollback rules, and the conclusion that this approval makes the separate empty local REL-001 two-table foundation contractually ready while leaving runtime and exact calendar retention/operations approvals gated.

If any item is not approved, MSG-003 remains Open and the exact disagreement should be recorded without implementing SQL or runtime.

## 19. Risks, validation, and exact stop point

The principal risks are retaining dual notification creators; allowing RFQ-style best-effort loss; storing sensitive template parameters; exposing both languages; deriving recipients from mutable ownership; leaking reviewer/conflict evidence; treating read state as audit proof; indefinite ungoverned retention; deleting protected notices through an Admin client; replaying historical events; and silently falling back to Firebase after Supabase authority. The proposed contract fails closed on each risk.

Required validation for this proposal is documentation-only:

- exact starting SHA `b76888f0d2d8a769ba67bbaa70199ca458f13f87` recorded;
- current 13 tracked local SQL migrations, 19 physical PostgreSQL tables, and 17 implemented / 19 deferred Core Phase 1 concepts preserved;
- exactly eight Open gates preserved, including MSG-003;
- repository evidence links resolve;
- verified evidence is distinguished from proposals;
- Firebase Production versus local-only Supabase terminology is preserved;
- sensitive-value and stale-terminology scans pass;
- `git diff --check` passes; and
- diff contains no executable, SQL, configuration, baseline, or Decision Register change.

Exact stop point: commit and push this one standalone proposal and open a Draft PR. Stop before Owner approval, MSG-003 resolution, baseline/Decision Register synchronization, Ready-for-review transition, merge, SQL/pgTAP, notification/event/idempotency/Claim/RLS/Auth runtime, Firebase or hosted Supabase access, Production/TEST data operation, migration, deployment, or external-channel work.

## 20. References

- [Firestore-to-PostgreSQL mapping draft](./02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [Cutover and rollback principles](./06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md)
- [Authoritative PostgreSQL schema design](./09_POSTGRESQL_SCHEMA_DESIGN.md)
- [Schema decision register](./10_SCHEMA_DECISION_REGISTER.md)
- [Schema review checklist](./11_SCHEMA_REVIEW_CHECKLIST.md)
- [REL-001 idempotency and domain-events contract](./31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [Supplier Ownership and Claim contract](./32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [ID-001 identity authority contract](./33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [Platform role assignments contract](./34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [AUD-001 audit evidence contract](./35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [SEARCH-001 PostgreSQL search contract](./37_SEARCH_001_POSTGRESQL_SEARCH_TECHNOLOGY_CONTRACT_REVIEW.md)
- [Claim Supplier backend deployment status](../claim-supplier-backend-deployment.md)
- [Current baseline](../ai-context/01_CURRENT_BASELINE.md)
