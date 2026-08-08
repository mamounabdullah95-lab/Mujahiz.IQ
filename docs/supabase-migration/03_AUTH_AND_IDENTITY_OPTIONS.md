# Authentication and identity options

## ID-001 contract status

[`33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md`](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md) is the Owner-approved hybrid-phase authority, provider-neutral principal/link, verification-mirror, privileged-actor, lifecycle, reconciliation, and Claim dependency contract. Firebase Auth remains the sole hybrid authentication/email-verification authority; `public.user_profiles` plus `internal.identity_provider_links` are the approved identity foundation; and ID-001 is Resolved. The contract authorizes no integration or hosted work.

[`34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md`](34_PLATFORM_ROLE_ASSIGNMENTS_PRODUCT_SECURITY_DATA_CONTRACT.md) is the Owner-approved complete successor contract for exactly `owner|admin`, temporal assignments, protected initial-Owner bootstrap, fail-closed identity use, and the Claim reviewer boundary. It selects the empty fully revoked role table as the next local SQL slice; separate SQL/runtime tasks remain required.

## Current identity contract

- **[Verified current fact]** Firebase Auth is the password, session, email-verification, password-reset, and email-action authority. Sources: `src/contexts/AuthContext.tsx`, `src/services/emailVerification.ts`, `src/services/passwordRecovery.ts`, and `src/services/emailActions.ts`.
- **[Verified current fact]** Firestore `users/{uid}` is the application profile and current role/account/access authority. `role` and `accountType` are distinct.
- **[Verified current fact]** Supplier identity is two-sided: `users.supplierProfileId` must match `suppliers.accountOwnerId`; sensitive Supplier/RFQ access also checks current approval/access and `canReceiveRfqs` where applicable.
- **[Verified current fact]** Current application roles are owner, admin, contributor/viewer/suspended, with buyer/supplier account type. Public registration cannot create Owner/Admin privilege.
- **[Verified current fact]** Repository code does not currently assign Firebase custom claim `role: authenticated`; application roles live in Firestore, not Firebase custom claims.
- **[Future plan]** Preserve Firebase UID as a durable identity key even if a later Supabase Auth identity is added.

Official platform references: [Supabase Firebase third-party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [third-party Auth overview](https://supabase.com/docs/guides/auth/third-party/overview), and [Firebase-to-Supabase Auth migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth).

## Option A — retain Firebase Auth and use it with Supabase

### Proposed flow

1. **[Future plan]** Keep existing Firebase sign-up, sign-in, verification, recovery, and session UI unchanged.
2. **[Future plan]** Configure a reviewed Supabase third-party Auth integration for the correct Firebase project.
3. **[Future plan]** Assign Firebase JWT `role: authenticated` for Supabase Postgres role selection; never put application Owner/Admin/Buyer/Supplier into that claim.
4. **[Future plan]** Pass the current Firebase ID token through the future Supabase client's access-token callback.
5. **[Future plan]** Resolve `auth.jwt()->>'sub'` through the exact active Firebase subject in `internal.identity_provider_links` to `public.user_profiles.id`; do not assume the subject is a UUID or use the link as a domain FK.
6. **[Future plan]** Resolve application role, status, entitlement, `supplierProfileId`, and ownership from PostgreSQL current state inside RLS/trusted functions.

### Advantages

- **[Future plan]** Avoids an immediate credential/session migration and retains proven verification, reset, recovery, action-code, and localization behavior.
- **[Future plan]** Allows PostgreSQL/RLS migration to be tested independently from password migration.
- **[Future plan]** Preserves Firebase UID directly, reducing risk to Supplier ownership, RFQ authorship, quotation history, notifications, and audit actors.
- **[Future plan]** Supports one UI and one identity session while individual data features move.

### Risks and implications

| Topic | Option A implication |
|---|---|
| RLS | **[Future plan]** Policies validate registered issuer/audience, require Postgres role `authenticated`, then use a protected resolver from Firebase subject through `identity_provider_links` to `user_profiles`. Missing, stale, duplicate, or mismatched evidence fails closed. |
| Custom claims | **[Future plan]** Existing and future users need `role: authenticated`. A trusted backfill plus on-create/sign-in mechanism is a Firebase Auth/Functions write/deploy and needs a separate approved task. Token refresh is required before the claim appears. |
| Application roles | **[Future plan]** Never trust the JWT `role` as application privilege. Store Owner/Admin/Buyer/Supplier in relational application data and audit changes. |
| Sessions | **[Future plan]** Firebase token refresh/expiry remains authoritative. Supabase request failures must distinguish token expiry from RLS denial/provider outage. |
| Passwords | **[Verified current fact]** No password is copied. Firebase remains the credential verifier. |
| Email verification | **[Future plan]** Firebase `email_verified` remains authoritative; relational mirror is synchronized idempotently and cannot grant unrelated access by itself. |
| Recovery/action links | **[Future plan]** Keep current Firebase reset and `/auth/action` behavior. Do not configure Supabase recovery for Firebase identities. |
| Owner/Admin | **[Future plan]** Privilege is read from current application state, not self-asserted token metadata. Role change must invalidate/cache-bust authorization promptly. |
| Buyer | **[Future plan]** Buyer trial/access/entitlement checks move to relational grants/RLS without changing Firebase sign-in. |
| Supplier | **[Future plan]** RLS requires current two-sided ownership mapping and approved Supplier state. No email-based ownership inference. |
| `supplierProfileId` | **[Future plan]** Migrate to `supplier_ownerships`; preserve legacy link on user/Supplier mapping until parity is proven. |
| Platform limits/cost | **[Future plan]** Third-party MAU quota/cost and token-verification behavior must be checked against the verified Supabase plan before Production. |

### Option A proof-of-concept acceptance gate

- **[Future plan]** Use an isolated TEST Supabase project/schema and Firebase Emulator or controlled TEST users; never start with Production data.
- **[Future plan]** Prove valid Firebase token access, expired token rejection, wrong-project issuer/audience rejection, missing `role: authenticated` rejection, unknown Firebase UID rejection, suspended user denial, and role-change behavior.
- **[Future plan]** Prove RLS for self, unrelated user, Buyer, linked Supplier, unlinked Supplier, Admin, and Owner.
- **[Future plan]** Prove Firebase email verification remains authoritative and token refresh exposes the required claim without changing application privilege.
- **[Future plan]** Stop after evidence; do not enable a Production feature in the proof-of-concept PR.

## Option B — migrate users to Supabase Auth later

### Proposed flow

1. **[Future plan]** Complete schema/RLS/provider and feature rehearsals while Firebase Auth remains authoritative.
2. **[Future plan]** Export only the minimum approved Firebase Auth fields and password-hash parameters through a protected migration process.
3. **[Future plan]** Import identities into Supabase Auth using an officially reviewed path, or use a first-login bridge/password-reset strategy if direct hash migration is not proven safe.
4. **[Future plan]** Create an audited identity link from Firebase UID to Supabase user ID; never merge by email alone.
5. **[Future plan]** Rebuild verification, recovery, session, role, ownership, and action-link behavior and pass TEST/UAT before cutover.
6. **[Future plan]** Cut over identity in a separate maintenance window with explicit rollback and Firebase Auth retention.

### Advantages

- **[Future plan]** One native Supabase identity/session can simplify long-term RLS, Realtime, Storage, and Edge Function integration.
- **[Future plan]** Removes the long-term Firebase custom-claim bridge after all Firebase-dependent features are retired.
- **[Future plan]** Can consolidate identity administration and observability if it preserves current security behavior.

### Risks and implications

| Topic | Option B implication |
|---|---|
| RLS | **[Future plan]** Native Supabase `sub` becomes the identity key, but every imported user must remain linked to legacy Firebase UID for historical rows and rollback. |
| Custom claims | **[Future plan]** Supabase role/app metadata must not become a self-editable privilege source. Application roles stay in protected tables. |
| Sessions | **[Future plan]** Existing Firebase sessions cannot be assumed valid in Supabase. Plan forced reauthentication, overlapping session rules, revocation, and rollback. |
| Password migration | **[Future plan]** Firebase uses SCRYPT parameters. Password continuity is acceptable only after an isolated official-tool rehearsal proves hashes and users import correctly. Otherwise use a secure reset or first-login bridge; never handle plaintext passwords or store migration credentials in Git/docs. |
| Email verification | **[Future plan]** Preserve verified/unverified state only through a trusted import with evidence. Verify that imported state cannot bypass current approval/trial rules. |
| Password recovery | **[Future plan]** Rebuild enumeration-safe requests, localized invalid/expired/used states, redirect allowlisting, eight-character policy or approved replacement, and support escalation. |
| Email action handler | **[Future plan]** Replace or route Firebase action links only after Hosting/redirect/template behavior is proven. The existing external Firebase template blocker must not be mistaken for an application fix. |
| Owner/Admin | **[Future plan]** Migrate without privilege broadening; require at least two recoverable administrative paths before cutover. |
| Buyer | **[Future plan]** Preserve trial/access history and prevent new-trial duplication on first Supabase sign-in. |
| Supplier | **[Future plan]** Preserve `supplierProfileId`, ownership, approval, `canReceiveRfqs`, quotation authorship, and message/RFQ access. |
| Account matching | **[Future plan]** Email is mutable and may differ in case/verification; use a trusted legacy UID manifest and explicit conflict queue. |
| Rollback | **[Future plan]** Retain Firebase Auth and mapping until the observation window closes. Do not delete, disable, or mass-update Firebase users during cutover. |

### Password and sensitive-export protections

- **[Future plan]** Firebase hash parameters, exported hashes, service credentials, database credentials, and user export files are secrets/protected data; they do not belong in repository files, normal logs, PR bodies, chat, or permanent `C:\tmp` storage.
- **[Future plan]** Use an encrypted, access-controlled, time-bounded migration workspace with a manifest and deletion approval.
- **[Future plan]** Record counts and hashes, not account emails/UIDs, in routine migration reports.
- **[Future plan]** If direct hash import cannot be independently validated, choose an explicit password reset or first-login verification design and communicate the session impact.

## Required TEST accounts and UAT matrix

| Identity/state | Required proof |
|---|---|
| New unverified Buyer | **[Future plan]** Registration, no premature trial, verification, exactly one trial grant, login/logout, recovery. |
| Verified active Buyer | **[Future plan]** Directory access, own RFQs, unrelated Buyer denial, entitlement expiry. |
| Pending/expired/suspended Buyer | **[Future plan]** Denial remains fail closed with no role/access escalation. |
| New unverified Supplier | **[Future plan]** Verification without Buyer trial; no unowned profile access. |
| Verified unlinked Supplier | **[Future plan]** Claim eligibility only when feature enabled; no Supplier workspace/RFQ access. |
| Linked approved RFQ-ready Supplier | **[Future plan]** Exact profile ownership, Supplier workspace, target RFQs, quotations/revisions/history, private conversations. |
| Suspended or ownership-mismatched Supplier | **[Future plan]** Immediate denial despite a valid identity token/session. |
| Admin | **[Future plan]** Review/admin reads and trusted commands; no Owner-only operation. |
| Owner | **[Future plan]** Owner operations plus final-usable-owner protection and recovery path. |
| Wrong-project/forged/expired token | **[Future plan]** Rejected before data access; no anonymous downgrade into protected APIs. |
| Duplicate/conflicting identity | **[Future plan]** Quarantined for manual review; never auto-merged by email. |

- **[Verified current fact]** Deterministic internal Auth/Firestore Emulator fixtures already cover four Buyer states and four Supplier states. Source: `tests/helpers/internal-emulator-accounts.mjs` and PR #30.
- **[Future plan]** Extend those fixtures for provider/RLS contract tests; use separate controlled TEST accounts for browser UAT. Production accounts are not migration test fixtures.

## Comparison and recommendation

| Dimension | Option A | Option B |
|---|---|---|
| Initial migration risk | **[Future plan]** Lower: identity behavior remains on Firebase | **[Future plan]** Higher: credentials, sessions, verification, recovery, and action links change together |
| PostgreSQL/RLS feasibility | **[Future plan]** Supported after third-party integration/custom-claim proof | **[Future plan]** Native after completed user migration |
| UID continuity | **[Future plan]** Direct Firebase UID mapping | **[Future plan]** Requires durable Firebase-to-Supabase identity link |
| User disruption | **[Future plan]** Minimal if token claim rollout succeeds | **[Future plan]** Possible reauthentication/reset and support load |
| Rollback | **[Future plan]** Data-feature rollback can leave Auth unchanged | **[Future plan]** Identity rollback is a separate high-risk operation |

- **[Future plan]** Recommended initial decision: pursue **Option A as a TEST proof of concept**, not as immediate Production enablement.
- **[Future plan]** Recommended Option B decision point: only after PostgreSQL schema/RLS, provider abstraction, at least one low-risk data-feature rehearsal, identity conflict inventory, password migration rehearsal, full TEST/UAT matrix, support plan, and rollback evidence are complete.
- **[Future plan]** Do not choose Option B merely because Supabase Auth is available.
