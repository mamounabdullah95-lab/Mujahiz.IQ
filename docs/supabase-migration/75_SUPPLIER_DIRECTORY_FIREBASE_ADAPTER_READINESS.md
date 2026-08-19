# `supplier_directory` Firebase adapter readiness

Status: **D7 readiness contract complete, independently reviewed, and manually merged through PR #150; D8 Firebase-only implementation head `65d7d199c38c628ef25e6fc31ec5e5bb95deaca9` passed independent exact-head review and PR Gate #258, then PR #151 was manually merged as GitHub `main` `56de751ef80325e443aecbf07393e4737626158d`; no Firebase Production deployment occurred**

Date: 2026-08-19

## 1. Verified starting point and authority

D7 started from clean `origin/main` `1c9b49ef74a92ccc652a65e30ef8b2f57bb44216`, the manual merge of PR #149 and completion of D6 Package D synchronization. Its independent exact-head review passed on `b3aff41e5e7d9561dc4870f033f1d2f7ec390caa` with 0 Critical, 0 High, and 0 Medium findings; PR Gate #257 passed, and PR #150 was manually merged as `586a1922e71c91110177567b9a5e4ff96187d68c`. Firebase remains the live Production backend, Auth, database, and hosting authority. GitHub `main` and Firebase live Production must not be assumed identical. Supabase remains local-only, unlinked, undeployed, and non-authoritative.

The shipped provider vocabulary already contains `supplier_directory`, and the immutable shipped manifest selects `firebase`. The merged aggregate definition includes approved Supplier records, public/profile reads, approved-profile maintenance, duplicate identity state, and directory candidate queries. D7 selects only the smallest coherent current **read** subset. It does not change that wider aggregate or authorize a partial provider cutover.

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`. None blocks this documentation-only read-seam contract.

## 2. Selected bounded seam

### In scope

The selected seam is the four existing `src/services/firestore.ts` reads that obtain Supplier directory/profile records from the `suppliers` collection:

| Function | Direct callers and product use | Why it belongs |
| --- | --- | --- |
| `listSuppliers()` | `AdminApprovedSuppliersPage`; `AdminDashboardPage`; `portalDashboard` in Demo/local metric loading | Reads the complete approved Supplier directory set for approved-profile maintenance and counts. |
| `listSuppliersPage(pageSize, cursor)` | `DirectoryPage` initial and subsequent directory pages | Primary paginated directory discovery read. |
| `listSupplierCandidates(categories)` | `DirectoryPage` smart recommendations; `BuyerWorkspacePages` RFQ-recipient candidates | Discovers Supplier records by directory category. An RFQ caller consumes the result, but the record/query authority remains `supplier_directory`. |
| `getSupplier(supplierId)` | `SupplierProfilePage`; `AddSupplierPage`; `BuyerWorkspacePages`; `SupplierWorkspacePages` | Reads the same Supplier profile record used by the directory detail route and shared profile consumers. The shared callers do not create a second record authority. |

All four operations are read-only, use the same `Supplier` mapping helper or its Demo/local equivalent, and have no function-level cache or read-through wrapper. `portalDashboard` has its own 60-second metrics cache outside this seam; configured Firebase metrics use aggregate count queries directly rather than `listSuppliers()`.

### Why this boundary is coherent

The directory page links its list results to the Supplier profile page, so listing, category candidate discovery, and one-record profile retrieval form one observable directory read surface. The unpaginated approved list serves maintenance/counting consumers of the same approved records. Extracting these four reads later can preserve one Firebase authority without moving any Supplier write, duplicate-index, submission, review, Claim, RFQ, taxonomy, or AI-intent command.

This is a bounded Firebase-adapter extraction contract, not a claim that the four reads are the entire `supplier_directory` aggregate. The merged aggregate remains a single-authority cutover unit for any future provider migration.

## 3. Candidate inventory and excluded seams

| Candidate | D7 decision | Reason |
| --- | --- | --- |
| `listSuppliers()` | Included | Same approved Supplier records; no write behavior. |
| `listSuppliersPage(...)` | Included | Direct directory pagination surface. |
| `listSupplierCandidates(...)` | Included | Direct directory and RFQ candidate-discovery surface. |
| `getSupplier(...)` | Included | Directory profile detail and shared Supplier-record read. |
| `listSupplierReviews(...)` and other review reads | Excluded | `supplier_reviews` is a separate provider feature. |
| `listMaterialTerms()` and term suggestion reads | Excluded | `supplier_taxonomy_dictionary` is a separate provider feature. |
| Firebase AI intent parsing and local recommendation/ranking | Excluded | AI parsing is `supplier_search_ai_intent`; local ranking is application logic, not the Supplier record adapter. |
| Supplier submissions, duplicate-check submission state, imports, and approval decisions | Excluded | Submission lifecycle and its writes belong to `supplier_submissions`; D7 is directory-read readiness only. |
| Supplier ownership/Claim reads and commands | Excluded | Separate `supplier_ownership_claims` authority and explicit D7 prohibition. |
| `updateApprovedSupplier(...)`, `deleteApprovedSupplier(...)`, and approval-created Supplier writes | Excluded | Write/security/audit/duplicate-index effects require a later independently approved contract. |
| Supplier workspace products/documents and RFQ lifecycle reads | Excluded | Private catalog and RFQ aggregates are separate provider features. |
| Portal aggregate counts/cache | Excluded | `operational_reporting` owns the metrics projection; the configured path already counts directly. |

No cache invalidation, write-through, submission handoff, ownership check, Rules/index change, or provider-manifest change belongs to D7.

## 4. Exact configured-Firebase behavior

The source uses `collection(db, "suppliers")`. Firestore Standard edition normalizes a query with no explicit `orderBy` by appending `__name__ ASC`; Firebase also documents that queries return matching documents in ascending document-ID order by default. D7 records that current Firestore-native order but does not add application sorting. See the official [get-data default-order statement](https://firebase.google.com/docs/firestore/query-data/get-data), [index ordering rules](https://firebase.google.com/docs/firestore/query-data/index-overview#default_ordering_and_the__name___field), and [cursor pagination guide](https://firebase.google.com/docs/firestore/query-data/query-cursors).

### Shared mapping and errors

Configured Firebase results use:

```text
{ id: snapshot.id, ...snapshot.data() } as Supplier
```

Consequences:

- the Firestore document ID supplies `id` only when stored data has no `id` property;
- a stored `id` property overwrites `snapshot.id` because data is spread second; this is a known current quirk, not a D7 redesign;
- no runtime schema validation, projection, normalization, or defaulting occurs;
- ordinary missing fields remain absent even though the result is cast to `Supplier`;
- query/read/permission/index/network errors are not normalized and reject the returned promise; and
- no selected operation has a retry, cache, alternate-provider query, or Demo substitute after a configured Firebase failure.

Individual UI callers may catch a rejected promise and show an empty/current in-memory result. That is caller-level error handling, not backend provider fallback; the service itself still rejects and never queries Demo or another provider.

### `listSuppliers()`

```text
query(suppliers, where("status", "==", "approved"))
```

- Returns every matching document; there is no explicit limit or application-level sort.
- Firestore's implicit order is `__name__ ASC` because the equality value is fixed and no explicit order exists.
- Missing `status` and every non-`approved` status are excluded by Firestore.
- Empty results return `[]`.
- Other missing fields pass through unchanged under the shared mapping.

### `listSuppliersPage(pageSize = 50, cursor = null)`

The configured query is:

```text
query(
  suppliers,
  where("status", "==", "approved"),
  cursor is a non-number snapshot ? startAfter(cursor) : no cursor constraint,
  limit(pageSize),
)
```

- The function default is 50. The only current `DirectoryPage` calls request exactly 100.
- A Firebase page cursor is the raw last `QueryDocumentSnapshot<DocumentData>` returned by the preceding non-empty page.
- A `null` cursor requests the first page. A numeric cursor is deliberately ignored on the configured Firebase path and therefore also requests the first page; numbers exist only for the Demo/local offset branch.
- Results retain Firestore's implicit `__name__ ASC` order. `startAfter(snapshot)` excludes the cursor document and continues in that order.
- `items` uses the shared mapping.
- `cursor` is the last returned snapshot, or `null` when the page is empty.
- `hasMore` is exactly `snapshot.docs.length === pageSize`. It is a full-page heuristic, not proof that another document exists; a terminal page containing exactly `pageSize` documents reports `true`, and a following empty request reports `false`.
- A partial final page reports `false`; an empty first page returns `{ items: [], cursor: null, hasMore: false }` for a positive page size.
- The Firebase Web SDK rejects zero or negative limits during query construction. Other invalid cursor/query inputs and Firestore errors propagate.
- The raw Firebase snapshot cursor in the public service type is a known provider-coupling quirk. A later Firebase-only extraction must preserve current callers. Designing a provider-neutral migration cursor is a separate versioned architecture decision before any non-Firebase cutover.

### `listSupplierCandidates(categories)`

Configured Firebase returns `[]` without a Firestore call when `categories.length === 0`. Otherwise it executes:

```text
query(
  suppliers,
  where("categories", "array-contains-any", categories.slice(0, 10)),
  limit(100),
)
```

and then applies:

```text
status === "approved" && canReceiveRfqs === true
```

- Only the first ten caller-supplied category values participate, even though current Firestore Standard edition supports up to 30 `array-contains-any` disjunctions. The application cap of ten is the current contract and must not be silently widened. See the official [Firestore query limitations](https://firebase.google.com/docs/firestore/query-data/queries#query_limitations).
- Firestore matches a document whose `categories` array contains any selected value and returns a matching document only once even when multiple values match.
- There is no Firestore `status` or `canReceiveRfqs` filter. The 100-document limit is applied **before** application filtering. Consequently, rejected/non-approved/non-RFQ-capable matches can consume the query limit and the returned array can contain fewer than 100 eligible records even when later eligible records exist.
- `status` must equal the exact string `approved`, and `canReceiveRfqs` must equal the exact boolean `true`; missing or other values are removed.
- No application sort follows filtering; the retained subset stays in Firestore's implicit `__name__ ASC` order.
- Empty results return `[]`; query and mapping-time errors reject.

### `getSupplier(supplierId)`

```text
getDoc(doc(suppliers, supplierId))
```

- Reads exactly one document ID and performs no `status`, approval, ownership, or RFQ-capability filter.
- An existing document uses the shared mapping, including the stored-`id` overwrite quirk.
- A missing document returns `null`.
- Missing Supplier fields otherwise pass through unchanged.
- Invalid document-path input, permission failure, network failure, and other Firebase errors reject.

The absence of an approval filter is current shared profile-read behavior. D7 does not silently harden or broaden visibility. Firestore Rules independently require `hasActiveAccess()` for Supplier reads; D7 does not change or re-prove that authorization policy.

## 5. Exact Demo/local application behavior

`isFirebaseConfigured === false` is checked before any future provider resolution and delegates to `src/services/localDemo.ts`. This is intentional application Demo/local behavior, not a provider identity, backend fallback, emulator alias, or parity claim.

| Operation | Current Demo/local behavior |
| --- | --- |
| `listSuppliers()` | Reads the local Demo database, filters exact `status === "approved"`, preserves stored array order, and has no limit. |
| `listSuppliersPage(pageSize, cursor)` | Treats a numeric cursor as an offset and any Firebase snapshot/non-number as offset 0; filters approved records; sorts by `String(updatedAt)` descending using `localeCompare`; slices `[offset, offset + pageSize)`; returns numeric `cursor = offset + items.length`; and computes exact `hasMore = cursor < approvedCount`. |
| `listSupplierCandidates(categories)` | Filters local approved records whose `categories` overlap **any** supplied category; preserves stored order; does not truncate categories to ten; has no 100-record limit; and does **not** require `canReceiveRfqs === true`. Empty categories still produce `[]`. |
| `getSupplier(supplierId)` | Returns the first exact local `id` match regardless of status, or `null`. |

These Firebase-versus-Demo differences are existing observable behavior. D7 records them and does not make Demo a backend implementation or force Firestore semantics onto local data.

If Firebase is configured and a future Firebase adapter or resolver fails:

- do not read Demo/local data;
- do not query Supabase or another provider;
- do not probe or dual-read;
- let the service promise reject under the current error boundary; and
- allow existing callers to apply their own UI-level handling without reclassifying that handling as provider fallback.

## 6. Provider and fail-closed boundary

The later Firebase-only implementation shape is:

```text
current caller
  -> firestore service facade / explicit Demo-local gate
  -> provider resolver(feature = "supplier_directory")
  -> registered Firebase supplier-directory read adapter
  -> Firestore suppliers collection
```

Required future boundaries:

1. Keep `supplier_directory` as the exact feature ID and keep the shipped selection `firebase`.
2. Register only the bounded Firebase implementation required by the later task.
3. Resolve exactly one selected implementation; never probe, fall back, dual-read, or dual-write.
4. Make missing, malformed, unknown, invalid, or unsupported provider state fail with the existing provider-contract errors before any data read.
5. Perform no Supabase import, client initialization, configuration lookup, or network request while Firebase is selected.
6. Keep provider selection out of pages and caller arguments.
7. Preserve the explicit Demo/local gate without registering `demo` or `local` as provider identities.
8. Do not use the read-only extraction to authorize Supplier writes or a partial aggregate cutover.

D7 does not register an adapter, modify the manifest, add Supabase code, or implement routing.

## 7. Future Firebase-adapter parity matrix

The later implementation must compare the existing inline Firebase seam with the extracted Firebase adapter at the same exact head. The provider remains Firebase.

| Operation/case | Required parity or fail-closed assertion | Best later evidence |
| --- | --- | --- |
| `listSuppliers`: query and mapping | Compose exact `status == approved` query with no limit or explicit application order; map the returned snapshots unchanged | Injected-dependency unit test |
| `listSuppliers`: Firestore filtering | Firestore excludes non-approved and missing-status documents under the equality query | Firestore-owned semantics; do not fake in a unit test. Use a focused Emulator case only if later extraction creates a concrete integration evidence gap. |
| `listSuppliers`: empty result | An empty query snapshot maps to `[]` | Injected-dependency unit test |
| Shared document mapping | Preserve `{ id: snapshot.id, ...data }`, including a stored `id` overriding the snapshot ID and absent optional fields remaining absent | Unit test with synthetic snapshots |
| `listSuppliersPage`: defaults/current caller | Default limit 50 and current directory request 100 passed unchanged | Unit/static assertion |
| Pagination first page | No `startAfter`; approved filter; exact requested limit; raw last snapshot cursor | Injected-dependency unit test |
| Pagination next page | Same snapshot passed to `startAfter`; cursor document excluded; returned cursor is new last snapshot | Unit test; focused Emulator test adds genuine SDK/cursor value |
| Pagination empty/partial | Empty gives `[]/null/false`; partial page gives `hasMore: false` | Unit test |
| Pagination exact-full terminal page | `hasMore` remains `true` solely because length equals page size, even if no next record exists | Unit test; optional Emulator sequence |
| Pagination provider-specific cursor | Configured numeric cursor is ignored; Demo snapshot/non-number resets offset to 0; no unapproved neutral-cursor redesign | Unit/static test |
| Candidate empty categories | Return `[]` before configured Firestore networking | Unit test with zero `getDocs` calls |
| Candidate category cap | Query uses only `categories.slice(0, 10)`; category 11+ does not participate | Unit test |
| Candidate query shape | Exact `array-contains-any` plus `limit(100)` and no Firestore status/RFQ filter | Unit/static test |
| Candidate platform behavior | Any selected category matches; multi-match document returned once; implicit ordering retained | Focused Emulator test only if this platform behavior needs integration proof |
| Candidate post-limit filtering | The 100-query limit precedes exact `approved && canReceiveRfqs === true` filtering; ineligible matches may reduce returned count | Unit test; Emulator valuable for one representative boundary fixture |
| Candidate missing fields | Missing/wrong `status` or non-boolean/missing `canReceiveRfqs` excluded; other missing fields pass through | Unit test |
| `getSupplier`: found/missing | Exact document path; no status filter; found mapping unchanged; missing returns `null` | Injected-dependency unit test |
| Read/query errors | Construction, permission, index, network, and injected `getDoc/getDocs` failures reject without normalization or alternate data | Unit tests; no live Production call |
| Demo/local matrix | All four explicit local behaviors above remain before provider resolution and retain their current differences | Focused local-service tests/static assertions |
| Unsupported/misconfigured provider | Existing resolver codes fail closed before adapter execution | Focused provider-contract/runtime-policy tests |
| Firebase authority networking | Firebase selection performs zero Supabase imports/client initialization/network calls | Source/static architecture assertion |
| No fallback/dual-read | Configured Firebase failure produces no Demo or alternate-provider result and invokes no second implementation | Unit test with call counters |

Do not create fake unit tests for Firestore-owned query semantics. Injected dependencies are sufficient for query composition, mapping, filtering, error propagation, resolver selection, and call counts. A focused Emulator test later adds real value for snapshot cursor continuation and one representative `array-contains-any`/limit-before-filter sequence. No Production read, full Emulator suite, E2E suite, or Firebase deployment is justified merely by D7.

## 8. Risks and known current quirks

- The public pagination cursor is Firebase-native in configured mode and numeric in Demo/local mode. D7 preserves this for a Firebase-only extraction; non-Firebase cursor design remains unresolved and unauthorized.
- `withId` allows stored data to overwrite the Firestore document ID.
- `listSupplierCandidates` limits before application eligibility filtering, so ineligible matches can crowd out eligible Suppliers.
- Candidate Demo/local behavior does not require `canReceiveRfqs`, has no ten-category cap, and has no 100-result cap.
- Firebase directory ordering is implicit `__name__ ASC`; Demo pagination sorts by stringified `updatedAt DESC`. No cross-mode ordering parity exists today.
- `hasMore` is heuristic under Firebase but exact against the local array in Demo mode.
- `getSupplier` has no approval filter and serves public/profile plus privileged/shared workspace callers. D7 preserves source behavior and does not change Rules or UI visibility.
- `listSuppliers()` is unbounded. D7 records the current surface and does not redesign it.
- Some callers intentionally catch candidate/profile failures and show empty or already-loaded records; this does not invoke a second backend.

None of these current quirks is corrected in readiness-only D7. Any behavioral change requires an explicit later scope and tests.

## 9. Production, data, security, and deployment boundaries

- Production/data impact: **NONE**. No Firebase Production or TEST data was accessed, copied, mutated, seeded, migrated, backfilled, or deleted.
- Runtime capability impact: **NONE**. No Firebase adapter, Supabase adapter/client/import/configuration/networking, provider routing, fallback, dual-read, or dual-write was added.
- Security impact: **NONE**. No Firebase Auth, Firestore Rules, indexes, roles, grants, SQL, RLS, ownership, Claim, or privileged-provider behavior changed.
- Deployment impact: **NONE**. No Hosting, Functions, Storage, Rules, indexes, Firebase configuration, hosted Supabase, DNS, billing, or application deployment occurred.
- Data classification remains unchanged: listed, approved, claimed, verified, RFQ-ready, active, and paying Suppliers are distinct states. D7 does not relabel counts or records.

## 10. Exact D7 stop point and next gate

D7 stops after investigation, this readiness contract, minimum Baseline/queue synchronization, internal review, focused documentation/provider-boundary validation, commit, branch push, and one Draft PR if available.

D7 explicitly stops before:

- an independent readiness review;
- any correction requested by that future review;
- manual merge;
- Firebase adapter creation or service rewiring;
- provider-manifest or provider-selection change;
- Supabase implementation or networking;
- Rules/index/Auth/SQL/RLS change;
- Production/TEST data access or mutation; and
- deployment.

The next gate is an **independent exact-head D7 readiness review**. No implementation task is authorized until that review passes, any reviewed head is manually merged through the required sequence, and the later implementation scope is separately started.
