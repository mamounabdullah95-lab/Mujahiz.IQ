# Task Profiles — Quick Start

Use this compact pattern for routine Codex tasks:

```text
# Task
[title]

## Profile
Use `docs/ai-context/task-profiles/[PROFILE].md`.
Read `AGENTS.md` and `CODEX.md` first.

## Objective
[outcome]

## Scope
In: [target files/behavior]
Out: [explicit exclusions]

## Acceptance
1. [...]
2. [...]

Create branch `[type/name]`.
Run profile-appropriate focused verification.
Stop after creating the PR. Do not merge or deploy.
Reasoning: [Medium/High/Extra High].
```

Do not paste baseline values, general guardrails, project history, or the profile contents into the prompt. Refer to the repository files instead.
