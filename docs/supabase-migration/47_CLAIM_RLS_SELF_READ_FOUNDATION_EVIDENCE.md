# Claim RLS self-read foundation implementation evidence

Status: **Local-only Claimant self-read security foundation implemented and validated; no Claim mutation, reviewer/Admin access, gateway, hosted capability, data, or Production activation**

Date: 2026-08-09

Starting `origin/main`: `6544b16927b6a404ca4f7c3218993f26067e06c7`, the merge of PR #101

Primary task profile: Authentication and Accounts

## 1. Result and boundary

The seventeenth tracked local migration implements the first Claim-v1 read-only RLS slice on `public.supplier_ownership_claims`:

- RLS and FORCE ROW LEVEL SECURITY are enabled on the Claim base table;
- one `SELECT` policy applies only to `mujahiz_claim_runtime` and permits a row only when `claimant_user_profile_id = claim_security.current_claim_user_profile_id()`;
- one `SECURITY INVOKER`, security-barrier view exposes a minimized Claimant status/history projection; and
- the runtime receives only the column-level base privileges required by that view plus `SELECT` on the view.

Missing, malformed, wrong-purpose, wrong-policy, wrong-environment, or wrong-transaction context continues to resolve no principal and therefore returns zero Claim rows. Exact-ID lookup for another claimant and an unknown Claim both return zero rows.

This slice creates no Claim submit, withdraw, review, decision, expiry, or supersession command; no mutation policy; no reviewer/Admin/Owner or Supplier-controller access; no browser/API grant; no Firebase bridge or gateway; no notification/audit/event/idempotency runtime; no hosted Supabase resource; and no real or retained synthetic row.

## 2. Projection and column minimization

`public.supplier_ownership_claims_claimant_v1` exposes exactly:

1. `id`
2. `supplier_profile_id`
3. `status`
4. `claimant_result_code`
5. `submitted_at`
6. `expires_at`
7. `decided_at`
8. `withdrawn_at`
9. `expired_at`
10. `superseded_at`
11. `updated_at`
12. `record_version`

`claimant_result_code` is derived only from the already-visible lifecycle status. It returns `approved`, `not_approved`, `withdrawn`, `expired`, or `superseded` for the corresponding terminal status and `null` for active states. Rejections are deliberately minimized to `not_approved`; the runtime is not granted `decision_reason_code`.

The projection excludes `submitted_reason` because Claimant-v1 status/history does not require replaying private claimant-authored text in this first slice. It also excludes claimant identity, claimant snapshot, evidence descriptors, reviewer identity/assignment/notes, decision actor and raw decision reason, policy/security provenance, prior/superseding Claim references, resulting ownership reference, provider identity, and every audit/event/idempotency field.

## 3. Exact privileges and RLS behavior

The migration grants `mujahiz_claim_runtime` column-level `SELECT` on exactly these eleven base columns:

- `id`
- `supplier_profile_id`
- `status`
- `record_version`
- `submitted_at`
- `expires_at`
- `decided_at`
- `withdrawn_at`
- `expired_at`
- `superseded_at`
- `updated_at`

It grants the runtime `SELECT` on `public.supplier_ownership_claims_claimant_v1`. It grants no table-level base `SELECT`, no restricted-column privilege, and no `INSERT`, `UPDATE`, or `DELETE` authority.

`PUBLIC`, `anon`, `authenticated`, and `service_role` retain no Claim base-table or projection privilege. No `SECURITY DEFINER` routine is introduced. The view remains subject to invoker privileges and the forced base-table RLS policy; `mujahiz_claim_runtime` owns neither the base relation, view, schema, nor helper routines and has no `BYPASSRLS` attribute.

## 4. Deterministic security proof

The focused pgTAP file uses only disposable synthetic profiles, one synthetic Supplier, and two competing synthetic Claims:

- Claimant A sees only Claim A;
- Claimant B sees only Claim B;
- each exact cross-claimant lookup returns zero rows;
- an unknown Claim ID returns the same zero-row result;
- missing context after commit returns zero rows on the same backend connection;
- wrong-purpose and malformed-principal context return zero rows;
- direct safe-column base reads remain self-filtered by RLS;
- `SELECT *`, claimant-authored reason, snapshot, evidence, reviewer identity, and reviewer notes return SQLSTATE `42501` for the runtime;
- runtime `INSERT`, `UPDATE`, and `DELETE` return SQLSTATE `42501`;
- API roles have no base or projection privileges;
- the temporary disposable-test role grant is removed and the exact Supabase-managed runtime membership remains unchanged; and
- both synthetic Claims are deleted before the final zero-row assertion.

## 5. Validation evidence

- Focused disposable PostgreSQL 17.6 pgTAP: **63/63 passed**.
- Complete repository SQL validator: **17 migrations applied; 17 pgTAP files; 1,068/1,068 assertions passed; 0 failed**.
- Physical PostgreSQL tables: **22**.
- RLS policies: **1**, claimant self-select only.
- Views introduced by this slice: **1**.
- Functions introduced by this slice: **0**.
- All tracked migration `SECURITY DEFINER` matches: **0**.
- Sensitive-value scan of the migration/test: **0 matches**.
- Core Phase 1 concepts: **20 implemented / 16 deferred**, unchanged because this slice adds no table or concept.
- `git diff --check`: **passed**.

## 6. Production impact, residual risks, and stop point

Production impact is **none**. Validation used disposable local PostgreSQL and synthetic rows only. No Firebase service, hosted Supabase project, real Claim, Production/TEST data, migration execution outside the disposable validator, deployment, or secret was accessed.

This is defense-in-depth substrate, not a usable Claim feature. A real trusted gateway still must validate current signed Firebase identity, resolve the provider-neutral principal, establish the database context through an approved connection role/pool boundary, and prove hosted isolation before any client use. Claim submit/mutation, safe rejection-detail mapping, reviewer/Admin/Owner access, Supplier-controller access, notifications, and all trusted commands remain separate reviewed slices.

Exact stop point: local Claimant self-read RLS, minimized projection, deterministic pgTAP, full local validation, implementation evidence, commit/push, and Draft PR only. Stop before Claim mutation, reviewer/Admin RLS, gateway implementation, hosted access, Production/TEST data, Ready-for-review status, merge, or deployment.
