# Admin Operations settings Firebase adapter readiness

Status: **D18 IMPLEMENTATION IN PROGRESS / AWAITING INDEPENDENT EXACT-HEAD REVIEW AFTER COMPLETION**

Date: 2026-08-22
Verified D18 starting GitHub `main`: `229ed5c3f53648a6151d700b62ecc8cb619c26d0`
Selected Provider feature: `managed_content_config`
Selected operation: `getAdminOperationsSettings()`
Runtime implementation: **IN PROGRESS**
Risk: **Low**

## 1. D16 lifecycle and selection result

D17 is **COMPLETE / REVIEWED / MANUALLY MERGED**. Its readiness head `3b56b6527f8ed05e18376112bc939004e6781c1b` received independent exact-head review with 0 Critical, 0 High, 0 Medium, 0 Low, and 0 Nit. Focused review validation passed static/source 23/23, Markdown 42/42, Provider features 17, direct callers 1, and `git diff --check`; PR Gate #270 / run `32560998804` succeeded; and PR #160 was manually merged as GitHub `main` `229ed5c3f53648a6151d700b62ecc8cb619c26d0`.

D18 is **IMPLEMENTATION IN PROGRESS / AWAITING INDEPENDENT EXACT-HEAD REVIEW AFTER COMPLETION**. It must not be represented as merged, deployed, or a Production/TEST data action. The D16 formatting-sensitive Nit remains bounded and non-blocking unless a safe focused test-only change demonstrably addresses it.

D16 is **COMPLETE / REVIEWED / MANUALLY MERGED**. Its implementation head `87996359e5b42f5ebf8e07e6bc21463d3ba0d306` received independent exact-head review with 0 Critical, 0 High, 0 Medium, 1 Low, and 1 Nit. Focused tests passed 34/34, the full repository unit suite passed 245/245, `tsc -b`, Vite production build, and `git diff --check` passed; PR Gate #269 / run `32558505576` succeeded; and PR #159 was manually merged as GitHub `main` `604dcdae8cf4f23ab69c9074bd4ca7d931b5717f`.

D16 closes D14's historical production-wiring Low through a real production resolver assertion binding `SHIPPED_PROVIDER_MANIFEST`, feature `managed_content_config`, and `managedContentConfigImplementations`. It must not be reopened. The D16 Nit is bounded test-maintainability debt: that semantically correct assertion is somewhat sensitive to source formatting. It is not a runtime, parity, or security defect. D17 does not alter the test; the future focused implementation may make a tiny semantically equivalent test-only tolerance improvement only while retaining all three real production bindings and without exporting production internals.

The bounded post-D16 source check confirms that Admin Operations is now the next useful Low seam: `listContentPages(true)` remains Low but unused; `listContentPages(false)` retains unpublished Owner lifecycle coupling; platform settings retain broad active behavior; favorites remain caller-identity coupled; reviews and feedback retain identity or multi-audience moderation coupling; operational reporting retains cache and cross-collection aggregation; audit evidence retains sensitivity and cache/append coupling; and supplier-search AI intent is an external Firebase AI capability rather than a datastore read. No source change promoted a safer active candidate.

## 2. Exact current source and configured Firebase contract

`src/services/workspace.ts` currently implements the selected operation inline. Its configured branch makes exactly one `getDoc(doc(settingsRef, "adminOperations"))`, where `settingsRef` is the `settings` collection reference. The exact Firebase document is therefore `settings/adminOperations`.

The exact fallback fields are:

```text
reviewNotifications: true
showIncompleteSuppliers: false
requireDuplicateReason: true
dictionarySuggestionMinimum: 2
```

When the configured document exists, current mapping is exactly `{ ...fallback, ...snapshot.data() } as AdminOperationsSettings`. Stored values override fallback values. A missing configured document returns the exact four-field fallback. The operation injects no document ID and performs no validation, normalization, filtering, cache, retry, realtime subscription, query, ordering, cursor, pagination, or second read. Extra stored fields pass through at runtime because the current cast does not filter them.

Configured `getDoc`, `exists`, `data`, or mapping failures reject unchanged. There is no configured-error fallback, Provider fallback, alternate Provider, or localStorage recovery. A repository fallback after a valid missing Firebase document is a data-default behavior, not Provider fallback.

The current inline function constructs a fresh fallback object on every invocation. Future extraction must preserve that observable parity. It should prefer a pure `createAdminOperationsSettingsFallback()`-style factory returning a new four-field object each call, or an equivalent implementation. D17 does not implement it and does not authorize a generic settings-default framework.

## 3. Direct caller and field-use inventory

`AdminOperationalSettingsPage` is the one active runtime caller of `getAdminOperationsSettings()`. It invokes the read once in an effect and applies a successful result to local page state. There is no rejection handler; a rejection remains rejected and the initial page state remains rendered.

The four fields occur only in their `AdminOperationsSettings` type definition, the service fallback, and `AdminOperationalSettingsPage`. The page renders three boolean toggles and one bounded numeric input, then passes local state to the adjacent save operation. There is no current downstream runtime consumer outside the service and settings page. This is an inventory finding, not an inference about future operational meaning.

## 4. Demo/local contract

Before any Provider resolution, the unconfigured application branch is exactly:

```text
localRead<AdminOperationsSettings & { id: string }>("adminOperations")[0] || fallback
```

The storage key is `mujahiz-iq-workspace:adminOperations`. A missing key, invalid JSON, or empty array returns the fallback. The first truthy stored value is returned raw, without fallback overlay; structurally unusual valid JSON retains JavaScript `[0] || fallback` semantics. Demo/local performs no Firebase operation and no Provider resolution.

Configured and Demo/local mapping are intentionally different: configured stored data overlays the fallback; Demo/local returns its raw first stored value. Future work must not normalize or unify those behaviors.

## 5. Application authorization and active Firestore Rules

`AdminOperationalSettingsPage` is routed at `/admin/settings` inside `RoleProtectedRoute` with allowed portal roles `admin` and `super_admin`. `resolvePortalRole(...)` maps domain/application role `admin` to portal role `admin`, and domain/application role `owner` to portal role `super_admin`. This is an Admin-and-Owner application route, not an Owner-only route.

[`firebase.json`](../../firebase.json) identifies [`firestore.rbac.rules`](../../firestore.rbac.rules) as the active Rules source. For `/settings/{settingId}`, read requires `signedIn()`. Create and update allow `isOwner()` or `hasAnyRole(["admin"]) && settingId == "adminOperations"`; delete allows only `isOwner()`. Thus the application route boundary and the Firestore document boundary are distinct. No Rules, Auth, custom-claim, or index contract is required for the selected read extraction.

## 6. Adjacent write is excluded

`saveAdminOperationsSettings(settings, actorId)` remains inline and out of scope. It constructs `{ ...settings, updatedAt, updatedBy: actorId }`, using `serverTimestamp()` when configured and an ISO time in Demo/local. Demo/local performs `localUpsert("adminOperations", { id: "adminOperations", ...payload })`; configured Firebase performs `setDoc(settings/adminOperations, payload, { merge: true })`. D17 and the future read extraction must not move, redesign, or otherwise alter this write.

## 7. Current and required future Provider composition

Current `managed_content_config` composition has exactly one `ManagedContentConfigImplementation`, one Firebase adapter instance, one `managedContentConfigImplementations` registry, and one `resolveManagedContentConfigImplementation()` resolver. Its interface currently contains `getPublishedContentPage(slug)` and `getBrandingSettings()`.

The future implementation must extend that same interface, existing Firebase adapter object and instance, existing registry, and existing resolver with `getAdminOperationsSettings()`. It must not create an `AdminOperationsSettingsImplementation`, another managed-content adapter, Firebase instance, registry, resolver, or Provider container.

The future adapter may reuse its existing `settings` collection reference and construct `doc(settings, "adminOperations")`. Construction/import may create references only; it must make zero `getDoc`, `getDocs`, backend reads, writes, Provider probes, or Supabase initializations.

Required configured call graph:

```text
AdminOperationalSettingsPage
  -> workspace.getAdminOperationsSettings()
  -> isFirebaseConfigured === false ? Demo/local raw-first-record branch :
  -> resolveManagedContentConfigImplementation()
  -> SHIPPED_PROVIDER_MANIFEST selects firebase
  -> existing managedContentConfigImplementations registry
  -> existing Firebase managed-content implementation
  -> getAdminOperationsSettings()
  -> exactly one getDoc(settings/adminOperations)
```

## 8. Provider fail-closed and aggregate authority

The future configured path must preserve the current resolver's five observable error families: `provider_config_missing`, `provider_config_invalid`, `provider_feature_unknown`, `provider_identity_invalid`, and `provider_implementation_unsupported`. Invalid or unsupported Provider selection must fail before Firebase `getDoc`, localStorage, repository fallback, or any alternate Provider. Demo/local is the explicit application mode before resolution, not configured-error recovery.

Firebase remains authoritative for the complete `managed_content_config` aggregate: published content; content lists and writes; Branding reads and writes; Admin Operations reads and writes; platform settings; and all related current behavior. The future change is Firebase-to-Firebase organization only. It authorizes no split authority, Supabase adapter/client/import/query/environment/network capability, dual read, dual write, Provider probing, manifest transition, SQL/RLS, migration, seed, backfill, data copy, or cutover.

## 9. Explicit exclusions and parity quirks

Excluded from D17 and the future bounded read implementation are the adjacent Admin Operations write, other settings and content methods, callers/UI/copy, route or authorization changes, Rules/index/Auth/configuration, Provider vocabulary or shipped-manifest changes, duplicate Provider composition, Supabase, SQL/RLS, hosted action, Production/TEST data action, Firebase deployment, and runtime implementation in D17.

Parity requirements are: a fresh four-field fallback per operation; missing configured document returns that fallback; configured stored fields overlay it; extra configured fields pass through; no ID is injected; configured errors reject; Demo/local returns raw first truthy storage value without overlay before resolution; malformed/missing/empty Demo storage returns fallback; and no cache, retry, query, or realtime behavior is introduced.

## 10. Deterministic future D18 test matrix

| Case | Required future result |
| --- | --- |
| Adapter construction/import | Reference construction only; zero backend reads, writes, Provider probes, or Supabase initialization. |
| Configured operation count | Exactly one `getDoc(settings/adminOperations)` per invocation. |
| Missing configured document | A fresh exact four-field fallback. |
| Partial configured document | Fallback overlay with stored overrides. |
| Extra configured fields | Preserve them at runtime; add no filtering or validation. |
| ID mapping | Do not inject an ID. |
| Configured errors | `getDoc`, `exists`, and `data` failures reject unchanged. |
| Demo/local | Raw first stored value without overlay; missing, invalid JSON, empty, or falsey index zero returns fallback. |
| Ordering | Demo/local branch executes before resolver; it performs no Firebase or Provider access. |
| Provider failures | All five resolver error families fail closed before Firebase/localStorage/repository/alternate Provider behavior. |
| Composition | One existing managed-content Firebase instance, registry, and resolver; no duplicate composition. |
| D16 regression | Preserve the real production-wiring binding for manifest, feature, and registry; do not weaken it. |
| Published-content and Branding regressions | Preserve both existing managed-content operations and their established parity. |
| Adjacent/authorization regressions | Admin Operations write, platform settings, route/Roles, and Rules remain unchanged. |
| Environment boundary | No Supabase runtime capability and all seven Open gates remain unchanged. |

## 11. Focused future validation, gates, and stop point

A separately authorized runtime implementation should run focused managed-content adapter parity tests including Admin Operations, Provider fail-closed tests, Firebase runtime and Demo/local ordering tests, a production-composition assertion retaining all three D16 bindings, published-content and Branding regressions, static caller/field-use/route/Rules/adjacent-write assertions, no-duplicate-composition and no-Supabase assertions, the smallest justified TypeScript/build expansion, and `git diff --check`. It should not run deployment, Production smoke, Firebase Emulator, Docker, SQL/pgTAP, hosted Supabase, or broad suites unless implementation evidence requires them.

The Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`. D17 resolves none and does not reinterpret `FILE-001`.

D17 is documentation/readiness only: Production/TEST data access or change, Firebase deployment, Rules/index/Auth/configuration change, Provider manifest change, Supabase runtime capability, hosted Supabase, SQL/RLS, migration, seed, backfill, and cutover are all **none**. Stop after independent exact-head D17 readiness review, before any Admin Operations runtime implementation, Ready transition, merge, deployment, Firebase change, Supabase work, migration, or Production/TEST data action.
