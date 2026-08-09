# Claim-first RLS and trusted authorization security contract

Status: **Proposal for Product/Security/Data Owner approval; SEC-001 remains unresolved; no RLS, grant, Auth bridge, trusted command, SQL, runtime, hosted, data, or Production implementation is authorized**

Date: 2026-08-09

Verified starting point: `origin/main` at `f5ee83096851991de680183c072b16987cb8784f`, the merge of PR #94

Primary task profile: Documentation

## 1. Scope, evidence labels, and decision status

This document proposes the smallest fail-closed row-access and trusted-authorization contract required before a Supabase Claim Supplier Profile path may become client-accessible. It defines the identity assertion that future database authorization may trust, the base-table and column boundary, claimant/controller/reviewer visibility, trusted-command ownership, deterministic positive and negative tests, and rollout prerequisites.

It does not implement or authorize RLS, policies, grants, functions, views, RPCs, an Auth bridge, Firebase configuration, Claim tables, Claim runtime, role/access bootstrap, audit writers, reliability tables, notifications, hosted Supabase, data movement, migration, deployment, or Production/TEST access.

Evidence labels used below are:

- **Verified current fact** — proved by the starting commit, current migrations, or an approved predecessor contract.
- **Approved existing contract** — already approved in a predecessor document, but not necessarily implemented.
- **Recommendation** — the proposed SEC-001/Claim-first contract. It has no authority until explicitly approved.
- **Unresolved** — an Owner, Security, Technical, Operations, Privacy, Legal, environment, or implementation decision still required.

This proposal does **not** resolve SEC-001 or any Open gate. The seven Open gates remain `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## 2. Verified starting state

**Verified current facts:**

- Firebase remains authoritative for authentication, account existence/disablement, email verification, sessions, recovery, and email actions during the hybrid phase.
- PostgreSQL domain identity is provider-neutral: durable human relationships use `public.user_profiles.id`; Firebase UID is restricted to `internal.identity_provider_links.provider_subject`.
- Local SQL contains the empty structural foundations for `public.user_profiles`, `internal.identity_provider_links`, `public.platform_role_assignments`, `public.supplier_profiles`, `public.supplier_ownerships`, and `internal.audit_logs`.
- Those six foundations revoke table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`; they have no RLS policies, browser/API grants, Auth bridge, trusted commands, or real authority.
- The Supplier child foundations — locations, contacts, category assignments, capabilities, and payment options — are also fully revoked from browser/API roles and have no approved direct client access.
- `internal` is absent from the local Data API exposed-schema list. The local Data API exposes `public` and `graphql_public`; object grants remain a separate required boundary.
- `supplier_ownership_claims`, `internal.idempotency_keys`, `internal.domain_events`, and future relational `notifications` do not exist.
- `public.access_grants`, Claim reviewer assignments, security holds/denies, and the Firebase Auth bridge behavior required by the complete usable Admin/Owner predicate are not implemented.
- Supabase is local-only and non-authoritative. No hosted project or hosted resource choice is approved. The GitHub Claim Supplier feature remains undeployed.

**Approved existing contracts:**

- [Supplier Ownership and Claim](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md) defines one active primary human controller per Supplier, private immutable Claim evidence, assigned reviewer conflict checks, unowned-Supplier-only ordinary approval, deterministic competing-Claim handling, and trusted Claim/ownership transitions.
- [ID-001 identity authority](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) keeps Firebase authoritative, makes `user_profiles` the domain principal, requires exact provider linkage, and fails closed on missing, stale, or conflicting identity evidence.
- [Platform role assignments](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) permits only `owner|admin`, excludes `reviewer` as a platform role, requires separate current access/security eligibility, and protects the final usable Owner through a common serialization guard.
- [AUD-001](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md) requires minimized append-only audit evidence for accountable Claim decisions, privilege/ownership mutations, and post-auth security-sensitive failures.
- [MSG-003](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md) requires provider-neutral self-only notification recipients, one materializer, immutable bilingual snapshots, and no Firebase fallback after feature cutover.
- [SEARCH-001](37_SEARCH_001_POSTGRESQL_SEARCH_TECHNOLOGY_CONTRACT_REVIEW.md) approves a bounded Claim Supplier lookup result containing only Supplier ID, bilingual names, governorate, city, up to three categories, and a sanitized website domain; it does not approve base-table access.

## 3. Security objective and invariants

**Recommendation:** no client-accessible Supabase Claim feature may ship unless all of these invariants are simultaneously true:

1. The caller reaches PostgreSQL only through an authenticated bridge context produced from a current validated Firebase identity.
2. The bridge resolves exactly one Firebase provider link to exactly one active provider-neutral `user_profiles` row.
3. Missing, expired, disabled, deleted/not-found, unverified, unmapped, stale, duplicated, quarantined, or contradictory evidence denies access.
4. Browser and generic API roles receive no direct base-table Claim, ownership, role, identity-link, audit, reliability, or notification access.
5. RLS answers only whether the current resolved principal may access a row for the requested operation.
6. Explicit field-minimized RPC/projection responses, not RLS, define which columns an allowed audience may receive.
7. Authoritative Claim, reviewer, ownership, role, audit, event, idempotency, and notification transitions occur only through registered trusted commands or workers.
8. The `service_role` token is not an application authorization path, is never placed in a browser, and is not the generic Claim worker identity.
9. `internal.*` remains outside Data API exposure and unavailable to browser/API roles.
10. A feature cut over to Supabase never falls back to Firestore authorization, Firebase data reads, or Firebase notification creation for the same operation.

## 4. Threat model

| Threat | Failure if uncontrolled | Required fail-closed control | Deterministic proof |
|---|---|---|---|
| Forged user/profile identity | Caller selects another `user_profiles.id` and reads or mutates their Claim | Ignore every caller-supplied actor/profile ID. Accept the principal only from the trusted bridge context and compare it to row ownership in RLS | Changing a request/profile parameter while keeping the bridge context fixed returns no additional row and makes no mutation |
| Forged Firebase UID/provider subject | Caller submits a victim UID or provider-link ID | Bridge validates the Firebase token and resolves the exact subject/link server-side; provider subject/link is never accepted as a command actor input | Token subject, link, and profile mismatch is denied with no row-count or existence oracle |
| Unverified Firebase identity | A valid but unverified account accesses protected Claim data or creates authority | Current Firebase Admin evidence and token evidence must agree on required verification; disagreement or absence denies | Unverified token/current user receives no Claim search, read, notification, reviewer, controller, or command access |
| Disabled or deleted Firebase account | Previously valid identity continues to access Supabase | A current Firebase Admin user observation is required for every Claim-first request; disabled or not-found denies before database access | Disabling/deleting the emulator/staging user invalidates the next request even if the prior Firebase token has not expired |
| Stale identity mirror | Old PostgreSQL `verified/active` mirror overrides Firebase | Mirror is supporting evidence only. The bridge refreshes/compares it under one policy version; stale, failed, or contradictory observation denies | Fresh Firebase state versus stale/mismatched link/profile mirror denies |
| Ambiguous identity mapping | One provider subject or profile maps inconsistently | Resolve one exact active primary Firebase link; duplicates, historical collisions, or missing lineage quarantine and deny | Synthetic duplicate/conflict fixtures resolve no principal |
| Cross-user Claim read | A user enumerates or reads another user's Claim | Claimant path predicates exact `claimant_user_profile_id = current principal`; unauthorized IDs return the same safe not-found result | Claimant A cannot read Claimant B by UUID, filter, join, pagination, count, or RPC argument |
| Cross-Supplier ownership read | A controller enumerates ownership for unrelated Suppliers | Controller projection predicates current active controller relationship and requested Supplier together | Controller A sees only A-controlled ownership rows; historical or unrelated rows are absent |
| Claimant reading another claimant's evidence | Competing claimant PII/evidence leaks | Self projection exposes only the current principal's submitted snapshot/evidence; no Supplier relationship broadens it | Competing claimants for one Supplier cannot see each other's rows, counts, evidence, or status |
| Supplier controller reading competing Claims | Ownership is misused as Claim-review authority | Controller relationship grants no Claim-row policy. A controller sees another Claim only if independently the claimant or an assigned usable reviewer | Current/new/previous controller receives no competing Claim/evidence/reviewer data |
| Admin without usable platform authority | An inert, stale, or forged role row grants review access | Reviewer resolution requires the complete usable Admin/Owner predicate, not role code alone | Active role with missing access, stale provider evidence, inactive profile, or security deny receives no reviewer row |
| Global reviewer privilege | All Admins/Owners can browse private Claims | `reviewer` is not a platform role. Claim read/decision additionally requires a current exact assignment and no conflict | Usable but unassigned Admin/Owner cannot list or open an assigned Claim |
| Reviewer conflict | Claimant, owner/member, or conflicted actor reviews the Claim | Conflict resolver runs for reviewer read, begin-review, approval, and rejection; conflict denies and requires reassignment | Each prohibited relationship fixture denies both read and decision and records the required safe denial evidence |
| Last usable Owner loss | Role/identity/access change strands administration | RLS is not used for this invariant. Every eligibility-removing command/job uses the common final-Owner serialization guard | Concurrent role/profile/link/access changes cannot commit a state with zero usable Owners |
| Direct browser insert/update/delete | Client bypasses lifecycle validation | No base mutation grants and no permissive mutation policy. Every authoritative mutation is a registered command with server-derived actor/state/time | `anon` and `authenticated` direct writes fail for every protected table, including guessed columns and bulk requests |
| Hidden-column leakage | A row-valid response exposes contacts, provider subjects, evidence, notes, or provenance | Explicit response types/column allowlists; no `select *`, generic JSON row, automatic table endpoint, or client-selectable projection columns | Schema-contract tests compare exact output fields and attempt every excluded column/path |
| Internal-schema exposure | Browser reaches audit, identity-link, reliability, or migration data | `internal` absent from exposed schemas; explicit schema/table/function/default-privilege revocation; no browser-executable helper | Data API discovery and calls cannot resolve `internal` objects; catalog privilege tests stay false |
| Service-role misuse | A leaked broad token bypasses RLS | Never use `service_role` in browser or ordinary Claim runtime. Keep its relevant base privileges revoked; use separate no-`BYPASSRLS`, non-owner, narrowly granted roles | Service-role API token has no Claim endpoint/table authority; each dedicated worker fails outside its registered objects/actions |
| Unsafe definer routine | An RPC bypasses RLS or resolves attacker-controlled objects | Dedicated non-login owner without `BYPASSRLS`; fixed empty/minimal search path; schema-qualified objects; `PUBLIC` execute revoked; explicit argument/result types; no dynamic SQL | Catalog tests verify owner/flags/search path/grants and malicious object-name/search-path inputs have no effect |
| Replay or stale bridge context | Captured database assertion survives Firebase disablement or crosses environment/purpose | Claim-first bridge context is request- and transaction-scoped, environment/policy-bound, never stored in the browser, and created after a current Firebase Admin observation | Context cannot be reused in another transaction; prior context fails after request end, environment change, policy-version change, or provider disablement |
| Trusted-command replay | Duplicate submit/decision produces duplicate state | Command-specific idempotency key/fingerprint, expected version, locking, and safe-result replay under REL-001 | Identical replay returns the original safe result; changed binding fails; no duplicate Claim, ownership, audit-success, event, or notice |
| Existence/count oracle | Denied users infer Claimants or conflicts from errors/counts | Targeted unauthorized reads use a uniform safe not-found response; list/count endpoints apply authorization before aggregation | Unknown and unauthorized IDs have the same status/body shape and bounded timing expectations |
| Notification ownership drift | New owner or Admin inherits a claimant's notice | Notification recipient remains the immutable claimant profile; ownership/membership change never transfers it | New controller and unrelated Admin cannot read historical claimant notifications |

## 5. Identity boundary and Auth bridge prerequisites

### 5.1 Recommended first-release bridge pattern

**Recommendation:** use a server-mediated Firebase Auth bridge/gateway for the first Claim release. The browser sends its Firebase ID token only to that trusted gateway. The gateway performs Firebase and relational identity checks, then executes one database request as a dedicated Claim runtime role with transaction-scoped identity context. The browser receives neither a reusable database credential nor a `service_role` token.

Direct browser-to-PostgREST custom JWT exchange remains a later alternative. It is **not approved by this proposal**, because its exact signer custody, expiry, refresh, revocation latency, audience, issuer, replay, and browser-storage rules have not been reviewed.

### 5.2 Required bridge validation

Before any Claim-first database read or command, the bridge must:

1. validate the Firebase ID token signature, issuer, audience/project, expiry, and subject using the approved Firebase Admin path;
2. fetch the current Firebase user for that exact subject during the same authorization attempt;
3. require that the Firebase account exists, is not disabled, and is email-verified where the Claim contract requires verification;
4. require token and current Firebase evidence to agree; missing email, verification disagreement, not-found, provider outage, or lookup failure denies;
5. resolve exactly one active primary `firebase` provider link for that exact subject;
6. resolve that link to exactly one active, non-suspended, non-deactivated `user_profiles` row;
7. compare/refresh the provider-link mirror and reject stale, conflicting, duplicated, quarantined, or version-incompatible evidence;
8. evaluate feature-specific account context only where required: Supplier context is required to search for an unowned Supplier or submit/withdraw an active ordinary Claim, while an eligible claimant may still read their retained own Claim/history after a later context change;
9. set only server-derived, transaction-local authorization context; and
10. clear the context automatically when the transaction ends.

For Claim v1, a current Firebase Admin observation is required on every protected request. No nonzero cache age is approved. A future cache requires a separate maximum-age, revocation-latency, invalidation, outage, and replay decision.

### 5.3 Minimum database identity context

The database receives only the bounded values needed to verify the assertion:

- resolved `user_profile_id` as the domain principal;
- resolved provider-link identity for session verification only, never as a domain party or returned field;
- provider observation time/version and bridge policy/contract version;
- environment and request/correlation identity; and
- the dedicated runtime role/purpose that established the context.

Platform role, reviewer authority, Supplier ownership, membership, Claim identity, and target IDs are **not** trusted bridge claims. PostgreSQL re-reads those current relationships. A transport claim equivalent to PostgreSQL `authenticated` is only a technical role selector and never an application Owner/Admin/reviewer role.

### 5.4 Fail-closed resolver contract

Every RLS policy and Claim API routine uses one reviewed current-principal resolver. It returns exactly one provider-neutral profile UUID or no principal. It must not return a principal when any context field is missing, malformed, expired, wrong-environment, wrong-purpose, wrong-version, caller-settable, or inconsistent with current profile/link rows.

The resolver and supporting authorization helpers live in a non-exposed schema. They are not browser-executable discovery endpoints and return booleans/opaque IDs only where the policy needs them; they never return provider subjects, role histories, conflicts, security holds, or match explanations.

## 6. Base-table exposure matrix

The terms below mean:

- **Internal only** — object is outside browser/API schemas and has no browser/API privilege.
- **No direct client access** — base relation is not a client endpoint even if it remains in `public` for relational design.
- **Self-readable** — only through an explicit field-minimized self RPC/projection, never base-table selection.
- **Controlled projection only** — a named audience receives an exact allowlisted response.
- **Trusted-command-only mutation** — no browser row write; a narrow command derives protected fields server-side.

| Relation | Base exposure | Claim-first read contract | Mutation contract |
|---|---|---|---|
| `public.user_profiles` | No direct client access | No standalone Claim-v1 profile endpoint is required. A later self projection may expose only safe self fields; reviewer/controller routines consume eligibility without returning profile internals | Trusted identity/profile commands only for status, context, mirrors, and security fields |
| `internal.identity_provider_links` | Internal only | No raw self, Admin, reviewer, controller, or browser read. The bridge may return a generic eligible/ineligible result without UID, subject, evidence, or link history | Trusted bridge/reconciliation/correction commands only |
| `public.platform_role_assignments` | No direct client access | No Claim-v1 browser list. Reviewer authorization consumes the current effective assignment without returning role history/evidence | Trusted Owner/bootstrap/role-administration commands only; final-Owner guard required |
| `public.supplier_profiles` | No direct client access | Controlled Claim-safe Supplier projection only; no anonymous/public base read | Trusted Supplier lifecycle/profile commands only |
| `public.supplier_locations` | No direct client access | Controlled projection may expose only the bounded governorate/city fields approved for Claim lookup; source/mapping/review/address/map evidence excluded | Trusted reviewed mapping/profile commands only |
| `public.supplier_contacts` | No direct client access | Claim v1 may expose only the separately approved sanitized website domain through the Claim Supplier projection. No phone, email, person, raw URL, verification, consent, or source fields | Trusted contact/privacy commands only; no Claim browser mutation |
| `public.supplier_category_assignments` | No direct client access | Controlled Claim projection may expose at most three active reviewed category labels; assignment provenance/status/history excluded | Trusted classification commands only |
| `public.supplier_capabilities` | No direct client access | Omitted from Claim v1. A later labels-only projection requires its own approved audience | Trusted capability review/lifecycle commands only |
| `public.supplier_payment_options` | No direct client access | No Claim or Buyer client projection is approved | Trusted review/lifecycle commands only |
| `public.supplier_ownerships` | No direct client access | Current controller self projection and field-minimized ownership history only. Claimants/reviewers receive ownership facts only as safe eligibility/result fields, never controller identity unless independently authorized | Claim approval, transfer, revoke, correction, and reconciliation commands only |
| Future `public.supplier_ownership_claims` | No direct client access | Claimant-own, assigned-reviewer, and separately controlled queue projections only; no generic Admin/Owner/Supplier access | Submit, withdraw, assignment, begin review, approve, reject, expire, supersede, and correction commands/workers only |
| `internal.audit_logs` | Internal only | No Claim-v1 client read. Future investigation/export is a separate purpose-limited audited command | Registered trusted commands, migration, and audit maintenance only; append/correct, never ordinary update/delete |
| Future `internal.idempotency_keys` | Internal only | No client read | Registered trusted commands/workers only |
| Future `internal.domain_events` | Internal only | No client read | Domain command inserts; named worker alone changes processing state |
| Future `public.notifications` | No direct client access | Self-readable field-minimized inbox projection only, exact immutable recipient; no Admin/Owner/controller inheritance | One materializer inserts; recipient self command sets only `read_at`; retention service alone archives/purges under approved policy |

All other Supplier base tables remain non-public. The presence of a table in the `public` PostgreSQL schema does not mean public audience access.

## 7. Claimant read contract

### 7.1 Allowed claimant projection

**Recommendation:** an eligible current claimant may receive only rows where `claimant_user_profile_id` equals the resolved current principal. The projection is explicit and contains:

- Claim UUID, Supplier UUID, and an immutable claimant-visible reference if separately approved;
- current safe status: `submitted`, `under_review`, `approved`, `rejected`, `withdrawn`, `expired`, or `superseded`;
- Claim version and claimant-visible submitted, expiry, under-review, decided, withdrawn, expired, or superseded timestamps where present;
- the claimant's own immutable submitted reason, claimant-visible snapshot, and at most three submitted evidence descriptors/references exactly as permitted by the Claim evidence contract;
- a safe result code from section 7.3;
- whether a new submission is permitted and a safe resubmission-not-before time where policy allows disclosure; and
- the separate Claim-safe Supplier projection: Supplier UUID, bilingual names, bounded governorate/city, up to three active category labels, and sanitized website domain.

The claimant history is a safe timeline derived from the Claim aggregate's approved claimant-visible transition fields. It is not a projection of `audit_logs`, `domain_events`, reviewer assignments, or raw internal status history.

### 7.2 Prohibited claimant fields

The claimant cannot receive:

- another claimant's Claim existence, count, identifier, status, snapshot, reason, evidence, history, or notification;
- reviewer identity, assignment actor, platform role/access evidence, reviewer notes, restricted decision notes, evidence-verification source details, conflict relationship, security hold, or investigation status;
- current/proposed controller identity, competing Claim count/identities, ownership provenance, or superseding approved Claim identity;
- provider subject/link identity, verification evidence reference, Firebase UID, token/session data, mirror internals, or migration mapping;
- audit IDs/rows, domain-event payloads, idempotency state/key/fingerprint, worker state, safe error internals, or notification materialization state; or
- private Supplier contacts, addresses, map/source URLs, source notes, confidence/security/duplicate signals, payment options, restricted capabilities, review evidence, or internal lifecycle reasons.

### 7.3 Claimant-safe result codes

**Recommendation:** the claimant-facing allowlist is exactly:

- `approved`;
- `insufficient_evidence`;
- `claimant_ineligible`;
- `supplier_mismatch`;
- `existing_owner`;
- `withdrawn`;
- `expired`;
- `superseded`;
- `not_approved`; and
- `result_unavailable`.

Internal fraud/abuse, conflict, quarantine, identity, reviewer, evidence-source, integrity, and system failure codes map to `not_approved` or `result_unavailable` according to the approved disclosure registry. Unknown codes never pass through. A superseded result discloses no approved claimant, owner, competing Claim, or evidence.

Unauthorized and unknown Claim IDs return the same safe not-found response. List totals/counts are computed only after the self predicate, and pagination cursors cannot encode another claimant's identity.

## 8. Supplier controller contract

**Recommendation:** after ownership is established, a currently eligible primary controller may receive a controller projection for the Supplier they currently control. It may contain:

- Supplier UUID and the separately approved Supplier presentation/operational fields;
- the controller's own current ownership UUID, authority type, status, validity start, and safe closure state where applicable; and
- field-minimized ownership history only for rows in which the current principal is the controller, unless a later governance/support contract approves more.

The controller relationship does not grant:

- raw access to any Claim merely because it targets that Supplier;
- historical or competing claimant identity, contact snapshot, submitted reason, evidence, reviewer identity/notes, decision evidence, or security/conflict data;
- global ownership history, prior controller evidence, establishment/closure evidence, migration exceptions, or audit/event data; or
- implicit access after transfer/revocation or access to another Supplier.

If the controller was also the claimant, they retain claimant access to their own Claim because the claimant predicate independently matches. Ownership never broadens that path. A successor controller inherits no prior private Claim, notification, conversation, or message access.

## 9. Reviewer and Admin/Owner contract

### 9.1 Reviewer is an assignment, not a role

**Approved existing contract:** `reviewer` is not a platform role.

**Recommendation:** an actor may use the reviewer projection only if all of these facts are current in the same request and policy version:

1. the bridge resolves a current verified Firebase identity to one active profile;
2. the profile has compatible `buyer` platform-administration context;
3. exactly one active, in-time `owner` or `admin` assignment exists;
4. current role-backed platform-administration access exists;
5. no security deny, quarantine, identity conflict, stale mirror, or contradictory evidence exists;
6. the actor holds the exact current Claim reviewer assignment, including matching Claim ID, reviewer profile, assignment/review version, active state, valid time, and nonterminal status;
7. the actor is not the claimant, current/proposed controller, or later active Supplier member/admin/delegate for the target Supplier; and
8. no recorded conflict/security hold applies.

Missing access infrastructure or conflict data denies; it is never treated as an empty/clear result.

### 9.2 Reviewer visibility

An eligible assigned reviewer may receive only the bounded record required for the assigned Claim:

- Claim identity/version/status/deadline and assignment version;
- claimant snapshot and immutable submitted reason/evidence permitted by the review contract;
- Claim-safe Supplier data plus separately authorized review-only Supplier fields;
- prior safe Claim result needed for resubmission review;
- evidence-verification fields the reviewer must complete; and
- current integrity/eligibility outcomes as bounded booleans/codes, without raw provider, security, competing claimant, or ownership-source data.

The assigned-reviewer queue contains only currently assigned, currently reviewable Claims. List rows exclude evidence, claimant contact snapshot, notes, provider data, and internal conflict detail; detail is loaded by Claim ID after the same checks repeat.

### 9.3 Admin and Owner behavior

- A role row without the complete usable predicate authorizes nothing.
- A usable but unassigned Admin cannot browse, open, or decide a Claim.
- A usable but unassigned Owner does not receive global Claim read access.
- The recommended Claim-v1 assignment/reassignment authority is a usable Owner through an audited trusted command. A future Admin assignment power requires separate explicit approval and self-assignment/conflict controls.
- An Owner override never bypasses identity, current access, conflict, target-state, evidence, audit, idempotency, or concurrency checks. The override/reassignment command first creates a current accountable assignment/version, then the ordinary assigned-reviewer policy applies.

## 10. RLS responsibility versus trusted-command responsibility

| Boundary | Question answered | May enforce | Must not enforce alone |
|---|---|---|---|
| RLS | “May this resolved principal access this row for this database operation?” | Exact claimant ownership, exact notification recipient, current controller relationship, current reviewer assignment plus usable-authority helper, default-deny mutation policies | Firebase token validation, last-Owner safety, workflow transition legality, idempotency, multi-row locking, evidence verification, competing-Claim supersession, notification creation |
| Projection/RPC response | “Which fields and safe codes may this allowed audience receive?” | Exact allowlisted columns, safe code mapping, controlled Supplier summary, pagination/count minimization | Domain transition authority or hidden server-side state mutation |
| Trusted command/worker | “Is this state transition valid and atomic now?” | Current identity/role/access checks, expected version, locks, transition graph, idempotency, audit, events, ownership change, worker leases | Broad row visibility or general-purpose client CRUD |
| Declarative constraints | “Can an impossible structural state be stored?” | Uniqueness, restrictive FKs, non-overlapping intervals, bounded status/shape | Actor authorization, external Firebase state, conflict-of-interest, complete final-Owner predicate |

Complex workflow transitions must not be encoded only in RLS. No browser role receives an authoritative Claim `INSERT`, `UPDATE`, or `DELETE` path even if a row-level predicate could be written.

## 11. Trusted mutation boundary

**Recommendation:** the first Claim release treats all authoritative Claim and ownership transitions as registered trusted commands/workers.

| Action | Trusted boundary | Minimum additional checks | Direct client row write |
|---|---|---|---|
| Submit Claim | Self-only trusted command | Current verified Firebase/profile/link; Supplier context; unowned eligible Supplier; no active claimant/Supplier Claim; immutable bounded evidence; idempotency | Denied |
| Withdraw Claim | Self-only trusted command | Exact claimant; active `submitted` or `under_review`; expected version; unexpired/nonterminal state; no operator impersonation | Denied |
| Assign/reassign reviewer | Usable Owner trusted command in Claim v1 | Candidate usable Admin/Owner; distinct accountable assigner; no claimant/controller/member conflict; assignment version; audit | Denied |
| Begin review | Assigned reviewer trusted command | Exact current assignment/version; `submitted`; unexpired Claim; conflict recheck; expected version | Denied |
| Approve | `supplier_ownership.decide_claim` | Complete actor/claimant/Supplier/evidence checks, unowned slot, deterministic competing-Claim locks, audit/idempotency/events | Denied |
| Reject | `supplier_ownership.decide_claim` | Same actor/Claim integrity checks; bounded reason/disclosure mapping; audit/idempotency/event | Denied |
| Expire | Named scheduled worker | Trusted time, active horizon, expected version, idempotent bounded batch, no user-selected timestamp | Denied |
| Supersede | Effect inside approval or separately approved replacement command | Never standalone browser update; deterministic affected set and causal Claim reference | Denied |
| Ownership transfer | Separate trusted command | Current controller/elevated policy, new-controller eligibility, locks, access/participant changes, audit/event | Denied |
| Ownership revoke | Separate trusted Admin/Owner command | Approved reason/policy, current ownership/version, access/eligibility recomputation, audit/event | Denied |
| Mark Claim notice read | Self-scoped command | Exact immutable recipient and current principal; set `read_at` once | Base update denied |

Browser input never selects the effective actor, claimant, reviewer authority, Supplier controller, status, timestamps, versions after commit, audit/event IDs, notification recipient/content, platform role, or provider identity.

## 12. Column privacy and projection strategy

### 12.1 Recommended Claim-first API surface

Use a dedicated exposed API schema containing only explicitly granted Claim RPC endpoints. Keep base relations ungranted. The first read surface should be narrowly named around:

- Claim-safe Supplier lookup;
- claimant-own Claim list/detail/history;
- assigned-reviewer queue/detail;
- current-controller ownership summary; and
- self Claim-notification list/mark-read when relational notifications exist.

Each endpoint returns a fixed typed field list. It does not accept a caller principal, arbitrary column selector, table name, filter expression, raw SQL fragment, arbitrary URL, unrestricted JSON response shape, or generic “admin mode.”

### 12.2 Routine ownership and RLS behavior

Because security-invoker views require the invoker to hold privileges on underlying relations, they do not by themselves preserve the current zero-base-grant browser boundary. They are therefore not the preferred Claim-private projection for the first slice.

The recommended RPC owner is a dedicated non-login role that:

- is not a superuser, table owner, `service_role`, or a role with `BYPASSRLS`;
- has only the exact base column/operation privileges required by the routine;
- remains subject to enabled and forced RLS on protected base tables;
- owns no schema where an attacker can create shadow objects;
- uses schema-qualified objects and a fixed minimal search path; and
- exposes execute only on the named endpoint to the exact runtime role.

Internal authorization helpers may use narrowly reviewed elevated reads only when required to inspect non-exposed relationship tables. They return a boolean or opaque principal fact, expose no protected fields, have `PUBLIC` execute revoked, and receive independent catalog/security tests. No generic security-definer data reader is allowed.

### 12.3 Base RLS stance

- Enable and force RLS on every client-reachable protected base relation before granting any API routine that depends on it.
- No `anon` Claim policy exists.
- No browser-role insert, update, delete, or broad select policy exists.
- Claimant select predicates exact claimant identity.
- Controller predicates exact current controller identity and validity.
- Reviewer predicates exact current assignment plus the complete usable-authority and conflict result.
- Notification select/update predicates exact immutable recipient; update is still performed only by the mark-read command.
- Policy helper failure, null, exception, ambiguity, or missing dependency evaluates to deny.

RLS is defense in depth behind object grants and explicit RPC responses; it is not the column-projection mechanism.

## 13. Internal schema and grant expectations

**Recommendation:** the implementation must prove all of the following:

- `internal` is absent from every Data API exposed-schema configuration in local, CI, development, staging, and Production.
- `PUBLIC`, `anon`, `authenticated`, `service_role`, and every browser/application API role have no schema usage or object privilege on `internal` unless a separately named non-browser role receives a specific object privilege.
- Default privileges prevent future internal tables, sequences, and functions from becoming reachable automatically.
- Browser/API roles cannot execute internal authorization helpers.
- `service_role` retains no Claim base-table convenience grant and is not used by the Claim gateway, reviewer path, notification materializer, expiry worker, or migration operator.
- Each worker/operator role is separate, non-browser, non-superuser, and limited to its named operations; online worker and migration duties are not combined.
- Function ownership, role membership, `BYPASSRLS`, search-path configuration, schema creation privileges, and table ownership are catalog-tested.
- API discovery, REST/RPC, GraphQL, and Realtime paths cannot enumerate or subscribe to internal relations.

## 14. Claim concurrency and locking boundary

RLS does not solve Claim concurrency.

**Approved existing contract and recommendation:**

- Enforce at most one active Claim per claimant/Supplier pair while permitting active Claims from different claimants for one unowned Supplier.
- Submission locks/rechecks the claimant/Supplier active slot and the Supplier ownership slot before inserting.
- Begin-review locks/rechecks Claim version, expiry, and assignment version.
- Decision handling uses the documented deterministic order: idempotency record/lease; actor identity/profile/role/access/conflict inputs; target Claim and assignment; claimant eligibility; Supplier; ownership slot/history; all active competing Claims ordered by stable Claim UUID; evidence/security holds.
- Approval atomically terminalizes the selected Claim, creates exactly one active ownership, supersedes every other active Claim for the Supplier, completes idempotency, writes the required audit outcome, and emits deterministic events.
- Rejection changes no ownership and no competing Claim.
- A uniqueness or version conflict returns a stable minimized failure and writes no partial state.
- RLS continues to hide competing Claims before, during, and after supersession.
- A direct standalone supersede write is never permitted.

The final implementation must include race tests with two simultaneous approvals, approval versus withdrawal, approval versus expiry, ownership creation versus approval, reviewer reassignment versus decision, and provider/role/access loss versus decision.

## 15. Audit and security evidence

### 15.1 Durable audit required

Under the approved AUD-001 boundary, durable minimized audit evidence is required for:

- successful approval and rejection in the authoritative transaction;
- reviewer-conflict, unauthorized decision, stale-version, existing-owner, identity/eligibility, evidence, quarantine, and integrity failures after an accountable actor/source is resolved;
- reviewer assignment/reassignment and Owner override because they grant private Claim visibility;
- ownership transfer, revocation, and security-sensitive correction;
- role/access/identity mutations that affect reviewer or final-Owner eligibility;
- service/worker privilege misuse, dead-letter requeue, and privileged repair after accountable source resolution; and
- migration/reconciliation overrides or authority-manifest changes where applicable.

**Recommendation pending action-registry approval:** accepted Claim submission, withdrawal, and begin-review should receive minimized durable action outcomes because they create private evidence or expand access. Expiry and per-competing-Claim supersession remain authoritative domain/event history; the approval audit records the superseded count without competing identities unless the approved audit registry requires per-Claim records.

### 15.2 Denied reads and pre-auth traffic

- Malformed, unauthenticated, expired-token, and unmapped traffic rejected before an accountable domain actor is resolved uses rate-limited security telemetry, not durable business audit by default.
- Ordinary RLS not-found/deny outcomes do not create one audit row per read.
- Repeated enumeration, cross-user Claim probing, internal-schema access, service-role misuse, or other promoted attack classes require bounded security telemetry/alerts and may enter durable audit only through an approved action/security registry.
- Telemetry/audit never stores tokens, Firebase UID/provider subject as the domain actor, Claim evidence, notes, contacts, request bodies, SQL errors, or unrestricted exceptions.

Audit unavailability never turns a denial into permission or lets a required audited mutation commit.

## 16. Notification access consistency

The Claim notification boundary remains exactly consistent with MSG-003:

- the recipient is the claimant's immutable `user_profiles.id`;
- approved, rejected, and superseded are the only Claim-v1 user-visible notices;
- ordinary visibility is self-only through a controlled inbox projection;
- claimant status/reason disclosure uses the safe notification template registry, not raw decision codes or notes;
- controller, reviewer, Admin, Owner, successor owner, and service roles receive no recipient inheritance;
- the recipient may set only their own `read_at` through the self command;
- notification creation belongs only to the named materializer; and
- Firebase is not a notification fallback after Supabase authority for the Claim feature.

## 17. Deterministic authorization test matrix

### 17.1 Fixture definitions

All matrices assume synthetic local or approved staging fixtures. “Allow” means the exact named projection/command returns or mutates only authorized data. “Deny” means no rows/no mutation and the approved safe error. “Conditional” names a distinct trusted path, not discretionary bypass.

- **Unusable Admin** has an apparent active Admin assignment but fails at least one required profile/link/access/security predicate.
- **Usable Admin** passes the complete global predicate but has no assignment to the target Claim.
- **Usable Owner** passes the complete global predicate but has no assignment to the target Claim.
- **Assigned reviewer** is a usable Admin or Owner with the exact current target assignment and no conflict.
- **Generic service role** means the Supabase `service_role` API identity, not a dedicated worker.
- **Dedicated worker** has only one registered non-browser purpose.

### 17.2 Read and exposure matrix

| Actor | Claim Supplier lookup | Own Claim projection | Target Claim through claimant path | Target Claim through reviewer path | Controller ownership projection | Own Claim notification | Direct base/internal access |
|---|---|---|---|---|---|---|---|
| Anonymous | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Authenticated but unmapped | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Mapped but inactive profile | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Unverified Firebase identity | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Disabled/deleted Firebase identity | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Ordinary unrelated active Buyer user | Deny | Deny/no rows | Deny | Deny | Deny | Deny/no rows | Deny |
| Claimant | Allow | Allow own only | Allow only when target is own; otherwise deny | Deny unless independently assigned/usable | Deny unless independently current controller | Allow exact recipient only | Deny |
| Another claimant for same Supplier | Allow | Allow their own only | Deny target claimant's row/count/evidence | Deny unless independently assigned/usable | Deny unless independently current controller | Allow their own only | Deny |
| Current Supplier controller | Allow for another eligible unowned Supplier | Allow only if independently claimant | Deny another claimant | Deny unless independently assigned/usable | Allow current own Supplier only | Allow only exact recipient | Deny |
| Unrelated Supplier controller | Allow for eligible unowned Suppliers | Allow only if independently claimant | Deny | Deny | Deny target Supplier; allow only their own Supplier | Allow only exact recipient | Deny |
| Assigned Claim reviewer | Deny Claimant search unless independently Supplier-context eligible | Allow only if independently claimant | Deny claimant endpoint for another user | Allow exact assigned/current Claim only | Deny unless independently controller | Allow only exact recipient | Deny |
| Unusable/unassigned Admin | Deny | Deny/no rows | Deny | Deny | Deny | Deny/no rows | Deny |
| Usable but unassigned Admin | Deny | Allow only if independently claimant | Deny | Deny target and all unassigned Claims | Deny unless independently controller | Allow only exact recipient | Deny |
| Usable but unassigned Owner | Deny | Allow only if independently claimant | Deny | Deny until audited assignment/override establishes assignment | Deny unless independently controller | Allow only exact recipient | Deny |
| Generic `service_role` API identity | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Dedicated expiry/materializer worker | Deny human projections | Deny | Deny | Deny | Deny | Deny inbox read; allow only named worker write/read set | Deny outside registered objects |
| Migration operator | Deny online projections | Deny | Deny | Deny | Deny | Deny | Deny except separately approved migration objects/runbook |

### 17.3 Trusted-command matrix

| Actor | Submit own Claim | Withdraw own active Claim | Assign/reassign reviewer | Begin assigned review | Approve/reject | Expire | Standalone supersede | Transfer current ownership | Revoke ownership |
|---|---|---|---|---|---|---|---|---|---|
| Anonymous | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Authenticated but unmapped | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Mapped but inactive profile | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Unverified Firebase identity | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Disabled/deleted Firebase identity | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Ordinary unrelated active Buyer user | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Eligible Supplier-context claimant | Allow when target unowned/no active pair | Allow exact own active Claim | Deny | Deny | Deny | Deny | Deny | Deny unless independently controller | Deny |
| Another eligible claimant | Allow for their own target | Allow only their own active Claim | Deny | Deny | Deny | Deny | Deny | Deny unless independently controller | Deny |
| Current Supplier controller | Allow for another eligible unowned Supplier | Allow only own Claim | Deny | Deny | Deny | Deny | Deny | Conditional: separate trusted transfer request and full checks | Deny ordinary self-revoke path unless separately approved |
| Unrelated Supplier controller | Allow for another eligible unowned Supplier | Allow only own Claim | Deny | Deny | Deny | Deny | Deny | Deny target Supplier | Deny target Supplier |
| Assigned Claim reviewer | Deny unless independently eligible Supplier-context claimant | Allow only if independently target claimant, never as reviewer | Deny self-assignment | Allow exact assigned Claim | Allow exact assigned Claim with all checks | Deny | Deny; supersession is approval effect | Deny | Deny |
| Unusable/unassigned Admin | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Usable but unassigned Admin | Deny unless independently eligible claimant | Allow only if independently claimant | Deny in Claim v1 | Deny | Deny | Deny | Deny | Deny absent separately approved elevated policy | Deny absent separately approved elevated policy |
| Usable but unassigned Owner | Deny unless independently eligible claimant | Allow only if independently claimant | Allow through audited Owner command | Deny until assignment/override becomes current | Deny until assignment/override and all checks pass | Deny | Deny | Conditional through separate trusted elevated transfer policy | Conditional through separate trusted revoke policy |
| Generic `service_role` API identity | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Dedicated expiry worker | Deny | Deny | Deny | Deny | Deny | Allow only due active Claims under worker contract | Deny standalone; may terminalize expiry only | Deny | Deny |
| Dedicated notification materializer | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny |
| Migration operator | Deny online command | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny; separately approved mapping is not an online mutation |

### 17.4 Required negative and race cases

| Test ID | Scenario | Expected result |
|---|---|---|
| ID-01 | Missing bridge context | No principal; every policy denies |
| ID-02 | Caller supplies victim profile/link/UID | Ignored; no victim row or mutation |
| ID-03 | Valid Firebase token, missing provider link | Deny with safe identity-unavailable result |
| ID-04 | Duplicate/conflicting provider linkage | Deny and quarantine path; no principal winner inferred |
| ID-05 | Token verified but current Firebase user unverified/disabled/not-found | Deny before database domain access |
| ID-06 | Firebase Admin unavailable or mirror/policy version stale | Deny; no cached/mirror fallback |
| ID-07 | Reuse transaction context in a new request | Deny; context is no longer valid |
| ROW-01 | Claimant queries another Claim by UUID | Uniform safe not-found; no count/timing/detail oracle |
| ROW-02 | Competing claimants paginate/filter/count one Supplier | Each sees only own rows; no competing count |
| ROW-03 | Current, prior, or successor controller queries Claim data | No row unless independently claimant/assigned reviewer |
| ROW-04 | Usable unassigned Admin/Owner opens reviewer detail | Deny |
| ROW-05 | Assigned reviewer becomes conflicted, inactive, unverified, revoked, or unassigned | Next read/decision denies |
| COL-01 | Allowed claimant requests reviewer/evidence-verification/provider/audit fields | Endpoint rejects/omits; response contract unchanged |
| COL-02 | Allowed controller requests establishment/closure evidence or other controllers | Endpoint rejects/omits |
| COL-03 | Claim lookup searches phone/email/source note/payment/security fields | Fields are absent from search input/result and cannot affect membership |
| GRANT-01 | `anon`, `authenticated`, generic `service_role` select/mutate every protected base table | All fail |
| GRANT-02 | Data API/GraphQL/Realtime attempts `internal.*` | Object unavailable and privilege false |
| GRANT-03 | API role executes internal helper or unlisted routine | Execute denied |
| GRANT-04 | Dedicated worker calls another worker/human endpoint | Deny |
| FUNC-01 | Routine owner has table-owner/superuser/`BYPASSRLS`/unsafe role inheritance | Catalog test fails the migration |
| FUNC-02 | Search-path/object shadow attempt | No effect; routine uses reviewed qualified objects |
| MUT-01 | Browser direct Claim insert/update/delete, including allowed-row IDs | Deny |
| MUT-02 | Caller selects actor/status/time/reviewer/owner/audit/event/notification fields in command payload | Rejected/ignored according to typed request; server derives all authority fields |
| CON-01 | Two claimants submit same Supplier concurrently | Both may succeed only as distinct active claimant/Supplier pairs; no duplicate pair |
| CON-02 | Two reviewers approve competing Claims concurrently | Exactly one approval/ownership commits; loser returns stable conflict; no partial audit/event/notice |
| CON-03 | Approval races withdrawal/expiry/reassignment/provider disable/role revoke | At most one valid transition commits after current re-read; other fails safely |
| CON-04 | Ownership appears after submission before approval | Approval fails `existing_owner`; no auto-link |
| OWN-01 | Role/profile/link/access changes race on final usable Owner | State with zero usable Owners cannot commit |
| REP-01 | Identical command replay | Original safe result; no duplicate success effects |
| REP-02 | Same idempotency key with changed fingerprint/actor/environment | Deny conflict; minimized audit after actor resolution |
| NTF-01 | Ownership transfer followed by notification read | Notice stays self-only to original claimant |
| NTF-02 | Materializer retry/duplicate invocation | One exact notification tuple or fail-closed binding conflict |
| AUD-01 | Required audit insert fails during successful decision | Entire decision/ownership/idempotency/event transaction rolls back |
| AUD-02 | Post-auth denial audit fails | Denial remains denial; safe audit-unavailable/integrity result and restricted alert |

## 18. Fail-closed rules

Any of the following yields deny/no mutation:

- null, malformed, missing, expired, wrong-environment, wrong-purpose, or unsupported bridge context;
- Firebase verification/account lookup failure, timeout, provider outage, disabled/deleted account, or token/current-record disagreement;
- missing, stale, duplicate, ambiguous, inactive, or conflicting provider link/profile mirror;
- inactive profile, wrong command-specific context, missing access, unusable role, invalid reviewer assignment, conflict, or security hold;
- missing relation/table/helper required to prove authorization;
- policy/helper exception, unknown status/code/version, or incomplete migration/cutover manifest;
- stale expected version, lock conflict, idempotency conflict, or contradictory ownership/Claim state; or
- audit/event/idempotency/notification prerequisite failure where the command contract requires it.

No path falls back to Firestore role checks or Claim data after Supabase becomes authoritative for the feature. A rollback freezes and reconciles one authority manifest; it does not dual-authorize or silently resume Firebase writes.

## 19. Rollout order and dependency boundary

### 19.1 Local-only work possible before hosted Supabase

After separate approval, the following can be implemented and tested locally with synthetic identities/data:

1. exact Claim structural DDL selected by the separate structural-readiness task;
2. dedicated runtime/worker role model, default privileges, non-exposed helper schema, and catalog assertions;
3. fail-closed current-principal resolver using a test-only transaction-context harness, not a Firebase bridge claim;
4. forced RLS and default-deny policies on the selected protected relations;
5. fixed claimant/reviewer/controller/Supplier projection response contracts;
6. direct-mutation denial and trusted-command interface boundaries without enabling a client runtime;
7. the complete synthetic positive/negative/race pgTAP/integration matrix; and
8. sensitive-output, grant, function-owner, search-path, and internal-schema discovery tests.

This local security substrate is not a shippable Claim feature and is not authority to create real rows.

### 19.2 Firebase Auth bridge dependency

Before any end-to-end Claim client test, the bridge must implement and prove sections 5 and 18 against Firebase Emulator or another explicitly approved non-Production environment. It must also prove provider disablement/deletion/verification-loss behavior, no browser database credential, transaction-context cleanup, and no Firestore authorization fallback.

The exact bridge transport, database connection role, secret custody, recent-auth/step-up rule, abuse protection, outage behavior, and observability require Technical/Security/Operations approval.

### 19.3 Hosted staging dependency

Hosted staging requires:

- `RES-001` approval for hosted provider/region/resource/security posture;
- the environment separation and secret/promotion controls governed by `MIG-002` before any real mapping/data movement;
- an isolated staging project containing synthetic or separately approved non-Production data only;
- reviewed Data API exposed schemas, TLS/network controls, secret custody, backups, logs, and no Production Firebase authority change;
- implemented Claim/identity/role-access/audit/reliability/notification dependencies; and
- independent security review plus the complete matrix under the hosted configuration.

### 19.4 Production activation dependency

Production activation requires all of the following and a new explicit Owner approval:

- approved SEC-001 policy/grant/projection/bridge design and independently reviewed implementation;
- Claim structures and all required trusted commands/workers implemented and tested;
- ID-001 bridge behavior, platform role/access/bootstrap, final-Owner guard, and at least two usable Owners established under approved governance;
- AUD-001 action registry, audit writers, retention/access/enforcement decisions, and failure tests;
- the coherent REL-001 idempotency/domain-event foundation plus MSG-003 notification table/materializer/runtime;
- exact Claim retention/evidence/privacy rules and FILE-001 approval only if managed file evidence is introduced;
- approved `RES-001` hosted environment and `MIG-002` migration/cutover/reconciliation/rollback plan;
- bounded real-data mapping evidence, counts/fingerprints, quarantine handling, authority manifest, and rollback rehearsal;
- no unresolved security-critical negative or race test; and
- explicit feature activation, monitoring, incident, credential-rotation, break-glass, and rollback approval.

## 20. Unresolved decisions and approvals

This proposal deliberately leaves these items unresolved:

1. Product/Security/Data Owner approval or revision of this SEC-001 proposal.
2. Exact Claim structural columns, reviewer-assignment representation, history shape, and retention fields from the separate Claim structural-readiness review.
3. Exact RLS policy/helper/RPC names, schemas, DDL, function owners, runtime roles, grants, and migration ordering.
4. Final selection of server-mediated transaction context versus a later direct Data API custom-token design. This proposal recommends the former only for Claim v1.
5. Bridge credential custody, recent-auth/step-up, anti-replay/abuse controls, availability behavior, and operational revocation targets.
6. Exact role-backed platform-administration access implementation and security-hold/deny representation needed by the usable reviewer predicate.
7. Whether any future Admin may assign reviewers; Claim v1 recommends usable Owner-only assignment/reassignment.
8. Final claimant-safe result-code registry and internal-to-safe disclosure mapping.
9. Exact audit action registry for submit/withdraw/begin-review and exact audit/security retention, access, legal-hold, privacy, archive, and purge rules.
10. Exact notification, idempotency, domain-event, worker lease/retry/dead-letter, and operations implementation.
11. `FILE-001` if Claim evidence moves beyond the approved bounded non-file reference path.
12. `RES-001` hosted environment and `MIG-002` environment/migration/cutover strategy.
13. The unrelated Open gates `ORG-001`, `ORG-002`, `MSG-002`, and `BILL-001`, which remain unchanged and do not block the bounded unowned-Supplier Claim v1 unless their concepts are introduced.

## 21. Recommended implementation slices

### 21.1 Smallest safe local security slice

After this contract and the Claim structure are separately approved, implement one local-only, synthetic-data-only security slice containing:

1. dedicated non-browser Claim runtime and worker roles plus default-privilege tests;
2. one non-exposed current-principal/eligibility helper boundary fed only by a test transaction context;
3. forced RLS with no browser mutation policies on the Claim table and any directly consulted protected relation;
4. claimant-own Claim list/detail/history and Claim-safe Supplier lookup RPC projections only;
5. direct base/internal access denial; and
6. the identity, row, column, grant, function, and concurrency negative tests that apply before decision runtime.

This slice must contain no real Firebase bridge, real rows, hosted work, browser integration, decision command, ownership mutation, audit/event/notification runtime, migration, or Production action. It is a security substrate, not a feature launch.

### 21.2 Smallest shippable Claim vertical slice

There is no safe partial hosted fallback. The smallest shippable Claim slice is end-to-end and includes:

- trusted Firebase bridge and provider-neutral identity context;
- Claim-safe Supplier lookup;
- trusted submit and withdraw;
- assigned-reviewer queue/detail and trusted assignment/begin-review;
- trusted approve/reject with ownership creation and competing-Claim supersession;
- trusted expiry;
- audit, idempotency, domain events, and approved/rejected/superseded materialized notifications;
- claimant/controller/reviewer projections with forced RLS and no direct base writes; and
- complete positive, negative, race, replay, hosted, and rollback proof.

If any one of those dependencies is absent, keep the Supabase Claim feature inaccessible rather than mixing Supabase reads with Firebase authorization or command fallbacks.

## 22. Validation and exact stop point

Required validation for this proposal is documentation-only:

- record exact starting SHA `f5ee83096851991de680183c072b16987cb8784f`;
- confirm only this one Markdown file changed;
- confirm all repository links are relative and resolve;
- confirm evidence, approved contract, recommendation, and unresolved statements remain distinct;
- confirm SEC-001 and all seven Open gates remain unresolved/unchanged;
- scan the document for credentials, tokens, secrets, personal data, raw provider subjects, and executable SQL;
- run `git diff --check`; and
- confirm no executable, SQL, configuration, generated, Firebase, Supabase runtime, or data file changed.

Exact stop point: commit and push this single documentation proposal to `codex/claim-first-rls-contract`, open one Draft PR, and stop. Do not mark Ready, merge, implement RLS/SQL/Auth/commands/runtime, start Docker/Supabase, access Firebase or hosted Supabase, inspect or modify Production/TEST data, migrate, deploy, or resolve SEC-001/Open gates.

## 23. References

- [Current verified baseline](../ai-context/01_CURRENT_BASELINE.md)
- [Security and Production guardrails](../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md)
- [Testing and definition of done](../ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md)
- [Authoritative PostgreSQL schema design](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [Schema decision register](10_SCHEMA_DECISION_REGISTER.md)
- [Supplier Ownership and Claim contract](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [ID-001 identity authority contract](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [Platform role assignments contract](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [AUD-001 audit evidence contract](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md)
- [SEARCH-001 PostgreSQL search contract](37_SEARCH_001_POSTGRESQL_SEARCH_TECHNOLOGY_CONTRACT_REVIEW.md)
- [MSG-003 notification contract](39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md)
