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
