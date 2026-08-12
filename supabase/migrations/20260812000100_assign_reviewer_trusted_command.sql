-- Twenty-sixth tracked local SQL migration: supplier_claim.assign_reviewer v1 only.
-- This migration adds no table, mutation RLS policy, notification, other Claim
-- command, hosted capability, Firebase integration, real row, or data movement.

create function supplier_claim._canonicalize_assign_reviewer_request_v1(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_reviewer_user_profile_id uuid
)
returns table (
  assigner_user_profile_id uuid,
  key_digest bytea,
  request_fingerprint bytea
)
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $function$
declare
  v_principal_id uuid;
  v_hmac_key text;
  v_canonical_request jsonb;
begin
  v_principal_id := claim_security.current_claim_user_profile_id();
  if v_principal_id is null then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  if p_claim_id is null
     or p_reviewer_user_profile_id is null
     or p_expected_claim_version is null
     or p_expected_claim_version < 1
     or p_idempotency_key is null
     or p_idempotency_key !~ '^claim-([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
  then
    raise exception using errcode = 'P5101', message = 'invalid_request';
  end if;

  v_canonical_request := pg_catalog.jsonb_build_object(
    'claim_id', p_claim_id,
    'expected_claim_version', p_expected_claim_version,
    'reviewer_user_profile_id', p_reviewer_user_profile_id,
    'assignment_policy_version', 'claim_reviewer_assignment_v1'
  );

  key_digest := extensions.hmac(
    pg_catalog.convert_to(
      'claim-idempotency-key-v1|local|supplier_claim.assign_reviewer|1|'
        || pg_catalog.octet_length(p_idempotency_key)::text || ':' || p_idempotency_key,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  request_fingerprint := extensions.hmac(
    pg_catalog.convert_to('claim-request-fingerprint-v1|' || v_canonical_request::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  assigner_user_profile_id := v_principal_id;
  return next;
end
$function$;

comment on function supplier_claim._canonicalize_assign_reviewer_request_v1(text, uuid, integer, uuid) is
  'Private non-callable assign-reviewer-v1 canonicalizer. It derives the trusted assigner and exact key/request HMAC bindings from only the Claim, expected version, candidate, and code-owned assignment policy.';

alter function supplier_claim._canonicalize_assign_reviewer_request_v1(text, uuid, integer, uuid)
  owner to postgres;
revoke all on function supplier_claim._canonicalize_assign_reviewer_request_v1(text, uuid, integer, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;

create function supplier_claim.reserve_assign_reviewer(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_reviewer_user_profile_id uuid
)
returns table (
  reservation_outcome text,
  execution_fence uuid,
  command text,
  command_contract_version integer,
  outcome_code text,
  claim_id uuid,
  claim_status text,
  claim_version integer,
  supplier_profile_id uuid,
  assignment_version integer,
  assigned_at timestamptz,
  reviewer_assigned boolean,
  idempotent_replay boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_request record;
  v_hmac_key text;
  v_fence uuid;
  v_fence_digest bytea;
  v_now timestamptz;
  v_idempotency internal.idempotency_keys%rowtype;
  v_replay_claim public.supplier_ownership_claims%rowtype;
  v_assignment_event internal.domain_events%rowtype;
  v_assignment_audit internal.audit_logs%rowtype;
  v_original_request jsonb;
  v_original_fingerprint bytea;
  v_result_version integer;
  v_event_count integer;
  v_audit_count integer;
  v_new_reservation boolean := false;
begin
  select canonical.* into v_request
  from supplier_claim._canonicalize_assign_reviewer_request_v1(
    p_idempotency_key, p_claim_id, p_expected_claim_version,
    p_reviewer_user_profile_id
  ) as canonical;
  if not found then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;

  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_fence := pg_catalog.gen_random_uuid();
  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-assign-reviewer-fence-v1|' || v_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );

  insert into internal.idempotency_keys (
    command_name, command_contract_version, environment_code,
    principal_kind, principal_user_profile_id,
    target_aggregate_type, target_aggregate_id,
    key_digest, key_digest_key_version,
    request_fingerprint, request_fingerprint_key_version,
    status, lease_token_digest, lease_digest_key_version, lease_expires_at,
    attempt_count, created_at, expires_at
  ) values (
    'supplier_claim.assign_reviewer', 1, 'local',
    'human_user', v_request.assigner_user_profile_id,
    'supplier_ownership_claim', p_claim_id,
    v_request.key_digest, 'local_v1',
    v_request.request_fingerprint, 'local_v1',
    'processing', v_fence_digest, 'local_v1', v_now + interval '60 seconds',
    1, v_now, v_now + interval '720 hours'
  )
  on conflict on constraint idempotency_keys_namespace_uk do nothing
  returning * into v_idempotency;
  v_new_reservation := found;

  if not v_new_reservation then
    select row_value.* into v_idempotency
    from internal.idempotency_keys as row_value
    where row_value.environment_code = 'local'
      and row_value.command_name = 'supplier_claim.assign_reviewer'
      and row_value.command_contract_version = 1
      and row_value.key_digest = v_request.key_digest
    for update;

    if not found then
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;

    if v_idempotency.status = 'completed' then
      if v_idempotency.environment_code <> 'local'
         or v_idempotency.command_name <> 'supplier_claim.assign_reviewer'
         or v_idempotency.command_contract_version <> 1
         or v_idempotency.principal_kind <> 'human_user'
         or v_idempotency.principal_user_profile_id is null
         or v_idempotency.principal_source_code is not null
         or v_idempotency.target_aggregate_type <> 'supplier_ownership_claim'
         or v_idempotency.target_aggregate_id is null
         or v_idempotency.upstream_source_system_code is not null
         or v_idempotency.upstream_request_identity is not null
         or pg_catalog.octet_length(v_idempotency.key_digest) <> 32
         or v_idempotency.key_digest_key_version <> 'local_v1'
         or pg_catalog.octet_length(v_idempotency.request_fingerprint) <> 32
         or v_idempotency.request_fingerprint_key_version <> 'local_v1'
         or v_idempotency.outcome_code <> 'under_review'
         or v_idempotency.result_resource_type <> 'supplier_ownership_claim'
         or v_idempotency.result_resource_id is distinct from v_idempotency.target_aggregate_id
         or v_idempotency.result_version_token !~ '^[1-9][0-9]{0,9}$'
         or v_idempotency.completed_at is null
         or v_idempotency.lease_token_digest is not null
         or v_idempotency.lease_digest_key_version is not null
         or v_idempotency.lease_expires_at is not null
         or v_idempotency.failure_code is not null
         or v_idempotency.retry_disposition is not null
         or v_idempotency.next_attempt_at is not null
         or v_idempotency.failed_at is not null
         or v_idempotency.expires_at <= v_idempotency.completed_at
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      v_result_version := v_idempotency.result_version_token::integer;
      if v_result_version < 2 then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      select claim_row.* into v_replay_claim
      from public.supplier_ownership_claims as claim_row
      where claim_row.id = v_idempotency.result_resource_id;

      if not found
         or v_replay_claim.claimant_user_profile_id is null
         or v_replay_claim.supplier_profile_id is null
         or v_replay_claim.record_version < v_result_version
         or v_replay_claim.status = 'submitted'
         or v_replay_claim.reviewer_user_profile_id is null
         or v_replay_claim.reviewer_assignment_version <> 1
         or v_replay_claim.reviewer_assigned_at is null
         or v_replay_claim.reviewer_assigned_by_user_profile_id <> v_idempotency.principal_user_profile_id
         or v_replay_claim.reviewer_assignment_source_code <> 'owner_assignment'
         or v_replay_claim.reviewer_assignment_policy_version <> 'claim_reviewer_assignment_v1'
         or v_replay_claim.reviewer_assigned_at <> v_idempotency.completed_at
         or v_replay_claim.reviewer_assigned_at < v_replay_claim.submitted_at
         or v_replay_claim.reviewer_assigned_at >= v_replay_claim.expires_at
         or v_replay_claim.expires_at <> v_replay_claim.submitted_at + interval '720 hours'
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      v_original_request := pg_catalog.jsonb_build_object(
        'claim_id', v_idempotency.target_aggregate_id,
        'expected_claim_version', v_result_version - 1,
        'reviewer_user_profile_id', v_replay_claim.reviewer_user_profile_id,
        'assignment_policy_version', 'claim_reviewer_assignment_v1'
      );
      v_original_fingerprint := extensions.hmac(
        pg_catalog.convert_to('claim-request-fingerprint-v1|' || v_original_request::text, 'UTF8'),
        pg_catalog.convert_to(v_hmac_key, 'UTF8'),
        'sha256'
      );
      if v_idempotency.request_fingerprint is distinct from v_original_fingerprint then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      select pg_catalog.count(*) into v_event_count
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id;
      select event_row.* into v_assignment_event
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id
        and event_row.event_ordinal = 1;
      if v_event_count <> 1
         or not found
         or v_assignment_event.event_type is distinct from 'supplier_ownership.claim_under_review'
         or v_assignment_event.event_schema_version is distinct from 1
         or v_assignment_event.aggregate_type is distinct from 'supplier_ownership_claim'
         or v_assignment_event.aggregate_id is distinct from v_replay_claim.id
         or v_assignment_event.aggregate_sequence is distinct from v_result_version
         or v_assignment_event.producer_command_name is distinct from 'supplier_claim.assign_reviewer'
         or v_assignment_event.producer_command_contract_version is distinct from 1
         or v_assignment_event.source_system_code is distinct from 'mujahiz'
         or v_assignment_event.event_ordinal is distinct from 1
         or v_assignment_event.actor_kind is distinct from 'human_user'
         or v_assignment_event.actor_user_profile_id is distinct from v_idempotency.principal_user_profile_id
         or v_assignment_event.environment_code is distinct from 'local'
         or v_assignment_event.producing_component_code is distinct from 'supplier_claim_command'
         or v_assignment_event.occurred_at is distinct from v_replay_claim.reviewer_assigned_at
         or v_assignment_event.persisted_at is distinct from v_replay_claim.reviewer_assigned_at
         or v_assignment_event.available_at is distinct from v_replay_claim.reviewer_assigned_at
         or v_assignment_event.processing_status is distinct from 'pending'
         or v_assignment_event.is_historical
         or v_assignment_event.fanout_suppressed
         or v_assignment_event.payload is distinct from pg_catalog.jsonb_build_object(
           'claim_id', v_replay_claim.id,
           'supplier_profile_id', v_replay_claim.supplier_profile_id,
           'claimant_user_profile_id', v_replay_claim.claimant_user_profile_id,
           'claim_version', v_result_version
         )
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      select pg_catalog.count(*) into v_audit_count
      from internal.audit_logs as audit_row
      where audit_row.idempotency_reference = v_idempotency.id
        and audit_row.source_operation_class <> 'idempotency_conflict';
      select audit_row.* into v_assignment_audit
      from internal.audit_logs as audit_row
      where audit_row.idempotency_reference = v_idempotency.id
        and audit_row.source_operation_class <> 'idempotency_conflict';
      if v_audit_count <> 1
         or not found
         or v_assignment_audit.action_code is distinct from 'supplier_claim.assign_reviewer'
         or v_assignment_audit.action_contract_version is distinct from 1
         or v_assignment_audit.action_class is distinct from 'claim_ownership'
         or v_assignment_audit.actor_kind is distinct from 'human_user'
         or v_assignment_audit.actor_user_profile_id is distinct from v_idempotency.principal_user_profile_id
         or v_assignment_audit.legacy_source_identity is not null
         or v_assignment_audit.actor_source_code is not null
         or v_assignment_audit.actor_authorization_snapshot is distinct from 'owner'
         or v_assignment_audit.target_entity_type is distinct from 'supplier_ownership_claim'
         or v_assignment_audit.target_id is distinct from v_replay_claim.id
         or v_assignment_audit.related_target_id is distinct from v_replay_claim.reviewer_user_profile_id
         or v_assignment_audit.target_external_reference is not null
         or v_assignment_audit.related_target_entity_type is distinct from 'user_profile'
         or v_assignment_audit.prior_state_code is distinct from 'submitted'
         or v_assignment_audit.result_state_code is distinct from 'under_review'
         or v_assignment_audit.related_target_external_reference is not null
         or v_assignment_audit.occurred_at is distinct from v_replay_claim.reviewer_assigned_at
         or v_assignment_audit.recorded_at is distinct from v_replay_claim.reviewer_assigned_at
         or v_assignment_audit.source_occurred_at is not null
         or v_assignment_audit.environment_code is distinct from 'local'
         or v_assignment_audit.source_system_code is distinct from 'mujahiz'
         or v_assignment_audit.producing_component_code is distinct from 'supplier_claim_command'
         or v_assignment_audit.source_operation_class is distinct from 'trusted_command'
         or v_assignment_audit.outcome_class is distinct from 'succeeded'
         or v_assignment_audit.result_code is distinct from 'under_review'
         or v_assignment_audit.reason_code is distinct from 'reviewer_assigned'
         or v_assignment_audit.safe_context_schema_version is distinct from 'claim_assign_reviewer_context_v1'
         or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_assignment_audit.safe_context)) <> 13
         or v_assignment_audit.safe_context ->> 'assignment_version' is distinct from '1'
         or v_assignment_audit.safe_context ->> 'assignment_source_code' is distinct from 'owner_assignment'
         or v_assignment_audit.safe_context ->> 'assignment_policy_version' is distinct from 'claim_reviewer_assignment_v1'
         or v_assignment_audit.safe_context ->> 'assigner_role_code' is distinct from 'owner'
         or (
           v_assignment_audit.safe_context ->> 'reviewer_role_code' is distinct from 'owner'
           and v_assignment_audit.safe_context ->> 'reviewer_role_code' is distinct from 'admin'
         )
         or v_assignment_audit.safe_context ->> 'assigner_conflict_result' is distinct from 'clear'
         or v_assignment_audit.safe_context ->> 'reviewer_conflict_result' is distinct from 'clear'
         or v_assignment_audit.safe_context ->> 'provider_state_version' is distinct from 'firebase-provider-state-v1'
         or v_assignment_audit.safe_context ->> 'role_policy_version' is distinct from 'platform-role-policy-v1'
         or v_assignment_audit.safe_context ->> 'access_policy_version' is distinct from 'platform-access-policy-v1'
         or v_assignment_audit.safe_context ->> 'security_policy_version' is distinct from 'platform-admin-security-v1'
         or v_assignment_audit.safe_context ->> 'security_coverage_version' is distinct from 'platform-admin-coverage-v1'
         or v_assignment_audit.safe_context ->> 'evidence_minimization_version' is distinct from 'platform-admin-minimization-v1'
         or v_assignment_audit.correlation_id is distinct from v_assignment_event.correlation_id
         or v_assignment_audit.causation_type is not null
         or v_assignment_audit.causation_id is not null
         or v_assignment_audit.migration_batch_reference is not null
         or v_assignment_audit.prior_record_version is distinct from v_result_version - 1
         or v_assignment_audit.result_record_version is distinct from v_result_version
         or v_assignment_audit.domain_event_reference is distinct from v_assignment_event.id
         or v_assignment_audit.changed_field_codes is distinct from array[
           'status',
           'record_version',
           'reviewer_user_profile_id',
           'reviewer_assignment_version',
           'reviewer_assigned_at',
           'reviewer_assigned_by_user_profile_id',
           'reviewer_assignment_source_code',
           'reviewer_assignment_policy_version'
         ]::text[]
         or v_assignment_audit.evidence_digest is not null
         or v_assignment_audit.evidence_digest_algorithm is not null
         or v_assignment_audit.evidence_digest_version is not null
         or v_assignment_audit.restricted_evidence_reference is not null
         or v_assignment_audit.audit_schema_version is distinct from 'audit_log_v1'
         or v_assignment_audit.action_evidence_schema_version is distinct from 'claim_assign_reviewer_success_v1'
         or v_assignment_audit.authorization_policy_version is distinct from 'sec-001-claim-v1'
         or v_assignment_audit.producer_contract_version is distinct from 'supplier_claim.assign_reviewer.v1'
         or v_assignment_audit.minimization_policy_version is distinct from 'aud-001-minimized-v1'
         or v_assignment_audit.retention_class is distinct from 'privilege_security_authority'
         or v_assignment_audit.legal_hold_classification is not null
         or v_assignment_audit.predecessor_audit_log_id is not null
         or v_assignment_audit.correction_reason_code is not null
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;
    end if;

    if v_idempotency.principal_kind <> 'human_user'
       or v_idempotency.principal_user_profile_id is distinct from v_request.assigner_user_profile_id
       or v_idempotency.principal_source_code is not null
       or v_idempotency.target_aggregate_type is distinct from 'supplier_ownership_claim'
       or v_idempotency.target_aggregate_id is distinct from p_claim_id
       or v_idempotency.key_digest_key_version <> 'local_v1'
       or v_idempotency.request_fingerprint is distinct from v_request.request_fingerprint
       or v_idempotency.request_fingerprint_key_version <> 'local_v1'
    then
      begin
        insert into internal.audit_logs (
          action_code, action_contract_version, action_class,
          actor_kind, actor_user_profile_id,
          target_entity_type, target_id,
          related_target_entity_type, related_target_id,
          occurred_at, recorded_at, environment_code, source_system_code,
          producing_component_code, source_operation_class,
          outcome_class, result_code, reason_code, correlation_id,
          idempotency_reference, audit_schema_version,
          action_evidence_schema_version, authorization_policy_version,
          producer_contract_version, minimization_policy_version, retention_class
        ) values (
          'supplier_claim.assign_reviewer', 1, 'claim_ownership',
          'human_user', v_request.assigner_user_profile_id,
          'supplier_ownership_claim', p_claim_id,
          'user_profile', p_reviewer_user_profile_id,
          v_now, v_now, 'local', 'mujahiz',
          'supplier_claim_command', 'idempotency_conflict',
          'conflicted', 'idempotency_key_conflict', 'idempotency_key_conflict',
          pg_catalog.gen_random_uuid(), v_idempotency.id,
          'audit_log_v1', 'claim_assign_reviewer_denial_v1',
          'sec-001-claim-v1', 'supplier_claim.assign_reviewer.v1',
          'aud-001-minimized-v1', 'privilege_security_authority'
        );
      exception when others then
        raise exception using errcode = 'P5116', message = 'audit_unavailable';
      end;

      return query select
        'idempotency_key_conflict'::text, null::uuid,
        'supplier_claim.assign_reviewer'::text, 1,
        'idempotency_key_conflict'::text, p_claim_id,
        null::text, null::integer, null::uuid, null::integer,
        null::timestamptz, null::boolean, false;
      return;
    end if;

    if v_idempotency.status = 'completed' then
      return query select
        'replay'::text, null::uuid,
        'supplier_claim.assign_reviewer'::text, 1, 'under_review'::text,
        v_replay_claim.id, 'under_review'::text, v_result_version,
        v_replay_claim.supplier_profile_id, 1,
        v_replay_claim.reviewer_assigned_at, true, true;
      return;
    elsif v_idempotency.status = 'processing' then
      if v_idempotency.lease_expires_at > v_now then
        raise exception using errcode = 'P5109', message = 'command_in_progress';
      end if;
      if v_idempotency.attempt_count >= 10 then
        update internal.idempotency_keys as row_value
        set status = 'failed', lease_token_digest = null,
            lease_digest_key_version = null, lease_expires_at = null,
            failure_code = 'attempt_limit_exceeded', retry_disposition = 'terminal',
            next_attempt_at = null, failed_at = v_now
        where row_value.id = v_idempotency.id;
        return query select
          'reconciliation_required'::text, null::uuid,
          'supplier_claim.assign_reviewer'::text, 1,
          'reconciliation_required'::text, p_claim_id,
          null::text, null::integer, null::uuid, null::integer,
          null::timestamptz, null::boolean, false;
        return;
      end if;
      update internal.idempotency_keys as row_value
      set lease_token_digest = v_fence_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_now + interval '60 seconds',
          attempt_count = row_value.attempt_count + 1
      where row_value.id = v_idempotency.id;
    elsif v_idempotency.status = 'failed' then
      if v_idempotency.retry_disposition = 'terminal' then
        if v_idempotency.failure_code in (
             'actor_not_authorized',
             'reviewer_conflict',
             'integrity_reconciliation_required'
           )
        then
          select pg_catalog.count(*) into v_audit_count
          from internal.audit_logs as audit_row
          where audit_row.idempotency_reference = v_idempotency.id
            and audit_row.source_operation_class <> 'idempotency_conflict';

          select audit_row.* into v_assignment_audit
          from internal.audit_logs as audit_row
          where audit_row.idempotency_reference = v_idempotency.id
            and audit_row.source_operation_class <> 'idempotency_conflict';

          if v_audit_count <> 1
             or not found
             or v_idempotency.lease_token_digest is not null
             or v_idempotency.lease_digest_key_version is not null
             or v_idempotency.lease_expires_at is not null
             or v_idempotency.next_attempt_at is not null
             or v_idempotency.failed_at is null
             or v_idempotency.outcome_code is not null
             or v_idempotency.result_resource_type is not null
             or v_idempotency.result_resource_id is not null
             or v_idempotency.result_version_token is not null
             or v_idempotency.completed_at is not null
             or v_assignment_audit.legacy_source_identity is not null
             or v_assignment_audit.action_code is distinct from 'supplier_claim.assign_reviewer'
             or v_assignment_audit.action_contract_version is distinct from 1
             or v_assignment_audit.action_class is distinct from 'claim_ownership'
             or v_assignment_audit.actor_kind is distinct from 'human_user'
             or v_assignment_audit.actor_user_profile_id is distinct from v_request.assigner_user_profile_id
             or v_assignment_audit.actor_source_code is not null
             or v_assignment_audit.actor_authorization_snapshot is not null
             or v_assignment_audit.target_entity_type is distinct from 'supplier_ownership_claim'
             or v_assignment_audit.target_id is distinct from p_claim_id
             or v_assignment_audit.target_external_reference is not null
             or v_assignment_audit.related_target_entity_type is distinct from 'user_profile'
             or v_assignment_audit.related_target_id is distinct from p_reviewer_user_profile_id
             or v_assignment_audit.related_target_external_reference is not null
             or v_assignment_audit.occurred_at is distinct from v_idempotency.failed_at
             or v_assignment_audit.recorded_at is distinct from v_idempotency.failed_at
             or v_assignment_audit.source_occurred_at is not null
             or v_assignment_audit.environment_code is distinct from 'local'
             or v_assignment_audit.source_system_code is distinct from 'mujahiz'
             or v_assignment_audit.producing_component_code is distinct from 'supplier_claim_command'
             or v_assignment_audit.source_operation_class is distinct from 'trusted_command_denial'
             or v_assignment_audit.outcome_class is distinct from (case v_idempotency.failure_code
               when 'actor_not_authorized' then 'rejected'
               when 'reviewer_conflict' then 'conflicted'
               when 'integrity_reconciliation_required' then 'failed'
               else null
             end)
             or v_assignment_audit.result_code is distinct from v_idempotency.failure_code
             or v_assignment_audit.reason_code is distinct from v_idempotency.failure_code
             or v_assignment_audit.safe_context_schema_version is not null
             or v_assignment_audit.safe_context is not null
             or v_assignment_audit.correlation_id is null
             or v_assignment_audit.causation_type is not null
             or v_assignment_audit.causation_id is not null
             or v_assignment_audit.idempotency_reference is distinct from v_idempotency.id
             or v_assignment_audit.migration_batch_reference is not null
             or v_assignment_audit.prior_state_code is distinct from 'submitted'
             or v_assignment_audit.prior_record_version is distinct from p_expected_claim_version
             or v_assignment_audit.result_state_code is not null
             or v_assignment_audit.result_record_version is not null
             or v_assignment_audit.domain_event_reference is not null
             or v_assignment_audit.changed_field_codes is distinct from '{}'::text[]
             or v_assignment_audit.evidence_digest is not null
             or v_assignment_audit.evidence_digest_algorithm is not null
             or v_assignment_audit.evidence_digest_version is not null
             or v_assignment_audit.restricted_evidence_reference is not null
             or v_assignment_audit.audit_schema_version is distinct from 'audit_log_v1'
             or v_assignment_audit.action_evidence_schema_version is distinct from 'claim_assign_reviewer_denial_v1'
             or v_assignment_audit.authorization_policy_version is distinct from 'sec-001-claim-v1'
             or v_assignment_audit.producer_contract_version is distinct from 'supplier_claim.assign_reviewer.v1'
             or v_assignment_audit.minimization_policy_version is distinct from 'aud-001-minimized-v1'
             or v_assignment_audit.retention_class is distinct from 'privilege_security_authority'
             or v_assignment_audit.legal_hold_classification is not null
             or v_assignment_audit.predecessor_audit_log_id is not null
             or v_assignment_audit.correction_reason_code is not null
          then
            raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
          end if;

          return query select
            'replay'::text, null::uuid,
            'supplier_claim.assign_reviewer'::text, 1,
            v_idempotency.failure_code, p_claim_id,
            null::text, null::integer, null::uuid, null::integer,
            null::timestamptz, false, true;
          return;
        end if;
        return query select
          'reconciliation_required'::text, null::uuid,
          'supplier_claim.assign_reviewer'::text, 1,
          'reconciliation_required'::text, p_claim_id,
          null::text, null::integer, null::uuid, null::integer,
          null::timestamptz, null::boolean, false;
        return;
      end if;
      if v_idempotency.next_attempt_at > v_now then
        raise exception using errcode = 'P5110', message = 'retry_later';
      end if;
      if v_idempotency.attempt_count >= 10 then
        update internal.idempotency_keys as row_value
        set failure_code = 'attempt_limit_exceeded', retry_disposition = 'terminal',
            next_attempt_at = null, failed_at = v_now
        where row_value.id = v_idempotency.id;
        return query select
          'reconciliation_required'::text, null::uuid,
          'supplier_claim.assign_reviewer'::text, 1,
          'reconciliation_required'::text, p_claim_id,
          null::text, null::integer, null::uuid, null::integer,
          null::timestamptz, null::boolean, false;
        return;
      end if;
      update internal.idempotency_keys as row_value
      set status = 'processing', lease_token_digest = v_fence_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_now + interval '60 seconds',
          attempt_count = row_value.attempt_count + 1,
          failure_code = null, retry_disposition = null,
          next_attempt_at = null, failed_at = null
      where row_value.id = v_idempotency.id;
    else
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;
  end if;

  return query select
    'execute'::text, v_fence,
    'supplier_claim.assign_reviewer'::text, 1, null::text,
    p_claim_id, null::text, null::integer, null::uuid, null::integer,
    null::timestamptz, null::boolean, false;
  return;
exception
  when sqlstate 'P5100' or sqlstate 'P5101' or sqlstate 'P5109'
    or sqlstate 'P5110' or sqlstate 'P5116' or sqlstate 'P5199' then raise;
  when others then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
end
$function$;

comment on function supplier_claim.reserve_assign_reviewer(text, uuid, integer, uuid) is
  'Private trusted Phase-A assign-reviewer reservation/replay/reclaim boundary. It commits no Claim mutation, stores only HMAC bindings and a fence, verifies completed Claim/audit/event integrity, and records minimized idempotency conflicts.';

alter function supplier_claim.reserve_assign_reviewer(text, uuid, integer, uuid)
  owner to postgres;
revoke all on function supplier_claim.reserve_assign_reviewer(text, uuid, integer, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim.reserve_assign_reviewer(text, uuid, integer, uuid)
  to mujahiz_claim_runtime;

create function supplier_claim.assign_reviewer(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_reviewer_user_profile_id uuid,
  p_correlation_id uuid,
  p_execution_fence uuid
)
returns table (
  command text,
  command_contract_version integer,
  outcome_code text,
  claim_id uuid,
  claim_status text,
  claim_version integer,
  supplier_profile_id uuid,
  assignment_version integer,
  assigned_at timestamptz,
  reviewer_assigned boolean,
  idempotent_replay boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_request record;
  v_hmac_key text;
  v_fence_digest bytea;
  v_reservation_now timestamptz;
  v_command_now timestamptz;
  v_idempotency internal.idempotency_keys%rowtype;
  v_routed_claimant_id uuid;
  v_routed_supplier_id uuid;
  v_lock_principal_id uuid;
  v_supplier public.supplier_profiles%rowtype;
  v_claim public.supplier_ownership_claims%rowtype;
  v_assigner_decision text;
  v_assigner_role text;
  v_candidate_decision text;
  v_candidate_role text;
  v_assigner_conflict text;
  v_candidate_conflict text;
  v_active_ownership_count integer := 0;
  v_attempt_count integer;
  v_result_version integer;
  v_event_id uuid;
  v_audit_id uuid;
  v_correlation_id uuid;
  v_updated_count integer;
  v_current_role_count integer;
  v_current_access_count integer;
  v_current_security_count integer;
  v_denial_code text;
  v_denial_outcome_class text;
begin
  select canonical.* into v_request
  from supplier_claim._canonicalize_assign_reviewer_request_v1(
    p_idempotency_key,
    p_claim_id,
    p_expected_claim_version,
    p_reviewer_user_profile_id
  ) as canonical;
  if not found or p_execution_fence is null then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_hmac_key := nullif(
    pg_catalog.current_setting('mujahiz.claim.hmac_key', true),
    ''
  );
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to(
      'claim-assign-reviewer-fence-v1|' || p_execution_fence::text,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  v_reservation_now := pg_catalog.clock_timestamp();

  select row_value.* into v_idempotency
  from internal.idempotency_keys as row_value
  where row_value.environment_code = 'local'
    and row_value.command_name = 'supplier_claim.assign_reviewer'
    and row_value.command_contract_version = 1
    and row_value.key_digest = v_request.key_digest
  for update;

  if not found then
    raise exception using errcode = 'P5110', message = 'retry_later';
  end if;
  if v_idempotency.principal_kind <> 'human_user'
     or v_idempotency.principal_user_profile_id is distinct from
       v_request.assigner_user_profile_id
     or v_idempotency.principal_source_code is not null
     or v_idempotency.target_aggregate_type is distinct from
       'supplier_ownership_claim'
     or v_idempotency.target_aggregate_id is distinct from p_claim_id
     or v_idempotency.key_digest_key_version <> 'local_v1'
     or v_idempotency.request_fingerprint is distinct from
       v_request.request_fingerprint
     or v_idempotency.request_fingerprint_key_version <> 'local_v1'
  then
    raise exception using errcode = 'P5108', message = 'idempotency_key_conflict';
  end if;
  if v_idempotency.status = 'failed'
     and v_idempotency.retry_disposition = 'terminal'
  then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;
  if v_idempotency.status <> 'processing'
     or v_idempotency.lease_expires_at <= v_reservation_now
  then
    raise exception using errcode = 'P5110', message = 'retry_later';
  end if;
  if v_idempotency.lease_digest_key_version <> 'local_v1'
     or v_idempotency.lease_token_digest is distinct from v_fence_digest
  then
    raise exception using errcode = 'P5109', message = 'command_in_progress';
  end if;
  v_attempt_count := v_idempotency.attempt_count;

  select
    claim_row.claimant_user_profile_id,
    claim_row.supplier_profile_id
  into
    v_routed_claimant_id,
    v_routed_supplier_id
  from public.supplier_ownership_claims as claim_row
  where claim_row.id = p_claim_id;

  if not found then
    raise exception using errcode = 'P5111', message = 'claim_not_found';
  end if;

  for v_lock_principal_id in
    select lock_principal.principal_id
    from (
      values
        (v_request.assigner_user_profile_id),
        (p_reviewer_user_profile_id),
        (v_routed_claimant_id)
    ) as lock_principal(principal_id)
    where lock_principal.principal_id is not null
    group by lock_principal.principal_id
    order by lock_principal.principal_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      claim_security.claim_principal_lock_key_v1(v_lock_principal_id)
    );
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    claim_security.claim_supplier_lock_key_v1(v_routed_supplier_id)
  );

  perform 1
  from public.user_profiles as row_value
  where row_value.id in (
    v_request.assigner_user_profile_id,
    p_reviewer_user_profile_id,
    v_routed_claimant_id
  )
  order by row_value.id
  for update;

  perform 1
  from internal.identity_provider_links as row_value
  where row_value.user_profile_id in (
    v_request.assigner_user_profile_id,
    p_reviewer_user_profile_id,
    v_routed_claimant_id
  )
  order by row_value.id
  for update;

  perform 1
  from public.platform_role_assignments as row_value
  where row_value.user_profile_id in (
    v_request.assigner_user_profile_id,
    p_reviewer_user_profile_id,
    v_routed_claimant_id
  )
  order by row_value.id
  for update;

  perform 1
  from public.access_grants as row_value
  where row_value.user_profile_id in (
    v_request.assigner_user_profile_id,
    p_reviewer_user_profile_id,
    v_routed_claimant_id
  )
  order by row_value.id
  for update;

  perform 1
  from internal.security_eligibility_assessments as row_value
  where row_value.user_profile_id in (
    v_request.assigner_user_profile_id,
    p_reviewer_user_profile_id,
    v_routed_claimant_id
  )
  order by row_value.id
  for update;

  select supplier_row.* into v_supplier
  from public.supplier_profiles as supplier_row
  where supplier_row.id = v_routed_supplier_id
  for update;
  if not found then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  perform 1
  from public.supplier_ownerships as ownership_row
  where ownership_row.supplier_profile_id = v_routed_supplier_id
  order by ownership_row.id
  for update;

  select claim_row.* into v_claim
  from public.supplier_ownership_claims as claim_row
  where claim_row.id = p_claim_id
  for update;
  if not found
     or v_claim.claimant_user_profile_id <> v_routed_claimant_id
     or v_claim.supplier_profile_id <> v_routed_supplier_id
  then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  v_command_now := pg_catalog.clock_timestamp();

  if v_claim.record_version <> p_expected_claim_version then
    raise exception using errcode = 'P5112', message = 'claim_version_conflict';
  end if;

  if v_claim.status <> 'submitted' then
    if v_claim.reviewer_user_profile_id is not null then
      raise exception using
        errcode = 'P5115',
        message = 'reviewer_already_assigned';
    end if;
    raise exception using errcode = 'P5113', message = 'claim_not_actionable';
  end if;

  if v_claim.reviewer_user_profile_id is not null
     or v_claim.reviewer_assignment_version is not null
     or v_claim.reviewer_assigned_at is not null
     or v_claim.reviewer_assigned_by_user_profile_id is not null
     or v_claim.reviewer_assignment_source_code is not null
     or v_claim.reviewer_assignment_policy_version is not null
     or v_claim.record_version <> 1
     or v_claim.expires_at <> v_claim.submitted_at + interval '720 hours'
     or v_claim.created_at <> v_claim.submitted_at
     or v_claim.updated_at <> v_claim.submitted_at
     or v_claim.claimant_snapshot_schema_version <> 'claimant_snapshot_v1'
     or v_claim.submission_fingerprint_version <> 'claim_submit_v1'
     or v_claim.submission_fingerprint !~ '^[0-9a-f]{64}$'
     or v_claim.evidence_schema_version <> 'claim_evidence_v1'
     or v_claim.decided_by_user_profile_id is not null
     or v_claim.decided_at is not null
     or v_claim.decision_reason_code is not null
     or v_claim.evidence_verification_method_code is not null
     or v_claim.evidence_verification_version is not null
     or v_claim.evidence_verification_outcome_code is not null
     or v_claim.decision_authorization_policy_version is not null
     or v_claim.reviewer_notes is not null
     or v_claim.withdrawn_at is not null
     or v_claim.withdrawn_by_user_profile_id is not null
     or v_claim.withdrawal_reason_code is not null
     or v_claim.expired_at is not null
     or v_claim.expiry_system_source_code is not null
     or v_claim.expiry_policy_version is not null
     or v_claim.superseded_at is not null
     or v_claim.supersession_reason_code is not null
     or v_claim.superseded_by_claim_id is not null
     or v_claim.resulting_supplier_ownership_id is not null
  then
    v_denial_code := 'integrity_reconciliation_required';
    v_denial_outcome_class := 'failed';
  elsif v_command_now >= v_claim.expires_at then
    raise exception using errcode = 'P5114', message = 'claim_expired';
  elsif v_supplier.listing_status <> 'approved'
        or v_supplier.verification_status = 'watchlist'
  then
    raise exception using errcode = 'P5113', message = 'claim_not_actionable';
  end if;

  select pg_catalog.count(*) into v_active_ownership_count
  from public.supplier_ownerships as ownership_row
  where ownership_row.supplier_profile_id = v_routed_supplier_id
    and ownership_row.authority_type = 'primary_controller'
    and ownership_row.ownership_status = 'active'
    and ownership_row.valid_from <= v_command_now
    and (
      ownership_row.valid_until is null
      or v_command_now < ownership_row.valid_until
    );

  if v_denial_code is null and v_active_ownership_count > 1 then
    v_denial_code := 'integrity_reconciliation_required';
    v_denial_outcome_class := 'failed';
  elsif v_denial_code is null and v_active_ownership_count = 1 then
    raise exception using errcode = 'P5113', message = 'claim_not_actionable';
  end if;


  if v_denial_code is null then
    select evaluator.decision, evaluator.role_code
    into v_assigner_decision, v_assigner_role
    from claim_security.current_privileged_actor_v1() as evaluator;

    select evaluator.decision, evaluator.role_code
    into v_candidate_decision, v_candidate_role
    from claim_security.privileged_actor_for_profile_v1(
      p_reviewer_user_profile_id
    ) as evaluator;

    if v_assigner_decision is distinct from 'eligible' or v_assigner_role is distinct from 'owner' then
      v_denial_code := 'actor_not_authorized';
      v_denial_outcome_class := 'rejected';
    elsif v_candidate_decision is distinct from 'eligible'
          or v_candidate_role not in ('owner', 'admin')
    then
      v_denial_code := 'reviewer_conflict';
      v_denial_outcome_class := 'conflicted';
    end if;
  end if;

  if v_denial_code is null then
    select pg_catalog.count(*) into v_current_role_count
    from public.platform_role_assignments as role_row
    where role_row.user_profile_id in (
        v_request.assigner_user_profile_id,
        p_reviewer_user_profile_id
      )
      and role_row.assignment_status = 'active'
      and role_row.authorization_policy_version = 'platform-role-policy-v1'
      and role_row.valid_from <= v_command_now
      and (
        role_row.valid_until is null
        or v_command_now < role_row.valid_until
      );

    select pg_catalog.count(*) into v_current_access_count
    from public.access_grants as access_row
    join public.platform_role_assignments as role_row
      on role_row.id = access_row.platform_role_assignment_id
     and role_row.user_profile_id = access_row.user_profile_id
     and role_row.role_code = access_row.role_code
    where access_row.user_profile_id in (
        v_request.assigner_user_profile_id,
        p_reviewer_user_profile_id
      )
      and access_row.access_status = 'active'
      and access_row.access_purpose = 'platform_administration'
      and access_row.authorization_policy_version =
        'platform-access-policy-v1'
      and access_row.valid_from <= v_command_now
      and (
        access_row.valid_until is null
        or v_command_now < access_row.valid_until
      )
      and role_row.assignment_status = 'active'
      and role_row.authorization_policy_version = 'platform-role-policy-v1'
      and role_row.valid_from <= v_command_now
      and (
        role_row.valid_until is null
        or v_command_now < role_row.valid_until
      );

    select pg_catalog.count(*) into v_current_security_count
    from internal.security_eligibility_assessments as security_row
    where security_row.user_profile_id in (
        v_request.assigner_user_profile_id,
        p_reviewer_user_profile_id
      )
      and security_row.assessment_scope = 'platform_administration'
      and security_row.assessment_status = 'active'
      and security_row.assessment_result = 'clear'
      and security_row.condition_type = 'complete_clear'
      and security_row.security_policy_version =
        'platform-admin-security-v1'
      and security_row.required_coverage_version =
        'platform-admin-coverage-v1'
      and security_row.evidence_minimization_version =
        'platform-admin-minimization-v1'
      and security_row.valid_from <= v_command_now
      and (
        security_row.valid_until is null
        or v_command_now < security_row.valid_until
      );

    if v_current_role_count <> (
         case when v_request.assigner_user_profile_id = p_reviewer_user_profile_id then 1 else 2 end
       )
       or v_current_access_count <> (
         case when v_request.assigner_user_profile_id = p_reviewer_user_profile_id then 1 else 2 end
       )
       or v_current_security_count <> (
         case when v_request.assigner_user_profile_id = p_reviewer_user_profile_id then 1 else 2 end
       )
    then
      v_denial_code := 'actor_not_authorized';
      v_denial_outcome_class := 'rejected';
    end if;
  end if;

  if v_denial_code is null then
    v_assigner_conflict := claim_security.target_supplier_conflict_v1(
      v_request.assigner_user_profile_id,
      v_routed_supplier_id,
      p_claim_id
    );
    v_candidate_conflict := claim_security.target_supplier_conflict_v1(
      p_reviewer_user_profile_id,
      v_routed_supplier_id,
      p_claim_id
    );

    if v_assigner_conflict is distinct from 'clear' then
      v_denial_code := 'actor_not_authorized';
      v_denial_outcome_class := 'rejected';
    elsif v_candidate_conflict is distinct from 'clear' then
      v_denial_code := 'reviewer_conflict';
      v_denial_outcome_class := 'conflicted';
    elsif v_request.assigner_user_profile_id = p_reviewer_user_profile_id
          or p_reviewer_user_profile_id = v_claim.claimant_user_profile_id
    then
      v_denial_code := 'reviewer_conflict';
      v_denial_outcome_class := 'conflicted';
    end if;
  end if;

  v_correlation_id := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());

  if v_denial_code is not null then
    begin
      insert into internal.audit_logs (
        action_code,
        action_contract_version,
        action_class,
        actor_kind,
        actor_user_profile_id,
        target_entity_type,
        target_id,
        related_target_entity_type,
        related_target_id,
        occurred_at,
        recorded_at,
        environment_code,
        source_system_code,
        producing_component_code,
        source_operation_class,
        outcome_class,
        result_code,
        reason_code,
        correlation_id,
        idempotency_reference,
        prior_state_code,
        prior_record_version,
        audit_schema_version,
        action_evidence_schema_version,
        authorization_policy_version,
        producer_contract_version,
        minimization_policy_version,
        retention_class
      ) values (
        'supplier_claim.assign_reviewer',
        1,
        'claim_ownership',
        'human_user',
        v_request.assigner_user_profile_id,
        'supplier_ownership_claim',
        p_claim_id,
        'user_profile',
        p_reviewer_user_profile_id,
        v_command_now,
        v_command_now,
        'local',
        'mujahiz',
        'supplier_claim_command',
        'trusted_command_denial',
        v_denial_outcome_class,
        v_denial_code,
        v_denial_code,
        v_correlation_id,
        v_idempotency.id,
        'submitted',
        v_claim.record_version,
        'audit_log_v1',
        'claim_assign_reviewer_denial_v1',
        'sec-001-claim-v1',
        'supplier_claim.assign_reviewer.v1',
        'aud-001-minimized-v1',
        'privilege_security_authority'
      );
    exception
      when others then
        raise exception using errcode = 'P5116', message = 'audit_unavailable';
    end;

    update internal.idempotency_keys as row_value
    set status = 'failed',
        lease_token_digest = null,
        lease_digest_key_version = null,
        lease_expires_at = null,
        failure_code = v_denial_code,
        retry_disposition = 'terminal',
        next_attempt_at = null,
        failed_at = v_command_now
    where row_value.id = v_idempotency.id
      and row_value.status = 'processing'
      and row_value.attempt_count = v_attempt_count
      and row_value.lease_token_digest = v_fence_digest;

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P5199',
        message = 'integrity_reconciliation_required';
    end if;

    return query
    select
      'supplier_claim.assign_reviewer'::text,
      1,
      v_denial_code,
      p_claim_id,
      null::text,
      null::integer,
      null::uuid,
      null::integer,
      null::timestamptz,
      false,
      false;
    return;
  end if;

  v_result_version := v_claim.record_version + 1;
  v_event_id := pg_catalog.gen_random_uuid();
  v_audit_id := pg_catalog.gen_random_uuid();

  update public.supplier_ownership_claims as claim_row
  set status = 'under_review',
      record_version = v_result_version,
      reviewer_user_profile_id = p_reviewer_user_profile_id,
      reviewer_assignment_version = 1,
      reviewer_assigned_at = v_command_now,
      reviewer_assigned_by_user_profile_id =
        v_request.assigner_user_profile_id,
      reviewer_assignment_source_code = 'owner_assignment',
      reviewer_assignment_policy_version = 'claim_reviewer_assignment_v1',
      updated_at = v_command_now
  where claim_row.id = p_claim_id
    and claim_row.record_version = p_expected_claim_version
    and claim_row.status = 'submitted'
    and claim_row.reviewer_user_profile_id is null
    and claim_row.reviewer_assignment_version is null
    and claim_row.reviewer_assigned_at is null
    and claim_row.reviewer_assigned_by_user_profile_id is null
    and claim_row.reviewer_assignment_source_code is null
    and claim_row.reviewer_assignment_policy_version is null;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  insert into internal.domain_events (
    id,
    event_type,
    event_schema_version,
    aggregate_type,
    aggregate_id,
    aggregate_sequence,
    producer_command_name,
    producer_command_contract_version,
    producer_idempotency_key_id,
    source_system_code,
    event_ordinal,
    actor_kind,
    actor_user_profile_id,
    environment_code,
    producing_component_code,
    correlation_id,
    occurred_at,
    persisted_at,
    payload,
    processing_status,
    available_at
  ) values (
    v_event_id,
    'supplier_ownership.claim_under_review',
    1,
    'supplier_ownership_claim',
    p_claim_id,
    v_result_version,
    'supplier_claim.assign_reviewer',
    1,
    v_idempotency.id,
    'mujahiz',
    1,
    'human_user',
    v_request.assigner_user_profile_id,
    'local',
    'supplier_claim_command',
    v_correlation_id,
    v_command_now,
    v_command_now,
    pg_catalog.jsonb_build_object(
      'claim_id', p_claim_id,
      'supplier_profile_id', v_claim.supplier_profile_id,
      'claimant_user_profile_id', v_claim.claimant_user_profile_id,
      'claim_version', v_result_version
    ),
    'pending',
    v_command_now
  );

  begin
    insert into internal.audit_logs (
      id,
      action_code,
      action_contract_version,
      action_class,
      actor_kind,
      actor_user_profile_id,
      actor_authorization_snapshot,
      target_entity_type,
      target_id,
      related_target_entity_type,
      related_target_id,
      occurred_at,
      recorded_at,
      environment_code,
      source_system_code,
      producing_component_code,
      source_operation_class,
      outcome_class,
      result_code,
      reason_code,
      safe_context_schema_version,
      safe_context,
      correlation_id,
      idempotency_reference,
      domain_event_reference,
      prior_state_code,
      result_state_code,
      prior_record_version,
      result_record_version,
      changed_field_codes,
      audit_schema_version,
      action_evidence_schema_version,
      authorization_policy_version,
      producer_contract_version,
      minimization_policy_version,
      retention_class
    ) values (
      v_audit_id,
      'supplier_claim.assign_reviewer',
      1,
      'claim_ownership',
      'human_user',
      v_request.assigner_user_profile_id,
      'owner',
      'supplier_ownership_claim',
      p_claim_id,
      'user_profile',
      p_reviewer_user_profile_id,
      v_command_now,
      v_command_now,
      'local',
      'mujahiz',
      'supplier_claim_command',
      'trusted_command',
      'succeeded',
      'under_review',
      'reviewer_assigned',
      'claim_assign_reviewer_context_v1',
      pg_catalog.jsonb_build_object(
        'assignment_version', 1,
        'assignment_source_code', 'owner_assignment',
        'assignment_policy_version', 'claim_reviewer_assignment_v1',
        'assigner_role_code', v_assigner_role,
        'reviewer_role_code', v_candidate_role,
        'assigner_conflict_result', v_assigner_conflict,
        'reviewer_conflict_result', v_candidate_conflict,
        'provider_state_version', 'firebase-provider-state-v1',
        'role_policy_version', 'platform-role-policy-v1',
        'access_policy_version', 'platform-access-policy-v1',
        'security_policy_version', 'platform-admin-security-v1',
        'security_coverage_version', 'platform-admin-coverage-v1',
        'evidence_minimization_version', 'platform-admin-minimization-v1'
      ),
      v_correlation_id,
      v_idempotency.id,
      v_event_id,
      'submitted',
      'under_review',
      v_claim.record_version,
      v_result_version,
      array[
        'status',
        'record_version',
        'reviewer_user_profile_id',
        'reviewer_assignment_version',
        'reviewer_assigned_at',
        'reviewer_assigned_by_user_profile_id',
        'reviewer_assignment_source_code',
        'reviewer_assignment_policy_version'
      ]::text[],
      'audit_log_v1',
      'claim_assign_reviewer_success_v1',
      'sec-001-claim-v1',
      'supplier_claim.assign_reviewer.v1',
      'aud-001-minimized-v1',
      'privilege_security_authority'
    );
  exception
    when others then
      raise exception using errcode = 'P5116', message = 'audit_unavailable';
  end;

  update internal.idempotency_keys as row_value
  set status = 'completed',
      lease_token_digest = null,
      lease_digest_key_version = null,
      lease_expires_at = null,
      outcome_code = 'under_review',
      result_resource_type = 'supplier_ownership_claim',
      result_resource_id = p_claim_id,
      result_version_token = v_result_version::text,
      completed_at = v_command_now
  where row_value.id = v_idempotency.id
    and row_value.status = 'processing'
    and row_value.attempt_count = v_attempt_count
    and row_value.lease_token_digest = v_fence_digest;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  return query
  select
    'supplier_claim.assign_reviewer'::text,
    1,
    'under_review'::text,
    p_claim_id,
    'under_review'::text,
    v_result_version,
    v_claim.supplier_profile_id,
    1,
    v_command_now,
    true,
    false;
  return;
exception
  when sqlstate 'P5100'
    or sqlstate 'P5101'
    or sqlstate 'P5102'
    or sqlstate 'P5106'
    or sqlstate 'P5108'
    or sqlstate 'P5109'
    or sqlstate 'P5110'
    or sqlstate 'P5111'
    or sqlstate 'P5112'
    or sqlstate 'P5113'
    or sqlstate 'P5114'
    or sqlstate 'P5115'
    or sqlstate 'P5116'
    or sqlstate 'P5199'
  then
    raise;
  when others then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
end
$function$;

comment on function supplier_claim.assign_reviewer(text, uuid, integer, uuid, uuid, uuid) is
  'Local trusted supplier_claim.assign_reviewer v1 Phase-B executor. It requires the exact committed Phase-A fence, re-reads all authority and target facts under the shared locks, writes one immutable assignment plus required audit/event, and completes idempotency atomically.';

alter function supplier_claim.assign_reviewer(text, uuid, integer, uuid, uuid, uuid)
  owner to postgres;
revoke all on function supplier_claim.assign_reviewer(text, uuid, integer, uuid, uuid, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim.assign_reviewer(text, uuid, integer, uuid, uuid, uuid)
  to mujahiz_claim_runtime;

-- The local SECURITY DEFINER owner needs the private candidate evaluator. Have
-- the isolated function owner issue that exact grant, then remove the temporary
-- role membership; runtime and every browser/API/service role remain denied.
grant mujahiz_claim_owner_projection to postgres with set true;
set role mujahiz_claim_owner_projection;
grant execute on function claim_security.privileged_actor_for_profile_v1(uuid)
  to postgres;
reset role;
revoke mujahiz_claim_owner_projection from postgres;
