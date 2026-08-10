# `supplier_claim.withdraw` implementation readiness

Status: **Implementation-ready recommendation; documentation only; no SQL, command, data, hosted capability, or Production action is implemented or authorized by this document**

Date: 2026-08-10

Verified starting `origin/main`: `52b2043775d74374595c4cfbb12e16aaef465d10`

Merged submit evidence: PR #103, merge commit `fce7a0b3b0f8c5f8f130d91b16f748b6d9f2966c`

Primary task profile: Documentation

## 1. Finding and hard boundary

`supplier_claim.withdraw` can be the next narrow Claim mutation after the post-merge `supplier_claim.submit` red-team closes without a blocker. The approved contracts already determine its lifecycle, actor, time boundary, lock order, idempotency responsibility, event, notification exclusion, safe result, and RLS posture.

The minimum command is a claimant-only terminal transition:

```text
submitted|under_review -- exact current claimant, matching version,
                          trusted command_now < expires_at --> withdrawn
```

Both active source states are withdrawable. `approved`, `rejected`, `withdrawn`, `expired`, and `superseded` are immutable terminal states and are never reopened. A due active Claim is not silently withdrawn or expired by this command: at `command_now >= expires_at`, withdrawal fails `claim_expired`, writes no Claim/event/success result, and leaves terminalization to `supplier_claim.expire`.

This review defines no SQL. It does not run Docker, alter RLS, add a direct `UPDATE` policy, change the claimant projection, implement reviewer/decision/expiry/ownership/notification behavior, update shared Baseline/Register/Schema Design documents, access Firebase or hosted Supabase, touch Production/TEST data, migrate, deploy, mark a PR Ready, or merge.

## 2. Authority and evidence order

The withdrawal implementation must use evidence in this order:

1. [Claim structural readiness](41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md) and the [Claim foundation migration](../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql) define the aggregate, active/terminal states, write-once assignment provenance, and withdrawal columns.
2. [REL-001](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md) defines replay, fingerprint, lease, result-binding, event-envelope, and rollback responsibilities.
3. [AUD-001](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md) independently classifies accountable audit evidence.
4. [SEC-001](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md) defines the current provider-neutral claimant, anti-oracle behavior, trusted-command-only mutation, and self-read boundary.
5. [CLAIM-CMD-001](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md) is authoritative for the six-command model, exact withdrawal transition, 720-hour trusted-time rule, shared locks, idempotency projection, event registry, safe results, and error taxonomy.
6. The merged [Claimant self-read evidence](47_CLAIM_RLS_SELF_READ_FOUNDATION_EVIDENCE.md) and [RLS migration](../../supabase/migrations/20260809000400_claim_rls_self_read_foundation.sql) define what the claimant sees after withdrawal.
7. The merged [submit implementation evidence](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md) and [submit migration](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql) are implementation-convention evidence only. Submit-specific eligibility, creation, evidence, slot-target, result, and error choices do not automatically apply to withdrawal.

Where an earlier document differs, the later Owner-approved CLAIM-CMD-001 contract controls. In particular, every committed Claim-v1 transition now produces its bounded domain event even though the earlier structural review did not yet require an event for withdrawal.

## 3. Exact command contract

### 3.1 Caller inputs

Version 1 accepts exactly:

```text
idempotency_key
claim_id
expected_claim_version
correlation_id?       # optional opaque UUID only
```

The command accepts no claimant/profile/provider identity, Supplier, status, reviewer, withdrawal reason, timestamp, expiry decision, resulting version, audit/event/notification ID, ownership identity, override, or operator-impersonation field.

### 3.2 Server-derived values

The trusted path derives:

- the exact current provider-neutral claimant from transaction-local `claim_security` context;
- the Claim's immutable claimant and Supplier bindings;
- withdrawal policy version `claim_withdrawal_v1`;
- server-owned reason code `claimant_withdrawal`;
- one post-lock trusted `command_now`;
- `withdrawn_at`, `withdrawn_by_user_profile_id`, new Claim version, and `updated_at`;
- event identity, aggregate sequence, source/actor provenance, and correlation when absent; and
- the fenced idempotency attempt and safe result binding.

`claimant_withdrawal` is a code-owned provenance code, not caller narrative or claimant-visible free text. Unknown withdrawal policy/reason versions fail closed.

### 3.3 Trusted actor and authorization

Only the exact current claimant may withdraw their own Claim. The command must:

- receive one valid transaction-local provider-neutral principal established by the trusted gateway;
- re-read that principal's active Supplier-context profile and exact usable Firebase provider link under the principal lock, using the same current relational predicate implemented for submit;
- treat current Firebase token/account observation as a gateway prerequisite, not a PostgreSQL mirror substitute;
- compare the post-lock Claim `claimant_user_profile_id` to the context principal; and
- return the same safe `claim_not_found` result for an unknown Claim and a Claim owned by another claimant.

An Admin, Owner, reviewer, Supplier controller, worker, generic `service_role`, migration operator, or application operator has no withdrawal authority unless independently acting as the exact claimant through the normal claimant context. Reviewer assignment never authorizes withdrawal on the claimant's behalf.

## 4. Lifecycle and trusted-time decision

### 4.1 Allowed source states

| Locked current state | Expected-version match | Time at lock boundary | Result |
|---|---:|---:|---|
| `submitted` | Yes | `command_now < expires_at` | Commit `withdrawn` |
| `under_review` | Yes | `command_now < expires_at` | Commit `withdrawn`; retain all assignment provenance |
| Any active state | No | Any | `claim_version_conflict`; no mutation |
| `submitted|under_review` | Yes | `command_now >= expires_at` | `claim_expired`; no mutation; expiry worker remains responsible |
| `approved|rejected|withdrawn|expired|superseded` | Yes | Any | `claim_not_actionable`; no mutation |
| Any terminal state | No | Any | `claim_version_conflict`; no mutation |

The ordering above is deliberate after exact-self authorization and structural-integrity checks: expected version is checked before actionability/time. This makes stale-version behavior deterministic. An authorized claimant using the current terminal version receives `claim_not_actionable`; a stale request receives `claim_version_conflict` and must refresh through the existing self-read projection.

### 4.2 Terminal immutability

Withdrawal never changes a terminal Claim and never acts as compensation for approval, rejection, expiry, or supersession. A later eligible submission is a new Claim row; it does not reopen the withdrawn Claim. A later ownership transfer or revocation never changes this terminal history.

### 4.3 Trusted time and already-due Claims

The command captures one `clock_timestamp()`-equivalent `command_now` only after all required locks and authoritative re-reads. It uses that same instant for the expiry comparison, withdrawal fields, event occurrence/persistence time, and idempotency completion.

The boundary is exact:

```text
withdrawable = command_now < expires_at
due          = command_now >= expires_at
```

At the due boundary, `supplier_claim.withdraw` must not:

- choose `withdrawn` because the caller arrived earlier but waited on a lock;
- write `expired` as a convenience side effect;
- invoke or emulate the expiry worker;
- complete a successful withdrawal result;
- emit `claim_withdrawn` or `claim_expired`; or
- extend or recompute `expires_at`.

It returns the claimant-safe `claim_expired` failure and records only the terminal idempotency failure behavior required by section 7. The dedicated expiry command later locks and terminalizes the still-active due Claim. This preserves the approved separation between human withdrawal and trusted-worker expiry.

## 5. Deterministic locks and re-reads

### 5.1 Required order

After trusted ingress and request validation, version 1 uses the shared CLAIM-CMD-001 protocol:

1. Reserve or resolve `internal.idempotency_keys` under `supplier_claim.withdraw` version 1.
2. Read only the immutable target Claim-to-claimant/Supplier routing hint. It grants no authority.
3. In the domain transaction, lock and validate the fenced idempotency row.
4. Acquire `claim_security.claim_principal_lock_key_v1` transaction locks for the sorted unique set containing the context principal and routed claimant principal.
5. Acquire `claim_security.claim_supplier_lock_key_v1` for the routed Supplier.
6. Lock/re-read principal `user_profiles` rows in UUID order, provider links in row-ID order, and required identity/security facts in stable order.
7. Lock/re-read the canonical Supplier row.
8. Lock/re-read every relevant Supplier ownership row in ownership-UUID order; ownership is observed for coherence and shared serialization, not used as an extra withdrawal prohibition.
9. Lock/re-read the target Claim; verify immutable claimant/Supplier routing, exact claimant, structural coherence, expected version, active state, expiry, and assignment provenance.
10. Lock/re-read any required Claim/security-hold facts in stable order.
11. Capture `command_now`, apply the time test, allocate the event/result, update the Claim, insert the event, and complete idempotency atomically.

No pre-lock state, claimant, Supplier, ownership, expiry, assignment, or version read authorizes the transition. A routing mismatch after locks is `integrity_reconciliation_required`, not a fallback to the hint.

### 5.2 Race outcomes

| Race | Required deterministic outcome |
|---|---|
| Withdraw versus `assign_reviewer` | Both share principal/Supplier/Claim ordering. If withdrawal commits first, assignment sees `withdrawn` and writes no assignment. If assignment commits first, the Claim becomes `under_review` with a new version; a stale withdrawal fails `claim_version_conflict`. A newly authorized withdrawal using the refreshed version may then transition `under_review -> withdrawn` and retains assignment provenance. |
| Withdraw versus `approve` | The common Supplier lock serializes both. The first valid terminal transition wins. If withdrawal commits first, approval sees terminal/version conflict and creates no ownership, audit success, supersessions, or events. If approval commits first, withdrawal sees terminal/version conflict and cannot reopen the Claim. |
| Withdraw versus `reject` | The common locks serialize both. The first valid transition wins; the loser sees terminal/version conflict and writes no Claim, audit-success, event, or result success. |
| Withdraw versus `expire` | Before expiry, a valid withdrawal may commit and the worker later returns its approved already-terminal no-op. At or after expiry, withdrawal returns `claim_expired`; if expiry commits first, withdrawal sees terminal/version conflict. There is never both a withdrawn and expired event/version. |
| Repeated/concurrent withdrawal | One attempt may commit. The identical same-key attempt replays that result. A same key with any changed binding conflicts. A different key using the old version returns `claim_version_conflict`; using the current withdrawn version returns `claim_not_actionable`. No second version/event is written. |
| Withdraw versus another ownership-creation path | Both share the Supplier lock. Withdrawal never creates, changes, or deletes ownership. Active ownership alone is not an approved withdrawal prohibition. After the lock, withdrawal follows the Claim state/version/time rules; if the ownership path also terminalized the Claim, withdrawal fails. If it left the claimant's Claim active, withdrawal may close it without changing ownership. |
| Withdraw versus principal/profile/link eligibility loss | Participating paths share the principal lock. Whichever commits second re-reads current identity eligibility. Withdrawal cannot commit after the required claimant eligibility was removed. |

## 6. Exact idempotency contract

### 6.1 Namespace, target, and key handling

| Field | Version-1 value |
|---|---|
| `command_name` | `supplier_claim.withdraw` |
| `command_contract_version` | `1` |
| Namespace | Environment identity + command name + contract version |
| Principal | `human_user` + exact context `user_profiles.id` |
| Target aggregate | `supplier_ownership_claim` + exact `claim_id` |
| Key source | Caller-generated high-entropy key using the merged Claim command format |
| Store | `internal.idempotency_keys` only |

The implementation must reuse the merged HMAC convention: never store or log the raw key; use an environment-injected 32-256 byte secret; derive a SHA-256 HMAC over a versioned, length-delimited environment/command/version/key namespace; and record the digest-key version. In the local implementation the namespace is the withdraw equivalent of the submit prefix:

```text
claim-idempotency-key-v1|local|supplier_claim.withdraw|1|<octet-length>:<raw-key>
```

Hosted environment names and key versions remain environment configuration, never caller input or a hard-coded cross-environment replay namespace.

### 6.2 Canonical fingerprint

The exact canonical JSON projection is:

```json
{
  "claim_id": "<uuid>",
  "command_precondition_version": "claim_withdraw_preconditions_v1",
  "expected_claim_version": 2,
  "withdrawal_policy_version": "claim_withdrawal_v1"
}
```

The shown version is illustrative; the actual positive caller value is canonicalized exactly. Object keys are sorted by the existing reviewed JSONB convention. The stored fingerprint is HMAC-SHA-256 over the merged `claim-request-fingerprint-v1|<canonical-json>` framing and carries its key version.

The fingerprint excludes the raw idempotency key, auth/context material, correlation ID, retry/lease/attempt values, caller arrival time, `command_now`, derived claimant/Supplier, generated event/result IDs, current status, current assignment, and response presentation.

### 6.3 Replay, conflict, in-progress, failure, and retry

| Condition | Required behavior |
|---|---|
| Same namespace/key, actor, target, and fingerprint; `completed` | Re-apply current response authorization and result-integrity checks; return the original safe withdrawal result with `idempotent_replay = true`; create no Claim update, version, event, audit success, or notification. Retained Claim read access is sufficient even if Supplier account context later changed, but current authenticated exact-self identity is still required. |
| Same namespaced key with different actor, target, fingerprint, version, or environment | `idempotency_key_conflict`; disclose no prior binding/result; no domain mutation/event. After an accountable actor is resolved, write the minimized AUD-001 conflict outcome described in section 9. |
| Matching key in `processing` with unexpired lease | `command_in_progress` with only a bounded retry hint; no parallel execution. |
| Matching key with expired lease below the attempt cap | Reclaim through a new fenced lease/attempt; stale attempt cannot complete. |
| Matching key at retry/backoff or attempt limit | `retry_later`; reuse the same key after the bounded instruction. Never silently generate a replacement key. |
| Terminal business failure | Store/replay the same bounded terminal failure under that key until retention expiry; no domain event or success result. |
| Retryable infrastructure/serialization failure | The domain transaction rolls back first; the fenced row may then become retryable. Retry uses the same key, a new lease/attempt, and backoff. |
| Crash before domain commit | No Claim/event/completed result exists. The lease may later be reclaimed. |
| Crash after commit but before response | The command is completed; retry rehydrates the committed result. |
| Completed binding or referenced Claim/version mismatch | `integrity_reconciliation_required`; never re-execute or repair inline. |

The local implementation should match the submit slice's initial at-most-60-second lease, maximum 10 attempts, fenced lease digest, and 720-hour local replay row horizon. Those are shared local conventions, not approval for hosted retention, secret custody, or operational retry policy.

## 7. Atomic success write set

A successful non-replay performs exactly these writes in one transaction:

1. Update the locked `public.supplier_ownership_claims` row:
   - `status = 'withdrawn'`;
   - `record_version = prior record_version + 1`;
   - `withdrawn_at = command_now`;
   - `withdrawn_by_user_profile_id = exact context principal`;
   - `withdrawal_reason_code = 'claimant_withdrawal'`; and
   - `updated_at = command_now`.
2. Insert one `supplier_ownership.claim_withdrawn` version-1 domain event.
3. Complete the fenced `internal.idempotency_keys` row with:
   - `outcome_code = 'withdrawn'`;
   - `result_resource_type = 'supplier_ownership_claim'`;
   - `result_resource_id = claim_id`;
   - `result_version_token = committed Claim version`;
   - `completed_at = command_now`; and
   - cleared lease fields.

The command does not clear or alter reviewer assignment fields on an `under_review` Claim. It does not write decision, expiry, supersession, ownership, submitted-content, evidence, snapshot, prior-Claim, or resulting-ownership fields. It inserts no success audit and no notification.

The Claim update, event insert, and fenced idempotency completion must roll back together. Prohibited partial states include a withdrawn Claim without its event, an event without the withdrawn version, a completed result without the transition/event, a Claim transition with a still-processing key, or any duplicate version/event on replay.

## 8. `claim_withdrawn` event

The only successful event is:

```text
event_type = supplier_ownership.claim_withdrawn
event_schema_version = 1
aggregate_type = supplier_ownership_claim
aggregate_id = claim_id
aggregate_sequence = committed Claim record_version
producer_command_name = supplier_claim.withdraw
producer_command_contract_version = 1
producer_idempotency_key_id = reserved key row
event_ordinal = 1
actor_kind = human_user
actor_user_profile_id = exact claimant
source_system_code = mujahiz
environment_code = current trusted environment
producing_component_code = supplier_claim_command
correlation_id = validated input or trusted generated UUID
causation_event_id = null
occurred_at = command_now
persisted_at = command_now
processing_status = pending
available_at = command_now
payload = {
  claim_id,
  supplier_profile_id,
  claimant_user_profile_id,
  claim_version
}
```

The event contains no withdrawal narrative, reviewer identity/assignment, submitted reason/evidence/snapshot, contact or provider identity, role/access/security facts, ownership identity, audit/idempotency digest, notification content, arbitrary metadata, or raw request. Event identity and `(aggregate_type, aggregate_id, aggregate_sequence)` plus `(producer_idempotency_key_id, event_ordinal)` uniqueness prevent duplication.

The event has no notification consumer in Claim v1. It is an immutable integration fact and rollback/reconciliation seam, not an audit record or user-visible feed.

## 9. AUD-001 classification

### 9.1 Successful withdrawal

**Classification: no durable success audit row.** AUD-001 requires durable success evidence for privileged role/ownership mutations, Claim approval/rejection, reviewer assignment that grants private access, security-sensitive corrections, and trusted migration/reconciliation actions. An exact claimant withdrawing their own active Claim is ordinary self-service closure: it grants no privilege, creates no ownership, makes no reviewer decision, and records no evidence judgment.

The authoritative Claim terminal fields plus `supplier_ownership.claim_withdrawn` event preserve the required aggregate and integration history. Adding a success `internal.audit_logs` row would duplicate that history without an AUD-001 accountability purpose. Completed replay also creates no audit row.

This conclusion resolves SEC-001's earlier delivery question for this slice consistently with the merged submit classification; it does not assume submit behavior merely because submit chose the same outcome.

### 9.2 Denied and conflicted attempts

- Missing/malformed/pre-auth context uses bounded security telemetry, not durable domain audit.
- Ordinary exact-command failures such as unknown/wrong-claimant target, stale version, terminal state, or due Claim create no durable withdrawal audit by default. Repeated enumeration or abuse may be promoted only through a separately approved security action registry.
- A same-key binding conflict after an accountable actor is resolved is independently security-relevant under REL-001/AUD-001 and CLAIM-CMD-001. It requires one minimized `conflicted` audit outcome in a separate fail-closed transaction: action `supplier_claim.withdraw`, contract version 1, actor, known opaque Claim target, environment/policy versions, bounded `idempotency_key_conflict`, correlation, and no raw key, fingerprint, prior actor/result, request body, Claim content, provider subject, or SQL error.
- Failure to store that required conflict audit never permits withdrawal and returns `audit_unavailable`/`result_unavailable` with restricted operational alerting.

## 10. Notification decision

[MSG-003](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md) explicitly says a withdrawn Claim has no Claim-v1 notification: the immediate safe command result and retained Claim history are sufficient. The initial materializer registry accepts only approved, rejected, and superseded events.

Therefore withdrawal:

- inserts no notification;
- does not make `claim_withdrawn` materializer-eligible;
- sends no claimant, reviewer, Admin/Owner, controller, email, push, SMS, or WhatsApp notice; and
- never falls back to Firebase notification creation.

## 11. Safe result and anti-oracle errors

### 11.1 Success envelope

The exact safe success/replay result is:

```text
command = supplier_claim.withdraw
command_contract_version = 1
outcome_code = withdrawn
claim_id
claim_status = withdrawn
claim_version
supplier_profile_id
withdrawn_at
idempotent_replay
```

It returns no claimant identity, reviewer/assigner identity, assignment details, private Claim content, evidence, snapshot, internal reason, ownership/controller facts, provider subject, role/access/security evidence, audit/event IDs or payload, idempotency state/digests, notification state, SQL error, or unrestricted row snapshot.

### 11.2 Stable errors and precedence

After typed request/context checks and exact-self authorization, the post-lock order is integrity, expected version, terminal/actionability, then expiry. Stable external classes are:

| Error | Use |
|---|---|
| `invalid_request` | Null/malformed key, Claim UUID, expected version, or correlation UUID |
| `authentication_required` | Gateway has no valid authenticated Firebase request |
| `identity_unavailable` | Current Firebase/link/profile context cannot be established safely |
| `claim_context_invalid` | Internal database command code matching merged submit. The gateway maps a missing/invalid authenticated principal context to its generic auth/identity class, but maps missing/invalid HMAC or other server context to `service_unavailable`; it never blames the user or exposes the setting failure |
| `claim_not_found` | Uniform result for unknown Claim and Claim not owned by the exact current claimant |
| `claim_version_conflict` | Authorized Claim exists but locked version differs; refresh through the self projection |
| `claim_not_actionable` | Matching current version is terminal or otherwise not an approved active source state |
| `claim_expired` | Matching current active Claim is due at post-lock trusted time; expiry remains a worker responsibility |
| `idempotency_key_conflict` | Same namespaced key has a different immutable binding |
| `command_in_progress` | Same command is protected by an unexpired fenced lease |
| `retry_later` | Retryable/backoff/attempt disposition requires same-key retry later |
| `audit_unavailable` | Required idempotency-conflict audit could not be stored; denial remains denial |
| `integrity_reconciliation_required` | Routing, aggregate, event, result, or idempotency state is contradictory/corrupt |
| `result_unavailable` | Gateway mapping for unknown/internal failure; never exposes SQL/stack/provider text |

The command does not expose whether an unauthorized Claim exists, who owns it, whether it has a reviewer, its state/version/expiry, another claimant, current ownership, or conflict counts. Unknown and wrong-claimant targets have the same status/body shape and bounded timing expectations.

## 12. RLS and claimant self-read after withdrawal

Withdrawal remains trusted-command-only. The implementation must add no Claim `UPDATE` policy and no table mutation grant. `PUBLIC`, `anon`, `authenticated`, `service_role`, and the Claim runtime continue to lack direct Claim `UPDATE`; only the narrowly executable `SECURITY DEFINER` command may perform its reviewed update.

The existing claimant policy is status-independent and predicates exact `claimant_user_profile_id`, so a successfully withdrawn row remains visible to that claimant through `public.supplier_ownership_claims_claimant_v1`. Without changing the projection, the next read shows:

- `status = 'withdrawn'`;
- `claimant_result_code = 'withdrawn'`;
- the incremented `record_version`;
- the committed `withdrawn_at`;
- the same immutable `submitted_at` and `expires_at`; and
- updated `updated_at`.

The projection continues to hide `withdrawn_by_user_profile_id`, `withdrawal_reason_code`, reviewer identity/assignment provenance, evidence, audit/event/idempotency fields, and ownership details. If the Claim had been `under_review`, the terminal status naturally removes it from any future active reviewer queue/detail predicate while the base row retains write-once assignment provenance. A later loss of Supplier account context does not erase retained exact-self Claim history; current authenticated exact-self identity remains required for replay/read.

## 13. Implementation test matrix

All tests use disposable local PostgreSQL and synthetic identities, Suppliers, Claims, keys, and events. No Docker run is authorized by this documentation task; this matrix is for the later SQL slice.

### 13.1 Success and state

| ID | Scenario | Required proof |
|---|---|---|
| WD-S01 | Exact claimant withdraws `submitted` Claim with current version before expiry | One `withdrawn` transition, version +1, exact claimant/time/reason/update fields, one event, completed result, no audit/notification |
| WD-S02 | Exact claimant withdraws `under_review` Claim with current version before expiry | Same success; every assignment field remains byte-for-byte unchanged; no decision/ownership write |
| WD-S03 | Success response schema | Exact fields/types only; forbidden-value scan passes |
| WD-S04 | Existing claimant projection after withdrawal | Same claimant sees withdrawn status/result/time/version; another claimant sees zero rows; hidden withdrawal/assignment/internal fields remain unavailable |

### 13.2 Replay and idempotency

| ID | Scenario | Required proof |
|---|---|---|
| WD-I01 | Same key/actor/target/fingerprint after lost response | Exact safe replay with `idempotent_replay = true`; Claim/event counts and version unchanged |
| WD-I02 | Same key with changed expected version | `idempotency_key_conflict`; no domain write/event; minimized conflict audit only |
| WD-I03 | Same key with changed actor, target, environment, or policy/fingerprint version | Same safe conflict; no prior binding/result disclosure |
| WD-I04 | Unexpired processing lease | `command_in_progress`; no second execution |
| WD-I05 | Expired lease below cap | New fenced attempt may execute; stale lease cannot complete |
| WD-I06 | Retry/backoff or attempt limit | `retry_later`; no partial state; same key remains required |
| WD-I07 | Correlation ID changes on exact replay | Correlation is excluded from fingerprint; original committed event correlation remains unchanged |
| WD-I08 | Completed result references wrong/missing Claim or version | `integrity_reconciliation_required`; no re-execution |

### 13.3 Actor, context, state, and expiry negatives

| ID | Scenario | Required proof |
|---|---|---|
| WD-A01 | Missing, malformed, expired, wrong-purpose, wrong-environment, or wrong-policy context | No principal and no mutation/reservation where rejection occurs before reservation; safe context/identity error |
| WD-A02 | Context principal profile/link inactive, ambiguous, unverified, or non-Supplier context | Fail closed; no mirror/provider detail disclosure |
| WD-A03 | Different claimant targets a real Claim | Same `claim_not_found` shape as unknown UUID; no Claim/event/success audit |
| WD-A04 | Admin/Owner/reviewer/controller/service role targets Claim without being exact claimant | Same denial; role never supplies claimant authority |
| WD-V01 | Stale expected version on active Claim | `claim_version_conflict`; no transition/event |
| WD-T01 | Current-version `approved` Claim | `claim_not_actionable`; no reopen |
| WD-T02 | Current-version `rejected` Claim | `claim_not_actionable`; no reopen |
| WD-T03 | Current-version `withdrawn` Claim under a new key | `claim_not_actionable`; no duplicate event/version |
| WD-T04 | Current-version `expired` Claim | `claim_not_actionable`; no rewrite |
| WD-T05 | Current-version `superseded` Claim | `claim_not_actionable`; no rewrite |
| WD-E01 | Active Claim at `command_now = expires_at` | `claim_expired`; remains active for expiry worker; no withdrawn/expired event from withdraw |
| WD-E02 | Active Claim after `expires_at` | Same deterministic due result |
| WD-E03 | Active Claim immediately before `expires_at` | May withdraw only if post-lock `command_now` remains strictly earlier |
| WD-E04 | Session timezone/DST presentation differs | Boundary follows stored `timestamptz` and exact 720-hour instant only |

### 13.4 Concurrency

| ID | Scenario | Required proof |
|---|---|---|
| WD-C01 | Two concurrent identical withdrawals with same key | One commit; other in-progress or completed replay; one version/event |
| WD-C02 | Two concurrent withdrawals with different keys | One commit; loser version/actionability conflict; one version/event |
| WD-C03 | Withdraw races reviewer assignment, withdraw locks first | Claim withdrawn; no assignment/audit/event from assignment |
| WD-C04 | Withdraw races reviewer assignment, assignment locks first | Assignment commits; stale withdrawal conflicts; refreshed new logical withdrawal can close `under_review` and retain assignment fields |
| WD-C05 | Withdraw races approval | At most one terminal transition; approval-first may create ownership/supersessions, withdrawal-first prevents every approval side effect |
| WD-C06 | Withdraw races rejection | At most one terminal transition; no loser audit-success/event |
| WD-C07 | Withdraw races expiry before due | Valid first transition wins; expiry sees already terminal or withdraw sees current state |
| WD-C08 | Withdraw races expiry at/after due | Withdrawal cannot commit; expiry may terminalize; never both terminal events |
| WD-C09 | Withdraw races other ownership creation | Shared Supplier lock serializes; withdrawal never changes ownership and follows only locked Claim state/version/time |
| WD-C10 | Withdraw races claimant profile/link eligibility loss | Shared principal lock ensures second committer observes first result; no withdrawal using removed eligibility |

### 13.5 Security, rollback, and catalog

| ID | Scenario | Required proof |
|---|---|---|
| WD-R01 | Force `claim_withdrawn` event insert failure | Claim update and idempotency completion roll back; no event/partial result |
| WD-R02 | Force fenced idempotency completion failure | Claim update and event roll back; key is not falsely completed |
| WD-R03 | Force Claim update/constraint failure | Event/result success absent; safe integrity mapping |
| WD-R04 | Force required idempotency-conflict audit failure | Original request remains denied; safe `audit_unavailable`/`result_unavailable`; no Claim/event mutation |
| WD-R05 | Replay after forced pre-commit failure | Same key can follow only the approved retry/fencing path; stale attempt cannot complete |
| WD-G01 | Runtime/browser/API/generic `service_role` direct Claim `UPDATE` | SQLSTATE privilege denial; zero rows changed |
| WD-G02 | Runtime invokes only the named withdraw routine | Exact schema/function grant only; other command/helpers/internal tables remain unavailable |
| WD-G03 | Routine catalog/security posture | Dedicated definer owner, no superuser/`BYPASSRLS`/unsafe inheritance, fixed `pg_catalog` search path, qualified objects, no dynamic SQL, API/PUBLIC execute denied |
| WD-G04 | Lock helper grants | Existing lock helpers remain non-callable to runtime/API roles but usable inside the trusted routine |
| WD-G05 | Event/result/error sensitive scan | No raw key/HMAC, token/provider subject, private Claim content, reviewer identity, audit payload, SQL/stack text, or unrelated IDs escape |

## 14. Reuse versus extraction

The later implementation should reuse the merged submit slice selectively:

- **Reuse directly:** `claim_security.claim_principal_lock_key_v1`, `claim_security.claim_supplier_lock_key_v1`, the `supplier_claim` schema/security posture, transaction-local principal resolver, HMAC framing and key-version conventions, fenced lease/attempt lifecycle, stable SQLSTATE/error family, safe typed-result style, domain-event envelope columns, correlation behavior, and explicit grant/catalog tests.
- **Do not inherit:** submit's Supplier creation-slot target, claim creation rules, submitted reason/evidence validation, prior-Claim behavior, unowned-Supplier prohibition as a withdrawal precondition, 720-hour result shape, or submit-specific error meanings.
- **Do not call submit or create a generic command framework:** submit's HMAC/idempotency implementation is inline and its creation flow is command-specific. Withdrawal should implement its own small command-owned canonical request, locked checks, transition, event, and result.
- **Defer broad helper extraction:** once withdraw is implemented and both commands expose proven identical low-level reservation/replay/fencing code, a later isolated refactor may extract a narrowly typed internal helper. It must preserve existing key digests, replay compatibility, SQLSTATEs, privileges, and tests. Do not combine that refactor with the first withdrawal implementation unless red-team evidence proves duplication itself is an immediate correctness blocker.

This is the smallest safe shape: reuse the already-shared lock helpers and conventions now, gather a second real command as evidence, then consider only a narrow extraction. No generic workflow, event, audit, or command registry framework is justified.

## 15. Owner decisions, prerequisites, and exact stop point

No approved CLAIM-CMD-001 choice is reopened. This review resolves for withdrawal:

- both `submitted` and `under_review` are withdrawable;
- all five terminal states remain immutable;
- the exact claimant is the only actor;
- the due boundary returns `claim_expired` and does not expire inline;
- the server-owned reason/policy identifiers are `claimant_withdrawal` / `claim_withdrawal_v1`;
- successful withdrawal has no AUD-001 row, while post-auth idempotency-binding conflict has minimized conflict audit;
- one minimized `claim_withdrawn` event is mandatory;
- no Claim-v1 notification exists;
- direct Claim `UPDATE` remains denied; and
- the existing claimant projection remains sufficient after withdrawal.

There is no further product-state, notification, or RLS owner decision for this narrow local slice. The remaining prerequisites are delivery gates rather than reopened product choices:

1. the post-merge submit red-team must close without a blocker relevant to shared lock, HMAC, idempotency, definer, event, result, or rollback conventions;
2. exact SQL/pgTAP must be reviewed in a separate implementation PR using this contract;
3. hosted HMAC custody, gateway/pool isolation, REL retention/operations, and environment configuration remain governed by their separate security/operations gates; and
4. hosted Supabase, migration/cutover, Firebase/Production authority, and deployment remain unauthorized.

Exact stop point for this task: create this one Markdown file, validate a documentation-only diff and links, commit and push `codex/claim-withdraw-readiness`, open exactly one Draft PR, keep it Draft, and stop. Do not implement SQL, run Docker, update shared Baseline/Register/Schema Design documents, access Firebase or hosted Supabase, inspect or change Production/TEST data, mark Ready, merge, migrate, or deploy.

## 16. References

- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md`](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [`39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md`](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [`41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md`](41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md)
- [`42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md`](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [`46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md`](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [`47_CLAIM_RLS_SELF_READ_FOUNDATION_EVIDENCE.md`](47_CLAIM_RLS_SELF_READ_FOUNDATION_EVIDENCE.md)
- [`48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [`51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md`](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md)
- [`52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md`](52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md)
- [`../../supabase/migrations/20260809000100_rel_001_reliability_foundation.sql`](../../supabase/migrations/20260809000100_rel_001_reliability_foundation.sql)
- [`../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql`](../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql)
- [`../../supabase/migrations/20260809000400_claim_rls_self_read_foundation.sql`](../../supabase/migrations/20260809000400_claim_rls_self_read_foundation.sql)
- [`../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql`](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql)
