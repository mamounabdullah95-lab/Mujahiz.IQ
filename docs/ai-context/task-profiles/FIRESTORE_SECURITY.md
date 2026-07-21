# Task Profile — Firestore Security

Use for Firestore Rules, authorization helpers, query compatibility, immutable fields, transactions, and protected data boundaries.

## Load

- `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
- `docs/ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md`
- Relevant Rules sections, service query shapes, data types, indexes, and Emulator tests only.

## Preserve

- Least privilege and fail-closed behavior.
- Canonical ownership checks from trusted documents.
- Role/account/status/email-verification/access requirements.
- Exact query shapes authorized by Rules.
- Immutable identity, ownership, revision, event, notification, and audit fields.
- Rules document-access and expression limits.
- Existing legitimate legacy reads only where intentionally documented.

## Avoid by default

- Broadening access to make a failing client query pass.
- Client-created privileged state or cross-user notifications.
- Production writes, Rules deployment, migration, seed, backfill, or user repair.

## Verification

Require Emulator allow/deny matrices, query-shape tests, diagnostics, repository tests, and production build. Review index impact explicitly. Stop before deployment.

Suggested reasoning: Extra High.
