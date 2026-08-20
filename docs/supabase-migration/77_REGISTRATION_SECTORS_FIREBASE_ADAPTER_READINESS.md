# Registration sectors Firebase adapter readiness

Status: **D11 READINESS COMPLETE / AWAITING INDEPENDENT EXACT-HEAD REVIEW**

Date: 2026-08-20

## 1. Verified starting state

D11 started from clean `origin/main` `44f850d485a83b48091052046519668731da0f37`. Git history verifies that commit as the manual merge of PR #153 with D10 implementation head `56c170c124ead1211bde0d318c4e61d15dafd79e` as its second parent.

D10 is `COMPLETE / REVIEWED / MANUALLY MERGED`: independent exact-head review found 0 Critical, 0 High, 0 Medium, 0 Low, and 0 Nit findings; PR Gate #262 / run `32334282427` succeeded; and PR #153 produced GitHub `main` `44f850d485a83b48091052046519668731da0f37`.

GitHub `main` contains the D10 Firebase-only adapter for configured `listMaterialTerms()`. Firebase Production was not deployed, no Production/TEST data action occurred, no Supabase runtime capability was added, and Firebase remains the live authoritative backend, Auth, database, and hosting provider. Hosted Supabase remains unlinked, undeployed, and non-authoritative.

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## 2. Candidate evidence matrix

The matrix uses the current 17-feature Provider Contract vocabulary. “No Open gate” means none of the seven named gates directly blocks a Firebase-to-Firebase code-organization extraction; it does not authorize an authority transition.

| Feature / seam | Exact reads and direct callers | Sensitivity and Rules/auth boundary | Write/security coupling | Fallback, cache, and consistency | Open gate | Eligibility / risk | D11 result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `supplier_taxonomy_dictionary` / `listRegistrationSectors()` | `publicConfig/registration` -> `RegisterPage`, `CompleteProfilePage`, `RegistrationSectorsPage` | Low, public bilingual configuration. Active `firestore.rbac.rules` allows public `/publicConfig/{configId}` reads and Owner-only writes. | Adjacent Owner-only `saveRegistrationSectors(...)` writes the same document, but the read is independently bounded and does not need the write path. | No cache, query, pagination, limit, or retry. Active filter and ascending `order`; repository defaults on absent/empty/malformed-array/failed configured read. | None | **Eligible / Low** | **Selected.** One document, deterministic normal-path projection, public read, intentional defaults, three callers, and no new security contract. |
| `supplier_reviews` / `listSupplierReviews(...)`, `listMyReviews(...)`, `listPendingReviews()` | `reviews` -> Supplier profile, self-review page, Admin moderation/dashboard, and Demo/local portal metrics | Approved subset Low; self/Admin/owned-Supplier access Moderate. Rules distinguish Admin, active Buyer, self, and owned Supplier. | Submission and moderation update review state, Supplier ratings/counts, user points, settings, and audit evidence. | Application sorting/truncation differs by read; no service cache. Some callers mask errors. | None | Only after a multi-audience read matrix / Medium-High | Deferred; materially broader authorization and cross-feature mutation coupling. |
| `supplier_feedback` / `listMySupplierFeedback(...)`, `listSupplierFeedback(...)` | `supplierFeedback` -> Supplier profile/self history, Admin feedback/dashboard, and Demo/local portal metrics | Moderate private report/correction/actor/Admin-note data. Rules allow Admin or submitting user. | Submit and Admin status transitions share the lifecycle; transitions write reviewer metadata and audit evidence. | Ordered/limited reads; no cache. Supplier profile masks read errors and filters by Supplier after fetching the user's list. | None | Technically separable / Medium-High | Deferred; privacy and Admin/self lifecycle coupling exceed the selected seam. |
| `supplier_favorites` / `listFavorites(userId)` | `favorites` -> Buyer dashboard, favorites workspace, Supplier profile | Moderate private shortlist. Rules require signed-in owner by stored `userId`. | `saveFavorite(...)` and `removeFavorite(...)` share deterministic per-user record identity; caller supplies `userId`. | Limit 250 then application newest-first sort; no cache. Callers differ in error masking. | None | Technically small / Medium | Deferred; private user-owned read/write authority needs a dedicated authorization contract. |
| `managed_content_config` / separable reads: `getPublishedContentPage(slug)`, `listContentPages(false)`, `getBrandingSettings()`, `getAdminOperationsSettings()`, and `getPlatformSettings()` | `contentPages` and `settings/{branding,adminOperations,platform}` -> one public page caller, three Admin/Owner workspace callers, and multiple access/taxonomy/administration callers for platform settings | Mixed Low/Moderate. Published content is public by record status; unfiltered content lists require Owner; all `settings` reads require sign-in. Branding includes `assetUploadStatus`; Admin operations/platform settings affect privileged behavior. | Owner content/branding writes, Admin-or-Owner operations writes, and platform-setting/audit/taxonomy seed effects remain adjacent. | Published content is a two-filter query with caller-level error-to-null behavior; list content sorts/limits; branding and operations use distinct default merges; platform settings has wider consumers. | None directly. `FILE-001` remains relevant to future asset capability, though the branding read alone does not resolve it. | Individually separable but Low-Medium to Medium | Deferred. The public page read has query/Rules-status semantics; branding is authenticated Admin configuration adjacent to `FILE-001`; operations/platform reads affect wider behavior. Registration sectors has a simpler public single-document boundary and an existing focused parity test. |
| `operational_reporting` / `getPortalMetrics(...)`, `getOperationalReport(...)` | Cross-collection counts -> Admin/Owner operations pages | Moderate privileged aggregate state; authorization is inherited from every counted collection. | Crosses users, suppliers, submissions, grants, suggestions, reviews, and feedback. | Two service surfaces and 60-second per-key caches; configured and Demo/local calculations intentionally differ. | None | Not eligible as next seam / Medium-High | Deferred; cross-aggregate consistency and cache semantics require a separate contract. |
| `audit_evidence` / `listAuditLogs(...)` | `auditLogs` -> Admin/Owner dashboards and Admin audit browser | High: actor, action, target, and free-form details. Rules allow Admin aggregate reads plus one narrowly named self-verification document. | Many commands append immutable audit records; retention and exact projection remain security-sensitive. | Page size clamped to 1..100, `createdAt desc`, 30-second per-size cache with force refresh. | None of the seven; structural `AUD-001` closure does not remove operational sensitivity | Not eligible / High | Deferred; security evidence is not the next low-risk seam. |
| `supplier_search_ai_intent` / `parseSupplierSearchWithGemini(...)` | External Firebase AI request -> `DirectoryPage` | Query/taxonomy text may be sensitive; feature is gated by Firebase configuration and `VITE_FIREBASE_AI_ENABLED`. | Enabling or changing AI is a separately approved service capability, not a Firestore read extraction. | Dynamic import, deterministic model settings, caller-level catch and local-intent fallback. | Separate explicit enablement approval required | Ineligible / High | Deferred; not a configured datastore read seam. |

No additional remaining Provider Contract feature exposes a clearly smaller, lower-risk configured Firebase read seam in current source. Within `managed_content_config`, the individually separable published-page and branding reads were considered rather than dismissed with the heterogeneous aggregate: each adds either query/Rules-status semantics or authenticated administrative/`FILE-001` adjacency, and neither has the selected seam's existing focused parity test. The selected registration-sector seam was previously separated from D9/D10 specifically because its path and fallback contract differ from material terms; those semantics are now independently verified below.

## 3. Selected Provider feature and operation

Existing Provider Contract feature:

```text
supplier_taxonomy_dictionary
```

Exactly one selected operation:

```text
listRegistrationSectors(): Promise<RegistrationSector[]>
```

The current source is `src/services/workspace.ts`. The returned shape is the existing `RegistrationSector` interface:

```text
value: string
labelAr: string
labelEn: string
order: number
active: boolean
```

No new Provider feature ID, manifest entry, or authority selection is needed or authorized.

## 4. Direct callers

| Caller | Current behavior |
| --- | --- |
| `RegisterPage` | Initializes immediately with the active ordered repository defaults, calls the service once on mount, and replaces state only when the returned array is non-empty. |
| `CompleteProfilePage` | Initializes with an empty sector array, calls once on mount, and replaces state with the result. |
| `RegistrationSectorsPage` in `AdminWorkspacePages.tsx` | Initializes with the repository defaults, calls once on mount, then lets the Owner edit the returned active entries and invoke the separately excluded save function. |

No other runtime caller was found. None of the three callers adds ordering, pagination, caching, or data-shape normalization.

## 5. Exact configured Firebase source and initialization

The active configured path performs exactly one document read:

```text
getDoc(doc(db, "publicConfig", "registration"))
```

The Firestore path is therefore:

```text
publicConfig/registration
```

There is no collection query, `where`, `orderBy`, cursor, pagination, result limit, retry, read-through cache, or background refresh. The current inline code constructs the document reference and starts the read only when `listRegistrationSectors()` is called. A future adapter must not perform a backend read during module import, registry construction, or provider resolution.

## 6. Exact mapping, filtering, and ordering

After a successful `getDoc`:

1. If the document does not exist, configured input is `[]`.
2. If `snapshot.data().sectors` is not a JavaScript array, configured input is `[]`.
3. Otherwise the array is cast to `RegistrationSector[]` without per-field validation, trimming, cloning, ID injection, default merging, or normalization.
4. Entries are retained when `item.active` is truthy under the current JavaScript filter expression.
5. Retained entries are sorted in place using `a.order - b.order`.
6. If at least one retained entry remains, that exact filtered/sorted array is returned.
7. If none remains, the repository fallback is returned.

The normal typed-data contract is active entries sorted by numeric `order` ascending. Equal numeric orders retain JavaScript stable-sort input order. The implementation does not add a secondary tie-breaker.

There is no pagination or limit.

## 7. Repository fallback/default behavior

`src/data/registrationSectors.ts` defines 17 bilingual defaults. Each default has `active: true` and `order` from 1 through 17.

The fallback function applies the same active filter and ascending numeric-order sort to that repository array. Configured Firebase returns this fallback when:

- the document is absent;
- `sectors` is absent or not an array;
- the configured array is empty;
- no configured entry is active; or
- any operation inside the configured `try` block throws, including the Firebase read or subsequent configured filtering/sorting.

This catch-and-default behavior is intentional current parity. A future Firebase adapter must catch only the current configured-operation/mapping boundary and return these defaults. It must not turn the fallback into an exception, empty result, retry, cache, provider switch, or Supabase read.

## 8. Exact error behavior and known parity quirks

Configured Firebase errors are deliberately swallowed and replaced with repository defaults. Callers therefore normally receive a non-empty array even for permission, network, missing-document, or malformed configured-array failures.

Provider Contract resolution failures are different. Missing/invalid manifest state, an unknown feature, invalid identity, or unsupported provider must continue to throw the existing `ProviderResolverError` code. A future facade must resolve outside the adapter's configured-read catch boundary so repository defaults cannot mask a provider configuration error.

Current quirks that parity tests must preserve unless separately redesigned:

- entries are cast, not runtime-validated;
- `active` uses truthiness rather than `active === true`;
- ordering uses numeric subtraction without a secondary key;
- no labels, values, or order values are normalized on read;
- inactive configured entries are omitted even for the Owner administration caller; and
- configured read/mapping failures return defaults, while structurally malformed Demo/local data can still throw after JSON parsing because the local filter/sort is not inside a catch.

D11 documents these quirks; it does not authorize correcting them.

## 9. Demo/local application-mode behavior

When `isFirebaseConfigured === false`, the service must remain in explicit Demo/local application mode before any Provider Contract resolution.

The local path:

1. reads `localStorage` key `mujahiz-iq-workspace:registrationSectors` through `localRead`;
2. returns `[]` when the key is absent or JSON parsing throws;
3. filters entries by truthy `active`;
4. sorts by `a.order - b.order`; and
5. returns the active sorted local entries when non-empty, otherwise the same 17 repository defaults.

Demo/local data is not a provider implementation, Firebase failure fallback, Supabase fallback, migration source, or parity proof. A configured Firebase failure must use the documented repository defaults; it must never switch into localStorage.

## 10. Active Rules and authorization boundary

`firebase.json` identifies `firestore.rbac.rules` as the active repository Rules source. That file contains:

```text
match /publicConfig/{configId} {
  allow read: if true;
  allow create, update, delete: if isOwner();
}
```

Therefore the selected configured read is public, including before sign-in. Writes require the existing Owner role helper. D11 changes no Rules and requires no new Auth, Rules, RLS, manifest, migration, or security contract.

The public read applies to the wider `publicConfig/{configId}` match, not only `registration`; D11 neither narrows nor broadens that current rule.

## 11. Read/write and security coupling boundary

`saveRegistrationSectors(...)` writes the same `publicConfig/registration` document. It trims `value`, `labelAr`, and `labelEn`, rewrites `order` from array position, adds `updatedAt` and `updatedBy`, and uses merge semantics. It remains completely excluded from a future bounded read extraction.

The read can be organized separately because it performs no mutation, accepts no user/actor identifier, and relies on a public Rules boundary. The adjacent write remains Firebase code under Firebase authority. This separation does not authorize split provider authority: Firebase continues to own both read and write behavior for the complete feature.

## 12. Future configured call graph

The future configured path must conceptually be:

```text
RegisterPage | CompleteProfilePage | RegistrationSectorsPage
  -> existing workspace service facade
  -> explicit isFirebaseConfigured === false Demo/local branch
  -> resolveProviderImplementation(...)
  -> existing supplier_taxonomy_dictionary feature
  -> Firebase-only adapter
  -> getDoc(publicConfig/registration)
  -> exact active/order/default behavior
```

The existing Firebase-only `supplier_taxonomy_dictionary` implementation may be extended only in the later separately authorized runtime task. The shipped manifest remains unchanged and Firebase-selected.

## 13. Provider and fail-closed behavior

The current Provider Contract already contains all 17 feature IDs and selects `firebase` for each in the immutable shipped manifest. A future implementation may register only the Firebase implementation for the selected taxonomy feature.

Required fail-closed cases remain:

- missing manifest -> `provider_config_missing`;
- invalid or incomplete manifest -> `provider_config_invalid`;
- unknown feature -> `provider_feature_unknown`;
- invalid selected identity -> `provider_identity_invalid`; and
- selected provider without an implementation -> `provider_implementation_unsupported`.

No provider probing, silent failover, dual-read, dual-write, dynamic Supabase import, or Supabase networking is allowed. The repository fallback is application data behavior inside the selected Firebase implementation; it is not provider fallback.

## 14. Aggregate-authority and no-Supabase boundary

Firebase remains authoritative for the complete `supplier_taxonomy_dictionary` feature, including:

- material-term reads and the merged D10 adapter;
- material-term and term-suggestion writes/moderation/audit effects;
- registration-sector reads and writes;
- categories and related current taxonomy/configuration behavior; and
- all current live Production behavior.

A future bounded `listRegistrationSectors()` extraction is code organization only. It does not authorize Supabase registration-sector reads, mixed taxonomy authority, a manifest revision, authority transition, data copy, SQL/RLS, hosted Supabase, or partial cross-provider cutover.

No registration-sector Supabase adapter, table, query, client, import, or runtime network capability exists in the selected seam.

## 15. Explicit exclusions

D11 and any later bounded implementation contract exclude:

- `saveRegistrationSectors(...)` and every registration-sector write;
- material terms, term suggestions, suggestion examples, moderation, and audit writes;
- categories, platform settings, content pages, branding, or Admin operations settings;
- every other Provider Contract feature;
- Provider Contract vocabulary or shipped-manifest changes;
- Auth, Firebase Rules/indexes/configuration, dependencies, or deployment files;
- Supabase SDK/client/networking, SQL/RLS, hosted linking, migration, or cutover; and
- Production/TEST data access or change, seed, backfill, bulk update, or deployment.

## 16. Deterministic parity matrix

| Case | Required future result |
| --- | --- |
| Configured document with active entries | Return the same objects filtered by truthy `active`, sorted by numeric `order` ascending. |
| Equal `order` values | Preserve stable input order; add no secondary sort. |
| Inactive entries | Omit them. |
| Missing document | Return the 17 active ordered repository defaults. |
| Missing/non-array `sectors` | Return the repository defaults. |
| Empty array or no active entries | Return the repository defaults. |
| Configured `getDoc` rejects | Return the same repository defaults; preserve the swallowed-error behavior. |
| Configured filter/sort throws | Return the repository defaults because mapping remains within the configured catch boundary. |
| Demo/local valid active entries | Return local active entries in ascending numeric order before provider resolution. |
| Demo/local absent/invalid JSON/empty/no active data | Return the repository defaults before provider resolution. |
| Demo/local structurally malformed parsed data | Preserve current behavior, including propagation where local filter/sort is outside the JSON-parse catch. |
| Missing/invalid/unsupported Provider Contract selection | Throw the existing resolver error; do not return defaults or access localStorage. |
| Firebase selected | Make no Supabase import or network call. |

## 17. Focused future test strategy

A separately authorized runtime implementation should add focused synthetic tests for:

- no backend read before method invocation;
- exact `publicConfig/registration` path and one `getDoc` call;
- active filtering, numeric ascending order, and stable equal-order behavior;
- no cloning/normalization/ID injection beyond current behavior;
- missing document, non-array field, empty array, and no-active-entry defaults;
- configured Firebase and mapping/filter failures returning the real repository defaults;
- explicit Demo/local pre-resolution behavior, valid local results, invalid JSON, and default fallback;
- all five Provider Contract fail-closed error families;
- Firebase-only registration with no Supabase runtime import/networking;
- unchanged three-caller facade usage; and
- static proof that `saveRegistrationSectors(...)`, Rules, manifest, and unrelated taxonomy operations remain outside the adapter.

The existing `tests/registration-sectors.test.mjs`, Provider Contract tests, Firebase runtime/provider policy tests, and Demo/runtime policy tests are the smallest relevant existing surfaces. Full build, emulator, Docker, SQL, pgTAP, E2E, hosted, and Production checks are not required merely for this readiness document.

## 18. Production, data, and deployment impact

D11 is documentation/readiness only.

- Production/TEST data access or change: **none**.
- Firebase Production deployment: **none**.
- Rules/index/Auth/configuration change: **none**.
- Provider manifest or runtime adapter change: **none**.
- Supabase runtime capability: **none**.
- Hosted Supabase, SQL/RLS, migration, seed, backfill, or cutover: **none**.

GitHub source state must not be treated as deployed Firebase state.

## 19. Open gates

Preserved exactly:

1. `ORG-001`
2. `ORG-002`
3. `MSG-002`
4. `FILE-001`
5. `BILL-001`
6. `RES-001`
7. `MIG-002`

D11 does not resolve, rename, add, or remove any gate.

## 20. Exact D11 stop point and next gate

D11 stops after D10 lifecycle synchronization, current-source candidate analysis, this documentation-only readiness contract, internal adversarial review, focused validation, one bounded commit, branch push, and one Draft PR if safe tooling is available.

D11 does not start or authorize runtime implementation. It stops before another adapter, service rewiring, Ready transition, merge, Rules/index/Auth/manifest change, Supabase runtime capability, hosted action, SQL/RLS, migration, Production/TEST data action, deployment, or D12.

The exact next gate is an **independent exact-head D11 readiness review**. Any later runtime implementation requires that review to pass, any corrections to be re-reviewed at their new exact head, and the readiness PR to be manually merged first.
