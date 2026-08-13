# `supplier_claim.approve` v1 أ¢â‚¬â€‌ Critical Trusted-Command Readiness

Date: 2026-08-13
Primary task profile: Documentation
Verdict: **BLOCKED أ¢â‚¬â€‌ OWNER DECISION REQUIRED**

## 1. Boundary and verified starting state

This is the smallest sufficient readiness closure before a later SQL-only implementation of `supplier_claim.approve` v1. It does not implement SQL, `supplier_claim.expire`, a gateway, RLS, notifications, hosted Supabase, migration, or Production behavior.

The review started from clean `main` and `origin/main` at `e7bc6971b09175c2bea33b6b7b2bb07fed8660fb`, the merge of PR #127. Reviewed PR #127 head `e2fc63c209ab3a84e9611ac27d7f4925ea89bba1` is an ancestor.

Static repository verification found:

- 27 tracked migrations and 27 pgTAP files;
- 24 physical `public`/`internal` tables;
- 80 logical concepts and 37 Core Phase 1 concepts, of which 22 are implemented and 15 are unimplemented;
- exactly three Claim `SELECT` policies and zero Claim mutation policies; and
- exactly four implemented Claim commands: `supplier_claim.submit`, `supplier_claim.withdraw`, `supplier_claim.assign_reviewer`, and `supplier_claim.reject`. `supplier_claim.approve` and `supplier_claim.expire` are absent.

The approved architecture fixes approval authorization, locking, one-winner behavior, aggregate writes, replay integrity, audit/event ordering, and notification/RLS boundaries. SQL cannot yet choose two Product/Data semantics silently: the approval-specific high-assurance evidence registry and the approval/ownership/supersession reason registry.

## 2. Proposed business signature

Subject to Owner decision 1, the minimum business signature is:

```text
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
```

The later SQL may use the established durable Phase-A reservation/fence plus private Phase-B executor shape without changing these business inputs. The effective reviewer, claimant, Supplier, ownership ID, competitor set/count, reason codes, policy versions, actor role, timestamps, resulting versions, audit/event IDs, ordinals, and notification data are server-derived.

`reviewer_notes` is deliberately omitted from the minimum signature. The approved architecture permits notes but does not require them; approve v1 can keep `reviewer_notes = NULL`, matching the smallest current decision-command convention. The correlation ID is opaque and presentation/correlation-only. Evidence inputs remain blocked until Owner decision 1 fixes their exact values, combinations, bounds, normalization, and non-file reference contract.

## 3. Exact reviewer and Claim predicate

Approval is permitted only when all of the following are re-proved after the established locks:

1. The server-established transaction context resolves one current trusted principal; caller input cannot select the actor.
2. The principal is relationally `eligible` through `claim_security.current_privileged_actor_v1()`, with role exactly `owner|admin`, and the underlying facts independently remain coherent: active buyer-context profile, one supported active primary verified Firebase link mirror, exactly one effective supported role, matching current `platform_administration` access, and one current coverage-complete `clear` / `complete_clear` security assessment.
3. The principal equals the Claim's exact write-once `reviewer_user_profile_id`, differs from the claimant and assigning Owner, and `claim_security.target_supplier_conflict_v1(reviewer, supplier, claim) = clear`.
4. Reviewer assignment is coherent and unchanged: expected assignment version matches stored version `1`; source is `owner_assignment`; policy is `claim_reviewer_assignment_v1`; assignment actor/time are present; and assignment time is within `[submitted_at, expires_at)`.
5. The selected Claim is exactly `under_review`; its `record_version` equals `p_expected_claim_version`; and one post-lock `command_now` satisfies `command_now < expires_at`.
6. Immutable submission is coherent: `expires_at = submitted_at + interval '720 hours'`; `created_at = submitted_at`; snapshot version is `claimant_snapshot_v1`; fingerprint version is `claim_submit_v1` with a 64-character lowercase hexadecimal fingerprint; evidence schema is `claim_evidence_v1`; and no decision, withdrawal, expiry, supersession, or resulting-ownership field is already set.
7. The claimant remains approval-eligible: active Supplier-context profile with verified mirror; exactly one linked active primary verified Firebase identity mirror; and the current Firebase observation required by the approved gateway contract when a real gateway exists. Local SQL proves only the relational part with synthetic data.
8. The Supplier exists, has `listing_status = approved`, is not `verification_status = watchlist`, and has no unresolved eligibility/source/security contradiction.
9. The complete ownership history is coherent and the active `primary_controller` slot is empty.
10. Owner decision 1's registered high-assurance evidence method, exact source-class combination, version, `verified` outcome, and restricted non-file reference all pass. Unknown, unverified, inconclusive, file-dependent, malformed, or unsupported evidence denies.

The final-usable-Owner guard is not invoked because approval changes no role/access/security authority. It still shares the reviewer principal lock with any future eligibility-removing command.

## 4. Exact ownership insert mapping

| `public.supplier_ownerships` column | Approval value |
|---|---|
| `id` | Server-generated UUID |
| `supplier_profile_id` | Winning Claim `supplier_profile_id` |
| `controller_user_profile_id` | Winning Claim `claimant_user_profile_id` |
| `authority_type` | `primary_controller` |
| `ownership_status` | `active` |
| `valid_from` | Post-lock `command_now` |
| `valid_until` | `NULL` |
| `record_version` | `1` |
| `establishment_source_type` | `claim_approval` |
| `establishment_reason_code` | Owner decision 2 |
| `established_by_user_profile_id` | Effective assigned reviewer |
| `establishment_system_source` | `NULL`; this is an accountable human decision |
| `established_at` | `command_now` |
| all closure fields | `NULL` |
| `transfer_successor_ownership_id` | `NULL` |
| `created_at`, `updated_at` | `command_now` |
| `created_by_user_profile_id`, `updated_by_user_profile_id` | Effective assigned reviewer |

The ownership table has no Claim-source FK. Do not add a polymorphic source ID. The supported linkage is the winning Claim's unique `resulting_supplier_ownership_id` pointing to the new ownership, corroborated by the approval audit and `supplier_ownership.claim_approved` event.

The winning Claim changes once to `approved`, increments `record_version` by exactly one, stores the effective reviewer and trusted decision time, the approved decision/evidence/policy fields, keeps `reviewer_notes = NULL`, and sets `resulting_supplier_ownership_id` to the new ownership.

## 5. Competing Claim policy

The complete competing set is every other same-Supplier row whose stored status is `submitted` or `under_review`, with no limit. Due rows in either status are included: they have not yet been terminalized, approval is explicitly authorized to supersede the complete active-status set, and no approved contract requires `supplier_claim.expire` to run first.

| Same-Supplier status | Classification | Exact behavior |
|---|---|---|
| `submitted` | **SUPERSEDE** | Includes due rows; set `superseded`, `record_version + 1`, `superseded_at = command_now`, Owner decision 2 reason, and `superseded_by_claim_id = winning claim_id` |
| `under_review` other than winner | **SUPERSEDE** | Same behavior, including due rows; preserve immutable assignment provenance and do not add decision fields or reviewer notes |
| `rejected` | **PRESERVE** | Terminal and immutable |
| `withdrawn` | **PRESERVE** | Terminal and immutable |
| `approved` | **PRESERVE or CORRUPTION/BLOCK** | Preserve a coherent historical approval. If it proves an active owner, approval blocks as already owned; missing/mismatched ownership provenance or contradictory state fails integrity reconciliation |
| `superseded` | **PRESERVE** | Terminal and immutable |

Every superseded competitor is updated in ascending Claim UUID order and increments exactly once. The successor link is restrictive and points only to the winning approved Claim. Internal supersession has no separate public command or idempotency row.

## 6. Deterministic lock order and one-winner proof

Use the existing `claim_principal_lock_key_v1` and shared `claim_supplier_lock_key_v1` architecture:

1. trusted ingress validation, then durable Phase-A idempotency reservation/fence;
2. Phase-B lock and validate the idempotency row, including current fence/attempt;
3. transaction advisory locks for reviewer and winning claimant in ascending UUID order;
4. the common Supplier transaction advisory lock;
5. reviewer/claimant profiles in UUID order, provider links in row-ID order, then reviewer role/access/security rows in stable table/row-ID order;
6. Supplier row and eligibility facts;
7. every Supplier ownership row in ascending ownership UUID order;
8. the union of the winning Claim and every other `submitted|under_review` same-Supplier Claim in ascending Claim UUID order, with no cap;
9. approval evidence, conflict, quarantine, and hold facts in stable owner/table/key order;
10. capture one `command_now`, validate, allocate effects, write audit/events, and complete the fenced idempotency result atomically.

The Supplier lock precedes ownership and Claim rows, serializing an empty ownership slot and the complete Claim set. It proves that two approvals, another ownership creator, submit, withdraw, reject, or expire for the same Supplier cannot concurrently commit incompatible results. Sorted principal and row locks prevent order inversion; uniqueness constraints remain final guards, not the locking design.

## 7. Idempotency fingerprint and replay envelope

The command is `supplier_claim.approve`, contract version `1`, target Claim UUID, human principal binding, and current environment. Its minimum versioned canonical fingerprint contains:

- Claim UUID, expected Claim version, and expected assignment version;
- evidence method/version/outcome;
- normalized, deduplicated, deterministically ordered checked-source classes;
- a versioned digest of the canonical restricted evidence reference, never the raw reference in `internal.idempotency_keys`;
- a fixed reviewer-notes null marker; and
- the selected approval, evidence, authorization, digest, and supersession policy/registry versions.

It excludes the raw idempotency key, auth token, transport headers, correlation ID, retry count, trusted time, generated IDs, derived actor/role/target facts, competitor IDs/count, and response presentation fields.

Successful completion binds `outcome_code = approved`, `result_resource_type = supplier_ownership_claim`, the winning Claim UUID, and the committed winning Claim version token. Completed replay re-applies current response authorization and must prove, without writing:

1. the winner is the exact coherent approved Claim at the bound version;
2. its resulting ownership exists, matches Supplier/controller/provenance, and is the only active primary ownership;
3. the exact superseded competitor set is represented by contiguous approval event ordinals `2..N`, each event is produced by the same idempotency row, and each referenced Claim has the matching committed version and successor link to the winner;
4. exactly one primary success audit matches actor, Claim, Supplier, ownership, prior/result version, evidence binding, primary event, and superseded count;
5. ordinal `1` is the exact approved event, with no missing, duplicate, extra, misordered, or mismatched approval-produced event; and
6. the idempotency row's command, environment, actor, target, fingerprint, outcome, resource, and version binding all agree.

Thus the competitor-set replay binding is already fixed by the approved event ordinals plus aggregate rows and successor links; no additional Owner decision or Claim-local replay table is needed. Missing, partial, duplicate, mismatched, or contradictory state fails closed with `integrity_reconciliation_required`. Replay creates no ownership, transition, audit, event, notification, or version increment.

The safe result is the established fixed envelope plus `ownership_id`, `decided_at`, and integer `superseded_claim_count`; it exposes no competitor identity, evidence/reference, reviewer identity/notes, audit/event/idempotency internals, provider subject, or unrestricted row.

## 8. Audit and domain events

The fixed success audit boundary is exactly one primary `supplier_claim.approve` action, contract version `1`, action class `claim_ownership`, retention class `claim_ownership_decision`, human reviewer actor, `succeeded` outcome, and `approved` result. It includes the winning Claim, Supplier, ownership, actor role/assignment/policy snapshot, prior/result state and versions, approved evidence method/version/outcome and restricted reference/digest, superseded count without competitor identities, correlation, idempotency reference, and primary event reference. Owner decision 2 must fix the bounded reason code; implementation-owned audit evidence-schema labels may then version this already-fixed shape.

The exact event effects are:

1. ordinal `1`: `supplier_ownership.claim_approved`, schema version `1`, aggregate `supplier_ownership_claim`, aggregate ID = winning Claim, aggregate sequence = committed winning Claim version; payload only Claim ID, Supplier ID, claimant profile ID, ownership ID, and committed Claim version;
2. ordinals `2..N`: one `supplier_ownership.claim_superseded`, schema version `1`, per competitor in ascending Claim UUID order; each competitor is its own aggregate and its committed version is the aggregate sequence; payload only superseded Claim ID, Supplier ID, claimant profile ID, approved Claim ID, and committed version.

No separate ownership-established event is approved. The approved Claim event contains the ownership ID and is the sole winning integration fact. There is no per-competitor audit; the primary audit stores only the count. Audit/event/idempotency or any aggregate write failure rolls back the complete Phase-B transaction.

## 9. Notification, RLS, grant, and write boundary

- `supplier_claim.approve` inserts no notification.
- MSG-003 materializes protected claimant-only `in_app` notifications asynchronously from the committed approved and superseded events, deduped by `(domain_event_id, recipient_user_profile_id, channel)`.
- `public.supplier_ownership_claims` remains at exactly three `SELECT` policies: claimant self, Owner assignment queue, and exact assigned reviewer. It remains at zero mutation policies.
- No generic Claim `UPDATE`, ownership `INSERT`, standalone supersede, or audit writer is exposed.
- `PUBLIC`, `anon`, browser `authenticated`, generic `service_role`, and unlisted roles receive no trusted mutation authority or internal-table access. The local command follows the existing narrowly granted runtime/private-executor pattern; local `postgres` function ownership is not hosted least-privilege proof.
- Firebase remains Production authority. Supabase remains local-only and synthetic-data-only.

## 10. Material Owner decisions

### Decision 1 أ¢â‚¬â€‌ approval high-assurance evidence registry

**Unresolved question:** Which exact approval method/version, checked-source-class combinations, restricted-reference shape, evidence policy/digest versions, and affirmative tuple satisfy the already-approved high-assurance paths?

**Existing evidence:** The contracts require one reviewed high-assurance path and only a registered `verified` outcome. Reject v1 approved `manual_review / claim_evidence_review_v1 / verified|not_verified` for rejection semantics, but no contract authorizes that tuple for ownership creation. The schema constrains shapes, not meaning.

**Option A:** Reuse `manual_review / claim_evidence_review_v1 / verified` for approve, but add one approval-only allowlist that requires a normalized source-class combination proving exactly one of the three approved paths, plus one required opaque non-file restricted reference and server-derived digest.

**Option B:** Introduce distinct approval method/version tuples for official-registry plus claimant authority, authorized-officer confirmation, and company-domain challenge plus independent corroboration, each with its own exact source combination and the same bounded non-file reference/digest boundary.

**Recommendation:** Option A for v1. It minimizes caller and registry surface while the checked-source combination, not a generic `manual_review` label alone, proves the approved high-assurance path. Unknown combinations fail closed. SQL cannot select it silently because reusing a reject-approved evidence tuple to create ownership materially broadens that tuple's authority.

### Decision 2 أ¢â‚¬â€‌ approval, establishment, and supersession reason registry

**Unresolved question:** Which exact server-derived reason literals and registry/policy version bind the winning Claim decision, ownership establishment, primary audit, and competitor supersessions?

**Existing evidence:** `claim_approval`, `approved`, and the event names/versions are fixed. The ownership schema requires `establishment_reason_code`; the Claim schema requires decision and supersession reason codes; and the approved atomicity contract explicitly defers the bounded approval and supersession reason registry to the approve slice.

**Option A:** Approve one generic verified-Claim reason for the winning Claim/ownership/audit and one generic competing-Claim-approved reason for every superseded Claim, under one approval reason registry version.

**Option B:** Use evidence-path-specific approval/establishment reasons while retaining one generic competing-Claim-approved supersession reason.

**Recommendation:** Option A. Evidence path and source classes already belong in restricted decision/audit evidence; duplicating them into ownership reason codes would couple long-lived authority history to verification mechanics. SQL cannot invent required reason literals because they become durable Product/Data semantics and replay-integrity inputs.

These are the only material blockers. Exact SQL function-owner mechanics, audit context-schema labels, canonicalization code, UUID allocation, and error-to-SQLSTATE mapping remain technical implementation choices constrained by existing command conventions, not Owner decisions.

## 11. Required future tests

After both decisions are approved, the SQL PR must add focused proof for:

- exact signature, canonical evidence allowlist, normalization, bounds, non-file reference, fingerprint, and same-key replay/conflict;
- complete reviewer/claimant/Supplier/ownership/Claim eligibility and immutable-shape checks;
- ownership mapping, winning transition, zero/one/many competitors, due competitors, every requested terminal status, version increments, successor links, and no competitor cap;
- two approvals, approval versus ownership creation, submit, withdraw, reject, and expiry, plus reviewer/claimant eligibility loss under the shared locks;
- completed replay and corruption of winner, ownership, competitor set, audit, event ordinal/sequence/payload, and idempotency binding;
- audit/event/idempotency failure rollback and zero notification writes; and
- exact three-SELECT/zero-mutation Claim RLS inventory, direct Claim/ownership write denial, grants, safe result fields, and sensitive-value scans.

## 12. Open gates, impact, and stop point

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

Production/data impact is none. This review reads repository evidence and creates one Markdown file only. It performs no Firebase or hosted Supabase action, Production/TEST read or write, SQL migration, seed, backfill, deployment, DNS, billing, Auth/config, RLS/grant, notification, or file operation.

Exact stop point: readiness document, minimal two-decision blocker list, static validation, commit, push, one Draft PR, and PR Gate result if available. Stop before approve SQL, expire work, Baseline synchronization, merge, deployment, hosted action, or data movement.

## References

- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md`](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [`39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md`](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [`42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md`](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [`46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md`](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [`55_PRIVILEGED_ACTOR_ACCESS_AND_SECURITY_ELIGIBILITY_READINESS.md`](55_PRIVILEGED_ACTOR_ACCESS_AND_SECURITY_ELIGIBILITY_READINESS.md)
- [`61_REVIEWER_PRIVATE_READ_SUBSTRATE_IMPLEMENTATION_EVIDENCE.md`](61_REVIEWER_PRIVATE_READ_SUBSTRATE_IMPLEMENTATION_EVIDENCE.md)
- [`65_REJECT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`](65_REJECT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
- [`20260808000400_supplier_ownerships_foundation.sql`](../../supabase/migrations/20260808000400_supplier_ownerships_foundation.sql)
- [`20260809000200_supplier_ownership_claims_foundation.sql`](../../supabase/migrations/20260809000200_supplier_ownership_claims_foundation.sql)
- [`20260812000100_assign_reviewer_trusted_command.sql`](../../supabase/migrations/20260812000100_assign_reviewer_trusted_command.sql)
- [`20260812000200_reject_trusted_command.sql`](../../supabase/migrations/20260812000200_reject_trusted_command.sql)
