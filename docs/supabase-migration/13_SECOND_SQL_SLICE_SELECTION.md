# Core Phase 1 second SQL slice selection

Status: **Approved repository-merged selection; implementation not started**
Selection date: 4 August 2026
Selection-planning starting `main`: `a77f20a57f308365d408b16a823e6502f940b595`
Merged PR: [#49](https://github.com/mamounabdullah95-lab/Mujahiz.IQ/pull/49)
Approved PR head: `6e22d8acd0e7c9e94cd7934a23af1a42d113cdcf`
Merge commit and current verified `main`: `77179728d9b2a942f210790cbb31f0a7842dcbda`
Primary task profile: Documentation

Successor note (2026-08-08): this document remains the historical authority for excluding `platform_role_assignments` from the second SQL slice. Proposed document 33 later removes a forward role-to-access-grant FK and finds a standalone empty, fully revoked role table dependency-safe as a future candidate that grants no authority. That proposal does not revise the historical two-table selection, close ID-001, select role SQL, or make real role rows/runtime safe before the access/bootstrap/command/audit/security dependencies.

## 1. Decision

The approved second local SQL slice is the reduced Identity Foundation:

- `public.user_profiles`
- `internal.identity_provider_links`

Do not include `platform_role_assignments` in that slice. Do not add RLS, policies, browser/API privileges, an Auth bridge, application integration, data, functions, triggers, or hosted Supabase work.

This is the smallest remaining Core Phase 1 subset that establishes stable provider-neutral user keys, preserves Firebase UID without making it a relational primary key, and unlocks later access, Supplier, RFQ, audit-actor, and Auth work. `ID-001` remains Open: table creation does not choose the future Auth authority, change Firebase authority, or authorize an identity integration.

## 2. Verified starting state

- `git fetch origin main` completed and clean local `main` fast-forwarded to `a77f20a57f308365d408b16a823e6502f940b595`; local `main`, `origin/main`, and task-start `HEAD` matched before branch creation.
- PR #48 is merged at that SHA. It synchronized the authoritative baseline after the PR #47 SQL Foundation merge.
- PR #49 merged this selection through merge commit `77179728d9b2a942f210790cbb31f0a7842dcbda`; its approved head was `6e22d8acd0e7c9e94cd7934a23af1a42d113cdcf`.
- The selection is repository-approved for a future local implementation PR. No implementation has started.
- The only repository SQL migration is `supabase/migrations/20260804000136_migration_control_foundation.sql`.
- The only repository pgTAP file is `supabase/tests/migration_control_foundation.sql`; its merged evidence records 60/60 local synthetic assertions.
- The first slice creates six physical governance tables in the non-exposed `internal` schema: `migration_batches`, `migration_source_dispositions`, `migration_record_mappings`, `migration_merge_group_members`, `migration_validation_results`, and `import_errors`.
- No business/application PostgreSQL table, second SQL slice, RLS, policy, browser/API grant, Auth bridge, Supabase Auth user, Storage bucket, Edge Function, frontend Supabase integration, Migration Engine runtime, hosted linkage, remote SQL application, or data migration exists.
- Firebase Production remains live and authoritative. No Firebase or Production access was needed for this selection.
- DB-001 is resolved only for the local first slice to database-generated UUIDv4 through `pg_catalog.gen_random_uuid()`. MIG-001 is partially implemented at the declarative migration-contract level. MIG-002 and the other 13 gates listed below remain Open.

The task brief used earlier names for documents 02 through 04. Current `main` uses `02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`, `03_AUTH_AND_IDENTITY_OPTIONS.md`, and `04_STORAGE_MIGRATION_PLAN.md`; those current equivalents were reviewed.

## 3. Candidate comparison

Risk-oriented cells use Low as safer/smaller. Benefit-oriented cells (`Migration use`, `Unlocks`) use High as better.

| Criterion | A: all three Identity tables | B: access/trial ledgers | C: full Supplier directory | D: audit/events/idempotency | Approved A1: profile + provider link |
|---|---|---|---|---|---|
| Dependency risk | Medium | High | High | Medium | Low |
| Blocking Open gates | 0 for DDL; dependency-blocked | 0 for DDL; prerequisite-blocked | 2: SUP-003 and SUP-004 | 1: AUD-001 | 0 for local DDL; ID-001 explicitly deferred |
| Firebase Auth coupling | High | High | Medium | Medium | Low: provider-neutral structure only |
| RLS/browser implications | High | High | High | Low | Low if all API privileges are absent |
| Migration use | High | High | High | Medium | High |
| Synthetic local validation | High | High after Identity | Medium | High | High |
| Production risk | Low without integration/data | Low without integration/data | Medium because of sensitive Supplier shape | Low without integration/data | Low |
| Future rework risk | Medium | High if created before users/roles | High while mappings are Open | Medium while event types/retention are Open | Low |
| Schema stability | High for profile/link; Medium for roles | Medium | Medium/Low | Medium | High |
| Implementation size | Medium | Medium | High | Medium | Low |
| Rollback simplicity | High while empty/local | Medium | Low | High while empty/local | High while empty/local |
| Unlocks | High | Medium | High strategically | Medium | High: access, Supplier actors, RFQ actors, audit actors, Auth proof |

### Candidate A — Identity Foundation

`user_profiles` and `identity_provider_links` form a stable two-table root. A profile can be bootstrapped as unverified, and a Firebase UID can be stored as the `firebase` provider subject without selecting Supabase Auth or changing Firebase authority.

`platform_role_assignments` is not dependency-safe in the same slice. The authoritative design binds usable Owner authority to profile status/context, an active verified/non-disabled provider link, an active Owner assignment, a non-expiring role-backed administration grant, and shared serialization/command safeguards. Creating the role table before `access_grants`, trusted commands, and complete Owner-safety tests would either weaken that contract or create knowingly unusable structure.

### Candidate B — Access and Trial Ledger Foundation

`access_credits`, `access_grants`, and `contribution_logs` require `user_profiles`. Current first-verification behavior also couples a Buyer trial credit and grant to Firebase-authoritative verification and an audit fact. `access_grants` additionally has a future role-assignment relationship for non-expiring Owner administration access, while contribution rows may refer to Supplier submissions/profiles/reviews that do not yet exist.

The tables could be populated synthetically later, but they are not a safe second slice before their user FK target. Weakening those FKs or storing Firebase UID directly would create avoidable rework.

### Candidate C — Supplier Directory Foundation

The proposed nine-table set is too large for one second slice. It combines base Supplier identity, private contacts, physical locations, service coverage, taxonomy, capabilities, payment terms, submissions/imports, and protected duplicate prevention.

`categories` and `administrative_areas` must precede category assignments and mapped locations, but SUP-003 and SUP-004 block their authoritative mappings. Contact audiences require later projection/RLS work. Duplicate fingerprints belong in `internal` and require protected digest/version semantics. Ownership must be excluded until Identity exists. Physical locations and service coverage can share the `supplier_locations` relation only after SUP-004 defines the mapping contract.

The smallest plausible later Supplier sub-slice is `supplier_profiles` alone, with nullable organization and no ownership, contacts, taxonomy, eligibility, or data. It is not selected now because its actor FKs depend on `user_profiles`, and creating it first would invert the dependency graph.

### Candidate D — Internal Audit and Domain-Event Foundation

Nullable, provider-neutral actor references are structurally possible, but the three concepts are not one dependency-free aggregate:

- `audit_logs` is blocked by AUD-001 before audit migration because retention, legal access, and append-only enforcement are unresolved.
- `idempotency_keys` protects trusted application commands, not migration-control imports. Its scopes, result bindings, expiry, and actor references are premature before the commands and Identity root exist.
- `domain_events` is stable as a transactional-outbox concept but its aggregate references, event types, and payload versions depend on Supplier, RFQ, ownership, access, and identity commands. Creating it first would be speculative. Append-only triggers/functions are explicitly outside the contemplated table-only slice.

Actor references could remain nullable for system/migration events, and append-only owner enforcement could be deferred, but those concessions do not make the complete three-table candidate safer than the reduced Identity root.

## 4. Dependency order

| Order | Concept | Depends on | Why it is not earlier |
|---:|---|---|---|
| 1 | Existing migration control | None | Already merged in `internal`. |
| 2 | `user_profiles` | Existing UUID/migration conventions only | Provider-neutral root for actors and beneficiaries. |
| 2 | `identity_provider_links` | `user_profiles`; optional migration-batch provenance | Preserves Firebase subject and provider state separately from the profile. |
| 3 | Access/trial ledgers | `user_profiles`; later audit and optional role assignment | Beneficiary and verification-triggered benefit integrity. |
| 3 | `platform_role_assignments` | profile, provider state, access grant, Owner-safety command contract | Cannot represent usable Owner safety in isolation. |
| 4 | Supplier base | profile actors; later taxonomy/area roots | Actor integrity precedes Supplier workflow. |
| 5 | Supplier ownership/RFQ | Identity, Supplier, access, categories/areas as applicable | Authorization and eligibility span those roots. |
| Cross-cutting, when consumers exist | Audit, idempotency, domain events | Identity plus defined trusted commands/aggregates; AUD-001 for audit migration | Avoid speculative actor, target, event, and replay contracts. |

## 5. Open approval-gate matrix

Legend: **B** = must be resolved before implementing the candidate as described; **D** = explicitly deferred without weakening the candidate's table schema; **—** = not applicable to that candidate. A gate marked D remains Open and must be resolved before its registered later phase.

| Open gate | A: full Identity | B: access ledgers | C: Supplier set | D: audit/events | A1: approved two-table slice |
|---|---|---|---|---|---|
| ID-001 Authentication authority | D | D; required before verification integration | D for actor/ownership integration | D for authenticated actor integration | D; no Auth authority or integration selected |
| ORG-001 Organization model | D | — | D; Supplier organization remains nullable | — | D; free-text organization remains evidence only |
| ORG-002 Organization membership roles | D | — | D; no membership/ownership included | — | D; no organization relation included |
| SUP-003 Category hierarchy | — | — | B | D for Supplier event typing | — |
| SUP-004 Address/service coverage | — | — | B | D for Supplier event typing | — |
| RFQ-003 Legacy price/currency | — | — | — | D for RFQ event payloads | — |
| MSG-002 Message edit/delete | — | — | — | D; no messaging event contract yet | — |
| MSG-003 Notification retention/rendering | — | — | — | D; fan-out is not implemented | — |
| SEARCH-001 Search technology | — | — | D; no directory query/index implementation | — | — |
| FILE-001 Storage/custody | — | — | D; no Supplier documents/files | D; no file events | — |
| BILL-001 Billing subject | — | — | — | D; no billing events | — |
| AUD-001 Audit/security retention | D; blocks role-operation audit migration, not empty profile/link DDL | D; blocks audit-row migration/integration | D; blocks Supplier-operation audit migration | **B** for `audit_logs` | D; no audit table or audit data |
| RES-001 Data residency | D; local-only | D; local-only | D; local-only | D; local-only | D; no hosted environment |
| MIG-002 Environment strategy | D; local-only | D; local-only | D; local-only | D; local-only | D; no hosted project/promotion |

### Gate owners and missing evidence

| Gate | Required approver | Missing evidence before its registered phase |
|---|---|---|
| ID-001 | Owner/security | Approved Auth coexistence duration; Firebase-token/provider-state validation proof; verification-loss/disablement reconciliation; later Auth migration ADR. |
| ORG-001 | Product owner | Evidence-based organization identity/bootstrap model; no inference from free text. |
| ORG-002 | Product/security | Minimal membership vocabulary, bootstrap/invitation rules, and organization RLS model. |
| SUP-003 | Product/data owner | Governed category codes/hierarchy, bilingual labels, legacy mapping, aliases, and exception set. |
| SUP-004 | Product/data owner | Administrative-area codes; physical-location versus coverage mapping; bounded national/import coverage codes; exception set. |
| RFQ-003 | Finance/product owner | Legacy unit/line/total meaning, currency, numeric scale, tax/freight, and transformation rules. |
| MSG-002 | Product/legal/security | Message edit, tombstone/delete, retention, attachment, export, moderation, and quarantine policy. |
| MSG-003 | Product/security | Notification classes, retention, rendering/snapshot policy, protected notices, and fan-out behavior. |
| SEARCH-001 | Technical/data owner | Measured Arabic/English FTS recall, `pg_trgm` need, query plans, ranking, and index cost. |
| FILE-001 | Technical/security | Provider, region, typed custody, private access, validation/scanning, lifecycle, signing, retention, and orphan compensation. |
| BILL-001 | Product/finance owner | Organization-versus-user payer model, lifecycle, ownership, and finance/legal retention. |
| AUD-001 | Owner/legal/security | Audit/security classes, retention periods, legal access, minimization, partition/purge policy, and append-only enforcement. |
| RES-001 | Owner/legal/security | Approved data residency and cross-provider/legal constraints for the hosted target. |
| MIG-002 | Owner/technical/security | Local/dev/staging/Production separation, hosted identities, region, secrets, backups/restore, CI promotion, rollback, and observability. |

No gate is resolved by this document.

## 6. Approved future implementation boundary

### `public.user_profiles`

| Concern | Implementation-ready requirement |
|---|---|
| Prerequisites | Existing UUIDv4 convention and migration-control foundation; no application table prerequisite. |
| Outbound FKs | Nullable self-references for meaningful created/updated/suspension actors, with bootstrap/system cases allowed and `ON DELETE RESTRICT`. No organization, Supplier, role, access, audit, or Auth FK in this slice. |
| Inbound FKs | Only `internal.identity_provider_links` in this slice. Future access, role, Supplier ownership, RFQ, notification, audit, event, and command tables may reference the profile UUID. |
| Schema boundary | `public` preserves the authoritative application-table location, but the table ships with no `PUBLIC`, `anon`, `authenticated`, or service API privilege and no application/client integration. Local assertions must prove it is unusable through API roles. |
| Trusted-only fields | Account status/context, verification mirror, suspension/security state, legacy linkage, normalized support identifiers, audit actors, and all eligibility/counter projections. Browser writes do not exist. |
| Migration provenance | A migrated root keeps unique bounded `legacy_firestore_id` from `users/{uid}`. The existing internal disposition/mapping contract records source collection/document/version, transformation version, target logical type/UUID, and synthetic validation evidence. |
| Legacy identity | Firebase UID is not stored as the profile PK and is not a relationship key; it lives in `identity_provider_links.provider_subject`. |
| Uniqueness/checks | Database UUID PK; unique non-null legacy ID; bounded status/context/locale; normalized values bounded; timestamps coherent; no email-based account merge or relationship. |
| Deletion/history | Suspend/deactivate rather than normal delete; no cascade into history; future privacy deletion/pseudonymization remains separately approved. |
| RLS/integration | RLS is explicitly deferred because no API role has a table privilege and no client exists. If the implementation cannot prove zero API access under local Supabase defaults, it must stop rather than expose the table or silently start RLS. |
| Safe without integration | Yes. An empty local table has no Auth authority, session, verification, role, or access effect. |
| Candidate indexes | Unique legacy ID; `(account_status, account_context, created_at, id)` for trusted administration/keyset scans; optional normalized-email support index only if the bounded support query is retained and justified. |

### `internal.identity_provider_links`

| Concern | Implementation-ready requirement |
|---|---|
| Prerequisites | `public.user_profiles`; existing `internal.migration_batches` only if a nullable direct batch reference is retained. |
| Outbound FKs | Required `user_profile_id` to `public.user_profiles` with `ON DELETE RESTRICT`; optional migration batch provenance with `ON DELETE RESTRICT`; nullable actor self-references only where the approved schema requires them. |
| Inbound FKs | None in this slice. Future trusted Auth/RLS helpers may resolve a provider subject to a profile; browser roles never read the base table. |
| Schema boundary | `internal`, which is not in `supabase/config.toml` API schemas and has no `anon`/`authenticated` schema usage. |
| Trusted-only fields | Provider subject, primary status, link/identity/verification/disablement state, observed-at/version/evidence, link/unlink actors, and all lifecycle timestamps. |
| Migration provenance | Firebase link rows map through the existing disposition/mapping contract; safe evidence references are bounded. No token, claim payload, credential, or full Auth record is stored. |
| Firebase UID | Store bounded Firebase UID as `provider_code='firebase'` plus `provider_subject`; never coerce it to UUID, merge by email, or claim that its current Auth state was verified during this PR. |
| Uniqueness/checks | Database UUID PK; unique active `(provider_code, provider_subject)`; at most one active primary link per `(user_profile_id, provider_code)`; bounded provider/status values; coherent linked/verified/disabled/unlinked timestamps. |
| Deletion/history | Unlink/disable by status and timestamp; retain history through migration/rollback; `ON DELETE RESTRICT` protects its profile and migration evidence. |
| RLS/integration | RLS is not required now because the schema is non-exposed and API roles have no schema usage. Auth bridge, JWT lookup, functions, and policies are later work. |
| Safe without integration | Yes. It is inert provider-neutral identity metadata with synthetic rows only during local tests. |
| Candidate indexes | Active provider/subject unique lookup; `(user_profile_id, provider_code, link_status)`; `(user_profile_id, identity_status, verification_status)` for trusted eligibility reconciliation. |

## 7. Identity boundary decisions retained

- `user_profiles` can be implemented without selecting Supabase Auth. Its PK represents the application person/profile, not a provider account.
- Firebase UID is represented only as a `firebase` provider subject. `users/{uid}` is preserved separately as the profile's legacy Firestore ID; equality is expected for the current source but the two meanings are not collapsed.
- Unverified registration bootstrap is structurally safe: create/reconcile an unverified profile/link, create no platform role, access credit, access grant, verified-only benefit, or Supplier ownership, and grant no browser/API access.
- Firebase remains the verification, disablement, password, session, recovery, and email-action authority throughout the hybrid phase. A PostgreSQL mirror is trusted only after a later approved provider validation/reconciliation path.
- `platform_role_assignments` is deferred. Owner/Admin role history requires `access_grants`, the complete usable-Owner predicate, trusted commands, audit/security outcomes, and concurrency tests.
- Final-usable-Owner safety can be specified declaratively in documentation but cannot be completely enforced by these two tables without runtime commands/locking. This slice therefore creates no Owner assignment and makes no Owner-safety implementation claim.
- ID-001 blocks later identity integration/migration, not these provider-neutral, unpopulated local table contracts.
- Browser and API access remain completely absent: no frontend client, Auth bridge, RPC, view, policy, privilege, application query, or data is added.

## 8. Required local pgTAP coverage for the future SQL PR

The future implementation PR should use synthetic values only and cover:

1. schemas, tables, exact columns/types/nullability, qualified UUIDv4 defaults, and comments;
2. absence of `PUBLIC`, `anon`, `authenticated`, and service API table privileges; absence of `anon`/`authenticated` use on `internal`;
3. profile status/context/locale bounds, timestamp coherence, text lengths, normalized-value bounds, and unique non-null legacy ID;
4. provider/status bounds, subject length, lifecycle timestamp coherence, and forbidden contradictory verification/disablement states;
5. required profile FK, optional batch provenance FK, `ON DELETE RESTRICT`, and allowed bootstrap self-reference behavior;
6. unique active provider/subject and one active primary provider link per user/provider, while inactive historical rows remain possible;
7. synthetic unverified Firebase bootstrap and idempotent lookup shape without creating roles, credits, grants, audits, events, or benefits;
8. a synthetic provider subject that is text rather than UUID and no email-only linking constraint;
9. migration disposition/mapping compatibility for one synthetic profile and link without Production identifiers or records;
10. expected indexes and representative trusted lookup plans where stable plan assertions are practical;
11. no RLS, policy, view, RPC, function, trigger, seed, Auth user, application grant, or business data outside these two tables;
12. clean local reset, database lint, scoped sensitive-value scan, and final stopped local stack.

## 9. Explicit exclusions

The following 30 remaining Core Phase 1 concepts are excluded from the second slice:

- `platform_role_assignments`
- `access_credits`
- `access_grants`
- `contribution_logs`
- `supplier_profiles`
- `supplier_locations`
- `supplier_contacts`
- `supplier_category_assignments`
- `supplier_capabilities`
- `supplier_payment_options`
- `supplier_ownerships`
- `supplier_submissions`
- `supplier_import_batches`
- `supplier_duplicate_fingerprints`
- `rfqs`
- `rfq_items`
- `rfq_attachments`
- `rfq_recipients`
- `rfq_publish_events`
- `quotations`
- `quotation_revisions`
- `quotation_revision_items`
- `quotation_revision_attachments`
- `quotation_events`
- `notifications`
- `categories`
- `administrative_areas`
- `audit_logs`
- `idempotency_keys`
- `domain_events`

All Core Later, Future-Compatible, Deferred, and Remove/Merge concepts remain excluded. In particular: no organization, membership, invitation, Supplier ownership Claim, file object, message, billing, Security event, or removed concept is created.

## 10. Risks and controls

| Risk | Control / stop condition |
|---|---|
| `public.user_profiles` inherits an API-role privilege | Inspect effective local privileges. Stop if zero browser/API access cannot be proved without expanding the approved implementation scope. |
| The slice is mistaken for an Auth bridge | State in migration comments/tests/docs that no token verification, JWT mapping, Auth user, policy, client, or runtime integration exists. |
| Verification mirror is treated as authoritative | Require provider-state fields to remain trusted-only and inert; Firebase remains authoritative until ID-001 approval and a separate integration PR. |
| Owner/Admin state leaks back onto the profile | Exclude role assignments and role-backed grants; preserve legacy role only as restricted migration evidence when data migration is later approved. |
| Legacy UID is used as the relational PK | Require database UUID PK and provider-subject uniqueness; retain the Firestore document ID as a separate alternate key. |
| Email becomes an identity merge key | Prohibit email-based linkage/merge and test provider-subject uniqueness. |
| Future actor FKs force rewrites | Establish the profile UUID now; keep system/bootstrap actor references nullable and use `ON DELETE RESTRICT`. |
| Documentation overstates implementation | Update current state only after merge; keep all 14 Open gates Open and distinguish local SQL from hosted/Production state. |

Expected implementation difficulty is **Low to Medium**: two tables, cross-schema FKs, partial uniqueness, lifecycle checks, privilege verification, and focused pgTAP coverage. The security consequence of an accidental exposed-table privilege makes review important even though runtime scope is small.

Expected deployment scope is **none**. The future PR is local SQL only; remote promotion requires separate MIG-002/RES-001 evidence and approval.

## 11. Future implementation PR

Recommended future branch: `db/identity-foundation-local-202608xx`
Recommended PR title: `db: add local identity profile foundation`

The future PR should contain only one new migration, one focused pgTAP file, and the minimum documentation synchronization. It should update:

- `09_POSTGRESQL_SCHEMA_DESIGN.md` only for implemented-status wording;
- `10_SCHEMA_DECISION_REGISTER.md` only for actual implementation evidence, without resolving ID-001 or another Open gate;
- `11_SCHEMA_REVIEW_CHECKLIST.md` with a separate second-slice evidence section;
- the authoritative current baseline after the implementation is merged, not while its implementation PR is unmerged; and
- a new implementation evidence note rather than rewriting `12_POSTGRESQL_SQL_FOUNDATION.md`, which remains the first-slice record.

Stop that future PR if:

- `main` or the approved schema design changed materially;
- API-role access cannot be proved absent;
- implementation would require RLS, an Auth bridge, a function/trigger, browser grants, application changes, or real data;
- an Open gate would need to be silently resolved;
- a hosted project, Firebase, or Production access becomes necessary; or
- the change expands beyond the two named tables and their focused tests/docs.

## 12. Recommended third slice

After the two-table Identity root is merged, reassess `access_credits`, `access_grants`, and `contribution_logs` as the third slice. They gain stable beneficiary FKs and preserve the current trial/contribution histories. Before implementation, prove the finite-grant model, contribution source references, correction/supersession behavior, and how the future role-backed administration grant relates to the still-deferred `platform_role_assignments`; keep verification-triggered runtime work and audit-row migration outside unless their gates are approved.

If that contract cannot be completed without weakening FKs or Owner safety, stop and select a smaller internal reliability slice only after AUD-001 and the first consuming trusted command are defined.

## 13. Stop point

This repository-merged selection approves only a future local implementation PR for `public.user_profiles` and `internal.identity_provider_links`. Implementation has not started. The selection itself performs and authorizes no current SQL, RLS, policy, grant, Auth bridge, Supabase runtime, hosted project access, Firebase access, data operation, or deployment; any future implementation remains subject to the boundaries and stop conditions above.
