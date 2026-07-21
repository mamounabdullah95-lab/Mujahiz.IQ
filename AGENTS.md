# Mujahiz IQ — Repository Instructions

This file is the automatically loaded instruction map for Codex.
Keep it short. The detailed sources of truth are under `docs/ai-context/`.

## Required reading

Before any task, read:

1. `CODEX.md`
2. `docs/ai-context/01_CURRENT_BASELINE.md`
3. `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
4. Only the additional topic file(s) relevant to the task.

Do not load every context file by default.

## Core rules

- Verify the current `main` SHA before starting meaningful work.
- Use one coherent task per branch and pull request.
- Inspect the target files, current diff, and direct dependencies first.
- Do not review or scan the entire repository unless the task truly requires it.
- Do not merge, deploy, migrate, seed, backfill, bulk-update, delete, change DNS, change privileged roles, or write to Production without explicit approval.
- Treat Production supplier data and fingerprints as protected.
- Do not expose secrets, credentials, tokens, personal data, or complete Production records.
- Do not perform unrelated cleanup, redesign, or dependency upgrades.
- Use the lowest reasoning level that can safely complete the task.
- Stop at the requested checkpoint.

## Testing

Use the risk-based test levels in:

`docs/ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md`

Do not run the complete high-risk suite for an isolated copy or CSS change unless evidence requires it.

## Task handoff

When moving work to another session, Fork, or reviewer, create a short state note using:

`docs/ai-context/10_TASK_STATE_TEMPLATE.md`

Do not paste the entire previous conversation.

## Final response

Return only:

- Root cause or finding.
- What changed.
- Files changed.
- Tests and results.
- Production impact.
- Risks or unresolved items.
- Exact stop point.
