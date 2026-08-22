# Content-page list Firebase adapter readiness

Status: **D19 READINESS COMPLETE / AWAITING INDEPENDENT EXACT-HEAD REVIEW**

Date: 2026-08-22
Verified D19 starting GitHub `main`: `89fb43c6d5340518db9283abbcf00a2286e1d9fa`
Selected Provider feature: `managed_content_config`
Selected operation: `listContentPages(publishedOnly = false)`
Runtime implementation: **NOT STARTED**
Risk: **Medium**

## 1. D18 lifecycle and D19 selection

D18 is **COMPLETE / REVIEWED / MANUALLY MERGED**. PR #161 manually merged final independently reviewed D18 head `5953ad98844ce914647ade8bb7b1a4061fefda7f` as GitHub `main` `89fb43c6d5340518db9283abbcf00a2286e1d9fa`. Its original head `5be09b2baacd188b9012effe306dcd634f59e4b9` had one Medium limited to documentation lifecycle/current-state drift; that correction is resolved. The corrected-head review found 0 Critical, 0 High, 0 Medium, 0 Low, and 1 Nit; static assertions passed 73/73, runtime/test-blob invariance 4/4, Markdown links 2/2, and `git diff --check`; Gate #272 / run `32572497400` succeeded.

The D16 production-wiring Nit remains bounded non-blocking test-maintainability debt: its real production binding is semantically correct but formatting-sensitive. D19 changes no test and does not reopen it.

D19 selects the one existing operation `listContentPages(publishedOnly = false)`, preserving both modes. `false` is actively used by the Owner CMS and is the useful next extraction; `true` has no direct runtime caller. Selecting only the unused `true` mode would be technically lower-risk but would not produce a live runtime extraction. Splitting the public API into two methods lacks source evidence and is not authorized.

## 2. Bounded candidate comparison

| Candidate | Current evidence | Result |
| --- | --- | --- |
| `managed_content_config / listContentPages(true)` | Public published-only query, but no direct runtime caller. | Deferred: low technical risk but no useful active extraction. |
| `managed_content_config / listContentPages(false)` | One active Owner CMS caller; one bounded collection read; drafts are included and Firestore Rules require Owner. | Selected as the existing whole operation, preserving both modes; Medium for privileged unpublished-content lifecycle. |
| `managed_content_config / getPlatformSettings()` | Broad active callers across access, administration, taxonomy, dashboard, and approval behavior. | Deferred: materially wider product and write/lifecycle coupling. |
| `supplier_favorites`, reviews, feedback | Private identity or multi-audience/moderation coupling; adjacent deterministic writes or audit effects. | Deferred: not a smaller authorization-safe seam. |
| `operational_reporting`, `audit_evidence`, AI intent | Cross-collection cache/aggregation; sensitive append evidence; or external Firebase AI rather than datastore read. | Deferred/ineligible. |

Firebase remains authoritative for the full `managed_content_config` aggregate. This is a Firebase-to-Firebase organizational seam only; it changes no Provider manifest authority.

## 3. Exact current source and caller inventory

The current workspace signature is `listContentPages(publishedOnly = false)`. The only direct runtime caller is `OwnerContentPage` in [`AdminWorkspacePages.tsx`](../../src/pages/workspace/AdminWorkspacePages.tsx): its `load` function invokes `listContentPages(false)` once in an effect and again after `saveContentPage(...)` succeeds. It has no call-site catch, fallback, sort, or filter; a configured rejection therefore rejects `load` unchanged. It consumes the returned list in original service order to select/edit CMS records.

No direct runtime caller supplies `true`, and no source evidence supports extracting a public-only alternate method. The selected future interface boundary is therefore one fourth method on the existing interface: `listContentPages(publishedOnly?: boolean): Promise<ContentPageRecord[]>`.

The route is `/super-admin/content`, inside `RoleProtectedRoute` with only portal role `super_admin`. `resolvePortalRole(...)` maps application/domain role `owner` to `super_admin`. Route authorization is an application/UI boundary and is distinct from Firestore authorization.

## 4. Exact configured Firebase behavior

`contentPagesRef` is `collection(db, "contentPages")`. The configured read performs exactly one `getDocs`:

```text
publishedOnly === true:
  query(contentPagesRef, where("status", "==", "published"), limit(100))
publishedOnly === false:
  query(contentPagesRef, limit(100))
```

There is no explicit Firestore `orderBy`, cursor, pagination API, cache, retry, realtime subscription, validation, normalization, or service-level catch. Firebase query, snapshot, mapping, and sorting failures reject unchanged. Empty configured snapshots return `[]`.

The snapshot mapping is `snapshot.docs.map((item) => withId<ContentPageRecord>(item))`, where `withId` returns `{ id: snapshot.id, ...snapshot.data() }`. A stored `id` therefore overwrites the snapshot document ID. The mapped array is always finally sorted by numeric subtraction `a.order - b.order`. Consequently Firebase's native unspecified query order only acts as a tie/invalid-value input to the final client sort; the service does not add deterministic secondary ordering. The `limit(100)` is applied before that client sort and there is no way to request another page.

## 5. Demo/local behavior and parity differences

When Firebase is unconfigured, the branch executes before Provider resolution. `localRead<ContentPageRecord>("contentPages")` parses `mujahiz-iq-workspace:contentPages`, returns `[]` for a missing key or syntactically invalid JSON, and then filters in stored array order:

```text
!publishedOnly || item.status === "published"
```

Demo/local has no 100-record cap, no Firestore query, no ID injection, and no final numeric `order` sort. Thus both modes preserve stored order locally while Firebase returns at most 100 documents and numerically sorts by `order` after mapping. `localRead` does not validate successfully parsed JSON; a syntactically valid non-array can make `.filter(...)` throw. That behavior, and configured error propagation, must remain unchanged.

## 6. Firestore Rules, indexes, and adjacent writes

[`firebase.json`](../../firebase.json) selects [`firestore.rbac.rules`](../../firestore.rbac.rules) as the active Rules source. The applicable rule is:

```text
match /contentPages/{pageId} {
  allow read: if resource.data.status == "published" || isOwner();
  allow create, update, delete: if isOwner();
}
```

The `true` query confines its potential result set to published documents. The active `false` query can return drafts/unpublished records, so it is valid only for an Owner; its actual caller is the Owner-only route above. No Rules, Auth, custom-claim, or index change is selected. `firestore.indexes.json` has no `contentPages` composite entry; these current simple queries do not add a repository-managed index requirement. If future implementation proves an index or authorization change necessary, it must stop rather than silently expanding scope.

`saveContentPage(input)` is explicitly excluded. It uses `localUpsert("contentPages", payload)` in Demo/local and `setDoc(doc(contentPagesRef, input.id), payload, { merge: true })` when configured, with `updatedAt` set to local ISO time or `serverTimestamp()`. It remains inline, Owner-authorized, Firebase-authoritative, and outside the future read-only implementation. Branding, Admin Operations, platform settings, and every other managed-content/config read or write are also excluded.

## 7. Required Provider composition and fail-closed boundary

Future implementation must extend exactly the existing `ManagedContentConfigImplementation`, existing Firebase adapter object and one Firebase implementation instance, `managedContentConfigImplementations` registry, and `resolveManagedContentConfigImplementation()` resolver. It must not create a second adapter, instance, registry, resolver, or Provider container. Initialization must continue to construct references only; the list read occurs only on method invocation.

The workspace facade must retain Demo/local before resolution. On the configured path, existing resolver failures remain observable and fail closed before Firebase, localStorage, repository fallback, another Provider, or Supabase behavior: `provider_config_missing`, `provider_config_invalid`, `provider_feature_unknown`, `provider_identity_invalid`, and `provider_implementation_unsupported`.

Firebase remains authoritative for published and draft content pages, content-page writes, Branding, Admin Operations, platform settings, and all related aggregate behavior. No split authority, dual read/write, provider probing, fallback, Supabase client/import/query/environment/network capability, SQL/RLS, migration, hosted action, or cutover is authorized.

## 8. Deterministic future implementation and validation contract

The next separate runtime task/branch may change only the existing managed-content composition and configured branch needed for this method. It must prove, with focused synthetic tests:

| Case | Required assertion |
| --- | --- |
| Composition | Exactly one existing interface/adapter instance/registry/resolver is extended with the fourth method. |
| Demo ordering | Demo/local executes before resolution; it filters in stored order, has no cap/sort/ID injection, and preserves malformed-storage behavior. |
| Configured false mode | Exactly `getDocs(query(contentPages, limit(100)))`; mapped results get final numeric `order` sort. |
| Configured true mode | Exactly `getDocs(query(contentPages, where(status == published), limit(100)))`; same mapping and sort. |
| Mapping | `{ id: snapshot.id, ...data }` preserves stored-ID overwrite. |
| Empty/error | Empty snapshots return `[]`; configured query/mapping/sort errors propagate; no service fallback. |
| Boundary | Owner route and Firestore rule remain distinct; no Rules/Auth/index/manifest change and `saveContentPage` stays inline. |
| Regressions | Existing published-content, Branding, and Admin Operations adapter behavior and fail-closed resolver errors remain unchanged. |
| Environment | No Supabase runtime capability, hosted action, data operation, or deployment appears. |

Focused future validation is static/source assertions plus the directly affected managed-content adapter and workspace tests, `git diff --check`, documentation links if changed, and a documentation-only/runtime-scope assertion. Do not run the full repository suite, TypeScript build, Vite build, Emulator, Docker, SQL/pgTAP, E2E, Production smoke, or hosted Supabase checks by default unless the implementation diff/risk requires them.

## 9. Gates, impact, and stop point

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`, `FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`; D19 resolves none. D19 is documentation/readiness only: no runtime implementation, Production/TEST data action, Firebase deployment, Rules/index/Auth/configuration change, Provider manifest change, Supabase capability, SQL/RLS, migration, seed, backfill, or hosted operation occurred.

Stop after independent exact-head D19 readiness review. The selected runtime implementation is **NOT STARTED** and belongs to the next separate task/branch/PR. Stop before Ready, runtime implementation, merge, deployment, Firebase Production, Rules/index/Auth changes, Provider manifest change, Supabase, migration, or Production/TEST data action.
