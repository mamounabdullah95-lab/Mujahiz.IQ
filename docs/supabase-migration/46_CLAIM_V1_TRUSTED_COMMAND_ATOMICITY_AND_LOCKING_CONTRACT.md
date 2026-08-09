# Claim v1 trusted-command atomicity, locking, and side-effects contract

Status: **Proposed implementation contract; documentation only; Owner decisions in section 18 remain unresolved; no SQL, runtime, RLS, data, hosted, or Production action is authorized**

Contract date: 2026-08-09

Verified starting point: `origin/main` at `1d1d916ce9a71a85ab8a11a38b23707468347c2e`, the merge of PR #97 after the Claim foundation and SEC-001 synchronization

Primary task profile: Documentation

## 1. Scope, evidence labels, and hard boundary

This document defines the minimum complete trusted-command contract for the first local Claim Supplier Profile runtime after the separately approved identity context and Claim-first RLS substrate exist. It narrows the earlier design-only `supplier_ownership.decide_claim` concept into single-purpose commands, fixes one lock protocol for every Claim-v1 mutation, and identifies which state, audit, event, idempotency, and notification effects must share a transaction.

Evidence labels used below are:

- **Verified current fact** — proved by the repository at the starting SHA, current migrations/tests, or merged implementation evidence.
- **Approved existing contract** — fixed by an already Owner-approved predecessor contract, but not necessarily implemented.
- **Recommendation** — the minimum-safe command design proposed here; it is not Owner approval or runtime authority.
- **Owner decision required** — a product, security, data, privacy, legal, or operations choice that this task must expose rather than silently resolve.
- **Future implementation requirement** — a mandatory implementation or validation condition if the recommendation is approved.

This document creates no SQL, routine, RPC, role, grant, policy, RLS, Auth bridge, audit/event/notification writer, worker, application code, Firebase change, hosted Supabase resource, Claim row, ownership row, migration, replay, Production/TEST read or write, deployment, or Open-gate resolution.

## 2. Verified and approved starting state

**Verified current facts:**

- Firebase remains the Production authority. Supabase remains local-only, non-authoritative, and synthetic-data-only.
- The repository contains empty, fully revoked structural foundations for `public.user_profiles`, `internal.identity_provider_links`, `public.platform_role_assignments`, `public.supplier_profiles`, `public.supplier_ownerships`, `public.supplier_ownership_claims`, `internal.audit_logs`, `internal.idempotency_keys`, and `internal.domain_events`.
- `public.supplier_ownership_claims` has one active-Claim-per-claimant/Supplier partial unique index, one Supplier-active-Claim lookup index, one write-once reviewer field group, lifecycle/version fields, a fixed stored `expires_at`, and a unique nullable resulting-ownership reference.
- The Claim migration enforces only `expires_at > submitted_at`; it deliberately does not define “30 calendar days.”
- The REL foundation provides one shared idempotency lifecycle and one immutable domain-event/outbox lifecycle. It contains no Claim-local request table or command runtime.
- No RLS, application grant, dedicated runtime role, Auth bridge runtime, role-backed access implementation, trusted Claim command, notification table/materializer, real role/Claim/ownership row, or hosted authority exists.
- The current Firebase Claim implementation is undeployed evidence only. It proves transactional creation, retry binding, terminal withdrawal/rejection/expiry, one-winner approval, competing-Claim supersession, audit/event/notification side effects, and current-auth checks. Its global claimant lock, 20-conflict cap, direct command-side notification insert, two-sided Firebase ownership backlinks, and millisecond-based TTL are not authoritative relational design.

**Approved existing contracts:**

- [REL-001](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md) separates replay protection, immutable integration facts, audit evidence, and notification materialization.
- [Supplier ownership and Claim](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md) fixes the unowned-Supplier-only ordinary Claim, one active primary controller, immutable evidence, one-winner approval, and competing-Claim supersession boundary.
- [ID-001](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) keeps Firebase Auth authoritative and resolves human domain actors through one exact provider-neutral `user_profiles.id`.
- [Platform role assignments](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) permits only `owner|admin`, excludes reviewer as a platform role, and requires the complete usable-actor predicate.
- [AUD-001](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md) requires atomic success audit evidence for accountable decisions and minimized separate evidence for post-auth denied/conflicted attempts.
- [MSG-003](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md) permits user-visible Claim-v1 notices only for approved, rejected, and superseded outcomes, produced asynchronously by one materializer.
- [Claim structural readiness](41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md) and [Claim foundation evidence](44_SUPPLIER_OWNERSHIP_CLAIMS_FOUNDATION_IMPLEMENTATION_EVIDENCE.md) fix one durable write-once reviewer, no reassignment, no Owner override, and one private Claim aggregate.
- [SEC-001](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md) fixes the server-mediated Firebase bridge, current-principal context, no direct client writes, RLS-versus-command separation, and required race/security tests.

## 3. Recommended command model

**Recommendation:** Claim v1 has exactly six callable mutation commands and one internal approval effect:

| Command/effect | Exposure | Purpose | Why separate |
|---|---|---|---|
| `supplier_claim.submit` v1 | Authenticated claimant service endpoint | Create one immutable ordinary Claim | Creation has claimant/evidence/expiry/idempotency rules and no reviewer or ownership authority |
| `supplier_claim.assign_reviewer` v1 | Privileged trusted endpoint | Set the one reviewer and transition `submitted -> under_review` | Assignment grants private review visibility and has its own actor/conflict/audit boundary |
| `supplier_claim.withdraw` v1 | Authenticated claimant service endpoint | Transition the claimant's active Claim to `withdrawn` | Self-service closure has no reviewer decision or ownership effect |
| `supplier_claim.approve` v1 | Assigned-reviewer trusted endpoint | Approve one Claim, create ownership, and supersede competitors | This is the only multi-aggregate ownership-producing Claim command |
| `supplier_claim.reject` v1 | Assigned-reviewer trusted endpoint | Reject one Claim without changing ownership or competitors | It has a distinct fingerprint, reason registry, write set, and safe response |
| `supplier_claim.expire` v1 | Dedicated non-browser worker only | Terminalize one due active Claim | Trusted time and worker source replace any human actor or caller timestamp |
| Competing-Claim supersession | Internal effect of `supplier_claim.approve` only | Transition every other active Claim for the Supplier to `superseded` | It is causally inseparable from the winning approval and must not be callable independently |

There is no public `supplier_claim.supersede` command in v1. `supplier_claim.approve` owns the complete competing-Claim set and emits one superseded event per affected Claim. A future reviewed replacement/resubmission workflow may justify a different internal command, but it cannot reuse this approval-only effect without a new contract.

There is no separate `begin_review` command in the minimum model. `supplier_claim.assign_reviewer` writes the reviewer seam and transitions the Claim to `under_review` atomically. Opening a page or reading a queue never changes state.

The earlier design-only `supplier_ownership.decide_claim` name becomes a predecessor concept, not an alias. No runtime exists to migrate. Approval and rejection use distinct command names so their authorization-compatible inputs, fingerprints, failure classes, and write sets cannot be confused.

## 4. Cross-command invariants

Every command must preserve all of the following:

1. The effective actor comes only from the current server-established bridge context or the dedicated worker identity; no request field selects the actor.
2. Firebase account existence, disablement, and required verification are observed at trusted ingress under SEC-001. PostgreSQL then re-reads the exact provider link, profile, role/access, assignment, Supplier, Claim, ownership, and hold facts it needs.
3. RLS and object grants deny direct base-table mutation. Command authorization independently rechecks every mutable business and security predicate under lock.
4. One common transaction-level Supplier lock serializes every Claim/ownership command for the same Supplier, including other ownership-creation paths.
5. A Claim target, claimant, Supplier, assignment, current ownership, or competitor discovered before locking is only a lock-routing hint. The command trusts only the locked re-read.
6. Trusted database time supplies submission, assignment, decision, withdrawal, expiry, supersession, ownership, audit, event, and idempotency terminal timestamps.
7. Record versions increase exactly once for each committed Claim transition. A no-op/replay does not increase a version.
8. An approved Claim has exactly one resulting ownership row; no ownership row is created by submit, assign, withdraw, reject, expire, or supersede.
9. No command inserts a notification. Notification failure after commit cannot roll back a Claim command.
10. Every command uses the shared `internal.idempotency_keys` contract or, for the worker, its approved durable source-item identity through that same foundation. No Claim-local request, lock, or replay table is permitted.
11. Unknown code/version, missing dependency, stale expected version, ambiguous identity, inconsistent Claim/ownership state, or incomplete audit/event prerequisite fails closed.
12. Historical/migrated/replayed rows never invoke live commands, emit live events, or create notifications.

## 5. Actor and authorization matrix

| Command/effect | Trusted actor class | Required identity/authority | Required assignment/role | Explicitly forbidden |
|---|---|---|---|---|
| `submit` | Human claimant | Current validated Firebase user; exact active Firebase link; active Supplier-context profile; no security deny/quarantine | No platform role; claimant acts only for self | Anonymous/unmapped/unverified/disabled/inactive actor; operator impersonation; caller-selected claimant |
| `assign_reviewer` | Human platform operator | Complete usable privileged-human predicate; current role-backed administration access | **Recommendation pending Owner approval:** usable `owner` assigner only; candidate is a distinct usable `owner` or `admin` | Self-assignment; claimant as reviewer; current/proposed controller; Supplier member/delegate; conflicted/held candidate; reassignment; Owner override |
| `withdraw` | Human claimant | Same current exact claimant identity; current Supplier context as required by SEC-001 withdrawal policy | No platform role | Any operator/reviewer acting for claimant; non-claimant; terminal or due Claim |
| `approve` | Human assigned reviewer | Complete usable privileged-human predicate plus current Firebase observation | Exact write-once reviewer assignment/version; usable `owner` or `admin`; no conflict | Unassigned Admin/Owner; claimant; current/proposed controller; Supplier member/delegate; Owner override; service/system actor |
| `reject` | Human assigned reviewer | Same actor and Claim-integrity predicate as approval | Same exact assignment and usable role requirements | Same as approval; ownership ineligibility alone does not prevent a bounded rejection |
| `expire` | Dedicated automated worker/service | Narrow non-browser expiry purpose, environment, policy version, and durable source item | No human platform role and no fabricated reviewer | Browser, generic `service_role`, human-selected time, migration operator, notification worker |
| Internal supersession | The successful approval command's human actor and trusted service | Inherits the winning approval's validated context | No separate assignment on competing Claims is required because this is not a review decision about their evidence | Direct call, browser write, independent Admin/Owner action, arbitrary selected competitor set |

The final-usable-Owner guard does not run merely because an Owner reviews or assigns a Claim: these commands do not create, terminate, or change a platform role/access/profile/provider-link fact. They must, however, share the versioned principal-authority lock described in section 9 with future role/access/identity mutation commands. A concurrent eligibility-removing command and a Claim decision serialize; whichever commits second re-reads the first result. Any future Claim command that also changes privileged eligibility must separately adopt the complete final-Owner guard.

## 6. Command input and derivation contract

### 6.1 `supplier_claim.submit` v1

| Dimension | Contract |
|---|---|
| Caller inputs | `idempotency_key`; `supplier_profile_id`; bounded private `submitted_reason`; `evidence_schema_version`; zero to three bounded evidence descriptors; optional `prior_claim_id`; optional opaque `correlation_id` |
| Server-derived | Claim UUID; claimant profile; minimized claimant snapshot and schema version; submission fingerprint/version; trusted `submitted_at`; immutable `expires_at`; initial status/version; source/environment/policy; audit ID; result token |
| Required state | Eligible unowned Supplier; no active `submitted|under_review` Claim for the same claimant/Supplier pair; prior Claim, when supplied, is the same claimant/Supplier, terminal `rejected`, resubmission-permitted, and not already used by an incompatible successor |
| Transition | No row -> `submitted`, version 1 |
| Forbidden state | Active ownership; active same-pair Claim; ambiguous prior Claim; stored-file evidence; unsupported descriptor/version/reference; due Claim awaiting expiry does not get silently rewritten by submit |

The command does not accept claimant identity, snapshot fields, submission/expiry time, status, version, reviewer, ownership, audit/event/notification IDs, or a Firebase UID/provider subject.

### 6.2 `supplier_claim.assign_reviewer` v1

| Dimension | Contract |
|---|---|
| Caller inputs | `idempotency_key`; `claim_id`; `expected_claim_version`; `reviewer_user_profile_id`; optional opaque `correlation_id` |
| Server-derived | Effective assigner; candidate role/access/identity/conflict result; assignment version `1`; assignment source/policy; trusted `assigned_at`; new Claim version; audit ID/result token |
| Required state | Claim is exactly `submitted`, unexpired, structurally coherent, and has every assignment field null; Supplier remains within the ordinary Claim boundary; candidate and assigner satisfy section 5 |
| Transition | `submitted -> under_review` |
| Forbidden state | Existing/partial assignment; self-assignment; terminal/due Claim; candidate/assigner conflict or unusability; reassignment; Owner override |

Assignment version starts at 1 and is write-once. The v1 command does not accept a queue, shift, SLA, acceptance state, reassignment reason, override flag, reviewer role code, or arbitrary assignment source.

### 6.3 `supplier_claim.withdraw` v1

| Dimension | Contract |
|---|---|
| Caller inputs | `idempotency_key`; `claim_id`; `expected_claim_version`; optional opaque `correlation_id` |
| Server-derived | Exact claimant; fixed reason `claimant_requested`; trusted `withdrawn_at`; new Claim version; audit ID/result token |
| Required state | Exact claimant owns the Claim; status is `submitted` or `under_review`; trusted transaction time is strictly before `expires_at`; expected version matches |
| Transition | `submitted|under_review -> withdrawn` |
| Forbidden state | Non-claimant; terminal Claim; `now >= expires_at`; operator impersonation; caller-selected reason/time |

Withdrawal never unassigns or reassigns a reviewer as a separate mutation. The terminal Claim retains its immutable assignment provenance if it was under review.

### 6.4 `supplier_claim.approve` v1

| Dimension | Contract |
|---|---|
| Caller inputs | `idempotency_key`; `claim_id`; `expected_claim_version`; `expected_reviewer_assignment_version`; evidence-verification method/version/outcome and bounded checked-source/restricted-reference projection; optional bounded restricted reviewer notes; optional opaque `correlation_id` |
| Server-derived | Actor/profile/role/access/assignment; claimant and Supplier; current ownership; every active competitor; trusted decision time; approval reason/result code; ownership UUID and provenance; successor links/count; record versions; audit/event IDs and ordinals; result token |
| Required state | `under_review`; exact current assigned reviewer and assignment version; unexpired; unchanged immutable submission; eligible claimant and Supplier; verified approved evidence outcome; no active owner; no unresolved identity/ownership/source/security conflict |
| Transition | Selected Claim `under_review -> approved`; all other active same-Supplier Claims -> `superseded`; one ownership row created |
| Forbidden state | Any other Claim state; existing owner; unverified/inconclusive evidence; stale actor/claim/assignment; incomplete competitor set; conflict/hold; approval of own Claim; file-dependent evidence while FILE-001 remains Open |

The caller does not choose the claimant, Supplier, owner, ownership ID, superseded set/count, approval reason, actor role snapshot, status, version after commit, event ordinal, recipient, notification content, or timestamps.

### 6.5 `supplier_claim.reject` v1

| Dimension | Contract |
|---|---|
| Caller inputs | `idempotency_key`; `claim_id`; `expected_claim_version`; `expected_reviewer_assignment_version`; required bounded `rejection_reason_code`; evidence-verification method/version/outcome where applicable; optional bounded restricted reviewer notes; optional opaque `correlation_id` |
| Server-derived | Actor/profile/role/access/assignment; claimant/Supplier IDs; trusted decision time; safe-disclosure mapping; new version; audit/event IDs; result token |
| Required state | `under_review`; exact current assigned reviewer/version; unexpired; unchanged immutable submission; coherent supported evidence-verification projection; no reviewer conflict/hold |
| Transition | `under_review -> rejected` |
| Forbidden state | Any other state; stale assignment/version; unknown reason/version; conflict; caller-selected claimant/Supplier/status/time |

Rejection rechecks actor and Claim integrity but does not require the Supplier to remain unowned or the claimant/Supplier to remain approval-eligible. `existing_owner`, `claimant_ineligible`, or `supplier_mismatch` may be the reviewed rejection reason when supported by current evidence. Rejection changes no ownership or competing Claim.

### 6.6 `supplier_claim.expire` v1

| Dimension | Contract |
|---|---|
| Trusted worker inputs | Durable `source_operation_identity`; `claim_id`; `expected_claim_version`; `expiry_policy_version`; optional opaque `correlation_id` |
| Server-derived | Worker/service actor code; Supplier/claimant; trusted database time; reason `review_horizon_elapsed`; trusted `expired_at`; new version; result token |
| Required state | `submitted` or `under_review`; one trusted `command_now` captured after lock acquisition satisfies `command_now >= expires_at`; expected version matches; worker purpose/environment/policy valid |
| Transition | `submitted|under_review -> expired` |
| Forbidden state | Caller timestamp; human actor; not-yet-due Claim; unsupported policy; migration/replay row; partial/contradictory state |

Expiry is one Claim per logical source item. A scheduler may select a bounded batch ordered by `(expires_at, id)`, but each item receives an independent fenced idempotency/source binding and transaction so one corrupt Claim does not roll back unrelated expiries.

### 6.7 Internal supersession effect

| Dimension | Contract |
|---|---|
| Inputs | None beyond the locked winning approval and the complete locked active-competitor set |
| Server-derived | Competitor IDs/claimants; reason `competing_claim_approved`; `superseded_at`; winning Claim reference; new versions; event IDs/ordinals |
| Required state | Each affected Claim is `submitted` or `under_review`, targets the same Supplier, and is not the winning Claim |
| Transition | `submitted|under_review -> superseded` |
| Forbidden state | Caller-selected competitors; cap/limit-based subset; terminal Claim rewrite; separate idempotency row; separate public response containing competitor identity |

## 7. State-transition matrix

| Current state | Submit | Assign reviewer | Withdraw | Approve | Reject | Expire | Internal supersede |
|---|---|---|---|---|---|---|---|
| No Claim | Create `submitted` | Deny | Deny | Deny | Deny | Deny | Deny |
| `submitted` | Deny same-pair active duplicate | `under_review` | `withdrawn` before expiry | Deny | Deny | `expired` when due | `superseded` inside other approval |
| `under_review` | Deny same-pair active duplicate | Deny; write-once | `withdrawn` before expiry | `approved` plus ownership/competitors | `rejected` | `expired` when due | `superseded` inside other approval |
| `approved` | New Claim governed by ordinary eligibility; active ownership blocks | Deny | Deny | Completed replay only; new key denies | Deny | No-op worker result | Never rewrite |
| `rejected` | New resubmission row only when separately eligible | Deny | Deny | Deny | Completed replay only; new key denies | No-op worker result | Never rewrite |
| `withdrawn` | New Claim allowed only as a new ordinary submission if policy permits | Deny | Completed replay only; new key denies | Deny | Deny | No-op worker result | Never rewrite |
| `expired` | New Claim allowed as a new ordinary submission | Deny | Deny | Deny | Deny | Completed replay or already-terminal no-op | Never rewrite |
| `superseded` | New Claim allowed only if ordinary eligibility permits | Deny | Deny | Deny | Deny | No-op worker result | Never rewrite |

All terminal states are immutable. A later ownership transfer or revocation never changes an approved Claim. A rejected, withdrawn, expired, or superseded Claim is never reopened.

## 8. Canonical 30-day expiry decision

**Verified current fact:** predecessor contracts say “30 calendar days,” the current Firebase evidence uses `30 * 86,400,000` milliseconds, and the relational table enforces only `expires_at > submitted_at`. No approved contract unambiguously chooses an Iraq civil-calendar or UTC-elapsed-time interpretation.

**Recommendation:** define Claim v1 as an exact elapsed horizon of **720 hours from the trusted UTC submission instant**:

```text
command_now  = one trusted database clock instant captured after all required locks
submitted_at = command_now
expires_at   = submitted_at + exactly 720 hours
active       = command_now < expires_at
due          = command_now >= expires_at
```

Store both as `timestamptz`; calculate once inside `supplier_claim.submit`; never accept, round, extend, or recompute expiry from a client/session timezone. Each command captures one database `clock_timestamp()`-equivalent value into `command_now` **after** it has acquired the required locks, then uses that value for every time comparison and write. A transaction-start timestamp is insufficient because a command may wait on the Supplier lock across the expiry boundary. UI displays the stored instant in the user's locale, including `Asia/Baghdad`, but presentation does not change authority. This rule matches current Firebase elapsed-time behavior, is independent of database session timezone and future Iraq daylight-saving changes, has an unambiguous boundary instant, and is deterministic in replay/race tests.

**Owner decision required:** Product/Data must explicitly approve this 720-hour meaning or replace it with a Baghdad civil-calendar rule. If civil-calendar semantics are selected, the contract must additionally fix the IANA zone (`Asia/Baghdad`), wall-clock preservation, ambiguous/nonexistent local-time resolution, tzdata version/change behavior, and golden tests before submit runtime. This document does not silently approve either meaning.

## 9. Deterministic lock and re-read order

### 9.1 Universal protocol

All Claim commands and every other trusted path that can create, transfer, revoke, or correct ownership for a Supplier must use this order. Skipping the Supplier serialization lock is an integrity defect, even when a uniqueness constraint would eventually reject the write.

1. **Trusted ingress before reservation:** validate request shape, current Firebase token/user, exact principal mapping, environment/purpose, and coarse endpoint authority. Pre-auth malformed/denied traffic creates no idempotency reservation.
2. **Idempotency reservation:** create or claim one `internal.idempotency_keys` row under the command namespace, return replay/in-progress/conflict when applicable, and obtain a fenced lease/attempt. This is the short REL reservation transaction.
3. **Routing hint read:** for an existing Claim command, read only the immutable Claim ID -> Supplier/claimant mapping needed to calculate lock keys. This read grants no authority and is trusted only after the locked re-read.
4. **Domain transaction — idempotency row:** lock the reservation row first and verify command/version/environment, actor, target, fingerprint, current lease token, attempt, and nonterminal execution state.
5. **Principal-authority advisory locks:** acquire transaction-level locks for every involved provider-neutral human principal in ascending UUID order: actor/claimant, and reviewer candidate where applicable. The lock namespace/version is separate from Supplier locks. Future profile/link/role/access/security mutation commands must use the same principal lock before changing reviewer eligibility.
6. **Supplier advisory lock:** acquire one transaction-level lock derived from the canonical `supplier_profile_id`. This lock serializes the empty ownership slot and the active Claim set even when no ownership/Claim row exists. Every Supplier ownership creation/transfer/revoke/correction command must share it.
7. **Principal facts:** lock/re-read `user_profiles` rows in ascending UUID order, then active provider links in row-ID order, then active platform-role/access/security records in stable table-and-row-ID order. Compare the current relational state with the ingress Firebase observation/policy.
8. **Supplier row:** lock/re-read the canonical `supplier_profiles` row and its current eligibility/security facts.
9. **Ownership set:** lock every relevant `supplier_ownerships` row for the Supplier in ascending ownership UUID order. The Supplier advisory lock protects an empty active slot. Recheck the one-active-primary-controller predicate and history coherence.
10. **Claim set:** lock the union of the target Claim and every Claim the command may inspect or mutate, ordered by Claim UUID. Approval locks the selected Claim plus **all** active same-Supplier Claims without a limit. Submit locks any active same-pair Claim; assign, withdraw, reject, and expire lock their target. Re-read version, state, expiry, assignment, immutable fingerprint, parties, and cross-row links.
11. **Evidence/hold facts:** lock/re-read command-required evidence-verification, quarantine, conflict, or security-hold records in stable schema/table/key order after their owning principal/Supplier/Claim is locked.
12. **Allocate effects:** capture one current trusted database clock instant as `command_now` after all required locks are held; use it for every expiry comparison and committed timestamp in this command; then derive new record versions, ownership/event/audit UUIDs, deterministic event ordinals, and the safe result binding only after every check passes.
13. **Write and complete:** apply the command-specific write set, insert required audit/event rows, and complete the fenced idempotency result in the same database transaction.

The exact advisory-lock key function remains a technical implementation selection, but it must use a versioned namespace plus stable UUID bytes, be identical across all participating commands, and be catalog/integration tested. A 64-bit hash collision may serialize unrelated work but must never allow conflicting work to run concurrently. Transaction-level locks are mandatory so commit/rollback releases them automatically.

### 9.2 Why the Supplier lock precedes Claim row locks

Locking each target Claim first is deadlock-prone. Two competing approvals could each lock a different Claim, then one could obtain the Supplier/ownership lock while waiting for the other's Claim. Acquiring the common Supplier advisory lock before any Claim row means only one same-Supplier mutation can reach Claim locks, and sorted row locking supplies a second deterministic guard.

The routing hint read does not weaken immutability: after the Supplier lock, the command locks/re-reads the Claim and fails `claim_integrity_conflict` if its Supplier/claimant binding differs. Direct base writes remain denied.

### 9.3 Required race outcomes

| Race | Deterministic result |
|---|---|
| Two different claimants submit for one unowned Supplier | Supplier lock serializes inserts; both may commit because uniqueness is per claimant/Supplier pair |
| Same claimant submits the same Supplier twice | One active same-pair row commits; identical same-key retry replays; different key returns `active_claim_exists` |
| Two reviewers approve competing Claims | First Supplier-lock holder may approve; second re-reads ownership/Claim terminalization and cannot create ownership; exactly one ownership exists |
| Approval races another ownership-creation path | Both share the Supplier lock; first valid ownership wins; second sees the active owner and writes no partial state |
| Withdrawal races approval | First Supplier-lock holder commits one terminal transition; second sees terminal/version conflict and writes no aggregate side effect |
| Expiry races approval | At `now >= expires_at`, approval cannot commit. Before that boundary, whichever valid command holds the Supplier lock first commits; the second observes terminal/version state |
| Assign reviewer races withdrawal/expiry | Assignment commits only if the locked Claim remains `submitted` and unexpired; otherwise withdrawal/expiry wins and no assignment appears |
| Two assigners/duplicate assignment | Only one write-once assignment can commit; same-key retry replays; different key sees already assigned/version conflict |
| Reviewer role/access/profile/link loss races decision | Both paths share the principal-authority lock. The second transaction re-reads the first result; a decision never commits using a relational role/access fact already invalidated |
| Firebase disablement races a database decision | External state cannot be database-locked. The bridge observation must be current at ingress and within the separately approved maximum command window; this residual cross-system boundary remains a release-gate test |

## 10. Idempotency contract

### 10.1 Shared namespace and action codes

| Command | `command_name` / audit action | Target binding | Key source |
|---|---|---|---|
| Submit | `supplier_claim.submit` v1 | `supplier_claim_slot` = deterministic claimant/Supplier slot until Claim UUID is allocated; completed result binds Claim UUID | Caller-generated high-entropy key |
| Assign | `supplier_claim.assign_reviewer` v1 | Claim UUID | Caller-generated high-entropy key |
| Withdraw | `supplier_claim.withdraw` v1 | Claim UUID | Caller-generated high-entropy key |
| Approve | `supplier_claim.approve` v1 | Claim UUID | Caller-generated high-entropy key |
| Reject | `supplier_claim.reject` v1 | Claim UUID | Caller-generated high-entropy key |
| Expire | `supplier_claim.expire` v1 | Claim UUID | Durable scheduler/job/item identity scoped to Claim UUID, expiry instant, and expiry-policy version |

Internal supersession has no command name, key, lease, or idempotency row. It is protected by the winning approval's record, lock, deterministic event ordinals, terminal Claim state, and event uniqueness.

### 10.2 Request fingerprints

The versioned canonical fingerprint includes every semantic caller/source input and excludes the raw key, auth token, transport headers, retry count, server times, generated IDs, actor/role facts re-derived by the server, and presentation-only fields.

| Command | Minimum canonical fingerprint projection |
|---|---|
| Submit | Supplier UUID; normalized submitted reason; evidence schema/version and normalized ordered descriptors; explicit prior Claim UUID/null; command precondition version |
| Assign | Claim UUID; expected Claim version; reviewer candidate UUID; assignment-policy version |
| Withdraw | Claim UUID; expected Claim version; withdrawal-policy version |
| Approve | Claim UUID; expected Claim version; expected assignment version; evidence method/version/outcome; normalized checked source classes and restricted references/digests; reviewer-notes keyed digest/null; approval/evidence/authorization policy versions |
| Reject | Claim UUID; expected Claim version; expected assignment version; rejection reason; evidence method/version/outcome; normalized restricted references/digests; reviewer-notes keyed digest/null; rejection/disclosure/authorization policy versions |
| Expire | Claim UUID; expected Claim version; immutable expiry instant; expiry-policy version; durable source operation identity |

Reviewer notes and private evidence are never stored in `idempotency_keys`. Where they affect semantics, only a versioned keyed digest of their canonical bounded projection enters the request fingerprint.

### 10.3 Lifecycle and retry behavior

1. Same namespace/key, actor/source, target, and fingerprint in `processing` with an unexpired lease returns `command_in_progress` plus a bounded retry hint. It does not start a parallel execution.
2. Same key with a different actor/source/target/fingerprint/version returns `idempotency_key_conflict`, reveals no prior actor/result, mutates no domain row, and records the required minimized post-auth conflict audit.
3. Same key after `completed` re-applies current response authorization and rehydrates the safe result from the immutable result binding. It sets `idempotent_replay = true` and creates no new audit-success row, event, notification, ownership, transition, or version.
4. Same key after terminal failure replays the same safe failure until retention expiry.
5. A retryable infrastructure/serialization failure marks the fenced record retryable only after the domain transaction rolled back. Retry uses the same key and a new fenced lease/attempt after backoff.
6. An expired lease may be reclaimed, but a stale worker cannot complete because every terminal update matches the current lease token and attempt.
7. A crash before the domain commit leaves no aggregate/audit/event/result success. A crash after commit is a completed command even if the response was lost.
8. Initial recommendation remains at most a 60-second lease, exponential backoff with jitter, and 10 attempts. Technical/Security/Operations approval or revision is required before runtime.
9. Completed privileged ownership-command replay guards retain at least the approved 30-day response horizon and then a minimized conflict tombstone through cutover/rollback/reconciliation requirements. Exact durations and cleanup remain unresolved.

### 10.4 No-op behavior

| Situation | Behavior |
|---|---|
| Identical completed retry | Successful replay; no new side effect |
| New key against a terminal human-command target | Stable `claim_not_actionable` or `claim_version_conflict`; no business no-op success and no new success audit/event |
| Expiry worker sees an already-terminal Claim | Complete the worker idempotency result as `already_terminal` with no Claim/audit/event mutation |
| Expiry worker sees active but not-due Claim | Terminal safe `claim_not_due` for that source item; no mutation |
| Approval discovers zero competitors | Valid approval with `superseded_claim_count = 0` |
| Materializer sees the exact existing event/recipient/channel snapshot | Downstream materializer no-op; event may be marked processed in that separate transaction |

## 11. Transaction write-set matrix

`I` means insert, `U` update, `L` lock/read only, and `—` no write/read required by the command's normal success path.

| Command/effect | Claim | Ownership | Idempotency | Audit | Domain event | Notification | Other authoritative facts |
|---|---|---|---|---|---|---|---|
| Submit | `I submitted` | `L` active slot | `U completed` | `I` success | — | — | `L` claimant/link/Supplier/prior Claim/holds |
| Assign reviewer | `U under_review` | `L` slot for coherence | `U completed` | `I` success | — | — | `L` assigner/candidate roles, access, links, conflicts |
| Withdraw | `U withdrawn` | `L` slot for same lock protocol | `U completed` | `I` success | — | — | `L` claimant/link/profile |
| Approve | `U approved` plus `U` all active competitors to superseded | `I active primary_controller` | `U completed` | `I` one primary success | `I` approved plus one per superseded Claim | — | `L` actor/claimant/link/role/access/Supplier/evidence/holds |
| Reject | `U rejected` | `L` only | `U completed` | `I` success | `I rejected` | — | `L` actor/link/role/access/assignment/evidence/holds |
| Expire | `U expired` | `L` only | `U completed` | — on normal success | — | — | `L` worker purpose/policy |
| Internal supersession | Included in approval | — | Included in approval | Included as approval count | `I superseded` per Claim | — | No separate actor/command row |

**Recommendation pending audit action-registry approval:** accepted submission, reviewer assignment, claimant withdrawal, approval, and rejection each require one minimized durable success audit. Normal automated expiry needs neither a duplicate success audit nor event because the immutable Claim expiry fields already state the authoritative scheduled transition and no v1 consumer exists. Worker privilege misuse, override, repair, or integrity failure remains auditable under AUD-001. Section 13 explains the event choice.

## 12. Exact approval transaction

After current ingress validation and idempotency reservation, `supplier_claim.approve` performs exactly one domain transaction:

1. Lock and validate the fenced idempotency row.
2. Acquire sorted actor/claimant principal-authority locks and the Supplier advisory lock.
3. Lock/re-read actor profile, exact provider link, current platform role/access/security state, and exact reviewer assignment/conflict state.
4. Lock/re-read claimant profile/link/security eligibility and compare with the current Firebase observation made by the bridge.
5. Lock/re-read Supplier eligibility and every ownership row for the Supplier; prove the active primary-controller slot is empty and history is coherent.
6. Lock/re-read the selected Claim and every other active same-Supplier Claim in ascending Claim UUID order, without a row limit. Prove selected status/version/assignment/expiry/immutable fingerprint and competitor party/target coherence.
7. Lock/re-read evidence-verification and hold inputs; require a registered high-assurance method and `verified` approval outcome.
8. Capture one current trusted database clock instant as `command_now` after all locks and re-reads. Use it for the expiry check and every decision/ownership/supersession/audit/event timestamp. Generate one ownership UUID, one primary audit UUID, one approved-event UUID, and superseded-event UUIDs ordered by competitor Claim UUID.
9. Insert exactly one `supplier_ownerships` row with Supplier and controller derived from the Claim, `primary_controller`, `active`, trusted `valid_from`, establishment source `claim_approval`, bounded approved reason/policy provenance, and the human decision actor.
10. Update the selected Claim to `approved`, increment its version once, write the exact decision/evidence/policy fields, and set the unique resulting ownership FK.
11. Update every other locked active Claim to `superseded` in Claim-UUID order, increment each version once, set trusted time, reason `competing_claim_approved`, and restrictive successor reference to the approved Claim. Do not write decision/reviewer notes onto competing Claims.
12. Insert one primary AUD-001 success row for `supplier_claim.approve`, including selected Claim/Supplier/ownership, actor/role/assignment/policy snapshot, prior/result state/version, evidence method/version/outcome/restricted reference, superseded count without competitor identities, correlation, idempotency reference, and primary event reference.
13. Insert event ordinal 1 as `supplier_ownership.claim_approved` v1 for the selected Claim. Insert ordinals 2..N as `supplier_ownership.claim_superseded` v1 in competitor Claim-UUID order. For each event, `aggregate_sequence` equals that Claim's committed record version; do not calculate `max(sequence)+1` without the locked aggregate.
14. Complete the idempotency row with outcome `approved`, result resource `supplier_ownership_claim`, selected Claim UUID, and an immutable result-version token from the committed Claim version. Rehydration derives the safe ownership ID, status, and superseded count from the committed rows/event ordinals.
15. Commit all effects together.

The transaction must roll back if any ownership insert, Claim update, competitor coverage check, audit insert/evidence validation, event insert/ordinal/sequence uniqueness, or idempotency completion fails. Notification storage and event processing are deliberately absent from this transaction.

## 13. Audit, event, and notification contract

### 13.1 Success and denial matrix

| Operation | Durable success audit | Domain event | User-visible Claim-v1 notice | Rationale |
|---|---|---|---|---|
| Submitted | **Recommend yes** | No | No | Audit accounts for creation of private evidence; aggregate/history and response are sufficient, with no named async consumer |
| Reviewer assigned / under review | Yes | No | No | Assignment grants private visibility and requires accountability; reviewer queue reads aggregate state |
| Withdrawn | **Recommend yes** | No | No | Audit accounts for claimant closure; claimant initiated it and history is sufficient |
| Approved | Yes, one primary row | `supplier_ownership.claim_approved` v1 | Yes, claimant only | Event drives the approved materializer; audit preserves actor/evidence |
| Rejected | Yes, one primary row | `supplier_ownership.claim_rejected` v1 | Yes, claimant only | Event drives the rejected materializer; audit preserves actor/reason/evidence |
| Expired | No normal success row | No | No | Claim expiry provenance is authoritative; no named v1 consumer justifies an event |
| Superseded competitor | No per-competitor audit; approval audit stores count | `supplier_ownership.claim_superseded` v1 per Claim | Yes, each affected claimant only | Supersession is a causal approval effect; event is required for each recipient without leaking competitors |

After an accountable actor/source is resolved, authorization, reviewer-conflict, stale-version, existing-owner, identity/eligibility, evidence, quarantine, idempotency-binding, or integrity denial receives one separate minimized `rejected|conflicted|failed` AUD-001 row according to the approved action registry. It contains safe codes and known opaque targets only. It never contains raw keys/fingerprints, tokens/provider subjects, Claim evidence, reviewer notes, competitor identity, current owner identity, SQL/stack errors, or request bodies.

Pre-auth malformed, expired-token, unmapped, or anonymous traffic uses bounded security telemetry, not one durable business-audit row per request. Failure to persist a required success audit rolls back the mutation. Failure to persist a denial audit never changes denial into permission; it returns `audit_unavailable`/`result_unavailable` and emits restricted operational alerting.

### 13.2 Minimum v1 event registry

**Recommendation:** the minimum live registry remains exactly the three already approved event types:

| Event | Aggregate/payload | Producer/ordinal | Consumer |
|---|---|---|---|
| `supplier_ownership.claim_approved` v1 | Selected Claim; Claim ID, Supplier ID, claimant profile ID, ownership ID, committed Claim version | `supplier_claim.approve`, ordinal 1 | `supplier_claim_decision_notification_materializer` |
| `supplier_ownership.claim_rejected` v1 | Rejected Claim; Claim ID, Supplier ID, claimant profile ID, committed version, bounded internal decision reason | `supplier_claim.reject`, ordinal 1 | Same materializer |
| `supplier_ownership.claim_superseded` v1 | Each superseded Claim; Claim ID, Supplier ID, claimant profile ID, approved Claim ID, committed version | `supplier_claim.approve`, ordinals 2..N in Claim-UUID order | Same materializer |

The following candidate facts are explicitly evaluated and **not emitted in Claim v1**:

- `claim_submitted` — no asynchronous consumer; claimant response/history is sufficient.
- `claim_under_review` — reviewer queue is a current-state projection; no broadcast or integration consumer is approved.
- `claim_withdrawn` — claimant initiated it and Claim history is sufficient.
- `claim_expired` — no v1 notification or named consumer; aggregate expiry provenance is sufficient.

Adding one later requires a named consumer or durable integration use, schema/payload, replay/retention classification, and Owner approval. Domain events are not added merely to duplicate Claim history.

Event payloads contain no names, contact data, submitted reason/evidence, reviewer identity/notes, provider subject, raw audit/idempotency data, notification copy, locale, arbitrary URL, security hold, or unrestricted metadata.

### 13.3 Notification consequences

| Committed event | Materializer result | Failure effect on command |
|---|---|---|
| Approved | One protected immutable bilingual `in_app` snapshot for exact claimant | None; event remains pending/retryable after command commit |
| Rejected | One protected immutable bilingual `in_app` snapshot for exact claimant; safe reason mapping only | None |
| Superseded | One protected immutable bilingual `in_app` snapshot for that superseded Claim's claimant; no winner/owner/competitor identity | None |
| No event for submit/assign/withdraw/expire | No notification | Not applicable |

The separate materializer transaction inserts at most one row per `(domain_event_id, recipient_user_profile_id, channel)` and marks the event processed. A binding mismatch fails closed; an exact duplicate is a no-op. Notification or worker failure never rolls back an already committed Claim/ownership/audit/event transaction and never falls back to Firebase.

## 14. Safe result envelopes

All external results use a fixed typed envelope. Internal audit/event/idempotency references may be correlated server-side but are not returned by default.

```text
command
command_contract_version
outcome_code
claim_id
claim_status
claim_version
supplier_profile_id
idempotent_replay
```

Command-specific additions are:

| Command | Additional safe fields |
|---|---|
| Submit | `expires_at` |
| Assign reviewer | `assignment_version`, `assigned_at`, `reviewer_assigned = true` |
| Withdraw | `withdrawn_at` |
| Approve | `ownership_id`, `decided_at`, `superseded_claim_count` |
| Reject | `decided_at`; no unrestricted reason text |
| Expire | `expired_at` or bounded `already_terminal` outcome |

The service never returns competitor Claim IDs/count details beyond the integer superseded count, competitor claimant identity, current/previous owner identity unless independently authorized, private reviewer notes, raw/internal rejection rationale, evidence verification sources/references, Firebase UID/provider subject, role/access evidence, security holds, audit IDs/content, idempotency state/fingerprint, raw event payloads, notification copy/materialization state, SQL errors, or unrestricted row snapshots.

Claimant-facing status/reason disclosure remains constrained by SEC-001's allowlist. A reviewer may receive a bounded command error needed to correct their own request, but that does not make the internal reason claimant-visible.

## 15. Error taxonomy and disclosure

| Stable command error | Safe audience/result | Internal-only evidence |
|---|---|---|
| `invalid_request` | Caller may correct typed input | Parser/field detail stays in bounded telemetry; no raw request body |
| `authentication_required` | Generic pre-auth denial | Token/provider detail never returned or audited as domain actor |
| `identity_unavailable` | Generic mapped-user denial | Missing/stale/duplicate link, Firebase outage/disablement, mirror conflict details restricted |
| `actor_not_authorized` | Generic command denial | Role/access/security predicate and policy versions restricted |
| `claim_not_found` | Same response for unknown and unauthorized Claim | Existence/owner/claimant facts restricted |
| `claim_not_actionable` | Caller sees current safe inability, not hidden state | Exact terminal/conflict reason restricted unless separately allowlisted |
| `claim_version_conflict` | Caller refreshes and does not retry blindly | Current version/state may be returned only through an authorized projection |
| `claim_expired` / `claim_not_due` | Safe to affected claimant/reviewer/worker as applicable | Worker timing/lease detail restricted |
| `active_claim_exists` | Claimant learns only that their same pair already has an active Claim | No other claimant/count information |
| `supplier_already_owned` | Maps to claimant-safe `existing_owner` where permitted | Owner identity and ownership provenance restricted |
| `supplier_ineligible` | Generic safe unavailable/mismatch result | Watchlist/security/source details restricted |
| `reviewer_already_assigned` | Privileged assigner receives bounded conflict | Reviewer/assigner details only through authorized projection |
| `reviewer_conflict` | Assigned actor/assigner receives bounded denial | Relationship/hold detail and claimant/owner identities restricted |
| `evidence_not_verified` | Reviewer can correct/choose rejection; claimant later receives only approved safe mapping | Method source, notes, security rationale restricted |
| `security_quarantined` | External result `result_unavailable`/`not_approved` as applicable | Quarantine class and investigation evidence restricted |
| `idempotency_key_conflict` | Caller must not change payload under the key | Prior actor/key/fingerprint/result never disclosed |
| `command_in_progress` | Retry same key after bounded hint | Lease token/worker identity restricted |
| `retry_later` | Retry same key; never generate a replacement key automatically | SQL/driver/serialization detail restricted |
| `audit_unavailable` | Mutation denied/rolled back; external `result_unavailable` | Audit/storage failure restricted |
| `integrity_reconciliation_required` | External `result_unavailable`; no mutation | Contradictory rows, missing event/result/audit, competing identities restricted |

Business/precondition errors are terminal for that key unless the registry explicitly marks the underlying infrastructure condition retryable. Serialization, deadlock-victim, transient connection, and bounded provider failures may be retryable only after the full transaction rolls back. Unknown errors map to `result_unavailable`, never pass through SQL/stack/provider text, and cannot authorize a fallback.

## 16. Reason, evidence, and policy registry boundary

Keep code/documentation-owned registries small; do not add generic SQL registry tables.

| Registry | Minimum v1 boundary | Approval status |
|---|---|---|
| Submission reason | Bounded private `submitted_reason` text plus schema version; `prior_claim_id` structurally distinguishes resubmission. No broad business reason-code taxonomy is needed | Technical bounds/schema plus Product/Privacy approval still required |
| Evidence descriptor kinds | Candidate existing set: `company_domain_email`, `company_website`, `commercial_registration`, `authorization_letter`, `other`; at most three; each kind has exact shape/reference policy | Owner/Product/Security approval of exact shapes and pre-FILE allowlist required |
| Evidence verification methods | Candidate high-assurance set mirrors document 32: `official_registry_and_authority`, `authorized_officer_confirmation`, `company_domain_challenge_with_corroboration` | Owner/Product/Security approval required |
| Evidence outcomes | `verified`, `not_verified`, `inconclusive`; approval accepts only `verified` | Owner/Product/Security approval required |
| Approval reason | Server-derived `verified_control` only in ordinary Claim v1 | Owner approval required as part of decision registry |
| Rejection reasons | Small candidate set already evidenced by document 32: `insufficient_evidence`, `claimant_ineligible`, `supplier_mismatch`, `existing_owner`, `fraud_or_abuse`; unknown/other unrestricted text prohibited | Owner/Product/Security approval and claimant-safe mapping required |
| Withdrawal reason | Server-derived `claimant_requested`; no caller narrative in v1 | Owner/Product approval required |
| Expiry reason | Server-derived `review_horizon_elapsed` | Depends on approval of the exact expiry rule |
| Supersession reason | Server-derived `competing_claim_approved` only | Covered by approval transaction recommendation; Owner approval required |

`fraud_or_abuse`, conflict, quarantine, evidence-source, and investigation codes are never automatically claimant-visible. The claimant-safe disclosure registry remains independent of the internal decision registry and defaults unknown/restricted codes to `not_approved` or `result_unavailable`.

## 17. RLS, rollback, migration, and reconciliation boundary

### 17.1 RLS prerequisites and independent command checks

Before any command endpoint is executable, RLS/object grants/projections must already prove:

- no `anon`, browser `authenticated`, generic `service_role`, or unlisted runtime role can directly select or mutate Claim, ownership, role, identity-link, audit, idempotency, or event bases;
- claimant reads are exact-self and field-minimized;
- reviewer reads require the exact current assignment plus complete usable-authority/conflict predicate;
- controllers receive no competing Claim visibility;
- `internal` is outside exposed schemas and browser/API privileges;
- dedicated command/worker roles have only their named execute/base-object rights; and
- policy/helper failure, ambiguity, null, or missing dependency denies.

RLS does not replace command authorization. Every command independently rechecks current Firebase ingress evidence, provider/profile mapping, actor role/access, assignment, claimant/Supplier eligibility, ownership, Claim state/version/expiry, competitor set, evidence result, and holds under the section-9 locks. A row being visible never makes a transition valid.

### 17.2 Atomic rollback requirements

| Command | Effects that must roll back together |
|---|---|
| Submit | Claim insert, success audit, and idempotency completion |
| Assign | Reviewer fields, `under_review` transition/version, success audit, and idempotency completion |
| Withdraw | `withdrawn` transition/version/provenance, success audit, and idempotency completion |
| Approve | Selected approval, ownership insert, resulting ownership provenance, every competitor supersession, primary audit, all events, and idempotency completion |
| Reject | Rejection transition/version/provenance, primary audit, rejection event, and idempotency completion |
| Expire | Expiry transition/version/provenance and idempotency completion |

Prohibited partial states include: approved Claim without ownership; ownership without approved Claim/provenance; some but not all competitors superseded; event without its aggregate transition; successful accountable decision without audit; completed idempotency result without its committed state; state committed with a still-processing idempotency result; or notification used as proof of a decision.

### 17.3 Historical and replayed data

- Migration/import tooling writes through a separately approved, fan-out-suppressed mapping boundary; it never calls live submit/assign/withdraw/approve/reject/expire commands.
- Imported events are historical and `fanout_suppressed`; imported notifications are `already_materialized`. No historical Claim generates a live notice.
- Firebase idempotency digests/Claim locks are source evidence only. They are never reused as raw Supabase keys or permanent Claim-lock rows.
- Historical `pending_review` maps to `submitted` unless independent durable assignment evidence proves `under_review`.
- Ambiguous Claim, claimant, reviewer, ownership, reason, event, audit, notification, or timestamp evidence is quarantined rather than inferred.
- Reconciliation treats approved-without-ownership, ownership-without-approved-source, missing audit/event, duplicate sequence/ordinal, partial competitor supersession, completed-key/result mismatch, or processed-event/materialization mismatch as fail-closed integrity exceptions.

Rollback changes one authority manifest under a separately approved freeze/reconciliation runbook. It does not delete or rewrite completed Claims, ownerships, audits, idempotency bindings, events, or notifications and never silently resumes Firebase writes for a Supabase-authoritative operation.

## 18. Unresolved Owner and delivery decisions

No Open gate is resolved by this document. Before the relevant runtime slice, explicit decisions remain:

1. **30-day meaning:** approve the recommended exact 720-hour UTC horizon or fully specify Baghdad civil-calendar semantics.
2. **Reviewer assignment authority:** approve or replace the recommendation that only a currently usable Owner, distinct from the candidate, may assign one usable Admin/Owner exactly once; also approve queue ownership and any assignment timeout.
3. **Reason/evidence registries:** approve exact evidence descriptor shapes/reference allowlist, verification methods/outcomes, approval/rejection/withdrawal/expiry/supersession codes, and claimant-safe disclosure mappings.
4. **Audit action registry:** approve the recommended submit/assign/withdraw/approve/reject success rows, denial classes, expiry treatment, evidence schemas, access, exact retention, legal holds, privacy/archive/purge, and failure operations.
5. **REL operations:** approve or revise lease length, attempt cap, retry classes, alert ownership, dead-letter/requeue, idempotency/event retention, tombstones, and reconciliation runbook.
6. **Identity/runtime boundary:** implement role-backed administration access/security holds and approve bridge transport, recent-auth/step-up, credential custody, abuse controls, safe errors, observability, provider outage behavior, and selected driver/pool/pooler isolation.
7. **Lock implementation:** approve the exact versioned principal/Supplier advisory-key function and require every identity/role/access/ownership/Claim mutation path to share the applicable locks.
8. **Claim/evidence retention:** approve Claim snapshot/evidence/reviewer-note retention, access, holds, minimization, archive/purge, backup, and privacy behavior before real rows.
9. **Hosted/data gates:** `RES-001` and `MIG-002` plus explicit hosted/Production approval remain required. `FILE-001` remains Open and becomes a runtime blocker if evidence uses managed files.

The seven named Open gates remain `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## 19. Recommended first implementation order

**Recommendation:** after the separately approved identity context, dedicated runtime role, forced RLS, default-deny grants, and claimant-safe projections exist, implement commands incrementally:

1. **First command slice: `supplier_claim.submit` only.** Include its exact input/schema registry, 30-day decision, shared Supplier/principal locking helpers, REL idempotency integration, required success/denial audit writer, immutable Claim insert, safe response, and focused synthetic authorization/race/replay/rollback tests. It emits no event and has no notification dependency.
2. `supplier_claim.withdraw`, reusing the same locks/idempotency/audit/result conventions and proving withdrawal-versus-expiry/version races.
3. `supplier_claim.assign_reviewer` only after assignment authority/queue/conflict decisions and usable role-backed access/security data exist.
4. `supplier_claim.reject`, proving assigned-reviewer authorization, reason/evidence/disclosure registries, audit/event atomicity, and notification materializer retry separately.
5. `supplier_claim.expire`, with one-item worker idempotency, trusted-time boundary, bounded batch selection, and worker-role/lease/recovery tests.
6. `supplier_claim.approve` last, because it composes every identity, role, assignment, evidence, Supplier, ownership, Claim-set, audit, idempotency, event, materializer, and concurrency invariant.

Do not implement every command in one PR. The smallest first runtime command slice is submit, not approve/reject and not the complete shippable feature. It remains local-only and synthetic-data-only until the separately approved end-to-end release gates are satisfied.

## 20. Required implementation tests

Each later implementation slice must add only its applicable focused tests, with the complete suite accumulated before Claim release:

- same key/same payload replay; same key/different payload/actor/environment conflict; in-progress lease; stale lease fencing; completed replay after lost response;
- same-pair concurrent submit and different-claimant same-Supplier concurrent submit;
- exact 30-day boundary immediately before/at/after expiry across database session timezones and the approved timezone rule;
- assignment versus assignment/withdrawal/expiry and unusable/conflicted candidate cases;
- withdrawal versus approval/expiry and terminal/new-key behavior;
- two competing approvals; duplicate approvals; approval versus other ownership creation; approval with zero/many competitors; no conflict cap;
- provider/profile/link/role/access loss versus decision, including shared principal-lock behavior;
- required audit failure rolls back mutation; event failure rolls back approval/rejection; notification failure does not roll back a committed command;
- deterministic event ordinal/aggregate sequence and notification tuple deduplication;
- exact safe response fields and forbidden-value scan for competitor identity, reviewer notes, provider subjects, audit/idempotency/event payloads, secrets, SQL errors, and unrestricted metadata;
- historical/fan-out-suppressed fixtures never invoke commands or notify; and
- catalog/RLS/grant tests prove no direct browser/generic `service_role` mutation or `internal` access.

## 21. Validation and exact stop point

This contract must validate as exactly one documentation file with relative repository links, internally consistent command/state/write-set/audit/event/notification matrices, clear evidence-versus-recommendation labels, no sensitive values, and a clean `git diff --check`. The diff must contain no SQL, executable, configuration, baseline, schema-design, decision-register, test, or generated-file change.

Exact stop point: commit and push this one Markdown contract to `codex/claim-v1-trusted-command-contract`, open one Draft PR, keep it Draft, and stop. Do not mark Ready, merge, resolve an Owner decision or Open gate, implement SQL/RPC/RLS/Auth/Claim/audit/REL/notification runtime, start Docker, access Firebase or hosted Supabase, inspect or change Production/TEST data, migrate, deploy, or enable Claim Supplier Profile.

## 22. References

- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [`34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md`](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [`35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md`](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [`39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md`](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [`41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md`](41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md)
- [`42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md`](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [`44_SUPPLIER_OWNERSHIP_CLAIMS_FOUNDATION_IMPLEMENTATION_EVIDENCE.md`](44_SUPPLIER_OWNERSHIP_CLAIMS_FOUNDATION_IMPLEMENTATION_EVIDENCE.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
