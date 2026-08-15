-- Focused local-only pgTAP for supplier_claim.expire v1.
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('supplier_claim','expire',array['text','uuid','integer','uuid'],
  'public expire Phase A has the exact v1 signature');
select has_function('supplier_claim','_execute_expire',
  array['text','uuid','integer','uuid','uuid'],
  'private fenced Phase B has the exact v1 signature');
select ok((select not rolcanlogin and not rolinherit and not rolsuper
  and not rolbypassrls from pg_catalog.pg_roles
  where rolname='mujahiz_claim_expiry_worker'),
  'expiry worker is NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS');
select ok(has_function_privilege('mujahiz_claim_expiry_worker',
  'supplier_claim.expire(text,uuid,integer,uuid)','EXECUTE'),
  'dedicated worker can execute Phase A');
select ok(has_function_privilege('mujahiz_claim_expiry_worker',
  'supplier_claim._execute_expire(text,uuid,integer,uuid,uuid)','EXECUTE'),
  'dedicated worker can execute fenced Phase B');
select ok(not has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.expire(text,uuid,integer,uuid)','EXECUTE'),
  'human runtime cannot execute expiry');
select ok(not has_function_privilege('service_role',
  'supplier_claim.expire(text,uuid,integer,uuid)','EXECUTE'),
  'generic service role cannot execute expiry');
select ok(not has_table_privilege('mujahiz_claim_expiry_worker',
  'public.supplier_ownership_claims','SELECT,INSERT,UPDATE,DELETE'),
  'worker has no direct Claim-table authority');
select is((select count(*) from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid=p.polrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='supplier_ownership_claims'
    and p.polcmd='r'),3::bigint,'exactly three Claim SELECT policies remain');
select is((select count(*) from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid=p.polrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='supplier_ownership_claims'
    and p.polcmd<>'r'),0::bigint,'no Claim mutation policy is added');

create function pg_temp.expire_id(p integer) returns uuid
language sql immutable set search_path=pg_catalog
return ('e1000000-0000-4000-8000-'||pg_catalog.lpad(p::text,12,'0'))::uuid;

create function pg_temp.seed_profile(p integer) returns uuid
language plpgsql volatile set search_path=pg_catalog as $$
declare v uuid:=pg_temp.expire_id(p); n timestamptz:=pg_catalog.clock_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,account_status,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v,'Expire profile '||p,'supplier','active','verified',
    n-interval '1 day',n-interval '10 days',n);
  insert into internal.identity_provider_links(id,user_profile_id,provider_code,
    provider_subject,is_primary,link_status,identity_status,verification_status,
    provider_state_observed_at,provider_state_version,linked_at,verified_at,created_at)
  values(v,v,'firebase','expire-profile-'||p,true,'linked','active','verified',
    n-interval '1 day','firebase-provider-state-v1',n-interval '10 days',
    n-interval '2 days',n-interval '10 days');
  return v;
end $$;

create function pg_temp.seed_supplier(p integer) returns uuid
language plpgsql volatile set search_path=pg_catalog as $$
declare v uuid:=pg_temp.expire_id(p);
begin
  insert into public.supplier_profiles(id,name_original,display_name,name_language,
    name_en,business_type,listing_status,verification_status,source_type,
    confidence_level,has_direct_experience)
  values(v,'Expire Supplier '||p,'Expire Supplier '||p,'english',
    'Expire Supplier '||p,'company','approved','verified','other','low','no');
  return v;
end $$;

create function pg_temp.seed_claim(p integer,p_claimant integer,p_supplier integer,
  p_status text,p_due boolean,p_reviewer integer default 3,p_assigner integer default 4) returns uuid
language plpgsql volatile set search_path=pg_catalog as $$
declare v uuid:=pg_temp.expire_id(p); n timestamptz:=pg_catalog.clock_timestamp();
  s timestamptz:=case when p_due then n-interval '721 hours' else n-interval '1 hour' end;
begin
  insert into public.supplier_ownership_claims(
    id,claimant_user_profile_id,supplier_profile_id,status,record_version,
    submitted_at,expires_at,submitted_reason,claimant_snapshot_schema_version,
    claimant_snapshot,submission_fingerprint_version,submission_fingerprint,
    evidence_schema_version,evidence_descriptors,
    reviewer_user_profile_id,reviewer_assignment_version,reviewer_assigned_at,
    reviewer_assigned_by_user_profile_id,reviewer_assignment_source_code,
    reviewer_assignment_policy_version,created_at,updated_at)
  values(v,pg_temp.expire_id(p_claimant),pg_temp.expire_id(p_supplier),p_status,
    case when p_status='under_review' then 2 else 1 end,s,s+interval '720 hours',
    'Synthetic expire claim','claimant_snapshot_v1','{"full_name":"Synthetic"}',
    'claim_submit_v1',pg_catalog.repeat('e',64),'claim_evidence_v1','[]',
    case when p_status='under_review' then pg_temp.expire_id(p_reviewer) end,
    case when p_status='under_review' then 1 end,
    case when p_status='under_review' then s+interval '1 minute' end,
    case when p_status='under_review' then pg_temp.expire_id(p_assigner) end,
    case when p_status='under_review' then 'owner_assignment' end,
    case when p_status='under_review' then 'claim_reviewer_assignment_v1' end,
    s,case when p_status='under_review' then s+interval '1 minute' else s end);
  return v;
end $$;

create function pg_temp.seed_actor(p integer,p_role text) returns uuid
language plpgsql volatile set search_path=pg_catalog as $$
declare v uuid:=pg_temp.expire_id(p); n timestamptz:=pg_catalog.clock_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,account_status,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v,'Expire actor '||p,'buyer','active','verified',n-interval '1 day',n-interval '10 days',n);
  insert into internal.identity_provider_links(id,user_profile_id,provider_code,
    provider_subject,is_primary,link_status,identity_status,verification_status,
    provider_state_observed_at,provider_state_version,linked_at,verified_at,created_at)
  values(v,v,'firebase','expire-actor-'||p,true,'linked','active','verified',
    n-interval '1 day','firebase-provider-state-v1',n-interval '10 days',n-interval '2 days',n-interval '10 days');
  insert into public.platform_role_assignments(id,user_profile_id,role_code,
    assignment_status,valid_from,assignment_source_type,assignment_reason_code,
    authorization_policy_version,evidence_reference,assignment_system_source,assigned_at,created_at,updated_at)
  values(v,v,p_role,'active',n-interval '2 days','bootstrap_manifest','expire_test',
    'platform-role-policy-v1','expire-role-evidence','expire_test',n-interval '2 days',n-interval '2 days',n);
  insert into public.access_grants(id,user_profile_id,platform_role_assignment_id,
    role_code,access_status,valid_from,valid_until,grant_source_type,grant_reason_code,
    authorization_policy_version,evidence_reference,grant_system_source,granted_at,created_at,updated_at)
  values(v,v,v,p_role,'active',n-interval '1 day',
    case when p_role='admin' then n+interval '30 days' else null end,
    'bootstrap_manifest','expire_test',
    'platform-access-policy-v1','expire-access-evidence','expire_test',n-interval '1 day',n-interval '1 day',n);
  insert into internal.security_eligibility_assessments(id,user_profile_id,
    assessment_result,condition_type,valid_from,assessment_status,assessment_source_type,
    assessment_reason_code,security_policy_version,required_coverage_version,
    evidence_minimization_version,evidence_reference,assessment_system_source,assessed_at,created_at,updated_at)
  values(v,v,'clear','complete_clear',n-interval '1 day','active','bootstrap_manifest','expire_test',
    'platform-admin-security-v1','platform-admin-coverage-v1','platform-admin-minimization-v1',
    'expire-security-evidence','expire_test',n-interval '1 day',n-interval '1 day',n);
  return v;
end $$;

create function pg_temp.run_withdraw(p_actor uuid,p_key text,p_claim uuid,p_version integer)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare r record; result jsonb; v_key text := 'claim-'||pg_catalog.md5(p_key);
begin
  perform claim_security.establish_claim_runtime_context(p_actor);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into r from supplier_claim.reserve_withdraw(v_key,p_claim,p_version);
  select pg_catalog.to_jsonb(x) into result from supplier_claim.withdraw(v_key,p_claim,p_version,null,r.execution_fence)x;
  return result;
end $$;

create function pg_temp.run_reject(p_actor uuid,p_key text,p_claim uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare r record; result jsonb; v_key text := 'claim-'||pg_catalog.md5(p_key);
begin
  perform claim_security.establish_claim_runtime_context(p_actor);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into r from supplier_claim.reject(v_key,p_claim,2,1,'supplier_mismatch',
    'manual_review','claim_evidence_review_v1','verified','expire-reject-evidence',null);
  select pg_catalog.to_jsonb(x) into result from supplier_claim._execute_reject(
    v_key,p_claim,2,1,'supplier_mismatch','manual_review','claim_evidence_review_v1',
    'verified','expire-reject-evidence',null,r.execution_fence)x;
  return result;
end $$;

create function pg_temp.run_approve(p_actor uuid,p_key text,p_claim uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare r record; result jsonb; v_key text := 'claim-'||pg_catalog.md5(p_key);
begin
  perform claim_security.establish_claim_runtime_context(p_actor);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into r from supplier_claim.approve(v_key,p_claim,2,1,'manual_review',
    'claim_evidence_review_v1','verified',array['authorized_officer_confirmation'],'expire-approve-evidence',null);
  select pg_catalog.to_jsonb(x) into result from supplier_claim._execute_approve(
    v_key,p_claim,2,1,'manual_review','claim_evidence_review_v1','verified',
    array['authorized_officer_confirmation'],'expire-approve-evidence',pg_catalog.gen_random_uuid(),r.execution_fence)x;
  return result;
end $$;
create function pg_temp.run_expire(p_source text,p_claim uuid,p_version integer)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare r record; result jsonb;
begin
  perform pg_catalog.set_config('mujahiz.claim.environment','local',true);
  perform pg_catalog.set_config('mujahiz.claim.worker_purpose','supplier_claim_expiry',true);
  perform pg_catalog.set_config('mujahiz.claim.expiry_policy_version','claim_expiry_v1',true);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into r from supplier_claim.expire(p_source,p_claim,p_version,null);
  if r.reservation_outcome='execute' then
    select pg_catalog.to_jsonb(x) into result from supplier_claim._execute_expire(
      p_source,p_claim,p_version,null,r.execution_fence)x;
    return result||pg_catalog.jsonb_build_object('reservation_outcome','execute');
  end if;
  return pg_catalog.to_jsonb(r);
end $$;
select pg_temp.seed_profile(n) from generate_series(1,4)n;
select pg_temp.seed_supplier(n) from generate_series(11,14)n;
select pg_temp.seed_claim(101,1,11,'submitted',true);
select pg_temp.seed_claim(102,2,12,'under_review',true);
select pg_temp.seed_claim(103,1,13,'submitted',false);
select pg_temp.seed_claim(104,2,14,'submitted',true);
select pg_temp.seed_actor(5,'owner');
select pg_temp.seed_actor(6,'admin');
select pg_temp.seed_profile(n) from generate_series(7,26)n;
select pg_temp.seed_supplier(n) from generate_series(21,38)n;
select pg_temp.seed_claim(201,7,21,'submitted',false);
select pg_temp.seed_claim(202,8,22,'submitted',false);
select pg_temp.seed_claim(203,9,23,'under_review',false,5,6);
select pg_temp.seed_claim(204,10,24,'under_review',false,5,6);
select pg_temp.seed_claim(205,11,25,'under_review',false,5,6);
select pg_temp.seed_claim(206,12,25,'submitted',false);
select pg_temp.seed_claim(207,13,26,'under_review',false,5,6);
select pg_temp.seed_claim(208,14,27,'under_review',false,5,6);
select pg_temp.seed_claim(209,15,28,'under_review',false,5,6);
select pg_temp.seed_claim(210,16,28,'submitted',false);
select pg_temp.seed_claim(211,17,29,'submitted',true);
select pg_temp.seed_claim(212,18,30,'submitted',true);
select pg_temp.seed_claim(213,19,31,'submitted',false);
select pg_temp.seed_claim(214,20,32,'submitted',false);
select pg_temp.seed_claim(215,21,33,'under_review',true,5,6);
select pg_temp.seed_claim(216,22,34,'under_review',true,5,6);
select pg_temp.seed_claim(217,23,35,'submitted',true);
select pg_temp.seed_claim(218,24,36,'submitted',true);
select pg_temp.seed_claim(219,25,37,'submitted',true);
select pg_temp.seed_claim(220,26,38,'submitted',false);

grant mujahiz_claim_runtime to postgres with set true;
grant mujahiz_claim_expiry_worker to postgres with set true;
grant usage on schema extensions to mujahiz_claim_expiry_worker;
set role mujahiz_claim_expiry_worker;
set mujahiz.claim.environment='local';
set mujahiz.claim.worker_purpose='supplier_claim_expiry';
set mujahiz.claim.expiry_policy_version='claim_expiry_v1';
set mujahiz.claim.hmac_key='kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk';

select execution_fence::text as due_fence
from supplier_claim.expire('observation-due-submitted',
  'e1000000-0000-4000-8000-000000000101',1,null) \gset
select row_to_json(r)::text as due_result
from supplier_claim._execute_expire('observation-due-submitted',
  'e1000000-0000-4000-8000-000000000101',1,null,:'due_fence'::uuid)r \gset

select execution_fence::text as assigned_fence
from supplier_claim.expire('observation-due-assigned',
  'e1000000-0000-4000-8000-000000000102',2,null) \gset
select row_to_json(r)::text as assigned_result
from supplier_claim._execute_expire('observation-due-assigned',
  'e1000000-0000-4000-8000-000000000102',2,null,:'assigned_fence'::uuid)r \gset

select execution_fence::text as early_fence
from supplier_claim.expire('observation-before-expiry',
  'e1000000-0000-4000-8000-000000000103',1,null) \gset
select row_to_json(r)::text as early_result
from supplier_claim._execute_expire('observation-before-expiry',
  'e1000000-0000-4000-8000-000000000103',1,null,:'early_fence'::uuid)r \gset
select row_to_json(r)::text as early_replay
from supplier_claim.expire('observation-before-expiry',
  'e1000000-0000-4000-8000-000000000103',1,null)r \gset
select execution_fence::text as terminal_fence
from supplier_claim.expire('observation-terminal-expired',
  'e1000000-0000-4000-8000-000000000101',1,null) \gset
select row_to_json(r)::text as terminal_result
from supplier_claim._execute_expire('observation-terminal-expired',
  'e1000000-0000-4000-8000-000000000101',1,null,:'terminal_fence'::uuid)r \gset

reset role;

select is((:'due_result'::jsonb)->>'outcome_code','expired',
  'due submitted Claim expires');
select is((:'terminal_result'::jsonb)->>'outcome_code','already_terminal',
  'distinct observation validates expired history and completes already_terminal');
select is((:'assigned_result'::jsonb)->>'outcome_code','expired',
  'due under-review Claim expires');
select is((:'early_result'::jsonb)->>'outcome_code','claim_not_due',
  'pre-expiry observation completes claim_not_due');
select is((:'early_replay'::jsonb)->>'reservation_outcome','replay',
  'exact pre-expiry observation replays');
select ok((( :'early_replay'::jsonb)->>'idempotent_replay')::boolean,
  'pre-expiry replay is marked idempotent');
select ok((select status='expired' and record_version=2
  and expired_at>=expires_at and expiry_system_source_code='claim_expiry_worker'
  and expiry_policy_version='claim_expiry_v1' and updated_at=expired_at
  from public.supplier_ownership_claims where id=pg_temp.expire_id(101)),
  'expiry writes the exact terminal fields once');
select ok((select status='expired' and record_version=3
  and reviewer_user_profile_id=pg_temp.expire_id(3)
  and reviewer_assignment_version=1
  and reviewer_assigned_by_user_profile_id=pg_temp.expire_id(4)
  and reviewer_assignment_source_code='owner_assignment'
  and reviewer_assignment_policy_version='claim_reviewer_assignment_v1'
  from public.supplier_ownership_claims where id=pg_temp.expire_id(102)),
  'expiry preserves all reviewer-assignment provenance');
select is((select count(*) from internal.domain_events
  where event_type='supplier_ownership.claim_expired'),2::bigint,
  'one expiry event is emitted per real transition');
select ok((select actor_kind='automated_worker' and actor_user_profile_id is null
  and actor_source_code='claim_expiry_worker'
  and source_operation_identity='observation-due-submitted'
  and producing_component_code='supplier_claim_expiry_worker'
  and payload=jsonb_build_object('claim_id',pg_temp.expire_id(101),
    'supplier_profile_id',pg_temp.expire_id(11),
    'claimant_user_profile_id',pg_temp.expire_id(1),'claim_version',2)
  from internal.domain_events where aggregate_id=pg_temp.expire_id(101)),
  'expiry event has exact worker/source/payload provenance');
select is((select count(*) from internal.audit_logs
  where action_code='supplier_claim.expire'),0::bigint,
  'ordinary expiry success writes zero audit rows');
select ok((select status='submitted' and record_version=1 and expired_at is null
  from public.supplier_ownership_claims where id=pg_temp.expire_id(103)),
  'not-due observation does not mutate the Claim');
select is((select count(*) from internal.domain_events
  where aggregate_id=pg_temp.expire_id(103)),0::bigint,
  'not-due observation emits no event');
update internal.domain_events
set actor_source_code='wrong_expiry_worker'
where aggregate_id=pg_temp.expire_id(101)
  and event_type='supplier_ownership.claim_expired';

set role mujahiz_claim_expiry_worker;
set mujahiz.claim.environment='local';
set mujahiz.claim.worker_purpose='supplier_claim_expiry';
set mujahiz.claim.expiry_policy_version='claim_expiry_v1';
set mujahiz.claim.hmac_key='kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk';
select execution_fence::text as corrupt_fence
from supplier_claim.expire('observation-corrupt-expired-history',
  'e1000000-0000-4000-8000-000000000101',1,null) \gset
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,1,null,%L::uuid)',
  'observation-corrupt-expired-history',
  'e1000000-0000-4000-8000-000000000101',:'corrupt_fence'),
  'P5199','integrity_reconciliation_required',
  'malformed originating expiry history fails closed');
reset role;

select throws_ok($$
  select * from supplier_claim.expire('wrong-context',
    'e1000000-0000-4000-8000-000000000104',1,null)
$$,'P5100','claim_context_invalid','non-worker context fails closed');

set role mujahiz_claim_expiry_worker;
set mujahiz.claim.environment='local';
set mujahiz.claim.worker_purpose='supplier_claim_expiry';
set mujahiz.claim.expiry_policy_version='claim_expiry_v1';
set mujahiz.claim.hmac_key='kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk';
select execution_fence::text as stale_fence
from supplier_claim.expire('observation-stale-version',
  'e1000000-0000-4000-8000-000000000104',1,null) \gset
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,2,null,%L::uuid)',
  'observation-stale-version','e1000000-0000-4000-8000-000000000104',:'stale_fence'),
  'P5108','idempotency_key_conflict','changed expected version conflicts with the reservation');
reset role;

-- Status-specific terminal-history controls use the authoritative commands.
set role mujahiz_claim_runtime;
select pg_temp.run_withdraw(pg_temp.expire_id(7),'claim-expire-terminal-withdraw-valid',
  pg_temp.expire_id(201),1)::text as withdraw_origin_valid \gset
select pg_temp.run_withdraw(pg_temp.expire_id(8),'claim-expire-terminal-withdraw-bad',
  pg_temp.expire_id(202),1)::text as withdraw_origin_bad \gset
select pg_temp.run_reject(pg_temp.expire_id(5),'claim-expire-terminal-reject-valid',
  pg_temp.expire_id(203))::text as reject_origin_valid \gset
select pg_temp.run_reject(pg_temp.expire_id(5),'claim-expire-terminal-reject-bad',
  pg_temp.expire_id(204))::text as reject_origin_bad \gset
select pg_temp.run_approve(pg_temp.expire_id(5),'claim-expire-terminal-approve-valid',
  pg_temp.expire_id(205))::text as approve_origin_valid \gset
select pg_temp.run_approve(pg_temp.expire_id(5),'claim-expire-terminal-approve-closed',
  pg_temp.expire_id(207))::text as approve_origin_closed \gset
select pg_temp.run_approve(pg_temp.expire_id(5),'claim-expire-terminal-approve-bad',
  pg_temp.expire_id(208))::text as approve_origin_bad \gset
select pg_temp.run_approve(pg_temp.expire_id(5),'claim-expire-terminal-superseded-bad',
  pg_temp.expire_id(209))::text as superseded_origin_bad \gset
reset role;

update public.supplier_ownerships o set ownership_status='revoked',record_version=2,
  valid_until=c.decided_at+interval '1 microsecond',closure_reason_code='owner_revoked',
  closed_by_user_profile_id=pg_temp.expire_id(6),closed_at=c.decided_at+interval '1 microsecond',
  updated_at=c.decided_at+interval '1 microsecond',updated_by_user_profile_id=pg_temp.expire_id(6)
from public.supplier_ownership_claims c
where c.id=pg_temp.expire_id(207) and o.id=c.resulting_supplier_ownership_id;

set role mujahiz_claim_expiry_worker;
select pg_temp.run_expire('terminal-observation-withdraw-valid',pg_temp.expire_id(201),1)::text
  as withdraw_terminal_result \gset
select pg_temp.run_expire('terminal-observation-reject-valid',pg_temp.expire_id(203),2)::text
  as reject_terminal_result \gset
select pg_temp.run_expire('terminal-observation-approve-valid',pg_temp.expire_id(205),2)::text
  as approve_terminal_result \gset
select pg_temp.run_expire('terminal-observation-approved-closed',pg_temp.expire_id(207),2)::text
  as approved_closed_result \gset
select pg_temp.run_expire('terminal-observation-superseded-valid',pg_temp.expire_id(206),1)::text
  as superseded_terminal_result \gset
select pg_temp.run_expire('terminal-observation-expired-valid-origin',pg_temp.expire_id(211),1)::text
  as expired_origin_valid \gset
select pg_temp.run_expire('terminal-observation-expired-valid-check',pg_temp.expire_id(211),1)::text
  as expired_terminal_result \gset
select pg_temp.run_expire('terminal-observation-expired-bad-origin',pg_temp.expire_id(212),1)::text
  as expired_origin_bad \gset
reset role;

select is((:'withdraw_terminal_result'::jsonb)->>'outcome_code','already_terminal',
  'valid withdrawn history completes already_terminal');
select is((:'reject_terminal_result'::jsonb)->>'outcome_code','already_terminal',
  'valid rejected history completes already_terminal');
select is((:'approve_terminal_result'::jsonb)->>'outcome_code','already_terminal',
  'valid approved history completes already_terminal');
select is((:'approved_closed_result'::jsonb)->>'outcome_code','already_terminal',
  'approved history remains coherent after a valid later ownership closure');
select is((:'superseded_terminal_result'::jsonb)->>'outcome_code','already_terminal',
  'valid superseded history completes already_terminal');
select is((:'expired_terminal_result'::jsonb)->>'outcome_code','already_terminal',
  'valid expired history completes already_terminal');

update internal.idempotency_keys set result_version_token=null
where command_name='supplier_claim.withdraw' and result_resource_id=pg_temp.expire_id(202);
update internal.audit_logs set safe_context=safe_context-'reason_registry_version'
where target_id=pg_temp.expire_id(204) and action_code='supplier_claim.reject'
  and source_operation_class='trusted_command';
update internal.audit_logs set safe_context=jsonb_set(safe_context,'{superseded_claim_count}','9'::jsonb)
where target_id=pg_temp.expire_id(208) and action_code='supplier_claim.approve'
  and source_operation_class='trusted_command';
update internal.domain_events set payload='{}'::jsonb
where aggregate_id=pg_temp.expire_id(210) and event_type='supplier_ownership.claim_superseded';
update internal.domain_events set actor_source_code='wrong_expiry_worker'
where aggregate_id=pg_temp.expire_id(212) and event_type='supplier_ownership.claim_expired';

set role mujahiz_claim_expiry_worker;
select extensions.throws_ok(format('select pg_temp.run_expire(%L,%L::uuid,1)',
  'terminal-observation-withdraw-bad',pg_temp.expire_id(202)),
  'P5199','integrity_reconciliation_required','malformed withdrawn history fails closed');
select extensions.throws_ok(format('select pg_temp.run_expire(%L,%L::uuid,2)',
  'terminal-observation-reject-bad',pg_temp.expire_id(204)),
  'P5199','integrity_reconciliation_required','malformed rejected history fails closed');
select extensions.throws_ok(format('select pg_temp.run_expire(%L,%L::uuid,2)',
  'terminal-observation-approve-bad',pg_temp.expire_id(208)),
  'P5199','integrity_reconciliation_required','malformed approved history fails closed');
select extensions.throws_ok(format('select pg_temp.run_expire(%L,%L::uuid,1)',
  'terminal-observation-superseded-bad',pg_temp.expire_id(210)),
  'P5199','integrity_reconciliation_required','malformed superseded history fails closed');
select extensions.throws_ok(format('select pg_temp.run_expire(%L,%L::uuid,1)',
  'terminal-observation-expired-bad',pg_temp.expire_id(212)),
  'P5199','integrity_reconciliation_required','malformed expired history fails closed');
reset role;
select ok((select status='withdrawn' from public.supplier_ownership_claims
  where id=pg_temp.expire_id(202)) and not exists(select 1 from internal.domain_events
  where aggregate_id=pg_temp.expire_id(202) and event_type='supplier_ownership.claim_expired'),
  'malformed terminal history produces no repair Claim mutation or Expire event');
-- Input validation runs before target lookup and stored expiry is fingerprint-bound.
set role mujahiz_claim_expiry_worker;
select extensions.throws_ok($$select * from supplier_claim.expire('null-target',null,1,null)$$,
  'P5101','invalid_request','invalid target fails before Claim lookup');
select execution_fence::text as stored_expiry_fence
from supplier_claim.expire('stored-expiry-binding',pg_temp.expire_id(213),1,null) \gset
reset role;
update public.supplier_ownership_claims set expires_at=expires_at+interval '1 second'
where id=pg_temp.expire_id(213);
set role mujahiz_claim_expiry_worker;
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,1,null,%L::uuid)',
  'stored-expiry-binding',pg_temp.expire_id(213),:'stored_expiry_fence'),
  'P5108','idempotency_key_conflict','stored expiry participates in the request fingerprint');

select execution_fence::text as corrupt_fingerprint_fence
from supplier_claim.expire('fingerprint-corruption',pg_temp.expire_id(214),1,null) \gset
reset role;
update internal.idempotency_keys set request_fingerprint=decode(repeat('00',32),'hex')
where command_name='supplier_claim.expire' and upstream_request_identity='fingerprint-corruption';
set role mujahiz_claim_expiry_worker;
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,1,null,%L::uuid)',
  'fingerprint-corruption',pg_temp.expire_id(214),:'corrupt_fingerprint_fence'),
  'P5108','idempotency_key_conflict','corrupt stored fingerprint fails closed');

-- Active under-review history must preserve assignment chronology and provenance.
reset role;
update public.supplier_ownership_claims set reviewer_assigned_at=submitted_at-interval '1 second'
where id=pg_temp.expire_id(215);
update public.supplier_ownership_claims set reviewer_assignment_policy_version='claim_reviewer_assignment_v0'
where id=pg_temp.expire_id(216);
set role mujahiz_claim_expiry_worker;
select execution_fence::text as bad_assignment_time_fence
from supplier_claim.expire('bad-assignment-time',pg_temp.expire_id(215),2,null) \gset
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,2,null,%L::uuid)',
  'bad-assignment-time',pg_temp.expire_id(215),:'bad_assignment_time_fence'),
  'P5199','integrity_reconciliation_required','invalid active assignment chronology fails closed');
select execution_fence::text as bad_assignment_source_fence
from supplier_claim.expire('bad-assignment-source',pg_temp.expire_id(216),2,null) \gset
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,2,null,%L::uuid)',
  'bad-assignment-source',pg_temp.expire_id(216),:'bad_assignment_source_fence'),
  'P5199','integrity_reconciliation_required','invalid active assignment provenance fails closed');

-- Lease takeover invalidates the old fence without duplicating the transition.
select execution_fence::text as stale_old_fence
from supplier_claim.expire('stale-fence-takeover',pg_temp.expire_id(217),1,null) \gset
reset role;
update internal.idempotency_keys set lease_expires_at=clock_timestamp()-interval '1 millisecond'
where command_name='supplier_claim.expire' and upstream_request_identity='stale-fence-takeover';
set role mujahiz_claim_expiry_worker;
select execution_fence::text as stale_new_fence
from supplier_claim.expire('stale-fence-takeover',pg_temp.expire_id(217),1,null) \gset
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,1,null,%L::uuid)',
  'stale-fence-takeover',pg_temp.expire_id(217),:'stale_old_fence'),
  'P5109','command_in_progress','superseded execution fence is rejected');
select row_to_json(r)::text as stale_winner_result from supplier_claim._execute_expire(
  'stale-fence-takeover',pg_temp.expire_id(217),1,null,:'stale_new_fence'::uuid)r \gset
reset role;
select is((:'stale_winner_result'::jsonb)->>'outcome_code','expired',
  'replacement fence performs exactly one expiry transition');
select is((select count(*)::integer from internal.domain_events
  where aggregate_id=pg_temp.expire_id(217) and event_type='supplier_ownership.claim_expired'),1,
  'lease takeover emits one Expire event');

-- Attempt exhaustion is a durable terminal state and replays deterministically.
set role mujahiz_claim_expiry_worker;
select execution_fence::text as attempt_limit_fence
from supplier_claim.expire('attempt-limit-durable',pg_temp.expire_id(218),1,null) \gset
reset role;
update internal.idempotency_keys set attempt_count=10,
  lease_expires_at=clock_timestamp()-interval '1 millisecond'
where command_name='supplier_claim.expire' and upstream_request_identity='attempt-limit-durable';
set role mujahiz_claim_expiry_worker;
select row_to_json(r)::text as attempt_limit_result from supplier_claim.expire(
  'attempt-limit-durable',pg_temp.expire_id(218),1,null)r \gset
select row_to_json(r)::text as attempt_limit_replay from supplier_claim.expire(
  'attempt-limit-durable',pg_temp.expire_id(218),1,null)r \gset
reset role;
select ok((select status='failed' and attempt_count=10
    and failure_code='attempt_limit_exceeded' and retry_disposition='terminal'
    and failed_at is not null and lease_token_digest is null and lease_expires_at is null
  from internal.idempotency_keys where command_name='supplier_claim.expire'
    and upstream_request_identity='attempt-limit-durable'),
  'attempt limit persists a coherent failed terminal row');
select ok((:'attempt_limit_result'::jsonb)->>'reservation_outcome'='reconciliation_required'
    and (:'attempt_limit_result'::jsonb)->>'idempotent_replay'='false'
    and (:'attempt_limit_replay'::jsonb)->>'reservation_outcome'='reconciliation_required'
    and (:'attempt_limit_replay'::jsonb)->>'idempotent_replay'='true',
  'attempt-limit terminal response replays deterministically');

-- Source identity and result-resource corruption fail closed.
set role mujahiz_claim_expiry_worker;
select execution_fence::text as corrupt_source_fence
from supplier_claim.expire('source-resource-corruption',pg_temp.expire_id(219),1,null) \gset
reset role;
update internal.idempotency_keys set upstream_request_identity='corrupt-source'
where command_name='supplier_claim.expire' and upstream_request_identity='source-resource-corruption';
set role mujahiz_claim_expiry_worker;
select extensions.throws_ok(format(
  'select * from supplier_claim._execute_expire(%L,%L::uuid,1,null,%L::uuid)',
  'source-resource-corruption',pg_temp.expire_id(219),:'corrupt_source_fence'),
  'P5108','idempotency_key_conflict','corrupt stored source identity fails closed');
reset role;
update internal.idempotency_keys set upstream_request_identity='source-resource-corruption'
where command_name='supplier_claim.expire' and upstream_request_identity='corrupt-source';
set role mujahiz_claim_expiry_worker;
select row_to_json(r)::text as resource_origin_result from supplier_claim._execute_expire(
  'source-resource-corruption',pg_temp.expire_id(219),1,null,:'corrupt_source_fence'::uuid)r \gset
reset role;
update internal.idempotency_keys set result_resource_id=pg_temp.expire_id(218)
where command_name='supplier_claim.expire' and upstream_request_identity='source-resource-corruption';
set role mujahiz_claim_expiry_worker;
select extensions.throws_ok(format('select * from supplier_claim.expire(%L,%L::uuid,1,null)',
  'source-resource-corruption',pg_temp.expire_id(219)),
  'P5199','integrity_reconciliation_required','corrupt completed result resource fails closed');

-- A not-due observation remains replayable after a distinct later expiry.
reset role;
do $$ declare n timestamptz:=clock_timestamp(); begin
  update public.supplier_ownership_claims set submitted_at=n-interval '720 hours'+interval '6 seconds',
    expires_at=n+interval '6 seconds',created_at=n-interval '720 hours'+interval '6 seconds',
    updated_at=n-interval '720 hours'+interval '6 seconds'
  where id=pg_temp.expire_id(220);
end $$;
set role mujahiz_claim_expiry_worker;
select pg_temp.run_expire('not-due-observation-a',pg_temp.expire_id(220),1)::text
  as observation_a_result \gset
select pg_catalog.pg_sleep(6.1);
select pg_temp.run_expire('due-observation-b',pg_temp.expire_id(220),1)::text
  as observation_b_result \gset
select row_to_json(r)::text as observation_a_replay from supplier_claim.expire(
  'not-due-observation-a',pg_temp.expire_id(220),1,null)r \gset
reset role;
select ok((:'observation_a_result'::jsonb)->>'outcome_code'='claim_not_due'
    and (:'observation_b_result'::jsonb)->>'outcome_code'='expired',
  'distinct observations preserve not-due then later-expired outcomes');
select ok((:'observation_a_replay'::jsonb)->>'reservation_outcome'='replay'
    and (:'observation_a_replay'::jsonb)->>'outcome_code'='claim_not_due'
    and (:'observation_a_replay'::jsonb)->>'claim_status'='submitted'
    and (:'observation_a_replay'::jsonb)->>'claim_version'='1'
    and (:'observation_a_replay'::jsonb)->>'idempotent_replay'='true',
  'not-due observation replays its original result after later expiry');
select is((select count(*)::integer from internal.domain_events
  where aggregate_id=pg_temp.expire_id(220) and event_type='supplier_ownership.claim_expired'),1,
  'later observation emits exactly one Expire event');
revoke mujahiz_claim_runtime from postgres;
revoke mujahiz_claim_expiry_worker from postgres;
select * from finish();
