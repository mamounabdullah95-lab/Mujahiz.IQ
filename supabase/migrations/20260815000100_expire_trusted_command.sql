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
  p_expected_claim_version integer,
  p_stored_expires_at timestamptz
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
     or p_stored_expires_at is null
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
    'stored_expires_at', p_stored_expires_at,
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

alter function supplier_claim._canonicalize_expire_request_v1(text, uuid, integer, timestamptz) owner to postgres;
revoke all on function supplier_claim._canonicalize_expire_request_v1(text, uuid, integer, timestamptz)
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
       or v_claim.expiry_system_source_code is distinct from 'claim_expiry_worker'
       or v_claim.expiry_policy_version is distinct from 'claim_expiry_v1'
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
create function supplier_claim._claim_history_envelope_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare v_claim public.supplier_ownership_claims%rowtype;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  return coalesce((found
    and v_claim.claimant_user_profile_id is not null
    and v_claim.supplier_profile_id is not null
    and v_claim.record_version>=1
    and v_claim.submitted_at is not null
    and v_claim.expires_at=v_claim.submitted_at+interval '720 hours'
    and v_claim.created_at=v_claim.submitted_at
    and v_claim.updated_at>=v_claim.created_at
    and v_claim.submitted_reason is not null
    and pg_catalog.octet_length(v_claim.submitted_reason) between 1 and 2000
    and v_claim.claimant_snapshot_schema_version='claimant_snapshot_v1'
    and pg_catalog.jsonb_typeof(v_claim.claimant_snapshot)='object'
    and v_claim.submission_fingerprint_version='claim_submit_v1'
    and v_claim.submission_fingerprint~'^[0-9a-f]{64}$'
    and v_claim.evidence_schema_version='claim_evidence_v1'
    and pg_catalog.jsonb_typeof(v_claim.evidence_descriptors)='array'),false);
exception when others then return false;
end
$function$;
alter function supplier_claim._claim_history_envelope_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._claim_history_envelope_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;

create function supplier_claim._claim_assignment_history_coherent_v1(
  p_claim_id uuid,p_assignment_required boolean
)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare v_claim public.supplier_ownership_claims%rowtype; v_null boolean; v_assigned boolean;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  if not found then return false; end if;
  v_null:=v_claim.reviewer_user_profile_id is null
    and v_claim.reviewer_assignment_version is null
    and v_claim.reviewer_assigned_at is null
    and v_claim.reviewer_assigned_by_user_profile_id is null
    and v_claim.reviewer_assignment_source_code is null
    and v_claim.reviewer_assignment_policy_version is null;
  v_assigned:=v_claim.reviewer_user_profile_id is not null
    and v_claim.reviewer_assignment_version=1
    and v_claim.reviewer_assigned_at is not null
    and v_claim.reviewer_assigned_by_user_profile_id is not null
    and v_claim.reviewer_assignment_source_code='owner_assignment'
    and v_claim.reviewer_assignment_policy_version='claim_reviewer_assignment_v1'
    and v_claim.reviewer_user_profile_id<>v_claim.claimant_user_profile_id
    and v_claim.reviewer_user_profile_id<>v_claim.reviewer_assigned_by_user_profile_id
    and v_claim.reviewer_assigned_at>=v_claim.submitted_at
    and v_claim.reviewer_assigned_at<v_claim.expires_at
    and v_claim.updated_at>=v_claim.reviewer_assigned_at;
  return coalesce(
    (case when p_assignment_required then v_assigned else v_null or v_assigned end),false);
exception when others then return false;
end
$function$;
alter function supplier_claim._claim_assignment_history_coherent_v1(uuid,boolean) owner to postgres;
revoke all on function supplier_claim._claim_assignment_history_coherent_v1(uuid,boolean)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._withdrawn_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype;
  v_i internal.idempotency_keys%rowtype;
  v_e internal.domain_events%rowtype;
  v_hmac_key text:=nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key',true),'');
  v_expected bytea; v_count integer;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  if not found or not supplier_claim._claim_history_envelope_coherent_v1(p_claim_id)
     or not supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,false)
     or v_claim.status<>'withdrawn' or v_claim.record_version<2
     or v_claim.withdrawn_at is null
     or v_claim.withdrawn_by_user_profile_id is distinct from v_claim.claimant_user_profile_id
     or v_claim.withdrawal_reason_code is distinct from 'claimant_withdrawal'
     or v_claim.withdrawn_at<v_claim.submitted_at
     or v_claim.withdrawn_at>=v_claim.expires_at
     or v_claim.updated_at<>v_claim.withdrawn_at
     or v_claim.decided_by_user_profile_id is not null or v_claim.decided_at is not null
     or v_claim.decision_reason_code is not null
     or v_claim.evidence_verification_method_code is not null
     or v_claim.evidence_verification_version is not null
     or v_claim.evidence_verification_outcome_code is not null
     or v_claim.decision_authorization_policy_version is not null
     or v_claim.reviewer_notes is not null
     or v_claim.expired_at is not null or v_claim.expiry_system_source_code is not null
     or v_claim.expiry_policy_version is not null or v_claim.superseded_at is not null
     or v_claim.supersession_reason_code is not null or v_claim.superseded_by_claim_id is not null
     or v_claim.resulting_supplier_ownership_id is not null
  then return false; end if;

  select count(*) into v_count from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.withdraw'
    and i.command_contract_version=1 and i.target_aggregate_type='supplier_ownership_claim'
    and i.target_aggregate_id=v_claim.id and i.status='completed' and i.outcome_code='withdrawn'
    and i.result_resource_type='supplier_ownership_claim' and i.result_resource_id=v_claim.id
    and i.result_version_token=v_claim.record_version::text and i.completed_at=v_claim.withdrawn_at;
  if v_count<>1 then return false; end if;
  select * into v_i from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.withdraw'
    and i.command_contract_version=1 and i.target_aggregate_id=v_claim.id
    and i.status='completed' and i.outcome_code='withdrawn'
    and i.result_version_token=v_claim.record_version::text and i.completed_at=v_claim.withdrawn_at;
  v_expected:=extensions.hmac(pg_catalog.convert_to('claim-request-fingerprint-v1|'||
    pg_catalog.jsonb_build_object('claim_id',v_claim.id,
      'command_precondition_version','claim_withdraw_preconditions_v1',
      'expected_claim_version',v_claim.record_version-1,
      'withdrawal_policy_version','claim_withdrawal_v1')::text,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256');
  if v_hmac_key is null or v_i.principal_kind<>'human_user'
     or v_i.principal_user_profile_id<>v_claim.claimant_user_profile_id
     or v_i.principal_source_code is not null
     or v_i.upstream_source_system_code is not null or v_i.upstream_request_identity is not null
     or pg_catalog.octet_length(v_i.key_digest)<>32 or v_i.key_digest_key_version<>'local_v1'
     or v_i.request_fingerprint is distinct from v_expected
     or v_i.request_fingerprint_key_version<>'local_v1'
     or v_i.lease_token_digest is not null or v_i.lease_digest_key_version is not null
     or v_i.lease_expires_at is not null or v_i.attempt_count<1
     or v_i.failure_code is not null or v_i.retry_disposition is not null
     or v_i.next_attempt_at is not null or v_i.failed_at is not null
     or v_i.created_at>v_i.completed_at
     or v_i.expires_at<>v_i.created_at+interval '720 hours'
     or v_i.expires_at<=v_i.completed_at
  then return false; end if;

  select count(*) into v_count from internal.domain_events e
  where e.producer_idempotency_key_id=v_i.id;
  if v_count<>1 then return false; end if;
  select * into v_e from internal.domain_events e
  where e.producer_idempotency_key_id=v_i.id and e.event_ordinal=1;
  if not found or v_e.event_type<>'supplier_ownership.claim_withdrawn'
     or v_e.event_schema_version<>1 or v_e.aggregate_type<>'supplier_ownership_claim'
     or v_e.aggregate_id<>v_claim.id or v_e.aggregate_sequence<>v_claim.record_version
     or v_e.producer_command_name<>'supplier_claim.withdraw'
     or v_e.producer_command_contract_version<>1
     or v_e.source_operation_identity is not null or v_e.source_system_code<>'mujahiz'
     or v_e.source_stream_code is not null or v_e.source_event_id is not null
     or v_e.actor_kind<>'human_user' or v_e.actor_user_profile_id<>v_claim.claimant_user_profile_id
     or v_e.actor_source_code is not null or v_e.environment_code<>'local'
     or v_e.producing_component_code<>'supplier_claim_command'
     or v_e.causation_event_id is not null
     or v_e.occurred_at<>v_claim.withdrawn_at or v_e.persisted_at<>v_claim.withdrawn_at
     or v_e.available_at<>v_claim.withdrawn_at or v_e.processing_status<>'pending'
     or v_e.lease_token_digest is not null or v_e.lease_digest_key_version is not null
     or v_e.lease_expires_at is not null or v_e.attempt_count<>0
     or v_e.next_attempt_at is not null or v_e.last_error_class is not null
     or v_e.last_error_code is not null or v_e.processed_at is not null
     or v_e.dead_lettered_at is not null or v_e.is_historical or v_e.fanout_suppressed
     or v_e.migration_classification_code is not null
     or v_e.payload<>pg_catalog.jsonb_build_object('claim_id',v_claim.id,
       'supplier_profile_id',v_claim.supplier_profile_id,
       'claimant_user_profile_id',v_claim.claimant_user_profile_id,
       'claim_version',v_claim.record_version)
     or (select count(*) from internal.domain_events e where e.aggregate_type='supplier_ownership_claim'
       and e.aggregate_id=v_claim.id and e.aggregate_sequence=v_claim.record_version
       and e.event_type='supplier_ownership.claim_withdrawn')<>1
     or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_i.id)
  then return false; end if;
  return true;
exception when others then return false;
end
$function$;
alter function supplier_claim._withdrawn_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._withdrawn_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._rejected_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype;
  v_i internal.idempotency_keys%rowtype; v_e internal.domain_events%rowtype;
  v_a internal.audit_logs%rowtype; v_count integer; v_expected bytea;
  v_hmac_key text:=nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key',true),'');
  v_digest text; v_binding text;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  if not found or not supplier_claim._claim_history_envelope_coherent_v1(p_claim_id)
     or not supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,true)
     or v_claim.status<>'rejected' or v_claim.record_version<3
     or v_claim.decided_by_user_profile_id is distinct from v_claim.reviewer_user_profile_id
     or v_claim.decided_at is null or v_claim.decided_at<v_claim.reviewer_assigned_at
     or v_claim.decided_at>=v_claim.expires_at or v_claim.updated_at<>v_claim.decided_at
     or v_claim.decision_reason_code is null or v_claim.decision_reason_code not in
       ('insufficient_evidence','claimant_ineligible','supplier_mismatch','existing_owner')
     or v_claim.evidence_verification_method_code is distinct from 'manual_review'
     or v_claim.evidence_verification_version is distinct from 'claim_evidence_review_v1'
     or (v_claim.decision_reason_code='insufficient_evidence'
       and v_claim.evidence_verification_outcome_code is distinct from 'not_verified')
     or (v_claim.decision_reason_code<>'insufficient_evidence'
       and v_claim.evidence_verification_outcome_code is distinct from 'verified')
     or v_claim.decision_authorization_policy_version is distinct from 'sec-001-claim-v1'
     or v_claim.reviewer_notes is not null or v_claim.resulting_supplier_ownership_id is not null
     or v_claim.withdrawn_at is not null or v_claim.withdrawn_by_user_profile_id is not null
     or v_claim.withdrawal_reason_code is not null or v_claim.expired_at is not null
     or v_claim.expiry_system_source_code is not null or v_claim.expiry_policy_version is not null
     or v_claim.superseded_at is not null or v_claim.supersession_reason_code is not null
     or v_claim.superseded_by_claim_id is not null
  then return false; end if;

  select count(*) into v_count from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.reject'
    and i.command_contract_version=1 and i.target_aggregate_type='supplier_ownership_claim'
    and i.target_aggregate_id=v_claim.id and i.status='completed' and i.outcome_code='rejected'
    and i.result_resource_type='supplier_ownership_claim' and i.result_resource_id=v_claim.id
    and i.result_version_token=v_claim.record_version::text and i.completed_at=v_claim.decided_at;
  if v_count<>1 then return false; end if;
  select * into v_i from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.reject'
    and i.command_contract_version=1 and i.target_aggregate_id=v_claim.id
    and i.status='completed' and i.outcome_code='rejected'
    and i.result_version_token=v_claim.record_version::text and i.completed_at=v_claim.decided_at;
  if v_i.principal_kind<>'human_user' or v_i.principal_user_profile_id<>v_claim.reviewer_user_profile_id
     or v_i.principal_source_code is not null or v_i.upstream_source_system_code is not null
     or v_i.upstream_request_identity is not null or pg_catalog.octet_length(v_i.key_digest)<>32
     or v_i.key_digest_key_version<>'local_v1' or pg_catalog.octet_length(v_i.request_fingerprint)<>32
     or v_i.request_fingerprint_key_version<>'local_v1' or v_i.lease_token_digest is not null
     or v_i.lease_digest_key_version is not null or v_i.lease_expires_at is not null
     or v_i.attempt_count<1 or v_i.failure_code is not null or v_i.retry_disposition is not null
     or v_i.next_attempt_at is not null or v_i.failed_at is not null
     or v_i.created_at>v_i.completed_at or v_i.expires_at<>v_i.created_at+interval '720 hours'
     or v_i.expires_at<=v_i.completed_at
  then return false; end if;

  select count(*) into v_count from internal.domain_events e where e.producer_idempotency_key_id=v_i.id;
  if v_count<>1 then return false; end if;
  select * into v_e from internal.domain_events e where e.producer_idempotency_key_id=v_i.id;
  if v_e.event_type<>'supplier_ownership.claim_rejected' or v_e.event_schema_version<>1
     or v_e.aggregate_type<>'supplier_ownership_claim' or v_e.aggregate_id<>v_claim.id
     or v_e.aggregate_sequence<>v_claim.record_version or v_e.producer_command_name<>'supplier_claim.reject'
     or v_e.producer_command_contract_version<>1 or v_e.event_ordinal<>1
     or v_e.source_operation_identity is not null or v_e.source_system_code<>'mujahiz'
     or v_e.source_stream_code is not null or v_e.source_event_id is not null
     or v_e.actor_kind<>'human_user' or v_e.actor_user_profile_id<>v_claim.reviewer_user_profile_id
     or v_e.actor_source_code is not null or v_e.environment_code<>'local'
     or v_e.producing_component_code<>'supplier_claim_command' or v_e.causation_event_id is not null
     or v_e.occurred_at<>v_claim.decided_at or v_e.persisted_at<>v_claim.decided_at
     or v_e.available_at<>v_claim.decided_at or v_e.processing_status<>'pending'
     or v_e.lease_token_digest is not null or v_e.lease_digest_key_version is not null
     or v_e.lease_expires_at is not null or v_e.attempt_count<>0 or v_e.next_attempt_at is not null
     or v_e.last_error_class is not null or v_e.last_error_code is not null
     or v_e.processed_at is not null or v_e.dead_lettered_at is not null
     or v_e.is_historical or v_e.fanout_suppressed or v_e.migration_classification_code is not null
     or v_e.payload<>pg_catalog.jsonb_build_object('claim_id',v_claim.id,
       'supplier_profile_id',v_claim.supplier_profile_id,
       'claimant_user_profile_id',v_claim.claimant_user_profile_id,
       'claim_version',v_claim.record_version,'rejection_reason_code',v_claim.decision_reason_code,
       'reason_registry_version','claim_rejection_reason_v1')
     or (select count(*) from internal.domain_events e where e.aggregate_type='supplier_ownership_claim'
       and e.aggregate_id=v_claim.id and e.aggregate_sequence=v_claim.record_version
       and e.event_type='supplier_ownership.claim_rejected')<>1
  then return false; end if;

  select count(*) into v_count from internal.audit_logs a
  where a.idempotency_reference=v_i.id and a.source_operation_class<>'idempotency_conflict';
  if v_count<>1 then return false; end if;
  select * into v_a from internal.audit_logs a
  where a.idempotency_reference=v_i.id and a.source_operation_class<>'idempotency_conflict';
  v_digest:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    'claim-reject-evidence-digest-v1|'||pg_catalog.octet_length(v_a.restricted_evidence_reference)::text
      ||':'||v_a.restricted_evidence_reference,'UTF8'),'sha256'),'hex');
  if coalesce((v_a.action_code<>'supplier_claim.reject' or v_a.action_contract_version<>1
     or v_a.action_class<>'claim_ownership' or v_a.actor_kind<>'human_user'
     or v_a.actor_user_profile_id<>v_claim.reviewer_user_profile_id or v_a.actor_source_code is not null
     or v_a.actor_authorization_snapshot is null or v_a.actor_authorization_snapshot not in ('owner','admin')
     or v_a.target_entity_type<>'supplier_ownership_claim' or v_a.target_id<>v_claim.id
     or v_a.related_target_entity_type<>'supplier_profile' or v_a.related_target_id<>v_claim.supplier_profile_id
     or v_a.occurred_at<>v_claim.decided_at or v_a.recorded_at<>v_claim.decided_at
     or v_a.environment_code<>'local' or v_a.source_system_code<>'mujahiz'
     or v_a.producing_component_code<>'supplier_claim_command'
     or v_a.source_operation_class<>'trusted_command' or v_a.outcome_class<>'succeeded'
     or v_a.result_code<>'rejected' or v_a.reason_code<>v_claim.decision_reason_code
     or v_a.safe_context_schema_version<>'claim_reject_context_v1'
     or (select count(*) from pg_catalog.jsonb_object_keys(v_a.safe_context))<>16
     or v_a.safe_context->>'reason_registry_version' is distinct from 'claim_rejection_reason_v1'
     or v_a.safe_context->>'evidence_policy_version' is distinct from 'claim_reject_evidence_policy_v1'
     or v_a.safe_context->>'evidence_verification_method_code' is distinct from v_claim.evidence_verification_method_code
     or v_a.safe_context->>'evidence_verification_version' is distinct from v_claim.evidence_verification_version
     or v_a.safe_context->>'evidence_verification_outcome_code' is distinct from v_claim.evidence_verification_outcome_code
     or v_a.safe_context->>'evidence_digest_version' is distinct from 'claim_reject_evidence_digest_v1'
     or v_a.safe_context->>'disclosure_policy_version' is distinct from 'claim_reject_disclosure_v1'
     or v_a.safe_context->>'decision_authorization_policy_version' is distinct from 'sec-001-claim-v1'
     or v_a.safe_context->>'reviewer_role_code' is distinct from v_a.actor_authorization_snapshot
     or v_a.safe_context->>'reviewer_conflict_result' is distinct from 'clear'
     or v_a.safe_context->>'provider_state_version' is distinct from 'firebase-provider-state-v1'
     or v_a.safe_context->>'role_policy_version' is distinct from 'platform-role-policy-v1'
     or v_a.safe_context->>'access_policy_version' is distinct from 'platform-access-policy-v1'
     or v_a.safe_context->>'security_policy_version' is distinct from 'platform-admin-security-v1'
     or v_a.safe_context->>'security_coverage_version' is distinct from 'platform-admin-coverage-v1'
     or v_a.safe_context->>'evidence_minimization_version' is distinct from 'platform-admin-minimization-v1'
     or v_a.correlation_id<>v_e.correlation_id or v_a.domain_event_reference<>v_e.id
     or v_a.prior_state_code<>'under_review' or v_a.result_state_code<>'rejected'
     or v_a.prior_record_version<>v_claim.record_version-1 or v_a.result_record_version<>v_claim.record_version
     or v_a.changed_field_codes<>array['status','record_version','decided_by_user_profile_id',
       'decided_at','decision_reason_code','evidence_verification_method_code',
       'evidence_verification_version','evidence_verification_outcome_code',
       'decision_authorization_policy_version']::text[]
     or v_a.evidence_digest<>v_digest or v_a.evidence_digest_algorithm<>'sha256'
     or v_a.evidence_digest_version<>'claim_reject_evidence_digest_v1'
     or v_a.restricted_evidence_reference is null
     or pg_catalog.octet_length(v_a.restricted_evidence_reference) not between 1 and 256
     or v_a.audit_schema_version<>'audit_log_v1' or v_a.action_evidence_schema_version<>'claim_reject_success_v1'
     or v_a.authorization_policy_version<>'sec-001-claim-v1'
     or v_a.producer_contract_version<>'supplier_claim.reject.v1'
     or v_a.minimization_policy_version<>'aud-001-minimized-v1'
     or v_a.retention_class<>'claim_ownership_decision'
     or v_a.legal_hold_classification is not null or v_a.predecessor_audit_log_id is not null
     or v_a.correction_reason_code is not null
  ),true) then return false; end if;
  v_binding:=pg_catalog.encode(extensions.hmac(pg_catalog.convert_to(
    'claim-reject-evidence-reference-v1|'||pg_catalog.jsonb_build_object(
      'restricted_evidence_reference',v_a.restricted_evidence_reference,'evidence_digest',v_a.evidence_digest,
      'evidence_digest_version','claim_reject_evidence_digest_v1')::text,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256'),'hex');
  v_expected:=extensions.hmac(pg_catalog.convert_to('claim-request-fingerprint-v1|'||
    pg_catalog.jsonb_build_object('claim_id',v_claim.id,'expected_claim_version',v_claim.record_version-1,
      'expected_reviewer_assignment_version',v_claim.reviewer_assignment_version,
      'rejection_reason_code',v_claim.decision_reason_code,'reason_registry_version','claim_rejection_reason_v1',
      'evidence_verification_method_code',v_claim.evidence_verification_method_code,
      'evidence_verification_version',v_claim.evidence_verification_version,
      'evidence_verification_outcome_code',v_claim.evidence_verification_outcome_code,
      'evidence_policy_version','claim_reject_evidence_policy_v1','restricted_evidence_binding',v_binding,
      'evidence_digest_version','claim_reject_evidence_digest_v1',
      'disclosure_policy_version','claim_reject_disclosure_v1',
      'decision_authorization_policy_version','sec-001-claim-v1')::text,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256');
  return v_hmac_key is not null and v_i.request_fingerprint is not distinct from v_expected;
exception when others then return false;
end
$function$;
alter function supplier_claim._rejected_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._rejected_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._approval_ownership_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype;
  v_o public.supplier_ownerships%rowtype; v_count integer;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  if not found or not supplier_claim._claim_history_envelope_coherent_v1(p_claim_id)
     or not supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,true)
     or v_claim.status<>'approved' or v_claim.record_version<>3
     or v_claim.decided_by_user_profile_id is distinct from v_claim.reviewer_user_profile_id
     or v_claim.decided_at is null or v_claim.decided_at<v_claim.reviewer_assigned_at
     or v_claim.decided_at>=v_claim.expires_at or v_claim.updated_at<>v_claim.decided_at
     or v_claim.decision_reason_code is distinct from 'verified_claim_approved'
     or v_claim.evidence_verification_method_code is distinct from 'manual_review'
     or v_claim.evidence_verification_version is distinct from 'claim_evidence_review_v1'
     or v_claim.evidence_verification_outcome_code is distinct from 'verified'
     or v_claim.decision_authorization_policy_version is distinct from 'claim_approval_reason_registry_v1'
     or v_claim.reviewer_notes is not null or v_claim.resulting_supplier_ownership_id is null
     or v_claim.withdrawn_at is not null or v_claim.withdrawn_by_user_profile_id is not null
     or v_claim.withdrawal_reason_code is not null or v_claim.expired_at is not null
     or v_claim.expiry_system_source_code is not null or v_claim.expiry_policy_version is not null
     or v_claim.superseded_at is not null or v_claim.supersession_reason_code is not null
     or v_claim.superseded_by_claim_id is not null
  then return false; end if;
  select * into v_o from public.supplier_ownerships where id=v_claim.resulting_supplier_ownership_id;
  if not found or v_o.supplier_profile_id is distinct from v_claim.supplier_profile_id
     or v_o.controller_user_profile_id is distinct from v_claim.claimant_user_profile_id
     or v_o.authority_type is distinct from 'primary_controller'
     or v_o.ownership_status not in ('active','transferred','revoked','superseded')
     or v_o.establishment_source_type is distinct from 'claim_approval'
     or v_o.establishment_reason_code is distinct from 'verified_claim_approved'
     or v_o.established_by_user_profile_id is distinct from v_claim.reviewer_user_profile_id
     or v_o.establishment_system_source is not null
     or v_o.valid_from is distinct from v_claim.decided_at or v_o.established_at is distinct from v_claim.decided_at
     or v_o.created_at is distinct from v_claim.decided_at
     or v_o.created_by_user_profile_id is distinct from v_claim.reviewer_user_profile_id
     or v_o.updated_at<v_o.created_at
  then return false; end if;
  if v_o.ownership_status='active' then
    if v_o.record_version<>1 or v_o.valid_until is not null or v_o.closure_reason_code is not null
       or v_o.closed_by_user_profile_id is not null or v_o.closure_system_source is not null
       or v_o.closed_at is not null or v_o.transfer_successor_ownership_id is not null
       or v_o.updated_at<>v_o.created_at
       or v_o.updated_by_user_profile_id is distinct from v_claim.reviewer_user_profile_id
    then return false; end if;
  else
    if v_o.record_version<2 or v_o.valid_until is null or v_o.valid_until<=v_o.valid_from
       or v_o.closure_reason_code is null or v_o.closed_at is null or v_o.closed_at<v_o.valid_from
       or v_o.updated_at<v_o.closed_at
       or ((v_o.closed_by_user_profile_id is not null)=(v_o.closure_system_source is not null))
       or ((v_o.ownership_status='transferred')<>(v_o.transfer_successor_ownership_id is not null))
    then return false; end if;
    if v_o.ownership_status='transferred' and not exists(
      select 1 from public.supplier_ownerships s
      where s.id=v_o.transfer_successor_ownership_id
        and s.supplier_profile_id=v_o.supplier_profile_id and s.valid_from=v_o.valid_until
    ) then return false; end if;
  end if;
  select count(*) into v_count from public.supplier_ownerships o
  where o.supplier_profile_id=v_claim.supplier_profile_id
    and o.authority_type='primary_controller' and o.valid_from<=v_claim.decided_at
    and (o.valid_until is null or v_claim.decided_at<o.valid_until);
  return v_count=1;
exception when others then return false;
end
$function$;
alter function supplier_claim._approval_ownership_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._approval_ownership_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._approval_audit_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype; v_o public.supplier_ownerships%rowtype;
  v_i internal.idempotency_keys%rowtype; v_e internal.domain_events%rowtype;
  v_a internal.audit_logs%rowtype; v_count integer; v_digest text; v_binding text; v_expected bytea;
  v_hmac_key text:=nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key',true),'');
begin
  if not supplier_claim._approval_ownership_history_coherent_v1(p_claim_id) then return false; end if;
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  select * into v_o from public.supplier_ownerships where id=v_claim.resulting_supplier_ownership_id;
  select count(*) into v_count from internal.audit_logs a
  where a.action_code='supplier_claim.approve' and a.source_operation_class='trusted_command'
    and a.target_entity_type='supplier_ownership_claim' and a.target_id=v_claim.id;
  if v_count<>1 then return false; end if;
  select * into v_a from internal.audit_logs a
  where a.action_code='supplier_claim.approve' and a.source_operation_class='trusted_command'
    and a.target_entity_type='supplier_ownership_claim' and a.target_id=v_claim.id;
  select * into v_i from internal.idempotency_keys where id=v_a.idempotency_reference;
  select * into v_e from internal.domain_events where id=v_a.domain_event_reference;
  if v_i.id is null or v_e.id is null then return false; end if;
  v_digest:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    'claim-approve-evidence-digest-v1|'||pg_catalog.octet_length(v_a.restricted_evidence_reference)::text
      ||':'||v_a.restricted_evidence_reference,'UTF8'),'sha256'),'hex');
  if coalesce((v_a.action_contract_version<>1 or v_a.action_class<>'claim_ownership'
     or v_a.actor_kind<>'human_user' or v_a.actor_user_profile_id<>v_claim.reviewer_user_profile_id
     or v_a.actor_source_code is not null or v_a.actor_authorization_snapshot is null or v_a.actor_authorization_snapshot not in ('owner','admin')
     or v_a.related_target_entity_type<>'supplier_profile' or v_a.related_target_id<>v_claim.supplier_profile_id
     or v_a.occurred_at<>v_claim.decided_at or v_a.recorded_at<>v_claim.decided_at
     or v_a.environment_code<>'local' or v_a.source_system_code<>'mujahiz'
     or v_a.producing_component_code<>'supplier_claim_command'
     or v_a.outcome_class<>'succeeded' or v_a.result_code<>'approved'
     or v_a.reason_code<>'verified_claim_approved'
     or v_a.safe_context_schema_version<>'claim_approve_context_v1'
     or (select count(*) from pg_catalog.jsonb_object_keys(v_a.safe_context))<>19
     or v_a.safe_context->>'reason_registry_version' is distinct from 'claim_approval_reason_registry_v1'
     or v_a.safe_context->>'approval_evidence_policy_version' is distinct from 'claim_approval_evidence_policy_v1'
     or v_a.safe_context->>'evidence_verification_method_code' is distinct from v_claim.evidence_verification_method_code
     or v_a.safe_context->>'evidence_verification_version' is distinct from v_claim.evidence_verification_version
     or v_a.safe_context->>'evidence_verification_outcome_code' is distinct from v_claim.evidence_verification_outcome_code
     or pg_catalog.jsonb_typeof(v_a.safe_context->'checked_source_classes') is distinct from 'array'
     or v_a.safe_context->'checked_source_classes' not in
       ('["authorized_officer_confirmation"]'::jsonb,
        '["claimant_authority","official_registry"]'::jsonb,
        '["company_domain_challenge","independent_supplier_corroboration"]'::jsonb)
     or v_a.safe_context->>'evidence_digest_version' is distinct from 'claim_approve_evidence_digest_v1'
     or v_a.safe_context->>'disclosure_policy_version' is distinct from 'claim_approve_disclosure_v1'
     or v_a.safe_context->>'decision_authorization_policy_version' is distinct from 'sec-001-claim-v1'
     or v_a.safe_context->>'reviewer_role_code' is distinct from v_a.actor_authorization_snapshot
     or v_a.safe_context->>'reviewer_conflict_result' is distinct from 'clear'
     or v_a.safe_context->>'provider_state_version' is distinct from 'firebase-provider-state-v1'
     or v_a.safe_context->>'role_policy_version' is distinct from 'platform-role-policy-v1'
     or v_a.safe_context->>'access_policy_version' is distinct from 'platform-access-policy-v1'
     or v_a.safe_context->>'security_policy_version' is distinct from 'platform-admin-security-v1'
     or v_a.safe_context->>'security_coverage_version' is distinct from 'platform-admin-coverage-v1'
     or v_a.safe_context->>'evidence_minimization_version' is distinct from 'platform-admin-minimization-v1'
     or v_a.safe_context->'resulting_supplier_ownership_id' is distinct from pg_catalog.to_jsonb(v_o.id)
     or pg_catalog.jsonb_typeof(v_a.safe_context->'superseded_claim_count') is distinct from 'number'
     or coalesce(v_a.safe_context->>'superseded_claim_count'!~'^(0|[1-9][0-9]*)$',true)
     or v_a.correlation_id<>v_e.correlation_id or v_a.prior_state_code<>'under_review'
     or v_a.result_state_code<>'approved' or v_a.prior_record_version<>v_claim.record_version-1
     or v_a.result_record_version<>v_claim.record_version
     or v_a.changed_field_codes<>array['status','record_version','decided_by_user_profile_id',
       'decided_at','decision_reason_code','evidence_verification_method_code',
       'evidence_verification_version','evidence_verification_outcome_code',
       'decision_authorization_policy_version','resulting_supplier_ownership_id']::text[]
     or v_a.evidence_digest<>v_digest or v_a.evidence_digest_algorithm<>'sha256'
     or v_a.evidence_digest_version<>'claim_approve_evidence_digest_v1'
     or v_a.restricted_evidence_reference is null
     or pg_catalog.octet_length(v_a.restricted_evidence_reference) not between 1 and 256
     or v_a.audit_schema_version<>'audit_log_v1' or v_a.action_evidence_schema_version<>'claim_approve_success_v1'
     or v_a.authorization_policy_version<>'sec-001-claim-v1'
     or v_a.producer_contract_version<>'supplier_claim.approve.v1'
     or v_a.minimization_policy_version<>'aud-001-minimized-v1'
     or v_a.retention_class<>'claim_ownership_decision'
     or v_a.legal_hold_classification is not null or v_a.predecessor_audit_log_id is not null
     or v_a.correction_reason_code is not null
  ),true) then return false; end if;

  if v_i.environment_code<>'local' or v_i.command_name<>'supplier_claim.approve'
     or v_i.command_contract_version<>1 or v_i.principal_kind<>'human_user'
     or v_i.principal_user_profile_id<>v_claim.reviewer_user_profile_id
     or v_i.principal_source_code is not null or v_i.upstream_source_system_code is not null
     or v_i.upstream_request_identity is not null or v_i.target_aggregate_type<>'supplier_ownership_claim'
     or v_i.target_aggregate_id<>v_claim.id or v_i.status<>'completed' or v_i.outcome_code<>'approved'
     or v_i.result_resource_type<>'supplier_ownership_claim' or v_i.result_resource_id<>v_claim.id
     or v_i.result_version_token<>v_claim.record_version::text or v_i.completed_at<>v_claim.decided_at
     or pg_catalog.octet_length(v_i.key_digest)<>32 or v_i.key_digest_key_version<>'local_v1'
     or pg_catalog.octet_length(v_i.request_fingerprint)<>32 or v_i.request_fingerprint_key_version<>'local_v1'
     or v_i.lease_token_digest is not null or v_i.lease_digest_key_version is not null
     or v_i.lease_expires_at is not null or v_i.attempt_count<1 or v_i.failure_code is not null
     or v_i.retry_disposition is not null or v_i.next_attempt_at is not null or v_i.failed_at is not null
     or v_i.created_at>v_claim.decided_at or v_i.expires_at<>v_i.created_at+interval '720 hours'
     or v_i.expires_at<=v_i.completed_at
  then return false; end if;
  v_binding:=pg_catalog.encode(extensions.hmac(pg_catalog.convert_to(
    'claim-approve-evidence-reference-v1|'||pg_catalog.jsonb_build_object(
      'restricted_evidence_reference',v_a.restricted_evidence_reference,'evidence_digest',v_a.evidence_digest,
      'evidence_digest_version','claim_approve_evidence_digest_v1')::text,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256'),'hex');
  v_expected:=extensions.hmac(pg_catalog.convert_to('claim-request-fingerprint-v1|'||
    pg_catalog.jsonb_build_object('claim_id',v_claim.id,'expected_claim_version',v_claim.record_version-1,
      'expected_reviewer_assignment_version',v_claim.reviewer_assignment_version,
      'evidence_verification_method_code',v_claim.evidence_verification_method_code,
      'evidence_verification_version',v_claim.evidence_verification_version,
      'evidence_verification_outcome_code',v_claim.evidence_verification_outcome_code,
      'checked_source_classes',v_a.safe_context->'checked_source_classes',
      'approval_evidence_policy_version','claim_approval_evidence_policy_v1',
      'reason_registry_version','claim_approval_reason_registry_v1','restricted_evidence_binding',v_binding,
      'evidence_digest_version','claim_approve_evidence_digest_v1',
      'disclosure_policy_version','claim_approve_disclosure_v1',
      'decision_authorization_policy_version','sec-001-claim-v1',
      'supersession_policy_version','claim_approval_reason_registry_v1','reviewer_notes_marker','null')::text,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256');
  if v_hmac_key is null or v_i.request_fingerprint is distinct from v_expected then return false; end if;
  if v_e.event_type<>'supplier_ownership.claim_approved' or v_e.event_schema_version<>1
     or v_e.aggregate_type<>'supplier_ownership_claim' or v_e.aggregate_id<>v_claim.id
     or v_e.aggregate_sequence<>v_claim.record_version or v_e.producer_command_name<>'supplier_claim.approve'
     or v_e.producer_command_contract_version<>1 or v_e.producer_idempotency_key_id<>v_i.id
     or v_e.event_ordinal<>1 or v_e.actor_kind<>'human_user'
     or v_e.actor_user_profile_id<>v_claim.reviewer_user_profile_id
     or v_e.source_operation_identity is not null or v_e.source_system_code<>'mujahiz'
     or v_e.source_stream_code is not null or v_e.source_event_id is not null
     or v_e.actor_source_code is not null or v_e.environment_code<>'local'
     or v_e.producing_component_code<>'supplier_claim_command' or v_e.causation_event_id is not null
     or v_e.occurred_at<>v_claim.decided_at or v_e.persisted_at<>v_claim.decided_at
     or v_e.available_at<>v_claim.decided_at or v_e.processing_status<>'pending'
     or v_e.lease_token_digest is not null or v_e.lease_digest_key_version is not null
     or v_e.lease_expires_at is not null or v_e.attempt_count<>0 or v_e.next_attempt_at is not null
     or v_e.last_error_class is not null or v_e.last_error_code is not null
     or v_e.processed_at is not null or v_e.dead_lettered_at is not null
     or v_e.is_historical or v_e.fanout_suppressed or v_e.migration_classification_code is not null
     or v_e.payload<>pg_catalog.jsonb_build_object('claim_id',v_claim.id,
       'supplier_profile_id',v_claim.supplier_profile_id,
       'claimant_user_profile_id',v_claim.claimant_user_profile_id,
       'ownership_id',v_o.id,'claim_version',v_claim.record_version)
     or (select count(*) from internal.domain_events e where e.event_type='supplier_ownership.claim_approved'
       and e.aggregate_type='supplier_ownership_claim' and e.aggregate_id=v_claim.id)<>1
  then return false; end if;
  return true;
exception when others then return false;
end
$function$;
alter function supplier_claim._approval_audit_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._approval_audit_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._approval_competitor_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype; v_i internal.idempotency_keys%rowtype;
  v_a internal.audit_logs%rowtype; v_expected_count integer; v_event_count integer;
  v_event_ids uuid[]; v_claim_ids uuid[];
begin
  if not supplier_claim._approval_audit_history_coherent_v1(p_claim_id) then return false; end if;
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  select * into v_a from internal.audit_logs a
  where a.action_code='supplier_claim.approve' and a.source_operation_class='trusted_command'
    and a.target_entity_type='supplier_ownership_claim' and a.target_id=v_claim.id;
  select * into v_i from internal.idempotency_keys where id=v_a.idempotency_reference;
  v_expected_count:=(v_a.safe_context->>'superseded_claim_count')::integer;
  select count(*) into v_event_count from internal.domain_events e
  where e.producer_idempotency_key_id=v_i.id;
  if v_event_count<>v_expected_count+1
     or (select min(e.event_ordinal) from internal.domain_events e where e.producer_idempotency_key_id=v_i.id)<>1
     or (select max(e.event_ordinal) from internal.domain_events e where e.producer_idempotency_key_id=v_i.id)<>v_expected_count+1
     or (select count(distinct e.event_ordinal) from internal.domain_events e
         where e.producer_idempotency_key_id=v_i.id)<>v_expected_count+1
  then return false; end if;
  select coalesce(array_agg(e.aggregate_id order by e.event_ordinal),'{}'::uuid[])
    into v_event_ids from internal.domain_events e
    where e.producer_idempotency_key_id=v_i.id and e.event_ordinal>=2;
  select coalesce(array_agg(c.id order by c.id),'{}'::uuid[])
    into v_claim_ids from public.supplier_ownership_claims c
    where c.supplier_profile_id=v_claim.supplier_profile_id and c.status='superseded'
      and c.superseded_by_claim_id=v_claim.id
      and c.supersession_reason_code='competing_claim_superseded_by_approval'
      and c.superseded_at=v_claim.decided_at;
  if cardinality(v_claim_ids)<>v_expected_count or v_event_ids is distinct from v_claim_ids then return false; end if;
  if exists(
    select 1 from public.supplier_ownership_claims c
    where c.id=any(v_claim_ids) and (
      not supplier_claim._claim_history_envelope_coherent_v1(c.id)
      or not supplier_claim._claim_assignment_history_coherent_v1(c.id,false)
      or c.supplier_profile_id<>v_claim.supplier_profile_id or c.status<>'superseded'
      or c.record_version not in (2,3) or c.superseded_at<>v_claim.decided_at
      or c.updated_at<>c.superseded_at
      or c.supersession_reason_code<>'competing_claim_superseded_by_approval'
      or c.superseded_by_claim_id<>v_claim.id or c.resulting_supplier_ownership_id is not null
      or c.decided_by_user_profile_id is not null or c.decided_at is not null
      or c.decision_reason_code is not null or c.evidence_verification_method_code is not null
      or c.evidence_verification_version is not null or c.evidence_verification_outcome_code is not null
      or c.decision_authorization_policy_version is not null or c.reviewer_notes is not null
      or c.withdrawn_at is not null or c.withdrawn_by_user_profile_id is not null
      or c.withdrawal_reason_code is not null or c.expired_at is not null
      or c.expiry_system_source_code is not null or c.expiry_policy_version is not null
    )
  ) then return false; end if;
  if exists(
    select 1 from internal.domain_events e
    left join public.supplier_ownership_claims c on c.id=e.aggregate_id
    where e.producer_idempotency_key_id=v_i.id and e.event_ordinal>=2 and (
      e.event_type<>'supplier_ownership.claim_superseded' or e.event_schema_version<>1
      or e.aggregate_type<>'supplier_ownership_claim' or c.id is null
      or c.supplier_profile_id<>v_claim.supplier_profile_id or c.status<>'superseded'
      or c.superseded_by_claim_id<>v_claim.id
      or e.aggregate_sequence<>c.record_version or e.producer_command_name<>'supplier_claim.approve'
      or e.producer_command_contract_version<>1 or e.source_operation_identity is not null
      or e.source_system_code<>'mujahiz' or e.source_stream_code is not null or e.source_event_id is not null
      or e.actor_kind<>'human_user' or e.actor_user_profile_id<>v_claim.reviewer_user_profile_id
      or e.actor_source_code is not null or e.environment_code<>'local'
      or e.producing_component_code<>'supplier_claim_command' or e.correlation_id<>v_a.correlation_id
      or e.causation_event_id is not null or e.occurred_at<>v_claim.decided_at
      or e.persisted_at<>v_claim.decided_at or e.available_at<>v_claim.decided_at
      or e.processing_status<>'pending' or e.lease_token_digest is not null
      or e.lease_digest_key_version is not null or e.lease_expires_at is not null
      or e.attempt_count<>0 or e.next_attempt_at is not null or e.last_error_class is not null
      or e.last_error_code is not null or e.processed_at is not null or e.dead_lettered_at is not null
      or e.is_historical or e.fanout_suppressed or e.migration_classification_code is not null
      or e.payload<>pg_catalog.jsonb_build_object('claim_id',c.id,
        'supplier_profile_id',c.supplier_profile_id,'claimant_user_profile_id',c.claimant_user_profile_id,
        'approved_claim_id',v_claim.id,'claim_version',c.record_version)
    )
  ) then return false; end if;
  return true;
exception when others then return false;
end
$function$;
alter function supplier_claim._approval_competitor_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._approval_competitor_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;

create function supplier_claim._approved_history_coherent_v1(p_claim_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
return coalesce((supplier_claim._approval_audit_history_coherent_v1(p_claim_id)
  and supplier_claim._approval_competitor_history_coherent_v1(p_claim_id)),false);
alter function supplier_claim._approved_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._approved_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._expired_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare
  v_claim public.supplier_ownership_claims%rowtype; v_i internal.idempotency_keys%rowtype;
  v_e internal.domain_events%rowtype; v_count integer; v_expected_key bytea; v_expected_request bytea;
  v_hmac_key text:=nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key',true),'');
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  if not found or not supplier_claim._claim_history_envelope_coherent_v1(p_claim_id)
     or not supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,false)
     or v_claim.status<>'expired' or v_claim.record_version<2
     or v_claim.expired_at is null or v_claim.expired_at<v_claim.expires_at
     or v_claim.updated_at<>v_claim.expired_at
     or v_claim.expiry_system_source_code is distinct from 'claim_expiry_worker'
     or v_claim.expiry_policy_version is distinct from 'claim_expiry_v1'
     or v_claim.decided_by_user_profile_id is not null or v_claim.decided_at is not null
     or v_claim.decision_reason_code is not null or v_claim.evidence_verification_method_code is not null
     or v_claim.evidence_verification_version is not null or v_claim.evidence_verification_outcome_code is not null
     or v_claim.decision_authorization_policy_version is not null or v_claim.reviewer_notes is not null
     or v_claim.withdrawn_at is not null or v_claim.withdrawn_by_user_profile_id is not null
     or v_claim.withdrawal_reason_code is not null or v_claim.superseded_at is not null
     or v_claim.supersession_reason_code is not null or v_claim.superseded_by_claim_id is not null
     or v_claim.resulting_supplier_ownership_id is not null
  then return false; end if;
  select count(*) into v_count from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.expire'
    and i.command_contract_version=1 and i.target_aggregate_type='supplier_ownership_claim'
    and i.target_aggregate_id=v_claim.id and i.status='completed' and i.outcome_code='expired'
    and i.result_resource_type='supplier_ownership_claim' and i.result_resource_id=v_claim.id
    and i.result_version_token=v_claim.record_version::text and i.completed_at=v_claim.expired_at;
  if v_count<>1 then return false; end if;
  select * into v_i from internal.idempotency_keys i
  where i.environment_code='local' and i.command_name='supplier_claim.expire'
    and i.command_contract_version=1 and i.target_aggregate_id=v_claim.id
    and i.status='completed' and i.outcome_code='expired'
    and i.result_version_token=v_claim.record_version::text and i.completed_at=v_claim.expired_at;
  v_expected_key:=extensions.hmac(pg_catalog.convert_to(
    'claim-idempotency-key-v1|local|supplier_claim.expire|1|claim_expiry_scheduler|'
      ||pg_catalog.octet_length(v_i.upstream_request_identity)::text||':'||v_i.upstream_request_identity,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256');
  v_expected_request:=extensions.hmac(pg_catalog.convert_to('claim-request-fingerprint-v1|'||
    pg_catalog.jsonb_build_object('claim_id',v_claim.id,
      'command_precondition_version','claim_expire_preconditions_v1',
      'expected_claim_version',v_claim.record_version-1,
      'expiry_policy_version','claim_expiry_v1','expiry_system_source_code','claim_expiry_worker',
      'source_item_identity',v_i.upstream_request_identity,'stored_expires_at',v_claim.expires_at,
      'upstream_source_system_code','claim_expiry_scheduler')::text,'UTF8'),
    pg_catalog.convert_to(v_hmac_key,'UTF8'),'sha256');
  if v_hmac_key is null or v_i.principal_kind<>'automated_worker'
     or v_i.principal_user_profile_id is not null or v_i.principal_source_code<>'claim_expiry_worker'
     or v_i.upstream_source_system_code<>'claim_expiry_scheduler'
     or v_i.upstream_request_identity is null
     or pg_catalog.octet_length(v_i.upstream_request_identity) not between 1 and 256
     or v_i.key_digest is distinct from v_expected_key or v_i.key_digest_key_version<>'local_v1'
     or v_i.request_fingerprint is distinct from v_expected_request
     or v_i.request_fingerprint_key_version<>'local_v1'
     or v_i.lease_token_digest is not null or v_i.lease_digest_key_version is not null
     or v_i.lease_expires_at is not null or v_i.attempt_count<1 or v_i.failure_code is not null
     or v_i.retry_disposition is not null or v_i.next_attempt_at is not null or v_i.failed_at is not null
     or v_i.created_at>v_i.completed_at or v_i.expires_at<>v_i.created_at+interval '720 hours'
     or v_i.expires_at<=v_i.completed_at
  then return false; end if;
  select count(*) into v_count from internal.domain_events e where e.producer_idempotency_key_id=v_i.id;
  if v_count<>1 then return false; end if;
  select * into v_e from internal.domain_events e where e.producer_idempotency_key_id=v_i.id;
  if v_e.event_type<>'supplier_ownership.claim_expired' or v_e.event_schema_version<>1
     or v_e.aggregate_type<>'supplier_ownership_claim' or v_e.aggregate_id<>v_claim.id
     or v_e.aggregate_sequence<>v_claim.record_version or v_e.producer_command_name<>'supplier_claim.expire'
     or v_e.producer_command_contract_version<>1 or v_e.event_ordinal<>1
     or v_e.source_operation_identity is distinct from v_i.upstream_request_identity or v_e.source_system_code<>'mujahiz'
     or v_e.source_stream_code is not null or v_e.source_event_id is not null
     or v_e.actor_kind<>'automated_worker' or v_e.actor_user_profile_id is not null
     or v_e.actor_source_code<>'claim_expiry_worker' or v_e.environment_code<>'local'
     or v_e.producing_component_code<>'supplier_claim_expiry_worker' or v_e.causation_event_id is not null
     or v_e.occurred_at<>v_claim.expired_at or v_e.persisted_at<>v_claim.expired_at
     or v_e.available_at<>v_claim.expired_at or v_e.processing_status<>'pending'
     or v_e.lease_token_digest is not null or v_e.lease_digest_key_version is not null
     or v_e.lease_expires_at is not null or v_e.attempt_count<>0 or v_e.next_attempt_at is not null
     or v_e.last_error_class is not null or v_e.last_error_code is not null
     or v_e.processed_at is not null or v_e.dead_lettered_at is not null
     or v_e.is_historical or v_e.fanout_suppressed or v_e.migration_classification_code is not null
     or v_e.payload<>pg_catalog.jsonb_build_object('claim_id',v_claim.id,
       'supplier_profile_id',v_claim.supplier_profile_id,
       'claimant_user_profile_id',v_claim.claimant_user_profile_id,'claim_version',v_claim.record_version)
     or (select count(*) from internal.domain_events e where e.event_type='supplier_ownership.claim_expired'
       and e.aggregate_type='supplier_ownership_claim' and e.aggregate_id=v_claim.id
       and e.aggregate_sequence=v_claim.record_version)<>1
     or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_i.id)
  then return false; end if;
  return true;
exception when others then return false;
end
$function$;
alter function supplier_claim._expired_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._expired_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._superseded_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare v_claim public.supplier_ownership_claims%rowtype; v_winner public.supplier_ownership_claims%rowtype;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  if not found or not supplier_claim._claim_history_envelope_coherent_v1(p_claim_id)
     or not supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,false)
     or v_claim.status<>'superseded' or v_claim.record_version not in (2,3)
     or v_claim.superseded_at is null or v_claim.updated_at<>v_claim.superseded_at
     or v_claim.supersession_reason_code is distinct from 'competing_claim_superseded_by_approval'
     or v_claim.superseded_by_claim_id is null or v_claim.resulting_supplier_ownership_id is not null
     or v_claim.decided_by_user_profile_id is not null or v_claim.decided_at is not null
     or v_claim.decision_reason_code is not null or v_claim.evidence_verification_method_code is not null
     or v_claim.evidence_verification_version is not null or v_claim.evidence_verification_outcome_code is not null
     or v_claim.decision_authorization_policy_version is not null or v_claim.reviewer_notes is not null
     or v_claim.withdrawn_at is not null or v_claim.withdrawn_by_user_profile_id is not null
     or v_claim.withdrawal_reason_code is not null or v_claim.expired_at is not null
     or v_claim.expiry_system_source_code is not null or v_claim.expiry_policy_version is not null
  then return false; end if;
  select * into v_winner from public.supplier_ownership_claims where id=v_claim.superseded_by_claim_id;
  return coalesce((found and v_winner.status='approved'
    and v_winner.supplier_profile_id=v_claim.supplier_profile_id
    and v_winner.decided_at=v_claim.superseded_at
    and supplier_claim._approved_history_coherent_v1(v_winner.id)),false);
exception when others then return false;
end
$function$;
alter function supplier_claim._superseded_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._superseded_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;

create or replace function supplier_claim._terminal_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare v_status text;
begin
  select status into v_status from public.supplier_ownership_claims where id=p_claim_id;
  if not found then return false; end if;
  return coalesce((case v_status
    when 'withdrawn' then supplier_claim._withdrawn_history_coherent_v1(p_claim_id)
    when 'rejected' then supplier_claim._rejected_history_coherent_v1(p_claim_id)
    when 'approved' then supplier_claim._approved_history_coherent_v1(p_claim_id)
    when 'superseded' then supplier_claim._superseded_history_coherent_v1(p_claim_id)
    when 'expired' then supplier_claim._expired_history_coherent_v1(p_claim_id)
    else false end),false);
exception when others then return false;
end
$function$;
alter function supplier_claim._terminal_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._terminal_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
create function supplier_claim._active_claim_history_coherent_v1(p_claim_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare v_claim public.supplier_ownership_claims%rowtype;
begin
  select * into v_claim from public.supplier_ownership_claims where id=p_claim_id;
  return coalesce((found and supplier_claim._claim_history_envelope_coherent_v1(p_claim_id)
    and v_claim.status in ('submitted','under_review')
    and ((v_claim.status='submitted' and v_claim.record_version=1
          and supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,false)
          and v_claim.reviewer_user_profile_id is null)
      or (v_claim.status='under_review' and v_claim.record_version=2
          and supplier_claim._claim_assignment_history_coherent_v1(p_claim_id,true)))
    and v_claim.decided_by_user_profile_id is null and v_claim.decided_at is null
    and v_claim.decision_reason_code is null and v_claim.evidence_verification_method_code is null
    and v_claim.evidence_verification_version is null and v_claim.evidence_verification_outcome_code is null
    and v_claim.decision_authorization_policy_version is null and v_claim.reviewer_notes is null
    and v_claim.withdrawn_at is null and v_claim.withdrawn_by_user_profile_id is null
    and v_claim.withdrawal_reason_code is null and v_claim.expired_at is null
    and v_claim.expiry_system_source_code is null and v_claim.expiry_policy_version is null
    and v_claim.superseded_at is null and v_claim.supersession_reason_code is null
    and v_claim.superseded_by_claim_id is null and v_claim.resulting_supplier_ownership_id is null),false);
exception when others then return false;
end
$function$;
alter function supplier_claim._active_claim_history_coherent_v1(uuid) owner to postgres;
revoke all on function supplier_claim._active_claim_history_coherent_v1(uuid)
  from public,anon,authenticated,service_role,mujahiz_claim_runtime,mujahiz_claim_expiry_worker;
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
  v_stored_expires_at timestamptz;
  v_replay_version integer;
  v_replay_status text;
  v_inserted boolean;
begin
  perform 1 from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity,p_claim_id,p_expected_claim_version,'epoch'::timestamptz);
  select c.expires_at into v_stored_expires_at
  from public.supplier_ownership_claims c where c.id=p_claim_id;
  if not found then
    raise exception using errcode='P5111', message='claim_not_found';
  end if;
  select * into v_request from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity,p_claim_id,p_expected_claim_version,v_stored_expires_at);
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
      if v_row.outcome_code not in ('expired','claim_not_due','already_terminal')
         or v_row.result_resource_type<>'supplier_ownership_claim'
         or v_row.result_resource_id is distinct from p_claim_id
         or v_row.result_version_token is null
         or v_row.result_version_token!~'^[1-9][0-9]{0,9}$'
         or v_row.completed_at is null or v_row.created_at>v_row.completed_at
         or v_row.expires_at<>v_row.created_at+interval '720 hours'
         or v_row.expires_at<=v_row.completed_at
         or v_row.lease_token_digest is not null
         or v_row.lease_digest_key_version is not null
         or v_row.lease_expires_at is not null or v_row.attempt_count<1
         or v_row.failure_code is not null or v_row.retry_disposition is not null
         or v_row.next_attempt_at is not null or v_row.failed_at is not null
      then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end if;
      begin v_replay_version:=v_row.result_version_token::integer;
      exception when others then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end;
      select * into v_claim from public.supplier_ownership_claims c where c.id=p_claim_id;
      if not found or not supplier_claim._claim_history_envelope_coherent_v1(v_claim.id)
         or v_claim.expires_at is distinct from v_stored_expires_at
      then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end if;
      if v_row.outcome_code='expired' then
        if v_claim.record_version<>v_replay_version or v_claim.status<>'expired'
           or v_row.completed_at<>v_claim.expired_at
           or not supplier_claim._expired_history_coherent_v1(v_claim.id)
           or (select count(*) from internal.domain_events e where e.producer_idempotency_key_id=v_row.id)<>1
           or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_row.id)
        then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end if;
        v_replay_status:='expired';
      elsif v_row.outcome_code='already_terminal' then
        if v_claim.record_version<>v_replay_version
           or not supplier_claim._terminal_history_coherent_v1(v_claim.id)
           or exists(select 1 from internal.domain_events e where e.producer_idempotency_key_id=v_row.id)
           or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_row.id)
        then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end if;
        v_replay_status:=v_claim.status;
      else
        if v_replay_version<>p_expected_claim_version
           or v_row.completed_at>=v_stored_expires_at
           or v_claim.record_version<v_replay_version
           or exists(select 1 from internal.domain_events e where e.producer_idempotency_key_id=v_row.id)
           or exists(select 1 from internal.audit_logs a where a.idempotency_reference=v_row.id)
           or not (supplier_claim._active_claim_history_coherent_v1(v_claim.id)
             or supplier_claim._terminal_history_coherent_v1(v_claim.id))
        then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end if;
        v_replay_status:=case v_replay_version when 1 then 'submitted' else 'under_review' end;
      end if;
      return query select 'replay'::text,null::uuid,'supplier_claim.expire'::text,1,
        v_row.outcome_code,v_claim.id,v_replay_status,v_replay_version,
        v_claim.supplier_profile_id,
        case when v_row.outcome_code='expired' then v_claim.expired_at else null::timestamptz end,true;
      return;    elsif v_row.status = 'processing' then
      if v_row.lease_expires_at > v_now then
        raise exception using errcode = 'P5109', message = 'command_in_progress';
      end if;
      if v_row.attempt_count >= 10 then
        update internal.idempotency_keys set status='failed',lease_token_digest=null,
          lease_digest_key_version=null,lease_expires_at=null,
          failure_code='attempt_limit_exceeded',retry_disposition='terminal',
          next_attempt_at=null,failed_at=v_now where id=v_row.id;
        return query select 'reconciliation_required'::text,null::uuid,
          'supplier_claim.expire'::text,1,'reconciliation_required'::text,p_claim_id,
          null::text,null::integer,null::uuid,null::timestamptz,false;
        return;
      end if;
      update internal.idempotency_keys set lease_token_digest=v_fence_digest,
        lease_digest_key_version='local_v1', lease_expires_at=v_now+interval '60 seconds',
        attempt_count=attempt_count+1 where id=v_row.id returning * into v_row;
    elsif v_row.status='failed' and v_row.retry_disposition='terminal'
          and v_row.failure_code='attempt_limit_exceeded' then
      if v_row.lease_token_digest is not null or v_row.lease_digest_key_version is not null
         or v_row.lease_expires_at is not null or v_row.failed_at is null
      then raise exception using errcode='P5199',message='integrity_reconciliation_required'; end if;
      return query select 'reconciliation_required'::text,null::uuid,
        'supplier_claim.expire'::text,1,'reconciliation_required'::text,p_claim_id,
        null::text,null::integer,null::uuid,null::timestamptz,true;
      return;
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
    or sqlstate 'P5109' or sqlstate 'P5110' or sqlstate 'P5111'
    or sqlstate 'P5199' then raise;
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
  v_routed_expires_at timestamptz;
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
  perform 1 from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity,p_claim_id,p_expected_claim_version,'epoch'::timestamptz);
  select c.expires_at into v_routed_expires_at
  from public.supplier_ownership_claims c where c.id=p_claim_id;
  if not found then raise exception using errcode='P5111', message='claim_not_found'; end if;
  select * into v_request from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity,p_claim_id,p_expected_claim_version,v_routed_expires_at);
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

  select c.claimant_user_profile_id,c.supplier_profile_id,c.expires_at
    into v_routed_claimant_id,v_routed_supplier_id,v_routed_expires_at
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

  select * into v_request from supplier_claim._canonicalize_expire_request_v1(
    p_source_item_identity,p_claim_id,p_expected_claim_version,v_claim.expires_at);
  if v_row.request_fingerprint is distinct from v_request.request_fingerprint then
    raise exception using errcode='P5108', message='idempotency_key_conflict';
  end if;

  if v_claim.status in ('submitted','under_review') and (
       v_active_ownership_count>0
       or not supplier_claim._active_claim_history_coherent_v1(v_claim.id)
     ) then
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
         or v_claim.expiry_system_source_code is distinct from 'claim_expiry_worker'
         or v_claim.expiry_policy_version is distinct from 'claim_expiry_v1'
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
