-- Twenty-ninth tracked local SQL migration: supplier_claim.expire v1 only.
-- Local Supabase and synthetic data only. No hosted worker, notification,
-- ownership mutation, competing-Claim mutation, RLS policy, or data movement.

do $role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'mujahiz_claim_expiry_worker') then
    create role mujahiz_claim_expiry_worker
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$role$;


create function supplier_claim._assert_expiry_worker_context_v1()
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $function$
begin
  if pg_catalog.current_setting('role', true) is distinct from 'mujahiz_claim_expiry_worker'
     or pg_catalog.current_setting('mujahiz.claim.environment', true) is distinct from 'local'
     or pg_catalog.current_setting('mujahiz.claim.worker_purpose', true) is distinct from 'supplier_claim_expiry'
     or pg_catalog.current_setting('mujahiz.claim.expiry_policy_version', true) is distinct from 'claim_expiry_v1'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;
end
$function$;

alter function supplier_claim._assert_expiry_worker_context_v1() owner to postgres;
revoke all on function supplier_claim._assert_expiry_worker_context_v1()
  from public, anon, authenticated, service_role, mujahiz_claim_runtime, mujahiz_claim_expiry_worker;

create function supplier_claim._canonicalize_expire_request_v1(
  p_source_item_identity text,
  p_claim_id uuid,
  p_expected_claim_version integer
)
returns table (key_digest bytea, request_fingerprint bytea)
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $function$
declare
  v_hmac_key text;
  v_request jsonb;
begin
  perform supplier_claim._assert_expiry_worker_context_v1();
  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) not between 32 and 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;
  if p_claim_id is null
     or p_expected_claim_version is null or p_expected_claim_version < 1
     or p_source_item_identity is null
     or pg_catalog.octet_length(p_source_item_identity) not between 1 and 256
     or p_source_item_identity <> pg_catalog.btrim(p_source_item_identity)
     or pg_catalog.translate(p_source_item_identity, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5101', message = 'invalid_request';
  end if;

  v_request := pg_catalog.jsonb_build_object(
    'claim_id', p_claim_id,
    'command_precondition_version', 'claim_expire_preconditions_v1',
    'expected_claim_version', p_expected_claim_version,
    'expiry_policy_version', 'claim_expiry_v1',
    'expiry_system_source_code', 'claim_expiry_worker',
    'source_item_identity', p_source_item_identity,
    'upstream_source_system_code', 'claim_expiry_scheduler'
  );
  key_digest := extensions.hmac(
    pg_catalog.convert_to(
      'claim-idempotency-key-v1|local|supplier_claim.expire|1|claim_expiry_scheduler|'
      || pg_catalog.octet_length(p_source_item_identity)::text || ':' || p_source_item_identity,
      'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'), 'sha256');
  request_fingerprint := extensions.hmac(
    pg_catalog.convert_to('claim-request-fingerprint-v1|' || v_request::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'), 'sha256');
  return next;
end
$function$;

alter function supplier_claim._canonicalize_expire_request_v1(text, uuid, integer) owner to postgres;
revoke all on function supplier_claim._canonicalize_expire_request_v1(text, uuid, integer)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime, mujahiz_claim_expiry_worker;

create function supplier_claim._terminal_history_coherent_v1(p_claim_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype;
  v_count integer;
begin
  select * into v_claim from public.supplier_ownership_claims c where c.id=p_claim_id;
  if not found
     or v_claim.status not in ('approved','rejected','withdrawn','expired','superseded')
     or v_claim.expires_at<>v_claim.submitted_at+interval '720 hours'
  then return false; end if;

  if v_claim.status='expired' then
    if v_claim.expired_at is null or v_claim.expired_at<v_claim.expires_at
       or v_claim.updated_at<>v_claim.expired_at
       or v_claim.expiry_system_source_code<>'claim_expiry_worker'
       or v_claim.expiry_policy_version<>'claim_expiry_v1'
    then return false; end if;
    select count(*) into v_count
    from internal.idempotency_keys i
    join internal.domain_events e on e.producer_idempotency_key_id=i.id
    where i.environment_code='local' and i.command_name='supplier_claim.expire'
      and i.command_contract_version=1 and i.principal_kind='automated_worker'
      and i.principal_user_profile_id is null and i.principal_source_code='claim_expiry_worker'
      and i.upstream_source_system_code='claim_expiry_scheduler'
      and i.upstream_request_identity is not null
      and i.target_aggregate_type='supplier_ownership_claim' and i.target_aggregate_id=v_claim.id
      and i.status='completed' and i.outcome_code='expired'
      and i.result_resource_type='supplier_ownership_claim' and i.result_resource_id=v_claim.id
      and i.result_version_token=v_claim.record_version::text
      and i.completed_at=v_claim.expired_at and i.expires_at>i.completed_at
      and i.lease_token_digest is null and i.lease_expires_at is null
      and e.event_type='supplier_ownership.claim_expired' and e.event_schema_version=1
      and e.aggregate_type='supplier_ownership_claim' and e.aggregate_id=v_claim.id
      and e.aggregate_sequence=v_claim.record_version and e.producer_command_name='supplier_claim.expire'
      and e.producer_command_contract_version=1 and e.source_operation_identity=i.upstream_request_identity
      and e.source_system_code='mujahiz' and e.event_ordinal=1
      and e.actor_kind='automated_worker' and e.actor_user_profile_id is null
      and e.actor_source_code='claim_expiry_worker' and e.environment_code='local'
      and e.producing_component_code='supplier_claim_expiry_worker'
      and e.occurred_at=v_claim.expired_at and e.persisted_at=v_claim.expired_at
      and e.available_at=v_claim.expired_at and e.processing_status='pending'
      and not e.is_historical and not e.fanout_suppressed
      and e.payload=pg_catalog.jsonb_build_object('claim_id',v_claim.id,
        'supplier_profile_id',v_claim.supplier_profile_id,
        'claimant_user_profile_id',v_claim.claimant_user_profile_id,
        'claim_version',v_claim.record_version)
      and not exists(select 1 from internal.audit_logs a where a.idempotency_reference=i.id);
  elsif v_claim.status='withdrawn' then
    if v_claim.withdrawn_at is null or v_claim.updated_at<>v_claim.withdrawn_at then return false; end if;
    select count(*) into v_count from internal.idempotency_keys i
    join internal.domain_events e on e.producer_idempotency_key_id=i.id
    where i.command_name='supplier_claim.withdraw' and i.command_contract_version=1
      and i.principal_kind='human_user' and i.principal_user_profile_id=v_claim.claimant_user_profile_id
      and i.target_aggregate_id=v_claim.id and i.status='completed' and i.outcome_code='withdrawn'
      and i.result_resource_id=v_claim.id and i.result_version_token=v_claim.record_version::text
      and i.completed_at=v_claim.withdrawn_at and i.expires_at>i.completed_at
      and e.event_type='supplier_ownership.claim_withdrawn' and e.aggregate_id=v_claim.id
      and e.aggregate_sequence=v_claim.record_version and e.event_ordinal=1
      and not exists(select 1 from internal.audit_logs a where a.idempotency_reference=i.id);
  elsif v_claim.status='rejected' then
    if v_claim.decided_at is null or v_claim.updated_at<>v_claim.decided_at then return false; end if;
    select count(*) into v_count from internal.idempotency_keys i
    join internal.domain_events e on e.producer_idempotency_key_id=i.id
    join internal.audit_logs a on a.idempotency_reference=i.id
    where i.command_name='supplier_claim.reject' and i.command_contract_version=1
      and i.principal_kind='human_user' and i.principal_user_profile_id=v_claim.decided_by_user_profile_id
      and i.target_aggregate_id=v_claim.id and i.status='completed' and i.outcome_code='rejected'
      and i.result_resource_id=v_claim.id and i.result_version_token=v_claim.record_version::text
      and i.completed_at=v_claim.decided_at and i.expires_at>i.completed_at
      and e.event_type='supplier_ownership.claim_rejected' and e.aggregate_id=v_claim.id
      and e.aggregate_sequence=v_claim.record_version and e.event_ordinal=1
      and a.action_code='supplier_claim.reject' and a.action_contract_version=1
      and a.target_id=v_claim.id and a.outcome_class='succeeded' and a.occurred_at=v_claim.decided_at;
  elsif v_claim.status='approved' then
    if v_claim.decided_at is null or v_claim.updated_at<>v_claim.decided_at
       or v_claim.resulting_supplier_ownership_id is null then return false; end if;
    select count(*) into v_count from internal.idempotency_keys i
    join internal.domain_events e on e.producer_idempotency_key_id=i.id
    join internal.audit_logs a on a.idempotency_reference=i.id
    join public.supplier_ownerships o on o.id=v_claim.resulting_supplier_ownership_id
    where i.command_name='supplier_claim.approve' and i.command_contract_version=1
      and i.principal_kind='human_user' and i.principal_user_profile_id=v_claim.decided_by_user_profile_id
      and i.target_aggregate_id=v_claim.id and i.status='completed' and i.outcome_code='approved'
      and i.result_resource_id=v_claim.id and i.result_version_token=v_claim.record_version::text
      and i.completed_at=v_claim.decided_at and i.expires_at>i.completed_at
      and e.event_type='supplier_ownership.claim_approved' and e.aggregate_id=v_claim.id
      and e.aggregate_sequence=v_claim.record_version and e.event_ordinal=1
      and a.action_code='supplier_claim.approve' and a.action_contract_version=1
      and a.target_id=v_claim.id and a.outcome_class='succeeded' and a.occurred_at=v_claim.decided_at
      and o.supplier_profile_id=v_claim.supplier_profile_id
      and o.controller_user_profile_id=v_claim.claimant_user_profile_id
      and o.ownership_status='active';
  else
    if v_claim.superseded_at is null or v_claim.updated_at<>v_claim.superseded_at
       or v_claim.superseded_by_claim_id is null then return false; end if;
    select count(*) into v_count from internal.domain_events e
    join internal.idempotency_keys i on i.id=e.producer_idempotency_key_id
    join public.supplier_ownership_claims winner on winner.id=v_claim.superseded_by_claim_id
    where e.event_type='supplier_ownership.claim_superseded' and e.event_schema_version=1
      and e.aggregate_id=v_claim.id and e.aggregate_sequence=v_claim.record_version
      and e.producer_command_name='supplier_claim.approve'
      and i.command_name='supplier_claim.approve' and i.status='completed' and i.outcome_code='approved'
      and i.target_aggregate_id=winner.id and winner.status='approved'
      and winner.supplier_profile_id=v_claim.supplier_profile_id
      and winner.resulting_supplier_ownership_id is not null and v_claim.resulting_supplier_ownership_id is null;
  end if;
  return v_count=1;
exception when others then
  return false;
end
$function$;

alter function supplier_claim._terminal_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._terminal_history_coherent_v1(uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime, mujahiz_claim_expiry_worker;
create function supplier_claim.expire(
  p_source_item_identity text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_correlation_id uuid default null
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
  expired_at timestamptz,
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
  v_fence uuid := pg_catalog.gen_random_uuid();
  v_fence_digest bytea;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_row internal.idempotency_keys%rowtype;
  v_claim public.supplier_ownership_claims%rowtype;
  v_inserted boolean;
begin
  select * into v_request from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity, p_claim_id, p_expected_claim_version);
  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-expire-fence-v1|' || v_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'), 'sha256');

  insert into internal.idempotency_keys (
    command_name, command_contract_version, environment_code,
    principal_kind, principal_source_code,
    upstream_source_system_code, upstream_request_identity,
    target_aggregate_type, target_aggregate_id,
    key_digest, key_digest_key_version,
    request_fingerprint, request_fingerprint_key_version,
    status, lease_token_digest, lease_digest_key_version, lease_expires_at,
    attempt_count, created_at, expires_at
  ) values (
    'supplier_claim.expire', 1, 'local',
    'automated_worker', 'claim_expiry_worker',
    'claim_expiry_scheduler', p_source_item_identity,
    'supplier_ownership_claim', p_claim_id,
    v_request.key_digest, 'local_v1', v_request.request_fingerprint, 'local_v1',
    'processing', v_fence_digest, 'local_v1', v_now + interval '60 seconds',
    1, v_now, v_now + interval '720 hours'
  ) on conflict on constraint idempotency_keys_namespace_uk do nothing
  returning * into v_row;
  v_inserted := found;

  if not v_inserted then
    select * into v_row from internal.idempotency_keys i
    where i.environment_code = 'local'
      and i.command_name = 'supplier_claim.expire'
      and i.command_contract_version = 1
      and i.key_digest = v_request.key_digest
    for update;
    if not found then
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;
    if v_row.principal_kind <> 'automated_worker'
       or v_row.principal_user_profile_id is not null
       or v_row.principal_source_code <> 'claim_expiry_worker'
       or v_row.upstream_source_system_code <> 'claim_expiry_scheduler'
       or v_row.upstream_request_identity is distinct from p_source_item_identity
       or v_row.target_aggregate_type <> 'supplier_ownership_claim'
       or v_row.target_aggregate_id is distinct from p_claim_id
       or v_row.request_fingerprint is distinct from v_request.request_fingerprint
       or v_row.request_fingerprint_key_version <> 'local_v1'
       or v_row.key_digest_key_version <> 'local_v1'
    then
      raise exception using errcode = 'P5108', message = 'idempotency_key_conflict';
    end if;

    if v_row.status = 'completed' then
      if v_row.outcome_code not in ('expired', 'claim_not_due', 'already_terminal')
         or v_row.result_resource_type <> 'supplier_ownership_claim'
         or v_row.result_resource_id is distinct from p_claim_id
         or v_row.result_version_token is null
         or v_row.completed_at is null
         or v_row.expires_at <= v_row.completed_at
         or v_row.lease_token_digest is not null
         or v_row.lease_expires_at is not null
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;
      select * into v_claim from public.supplier_ownership_claims c where c.id = p_claim_id;
      if not found or v_claim.record_version::text <> v_row.result_version_token then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;
      if v_row.outcome_code='expired' and (
           v_claim.status<>'expired'
           or v_row.completed_at is distinct from v_claim.expired_at
           or not supplier_claim._terminal_history_coherent_v1(v_claim.id)
           or (select count(*) from internal.domain_events e
               where e.producer_idempotency_key_id=v_row.id)<>1
           or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_row.id)
         )
      then
        raise exception using errcode='P5199', message='integrity_reconciliation_required';
      elsif v_row.outcome_code='claim_not_due' and (
           v_claim.status not in ('submitted','under_review')
           or v_row.completed_at>=v_claim.expires_at
           or exists(select 1 from internal.domain_events e where e.producer_idempotency_key_id=v_row.id)
           or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_row.id)
         )
      then
        raise exception using errcode='P5199', message='integrity_reconciliation_required';
      elsif v_row.outcome_code='already_terminal' and (
           not supplier_claim._terminal_history_coherent_v1(v_claim.id)
           or exists(select 1 from internal.domain_events e where e.producer_idempotency_key_id=v_row.id)
           or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_row.id)
         )
      then
        raise exception using errcode='P5199', message='integrity_reconciliation_required';
      end if;
      return query select 'replay'::text, null::uuid, 'supplier_claim.expire'::text, 1,
        v_row.outcome_code, v_claim.id, v_claim.status, v_claim.record_version,
        v_claim.supplier_profile_id, v_claim.expired_at, true;
      return;
    elsif v_row.status = 'processing' then
      if v_row.lease_expires_at > v_now then
        raise exception using errcode = 'P5109', message = 'command_in_progress';
      end if;
      if v_row.attempt_count >= 10 then
        update internal.idempotency_keys set status='failed', lease_token_digest=null,
          lease_digest_key_version=null, lease_expires_at=null,
          failure_code='attempt_limit_exceeded', retry_disposition='terminal',
          failed_at=v_now where id=v_row.id;
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;
      update internal.idempotency_keys set lease_token_digest=v_fence_digest,
        lease_digest_key_version='local_v1', lease_expires_at=v_now+interval '60 seconds',
        attempt_count=attempt_count+1 where id=v_row.id returning * into v_row;
    elsif v_row.status = 'failed' and v_row.retry_disposition <> 'terminal'
          and (v_row.next_attempt_at is null or v_row.next_attempt_at <= v_now)
          and v_row.attempt_count < 10 then
      update internal.idempotency_keys set status='processing',
        lease_token_digest=v_fence_digest, lease_digest_key_version='local_v1',
        lease_expires_at=v_now+interval '60 seconds', attempt_count=attempt_count+1,
        failure_code=null, retry_disposition=null, next_attempt_at=null, failed_at=null
      where id=v_row.id returning * into v_row;
    else
      raise exception using errcode = 'P5110', message = 'retry_later';
    end if;
  end if;

  return query select 'execute'::text, v_fence, 'supplier_claim.expire'::text, 1,
    null::text, p_claim_id, null::text, null::integer, null::uuid,
    null::timestamptz, false;
exception
  when sqlstate 'P5100' or sqlstate 'P5101' or sqlstate 'P5108'
    or sqlstate 'P5109' or sqlstate 'P5110' or sqlstate 'P5199' then raise;
  when others then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
end
$function$;

alter function supplier_claim.expire(text, uuid, integer, uuid) owner to postgres;
revoke all on function supplier_claim.expire(text, uuid, integer, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime, mujahiz_claim_expiry_worker;
grant execute on function supplier_claim.expire(text, uuid, integer, uuid)
  to mujahiz_claim_expiry_worker;

grant usage on schema supplier_claim to mujahiz_claim_expiry_worker;
create function supplier_claim._execute_expire(
  p_source_item_identity text,
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
  expired_at timestamptz,
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
  v_reservation_now timestamptz := pg_catalog.clock_timestamp();
  v_command_now timestamptz;
  v_row internal.idempotency_keys%rowtype;
  v_claim public.supplier_ownership_claims%rowtype;
  v_routed_claimant_id uuid;
  v_routed_supplier_id uuid;
  v_locked_profile public.user_profiles%rowtype;
  v_supplier public.supplier_profiles%rowtype;
  v_locked_ownership public.supplier_ownerships%rowtype;
  v_attempt integer;
  v_result_version integer;
  v_event_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid;
  v_count integer;
  v_active_ownership_count integer := 0;
  v_updated integer;
begin
  select * into v_request from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity, p_claim_id, p_expected_claim_version);
  if p_execution_fence is null then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;
  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-expire-fence-v1|' || p_execution_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'), 'sha256');

  select * into v_row from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.expire'
    and i.command_contract_version=1 and i.key_digest=v_request.key_digest for update;
  if not found then raise exception using errcode='P5110', message='retry_later'; end if;
  if v_row.principal_kind<>'automated_worker'
     or v_row.principal_user_profile_id is not null
     or v_row.principal_source_code<>'claim_expiry_worker'
     or v_row.upstream_source_system_code<>'claim_expiry_scheduler'
     or v_row.upstream_request_identity is distinct from p_source_item_identity
     or v_row.target_aggregate_id is distinct from p_claim_id
     or v_row.request_fingerprint is distinct from v_request.request_fingerprint
  then raise exception using errcode='P5108', message='idempotency_key_conflict'; end if;
  if v_row.status<>'processing' or v_row.lease_expires_at<=v_reservation_now then
    raise exception using errcode='P5110', message='retry_later';
  end if;
  if v_row.lease_digest_key_version<>'local_v1'
     or v_row.lease_token_digest is distinct from v_fence_digest then
    raise exception using errcode='P5109', message='command_in_progress';
  end if;
  v_attempt := v_row.attempt_count;

  select c.claimant_user_profile_id,c.supplier_profile_id
    into v_routed_claimant_id,v_routed_supplier_id
  from public.supplier_ownership_claims c where c.id=p_claim_id;
  if not found then raise exception using errcode='P5111', message='claim_not_found'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    claim_security.claim_principal_lock_key_v1(v_routed_claimant_id));
  perform pg_catalog.pg_advisory_xact_lock(
    claim_security.claim_supplier_lock_key_v1(v_routed_supplier_id));
  select * into v_locked_profile from public.user_profiles u
    where u.id=v_routed_claimant_id for update;
  if not found then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
  select * into v_supplier from public.supplier_profiles s
    where s.id=v_routed_supplier_id for update;
  if not found then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
  for v_locked_ownership in
    select o.* from public.supplier_ownerships o
    where o.supplier_profile_id=v_routed_supplier_id
    order by o.id for update
  loop
    if v_locked_ownership.authority_type='primary_controller'
       and v_locked_ownership.ownership_status='active' then
      v_active_ownership_count:=v_active_ownership_count+1;
    end if;
  end loop;
  select * into v_claim from public.supplier_ownership_claims c where c.id=p_claim_id for update;
  v_command_now := pg_catalog.clock_timestamp();
  if v_active_ownership_count>1 then
    raise exception using errcode='P5199', message='integrity_reconciliation_required';
  end if;

  if not found
     or v_claim.claimant_user_profile_id<>v_routed_claimant_id
     or v_claim.supplier_profile_id<>v_routed_supplier_id
     or v_claim.expires_at<>v_claim.submitted_at+interval '720 hours'
  then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;

  if v_claim.status in ('submitted','under_review') and v_active_ownership_count>0 then
    raise exception using errcode='P5199', message='integrity_reconciliation_required';
  end if;
  if v_claim.status in ('approved','rejected','withdrawn','expired','superseded') then
    if not supplier_claim._terminal_history_coherent_v1(v_claim.id) then
      raise exception using errcode='P5199', message='integrity_reconciliation_required';
    end if;
    if v_claim.status='expired' then
      select count(*) into v_count
      from internal.idempotency_keys i join internal.domain_events e
        on e.producer_idempotency_key_id=i.id
      where i.command_name='supplier_claim.expire' and i.command_contract_version=1
        and i.status='completed' and i.outcome_code='expired'
        and i.result_resource_id=v_claim.id
        and i.result_version_token=v_claim.record_version::text
        and i.principal_kind='automated_worker'
        and i.principal_source_code='claim_expiry_worker'
        and i.upstream_source_system_code='claim_expiry_scheduler'
        and i.completed_at=v_claim.expired_at and i.expires_at>i.completed_at
        and e.event_type='supplier_ownership.claim_expired'
        and e.aggregate_id=v_claim.id and e.aggregate_sequence=v_claim.record_version
        and e.event_ordinal=1 and e.source_operation_identity=i.upstream_request_identity
        and e.actor_kind='automated_worker' and e.actor_source_code='claim_expiry_worker';
      if v_count<>1 or v_claim.expired_at is null or v_claim.expired_at<v_claim.expires_at
         or v_claim.expiry_system_source_code<>'claim_expiry_worker'
         or v_claim.expiry_policy_version<>'claim_expiry_v1'
      then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    elsif v_claim.status='withdrawn' then
      select count(*) into v_count from internal.domain_events e
      where e.event_type='supplier_ownership.claim_withdrawn' and e.aggregate_id=v_claim.id
        and e.aggregate_sequence=v_claim.record_version and e.event_ordinal=1;
      if v_count<>1 or v_claim.withdrawn_at is null then
        raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    elsif v_claim.status='rejected' then
      select count(*) into v_count from internal.domain_events e
      where e.event_type='supplier_ownership.claim_rejected' and e.aggregate_id=v_claim.id
        and e.aggregate_sequence=v_claim.record_version and e.event_ordinal=1;
      if v_count<>1 or v_claim.decided_at is null then
        raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    elsif v_claim.status='approved' then
      select count(*) into v_count from internal.domain_events e
      where e.event_type='supplier_ownership.claim_approved' and e.aggregate_id=v_claim.id
        and e.aggregate_sequence=v_claim.record_version and e.event_ordinal=1;
      if v_count<>1 or v_claim.decided_at is null or v_claim.resulting_supplier_ownership_id is null then
        raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    else
      select count(*) into v_count from internal.domain_events e
      where e.event_type='supplier_ownership.claim_superseded' and e.aggregate_id=v_claim.id
        and e.aggregate_sequence=v_claim.record_version;
      if v_count<>1 or v_claim.superseded_at is null or v_claim.superseded_by_claim_id is null then
        raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    end if;
    update internal.idempotency_keys set status='completed', lease_token_digest=null,
      lease_digest_key_version=null, lease_expires_at=null, outcome_code='already_terminal',
      result_resource_type='supplier_ownership_claim', result_resource_id=p_claim_id,
      result_version_token=v_claim.record_version::text, completed_at=v_command_now
    where id=v_row.id and status='processing' and attempt_count=v_attempt
      and lease_token_digest=v_fence_digest;
    get diagnostics v_updated=row_count;
    if v_updated<>1 then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    return query select 'supplier_claim.expire'::text,1,'already_terminal'::text,
      v_claim.id,v_claim.status,v_claim.record_version,v_claim.supplier_profile_id,
      v_claim.expired_at,false;
    return;
  end if;

  if v_claim.record_version<>p_expected_claim_version then
    raise exception using errcode='P5112', message='claim_version_conflict';
  end if;
  if v_claim.status not in ('submitted','under_review') then
    raise exception using errcode='P5113', message='claim_not_actionable';
  end if;
  if v_command_now<v_claim.expires_at then
    update internal.idempotency_keys set status='completed', lease_token_digest=null,
      lease_digest_key_version=null, lease_expires_at=null, outcome_code='claim_not_due',
      result_resource_type='supplier_ownership_claim', result_resource_id=p_claim_id,
      result_version_token=v_claim.record_version::text, completed_at=v_command_now
    where id=v_row.id and status='processing' and attempt_count=v_attempt
      and lease_token_digest=v_fence_digest;
    get diagnostics v_updated=row_count;
    if v_updated<>1 then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
    return query select 'supplier_claim.expire'::text,1,'claim_not_due'::text,
      v_claim.id,v_claim.status,v_claim.record_version,v_claim.supplier_profile_id,
      null::timestamptz,false;
    return;
  end if;

  v_result_version:=v_claim.record_version+1;
  v_correlation_id:=coalesce(p_correlation_id,pg_catalog.gen_random_uuid());
  update public.supplier_ownership_claims c set status='expired',
    record_version=v_result_version, expired_at=v_command_now,
    expiry_system_source_code='claim_expiry_worker', expiry_policy_version='claim_expiry_v1',
    updated_at=v_command_now
  where c.id=p_claim_id and c.record_version=p_expected_claim_version
    and c.status in ('submitted','under_review');
  get diagnostics v_updated=row_count;
  if v_updated<>1 then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;

  insert into internal.domain_events (
    id,event_type,event_schema_version,aggregate_type,aggregate_id,aggregate_sequence,
    producer_command_name,producer_command_contract_version,producer_idempotency_key_id,
    source_operation_identity,source_system_code,event_ordinal,
    actor_kind,actor_source_code,environment_code,producing_component_code,
    correlation_id,occurred_at,persisted_at,payload,processing_status,available_at
  ) values (
    v_event_id,'supplier_ownership.claim_expired',1,'supplier_ownership_claim',p_claim_id,v_result_version,
    'supplier_claim.expire',1,v_row.id,p_source_item_identity,'mujahiz',1,
    'automated_worker','claim_expiry_worker','local','supplier_claim_expiry_worker',
    v_correlation_id,v_command_now,v_command_now,
    pg_catalog.jsonb_build_object('claim_id',p_claim_id,'supplier_profile_id',v_claim.supplier_profile_id,
      'claimant_user_profile_id',v_claim.claimant_user_profile_id,'claim_version',v_result_version),
    'pending',v_command_now);

  update internal.idempotency_keys set status='completed', lease_token_digest=null,
    lease_digest_key_version=null, lease_expires_at=null, outcome_code='expired',
    result_resource_type='supplier_ownership_claim',result_resource_id=p_claim_id,
    result_version_token=v_result_version::text,completed_at=v_command_now
  where id=v_row.id and status='processing' and attempt_count=v_attempt
    and lease_token_digest=v_fence_digest;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then raise exception using errcode='P5199', message='integrity_reconciliation_required'; end if;
  return query select 'supplier_claim.expire'::text,1,'expired'::text,p_claim_id,'expired'::text,
    v_result_version,v_claim.supplier_profile_id,v_command_now,false;
exception
  when sqlstate 'P5100' or sqlstate 'P5101' or sqlstate 'P5108'
    or sqlstate 'P5109' or sqlstate 'P5110' or sqlstate 'P5111'
    or sqlstate 'P5112' or sqlstate 'P5113' or sqlstate 'P5117'
    or sqlstate 'P5199' then raise;
  when others then
    raise exception using errcode='P5199', message='integrity_reconciliation_required';
end
$function$;

alter function supplier_claim._execute_expire(text, uuid, integer, uuid, uuid) owner to postgres;
revoke all on function supplier_claim._execute_expire(text, uuid, integer, uuid, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime, mujahiz_claim_expiry_worker;
grant execute on function supplier_claim._execute_expire(text, uuid, integer, uuid, uuid)
  to mujahiz_claim_expiry_worker;

revoke all on table public.supplier_ownership_claims from mujahiz_claim_expiry_worker;
revoke all on all tables in schema internal from mujahiz_claim_expiry_worker;
