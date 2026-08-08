# ID-001 identity authority and privileged actor contract

Status: **Owner-approved Product/Security/Data contract; ID-001 Resolved for the hybrid phase; `public.platform_role_assignments` selected as the next identity/access structural SQL candidate; no SQL or runtime implementation authorized**

Date: 2026-08-08

Successor note: merged PR #85 implemented `public.supplier_ownerships`; current `main` is `22da8db4433c4fe7ca90ebe3b776a4da0a86eef2` with 17 physical tables, 15 implemented / 21 deferred Core Phase 1 concepts, and 11 Open gates. Owner-approved [`34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md`](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) fixes the exact role vocabulary, lifecycle/cardinality/provenance, protected bootstrap, and Claim-review boundary while preserving this approved ID-001 contract, and selects the empty role table as the next SQL slice. Separate SQL/runtime work remains required.

## 1. Decision scope and verified starting point

This document answers the minimum identity-authority questions required before a future relational `supplier_ownership.decide_claim` command can trust a claimant, reviewer, or decision actor. It does not change the currently deployed Firebase application, select Supabase Auth, or authorize an Auth bridge.

The verified repository starting point is refreshed `origin/main` commit `66698525e6aaba4522f9bef44adef57a05f4a067`, the merge of PR #82. At that commit:

- local SQL contains 16 physical tables representing 14 implemented Core Phase 1 concepts; 22 concepts remain deferred;
- `public.user_profiles` and `internal.identity_provider_links` are implemented as empty-capable, fully revoked, local-only identity foundations;
- `public.platform_role_assignments` does not exist;
- SUP-001 is Resolved and one empty, revoked `public.supplier_ownerships` foundation is approved for separate implementation;
- REL-001 is Resolved only for Option D planning, with no reliability SQL selected;
- before this contract's approval, the 12 Open gates were `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`;
- Firebase Auth remains authoritative for passwords, sessions, provider account existence/disablement, email verification, recovery, and email actions;
- Firestore remains the current application-profile and role authority for the Firebase runtime; and
- Supabase is local-only and non-authoritative. No hosted Supabase project is known or authorized here.

The repository's undeployed trusted Firebase callables are implementation evidence, not deployed behavior. They validate the current Firebase user, reject disabled/unverified or stale/mismatched identity evidence, re-read Firestore application role/status/access, and protect the final usable Owner. The relational contract preserves those security properties without copying Firebase storage shape.

## 2. Decision summary

The smallest safe hybrid architecture is:

1. Firebase Auth is the sole authentication and email-verification authority during the hybrid phase.
2. `public.user_profiles.id` is the stable provider-neutral application principal referenced by domain data.
3. `internal.identity_provider_links` maps the exact Firebase UID to that principal and stores only trusted, time-stamped provider-state mirrors and bounded provenance.
4. `public.platform_role_assignments` is the required temporal source of relational Owner/Admin role authority before any relational Claim decision runtime.
5. A role assignment is necessary but never sufficient: a usable privileged human also needs current Firebase authentication evidence, an active profile, an exact active provider link, compatible account context, current platform-administration access, no security deny/quarantine, and command-specific reviewer/conflict eligibility.
6. Supplier ownership and future Supplier/organization memberships remain separate authorization relationships and never imply platform privilege.
7. Domain rows reference `user_profiles`; provider-link IDs never become claimant, owner, reviewer, decision-actor, creator, updater, recipient, or membership foreign keys.
8. Missing, stale, duplicated, ambiguous, or contradictory identity/role evidence fails closed and enters reconciliation; no link or privilege is inferred from email, name, organization, legacy role text, or one-sided Supplier backlinks.

On 8 August 2026, the Product/Security/Data Owner approved this complete contract. ID-001 is therefore Resolved for the hybrid phase without selecting a post-Firebase provider. The 11 unrelated Open gates remain unchanged.

## 3. Authority separation

| Concern | Hybrid-phase authority | PostgreSQL may store | PostgreSQL must not decide or infer |
|---|---|---|---|
| Authentication | Firebase Auth | provider code/subject linkage, bounded observation evidence, last trusted observation time/version | passwords, session validity, token signature/issuer/audience, Firebase account existence, disablement, or deletion from a mirror alone |
| Email verification | Firebase Auth | link-specific verification mirror, observation time/version/evidence, optional profile-level derived mirror | independent verification, verification from an email string, or continued verification after stale/contradictory evidence |
| Application principal/profile | PostgreSQL after the applicable feature cutover; Firestore remains current authority before then | stable profile UUID, lifecycle, account context, contact/support fields, legacy evidence | authentication, platform role, Supplier ownership, or organization membership from profile fields |
| Platform privilege | Temporal `platform_role_assignments` plus current eligibility/access after a separately approved relational role cutover | Owner/Admin assignment history, status/interval, actors, policy version | privilege from JWT application claims, `legacy_role`, account context, email/domain, provider link, or browser input |
| Supplier ownership | `supplier_ownerships` only after its separately approved authority cutover | temporal verified controller relationship and provenance | ownership from platform role, email/domain, organization text, membership, listing status, or one Firebase backlink |
| Organization/Supplier membership | Future approved membership relations | temporal membership and delegation after ORG/Supplier-membership approval | membership from account context, free-text organization, platform role, or ownership |
| RLS/data access | Later reviewed policies and trusted commands | current authorization inputs and field-minimized projections | authentication or cross-domain authority; RLS does not replace trusted command invariants or column minimization |

Exactly one authority manifest applies per environment and concern. This contract does not authorize Production dual writes, fallback authorization, or a mixed Firestore/PostgreSQL role decision inside one command.

## 4. Options considered

| Option | Description | Assessment |
|---|---|---|
| A | Keep Firebase UID/Firestore user document as every relational domain key and role source | Reject. It preserves provider coupling, prevents portable domain references, and keeps future relational authorization dependent on Firestore shape. |
| B | Use `user_profiles` as the durable principal, `identity_provider_links` for Firebase subject/state, and a separate temporal platform-role plus access boundary | **Recommend.** It is the smallest model that separates authentication, application identity, privilege, ownership, and membership while preserving Firebase authority. |
| C | Put current Owner/Admin directly on `user_profiles` | Reject. It loses temporal grant/revocation provenance, encourages profile fields to become privilege, and cannot safely express final-Owner serialization. |
| D | Use `identity_provider_links`, JWT role/application claims, or email as the domain/privilege key | Reject. Provider links are replaceable security mappings, JWT application claims can be stale or caller-controlled through the wrong channel, and email is mutable/non-unique authority evidence. |
| E | Delay every identity decision until a future Supabase Auth design | Reject. The hybrid phase already needs a safe Firebase-authoritative contract; provider-neutral principals allow that decision without designing or selecting Supabase Auth. |

## 5. Provider-neutral identity contract

### 5.1 Stable application principal

`public.user_profiles.id` is the durable application person/profile identity. It is database-generated, opaque, and independent of Firebase UID, email, role, Supplier, organization, or any future provider subject.

All durable domain references to a human principal use this UUID. A provider migration adds or changes a provider link; it does not rewrite ownership, Claim, RFQ, quotation, notification, audit, membership, or actor references.

`legacy_firestore_id` is migration evidence and an alternate source key only. It is not authentication evidence or a general authorization relationship.

### 5.2 Firebase linkage

During the hybrid phase, the accepted Firebase identity maps only through an exact active row where:

- `provider_code = 'firebase'`;
- `provider_subject` exactly equals the validated Firebase UID;
- `link_status = 'linked'`;
- the row maps to exactly one `user_profile_id`; and
- current provider/account evidence passes the command's freshness requirements.

The provider subject is immutable on a row. Email, phone, display name, organization text, token claims other than the validated provider identity, or a matching Firestore email never create or repair a link.

The implemented partial unique indexes are necessary but not the whole trusted-linking contract. They prevent two active profiles from sharing one provider subject and prevent two active primary links for the same profile/provider. Trusted linking and reconciliation must additionally reject conflicting historical subject-to-profile lineage unless an explicit correction process proves that the earlier link was erroneous. An ordinary unlink never makes the same provider subject safe to attach silently to a different profile.

### 5.3 Collision and duplicate handling

The following conditions are quarantined and authorize nothing:

- one Firebase UID associated with more than one candidate profile in source or history;
- one profile associated with multiple competing active Firebase subjects;
- Firestore document ID, embedded UID, provider subject, or migration mapping disagreement;
- provider subject already linked to another profile, including contradictory historical lineage;
- duplicate profile candidates matched only by email, phone, name, or organization;
- a missing profile, provider link, migration disposition, or required evidence version; or
- a relink request whose prior unlink/correction authority is not explicit.

Resolution requires a reviewed disposition, bounded evidence, accountable human or approved system source, and a trusted correction/link command. Reconciliation never guesses and never silently merges profiles.

## 6. Email-verification and provider-state mirrors

Firebase Auth remains authoritative for whether a Firebase identity currently exists, is disabled, and has a verified email. PostgreSQL mirrors are security inputs only after a trusted Firebase observation; they are not independent facts.

For a high-impact command such as `supplier_ownership.decide_claim`:

1. a trusted backend validates the Firebase token's signature, issuer, audience, expiry, subject, and required transport role;
2. it obtains current Firebase Admin user state for that exact UID in the command authorization flow;
3. it requires the token email/verification evidence and current Firebase record to agree where email verification is required;
4. it resolves the exact active provider link and active profile;
5. it refreshes or compares the link-specific mirror under a versioned policy; and
6. any lookup failure, provider outage, stale observation outside the approved high-risk-command window, mismatch, missing email, disabled account, deleted/not-found account, or verification loss denies the command without mutating domain state.

For this first high-risk command, the minimum safe freshness rule is a current Firebase Admin observation in the authorization attempt. A later short-lived cache requires separate evidence, an explicit maximum age, invalidation behavior, and proof that disablement/verification loss meets the required revocation latency.

`identity_provider_links.verification_status` is the link-specific mirror. `user_profiles.verification_mirror_status` is at most a trusted derived convenience projection and cannot override a link-specific mismatch or Firebase. Neither mirror grants a role, trial, ownership, or membership by itself.

Email changes update only trusted support/display fields and provider observation evidence. They do not change `user_profiles.id`, relink an identity, merge profiles, transfer ownership, or preserve a prior verified result. A changed or mismatched email requires a fresh Firebase-authoritative observation and recomputation of every verification-dependent eligibility input.

## 7. Privileged human actor contract

### 7.1 Platform roles

Platform Owner/Admin are temporal trusted assignments, not account contexts, PostgreSQL roles, organization roles, Supplier memberships, Supplier ownerships, or JWT application claims.

Absent a separately reviewed exception, one profile has at most one effective active platform role across `owner` and `admin`; the roles are mutually incompatible. Legacy `owner`/`admin` values are migration candidates only after reconciliation. Legacy `contributor`/`viewer` remain non-privileged evidence, `suspended` maps to account state, and Buyer/Supplier map to account context.

Only a trusted role-administration command may create, revoke, expire, correct, or supersede an assignment. The browser may request an operation but never supplies the effective actor, role provenance, policy version, timestamps, or final authorization result.

### 7.2 Usable Owner/Admin predicate

A human is usable for a privileged command only when all of the following are true in the same authorization attempt and policy version:

- the request has a current validated Firebase identity and current non-disabled, existing Firebase account;
- required Firebase email verification is current;
- one exact active Firebase provider link resolves to one profile;
- the profile is active, not suspended/deactivated, and has compatible `buyer` platform-administration context;
- one active, in-time Owner or Admin assignment exists;
- a current trusted platform-administration access grant exists;
- no active security deny, quarantine, unresolved identity conflict, or contradictory mirror exists;
- the command-specific role permits the operation; and
- command-specific assignment, conflict-of-interest, and target-state checks pass.

Missing or contradictory evidence denies the command. A role assignment alone never authorizes. A verified Firebase account alone never authorizes. A valid session never restores a suspended profile, revoked role, expired access grant, ownership, or membership.

While an Owner assignment is usable, its role-backed platform-administration grant is non-expiring and separate from trial/subscription product access. Demotion, revocation, correction, provider disablement/unlink, verification loss, profile/context change, security deny, or access closure must use the common Owner-eligibility serialization guard. The transaction locks and re-reads the complete usable-Owner candidate set and fails if the proposed change would leave fewer than one usable Owner.

An Admin may perform only operations assigned to Admin policy. Only an Owner may alter privileged assignments or use an expressly approved Owner override. Self-promotion, browser writes, client claims, and direct table grants are prohibited.

### 7.3 Reviewer and decision actor

For Claim v1, a reviewer/decision actor must satisfy the usable Admin/Owner predicate and also:

- hold the current immutable/review-versioned Claim assignment, unless using a separately approved Owner override/reassignment path;
- not be the claimant;
- not be the current or proposed owner of the target Supplier in another role;
- not be an active member/admin/delegate of that Supplier when those relations later exist; and
- have no recorded conflict or security hold.

The claimant cannot be impersonated by an operator. Rejection and approval both require current actor/Claim integrity; approval additionally revalidates current claimant Firebase/profile/link/account eligibility.

## 8. Actor references and provenance

Human domain actors reference `public.user_profiles.id`:

| Provenance | Required reference | Additional trusted evidence |
|---|---|---|
| Claimant | `claimant_user_profile_id` | submission-time provider class, current eligibility result, policy/evidence versions in restricted command/audit evidence |
| Assigned reviewer | `reviewer_user_profile_id` | assignment/version, assigning actor, assigned-at, conflict result |
| Decision actor | `decided_by_user_profile_id` | active `platform_role_assignment_id`, authorization-policy version, current provider-validation result, decision time |
| Ownership establishment/closure human | user-profile actor FK | source-specific command/evidence and role/relationship provenance |
| System/service actor | no fabricated user profile | explicit `actor_kind` value of `system` or `service`, bounded code/service principal, source operation, policy/version, and nullable initiating human where one exists |

`identity_provider_links.id` must never be a domain actor or party FK. A link can be disabled, unlinked, corrected, or supplemented while the accountable application principal and their historical domain actions remain stable. Provider subject/state belongs in restricted authentication/reconciliation evidence, not normal domain payloads, notifications, or public projections.

An ordinary `supplier_ownership.decide_claim` decision requires a human reviewer/decision actor. A system actor may expire a Claim, reconcile a mirror, fence work, or materialize a notification only through its separately approved command/worker contract. It cannot masquerade as a human claimant or reviewer.

## 9. Lifecycle behavior

| Condition | Identity/link treatment | Authorization result | Historical treatment |
|---|---|---|---|
| Active Firebase identity | Exact link remains linked; current provider observation may be mirrored | Eligible only if every profile/role/access/command predicate also passes | Preserve observation version/time without tokens or full provider record |
| Disabled Firebase account | Preserve link association; mirror `identity_status = disabled`, clear/non-authorize verification as required by current constraints | Immediate fail closed for new privileged/domain commands | Preserve prior domain actors and bounded disablement provenance |
| Deleted/not-found Firebase account | Do not invent disablement or unlink; record a trusted non-authorizing `not_found` observation through the future bridge/reconciliation contract and treat state as unknown/unusable | Fail closed; no session or privilege | Preserve provider subject/link lineage and all profile/domain history |
| Provider unlink | Close the link explicitly with actor/system provenance; do not delete it | That link authorizes nothing; hybrid Firebase commands require another exact approved Firebase link | Preserve immutable row and prior observations |
| Provider relink/correction | Create a new active link only through trusted reviewed recovery; same-subject/different-profile history is a quarantine condition | No authority until collision checks and current Firebase observation pass | Preserve old row and correction lineage; never overwrite subject/profile history |
| Email change | Refresh provider and profile mirrors/support fields; email is not a link key | Fail closed while token/provider/profile evidence disagrees | Retain only bounded required historical evidence under later retention rules |
| Verification loss/change | Refresh link mirror and derived profile mirror; never retain `verified` as usable against current Firebase evidence | Recompute and deny verification-dependent role, Claim, ownership, or access actions; invoke final-Owner guard where applicable | Preserve bounded prior observation and correction provenance |
| Profile suspension | Keep links/history; profile becomes non-authorizing | Deny all privileged use and affected domain access | Actor/domain FKs remain `ON DELETE RESTRICT` |
| Profile deactivation/archive | Keep profile and links as historical principal; no hard delete of referenced identity | Deny new authentication-to-domain resolution and privilege | Preserve auditability; later privacy action may minimize allowed profile fields without inventing Auth state |

The provider-link row is a current-state mirror, not a complete provider-observation ledger. Re-enablement or verification recovery may replace current mirror timestamps/state only after a fresh trusted observation; any required prior disablement, not-found, verification-loss, or correction history belongs in separately approved audit/security/reconciliation evidence. The current link schema can fail closed for deleted/not-found provider accounts by using non-authorizing state plus bounded evidence; an exact persisted deletion-observation vocabulary may be added only with the future bridge/runtime contract. It is not required to change the existing empty local identity foundation now.

## 10. Migration and reconciliation contract

No migration, seed, backfill, hosted access, or Production user read is authorized by this document. A future approved reconciliation must:

1. use a protected, count/minimum-field manifest rather than email matching;
2. reconcile Firebase Auth UID, Firestore `users/{uid}` document ID/embedded UID, `user_profiles.legacy_firestore_id`, identity-provider link, and migration disposition/mapping;
3. create one deterministic profile target and one distinct provider-link target per accepted source identity;
4. validate current Firebase existence, disablement, and verification through an approved bounded Admin process;
5. classify legacy role separately from account context/status/access and never activate Owner/Admin from raw text alone;
6. quarantine missing, duplicate, conflicting, or ambiguous identities and roles;
7. require an explicitly approved bootstrap manifest and trusted command/process for the first relational Owner assignments;
8. prove at least one usable Owner remains before any relational role-authority cutover and after every eligibility-affecting correction;
9. retain source hashes, versions, zero-to-many mapping evidence, correction/supersession lineage, and rollback dependencies without exposing user records; and
10. stop on any unexplained count, fingerprint, link, role, or authority-manifest difference.

No reconciliation result changes Firebase credentials, verification, disablement, email, role, or Production data in this task.

## 11. `platform_role_assignments` structural dependency

### 11.1 Is it required?

Yes. `public.user_profiles` plus `internal.identity_provider_links` are sufficient as the hybrid provider-neutral identity foundation, but they deliberately contain no platform privilege. A future relational `supplier_ownership.decide_claim` cannot derive Admin/Owner authority from `legacy_role`, account context, provider links, ownership, membership, JWT application claims, or Firestore after the relational role cutover. Therefore `public.platform_role_assignments` is a required structural dependency before that runtime.

It is necessary, not sufficient. Runtime also requires the exact access-grant/role-backed administration contract, role/bootstrap reconciliation, trusted role commands and final-Owner guard, implementation of this approved identity contract, Claim structures, AUD-001, the REL/MSG producer-consumer foundation, security/RLS delivery, and hosted-environment approvals where applicable.

### 11.2 Is an empty local-only foundation safe?

Yes. The Owner selected exactly one empty, fully revoked, local-only temporal role-assignment table as the next identity/access structural SQL candidate. Exact DDL/pgTAP remains a separate technical task. The selected candidate has:

- database-generated UUID identity;
- restrictive FKs to the subject and human assignment/revocation actors in `user_profiles`;
- `owner|admin` role vocabulary only;
- explicit active/revoked/expired or equivalent temporal lifecycle;
- valid-from/valid-until and immutable creation/assignment provenance;
- authorization-policy version and bounded legacy/reconciliation evidence references;
- one effective active platform role per user absent a reviewed exception, with Owner/Admin incompatibility;
- restrictive delete behavior, structural indexes/comments, and complete PUBLIC/`anon`/`authenticated`/`service_role` privilege revocation; and
- no rows, RLS, policy, browser/API grant, function, trigger, Auth bridge, access grant, migration execution, role bootstrap, Firebase call, hosted operation, or Production/TEST action.

To avoid a circular structural dependency, `platform_role_assignments` does not FK forward to `access_grants`. A later `access_grants` row may reference its Owner assignment. The role-assignment row can carry no effective privilege until the trusted runtime verifies the separate current administration grant and every other usable-actor predicate.

This documentation PR selects the candidate but does not authorize or implement SQL. Exact status vocabulary, columns, constraints, indexes, and pgTAP belong to a separate technical implementation task. No real assignment row is safe until bootstrap/migration authority, access-grant behavior, audit/security outcomes, trusted commands, concurrency/final-Owner tests, and authority cutover are separately approved.

## 12. Claim dependency and gate matrix

| Gate/dependency | Empty revoked `platform_role_assignments` foundation | Real role/identity rows | `supplier_ownership.decide_claim` runtime |
|---|---|---|---|
| ID-001 | **Resolved**; selected candidate may proceed only in a separate SQL/pgTAP task | Approved contract must still be implemented before real rows | Approved contract must still be implemented for actor and claimant authentication/provider validation |
| SUP-001 | Does not block | Ownership contract governs relationships | Resolved for design; command still not implementation-authorized |
| ORG-001 / ORG-002 | Do not block | Do not block platform roles; block organization-derived authority | Do not block unowned-Supplier Claim v1; required only if organization authority is later added |
| Platform-role/access contract | Empty role table may precede access table under section 11 | Bootstrap, role-backed access, trusted commands, and final-Owner safety required | Required; assignment alone is insufficient |
| AUD-001 | Does not block empty table | Blocks auditable non-synthetic privilege mutation | Blocks required decision attempt/outcome audit |
| MSG-003 and REL-001 | Do not block | Do not block inert roles | Block the approved event-to-notification delivery path and coherent reliability foundation |
| FILE-001 | Does not block | Does not block roles | Not required if Claim v1 uses only approved bounded non-file evidence; required for stored file objects |
| RLS/security delivery | Does not block a fully revoked table | Blocks exposed/direct access and real client use | Requires reviewed trusted-command/RLS/projection tests; browser direct privilege writes remain forbidden |
| MIG-002 / RES-001 | Do not block local-only DDL | Block hosted identity/role migration | Block hosted/Production execution |
| RFQ-003, MSG-002, SEARCH-001, BILL-001 | Do not block | Do not block | Do not block Claim v1 |

ID-001 resolves the contractual decisions for exact Firebase authority, token/current-user validation, provider-link resolution, mirror freshness/mismatch rules, stable principal references, usable privileged-actor predicate, platform-role necessity, claimant/reviewer/decision provenance, lifecycle fail-closed behavior, and reconciliation/quarantine rules. `supplier_ownership.decide_claim` remains blocked until those approved contracts and the other dependencies in this section are implemented.

The following may remain deferred until their named implementation phase: Supabase Auth or another future provider, provider migration/cutover, exact Auth bridge code, exact RLS policies, exact role/access DDL, migration execution, hosted project choice, organization/membership design, notification rendering/retention, audit retention, and file storage. Deferral does not permit the Claim runtime to bypass any dependency named above.

## 13. Explicit answers

### A. Can ID-001 be resolved contractually now while Firebase Auth remains authoritative?

**Yes.** It is Resolved for the hybrid phase by naming Firebase Auth as the sole authentication/email-verification/disablement authority and PostgreSQL as a provider-neutral profile, linkage-mirror, and later application-authorization store. A future provider/cutover requires a new approved ADR; it is not an ambiguity inside ID-001.

### B. Are `user_profiles` and `identity_provider_links` sufficient for the hybrid identity foundation?

**Yes for identity foundation; no for privileged authorization.** They provide stable domain principals, provider portability, exact Firebase UID mapping, lifecycle mirrors, and collision constraints. They do not validate tokens, refresh provider state, grant roles/access, or authorize Claim decisions.

### C. Is `platform_role_assignments` required before `supplier_ownership.decide_claim` runtime?

**Yes.** It is the minimum separate relational source for temporal Owner/Admin authority. It must be combined with current Firebase/profile/link/access/security and Claim-specific reviewer/conflict checks.

### D. Is an empty revoked role foundation dependency-safe as a future slice?

**Yes, under section 11's restrictions.** `public.platform_role_assignments` is selected as the next identity/access structural SQL candidate. It may precede `access_grants` if it contains no forward FK to access grants and grants no effective authority. Exact DDL/pgTAP remains separate. Before any real row or runtime it needs the additional bootstrap, access, audit/security, trusted-command, reconciliation, and cutover approvals.

### E. Which gates block Claim approval runtime versus empty structural SQL?

For empty local-only role DDL, ID-001 is Resolved and the candidate is selected; exact technical DDL/pgTAP remains the next separate task. For Claim runtime, platform-role/access/bootstrap implementation, implementation of the approved identity contract, AUD-001, MSG-003 plus the coherent REL foundation/consumer, trusted-command and RLS/security approval, and hosted MIG-002/RES-001 approval are blockers. FILE-001 is conditional on stored file evidence. ORG-001, ORG-002, RFQ-003, MSG-002, SEARCH-001, and BILL-001 do not block the unowned-Supplier Claim v1 contract.

## 14. Owner approval record and stop point

On 8 August 2026, the Product/Security/Data Owner approved this contract as one decision:

- Firebase Auth remains sole hybrid authentication and email-verification authority;
- `user_profiles` is the stable domain principal and `identity_provider_links` is a non-domain provider mapping/mirror;
- the usable privileged-actor predicate and fail-closed lifecycle/reconciliation rules are approved;
- `platform_role_assignments` is required before relational Claim decision runtime; and
- the empty revoked `public.platform_role_assignments` table is dependency-safe and selected as the next identity/access structural SQL candidate under section 11, without authorizing or implementing SQL in this PR.

ID-001 is Resolved for the hybrid-phase contract. The Open-gate count is reduced from 12 to 11; only ID-001 is removed, and every unrelated Open gate is preserved.

This task stops at documentation and PR #83 Ready for review. It performs no SQL, pgTAP, RLS, Auth bridge, role assignment, trusted command, Firebase/config change, hosted Supabase access, Production/TEST data access, migration, seed, backfill, deployment, or merge.
