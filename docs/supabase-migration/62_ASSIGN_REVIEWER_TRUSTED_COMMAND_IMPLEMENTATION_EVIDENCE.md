# Assign Reviewer Trusted Command — Implementation Evidence

## 1. Scope and recovered starting point

This bounded LOCAL-only slice implements `supplier_claim.assign_reviewer` v1. It creates no table, Claim mutation RLS policy, notification, ownership, reassignment, Owner override, other Claim command, hosted capability, seed, backfill, gateway, Firebase change, or Production/TEST-data action.

Work resumed on the existing `codex/assign-reviewer-trusted-command` branch at exactly:

```text
d48aaf0da9c85f2f645b631a1f5fa7b6387c5ced
```

At recovery, local `HEAD`, `main`, and `origin/main` all matched that commit. The existing working tree contained exactly three untracked task files: the assign-reviewer migration, its focused pgTAP test, and its true-session concurrency harness. No second branch or migration was created.

## 2. Implemented command boundary

The migration adds only:

- private SECURITY INVOKER request canonicalization for the code-owned v1 fingerprint;
- private SECURITY DEFINER Phase-A reservation, replay, conflict, and bounded reconciliation handling;
- private SECURITY DEFINER fenced Phase-B execution;
- Owner-only assignment to a distinct currently usable `owner|admin` candidate;
- deterministic principal, Supplier, authority-row, ownership-row, and Claim locking with post-lock re-reads;
- write-once `submitted -> under_review`, version `1 -> 2`, and exactly six immutable reviewer-assignment fields;
- one required minimized success or accountable denial audit;
- one success-only `supplier_ownership.claim_under_review` event with no reviewer identity; and
- atomic idempotency completion or bounded terminal denial.

The command accepts no caller-supplied assigner, role, eligibility result, conflict result, assignment source/policy, status, or time. The safe result excludes reviewer identity, claimant identity, authorization reasons, audit/event/idempotency internals, private evidence, and unrestricted JSON.

## 3. Replay-hardening finding and closure

The recovered implementation fully cross-checked the completed idempotency row, Claim, and event, but success replay validated only a subset of the corresponding required audit envelope. Terminal denial replay also matched the failure code without proving the required outcome class.

The finding is valid under the Owner-approved contracts:

- the Claim Reviewer readiness contract requires exact completed replay with no new write and binds success audit action, outcome, prior/result state and versions, changed-field allowlist, correlation, idempotency/event references, versioned provenance, minimization policy, and retention class;
- AUD-001 requires bounded outcome classes, stable result/reason codes, minimized versioned evidence, immutable audit rows, and fail-closed required evidence; and
- idempotency binds one logical request to one safe replay result but is not authority to ignore contradictory Claim/audit/event state.

The existing migration was repaired in place. Replay now selects the one authoritative non-idempotency-conflict audit associated with the stored idempotency result and fails closed unless the complete success envelope matches: action/code/version/class; actor and authorization snapshot; target and related candidate; timestamps; source/environment/component/operation; succeeded/result/reason classification; exact 13-key minimized context; correlation and event binding; prior/result states and versions; exact eight changed-field codes; null optional evidence/correction/hold fields; audit/evidence/authorization/producer/minimization versions; and retention class.

Terminal denial replay now validates the complete minimized denial envelope and binds the stored failure code to exactly:

- `actor_not_authorized -> rejected`;
- `reviewer_conflict -> conflicted`; and
- `integrity_reconciliation_required -> failed`.

Legitimate separately audited idempotency-conflict attempts remain excluded from the authoritative result-audit count. Missing, duplicate, incomplete, wrongly classified, wrongly versioned, wrongly bound, or otherwise contradictory durable replay evidence returns only `P5199 integrity_reconciliation_required`.

## 4. Focused replay/corruption result

A disposable minimal two-Claim probe ran before the complete pgTAP file:

```text
10/10 replay checks passed
```

It proved two valid replays and eight corruption paths: success action, action-contract version, outcome classification, result binding, safe-context completeness, changed-field completeness, evidence-schema provenance, and terminal-denial outcome class. Every corruption path failed closed with the bounded integrity error. Durable state remained one Claim mutation, one success event, one success audit, and one denial audit; no duplicate effect or private authorization detail appeared.

## 5. Focused pgTAP result

The complete `supabase/tests/assign_reviewer_trusted_command.sql` file passed:

```text
99/99 assertions passed
0 failed
```

This includes exact grants/catalog/RLS structure; write-once transition and preserved Claim content; success audit/event/idempotency bindings; valid success and denial replay; corruption failures; rollback on required event/audit failure; authority, role, access, security, conflict, lifecycle, expiry, and malformed-state negatives; private-read continuity; no reviewer event leak; no notification; and absence of approve/reject/expire.

## 6. Concurrency results

The directly affected true-session same-key/same-fingerprint case ran first and passed:

```text
4/4 checks passed
```

It proved one Phase-B winner, one bounded `P5110 retry_later` loser, a valid committed replay, and final state `record_version/event/success-audit = 2/1/1`.

The complete existing concurrency harness then passed:

```text
22/22 checks passed
```

True sessions proved different-key assignment, same-key execution/replay, candidate-swap fencing, assignment/withdraw serialization, trusted expiry, assigner-authority loss, candidate-authority loss, and Supplier-conflict serialization. Global successful assignment, event, and success-audit totals remained equal, and reviewer identity appeared in zero event payloads.

## 7. Complete local SQL validation

The full local validator ran once after the focused and concurrency stages:

```text
26 migrations applied
26 pgTAP files run
1,875/1,875 assertions passed
0 failed
87.1 seconds
```

No shared submit/withdraw helper or migration changed, so their separate concurrency/regression harnesses were not rerun. Their pgTAP regressions were included and passed within the complete 26-file validator.

## 8. Adversarial closure

The resumed replay-focused adversarial review closed with:

- a partially matching success audit cannot authorize replay;
- a terminal denial with a mismatched outcome class cannot replay;
- completed idempotency cannot point to contradictory Claim/audit/event state;
- missing, duplicate, corrupted, incomplete, or wrongly versioned durable result evidence fails closed;
- valid success and terminal-denial replay create no Claim mutation, audit, or event duplicate;
- corruption errors expose only `integrity_reconciliation_required`, not reviewer identity, prior authorization bindings, security/conflict reasons, SQL detail, or private Claim evidence;
- `PUBLIC`, `anon`, browser `authenticated`, generic `service_role`, and unlisted roles gain no command or direct Claim mutation authority;
- runtime has named command execution only and no direct Claim UPDATE;
- the Claim keeps exactly three SELECT policies and zero mutation policies;
- assignment creates no ownership, notification, competitor mutation, reassignment, or Owner override; and
- `supplier_claim.approve`, `supplier_claim.reject`, and `supplier_claim.expire` remain absent.

## 9. Exact resulting structural and command counts

- 26 tracked local SQL migrations.
- 26 pgTAP SQL test files.
- 24 physical `public`/`internal` tables; assignment adds zero.
- 80 logical concepts.
- 37 Core Phase 1 concepts: 22 implemented table concepts and 15 unimplemented table concepts.
- Exactly three Claim SELECT RLS policies.
- Exactly zero Claim mutation RLS policies.
- Exactly three of six Claim business mutations implemented: `submit`, `withdraw`, and `assign_reviewer`.
- Exactly three remain unimplemented: `approve`, `reject`, and `expire`.
- Exactly nine `supplier_claim` routines: three private canonicalizers, three Phase-A reservations, and three Phase-B executors.
- Exactly six `supplier_claim` SECURITY DEFINER boundaries; the three canonicalizers remain SECURITY INVOKER.
- Zero assignment tables, notification tables/writes, ownership writes, reassignment paths, or reviewer-bearing assignment events.

## 10. Seven Open gates

The Open gates remain exactly:

```text
ORG-001
ORG-002
MSG-002
FILE-001
BILL-001
RES-001
MIG-002
```

None is resolved or weakened by this local synthetic command slice. In particular, FILE-001 still blocks managed files/custody, RES-001 still blocks hosted environment/resource selection, and MIG-002 still blocks hosted migration/cutover/reconciliation and real-data authority.

## 11. Production and data impact

None. All writes used disposable local PostgreSQL containers and synthetic fixtures. No Firebase, hosted Supabase, Production/TEST data, hosted RLS/grant, deployment, gateway, migration, seed, backfill, DNS, billing, Auth/configuration, file, notification, or ownership action occurred.

## 12. Files and exact stop point

Task files are:

- `supabase/migrations/20260812000100_assign_reviewer_trusted_command.sql`;
- `supabase/tests/assign_reviewer_trusted_command.sql`;
- `scripts/test-claim-assign-reviewer-concurrency.ps1`; and
- `docs/supabase-migration/62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`.

Exact stop point: commit and push this branch, open exactly one Draft PR, observe the PR Gate if available, and stop. Do not mark Ready, merge, sync the Baseline, implement approve/reject/expire, or perform hosted/Firebase/Production work.