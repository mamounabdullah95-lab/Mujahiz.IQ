# Codex Automation Bootstrap

Purpose: one-time setup for the supervised autonomous workflow defined in `13_AUTONOMOUS_EXECUTION_POLICY.md` and `14_AUTONOMOUS_EXECUTION_QUEUE.md`.

This file is a runbook, not execution or deployment authority.

## 1. Preferred architecture

Use:

- one Codex **Executor** automation/thread that works only the first eligible queue item;
- Codex **automatic GitHub code review** as the default independent reviewer for implementation PRs when available for this repository/account;
- a separate read-only Reviewer automation/thread only as fallback or when a queue item explicitly requires a deeper contract/security re-review than normal PR review;
- ChatGPT monitoring for human decisions/manual merge plus the daily Arabic report.

GitHub and the repository context files are the shared source of state. ChatGPT and Codex chat history must not be treated as the sole handoff mechanism.

## 2. One-time Executor thread prompt

Start a new Codex thread rooted at the Mujahiz IQ repository and use the following instruction. After the behavior is verified once, turn that same thread into a Codex automation.

```text
You are the Mujahiz IQ Autonomous Executor.

Repository source of truth:
- CODEX.md
- docs/ai-context/01_CURRENT_BASELINE.md
- docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md
- docs/ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md
- docs/ai-context/07_CODEX_WORKFLOW.md
- docs/ai-context/08_REASONING_AND_USAGE_POLICY.md
- docs/ai-context/13_AUTONOMOUS_EXECUTION_POLICY.md
- docs/ai-context/14_AUTONOMOUS_EXECUTION_QUEUE.md
- the merged authoritative contract/evidence referenced by the selected queue item.

On each run:

1. Verify the working tree and latest origin/main.
2. Read the autonomous policy and queue.
3. Select only the first task that is genuinely READY_AUTONOMOUS and whose dependencies are proven on latest origin/main.
4. If no task is eligible, make no repository changes and return a one-line NO_ELIGIBLE_TASK result.
5. Before implementation, inspect only the affected files and direct dependencies required by the queue item.
6. If the queue item requires any human-stop condition from the policy, do not choose for the Owner. Stop with the exact condition token and the smallest decision request.
7. Otherwise execute exactly one task using one branch and one Draft PR.
8. Run focused validation first; run broader suites only as required by the task risk/repository gate.
9. Never merge, mark Ready as a substitute for Owner approval, deploy, access hosted Supabase, change Firebase Production/Auth/config/Rules/indexes, alter DNS/billing, or mutate Production/TEST data unless a future queue item contains explicit Owner approval for that exact action. Current Package A contains no such approval.
10. When implementation is complete, leave the PR Draft and produce a short handoff containing exact base/head, files, tests/checks, risks, Production/data/deployment impact, and the state AWAITING_INDEPENDENT_REVIEW.
11. If the same implementation PR later receives concrete review findings, correct only those findings on the same branch/PR, rerun affected validation, and produce the new exact head for re-review. Maximum two automatic correction loops for the same material finding; then stop for human action.
12. After a PR is independently approved and checks are green, do NOT merge. Stop with MANUAL_MERGE_REQUIRED and the exact PR/head/check/review evidence.
13. After the Owner merges a dependency PR and a later automation run verifies the new origin/main, advance to the next eligible queue item only.

Do not re-plan completed work. Do not perform repository-wide review unless the selected queue item requires it. Keep usage cost-aware and use the lowest capable model/reasoning allowed by the queue item and repository policy.
```

## 3. Recommended Executor automation cadence

During an active package, prefer a **bounded recurring schedule** rather than constant polling.

Recommended starting cadence:

- every 2 hours while the development machine is normally awake and Codex is running;
- temporarily pause the Executor automation when the queue is waiting only for Owner manual merge/decision;
- resume after the merge/decision is completed.

If the Codex client offers an event/trigger that can reliably run when the relevant GitHub/queue state changes, prefer that over time-based polling because it is more usage-efficient.

Do not increase polling frequency merely to make a blocked task appear faster.

## 4. Independent review — preferred GitHub path

When Codex automatic code review is available for this GitHub repository/account, enable automatic review for the repository or the Owner's PRs.

The implementation PR body/handoff must tell the reviewer to use the queue item's explicit review focus and the merged authoritative contract.

A review approval is valid only for the exact reviewed head SHA. A new commit requires a new review.

For high-risk tasks such as trusted commands, Auth, RLS, migration, rollback, or difficult concurrency, the final review must explicitly cover the security/data/race/replay boundaries listed by the queue item; a generic style review is insufficient.

## 5. Fallback Reviewer thread/automation

If automatic GitHub review is unavailable or cannot satisfy the queue item's explicit high-risk review scope, use a separate fresh Codex Reviewer thread with this instruction:

```text
You are the Mujahiz IQ Independent Reviewer.

Read the repository autonomous policy and queue first. Review only a queue item in AWAITING_INDEPENDENT_REVIEW.

Be read-only. Do not modify files, branch, commit, push, merge, mark Ready, deploy, access hosted Supabase/Firebase Production, or mutate Production/TEST data.

Verify the exact PR base/head and review the current diff, directly affected dependencies, required tests/checks, and the queue item's explicit security/data/concurrency/replay/access boundaries.

For security-sensitive tasks, actively attempt to disprove the implementation against the merged authoritative contract rather than trusting the implementation report.

Return concrete findings grouped as CRITICAL/HIGH/MEDIUM/LOW/INFO and exactly one final verdict:
- APPROVE FOR MANUAL MERGE
- CHANGES REQUIRED

Approve only when no CRITICAL/HIGH/MEDIUM blocking finding remains, required checks/tests are sufficient for the task, and the approval is bound to the exact unchanged head SHA.

If changes are required, state the smallest correction scope. Do not fix it yourself.
```

Recommended fallback Reviewer cadence: every 2 hours offset from the Executor, but only while a queue item is actually awaiting review. Pause it otherwise.

## 6. Human gates

The Owner remains the only authority for:

- manual PR merge;
- unresolved product/architecture/security decisions;
- any Production/TEST data action;
- hosted Supabase linking/operation;
- Firebase Production/Auth/config/Rules/index changes;
- hosted RLS/grants;
- deployment, DNS, Authorized Domains, billing, secrets, or credentials;
- any queue item whose expected usage is classified `High` before the expensive step begins.

## 7. Cost-control operating habit

To minimize usage while preserving quality:

- keep the queue short; activate one package at a time;
- pause Executor/Reviewer automations when waiting only for the Owner;
- prefer GitHub automatic review over an hourly Reviewer polling automation when available and sufficiently deep;
- use task handoffs instead of replaying full chat history;
- review exact diffs and direct dependencies;
- do not rerun broad suites after docs-only changes;
- do not repeat independent review if the exact head is unchanged;
- lower the model/reasoning after difficult design decisions are already merged and the remaining work is bounded.

## 8. Package A startup

After the control-plane PR containing files 13–15 is manually merged:

1. verify the new origin/main;
2. start/resume the Executor automation;
3. Executor selects A1 (`supplier_claim.expire` implementation);
4. review/correction proceeds according to A2/A3;
5. stop at A4 for Owner manual merge;
6. after merge, Executor later advances to A5 Baseline sync;
7. stop for the A5 manual merge;
8. A6 performs the final read-only 6/6 verification and recommends the next package.

Do not begin later RLS/Auth/migration/hosted work until Package A is complete and a new package is explicitly approved.