# Task Profile — Deployment and Infrastructure

Use for Firebase Hosting, Firestore Rules/index deployment, custom domains, DNS, SSL, Authorized Domains, App Check, and rollback planning.

## Load

- `docs/ai-context/01_CURRENT_BASELINE.md`
- `docs/ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`
- Relevant Firebase configuration, deployment scripts, merged PR deployment notes, and infrastructure tests only.

## Preserve

- Explicit deployment scope and order.
- Current active Hosting release, Ruleset, and index state.
- Canonical `mujahiz.com` behavior and legacy-origin compatibility where approved.
- Backup/rollback path and post-deployment verification.
- No unrelated service enablement.

## Mandatory boundaries

- Deployment requires explicit approval.
- Production writes and TEST cleanup require separate explicit approval.
- When new indexes are required: deploy indexes, wait for `READY`, then Rules, then Hosting unless the reviewed change specifies a safer order.
- Never deploy all Firebase targets by habit.

## Verification

Confirm current `main`, CI, deployment scope, active versions, index readiness, Rules compatibility, Hosting smoke test, and relevant read-only Production counts. Stop on unexpected deltas.

Suggested reasoning: Extra High.
