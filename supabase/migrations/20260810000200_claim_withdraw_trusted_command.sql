-- Twentieth local SQL slice: supplier_claim.withdraw v1 only.
-- This migration adds no table, other Claim command, mutation RLS policy,
-- notification, hosted capability, Firebase integration, real row, or data movement.
-- The 60-second lease, 10-attempt cap, and 720-hour replay retention below are
-- provisional local protocol parameters only, not final hosted operations policy.

create function supplier_claim._canonicalize_withdraw_request_v1(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer
)
returns table (
  claimant_user_profile_id uuid,
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
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
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
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
  end if;

  if p_claim_id is null
     or p_expected_claim_version is null
     or p_expected_claim_version < 1
     or p_idempotency_key is null
     or p_idempotency_key !~ '^claim-([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
  then
    raise exception using
      errcode = 'P5101',
      message = 'invalid_request';
  end if;

  v_canonical_request := pg_catalog.jsonb_build_object(
    'claim_id', p_claim_id,
    'command_precondition_version', 'claim_withdraw_preconditions_v1',
    'expected_claim_version', p_expected_claim_version,
    'withdrawal_policy_version', 'claim_withdrawal_v1'
  );

  key_digest := extensions.hmac(
    pg_catalog.convert_to(
      'claim-idempotency-key-v1|local|supplier_claim.withdraw|1|'
        || pg_catalog.octet_length(p_idempotency_key)::text
        || ':' || p_idempotency_key,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  request_fingerprint := extensions.hmac(
    pg_catalog.convert_to(
      'claim-request-fingerprint-v1|' || v_canonical_request::text,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  claimant_user_profile_id := v_principal_id;
  return next;
end
$function$;

comment on function supplier_claim._canonicalize_withdraw_request_v1(text, uuid, integer) is
  'Private non-callable withdraw-v1 canonicalizer. It derives the trusted claimant and versioned HMAC bindings from only the key, Claim target, and expected version; correlation and server-derived lifecycle values are excluded.';

alter function supplier_claim._canonicalize_withdraw_request_v1(text, uuid, integer)
  owner to postgres;

revoke all on function supplier_claim._canonicalize_withdraw_request_v1(text, uuid, integer)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;

create function supplier_claim.reserve_withdraw(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer
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
  withdrawn_at timestamptz,
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
  v_withdraw_event internal.domain_events%rowtype;
  v_new_reservation boolean := false;
  v_event_count integer := 0;
  v_withdraw_event_count integer := 0;
  v_result_version integer;
  v_original_expected_version integer;
  v_original_canonical_request jsonb;
  v_original_request_fingerprint bytea;
begin
  select canonical.*
  into v_request
  from supplier_claim._canonicalize_withdraw_request_v1(
    p_idempotency_key,
    p_claim_id,
    p_expected_claim_version
  ) as canonical;

  if not found then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
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
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_fence := pg_catalog.gen_random_uuid();
  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-withdraw-fence-v1|' || v_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );

  insert into internal.idempotency_keys (
    command_name,
    command_contract_version,
    environment_code,
    principal_kind,
    principal_user_profile_id,
    target_aggregate_type,
    target_aggregate_id,
    key_digest,
    key_digest_key_version,
    request_fingerprint,
    request_fingerprint_key_version,
    status,
    lease_token_digest,
    lease_digest_key_version,
    lease_expires_at,
    attempt_count,
    created_at,
    expires_at
  ) values (
    'supplier_claim.withdraw',
    1,
    'local',
    'human_user',
    v_request.claimant_user_profile_id,
    'supplier_ownership_claim',
    p_claim_id,
    v_request.key_digest,
    'local_v1',
    v_request.request_fingerprint,
    'local_v1',
    'processing',
    v_fence_digest,
    'local_v1',
    v_now + interval '60 seconds',
    1,
    v_now,
    v_now + interval '720 hours'
  )
  on conflict on constraint idempotency_keys_namespace_uk do nothing
  returning * into v_idempotency;
  v_new_reservation := found;

  if not v_new_reservation then
    select idempotency_row.*
    into v_idempotency
    from internal.idempotency_keys as idempotency_row
    where idempotency_row.environment_code = 'local'
      and idempotency_row.command_name = 'supplier_claim.withdraw'
      and idempotency_row.command_contract_version = 1
      and idempotency_row.key_digest = v_request.key_digest
    for update;

    if not found then
      raise exception using
        errcode = 'P5199',
        message = 'integrity_reconciliation_required';
    end if;

    -- A completed row is an authoritative stored fact. Prove that fact from
    -- its own principal/target/result/Claim/event bindings before comparing it
    -- with the current caller request and classifying any genuine key reuse.
    if v_idempotency.status = 'completed' then
      if v_idempotency.environment_code <> 'local'
         or v_idempotency.command_name <> 'supplier_claim.withdraw'
         or v_idempotency.command_contract_version <> 1
         or v_idempotency.principal_kind <> 'human_user'
         or v_idempotency.principal_user_profile_id is null
         or v_idempotency.principal_source_code is not null
         or v_idempotency.target_aggregate_type <> 'supplier_ownership_claim'
         or v_idempotency.target_aggregate_id is null
         or v_idempotency.upstream_source_system_code is not null
         or v_idempotency.upstream_request_identity is not null
         or v_idempotency.key_digest is null
         or pg_catalog.octet_length(v_idempotency.key_digest) <> 32
         or v_idempotency.key_digest_key_version <> 'local_v1'
         or v_idempotency.request_fingerprint is null
         or pg_catalog.octet_length(v_idempotency.request_fingerprint) <> 32
         or v_idempotency.request_fingerprint_key_version <> 'local_v1'
         or v_idempotency.outcome_code <> 'withdrawn'
         or v_idempotency.result_resource_type <> 'supplier_ownership_claim'
         or v_idempotency.result_resource_id is null
         or v_idempotency.result_resource_id is distinct from v_idempotency.target_aggregate_id
         or v_idempotency.result_version_token is null
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
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      v_result_version := v_idempotency.result_version_token::integer;
      if v_result_version < 2 then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      v_original_expected_version := v_result_version - 1;
      v_original_canonical_request := pg_catalog.jsonb_build_object(
        'claim_id', v_idempotency.target_aggregate_id,
        'command_precondition_version', 'claim_withdraw_preconditions_v1',
        'expected_claim_version', v_original_expected_version,
        'withdrawal_policy_version', 'claim_withdrawal_v1'
      );
      v_original_request_fingerprint := extensions.hmac(
        pg_catalog.convert_to(
          'claim-request-fingerprint-v1|' || v_original_canonical_request::text,
          'UTF8'
        ),
        pg_catalog.convert_to(v_hmac_key, 'UTF8'),
        'sha256'
      );

      if v_idempotency.request_fingerprint is distinct from v_original_request_fingerprint then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      select claim_row.*
      into v_replay_claim
      from public.supplier_ownership_claims as claim_row
      where claim_row.id = v_idempotency.result_resource_id;

      if not found
         or v_replay_claim.id <> v_idempotency.target_aggregate_id
         or v_replay_claim.claimant_user_profile_id <> v_idempotency.principal_user_profile_id
         or v_replay_claim.status <> 'withdrawn'
         or v_replay_claim.record_version <> v_result_version
         or v_replay_claim.expires_at <> v_replay_claim.submitted_at + interval '720 hours'
         or v_replay_claim.withdrawn_at is null
         or v_replay_claim.withdrawn_at <> v_idempotency.completed_at
         or v_replay_claim.withdrawn_by_user_profile_id <> v_idempotency.principal_user_profile_id
         or v_replay_claim.withdrawal_reason_code <> 'claimant_withdrawal'
         or v_replay_claim.updated_at <> v_replay_claim.withdrawn_at
         or v_replay_claim.withdrawn_at >= v_replay_claim.expires_at
      then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      select pg_catalog.count(*)
      into v_event_count
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id;

      if v_event_count <> 1 then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      select event_row.*
      into v_withdraw_event
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id
        and event_row.event_ordinal = 1;

      if not found
         or v_withdraw_event.event_type <> 'supplier_ownership.claim_withdrawn'
         or v_withdraw_event.event_schema_version <> 1
         or v_withdraw_event.aggregate_type <> 'supplier_ownership_claim'
         or v_withdraw_event.aggregate_id <> v_replay_claim.id
         or v_withdraw_event.aggregate_sequence <> v_result_version
         or v_withdraw_event.producer_command_name <> 'supplier_claim.withdraw'
         or v_withdraw_event.producer_command_contract_version <> 1
         or v_withdraw_event.source_operation_identity is not null
         or v_withdraw_event.source_system_code <> 'mujahiz'
         or v_withdraw_event.source_stream_code is not null
         or v_withdraw_event.source_event_id is not null
         or v_withdraw_event.actor_kind <> 'human_user'
         or v_withdraw_event.actor_user_profile_id <> v_idempotency.principal_user_profile_id
         or v_withdraw_event.actor_source_code is not null
         or v_withdraw_event.environment_code <> 'local'
         or v_withdraw_event.producing_component_code <> 'supplier_claim_command'
         or v_withdraw_event.causation_event_id is not null
         or v_withdraw_event.occurred_at <> v_replay_claim.withdrawn_at
         or v_withdraw_event.persisted_at <> v_replay_claim.withdrawn_at
         or v_withdraw_event.available_at <> v_replay_claim.withdrawn_at
         or v_withdraw_event.processing_status <> 'pending'
         or v_withdraw_event.is_historical
         or v_withdraw_event.fanout_suppressed
         or v_withdraw_event.migration_classification_code is not null
         or v_withdraw_event.payload <> pg_catalog.jsonb_build_object(
           'claim_id', v_replay_claim.id,
           'supplier_profile_id', v_replay_claim.supplier_profile_id,
           'claimant_user_profile_id', v_idempotency.principal_user_profile_id,
           'claim_version', v_result_version
         )
      then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      select pg_catalog.count(*)
      into v_withdraw_event_count
      from internal.domain_events as event_row
      where event_row.aggregate_type = 'supplier_ownership_claim'
        and event_row.aggregate_id = v_replay_claim.id
        and event_row.aggregate_sequence = v_result_version
        and event_row.event_type = 'supplier_ownership.claim_withdrawn';

      if v_withdraw_event_count <> 1 then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;
    end if;

    if v_idempotency.principal_kind <> 'human_user'
       or v_idempotency.principal_user_profile_id is distinct from v_request.claimant_user_profile_id
       or v_idempotency.principal_source_code is not null
       or v_idempotency.target_aggregate_type is distinct from 'supplier_ownership_claim'
       or v_idempotency.target_aggregate_id is distinct from p_claim_id
       or v_idempotency.key_digest_key_version <> 'local_v1'
       or v_idempotency.request_fingerprint is distinct from v_request.request_fingerprint
       or v_idempotency.request_fingerprint_key_version <> 'local_v1'
    then
      begin
        insert into internal.audit_logs (
          action_code,
          action_contract_version,
          action_class,
          actor_kind,
          actor_user_profile_id,
          target_entity_type,
          target_id,
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
          audit_schema_version,
          action_evidence_schema_version,
          authorization_policy_version,
          producer_contract_version,
          minimization_policy_version,
          retention_class
        ) values (
          'supplier_claim.withdraw',
          1,
          'claim_ownership',
          'human_user',
          v_request.claimant_user_profile_id,
          'supplier_ownership_claim',
          p_claim_id,
          v_now,
          v_now,
          'local',
          'mujahiz',
          'supplier_claim_command',
          'idempotency_conflict',
          'conflicted',
          'idempotency_key_conflict',
          'idempotency_key_conflict',
          pg_catalog.gen_random_uuid(),
          v_idempotency.id,
          'audit_log_v1',
          'claim_withdraw_conflict_v1',
          'sec-001-claim-v1',
          'supplier_claim.withdraw.v1',
          'aud-001-minimized-v1',
          'claim_ownership_decision'
        );
      exception
        when others then
          raise exception using
            errcode = 'P5116',
            message = 'audit_unavailable';
      end;

      return query
      select
        'idempotency_key_conflict'::text,
        null::uuid,
        'supplier_claim.withdraw'::text,
        1,
        'idempotency_key_conflict'::text,
        p_claim_id,
        null::text,
        null::integer,
        null::uuid,
        null::timestamptz,
        false;
      return;
    end if;

    if v_idempotency.status = 'completed' then
      return query
      select
        'replay'::text,
        null::uuid,
        'supplier_claim.withdraw'::text,
        1,
        'withdrawn'::text,
        v_replay_claim.id,
        'withdrawn'::text,
        v_result_version,
        v_replay_claim.supplier_profile_id,
        v_replay_claim.withdrawn_at,
        true;
      return;
    elsif v_idempotency.status = 'processing' then
      if v_idempotency.lease_expires_at > v_now then
        raise exception using
          errcode = 'P5109',
          message = 'command_in_progress';
      end if;

      if v_idempotency.attempt_count >= 10 then
        update internal.idempotency_keys as idempotency_row
        set status = 'failed',
            lease_token_digest = null,
            lease_digest_key_version = null,
            lease_expires_at = null,
            failure_code = 'attempt_limit_exceeded',
            retry_disposition = 'terminal',
            next_attempt_at = null,
            failed_at = v_now
        where idempotency_row.id = v_idempotency.id
        returning * into v_idempotency;

        return query
        select
          'reconciliation_required'::text,
          null::uuid,
          'supplier_claim.withdraw'::text,
          1,
          'reconciliation_required'::text,
          p_claim_id,
          null::text,
          null::integer,
          null::uuid,
          null::timestamptz,
          false;
        return;
      end if;

      update internal.idempotency_keys as idempotency_row
      set lease_token_digest = v_fence_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_now + interval '60 seconds',
          attempt_count = idempotency_row.attempt_count + 1
      where idempotency_row.id = v_idempotency.id
      returning * into v_idempotency;
    elsif v_idempotency.status = 'failed' then
      if v_idempotency.retry_disposition = 'terminal' then
        return query
        select
          'reconciliation_required'::text,
          null::uuid,
          'supplier_claim.withdraw'::text,
          1,
          'reconciliation_required'::text,
          p_claim_id,
          null::text,
          null::integer,
          null::uuid,
          null::timestamptz,
          false;
        return;
      end if;

      if v_idempotency.next_attempt_at > v_now then
        raise exception using
          errcode = 'P5110',
          message = 'retry_later';
      end if;

      if v_idempotency.attempt_count >= 10 then
        update internal.idempotency_keys as idempotency_row
        set failure_code = 'attempt_limit_exceeded',
            retry_disposition = 'terminal',
            next_attempt_at = null,
            failed_at = v_now
        where idempotency_row.id = v_idempotency.id
        returning * into v_idempotency;

        return query
        select
          'reconciliation_required'::text,
          null::uuid,
          'supplier_claim.withdraw'::text,
          1,
          'reconciliation_required'::text,
          p_claim_id,
          null::text,
          null::integer,
          null::uuid,
          null::timestamptz,
          false;
        return;
      end if;

      update internal.idempotency_keys as idempotency_row
      set status = 'processing',
          lease_token_digest = v_fence_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_now + interval '60 seconds',
          attempt_count = idempotency_row.attempt_count + 1,
          failure_code = null,
          retry_disposition = null,
          next_attempt_at = null,
          failed_at = null
      where idempotency_row.id = v_idempotency.id
      returning * into v_idempotency;
    else
      raise exception using
        errcode = 'P5199',
        message = 'integrity_reconciliation_required';
    end if;
  end if;

  return query
  select
    'execute'::text,
    v_fence,
    'supplier_claim.withdraw'::text,
    1,
    null::text,
    p_claim_id,
    null::text,
    null::integer,
    null::uuid,
    null::timestamptz,
    false;
  return;
exception
  when sqlstate 'P5100'
    or sqlstate 'P5101'
    or sqlstate 'P5109'
    or sqlstate 'P5110'
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

comment on function supplier_claim.reserve_withdraw(text, uuid, integer) is
  'Private trusted phase-1 withdrawal reservation/replay/reclaim boundary. It commits no Claim/event, stores only an execution-fence HMAC, verifies immutable completed replay, durably records minimized idempotency conflicts, and uses provisional local lease/attempt parameters only.';

alter function supplier_claim.reserve_withdraw(text, uuid, integer)
  owner to postgres;

revoke all on function supplier_claim.reserve_withdraw(text, uuid, integer)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim.reserve_withdraw(text, uuid, integer)
  to mujahiz_claim_runtime;

create function supplier_claim.withdraw(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
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
  withdrawn_at timestamptz,
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
  v_locked_profile public.user_profiles%rowtype;
  v_profile public.user_profiles%rowtype;
  v_provider_link internal.identity_provider_links%rowtype;
  v_supplier public.supplier_profiles%rowtype;
  v_ownership public.supplier_ownerships%rowtype;
  v_claim public.supplier_ownership_claims%rowtype;
  v_profile_found boolean := false;
  v_active_firebase_link_count integer := 0;
  v_usable_firebase_link_count integer := 0;
  v_active_ownership_count integer := 0;
  v_attempt_count integer;
  v_result_version integer;
  v_event_id uuid;
  v_correlation_id uuid;
  v_updated_count integer;
begin
  select canonical.*
  into v_request
  from supplier_claim._canonicalize_withdraw_request_v1(
    p_idempotency_key,
    p_claim_id,
    p_expected_claim_version
  ) as canonical;

  if not found or p_execution_fence is null then
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
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
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
  end if;

  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-withdraw-fence-v1|' || p_execution_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  v_reservation_now := pg_catalog.clock_timestamp();

  select idempotency_row.*
  into v_idempotency
  from internal.idempotency_keys as idempotency_row
  where idempotency_row.environment_code = 'local'
    and idempotency_row.command_name = 'supplier_claim.withdraw'
    and idempotency_row.command_contract_version = 1
    and idempotency_row.key_digest = v_request.key_digest
  for update;

  if not found then
    raise exception using
      errcode = 'P5110',
      message = 'retry_later';
  end if;

  if v_idempotency.principal_kind <> 'human_user'
     or v_idempotency.principal_user_profile_id is distinct from v_request.claimant_user_profile_id
     or v_idempotency.principal_source_code is not null
     or v_idempotency.target_aggregate_type is distinct from 'supplier_ownership_claim'
     or v_idempotency.target_aggregate_id is distinct from p_claim_id
     or v_idempotency.key_digest_key_version <> 'local_v1'
     or v_idempotency.request_fingerprint is distinct from v_request.request_fingerprint
     or v_idempotency.request_fingerprint_key_version <> 'local_v1'
  then
    raise exception using
      errcode = 'P5108',
      message = 'idempotency_key_conflict';
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
    raise exception using
      errcode = 'P5110',
      message = 'retry_later';
  end if;

  if v_idempotency.lease_digest_key_version <> 'local_v1'
     or v_idempotency.lease_token_digest is distinct from v_fence_digest
  then
    raise exception using
      errcode = 'P5109',
      message = 'command_in_progress';
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
    raise exception using
      errcode = 'P5111',
      message = 'claim_not_found';
  end if;

  for v_lock_principal_id in
    select lock_principal.principal_id
    from (
      values
        (v_request.claimant_user_profile_id),
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

  for v_locked_profile in
    select profile_row.*
    from public.user_profiles as profile_row
    where profile_row.id in (
      v_request.claimant_user_profile_id,
      v_routed_claimant_id
    )
    order by profile_row.id
    for update
  loop
    if v_locked_profile.id = v_request.claimant_user_profile_id then
      v_profile := v_locked_profile;
      v_profile_found := true;
    end if;
  end loop;

  if not v_profile_found
     or v_profile.account_status <> 'active'
     or v_profile.account_context <> 'supplier'
     or v_profile.verification_mirror_status <> 'verified'
  then
    raise exception using
      errcode = 'P5103',
      message = 'claimant_ineligible';
  end if;

  for v_provider_link in
    select provider_link_row.*
    from internal.identity_provider_links as provider_link_row
    where provider_link_row.user_profile_id in (
      v_request.claimant_user_profile_id,
      v_routed_claimant_id
    )
    order by provider_link_row.id
    for update
  loop
    if v_provider_link.user_profile_id = v_request.claimant_user_profile_id
       and v_provider_link.provider_code = 'firebase'
       and v_provider_link.link_status = 'linked'
    then
      v_active_firebase_link_count := v_active_firebase_link_count + 1;
      if v_provider_link.is_primary
         and v_provider_link.identity_status = 'active'
         and v_provider_link.verification_status = 'verified'
      then
        v_usable_firebase_link_count := v_usable_firebase_link_count + 1;
      end if;
    end if;
  end loop;

  if v_active_firebase_link_count <> 1
     or v_usable_firebase_link_count <> 1
  then
    raise exception using
      errcode = 'P5103',
      message = 'claimant_ineligible';
  end if;

  select supplier_row.*
  into v_supplier
  from public.supplier_profiles as supplier_row
  where supplier_row.id = v_routed_supplier_id
  for update;

  if not found then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  for v_ownership in
    select ownership_row.*
    from public.supplier_ownerships as ownership_row
    where ownership_row.supplier_profile_id = v_routed_supplier_id
    order by ownership_row.id
    for update
  loop
    if v_ownership.authority_type = 'primary_controller'
       and v_ownership.ownership_status = 'active'
    then
      v_active_ownership_count := v_active_ownership_count + 1;
    end if;
  end loop;

  if v_active_ownership_count > 1 then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  select claim_row.*
  into v_claim
  from public.supplier_ownership_claims as claim_row
  where claim_row.id = p_claim_id
  for update;

  if not found
     or v_claim.claimant_user_profile_id <> v_routed_claimant_id
     or v_claim.supplier_profile_id <> v_routed_supplier_id
     or v_claim.expires_at <> v_claim.submitted_at + interval '720 hours'
  then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  if v_claim.claimant_user_profile_id <> v_request.claimant_user_profile_id then
    raise exception using
      errcode = 'P5111',
      message = 'claim_not_found';
  end if;

  if v_claim.record_version <> p_expected_claim_version then
    raise exception using
      errcode = 'P5112',
      message = 'claim_version_conflict';
  end if;

  if v_claim.status not in ('submitted', 'under_review') then
    raise exception using
      errcode = 'P5113',
      message = 'claim_not_actionable';
  end if;

  v_command_now := pg_catalog.clock_timestamp();
  if v_command_now >= v_claim.expires_at then
    raise exception using
      errcode = 'P5114',
      message = 'claim_expired';
  end if;

  v_result_version := v_claim.record_version + 1;
  v_event_id := pg_catalog.gen_random_uuid();
  v_correlation_id := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());

  update public.supplier_ownership_claims as claim_row
  set status = 'withdrawn',
      record_version = v_result_version,
      withdrawn_at = v_command_now,
      withdrawn_by_user_profile_id = v_request.claimant_user_profile_id,
      withdrawal_reason_code = 'claimant_withdrawal',
      updated_at = v_command_now
  where claim_row.id = p_claim_id
    and claim_row.record_version = p_expected_claim_version
    and claim_row.status in ('submitted', 'under_review');

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
    'supplier_ownership.claim_withdrawn',
    1,
    'supplier_ownership_claim',
    p_claim_id,
    v_result_version,
    'supplier_claim.withdraw',
    1,
    v_idempotency.id,
    'mujahiz',
    1,
    'human_user',
    v_request.claimant_user_profile_id,
    'local',
    'supplier_claim_command',
    v_correlation_id,
    v_command_now,
    v_command_now,
    pg_catalog.jsonb_build_object(
      'claim_id', p_claim_id,
      'supplier_profile_id', v_claim.supplier_profile_id,
      'claimant_user_profile_id', v_request.claimant_user_profile_id,
      'claim_version', v_result_version
    ),
    'pending',
    v_command_now
  );

  update internal.idempotency_keys as idempotency_row
  set status = 'completed',
      lease_token_digest = null,
      lease_digest_key_version = null,
      lease_expires_at = null,
      outcome_code = 'withdrawn',
      result_resource_type = 'supplier_ownership_claim',
      result_resource_id = p_claim_id,
      result_version_token = v_result_version::text,
      completed_at = v_command_now
  where idempotency_row.id = v_idempotency.id
    and idempotency_row.status = 'processing'
    and idempotency_row.attempt_count = v_attempt_count
    and idempotency_row.lease_token_digest = v_fence_digest;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  return query
  select
    'supplier_claim.withdraw'::text,
    1,
    'withdrawn'::text,
    p_claim_id,
    'withdrawn'::text,
    v_result_version,
    v_claim.supplier_profile_id,
    v_command_now,
    false;
  return;
exception
  when sqlstate 'P5100'
    or sqlstate 'P5101'
    or sqlstate 'P5103'
    or sqlstate 'P5108'
    or sqlstate 'P5109'
    or sqlstate 'P5110'
    or sqlstate 'P5111'
    or sqlstate 'P5112'
    or sqlstate 'P5113'
    or sqlstate 'P5114'
    or sqlstate 'P5199'
  then
    raise;
  when others then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
end
$function$;

comment on function supplier_claim.withdraw(text, uuid, integer, uuid, uuid) is
  'Local trusted supplier_claim.withdraw v1 phase-2 executor. It requires the exact committed phase-1 fence, re-derives the claimant/request binding, applies shared principal/Supplier/ownership/Claim locks, transitions only the exact claimant active unexpired Claim, inserts one claim_withdrawn event, and completes the fenced result atomically without success audit or notification.';

alter function supplier_claim.withdraw(text, uuid, integer, uuid, uuid)
  owner to postgres;

revoke all on function supplier_claim.withdraw(text, uuid, integer, uuid, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim.withdraw(text, uuid, integer, uuid, uuid)
  to mujahiz_claim_runtime;
