\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, internal, extensions, pg_catalog;
select no_plan();

select has_function('supplier_claim', '_canonicalize_reject_request_v1',
  array['text','uuid','integer','integer','text','text','text','text','text'],
  'private reject canonicalizer exists');
select has_function('supplier_claim', 'reject',
  array['text','uuid','integer','integer','text','text','text','text','text','uuid'],
  'reject has the exact approved business signature');
select has_function('supplier_claim', '_execute_reject',
  array['text','uuid','integer','integer','text','text','text','text','text','uuid','uuid'],
  'private-named fenced reject executor exists');
select is(pg_catalog.pg_get_function_result(
  'supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)'::regprocedure),
  'TABLE(reservation_outcome text, execution_fence uuid, command text, command_contract_version integer, outcome_code text, claim_id uuid, claim_status text, claim_version integer, supplier_profile_id uuid, decided_at timestamp with time zone, idempotent_replay boolean)',
  'business boundary returns only the safe reservation/replay envelope');
select ok(pg_catalog.pg_get_function_identity_arguments(
  'supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)'::regprocedure)
  !~ 'actor|claimant|supplier|role|status|time|digest|note|fence|event|audit',
  'business caller cannot select actor, Supplier, time, digest, notes, or fence');
select ok(not (select p.prosecdef from pg_catalog.pg_proc p where p.oid =
  'supplier_claim._canonicalize_reject_request_v1(text,uuid,integer,integer,text,text,text,text,text)'::regprocedure),
  'reject canonicalizer is SECURITY INVOKER');
select is((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.prosecdef), 8::bigint,
  'four Phase-A and four Phase-B boundaries are SECURITY DEFINER');
select is((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.proconfig @> array['search_path=pg_catalog']::text[]),
  12::bigint, 'all Claim routines fix search_path');
select ok(has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)','execute')
  and has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim._execute_reject(text,uuid,integer,integer,text,text,text,text,text,uuid,uuid)','execute'),
  'trusted Claim runtime alone receives reject execution');
select ok(not has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim._canonicalize_reject_request_v1(text,uuid,integer,integer,text,text,text,text,text)','execute'),
  'runtime cannot call digest-returning canonicalizer');
select ok(not exists (
  select 1 from (values ('public'),('anon'),('authenticated'),('service_role')) r(role_name)
  cross join lateral (values
    ('supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)'),
    ('supplier_claim._execute_reject(text,uuid,integer,integer,text,text,text,text,text,uuid,uuid)'),
    ('supplier_claim._canonicalize_reject_request_v1(text,uuid,integer,integer,text,text,text,text,text)')
  ) f(signature)
  where has_function_privilege(r.role_name,f.signature,'execute')),
  'PUBLIC, anon, authenticated, and service_role cannot execute reject routines');
select ok(not exists (
  select 1 from (values ('mujahiz_claim_runtime'),('anon'),('authenticated'),('service_role')) r(role_name)
  where has_table_privilege(r.role_name,'public.supplier_ownership_claims','update')),
  'runtime and API roles retain no direct Claim UPDATE');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass), 3::bigint,
  'Claim retains exactly three SELECT policies');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy
  where polrelid='public.supplier_ownership_claims'::regclass and polcmd <> 'r'), 0::bigint,
  'Claim retains zero mutation policies');
select is((select pg_catalog.count(*) from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','internal') and c.relkind in ('r','p')), 24::bigint,
  'reject adds no physical table');
select ok(not exists (select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.proname in ('approve','expire')),
  'approve and expire remain absent');
select ok(not exists (select 1 from pg_catalog.pg_proc p
  where p.oid in (
    'supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)'::regprocedure,
    'supplier_claim._execute_reject(text,uuid,integer,integer,text,text,text,text,text,uuid,uuid)'::regprocedure)
  and pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) ~
    E'execute[[:space:]]+(format|immediate|[a-z_][a-z0-9_]*[[:space:]]*\\()'),
  'reject routines contain no dynamic SQL');
select ok(pg_catalog.to_regclass('public.notifications') is null,
  'reject has no notification table');

create function pg_temp.reject_id(p_number integer)
returns uuid language sql immutable set search_path=pg_catalog
return ('b1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0'))::uuid;

create function pg_temp.reject_key(p_number integer)
returns text language sql immutable set search_path=pg_catalog
return 'claim-b1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0');

create function pg_temp.seed_actor_base(p_number integer, p_context text default 'buyer')
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.reject_id(p_number); v_now timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v_id,'Reject actor '||p_number,p_context,'verified',v_now,v_now,v_now);
  insert into internal.identity_provider_links(id,user_profile_id,provider_code,
    provider_subject,is_primary,link_status,identity_status,verification_status,
    provider_state_observed_at,provider_state_version,linked_at,verified_at,created_at)
  values(v_id,v_id,'firebase','reject-actor-'||p_number,true,'linked','active',
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
    'reject_test','platform-role-policy-v1','reject-role-evidence','reject_test',
    v_now,v_now,v_now);
  insert into public.access_grants(id,user_profile_id,platform_role_assignment_id,
    role_code,access_status,valid_from,valid_until,grant_source_type,
    grant_reason_code,authorization_policy_version,evidence_reference,
    grant_system_source,granted_at,created_at,updated_at)
  values(v_id,v_id,v_id,p_role,'active',v_now-interval '1 day',
    case when p_role='admin' then v_now+interval '30 days' else null end,
    'bootstrap_manifest','reject_test','platform-access-policy-v1',
    'reject-access-evidence','reject_test',v_now,v_now,v_now);
  insert into internal.security_eligibility_assessments(id,user_profile_id,
    assessment_result,condition_type,valid_from,assessment_status,
    assessment_source_type,assessment_reason_code,security_policy_version,
    required_coverage_version,evidence_minimization_version,evidence_reference,
    assessment_system_source,assessed_at,created_at,updated_at)
  values(v_id,v_id,'clear','complete_clear',v_now-interval '1 day','active',
    'bootstrap_manifest','reject_test','platform-admin-security-v1',
    'platform-admin-coverage-v1','platform-admin-minimization-v1',
    'reject-security-evidence','reject_test',v_now,v_now,v_now);
  return v_id;
end $$;

create function pg_temp.seed_claimant(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.reject_id(p_number); v_now timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(id,full_name,account_context,
    verification_mirror_status,verification_mirror_observed_at,created_at,updated_at)
  values(v_id,'Reject claimant '||p_number,'supplier','verified',v_now,v_now,v_now);
  return v_id;
end $$;

create function pg_temp.seed_supplier(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.reject_id(p_number);
begin
  insert into public.supplier_profiles(id,name_original,display_name,name_language,
    name_en,business_type,listing_status,verification_status,source_type,
    confidence_level,has_direct_experience)
  values(v_id,'Reject Supplier '||p_number,'Reject Supplier '||p_number,'english',
    'Reject Supplier '||p_number,'company','approved','verified','other','low','no');
  return v_id;
end $$;

create function pg_temp.seed_under_review_claim(
  p_number integer,p_claimant integer,p_supplier integer,p_reviewer integer,p_assigner integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare v_id uuid := pg_temp.reject_id(p_number);
  v_submitted timestamptz := pg_catalog.statement_timestamp()-interval '1 hour';
  v_assigned timestamptz := v_submitted+interval '1 minute';
begin
  insert into public.supplier_ownership_claims(id,claimant_user_profile_id,
    supplier_profile_id,status,record_version,submitted_at,expires_at,
    submitted_reason,claimant_snapshot_schema_version,claimant_snapshot,
    submission_fingerprint_version,submission_fingerprint,evidence_schema_version,
    evidence_descriptors,reviewer_user_profile_id,reviewer_assignment_version,
    reviewer_assigned_at,reviewer_assigned_by_user_profile_id,
    reviewer_assignment_source_code,reviewer_assignment_policy_version,
    created_at,updated_at)
  values(v_id,pg_temp.reject_id(p_claimant),pg_temp.reject_id(p_supplier),
    'under_review',2,v_submitted,v_submitted+interval '720 hours',
    'Synthetic rejection Claim '||p_number,'claimant_snapshot_v1',
    pg_catalog.jsonb_build_object('full_name','Reject claimant '||p_claimant),
    'claim_submit_v1',pg_catalog.repeat('b',64),'claim_evidence_v1',
    '[{"kind":"company_website","summary":"bounded test evidence"}]'::jsonb,
    pg_temp.reject_id(p_reviewer),1,v_assigned,pg_temp.reject_id(p_assigner),
    'owner_assignment','claim_reviewer_assignment_v1',v_submitted,v_assigned);
  return v_id;
end $$;

create function pg_temp.run_reject(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_assignment integer,
  p_reason text,p_outcome text,p_reference text)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_reservation record; v_result jsonb;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select * into v_reservation from supplier_claim.reject(
    p_key,p_claim,p_expected,p_assignment,p_reason,'manual_review',
    'claim_evidence_review_v1',p_outcome,p_reference,null);
  if v_reservation.reservation_outcome='execute' then
    select pg_catalog.to_jsonb(result_row) into v_result
    from supplier_claim._execute_reject(
      p_key,p_claim,p_expected,p_assignment,p_reason,'manual_review',
      'claim_evidence_review_v1',p_outcome,p_reference,
      pg_catalog.gen_random_uuid(),v_reservation.execution_fence) result_row;
    return v_result || pg_catalog.jsonb_build_object('reservation_outcome','execute');
  end if;
  return pg_catalog.to_jsonb(v_reservation);
end $$;

create function pg_temp.reject_raises_integrity_reconciliation(p_sql text)
returns boolean language plpgsql volatile security invoker set search_path=pg_catalog as $$
begin
  execute p_sql;
  return false;
exception
  when sqlstate 'P5199' then
    return sqlerrm='integrity_reconciliation_required';
  when others then
    return false;
end $$;

create function pg_temp.reserve_reject(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_assignment integer,
  p_reason text,p_outcome text,p_reference text)
returns uuid language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_fence uuid;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select execution_fence into v_fence from supplier_claim.reject(
    p_key,p_claim,p_expected,p_assignment,p_reason,'manual_review',
    'claim_evidence_review_v1',p_outcome,p_reference,null);
  return v_fence;
end $$;

create function pg_temp.execute_reject(
  p_principal uuid,p_key text,p_claim uuid,p_expected integer,p_assignment integer,
  p_reason text,p_outcome text,p_reference text,p_fence uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  perform claim_security.establish_claim_runtime_context(p_principal);
  perform pg_catalog.set_config('mujahiz.claim.hmac_key',pg_catalog.repeat('k',32),true);
  select pg_catalog.to_jsonb(result_row) into v_result
  from supplier_claim._execute_reject(
    p_key,p_claim,p_expected,p_assignment,p_reason,'manual_review',
    'claim_evidence_review_v1',p_outcome,p_reference,
    pg_catalog.gen_random_uuid(),p_fence) result_row;
  return v_result;
end $$;


-- Approved v1 reason/evidence matrix.
select pg_temp.seed_eligible_actor(1,'owner');
select pg_temp.seed_eligible_actor(2,'admin');
select pg_temp.seed_eligible_actor(3,'owner');
select pg_temp.seed_claimant(n) from pg_catalog.generate_series(101,104) n;
select pg_temp.seed_supplier(n) from pg_catalog.generate_series(201,204) n;
select pg_temp.seed_under_review_claim(1001,101,201,1,3);
select pg_temp.seed_under_review_claim(1002,102,202,1,3);
select pg_temp.seed_under_review_claim(1003,103,203,2,3);
select pg_temp.seed_under_review_claim(1004,104,204,2,3);

insert into public.supplier_ownerships(
  id,supplier_profile_id,controller_user_profile_id,authority_type,
  ownership_status,valid_from,establishment_source_type,
  establishment_reason_code,establishment_system_source)
values(pg_temp.reject_id(5001),pg_temp.reject_id(204),pg_temp.reject_id(104),
  'primary_controller','active',pg_catalog.statement_timestamp()-interval '1 day',
  'legacy_reconciliation','verified_existing_owner','reject_test');

grant mujahiz_claim_runtime to postgres with set true;
grant usage on schema extensions to mujahiz_claim_runtime;
set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(1),
  pg_temp.reject_id(1001),2,1,'insufficient_evidence','not_verified','reject-ref-min-1') result \gset reject_one_
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(2),
  pg_temp.reject_id(1002),2,1,'claimant_ineligible','verified','reject-ref-claimant') result \gset reject_two_
select pg_temp.run_reject(pg_temp.reject_id(2),pg_temp.reject_key(3),
  pg_temp.reject_id(1003),2,1,'supplier_mismatch','verified','reject-ref-supplier') result \gset reject_three_
select pg_temp.run_reject(pg_temp.reject_id(2),pg_temp.reject_key(4),
  pg_temp.reject_id(1004),2,1,'existing_owner','verified','reject-ref-owner') result \gset reject_four_
reset role;

select is((:'reject_one_result'::jsonb)->>'outcome_code','rejected',
  'insufficient_evidence with not_verified succeeds');
select is((:'reject_two_result'::jsonb)->>'outcome_code','rejected',
  'claimant_ineligible with verified succeeds');
select is((:'reject_three_result'::jsonb)->>'outcome_code','rejected',
  'supplier_mismatch with verified succeeds');
select is((:'reject_four_result'::jsonb)->>'outcome_code','rejected',
  'existing_owner with exactly one active controller succeeds');
select ok(not ((:'reject_one_result'::jsonb)->>'idempotent_replay')::boolean,
  'first rejection is not a replay');
select ok((select status='rejected' and record_version=3
    and reviewer_assignment_version=1
    and reviewer_user_profile_id=pg_temp.reject_id(1)
    and decided_by_user_profile_id=pg_temp.reject_id(1)
    and decided_at=updated_at
    and decision_reason_code='insufficient_evidence'
    and evidence_verification_method_code='manual_review'
    and evidence_verification_version='claim_evidence_review_v1'
    and evidence_verification_outcome_code='not_verified'
    and decision_authorization_policy_version='sec-001-claim-v1'
    and reviewer_notes is null
  from public.supplier_ownership_claims where id=pg_temp.reject_id(1001)),
  'success writes the exact decision fields and increments only Claim version');
select ok((select submitted_at=created_at
    and expires_at=submitted_at+interval '720 hours'
    and claimant_user_profile_id=pg_temp.reject_id(101)
    and supplier_profile_id=pg_temp.reject_id(201)
    and reviewer_assigned_by_user_profile_id=pg_temp.reject_id(3)
    and reviewer_assignment_source_code='owner_assignment'
    and reviewer_assignment_policy_version='claim_reviewer_assignment_v1'
    and submission_fingerprint=pg_catalog.repeat('b',64)
  from public.supplier_ownership_claims where id=pg_temp.reject_id(1001)),
  'rejection preserves submission and reviewer-assignment facts');
select is((select pg_catalog.count(*) from public.supplier_ownerships),1::bigint,
  'rejection creates and removes no ownership');
select ok(not exists(select 1 from public.supplier_ownership_claims
  where id not in (pg_temp.reject_id(1001),pg_temp.reject_id(1002),
    pg_temp.reject_id(1003),pg_temp.reject_id(1004)) and status='rejected'),
  'rejection mutates no competing Claim');
select is((select pg_catalog.count(*) from internal.domain_events
  where event_type='supplier_ownership.claim_rejected'
    and aggregate_id in (pg_temp.reject_id(1001),pg_temp.reject_id(1002),
      pg_temp.reject_id(1003),pg_temp.reject_id(1004))),4::bigint,
  'each successful reason emits exactly one rejection event');
select ok((select event_schema_version=1 and aggregate_sequence=3
    and producer_command_name='supplier_claim.reject'
    and producer_command_contract_version=1 and event_ordinal=1
    and payload=pg_catalog.jsonb_build_object(
      'claim_id',pg_temp.reject_id(1001),
      'supplier_profile_id',pg_temp.reject_id(201),
      'claimant_user_profile_id',pg_temp.reject_id(101),
      'claim_version',3,
      'rejection_reason_code','insufficient_evidence',
      'reason_registry_version','claim_rejection_reason_v1')
  from internal.domain_events where aggregate_id=pg_temp.reject_id(1001)),
  'rejection event has the exact v1 payload and sequence');
select ok(not exists(select 1 from internal.domain_events
  where event_type='supplier_ownership.claim_rejected'
    and row_to_json(domain_events)::text ~ 'reject-ref|evidence_digest|reviewer_notes'),
  'event leaks no restricted reference, evidence digest, or reviewer note');
select is((select pg_catalog.count(*) from internal.audit_logs
  where action_code='supplier_claim.reject' and outcome_class='succeeded'),4::bigint,
  'each successful reason persists one accountable audit');
select ok((select action_contract_version=1 and action_class='claim_ownership'
    and actor_user_profile_id=pg_temp.reject_id(1)
    and prior_state_code='under_review' and result_state_code='rejected'
    and prior_record_version=2 and result_record_version=3
    and reason_code='insufficient_evidence'
    and safe_context_schema_version='claim_reject_context_v1'
    and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(audit_row.safe_context))=16
    and pg_catalog.cardinality(changed_field_codes)=9
    and evidence_digest_algorithm='sha256'
    and evidence_digest_version='claim_reject_evidence_digest_v1'
    and evidence_digest ~ '^[0-9a-f]{64}$'
    and restricted_evidence_reference='reject-ref-min-1'
    and retention_class='claim_ownership_decision'
  from internal.audit_logs audit_row where target_id=pg_temp.reject_id(1001)
    and outcome_class='succeeded'),
  'success audit has exact classification, 16-key context, 9 changes, and bounded evidence');
select is((select evidence_digest from internal.audit_logs
  where target_id=pg_temp.reject_id(1001) and outcome_class='succeeded'),
  encode(digest('claim-reject-evidence-digest-v1|16:reject-ref-min-1','sha256'),'hex'),
  'server derives the exact versioned SHA-256 evidence digest');
select ok(not exists(select 1 from internal.idempotency_keys
  where row_to_json(idempotency_keys)::text like '%'||pg_temp.reject_key(1)||'%'),
  'raw idempotency keys are never stored');
select ok((select status='completed' and outcome_code='rejected'
    and result_resource_id=pg_temp.reject_id(1001)
    and result_version_token='3' and lease_token_digest is null
  from internal.idempotency_keys where target_aggregate_id=pg_temp.reject_id(1001)),
  'idempotency completion is atomic and bound to Claim version 3');


-- Canonical input, exact tuple, and restricted-reference validation.
select pg_temp.seed_claimant(105);
select pg_temp.seed_claimant(106);
select pg_temp.seed_supplier(205);
select pg_temp.seed_supplier(206);
select pg_temp.seed_under_review_claim(1005,105,205,1,3);
select pg_temp.seed_under_review_claim(1006,106,206,1,3);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.reject(%L,%L::uuid,2,1,%L,%L,%L,%L,%L,null)',
  pg_temp.reject_key(50),pg_temp.reject_id(1005),'unsupported_reason',
  'manual_review','claim_evidence_review_v1','verified','ref'),
  'P5101','invalid_request','unregistered rejection reason is rejected');
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.reject(%L,%L::uuid,2,1,%L,%L,%L,%L,%L,null)',
  pg_temp.reject_key(51),pg_temp.reject_id(1005),'insufficient_evidence',
  'automated','claim_evidence_review_v1','not_verified','ref'),
  'P5101','invalid_request','unapproved evidence method is rejected');
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.reject(%L,%L::uuid,2,1,%L,%L,%L,%L,%L,null)',
  pg_temp.reject_key(52),pg_temp.reject_id(1005),'insufficient_evidence',
  'manual_review','claim_evidence_review_v2','not_verified','ref'),
  'P5101','invalid_request','unapproved evidence version is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(53),pg_temp.reject_id(1005),
  'insufficient_evidence','verified','ref'),
  'P5101','invalid_request','insufficient_evidence requires not_verified');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(54),pg_temp.reject_id(1005),
  'claimant_ineligible','not_verified','ref'),
  'P5101','invalid_request','non-insufficient reasons require verified');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(55),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified',''),
  'P5101','invalid_request','empty restricted reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(56),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified',pg_catalog.repeat('x',257)),
  'P5101','invalid_request','reference over 256 bytes is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(57),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','https://evidence.example/item'),
  'P5101','invalid_request','URL reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(58),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','folder/item'),
  'P5101','invalid_request','path reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(59),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','item?token=secret'),
  'P5101','invalid_request','query or credential-shaped reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(60),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','file_id:abc'),
  'P5101','invalid_request','file reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(61),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','storage-key:abc'),
  'P5101','invalid_request','storage reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(62),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','attachment_id:abc'),
  'P5101','invalid_request','attachment reference is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(63),pg_temp.reject_id(1005),
  'insufficient_evidence','not_verified','opaque ref'),
  'P5101','invalid_request','whitespace-bearing reference is rejected');
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(64),
  pg_temp.reject_id(1005),2,1,'insufficient_evidence','not_verified','x') result \gset ref_min_
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(65),
  pg_temp.reject_id(1006),2,1,'insufficient_evidence','not_verified',
  pg_catalog.repeat('x',256)) result \gset ref_max_
reset role;
select is((:'ref_min_result'::jsonb)->>'outcome_code','rejected',
  'one-byte opaque reference is accepted');
select is((:'ref_max_result'::jsonb)->>'outcome_code','rejected',
  '256-byte opaque reference is accepted');
select is((select pg_catalog.octet_length(restricted_evidence_reference)
  from internal.audit_logs where target_id=pg_temp.reject_id(1006)),256,
  'maximum accepted reference remains exactly 256 bytes');
select ok(not exists(select 1 from information_schema.parameters
  where specific_schema='supplier_claim' and specific_name like 'reject_%'
    and parameter_name ~ 'digest|note'),
  'caller supplies neither evidence digest nor reviewer note');
select ok((select pg_catalog.pg_get_functiondef(
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure)
    ~ '''insufficient_evidence''[[:space:]]*,[[:space:]]*''claimant_ineligible''[[:space:]]*,[[:space:]]*''supplier_mismatch'''
  and pg_catalog.pg_get_functiondef(
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure)
    !~ 'existing_owner'),
  'submit/reviewer resubmission compatibility remains the approved three-reason allowlist');

-- Exact success replay and changed-binding behavior.
set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(1),
  pg_temp.reject_id(1001),2,1,'insufficient_evidence','not_verified',
  'reject-ref-min-1') result \gset replay_success_
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(1),
  pg_temp.reject_id(1001),2,1,'insufficient_evidence','not_verified',
  'changed-reference') result \gset replay_conflict_
reset role;
select is((:'replay_success_result'::jsonb)->>'reservation_outcome','replay',
  'identical completed request safely replays');
select ok((( :'replay_success_result'::jsonb)->>'idempotent_replay')::boolean
  and (:'replay_success_result'::jsonb)->>'decided_at'=
      (:'reject_one_result'::jsonb)->>'decided_at',
  'replay returns the original immutable decision time');
select is((:'replay_conflict_result'::jsonb)->>'reservation_outcome',
  'idempotency_key_conflict','same key with changed evidence binding conflicts');
select is((select pg_catalog.count(*) from internal.domain_events
  where aggregate_id=pg_temp.reject_id(1001)),1::bigint,
  'replay and conflict create no duplicate event');
select is((select pg_catalog.count(*) from internal.audit_logs
  where target_id=pg_temp.reject_id(1001) and outcome_class='succeeded'),1::bigint,
  'replay and conflict create no duplicate success audit');


-- Authorization, assignment, ownership evidence, and lifecycle-state matrix.
select pg_temp.seed_eligible_actor(4,'owner');
select pg_temp.seed_actor_base(5,'buyer');
select pg_temp.seed_eligible_actor(6,'owner');
select pg_temp.seed_eligible_actor(7,'admin');
select pg_temp.seed_eligible_actor(8,'owner');
select pg_temp.seed_eligible_actor(9,'owner');
select pg_temp.seed_claimant(10);
select pg_temp.seed_eligible_actor(11,'owner');
delete from public.access_grants where user_profile_id=pg_temp.reject_id(6);
update public.access_grants set valid_until=pg_catalog.statement_timestamp()-interval '1 second'
where user_profile_id=pg_temp.reject_id(7);
update internal.security_eligibility_assessments
set assessment_result='deny',condition_type='security_hold',
  assessment_source_type='trusted_security_system'
where user_profile_id=pg_temp.reject_id(8);
update internal.security_eligibility_assessments
set assessment_result='unknown',condition_type='reconciliation_required',
  assessment_source_type='trusted_security_system'
where user_profile_id=pg_temp.reject_id(9);

select pg_temp.seed_claimant(n) from pg_catalog.generate_series(107,116) n;
select pg_temp.seed_supplier(n) from pg_catalog.generate_series(207,216) n;
select pg_temp.seed_under_review_claim(1010,107,207,1,3);
select pg_temp.seed_under_review_claim(1011,108,208,5,3);
select pg_temp.seed_under_review_claim(1012,109,209,6,3);
select pg_temp.seed_under_review_claim(1013,110,210,7,3);
select pg_temp.seed_under_review_claim(1014,111,211,8,3);
select pg_temp.seed_under_review_claim(1015,112,212,9,3);
select pg_temp.seed_under_review_claim(1016,113,213,1,3);
select pg_temp.seed_under_review_claim(1017,114,214,11,3);
select pg_temp.seed_under_review_claim(1018,115,215,1,3);
select pg_temp.seed_under_review_claim(1019,116,216,1,3);
insert into public.supplier_ownerships(
  id,supplier_profile_id,controller_user_profile_id,valid_from,
  establishment_source_type,establishment_reason_code,establishment_system_source)
values(pg_temp.reject_id(5002),pg_temp.reject_id(214),pg_temp.reject_id(11),
  pg_catalog.statement_timestamp()-interval '1 day','legacy_reconciliation',
  'reviewer_conflict','reject_test');

set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(4),pg_temp.reject_key(70),
  pg_temp.reject_id(1010),2,1,'supplier_mismatch','verified','auth-wrong-reviewer') result \gset deny_wrong_
select pg_temp.run_reject(pg_temp.reject_id(5),pg_temp.reject_key(71),
  pg_temp.reject_id(1011),2,1,'supplier_mismatch','verified','auth-no-role') result \gset deny_role_
select pg_temp.run_reject(pg_temp.reject_id(6),pg_temp.reject_key(72),
  pg_temp.reject_id(1012),2,1,'supplier_mismatch','verified','auth-no-access') result \gset deny_access_
select pg_temp.run_reject(pg_temp.reject_id(7),pg_temp.reject_key(73),
  pg_temp.reject_id(1013),2,1,'supplier_mismatch','verified','auth-expired') result \gset deny_expired_
select pg_temp.run_reject(pg_temp.reject_id(8),pg_temp.reject_key(74),
  pg_temp.reject_id(1014),2,1,'supplier_mismatch','verified','auth-deny') result \gset deny_security_
select pg_temp.run_reject(pg_temp.reject_id(9),pg_temp.reject_key(75),
  pg_temp.reject_id(1015),2,1,'supplier_mismatch','verified','auth-unknown') result \gset deny_unknown_
select pg_temp.run_reject(pg_temp.reject_id(10),pg_temp.reject_key(76),
  pg_temp.reject_id(1016),2,1,'supplier_mismatch','verified','auth-claimant') result \gset deny_claimant_
select pg_temp.run_reject(pg_temp.reject_id(11),pg_temp.reject_key(77),
  pg_temp.reject_id(1017),2,1,'supplier_mismatch','verified','auth-conflict') result \gset deny_conflict_
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(78),
  pg_temp.reject_id(1018),2,1,'existing_owner','verified','owner-missing') result \gset deny_evidence_
reset role;

select is((:'deny_wrong_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'eligible but unassigned reviewer is denied');
select is((:'deny_role_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'reviewer missing exact role is denied');
select is((:'deny_access_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'reviewer with lost access is denied');
select is((:'deny_expired_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'reviewer with expired access is denied');
select is((:'deny_security_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'security deny is non-authorizing');
select is((:'deny_unknown_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'security unknown fails closed');
select is((:'deny_claimant_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'claimant cannot decide an assigned Claim');
select is((:'deny_conflict_result'::jsonb)->>'outcome_code','reviewer_conflict',
  'target-Supplier reviewer conflict is denied');
select is((:'deny_evidence_result'::jsonb)->>'outcome_code','evidence_not_verified',
  'existing_owner without exactly one active controller is denied');
select ok((select outcome_class='rejected' and result_code='actor_not_authorized'
    and source_operation_class='trusted_command_denial'
    and action_evidence_schema_version='claim_reject_denial_v1'
    and safe_context is null and evidence_digest is null
    and restricted_evidence_reference is null
  from internal.audit_logs where target_id=pg_temp.reject_id(1014)),
  'authorization denial audit is classified and contains no private evidence');
select ok((select outcome_class='conflicted' and result_code='reviewer_conflict'
    and safe_context is null and related_target_id=pg_temp.reject_id(214)
  from internal.audit_logs where target_id=pg_temp.reject_id(1017)),
  'reviewer conflict produces one minimized conflicted audit');
select ok((select outcome_class='rejected' and result_code='evidence_not_verified'
    and safe_context is null and evidence_digest is null
  from internal.audit_logs where target_id=pg_temp.reject_id(1018)),
  'evidence denial produces one minimized rejected audit');
select ok(not exists(select 1 from internal.domain_events
  where aggregate_id between pg_temp.reject_id(1010) and pg_temp.reject_id(1018)),
  'authorization and evidence denials emit no domain event');
select ok(not exists(select 1 from public.supplier_ownership_claims
  where id between pg_temp.reject_id(1010) and pg_temp.reject_id(1018)
    and status <> 'under_review'),
  'authorization and evidence denials mutate no Claim');

set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(8),pg_temp.reject_key(74),
  pg_temp.reject_id(1014),2,1,'supplier_mismatch','verified','auth-deny') result \gset denial_replay_
reset role;
select is((:'denial_replay_result'::jsonb)->>'reservation_outcome','replay',
  'identical accountable terminal denial safely replays');
select ok((( :'denial_replay_result'::jsonb)->>'idempotent_replay')::boolean
  and (select pg_catalog.count(*) from internal.audit_logs
    where target_id=pg_temp.reject_id(1014))=1,
  'denial replay creates no duplicate denial audit');

set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,1,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(79),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','stale-claim'),
  'P5112','claim_version_conflict','stale Claim version is rejected');
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,2,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(80),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','stale-assignment'),
  'P5112','claim_version_conflict','stale reviewer-assignment version is rejected');
reset role;

savepoint reject_non_actionable_states;
alter table public.supplier_ownership_claims
  drop constraint supplier_ownership_claims_reviewer_assignment_shape_ck,
  drop constraint supplier_ownership_claims_decision_shape_ck,
  drop constraint supplier_ownership_claims_withdrawal_shape_ck,
  drop constraint supplier_ownership_claims_expiry_shape_ck,
  drop constraint supplier_ownership_claims_supersession_shape_ck,
  drop constraint supplier_ownership_claims_lifecycle_shape_ck;
update public.supplier_ownership_claims set status='submitted'
where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(81),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','state-submitted'),
  'P5113','claim_not_actionable','submitted Claim is not reject-actionable');
reset role;
update public.supplier_ownership_claims set status='withdrawn'
where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(82),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','state-withdrawn'),
  'P5113','claim_not_actionable','withdrawn Claim is not reject-actionable');
reset role;
update public.supplier_ownership_claims set status='rejected'
where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(83),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','state-rejected'),
  'P5113','claim_not_actionable','rejected Claim is not reject-actionable');
reset role;
update public.supplier_ownership_claims set status='approved'
where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(84),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','state-approved'),
  'P5113','claim_not_actionable','approved Claim is not reject-actionable');
reset role;
update public.supplier_ownership_claims set status='superseded'
where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(85),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','state-superseded'),
  'P5113','claim_not_actionable','superseded Claim is not reject-actionable');
reset role;
rollback to savepoint reject_non_actionable_states;

update public.supplier_ownership_claims
set submitted_at=pg_catalog.statement_timestamp()-interval '721 hours',
    created_at=pg_catalog.statement_timestamp()-interval '721 hours',
    expires_at=pg_catalog.statement_timestamp()-interval '1 hour',
    reviewer_assigned_at=pg_catalog.statement_timestamp()-interval '720 hours 59 minutes',
    updated_at=pg_catalog.statement_timestamp()-interval '720 hours 59 minutes'
where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(86),pg_temp.reject_id(1019),
  'supplier_mismatch','verified','state-due'),
  'P5114','claim_expired','due Claim cannot be rejected');
reset role;

savepoint reject_malformed_assignment;
alter table public.supplier_ownership_claims
  drop constraint supplier_ownership_claims_reviewer_assignment_shape_ck,
  drop constraint supplier_ownership_claims_lifecycle_shape_ck;
update public.supplier_ownership_claims
set reviewer_assigned_at=null where id=pg_temp.reject_id(1019);
set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(87),
  pg_temp.reject_id(1019),2,1,'supplier_mismatch','verified','bad-assignment') result \gset malformed_
reset role;
select is((:'malformed_result'::jsonb)->>'outcome_code',
  'integrity_reconciliation_required','malformed assignment is not repaired');
rollback to savepoint reject_malformed_assignment;


-- Reservation fencing and durable replay-corruption containment.
select pg_temp.seed_claimant(117);
select pg_temp.seed_supplier(217);
select pg_temp.seed_under_review_claim(1020,117,217,1,3);
set role mujahiz_claim_runtime;
select pg_temp.reserve_reject(pg_temp.reject_id(1),pg_temp.reject_key(90),
  pg_temp.reject_id(1020),2,1,'supplier_mismatch','verified','fence-ref') fence \gset fence_live_
select throws_ok(pg_catalog.format(
  'select pg_temp.reserve_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(90),pg_temp.reject_id(1020),
  'supplier_mismatch','verified','fence-ref'),
  'P5109','command_in_progress','live reservation reports in progress');
reset role;
update internal.idempotency_keys
set lease_expires_at=created_at+interval '1 millisecond'
where target_aggregate_id=pg_temp.reject_id(1020);
set role mujahiz_claim_runtime;
select pg_temp.reserve_reject(pg_temp.reject_id(1),pg_temp.reject_key(90),
  pg_temp.reject_id(1020),2,1,'supplier_mismatch','verified','fence-ref') fence \gset fence_new_
select ok(:'fence_live_fence'::uuid <> :'fence_new_fence'::uuid,
  'expired reservation reclaim rotates the opaque fence');
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L,%L::uuid)',
  pg_temp.reject_id(1),pg_temp.reject_key(90),pg_temp.reject_id(1020),
  'supplier_mismatch','verified','fence-ref',:'fence_live_fence'),
  'P5109','command_in_progress','stale Phase-B fence cannot commit');
select pg_temp.execute_reject(pg_temp.reject_id(1),pg_temp.reject_key(90),
  pg_temp.reject_id(1020),2,1,'supplier_mismatch','verified','fence-ref',
  :'fence_new_fence'::uuid) result \gset fence_result_
reset role;
select is((:'fence_result_result'::jsonb)->>'outcome_code','rejected',
  'current reclaimed fence completes exactly once');

savepoint reject_corrupt_claim;
update public.supplier_ownership_claims set decided_at=decided_at+interval '1 second'
where id=pg_temp.reject_id(1002);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'corrupted completed Claim fails closed');
reset role;
rollback to savepoint reject_corrupt_claim;

savepoint reject_missing_audit;
delete from internal.audit_logs where target_id=pg_temp.reject_id(1002)
  and source_operation_class='trusted_command';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'missing completed audit fails closed');
reset role;
rollback to savepoint reject_missing_audit;

savepoint reject_duplicate_audit;
insert into internal.audit_logs
select (pg_catalog.jsonb_populate_record(
  null::internal.audit_logs,
  pg_catalog.to_jsonb(audit_row) || pg_catalog.jsonb_build_object('id',pg_catalog.gen_random_uuid())
)).*
from internal.audit_logs audit_row
where target_id=pg_temp.reject_id(1002)
  and source_operation_class='trusted_command';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'duplicate completed audit fails closed');
reset role;
rollback to savepoint reject_duplicate_audit;

savepoint reject_incomplete_audit;
update internal.audit_logs set safe_context=safe_context-'security_policy_version'
where target_id=pg_temp.reject_id(1002) and source_operation_class='trusted_command';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'incomplete completed-audit context fails closed');
reset role;
rollback to savepoint reject_incomplete_audit;

savepoint reject_missing_event;
delete from internal.domain_events where aggregate_id=pg_temp.reject_id(1002);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'missing completed event fails closed');
reset role;
rollback to savepoint reject_missing_event;

savepoint reject_duplicate_event;
insert into internal.domain_events(
  id,event_type,event_schema_version,aggregate_type,aggregate_id,aggregate_sequence,
  producer_command_name,producer_command_contract_version,producer_idempotency_key_id,
  source_system_code,event_ordinal,actor_kind,actor_user_profile_id,environment_code,
  producing_component_code,correlation_id,occurred_at,persisted_at,payload,
  processing_status,available_at)
select pg_catalog.gen_random_uuid(),event_type,event_schema_version,aggregate_type,
  aggregate_id,aggregate_sequence+1,producer_command_name,
  producer_command_contract_version,producer_idempotency_key_id,source_system_code,
  event_ordinal+1,actor_kind,actor_user_profile_id,environment_code,
  producing_component_code,correlation_id,occurred_at,persisted_at,payload,
  processing_status,available_at
from internal.domain_events where aggregate_id=pg_temp.reject_id(1002);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'duplicate completed event fails closed');
reset role;
rollback to savepoint reject_duplicate_event;

savepoint reject_wrong_event;
update internal.domain_events set payload=payload||'{"reviewer_user_profile_id":"b1000000-0000-4000-8000-000000000001"}'::jsonb
where aggregate_id=pg_temp.reject_id(1002);
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'),
  'P5199','integrity_reconciliation_required',
  'wrong completed event payload fails closed');
reset role;
rollback to savepoint reject_wrong_event;

savepoint reject_wrong_denial_outcome;
update internal.audit_logs set outcome_class='failed'
where target_id=pg_temp.reject_id(1014) and result_code='actor_not_authorized';
set role mujahiz_claim_runtime;
select throws_ok(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(8),pg_temp.reject_key(74),pg_temp.reject_id(1014),
  'supplier_mismatch','verified','auth-deny'),
  'P5199','integrity_reconciliation_required',
  'terminal denial with wrong outcome class fails closed');
reset role;
rollback to savepoint reject_wrong_denial_outcome;

select ok((select status='rejected' and record_version=3
  from public.supplier_ownership_claims where id=pg_temp.reject_id(1002))
  and (select pg_catalog.count(*) from internal.domain_events
    where aggregate_id=pg_temp.reject_id(1002))=1
  and (select pg_catalog.count(*) from internal.audit_logs
    where target_id=pg_temp.reject_id(1002) and outcome_class='succeeded')=1,
  'corruption probes leave one authoritative mutation, event, and success audit');

-- Required persistence failures roll back all Phase-B effects.
select pg_temp.seed_claimant(118);
select pg_temp.seed_claimant(119);
select pg_temp.seed_claimant(120);
select pg_temp.seed_supplier(218);
select pg_temp.seed_supplier(219);
select pg_temp.seed_supplier(220);
select pg_temp.seed_under_review_claim(1021,118,218,1,3);
select pg_temp.seed_under_review_claim(1022,119,219,1,3);
select pg_temp.seed_under_review_claim(1023,120,220,1,3);

create function public.reject_event_failure_test()
returns trigger language plpgsql as $$ begin
  if new.producer_command_name='supplier_claim.reject' then
    raise exception 'synthetic reject event failure';
  end if; return new; end $$;
create trigger reject_event_failure_test before insert on internal.domain_events
for each row execute function public.reject_event_failure_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_reject(pg_temp.reject_id(1),pg_temp.reject_key(91),
  pg_temp.reject_id(1021),2,1,'supplier_mismatch','verified','event-fail') fence \gset event_fail_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L,%L::uuid)',
  pg_temp.reject_id(1),pg_temp.reject_key(91),pg_temp.reject_id(1021),
  'supplier_mismatch','verified','event-fail',:'event_fail_fence'),
  'P5199','integrity_reconciliation_required','event failure aborts Phase B safely');
reset role;
drop trigger reject_event_failure_test on internal.domain_events;
drop function public.reject_event_failure_test();
select ok((select status='under_review' and record_version=2
  from public.supplier_ownership_claims where id=pg_temp.reject_id(1021))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.reject_id(1021))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.reject_id(1021))
  and (select status='processing' from internal.idempotency_keys
    where target_aggregate_id=pg_temp.reject_id(1021)),
  'event failure leaves only the prior durable reservation');

create function public.reject_audit_failure_test()
returns trigger language plpgsql as $$ begin
  if new.action_code='supplier_claim.reject' then
    raise exception 'synthetic reject audit failure';
  end if; return new; end $$;
create trigger reject_audit_failure_test before insert on internal.audit_logs
for each row execute function public.reject_audit_failure_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_reject(pg_temp.reject_id(1),pg_temp.reject_key(92),
  pg_temp.reject_id(1022),2,1,'supplier_mismatch','verified','audit-fail') fence \gset audit_fail_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L,%L::uuid)',
  pg_temp.reject_id(1),pg_temp.reject_key(92),pg_temp.reject_id(1022),
  'supplier_mismatch','verified','audit-fail',:'audit_fail_fence'),
  'P5116','audit_unavailable','audit failure returns the safe unavailable error');
reset role;
drop trigger reject_audit_failure_test on internal.audit_logs;
drop function public.reject_audit_failure_test();
select ok((select status='under_review' and record_version=2
  from public.supplier_ownership_claims where id=pg_temp.reject_id(1022))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.reject_id(1022))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.reject_id(1022)),
  'audit failure rolls back Claim and event');

create function public.reject_completion_failure_test()
returns trigger language plpgsql as $$ begin
  if new.command_name='supplier_claim.reject' and new.status='completed' then
    raise exception 'synthetic reject completion failure';
  end if; return new; end $$;
create trigger reject_completion_failure_test before update on internal.idempotency_keys
for each row execute function public.reject_completion_failure_test();
set role mujahiz_claim_runtime;
select pg_temp.reserve_reject(pg_temp.reject_id(1),pg_temp.reject_key(93),
  pg_temp.reject_id(1023),2,1,'supplier_mismatch','verified','completion-fail') fence \gset complete_fail_
select throws_ok(pg_catalog.format(
  'select pg_temp.execute_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L,%L::uuid)',
  pg_temp.reject_id(1),pg_temp.reject_key(93),pg_temp.reject_id(1023),
  'supplier_mismatch','verified','completion-fail',:'complete_fail_fence'),
  'P5199','integrity_reconciliation_required',
  'idempotency completion failure aborts Phase B safely');
reset role;
drop trigger reject_completion_failure_test on internal.idempotency_keys;
drop function public.reject_completion_failure_test();
select ok((select status='under_review' and record_version=2
  from public.supplier_ownership_claims where id=pg_temp.reject_id(1023))
  and not exists(select 1 from internal.domain_events where aggregate_id=pg_temp.reject_id(1023))
  and not exists(select 1 from internal.audit_logs where target_id=pg_temp.reject_id(1023))
  and (select status='processing' from internal.idempotency_keys
    where target_aggregate_id=pg_temp.reject_id(1023)),
  'completion failure rolls back Claim, event, and audit');


-- Additional adversarial role/unknown/classification probes.
select pg_temp.seed_eligible_actor(12,'admin');
select pg_temp.seed_eligible_actor(13,'owner');
select pg_temp.seed_claimant(121);
select pg_temp.seed_claimant(122);
select pg_temp.seed_supplier(221);
select pg_temp.seed_supplier(222);
select pg_temp.seed_under_review_claim(1024,121,221,1,3);
select pg_temp.seed_under_review_claim(1025,122,222,13,3);
set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(12),pg_temp.reject_key(94),
  pg_temp.reject_id(1024),2,1,'supplier_mismatch','verified','unassigned-admin') result \gset unassigned_admin_
reset role;
select is((:'unassigned_admin_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'unassigned Admin is denied');

update internal.identity_provider_links set provider_state_version='unsupported-provider-state'
where user_profile_id=pg_temp.reject_id(13);
set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(13),pg_temp.reject_key(95),
  pg_temp.reject_id(1025),2,1,'supplier_mismatch','verified','provider-unknown') result \gset provider_unknown_
reset role;
select is((:'provider_unknown_result'::jsonb)->>'outcome_code','actor_not_authorized',
  'unsupported provider state fails closed');

savepoint reject_conflict_unknown;
create table public.supplier_memberships(id uuid primary key);
set role mujahiz_claim_runtime;
select pg_temp.run_reject(pg_temp.reject_id(1),pg_temp.reject_key(96),
  pg_temp.reject_id(1024),2,1,'supplier_mismatch','verified','conflict-unknown') result \gset conflict_unknown_
reset role;
select ((:'conflict_unknown_result'::jsonb)->>'outcome_code'='reviewer_conflict')::text as result \gset conflict_unknown_
rollback to savepoint reject_conflict_unknown;
select ok(:'conflict_unknown_result'::boolean,
  'future relationship coverage makes target conflict unknown and non-authorizing');

savepoint reject_wrong_event_version;
update internal.domain_events set event_schema_version=2
where aggregate_id=pg_temp.reject_id(1002);
set role mujahiz_claim_runtime;
select pg_temp.reject_raises_integrity_reconciliation(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'))::text as result \gset wrong_event_version_
reset role;
rollback to savepoint reject_wrong_event_version;
select ok(:'wrong_event_version_result'::boolean,
  'wrong completed event version fails closed');

savepoint reject_wrong_audit_classification;
update internal.audit_logs set outcome_class='failed'
where target_id=pg_temp.reject_id(1002) and source_operation_class='trusted_command';
set role mujahiz_claim_runtime;
select pg_temp.reject_raises_integrity_reconciliation(pg_catalog.format(
  'select pg_temp.run_reject(%L::uuid,%L,%L::uuid,2,1,%L,%L,%L)',
  pg_temp.reject_id(1),pg_temp.reject_key(2),pg_temp.reject_id(1002),
  'claimant_ineligible','verified','reject-ref-claimant'))::text as result \gset wrong_audit_classification_
reset role;
rollback to savepoint reject_wrong_audit_classification;
select ok(:'wrong_audit_classification_result'::boolean,
  'wrong completed audit classification fails closed');

select * from finish();
rollback;
