# Mujahiz IQ

Mujahiz IQ is a private, invitation-based procurement intelligence platform for Iraq. The MVP uses React, Vite, TypeScript, Tailwind CSS, Firebase Authentication, Firestore, and Firebase Hosting.

## What Is Included

- Email/password registration and login.
- Pending user approval flow.
- Role-aware routes for owner/admin/contributor/viewer/suspended users.
- Contribution-based access model: every 10 approved new supplier records grants 30 days of access.
- Fast multi-step supplier submission wizard.
- Duplicate warnings using normalized names, phones, email, website, and Facebook links.
- Admin supplier review workflow: approve, reject, request correction, mark duplicate, merge, archive.
- Approved supplier directory with search and filters.
- Supplier profile page with ratings and moderated reviews.
- Points, badges, contribution quality ratio, access credits, and audit logs.
- Arabic/English UI with RTL/LTR switching.
- Firestore security rules and indexes.
- Firebase Hosting configuration.

No file uploads, paid gateways, AI API calls, Cloud Functions, or public supplier access are included in this MVP.

## Local Setup

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` and fill it with your Firebase web app config:

```bash
cp .env.example .env
```

Required Firebase services:

- Authentication: enable Email/Password.
- Firestore Database: create in production mode, then deploy rules/indexes.
- Hosting: deploy the Vite `dist` folder.

## Firebase Setup

```bash
firebase login
firebase projects:create mujahiz-iq
firebase use --add
firebase apps:create WEB "Mujahiz IQ Web"
firebase apps:sdkconfig WEB
firebase deploy --only firestore:rules,firestore:indexes
```

Copy the SDK config into `.env`, then build and deploy:

```bash
npm run build
firebase deploy --only hosting
```

## Internal Emulator Accounts

Run the focused internal account suite with:

```bash
npm run test:internal-emulator-accounts
```

The command starts isolated Auth and Firestore Emulators under the fixed
`demo-mujahiziq-integration` project, resets Emulator state, and creates four
Buyer plus four Supplier identities from
`tests/helpers/internal-emulator-accounts.mjs`. It requires no Production
credentials, Firebase Console access, inboxes, or manual verification.

To seed the same accounts into Emulators that are already running, use:

```bash
npm run seed:internal-emulator-accounts
```

The seed command fails closed unless both `FIREBASE_AUTH_EMULATOR_HOST` and
`FIRESTORE_EMULATOR_HOST` point to loopback hosts. It never falls back to a
Demo or Production service.

## Local Supabase SQL validation

Run the migration and pgTAP suite from the repository root with:

~~~powershell
npm run test:supabase:sql
~~~

The command requires Node.js/npm plus Docker Desktop (or a compatible Docker runtime). It starts
a pinned, disposable PostgreSQL container with no published host ports, applies
every tracked supabase/migrations/*.sql file in filename order, then runs every
tracked supabase/tests/*.sql file. It prints only a concise pass summary and
always removes its generated container. No hosted Supabase, Firebase, or
Production service is contacted.

Each test runs in a clean disposable database replayed through its matching
migration stage. The runner explicitly documents the existing naming alias
`identity_provider_foundation.sql` -> `provider_neutral_identity_foundation.sql`;
that alias is required by the current repository filenames and is not a hidden
test bypass.

To confirm that assertion failures are detected without editing a committed SQL
file, run the script with -VerifyFailureDetection; it intentionally exits 1
after a synthetic failed pgTAP assertion and still cleans up the container:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/validate-local-supabase-sql.ps1 -VerifyFailureDetection
~~~
## First Owner Bootstrap

1. Register the first user from the app.
2. In Firebase Console, open Firestore `users/{uid}`.
3. Set:
   - `role`: `owner`
   - `status`: `approved`
   - `accessStatus`: `active`
   - `accessExpiresAt`: a future timestamp
4. Sign out and sign in again.
5. Open Admin > Settings and seed default lists.

This avoids storing admin secrets in frontend code.

## Data Model

Primary collections:

- `users`
- `suppliers`
- `supplierSubmissions`
- `supplierDuplicateIndex`
- `reviews`
- `accessCredits`
- `contributionLogs`
- `categories`
- `settings`
- `auditLogs`

## Deployment Commands

```bash
npm install
npm run build
firebase deploy
```

## Notes

- Duplicate detection is intentionally advisory. It warns the contributor and helps the admin decide; it does not automatically block all submissions.
- Pending users can submit suppliers, but only approved users with active access can search the supplier directory.
- Reviews from contributors are always `pending_review` until an owner/admin approves them.
- The app is prepared for future Firebase Storage, AI matching, import/export, paid subscriptions, and advanced RFQ tooling without including those features in the MVP.
