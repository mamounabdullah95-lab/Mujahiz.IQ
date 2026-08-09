# Supplier ownership Claims foundation implementation evidence

Status: local-only structural implementation evidence

## Scope and starting point

This evidence records the fifteenth local SQL slice authorized by the Owner-approved Claim Option A contract.  It starts from refreshed `origin/main` at `157c1615ec222ee088b97095fe69eb26c3c45064` and adds exactly one empty table: `public.supplier_ownership_claims`.

It adds no Claim runtime, rows, trusted command, reviewer-assignment command, RLS, Auth bridge, notification, file integration, audit writer, event producer/materializer, hosted Supabase operation, Firebase change, Production/TEST data movement, seed, backfill, deployment, or migration execution outside the disposable local validator.

## Contract-to-physical mapping

| Approved Claim contract | Physical boundary |
|---|---|
| Opaque stable identity; provider-neutral claimant and canonical Supplier target | `id uuid` with database UUIDv4 default; restrictive `claimant_user_profile_id` and `supplier_profile_id` FKs. Firebase UID, email, and provider-link IDs are absent. |
| Exact lifecycle and future optimistic locking | `status` is constrained to the seven approved values; `record_version >= 1`; `created_at`/`updated_at` support later trusted version checking. |
| Immutable submission aggregate | `submitted_at`, `expires_at`, `submitted_reason`, versioned bounded `claimant_snapshot`, `submission_fingerprint`/version, and versioned bounded `evidence_descriptors` are present. This table has no generic source identifier because no migration contract requires one before real migrated rows. |
| Fixed 30-calendar-day horizon | `expires_at > submitted_at` is structurally required. The contract does not approve the timezone/calendar definition needed to make a cross-session PostgreSQL check for “30 calendar days” deterministic, so trusted submission must calculate and later enforce the exact approved horizon; this slice does not invent a UTC or local-calendar rule. |
| Up to three private evidence descriptors without file custody | `evidence_schema_version` plus `evidence_descriptors jsonb` require a bounded JSON array of at most three objects and a byte ceiling. There is no evidence, attachment, file, upload, or arbitrary metadata table/column. Descriptor vocabulary, URL allowlisting, and raw-payload rejection remain a future trusted-command/registry boundary. |
| One durable write-once reviewer assignment | `reviewer_user_profile_id`, assignment version/time, assigning user/source, and assignment policy version form an all-or-none assignment shape. `under_review` requires that shape; all other states except terminal reviewed decisions prohibit it. There is no reviewer role, reassignment, Owner-override, or work-assignment table. |
| Decision and terminal provenance | Approved/rejected rows require provider-neutral decision actor/time, bounded decision reason, evidence-verification method/version/outcome, authorization-policy version, and optional bounded restricted notes. Withdrawn, expired, and superseded shapes carry only their approved claimant/system/successor provenance. |
| Approved ownership is provenance only | Nullable unique `resulting_supplier_ownership_id` is a restrictive FK and is required exactly for `approved`. It does not change `supplier_ownerships` as the sole ownership authority. |
| Resubmission and supersession relationships | Nullable restrictive `prior_claim_id` and `superseded_by_claim_id` self-FKs, plus anti-self-reference checks. Cross-row party/target validation remains in the future trusted command. |
| Active-cardinality and future locking/query seams | A partial unique index permits only one `submitted|under_review` Claim for a claimant/Supplier pair. Additional focused indexes support active-Claim Supplier locking, reviewer queues, and expiry processing without recreating Firebase lock collections. |
| Trusted-only default deny | Explicit revocation from `PUBLIC`, `anon`, `authenticated`, and `service_role`; no RLS, policies, triggers, functions, RPC, or grants. |

## Deferred boundaries

The table cannot itself enforce write-once fields, permitted transitions, reviewer eligibility/conflicts, assignment authority, full descriptor registry/URL validation, exact 30-calendar-day calculation, cross-row Claim relationship compatibility, ownership creation, audit/idempotency/event atomicity, notifications, Auth/RLS, retention, migration/cutover, or hosted/Production use. Those remain deliberately outside this structural slice.
