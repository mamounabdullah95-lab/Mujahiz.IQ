# Phase 1 Security Boundaries

## Runtime policy

Mujahiz IQ resolves exactly one Firebase runtime target at startup.

| Environment | Required condition | Runtime target |
| --- | --- | --- |
| Production | Structurally valid Firebase web configuration | `firebase` |
| Production | Missing or malformed Firebase web configuration | `configuration_error` |
| Development | `VITE_USE_FIREBASE_EMULATORS=true` | `emulator` |
| Development | `VITE_FORCE_DEMO=true` | `demo` |
| Development | Valid Firebase web configuration and no explicit local target | `firebase` |
| Development | No valid configuration and no explicit local target | `configuration_error` |

Production never falls back to Demo mode. `VITE_FORCE_DEMO` and
`VITE_USE_FIREBASE_EMULATORS` are ignored as activation mechanisms in a production
build. The configuration-error target renders a static bilingual error screen and
does not load authentication, registration, or application routes.

Firebase web configuration is considered structurally valid only when the API key,
Auth domain, project ID, and web app ID match their expected public identifier
formats. Validation errors never include the submitted configuration values.

## Environment variables and feature flags

Vite evaluates these values at build time. Boolean flags use exact, case-sensitive
`=== "true"` semantics. Missing, malformed, `1`, `TRUE`, and `yes` are disabled.

| Variable | Purpose | Default when missing | Allowed environment | Failure behavior |
| --- | --- | --- | --- | --- |
| `VITE_PUBLIC_SITE_URL` | Canonical public URL metadata | Existing site helper fallback | All | Does not affect authentication target |
| `VITE_FIREBASE_API_KEY` | Public Firebase web app identifier | Empty | Firebase and Emulator builds | Missing/malformed production config fails closed |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Empty | Firebase and Emulator builds | Missing/malformed production config fails closed |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Empty; demo project fallback only for explicit Emulator | Firebase and Emulator builds | Missing/malformed production config fails closed |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase bucket name used by SDK config | Empty | Firebase and Emulator builds | Does not enable uploads |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web app identifier | Empty | Firebase and Emulator builds | Does not enable a feature |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID | Empty | Firebase and Emulator builds | Missing/malformed production config fails closed |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY` | App Check Enterprise reCAPTCHA site key | Empty | Real Firebase only | Undefined disables App Check initialization |
| `VITE_FIREBASE_AI_ENABLED` | Optional AI interpretation path | `false` | Explicitly configured builds | Fail-closed; undefined or malformed disables AI |
| `VITE_FIREBASE_AI_MODEL` | AI model name | `gemini-2.5-flash-lite` | When AI is explicitly enabled | No effect while AI is disabled |
| `VITE_FORCE_DEMO` | Local Demo runtime | `false` | Development/test only | Ignored for production activation |
| `VITE_FILE_UPLOADS_ENABLED` | Future upload controls | `false` | Reserved for a future approved launch | Fail-closed; remains disabled in this phase |
| `VITE_SUPPLIER_EXCEL_IMPORT_ENABLED` | Supplier Excel import feature | `false` | Explicitly configured builds | Fail-closed; production deploy script and CI explicitly preserve `true` |
| `VITE_USE_FIREBASE_EMULATORS` | Local Firebase Emulator runtime | `false` | Development/test only | Ignored for production activation |
| `VITE_FIREBASE_EMULATOR_HOST` | Local Emulator host | `127.0.0.1` | Development/test only | Read only when Emulator target is active |
| `VITE_FIREBASE_AUTH_EMULATOR_PORT` | Local Auth Emulator port | `9099` | Development/test only | Read only when Emulator target is active |
| `VITE_FIREBASE_FIRESTORE_EMULATOR_PORT` | Local Firestore Emulator port | `8080` | Development/test only | Read only when Emulator target is active |

The deployment helper explicitly writes Demo and Emulator flags as `false`, file
uploads as `false`, and Excel import as `true`. This documents the existing
production state; this pull request does not deploy it.

## Demo session cleanup

When a structurally valid real Firebase production runtime starts, only these
known Mujahiz Demo keys are removed:

- `mujahiz-iq-demo-db`: local mock database; removing it prevents stale Demo data
  from appearing after a real Firebase start.
- `mujahiz-iq-demo-session`: legacy local Demo session key and current per-tab
  Demo session key.

The cleanup does not call `localStorage.clear()`, does not remove locale or
accessibility preferences, and does not touch Firebase Auth persistence keys.
Demo passwords are held in memory only. Demo login state uses `sessionStorage`,
not persistent `localStorage`.

## Firestore authorization boundaries

### RFQ lifecycle

- An authorized Buyer creates a draft or publishes an RFQ with their own immutable
  `buyerId`.
- Publication requires active Buyer access, at least one recipient, and a future
  closing timestamp.
- A targeted Supplier is identified through the approved account's trusted
  `supplierProfileId`; a user UID in `recipientIds` is not accepted as a target.
- The targeted approved Supplier can create one deterministic response while the
  RFQ is open and before its cutoff.
- A Supplier can update only its own response fields. RFQ, Supplier user, Supplier
  profile, response ID, and creation timestamp cannot be transferred.
- The Buyer can read responses for their RFQ and compare them. Admin and Owner can
  read RFQs and responses for review, but receive no implicit mutation or delete
  access.
- Published/receiving RFQs can transition only through the allowed status fields.
  Closed or cancelled RFQs cannot be reopened or materially edited, and no
  response can be created or updated after closure or cutoff.

### Conversations and messages

- A direct conversation binds the authenticated Buyer to the trusted
  `accountOwnerId` on an approved Supplier profile.
- An RFQ conversation requires a real RFQ whose Buyer and targeted Supplier match
  the exact two participants.
- Conversation documents contain exactly two participants and matching participant
  label keys. Participant IDs, labels, Supplier ID, RFQ ID, and creation time are
  immutable.
- Historical conversation and message reads remain available to signed-in
  participants. Every new message, preview update, or read receipt revalidates the
  caller's current Buyer access or canonical active Supplier ownership.
- Messages are authorized through their parent conversation. Sender identity must
  match the authenticated participant.
- A read-receipt update may preserve existing entries and add only the
  authenticated caller's own UID. It cannot remove an entry, add another
  participant or unrelated UID, or change any protected message field.
- Anonymous and unrelated accounts are denied.
- Admin and Owner do not receive blanket conversation or message access because no
  current trusted document proves an operational involvement relationship.

## Rules complexity and dependent-document access

The Emulator gate scans `firestore-debug.log` and `firebase-debug.log` and fails on:

- the 1,000-expression evaluation limit;
- document access-call limit diagnostics;
- rules function or call-depth limit diagnostics.

The tested RFQ paths use the authenticated user document through shared role
helpers, up to one Supplier profile document, and one RFQ document for response
validation. RFQ-linked conversation creation uses the user document, one Supplier
profile, and one RFQ. Message paths use one parent conversation. Repeated reads of
the same path may be cached by Firestore Rules, so the Emulator log gate is the
authoritative check rather than a source-only assumption.

The final Emulator run must contain no expression-limit, access-call-limit, or
call-depth warning.

## Firestore Read Follow-Up Candidates

This section is a static diagnostic. It does not claim measured Production savings
and this security pull request does not change any query, page size, listener, or
polling behavior.

| File and function | Trigger | Query and current bound | Mode and cleanup | Probable reads and executions | Future correction |
| --- | --- | --- | --- | --- | --- |
| `src/components/NotificationBell.tsx`, `load` | Authenticated shell mount, every 30 seconds, browser focus, Demo update event | User submissions and feedback are unbounded matching queries; Admin additionally loads all pending submissions, reviews, and feedback | One-time queries on each poll. Interval and event listeners are cleaned up; an in-flight request is only prevented from setting state after cleanup | Up to every matching document per query, once on mount plus about two polls per minute and each focus event | Replace broad polling with bounded server counts plus a recent-items query, then measure before selecting a listener or cache |
| `src/services/firestore.ts`, `fetchDuplicateIndexes` | Manual Supplier duplicate checks during form/review flow | Full `supplierDuplicateIndex` collection, no limit | One-time query, no listener | Approximately the entire approved Supplier index per check; currently about 479 documents and potentially multiple checks per form session | Query normalized lookup keys or maintain narrowly addressable indexes in a separate performance/data-model PR |
| `src/services/supplierExcelImport.ts`, `fetchSupplierImportDuplicateIndexes` | Excel preview and validation | Full approved duplicate index plus full pending submission duplicate index | One-time queries per preview/validation call | About 479 approved index documents plus every pending index document; can execute more than once per import session | Batch exact-key lookups or introduce a scoped duplicate service after measuring import patterns |
| `src/services/firestore.ts`, `listUsers` | Admin user management and some role workflows | Entire `users` collection when no status is supplied; client truncates to 100 only after download | One-time query, no listener | Every user document per load | Add server-side ordering, limit, and cursor pagination |
| `src/services/adminUsers.ts`, `listAdministrativeUsers` | Admin/Owner opens user table | Ordered `users` query with `limit(500)` | One-time query, no listener | Up to 500 documents per page load | Add cursor pagination and load only columns needed by the table |
| `src/services/firestore.ts`, `listSuppliers` | Admin dashboard and approved Supplier administration | All approved Suppliers, no limit | One-time query, no listener | Currently about 479 documents for each call; Admin dashboard can repeat this independently of the approved-Suppliers page | Use aggregate count for dashboard metrics and cursor pagination/export-specific loading for lists |
| `src/pages/DirectoryPage.tsx`, initial load and smart search | Directory mount, load-more, category-aware smart search | Initial/page query uses 100 documents; category candidates use `array-contains-any` with `limit(100)`; material dictionary uses `limit(500)` | One-time queries, no listener; component mount effect runs once | 100 Supplier documents plus up to 500 terms at entry; another 100 per load-more; category search can read up to 100 more | Cache taxonomy/material terms, preserve cursor pagination, and measure candidate overlap before changing search architecture |
| `src/services/workspace.ts`, `listNotifications` and `markAllNotificationsRead` | Notifications page and mark-all action | User notifications use `limit(200)`; mark-all first downloads the same query then updates up to 400 unread records | One-time query, no listener | Up to 200 reads per load or mark-all action | Add ordering/status filters and paginate notification history |
| `src/services/workspace.ts`, RFQ/conversation/message list functions | Buyer/Supplier workspace page or selected conversation | Buyer RFQs `limit(200)`, Supplier RFQs `limit(100)`, responses `limit(100)`, conversations `limit(100)`, messages `limit(250)` | One-time queries, no listener. Message list repeats after send | Up to each stated limit per action; selected message thread is re-read after every send | Add ordering/cursors and append the confirmed sent message locally before a bounded refresh |
| `src/services/firestore.ts`, `listMaterialTerms` | Directory and Admin dictionary pages | Active terms with `limit(500)` | One-time query, no listener | Up to 500 documents per page load | Cache by dictionary version and load deltas in a later performance PR |

No `onSnapshot`, `collectionGroup`, `offset`, or manual Firestore listener was found
in the current application source. Timers unrelated to Firestore either have
cleanup or are short navigation delays. Broad-query corrections are deliberately
out of scope for this phase.

## Operational safeguards

- The deployment script does not echo Firebase SDK configuration on validation
  failure.
- CI uses synthetic non-secret Firebase web identifiers.
- Production environment generation pins security-sensitive flags explicitly.
- No Firebase deployment, Production write, dependency update, migration, seed, or
  data normalization is part of this phase.
