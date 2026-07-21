# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-07-20-post-pr22`  
Updated: 2026-07-20  
Canonical Production URL: `https://mujahiz.com`

This is the only frequently changing context document. Update it after a behavior-affecting code merge, deployment, Production-data change, or infrastructure change. A documentation-only merge does not require changing the application baseline commit.

## 1. Source control

- Repository: `mamounabdullah95-lab/Mujahiz.IQ`.
- Approved branch: `main`.
- Verified application-code baseline commit: `33a2eb931f7c0bfd8795036cd524f59803d84330`.
- This commit merged PR #22: `fix: allow first-time supplier RFQ response flow`.
- PR #23 was discussed as the next planned RFQ lifecycle/history task but was not found as an opened or merged PR at the time of this baseline update.

Codex must verify the live `main` SHA before making changes. A newer documentation-only Project Memory commit does not invalidate this application baseline. If later commits change application code, Firebase, infrastructure, or Production behavior, record the new relevant SHA and update this baseline.

## 2. Firebase deployment

Latest deployment values recorded in the project conversation after PR #22:

- Firebase project: `mujahiziq`.
- Hosting release: `1784535807667000`.
- Hosting version: `b27d80d752d4b942`.
- Firestore Ruleset: `bf7f044a-f69d-4cca-a5f8-151cad0c0c7a`.
- Canonical Production domain: `mujahiz.com`.
- Legacy Firebase Hosting origins are intended to redirect to the canonical domain.
- Latest recorded index status: 77 indexes reported `READY`.
- PR #22 itself required Hosting only and made no Firestore Rules or index change.

Before any deployment task, re-check the currently active Hosting release, Ruleset, and index state instead of assuming these values are still current.

## 3. Last complete read-only Production audit

Audit timestamp: `2026-07-20T07:32:33.904Z`

The audit recorded:

- Suppliers: **480**.
- Supplier submissions/requests: **540**.
- Users: **4**.
- RFQs: **1**.
- RFQ responses: **0**.
- Conversations: **0**.
- Messages: **0**.
- Notifications: **2**.
- Supplier ID/content fingerprints: unchanged against the approved 480-supplier baseline.
- Production writes attempted by the audit: **false**.

The exact post-480 fingerprint values were not included in the PR #22 summary. Retrieve them through the approved read-only audit script/report when a high-risk task requires fingerprint comparison. Do not reuse the older 479-supplier fingerprint values.

## 4. Known controlled UAT changes after the complete audit

After the audit above, the controlled RFQ test continued:

- Controlled RFQ: `UAT-RFQ-20260720-01`.
- A first Supplier quotation was submitted successfully.
- The quotation was updated.
- The Buyer closed the RFQ.
- The Supplier quotation/history became hidden after closure; this was identified as a product defect.
- The Buyer did not receive the expected notification for the quotation update.
- A follow-up task was proposed to preserve closed RFQ/quotation history, revisions, and update notifications.

Therefore, the audit counts for RFQ responses, notifications, and audit logs are no longer guaranteed to represent the current live counts. Before any RFQ, notification, cleanup, data-integrity, or Production task, run a new read-only audit.

Do not delete the controlled RFQ, quotation, notification, or related TEST records without explicit approval.

## 5. Audit-log count

- Last earlier confirmed count before the controlled UAT changes: **622**.
- Current exact count after UAT: **Needs read-only verification**.

Do not hard-code 622 as the current value in future high-risk prompts.

## 6. Domain state

- Purchased and active primary domain: `mujahiz.com`.
- Production is served through the canonical domain.
- `www.mujahiz.com` and legacy Firebase origins are part of the canonical-domain/redirect design.
- DNS is no longer described as merely pending manual setup in this baseline.
- Any new DNS, SSL, redirect, Authorized Domains, App Check, or email-action change still requires explicit approval and fresh verification.

## 7. Known deployment boundaries

- File uploads remain disabled unless separately approved.
- Do not assume Storage, Functions, Extensions, or Firebase AI services are active.
- PR #22 changed application behavior only and required Hosting deployment only.
- Do not redeploy Rules or indexes as part of a Hosting-only fix unless a separate reviewed change requires them.

## 8. Baseline verification rule

For ordinary UI or isolated application changes:

- Verify current `main`.
- Use this baseline.
- Perform only the smallest relevant local or read-only check.

For security, data, Rules, deployment, RFQ lifecycle, notifications, imports, authentication, supplier linking, or infrastructure tasks, record:

- Current `main` SHA.
- Current Hosting release/version when deployment is in scope.
- Current Ruleset and index state when relevant.
- Fresh relevant Production counts.
- Current supplier fingerprints if supplier data could be affected.
- Controlled TEST/UAT records that must be preserved.

If any value differs unexpectedly, stop and report the delta before writing, merging, cleaning up, or deploying.
