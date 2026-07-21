# Task Profile — Authentication and Accounts

Use for registration, sign-in, email verification, password reset, account type, roles, access periods, and protected profile linkage.

## Load

- `docs/ai-context/03_PRODUCT_AND_BUSINESS_RULES.md`
- Relevant Auth context, registration/verification services, routes, Rules sections, and auth tests only.

## Preserve

- Firebase Auth and trusted token claims as the source of truth where applicable.
- Separation of privileged `role` from Buyer/Supplier `accountType`.
- No public Admin or Owner registration.
- Normal users cannot self-promote or alter protected identity/linkage fields.
- Buyer Trial and referral credits remain limited to approved eligible Buyers.
- Legacy Admin/Owner compatibility where documented.
- Specific localized error states and safe recovery paths.
- Production must fail closed when Firebase configuration is missing or malformed.

## Avoid by default

- Supplier or RFQ redesign.
- Production user modification, role repair, or verification backfill.
- Sending real verification/reset emails during synthetic validation.

## Verification

Use focused auth tests, built-bundle fail-closed checks, route checks, and Emulator allow/deny cases when Firestore synchronization or roles change.

Suggested reasoning: High; Extra High for roles, claims, Rules, or Production account changes.
