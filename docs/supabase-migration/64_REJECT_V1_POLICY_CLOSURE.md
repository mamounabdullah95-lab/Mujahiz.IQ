# `supplier_claim.reject` v1 policy closure

Status: **Owner-approved — implementation-ready for a separately scoped LOCAL reject-v1 SQL implementation; no SQL, hosted, Firebase, Production, or deployment action is authorized by this approval.**

Date: 2026-08-12

Approval date: 2026-08-12

Primary task profile: Documentation

## 1. Scope and verified starting point

This documentation-only closure records the Owner-approved minimal Option A direction from [reject trusted-command readiness](63_REJECT_TRUSTED_COMMAND_READINESS.md): one minimal rejection registry, evidence verification for every successful rejection, no reject-v1 reviewer notes, and generic claimant-safe disclosure. It fixes the immutable v1 literal set for a later, separately scoped local-only implementation. It does not reopen those four direction choices.

The exact starting `origin/main` SHA is:

```text
924a8fbb7e0da217aff6a327aec0d1311ba4e27c
```

It is the merge of PR #124. PR #124's reviewed implementation commit `d44242c` is an ancestor of this SHA.

## 2. Compatibility findings

- The Claim structural decision seam already retains one reason code, evidence method/version/outcome, authorization-policy version, and nullable `reviewer_notes`; its current constraints accept the proposed lexical shapes and permit `reviewer_notes = NULL`.
- The implemented `submit` path permits a linked prior rejected Claim only when its stored reason is `insufficient_evidence`, `claimant_ineligible`, or `supplier_mismatch`. The Reviewer prior-context helper has the same three-code allowlist and returns only `not_approved`. Therefore the first three proposed mappings are compatible. `existing_owner` is deliberately absent from that allowlist, so it cannot enter the current resubmission path.
- The Claimant projection already maps every rejected Claim to `not_approved` without reading restricted decision fields. This is compatible with the proposed disclosure mapping. MSG-003 independently requires the rejected event to carry only a bounded internal reason code/version and gives the later materializer the claimant-safe mapping boundary.
- AUD-001 permits a restricted evidence descriptor/reference and digest while excluding copied Claim evidence and reviewer notes. FILE-001 remains open: this proposal has no managed-file, upload, attachment, Storage, signed-URL, or custody dependency.

## 3. Exact internal reason registry

The sole reject-v1 reason-registry identifier is:

```text
claim_rejection_reason_v1
```

Its complete allowlist is exactly:

```text
insufficient_evidence
claimant_ineligible
supplier_mismatch
existing_owner
```

No other reason is accepted. An unknown, unsupported, corrupt, or version-mismatched reason/registry fails closed and cannot terminalize a Claim.

`claim_rejection_reason_v1` is the approved v1 literal. The repository establishes the versioned `claim_*_v1` convention.

## 4. Exact resubmission mapping

| Internal reason | Resubmission through `prior_claim_id` | Basis |
|---|---:|---|
| `insufficient_evidence` | Permitted | Existing implemented allowlist |
| `claimant_ineligible` | Permitted | Existing implemented allowlist |
| `supplier_mismatch` | Permitted | Existing implemented allowlist |
| `existing_owner` | Not permitted while the ownership condition remains unresolved | Existing allowlist excludes it; a current owner is not a correctable resubmission condition by itself |

The later reject implementation must not silently add `existing_owner` to the existing submit/prior-context allowlists. If a later Owner-approved workflow allows a resubmission after the ownership condition is independently resolved, that is a separate versioned policy and implementation decision.

## 5. Evidence-verification registry

Every successful reject requires exactly one registered tuple. The smallest proposal reuses existing evidence vocabulary where it exists:

| Reason | Method code | Method/version | Outcome code |
|---|---|---|---|
| `insufficient_evidence` | `manual_review` | `claim_evidence_review_v1` | `not_verified` |
| `claimant_ineligible` | `manual_review` | `claim_evidence_review_v1` | `verified` |
| `supplier_mismatch` | `manual_review` | `claim_evidence_review_v1` | `verified` |
| `existing_owner` | `manual_review` | `claim_evidence_review_v1` | `verified` |

The method, method/version, and two outcome values are already present in Claim fixtures and the structural seam. Their use as this exhaustive reject-v1 tuple registry is Owner-approved.

The evidence-policy version is exactly:

```text
claim_reject_evidence_policy_v1
```

Only the four tuples above are allowed under that policy. `verified` means the reviewer verified a bounded basis that supports the selected non-insufficiency reason; it does not mean the Claim should be approved. `not_verified` is allowed only for `insufficient_evidence` and records the verified failure of the required evidence basis. It is not an inconclusive outcome.

### Restricted-reference and digest rule

For every successful reject, the caller supplies one required bounded non-file `restricted_evidence_reference`; the server canonicalizes it and derives the fingerprint projection. The audit/event boundary may retain only the following restricted evidence tuple:

```text
restricted_evidence_reference: 1..256 UTF-8 bytes; opaque bounded reference, never a URL, path, query, credential, file ID, Storage object, attachment ID, or evidence content
evidence_digest_algorithm: sha256
evidence_digest_version: claim_reject_evidence_digest_v1
evidence_digest: exactly 64 lowercase hexadecimal characters, computed server-side from the canonical restricted-reference projection
```

`claim_reject_evidence_digest_v1` is the approved v1 digest-version literal. The exact shape remains as specified above and is immutable for v1.

## 6. Claimant-safe disclosure

The proposed v1 mapping is exact:

| Internal state | Claimant-safe result |
|---|---|
| Any supported reason in `claim_rejection_reason_v1` | `not_approved` |
| Unknown, unsupported, corrupt, or version-mismatched registry state | `result_unavailable` |

No claimant result, Claimant projection, notification, or error exposes an internal reason, reviewer identity, evidence result/reference/digest, conflict/security condition, current-owner identity, or reviewer notes. The existing Claimant projection's status-only `rejected -> not_approved` behavior remains compatible. The future MSG-003 materializer must use this mapping and still emits no direct notification from the reject command.

## 7. No-notes rule

Reject v1 accepts no reviewer-note parameter. On every successful reject, `reviewer_notes` remains `NULL`; no note digest, null marker, normalization rule, or note policy is included in the request fingerprint. This is compatible with the existing nullable structural column and its decision-shape constraint. A later notes capability requires a separately approved versioned policy and command change.

## 8. Approved future business-call signature

**Owner-approved policy record; not an implemented SQL signature:**

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

The business caller inputs are exactly the parameters shown. The caller supplies no digest: its use is server-derived so an untrusted caller cannot choose it. The raw idempotency key is accepted only at the trusted boundary and retained only as the established HMAC digest.

Server-derived values include the effective actor and all authority/conflict checks; claimant and Supplier IDs; Claim assignment provenance; one trusted decision time; the registry/evidence/disclosure/authorization policy versions; the canonical restricted-reference digest and keyed fingerprint digest; resulting Claim version; safe result; audit/event identifiers; and notification materialization values.

The internal hand-off values are the existing Phase-A reservation result, scope/target/actor/key digests, canonical request fingerprint, lease attempt and expiry, and Phase-B execution fence. They are not business caller inputs and must not be externally callable.

## 9. Exact canonical fingerprint components

The canonical reject-v1 fingerprint contains exactly:

```text
claim_id
expected_claim_version
expected_reviewer_assignment_version
rejection_reason_code
claim_rejection_reason_v1
evidence_verification_method_code
evidence_verification_version
evidence_verification_outcome_code
claim_reject_evidence_policy_v1
server-derived keyed digest of the canonical restricted_evidence_reference/digest tuple
claim_reject_evidence_digest_v1
claimant disclosure mapping version: claim_reject_disclosure_v1
decision authorization policy version
```

`claim_reject_disclosure_v1` is the approved v1 disclosure-mapping literal. The raw key, correlation ID, authentication headers/tokens, retry count, server time, actor/role facts, generated IDs, audit/event IDs, notification values, raw restricted reference, raw evidence, and reviewer notes are excluded.

## 10. Audit and event implications

On one successful transaction, the later command must retain the readiness-record boundary: one Claim transition `under_review -> rejected` with one record-version increment; one required AUD-001 primary success audit; one `supplier_ownership.claim_rejected` v1 event (ordinal 1, committed Claim version); and fenced idempotency completion. It writes no ownership, competitor, assignment, notification, or direct claimant-disclosure row.

The success audit records the bounded reason registry/version, evidence method/version/outcome, evidence-policy version, and only the permitted restricted-reference/digest tuple. It copies neither Claim evidence nor reviewer notes. The event retains only the previously approved bounded internal reason code/version; its consumer maps it to `not_approved`. Post-auth rejected/conflicted/failed attempts retain the AUD-001 minimized-denial boundary; unknown or corrupt registry evidence fails closed and does not produce a success event.

## 11. Open gates and Production/data impact

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

Production/data impact: **none**. This policy closure used local repository and Git ancestry evidence only. It performed no Firebase or hosted Supabase access; no Production/TEST data action; and no SQL, migration, RLS/grant, runtime, gateway, notification, Auth/configuration, deployment, seed, backfill, DNS, billing, or file action.

## 12. Owner-approved immutable v1 policy record

> **Owner approval recorded on 2026-08-12.** The Product/Data/Security Owner explicitly approved the complete Reject v1 Policy Closure package documented in PR #125. The following values are the immutable approved v1 policy record. A later SQL implementation must preserve them exactly.
>
> - Reason registry/version: `claim_rejection_reason_v1`.
> - Exact reasons: `insufficient_evidence`, `claimant_ineligible`, `supplier_mismatch`, `existing_owner` — and no others.
> - Resubmission: permitted only for `insufficient_evidence`, `claimant_ineligible`, and `supplier_mismatch`; `existing_owner` is not permitted while its ownership condition remains unresolved.
> - Evidence-policy version: `claim_reject_evidence_policy_v1`.
> - Exact evidence tuples: (`manual_review`, `claim_evidence_review_v1`, `not_verified`) only for `insufficient_evidence`; (`manual_review`, `claim_evidence_review_v1`, `verified`) only for `claimant_ineligible`, `supplier_mismatch`, and `existing_owner`.
> - Restricted-reference/digest literals and shape: `sha256`; `claim_reject_evidence_digest_v1`; one required opaque non-file 1–256-byte `restricted_evidence_reference`; exactly 64 lowercase hexadecimal server-derived digest; no URL/path/query/credential/file/object/attachment/content.
> - Disclosure mapping/version: `claim_reject_disclosure_v1`; every supported reason -> `not_approved`; unknown/unsupported/corrupt/version-mismatched state -> `result_unavailable`.
> - No reviewer-note input; `reviewer_notes = NULL`; no note digest/null marker in the fingerprint.
> - Business-call signature and fingerprint components in sections 8 and 9.

## 13. Exact stop point

Stop after recording this Owner approval. Do not implement SQL, create a migration, alter RLS/grants/runtime, access hosted systems, write data, merge, deploy, or resolve any Open gate. The next action is one separately scoped local-only reject implementation task that preserves this immutable approved v1 policy record.

## References

- [Reject trusted-command readiness](63_REJECT_TRUSTED_COMMAND_READINESS.md)
- [Claim v1 trusted-command contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [AUD-001 audit contract](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [MSG-003 notification contract](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [Claim structural and command readiness](41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md)
- [Reviewer private-read evidence](61_REVIEWER_PRIVATE_READ_SUBSTRATE_IMPLEMENTATION_EVIDENCE.md)
- [Assign-reviewer implementation evidence](62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
