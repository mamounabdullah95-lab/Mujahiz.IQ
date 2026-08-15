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
  p_status text,p_due boolean) returns uuid
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
    case when p_status='under_review' then pg_temp.expire_id(3) end,
    case when p_status='under_review' then 1 end,
    case when p_status='under_review' then s+interval '1 minute' end,
    case when p_status='under_review' then pg_temp.expire_id(4) end,
    case when p_status='under_review' then 'owner_assignment' end,
    case when p_status='under_review' then 'claim_reviewer_assignment_v1' end,
    s,case when p_status='under_review' then s+interval '1 minute' else s end);
  return v;
end $$;

select pg_temp.seed_profile(n) from generate_series(1,4)n;
select pg_temp.seed_supplier(n) from generate_series(11,14)n;
select pg_temp.seed_claim(101,1,11,'submitted',true);
select pg_temp.seed_claim(102,2,12,'under_review',true);
select pg_temp.seed_claim(103,1,13,'submitted',false);
select pg_temp.seed_claim(104,2,14,'submitted',true);

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

select * from finish();
