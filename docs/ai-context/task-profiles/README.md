# Mujahiz IQ — Task Profiles

Use exactly one primary profile for each task. Add a second profile only when the change truly crosses both domains.

## Selection

- RFQ lifecycle, quotations, revisions, RFQ notifications: `RFQ.md`
- Supplier directory, profile, linking, import, dashboard: `SUPPLIER.md`
- Search, ranking, normalization, filtering: `SEARCH.md`
- Registration, authentication, verification, roles: `AUTH.md`
- Copy, layout, RTL/LTR, responsive or component presentation: `UI.md`
- Firestore Rules, authorization, data invariants: `FIRESTORE_SECURITY.md`
- Firebase deployment, DNS, Hosting, indexes: `DEPLOYMENT.md`
- Tests, CI, Emulator or regression coverage: `TESTING.md`
- Production read-only audits and read budgets: `AUDIT.md`
- Repository documentation and Project Memory: `DOCUMENTATION.md`

## Operating rule

1. Read root `AGENTS.md` and `CODEX.md`.
2. Read the current baseline and Production guardrails.
3. Select one profile from this directory.
4. Inspect only the target files, direct dependencies, and relevant tests.
5. Expand scope only when evidence shows it is necessary.

Do not load all profiles. Do not repeat their content in the task prompt. A task prompt should name the selected profile and contain only the objective, scope, acceptance criteria, verification, and stop point.
