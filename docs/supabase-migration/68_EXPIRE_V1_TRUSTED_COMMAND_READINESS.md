# `supplier_claim.expire` v1 - Trusted-Command Readiness

Date: 2026-08-14
Primary task profile: Documentation
Verdict: **IMPLEMENTATION-READY**

## 1. Boundary and verified starting state

This is a bounded documentation-only readiness review for the final unimplemented Claim-v1 command, `supplier_claim.expire`. It does not implement SQL, pgTAP, a worker, RLS, grants, notifications, hosted Supabase, Firebase behavior, migration, or Production behavior.

This corrective review started from clean `origin/main` at `c7878505d604850fe1d4d34aba2180523434b6ed`, the merge of PR #132. PR #132 contains the original Expire readiness document and retains merged PR #130's five-command implementation baseline. Static repository verification found:

- 28 tracked migrations and 28 tracked pgTAP files;
- 24 physical `public`/`internal` PostgreSQL tables;
- exactly three Claim `SELECT` RLS policies and zero Claim mutation policies;
- latest merged complete local SQL validation evidence of 2,170/2,170 assertions;
- exactly five implemented Claim-v1 commands: `supplier_claim.submit`, `supplier_claim.withdraw`, `supplier_claim.assign_reviewer`, `supplier_claim.reject`, and `supplier_claim.approve`; and
- exactly one unimplemented Claim-v1 command: `supplier_claim.expire`.

Firebase remains the live Production authority. No hosted Supabase project is linked or deployed.

## 2. Decision status

### VERIFIED / DERIVED FROM MERGED CONTRACT

The merged contracts are sufficient to fix the state transition, trusted-time boundary, worker-only authority class, assignment preservation, version increment, shared lock architecture, idempotency/source binding, event, notification exclusion, ownership exclusion, replay surface, and concurrency outcomes below.

### VERIFIED / DERIVED FROM OWNER APPROVAL

The Product/Security/Data Owner approved the two previously open decisions recorded below. No material Owner blocker remains for the local-only Expire v1 implementation.

## 3. Exact expirable states and terminal immutability

### VERIFIED / DERIVED FROM MERGED CONTRACT

| Current status | Expire behavior |
|---|---|
| `submitted` | May transition to `expired` only when due and the expected active Claim version matches |
| `under_review` | May transition to `expired` only when due and the expected active Claim version matches; preserve every reviewer-assignment field unchanged |
| `approved` | Immutable terminal state; only after the status-specific historical validation in section 10 may a new valid worker observation complete as `already_terminal`, with no mutation/audit/event |
| `rejected` | Same status-specific validated `already_terminal` no-op |
| `withdrawn` | Same status-specific validated `already_terminal` no-op |
| `expired` | Exact completed request replays; only after section 10 validates the originating expiry may a different valid worker observation complete `already_terminal` without another transition/event |
| `superseded` | Same status-specific validated `already_terminal` no-op |

`submitted` and `under_review` have the same due predicate and target status, but they do not have identical preservation checks. A coherent `submitted` Claim has all reviewer-assignment fields null. A coherent `under_review` Claim has the complete write-once assignment group and the assignment instant in `[submitted_at, expires_at)`.

Terminal Claims never reopen. Expire does not normalize, repair, or rewrite malformed terminal history.

## 4. Trusted-time boundary

### VERIFIED / DERIVED FROM MERGED CONTRACT

The exact invariant is:

```text
expires_at = submitted_at + interval '720 hours'
active     = command_now < expires_at
due        = command_now >= expires_at
```

Both timestamps are `timestamptz`. `submitted_at` is the immutable anchor. Equality is due: a Claim may expire when `command_now = expires_at`. There is no grace period, local-midnight rule, calendar-month rule, session-timezone adjustment, or caller timestamp.

Phase B captures one `clock_timestamp()`-equivalent `command_now` exactly once, after every required lock is held. That single instant supplies the due check, `expired_at`, `updated_at`, event times, and idempotency completion time. Ordinary success has no audit row. A transaction-start timestamp is insufficient because a transaction may wait across the expiry boundary.

## 5. Caller and authority model

### VERIFIED / DERIVED FROM MERGED CONTRACT

Expire is executed only by a dedicated automated non-browser worker/service with one registered expiry purpose, environment, policy version, and durable scheduler observation. The worker creates one opaque `p_source_item_identity` before its first attempt for that observation, reuses it unchanged for every retry of that observation, and creates a different identity for a later observation. It has:

- `principal_kind = automated_worker`;
- no human `principal_user_profile_id` and no fabricated reviewer/Admin/Owner actor;
- fixed actor provenance `claim_expiry_worker`, distinct from the observation identity and never a process/host/instance identity;
- no browser, `anon`, `authenticated`, generic `service_role`, migration-operator, notification-worker, or human endpoint authority; and
- no caller-selected time, claimant, Supplier, reviewer, status, result version, reason, audit/event identity, or execution fence at the business boundary.

Domain eligibility is limited to a structurally coherent active Claim that is due. Database execution authority must be a separately scoped expiry-worker role with execute only on the Expire Phase-A and fenced Phase-B routines and no direct Claim/internal-table authority. The current human `mujahiz_claim_runtime` context is not worker identity and must not be repurposed as one.

### IMPLEMENTATION RECOMMENDATION

Add a dedicated `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS` role such as `mujahiz_claim_expiry_worker`; keep `PUBLIC`, `anon`, `authenticated`, `service_role`, `mujahiz_claim_runtime`, projection roles, and migration roles revoked. The exact local role name is a technical/catalog choice, not a new human authorization policy.

## 6. Reviewer assignment behavior

### VERIFIED / DERIVED FROM MERGED CONTRACT

For `under_review -> expired`, preserve these fields byte-for-byte:

- `reviewer_user_profile_id`;
- `reviewer_assignment_version`;
- `reviewer_assigned_at`;
- `reviewer_assigned_by_user_profile_id`;
- `reviewer_assignment_source_code`; and
- `reviewer_assignment_policy_version`.

Expire does not clear, close, supersede, or create a separate assignment relation. Reviewer queue/detail access closes automatically because those read paths require a current non-due `under_review` Claim. Assignment provenance remains durable history.

Expire accepts no assignment version, requires no reviewer authorization, and takes no reviewer role/access/security lock. It validates the stored assignment group for structural coherence under the Claim-row lock.

## 7. Exact successful transition

### VERIFIED / DERIVED FROM MERGED CONTRACT

For a coherent due `submitted|under_review` Claim whose `record_version = p_expected_claim_version`, success performs exactly one Claim update:

| Field | Result |
|---|---|
| `status` | `expired` |
| `record_version` | prior version + 1 |
| `expired_at` | the single post-lock `command_now` |
| `expiry_system_source_code` | server-derived fixed v1 registry value |
| `expiry_policy_version` | server-derived fixed v1 registry value |
| `updated_at` | `command_now` |

All immutable submission/fingerprint/evidence/prior-Claim fields remain unchanged. Assignment fields remain null for a formerly `submitted` Claim and unchanged for a formerly `under_review` Claim. Decision, withdrawal, supersession, and resulting-ownership fields remain null. Expire writes no `decided_at`, decision actor/reason/evidence, `withdrawn_at`, `superseded_at`, `superseded_by_claim_id`, or `resulting_supplier_ownership_id`.

There is no separate expiry-reason column in the authoritative Claim table. An explicit new reason column or reuse of decision/withdrawal reason fields would be a schema/contract change and is not authorized.

## 8. Deterministic lock order

### VERIFIED / DERIVED FROM MERGED CONTRACT

The smallest Expire lock order consistent with the universal Claim protocol is:

1. validate typed worker request, supported environment/purpose/policy, and coarse endpoint authority;
2. durable Phase-A reservation/replay/reclaim in `internal.idempotency_keys`, producing a new fence/attempt when executable;
3. routing-hint read of Claim ID to immutable claimant/Supplier IDs; the read grants no authority;
4. in Phase B, lock and validate the idempotency row/fence first;
5. acquire the target claimant's versioned principal advisory lock;
6. acquire the common Supplier advisory lock before any principal or domain row lock;
7. lock/re-read the claimant `user_profiles` row for immutable target integrity only; no provider/role/access/security eligibility is required;
8. lock/re-read the Supplier row;
9. lock/read the Supplier ownership set in ascending ownership UUID order without modifying it;
10. lock/re-read the target Claim row; validate immutable parties, structure, state, version, 720-hour invariant, and assignment shape;
11. capture one `command_now`, apply the due predicate, allocate the event/result, update the Claim, insert the required event, and complete the fenced idempotency row atomically.

No reviewer principal, reviewer role/access/security, competing Claim, ownership-creation, or evidence-verification lock is required. Submit, Withdraw, Assign Reviewer, Reject, and Approve all acquire the involved principal advisory lock or sorted principal advisory locks, then the Supplier advisory lock, and only then principal rows. Expire now uses that exact advisory-before-row order. The shared Supplier-before-Claim order prevents inversion with those five commands and future ownership writers; there is no claimant-row-before-Supplier-advisory path. Skipping the Supplier lock would violate the approved universal architecture even though Expire changes only one Claim.

## 9. Idempotency and source-item contract

### VERIFIED / DERIVED FROM MERGED CONTRACT

The command name is `supplier_claim.expire`, contract version `1`, target aggregate type `supplier_ownership_claim`, and target aggregate ID = Claim UUID. The reliability identities are deliberately separate:

| Concern | Exact v1 value/binding |
|---|---|
| automated principal | `principal_kind = automated_worker`; no `principal_user_profile_id` |
| worker/actor provenance | fixed server-derived `principal_source_code = claim_expiry_worker`; the event uses `actor_kind = automated_worker`, no actor user-profile ID, and `actor_source_code = claim_expiry_worker` |
| scheduler/source-system class | fixed server-derived `upstream_source_system_code = claim_expiry_scheduler` |
| one scheduler observation | caller-supplied `p_source_item_identity`, stored as `upstream_request_identity` |
| event operation identity | the same validated `p_source_item_identity`, stored as event `source_operation_identity`; event `source_system_code` remains the existing `mujahiz` convention |

`p_source_item_identity` is an opaque, non-empty UTF-8 value of at most 256 octets, matching the implemented REL-001 bound. The scheduler must allocate it durably before the first attempt, guarantee it is unique for each observation within the `mujahiz` event source namespace, and reuse it only for retries of that observation. It must not contain a secret, token, credential, personal data, Claim/Supplier display data, process/host/instance identity, retry number, or attempt timestamp. It is stored only in the protected REL source-identity fields and is never copied into the Claim, event payload, audit, result, error, or log.

The source item is scoped by immutable bindings to the exact Claim UUID, expected Claim version, stored `expires_at`, and fixed expiry policy. One Claim observation is one logical source item and one transaction. A bounded scheduler batch may be ordered by `(expires_at, id)`, but batch identity, batch rollback, or batch-wide completion never replaces per-observation fencing.

The Phase-A key digest is HMAC-SHA-256 over a versioned, length-delimited namespace containing environment, `supplier_claim.expire`, contract version 1, fixed source-system class `claim_expiry_scheduler`, and the raw `p_source_item_identity`. The raw identity is never used as the database uniqueness key. The immutable source binding additionally requires the stored `upstream_source_system_code` and `upstream_request_identity` to match exactly.

The minimum canonical request fingerprint contains:

- fixed upstream source-system class `claim_expiry_scheduler`;
- durable `p_source_item_identity`;
- Claim UUID;
- expected Claim version;
- immutable stored expiry instant;
- fixed expiry-policy version `claim_expiry_v1`; and
- fixed worker provenance `claim_expiry_worker`.

It excludes server time, raw fence, retry count, worker instance, generated IDs, correlation ID, Claim result state/version, event/audit metadata, and any human actor.

Phase A uses the established 60-second local lease, 10-attempt cap, fenced reclaim, and 720-hour replay-row retention only as provisional local protocol parameters. A stale fence cannot enter Phase B or complete a result. The same observation identity plus the same source/target/fingerprint replays or reports `command_in_progress`; reuse with a changed source class, target, expected version, expiry instant, policy, worker provenance, or fingerprint fails `idempotency_key_conflict`.

Successful expiry completes with `outcome_code = expired`, resource type `supplier_ownership_claim`, Claim UUID, and committed Claim-version token. An already-terminal no-op completes with `outcome_code = already_terminal`, the same resource type/ID, and the immutable current terminal version. A not-due observation records/replays terminal safe failure `claim_not_due`; it never reserves future authority to expire the Claim after time advances.

Mandatory progression invariant:

1. Observation A is created before expiry with source item A and the current expected Claim version. It completes `claim_not_due`; every retry of A replays that same terminal result and performs no Claim/event/audit mutation.
2. After the expiry boundary, the scheduler creates distinct source item B for a new observation and supplies the then-current expected Claim version. B has a different key digest and upstream/source-operation identity, cannot resolve to A, and may expire the still-active Claim.
3. Every retry of successful B replays B. No completed `claim_not_due` record can permanently prevent a later distinct due observation from expiring the Claim.

Exact completed replay is read-only and creates no second transition, version, event, audit, ownership, competitor effect, or notification.

## 10. Historical-success and no-op reconciliation

### VERIFIED / DERIVED FROM MERGED CONTRACT

Completed `expired` replay must verify only durable facts relevant to Expire:

1. the full completed idempotency lifecycle and exact command/version/environment/automated-worker/source/target/upstream/fingerprint/outcome/resource/version binding, including `expires_at > completed_at` for the idempotency row;
2. one coherent Claim at the bound version with `status = expired`, `expires_at = submitted_at + interval '720 hours'`, `expired_at >= expires_at`, `expired_at = updated_at = idempotency.completed_at`, the approved expiry source/policy pair, no decision/withdrawal/supersession/ownership fields, and coherent preserved assignment shape;
3. exactly one ordinal-1 `supplier_ownership.claim_expired` v1 event produced by the same idempotency/source item, with aggregate sequence equal to the committed Claim version, exact envelope/times/correlation, exact minimized payload, `is_historical = false`, and `fanout_suppressed = false`; and
4. zero ordinary Expire success-audit rows, matching the approved audit Option A.

For a **first-time** Expire observation of an already-terminal Claim, schema validity is insufficient. Under the same advisory/row locks, Expire must prove the terminal status under its originating command contract before completing its own observation as `already_terminal`:

| Terminal status | Minimum originating history that must be proven |
|---|---|
| `withdrawn` | Complete terminal Claim field group with `withdrawn_by_user_profile_id = claimant_user_profile_id`, reason `claimant_withdrawal`, assignment group either wholly null or coherently preserved, `submitted_at <= withdrawn_at = updated_at < expires_at`, and exactly one completed `supplier_claim.withdraw` v1 idempotency row bound to the Claim/result version/time plus exactly one matching ordinal-1 `supplier_ownership.claim_withdrawn` v1 event. Ordinary withdrawal has zero success audits. |
| `rejected` | Complete preserved assignment and decision field groups; assigned reviewer is the decision actor; `submitted_at <= reviewer_assigned_at <= decided_at = updated_at < expires_at`; registered rejection reason/evidence tuple and policy versions; `reviewer_notes = NULL`; exactly one completed `supplier_claim.reject` v1 idempotency row; exactly one complete primary success audit with its required evidence binding; and exactly one matching ordinal-1 `supplier_ownership.claim_rejected` v1 event. No ownership or competitor effect may exist. |
| `approved` | Complete preserved assignment and approved decision field groups with registered approval/evidence/policy values and pre-expiry chronology; the exact resulting ownership linked to the Claim with coherent `claim_approval` establishment and lifecycle (including a later coherently closed ownership) plus the one-primary-at-a-time invariant; the complete originating `supplier_claim.approve` v1 idempotency row and primary success audit; the exact approval-produced competitor set; and the complete contiguous event set consisting of ordinal 1 `supplier_ownership.claim_approved` plus ordered `claim_superseded` events for that set. This is the implemented Approval reconciliation boundary, not a generic terminal-shape check. |
| `superseded` | Complete terminal Claim field group with no decision/withdrawal/expiry/ownership result, preserved assignment shape, `superseded_at = updated_at`, reason `competing_claim_superseded_by_approval`, and a same-Supplier `superseded_by_claim_id` that is a coherent approved winner. The winner's resulting ownership, complete `supplier_claim.approve` v1 idempotency row and primary audit, exact approval-produced competitor set, and contiguous ordered event set must prove that this Claim has the matching `supplier_ownership.claim_superseded` event at its correct ordinal/version/time. |
| `expired` | Complete terminal Claim field group with no decision/withdrawal/supersession/ownership result, coherent preserved assignment shape, exact `expires_at = submitted_at + interval '720 hours'`, `expired_at = updated_at >= expires_at`, fixed `claim_expiry_worker` / `claim_expiry_v1` provenance, exactly one completed originating `supplier_claim.expire` v1 idempotency row with its source observation binding, exactly one matching ordinal-1 `supplier_ownership.claim_expired` v1 event, and zero ordinary Expire success audits. |

The first-time observation does not need to prove unrelated current human authorization or re-run a terminal command. It does have to prove every artifact that the originating atomic command required. Missing, duplicate, partial, mismatched, expired-before-completion, malformed, or contradictory originating facts raise `P5199 / integrity_reconciliation_required`. Expire then does not complete its new observation, return `already_terminal`, repair history, emit an Expire event, or mutate the Claim. A valid terminal history permits the new observation to complete only its own worker idempotency item as `already_terminal`, with no Expire event, audit, or domain mutation.

Completed `already_terminal` replay verifies the complete Expire observation binding plus the same status-specific immutable terminal Claim/version and originating history. The no-op never claims that Expire caused the terminal state.

## 11. Domain event

### VERIFIED / DERIVED FROM MERGED CONTRACT

Successful transition writes exactly one event in the same Phase-B transaction:

| Field | Exact contract |
|---|---|
| event type | `supplier_ownership.claim_expired` |
| schema version | `1` |
| aggregate type/id | `supplier_ownership_claim` / expired Claim UUID |
| aggregate sequence | committed Claim `record_version` |
| producer | `supplier_claim.expire`, contract version `1` |
| producer identity | current idempotency row and `source_operation_identity = p_source_item_identity` |
| ordinal | `1` |
| actor | `automated_worker`; no actor user-profile ID; `actor_source_code = claim_expiry_worker` |
| environment/source/component | current trusted environment; existing `mujahiz` source convention; bounded expiry-worker component |
| times | `occurred_at = persisted_at = available_at = command_now` |
| processing | `pending`, attempt 0, no lease/error/processed/dead-letter fields |
| historical/fanout | `is_historical = false`, `fanout_suppressed = false`, no migration classification |
| payload | exactly Claim ID, Supplier ID, claimant user-profile ID, and committed Claim version |

The payload contains no reviewer identity/assignment, submitted reason/evidence, expiry source identity, policy internals, audit/idempotency internals, ownership, competitor, contact/provider data, notification copy, URL, or unrestricted metadata.

An event insert or integrity failure rolls back Claim expiry and idempotency completion. A terminal no-op or not-due failure writes no event.

## 12. Audit contract

### VERIFIED / DERIVED FROM OWNER APPROVAL

The Owner approved **Option A**: a normal successful automated Claim expiry writes no ordinary audit row. Expire is a deterministic trusted-time lifecycle transition, not a discretionary human decision. The durable terminal Claim state, completed idempotency record, and immutable `claim_expired` event provide the required ordinary traceability without duplicating the same fact in `internal.audit_logs`. This does not weaken separately required corruption, failure, security, or future operational audit paths, and does not change Reject or Approve audit semantics.

## 13. Notification boundary

### VERIFIED / DERIVED FROM MERGED CONTRACT

`supplier_ownership.claim_expired` has no MSG-003 notification consumer. Expire inserts no notification, and the materializer creates no claimant notice for submitted, under-review, withdrawn, or expired events. Notification failure is irrelevant to the command transaction. Historical/imported expiry remains fan-out-suppressed and never calls the live command.

## 14. Ownership and competing-Claim effects

### VERIFIED / DERIVED FROM MERGED CONTRACT

Expire does not create, revoke, transfer, close, supersede, or modify ownership. It does not mutate, select for mutation, or terminalize competing Claims. It does not invoke internal approval supersession. The target Claim keeps `resulting_supplier_ownership_id = NULL`.

An existing ownership row does not convert expiry into approval/rejection or authorize competitor changes. Ownership rows are lock/read-only under the shared protocol; contradictory Claim/ownership history fails integrity reconciliation instead of being repaired.

## 15. Required concurrency table

### VERIFIED / DERIVED FROM MERGED CONTRACT

`command_now` below always means the single instant captured by the lock winner after all locks. A command that acquired all locks and captured a valid pre-expiry time may commit after wall-clock expiry; a waiting command trusts its own later post-lock instant and the committed state/version.

| Race | Initial Claim | Timing | Lock winner | Allowed result | Loser behavior | Version/idempotency rule |
|---|---|---|---|---|---|---|
| Expire vs Expire | `submitted|under_review` | at/after `expires_at` | First valid expiry source item | One `expired` transition/event | Same source item replays; different source item completes `already_terminal` | Exactly one version increment; fences prevent duplicate Phase B |
| Expire vs Expire | active | before `expires_at` | Either | No transition | Each valid source item returns terminal `claim_not_due` | No version change; later due work uses a new durable source item |
| Expire vs Withdraw | active | Withdraw captures time before boundary | Withdraw | `withdrawn` | Expire sees terminal and completes `already_terminal` | One withdrawal version/event; no expiry event |
| Expire vs Withdraw | active | at/after boundary | Expire or waiting Withdraw | Only `expired` may commit | Withdraw returns `claim_expired` if still active/due or terminal/version denial after Expire | One terminal transition; stale human key never becomes expiry authority |
| Expire vs Assign Reviewer | `submitted` | assignment captures time before boundary | Assign | `under_review` | Existing expiry item with old expected version returns `claim_version_conflict`; a new due item may expire version 2 | Assignment and later expiry each increment once; no reassignment |
| Expire vs Assign Reviewer | `submitted` | at/after boundary | Expire or waiting Assign | Only `expired` may commit | Assign returns `claim_expired` or terminal/version denial | No assignment fields are written by Expire |
| Expire vs Reject | `under_review` | Reject captures time before boundary | Reject | `rejected` | Expire completes `already_terminal` | One rejection version/audit/event; no expiry event |
| Expire vs Reject | `under_review` | at/after boundary | Expire or waiting Reject | Only `expired` may commit | Reject returns `claim_expired` or terminal/version denial | One expiry version/event; no rejection audit/event |
| Expire vs Approve | `under_review` | Approve captures time before boundary | Approve | `approved`, ownership, competitor effects | Expire completes `already_terminal` | Approval's complete atomic write set wins; no expiry event |
| Expire vs Approve | `under_review` | at/after boundary | Expire or waiting Approve | Only `expired` may commit | Approve returns `claim_expired` or terminal/version denial; creates no ownership/competitor effects | One expiry version/event; no approval effects |

Required observation examples are exact: source observation A before expiry completes and replays `claim_not_due`; distinct source observation B after expiry uses the current expected version, cannot replay A, and may expire the still-active Claim; retries of successful B replay B. If another valid command terminalizes first, Expire validates that status's complete originating history under section 10 before completing `already_terminal`; incoherent history fails `integrity_reconciliation_required` with no Expire completion or mutation.

An active Claim with a stale expected version returns `claim_version_conflict`; Expire never silently applies to a newer active version. The explicit `already_terminal` rule is evaluated for a coherent terminal row before active-version transition validation, otherwise the approved no-op could not handle concurrent terminalization.

## 16. Proposed exact v1 signature and registry recommendation

### VERIFIED / DERIVED FROM MERGED CONTRACT

The exact Phase-A/business boundary is:

```text
supplier_claim.expire(
  p_source_item_identity text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_correlation_id uuid default null
)
```

Caller/worker supplied:

- `p_source_item_identity`: the validated durable identity of this one scheduler observation, stable across its retries and different for a later observation;
- `p_claim_id`: opaque target aggregate ID;
- `p_expected_claim_version`: optimistic concurrency precondition from the worker's bounded observation; and
- `p_correlation_id`: optional opaque UUID for tracing, generated when absent and excluded from the request fingerprint.

Server derived:

- `principal_kind = automated_worker`;
- worker/actor provenance `claim_expiry_worker`;
- upstream source-system class `claim_expiry_scheduler`;
- `upstream_request_identity = p_source_item_identity`;
- event `source_operation_identity = p_source_item_identity`;
- fixed `expiry_policy_version = claim_expiry_v1`;
- trusted `command_now`;
- Claim, Supplier, claimant, stored expiry, assignment, and terminal-history facts;
- status/outcome, committed Claim version, event metadata/ID, and safe result envelope; and
- the Phase-A execution fence and all other generated operational values.

The callable does not expose worker provenance, source-system class, policy/version literals, trusted time, claimant, Supplier, reviewer, result state/version, event/audit identity, or execution fence as caller overrides. The source item is an identity, not a reason, policy, timestamp, batch ID, worker instance, or authorization fact.

The implementation follows the current Reject/Approve shape: the callable above is the runtime-facing durable Phase-A reservation/replay/reclaim boundary. A private `supplier_claim._execute_expire(..., p_execution_fence uuid)` Phase-B routine carries the same validated semantic inputs and the opaque current fence; the fence is returned only by Phase A and is not a business input.

The result uses the fixed Claim envelope:

```text
command
command_contract_version
outcome_code
claim_id
claim_status
claim_version
supplier_profile_id
expired_at
idempotent_replay
```

`expired_at` is present for an `expired` result and nullable for an `already_terminal` result whose terminal status is not `expired`.

### VERIFIED / DERIVED FROM OWNER APPROVAL

The exact fixed v1 provenance registry is:

```text
expiry_system_source_code = claim_expiry_worker
expiry_policy_version     = claim_expiry_v1
```

These are server-side v1 constants, not arbitrary caller vocabulary and not the per-observation identity. No separate expiry reason column or caller-supplied reason is required. The reason is inherent to reaching the fixed trusted-time expiry; no human actor or reviewer decision is represented.

## 17. Error taxonomy

### VERIFIED / DERIVED FROM MERGED CONTRACT

| Condition | Stable result |
|---|---|
| malformed source identity/Claim/version/policy/correlation | `P5101 / invalid_request` |
| missing/wrong worker role, purpose, environment, policy, or worker context | `P5100 / claim_context_invalid` |
| target missing | `P5111 / claim_not_found` |
| coherent active Claim with stale expected version | `P5112 / claim_version_conflict` |
| coherent but unsupported/non-expirable current nonterminal state | `P5113 / claim_not_actionable` |
| active Claim not yet due | `claim_not_due`; no existing SQLSTATE is assigned |
| coherent terminal Claim | completed `already_terminal` no-op, not an error |
| changed source/target/fingerprint binding | `P5108 / idempotency_key_conflict` |
| matching unexpired lease | `P5109 / command_in_progress` |
| retryable/reclaim timing failure | `P5110 / retry_later` |
| a separately required security/failure audit is unavailable; ordinary expiry success requires no audit | `P5116 / audit_unavailable` |
| corrupt Claim/idempotency/event/audit history or required event unavailable | `P5199 / integrity_reconciliation_required` |

### IMPLEMENTATION RECOMMENDATION

Assign the already-approved `claim_not_due` literal the next unused Claim SQLSTATE `P5117`. Reusing `P5114 / claim_expired` would invert the established meaning, and `P5115` is already `reviewer_already_assigned`; a new mapping is therefore unavoidable and must be tested/documented in the SQL slice.

## 18. Focused implementation-test plan

Do not run these tests in this documentation task. The later SQL PR must prove:

1. **Signature/grants:** exact public `expire(text,uuid,integer,uuid)` Phase-A signature/result; private fenced Phase B; dedicated worker-only execute; no human/API/generic-`service_role` execute; no direct Claim/internal-table grants; fixed owners/search paths; exactly three Claim SELECT and zero mutation policies.
2. **Source identity and context:** valid non-empty 1-256-octet observation identity; missing, invalid, and oversized denial; fixed `claim_expiry_scheduler` upstream source and `claim_expiry_worker` principal/actor provenance; exact upstream/event source mapping; no process/host/instance identity; worker-role/source-context isolation.
3. **Observation progression:** observation A before expiry completes `claim_not_due`; exact retry of A replays A; distinct observation B after expiry with the current version does not replay A and expires the Claim; exact retry of B replays B.
4. **Source-binding conflict:** reuse one source-item identity with a changed target, expected version, stored expiry, source class, worker provenance, policy, or fingerprint fails `idempotency_key_conflict` without mutation.
5. **Time:** before-expiry `claim_not_due`; exact equality success; after-expiry success; one post-lock timestamp; session timezone/DST independence; exact `submitted_at + 720 hours` integrity.
6. **States:** submitted success; under-review success; every valid terminal status produces `already_terminal`; terminal rows never reopen.
7. **First-time terminal integrity:** schema-valid malformed prior `expired`, `withdrawn`, `rejected`, `approved`, and `superseded` rows, including missing/duplicate/wrong originating idempotency, event, audit, ownership, winner, or competitor-set artifacts as applicable, all fail `integrity_reconciliation_required`; exact valid controls for all five statuses complete `already_terminal` without an Expire event/audit/domain mutation.
8. **Assignment:** all six assignment fields preserved byte-for-byte; no assignment-version input; reviewer visibility closes because status is terminal; no reviewer/role/access mutation.
9. **Versioning:** current version increments once; active stale expected version fails; same completed observation does not increment; concurrent assignment produces active-version conflict for the old expiry observation.
10. **Idempotency lifecycle:** unexpired lease; expired reclaim; stale-fence denial; attempt-10 reconciliation; completed retention valid at completion; terminal failure replay.
11. **Replay corruption:** Claim version/status/time/source/policy/assignment shape; source/upstream binding; idempotency lifecycle/fingerprint/result; missing/duplicate/wrong event; payload/envelope/sequence/correlation/time/historical flags; exact zero ordinary audit; all fail closed with zero writes.
12. **Atomic rollback:** Claim update, required event, and idempotency completion commit or roll back together; injected event/idempotency failure leaves no expiry/version/result success.
13. **Event/audit/effects:** exact `supplier_ownership.claim_expired` v1 ordinal/payload/automated-worker/source-operation provenance; no event for `claim_not_due|already_terminal`; zero ordinary success audits; no notification, ownership, competing-Claim, decision/withdrawal/supersession, or sensitive-payload effect.
14. **Lock order and true multi-session races:** instrument exact principal-advisory -> Supplier-advisory -> principal-row ordering; Expire vs Expire (same and different observation identity), Submit, Withdraw, Assign Reviewer, Reject, and Approve before/at/after the boundary; forced lock waits across the boundary; one compatible winner; no deadlock; status-specific terminal validation before `already_terminal`.
15. **Bounded worker scan:** `(expires_at, id)` order, independent per-Claim observation/transaction/source binding, one corrupt item does not roll back unrelated items, and no batch-wide business transaction.

## 19. Open gates, impact, and stop point

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

Production/data impact is none. This correction changes one Markdown file only. It performs no Firebase or hosted Supabase access, Production/TEST read or write, SQL migration, pgTAP execution, seed, backfill, deployment, DNS, billing, Auth/config, RLS/grant, notification, ownership, Claim-row, or file operation.

The two Owner decisions are closed: ordinary successful expiry writes no audit row, and the fixed expiry provenance registry is `claim_expiry_worker` / `claim_expiry_v1`. No material Owner decision remains.

Exact stop point: this corrected readiness document, documentation/static validation, commit, push, and one Draft PR. Stop before independent-review approval, Ready status, merge, Expire SQL/pgTAP/worker implementation, Baseline synchronization, hosted action, deployment, or data movement.

## 20. Independent-review and implementation recommendation

The corrected contract remains **IMPLEMENTATION-READY** because M-1 through M-4 are closed from merged REL-001, CLAIM-CMD-001, the five implemented commands, the Claim structure, and the already recorded Owner decisions; no new material Product/Security/Data Owner decision is required.

This corrected readiness exact head should proceed to independent read-only review. Only after that review approves this exact head may a separate local-only task implement `supplier_claim.expire` SQL, focused pgTAP, and its synthetic concurrency harness under the boundaries in this document. This documentation PR contains no SQL or runtime implementation and does not itself authorize work from an unreviewed or changed head.

Merging this corrected readiness PR deploys and activates nothing. Hosted Supabase linking/migration, gateway or worker activation, Firebase/Production authority, data movement, and deployment remain separately gated, including by `RES-001` and `MIG-002`. Do not mark this Draft PR Ready or merge it in this task.

## References

- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md`](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [`39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md`](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [`42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md`](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [`46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md`](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [`50_CLAIM_WITHDRAW_IMPLEMENTATION_READINESS.md`](50_CLAIM_WITHDRAW_IMPLEMENTATION_READINESS.md)
- [`51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md`](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md)
- [`54_CLAIM_WITHDRAW_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`](54_CLAIM_WITHDRAW_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [`62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`](62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [`63_REJECT_TRUSTED_COMMAND_READINESS.md`](63_REJECT_TRUSTED_COMMAND_READINESS.md)
- [`64_REJECT_V1_POLICY_CLOSURE.md`](64_REJECT_V1_POLICY_CLOSURE.md)
- [`65_REJECT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`](65_REJECT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [`66_APPROVE_V1_TRUSTED_COMMAND_READINESS.md`](66_APPROVE_V1_TRUSTED_COMMAND_READINESS.md)
- [`67_APPROVE_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`](67_APPROVE_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [`20260809000100_rel_001_reliability_foundation.sql`](../../supabase/migrations/20260809000100_rel_001_reliability_foundation.sql)
- [`20260809000200_supplier_ownership_claims_foundation.sql`](../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql)
- [`20260810000200_claim_withdraw_trusted_command.sql`](../../supabase/migrations/20260810000200_claim_withdraw_trusted_command.sql)
- [`20260812000100_assign_reviewer_trusted_command.sql`](../../supabase/migrations/20260812000100_assign_reviewer_trusted_command.sql)
- [`20260812000200_reject_trusted_command.sql`](../../supabase/migrations/20260812000200_reject_trusted_command.sql)
- [`20260813000100_approve_trusted_command.sql`](../../supabase/migrations/20260813000100_approve_trusted_command.sql)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
