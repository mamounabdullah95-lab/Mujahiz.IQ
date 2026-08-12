# `supplier_claim.reject` v1 trusted-command readiness

Status: **Blocked — material reject-specific registry decisions remain intentionally unapproved; no SQL, runtime, or authority change is authorized**

Date: 2026-08-12

## 1. Scope, recovered state, and verdict

This is a documentation-only readiness review for the next bounded Claim mutation, `supplier_claim.reject` v1. It does not implement or authorize SQL, a migration, a command, an RLS policy, a notification writer, Firebase work, hosted Supabase work, data access, or Production action.

The recovered task branch is `codex/reject-trusted-command-readiness`. It was clean, had no unique commit or diff, and was already based on the verified current `origin/main`.

The exact starting main SHA is:

```text
8fa1a0fed1e3f65e12e0af585ae2758d7ca776ff
```

It is the merge of PR #123. Git ancestry confirms the merged PR #120, #121, #122, and #123 chain: PR #120's reviewed head is an ancestor of #121; #121 is an ancestor of PR #122's merge; PR #122 is an ancestor of PR #123's merge; and the recorded #123 head is `origin/main`.

Current repository evidence, including the merged assign-reviewer implementation evidence, is:

| Boundary | Verified current value |
|---|---|
| Tracked SQL migrations / pgTAP files | 26 / 26 |
| Physical `public`/`internal` PostgreSQL tables | 24 |
| Logical concepts / Core Phase 1 concepts | 80 / 37 |
| Implemented / unimplemented Core table concepts | 22 / 15 |
| Claim RLS policies | Exactly three SELECT and zero mutation policies |
| Implemented Claim business mutations | `submit`, `withdraw`, `assign_reviewer` |
| Unimplemented Claim business mutations | `approve`, `reject`, `expire` |

**Verdict: blocked, not implementation-ready.** The shared trusted-command, assigned-reviewer, locking, audit, event, and notification foundations are sufficient for a bounded local implementation once the reject-specific policy is approved. However, the authoritative contract deliberately leaves the exact rejection-reason/disclosure registry and its evidence-verification applicability to the reject implementation slice. That makes the exact public signature, canonical fingerprint, terminal write values, audit reason evidence, and event payload semantics unsafe to choose unilaterally.

This is not an Open-gate failure. It is an unresolved material command-policy decision.

## 2. Evidence inspected and boundary

This review used the current baseline and only the direct authoritative contracts and implementation evidence for REL-001, AUD-001, MSG-003, SEC-001, Claim v1 atomicity/locking, reviewer readiness, the Reviewer private-read substrate, and assign-reviewer. Direct implementation inspection was limited to the existing Claim table, `submit`, `withdraw`, `assign_reviewer`, idempotency, audit/event, and reviewer authorization dependencies.

The key evidence is:

- [Claim v1 trusted-command atomicity and locking contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md): separate `reject` command, assigned-reviewer predicate, transition, shared idempotency/locking, required audit/event, and the explicit deferment of the reject registry.
- [AUD-001 contract](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md): atomic primary success evidence, accountable denial evidence, minimization, replay, and retention class.
- [MSG-003 contract](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md): rejected-event-only asynchronous claimant notification materialization.
- [Reviewer readiness contract](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md) and [Reviewer substrate evidence](61_REVIEWER_PRIVATE_READ_SUBSTRATE_IMPLEMENTATION_EVIDENCE.md): exact current reviewer predicate, fixed read boundary, notes column boundary, conflict handling, and FILE-001 boundary.
- [Assign-reviewer implementation evidence](62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md): the current Phase-A/Phase-B fence and strengthened complete audit/event/Claim replay-integrity pattern.

Firebase remains the Production authority. All relational facts described here are local-only, synthetic-data implementation evidence; they are not Firebase, hosted Supabase, or Production proof.

## 3. Fixed reject contract

### 3.1 Logical command and caller inputs

The approved logical command name and version are:

```text
supplier_claim.reject v1
```

The existing contracts fix these logical caller inputs:

```text
idempotency_key
claim_id
expected_claim_version
expected_reviewer_assignment_version
rejection_reason_code
evidence-verification projection where the approved reject policy requires it
optional restricted reviewer_notes only if the reject policy elects to accept them
optional opaque correlation_id
```

The exact SQL function signature is **not approved yet**. It must not be inferred from `assign_reviewer`, because the omitted reject policy determines whether evidence-verification fields and reviewer notes are accepted, and therefore determines the public parameter list and canonical fingerprint. As in the existing commands, the later implementation may use a private canonicalizer, Phase-A reservation, and fenced Phase-B executor; the execution fence is a server/runtime hand-off, not a business caller input.

The command must never accept actor, claimant, Supplier, role, authorization result, conflict result, status, assignment provenance/version after validation, timestamps, resulting Claim version, audit/event ID, event ordinal, notification content/recipient, ownership ID, or a Firebase/provider identity.

### 3.2 Server-derived fields and required state

The server derives the effective current principal; current profile/link/role/access/security result; Claimant and Supplier IDs; assignment provenance; trusted time; outcome/result token; resulting version; audit/event IDs; and all safe disclosure mapping.

Success requires, after the deterministic locks and re-reads:

- target Claim status is exactly `under_review`;
- `record_version = expected_claim_version`;
- `reviewer_user_profile_id` equals the server-derived principal;
- `reviewer_assignment_version = expected_reviewer_assignment_version`, and the only currently supported v1 assignment remains version `1` with source `owner_assignment` and policy `claim_reviewer_assignment_v1`;
- all six immutable assignment fields are complete and structurally coherent;
- the Claim's 720-hour expiry invariant is coherent and one trusted `command_now`, captured after locks, is strictly before `expires_at`;
- immutable submission shape/fingerprint/evidence schema are coherent;
- the exact reviewer remains currently eligible and target-Supplier conflict is `clear`; and
- reject-specific reason/evidence input passes the future approved registry.

The transition is exactly:

```text
under_review -> rejected
record_version = prior record_version + 1
```

The retained assignment is immutable provenance. Reject does not clear, replace, or increment the reviewer assignment; it writes no ownership and changes no competing Claim.

Rejection rechecks actor and Claim integrity but does **not** revalidate claimant eligibility, Supplier approval eligibility, an unowned ownership slot, or the complete competitor set as approval does. It must still use the common Supplier lock and lock/read existing ownership rows for the shared Claim/ownership serialization and conflict/integrity boundary. An ownership read creates no ownership authority and does not make the rejection conditional on ownership absence.

### 3.3 Exact assigned-reviewer authorization predicate

The effective human principal comes only from the trusted transaction-local Claim context. At the decision attempt it must satisfy all of the following:

1. Current trusted Firebase ingress evidence: valid identity and current account existence, enabled state, and required verification.
2. Exactly one active linked primary Firebase provider link resolving to the active `buyer`-context `user_profiles` row, with compatible current verification mirror.
3. Exactly one current usable platform role of `owner` or `admin`, one current role-backed platform-administration access grant, and no security deny, hold, quarantine, identity conflict, or contradictory authority fact.
4. Exact equality with the Claim's immutable assigned reviewer; supported assignment version/policy and complete assignment shape.
5. Exact `under_review` status and trusted non-expiry.
6. Not the claimant, not a current target-Supplier primary controller, not a claimant on another active same-Supplier Claim, and no conflict/unknown target-Supplier result. Future enabled membership/delegation evidence outside the resolver makes the result `unknown`, not clear.

An unassigned Owner/Admin, claimant, generic `service_role`, browser/API role, system worker, or actor with a stale/lost role, access, profile, provider, security, or conflict condition is denied. Durable assignment alone never authorizes a decision.

## 4. Material decision required: reason, evidence, notes, and disclosure

The Claim structural seam exists but it is not a registry. The table can retain one terminal `decision_reason_code`, evidence-verification method/version/outcome, policy version, and nullable `reviewer_notes`; it only enforces lexical shape and the 1–2000 UTF-8-byte bound for notes. The contracts expressly require a small versioned internal reject allowlist and independent claimant-safe mapping to be approved in the reject slice. They do not name the full allowed code set, a reject reason-registry version, the code-to-evidence rule, the claimant-safe mapping, note normalization/classification, or the exact reject audit context/fingerprint that follow from those choices.

Existing `submit` and Reviewer prior-context code recognize `insufficient_evidence`, `claimant_ineligible`, and `supplier_mismatch` as resubmission-permitting rejected-Claim results. That is a compatibility constraint, not an approved exhaustive rejection registry. The command contract also says `existing_owner` may be a rejection reason where current evidence supports it. It does not authorize silently treating any of those observations as the entire reason/disclosure policy.

### Owner decision required before implementation

The Owner must approve one bounded reject v1 policy containing all of the following:

1. Exact internal reason codes and registry/version identifier, including whether `existing_owner` is selectable and which, if any, reasons permit the existing resubmission path.
2. Whether evidence-verification method/version/outcome is required for every rejection or only for named reason codes; in either case, the exact allowed method/version/outcome tuples and restricted-reference/digest rule.
3. The independent claimant-safe notice/result mapping for every internal reason. Unknown/restricted codes must map only to `not_approved` or `result_unavailable`.
4. Whether reviewer notes are omitted for v1 or accepted as one optional restricted terminal note; if accepted, the canonical normalization/control-character rule, PII/security classification, and any validation beyond the structural 1–2000-byte cap.

Bounded evidence-supported options are:

| Policy point | Option A | Option B | Recommendation |
|---|---|---|---|
| Reason set | A minimal allowlist preserving the three already recognized resubmission outcomes, plus only explicitly approved additional decisions such as `existing_owner` | A wider controlled review taxonomy | **A.** It is the smallest compatibility-preserving slice and avoids inventing categories. |
| Evidence verification | Require one registered method/version/outcome for every rejection | Require it only for explicitly named reason codes, with a complete per-code rule | **A.** It yields one auditable decision shape, but requires the Owner to approve the small tuple registry. |
| Reviewer notes | Do not accept notes in reject v1; store `NULL` | Accept one optional restricted terminal note under the existing byte cap plus an approved normalization/classification rule | **A.** It minimizes PII/secret leakage and leaves the structurally available field unused until a restricted-note purpose is approved. |
| Claimant disclosure | Generic `not_approved` for every internal reason | Explicit claimant-safe mappings for selected codes, generic fallback for all others | **A initially.** It satisfies the existing claimant projection while avoiding disclosure of ownership, security, evidence, or investigation detail. |

These are recommendations, not selected values. No reject SQL, signature, audit row, event payload, or notification template may adopt them until the Owner explicitly approves the complete policy.

## 5. Idempotency and replay plan

The fixed namespace is `local + supplier_claim.reject + contract version 1` and the target binding is the Claim UUID. The raw caller key is accepted only by the trusted boundary and stored only as the existing versioned HMAC digest. The Phase-A reservation must bind the server-derived actor, target, command/version, environment, key digest, and the canonical request fingerprint. It retains the existing claim-command lease/reclaim/fence model: a processing lease denies parallel Phase-B execution; a reclaimed attempt has a new fence; terminal updates match current lease digest and attempt; and a commit atomically contains the Claim, audit, event, and completed result binding.

The contract fixes the fingerprint categories:

```text
claim_id
expected_claim_version
expected_reviewer_assignment_version
approved rejection reason and registry/version representation
approved evidence method/version/outcome and normalized restricted references/digests
keyed digest of canonical reviewer_notes or explicit null
rejection/disclosure/authorization policy versions
```

Raw key, correlation ID, authentication tokens, headers, retry count, server time, server-derived actor/role facts, generated IDs, and notification values are excluded. Reviewer notes and private evidence never enter `internal.idempotency_keys`; only approved keyed/versioned digests may affect a fingerprint.

Identical completed replay must reapply current safe response authorization and prove the stored Claim, idempotency binding, one primary event, and one primary audit are mutually consistent. It creates no Claim transition, version increase, audit, event, or notification. The assign-reviewer replay repair is mandatory conceptual reuse: any missing, duplicate, incorrectly classified, incorrectly versioned, incompletely bound, or contradictory Claim/audit/event evidence fails closed as `integrity_reconciliation_required`.

Same-key changed reason, evidence tuple/reference, notes/nullness, expected versions, actor, target, environment, or policy/fingerprint version returns `idempotency_key_conflict` with no domain mutation and an accountable minimized post-auth denial audit. Terminal denial replay must also validate the full denial outcome class, not merely the error code.

The exact HMAC projection cannot be finalized until the Owner decision in section 4 exists.

## 6. Required atomic write set, audit, event, and notification boundary

On success, exactly one database transaction must:

1. update the selected Claim only to `rejected`, incrementing `record_version` once and setting trusted decision actor/time plus the approved decision/evidence/policy fields and optional approved note;
2. insert one primary minimized immutable success audit;
3. insert one `supplier_ownership.claim_rejected` version-1 domain event with ordinal `1` and `aggregate_sequence` equal to the committed Claim version; and
4. complete the fenced idempotency record with the safe result binding.

It must write no ownership, competing Claim, assignment, notification, or direct claimant-disclosure row. Failure of any required Claim update, audit insert/evidence validation, event insert/uniqueness validation, or idempotency completion rolls back all effects.

### Audit contract

The primary success audit is required and atomic. Its fixed minimum is action `supplier_claim.reject` version 1; human actor; Claim/Supplier targets; prior and resulting state/version; bounded approved decision reason; evidence-verification outcome where applicable; correlation, idempotency, event, source/environment, authorization and producer provenance; allowlisted changed-field codes; minimized safe context; and the `claim_ownership_decision` retention class. It copies neither notes nor Claim evidence.

After an accountable actor/source is resolved, unauthorized, reviewer-conflict, identity/eligibility, evidence, quarantine, idempotency-binding, or integrity denials require one separate minimized `rejected`, `conflicted`, or `failed` audit when the action registry applies. Pre-auth malformed/unmapped/anonymous traffic is bounded security telemetry, not a durable domain audit. An audit write failure never permits mutation; a required denial-audit failure returns only safe audit/result-unavailable behavior.

The exact reason/evidence-driven safe-context key set and changed-field allowlist are dependent on the Owner policy and must be defined and replay-validated in the implementation PR. They must at least distinguish status, record version, decision actor/time, decision reason, evidence-verification values, decision authorization policy, and reviewer notes only when notes are approved. They must never include raw notes, evidence, key/fingerprint, token/provider subject, owner/competitor identity, notification copy, SQL/stack text, or unrestricted JSON.

### Event and notification contract

The success event is:

```text
supplier_ownership.claim_rejected
event schema version: 1
producer: supplier_claim.reject
event ordinal: 1
aggregate: rejected Claim
aggregate sequence: committed Claim record_version
```

Its approved payload boundary is Claim ID, Supplier ID, claimant user-profile ID, committed Claim version, and bounded internal reason code/version. It excludes all names/contact data, submitted reason/evidence, reviewer identity/notes, provider subject, audit/idempotency data, notification copy, URLs, security detail, and unrestricted metadata. The event reason representation remains blocked by section 4's registry decision.

`supplier_claim_decision_notification_materializer` is the only later live notification creator. It asynchronously derives the exact claimant recipient and one immutable protected bilingual `in_app` snapshot from the event; rejection uses generic copy or the Owner-approved claimant-safe notice code. The materializer inserts at most one `(domain_event_id, recipient_user_profile_id, channel)` row and marks the event processed in the same later transaction. Reject itself never inserts a notification. Notification/worker failure never rolls back a committed reject and never falls back to Firebase.

## 7. Locking and concurrency plan

The shared protocol fixes the following conceptual order:

```text
1. idempotency row / current Phase-A fence
2. sorted principal-authority advisory locks for the acting reviewer and the target Claimant
3. Supplier advisory lock
4. locked actor authority rows: profile, provider link, role, access, security eligibility
5. locked Supplier and ownership history/active slot
6. locked target Claim and its immutable assignment/submission/decision shape
7. locked/re-read conflict and reject-policy evidence/hold inputs
8. one trusted database time capture, then mutation/audit/event/completion
```

The Claimant is locked as a relational/concurrency participant, not revalidated for approval eligibility. There is no candidate reviewer lock, no approval-only complete competitor lock, and no ownership insertion. All initial target values are lock-routing hints only; authorization and mutation rely solely on the post-lock re-reads. The later implementation must use the existing versioned principal and Supplier lock-key helpers and deterministic UUID ordering, and must re-use the current Phase-A reservation/fenced Phase-B pattern.

Focused true-session pgTAP/concurrency coverage for the implementation PR must prove:

| Race or attack | Required outcome |
|---|---|
| Same key / same request | One Phase-B winner, then exact replay; one Claim transition, one success audit, one event |
| Same key / changed reason, evidence, or notes | `idempotency_key_conflict`; no duplicate transition/event/success audit |
| Different keys for same Claim | Supplier/Claim serialization leaves one terminal transition; loser gets actionable/version conflict only |
| Reject vs withdraw | One terminal transition wins; the second writes no effect; preserved assignment provenance is never cleared |
| Reject vs expire | At or after trusted expiry reject cannot commit; before it, first valid shared-lock holder wins and the other observes terminal state/version |
| Reject vs approve | One terminal transition wins; rejected Claim creates no ownership or competitor change; approval cannot approve it afterward |
| Reviewer role/access/profile/link/security loss | Principal lock serializes; the second transaction re-reads and a lost authority cannot decide |
| Target Supplier conflict change | Supplier/principal locking and post-lock resolver re-read deny conflict or unknown |
| Unassigned/wrong reviewer, claimant, controller, generic service role, browser role | No mutation; only required accountable denial evidence; no private detail leakage |
| Stale Claim or assignment version; due/withdrawn/rejected/approved/superseded target | No mutation, no success audit/event, and bounded safe error |
| Corrupted completed result, Claim, audit, or event | Fail closed with `integrity_reconciliation_required`; no re-execution |
| Event/audit/idempotency failure | Entire success transaction rolls back; no partial state |
| Duplicate event/audit attempt | Registry and result-integrity checks reject/contain it; one authoritative success record remains |
| Notification writer/direct insert | No command-side notification path or grant; materializer-only asynchronous boundary remains |

## 8. RLS and grant boundary

Reject requires no new Claim mutation RLS policy. `supplier_ownership_claims` remains RLS-enabled and FORCE RLS with exactly the three existing SELECT policies. Direct `INSERT`, `UPDATE`, and `DELETE` remain denied for `PUBLIC`, `anon`, browser `authenticated`, generic `service_role`, and unlisted roles.

The later command may receive execute only through the dedicated server-mediated Claim runtime path and must be a narrowly scoped security-definer boundary with fixed `pg_catalog` search path and no dynamic SQL. The runtime must retain no direct private Claim-column or `internal.*` base-table convenience grants. The private privileged-actor/conflict helpers remain non-browser and non-generic-service APIs. No command grants direct notification insertion.

Catalog/output tests must prove the function and helper ACLs, definer ownership/attributes, fixed search path, zero mutation policies, absence of generic service/browser execution, and no private values in all safe outputs/errors.

## 9. Open gates, FILE-001, and Production impact

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

None blocks a bounded **local-only, synthetic-data-only** reject implementation after the policy decision. FILE-001 blocks managed files, uploads, attachments, custody, signed access, scanning, and file-dependent evidence. It does not block a reject that uses only the already bounded non-file evidence path. The decision must not make approval/rejection depend on a hidden/managed file while FILE-001 remains Open.

RES-001 and MIG-002 continue to block hosted resource selection, migration/cutover/reconciliation, and real-data authority. None of the other Open gates is resolved or weakened by this review.

Production/data impact: **none**. This review used repository history and local source evidence only. It accessed no Firebase, hosted Supabase, Production/TEST data, credentials, deployment, gateway, migration, seed, backfill, DNS, billing, Auth/configuration, or notification service.

## 10. Implementation boundary after Owner approval

After the Owner approves section 4, the next one-purpose local PR may contain only:

1. one reject command migration, using the existing two-phase idempotency/fence substrate and shared lock helpers;
2. one focused reject pgTAP file plus a true-session reject concurrency harness;
3. exact code-owned reject reason/evidence/disclosure registry and fixed safe result/audit/event contracts; and
4. one implementation-evidence document.

It must not add a table, Claim mutation RLS policy, ownership mutation, competitor mutation, reassignment/override, notification writer/table, hosted/Firebase behavior, seed/backfill, or shared-baseline update. It should conceptually reuse the strengthened assign-reviewer replay-integrity checks, but must not copy assignment-specific audit/event semantics into reject.

## 11. Exact stop point

This review stops with the material policy decision documented. Do not implement `supplier_claim.reject`, choose a reason/evidence/notes/disclosure value, mark this work Ready, merge, deploy, migrate, access hosted systems, or alter Production authority. The only authorized next action is Owner approval of the bounded decision in section 4, followed by a separate local-only reject implementation task.

## 12. References

- [Current baseline](../ai-context/01_CURRENT_BASELINE.md)
- [REL-001 idempotency and domain events](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [AUD-001 audit evidence](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [MSG-003 notification contract](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [SEC-001 Claim authorization](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [Claim v1 trusted-command contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [Reviewer readiness](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md)
- [Reviewer private-read evidence](61_REVIEWER_PRIVATE_READ_SUBSTRATE_IMPLEMENTATION_EVIDENCE.md)
- [Assign-reviewer implementation evidence](62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
