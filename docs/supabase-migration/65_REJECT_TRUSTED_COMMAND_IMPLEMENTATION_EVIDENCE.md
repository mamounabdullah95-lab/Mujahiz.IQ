# `supplier_claim.reject` v1 — Implementation Evidence

Date: 2026-08-12
Branch: `codex/reject-trusted-command`
Scope: local PostgreSQL and synthetic data only

## Baseline and boundary

Starting `main` and `origin/main` were `6b67f3195be21c9f32ee7484f8e8821d48e602e7`. PR #125 reviewed head `4b3a1779b79571be7cf4bce0576b60e3048f4e3a` remained an ancestor. The readiness review found no implementation-only blocker. This change implements only the fourth approved Claim-v1 business mutation, `supplier_claim.reject`; approve and expire remain absent.

## Approved policy and command

The exact approved literals are `claim_rejection_reason_v1`, `claim_reject_evidence_policy_v1`, `claim_reject_evidence_digest_v1`, and `claim_reject_disclosure_v1`.

The four reasons and exact evidence tuples are:

- `insufficient_evidence` → `manual_review / claim_evidence_review_v1 / not_verified`
- `claimant_ineligible` → `manual_review / claim_evidence_review_v1 / verified`
- `supplier_mismatch` → `manual_review / claim_evidence_review_v1 / verified`
- `existing_owner` → `manual_review / claim_evidence_review_v1 / verified`

Resubmission remains allowed only for the first three reasons; `existing_owner` remains excluded.

The business signature is:

```text
supplier_claim.reject(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_expected_reviewer_assignment_version integer,
  p_rejection_reason_code text,
  p_evidence_verification_method_code text,
  p_evidence_verification_version text,
  p_evidence_verification_outcome_code text,
  p_restricted_evidence_reference text,
  p_correlation_id uuid default null
)
```

## Authorization, state, locking, and writes

The reviewer is derived only from trusted transaction-local Claim context. Under deterministic locks and post-lock rereads, the principal must be the assigned reviewer, distinct from the claimant, have exactly one usable current Owner/Admin role, exact role-backed platform-administration access, supported clear security eligibility and identity state, coherent assignment provenance, and an exactly-clear target-Supplier conflict result.

The target must be a coherent, non-due `under_review` Claim with the expected Claim and assignment versions. The transition is exactly `under_review → rejected`, with `record_version +1`. Assignment provenance remains unchanged, `reviewer_notes` remains `NULL`, and only the target Claim decision fields are written. No ownership is created, no competitor Claim is mutated, and no notification is inserted.

Lock order follows the existing Claim-v1 protocol: Phase-A idempotency reservation/fence; sorted reviewer and claimant principal locks; Supplier advisory lock; reviewer/claimant identity and authority rows; Supplier and ownership rows; target Claim; implemented conflict facts; one trusted command time; validation; atomic write set.

The restricted evidence reference is required, opaque, non-file, and 1–256 UTF-8 bytes. URLs, paths, queries, credentials, file IDs, Storage/object references, attachment IDs, whitespace, and control forms are rejected. The server derives the exact 64-character lowercase SHA-256 digest under `claim_reject_evidence_digest_v1`; callers cannot supply a digest or reviewer note.

## Idempotency and replay integrity

Phase A reserves, replays, or reclaims an expired lease with a rotated opaque fence. Phase B requires the current fence and exact keyed request fingerprint. Completed replay proves the Claim, complete success-audit envelope, exact `supplier_ownership.claim_rejected` event, idempotency binding, and server-derived evidence binding. Missing, duplicate, incomplete, misclassified, version-mismatched, or contradictory evidence fails closed with `P5199 / integrity_reconciliation_required`. Terminal denial replay validates both failure code and outcome class. Replay creates no new mutation, audit, event, or notification.

## Audit, event, and disclosure boundary

Success persists exactly one minimized `supplier_claim.reject` v1 audit with `claim_ownership_decision` retention, the approved safe context, changed-field envelope, and permitted restricted-reference/digest tuple. Required audit failure returns `P5116 / audit_unavailable`; event and idempotency-completion failures roll back Phase B.

Success emits exactly one `supplier_ownership.claim_rejected` v1 event, ordinal 1, with aggregate sequence equal to the committed Claim version. Its payload is limited to Claim ID, Supplier ID, claimant ID, committed version, rejection reason, and reason-registry version. It contains no reviewer identity, evidence tuple, reference, digest, PII, provider identity, audit/idempotency data, or notification copy. Disclosure remains asynchronous under `claim_reject_disclosure_v1`: supported reasons map to `not_approved`, while corrupt or unsupported state maps to `result_unavailable`.

## Validation evidence

- Focused Reject pgTAP: **105/105 passed**.
- True multi-session concurrency: **9 race scenarios, 14/14 checks passed**.
- Full local SQL validator: **27 migrations, 27 test files, 1,978/1,978 assertions passed, 0 failures**.
- `git diff --check`: passed.
- Catalog assertions: **24 physical tables, exactly 3 Claim SELECT policies, 0 Claim mutation policies**; runtime has no direct Claim UPDATE; approve and expire remain absent.
- Static closure found no notification write, ownership write, competitor-Claim mutation, dynamic SQL, raw idempotency-key storage, or private event-payload leak in the new migration.

No implementation SQL, test, or harness content changed after those recorded validation results; only this evidence document was added afterward.

## Open gates, risk, and impact

The seven Open gates remain exactly: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, `MIG-002`.

The implementation is local-only and uses synthetic data. No Firebase, hosted Supabase, Production/TEST data, deployment, remote migration, seed, backfill, Auth/config, DNS, billing, or file operation occurred. Local SECURITY DEFINER ownership remains `postgres`; this is not hosted least-privilege proof. Approve, expire, hosted behavior, Firebase behavior, and Production behavior remain out of scope.
