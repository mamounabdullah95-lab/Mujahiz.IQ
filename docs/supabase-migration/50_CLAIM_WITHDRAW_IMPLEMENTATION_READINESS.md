# `supplier_claim.withdraw` implementation readiness

Status: **Implementation-ready recommendation synchronized to the corrected two-phase REL-001 protocol; documentation only; no SQL, command, data, hosted capability, or Production action is implemented or authorized by this document**

Date: 2026-08-10

Verified starting `origin/main`: `37243fe43f0cd26008c93a5ebf4da2963270123d`

Merged submit evidence: PR #103, merge commit `fce7a0b3b0f8c5f8f130d91b16f748b6d9f2966c`

Corrected reliability evidence: PR #108 red-team merge `b567caa4b33cff9424d7a0df4d3ff96be77a8943`; PR #109 corrective head `b403e1ffdc3ac276cc391c811629509aedb68af1`, merged as `37243fe43f0cd26008c93a5ebf4da2963270123d`; local gate #171 succeeded

Primary task profile: Documentation

## 1. Finding and hard boundary

`supplier_claim.withdraw` is implementation-ready as the next narrow Claim mutation from the idempotency and locking perspective. PR #108 found three shared submit blockers: incomplete completed-replay binding, expected race outcomes misclassified as integrity failures, and a one-transaction reservation lifecycle that was not durably observable. PR #109 corrected them with a committed reservation phase, a separately committed or rolled-back fenced execution phase, terminal reconciliation, and true multi-session proof. Withdrawal adopts that corrected protocol while deriving its business behavior independently from the approved Claim contracts.

This conclusion authorizes no gateway, hosted, migration, or Production readiness. The logical command remains exactly `supplier_claim.withdraw`, one of the six approved CLAIM-CMD-001 commands. A private reservation helper boundary such as `reserve_withdraw` is an implementation concept, not a seventh business command; the later SQL review may choose the exact private routine name.

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
7. The merged [submit implementation evidence](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md), [submit red-team](49_PR_103_CLAIM_SUBMIT_POST_MERGE_SECURITY_RED_TEAM_REVIEW.md), [corrective evidence](53_CLAIM_SUBMIT_IDEMPOTENCY_HOTFIX_EVIDENCE.md), original submit migration, and corrective migration are shared implementation-convention evidence only. Document 53 proves the corrected local two-phase pattern; it is not withdrawal business authority. Submit-specific eligibility, creation, evidence, slot-target, result, error, lease-duration, attempt-limit, and retention choices do not automatically apply to withdrawal.

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

It returns the claimant-safe `claim_expired` failure. Phase B rolls back without completing a withdrawal result; the durable Phase-A reservation follows the bounded reclaim/reconciliation lifecycle in section 6.3. The dedicated expiry command later locks and terminalizes the still-active due Claim. This preserves the approved separation between human withdrawal and trusted-worker expiry.

## 5. Corrected two-phase protocol, deterministic locks, and races

### 5.1 One logical command, two transaction boundaries

The public business operation remains `supplier_claim.withdraw`. Its trusted adapter must execute two database transactions. A private, withdraw-specific canonicalization/reservation helper is permitted, but it is not separately exposed, independently authorized, or counted as another Claim command.

The adapter must never wrap both phases in one caller transaction. Doing so would recreate PR #108 M-3 by hiding `processing`, losing the reservation on domain rollback, and making reclaim/attempt tests fictitious.

### 5.2 Phase A — durable reservation

Phase A accepts only the semantic command inputs `idempotency_key`, `claim_id`, and `expected_claim_version`. It must:

1. derive the exact claimant from transaction-local `claim_security` context and require the trusted environment/HMAC context;
2. validate/canonicalize the request and compute the versioned key digest, request fingerprint, principal, and target binding deterministically;
3. lock/reserve the exact `internal.idempotency_keys` namespace row;
4. commit a new `processing` reservation, or durably reclaim an eligible expired attempt with an incremented attempt and a new fence;
5. return one bounded trusted-runtime outcome: execute with opaque fence, completed replay, in-progress, conflict, or terminal reconciliation; and
6. commit before Phase B begins.

`correlation_id` is observability input, not semantic command identity. It is excluded from the Phase-A fingerprint and canonical result semantics. Phase A must not authorize or write a new Claim lifecycle transition, emit a new event, or expose `internal.idempotency_keys` directly to the runtime. A completed-row replay path may read the committed Claim/event only to perform section 6.4 integrity verification and return the original result; it never derives a replacement result from mutable state.

The raw execution fence is a runtime-only transaction-A-to-transaction-B capability. Only its HMAC digest is stored. The raw value is never browser/API input, business output, event/audit data, database row data, or log/telemetry content.

### 5.3 Phase B — fenced domain execution

Phase B starts a new transaction and must:

1. re-establish the same exact claimant and trusted HMAC/environment context;
2. re-canonicalize the same semantic inputs and recompute the exact key/principal/target/fingerprint binding rather than trusting Phase-A output;
3. lock the exact reservation row and verify `processing`, unexpired lease, current attempt, digest-key version, and the exact opaque-fence digest;
4. reject missing, completed, expired, reclaimed/stale-fence, conflicting, or terminal-reconciliation reservations with bounded existing classes;
5. only after the reservation is fenced, acquire and re-read the domain locks in section 5.4; and
6. update the Claim, insert the one event, and complete that same reservation attempt atomically.

If the Claim update, event insert, or fenced completion fails, the entire Phase-B transaction rolls back. The already committed Phase-A reservation remains durable and reclaimable; no handler may erase it, manufacture completion, or translate an unexpected database failure into a normal business result.

### 5.4 Shared domain lock order

After the fenced idempotency-row lock, withdrawal uses the shared CLAIM-CMD-001 ordering:

1. read only the immutable target Claim-to-claimant/Supplier routing hint; it grants no authority;
2. acquire `claim_security.claim_principal_lock_key_v1` transaction locks for the sorted unique set containing the context principal and routed claimant principal;
3. acquire `claim_security.claim_supplier_lock_key_v1` for the routed Supplier;
4. lock/re-read principal `user_profiles` rows in UUID order, provider links in row-ID order, and required identity/security facts in stable order;
5. lock/re-read the canonical Supplier row;
6. lock/re-read every relevant Supplier ownership row in ownership-UUID order; ownership is observed for coherence and shared serialization, not used as an extra withdrawal prohibition;
7. lock/re-read the target Claim; verify immutable claimant/Supplier routing, exact claimant, structural coherence, expected version, active state, expiry, and assignment provenance;
8. lock/re-read any required Claim/security-hold facts in stable order; and
9. capture one `command_now`, apply the trusted-time decision, then perform the Phase-B write set.

No pre-lock state, claimant, Supplier, ownership, expiry, assignment, or version read authorizes the transition. A routing mismatch after locks is `integrity_reconciliation_required`, not a fallback to the hint.

### 5.5 Race outcomes

| Race | Required deterministic outcome |
|---|---|
| Withdraw versus `assign_reviewer` | Both share principal/Supplier/Claim ordering. If withdrawal commits first, assignment sees `withdrawn` and writes no assignment. If assignment commits first, the Claim becomes `under_review` with a new version; a stale withdrawal fails `claim_version_conflict`. A newly authorized withdrawal using the refreshed version may then transition `under_review -> withdrawn` and retains assignment provenance. |
| Withdraw versus `approve` | The common Supplier lock serializes both. The first valid terminal transition wins. If withdrawal commits first, approval sees terminal/version conflict and creates no ownership, audit success, supersessions, or events. If approval commits first, withdrawal sees terminal/version conflict and cannot reopen the Claim. |
| Withdraw versus `reject` | The common locks serialize both. The first valid transition wins; the loser sees terminal/version conflict and writes no Claim, audit-success, event, or result success. |
| Withdraw versus `expire` | Before expiry, a valid withdrawal may commit and the worker later returns its approved already-terminal no-op. At or after expiry, withdrawal returns `claim_expired`; if expiry commits first, withdrawal sees terminal/version conflict. There is never both a withdrawn and expired event/version. |
| Repeated/concurrent withdrawal | One attempt may commit. The identical same-key attempt returns the original completed result. A same key with any changed binding conflicts. A different key using the old version returns `claim_version_conflict`; using the current withdrawn version returns `claim_not_actionable`. No second version/event is written. |
| Withdraw versus another ownership-creation path | Both share the Supplier lock. Withdrawal never creates, changes, or deletes ownership. Active ownership alone is not an approved withdrawal prohibition. After the lock, withdrawal follows the Claim state/version/time rules; if the ownership path also terminalized the Claim, withdrawal fails. If it left the claimant's Claim active, withdrawal may close it without changing ownership. |
| Withdraw versus principal/profile/link eligibility loss | Participating paths share the principal lock. Whichever commits second re-reads current identity eligibility. Withdrawal cannot commit after required claimant eligibility was removed. |

These are expected business/version/actionability outcomes. They must not be labeled `integrity_reconciliation_required` unless the locked data is genuinely contradictory or corrupt. The Phase-A idempotency row may remain durable after a Phase-B loser rolls back; that is protocol state, not a partial Claim mutation.

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

### 6.2 Canonical request fingerprint

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

The fingerprint excludes the raw idempotency key, auth/context material, correlation ID, retry/lease/attempt/fence values, caller arrival time, `command_now`, derived Supplier, generated event/result IDs, current status, current assignment, and response presentation. The context claimant is still an immutable idempotency-row principal binding and must match on every reservation/replay.

### 6.3 Reservation, replay, conflict, retry, and reconciliation

| Condition | Required behavior |
|---|---|
| No row for exact namespace/key digest | Phase A commits `processing`, attempt 1, a bounded lease, and the digest of a new opaque fence; trusted runtime receives execute + raw fence. |
| Same namespace/key, principal, target, and fingerprint; `completed` | Re-apply current exact-self authentication/authorization and the full result-integrity checks in section 6.4; return the original committed withdrawal result with `idempotent_replay = true`; create no Claim update, version, event, audit success, or notification. Correlation changes do not alter the original result/event. |
| Same namespaced key with different principal, target, fingerprint, command/version, or environment | `idempotency_key_conflict`; disclose no prior binding/result and perform no domain mutation/event. After an accountable actor is resolved, write only the minimized AUD-001 conflict outcome in section 9. |
| Matching `processing` row with unexpired lease | `command_in_progress` with a bounded retry hint; do not wait behind or start parallel domain execution. |
| Matching expired `processing` or due retryable row below the configured cap | Durably reclaim in Phase A with incremented attempt and a new fence; the previous fence can never execute or complete. |
| Configured terminal attempt boundary reached | Durably terminalize as failed/terminal reconciliation state, clear the lease, and return the same bounded reconciliation outcome on later calls; never loop forever as `retry_later` and never re-execute. |
| Phase-B business/version/actionability failure | Phase B rolls back, including any domain/event/completion write. The committed reservation remains eligible only for the approved lease/reclaim/attempt lifecycle; the stable business error is returned without being mislabeled as integrity corruption. |
| Retryable infrastructure/serialization failure | Phase B rolls back; same-key retry proceeds only through expiry/reclaim and a new fence/attempt. |
| Crash before Phase-A commit | No reservation or domain result exists; a retry may reserve normally. |
| Crash after Phase-A commit but before Phase B | Durable `processing` remains visible to another session, first as in-progress and later as reclaimable. |
| Crash after Phase-B commit but before response | Row is `completed`; retry returns the original committed result. |
| Completed binding/result/event mismatch or impossible reservation state | Terminal `integrity_reconciliation_required`; never repair inline, silently no-op, or re-execute. |

The protocol requires a bounded lease, bounded attempts/backoff, durable terminal reconciliation, and retention long enough for approved replay. The current submit hotfix's local 60-second lease and 10-attempt cap are implementation evidence only, not universal withdrawal product/operations decisions. A later SQL PR may initially use those provisional local values for consistent proof only if it labels them non-hosted and leaves final Technical/Security/Operations approval open. The 720-hour Claim expiry is a business rule, not an idempotency-row retention decision.

### 6.4 Completed replay is an immutable committed fact

Completed replay must return the original committed withdrawal result, not a projection reconstructed from mutable current fields. Before returning it, the command must bind and verify at least:

- exact environment, `supplier_claim.withdraw`, contract version 1, digest-key version, principal kind/ID, target type/ID, and canonical request fingerprint including the original expected Claim version;
- result resource type/ID equal to the exact withdrawn Claim, `outcome_code = 'withdrawn'`, committed result version token, and original `withdrawn_at`;
- the Claim remains the same aggregate and claimant/Supplier binding, has status `withdrawn`, has the exact committed result version and original withdrawal fields, and preserves the expected source-to-result version relationship;
- exactly one `supplier_ownership.claim_withdrawn` event exists for that result aggregate/version;
- that event names the exact producing idempotency row, ordinal 1, command/version, aggregate type/ID/sequence, actor, Supplier/claimant payload, source/environment/component, and original occurrence/persistence/correlation values; and
- no second event for the same aggregate/version or producer row contradicts the result.

Any missing, mutable-to-another-result, duplicated, or contradictory binding is reconciliation-required corruption. A normal later Claim race, loss of Supplier account context, or changed retry correlation is not corruption and must follow its separately approved safe behavior.

## 7. Atomic Phase-B success write set

Phase A has already committed the processing reservation and performs no domain write. A successful non-replay Phase B performs exactly these writes in its separate transaction:

1. Update the locked `public.supplier_ownership_claims` row:
   - `status = 'withdrawn'`;
   - `record_version = prior record_version + 1`;
   - `withdrawn_at = command_now`;
   - `withdrawn_by_user_profile_id = exact context principal`;
   - `withdrawal_reason_code = 'claimant_withdrawal'`; and
   - `updated_at = command_now`.
2. Insert one `supplier_ownership.claim_withdrawn` version-1 domain event.
3. Complete the exact same fenced attempt of the `internal.idempotency_keys` row with:
   - `outcome_code = 'withdrawn'`;
   - `result_resource_type = 'supplier_ownership_claim'`;
   - `result_resource_id = claim_id`;
   - `result_version_token = committed Claim version`;
   - `completed_at = command_now`;
   - an immutable original-result binding sufficient for section 6.4; and
   - cleared lease fields.

The command does not clear or alter reviewer assignment fields on an `under_review` Claim. It does not write decision, expiry, supersession, ownership, submitted-content, evidence, snapshot, prior-Claim, or resulting-ownership fields. It inserts no success audit and no notification.

The Claim update, event insert, and fenced idempotency completion must roll back together. The previously committed Phase-A reservation must not roll back with Phase B. Prohibited partial states include a withdrawn Claim without its event, an event without the withdrawn version, a completed result without the transition/event, a Claim transition with a still-processing key, or any duplicate version/event on replay.

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
| `retry_later` | Retryable/backoff disposition requires same-key retry later |
| `reconciliation_required` | Phase A durably terminalized the configured attempt limit; bounded operational reconciliation is required and the command does not re-execute |
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

All tests use disposable local PostgreSQL and synthetic identities, Suppliers, Claims, keys, and events. No Docker run is authorized by this documentation task; this matrix is for the later SQL slice. Lifecycle evidence must use genuinely separate sessions and transaction commits. Directly inserting or editing `processing` rows may be used only for isolated corruption tests, never to claim Phase-A visibility, reclaim, attempt, fencing, concurrency, or rollback coverage.

### 13.1 Success, state, and projection

| ID | Scenario | Required proof |
|---|---|---|
| WD-S01 | Exact claimant withdraws `submitted` Claim with current version before expiry | One `withdrawn` transition, version +1, exact claimant/time/reason/update fields, one event, completed original result, no audit/notification |
| WD-S02 | Exact claimant withdraws `under_review` Claim with current version before expiry | Same success; every assignment field remains byte-for-byte unchanged; no decision/ownership write |
| WD-S03 | Success response schema | Exact fields/types only; forbidden-value scan passes; fence and internal IDs are absent |
| WD-S04 | Existing claimant projection after withdrawal | Same claimant sees withdrawn status/result/time/version; another claimant sees zero rows; hidden withdrawal/assignment/internal fields remain unavailable |

### 13.2 Real two-phase idempotency and replay

| ID | Scenario | Required proof |
|---|---|---|
| WD-I01 | Phase A reserves in transaction/session A and commits before Phase B | Independent session B observes durable `processing`; no Claim/event/completed result exists yet; raw fence is absent from storage |
| WD-I02 | Independent session retries same request while WD-I01 lease is live | Immediate bounded `command_in_progress`, not blocking on an uncommitted row and not entering domain execution |
| WD-I03 | Lease expires, then a new Phase-A transaction reclaims | Attempt increments durably, fence changes, old fence is rejected, new fence alone may enter Phase B |
| WD-I04 | Phase B commits but response is lost; same key/actor/target/fingerprint retries | Exact original safe result with `idempotent_replay = true`; original `withdrawn_at`, version, event correlation, Claim/event counts, and result binding are unchanged |
| WD-I05 | Same key changes claimant, Claim target, expected version/fingerprint, command/version, policy, or environment | `idempotency_key_conflict`; no prior binding/result disclosure, domain write, or event; only required minimized conflict audit |
| WD-I06 | Only correlation ID changes on exact retry | No key conflict; completed retry returns original result and leaves original event correlation unchanged |
| WD-I07 | Completed row is independently corrupted at each binding seam | Wrong result Claim/version/time/status, wrong principal/target/fingerprint, missing/duplicate/wrong producer event, or inconsistent event fields returns `integrity_reconciliation_required`; never re-executes |
| WD-I08 | Every attempt through the configured cap is created/reclaimed by real separate Phase-A transactions | Attempt count/fence changes are durable; the terminal boundary becomes stable failed/terminal reconciliation, clears lease, and does not increment or return `retry_later` forever |
| WD-I09 | Phase A crashes before commit versus after commit | Before commit leaves no row; after commit is visible in another session and follows live-lease then reclaim behavior |

### 13.3 Actor, context, state, and expiry negatives

| ID | Scenario | Required proof |
|---|---|---|
| WD-A01 | Missing, malformed, expired, wrong-purpose, wrong-environment, or wrong-policy claimant/HMAC context | Phase A fails closed before reservation; no principal, Claim mutation, event, or leaked setting detail |
| WD-A02 | Context principal profile/link inactive, ambiguous, unverified, or non-Supplier context | Fail closed under the principal lock; no mirror/provider detail disclosure or completed result |
| WD-A03 | Different claimant targets a real Claim | Same `claim_not_found` status/body/timing shape as unknown UUID; no Claim/event/success audit; any committed Phase-A reservation remains protocol-only |
| WD-A04 | Admin/Owner/reviewer/controller/service role targets Claim without being exact claimant | Same denial; role never supplies claimant authority |
| WD-V01 | Stale expected version on an active Claim | `claim_version_conflict`; no transition/event/completion; expected race, not integrity corruption |
| WD-T01 | Current-version `approved` Claim | `claim_not_actionable`; no reopen |
| WD-T02 | Current-version `rejected` Claim | `claim_not_actionable`; no reopen |
| WD-T03 | Current-version `withdrawn` Claim under a different key | `claim_not_actionable`; no no-op completion, duplicate event, or version |
| WD-T04 | Current-version `expired` Claim | `claim_not_actionable`; no rewrite |
| WD-T05 | Current-version `superseded` Claim | `claim_not_actionable`; no rewrite |
| WD-E01 | Active Claim at `command_now = expires_at` | `claim_expired`; remains active for expiry worker; no withdrawal completion and no withdrawn/expired event from withdraw |
| WD-E02 | Active Claim after `expires_at` | Same deterministic due result |
| WD-E03 | Active Claim immediately before `expires_at` | May withdraw only if the single post-lock `command_now` remains strictly earlier |
| WD-E04 | Session timezone/DST presentation differs | Boundary follows stored `timestamptz` and exact 720-hour Claim instant only |

### 13.4 True concurrency

| ID | Scenario | Required proof |
|---|---|---|
| WD-C01 | Two sessions run identical same-key withdrawals | One durable reservation/execution; other returns live in-progress or later exact completed replay; one version/event |
| WD-C02 | Two sessions use different keys for the same Claim/version | Shared domain locks serialize; one commit, loser stable version/actionability result; both reservations are coherent; one Claim version/event and no integrity misclassification |
| WD-C03 | Withdraw races reviewer assignment, withdraw locks first | Claim withdrawn; no assignment/audit/event from assignment |
| WD-C04 | Withdraw races reviewer assignment, assignment locks first | Assignment commits; stale withdrawal conflicts; refreshed new logical withdrawal can close `under_review` and retains assignment fields |
| WD-C05 | Withdraw races approval | At most one terminal transition; approval-first may create ownership/supersessions, withdrawal-first prevents every approval side effect |
| WD-C06 | Withdraw races rejection | At most one terminal transition; no loser audit-success/event |
| WD-C07 | Withdraw races expiry before due | Valid first transition wins; expiry sees already terminal or withdrawal sees the current state |
| WD-C08 | Withdraw races expiry at/after due | Withdrawal cannot commit; expiry may terminalize; never both terminal events |
| WD-C09 | Withdraw races another ownership-creation path | Shared Supplier lock serializes; withdrawal never changes ownership and follows only locked Claim state/version/time |
| WD-C10 | Withdraw races claimant profile/link eligibility loss | Shared principal lock ensures the second committer observes the first result; no withdrawal using removed eligibility |

### 13.5 Rollback, security, and catalog

| ID | Scenario | Required proof |
|---|---|---|
| WD-R01 | Phase A commits, then forced `claim_withdrawn` event insertion failure in Phase B | Claim update, event, and idempotency completion roll back; Phase-A `processing` remains durable and later reclaimable |
| WD-R02 | Phase A commits, then forced fenced completion failure after Claim/event statements | Claim update and event roll back; reservation is not falsely completed and stale fence cannot later complete |
| WD-R03 | Reclaim after WD-R01/WD-R02, then successful Phase B | Exactly one final Claim version/event/completed original result; prior fence denied |
| WD-R04 | Force Claim update/constraint or unexpected database failure | Phase B rolls back; safe failure mapping; no normal race is relabeled integrity and no partial domain state exists |
| WD-R05 | Force required idempotency-conflict audit failure | Original request remains denied; safe `audit_unavailable`/`result_unavailable`; no Claim/event mutation |
| WD-G01 | Runtime/browser/API/generic `service_role` direct Claim `UPDATE` | SQLSTATE privilege denial; zero rows changed |
| WD-G02 | Runtime calls command adapter boundaries only | No direct access to Claim tables, `internal.idempotency_keys`, raw fence digest, or private helpers beyond exact reviewed grants |
| WD-G03 | Routine catalog/security posture | Dedicated definer owner, no superuser/`BYPASSRLS`/unsafe inheritance, fixed `pg_catalog` search path, qualified objects, no dynamic SQL, API/PUBLIC execute denied |
| WD-G04 | Shared lock helper grants and order | Existing principal/Supplier helpers remain non-callable to API roles; session race traces prove reservation then principal/Supplier/ownership/Claim order |
| WD-G05 | Event/result/error/telemetry sensitive scan | No raw key/HMAC/fence, token/provider subject, private Claim content, reviewer identity, audit payload, SQL/stack text, or unrelated IDs escape |

## 14. Reuse versus extraction

The later implementation should reuse the merged submit work selectively:

- **Reuse directly:** existing `claim_security.claim_principal_lock_key_v1` and `claim_security.claim_supplier_lock_key_v1` helpers, transaction-local principal resolution, fixed-schema/security posture, event-envelope columns, safe typed-result style, correlation treatment, and explicit grant/catalog testing.
- **Reuse as corrected convention evidence:** versioned length-delimited HMAC framing, canonical request projection, durable Phase-A reservation, opaque fence digest, attempt fencing, Phase-B reservation-first lock, immutable completed replay verification, and terminal reconciliation proven by PR #109. Re-derive each withdrawal binding; do not assume submit-specific fields or outcomes.
- **Implement bounded withdrawal-specific helpers:** a small canonicalizer (conceptually `_canonicalize_withdraw_request_v1`), a reservation boundary (conceptually `reserve_withdraw`), and a fenced withdrawal executor are appropriate. Exact private routine names/signatures remain for the SQL review. Only the approved logical command is public business behavior.
- **Do not inherit:** submit's Supplier creation-slot target, Claim creation rules, submitted reason/evidence validation, prior-Claim behavior, unowned-Supplier prohibition as a withdrawal precondition, submit result shape, superuser-owner limitation, or submit-specific business errors.
- **Do not call submit or build a generic command framework:** withdrawal owns different authorization, target, state, time, write, replay-binding, and error checks. Copying the corrected control-flow shape is safer than prematurely forcing both commands through an unproven generic abstraction.
- **Defer extraction:** after withdrawal and another command prove truly identical low-level pieces, a separate narrow refactor may extract them while preserving digests, replay compatibility, fences, SQLSTATEs, privileges, and multi-session tests. It must not be bundled into the first withdrawal SQL PR merely to remove duplication.

This is the smallest safe implementation shape: reuse existing lock helpers and the corrected protocol conventions, keep withdrawal-specific canonicalization/reservation/execution bounded, and collect evidence before any shared framework refactor.

## 15. Owner decisions, prerequisites, and exact stop point

No approved CLAIM-CMD-001 choice is reopened. This review resolves for withdrawal:

- both `submitted` and `under_review` are withdrawable;
- all five terminal states remain immutable;
- the exact current claimant is the only actor;
- expected Claim version is mandatory;
- the due boundary returns `claim_expired` and does not expire inline;
- the server-owned reason/policy identifiers are `claimant_withdrawal` / `claim_withdrawal_v1`;
- successful withdrawal has no AUD-001 row, while post-auth idempotency-binding conflict has only the minimized required conflict audit;
- one minimized `claim_withdrawn` event is mandatory;
- no Claim-v1 notification exists;
- direct Claim `UPDATE` remains denied; and
- the existing claimant projection remains sufficient after withdrawal.

PR #108's three blockers are closed by the PR #109 corrective merge and evidence. Withdrawal is therefore implementation-ready from the local idempotency/locking perspective, subject to this synchronized contract and normal review of its later SQL/test PR. This finding does not establish gateway, hosted, migration, or Production readiness.

There is no unresolved withdrawal product-state, actor, notification, audit-success, event, or RLS decision. The genuinely unresolved delivery/operations decisions are outside this local contract:

1. final hosted lease length, backoff, attempt cap, retention, alert ownership, and terminal-reconciliation runbook—the submit hotfix's local 60-second/10-attempt values are provisional evidence only; and
2. gateway/pool isolation, dedicated non-superuser command ownership, HMAC custody/rotation, environment configuration, and hosted activation under their separate security/operations gates.

Exact SQL/pgTAP belongs in a separate implementation PR using this contract. Hosted Supabase, migration/cutover, Firebase/Production authority, and deployment remain unauthorized.

Exact stop point for this task: update this one Markdown file, validate a documentation-only diff and links, commit and push `codex/claim-withdraw-readiness`, update existing Draft PR #107, keep it Draft, and stop. Do not implement SQL, run Docker, update shared Baseline/Register/Schema Design documents, access Firebase or hosted Supabase, inspect or change Production/TEST data, mark Ready, merge, migrate, or deploy.

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
- [`49_PR_103_CLAIM_SUBMIT_POST_MERGE_SECURITY_RED_TEAM_REVIEW.md`](49_PR_103_CLAIM_SUBMIT_POST_MERGE_SECURITY_RED_TEAM_REVIEW.md)
- [`51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md`](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md)
- [`52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md`](52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md)
- [`53_CLAIM_SUBMIT_IDEMPOTENCY_HOTFIX_EVIDENCE.md`](53_CLAIM_SUBMIT_IDEMPOTENCY_HOTFIX_EVIDENCE.md)
- [`../../supabase/migrations/20260809000100_rel_001_reliability_foundation.sql`](../../supabase/migrations/20260809000100_rel_001_reliability_foundation.sql)
- [`../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql`](../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql)
- [`../../supabase/migrations/20260809000400_claim_rls_self_read_foundation.sql`](../../supabase/migrations/20260809000400_claim_rls_self_read_foundation.sql)
- [`../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql`](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql)
- [`../../supabase/migrations/20260810000100_claim_submit_idempotency_hotfix.sql`](../../supabase/migrations/20260810000100_claim_submit_idempotency_hotfix.sql)
