# Autonomous Execution Policy

Purpose: allow routine Mujahiz IQ engineering work to proceed with minimal Owner interruption while preserving the existing Git, security, testing, usage, and Production guardrails.

This policy extends, and does not replace:

- `01_CURRENT_BASELINE.md`
- `04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
- `06_TESTING_AND_DEFINITION_OF_DONE.md`
- `07_CODEX_WORKFLOW.md`
- `08_REASONING_AND_USAGE_POLICY.md`
- `10_TASK_STATE_TEMPLATE.md`
- `11_DECISION_LOG.md`
- `12_CONTEXT_UPDATE_CHECKLIST.md`

If this file conflicts with an authoritative security, Production, migration, or approved design contract, the stricter/newer authoritative evidence wins.

## 1. Operating model

Use an **autonomous execution + independent review + human merge/decision gate**.

Normal flow:

1. Read the first eligible item in `14_AUTONOMOUS_EXECUTION_QUEUE.md`.
2. Verify latest `origin/main` and all listed dependencies.
3. Executor creates one branch for one task, implements only that task, runs risk-appropriate validation, and opens one Draft PR.
4. Independent Reviewer reviews the exact PR head read-only.
5. If `CHANGES REQUIRED`, Executor corrects the same branch/PR and Reviewer re-reviews the new exact head.
6. Stop for the Owner when the PR is technically ready for manual merge or when any human-decision condition occurs.
7. After a verified manual merge, advance only tasks whose dependencies are now satisfied.

Never treat a Draft/open PR, local SQL, passing tests, or GitHub `main` as deployed Production.

## 2. Autonomous actions allowed

Within an approved queue item and its explicit scope, an Executor may autonomously:

- fetch and fast-forward a clean local `main` to verified `origin/main`;
- create the task branch;
- inspect authoritative context plus affected files/direct dependencies only;
- edit scoped repository files;
- add/update deterministic tests required by the task;
- run focused tests first and broader suites only when risk/PR gate requires them;
- commit and push the branch;
- open/update one Draft PR;
- update the short task-state handoff;
- respond to concrete independent-review findings on the same PR;
- rerun a failed check once when evidence indicates a transient/flaky infrastructure failure and no code/data change is required.

The Reviewer is read-only. It may inspect the exact diff, direct dependencies, tests, access/data boundaries, and CI evidence. It must not silently fix its own findings.

## 3. Human-stop conditions

Stop and surface a concise decision request when any of these applies:

- `OWNER_DECISION_REQUIRED`
- `ARCHITECTURE_DECISION_REQUIRED`
- `SECURITY_DECISION_REQUIRED`
- `PRODUCTION_ACTION_REQUIRED`
- `DATA_CHANGE_REQUIRED`
- `HOSTED_SUPABASE_REQUIRED`
- `FIREBASE_CHANGE_REQUIRED`
- `AUTH_CHANGE_REQUIRED`
- `RLS_OR_GRANT_CHANGE_REQUIRED` when not already explicitly authorized by the queue item/merged contract
- `DNS_CHANGE_REQUIRED`
- `BILLING_CHANGE_REQUIRED`
- `MANUAL_MERGE_REQUIRED`
- `EXPECTED_USAGE_HIGH`
- a non-transient PR/CI blocker remains after bounded investigation;
- the same material finding survives two Executor → Reviewer correction cycles;
- multiple materially different safe product/security behaviors remain possible;
- scope must expand beyond the approved queue item.

Do not make an Owner decision by inference when the repository does not determine it.

## 4. Actions never autonomous

Without explicit Owner approval for the exact action, never:

- merge any PR;
- mark a PR Ready as a substitute for Owner review;
- deploy;
- link or operate a hosted Supabase project;
- change Firebase Production, Firebase Auth/config, Firestore Rules/indexes, or deployment scripts;
- migrate, seed, backfill, delete, overwrite, bulk-update, repair, or reformat Production data;
- delete or mutate TEST data outside an explicitly approved test operation;
- change hosted RLS/grants;
- change DNS, Authorized Domains, billing, secrets, credentials, or Production environment configuration;
- introduce silent fallback or uncontrolled dual-write.

Local Supabase plus synthetic data remains the default SQL environment.

## 5. Model and usage control

Follow `08_REASONING_AND_USAGE_POLICY.md` and use the lowest capable model.

Preferred task routing:

- Luna Low/Medium: Git, metadata, Baseline, docs, formatting, focused static checks.
- Terra Medium/High: scoped implementation, ordinary tests, adapters, UI/module fixes.
- Sol High/Extra High: schema, trusted commands, RLS, Auth, migration, rollback, concurrency, security.
- Ultra/maximum: only unresolved multi-part architecture/security after targeted Sol review is insufficient.

Rules:

- do not escalate because a prompt is long;
- do not run repository-wide review without a concrete reason;
- do not rerun Firebase suites for SQL/docs-only changes unless shared behavior changed;
- do not repeat a full independent review when the exact head did not change;
- successful logs should be summarized; detailed logs are for failures;
- if expected usage becomes `High`, stop before the expensive step and request Owner approval;
- after a difficult design decision is closed, lower model/reasoning for bounded implementation/docs where safe.

## 6. Review and correction loop

For normal tasks, one bounded independent review is sufficient.

For security/data/concurrency-sensitive tasks, the Reviewer must explicitly verify the relevant contract, permissions, failure modes, and race/replay behavior.

A correction loop stays on the same implementation branch/PR unless the finding exposes a separable prerequisite that must be isolated for safety.

Maximum automatic correction loops for the same material finding: **2**. On the third occurrence, stop with `SECURITY_DECISION_REQUIRED` or the closest applicable human-stop condition.

A PR may be surfaced as `MANUAL_MERGE_REQUIRED` only when:

- its exact head is known;
- required focused/broader tests for that task are green;
- PR Gate/checks required by repository policy are green or a documented non-code exception has been explicitly approved;
- independent review is `APPROVE` / `APPROVE FOR IMPLEMENTATION` as applicable;
- no Critical/High/Medium blocking finding remains;
- Production/data/deployment impact is explicitly stated;
- the PR has not moved since the approving review/check evidence.

## 7. Parallelism

Parallel work is allowed only when tasks have no shared schema, data, security, migration, or ordered dependency.

Default maximum: **2 implementation PRs open concurrently**.

Security/schema/Auth/migration chains that depend on a preceding merged contract remain sequential.

## 8. Queue state vocabulary

Use only these primary states in the queue:

- `READY_AUTONOMOUS`
- `IN_PROGRESS`
- `AWAITING_INDEPENDENT_REVIEW`
- `CORRECTION_REQUIRED`
- `AWAITING_MANUAL_MERGE`
- `WAITING_DEPENDENCY`
- `HUMAN_DECISION_REQUIRED`
- `BLOCKED`
- `COMPLETE`

State changes must include the relevant branch, PR, exact head SHA, and concise evidence reference when those exist.

## 9. ChatGPT monitoring/reporting boundary

ChatGPT may monitor GitHub state and summarize the queue, PR heads, checks, review verdicts, blockers, and next actions. It may recommend `ادمج الآن` or `لا تدمج بعد` after live verification.

Monitoring/reporting is not authority to merge, deploy, alter Production/TEST data, or resolve Owner decisions.

Daily reporting should distinguish:

- completed work;
- current exact state;
- human action required;
- next eligible task;
- Firebase live vs GitHub main vs local Supabase vs hosted Supabase;
- tests/checks by environment and commit;
- Production/data/deployment impact;
- qualitative model/usage only when recorded in task evidence.

## 10. First rollout boundary

The first autonomous package is intentionally narrow: finish the local-only `supplier_claim.expire` trusted command, independently review it, stop for manual merge, synchronize the Baseline after merge, then verify Claim v1 command completion.

This policy does not pre-authorize later RLS, Auth bridge, hosted migration, Production cutover, or deployment work. Those require separate queue packages and their existing approval gates.