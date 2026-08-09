# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-08-09-msg-003-contract-approved`
Updated: 2026-08-09
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
- **Verified current fact:** Current GitHub `main` before Draft PR #94 merges: `b76888f0d2d8a769ba67bbaa70199ca458f13f87`; the PR #94 branch descends directly from this commit.
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
- **Verified current fact:** PR #51 is closed and merged into `main` as commit `b631de2f657a6f870f7d764d36cdcf38d42c2fb2`; its approved implementation head was `a56ed15097a39cb36feebcc2e9e604e7b34aeb57`.
- **Verified current fact:** PR #51 implemented and merged the second local SQL slice: `public.user_profiles` and `internal.identity_provider_links`.
- **Verified current fact:** PR #54 was merged as commit `4841cce6d784ec68a91c545d95efdbec717a415b`.
- **Verified current fact:** PR #54 implemented `public.supplier_profiles` locally as the third SQL slice. Core Phase 1 now has 7 implemented, 29 deferred, and 36 total concepts.
- **Verified current fact:** PR #59 was merged as commit `f37d46bd875987a6c2d177b21df31a8ecb8e0b71` and implemented `public.categories` locally as the fourth SQL slice.
- **Verified current fact:** PR #61 resolved SUP-004 and selected `public.administrative_areas` as the fifth SQL slice; it made no SQL or data change.
- **Verified current fact:** PR #62 is merged by current `main`; its implementation head `4d390f747b94c9b00f709fea747c29c0b840cbdb` is contained in `main` and adds `public.administrative_areas` locally as the fifth SQL slice.
- **Latest known historical fact:** PR #63 was merged as commit `49c031c4c63734e2e001a0ec798a7a4e785f37e0`; it synchronized the fifth SQL-slice state and made no runtime, deployment, hosted Supabase, Firebase, Auth, data, or Production change.
- **Verified current fact:** PR #64 is merged by current `main` as commit `d5ca92d19e5c0cb533c2614a4ca0a3d70c1b184e`; it preserved historical PR #59 slice evidence and made no runtime, deployment, hosted Supabase, Firebase, Auth, data, or Production change.
- **Verified current fact:** PR #65 was merged as commit `f515335` and synchronized the authoritative baseline after PR #64; it made no SQL, runtime, hosted Supabase, Firebase, Auth, data, or Production change.
- **Verified current fact:** PR #66 was merged as commit `11f78fa` and added the Supplier-location product/data contract; it made no SQL, data, Firebase, hosted Supabase, or Production change.
- **Verified current fact:** PR #67 was merged as commit `459555b` and selected the empty local `public.supplier_locations` foundation as the sixth SQL slice; it made no SQL or data change.
- **Verified current fact:** PR #68 was merged as commit `95b31b11d6c5509dd7aedfc6b53a296ead2dd2ae`; its reviewed head `b72c9d286c8eaef5323ecbe98963512ea3b67369` added exactly `public.supplier_locations` plus focused synthetic pgTAP as the sixth local SQL slice.
- **Verified current fact:** PR #69 was merged as commit `204834f` and recorded the seventh-slice hard stop. It selected no SQL because `supplier_category_assignments` still lacks its separately approved contract, mapping artifacts, lifecycle/enforcement boundary, and exact DDL/test selection.
- **Verified current fact:** PR #70 was merged as commit `c19362b114c5ff79430e1c73b59552f41de2a02c` and added a deterministic disposable-container runner for all tracked local migrations and pgTAP files. It made no SQL-schema, Firebase, hosted Supabase, Production-data, or deployment change.
- **Verified current fact:** PR #71 was merged as commit `a28229a6171c5ab7f13dd2c06fbbef769726b82b` and synchronized the authoritative migration baseline after PR #70. It made no SQL-schema, Firebase, hosted Supabase, Production-data, or deployment change.
- **Verified current fact:** PR #72 was merged as commit `f4e68d779307607032596daccd66f46f07e450e1` and approved the Supplier-category assignment contract and one-table seventh-slice selection. It made no SQL, data, Firebase, hosted Supabase, or Production change.
- **Verified current fact:** PR #73 was merged as current `main` commit `cb51da7267f3fa61af9d35ade66890f096f2c51a`; its reviewed head `74d412d04ca480c01aa04b18576114d83a34e786` added exactly the empty local-only `public.supplier_category_assignments` foundation plus focused synthetic pgTAP as the seventh local SQL slice.
- **Verified current fact:** PR #74 was merged as commit `38c22030205493ce561c13f748dc5a6bc9a265ee` and approved the Supplier-capability contract and capability-only eighth-slice selection while deferring Supplier payment options. It made no SQL, data, Firebase, hosted Supabase, or Production change.
- **Verified current fact:** PR #75 was merged as current `main` commit `25536e09d84adac950023e5903c855cbf847b236`; its reviewed head `ce1f76ee2173616a3694b5ee373c64f7d23e13ee` added exactly the empty local-only `public.supplier_capabilities` foundation plus focused synthetic pgTAP as the eighth local SQL slice.
- **Verified current fact:** PR #76 was merged as current `main` commit `f9a09061305b99929b598ba34581629f1178b5e5`; it synchronized and preserved the post-PR75 canonical 14 physical / 12 implemented / 24 deferred baseline and made no SQL, data, Firebase, hosted Supabase, Production/TEST, or deployment change.
- **Verified current fact:** PR #77 was merged as current `main` commit `52d81cf19102b07c1aa378ac7b3548e3f11822a6`; it approved the Supplier payment-options contract and selected the empty local-only foundation as the proposed ninth SQL slice, but made no SQL, data, Firebase, hosted Supabase, Production/TEST, or deployment change.
- **Verified current fact:** PR #78 was merged as commit `0640d640e52b743929d4b4b7bedcd1e496ca133c`; its reviewed head `775475451d5f19b130ba60f56299c49c49aeb33c` added exactly the empty local-only `public.supplier_payment_options` foundation plus focused synthetic pgTAP as the ninth local SQL slice.
- **Verified current fact:** PR #79 was merged as commit `1b3c7787fe4ccda7f48c84b037d6f929c4567dd8`; it approved the Supplier Contacts product/data/security/privacy contract and proposed tenth-slice boundary without SQL or data work.
- **Verified current fact:** PR #80 was merged as current `main` commit `1849d12dc52ca99f215fd90762948a67b95117c9`; its reviewed head `6dcb6a6b4ba8052b17e47d8964df334869c257eb` added exactly the empty, revoked, local-only `public.supplier_contacts` foundation, the approved supporting location uniqueness object, and focused synthetic pgTAP as the tenth local SQL slice.
- **Verified current fact:** PR #81 was merged as commit `b1afb5a92d2b2e6f1182076c900a8947e049ebf3`; it resolved REL-001 for the owner-approved Option D planning decision, selected no SQL slice, and made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, or deployment change.
- **Verified current fact:** PR #82 was merged as current `main` commit `66698525e6aaba4522f9bef44adef57a05f4a067`; it resolved SUP-001, approved the design-only `supplier_ownership.decide_claim` contract, and selected one empty revoked `public.supplier_ownerships` foundation for separate local SQL implementation. It made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, or deployment change.
- **Verified current fact:** PR #83 was merged as commit `90ce9597544eb06ed06760ef06fa8a4d200ffa5f`; its approved head `c08aaf6bf789f48feae3752415a76e75b1346338` resolved ID-001 for the approved Firebase-authoritative hybrid identity contract and selected `public.platform_role_assignments` as the next identity/access structural SQL candidate. It made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, or deployment change.
- **Verified current fact:** PR #85 was merged as current `main` commit `22da8db4433c4fe7ca90ebe3b776a4da0a86eef2`; its reviewed head `65602572ff30faff0772d833f68e2e9d8237a099` added exactly the empty, fully revoked, local-only `public.supplier_ownerships` foundation plus focused synthetic pgTAP as the eleventh local SQL slice.
- **Verified current fact:** PR #86 was merged as commit `55034f9368b385588bd639d371be7d06a0cfb2e2`; it approved the complete Platform Role Assignments Product/Security/Data contract and selected one empty, fully revoked, local-only `public.platform_role_assignments` table for separate SQL implementation. It made no SQL, role-row, bootstrap, Auth/RLS/runtime, hosted, data, or Production change.
- **Verified current fact:** PR #87 was merged as commit `f1ff3ddbd579d38c5be49a2901b8464b46b875d4`; its reviewed head `83a9df45203cb18ab8af1a6b8bc648ce9e870224` added exactly the empty, fully revoked, local-only `public.platform_role_assignments` foundation plus focused synthetic pgTAP as the twelfth local SQL slice.
- **Verified current fact:** PR #88 was merged as current `main` commit `7ca5145eaba2859e5d6b1bb30e4b595ac688dfbd`; its reviewed head `ccba2463beab11276be651ba14253e34e272a403` ignores repository-local `.worktrees/` and made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, or deployment change.
- **Verified current fact:** PR #89 was merged as commit `703092761de57e51c35d63ee6d80742c51c4721d`; its approved head `e32da8b3f4ba600ee25d7e40a494e02d78a937b8` added the AUD-001 audit-evidence and trusted-mutation contract only, resolved AUD-001, selected exactly one empty, fully revoked, local-only `internal.audit_logs` table as the separate thirteenth SQL slice, and made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, or deployment change.
- **Verified current fact:** PR #90 was merged before current `main` and synchronized the AUD-001 approval for the separately selected thirteenth local SQL slice; it made no runtime, Firebase, hosted Supabase, Production/TEST, data, or deployment change.
- **Verified current fact:** PR #91 is merged as commit `1eab9b78b9e9d420ac486138db4c285f24c9fee7`; its approved implementation added exactly the empty, fully revoked, local-only `internal.audit_logs` foundation plus focused synthetic pgTAP as the thirteenth local SQL slice. It added no real audit rows, trusted-command runtime, retention job, RLS/client access, hosted operation, Firebase access, Production/TEST data behavior, or deployment.
- **Verified current fact:** PR #93 is merged as commit `877317a7871e72925dcc5278f3d364d3e6994aa5`; it resolves SEARCH-001 for owner-approved Option A architecture only and selects no search implementation slice. It made no SQL, extension, index, projection, RPC, RLS, frontend, AI, hosted, data, runtime, Firebase, Production/TEST, or deployment change.
- **Verified current fact:** PR #92 is merged as current `main` commit `b76888f0d2d8a769ba67bbaa70199ca458f13f87`; it resolves RFQ-003 for the owner-approved Option B commercial-semantics contract and selects no RFQ/quotation or amount-bearing implementation slice. It made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, migration, or deployment change.
- **Verified current fact:** The fourth through thirteenth SQL slices remain local-only and synthetic-data-only; no RLS, Auth bridge, hosted Supabase operation, Firebase access, Production/TEST data operation, data migration, seed, backfill, deployment, or remote SQL occurred.
- The third SQL slice remains local-only and synthetic-data-only; no RLS, Auth bridge, hosted Supabase, deployment, Production data, migration, seed, or backfill occurred.
- The second SQL slice remains local-only and synthetic-data-only; no RLS, policies, grants, Auth bridge, role assignments, data migration, seed, backfill, hosted Supabase operation, Firebase change, Production/TEST data change, or deployment occurred.
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

PR #54 validated the third local SQL slice on its exact merged head. PR #51 validated the second local SQL slice on its exact corrected head. PR #47 validated the first local SQL slice on its exact approved head. PR #45 validated the schema-design documentation on its exact reviewed head. PR #43 repeated the repository test and build checks and validated the local Supabase foundation on its exact head. PR #40 remains the latest known evidence for the Firestore Emulator, Functions Emulator, Firebase Production-bundle, and Functions build suites.

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
- **Verified current fact, PR #51 corrected-head evidence (`a56ed15097a39cb36feebcc2e9e604e7b34aeb57`):** Focused synthetic pgTAP passed **78/78**, complete local pgTAP passed **138/138**, repository tests passed **181/181**, and the Production application build passed.
- **Verified current fact, PR #54 merged-head evidence:** Focused synthetic pgTAP passed **84/84**, complete local pgTAP passed **222/222**, repository tests passed **181/181**, and the Production application build passed.
- **Verified current fact, PR #47 exact-head evidence:** GitHub PR gate run `30856547810` passed. This check result is separate from the local PostgreSQL, pgTAP, repository-test, and build evidence above.
- **Verified current fact:** Current `main` tracks eleven local SQL migrations and eleven focused pgTAP files. Their declared plans are **60**, **78**, **84**, **118**, **85**, **56**, **54**, **62**, **67**, **47**, and **44** assertions respectively (**755 planned assertions**); this static planned total is not a claim that a new combined run was executed for this baseline update.
- **Verified current fact:** GitHub PR #73 verification run `31118132318` passed on the reviewed implementation head. This does not constitute Firebase, hosted Supabase, Production-data, or deployment evidence.
- **Verified current fact:** GitHub PR #85 verification run `31259633384` passed on reviewed implementation head `65602572ff30faff0772d833f68e2e9d8237a099`. This does not constitute Firebase, hosted Supabase, Production-data, or deployment evidence.
- **Verified current fact:** PR #70 added `npm run test:supabase:sql`, which applies every tracked migration in filename order and runs every tracked pgTAP file in an isolated disposable PostgreSQL `17.6` container with no published host ports. The runner does not link or contact hosted Supabase, Firebase, or Production.

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
- **Verified current fact:** No hosted Supabase implementation or linkage exists. No hosted project was authenticated, accessed, queried, changed, or independently verified through this repository work, and the merged SQL migrations have not been applied remotely.
- **Verified current fact:** GitHub `main` contains the first local migration-control SQL slice: migration `supabase/migrations/20260804000136_migration_control_foundation.sql` creates six governance tables in the non-exposed `internal` schema, and `supabase/tests/migration_control_foundation.sql` supplies repository-tracked synthetic pgTAP coverage.
- **Verified current fact:** GitHub `main` contains thirteen local identity/business/application/audit tables: `public.user_profiles`, `public.platform_role_assignments`, `public.supplier_profiles`, `public.categories`, `public.administrative_areas`, `public.supplier_locations`, `public.supplier_category_assignments`, `public.supplier_capabilities`, `public.supplier_payment_options`, `public.supplier_contacts`, `public.supplier_ownerships`, non-exposed `internal.identity_provider_links`, and non-exposed `internal.audit_logs`. No real platform-role or audit rows, RLS, Auth bridge, Supabase Auth users, Storage buckets, Edge Functions, `supabase-js` frontend integration, or Migration Engine runtime exists.
- **Verified current fact:** No browser integration, API policy, application grant, hosted Supabase project link, or remote migration application exists.
- **Verified current fact:** Firebase Production remains unchanged and authoritative for the live application. No Firebase or Production data was migrated, exported, seeded, backfilled, or changed by PR #47, PR #48, PR #49, PR #51, PR #54, PR #59, PR #61, PR #62, PR #64, PR #65, PR #66, PR #67, PR #68, PR #69, PR #70, PR #71, PR #72, PR #73, PR #74, PR #75, PR #76, PR #77, PR #78, PR #79, PR #80, PR #81, PR #82, PR #83, PR #85, PR #86, PR #87, PR #88, PR #89, PR #90, PR #91, or PR #93.

The merged local infrastructure and migration-governance SQL, a future business/application schema, any hosted Supabase project, and Firebase Production are separate states. Supabase is not currently a Production authority.

### PostgreSQL schema-design state

- **Verified current fact:** The authoritative logical PostgreSQL schema design and its first local migration-control/traceability slice are merged; 13 tracked local SQL migrations implement the second local identity, third local Supplier-profile, fourth local category, fifth local administrative-area, sixth local Supplier-location, seventh local Supplier-category assignment, eighth local Supplier-capability, ninth local Supplier-payment-option, tenth local Supplier-contact, eleventh local Supplier-ownership, twelfth local platform-role-assignment, and thirteenth local audit-log slices, while the remaining business/application schema remains unimplemented.
- **Verified current fact:** The design classifies 79 logical concepts: 36 Core Phase 1, 10 Core Later, 13 Future-Compatible, 13 Deferred, and 7 Remove/Merge.
- **Verified current fact:** Of the 36 Core Phase 1 concepts, 17 are implemented locally and 19 remain deferred. The first 4 logical concepts use 6 physical tables because `migration_record_mappings` is decomposed across 3 relations; the local SQL foundation has 19 physical tables.
- **Verified current fact:** The approved second slice is exactly `public.user_profiles` and `internal.identity_provider_links`. `public.platform_role_assignments` was deferred at that checkpoint and was later implemented separately by merged PR #87; all access/trial ledger tables and the other remaining Core Phase 1 concepts remain deferred.
- **Verified current fact:** Core Phase 1 remains a maximum candidate set, not approval to create all 36 concepts in one PR. PR #51 implemented the approved two-table identity boundary, PR #54 implemented only the separately bounded `supplier_profiles` local root, PR #59 implemented only `categories`, PR #62 implemented only `administrative_areas`, and PR #68 implemented only `supplier_locations`.
- **Verified current fact:** The design maps all 35 verified Firestore collections, registers 36 synchronized decisions, and provides a 119-item schema review checklist. DB-001 is resolved for the local first slice to database-generated UUIDv4 through `pg_catalog.gen_random_uuid()`; hosted compatibility remains a later validation gate.
- **Verified current fact:** MIG-001 is partially implemented only at the declarative schema-contract level. Migration Engine locking, replay lookup, transformation, reconciliation, graph supersession, and rollback execution remain unimplemented.
- **Verified current fact:** ID-001 is Resolved for the approved hybrid identity-authority and privileged-actor contract, AUD-001 is Resolved for the approved audit-evidence and trusted-mutation contract, SEARCH-001 is Resolved for the owner-approved PostgreSQL Option A technology contract, RFQ-003 is Resolved for the owner-approved Option B commercial semantics contract, and MSG-003 is Resolved for the owner-approved Option C notification contract. These approvals authorize no search, RFQ/quotation, notification, event, or idempotency SQL/runtime implementation. Exactly 7 approval gates remain Open.

#### Merged second-slice boundary

PR #51 created exactly:

- `public.user_profiles`;
- `internal.identity_provider_links`.

The merged second slice remains local-only and synthetic-data-only, without RLS, policies, grants, browser/API privileges, Auth bridge, application integration, Firebase or Production data access, hosted Supabase linking, remote SQL, or deployment. `platform_role_assignments` was deferred at that checkpoint; merged PR #87 later created only its empty, fully revoked, local-only structural foundation with no real role rows or authority.

#### Open approval gates

The 7 remaining Open approval gates are:

- `ORG-001`
- `ORG-002`
- `MSG-002`
- `FILE-001`
- `BILL-001`
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

### Current architecture checkpoint

**MSG-003 Option C is approved; the REL foundation is eligible for a separate structural selection; no notification or REL SQL/runtime exists**

Merged PR #91 implemented exactly the approved empty, fully revoked, local-only `internal.audit_logs` thirteenth slice plus focused synthetic pgTAP. Current `main` therefore contains 13 tracked local SQL migrations and 19 physical tables representing 17 implemented Core Phase 1 concepts; 19 remain deferred. On 9 August 2026, the Technical/Data Owner approved [`37_SEARCH_001_POSTGRESQL_SEARCH_TECHNOLOGY_CONTRACT_REVIEW.md`](../supabase-migration/37_SEARCH_001_POSTGRESQL_SEARCH_TECHNOLOGY_CONTRACT_REVIEW.md) Option A: relational filters plus bilingual PostgreSQL FTS first, with no initial `pg_trgm` and no external Phase 1 search service. SEARCH-001 is Resolved for architecture only; no search SQL, extension, index, projection, RPC, RLS, frontend, AI, hosted, data, or runtime work is selected or authorized.

On 9 August 2026, the Product/Finance Owner approved [`38_RFQ_003_PRICE_CURRENCY_TAX_FREIGHT_CONTRACT_REVIEW.md`](../supabase-migration/38_RFQ_003_PRICE_CURRENCY_TAX_FREIGHT_CONTRACT_REVIEW.md) Option B. RFQ-003 is Resolved for explicit normalized new-quotation semantics and legacy ambiguity quarantine. No RFQ or quotation PostgreSQL table, amount-bearing SQL slice, trusted command, RLS, frontend, migration/data transformation, award, FX, hosted, Firebase, Production/TEST, or runtime work has been selected, implemented, or authorized by this approval.

On 9 August 2026, the Product/Security/Data/Privacy Owner approved [`39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md`](../supabase-migration/39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md) Option C. MSG-003 is Resolved for one future Supabase authority path from trusted domain command to immutable domain event to exactly one notification materializer and an immutable safe bilingual `in_app` snapshot. The contract fixes claimant-only Claim v1 approved/rejected/superseded notices, provider-neutral self-only recipients, controlled targets, nullable `read_at`, class-based lifecycle, migration fan-out suppression, and deterministic event/recipient/channel uniqueness. No `notifications` table, notification row, worker, command, RLS/Auth, Firebase, hosted, data, migration, or runtime work exists or is authorized.

REL-001 remains historically Resolved for owner-approved Option D in [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](../supabase-migration/31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md). Approved MSG-003 now satisfies Option D's producer/consumer revisit condition through `supplier_ownership.decide_claim` and one Claim-decision notification materializer. The coherent pair `internal.idempotency_keys` plus `internal.domain_events` is therefore eligible for a separate empty, fully revoked, local-only structural SQL/pgTAP selection, but neither table is selected or implemented yet. Exact SQL, operations, retention, runtime, security, hosted, and migration approvals remain separate; no SQL, row, worker, notification, RLS/Auth, Firebase, hosted, Production/TEST, migration, or deployment work is authorized.

The Product/Data/Security Owner approved [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](../supabase-migration/32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md) on 8 August 2026. SUP-001 is Resolved for one active primary human controller per Supplier, multiple Suppliers per user, future delegate/admin memberships, separate optional organizations, unowned-Supplier-only ordinary Claims, immutable evidence/history, fail-closed conflict handling, and the design-only `supplier_ownership.decide_claim` contract. Merged PR #85 later implemented only its selected empty, fully revoked, local-only `public.supplier_ownerships` foundation; real rows and runtime remain unauthorized.

[`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](../supabase-migration/33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) records the Owner-approved Firebase-authoritative hybrid identity and privileged-actor contract. ID-001 is Resolved; `public.user_profiles` plus `internal.identity_provider_links` are the approved provider-neutral identity foundation; and one empty, fully revoked, local-only `public.platform_role_assignments` foundation is selected as the next identity/access structural SQL candidate. The approval authorizes no SQL, role population, Auth/RLS/runtime, data, hosted, or Production work.

The Product/Security/Data Owner approved [`34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md`](../supabase-migration/34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) on 8 August 2026. The complete contract fixes exactly `owner|admin`, excludes `reviewer` as a platform role, preserves one-effective-role cardinality and temporal provenance, and approves a future protected bootstrap of at least two usable Owners. Merged PR #87 later implemented only its selected empty, fully revoked, local-only `public.platform_role_assignments` foundation; no real role rows, bootstrap, Auth/RLS/runtime, hosted, or Production work is authorized.

The Product/Security/Data Owner approved [`35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md`](../supabase-migration/35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md) on 8 August 2026. AUD-001 is Resolved for the minimum append-only, minimized, trusted-command-only audit boundary; exactly one empty, fully revoked, local-only `internal.audit_logs` table is selected as the next SQL slice independently of REL-001. Exact legal/operational retention periods, holds, purge/privacy rules, registries, access, enforcement, and runtime remain later decisions or implementation gates and do not block the empty foundation. No SQL, audit rows, trusted command, retention job, RLS/grant, reliability/notification runtime, hosted operation, or Production/TEST action is authorized.

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
