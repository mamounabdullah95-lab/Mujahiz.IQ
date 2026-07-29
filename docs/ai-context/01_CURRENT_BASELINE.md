# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-07-29-post-pr34-production-email-action-ready`
Updated: 2026-07-29
Canonical Production URL: `https://mujahiz.com`

This is the only frequently changing context document. Update it after a behavior-affecting code merge, deployment, Production-data change, or infrastructure change. Keep repository `main`, merged-but-undeployed work, deployed Hosting, active Firestore Rules/indexes, Firebase Console configuration, and Production data distinct.

## 1. Current repository `main`

- Repository: `mamounabdullah95-lab/Mujahiz.IQ`.
- Approved branch: `main`.
- Current verified `main` commit: `0feed4696f5e98885ac6e567c74c2d515d8f4211`.
- PR #30 merged the deterministic Internal Auth/Firestore Emulator account foundation.
- PR #32 merged Password Reset and Account Recovery.
- PR #33 merged the unified Firebase email action handler at `/auth/action`.
- PR #34 merged the Arabic/English locale-initialization correction for malformed email action requests.

The repository SHA identifies source-control state. It must not be described as the active Production application version unless a Hosting deployment is separately verified.

### Latest verified automated-test baseline

Evidence recorded for PR #34 and the deployed Production build:

- Repository tests: **153/153 passed**.
- Firebase production-bundle tests: **3/3 passed**.
- Auth/Firestore Emulator tests: **76/76 passed**, including diagnostics.
- Production build: **passed**.
- Focused email-action/localization tests: **13/13 passed**.
- `git diff --check`: **passed**.

Do not add the focused 13 tests to 153 unless a future official report states they are distinct; they are included in the repository suite.

## 2. Current verified Production deployment state

Keep repository, Hosting, Rules, indexes, and Console configuration distinct:

- Firebase project: `mujahiziq`.
- Current Hosting release: `1785303212286000`.
- Current Hosting version: `ce0ccb0776da3601`.
- Deployed application commit: `0feed4696f5e98885ac6e567c74c2d515d8f4211`.
- Canonical Production domain: `mujahiz.com`.
- `www.mujahiz.com` is connected and redirects to the canonical domain.
- `mujahiziq.web.app` and `mujahiziq.firebaseapp.com` remain available as Firebase Hosting origins and must not be broken.
- Active Firestore Ruleset remains the last verified RFQ lifecycle/security deployment unless a newer live verification records another ID.
- All **15** required composite indexes were last verified `READY`.

The Hosting release/version above supersedes the older post-PR #28 Hosting release recorded in the previous baseline.

## 3. Firebase Authentication and email actions

### Implemented and deployed

- Forgot Password route.
- Reset Password completion route.
- Unified public `/auth/action` route.
- Supported modes: `resetPassword`, `verifyEmail`, and `recoverEmail`.
- Firebase Auth remains the source of truth.
- Strict `continueUrl` and open-redirect protection.
- Sensitive action parameters are cleaned from the visible URL after successful verification/recovery.
- No action code, API key, token, password, recovered email, or full action URL is logged or persisted.
- Arabic-only RTL and English-only LTR states are implemented and tested.

### Current Firebase Console configuration

The Firebase Authentication Custom action URL remains the original Firebase handler:

`https://mujahiziq.firebaseapp.com/__/auth/action`

The application-owned target is ready and deployed:

`https://mujahiz.com/auth/action`

A final read-only Production preflight returned `READY FOR CONSOLE CHANGE`, and the route was verified reachable. However, Firebase rejected the Console update immediately with:

- HTTP `400`
- status `INVALID_ARGUMENT`
- message `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`

This is recorded as a **known external Firebase backend/Console blocker**, not an application-code blocker. The Closed Beta may proceed using the original Firebase handler. Do not change DNS, Authorized Domains, Hosting, sender settings, templates, Auth settings, or billing solely to work around this blocker without a separately reviewed task.

## 4. Last verified Production RFQ lifecycle state

Final result: **PASS**. No known RFQ quotation-revision UAT issue remains.

Verified in controlled Production UAT:

- RFQ creation and publication.
- First Supplier quotation V1.
- Material update to V2.
- Immutable V1 after V2.
- Identical-value resubmission is a no-op and does not create V3.
- Deterministic response events and Buyer notifications without duplication.
- RFQ closure and movement to Supplier History.
- Buyer and Supplier read-only access to V1/V2 revision history after closure.
- Controlled TEST artifacts remain preserved and must not be deleted without explicit approval.

Buyer quotation decision / Award Status remains future scope. It was not implemented by the completed quotation-revision work.

## 5. Last verified Production data evidence

The final bounded RFQ UAT audit recorded:

- RFQ responses: **2**.
- RFQ response revisions: **2**.
- RFQ response events: **3**.
- Notifications: **6**.

Older last-verified global counts, not fresh current assertions:

- Suppliers: **480**.
- Supplier submissions/requests: **540**.
- Users: **4**.
- Conversations: **0**.
- Messages: **0**.

Two controlled TEST RFQs are preserved:

- `UAT-RFQ-20260720-01`
- `UAT-RFQ-REVISION-20260721-01`

The exact current global RFQ count, current audit-log count, and current Supplier fingerprints require fresh bounded read-only verification before a task that depends on them.

## 6. Supplier account and ownership state

The platform already supports a linked, approved Supplier account with:

- `supplierProfileId` on the user record.
- matching canonical ownership through `suppliers/{profileId}.accountOwnerId == uid`.
- approved profile and `canReceiveRfqs: true` requirements for sensitive RFQ access.
- role-safe Supplier profile preview, products, documents, RFQs, quotation history, and messages.

This proves the linked-account workflow can operate for a controlled approved Supplier. It does **not** mean a complete self-service Claim Supplier Profile workflow exists for all listed Suppliers.

## 7. Completed security and operational foundations

Do not reopen these areas without new evidence:

- Buyer, Supplier, Admin, and Owner role boundaries.
- Canonical Supplier ownership checks on sensitive operations.
- RFQ create/publish/close/cancel and response lifecycle boundaries.
- Conversation/message current-eligibility checks and self-only read receipts.
- Event-bound deterministic RFQ notifications.
- Feature flags fail closed in Production.
- Production does not silently fall back to Demo.
- One bounded current-user notification source; fixed polling removed.
- Role-scoped dashboard/report reads and short-lived in-flight-deduplicated caches.
- Canonical domain handling and legacy-host redirects.
- Email verification synchronization with Firebase Auth as source of truth.
- One-time Buyer Trial rules and Supplier/Admin/Owner Trial exclusion.
- Deterministic loopback-only Internal Emulator accounts and reset/reseed lifecycle.

## 8. Actual remaining pre-Closed-Beta work

Ordered priorities:

1. **Production email/password recovery UAT using the original Firebase handler**
   - Buyer and Supplier controlled TEST accounts.
   - Real email delivery, reset, re-login, and unchanged role/access/linkage verification.

2. **Claim Supplier Profile**
   - Search for an existing company.
   - Submit a claim request.
   - Admin review and approve/reject.
   - Conflict/duplicate prevention.
   - Canonical account/profile ownership link.
   - Immutable audit evidence and Supplier result notification.

3. **Buyer quotation decision / Award Status**
   - Under review, shortlisted, awarded, not selected, procurement cancelled.
   - Buyer-controlled decision, Supplier read-only result, deterministic notification, and durable decision history.
   - Must not represent a legal Purchase Order or contract.

4. **Browser-level role UAT**
   - Buyer, Supplier, Admin, and Owner critical paths.
   - Arabic, English, RTL/LTR, and common mobile widths.

5. **Focused launch-readiness gate**
   - Verify `main` versus deployed Hosting.
   - Verify GitHub Actions on the deployed commit.
   - Verify Rules/index state where relevant.
   - Verify no Critical/High blocker, safe rollback target, and no unsafe Production data operation.

6. **Closed Beta**
   - Start with approximately 5 real Buyers and 15–30 RFQ-ready Suppliers in focused categories.
   - Measure claimed profiles, RFQ-ready Suppliers, RFQs, quotations per RFQ, first-response time, response rate, decision completion, and user-blocking issues.

## 9. Explicitly deferred items

These are not required to start the first Closed Beta unless new evidence makes one a blocker:

- Changing the Firebase Custom action URL from the original handler.
- Auto-Send quotations.
- Full CPQ or advanced catalog.
- Complete subscription/billing system.
- ERP integrations.
- Native mobile applications.
- Broad performance refactor or redesign.
- Admin/Owner review-bell backend notifications; the review queue may be checked manually during the first Beta.
- Large-scale Supplier imports or a target of 5,000 records.

## 10. Production protection and stop rules

- Never merge, deploy, publish, change billing, change DNS, or change Production Firebase configuration without explicit approval.
- Never delete, migrate, seed, backfill, bulk-update, reformat, or clean Production data without explicit approval.
- Do not delete controlled TEST records without explicit approval.
- Use Emulator and isolated temporary data for write-capable tests.
- Production smoke tests should be safe and read-only where possible.
- File uploads remain disabled unless separately approved.
- Do not assume Storage, Functions, Extensions, or Firebase AI services are active.
- Do not treat `C:\tmp` as permanent backup storage.

## 11. Baseline verification rule

For ordinary UI or isolated application changes:

- Verify current `main`.
- Use this baseline.
- Review the affected module and diff only.
- Run the smallest affected tests first.

For security, data, Rules, deployment, RFQ lifecycle, notifications, imports, authentication, supplier linking, or infrastructure tasks, record the relevant current:

- `main` SHA.
- Hosting release/version.
- Ruleset and index readiness.
- bounded Production counts.
- audit-log count.
- Supplier fingerprints if Supplier data could be affected.
- controlled TEST/UAT records that must be preserved.

If any value differs unexpectedly, stop and report the delta before writing, merging, cleaning up, or deploying.
