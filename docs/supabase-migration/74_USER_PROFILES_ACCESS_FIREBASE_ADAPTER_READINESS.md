# `user_profiles_access` Firebase adapter readiness

Status: **D1 readiness complete; documentation and task-state synchronization only; no adapter or runtime rewiring authorized**

Date: 2026-08-19

## 1. Verified scope and starting point

This D1 contract covers the existing read-only `user_profiles_access` facade at [`src/services/adminUsers.ts`](../../src/services/adminUsers.ts). The verified starting point is `origin/main` `f8dff27c69c05f567920f97e471dc4a06ed68c9b`, the manual merge of PR #146 and the completed Package C synchronization.

This task defines readiness and parity boundaries only. It does not add a Firebase adapter, Supabase adapter, provider routing, Auth behavior, dependency, configuration, network capability, migration, data operation, or deployment.

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
- optional or missing stored fields are not synthesized, defaulted, or rejected by this facade; they pass through as absent properties;
- the query requires the existing Firestore ordering semantics for `createdAt`;
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

The future D4 parity review must compare the Firebase implementation with the approved successor implementation using synthetic fixtures and isolated provider seams. At minimum it must cover:

| Case | Required parity or fail-closed assertion |
| --- | --- |
| Result shape | Same returned `AppUser` data shape and document/provider subject mapping; no provider identifier leaks. |
| Ordering | Same `createdAt` descending ordering under representative ties and normal values. |
| Limit | Same maximum of 500 records and identical behavior below the limit. |
| Empty results | Both providers return an empty array for an empty collection/result set. |
| Optional fields | Representative missing/optional fields remain absent or are handled identically; no undocumented defaults. |
| Firebase errors | Firebase query/read failures preserve the approved error boundary and are not hidden by another provider. |
| Demo/local | `isFirebaseConfigured === false → listUsers()` remains explicit local behavior and is not counted as provider parity. |
| Unsupported/misconfigured provider | Missing, invalid, or unsupported selection fails closed with an explicit contract error. |
| Selected-provider networking | No Supabase networking occurs when Firebase is selected. |
| No silent fallback | A selected-provider failure never produces alternate-provider or Demo data. |

D4 must define any necessary tie-breaking rule before claiming deterministic ordering where `createdAt` values are equal; D1 does not add one to the current Firebase query.

## 7. Stop point and impact

- D1 result: readiness contract recorded; implementation deferred.
- Production/data impact: **NONE**. No Firebase, Supabase, Production, TEST, or hosted data was accessed or changed.
- Deployment impact: **NONE**. No Hosting, Rules, indexes, Functions, Storage, Auth, DNS, migration, seed, backfill, or configuration action occurred.
- Explicit boundary: no adapter and no Supabase runtime implementation.

Exact stop point: complete D1 documentation/state synchronization, focused validation, commit, push, and Draft PR; stop before D2, D4, adapter implementation, provider rewiring, merge, or deployment.
