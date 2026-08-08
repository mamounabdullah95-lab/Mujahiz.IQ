# AUD-001 audit evidence and trusted mutation contract

Status: **Decision-ready recommendation awaiting Product/Security/Data Owner approval; AUD-001 remains Open; proposes one empty, fully revoked, local-only `internal.audit_logs` table as the next SQL slice; no SQL or runtime implementation authorized**

Date: 2026-08-08

## 1. Scope and verified starting point

This document defines the minimum durable audit-evidence boundary required before trusted relational mutations such as `supplier_ownership.decide_claim`, platform-role administration, and privileged migration or correction operations can exist. It does not implement an audit table, trusted command, Claim runtime, role bootstrap, idempotency, domain events, notifications, RLS, grants, or retention jobs.

The verified starting point is refreshed `origin/main` commit `7ca5145eaba2859e5d6b1bb30e4b595ac688dfbd`, the merge of PR #88. Repository and merged-PR evidence proves:

- 12 tracked local migrations create 18 physical tables representing 16 implemented Core Phase 1 concepts; 20 of 36 concepts remain deferred;
- merged PR #85 implemented `public.supplier_ownerships`, and merged PR #87 implemented `public.platform_role_assignments`, as empty, fully revoked, local-only structural foundations;
- SUP-001 and ID-001 are Resolved, while REL-001 is decision-complete under Option D with no reliability SQL selected;
- the 11 Open approval gates are `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`;
- Firebase remains authoritative in Production; Supabase remains local-only and non-authoritative; and
- no Firebase, hosted Supabase, Production/TEST, data, migration, seed, backfill, or deployment access is authorized here.

## 2. Decision summary

The minimum safe recommendation is:

1. Audit evidence records accountable security- or business-significant attempts and outcomes. It is not domain-event delivery, application activity history, operational logging, or analytics.
2. Durable audit is required for privileged role and ownership mutations, Claim decisions, trusted migration/reconciliation actions, security-sensitive corrections, and privileged audit-retention maintenance. Ordinary reads and low-value activity are excluded by default.
3. Human actors use provider-neutral `public.user_profiles.id`. Firebase UID, email, display name, role text, and provider subject are never domain foreign keys or durable actor identity.
4. Trusted service, migration/operator, and automated-worker provenance is explicit. A service acting for a human records both identities; a bootstrap or system action never fabricates a human actor.
5. Audit rows are append-only and immutable. Corrections are new linked records; ordinary operation cannot update or delete history.
6. Audit rows contain typed identifiers, bounded codes, versions, and minimized change evidence. They do not copy Claim evidence, contacts, authentication payloads, documents, secrets, or unrestricted before/after snapshots.
7. Retention is class-based. Exact periods, legal holds, privacy handling, archive/purge execution, and backup behavior require Owner/legal/security/privacy approval before real rows or runtime.
8. Every successful authoritative mutation that requires audit commits its audit row in the same database transaction. Failure to persist required audit evidence rolls back and fails closed.
9. A rejected or conflicted trusted attempt creates no authoritative domain mutation or event. After actor resolution, it requires a separate minimized durable audit outcome; failure to record it cannot turn denial into success.
10. `internal.audit_logs` is structurally independent from `internal.idempotency_keys` and `internal.domain_events`. Correlation does not make audit an outbox or replay store and does not require a foreign-key dependency.
11. The empty structural table is non-exposed and fully revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`, with no rows, RLS, policies, grants, routines, triggers, browser/API path, Auth bridge, or runtime authority.
12. AUD-001 may be resolved contractually only after explicit Owner approval of this complete boundary. This Draft recommendation does not close the gate.

## 3. Purpose and responsibility boundary

| Concern | Canonical purpose | Must not become |
|---|---|---|
| `internal.audit_logs` | Durable evidence of who or what attempted an accountable action, against which target, when, with what bounded reason and outcome | An outbox, queue, retry store, domain history replacement, request dump, analytics stream, or general application activity feed |
| `internal.domain_events` | Immutable committed integration facts and later transactional outbox processing under REL-001 | A complete security investigation record, actor-decision history, or notification row |
| `internal.idempotency_keys` | Bind one logical command request to one safe replay result under REL-001 | An audit attempt log, rate limiter, or business-history table |
| Domain history | Authoritative aggregate state and temporal history, such as Claim and ownership rows | A substitute for actor, authorization, reason, and failure evidence |
| Application activity/history | User-facing or support-facing product history where separately designed | Security evidence or authority to mutate |
| Operational logs/metrics/traces | Runtime diagnosis, availability, latency, errors, and alerting | Durable business/security evidence or a place for sensitive domain payloads |
| Analytics | Aggregated product and business measurement | A source of mutation authority or identifiable audit history by default |

Audit evidence may correlate with a domain row, idempotency record, event, trace, or migration batch, but each concern preserves its own lifecycle and access policy. An audit row never drives event delivery or notification materialization.

## 4. Actions that require durable audit evidence

The future code-owned, versioned action registry must include at least:

| Class | Required accountable actions | Exclusions and boundary |
|---|---|---|
| Platform privilege | Owner/Admin assignment, revocation, expiry/supersession when authority changes, rejected final-Owner changes, and initial Owner bootstrap | Reads of the role list and ordinary eligibility checks are not durable audit by default |
| Claim and ownership | Claim approval/rejection, reviewer-conflict denial, other post-auth decision conflicts/failures, later ownership transfer/revocation, and security-sensitive correction | Page views, Claim list reads, and notification delivery are separate concerns |
| Migration/reconciliation | Approved batch start/finalize/abort, disposition override, merge/quarantine release, mapping supersession, rollback, and privileged reconciliation/correction | Row-by-row low-value progress belongs in migration evidence/operational logs unless an action changes an authoritative disposition or protected target |
| Identity/access/security correction | Provider-link correction, protected access/eligibility correction, authority-manifest change, security hold release, and other mutations that can grant, remove, or repair privilege | Routine mirror refresh with no authoritative change may use operational telemetry only |
| Audit governance | Legal-hold placement/release, approved archive/purge/compaction, correction/supersession, verification-manifest production, and exceptional maintenance | No ordinary hard delete or in-place rewrite |

Adding an action requires an owner, stable action code, contract version, allowed actors and targets, outcomes/reasons, minimized evidence schema, retention class, access class, and transaction rule. Audit scope must not expand to every read, click, background poll, search, or low-value activity without a documented threat, compliance, or investigation need.

Malformed or unauthenticated traffic rejected before a provider-neutral actor or trusted source is established belongs to rate-limited security telemetry by default, not durable business audit. A later security policy may promote specific attack classes without copying credentials, tokens, network payloads, or request bodies.

## 5. Actor model

| Actor kind | Required evidence | Prohibited inference |
|---|---|---|
| `human_user` | Stable `actor_user_profile_id`; current trusted authentication/link/eligibility result; optional bounded role/assignment policy snapshot | Firebase UID, email, display name, JWT role text, account context, Supplier ownership, or organization membership as the domain actor key |
| `trusted_service` | Stable code-owned service identity and version; optional initiating human actor and delegation/authorization result | Hostname, process ID, bearer token, session ID, or deployment instance as durable identity |
| `migration_operator` | Provider-neutral human actor when present, trusted migration/reconciliation service identity, approved batch/manifest reference, and operator authority class | Raw source credentials, workstation identity, or free-text operator name |
| `automated_worker` | Stable worker/command type, owning service, version, source job/event/batch reference, and initiating actor or system cause where applicable | Treating a random worker instance as the accountable principal |
| `system` | Narrow code-owned system action and external authority/manifest reference when no human database actor can exist, such as initial bootstrap | Fabricated user-profile identity or an unbounded `system` escape hatch |

Actor kind and actor evidence must be coherent. A service acting for a human records both rather than replacing the human with the service. A migration operated by a human records the human, migration service, and batch/manifest. Actor role is a bounded authorization snapshot, not durable identity and not proof that authorization was valid by itself.

## 6. Minimum future record shape

The future `internal.audit_logs` contract requires these logical fields. Exact SQL names, types, constraints, and JSON schemas remain a separate implementation task.

| Field group | Minimum evidence |
|---|---|
| Identity | Database-generated opaque audit record UUID; optional unique legacy source identity for reconciled Firebase audit evidence |
| Action | Stable lower-snake/dotted `action_code`; positive action-contract version; bounded action class |
| Actor | Actor kind; nullable provider-neutral actor user-profile ID; stable service/worker/system code where applicable; bounded authorization/role snapshot and policy version |
| Target | Stable target entity/aggregate type and opaque UUID where available; bounded legacy/external target reference only when no relational target exists; optional allowlisted related target references |
| Time | Authoritative action occurrence time and database record time; source time only as separately labeled evidence |
| Outcome | Bounded `succeeded`, `rejected`, `conflicted`, `failed`, or `corrected` class plus stable reason/result code; no localized message or raw exception |
| Context | Bounded reason code and optional minimized, versioned safe context; no unrestricted free text or request body |
| Correlation/causation | Opaque correlation UUID; optional causation type/UUID; optional idempotency, event, migration-batch, or predecessor audit reference when applicable |
| Source/environment | Stable environment identity, source system, producing component/command, and source-operation class |
| Change evidence | Allowlisted prior/result state codes and record versions; typed changed-field codes; canonical evidence digest and digest/version metadata only where it proves integrity; optional restricted evidence reference |
| Provenance/version | Audit schema version, action evidence-schema version, authorization policy version, producer code/contract version, and evidence/minimization policy version |
| Correction/retention | Nullable predecessor/superseded audit-record reference, correction reason code, retention class, and legal-hold classification without inventing a hold decision |

Identifiers used only for correlation need not all be foreign keys. Avoiding forward foreign keys to deferred domain, reliability, file, or migration tables keeps the structural foundation dependency-safe and prevents one missing optional relation from destroying audit evidence. Each action contract defines which identifiers are mandatory and how integrity is reconciled.

## 7. Change evidence and sensitive-data boundary

Audit evidence proves the decision without duplicating the protected record:

- prefer target UUID, state/version transition, bounded reason/outcome, policy/evidence version, and a canonical digest over full before/after snapshots;
- include an allowlisted safe change summary only when versions and domain history cannot explain the accountable change;
- keep private evidence in its authoritative restricted store and record only a typed reference, classification, verification outcome, and versioned digest where justified;
- never rely on a digest of a low-entropy value as anonymization; omit or use a keyed/versioned digest when correlation is necessary and approved; and
- do not place sensitive values in correlation IDs, reason codes, source references, or free text.

The base audit row must not contain:

- Claim evidence content, reviewer notes, submitted narrative, or competing claimant identity beyond the action's minimum typed targets;
- Supplier contact values, person names, email, phone, or private profile content;
- Firebase UID/provider subject unless a separately approved restricted migration-evidence field is necessary; never use it as a domain FK;
- authentication tokens, credentials, session/cookie values, password/email-action data, or raw provider responses;
- document bodies, object bytes, raw URLs, signed URLs, workbook rows, or permanent storage paths;
- full request/response bodies, unrestricted before/after JSON, SQL/stack traces, or operational log payloads; or
- secrets used to create evidence digests.

Claim/file evidence remains governed by document 32 and FILE-001. The audit row may hold a restricted evidence descriptor/reference and verification result; it does not grant document custody or read access.

## 8. Immutability, correction, and maintenance

1. Inserts occur only through separately approved trusted command or migration boundaries.
2. All evidence fields are immutable after commit. Ordinary application, support, Owner/Admin, service/API, and browser paths receive no update or delete authority.
3. A factual or classification correction appends a new `corrected` record linked to the prior audit UUID. It states the bounded correction reason, correcting actor/source, and corrected evidence. The earlier row remains visible to authorized investigators and is never silently rewritten.
4. Supersession changes interpretation, not history. Projections may show the latest effective interpretation while retaining the complete linked chain.
5. Retention expiry does not authorize deletion by itself. Approved purge, compaction, pseudonymization, archive, partition maintenance, or cryptographic-erasure operations require a legal-hold check, bounded manifest, dual-controlled trusted maintenance path where appropriate, and their own audit evidence.
6. No routine cascade may delete audit evidence because a user, Supplier, Claim, role assignment, ownership, migration batch, event, or file is deleted or archived.
7. Exceptional database repair remains break-glass work outside ordinary runtime, with prior approval where possible, tamper-evident evidence, reconciliation, and an appended maintenance/correction record. It is not a standing application privilege.

The later technical design must select and prove append-only enforcement, backup/restore behavior, partition boundaries if any, and tamper-evidence/verification manifests. This contract does not claim that table revocation alone proves immutability.

## 9. Retention classes and unresolved periods

Retention is conceptual and class-based:

| Class | Examples | Minimum policy boundary |
|---|---|---|
| Privilege/security authority | Role assignment/revocation/bootstrap, identity/access/security correction | Preserve accountable authority history through its investigation, cutover, rollback, and legal obligations |
| Claim/ownership decision | Approval/rejection, transfer/revocation, conflicted trusted attempts | Preserve decision and ownership provenance without retaining copied Claim evidence |
| Migration/reconciliation | Batch authority changes, disposition override, rollback, protected correction | Preserve traceability through reconciliation, cutover, rollback, and approved source-evidence lifecycle |
| Audit governance/maintenance | Hold, release, purge/archive, correction, verification manifest | Preserve proof of the maintenance decision independently of removed payload fields where legally permitted |

This contract deliberately chooses no calendar duration. Before any real audit row or hosted runtime, Product/Security/Data/Privacy/Legal/Operations owners must approve exact periods per class, legal-hold placement/release authority, privacy-erasure and pseudonymization behavior, archive tier and access, backup expiry, compaction fields, purge manifests, and jurisdiction/environment differences. A legal hold overrides ordinary expiry. Production purge or reclassification remains a separate approved operation with dry-run and reconciliation evidence.

## 10. `supplier_ownership.decide_claim` audit dependency

### 10.1 Successful approval

The authoritative approval transaction must insert exactly one primary audit outcome for the decision and commit it with Claim terminalization, ownership creation, competing-Claim supersession, idempotency completion, and deterministic domain events. It captures:

- action `supplier_ownership.decide_claim` and contract/evidence versions;
- human actor user-profile ID plus trusted service and bounded role/assignment/authorization-policy snapshot;
- Claim and Supplier IDs, resulting ownership ID, prior and committed Claim versions/statuses, and superseded count without competing claimant identities;
- `succeeded` with bounded `approved` reason/result code;
- evidence-verification method/version/outcome and restricted descriptor/digest reference, never evidence content;
- correlation, causation, idempotency/source-operation, primary event, source/environment, and producer provenance; and
- the approved retention class.

If the audit insert or its required evidence validation fails, the entire authoritative mutation, idempotency completion, and event creation roll back. No approval or ownership may commit without its audit evidence.

### 10.2 Successful rejection

The rejection transaction similarly inserts one primary audit outcome atomically with Claim terminalization, idempotency completion, and the rejection event. It records the Claim/Supplier, actor/source, prior and committed versions/statuses, bounded decision reason, evidence-verification outcome where applicable, and correlation/provenance. It creates or changes no ownership row and copies no reviewer notes or Claim evidence.

### 10.3 Failed, conflicted, and reviewer-conflict attempts

After trusted ingress resolves an accountable actor/source, a failed or conflicted decision attempt requires one minimized durable audit outcome with the stable failure class from document 32, known target IDs/versions, actor/source, correlation, policy version, and safe reason code. In particular, `reviewer_conflict` records that the actor/target conflict predicate denied the attempt without exposing the claimant relationship, competing Claims, evidence, or current owner.

Because no authoritative Claim/ownership mutation or domain event commits, this denial evidence may be written in a separate short transaction after the failed command transaction. Failure to persist it returns a minimized `audit_unavailable`/integrity failure and emits restricted operational alerting; it never permits the mutation or fabricates success. Pre-auth malformed traffic remains outside this durable domain-audit requirement under section 4.

### 10.4 Idempotent replay

An identical completed replay returns the original safe result and references the original primary audit outcome internally; it does not create a second successful decision audit row. The idempotency record binds the committed audit UUID or equivalent verified result evidence once REL-001 is implemented. A same-key binding conflict or other post-auth replay abuse is a new rejected/conflicted attempt and receives its own minimized audit outcome without storing the raw key, request body, fingerprint input, or prior actor/result.

## 11. Platform-role and bootstrap audit dependency

Future platform-role assignment, revocation, expiry/supersession, correction, and bootstrap commands require atomic audit evidence with every authoritative role mutation. The evidence includes the subject user-profile ID, role code, assignment/version/interval and prior/successor state, human and service actors, bounded authority/policy result, reason/source class, correlation, and restricted external evidence/manifest reference.

Ordinary role administration records the usable Owner actor and trusted command. Initial bootstrap has no fabricated relational grantor: it records a narrow `system`/trusted bootstrap source, environment-bound bootstrap manifest identity/version/digest, external approving authorities as restricted references, reconciliation result, and resulting Owner assignment IDs. The role rows, role-backed access/bootstrap state, authority manifest, and required audit outcomes must commit under the separately approved protected bootstrap transaction boundary.

A final-usable-Owner denial, actor/identity mismatch, ambiguous reconciliation, unauthorized assignment, or bootstrap manifest conflict creates no role/authority mutation and requires a minimized rejected/conflicted audit outcome after accountable source resolution. Audit unavailability cannot bypass the final-Owner guard or bootstrap controls.

## 12. REL-001 and transaction boundary

`internal.audit_logs`, `internal.idempotency_keys`, and `internal.domain_events` are independent logical responsibilities:

- audit answers who/what attempted which accountable action, why, against what target, and with what outcome;
- idempotency answers whether one logical request may execute or replay and what safe terminal result is bound to it; and
- a domain event records one committed integration fact for named consumers.

The audit foundation needs no idempotency or domain-event row, trigger, worker, consumer, payload registry, delivery lifecycle, or forward foreign key. Correlation/causation UUIDs and source-operation references may remain nullable typed values until the related table exists. Later command-specific DDL may add restrictive references only if it preserves evidence during retention divergence and failure recovery.

For an authoritative mutation requiring all three concerns, domain mutation, primary audit outcome, idempotency completion, and domain-event insertion commit in one database transaction. Event delivery happens later. For a denied attempt, there is no domain event and no domain mutation; the minimized failure audit follows section 10.3. Audit rows are never consumed to create notifications.

Therefore AUD-001 can select an empty structural audit foundation before the REL-001 Option D runtime tables without weakening Option D. REL-001 still selects no SQL until the approved Claim producer/consumer path and MSG-003/operations dependencies are ready.

## 13. Access, RLS, and projections

- The authoritative table is `internal.audit_logs` in a non-exposed schema.
- `PUBLIC`, `anon`, `authenticated`, `service_role`, browser clients, application clients, and ordinary Owner/Admin sessions receive no direct base-table insert, update, delete, or select privilege.
- Future writes occur only inside allowlisted trusted commands, migrations, and audit-maintenance paths that derive actor/source, target, time, outcome, and evidence server-side.
- No generic client-supplied `write_audit` RPC is allowed. A domain command owns its registered audit action.
- Base-table RLS is not designed or implemented here and must not be treated as column security or an alternative to schema/grant isolation.
- Any future read is a separately reviewed, purpose-limited, field-minimized projection or investigation/export command. Subject/self-service, support, Owner/Admin, security, privacy/legal, and migration-operator audiences require explicit policies and negative tests.
- Raw sensitive evidence remains in its authoritative restricted store. Audit access does not imply access to the referenced Claim, contact, identity, document, migration source, or security record.

## 14. Empty structural foundation and dependency matrix

One empty, fully revoked, local-only `internal.audit_logs` table is dependency-safe after Owner approval of this contract when it includes only structural columns/constraints/indexes/comments and focused synthetic pgTAP. It must include no rows, import, trigger, routine, view, RLS/policy, API grant, Auth bridge, trusted command, retention job, event/idempotency table, hosted access, or data movement.

| Gate/dependency | Empty revoked local audit table | Real audit rows / trusted mutation runtime |
|---|---|---|
| Product/Security/Data Owner approval of this contract | Required before exact SQL selection | Required |
| AUD-001 | Would become Resolved for the approved contract boundary | Approved contract plus remaining operational decisions must be implemented |
| ID-001 / SUP-001 | Resolved; provider-neutral actor/target roots exist | Approved identity/ownership/Claim behavior must be implemented for those actions |
| `public.platform_role_assignments` | Implemented but empty/inert; no dependency for audit DDL | Role/access/bootstrap/trusted commands required for privilege actions |
| REL-001 / MSG-003 | No dependency; do not add reliability SQL | Required only for commands with the approved asynchronous consequence; audit never delivers it |
| FILE-001 | No dependency; no file FK/content | Conditional for managed file evidence; bounded pre-FILE references remain under document 32 |
| Retention/legal/access/enforcement | Exact values do not block empty local DDL | Block real rows, hosted use, read projections, maintenance, and purge |
| MIG-002 / RES-001 | Do not block local-only empty DDL | Block migration/cutover and hosted/Production operation |
| ORG-001 / ORG-002 / RFQ-003 / MSG-002 / SEARCH-001 / BILL-001 | Do not block audit structure | Govern only their own future audited actions |

If separately approved, implemented, and merged, the projected local state becomes 19 physical tables, 17 implemented Core Phase 1 concepts, and 19 deferred. This documentation task leaves current `main` at 18 / 16 / 20.

## 15. Explicit answers

### A. Can AUD-001 be resolved contractually now?

**Yes, after explicit Product/Security/Data Owner approval of this complete contract.** The material purpose, scope, actors, record shape, immutability, minimization, retention-class boundary, Claim/role transaction behavior, REL separation, and trusted-access boundary are decision-ready. This Draft does not silently close AUD-001; it remains Open until that approval is recorded.

### B. Is one empty, fully revoked local-only audit foundation dependency-safe?

**Yes, conditionally.** It is safe only as the inert `internal.audit_logs` structure in sections 13 and 14, with no rows or runtime behavior and after Owner approval plus a separate exact SQL/pgTAP task.

### C. What exact schema-qualified table name does the authoritative design support?

`internal.audit_logs`.

### D. Can it become the next SQL slice independently of idempotency/domain events?

**Yes, after Owner approval.** The empty audit foundation has no runtime, consumer, delivery, or foreign-key dependency on REL-001. It does not reopen Option D or select `internal.idempotency_keys`/`internal.domain_events`.

### E. Which audit decisions remain required before real rows/runtime?

Exact action/reason/outcome registries and per-action evidence schemas; exact DDL and append-only enforcement; retention periods; legal-hold/privacy/pseudonymization/archive/purge/backup rules; digest/key-management rules where used; purpose-limited read/export policies; trusted writer identities and command interfaces; correction/maintenance/verification-manifest implementation; capacity/partition/monitoring design; negative security and transaction-failure tests; and environment/cutover/rollback approval. These are explicit implementation/operational gates, not permission to leave the material AUD-001 boundary ambiguous.

### F. Which Open gates continue to block `supplier_ownership.decide_claim` after AUD-001 is resolved?

Among the 10 gates that would remain Open after explicit AUD-001 approval:

- `MSG-003` directly blocks the approved event-to-notification materializer path paired with REL-001 Option D;
- `RES-001` blocks hosted-environment/runtime approval;
- `MIG-002` blocks migration/cutover/reconciliation of real Claim and ownership data; and
- `FILE-001` is conditional: it blocks a path that depends on managed file objects/uploads, but not document 32's bounded pre-FILE reference-only evidence boundary.

`ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `SEARCH-001`, and `BILL-001` do not block the approved unowned-Supplier Claim v1 boundary. Separate non-gate blockers remain: implementation of the approved ID-001 behavior; real Claim structures; role-backed access/bootstrap and trusted commands; reviewer/conflict enforcement; exact audit SQL/runtime; the coherent REL-001 reliability foundation and named consumer; RLS/security projections and tests; retention/registry approvals; and explicit hosted/Production authority.

## 16. Remaining Owner decision and recommendation

One bundled Product/Security/Data Owner decision remains:

> Approve this minimum audit-evidence contract; keep audit separate from events, idempotency, activity, logs, and analytics; require the scoped privileged actions and provider-neutral actor model; require append-only minimized evidence and class-based retention with later legal/operational periods; require same-transaction audit for successful authoritative mutations and minimized durable outcomes for accountable denials; confirm trusted-command-only writes and non-exposed reads; resolve AUD-001 for this contractual boundary; and select exactly one empty, fully revoked, local-only `internal.audit_logs` table as the proposed next SQL slice independently of REL-001.

Approval would resolve AUD-001 contractually and select only the inert structural candidate. It would not approve SQL/pgTAP, real audit rows, retention periods, legal-hold/purge operations, trusted commands, Claim decisions, role bootstrap, role/access rows, RLS/grants, events/idempotency, notifications, Firebase, hosted Supabase, Production/TEST data, migration, merge, or deployment.

## 17. Validation, risks, and exact stop point

Key risks are turning audit into an outbox or request dump; using Firebase/provider identity as a domain FK; logging unnecessary reads; copying Claim, contact, Auth, or file content; permitting mutable/deletable evidence; allowing client-authored audit; treating a digest as anonymization; committing a privileged mutation without audit; duplicating success evidence on replay; and letting retention expiry silently authorize deletion. This contract fails closed on each risk.

Required checks are documentation-only: refreshed `origin/main` and merged PR #88 evidence; 12 migrations, 18 physical tables, 16 implemented / 20 deferred concepts; exact 11 Open gates; authoritative `internal.audit_logs` naming; relative links and terminology; sensitive-content scan; documentation-only diff; and `git diff --check`.

Do not start Supabase, execute migrations, run pgTAP, access Firebase, inspect Production/TEST data, implement SQL, insert audit/role/Claim rows, run bootstrap, change Auth/RLS/grants, implement Claim/reliability/notification runtime, mark the PR Ready, merge, or deploy.

Exact stop point: one Draft PR containing the decision-ready AUD-001 documentation and current-baseline synchronization. Stop before Owner approval is recorded, AUD-001 is marked Resolved, exact SQL/pgTAP selection or implementation begins, or any real row/runtime/hosted/Production action occurs.

## 18. References

- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md)
- [`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md)
- [`34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md`](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
