# Claim Supplier Profile backend deployment and rollback

Status: implementation only; not deployed. The visible Claim Supplier Profile feature remains disabled, and PR 2 is not included.

## Runtime, feature gates, and security boundary

- Functions generation: Firebase Functions v2 callable functions.
- Runtime: Node.js 22 in both `functions/package.json` and `firebase.json`; CI installs and validates with Node 22.
- Region: `us-central1`, explicitly matching Firebase's documented default because this repository has no prior Functions/location configuration.
- Before any Production deployment, verify the actual Firestore database location read-only. If cross-region latency or cost is not acceptable, stop for architecture review.
- Client gate: `VITE_SUPPLIER_PROFILE_CLAIM_ENABLED` uses strict `true` semantics and must remain absent or `false`.
- Backend claim gate: `CLAIM_SUPPLIER_PROFILE_ENABLED` uses strict `true` semantics and must remain absent or `false`.
- Submission decisions, protected user administration, temporary access grants, and duplicate checks are trusted callable-only paths. Firestore Rules deny browser writes to protected decision, role, account-status, access-status, ownership, audit, event, notification-result, rate-limit, idempotency, and canonical-uniqueness state.
- `approveSupplierSubmissionTrusted`, `decideSupplierSubmissionTrusted`, `setUserRoleAndStatusTrusted`, `grantTemporaryAccessTrusted`, and `checkSupplierDuplicatesTrusted` are not claim-feature gated because they replace existing protected browser behavior or support the existing Add Supplier workflow.
- Local Emulator use does not require billing. Production Functions deployment requires the Firebase project to be on Blaze; billing verification or account linking requires separate explicit approval.

## Bounded backend state

- Claim search uses one `supplierClaimSearchRateLimits/{uid}` document per user. Fields are `userId`, `windowStartedAt`, `requestCount`, `lastRequestAt`, and `expiresAt`. A transaction enforces at most 10 requests in a fixed 60-second window. Each successful request rewrites the same document and extends `expiresAt` by one day, so storage is bounded per authenticated user. A Firestore TTL policy may later target `expiresAt`, but no TTL setting or scheduled cleanup is part of this PR.
- Claim idempotency uses `supplierOwnershipClaimRequests/{sha256(idempotencyKey)}`. Each document binds the key to `claimantUserId`, a stable `payloadHash`, the resulting `claimId`, and `expiresAt`. Identical retries return the original result; changed payloads and cross-user reuse fail closed.
- Approval uniqueness uses `supplierCanonicalUniqueness/{sha256(kind:value)}` documents created in the same transaction as the Supplier and all side effects. The documents contain only the fingerprint hash, fingerprint kind, resulting `supplierId`, and `submissionId`; canonical contact values are not stored. Existing Supplier and duplicate-index queries remain bounded guards. No Production Supplier rewrite or backfill is required or permitted.
- App Check enforcement is a later deployment-hardening option after Console configuration and rollout analysis. This PR does not enable or require App Check; current protection is authenticated current-state authorization, bounded queries, and the durable per-UID limiter.

## Claim index review

The three `supplierOwnershipClaims` composite indexes are intentional:

- `supplierProfileId + status + createdAt` is used by the current trusted approval conflict query.
- `status + createdAt` is retained for the planned PR 2 bounded Admin review queue.
- `claimantUserId + createdAt` is retained for the planned PR 2 bounded claimant history query.

The latter two indexes do not authorize or expose data by themselves, PR 2 remains out of scope, and no unrelated index was changed.

## Required future deployment sequence

Do not deploy from this implementation task. After second independent review, merge, exact-head CI, and separate deployment approval:

1. Re-verify `main`, the exact release commit, current Hosting release, active Ruleset, index readiness, Production Supplier counts, and protected TEST records using bounded read-only checks.
2. Confirm the Firebase project's existing billing eligibility and Firestore location read-only. Do not link or change a billing account.
3. Deploy only `firestore:indexes` and wait until all three `supplierOwnershipClaims` indexes are `READY`.
4. Deploy only these Node 22 Functions in `us-central1`:
   - `searchSupplierProfilesForClaim`
   - `createSupplierOwnershipClaim`
   - `withdrawSupplierOwnershipClaim`
   - `decideSupplierOwnershipClaim`
   - `checkSupplierDuplicatesTrusted`
   - `approveSupplierSubmissionTrusted`
   - `decideSupplierSubmissionTrusted`
   - `setUserRoleAndStatusTrusted`
   - `grantTemporaryAccessTrusted`
5. Verify both Claim gates remain false. Do not create a Production claim or run a write-capable smoke test.
6. In the same maintenance window, deploy Hosting for the exact reviewed commit. Hosting must switch existing Admin submission, role/status, temporary-access, and Add Supplier duplicate-check clients to trusted callables before restrictive Rules become active.
7. Perform bounded read-only verification that the application loads, the Claim UI remains absent, authentication works, and Admin/Owner review routes load without invoking a decision.
8. Deploy only `firestore:rules`. This closes browser bypasses after the trusted client and Functions are available.
9. Repeat bounded read-only verification. Do not deploy Storage, Auth, DNS, App Check, Extensions, or unrelated Firebase targets.

PR 2 may add UI and enablement only after this sequence is complete and separately approved.

## Rollback

- Code: revert the reviewed implementation commit in a new PR; do not rewrite shared history.
- Hosting: roll back to the deployment-time verified prior Hosting release. The implementation baseline reference is release `1785332157811000`, version `42b95b8aad86e7a0`; re-verify before using it.
- Rules: restore the deployment-time prior verified Ruleset if the new client/server path cannot operate safely.
- Functions: redeploy the last known-good Functions source. Because no Functions runtime existed before this work, deleting these Functions is a separate destructive deployment action and requires explicit approval; roll back Hosting and Rules first so existing Admin workflows are not stranded.
- Indexes: the three Claim indexes may remain while no Claim data or UI is enabled.
- Data: never undo an approved ownership link through raw `users` or `suppliers` edits. A future revoke or transfer must be a separately reviewed audited backend transaction.
- No migration, seed, backfill, bulk update, Supplier rewrite, TEST cleanup, Console change, billing link, or Production write is part of deployment or rollback.
