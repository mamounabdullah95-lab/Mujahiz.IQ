# Autonomous Execution Queue

Updated: 2026-08-17
Package A setup base: `bd33fb3d3b73f87a775d5f2375194d2acf67b6be`
Verified Package A closure base: `63ebaf2972350848dbe494908efd6756c070802a` (merge of PR #136)

This queue is operational state, not deployment authority. Every task must verify latest `origin/main` and its dependencies before work begins.

## Package A — Complete Claim v1 locally

Package objective: implement and independently verify the sixth and final Claim-v1 external command, then synchronize the authoritative Baseline and verify local Claim-v1 completion.

- Package state: `COMPLETE`.
- Completion evidence: PR #135 merged the independently reviewed sixth command at `a02adc9f5bf2db858079de84874bb917687d8c4c`; PR #136 merged the post-Expire Baseline synchronization at `63ebaf2972350848dbe494908efd6756c070802a`; A6 then verified the merged tree's exact 6/6 external-command inventory and unchanged security/environment boundary.

Hard boundary for the whole package:

- local repository/local Supabase + synthetic data only;
- no hosted Supabase;
- no Firebase change;
- no Production/TEST data write;
- no deployment;
- no automatic merge;
- seven Open gates remain unchanged unless newer verified merged authority proves otherwise: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, `MIG-002`.

### A1 — `supplier_claim.expire` trusted-command implementation

- State: `COMPLETE`
- Dependency: this control-plane PR is merged; latest `origin/main` contains the independently approved `docs/supabase-migration/68_EXPIRE_V1_TRUSTED_COMMAND_READINESS.md` from PR #133.
- Objective: implement the approved local-only `supplier_claim.expire` v1 contract and its focused/true-session validation.
- Risk: High.
- Model: Sol.
- Reasoning: High.
- Expected usage: Medium–High, but stop before execution if the actual expected usage becomes High.
- Suggested branch: `codex/expire-trusted-command-implementation`.
- Deliverable: one Draft implementation PR.
- Required evidence: exact base/head; migration/test/evidence files; focused pgTAP; relevant true-session races; required broader local SQL validation; role/grant/RLS invariants; Production/data impact.
- Merged PR: #135 at `a02adc9f5bf2db858079de84874bb917687d8c4c`; reviewed implementation head `b4d5ee23d38b99087c8de84bd315fbc253cd30a6`.
- Evidence: Expire focused pgTAP 59/59, true-session concurrency 23/23 across 12 races, and complete local SQL validation 2,229/2,229 across 29 migrations and 29 pgTAP files with 0 failures.
- Never: Ready, merge, deploy, hosted action, Firebase action, Production/TEST data action.

Implementation must follow the merged readiness contract rather than restating it. At minimum preserve:

- exact callable boundary with durable per-observation source identity;
- dedicated automated expiry-worker authority only;
- established Phase-A/fenced Phase-B idempotency architecture;
- canonical principal-advisory → Supplier-advisory → principal-row/domain-row lock ordering;
- due-only `submitted|under_review -> expired` behavior using one post-lock trusted time and the fixed 720-hour rule;
- reviewer-assignment provenance preservation;
- status-specific first-time terminal reconciliation with fail-closed `P5199 / integrity_reconciliation_required` behavior;
- zero ordinary success audit;
- exactly one `supplier_ownership.claim_expired` v1 event on a real expiry;
- no notification, ownership mutation, competitor mutation, hosted action, or browser/human/generic-service authority.

### A2 — Independent review of A1 (historical workflow stage)

- State: `COMPLETE`
- Dependency: A1 Draft PR with exact head and required implementation evidence.
- Objective: independently review the A1 exact head read-only.
- Model: Sol.
- Reasoning: High.
- Expected usage: Low–Medium.
- Branch/PR: none; review the A1 PR directly.
- Review focus: worker least privilege; exact source-item/idempotency semantics; not-due → later-due progression; lock/deadlock safety; status-specific terminal reconciliation; trusted-time boundary; event/audit cardinality; RLS/grants; true-session races; atomic rollback; no ownership/notification/competitor side effects.
- Pass criterion: no Critical/High/Medium blocking finding and explicit `APPROVE FOR MANUAL MERGE` or equivalent exact-head approval.
- Failure state: `CORRECTION_REQUIRED` on A1.
- Success state: `AWAITING_MANUAL_MERGE` for A1.

### A3 — Bounded correction loop for A1 (historical workflow stage)

- State: `COMPLETE`
- Dependency: A2 returns concrete `CHANGES REQUIRED` findings.
- Objective: correct only the actionable findings on the same A1 branch/PR, rerun affected validation, and return the new exact head to A2.
- Model: lowest capable model; use Sol High for security/concurrency/idempotency findings, otherwise lower when safe.
- Maximum automatic loops for the same material finding: 2.
- Escalate to: `HUMAN_DECISION_REQUIRED` if the third occurrence remains, scope must materially expand, or a genuine Owner/security choice appears.
- Never create a separate corrective PR unless the finding proves a separable prerequisite that must be isolated for safety.

### A4 — Manual merge gate for A1 (historical workflow stage)

- State: `COMPLETE`
- Dependency: A2 approves the exact unchanged A1 head and required PR Gate/checks are green.
- Action: surface `MANUAL_MERGE_REQUIRED` with exact PR, head SHA, checks, review verdict, data/Production impact, and explicit recommendation `ادمج الآن` or `لا تدمج بعد`.
- Owner action only: merge.
- Autonomous merge: forbidden.

### A5 — Post-Expire Baseline synchronization

- State: `COMPLETE`
- Dependency: A1 is manually merged and the new `origin/main` merge SHA is verified.
- Objective: update only authoritative current-state documentation needed to record the merged Expire implementation and same-commit local SQL evidence.
- Risk: Low.
- Model: Luna.
- Reasoning: Medium.
- Expected usage: Low.
- Suggested branch: `codex/baseline-sync-after-expire`.
- Deliverable: one Draft documentation PR.
- Merged PR: #136 at `63ebaf2972350848dbe494908efd6756c070802a`; documentation head `e18bb2c4af41c8dc88126cf2929adcdcccb762e3`; PR Gate `verify` succeeded on that head.
- Required state to record only if verified from the same relevant merged evidence: all six Claim-v1 external commands are implemented locally; latest migration/pgTAP counts; latest complete local SQL assertion total; physical table/routine/policy counts; seven Open gates; Firebase remains live Production; hosted Supabase remains unlinked/undeployed.
- Do not combine Firebase-suite totals with SQL totals from another commit/environment.
- Stop state: `AWAITING_MANUAL_MERGE` after bounded review/checks and one Draft documentation PR.
- Autonomous merge: forbidden.

### A6 — Claim v1 local completion verification and next-package recommendation

- State: `COMPLETE`
- Dependency: A5 manually merged and latest `origin/main` verified.
- Objective: read-only verification that the local Claim v1 external command surface is exactly 6/6 and identify the next smallest dependency-safe package from current authoritative evidence.
- Model: Luna Medium by default; escalate only if the next package itself requires architecture/security analysis.
- Expected usage: Low.
- Branch/PR: none unless a genuine documentation correction is required.
- Output: concise status report with verified main SHA, 6/6 command inventory, current test/baseline evidence, exact seven Open gates, environment distinctions, and one recommended next package.
- Verified result: `supplier_claim.submit`, `supplier_claim.assign_reviewer`, `supplier_claim.withdraw`, `supplier_claim.approve`, `supplier_claim.reject`, and `supplier_claim.expire` are the exact six locally implemented external commands. The merged tree has 29 migrations, 29 pgTAP files, 24 physical tables, 37 Core Phase 1 concepts (22 implemented / 15 unimplemented), exactly three Claim SELECT policies, zero Claim mutation policies, and latest complete local SQL evidence of 2,229/2,229 assertions with 0 failures.
- Next dependency-safe package: Package B below. This recommendation defines a local security contract and its later bounded implementation sequence; it does not authorize RLS/grant SQL in B1 or any Auth, hosted, migration, data, Firebase, or Production action.
- Do not begin RLS/Auth/migration/hosted work merely because A6 is complete.
- Stop state: `COMPLETE` for Package A and `HUMAN_DECISION_REQUIRED` only if choosing the next package requires an Owner decision.

## Package B — Claim v1 Local RLS & Authorization Foundation

Package objective: define, independently review, and—only after manual approval and merge of the readiness contract—implement the smallest local-only Claim v1 RLS/authorization foundation consistent with the approved identity, platform-role, Supplier-ownership, Claim privacy, trusted-command, and Reviewer-read authorities.

- Package state: `IN_PROGRESS`; B4-P2, B4, and B5 are `COMPLETE` in merged authority; B6 is `IN_PROGRESS` in this Draft documentation PR and stops at `AWAITING_MANUAL_MERGE`.
- Verified starting point: Package A and B1 are `COMPLETE`; PR #139 merged B4-P0; PR #140 merged B4-P1; PR #141 merged B4-P2 readiness; PR #142 merged B4 at `283d4b083e6354c236932392c872ee793f0984f4` with reviewed head `5342a54b800577894ff9a23e93316a350fa15f5f`; the Claim surface remains exactly 6/6 local external commands with final policy inventory 7 SELECT, 1 INSERT, 2 UPDATE, and 0 DELETE.
- Existing architectural constraint: B1 preserves zero browser/application Claim mutation policies and four isolated technical owner roles. B4-P1 provisions those roles cleanly. B4-P2 selects the only additional privileged exception: one exact helper-ACL asset followed by the separate exact ownership asset in one atomic privileged finalization transaction, with no temporary membership, `SET ROLE`, schema `CREATE`, grant option, or arbitrary privileged SQL.

Hard boundary for the whole package:

- local repository/local PostgreSQL/Supabase and synthetic data only;
- deny by default and expose only the minimum approved rows, columns, routines, and principals;
- all four B1 owner roles retain zero committed membership, credentials, schema `CREATE`, default ACL, and role-assumption path;
- no Auth Bridge, provider adapter, gateway, signed-token/pool integration, or real identity population;
- no application access/security administration or identity/role-row bootstrap runtime; only the separately scoped local database-role provisioner may be designed and implemented;
- no hosted Supabase access, link, push, policy/grant action, or deployment;
- no Firebase change and no Production/TEST data access or write;
- no migration of data, seed, backfill, repair, bulk update, deletion, DNS, billing, Storage, messaging, RFQ, notification delivery, or automatic merge;
- seven Open gates remain unchanged unless newer verified merged authority proves otherwise: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, `MIG-002`.

### B1 — Claim RLS/security readiness contract

- State: `COMPLETE`
- Dependency: satisfied; Package A is `COMPLETE`, and PR #138 is merged on `7f9d810006d12301365af747477257f5489b0009`.
- Objective: create one documentation-only readiness contract that defines the exact local Claim v1 security matrix and selects no SQL implementation until the matrix is independently approved and manually merged.
- Risk: High because this task defines an authorization boundary, despite being documentation-only.
- Model: Sol.
- Reasoning: High.
- Expected usage: Medium; stop before execution if actual expected usage becomes High.
- Suggested branch: `codex/claim-rls-security-readiness`.
- Merged deliverable: PR #138, with B1 authority in `docs/supabase-migration/70_CLAIM_RLS_AND_COMMAND_OWNERSHIP_READINESS.md`.
- Required inspection: the three current Claim SELECT policies; exact table/column/schema/routine grants; command and helper ownership, `SECURITY DEFINER`/invoker mode, fixed search paths, role attributes, and execute boundaries; the approved ID-001 identity, platform-role, access/security, Supplier-ownership, Claim privacy/authorization, trusted-command, and Reviewer-read contracts.
- Required matrix: principals and actor classes versus base-table reads, fixed read APIs, each of the six trusted commands, direct `INSERT|UPDATE|DELETE`, Claim lifecycle/assignment/expiry states, claimant/Owner/Admin/assigned-reviewer/worker distinctions, conflict/eligibility/identity failures, and explicit allow/deny outcomes.
- Mandatory decision: cite merged authority and explicitly conclude whether zero direct Claim mutation policies remains intended. If authority conflicts or more than one materially safe architecture remains, stop at `HUMAN_DECISION_REQUIRED`; do not select by invention.
- Validation: documentation/static checks only, including authority/link checks, exact inventory checks, contradiction/stale-state scan, and sensitive-value scan. Do not run the full SQL validator merely for B1.
- Merged result: B1 selected four isolated owner roles and exact later RLS/grant/ownership hardening; no SQL, RLS, grant, role, function, pgTAP, Auth, hosted, Firebase, or data change occurred.

### B2 — Independent exact-head security review of B1

- State: `COMPLETE` (historical workflow stage before PR #138 merged)
- Dependency: satisfied by the exact B1 PR review/merge chain.
- Objective: independently review the exact B1 head read-only against the merged identity/role/ownership/Claim authorities and current SQL/grant catalog.
- Review focus: authority traceability; actor/principal separation; permissive-policy union risk; table-owner/`BYPASSRLS`/`SECURITY DEFINER` behavior; grants and default privileges; direct-mutation denial; hidden-field exposure; fail-closed unknown/conflict/expiry behavior; and scope exclusions.
- Pass criterion: no Critical/High/Medium blocking finding and explicit exact-head `APPROVE FOR MANUAL MERGE` or equivalent.
- Failure state: `CORRECTION_REQUIRED` on B1, with at most two bounded correction/re-review loops for the same material finding.
- Success state: `AWAITING_MANUAL_MERGE` for B1.

### B3 — Manual merge gate for the approved B1 contract

- State: `COMPLETE`
- Dependency: satisfied; PR #138 was manually merged as `7f9d810006d12301365af747477257f5489b0009`.
- Result: the merged B1 contract is authoritative; no data, Production, hosted, Firebase, or deployment action occurred.
- Autonomous merge: forbidden.


### B4-P0 — Claim owner-role privileged-provisioning readiness contract

- State: `COMPLETE`
- Dependency: satisfied; B1 is merged through PR #138, and PR #139 merged this exact B4-P0 authority as `8bd9558ec33ce8f4d19fa5a3bb35164ef57118ce`.
- Objective: define the smallest reproducible local-only clean role-provisioning prerequisite plus the later three-transaction fail-closed B4 model: ordinary `postgres` migration, exact privileged ownership-only finalization, and final allowlist validation, without implementing any phase.
- Risk: High because this task defines a privileged PostgreSQL boundary, despite being documentation-only.
- Model: Sol.
- Reasoning: Extra High.
- Expected usage: Medium.
- Branch: `codex/claim-owner-role-provisioning-readiness`.
- Deliverable: one Draft documentation/security-contract PR adding one focused readiness document plus minimum B1 and queue synchronization.
- Validation: authority/link checks; pre-/post-B4 temporal invariants; privileged-boundary, ownership-inventory, failure-model, and complete catalog-allowlist review; contradiction/stale-state and sensitive-value scans; documentation/static checks; and `git diff --check`; no full SQL or Firebase suite.
- Merged result: PR #139; approved documentation head `abd79471375c500fe57c1e6f4f98753ec2eae641`; merge `8bd9558ec33ce8f4d19fa5a3bb35164ef57118ce`; no SQL, role, grant, data, hosted, Firebase, Production, or deployment action.

### B4-P1 — Local-only privileged owner-role provisioner implementation

- State: `COMPLETE`
- Dependency: satisfied; B4-P0 is merged by PR #139.
- Objective: implement only the dedicated atomic four-role local-bootstrap asset, complete pre-B4 catalog allowlist, and reusable disposable-runner hook selected by B4-P0; no B4 or ownership-finalization capability belongs to B4-P1.
- Deliverable: one separate Draft implementation PR with focused clean-role, zero-membership, catalog-dependency, injected-failure, idempotency, and clean reset/replay evidence.
- Prohibited scope: no B4 migration, Claim ownership transfer, Claim privilege or policy, function-body change, application `EXECUTE`, identity/role-row bootstrap, data, hosted, Firebase, Production/TEST, or deployment action.
- Merged result: PR #140; reviewed implementation head `9ba47ebf42563fc8e4cc322d2b3dee6c2f25a9b6`; merge `b531ad3331e9e77d3e562e92b5477ca667aa804e`; focused provisioner 279/279, complete local SQL 2,229/2,229 across 29 migrations and 29 pgTAP files, and exact-head PR Gate passed; no Production/data/deployment impact.

### B4-P2 — Projection-helper privileged ACL finalization readiness

- State: `COMPLETE`
- Dependency: satisfied; B4-P0 and B4-P1 are merged, with B4-P1 at current `origin/main` `b531ad3331e9e77d3e562e92b5477ca667aa804e`.
- Objective: define without implementation the exact local-only privileged ACL exception required for the future human command owner to execute the two projection-owned privileged-actor helpers while preserving projection ownership, zero B1 owner-role membership, zero role handoff, and zero grant option.
- Risk: High because this task finalizes a privileged PostgreSQL ACL boundary, despite being documentation-only.
- Model: Sol.
- Reasoning: Extra High.
- Expected usage: Medium.
- Branch: `codex/claim-projection-helper-acl-readiness`.
- Deliverable: one Draft documentation/security PR adding `docs/supabase-migration/72_CLAIM_PROJECTION_HELPER_ACL_FINALIZATION_READINESS.md` plus only the minimum B4-P0 cross-reference and queue dependency update.
- Selected result: preserve both helper owners; grant exact non-grantable EXECUTE on `current_privileged_actor_v1()` and `privileged_actor_for_profile_v1(uuid)` to `mujahiz_claim_human_command_owner`; revoke both historical direct `postgres` EXECUTEs; execute that fixed ACL asset before the separately fixed ownership asset in one atomic privileged finalization transaction.
- Validation: exact five-family call graph; direct `pg_proc`/`proacl`/`aclexplode` ownership, grantor, grant-option, PUBLIC, and schema evidence; PostgreSQL 17 documentation and pinned-image feasibility; alternatives, pre/postconditions, fixed-asset/hash/manifest, failure-model, contradiction, prohibited-capability, sensitive-value, relative-link, documentation-only, and `git diff --check` checks; no full SQL or Firebase suite.
- Merged result: PR #141; B4-P2 is `COMPLETE`.

### B4 — Local-only Claim RLS/authorization implementation

- State: `COMPLETE`
- Dependency: satisfied; B4-P2 and its exact B4 implementation are merged in PR #142.
- Objective: implement only the local RLS/authorization objects selected by B1 through one direct ordinary-`postgres` migration plus one privileged transaction containing the separately exact manifest- and SHA-256-bound B4-P2 ACL asset and ownership-transfer-only asset; preserve zero browser/application mutation policies and prohibit temporary membership, schema `CREATE`, role handoff, grant option, or arbitrary privileged SQL.
- Risk: High.
- Model: Sol.
- Reasoning: High.
- Expected usage: Medium–High, but stop before execution if actual expected usage becomes High.
- Suggested branch: `codex/claim-rls-authorization-foundation`.
- Deliverable: one Draft implementation PR with the smallest ordinary migration, two separate exact finalization assets/manifests/hashes and one fixed atomic privileged runner binding, focused synthetic pgTAP allow/deny matrix, and implementation evidence required by merged B1, B4-P0, and B4-P2.
- Required validation: direct-`postgres` ordinary execution; independent rollback of the ordinary transaction and atomic ACL-plus-ownership finalization transaction; incomplete-cluster rejection; both exact asset paths/manifests/hashes/statement inventories; ACL failure after every statement and between assets; pre-/post-B4 `pg_shdepend` and complete catalog allowlists; exact positive and negative actor/principal matrix; policy/grant/owner/search-path assertions; direct mutation denial; no hidden-field leakage; fail-closed unsupported/ambiguous/error behavior; focused replay in disposable local PostgreSQL; and the broader local SQL validation required by the merged contract and PR gate.
- Prohibited scope: Auth Bridge, Firebase, hosted Supabase, real identities or rows, access/security bootstrap/administration, provider/gateway/application adapters, Production/TEST data, migration/cutover, RFQ, Storage, messaging, billing, and deployment.
- Stop state: `COMPLETE`; PR #142 merged B4 after exact-head approval.

### B5 — Independent security review, bounded correction loop, and manual merge gate for B4

- State: `COMPLETE`
- Dependency: satisfied; PR #142 merged the exact reviewed B4 head.
- Objective: independently review the exact B4 head read-only; correct only concrete findings on the same branch/PR; re-review every changed head; then stop for manual merge when technically eligible.
- Review focus: exact B1/B4-P0/B4-P2 conformance; deny-by-default policy semantics; permissive-policy interactions; actor/principal isolation; direct table/function/schema grants; two exact privileged manifests/hashes/statement boundaries and one atomic finalization; definer/invoker ownership and search path; table-owner and `BYPASSRLS` effects; pre-/post-B4 dependency allowlists; phase-specific rollback and incomplete-cluster rejection; positive/negative pgTAP completeness; hidden-field leakage; and unchanged environment/data boundary.
- Maximum automatic correction loops for the same material finding: 2. On a third occurrence, conflicting authority, or required scope expansion, stop at `HUMAN_DECISION_REQUIRED`.
- Manual merge eligibility: exact-head approval; required head-specific checks green; no Critical/High/Medium blocker; explicit local-only/no-data/no-Production impact; explicit recommendation to merge manually.
- Success state: `COMPLETE`; PR #142 merged B4 after exact-head approval. Autonomous merge remains forbidden.

### B6 — Post-merge Baseline synchronization and Package B completion verification

- B6 verification result: exact 6/6 command surface; final Claim policy inventory 7 SELECT / 1 INSERT / 2 UPDATE / 0 DELETE; four inert technical-owner roles; 26 transferred routines; projection-helper ownership preserved; explicit 19-column target-conflict projection; PRE/POST catalog 343/355; normalizer SHA-256 verified; PR Gate #240 success on exact reviewed head.

- State: `IN_PROGRESS`
- Dependency: B4 is manually merged and latest `origin/main` merge SHA is verified.
- Objective: perform read-only verification of the merged Claim policy/grant/routine/role inventory against B1, then update only the minimum authoritative Baseline, design/register, and queue facts needed to record the merged local-only result.
- Risk: Low–Medium because the edit is documentation-only but records security state.
- Model: Luna or Terra at the lowest safe reasoning level; use Sol only if verification exposes a genuine security contradiction.
- Expected usage: Low–Medium.
- Suggested branch: `codex/baseline-sync-after-claim-rls`.
- Deliverable: one Draft documentation/control-plane PR with exact merge base, verified inventory, implementation/review/test evidence, seven Open gates, environment distinctions, and Package B completion recommendation.
- Validation: static/documentation checks and exact merged-tree inventory checks; do not rerun the full SQL validator unless merged evidence is missing or contradictory.
- Stop state: `AWAITING_MANUAL_MERGE`; Package B becomes `COMPLETE` only after this synchronization is manually merged and latest `origin/main` is reverified.
- Autonomous merge: forbidden.

## Queue advancement rules

1. Work only the first eligible `READY_AUTONOMOUS` item whose dependencies are proven on latest `origin/main`.
2. Do not skip a merge or decision dependency.
3. Reviewer approval is bound to an exact head SHA; any new commit invalidates that approval and requires re-review.
4. A passing PR Gate is also head-specific.
5. One task = one branch = one PR, except read-only review/verification items and corrections that intentionally stay on the implementation PR.
6. The queue may be updated as task state changes, but state bookkeeping must not be bundled into an unrelated security/runtime diff if it would create review noise; prefer the task handoff/PR body during active work and synchronize durable queue state in the nearest documentation-only control-point task.
7. Never label total Supplier records as active, claimed, verified, RFQ-ready, or paying suppliers without separate verified evidence.