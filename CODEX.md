# Mujahiz IQ — Codex Entry Point

Version: 1.1  
Updated: 2026-07-21  
Owner: Mujahiz IQ

Read this file before starting any task.

## 1. Load only the context required

Always read:

1. `docs/ai-context/01_CURRENT_BASELINE.md`
2. `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
3. One primary task profile selected through `docs/ai-context/task-profiles/README.md`
4. The one or two topic files relevant to the task.

Do not load all task profiles. Do not scan the entire repository unless the task is an architecture review, security review, cross-cutting refactor, or the required files cannot be identified safely.

## 2. Core operating rules

- Work from the current `main`, and use the verified application baseline recorded in the baseline document.
- Use a dedicated branch for every meaningful change.
- Keep one task or one tightly related concern per branch/PR.
- Do not deploy, merge, migrate, seed, backfill, bulk-update, delete, or write to Production without explicit approval.
- Treat Production supplier data as protected.
- Never expose credentials, tokens, secrets, private user data, or environment values.
- Verify current repository state rather than assuming file paths or implementation details from documentation.
- Stop at the requested checkpoint.

## 3. Token and context discipline

- Name the selected task profile in the prompt; do not paste its contents.
- Do not repeat the entire project history or unchanged baseline values.
- Inspect changed files and direct dependencies first.
- Review only the current diff unless a broader review is explicitly requested.
- Summarize command output; do not paste long logs unless a failure requires the relevant excerpt.
- Reuse existing tests and patterns before creating new abstractions.
- Avoid unrelated cleanup, dependency upgrades, or redesign.
- Use a second task profile only when the task genuinely crosses both domains.

## 4. Required final report

Return only:

- Summary of what changed.
- Root cause.
- Files changed.
- Tests and checks run with results.
- Production impact.
- Risks or unresolved items.
- Exact stop point and next recommended action.

For the detailed workflow, read `docs/ai-context/07_CODEX_WORKFLOW.md`. For prompts, use `docs/ai-context/09_PROMPT_TEMPLATE.md`.
