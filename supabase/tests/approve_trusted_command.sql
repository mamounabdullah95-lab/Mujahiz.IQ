\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, internal, extensions, pg_catalog;
select no_plan();

select has_function('supplier_claim', '_canonicalize_approve_request_v1',
  array['text','uuid','integer','integer','text','text','text','text[]','text'],
  'private approve canonicalizer exists');
select has_function('supplier_claim', 'approve',
  array['text','uuid','integer','integer','text','text','text','text[]','text','uuid'],
  'approve has the exact approved business signature');
select has_function('supplier_claim', '_execute_approve',
  array['text','uuid','integer','integer','text','text','text','text[]','text','uuid','uuid'],
  'private-named fenced approve executor exists');
select is(pg_catalog.pg_get_function_result(
  'supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)'::regprocedure),
  'TABLE(reservation_outcome text, execution_fence uuid, command text, command_contract_version integer, outcome_code text, claim_id uuid, claim_status text, claim_version integer, supplier_profile_id uuid, ownership_id uuid, decided_at timestamp with time zone, superseded_claim_count integer, idempotent_replay boolean)',
  'business boundary returns only the approved safe reservation/replay envelope');
select ok(pg_catalog.pg_get_function_identity_arguments(
  'supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)'::regprocedure)
  !~ 'actor|claimant|supplier|ownership|reason|role|status|time|digest|note|fence|event|audit|policy|registry',
  'caller cannot select actor, Supplier, ownership, reason, role, time, digest, notes, policy, registry, or fence');
select ok(not (select p.prosecdef from pg_catalog.pg_proc p where p.oid =
  'supplier_claim._canonicalize_approve_request_v1(text,uuid,integer,integer,text,text,text,text[],text)'::regprocedure),
  'approve canonicalizer is SECURITY INVOKER');
select is((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.prosecdef), 10::bigint,
  'five Phase-A and five Phase-B boundaries are SECURITY DEFINER');
select is((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.proconfig @> array['search_path=pg_catalog']::text[]),
  15::bigint, 'all fifteen Claim routines fix search_path');
select ok(has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)','execute')
  and has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim._execute_approve(text,uuid,integer,integer,text,text,text,text[],text,uuid,uuid)','execute'),
  'trusted Claim runtime alone receives approve execution');
select ok(not has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim._canonicalize_approve_request_v1(text,uuid,integer,integer,text,text,text,text[],text)','execute'),
  'runtime cannot call digest-returning approve canonicalizer');
select ok(not exists (
  select 1 from (values ('public'),('anon'),('authenticated'),('service_role')) r(role_name)
  cross join lateral (values
    ('supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)'),
    ('supplier_claim._execute_approve(text,uuid,integer,integer,text,text,text,text[],text,uuid,uuid)'),
    ('supplier_claim._canonicalize_approve_request_v1(text,uuid,integer,integer,text,text,text,text[],text)')
  ) f(signature)
  where has_function_privilege(r.role_name,f.signature,'execute')),
  'PUBLIC, anon, authenticated, and service_role cannot execute approve routines');
select ok(not exists (
  select 1 from (values ('mujahiz_claim_runtime'),('anon'),('authenticated'),('service_role')) r(role_name)
  where has_table_privilege(r.role_name,'public.supplier_ownership_claims','update')
     or has_table_privilege(r.role_name,'public.supplier_ownerships','insert')),
  'runtime and API roles retain no direct Claim UPDATE or ownership INSERT');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass), 3::bigint,
  'Claim retains exactly three SELECT policies');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass and polcmd <> 'r'), 0::bigint,
  'Claim retains zero mutation policies');
select is((select pg_catalog.count(*) from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','internal') and c.relkind in ('r','p')), 24::bigint,
  'approve adds no physical table');
select ok(not exists (select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.proname='expire'),
  'expire remains absent');
select ok(not exists (select 1 from pg_catalog.pg_proc p
  where p.oid in (
    'supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)'::regprocedure,
    'supplier_claim._execute_approve(text,uuid,integer,integer,text,text,text,text[],text,uuid,uuid)'::regprocedure)
  and pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) ~
    E'execute[[:space:]]+(format|immediate|[a-z_][a-z0-9_]*[[:space:]]*\\()'),
  'approve routines contain no dynamic SQL');
select ok(pg_catalog.to_regclass('public.notifications') is null,
  'approve has no notification table or materializer');

create function pg_temp.approve_id(p_number integer)
returns uuid language sql immutable set search_path=pg_catalog
return ('c1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0'))::uuid;

create function pg_temp.approve_key(p_number integer)
returns text language sql immutable set search_path=pg_catalog
return 'claim-c1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0');

create function pg_temp.seed_profile(p_number integer, p_context text)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.approve_id(p_number);
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,account_status,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v_id,'Approve profile '||p_number,p_context,'active','verified',
    v_now-interval '1 day',v_now-interval '10 days',v_now);
  insert into internal.identity_provider_links(id,user_profile_id,provider_code,
    provider_subject,is_primary,link_status,identity_status,verification_status,
    provider_state_observed_at,provider_state_version,linked_at,verified_at,created_at)
  values(v_id,v_id,'firebase','approve-profile-'||p_number,true,'linked','active',
    'verified',v_now-interval '1 day','firebase-provider-state-v1',
    v_now-interval '10 days',v_now-interval '2 days',v_now-interval '10 days');
  return v_id;
end $$;

create function pg_temp.seed_eligible_actor(p_number integer, p_role text)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid; v_now timestamptz := pg_catalog.statement_timestamp();
begin
  v_id := pg_temp.seed_profile(p_number,'buyer');
  insert into public.platform_role_assignments(id,user_profile_id,role_code,
    assignment_status,valid_from,assignment_source_type,assignment_reason_code,
    authorization_policy_version,evidence_reference,assignment_system_source,
    assigned_at,created_at,updated_at)
  values(v_id,v_id,p_role,'active',v_now-interval '2 days','bootstrap_manifest',
    'approve_test','platform-role-policy-v1','approve-role-evidence','approve_test',
    v_now-interval '2 days',v_now-interval '2 days',v_now);
  insert into public.access_grants(id,user_profile_id,platform_role_assignment_id,
    role_code,access_status,valid_from,valid_until,grant_source_type,
    grant_reason_code,authorization_policy_version,evidence_reference,
    grant_system_source,granted_at,created_at,updated_at)
  values(v_id,v_id,v_id,p_role,'active',v_now-interval '1 day',
    case when p_role='admin' then v_now+interval '30 days' else null end,
    'bootstrap_manifest','approve_test','platform-access-policy-v1',
    'approve-access-evidence','approve_test',v_now-interval '1 day',
    v_now-interval '1 day',v_now);
  insert into internal.security_eligibility_assessments(id,user_profile_id,
    assessment_result,condition_type,valid_from,assessment_status,
    assessment_source_type,assessment_reason_code,security_policy_version,
    required_coverage_version,evidence_minimization_version,evidence_reference,
    assessment_system_source,assessed_at,created_at,updated_at)
  values(v_id,v_id,'clear','complete_clear',v_now-interval '1 day','active',
    'bootstrap_manifest','approve_test','platform-admin-security-v1',
    'platform-admin-coverage-v1','platform-admin-minimization-v1',
    'approve-security-evidence','approve_test',v_now-interval '1 day',
    v_now-interval '1 day',v_now);
  return v_id;
end $$;

create function pg_temp.seed_claimant(p_number integer)
returns uuid language sql volatile set search_path=pg_catalog
return pg_temp.seed_profile(p_number,'supplier');

create function pg_temp.seed_supplier(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.approve_id(p_number);
begin
  insert into public.supplier_profiles(id,name_original,display_name,name_language,
    name_en,business_type,listing_status,verification_status,source_type,
    confidence_level,has_direct_experience)
  values(v_id,'Approve Supplier '||p_number,'Approve Supplier '||p_number,'english',
    'Approve Supplier '||p_number,'company','approved','verified','other','low','no');
  return v_id;
end $$;

create function pg_temp.seed_claim(
  p_number integer,p_claimant integer,p_supplier integer,p_status text default 'under_review',
  p_reviewer integer default 1,p_assigner integer default 3,p_due boolean default false)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.approve_id(p_number);
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_submitted timestamptz := case when p_due then v_now-interval '721 hours' else v_now-interval '1 hour' end;
  v_assigned timestamptz := v_submitted+interval '1 minute';
begin
  if p_status='submitted' then
    insert into public.supplier_ownership_claims(id,claimant_user_profile_id,
      supplier_profile_id,status,record_version,submitted_at,expires_at,
      submitted_reason,claimant_snapshot_schema_version,claimant_snapshot,
      submission_fingerprint_version,submission_fingerprint,evidence_schema_version,
      evidence_descriptors,created_at,updated_at)
    values(v_id,pg_temp.approve_id(p_claimant),pg_temp.approve_id(p_supplier),
      'submitted',1,v_submitted,v_submitted+interval '720 hours',
      'Synthetic approval Claim '||p_number,'claimant_snapshot_v1',
      pg_catalog.jsonb_build_object('full_name','Approve claimant '||p_claimant),
      'claim_submit_v1',pg_catalog.repeat('c',64),'claim_evidence_v1',
      '[{"kind":"official_registry","summary":"bounded synthetic evidence"}]'::jsonb,
      v_submitted,v_submitted);
  elsif p_status='under_review' then
    insert into public.supplier_ownership_claims(id,claimant_user_profile_id,
      supplier_profile_id,status,record_version,submitted_at,expires_at,
      submitted_reason,claimant_snapshot_schema_version,claimant_snapshot,
      submission_fingerprint_version,submission_fingerprint,evidence_schema_version,
      evidence_descriptors,reviewer_user_profile_id,reviewer_assignment_version,
      reviewer_assigned_at,reviewer_assigned_by_user_profile_id,
      reviewer_assignment_source_code,reviewer_assignment_policy_version,
      created_at,updated_at)
    values(v_id,pg_temp.approve_id(p_claimant),pg_temp.approve_id(p_supplier),
      'under_review',2,v_submitted,v_submitted+interval '720 hours',
      'Synthetic approval Claim '||p_number,'claimant_snapshot_v1',
      pg_catalog.jsonb_build_object('full_name','Approve claimant '||p_claimant),
      'claim_submit_v1',pg_catalog.repeat('c',64),'claim_evidence_v1',
      '[{"kind":"official_registry","summary":"bounded synthetic evidence"}]'::jsonb,
      pg_temp.approve_id(p_reviewer),1,v_assigned,pg_temp.approve_id(p_assigner),
      'owner_assignment','claim_reviewer_assignment_v1',v_submitted,v_assigned);
  else
    raise exception 'unsupported fixture status';
  end if;
  return v_id;
end $$;

create function pg_temp.run_approve(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_assignment integer,
  p_classes text[],p_reference text,
  p_method text default 'manual_review',
  p_version text default 'claim_evidence_review_v1',p_outcome text default 'verified')
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_reservation record; v_result jsonb;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into v_reservation from supplier_claim.approve(
    p_key,p_claim,p_expected,p_assignment,p_method,p_version,p_outcome,
    p_classes,p_reference,null);
  if v_reservation.reservation_outcome='execute' then
    select pg_catalog.to_jsonb(result_row) into v_result
    from supplier_claim._execute_approve(
      p_key,p_claim,p_expected,p_assignment,p_method,p_version,p_outcome,
      p_classes,p_reference,pg_catalog.gen_random_uuid(),v_reservation.execution_fence
    ) result_row;
    return v_result || pg_catalog.jsonb_build_object('reservation_outcome','execute');
  end if;
  return pg_catalog.to_jsonb(v_reservation);
end $$;

create function pg_temp.reserve_approve(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_assignment integer,
  p_classes text[],p_reference text)
returns uuid language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_fence uuid;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select execution_fence into v_fence from supplier_claim.approve(
    p_key,p_claim,p_expected,p_assignment,'manual_review','claim_evidence_review_v1',
    'verified',p_classes,p_reference,null);
  return v_fence;
end $$;

create function pg_temp.execute_approve(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_assignment integer,
  p_classes text[],p_reference text,p_fence uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select pg_catalog.to_jsonb(result_row) into v_result
  from supplier_claim._execute_approve(
    p_key,p_claim,p_expected,p_assignment,'manual_review','claim_evidence_review_v1',
    'verified',p_classes,p_reference,pg_catalog.gen_random_uuid(),p_fence
  ) result_row;
  return v_result;
end $$;

-- Successful approval paths, aggregate effects, terminal preservation, and replay.
select pg_temp.seed_eligible_actor(1,'owner');
select pg_temp.seed_eligible_actor(2,'admin');
select pg_temp.seed_eligible_actor(3,'owner');
select pg_temp.seed_claimant(n) from pg_catalog.generate_series(101,118) n;
select pg_temp.seed_supplier(n) from pg_catalog.generate_series(201,203) n;

select pg_temp.seed_claim(1001,101,201,'under_review',1,3,false);
select pg_temp.seed_claim(1002,102,202,'under_review',2,3,false);
select pg_temp.seed_claim(1003,103,203,'under_review',1,3,false);

select pg_temp.seed_claim(1101,111,202,'submitted',1,3,false);
select pg_temp.seed_claim(1102,112,202,'submitted',1,3,true);
select pg_temp.seed_claim(1103,113,202,'under_review',1,3,false);
select pg_temp.seed_claim(1104,114,202,'under_review',1,3,true);
select pg_temp.seed_claim(1105,115,202,'under_review',1,3,false);
update public.supplier_ownership_claims
set status='rejected',record_version=3,decided_by_user_profile_id=reviewer_user_profile_id,
    decided_at=updated_at+interval '1 minute',decision_reason_code='supplier_mismatch',
    evidence_verification_method_code='manual_review',
    evidence_verification_version='claim_evidence_review_v1',
    evidence_verification_outcome_code='verified',
    decision_authorization_policy_version='sec-001-claim-v1',
    reviewer_notes=null,updated_at=updated_at+interval '1 minute'
where id=pg_temp.approve_id(1105);
select pg_temp.seed_claim(1106,116,202,'submitted',1,3,false);
update public.supplier_ownership_claims
set status='withdrawn',record_version=2,withdrawn_at=submitted_at+interval '2 minutes',
    withdrawn_by_user_profile_id=claimant_user_profile_id,
    withdrawal_reason_code=null,updated_at=submitted_at+interval '2 minutes'
where id=pg_temp.approve_id(1106);
select pg_temp.seed_claim(1107,117,202,'submitted',1,3,false);
update public.supplier_ownership_claims
set status='superseded',record_version=2,superseded_at=submitted_at+interval '2 minutes',
    supersession_reason_code='competing_claim_superseded_by_approval',
    superseded_by_claim_id=pg_temp.approve_id(1002),updated_at=submitted_at+interval '2 minutes'
where id=pg_temp.approve_id(1107);
select pg_temp.seed_claim(1108,118,202,'under_review',1,3,false);
insert into public.supplier_ownerships(
  id,supplier_profile_id,controller_user_profile_id,authority_type,ownership_status,
  valid_from,valid_until,record_version,establishment_source_type,
  establishment_reason_code,established_by_user_profile_id,established_at,
  closure_reason_code,closed_by_user_profile_id,closed_at,
  created_at,created_by_user_profile_id,updated_at,updated_by_user_profile_id)
select pg_temp.approve_id(5001),pg_temp.approve_id(202),pg_temp.approve_id(118),
  'primary_controller','revoked',t,t+interval '20 minutes',2,'claim_approval',
  'verified_claim_approved',pg_temp.approve_id(1),t,
  'historical_test_closure',pg_temp.approve_id(1),t+interval '20 minutes',
  t,pg_temp.approve_id(1),t+interval '20 minutes',pg_temp.approve_id(1)
from (select pg_catalog.statement_timestamp()-interval '40 minutes' as t) q;
update public.supplier_ownership_claims
set status='approved',record_version=3,
    decided_by_user_profile_id=reviewer_user_profile_id,
    decided_at=(select valid_from from public.supplier_ownerships where id=pg_temp.approve_id(5001)),
    decision_reason_code='verified_claim_approved',
    evidence_verification_method_code='manual_review',
    evidence_verification_version='claim_evidence_review_v1',
    evidence_verification_outcome_code='verified',
    decision_authorization_policy_version='claim_approval_reason_registry_v1',
    reviewer_notes=null,resulting_supplier_ownership_id=pg_temp.approve_id(5001),
    updated_at=(select valid_from from public.supplier_ownerships where id=pg_temp.approve_id(5001))
where id=pg_temp.approve_id(1108);

insert into internal.idempotency_keys(
  id,command_name,command_contract_version,environment_code,
  principal_kind,principal_user_profile_id,target_aggregate_type,
  target_aggregate_id,key_digest,key_digest_key_version,
  request_fingerprint,request_fingerprint_key_version,status,attempt_count,
  outcome_code,result_resource_type,result_resource_id,result_version_token,
  created_at,completed_at,expires_at)
select pg_temp.approve_id(6001),'supplier_claim.approve',1,'local',
  'human_user',pg_temp.approve_id(1),'supplier_ownership_claim',
  pg_temp.approve_id(1108),
  extensions.digest(pg_catalog.convert_to('historical-approve-key','UTF8'),'sha256'),
  'local_v1',
  extensions.digest(pg_catalog.convert_to('historical-approve-request','UTF8'),'sha256'),
  'local_v1','completed',1,'approved','supplier_ownership_claim',
  pg_temp.approve_id(1108),'3',decided_at-interval '1 minute',decided_at,
  decided_at-interval '1 minute'+interval '720 hours'
from public.supplier_ownership_claims where id=pg_temp.approve_id(1108);

insert into internal.domain_events(
  id,event_type,event_schema_version,aggregate_type,aggregate_id,
  aggregate_sequence,producer_command_name,producer_command_contract_version,
  producer_idempotency_key_id,source_system_code,event_ordinal,
  actor_kind,actor_user_profile_id,environment_code,
  producing_component_code,correlation_id,occurred_at,persisted_at,
  payload,processing_status,available_at)
select pg_temp.approve_id(6002),'supplier_ownership.claim_approved',1,
  'supplier_ownership_claim',claim_row.id,claim_row.record_version,
  'supplier_claim.approve',1,pg_temp.approve_id(6001),'mujahiz',1,
  'human_user',claim_row.reviewer_user_profile_id,'local',
  'supplier_claim_command',pg_temp.approve_id(6004),
  claim_row.decided_at,claim_row.decided_at,
  pg_catalog.jsonb_build_object(
    'claim_id',claim_row.id,
    'supplier_profile_id',claim_row.supplier_profile_id,
    'claimant_user_profile_id',claim_row.claimant_user_profile_id,
    'ownership_id',claim_row.resulting_supplier_ownership_id,
    'claim_version',claim_row.record_version),
  'pending',claim_row.decided_at
from public.supplier_ownership_claims claim_row
where claim_row.id=pg_temp.approve_id(1108);

insert into internal.audit_logs(
  id,action_code,action_contract_version,action_class,
  actor_kind,actor_user_profile_id,actor_authorization_snapshot,
  target_entity_type,target_id,related_target_entity_type,related_target_id,
  occurred_at,recorded_at,environment_code,source_system_code,
  producing_component_code,source_operation_class,outcome_class,result_code,
  reason_code,safe_context_schema_version,safe_context,correlation_id,
  idempotency_reference,domain_event_reference,prior_state_code,
  result_state_code,prior_record_version,result_record_version,
  changed_field_codes,evidence_digest,evidence_digest_algorithm,
  evidence_digest_version,restricted_evidence_reference,audit_schema_version,
  action_evidence_schema_version,authorization_policy_version,
  producer_contract_version,minimization_policy_version,retention_class)
select pg_temp.approve_id(6003),'supplier_claim.approve',1,'claim_ownership',
  'human_user',claim_row.reviewer_user_profile_id,'owner',
  'supplier_ownership_claim',claim_row.id,'supplier_profile',
  claim_row.supplier_profile_id,claim_row.decided_at,claim_row.decided_at,
  'local','mujahiz','supplier_claim_command','trusted_command',
  'succeeded','approved','verified_claim_approved','claim_approve_context_v1',
  pg_catalog.jsonb_build_object(
    'reason_registry_version','claim_approval_reason_registry_v1',
    'approval_evidence_policy_version','claim_approval_evidence_policy_v1',
    'evidence_verification_method_code','manual_review',
    'evidence_verification_version','claim_evidence_review_v1',
    'evidence_verification_outcome_code','verified',
    'checked_source_classes',
      '["authorized_officer_confirmation"]'::jsonb,
    'evidence_digest_version','claim_approve_evidence_digest_v1',
    'disclosure_policy_version','claim_approve_disclosure_v1',
    'decision_authorization_policy_version','sec-001-claim-v1',
    'reviewer_role_code','owner','reviewer_conflict_result','clear',
    'provider_state_version','firebase-provider-state-v1',
    'role_policy_version','platform-role-policy-v1',
    'access_policy_version','platform-access-policy-v1',
    'security_policy_version','platform-admin-security-v1',
    'security_coverage_version','platform-admin-coverage-v1',
    'evidence_minimization_version','platform-admin-minimization-v1',
    'resulting_supplier_ownership_id',claim_row.resulting_supplier_ownership_id,
    'superseded_claim_count',0),
  pg_temp.approve_id(6004),pg_temp.approve_id(6001),pg_temp.approve_id(6002),
  'under_review','approved',2,claim_row.record_version,
  array['status','record_version','decided_by_user_profile_id','decided_at',
    'decision_reason_code','evidence_verification_method_code',
    'evidence_verification_version','evidence_verification_outcome_code',
    'decision_authorization_policy_version',
    'resulting_supplier_ownership_id']::text[],
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    'claim-approve-evidence-digest-v1|'
      ||pg_catalog.octet_length('historical-approve-ref')::text
      ||':historical-approve-ref','UTF8'),'sha256'),'hex'),
  'sha256','claim_approve_evidence_digest_v1','historical-approve-ref',
  'audit_log_v1','claim_approve_success_v1','sec-001-claim-v1',
  'supplier_claim.approve.v1','aud-001-minimized-v1',
  'claim_ownership_decision'
from public.supplier_ownership_claims claim_row
where claim_row.id=pg_temp.approve_id(1108);

update internal.idempotency_keys as approval_idempotency
set request_fingerprint = extensions.hmac(
  pg_catalog.convert_to(
    'claim-request-fingerprint-v1|'
      || pg_catalog.jsonb_build_object(
        'claim_id', approved_claim.id,
        'expected_claim_version', approved_claim.record_version - 1,
        'expected_reviewer_assignment_version',
          approved_claim.reviewer_assignment_version,
        'evidence_verification_method_code',
          approved_claim.evidence_verification_method_code,
        'evidence_verification_version',
          approved_claim.evidence_verification_version,
        'evidence_verification_outcome_code',
          approved_claim.evidence_verification_outcome_code,
        'checked_source_classes',
          approval_audit.safe_context -> 'checked_source_classes',
        'approval_evidence_policy_version',
          'claim_approval_evidence_policy_v1',
        'reason_registry_version', 'claim_approval_reason_registry_v1',
        'restricted_evidence_binding',
          pg_catalog.encode(
            extensions.hmac(
              pg_catalog.convert_to(
                'claim-approve-evidence-reference-v1|'
                  || pg_catalog.jsonb_build_object(
                    'restricted_evidence_reference',
                      approval_audit.restricted_evidence_reference,
                    'evidence_digest', approval_audit.evidence_digest,
                    'evidence_digest_version',
                      'claim_approve_evidence_digest_v1'
                  )::text,
                'UTF8'
              ),
              pg_catalog.convert_to(pg_catalog.repeat('k',32), 'UTF8'),
              'sha256'
            ),
            'hex'
          ),
        'evidence_digest_version', 'claim_approve_evidence_digest_v1',
        'disclosure_policy_version', 'claim_approve_disclosure_v1',
        'decision_authorization_policy_version', 'sec-001-claim-v1',
        'supersession_policy_version',
          'claim_approval_reason_registry_v1',
        'reviewer_notes_marker', 'null'
      )::text,
    'UTF8'
  ),
  pg_catalog.convert_to(pg_catalog.repeat('k',32), 'UTF8'),
  'sha256'
)
from public.supplier_ownership_claims as approved_claim,
     internal.audit_logs as approval_audit
where approval_idempotency.id = pg_temp.approve_id(6001)
  and approved_claim.id = pg_temp.approve_id(1108)
  and approval_audit.id = pg_temp.approve_id(6003);

select ok((select decided_at >= submitted_at and decided_at < expires_at
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1108)),
  'coherent historical approved fixture is internally time-valid');

-- M3: each synthetic contradiction and its denial execute in a subtransaction
-- that is deliberately rolled back before the probe returns.
create function pg_temp.probe_historical_approval_corruption(p_kind text)
returns text language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  begin
    case p_kind
      when 'assignment_version' then
        update public.supplier_ownership_claims
        set reviewer_assignment_version=2
        where id=pg_temp.approve_id(1108);
      when 'assignment_policy' then
        update public.supplier_ownership_claims
        set reviewer_assignment_policy_version='unsupported_assignment_v1'
        where id=pg_temp.approve_id(1108);
      when 'assignment_before_submission' then
        update public.supplier_ownership_claims
        set reviewer_assigned_at=submitted_at-interval '1 microsecond'
        where id=pg_temp.approve_id(1108);
      when 'assignment_at_expiry' then
        update public.supplier_ownership_claims
        set reviewer_assigned_at=expires_at
        where id=pg_temp.approve_id(1108);
      when 'decision_before_assignment' then
        update public.supplier_ownership_claims
        set decided_at=reviewer_assigned_at-interval '1 microsecond'
        where id=pg_temp.approve_id(1108);
      when 'decision_at_expiry' then
        update public.supplier_ownership_claims
        set decided_at=expires_at
        where id=pg_temp.approve_id(1108);
      when 'immutable_submission' then
        update public.supplier_ownership_claims
        set claimant_snapshot_schema_version='unsupported_snapshot_v1'
        where id=pg_temp.approve_id(1108);
      when 'submission_fingerprint' then
        update public.supplier_ownership_claims
        set submission_fingerprint=pg_catalog.repeat('G',64)
        where id=pg_temp.approve_id(1108);
      when 'submission_evidence_schema' then
        update public.supplier_ownership_claims
        set evidence_schema_version='unsupported_evidence_v1'
        where id=pg_temp.approve_id(1108);
      when 'approval_evidence_tuple' then
        update public.supplier_ownership_claims
        set evidence_verification_method_code='automated_review'
        where id=pg_temp.approve_id(1108);
      when 'approval_source_classes' then
        update internal.audit_logs
        set safe_context=pg_catalog.jsonb_set(
          safe_context,'{checked_source_classes}',
          '["official_registry"]'::jsonb,false)
        where id=pg_temp.approve_id(6003);
      when 'ownership_provenance' then
        update public.supplier_ownerships
        set establishment_reason_code='synthetic_wrong_reason'
        where id=pg_temp.approve_id(5001);
      when 'event_environment' then
        update internal.domain_events set environment_code='production'
        where id=pg_temp.approve_id(6002);
      when 'event_source_system' then
        update internal.domain_events set source_system_code='synthetic_source'
        where id=pg_temp.approve_id(6002);
      when 'event_component' then
        update internal.domain_events
        set producing_component_code='synthetic_component'
        where id=pg_temp.approve_id(6002);
      when 'event_schema_version' then
        update internal.domain_events set event_schema_version=2
        where id=pg_temp.approve_id(6002);
      when 'event_aggregate_sequence' then
        update internal.domain_events set aggregate_sequence=4
        where id=pg_temp.approve_id(6002);
      when 'event_correlation' then
        update internal.domain_events
        set correlation_id=pg_temp.approve_id(6997)
        where id=pg_temp.approve_id(6002);
      when 'event_available_at' then
        update internal.domain_events
        set available_at=available_at+interval '1 microsecond'
        where id=pg_temp.approve_id(6002);
      when 'event_processing_status' then
        update internal.domain_events
        set processing_status='processed',processed_at=persisted_at
        where id=pg_temp.approve_id(6002);
      when 'event_historical' then
        update internal.domain_events
        set processing_status='processed',processed_at=persisted_at,
            is_historical=true,fanout_suppressed=true,
            migration_classification_code='synthetic_history'
        where id=pg_temp.approve_id(6002);
      when 'event_fanout_suppressed' then
        execute 'alter table internal.domain_events drop constraint domain_events_migration_suppression_ck';
        update internal.domain_events set fanout_suppressed=true
        where id=pg_temp.approve_id(6002);
      when 'event_missing' then
        delete from internal.domain_events where id=pg_temp.approve_id(6002);
      when 'event_duplicate_primary' then
        execute 'alter table internal.domain_events drop constraint domain_events_aggregate_sequence_uk';
        insert into internal.domain_events
        select (pg_catalog.jsonb_populate_record(
          null::internal.domain_events,
          pg_catalog.to_jsonb(event_row)||pg_catalog.jsonb_build_object(
            'id',pg_temp.approve_id(6998),
            'producer_idempotency_key_id',null,
            'source_operation_identity','synthetic_duplicate_primary'
          )
        )).*
        from internal.domain_events event_row
        where event_row.id=pg_temp.approve_id(6002);
      when 'event_orphan_link' then
        update internal.audit_logs
        set domain_event_reference=pg_temp.approve_id(6999)
        where id=pg_temp.approve_id(6003);
      when 'idempotency_contract_version' then
        update internal.idempotency_keys set command_contract_version=2
        where id=pg_temp.approve_id(6001);
      when 'idempotency_fingerprint_version' then
        update internal.idempotency_keys
        set request_fingerprint_key_version='unsupported_v1'
        where id=pg_temp.approve_id(6001);
      when 'idempotency_fingerprint_missing' then
        execute 'alter table internal.idempotency_keys alter column request_fingerprint drop not null';
        update internal.idempotency_keys set request_fingerprint=null
        where id=pg_temp.approve_id(6001);
      when 'idempotency_key_digest_missing' then
        execute 'alter table internal.idempotency_keys alter column key_digest drop not null';
        update internal.idempotency_keys set key_digest=null
        where id=pg_temp.approve_id(6001);
      when 'idempotency_fingerprint_mismatch' then
        update internal.idempotency_keys
        set request_fingerprint=extensions.digest(
          pg_catalog.convert_to('synthetic_wrong_fingerprint','UTF8'),'sha256')
        where id=pg_temp.approve_id(6001);
      when 'idempotency_target_claim' then
        update internal.idempotency_keys
        set target_aggregate_id=pg_temp.approve_id(1107)
        where id=pg_temp.approve_id(6001);
      when 'idempotency_result_claim' then
        update internal.idempotency_keys
        set result_resource_id=pg_temp.approve_id(1107)
        where id=pg_temp.approve_id(6001);
      when 'idempotency_result_version' then
        update internal.idempotency_keys set result_version_token='4'
        where id=pg_temp.approve_id(6001);
      when 'idempotency_outcome' then
        update internal.idempotency_keys set outcome_code='not_approved'
        where id=pg_temp.approve_id(6001);
      when 'idempotency_status' then
        execute 'alter table internal.idempotency_keys drop constraint idempotency_keys_lifecycle_shape_ck';
        update internal.idempotency_keys set status='processing'
        where id=pg_temp.approve_id(6001);
      when 'idempotency_missing' then
        update internal.audit_logs
        set idempotency_reference=pg_temp.approve_id(6999)
        where id=pg_temp.approve_id(6003);
      else
        raise exception 'unknown historical corruption probe';
    end case;

    v_result := pg_temp.run_approve(
      pg_temp.approve_id(2),pg_temp.approve_key(70),
      pg_temp.approve_id(1002),2,1,
      array['authorized_officer_confirmation'],'m3-probe-reference');
    if exists (
      select 1 from public.supplier_ownerships
      where supplier_profile_id=pg_temp.approve_id(202)
        and ownership_status='active'
    ) then
      raise exception using errcode='P0001',message='unexpected_active_ownership';
    end if;
    raise exception using errcode='P0001',
      message=coalesce(v_result->>'outcome_code','no_outcome');
  exception when others then
    if sqlstate='P0001' then
      return sqlerrm;
    end if;
    return sqlstate||':'||sqlerrm;
  end;
end $$;

select is(pg_temp.probe_historical_approval_corruption('assignment_version'),
  'integrity_reconciliation_required',
  'M3: historical assignment version other than one fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('assignment_policy'),
  'integrity_reconciliation_required',
  'M3: unsupported historical assignment policy fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('assignment_before_submission'),
  'integrity_reconciliation_required',
  'M3: historical assignment before submission fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('assignment_at_expiry'),
  'integrity_reconciliation_required',
  'M3: historical assignment at expiry fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('decision_before_assignment'),
  'integrity_reconciliation_required',
  'M3: historical decision before assignment fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('decision_at_expiry'),
  'integrity_reconciliation_required',
  'M3: historical decision at expiry fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('immutable_submission'),
  'integrity_reconciliation_required',
  'M3: malformed historical immutable submission fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('submission_fingerprint'),
  'integrity_reconciliation_required',
  'M3: malformed historical submission fingerprint fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('submission_evidence_schema'),
  'integrity_reconciliation_required',
  'M3: unsupported historical submission evidence schema fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('approval_evidence_tuple'),
  'integrity_reconciliation_required',
  'M3: unsupported historical approval evidence tuple fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('approval_source_classes'),
  'integrity_reconciliation_required',
  'M3: unsupported historical approval source path fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('ownership_provenance'),
  'integrity_reconciliation_required',
  'M3: mismatched historical ownership provenance fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_environment'),
  'integrity_reconciliation_required',
  'M3 event: historical approval environment mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_source_system'),
  'integrity_reconciliation_required',
  'M3 event: historical approval source-system mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_component'),
  'integrity_reconciliation_required',
  'M3 event: historical approval component mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_schema_version'),
  'integrity_reconciliation_required',
  'M3 event: historical approval schema-version mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_aggregate_sequence'),
  'integrity_reconciliation_required',
  'M3 event: historical approval aggregate sequence mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_correlation'),
  'integrity_reconciliation_required',
  'M3 event: historical approval correlation mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_available_at'),
  'integrity_reconciliation_required',
  'M3 event: historical approval availability mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_processing_status'),
  'integrity_reconciliation_required',
  'M3 event: historical approval processing-state mismatch fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_historical'),
  'integrity_reconciliation_required',
  'M3 event: historical/backfill event flags fail reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_fanout_suppressed'),
  'integrity_reconciliation_required',
  'M3 event: fanout-suppressed approval event fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_missing'),
  'integrity_reconciliation_required',
  'M3 event: missing primary historical approval event fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_duplicate_primary'),
  'integrity_reconciliation_required',
  'M3 event: duplicate primary historical approval event fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('event_orphan_link'),
  'integrity_reconciliation_required',
  'M3 event: orphaned historical audit-event link fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_contract_version'),
  'integrity_reconciliation_required',
  'M3 idempotency: wrong command contract version fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_fingerprint_version'),
  'integrity_reconciliation_required',
  'M3 idempotency: unsupported fingerprint version fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_fingerprint_missing'),
  'integrity_reconciliation_required',
  'M3 idempotency: missing request fingerprint fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_key_digest_missing'),
  'integrity_reconciliation_required',
  'M3 idempotency: missing key digest fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_fingerprint_mismatch'),
  'integrity_reconciliation_required',
  'M3 idempotency: mismatched retained request fingerprint fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_target_claim'),
  'integrity_reconciliation_required',
  'M3 idempotency: mismatched target Claim fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_result_claim'),
  'integrity_reconciliation_required',
  'M3 idempotency: mismatched result Claim fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_result_version'),
  'integrity_reconciliation_required',
  'M3 idempotency: mismatched result version fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_outcome'),
  'integrity_reconciliation_required',
  'M3 idempotency: incorrect completed outcome fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_status'),
  'integrity_reconciliation_required',
  'M3 idempotency: incorrect completion status fails reconciliation');
select is(pg_temp.probe_historical_approval_corruption('idempotency_missing'),
  'integrity_reconciliation_required',
  'M3 idempotency: orphaned historical audit-idempotency link fails reconciliation');

grant mujahiz_claim_runtime to postgres with set true;
grant usage on schema extensions to mujahiz_claim_runtime;
set role mujahiz_claim_runtime;
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(1),
  pg_temp.approve_id(1001),2,1,
  array[' Official_Registry ','claimant_authority','official_registry'],
  'approve-ref-official') result \gset approved_one_
select pg_temp.run_approve(pg_temp.approve_id(2),pg_temp.approve_key(2),
  pg_temp.approve_id(1002),2,1,array['authorized_officer_confirmation'],
  'approve-ref-officer') result \gset approved_two_
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(3),
  pg_temp.approve_id(1003),2,1,
  array['independent_supplier_corroboration','company_domain_challenge'],
  'approve-ref-domain') result \gset approved_three_
reset role;

select is((:'approved_one_result'::jsonb)->>'outcome_code','approved',
  'official_registry plus claimant_authority path approves');
select is((:'approved_two_result'::jsonb)->>'outcome_code','approved',
  'authorized_officer_confirmation path approves');
select ok((:'approved_two_result'::jsonb)->>'outcome_code'='approved'
  and (select ownership_status='revoked'
    from public.supplier_ownerships where id=pg_temp.approve_id(5001)),
  'M3: a coherent revoked historical approval permits the later approval');
select is((:'approved_three_result'::jsonb)->>'outcome_code','approved',
  'company-domain challenge plus independent corroboration path approves');
select is((:'approved_one_result'::jsonb)->>'superseded_claim_count','0',
  'single approval reports no competitors');
select is((:'approved_two_result'::jsonb)->>'superseded_claim_count','4',
  'mixed competitor approval reports the complete four-row set');
select ok(not ((:'approved_one_result'::jsonb)->>'idempotent_replay')::boolean
  and not ((:'approved_two_result'::jsonb)->>'idempotent_replay')::boolean,
  'initial approvals are not replays');

select ok((select ownership_status='active' and authority_type='primary_controller'
  and supplier_profile_id=pg_temp.approve_id(201)
  and controller_user_profile_id=pg_temp.approve_id(101)
  and valid_until is null and record_version=1
  and establishment_source_type='claim_approval'
  and establishment_reason_code='verified_claim_approved'
  and established_by_user_profile_id=pg_temp.approve_id(1)
  and establishment_system_source is null
  and closure_reason_code is null and closed_at is null
  and transfer_successor_ownership_id is null
  and created_by_user_profile_id=pg_temp.approve_id(1)
  and updated_by_user_profile_id=pg_temp.approve_id(1)
  and valid_from=established_at and valid_from=created_at and valid_from=updated_at
  from public.supplier_ownerships
  where id=((:'approved_one_result'::jsonb)->>'ownership_id')::uuid),
  'successful approval creates the exact primary ownership mapping');
select ok((select status='approved' and record_version=3
  and decided_by_user_profile_id=reviewer_user_profile_id
  and decided_at is not null and decision_reason_code='verified_claim_approved'
  and evidence_verification_method_code='manual_review'
  and evidence_verification_version='claim_evidence_review_v1'
  and evidence_verification_outcome_code='verified'
  and decision_authorization_policy_version='claim_approval_reason_registry_v1'
  and reviewer_notes is null
  and resulting_supplier_ownership_id=((:'approved_one_result'::jsonb)->>'ownership_id')::uuid
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1001)),
  'winner transitions under_review to approved exactly once with approved evidence fields');
select ok((select reviewer_user_profile_id=pg_temp.approve_id(1)
  and reviewer_assignment_version=1
  and reviewer_assignment_source_code='owner_assignment'
  and reviewer_assignment_policy_version='claim_reviewer_assignment_v1'
  and submitted_reason='Synthetic approval Claim 1001'
  and submission_fingerprint=pg_catalog.repeat('c',64)
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1001)),
  'winner preserves immutable submission and assignment provenance');
select is((select pg_catalog.count(*) from public.supplier_ownerships
  where supplier_profile_id=pg_temp.approve_id(201)
    and authority_type='primary_controller' and ownership_status='active'),1::bigint,
  'successful approval leaves exactly one active primary ownership');

select is((select pg_catalog.array_agg(status order by id)
  from public.supplier_ownership_claims where id between pg_temp.approve_id(1101) and pg_temp.approve_id(1104)),
  array['superseded','superseded','superseded','superseded']::text[],
  'all submitted and under-review competitors, including due rows, are superseded');
select is((select pg_catalog.array_agg(record_version order by id)
  from public.supplier_ownership_claims where id between pg_temp.approve_id(1101) and pg_temp.approve_id(1104)),
  array[2,2,3,3]::integer[],
  'every competitor increments exactly once from its own prior version');
select ok(not exists(select 1 from public.supplier_ownership_claims
  where id between pg_temp.approve_id(1101) and pg_temp.approve_id(1104)
    and (supersession_reason_code<>'competing_claim_superseded_by_approval'
      or superseded_by_claim_id<>pg_temp.approve_id(1002)
      or superseded_at<>(select decided_at from public.supplier_ownership_claims where id=pg_temp.approve_id(1002)))),
  'competitors share the trusted supersession time, reason, and winning successor');
select ok((select reviewer_user_profile_id=pg_temp.approve_id(1)
  and reviewer_assignment_version=1 and reviewer_assigned_at is not null
  and reviewer_assignment_source_code='owner_assignment'
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1103)),
  'under-review competitor preserves immutable assignment provenance');
select is((select pg_catalog.array_agg(status order by id)
  from public.supplier_ownership_claims where id between pg_temp.approve_id(1105) and pg_temp.approve_id(1108)),
  array['rejected','withdrawn','superseded','approved']::text[],
  'rejected, withdrawn, superseded, and coherent historical approved Claims remain immutable');
select is((select pg_catalog.array_agg(record_version order by id)
  from public.supplier_ownership_claims where id between pg_temp.approve_id(1105) and pg_temp.approve_id(1108)),
  array[3,2,2,3]::integer[],
  'terminal Claim versions are preserved');
select ok((select ownership_status='revoked' and record_version=2
  from public.supplier_ownerships where id=pg_temp.approve_id(5001)),
  'coherent historical approval ownership remains immutable');

select is((select pg_catalog.array_agg(event_ordinal order by event_ordinal)
  from internal.domain_events where producer_idempotency_key_id=(select id from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1002) and command_name='supplier_claim.approve')),
  array[1,2,3,4,5]::integer[],
  'approval event ordinals are contiguous from one through N');
select is((select pg_catalog.array_agg(event_type order by event_ordinal)
  from internal.domain_events where producer_idempotency_key_id=(select id from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1002) and command_name='supplier_claim.approve')),
  array['supplier_ownership.claim_approved','supplier_ownership.claim_superseded',
    'supplier_ownership.claim_superseded','supplier_ownership.claim_superseded',
    'supplier_ownership.claim_superseded']::text[],
  'ordinal one is approved and ordinals two through N are superseded events');
select is((select pg_catalog.array_agg(aggregate_id order by event_ordinal)
  from internal.domain_events where producer_idempotency_key_id=(select id from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1002) and command_name='supplier_claim.approve')
    and event_ordinal>=2),
  array[pg_temp.approve_id(1101),pg_temp.approve_id(1102),
    pg_temp.approve_id(1103),pg_temp.approve_id(1104)]::uuid[],
  'superseded events are ordered by ascending competing Claim UUID');
select ok((select payload=pg_catalog.jsonb_build_object(
    'claim_id',pg_temp.approve_id(1002),'supplier_profile_id',pg_temp.approve_id(202),
    'claimant_user_profile_id',pg_temp.approve_id(102),
    'ownership_id',((:'approved_two_result'::jsonb)->>'ownership_id')::uuid,'claim_version',3)
  from internal.domain_events where aggregate_id=pg_temp.approve_id(1002)
    and event_type='supplier_ownership.claim_approved'),
  'approved event has the exact minimum v1 payload');
select ok(not exists(select 1 from internal.domain_events
  where producer_command_name='supplier_claim.approve'
    and row_to_json(domain_events)::text ~ 'approve-ref|checked_source|evidence_digest|reviewer_notes'),
  'approval events leak no restricted evidence, source classes, digest, or reviewer notes');
select is((select pg_catalog.count(*) from internal.domain_events
  where producer_command_name='supplier_claim.approve'
    and event_type like '%ownership_established%'),0::bigint,
  'approve emits no separate ownership-established event');

select is((select pg_catalog.count(*) from internal.audit_logs
  where action_code='supplier_claim.approve' and outcome_class='succeeded'),4::bigint,
  'each successful approval writes exactly one primary success audit');
select ok((select action_class='claim_ownership' and result_code='approved'
  and reason_code='verified_claim_approved'
  and retention_class='claim_ownership_decision'
  and actor_authorization_snapshot='admin'
  and safe_context_schema_version='claim_approve_context_v1'
  and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(safe_context))=19
  and safe_context->>'reason_registry_version'='claim_approval_reason_registry_v1'
  and safe_context->>'approval_evidence_policy_version'='claim_approval_evidence_policy_v1'
  and safe_context->>'superseded_claim_count'='4'
  and safe_context->>'resulting_supplier_ownership_id'=((:'approved_two_result'::jsonb)->>'ownership_id')
  and safe_context->'checked_source_classes'='["authorized_officer_confirmation"]'::jsonb
  and prior_state_code='under_review' and result_state_code='approved'
  and prior_record_version=2 and result_record_version=3
  and cardinality(changed_field_codes)=10
  and evidence_digest ~ '^[0-9a-f]{64}$'
  and evidence_digest_algorithm='sha256'
  and evidence_digest_version='claim_approve_evidence_digest_v1'
  and restricted_evidence_reference='approve-ref-officer'
  and action_evidence_schema_version='claim_approve_success_v1'
  and authorization_policy_version='sec-001-claim-v1'
  and producer_contract_version='supplier_claim.approve.v1'
  from internal.audit_logs where target_id=pg_temp.approve_id(1002)
    and source_operation_class='trusted_command'),
  'primary approval audit has the exact actor, aggregate, reason, evidence, count, and version binding');
select is((select evidence_digest from internal.audit_logs
  where target_id=pg_temp.approve_id(1001) and outcome_class='succeeded'),
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    'claim-approve-evidence-digest-v1|20:approve-ref-official','UTF8'),'sha256'),'hex'),
  'server derives the exact versioned SHA-256 evidence digest');
select ok(not exists(select 1 from internal.idempotency_keys
  where row_to_json(idempotency_keys)::text like '%'||pg_temp.approve_key(1)||'%'
     or row_to_json(idempotency_keys)::text like '%approve-ref-official%'),
  'raw idempotency keys and restricted evidence references are absent from idempotency state');
select ok((select status='completed' and outcome_code='approved'
  and result_resource_type='supplier_ownership_claim'
  and result_resource_id=pg_temp.approve_id(1002) and result_version_token='3'
  and completed_at=(select decided_at from public.supplier_ownership_claims where id=pg_temp.approve_id(1002))
  from internal.idempotency_keys where target_aggregate_id=pg_temp.approve_id(1002)
    and command_name='supplier_claim.approve'),
  'idempotency completion binds the exact winner and committed Claim version');
select ok(pg_catalog.to_regclass('public.notifications') is null,
  'successful approval inserts no notification');

select (select pg_catalog.count(*) from public.supplier_ownerships) ownership_count,
  (select pg_catalog.count(*) from internal.domain_events where producer_command_name='supplier_claim.approve') event_count,
  (select pg_catalog.count(*) from internal.audit_logs where action_code='supplier_claim.approve') audit_count,
  (select pg_catalog.sum(record_version) from public.supplier_ownership_claims) version_sum \gset before_replay_
set role mujahiz_claim_runtime;
select pg_temp.run_approve(pg_temp.approve_id(2),pg_temp.approve_key(2),
  pg_temp.approve_id(1002),2,1,
  array['authorized_officer_confirmation','authorized_officer_confirmation'],
  'approve-ref-officer') result \gset replay_two_
reset role;
select ok((:'replay_two_result'::jsonb)->>'reservation_outcome'='replay'
  and ((:'replay_two_result'::jsonb)->>'idempotent_replay')::boolean
  and (:'replay_two_result'::jsonb)->>'ownership_id'=(:'approved_two_result'::jsonb)->>'ownership_id'
  and (:'replay_two_result'::jsonb)->>'superseded_claim_count'='4',
  'M2: valid exact audit context returns the read-only replay envelope');
select ok((select pg_catalog.count(*) from public.supplier_ownerships)=:'before_replay_ownership_count'::bigint
  and (select pg_catalog.count(*) from internal.domain_events where producer_command_name='supplier_claim.approve')=:'before_replay_event_count'::bigint
  and (select pg_catalog.count(*) from internal.audit_logs where action_code='supplier_claim.approve')=:'before_replay_audit_count'::bigint
  and (select pg_catalog.sum(record_version) from public.supplier_ownership_claims)=:'before_replay_version_sum'::bigint,
  'completed replay creates no ownership, mutation, event, audit, or version increment');

-- M1: completed replay is a currently authorized response. Every mutation and
-- attempted replay below is rolled back by the inner exception subtransaction.
select (select pg_catalog.count(*) from public.supplier_ownership_claims) claim_count,
  (select pg_catalog.sum(record_version) from public.supplier_ownership_claims) claim_version_sum,
  (select pg_catalog.count(*) from public.supplier_ownerships) ownership_count,
  (select pg_catalog.count(*) from internal.audit_logs) audit_count,
  (select pg_catalog.count(*) from internal.domain_events) event_count,
  (select pg_catalog.count(*) from internal.idempotency_keys) idempotency_count
  \gset before_m1_

create function pg_temp.probe_completed_replay_authorization(p_kind text)
returns text language plpgsql volatile security invoker set search_path=pg_catalog as $$
begin
  begin
    case p_kind
      when 'role_unusable' then
        update public.platform_role_assignments
        set valid_until=pg_catalog.statement_timestamp()-interval '1 second'
        where user_profile_id=pg_temp.approve_id(2);
      when 'access_unusable' then
        update public.access_grants
        set valid_until=pg_catalog.statement_timestamp()-interval '1 second'
        where user_profile_id=pg_temp.approve_id(2);
      when 'security_deny' then
        update internal.security_eligibility_assessments
        set assessment_result='deny',condition_type='security_hold',
          assessment_source_type='trusted_security_system'
        where user_profile_id=pg_temp.approve_id(2);
      when 'security_unknown' then
        update internal.security_eligibility_assessments
        set assessment_result='unknown',
          condition_type='reconciliation_required',
          assessment_source_type='trusted_security_system'
        where user_profile_id=pg_temp.approve_id(2);
      when 'supplier_conflict' then
        perform pg_temp.seed_claim(9905,2,202,'submitted',1,3,false);
      else
        raise exception 'unknown replay authorization probe';
    end case;

    perform pg_temp.run_approve(
      pg_temp.approve_id(2),pg_temp.approve_key(2),
      pg_temp.approve_id(1002),2,1,
      array['authorized_officer_confirmation'],'approve-ref-officer');
    return 'no_error';
  exception when others then
    return sqlstate||':'||sqlerrm;
  end;
end $$;

select is(pg_catalog.split_part(
    pg_temp.probe_completed_replay_authorization('role_unusable'),':',1),
  'P5100','M1: unusable reviewer role suppresses completed replay');
select is(pg_catalog.split_part(
    pg_temp.probe_completed_replay_authorization('access_unusable'),':',1),
  'P5100','M1: unusable reviewer access suppresses completed replay');
select is(pg_catalog.split_part(
    pg_temp.probe_completed_replay_authorization('security_deny'),':',1),
  'P5100','M1: current reviewer security deny suppresses completed replay');
select is(pg_catalog.split_part(
    pg_temp.probe_completed_replay_authorization('security_unknown'),':',1),
  'P5100','M1: incomplete reviewer security suppresses completed replay');
select is(pg_catalog.split_part(
    pg_temp.probe_completed_replay_authorization('supplier_conflict'),':',1),
  'P5100','M1: current target-Supplier conflict suppresses completed replay');
select ok(
  (select pg_catalog.count(*) from public.supplier_ownership_claims)=
    :'before_m1_claim_count'::bigint
  and (select pg_catalog.sum(record_version) from public.supplier_ownership_claims)=
    :'before_m1_claim_version_sum'::bigint
  and (select pg_catalog.count(*) from public.supplier_ownerships)=
    :'before_m1_ownership_count'::bigint
  and (select pg_catalog.count(*) from internal.audit_logs)=
    :'before_m1_audit_count'::bigint
  and (select pg_catalog.count(*) from internal.domain_events)=
    :'before_m1_event_count'::bigint
  and (select pg_catalog.count(*) from internal.idempotency_keys)=
    :'before_m1_idempotency_count'::bigint,
  'M1: denied replay probes mutate no Claim, ownership, audit, event, or idempotency state');

set role mujahiz_claim_runtime;
select pg_temp.run_approve(pg_temp.approve_id(2),pg_temp.approve_key(2),
  pg_temp.approve_id(1002),2,1,array['official_registry','claimant_authority'],
  'approve-ref-officer') result \gset fingerprint_conflict_
reset role;
select is((:'fingerprint_conflict_result'::jsonb)->>'outcome_code','idempotency_key_conflict',
  'same key with different normalized evidence path conflicts');
select is((select pg_catalog.count(*) from internal.domain_events
  where producer_idempotency_key_id=(select id from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1002) and command_name='supplier_claim.approve')),5::bigint,
  'same-key conflict creates no duplicate event');

-- Input validation, exact decision predicate, and fail-closed denials.
select pg_temp.seed_eligible_actor(4,'owner');
select pg_temp.seed_claimant(n) from pg_catalog.generate_series(119,132) n;
select pg_temp.seed_supplier(n) from pg_catalog.generate_series(204,216) n;
select pg_temp.seed_claim(1201,119,204,'under_review',1,3,false);

set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(20),pg_temp.approve_id(1201),
  'official_registry','invalid-missing-class'),
  'P5101','invalid_request','missing source class fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L,%L,%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(21),pg_temp.approve_id(1201),
  'official_registry','claimant_authority','extra_class','invalid-extra-class'),
  'P5101','invalid_request','extra source class fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(22),pg_temp.approve_id(1201),
  'unknown_source','invalid-unknown-class'),
  'P5101','invalid_request','unknown source class fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L,%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(23),pg_temp.approve_id(1201),
  'company_domain_challenge','official_registry','invalid-mixed-path'),
  'P5101','invalid_request','unsupported mixed source path fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,null::text[],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(24),pg_temp.approve_id(1201),
  'invalid-null-classes'),
  'P5101','invalid_request','null source-class array fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[]::text[],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(25),pg_temp.approve_id(1201),
  'invalid-empty-classes'),
  'P5101','invalid_request','empty source-class array fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(26),pg_temp.approve_id(1201),
  'bad-class','invalid-malformed-class'),
  'P5101','invalid_request','malformed source class fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L,%L,%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(27),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','invalid-method','automated_review',
  'claim_evidence_review_v1','verified'),
  'P5101','invalid_request','unapproved evidence method fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L,%L,%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(28),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','invalid-version','manual_review',
  'claim_evidence_review_v2','verified'),
  'P5101','invalid_request','unapproved evidence version fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L,%L,%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(29),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','invalid-outcome','manual_review',
  'claim_evidence_review_v1','not_verified'),
  'P5101','invalid_request','non-verified approval outcome fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(30),pg_temp.approve_id(1201),
  'authorized_officer_confirmation',''),
  'P5101','invalid_request','empty restricted evidence reference fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],repeat(%L,257))',
  pg_temp.approve_id(1),pg_temp.approve_key(31),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','x'),
  'P5101','invalid_request','overlong restricted evidence reference fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(32),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','https://private.example/evidence'),
  'P5101','invalid_request','private URL evidence reference fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(33),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','file_id:secret'),
  'P5101','invalid_request','file-dependent evidence reference fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(34),pg_temp.approve_id(1201),
  'authorized_officer_confirmation','token=value'),
  'P5101','invalid_request','credential-shaped evidence reference fails closed');
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.approve(%L,%L::uuid,2,1,%L,%L,%L,array[%L],%L,%L,%L::uuid)',
  pg_temp.approve_key(35),pg_temp.approve_id(1201),'manual_review',
  'claim_evidence_review_v1','verified','authorized_officer_confirmation',
  'opaque-ref','unsupported_registry',null),
  '42883',null,'unsupported caller-supplied registry version has no business signature');
reset role;
select is((select pg_catalog.count(*) from internal.idempotency_keys
  where target_aggregate_id=pg_temp.approve_id(1201)),0::bigint,
  'invalid evidence requests create no idempotency state');

select pg_temp.seed_claim(1301,120,205,'under_review',1,3,false);
select pg_temp.seed_claim(1302,121,206,'under_review',1,3,false);
select pg_temp.seed_claim(1303,122,207,'under_review',1,3,false);
select pg_temp.seed_claim(1304,123,208,'under_review',1,3,true);
select pg_temp.seed_claim(1305,124,209,'under_review',1,3,false);
update public.user_profiles set verification_mirror_status='unverified'
where id=pg_temp.approve_id(124);
select pg_temp.seed_claim(1306,125,210,'under_review',1,3,false);
update public.supplier_profiles set listing_status='watchlist',verification_status='watchlist'
where id=pg_temp.approve_id(210);
select pg_temp.seed_claim(1307,126,211,'under_review',1,3,false);
select pg_temp.seed_claim(1397,1,211,'submitted',1,3,false);
select pg_temp.seed_claim(1308,127,212,'under_review',1,3,false);
insert into public.supplier_ownerships(
  id,supplier_profile_id,controller_user_profile_id,authority_type,
  ownership_status,valid_from,establishment_source_type,
  establishment_reason_code,establishment_system_source)
values(pg_temp.approve_id(5101),pg_temp.approve_id(212),pg_temp.approve_id(128),
  'primary_controller','active',pg_catalog.statement_timestamp()-interval '1 day',
  'legacy_reconciliation','verified_existing_owner','approve_test');
select pg_temp.seed_claim(1309,129,213,'under_review',1,3,false);
insert into public.supplier_ownerships(
  id,supplier_profile_id,controller_user_profile_id,authority_type,ownership_status,
  valid_from,valid_until,record_version,establishment_source_type,
  establishment_reason_code,established_by_user_profile_id,established_at,
  closure_reason_code,closed_by_user_profile_id,closed_at,
  created_at,created_by_user_profile_id,updated_at,updated_by_user_profile_id)
select pg_temp.approve_id(5102),pg_temp.approve_id(213),pg_temp.approve_id(129),
  'primary_controller','revoked',t,t+interval '1 hour',2,'claim_approval',
  'verified_claim_approved',pg_temp.approve_id(1),t,'test_closure',
  pg_temp.approve_id(1),t+interval '1 hour',t,pg_temp.approve_id(1),
  t+interval '1 hour',pg_temp.approve_id(1)
from (select pg_catalog.statement_timestamp()-interval '2 days' t) q;
select pg_temp.seed_claim(1310,130,214,'under_review',1,3,false);
update public.supplier_ownership_claims
set reviewer_assignment_policy_version='unsupported_assignment_policy'
where id=pg_temp.approve_id(1310);
select pg_temp.seed_claim(1311,131,215,'submitted',1,3,false);
select pg_temp.seed_claim(1312,132,216,'under_review',1,3,false);
update public.supplier_ownership_claims
set claimant_snapshot_schema_version='unsupported_snapshot'
where id=pg_temp.approve_id(1312);

set role mujahiz_claim_runtime;
select pg_temp.run_approve(pg_temp.approve_id(4),pg_temp.approve_key(40),
  pg_temp.approve_id(1301),2,1,array['authorized_officer_confirmation'],
  'wrong-reviewer') result \gset wrong_reviewer_
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,1,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(41),pg_temp.approve_id(1302),
  'authorized_officer_confirmation','stale-claim-version'),
  'P5112','claim_version_conflict','wrong expected Claim version fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,2,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(42),pg_temp.approve_id(1303),
  'authorized_officer_confirmation','stale-assignment-version'),
  'P5112','claim_version_conflict','wrong reviewer-assignment version fails closed');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(43),pg_temp.approve_id(1304),
  'authorized_officer_confirmation','due-winning-claim'),
  'P5114','claim_expired','due winning Claim cannot be approved');
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(44),
  pg_temp.approve_id(1305),2,1,array['authorized_officer_confirmation'],
  'ineligible-claimant') result \gset ineligible_claimant_
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(45),
  pg_temp.approve_id(1306),2,1,array['authorized_officer_confirmation'],
  'ineligible-supplier') result \gset ineligible_supplier_
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(46),
  pg_temp.approve_id(1307),2,1,array['authorized_officer_confirmation'],
  'reviewer-conflict') result \gset reviewer_conflict_
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(47),
  pg_temp.approve_id(1308),2,1,array['authorized_officer_confirmation'],
  'active-owner') result \gset active_owner_
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(48),
  pg_temp.approve_id(1309),2,1,array['authorized_officer_confirmation'],
  'contradictory-history') result \gset bad_history_
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(49),
  pg_temp.approve_id(1310),2,1,array['authorized_officer_confirmation'],
  'bad-assignment') result \gset bad_assignment_
select throws_ok(pg_catalog.format(
  'select pg_temp.run_approve(%L::uuid,%L,%L::uuid,1,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(50),pg_temp.approve_id(1311),
  'authorized_officer_confirmation','submitted-winner'),
  'P5113','claim_not_actionable','submitted Claim is not approve-actionable');
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(51),
  pg_temp.approve_id(1312),2,1,array['authorized_officer_confirmation'],
  'bad-immutable-shape') result \gset bad_immutable_
reset role;

select is((:'wrong_reviewer_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'eligible but unassigned reviewer is denied');
select is((:'ineligible_claimant_result'::jsonb)->>'outcome_code','claimant_ineligible',
  'claimant must remain relationally approval-eligible');
select is((:'ineligible_supplier_result'::jsonb)->>'outcome_code','supplier_ineligible',
  'Supplier must remain approved and non-watchlisted');
select is((:'reviewer_conflict_result'::jsonb)->>'outcome_code','reviewer_conflict',
  'target-Supplier reviewer conflict fails closed');
select is((:'active_owner_result'::jsonb)->>'outcome_code','supplier_already_owned',
  'existing active primary ownership blocks approval');
select is((:'bad_history_result'::jsonb)->>'outcome_code','integrity_reconciliation_required',
  'claim-approval ownership without coherent approved Claim provenance fails reconciliation');
select is((:'bad_assignment_result'::jsonb)->>'outcome_code','integrity_reconciliation_required',
  'malformed assignment provenance is not repaired');
select is((:'bad_immutable_result'::jsonb)->>'outcome_code','integrity_reconciliation_required',
  'malformed immutable submission shape fails reconciliation');
select ok(not exists(select 1 from public.supplier_ownerships
  where supplier_profile_id in (pg_temp.approve_id(205),pg_temp.approve_id(209),
    pg_temp.approve_id(210),pg_temp.approve_id(211),pg_temp.approve_id(213),
    pg_temp.approve_id(214),pg_temp.approve_id(216))
    and establishment_source_type='claim_approval'
    and valid_from>pg_catalog.statement_timestamp()-interval '1 hour'),
  'authorization, eligibility, conflict, and integrity denials create no ownership');
select ok(not exists(select 1 from internal.domain_events
  where aggregate_id between pg_temp.approve_id(1301) and pg_temp.approve_id(1312)),
  'all denied and invalid approval attempts emit no domain event');
select is((select pg_catalog.count(*) from internal.audit_logs
  where action_code='supplier_claim.approve' and source_operation_class='trusted_command_denial'
    and target_id in (pg_temp.approve_id(1301),pg_temp.approve_id(1305),
      pg_temp.approve_id(1306),pg_temp.approve_id(1307),pg_temp.approve_id(1308),
      pg_temp.approve_id(1309),pg_temp.approve_id(1310),pg_temp.approve_id(1312))),8::bigint,
  'accountable terminal denials each write one minimized primary denial audit');
select ok(not exists(select 1 from internal.audit_logs
  where action_code='supplier_claim.approve' and source_operation_class='trusted_command_denial'
    and (safe_context is not null or evidence_digest is not null
      or restricted_evidence_reference is not null or cardinality(changed_field_codes)<>0)),
  'denial audits contain no private approval evidence or claimed mutation');
select ok(not exists(select 1 from public.supplier_ownership_claims
  where id in (pg_temp.approve_id(1301),pg_temp.approve_id(1305),
    pg_temp.approve_id(1306),pg_temp.approve_id(1307),pg_temp.approve_id(1308),
    pg_temp.approve_id(1309),pg_temp.approve_id(1310),pg_temp.approve_id(1312))
    and status<>'under_review'),
  'terminal denials mutate no target Claim');

-- Completed replay corruption probes. Each inner exception subtransaction rolls
-- back the synthetic corruption before returning its fail-closed SQLSTATE.
commit;
begin;
set local search_path = public, internal, extensions, pg_catalog;

create function pg_temp.probe_completed_corruption(p_kind text)
returns text language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_idempotency_id uuid; v_ownership_id uuid;
begin
  select row_value.id into v_idempotency_id
  from internal.idempotency_keys row_value
  where row_value.command_name='supplier_claim.approve'
    and row_value.target_aggregate_id=pg_temp.approve_id(1002);
  select resulting_supplier_ownership_id into v_ownership_id
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1002);
  begin
    case p_kind
      when 'winner_mismatch' then
        update public.supplier_ownership_claims set reviewer_notes='corrupt'
        where id=pg_temp.approve_id(1002);
      when 'ownership_mismatch' then
        update public.supplier_ownerships set establishment_reason_code='corrupt_reason'
        where id=v_ownership_id;
      when 'ownership_missing' then
        execute 'alter table public.supplier_ownership_claims drop constraint supplier_ownership_claims_resulting_supplier_ownership_fk';
        delete from public.supplier_ownerships
        where id=v_ownership_id;
      when 'ownership_inactive' then
        update public.supplier_ownerships
        set ownership_status='revoked',
            valid_until=valid_from+interval '1 microsecond',
            closure_reason_code='synthetic_corruption',
            closed_by_user_profile_id=established_by_user_profile_id,
            closed_at=valid_from+interval '1 microsecond',
            updated_at=valid_from+interval '1 microsecond',
            updated_by_user_profile_id=established_by_user_profile_id
        where id=v_ownership_id;
      when 'ownership_duplicate' then
        execute 'alter table public.supplier_ownerships drop constraint supplier_ownerships_supplier_interval_excl';
        execute 'drop index public.supplier_ownerships_one_active_primary_controller_uidx';
        insert into public.supplier_ownerships(
          id,supplier_profile_id,controller_user_profile_id,authority_type,
          ownership_status,valid_from,valid_until,record_version,
          establishment_source_type,establishment_reason_code,
          established_by_user_profile_id,establishment_system_source,established_at,
          closure_reason_code,closed_by_user_profile_id,closure_system_source,
          closed_at,transfer_successor_ownership_id,created_at,
          created_by_user_profile_id,updated_at,updated_by_user_profile_id)
        select pg_temp.approve_id(9901),supplier_profile_id,controller_user_profile_id,
          authority_type,ownership_status,valid_from,valid_until,record_version,
          establishment_source_type,establishment_reason_code,
          established_by_user_profile_id,establishment_system_source,established_at,
          closure_reason_code,closed_by_user_profile_id,closure_system_source,
          closed_at,transfer_successor_ownership_id,created_at,
          created_by_user_profile_id,updated_at,updated_by_user_profile_id
        from public.supplier_ownerships where id=v_ownership_id;
      when 'competitor_successor' then
        update public.supplier_ownership_claims
        set superseded_by_claim_id=pg_temp.approve_id(1003)
        where id=pg_temp.approve_id(1101);
      when 'competitor_missing' then
        delete from public.supplier_ownership_claims
        where id=pg_temp.approve_id(1101);
      when 'competitor_membership_timestamp' then
        update public.supplier_ownership_claims
        set superseded_at=superseded_at+interval '1 microsecond'
        where id=pg_temp.approve_id(1101);
      when 'competitor_extra_active' then
        insert into public.supplier_ownership_claims(
          id,claimant_user_profile_id,supplier_profile_id,status,record_version,
          submitted_at,expires_at,submitted_reason,claimant_snapshot_schema_version,
          claimant_snapshot,submission_fingerprint_version,submission_fingerprint,
          evidence_schema_version,evidence_descriptors,created_at,updated_at)
        select pg_temp.approve_id(9902),pg_temp.approve_id(130),pg_temp.approve_id(202),
          'submitted',1,t,t+interval '720 hours','corrupt extra competitor',
          'claimant_snapshot_v1','{}'::jsonb,'claim_submit_v1',repeat('d',64),
          'claim_evidence_v1','[]'::jsonb,t,t
        from (select pg_catalog.statement_timestamp()-interval '1 hour' t) q;
      when 'event_missing' then
        delete from internal.domain_events
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=2;
      when 'event_duplicate' then
        insert into internal.domain_events(
          id,event_type,event_schema_version,aggregate_type,aggregate_id,
          aggregate_sequence,producer_command_name,producer_command_contract_version,
          producer_idempotency_key_id,source_system_code,event_ordinal,
          actor_kind,actor_user_profile_id,environment_code,
          producing_component_code,correlation_id,occurred_at,persisted_at,
          payload,processing_status,available_at)
        select pg_temp.approve_id(9903),event_type,event_schema_version,
          aggregate_type,pg_temp.approve_id(9903),1,producer_command_name,
          producer_command_contract_version,producer_idempotency_key_id,
          source_system_code,99,actor_kind,actor_user_profile_id,
          environment_code,producing_component_code,correlation_id,
          occurred_at,persisted_at,payload,processing_status,available_at
        from internal.domain_events
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=1;
      when 'event_reordered' then
        update internal.domain_events set event_ordinal=99
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=2;
        update internal.domain_events set event_ordinal=2
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=3;
        update internal.domain_events set event_ordinal=3
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=99;
      when 'event_payload' then
        update internal.domain_events
        set payload=payload||'{"unexpected":"private"}'::jsonb
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=2;
      when 'event_sequence' then
        update internal.domain_events set aggregate_sequence=99
        where producer_idempotency_key_id=v_idempotency_id and event_ordinal=2;
      when 'audit_missing' then
        delete from internal.audit_logs
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_duplicate' then
        insert into internal.audit_logs
        select (pg_catalog.jsonb_populate_record(
          null::internal.audit_logs,
          pg_catalog.to_jsonb(audit_row)||pg_catalog.jsonb_build_object(
            'id',pg_temp.approve_id(9904)
          )
        )).*
        from internal.audit_logs audit_row
        where audit_row.idempotency_reference=v_idempotency_id
          and audit_row.source_operation_class='trusted_command';
      when 'audit_json_null' then
        update internal.audit_logs
        set safe_context=pg_catalog.jsonb_set(
          safe_context,'{reason_registry_version}','null'::jsonb,false)
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_wrong_string' then
        update internal.audit_logs
        set safe_context=pg_catalog.jsonb_set(
          safe_context,'{reason_registry_version}',
          '"unsupported_registry_v1"'::jsonb,false)
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_wrong_type' then
        update internal.audit_logs
        set safe_context=pg_catalog.jsonb_set(
          safe_context,'{reason_registry_version}',
          '{"unexpected":"object"}'::jsonb,false)
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_mismatch' then
        update internal.audit_logs
        set safe_context=safe_context-'checked_source_classes'
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_extra_key' then
        update internal.audit_logs
        set safe_context=safe_context||'{"unexpected_key":"unexpected"}'::jsonb
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_actor_profile' then
        execute 'alter table internal.audit_logs drop constraint audit_logs_actor_shape_ck';
        update internal.audit_logs set actor_user_profile_id=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_actor_authorization' then
        update internal.audit_logs set actor_authorization_snapshot=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_target_id' then
        execute 'alter table internal.audit_logs drop constraint audit_logs_target_shape_ck';
        update internal.audit_logs set target_id=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_related_type' then
        execute 'alter table internal.audit_logs drop constraint audit_logs_related_target_shape_ck';
        update internal.audit_logs set related_target_entity_type=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_related_id' then
        execute 'alter table internal.audit_logs drop constraint audit_logs_related_target_shape_ck';
        update internal.audit_logs set related_target_id=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_context_schema' then
        update internal.audit_logs set safe_context_schema_version=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_context' then
        update internal.audit_logs set safe_context=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_idempotency_reference' then
        update internal.audit_logs set idempotency_reference=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_domain_event_reference' then
        update internal.audit_logs set domain_event_reference=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_prior_state' then
        update internal.audit_logs set prior_state_code=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_result_state' then
        update internal.audit_logs set result_state_code=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_prior_version' then
        update internal.audit_logs set prior_record_version=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_result_version' then
        update internal.audit_logs set result_record_version=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_evidence_digest' then
        update internal.audit_logs set evidence_digest=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_evidence_algorithm' then
        update internal.audit_logs set evidence_digest_algorithm=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_evidence_version' then
        update internal.audit_logs set evidence_digest_version=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_sql_null_restricted_reference' then
        update internal.audit_logs set restricted_evidence_reference=null
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'audit_outer_wrong_values' then
        update internal.audit_logs
        set prior_state_code='submitted',result_state_code='rejected',
            prior_record_version=1,result_record_version=4
        where idempotency_reference=v_idempotency_id
          and source_operation_class='trusted_command';
      when 'idempotency_mismatch' then
        update internal.idempotency_keys set result_version_token='4'
        where id=v_idempotency_id;
      else
        raise exception 'unknown corruption probe';
    end case;

    perform pg_temp.run_approve(
      pg_temp.approve_id(2),pg_temp.approve_key(2),pg_temp.approve_id(1002),
      2,1,array['authorized_officer_confirmation'],'approve-ref-officer');
    return 'no_error';
  exception when others then
    return sqlstate||':'||sqlerrm;
  end;
end $$;

select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('winner_mismatch'),':',1),
  'P5199','corrupted completed winning Claim fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('ownership_mismatch'),':',1),
  'P5199','mismatched resulting ownership fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('ownership_missing'),':',1),
  'P5199','missing resulting ownership fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('ownership_inactive'),':',1),
  'P5199','inactive resulting ownership fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('ownership_duplicate'),':',1),
  'P5199','duplicate active resulting ownership fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('competitor_successor'),':',1),
  'P5199','mismatched superseded competitor successor fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('competitor_missing'),':',1),
  'P5199','missing superseded competitor aggregate fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('competitor_membership_timestamp'),':',1),
  'P5199','competitor missing from the exact approval set fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('competitor_extra_active'),':',1),
  'P5199','unexpected active competitor after completion fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('event_missing'),':',1),
  'P5199','missing ordered approval event fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('event_duplicate'),':',1),
  'P5199','duplicate approval-produced event fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('event_reordered'),':',1),
  'P5199','reordered supersession events fail closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('event_payload'),':',1),
  'P5199','mismatched supersession event payload fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('event_sequence'),':',1),
  'P5199','mismatched supersession event sequence fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_missing'),':',1),
  'P5199','missing primary approval audit fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_duplicate'),':',1),
  'P5199','duplicate primary approval audit fails closed');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_json_null'),':',1),
  'P5199','M2: required audit context JSON null fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_wrong_string'),':',1),
  'P5199','M2: wrong audit context string fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_wrong_type'),':',1),
  'P5199','M2: wrong audit context JSON type fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_mismatch'),':',1),
  'P5199','M2: missing required audit context key fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('audit_extra_key'),':',1),
  'P5199','M2: unexpected audit context key fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_actor_profile'),':',1),
  'P5199','M2 outer audit: SQL-NULL actor profile fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_actor_authorization'),':',1),
  'P5199','M2 outer audit: SQL-NULL authorization snapshot fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_target_id'),':',1),
  'P5199','M2 outer audit: SQL-NULL target ID fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_related_type'),':',1),
  'P5199','M2 outer audit: SQL-NULL related target type fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_related_id'),':',1),
  'P5199','M2 outer audit: SQL-NULL related target ID fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_context_schema'),':',1),
  'P5199','M2 outer audit: SQL-NULL context schema fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_context'),':',1),
  'P5199','M2 outer audit: SQL-NULL safe context fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_idempotency_reference'),':',1),
  'P5199','M2 outer audit: SQL-NULL idempotency link fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_domain_event_reference'),':',1),
  'P5199','M2 outer audit: SQL-NULL event link fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_prior_state'),':',1),
  'P5199','M2 outer audit: SQL-NULL prior state fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_result_state'),':',1),
  'P5199','M2 outer audit: SQL-NULL result state fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_prior_version'),':',1),
  'P5199','M2 outer audit: SQL-NULL prior version fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_result_version'),':',1),
  'P5199','M2 outer audit: SQL-NULL result version fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_evidence_digest'),':',1),
  'P5199','M2 outer audit: SQL-NULL evidence digest fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_evidence_algorithm'),':',1),
  'P5199','M2 outer audit: SQL-NULL digest algorithm fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_evidence_version'),':',1),
  'P5199','M2 outer audit: SQL-NULL digest version fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_sql_null_restricted_reference'),':',1),
  'P5199','M2 outer audit: SQL-NULL restricted reference fails reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption(
    'audit_outer_wrong_values'),':',1),
  'P5199','M2 outer audit: wrong valid-looking state/version values fail reconciliation');
select is(pg_catalog.split_part(pg_temp.probe_completed_corruption('idempotency_mismatch'),':',1),
  'P5199','mismatched completed idempotency result binding fails closed');
select ok((select status='approved' and record_version=3
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1002))
  and (select pg_catalog.count(*) from public.supplier_ownerships
    where supplier_profile_id=pg_temp.approve_id(202) and ownership_status='active')=1
  and (select pg_catalog.count(*) from internal.domain_events
    where producer_idempotency_key_id=(select id from internal.idempotency_keys
      where target_aggregate_id=pg_temp.approve_id(1002)
        and command_name='supplier_claim.approve'))=5
  and (select pg_catalog.count(*) from internal.audit_logs
    where idempotency_reference=(select id from internal.idempotency_keys
      where target_aggregate_id=pg_temp.approve_id(1002)
        and command_name='supplier_claim.approve')
      and source_operation_class='trusted_command')=1
  and (select status='completed'
      and outcome_code='approved'
      and result_resource_id=pg_temp.approve_id(1002)
      and result_version_token='3'
      and request_fingerprint is not null
    from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1002)
      and command_name='supplier_claim.approve'),
  'all corruption probes roll back and preserve the authoritative completed aggregate');

-- Accountable terminal denial replay is durable and read-only.
set role mujahiz_claim_runtime;
select pg_temp.run_approve(pg_temp.approve_id(1),pg_temp.approve_key(44),
  pg_temp.approve_id(1305),2,1,array['authorized_officer_confirmation'],
  'ineligible-claimant') result \gset denial_replay_
reset role;
select ok((:'denial_replay_result'::jsonb)->>'reservation_outcome'='replay'
  and ((:'denial_replay_result'::jsonb)->>'idempotent_replay')::boolean
  and (:'denial_replay_result'::jsonb)->>'outcome_code'='claimant_ineligible',
  'identical accountable terminal denial replays safely');
select is((select pg_catalog.count(*) from internal.audit_logs
  where target_id=pg_temp.approve_id(1305)
    and source_operation_class='trusted_command_denial'),1::bigint,
  'denial replay creates no duplicate denial audit');

-- Fenced reservation reclaim and failed Phase-B atomicity.
select pg_temp.seed_claimant(133);
select pg_temp.seed_claimant(134);
select pg_temp.seed_claimant(135);
select pg_temp.seed_claimant(136);
select pg_temp.seed_supplier(217);
select pg_temp.seed_supplier(218);
select pg_temp.seed_supplier(219);
select pg_temp.seed_supplier(220);
select pg_temp.seed_claim(1401,133,217,'under_review',1,3,false);
select pg_temp.seed_claim(1402,134,218,'under_review',1,3,false);
select pg_temp.seed_claim(1403,135,219,'under_review',1,3,false);
select pg_temp.seed_claim(1404,136,220,'under_review',1,3,false);

set role mujahiz_claim_runtime;
select pg_temp.reserve_approve(pg_temp.approve_id(1),pg_temp.approve_key(60),
  pg_temp.approve_id(1401),2,1,array['authorized_officer_confirmation'],
  'reclaim-reference') fence \gset reclaim_old_
select throws_ok(pg_catalog.format(
  'select pg_temp.reserve_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L)',
  pg_temp.approve_id(1),pg_temp.approve_key(60),pg_temp.approve_id(1401),
  'authorized_officer_confirmation','reclaim-reference'),
  'P5109','command_in_progress','live Approve reservation reports in progress');
reset role;
update internal.idempotency_keys
set lease_expires_at=created_at+interval '1 millisecond'
where target_aggregate_id=pg_temp.approve_id(1401)
  and command_name='supplier_claim.approve';
set role mujahiz_claim_runtime;
select pg_temp.reserve_approve(pg_temp.approve_id(1),pg_temp.approve_key(60),
  pg_temp.approve_id(1401),2,1,array['authorized_officer_confirmation'],
  'reclaim-reference') fence \gset reclaim_new_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L::uuid)',
  pg_temp.approve_id(1),pg_temp.approve_key(60),pg_temp.approve_id(1401),
  'authorized_officer_confirmation','reclaim-reference',:'reclaim_old_fence'),
  'P5109','command_in_progress','stale reclaimed Phase-B fence cannot commit');
select pg_temp.execute_approve(pg_temp.approve_id(1),pg_temp.approve_key(60),
  pg_temp.approve_id(1401),2,1,array['authorized_officer_confirmation'],
  'reclaim-reference',:'reclaim_new_fence'::uuid) result \gset reclaim_success_
reset role;
select ok(:'reclaim_old_fence'::uuid<>:'reclaim_new_fence'::uuid
  and (select attempt_count=2 from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1401)
      and command_name='supplier_claim.approve'),
  'expired reservation reclaim rotates the opaque fence and increments attempt count');
select is((:'reclaim_success_result'::jsonb)->>'outcome_code','approved',
  'current reclaimed fence completes exactly once');

create function public.approve_event_failure_test()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.producer_command_name='supplier_claim.approve' then
    raise exception 'synthetic approve event failure';
  end if;
  return new;
end $$;
create trigger approve_event_failure_test before insert on internal.domain_events
for each row execute function public.approve_event_failure_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_approve(pg_temp.approve_id(1),pg_temp.approve_key(61),
  pg_temp.approve_id(1402),2,1,array['authorized_officer_confirmation'],
  'event-failure') fence \gset event_failure_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L::uuid)',
  pg_temp.approve_id(1),pg_temp.approve_key(61),pg_temp.approve_id(1402),
  'authorized_officer_confirmation','event-failure',:'event_failure_fence'),
  'P5199','integrity_reconciliation_required','event failure aborts the complete approval aggregate');
reset role;
drop trigger approve_event_failure_test on internal.domain_events;
drop function public.approve_event_failure_test();
select ok((select status='under_review' and record_version=2
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1402))
  and not exists(select 1 from public.supplier_ownerships where supplier_profile_id=pg_temp.approve_id(218))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.approve_id(1402))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.approve_id(1402))
  and (select status='processing' from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1402)
      and command_name='supplier_claim.approve'),
  'event failure rolls back ownership, Claims, events, audit, and completion');
update internal.idempotency_keys set lease_expires_at=created_at+interval '1 millisecond'
where target_aggregate_id=pg_temp.approve_id(1402)
  and command_name='supplier_claim.approve';
set role mujahiz_claim_runtime;
select pg_temp.reserve_approve(pg_temp.approve_id(1),pg_temp.approve_key(61),
  pg_temp.approve_id(1402),2,1,array['authorized_officer_confirmation'],
  'event-failure') fence \gset event_retry_
select pg_temp.execute_approve(pg_temp.approve_id(1),pg_temp.approve_key(61),
  pg_temp.approve_id(1402),2,1,array['authorized_officer_confirmation'],
  'event-failure',:'event_retry_fence'::uuid) result \gset event_retry_result_
reset role;
select is((:'event_retry_result_result'::jsonb)->>'outcome_code','approved',
  'failed Phase B is safely reclaimable and later completes');

create function public.approve_audit_failure_test()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.action_code='supplier_claim.approve' then
    raise exception 'synthetic approve audit failure';
  end if;
  return new;
end $$;
create trigger approve_audit_failure_test before insert on internal.audit_logs
for each row execute function public.approve_audit_failure_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_approve(pg_temp.approve_id(1),pg_temp.approve_key(62),
  pg_temp.approve_id(1403),2,1,array['authorized_officer_confirmation'],
  'audit-failure') fence \gset audit_failure_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L::uuid)',
  pg_temp.approve_id(1),pg_temp.approve_key(62),pg_temp.approve_id(1403),
  'authorized_officer_confirmation','audit-failure',:'audit_failure_fence'),
  'P5116','audit_unavailable','audit failure returns the safe unavailable error');
reset role;
drop trigger approve_audit_failure_test on internal.audit_logs;
drop function public.approve_audit_failure_test();
select ok((select status='under_review' and record_version=2
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1403))
  and not exists(select 1 from public.supplier_ownerships where supplier_profile_id=pg_temp.approve_id(219))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.approve_id(1403))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.approve_id(1403)),
  'audit failure rolls back ownership, Claim, event, and audit atomically');

create function public.approve_completion_failure_test()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.command_name='supplier_claim.approve' and new.status='completed' then
    raise exception 'synthetic approve completion failure';
  end if;
  return new;
end $$;
create trigger approve_completion_failure_test before update on internal.idempotency_keys
for each row execute function public.approve_completion_failure_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_approve(pg_temp.approve_id(1),pg_temp.approve_key(63),
  pg_temp.approve_id(1404),2,1,array['authorized_officer_confirmation'],
  'completion-failure') fence \gset completion_failure_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_approve(%L::uuid,%L,%L::uuid,2,1,array[%L],%L,%L::uuid)',
  pg_temp.approve_id(1),pg_temp.approve_key(63),pg_temp.approve_id(1404),
  'authorized_officer_confirmation','completion-failure',:'completion_failure_fence'),
  'P5199','integrity_reconciliation_required','idempotency completion failure aborts Phase B');
reset role;
drop trigger approve_completion_failure_test on internal.idempotency_keys;
drop function public.approve_completion_failure_test();
select ok((select status='under_review' and record_version=2
  from public.supplier_ownership_claims where id=pg_temp.approve_id(1404))
  and not exists(select 1 from public.supplier_ownerships where supplier_profile_id=pg_temp.approve_id(220))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.approve_id(1404))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.approve_id(1404))
  and (select status='processing' from internal.idempotency_keys
    where target_aggregate_id=pg_temp.approve_id(1404)
      and command_name='supplier_claim.approve'),
  'completion failure rolls back ownership, Claim, event, audit, and completion');

select * from finish();
revoke mujahiz_claim_runtime from postgres;
commit;
