# Claim v1 local RLS and command-ownership readiness

Status: **B1 candidate readiness contract; documentation-only; awaiting independent exact-head security review; no SQL, RLS, grant, role, function, Auth, hosted, data, or Production change is authorized by this branch**

Date: 2026-08-15

Verified starting `origin/main`: `9fa166defeb60dabb7da8a35c88c009ed54be0c4`

Working branch: `codex/claim-rls-security-readiness`

Primary task profile: Documentation

## 1. Scope and hard boundary

This document is Package B task B1 from the autonomous execution queue. It
defines the exact current local Claim-v1 authorization matrix and selects the
smallest later local SQL hardening slice. It does not implement that slice.

The hard boundary is:

- local repository and local disposable PostgreSQL/Supabase with synthetic data
  only;
- no Firebase Auth bridge, gateway, provider adapter, signed-token validation,
  gateway login, driver, pool, pooler, HMAC rotation, or client activation;
- no access/security administration, bootstrap, real identity, role, access,
  security, Claim, ownership, audit, idempotency, or event row;
- no hosted Supabase access, link, push, policy/grant action, or deployment;
- no Firebase change and no Production/TEST read or write;
- no migration execution, seed, backfill, repair, bulk update, deletion, DNS,
  billing, Storage, messaging, RFQ, notification delivery, or automatic merge;
  and
- no reopening of completed Package A or the six merged Claim-v1 command
  contracts.

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`,
`FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## 2. Verified dependency and current-state evidence

The B1 dependency is satisfied on the exact starting commit:

- Package A closure merge `63ebaf2972350848dbe494908efd6756c070802a`
  is an ancestor of the starting commit;
- PR #135 and PR #136 are therefore contained in the starting tree;
- the tree contains exactly 29 tracked migrations and 29 tracked pgTAP files;
- the current baseline records 24 physical `public`/`internal` tables, 37 Core
  Phase 1 concepts, 22 implemented concepts, and 15 unimplemented concepts;
- the six external commands are exactly `supplier_claim.submit`,
  `supplier_claim.assign_reviewer`, `supplier_claim.withdraw`,
  `supplier_claim.approve`, `supplier_claim.reject`, and
  `supplier_claim.expire`;
- `public.supplier_ownership_claims` is RLS-enabled and FORCE RLS;
- the Claim table has exactly three permissive `SELECT` policies and zero
  `INSERT`, `UPDATE`, or `DELETE` policies; and
- the seven-gate register is unchanged.

These are source-control and local implementation facts. They are not hosted,
Firebase, Production, migration, or activation evidence.

## 3. Authority applied

The following merged authorities are conjunctive. Later implementation evidence
refines earlier proposed state without weakening an approved security boundary.

| Authority | Binding conclusion used here |
|---|---|
| [Supplier ownership and Claim contract](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md) | Claim and ownership bases are private; Claimant, Reviewer, controller, and platform privilege are distinct; every Claim/ownership mutation is a trusted command; direct browser writes are denied. |
| [ID-001](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) | Firebase remains the hybrid authentication authority; `user_profiles.id` is the domain principal; a role row alone never authorizes; missing or contradictory identity evidence denies. |
| [Platform-role contract](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) | Platform roles are exactly `owner|admin`; Reviewer is an assignment, not a role; no implicit role precedence or direct role-table authority exists. |
| [SEC-001](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md) | Browser and generic API roles receive no protected base mutation; row access and column projection are separate; transitions remain registered commands/workers; the runtime role is non-owner and non-`BYPASSRLS`. |
| [Claim command contract](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md) | Exactly six external commands independently re-read authorization and enforce transition, lock, replay, audit/event, and rollback invariants. RLS never replaces those checks. |
| [Gateway and command-owner readiness](52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md) | Before hosted activation, local `postgres` definer ownership must be replaced by dedicated `NOLOGIN`, non-superuser, non-`BYPASSRLS` command owners with exact object rights; neither gateway nor runtime may receive owner membership. |
| [Access/security contract](55_PRIVILEGED_ACTOR_ACCESS_AND_SECURITY_ELIGIBILITY_READINESS.md) | Only a current complete relational eligibility result plus operation-specific assignment/conflict state may authorize; `denied|unknown`, missing coverage, or exceptions deny. |
| [Reviewer private-read evidence](61_REVIEWER_PRIVATE_READ_SUBSTRATE_IMPLEMENTATION_EVIDENCE.md) | The current local read substrate intentionally has three audience-separated Claim `SELECT` policies, dedicated projection owners, fixed APIs, and zero mutation policies. |
| [Expire readiness and evidence](68_EXPIRE_V1_TRUSTED_COMMAND_READINESS.md), [implementation evidence](69_EXPIRE_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md) | Expire is worker-only through its dedicated `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS` caller role; human runtime and generic roles have no Expire or direct-table authority. |

## 4. Root security finding

Two statements are both mandatory and must not be collapsed:

1. **Zero browser/application Claim mutation policies remains the complete
   Claim-v1 product architecture.** No claimant, controller, assigned Reviewer,
   Owner, Admin, `anon`, `authenticated`, generic `service_role`, gateway login,
   human runtime caller, or expiry-worker caller receives direct Claim
   `INSERT|UPDATE|DELETE` authority.
2. **Zero total mutation policies is only a current local implementation fact,
   not the final least-privilege definer-owner architecture.** The Claim table is
   FORCE RLS. A dedicated non-table-owner, non-`BYPASSRLS` command owner cannot
   execute the already approved command bodies against that table unless RLS
   admits that internal owner for its named operation.

Keeping `postgres` as the definer owner would preserve the zero-policy count by
superuser bypass, but it would retain the explicit release blocker recorded by
the gateway contract and current baseline. Making a future owner a table owner
or giving it `BYPASSRLS` would contradict the approved dedicated non-owner,
non-`BYPASSRLS` boundary. Granting mutation to the caller roles would contradict
the trusted-command boundary.

Therefore the only authority-consistent local hardening is to keep all actor and
caller mutation paths denied while adding policies targeted solely to isolated
credentialless command-owner and read-only helper-owner roles. Those policies
are an internal execution mechanism, not actor authorization. Every actor,
lifecycle, transition, idempotency, conflict, assignment, expiry, audit, event,
and ownership decision continues to be enforced and re-read inside the fixed
trusted command.

## 5. Current local role, RLS, routine, and grant inventory

### 5.1 Caller and projection roles

| Database role | Attributes and current purpose | Direct protected mutation |
|---|---|---|
| `mujahiz_claim_runtime` | `NOLOGIN`, `NOINHERIT`, non-superuser, non-owner, non-`BYPASSRLS`; transaction-scoped human Claim runtime; executes the five human command surfaces and four fixed read APIs; reads only the eleven safe Claim columns needed by the claimant SECURITY INVOKER view | None |
| `mujahiz_claim_owner_projection` | `NOLOGIN`, `NOINHERIT`, non-superuser, non-table-owner, non-`BYPASSRLS`; owns Owner queue/candidate projections and the private arbitrary-profile eligibility helper | None |
| `mujahiz_claim_reviewer_projection` | Same restricted role shape; owns assigned-reviewer queue/detail projections | None |
| `mujahiz_claim_expiry_worker` | `NOLOGIN`, `NOINHERIT`, non-superuser, non-`BYPASSRLS`; executes only Expire Phase A and fenced Phase B; no direct Claim/internal-table privilege | None |
| `anon`, `authenticated`, generic `service_role`, `PUBLIC` | No Claim policy, fixed Claim API execute, command execute, or protected base privilege | None |
| local `postgres` | Current owner of the mutation `SECURITY DEFINER` command/helper routines and therefore the remaining local superuser boundary | Implicit through current definer execution only; must be removed by B4 |

No application, human, worker, or projection role is a platform `owner` or
`admin`. Application role decisions come from relational data under the current
principal; PostgreSQL roles are execution principals only.

### 5.2 Current Claim policies

| Policy | Operation and target role | Exact audience condition |
|---|---|---|
| `supplier_ownership_claims_claimant_self_select` | `SELECT` to `mujahiz_claim_runtime` | Row claimant equals the fail-closed transaction-local principal. |
| `supplier_ownership_claims_owner_assignment_select` | `SELECT` to `mujahiz_claim_owner_projection` | Current relationally eligible Owner, target conflict `clear`, coherent unexpired wholly unassigned `submitted` Claim. |
| `supplier_ownership_claims_assigned_reviewer_select` | `SELECT` to `mujahiz_claim_reviewer_projection` | Exact assigned relationally eligible Owner/Admin Reviewer, target conflict `clear`, coherent unexpired supported `under_review` Claim. |

All three are permissive policies, but their target roles are isolated and have
no runtime membership union. Claim RLS is enabled and forced. There is no
Claim `INSERT`, `UPDATE`, or `DELETE` policy.

### 5.3 Current schema, table/column, routine, and ownership grants

| Role | Schema usage | Routine execute/ownership | Direct relation privilege |
|---|---|---|---|
| `mujahiz_claim_runtime` | `claim_security`, `claim_api`, `supplier_claim`; no `internal` usage | Execute on the context setter/accessor, current-principal privileged resolver, four fixed `claim_api` reads, and the current runtime-facing/fenced human command routines only; owns none | `SELECT` only on the claimant view and exactly `id`, `supplier_profile_id`, `status`, `record_version`, `submitted_at`, `expires_at`, `decided_at`, `withdrawn_at`, `expired_at`, `superseded_at`, `updated_at` on the Claim base; RLS still applies; no mutation |
| `mujahiz_claim_owner_projection` | `public`, `internal`, `claim_security`, `claim_api` | Owns `claim_security.privileged_actor_for_profile_v1(uuid)`, `claim_security.current_privileged_actor_v1()`, `claim_api.owner_assignment_queue_v1(...)`, and `claim_api.owner_reviewer_candidates_v1(...)`; executes only required principal/conflict helpers | Claim `SELECT` only on IDs, claimant/Supplier IDs, status/version/times, assignment fields, terminal times, and resulting ownership; Supplier `SELECT` only on IDs/display/bilingual names; exact eligibility-source columns used by its owned helpers; no mutation |
| `mujahiz_claim_reviewer_projection` | `public`, `claim_security`, `claim_api`; no direct `internal` usage | Owns `claim_api.reviewer_queue_v1(...)`, `claim_api.reviewer_detail_v1(uuid)`, and the fixed evidence projection; executes only required principal/conflict and private prior-context helpers | Claim `SELECT` only on IDs, immutable reason/snapshot/evidence, status/version/times, assignment fields, prior Claim, and resulting ownership; Supplier `SELECT` only on the fixed review summary; ownership `SELECT` only on identity/Supplier/authority/status/validity; no mutation |
| `mujahiz_claim_expiry_worker` | `supplier_claim` only | Execute only on `supplier_claim.expire(...)` and `supplier_claim._execute_expire(...)` | None on Claim or `internal` tables |
| `PUBLIC`, `anon`, `authenticated`, generic `service_role` | No Claim schema/API usage | No context, helper, fixed-read, human-command, or Expire execute | None on the Claim, identity link, role, access, security, ownership, audit, idempotency, or event bases |

The human runtime currently executes these command families only:

- Submit Phase A/reservation and fixed external Submit execution;
- Withdraw Phase A/reservation and fixed external Withdraw execution;
- Assign-Reviewer Phase A/reservation and fixed external assignment execution;
- Reject Phase A plus its fenced private executor;
- Approve Phase A plus its fenced private executor.

The expiry worker is deliberately separate and is the only caller of Expire
Phase A and fenced Phase B. Runtime and worker execute grants do not convey base
table rights and do not convey membership in the function-owner role.

Current routine ownership is intentionally mixed:

- the four fixed `claim_api` functions and the privileged-actor helpers use the
  two non-superuser projection owners;
- `claim_security.target_supplier_conflict_v1(...)` and the private Reviewer
  prior-Claim context helper still use local `postgres` definer ownership; and
- the human and Expire mutation `SECURITY DEFINER` families still use local
  `postgres` ownership.

Every listed definer uses fixed `search_path=pg_catalog`, qualified application
objects, no dynamic SQL, and explicit execute revocation. The remaining
`postgres` owners are the precise B4 hardening target; they are not hosted
least-privilege evidence.

### 5.4 Fixed read surfaces

| Surface | Allowed result | Denied result |
|---|---|---|
| `public.supplier_ownership_claims_claimant_v1` | Current principal's own fixed status/history projection only | Another claimant, Reviewer internals, evidence, provider data, controller identity, audit/event/idempotency data, and arbitrary base columns |
| `claim_api.owner_assignment_queue_v1(...)` | Eligible conflict-clear Owner receives coherent unassigned queue metadata only | Admins, unusable/unassigned actors, expired/assigned/terminal Claims, claimant/evidence/private detail |
| `claim_api.owner_reviewer_candidates_v1(...)` | Eligible Owner receives the exact Claim-scoped three-field candidate result; advisory only | Ineligible, same actor, claimant, conflict/unknown, or raw eligibility/security facts |
| `claim_api.reviewer_queue_v1(...)` | Exact assigned usable conflict-clear Reviewer receives current queue metadata | Unassigned/global Admin or Owner browsing, cross-Reviewer rows, expired/terminal Claims |
| `claim_api.reviewer_detail_v1(uuid)` | Exact assigned usable conflict-clear Reviewer receives the fixed minimized review record | Another Claim, raw URL/path/query, provider/security/conflict detail, audit/event/idempotency data, unrestricted row JSON |

The fixed read APIs do not grant mutation authority. A row being visible never
authorizes a command.

## 6. Application principal and actor matrix

`Allow` below means only the named fixed surface after a future trusted gateway
has established the exact current principal. In the current repository all
results are local synthetic proof only.

| Actor/application state | Own Claim projection | Owner queue/candidates | Assigned-Reviewer queue/detail | Raw Claim base | Hidden/internal bases |
|---|---|---|---|---|---|
| Anonymous, unmapped, inactive, unverified, disabled/deleted, stale, ambiguous, or contradictory identity | Deny | Deny | Deny | Deny | Deny |
| Eligible claimant | Allow own only | Deny unless independently usable Owner | Deny unless independently exact assigned Reviewer | Deny as browser/application actor | Deny |
| Another claimant for the same Supplier | Allow their own only | Deny unless independently usable Owner | Deny unless independently exact assigned Reviewer | Deny | Deny |
| Current, prior, successor, or unrelated Supplier controller | Allow only if independently claimant | Deny unless independently usable Owner and conflict-clear | Deny unless independently exact assigned Reviewer and conflict-clear | Deny | Deny |
| Usable but unassigned Admin | Allow only if independently claimant | Deny | Deny | Deny | Deny |
| Usable but unassigned Owner | Allow only if independently claimant | Allow exact queue/candidates only when conflict-clear | Deny | Deny | Deny |
| Exact assigned usable Owner/Admin Reviewer | Allow only if independently claimant | Owner surface only if independently usable Owner | Allow exact current assigned Claim only | Deny | Deny |
| Generic `service_role` | Deny | Deny | Deny | Deny | Deny |
| Dedicated expiry worker | Deny | Deny | Deny | Deny direct access | Deny direct access |

`unknown`, missing coverage, unsupported versions, helper errors, expired
authority, security holds, or target conflict other than `clear` always map to
the same external denial.

## 7. Trusted-command and lifecycle matrix

| External command | Only authorized actor class | Supported source state | Committed state/effect | Everyone else/direct DML |
|---|---|---|---|---|
| `supplier_claim.submit` | Exact eligible claimant for self | No active same claimant/Supplier Claim; eligible unowned target | New immutable `submitted` Claim plus approved replay/event effects | Deny |
| `supplier_claim.assign_reviewer` | Current usable conflict-clear Owner assigning one distinct usable conflict-clear Owner/Admin | Coherent unexpired wholly unassigned `submitted` | Same Claim becomes `under_review`; assignment is write-once; required audit/event/replay effects | Deny |
| `supplier_claim.withdraw` | Exact claimant for self | Coherent unexpired `submitted|under_review` with expected version | Same Claim becomes terminal `withdrawn`; assignment provenance is preserved | Deny |
| `supplier_claim.approve` | Exact assigned usable conflict-clear Owner/Admin Reviewer | Coherent unexpired `under_review` with expected Claim/assignment versions and unowned Supplier | Claim becomes `approved`; exactly one ownership is created; all active competitors become `superseded`; required audit/events/replay commit atomically | Deny |
| `supplier_claim.reject` | Exact assigned usable conflict-clear Owner/Admin Reviewer | Coherent unexpired `under_review` with expected versions | Claim becomes terminal `rejected`; no ownership or competitor mutation; required audit/event/replay effects | Deny |
| `supplier_claim.expire` | Dedicated expiry worker for one durable observation | Coherent due `submitted|under_review`; trusted post-lock time and fixed 720-hour rule | Claim becomes terminal `expired`; assignment provenance is preserved; exactly one expiry event and approved replay effects | Deny |

Terminal `approved|rejected|withdrawn|expired|superseded` Claims have no normal
next state. A completed replay may return only the already committed safe result
after integrity validation; it does not create a second transition. A not-due
Expire observation remains replayable and permits a later distinct observation
after the Claim becomes due. No command inserts a notification, and no command
creates a standalone browser mutation path.

## 8. Selected B4 local implementation boundary

After this exact B1 contract is independently approved and manually merged, B4
may implement exactly one local SQL hardening migration plus focused synthetic
pgTAP. The selected objects are:

### 8.1 Four isolated command/helper-owner roles

Create exactly:

- `mujahiz_claim_human_command_owner` for the five human command families;
- `mujahiz_claim_expiry_command_owner` for the Expire Phase-A, fenced Phase-B,
  and expiry-only integrity helper family;
- `mujahiz_claim_target_conflict_helper_owner` for only
  `claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)`; and
- `mujahiz_claim_reviewer_prior_context_helper_owner` for only
  `claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid)`.

All four roles must be `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`. None may:

- own a table, sequence, schema, database, or extension;
- receive a credential, runtime/gateway/worker membership, role-administration
  option, schema `CREATE`, generic SQL entrypoint, or exposed API surface;
- in the committed catalog, be granted to `postgres`, a gateway login,
  `mujahiz_claim_runtime`, `mujahiz_claim_expiry_worker`, a projection role,
  browser/API role, `service_role`, migration operator, or human; or
- acquire privileges through inheritance or another role membership.

Zero membership and zero schema `CREATE` are mandatory committed,
end-of-migration catalog conditions. A privileged migration actor may perform
ownership transfer directly. If the selected PostgreSQL migration context
requires temporary membership, `SET ROLE`, or schema `CREATE` to complete an
ownership transfer, that capability must be transaction-bounded, used only for
the transfer, and fully revoked or reset before migration validation and commit.
No membership, role-assumption path, or schema `CREATE` privilege may survive
the migration; a transient migration capability is not a permanent grant and a
committed residue fails B4.

Transfer ownership of every current `supplier_claim` `SECURITY DEFINER` routine
reachable from the five human command families to the human command owner.
Transfer ownership of every Expire Phase-A/Phase-B and expiry-only
`SECURITY DEFINER` helper to the expiry command owner. Transfer the target
conflict helper only to the target-conflict helper owner and the private
Reviewer prior-Claim context helper only to the Reviewer-prior-context helper
owner. Retain the Reviewer-prior-context body exactly. The target-conflict body
may change only through the least-privilege explicit-projection hardening in
section 8.3; no behavior or callable-surface change is selected. No current
Claim `SECURITY DEFINER` routine may remain owned by `postgres` after B4.

This separation is determined by the merged authority rather than preference.
Document 55 section 10.2 limits an owner to the exact columns and operations
needed by one helper. The target-conflict helper reads `user_profiles`,
`supplier_profiles`, Claim, and ownership rows; the Reviewer-prior-context
helper reads only six Claim columns. A shared helper owner would give each
owned routine the union of both read footprints, including privileges not
needed by that helper, so it is not an authority-consistent alternative.

| Proposed owner role | Sole ownership boundary | Claim operation admitted by FORCE RLS | Routine execute boundary |
|---|---|---|---|
| `mujahiz_claim_human_command_owner` | Five human command families and their human-command-only helpers | `SELECT`, `INSERT`, `UPDATE` | Existing human command caller boundary only; may execute the target-conflict helper as an internal dependency |
| `mujahiz_claim_expiry_command_owner` | Expire Phase A, fenced Phase B, and expiry-only helper family | `SELECT`, `UPDATE` | Existing expiry-worker boundary only |
| `mujahiz_claim_target_conflict_helper_owner` | Target-Supplier conflict helper only | `SELECT` | Existing Owner/Reviewer projection consumers plus the human command owner; no browser, application caller, worker, or generic runtime execute |
| `mujahiz_claim_reviewer_prior_context_helper_owner` | Reviewer prior-Claim context helper only | `SELECT` | Existing Reviewer projection consumer only |

The existing outer field-minimized Owner and Reviewer projection functions and
privileged-actor helpers remain owned by their two dedicated projection roles.
The transaction-context `SECURITY INVOKER` functions remain non-authorizing
plumbing and receive no new base privilege.

### 8.2 Exact role-targeted Claim RLS policies

Add only these internal execution policies on
`public.supplier_ownership_claims`:

| Policy | Operation | Target role | Predicate purpose |
|---|---|---|---|
| `supplier_ownership_claims_human_command_select` | `SELECT` | `mujahiz_claim_human_command_owner` | Permit fixed human command/helper bodies to re-read and lock the exact Claim sets they independently authorize. |
| `supplier_ownership_claims_human_command_insert` | `INSERT` | `mujahiz_claim_human_command_owner` | Permit only the fixed Submit command body to insert after its complete checks. |
| `supplier_ownership_claims_human_command_update` | `UPDATE` | `mujahiz_claim_human_command_owner` | Permit fixed Withdraw/Assign/Approve/Reject bodies and approved replay reconciliation to update after command checks. |
| `supplier_ownership_claims_expiry_command_select` | `SELECT` | `mujahiz_claim_expiry_command_owner` | Permit the fixed Expire family to route, re-read, lock, and reconcile the target history. |
| `supplier_ownership_claims_expiry_command_update` | `UPDATE` | `mujahiz_claim_expiry_command_owner` | Permit only the fixed Expire execution path to terminalize a due active Claim. |
| `supplier_ownership_claims_target_conflict_helper_select` | `SELECT` | `mujahiz_claim_target_conflict_helper_owner` | Permit only the fixed read-only target-conflict helper to inspect the Claim rows in its fail-closed integrity/conflict decision. |
| `supplier_ownership_claims_reviewer_prior_context_helper_select` | `SELECT` | `mujahiz_claim_reviewer_prior_context_helper_owner` | Permit only the fixed private prior-context helper to inspect its exact rejected prior Claim. |

The policies are role-targeted capability plumbing. They must not attempt to
duplicate the multi-row command contracts in RLS. Their `USING`/`WITH CHECK`
expressions may be unconditional only for the exact isolated owner role because
the role is credentialless, has no membership path, and can act only while a
fixed `SECURITY DEFINER` function that it owns is executing. B4 must prove those
preconditions in catalog tests.

No `DELETE` policy is selected. The three current audience `SELECT` policies
remain byte-for-byte unchanged. The expected post-B4 Claim policy inventory is
therefore seven `SELECT`, one `INSERT`, two `UPDATE`, and zero `DELETE` policies.
Only the original three `SELECT` policies are actor/audience visibility
policies; the seven new policies target isolated implementation owners.

### 8.3 Exact grants and unchanged caller surfaces

B4 must derive the minimum table/column/sequence/function privileges from the
current routine dependency graph and grant each owner role only the union needed
by its own function family. At minimum:

- the human command owner may receive only the Claim, profile/link,
  role/access/security, Supplier/ownership, audit, idempotency, event, and helper
  read/write columns used by Submit, Withdraw, Assign, Approve, Reject, and their
  replay/integrity paths;
- the expiry command owner may receive only the Claim, profile, ownership,
  audit-history, idempotency, event, and expiry-helper columns/operations used by
  Expire; it receives no human actor resolver, assignment-command, approval
  ownership-insert, or generic audit-write authority unless the exact current
  Expire body proves it is required;
- the target-conflict helper owner receives schema `USAGE` only on `public` and
  `claim_security`, Claim `SELECT` only under its named FORCE-RLS policy, and
  column `SELECT` on exactly `user_profiles.id`, `supplier_profiles.id`, the 19
  Claim columns used by the current helper logic (`id`,
  `claimant_user_profile_id`, `supplier_profile_id`, `status`, `submitted_at`,
  `expires_at`, `reviewer_user_profile_id`, `reviewer_assignment_version`,
  `reviewer_assigned_at`, `reviewer_assigned_by_user_profile_id`,
  `reviewer_assignment_source_code`, `reviewer_assignment_policy_version`,
  `decided_at`, `withdrawn_at`, `expired_at`, `superseded_at`,
  `resulting_supplier_ownership_id`, `created_at`, `updated_at`), and exactly
  `supplier_ownerships.id`, `supplier_profile_id`,
  `controller_user_profile_id`, `authority_type`, `ownership_status`,
  `valid_from`, `valid_until`, `establishment_source_type`,
  `closure_reason_code`, `closed_by_user_profile_id`, `closure_system_source`,
  `closed_at`, `transfer_successor_ownership_id`, `created_at`, and `updated_at`;
  grant the 19 Claim columns individually so no unlisted or future Claim column
  is covered automatically;
- B4 must replace the target-conflict helper's
  `public.supplier_ownership_claims%rowtype` variable and `SELECT claim.*` with a
  correspondingly bounded record/variables populated by an explicit projection
  of exactly those 19 Claim columns. This is the only selected function-body
  change: it must preserve the helper's fixed signature, `clear|conflict|unknown`
  result contract, product/authorization/conflict semantics, integrity checks,
  fail-closed null/exception behavior, volatility, fixed search path, and every
  existing external and internal callable boundary;
- the Reviewer-prior-context helper owner receives schema `USAGE` only on
  `public` and `claim_security`, Claim `SELECT` only under its named FORCE-RLS
  policy, and column `SELECT` only on `id`, `claimant_user_profile_id`,
  `supplier_profile_id`, `status`, `decision_reason_code`, and `decided_at` in
  `public.supplier_ownership_claims`;
- both helper owners remain strictly read-only: no relation `INSERT`, `UPDATE`,
  `DELETE`, `TRUNCATE`, sequence privilege, grant option, default privilege,
  role membership, or schema `CREATE`;
- retain target-conflict execute for the Owner and Reviewer projection roles and
  grant its exact internal dependency execute only to the human command owner;
  retain Reviewer-prior-context execute only for the Reviewer projection role;
  all prior `PUBLIC`, browser/API, generic runtime, and unrelated-role execute
  revocations remain effective;
- no owner receives `TRUNCATE`, `DELETE`, schema `CREATE`, arbitrary sequence
  use, default privileges, dynamic SQL, or a grant option;
- `PUBLIC`, `anon`, `authenticated`, generic `service_role`, browser/API roles,
  caller roles, and projection roles retain zero protected mutation privilege;
- `mujahiz_claim_runtime` keeps execute only on the five human public
  Phase-A/business boundaries, their already fenced private executors where the
  merged architecture requires it, the bounded current-principal accessor, and
  the four fixed read APIs;
- `mujahiz_claim_expiry_worker` keeps execute only on the Expire public Phase A
  and fenced Phase B and keeps zero direct table authority; and
- no change grants either caller the ability to assume a definer-owner role.

Every affected definer must retain fixed `search_path=pg_catalog`, qualified
application objects, fixed argument/result types, no dynamic SQL, revoked
`PUBLIC` execute, and only its already approved caller execute boundary. The
ownership/grant migration must not change any function body except the exact
target-conflict projection hardening above, and must not change any command
signature, result shape, lifecycle rule, lock order, replay rule, audit/event
cardinality, or notification behavior.

## 9. B4 deterministic validation contract

The later implementation is acceptable only if all of the following pass on
the same exact head:

1. focused pgTAP proves the four role shapes, zero credentials, zero memberships,
   zero table/schema/database ownership, zero `BYPASSRLS`, zero schema `CREATE`,
   and zero grant options in the committed end-of-migration catalog, after any
   transaction-bounded ownership-transfer capability has been revoked;
2. direct `pg_default_acl` catalog assertions prove that no default ACL grants
   any privilege to any of the four owner roles for any object type or schema;
3. catalog assertions prove every Claim mutation definer/helper is owned by the
   exact selected non-superuser command/helper role, the two read-only helpers
   have separate owners, and no Claim `SECURITY DEFINER` remains owned by
   `postgres`;
4. catalog assertions prove the exact seven actor `SELECT`/technical `SELECT`
   total, one `INSERT`, two `UPDATE`, and zero `DELETE` policy inventory, with
   each new policy targeted only to its named owner;
5. `anon`, `authenticated`, generic `service_role`, runtime caller, expiry
   caller, projection roles, and unlisted roles all fail direct Claim
   `INSERT|UPDATE|DELETE` and protected/internal base access;
6. the human caller cannot execute Expire, the expiry caller cannot execute a
   human command, and neither caller can `SET ROLE` to an owner;
7. catalog and execution assertions prove the target-conflict owner can read
   exactly the 19 Claim, 15 ownership, and two identity-id columns selected in
   section 8.3, cannot read any other Claim or protected column, and remains
   subject to enabled and FORCE RLS; equivalent assertions preserve the separate
   Reviewer-prior-context owner's exact six-column Claim footprint and policy;
8. focused before/after helper cases prove identical `clear|conflict|unknown`
   results for positive, conflict, unsupported-relationship, null, exception,
   malformed-lifecycle, duplicate-active-Claim, broken-successor, overlapping-
   ownership, assignment-shape, and approval-provenance cases;
9. focused Owner queue/candidate and assigned-Reviewer queue/detail cases prove
   every path using the target-conflict helper retains its exact output shape,
   audience isolation, conflict denial, unknown denial, and fail-closed behavior;
10. one positive and the existing material negative/replay/corruption path for
    each of the six external commands still passes under the new owners, with
    focused evidence for Assign-Reviewer, Reject, and Approve because those human
    commands directly invoke the target-conflict helper;
11. the directly affected true-session race cases in which the target-conflict
    helper participates are rerun and preserve current locking, concurrent
    ownership/Claim observation, conflict, unknown, and fail-closed outcomes;
12. claimant, Owner queue/candidate, and assigned-Reviewer fixed reads retain
    their exact output shapes and deny cross-audience reads; target-conflict
    execute remains limited to the two projection roles and human command owner,
    while Reviewer-prior-context execute remains Reviewer-projection-only;
13. direct Claim deletion remains impossible, the target helper no longer uses
    `%rowtype` or `claim.*`, and no other function body, signature, output,
    command/event/audit contract, notification boundary, or lock order changes;
14. the complete local SQL validator applies all tracked migrations and passes
    every tracked pgTAP file in disposable PostgreSQL with synthetic data; and
15. static checks prove documentation links, migration order, fixed search
    paths, no dynamic SQL, no sensitive values, documentation/evidence accuracy,
    and a scoped diff.

The target-conflict body change invalidates the prior body-preserving race-test
exception only for the directly affected helper, projection, and command paths.
Do not mechanically add Firebase or unrelated repository-wide suites unless the
merged testing policy or implementation evidence shows that shared behavior has
changed. The complete local SQL validator remains required because B4 changes a
high-risk security migration and its tracked SQL behavior.

## 10. Explicit exclusions and later release gates

B4 does not implement or authorize:

- a gateway login or membership path to `mujahiz_claim_runtime`;
- a real Firebase signed-token/current-user observation or provider resolver;
- real HMAC custody, active/retiring rotation, hosted namespace, or secret;
- a driver, pool, pooler, workload identity, network, environment, or hosted
  project;
- access/security administration, security clear/release, role administration,
  final-Owner commands, emergency recovery, or bootstrap;
- a new Claim read API, controller projection, notification path, managed file
  evidence, transfer/revoke command, correction command, or migration path;
- real rows, data movement, hosted RLS/grants, Firebase change, Production/TEST
  access, deployment, cutover, or fallback; or
- resolution of any of the seven Open gates.

The local hardening would reduce the known superuser definer boundary. It would
still not prove hosted least privilege, because hosted role provisioning,
gateway membership, real environment grants/default privileges, signed-token
ingress, HMAC custody, driver/pool isolation, and hosted catalog evidence remain
absent.

## 11. B1 validation and exact stop point

B1 validation is documentation/static only:

- verify exact starting `origin/main` and Package A ancestry;
- verify 29 migrations, 29 pgTAP files, six external commands, three current
  Claim `SELECT` policies, zero current mutation policies, and seven Open gates;
- verify every relative Markdown link resolves;
- verify the target helper's exact 19 Claim, 15 ownership, and two identity-id
  source references, the prior-context helper's exact six Claim columns, the
  four-role and 7/1/2/0 policy inventories, the bounded target-body exception,
  and the explicit `pg_default_acl` assertion requirement;
- scan for stale Package A/A5/A6 planning, contradictory direct-write or role
  statements, credentials, tokens, secrets, personal data, hosted/Production
  claims, and executable SQL;
- run `git diff --check`; and
- confirm the branch diff is documentation-only.

Exact stop point: one Draft documentation PR at
`AWAITING_INDEPENDENT_REVIEW`. The independent Reviewer must inspect the exact
head read-only against the merged authorities and current DDL, including
permissive-policy union risk, non-`BYPASSRLS` definer behavior, owner membership,
base and column grants, hidden-field exposure, and direct-mutation denial. Do
not implement B4, create SQL/pgTAP, mark Ready, merge, deploy, access hosted
Supabase or Firebase Production, or read/write Production/TEST data.
