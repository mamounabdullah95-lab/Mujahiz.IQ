# Firebase-to-Supabase current state and inventory

Verification snapshot: **2026-08-03T01:42:22+03:00** (Asia/Baghdad)

## Evidence labels

- **[Verified current fact]** Confirmed during this task from the current checkout, GitHub, or a bounded read-only API/CLI response.
- **[Latest known historical fact]** Confirmed previously, but not re-proved as a current state unless paired with a current check.
- **[Assumption]** Working context supplied by the user or inferred for planning; it requires verification before implementation.
- **[Unknown]** Not safely observable with the access available in this task.
- **[Future plan]** A proposed migration direction, not implemented state.

## Executive finding

- **[Verified current fact]** GitHub `main`, live Firebase Hosting, active Firestore Rules, deployed indexes, and deployed Functions are separate repository/Firebase states and must remain separately versioned. Sources: Git and the read-only Firebase APIs/CLI used on 2026-08-03.
- **[Assumption]** The user reports a hosted Supabase project named "Mujahiz IQ" in Central EU (Frankfurt) on the Free plan. Its project identity, region, plan, and intended environment role were not independently verified.
- **[Unknown]** The hosted Supabase schemas, tables, RLS policies, Auth configuration, Storage buckets, Edge Functions, backups, compute, GitHub integration, and deployment settings were not observable with the access available in this task.
- **[Verified current fact]** GitHub `main` is ahead of live Firebase: current source includes Claim Supplier UI/backend, 18 composite-index definitions, restrictive Claim-aware Rules, and nine callable Functions; live Firebase has the older Hosting release and Rules, 15 READY indexes, zero deployed Functions, and no Claim collections with records. Sources: `firebase.json`, `firestore.indexes.json`, `firestore.rbac.rules`, `functions/src/index.ts`, PRs #38-#40, and live metadata/count checks.
- **[Verified current fact]** The migration is not a collection export. The application relies on denormalized arrays and snapshots, deterministic IDs, atomic batches, transactions, immutable quotation revisions, event-bound notifications, canonical duplicate fingerprints, idempotency records, protected ownership links, and trusted server writes. Sources: `src/services/workspace.ts`, `src/services/registration.ts`, `src/services/supplierExcelImport.ts`, `functions/src/`, and `firestore.rbac.rules`.
- **[Future plan]** Introduce Supabase behind the existing frontend service boundary. Do not rebuild the React UI and do not make two backends authoritative for the same Production feature.

## Repository and branch baseline

| Item | Status and evidence |
|---|---|
| Remote repository | **[Verified current fact]** `mamounabdullah95-lab/Mujahiz.IQ`; `origin` is the matching GitHub remote. |
| Remote fetch | **[Verified current fact]** `git fetch origin main` completed on 2026-08-03. |
| Exact `main` | **[Verified current fact]** `3fbcf93af86e702e5885d3696ef5c7ddfc89a2b4`; local `main`, `origin/main`, and task start `HEAD` matched. |
| Starting worktree | **[Verified current fact]** Clean before branch creation. |
| Feature branch | **[Verified current fact]** `docs/supabase-migration-baseline-20260803`, created from the exact `main` above. |
| Checked-in baseline conflict | **[Verified current fact]** `docs/ai-context/01_CURRENT_BASELINE.md` still names `d66a04c18ab7260e5444e67d0ca62795ccc39fce` and PR #36 as current. It is useful historical deployment evidence but is stale for current GitHub `main`, which includes PRs #38-#40. |
| Application dependencies | **[Verified current fact]** React 18, Vite 6, TypeScript 5.6, Firebase JS SDK 11; no Supabase dependency. Source: `package.json`. |
| Functions dependencies | **[Verified current fact]** Node 22, Firebase Functions v2, Firebase Admin; no Supabase dependency. Sources: `functions/package.json` and `firebase.json`. |

## Exact-head verification evidence

- **[Latest known historical fact]** PR #40 recorded the following on exact head `5ebb5c50d9a64cafe9d5c53a5eedc0183475c190`, whose merge commit is current `main` `3fbcf93…`: repository tests **181/181**, Firestore Emulator tests **89/89**, Functions Emulator tests **21/21**, Firebase Production bundle validation **3/3**, application TypeScript/Production build passed, and Functions typecheck/build passed. Source: merged PR #40.
- **[Verified current fact]** PR #40 is merged and its merge commit is the exact current `main`. Source: GitHub PR metadata and local Git history.
- **[Verified current fact]** Expensive runtime suites were not rerun locally before documentation commit `31b5894fb90e1adf776bdd2c918fe62e1c970a39`; no code or configuration changed.
- **[Verified current fact]** GitHub PR gate run 62 later ran on exact PR head `31b5894fb90e1adf776bdd2c918fe62e1c970a39` and completed successfully. It validated the repository test, build, and Emulator workflow defined by `.github/workflows/pr-gate.yml`.
- **[Verified current fact]** No combined automated-test total is stated here because no current authoritative report defines one.

## Firebase live state

All checks below were read-only. Count queries used Firestore aggregation and did not download document bodies. No full scan ran.

| Area | Current result |
|---|---|
| Project | **[Verified current fact]** Firebase project `mujahiziq` is `ACTIVE`. The identifier is retained here because it is operationally necessary for baseline correlation. |
| Firestore | **[Verified current fact]** Default database is Firestore Native, Standard edition, location `eur3`, pessimistic concurrency. |
| Hosting | **[Verified current fact]** Live release `1785332157811000`; version `42b95b8aad86e7a0`; deployed `2026-07-29T13:35:57.811Z`; version is `FINALIZED`, 71 files, 3,562,848 bytes. |
| Hosting source mapping | **[Latest known historical fact]** Repository baseline maps that unchanged release/version to commit `d66a04c18ab7260e5444e67d0ca62795ccc39fce`. The Hosting API does not expose a commit SHA, so this mapping is historical evidence, not a new API assertion. |
| Domains | **[Verified current fact]** `mujahiz.com`, `www.mujahiz.com`, `mujahiziq.web.app`, and `mujahiziq.firebaseapp.com` remain authorized/operational identities. One old PR-preview `web.app` domain also remains authorized. Source: read-only Auth project configuration. |
| Active Rules | **[Verified current fact]** Active Ruleset ID `e6948804-1333-433a-ac69-f0f963d07355`, created `2026-07-21T14:13:43.303023Z`. A normalized content hash matches `firestore.rbac.rules` at deployed commit `d66a04c…` and does not match current `main`. |
| Composite indexes | **[Verified current fact]** 15 deployed composite indexes, all `READY`. Current repository defines 18; the three Claim indexes are not deployed. Sources: Firebase CLI/API and `firestore.indexes.json`. |
| Functions | **[Verified current fact]** Zero deployed Functions. Current repository defines nine callable Functions for a first deployment in `europe-west1`. |
| Storage | **[Verified current fact]** The project-level Storage API returned zero buckets. Consequently there was no object count/size to calculate. |
| Auth provider | **[Verified current fact]** Email/password provider is enabled and passwords are required; MFA is disabled. |
| Auth users | **[Unknown]** Exact Firebase Auth user count was not queried because the available API path would read user records. Firestore contains four application user documents, which is not proof of exact Auth parity. |
| Claim feature gates | **[Verified current fact]** No Claim backend can run because zero Functions are deployed. **[Latest known historical fact]** The unchanged Hosting release predates PRs #38-#40, so it does not contain the Claim UI. Actual build-time environment values were not read from secret-bearing local files. |
| Claim deployment | **[Verified current fact]** Claim Supplier work exists only on GitHub `main`; no Claim index, Function, live collection record, feature enablement, or Production claim was found. |
| Writes | **[Verified current fact]** All audit reports stated `writesAttempted: false`; no Firebase write, deployment, configuration change, or full document scan occurred. |

### Live Firestore collections and bounded counts

**[Verified current fact]** The root collection metadata call returned 18 currently existing top-level collections. Count-only queries also confirmed repository-defined but currently absent collections as zero. Firestore does not retain empty collection containers.

| Collection | Count | Notes |
|---|---:|---|
| `suppliers` | 480 | All 480 have `status=approved`; this is a listed-supplier count, not a claimed/RFQ-ready/active/paying count. |
| `supplierDuplicateIndex` | 480 | Denormalized duplicate/search guard. |
| `supplierSubmissions` | 540 | Includes historical submission states; no unbounded state breakdown was required. |
| `supplierImportBatches` | 1 | Metadata only; raw workbook storage is prohibited. |
| `users` | 4 | Roles: 1 owner, 1 admin, 2 contributor; account types: 1 buyer, 1 supplier; all four status `approved`. |
| `accessCredits` | 8 | Trial/contribution access ledger. |
| `accessGrants` | 2 | Immutable grant records. |
| `contributionLogs` | 528 | Contribution/reward ledger. |
| `rfqs` | 2 | Controlled TEST records are preserved per repository baseline. |
| `rfqPublishEvents` | 2 | Deterministic publication events. |
| `rfqResponses` | 2 | Canonical quotations. |
| `rfqResponseRevisions` | 2 | Immutable quotation revisions. |
| `rfqResponseEvents` | 3 | Deterministic submit/update events. |
| `notifications` | 6 | Event-bound notifications. |
| `auditLogs` | 623 | Count only; no audit contents were downloaded. |
| `materialTerms` | 1 | Search dictionary data. |
| `termSuggestions` | 11 | Search-term review queue. |
| `settings` | 1 | Platform settings. |
| `categories`, `contentPages`, `conversations`, `favorites`, `messages`, `publicConfig`, `reviews`, `supplierFeedback`, `supplierProducts`, `supplierDocuments` | 0 each | Repository-defined collections with no current live documents. |
| `supplierOwnershipClaims`, `supplierOwnershipEvents`, `supplierOwnershipClaimRequests`, `supplierClaimantLocks`, `supplierClaimSearchRateLimits`, `supplierCanonicalUniqueness`, `supplierSubmissionDuplicateIndex` | 0 each | Claim/new uniqueness foundation is not deployed or populated. |

- **[Unknown]** Live subcollections cannot be proven absent without walking document paths. Repository code and Rules use top-level collections only; no `collectionGroup` query or nested collection path was found. Source: static repository search.
- **[Verified current fact]** The old historical Supplier count of 479 is superseded by the current bounded count of 480.

## Repository Firebase dependency inventory

| Firebase area | Repository evidence | Current behavior |
|---|---|---|
| Initialization/runtime selection | `src/config/firebase.ts`, `src/config/runtimePolicy.ts`, `src/config/demoStorage.ts` | **[Verified current fact]** Initializes App, Auth, Firestore, Functions and optional App Check. Production with missing/malformed config enters `configuration_error`; Demo requires an explicit development flag. |
| Auth | `src/contexts/AuthContext.tsx`, `src/services/registration.ts`, `src/services/emailVerification.ts`, `src/services/passwordRecovery.ts`, `src/services/emailActions.ts` | **[Verified current fact]** Firebase Auth owns email/password registration, login, sessions, verification, reset, and recovery. Firestore `users/{uid}` is the application profile/authorization record. |
| Firestore | `src/services/firestore.ts`, `src/services/workspace.ts`, `src/services/portalDashboard.ts`, `src/services/adminUsers.ts`, `src/services/supplierExcelImport.ts`, `src/services/supplierOwnership.ts`, `src/services/supplierWorkspace.ts` | **[Verified current fact]** Most data access is centralized in service modules, but the browser still performs many authorized writes, batches, and transactions. |
| Functions | `functions/src/index.ts`, `functions/src/callableRegion.ts`, `functions/src/adminUsers.ts`, `functions/src/supplierDuplicate.ts`, `functions/src/supplierOwnership.ts`, `functions/src/supplierSubmissionApproval.ts` | **[Verified current fact]** Nine v2 callables are implemented for `europe-west1`; none are deployed. |
| Storage | `src/services/uploadService.ts`, `src/types/workspace.ts`, `firestore.rbac.rules` | **[Verified current fact]** No Firebase Storage SDK import or adapter. Uploads fail closed. Metadata uses `upload_pending_launch`/`metadata_only`; Rules reject file URLs, paths, raw bytes, Base64, Blob, workbook, and similar fields. |
| Hosting | `firebase.json`, `src/config/canonicalOrigin.ts`, `vite.config.ts` | **[Verified current fact]** Firebase Hosting serves `dist` with a catch-all SPA rewrite. No backend proxy rewrite is configured. |
| Emulators | `firebase.json`, `src/config/firebase.ts`, `scripts/run-firestore-emulator-tests.mjs`, `scripts/run-functions-emulator-tests.mjs` | **[Verified current fact]** Auth 9099, Firestore 8080, Functions 5001; single-project mode; Functions client uses `europe-west1`. |
| Rules | `firestore.rbac.rules` (active repository target), `firestore.rules` (legacy/unreferenced by `firebase.json`) | **[Verified current fact]** Current Rules encode role, ownership, query shape, immutable revision/event, notification, trial, import, and file-field invariants. |
| Indexes | `firestore.indexes.json` | **[Verified current fact]** 18 definitions: 15 live-compatible definitions plus three Claim queue/history/conflict indexes. |
| Environment flags | `.env.example`, `src/config/features.ts`, `src/config/runtimePolicy.ts` | **[Verified current fact]** Example defaults: uploads false, Excel import true, Claim false, AI false, Demo false, Emulators false. Strict string `true` is required. Actual secret-bearing local environment values were not inspected. |
| CI | `.github/workflows/pr-gate.yml` | **[Verified current fact]** Repository tests, build, Functions checks, bundle validation, Firestore/Functions Emulator suites, and template reproducibility run on PRs. |
| Deployment tooling | `scripts/deploy-hosting-rest.mjs`, `scripts/deploy-firestore-rules-rest.mjs`, `scripts/deploy-firebase.ps1` | **[Verified current fact]** These scripts can write/deploy and were inspected but not executed. `scripts/audit-production-read-only.mjs` is the bounded read-only audit path. |

### Frontend dependency map

| Boundary | Direct consumers |
|---|---|
| Firebase Auth SDK | **[Verified current fact]** `src/contexts/AuthContext.tsx`; `src/pages/EmailActionPage.tsx`; `src/pages/ForgotPasswordPage.tsx`; `src/pages/ResetPasswordPage.tsx`; password-reset action in `src/pages/workspace/BuyerWorkspacePages.tsx`. |
| `services/firestore` | **[Verified current fact]** Directory, Supplier profile, Add Supplier, dashboards, submissions, reviews, feedback, Admin users/settings/audit/material pages, and `TaxonomyContext`. |
| `services/workspace` | **[Verified current fact]** Buyer/Supplier/Admin workspace pages, Supplier profile favorites/conversation, registration/complete-profile sector reads, content pages, `NotificationContext`, and quotation revision UI. |
| `services/supplierOwnership` | **[Verified current fact]** Supplier Claim search/history/pages/card, Admin Claim queue/detail, Add Supplier duplicate check, and trusted submission/user/access wrappers. |
| `services/supplierExcelImport` | **[Verified current fact]** `src/pages/SupplierExcelImportPage.tsx`. |
| `services/portalDashboard` / `services/adminUsers` | **[Verified current fact]** Admin/Owner operational dashboards and administrative user listing. |
| `services/supplierWorkspace` | **[Verified current fact]** Supplier workspace category/subcategory update. |
| Upload service | **[Verified current fact]** Disabled-upload components only; no Storage-backed page exists. |

- **[Verified current fact]** A provider/repository layer can be introduced beneath the existing service imports without maintaining a second UI. Direct Auth SDK consumers must be wrapped or deliberately retained during Option A.
- **[Future plan]** Move one bounded feature at a time only when its complete write invariant set has one authoritative backend. Closely coupled records must move together: claims/ownership/events/audit/notification, RFQs/quotations/revisions/events/notification, and conversations/participants/messages/read receipts.

## Data-shape and integrity findings

- **[Verified current fact]** Nested/array data includes Supplier branches, phones, governorates, coverage areas, categories, subcategories, tags, payment options, credit days, search keywords, duplicate matches, claimant snapshots, RFQ recipient IDs/reference links, conversation participant IDs/labels, and message read receipts. Sources: `src/types/domain.ts` and `src/types/workspace.ts`.
- **[Verified current fact]** Denormalized identity is intentional: `users.supplierProfileId` must agree with `suppliers.accountOwnerId`; RFQ responses and revisions duplicate buyer/supplier/profile IDs; notifications duplicate event/reference/actor/recipient IDs; submissions embed a Supplier draft and duplicate-check snapshot.
- **[Verified current fact]** Deterministic IDs include favorites `${userId}_${supplierId}`, quotations `${rfqId}_${supplierUserId}`, revisions/events `${responseId}_v${revisionNumber}`, publication/response notification IDs, trial/audit IDs, Supplier import row IDs, ownership event IDs, and hashed idempotency/fingerprint documents.
- **[Verified current fact]** Atomic client operations include RFQ publication/event creation, first quotation/revision/event/notification creation, quotation revision transactions, registration trial activation, import batch/submission/index/audit creation, and conversation message plus last-message update.
- **[Verified current fact]** Trusted Functions atomically enforce final-owner protection, Auth/Firestore current-state agreement, ownership claim locks, approval conflict resolution, canonical uniqueness, submission approval side effects, access grants, audits, and result notifications.
- **[Future plan]** PostgreSQL constraints, RLS, deferrable foreign keys where justified, SQL/RPC functions, triggers used sparingly, and trusted Edge Functions/application services must recreate these boundaries before a feature cutover.

## Supplier Excel/import compatibility

- **[Verified current fact]** The approved workbook is `.xlsx`, maximum 200 KB, maximum 50 non-empty Supplier rows, maximum 40 columns, with an official 35-field bilingual schema containing 13 required fields. Sources: `src/utils/supplierExcelCore.js` and its tests.
- **[Verified current fact]** The generated official workbook has four worksheets, 50 empty data rows, eight data validations, frozen headers, no macros/embedded media, and no Supplier contact records. Sources: `scripts/generate-supplier-import-template.mjs` and `tests/supplier-template.test.mjs`.
- **[Verified current fact]** The browser parses the workbook locally, rejects dangerous ZIP entries/formulas/unsupported shapes, sanitizes fields, validates controlled values, performs bounded trusted duplicate checks, and writes only accepted normalized submissions plus batch/index/audit metadata. The raw workbook is not stored or uploaded.
- **[Verified current fact]** Buyer, Admin, and Owner may import when enabled; Supplier accounts may not. Source: `src/services/supplierExcelImport.ts` and Rules.
- **[Future plan]** Preserve the existing workbook and field contract during migration. A Supabase import path must either accept the same normalized contract or use a versioned deterministic converter with validation, deduplication, source tracking, category review, quality checks, and idempotency.
- **[Future plan]** New Supplier data may continue to be collected outside Production, but no Supplier import is part of this task.

## Supabase integration state

| Item | Status |
|---|---|
| Project name | **[Assumption]** User reports a project named “Mujahiz IQ”. Not independently verified. |
| Region | **[Assumption]** User reports Central EU (Frankfurt). Not independently verified. |
| Plan / compute | **[Assumption]** User reports Free plan. Exact compute tier is **[Unknown]**. |
| CLI/access | **[Verified current fact]** No Supabase CLI is installed, no Supabase environment-variable name is present, and the repository is not linked. No CLI was installed and `supabase link` was not run. |
| Schemas/tables/RLS | **[Unknown]** No authenticated read-only Supabase path was available. “Empty” was not assumed. |
| Storage buckets | **[Unknown]** No authenticated read-only Supabase path was available. |
| Edge Functions | **[Unknown]** No authenticated read-only Supabase path was available. |
| Auth users/providers | **[Unknown]** No authenticated read-only Supabase path was available. |
| GitHub integration/automatic deployment | **[Unknown]** Project-side state is not observable. **[Verified current fact]** This repository has no Supabase config, dependency, reference, or GitHub workflow. |
| Writes | **[Verified current fact]** No Supabase API, database, Auth, Storage, Function, integration, configuration, or billing write occurred. |

## Unknowns and blockers

- **[Unknown]** Supabase project reference, exact organization/plan/compute, project status/pausing state, schemas, extensions, tables, RLS, grants, exposed schemas, Storage, Realtime, Functions, Auth, secrets, backups, and integrations. Safe next evidence: an explicitly authorized read-only Supabase Management API/CLI session or redacted Dashboard screenshots; do not link the repository.
- **[Unknown]** Exact Firebase Auth user count and provider-linked identity breakdown. Safe next evidence: a Console aggregate or purpose-built count-only Admin audit that never emits user records.
- **[Unknown]** Whether any live Firestore subcollections exist outside repository conventions. Safe next evidence: a bounded metadata inventory designed not to traverse or print protected records.
- **[Unknown]** Current Firebase Auth email-template action URL was not re-read in this task. **[Latest known historical fact]** It remained the original Firebase handler after `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`.
- **[Unknown]** Current client build-time values for non-public feature flags were not read from local secret-bearing files. Live behavior proves Claim is unavailable because the deployed code predates Claim and zero Functions are deployed.
- **[Future plan]** Resolve these unknowns in a separate read-only preflight before any Supabase CLI foundation, schema, Auth integration, or data-copy task.

## Evidence sources

- Repository: `CODEX.md`, `docs/ai-context/`, `docs/claim-supplier-backend-deployment.md`, `firebase.json`, `.firebaserc`, `.env.example`, `firestore.rbac.rules`, `firestore.indexes.json`, `package.json`, `functions/`, `src/config/`, `src/services/`, `src/types/`, `scripts/`, `tests/`, `.github/workflows/pr-gate.yml`.
- GitHub: merged PRs #28, #30, #32-#40, with PRs #38-#40 defining the current Claim/Functions delta.
- Live read-only checks: Cloud Resource Manager, Firestore Database/Documents/Admin, Firebase Rules, Firebase Hosting, Cloud Functions, Cloud Storage, Identity Toolkit project configuration, and Firebase CLI index listing on 2026-08-03.
