# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-08-19-package-d-d1-readiness`
Updated: 2026-08-19
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
- **Verified current fact:** Current GitHub `main`: `1c9b49ef74a92ccc652a65e30ef8b2f57bb44216`, the manual merge of PR #149. PR #149 completed D6 Package D synchronization. PR #148's D4 merge `852ec65370698d667b59d9d9cc4a7c8caef4377e` and approved implementation head `5d8834f30535b5de74bb3ec80cc70110576287fe` remain ancestors; D1-D6 are complete and D7 `supplier_directory` Firebase adapter readiness is the current bounded task.
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
- **Verified current fact:** PR #92 is merged as commit `b76888f0d2d8a769ba67bbaa70199ca458f13f87`; it resolves RFQ-003 for the owner-approved Option B commercial-semantics contract and selects no RFQ/quotation or amount-bearing implementation slice. It made no SQL, runtime, Firebase, hosted Supabase, Production/TEST, data, migration, or deployment change.
- **Verified current fact:** PR #94 is merged as commit `f5ee83096851991de680183c072b16987cb8784f`; it synchronized the Owner-approved MSG-003 Option C contract and REL eligibility without SQL, runtime, data, or deployment work.
- **Verified current fact:** PR #95 is merged as commit `8dcf556aea1460dd4ed9510854a644225ee0ad3a`; it added exactly the empty, fully revoked, local-only `internal.idempotency_keys` and `internal.domain_events` foundation plus focused synthetic pgTAP as the fourteenth local SQL slice. It added no real rows, trusted-command/event worker runtime, notification runtime, RLS/Auth bridge, hosted operation, Firebase access, Production/TEST data behavior, migration, or deployment.
- **Verified current fact:** PR #96 is merged as commit `51423a5e288b5318a94a5910daa29457195580a7`; it approved Claim Option A and exactly one future private `public.supplier_ownership_claims` aggregate with one durable write-once reviewer. PR #96 was approval-only; PR #99 later implemented the structural table, while runtime remains absent.
- **Verified current fact:** PR #98 is merged as commit `157c1615ec222ee088b97095fe69eb26c3c45064`; its local Auth bridge POC passed technical-feasibility checks with synthetic Firebase Auth Emulator identities and a disposable PostgreSQL database only. It did not prove signed-token, hosted driver/pool/pooler, staging, or Production behavior and implemented no Auth bridge runtime, role, RLS, policy, grant, Claim command, hosted operation, or data change.
- **Verified current fact:** PR #99 is merged as commit `f5b34a51576d505b268e6a5e31ca1f6eb8c539b1`; it added exactly the empty, fully revoked, local-only `public.supplier_ownership_claims` foundation plus focused pgTAP as the fifteenth local SQL slice. The table is client-inaccessible and non-authoritative; PR #99 added no RLS or policy, application grant, dedicated runtime role, trusted Claim or reviewer-assignment command, Claim row, Auth bridge runtime, notification runtime, hosted operation, Firebase change, Production/TEST data operation, migration execution, or deployment.
- **Verified current fact:** PR #101 is merged as commit `6544b16927b6a404ca4f7c3218993f26067e06c7`; it added the sixteenth local-only migration with dedicated `NOLOGIN NOINHERIT` `mujahiz_claim_runtime`, non-exposed `claim_security`, and transaction-local invoker principal setter/accessor routines. It added no RLS policy, trusted command, browser/application grant, complete Auth bridge runtime, real row, notification runtime, hosted operation, Firebase/Production/TEST access, data movement, or deployment.
- **Verified current fact:** PR #102 remains the seventeenth local-only Claimant self-read slice; PR #103 implemented local `supplier_claim.submit`; PR #108 recorded the merged red-team review findings; PR #109 corrected M-1 replay binding, M-2 same-pair race classification, and M-3 durable reservation/fence behavior; and PR #110 implemented local `supplier_claim.withdraw` in the twentieth local-only migration.
- **Verified current fact:** PR #110 adds no table, Claim mutation RLS policy, notification, hosted Supabase capability, Firebase integration, real row, seed, backfill, remote migration, or deployment. Current local structure has exactly three Claim SELECT RLS policies, zero Claim mutation RLS policies, and all four implemented Claim mutation commands use durable Phase-A reservation plus separately fenced Phase-B execution.
- **Verified current fact:** PR #113 merged the empty, fully revoked, local-only `public.access_grants` foundation. Exact evidence: 50/50 focused assertions, 21 migrations, 21 pgTAP files, 1,399/1,399 full assertions, 23 physical tables, 21 implemented and 16 unimplemented Core Phase 1 concepts, zero access rows, zero access policies, exactly one Claim policy, and no Firebase/hosted/Production impact.
- **Verified current fact:** PR #116 implemented the bounded local `claim_security.current_privileged_actor_v1()` resolver. Its exact-head evidence is 112/112 focused pgTAP assertions, a passed reused-backend transaction/context/no-cache harness, and 1,570/1,570 assertions in the full local SQL validator. It added no table or logical concept.
- **Verified current fact:** PR #114 merged the empty, fully revoked, local-only `internal.security_eligibility_assessments` foundation. Its reviewed head was `7c353f7919398fe5ea251b36eef2666dfd1e5071`; exact evidence: 59/59 focused assertions, 22 migrations, 22 pgTAP files, 1,458/1,458 full assertions, 24 physical tables, 22 implemented and 15 unimplemented Core Phase 1 concepts, zero access/security rows, zero security policies/triggers/resolvers, exactly one Claim policy, and zero Claim mutation policies.
- **Verified current fact:** The relational privileged foundations are implemented locally: identity/profile/link structure, platform-role structure, role-backed administration-access structure, security-eligibility assessment structure, and the current-principal resolver. The resolver provides relational eligibility only; it does not create usable Owner/Admin authority, Firebase authentication, gateway authorization, bootstrap, Reviewer access, hosted authority, or Production state.
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
- **Verified current fact, PR #43 exact-head evidence (`443f48abe5607ecbf731b25542293f028e6afa99`):**
`npm ci` passed.
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
- **Verified current fact:** Current origin/main tracks 30 local SQL migrations and 30 pgTAP files, with 24 physical PostgreSQL tables, 80 logical concepts, 37 Core Phase 1 concepts, 22 implemented and 15 unimplemented Core Phase 1 concepts. The final Claim policy inventory is exactly 7 SELECT, 1 INSERT, 2 UPDATE, and 0 DELETE policies: three pre-existing audience/read SELECT policies, four B4 technical-owner SELECT policies, and three technical-owner mutation policies consisting of 1 INSERT and 2 UPDATE. There are zero browser/application Claim mutation policies.
- **Latest known historical fact:** PR #109 exact-head validation passed **1,248/1,248** assertions; its focused hotfix suite passed **67/67** and its true multi-session concurrency harness passed **34/34** in disposable local PostgreSQL. These are PR #109-specific local synthetic results, not current-main totals and not hosted or Production evidence.
- **Verified current fact:** GitHub PR #73 verification run `31118132318` passed on the reviewed implementation head. This does not constitute Firebase, hosted Supabase, Production-data, or deployment evidence.
- **Verified current fact:** GitHub PR #85 verification run `31259633384` passed on reviewed implementation head `65602572ff30faff0772d833f68e2e9d8237a099`. This does not constitute Firebase, hosted Supabase, Production-data, or deployment evidence.
- **Verified current fact:** PR #70 added
`npm run test:supabase:sql`, which applies every tracked migration in filename order and runs every tracked pgTAP file in an isolated disposable PostgreSQL `17.6` container with no published host ports. The runner does not link or contact hosted Supabase, Firebase, or Production.

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
- **Verified current fact:** GitHub `main` contains sixteen local identity/business/application/audit/reliability tables: `public.user_profiles`, `public.platform_role_assignments`, `public.supplier_profiles`, `public.categories`, `public.administrative_areas`, `public.supplier_locations`, `public.supplier_category_assignments`, `public.supplier_capabilities`, `public.supplier_payment_options`, `public.supplier_contacts`, `public.supplier_ownerships`, `public.supplier_ownership_claims`, non-exposed `internal.identity_provider_links`, `internal.audit_logs`, `internal.idempotency_keys`, and `internal.domain_events`. The migration state contains no real Claim, platform-role, audit, idempotency, or event rows. Exactly three Claim SELECT RLS policies, six Claim-v1 trusted commands, dedicated local roles, and non-exposed `claim_security` helpers exist with bounded local grants. No complete Auth bridge runtime, Supabase Auth users, Storage buckets, Edge Functions, `supabase-js` frontend integration, Migration Engine runtime, browser authority, hosted authority, or Production authority exists.
- **Verified current fact:** No browser integration, API policy, application grant, hosted Supabase project link, or remote migration application exists.
- **Verified current fact:** Firebase Production remains unchanged and authoritative for the live application. No Firebase or Production data was migrated, exported, seeded, backfilled, or changed by PR #47, PR #48, PR #49, PR #51, PR #54, PR #59, PR #61, PR #62, PR #64, PR #65, PR #66, PR #67, PR #68, PR #69, PR #70, PR #71, PR #72, PR #73, PR #74, PR #75, PR #76, PR #77, PR #78, PR #79, PR #80, PR #81, PR #82, PR #83, PR #85, PR #86, PR #87, PR #88, PR #89, PR #90, PR #91, PR #93, PR #94, or PR #95, PR #96, PR #98, or PR #99, or PR #101, or PR #102.

The merged local infrastructure and migration-governance SQL, a future business/application schema, any hosted Supabase project, and Firebase Production are separate states. Supabase is not currently a Production authority.

### PostgreSQL schema-design state

- **Verified current fact:** The authoritative logical PostgreSQL schema design and local migration slices are merged; 29 tracked local SQL migrations implement through the post-#135 Expire slice, while remaining business/application schema and runtime remain unimplemented.
- **Approved catalog fact:** The design classifies 80 logical concepts: 37 Core Phase 1, 10 Core Later, 13 Future-Compatible, 13 Deferred, and 7 Remove/Merge. `internal.security_eligibility_assessments` is the one added Core Phase 1 concept; it is distinct from deferred event-history concept `security_events`.
- **Verified implementation fact:** Of the 37 Core Phase 1 concepts, 22 are implemented locally and 15 remain unimplemented. The first 4 logical concepts use 6 physical tables because `migration_record_mappings` is decomposed across 3 relations; the local SQL foundation now has 24 physical tables, 29 migrations, and 29 pgTAP files. The Reviewer Private-Read Substrate and trusted-command slices add no table or logical concept.
- **Verified current fact:** The approved second slice is exactly `public.user_profiles` and `internal.identity_provider_links`. `public.platform_role_assignments` was deferred at that checkpoint and was later implemented separately by merged PR #87; all access/trial ledger tables and the other remaining Core Phase 1 concepts remain deferred.
- **Verified current fact:** Core Phase 1 remains a maximum candidate set, not approval to create all 37 concepts in one PR. PR #51 implemented the approved two-table identity boundary, PR #54 implemented only the separately bounded `supplier_profiles` local root, PR #59 implemented only `categories`, PR #62 implemented only `administrative_areas`, and PR #68 implemented only `supplier_locations`.
- **Verified current fact:** The design maps all 35 verified Firestore collections, registers 37 synchronized decisions, and provides a 119-item schema review checklist. DB-001 is resolved for the local first slice to database-generated UUIDv4 through `pg_catalog.gen_random_uuid()`; hosted compatibility remains a later validation gate.
- **Verified current fact:** MIG-001 is partially implemented only at the declarative schema-contract level. Migration Engine locking, replay lookup, transformation, reconciliation, graph supersession, and rollback execution remain unimplemented.
- **Historical pre-PR #135 implementation summary:** ID-001 was Resolved for the approved hybrid identity-authority and privileged-actor contract, AUD-001 was Resolved for the approved audit-evidence and trusted-mutation contract, SEARCH-001 is Resolved for the owner-approved PostgreSQL Option A technology contract, RFQ-003 is Resolved for the owner-approved Option B commercial semantics contract, MSG-003 is Resolved for the owner-approved Option C notification contract, REL-001's coherent two-table foundation is implemented locally, and SEC-001 is Resolved for Owner-approved Claim-v1 architecture. PRs #113/#114 implemented only the two selected inert access/security structural prerequisites. PR #116 added the bounded current-principal privileged-actor helper, PR #117 synchronized that state, PR #118 added the bounded local target-Supplier conflict helper, and PR #120 added the Reviewer Private-Read Substrate. The empty Claim foundation, local identity context, local `supplier_claim.submit`, local `supplier_claim.withdraw`, local `supplier_claim.assign_reviewer`, and local `supplier_claim.reject` exist; exactly four of six approved Claim business mutations are implemented. `supplier_claim.approve` and `supplier_claim.expire` remain unimplemented. Gateway/HMAC/pool, access/security administration, and Production authority remain absent. Exactly 7 approval gates remain Open.

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

**Implemented locally: all six Claim-v1 external commands (`supplier_claim.submit`, `supplier_claim.assign_reviewer`, `supplier_claim.withdraw`, `supplier_claim.approve`, `supplier_claim.reject`, and `supplier_claim.expire`); access/security structural foundations; relational privileged-actor evaluators; target-Supplier conflict resolver; Reviewer Private-Read Substrate. Still absent: access/security administration runtime; real gateway; hosted/Production authority.**

Merged PR #99 implemented the empty Claim foundation; PR #101 added identity context; PR #102 added Claimant self-read FORCE RLS and one policy; PRs #103/#109 implemented and corrected local `supplier_claim.submit`; and the merged chain through PR #135 implemented the remaining five commands. Current `origin/main` contains 29 migrations, 29 pgTAP files, 24 physical tables, and 22 implemented concepts. The Owner-approved catalog contains 37 Core Phase 1 concepts, with 15 unimplemented. All six approved Claim-v1 external commands are implemented locally: `supplier_claim.submit`, `supplier_claim.assign_reviewer`, `supplier_claim.withdraw`, `supplier_claim.approve`, `supplier_claim.reject`, and `supplier_claim.expire`. Their private reserve/execute helpers remain internal Phase-A/fenced Phase-B boundaries, not additional business commands. Completed idempotency and terminal-history checks fail closed on corrupted or contradictory binding, and required command-specific audit/event/ownership effects commit atomically with their Claim transitions. This does not imply gateway, hosted Supabase, Firebase signed-token, Production, or deployment readiness. No hosted gateway or signed-token staging proof exists. Local `SECURITY DEFINER` ownership remains a local implementation boundary; dedicated non-superuser command ownership, HMAC rotation, and transaction-pool behavior remain release requirements. Historical PR #108 low findings on inert evidence URL semantics and Unicode/order/URL canonicalization remain unresolved before client activation.

On 9 August 2026, the Product/Finance Owner approved [`38_RFQ_003_PRICE_CURRENCY_TAX_FREIGHT_CONTRACT_REVIEW.md`](../supabase-migration/38_RFQ_003_PRICE_CURRENCY_TAX_FREIGHT_CONTRACT_REVIEW.md) Option B. RFQ-003 is Resolved for explicit normalized new-quotation semantics and legacy ambiguity quarantine. No RFQ or quotation PostgreSQL table, amount-bearing SQL slice, trusted command, RLS, frontend, migration/data transformation, award, FX, hosted, Firebase, Production/TEST, or runtime work has been selected, implemented, or authorized by this approval.

On 9 August 2026, the Product/Security/Data/Privacy Owner approved [`39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md`](../supabase-migration/39_MSG_003_NOTIFICATION_RETENTION_RENDERING_AND_MATERIALIZATION_CONTRACT.md) Option C. MSG-003 is Resolved for one future Supabase authority path from trusted domain command to immutable domain event to exactly one notification materializer and an immutable safe bilingual `in_app` snapshot. The contract fixes claimant-only Claim v1 approved/rejected/superseded notices, provider-neutral self-only recipients, controlled targets, nullable `read_at`, class-based lifecycle, migration fan-out suppression, and deterministic event/recipient/channel uniqueness. No `notifications` table, notification row, worker, command, RLS/Auth, Firebase, hosted, data, migration, or runtime work exists or is authorized.

REL-001 remains historically Resolved for owner-approved Option D in [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](../supabase-migration/31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md). Approved MSG-003 satisfied Option D's producer/consumer revisit condition, and merged PR #95 implemented the coherent empty, fully revoked, local-only pair `internal.idempotency_keys` plus `internal.domain_events`. No real row, trusted command, event processor/materializer, notification, RLS/Auth bridge, Firebase, hosted, Production/TEST, migration, or deployment work is implemented or authorized.

The Product/Data/Security Owner approved [`32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md`](../supabase-migration/32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md) on 8 August 2026. SUP-001 is Resolved for one active primary human controller per Supplier, multiple Suppliers per user, future delegate/admin memberships, separate optional organizations, unowned-Supplier-only ordinary Claims, immutable evidence/history, fail-closed conflict handling, and the design-only `supplier_ownership.decide_claim` contract. Merged PR #85 later implemented only its selected empty, fully revoked, local-only `public.supplier_ownerships` foundation; real rows and runtime remain unauthorized.

On 9 August 2026, the Product/Data/Security Owner approved [`41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md`](../supabase-migration/41_CLAIM_SUPPLIER_PROFILE_STRUCTURAL_AND_COMMAND_READINESS_REVIEW.md) Option A: exactly one empty, fully revoked, local-only `public.supplier_ownership_claims` table with one durable write-once assigned reviewer, no reassignment or Owner override, bounded private evidence on the Claim, and no separate evidence, reviewer, history/event, idempotency, rate-limit, attachment, file, or notification table. PR #96 recorded that approval, and PR #99 implemented only the empty structural foundation. Owner-approved [SEC-001](../supabase-migration/42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md) remains architecture-only; PR #98 remains local feasibility evidence only, [PR #101 evidence](../supabase-migration/45_CLAIM_RUNTIME_IDENTITY_CONTEXT_FOUNDATION_EVIDENCE.md) records the identity context, and [PR #102 evidence](../supabase-migration/47_CLAIM_RLS_SELF_READ_FOUNDATION_EVIDENCE.md) records the local Claimant self-read FORCE-RLS/projection substrate. The Product/Security/Data/Operations Owner approved the [Claim-v1 trusted-command contract](../supabase-migration/46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md): exactly six external commands, internal approval supersession, exact 720-hour validity, Owner-only reviewer assignment, shared idempotency/events/locks, and submit as the first later slice; PR #102 now satisfies its claimant RLS/read prerequisite. At that historical pre-implementation checkpoint, local `supplier_claim.submit`, `supplier_claim.withdraw`, `supplier_claim.assign_reviewer`, and `supplier_claim.reject` were implemented, while `supplier_claim.approve` and `supplier_claim.expire` remained unimplemented. The corrected two-phase reservation/fenced-execution protocol is local-only. FILE-001 and the other six Open gates remain unchanged.

[`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](../supabase-migration/33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) records the Owner-approved Firebase-authoritative hybrid identity and privileged-actor contract. ID-001 is Resolved; `public.user_profiles` plus `internal.identity_provider_links` are the approved provider-neutral identity foundation; and one empty, fully revoked, local-only `public.platform_role_assignments` foundation is selected as the next identity/access structural SQL candidate. The approval authorizes no SQL, role population, Auth/RLS/runtime, data, hosted, or Production work.

The Product/Security/Data Owner approved [`34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md`](../supabase-migration/34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) on 8 August 2026. The complete contract fixes exactly `owner|admin`, excludes `reviewer` as a platform role, preserves one-effective-role cardinality and temporal provenance, and approves a future protected bootstrap of at least two usable Owners. Merged PR #87 later implemented only its selected empty, fully revoked, local-only `public.platform_role_assignments` foundation; no real role rows, bootstrap, Auth/RLS/runtime, hosted, or Production work is authorized.

The Product/Security/Data Owner approved [`35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md`](../supabase-migration/35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md) on 8 August 2026. AUD-001 is Resolved for the minimum append-only, minimized, trusted-command-only audit boundary; exactly one empty, fully revoked, local-only `internal.audit_logs` table is selected as the next SQL slice independently of REL-001. Exact legal/operational retention periods, holds, purge/privacy rules, registries, access, enforcement, and runtime remain later decisions or implementation gates and do not block the empty foundation. No SQL, audit rows, trusted command, retention job, RLS/grant, reliability/notification runtime, hosted operation, or Production/TEST action is authorized.

On 10 August 2026, the Product/Security/Data Owner approved [`55_PRIVILEGED_ACTOR_ACCESS_AND_SECURITY_ELIGIBILITY_READINESS.md`](../supabase-migration/55_PRIVILEGED_ACTOR_ACCESS_AND_SECURITY_ELIGIBILITY_READINESS.md) as the authoritative implementation prerequisite for the bounded privileged-access and security-eligibility foundations. Access Option A uses `public.access_grants` only for `platform_administration`; usable Owner access is non-expiring while its role is usable, Admin access is capped at exactly 180 calendar days with no automatic renewal, and every new or renewed Admin grant requires two distinct currently usable Owners with no self-approval. Security Option A uses separate restricted `internal.security_eligibility_assessments`; only a current supported coverage-complete `clear` plus `complete_clear` permits, systems may restrict only and never self-clear, and a human clear/release requires two distinct currently usable Owners neither of whom is the subject. Authoritative security loss overrides final-Owner availability and enters governed emergency recovery; ordinary discretionary closures cannot intentionally leave zero usable Owners and final-usable-Owner-affecting authority changes retain distinct usable-Owner review. The future bootstrap composes two Owners plus matching access plus explicit clear plus AUD-001 evidence. Audit classification is `privilege_security_authority`; no domain event is approved. PRs #113/#114 implemented the two selected empty, fully revoked, local-only structural foundations. No resolver, administration/bootstrap runtime, Reviewer substrate, gateway, hosted authority, data action, or Production change exists from these slices.

The repository has completed the local privileged foundations: identity/profile/link structure, platform-role structure, role-backed administration-access structure, security-eligibility assessment structure, `claim_security.current_privileged_actor_v1()`, private `claim_security.privileged_actor_for_profile_v1(uuid)` eligibility evaluation, and the bounded `claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)` resolver. Reviewer Private-Read Substrate includes the Owner assignment queue, reviewer candidate projection/eligibility delivery, assigned-reviewer queue/detail, and exact RLS/object grants. All six Claim-v1 external commands are implemented locally; access/security administration, gateway/hosted authorization, and Production authority remain absent. Local relational eligibility is not Firebase authentication; local conflict `clear` is not Reviewer authorization.

Historical Package C checkpoint (2026-08-18): Package B and C1–C5 were `COMPLETE`; PR #145 had merged the provider-contract kernel at `ea8e308f4b5276b04c3ecd644d7ecf27f5356a96`; and C6 post-merge Baseline/queue synchronization was the next control-plane task. That historical checkpoint was superseded when PR #146 merged C6. Current `main` is `f8dff27c69c05f567920f97e471dc4a06ed68c9b`; C6 and Package C are `COMPLETE`, and Package D is current. D1 remains a Draft readiness PR only and does not authorize adapter implementation, service rewiring, Auth changes, provider switching, Supabase capability, data work, or deployment.

### Target-Supplier conflict resolver boundary

PR #118 is implemented and validated for bounded LOCAL synthetic use only. `claim_security.target_supplier_conflict_v1(actor_user_profile_id, target_supplier_profile_id, target_claim_id)` returns exactly `clear`, `conflict`, or `unknown`; only `clear` is authorization-positive. Missing, ambiguous, contradictory, unsupported, or unreadable coverage precedes conflict evidence. Supported conflict evidence is actor=target claimant, actor=current effective active primary Supplier controller, or actor=claimant on another same-Supplier Claim in submitted/under_review. The helper is private, `SECURITY DEFINER`, locally owned by `postgres`, fixed to `search_path=pg_catalog`, read-only, and has EXECUTE denied to `PUBLIC`, `anon`, `authenticated`, `service_role`, and `mujahiz_claim_runtime`. It is not a browser/API surface, hosted authority, or authorization by itself.

The helper covers only the implemented local relational subset. supplier_memberships, Supplier admin/delegation, organizations, organization_memberships, and general recusal/conflict relations are not implemented; known future relation existence forces unknown even when empty. It does not infer relationships from email/domain, contacts, legacy organization, account context, names, provenance, Firebase/provider data, or role text. Local clear is not hosted/migrated no-conflict proof, and clear alone never authorizes Reviewer activity. Future Reviewer authorization must compose global privileged eligibility, conflict=clear, exact Claim state, trusted non-expiry, assignment/role policy, and operation-specific rules.

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


### Historical PR #122 supplier_claim.assign_reviewer synchronization

PR #122 is merged in origin/main at `a828d5b9668dc7aa517bc7769160ee372fc568a8`; its reviewed implementation head `076a1fde3e934ad5f61201a7ba56aba4cd36fb54` is an ancestor. The local implementation now has 26 tracked migrations, 26 pgTAP files, 24 physical public/internal tables, 80 logical concepts, 37 Core Phase 1 concepts, and 22 implemented / 15 unimplemented Core table concepts.

The Claim inventory is exactly three SELECT RLS policies: `supplier_ownership_claims_claimant_self_select`, `supplier_ownership_claims_owner_assignment_select`, and `supplier_ownership_claims_assigned_reviewer_select`, with zero Claim mutation policies. Exactly three of six Claim business mutations are implemented: `supplier_claim.submit`, `supplier_claim.withdraw`, and `supplier_claim.assign_reviewer`. `approve`, `reject`, and `expire` remain absent.

PR #122 preserves the Reviewer read substrate and exactly three Claim SELECT policies. The two local read-only projection roles remain `mujahiz_claim_owner_projection` and `mujahiz_claim_reviewer_projection`; local SECURITY DEFINER ownership remains a local implementation boundary, not hosted least-privilege proof.

The fixed Reviewer APIs remain `claim_api.owner_assignment_queue_v1(...)`, `claim_api.owner_reviewer_candidates_v1(...)`, `claim_api.reviewer_queue_v1(...)`, and `claim_api.reviewer_detail_v1(uuid)`. Reviewer visibility still rechecks eligibility, role, assignment, conflict, Claim state, and trusted expiry; durable assignment alone never grants access.

PR #122 exact-head evidence is recorded separately in `62_ASSIGN_REVIEWER_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`: focused replay/corruption 10/10, focused assign-reviewer pgTAP 99/99, directly affected concurrency 4/4, complete concurrency harness 22/22, full local SQL validator 26 migrations / 26 test files / 1,875/1,875 assertions / 0 failures, and PR Gate #198 success. These totals are not combined with historical Firebase or repository suites.

The exact new command boundary is `supplier_claim.assign_reviewer` v1: usable Owner assigner only; distinct usable Owner/Admin candidate; clear assigner and candidate target-Supplier conflict; write-once assignment with no reassignment or Owner override; `submitted -> under_review`; one Claim `record_version` increment; required success audit; one `claim_under_review` v1 event; no notification, ownership creation, or competitor mutation; durable Phase-A reservation plus fenced Phase-B execution; completed replay binding Claim/event/full audit state; and fail-closed corrupted durable replay with integrity reconciliation.

The next technical task is recommended as `supplier_claim.reject — Trusted Command Readiness and Implementation`, because reject is the smaller dependency-safe reviewer decision slice before approve, creates no ownership, and does not supersede competing Claims. This documentation sync does not implement reject.

The seven Open gates remain exactly ORG-001, ORG-002, MSG-002, FILE-001, BILL-001, RES-001, and MIG-002. Production impact is none: no Firebase, hosted Supabase, Production/TEST data, deployment, gateway, migration, seed, backfill, DNS, billing, Auth/config, or hosted RLS/grant action occurred.

### Historical PR #126 supplier_claim.reject synchronization

PR #126 is merged in `origin/main` at `043cd21a025c07bb265a183cae52595cef829a85`; reviewed implementation head `9d3cfef5214177b94c85a185f27d93c847468ba0` is an ancestor. Verified current counts are 27 tracked SQL migrations, 27 pgTAP files, 24 physical public/internal tables, 80 logical concepts, 37 Core Phase 1 concepts, and 22 implemented / 15 unimplemented Core table concepts.

The Claim inventory remains exactly three SELECT RLS policies (`supplier_ownership_claims_claimant_self_select`, `supplier_ownership_claims_owner_assignment_select`, and `supplier_ownership_claims_assigned_reviewer_select`) with zero Claim mutation policies. Exactly four of six Claim business mutations are implemented: `supplier_claim.submit`, `supplier_claim.withdraw`, `supplier_claim.assign_reviewer`, and `supplier_claim.reject`. `approve` and `expire` remain unimplemented.

PR #126 evidence is recorded separately in `65_REJECT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md`: focused reject pgTAP 105/105, true multi-session concurrency across 9 race scenarios with 14/14 checks, full local SQL validation 27 migrations / 27 test files / 1,978/1,978 assertions / 0 failures, and PR Gate #204 success. These totals are not combined with historical Firebase or repository suites.

Reject v1 is local-only: exact assigned usable Owner/Admin reviewer, clear conflict, coherent non-due `under_review` Claim, expected versions, `under_review -> rejected`, one record-version increment, retained assignment provenance, `reviewer_notes = NULL`, bounded non-file evidence reference/digest, durable Phase-A reservation, fenced Phase-B execution, completed replay integrity validation, one success audit, one `supplier_ownership.claim_rejected` v1 event, no notification, ownership, or competing-Claim mutation, and no mutation RLS policy. Local `SECURITY DEFINER` ownership remains `postgres`; this is not hosted least-privilege proof.

Historical PR #126 next-step recommendation: `supplier_claim.approve v1` required a separate readiness/security closure before SQL because it had to create ownership, supersede competing active Claims, preserve one-winner semantics, and produce multiple ordered effects. This historical recommendation was superseded by merged PRs #127–#135. The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`. Production/data impact is none.

### Historical PR #130 supplier_claim.approve synchronization

PR #130 is merged in GitHub `main` at `463f9805c96376be6176663b4b6264050242bd0f`; its implementation head `a1291e40018d6874960ef23e29b47b3c4ffe8b62` is an ancestor. PRs #127, #128, and #129 are also ancestors of this verified merge. The merged local SQL inventory is 28 tracked migrations and 28 pgTAP test files, with 24 physical `public`/`internal` PostgreSQL tables.

The Claim inventory remains exactly three SELECT RLS policies — `supplier_ownership_claims_claimant_self_select`, `supplier_ownership_claims_owner_assignment_select`, and `supplier_ownership_claims_assigned_reviewer_select` — with zero Claim mutation policies. Exactly five Claim v1 business commands are implemented locally: `supplier_claim.submit`, `supplier_claim.withdraw`, `supplier_claim.assign_reviewer`, `supplier_claim.reject`, and `supplier_claim.approve`. The only remaining Claim v1 command is `supplier_claim.expire`; it is separately scoped and not implementation-ready from this baseline alone.

PR #130 evidence records focused Approve validation of 187/187 assertions, true multi-session Approve concurrency of 24/24 across ten races, and the latest complete local SQL validation of 2,170/2,170 assertions across 28 migrations and 28 test files with 0 failures. These are local disposable PostgreSQL and synthetic-data results only; they are not combined with Firebase or hosted environments.

`supplier_claim.approve` is a local trusted-command implementation only. Its merged SQL is not hosted Supabase, is not deployed, is not exposed as a browser/API surface, and does not make Supabase Production-ready. Firebase remains the live Production authority, and GitHub `main` must not be described as the Firebase live runtime without separate Hosting evidence. No hosted Supabase project is linked or deployed.

No Production or TEST data migration, seed, backfill, hosted operation, remote migration, deployment, Firebase change, Auth/config change, DNS, billing, gateway, notification-delivery, or file operation occurred. Only disposable local PostgreSQL and synthetic data were used for the merged SQL work. The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

### PR #135 supplier_claim.expire synchronization

PR #135 is merged in `origin/main` at `a02adc9f5bf2db858079de84874bb917687d8c4c`; reviewed implementation head `b4d5ee23d38b99087c8de84bd315fbc253cd30a6` is an ancestor. The current local SQL inventory is 29 tracked migrations and 29 pgTAP files, with 24 physical `public`/`internal` PostgreSQL tables, 80 logical concepts, 37 Core Phase 1 concepts, and 22 implemented / 15 unimplemented Core concepts.

The Claim inventory remains exactly three SELECT RLS policies (`supplier_ownership_claims_claimant_self_select`, `supplier_ownership_claims_owner_assignment_select`, and `supplier_ownership_claims_assigned_reviewer_select`) with zero Claim mutation policies. All six Claim-v1 external business commands are implemented locally: `supplier_claim.submit`, `supplier_claim.assign_reviewer`, `supplier_claim.withdraw`, `supplier_claim.approve`, `supplier_claim.reject`, and `supplier_claim.expire`.

PR #135 evidence records focused Expire pgTAP 59/59, true-session Expire concurrency 23/23 across 12 races, and the latest complete local SQL validation of 2,229/2,229 assertions across 29 migrations and 29 pgTAP files with 0 failures. These are local disposable PostgreSQL and synthetic-data results only and are not combined with Firebase or other historical suites.

`supplier_claim.expire` is a local trusted command for a dedicated automated expiry worker. Its v1 boundary preserves Phase-A observation/idempotency and fenced Phase-B execution, binds the stored Claim expiry into the request fingerprint, uses trusted post-lock time, expires only due `submitted|under_review` Claims, preserves assignment provenance, supports replayable valid not-due observations, and fails closed on terminal-history inconsistency with `P5199 / integrity_reconciliation_required`. Real expiry emits exactly one `supplier_ownership.claim_expired` v1 event and zero ordinary success audits; it creates no notification, ownership mutation, or competing-Claim mutation and adds no Claim mutation RLS policy. The JSON-null/SQL-NULL terminal-history issue was corrected in correction loop 2.

All six commands remain local-only. Firebase remains live Production and authoritative; hosted Supabase remains unlinked, undeployed, and non-authoritative. GitHub `main` is not Firebase live runtime, local SECURITY DEFINER behavior is not hosted least-privilege proof, and local 6/6 completion is not deployment readiness. No Production/TEST data migration, seed, backfill, hosted operation, remote migration, deployment, Firebase/Auth/config/DNS/billing change, or file operation occurred. The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

### B6 post-merge Package B synchronization (2026-08-18)

PR #141 merged B4-P2 readiness and PR #142 merged B4. Read-only verification of the exact merged tree confirms:

- Claim external command surface is exactly 6/6: `supplier_claim.submit`, `supplier_claim.assign_reviewer`, `supplier_claim.withdraw`, `supplier_claim.approve`, `supplier_claim.reject`, and `supplier_claim.expire`.
- Final Claim RLS policy inventory is 7 SELECT, 1 INSERT, 2 UPDATE, and 0 DELETE. The mutation policies target isolated technical-owner roles and are not browser/application mutation policies.
- The four technical-owner roles are `mujahiz_claim_human_command_owner`, `mujahiz_claim_expiry_command_owner`, `mujahiz_claim_target_conflict_helper_owner`, and `mujahiz_claim_reviewer_prior_context_helper_owner`. The merged role asset and focused harness preserve zero membership, NOLOGIN, non-BYPASSRLS, and no-schema-CREATE boundaries where asserted.
- The merged routine ownership asset transfers 10 human-command definers and 14 expiry/history definers, plus the target-conflict and reviewer-prior-context helpers: 26 routines total. The two projection helpers remain owned by `mujahiz_claim_owner_projection` with the approved post-B4 EXECUTE boundary.
- `target_supplier_conflict_v1` uses the explicit 19-column Claim projection and no longer uses `%rowtype` or `SELECT claim.*`.
- The committed catalog model is PRE 343 tuples and POST 355 tuples. The final normalizer uses exact `search_path=pg_catalog`, catalog-bound resolution, and raw SHA-256 `5873cdab006165aa8ce4b6bf0720f4d432264ab8438dcb78e75e4ec479e2dac6`.
- Exact-head evidence is PR Gate #240 / run `32103708718` success on reviewed head `5342a54b800577894ff9a23e93316a350fa15f5f`. The merged validator configuration records 30 migrations, 30 isolated pgTAP files, and 9 post-B4 replays; the approved exact-head evidence records 3,154 passed / 0 failed local SQL assertions, 109/109 finalizer security checks, command suites Submit 67/67, Withdraw 101/101, Assign Reviewer 99/99, Approve 187/187, Reject 108/108, Expire 59/59, and true-session races Submit 34, Withdraw 41, Assign Reviewer 22, Approve 24, Reject 14, Expire 23. These are local/disposable evidence only and are not combined with Package A or Firebase suites.

Firebase remains the live Production backend/auth/database/hosting authority. GitHub `main` contains the merged B4 local code/documentation state. Hosted Supabase remains unlinked, undeployed, and non-authoritative. B4 is merged; it is not deployed, hosted, or Production RLS. No Production/data/deployment impact occurred. The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

PR #143 merged this B6 synchronization as `b7c83f512b337cf21f517548b724a1c5edf9d821`; its approved head was `ad6ca64e2a27ca358a492b084ac098bff3ff858e`, and PR Gate #242 / run `32109934587` succeeded on that exact head. Latest `origin/main` was reverified at the merge commit, so B6 and Package B are `COMPLETE`. No provider implementation, Auth change, hosted action, data action, or deployment is implied by completion.
### Historical C6 post-merge Package C synchronization (2026-08-18)

At this historical checkpoint, GitHub `main`, local `main`, and `origin/main` were verified at `ea8e308f4b5276b04c3ecd644d7ecf27f5356a96`. PR #145 merged the C4 provider-contract kernel; its approved head was `e7b0dcedcc9f09ddb810bcfd33a7da91dd9ca3a2`. PR Gate #248 succeeded, and the independent C5 exact-head review reported 0 Critical / High / Medium / Low findings with `APPROVE FOR MANUAL MERGE`.

The merged provider-contract kernel is present at `src/services/providers/providerContract.ts` with its focused test at `tests/provider-contract.test.mjs`. The closed vocabulary remains exactly 17 provider feature IDs, the shipped manifest remains explicitly all Firebase, and the resolver exposes exactly five error codes. Valid resolution returns exactly the registered implementation reference and never invokes an implementation. No application, service, or Auth runtime imports the kernel yet, and no Supabase SDK/client/adapter/config/network capability exists.

PR #145 is merged on GitHub `main` but is not deployed and is not wired into the current application runtime. Firebase remains the Production backend, Auth, database, and hosting authority. Hosted Supabase remains unlinked, undeployed, and non-authoritative. No Production or TEST data changed; no Auth, Rules, indexes, Firebase configuration, DNS, billing, migration, seed, backfill, or deployment action occurred.

C6 inspected the smallest plausible Firebase service seams. The next readiness task is uniquely selected as `D1 — user_profiles_access Firebase Adapter Readiness`, centered on the existing read-only `src/services/adminUsers.ts` facade. It is readiness only: no adapter, service rewiring, Auth change, or provider selection is included. D1 must explicitly preserve the existing `isFirebaseConfigured = false` path through `listUsers()` as current Demo/local application behavior; that path must not be reclassified as a backend provider or treated as provider fallback. `supplierWorkspace.ts` remains deferred because its Firebase write path requires an explicit ownership/security contract before adapter work.

### Historical D1 `user_profiles_access` readiness synchronization (2026-08-19)

The manual merge of PR #146 was the verified D1 base state. This paragraph preserves the historical D1 checkpoint; it was superseded by the D6 synchronization below when PR #147 and PR #148 were merged.

D1 records the exact current `user_profiles_access` contract in `74_USER_PROFILES_ACCESS_FIREBASE_ADAPTER_READINESS.md`. The current provider is Firebase and `listAdministrativeUsers()` reads the Firestore `users` collection ordered by `createdAt desc`, limited to 500, returning each document's data with `uid` set from the document ID. Missing optional fields pass through, empty results return an empty array, and Firebase errors propagate without adapter-level normalization. When `isFirebaseConfigured === false`, the service delegates to `listUsers()` as intentional Demo/local behavior.

That Demo/local path is not Firebase↔Supabase fallback, Supabase↔Firebase fallback, automatic provider failover, dual-read, or dual-write. Future adapter work must select one provider, avoid silent switching and Supabase networking while Firebase is selected, keep Demo data from masking real provider failures, and fail closed for unsupported or misconfigured provider state. D4 must test shape, ordering, limit, empty results, optional fields, Firebase errors, Demo/local behavior, unsupported/misconfigured selection, no Supabase networking under Firebase selection, and no silent fallback.

D1 is readiness only. No adapter, runtime routing, Auth, dependency, configuration, data, hosted Supabase, Firebase Production, TEST, migration, or deployment change occurred. Exact stop point: Draft D1 PR, after remediation and before the required D2 exact-head re-review, D3, or D4.

### D6 post-merge Package D synchronization (2026-08-19)

PR #149 manually merged D6 at current GitHub `main` `1c9b49ef74a92ccc652a65e30ef8b2f57bb44216`. The merged D4 implementation head remains `5d8834f30535b5de74bb3ec80cc70110576287fe`. Package D state through D6 is `COMPLETE`; D7 is the current bounded readiness task.

D4 preserves the configured path `listAdministrativeUsers() -> provider resolver for user_profiles_access -> Firebase adapter -> Firestore users`, while the explicit `isFirebaseConfigured === false -> listUsers()` path remains Demo/local application behavior. `user_profiles_access` and the shipped manifest remain Firebase-authoritative. No Supabase implementation is registered; no Supabase runtime/network capability, silent fallback, provider probing, dual-read, or dual-write was introduced.

D5 exact-head review recorded 0 Critical, 0 High, and 0 Medium findings, with one non-blocking Low composition-coupling observation and one non-blocking Nit about an unused type-only `AppUser` import. Separated validation evidence is: D4 focused 6/6; provider contract 8/8; Firebase runtime/provider policy 4/4; Demo/runtime policy 6/6; full repository unit gate 195/195 across 33 test files; TypeScript build passed; Vite production build passed; and PR Gate #254 passed on the exact D4 head. These categories are not combined.

GitHub `main` contains D4 code, but Firebase Production was not deployed by PR #148. Firebase remains the live Production backend/Auth/database/hosting authority; GitHub `main` and live Firebase must not be assumed identical. Supabase remains local-only, unlinked, and undeployed. No migration, seed, backfill, RLS/Auth bridge, data copy, cutover, Production/TEST data action, configuration change, or deployment occurred. The seven Open gates remain `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

The next bounded Package D task selected by D6 was `D7 — supplier_directory Firebase Adapter Readiness`, based on the existing read seams in `src/services/firestore.ts`. `supplierWorkspace.ts` remains deferred because its Firebase path is write-heavy and requires an explicit ownership/security contract. Auth, RLS, migration, hosted Supabase, provider cutover, and other write-heavy work remain deferred.

### D7 `supplier_directory` Firebase adapter readiness (2026-08-19)

D7 started from clean `origin/main` `1c9b49ef74a92ccc652a65e30ef8b2f57bb44216` and defines the readiness contract in `75_SUPPLIER_DIRECTORY_FIREBASE_ADAPTER_READINESS.md`. The selected read-only seam is exactly `listSuppliers()`, `listSuppliersPage(...)`, `listSupplierCandidates(...)`, and `getSupplier(...)` over the Firestore `suppliers` collection. It covers the approved full list, approved pagination, category candidates, and shared directory profile detail while excluding every Supplier write, submission, duplicate-index workflow, Claim, review, taxonomy, AI-intent, private-catalog, RFQ lifecycle/record, Auth, Rules/index, and provider-manifest change.

Configured Firebase behavior remains exact: queries have no explicit `orderBy` and retain Firestore's implicit document-path order; pagination uses a raw last-document snapshot, exact requested limit, and `hasMore = returnedCount === pageSize`; candidate lookup uses only the first ten categories, limits to 100 before application filtering, then requires exact `status === "approved" && canReceiveRfqs === true`; single-profile reads have no approval filter; and `{ id: snapshot.id, ...snapshot.data() }` permits a stored `id` to override the snapshot ID. Errors propagate from the service without Demo or alternate-provider substitution, though callers may apply their existing UI-level error handling.

`isFirebaseConfigured === false` continues to select intentional Demo/local application behavior before provider resolution. Demo/local pagination uses numeric offsets and `updatedAt` string descending order; Demo candidates have no ten-category cap, 100-result cap, or `canReceiveRfqs` requirement. These differences are not backend fallback or provider parity. The shipped `supplier_directory` authority remains Firebase; future unsupported/misconfigured selection must fail closed, with no Supabase networking, fallback, probing, dual-read, or dual-write.

D7 is documentation/readiness only and is now `AWAITING_INDEPENDENT_REVIEW`. No adapter, runtime source, manifest, Auth, Rules/index, SQL/RLS, Supabase capability, Production/TEST data, hosted action, migration, or deployment change is authorized or implied. The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`. Exact next gate: independent exact-head D7 readiness review before any implementation or manual merge sequence.
