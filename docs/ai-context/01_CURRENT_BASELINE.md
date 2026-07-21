# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-07-21-post-pr25`
Updated: 2026-07-21
Canonical Production URL: `https://mujahiz.com`

This is the only frequently changing context document. Update it after a behavior-affecting code merge, deployment, Production-data change, or infrastructure change. Keep the current repository state, merged-but-undeployed changes, and last verified Production state distinct.

## 1. Current repository `main`

- Repository: `mamounabdullah95-lab/Mujahiz.IQ`.
- Approved branch: `main`.
- Current verified `main` commit: `a660f9921d688424b3d7574fc06a400197230130`.
- PR #23 is merged. Its merge commit is `8fc818c432e66eac387d0c57f06214a7db5aacc6`.
- PR #25 is merged. Its merge commit, and the current `main`, is `a660f9921d688424b3d7574fc06a400197230130`.
- PR #25 changed documentation and repository instructions only. It did not change the application or the Production deployment.

The current repository SHA identifies source control state. It must not be described as the active Production application version unless a deployment is separately verified.

Codex must verify the live `main` SHA before making changes.

## 2. Merged but not yet deployed

PR #23 changed application behavior, Firestore Rules, and Firestore indexes. Those changes are present in the repository but have not been deployed to Production.

PR #23 requires a staged Production deployment in this order:

1. Deploy indexes.
2. Wait until every required index reports `READY`.
3. Deploy Firestore Rules.
4. Deploy Hosting.

Do not collapse or reorder these stages. Each Production deployment action requires explicit approval and fresh read-only pre-deployment verification.

## 3. Last verified Production deployment state

The last verified Production application state predates PR #23 and does not include its application, Firestore Rules, or index changes.

Last recorded deployment values after PR #22:

- Firebase project: `mujahiziq`.
- Hosting release: `1784535807667000`.
- Hosting version: `b27d80d752d4b942`.
- Firestore Ruleset: `bf7f044a-f69d-4cca-a5f8-151cad0c0c7a`.
- Index status: 77 indexes reported `READY`.
- Canonical Production domain: `mujahiz.com`.
- Legacy Firebase Hosting origins are intended to redirect to the canonical domain.

These values document the last verified state; they are not a claim about the currently active state. Before deployment, the current Hosting release/version, active Ruleset, and readiness of all required indexes need fresh read-only verification.

## 4. Last verified Production data counts

The last verified counts are:

- Suppliers: **480**.
- Supplier submissions/requests: **540**.
- Users: **4**.
- RFQs: **1**.
- RFQ responses: **1**.
- Notifications: **3**.
- Conversations: **0**.
- Messages: **0**.

These are preserved as the last verified counts, not asserted as fresh current counts. Retrieve fresh relevant counts through an approved read-only check when a deployment or high-risk task requires them.

The last complete read-only audit before the controlled RFQ UAT was recorded at `2026-07-20T07:32:33.904Z`. It attempted no Production writes. Supplier ID/content fingerprints were unchanged against the approved 480-supplier baseline. The exact post-480 fingerprint values were not included in the PR #22 summary; retrieve them through the approved read-only audit script/report when a high-risk task requires fingerprint comparison. Do not reuse the older 479-supplier fingerprint values.

## 5. Controlled RFQ UAT state

- Controlled RFQ: `UAT-RFQ-20260720-01`.
- A first Supplier quotation was submitted successfully and then updated.
- The Buyer closed the RFQ.
- PR #23 addresses the resulting RFQ lifecycle/history and notification behavior in repository code, but those changes are not yet deployed.
- Do not delete the controlled RFQ, quotation, notification, or related TEST records without explicit approval.
- Any controlled Production RFQ write-path UAT requires separate explicit approval. Deployment approval does not authorize Production test writes.

## 6. Audit-log count

- Last earlier confirmed count before the controlled UAT changes: **622**.
- Current exact audit-log count: **Needs fresh read-only verification**.

Do not hard-code 622 as the current value in future high-risk prompts.

## 7. Domain state

- Purchased and active primary domain: `mujahiz.com`.
- Production is served through the canonical domain.
- `www.mujahiz.com` and legacy Firebase origins are part of the canonical-domain/redirect design.
- DNS is no longer described as merely pending manual setup in this baseline.
- Any new DNS, SSL, redirect, Authorized Domains, App Check, or email-action change still requires explicit approval and fresh verification.

## 8. Known deployment boundaries

- File uploads remain disabled unless separately approved.
- Do not assume Storage, Functions, Extensions, or Firebase AI services are active.
- PR #23 requires the staged deployment sequence documented above; it is not a Hosting-only change.
- Do not deploy, merge, write Production UAT records, or change infrastructure without explicit approval.

## 9. Baseline verification rule

For ordinary UI or isolated application changes:

- Verify current `main`.
- Use this baseline.
- Perform only the smallest relevant local or read-only check.

For security, data, Rules, deployment, RFQ lifecycle, notifications, imports, authentication, supplier linking, or infrastructure tasks, record:

- Current `main` SHA.
- Current Hosting release/version when deployment is in scope.
- Current Ruleset and index readiness when relevant.
- Fresh relevant Production counts.
- Current audit-log count when relevant.
- Current supplier fingerprints if supplier data could be affected.
- Controlled TEST/UAT records that must be preserved.

If any value differs unexpectedly, stop and report the delta before writing, merging, cleaning up, or deploying.
