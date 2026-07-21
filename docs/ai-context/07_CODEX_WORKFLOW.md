# Token-Efficient Codex Workflow

## 1. Classify the task before loading context

### Small/local

Examples:

- Text or translation fix.
- Spacing or responsive correction.
- One form validation rule.
- One route link.
- One empty state.

Load:

- `CODEX.md`
- Safety guardrails.
- Target file(s) and direct dependencies.

### Normal/module-level

Examples:

- Registration flow.
- Buyer dashboard feature.
- Supplier import validation.
- Notification behavior.

Load:

- `CODEX.md`
- Current baseline.
- Safety guardrails.
- Relevant product/UI/testing documents.
- Module files and tests.

### High-risk/cross-cutting

Examples:

- Firestore Rules.
- Authentication architecture.
- RFQ lifecycle.
- Search architecture.
- Deployment or DNS.
- Data migration.

Load:

- All core context documents that are directly relevant.
- Repository architecture and affected services.
- Broader code only as evidence requires.

Do not perform a full repository review merely because the task is important.

## 2. Use one task per session or branch

A task should have:

- One objective.
- Explicit in-scope areas.
- Explicit out-of-scope areas.
- Acceptance criteria.
- Required tests.
- Stop point.

Split work when separate changes can fail, roll back, or be approved independently.

## 3. Context budget rules

- Prefer file paths and references over pasted source files.
- Prefer a current diff over full files when reviewing.
- Do not repeat unchanged Production counts and hashes in every response.
- Do not load prior chat history when `10_TASK_STATE_TEMPLATE.md` contains the needed state.
- Summarize prior findings in 5–10 lines.
- Avoid duplicate planning and re-planning unless evidence changes.
- Ask the repository to answer implementation questions before asking the user.
- Do not read generated or archived content unless necessary.

## 4. Planning rule

For small tasks, proceed directly after a brief inspection.

For normal/high-risk tasks, produce a concise plan containing:

1. Root cause or hypothesis.
2. Files/modules expected to change.
3. Tests.
4. Risk and stop point.

Do not produce a long architecture essay before an isolated implementation.

## 5. Review rule

Default review scope:

- Current branch diff.
- Direct dependencies.
- Relevant tests.
- Access-control or data boundaries touched by the diff.

A whole-project review requires an explicit reason and separate task.

## 6. Reasoning-level policy

Use the lowest level that can reliably complete the task:

- Low/Medium: copy, translation, isolated UI, simple validation, documentation.
- High: normal feature work, multi-file bug fixes, registration flows, search queries, notification logic.
- Extra High: security boundaries, Firestore Rules, authentication architecture, deployment, data integrity, difficult race conditions.
- Ultra/maximum: reserve for unresolved architecture or security problems after targeted inspection fails; do not use by default.

## 7. Session handoff

Before moving to another session or Fork, create a short state note using `10_TASK_STATE_TEMPLATE.md`.

The next session reads the state note rather than the entire chat.

## 8. Completion report

Keep it compact:

- Done.
- Evidence.
- Changed files.
- Tests.
- Risks.
- Stop point.

Do not repeat the original prompt or project history.
