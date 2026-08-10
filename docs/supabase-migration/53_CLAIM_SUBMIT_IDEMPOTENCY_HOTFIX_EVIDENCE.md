# Claim submit idempotency corrective hotfix evidence

Status: **Local-only corrective implementation for PR #108 findings M-1, M-2, and M-3; no other Claim command, gateway, hosted capability, real data, Production activation, notification, ownership, review, or decision runtime**

Date: 2026-08-10

Starting `origin/main`: `b567caa4b33cff9424d7a0df4d3ff96be77a8943`, the merge of PR #108

Primary task profile: Testing and CI

## 1. Result and exact boundary

One new tracked corrective migration replaces the local one-transaction submit protocol with the approved REL-001 short durable reservation phase plus a fenced domain-execution phase. It corrects exactly the three blocking Medium findings from [PR #108's red-team review](49_PR_103_CLAIM_SUBMIT_POST_MERGE_SECURITY_RED_TEAM_REVIEW.md):

1. completed replay now proves the complete immutable idempotency/Claim/event binding and returns the original submitted/version-1 result;
2. the normal same-claimant/Supplier different-key race returns `P5106 / active_claim_exists`; and
3. a processing reservation commits before domain execution, remains visible across sessions, survives domain rollback, supports durable reclaim/fencing, and becomes a stable failed-terminal reconciliation state after expired attempt 10.

No merged migration was rewritten. No table, Claim command, mutation RLS policy, audit row, notification, ownership, reviewer, decision, expiry, withdrawal, Firebase gateway, hosted Supabase capability, real row, seed, backfill, remote migration, or deployment was introduced.

## 2. Root causes proven before correction

### M-1 — mutable and insufficient replay binding

The merged completed path checked only a bounded idempotency result shape plus Claim claimant/Supplier equality, then returned the Claim's current mutable status/version. It did not bind the Claim submission fingerprint or the exact ordinal-1 producer event to the idempotency request. A privileged corruption could therefore redirect the result UUID to a later same-pair Claim, and a later lifecycle transition changed the replay envelope.

### M-2 — swallowed `40P01`, not a business conflict

The unchanged PR #103 function was reproduced in two real sessions before implementation. Two different valid keys for the same claimant/Supplier produced one success, one `P5199`, and retained Claim/event/idempotency counts `1/1/1`.

An in-memory-only disposable diagnostic replaced the catch-all with restricted stacked diagnostics. The swallowed original result was exactly:

- SQLSTATE: `40P01` (`deadlock_detected`);
- schema: none;
- table: none;
- constraint: none.

The cycle came from the one-transaction design: each call inserted a different idempotency row first, so both retained a foreign-key key-share lock on the same claimant profile. One call then held the Claim principal advisory lock and waited to lock the profile `FOR UPDATE`; the other retained its key-share lock while waiting for that advisory lock. The generic handler converted the deadlock to `P5199`.

Committing Phase 1 releases those foreign-key locks before either Phase-2 call takes Claim locks. In the corrected true race, both Phase-2 statements were started behind the shared advisory-lock barrier; the loser completed its post-lock active-pair re-read and returned `P5106`. As a storage-level fallback, the executor maps a unique violation only when PostgreSQL reports the exact `public.supplier_ownership_claims.supplier_ownership_claims_one_active_pair_uidx` identity; every unrelated unique violation remains `P5199`.

### M-3 — reservation and domain work shared one transaction

The merged function created, reclaimed, executed, and completed the idempotency row inside one SQL statement/transaction. Other sessions could not durably observe processing; domain failure erased the reservation; attempt increments were not durable; and an expired seeded attempt-10 row stayed processing while returning `retry_later` indefinitely.

The existing `internal.idempotency_keys` constraints already represent the approved `failed` plus `retry_disposition = terminal` state, so no schema-contract mismatch or new status/table was required.

## 3. Corrective protocol and routines

### 3.1 Private canonicalization helper

`supplier_claim._canonicalize_submit_request_v1(text, uuid, text, text, jsonb, uuid)` is a fixed-path `SECURITY INVOKER` implementation helper. It preserves PR #103's exact input normalization, evidence allowlist, HMAC namespace, request fingerprint, and claimant/Supplier slot derivation.

It is not executable by `PUBLIC`, `anon`, `authenticated`, `service_role`, or `mujahiz_claim_runtime`. Only the two definer boundaries call it. It returns no HMAC key, raw idempotency key, request body, provider identity, or execution fence.

### 3.2 Phase 1 — `supplier_claim.reserve_submit`

`supplier_claim.reserve_submit(text, uuid, text, text, jsonb, uuid)` is the minimum runtime-only reservation/replay/reclaim boundary. It:

- derives the exact claimant only through `claim_security.current_claim_user_profile_id()`;
- requires the existing transaction-local HMAC context;
- accepts only the idempotency key and submit-v1 semantic fingerprint inputs;
- creates and returns a new durable processing reservation with attempt 1;
- returns `P5109 / command_in_progress` for an unexpired matching reservation without waiting on the domain transaction;
- returns `P5108 / idempotency_key_conflict` for any actor/slot/fingerprint/version mismatch;
- reclaims an expired matching processing or due retryable-failed row with a new fence and incremented attempt;
- returns the immutable original successful submit result for a completed matching request; and
- changes an expired attempt-10 processing/retryable row to durable `failed / terminal / attempt_limit_exceeded`, clears the lease, and returns the bounded `reconciliation_required` state. Later calls return the same stable state without incrementing or returning `retry_later` forever.

PostgreSQL generates a random opaque `execution_fence` UUID for the trusted runtime. Only its HMAC-SHA-256 digest is stored. The raw fence is an internal transaction-A-to-transaction-B capability: it is never a browser/API value, raw idempotency key/digest, HMAC secret, database row value, log field, event field, or business response.

### 3.3 Completed replay binding

A completed replay fails `P5199 / integrity_reconciliation_required` unless all of these remain mutually consistent:

- exact command/version/environment, principal, deterministic submit slot, digest versions, and current canonical request fingerprint;
- completed `submitted` outcome, `supplier_ownership_claim` result type, non-null Claim UUID, and result-version token `1`;
- referenced Claim existence, exact claimant and Supplier, `claim_submit_v1` submission-fingerprint version, and exact stored idempotency fingerprint hex;
- original `submitted_at`, exact `expires_at = submitted_at + 720 hours`, original `created_at`, idempotency `completed_at`, and replay expiry coherence;
- exactly one event for the producer idempotency row and exactly one `claim_submitted` event for the aggregate;
- event type/schema, aggregate type/ID/sequence, producer command/version/ordinal, actor, environment, source/component, timestamps, historical/fan-out flags, and null source/causation fields; and
- the exact minimized payload containing only Claim UUID, Supplier UUID, claimant UUID, and Claim version 1.

The replay envelope always returns original status `submitted`, version `1`, original submitted/expiry timestamps, and `idempotent_replay = true`. Current mutable Claim status/version remain available only through the independently authorized claimant self-read projection.

### 3.4 Phase 2 — `supplier_claim.submit`

The old seven-argument one-transaction routine is removed. The replacement is:

`supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid, uuid)`

The appended UUID is the opaque Phase-1 execution fence. Phase 2:

1. re-derives the claimant, key digest, request fingerprint, normalized input, and deterministic slot from the same principal/HMAC/request;
2. locks the exact durable idempotency row first;
3. verifies current processing status, unexpired lease, digest-key version, exact fence digest, and captures the current attempt;
4. denies missing reservations, expired leases, completed rows, stale/reclaimed fences, key conflicts, and terminal reconciliation rows with bounded existing errors;
5. applies the existing principal/Supplier/identity/eligibility/ownership/active-pair/prior-Claim lock and validation protocol;
6. inserts the immutable version-1 Claim and exact ordinal-1 event; and
7. completes only the same attempt and fence in the same transaction as the Claim/event.

If Claim, event, or completion fails, the domain transaction rolls back while the previously committed Phase-1 processing reservation remains available for the approved expiry/reclaim lifecycle.

## 4. Same-pair conflict correction

The replacement exception handler retrieves PostgreSQL `schema_name`, `table_name`, and `constraint_name`. It returns `P5106 / active_claim_exists` only when all three equal:

- schema `public`;
- table `supplier_ownership_claims`; and
- index `supplier_ownership_claims_one_active_pair_uidx`.

No other `23505`, deadlock, serialization, FK, event, idempotency, or unexpected database failure is converted to the business error. Those remain fail-closed under the existing stable integrity mapping.

## 5. Exact privilege result and SECURITY DEFINER review

The migration contains exactly two positive grants:

1. `EXECUTE` on `supplier_claim.reserve_submit(text, uuid, text, text, jsonb, uuid)` to `mujahiz_claim_runtime`;
2. `EXECUTE` on `supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid, uuid)` to `mujahiz_claim_runtime`.

The pre-existing `USAGE` on schema `supplier_claim` remains unchanged. Dropping the old function removes its old execute grant. The canonicalizer has no runtime execute grant. `PUBLIC`, `anon`, `authenticated`, and `service_role` have no schema/routine authority. `mujahiz_claim_runtime` retains no direct Claim/ownership/identity/idempotency/event/audit table mutation or internal-table read authority.

Both definer routines received the same independent checks:

- explicit owner `postgres`;
- fixed `search_path = pg_catalog`;
- schema-qualified relations and non-built-in functions;
- no dynamic SQL or caller-selected object identifier;
- no nested definer call; the shared canonicalizer is `SECURITY INVOKER` and not runtime-callable;
- no attacker-writable schema lookup;
- no broad table grant;
- no mutation RLS policy; and
- exact runtime-only execute grants.

The `postgres` superuser owner remains local-only evidence and is not hosted/activation-ready. The dedicated non-superuser command-owner conversion remains a gateway/hosted release gate from document 52 and is not broadened into this corrective hotfix.

## 6. HMAC and idempotency review

- Raw caller idempotency keys remain format-bounded and are never stored.
- Key, request, and execution-fence digests remain HMAC-SHA-256 with distinct domain prefixes.
- Missing, short, long, empty, or control-character HMAC context fails closed.
- The HMAC secret is not returned or stored in Claim, idempotency, event, audit, or test result data.
- Phase 1 and Phase 2 independently re-derive the same key/request binding under the same trusted context.
- The raw execution fence is returned only to the dedicated trusted runtime, never stored, and becomes unusable after completion, expiry/reclaim, or terminalization.
- Completion matches both current attempt count and current fence digest.
- Same key/different canonical request remains `P5108` without revealing the prior actor, fingerprint, or result.

Single-key `local_v1` rotation and proof that HMAC/fence context is transaction-local on the selected real pool remain future gateway release gates. No gateway, key rotation, secret storage, or pool integration is implemented here.

## 7. Focused and complete validation

### 7.1 Focused pgTAP

The new `claim_submit_idempotency_hotfix.sql` test passed **67/67** assertions. It proves:

- exact routine signatures, owners, fixed paths, grants, table/policy counts, and no dynamic SQL;
- missing principal/HMAC denial;
- durable Phase-1 processing reservation and non-persistence of the raw fence;
- wrong-fence denial and atomic Phase-2 success;
- claimant self-read and cross-claimant denial;
- immutable initial and later-state completed replay;
- wrong same-pair result UUID, fingerprint mismatch, missing event, mismatched event, and contradictory duplicate producer event all return `P5199`;
- committed unexpired visibility, deterministic lease aging, reclaim attempt increment, and stale-fence denial;
- event-failure rollback with the Phase-1 reservation retained;
- transaction-context cleanup, HMAC non-leakage, no audit row, managed-role restoration, and complete synthetic cleanup.

### 7.2 Real multi-session harness

`scripts/test-claim-submit-hotfix-concurrency.ps1` uses only PowerShell, Docker, and the image's existing `psql`; it adds no dependency and modifies no validator. It passed **34/34** checks in **26.6 seconds**:

- same claimant + same Supplier + different keys: one success, loser `P5106`, one Claim, one submit event, and both durable reservations;
- different claimants + same eligible Supplier: both succeed with two claimant-distinct Claims/events;
- a committed Phase-1 lease is visible from another runtime session and returns immediate bounded `P5109`;
- expired reclaim changes the opaque fence and durably increments attempt count;
- stale Phase-2 execution after reclaim cannot commit;
- current reclaimed execution succeeds;
- injected event failure rolls back Claim/event but leaves the committed processing reservation;
- later reclaim/retry succeeds with no duplicate Claim/event;
- completed replay returns the immutable original result;
- same key/different request returns `P5108`;
- attempts 1 through 10 are created by real separate reservation transactions, not manufactured processing rows; and
- expired attempt 10 becomes stable `failed / terminal / attempt_limit_exceeded` and never returns `retry_later` forever.

Lease expiry is advanced deterministically by privileged synthetic test updates after each real committed reservation; no production/test hook or caller-selected clock was added.

### 7.3 Complete repository SQL validator

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-local-supabase-sql.ps1
```

Result: **passed** — 19 migrations applied; 19 pgTAP files; **1,248/1,248 assertions passed**, 0 failed; 47.3 seconds.

### 7.4 Exact structural result

- Tracked migrations: **19**.
- pgTAP files: **19**.
- Physical PostgreSQL tables: **22**, unchanged.
- Core Phase 1 concepts: **20 implemented / 16 deferred**, unchanged.
- Claim RLS policies: **1**, the existing claimant self-select policy.
- Mutation RLS policies: **0**.
- Hotfix routines: **3** total — one private invoker canonicalizer, one phase-1 definer reservation helper, and one changed phase-2 definer submit executor.
- Positive grants in the corrective migration: **2**, both exact runtime execute grants.
- Ordinary submit audit rows: **0**.
- Ordinary submit notifications: **0**.
- Sensitive credential/key/token pattern scan: **0 matches**.
- Disposable validation/diagnostic containers remaining: **0** after each completed run.

## 8. Future trusted gateway wrapper requirement

There is still no real gateway. A future reviewed wrapper must implement one logical `supplier_claim.submit` command with two explicit database transactions and keep the opaque execution fence internal:

**Transaction A — reserve/replay/reclaim**

1. validate current Firebase token/user and exact provider-neutral identity under SEC-001;
2. begin a database transaction as the dedicated Claim runtime role;
3. establish the trusted principal and transaction-local HMAC context;
4. call `supplier_claim.reserve_submit` with the exact semantic request;
5. commit;
6. if the result is replay or reconciliation-required, return/map only the safe bounded result; otherwise retain the opaque execution fence in trusted process memory only.

**Transaction B — fenced domain execution**

1. begin a new database transaction, which may use a different pooled backend;
2. revalidate/re-establish the same trusted principal, environment/purpose/policy, and HMAC context;
3. call the eight-argument `supplier_claim.submit` with the exact same semantic request plus the Phase-1 fence;
4. commit on success or roll back on failure; and
5. never log, persist, expose to a client, or reuse the fence after completion/reclaim.

The wrapper must not receive direct table access to `internal.idempotency_keys`, use `service_role`, accept a caller-selected principal/HMAC/fence, or hide transaction/pool cleanup uncertainty.

## 9. Production impact, residual risks, and exact stop point

Production impact is **none**. All migration/test execution used disposable local PostgreSQL and synthetic rows. No Firebase service, hosted Supabase project, real user/Claim, Production/controlled-TEST data, secret, DNS, billing, configuration, remote migration, seed, backfill, deployment, merge, or feature activation was accessed or changed.

Residual risks deliberately retained outside this hotfix are:

- no real Firebase gateway or selected driver/pool/pooler exists;
- current signed-token observation, bounded cross-system command window, transaction cleanup, HMAC/fence custody, zero logging, key rotation, and pool destruction-on-uncertainty remain release gates;
- the local definer owner is still `postgres`, not the required future dedicated non-superuser owner;
- the 60-second lease and 10-attempt limit are implemented for local protocol proof but still require final Technical/Security/Operations runtime approval and observability/alert ownership before activation;
- PR #108 low findings L-2 and L-3 remain unchanged: evidence URLs are inert syntactic descriptors, and current Unicode/order/URL canonicalization semantics must be settled before client activation; and
- no other Claim mutation may copy this protocol until this hotfix is reviewed and merged.

Exact stop point: corrective migration, focused pgTAP, real-session concurrency harness, evidence, commit/push, and one Draft PR only. Stop before Ready status, merge, another Claim command, gateway/Firebase integration, hosted Supabase, real data, remote migration, deployment, notification, reviewer, decision, ownership, withdrawal, or expiry runtime.
