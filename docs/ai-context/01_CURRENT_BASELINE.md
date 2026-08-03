# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-08-03-post-pr41-supabase-migration-plan`
Updated: 2026-08-03
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
- **Verified current fact:** Current GitHub `main`: `e8979a2f241d35016ba91e85f85bcf4d326ad9ee`.
- **Verified current fact:** PR #41 is merged through that merge commit. Its reviewed head was `1ed6a0f4691b414aaf331f6b56626979b1f9809b`.
- **Verified current fact:** PR #41 added eight documentation files under `docs/supabase-migration/`; it made no runtime, deployment, configuration, Auth, DNS, billing, or data change.
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

- **Latest known historical fact:** Firebase Auth remains the password, session, verification, password-reset, recovery, and email-action authority for the deployed application.
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

The latest runtime evidence is inherited from PR #40. PR #41 was documentation-only and did not introduce runtime changes.

- **Latest known historical fact, PR #40 exact-head evidence:** Repository tests: **181/181 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Firestore Emulator suite: **89/89 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Functions Emulator suite: **21/21 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Firebase Production-bundle validation: **3/3 passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Application Production build: **passed**.
- **Latest known historical fact, PR #40 exact-head evidence:** Functions typecheck/build: **passed**.
- **Verified current fact:** GitHub PR gate run 63 passed for PR #41 documentation head `1ed6a0f4691b414aaf331f6b56626979b1f9809b`.

Do not combine these results into a new automated-test total. Do not attribute PR #40 runtime evidence to PR #41, and do not describe PR #41 as a runtime change.

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
- **Verified current fact:** No Supabase implementation has started in the repository.
- **Verified current fact:** No Supabase dependency, CLI configuration, environment-variable name, repository integration, or workflow exists in the repository.
- **Verified current fact:** The Supabase CLI has not been initialized in the repository.
- **Verified current fact:** No application tables, SQL migrations, RLS policies, Storage buckets, Auth users, or Edge Functions have been created through the repository.

Supabase is currently a planned migration/integration environment, not Production.

## 6. Current Priorities

Migration sequencing and product priorities are separate.

### Recommended technical next task

**Phase 2 — Local Supabase CLI Foundation**

This next task must:

- remain local;
- create only the Supabase local project foundation;
- not run `supabase link`;
- not authenticate to or change the hosted Supabase project;
- not add `supabase-js`;
- not create application tables, SQL migrations for application data, RLS policies, Production data, Storage buckets, Auth users, or Edge Functions;
- not deploy; and
- stop at a Draft PR.

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
