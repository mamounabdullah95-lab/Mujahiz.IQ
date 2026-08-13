# supplier_claim.approve v1 - Implementation Evidence

Date: 2026-08-13
Branch: codex/approve-trusted-command
Scope: local PostgreSQL and synthetic data only

## Independent-review follow-up for PR #130

The independent read-only review of head `2eb9160d0c0bc053cdbf17a5f988f301d317e673`
returned `CHANGES REQUIRED` with three MEDIUM findings, M1-M3. The
initial write path, lock architecture, one-winner and competitor handling,
atomic effects, event ordering, and RLS/grant/SECURITY DEFINER boundaries
were accepted and were not reopened beyond direct dependencies of these
corrections.

- **M1 root cause:** completed success replay proved the stored principal and
  assignment but did not reapply current response authorization. Exact replay
  now acquires the Phase-B principal/Supplier/authorization/ownership/Claim
  locks, re-runs the privileged-actor decision, independently counts current
  role-backed administration access and complete-clear security eligibility,
  and evaluates an approved-status-capable target-Supplier conflict path.
  Loss of disclosure authorization raises the established
  `P5100 / claim_context_invalid` response error without changing the
  historical approval.
- **M2 root cause:** field-by-field `<>` checks could evaluate to SQL UNKNOWN
  for JSON null. Replay now builds the exact bounded 19-key expected JSONB
  object and rejects it with `IS DISTINCT FROM`; the derived count and role
  snapshot are also explicitly non-null. JSON null, SQL null, wrong type,
  wrong value, missing key, and extra key therefore fail reconciliation.
- **M3 root cause:** same-Supplier historical approval reconciliation checked
  only a narrow Claim/ownership subset. Approve now locks every same-Supplier
  Claim and validates immutable submission, assignment, decision chronology,
  evidence tuple/source-path/reason registry, resulting ownership
  establishment and closed lifecycle, and the corroborating primary
  audit/idempotency/approved event. A coherent revoked approval remains valid
  history; malformed or orphaned history fails closed before a new ownership.

Final follow-up validation was: **M1 6/6**, **M2 6/6**, **M3 13/13**,
complete focused Approve **141/141**, true multi-session concurrency
**24/24 across ten races**, and the full local SQL validator
**2,124/2,124 across 28 migrations and 28 test files, 0 failures, 196.4
seconds**. Reject was not rerun because no Reject migration, shared resolver,
or shared behavior changed. All tests used disposable local PostgreSQL and
synthetic data only.

## Second independent-review closure for PR #130

The second independent read-only review of head
`14c516efc6ee428cdde525117703f8c8539c27bb` confirmed M1 closed and
reported two remaining MEDIUM findings:

- **M2 outer-audit SQL NULL:** the exact 19-key `safe_context` comparison was
  null-safe, but required nullable scalar columns in the primary success-audit
  envelope still used ordinary `<>`. SQL NULL therefore produced UNKNOWN and
  could bypass the replay corruption predicate. Completed replay now uses
  `IS DISTINCT FROM` consistently for every exact required audit scalar,
  while existing explicit required/non-null and exact JSONB checks remain.
  Focused coverage sets every required nullable outer field to SQL NULL,
  supplies wrong valid-looking state/version values, proves each attempt fails
  with `P5199 / integrity_reconciliation_required`, and confirms the exact
  valid envelope still replays without writes.
- **M3 historical event/idempotency reconciliation:** historical approval proof
  joined one event and idempotency row without validating the complete writer
  contract, exact produced-event set, or retained request fingerprint. The
  read-only check now validates the fixed v1 primary and supersession event
  metadata, correlation, timestamps, availability/processing state,
  historical/fanout flags, exact payloads, unique primary event, contiguous
  cardinality, and exact ordered competitor set. It also validates the complete
  completed-idempotency lifecycle, structural key digest, fixed versions and
  bindings, and reconstructs the authoritative request fingerprint only from
  retained Claim/audit evidence. It does not reconstruct the raw idempotency
  key or any caller input that durable state does not retain.

Current validation is: M1 **6/6**, M2 **24/24** (the retained 6 plus 18 new
outer-audit cases), and M3 **37/37** (13 historical Claim/ownership cases,
13 event/cardinality cases, and 11 idempotency/fingerprint cases). Complete
focused Approve is **183/183**; true multi-session concurrency remains
**24/24 across ten races**; the full local SQL validator is **2,166/2,166
across 28 migrations and 28 test files, 0 failures, 211.9 seconds**. All
execution used disposable local PostgreSQL and synthetic data only.

## Baseline and reconciliation

Verified origin/main is 6155a08a8ba05bdbc5cf46aa4ee14d18d2764e66, which includes the merged PR #129 Reject pgTAP bookkeeping-only fix. The existing Approve migration was preserved byte-for-byte while the branch was switched back from the prerequisite hotfix branch, then the Approve branch was fast-forwarded from 883dd9e to the verified origin/main.

The preserved migration's pre-reconciliation SHA-256 was 565E414154D26E281F425DE87A5AFF2C811AB5A1A3A24057C55AF679237351E5. Its post-first-review SHA-256 was 1191FED156CE031A70CF2A42B3519B3B4AC30AABD078F2E07B161274D0CF703B. After closing the second-review M2/M3 findings, the final SHA-256 is 2936D671E110C638FE609275ACFD2CB964F892486D79045C2FC2BE783822BF3B.

The prerequisite complete validator passed after reconciliation with **28 migrations, 27 test files, 1,983/1,983 assertions, 0 failures**. The corrected Reject suite passed **108/108**, proving the pre-existing bookkeeping blocker was gone before Approve work resumed.

## Command boundary

The migration is 20260813000100_approve_trusted_command.sql. It implements only supplier_claim.approve v1. The exact public business signature is:

    supplier_claim.approve(
      p_idempotency_key text,
      p_claim_id uuid,
      p_expected_claim_version integer,
      p_expected_reviewer_assignment_version integer,
      p_evidence_verification_method_code text,
      p_evidence_verification_version text,
      p_evidence_verification_outcome_code text,
      p_checked_source_classes text[],
      p_restricted_evidence_reference text,
      p_correlation_id uuid default null
    )

The runtime derives the reviewer from trusted Claim context. The caller cannot supply actor, claimant, Supplier, ownership, decision reason, reviewer role, trusted time, digest, reviewer notes, event, audit, policy/registry version, or execution fence through this boundary.

## Evidence, authorization, and state

The exact evidence tuple is manual_review / claim_evidence_review_v1 / verified. Exactly one normalized source path is accepted:

- authorized_officer_confirmation;
- claimant_authority + official_registry; or
- company_domain_challenge + independent_supplier_corroboration.

The restricted reference is required, opaque, non-file, whitespace-free, and 1-256 UTF-8 bytes. URL, path, query, credential, file, storage, object, and attachment forms fail closed. A server-derived SHA-256 digest is retained only in the protected audit boundary; idempotency stores a keyed reference binding and never the raw reference.

Under deterministic post-lock rereads, the reviewer must be the exact assigned Owner/Admin with coherent current identity, role, access, security, and conflict state. The claimant, Supplier, ownership slot, target Claim, every active-status same-Supplier competitor, assignment provenance, immutable submission shape, and existing approval history are all revalidated. The winner must be a coherent, non-due under_review Claim at the expected Claim and assignment versions.

## Atomic effects

A successful command creates exactly one active primary ownership for the winning claimant, transitions the winner to approved with record_version + 1, and supersedes every other same-Supplier submitted|under_review Claim in ascending Claim UUID order, including due rows. Terminal rejected, withdrawn, expired, superseded, and historical approved state is preserved.

The command writes one primary success audit, one ordinal-1 supplier_ownership.claim_approved event, and one ordered supplier_ownership.claim_superseded event per competitor. It creates no notification and no ownership-established event. Event payloads contain no evidence source classes, restricted reference, digest, reviewer identity, provider identity, audit data, or idempotency internals.

Event, audit, or idempotency-completion failure rolls back the complete ownership/Claim/event/audit/idempotency Phase-B transaction. Accountable predicate denials write one minimized terminal denial audit and no aggregate or event effects.

## Idempotency and replay integrity

Phase A durably reserves, replays, or reclaims an expired lease with a rotated opaque fence. Phase B requires the exact current fence, attempt, principal, target, request fingerprint, and lease binding.

Completed replay is read-only and proves the exact winning Claim/version, resulting active ownership, one-owner invariant, exact approval-produced competitor set, contiguous event ordinals and payloads, primary audit, evidence binding, and full idempotency result binding. Missing, partial, duplicate, reordered, mismatched, or contradictory winner, ownership, competitor, event, audit, or idempotency state fails closed with P5199 / integrity_reconciliation_required.

## Concurrency proof

The true multi-session harness forces ten separate races behind the shared lock protocol:

1. same Approve key and fence against itself;
2. different Approve keys against the same Claim;
3. two different Claims competing for one Supplier;
4. Approve versus direct ownership-slot creation;
5. Approve versus Submit;
6. Approve versus Withdraw;
7. Approve versus Reject;
8. Approve versus the approved expiry-equivalent shared-lock transition;
9. Approve versus reviewer authority loss; and
10. Approve versus claimant eligibility loss.

All **24/24 checks passed**. Every race produced one compatible winner or accountable denial, preserved at most one active primary ownership, left no partial aggregate, kept success audit/event counts aligned, and leaked no private evidence into approval events.

## Validation evidence

- Focused Approve pgTAP: **183/183 passed, 0 failures**, including M1 **6/6**, M2 **24/24**, and M3 **37/37**.
- M2 outer-audit regressions: **18/18 passed** for SQL-NULL required fields, wrong valid-looking state/version values, exact valid replay, and zero-write rollback preservation; the retained JSON-null/type/value/missing/extra cases also passed.
- M3 event/cardinality regressions: **13/13 passed** for fixed metadata, schema/sequence/correlation, availability/processing state, historical/fanout flags, missing/duplicate/orphan primary events, and the exact produced-event set.
- M3 idempotency/fingerprint regressions: **11/11 passed** for command version, fingerprint version/presence/exact value, key-digest presence, target/result/version/outcome/status, and orphan linkage.
- Completed replay/corruption coverage: current role/access/security/conflict loss, winner, ownership, competitor set, event ordering/payload, audit JSON and SQL NULL, historical event/idempotency, completed result binding, and rollback preservation all passed within the focused **183/183** suite.
- True multi-session concurrency: **10 race scenarios, 24/24 checks passed; 114.2 seconds**.
- Full local SQL validator: **28 migrations, 28 test files, 2,166/2,166 assertions passed, 0 failures; 211.9 seconds**.
- git diff --check: passed.
- Catalog assertions: **24 physical tables; 15 supplier_claim routines; 10 SECURITY DEFINER boundaries; 15 fixed search_path routines; exactly 3 Claim SELECT policies and 0 Claim mutation policies**.
- Approve grants: exactly the Phase-A business boundary and private-named Phase-B executor are executable by mujahiz_claim_runtime; the digest-returning canonicalizer is not. PUBLIC, anon, authenticated, and service_role have 0 Approve routine grants, while runtime and API roles have 0 direct Claim UPDATE and 0 direct ownership INSERT privileges.
- Static closure found no notification write, new table, mutation RLS policy, dynamic SQL in Approve routines, raw idempotency-key storage, caller-selected privileged fact, or private event-payload leak.

No implementation SQL, pgTAP, or concurrency-harness content changed after the current 2,166-assertion validator and 24-check concurrency results; only this evidence document was updated afterward.

## Structure, remaining commands, gates, and impact

After this migration there are exactly five implemented Claim commands: submit, withdraw, assign_reviewer, reject, and approve. The only remaining Claim command is supplier_claim.expire.

The seven Open gates remain exactly: ORG-001, ORG-002, MSG-002, FILE-001, BILL-001, RES-001, and MIG-002.

Production/data impact is none. All execution used disposable local PostgreSQL containers and synthetic data. No Firebase, hosted Supabase, Production/TEST data, deployment, remote migration, seed, backfill, Auth/config, DNS, billing, notification delivery, or file operation occurred.

Residual release gates remain manual review, the seven Open gates, hosted least-privilege proof under MIG-002, normal Ready/merge approval, and separately scoped future supplier_claim.expire. Local SECURITY DEFINER ownership remains postgres; it is not hosted least-privilege evidence.
