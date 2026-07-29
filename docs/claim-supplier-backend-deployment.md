# Claim Supplier Profile backend deployment and rollback

Status: implementation only; not deployed. The visible Claim Supplier Profile feature remains disabled and PR 2 is not included.

## Runtime and gates

- Functions generation: Firebase Functions v2 callable functions.
- Runtime: Node.js 20, the minimum fully supported Node runtime at implementation time.
- Region: `us-central1`, explicitly matching Firebase's documented default because this repository has no prior Functions/location configuration.
- Before Production deployment, verify the actual Firestore database location read-only. If cross-region latency/cost is not acceptable, stop and review a region change before deploying.
- Client gate: `VITE_SUPPLIER_PROFILE_CLAIM_ENABLED` uses strict `true` semantics and must remain absent or `false`.
- Backend claim gate: `CLAIM_SUPPLIER_PROFILE_ENABLED` uses strict `true` semantics and must remain absent or `false`.
- `approveSupplierSubmissionTrusted` and `setUserRoleAndStatusTrusted` are not claim-feature gated because they replace existing protected client writes.
- Local Emulator use does not require billing. Production Functions deployment requires the Firebase project to be on Blaze; billing verification or account linking requires separate explicit approval.

## Required future deployment sequence

Do not deploy from this implementation task. After review, merge, exact-head CI, and separate deployment approval:

1. Re-verify `main`, the exact release commit, current Hosting release, active Ruleset, index readiness, Production supplier counts, and protected TEST records using bounded read-only checks.
2. Confirm the Firebase project's existing billing eligibility without linking or changing a billing account.
3. Deploy only `firestore:indexes` and wait until all three new `supplierOwnershipClaims` indexes are `READY`.
4. Deploy only these Functions in `us-central1`:
   - `searchSupplierProfilesForClaim`
   - `createSupplierOwnershipClaim`
   - `withdrawSupplierOwnershipClaim`
   - `decideSupplierOwnershipClaim`
   - `approveSupplierSubmissionTrusted`
   - `setUserRoleAndStatusTrusted`
5. Verify both Claim gates are still false. Do not create a Production claim or run a write-capable smoke test.
6. Deploy Hosting for the exact reviewed commit. Hosting is required in this PR because the existing submission approval and role/status clients must switch to their trusted callable replacements before restrictive Rules become active.
7. Perform bounded read-only verification that the application loads, the Claim UI remains absent, authentication still works, and Admin/Owner review routes load without invoking a decision.
8. Deploy only `firestore:rules` after the new Hosting client is active. This closes direct protected ownership writes without creating an approval outage window.
9. Re-run bounded read-only verification. Do not deploy Storage, Auth, DNS, App Check, Extensions, or unrelated Firebase targets.

PR 2 may add UI and enablement only after this sequence is complete and separately approved.

## Rollback

- Code: revert the reviewed implementation commit in a new PR; do not rewrite shared history.
- Hosting: roll back to the deployment-time verified prior Hosting release. The implementation baseline reference is release `1785332157811000`, version `42b95b8aad86e7a0`; re-verify before using it.
- Rules: restore the deployment-time prior verified Ruleset if the new client/server path cannot operate safely.
- Functions: redeploy the last known-good Functions source. Because no Functions runtime existed before this work, deletion of these functions is a separate destructive deployment action and requires explicit approval; roll back Hosting and Rules first so existing Admin workflows are not stranded.
- Indexes: the three claim indexes may remain; they are harmless while no claim data/UI is enabled.
- Data: never undo an approved ownership link through raw `users` or `suppliers` field edits. A future revoke or transfer must be a separately reviewed audited backend transaction.
- No migration, seed, backfill, bulk update, Supplier rewrite, or TEST cleanup is part of deployment or rollback.
