# Application Source Instructions

These instructions apply to files under `src/` and extend the repository-root `AGENTS.md`.

## Context loading

Read the root instructions, current baseline, Production guardrails, one primary task profile, and only the files directly relevant to the task. Do not scan all of `src/` by default.

## Scope discipline

- Preserve existing React, TypeScript, routing, role, localization, and design patterns.
- Inspect the target page/component/service, direct imports, and focused tests first.
- Keep one coherent behavior change per PR.
- Do not perform unrelated refactors, formatting sweeps, or dependency upgrades.
- Do not touch Firestore Rules, indexes, deployment files, or Production unless the selected profile and task explicitly require them.

## Application quality

- Maintain Arabic RTL and English LTR behavior.
- Preserve role-correct Buyer, Supplier, Admin, and Owner routes.
- Use bounded data access and avoid polling or full-collection reads.
- Handle loading, empty, error, unauthorized, and stale-session states explicitly.
- Do not expose raw Firebase errors or sensitive data.

## Verification

Follow the selected task profile and the risk-based testing guide. Prefer focused tests and production build checks; add Emulator coverage only when data authorization or query boundaries change.
