# Mujahiz IQ — Current Verified Baseline

Baseline ID: `baseline-2026-07-28-post-pr30-internal-emulator-foundation`
Updated: 2026-07-28
Canonical Production URL: `https://mujahiz.com`

This is the only frequently changing context document. Update it after a behavior-affecting code merge, deployment, Production-data change, or infrastructure change. Keep the current repository state, merged-but-undeployed changes, and last verified Production state distinct.

## 1. Current repository `main`

- Repository: `mamounabdullah95-lab/Mujahiz.IQ`.
- Approved branch: `main`.
- Current verified `main` commit: `0182ff5ca0d557b5616469b84bd8b803e77bb1a6`.
- PR #23 is merged. Its merge commit is `8fc818c432e66eac387d0c57f06214a7db5aacc6`.
- PR #28 is merged. Its source commit is `6c6edeff6a8ca06ec4dd412d51e7378c6e29b0f2`; its merge commit is `3f7a1e56c481c6ef72d3d43bcfcb0a4c81ab986d`.
- PR #30 merged on 28 July 2026. Its merge commit, and the current `main`, is `0182ff5ca0d557b5616469b84bd8b803e77bb1a6`.
- PR #25 is merged. Its documentation-only merge commit is `a660f9921d688424b3d7574fc06a400197230130`.

The repository SHA identifies source-control state. It must not be described as the active Production application version unless a Hosting deployment is separately verified.

Codex must verify the live `main` SHA before making changes.

### Latest verified automated-test baseline

- Repository tests: **128/128 passed**.
- Firebase bundle tests: **3/3 passed**.
- Auth/Firestore Emulator tests: **73/73 passed**, including diagnostics.
- Total: **204 passing tests**.
- Production build: **passed**.
- Evidence source: the complete verification recorded for PR #30, which is contained in current `main`.
- `npm audit --omit=dev` reported two pre-existing moderate React Router advisories. PR #28 did not change dependencies or the lockfile.

## 2. Merged but not yet deployed

No known PR #23 or PR #28 application change remains merged but undeployed:

- PR #23 was deployed through its required staged index, Rules, and Hosting sequence.
- PR #28 was subsequently deployed to Hosting only because it required no Rules or index change.
- PR #30 added an Internal Emulator foundation only. It required no Firebase deployment, and none was performed.
- No Production access or data change occurred for PR #30.

This does not authorize a future deployment. Any later merged change requires its own deployment-scope verification and approval.

## 3. Current verified Production deployment state

Keep repository, Hosting, Rules, and indexes distinct:

- Firebase project: `mujahiziq`.
- Current Hosting release: `1785098739622000`.
- Current Hosting version: `f16be6f0bed75c19`.
- Current Hosting release time: `2026-07-26T20:45:39.622Z`.
- The current Hosting release is the corrected PR #28 Hosting deployment and includes the deployed PR #23 RFQ lifecycle behavior.
- PR #23 Hosting release `1784644705920000` / version `6e79204bb8715250` is superseded by the current PR #28 Hosting release.
- Active Firestore Ruleset: `e6948804-1333-433a-ac69-f0f963d07355`.
- PR #28 did not change Firestore Rules; the active Ruleset remains the PR #23 deployment.
- All **15** required composite indexes report `READY`.
- PR #28 did not change indexes; their deployed state remains the PR #23 deployment.
- Canonical Production domain: `mujahiz.com`.
- Legacy Firebase Hosting origins are intended to redirect to the canonical domain.

The repository `main` SHA, Hosting version, Ruleset ID, and index state identify different systems and must not be substituted for one another.

## 4. Last verified Production data counts

The final bounded RFQ UAT audit recorded these fresh relevant global counts:

- RFQ responses: **2**.
- RFQ response revisions: **2**.
- RFQ response events: **3**.
- Notifications: **6**.

Delta reconciliation against the Stage 3 pre-submission checkpoint:

| Collection | Stage 3 baseline | Final | Delta |
| --- | ---: | ---: | ---: |
| RFQ responses | 1 | 2 | +1 |
| RFQ response revisions | 0 | 2 | +2 |
| RFQ response events | 1 | 3 | +2 |
| Notifications | 4 | 6 | +2 |

Every delta matched the expected single V1 submission and single material V2 update. The identical V2 resubmission and RFQ closure added no response, revision, event, or notification artifact.

The following older counts were not refreshed during the final UAT audit and remain last-verified values rather than fresh current assertions:

- Suppliers: **480**.
- Supplier submissions/requests: **540**.
- Users: **4**.
- Conversations: **0**.
- Messages: **0**.

The exact current global RFQ count was not re-aggregated in the final audit. Two controlled TEST RFQs are known and preserved: `UAT-RFQ-20260720-01` and `UAT-RFQ-REVISION-20260721-01`.

The last complete read-only supplier audit before the controlled RFQ UAT was recorded at `2026-07-20T07:32:33.904Z`. It attempted no Production writes. Supplier ID/content fingerprints were unchanged against the approved 480-supplier baseline. The final RFQ audit did not run a full scan or calculate Supplier hashes.

## 5. Controlled Production RFQ quotation-revision UAT

Final result: **PASS**. No known UAT issue remains.

### Controlled TEST identity

- RFQ reference: `UAT-RFQ-REVISION-20260721-01`.
- RFQ document ID: `f0jto81FI742Q1o87Fqw`.
- Title: `TEST - RFQ Revision Lifecycle`.
- The RFQ targeted exactly one approved TEST Supplier and remained linked to the correct TEST Buyer.
- The deterministic response ID is `{rfqId}_{TEST_SUPPLIER_UID}`. The UID-bearing literal is deliberately not stored in this baseline.
- Deterministic revision IDs: `{responseId}_v1` and `{responseId}_v2`.
- Deterministic response event IDs: `{responseId}` for first submission and `{responseId}_v2` for the material update.
- Deterministic Buyer notification IDs: `rfq-response_{responseId}` and `rfq-response-updated_{responseId}_v2`.

### Verified lifecycle

- RFQ creation and publication passed.
- V1 creation passed at **300000 IQD** and **4 delivery days**.
- V2 creation passed at **325000 IQD** and **4 delivery days**.
- V1 remained immutable after V2.
- Resubmitting identical V2 values was a no-op: canonical `updatedAt` did not change and no V3 artifact was created.
- Exactly one canonical response, two immutable revisions, two deterministic response events, and two deterministic Buyer notifications exist for this TEST RFQ.
- No duplicate response, revision, event, or notification artifact exists.
- RFQ closure and movement to Supplier History passed.
- Buyer and Supplier can read V1 and V2 in read-only revision history after closure.
- The older controlled RFQ `UAT-RFQ-20260720-01` remained untouched.
- Preserve all controlled TEST RFQ, response, revision, event, and notification artifacts. Do not clean them up without explicit approval.

### Verified timestamps

- Corrected PR #28 Hosting release: `2026-07-26T20:45:39.622Z`.
- V1 atomic artifact timestamp: `2026-07-26T20:58:07.548Z`.
- V1 document creation time: `2026-07-26T20:58:07.622109Z`.
- V2 atomic artifact timestamp: `2026-07-27T05:53:44.129Z`.
- RFQ closure timestamp: `2026-07-27T06:22:30.586Z`.

The final audit used bounded exact/targeted reads plus four aggregation counts. It estimated 12 logical reads, attempted no writes, executed no full scan, calculated no Supplier hashes, and exposed no protected identifier.

## 6. Audit-log count

- Last earlier confirmed count before the controlled UAT changes: **622**.
- Current exact audit-log count: **Needs fresh read-only verification**.

Do not hard-code 622 as the current value in future high-risk prompts.

## 7. Future scope and recommended next task

- Buyer quotation decision / Award Status remains future scope. It was not implemented, started, or exercised by this UAT.
- The Internal Emulator foundation now deterministically provides **4 Buyer accounts**, **4 Supplier accounts**, a reset/reseed lifecycle, competing quotation fixtures, and loopback-only, fail-closed Auth/Firestore write guards.
- The recommended next task is **Password Reset and Account Recovery**.
- Browser-level Production UX validation remains a separate later task.

## 8. Domain state

- Purchased and active primary domain: `mujahiz.com`.
- Production is served through the canonical domain.
- `www.mujahiz.com` and legacy Firebase origins are part of the canonical-domain/redirect design.
- DNS is no longer described as merely pending manual setup in this baseline.
- Any new DNS, SSL, redirect, Authorized Domains, App Check, or email-action change still requires explicit approval and fresh verification.

## 9. Known deployment boundaries

- File uploads remain disabled unless separately approved.
- Do not assume Storage, Functions, Extensions, or Firebase AI services are active.
- PR #23 required index, Rules, and Hosting deployment; that sequence is complete for the verified deployment above.
- PR #28 required Hosting only; its verified Hosting deployment supersedes the PR #23 Hosting version without changing Rules or indexes.
- PR #30 required no Firebase deployment, and none was performed.
- Do not deploy, merge, write Production UAT records, clean up TEST artifacts, or change infrastructure without explicit approval.

## 10. Baseline verification rule

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
