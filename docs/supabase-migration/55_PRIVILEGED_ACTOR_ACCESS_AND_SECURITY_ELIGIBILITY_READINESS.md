# Privileged actor access and security eligibility contract

Status: **Owner-approved Product/Security/Data contract; implementation-ready only for two separate empty, fully revoked, local-only structural SQL slices; no SQL, pgTAP, RLS, runtime, data, hosted, Firebase, or Production change in this document**

Date: 2026-08-10

Primary task profile: `DOCUMENTATION`

Repository: `mamounabdullah95-lab/Mujahiz.IQ`

Verified starting `origin/main`: `6ea8342a502b4ee38b01ff49785e56c70a00e6b4`, the merge of PR #111 after merged PR #110

Branch: `codex/privileged-access-security-readiness`

## 1. Owner approval and implementation-readiness verdict

The first PR #112 revision at reviewed head `17cd1913b01a4397b9ac8b6188cff53ab705d0ad` identified the missing privileged-access and security-eligibility decisions and recommended the smallest bounded package. On 10 August 2026, the Product/Security/Data Owner explicitly approved that complete recommended package.

This document is now the authoritative implementation-prerequisite contract for exactly two future structural slices:

1. one empty, fully revoked, local-only `public.access_grants` table restricted to `platform_administration`; and
2. one separate empty, fully revoked, local-only `internal.security_eligibility_assessments` table.

Approval makes those two structural slices implementation-ready for separate later SQL PRs. It does **not** implement either table, authorize rows or runtime, prove Firebase authentication, create hosted authority, or change Production.

Existing contracts already fix the security outcome that later implementation must preserve:

- Firebase remains the live authentication, current-account, disablement, and email-verification authority during the hybrid phase.
- `public.user_profiles.id` is the provider-neutral human principal.
- exactly one current `owner|admin` role assignment is necessary but never sufficient;
- a separate current role-backed platform-administration access fact is mandatory;
- security deny, hold, quarantine, reconciliation conflict, ambiguity, and missing required coverage deny;
- Owner and Admin are separate explicit policy codes with no implicit precedence;
- the Claim assignment and target-Supplier conflict predicates remain separate from global platform eligibility; and
- no local relational fact is real authentication or hosted/Production readiness.

The Owner approval fixes the durable representations, lifecycle vocabularies, uniqueness, mutation authority, dual-control boundary, clear/release rules, final-usable-Owner security behavior, bootstrap composition, audit classification, two-slice selection, and dependency-safe sequence. It is a successor implementation prerequisite under the existing ID-001, ID-003, AUD-001, and SEC-001 boundaries. It creates no new named gate and changes none of the seven existing Open gates.

## 2. Verified base and authoritative evidence

### 2.1 Latest-main and ancestry proof

The task fetched `origin/main` before analysis and recorded exact commit `6ea8342a502b4ee38b01ff49785e56c70a00e6b4`.

- PR #110 merge commit `c1aa40683d2e24790402b7c00d9fc980f0ecf9ed` is an ancestor of that commit.
- PR #111 merge commit is the starting commit itself, so it is also an ancestor.
- The relevant delta after the older `31ef92d...` document-header checkpoint contains the merged Claim withdrawal implementation and its baseline/design/register synchronization. It adds no access relation, security-eligibility relation, privileged-actor resolver, administration-access resolver, or Reviewer-specific RLS/read routine.
- The first PR #112 revision identified the unresolved contract at reviewed head `17cd1913b01a4397b9ac8b6188cff53ab705d0ad`. The 10 August 2026 Owner approval is recorded by the successor revision of the same Draft PR; the base remains unchanged and compatible.

### 2.2 Authoritative contracts

This finding is constrained by:

- the [current verified baseline](../ai-context/01_CURRENT_BASELINE.md);
- the [security and Production guardrails](../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md);
- the [PostgreSQL schema design](09_POSTGRESQL_SCHEMA_DESIGN.md);
- the [schema decision register](10_SCHEMA_DECISION_REGISTER.md);
- the [ID-001 identity and privileged-actor contract](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md);
- the [platform-role contract](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md);
- the [AUD-001 audit contract](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md);
- the [Claim-first SEC-001 contract](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md);
- the [Claim-v1 trusted-command contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md);
- the [Reviewer assignment/read readiness contract](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md); and
- the [trusted-gateway/HMAC/pool readiness contract](52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md).

### 2.3 Actual implementation gap

The following findings come from the current migrations and focused pgTAP files, not from design-document inference.

| Concern | Approved design | Implemented structure at the starting SHA | Implemented runtime | Hosted/release state |
|---|---|---|---|---|
| Provider-neutral profile | Exact active profile participates in the usable predicate | [`public.user_profiles`](../../supabase/migrations/20260804000200_provider_neutral_identity_foundation.sql) exists with account status/context and verification mirror fields | No complete privileged resolver; `security_eligibility_reference` is only a bounded reference and has no clear/deny vocabulary or lifecycle | Local-only mirror; not authentication |
| Firebase provider link | Exactly one current usable primary Firebase link | [`internal.identity_provider_links`](../../supabase/migrations/20260804000200_provider_neutral_identity_foundation.sql) exists with active-primary uniqueness and bounded state mirrors | No real signed-token/current-user provider resolver; gateway remains unimplemented | Firebase remains live authority; signed-token and pool proof absent |
| Platform role | Exactly one effective `owner|admin`; role alone is insufficient | [`public.platform_role_assignments`](../../supabase/migrations/20260808000500_platform_role_assignments_foundation.sql) exists with temporal lifecycle, overlap prevention, provenance, and full API-role revocation | No role bootstrap, role administration, real role rows, final-Owner guard, or privileged-role resolver | Local-only and non-authoritative |
| Platform-administration access | One current role-backed fact agreeing with the effective role | No access-grant table exists. The role-foundation test explicitly proves no forward access-grant relation was created | No access mutation or administration-access resolver | Absent |
| Security eligibility/hold | Only explicit current complete clear may permit; deny/hold/quarantine/reconciliation/unknown must deny | No security eligibility, hold, deny, quarantine, or reconciliation-state relation exists. `security_events` remains a deferred event concept, not current authority | No security resolver or trusted clear/hold/release command | Absent |
| Current principal context | One server-established transaction-local principal | `claim_security` and `mujahiz_claim_runtime` exist; [`current_claim_user_profile_id()`](../../supabase/migrations/20260809000300_claim_runtime_identity_context_foundation.sql) returns only the bounded local principal context | Local context harness only; it does not validate Firebase, roles, access, security, or target conflict | No gateway login/role-assumption path; no hosted runtime |
| Claim RLS/read | Claimant, Owner queue, and exact reviewer audiences remain separate | [`supplier_ownership_claims_claimant_self_select`](../../supabase/migrations/20260809000400_claim_rls_self_read_foundation.sql) is the sole Claim policy; one claimant-only invoker projection exists | No Owner assignment queue, candidate projection, reviewer queue/detail, Reviewer policy, or Reviewer helper | Local claimant self-read only |
| Claim mutations | Six approved external commands | `supplier_claim.submit` and `supplier_claim.withdraw` exist locally; assignment fields exist structurally on the Claim | `assign_reviewer`, `approve`, `reject`, and `expire` remain unimplemented | No browser/hosted/Production reachability |
| Audit | Privileged access/security changes require minimized durable evidence | [`internal.audit_logs`](../../supabase/migrations/20260808000600_audit_logs_foundation.sql) exists and is fully revoked | No general role/access/security audit writer or real audit rows | Local structural foundation only |
| Conflict evidence | `clear|conflict|unknown`; only clear permits | Ownership and Claim tables contain a bounded locally testable subset | No consolidated target-Supplier conflict resolver | Missing real membership coverage must remain unknown |

The focused tests confirm the boundaries above:

- [`identity_provider_foundation.sql`](../../supabase/tests/identity_provider_foundation.sql) proves exact identity structures and API-role revocation, not authentication runtime;
- [`platform_role_assignments_foundation.sql`](../../supabase/tests/platform_role_assignments_foundation.sql) proves `owner|admin`, overlap/lifecycle constraints, no access relation, no RLS, and no authority;
- [`supplier_ownerships_foundation.sql`](../../supabase/tests/supplier_ownerships_foundation.sql) proves the restricted ownership structure, not a conflict resolver;
- [`supplier_ownership_claims_foundation.sql`](../../supabase/tests/supplier_ownership_claims_foundation.sql) proves one all-or-none reviewer seam and no reviewer table/command;
- [`claim_runtime_identity_context_foundation.sql`](../../supabase/tests/claim_runtime_identity_context_foundation.sql) proves only two bounded invoker context routines and fail-closed local transaction state;
- [`claim_rls_self_read_foundation.sql`](../../supabase/tests/claim_rls_self_read_foundation.sql) proves exactly one claimant policy and no reviewer-field access; and
- [`audit_logs_foundation.sql`](../../supabase/tests/audit_logs_foundation.sql) proves the inert minimized audit structure and revocation, not an audit writer.

## 3. Preserved Owner-approved facts

This approved successor access/security contract preserves these facts without reopening them:

1. Firebase Auth is the sole hybrid authentication, current-account, disablement, session, and email-verification authority.
2. `user_profiles.id`, not Firebase UID, email, provider-link ID, or role text, is the durable human domain principal.
3. One exact linked, active, primary, verified Firebase provider-link mirror and one active profile are required relational inputs; ambiguous or contradictory linkage denies.
4. The platform-role vocabulary is exactly `owner|admin`; `reviewer` is a Claim assignment, not a platform role.
5. A user has at most one effective active platform role. Owner and Admin have no implicit precedence; every operation names allowed role codes explicitly.
6. A role row alone grants no authority. A separate current role-backed platform-administration access fact and current security eligibility are mandatory.
7. While an Owner assignment remains usable, its role-backed administration access is non-expiring and separate from product trial/subscription access.
8. Ordinary role administration is Owner-only; an Admin cannot grant, promote, demote, revoke, expire, correct, or supersede platform roles.
9. Initial bootstrap is a one-time, environment-bound, externally approved process that atomically establishes at least two usable Owners without fabricating a relational grantor.
10. Eligibility-removing role/access/profile/link changes share one principal-authority serialization boundary and protect the final usable Owner.
11. Claim reviewer assignment is write-once, performed only by a usable Owner, to a distinct usable Owner/Admin, with no reassignment and no Owner override.
12. Access, security, Claim, role, and audit base records have no browser/API or generic `service_role` authority; mutation is trusted-command-only.
13. Required successful privileged mutations and accountable post-auth denials follow AUD-001; raw credentials, provider subjects, personal evidence, investigation notes, and request dumps never enter authorization or audit rows.
14. Target-Supplier conflict is tri-state `clear|conflict|unknown`; only `clear` permits.
15. Missing helper/relation/coverage, unsupported policy version, ambiguity, contradiction, or exception denies. Nothing falls back to Firestore role text, email/domain, legacy organization text, or an empty table.

## 4. Exact terminology and usable-actor predicate

The implementation must use distinct terms so a local mirror can never be described as real authentication.

### 4.1 Bounded terms

| Term | Exact meaning | Explicitly does not mean |
|---|---|---|
| `relationally_eligible` | Current PostgreSQL profile/link mirrors, one effective allowed role, one matching administration-access fact, one current complete security-clear assessment, and every operation-specific relational check are conclusive under one policy version | Current Firebase authentication, a valid session, gateway proof, hosted readiness, or Production authority |
| `usable_in_local_synthetic_proof` | A disposable local test establishes the existing transaction context with synthetic profile/link/role/access/security/Claim rows and proves the same fail-closed relational resolver behavior | A real Firebase user, signed token, real role holder, real access grant, hosted identity, or activation evidence |
| `usable_privileged_actor` | A trusted gateway validates the current Firebase identity/account and exact provider-neutral principal in the same attempt, then PostgreSQL proves `relationally_eligible` and the operation/target predicate | A row, JWT application claim, local test context, or cached mirror alone |
| `hosted_production_eligible` | `usable_privileged_actor` plus the approved hosted environment, real gateway/login/driver/pool/HMAC path, authority manifest, data reconciliation, complete security tests, explicit activation approval, and every applicable release gate | A conclusion available from local SQL or this document |

### 4.2 Relational predicate

For principal `p`, operation `op`, trusted database time `t`, policy version `v`, and optional target `x`:

```text
relationally_eligible(p, op, t, v, x) =
  exactly_one_active_profile(p)
  AND required_account_context(p, op) = buyer
  AND current_verified_profile_mirror(p, v)
  AND exactly_one_active_usable_primary_firebase_link(p, v)
  AND exactly_one_effective_platform_role(p, t)
  AND role_code(p) IN allowed_roles(op)
  AND exactly_one_current_role_backed_administration_access(p, role_assignment, t, v)
  AND exactly_one_current_complete_security_assessment(p, platform_administration, t, v) = clear
  AND no_contradictory_access_or_security_fact(p, t, v)
  AND operation_specific_predicate(p, op, x, t, v) = clear
```

For the current Claim Reviewer path, `buyer` is required by the approved contracts. A future operation may use a different context only through its own explicit contract; a generic resolver must not silently weaken this condition.

`usable_privileged_actor` additionally requires, before the relational evaluation, a current trusted Firebase signed-token and current-user observation for the exact subject, exact provider-link resolution, and server-established transaction-local context. PostgreSQL re-reads role, access, security, conflict, assignment, and Claim facts; none is trusted as a gateway/browser claim.

### 4.3 Conclusive outcomes

The relational resolver should expose only a bounded internal result:

- `eligible` only when every required fact is exactly one, current, compatible, and policy-complete;
- `denied` when a conclusive current blocker applies; or
- `unknown` when coverage, a required row, policy version, uniqueness, currentness, integrity, or authority is missing or contradictory.

Only `eligible` authorizes. Both `denied` and `unknown` produce the same external denial; their internal reason classes remain restricted.

## 5. Role-backed platform-administration access

### 5.1 Approved `public.access_grants` boundary

The Owner approved Option A and the exact relation name `public.access_grants` for the first bounded access contract. Its initial and only approved purpose is `platform_administration`. Product subscription access, trial access, billing entitlement, arbitrary capability vocabulary, and general RBAC/ABAC are excluded.

The relation remains absent: no migration creates it, no focused pgTAP file tests it, and no access row or mutation runtime exists. The approval selects only a later empty structural slice. A platform role assignment alone never grants authority; every access row is bound to the exact `platform_role_assignment` it backs, while operation capability remains separately determined by explicit command policy and role code.

### 5.2 Bounded options

| Option | Model | Assessment |
|---|---|---|
| A | One `public.access_grants` first contract restricted to the single purpose `platform_administration`, with each row bound to the exact role assignment. Finite product/trial grants and additional purpose vocabulary remain outside this contract. | **Approved.** Reuses the cataloged concept, creates one separate authority seam, meets Claim v1 and future role administration, and avoids premature capability design. |
| B | A general access-grant relation with multiple product and administration capabilities, sources, limits, and finite/non-finite lifecycle variants. | **Deferred / not selected.** It would pull legacy trial/product semantics and future entitlement design into this security prerequisite. |
| C | Treat the role assignment itself as administration access or add an access flag to the role row. | **Rejected.** It violates the approved separation, makes role rows sufficient, removes an independent revoke/hold seam, and weakens final-Owner proof. |

Option A does not mean one grant confers every platform capability. It means one current fact proves entry into the bounded platform-administration security domain. Each operation still explicitly evaluates `owner`, `admin`, both, or neither and then its own Claim/target predicates. No generic RBAC/ABAC engine or free-form capability code is needed.

### 5.3 Owner-approved minimum logical shape

Exact SQL types and constraint mechanics belong to the later structural SQL slice. The approved minimum semantic fields are:

- database-generated opaque grant ID;
- subject `user_profile_id`;
- exact `platform_role_assignment_id`;
- access purpose fixed initially to `platform_administration`;
- lifecycle `active|revoked|expired|superseded`;
- trusted `valid_from` and nullable `valid_until` using a half-open interval;
- source class, bounded reason code, authorization-policy version, and bounded evidence/reference or digest;
- accountable human grantor and distinct reviewer where the approved action requires dual control, or an explicit bootstrap/system source when no relational human grantor can truthfully exist;
- terminal actor/system source, terminal reason/time, and restrictive successor reference for correction/supersession;
- record version, correlation reference, and trusted creation/update timestamps; and
- no raw token, provider subject, email, personal evidence, unrestricted notes, full audit payload, or generic capability JSON.

The subject and role assignment must agree structurally, preferably through a restrictive composite identity relationship. The access row must not outlive or silently change the role assignment it backs. A role transition terminalizes the old access row and creates a separately justified grant for the successor role; it never edits the access purpose or role binding in place.

### 5.4 Required uniqueness and contradiction rules

- At most one effective administration-access row may exist for one role assignment.
- One subject may have at most one effective administration-access row because the approved role model permits only one effective role.
- Effective half-open intervals for the same subject/purpose must not overlap.
- An active access row referencing an inactive, future, expired-by-time, revoked, expired, or superseded role assignment is contradictory and denies.
- An active role with no matching access is missing evidence and denies.
- Multiple rows, partial lifecycle provenance, unsupported policy/source/reason, or subject/role mismatch is `unknown`/reconciliation-required and denies.
- An Owner's `platform_administration` access is non-expiring while the bound Owner assignment remains usable. It never receives a product/trial expiration.
- An Admin's `platform_administration` access is finite and may not exceed exactly 180 calendar days from trusted `valid_from`.
- Admin access has no automatic renewal. Renewal is a new reviewed authorization action, may not overlap, and before the previous horizon uses the approved supersede/history model rather than silently extending an existing row.

## 6. Security deny, hold, quarantine, and reconciliation eligibility

### 6.1 Bounded options

| Option | Model | Assessment |
|---|---|---|
| A | One separate non-exposed restricted `internal.security_eligibility_assessments` relation with immutable assessment history and one effective current assessment per subject/scope/policy. | **Approved.** It proves explicit complete clear, durable blockers, and unknown/reconciliation without mixing access, events, or evidence. |
| B | Separate tables for security denies, holds, identity quarantine, authority conflicts, and reconciliation cases. | **Deferred.** Specialized lifecycles may become justified later, but are not selected now. |
| C | Encode deny/hold/quarantine/reconciliation in access-grant lifecycle. | **Rejected.** Access authority and security assessment have different sources, reviewers, evidence, and resolution semantics. |
| D | Use the deferred `security_events` concept or `user_profiles.security_eligibility_reference` as current eligibility. | **Rejected.** An event/history feed is not authoritative current state, and the scalar reference has no approved vocabulary, coverage, currentness, or lifecycle. |

### 6.2 Owner-approved minimum model

Use exactly `internal.security_eligibility_assessments`, one new relation in the non-exposed restricted `internal` schema. It records explicit current eligibility for the bounded `platform_administration` scope and immutable prior assessments. It is not access, authentication, audit, an event table, raw investigation evidence, or target-Supplier conflict evidence. It must remain outside browser/API exposure and fully revoked from `PUBLIC`, `anon`, `authenticated`, generic `service_role`, and every unlisted role.

Minimum semantic fields:

- database-generated opaque assessment ID;
- subject `user_profile_id`;
- scope code, initially exactly `platform_administration`;
- result code exactly `clear|deny|unknown`;
- bounded condition type that distinguishes `complete_clear`, `explicit_deny`, `security_hold`, `identity_quarantine`, and `reconciliation_required` without exposing investigation detail;
- effective `valid_from` and nullable `valid_until` under trusted time;
- lifecycle `active|resolved|expired|superseded`;
- source class, bounded reason code, security-policy version, required-coverage version, and evidence/minimization version;
- accountable human actor and reviewer where required, or a named trusted system source for a system-originated restrictive result;
- terminal/resolution actor or system, reason, time, and restrictive successor reference;
- bounded opaque reconciliation/evidence reference or approved digest, never raw evidence; and
- record version, correlation reference, and trusted timestamps.

One effective assessment per subject/scope/current policy is preferred. A new assessment terminalizes the prior assessment and appends a successor under the shared principal-authority lock. This is simpler and safer than computing precedence across several independently active rows.

### 6.3 Authorization meaning

Only one exact, active, in-time `clear` row with `condition_type = complete_clear`, the current security policy version, and the complete required-coverage version may satisfy security eligibility.

All of the following deny:

- current `deny`;
- a security hold;
- identity quarantine;
- `unknown` or reconciliation-required;
- no current row;
- an expired/stale clear row;
- unsupported policy or coverage version;
- duplicated/overlapping current rows;
- source, actor, lifecycle, or successor contradiction; or
- inability to read the relation/helper.

Absence of a blocker is not clear. A clear result is an affirmative, current, policy-complete assessment. This makes missing required security coverage `unknown` rather than accidentally permissive.

### 6.4 Separation and minimization

The relation must not contain Firebase tokens, provider subjects, emails, phone numbers, complete Firebase records, unrestricted investigation notes, personal evidence, Claim evidence, full request/response bodies, raw exceptions, audit payloads, or arbitrary JSON. Detailed investigation material, if later approved, belongs in a separately governed restricted evidence system. The authorization row stores only bounded codes, versions, opaque references/digests, and accountable provenance.

Target-Supplier conflict does not belong in this global relation. It remains a separate target-specific resolver over ownership, Claim, and later membership authorities.

## 7. Authority, mutation, bootstrap, and audit boundary

No table is directly mutable by a browser, Admin session, Owner session, generic API role, or `service_role`. Every action below is a separately registered trusted command or approved system process that derives actor, time, policy, source, and result server-side and uses the shared principal-authority lock.

| Action | Minimum authority | Dual control / final-Owner behavior | Audit and event boundary |
|---|---|---|---|
| Create or renew Admin role-backed access | One currently usable Owner authorizes; subject and role assignment must already be coherent or be created in the same approved role transaction | Every new or renewed Admin grant requires one distinct currently usable Owner reviewer. The subject cannot approve their own access; authorizer and reviewer are distinct | Atomic AUD-001 success; minimized post-auth denials. No domain event until a named consumer exists |
| Create Owner role-backed access | Current usable Owner through the approved role command | Distinct current usable Owner reviewer required; cannot create the subject's own authority through one-person approval | Same transaction as role mutation and audit; no generic event |
| Revoke/expire/supersede access | Current usable Owner; scheduled expiry only when the original policy already authorized a finite Admin horizon | Every final-usable-Owner-affecting authority change retains distinct usable-Owner review, locks/re-reads the complete usable-Owner set, and cannot perform an ordinary discretionary transition to zero usable Owners | Atomic audit; no event without consumer |
| Apply deny/hold/quarantine/reconciliation-required | Approved trusted security systems may impose more restrictive states only under a later bounded trusted-command/source registry; a usable Owner may later impose a restriction through an approved trusted security command | A system never self-clears or broadens authority. Genuine authoritative security loss makes the affected Owner unusable even if they are the final usable Owner and triggers separately governed emergency recovery | Atomic audit for persisted authoritative change; bounded telemetry before accountable actor/source resolution |
| Establish or restore `clear` | Reviewed trusted security/reconciliation command after complete current coverage is proved | Human clear, release, or authority-broadening correction requires two distinct currently usable Owners, neither the subject. No Admin clear, self-clear, system self-clear, or automatic clear from elapsed time | Atomic privilege/security audit; correction appends history |
| Correct/supersede access or security history | Reviewed trusted correction command | Preserve prior row; never reopen or edit effective meaning in place. Distinct review for authority-broadening correction | Atomic correction audit linked to predecessor evidence |
| First-Owner bootstrap | Existing protected, checksummed, environment-bound manifest and independent external approver/operator evidence | Atomically establish at least two distinct Owner role assignments, their administration access, and the explicit current complete security-clear assessments required to make them relationally eligible; then irreversibly disable the exception | Atomic bootstrap audit; no fabricated human grantor; exact execution remains separately gated |

An Admin may never directly create, grant, renew, clear, revoke, expire, supersede, or correct platform role, administration-access, or security-eligibility authority. No browser/API role or generic `service_role` may mutate either relation directly. An Admin can later review a Claim only after another usable Owner assigns the exact Claim and every current predicate passes.

The audit classification is `privilege_security_authority` under AUD-001. Success audit must commit atomically with the authoritative access/security mutation. A post-auth denied attempt receives minimized denial evidence under the approved AUD-001 boundary; audit failure never changes denial to permission. There is no present named consumer for access/security lifecycle facts, so this foundation should not invent domain events or notification fan-out. A later consumer requires its own event vocabulary, payload minimization, replay, and operations approval.

## 8. How the foundation unblocks Claim Reviewer

The future authorization chain is exactly:

```text
trusted Firebase gateway
-> exact provider-neutral principal
-> usable profile and exact active primary Firebase link
-> exactly one effective operation-allowed owner/admin role
-> current role-backed platform-administration access
-> explicit current complete security clear
-> target-Supplier conflict clear
-> Claim-specific assignment/access predicate
```

Every arrow is conjunctive. No upstream fact substitutes for a downstream fact.

### 8.1 Owner assignment-queue authorization

- The current gateway/principal/profile/link predicate passes.
- The effective role is exactly `owner`.
- The matching administration access and security assessment are current and conclusive.
- The Owner's target-Supplier conflict result is `clear`.
- The target Claim is coherent, unexpired, `submitted`, and wholly unassigned.
- The result is only the metadata-minimized queue approved by document 51; it exposes no claimant identity, reason, evidence, reviewer data, or private detail.

### 8.2 Reviewer candidate

- The candidate is a distinct provider-neutral profile.
- Their complete current relational predicate passes with role `owner|admin`.
- Access agrees with that exact effective role assignment.
- Security is explicit complete clear.
- Target-Supplier conflict is `clear`.
- Appearance in the candidate projection is advisory only; the assignment command repeats every check under lock.

### 8.3 Assigned reviewer queue/detail and later decision

- The current principal exactly equals the Claim's durable `reviewer_user_profile_id`.
- The Claim has the supported assignment version and policy.
- The reviewer remains a currently usable Owner/Admin with current access and security clear.
- The Claim is coherent, unexpired, and exactly `under_review`.
- Target-Supplier conflict remains `clear`.
- Queue/detail returns only the fixed field-minimized contract.

If role, access, profile, provider-link, security, assignment, Claim state, or conflict becomes unusable, the next read or decision denies immediately. The immutable assignment remains historical provenance. Claim v1 does not reassign or override it; claimant withdrawal and trusted expiry remain the liveness exits.

## 9. Target-Supplier conflict interaction

The conflict result remains exactly `clear|conflict|unknown`; only `clear` permits assignment, Reviewer read, approval, or rejection.

### 9.1 What local synthetic SQL can prove now

Using the implemented Claim and ownership structures, a later local test can prove:

1. candidate/reviewer equals the target Claim claimant;
2. assigning Owner equals the candidate (self-assignment);
3. candidate/reviewer is the current effective active primary controller of the target Supplier;
4. candidate/reviewer is a claimant on another active `submitted|under_review` Claim for the target Supplier; and
5. multiple active controllers, incoherent intervals/status, partial assignment shape, contradictory ownership, or Claim/ownership binding mismatch is `unknown`/integrity failure.

### 9.2 What remains unavailable

No Supplier membership, Supplier admin/delegate, organization, organization-membership, general recusal, or target-conflict table exists. Do not infer these relationships from account context, profile creator/updater fields, legacy organization text, contacts, email/domain, names, or the fact that a table is absent/empty.

Local synthetic proof may declare coverage complete only for an environment manifest where no mechanism can create the unavailable relationships. It is not hosted/cutover evidence. If any real environment permits Supplier member/admin/delegate or organization-derived relationships outside the relational resolver's coverage, the target result is `unknown` and denies until that authority is modeled, reconciled, and included.

This document does not resolve or change `ORG-001` or `ORG-002`.

## 10. Future RLS, object, role, and helper boundary

The existing non-exposed `claim_security` schema is the smallest suitable Claim-specific helper boundary; a second exposed or generic security schema is not needed for the Reviewer path.

### 10.1 Helper architecture

- Keep access/security base relations fully revoked from `PUBLIC`, `anon`, `authenticated`, generic `service_role`, browser/API roles, and unlisted workers.
- Keep the security relation outside every Data API exposed-schema list. The access relation remains a non-endpoint even if the approved physical table is in `public`.
- Keep `claim_security.current_claim_user_profile_id()` as the bounded transaction-context accessor; do not make it a privileged resolver by adding caller-selected role/capability authority.
- Add a restricted relational eligibility helper that returns only an opaque principal, allowed role code, and/or bounded `eligible|denied|unknown` result required by its caller. It returns no role/access history, provider subject, security reason, evidence, or match explanation.
- Add a separate target-Supplier conflict helper returning only `clear|conflict|unknown` or a boolean that is true only for clear. Global security and target conflict remain separate functions even when one operation combines their results.
- Prefer operation-specific wrappers for Owner assignment and exact reviewer access. Do not expose a caller-selected generic capability, arbitrary policy code, role list, table name, filter, or SQL fragment.

### 10.2 `SECURITY INVOKER` versus `SECURITY DEFINER`

A `SECURITY INVOKER` helper cannot read fully revoked internal/profile/role/access/security bases unless the runtime receives those raw privileges, which would violate the approved boundary. Therefore the narrow helpers that inspect those protected relations may be `SECURITY DEFINER`, but only under all of these constraints:

- dedicated `NOLOGIN`, non-superuser, non-database-owner, non-table-owner, non-`BYPASSRLS` function-owner/helper roles;
- no unsafe role inheritance, role administration, schema creation, or membership;
- only exact base columns and operations needed by one helper;
- fixed minimal search path, preferably `pg_catalog`, with every application object schema-qualified;
- no dynamic SQL or attacker-selectable object/policy/capability;
- `PUBLIC` execute revoked and execute granted only to the exact server-mediated runtime or dedicated projection role; and
- independent catalog, search-path, privilege, null/exception, and output-shape tests.

Outer field-minimized projections may use the dedicated definer-role pattern approved by SEC-001/document 51. Keep Owner-queue and Reviewer-private projection roles separate so permissive policies cannot combine audiences. Each is `NOLOGIN`, non-owner, non-superuser, non-`BYPASSRLS`, with exact base-column grants and no generic internal access.

### 10.3 Claim RLS effect

The current Claim table has exactly one claimant self-select policy. The later Reviewer-read substrate is expected to add exactly two narrow SELECT audiences:

1. usable, conflict-clear Owner access to coherent unexpired submitted/unassigned queue rows only; and
2. exact current assigned, usable, conflict-clear Reviewer access to coherent unexpired `under_review` rows only.

That would change the Claim policy count from one to three, subject to exact SQL review. It must add no browser/application mutation policy. `supplier_claim.assign_reviewer` remains a trusted command that independently repeats authorization under lock; row visibility never authorizes mutation.

## 11. Local synthetic test matrix

All future tests use disposable local PostgreSQL and synthetic identities/rows. A positive local result is `usable_in_local_synthetic_proof`, never a real or hosted authenticated actor.

| Class | Fixture | Required result |
|---|---|---|
| Positive | Exact active Buyer-context profile; one active verified primary Firebase link mirror; one active Owner role; matching current administration access; current complete security clear | Relational Owner eligibility succeeds for Owner-allowed operation |
| Positive | Same complete predicate with one active Admin role | Relational Admin eligibility succeeds only for Admin-allowed operation; assignment authority still denies |
| Identity | Missing profile | `unknown`/deny |
| Identity | Suspended or deactivated profile | deny |
| Identity | Wrong/unknown account context for Reviewer administration | deny |
| Identity | Missing/unknown/unverified/contradictory profile mirror | `unknown`/deny |
| Identity | Missing Firebase link | `unknown`/deny |
| Identity | Duplicate active links or competing primary links | `unknown`/deny and reconciliation classification |
| Identity | Non-primary, unlinked, disabled, or unverified link | deny |
| Identity | Provider-link subject/profile lineage contradiction | quarantine/reconciliation; deny |
| Role | Missing role | `unknown`/deny |
| Role | Two overlapping roles, including two rows with the same code | `unknown`/deny; no precedence |
| Role | Future, expired-by-time, revoked, expired, or superseded role | deny |
| Role | Role code not explicitly allowed by operation | deny |
| Access | No administration-access row | `unknown`/deny |
| Access | Expired, revoked, or superseded access | deny |
| Access | Access subject/role-assignment disagreement | `unknown`/deny |
| Access | Duplicate or overlapping access | `unknown`/deny |
| Access | Valid access tied to an inactive role | deny |
| Access horizon | Usable Owner access carries a product/trial expiry | deny; Owner administration access must remain non-expiring while the role is usable |
| Access horizon | Admin `valid_until` exceeds exactly 180 calendar days from `valid_from` | deny |
| Access renewal | Automatic, overlapping, or in-place Admin renewal/extension | deny; require a new dual-reviewed action and approved supersession when replacing early |
| Access authority | New/renewed Admin grant lacks two distinct currently usable Owner authorizer/reviewer or the subject self-approves | deny |
| Security | Explicit deny | deny |
| Security | Active hold | deny |
| Security | Identity quarantine | deny |
| Security | Reconciliation required / result unknown | deny |
| Security | Missing assessment, missing coverage version, stale clear, or unsupported policy | `unknown`/deny |
| Security | Duplicate/contradictory current assessment | `unknown`/deny |
| Security authority | Trusted system attempts `clear`, release, or another authority-broadening correction | deny; systems may impose restrictions only |
| Security authority | Human clear/release lacks two distinct currently usable Owners or either Owner is the subject | deny |
| Owner safety | Genuine authoritative security loss affects the final usable Owner | affected Owner becomes unusable; enter governed emergency recovery |
| Owner safety | Ordinary discretionary role/access closure would leave zero usable Owners | deny and roll back |
| Bootstrap | Fewer than two Owners, or missing matching access, explicit complete clear, AUD-001 evidence, or external governance/manifest evidence | fail atomically; bootstrap exception remains enabled |
| Cross-domain | Role valid, access invalid | deny |
| Cross-domain | Access valid, role invalid | deny |
| Cross-domain | Role/access valid, security denied | deny |
| Cross-domain | All relational facts valid but no trusted gateway proof | May pass only as local synthetic relational proof; must never report `usable_privileged_actor` or hosted/Production eligibility |
| Conflict | Candidate equals claimant | conflict/deny |
| Conflict | Assigner equals candidate | conflict/deny |
| Conflict | Candidate/reviewer is current primary controller | conflict/deny |
| Conflict | Candidate/reviewer has competing active same-Supplier Claim | conflict/deny |
| Conflict | Contradictory ownership/Claim integrity | unknown/deny |
| Conflict | Real environment enables unmodeled membership/delegation | unknown/deny |
| Reviewer | Usable unassigned Admin or Owner opens private detail | deny |
| Reviewer | Exact assigned usable Admin/Owner, coherent unexpired `under_review`, conflict clear | exact field-minimized queue/detail only |
| Reviewer | Assigned reviewer loses role/access/security/profile/link eligibility | next read/decision denies; assignment remains |
| Grants | API roles, generic `service_role`, unlisted role access base relations/helpers | deny |
| Helpers | Missing relation, exception, null, unsupported version, unsafe owner/search path/grant | migration/test failure or runtime deny; never allow |

Concurrency tests must also prove shared principal-authority locking for role/access/security changes, assignment versus eligibility loss, deterministic subject/row lock order, access/security supersession, final-usable-Owner behavior, and no stale pre-lock authorization.

## 12. Owner-approved dependency-safe implementation sequence

Do not combine access and security into one relation or one implementation slice merely to reduce PR count.

| Slice | Scope and dependencies | Table count | Claim RLS policy count | Revocation / data / Production boundary | Stop point |
|---|---|---:|---:|---|---|
| 1. Administration-access structural foundation | Owner-approved exact Option A DDL plus focused pgTAP; depends on existing profiles and role assignments | +1 | unchanged at 1 | Empty, fully revoked, local-only, synthetic tests only; no role/access rows or commands | Stop after structure/catalog tests; no security table or resolver |
| 2. Security-eligibility structural foundation | Owner-approved exact one-relation DDL plus focused pgTAP; depends on profiles only and approved security vocabulary/authority | +1 | unchanged at 1 | Empty, non-exposed, fully revoked, local-only; no clear/deny/hold rows or commands | Stop after structure/catalog tests; no resolver |
| 3. Relational privileged-actor resolver | Dedicated helper owner/role, exact column grants, shared principal-lock keys, bounded `eligible|denied|unknown`; depends on slices 1-2 and existing context/profile/link/role | no change | unchanged at 1 | Base relations remain fully revoked; synthetic fixtures only; no claim of Firebase authentication | Stop after complete identity/role/access/security matrix |
| 4. Target-Supplier conflict resolver | Separate bounded `clear|conflict|unknown` helper over implemented ownership/Claim evidence and explicit coverage manifest | no change | unchanged at 1 | No new membership/organization concept; hosted missing coverage stays unknown | Stop after claimant/controller/competing-Claim/integrity/unknown tests |
| 5. Reviewer private-read substrate | Dedicated Owner/reviewer projection roles, Owner queue/candidates, reviewer queue/detail, exact output minimization, grants/catalog tests; depends on slices 3-4 | no change | expected +2 SELECT policies, from 1 to 3; zero mutation policies | Synthetic assigned rows only; no assignment command or real data | Stop after read/security tests pass |
| 6. `supplier_claim.assign_reviewer` | Existing approved command contract using the same resolvers, locks, REL, audit, event, safe-result, race/replay/rollback tests; depends on slice 5 | no change | unchanged from slice 5 | Trusted execute only; no browser base mutation, notification, real row, hosted, Firebase, or Production access | Stop after local synthetic command proof; approve/reject/expire remain separate |
| 7. Access/security administration and bootstrap runtime | Separately reviewed trusted grant/revoke/hold/clear/correct commands, dual control, ordinary final-Owner guard, security-emergency recovery state, audit, and bootstrap integration; depends on resolver semantics and approved operational registries | no change | no browser policy required | Required before any non-synthetic role/access/security row; still no hosted/Production execution without release gates | Stop before real bootstrap/population or hosted use |
| 8. `supplier_claim.approve` and `supplier_claim.reject` | Separate later Claim command slices after assignment; each reuses the same current resolvers, locks, REL, audit, and safe-result boundaries | no change | unchanged | Local synthetic proof only until separately released | Keep approve and reject out of the access/security structural PRs |
| 9. `supplier_claim.expire` | Separate later worker-command slice with its own authority, time, replay, audit/event, and race proof | no change | unchanged | Local synthetic proof only until separately released | Keep expiry independent of approval/rejection |

The Owner selected the cataloged `public.access_grants` concept for slice 1 and selected a distinct durable assessment authority for slice 2. Repository convention requires every durable logical relation to appear exactly once in the authoritative catalog. `internal.security_eligibility_assessments` cannot refine or replace deferred `security_events`: the former is authoritative current assessment state, while the latter remains a distinct authentication/authorization/abuse event-history concept. It is also not a physical decomposition of another logical concept.

The reconciled catalog therefore increases from 79 to **80 logical concepts** and Core Phase 1 from 36 to **37**. Implementation remains exactly **20 implemented** concepts, so **17 Core Phase 1 concepts remain unimplemented**. Current physical state is unchanged at **22 tables, 20 migrations, and 20 pgTAP files**. Approval and selection do not create either table.

The real gateway, provider resolver/reconciler, environment-specific login and role-assumption path, HMAC rotation, exact driver/pool/pooler proof, hosted authority, migration/cutover, and Production activation remain separate release work. They do not belong in slices 1-9.

## 13. Product, Security, and Data implications

### Product

- Owner assignment UI may show only the metadata queue and minimal candidate identity approved by document 51.
- A usable but unassigned Owner/Admin receives no private Claim browser.
- A Reviewer who later becomes unusable loses access immediately; v1 accepts the liveness consequence that there is no reassignment or override.
- Product trial/subscription access remains separate from administration authority and cannot expire an Owner silently.

### Security

- The model requires affirmative complete clear; absence of known bad data is never enough.
- Role/access/security/conflict are separate inputs, reducing confused-deputy and stale-role failure modes.
- The system can fail closed without exposing why an actor is held, quarantined, or under reconciliation.
- Dedicated non-login helper/projection owners avoid raw base grants and generic `service_role` authority.
- Genuine authoritative security loss overrides final-Owner availability and triggers governed emergency recovery; ordinary discretionary role/access closures remain prohibited from intentionally leaving zero usable Owners.

### Data

- Access and security histories are append-and-terminalize, never hard-delete or in-place authority rewrites.
- Provider subjects and raw security evidence remain out of public/domain actor FKs and authorization rows.
- One active row per subject/scope/policy simplifies uniqueness, replay, reconciliation, and historical interpretation.
- No Production `accessGrants`, user, role, Claim, ownership, audit, or security data is inspected, mapped, seeded, backfilled, or changed by this work.

## 14. Open-gate impact

The seven Open gates remain exactly:

- `ORG-001`
- `ORG-002`
- `MSG-002`
- `FILE-001`
- `BILL-001`
- `RES-001`
- `MIG-002`

The access/security choices in this document are **Owner-approved implementation prerequisites that do not change the seven-gate register**. The approval creates no new named gate and closes none of the seven existing gates.

- `ORG-001` and `ORG-002` remain unchanged. They do not block bounded local synthetic proof, but any later organization/Supplier membership authority must enter target-conflict coverage before hosted use.
- `MSG-002` remains unrelated to Claim v1 Reviewer notes/evidence.
- `FILE-001` remains unchanged and blocks managed file evidence, not the bounded non-file path.
- `BILL-001` remains separate; product entitlements must not be pulled into the administration-access slice.
- `RES-001` blocks hosted resource/security selection.
- `MIG-002` blocks environment, real identity/access/security population, reconciliation, cutover, and rollback.

No existing gate is resolved or closed, and no new decision ID is registered.

## 15. Owner approval record and selected contract

On 10 August 2026, the Product/Security/Data Owner approved the complete recommended package from the first PR #112 revision. The approval records all of the following:

1. **Access Option A is Approved.** Use `public.access_grants`, initially and only for `platform_administration`, bound to the exact role assignment. Access Option B is Deferred / Not selected; Access Option C is Rejected.
2. **Access history and lifecycle are fixed.** Use `active|revoked|expired|superseded`, append-and-terminalize history, exact subject/role binding, trusted validity, source/reason/policy/evidence/provenance, terminal provenance, version/correlation/timestamps, non-overlap, and fail-closed contradiction handling. Never hard-delete, reopen, or silently rewrite authority.
3. **Owner horizon is non-expiring** while the bound Owner role remains usable; no product/trial expiry may shorten it.
4. **Admin horizon is finite:** at most exactly **180 calendar days** from `valid_from`, no automatic renewal, no overlap, and early replacement uses supersession rather than extension.
5. **Admin dual control is mandatory.** Every new or renewed Admin grant requires one currently usable Owner authorizer and a distinct currently usable Owner reviewer; the subject cannot self-approve. Admin has no access-administration authority.
6. **Security Option A is Approved.** Use exactly `internal.security_eligibility_assessments`. Security Option B is Deferred; Security Options C and D are Rejected.
7. **Security scope/result are fixed.** Scope is `platform_administration`; result is exactly `clear|deny|unknown`; initial condition types are exactly `complete_clear|explicit_deny|security_hold|identity_quarantine|reconciliation_required`. Only one current, supported, coverage-complete `clear` plus `complete_clear` permits.
8. **Security history and lifecycle are fixed.** Use `active|resolved|expired|superseded`, immutable history, at most one effective assessment per subject/scope/current policy/coverage boundary, and successor terminalization under the shared principal-authority lock. Missing, stale, duplicate, overlapping, contradictory, unsupported, or unreadable coverage is `unknown` and denies.
9. **Security data is minimized.** Only bounded authority metadata, versions, provenance, opaque references/digests, lifecycle, validity, and trusted timestamps are permitted; raw tokens, provider subjects, PII, complete Firebase records, investigation/Claim evidence, dumps, arbitrary JSON, and raw exceptions are prohibited.
10. **Restriction authority cannot broaden authority.** Approved trusted systems may impose more restrictive states only under a later bounded registry; systems never self-clear. A usable Owner may later impose a restriction through an approved trusted security command. Admin and direct browser/API/`service_role` mutation are prohibited.
11. **Human clear/release requires dual control.** Two distinct currently usable Owners, neither the assessment subject, complete current coverage proof, and atomic AUD-001 evidence are mandatory. There is no self-clear, Admin clear, system self-clear, or time-based auto-clear.
12. **Security loss overrides final-Owner availability.** A genuine authoritative security loss makes the affected Owner unusable even if they are the final usable Owner and triggers a separately governed emergency-recovery state/path. Ordinary discretionary role/access changes still may not intentionally leave zero usable Owners.
13. **Bootstrap composition is fixed.** The future protected bootstrap atomically creates at least two distinct Owner role assignments, matching `platform_administration` access, explicit current complete-clear assessments, AUD-001 evidence, and external governance/manifest evidence before irreversibly disabling the exception.
14. **Audit boundary is fixed.** Classification is exactly `privilege_security_authority`; successful authoritative access/security mutations and required accountable post-auth denials follow AUD-001. No access/security domain event is created because no named consumer is approved.
15. **Exactly two separate structural slices are selected.** Slice A is one empty, fully revoked, local-only `public.access_grants` table plus focused synthetic pgTAP. Slice B is a later separate PR containing one empty, fully revoked, local-only `internal.security_eligibility_assessments` table plus focused synthetic pgTAP. Neither is implemented here.
16. **The dependency sequence in section 12 is approved.** Gateway, signed-token staging, driver/pool/pooler proof, hosted Supabase, migration/cutover, and Production activation remain separate release work.

Approval is not implementation. The two selected structural slices remain separate future SQL PRs, and every real row, resolver, command, bootstrap, hosted, migration, and release action remains separately gated.

## 16. Validation and exact stop point

Required validation for this document:

- exact starting `origin/main` SHA and PR #110/#111 ancestry;
- relative links resolve;
- the seven Open gates appear exactly and remain unchanged;
- approved facts remain consistent with ID-001, the platform-role contract, AUD-001, SEC-001, the Claim command contract, and the Reviewer/gateway readiness contracts;
- actual migrations/tests support every implemented/absent-object statement;
- `platform_role_assignments` is never described as sufficient authority;
- local profile/link/context state is never described as real authentication;
- bounded sensitive-value scan;
- documentation-only diff; and
- `git diff --check`.

No SQL, pgTAP, script, application code, Docker, Firebase, hosted Supabase, Production/TEST data, migration, seed, backfill, deployment, gate resolution, Ready-for-review transition, or merge is authorized.

**Exact stop point:** the Owner-approved contract and narrowly required baseline/design/register synchronization committed and pushed on the existing `codex/privileged-access-security-readiness` branch, existing PR #112 updated but kept Draft, and the new PR gate triggered on the new head. Stop before either SQL slice, any real role/access/security fact, Reviewer RLS/projections, `supplier_claim.assign_reviewer`, hosted/Production action, Ready transition, or merge.
