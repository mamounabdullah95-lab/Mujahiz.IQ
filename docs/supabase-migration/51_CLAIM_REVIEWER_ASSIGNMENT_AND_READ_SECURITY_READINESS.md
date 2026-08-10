# Claim v1 Reviewer assignment and private-read security readiness

Status: **documentation-only readiness contract; no SQL, RLS, RPC, runtime, grant, data, hosted, Firebase, or Production change**

Primary task profile: `DOCUMENTATION`

Repository: `mamounabdullah95-lab/Mujahiz.IQ`

Verified start: refreshed `origin/main` at `fce7a0b3b0f8c5f8f130d91b16f748b6d9f2966c` (merge of PR #103)

Branch: `codex/claim-reviewer-path-readiness`

## 1. Finding and hard boundary

The Claim aggregate already contains the minimum durable assignment seam: one nullable reviewer, assignment version, assigning actor, assigned time, source, and policy version. Its lifecycle constraint permits `submitted -> under_review` only with a complete assignment shape, and the approved Claim-v1 command contract makes that assignment write-once, with no reassignment and no Owner override.

The Reviewer path is **not yet safe to implement as `supplier_claim.assign_reviewer` alone**. Assignment grants access to private Claim content, so the complete usable-privileged-actor resolver, conflict resolver, field-minimized Owner/reviewer read surfaces, RLS/object-grant boundary, and their denial tests must exist first. In addition, the approved usable-actor predicate still depends on role-backed platform-administration access and security deny/hold evidence that are not implemented. A `platform_role_assignments` row by itself must never be treated as enough.

The minimum safe order is therefore:

1. complete the existing approved privileged-actor/access/security dependency needed to return a conclusive usable result;
2. implement and test the Owner assignment queue/candidate surface and assigned-reviewer queue/detail substrate with synthetic assigned rows;
3. implement `supplier_claim.assign_reviewer` against exactly those same helpers and policies; and
4. implement approve/reject only in later separately reviewed slices.

This document designs those boundaries. It does not implement or authorize them, resolve an Open gate, enable real rows, or make Supabase a hosted or Production Claim authority.

## 2. Exact usable privileged-human predicate

The effective human principal is always `public.user_profiles.id` returned by the trusted, transaction-local Claim context. The caller never supplies the assigner/decision actor, a Firebase UID, a provider-link ID, a role code, or an authorization result.

### 2.1 Common identity and profile predicate

At trusted ingress, and again where relational facts are re-read under the command transaction, a privileged actor is usable only when all of the following are true under one policy version:

| Source | Required current condition | Conditions that deny |
|---|---|---|
| Firebase ingress | Valid signature, issuer, audience/project, expiry, and exact subject; current Firebase Admin lookup in the same authorization attempt; account exists, is not disabled, and is email-verified | Missing/expired token, not-found/deleted or disabled account, unverified account, provider outage, lookup failure, token/current-user disagreement, or stale cached observation |
| `internal.identity_provider_links` | Exactly one linked Firebase subject resolves to the principal; that row is the active primary link with `provider_code = 'firebase'`, `link_status = 'linked'`, `is_primary = true`, `identity_status = 'active'`, and `verification_status = 'verified'`; its observation/policy agrees with ingress | Missing, multiple, non-primary, unlinked, disabled, unverified, stale, historically contradictory, or differently mapped link |
| `public.user_profiles` | Exact resolved row exists with `account_status = 'active'`, `account_context = 'buyer'`, and a current consistent `verification_mirror_status = 'verified'` | Missing row; `suspended` or `deactivated`; Supplier/unknown context; unknown/unverified or contradictory mirror |
| `public.platform_role_assignments` | Exactly one effective row has `assignment_status = 'active'`, `valid_from <= command_now`, and (`valid_until is null` or `command_now < valid_until`); its role is expressly allowed by the command | Missing, duplicated/overlapping, future, expired-by-time, revoked, expired, superseded, structurally inconsistent, or disallowed role |
| Role-backed administration access | One current platform-administration grant exists and agrees with the role assignment | Missing, inactive, expired, or contradictory access |
| Security/reconciliation | No current security deny, hold, quarantine, unresolved identity conflict, or contradictory authority evidence | Missing evidence needed to conclude, conflict, hold, deny, quarantine, or authority disagreement |

`user_profiles.legacy_role`, `legacy_account_type`, `legacy_organization`, email/domain, account context, Firebase custom role text, and `security_eligibility_reference` do not grant privilege. The last field is only a bounded reference and has no approved clear/deny vocabulary. The currently unimplemented `public.access_grants` and security deny/hold representation remain non-gate delivery prerequisites for any positive real usable-actor result.

### 2.2 Assigner

The assigner must satisfy the common predicate with the one effective role exactly `owner`. An `admin` cannot assign. The command also requires:

- assigner profile is derived only from `claim_security.current_claim_user_profile_id()`;
- assigner and reviewer candidate are distinct;
- the target-Supplier conflict resolver returns `clear`, not `conflict` or `unknown`, for every command-required assigner check;
- the Claim remains visible only through the minimized Owner assignment surface; assignment authority does not grant private Claim detail; and
- assigning a reviewer does not invoke the final-usable-Owner guard because it changes no role/access/profile/link fact, but it must share the same versioned principal-authority lock namespace used by future eligibility-changing commands.

### 2.3 Reviewer candidate at assignment

The supplied `reviewer_user_profile_id` is only a candidate identifier. Under lock, the command must resolve that UUID to a distinct human who:

- satisfies the full common predicate;
- has exactly one effective role of `owner` or `admin`;
- is not the assigner;
- is not `claimant_user_profile_id`;
- is not a conflicting controller/member/admin/delegate or otherwise held/conflicted under section 3; and
- is not already represented by any complete or partial assignment on the Claim.

The candidate list is advisory. A candidate appearing in it never authorizes assignment; `assign_reviewer` repeats the complete predicate and conflict checks after deterministic locks.

### 2.4 Assigned reviewer on every later read or decision

Durable assignment is necessary but never sufficient. On every reviewer queue/detail request and later approve/reject attempt, the principal must:

- satisfy the full common predicate at the current request/command time;
- match `reviewer_user_profile_id` on the exact Claim;
- match the Claim's current `reviewer_assignment_version` and supported assignment-policy version;
- have an effective `owner|admin` role currently, even if the role differs from the assignment-time role;
- face an exact `under_review`, structurally coherent, unexpired Claim for review access;
- still be distinct from the claimant and conflict-free for the target Supplier; and
- have no security hold, deny, identity conflict, or unknown conflict coverage.

If any fact becomes unusable after assignment, read and decision access stop immediately. The assignment stays as immutable provenance; Claim v1 does not reassign or override it. The claimant may still withdraw before expiry, and the expiry worker may terminalize it when due.

## 3. Conflict model

The conflict check is a tri-state result: `clear`, `conflict`, or `unknown`. Only `clear` authorizes assignment, reviewer read, approval, or rejection. It returns a bounded boolean/code to authorization logic and never exposes the relationship record, person, provider subject, or investigation reason to a client projection.

### 3.1 Implemented conflict evidence

The current schema can prove only these target-specific conflicts:

1. **Claimant conflict:** candidate `user_profiles.id = supplier_ownership_claims.claimant_user_profile_id`.
2. **Self-assignment:** candidate `user_profiles.id =` the server-derived assigning Owner.
3. **Current primary-controller conflict:** a `public.supplier_ownerships` row for the Claim's Supplier has `authority_type = 'primary_controller'`, `ownership_status = 'active'`, and is effective at `command_now`, with `controller_user_profile_id` equal to the actor/candidate.
4. **Proposed-controller conflict:** another active `public.supplier_ownership_claims` row for the target Supplier has `status in ('submitted', 'under_review')` and `claimant_user_profile_id` equal to the actor/candidate. The target Claim's own claimant case is already denied by item 1; this additional check covers a candidate pursuing a competing Claim for the same Supplier.
5. **Contradictory Claim/ownership integrity:** multiple effective active controllers, incoherent intervals/status, malformed active Claim assignment state, or an ownership/Claim binding mismatch is `unknown`/integrity failure, never clear.

The Claim's claimant is the proposed controller on approval, so the claimant check also prevents the reviewer from reviewing their own proposed ownership. Supplier profile creator/updater IDs, profile source fields, contacts, legacy organization text, email domain, account context, or prior activity are not membership/controller evidence.

### 3.2 Future unavailable evidence

The repository intentionally has no implemented Supplier membership, Supplier admin/delegate, organization, or organization-membership table. It also has no implemented general conflict/recusal relation or security-hold/deny relation. Therefore:

- do not invent an organization/member table or infer membership from legacy/profile/contact text;
- `supplier_memberships` remains a future concept for active Supplier admins/delegates, not a current table;
- ORG-001/ORG-002 do not become Claim authority or implicit conflict sources;
- when a future authoritative membership/delegation relation exists, active target-Supplier membership/admin/delegation must join the resolver and conflict immediately; and
- a real environment that permits such relationships outside the current relational authority cannot interpret missing relational rows as clear. Missing coverage is `unknown` and denies.

While the current local-only authority has no mechanism capable of creating a membership/delegation relationship, focused synthetic work may test the implemented subset. That local result is not evidence that a hosted or migrated human has no external relationship. Hosted activation requires an authority manifest and conflict coverage that conclusively accounts for every relationship model enabled in that environment.

### 3.3 Conservative fail-closed behavior

The resolver returns `unknown` when a required relation/helper is absent, current provider/access/security evidence cannot be read, an enabled relationship authority is outside coverage, data is duplicated or contradictory, or the conflict policy version is unsupported. `unknown` has the same authorization outcome as `conflict`, while its internal audit/telemetry code remains restricted.

No fallback may use Firestore role text, email/domain, `legacy_organization`, Supplier contacts, a browser assertion, or the fact that a table is empty to turn `unknown` into `clear`.

## 4. Minimum Reviewer visibility

Assignment creates no global reviewer role and no global Admin/Owner Claim browser. All reads use fixed typed projections; no `select *`, generic JSON row, arbitrary filter, caller-selected columns, or generic “admin mode” is permitted.

### 4.1 Owner assignment queue

A minimal Owner queue is required if assignment is exposed through an operator UI; otherwise the Owner would need an unsafe generic Claim browser or guessed Claim IDs. Only a usable, conflict-clear Owner may call it. It contains only unexpired, structurally coherent `submitted` Claims whose six assignment fields are all null.

Exact row projection:

- `claim_id`;
- `claim_version`;
- `supplier_profile_id`;
- `supplier_display_name`, `supplier_name_ar`, and `supplier_name_en`;
- `submitted_at`;
- `expires_at`; and
- literal safe status `submitted`.

It excludes claimant identity/snapshot, submitted reason, evidence, prior Claim, reviewer fields, ownership facts, contacts, notes, audit/event/idempotency facts, and counts of other Claims. Sort by `(expires_at, claim_id)` with bounded cursor pagination; compute totals only after authorization, or omit totals.

### 4.2 Owner candidate projection

The claim-scoped picker returns only candidates that currently pass the usable-role and implemented conflict checks:

- `reviewer_user_profile_id`;
- `reviewer_display_name` from `user_profiles.full_name`; and
- effective `role_code` (`owner|admin`).

It returns no email, phone, Firebase UID/provider subject, provider-link ID, role/access provenance, security reason, Supplier relationship detail, or inactive candidate. An `unknown` conflict/access result omits the candidate. The assignment command repeats all checks.

### 4.3 Assigned-reviewer queue

Only the exact currently usable and conflict-clear assigned reviewer may receive rows. Exact row projection:

- `claim_id`;
- `claim_version`;
- `status` (necessarily `under_review`);
- `supplier_profile_id`;
- `supplier_display_name`, `supplier_name_ar`, and `supplier_name_en`;
- `supplier_business_type`;
- `submitted_at`;
- `expires_at`;
- `reviewer_assignment_version`; and
- `reviewer_assigned_at`.

It contains no claimant label or ID, submitted reason, evidence, notes, assignment actor/source/policy, contact, conflict reason, ownership source, or internal reference. Sort by `(expires_at, claim_id)`. A withdrawn, expired, approved, rejected, superseded, due, unusable, or conflicted assignment disappears on the next request.

### 4.4 Exact assigned-reviewer detail projection

After repeating the same current authorization checks for one `claim_id`, detail may return only:

**Claim state**

- `claim_id`, `claim_version`, `status`, `submitted_at`, and `expires_at`;
- `reviewer_assignment_version` and `reviewer_assigned_at`;
- immutable `submitted_reason`;
- `evidence_schema_version`; and
- zero to three typed evidence descriptors under section 7.

**Minimized claimant review label**

- `claimant_display_name` from snapshot `full_name`;
- nullable `claimant_organization_label` from snapshot `organization`; and
- nullable `claimant_job_title` from snapshot `job_title`.

These values are claimant-submitted snapshot evidence, not verified identity, employment, organization authority, contact permission, or an authorization input. The projection omits claimant profile UUID, `email`, `phone`, city, all provider identity, and live user-profile details.

**Supplier review summary**

- `supplier_profile_id`;
- `display_name`, `name_ar`, and `name_en`;
- `business_type` and nullable `short_description`;
- `listing_status` and `verification_status`; and
- one derived bounded `supplier_review_eligibility_code` from `eligible|already_owned|unavailable`, without controller identity or ownership provenance.

Source type/note, confidence/direct-experience fields, creator/updater actors, contacts, addresses, payment options, legacy IDs, map/source URLs, security/watchlist detail, ownership rows, and current controller identity remain hidden.

**Resubmission context**

- nullable `prior_claim_id` only when the submit command already proved same claimant and Supplier;
- nullable prior safe status/result code and prior decided time; and
- no prior claimant contact, reviewer, notes, internal reason, evidence-verification source, audit, event, or ownership provenance.

### 4.5 Always hidden

All Owner/reviewer projections exclude Firebase UID/provider subject, provider-link IDs/state/evidence, raw role/access rows, security holds and conflict explanations, claimant email/phone, other Claims or claimant counts, competing claimant identity, current controller identity, submission fingerprint, reviewer assignment actor/source/policy, decision authorization internals, reviewer notes, audit rows/IDs, REL rows/IDs/fingerprints/leases, event payloads, notification state/copy, migration mappings, raw SQL errors, and unrestricted metadata.

## 5. RLS, projection, and object-grant strategy

RLS answers row eligibility; fixed RPC results answer column eligibility. Direct base-table mutation remains denied.

1. Keep `supplier_ownership_claims` RLS enabled and forced.
2. Preserve the existing exact claimant-self select policy and minimized claimant projection; do not broaden it into reviewer access.
3. Add no `anon`, browser `authenticated`, generic `service_role`, Admin-wide, Owner-wide, claimant-cross-access, or Supplier-controller Claim policy.
4. Add a narrow Owner assignment-row policy usable only by the fixed queue/candidate/assignment routines: current principal is a usable Owner, target is coherent/unexpired `submitted`, assignment is wholly null, and the target-specific resolver is clear. This policy must not expose private Claim columns.
5. Add a narrow assigned-reviewer policy: current principal is the exact reviewer, Claim is coherent/unexpired `under_review`, assignment version/policy is supported, complete usable `owner|admin` predicate passes, and conflict result is clear.
6. Use fixed typed routines in a dedicated exposed API schema. Keep the caller role without private base-column grants. If definer routines are selected, own them with dedicated `NOLOGIN`, non-owner, non-superuser, non-`BYPASSRLS` projection roles that have only the exact columns needed, a fixed minimal search path, no unsafe memberships, and RLS-targeted policies. Separate Owner-queue and reviewer-private projection roles are preferred so permissive PostgreSQL policies cannot combine their audiences.
7. Keep `internal.*`, identity links, audit, idempotency, and events outside exposed schemas. Their helpers return only booleans/opaque facts and are not browser-executable.
8. Grant command execution only to the dedicated server-mediated Claim runtime path. `service_role` remains revoked and is not the gateway, Reviewer path, or assignment worker.
9. Add no Claim `INSERT`, `UPDATE`, or `DELETE` RLS policy for browser/application users. `assign_reviewer` performs its own authorization under lock; row visibility never makes a transition valid.

This model prevents a usable but unassigned Admin/Owner from opening private content. The assigning Owner sees the minimized assignment queue and candidate picker only. After assignment, that Owner still cannot open detail unless another Owner had previously assigned them as the exact reviewer—which self-assignment prevents in the current command.

## 6. `supplier_claim.assign_reviewer` v1 contract

### 6.1 Inputs and safe result

Exact caller inputs:

```text
idempotency_key
claim_id
expected_claim_version
reviewer_user_profile_id
correlation_id?       # opaque UUID only
```

The command accepts no assigner, claimant, Supplier, role, status, assignment version/source/policy, time, override, reassignment reason, queue/shift/SLA, notes, audit/event ID, or notification field.

Exact safe success envelope:

```text
command = supplier_claim.assign_reviewer
command_contract_version = 1
outcome_code = under_review
claim_id
claim_status = under_review
claim_version
supplier_profile_id
assignment_version = 1
assigned_at
reviewer_assigned = true
idempotent_replay
```

It does not return reviewer identity, assigning Owner identity, claimant identity, private Claim content, role/access evidence, conflict result, audit/event IDs, or idempotency internals.

### 6.2 Required locked state and atomic transition

After trusted ingress and reservation, the command must prove:

- assigner is the server-derived usable Owner;
- candidate is the distinct usable `owner|admin` described in section 2;
- conflict result is clear for the assigner/candidate checks required by the assignment policy;
- Claim exists, parties/Supplier binding is coherent, `status = 'submitted'`, expected version matches, and trusted `command_now < expires_at`;
- every assignment field is null;
- Supplier remains within the ordinary Claim boundary and ownership history is coherent; and
- all code/policy versions are supported.

One transaction then sets exactly:

| Claim field | Value |
|---|---|
| `status` | `under_review` |
| `record_version` | prior version + 1 |
| `reviewer_user_profile_id` | validated candidate UUID |
| `reviewer_assignment_version` | `1` |
| `reviewer_assigned_at` | one trusted `command_now` |
| `reviewer_assigned_by_user_profile_id` | server-derived assigning Owner UUID |
| `reviewer_assignment_source_code` | code-owned `owner_assignment` |
| `reviewer_assignment_policy_version` | code-owned `claim_reviewer_assignment_v1` |
| `updated_at` | the same `command_now` |

All other Claim content remains unchanged. The command has no ownership, notification, notes, decision, expiry, withdrawal, supersession, or claimant-snapshot write.

### 6.3 Deterministic locks and re-reads

Use the approved universal order:

1. validate request/current Firebase ingress and coarse Owner endpoint authority before reservation;
2. reserve `internal.idempotency_keys` under `supplier_claim.assign_reviewer` v1;
3. read only immutable Claim-to-Supplier/claimant routing hints;
4. lock and validate the fenced idempotency row;
5. acquire versioned principal-authority advisory locks for the unique set `{assigner, candidate, claimant}` in ascending UUID order;
6. acquire the shared Supplier advisory lock;
7. lock `user_profiles` in UUID order; provider links in row-ID order; then role/access/security facts in stable table/key order;
8. lock the Supplier row, then every relevant ownership row in ownership-UUID order;
9. lock/re-read the target Claim, expected version, immutable parties/Supplier, status, expiry, and all assignment fields;
10. lock/re-read required target conflict/hold facts;
11. capture one `command_now` only after all required locks; validate `command_now < expires_at`; and
12. update Claim, insert audit/event, and complete idempotency atomically.

The routing read never authorizes. The common Supplier lock serializes assignment against withdrawal, expiry, and ownership creation. The candidate principal lock serializes assignment against role/access/profile/link eligibility loss.

### 6.4 Idempotency

- Namespace: `supplier_claim.assign_reviewer`, contract version `1`, environment-bound.
- Principal: human assigner profile.
- Target: `supplier_ownership_claim` plus exact Claim UUID.
- Canonical fingerprint: Claim UUID, expected Claim version, reviewer candidate UUID, and `claim_reviewer_assignment_v1`; exclude raw key, token, timestamps, generated IDs, and server-derived role/conflict facts.
- Store only HMAC digests under the existing REL contract; never store/log the raw key or request.
- Same key/actor/target/fingerprint after completion rehydrates the same safe result with `idempotent_replay = true` and creates no new transition, version, audit success, or event.
- Same key with changed actor, target, candidate, expected version, environment, or policy returns `idempotency_key_conflict` without disclosing prior bindings.
- A different key after any assignment is not a business no-op; it returns `reviewer_already_assigned` or a safe version/actionability conflict and never reassigns.
- Fenced lease, attempt, retry, terminal-failure, and completion behavior must match the implemented submit/REL pattern.

### 6.5 Audit, event, and notification

Successful assignment requires exactly one minimized `internal.audit_logs` row in the same transaction:

- action `supplier_claim.assign_reviewer`, contract version `1`, accountable human assigner;
- target Claim and related candidate profile as restricted opaque UUIDs;
- prior/result state `submitted -> under_review` and exact prior/result versions;
- changed-field allowlist limited to status/version and the six assignment fields;
- bounded assignment, role, conflict-result, authorization, evidence, producer, and minimization policy versions;
- correlation, idempotency reference, and event reference;
- outcome `succeeded`, bounded result/reason codes, and `privilege_security_authority` retention class; and
- no token/provider subject, email/phone, Claim reason/evidence/snapshot, reviewer notes, owner/member identity, raw role/access row, conflict explanation, key/fingerprint, or request/response dump.

After an accountable actor exists, security-relevant unauthorized, unusable-candidate, conflict/unknown-coverage, idempotency-binding, and integrity denials receive the existing AUD-001 minimized denial treatment. Pre-auth/malformed/unmapped traffic remains bounded security telemetry. Required audit failure rolls back assignment; denial-audit failure never converts deny to allow.

Successful assignment also inserts exactly one `internal.domain_events` row:

```text
event_type = supplier_ownership.claim_under_review
event_schema_version = 1
aggregate_type = supplier_ownership_claim
aggregate_id = claim_id
aggregate_sequence = committed Claim record_version
producer_command_name = supplier_claim.assign_reviewer
producer_command_contract_version = 1
event_ordinal = 1
actor_kind = human_user
actor_user_profile_id = assigning Owner
payload = {
  claim_id,
  supplier_profile_id,
  claimant_user_profile_id,
  claim_version
}
```

The payload contains no reviewer identity, claimant name/contact, submitted content/evidence, assignment actor details beyond the standard event actor field, role/access/conflict data, provider subject, audit/idempotency data, or notification copy.

`claim_under_review` has **no Claim-v1 notification consumer**. Assignment writes no notification, sends no claimant or reviewer notice, and does not fall back to Firebase. Future reviewer work notifications require a separately approved recipient/template/materializer contract.

### 6.6 Stable failures

The endpoint uses the approved safe taxonomy: `invalid_request`, `authentication_required`, `identity_unavailable`, `actor_not_authorized`, uniform `claim_not_found`, `claim_not_actionable`, `claim_version_conflict`, `claim_expired`, `reviewer_already_assigned`, `reviewer_conflict`, `idempotency_key_conflict`, `command_in_progress`, `retry_later`, `audit_unavailable`, and `integrity_reconciliation_required`. Internal relationship, hold, provider, role/access, SQL, or prior-assignment details never pass through.

## 7. Race and self-assignment cases

| Case | Required deterministic outcome |
|---|---|
| Assigner chooses self | Deny before mutation as self-assignment; no assignment/event/success audit |
| Candidate is claimant | Deny `reviewer_conflict`; no assignment |
| Two Owners assign simultaneously | Shared Supplier lock and target Claim lock serialize. First valid transaction commits one assignment/version/audit/event/result. Second post-lock re-read sees changed state/version; exact same-key same-actor replay returns first result, otherwise bounded conflict; never a second reviewer |
| Candidate loses role/access/profile/link usability concurrently | Both paths share the candidate principal-authority lock. Whichever commits second re-reads the first. Assignment cannot commit after eligibility loss; later loss immediately denies read/decision without erasing assignment |
| Candidate becomes current Supplier controller concurrently | Ownership path and assignment share the Supplier lock. Assignment re-reads ownership after the lock and denies if controller conflict won; ownership cannot be ignored because candidate was clear before locking |
| Candidate submits a competing Claim for the same Supplier concurrently | Submit and assignment share the candidate principal and Supplier locks. The second transaction re-reads the active same-Supplier Claim set; assignment denies proposed-controller conflict if the candidate's Claim committed first |
| Future membership/delegation changes concurrently | Once such authority exists, its mutation must share the candidate principal and Supplier lock namespaces; assignment re-reads it. Until coverage exists in a real environment, result is unknown/deny |
| Claim withdraws concurrently | Both use Supplier then Claim locks. First valid transition wins. Assignment cannot write onto `withdrawn`; withdrawal retains prior assignment provenance only if assignment had already committed while Claim was under review |
| Claim expires concurrently | Capture time after locks. At `command_now >= expires_at`, assignment denies and writes no transition. Expiry worker may then terminalize. If assignment committed strictly before the boundary, expiry later moves the assigned Claim to terminal `expired` without clearing assignment provenance |
| Duplicate/retry after lost response | Same completed key/fingerprint replays exactly; no second audit/event/version. Changed binding conflicts. New key never converts assignment into reassignment |
| Candidate becomes conflicted after assignment | Next queue/detail/decision request denies. Claim v1 does not reassign or override; claimant withdrawal/expiry remain the liveness exits |

## 8. Private evidence access while FILE-001 is Open

FILE-001 does not block the approved non-file Claim path. Assigned-reviewer detail may expose only the Claim's `claim_evidence_v1` array, in stored order, with at most three descriptors and exactly these keys:

```text
kind: company_domain_email | company_website | commercial_registration |
      authorization_letter | other
summary: bounded claimant-supplied text
reference_url?: bounded normalized public HTTPS reference
```

The reviewer is shown that kind/summary/reference are claimant-supplied evidence, not verified fact or proof of custody. The UI and server must not fetch, proxy, preview, scan, follow redirects, attach credentials/cookies/authorization headers, or create signed URLs. Opening an allowed external reference requires explicit reviewer action in a separate browser context with `noopener`/`noreferrer` and no application token leakage.

Full `reference_url` may be returned only after the pre-FILE reference policy revalidates the stored value and excludes credentials, private/local targets, unsupported ports/schemes, signed/secret-bearing references, and unsupported policy versions. Until that read-time policy is implemented, return kind/summary plus a sanitized hostname/`reference_unavailable` indicator and do not enable approval that depends on the hidden reference. No file bytes, upload session, object path, attachment/file row, signed download, email/phone contact, or arbitrary metadata is exposed. This does not resolve FILE-001.

## 9. Reviewer reason and notes boundary

The current Claim table already has one sufficient field: nullable `reviewer_notes`. Its existing decision-shape constraint permits notes only with the complete terminal decision fields and bounds notes to 1–2000 UTF-8 bytes when present. Therefore:

- do not add a reviewer-notes table for Claim v1;
- do not use `reviewer_notes` for draft, collaborative, queue, assignment, conflict, investigation, or internal chat notes;
- under-review autosave/drafts are unsupported and remain outside the Claim aggregate;
- later approve/reject may accept one optional bounded restricted note, normalize/control characters, and write it once with the terminal decision;
- notes never enter Owner queue, reviewer queue, claimant/controller projections, audit safe context, events, notifications, idempotency rows, telemetry, or safe command results; and
- post-decision reviewer/support access to notes is not approved by this minimum path and requires a separately named restricted purpose if later needed.

The existing column is safe for the approved terminal-only use when command validation and projection exclusion are implemented. No new table is unavoidable.

## 10. Minimum typed API/RPC surfaces

Recommended fixed surfaces, names subject to the later implementation migration:

| Surface | Audience | Exact purpose |
|---|---|---|
| `claim_api.owner_assignment_queue_v1(cursor, limit)` | Usable Owner only | Section 4.1 metadata-only submitted/unassigned queue |
| `claim_api.owner_reviewer_candidates_v1(claim_id)` | Usable Owner only | Section 4.2 claim-scoped candidate picker; advisory only |
| `claim_api.reviewer_queue_v1(cursor, limit)` | Exact current assigned usable reviewer | Section 4.3 own current assignments only |
| `claim_api.reviewer_detail_v1(claim_id)` | Exact current assigned usable reviewer | Section 4.4 fixed private detail |
| `supplier_claim.assign_reviewer(...)` | Server-mediated usable Owner endpoint | Section 6 atomic command; not generic CRUD/Data API table mutation |

All results are fixed composite/table return types. Evidence uses the exact versioned descriptor type, not unrestricted JSON. Cursors are opaque and bind policy version, sort keys, audience, and current principal without encoding another claimant. Unknown and unauthorized target IDs share one safe not-found response. No generic Admin/Owner Claim list/detail RPC is recommended.

## 11. Authorization and exposure test matrix

“Allow” means only the named fixed surface and fields; it never means base-table access. Each human row assumes a current mapped Firebase identity unless the row states otherwise.

### 11.1 Actor matrix for one target Claim

| Actor | Claimant own projection | Owner assignment queue/candidates | Call assign once | Reviewer queue/detail | Later approve/reject | Direct Claim/internal access |
|---|---|---|---|---|---|---|
| Claimant, no privileged role | Allow own minimized claimant projection | Deny | Deny | Deny | Deny | Deny |
| Unrelated usable ordinary user | No target row | Deny | Deny | Deny | Deny | Deny |
| Usable Admin, unassigned | Only if independently claimant | Deny | Deny | Deny | Deny | Deny |
| Usable Owner, unassigned and conflict-clear | Only if independently claimant | Allow metadata/candidates for eligible unassigned target | Allow assigning another distinct usable candidate | Deny private detail while unassigned | Deny while unassigned | Deny |
| Assigning Owner after successful assignment | Only if independently claimant | Target disappears; may see other eligible rows | Exact replay only; new assignment/reassignment denied | Deny target private detail | Deny unless they were independently assigned by a different Owner on another Claim | Deny |
| Assigned usable Admin reviewer | Only if independently claimant | Deny | Deny | Allow exact current target only | Allow later only with complete decision checks | Deny |
| Assigned usable Owner reviewer | Only if independently claimant | May use Owner metadata queue for other eligible Claims; target is absent | May assign another candidate to another eligible Claim, never self | Allow exact assigned target only | Allow later only with complete checks | Deny |
| Assigned reviewer now conflicted | Only if independently claimant | Deny target candidate/reviewer path | Deny | Deny immediately | Deny | Deny |
| Assigned reviewer now inactive/unverified/role- or access-revoked | Retained own claimant history only if independently claimant and bridge policy permits | Deny | Deny | Deny immediately | Deny | Deny |
| Current target-Supplier controller | Only if independently claimant | Deny target under conflict policy | Deny target | Deny target even if role/assignment row exists | Deny target | Deny |
| `anon` database/API role | Deny | Deny | Deny | Deny | Deny | Deny |
| Generic `authenticated` database/API role | Deny direct surfaces unless the server gateway separately mediates as the dedicated Claim runtime; no table authority | Deny direct | Deny direct | Deny direct | Deny direct | Deny |
| Generic `service_role` | Deny | Deny | Deny | Deny | Deny | Deny |
| Dedicated Claim runtime | No authority without valid transaction-local principal and named surface | Named surface only after helper passes | Named execute only after helper passes | Named surface only after helper passes | Separate later named execute only | Deny outside exact grants |

### 11.2 Required positive tests

1. Usable Owner lists only coherent, unexpired, unassigned submitted rows and receives the exact queue columns.
2. Candidate picker returns a distinct usable Admin and usable Owner, but no inactive/conflicted/claimant/self candidate or hidden field.
3. Successful Owner assignment writes exactly the nine Claim changes in section 6.2, increments version once, inserts one audit and one `claim_under_review` event, and completes one idempotency result.
4. Assigned usable Admin and assigned usable Owner each list/open only their exact `under_review` Claim and receive the exact projection.
5. Reviewer detail emits at most three schema-valid descriptors and the minimized claimant/Supplier fields only.
6. Exact completed retry returns the same safe result with replay true and no new write.

### 11.3 Required identity/role/access negatives

- missing/malformed/wrong-purpose/wrong-environment/expired transaction context;
- Firebase subject mismatch, disabled/deleted/not-found/unverified user, Admin lookup failure, or stale/contradictory observation;
- missing, multiple, non-primary, unlinked, disabled, unverified, or differently mapped Firebase links;
- missing/inactive/wrong-context profile or contradictory verification mirror;
- missing, multiple/overlapping, inactive, future, expired-by-time, revoked, expired, or superseded role assignment;
- Admin acting as assigner; Owner/Admin row with missing administration access; security deny/hold/quarantine; and
- browser-supplied actor, role, claimant, provider subject/link, assignment source/policy/time, or status ignored/rejected.

Every case returns no unauthorized row and makes no Claim/audit-success/event/idempotency-completion mutation.

### 11.4 Required conflict and privacy negatives

- assigner equals candidate;
- candidate equals claimant;
- candidate or assigned reviewer is current target-Supplier primary controller;
- candidate or assigned reviewer is claimant on another active Claim for the target Supplier;
- contradictory/multiple ownership state;
- active member/admin/delegate fixture once an authoritative relation exists;
- enabled but unavailable external relationship coverage returns unknown/deny;
- usable unassigned Admin/Owner cannot enumerate/open reviewer detail by UUID, filter, count, cursor, join, or changed RPC argument;
- claimant, unrelated user, and Supplier controller cannot reach reviewer queue/detail;
- queue/detail requests for provider subjects, Firebase UID, email/phone, raw snapshot, role/access, conflict/hold, reviewer notes, ownership provenance, audit/REL/event/notification fields are omitted/rejected; and
- evidence URL cannot trigger server fetch, preview, redirect following, credential use, or internal-network access.

### 11.5 Required lifecycle, race, replay, and rollback tests

- two Owners assign same Claim to same and different candidates;
- assignment races withdrawal and due expiry immediately before/at/after `expires_at`;
- candidate role/access/profile/link loss races assignment through the shared principal lock;
- candidate becomes controller while assignment waits on the shared Supplier lock;
- candidate submits a competing same-Supplier Claim while assignment waits on the shared principal/Supplier locks;
- stale expected Claim version; partial/non-null assignment shape; `under_review` or terminal target; unknown policy version;
- same key/same request replay, same key/different candidate/actor/version/environment conflict, in-progress lease, stale lease fencing, and new key after assignment;
- Claim update failure, audit insert failure, event insert failure, or idempotency completion failure rolls back every assignment effect;
- event aggregate sequence equals committed Claim version and event ordinal is exactly one; and
- no notification row/call/fallback occurs for under-review assignment.

### 11.6 Required grant/catalog and output tests

- `PUBLIC`, `anon`, `authenticated`, generic `service_role`, and unlisted roles cannot select/mutate Claim or access `internal.*`;
- direct Claim insert/update/delete fails even for a row the caller may read;
- projection routine owners are `NOLOGIN`, non-owner, non-superuser, non-`BYPASSRLS`, have no unsafe inheritance/membership/schema-create privilege, and use fixed minimal search paths;
- permissive policy composition cannot let the Owner-queue role read reviewer-private columns or let the reviewer role read unassigned rows;
- helper null/exception/missing dependency returns deny;
- exact output-field contract and nested evidence keys match allowlists; and
- forbidden-value scans find no provider subject, Firebase UID, claimant contact, reviewer/assigner identity, conflict reason, notes, raw URL when policy disallows it, audit/REL/event internals, token/secret, SQL/stack text, or unrestricted row JSON.

## 12. Implementation sequencing

Exact recommended order:

1. **Privileged predicate prerequisite:** implement the already-approved role-backed platform-administration access and security deny/hold evidence needed by the common usable predicate, plus shared principal-authority serialization. Do not substitute role rows or `security_eligibility_reference`.
2. **Conflict/read helper substrate:** implement one fail-closed current privileged-actor resolver and target-Supplier conflict resolver, with explicit authority coverage and synthetic controller/claimant/unknown tests.
3. **Reviewer read substrate first:** implement dedicated projection roles, RLS policies, Owner queue/candidate projection, assigned-reviewer queue/detail, exact column/evidence minimization, and grant/catalog tests. Seed only synthetic assignment rows directly in disposable tests to prove positive/negative reads.
4. **Assignment command second:** implement `supplier_claim.assign_reviewer` with the shared helpers, locks, REL integration, required audit, `claim_under_review` event, safe result, and race/rollback suite. Do not grant or expose it until the read substrate tests pass.
5. **Later decisions:** implement reject and approve separately after the assignment/read substrate, exact evidence-verification/reason registries, and their audit/event requirements exist. Approval remains last because it creates ownership and supersedes all competing Claims.

Putting assignment before read security would create durable private-access grants without a proven field-minimized consumption path. Putting read security first permits deterministic local authorization proof against synthetic assignments without enabling mutation.

## 13. Seven Open gates

None of the seven Open gates blocks bounded **local-only, synthetic-data-only Reviewer substrate or command work**. They remain unresolved and apply as follows:

| Open gate | Local Reviewer work | Later boundary |
|---|---|---|
| `ORG-001` | Does not block; no organization authority is used or invented | Revisit only if organization relationships later become authorization/conflict evidence |
| `ORG-002` | Does not block; no organization membership table/path is introduced | Same future organization-membership boundary |
| `MSG-002` | Does not block; Reviewer notes/evidence are not messages | No Claim-v1 message-body dependency |
| `FILE-001` | Does not block bounded non-file summaries/public HTTPS references | Blocks managed uploads, objects, attachments, custody, signed access, scanning, or file-backed approval |
| `BILL-001` | Does not block | No Reviewer/Claim dependency |
| `RES-001` | Does not block disposable local design/tests | Blocks hosted environment/resource/security selection |
| `MIG-002` | Does not block disposable local design/tests | Blocks hosted migration, cutover, reconciliation, rollback, and real-data authority |

The complete Firebase bridge, role-backed access, security deny/hold representation, authoritative conflict coverage, Reviewer RLS/projections, audit writer, and REL command integration are **delivery prerequisites, not newly resolved Open gates**. They block real/hosted Reviewer use and, where needed to return a positive usable result, block immediate command implementation even though the seven named governance gates do not block local design.

## 14. Risks, validation, and exact stop point

Primary risks are treating `owner|admin` as sufficient; letting an Owner/Admin browse unassigned private Claims; projecting the whole claimant snapshot and leaking email/phone; treating assignment as a global role; inferring conflict clearance from missing future tables or legacy organization/email text; auto-fetching claimant URLs; storing draft notes; committing assignment without audit/event/idempotency completion; and leaving an unusable assigned reviewer with reassignment/override authority. This contract fails closed on each risk and accepts the v1 liveness consequence that withdrawal/expiry, not reassignment, resolves a stranded review.

Validation for this task is documentation-only: one new Markdown file, link/path review, exact start SHA, factual comparison with implemented migrations and approved contracts, scope/diff checks, and a secret-sensitive-output scan. No Docker, SQL, pgTAP, application test, runtime, hosted, Firebase, or Production action is required or authorized.

**Exact stop point:** this readiness contract and its draft PR only. Do not implement the read substrate, access/security dependencies, `supplier_claim.assign_reviewer`, approve/reject, SQL/RLS/RPC/runtime, schema/register/baseline edits, hosted work, deployment, migration, data movement, or merge in this task.

## 15. References

- [Supplier ownership and Claim Product/Data/Security contract](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [ID-001 identity and privileged actor contract](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [Platform role assignments contract](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [AUD-001 audit evidence contract](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [MSG-003 Claim notification contract](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
- [Claim structural and command readiness review](41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md)
- [Claim-first RLS and trusted authorization contract](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md)
- [Claim-v1 command atomicity and locking contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md)
- [Claimant self-read RLS implementation evidence](47_CLAIM_RLS_SELF_READ_FOUNDATION_EVIDENCE.md)
- [Claim submit command implementation evidence](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md)
