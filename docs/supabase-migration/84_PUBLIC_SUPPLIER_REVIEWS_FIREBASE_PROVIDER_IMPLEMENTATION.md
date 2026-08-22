# Public supplier-review Firebase Provider implementation

Status: **D23 IMPLEMENTATION COMPLETE ON BRANCH / AWAITING INDEPENDENT EXACT-HEAD REVIEW**

Date: 2026-08-22
Verified starting GitHub `main`: `7a3e2fe86fc2cc4e4f62855c6baf871343544415`
Selected Provider feature: `supplier_reviews`
Selected operation: `listSupplierReviews(supplierId, includePending)`
Risk: **Medium** — a public-facing approved-review read with an unchanged active-Buyer Rule predicate and a retained no-caller pending branch.

## Selection and contract

The D22 `supplier_reviews` composition already owns this aggregate. `listSupplierReviews` is the one remaining active, configured Firestore read in that aggregate with a bounded extraction that needs neither identity translation nor a new API/Provider feature. Its only direct caller is `SupplierProfilePage`, which calls `listSupplierReviews(supplierId)` under `<RoleProtectedRoute allowedRoles={buyerRoles} requireAccess />`. The route supplies no user identity. The existing optional `includePending` parameter is retained exactly; repository search finds no direct runtime caller for its `true` form.

Demo/local remains before Provider resolution and delegates to `demoListSupplierReviews(supplierId, includePending)`. It filters local records by `supplierId` and, unless pending items are included, `status === "approved"`; it has no Firebase sorting or client cap. This is application-mode behavior, not configured-Firebase fallback.

Adapter construction creates `collection(db, "reviews")` and performs zero backend reads. Each configured call performs exactly one `getDocs` query. The default caller produces `where("supplierId", "==", supplierId)` and `where("status", "==", "approved")`; `includePending === true` produces only the supplier equality constraint. Neither path uses Firestore `orderBy`, limit, cursor, cache, retry, subscription, or catch. Every selected snapshot maps as `{ id: snapshot.id, ...snapshot.data() }`, so a stored `id` overwrites its snapshot ID. Results are then sorted newest-first with the pre-existing shared `toDate` and sliced client-side to 50. Empty snapshots return `[]`; query, read, mapping, and date-conversion errors reject unchanged.

The unchanged review Rule allows active Buyers to read `status == "approved"` records; D23 changes neither that Rule nor the route. The unchanged `reviews` supplier/status/createdAt index remains available but D23 adds no query ordering or index configuration. Review creation, moderation, pending-review administration, My Reviews, and every feedback operation remain unchanged and inline. Existing D22 `listMyReviews` continues to perform its separate self-review query, client sort, and 100-item cap.

## Provider and safety boundary

D23 extends only the existing `SupplierReviewsImplementation`, one Firebase adapter instance, one `supplierReviewsImplementations` registry, and one resolver. It creates no second Provider, registry, resolver, Firebase instance, or backend read at import/construction time. The shipped manifest already selects Firebase for `supplier_reviews`; synthetic unsupported Supabase selection still fails with `provider_implementation_unsupported` before Firebase or any fallback. Firebase remains the authority for the complete reviews aggregate.

D23 closes D22 Low 1 with direct deterministic tests for Timestamp-like and missing dates, injected date conversion failure, and exact 100-item retained window after sorting; it closes D22 Low 2 by using the existing `TimestampLike` type without any `never` cast. D21's two Lows, D20's test-precision Low, and D16's formatting-sensitive Nit remain unchanged.

No Provider manifest/vocabulary, Rules/index/Auth/configuration, Firebase Production/TEST data, Supabase capability, SQL/RLS, migration, deployment, fallback, probing, dual read, or dual write is included. The seven Open gates remain `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## Validation

Focused supplier-reviews adapter, Provider Contract, Firebase runtime, Demo mode, Firestore Rules, and route tests passed **38/38**. The full repository unit suite passed **275/275**. `tsc -b --pretty false`, Vite production build, and `git diff --check` passed. The initial sandboxed full suite and Vite build each hit the known esbuild directory-access restriction; one approved unrestricted rerun of each passed with no code change. One bounded correction loop adjusted the synthetic throwing-date test to include a second record so the existing sort comparator calls the injected converter.
