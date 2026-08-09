\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_catalog;

select plan(113);

select has_schema('supplier_claim', 'trusted Supplier Claim command schema exists');
select has_function(
  'supplier_claim',
  'submit',
  array['text','uuid','text','text','jsonb','uuid','uuid'],
  'supplier_claim.submit v1 exists with the exact input types'
);
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
), 1::bigint, 'command schema contains exactly one routine');
select is((
  select string_agg(p.proname, ',' order by p.proname)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
), 'submit', 'submit is the only implemented Claim command');
select ok((
  select p.prosecdef
  from pg_catalog.pg_proc p
  where p.oid = 'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure
), 'submit is SECURITY DEFINER');
select is((
  select r.rolname
  from pg_catalog.pg_proc p
  join pg_catalog.pg_roles r on r.oid = p.proowner
  where p.oid = 'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure
), 'postgres', 'submit has the explicit trusted postgres owner');
select is((
  select array_to_string(p.proconfig, ',')
  from pg_catalog.pg_proc p
  where p.oid = 'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure
), 'search_path=pg_catalog', 'submit fixes search_path to pg_catalog');
select is(
  pg_catalog.pg_get_function_identity_arguments(
    'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure
  ),
  'p_idempotency_key text, p_supplier_profile_id uuid, p_submitted_reason text, p_evidence_schema_version text, p_evidence_descriptors jsonb, p_prior_claim_id uuid, p_correlation_id uuid',
  'submit inputs expose no caller-selected claimant or provider identity'
);
select is(
  pg_catalog.pg_get_function_result(
    'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure
  ),
  'TABLE(command text, command_contract_version integer, outcome_code text, claim_id uuid, claim_status text, claim_version integer, supplier_profile_id uuid, submitted_at timestamp with time zone, expires_at timestamp with time zone, idempotent_replay boolean)',
  'submit returns the exact safe typed result envelope'
);
select ok(has_schema_privilege('mujahiz_claim_runtime', 'supplier_claim', 'usage'), 'runtime can resolve the command schema');
select ok(not has_schema_privilege('mujahiz_claim_runtime', 'supplier_claim', 'create'), 'runtime cannot create command objects');
select ok(has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)',
  'execute'
), 'runtime can execute only the submit command');
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) api_role(role_name)
  where has_schema_privilege(api_role.role_name, 'supplier_claim', 'usage')
     or has_function_privilege(
       api_role.role_name,
       'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)',
       'execute'
     )
), 'Supabase API roles have no command-schema or submit authority');
select ok(not has_function_privilege(
  'public',
  'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)',
  'execute'
), 'PUBLIC cannot execute submit');

select has_function('claim_security', 'claim_principal_lock_key_v1', array['uuid'], 'versioned principal lock helper exists');
select has_function('claim_security', 'claim_supplier_lock_key_v1', array['uuid'], 'versioned Supplier lock helper exists');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
), 4::bigint, 'Claim security schema contains only context and lock helpers');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
    and p.proname like 'claim_%_lock_key_v1'
    and not p.prosecdef
    and p.provolatile = 'i'
    and p.proisstrict
    and p.proconfig @> array['search_path=pg_catalog']::text[]
), 2::bigint, 'both lock helpers are strict immutable SECURITY INVOKER routines');
select ok(
  claim_security.claim_principal_lock_key_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    = claim_security.claim_principal_lock_key_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  and claim_security.claim_principal_lock_key_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    <> claim_security.claim_supplier_lock_key_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'lock keys are deterministic and namespace-separated'
);
select ok(not exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
    and p.proname like 'claim_%_lock_key_v1'
    and has_function_privilege('mujahiz_claim_runtime', p.oid, 'execute')
), 'runtime cannot invoke internal lock-key helpers directly');

select is((
  select count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal') and c.relkind in ('r', 'p')
), 22::bigint, 'submit slice adds no physical table');
select is((
  select count(*)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
), 1::bigint, 'Claim base table retains exactly one RLS policy');
select is((
  select count(*)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
    and polcmd in ('a', 'w', 'd')
), 0::bigint, 'submit adds no mutation RLS policy');
select ok(not exists (
  select 1
  from (values
    ('public.supplier_ownership_claims'),
    ('public.supplier_ownerships'),
    ('internal.idempotency_keys'),
    ('internal.domain_events'),
    ('internal.audit_logs'),
    ('internal.identity_provider_links')
  ) protected_table(table_name)
  cross join lateral (values ('INSERT'), ('UPDATE'), ('DELETE')) privilege(privilege_name)
  where has_table_privilege(
    'mujahiz_claim_runtime',
    protected_table.table_name,
    privilege.privilege_name
  )
), 'runtime receives no direct mutation authority on protected tables');
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) api_role(role_name)
  cross join lateral (values ('INSERT'), ('UPDATE'), ('DELETE')) privilege(privilege_name)
  where has_table_privilege(
    api_role.role_name,
    'public.supplier_ownership_claims',
    privilege.privilege_name
  )
), 'Supabase API roles cannot mutate the Claim base table directly');
select ok(not exists (
  select 1
  from (values
    ('internal.idempotency_keys'),
    ('internal.domain_events'),
    ('internal.audit_logs'),
    ('internal.identity_provider_links')
  ) protected_table(table_name)
  cross join lateral (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privilege(privilege_name)
  where has_table_privilege(
    'mujahiz_claim_runtime',
    protected_table.table_name,
    privilege.privilege_name
  )
), 'runtime receives no direct internal-table authority');
select is((
  select count(*)
  from pg_catalog.pg_trigger
  where not tgisinternal
    and tgrelid in (
      'public.supplier_ownership_claims'::regclass,
      'internal.idempotency_keys'::regclass,
      'internal.domain_events'::regclass
    )
), 0::bigint, 'submit slice introduces no persistent trigger');
select ok((
  select lower(pg_catalog.pg_get_functiondef(
    'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure
  ))
) !~ 'insert into internal\.audit_logs|notification', 'ordinary submit writes neither durable audit nor notification state');

insert into public.user_profiles (
  id, full_name, account_context, verification_mirror_status,
  verification_mirror_observed_at, display_email, phone_number,
  job_title, legacy_organization
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic Eligible Claimant', 'supplier', 'verified',
    pg_catalog.statement_timestamp(), 'claimant@example.test', '+9647000000001',
    'Managing Director', 'Synthetic Organization'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'Synthetic Other Claimant', 'supplier', 'verified',
    pg_catalog.statement_timestamp(), 'other@example.test', null,
    null, null
  ),
  (
    'c3000000-0000-4000-8000-000000000003',
    'Synthetic Ineligible Claimant', 'supplier', 'verified',
    pg_catalog.statement_timestamp(), null, null, null, null
  ),
  (
    'd4000000-0000-4000-8000-000000000004',
    'Synthetic Reviewer', 'buyer', 'unknown',
    null, null, null, null, null
  ),
  (
    'e5000000-0000-4000-8000-000000000005',
    'Synthetic Existing Controller', 'buyer', 'unknown',
    null, null, null, null, null
  );

insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject,
  is_primary, link_status, identity_status, verification_status,
  linked_at, provider_state_observed_at, verified_at
)
values
  (
    'a1100000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'firebase', 'synthetic-submit-claimant-a', true, 'linked', 'active', 'verified',
    pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
  ),
  (
    'b2200000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000002',
    'firebase', 'synthetic-submit-claimant-b', true, 'linked', 'active', 'verified',
    pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
  );

insert into public.supplier_profiles (
  id, name_original, display_name, name_language, name_en,
  business_type, listing_status, verification_status,
  source_type, confidence_level, has_direct_experience
)
values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Success Supplier', 'Synthetic Success Supplier', 'english', 'Synthetic Success Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic Owned Supplier', 'Synthetic Owned Supplier', 'english', 'Synthetic Owned Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('10000000-0000-4000-8000-000000000003', 'Synthetic Archived Supplier', 'Synthetic Archived Supplier', 'english', 'Synthetic Archived Supplier', 'company', 'archived', 'community_submitted', 'other', 'low', 'no'),
  ('10000000-0000-4000-8000-000000000004', 'Synthetic Prior Supplier', 'Synthetic Prior Supplier', 'english', 'Synthetic Prior Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('10000000-0000-4000-8000-000000000005', 'Synthetic Rollback Supplier', 'Synthetic Rollback Supplier', 'english', 'Synthetic Rollback Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('10000000-0000-4000-8000-000000000006', 'Synthetic Spare Supplier', 'Synthetic Spare Supplier', 'english', 'Synthetic Spare Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no');

insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id,
  establishment_source_type, establishment_reason_code,
  establishment_system_source
)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'e5000000-0000-4000-8000-000000000005',
  'legacy_reconciliation', 'synthetic_fixture', 'claim_test'
);

insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status, record_version,
  submitted_at, expires_at, submitted_reason,
  claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version,
  reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
  reviewer_assignment_source_code, reviewer_assignment_policy_version,
  decided_by_user_profile_id, decided_at, decision_reason_code,
  evidence_verification_method_code, evidence_verification_version,
  evidence_verification_outcome_code, decision_authorization_policy_version
)
values (
  '20000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000004',
  'rejected', 3,
  pg_catalog.statement_timestamp() - interval '10 days',
  pg_catalog.statement_timestamp() + interval '20 days',
  'Previous evidence was not sufficient for review.',
  'claimant_snapshot_v1', '{"full_name":"Synthetic Eligible Claimant"}'::jsonb,
  'claim_submit_v1', repeat('0', 64),
  'claim_evidence_v1',
  '[{"kind":"other","summary":"Previous evidence summary for review."}]'::jsonb,
  'd4000000-0000-4000-8000-000000000004', 1,
  pg_catalog.statement_timestamp() - interval '9 days',
  'd4000000-0000-4000-8000-000000000004',
  'manual', 'claim_review_assignment_v1',
  'd4000000-0000-4000-8000-000000000004',
  pg_catalog.statement_timestamp() - interval '8 days',
  'insufficient_evidence',
  'manual_review', 'v1', 'insufficient',
  'claim_decision_authorization_v1'
);

grant mujahiz_claim_runtime to postgres with set true;
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.submit(
  'claim-40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '  I am the authorized company representative.  ',
  'claim_evidence_v1',
  '[{"summary":"Company email verification evidence.","kind":"company_domain_email","reference_url":"https://Example.test/about"}]'::jsonb,
  null,
  '50000000-0000-4000-8000-000000000001'
) \gset submitted_
commit;
reset role;

select is(:'submitted_command'::text, 'supplier_claim.submit', 'success envelope names the submit command');
select is(:'submitted_command_contract_version'::integer, 1, 'success envelope returns contract version 1');
select is(:'submitted_outcome_code'::text, 'submitted', 'success envelope returns submitted outcome');
select is(:'submitted_claim_status'::text, 'submitted', 'success envelope returns submitted status');
select is(:'submitted_claim_version'::integer, 1, 'success envelope returns Claim version 1');
select is(
  :'submitted_supplier_profile_id'::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  'success envelope returns the target Supplier'
);
select ok(not :'submitted_idempotent_replay'::boolean, 'first execution is not an idempotent replay');
select is(
  :'submitted_expires_at'::timestamptz - :'submitted_submitted_at'::timestamptz,
  interval '720 hours',
  'success envelope uses the exact 720-hour expiry'
);

select is((
  select count(*)
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 1::bigint, 'submit inserts exactly one Claim');
select ok((
  select claimant_user_profile_id = 'a1000000-0000-4000-8000-000000000001'::uuid
    and supplier_profile_id = '10000000-0000-4000-8000-000000000001'::uuid
    and status = 'submitted'
    and record_version = 1
    and submitted_at = :'submitted_submitted_at'::timestamptz
    and expires_at = :'submitted_expires_at'::timestamptz
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 'persisted Claim identity, lifecycle, version, and timestamps match the envelope');
select is((
  select submitted_reason
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 'I am the authorized company representative.', 'submitted reason is normalized before persistence');
select is((
  select claimant_snapshot
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), jsonb_build_object(
  'full_name', 'Synthetic Eligible Claimant',
  'organization', 'Synthetic Organization',
  'job_title', 'Managing Director',
  'email', 'claimant@example.test',
  'phone', '+9647000000001'
), 'claimant snapshot is server-derived from the trusted profile');
select is((
  select claimant_snapshot_schema_version
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 'claimant_snapshot_v1', 'claimant snapshot uses the exact schema version');
select is((
  select evidence_descriptors
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), '[{"kind":"company_domain_email","summary":"Company email verification evidence.","reference_url":"https://example.test/about"}]'::jsonb, 'evidence is bounded and canonically normalized');
select is((
  select evidence_schema_version
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 'claim_evidence_v1', 'persisted evidence uses the exact supported schema');
select ok((
  select submission_fingerprint_version = 'claim_submit_v1'
    and submission_fingerprint ~ '^[0-9a-f]{64}$'
    and submission_fingerprint !~ '40000000-0000-4000-8000-000000000001'
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 'Claim stores only a versioned one-way request fingerprint');
select ok((
  select reviewer_user_profile_id is null
    and decided_at is null
    and withdrawn_at is null
    and expired_at is null
    and superseded_at is null
    and resulting_supplier_ownership_id is null
    and prior_claim_id is null
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 'submit does not populate review, decision, terminal, ownership, or prior fields');

select is((
  select count(*)
  from internal.domain_events
  where aggregate_id = :'submitted_claim_id'::uuid
), 1::bigint, 'submit inserts exactly one domain event');
select ok((
  select event_type = 'supplier_ownership.claim_submitted'
    and event_schema_version = 1
    and aggregate_type = 'supplier_ownership_claim'
    and aggregate_sequence = 1
    and producer_command_name = 'supplier_claim.submit'
    and producer_command_contract_version = 1
    and event_ordinal = 1
    and actor_kind = 'human_user'
    and actor_user_profile_id = 'a1000000-0000-4000-8000-000000000001'::uuid
    and environment_code = 'local'
    and producing_component_code = 'supplier_claim_command'
    and processing_status = 'pending'
  from internal.domain_events
  where aggregate_id = :'submitted_claim_id'::uuid
), 'domain event has the exact type, producer, actor, environment, sequence, and pending state');
select is((
  select payload
  from internal.domain_events
  where aggregate_id = :'submitted_claim_id'::uuid
), jsonb_build_object(
  'claim_id', :'submitted_claim_id'::uuid,
  'supplier_profile_id', '10000000-0000-4000-8000-000000000001'::uuid,
  'claimant_user_profile_id', 'a1000000-0000-4000-8000-000000000001'::uuid,
  'claim_version', 1
), 'event payload contains only the approved identity and version fields');
select is((
  select correlation_id
  from internal.domain_events
  where aggregate_id = :'submitted_claim_id'::uuid
), '50000000-0000-4000-8000-000000000001'::uuid, 'caller correlation UUID is propagated exactly');
select ok((
  select payload::text !~ 'authorized company|verification evidence|claimant@example|\\+9647|idempotency|firebase'
  from internal.domain_events
  where aggregate_id = :'submitted_claim_id'::uuid
), 'event payload excludes private reason, evidence, contact, idempotency, and provider data');

select is((
  select count(*)
  from internal.idempotency_keys
  where command_name = 'supplier_claim.submit'
    and result_resource_id = :'submitted_claim_id'::uuid
), 1::bigint, 'submit creates exactly one idempotency record');
select ok((
  select command_contract_version = 1
    and environment_code = 'local'
    and principal_kind = 'human_user'
    and principal_user_profile_id = 'a1000000-0000-4000-8000-000000000001'::uuid
    and target_aggregate_type = 'supplier_claim_slot'
    and target_aggregate_id is not null
    and octet_length(key_digest) = 32
    and key_digest_key_version = 'local_v1'
    and octet_length(request_fingerprint) = 32
    and request_fingerprint_key_version = 'local_v1'
    and status = 'completed'
    and lease_token_digest is null
    and outcome_code = 'submitted'
    and result_resource_type = 'supplier_ownership_claim'
    and result_version_token = '1'
    and completed_at is not null
    and expires_at - completed_at = interval '720 hours'
    and expires_at = :'submitted_expires_at'::timestamptz
  from internal.idempotency_keys
  where result_resource_id = :'submitted_claim_id'::uuid
), 'idempotency record has the exact namespace, digest versions, terminal result, and replay window');
select is((select count(*) from internal.audit_logs), 0::bigint, 'ordinary submit writes no durable audit row');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.submit(
  'claim-40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '  I am the authorized company representative.  ',
  'claim_evidence_v1',
  '[{"summary":"Company email verification evidence.","kind":"company_domain_email","reference_url":"https://Example.test/about"}]'::jsonb,
  null,
  '50000000-0000-4000-8000-000000000099'
) \gset replay_
commit;
reset role;

select is(:'replay_claim_id'::uuid, :'submitted_claim_id'::uuid, 'replay returns the original Claim ID');
select is(:'replay_submitted_at'::timestamptz, :'submitted_submitted_at'::timestamptz, 'replay returns the original submitted timestamp');
select is(:'replay_expires_at'::timestamptz, :'submitted_expires_at'::timestamptz, 'replay returns the original expiry');
select ok(:'replay_idempotent_replay'::boolean, 'repeated equivalent request is marked as replay');
select is((
  select count(*)
  from public.supplier_ownership_claims
  where id = :'submitted_claim_id'::uuid
), 1::bigint, 'replay creates no duplicate Claim');
select is((
  select count(*)
  from internal.domain_events
  where aggregate_id = :'submitted_claim_id'::uuid
), 1::bigint, 'replay creates no duplicate event');
select is((
  select count(*)
  from internal.idempotency_keys
  where result_resource_id = :'submitted_claim_id'::uuid
), 1::bigint, 'replay creates no duplicate idempotency row');
select is((select count(*) from internal.audit_logs), 0::bigint, 'replay still writes no durable audit row');

begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'I am submitting materially different authorized evidence.',
    'claim_evidence_v1',
    '[]'::jsonb
  )$$,
  'P5108',
  'idempotency_key_conflict',
  'same idempotency key with a different request fails closed'
);
rollback;

\set ON_ERROR_STOP off
set role anon;
select * from supplier_claim.submit(
  'claim-40000000-0000-4000-8000-000000000090',
  '10000000-0000-4000-8000-000000000005',
  'Authorized representative evidence for review.',
  'claim_evidence_v1'
);
\set anon_submit_sqlstate :SQLSTATE
reset role;
set role authenticated;
select * from supplier_claim.submit(
  'claim-40000000-0000-4000-8000-000000000091',
  '10000000-0000-4000-8000-000000000005',
  'Authorized representative evidence for review.',
  'claim_evidence_v1'
);
\set authenticated_submit_sqlstate :SQLSTATE
reset role;
set role service_role;
select * from supplier_claim.submit(
  'claim-40000000-0000-4000-8000-000000000092',
  '10000000-0000-4000-8000-000000000005',
  'Authorized representative evidence for review.',
  'claim_evidence_v1'
);
\set service_submit_sqlstate :SQLSTATE
reset role;
set role mujahiz_claim_runtime;
insert into public.supplier_ownership_claims (
  claimant_user_profile_id, supplier_profile_id, expires_at,
  submitted_reason, claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors
)
values (
  'a1000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000006',
  pg_catalog.statement_timestamp() + interval '720 hours',
  'Unauthorized direct runtime insert must fail.',
  'claimant_snapshot_v1', '{}'::jsonb,
  'claim_submit_v1', repeat('0',64),
  'claim_evidence_v1', '[]'::jsonb
);
\set runtime_insert_sqlstate :SQLSTATE
reset role;
\set ON_ERROR_STOP on

select is(:'anon_submit_sqlstate'::text, '42501', 'anon cannot invoke submit');
select is(:'authenticated_submit_sqlstate'::text, '42501', 'authenticated cannot invoke submit');
select is(:'service_submit_sqlstate'::text, '42501', 'service_role cannot invoke submit');
select is(:'runtime_insert_sqlstate'::text, '42501', 'runtime cannot bypass the command with a direct Claim insert');

select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000080',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5100',
  'claim_context_invalid',
  'missing trusted context fails closed'
);

begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000081',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5100',
  'claim_context_invalid',
  'missing HMAC key fails closed'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select pg_catalog.set_config('mujahiz.claim.purpose', 'wrong_purpose', true) \gset
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000082',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5100',
  'claim_context_invalid',
  'wrong-bound principal context fails closed'
);
rollback;
begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset

select throws_ok(
  $$select * from supplier_claim.submit(
    'not-a-valid-key',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5101', 'invalid_request',
  'malformed idempotency key is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000005',
    'too short',
    'claim_evidence_v1'
  )$$,
  'P5101', 'invalid_request',
  'submitted reason shorter than twenty characters is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000025',
    '10000000-0000-4000-8000-000000000005',
    repeat('r', 1201),
    'claim_evidence_v1'
  )$$,
  'P5101', 'invalid_request',
  'submitted reason above the approved character bound is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000026',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    jsonb_build_array(jsonb_build_object(
      'kind', 'other',
      'summary', repeat('s', 1601)
    ))
  )$$,
  'P5101', 'invalid_request',
  'evidence summary above the approved character bound is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v2'
  )$$,
  'P5102', 'unsupported_evidence_schema',
  'unsupported evidence schema is rejected explicitly'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '{}'::jsonb
  )$$,
  'P5101', 'invalid_request',
  'non-array evidence is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000013',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '[
      {"kind":"other","summary":"First bounded evidence descriptor."},
      {"kind":"other","summary":"Second bounded evidence descriptor."},
      {"kind":"other","summary":"Third bounded evidence descriptor."},
      {"kind":"other","summary":"Fourth bounded evidence descriptor."}
    ]'::jsonb
  )$$,
  'P5101', 'invalid_request',
  'more than three evidence descriptors is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000014',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '[{"kind":"raw_file","summary":"Unsupported raw file evidence descriptor."}]'::jsonb
  )$$,
  'P5102', 'unsupported_evidence_type',
  'unsupported evidence type is rejected explicitly'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000015',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '[{"kind":"other","summary":"Evidence with an unapproved generic field.","metadata":{"secret":"value"}}]'::jsonb
  )$$,
  'P5101', 'invalid_request',
  'generic evidence metadata is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000016',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '[{"kind":"company_website","summary":"Private network reference must be rejected.","reference_url":"https://127.0.0.1/proof"}]'::jsonb
  )$$,
  'P5101', 'invalid_request',
  'numeric private-network reference is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000017',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '[
      {"kind":"company_website","summary":"First duplicate public reference evidence.","reference_url":"https://Example.test/proof"},
      {"kind":"other","summary":"Second duplicate public reference evidence.","reference_url":"https://example.test/proof"}
    ]'::jsonb
  )$$,
  'P5101', 'invalid_request',
  'duplicate canonical evidence references are rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000018',
    '99999999-9999-4999-8999-999999999999',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5104', 'supplier_ineligible',
  'unknown Supplier is indistinguishable from an ineligible Supplier'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000019',
    '10000000-0000-4000-8000-000000000003',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5104', 'supplier_ineligible',
  'archived Supplier is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000020',
    '10000000-0000-4000-8000-000000000002',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5105', 'supplier_already_owned',
  'Supplier with an active primary controller is rejected'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5106', 'active_claim_exists',
  'same claimant and Supplier cannot create another active Claim'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000022',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for review.',
    'claim_evidence_v1',
    '[]'::jsonb,
    '29999999-9999-4999-8999-999999999999'
  )$$,
  'P5107', 'prior_claim_invalid',
  'unknown prior Claim is rejected without disclosure'
);
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000023',
    '10000000-0000-4000-8000-000000000004',
    'Previous evidence was not sufficient for review.',
    'claim_evidence_v1',
    '[{"kind":"other","summary":"Previous evidence summary for review."}]'::jsonb,
    '20000000-0000-4000-8000-000000000004'
  )$$,
  'P5107', 'prior_claim_invalid',
  'resubmission must contain materially changed reason or evidence'
);
rollback;

begin;
select claim_security.establish_claim_runtime_context(
  'c3000000-0000-4000-8000-000000000003'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000024',
    '10000000-0000-4000-8000-000000000006',
    'Authorized representative evidence for review.',
    'claim_evidence_v1'
  )$$,
  'P5103', 'claimant_ineligible',
  'profile without one usable primary Firebase link is ineligible'
);
rollback;

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.submit(
  'claim-40000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004',
  'New commercial registration evidence is now available.',
  'claim_evidence_v1',
  '[{"kind":"commercial_registration","summary":"Updated registration evidence for this supplier.","reference_url":"https://registry.example.test/company"}]'::jsonb,
  '20000000-0000-4000-8000-000000000004',
  null
) \gset prior_submit_
commit;
reset role;

select ok(not :'prior_submit_idempotent_replay'::boolean, 'valid material resubmission creates a new Claim');
select is((
  select prior_claim_id
  from public.supplier_ownership_claims
  where id = :'prior_submit_claim_id'::uuid
), '20000000-0000-4000-8000-000000000004'::uuid, 'valid resubmission preserves the approved prior-Claim link');
select is((
  select count(*)
  from public.supplier_ownership_claims
  where prior_claim_id = '20000000-0000-4000-8000-000000000004'
), 1::bigint, 'one prior Claim can have only the one created successor');
select is((
  select count(*)
  from internal.domain_events
  where aggregate_id = :'prior_submit_claim_id'::uuid
    and event_type = 'supplier_ownership.claim_submitted'
), 1::bigint, 'material resubmission emits exactly one claim_submitted event');
select is((select count(*) from internal.audit_logs), 0::bigint, 'material resubmission also writes no ordinary-submit audit');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select
  count(*) filter (where id = :'submitted_claim_id'::uuid)::text as first_count,
  count(*) filter (where id = :'prior_submit_claim_id'::uuid)::text as successor_count
from public.supplier_ownership_claims_claimant_v1 \gset current_claimant_
commit;
reset role;

select is(:'current_claimant_first_count'::bigint, 1::bigint, 'current claimant sees the first submitted Claim through the minimized projection');
select is(:'current_claimant_successor_count'::bigint, 1::bigint, 'current claimant sees the resubmitted Claim through the minimized projection');
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'b2000000-0000-4000-8000-000000000002'
);
select
  count(*) filter (where id = :'submitted_claim_id'::uuid)::text as first_count,
  count(*) filter (where id = :'prior_submit_claim_id'::uuid)::text as successor_count
from public.supplier_ownership_claims_claimant_v1 \gset other_claimant_
commit;
reset role;

select is(:'other_claimant_first_count'::bigint, 0::bigint, 'other claimant cannot project the first submitted Claim');
select is(:'other_claimant_successor_count'::bigint, 0::bigint, 'other claimant cannot project the resubmitted Claim');
with command_input as (
  select
    'claim-40000000-0000-4000-8000-000000000030'::text as raw_key,
    'a1000000-0000-4000-8000-000000000001'::uuid as principal_id,
    '10000000-0000-4000-8000-000000000005'::uuid as supplier_id,
    'Authorized representative evidence for in-progress test.'::text as reason,
    pg_catalog.clock_timestamp() as created_at
),
digests as (
  select
    command_input.*,
    extensions.hmac(
      pg_catalog.convert_to(
        'claim-idempotency-key-v1|local|supplier_claim.submit|1|'
          || pg_catalog.octet_length(raw_key)::text || ':' || raw_key,
        'UTF8'
      ),
      pg_catalog.convert_to(repeat('k', 32), 'UTF8'),
      'sha256'
    ) as key_digest,
    extensions.hmac(
      pg_catalog.convert_to(
        'claim-request-fingerprint-v1|' || pg_catalog.jsonb_build_object(
          'command_precondition_version', 'claim_submit_preconditions_v1',
          'supplier_profile_id', supplier_id,
          'submitted_reason', reason,
          'evidence_schema_version', 'claim_evidence_v1',
          'evidence_descriptors', '[]'::jsonb,
          'prior_claim_id', null
        )::text,
        'UTF8'
      ),
      pg_catalog.convert_to(repeat('k', 32), 'UTF8'),
      'sha256'
    ) as request_fingerprint,
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          'supplier-claim-slot-v1|' || principal_id::text || '|' || supplier_id::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) as slot_hex
  from command_input
)
insert into internal.idempotency_keys (
  command_name, command_contract_version, environment_code,
  principal_kind, principal_user_profile_id,
  target_aggregate_type, target_aggregate_id,
  key_digest, key_digest_key_version,
  request_fingerprint, request_fingerprint_key_version,
  status, lease_token_digest, lease_digest_key_version,
  lease_expires_at, attempt_count, created_at, expires_at
)
select
  'supplier_claim.submit', 1, 'local',
  'human_user', principal_id,
  'supplier_claim_slot',
  (
    pg_catalog.substr(slot_hex, 1, 8) || '-'
    || pg_catalog.substr(slot_hex, 9, 4) || '-5'
    || pg_catalog.substr(slot_hex, 14, 3) || '-8'
    || pg_catalog.substr(slot_hex, 18, 3) || '-'
    || pg_catalog.substr(slot_hex, 21, 12)
  )::uuid,
  key_digest, 'local_v1',
  request_fingerprint, 'local_v1',
  'processing',
  extensions.digest(pg_catalog.convert_to('synthetic-live-lease', 'UTF8'), 'sha256'),
  'local_v1',
  created_at + interval '60 seconds',
  1,
  created_at,
  created_at + interval '720 hours'
from digests;

begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000030',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for in-progress test.',
    'claim_evidence_v1'
  )$$,
  'P5109', 'command_in_progress',
  'unexpired matching lease reports bounded command-in-progress'
);
rollback;

select is((
  select attempt_count
  from internal.idempotency_keys
  where command_name = 'supplier_claim.submit'
    and principal_user_profile_id = 'a1000000-0000-4000-8000-000000000001'
    and status = 'processing'
    and lease_expires_at > pg_catalog.clock_timestamp()
), 1, 'in-progress response does not steal or increment a live lease');
select is((
  select count(*)
  from public.supplier_ownership_claims
  where supplier_profile_id = '10000000-0000-4000-8000-000000000005'
), 0::bigint, 'in-progress response creates no Claim');
select is((
  select count(*)
  from internal.domain_events
  where payload ->> 'supplier_profile_id' = '10000000-0000-4000-8000-000000000005'
), 0::bigint, 'in-progress response creates no event');

with command_input as (
  select
    'claim-40000000-0000-4000-8000-000000000031'::text as raw_key,
    'a1000000-0000-4000-8000-000000000001'::uuid as principal_id,
    '10000000-0000-4000-8000-000000000006'::uuid as supplier_id,
    'Authorized representative evidence for retry limit test.'::text as reason,
    pg_catalog.clock_timestamp() - interval '120 seconds' as created_at
),
digests as (
  select
    command_input.*,
    extensions.hmac(
      pg_catalog.convert_to(
        'claim-idempotency-key-v1|local|supplier_claim.submit|1|'
          || pg_catalog.octet_length(raw_key)::text || ':' || raw_key,
        'UTF8'
      ),
      pg_catalog.convert_to(repeat('k', 32), 'UTF8'),
      'sha256'
    ) as key_digest,
    extensions.hmac(
      pg_catalog.convert_to(
        'claim-request-fingerprint-v1|' || pg_catalog.jsonb_build_object(
          'command_precondition_version', 'claim_submit_preconditions_v1',
          'supplier_profile_id', supplier_id,
          'submitted_reason', reason,
          'evidence_schema_version', 'claim_evidence_v1',
          'evidence_descriptors', '[]'::jsonb,
          'prior_claim_id', null
        )::text,
        'UTF8'
      ),
      pg_catalog.convert_to(repeat('k', 32), 'UTF8'),
      'sha256'
    ) as request_fingerprint,
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          'supplier-claim-slot-v1|' || principal_id::text || '|' || supplier_id::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) as slot_hex
  from command_input
)
insert into internal.idempotency_keys (
  command_name, command_contract_version, environment_code,
  principal_kind, principal_user_profile_id,
  target_aggregate_type, target_aggregate_id,
  key_digest, key_digest_key_version,
  request_fingerprint, request_fingerprint_key_version,
  status, lease_token_digest, lease_digest_key_version,
  lease_expires_at, attempt_count, created_at, expires_at
)
select
  'supplier_claim.submit', 1, 'local',
  'human_user', principal_id,
  'supplier_claim_slot',
  (
    pg_catalog.substr(slot_hex, 1, 8) || '-'
    || pg_catalog.substr(slot_hex, 9, 4) || '-5'
    || pg_catalog.substr(slot_hex, 14, 3) || '-8'
    || pg_catalog.substr(slot_hex, 18, 3) || '-'
    || pg_catalog.substr(slot_hex, 21, 12)
  )::uuid,
  key_digest, 'local_v1',
  request_fingerprint, 'local_v1',
  'processing',
  extensions.digest(pg_catalog.convert_to('synthetic-expired-lease', 'UTF8'), 'sha256'),
  'local_v1',
  created_at + interval '60 seconds',
  10,
  created_at,
  created_at + interval '720 hours'
from digests;

begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000031',
    '10000000-0000-4000-8000-000000000006',
    'Authorized representative evidence for retry limit test.',
    'claim_evidence_v1'
  )$$,
  'P5110', 'retry_later',
  'expired lease at the bounded attempt limit reports retry-later'
);
rollback;

select is((
  select attempt_count
  from internal.idempotency_keys
  where command_name = 'supplier_claim.submit'
    and principal_user_profile_id = 'a1000000-0000-4000-8000-000000000001'
    and status = 'processing'
    and lease_expires_at < pg_catalog.clock_timestamp()
), 10, 'retry-limit response does not increment beyond the bounded attempt count');
select is((
  select count(*)
  from public.supplier_ownership_claims
  where supplier_profile_id = '10000000-0000-4000-8000-000000000006'
), 0::bigint, 'retry-later response creates no Claim');

select count(*)::text as idempotency_count
from internal.idempotency_keys
where command_name = 'supplier_claim.submit'
  and principal_user_profile_id = 'a1000000-0000-4000-8000-000000000001'
\gset before_rollback_

create function pg_temp.reject_claim_submit_event()
returns trigger
language plpgsql
as $trigger$
begin
  if new.producer_command_name = 'supplier_claim.submit' then
    raise exception 'synthetic event persistence failure';
  end if;
  return new;
end
$trigger$;

create trigger claim_submit_event_failure_test
before insert on internal.domain_events
for each row execute function pg_temp.reject_claim_submit_event();

begin;
select claim_security.establish_claim_runtime_context(
  'a1000000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.submit(
    'claim-40000000-0000-4000-8000-000000000040',
    '10000000-0000-4000-8000-000000000005',
    'Authorized representative evidence for rollback test.',
    'claim_evidence_v1'
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'event persistence failure maps to the stable integrity error'
);
rollback;

drop trigger claim_submit_event_failure_test on internal.domain_events;
drop function pg_temp.reject_claim_submit_event();

select is((
  select count(*)
  from public.supplier_ownership_claims
  where supplier_profile_id = '10000000-0000-4000-8000-000000000005'
), 0::bigint, 'event failure rolls back the Claim insert');
select is((
  select count(*)
  from internal.domain_events
  where payload ->> 'supplier_profile_id' = '10000000-0000-4000-8000-000000000005'
), 0::bigint, 'event failure leaves no partial event');
select is((
  select count(*)
  from internal.idempotency_keys
  where command_name = 'supplier_claim.submit'
    and principal_user_profile_id = 'a1000000-0000-4000-8000-000000000001'
), :'before_rollback_idempotency_count'::bigint, 'event failure rolls back the idempotency reservation');
select is((select count(*) from internal.audit_logs), 0::bigint, 'all submit paths leave durable audit empty');

revoke mujahiz_claim_runtime from postgres granted by postgres;
select is((
  select m.admin_option::text || ':' || m.inherit_option::text || ':' || m.set_option::text
  from pg_catalog.pg_auth_members m
  where m.roleid = 'mujahiz_claim_runtime'::regrole
    and m.member = 'postgres'::regrole
), 'true:false:false', 'runtime behavior test restores the managed postgres membership');

delete from internal.domain_events
where actor_user_profile_id in (
  'a1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000003'
);
delete from internal.idempotency_keys
where principal_user_profile_id in (
  'a1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000003'
);
delete from public.supplier_ownership_claims
where id in (
  :'submitted_claim_id'::uuid,
  :'prior_submit_claim_id'::uuid
);
delete from public.supplier_ownership_claims
where id = '20000000-0000-4000-8000-000000000004';
delete from public.supplier_ownerships
where id = '30000000-0000-4000-8000-000000000002';
delete from internal.identity_provider_links
where user_profile_id in (
  'a1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002'
);
delete from public.supplier_profiles
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006'
);
delete from public.user_profiles
where id in (
  'a1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000003',
  'd4000000-0000-4000-8000-000000000004',
  'e5000000-0000-4000-8000-000000000005'
);

select is((select count(*) from public.supplier_ownership_claims), 0::bigint, 'no synthetic Claim persists after the submit test');
select is((select count(*) from internal.idempotency_keys), 0::bigint, 'no synthetic idempotency row persists after the submit test');
select is((select count(*) from internal.domain_events), 0::bigint, 'no synthetic event persists after the submit test');
select is((select count(*) from internal.audit_logs), 0::bigint, 'no audit row persists after the submit test');

select * from finish();