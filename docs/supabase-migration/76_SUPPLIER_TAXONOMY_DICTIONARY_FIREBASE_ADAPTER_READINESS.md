# `supplier_taxonomy_dictionary` Firebase adapter readiness

Status: **D9 readiness complete; awaiting independent exact-head review before any runtime implementation**

Date: 2026-08-19

## 1. Verified starting main

D9 started from a clean branch based on exact `origin/main` `56de751ef80325e443aecbf07393e4737626158d`, the manual merge of PR #151. Git history verifies that merged D8 implementation head `65d7d199c38c628ef25e6fc31ec5e5bb95deaca9` is the second parent of that merge.

Firebase remains the live Production backend, Auth, database, and hosting authority. GitHub `main` contains D8 source code, but this work did not deploy it to Firebase Production. Hosted Supabase remains unlinked, undeployed, and non-authoritative.

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`.

## 2. D8 post-merge handoff

The verified D8 lifecycle is:

- implementation head `65d7d199c38c628ef25e6fc31ec5e5bb95deaca9`;
- independent exact-head review: 0 Critical, 0 High, 0 Medium, 0 Low, and 0 Nit;
- PR Gate #258 / run `32262254095`: passed on that exact implementation head;
- PR #151: manually merged; and
- resulting GitHub `main`: `56de751ef80325e443aecbf07393e4737626158d`.

The merged configured-Firebase call graph is now:

```text
caller
  -> firestore.ts facade
  -> Provider Contract resolver
  -> supplier_directory
  -> Firebase adapter
  -> Firestore
```

The bounded operations are `listSuppliers()`, `listSuppliersPage(...)`, `listSupplierCandidates(...)`, and `getSupplier(...)`. Firebase remains selected. Demo/local remains explicit application mode before provider resolution. No Auth, Rules, index, Firebase configuration, SQL/RLS, migration, hosted Supabase, Production/TEST data, or deployment action was part of D8 or D9.

## 3. Candidate-selection evidence

The matrix uses the current 17-feature Provider Contract vocabulary and current source/callers. “No Open gate” means none of the seven named gates directly blocks a Firebase-to-Firebase read extraction; it does not mean the wider aggregate is cutover-ready.

| Provider feature | Candidate Firebase reads and primary callers | Sensitivity | Write/security coupling | Open-gate status | Eligibility / risk | D9 decision |
| --- | --- | --- | --- | --- | --- | --- |
| `supplier_taxonomy_dictionary` | `listMaterialTerms()` -> `DirectoryPage`, `AdminMaterialDictionaryPage`; `listTermSuggestions(...)` -> `AdminMaterialDictionaryPage`, `AdminDashboardPage`, and Demo/local portal metrics | Active material terms: Low. Suggestions: Moderate because examples may contain user query text and creator IDs. | Suggestions are captured and moderated by `recordTermSuggestions`, `approveTermSuggestion`, and `ignoreTermSuggestion`; approval also writes audit evidence. | No Open gate directly blocks the active-term read. | **Eligible at Low risk only for `listMaterialTerms()`** | **Selected.** It is the smallest functional, low-sensitivity read seam. Admin suggestion reads remain excluded. |
| `supplier_reviews` | `listSupplierReviews(...)`, `listMyReviews(...)`, `listPendingReviews()` -> Supplier profile, self reviews, and Admin moderation/dashboard | Public-approved subset Low; self/Admin queues Moderate | Submission/moderation writes are coupled to Supplier rating/count and user points across `supplier_directory` and `user_profiles_access`. | No named Open gate directly blocks reads. | Eligible only after a broader role/read matrix; Medium-High risk | Deferred because it has three audiences and cross-feature command effects. |
| `supplier_feedback` | `listMySupplierFeedback(...)`, `listSupplierFeedback(...)` -> Supplier profile/self history and Admin support/dashboard | Moderate: private report text, proposed corrections, actor/status metadata | Submission, Admin status transition, notes, and audit write form one record lifecycle. | No named Open gate directly blocks reads. | Bounded reads are technically separable; Medium-High risk | Deferred because privacy and Admin/self authorization outweigh the selected dictionary seam. |
| `supplier_favorites` | `listFavorites(userId)` -> Buyer dashboard, favorites workspace, Supplier profile | Moderate: private per-user shortlist | Read/save/remove share one per-user record authority; caller-supplied user ID and mapping/cutover require explicit authorization coverage. | No named Open gate directly blocks a same-provider extraction. | Technically small but security-coupled; Medium risk | Deferred because the one read is inseparable from a private user-owned write lifecycle for authority purposes. |
| `managed_content_config` | `getPlatformSettings()`, content-page reads, branding/operations settings reads, and registration-sector reads -> public pages, registration/profile, taxonomy context, and Admin pages | Public content Low; operational settings Moderate | Heterogeneous record families share writes; platform settings affect trial/grace/review behavior; `seedDefaultLists` crosses settings and taxonomy. Current repository Rules do not define every workspace content/config path. | A Rules or record-family authority decision may be required for some paths; D9 cannot change Rules or the manifest. | Not a single small seam as currently grouped; Medium risk | Deferred pending a separately bounded record-family and authorization inventory. |
| `operational_reporting` | `getPortalMetrics(...)`, `getOperationalReport(...)` -> Admin and Owner reporting dashboards | Moderate: privileged aggregate operational state | Cross-collection counts, two service surfaces, caller-supplied scope, and 60-second caches; the provider contract requires a separately approved consistency contract. | No named Open gate directly blocks current reads, but the consistency contract is absent. | Ineligible for D9; Medium-High risk | Deferred because it is cross-aggregate and cache/consistency-sensitive. |
| `audit_evidence` | `listAuditLogs(...)` -> Admin/Owner dashboards and Admin audit browser | High: actor, action, target, and free-form details | Admin-only access, 30-second cache, and unresolved exact retention/access/runtime decisions surround the read projection. | `AUD-001` is resolved structurally, but its remaining operational decisions are not one of the seven Open gates and still matter. | Ineligible as the next low-risk seam; High risk | Deferred because it is security-sensitive evidence, not ordinary low-sensitivity data. |
| `supplier_search_ai_intent` | `parseSupplierSearchWithGemini(...)` -> bounded optional search interpretation | Query text may be sensitive | External AI request/feature enablement; not a Firestore datastore read seam | Enabling an AI service requires separate approval. | Ineligible | Deferred; D9 is Firebase datastore read readiness and adds no AI capability. |

No remaining candidate is smaller and safer than the active material-term read while also having explicit current Rules coverage and a functioning configured-Firebase path.

## 4. Selected bounded seam

### In scope

Exactly one current service operation:

```text
listMaterialTerms(): Promise<MaterialTerm[]>
```

It reads active material dictionary terms used to expand Supplier directory searches and to display the active dictionary in the Admin material-dictionary page.

### Direct callers

| Caller | Current use and transformation |
| --- | --- |
| `DirectoryPage` | Loads the result once, stores it unchanged, and supplies it to `expandSearchWithMaterialTerms(...)`; that caller builds search aliases from canonical labels, category, synonyms, brands, and standards. It does not re-sort or truncate the dictionary. |
| `AdminMaterialDictionaryPage` | Loads terms in the same `Promise.all` as pending suggestions, records the full result/count, then sorts a copy by `canonicalEn.localeCompare(...)` and displays only the first 80. That display sort/slice is caller behavior, not adapter behavior. |

### Why this boundary is coherent

Active material terms are one low-sensitivity, read-only projection with a single Firestore collection, one query, one deterministic repository-default merge, and two callers. The seam does not need suggestion examples, moderation state, captured user queries, categories/settings writes, or AI intent parsing to serve its current use.

This is a Firebase-to-Firebase read extraction boundary only. It is not the entire `supplier_taxonomy_dictionary` aggregate and does not authorize a provider cutover.

## 5. Excluded seams

D9 excludes:

- `listTermSuggestions(...)` and all suggestion example/creator data;
- `recordTermSuggestions(...)`, `approveTermSuggestion(...)`, and `ignoreTermSuggestion(...)`;
- material-term creation, update, archival, deletion, or audit effects;
- categories, registration sectors, platform settings, and `seedDefaultLists(...)`;
- local search matching/ranking implementation and Firebase AI/Gemini intent parsing;
- every other Provider Contract feature;
- provider manifest or feature-vocabulary changes; and
- Auth, Firestore Rules/indexes, SQL/RLS, migration, hosted Supabase, data, and deployment actions.

## 6. Exact configured-Firebase behavior

The current configured path uses the module-level `materialTerms` collection reference and executes:

```text
query(
  materialTerms,
  where("status", "==", "active"),
  limit(500),
)
```

It then maps every returned snapshot with the shared helper and merges the mapped records with repository defaults:

```text
mergeMaterialTerms(
  snapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
)
```

Exact consequences:

- The collection path is `materialTerms`.
- Only documents whose indexed `status` equals the exact string `active` match. Missing or other status values are excluded by Firestore.
- The query limit is exactly 500 and is applied before mapping or default merging.
- There is no explicit `orderBy`, cursor, or pagination. Firestore therefore retains its native ascending document-path order for the matching custom documents; D9 does not add application sorting. The relevant Firebase references are the official [get-data default-order statement](https://firebase.google.com/docs/firestore/query-data/get-data), [query limit documentation](https://firebase.google.com/docs/firestore/query-data/order-limit-data), and [index ordering rules](https://firebase.google.com/docs/firestore/query-data/index-overview#default_ordering_and_the__name___field).
- Mapping is `{ id: snapshot.id, ...snapshot.data() }`, so a stored `id` field overrides the snapshot ID. Other fields receive no runtime validation, normalization, projection, or defaulting.
- `mergeMaterialTerms(...)` begins with repository `defaultMaterialTerms` in their declared order. Each exact-`active` custom term is set by its mapped `id`.
- A custom term whose mapped `id` matches a default replaces that default value without moving its existing Map position. A new mapped `id` is appended in custom-query result order.
- The merge performs its own exact `status === "active"` check even though the Firestore query already filters status.
- A successful empty Firestore result does **not** return `[]`; it returns the repository default terms.
- Missing ordinary fields pass through. A malformed active custom record may therefore be returned and may fail later caller assumptions such as `canonicalEn.localeCompare(...)`; D9 preserves this quirk rather than adding schema validation.
- There is no function-level cache, retry, fallback query, or alternate-provider call.
- Query, permission, index, network, mapping, and merge errors reject the service promise unchanged. A configured Firebase error must not be replaced with repository defaults or Demo/local data.

## 7. Exact Demo/local behavior

When `isFirebaseConfigured === false`, the service calls `demoListMaterialTerms()` before any future provider resolution.

That function:

```text
mergeMaterialTerms(readDb().materialTerms || [])
```

Therefore Demo/local:

- reads the local Demo database only;
- applies no 500-item cap and no Firestore query ordering;
- lets `mergeMaterialTerms(...)` exclude non-`active` local terms;
- preserves repository-default order, replacement position, and local-array append order under the same Map merge;
- returns repository defaults when the local material-term array is empty or absent; and
- propagates local storage/parse/merge errors rather than switching to Firebase or another provider.

Demo/local is an explicit application mode, not a provider identity, provider fallback, emulator alias, or Firebase parity claim. If Firebase is configured and the resolver or adapter fails, the service must not read Demo/local data.

## 8. Provider and fail-closed boundary

The Provider Contract already contains exact feature ID `supplier_taxonomy_dictionary`; the immutable shipped manifest selects `firebase`.

Future implementation must:

1. preserve the explicit unconfigured-Firebase Demo/local branch before provider resolution;
2. register only the bounded Firebase `listMaterialTerms()` implementation;
3. call `resolveProviderImplementation(...)` for `supplier_taxonomy_dictionary` on the configured path;
4. return exactly the selected implementation reference and invoke only it;
5. preserve the existing five resolver error codes for missing, malformed, unknown, invalid, or unsupported state;
6. fail before data access when a synthetic unsupported provider is selected;
7. perform no Supabase import, initialization, configuration lookup, or network request while Firebase is selected; and
8. perform no provider probing, fallback, dual-read, or dual-write.

D9 does not change the manifest, register an adapter, or implement routing.

## 9. Aggregate authority boundary

Firebase remains authoritative for the whole `supplier_taxonomy_dictionary` feature, including material terms, term suggestions, suggestion moderation, current categories/taxonomy, and their command effects.

Extracting one Firebase read later would be code organization beneath the same Firebase authority. It would not:

- make reads independently Supabase-authoritative;
- move suggestion or taxonomy writes;
- authorize mixed Firebase/Supabase authority;
- authorize a partial provider cutover; or
- split dictionary terms, moderation state, and command effects for migration purposes.

Any future Supabase migration must treat aggregate authority separately and must either move the approved aggregate coherently or first introduce a reviewed manifest version and explicit record-family contract.

## 10. Future call graph

```text
DirectoryPage / AdminMaterialDictionaryPage
  -> firestore.ts listMaterialTerms() facade
  -> explicit Demo/local gate when Firebase is unconfigured
  -> Provider Contract resolver(feature = "supplier_taxonomy_dictionary")
  -> bounded Firebase taxonomy-dictionary adapter
  -> Firestore materialTerms collection
  -> repository default-term merge
```

Firebase remains selected. No Supabase implementation exists or is authorized.

## 11. Future adapter parity matrix

| Case | Required future assertion | Test ownership |
| --- | --- | --- |
| Query shape | Exact `materialTerms` collection, `status == active`, `limit(500)`, and no explicit order/cursor | Deterministic injected unit test plus source/static assertion |
| Mapping | Preserve `{ id: snapshot.id, ...data }`, including stored-`id` overwrite | Injected unit test with synthetic snapshots |
| Empty Firebase result | Return repository defaults, not `[]` | Injected unit test |
| Default replacement | Exact matching custom ID replaces the default without changing its position | Deterministic unit test of injected result plus real merge helper |
| New custom terms | Append after defaults in returned Firestore order | Deterministic unit test |
| Missing fields | Preserve absent ordinary fields; do not invent runtime validation/defaults | Injected unit test |
| Exact status behavior | Query requests exact active status; merge also ignores any injected non-active record | Unit test for composition/merge; Firestore filtering itself is platform-owned |
| 500 limit | Pass exact limit and do not paginate or fetch another page | Unit test with call counters |
| Ordering | Add no application sort; retain repository-default order and Firestore result order for new custom IDs | Unit test; no fake platform-order test |
| Firebase error | Reject the exact injected error; return neither defaults nor Demo data | Injected unit test |
| Demo empty/local data | Preserve local no-cap merge, default behavior, replacement position, and local append order | Focused Demo/local unit test |
| Demo before resolver | Unconfigured mode never resolves or invokes a provider | Source/static assertion and call-counter test |
| Unsupported provider | Existing resolver returns `provider_implementation_unsupported` before adapter/data access | Focused provider-contract/runtime-policy test |
| Missing/invalid manifest | Existing resolver error codes remain fail-closed | Existing provider-contract tests plus focused registration test |
| No fallback | Configured Firebase failure invokes no Demo or second implementation | Unit test with call counters |
| No Supabase capability | No Supabase import/client/config/network call exists in adapter or facade route | Source/static architecture assertion |
| No dual-read/write | Exactly one selected read implementation runs; no writes occur | Unit/static test |
| Caller transformations | Directory receives unsorted/untruncated service output; Admin sort/slice remains caller-only | Source/static assertion; no component rewrite needed |

An Emulator test is not required for basic query composition, mapping, merge order, empty behavior, or error propagation. Use one focused Firestore Emulator case only if implementation introduces a genuine uncertainty about SDK query ordering/filter/limit composition that deterministic injection cannot cover. Do not run live Production reads.

## 12. Test strategy

Future implementation evidence should remain separated:

- **Injected/unit:** query constraints, exact limit, mapping, defaults, replacements, append order, missing fields, error identity, call counts, and no fallback.
- **Source/static architecture:** Demo gate placement, exact feature ID, Firebase-only registry entry, no manifest change, no Supabase dependency, and unchanged caller transformations.
- **Existing provider policy:** fail-closed resolver behavior and one selected implementation.
- **Firestore Emulator only if required:** one platform-semantic query case; never a fake unit assertion for Firestore-owned filtering/order.

D9 itself is documentation/readiness work. It does not justify the full unit suite, Production build, Emulator, Docker, SQL, E2E, or Production smoke.

## 13. Current quirks and risks

- A successful empty Firebase collection returns repository defaults, while a Firebase error rejects; defaults are not an error fallback.
- A stored custom `id` overrides the Firestore document ID and determines merge replacement/append behavior.
- The configured query caps custom records at 500 before merging defaults and has no pagination.
- No runtime schema validation protects callers from malformed active custom records.
- Default/custom order is Map insertion order, not alphabetical order; only the Admin caller sorts a displayed copy.
- Admin displays at most 80 alphabetically sorted terms but reports the full merged count.
- Demo/local has no 500-record cap and appends new custom terms in local-array order.
- The wider feature contains admin-only suggestion data and writes; those remain explicitly excluded.

These are parity obligations, not redesign invitations.

## 14. Production and data boundary

Production/data impact: **NONE**.

D9 performs no Firebase Production or TEST read/write, no data export/copy, no migration, seed, backfill, repair, bulk update, or deletion. Supplier data and fingerprints are untouched. No hosted Supabase project is accessed.

## 15. Deployment boundary

Deployment impact: **NONE**.

D9 changes documentation only. It does not deploy Hosting, Functions, Rules, indexes, Storage, Firebase configuration, Auth, DNS, billing, Supabase, or application code. GitHub `main` containing D8 remains distinct from the historically deployed Firebase application.

## 16. Open gates

The seven Open gates remain unchanged and Open:

- `ORG-001`
- `ORG-002`
- `MSG-002`
- `FILE-001`
- `BILL-001`
- `RES-001`
- `MIG-002`

No D9 statement resolves, narrows, or bypasses any gate.

## 17. Exact D9 stop point

D9 stops after post-D8 state synchronization, candidate analysis, this readiness contract, internal adversarial review, focused documentation/source validation, commit, branch push, and one Draft PR if safe tooling is available.

D9 stops before:

- independent exact-head readiness review;
- any runtime adapter or facade/provider rewiring;
- provider manifest change;
- suggestion/admin read extraction;
- Supabase runtime/networking;
- Auth, Rules/index, SQL/RLS, migration, hosted, data, or deployment work;
- Ready-for-review transition; and
- merge.

## 18. Next review gate

The exact next gate is an **independent exact-head D9 readiness review** of this documentation branch. Runtime implementation is not authorized unless that review passes, any correction is re-reviewed at its new exact head, and the readiness PR is manually merged through the required workflow.
