# Reasoning and Usage Policy

Purpose: maintain professional quality while reducing unnecessary model usage.

## Default selection

| Task type | Suggested reasoning |
|---|---|
| Copy, labels, translation keys, simple CSS | Medium |
| Component behavior, forms, normal bug fixes | High |
| Multi-module workflow or difficult debugging | High |
| Auth, Firestore Rules, role permissions, deployment | Extra High |
| Unresolved architecture/security after targeted review | Maximum only when justified |

## Escalation rule

Start lower and escalate only when:

- Two targeted attempts fail for different, understood reasons.
- The change crosses multiple security or data boundaries.
- The repository contains conflicting architecture.
- A race condition cannot be reproduced or isolated.
- The model identifies uncertainty that materially affects safety.

Do not escalate merely because the task description is long.

## Usage anti-patterns

Avoid:

- “Review the entire project” after every phase.
- Sending all prior logs and plans to an implementation session.
- Asking one prompt to plan, redesign, refactor, test, deploy, and document unrelated concerns.
- Re-running all tests for a one-line copy change.
- Repeating Production baselines that have not changed.
- Using maximum reasoning for routine CSS.
- Asking multiple models to repeat the same full-codebase review without a defined disagreement to resolve.

## Efficient second opinions

A second review should receive:

- The objective.
- The current diff or PR.
- The acceptance criteria.
- The first reviewer’s specific concern.

It should not receive the entire history unless the disagreement is architectural.

## Cost-aware stopping

Stop and request a decision when:

- The next action is deployment, merge, or Production write.
- Multiple valid product choices exist.
- A broad refactor is optional rather than required.
- Additional investigation has diminishing value.
- The task is complete against its acceptance criteria.
