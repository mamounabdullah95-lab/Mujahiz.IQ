# Task Profile — Testing and CI

Use for regression tests, Emulator coverage, CI workflows, deterministic fixtures, and test-performance issues.

## Load

- `docs/ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md`
- Target behavior, relevant tests, package scripts, and CI workflow only.

## Preserve

- Synthetic fixtures; no Production data in tests.
- Deterministic IDs, timestamps, and expected outcomes.
- Clear separation of unit, integration, built-bundle, Emulator, and Production smoke tests.
- Existing workflow permissions and no deployment in PR verification.
- Targeted tests before full suites.

## Avoid by default

- Changing application behavior merely to satisfy a brittle test.
- Running full high-risk suites for a copy/CSS-only change.
- Dependency upgrades unrelated to the failing test.
- Production reads or writes from CI.

## Verification

Report exact commands, pass/fail, counts, and only relevant failure excerpts. Identify whether failures are new, pre-existing, flaky, or unrelated.

Suggested reasoning: Medium for isolated tests; High for Emulator or CI architecture.
