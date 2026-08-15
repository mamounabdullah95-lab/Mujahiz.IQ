# Autonomous Execution Queue

Updated: 2026-08-15
Control-plane base before this setup PR: `bd33fb3d3b73f87a775d5f2375194d2acf67b6be`

This queue is operational state, not deployment authority. Every task must verify latest `origin/main` and its dependencies before work begins.

## Package A — Complete Claim v1 locally

Package objective: implement and independently verify the sixth and final Claim-v1 external command, then synchronize the authoritative Baseline and verify local Claim-v1 completion.

Hard boundary for the whole package:

- local repository/local Supabase + synthetic data only;
- no hosted Supabase;
- no Firebase change;
- no Production/TEST data write;
- no deployment;
- no automatic merge;
- seven Open gates remain unchanged unless newer verified merged authority proves otherwise: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, `MIG-002`.

### A1 — `supplier_claim.expire` trusted-command implementation

- State: `READY_AUTONOMOUS`
- Dependency: this control-plane PR is merged; latest `origin/main` contains the independently approved `docs/supabase-migration/68_EXPIRE_V1_TRUSTED_COMMAND_READINESS.md` from PR #133.
- Objective: implement the approved local-only `supplier_claim.expire` v1 contract and its focused/true-session validation.
- Risk: High.
- Model: Sol.
- Reasoning: High.
- Expected usage: Medium–High, but stop before execution if the actual expected usage becomes High.
- Suggested branch: `codex/expire-trusted-command-implementation`.
- Deliverable: one Draft implementation PR.
- Required evidence: exact base/head; migration/test/evidence files; focused pgTAP; relevant true-session races; required broader local SQL validation; role/grant/RLS invariants; Production/data impact.
- Stop state after implementation: `AWAITING_INDEPENDENT_REVIEW`.
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

### A2 — Independent review of A1

- State: `WAITING_DEPENDENCY`
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

### A3 — Bounded correction loop for A1

- State: `WAITING_DEPENDENCY`
- Dependency: A2 returns concrete `CHANGES REQUIRED` findings.
- Objective: correct only the actionable findings on the same A1 branch/PR, rerun affected validation, and return the new exact head to A2.
- Model: lowest capable model; use Sol High for security/concurrency/idempotency findings, otherwise lower when safe.
- Maximum automatic loops for the same material finding: 2.
- Escalate to: `HUMAN_DECISION_REQUIRED` if the third occurrence remains, scope must materially expand, or a genuine Owner/security choice appears.
- Never create a separate corrective PR unless the finding proves a separable prerequisite that must be isolated for safety.

### A4 — Manual merge gate for A1

- State: `WAITING_DEPENDENCY`
- Dependency: A2 approves the exact unchanged A1 head and required PR Gate/checks are green.
- Action: surface `MANUAL_MERGE_REQUIRED` with exact PR, head SHA, checks, review verdict, data/Production impact, and explicit recommendation `ادمج الآن` or `لا تدمج بعد`.
- Owner action only: merge.
- Autonomous merge: forbidden.

### A5 — Post-Expire Baseline synchronization

- State: `WAITING_DEPENDENCY`
- Dependency: A1 is manually merged and the new `origin/main` merge SHA is verified.
- Objective: update only authoritative current-state documentation needed to record the merged Expire implementation and same-commit local SQL evidence.
- Risk: Low.
- Model: Luna.
- Reasoning: Medium.
- Expected usage: Low.
- Suggested branch: `codex/baseline-sync-after-expire`.
- Deliverable: one Draft documentation PR.
- Required state to record only if verified from the same relevant merged evidence: all six Claim-v1 external commands are implemented locally; latest migration/pgTAP counts; latest complete local SQL assertion total; physical table/routine/policy counts; seven Open gates; Firebase remains live Production; hosted Supabase remains unlinked/undeployed.
- Do not combine Firebase-suite totals with SQL totals from another commit/environment.
- Stop state: `AWAITING_MANUAL_MERGE` after bounded review/checks.
- Autonomous merge: forbidden.

### A6 — Claim v1 local completion verification and next-package recommendation

- State: `WAITING_DEPENDENCY`
- Dependency: A5 manually merged and latest `origin/main` verified.
- Objective: read-only verification that the local Claim v1 external command surface is exactly 6/6 and identify the next smallest dependency-safe package from current authoritative evidence.
- Model: Luna Medium by default; escalate only if the next package itself requires architecture/security analysis.
- Expected usage: Low.
- Branch/PR: none unless a genuine documentation correction is required.
- Output: concise status report with verified main SHA, 6/6 command inventory, current test/baseline evidence, exact seven Open gates, environment distinctions, and one recommended next package.
- Do not begin RLS/Auth/migration/hosted work merely because A6 is complete.
- Stop state: `COMPLETE` for Package A and `HUMAN_DECISION_REQUIRED` only if choosing the next package requires an Owner decision.

## Queue advancement rules

1. Work only the first eligible `READY_AUTONOMOUS` item whose dependencies are proven on latest `origin/main`.
2. Do not skip a merge or decision dependency.
3. Reviewer approval is bound to an exact head SHA; any new commit invalidates that approval and requires re-review.
4. A passing PR Gate is also head-specific.
5. One task = one branch = one PR, except read-only review/verification items and corrections that intentionally stay on the implementation PR.
6. The queue may be updated as task state changes, but state bookkeeping must not be bundled into an unrelated security/runtime diff if it would create review noise; prefer the task handoff/PR body during active work and synchronize durable queue state in the nearest documentation-only control-point task.
7. Never label total Supplier records as active, claimed, verified, RFQ-ready, or paying suppliers without separate verified evidence.