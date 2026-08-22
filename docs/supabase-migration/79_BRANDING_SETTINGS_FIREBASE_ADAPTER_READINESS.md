# Branding settings Firebase adapter readiness

Status: **D15 COMPLETE / REVIEWED / MANUALLY MERGED; D16 COMPLETE / REVIEWED / MANUALLY MERGED**

Date: 2026-08-22
Verified D16 starting GitHub `main`: `006a5ea4561360a60af471c548dc9fabd16ef6a5`
Selected Provider feature: `managed_content_config`
Selected operation: `getBrandingSettings()`
D16 runtime implementation: **COMPLETE / REVIEWED / MANUALLY MERGED**
Risk: **Low**

D15 final lifecycle: **COMPLETE / REVIEWED / MANUALLY MERGED**. Corrected readiness head `494efe40c173dc66fcef71674a04e3a91818cc1c` received fresh independent review with 0 Critical, 0 High, 0 Medium, 1 Low, and 0 Nit findings. PR Gate #268 / run `32526221532` succeeded, and PR #158 was manually merged as GitHub `main` `006a5ea4561360a60af471c548dc9fabd16ef6a5`. The Low was documentation-only: stale stop-point wording said one documentation commit, while corrected PR #158 had two commits after its correction cycle.

## 1. Control-point result

D15 synchronizes D14 as **COMPLETE / REVIEWED / MANUALLY MERGED**. D14 implementation head `64f4ba52c639e4f8afef35ecfcbc7f3733a217c0` received independent exact-head review with 0 Critical, 0 High, 0 Medium, 1 Low, and 0 Nit findings. The review reproduced focused tests 73/73, the full repository unit suite 242/242, a passing `tsc -b`, a passing Vite production build, and a passing `git diff --check`. PR Gate #266 / run `32521086096` succeeded. PR #157 was manually merged as GitHub `main` `5736d6142cce47ac51ec247e87d535481234bf21`.

D14's final architecture is:

```text
managed_content_config
  -> one Firebase implementation instance
  -> one feature registry
  -> one resolver
  -> getPublishedContentPage(slug)
```

The configured published-content query remains `contentPages`, supplied-slug equality, published-status equality, and `limit(1)`. Demo/local remains before Provider resolution. Firebase/query/mapping failures propagate from the service, while `PublicContentPage` retains its caller-level repository-static presentation fallback.

The D14 Low was bounded non-blocking test debt, not a runtime parity or security defect. D16 closes it with a deterministic production-source assertion that binds `SHIPPED_PROVIDER_MANIFEST`, feature `managed_content_config`, and `managedContentConfigImplementations` in the real resolver call.

After independently re-evaluating the current merged sources and active Rules, D15 selects exactly `getBrandingSettings()` as the next smallest useful dependency-safe Firebase read seam. D15 stops before runtime implementation.

## 2. Evidence sources

This contract is based on the current merged sources:

- [`providerContract.ts`](../../src/services/providers/providerContract.ts) for the closed 17-feature vocabulary, shipped all-Firebase manifest, and five fail-closed resolver errors;
- [`managedContentConfigProvider.ts`](../../src/services/providers/managedContentConfigProvider.ts) for the existing single Firebase instance, registry, and production resolver;
- [`managedContentConfigFirebaseAdapter.ts`](../../src/services/providers/managedContentConfigFirebaseAdapter.ts) for the existing interface and Firebase adapter;
- [`workspace.ts`](../../src/services/workspace.ts) for Branding, content, Favorites, and operational-reporting behavior;
- [`firestore.ts`](../../src/services/firestore.ts) for platform settings, reviews, feedback, and audit behavior;
- [`AdminWorkspacePages.tsx`](../../src/pages/workspace/AdminWorkspacePages.tsx) for the Branding caller, Owner presentation semantics, adjacent write, and disabled upload control;
- [`AppV2.tsx`](../../src/AppV2.tsx), [`RoleProtectedRoute.tsx`](../../src/components/RoleProtectedRoute.tsx), and [`authorization.ts`](../../src/utils/authorization.ts) for the Owner route boundary;
- [`DisabledFileUpload.tsx`](../../src/components/DisabledFileUpload.tsx) and [`features.ts`](../../src/config/features.ts) for current file-upload behavior;
- [`portalDashboard.ts`](../../src/services/portalDashboard.ts) for additional operational-reporting coupling;
- [`supplierSearchAI.ts`](../../src/services/supplierSearchAI.ts) for AI-intent behavior;
- [`firebase.json`](../../firebase.json) for the active Rules source;
- [`firestore.rbac.rules`](../../firestore.rbac.rules) for current read/write authorization; and
- [`firestore.indexes.json`](../../firestore.indexes.json) for the current repository-managed index inventory.

No Production data, deployed Firebase state, hosted Supabase state, or external service was inspected or changed.

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

The shipped manifest selects Firebase for all 17 features. Current feature-specific composition exists for `user_profiles_access`, `supplier_directory`, `supplier_taxonomy_dictionary`, and `managed_content_config`.

For `managed_content_config`, D14 already provides:

- one `ManagedContentConfigImplementation` interface;
- one Firebase adapter instance created by `createFirebaseManagedContentConfigAdapter(...)`;
- one `managedContentConfigImplementations` registry;
- one `resolveManagedContentConfigImplementation()` resolver; and
- one configured method, `getPublishedContentPage(slug)`.

No Supabase implementation, client, import, query, or runtime network path exists for the selected feature.

## 4. Post-D14 candidate matrix

| Feature / operation | Firestore read and direct runtime callers | Runtime value and audience | Identity and active Rules/Auth | Writes, defaults, errors, cache/realtime | Composition / gate / complexity / risk | D15 result |
| --- | --- | --- | --- | --- | --- | --- |
| `managed_content_config` / `listContentPages(true)` | `contentPages`; `status == "published"`; `limit(100)`; application sort by numeric `order`. No direct caller; the only call is `listContentPages(false)`. | No current runtime value despite a public low-sensitivity result. | No identity argument. `/contentPages` permits published reads or Owner reads; this query aligns with published visibility. | Adjacent Owner writes; `{ id: doc.id, ...data }`; no catch/cache/realtime; Demo filters local items but does not sort. | Existing composition can be extended; no gate; low code complexity, **Low** risk. | Deferred because it is unused. Adapter count alone is not product value. |
| `managed_content_config` / `listContentPages(false)` | `contentPages`; `limit(100)`; no status filter; application sort by `order`. Only `OwnerContentPage`. | Active Owner CMS, but includes drafts/unpublished content. | No identity argument; ambient Owner authorization is required by Rules for unpublished documents and by the `super_admin` route. | Coupled to the Owner save path and Rules-authorized content lifecycle; mapping allows stored-ID overwrite; errors propagate; no cache/realtime. | Existing composition; no gate; privileged lifecycle scope; **Medium**. | Deferred because unpublished-content authorization and write coupling exceed Branding. |
| `managed_content_config` / `getBrandingSettings()` | Exactly one `getDoc(doc(settingsRef, "branding"))`. Only `OwnerBrandingPage`. | Active Owner text/color configuration and preview. Presentation-only; no security or feature-enable decision. | No caller-supplied identity. `/settings` requires sign-in; route requires `super_admin`, mapped from role `owner`. | Missing document -> six-field fallback; existing document overlays stored data; configured errors propagate; no cache/realtime. `assetUploadStatus` is preserved but unused by the page; adjacent write forces it pending. | Reuses existing composition; `FILE-001` is adjacent but not crossed; one deterministic read; **Low**. | **Selected after a Low-versus-Low tie-breaker.** Demonstrable preview value and a narrower Owner-only application/write boundary. |
| `managed_content_config` / `getAdminOperationsSettings()` | Exactly one `getDoc(settings/adminOperations)`. Only `AdminOperationalSettingsPage`. | The four values populate that settings form; no downstream runtime consumers were found. | No identity argument; `/settings` requires sign-in; the route admits Admin/Owner and Admin/Owner can write this document. | Missing document -> exact four-field fallback; existing document overlays stored data; configured errors propagate; no cache/realtime. | Existing composition; no direct gate; one deterministic read; **Low**. | Deferred after the corrected tie-breaker: less demonstrated runtime value and a broader Admin/Owner application/write boundary than Branding. |
| `managed_content_config` / `getPlatformSettings()` | Exactly one `getDoc(settings/platform)`. Taxonomy context, dashboards/access pages, Admin user/submission/settings pages, and review moderation call it. | Wide active runtime value, including access periods, review incentives, taxonomy/default behavior, and Admin decisions. | No identity argument; `/settings` requires sign-in; Owner writes. | Broad repository-default overlay; errors propagate; no cache/realtime; adjacent save/seed emits audit evidence. | Existing feature composition can be extended, but source/callers span services; no direct gate; **High**. | Deferred because one `getDoc` controls broad and partly privileged behavior. |
| `supplier_favorites` / `listFavorites(userId)` | `favorites`; `userId ==` caller value; `limit(250)`; Buyer dashboard, favorites page, and Supplier profile favorite state. | Active private Buyer behavior. | Caller-supplied user ID. Rules require signed-in self via stored `userId == request.auth.uid`. | `{ id, ...data }`, application sort by `updatedAt || createdAt`; adjacent deterministic `${userId}_${supplierId}` save/delete; callers mask, display, or clear on errors; no cache/realtime. | No current feature registry; no gate; identity/ownership contract required; **Medium**. | Deferred because actor/argument binding is materially riskier than Branding. |
| `supplier_reviews` / `listSupplierReviews(supplierId, includePending)` | Supplier equality; optional approved-status equality; application created-time sort/truncate 50. Supplier profile calls the default approved-only form. | Active multi-audience view for Admin, eligible Buyer, review author, or owned Supplier. | Supplier ID is caller-supplied. Rules distinguish Admin, active Buyer approved visibility, review author, and owned Supplier. | Caller masks errors as `[]`; adjacent moderation mutates review, Supplier rating/count, user points, settings, and audit. | No current feature registry; existing review indexes; cross-feature moderation; **High**. | Deferred for multi-audience Rules and mutation coupling. |
| `supplier_reviews` / `listMyReviews(userId)` | `reviewedBy ==` caller ID; application created-time sort/truncate 100. Only `MyReviewsPage`. | Active private self history. | Caller-supplied user ID; Rules allow self records plus privileged/owned-Supplier audiences. | No service catch; caller has no rejection handler; shares submission/moderation aggregate. | No current feature registry; identity binding; **Medium**. | Deferred because private actor binding exceeds Branding. |
| `supplier_reviews` / `listPendingReviews()` | `status == "pending_review"`; `createdAt desc`; `limit(100)`; moderation, Admin dashboard, and local portal-metrics path. | Active privileged moderation queue. | No identity argument; pending records require Admin under Rules. | Service re-sorts/truncates; errors propagate; moderation has rating, points, settings, and audit effects; no cache/realtime in this function. | No current feature registry; existing composite index; **High**. | Deferred for privileged moderation and cross-feature effects. |
| `supplier_feedback` / `listMySupplierFeedback(userId)` | `submittedBy ==` caller ID; `createdAt desc`; `limit(100)`; Supplier profile load/refresh. | Active private self feedback history. | Caller-supplied user ID; Rules require self or Admin. | Caller masks initial errors as `[]`; refresh propagates; application filters by Supplier after fetching; adjacent create and Admin moderation/audit lifecycle. | No current feature registry; existing composite index; **Medium**. | Deferred for private identity and moderation coupling. |
| `supplier_feedback` / `listSupplierFeedback(statuses)` | Status equality or `in`; `createdAt desc`; `limit(100)`; Admin feedback page/dashboard and local portal metrics. | Active privileged access to private feedback. | Status list is caller-supplied; Rules require Admin for other users' records. | Default `pending|in_review`; service sorts/truncates; errors propagate; adjacent status update writes audit evidence. | No current feature registry; existing composite index; **High**. | Deferred for privileged content and lifecycle coupling. |
| `operational_reporting` / reports and portal metrics | Eleven cross-collection aggregate counts in `getOperationalReport()`, plus scope-specific counts in `getPortalMetrics(...)`; Admin/Owner reports and dashboards. | Active aggregate operational visibility. | No actor ID argument, but Admin/Owner routes and collection-specific Rules apply. | `Promise.all`, divergent Demo behavior, 60-second keyed read-through caches, forced refresh, CSV export; no realtime. | No current feature registry; cross-aggregate consistency/auth/cache; **High**. | Deferred because it is not one bounded read seam. |
| `audit_evidence` / `listAuditLogs(pageSize, options)` | `auditLogs`; `createdAt desc`; limit clamped to 1..100; Admin/Owner log and dashboard callers. | Active highly sensitive evidence. | No actor ID argument. Rules allow Admin plus a special self-verification audit ID. | `{ id, ...data }`; 30-second page-size cache and force refresh; append-only writes originate across features; no realtime. | No current feature registry; no gate, but sensitivity/coupling; **High**. | Deferred for evidence sensitivity, audience union, append-only coupling, and cache. |
| `supplier_search_ai_intent` / `parseSupplierSearchWithGemini(...)` | Firebase AI model generation, not Firestore. Directory smart search is the only caller. | Active caller only when a strict feature flag and Firebase configuration enable the external capability. | No Firestore Rules boundary; query text and taxonomy are sent to Firebase AI. | Dynamic model construction, constrained schema, JSON parse/normalization; caller catches and falls back to local intent. | No datastore seam; separate disabled-capability authority; **High / ineligible**. | Deferred as non-datastore work. |

No other current Provider feature exposes an obviously smaller eligible configured read. Already extracted features were not reopened. Auth, writes, RFQ, messages, private catalog, submissions, and Claim seams were not promoted merely to fill the matrix.

## 5. Selection rationale

Branding and Admin Operations are both Low-complexity finalists. Branding wins the corrected tie-breaker because it combines:

- one active direct caller rather than unused behavior;
- one deterministic document read rather than a query or cross-collection aggregate;
- no caller-supplied user, actor, Supplier, or status identity;
- low-sensitivity presentation values with demonstrable editing and preview use;
- an Owner-only application route and write boundary, narrower than the Admin/Owner Admin Operations surface;
- active Rules and route authorization that already permit the current call;
- no index, pagination, cursor, cache, retry, or realtime behavior;
- a small explicit fallback and mapping contract;
- no new Open-gate dependency; and
- the lowest implementation cost now that D14 already provides the exact feature composition to extend.

`listContentPages(true)` is technically comparably small but has no current direct runtime caller. `listContentPages(false)` is active but includes unpublished Owner content. Favorites is active and small but accepts a caller-supplied user ID against self-only Rules. Platform settings influence wider or privileged behavior. Admin Operations does not: its values currently populate only its settings form. Branding is therefore selected on visible runtime value plus the narrower Owner-only application/write boundary, not because Admin Operations is more complex or controls downstream workflows.

### Corrected Branding versus Admin Operations contract comparison

`getAdminOperationsSettings()` performs exactly one configured `getDoc(settings/adminOperations)`. A missing document returns `{ reviewNotifications: true, showIncompleteSuppliers: false, requireDuplicateReason: true, dictionarySuggestionMinimum: 2 }`; an existing document returns `{ ...fallback, ...snapshot.data() }`. Configured read and mapping errors propagate. There is no identity argument, ordering, query filter, limit, pagination, cursor, cache, retry, or realtime subscription. Demo/local returns `localRead<AdminOperationsSettings & { id: string }>("adminOperations")[0] || fallback` before Provider resolution, preserving the same raw-first-record distinction as Branding.

The only direct caller, `AdminOperationalSettingsPage`, loads those values and lets the user display, edit, and save the same four fields. A complete source inventory found no downstream runtime consumer for any of them. The route admits `admin` and `super_admin` (Admin/Owner), and active `/settings/{settingId}` Rules allow signed-in reads plus Admin/Owner writes specifically for `adminOperations`. This makes Admin Operations **Low**, not Medium. Branding remains selected because its text/colors have an actual preview consumer and its application/write boundary is Owner-only.

### Readiness contract checklist

1. Provider feature: `managed_content_config`.
2. Function: exactly `getBrandingSettings()`.
3. Current source: `src/services/workspace.ts`.
4. Direct caller: only `OwnerBrandingPage`.
5. Configured Firebase operation: one `getDoc(settings/branding)`.
6. Mapping: fallback overlay followed by raw stored data, with no ID injection or validation.
7. Ordering: none.
8. Limit, pagination, and cursors: none/not applicable.
9. Defaults/fallback: exact six-field repository fallback for a missing document; distinct Demo/local behavior.
10. Errors/catch: configured errors propagate; the caller has no rejection handler.
11. Cache/realtime: none.
12. Demo/local: `localRead("branding")[0] || fallback` before resolution.
13. Active Rules/Auth: signed-in read under `/settings/{settingId}` and Owner-only application route.
14. Identity assumption: ambient Firebase Auth only; no caller-supplied actor identity.
15. Adjacent write: excluded Owner merge-write that forces upload-pending status.
16. Current composition: one existing interface, Firebase instance, registry, and resolver.
17. Future call graph: extend and reuse that one composition path.
18. Fail-closed behavior: preserve all five Provider resolver errors before Firebase access.
19. Aggregate authority: Firebase remains authoritative for all `managed_content_config` behavior.
20. No-Supabase boundary: no adapter, import, client, query, connection, or network capability.
21. Explicit exclusions: writes, files, other settings/content reads, Rules/Auth/index/config, data, and deployment.
22. Parity quirks: preserve configured-vs-Demo mapping, stored overrides, caller initial state, and broad signed-in read rule.
23. Deterministic tests: exact mapping, missing/error cases, Demo behavior, one read, fail-closed errors, single composition, and no Supabase.
24. Focused validation: managed-content/provider/runtime/Demo/static checks plus proportionate type/build validation during implementation.
25. Stop point: D15 ends before runtime implementation; independent exact-head readiness review is next.

## 6. Exact selected Firebase operation and mapping

The configured branch in [`workspace.ts`](../../src/services/workspace.ts) performs:

```text
getDoc(doc(settingsRef, "branding"))

where settingsRef = collection(db, "settings")
```

Exact configured behavior:

- document path: `settings/branding`;
- operation: exactly one direct document read per invocation;
- query filters: none;
- ordering: none;
- limit: not applicable;
- pagination/cursor: none;
- result when missing: the repository fallback object;
- result when present: `{ ...fallback, ...snapshot.data() }`;
- document ID injection: none;
- normalization/validation: none;
- stored fields override fallback fields, including `assetUploadStatus` at runtime;
- extra stored fields survive the object spread at runtime;
- cache: none;
- retry: none;
- realtime/subscription: none; and
- catch: none; Firebase and mapping failures reject the Promise unchanged.

The six required fallback values are:

| Field | Fallback |
| --- | --- |
| `primaryColor` | `#062b4d` |
| `secondaryColor` | `#0b4f76` |
| `accentColor` | `#f37021` |
| `introAr` | `مجهز.. نقطة البداية لتوفير حقيقي.` |
| `introEn` | `Mujahiz.. the starting point for real savings.` |
| `assetUploadStatus` | `upload_pending_launch` |

The type also permits optional `updatedAt` and `updatedBy`, which pass through when stored.

## 7. Direct caller and runtime behavior

The only direct runtime caller is `OwnerBrandingPage` in [`AdminWorkspacePages.tsx`](../../src/pages/workspace/AdminWorkspacePages.tsx). The route `/super-admin/branding` is nested under `RoleProtectedRoute` with only `super_admin` allowed; `resolvePortalRole(...)` maps application role `owner` to `super_admin`.

The component calls `getBrandingSettings()` once in an effect and applies a successful result to local component state. Its rendered values drive:

- three color inputs;
- Arabic and English introduction text inputs;
- a local preview border, color bar, heading, and button.

`assetUploadStatus` is loaded and preserved by the service mapping and component state, but `OwnerBrandingPage` does not render, consult, or branch on it. `DisabledFileUpload` is unconditionally inert and does not use the field. The adjacent save path independently forces `assetUploadStatus: "upload_pending_launch"`.

No other current source imports or calls `getBrandingSettings()`. The result does not control Auth, role resolution, route access, feature enablement, billing, RFQ behavior, moderation, or another privileged command.

The caller does not catch a rejected Promise. On rejection, the service error remains rejected and the component receives no replacement result; its pre-existing initial local state remains rendered. Future implementation must not add a service fallback, provider fallback, or caller change under this seam.

## 8. Demo/local application behavior

When `isFirebaseConfigured === false`, current behavior occurs before Provider resolution:

```text
localRead<BrandingSettings & { id: string }>("branding")[0] || fallback
```

Exact behavior:

- storage key: `mujahiz-iq-workspace:branding`;
- missing key or syntactically invalid JSON: `localRead` returns `[]`, then Branding returns the fallback;
- the first truthy indexed value is returned as stored, without merging the repository fallback;
- an empty array returns the fallback;
- successfully parsed data receives no structural or field validation; JavaScript `[0] || fallback` behavior is preserved; and
- Demo/local performs no Firebase or Provider operation.

This is intentional application mode, not provider fallback, configured-Firebase error fallback, Supabase fallback, migration parity proof, or authorization proof. The configured and Demo/local mapping differences are deliberate parity quirks to preserve.

## 9. Active Rules, Auth, and identity assumptions

[`firebase.json`](../../firebase.json) identifies [`firestore.rbac.rules`](../../firestore.rbac.rules) as the active repository Rules source. The applicable block is:

```text
match /settings/{settingId} {
  allow read: if signedIn();
  allow create, update: if isOwner() || (hasAnyRole(["admin"]) && settingId == "adminOperations");
  allow delete: if isOwner();
}
```

For `settings/branding`:

- the read requires a signed-in Firebase user;
- the service takes no user or actor identity argument;
- current authorization uses ambient Firebase Auth and the Rules evaluation;
- the only direct route is stricter than the collection read rule because it is Owner-only;
- Admin cannot use the special `adminOperations` write exception for `branding`;
- create/update/delete require Owner; and
- no new Rules, Auth, custom claim, index, or identity-binding contract is required.

The read's low sensitivity makes the existing signed-in collection-read boundary acceptable for extraction parity. D15 does not narrow or broaden that boundary.

## 10. FILE-001 and adjacent write boundary

`OwnerBrandingPage` renders `DisabledFileUpload` for planned `SVG, PNG, ICO, WEBP` assets. That control is disabled, has no file input, and invokes no upload service. The current feature configuration does not turn this inert component into a Storage operation.

`saveBrandingSettings(settings, actorId)` remains inline and excluded. Its configured Firebase branch writes `settings/branding` with merge semantics and forces:

```text
assetUploadStatus: "upload_pending_launch"
updatedAt: serverTimestamp()
updatedBy: actorId
```

The exact selected read does not access a file, URL, Storage bucket, asset bytes, upload metadata, or download capability. Therefore `FILE-001` remains adjacent and Open but does not block the read extraction. Future file activation, upload/download behavior, asset validation, Storage Rules, deletion, or migration requires a separate approved task.

## 11. Current and future Provider call graph

Current configured call graph:

```text
OwnerBrandingPage
  -> workspace.getBrandingSettings()
  -> isFirebaseConfigured === true
  -> getDoc(settings/branding) inline
```

Required future configured call graph:

```text
OwnerBrandingPage
  -> workspace.getBrandingSettings()
  -> explicit isFirebaseConfigured === false Demo/local branch
  -> resolveManagedContentConfigImplementation()
  -> SHIPPED_PROVIDER_MANIFEST selects firebase
  -> existing managedContentConfigImplementations registry
  -> existing Firebase managed-content implementation instance
  -> getBrandingSettings()
  -> exactly one getDoc(settings/branding)
```

The future implementation must:

- extend the existing `ManagedContentConfigImplementation` interface;
- extend the existing Firebase adapter object and dependency set;
- reuse the existing Firebase implementation instance;
- reuse the existing `managedContentConfigImplementations` registry;
- reuse `resolveManagedContentConfigImplementation()`;
- keep one production composition path; and
- perform no backend read at import or adapter-construction time.

It must not create a second managed-content adapter, feature registry, resolver, Firebase instance, or service-specific Provider container.

## 12. D14 Low closure requirement

The same future implementation must strengthen the existing composition test with an explicit deterministic assertion that the real production resolver call is behaviorally equivalent to:

```text
resolveProviderImplementation({
  manifest: SHIPPED_PROVIDER_MANIFEST,
  feature: "managed_content_config",
  registry: managedContentConfigImplementations,
})
```

Generic resolver tests and static instance/registry counts are insufficient for this requirement. The test must bind all three real production inputs while the `managed_content_config` feature is already being changed. D15 does not change runtime or tests merely to close the Low.

## 13. Provider fail-closed boundary

The existing resolver errors must remain observable before any configured Firebase read:

- missing manifest -> `provider_config_missing`;
- invalid or incomplete manifest -> `provider_config_invalid`;
- unknown feature -> `provider_feature_unknown`;
- invalid selected provider identity -> `provider_identity_invalid`; and
- selected provider without a registered implementation -> `provider_implementation_unsupported`.

An unsupported or misconfigured selection must not query Firebase, read localStorage, return the Branding fallback, preserve a previously loaded managed value as a service result, or try another provider. Demo/local remains an explicit application mode chosen before resolution, not an error recovery path.

No provider probing, Firebase fallback after unsupported Provider, Supabase fallback, dual read, silent provider substitution, or error masking is permitted.

## 14. Aggregate authority and no-Supabase boundary

Firebase remains authoritative for the complete `managed_content_config` aggregate, including:

- published and unpublished content pages;
- content-page reads and writes;
- Branding settings and writes;
- Admin operations settings and writes;
- platform settings and writes/audit effects; and
- every other current managed-content/config behavior.

Extracting `getBrandingSettings()` into the existing Firebase adapter is Firebase-to-Firebase code organization only. It does not transfer authority for Branding, divide the aggregate by operation, or authorize a Provider manifest transition.

The future implementation must add no Supabase adapter, SDK/client, import, query, environment value, connection, or network capability. No split-provider aggregate, partial Supabase cutover, dual read, dual write, migration, seed, backfill, or data copy is authorized.

## 15. Explicit exclusions

D15 and the bounded future implementation exclude:

- `saveBrandingSettings(...)`;
- file selection, upload, download, deletion, Storage, or asset migration;
- `listContentPages(...)`, `saveContentPage(...)`, or published-content behavior changes;
- Admin operations settings and platform settings;
- any other `managed_content_config` operation;
- caller, route, copy, visual-design, or fallback-value changes;
- provider vocabulary or shipped-manifest changes;
- a second adapter, registry, resolver, implementation instance, or container;
- Auth, Rules, indexes, Firebase configuration, dependencies, or deployment files;
- SQL/RLS, hosted Supabase linkage, migration, seed, backfill, or cutover;
- Production/TEST data access or change; and
- runtime implementation within D15 itself.

## 16. Parity quirks to preserve

- Configured Firebase overlays stored data onto the fallback; Demo/local returns its first stored value without fallback overlay.
- Stored configured fields override fallback values, including `assetUploadStatus`.
- `OwnerBrandingPage` does not render or consult `assetUploadStatus`; `DisabledFileUpload` is independently inert.
- Extra stored fields pass through at runtime despite the TypeScript return type.
- No document ID is added to configured results.
- Missing configured documents return fallback, but configured Firebase/query/mapping errors reject.
- The caller has no rejection handler and retains its initial component state when no successful result is applied.
- The caller's initial `introAr` and `introEn` are empty strings, which differ from the service fallback text.
- The read rule permits any signed-in user, while the only direct application route is Owner-only.
- Demo/local parsing validates neither array shape nor field shape; `[0] || fallback` semantics remain exact.
- The adjacent save forces upload status pending, but the read itself does not normalize a stored status.

These facts are parity requirements, not approval to correct or redesign them in the bounded extraction.

## 17. Deterministic future test matrix

| Case | Required future result |
| --- | --- |
| Adapter construction/import | Create composition/references only; perform zero `getDoc` calls. |
| Configured document exists with partial data | Return `{ ...fallback, ...storedData }`; stored values override defaults. |
| Configured document contains extra fields | Preserve them at runtime; add no validation or normalization. |
| Configured stored `assetUploadStatus` differs | Preserve current spread behavior; do not normalize on read. |
| Configured document missing | Return the exact six-field repository fallback. |
| Configured `getDoc`, `exists`, or `data` fails | Reject unchanged; do not return fallback or switch mode/provider. |
| Configured operation count | Exactly one `getDoc(settings/branding)` per invocation; no query, list, or extra read. |
| Mapping | Add no document ID; preserve optional stored `updatedAt`/`updatedBy`. |
| Ordering/limit/pagination/cache/realtime | None. |
| Demo/local first stored value | Return it raw before resolution, without fallback overlay. |
| Demo/local missing, invalid JSON, empty, or falsey index 0 | Return the fallback before resolution. |
| Demo/local structurally unusual valid JSON | Preserve JavaScript `[0] || fallback` behavior; do not validate or normalize. |
| Missing/invalid/unsupported Provider state | Throw the existing resolver error before Firebase/local access. |
| Production composition | Explicitly bind `SHIPPED_PROVIDER_MANIFEST`, feature `managed_content_config`, and the real `managedContentConfigImplementations` registry. |
| Single composition | Reuse one existing Firebase instance, registry, and resolver; create no duplicate. |
| Adjacent scope | Branding save, file/upload code, other settings/content methods, Rules/indexes, and callers remain unchanged. |
| Firebase selected | Make no Supabase import or network call. |

## 18. Focused future validation plan

A separately authorized implementation should run only the smallest relevant checks:

- focused managed-content Firebase adapter parity tests including Branding;
- explicit real production-composition assertion closing the D14 Low;
- Provider Contract fail-closed tests for all five error families;
- Firebase runtime/provider and Demo/runtime policy tests;
- static direct-caller and route-role assertions;
- active Rules and no-index-change assertions;
- no duplicate adapter/registry/resolver assertion;
- no Supabase implementation/import/network assertion;
- TypeScript validation and the smallest build/test expansion justified by changed runtime files; and
- `git diff --check`.

The future implementation should not change Rules, indexes, Auth, Firebase configuration, SQL/RLS, hosted state, Production/TEST data, or deployment merely to satisfy validation.

## 19. Current test coverage

D14 tests cover published-content query/mapping/errors, Demo/local ordering and malformed-data behavior, fail-closed Provider selection, one managed-content instance/registry/resolver, caller fallback, active content Rules, and indexes. D16 extends the same harness with Branding construction, exact-read, missing-document, overlay, extra-field, no-ID, error-propagation, Demo-gate, fail-closed, single-composition, and adjacent-boundary assertions. The focused D16 provider/runtime/Demo suite passed 34/34 before independent exact-head review; the full repository unit suite passed 245/245, and `tsc -b`, Vite production build, and `git diff --check` passed.

## 20. Open gates

Preserved exactly:

1. `ORG-001`
2. `ORG-002`
3. `MSG-002`
4. `FILE-001`
5. `BILL-001`
6. `RES-001`
7. `MIG-002`

D15 does not resolve, narrow, rename, remove, add, or reinterpret any gate. `FILE-001` remains Open and adjacent but does not block the exact selected read.

## 21. Internal adversarial review

The bounded self-review confirmed:

- exact starting main and D14 merge parents;
- D14 lifecycle, 0/0/0/1/0 review result, Gate, manual merge, and no-deployment boundary;
- current 17-feature vocabulary and all-Firebase shipped manifest;
- complete caller inventory for every plausible finalist;
- active Rules authority through `firebase.json`;
- exact fallback, error, cache, realtime, ordering, limit, pagination, and Demo/local behavior;
- current single `managed_content_config` composition and the D14 Low closure requirement;
- Branding's presentation-only runtime effect and non-use of file operations;
- unchanged seven Open gates;
- no split authority or Supabase capability; and
- documentation-only scope.

Correction loops: **2 total**. Loop 1 removed an implication that a content-delete service exists, normalized the original candidate risks, clarified a review audience, converted one historical baseline sentence from present to past tense, and added the explicit 25-point readiness checklist. Loop 2 corrected the Admin Operations caller/consumer evidence and risk from Medium to Low, corrected the Branding `assetUploadStatus` usage statement, and retained Branding only after the explicit preview-value and narrower Owner-only boundary tie-breaker. Neither loop changed runtime, Rules, gates, authority, or scope.

D15 focused validation after the second correction recorded:

- static source/lifecycle/composition/scope assertions: 39/39;
- complete direct-caller inventories for all matrix operations: passed;
- Markdown local targets across the four changed documents: 53/53;
- readiness checklist: 25/25;
- exact Open-gate set: 7/7;
- focused Provider Contract, managed-content adapter, Demo/runtime, and read-optimization tests: 38/38;
- stale D14 lifecycle scan: passed;
- documentation-only file-scope assertion: passed;
- no-Supabase runtime scan: passed; and
- `git diff --check`: passed.

## 22. Production, data, deployment, and Supabase impact

D15 is documentation/readiness only.

- Production/TEST data access or change: **none**.
- Firebase Production deployment: **none**.
- Rules/index/Auth/configuration change: **none**.
- Provider manifest or runtime adapter change: **none**.
- Supabase runtime capability: **none**.
- Hosted Supabase, SQL/RLS, migration, seed, backfill, or cutover: **none**.

GitHub source state must not be treated as deployed Firebase state.

## 23. Exact implementation stop point

D15 stopped after D14 lifecycle synchronization, current-source candidate analysis, this documentation-only readiness contract, internal adversarial review, focused validation, **two bounded documentation commits after its correction cycle**, branch push, and one Draft PR. D15 did not implement runtime behavior.

D16 completed the approved seam and was independently exact-head reviewed before PR #159 was manually merged. Its implementation head was `87996359e5b42f5ebf8e07e6bc21463d3ba0d306`; review found 0 Critical, 0 High, 0 Medium, 1 Low, and 1 Nit; focused tests passed 34/34, the full unit suite passed 245/245, `tsc -b`, Vite, and `git diff --check` passed; and PR Gate #269 / run `32558505576` succeeded. Resulting GitHub `main` is `604dcdae8cf4f23ab69c9074bd4ca7d931b5717f`. D14's historical Low is closed by D16 coverage. The one D16 Nit is bounded formatting-sensitive test-maintainability debt and is not a runtime, parity, or security defect. D17 may document it but must not change the test. Firebase Rules/index/Auth, the Provider manifest, Supabase runtime, Production/TEST data, Firebase deployment, and D17 runtime work remain outside D16.
