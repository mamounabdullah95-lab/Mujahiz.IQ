\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, internal, extensions, pg_catalog;
select no_plan();

select has_function('supplier_claim', '_canonicalize_assign_reviewer_request_v1',
  array['text','uuid','integer','uuid'], 'private assign-reviewer canonicalizer exists');
select has_function('supplier_claim', 'reserve_assign_reviewer',
  array['text','uuid','integer','uuid'], 'Phase-A assignment reservation exists');
select has_function('supplier_claim', 'assign_reviewer',
  array['text','uuid','integer','uuid','uuid','uuid'], 'fenced Phase-B assignment executor exists');
select is(pg_catalog.pg_get_function_result(
  'supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)'::regprocedure),
  'TABLE(command text, command_contract_version integer, outcome_code text, claim_id uuid, claim_status text, claim_version integer, supplier_profile_id uuid, assignment_version integer, assigned_at timestamp with time zone, reviewer_assigned boolean, idempotent_replay boolean)',
  'Phase B has the exact safe typed result envelope');
select is((select pg_catalog.string_agg(p.proname, ',' order by p.proname)
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim'
    and (not :'claim_post_b4_replay'::boolean or p.proname in ('_canonicalize_assign_reviewer_request_v1','_canonicalize_submit_request_v1','_canonicalize_withdraw_request_v1','assign_reviewer','reserve_assign_reviewer','reserve_submit','reserve_withdraw','submit','withdraw'))),
  '_canonicalize_assign_reviewer_request_v1,_canonicalize_submit_request_v1,_canonicalize_withdraw_request_v1,assign_reviewer,reserve_assign_reviewer,reserve_submit,reserve_withdraw,submit,withdraw',
  'Claim schema contains only submit, assign_reviewer, and withdraw routines');
select is((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.prosecdef
    and (not :'claim_post_b4_replay'::boolean or p.proname in (
      'assign_reviewer','reserve_assign_reviewer','reserve_submit','reserve_withdraw','submit','withdraw'))), 6::bigint,
  'only the three Phase-A and three Phase-B boundaries are SECURITY DEFINER');
select ok(not (select p.prosecdef from pg_catalog.pg_proc p where p.oid =
  'supplier_claim._canonicalize_assign_reviewer_request_v1(text,uuid,integer,uuid)'::regprocedure),
  'digest canonicalizer is SECURITY INVOKER');
select is((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.proconfig @> array['search_path=pg_catalog']::text[]
    and (not :'claim_post_b4_replay'::boolean or p.proname in ('_canonicalize_assign_reviewer_request_v1','_canonicalize_submit_request_v1','_canonicalize_withdraw_request_v1','assign_reviewer','reserve_assign_reviewer','reserve_submit','reserve_withdraw','submit','withdraw'))),
  9::bigint, 'all Claim routines fix search_path');
select ok(pg_catalog.pg_get_function_identity_arguments(
  'supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)'::regprocedure)
  !~ 'assigner|role|access|security|conflict|policy|source|time|firebase|provider',
  'caller cannot supply assigner, authority result, policy, source, or time');
select ok(has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.reserve_assign_reviewer(text,uuid,integer,uuid)','execute')
  and has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)','execute'),
  'only the trusted Claim runtime path receives command execution');
select ok(not has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim._canonicalize_assign_reviewer_request_v1(text,uuid,integer,uuid)','execute'),
  'runtime cannot call the digest-returning helper');
select ok(not exists (
  select 1 from (values ('public'),('anon'),('authenticated'),('service_role')) r(role_name)
  cross join lateral (values
    ('supplier_claim.reserve_assign_reviewer(text,uuid,integer,uuid)'),
    ('supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)'),
    ('supplier_claim._canonicalize_assign_reviewer_request_v1(text,uuid,integer,uuid)')
  ) f(signature)
  where has_function_privilege(r.role_name,f.signature,'execute')),
  'PUBLIC, anon, authenticated, and service_role cannot execute assignment routines');
select ok(not exists (
  select 1 from (values ('mujahiz_claim_runtime'),('anon'),('authenticated'),('service_role')) r(role_name)
  where has_table_privilege(r.role_name,'public.supplier_ownership_claims','update')),
  'runtime and API roles retain no direct Claim UPDATE');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass), case when :'claim_post_b4_replay'::boolean then 10 else 3 end::bigint,
  'Claim has the expected exact policy count');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass and polcmd <> 'r'), case when :'claim_post_b4_replay'::boolean then 3 else 0 end::bigint,
  'Claim has the expected exact mutation-policy count');
select is((select pg_catalog.string_agg(polname,',' order by polname) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass),
  case when :'claim_post_b4_replay'::boolean then
    'supplier_ownership_claims_assigned_reviewer_select,supplier_ownership_claims_claimant_self_select,supplier_ownership_claims_expiry_command_select,supplier_ownership_claims_expiry_command_update,supplier_ownership_claims_human_command_insert,supplier_ownership_claims_human_command_select,supplier_ownership_claims_human_command_update,supplier_ownership_claims_owner_assignment_select,supplier_ownership_claims_reviewer_prior_context_helper_select,supplier_ownership_claims_target_conflict_helper_select'
  else 'supplier_ownership_claims_assigned_reviewer_select,supplier_ownership_claims_claimant_self_select,supplier_ownership_claims_owner_assignment_select' end,
  'the exact three existing Claim read policies are unchanged');
select is((select pg_catalog.count(*) from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','internal') and c.relkind in ('r','p')), 24::bigint,
  'assignment adds no physical table');
select ok(case when :'claim_post_b4_replay'::boolean then
  (select pg_catalog.count(distinct p.proname)=3 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='supplier_claim' and p.proname in ('approve','reject','expire'))
  else pg_catalog.to_regprocedure('supplier_claim.approve(text,uuid,integer)') is null
    and not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='supplier_claim' and p.proname in ('approve','reject','expire')) end,
  'later command presence matches the exact migration stage');
select ok(not exists (select 1 from pg_catalog.pg_proc p
  where p.oid in (
    'supplier_claim.reserve_assign_reviewer(text,uuid,integer,uuid)'::regprocedure,
    'supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)'::regprocedure)
  and pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) ~
    E'execute[[:space:]]+(format|immediate|[a-z_][a-z0-9_]*[[:space:]]*\\()'),
  'assignment routines contain no dynamic SQL');
select ok(pg_catalog.to_regclass('public.notifications') is null,
  'assignment has no notification table');

create function pg_temp.assign_id(p_number integer)
returns uuid language sql immutable set search_path=pg_catalog
return ('a1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0'))::uuid;

create function pg_temp.assign_key(p_number integer)
returns text language sql immutable set search_path=pg_catalog
return 'claim-a1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0');

create function pg_temp.seed_actor_base(p_number integer, p_context text default 'buyer')
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.assign_id(p_number); v_now timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v_id,'Assign actor '||p_number,p_context,'verified',v_now,v_now,v_now);
  insert into internal.identity_provider_links(id,user_profile_id,provider_code,
    provider_subject,is_primary,link_status,identity_status,verification_status,
    provider_state_observed_at,provider_state_version,linked_at,verified_at,created_at)
  values(v_id,v_id,'firebase','assign-actor-'||p_number,true,'linked','active',
    'verified',v_now,'firebase-provider-state-v1',v_now,v_now,v_now);
  return v_id;
end $$;

create function pg_temp.seed_eligible_actor(p_number integer, p_role text)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid; v_now timestamptz := pg_catalog.statement_timestamp();
begin
  v_id := pg_temp.seed_actor_base(p_number,'buyer');
  insert into public.platform_role_assignments(id,user_profile_id,role_code,
    assignment_status,valid_from,assignment_source_type,assignment_reason_code,
    authorization_policy_version,evidence_reference,assignment_system_source,
    assigned_at,created_at,updated_at)
  values(v_id,v_id,p_role,'active',v_now-interval '2 days','bootstrap_manifest',
    'assign_test','platform-role-policy-v1','assign-role-evidence','assign_test',
    v_now,v_now,v_now);
  insert into public.access_grants(id,user_profile_id,platform_role_assignment_id,
    role_code,access_status,valid_from,valid_until,grant_source_type,
    grant_reason_code,authorization_policy_version,evidence_reference,
    grant_system_source,granted_at,created_at,updated_at)
  values(v_id,v_id,v_id,p_role,'active',v_now-interval '1 day',
    case when p_role='admin' then v_now+interval '30 days' else null end,
    'bootstrap_manifest','assign_test','platform-access-policy-v1',
    'assign-access-evidence','assign_test',v_now,v_now,v_now);
  insert into internal.security_eligibility_assessments(id,user_profile_id,
    assessment_result,condition_type,valid_from,assessment_status,
    assessment_source_type,assessment_reason_code,security_policy_version,
    required_coverage_version,evidence_minimization_version,evidence_reference,
    assessment_system_source,assessed_at,created_at,updated_at)
  values(v_id,v_id,'clear','complete_clear',v_now-interval '1 day','active',
    'bootstrap_manifest','assign_test','platform-admin-security-v1',
    'platform-admin-coverage-v1','platform-admin-minimization-v1',
    'assign-security-evidence','assign_test',v_now,v_now,v_now);
  return v_id;
end $$;

create function pg_temp.seed_claimant(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.assign_id(p_number); v_now timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v_id,'Assign claimant '||p_number,'supplier','verified',v_now,v_now,v_now);
  return v_id;
end $$;

create function pg_temp.seed_supplier(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.assign_id(p_number);
begin
  insert into public.supplier_profiles(id,name_original,display_name,name_language,
    name_en,business_type,listing_status,verification_status,source_type,
    confidence_level,has_direct_experience)
  values(v_id,'Assign Supplier '||p_number,'Assign Supplier '||p_number,'english',
    'Assign Supplier '||p_number,'company','approved','verified','other','low','no');
  return v_id;
end $$;

create function pg_temp.seed_claim(p_number integer,p_claimant integer,p_supplier integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.assign_id(p_number);
  v_submitted timestamptz := pg_catalog.statement_timestamp()-interval '1 hour';
begin
  insert into public.supplier_ownership_claims(id,claimant_user_profile_id,
    supplier_profile_id,status,record_version,submitted_at,expires_at,
    submitted_reason,claimant_snapshot_schema_version,claimant_snapshot,
    submission_fingerprint_version,submission_fingerprint,evidence_schema_version,
    evidence_descriptors,created_at,updated_at)
  values(v_id,pg_temp.assign_id(p_claimant),pg_temp.assign_id(p_supplier),
    'submitted',1,v_submitted,v_submitted+interval '720 hours',
    'Synthetic assignment Claim '||p_number,'claimant_snapshot_v1',
    pg_catalog.jsonb_build_object('full_name','Assign claimant '||p_claimant),
    'claim_submit_v1',pg_catalog.repeat('a',64),'claim_evidence_v1',
    '[{"kind":"company_website","summary":"bounded test evidence"}]'::jsonb,
    v_submitted,v_submitted);
  return v_id;
end $$;

create function pg_temp.run_assign(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_candidate uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_reservation record; v_result jsonb;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into v_reservation from supplier_claim.reserve_assign_reviewer(
    p_key,p_claim,p_expected,p_candidate);
  if v_reservation.reservation_outcome='execute' then
    select pg_catalog.to_jsonb(result_row) into v_result
    from supplier_claim.assign_reviewer(p_key,p_claim,p_expected,p_candidate,
      pg_catalog.gen_random_uuid(),v_reservation.execution_fence) result_row;
    return v_result || pg_catalog.jsonb_build_object('reservation_outcome','execute');
  end if;
  return pg_catalog.to_jsonb(v_reservation);
end $$;

create function pg_temp.reserve_assign(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_candidate uuid)
returns uuid language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_fence uuid;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select execution_fence into v_fence from supplier_claim.reserve_assign_reviewer(
    p_key,p_claim,p_expected,p_candidate);
  return v_fence;
end $$;

create function pg_temp.execute_assign(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_candidate uuid,p_fence uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select pg_catalog.to_jsonb(result_row) into v_result
  from supplier_claim.assign_reviewer(p_key,p_claim,p_expected,p_candidate,
    pg_catalog.gen_random_uuid(),p_fence) result_row;
  return v_result;
end $$;
select pg_temp.seed_eligible_actor(1,'owner');
select pg_temp.seed_eligible_actor(2,'owner');
select pg_temp.seed_eligible_actor(3,'admin');
select pg_temp.seed_eligible_actor(4,'admin');
select pg_temp.seed_eligible_actor(n,'owner') from pg_catalog.generate_series(5,15) n;
select pg_temp.seed_eligible_actor(16,'admin');
select pg_temp.seed_eligible_actor(n,'owner') from pg_catalog.generate_series(17,23) n;
select pg_temp.seed_claimant(n) from pg_catalog.generate_series(101,140) n;
select pg_temp.seed_supplier(n) from pg_catalog.generate_series(201,260) n;

delete from public.access_grants where user_profile_id=pg_temp.assign_id(5);
delete from public.platform_role_assignments where user_profile_id=pg_temp.assign_id(5);
delete from public.access_grants where user_profile_id in (
  pg_temp.assign_id(6),pg_temp.assign_id(18),pg_temp.assign_id(23));
update internal.security_eligibility_assessments
set assessment_result='deny',condition_type='security_hold',
    assessment_source_type='trusted_security_system'
where user_profile_id in (pg_temp.assign_id(7),pg_temp.assign_id(19));
update internal.security_eligibility_assessments
set assessment_result='unknown',condition_type='reconciliation_required',
    assessment_source_type='trusted_security_system'
where user_profile_id in (pg_temp.assign_id(8),pg_temp.assign_id(20));
update public.user_profiles set account_status='suspended',
  suspended_at=pg_catalog.statement_timestamp(),suspension_reason='assign_test',
  updated_at=pg_catalog.statement_timestamp()
where id in (pg_temp.assign_id(9),pg_temp.assign_id(21));
update internal.identity_provider_links set provider_state_version='unsupported-provider-state'
where user_profile_id in (pg_temp.assign_id(10),pg_temp.assign_id(22));
delete from public.access_grants where user_profile_id=pg_temp.assign_id(17);
delete from public.platform_role_assignments where user_profile_id=pg_temp.assign_id(17);
update public.access_grants set valid_until=pg_catalog.statement_timestamp()-interval '1 second'
where user_profile_id=pg_temp.assign_id(16);

select pg_temp.seed_claim(1001,101,201);
select pg_temp.seed_claim(1002,102,202);

grant mujahiz_claim_runtime to postgres with set true;
grant usage on schema extensions to mujahiz_claim_runtime;
set role mujahiz_claim_runtime;
select pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(1),
  pg_temp.assign_id(1001),1,pg_temp.assign_id(2)) as result \gset owner_owner_
select pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(2),
  pg_temp.assign_id(1002),1,pg_temp.assign_id(3)) as result \gset owner_admin_
reset role;

select is((:'owner_owner_result'::jsonb)->>'outcome_code','under_review',
  'eligible Owner assigns a distinct eligible Owner');
select is((:'owner_admin_result'::jsonb)->>'outcome_code','under_review',
  'eligible Owner assigns a distinct eligible Admin');
select is((:'owner_owner_result'::jsonb)->>'claim_version','2',
  'assignment increments Claim version exactly once');
select ok(not ((:'owner_owner_result'::jsonb)->>'idempotent_replay')::boolean,
  'first assignment is not a replay');
select ok((select status='under_review' and record_version=2
  and reviewer_user_profile_id=pg_temp.assign_id(2)
  and reviewer_assignment_version=1 and reviewer_assigned_at is not null
  and reviewer_assigned_by_user_profile_id=pg_temp.assign_id(1)
  and reviewer_assignment_source_code='owner_assignment'
  and reviewer_assignment_policy_version='claim_reviewer_assignment_v1'
  and updated_at=reviewer_assigned_at
  from public.supplier_ownership_claims where id=pg_temp.assign_id(1001)),
  'all six write-once assignment fields and lifecycle fields are exact');
select ok((select claimant_user_profile_id=pg_temp.assign_id(101)
  and supplier_profile_id=pg_temp.assign_id(201)
  and submitted_reason='Synthetic assignment Claim 1001'
  and claimant_snapshot=pg_catalog.jsonb_build_object('full_name','Assign claimant 101')
  and submission_fingerprint=pg_catalog.repeat('a',64)
  and evidence_descriptors='[{"kind":"company_website","summary":"bounded test evidence"}]'::jsonb
  and submitted_at=created_at and expires_at=submitted_at+interval '720 hours'
  from public.supplier_ownership_claims where id=pg_temp.assign_id(1001)),
  'assignment preserves claimant, Supplier, submission, fingerprint, and evidence');
select is((select pg_catalog.count(*) from public.supplier_ownerships),0::bigint,
  'assignment creates no ownership');
select is((select pg_catalog.count(*) from internal.domain_events
  where aggregate_id in (pg_temp.assign_id(1001),pg_temp.assign_id(1002))
    and event_type='supplier_ownership.claim_under_review'),2::bigint,
  'each successful assignment emits exactly one under-review event');
select ok((select event_schema_version=1 and aggregate_sequence=2
  and producer_command_name='supplier_claim.assign_reviewer'
  and payload=pg_catalog.jsonb_build_object(
    'claim_id',pg_temp.assign_id(1001),'supplier_profile_id',pg_temp.assign_id(201),
    'claimant_user_profile_id',pg_temp.assign_id(101),'claim_version',2)
  and not (payload ? 'reviewer_user_profile_id')
  from internal.domain_events where aggregate_id=pg_temp.assign_id(1001)),
  'event has exact v1 payload and no reviewer identity');
select is((select pg_catalog.count(*) from internal.audit_logs
  where action_code='supplier_claim.assign_reviewer' and outcome_class='succeeded'
    and target_id in (pg_temp.assign_id(1001),pg_temp.assign_id(1002))),2::bigint,
  'each success persists exactly one accountable audit');
select ok((select action_contract_version=1 and action_class='claim_ownership'
  and actor_user_profile_id=pg_temp.assign_id(1)
  and related_target_id=pg_temp.assign_id(2)
  and prior_state_code='submitted' and result_state_code='under_review'
  and prior_record_version=1 and result_record_version=2
  and retention_class='privilege_security_authority'
  and safe_context ? 'assignment_policy_version'
  and row_to_json(audit_row)::text !~ 'assign-actor|provider_subject|bounded test evidence'
  from internal.audit_logs audit_row
  where target_id=pg_temp.assign_id(1001) and outcome_class='succeeded'),
  'success audit is exact, minimized, and excludes provider/evidence detail');
select ok((select status='completed' and outcome_code='under_review'
  and result_resource_id=pg_temp.assign_id(1001) and result_version_token='2'
  and lease_token_digest is null and completed_at is not null
  from internal.idempotency_keys where target_aggregate_id=pg_temp.assign_id(1001)),
  'idempotency completion is atomic and bound to Claim version 2');
set role mujahiz_claim_runtime;
select pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(1),
  pg_temp.assign_id(1001),1,pg_temp.assign_id(2)) as result \gset replay_
reset role;
select is((:'replay_result'::jsonb)->>'reservation_outcome','replay',
  'same key and fingerprint safely replays');
select ok((( :'replay_result'::jsonb)->>'idempotent_replay')::boolean
  and (:'replay_result'::jsonb)->>'assigned_at'=(:'owner_owner_result'::jsonb)->>'assigned_at',
  'replay returns the original immutable assignment timestamp');
select is((select pg_catalog.count(*) from internal.domain_events
  where aggregate_id=pg_temp.assign_id(1001)),1::bigint,
  'replay creates no duplicate event');
select is((select pg_catalog.count(*) from internal.audit_logs
  where target_id=pg_temp.assign_id(1001) and outcome_class='succeeded'),1::bigint,
  'replay creates no duplicate success audit');

set role mujahiz_claim_runtime;
select pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(1),
  pg_temp.assign_id(1001),1,pg_temp.assign_id(3)) as result \gset candidate_conflict_
reset role;
select is((:'candidate_conflict_result'::jsonb)->>'reservation_outcome',
  'idempotency_key_conflict','same key with different candidate conflicts');
select ok((:'candidate_conflict_result'::jsonb)->>'reviewer_user_profile_id' is null,
  'different candidate never receives a wrong replay envelope');
select ok(not exists(select 1 from internal.idempotency_keys
  where row_to_json(idempotency_keys)::text like '%'||pg_temp.assign_key(1)||'%'),
  'raw idempotency key is never stored');

set role mujahiz_claim_runtime;
select pg_temp.reserve_assign(pg_temp.assign_id(1),pg_temp.assign_key(3),
  pg_temp.assign_id(1001),2,pg_temp.assign_id(3)) as fence \gset swap_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_assign(%L::uuid,%L,%L::uuid,2,%L::uuid,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(3),pg_temp.assign_id(1001),
  pg_temp.assign_id(2),:'swap_fence'), 'P5108','idempotency_key_conflict',
  'candidate swap after reservation is fenced as a fingerprint conflict');
reset role;

select pg_temp.seed_claim(1003,103,203);
set role mujahiz_claim_runtime;
select pg_temp.reserve_assign(pg_temp.assign_id(1),pg_temp.assign_key(4),
  pg_temp.assign_id(1003),1,pg_temp.assign_id(2)) as fence \gset progress_
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.reserve_assign_reviewer(%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_key(4),pg_temp.assign_id(1003),pg_temp.assign_id(2)),
  'P5109','command_in_progress','live reservation reports in-progress');
reset role;
update internal.idempotency_keys set lease_expires_at=created_at+interval '1 millisecond'
where target_aggregate_id=pg_temp.assign_id(1003);
set role mujahiz_claim_runtime;
select pg_temp.reserve_assign(pg_temp.assign_id(1),pg_temp.assign_key(4),
  pg_temp.assign_id(1003),1,pg_temp.assign_id(2)) as fence \gset reclaim_
select ok(:'progress_fence'::uuid <> :'reclaim_fence'::uuid,
  'expired reservation reclaim rotates the opaque fence');
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_assign(%L::uuid,%L,%L::uuid,1,%L::uuid,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(4),pg_temp.assign_id(1003),
  pg_temp.assign_id(2),:'progress_fence'), 'P5109','command_in_progress',
  'stale Phase-B fence cannot commit after reclaim');
select pg_temp.execute_assign(pg_temp.assign_id(1),pg_temp.assign_key(4),
  pg_temp.assign_id(1003),1,pg_temp.assign_id(2),:'reclaim_fence'::uuid) as result \gset reclaim_result_
reset role;
select is((:'reclaim_result_result'::jsonb)->>'outcome_code','under_review',
  'current reclaimed fence completes exactly once');

select pg_temp.seed_claim(1004,104,204);
create function public.assign_reviewer_reject_event_test()
returns trigger language plpgsql as $$ begin
  if new.producer_command_name='supplier_claim.assign_reviewer' then
    raise exception 'synthetic assignment event failure';
  end if; return new; end $$;
create trigger assign_reviewer_event_failure_test before insert on internal.domain_events
for each row execute function public.assign_reviewer_reject_event_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_assign(pg_temp.assign_id(1),pg_temp.assign_key(5),
  pg_temp.assign_id(1004),1,pg_temp.assign_id(2)) as fence \gset event_fail_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_assign(%L::uuid,%L,%L::uuid,1,%L::uuid,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(5),pg_temp.assign_id(1004),
  pg_temp.assign_id(2),:'event_fail_fence'), 'P5199','integrity_reconciliation_required',
  'event failure rolls back the domain mutation');
reset role;
drop trigger assign_reviewer_event_failure_test on internal.domain_events;
drop function public.assign_reviewer_reject_event_test();
select ok((select status='submitted' and record_version=1 and reviewer_user_profile_id is null
  from public.supplier_ownership_claims where id=pg_temp.assign_id(1004))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.assign_id(1004))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.assign_id(1004)),
  'event failure leaves no Claim, event, or audit partial effect');
select is((select status from internal.idempotency_keys
  where target_aggregate_id=pg_temp.assign_id(1004)),'processing',
  'event rollback preserves the prior Phase-A reservation');

select pg_temp.seed_claim(1005,105,205);
create function public.assign_reviewer_reject_audit_test()
returns trigger language plpgsql as $$ begin
  if new.action_code='supplier_claim.assign_reviewer' then
    raise exception 'synthetic assignment audit failure';
  end if; return new; end $$;
create trigger assign_reviewer_audit_failure_test before insert on internal.audit_logs
for each row execute function public.assign_reviewer_reject_audit_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_assign(pg_temp.assign_id(1),pg_temp.assign_key(6),
  pg_temp.assign_id(1005),1,pg_temp.assign_id(2)) as fence \gset audit_fail_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_assign(%L::uuid,%L,%L::uuid,1,%L::uuid,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(6),pg_temp.assign_id(1005),
  pg_temp.assign_id(2),:'audit_fail_fence'), 'P5116','audit_unavailable',
  'required audit failure rolls back assignment');
reset role;
drop trigger assign_reviewer_audit_failure_test on internal.audit_logs;
drop function public.assign_reviewer_reject_audit_test();
select ok((select status='submitted' and record_version=1 and reviewer_user_profile_id is null
  from public.supplier_ownership_claims where id=pg_temp.assign_id(1005))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.assign_id(1005))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.assign_id(1005)),
  'audit failure rolls back Claim and event with no audit residue');
select pg_temp.seed_claim(n,106+(n-1006),206+(n-1006))
from pg_catalog.generate_series(1006,1015) n;
set role mujahiz_claim_runtime;
select is(pg_temp.run_assign(pg_temp.assign_id(4),pg_temp.assign_key(10),
  pg_temp.assign_id(1006),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','Admin cannot assign');
select is(pg_temp.run_assign(pg_temp.assign_id(5),pg_temp.assign_key(11),
  pg_temp.assign_id(1007),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','assigner missing role is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(6),pg_temp.assign_key(12),
  pg_temp.assign_id(1008),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','role-only assigner missing access is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(7),pg_temp.assign_key(13),
  pg_temp.assign_id(1009),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','assigner security deny is non-authorizing');
select is(pg_temp.run_assign(pg_temp.assign_id(8),pg_temp.assign_key(14),
  pg_temp.assign_id(1010),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','assigner security unknown fails closed');
select is(pg_temp.run_assign(pg_temp.assign_id(9),pg_temp.assign_key(15),
  pg_temp.assign_id(1011),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','inactive assigner is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(10),pg_temp.assign_key(16),
  pg_temp.assign_id(1012),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','unsupported assigner provider state fails closed');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(17),
  pg_temp.assign_id(1013),1,pg_temp.assign_id(999999))->>'outcome_code',
  'reviewer_conflict','nonexistent candidate fails closed');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(18),
  pg_temp.assign_id(1014),1,pg_temp.assign_id(114))->>'outcome_code',
  'reviewer_conflict','claimant candidate is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(19),
  pg_temp.assign_id(1015),1,pg_temp.assign_id(1))->>'outcome_code',
  'reviewer_conflict','self-assignment is denied');
reset role;

select pg_temp.seed_claim(n,116+(n-1016),216+(n-1016))
from pg_catalog.generate_series(1016,1022) n;
set role mujahiz_claim_runtime;
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(20),
  pg_temp.assign_id(1016),1,pg_temp.assign_id(17))->>'outcome_code',
  'reviewer_conflict','candidate missing role is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(21),
  pg_temp.assign_id(1017),1,pg_temp.assign_id(18))->>'outcome_code',
  'reviewer_conflict','candidate missing access is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(22),
  pg_temp.assign_id(1018),1,pg_temp.assign_id(16))->>'outcome_code',
  'reviewer_conflict','candidate expired access is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(23),
  pg_temp.assign_id(1019),1,pg_temp.assign_id(19))->>'outcome_code',
  'reviewer_conflict','candidate security deny is non-authorizing');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(24),
  pg_temp.assign_id(1020),1,pg_temp.assign_id(20))->>'outcome_code',
  'reviewer_conflict','candidate security unknown fails closed');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(25),
  pg_temp.assign_id(1021),1,pg_temp.assign_id(21))->>'outcome_code',
  'reviewer_conflict','inactive candidate is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(26),
  pg_temp.assign_id(1022),1,pg_temp.assign_id(22))->>'outcome_code',
  'reviewer_conflict','unsupported candidate provider state fails closed');
reset role;

set role mujahiz_claim_runtime;
select pg_temp.run_assign(pg_temp.assign_id(8),pg_temp.assign_key(14),
  pg_temp.assign_id(1010),1,pg_temp.assign_id(2)) as result \gset denial_replay_
reset role;
select is((:'denial_replay_result'::jsonb)->>'reservation_outcome','replay',
  'accountable terminal denial safely replays');
select ok((( :'denial_replay_result'::jsonb)->>'idempotent_replay')::boolean
  and (select pg_catalog.count(*) from internal.audit_logs
    where target_id=pg_temp.assign_id(1010) and result_code='actor_not_authorized')=1,
  'denial replay creates no duplicate audit');

select pg_temp.seed_claim(1023,123,223);
insert into public.supplier_ownership_claims(
  id,claimant_user_profile_id,supplier_profile_id,status,record_version,
  submitted_at,expires_at,submitted_reason,claimant_snapshot_schema_version,
  claimant_snapshot,submission_fingerprint_version,submission_fingerprint,
  evidence_schema_version,evidence_descriptors,created_at,updated_at)
select pg_temp.assign_id(1123),pg_temp.assign_id(11),pg_temp.assign_id(223),'submitted',1,
  t,t+interval '720 hours','assigner competing Claim','claimant_snapshot_v1','{}',
  'claim_submit_v1',pg_catalog.repeat('b',64),'claim_evidence_v1','[]',t,t
from (select pg_catalog.statement_timestamp()-interval '2 hours' t) s;
select pg_temp.seed_claim(1024,124,224);
insert into public.supplier_ownership_claims(
  id,claimant_user_profile_id,supplier_profile_id,status,record_version,
  submitted_at,expires_at,submitted_reason,claimant_snapshot_schema_version,
  claimant_snapshot,submission_fingerprint_version,submission_fingerprint,
  evidence_schema_version,evidence_descriptors,created_at,updated_at)
select pg_temp.assign_id(1124),pg_temp.assign_id(13),pg_temp.assign_id(224),'submitted',1,
  t,t+interval '720 hours','candidate competing Claim','claimant_snapshot_v1','{}',
  'claim_submit_v1',pg_catalog.repeat('c',64),'claim_evidence_v1','[]',t,t
from (select pg_catalog.statement_timestamp()-interval '2 hours' t) s;
set role mujahiz_claim_runtime;
select is(pg_temp.run_assign(pg_temp.assign_id(11),pg_temp.assign_key(27),
  pg_temp.assign_id(1023),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','assigner target-Supplier conflict is denied');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(28),
  pg_temp.assign_id(1024),1,pg_temp.assign_id(13))->>'outcome_code',
  'reviewer_conflict','candidate competing-Claim conflict is denied');
reset role;
select is((select status from public.supplier_ownership_claims where id=pg_temp.assign_id(1124)),
  'submitted','candidate conflict does not mutate the competitor Claim');

select throws_ok($sql$
  insert into public.access_grants(
    id,user_profile_id,platform_role_assignment_id,role_code,access_status,
    valid_from,grant_source_type,grant_reason_code,authorization_policy_version,
    evidence_reference,grant_system_source)
  values(pg_temp.assign_id(900001),pg_temp.assign_id(101),pg_temp.assign_id(900002),
    'owner','active',pg_catalog.statement_timestamp()-interval '1 day',
    'bootstrap_manifest','access_only','platform-access-policy-v1','access-only',
    'assign_test')
$sql$,null,'access-only authority cannot exist without an exact role binding');
select pg_temp.seed_claim(1030,130,230);
update public.supplier_ownership_claims set status='under_review',record_version=2,
  reviewer_user_profile_id=pg_temp.assign_id(2),reviewer_assignment_version=1,
  reviewer_assigned_at=submitted_at+interval '1 minute',
  reviewer_assigned_by_user_profile_id=pg_temp.assign_id(1),
  reviewer_assignment_source_code='owner_assignment',
  reviewer_assignment_policy_version='claim_reviewer_assignment_v1',
  updated_at=submitted_at+interval '1 minute' where id=pg_temp.assign_id(1030);
select pg_temp.seed_claim(1031,131,231);
update public.supplier_ownership_claims set status='withdrawn',record_version=2,
  withdrawn_at=submitted_at+interval '1 minute',
  withdrawn_by_user_profile_id=claimant_user_profile_id,
  withdrawal_reason_code='claimant_withdrawal',updated_at=submitted_at+interval '1 minute'
where id=pg_temp.assign_id(1031);
select pg_temp.seed_claim(1032,132,232);
update public.supplier_ownership_claims set status='rejected',record_version=3,
  reviewer_user_profile_id=pg_temp.assign_id(2),reviewer_assignment_version=1,
  reviewer_assigned_at=submitted_at+interval '1 minute',
  reviewer_assigned_by_user_profile_id=pg_temp.assign_id(1),
  reviewer_assignment_source_code='owner_assignment',
  reviewer_assignment_policy_version='claim_reviewer_assignment_v1',
  decided_by_user_profile_id=pg_temp.assign_id(2),decided_at=submitted_at+interval '2 minutes',
  decision_reason_code='insufficient_evidence',
  evidence_verification_method_code='manual_review',
  evidence_verification_version='claim_evidence_review_v1',
  evidence_verification_outcome_code='not_verified',
  decision_authorization_policy_version='claim_decision_v1',
  updated_at=submitted_at+interval '2 minutes' where id=pg_temp.assign_id(1032);
select pg_temp.seed_claim(1033,133,233);
update public.supplier_ownership_claims set status='expired',record_version=2,
  expired_at=submitted_at+interval '1 minute',
  expiry_system_source_code='claim_expiry_worker',expiry_policy_version='claim_expiry_v1',
  updated_at=submitted_at+interval '1 minute' where id=pg_temp.assign_id(1033);
select pg_temp.seed_claim(1034,134,234);
update public.supplier_ownership_claims set status='superseded',record_version=2,
  superseded_at=submitted_at+interval '1 minute',
  supersession_reason_code='newer_claim',superseded_by_claim_id=pg_temp.assign_id(1032),
  updated_at=submitted_at+interval '1 minute' where id=pg_temp.assign_id(1034);
select pg_temp.seed_claim(1035,135,235);
update public.supplier_ownership_claims set
  submitted_at=pg_catalog.statement_timestamp()-interval '720 hours',
  expires_at=pg_catalog.statement_timestamp(),
  created_at=pg_catalog.statement_timestamp()-interval '720 hours',
  updated_at=pg_catalog.statement_timestamp()-interval '720 hours'
where id=pg_temp.assign_id(1035);
select pg_temp.seed_claim(1036,136,236);

set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,2,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(30),pg_temp.assign_id(1030),pg_temp.assign_id(3)),
  'P5115','reviewer_already_assigned','under_review Claim cannot be reassigned');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,2,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(31),pg_temp.assign_id(1031),pg_temp.assign_id(2)),
  'P5113','claim_not_actionable','withdrawn Claim cannot reopen');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,3,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(32),pg_temp.assign_id(1032),pg_temp.assign_id(3)),
  'P5115','reviewer_already_assigned','rejected Claim cannot reopen');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,2,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(33),pg_temp.assign_id(1033),pg_temp.assign_id(2)),
  'P5113','claim_not_actionable','expired Claim cannot reopen');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,2,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(34),pg_temp.assign_id(1034),pg_temp.assign_id(2)),
  'P5113','claim_not_actionable','superseded Claim cannot reopen');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(35),pg_temp.assign_id(1035),pg_temp.assign_id(2)),
  'P5114','claim_expired','Claim due at trusted time cannot be assigned or silently expired');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,2,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(36),pg_temp.assign_id(1036),pg_temp.assign_id(2)),
  'P5112','claim_version_conflict','stale expected Claim version is rejected');
reset role;
select ok((select status='submitted' and record_version=1 and expired_at is null
  from public.supplier_ownership_claims where id=pg_temp.assign_id(1035)),
  'due Claim remains unchanged for the future expire command');

select pg_temp.seed_claim(1037,137,237);
savepoint malformed_assignment;
alter table public.supplier_ownership_claims
  drop constraint supplier_ownership_claims_reviewer_assignment_shape_ck,
  drop constraint supplier_ownership_claims_lifecycle_shape_ck;
update public.supplier_ownership_claims set reviewer_user_profile_id=pg_temp.assign_id(2)
where id=pg_temp.assign_id(1037);
set role mujahiz_claim_runtime;
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(37),
  pg_temp.assign_id(1037),1,pg_temp.assign_id(2))->>'outcome_code',
  'integrity_reconciliation_required','partial assignment is not repaired');
reset role;
rollback to savepoint malformed_assignment;

select pg_temp.seed_claim(1038,138,238);
select pg_temp.seed_claim(1039,139,239);
savepoint ambiguous_role;
alter table public.platform_role_assignments
  drop constraint platform_role_assignments_user_interval_excl;
insert into public.platform_role_assignments(
  id,user_profile_id,role_code,assignment_status,valid_from,assignment_source_type,
  assignment_reason_code,authorization_policy_version,evidence_reference,
  assignment_system_source,assigned_at,created_at,updated_at)
values(pg_temp.assign_id(50015),pg_temp.assign_id(15),'admin','active',
  pg_catalog.statement_timestamp()-interval '1 day','bootstrap_manifest',
  'ambiguous_test','platform-role-policy-v1','ambiguous-role','assign_test',
  pg_catalog.statement_timestamp(),pg_catalog.statement_timestamp(),pg_catalog.statement_timestamp());
set role mujahiz_claim_runtime;
select is(pg_temp.run_assign(pg_temp.assign_id(15),pg_temp.assign_key(38),
  pg_temp.assign_id(1038),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','ambiguous assigner role fails closed');
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(39),
  pg_temp.assign_id(1039),1,pg_temp.assign_id(15))->>'outcome_code',
  'reviewer_conflict','ambiguous candidate role fails closed');
reset role;
rollback to savepoint ambiguous_role;

select pg_temp.seed_claim(1040,140,240);
savepoint future_relationship;
create table public.supplier_memberships(id uuid primary key);
set role mujahiz_claim_runtime;
select is(pg_temp.run_assign(pg_temp.assign_id(1),pg_temp.assign_key(40),
  pg_temp.assign_id(1040),1,pg_temp.assign_id(2))->>'outcome_code',
  'actor_not_authorized','future relationship coverage makes conflict unknown and non-authorizing');
reset role;
rollback to savepoint future_relationship;

savepoint corrupted_success_audit_action;
update internal.audit_logs set action_code='supplier_claim.withdraw'
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'corrupted success-audit action fails closed without exposing the mismatch');
reset role;
rollback to savepoint corrupted_success_audit_action;

savepoint corrupted_success_audit_version;
update internal.audit_logs set action_contract_version=2
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'corrupted success-audit contract version fails closed');
reset role;
rollback to savepoint corrupted_success_audit_version;

savepoint corrupted_success_audit_classification;
update internal.audit_logs set outcome_class='failed'
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'corrupted success-audit outcome classification fails closed');
reset role;
rollback to savepoint corrupted_success_audit_classification;

savepoint corrupted_success_audit_result;
update internal.audit_logs set result_code='withdrawn'
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'corrupted success-audit result binding fails closed');
reset role;
rollback to savepoint corrupted_success_audit_result;

savepoint incomplete_success_audit_context;
update internal.audit_logs set safe_context=safe_context-'security_policy_version'
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'incomplete success-audit safe context fails closed');
reset role;
rollback to savepoint incomplete_success_audit_context;

savepoint incomplete_success_audit_changes;
update internal.audit_logs set changed_field_codes=array['status','record_version']::text[]
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'incomplete success-audit changed-field envelope fails closed');
reset role;
rollback to savepoint incomplete_success_audit_changes;

savepoint corrupted_success_audit_provenance;
update internal.audit_logs set action_evidence_schema_version='claim_assign_reviewer_denial_v1'
where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'wrong success-audit evidence schema fails closed');
reset role;
rollback to savepoint corrupted_success_audit_provenance;

savepoint corrupted_denial_audit_outcome;
update internal.audit_logs set outcome_class='conflicted'
where target_id=pg_temp.assign_id(1010) and result_code='actor_not_authorized';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(8),pg_temp.assign_key(14),pg_temp.assign_id(1010),pg_temp.assign_id(2)),
  'P5199','integrity_reconciliation_required',
  'terminal denial with the wrong outcome class fails closed without leaking authorization detail');
reset role;
rollback to savepoint corrupted_denial_audit_outcome;

select ok((select status='under_review' and record_version=2
    from public.supplier_ownership_claims where id=pg_temp.assign_id(1002))
  and (select pg_catalog.count(*) from internal.domain_events
    where aggregate_id=pg_temp.assign_id(1002))=1
  and (select pg_catalog.count(*) from internal.audit_logs
    where target_id=pg_temp.assign_id(1002) and outcome_class='succeeded')=1
  and (select status='submitted' and record_version=1 and reviewer_user_profile_id is null
    from public.supplier_ownership_claims where id=pg_temp.assign_id(1010))
  and (select pg_catalog.count(*) from internal.audit_logs
    where target_id=pg_temp.assign_id(1010) and result_code='actor_not_authorized')=1,
  'corruption probes create no duplicate mutation, event, or audit');

savepoint corrupted_completed_binding;
update internal.domain_events
set payload=payload||pg_catalog.jsonb_build_object('reviewer_user_profile_id',pg_temp.assign_id(2))
where aggregate_id=pg_temp.assign_id(1002);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_assign(%L::uuid,%L,%L::uuid,1,%L::uuid)',
  pg_temp.assign_id(1),pg_temp.assign_key(2),pg_temp.assign_id(1002),pg_temp.assign_id(3)),
  'P5199','integrity_reconciliation_required',
  'corrupted completed event binding fails closed instead of replaying');
reset role;
rollback to savepoint corrupted_completed_binding;

set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.assign_id(101));
select pg_catalog.count(*)::text as count from public.supplier_ownership_claims_claimant_v1
where id=pg_temp.assign_id(1001) \gset claimant_read_
select claim_security.establish_claim_runtime_context(pg_temp.assign_id(1));
select pg_catalog.count(*)::text as count from claim_api.owner_assignment_queue_v1(null,null,100)
where claim_id=pg_temp.assign_id(1001) \gset owner_read_
select claim_security.establish_claim_runtime_context(pg_temp.assign_id(2));
select pg_catalog.count(*)::text as count from claim_api.reviewer_queue_v1(null,null,100)
where claim_id=pg_temp.assign_id(1001) \gset reviewer_queue_
select pg_catalog.count(*)::text as count from claim_api.reviewer_detail_v1(pg_temp.assign_id(1001))
\gset reviewer_detail_
reset role;
select is(:'claimant_read_count'::bigint,1::bigint,'claimant minimized self-read remains available');
select is(:'owner_read_count'::bigint,0::bigint,'assigned Claim leaves the Owner assignment queue');
select is(:'reviewer_queue_count'::bigint,1::bigint,'assigned reviewer sees the Claim queue row');
select is(:'reviewer_detail_count'::bigint,1::bigint,'assigned reviewer sees the bounded detail');
select ok(not exists(select 1 from internal.domain_events
  where event_type='supplier_ownership.claim_under_review'
    and payload ? 'reviewer_user_profile_id'),
  'no valid assignment event leaks reviewer identity');

select * from finish();
rollback;
