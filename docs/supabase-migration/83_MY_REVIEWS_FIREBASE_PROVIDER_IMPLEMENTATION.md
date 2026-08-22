# Buyer self-review Firebase Provider implementation

Status: **D22 COMPLETE / REVIEWED / MANUALLY MERGED**

Date: 2026-08-22
Verified starting GitHub `main`: `29c34d90aa902bd8df0b1977c92383905b99e9b5`
Selected Provider feature: `supplier_reviews`
Selected operation: `listMyReviews(userId)`
Risk: **Medium** — a Buyer-specific read with an explicit existing Firebase UID and Rule predicate.

## Selection

`listMyReviews(userId)` is the smallest active configured Firebase read that still bypassed its approved Provider Contract feature. Its only direct runtime caller is `MyReviewsPage`, which passes `firebaseUser.uid`; the route is Buyer-only and permits pending Buyers. The one-operation extraction does not require an identity mapping, new public API, Rule/Auth/index change, or lifecycle redesign.

`getPlatformSettings()` was deferred because it drives access/trial behavior, taxonomy, administration, onboarding, and adjacent privileged writes. Other review operations retain distinct public/active-Buyer, Supplier/Owner, and Admin-moderation audiences. Feedback retains Buyer/Admin moderation scope. Operational reporting and audit evidence retain cache/cross-aggregate or sensitive boundaries. `supplier_search_ai_intent` remains an external Firebase AI capability rather than a datastore read.

## Exact parity and security contract

Demo/local stays before Provider resolution and still delegates to `demoListMyReviews(userId)`, which filters Demo review records by `reviewedBy` without Firebase sorting or a client cap. This is application-mode behavior, not a configured-Firebase fallback.

The configured adapter constructs `collection(db, "reviews")` without reading. Each invocation performs exactly one:

```text
getDocs(query(reviews, where("reviewedBy", "==", userId)))
```

There is no configured `orderBy`, limit, cursor, cache, retry, subscription, or service catch. It maps each snapshot as `{ id: snapshot.id, ...snapshot.data() }`, so a stored `id` overwrites the snapshot ID, then applies the existing shared `toDate` newest-first sort and `slice(0, 100)` after the unbounded Firebase read. Empty snapshots return `[]`; query, read, and mapping failures reject unchanged.

The identity contract remains `firebaseUser.uid` from `MyReviewsPage`. The exact application route boundary remains `<RoleProtectedRoute allowedRoles={["buyer"]} allowPending />`. The unchanged Firestore Rule is:

```text
match /reviews/{reviewId} {
  allow read: if isAdmin() || (isBuyer() && hasActiveAccess() && resource.data.status == "approved") || (isBuyer() && resource.data.reviewedBy == request.auth.uid) || isOwnSupplierProfile(resource.data.supplierId);
}
```

The selected self-review query is authorized by its Buyer/self predicate. The repository's existing `reviews` `reviewedBy`/`createdAt` composite entry remains unchanged; this selected query has no `orderBy` and adds no index requirement. `submitSupplierReview`, `moderateReview`, `listSupplierReviews`, and `listPendingReviews` remain inline and unchanged.

## Provider, validation, and boundaries

D22 adds one `SupplierReviewsImplementation`, one Firebase adapter object and instance, one `supplierReviewsImplementations` registry, and one `resolveSupplierReviewsImplementation()` call. Adapter construction creates only a collection reference; focused synthetic tests prove zero backend reads until `listMyReviews` is called. The existing resolver preserves all five fail-closed errors, and a synthetic Supabase selection fails before Firebase invocation or fallback.

Focused adapter/Provider/runtime/Demo/route tests passed 33/33. The full repository unit suite passed 274/274; `tsc -b --pretty false` and Vite production build passed. Sandboxed full-suite/Vite attempts hit the known esbuild directory restriction; one approved unrestricted rerun of each passed without code changes. One bounded correction loop injected the existing shared date converter through the Provider composition to retain exact sorting behavior without adding a duplicate date helper.

Firebase remains authoritative for the complete reviews aggregate. No Provider manifest change, Supabase SDK/client/network capability, Rules/index/Auth/configuration change, SQL/RLS, migration, hosted action, Firebase deployment, Production/TEST data action, fallback, probing, dual read, or dual write is included. D22 resolves none of the seven Open gates: `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

D22 implementation head `1367efbc629c47cb7dc101e894185ce467ebbee3` received independent exact-head review of 0 Critical, 0 High, 0 Medium, 2 Low, and 0 Nit. Focused validation passed 33/33; the full repository unit suite passed 274/274; `tsc -b --pretty false`, Vite production build, and `git diff --check` passed. PR Gate #276 / run `32596612349` succeeded on that exact head. PR #165 was manually merged as GitHub `main` `7a3e2fe86fc2cc4e4f62855c6baf871343544415`.

D22 Low 1 (direct tests for Timestamp-like and missing `createdAt`, throwing injected `toDate`, and the exact retained sorted window above 100) and Low 2 (precise converter typing instead of `never`/`as never`) are closed by D23 because it extends this exact adapter and harness with no D22 behavior change. D21's two bounded Lows, D20's direct-rule/route precision Low, and D16's formatting-sensitive Nit remain unchanged.
