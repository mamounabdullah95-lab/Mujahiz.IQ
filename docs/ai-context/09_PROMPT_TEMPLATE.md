# Compact Codex Prompt Template

Use this template in English. Remove sections that do not apply. Do not repeat stable project context already stored in the repository.

```text
# Task
[One clear task title]

## Profile
Use `docs/ai-context/task-profiles/[PROFILE].md` as the primary task profile.
Read `AGENTS.md` and `CODEX.md` first.

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
- Run [targeted tests].
- Run [build/type check/Emulator only if the profile or risk requires it].
- Verify [Arabic/English, roles, routes, data behavior, or deployment state relevant to this task].

## Branch and stop point
Create branch: `[type/short-task-name]`
Stop after [local implementation / PR creation / review].
Do not merge or deploy unless explicitly approved.

## Task-specific safety
[Only restrictions not already covered by repository guardrails. Omit when none.]

## Response
Return root cause, changed files, tests/results, Production impact, risks, and exact stop point.

## Suggested reasoning
[Medium / High / Extra High]
Expected usage: [Low / Medium / High]
```

## Minimal example — UI

```text
# Task
Fix the Buyer registration sector field.

## Profile
Use `docs/ai-context/task-profiles/UI.md` as the primary profile.
Read `AGENTS.md` and `CODEX.md` first.

## Objective
Replace the free-text sector field with approved options plus `Other`, which reveals a required custom field.

## Scope
Buyer registration form, validation, translations, and focused tests only.
Out of scope: Supplier registration, authentication architecture, Firestore Rules, redesign, deployment.

## Acceptance
1. Arabic and English are complete with no language mixing.
2. Existing valid submissions remain compatible.
3. `Other` requires a trimmed value.
4. Focused tests and production build pass.

Create branch `fix/buyer-sector-field`.
Stop after creating the PR. Do not merge or deploy.
Reasoning: Medium. Expected usage: Low.
```

## Minimal example — RFQ

```text
# Task
Correct duplicate Buyer notifications after a material quotation update.

## Profile
Use `docs/ai-context/task-profiles/RFQ.md` as the primary profile.
Read `AGENTS.md` and `CODEX.md` first.

## Objective
Ensure one deterministic Buyer notification is created for each material response revision and unchanged resubmission remains a no-op.

## Scope
RFQ response transaction, revision/event/notification identities, Rules compatibility, and focused RFQ/Emulator tests.
Out of scope: messaging, awarding, email, PDFs, uploads, analytics, deployment, Production cleanup.

## Acceptance
1. Transaction retry cannot duplicate artifacts.
2. Unchanged submission creates nothing.
3. Cross-Supplier and forged notification cases remain denied.
4. Relevant tests, Emulator diagnostics, and build pass.

Create branch `fix/rfq-update-notification-idempotency`.
Stop after creating the PR. Do not merge or deploy.
Reasoning: Extra High. Expected usage: Medium.
```
