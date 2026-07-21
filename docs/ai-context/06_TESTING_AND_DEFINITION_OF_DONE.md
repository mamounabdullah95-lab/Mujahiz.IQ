# Testing and Definition of Done

Use the smallest test set that proves the requested change, then expand only when the risk justifies it.

## Test levels

### Level A — Small presentation change

Use for copy, spacing, icon, isolated CSS, or a simple component state.

- Type check or targeted build check.
- Relevant component/unit test if available.
- Manual verification of the affected Arabic/English and responsive states.
- No full emulator suite unless access or data logic changed.

### Level B — Normal application feature or bug fix

- Install deterministically if dependencies are not already present.
- Relevant unit/integration tests.
- TypeScript check.
- Production build.
- Verify changed routes and direct role impacts.
- Review only the current diff and direct dependencies.

### Level C — Auth, Firestore, RFQ, permissions, imports, or notifications

- Relevant application tests.
- Firestore Emulator tests for allowed and denied cases.
- TypeScript check.
- Production build.
- Feature-flag/environment matrix when relevant.
- Read-only baseline verification before and after when Production data could be affected.
- Security review of the changed rules and service boundaries.

### Level D — Deployment, domain, infrastructure, or high-risk data operation

Everything in Level C plus:

- Explicit deployment scope.
- Backup/rollback plan.
- Current deployed versions.
- DNS/SSL/authorized-domain checks when applicable.
- Production smoke test.
- Post-deployment counts/fingerprints relevant to the operation.
- Separate approval before deployment and any Production write.

## Common commands

Codex must inspect `package.json` and repository scripts before running commands. Common commands may include:

- `npm ci`
- `npm test`
- `npm run build`
- Firestore Emulator test script
- `npm audit`
- `npm audit --omit=dev`

Do not assume a script exists. Do not replace repository-specific scripts with invented commands.

## Definition of done

A task is done only when:

- The root cause is addressed, not merely hidden.
- Scope did not expand.
- Relevant tests pass.
- Arabic/English and role-specific behavior are preserved where relevant.
- No new secrets or sensitive logs exist.
- Production impact is stated.
- Documentation is updated only when behavior or decisions changed.
- The requested stop point is respected.

## Output discipline

Do not paste complete build logs. Report:

- Command.
- Pass/fail.
- Test count when available.
- Relevant warning/error excerpt only.
- Whether the failure is new, pre-existing, or unrelated.
