# Claim Supplier Profile structural and trusted-command readiness review

Status: **Recommendation only; no Owner selection, gate resolution, SQL, runtime, data, or Production action is authorized**

Review date: 2026-08-09

Verified starting point: `origin/main` at `f5ee83096851991de680183c072b16987cb8784f`, the merge of PR #94

Primary task profile: Supplier

## 1. Scope, evidence labels, and hard boundary

This review determines the smallest dependency-safe relational structure needed to move Claim Supplier Profile from its approved Product/Data/Security design toward a later trusted workflow. It specifically tests whether one new `public.supplier_ownership_claims` table should be the next Claim-specific local structural slice after the separately eligible REL two-table foundation.

The evidence labels used below are:

- **Verified current fact** — proved by the repository at the starting SHA or its focused Claim tests.
- **Approved existing contract** — fixed by an already Owner-approved predecessor contract, but not necessarily implemented.
- **Recommendation — not approved** — this review's proposed next boundary; it is not an Owner selection or implementation authorization.
- **Open delivery decision** — a named choice still required before real rows, runtime, hosted work, or data movement.

This is one standalone documentation artifact. It does not resolve any Open gate, select SQL on behalf of the Owner, change the shared baseline or decision register, or authorize SQL, pgTAP, RLS, an Auth bridge, Firebase work, Production reads, hosted Supabase, migration, notifications, files/uploads, deployment, Ready status, or merge.

## 2. Root finding

**Verified current fact:** The Firebase Claim implementation is present on GitHub but undeployed. It persists one private Claim document containing claimant, Supplier, status, claimant snapshot, reason, one evidence type/summary, up to three HTTPS references, submission/expiry times, and later terminal fields. Separate Firebase guard/event/request collections provide current concurrency, event, and idempotency behavior, but their document shapes are not authoritative relational boundaries.

**Approved existing contract:** The authoritative design already classifies `supplier_ownership_claim_evidence` and `supplier_ownership_events` as Remove/Merge concepts, keeps `supplier_claim_rate_limits` Deferred, keeps files Future-Compatible behind FILE-001, and defines `supplier_ownership_claims` as the one private Claim aggregate. Document 32 approves the lifecycle, evidence maximum, ordinary unowned-Supplier boundary, reviewer conflict rules, and design-only `supplier_ownership.decide_claim` contract. Document 39 resolves MSG-003 and makes the coherent REL foundation structurally eligible without making Claim runtime ready.

**Recommendation — not approved:** After the separately selected/implemented REL foundation, the next Claim-specific structural slice should create exactly one new empty, fully revoked, local-only table: `public.supplier_ownership_claims`. One table is sufficient for Claim v1's structural foundation. It should contain the Claim's bounded immutable submission/evidence snapshot, lifecycle, current write-once reviewer-assignment seam, decision result/provenance fields, resubmission/supersession links, and a nullable unique resulting-ownership reference. It should not create evidence, reviewer-assignment, Claim-event/history, rate-limit, attachment, file, notification, or generic metadata tables.

The recommendation is dependency-safe because the local structural roots already exist: `public.user_profiles`, `internal.identity_provider_links`, `public.supplier_profiles`, `public.supplier_ownerships`, `public.platform_role_assignments`, and `internal.audit_logs`. It is not runtime-ready: identity/Auth bridge behavior, role-backed access/bootstrap, reviewer assignment, Claim trusted commands, REL processing, audit runtime, notification storage/materialization, security delivery, exact retention/registry decisions, and hosted approvals remain unimplemented.

## 3. Current Firebase Claim fields to authoritative relational concepts

The mapping below is a design mapping only. It performs no migration and does not assume that Production counts remain zero.

| Current Firebase evidence | Authoritative relational concept | Treatment |
|---|---|---|
| Claim document ID | Claim UUID plus nullable unique legacy source identity | New rows use a database-generated opaque UUID. A migrated Firebase ID is preserved only through an approved source disposition/mapping. |
| `claimantUserId` | `claimant_user_profile_id` | Restrictive FK to the provider-neutral `user_profiles` principal; never store Firebase UID as the domain party. |
| `supplierProfileId` | `supplier_profile_id` | Restrictive FK to the canonical Supplier listing. It does not itself prove eligibility or ownership. |
| `pending_review` | `submitted` unless assignment evidence proves `under_review` | Opening or reading a Claim does not prove reviewer assignment. |
| `approved|rejected|withdrawn|expired|superseded` | Same bounded terminal meanings | Preserve only when source transition, actor/time, target, and integrity evidence reconcile; otherwise quarantine. |
| `claimantSnapshot` | Bounded, versioned private submission snapshot | Immutable after submission; minimized to fields actually required for review. It is not provider identity or authorization evidence. |
| `claimReason` | Bounded private submitted reason | Immutable; not copied into audit, event, notification, search, or public projections. |
| `evidenceType`, `evidenceSummary`, `referenceLinks` | Up to three bounded structured evidence descriptors | Store on the Claim as a schema-versioned bounded aggregate value. Do not create an evidence child table for v1. |
| `createdAt` | `submitted_at` and database record time | Trusted submission time starts the fixed 30-day horizon. |
| `updatedAt` | Record version plus trusted transition times | A generic update timestamp is not authoritative history by itself. |
| `expiresAt` | Immutable `expires_at` | Exactly 30 calendar days after trusted submission for v1; no silent extension. |
| `reviewedBy`, `reviewedAt` | Decision actor and decision time | Provider-neutral actor FK plus trusted time; the actor is derived by the command. |
| `adminNotes` | Bounded restricted reviewer notes | Never returned to claimant or copied into events/notifications. |
| `withdrawnBy`, `withdrawnAt` | Claimant terminalization provenance | Claimant must be the same resolved profile and currently eligible under the approved policy. |
| `supersededByClaimId` | Restrictive self-reference to the approved/replacement Claim | The referenced Claim does not expose the other claimant to ordinary users. |
| `decisionEventId` | Later domain-event reference/evidence | The event is a separate REL fact. It must not become Claim authority or a substitute for Claim state. |
| `supplierClaimantLocks` | Relational active-pair constraint plus row/advisory locking in trusted commands | Do not create a permanent Claim-lock business table. The Firebase one-active-Claim-per-claimant-global behavior is not the approved relational cardinality. |
| `supplierOwnershipClaimRequests` | REL idempotency source disposition | Do not create a Claim request table or reuse an opaque Firebase digest as a raw Supabase key. |
| `supplierOwnershipEvents` | Claim/ownership state plus canonical `domain_events` and `audit_logs` | Do not create a separate ownership-events table. |
| `supplierClaimSearchRateLimits` | Runtime abuse-control service or later short-lived security bucket | It is not Claim domain structure and does not belong in this slice. |

### 3.1 Minimum logical Claim record

**Recommendation — not approved:** The one-table foundation needs these logical field groups; exact names, types, lengths, checks, indexes, comments, and pgTAP remain a later technical selection:

1. **Identity and parties:** Claim UUID, optional legacy source identity, claimant user-profile FK, Supplier-profile FK, and record version.
2. **Immutable submission:** submitted time, fixed expiry, bounded reason, versioned minimized claimant snapshot, immutable submission fingerprint, and up to three bounded evidence descriptors.
3. **Lifecycle:** exactly one status from `submitted|under_review|approved|rejected|withdrawn|expired|superseded`, plus the status-specific trusted times and bounded terminal reason code.
4. **Reviewer seam:** nullable assigned-reviewer user-profile FK, assignment version, assigned time, assigning actor/source, and assignment-policy version.
5. **Decision:** decision actor, decision time, bounded decision reason code, evidence-verification method/version/outcome, optional restricted notes, and authorization-policy version.
6. **Relationships and result:** optional prior-Claim self-reference for permitted resubmission, optional superseding-Claim self-reference, and nullable unique resulting `supplier_ownerships` FK required for `approved`.
7. **Migration and minimization metadata:** source classification and bounded versioned evidence references only where the migration contract requires them; no raw source document or unrestricted metadata dump.

The resulting ownership FK is provenance, not a second authority. Current control remains the one active row in `supplier_ownerships`; the Claim records why one row was created.

## 4. Is one table sufficient?

### Option A — one Claim aggregate table

**Boundary:** One `public.supplier_ownership_claims` table contains bounded immutable evidence descriptors, lifecycle, one durable reviewer-assignment seam, decision evidence, resubmission/supersession links, and resulting ownership reference.

**Benefits:** Matches the approved aggregate; enforces party/target/status/cardinality close to the data; avoids premature file, assignment, event, and rate-limit abstractions; and gives later trusted commands a durable versioned row to lock.

**Cost/risk:** Reviewer reassignment cannot grow into a multi-reviewer work-management system without later design. Evidence-descriptor checks require a strict versioned schema and trusted validation.

**Disposition:** **Recommend, not approved.** This is the smallest sufficient Claim v1 structural foundation.

### Option B — Claim plus normalized evidence child table

**Boundary:** Add `supplier_ownership_claim_evidence` for one row per descriptor.

**Benefit:** Independent querying, retention, or file custody could be added per item.

**Cost/risk:** Current and approved v1 evidence is capped at three immutable descriptors, no query path requires independent evidence rows, FILE-001 is Open, and a child table encourages premature file/object custody and retention divergence.

**Disposition:** Reject for v1. The authoritative phase manifest already says Remove/Merge.

### Option C — Claim plus reviewer work-assignment table

**Boundary:** Add a separate temporal work-assignment relation for reviewers, reassignment, queue/SLA, and escalation.

**Benefit:** Clean multi-assignment history and future workload management.

**Cost/risk:** Claim v1 requires one current assigned reviewer, not teams, shifts, queues, SLA escalation, delegation, or parallel review. No current runtime behavior proves those needs. The extra table would create a new authority surface and policy before a concrete workflow exists.

**Disposition:** Defer. A separate relation becomes justified only if the Owner approves reassignment history, multiple reviewers, queue/SLA ownership, or delegation that a single write-once Claim assignment cannot represent.

### Option D — defer all Claim structure until complete runtime delivery

**Boundary:** Keep `supplier_ownership_claims` Core Later until Auth, RLS, audit, REL, notifications, retention, and hosted strategy are all implemented.

**Benefit:** No inert table and no risk of mistaking structure for readiness.

**Cost/risk:** Those dependencies govern real rows and access, not the FK/lifecycle shape of an empty revoked aggregate. Deferral prevents the next trusted-command design from binding to an exact relational Claim root even though all structural parents already exist.

**Disposition:** Viable conservative alternative, but not preferred. It is safer only if the Owner does not want to advance Claim from Core Later now.

## 5. Exact Claim lifecycle

| Status | Meaning | Allowed next state | Actor class | Required time/provenance |
|---|---|---|---|---|
| `submitted` | Accepted immutable Claim awaiting durable assignment | `under_review`, `withdrawn`, `expired`, `superseded` | Claimant submits; trusted service validates | `submitted_at`, fixed `expires_at`, claimant/source, submission fingerprint |
| `under_review` | One current eligible reviewer was durably assigned | `approved`, `rejected`, `withdrawn`, `expired`, `superseded` | Trusted assignment command; assigned usable Admin/Owner | assignment actor/source, reviewer, assignment version/policy, `assigned_at` |
| `approved` | Terminal decision created exactly one active primary-controller ownership row | None | Assigned usable Admin/Owner; separately approved Owner override only | `decided_at`, decision actor/role assignment, reason, evidence-verification result, resulting ownership |
| `rejected` | Terminal reviewed decision created no ownership | None | Same assigned/override decision boundary | `decided_at`, decision actor, rejection reason, evidence-verification result where applicable |
| `withdrawn` | Terminal claimant closure before decision | None | Same claimant through trusted command | `withdrawn_at`, claimant actor, bounded reason if the future policy requires one |
| `expired` | Terminal close when the fixed horizon ends | None | Trusted scheduled/ingress expiry command; never a fabricated human | `expired_at`, system/service source and policy version |
| `superseded` | Terminal close because another Claim was approved or a reviewed replacement became authoritative | None | `decide_claim` for competing Claims or separately approved replacement command | `superseded_at`, bounded reason, restrictive successor Claim reference |

The only active statuses are `submitted` and `under_review`. All terminal statuses are immutable and never reopened. A rejection is not changed back to active; a permitted resubmission creates a new Claim referencing the rejected Claim. An ownership transfer/revocation does not rewrite an approved Claim.

### 5.1 Reason-code and immutability boundary

- The submitted reason and evidence are bounded private claimant content, not a decision code.
- Decision, withdrawal, expiry, supersession, resubmission eligibility, and security-hold reasons use code-owned bounded registries; localized copy and unrestricted error text are excluded.
- Rejection requires a decision reason. Approval records a bounded approval reason/result code. Claimant-safe notice disclosure is a separate allowlist from the internal reason.
- Claim ID, parties, target Supplier, submitted reason/snapshot/evidence, submission time/fingerprint, fixed expiry, and prior-Claim link are immutable.
- Assignment fields are write-once in the minimum v1 structure. Decision and terminal fields are write-once. Status moves only through the table above.
- **Open delivery decision:** If v1 must support reviewer reassignment or Owner override before decision, the Owner must approve its authority and history model. Until then, no in-place reassignment is implied.

## 6. Ordinary Claim eligibility predicates

These predicates are structural/runtime requirements, not implemented policy:

1. **Supplier exists:** one current `supplier_profiles` row resolves by exact UUID and passes the approved listing/verification/security eligibility policy. A listing being verified does not prove ownership.
2. **Supplier is unowned:** no current `active` primary-controller `supplier_ownerships` row exists at the authoritative time. The one-active-owner constraint and transaction lock protect the slot.
3. **Usable provider-neutral claimant:** one active `user_profiles` row resolves through one exact active Firebase `identity_provider_links` row without collision, ambiguity, suspension, or quarantine.
4. **Firebase authority remains current:** the trusted boundary validates the Firebase token and obtains current Firebase Admin existence, disablement, and verification evidence in the high-risk authorization attempt. PostgreSQL mirrors alone cannot satisfy this predicate.
5. **No same-pair active Claim:** no `submitted` or `under_review` Claim exists for the same claimant/Supplier pair. A partial uniqueness rule or equivalent trusted enforcement protects this pair; one claimant may claim different Suppliers and different claimants may concurrently claim the same unowned Supplier.
6. **No ownership conflict:** Firebase remains the authority before cutover; after an approved Supabase ownership cutover, the relational active ownership slot is authoritative. The two authorities are never mixed or used as fallbacks inside one command.

Submission performs no ownership mutation. Approval repeats all mutable eligibility checks; a valid submission never reserves ownership.

## 7. Claim evidence and FILE-001

**Approved existing contract:** Claim v1 may use at most three bounded immutable evidence descriptors. Each descriptor has a controlled kind, claimant summary, source/provider class, bounded source reference, submission provenance, and optional approved digest/identifier. The kind is classification, not proof. Approval requires a reviewed high-assurance method under document 32.

**Recommendation — not approved:** Keep the descriptors on the Claim in a versioned bounded aggregate value. Permit only:

- controlled evidence kinds;
- bounded structured summaries and source classes;
- code-owned allowlisted public HTTPS references on the standard port, or preserved legacy references under a separately approved migration classification;
- no credentials, private/local addresses, signed URLs, arbitrary schemes, permanent object paths, or unrestricted public URLs; and
- no `file_objects` FK, upload session, attachment row, object metadata, or claim that a URL proves custody.

The current Firebase validator proves HTTPS-only, bounded, unique references and rejects credentials, private hosts, and non-standard ports. It does not by itself prove the stricter future allowlist or continuing custody; the relational trusted command must enforce the approved pre-FILE reference policy.

**Explicit answer:** Yes. Claim v1 structural SQL can proceed while FILE-001 remains Open because the selected path needs no stored file object or upload. FILE-001 becomes a runtime blocker only if the product later requires managed files, private documents, object custody, signing, scanning, or file-backed evidence. This answer does not resolve FILE-001.

Evidence content, summaries, URLs, digests, reviewer notes, contact snapshots, and private reasons never enter notification or domain-event rows. Audit stores only bounded verification method/version/outcome and a restricted descriptor/reference where justified.

## 8. Reviewer model

**Approved existing contract:** `reviewer` is not a platform role. The decision actor must be a currently usable `admin` or `owner`, hold the current Claim assignment unless a separately approved Owner override applies, and have no claimant, owner, membership/delegation, or security conflict.

**Recommendation — not approved:** Use nullable assignment fields on the Claim row for one write-once v1 assignment. Moving `submitted` to `under_review` requires a trusted assignment command to set the reviewer, assignment version, assigning actor/source, policy version, and time atomically. The assigned reviewer queue queries this durable Claim state. Assignment never grants authority without the independent active platform role, Firebase/link/profile/access/security predicates, and command policy.

The alternatives are rejected as follows:

- A single `reviewer_user_profile_id` without version/provenance is insufficient.
- Runtime-only or in-memory assignment is insufficient because `decide_claim` must re-read durable assignment/version under lock and fail closed after restart or retry.
- A separate work-assignment table is not required for one write-once reviewer and would be premature.
- A browser update cannot assign or reassign work.

**Open delivery decision:** Before reviewer-assignment runtime, approve the assignment command's allowed assigning roles, queue ownership, conflict checks, assignment timeout if any, and whether v1 supports reassignment or Owner override. A need for multiple reviewers, reassignment history, delegation, shifts, SLA/escalation, or assignment acceptance should trigger a separate work-assignment contract/table review rather than mutating the minimal Claim row opportunistically.

## 9. Concurrency and retry behavior

| Scenario | Required behavior |
|---|---|
| Two users claim the same unowned Supplier | Both active Claims may exist because uniqueness is per claimant/Supplier pair. No submission reserves ownership. |
| Both Claims are approved concurrently | Each decision reserves its idempotency attempt, then locks the Claim, Supplier, active ownership slot, and every active competing Claim in deterministic order. Exactly one transaction creates ownership. The other attempt observes changed state/ownership and fails closed or replays its already-committed result. |
| One Claim is approved while another remains active | The approval transaction marks the selected Claim `approved`, creates one ownership, and marks every other `submitted|under_review` Claim for that Supplier `superseded` with a restrictive reference to the approved Claim. One event is created per affected Claim in stable Claim-ID order. No arbitrary conflict-count cap may define correctness. |
| Supplier becomes owned through another trusted path | `decide_claim` writes nothing and returns `supplier_already_owned` or an integrity/quarantine failure. It does not auto-link or auto-transfer. An authorized later action may reject with `existing_owner` or route to transfer/dispute. |
| Reviewer retries approval after timeout | Same scoped key and fingerprint replays the safe committed result. Same key with changed binding fails `idempotency_key_conflict`. A new key against a terminal Claim fails `claim_not_reviewable`; it does not create another ownership/event/audit success. |
| User resubmits after rejection | Create a new Claim referencing the prior rejected Claim only if the Supplier is still unowned, the same pair has no active Claim, the reason permits resubmission, materially new/corrected evidence exists, and any cooldown/hold is cleared. Never reopen or overwrite the rejected Claim. |
| Claim reaches expiry | A trusted expiry path locks/re-reads the active Claim, records `expired`, and prevents later approval. Claim row/history is sufficient for v1; no notification is produced. A domain event is unnecessary until a named consumer is separately approved. |

The current Firebase implementation proves atomic Claim creation, claimant lock behavior, one-winner concurrent approval, competing-Claim supersession, terminal withdrawal/rejection/expiry, and deterministic side effects. It also uses one global claimant lock and a maximum-20 conflict query. Those two implementation details are explicitly not copied: the approved relational cardinality is per claimant/Supplier pair, and approval correctness must cover all active competing Claims without an arbitrary maximum.

## 10. Ownership output and authority

An approved Claim produces exactly one temporal `supplier_ownerships` row in the same trusted transaction:

- Supplier and owner are the Claim's server-derived FK parties;
- authority type is initially `primary_controller`;
- status is `active`, `valid_from` is trusted decision time, and `valid_until`/closure fields are empty;
- establishment source is `claim_approval`, with bounded reason/policy provenance; and
- the Claim's unique resulting-ownership reference points to that row.

The ownership row is the only post-cutover source for current controller authority. The approved Claim is immutable provenance for why it was created. `users.supplierProfileId`, `suppliers.accountOwnerId`, notifications, audit rows, domain events, reviewer assignment, email/domain matches, and organization/member text are not parallel ownership authorities.

The command checks both directions for integrity but does not dual-write Firebase backlinks after Supabase authority. Before cutover, Firebase remains authoritative and no relational real row is activated.

## 11. Future `supplier_ownership.decide_claim` dependency map

### 11.1 Trusted inputs

- high-entropy `idempotency_key`;
- `claim_id`;
- positive `expected_claim_version`;
- exactly `approve|reject`;
- bounded `decision_reason_code`;
- optional bounded restricted `reviewer_notes`;
- bounded evidence-verification method/version/outcome and restricted descriptor references; and
- optional opaque correlation UUID.

Actor, role, claimant, Supplier, ownership, timestamps, event/audit/notification IDs, eligibility, and result IDs are server-derived.

### 11.2 Lock and re-read order

1. idempotency record and fenced lease;
2. actor profile, exact Firebase link/current provider state, platform role, administration access, security state, and conflict relationships;
3. Claim row, expected version, durable assignment version, status, expiry, and immutable submission fingerprint;
4. claimant profile, link/current Firebase state, account/access/security eligibility;
5. Supplier listing/verification/security eligibility;
6. active ownership slot and relevant history;
7. every active competing Claim for the Supplier in stable order; and
8. evidence-verification inputs plus quarantine/security holds.

### 11.3 Checks

Both decisions require a current usable human Admin/Owner, current assignment or approved Owner override, no conflict, `under_review`, unexpired and unchanged Claim, coherent immutable data, and supported evidence-verification input. Approval additionally requires an eligible claimant/Supplier, verified evidence outcome, no current owner, and no unresolved ownership/identity/source conflict. Rejection does not require ownership eligibility to remain true.

### 11.4 Atomic writes

Approval commits together:

1. selected Claim terminalized as `approved` with write-once decision and resulting ownership;
2. exactly one active `supplier_ownerships` row;
3. every competing active Claim terminalized as `superseded`;
4. idempotency completion and safe result binding;
5. exactly one primary success audit outcome; and
6. one deterministic `claim_approved` event plus one `claim_superseded` event per superseded Claim.

Rejection commits Claim terminalization, idempotency completion, one primary success audit outcome, and one `claim_rejected` event; it writes no ownership. A denied/conflicted accountable attempt writes no domain mutation or event and receives the separately minimized AUD-001 outcome. The command never inserts a notification.

### 11.5 Consequences after commit

The single Claim-decision materializer consumes `claim_approved|claim_rejected|claim_superseded`, derives the exact claimant recipient, creates one immutable bilingual `in_app` snapshot unique by `(domain_event_id, recipient_user_profile_id, channel)`, and marks the event processed in the same materializer transaction. No evidence, notes, contacts, reviewer identity, competing claimant, private reason, provider subject, or arbitrary URL is persisted in event/notification rows.

### 11.6 Safe result and failures

The result is limited to outcome code, Claim ID/status/version, Supplier ID, nullable ownership ID, primary event ID, superseded count, and replay flag. Stable failures include the document-32 classes such as unauthorized actor, reviewer conflict, non-reviewable/expired/stale Claim, claimant/Supplier ineligibility, existing owner, unverified evidence, security quarantine, idempotency conflict, and reconciliation-required integrity failure. Failures reveal no unrelated owner/claimant/Claim details.

## 12. Non-duplicated history boundary

| Store | Authoritative responsibility | Explicit exclusions |
|---|---|---|
| Claim row/history | Submitted Claim content, parties, active/terminal lifecycle, assignment, decision result, resubmission/supersession links, resulting ownership | Not current ownership authority, retry processing, notification delivery, or complete security investigation |
| `supplier_ownerships` | Temporal primary-controller authority, establishment and later transfer/revocation/closure history | Not Claim evidence/review, platform role, membership, or event delivery |
| `audit_logs` | Accountable actor/source, authorization snapshot, attempt/outcome/reason, policy/evidence-verification versions, and minimized investigation evidence | Not Claim state, outbox, request dump, evidence content, or user-visible history |
| `domain_events` | Minimal immutable committed facts for named consumers plus outbox processing | Not event sourcing, Claim/ownership reconstruction, audit detail, reviewer notes, notification copy, or evidence |

Only `claim_approved`, `claim_rejected`, and `claim_superseded` need Claim v1 domain events because they have the approved notification consumer. Submitted, assigned, withdrawn, and expired state belongs in the Claim row unless a later named consumer justifies another event. Corrections use new trusted commands/audit/events where required; no store silently rewrites another store's history.

## 13. Read-only verification before any migration or cutover

The historical zero counts are not current authority. No Production read is performed by this review. Before any separately approved Claim migration/cutover, a bounded read-only verification must record:

1. exact current GitHub `main`, Hosting release/version and source mapping, active Ruleset/index readiness, deployed Functions, Storage state, feature flag state, and the one current Claim/ownership authority;
2. current counts and safe fingerprints for `supplierOwnershipClaims`, `supplierOwnershipClaimRequests`, `supplierClaimantLocks`, `supplierOwnershipEvents`, Claim-linked `auditLogs`, Claim-linked `notifications`, and controlled TEST classifications;
3. current Supplier/user counts plus bounded two-sided ownership agreement/conflict counts for `users.supplierProfileId` and `suppliers.accountOwnerId` without exposing full records;
4. bounded Claim field-shape/status/reference/timestamp/evidence classifications, duplicate/orphan/conflict counts, and current index coverage if any Claim rows exist;
5. exact Firebase UID-to-provider-neutral profile mapping readiness and ambiguity counts, never email/name/domain matching;
6. source dispositions and deterministic zero-to-many mappings for every discovered Claim/request/lock/event/audit/notification record, including fan-out suppression for historical notifications/events;
7. current backup/rollback evidence, cutover freeze/reconciliation horizon, and authority manifest; and
8. a stop on any unexplained count, fingerprint, ownership backlink, identity, status, event/audit/notification, TEST, or authority delta.

The verification must be minimum-field, count/fingerprint first, read-budgeted, redacted, and separately authorized. It must not export complete Claims, claimant snapshots, evidence, contacts, private notes, provider subjects, or notification bodies into chat, logs, fixtures, or PR text.

## 14. Dependency classification

| Dependency | Empty local Claim structure | Trusted Claim runtime | Hosted deployment/data movement | Classification and conclusion |
|---|---|---|---|---|
| REL foundation | Does not structurally block the inert Claim table; requested sequencing places Claim after REL | **Blocks** idempotent decision, events, materializer input, replay, and recovery until implemented | Not sufficient for hosted work | Runtime blocker; the coherent two-table foundation is separately eligible after MSG-003. |
| RLS / SEC-001 | Does not block a fully revoked empty table | **Blocks** any client-visible Claim path and requires trusted commands, minimized projections, grants, and negative tests | Required before hosted client access | Trusted-runtime/security-delivery blocker. |
| Firebase Auth bridge / approved ID-001 implementation | Does not block provider-neutral FKs | **Blocks** current claimant/reviewer identity, verification, disablement, and actor authorization | Required during hybrid hosted runtime | Trusted-runtime blocker. |
| FILE-001 | Does not block bounded non-file descriptors | Does not block the selected reference-only Claim v1 path; **does block** any managed-file evidence path | Blocks upload/file custody enablement | Conditional alternative-path blocker; remains Open. |
| RES-001 | Does not block local-only structure | Does not block local synthetic command design | **Blocks** hosted environment/resource selection | Hosted-only blocker. |
| MIG-002 | Does not block local-only structure | Does not block local synthetic runtime design | **Blocks** hosted environment strategy, migration, cutover, and rollback | Hosted/data-movement blocker. |
| MSG-003 | Resolved contract; no block | Its contract no longer blocks, but notification table/materializer implementation remains required for the approved end-to-end path | Hosted delivery still needs implementation/approval | Contract satisfied; delivery implementation is a non-gate runtime blocker. |
| ORG-001 / ORG-002 | No block | No block for one human claimant/controller and no organization-derived authority | Only relevant if organization authority is added | Unrelated to Claim v1. |
| BILL-001 | No block | No block | No Claim dependency | Unrelated. |
| MSG-002 | No block | No block; Claim evidence/notifications contain no message body | No Claim dependency | Unrelated. |

The remaining Open gates stay unchanged: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## 15. Exact recommendation and decisions still required

### 15.1 Recommended next Claim-specific slice — not approved

After the separate REL foundation, select one empty, fully revoked, local-only `public.supplier_ownership_claims` table as the next Claim-specific structural SQL slice, with structural constraints/indexes/comments and focused synthetic pgTAP in a later authorized implementation task.

The slice should include exactly one new table and no rows, RLS, policy, view, RPC, routine, trigger, browser/API grant, Auth bridge, worker, trusted command, notification, event, audit behavior, migration execution, Firebase access, hosted access, or Production/TEST operation.

### 15.2 Tables explicitly not needed yet

Do not create:

- `public.supplier_ownership_claim_evidence`;
- a Claim reviewer/work-assignment table;
- `public.supplier_ownership_events` or any Claim history/event duplicate;
- `public.supplier_claim_rate_limits` as part of Claim domain structure;
- a Claim attachment table;
- `public.file_objects`, upload sessions, or file access tables;
- `public.notifications` as part of the Claim structural slice;
- another audit, idempotency, domain-event, registry, lock, request, or generic metadata table; or
- Supplier memberships, organizations, organization memberships, billing, or messaging tables for Claim v1.

### 15.3 Owner/runtime decisions still required

The recommendation must not be treated as selected until the Owner explicitly decides:

1. whether to advance `supplier_ownership_claims` from Core Later and approve the exact one-table empty local slice after REL;
2. whether v1 uses exactly one write-once reviewer assignment, or instead requires an approved reassignment/Owner-override history model before runtime;
3. the exact Claim/evidence/private-snapshot retention periods, legal holds, privacy/erasure/minimization, archive/purge, backup, and investigation access before real rows;
4. the code-owned decision, withdrawal, expiry, supersession, resubmission, claimant-safe disclosure, cooldown, and security-hold reason registries;
5. the exact evidence-verification method registry and pre-FILE HTTPS/provider allowlist before submission/decision runtime;
6. technical/security/operations ownership for Claim assignment, expiry, REL leases/retries/dead letters, alerting, and recovery; and
7. later hosted environment, migration/cutover, RLS/projection, authority-manifest, and Production execution approvals.

Exact logical columns, constraints, partial uniqueness, conditional field coherence, indexes, comments, and pgTAP assertion count are technical implementation selections after item 1; they do not authorize real rows or runtime.

## 16. Risks, validation, and exact stop point

Primary risks are copying Firebase's global claimant lock or conflict cap; treating a listed/verified Supplier, email/domain match, role row, reviewer assignment, Claim approval, backlink, event, audit, or notification as ownership authority; creating premature evidence/file/reviewer/history tables; storing arbitrary URLs or sensitive evidence outside the Claim; broadcasting reviewer work; using audit as an outbox; and treating an inert local table as a deployed feature. The recommendation fails closed on each risk.

Validation for this review is documentation-only:

- exact starting SHA recorded;
- one new Markdown document only;
- evidence, approved-contract, recommendation, and Open-decision labels preserved;
- relative repository links;
- sensitive-value scan;
- `git diff --check`; and
- no executable, SQL, configuration, shared baseline, or decision-register changes.

Exact stop point: commit and push this one-document review to `codex/claim-structural-readiness`, open one Draft PR, and stop. Do not mark Ready, merge, resolve a gate, select SQL on behalf of the Owner, implement SQL/pgTAP/RLS/Auth/Claim/REL/audit/notification/file runtime, access Firebase or hosted Supabase, read or change Production/TEST data, migrate, or deploy.

## 17. References

- [Current verified baseline](../ai-context/01_CURRENT_BASELINE.md)
- [Product and business rules](../ai-context/03_PRODUCT_AND_BUSINESS_RULES.md)
- [Security and Production guardrails](../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md)
- [Authoritative PostgreSQL schema design](./09_POSTGRESQL_SCHEMA_DESIGN.md)
- [Schema decision register](./10_SCHEMA_DECISION_REGISTER.md)
- [REL-001 idempotency and domain-events contract](./31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [Supplier ownership and Claim Product/Data/Security contract](./32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [ID-001 identity authority contract](./33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [Platform role assignments contract](./34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [AUD-001 audit evidence contract](./35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [MSG-003 Claim notification contract](./39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [Claim backend deployment status](../claim-supplier-backend-deployment.md)
- [Current Claim domain types](../../src/types/domain.ts)
- [Current Claim callable implementation](../../functions/src/supplierOwnership.ts)
- [Current Claim validation and state-machine helpers](../../functions/src/supplierOwnershipCore.js)
- [Focused Claim unit tests](../../tests/supplier-ownership-claim.test.mjs)
- [Focused Claim Functions Emulator tests](../../tests/supplier-ownership-functions-emulator.mjs)
- [Focused Claim Firestore Rules tests](../../tests/supplier-ownership-claim-firestore-emulator.mjs)
