# Firestore read budget

This inventory counts logical Firestore query operations. Actual billed document reads depend on result size and listener changes. Aggregate count queries are listed separately because Firestore bills them according to aggregate-query rules.

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
- Status lists are ordered and limited on the server to 100 records.
- Notification mark-one performs one update and no reload.
- Notification mark-all performs one bounded batch and no prerequisite list query when IDs are already loaded.
- Account switches clear notification state and invalidate callbacks before a new UID subscription is accepted.
- Language changes do not refetch dashboard metrics.
- No Production reads or writes are performed by these tests.
