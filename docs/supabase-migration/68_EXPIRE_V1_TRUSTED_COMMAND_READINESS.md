# `supplier_claim.expire` v1 - Trusted-Command Readiness

Date: 2026-08-14
Primary task profile: Documentation
Verdict: **IMPLEMENTATION-READY**

## 1. Boundary and verified starting state

This is a bounded documentation-only readiness review for the final unimplemented Claim-v1 command, `supplier_claim.expire`. It does not implement SQL, pgTAP, a worker, RLS, grants, notifications, hosted Supabase, Firebase behavior, migration, or Production behavior.

The review started from clean `origin/main` at `9300c7c21f44b538e4e67c0f1fe39e1e001828f4`, the merge of PR #131 after merged PR #130. Static repository verification found:

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
| `approved` | Immutable terminal state; complete a new valid worker source item as `already_terminal`, with no mutation/audit/event |
| `rejected` | Same `already_terminal` no-op |
| `withdrawn` | Same `already_terminal` no-op |
| `expired` | Exact completed request replays; a different valid worker source item completes `already_terminal` without another transition/event |
| `superseded` | Same `already_terminal` no-op |

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

Phase B captures one `clock_timestamp()`-equivalent `command_now` exactly once, after every required lock is held. That single instant supplies the due check, `expired_at`, `updated_at`, event times, idempotency completion time, and any audit time if the Owner selects an audit-writing option. A transaction-start timestamp is insufficient because a transaction may wait across the expiry boundary.

## 5. Caller and authority model

### VERIFIED / DERIVED FROM MERGED CONTRACT

Expire is executed only by a dedicated automated non-browser worker/service with one registered expiry purpose, environment, policy version, and durable source item. It has:

- `principal_kind = automated_worker`;
- no human `principal_user_profile_id` and no fabricated reviewer/Admin/Owner actor;
- a stable code-owned worker source, not a process/host/instance identity;
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
5. acquire the target claimant's versioned principal advisory lock, then lock/re-read the claimant `user_profiles` row for immutable target integrity only; no provider/role/access/security eligibility is required;
6. acquire the common Supplier advisory lock;
7. lock/re-read the Supplier row;
8. lock/read the Supplier ownership set in ascending ownership UUID order without modifying it;
9. lock/re-read the target Claim row; validate immutable parties, structure, state, version, 720-hour invariant, and assignment shape;
10. capture one `command_now`, apply the due predicate, allocate the event/result, update the Claim, insert the required event and any Owner-approved audit, and complete the fenced idempotency row atomically.

No reviewer principal, reviewer role/access/security, competing Claim, ownership-creation, or evidence-verification lock is required. The shared Supplier-before-Claim order prevents inversion with Withdraw, Assign Reviewer, Reject, Approve, Submit, and future ownership writers. Skipping the Supplier lock would violate the approved universal architecture even though Expire changes only one Claim.

## 9. Idempotency and source-item contract

### VERIFIED / DERIVED FROM MERGED CONTRACT

The command name is `supplier_claim.expire`, contract version `1`, target aggregate type `supplier_ownership_claim`, and target aggregate ID = Claim UUID.

The durable scheduler/job/item identity is scoped to the exact Claim UUID, immutable `expires_at`, and fixed policy version. The worker provenance code is the fixed server-derived `claim_expiry_worker`; it is not a caller-selected worker instance. One Claim is one logical source item and one transaction. A bounded scheduler batch may be ordered by `(expires_at, id)`, but batch identity, batch rollback, or batch-wide completion never replaces per-Claim fencing.

The minimum canonical request fingerprint contains:

- Claim UUID;
- expected Claim version;
- immutable stored expiry instant;
- expiry-policy version; and
- durable source-operation identity.

It excludes server time, raw fence, retry count, worker instance, generated IDs, correlation ID, Claim result state/version, event/audit metadata, and any human actor.

Phase A uses the established 60-second local lease, 10-attempt cap, fenced reclaim, and 720-hour replay-row retention only as provisional local protocol parameters. A stale fence cannot enter Phase B or complete a result. Same source identity plus the same target/fingerprint replays or reports `command_in_progress`; a changed target, expected version, expiry instant, policy, source binding, or fingerprint fails `idempotency_key_conflict`.

Successful expiry completes with `outcome_code = expired`, resource type `supplier_ownership_claim`, Claim UUID, and committed Claim-version token. An already-terminal no-op completes with `outcome_code = already_terminal`, the same resource type/ID, and the immutable current terminal version. A not-due active source item records/replays terminal safe failure `claim_not_due`; it never reserves future authority to expire the Claim after time advances. A later scheduler observation must use a new durable source item for the then-current Claim version and due instant.

Exact completed replay is read-only and creates no second transition, version, event, audit, ownership, competitor effect, or notification.

## 10. Historical-success and no-op reconciliation

### VERIFIED / DERIVED FROM MERGED CONTRACT

Completed `expired` replay must verify only durable facts relevant to Expire:

1. the full completed idempotency lifecycle and exact command/version/environment/automated-worker/source/target/upstream/fingerprint/outcome/resource/version binding, including `expires_at > completed_at`;
2. one coherent Claim at the bound version with `status = expired`, `expires_at = submitted_at + interval '720 hours'`, `expired_at >= expires_at`, `expired_at = updated_at = idempotency.completed_at`, the approved expiry source/policy pair, no decision/withdrawal/supersession/ownership fields, and coherent preserved assignment shape;
3. exactly one ordinal-1 `supplier_ownership.claim_expired` v1 event produced by the same idempotency/source item, with aggregate sequence equal to the committed Claim version, exact envelope/times/correlation, exact minimized payload, `is_historical = false`, and `fanout_suppressed = false`; and
4. the exact success-audit shape only if the Owner selects audit-writing expiry.

Completed `already_terminal` replay verifies the completed idempotency binding and the same immutable terminal Claim/version, but requires no Expire event or audit. The no-op does not claim that Expire caused the terminal state.

Do not copy Approve's ownership, competitor-set, event-ordinal range, or approval-audit reconciliation. Missing, duplicate, partial, mismatched, or contradictory durable facts fail `integrity_reconciliation_required`; they never authorize re-execution or repair.

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
| producer identity | current idempotency row and durable source-operation identity |
| ordinal | `1` |
| actor | `automated_worker`; no actor user-profile ID; stable expiry-worker source code |
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

An active Claim with a stale expected version returns `claim_version_conflict`; Expire never silently applies to a newer active version. The explicit `already_terminal` rule is evaluated for a coherent terminal row before active-version transition validation, otherwise the approved no-op could not handle concurrent terminalization.

## 16. Proposed exact v1 signature and registry recommendation

### VERIFIED / DERIVED FROM MERGED CONTRACT

The smallest business boundary is:

```text
supplier_claim.expire(
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_correlation_id uuid default null
)
```

Caller-supplied fields are limited to:

- `p_claim_id`: opaque target aggregate ID;
- `p_expected_claim_version`: optimistic concurrency precondition from the worker's bounded due-item read; and
- `p_correlation_id`: optional opaque UUID for tracing, generated when absent and excluded from the request fingerprint.

`source_operation_identity = 'claim_expiry_worker'` and `expiry_policy_version = 'claim_expiry_v1'` are fixed server-derived v1 constants. They are not caller inputs, are not exposed as override parameters, and are included by the trusted command in its canonical idempotency binding. The durable scheduler/job/item identity remains an internal source-item binding, not a free-form public reason or policy input.

The established two-phase implementation may add a private `_execute_expire(..., p_execution_fence uuid)` Phase-B routine. The fence is returned only by Phase A and is not a business input.

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

These are server-side v1 constants, not arbitrary caller vocabulary. No separate expiry reason column or caller-supplied reason is required. The reason is inherent to reaching the fixed trusted-time expiry; no human actor or reviewer decision is represented.

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
| required audit unavailable, only if audit Option B is approved | `P5116 / audit_unavailable` |
| corrupt Claim/idempotency/event/audit history or required event unavailable | `P5199 / integrity_reconciliation_required` |

### IMPLEMENTATION RECOMMENDATION

Assign the already-approved `claim_not_due` literal the next unused Claim SQLSTATE `P5117`. Reusing `P5114 / claim_expired` would invert the established meaning, and `P5115` is already `reviewer_already_assigned`; a new mapping is therefore unavoidable and must be tested/documented in the SQL slice.

## 18. Focused implementation-test plan

Do not run these tests in this documentation task. The later SQL PR must prove:

1. **Signature/grants:** exact Phase-A signature/result; private fenced Phase B; dedicated worker-only execute; no human/API/generic-`service_role` execute; no direct Claim/internal-table grants; fixed owners/search paths; exactly three Claim SELECT and zero mutation policies.
2. **Time:** before-expiry `claim_not_due`; exact equality success; after-expiry success; one post-lock timestamp; session timezone/DST independence; exact `submitted_at + 720 hours` integrity.
3. **States:** submitted success; under-review success; every terminal status produces `already_terminal`; malformed/unsupported lifecycle fails reconciliation; terminal rows never reopen.
4. **Assignment:** all six assignment fields preserved byte-for-byte; no assignment-version input; reviewer visibility closes because status is terminal; no reviewer/role/access mutation.
5. **Versioning:** current version increments once; active stale expected version fails; same completed request does not increment; concurrent assignment produces active-version conflict for the old expiry item.
6. **Idempotency:** same source/fingerprint replay; changed source/target/version/expiry/policy conflict; unexpired lease; expired reclaim; stale-fence denial; attempt-10 reconciliation; completed retention valid at completion; terminal failure replay.
7. **Replay corruption:** Claim version/status/time/source/policy/assignment shape; idempotency lifecycle/fingerprint/result; missing/duplicate/wrong event; payload/envelope/sequence/correlation/time/historical flags; selected audit option; all fail closed with zero writes.
8. **Atomic rollback:** Claim update, required event, idempotency completion, and selected audit behavior commit or roll back together; injected event/audit/idempotency failure leaves no expiry/version/result success.
9. **Event/audit:** exact `supplier_ownership.claim_expired` v1 ordinal/payload/automated-worker provenance; no event for `claim_not_due|already_terminal`; exact Owner-selected audit classification and zero duplicates on replay.
10. **No extra effects:** no notification insert; no ownership mutation; no competing-Claim mutation; no decision/withdrawal/supersession fields; sensitive-value/event-payload scan.
11. **True multi-session races:** Expire vs Expire (same and different source identity), Withdraw, Assign Reviewer, Reject, and Approve before/at/after the boundary; forced lock waits across the boundary; one compatible winner; no deadlock; correct stale-version/no-op behavior.
12. **Bounded worker scan:** `(expires_at, id)` order, independent per-Claim transaction/source binding, one corrupt item does not roll back unrelated items, and no batch-wide business transaction.

## 19. Open gates, impact, and stop point

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

Production/data impact is none. This review changes one Markdown file only. It performs no Firebase or hosted Supabase access, Production/TEST read or write, SQL migration, pgTAP execution, seed, backfill, deployment, DNS, billing, Auth/config, RLS/grant, notification, ownership, Claim-row, or file operation.

Exact stop point: this readiness document, static validation, commit, push, and one Draft PR. Stop before Owner-decision closure, Expire SQL/pgTAP/worker implementation, Baseline synchronization, Ready status, merge, deployment, hosted action, or data movement.

## 20. Manual-merge recommendation

Manually merge this readiness PR after human review confirms that it accurately records the two unresolved Owner decisions. Merging this documentation does not authorize implementation. After merge, obtain explicit Owner approval for one audit option and the exact expiry provenance registry, then create a separate implementation-readiness closure or SQL task from the newer verified `main`.

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
