# Backend provider abstraction readiness

Status: **C1 readiness contract; documentation only; `AWAITING_INDEPENDENT_REVIEW`; no provider implementation or application refactor authorized**

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

The closed first-manifest feature vocabulary and current authority are:

| Feature authority entry | Current provider |
|---|---|
| identity, session, verification, recovery, and email actions | `firebase` |
| application profiles, roles, access, and administration | `firebase` |
| Supplier directory, taxonomy, reviews, feedback, and material terms | `firebase` |
| Supplier submissions and import | `firebase` |
| Supplier ownership and Claims | `firebase` |
| RFQs, quotations, revisions, and their events | `firebase` |
| notifications | `firebase` |
| conversations and messages | `firebase` |
| Supplier-private products and document metadata | `firebase` |
| managed content, branding, and operations settings | `firebase` |

Storage upload is absent from the provider-managed feature list because no adapter is bundled and uploads are disabled. The capability remains fail closed. Splitting or adding an entry is a manifest schema/version change requiring the relevant aggregate contract; it is not a runtime inference.

The first slice adds no environment-variable override. A future external manifest/override must be complete and validated before bootstrap. Missing features/providers, duplicate or conflicting entries, invalid versions, unknown providers, and unsupported providers fail closed.

Auth is recorded as Firebase-authoritative but remains outside the first adapter slice. Read/write authority is not independently switchable in this first contract: one feature entry owns both. Any future split requires an aggregate-specific approved cutover contract and still preserves one authoritative writer.

## 5. Explicit selection and provider registry

The resolver receives a validated manifest, feature identifier, and injected adapter registry. It performs only exact lookup:

1. require one known manifest version;
2. require exactly one entry for the feature;
3. require one recognized provider identity;
4. require one registered implementation for that provider and feature; and
5. return it without probing, retrying, racing, or consulting another provider.

C4 adds the registry contract but no executable application adapter; its tests inject one Firebase stub. Later application registries may contain Firebase implementations only until a separately approved Supabase feature adapter exists. An unregistered `supabase` implementation returns `provider_unsupported` before a data/Auth operation, without dynamic import or Firebase fallback.

Selection remains stable for an operation. Request inputs, record presence, exceptions, authorization denials, network state, latency, and provider health cannot change it.

## 6. Firebase parity and future Supabase slot

Any later Firebase feature adapter must delegate to or extract current behavior without changing arguments, results, ordering, limits, caching, subscriptions, loading/empty/error behavior, Auth/session/verification/recovery, Firestore transaction and deterministic-ID invariants, callable region/names/idempotency, Demo/Emulator eligibility, or disabled Storage behavior.

The existing service export remains the stable facade and calls exactly one Firebase adapter. Focused parity tests cover existing success and failure behavior before removing inline code. Two executable copies of the same implementation are not retained.

The `supabase` identity and registry shape create only a future slot. C4 includes no Supabase SDK, client, environment value, network request, Auth bridge, SQL/RPC, RLS/grant, or hosted access. A later adapter is feature-specific and may be registered only after that complete aggregate and its authority, authorization, idempotency, telemetry, migration, and rollback contract are approved. Implementing an adapter never selects it by itself.

## 7. Fail-closed and no-fallback contract

| Condition | Required result |
|---|---|
| Manifest missing, malformed, wrong-version, incomplete, duplicated, or conflicting | Deny bootstrap/resolution with a safe configuration error. |
| Provider identity unknown | `provider_config_invalid`; call no adapter. |
| Recognized provider lacks the feature implementation | `provider_unsupported`; call no adapter. |
| Firebase configuration missing/malformed | Preserve current `configuration_error`; never select Demo or Supabase. |
| Selected provider unavailable | Return its normalized unavailable error; never call another provider. |
| Authentication/authorization denial | Return the denial; never downgrade to anonymous, service-role, Demo, another route, or another provider. |
| Not-found or empty result | Preserve it; record absence is never provider-discovery evidence. |
| Ambiguous command outcome | Reconcile/retry only against the same provider under the feature idempotency contract. |
| Storage implementation absent | Preserve explicit disabled/unavailable behavior. |

There is no catch-all Firebase return, adapter-chain iteration, provider race, error-triggered cross-provider retry, read repair, or application dual-write.

## 8. Error normalization

Provider boundaries use a safe normalized error containing a stable code, closed feature/operation identifiers, the selected provider when selection succeeded, a same-provider `retryable` flag only when the feature contract permits it, and a user-safe message key.

The stable codes are `provider_config_missing`, `provider_config_invalid`, `provider_unsupported`, `provider_unavailable`, `provider_unauthenticated`, `provider_forbidden`, `provider_not_found`, `provider_conflict`, `provider_validation_failed`, and `provider_unknown`.

Raw SDK errors, tokens, configuration, payloads, personal data, document bodies, SQL, and stack traces do not cross the UI or telemetry boundary. An original cause may remain in a non-serialized internal field. Security denials are not normalized as availability, and `unknown` is not retryable by default.

C4 defines only resolver errors. It does not rewrite existing Firebase service error presentation; service-specific normalization belongs to the later adapter that can prove exact parity.

## 9. Authority ownership, telemetry, and tests

- Each manifest feature has one provider for its complete read/write aggregate.
- Firebase Auth remains authoritative throughout the approved hybrid phase.
- Selection grants no role, access, ownership, membership, or verification.
- Coupled parent/child/event/revision/notification/idempotency/audit records move together.
- Any separately approved shadow comparison is TEST/read-only/response-inert and is neither fallback nor authority.

Allowed telemetry fields are manifest version, non-secret build/config revision, feature, operation, selected provider, normalized error code, retryable flag, outcome class, and bounded duration. Exclude configuration values, credentials, tokens, emails, UIDs, profile/document identifiers, payloads, free-form SDK errors, and Production records. Logging failure cannot change selection.

Resolvers/errors are pure and accept injected manifests/registries. C4 tests prove the complete shipped manifest selects Firebase, the result is immutable, malformed/missing/unknown/conflicting/wrong-version configuration fails closed, unregistered Supabase is unsupported, Firebase invokes exactly one adapter, selected-adapter failure invokes no alternative, and Demo/Emulator cannot appear as providers. No network, Emulator, database, Auth, or hosted resource is needed.

## 10. Rollback

C4 rollback is one code revert: remove the provider kernel/manifest and focused tests. Current Firebase services remain direct and unchanged, so no reconciliation, provider switch, Firebase action, or deployment rollback is required.

For a later feature cutover, rollback before Production authority change is an exact Firebase code/config revert. After any future write cutover, a manifest flip alone is forbidden; rollback needs the approved freeze/checkpoint/reverse-delta or reconciliation plan and proof that Firebase can again be authoritative without losing incompatible writes.

## 11. Selected first implementation slice

The unique first slice is **provider-contract kernel and explicit Firebase-only manifest**, with no service or Auth rewiring:

1. add provider/feature identities, immutable manifest type, safe normalized resolver-error type, and injected registry contract under a focused `src/services/providers/` boundary;
2. add one checked-in complete current manifest whose every authority is `firebase`;
3. add a pure exact-match resolver with no fallback, probing, dynamic Supabase import, or environment override; and
4. add deterministic Node tests for completeness, immutability, unsupported/unknown/missing/conflicting behavior, single-adapter selection, and no fallback.

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
