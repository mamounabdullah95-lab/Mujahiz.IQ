-- Twenty-second tracked local SQL migration: empty, fully revoked security-eligibility foundation only.
-- This migration creates no security rows, resolver, RLS, policy, RPC, trigger, trusted
-- command, Firebase integration, bootstrap runtime, hosted operation, or Claim authority.

create table internal.security_eligibility_assessments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_profile_id uuid not null,
  assessment_scope text not null default 'platform_administration',
  assessment_result text not null,
  condition_type text not null,
  valid_from timestamptz not null default pg_catalog.statement_timestamp(),
  valid_until timestamptz,
  assessment_status text not null default 'active',
  record_version integer not null default 1,
  assessment_source_type text not null,
  assessment_reason_code text not null,
  security_policy_version text not null,
  required_coverage_version text not null,
  evidence_minimization_version text not null,
  evidence_reference text not null,
  correlation_reference text,
  assessed_by_user_profile_id uuid,
  reviewed_by_user_profile_id uuid,
  assessment_system_source text,
  assessed_at timestamptz not null default pg_catalog.statement_timestamp(),
  terminal_reason_code text,
  terminated_by_user_profile_id uuid,
  terminal_system_source text,
  terminated_at timestamptz,
  superseding_assessment_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint security_eligibility_assessments_scope_ck check (
    assessment_scope = 'platform_administration'
  ),
  constraint security_eligibility_assessments_result_ck check (
    assessment_result in ('clear', 'deny', 'unknown')
  ),
  constraint security_eligibility_assessments_condition_type_ck check (
    condition_type in (
      'complete_clear', 'explicit_deny', 'security_hold', 'identity_quarantine',
      'reconciliation_required'
    )
  ),
  constraint security_eligibility_assessments_result_condition_ck check (
    (assessment_result = 'clear' and condition_type = 'complete_clear')
    or (
      assessment_result = 'deny'
      and condition_type in ('explicit_deny', 'security_hold', 'identity_quarantine')
    )
    or (assessment_result = 'unknown' and condition_type = 'reconciliation_required')
  ),
  constraint security_eligibility_assessments_status_ck check (
    assessment_status in ('active', 'resolved', 'expired', 'superseded')
  ),
  constraint security_eligibility_assessments_validity_interval_ck check (
    valid_until is null or valid_until > valid_from
  ),
  constraint security_eligibility_assessments_record_version_ck check (
    record_version >= 1
  ),
  constraint security_eligibility_assessments_source_type_ck check (
    assessment_source_type in (
      'bootstrap_manifest', 'security_administration', 'trusted_security_system',
      'legacy_reconciliation', 'correction'
    )
  ),
  constraint security_eligibility_assessments_reason_code_ck check (
    assessment_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint security_eligibility_assessments_security_policy_version_ck check (
    octet_length(security_policy_version) between 1 and 128
  ),
  constraint security_eligibility_assessments_required_coverage_version_ck check (
    octet_length(required_coverage_version) between 1 and 128
  ),
  constraint security_eligibility_assessments_evidence_minimization_version_ck check (
    octet_length(evidence_minimization_version) between 1 and 128
  ),
  constraint security_eligibility_assessments_evidence_reference_ck check (
    octet_length(evidence_reference) between 1 and 256
  ),
  constraint security_eligibility_assessments_correlation_reference_ck check (
    correlation_reference is null
    or octet_length(correlation_reference) between 1 and 256
  ),
  constraint security_eligibility_assessments_system_source_ck check (
    assessment_system_source is null
    or assessment_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint security_eligibility_assessments_provenance_ck check (
    (
      assessment_source_type = 'bootstrap_manifest'
      and assessment_result = 'clear'
      and condition_type = 'complete_clear'
      and assessed_by_user_profile_id is null
      and reviewed_by_user_profile_id is null
      and assessment_system_source is not null
    )
    or (
      assessment_source_type = 'trusted_security_system'
      and assessment_result in ('deny', 'unknown')
      and assessed_by_user_profile_id is null
      and reviewed_by_user_profile_id is null
      and assessment_system_source is not null
    )
    or (
      assessment_source_type in ('security_administration', 'legacy_reconciliation', 'correction')
      and assessed_by_user_profile_id is not null
      and assessment_system_source is null
      and (
        assessment_result <> 'clear'
        or (
          reviewed_by_user_profile_id is not null
          and reviewed_by_user_profile_id <> assessed_by_user_profile_id
          and reviewed_by_user_profile_id <> user_profile_id
          and assessed_by_user_profile_id <> user_profile_id
        )
      )
    )
  ),
  constraint security_eligibility_assessments_reviewer_distinct_ck check (
    reviewed_by_user_profile_id is null
    or (
      reviewed_by_user_profile_id <> user_profile_id
      and (
        assessed_by_user_profile_id is null
        or reviewed_by_user_profile_id <> assessed_by_user_profile_id
      )
    )
  ),
  constraint security_eligibility_assessments_terminal_reason_code_ck check (
    terminal_reason_code is null
    or terminal_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint security_eligibility_assessments_terminal_system_source_ck check (
    terminal_system_source is null
    or terminal_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint security_eligibility_assessments_lifecycle_shape_ck check (
    (
      assessment_status = 'active'
      and terminal_reason_code is null
      and terminated_by_user_profile_id is null
      and terminal_system_source is null
      and terminated_at is null
      and superseding_assessment_id is null
    )
    or (
      assessment_status in ('resolved', 'expired')
      and valid_until is not null
      and terminal_reason_code is not null
      and terminated_at is not null
      and (terminated_by_user_profile_id is not null) <> (terminal_system_source is not null)
      and superseding_assessment_id is null
    )
    or (
      assessment_status = 'superseded'
      and valid_until is not null
      and terminal_reason_code is not null
      and terminated_at is not null
      and (terminated_by_user_profile_id is not null) <> (terminal_system_source is not null)
      and superseding_assessment_id is not null
    )
  ),
  constraint security_eligibility_assessments_timestamp_order_ck check (
    assessed_at >= valid_from
    and created_at >= assessed_at
    and updated_at >= created_at
    and (terminated_at is null or terminated_at >= valid_until)
  ),
  constraint security_eligibility_assessments_user_profile_fk foreign key (user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint security_eligibility_assessments_assessed_by_fk foreign key (assessed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint security_eligibility_assessments_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint security_eligibility_assessments_terminated_by_fk foreign key (terminated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint security_eligibility_assessments_superseding_assessment_fk foreign key (superseding_assessment_id)
    references internal.security_eligibility_assessments (id) on delete restrict,
  constraint security_eligibility_assessments_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint security_eligibility_assessments_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint security_eligibility_assessments_subject_policy_coverage_interval_excl exclude using gist (
    user_profile_id with =,
    assessment_scope with =,
    security_policy_version with =,
    required_coverage_version with =,
    tstzrange(valid_from, coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  )
);

comment on table internal.security_eligibility_assessments is
  'Trusted-only empty local platform-administration security-eligibility assessment history. A row is a restricted provider-neutral current-security input, not Firebase authentication, a platform role, access grant, audit record, event feed, investigation store, target-Supplier conflict result, RLS authorization, or privileged-actor resolver result. No rows, bootstrap, routine, RLS, API/browser grant, mapping, or Firebase integration are created.';
comment on column internal.security_eligibility_assessments.assessment_result is
  'Only the exact clear plus complete_clear combination may later contribute to eligibility. deny and unknown are restrictive results; this foundation implements no resolver.';
comment on column internal.security_eligibility_assessments.assessment_source_type is
  'Bounded source class only. bootstrap_manifest preserves the future protected bootstrap exception; trusted_security_system is structurally restricted to deny or unknown and can never self-clear.';
comment on column internal.security_eligibility_assessments.superseding_assessment_id is
  'Nullable restrictive successor reference required only for superseded history. It creates no security command, correction authority, precedence, automatic release, or authority inheritance.';

create index security_eligibility_assessments_active_subject_lookup_idx
  on internal.security_eligibility_assessments (user_profile_id, valid_from desc, id)
  where assessment_status = 'active';

create index security_eligibility_assessments_subject_status_valid_from_idx
  on internal.security_eligibility_assessments (user_profile_id, assessment_status, valid_from desc, id);

revoke all on table internal.security_eligibility_assessments from public, anon, authenticated, service_role, mujahiz_claim_runtime;
