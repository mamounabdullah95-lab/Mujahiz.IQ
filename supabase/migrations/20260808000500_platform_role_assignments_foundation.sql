-- Twelfth local SQL slice: empty restricted platform-role assignment foundation only.
-- This migration creates no role data, bootstrap path, trusted mutation routine, RLS,
-- API access, access grant, Firebase integration, or Claim decision capability.

create extension if not exists btree_gist with schema extensions;

create table public.platform_role_assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_profile_id uuid not null,
  role_code text not null,
  assignment_status text not null default 'active',
  valid_from timestamptz not null default pg_catalog.statement_timestamp(),
  valid_until timestamptz,
  record_version integer not null default 1,
  assignment_source_type text not null,
  assignment_reason_code text not null,
  authorization_policy_version text not null,
  evidence_reference text not null,
  correlation_reference text,
  assigned_by_user_profile_id uuid,
  assignment_system_source text,
  reviewed_by_user_profile_id uuid,
  assigned_at timestamptz not null default pg_catalog.statement_timestamp(),
  terminal_reason_code text,
  terminated_by_user_profile_id uuid,
  terminal_system_source text,
  terminated_at timestamptz,
  superseding_assignment_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint platform_role_assignments_role_code_ck check (
    role_code in ('owner', 'admin')
  ),
  constraint platform_role_assignments_status_ck check (
    assignment_status in ('active', 'revoked', 'expired', 'superseded')
  ),
  constraint platform_role_assignments_validity_interval_ck check (
    valid_until is null or valid_until > valid_from
  ),
  constraint platform_role_assignments_record_version_ck check (
    record_version >= 1
  ),
  constraint platform_role_assignments_source_type_ck check (
    assignment_source_type in (
      'bootstrap_manifest', 'role_administration', 'legacy_reconciliation', 'correction'
    )
  ),
  constraint platform_role_assignments_reason_code_ck check (
    assignment_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint platform_role_assignments_policy_version_ck check (
    octet_length(authorization_policy_version) between 1 and 128
  ),
  constraint platform_role_assignments_evidence_reference_ck check (
    octet_length(evidence_reference) between 1 and 256
  ),
  constraint platform_role_assignments_correlation_reference_ck check (
    correlation_reference is null
    or octet_length(correlation_reference) between 1 and 256
  ),
  constraint platform_role_assignments_system_source_ck check (
    assignment_system_source is null
    or assignment_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint platform_role_assignments_assignment_provenance_ck check (
    (
      assignment_source_type = 'bootstrap_manifest'
      and assigned_by_user_profile_id is null
      and assignment_system_source is not null
    )
    or (
      assignment_source_type <> 'bootstrap_manifest'
      and assigned_by_user_profile_id is not null
      and assignment_system_source is null
    )
  ),
  constraint platform_role_assignments_reviewer_distinct_ck check (
    reviewed_by_user_profile_id is null
    or (
      reviewed_by_user_profile_id <> user_profile_id
      and (
        assigned_by_user_profile_id is null
        or reviewed_by_user_profile_id <> assigned_by_user_profile_id
      )
    )
  ),
  constraint platform_role_assignments_terminal_reason_code_ck check (
    terminal_reason_code is null
    or terminal_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint platform_role_assignments_terminal_system_source_ck check (
    terminal_system_source is null
    or terminal_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint platform_role_assignments_lifecycle_shape_ck check (
    (
      assignment_status = 'active'
      and terminal_reason_code is null
      and terminated_by_user_profile_id is null
      and terminal_system_source is null
      and terminated_at is null
      and superseding_assignment_id is null
    )
    or (
      assignment_status in ('revoked', 'expired')
      and valid_until is not null
      and terminal_reason_code is not null
      and terminated_at is not null
      and (terminated_by_user_profile_id is not null) <> (terminal_system_source is not null)
      and superseding_assignment_id is null
    )
    or (
      assignment_status = 'superseded'
      and valid_until is not null
      and terminal_reason_code is not null
      and terminated_at is not null
      and (terminated_by_user_profile_id is not null) <> (terminal_system_source is not null)
      and superseding_assignment_id is not null
    )
  ),
  constraint platform_role_assignments_timestamp_order_ck check (
    assigned_at >= valid_from
    and created_at >= assigned_at
    and updated_at >= created_at
    and (terminated_at is null or terminated_at >= valid_from)
  ),
  constraint platform_role_assignments_user_profile_fk foreign key (user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint platform_role_assignments_assigned_by_fk foreign key (assigned_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint platform_role_assignments_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint platform_role_assignments_terminated_by_fk foreign key (terminated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint platform_role_assignments_superseding_assignment_fk foreign key (superseding_assignment_id)
    references public.platform_role_assignments (id) on delete restrict,
  constraint platform_role_assignments_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint platform_role_assignments_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint platform_role_assignments_user_interval_excl exclude using gist (
    user_profile_id with =,
    tstzrange(valid_from, coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  )
);

comment on table public.platform_role_assignments is
  'Trusted-only empty local platform Owner/Admin assignment history. A row records one temporal platform-role input, not Firebase authentication or email verification, account context, Supplier ownership or membership, organization membership, RLS, access-grant eligibility, or command authorization. No rows, bootstrap, routine, RLS, API/browser grant, mapping, or Firebase integration are created.';
comment on column public.platform_role_assignments.user_profile_id is
  'Required provider-neutral subject profile. This restrictive foreign key is not a Firebase UID, accountType, legacy profile role, Supplier relationship, organization membership, or direct authority decision.';
comment on column public.platform_role_assignments.role_code is
  'Initial platform-role vocabulary is exactly owner or admin. reviewer is a future Claim work assignment and not a platform role.';
comment on column public.platform_role_assignments.assignment_status is
  'Assignment lifecycle is active, revoked, expired, or superseded. A future runtime independently evaluates the half-open validity interval and all current identity, access, security, and command-specific predicates.';
comment on column public.platform_role_assignments.assignment_source_type is
  'Bounded source class only. bootstrap_manifest preserves the later first-Owner exception without fabricating a relational grantor; this empty foundation creates no bootstrap, reconciliation, mapping, or generic source relation.';
comment on column public.platform_role_assignments.assigned_by_user_profile_id is
  'Nullable grantor accountability for non-bootstrap history only. Its presence grants no platform role or command authority.';
comment on column public.platform_role_assignments.reviewed_by_user_profile_id is
  'Optional distinct reviewer accountability. Future Owner and final-Owner controls require separately approved trusted-command eligibility and dual-control checks.';
comment on column public.platform_role_assignments.terminal_reason_code is
  'Write-once terminal provenance boundary for a future trusted role command. This empty foundation implements no revocation, expiry, correction, or supersession workflow.';
comment on column public.platform_role_assignments.superseding_assignment_id is
  'Nullable restrictive successor reference required only for superseded history. It creates no role-change command, precedence, or automatic privilege inheritance.';

create index platform_role_assignments_active_user_lookup_idx
  on public.platform_role_assignments (user_profile_id, valid_from desc, id)
  where assignment_status = 'active';

create index platform_role_assignments_user_status_valid_from_idx
  on public.platform_role_assignments (user_profile_id, assignment_status, valid_from desc, id);

create index platform_role_assignments_role_status_valid_from_idx
  on public.platform_role_assignments (role_code, assignment_status, valid_from desc, id);

revoke all on table public.platform_role_assignments from public, anon, authenticated, service_role;
