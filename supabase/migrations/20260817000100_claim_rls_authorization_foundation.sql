-- B4 ordinary local migration. This file must execute directly as the
-- non-superuser postgres migration actor. Privileged ACL reconciliation and
-- ownership transfer are separate fixed local-bootstrap assets.

begin;

do $assert$
declare
  role_name name;
  expected_roles constant name[] := array[
    'mujahiz_claim_human_command_owner',
    'mujahiz_claim_expiry_command_owner',
    'mujahiz_claim_target_conflict_helper_owner',
    'mujahiz_claim_reviewer_prior_context_helper_owner'
  ]::name[];
begin
  if session_user <> 'postgres' or current_user <> 'postgres'
     or coalesce((select rolsuper from pg_catalog.pg_roles where rolname = current_user), true)
  then
    raise exception using errcode = '42501',
      message = 'B4 ordinary migration requires a direct non-superuser postgres session';
  end if;

  if (select pg_catalog.count(*) from pg_catalog.pg_roles where rolname = any(expected_roles)) <> 4 then
    raise exception 'B4 requires the four clean provisioned owner roles';
  end if;

  foreach role_name in array expected_roles loop
    if exists (
      select 1 from pg_catalog.pg_authid a where a.rolname = role_name and (
        a.rolsuper or a.rolinherit or a.rolcreaterole or a.rolcreatedb
        or a.rolcanlogin or a.rolreplication or a.rolbypassrls
        or a.rolpassword is not null or a.rolvaliduntil is not null
      )
    ) or exists (
      select 1 from pg_catalog.pg_auth_members m
      where m.roleid = (select oid from pg_catalog.pg_roles where rolname = role_name)
         or m.member = (select oid from pg_catalog.pg_roles where rolname = role_name)
    ) then
      raise exception 'unsafe B4 owner role: %', role_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_class c where c.oid = 'public.supplier_ownership_claims'::regclass
      and c.relrowsecurity and c.relforcerowsecurity
  ) or (
    select pg_catalog.count(*) from pg_catalog.pg_policy p
    where p.polrelid = 'public.supplier_ownership_claims'::regclass
  ) <> 3 then
    raise exception 'unexpected pre-B4 Claim RLS or policy inventory';
  end if;
end
$assert$;

create or replace function claim_security.target_supplier_conflict_v1(
  actor_user_profile_id uuid,
  target_supplier_profile_id uuid,
  target_claim_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
  target_claim record;
  matching_count bigint;
  malformed_count bigint;
begin
  if actor_user_profile_id is null
     or target_supplier_profile_id is null
     or target_claim_id is null
  then
    return 'unknown';
  end if;

  if pg_catalog.to_regclass('public.supplier_memberships') is not null
     or pg_catalog.to_regclass('public.organizations') is not null
     or pg_catalog.to_regclass('public.organization_memberships') is not null
  then
    return 'unknown';
  end if;

  select pg_catalog.count(*) into matching_count
  from public.user_profiles as actor_profile
  where actor_profile.id = actor_user_profile_id;
  if matching_count <> 1 then return 'unknown'; end if;

  select pg_catalog.count(*) into matching_count
  from public.supplier_profiles as supplier_profile
  where supplier_profile.id = target_supplier_profile_id;
  if matching_count <> 1 then return 'unknown'; end if;

  select pg_catalog.count(*) into matching_count
  from public.supplier_ownership_claims as claim
  where claim.id = target_claim_id;
  if matching_count <> 1 then return 'unknown'; end if;

  select
    claim.id,
    claim.claimant_user_profile_id,
    claim.supplier_profile_id,
    claim.status,
    claim.submitted_at,
    claim.expires_at,
    claim.reviewer_user_profile_id,
    claim.reviewer_assignment_version,
    claim.reviewer_assigned_at,
    claim.reviewer_assigned_by_user_profile_id,
    claim.reviewer_assignment_source_code,
    claim.reviewer_assignment_policy_version,
    claim.decided_at,
    claim.withdrawn_at,
    claim.expired_at,
    claim.superseded_at,
    claim.resulting_supplier_ownership_id,
    claim.created_at,
    claim.updated_at
  into target_claim
  from public.supplier_ownership_claims as claim
  where claim.id = target_claim_id;

  if target_claim.supplier_profile_id <> target_supplier_profile_id
     or target_claim.status not in ('submitted', 'under_review')
  then
    return 'unknown';
  end if;

  select pg_catalog.count(*) into malformed_count
  from public.supplier_ownerships as ownership
  where ownership.supplier_profile_id = target_supplier_profile_id
    and (
      ownership.authority_type <> 'primary_controller'
      or ownership.ownership_status not in ('active', 'transferred', 'revoked', 'superseded')
      or ownership.valid_until is not null and ownership.valid_until <= ownership.valid_from
      or ownership.updated_at < ownership.created_at
      or (ownership.ownership_status = 'active' and not (
        ownership.valid_until is null and ownership.closure_reason_code is null
        and ownership.closed_by_user_profile_id is null
        and ownership.closure_system_source is null and ownership.closed_at is null
        and ownership.transfer_successor_ownership_id is null
      ))
      or (ownership.ownership_status = 'transferred' and not (
        ownership.valid_until is not null and ownership.closure_reason_code is not null
        and ownership.closed_at is not null
        and (ownership.closed_by_user_profile_id is not null) <>
          (ownership.closure_system_source is not null)
        and ownership.transfer_successor_ownership_id is not null
      ))
      or (ownership.ownership_status in ('revoked', 'superseded') and not (
        ownership.valid_until is not null and ownership.closure_reason_code is not null
        and ownership.closed_at is not null
        and (ownership.closed_by_user_profile_id is not null) <>
          (ownership.closure_system_source is not null)
        and ownership.transfer_successor_ownership_id is null
      ))
    );
  if malformed_count > 0 then return 'unknown'; end if;

  select pg_catalog.count(*) into malformed_count
  from public.supplier_ownerships as ownership
  left join public.supplier_ownerships as successor
    on successor.id = ownership.transfer_successor_ownership_id
  where ownership.supplier_profile_id = target_supplier_profile_id
    and ownership.ownership_status = 'transferred'
    and (successor.id is null
      or successor.supplier_profile_id <> ownership.supplier_profile_id
      or successor.valid_from <> ownership.valid_until);
  if malformed_count > 0 then return 'unknown'; end if;

  select pg_catalog.count(*) into malformed_count
  from public.supplier_ownerships as first_ownership
  join public.supplier_ownerships as second_ownership
    on second_ownership.supplier_profile_id = first_ownership.supplier_profile_id
   and second_ownership.id > first_ownership.id
   and pg_catalog.tstzrange(first_ownership.valid_from,
        coalesce(first_ownership.valid_until, 'infinity'::timestamptz), '[)')
       && pg_catalog.tstzrange(second_ownership.valid_from,
        coalesce(second_ownership.valid_until, 'infinity'::timestamptz), '[)')
  where first_ownership.supplier_profile_id = target_supplier_profile_id;
  if malformed_count > 0 then return 'unknown'; end if;

  select pg_catalog.count(*) into malformed_count
  from public.supplier_ownership_claims as claim
  where claim.supplier_profile_id = target_supplier_profile_id
    and claim.status in ('submitted', 'under_review')
    and (
      claim.expires_at <= claim.submitted_at or claim.updated_at < claim.created_at
      or (claim.status = 'submitted' and not (
        claim.reviewer_user_profile_id is null
        and claim.reviewer_assignment_version is null
        and claim.reviewer_assigned_at is null
        and claim.reviewer_assigned_by_user_profile_id is null
        and claim.reviewer_assignment_source_code is null
        and claim.reviewer_assignment_policy_version is null
        and claim.decided_at is null and claim.withdrawn_at is null
        and claim.expired_at is null and claim.superseded_at is null
        and claim.resulting_supplier_ownership_id is null
      ))
      or (claim.status = 'under_review' and not (
        claim.reviewer_user_profile_id is not null
        and claim.reviewer_assignment_version = 1
        and claim.reviewer_assigned_at is not null
        and claim.reviewer_assigned_by_user_profile_id is not null
        and claim.reviewer_assignment_source_code = 'owner_assignment'
        and claim.reviewer_assignment_policy_version = 'claim_reviewer_assignment_v1'
        and claim.reviewer_user_profile_id <> claim.claimant_user_profile_id
        and claim.reviewer_user_profile_id <> claim.reviewer_assigned_by_user_profile_id
        and claim.reviewer_assigned_at >= claim.submitted_at
        and claim.reviewer_assigned_at < claim.expires_at
        and claim.decided_at is null and claim.withdrawn_at is null
        and claim.expired_at is null and claim.superseded_at is null
        and claim.resulting_supplier_ownership_id is null
      ))
    );
  if malformed_count > 0 then return 'unknown'; end if;

  select pg_catalog.count(*) into malformed_count
  from (
    select claim.claimant_user_profile_id
    from public.supplier_ownership_claims as claim
    where claim.supplier_profile_id = target_supplier_profile_id
      and claim.status in ('submitted', 'under_review')
    group by claim.claimant_user_profile_id
    having pg_catalog.count(*) > 1
  ) as duplicate_active_pair;
  if malformed_count > 0 then return 'unknown'; end if;

  select pg_catalog.count(*) into malformed_count
  from public.supplier_ownership_claims as claim
  left join public.supplier_ownerships as ownership
    on ownership.id = claim.resulting_supplier_ownership_id
  where claim.resulting_supplier_ownership_id is not null
    and (claim.supplier_profile_id = target_supplier_profile_id
      or ownership.supplier_profile_id = target_supplier_profile_id)
    and (claim.status <> 'approved' or ownership.id is null
      or ownership.supplier_profile_id <> claim.supplier_profile_id
      or ownership.controller_user_profile_id <> claim.claimant_user_profile_id
      or ownership.authority_type <> 'primary_controller'
      or ownership.establishment_source_type <> 'claim_approval');
  if malformed_count > 0 then return 'unknown'; end if;

  select pg_catalog.count(*) into matching_count
  from public.supplier_ownerships as ownership
  where ownership.supplier_profile_id = target_supplier_profile_id
    and ownership.authority_type = 'primary_controller'
    and ownership.ownership_status = 'active'
    and ownership.valid_from <= trusted_now
    and (ownership.valid_until is null or trusted_now < ownership.valid_until);
  if matching_count > 1 then return 'unknown'; end if;

  if target_claim.claimant_user_profile_id = actor_user_profile_id then
    return 'conflict';
  end if;

  if exists (
    select 1 from public.supplier_ownerships as ownership
    where ownership.supplier_profile_id = target_supplier_profile_id
      and ownership.controller_user_profile_id = actor_user_profile_id
      and ownership.authority_type = 'primary_controller'
      and ownership.ownership_status = 'active'
      and ownership.valid_from <= trusted_now
      and (ownership.valid_until is null or trusted_now < ownership.valid_until)
  ) then return 'conflict'; end if;

  if exists (
    select 1 from public.supplier_ownership_claims as competing_claim
    where competing_claim.supplier_profile_id = target_supplier_profile_id
      and competing_claim.claimant_user_profile_id = actor_user_profile_id
      and competing_claim.status in ('submitted', 'under_review')
      and competing_claim.id <> target_claim_id
  ) then return 'conflict'; end if;

  return 'clear';
exception when others then
  return 'unknown';
end
$function$;
do $inject$
begin
  if current_setting('mujahiz.claim_b4_failure_point', true) = 'after_helper' then
    raise exception 'injected ordinary B4 failure after helper replacement';
  end if;
end
$inject$;

grant usage on schema public, internal, claim_security, supplier_claim, extensions
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;
grant usage on schema public, claim_security
to mujahiz_claim_target_conflict_helper_owner,
   mujahiz_claim_reviewer_prior_context_helper_owner;

grant select (
  id, claimant_user_profile_id, supplier_profile_id, status, record_version,
  submitted_at, expires_at, submitted_reason, claimant_snapshot_schema_version,
  claimant_snapshot, submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors, reviewer_user_profile_id,
  reviewer_assignment_version, reviewer_assigned_at,
  reviewer_assigned_by_user_profile_id, reviewer_assignment_source_code,
  reviewer_assignment_policy_version, decided_by_user_profile_id, decided_at,
  decision_reason_code, evidence_verification_method_code,
  evidence_verification_version, evidence_verification_outcome_code,
  decision_authorization_policy_version, reviewer_notes, withdrawn_at,
  withdrawn_by_user_profile_id, withdrawal_reason_code, expired_at,
  expiry_system_source_code, expiry_policy_version, superseded_at,
  supersession_reason_code, prior_claim_id, superseded_by_claim_id,
  resulting_supplier_ownership_id, created_at, updated_at
) on public.supplier_ownership_claims
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, supplier_profile_id, controller_user_profile_id, authority_type,
  ownership_status, valid_from, valid_until, record_version,
  establishment_source_type, establishment_reason_code,
  established_by_user_profile_id, establishment_system_source, established_at,
  closure_reason_code, closed_by_user_profile_id, closure_system_source,
  closed_at, transfer_successor_ownership_id, created_at,
  created_by_user_profile_id, updated_at, updated_by_user_profile_id
) on public.supplier_ownerships
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, legacy_firestore_id, name_original, display_name, name_language, name_ar,
  name_en, short_description, business_type, listing_status,
  verification_status, source_type, confidence_level, has_direct_experience,
  last_interaction_year, related_material_service, source_note, created_at,
  created_by_user_profile_id, updated_at, updated_by_user_profile_id
) on public.supplier_profiles
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, legacy_firestore_id, full_name, account_status, account_context,
  preferred_locale, normalized_email, display_email, phone_number, job_title,
  city, legacy_account_type, legacy_role, legacy_organization, legacy_sector,
  verification_mirror_status, verification_mirror_observed_at,
  security_eligibility_reference, suspended_at, suspended_by_user_profile_id,
  suspension_reason, deactivated_at, deactivated_by_user_profile_id,
  deactivation_reason, created_at, created_by_user_profile_id, updated_at,
  updated_by_user_profile_id
) on public.user_profiles
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, legacy_source_identity, action_code, action_contract_version,
  action_class, actor_kind, actor_user_profile_id, actor_source_code,
  actor_authorization_snapshot, target_entity_type, target_id,
  target_external_reference, related_target_entity_type, related_target_id,
  related_target_external_reference, occurred_at, recorded_at,
  source_occurred_at, environment_code, source_system_code,
  producing_component_code, source_operation_class, outcome_class, result_code,
  reason_code, safe_context_schema_version, safe_context, correlation_id,
  causation_type, causation_id, idempotency_reference, domain_event_reference,
  migration_batch_reference, prior_state_code, result_state_code,
  prior_record_version, result_record_version, changed_field_codes,
  evidence_digest, evidence_digest_algorithm, evidence_digest_version,
  restricted_evidence_reference, audit_schema_version,
  action_evidence_schema_version, authorization_policy_version,
  producer_contract_version, minimization_policy_version, retention_class,
  legal_hold_classification, predecessor_audit_log_id, correction_reason_code
) on internal.audit_logs
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, event_type, event_schema_version, aggregate_type, aggregate_id,
  aggregate_sequence, producer_command_name, producer_command_contract_version,
  producer_idempotency_key_id, source_operation_identity, source_system_code,
  source_stream_code, source_event_id, event_ordinal, actor_kind,
  actor_user_profile_id, actor_source_code, environment_code,
  producing_component_code, correlation_id, causation_event_id, occurred_at,
  persisted_at, payload, processing_status, available_at, lease_token_digest,
  lease_digest_key_version, lease_expires_at, attempt_count, next_attempt_at,
  last_error_class, last_error_code, processed_at, dead_lettered_at,
  is_historical, fanout_suppressed, migration_classification_code
) on internal.domain_events
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, command_name, command_contract_version, environment_code, principal_kind,
  principal_user_profile_id, principal_source_code, target_aggregate_type,
  target_aggregate_id, upstream_source_system_code, upstream_request_identity,
  key_digest, key_digest_key_version, request_fingerprint,
  request_fingerprint_key_version, status, lease_token_digest,
  lease_digest_key_version, lease_expires_at, attempt_count, outcome_code,
  result_resource_type, result_resource_id, result_version_token, failure_code,
  retry_disposition, next_attempt_at, created_at, completed_at, failed_at,
  expires_at
) on internal.idempotency_keys
to mujahiz_claim_human_command_owner, mujahiz_claim_expiry_command_owner;

grant select (
  id, user_profile_id, migration_batch_id, provider_code, provider_subject,
  is_primary, link_status, identity_status, verification_status,
  provider_state_observed_at, provider_state_version,
  provider_state_evidence_reference, email_at_link, linked_at,
  linked_by_user_profile_id, verified_at, verification_observed_by_user_profile_id,
  disabled_at, disabled_by_user_profile_id, unlinked_at,
  unlinked_by_user_profile_id, created_at
) on internal.identity_provider_links to mujahiz_claim_human_command_owner;

grant select (id, user_profile_id, role_code, assignment_status, valid_from,
  valid_until, authorization_policy_version)
on public.platform_role_assignments to mujahiz_claim_human_command_owner;
grant select (id, user_profile_id, platform_role_assignment_id, role_code,
  access_purpose, access_status, valid_from, valid_until,
  authorization_policy_version)
on public.access_grants to mujahiz_claim_human_command_owner;
grant select (id, user_profile_id, assessment_scope, assessment_result,
  condition_type, valid_from, valid_until, assessment_status,
  security_policy_version, required_coverage_version,
  evidence_minimization_version)
on internal.security_eligibility_assessments to mujahiz_claim_human_command_owner;

grant insert (
  command_name, command_contract_version, environment_code, principal_kind,
  principal_user_profile_id, target_aggregate_type, target_aggregate_id,
  key_digest, key_digest_key_version, request_fingerprint,
  request_fingerprint_key_version, status, lease_token_digest,
  lease_digest_key_version, lease_expires_at, attempt_count, created_at, expires_at
) on internal.idempotency_keys to mujahiz_claim_human_command_owner;
grant update (id, attempt_count, completed_at, expires_at, failed_at, failure_code,
  lease_digest_key_version, lease_expires_at, lease_token_digest,
  next_attempt_at, outcome_code, result_resource_id, result_resource_type,
  result_version_token, retry_disposition, status)
on internal.idempotency_keys to mujahiz_claim_human_command_owner;
grant insert (
  action_class, action_code, action_contract_version,
  action_evidence_schema_version, actor_authorization_snapshot, actor_kind,
  actor_user_profile_id, audit_schema_version, authorization_policy_version,
  changed_field_codes, correlation_id, domain_event_reference, environment_code,
  evidence_digest, evidence_digest_algorithm, evidence_digest_version, id,
  idempotency_reference, minimization_policy_version, occurred_at, outcome_class,
  prior_record_version, prior_state_code, producer_contract_version,
  producing_component_code, reason_code, recorded_at,
  related_target_entity_type, related_target_id, restricted_evidence_reference,
  result_code, result_record_version, result_state_code, retention_class,
  safe_context, safe_context_schema_version, source_operation_class,
  source_system_code, target_entity_type, target_id
) on internal.audit_logs to mujahiz_claim_human_command_owner;
grant insert (
  actor_kind, actor_user_profile_id, aggregate_id, aggregate_sequence,
  aggregate_type, available_at, correlation_id, environment_code, event_ordinal,
  event_schema_version, event_type, id, occurred_at, payload, persisted_at,
  processing_status, producer_command_contract_version, producer_command_name,
  producer_idempotency_key_id, producing_component_code, source_system_code
) on internal.domain_events to mujahiz_claim_human_command_owner;
grant insert (
  claimant_snapshot, claimant_snapshot_schema_version,
  claimant_user_profile_id, created_at, evidence_descriptors,
  evidence_schema_version, expires_at, id, prior_claim_id, record_version, status,
  submission_fingerprint, submission_fingerprint_version, submitted_at,
  submitted_reason, supplier_profile_id, updated_at
) on public.supplier_ownership_claims to mujahiz_claim_human_command_owner;
grant update (
  id, decided_at, decided_by_user_profile_id,
  decision_authorization_policy_version, decision_reason_code,
  evidence_verification_method_code, evidence_verification_outcome_code,
  evidence_verification_version, record_version, resulting_supplier_ownership_id,
  reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
  reviewer_assignment_policy_version, reviewer_assignment_source_code,
  reviewer_assignment_version, reviewer_notes, reviewer_user_profile_id, status,
  superseded_at, superseded_by_claim_id, supersession_reason_code, updated_at,
  withdrawal_reason_code, withdrawn_at, withdrawn_by_user_profile_id
) on public.supplier_ownership_claims to mujahiz_claim_human_command_owner;
grant insert (
  authority_type, closed_at, closed_by_user_profile_id, closure_reason_code,
  closure_system_source, controller_user_profile_id, created_at,
  created_by_user_profile_id, established_at, established_by_user_profile_id,
  establishment_reason_code, establishment_source_type,
  establishment_system_source, id, ownership_status, record_version,
  supplier_profile_id, transfer_successor_ownership_id, updated_at,
  updated_by_user_profile_id, valid_from, valid_until
) on public.supplier_ownerships to mujahiz_claim_human_command_owner;

grant update (id) on public.user_profiles, public.supplier_profiles,
  public.supplier_ownerships, internal.identity_provider_links,
  public.platform_role_assignments, public.access_grants,
  internal.security_eligibility_assessments
to mujahiz_claim_human_command_owner;

grant insert (
  actor_kind, actor_source_code, aggregate_id, aggregate_sequence, aggregate_type,
  available_at, correlation_id, environment_code, event_ordinal,
  event_schema_version, event_type, id, occurred_at, payload, persisted_at,
  processing_status, producer_command_contract_version, producer_command_name,
  producer_idempotency_key_id, producing_component_code,
  source_operation_identity, source_system_code
) on internal.domain_events to mujahiz_claim_expiry_command_owner;
grant insert (
  attempt_count, command_contract_version, command_name, created_at,
  environment_code, expires_at, key_digest, key_digest_key_version,
  lease_digest_key_version, lease_expires_at, lease_token_digest, principal_kind,
  principal_source_code, request_fingerprint, request_fingerprint_key_version,
  status, target_aggregate_id, target_aggregate_type, upstream_request_identity,
  upstream_source_system_code
) on internal.idempotency_keys to mujahiz_claim_expiry_command_owner;
grant update (
  id, attempt_count, completed_at, failed_at, failure_code,
  lease_digest_key_version, lease_expires_at, lease_token_digest,
  next_attempt_at, outcome_code, result_resource_id, result_resource_type,
  result_version_token, retry_disposition, status
) on internal.idempotency_keys to mujahiz_claim_expiry_command_owner;
grant update (id, expired_at, expiry_policy_version, expiry_system_source_code,
  record_version, status, updated_at)
on public.supplier_ownership_claims to mujahiz_claim_expiry_command_owner;
grant update (id) on public.user_profiles, public.supplier_profiles,
  public.supplier_ownerships to mujahiz_claim_expiry_command_owner;

grant select (
  id, claimant_user_profile_id, supplier_profile_id, status, submitted_at,
  expires_at, reviewer_user_profile_id, reviewer_assignment_version,
  reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
  reviewer_assignment_source_code, reviewer_assignment_policy_version,
  decided_at, withdrawn_at, expired_at, superseded_at,
  resulting_supplier_ownership_id, created_at, updated_at
) on public.supplier_ownership_claims
to mujahiz_claim_target_conflict_helper_owner;
grant select (
  id, supplier_profile_id, controller_user_profile_id, authority_type,
  ownership_status, valid_from, valid_until, establishment_source_type,
  closure_reason_code, closed_by_user_profile_id, closure_system_source,
  closed_at, transfer_successor_ownership_id, created_at, updated_at
) on public.supplier_ownerships to mujahiz_claim_target_conflict_helper_owner;
grant select (id) on public.user_profiles, public.supplier_profiles
to mujahiz_claim_target_conflict_helper_owner;

grant select (id, claimant_user_profile_id, supplier_profile_id, status,
  decision_reason_code, decided_at)
on public.supplier_ownership_claims
to mujahiz_claim_reviewer_prior_context_helper_owner;

grant execute on function
  claim_security.current_claim_user_profile_id(),
  claim_security.claim_principal_lock_key_v1(uuid),
  claim_security.claim_supplier_lock_key_v1(uuid),
  claim_security.target_supplier_conflict_v1(uuid, uuid, uuid),
  supplier_claim._canonicalize_submit_request_v1(text, uuid, text, text, jsonb, uuid),
  supplier_claim._canonicalize_withdraw_request_v1(text, uuid, integer),
  supplier_claim._canonicalize_assign_reviewer_request_v1(text, uuid, integer, uuid),
  supplier_claim._canonicalize_reject_request_v1(text, uuid, integer, integer, text, text, text, text, text),
  supplier_claim._canonicalize_approve_request_v1(text, uuid, integer, integer, text, text, text, text[], text)
to mujahiz_claim_human_command_owner;

grant execute on function
  claim_security.claim_principal_lock_key_v1(uuid),
  claim_security.claim_supplier_lock_key_v1(uuid),
  supplier_claim._assert_expiry_worker_context_v1(),
  supplier_claim._canonicalize_expire_request_v1(text, uuid, integer, timestamptz)
to mujahiz_claim_expiry_command_owner;

create policy supplier_ownership_claims_human_command_select
on public.supplier_ownership_claims for select
to mujahiz_claim_human_command_owner using (true);
create policy supplier_ownership_claims_human_command_insert
on public.supplier_ownership_claims for insert
to mujahiz_claim_human_command_owner with check (true);
create policy supplier_ownership_claims_human_command_update
on public.supplier_ownership_claims for update
to mujahiz_claim_human_command_owner using (true) with check (true);
create policy supplier_ownership_claims_expiry_command_select
on public.supplier_ownership_claims for select
to mujahiz_claim_expiry_command_owner using (true);
create policy supplier_ownership_claims_expiry_command_update
on public.supplier_ownership_claims for update
to mujahiz_claim_expiry_command_owner using (true) with check (true);
create policy supplier_ownership_claims_target_conflict_helper_select
on public.supplier_ownership_claims for select
to mujahiz_claim_target_conflict_helper_owner using (true);
create policy supplier_ownership_claims_reviewer_prior_context_helper_select
on public.supplier_ownership_claims for select
to mujahiz_claim_reviewer_prior_context_helper_owner using (true);
do $inject$
begin
  if current_setting('mujahiz.claim_b4_failure_point', true) = 'after_policies' then
    raise exception 'injected ordinary B4 failure after policy creation';
  end if;
end
$inject$;

do $assert$
declare
  function_source text;
begin
  select p.prosrc into function_source from pg_catalog.pg_proc p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure;
  if function_source ~* '%rowtype' or function_source ~* 'select\s+claim\.\*' then
    raise exception 'target-conflict helper retains an unbounded Claim projection';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class c where c.oid = 'public.supplier_ownership_claims'::regclass
      and c.relrowsecurity and c.relforcerowsecurity
  ) or exists (
    select 1 from pg_catalog.pg_policy p
    where p.polrelid = 'public.supplier_ownership_claims'::regclass and p.polcmd = 'd'
  ) or (
    select pg_catalog.count(*) from pg_catalog.pg_policy p
    where p.polrelid = 'public.supplier_ownership_claims'::regclass and p.polcmd = 'r'
  ) <> 7 or (
    select pg_catalog.count(*) from pg_catalog.pg_policy p
    where p.polrelid = 'public.supplier_ownership_claims'::regclass and p.polcmd = 'a'
  ) <> 1 or (
    select pg_catalog.count(*) from pg_catalog.pg_policy p
    where p.polrelid = 'public.supplier_ownership_claims'::regclass and p.polcmd = 'w'
  ) <> 2 then
    raise exception 'unexpected final ordinary-B4 Claim policy inventory';
  end if;

  if has_schema_privilege('mujahiz_claim_human_command_owner', 'claim_security', 'CREATE')
     or has_schema_privilege('mujahiz_claim_expiry_command_owner', 'supplier_claim', 'CREATE')
     or has_schema_privilege('mujahiz_claim_target_conflict_helper_owner', 'public', 'CREATE')
     or has_schema_privilege('mujahiz_claim_reviewer_prior_context_helper_owner', 'public', 'CREATE')
  then
    raise exception 'B4 owner role acquired schema CREATE';
  end if;
end
$assert$;
do $inject$
begin
  if current_setting('mujahiz.claim_b4_failure_point', true) = 'final_assertion' then
    raise exception 'injected ordinary B4 final assertion failure';
  end if;
end
$inject$;

commit;
