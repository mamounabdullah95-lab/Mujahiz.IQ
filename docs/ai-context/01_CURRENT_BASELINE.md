# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-08-04-post-pr49-second-sql-slice-selection`
Updated: 2026-08-04
Canonical Production URL: `https://mujahiz.com`

This is the single authoritative, frequently changing project baseline. Keep GitHub `main`, merged-but-undeployed work, Firebase Hosting, active Firestore Rules and indexes, deployed Functions and Storage, bounded Production data, and hosted Supabase state distinct.

Evidence labels used below:

- **Verified current fact** — confirmed from the current repository, merged GitHub evidence, or the bounded read-only verification recorded on 3 August 2026.
- **Latest known historical fact** — previously verified evidence that was not independently re-proved as current.
- **User-reported context** — supplied by the user but not independently verified.
- **Unknown** — not safely or independently observed.
- **Plan/recommendation** — future direction, not implemented state.

## 1. Repository State

- **Verified current fact:** Repository: `mamounabdullah95-lab/Mujahiz.IQ`.
- **Verified current fact:** Approved branch: `main`.
- **Verified current fact:** Current GitHub `main`: `77179728d9b2a942f210790cbb31f0a7842dcbda`.
- **Verified current fact:** PR #41 was merged earlier. Its reviewed head was `1ed6a0f4691b414aaf331f6b56626979b1f9809b`.
- **Verified current fact:** PR #41 added eight documentation files under `docs/supabase-migration/`; it made no runtime, deployment, configuration, Auth, DNS, billing, or data change.
- **Verified current fact:** PR #43 is merged through the current `main` merge commit. Its reviewed head was `443f48abe5607ecbf731b25542293f028e6afa99`.
- **Verified current fact:** PR #43 added local Supabase infrastructure scaffolding only. It did not deploy, link or access a hosted Supabase project, or change Firebase or other Production state.
- **Verified current fact:** PR #45 is merged through the current `main` merge commit. Its reviewed head was `9db67cf781ebf79523219a34e11149969542248a`.
- **Verified current fact:** PR #45 added PostgreSQL schema-design documentation only. It made no runtime, deployment, hosted Supabase, Firebase, Auth, DNS, billing, or data-state change.
- **Verified current fact:** PR #46 is merged as commit `206f7daa524228abfa83793c39a03045491f1316`.
- **Verified current fact:** PR #46 synchronized the post-PR-45 baseline and deterministic zero-to-many cutover/mapping principles; it added no runtime SQL, deployment, hosted Supabase, Firebase, Auth, DNS, billing, or data-state change.
- **Verified current fact:** PR #47 SQL Foundation is integrated into `main` by merge commit `0760ee6f498c58ceb966ef766b1928c7549bc702`. Its parents are previous `main` `206f7daa524228abfa83793c39a03045491f1316` and approved PR head `217f3b49b697c03fae78396d0730d39d30486f94`; the approved head is fully contained in `main` with no file differences.
- **Verified current fact:** Git history proves PR #47's integration, but GitHub PR metadata incorrectly still reports PR #47 as Open/Not merged. This metadata anomaly must not trigger a merge retry, replacement PR, history rewrite, or ordinary unmerged-PR closure.
- **Verified current fact:** PR #48 is merged as commit `a77f20a57f308365d408b16a823e6502f940b595`; it synchronized the authoritative baseline after PR #47 and added no SQL, runtime, hosted Supabase, Firebase, Auth, data, or deployment change.
- **Verified current fact:** PR #49 is merged as commit `77179728d9b2a942f210790cbb31f0a7842dcbda`. Its approved head was `6e22d8acd0e7c9e94cd7934a23af1a42d113cdcf`.
- **Verified current fact:** PR #49 approved `public.user_profiles` and `internal.identity_provider_links` as the second SQL slice for a future local implementation PR. It was documentation-only; implementation has not started.
- **Verified current fact:** No second identity SQL migration, RLS, Auth bridge, hosted Supabase linkage, data migration, or deployment work is merged after PR #49.
- Local branches and future PRs must start from this current `main` unless a newer commit appears.

The repository SHA identifies source-control state. It must not be described as the active Firebase application version unless a separate Hosting deployment verifies that mapping.

## 2. Firebase Live State

Firebase live is behind GitHub `main`. Do not imply that the current repository code, Rules, indexes, or callable Functions are deployed.

- **Verified current fact:** Firebase project: `mujahiziq`.
- **Verified current fact:** Current Hosting release: `1785332157811000`.
- **Verified current fact:** Current Hosting version: `42b95b8aad86e7a0`.
- **Verified current fact:** Hosting deployment time: `2026-07-29T13:35:57.811Z`.
- **Latest known historical fact:** Repository evidence maps that unchanged Hosting release/version to commit `d66a04c18ab7260e5444e67d0ca62795ccc39fce`. The Hosting API does not expose a commit SHA, so this is a historical source mapping, not a new live assertion and not the current GitHub `main`.
- **Verified current fact:** Active Firestore Ruleset: `e6948804-1333-433a-ac69-f0f963d07355`. Its normalized content matches the older deployed commit, not current `main`.
- **Verified current fact:** Firebase has 15 deployed composite indexes, all `READY`.
- **Verified current fact:** The repository defines 18 composite indexes; the three Claim-related indexes are not deployed.
- **Verified current fact:** Zero Firebase Functions are deployed.
- **Verified current fact:** Current `main` defines nine callable Functions for `europe-west1`; repository presence does not mean deployment.
- **Verified current fact:** Zero Firebase Storage buckets are deployed.
- **Verified current fact:** Claim Supplier Profile exists on GitHub `main` but is not deployed, active, enabled, or populated on Firebase Production. No Claim UI is present in the historically mapped Hosting version, no Claim indexes or Functions are deployed, and the bounded Claim/ownership-foundation counts are zero.

### Firebase Authentication and email actions

- **Verified current fact:** During the current live Firebase phase, Firebase Auth remains authoritative for email verification and account disablement. No PostgreSQL or Supabase Auth state supersedes that authority.
- **Latest known historical fact:** Firebase Auth remains the password, session, password-reset, recovery, and email-action authority for the deployed application.
- **Latest known historical fact:** The deployed application includes the unified public `/auth/action` route for `resetPassword`, `verifyEmail`, and `recoverEmail`, with strict continuation-URL handling and sensitive-parameter cleanup.
- **Latest known historical fact:** Controlled Production password-recovery UAT passed for Buyer and Supplier paths, including Arabic/English and RTL/LTR behavior.
- **Latest known historical fact:** Firebase rejected the custom email action URL change with `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`; the original Firebase handler remains active. This is an external Firebase backend/Console blocker, not an application-code blocker.

Do not change Auth, sender settings, templates, Authorized Domains, DNS, Hosting, or billing to work around that blocker without a separate reviewed task and explicit approval.

## 3. Current Data Snapshot

The following are **verified current facts** from bounded, count-only Firestore checks recorded on **3 August 2026**. The counts may change. Fresh bounded verification is required before any migration, deletion, import, cleanup, or Production decision that depends on them.

| Data set | Count |
|---|---:|
| Suppliers | 480 |
| Supplier duplicate-index records | 480 |
| Supplier submissions | 540 |
| Supplier import batches | 1 |
| Application user documents | 4 |
| Access credits | 8 |
| Access grants | 2 |
| Contribution logs | 528 |
| RFQs | 2 |
| RFQ publish events | 2 |
| RFQ responses | 2 |
| Immutable quotation revisions | 2 |
| RFQ response events | 3 |
| Notifications | 6 |
| Audit logs | 623 |
| Material terms | 1 |
| Term suggestions | 11 |
| Settings documents | 1 |
| Conversations | 0 |
| Messages | 0 |
| Claim/ownership-foundation records | 0 |

- The 480 Suppliers are listed/approved Supplier records. They must not be described as claimed, active, RFQ-ready, verified-owner, or paying Suppliers.
- The former count of 479 is superseded by the bounded count of 480 as of 3 August 2026.
- The two RFQs and related quotation records are controlled TEST artifacts. They remain preserved and must not be deleted without explicit approval.
- Four Firestore application user documents do not prove exact Firebase Auth user parity; the exact Auth user count remains **Unknown**.

## 4. Quality and Testing

PR #47 validated the first local SQL slice on its exact approved head. PR #45 validated the schema-design documentation on its exact reviewed head. PR #43 repeated the repository test and build checks and validated the local Supabase foundation on its exact head. PR #40 remains the latest known evidence for the Firestore Emulator, Functions Emulator, Firebase Production-bundle, and Functions build suites.

- **Latest known historical fact, PR #40 exact-head evidence (`5ebb5c50d9a64cafe9d5c53a5eedc0183475c190`):** Repository tests: **181/181 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Firestore Emulator suite: **89/89 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Functions Emulator suite: **21/21 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Firebase Production-bundle validation: **3/3 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Application Production build: **passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Functions typecheck/build: **passed**.
- **Verified current fact:** GitHub PR gate run 63 passed for PR #41 documentation head `1ed6a0f4691b414aaf331f6b56626979b1f9809b`.
- **Verified current fact, PR #43 exact-head evidence (`443f48abe5607ecbf731b25542293f028e6afa99`):** `npm ci` passed.
- **Verified current fact, PR #43 exact-head evidence:** Repository tests: **181/181 passed**.
- **Verified current fact, PR #43 exact-head evidence:** Application Production build passed.
- **Verified current fact, PR #43 exact-head evidence:** Supplier-template generation passed and reproduced with a clean generated diff.
- **Verified current fact, PR #43 exact-head evidence:** Supabase CLI version check passed at exactly `2.111.0`.
- **Verified current fact, PR #43 exact-head evidence:** Local Supabase start, status, Studio HTTP `200` probe, and normal project-scoped stop passed; the final local stack state was stopped.
- **Verified current fact, PR #43 exact-head evidence:** Secret scan passed, and GitHub PR gate run 65 passed.
- **Verified current fact, PR #45 exact-head evidence (`9db67cf781ebf79523219a34e11149969542248a`):** GitHub PR gate run 70 / Actions run `30848082396` passed. Documentation structure, mappings, decision synchronization, Mermaid diagrams, secret scans, and diff checks passed.
- **Verified current fact, PR #47 exact-head evidence (`217f3b49b697c03fae78396d0730d39d30486f94`):** A clean local PostgreSQL `17.6` reset applied migration `20260804000136`; pgTAP passed **60/60** and warning-level database lint returned no errors.
- **Verified current fact, PR #47 exact-head evidence:** Repository tests passed **181/181**, the Production application build passed, and supplier-template generation reproduced the tracked workbook byte-for-byte.
- **Verified current fact, PR #47 exact-head evidence:** Focused independent SQL review completed with no residual actionable finding after active-parent, version-coupling, merge-slot, validation, metadata, and supersession-lineage fixes.
- **Verified current fact, PR #47 exact-head evidence:** GitHub PR gate run `30856547810` passed. This check result is separate from the local PostgreSQL, pgTAP, repository-test, and build evidence above.

Do not combine results from different commits or PRs into a new automated-test total. Do not attribute PR #40 Emulator or Firebase bundle evidence to PR #43 or PR #45, and do not describe documentation or local Supabase validation as a Production test.

## 5. Supabase Migration State

- **Verified current fact:** The migration baseline documentation is merged under `docs/supabase-migration/` and is the authoritative detailed source for migration inventory, architecture, mapping, identity, Storage, risk, rollback, and sequencing.
- **Plan/recommendation:** Use a gradual migration, not a direct Firestore collection export.
- **Plan/recommendation:** Retain one React/Vite frontend and the existing visual identity; do not rewrite the frontend or visual identity.
- **Plan/recommendation:** Retain Firebase Hosting initially; no DNS or Hosting migration belongs to the initial phase.
- **Plan/recommendation:** Retain Firebase Auth initially, pending a separately reviewed TEST proof of concept.
- **Plan/recommendation:** Introduce Supabase gradually behind explicit provider/service boundaries.
- **Plan/recommendation:** Give every feature exactly one source of truth at a time. Do not use Production dual writes or silent Firebase fallback after a Supabase failure.
- **User-reported context:** A hosted Supabase project named Mujahiz IQ exists in Central EU (Frankfurt) on the Free plan.
- **Unknown:** The hosted project identity, region, plan, schemas, tables, RLS, Auth, Storage, Edge Functions, backups, compute, GitHub integration, and automatic deployment were not independently verified.
- **Verified current fact:** Local Supabase infrastructure scaffolding has started and is merged. Supabase CLI `2.111.0` is pinned as a local development dependency.
- **Verified current fact:** `supabase/config.toml` exists for local project ID `mujahiz-iq-local`; local start, status, Studio access, and normal stop were validated, and the local stack is currently stopped.
- **Verified current fact:** No hosted Supabase implementation or linkage exists. No hosted project was authenticated, accessed, queried, changed, or independently verified through this repository work, and the merged SQL migration has not been applied remotely.
- **Verified current fact:** GitHub `main` contains the first local migration-control SQL slice: migration `supabase/migrations/20260804000136_migration_control_foundation.sql` creates six governance tables in the non-exposed `internal` schema, and `supabase/tests/migration_control_foundation.sql` supplies repository-tracked synthetic pgTAP coverage.
- **Verified current fact:** No business/application PostgreSQL tables, RLS, Auth bridge, Supabase Auth users, Storage buckets, Edge Functions, `supabase-js` frontend integration, or Migration Engine runtime exists.
- **Verified current fact:** No browser integration, API policy, application grant, hosted Supabase project link, or remote migration application exists.
- **Verified current fact:** Firebase Production remains unchanged and authoritative for the live application. No Firebase or Production data was migrated, exported, seeded, backfilled, or changed by PR #47, PR #48, or PR #49.

The merged local infrastructure and migration-governance SQL, a future business/application schema, any hosted Supabase project, and Firebase Production are separate states. Supabase is not currently a Production authority.

### PostgreSQL schema-design state

- **Verified current fact:** The authoritative logical PostgreSQL schema design and its first local migration-control/traceability slice are merged; the business/application schema remains unimplemented.
- **Verified current fact:** The design classifies 79 logical concepts: 36 Core Phase 1, 10 Core Later, 13 Future-Compatible, 13 Deferred, and 7 Remove/Merge.
- **Verified current fact:** Of the 36 Core Phase 1 concepts, 4 are represented by the first SQL slice, 2 are approved for the second slice, and the other 30 remain deferred. The first 4 logical concepts use 6 physical tables because `migration_record_mappings` is decomposed across 3 relations.
- **Verified current fact:** The approved second slice is exactly `public.user_profiles` and `internal.identity_provider_links`. `platform_role_assignments`, all access/trial ledger tables, and the other remaining Core Phase 1 concepts are deferred.
- **Verified current fact:** Core Phase 1 remains a maximum candidate set, not approval to create all 36 concepts in one PR. PR #49 approves only the named two-table future local implementation boundary.
- **Verified current fact:** The design maps all 35 verified Firestore collections, registers 36 synchronized decisions, and provides a 119-item schema review checklist. DB-001 is resolved for the local first slice to database-generated UUIDv4 through `pg_catalog.gen_random_uuid()`; hosted compatibility remains a later validation gate.
- **Verified current fact:** MIG-001 is partially implemented only at the declarative schema-contract level. Migration Engine locking, replay lookup, transformation, reconciliation, graph supersession, and rollback execution remain unimplemented.
- **Verified current fact:** ID-001, MIG-002, and all 12 other approval gates remain Open; no Auth authority has been chosen, and 14 approval gates remain Open in total.

#### Approved future second-slice boundary

A future SQL implementation PR may create only:

- `public.user_profiles`;
- `internal.identity_provider_links`.

That future PR must remain local-only and synthetic-data-only, without RLS, policies, browser/API privileges, Auth bridge, application integration, Firebase or Production data access, hosted Supabase linking, remote SQL, or deployment. `platform_role_assignments` is one of those 30 deferred concepts and must not be created.

#### Open approval gates

The 14 remaining Open approval gates are:

- `ID-001`
- `ORG-001`
- `ORG-002`
- `SUP-003`
- `SUP-004`
- `RFQ-003`
- `MSG-002`
- `MSG-003`
- `SEARCH-001`
- `FILE-001`
- `BILL-001`
- `AUD-001`
- `RES-001`
- `MIG-002`

**Open means not approved.** SQL implementation must not silently resolve these decisions. Each decision must be resolved before its named implementation phase; the first SQL slice must resolve or explicitly defer every Open decision that blocks its selected tables.

### Local Supabase security state

- **Verified current fact:** Local Supabase is disposable, development-only infrastructure and must remain stopped when unused.
- **Verified current fact:** On the validated Windows/Docker Desktop host, enabled ports `54321` through `54324` may bind to wildcard IPv4 and IPv6 interfaces while the stack runs. This is a local-development network exposure limitation, not a Firebase or Production vulnerability.
- **Plan/recommendation:** Use host firewall and network isolation before starting the stack on an untrusted or shared network. Never expose it through router forwarding, public tunnels, or other external ingress.
- **Verified current fact:** Local Analytics is disabled. Docker daemon TCP port `2375` was not enabled and must not be enabled as part of this work.

## 6. Current Priorities

Migration sequencing and product priorities are separate.

### Recommended technical next task

**Second SQL Slice Implementation — Provider-Neutral Identity Foundation**

Implement only `public.user_profiles` and `internal.identity_provider_links` in a future dedicated PR under the approved local-only, synthetic-data-only boundary above. Do not add `platform_role_assignments`, RLS, policies, browser/API privileges, an Auth bridge, application integration, Firebase or Production data access, hosted Supabase linking, remote SQL, or deployment.

### Product priorities

1. Claim Supplier Profile.
2. `supplierProfileId` and verified ownership.
3. Onboarding.
4. Real RFQ cycles.
5. Permissions.
6. Notifications, messages, quotations, and comparison.
7. Value measurement.
8. Catalog Lite and quotation builder.
9. Auto-Draft before Auto-Send.

Claim Supplier exists on GitHub `main` but is not deployed. Do not suggest or perform its deployment as part of a documentation or migration-foundation task.

## 7. Completed Security and Operational Foundations

Do not reopen these areas without new evidence:

- Buyer, Supplier, Admin, and Owner role boundaries.
- Canonical Supplier ownership checks on sensitive operations.
- RFQ create/publish/close/cancel and response lifecycle boundaries.
- Conversation/message current-eligibility checks and self-only read receipts.
- Event-bound deterministic RFQ notifications.
- Feature flags fail closed in Production.
- Production does not silently fall back to Demo.
- One bounded current-user notification source; fixed polling removed.
- Role-scoped dashboard/report reads and short-lived in-flight-deduplicated caches.
- Canonical domain handling and legacy-host redirects.
- Email verification synchronization with Firebase Auth as source of truth.
- One-time Buyer Trial rules and Supplier/Admin/Owner Trial exclusion.
- Deterministic loopback-only Internal Emulator accounts and reset/reseed lifecycle.

## 8. Explicitly Deferred Items

These are not implied by the current plan and require separate approval and evidence:

- Firebase Custom action URL changes.
- Production Claim Supplier deployment or enablement.
- Supabase hosted-project linking or authentication.
- Auth-provider migration.
- DNS or Hosting migration.
- Production data export, migration, seed, backfill, repair, cleanup, or deletion.
- Auto-Send quotations.
- Full CPQ or advanced catalog.
- Complete subscription/billing system or Stripe configuration.
- ERP integrations.
- Native mobile applications.
- Broad performance refactor or redesign.
- Large-scale Supplier imports.

## 9. Production Protection and Stop Rules

- Never merge, deploy, publish, link a hosted project, change billing, change DNS, or change Production Firebase or Supabase configuration without explicit approval.
- Never delete, migrate, seed, backfill, bulk-update, reformat, or clean Production data without explicit approval.
- Do not delete controlled TEST records without explicit approval.
- Do not export Production data or inspect secrets as part of a baseline or local-foundation task.
- Use Emulator, local Supabase, and isolated synthetic data for write-capable tests.
- Production checks should be bounded and read-only where required.
- File uploads remain disabled unless separately approved.
- Do not assume Storage, Functions, Supabase resources, Extensions, or Firebase AI services are active.
- Do not treat `C:\tmp` as permanent backup storage.

## 10. Baseline Verification Rule

For ordinary UI or isolated application changes:

- verify current `main`;
- use this baseline;
- inspect the affected module and current diff only; and
- run the smallest affected tests first.

For security, data, Rules, deployment, RFQ lifecycle, notifications, imports, authentication, supplier linking, infrastructure, or migration tasks, refresh the relevant current facts before acting:

- GitHub `main` SHA;
- Hosting release/version and historical source mapping;
- active Ruleset and deployed-index readiness;
- deployed Functions and Storage state;
- bounded Production counts;
- audit-log count and Supplier fingerprints when Supplier data could be affected;
- controlled TEST/UAT records that must be preserved; and
- hosted Supabase identity, environment role, plan, configuration, and resource state when the task depends on them.

If any value differs unexpectedly, stop and report the delta before writing, merging, linking, cleaning, migrating, or deploying.
