# ID-001 Identity Authority and Privileged Actor Contract

Status: **Resolved for the hybrid-phase authority boundary**
Decision date: 2026-08-08
Owner: Product / Security / Data

## 1. Purpose and exact boundary

This contract resolves `ID-001` only for the hybrid phase in which Firebase Auth remains the authentication authority and PostgreSQL is local-only. It makes no choice about a future Supabase Auth cutover, hosted project, RLS policy, trusted runtime, migration execution, or Production authority.

It defines the identity facts that a future trusted operation must use, the minimum privileged-actor proof, and the dependency boundary for `supplier_ownership.decide_claim`. It does not implement that command or create `platform_role_assignments`.

## 2. Decision summary

1. Firebase Auth remains authoritative for credential verification, session/token validity, Firebase UID existence, disablement, email verification, password reset, recovery, and email-action state throughout the hybrid phase.
2. `public.user_profiles.id` is the stable provider-neutral application-person key. Domain tables must reference that UUID, never a Firebase UID or email address.
3. `internal.identity_provider_links` is the restricted mapping from provider subject to the provider-neutral profile. A Firebase UID is represented only as the exact pair `provider_code = firebase` and `provider_subject = <Firebase UID>`.
4. PostgreSQL may retain bounded, trusted mirrors and later relational authorization facts, but no mirror can authenticate a request, prove current Firebase verification/disablement, or select a second authority while Firebase remains authoritative.
5. `public.user_profiles` plus `internal.identity_provider_links` are sufficient as the empty hybrid **identity foundation**. They are not a complete authorization foundation and do not make any actor an Admin, Owner, reviewer, claimant, or Supplier controller.
6. A future fully revoked, empty, local-only `public.platform_role_assignments` foundation is the next required structural dependency before `supplier_ownership.decide_claim` runtime. It is dependency-safe only under the limits in section 7.

## 3. Authority model

| Concern | Hybrid-phase authority | PostgreSQL treatment | Not permitted |
|---|---|---|---|
| Authentication, credentials, sessions, token expiry | Firebase Auth | Record no credential or token; a future trusted boundary validates the current Firebase identity | Browser assertion, profile row, or mirror as authentication |
| Firebase UID existence and disabled state | Firebase Auth | Bounded observed provider-state mirror for reconciliation and fail-closed prechecks | Treating a stale `identity_provider_links` value as current proof |
| Email verification and email change | Firebase Auth | Bounded observed verification/email mirrors only | Linking, merging, or granting authority by email |
| Stable application identity | Provider-neutral `user_profiles.id` | Relational primary/FK identity for domain facts | Firebase UID as a relational PK or domain FK |
| Application profile/context | Current authoritative application provider until a separately approved feature cutover | `user_profiles` may retain trusted context/status and bounded legacy evidence | Conflating context with platform role or ownership |
| Platform Admin/Owner authority | A future trusted relational authorization boundary after its own approved implementation | Protected role-assignment and eligibility facts | JWT application-role claim, client field, or profile legacy role |
| Supplier control | `supplier_ownerships` only after its separate activation/runtime approvals | Future temporal ownership facts keyed by `user_profiles.id` | Provider link, role, email, organization, or membership as ownership |

The future Postgres authorization boundary may authoritatively evaluate current relational role, account, ownership, and eligibility facts only after a separately approved provider-validation and trusted-operation design exists. During the hybrid phase it must still reject a missing, invalid, disabled, mismatched, unverified where required, or stale Firebase identity; it cannot supersede Firebase Auth for those provider facts.

## 4. Provider-neutral identity and link lifecycle

### 4.1 Stable identity

`public.user_profiles.id` is immutable application identity. It survives a future provider addition, provider replacement, display-email change, account-context correction, or historical link closure. All future domain relationships—including ownership, Claims, role assignments, memberships, audit actors, events, and idempotency principals—use this UUID.

`normalized_email`, `display_email`, `legacy_firestore_id`, `legacy_role`, and `legacy_account_type` are bounded profile or migration evidence. None is a principal key, a provider link, or an authorization input by itself.

### 4.2 Firebase link rules

The existing active-link uniqueness objects establish the required structural base:

- one active `(provider_code, provider_subject)` maps to exactly one profile;
- one profile has at most one active primary link for a provider; and
- all link/profile foreign keys are restrictive.

The future trusted reconciliation or link command must enforce the following operational rules:

- The Firebase UID is copied exactly from validated Firebase provider evidence; it is never normalized, derived from an email, or supplied by a browser as an authority assertion.
- A duplicate active UID/profile mapping, two candidate profiles for one UID, a UID that disagrees with trusted source evidence, or an attempt to relink a historical subject to another profile is a quarantine case. It grants no access and requires approved reconciliation evidence.
- Unlinking closes the existing link history; it does not delete a profile, rewrite domain references, or make the subject reusable for another profile by default. A future exceptional relink requires an explicit trusted reconciliation decision, preserved old/new provenance, and no conflicting active or historical principal claim.
- A disabled or deleted Firebase account makes the related provider principal unusable immediately at the future trusted boundary. A mirror may be corrected to `disabled` or closed after observation, but a failed, unknown, or stale refresh never preserves privilege.
- An email change updates only bounded observed email mirrors after Firebase evidence is refreshed. It creates no automatic profile match, link replacement, role change, or ownership change. If Firebase requires renewed verification, the future trusted boundary treats verification as no longer proven until current evidence passes.
- A Firebase verification transition updates only a mirror/provenance record. A `verified` mirror cannot grant privilege without current Firebase evidence; `unknown`, `unverified`, inconsistent, or stale evidence fails closed wherever verification is required.

The empty foundation has no Auth bridge, synchronization job, trigger, client access, reconciliation execution, or data row. Those remain separate work.

## 5. Identity is not authorization

| Concept | Meaning | Does not establish |
|---|---|---|
| Firebase authentication identity | The current Firebase-authenticated provider subject | Application profile, role, access, or Supplier authority |
| `public.user_profiles` | Provider-neutral application-person and bounded account/context record | Authentication, Admin/Owner, reviewer, membership, or ownership |
| `internal.identity_provider_links` | Restricted provider-subject mapping and observed provider state | Current provider proof if stale, application privilege, or Supplier control |
| `platform_role_assignments` (future) | Temporal, trusted platform Admin/Owner assignment | Supplier ownership, organization membership, or direct browser access |
| `supplier_ownerships` (separate slice) | Temporal primary human controller relationship | Delegate/admin access, organization identity, or platform role |
| `supplier_memberships` (future) | Delegated Supplier operations under a separate contract | Primary ownership, reviewer authority, or organization membership |
| Organizations (future) | Optional legal/tenant relationship under `ORG-001`/`ORG-002` | Platform role, Supplier ownership, or an inferred membership |
| RLS/trusted operations (future) | Enforced request authorization using current evidence | A source of identity or a substitute for data/command contracts |

`account_context` remains Buyer/Supplier business context. It is not a PostgreSQL role, a platform privilege, or an organization role. Legacy role values remain evidence until a future trusted assignment creates a separate platform-role fact.

## 6. Minimum privileged-actor proof

A future reviewer, Admin, or Owner may execute a sensitive trusted operation only when one atomic current-state evaluation proves all of the following:

1. a current Firebase-authenticated subject accepted by the approved provider-validation boundary;
2. exactly one linked provider-neutral profile, with no duplicate, mismatch, quarantine, unlink, disabled, or stale provider evidence;
3. an active, non-suspended, policy-compatible `user_profiles` record;
4. current Firebase verification and non-disabled status where the command requires it;
5. an active, effective, unexpired trusted platform Admin or Owner assignment appropriate to the action;
6. the separately approved trusted-administration eligibility/access policy, including every explicit deny, security hold, and final-usable-Owner safety condition; and
7. action-specific conflict checks. For Claim review this excludes the claimant, current/proposed primary owner, active Supplier delegate/member/admin, and every recorded conflict or security hold for the target Supplier.

Any missing, ambiguous, conflicting, disabled, stale, expired, suspended, or unapproved fact denies the operation without revealing unrelated identities, roles, ownerships, or Claims. A browser never selects the actor profile, platform role, reviewer authority, or conflict outcome.

The existing identity foundation satisfies items 2 and the provider-neutral portion of item 3 structurally. It does not yet provide items 1, 4 through 7, or trusted serialization. Therefore it is sufficient for identity, but not for privileged runtime authorization.

## 7. Future `platform_role_assignments` foundation

### 7.1 Required before trusted Claim decisions

`supplier_ownership.decide_claim` requires a current relational Admin/Owner assignment. Existing `user_profiles.legacy_role`, Firebase token metadata, Firestore role text, account context, ownership, and organization facts cannot safely substitute for a temporal trusted assignment. Therefore `platform_role_assignments` is required before that command is implemented.

The role table alone is not a runtime authorization grant. The future command also requires the provider-validation boundary, current account/security eligibility, conflict checks, approved Claim/ownership aggregates, AUD-001, the REL-001 implementation path, and MSG-003 materialization policy.

### 7.2 Minimum Product/Security/Data contract

The later technical contract must create no role beyond the minimal platform codes `owner` and `admin`, and must include:

- immutable UUID row identity and a restrictive `user_profile_id` FK;
- bounded role code, trusted lifecycle (`active`, `revoked`, `expired`), effective/terminal times, record version, and trusted creation/closure times;
- assign/revoke/expire provenance as provider-neutral actor/system references with bounded reason codes; provenance never grants authority;
- explicit no-overlap/one-effective-active-role enforcement absent a separately approved exception, with Owner and Admin mutually incompatible;
- trusted-only assignment, revocation, expiry, correction, and final-usable-Owner protection; no normal hard delete or self-assignment;
- no organization or Supplier relationship, no membership, no access-ledger implementation, no JWT application-role claim, no client projection, and no RLS/policy in the structural slice; and
- full revocation from `public`, `anon`, `authenticated`, and `service_role`, with no browser/application access path.

The exact SQL columns, constraints, indexes, clock/concurrency strategy, pgTAP plan, and final-Owner recovery workflow remain a separate technical task.

### 7.3 Empty structural-slice conclusion

An empty, fully revoked, local-only `public.platform_role_assignments` foundation is dependency-safe as a future one-table SQL slice if it references only existing `public.user_profiles`, contains zero role rows, and satisfies section 7.2. It does not require `ORG-001`, `ORG-002`, `AUD-001`, `MSG-003`, `REL-001`, `FILE-001`, `MIG-002`, or `RES-001` merely to create its empty structural boundary.

It must not create a role assignment from legacy role text, Firebase custom claims, or any Production data; create an organization/member relation; add browser/API grants; implement a role-management command; or represent a role row as proof of an active Firebase session, verification, or administration eligibility.

## 8. Claim-command dependency decision

`supplier_ownership.decide_claim` remains design-only. Before runtime implementation, the following must exist and be approved together:

1. this ID-001 hybrid authority contract, plus a reviewed provider-validation/trusted-ingress design;
2. implemented and tested `platform_role_assignments` with the complete current privileged-actor predicate and a non-stranding final-Owner recovery model;
3. approved Claim aggregate, reviewer assignment, conflict, evidence, retention, and ownership activation relations/constraints—not the empty ownership table alone;
4. `AUD-001` decision audit contract and implementation;
5. the coherent REL-001 idempotency/domain-event foundation and its approved operational lease/retry/dead-letter controls;
6. `MSG-003` notification-materializer policy and implementation for the named consumer;
7. reviewed trusted-command/RLS/projection security boundary and positive/negative synthetic authorization tests; and
8. source-specific migration/reconciliation and hosted-environment approvals only when the command is proposed beyond local synthetic validation.

`ORG-001` and `ORG-002` do not block version-1 ordinary Claims for an unowned Supplier. `FILE-001` does not block version 1 while the approved bounded non-file evidence descriptors are used; it blocks any file-backed evidence. `MIG-002` and `RES-001` do not block empty local SQL, but block hosted/Production execution. No runtime may infer a Claimant or reviewer from a Firebase UID, email, ownership row, or legacy role.

## 9. Reconciliation and migration requirements

No migration is authorized by this contract. A later reconciliation process must:

- preserve Firebase UID, Firestore document ID, provider subject, source version/observation time, and approved evidence reference without storing token, credential, or complete provider record;
- establish one explicit disposition for each identity source record and link candidate: migrated, linked, unchanged, skipped, quarantined, rejected, merged only under an approved merge record, or no-target;
- verify exact one-to-one active Firebase UID to profile mapping and reject duplicate/cross-profile collisions;
- reconcile profile lifecycle/context and provider disablement/verification with timestamps and source versions, treating missing or stale evidence as unusable for privileged work;
- keep email changes as attributes only, never a matching key or automatic merge basis;
- re-evaluate complete authority after every link/profile/provider/role/access/security correction, expiry, disablement, or unlink; and
- retain a provider-authority manifest naming exactly one authority for every feature and cutover phase, with a fail-closed conflict queue and no dual-authority fallback.

Reconciliation reports use counts, disposition totals, and safe sample keys only. They do not expose credentials, tokens, full Firebase records, account emails, or Production data.

## 10. Gate impact

| Gate or dependency | Empty role-table foundation | `supplier_ownership.decide_claim` runtime |
|---|---|---|
| `ID-001` | **Resolved by this contract** | No longer a gate; provider-validation implementation remains required |
| `platform_role_assignments` | The selected next structural dependency | Required and insufficient alone |
| `AUD-001` | Does not block empty local DDL | **Blocks** required decision-audit implementation |
| `MSG-003` | Does not block empty local DDL | **Blocks** the named notification materializer/delivery path |
| `REL-001` Option D | Does not block empty local DDL | Requires later coherent implementation plus operational approval; Option D is planning-resolved, not implemented |
| `ORG-001` / `ORG-002` | Do not block | Do not block version-1 unowned-Supplier Claim; block any later organization authority |
| `FILE-001` | Does not block | Does not block controlled non-file evidence; blocks file-backed evidence |
| `MIG-002` / `RES-001` | Do not block local DDL | Block hosted/Production execution and data movement, not documentation or empty local DDL |
| `RFQ-003`, `MSG-002`, `SEARCH-001`, `BILL-001` | Do not block | Do not block Claim decision version 1 |
| `SEC-001` and trusted-operation design | Does not block empty DDL | Required security delivery work; it is a recommendation, not one of the remaining Open gates |

After this decision there are 11 Open approval gates: `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 11. Decision status, remaining owner decisions, and stop point

`ID-001` is resolved contractually for the hybrid phase. It does not resolve a future Firebase-to-Supabase Auth migration, select an Auth provider after the hybrid phase, authorize a hosted project, or make PostgreSQL a Production authentication authority.

The remaining Owner decisions for Claim runtime include the `AUD-001` and `MSG-003` gates, the later technical/operational approval of the REL-001 foundation, the exact privileged-role implementation and recovery contract, Claim/ownership runtime selection, and the required security/RLS/trusted-command review. `ORG-001`, `ORG-002`, `FILE-001`, `MIG-002`, and `RES-001` retain the scope stated in section 10.

Exact stop point: documentation contract only. Do not create SQL or pgTAP, role/ownership/Claim rows, Auth bridge, RLS, trusted command, audit/event/notification logic, organization or membership relation, migration, hosted access, Firebase access, Production/TEST data operation, merge, or deployment.

## 12. References

- [`01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
- [`03_PRODUCT_AND_BUSINESS_RULES.md`](../ai-context/03_PRODUCT_AND_BUSINESS_RULES.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`03_AUTH_AND_IDENTITY_OPTIONS.md`](03_AUTH_AND_IDENTITY_OPTIONS.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`../../supabase/migrations/20260804000200_provider_neutral_identity_foundation.sql`](../../supabase/migrations/20260804000200_provider_neutral_identity_foundation.sql)
