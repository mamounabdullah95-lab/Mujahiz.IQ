# Compact Codex Prompt Template

Use this template in English. Remove sections that do not apply.

```text
# Task
[One clear task title]

## Context
Repository: Mujahiz IQ
Read `CODEX.md` first.
Use:
- `docs/ai-context/01_CURRENT_BASELINE.md`
- `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
- [one or two relevant context files]

Current starting point:
- Branch from the latest verified `main`.
- [Only task-specific state not already documented]

## Objective
[One measurable outcome.]

## In scope
- [...]
- [...]

## Out of scope
- [...]
- [...]

## Acceptance criteria
1. [...]
2. [...]
3. [...]

## Verification
- Inspect the relevant repository scripts before running commands.
- Run [targeted tests].
- Run [build/type check/emulator only if risk requires it].
- Verify [Arabic/English, roles, routes, or data behavior relevant to this task].

## Safety
Follow the guardrails document.
[Add only task-specific restrictions not already documented.]

## Branch and PR
Create branch: `[type/short-task-name]`
Keep this PR limited to the stated scope.

## Stop point
[Stop after local implementation / create PR / stop before merge / stop before deploy.]

## Response
Return:
- Root cause.
- Files changed.
- Tests and results.
- Production impact.
- Risks or unresolved items.
- Exact stop point reached.

## Suggested reasoning
[Medium / High / Extra High]
Complexity: [Low / Medium / High]
Expected usage: [Low / Medium / High]
```

## Minimal example

```text
# Task
Fix the Buyer registration sector field.

Read `CODEX.md`, the current baseline, safety guardrails, and product/UI rules.

Objective: replace the free-text sector field with approved options plus an `Other` option that reveals a required text field.

Scope: Buyer registration form, validation, translations, and relevant tests only.
Out of scope: Supplier registration, authentication architecture, Firestore Rules, redesign, deployment.

Acceptance:
1. Arabic and English labels are complete with no language mixing.
2. Existing valid submissions remain compatible.
3. `Other` requires a trimmed custom value.
4. Relevant tests and production build pass.

Create branch `fix/buyer-sector-field`.
Stop after creating the PR; do not merge or deploy.
Suggested reasoning: Medium.
```
