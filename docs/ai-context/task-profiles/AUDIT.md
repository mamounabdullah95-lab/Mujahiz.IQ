# Task Profile — Production Audit and Read Budget

Use for read-only Production verification, usage investigation, count checks, targeted linkage checks, and Firestore read-budget review.

## Load

- `docs/ai-context/01_CURRENT_BASELINE.md`
- `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
- `docs/firestore-read-budget.md`
- Relevant audit scripts and guardrail tests only.

## Preserve

- Default use of aggregation counts, exact reviewed IDs, and small bounded latest-record queries.
- `writesAttempted: false` and explicit reporting of estimated logical reads.
- Full scans and supplier fingerprint generation only through explicit exceptional approval.
- No repeated pre/post audit when an existing result remains valid.
- Redaction of identities, credentials, tokens, and complete Production records.

## Avoid by default

- `getDocs(collection(...))` over large collections.
- Full supplier, submission, audit, or contribution-log downloads.
- Hash calculation, migration, cleanup, repair, or data normalization.

## Verification

Use the approved bounded read-only audit command and task-specific IDs. Record counts, read estimate, scan status, write status, and unexpected deltas.

Suggested reasoning: High; Extra High when designing a new Production audit or investigating unexplained usage.
