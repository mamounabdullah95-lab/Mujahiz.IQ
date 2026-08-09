-- Fifteenth local SQL slice: empty trusted-only Supplier ownership Claim foundation.
-- This migration creates no Claim rows, command, assignment runtime, RLS, Auth bridge,
-- event/audit/notification writer, file integration, hosted capability, or data movement.

create table public.supplier_ownership_claims (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  claimant_user_profile_id uuid not null,
  supplier_profile_id uuid not null,
  status text not null default 'submitted',
  record_version integer not null default 1,
  submitted_at timestamptz not null default pg_catalog.statement_timestamp(),
  expires_at timestamptz not null,
  submitted_reason text not null,
  claimant_snapshot_schema_version text not null,
  claimant_snapshot jsonb not null,
  submission_fingerprint_version text not null,
  submission_fingerprint text not null,
  evidence_schema_version text not null,
  evidence_descriptors jsonb not null default '[]'::jsonb,
  reviewer_user_profile_id uuid,
  reviewer_assignment_version integer,
  reviewer_assigned_at timestamptz,
  reviewer_assigned_by_user_profile_id uuid,
  reviewer_assignment_source_code text,
  reviewer_assignment_policy_version text,
  decided_by_user_profile_id uuid,
  decided_at timestamptz,
  decision_reason_code text,
  evidence_verification_method_code text,
  evidence_verification_version text,
  evidence_verification_outcome_code text,
  decision_authorization_policy_version text,
  reviewer_notes text,
  withdrawn_at timestamptz,
  withdrawn_by_user_profile_id uuid,
  withdrawal_reason_code text,
  expired_at timestamptz,
  expiry_system_source_code text,
  expiry_policy_version text,
  superseded_at timestamptz,
  supersession_reason_code text,
  prior_claim_id uuid,
  superseded_by_claim_id uuid,
  resulting_supplier_ownership_id uuid unique,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint supplier_ownership_claims_status_ck check (
    status in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'expired', 'superseded')
  ),
  constraint supplier_ownership_claims_record_version_ck check (
    record_version >= 1
  ),
  constraint supplier_ownership_claims_expiry_order_ck check (
    expires_at > submitted_at
  ),
  constraint supplier_ownership_claims_submitted_reason_ck check (
    octet_length(submitted_reason) between 1 and 2000
  ),
  constraint supplier_ownership_claims_snapshot_ck check (
    octet_length(claimant_snapshot_schema_version) between 1 and 64
    and pg_catalog.jsonb_typeof(claimant_snapshot) = 'object'
    and octet_length(claimant_snapshot::text) <= 4096
  ),
  constraint supplier_ownership_claims_submission_fingerprint_ck check (
    octet_length(submission_fingerprint_version) between 1 and 64
    and octet_length(submission_fingerprint) between 1 and 256
  ),
  constraint supplier_ownership_claims_evidence_descriptors_ck check (
    octet_length(evidence_schema_version) between 1 and 64
    and pg_catalog.jsonb_typeof(evidence_descriptors) = 'array'
    and pg_catalog.jsonb_array_length(evidence_descriptors) <= 3
    and octet_length(evidence_descriptors::text) <= 12288
    and not pg_catalog.jsonb_path_exists(evidence_descriptors, '$[*] ? (@.type() != "object")')
  ),
  constraint supplier_ownership_claims_reviewer_assignment_shape_ck check (
    (
      reviewer_user_profile_id is null
      and reviewer_assignment_version is null
      and reviewer_assigned_at is null
      and reviewer_assigned_by_user_profile_id is null
      and reviewer_assignment_source_code is null
      and reviewer_assignment_policy_version is null
    )
    or (
      reviewer_user_profile_id is not null
      and reviewer_assignment_version >= 1
      and reviewer_assigned_at is not null
      and reviewer_assigned_by_user_profile_id is not null
      and reviewer_assignment_source_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and octet_length(reviewer_assignment_policy_version) between 1 and 128
      and reviewer_user_profile_id <> claimant_user_profile_id
    )
  ),
  constraint supplier_ownership_claims_decision_shape_ck check (
    (
      decided_by_user_profile_id is null
      and decided_at is null
      and decision_reason_code is null
      and evidence_verification_method_code is null
      and evidence_verification_version is null
      and evidence_verification_outcome_code is null
      and decision_authorization_policy_version is null
      and reviewer_notes is null
    )
    or (
      decided_by_user_profile_id is not null
      and decided_at is not null
      and decision_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and evidence_verification_method_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and octet_length(evidence_verification_version) between 1 and 64
      and evidence_verification_outcome_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and octet_length(decision_authorization_policy_version) between 1 and 128
      and (reviewer_notes is null or octet_length(reviewer_notes) between 1 and 2000)
    )
  ),
  constraint supplier_ownership_claims_withdrawal_shape_ck check (
    (
      withdrawn_at is null
      and withdrawn_by_user_profile_id is null
      and withdrawal_reason_code is null
    )
    or (
      withdrawn_at is not null
      and withdrawn_by_user_profile_id = claimant_user_profile_id
      and (withdrawal_reason_code is null or withdrawal_reason_code ~ '^[a-z][a-z0-9_]{0,62}$')
    )
  ),
  constraint supplier_ownership_claims_expiry_shape_ck check (
    (
      expired_at is null
      and expiry_system_source_code is null
      and expiry_policy_version is null
    )
    or (
      expired_at is not null
      and expiry_system_source_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and octet_length(expiry_policy_version) between 1 and 128
    )
  ),
  constraint supplier_ownership_claims_supersession_shape_ck check (
    (
      superseded_at is null
      and supersession_reason_code is null
      and superseded_by_claim_id is null
    )
    or (
      superseded_at is not null
      and supersession_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and superseded_by_claim_id is not null
    )
  ),
  constraint supplier_ownership_claims_lifecycle_shape_ck check (
    (
      status = 'submitted'
      and reviewer_user_profile_id is null
      and decided_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
      and resulting_supplier_ownership_id is null
    )
    or (
      status = 'under_review'
      and reviewer_user_profile_id is not null
      and decided_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
      and resulting_supplier_ownership_id is null
    )
    or (
      status = 'approved'
      and reviewer_user_profile_id is not null
      and decided_by_user_profile_id = reviewer_user_profile_id
      and decided_at is not null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
      and resulting_supplier_ownership_id is not null
    )
    or (
      status = 'rejected'
      and reviewer_user_profile_id is not null
      and decided_by_user_profile_id = reviewer_user_profile_id
      and decided_at is not null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is null
      and resulting_supplier_ownership_id is null
    )
    or (
      status = 'withdrawn'
      and decided_at is null
      and withdrawn_at is not null
      and expired_at is null
      and superseded_at is null
      and resulting_supplier_ownership_id is null
    )
    or (
      status = 'expired'
      and decided_at is null
      and withdrawn_at is null
      and expired_at is not null
      and superseded_at is null
      and resulting_supplier_ownership_id is null
    )
    or (
      status = 'superseded'
      and decided_at is null
      and withdrawn_at is null
      and expired_at is null
      and superseded_at is not null
      and resulting_supplier_ownership_id is null
    )
  ),
  constraint supplier_ownership_claims_terminal_time_ck check (
    (withdrawn_at is null or withdrawn_at >= submitted_at)
    and (expired_at is null or expired_at >= submitted_at)
    and (superseded_at is null or superseded_at >= submitted_at)
    and (decided_at is null or decided_at >= submitted_at)
  ),
  constraint supplier_ownership_claims_updated_at_ck check (
    updated_at >= created_at
  ),
  constraint supplier_ownership_claims_prior_claim_not_self_ck check (
    prior_claim_id is null or prior_claim_id <> id
  ),
  constraint supplier_ownership_claims_successor_claim_not_self_ck check (
    superseded_by_claim_id is null or superseded_by_claim_id <> id
  ),
  constraint supplier_ownership_claims_claimant_user_profile_fk foreign key (claimant_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownership_claims_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_ownership_claims_reviewer_user_profile_fk foreign key (reviewer_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownership_claims_reviewer_assigned_by_user_profile_fk foreign key (reviewer_assigned_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownership_claims_decided_by_user_profile_fk foreign key (decided_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownership_claims_withdrawn_by_user_profile_fk foreign key (withdrawn_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownership_claims_prior_claim_fk foreign key (prior_claim_id)
    references public.supplier_ownership_claims (id) on delete restrict,
  constraint supplier_ownership_claims_superseded_by_claim_fk foreign key (superseded_by_claim_id)
    references public.supplier_ownership_claims (id) on delete restrict,
  constraint supplier_ownership_claims_resulting_supplier_ownership_fk foreign key (resulting_supplier_ownership_id)
    references public.supplier_ownerships (id) on delete restrict
);

comment on table public.supplier_ownership_claims is
  'Trusted-only empty local Supplier ownership Claim aggregate. It records bounded private submission evidence, lifecycle, one durable reviewer assignment, terminal provenance, and an approved-Claim ownership result reference. It is not a current ownership authority, reviewer queue runtime, evidence/file store, event or audit history, idempotency store, notification source, browser/API surface, or Firebase integration.';
comment on column public.supplier_ownership_claims.claimant_user_profile_id is
  'Required provider-neutral claimant principal. This restrictive foreign key is never a Firebase UID, identity-provider link, email, platform role, ownership authority, or browser-selected identity.';
comment on column public.supplier_ownership_claims.expires_at is
  'Fixed trusted submission expiry. The approved 30-calendar-day calculation remains at the future trusted command boundary because no calendar/timezone registry is selected by this local structural slice.';
comment on column public.supplier_ownership_claims.evidence_descriptors is
  'Bounded schema-versioned private evidence descriptors only. It stores no raw file payload, file-object identity, object custody, upload metadata, signed URL, attachment row, or generic metadata dump.';
comment on column public.supplier_ownership_claims.reviewer_user_profile_id is
  'Nullable durable provider-neutral reviewer assignment. It is not a platform role, delegation, reassignment history, Owner override, or direct authority grant.';
comment on column public.supplier_ownership_claims.resulting_supplier_ownership_id is
  'Nullable unique provenance reference required only for an approved Claim. public.supplier_ownerships remains the sole ownership authority.';
comment on column public.supplier_ownership_claims.prior_claim_id is
  'Nullable restrictive prior-Claim link for a later permitted resubmission. It does not expose another claimant or authorize a resubmission.';
comment on column public.supplier_ownership_claims.superseded_by_claim_id is
  'Nullable restrictive successor-Claim link required for a superseded Claim. It creates no competing-Claim mutation, event, or notification runtime.';

create unique index supplier_ownership_claims_one_active_pair_uidx
  on public.supplier_ownership_claims (claimant_user_profile_id, supplier_profile_id)
  where status in ('submitted', 'under_review');

create index supplier_ownership_claims_supplier_active_lock_idx
  on public.supplier_ownership_claims (supplier_profile_id, status, id)
  where status in ('submitted', 'under_review');

create index supplier_ownership_claims_reviewer_queue_idx
  on public.supplier_ownership_claims (reviewer_user_profile_id, expires_at, id)
  where status = 'under_review';

create index supplier_ownership_claims_active_expiry_idx
  on public.supplier_ownership_claims (expires_at, id)
  where status in ('submitted', 'under_review');

revoke all on table public.supplier_ownership_claims from public, anon, authenticated, service_role;
