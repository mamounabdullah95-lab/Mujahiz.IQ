-- Twenty-first tracked local SQL migration: empty, fully revoked administration-access foundation only.
-- This migration creates no access rows, resolver, RLS, policy, RPC, trigger, trusted
-- command, Firebase integration, bootstrap runtime, hosted operation, or Claim authority.

alter table public.platform_role_assignments
  add constraint platform_role_assignments_id_user_role_uk
    unique (id, user_profile_id, role_code);

create table public.access_grants (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_profile_id uuid not null,
  platform_role_assignment_id uuid not null,
  role_code text not null,
  access_purpose text not null default 'platform_administration',
  access_status text not null default 'active',
  valid_from timestamptz not null default pg_catalog.statement_timestamp(),
  valid_until timestamptz,
  record_version integer not null default 1,
  grant_source_type text not null,
  grant_reason_code text not null,
  authorization_policy_version text not null,
  evidence_reference text not null,
  correlation_reference text,
  granted_by_user_profile_id uuid,
  grant_system_source text,
  reviewed_by_user_profile_id uuid,
  granted_at timestamptz not null default pg_catalog.statement_timestamp(),
  terminal_reason_code text,
  terminated_by_user_profile_id uuid,
  terminal_system_source text,
  terminated_at timestamptz,
  superseding_access_grant_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint access_grants_role_code_ck check (
    role_code in ('owner', 'admin')
  ),
  constraint access_grants_purpose_ck check (
    access_purpose = 'platform_administration'
  ),
  constraint access_grants_status_ck check (
    access_status in ('active', 'revoked', 'expired', 'superseded')
  ),
  constraint access_grants_validity_interval_ck check (
    valid_until is null or valid_until > valid_from
  ),
  constraint access_grants_admin_horizon_ck check (
    role_code <> 'admin'
    or (
      valid_until is not null
      and valid_until <= valid_from + interval '180 days'
    )
  ),
  constraint access_grants_record_version_ck check (
    record_version >= 1
  ),
  constraint access_grants_source_type_ck check (
    grant_source_type in (
      'bootstrap_manifest', 'access_administration', 'legacy_reconciliation', 'correction'
    )
  ),
  constraint access_grants_reason_code_ck check (
    grant_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint access_grants_policy_version_ck check (
    octet_length(authorization_policy_version) between 1 and 128
  ),
  constraint access_grants_evidence_reference_ck check (
    octet_length(evidence_reference) between 1 and 256
  ),
  constraint access_grants_correlation_reference_ck check (
    correlation_reference is null
    or octet_length(correlation_reference) between 1 and 256
  ),
  constraint access_grants_system_source_ck check (
    grant_system_source is null
    or grant_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint access_grants_grant_provenance_ck check (
    (
      grant_source_type = 'bootstrap_manifest'
      and granted_by_user_profile_id is null
      and grant_system_source is not null
    )
    or (
      grant_source_type <> 'bootstrap_manifest'
      and granted_by_user_profile_id is not null
      and grant_system_source is null
    )
  ),
  constraint access_grants_reviewer_distinct_ck check (
    reviewed_by_user_profile_id is null
    or (
      reviewed_by_user_profile_id <> user_profile_id
      and (
        granted_by_user_profile_id is null
        or reviewed_by_user_profile_id <> granted_by_user_profile_id
      )
    )
  ),
  constraint access_grants_terminal_reason_code_ck check (
    terminal_reason_code is null
    or terminal_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint access_grants_terminal_system_source_ck check (
    terminal_system_source is null
    or terminal_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint access_grants_lifecycle_shape_ck check (
    (
      access_status = 'active'
      and terminal_reason_code is null
      and terminated_by_user_profile_id is null
      and terminal_system_source is null
      and terminated_at is null
      and superseding_access_grant_id is null
      and (role_code <> 'owner' or valid_until is null)
    )
    or (
      access_status in ('revoked', 'expired')
      and valid_until is not null
      and terminal_reason_code is not null
      and terminated_at is not null
      and (terminated_by_user_profile_id is not null) <> (terminal_system_source is not null)
      and superseding_access_grant_id is null
    )
    or (
      access_status = 'superseded'
      and valid_until is not null
      and terminal_reason_code is not null
      and terminated_at is not null
      and (terminated_by_user_profile_id is not null) <> (terminal_system_source is not null)
      and superseding_access_grant_id is not null
    )
  ),
  constraint access_grants_timestamp_order_ck check (
    granted_at >= valid_from
    and created_at >= granted_at
    and updated_at >= created_at
    and (terminated_at is null or terminated_at >= valid_until)
  ),
  constraint access_grants_user_profile_fk foreign key (user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint access_grants_role_binding_fk foreign key (
    platform_role_assignment_id, user_profile_id, role_code
  ) references public.platform_role_assignments (id, user_profile_id, role_code)
    on delete restrict,
  constraint access_grants_granted_by_fk foreign key (granted_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint access_grants_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint access_grants_terminated_by_fk foreign key (terminated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint access_grants_superseding_access_grant_fk foreign key (superseding_access_grant_id)
    references public.access_grants (id) on delete restrict,
  constraint access_grants_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint access_grants_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint access_grants_subject_interval_excl exclude using gist (
    user_profile_id with =,
    access_purpose with =,
    tstzrange(valid_from, coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  ),
  constraint access_grants_role_assignment_interval_excl exclude using gist (
    platform_role_assignment_id with =,
    access_purpose with =,
    tstzrange(valid_from, coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  )
);

comment on table public.access_grants is
  'Trusted-only empty local role-backed platform-administration access history. A row binds one provider-neutral profile and exact Owner/Admin assignment; it is not Firebase authentication, a platform role, product entitlement, Supplier/Claim authority, RLS authorization, or a privileged-actor resolver result. No rows, bootstrap, routine, RLS, API/browser grant, mapping, or Firebase integration are created.';
comment on column public.access_grants.role_code is
  'Binding evidence constrained to equal the exact referenced platform-role assignment. It never becomes an independent role authority.';
comment on column public.access_grants.access_purpose is
  'The initial and only approved purpose is platform_administration; product, trial, billing, Claim-specific, and generic capability access are excluded.';
comment on column public.access_grants.grant_source_type is
  'Bounded source class only. bootstrap_manifest preserves the future bootstrap exception without fabricating a relational human grantor; this empty foundation creates no bootstrap or access command.';
comment on column public.access_grants.superseding_access_grant_id is
  'Nullable restrictive successor reference required only for superseded history. It creates no renewal, correction, precedence, or automatic authority inheritance.';

create index access_grants_active_subject_lookup_idx
  on public.access_grants (user_profile_id, valid_from desc, id)
  where access_status = 'active';

create index access_grants_active_assignment_lookup_idx
  on public.access_grants (platform_role_assignment_id, valid_from desc, id)
  where access_status = 'active';

create index access_grants_subject_status_valid_from_idx
  on public.access_grants (user_profile_id, access_status, valid_from desc, id);

revoke all on table public.access_grants from public, anon, authenticated, service_role, mujahiz_claim_runtime;
