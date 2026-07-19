# Firestore read budget

This inventory counts logical Firestore query operations. Actual billed document reads depend on result size and listener changes. Aggregate count queries are listed separately because Firestore bills them according to aggregate-query rules.

## Logical query inventory

| Flow and source | Collection or operation | Filter, ordering, and server bound | Trigger and frequency | Role, lifecycle, cache, and index |
| --- | --- | --- | --- | --- |
| Public landing and login pages | No Firestore read | Public taxonomy is bundled; login uses Firebase Auth | Page mount | Public; no listener or index |
| Successful login: `AuthContext.loadProfile` / `getUserProfile` | `users/{uid}` document read | Exact authenticated UID | Auth state change or explicit profile refresh | All authenticated roles; stale verification can perform one post-sync reread; no shared query |
| Dashboard route resolution | No additional Firestore read | Uses the loaded Auth profile | Route resolution | All roles; no query recreation |
| Shell notifications: `NotificationProvider` / `subscribeNotifications` | `notifications` listener | `userId == uid`; `createdAt desc`; document ID desc; `limit(26)` to expose a 25-item page | Once per authenticated UID; manual refresh replaces it | All roles; one shell provider, stale-session guard, unsubscribe on UID change/sign-out; composite `userId + createdAt` index |
| Notification history: `listNotificationsPage` | `notifications` query | Same UID/order; cursor `startAfter(createdAt, id)`; `limit(26)` | Explicit Load more only | All roles; in-flight UI lock; no reread of prior pages; same index |
| Mark one / mark loaded as read | Updates only; no prerequisite query | Exact loaded IDs; mark-all batch capped below Firestore's limit | Explicit user action | Self-only Rules remain authoritative; optimistic rollback; no index |
| Buyer dashboard | `favorites`, `rfqs`, `supplierSubmissions` | UID filters; limits 250, 200, and 100 respectively; submissions ordered `createdAt desc` | Buyer dashboard mount | Buyer only; page-level reads; submissions use `submittedBy + createdAt` index |
| Supplier dashboard | `supplierSubmissions`, `rfqs`, `supplierDocuments`, `conversations` | Exact user/profile filters; limits 100, 100, 250, and 100 | Supplier dashboard mount | Supplier only; page-level reads; no shell duplication |
| Admin dashboard: `getPortalMetrics(\"admin\")` | 7 `getCountFromServer` aggregations | Users total/buyer/supplier; approved suppliers; pending submissions/reviews/feedback | Initial eligible load, after 60-second TTL, or manual refresh | Admin only; concurrent; cache key `admin:{categoryCount}`; in-flight deduplicated |
| Owner dashboard: `getPortalMetrics(\"owner\")` | 5 `getCountFromServer` aggregations | Users total/admin/owner; approved suppliers; pending submissions | Initial eligible load, after 60-second TTL, or manual refresh | Owner only; concurrent; cache key `owner:{categoryCount}`; in-flight deduplicated |
| Recent administrative audit | `auditLogs` query | `createdAt desc`; bounded page size | Eligible dashboard load or manual refresh | Admin/Owner; 30-second TTL and in-flight deduplication; existing order index |
| Operational report: `getOperationalReport` | 11 count aggregations | Existing report definitions are unchanged | Report route opens, 60-second expiry, or explicit refresh | Admin/Owner only; lazy, concurrent, in-flight deduplicated; cache key `global` |
| Bounded administrative lists | `users`, `supplierSubmissions`, `reviews`, `supplierFeedback` | Status/owner filters; `createdAt desc`; `limit(100)` | Corresponding route load | Authorized administrative routes only; required status/owner ordering indexes are declared |
| Focus, visibility, Bell open/reopen, language change, idle interval | No Firestore operation | Not applicable | Presentation/lifecycle events | Polling and focus refetches removed; active listener handles actual notification changes |

Listener transport reconnects are controlled by the Firebase SDK and are not counted as new logical application subscriptions. The application keeps one current-UID subscription and discards callbacks from prior sessions.

## Before this change

| Scenario | Buyer/Supplier | Admin/Owner | Notes |
| --- | ---: | ---: | --- |
| Public landing page | 0 | 0 | Public taxonomy uses bundled defaults. |
| Initial authenticated shell | 4 queries | 7 queries | Auth profile and settings plus Bell queries. |
| Admin dashboard | - | 14 aggregates + 1 audit query | The same set was requested again in React StrictMode and after language changes. |
| Buyer dashboard | 3 page queries + 2 Bell queries | - | Favorites, RFQs, submissions. |
| Supplier dashboard | 4 page queries + 2 Bell queries | - | Submissions, RFQs, documents, conversations. |
| Bell open and reopen | 0 | 0 | Opening used local state, but the background timer continued. |
| Browser focus | 2 queries | 5 queries | Every focus event forced a Bell reload. |
| Idle for 60 seconds | 4 queries | 10 queries | Fixed 30-second polling. |
| Route away and back | route queries again | dashboard aggregates again | No shared TTL cache. |
| Operational report | - | 11 aggregates per visit/refresh | Lazy route, but no cache or in-flight deduplication. |

## After this change

| Scenario | Buyer/Supplier | Admin/Owner | Notes |
| --- | ---: | ---: | --- |
| Public landing page | 0 | 0 | Unchanged. |
| Initial authenticated shell | 1 profile + 1 settings + 1 bounded listener | same | The listener reads at most 26 documents and is shared by Bell and page. |
| Admin dashboard | - | 7 aggregates + 1 audit query | Admin-only metrics, 60-second metric TTL, 30-second audit TTL. |
| Owner dashboard | - | 5 aggregates + 1 audit query | Owner-only metrics and the same cache guarantees. |
| Buyer dashboard | 3 page queries | - | Bell reuses the shell listener. |
| Supplier dashboard | 4 page queries | - | Bell reuses the shell listener. |
| Bell open and reopen | 0 | 0 | No new Firestore request. |
| Browser focus | 0 | 0 | Focus polling was removed. |
| Idle for 60 seconds | 0 recurring queries | 0 recurring queries | Listener traffic occurs only when matching notification documents change. |
| Route away and back | route queries again | cached metrics/audit within TTL | Manual refresh bypasses the cache. |
| Operational report | - | 11 aggregates on first open | Lazy, in-flight deduplicated, cached for 60 seconds, and manually refreshable. |

## Query boundaries

- Notifications are scoped by authenticated UID, ordered by `createdAt` and document ID, and paged 25 at a time.
- The unread badge is exact for the loaded recent window. When older history exists, it shows the loaded unread count as a lower bound (`N+`) instead of presenting a lifetime-exact value.
- Mark-all updates only the loaded bounded window while older pages remain; both Arabic and English labels state this explicitly. Loading more expands that window without rereading previous pages.
- Status lists are ordered and limited on the server to 100 records.
- Notification mark-one performs one update and no reload.
- Notification mark-all performs one bounded batch and no prerequisite list query when IDs are already loaded.
- Account switches clear notification state and invalidate callbacks before a new UID subscription is accepted.
- Language changes do not refetch dashboard metrics.
- No Production reads or writes are performed by these tests.
