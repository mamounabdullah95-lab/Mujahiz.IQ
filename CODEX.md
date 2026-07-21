# Mujahiz IQ — Codex Entry Point

Version: 1.0  
Updated: 2026-07-20  
Owner: Mujahiz IQ

Read this file before starting any task.

## 1. Load only the context required

Always read:

1. `docs/ai-context/01_CURRENT_BASELINE.md`
2. `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
3. The one or two topic files relevant to the task.

Do not scan the entire repository unless the task is an architecture review, security review, cross-cutting refactor, or the required files cannot be identified safely.

## 2. Core operating rules

- Work from the current `main`, and use the verified application baseline recorded in the baseline document.
- Use a dedicated branch for every meaningful change.
- Keep one task or one tightly related concern per branch/PR.
- Do not deploy, merge, migrate, seed, backfill, bulk-update, delete, or write to Production without explicit approval.
- Treat Production supplier data as protected.
- Never expose credentials, tokens, secrets, private user data, or environment values.
- Verify current repository state rather than assuming file paths or implementation details from these documents.
- Stop at the requested checkpoint.

## 3. Token and context discipline

- Do not repeat the entire project history.
- Do not restate unchanged baseline values in every response.
- Reference these documents instead.
- Inspect changed files and their direct dependencies first.
- Review only the current diff unless a broader review is explicitly requested.
- Summarize command output; do not paste long logs unless a failure requires the relevant excerpt.
- Reuse existing tests and patterns before creating new abstractions.
- Avoid unrelated cleanup, dependency upgrades, or redesign.

## 4. Required final report

Return only:

- Summary of what changed.
- Root cause.
- Files changed.
- Tests and checks run with results.
- Production impact.
- Risks or unresolved items.
- Exact stop point and next recommended action.

For the detailed workflow, read `docs/ai-context/07_CODEX_WORKFLOW.md`.
