# `user_profiles_access` Firebase adapter readiness

Status: **D1 readiness contract merged; D2 passed; D3 complete; D4 adapter implementation merged; no Production deployment authorized or implied**

Date: 2026-08-19

## 1. Verified scope and starting point

This D1 contract covers only the existing bounded read seam at [`src/services/adminUsers.ts`](../../src/services/adminUsers.ts). The D1 starting point was `origin/main` `f8dff27c69c05f567920f97e471dc4a06ed68c9b`, the manual merge of PR #146 and completed Package C synchronization. The current verified `origin/main` is `852ec65370698d667b59d9d9cc4a7c8caef4377e`, the manual merge of PR #148, whose D4 implementation head was `5d8834f30535b5de74bb3ec80cc70110576287fe`.

This task defines readiness and parity boundaries only. It does not add a Firebase adapter, Supabase adapter, provider routing, Auth behavior, dependency, configuration, network capability, migration, data operation, or deployment. It does not claim that this one read service represents the full `user_profiles_access` aggregate or every administrative user capability: role/status administration, activation/deactivation, access grants/credits, administrative commands, and other user-management operations remain outside this seam.

## 2. Current provider and caller contract

- Feature ID: `user_profiles_access`.
- Current provider: Firebase, through the existing direct service facade.
- Public service: `listAdministrativeUsers()`; it accepts no arguments and returns a promise of administrative user records.
- Caller expectation: callers receive the current application `AppUser` shape and must not receive provider identifiers or choose a provider.
- Current implementation path: `isFirebaseConfigured === true` reads Firestore; `isFirebaseConfigured === false` delegates to the existing `listUsers()` Demo/local path.

The Demo/local path is an application runtime mode of the current Firebase-oriented service surface. It is not a backend provider and is not provider failover.

## 3. Current Firebase behavior

When Firebase is configured, the facade executes the equivalent of:

```text
collection(db, "users")
  |> orderBy("createdAt", "desc")
  |> limit(500)
```

Each returned document is transformed to `{ ...item.data(), uid: item.id }` and treated as `AppUser`. The document ID is therefore authoritative for the returned `uid`; a stored `uid` field, if present, is overwritten by the document ID. Other stored fields pass through without a service-level projection or normalization.

The current contract is:

- sorting is descending by `createdAt`;
- the maximum result count is 500;
- empty query results return an empty array;
- ordinary optional or missing stored fields are not synthesized, defaulted, or rejected by this facade; they pass through as absent properties;
- `createdAt` is not an ordinary optional field for this query: Firestore `orderBy("createdAt", "desc")` excludes documents without that field from the result set, even if their other stored fields are valid;
- equal `createdAt` values are deterministically ordered by Firestore's final document-path (`__name__`) ordering in the same descending direction; the first 500 documents are therefore selected by `(createdAt DESC, __name__ DESC)`, and equal-timestamp documents can fall inside or outside the 500-record boundary according to that order. This follows the official [Firestore order-by existence rule](https://firebase.google.com/docs/firestore/query-data/queries#orderBy_and_existence) and [index `__name__` ordering rule](https://firebase.google.com/docs/firestore/query-data/index-overview#default_ordering_and_the__name___field);
- Firebase/Firestore errors from query construction or `getDocs` are not normalized or replaced by this facade and propagate to the caller;
- no second provider is queried when Firebase fails.

## 4. Demo/local behavior and forbidden reclassification

The exact current local behavior is:

```text
isFirebaseConfigured === false  ->  listUsers()
```

This is intentional Demo/local application behavior. It is explicitly not:

- Firebase → Supabase fallback;
- Supabase → Firebase fallback;
- automatic provider failover;
- dual-read; or
- dual-write.

The Demo/local path must not be used to mask a real Firebase or future selected-provider failure in Production-like execution.

## 5. Future adapter fail-closed requirements

Any future implementation must preserve the provider-contract kernel and these boundaries:

1. Resolve and execute the selected provider only for `user_profiles_access`.
2. Never silently switch providers, probe alternatives, or retry through another provider.
3. Perform no Supabase networking, dynamic import, or client initialization while Firebase is selected.
4. Keep Demo/local behavior explicit and separate; never substitute Demo data for a real provider failure.
5. Fail explicitly for missing, malformed, unsupported, or otherwise misconfigured provider state.
6. Preserve the caller-visible contract or record an intentionally versioned contract change before implementation.
7. Keep provider selection outside callers and UI code.

No D1 change authorizes implementing these adapter behaviors.

## 6. D4 parity-test matrix

The future D4 parity review must compare current inline Firebase behavior with extracted Firebase adapter behavior using synthetic fixtures and isolated provider seams. The provider remains `firebase`. It is not Supabase successor implementation/cutover, Firebase-vs-Supabase parity, an Auth bridge, hosted Supabase, migration, or dual-provider runtime. At minimum it must cover:

| Case | Required parity or fail-closed assertion |
| --- | --- |
| Result shape | Same returned `AppUser` data shape and document/provider subject mapping; no provider identifier leaks. |
| Ordering | Same `createdAt` descending order, including equal timestamps ordered by Firestore document path (`__name__`) descending. |
| Missing `createdAt` | A document without `createdAt` is excluded consistently with the current ordered Firestore query; this is distinct from ordinary missing optional stored fields. |
| Limit and tied boundary | Same maximum of 500 records and identical behavior below the limit; tied records at the boundary are included/excluded exactly by `(createdAt DESC, __name__ DESC)`. |
| Empty results | Both providers return an empty array for an empty collection/result set. |
| Optional fields | Representative missing/optional fields remain absent or are handled identically; no undocumented defaults. |
| Firebase errors | Firebase query/read failures preserve the approved error boundary and are not hidden by another provider. |
| Demo/local | `isFirebaseConfigured === false → listUsers()` remains explicit local behavior and is not counted as provider parity. |
| Unsupported/misconfigured provider | Missing, invalid, or unsupported selection fails closed with an explicit contract error. |
| Selected-provider networking | No Supabase networking occurs when Firebase is selected. |
| No silent fallback | A selected-provider failure never produces alternate-provider or Demo data. |

D4 must preserve this current Firestore tie-breaking rule; D1 does not add, alter, or make configurable any query ordering.

## 7. Stop point and impact

- D1/D2/D3 result: readiness contract passed review and was manually merged through PR #147.
- D4 result: the Firebase adapter implementation was merged through PR #148; D5 exact-head review and validation passed. This document remains the readiness authority for the bounded seam and does not authorize a new adapter or provider cutover.
- Production/data impact: **NONE**. Firebase Production was not deployed or changed; no Firebase, Supabase, Production, TEST, or hosted data was accessed or changed by this synchronization.
- Deployment impact: **NONE**. No Hosting, Rules, indexes, Functions, Storage, Auth, DNS, migration, seed, backfill, or configuration action occurred.
- Explicit boundary: GitHub `main` contains D4 code, but GitHub `main` and Firebase live Production must not be assumed identical. Supabase remains local-only and undeployed.

Historical D1 stop point: complete D1 remediation, focused validation, commit, push, and Draft PR update; stop before the required D2 exact-head re-review, D3, D4, adapter implementation, provider rewiring, merge, or deployment. The current D6 stop point is recorded in the authoritative Baseline and queue; D4 is merged, while Production deployment and the next D7 readiness task remain out of scope.
