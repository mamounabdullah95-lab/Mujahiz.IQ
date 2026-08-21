# Published content page Firebase adapter readiness

Status: **D13 READINESS COMPLETE / AWAITING INDEPENDENT EXACT-HEAD REVIEW**

Date: 2026-08-20
Verified starting GitHub `main`: `4e0867e37b353e5b22e4451f606b964013faba48`
Selected Provider feature: `managed_content_config`
Selected operation: `getPublishedContentPage(slug)`
Risk: **Low**

## 1. Control-point result

D13 first synchronized D12 as `COMPLETE / REVIEWED / MANUALLY MERGED`. D12 implementation head `cc4a5a8a3653478d201b691a74c72e51a1a16b13` received independent exact-head review with 0 Critical, 0 High, 0 Medium, 0 Low, and 0 Nit findings. PR Gate #264 / run `32353894728` succeeded, and PR #155 was manually merged as GitHub `main` `4e0867e37b353e5b22e4451f606b964013faba48`.

D12 fully resolved D11's prior single-registry Low finding. The final taxonomy architecture is:

```text
supplier_taxonomy_dictionary
  -> one shared registry
  -> one Firebase implementation instance
  -> one resolver
  -> listMaterialTerms()
  -> listRegistrationSectors()
```

GitHub `main` contains D12. Firebase Production was not deployed, no Production/TEST data action occurred, no Supabase runtime capability was added, and Firebase remains authoritative for the complete current live feature set.

After independently evaluating the remaining configured reads, D13 selects exactly `getPublishedContentPage(slug)` as the next smallest dependency-safe Firebase-only adapter seam. D13 stops before runtime implementation.

## 2. Evidence sources

This contract is based on the current merged sources:

- [`providerContract.ts`](../../src/services/providers/providerContract.ts) for the closed 17-feature vocabulary, shipped all-Firebase manifest, and fail-closed resolver errors;
- [`workspace.ts`](../../src/services/workspace.ts) for Favorites, managed content/settings, registration-sector, and reporting behavior;
- [`firestore.ts`](../../src/services/firestore.ts) for platform settings, reviews, feedback, and audit behavior;
- [`PublicContentPage.tsx`](../../src/pages/PublicContentPage.tsx) for the selected operation's only direct caller and caller fallback;
- [`supplierSearchAI.ts`](../../src/services/supplierSearchAI.ts) for AI-intent behavior;
- [`portalDashboard.ts`](../../src/services/portalDashboard.ts) for additional operational-reporting coupling;
- [`firebase.json`](../../firebase.json) for the active Rules source;
- [`firestore.rbac.rules`](../../firestore.rbac.rules) for current authorization; and
- [`firestore.indexes.json`](../../firestore.indexes.json) for the repository-managed composite-index inventory.

No Production data or deployed Firebase state was inspected.

## 3. Current Provider vocabulary and composition

The Provider Contract vocabulary remains exactly 17 feature IDs:

1. `auth_identity`
2. `user_profiles_access`
3. `supplier_directory`
4. `supplier_taxonomy_dictionary`
5. `supplier_reviews`
6. `supplier_feedback`
7. `supplier_favorites`
8. `supplier_submissions`
9. `supplier_ownership_claims`
10. `rfq_quotations`
11. `notification_inbox`
12. `conversations_messages`
13. `supplier_private_catalog`
14. `managed_content_config`
15. `operational_reporting`
16. `audit_evidence`
17. `supplier_search_ai_intent`

The shipped manifest selects Firebase for every feature. Existing feature-specific composition exists for `user_profiles_access`, `supplier_directory`, and `supplier_taxonomy_dictionary`. There is no existing `managed_content_config` adapter, implementation interface, registry, or resolver. No Supabase implementation, client, import, query, or runtime network path exists for the selected seam.

## 4. Candidate matrix

| Feature / seam | Exact configured read and direct callers | Rules/Auth and identity | Coupling and semantics | Gate / complexity / risk | D13 result |
| --- | --- | --- | --- | --- | --- |
| `managed_content_config` / `getPublishedContentPage(slug)` | `contentPages`; `slug ==` caller slug; `status == "published"`; `limit(1)`. Only `PublicContentPage`. | Public only because the query constrains `status` to `published`; no actor/user ID. Active Rules also permit Owner reads. | Maps the first document with stored-`id` overwrite; no order/cache/retry/realtime; service errors propagate and caller converts them to static-content fallback. Adjacent content writes remain Owner-only and excluded. | No Open gate; one small feature-scoped registry is required; **Low**. | **Selected.** Smallest public, identity-free current seam with one caller and exact Rules/query alignment. |
| `managed_content_config` / `listContentPages(true)` | `contentPages`; `status == "published"`; `limit(100)`; application sort by numeric `order`. No current direct caller. | Public published-only Rules boundary; no identity argument. | Broader list and ordering surface than the selected method. | No gate; Low, but no current runtime seam. | Deferred because no direct runtime caller exists; extracting unused behavior is not the next bounded runtime step. |
| `managed_content_config` / `listContentPages(false)` | `contentPages`; `limit(100)` without status filter; Owner content-management page. | Query can return drafts, so Rules require Owner. | Shares Owner-only create/update/delete lifecycle; maps all records then sorts by `order`; no service catch. | No gate; Medium authorization/content-lifecycle scope. | Deferred. Includes unpublished content and privileged administration behavior. |
| `managed_content_config` / `getBrandingSettings()` | `getDoc(settings/branding)`; Owner branding page. | All `settings` reads require sign-in; route/caller is Owner. | Merges a six-field repository fallback; contains `assetUploadStatus`; adjacent Owner write forcibly keeps uploads pending. No catch/cache/realtime. | `FILE-001` adjacent; Low-Medium. | Deferred. Simpler Firestore primitive, but more security/capability coupling than the public selected read. |
| `managed_content_config` / `getAdminOperationsSettings()` | `getDoc(settings/adminOperations)`; Admin operations settings page. | Signed-in read; Admin/Owner write. | Merges four operational defaults controlling notifications, incomplete Supplier visibility, duplicate reason, and dictionary threshold. No catch/cache/realtime. | No direct gate; Medium behavior coupling. | Deferred. The result controls multiple privileged workflows and is coupled to its administration write. |
| `managed_content_config` / `getPlatformSettings()` | `getDoc(settings/platform)`; Taxonomy context plus access, dashboard, Admin user/submission/settings consumers. | Signed-in read; Owner write. | Wide repository-default merge; affects access periods, review incentives, taxonomy/default seeding, and administration behavior; adjacent write emits audit evidence. | No direct Open gate; Medium due to wide caller/security effects. | Deferred. Materially wider and more behavior-sensitive than the selected seam. |
| `supplier_favorites` / `listFavorites(userId)` | `favorites`; `userId ==` caller value; `limit(250)`; Buyer dashboard, Buyer favorites page, Supplier profile favorite state. | Private self-read. Rules require stored `userId == request.auth.uid`; service accepts caller-supplied `userId`. | `{ id: doc.id, ...data }`, then `sortNewest` by `updatedAt || createdAt`; no explicit query order. Adjacent save/delete use deterministic `${userId}_${supplierId}` ownership IDs. Callers respectively mask errors, show errors, or clear favorite state. | No gate; Medium security-contract risk. | Deferred. Tiny query, but actor/argument binding and private read/write ownership are materially harder than the identity-free public seam. |
| `supplier_reviews` / `listSupplierReviews(...)` | `reviews`; Supplier equality plus optional approved-status equality; Supplier profile caller. Service sorts by `createdAt` descending and truncates to 50. | Rules distinguish Admin, active Buyer approved visibility, self review, and owned Supplier. No actor argument on this method. | Caller masks errors as `[]`; adjacent moderation mutates review, Supplier rating/count, user points, settings, and audit log. | No gate; Medium-High. | Deferred for multi-audience Rules and cross-feature moderation effects. |
| `supplier_reviews` / `listMyReviews(userId)` | `reviews`; `reviewedBy ==` caller ID; My Reviews page. Sort/truncate to 100. | Private self audience is enforced by record Rules but identity is caller-supplied. | No service catch; caller has no rejection handler. Shares review submission/moderation lifecycle. | No gate; Medium. | Deferred for identity binding and lifecycle coupling. |
| `supplier_reviews` / `listPendingReviews()` | `reviews`; pending status; explicit `createdAt desc`; `limit(100)`; Admin moderation/dashboard and portal metrics. | Admin-only for pending records. | Service re-sorts/truncates; moderation has rating, points, settings, and audit side effects. | Existing composite index; Medium-High. | Deferred for privileged moderation and cross-feature coupling. |
| `supplier_feedback` / `listMySupplierFeedback(userId)` | `supplierFeedback`; submittedBy equality; `createdAt desc`; `limit(100)`; Supplier profile. | Private self read; identity is caller-supplied. | Caller masks errors as `[]` and filters by Supplier after fetching; adjacent create and Admin moderation/audit lifecycle. | Existing composite index; Medium. | Deferred for identity binding and private moderation lifecycle. |
| `supplier_feedback` / `listSupplierFeedback(statuses)` | Status equality or `in`; `createdAt desc`; `limit(100)`; Admin feedback/dashboard and portal metrics. | Admin-only for other users' feedback. | Default two-status lifecycle; service sorts/truncates; adjacent status update writes audit evidence. | Existing composite index; Medium-High. | Deferred for privileged/private content and moderation coupling. |
| `operational_reporting` / `getOperationalReport()` and portal metrics | Eleven cross-collection aggregate counts in workspace reporting; additional role-scoped counts in portal dashboard. One Admin reports caller plus dashboard consumers. | Admin/Owner route and Rules across users, Suppliers, submissions, grants, suggestions, reviews, and feedback. | `Promise.all`, differing Demo semantics, 60-second keyed read-through caches, manual force refresh, CSV export. | No gate; High. | Deferred. Cross-aggregate consistency, authorization, cache, and caller scope are not a bounded read seam. |
| `audit_evidence` / `listAuditLogs(pageSize, options)` | `auditLogs`; `createdAt desc`; bounded 1..100 limit; three Admin/Owner dashboard/log callers. | Highly sensitive. Rules allow Admin plus one special self-verification audit ID. | `{ id, ...data }`; 30-second page-size-keyed cache and manual force refresh; some callers lack rejection handlers. Writes are append-only and cross-feature. | No gate; High. | Deferred for sensitivity, audience boundary, append-only evidence coupling, and cache behavior. |
| `supplier_search_ai_intent` / `parseSupplierSearchWithGemini(...)` | Dynamic Firebase AI model call, not Firestore. Directory smart search is the only caller. | Feature flag plus Firebase configuration; sends query and taxonomy to external AI capability. | Dynamic import, schema-constrained generation, JSON parse/normalization, UI catch falling back to local intent. | Separately disabled capability; High/non-datastore. | Ineligible. It is not a datastore read adapter seam and enabling AI is outside D13 authority. |

No other current Provider feature exposes a materially smaller eligible configured read omitted from this matrix. Already extracted features were not reconsidered, and write-heavy/auth/RFQ/message/private-catalog/submission/claim seams were not promoted merely to fill the list.

The unextracted datastore candidates have no current feature-specific Provider implementation or registry. Because the shipped manifest already selects Firebase for all 17 features, a bounded Firebase-only extraction needs no vocabulary or manifest change and adds no Supabase/runtime/migration work. Current tests provide static Provider vocabulary/runtime policy coverage and focused reporting-cache/index coverage, but no focused behavioral parity test exists for `getPublishedContentPage`, Favorites, managed settings, reviews, feedback, or audit reads. The selected future adapter therefore requires its own focused synthetic parity test rather than relying on present route/static coverage.

## 5. Exact selected Firebase read

The current configured branch in [`workspace.ts`](../../src/services/workspace.ts) performs:

```text
getDocs(
  query(
    collection(db, "contentPages"),
    where("slug", "==", slug),
    where("status", "==", "published"),
    limit(1),
  ),
)
```

Exact behavior:

- collection: `contentPages`;
- filters: equality on exact caller-supplied `slug` and exact status `published`;
- limit: exactly 1;
- ordering: no explicit `orderBy`;
- pagination/cursor: none;
- result when empty: `null`;
- result when non-empty: the first snapshot document mapped through `withId<ContentPageRecord>`;
- mapping: `{ id: snapshot.id, ...snapshot.data() }`, so a stored `id` field overrides the snapshot ID;
- normalization/validation: none;
- cache: none;
- retry: none;
- realtime/subscription: none; and
- catch: none in the service; Firebase/query/mapping failures reject the Promise.

The repository-managed composite-index file has no `contentPages` entry. The current query uses equality filters only and D13 adds no index. If future implementation evidence shows Firebase requires a new index, implementation must stop rather than changing indexes within the adapter task.

## 6. Direct caller and caller behavior

The only direct runtime caller is [`PublicContentPage.tsx`](../../src/pages/PublicContentPage.tsx).

It maps each repository-controlled `PublicPageKey` to one fixed slug and invokes the service when `pageKey` changes. On success it stores the managed record; on any rejection it sets managed content to `null`. A `null` result or rejected request therefore renders the existing repository static page content. This is caller-level presentation fallback, not service-level provider fallback.

The selected caller does not provide an authenticated user ID or actor identity. It is a public page surface.

## 7. Demo/local application mode

When `isFirebaseConfigured === false`, current behavior occurs before any future provider resolution:

1. parse `mujahiz-iq-workspace:contentPages` through `localRead`, using `[]` for a missing key or syntactically invalid JSON;
2. scan the array in stored order;
3. return the first record whose `slug` exactly matches and whose `status` is exactly `published`; or
4. return `null`.

Demo/local does not apply `limit(1)` as a backend query, inject an ID, sort, validate fields, or contact Firebase. It is intentional application mode, not Firebase failure fallback, provider fallback, Supabase fallback, migration parity proof, or permission proof.

`localRead` only catches JSON parsing failures; it does not validate that successfully parsed JSON is an array. A structurally malformed but syntactically valid non-array value can therefore make the subsequent `.find(...)` throw. Future implementation must preserve that behavior unless a separately scoped correction is approved.

## 8. Active Rules and authorization

[`firebase.json`](../../firebase.json) identifies [`firestore.rbac.rules`](../../firestore.rbac.rules) as the active repository Rules source. The applicable match is:

```text
match /contentPages/{pageId} {
  allow read: if resource.data.status == "published" || isOwner();
  allow create, update, delete: if isOwner();
}
```

The selected public query includes `status == "published"`, aligning its possible result set with the public Rules predicate. It does not rely on function naming or route assumptions. It introduces no new authorization contract, actor lookup, custom claim, Rules change, index change, or Auth change.

The same collection also contains unpublished administrative content. Those records and the unfiltered Owner list are explicitly excluded.

## 9. Read/write coupling and aggregate authority

`saveContentPage(...)` writes `contentPages/{input.id}` with merge semantics and an updated timestamp. It remains inline, Firebase-only, Owner-authorized, and excluded from the future bounded read extraction.

Firebase remains authoritative for the complete `managed_content_config` aggregate, including:

- published and unpublished content pages;
- content-page writes;
- branding settings and writes;
- Admin operations settings and writes;
- platform settings and writes/audit effects; and
- all other current live managed-content/config behavior.

Extracting one read into a Firebase adapter is code organization only. It does not create split authority or transfer authority for a sub-operation.

## 10. Future Provider composition

Because `managed_content_config` has no existing Provider composition, a separately authorized implementation must create the minimum one-feature Firebase-only composition:

```text
PublicContentPage
  -> workspace.getPublishedContentPage(slug)
  -> explicit isFirebaseConfigured === false Demo/local branch
  -> resolveManagedContentConfigImplementation()
  -> SHIPPED_PROVIDER_MANIFEST selects firebase
  -> one managed_content_config registry
  -> one Firebase implementation instance
  -> getPublishedContentPage(slug)
  -> contentPages published-only query
```

The implementation interface should expose only the selected method. One narrowly scoped provider module should own the single Firebase implementation instance, feature registry, and resolver. Do not create a global provider container or duplicate `managed_content_config` registries. Other aggregate operations remain in their current service paths under Firebase authority.

Initialization must create references/composition only. No backend read may occur at import time; each query occurs only when the selected method is invoked.

## 11. Provider fail-closed boundary

The existing resolver errors must remain observable before any Firebase read:

- missing manifest -> `provider_config_missing`;
- invalid or incomplete manifest -> `provider_config_invalid`;
- unknown feature -> `provider_feature_unknown`;
- invalid selected provider identity -> `provider_identity_invalid`; and
- selected provider without a registered implementation -> `provider_implementation_unsupported`.

An unsupported or misconfigured selection must not query Firebase, read localStorage, return `null`, or render managed data from another provider. The existing caller may catch the propagated resolver error and render repository static content, just as it currently does for a Firebase rejection; that caller behavior does not permit provider probing or fallback.

## 12. No-Supabase and explicit exclusions

The future bounded implementation must not add or authorize:

- a Supabase adapter, SDK/client, import, query, or network capability;
- manifest or Provider vocabulary changes;
- provider probing, silent failover, dual-read, or dual-write;
- `listContentPages(...)`, `saveContentPage(...)`, or another managed-content/config operation;
- branding, Admin operations, platform settings, publicConfig, or registration sectors;
- Auth, Rules, indexes, Firebase configuration, dependencies, or deployment files;
- SQL/RLS, hosted Supabase linking, migration, seed, backfill, data copy, or cutover;
- Production/TEST data access or change; or
- runtime work within D13 itself.

## 13. Deterministic parity matrix

| Case | Required future result |
| --- | --- |
| Firebase selected, one matching published record | Return `{ id: snapshot.id, ...snapshot.data() }` for the first result. |
| Stored record contains `id` | Preserve current spread order: stored `id` overrides snapshot ID. |
| No matching record | Return `null`. |
| Matching slug exists only as draft/unpublished | Query returns no public result; return `null`. |
| Duplicate published records share a slug | Preserve current unspecified first-result behavior; add no `orderBy` or tie-breaker. |
| Firebase query or mapping rejects | Reject from the service/adapter; do not return `null` there and do not switch modes/providers. |
| Caller observes service rejection | Existing caller sets managed content to `null` and renders repository static content. |
| Demo/local valid match | Return the first stored matching published record before provider resolution, without ID injection. |
| Demo/local missing key, syntactically invalid JSON, or no match | Return `null` before provider resolution. |
| Demo/local syntactically valid non-array JSON | Preserve current propagation from attempting `.find(...)`; do not silently normalize it to `[]`. |
| Missing/invalid/unsupported Provider Contract selection | Throw the existing resolver error before any Firebase query or localStorage access. |
| Firebase selected | Make no Supabase import or network call. |

## 14. Focused future test strategy

A separately authorized implementation should add focused synthetic tests for:

- no Firestore read at import/initialization time;
- exact `contentPages` collection and exact slug/published/limit constraints;
- no `orderBy`, cursor, pagination, cache, retry, subscription, or extra read;
- empty result -> `null`;
- exact mapping and stored-`id` overwrite;
- Firebase/query/mapping error propagation;
- explicit Demo/local pre-resolution behavior, stored-order first match, invalid JSON, and `null` behavior;
- all five Provider resolver fail-closed error families before Firebase/local access;
- one Firebase implementation, one `managed_content_config` registry, and one resolver;
- no Supabase import/networking and unchanged shipped manifest;
- unchanged only direct caller and caller-level static-content fallback; and
- static proof that content writes, unfiltered content listing, settings, Rules, indexes, and unrelated features remain outside the adapter.

The smallest relevant existing checks are the Provider Contract test, Firebase runtime/provider policy tests, Demo/runtime policy tests, and focused new adapter parity test. Full repository, build, Emulator, Docker, SQL/pgTAP, E2E, hosted, and Production suites are not required merely for this readiness document.

## 15. Known quirks and debt

- `limit(1)` has no explicit ordering, so duplicate published slugs have unspecified winner selection.
- The mapping permits a stored `id` field to override the Firestore document ID.
- Runtime content shape is asserted by TypeScript only; the read performs no field validation or normalization.
- The caller deliberately masks all service failures as absence of managed content and renders repository static content.
- Demo/local returns the stored object without ID injection, while configured Firebase uses the mapping helper.
- Demo/local syntactically valid non-array JSON is not normalized and can throw from `.find(...)`.

D13 preserves these facts for parity. It does not authorize correcting them during the bounded adapter extraction.

## 16. Open gates

Preserved exactly:

1. `ORG-001`
2. `ORG-002`
3. `MSG-002`
4. `FILE-001`
5. `BILL-001`
6. `RES-001`
7. `MIG-002`

The selected seam is not blocked by an Open gate. D13 does not resolve, rename, remove, add, or reinterpret any gate.

## 17. Internal adversarial review

The bounded self-review found no unresolved Critical, High, Medium, Low, or Nit documentation issue after two correction loops. Loop 1 made current test coverage explicit and corrected Demo/local semantics for syntactically valid non-array localStorage JSON. Loop 2 removed four Markdown hard-break trailing spaces detected when the committed-tree diff was checked. Neither loop changed the selected seam, authority, Rules, runtime, or scope.

The review confirmed D12 lifecycle and merge-parent evidence, current 17-feature vocabulary, complete direct-caller inventory, active Rules authority through `firebase.json`, individual managed-content/settings comparisons, Favorites identity dependence, cache/realtime/error/default behavior, one-registry composition, unchanged seven Open gates, no split authority, no Supabase capability, and documentation-only scope.

## 18. Production, data, and deployment impact

D13 is documentation/readiness only.

- Production/TEST data access or change: **none**.
- Firebase Production deployment: **none**.
- Rules/index/Auth/configuration change: **none**.
- Provider manifest or runtime adapter change: **none**.
- Supabase runtime capability: **none**.
- Hosted Supabase, SQL/RLS, migration, seed, backfill, or cutover: **none**.

GitHub source state must not be treated as deployed Firebase state.

## 19. Exact stop point and next gate

D13 stops after D12 lifecycle synchronization, current-source candidate analysis, this documentation-only readiness contract, internal adversarial review, focused validation, one bounded commit, branch push, and one Draft PR if safe tooling is available.

D13 does not start or authorize runtime implementation. The exact next gate is an **independent exact-head D13 readiness review before any runtime implementation**. Any correction must be reviewed at its new exact head. Ready transition, merge, adapter implementation, provider-manifest change, Firebase deployment, and D14 remain outside this task.
