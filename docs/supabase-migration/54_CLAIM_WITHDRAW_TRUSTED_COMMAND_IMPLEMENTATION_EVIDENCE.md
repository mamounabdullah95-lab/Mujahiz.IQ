# Claim withdraw trusted command implementation evidence

Status: **Local-only implementation of exactly `supplier_claim.withdraw`; no other Claim command, gateway, hosted capability, Production activation, real data, notification, or deployment**

Date: 2026-08-10

Starting `origin/main`: `022f086be4f2c9ddcc73a0cae6c44838ccba051b`

PR #110 reviewed head before completed-binding correction: `6ede1cf2ff7173ab763a579af73d657f47e3846b`

Primary task profile: Supplier domain

## 1. Result and exact boundary

The approved withdrawal contract in `50_CLAIM_WITHDRAW_IMPLEMENTATION_READINESS.md` was implementable without redesign. This slice adds exactly one logical Claim business mutation, `supplier_claim.withdraw`, using the corrected two-phase REL-001 protocol established for submit.

The implementation adds one migration, one focused pgTAP file, one real multi-session harness, and this evidence note. It adds no table, other Claim command, mutation RLS policy, notification, hosted Supabase capability, Firebase integration, real row, seed, backfill, remote migration, or deployment. Shared Baseline, Register, and Schema Design documents are unchanged.

Direct review of the first PR #110 head found one contract-level ordering defect: Phase A compared the current caller fingerprint with the stored row before branching on `status = 'completed'`. A privileged corruption of an otherwise completed stored fingerprint was therefore classified as an ordinary caller conflict and attempted a conflict audit. The corrected implementation proves a completed row's stored authoritative fact first, returns reconciliation-required for corruption without an audit, and only then compares a coherent original binding with the current request.

## 2. Routines and two-phase protocol

### 2.1 Private canonicalizer

`supplier_claim._canonicalize_withdraw_request_v1(text, uuid, integer)` is a fixed-path `SECURITY INVOKER` helper. It derives the claimant only through `claim_security.current_claim_user_profile_id()`, requires the transaction-local HMAC context, validates the key/Claim/version inputs, and builds the versioned semantic fingerprint from:

- Claim UUID;
- expected Claim version;
- `claim_withdraw_preconditions_v1`; and
- `claim_withdrawal_v1`.

Correlation is excluded as observability-only metadata. The helper is not executable by the runtime or API roles and returns no raw key or HMAC secret.

### 2.2 Phase A - `supplier_claim.reserve_withdraw`

`supplier_claim.reserve_withdraw(text, uuid, integer)` is the exact runtime-only durable reservation/replay/reclaim boundary. A trusted gateway must call it in its own transaction and commit before Phase B.

It provides:

- new matching request: durable `processing`, attempt 1, and opaque execution fence;
- completed matching request: immutable original withdrawal replay;
- same key with different actor/target/fingerprint/version binding: deterministic `idempotency_key_conflict` result plus one minimized durable AUD-001 conflict row;
- matching unexpired lease: bounded `P5109 / command_in_progress`;
- matching expired lease: durable reclaim, incremented attempt, and a new fence;
- expired attempt 10: durable `failed / terminal / attempt_limit_exceeded` plus stable `reconciliation_required` on later calls; and
- corrupt completed result, fingerprint, Claim, or event binding: `P5199 / integrity_reconciliation_required`, never re-execution.

For a completed row, Phase A now uses this decision order:

1. validate the stored command/environment/principal/target/digest/result/lifecycle shape independently;
2. derive the original expected source version as stored result version minus one;
3. reconstruct the original semantic request from the stored target and derived source version, then recompute its HMAC fingerprint;
4. require the stored fingerprint, referenced withdrawn Claim, actor/provenance/timestamps, and exact single producer/aggregate event to match that authoritative result;
5. return `P5199` immediately for any corruption, with no conflict audit or inline repair;
6. only after self-integrity passes, compare the current principal/target/fingerprint with the proven original binding; and
7. emit the minimized conflict audit and safe `idempotency_key_conflict` result only for genuine current-request key reuse, otherwise replay the immutable result.

PostgreSQL generates the raw execution-fence UUID, while the idempotency row stores only its HMAC-SHA-256 digest. The 60-second lease, 10-attempt cap, and 720-hour replay retention are explicitly labeled provisional local protocol parameters, not final hosted operations policy.

### 2.3 Phase B - `supplier_claim.withdraw`

`supplier_claim.withdraw(text, uuid, integer, uuid, uuid)` accepts the same semantic request, optional correlation UUID, and Phase-A fence in a new trusted transaction. It:

1. re-derives the exact claimant, key digest, and request fingerprint from fresh trusted context/HMAC state;
2. locks and verifies the exact durable idempotency row, attempt, lease, and fence;
3. treats pre-lock Claim reads only as routing hints;
4. takes deterministic claimant and Supplier advisory locks;
5. locks and re-reads claimant profiles, provider links, Supplier, ownership rows, and Claim in the approved order;
6. revalidates active supplier claimant eligibility and exactly one usable primary Firebase relation;
7. verifies Claim claimant/Supplier coherence, expected version, actionable state, and one post-lock trusted timestamp;
8. updates the Claim, inserts one minimized event, and completes the exact idempotency attempt atomically; and
9. rolls back all Phase-B effects on any failure while leaving the committed Phase-A reservation available for approved reclaim/retry.

Both Phase-A and Phase-B definers have owner `postgres`, fixed `pg_catalog` search paths, schema-qualified object references, no dynamic SQL, and exact runtime-only EXECUTE grants. Local `postgres` ownership is evidence only; dedicated non-superuser hosted ownership remains a release gate.

## 3. Lifecycle behavior

The allowed transitions are exactly:

- `submitted -> withdrawn`; and
- `under_review -> withdrawn`.

Success uses one trusted database instant for `withdrawn_at` and `updated_at`, derives `withdrawn_by_user_profile_id` from current trusted context, uses code-owned reason `claimant_withdrawal`, and increments `record_version` exactly once. An under-review withdrawal retains all existing reviewer-assignment provenance.

`approved`, `rejected`, `withdrawn`, `expired`, and `superseded` return `P5113 / claim_not_actionable` and never reopen. A post-lock version mismatch returns `P5112 / claim_version_conflict`. A due active Claim returns `P5114 / claim_expired` without mutation; the separate deferred expiry command remains responsible for terminal expiry. Unknown and other-claimant Claims share `P5111 / claim_not_found`.

## 4. Immutable replay binding

A completed same-key/same-request replay returns the original Claim UUID, Supplier UUID, status `withdrawn`, resulting version, and original `withdrawn_at`. It fails closed unless all of the following remain coherent:

- command/version/environment, human principal, Claim target, digest versions, and current canonical fingerprint;
- completed outcome, resource type/UUID, resulting version token, and completion timestamp;
- referenced Claim claimant, Supplier, withdrawn state/version, trusted actor/reason/timestamps, and pre-expiry transition;
- exactly one event for the producer idempotency row and exactly one aggregate/version withdrawal event; and
- exact event type/schema, aggregate, sequence, producer, ordinal, actor, environment, component, timestamps, processing flags, and minimized payload.

Replay never derives a new envelope from a later mutable Claim state and never re-executes a corrupt completed result.

The original expected Claim version is not trusted from the current request during self-integrity verification. It is deterministically reconstructed as `result_version_token - 1`; the stored target plus that source version and the two approved policy-version constants reproduce the exact original canonical JSON and HMAC framing. A stored fingerprint mismatch is therefore completed-state corruption even when the caller repeats the original request. Once that stored fact passes, a changed current expected version or target is a genuine caller conflict.

## 5. Event, audit, notification, and read behavior

Each successful transition inserts exactly one `supplier_ownership.claim_withdrawn` event with schema version 1. Its payload contains only Claim UUID, Supplier UUID, claimant UUID, and resulting Claim version. It contains no evidence, provider identity, reviewer notes, raw idempotency material, or fence.

Ordinary success and replay create zero audit rows. Only a same-key binding conflict creates the approved minimized durable audit row, and audit unavailability fails closed. No notification table or write was added.

Focused fault injection proves that a genuine coherent-row conflict whose required `internal.audit_logs` insert fails returns `P5116 / audit_unavailable`, returns no false conflict result, creates no Claim version/event mutation, and persists no partial audit row. Completed binding corruption follows the separate reconciliation path and never attempts this conflict audit.

The existing claimant safe projection returns the withdrawn state to the exact claimant and remains invisible to another claimant. The existing single claimant self-select RLS policy remains read-only. No Claim UPDATE policy exists, and the runtime still cannot directly update the Claim table.

## 6. Real race and rollback results

The new harness uses real separate PostgreSQL sessions and real committed Phase-A calls. It does not manufacture processing rows as reservation proof.

- Two different keys withdrawing the same Claim/version behind a shared principal-lock barrier produce exactly one commit and one deterministic `P5112`, with one resulting version increment and one event.
- Another session sees a committed unexpired lease promptly as `P5109`.
- Expired reclaim increments the durable attempt and rotates the fence; the stale fence is denied and the current fence succeeds.
- Injected event failure returns `P5199`, leaves the Claim at version 1, creates no event/completion, and preserves the Phase-A reservation. Reclaim/retry then succeeds once, and replay creates no duplicate.
- Real reservation transactions create attempts 1 through 10. Expired attempt 10 becomes stable failed-terminal reconciliation state.
- A simulated future reviewer writer using the shared lock order commits version 2 first; the waiting withdrawal receives `P5112`. A new expected-version-2 withdrawal succeeds and retains reviewer assignment provenance.
- A simulated future expiry writer using the shared lock order commits expiry first; the waiting withdrawal receives `P5112` and creates no withdrawal event.
- A due Claim without an expiry writer returns `P5114` and remains submitted for the future expiry command.
- Concurrent claimant verification loss under the principal lock causes the waiting withdrawal to fail `P5103 / claimant_ineligible` with no Claim mutation.

Future approve and reject commands must use the same versioned Claim lock boundary; their terminal results are already fail-closed by the post-lock actionable-state check. Those deferred commands were not implemented here.

## 7. Validation evidence

### 7.1 Focused pgTAP

The focused disposable run applied all migrations and then ran only `claim_withdraw_trusted_command.sql`.

Result: **101/101 assertions passed**, 0 failed; 15.8 seconds.

Coverage includes routine catalog shape, grants, definer safety, both success states, retained assignment provenance, exact actor/timestamps/version/event, self-read visibility, no ordinary audit/notification, missing/wrong/unknown authorization, API/direct-update denial, version/due/terminal behavior, durable reclaim/fencing, event and completion rollback, genuine changed-version and changed-target conflict audits, audit fail-closed injection, completed fingerprint/result-target/result-version/missing-event/mismatched-event/duplicate-event corruption, sensitive persistence, and cleanup.

### 7.2 Real multi-session withdrawal harness

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-claim-withdraw-concurrency.ps1
```

Result: **41/41 checks passed**; 31.8 seconds.

### 7.3 Submit concurrency regression

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-claim-submit-hotfix-concurrency.ps1
```

Result: **34/34 checks passed**; 24.1 seconds.

### 7.4 Complete repository SQL validator

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-local-supabase-sql.ps1
```

Result: **passed** - 20 migrations applied; 20 pgTAP files; **1,349/1,349 assertions passed**, 0 failed; 51.0 seconds.

### 7.5 Exact structural and security result

- Tracked migrations: **20**.
- pgTAP files: **20**.
- Physical PostgreSQL tables: **22**, unchanged.
- Core Phase 1 concepts: **20 implemented / 16 deferred**, unchanged.
- Claim RLS policies: **1**, the existing claimant self-select policy.
- Mutation RLS policies: **0**.
- Withdraw implementation routines: **3** - one private invoker canonicalizer, one Phase-A definer, and one Phase-B definer.
- Positive grants in the migration: **2**, both exact EXECUTE grants to `mujahiz_claim_runtime`.
- Runtime direct protected-table mutation grants: **0**.
- Ordinary withdrawal audit rows: **0**.
- Withdrawal notifications: **0**.
- Persisted raw HMAC-secret matches across Claim/idempotency/event/audit test rows: **0**.
- Sensitive-pattern scan: only the fixed disposable `POSTGRES_PASSWORD=postgres` bootstrap and assertion text; no real credential, token, key, or Production value.
- `git diff --check`: **passed**.
- Disposable validation containers remaining after completed runs: **0**.

## 8. Production impact, residual risks, and stop point

Production impact is **none**. Every migration/test execution used disposable local PostgreSQL and synthetic rows. No Firebase service, hosted Supabase project, real user/Claim, Production or controlled-TEST data, secret, DNS, billing, configuration, remote migration, seed, backfill, deployment, merge, or feature activation was accessed or changed.

Residual release gates remain:

- no reviewed Firebase gateway, signed-token staging proof, selected driver/pool/pooler, or hosted transaction-boundary proof exists;
- HMAC/fence custody, rotation, zero logging, bounded cross-system retry behavior, alert ownership, and pool cleanup remain unproven outside local disposable PostgreSQL;
- the definer owner is local `postgres`, not a dedicated non-superuser command owner;
- the 60-second lease, 10-attempt cap, and 720-hour replay retention require final Technical/Security/Operations approval before activation; and
- `assign_reviewer`, `approve`, `reject`, `expire`, and supersession remain deferred and unimplemented.

Exact stop point: local `supplier_claim.withdraw` migration, focused pgTAP, multi-session harness, evidence, commit/push, and one Draft PR only. Stop before Ready status, merge, any other Claim command, gateway/Firebase integration, hosted Supabase, real data, remote migration, deployment, notification, reviewer, decision, approval, rejection, supersession, or expiry runtime.
