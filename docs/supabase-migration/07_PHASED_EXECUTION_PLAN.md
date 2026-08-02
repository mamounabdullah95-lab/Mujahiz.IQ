# Phased execution plan

## Operating model

- **[Future plan]** Every phase is one coherent task, branch, and pull request. Merge, deployment, Production data access/write, and the next phase each require their own checkpoint/approval.
- **[Future plan]** Branch names below are proposals and use the repository's requested/task convention; exact dates may be updated at task start.
- **[Future plan]** Tests are risk-based minimums. Expand only when evidence or repository policy requires it.
- **[Future plan]** “Supabase impact: local/TEST” never authorizes use of the user-reported migration project until its identity and environment role are verified.

## Phase 1 — current baseline and inventory

- **Objective:** **[Verified current fact]** Establish the authoritative repository/live-Firebase/read-only-Supabase-availability baseline and architecture documents.
- **Branch/PR:** **[Verified current fact]** `docs/supabase-migration-baseline-20260803`; draft PR only.
- **Exact scope:** **[Verified current fact]** Eight documents under `docs/supabase-migration/`; bounded read-only Firebase checks; no implementation.
- **Dependencies:** **[Verified current fact]** Exact `main` `3fbcf93…`, repository context, Firebase CLI/API read access.
- **Risk:** **[Future plan]** Low data-change risk; High architectural consequence if facts are mislabeled.
- **Expected files:** **[Verified current fact]** `docs/supabase-migration/00_...` through `07_...` only.
- **Required tests:** **[Future plan]** `git diff --check`, docs scope check, secret/PII scan, claim/evidence-label review, link/path check; reuse PR #40 exact-head tests.
- **Data impact:** **[Verified current fact]** None; count-only reads, no full document scan.
- **Firebase impact:** **[Verified current fact]** Read-only metadata/aggregation only; no deployment/configuration/data write.
- **Supabase impact:** **[Verified current fact]** None; no authenticated path, link, or API call.
- **Deployment scope:** **[Verified current fact]** None.
- **Rollback boundary:** **[Future plan]** Revert documentation commit only.
- **Reasoning / difficulty / usage:** **[Verified current fact]** Extra High / High / High.
- **Stop point:** **[Verified current fact]** Commit, push, open Draft PR, report evidence; do not merge.

## Phase 2 — local Supabase CLI foundation

- **Objective:** **[Future plan]** Add a reproducible local-only Supabase CLI/project scaffold without linking or touching a hosted project.
- **Branch/PR:** **[Future plan]** `chore/supabase-local-foundation-<date>`; one draft PR.
- **Exact scope:** **[Future plan]** Pin an approved CLI execution method, initialize local config, document local start/stop/reset, environment guards, and generated-file policy. Do not add application client code.
- **Dependencies:** **[Future plan]** Phase 1 approved; verified developer runtime/container prerequisites; decision on checked-in local config.
- **Risk:** **[Future plan]** Medium—CLI commands can target remote projects if guards are weak.
- **Expected files:** **[Future plan]** `supabase/config.toml`, local-only docs/scripts, `.gitignore` updates if required; no schema migration beyond tool bootstrap.
- **Required tests:** **[Future plan]** Fresh local start/status/stop; fail-closed remote-project guard; generated diff clean; secret scan.
- **Data impact:** **[Future plan]** Disposable local data only.
- **Firebase impact:** **[Future plan]** None.
- **Supabase impact:** **[Future plan]** Local containers only; no `supabase link`, remote login, push, project creation, or GitHub integration.
- **Deployment scope:** **[Future plan]** None.
- **Rollback boundary:** **[Future plan]** Remove local scaffold in a revert; stop local containers.
- **Reasoning / difficulty / usage:** **[Future plan]** High / Medium / Medium.
- **Stop point:** **[Future plan]** Local foundation reproducible; no remote connection.

## Phase 3 — PostgreSQL schema design

- **Objective:** **[Future plan]** Convert the approved mapping into versioned local SQL migrations and constraints.
- **Branch/PR:** **[Future plan]** `feat/supabase-schema-foundation-<date>`.
- **Exact scope:** **[Future plan]** Identity/organization/Supplier/access foundations first; typed enums/checks/FKs/legacy IDs; internal versus API schema decision. No Production import.
- **Dependencies:** **[Future plan]** Phase 2, mapping decisions, naming/ID/timestamp/soft-delete decisions.
- **Risk:** **[Future plan]** High—early schema mistakes propagate across all phases.
- **Expected files:** **[Future plan]** `supabase/migrations/<timestamp>_schema_foundation.sql`, schema tests/docs, generated local type artifacts only if approved.
- **Required tests:** **[Future plan]** Clean local migration up/down or reset, constraint allow/deny cases, legacy-ID uniqueness, FK/orphan fixtures, lint/diff check.
- **Data impact:** **[Future plan]** Synthetic local rows only.
- **Firebase impact:** **[Future plan]** None.
- **Supabase impact:** **[Future plan]** Local database schema only.
- **Deployment scope:** **[Future plan]** None.
- **Rollback boundary:** **[Future plan]** Reset disposable local database or revert migration before any shared deployment.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Reviewed local schema; no RLS or remote apply.

## Phase 4 — RLS foundation and security tests

- **Objective:** **[Future plan]** Define deny-by-default grants/RLS and trusted authorization helpers for the schema foundation.
- **Branch/PR:** **[Future plan]** `feat/supabase-rls-foundation-<date>`.
- **Exact scope:** **[Future plan]** Issuer/subject mapping, authenticated/anonymous grants, self/admin/Buyer/Supplier ownership policies, internal table isolation, security-definer review.
- **Dependencies:** **[Future plan]** Phase 3; identity Option A test design; app-role and ownership decisions.
- **Risk:** **[Future plan]** Critical.
- **Expected files:** **[Future plan]** RLS/grant migration, policy test harness, security matrix documentation.
- **Required tests:** **[Future plan]** Positive/negative matrix for anonymous, wrong project, unknown UID, self, unrelated Buyer/Supplier, linked/unlinked/suspended/expired, Admin/Owner; exposed-object catalog assertion.
- **Data impact:** **[Future plan]** Synthetic local/TEST only.
- **Firebase impact:** **[Future plan]** None.
- **Supabase impact:** **[Future plan]** Local policies only unless a later explicit TEST deployment task is approved.
- **Deployment scope:** **[Future plan]** None in this PR.
- **Rollback boundary:** **[Future plan]** Revert policy migration/reset local database; do not loosen policies as a workaround.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Independent security review complete; no application connection.

## Phase 5 — backend contracts and provider abstraction

- **Objective:** **[Future plan]** Introduce typed feature contracts and explicit provider selection beneath the existing UI.
- **Branch/PR:** **[Future plan]** `refactor/backend-provider-contracts-<date>`.
- **Exact scope:** **[Future plan]** Wrap direct data/auth boundaries, define provider manifest/error model/idempotency interface, keep Firebase as the only implementation/authority.
- **Dependencies:** **[Future plan]** Phase 1 architecture; schema contract stable enough to avoid leaky abstractions.
- **Risk:** **[Future plan]** High—behavioral regression across many routes.
- **Expected files:** **[Future plan]** New `src/services/contracts`/provider modules, focused adapters, tests; no Supabase client if separately scoped.
- **Required tests:** **[Future plan]** Existing repository/Emulator suites, TypeScript/build, provider fail-closed tests, no-fallback tests, route smoke by role.
- **Data impact:** **[Future plan]** None beyond Emulator synthetic tests.
- **Firebase impact:** **[Future plan]** Behavior preserved; no deployment in PR.
- **Supabase impact:** **[Future plan]** None or mock contract only.
- **Deployment scope:** **[Future plan]** Future Hosting only after separate approval.
- **Rollback boundary:** **[Future plan]** Revert adapter refactor; Firebase remains authority.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** One UI, Firebase parity proven, no Supabase feature enabled.

## Phase 6 — authentication proof of concept

- **Objective:** **[Future plan]** Prove Option A Firebase third-party Auth to Supabase/RLS in TEST.
- **Branch/PR:** **[Future plan]** `spike/firebase-supabase-auth-poc-<date>`.
- **Exact scope:** **[Future plan]** TEST integration, token callback, `role: authenticated` mechanism, Firebase UID mapping, negative issuer/audience/claim tests; no Production users.
- **Dependencies:** **[Future plan]** Phases 2-4 and provider contract; verified TEST projects; explicit approval for any Firebase TEST claim write/Function deploy.
- **Risk:** **[Future plan]** Critical identity boundary.
- **Expected files:** **[Future plan]** TEST-only config docs, auth adapter/probe, policy tests; no secrets.
- **Required tests:** **[Future plan]** Full Auth matrix from `03_AUTH_AND_IDENTITY_OPTIONS.md`, session refresh/expiry, wrong-project rejection, current role/status/ownership lookup, browser UAT.
- **Data impact:** **[Future plan]** Synthetic/controlled TEST identities only.
- **Firebase impact:** **[Future plan]** TEST custom claims/Function only if separately approved; no Production Auth change.
- **Supabase impact:** **[Future plan]** TEST third-party Auth/RLS only; no Production data.
- **Deployment scope:** **[Future plan]** TEST only under explicit approval.
- **Rollback boundary:** **[Future plan]** Disable TEST integration/remove TEST-only claim path; Firebase application Auth remains unchanged.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Evidence and recommendation; no Production enablement and no Option B decision by default.

## Phase 7 — Supplier directory migration rehearsal

- **Objective:** **[Future plan]** Rehearse read-heavy Supplier directory/taxonomy mapping and search compatibility.
- **Branch/PR:** **[Future plan]** `test/supplier-directory-migration-rehearsal-<date>`.
- **Exact scope:** **[Future plan]** Approved protected snapshot/copy process, 480-Supplier scale rehearsal, branches/categories/fingerprints/search transformation, read-only adapter comparison.
- **Dependencies:** **[Future plan]** Phases 3-6; export approval; backup; normalizer/search decisions.
- **Risk:** **[Future plan]** High—duplicates, private contacts, search regression.
- **Expected files:** **[Future plan]** Migration/rehearsal scripts, manifests/schema tests, redacted reports; no Production dataset in Git.
- **Required tests:** **[Future plan]** Counts/hashes/FKs, duplicate compatibility, Arabic/English search, full eligible dataset pagination, RLS public/buyer/owner projections, performance budget.
- **Data impact:** **[Future plan]** Approved TEST/rehearsal copy only; no Production write.
- **Firebase impact:** **[Future plan]** Bounded read/export only under separate approval.
- **Supabase impact:** **[Future plan]** TEST/rehearsal tables populated; never authoritative.
- **Deployment scope:** **[Future plan]** TEST only.
- **Rollback boundary:** **[Future plan]** Discard rehearsal target; Firebase untouched/authoritative.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Rehearsal report and exception decisions; no cutover.

## Phase 8 — Claim Supplier Profile migration

- **Objective:** **[Future plan]** Port the complete Claim/ownership aggregate and trusted decision workflow.
- **Branch/PR:** **[Future plan]** `feat/supabase-supplier-claims-<date>`.
- **Exact scope:** **[Future plan]** Claims, evidence, locks/idempotency, ownership, conflicts, canonical link, events, audits, notifications, bounded search/rate limits.
- **Dependencies:** **[Future plan]** Supplier directory rehearsal, RLS/Auth POC, decision whether Claim first deploys on Firebase, zero/current Claim inventory refresh.
- **Risk:** **[Future plan]** Critical.
- **Expected files:** **[Future plan]** Schema/RLS/trusted commands, provider adapter, security/concurrency tests, migration manifest.
- **Required tests:** **[Future plan]** Current 21 Functions and 89 Rules behaviors translated; parallel conflict/idempotency/final-owner/role/token/rate-limit/evidence URL cases; browser UAT.
- **Data impact:** **[Future plan]** TEST claims only until cutover task; current live count is zero but must be reverified.
- **Firebase impact:** **[Future plan]** Remains authoritative until approved cutover; no dual write.
- **Supabase impact:** **[Future plan]** TEST implementation/data.
- **Deployment scope:** **[Future plan]** TEST only in implementation PR; Production later and separate.
- **Rollback boundary:** **[Future plan]** Disable Supabase Claim provider before Production writes; after writes use rehearsed reverse delta.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** TEST evidence; no Production claim enablement.

## Phase 9 — RFQ and quotation migration

- **Objective:** **[Future plan]** Port RFQ lifecycle, recipients, quotations, immutable revisions, deterministic events/notifications, and history.
- **Branch/PR:** **[Future plan]** `feat/supabase-rfq-quotations-<date>`.
- **Exact scope:** **[Future plan]** Complete aggregate only; Buyer decision/award remains separately approved future scope.
- **Dependencies:** **[Future plan]** Stable identity/Supplier ownership, schema/RLS, provider abstraction, full controlled RFQ fixtures.
- **Risk:** **[Future plan]** Critical data-integrity/procurement history.
- **Expected files:** **[Future plan]** RFQ schema/RLS/commands/adapters, immutable revision/outbox logic, migration/reconciliation tests.
- **Required tests:** **[Future plan]** Create/publish/close/cancel, target eligibility, first submit, material V2, no-op identical submit, concurrency/retry, immutable V1/V2, closure history, event/notification uniqueness, role denials.
- **Data impact:** **[Future plan]** TEST/rehearsal copies only in implementation PR.
- **Firebase impact:** **[Future plan]** Read-only source/rehearsal; authoritative until cutover.
- **Supabase impact:** **[Future plan]** TEST implementation/data.
- **Deployment scope:** **[Future plan]** TEST only; Production cutover separate.
- **Rollback boundary:** **[Future plan]** Aggregate-level authority switch with freeze/delta; never split response/revision/event/notification.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Full TEST/UAT parity; no Production authority change.

## Phase 10 — notifications and messaging

- **Objective:** **[Future plan]** Port canonical notification delivery and private conversation/message workflows.
- **Branch/PR:** **[Future plan]** `feat/supabase-notifications-messaging-<date>`.
- **Exact scope:** **[Future plan]** Notifications/outbox/retries, conversations, participants, messages, read receipts; Realtime only if independently approved.
- **Dependencies:** **[Future plan]** Identity/RLS, Supplier/RFQ relationships, event model, privacy/retention decisions.
- **Risk:** **[Future plan]** Critical privacy; High delivery integrity.
- **Expected files:** **[Future plan]** Messaging/notification schema, RLS, delivery worker/Edge Function if justified, adapters/tests.
- **Required tests:** **[Future plan]** Participant creation/eligibility, third-party denial, self-only receipts, suspension/ownership change, event notification dedup/replay, Realtime reconnect/auth if used.
- **Data impact:** **[Future plan]** TEST only; current live conversations/messages are zero but must be reverified.
- **Firebase impact:** **[Future plan]** Remains source until feature cutover.
- **Supabase impact:** **[Future plan]** TEST tables/channels/functions.
- **Deployment scope:** **[Future plan]** TEST only in implementation PR.
- **Rollback boundary:** **[Future plan]** Disable channel/worker and restore provider only with message delta reconciliation.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Privacy/security review and TEST evidence; no Production messaging cutover.

## Phase 11 — Storage migration and uploads

- **Objective:** **[Future plan]** Introduce provider-neutral file metadata and reviewed Supabase Storage policies/copy tooling.
- **Branch/PR:** **[Future plan]** `feat/supabase-storage-foundation-<date>`.
- **Exact scope:** **[Future plan]** Buckets/paths/policies, upload finalize/scan, manifests, file resolver, copy rehearsal; uploads remain disabled until separate enablement.
- **Dependencies:** **[Future plan]** `04_STORAGE_MIGRATION_PLAN.md`, ownership/RFQ/messaging RLS, current bucket/object refresh.
- **Risk:** **[Future plan]** Critical privacy and broken-link risk.
- **Expected files:** **[Future plan]** Storage migrations/policies, trusted upload/copy code, manifest schema, tests/docs.
- **Required tests:** **[Future plan]** MIME/size/magic-byte/scan, cross-owner denials, signed URL expiry, hash/count/size parity, broken-link/rollback rehearsal.
- **Data impact:** **[Future plan]** TEST objects only; baseline has no Firebase bucket/object workload.
- **Firebase impact:** **[Future plan]** None unless a later refreshed inventory finds approved source objects.
- **Supabase impact:** **[Future plan]** TEST buckets/objects/policies.
- **Deployment scope:** **[Future plan]** TEST only; no upload flag enablement.
- **Rollback boundary:** **[Future plan]** Copy targets may be discarded in TEST; Production uses source retention and reverse-copy after new writes.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Copy/verify evidence; uploads still disabled.

## Phase 12 — Stripe sandbox and entitlement model

- **Objective:** **[Future plan]** Design/test subscription, billing-event, and entitlement behavior without Production billing.
- **Branch/PR:** **[Future plan]** `feat/stripe-sandbox-entitlements-<date>`.
- **Exact scope:** **[Future plan]** Stripe sandbox webhooks, idempotent event ledger, subscriptions/entitlements, Buyer/Supplier/product decisions; no live keys/customers.
- **Dependencies:** **[Future plan]** Access/entitlement schema, business pricing decisions, secret management, webhook threat model.
- **Risk:** **[Future plan]** High financial/access risk.
- **Expected files:** **[Future plan]** Billing schema/RLS, trusted webhook handler, sandbox fixtures/tests/docs.
- **Required tests:** **[Future plan]** Signature/replay/order/duplicate/failure/dead-letter, entitlement grant/revoke/expiry, unauthorized client denial, sandbox UAT.
- **Data impact:** **[Future plan]** Synthetic sandbox events only.
- **Firebase impact:** **[Future plan]** None.
- **Supabase impact:** **[Future plan]** TEST billing/entitlement rows/functions only.
- **Deployment scope:** **[Future plan]** Sandbox/TEST only.
- **Rollback boundary:** **[Future plan]** Disable sandbox handler and remove synthetic TEST state; no Production entitlement.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Product/security approval of model; no live Stripe configuration.

## Phase 13 — full migration rehearsal

- **Objective:** **[Future plan]** Execute an end-to-end, full-volume rehearsal with freeze/delta/verification/restore timing.
- **Branch/PR:** **[Future plan]** `test/full-supabase-migration-rehearsal-<date>`.
- **Exact scope:** **[Future plan]** All approved features/data, exact tooling/migrations, protected manifest, backup/restore, monitoring and rollback drill.
- **Dependencies:** **[Future plan]** Phases 2-12 as applicable; verified Supabase environment/plan; export and data-handling approval.
- **Risk:** **[Future plan]** Critical operational rehearsal.
- **Expected files:** **[Future plan]** Rehearsal runbook/scripts, redacted result report, exception dispositions; no raw dataset.
- **Required tests:** **[Future plan]** Full mapping/count/FK/hash/deterministic checks, role/browser UAT, load/performance, restore and reverse-delta drill, secret scan.
- **Data impact:** **[Future plan]** Approved protected rehearsal copy only.
- **Firebase impact:** **[Future plan]** Bounded read/export; no Production writes.
- **Supabase impact:** **[Future plan]** Rehearsal environment populated/reset under explicit approval.
- **Deployment scope:** **[Future plan]** Rehearsal only.
- **Rollback boundary:** **[Future plan]** Restore/discard rehearsal target; Firebase remains authoritative.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Go/no-go report; no Production cutover.

## Phase 14 — controlled cutover

- **Objective:** **[Future plan]** Change one approved feature (or final approved set) to Supabase authority in a maintenance window.
- **Branch/PR:** **[Future plan]** `release/supabase-cutover-<date>` plus separately approved operational task; never combine with unrelated code.
- **Exact scope:** **[Future plan]** Exact version ledger, backup, initial/final delta, freeze, verification, provider manifest, smoke/UAT, monitoring; no decommission.
- **Dependencies:** **[Future plan]** Phase 13 go decision, explicit Production/data/deployment approval, rollback owner/on-call, plan/backup readiness.
- **Risk:** **[Future plan]** Critical.
- **Expected files:** **[Future plan]** Reviewed release/config change and immutable cutover report; Production commands reviewed separately, not precommitted with secrets.
- **Required tests:** **[Future plan]** Preflight, final counts/FKs/hashes, security smoke, role/browser smoke, event/file reconciliation, post-change monitoring thresholds.
- **Data impact:** **[Future plan]** Approved Production copy/delta and target writes within exact scope.
- **Firebase impact:** **[Future plan]** Feature freeze/read retention; no deletion/disable.
- **Supabase impact:** **[Future plan]** Production schema/data/authority for approved feature only.
- **Deployment scope:** **[Future plan]** Explicitly named Supabase and Hosting/provider config targets only; no DNS/Auth change unless separately approved.
- **Rollback boundary:** **[Future plan]** Trigger/owner/timebox from `06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md`; reverse-delta required after target-only writes.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Authority changed and initial smoke passed; enter observation window, do not decommission Firebase.

## Phase 15 — post-cutover observation and rollback window

- **Objective:** **[Future plan]** Monitor, reconcile, resolve defects, and close or invoke rollback safely.
- **Branch/PR:** **[Future plan]** `docs/supabase-post-cutover-observation-<date>` for evidence/config fixes split into their own branches.
- **Exact scope:** **[Future plan]** Metrics, security/access review, recurring counts/hashes, event/backlog/file checks, incident handling, final retention decision.
- **Dependencies:** **[Future plan]** Phase 14 completed, on-call/rollback owner, retained Firebase source and backups.
- **Risk:** **[Future plan]** Critical until window closes.
- **Expected files:** **[Future plan]** Redacted observation report, issue links, authority/retention decision; no raw records.
- **Required tests:** **[Future plan]** Scheduled reconciliation, role smoke, restore/rollback readiness check, error/quota/latency review.
- **Data impact:** **[Future plan]** Read-only verification unless a separately approved repair/rollback task is opened.
- **Firebase impact:** **[Future plan]** Retained read-only source; no deletion.
- **Supabase impact:** **[Future plan]** Monitored authoritative feature; no unrelated schema changes.
- **Deployment scope:** **[Future plan]** None unless a separately reviewed fix/rollback is required.
- **Rollback boundary:** **[Future plan]** Remains open until explicit closure; after closure a new decommission plan is required.
- **Reasoning / difficulty / usage:** **[Future plan]** Extra High / High / High.
- **Stop point:** **[Future plan]** Formal close/rollback decision and next approved task. Firebase decommission is not implied.

## Recommended next PR

- **[Future plan]** After this baseline is reviewed, the next PR should be **Phase 2: local Supabase CLI foundation** only.
- **[Future plan]** It must not link the repository, authenticate to the hosted project, create remote resources, add `supabase-js`, define application tables, or deploy anything.
