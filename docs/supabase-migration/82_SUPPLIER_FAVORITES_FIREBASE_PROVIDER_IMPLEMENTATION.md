# Supplier favorites Firebase Provider implementation

Status: **D21 COMPLETE / REVIEWED / MANUALLY MERGED**

Date: 2026-08-22
Verified starting GitHub `main`: `a8a74ba79f71b9619a90025c9e6ad74439d3f711`
Selected Provider feature: `supplier_favorites`
Selected operation: `listFavorites(userId)`
Risk: **Medium** — the read is user-specific, but its UID argument and Firestore ownership predicate are already explicit and unchanged.

## Selection and bounded scope

`listFavorites(userId)` is the next smallest useful configured Firebase read. It is active in the Buyer dashboard, Buyer favorites workspace, and Buyer supplier-profile control. All three callers derive the argument directly from the existing authenticated `firebaseUser.uid`; no identity mapping, Auth bridge, role translation, or public API change is required.

It is narrower than `getPlatformSettings()` (broad product/write coupling), review and feedback reads (multi-audience moderation), operational reporting and audit evidence (cached cross-aggregate or sensitive reads), and supplier-search AI intent (external AI capability, not a datastore seam). Existing Provider Contract ownership is unambiguous: the shipped manifest already contains `supplier_favorites` with Firebase authority.

## Exact parity and security contract

Demo/local remains before Provider resolution. It reads `mujahiz-iq-workspace:favorites`, returns `[]` for absent or invalid JSON, filters `item.userId === userId`, and applies the existing newest-first client sort. This behavior is application mode, not a configured-Firebase fallback.

The configured adapter constructs `collection(db, "favorites")` without a read. On each `listFavorites(userId)` call it performs exactly one:

```text
getDocs(query(favorites, where("userId", "==", userId), limit(250)))
```

There is no Firestore `orderBy`, cursor, pagination request, cache, retry, realtime subscription, normalization, or service catch. It maps every selected snapshot as `{ id: snapshot.id, ...snapshot.data() }`, so stored `id` overwrites the snapshot ID, then applies the existing newest-first client sort after Firestore's 250-result limit. An empty snapshot returns `[]`; query, read, and mapping failures reject unchanged.

The selected read does not alter the explicit caller identity contract. The Buyer dashboard and favorites workspace are inside the Buyer route boundary; the supplier profile route is inside the buyer/active-access boundary and its favorite control also checks buyer account type. These application boundaries are distinct from Firestore authorization. The active `firestore.rbac.rules` rule remains:

```text
match /favorites/{favoriteId} {
  allow read: if signedIn() && resource.data.userId == request.auth.uid;
}
```

`firestore.indexes.json` has no `favorites` composite entry; the unchanged single equality query requires no repository-managed composite index. `saveFavorite(...)` and `removeFavorite(...)` are identified adjacent deterministic-ID writes and remain inline, unchanged, and out of this extraction.

## Provider composition and safety boundaries

D21 adds exactly one `SupplierFavoritesImplementation`, one Firebase adapter object and instance, one `supplierFavoritesImplementations` registry, and one `resolveSupplierFavoritesImplementation()` resolver call. Demo/local remains before that resolver. On configured paths, the common resolver preserves fail-closed `provider_config_missing`, `provider_config_invalid`, `provider_feature_unknown`, `provider_identity_invalid`, and `provider_implementation_unsupported` behavior; a synthetic Supabase authority selection fails before Firebase or local fallback.

Firebase remains authoritative for the complete favorites aggregate. No Provider manifest change, Supabase SDK/client/network capability, fallback, probing, dual read/write, Rules/index/Auth/configuration change, SQL/RLS, migration, hosted action, Firebase deployment, or Production/TEST data action is included. D21 resolves none of the seven Open gates: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## Final review, merge, and carried findings

D21 implementation head `80a1db1b59f50ef1e0a6a2bba55b2834b2e410ea` received an independent exact-head review of 0 Critical, 0 High, 0 Medium, 2 Low, and 0 Nit. Independent focused validation passed 54/54; the full repository unit suite passed 265/265; `tsc -b --pretty false`, Vite production build, and `git diff --check` passed. PR Gate #275 / run `32594492895` succeeded on that exact head. PR #164 was manually merged as GitHub `main` `29c34d90aa902bd8df0b1977c92383905b99e9b5`; Firebase Production was not deployed and no Production/TEST data action occurred.

D21 Low 1 remains open/non-blocking: the adapter's local date-conversion/newest-first helper is behaviorally equivalent to the existing shared implementation but creates future parity-drift maintenance risk. D21 Low 2 remains open/non-blocking: focused tests do not directly exercise Date, invalid date-string, Timestamp-like, and absent timestamp values, though current behavior was manually proven. D22 does not naturally modify the favorites adapter or harness, so neither finding is changed. The D20 direct-rule/route test-precision Low and D16 formatting-sensitive Nit are likewise unchanged.
