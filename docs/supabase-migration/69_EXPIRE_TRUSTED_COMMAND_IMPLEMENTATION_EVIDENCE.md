# supplier_claim.expire v1 - Implementation Evidence

Date: 2026-08-15
Branch: `codex/expire-trusted-command-implementation`
Base: `7bdf29b1fbdce6d2d9a4a7bd9d6d547a1d675bab`
Scope: local PostgreSQL and synthetic data only
Correction loop: 2, previous reviewed head `974585ff8218b662781401dc03a43b24f1f5838e`

## Implemented boundary

Migration `20260815000100_expire_trusted_command.sql` implements only
`supplier_claim.expire` v1 under the merged contract in
`68_EXPIRE_V1_TRUSTED_COMMAND_READINESS.md`.

The exact runtime-facing Phase-A signature is:

    supplier_claim.expire(
      p_source_item_identity text,
      p_claim_id uuid,
      p_expected_claim_version integer,
      p_correlation_id uuid default null
    )

The private fenced Phase-B routine is
`supplier_claim._execute_expire(text, uuid, integer, uuid, uuid)`.

A dedicated local `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS`
`mujahiz_claim_expiry_worker` role alone receives schema usage and execute on
those two routines. `PUBLIC`, `anon`, `authenticated`, `service_role`,
`mujahiz_claim_runtime`, and the worker itself remain revoked from the
canonicalizer, context validator, terminal-history validator, Claim table, and
internal tables. The implementation adds no Claim mutation policy; the
inventory remains exactly three Claim SELECT policies and zero mutation
policies.

The database requires the fixed local worker context:

- environment `local`;
- purpose `supplier_claim_expiry`;
- policy `claim_expiry_v1`;
- principal/actor provenance `automated_worker / claim_expiry_worker`; and
- upstream source class `claim_expiry_scheduler`.

The caller cannot override worker provenance, policy, trusted time, Claim facts,
assignment, result state/version, event identity, or the opaque Phase-B fence.

## Observation identity and idempotency

The source-item identity is required, whitespace-exact, control-free, and
1-256 UTF-8 octets. Phase A stores the raw value only in the approved upstream
identity field and computes its uniqueness digest with HMAC-SHA-256 over the
versioned, length-delimited Expire/source namespace.

The request fingerprint binds the source item, target Claim, expected version,
stored Claim expiry timestamp, fixed source class, fixed worker provenance, and
fixed expiry policy. Correlation,
trusted time, generated IDs, retry count, result values, and the fence are
excluded.

Phase A preserves the established 60-second local lease, 10-attempt cap,
rotated HMAC fence, expired-lease reclaim, durably persisted attempt-limit
terminal failure and replay, and 720-hour replay-row retention. Changed source/target/version/fingerprint binding fails
with `P5108 / idempotency_key_conflict`; an active lease returns
`P5109 / command_in_progress`; an unusable fence/lifecycle returns the
established retry or reconciliation failure.

Completed replay validates its full result lifecycle, retained Claim version,
outcome-specific state, zero unauthorized event/audit effects, and either the
coherent originating expiry history or coherent active/terminal state before
returning a safe replay. A completed pre-expiry observation therefore retains
its original `claim_not_due` status/version after a distinct later observation
expires the Claim.

## State, locks, and trusted time

Phase B follows the canonical order:

1. current idempotency row and fence;
2. claimant principal advisory lock;
3. Supplier advisory lock;
4. claimant profile row;
5. Supplier ownership rows;
6. target Claim row; and
7. one `clock_timestamp()` captured after all locks.

Only coherent `submitted|under_review` Claims with exact assignment-null or
assignment-present provenance/chronology and exact
`expires_at = submitted_at + interval '720 hours'` are mutable. A stale active
version returns `P5112 / claim_version_conflict`. Before expiry, the
observation completes `claim_not_due` without a Claim/event/audit mutation.
At or after expiry, the command increments the Claim version exactly once,
sets `status = expired`, `expired_at = updated_at = command_now`, and writes
the fixed `claim_expiry_worker / claim_expiry_v1` provenance.

Every reviewer-assignment field is left untouched. Expire creates or modifies
no ownership, competing Claim, reviewer/access/role row, notification, decision,
withdrawal, or supersession field.

## Terminal reconciliation

A distinct valid observation against a terminal Claim completes
`already_terminal` only after the private validator proves status-specific
originating history:

- Expired: exact completed Expire idempotency/source lifecycle, exact
  `claim_expired` event and payload/provenance, fixed expiry fields/times, and
  zero originating audit.
- Withdrawn: completed Withdraw idempotency plus exact terminal Claim/event and
  zero originating success audit.
- Rejected: completed Reject idempotency, terminal decision, matching event,
  and matching success audit.
- Approved: completed Approve idempotency, matching event/audit, and coherent
  resulting ownership, including a valid later ownership closure lifecycle.
- Superseded: matching Approve-produced supersession event, winning approved
  Claim, and winner ownership.

Missing, duplicate, mismatched, expired-before-completion, or contradictory
history returns `P5199 / integrity_reconciliation_required`. The new Expire
observation then completes no idempotency result and writes no Claim, event,
audit, ownership, competitor, or notification effect.

## Correction loop 2: fail-closed terminal-history NULL semantics

Independent review confirmed that a required Approved audit `safe_context` member
could retain its key while being changed to JSON `null`. PostgreSQL `->>` then
returned SQL `NULL`; ordinary `<>` comparisons made the large validation
predicate indeterminate, and PL/pgSQL did not enter its rejection branch. The
same nullable-comparison shape existed in Reject reconciliation.

The correction makes every required Reject and Approved safe-context scalar
comparison null-safe with `IS DISTINCT FROM`, explicitly rejects a null actor
authorization snapshot, verifies Approved `checked_source_classes` is a JSON
array and `superseded_claim_count` is a JSON number, and wraps each nullable
audit/provenance rejection predicate with `coalesce(predicate, true)`. This is
fail-closed: an indeterminate predicate is rejection, never acceptance. It
does not normalize malformed evidence into a valid value.

A second bounded scan covered shared, Withdrawn, Rejected, Approved, Expired,
and Superseded reconciliation helpers. Their remaining `<>`/`NOT IN`
comparisons are either over NOT NULL or lifecycle-shape-constrained Claim,
idempotency, event, and ownership values, use explicit null guards, or appear
in ordinary SQL `WHERE` filtering. No remaining nullable safe-context
extraction or terminal-validation IF predicate can accept SQL `NULL`.

The new synthetic local regression cases mutate only a coherent terminal audit
fixture, preserve the exact safe-context key count, and use a new Expire
observation. Both cases returned `P5199 / integrity_reconciliation_required`:

- Approved: 19 keys, JSON-null `evidence_verification_method_code`, no Expire
  completion, Claim/event/audit/ownership/competitor repair.
- Rejected: 16 keys, JSON-null `evidence_verification_method_code`, no Expire
  completion, Claim/event/audit/ownership repair.

The isolated new-case probe passed before the full focused suite.
## Atomic event and audit behavior

A real expiry writes exactly one ordinal-1
`supplier_ownership.claim_expired` v1 event in the same Phase-B transaction.
It binds the current idempotency row and raw scheduler observation identity,
uses automated-worker provenance and the local
`supplier_claim_expiry_worker` component, and contains exactly Claim ID,
Supplier ID, claimant user-profile ID, and committed Claim version.

Claim update, event insert, and fenced idempotency completion commit or roll
back together. `claim_not_due` and `already_terminal` write no event.
Ordinary Expire success writes zero audit rows. No notification is created or
materialized.

## Focused pgTAP evidence

`supabase/tests/expire_trusted_command.sql` proves the exact signatures,
owners/search-path-compatible boundaries, dedicated role shape and grants,
generic/human denial, no direct table authority, unchanged RLS inventory,
submitted and under-review expiry, assignment preservation, not-due completion
and replay, coherent terminal no-op, malformed originating expiry fail-closed,
event provenance/payload/cardinality, zero ordinary audit, no not-due mutation,
worker-context denial, stored-expiry/source/fingerprint/result-resource
corruption, active assignment chronology/provenance corruption, stale-fence
takeover, durable attempt exhaustion, and not-due replay after later expiry, plus JSON-null Approved and Rejected terminal audit reconciliation with key-count and no-side-effect assertions.

The focused Expire suite passed 59/59 assertions with zero failures.

The complete repository local SQL validator passed:

- 29 migrations applied;
- 29 pgTAP files run;
- 2,229/2,229 assertions passed;
- 0 failures; and
- 194.1 seconds.

Command:

    powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/validate-local-supabase-sql.ps1

The disposable container was removed by the runner.

## True-session concurrency evidence

`scripts/test-claim-expire-concurrency.ps1` uses separate PostgreSQL sessions
behind forced shared-lock waits and covers:

1. same observation and same fence;
2. different observations against one Claim;
3. due Expire versus Withdraw;
4. due Expire versus Reject;
5. due Expire versus Assign Reviewer;
6. due Expire versus Approve;
7. pre-expiry Withdraw winning before Expire;
8. pre-expiry Assign Reviewer winning before Expire;
9. pre-expiry Reject winning before Expire;
10. pre-expiry Approve winning before Expire;
11. a forced wait crossing the exact expiry boundary; and
12. Expire versus an independent competing Submit.

All 23/23 checks passed across twelve races in 144.6 seconds. The outcomes prove
one version increment and event, coherent `already_terminal` for the second
valid observation, allowed loser denial classes, post-lock trusted time,
assignment preservation, no ownership/approval side effect, no competitor
mutation by Expire, zero Expire audit, and no deadlock.

Command:

    powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/test-claim-expire-concurrency.ps1

The disposable container was removed by the harness.

## Impact, gates, and stop point

This is the sixth and final local Claim-v1 external command implementation.
That statement is local repository evidence only; it is not hosted or
Production activation.

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`,
`FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

Production/data/deployment impact is none. All execution used disposable local
PostgreSQL and synthetic data. No hosted Supabase project was linked or
accessed. No Firebase Production/Auth/config/Rules/index, Production/TEST data,
deployment, migration, seed, backfill, DNS, billing, secret, credential,
notification delivery, or file-storage operation occurred.

Exact stop point: commit and push this correction to the same branch, update
Draft PR #135, and stop at `AWAITING_INDEPENDENT_REVIEW`. Do not mark Ready, merge, deploy, operate a
hosted service, synchronize the Baseline, or begin A2/A5.
