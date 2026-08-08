# Platform role assignments Product/Security/Data contract

Status: **Owner-approved complete Product/Security/Data contract; exactly `owner|admin`; one empty, fully revoked, local-only `public.platform_role_assignments` table selected as the next SQL slice; no SQL or runtime implementation authorized**

Date: 2026-08-08
Approval date: 2026-08-08

Successor implementation note: merged PR #87 later implemented exactly the selected empty, fully revoked, local-only `public.platform_role_assignments` foundation plus focused synthetic pgTAP. It created no real role rows, bootstrap, access, Auth/RLS/runtime, hosted behavior, or authority. Decision-ready document 35 now proposes the separate AUD-001 contract; AUD-001 remains Open pending explicit Owner approval.

## 1. Scope and verified starting point

This document defines the minimum platform-role boundary needed for future privileged platform workflows. It refines the role dependency approved in [`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) without reopening ID-001, changing Supplier Ownership, or implementing `supplier_ownership.decide_claim`.

The verified starting point is refreshed `origin/main` commit `22da8db4433c4fe7ca90ebe3b776a4da0a86eef2`, the merge of PR #85. Repository and merged-PR evidence proves:

- 11 tracked local migrations create 17 physical tables representing 15 implemented Core Phase 1 concepts; 21 of 36 concepts remain deferred;
- PR #83 resolved ID-001 for the approved Firebase-authoritative hybrid identity contract;
- PR #85 implemented the empty, fully revoked, local-only `public.supplier_ownerships` foundation selected under resolved SUP-001;
- `public.user_profiles`, `internal.identity_provider_links`, and `public.supplier_ownerships` exist locally, while `public.platform_role_assignments` does not;
- the 11 Open approval gates are `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`;
- Firebase Auth remains authoritative for authentication, account existence/disablement, and email verification; Firestore remains the deployed application-role authority until a separately approved relational cutover; and
- Supabase remains local-only and non-authoritative. No hosted Supabase, Firebase, Production/TEST data, migration, seed, backfill, or deployment work is authorized here.

## 2. Decision summary

The approved smallest safe contract is:

1. Platform roles authorize privileged platform administration only. They are separate from authentication identity, Firebase Auth, account context, Supplier ownership, Supplier memberships/delegation, organizations, PostgreSQL roles, and RLS.
2. The initial platform-role vocabulary is exactly `owner|admin`. `reviewer` is a versioned Claim work assignment/capability, not a platform role.
3. One user profile may have historical assignments but at most one effective active platform role at a time. One role may be held by multiple users. Duplicate or overlapping effective assignments for the same user are prohibited.
4. Owner and Admin are independent policy codes, not a numeric hierarchy. Owner-only governance powers are explicit; an Owner does not receive every future Admin operation through implicit precedence.
5. Assignments are temporal, append-and-terminalize history. Active authority requires both active lifecycle state and an in-time validity interval. Revoked, expired, or superseded assignments authorize nothing and are never reactivated.
6. Ordinary role grants and terminations require a currently usable Owner acting through a trusted command. The initial Owner set is the only bootstrap exception and requires the approved one-time external-authority process for at least two usable Owners.
7. A role row alone grants no authority. Current Firebase, exact identity linkage, active profile, current platform-administration access, security eligibility, and command-specific checks must all pass in the same authorization attempt.
8. Both Admin and Owner may eventually execute `supplier_ownership.decide_claim` only when the command policy expressly permits the role and every Claim assignment/conflict predicate passes. A reviewer assignment alone is insufficient.
9. The empty structural table has no RLS, browser/API grants, trusted routines, Auth bridge, access grants, rows, or authority. Its base privileges remain revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
10. Legacy/Firebase evidence is reconciliation input only. Ambiguous or conflicting evidence is quarantined and creates no role row.

## 3. Authority separation

| Concern | Authority | Platform-role table must not become |
|---|---|---|
| Authentication and email verification | Firebase Auth during the hybrid phase | a credential, session, token, account-existence, disablement, or verification authority |
| Provider-to-profile identity | Exact active Firebase subject mapping through `internal.identity_provider_links` plus current provider evidence | a replacement provider link or identity-merging mechanism |
| Application principal and account state | `public.user_profiles` after the applicable cutover; Firestore remains deployed authority before then | a platform-role column or Supplier/organization relationship |
| Platform privilege | Effective `public.platform_role_assignments` plus current administration access/security eligibility after a separately approved cutover | Supplier ownership, membership, account context, PostgreSQL role, JWT claim, or RLS policy |
| Supplier ownership | `public.supplier_ownerships` after its separately approved cutover | an implication of Owner/Admin status |
| Supplier/organization membership | Future approved membership relations | a platform role or consequence of platform privilege |
| Claim review workload | Future immutable/versioned Claim reviewer assignment | a third platform role or authority without usable Admin/Owner eligibility |
| Row visibility and mutation | Future reviewed RLS, field-minimized projections, and trusted commands | authentication, role assignment, or command-invariant enforcement by itself |

The empty table records no current authority. A later authority manifest must name exactly one application-role authority per environment and cutover phase; Firestore and PostgreSQL role decisions cannot be silently mixed or used as mutual fallbacks inside one command.

## 4. Minimum role vocabulary

| Candidate | Decision | Reason |
|---|---|---|
| `owner` | **Include** | Required for platform governance, role administration, final-usable-Owner protection, and expressly approved exceptional overrides. |
| `admin` | **Include** | Required for bounded privileged operational work, including an assigned Claim review path when command policy and conflict checks allow it. |
| `reviewer` | **Exclude as a platform role** | Review is task-scoped, target-scoped, time/version-scoped work. A global reviewer role would over-broaden access and still would not prove assignment or absence of conflict. |

No `contributor`, `viewer`, `supplier`, `buyer`, `super_admin`, `moderator`, or organization/Supplier role is introduced. Existing `contributor|viewer` values remain non-privileged legacy evidence; `suspended` is account state; Buyer/Supplier are account contexts; Supplier admin/delegate roles belong to future Supplier memberships.

The exact initial vocabulary is therefore:

```text
owner
admin
```

Adding a role later requires a separately reviewed purpose, command matrix, grant/revocation authority, conflict rules, migration mapping, and negative authorization tests. Free-form or environment-specific role codes are prohibited.

## 5. Cardinality, active uniqueness, and precedence

### 5.1 Cardinality

- One user profile may hold many historical assignments across time.
- One user profile may hold at most one effective active platform-role assignment across all role codes at any instant.
- One `owner` or `admin` role may be held by many user profiles.
- The model imposes no one-holder-per-role constraint. The usable-Owner guard requires at least one usable Owner at relational role cutover and after every eligibility-removing mutation.
- An effective duplicate includes any second nonterminal assignment whose half-open validity interval overlaps the first for the same user, even when the role codes match.

The future DDL must prevent overlapping effective user intervals and provide a direct active-role lookup. A trusted command must also serialize eligibility-changing operations because declarative assignment uniqueness alone cannot prove the complete usable-Owner predicate across Firebase, profile, link, access, and security state.

### 5.2 No implicit precedence

`owner` and `admin` are independent authorization inputs. There is no numeric rank, inheritance flag, or generic rule that `owner > admin` grants every Admin capability automatically.

Command policy names allowed role codes explicitly:

- only an Owner may assign, revoke, expire, correct, or supersede platform-role assignments;
- only an Owner may invoke a separately approved Owner override or governance operation; and
- an operational command may allow Admin, Owner, both, or neither, but must state that choice and its additional predicates.

This prevents a future Admin permission from silently becoming an Owner permission and prevents role order from replacing command-specific authorization.

## 6. Temporal lifecycle and immutable history

The approved lifecycle vocabulary is exactly:

- `active` — the assignment may be considered only while the current time is within its half-open validity interval and every external eligibility predicate passes;
- `revoked` — intentionally ended by an authorized governance action;
- `expired` — ended because its approved validity horizon was reached;
- `superseded` — ended because a reviewed correction/replacement row became authoritative.

`superseded` is not an ordinary promotion/demotion path. A role change terminalizes the prior assignment and creates a new assignment; it never edits the role code in place. `expired` is required for finite assignments. Authorization evaluates `valid_until` independently and fails closed as soon as the horizon is reached, even if a maintenance process has not yet persisted the terminal `expired` state.

The structural field groups required for a later exact DDL task are:

- opaque database-generated assignment ID;
- subject `user_profile_id` and bounded `role_code`;
- `assignment_status`, `valid_from`, nullable `valid_until`, immutable assignment/creation timestamps, and one terminal timestamp;
- assignment source, bounded reason code, authorization-policy version, and restricted evidence/reference fields;
- accountable assignment and review provenance;
- terminal actor/source, reason, and optional restrictive successor assignment reference for supersession; and
- record/version metadata needed for trusted optimistic/concurrency checks.

Active rows have no terminal provenance. Terminal rows require a coherent end time, reason, and accountable human or approved bootstrap/system source. A row is never hard-deleted, reopened, or reactivated. Corrections preserve the erroneous row, terminalize it as superseded, and create a replacement linked by reviewed provenance.

## 7. Assignment and review provenance

Every non-synthetic assignment must preserve:

- the subject profile and role code;
- `assigned_by_user_profile_id` for ordinary role administration;
- `reviewed_by_user_profile_id` when the action grants or changes Owner authority, affects the last-usable-Owner boundary, or uses the bootstrap/correction path;
- source code, bounded reason code, policy/contract version, evidence reference/digest, request/correlation reference, and trusted timestamps; and
- terminal actor/source, reason, time, and successor where applicable.

For ordinary post-bootstrap operations:

- the assigner/terminator must be a currently usable Owner at authorization and commit;
- an Admin cannot grant, promote, demote, correct, revoke, expire, or supersede a platform role;
- the subject cannot approve their own promotion;
- Owner grants and last-usable-Owner-affecting actions require a distinct current usable Owner reviewer under the future dual-control policy; and
- the command re-reads identity, role, access, security, and final-Owner state under one serialization guard before commit.

The initial bootstrap cannot truthfully populate `assigned_by_user_profile_id` from a pre-existing relational Owner. That bounded exception uses an approved `bootstrap_manifest` source and restricted external operator/approver evidence; it never fabricates a platform-role grantor. To avoid deadlocking the later dual-control rule, the bootstrap remains open until it atomically establishes the approved initial set of at least two distinct usable Owners. After that result is proven, the exception is disabled and ordinary human provenance is mandatory.

Evidence references are bounded identifiers or digests, not raw credentials, Firebase tokens, complete user records, email addresses, or unrestricted review notes. `assigned_by` and `reviewed_by` record accountability but never grant authority merely because their IDs appear on a row.

## 8. First-Owner bootstrap decision

| Option | Assessment |
|---|---|
| Manual migration/bootstrap SQL | Possible break-glass fallback, but not recommended as the normal path. Ad hoc SQL is difficult to make repeat-safe, validate, audit, and permanently disable. |
| Ordinary trusted role command | Safe after a usable Owner exists, but circular for the first Owner if it requires relational Owner authorization. |
| Controlled local seed | Allowed only for disposable synthetic local tests. It must never create real hosted or Production role rows. |
| External authority evidence alone | Necessary to prove who approved the bootstrap, but evidence alone is not a mutation mechanism and grants no relational authority. |
| One-time trusted bootstrap command plus approved external evidence | **Recommend.** It breaks the first-Owner circle explicitly while keeping validation, transactionality, replay protection, provenance, and permanent disablement reviewable. |

The safest future method is a separately approved, environment-bound, one-time trusted bootstrap command. Before it can run, it must:

1. consume a protected, checksummed bootstrap manifest approved through an external governance channel by the Product/Security/Data Owner and an independent authorized reviewer/operator;
2. resolve one exact current Firebase UID through one active `identity_provider_links` row to one active `user_profiles` row, using a current Firebase Admin observation and no email/domain matching;
3. prove there is no existing active or ambiguous platform-role assignment and no conflicting historical identity/role lineage;
4. create the approved initial set of at least two distinct Owner assignments and their separately approved role-backed platform-administration access atomically, with AUD-001 evidence and authority-manifest/cutover state when applicable;
5. be idempotent for the exact manifest and fail on any changed identity, role, environment, policy, evidence, or result binding;
6. preserve external operator/approver, source, reason, policy, timestamps, and restricted evidence without fabricating a relational grantor;
7. prove at least two distinct usable Owners after the transaction so later Owner grants and final-Owner-affecting actions can use ordinary dual control; and
8. irreversibly close or disable the bootstrap path after the approved result, with a separately governed break-glass recovery path.

Exact command name, transport, credential custody, audit retention, access-grant schema, and hosted execution runbook remain separate approvals. No bootstrap is implemented or authorized here.

## 9. Fail-closed identity and role rules

A platform role authorizes nothing when any of the following is true:

- the subject `user_profiles` row is missing, inactive, suspended, deactivated, or context-incompatible;
- the Firebase provider link is missing, unlinked, non-primary where a primary link is required, duplicated, ambiguous, or mapped to a different profile;
- the Firebase account is disabled, deleted/not found, unverified where verification is required, or not observed freshly enough for the high-risk command;
- token, Firebase Admin, provider-link, profile, migration, or role evidence conflicts;
- the assignment is missing, duplicated, overlapping, inactive, revoked, expired by time, superseded, not yet effective, or structurally inconsistent;
- current role-backed platform-administration access is missing, inactive, expired, or contradictory;
- a security deny, quarantine, unresolved reconciliation exception, or final-Owner safety failure exists; or
- the command does not expressly allow the role or any command-specific assignment/conflict/target predicate fails.

Failure denies the operation without mutating domain state or falling back to Firestore, JWT application role text, profile legacy values, email/domain, Supplier ownership, membership, or browser input. Provider outages and stale high-risk evidence fail closed.

## 10. Claim decision boundary

For the future `supplier_ownership.decide_claim` version-1 command:

- `admin` is sufficient as the platform-role input only on the ordinary path when the actor also holds the current immutable/versioned Claim reviewer assignment and passes every usable-actor and conflict predicate;
- `owner` may use the same assigned-reviewer path when command policy expressly allows it;
- a separately approved Owner override/reassignment path may bypass only the ordinary reviewer-assignment requirement, never identity, access, security, conflict, target-state, evidence, audit, idempotency, or final-Owner controls; and
- `reviewer` is not a platform role. Being named as reviewer without an effective Admin/Owner assignment and all other eligibility inputs authorizes nothing.

Both approval and rejection require a current human decision actor. The actor cannot be the claimant, current/proposed Supplier owner, or a conflicting Supplier member/admin/delegate. The assignment table supplies only the platform-role fact; Claim assignment, evidence, locks, command policy, and conflict checks remain outside it.

## 11. RLS, grants, and trusted-command boundary

The empty structural table is dependency-safe only when it remains inert:

- no rows, seed, bootstrap, migration, or mapping execution;
- no RLS policy, view, RPC, function, trigger, Auth bridge, or application integration;
- no browser or API grant, including no direct grant to `service_role`;
- complete base-table privilege revocation from `PUBLIC`, `anon`, `authenticated`, and `service_role`;
- restrictive user/actor/successor foreign keys and no forward FK to `access_grants`;
- structural lifecycle/cardinality constraints, indexes, comments, and synthetic pgTAP only; and
- local disposable execution only, with no hosted Supabase, Firebase, Production/TEST data, or deployment action.

Future RLS may consume a trusted current-role resolver for row visibility, but RLS does not assign roles, validate Firebase, enforce the complete usable-Owner invariant, or replace field minimization. All role mutations occur through reviewed trusted commands. Browser-supplied subject, actor, role, status, timestamps, policy, or provenance is ignored and server-derived.

## 12. Legacy/Firebase reconciliation

The following never create or activate a role row by themselves:

- Firebase custom claims, including any future Postgres transport `role: authenticated` claim;
- Firestore `users.role`, `accountType`, `legacy_role`, status, or access values;
- email address, domain, verification alone, name, phone, or organization text;
- Supplier ownership, Supplier membership/delegation, organization membership, or listing/approval state; or
- a provider link, valid session, migration mapping, or prior privileged action without the complete approved evidence set.

Exact reconciled legacy `owner|admin` values may become migration candidates only after current Firebase identity, profile/link, role history, access, security, approval, and source-fingerprint evidence agree. `contributor|viewer` remain non-privileged evidence; `suspended` maps to account state; Buyer/Supplier remain account contexts.

Missing, duplicated, one-sided, stale, or contradictory evidence is quarantined. Reconciliation creates no role row, chooses no winner, merges no profiles, and infers nothing from email/domain. Resolution requires a reviewed disposition and a future trusted bootstrap/migration/correction command.

## 13. Dependency and gate matrix

| Gate/dependency | Empty revoked local table | Real role rows | `supplier_ownership.decide_claim` runtime |
|---|---|---|---|
| Product/Security/Data Owner approval of this contract | **Resolved**; exact empty-table slice selected | Approved contract still governs later real rows | Approved contract boundary; runtime remains separately gated |
| ID-001 | **Resolved**; does not block inert structure | Approved contract must be implemented | Current Firebase/profile/link validation must be implemented |
| SUP-001 | Resolved; does not block | Does not grant platform roles | Ownership/Claim contract approved for design; runtime still gated |
| Platform access/bootstrap/trusted commands | No forward access FK; not required for empty table | Required before any real assignment | Required; role assignment alone is insufficient |
| AUD-001 | Does not block empty table | Blocks real bootstrap and privilege mutation | Blocks required decision attempt/outcome audit |
| MSG-003 plus REL-001 producer/consumer foundation | Does not block | Does not block inert roles | Blocks the approved decision-event-to-notification path |
| FILE-001 | Does not block | Does not block roles | Conditional: required only if Claim evidence uses stored file objects |
| ORG-001 / ORG-002 | Do not block platform roles | Block organization-derived authority only | Do not block unowned-Supplier Claim v1 unless organization authority is added |
| RLS/security delivery | Does not block fully revoked DDL | Blocks client exposure or operational role use | Trusted-command/RLS/projection implementation and negative tests required |
| MIG-002 / RES-001 | Do not block local-only DDL | Block hosted migration/population | Block hosted/Production runtime |
| RFQ-003, MSG-002, SEARCH-001, BILL-001 | Do not block | Do not block | Do not block Claim v1 |

All 11 Open gates remain Open. This contract resolves no approval-gate ID and does not change the approved scope of ID-001 or SUP-001.

## 14. Explicit answers

### A. What is the minimum approved role vocabulary?

The approved vocabulary is exactly `owner|admin`. `reviewer` is deliberately excluded as a platform role and remains a future Claim/workflow assignment concept.

### B. Can `platform_role_assignments` be dependency-safe as one empty, fully revoked local-only table?

**Yes, conditionally.** It is safe only under section 11's inert-table restrictions. It contains no real role rows and grants no authority.

### C. What exact schema-qualified table name does the authoritative design support?

`public.platform_role_assignments`.

### D. Can it become the next SQL slice?

**Yes; it is selected now.** Document 33 identified it as the next identity/access structural candidate, and this approved contract selects exactly one empty, fully revoked, local-only `public.platform_role_assignments` table as the next SQL slice. Exact DDL and focused synthetic pgTAP remain a separate task and approval.

If separately approved, implemented, and merged, the projected local state would become 18 physical tables, 16 implemented Core Phase 1 concepts, and 20 deferred. This documentation task leaves current `main` at 17 / 15 / 21.

### E. What remains required before populating any real role rows?

Exact DDL/pgTAP implementation; the role-backed platform-administration access contract and tables; current Firebase/profile/link bridge behavior; approved bootstrap/reconciliation manifests and one-time command; trusted role commands with final-Owner serialization and dual control; AUD-001; security/RLS/projection design and tests; authority-manifest/cutover and rollback plans; MIG-002/RES-001 for hosted use; bounded real-data approval; and applicable migration/Production approvals.

Synthetic disposable pgTAP rows in a later local SQL task are not real role population.

### F. Which Open gates still block `supplier_ownership.decide_claim` runtime?

Among the 11 Open gates:

- `AUD-001` blocks required decision and privilege-mutation audit behavior;
- `MSG-003` blocks the approved event-to-notification materializer path;
- `MIG-002` and `RES-001` block hosted/Production environment execution; and
- `FILE-001` is conditional and blocks only a Claim path that stores file-backed evidence.

`ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `SEARCH-001`, and `BILL-001` do not block the approved unowned-Supplier Claim v1 boundary. Separate non-gate blockers remain: implementing the approved ID-001 behavior, platform-role/access/bootstrap/trusted commands, Claim structures, the REL-001 coherent reliability foundation and consumer, reviewer/conflict enforcement, RLS/security delivery, and exact hosted/Production approvals.

## 15. Owner approval record and remaining decisions

On 8 August 2026, the Product/Security/Data Owner approved this complete contract and recorded these decisions:

1. the platform-role vocabulary is exactly `owner|admin`, and `reviewer` is not a platform role;
2. one user has at most one effective active role, multiple users may hold either role, and no implicit precedence exists;
3. command permissions remain explicit, role history/provenance remains preserved, and lifecycle is exactly `active|revoked|expired|superseded`;
4. platform roles remain separate from Firebase authentication/email verification, Supplier ownership/membership/delegation, organizations, and RLS, with all missing/stale/ambiguous/conflicting evidence failing closed;
5. ordinary future role administration is Owner-controlled through separately approved trusted operations;
6. the future protected bootstrap establishes at least two usable Owners from protected external governance evidence and explicit reconciliation, without authorizing execution now;
7. usable Owner and Admin actors may later perform assigned Claim decisions only after identity, role, reviewer-assignment, conflict, and command-specific security checks pass; and
8. exactly one empty, fully revoked, local-only `public.platform_role_assignments` table is selected as the next SQL slice.

No Owner decision remains for this contract or its empty structural slice selection. Exact SQL/pgTAP remains a separate technical task. Real rows and runtime remain subject to the dependencies and approvals in sections 13-14.

This approval does not authorize SQL, pgTAP, real assignments, bootstrap execution, access grants, Auth/RLS, Claim runtime, audit/reliability/notification work, hosted access, data movement, merge, or deployment.

## 16. Validation, risks, and exact stop point

Key risks are creating a global reviewer privilege; treating Owner/Admin as a universal hierarchy; allowing overlapping roles; fabricating a bootstrap grantor; using role rows without current Firebase/link/access/security evidence; inferring roles from legacy text or Supplier relationships; exposing the base table; and treating a structural row as runtime authority. This contract fails closed on each risk.

Required checks are documentation-only: refreshed `origin/main` and PR #85 merge evidence; 11 migrations, 17 physical tables, 15 implemented / 21 deferred concepts; ID-001/SUP-001 resolution; exact 11 Open gates; cross-document links and terminology; sensitive-content scan; documentation-only diff; and `git diff --check`.

Do not start Supabase, execute migrations, run pgTAP, access Firebase, inspect Production/TEST data, implement SQL, create role rows, run bootstrap, change Auth/RLS/grants, implement Claim/audit/reliability/notification runtime, merge, or deploy.

Exact stop point: PR #86 marked Ready for review with Owner approval recorded, the contract complete, all 11 unrelated Open gates preserved, and `public.platform_role_assignments` selected as the next SQL slice. Stop before exact SQL/pgTAP implementation, any real role assignment/bootstrap/runtime/hosted/Production action, merge, or deployment.

## 17. References

- [`01_TARGET_HYBRID_ARCHITECTURE.md`](01_TARGET_HYBRID_ARCHITECTURE.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`03_AUTH_AND_IDENTITY_OPTIONS.md`](03_AUTH_AND_IDENTITY_OPTIONS.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
