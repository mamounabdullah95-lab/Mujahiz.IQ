# Backend provider abstraction readiness

Status: **C1 `CORRECTION_REQUIRED`; Correction Loop 1 applied; awaiting exact-head independent re-review; documentation only; no provider implementation or application refactor authorized**

Date: 2026-08-18

## 1. Scope and verified starting point

This contract defines the smallest provider-neutral seam that can precede the later Firebase-to-Supabase Auth proof of concept and progressive feature migration. Firebase remains the sole current Production backend, authentication, database, and hosting authority.

The verified task base is `origin/main` `b7c83f512b337cf21f517548b724a1c5edf9d821`, the merge of PR #143. PR #143 merged the B6 documentation head `ad6ca64e2a27ca358a492b084ac098bff3ff858e`; PR Gate #242 / run `32109934587` succeeded on that exact head. Package B and B6 are therefore `COMPLETE` after re-verification of the merged `origin/main`.

This document changes no application code, dependency, Firebase configuration, Supabase configuration, Auth behavior, database, Rules, index, Storage, Function, data, or deployment state.

## 2. Authorities and selected architecture

This contract applies the merged authorities in [`00_CURRENT_STATE_AND_INVENTORY.md`](00_CURRENT_STATE_AND_INVENTORY.md), [`01_TARGET_HYBRID_ARCHITECTURE.md`](01_TARGET_HYBRID_ARCHITECTURE.md), [`03_AUTH_AND_IDENTITY_OPTIONS.md`](03_AUTH_AND_IDENTITY_OPTIONS.md), [`07_PHASED_EXECUTION_PLAN.md`](07_PHASED_EXECUTION_PLAN.md), and [`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md).

The selected architecture is a small provider-contract kernel beneath the existing service import surface:

```text
existing UI and contexts
        |
existing feature service API
        |
feature contract + strict provider resolver
        |
Firebase adapter (only implemented adapter)
        |
Firebase Auth / Firestore / callable Functions
```

The UI neither receives provider identifiers nor selects providers. Demo and Firebase Emulator are runtime modes of the Firebase implementation, not backend providers. A future Supabase adapter occupies a typed registry slot only after separate approval; it is not bundled, probed, or selected here.

## 3. Focused current dependency inventory

| Boundary | Current evidence | Readiness consequence |
|---|---|---|
| Initialization/runtime | `src/config/firebase.ts` initializes Firebase App, Auth, Firestore, Functions, optional App Check, and emulator connections. `src/config/runtimePolicy.ts` selects `firebase`, `emulator`, `demo`, or `configuration_error`. | Preserve this policy; Demo/Emulator are not providers. |
| Fail-closed configuration | `src/main.tsx` denies bootstrap with `FirebaseConfigurationErrorScreen`. `tests/demo-mode.test.mjs` proves missing/malformed Production Firebase configuration denies bootstrap. | Manifest failure must deny safely before a protected operation; it must not enter Demo or try another backend. |
| Firebase Auth | `src/contexts/AuthContext.tsx` owns sessions, login, registration, logout, verification synchronization, and profile loading. Four page flows also import Firebase Auth directly. | Auth wrapping is not the first slice. Firebase Auth behavior remains exact until a separately approved Auth task. |
| Firestore | Direct SDK use exists in `firestore.ts`, `workspace.ts`, `registration.ts`, `supplierExcelImport.ts`, `supplierOwnership.ts`, `supplierWorkspace.ts`, `portalDashboard.ts`, and `adminUsers.ts`. Firebase value types also reach `src/types/domain.ts` and `src/utils/date.ts`. | Most UI consumers already use services, but a repository-wide adapter refactor would be broad and behavior-sensitive. |
| Callable Functions | `src/services/supplierOwnership.ts` is the sole browser Functions boundary and calls the nine Claim/Supplier callables through `europe-west1`. | The complete Claim aggregate remains one authority. Callable failure never selects another path or provider. |
| Storage | No Firebase Storage SDK/adapter exists. `src/services/uploadService.ts` fails closed, and `tests/file-upload-policy.test.mjs` asserts the absence of upload APIs. | Storage remains unsupported; a provider manifest cannot enable it. |
| Existing selection patterns | `isStrictlyEnabled`, `resolveFirebaseRuntime`, frozen `features`, and frozen `firebaseRuntime` use exact values and pure policy tests. | Reuse strict parsing, immutability, and injected pure resolution. Never infer authority from SDK availability, data existence, errors, or latency. |

Observable Firebase behavior is constrained by focused tests including `demo-mode.test.mjs`, `firebase-runtime.test.mjs`, `email-verification.test.mjs`, `password-recovery.test.mjs`, `firestore-read-optimization.test.mjs`, `file-upload-policy.test.mjs`, and the focused Firestore/Functions Emulator suites. Runtime suites are unnecessary for this documentation-only C1 diff.

## 4. Provider identity and manifest

The provider vocabulary is closed and versioned:

- `firebase`: the only current implementation and authority;
- `supabase`: a reserved future identity with no application adapter or client in the first slice.

Any other value is invalid. `demo`, `emulator`, `local`, `auto`, and `default` are not provider identities.

The manifest is a build/config-revision artifact with one schema version, one explicit entry for every provider-managed feature in the build, exactly one `authority` per entry, an immutable resolved representation, and a non-secret revision identifier suitable for operations correlation.

The first implementation manifest is checked in and explicitly assigns `firebase` to every listed feature. Firebase is the current/default Production selection because the complete manifest says `firebase`, not because a resolver silently substitutes it for absent or invalid configuration.

The closed first-manifest feature vocabulary uses these machine identifiers. Every entry is explicit and currently resolves to `firebase`:

| Machine feature ID | Current provider | Included current capability/state | Explicitly excluded capability/state | Aggregate and cutover boundary |
|---|---|---|---|---|
| `auth_identity` | `firebase` | Firebase Auth session, login/logout, registration credential, email verification, recovery, and email-action handling | Firestore user profile, roles, access grants, and Supplier ownership | The complete Firebase Auth identity/session authority moves only under a separately approved identity bridge/cutover; no page-level Auth call may move independently. |
| `user_profiles_access` | `firebase` | Firestore user profiles, activation, roles/status, access credits/grants, and administrative user actions | Firebase Auth credential/session and Supplier ownership authority | Profile, role, access, and their command-side audit/domain-event effects move together; Auth remains `auth_identity`. |
| `supplier_directory` | `firebase` | Approved Supplier records, public/profile reads, approved-profile maintenance, duplicate identity state, and directory candidate queries | Taxonomy/dictionary, reviews, feedback, favorites, submissions, Claims, private catalog, and AI intent parsing | One Supplier-profile record and its directory read/write/search authority move together; indexed search is not a second writer. |
| `supplier_taxonomy_dictionary` | `firebase` | Categories/taxonomy, material terms, captured term suggestions, suggestion moderation, and registration sectors | Supplier records, AI intent parsing, reviews, and managed operational settings | Dictionary terms, suggestions, moderation state, and their command effects are one cutover unit; consumers may read the selected authority only. |
| `supplier_reviews` | `firebase` | Supplier review submission, self/admin lists, moderation, and rating/review-count/points effects | Supplier feedback/support reports and general operational reporting | Review moderation currently mutates Supplier and user counters. This ID cannot cut over independently of `supplier_directory` and `user_profiles_access` until an approved contract either moves all affected records together or replaces those counters with a single-authority projection. |
| `supplier_feedback` | `firebase` | Supplier feedback/support report submission, self/admin lists, and status handling | Reviews and platform analytics | Each feedback record and its moderation/status/audit effects move together. |
| `supplier_favorites` | `firebase` | Buyer favorite list plus save/remove state | Supplier directory record and recommendation/search state | A user's favorite records have one read/write authority and may move independently of the Supplier directory only through an approved mapping/cutover. |
| `supplier_submissions` | `firebase` | Manual submission/resubmission, Excel-import batches/rows, duplicate indexes, review decisions, contribution records, and submission notifications/events/audit effects | Approved Supplier directory after the approved handoff and Supplier ownership Claims | The submission aggregate, import/idempotency/duplicate state, decision effects, and originating event family move together. |
| `supplier_ownership_claims` | `firebase` | Claim reads/search-for-claim, submit/withdraw/review/decide/expire callables, ownership establishment, deterministic idempotency/events/audit, and Claim-event notification materialization | General Supplier directory administration and RFQ event families | The complete Claim/Supplier-ownership aggregate and its originating event family move together. Claim notification materialization moves with this ID, not with a global notification producer. |
| `rfq_quotations` | `firebase` | RFQs, recipient anchoring, publish/close/cancel state, quotations, revisions, lifecycle events, and RFQ/quotation notification materialization | Conversations/messages and Claim notification events | Each RFQ with responses, revisions, idempotency/events/audit, and its notification event family is one cutover unit. |
| `notification_inbox` | `firebase` | Notification delivery snapshot query/subscription, recipient visibility, pagination, and mark-one/mark-all read state | Eligibility/business-event production, originating materializer registry ownership, domain history, audit evidence, and external channels | This ID owns only the inbox/delivery projection and `read_at`-equivalent state. A later projection cutover must choose one read/write authority without racing or merging providers at request time. |
| `conversations_messages` | `firebase` | Conversation membership/metadata and message send/list state | RFQ/quotation aggregate and notification production | A conversation and its messages move together; any future notification event belongs to this originating event family. |
| `supplier_private_catalog` | `firebase` | Supplier-private products and document metadata | File bytes/upload/delete and public Supplier directory records | Products and document metadata move with their owner authorization. File object capability remains unsupported and cannot be implied by metadata authority. |
| `managed_content_config` | `firebase` | Content pages, branding, platform settings, and daily operational settings | Security roles/grants, taxonomy/dictionary, provider manifest, and environment configuration | Each managed record uses one authority; the group may be split only by a new manifest version with explicit record-family boundaries. |
| `operational_reporting` | `firebase` | Firestore-derived portal metrics, admin aggregate report state, and CSV-ready aggregate result | An analytics event stream, tracking, telemetry authority, and source-record mutation | Reporting reads the selected source authorities under a separately approved consistency contract; switching it cannot switch or write its source aggregates. |
| `audit_evidence` | `firebase` | Administrative audit-log read/browse projection and its retention/access surface | Command-side audit creation and domain-event creation | Audit/domain-event production follows the originating aggregate feature and changes in the same authoritative command. This ID can later move only the cross-aggregate audit read projection; it never becomes a second audit writer. |
| `supplier_search_ai_intent` | `firebase` | Optional Firebase AI/Gemini interpretation of a bounded query plus supplied taxonomy into a partial search intent | Supplier records, directory reads/search/ranking, taxonomy authority, term-suggestion writes, and the local parser/recommender | The Firebase AI request/response interpretation boundary is independent. Changing `supplier_directory` or taxonomy providers does not change this ID, and changing this ID does not move directory data. |

The table is intentionally more precise than the earlier broad Supplier and notification entries: each machine ID is unique, stable, and usable as an exact manifest key. Splitting, merging, or adding an ID is a manifest schema/version change requiring the affected aggregate contract; it is never inferred at runtime. Current cross-feature commands remain explicit blockers: for example, review moderation touches review, Supplier, and user records, and `seedDefaultLists` touches taxonomy plus platform settings. A later cutover must either move every affected machine ID together or first approve a single-authority command/projection split; it may not dual-write across providers.

`supplier_search_ai_intent` is currently Firebase-authoritative even when `VITE_FIREBASE_AI_ENABLED` disables execution. That flag enables an optional capability; it is not a provider selector. The current directory always builds a local intent first. When AI is disabled, returns no intent, or fails, the existing local interpretation/recommendation path remains in effect. That is current non-AI/fail-safe product behavior, not a lookup of or fallback to another backend provider.

File upload/object storage and analytics-stream collection are explicitly absent from the manifest: the repository bundles no upload implementation, uploads fail closed, and no analytics stream is configured. Email/push/SMS/WhatsApp notification delivery is also unsupported. A manifest cannot enable any of these capabilities merely by naming a provider.

The first slice adds no environment-variable override. A future external manifest/override must be complete and validated before bootstrap. Missing features/providers, duplicate or conflicting entries, invalid versions, unknown providers, and unsupported providers fail closed.

Auth is recorded as Firebase-authoritative but remains outside the first adapter slice. Unless a row explicitly defines a read-only projection, one feature entry owns its complete read/write aggregate plus command-side idempotency, audit, domain-event, and notification-materialization effects. Any future split requires an aggregate-specific approved cutover contract and still preserves one authoritative writer per record and event family.

### 4.1 Notification authority follows the originating event family

The merged MSG-003 authority remains exact: an authoritative domain command commits its aggregate, idempotency result, audit outcome, and immutable domain event; exactly one trusted materializer for that event family creates the immutable safe bilingual `in_app` snapshot. The command does not also insert the notification after the outbox path is authoritative, and Firebase is never a fallback.

There is no global `notifications` producer feature. Producer eligibility, recipient derivation, template registry entry, deduplication, and materialization move with the originating aggregate/event-family ID. `notification_inbox` is deliberately narrower: it covers delivery projection reads, recipient visibility, pagination, and read state only, consistent with MSG-003's separation of the notification projection from domain events, audit, and domain history. The exported legacy `createNotification` helper has no proved business-event call site or deterministic event-family contract; it remains Firebase-bound evidence and cannot be registered under `notification_inbox` or treated as a global producer.

Consequently, `supplier_ownership_claims` may later migrate with its Claim approved/rejected/superseded events and exactly-one Claim materializer while `rfq_quotations` and its current event family remain Firebase-authoritative. That is a partition by disjoint event family, not split writers for one event. A future cutover must also specify how each materialized snapshot reaches the single selected inbox projection without dual-writing, request-time provider aggregation, read repair, or provider fallback; C1 and C4 do not implement or silently solve that projection bridge.

## 5. Explicit selection and provider registry

The resolver receives a validated manifest, feature identifier, and injected adapter registry. It performs only exact lookup:

1. require one known manifest version;
2. require exactly one entry for the feature;
3. require one recognized provider identity;
4. require one registered implementation for that provider and feature; and
5. return it without probing, retrying, racing, or consulting another provider.

C4 adds the registry contract but no executable application adapter; its tests inject registered implementation references only. Later application registries may contain Firebase references until a separately approved Supabase feature adapter exists. An unregistered `supabase` implementation reference returns `provider_implementation_unsupported` before any data/Auth or adapter operation, without dynamic import or Firebase fallback. The C4 resolver never invokes the returned implementation.

Selection remains stable for an operation. Request inputs, record presence, exceptions, authorization denials, network state, latency, and provider health cannot change it.

## 6. Firebase parity and future Supabase slot

Any later Firebase feature adapter must delegate to or extract current behavior without changing arguments, results, ordering, limits, caching, subscriptions, loading/empty/error behavior, Auth/session/verification/recovery, Firestore transaction and deterministic-ID invariants, callable region/names/idempotency, Demo/Emulator eligibility, or disabled Storage behavior.

The existing service export remains the stable facade and calls exactly one Firebase adapter. Focused parity tests cover existing success and failure behavior before removing inline code. Two executable copies of the same implementation are not retained.

The `supabase` identity and registry shape create only a future slot. C4 includes no Supabase SDK, client, environment value, network request, Auth bridge, SQL/RPC, RLS/grant, or hosted access. A later adapter is feature-specific and may be registered only after that complete aggregate and its authority, authorization, idempotency, telemetry, migration, and rollback contract are approved. Implementing an adapter never selects it by itself.

## 7. Fail-closed and no-fallback contract

| Condition | Required result |
|---|---|
| Provider manifest/configuration absent | `provider_config_missing`; invoke no implementation. |
| Manifest malformed, wrong-version, duplicated, conflicting, or otherwise structurally invalid | `provider_config_invalid`; invoke no implementation. |
| Requested feature absent from the complete manifest or outside the closed machine vocabulary | `provider_feature_unknown`; invoke no implementation. |
| Manifest contains an unrecognized/invalid provider identity | `provider_identity_invalid`; invoke no implementation. |
| Recognized provider has no registered implementation reference for the feature | `provider_implementation_unsupported`; invoke no implementation. |

There is no catch-all Firebase return, adapter-chain iteration, provider race, error-triggered cross-provider retry, read repair, or application dual-write.

## 8. Error normalization

C4 defines exactly five resolver/configuration error IDs: `provider_config_missing`, `provider_config_invalid`, `provider_feature_unknown`, `provider_identity_invalid`, and `provider_implementation_unsupported`. A safe resolver error may include only the stable code, safely validated feature/provider identifiers when available, and a user-safe message key. It carries no SDK error, operation result, or retry decision because the resolver executes no adapter operation.

Unavailable, unauthenticated, forbidden, not-found, conflict, validation, unknown SDK/domain failure, ambiguous command outcome, and retryability are runtime or domain outcomes. C4 defines none of their normalized IDs or behavior. They remain with the current Firebase service behavior until a later feature adapter can prove parity and receive an aggregate-specific contract. Such later execution errors still cannot trigger provider probing, fallback, dual-write, read repair, or cross-provider retry.

Raw SDK errors, tokens, configuration, payloads, personal data, document bodies, SQL, and stack traces do not cross a future UI or telemetry boundary. An original cause may remain in a non-serialized internal field.

## 9. Authority ownership, telemetry, and tests

- Each manifest feature has one provider for the boundary in the machine vocabulary.
- Firebase Auth remains authoritative throughout the approved hybrid phase.
- Selection grants no role, access, ownership, membership, or verification.
- Parent/child/revision/idempotency plus command-side audit, domain-event, and notification-materialization effects follow their originating aggregate/event family; the explicitly read-only inbox and audit projections do not become producer authority.
- Any separately approved shadow comparison is TEST/read-only/response-inert and is neither fallback nor authority.

Allowed C4 telemetry fields are manifest version, non-secret build/config revision, feature, selected provider when validated, one of the five resolver error IDs, outcome class, and bounded resolver duration. Operation and retryable fields belong only to a later approved executing adapter contract. Exclude configuration values, credentials, tokens, emails, UIDs, profile/document identifiers, payloads, free-form SDK errors, and Production records. Logging failure cannot change selection.

Resolvers/errors are pure and accept injected manifests/registries. C4 tests prove machine feature IDs are unique and the complete immutable shipped manifest maps every ID to Firebase; each valid lookup returns exactly the registered implementation reference; each of the five resolver error IDs is deterministic; an unregistered Supabase reference is unsupported; Demo/Emulator cannot appear as providers; and the resolver never invokes any returned or alternate implementation. No mock adapter failure, adapter execution, network, Emulator, database, Auth, or hosted resource is needed.

## 10. Rollback

C4 rollback is one code revert: remove the provider kernel/manifest and focused tests. Current Firebase services remain direct and unchanged, so no reconciliation, provider switch, Firebase action, or deployment rollback is required.

For a later feature cutover, rollback before Production authority change is an exact Firebase code/config revert. After any future write cutover, a manifest flip alone is forbidden; rollback needs the approved freeze/checkpoint/reverse-delta or reconciliation plan and proof that Firebase can again be authoritative without losing incompatible writes.

## 11. Selected first implementation slice

The unique first slice is **provider-contract kernel and explicit Firebase-only manifest**, with no service or Auth rewiring:

1. add the closed provider IDs, exact machine feature IDs above, immutable manifest type, five-code resolver-error type, and injected implementation-reference registry contract under a focused `src/services/providers/` boundary;
2. add one checked-in complete current manifest whose every authority is `firebase`;
3. add a pure exact-match resolver that validates and returns exactly one registered implementation reference, never invokes it, and has no fallback, probing, dynamic Supabase import, or environment override; and
4. add deterministic Node tests for manifest completeness/ID uniqueness/immutability, the five exact errors, exact-reference return, zero implementation invocation, and no fallback.

C4 must not change `AuthContext.tsx`, page Auth calls, current service exports/implementations, Firebase initialization, `.env.example`, dependencies, Firebase/Supabase configuration, or application behavior.

This slice is uniquely smaller than a service adapter: it establishes common manifest, registry, error, and no-fallback invariants needed by both the later Auth proof of concept and progressive feature adapters while touching no Firebase execution path. `adminUsers.ts` and `supplierWorkspace.ts` are small but authorization/data-specific and mix Firebase with Demo behavior; dashboard, directory/workspace, Claim, registration, and Auth seams are broader or security-sensitive; Storage is disabled and gated. Choosing one first would add a feature decision and parity risk before the common selection contract exists.

## 12. C4 acceptance and stop point

C4 may begin only after C1 receives independent architecture review and is manually merged. Queue text alone is not authorization.

C4 acceptance requires a diff limited to the kernel/current manifest/focused tests and strictly necessary type export; no current behavior/import/call-site change; no Supabase capability; focused tests, current runtime-policy tests, TypeScript check, and Production build passing; static no-fallback/prohibited-scope/sensitive-value checks; and exact-head independent review.

If the kernel cannot remain separate from current services, requires runtime/environment change, or leaves multiple materially safe contracts, stop at `HUMAN_DECISION_REQUIRED` rather than expanding C4.

- Production impact: **NONE**.
- Data impact: **NONE**.
- Deployment scope: **NONE**.
- Firebase: repository inspection only.
- Supabase: no hosted access, link, client, Auth, SQL, RLS, grant, or deployment.

Exact stop state: `AWAITING_INDEPENDENT_REVIEW`. Do not implement C4, mark the Draft PR Ready, merge, deploy, or change provider authority.
