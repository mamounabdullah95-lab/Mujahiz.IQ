\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_catalog;

select plan(89);

select has_function(
  'supplier_claim',
  '_canonicalize_withdraw_request_v1',
  array['text','uuid','integer'],
  'private withdraw canonicalizer exists with exact semantic inputs'
);
select has_function(
  'supplier_claim',
  'reserve_withdraw',
  array['text','uuid','integer'],
  'phase-A withdraw reservation boundary exists'
);
select has_function(
  'supplier_claim',
  'withdraw',
  array['text','uuid','integer','uuid','uuid'],
  'phase-B withdraw executor exists with correlation and fence inputs'
);
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
), 6::bigint, 'command schema contains submit and withdraw implementation routines only');
select is((
  select pg_catalog.string_agg(p.proname, ',' order by p.proname)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
), '_canonicalize_submit_request_v1,_canonicalize_withdraw_request_v1,reserve_submit,reserve_withdraw,submit,withdraw', 'no other Claim business command is introduced');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and p.prosecdef
), 4::bigint, 'only reservation and phase-B boundaries are SECURITY DEFINER');
select ok(not (
  select p.prosecdef
  from pg_catalog.pg_proc p
  where p.oid = 'supplier_claim._canonicalize_withdraw_request_v1(text,uuid,integer)'::regprocedure
), 'withdraw canonicalizer is SECURITY INVOKER');
select is((
  select pg_catalog.string_agg(distinct r.rolname, ',' order by r.rolname)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_roles r on r.oid = p.proowner
  where n.nspname = 'supplier_claim'
), 'postgres', 'all Claim routines retain an explicit local trusted owner');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and p.proconfig @> array['search_path=pg_catalog']::text[]
), 6::bigint, 'all Claim routines fix search_path to pg_catalog');
select ok(
  pg_catalog.pg_get_function_identity_arguments(
    'supplier_claim.reserve_withdraw(text,uuid,integer)'::regprocedure
  ) !~ 'claimant|supplier|status|reviewer|reason|firebase|provider|hmac|correlation',
  'phase A exposes no caller-selected authority or observability input'
);
select ok(
  pg_catalog.pg_get_function_identity_arguments(
    'supplier_claim.withdraw(text,uuid,integer,uuid,uuid)'::regprocedure
  ) !~ 'claimant|supplier|status|reviewer|reason|firebase|provider|hmac',
  'phase B exposes no caller-selected claimant, Supplier, lifecycle, or provider input'
);
select is(
  pg_catalog.pg_get_function_result(
    'supplier_claim.withdraw(text,uuid,integer,uuid,uuid)'::regprocedure
  ),
  'TABLE(command text, command_contract_version integer, outcome_code text, claim_id uuid, claim_status text, claim_version integer, supplier_profile_id uuid, withdrawn_at timestamp with time zone, idempotent_replay boolean)',
  'withdraw returns the exact safe typed result envelope'
);
select ok(has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim.reserve_withdraw(text,uuid,integer)',
  'execute'
), 'runtime can execute the narrow phase-A withdraw boundary');
select ok(has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim.withdraw(text,uuid,integer,uuid,uuid)',
  'execute'
), 'runtime can execute the fenced phase-B withdraw boundary');
select ok(not has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim._canonicalize_withdraw_request_v1(text,uuid,integer)',
  'execute'
), 'runtime cannot call the digest-returning canonicalizer');
select ok(not exists (
  select 1
  from (values ('public'), ('anon'), ('authenticated'), ('service_role')) api_role(role_name)
  cross join lateral (values
    ('supplier_claim.reserve_withdraw(text,uuid,integer)'),
    ('supplier_claim.withdraw(text,uuid,integer,uuid,uuid)'),
    ('supplier_claim._canonicalize_withdraw_request_v1(text,uuid,integer)')
  ) routine(signature)
  where has_function_privilege(api_role.role_name, routine.signature, 'execute')
), 'PUBLIC and Supabase API roles cannot execute withdraw routines');
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
), 'runtime receives no direct protected-table mutation authority');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
), 1::bigint, 'Claim retains exactly one claimant self-select RLS policy');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
    and polcmd in ('a', 'w', 'd')
), 0::bigint, 'withdraw adds no mutation RLS policy');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal')
    and c.relkind in ('r', 'p')
), 22::bigint, 'withdraw adds no physical table');
select ok(not exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and p.proname in ('reserve_withdraw', 'withdraw')
    and pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) ~
      'insert into .*notifications|execute[[:space:]]'
), 'withdraw definers contain no notification write or dynamic SQL');
select ok(pg_catalog.to_regclass('public.notifications') is null, 'withdraw introduces no notification table');

insert into public.user_profiles (
  id, full_name, account_context, verification_mirror_status,
  verification_mirror_observed_at, display_email
)
values
  ('da100000-0000-4000-8000-000000000001', 'Withdraw Claimant A', 'supplier', 'verified', pg_catalog.statement_timestamp(), 'withdraw-a@example.test'),
  ('db200000-0000-4000-8000-000000000002', 'Withdraw Claimant B', 'supplier', 'verified', pg_catalog.statement_timestamp(), 'withdraw-b@example.test'),
  ('dc300000-0000-4000-8000-000000000003', 'Synthetic Reviewer', 'buyer', 'unknown', null, null);

insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject,
  is_primary, link_status, identity_status, verification_status,
  linked_at, provider_state_observed_at, verified_at
)
values
  ('da110000-0000-4000-8000-000000000001', 'da100000-0000-4000-8000-000000000001', 'firebase', 'synthetic-withdraw-a', true, 'linked', 'active', 'verified', pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()),
  ('db220000-0000-4000-8000-000000000002', 'db200000-0000-4000-8000-000000000002', 'firebase', 'synthetic-withdraw-b', true, 'linked', 'active', 'verified', pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp());

insert into public.supplier_profiles (
  id, name_original, display_name, name_language, name_en,
  business_type, listing_status, verification_status,
  source_type, confidence_level, has_direct_experience
)
select
  (
    'd' || pg_catalog.lpad(supplier_number::text, 7, '0')
    || '-0000-4000-8000-0000000000'
    || pg_catalog.lpad(supplier_number::text, 2, '0')
  )::uuid,
  'Withdraw Supplier ' || supplier_number,
  'Withdraw Supplier ' || supplier_number,
  'english',
  'Withdraw Supplier ' || supplier_number,
  'company', 'approved', 'verified', 'other', 'low', 'no'
from pg_catalog.generate_series(1, 13) as supplier_number;

insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id,
  establishment_source_type, establishment_reason_code,
  establishment_system_source
)
values (
  'de500000-0000-4000-8000-000000000005',
  'd0000005-0000-4000-8000-000000000005',
  'da100000-0000-4000-8000-000000000001',
  'claim_approval', 'synthetic_approved_claim', 'claim_test'
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
  evidence_verification_outcome_code, decision_authorization_policy_version, reviewer_notes,
  withdrawn_at, withdrawn_by_user_profile_id, withdrawal_reason_code,
  expired_at, expiry_system_source_code, expiry_policy_version,
  superseded_at, supersession_reason_code, prior_claim_id, superseded_by_claim_id,
  resulting_supplier_ownership_id, created_at, updated_at
)
values
  (
    'e1000000-0000-4000-8000-000000000001', 'da100000-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Synthetic submitted Claim for withdrawal.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('1',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
  ),
  (
    'e2000000-0000-4000-8000-000000000002', 'da100000-0000-4000-8000-000000000001', 'd0000002-0000-4000-8000-000000000002', 'under_review', 2,
    pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() + interval '718 hours', 'Synthetic under-review Claim for withdrawal.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('2',64), 'claim_evidence_v1', '[]'::jsonb,
    'dc300000-0000-4000-8000-000000000003', 1, pg_catalog.statement_timestamp() - interval '1 hour', 'dc300000-0000-4000-8000-000000000003', 'manual', 'claim_review_assignment_v1',
    null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() - interval '1 hour'
  ),
  (
    'e3000000-0000-4000-8000-000000000003', 'db200000-0000-4000-8000-000000000002', 'd0000003-0000-4000-8000-000000000003', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Synthetic other-claimant Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('3',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
  ),
  (
    'e4000000-0000-4000-8000-000000000004', 'da100000-0000-4000-8000-000000000001', 'd0000004-0000-4000-8000-000000000004', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '721 hours', pg_catalog.statement_timestamp() - interval '1 hour', 'Synthetic due Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('4',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '721 hours', pg_catalog.statement_timestamp() - interval '721 hours'
  ),
  (
    'e5000000-0000-4000-8000-000000000005', 'da100000-0000-4000-8000-000000000001', 'd0000005-0000-4000-8000-000000000005', 'approved', 3,
    pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() + interval '20 days', 'Synthetic approved terminal Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('5',64), 'claim_evidence_v1', '[]'::jsonb,
    'dc300000-0000-4000-8000-000000000003', 1, pg_catalog.statement_timestamp() - interval '9 days', 'dc300000-0000-4000-8000-000000000003', 'manual', 'claim_review_assignment_v1',
    'dc300000-0000-4000-8000-000000000003', pg_catalog.statement_timestamp() - interval '8 days', 'approved', 'manual_review', 'v1', 'verified', 'claim_decision_v1',
    null, null, null, null, null, null, null, null, null, null, null,
    'de500000-0000-4000-8000-000000000005', pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() - interval '8 days'
  ),
  (
    'e6000000-0000-4000-8000-000000000006', 'da100000-0000-4000-8000-000000000001', 'd0000006-0000-4000-8000-000000000006', 'rejected', 3,
    pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() + interval '20 days', 'Synthetic rejected terminal Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('6',64), 'claim_evidence_v1', '[]'::jsonb,
    'dc300000-0000-4000-8000-000000000003', 1, pg_catalog.statement_timestamp() - interval '9 days', 'dc300000-0000-4000-8000-000000000003', 'manual', 'claim_review_assignment_v1',
    'dc300000-0000-4000-8000-000000000003', pg_catalog.statement_timestamp() - interval '8 days', 'insufficient_evidence', 'manual_review', 'v1', 'insufficient', 'claim_decision_v1',
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() - interval '8 days'
  ),
  (
    'e7000000-0000-4000-8000-000000000007', 'da100000-0000-4000-8000-000000000001', 'd0000007-0000-4000-8000-000000000007', 'withdrawn', 2,
    pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() + interval '20 days', 'Synthetic withdrawn terminal Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('7',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '9 days', 'da100000-0000-4000-8000-000000000001', 'claimant_withdrawal', null, null, null, null, null, null,
    null, null, pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() - interval '9 days'
  ),
  (
    'e8000000-0000-4000-8000-000000000008', 'da100000-0000-4000-8000-000000000001', 'd0000008-0000-4000-8000-000000000008', 'expired', 2,
    pg_catalog.statement_timestamp() - interval '31 days', pg_catalog.statement_timestamp() - interval '1 day', 'Synthetic expired terminal Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('8',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, pg_catalog.statement_timestamp() - interval '1 day', 'claim_expiry_worker', 'claim_expiry_v1', null, null, null,
    null, null, pg_catalog.statement_timestamp() - interval '31 days', pg_catalog.statement_timestamp() - interval '1 day'
  ),
  (
    'e9000000-0000-4000-8000-000000000009', 'da100000-0000-4000-8000-000000000001', 'd0000009-0000-4000-8000-000000000009', 'superseded', 2,
    pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() + interval '20 days', 'Synthetic superseded terminal Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('9',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, pg_catalog.statement_timestamp() - interval '9 days', 'competing_claim_approved', null, 'e7000000-0000-4000-8000-000000000007',
    null, pg_catalog.statement_timestamp() - interval '10 days', pg_catalog.statement_timestamp() - interval '9 days'
  ),
  (
    'ea000000-0000-4000-8000-000000000010', 'da100000-0000-4000-8000-000000000001', 'd0000010-0000-4000-8000-000000000010', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Synthetic stale-version Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('a',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
  ),
  (
    'eb000000-0000-4000-8000-000000000011', 'da100000-0000-4000-8000-000000000001', 'd0000011-0000-4000-8000-000000000011', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Synthetic lease Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('b',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
  ),
  (
    'ec000000-0000-4000-8000-000000000012', 'da100000-0000-4000-8000-000000000001', 'd0000012-0000-4000-8000-000000000012', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Synthetic rollback Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('c',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
  ),
  (
    'ed000000-0000-4000-8000-000000000013', 'da100000-0000-4000-8000-000000000001', 'd0000013-0000-4000-8000-000000000013', 'submitted', 1,
    pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Synthetic completion rollback Claim.',
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('d',64), 'claim_evidence_v1', '[]'::jsonb,
    null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null,
    null, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
  );

grant mujahiz_claim_runtime to postgres with set true;
grant usage on schema extensions to mujahiz_claim_runtime;

set role mujahiz_claim_runtime;
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5100', 'claim_context_invalid',
  'phase A denies missing trusted context'
);
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5100', 'claim_context_invalid',
  'phase A denies missing HMAC context'
);
rollback;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'invalid-key', 'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5101', 'invalid_request',
  'phase A rejects malformed keys'
);
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000099',
    'e1000000-0000-4000-8000-000000000001', 0
  )$$,
  'P5101', 'invalid_request',
  'phase A rejects nonpositive expected versions'
);
rollback;
reset role;

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw(
  'claim-f0000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001', 1
) \gset submitted_reservation_
commit;
reset role;

select is(:'submitted_reservation_reservation_outcome'::text, 'execute', 'submitted Claim Phase A returns execute');
select ok(:'submitted_reservation_execution_fence'::uuid is not null, 'Phase A returns an opaque execution fence');
select ok((
  select status = 'processing'
    and attempt_count = 1
    and lease_token_digest is not null
    and octet_length(lease_token_digest) = 32
    and target_aggregate_type = 'supplier_ownership_claim'
    and target_aggregate_id = 'e1000000-0000-4000-8000-000000000001'::uuid
    and result_resource_id is null
  from internal.idempotency_keys
  where command_name = 'supplier_claim.withdraw'
    and target_aggregate_id = 'e1000000-0000-4000-8000-000000000001'
), 'Phase-A reservation is durable, fenced, and has no result');
select ok(not exists (
  select 1
  from internal.idempotency_keys
  where lease_token_digest::text like '%' || :'submitted_reservation_execution_fence' || '%'
), 'raw execution fence is absent from storage');
select is((select pg_catalog.count(*) from internal.domain_events where producer_command_name = 'supplier_claim.withdraw'), 0::bigint, 'Phase A creates no withdrawal event');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5109', 'command_in_progress',
  'committed live reservation reports command_in_progress'
);
rollback;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.withdraw(
  'claim-f0000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001', 1,
  'fa000000-0000-4000-8000-000000000001',
  :'submitted_reservation_execution_fence'::uuid
) \gset submitted_withdraw_
commit;
reset role;

select is(:'submitted_withdraw_command'::text, 'supplier_claim.withdraw', 'success envelope names withdraw');
select is(:'submitted_withdraw_outcome_code'::text, 'withdrawn', 'submitted Claim transitions to withdrawn');
select is(:'submitted_withdraw_claim_version'::integer, 2, 'submitted Claim version increments exactly once');
select ok(not :'submitted_withdraw_idempotent_replay'::boolean, 'first withdrawal is not a replay');
select ok((
  select status = 'withdrawn'
    and record_version = 2
    and withdrawn_at = :'submitted_withdraw_withdrawn_at'::timestamptz
    and withdrawn_by_user_profile_id = 'da100000-0000-4000-8000-000000000001'::uuid
    and withdrawal_reason_code = 'claimant_withdrawal'
    and updated_at = withdrawn_at
    and withdrawn_at < expires_at
  from public.supplier_ownership_claims
  where id = 'e1000000-0000-4000-8000-000000000001'
), 'submitted withdrawal persists trusted status, actor, reason, time, and version');
select ok((
  select event_type = 'supplier_ownership.claim_withdrawn'
    and event_schema_version = 1
    and aggregate_type = 'supplier_ownership_claim'
    and aggregate_sequence = 2
    and producer_command_name = 'supplier_claim.withdraw'
    and producer_command_contract_version = 1
    and event_ordinal = 1
    and actor_user_profile_id = 'da100000-0000-4000-8000-000000000001'::uuid
    and occurred_at = :'submitted_withdraw_withdrawn_at'::timestamptz
    and persisted_at = occurred_at
    and available_at = occurred_at
    and payload = pg_catalog.jsonb_build_object(
      'claim_id', 'e1000000-0000-4000-8000-000000000001'::uuid,
      'supplier_profile_id', 'd0000001-0000-4000-8000-000000000001'::uuid,
      'claimant_user_profile_id', 'da100000-0000-4000-8000-000000000001'::uuid,
      'claim_version', 2
    )
  from internal.domain_events
  where aggregate_id = 'e1000000-0000-4000-8000-000000000001'
    and aggregate_sequence = 2
), 'withdrawal creates the exact minimized version-1 event');
select ok((
  select status = 'completed'
    and outcome_code = 'withdrawn'
    and result_resource_type = 'supplier_ownership_claim'
    and result_resource_id = 'e1000000-0000-4000-8000-000000000001'::uuid
    and result_version_token = '2'
    and completed_at = :'submitted_withdraw_withdrawn_at'::timestamptz
    and lease_token_digest is null
  from internal.idempotency_keys
  where command_name = 'supplier_claim.withdraw'
    and target_aggregate_id = 'e1000000-0000-4000-8000-000000000001'
), 'Claim, event, and exact fenced completion commit together');
select is((select pg_catalog.count(*) from internal.audit_logs), 0::bigint, 'ordinary successful withdrawal writes no audit row');

select
  reviewer_user_profile_id::text as reviewer,
  reviewer_assignment_version::text as assignment_version,
  reviewer_assigned_at::text as assigned_at,
  reviewer_assigned_by_user_profile_id::text as assigned_by,
  reviewer_assignment_source_code as assignment_source,
  reviewer_assignment_policy_version as assignment_policy
from public.supplier_ownership_claims
where id = 'e2000000-0000-4000-8000-000000000002'
\gset under_review_before_

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw(
  'claim-f0000000-0000-4000-8000-000000000002',
  'e2000000-0000-4000-8000-000000000002', 2
) \gset review_reservation_
commit;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.withdraw(
  'claim-f0000000-0000-4000-8000-000000000002',
  'e2000000-0000-4000-8000-000000000002', 2, null,
  :'review_reservation_execution_fence'::uuid
) \gset review_withdraw_
commit;
reset role;

select is(:'review_withdraw_claim_status'::text, 'withdrawn', 'under_review Claim transitions to withdrawn');
select is(:'review_withdraw_claim_version'::integer, 3, 'under_review Claim version increments exactly once');
select ok((
  select reviewer_user_profile_id::text = :'under_review_before_reviewer'
    and reviewer_assignment_version::text = :'under_review_before_assignment_version'
    and reviewer_assigned_at::text = :'under_review_before_assigned_at'
    and reviewer_assigned_by_user_profile_id::text = :'under_review_before_assigned_by'
    and reviewer_assignment_source_code = :'under_review_before_assignment_source'
    and reviewer_assignment_policy_version = :'under_review_before_assignment_policy'
  from public.supplier_ownership_claims
  where id = 'e2000000-0000-4000-8000-000000000002'
), 'under_review withdrawal retains every reviewer-assignment provenance field');
select is((
  select pg_catalog.count(*)
  from internal.domain_events
  where aggregate_id = 'e2000000-0000-4000-8000-000000000002'
    and event_type = 'supplier_ownership.claim_withdrawn'
), 1::bigint, 'under_review withdrawal creates exactly one withdrawal event');
select is((select pg_catalog.count(*) from internal.audit_logs), 0::bigint, 'both ordinary successful withdrawals write zero audits');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select status, claimant_result_code, record_version, withdrawn_at
from public.supplier_ownership_claims_claimant_v1
where id = 'e2000000-0000-4000-8000-000000000002'
\gset own_projection_
commit;
begin;
select claim_security.establish_claim_runtime_context('db200000-0000-4000-8000-000000000002');
select pg_catalog.count(*)::text as count
from public.supplier_ownership_claims_claimant_v1
where id = 'e2000000-0000-4000-8000-000000000002'
\gset other_projection_
commit;
reset role;

select ok(
  :'own_projection_status'::text = 'withdrawn'
  and :'own_projection_claimant_result_code'::text = 'withdrawn'
  and :'own_projection_record_version'::integer = 3
  and :'own_projection_withdrawn_at'::timestamptz = :'review_withdraw_withdrawn_at'::timestamptz,
  'claimant self-read returns the committed withdrawn state'
);
select is(:'other_projection_count'::bigint, 0::bigint, 'other claimant cannot read withdrawn Claim');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw(
  'claim-f0000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001', 1
) \gset replay_
commit;
reset role;

select is(:'replay_reservation_outcome'::text, 'replay', 'completed same-key request returns replay');
select ok(
  :'replay_claim_id'::uuid = 'e1000000-0000-4000-8000-000000000001'::uuid
  and :'replay_claim_status'::text = 'withdrawn'
  and :'replay_claim_version'::integer = 2
  and :'replay_withdrawn_at'::timestamptz = :'submitted_withdraw_withdrawn_at'::timestamptz
  and :'replay_idempotent_replay'::boolean,
  'replay returns the immutable original withdrawal result'
);
select is((
  select pg_catalog.count(*)
  from internal.domain_events
  where aggregate_id = 'e1000000-0000-4000-8000-000000000001'
    and event_type = 'supplier_ownership.claim_withdrawn'
), 1::bigint, 'replay creates no duplicate event');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw(
  'claim-f0000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001', 2
) \gset conflict_
commit;
reset role;

select is(:'conflict_reservation_outcome'::text, 'idempotency_key_conflict', 'same key with changed expected version conflicts deterministically');
select is((
  select pg_catalog.count(*)
  from internal.audit_logs
  where action_code = 'supplier_claim.withdraw'
    and outcome_class = 'conflicted'
    and result_code = 'idempotency_key_conflict'
    and actor_user_profile_id = 'da100000-0000-4000-8000-000000000001'
    and target_id = 'e1000000-0000-4000-8000-000000000001'
), 1::bigint, 'post-auth key-binding conflict writes one minimized durable audit');
select ok((
  select safe_context is null
    and evidence_digest is null
    and target_external_reference is null
    and actor_authorization_snapshot is null
  from internal.audit_logs
  where action_code = 'supplier_claim.withdraw'
), 'conflict audit contains no request, fingerprint, evidence, or prior-result detail');

begin;
update internal.idempotency_keys
set result_version_token = '99'
where command_name = 'supplier_claim.withdraw'
  and target_aggregate_id = 'e1000000-0000-4000-8000-000000000001';
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'corrupt result-version binding fails closed'
);
reset role;
rollback;

begin;
update internal.idempotency_keys
set request_fingerprint = extensions.digest(pg_catalog.convert_to('corrupt', 'UTF8'), 'sha256')
where command_name = 'supplier_claim.withdraw'
  and target_aggregate_id = 'e1000000-0000-4000-8000-000000000001';
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw(
  'claim-f0000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001', 1
) \gset corrupt_fingerprint_
reset role;
rollback;
select is(:'corrupt_fingerprint_reservation_outcome'::text, 'idempotency_key_conflict', 'fingerprint mismatch never re-executes a completed command');

select id::text as id
from internal.idempotency_keys
where command_name = 'supplier_claim.withdraw'
  and target_aggregate_id = 'e1000000-0000-4000-8000-000000000001'
\gset submitted_idempotency_

begin;
delete from internal.domain_events
where producer_idempotency_key_id = :'submitted_idempotency_id'::uuid;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'missing producer event fails closed'
);
reset role;
rollback;

begin;
update internal.domain_events
set payload = pg_catalog.jsonb_set(payload, '{claim_version}', '99'::jsonb)
where producer_idempotency_key_id = :'submitted_idempotency_id'::uuid;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_withdraw(
    'claim-f0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001', 1
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'mismatched producer event fails closed'
);
reset role;
rollback;

-- Wrong claimant and unknown Claim use the same safe Phase-B result.
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000003', 'e3000000-0000-4000-8000-000000000003', 1) \gset wrong_res_
commit;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,1,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000003',
  'e3000000-0000-4000-8000-000000000003',
  :'wrong_res_execution_fence'
), 'P5111', 'claim_not_found', 'wrong claimant receives safe claim_not_found');
rollback;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000004', 'efffffff-ffff-4fff-8fff-ffffffffffff', 1) \gset unknown_res_
commit;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,1,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000004',
  'efffffff-ffff-4fff-8fff-ffffffffffff',
  :'unknown_res_execution_fence'
), 'P5111', 'claim_not_found', 'unknown Claim receives the same safe claim_not_found');
rollback;
reset role;

-- Expected-version, due, and every terminal state remain non-mutating.
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000010', 'ea000000-0000-4000-8000-000000000010', 2) \gset stale_res_
commit;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,2,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000010',
  'ea000000-0000-4000-8000-000000000010',
  :'stale_res_execution_fence'
), 'P5112', 'claim_version_conflict', 'stale expected version is a business conflict');
rollback;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000011', 'e4000000-0000-4000-8000-000000000004', 1) \gset due_res_
commit;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,1,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000011',
  'e4000000-0000-4000-8000-000000000004',
  :'due_res_execution_fence'
), 'P5114', 'claim_expired', 'due active Claim returns claim_expired');
rollback;
reset role;

select ok((
  select status = 'submitted' and record_version = 1 and expired_at is null and withdrawn_at is null
  from public.supplier_ownership_claims
  where id = 'e4000000-0000-4000-8000-000000000004'
), 'due Claim remains active for the future expiry command');
select is((
  select pg_catalog.count(*)
  from internal.domain_events
  where aggregate_id = 'e4000000-0000-4000-8000-000000000004'
), 0::bigint, 'due withdrawal creates no withdrawn or expired event');

-- A representative loop proves all five terminal states reject with the same actionability class.
create function pg_temp.assert_terminal_withdraw_denied(
  p_key text,
  p_claim_id uuid,
  p_version integer
)
returns boolean
language plpgsql
as $function$
declare
  v_fence uuid;
begin
  perform claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
  perform pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true);
  select execution_fence into v_fence
  from supplier_claim.reserve_withdraw(p_key, p_claim_id, p_version);
  begin
    perform * from supplier_claim.withdraw(p_key, p_claim_id, p_version, null, v_fence);
  exception when sqlstate 'P5113' then
    return true;
  end;
  return false;
end
$function$;

-- The helper is used only inside one test transaction; production adapters still require two commits.
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select ok(pg_temp.assert_terminal_withdraw_denied('claim-f0000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000005', 3), 'approved Claim never reopens');
select ok(pg_temp.assert_terminal_withdraw_denied('claim-f0000000-0000-4000-8000-000000000021', 'e6000000-0000-4000-8000-000000000006', 3), 'rejected Claim never reopens');
select ok(pg_temp.assert_terminal_withdraw_denied('claim-f0000000-0000-4000-8000-000000000022', 'e7000000-0000-4000-8000-000000000007', 2), 'withdrawn Claim never reopens');
select ok(pg_temp.assert_terminal_withdraw_denied('claim-f0000000-0000-4000-8000-000000000023', 'e8000000-0000-4000-8000-000000000008', 2), 'expired Claim never reopens');
select ok(pg_temp.assert_terminal_withdraw_denied('claim-f0000000-0000-4000-8000-000000000024', 'e9000000-0000-4000-8000-000000000009', 2), 'superseded Claim never reopens');
rollback;
drop function pg_temp.assert_terminal_withdraw_denied(text, uuid, integer);

-- Real committed lease/reclaim/fencing lifecycle for focused deterministic proof.
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000030', 'eb000000-0000-4000-8000-000000000011', 1) \gset lease_one_
commit;
reset role;
update internal.idempotency_keys
set lease_expires_at = pg_catalog.clock_timestamp() - interval '1 millisecond'
where command_name = 'supplier_claim.withdraw'
  and target_aggregate_id = 'eb000000-0000-4000-8000-000000000011';
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000030', 'eb000000-0000-4000-8000-000000000011', 1) \gset lease_two_
commit;
reset role;
select ok(:'lease_two_execution_fence'::uuid <> :'lease_one_execution_fence'::uuid, 'expired lease reclaim changes the opaque fence');
select is((
  select attempt_count from internal.idempotency_keys
  where command_name = 'supplier_claim.withdraw'
    and target_aggregate_id = 'eb000000-0000-4000-8000-000000000011'
), 2, 'reclaim durably increments the attempt');
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,1,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000030',
  'eb000000-0000-4000-8000-000000000011',
  :'lease_one_execution_fence'
), 'P5109', 'command_in_progress', 'stale fence is denied after reclaim');
rollback;
reset role;

-- Event failure rolls back Phase B but preserves the committed Phase-A reservation.
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000040', 'ec000000-0000-4000-8000-000000000012', 1) \gset rollback_res_
commit;
reset role;
create function pg_temp.reject_withdraw_event()
returns trigger language plpgsql as $trigger$
begin
  if new.producer_command_name = 'supplier_claim.withdraw' then
    raise exception 'synthetic withdraw event failure';
  end if;
  return new;
end
$trigger$;
create trigger withdraw_event_failure_test
before insert on internal.domain_events
for each row execute function pg_temp.reject_withdraw_event();
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,1,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000040',
  'ec000000-0000-4000-8000-000000000012',
  :'rollback_res_execution_fence'
), 'P5199', 'integrity_reconciliation_required', 'event failure rolls back Phase B');
rollback;
reset role;
drop trigger withdraw_event_failure_test on internal.domain_events;
drop function pg_temp.reject_withdraw_event();
select ok((
  select status = 'submitted' and record_version = 1 and withdrawn_at is null
  from public.supplier_ownership_claims
  where id = 'ec000000-0000-4000-8000-000000000012'
), 'event failure leaves Claim unchanged');
select is((
  select pg_catalog.count(*) from internal.domain_events
  where aggregate_id = 'ec000000-0000-4000-8000-000000000012'
), 0::bigint, 'event failure leaves no withdrawal event');
select ok((
  select status = 'processing' and attempt_count = 1 and outcome_code is null
  from internal.idempotency_keys
  where command_name = 'supplier_claim.withdraw'
    and target_aggregate_id = 'ec000000-0000-4000-8000-000000000012'
), 'event failure preserves the durable Phase-A reservation without completion');

-- Completion failure also rolls back Claim and event atomically.
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000041', 'ed000000-0000-4000-8000-000000000013', 1) \gset completion_res_
commit;
reset role;
create function pg_temp.reject_withdraw_completion()
returns trigger language plpgsql as $trigger$
begin
  if old.command_name = 'supplier_claim.withdraw' and new.status = 'completed' then
    raise exception 'synthetic withdraw completion failure';
  end if;
  return new;
end
$trigger$;
create trigger withdraw_completion_failure_test
before update on internal.idempotency_keys
for each row execute function pg_temp.reject_withdraw_completion();
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('da100000-0000-4000-8000-000000000001');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(pg_catalog.format(
  'select * from supplier_claim.withdraw(%L,%L::uuid,1,null,%L::uuid)',
  'claim-f0000000-0000-4000-8000-000000000041',
  'ed000000-0000-4000-8000-000000000013',
  :'completion_res_execution_fence'
), 'P5199', 'integrity_reconciliation_required', 'completion failure rolls back Phase B');
rollback;
reset role;
drop trigger withdraw_completion_failure_test on internal.idempotency_keys;
drop function pg_temp.reject_withdraw_completion();
select ok((
  select status = 'submitted' and record_version = 1 and withdrawn_at is null
  from public.supplier_ownership_claims
  where id = 'ed000000-0000-4000-8000-000000000013'
), 'completion failure leaves Claim unchanged');
select is((
  select pg_catalog.count(*) from internal.domain_events
  where aggregate_id = 'ed000000-0000-4000-8000-000000000013'
), 0::bigint, 'completion failure rolls back the inserted event');
select ok((
  select status = 'processing' and outcome_code is null
  from internal.idempotency_keys
  where command_name = 'supplier_claim.withdraw'
    and target_aggregate_id = 'ed000000-0000-4000-8000-000000000013'
), 'completion failure leaves reservation uncompleted');

\set ON_ERROR_STOP off
set role anon;
select * from supplier_claim.reserve_withdraw('claim-f0000000-0000-4000-8000-000000000090', 'ea000000-0000-4000-8000-000000000010', 1);
\set anon_reserve_sqlstate :SQLSTATE
reset role;
set role authenticated;
select * from supplier_claim.withdraw('claim-f0000000-0000-4000-8000-000000000090', 'ea000000-0000-4000-8000-000000000010', 1, null, 'ff000000-0000-4000-8000-000000000090');
\set authenticated_withdraw_sqlstate :SQLSTATE
reset role;
set role service_role;
select * from supplier_claim.withdraw('claim-f0000000-0000-4000-8000-000000000090', 'ea000000-0000-4000-8000-000000000010', 1, null, 'ff000000-0000-4000-8000-000000000090');
\set service_withdraw_sqlstate :SQLSTATE
reset role;
set role mujahiz_claim_runtime;
update public.supplier_ownership_claims set status = 'withdrawn' where id = 'ea000000-0000-4000-8000-000000000010';
\set runtime_update_sqlstate :SQLSTATE
reset role;
\set ON_ERROR_STOP on

select is(:'anon_reserve_sqlstate'::text, '42501', 'anon cannot reserve withdrawal');
select is(:'authenticated_withdraw_sqlstate'::text, '42501', 'authenticated cannot call withdraw');
select is(:'service_withdraw_sqlstate'::text, '42501', 'service_role cannot call withdraw');
select is(:'runtime_update_sqlstate'::text, '42501', 'runtime cannot directly UPDATE Claim');

select ok(not exists (
  select 1 from public.supplier_ownership_claims claim_row
  where claim_row::text like '%' || repeat('k', 32) || '%'
) and not exists (
  select 1 from internal.idempotency_keys idempotency_row
  where idempotency_row::text like '%' || repeat('k', 32) || '%'
) and not exists (
  select 1 from internal.domain_events event_row
  where event_row::text like '%' || repeat('k', 32) || '%'
) and not exists (
  select 1 from internal.audit_logs audit_row
  where audit_row::text like '%' || repeat('k', 32) || '%'
), 'HMAC secret is absent from Claim, idempotency, event, and audit rows');

revoke usage on schema extensions from mujahiz_claim_runtime;
revoke mujahiz_claim_runtime from postgres granted by postgres;
select is((
  select m.admin_option::text || ':' || m.inherit_option::text || ':' || m.set_option::text
  from pg_catalog.pg_auth_members m
  where m.roleid = 'mujahiz_claim_runtime'::regrole
    and m.member = 'postgres'::regrole
), 'true:false:false', 'focused withdraw test restores managed runtime membership');

delete from internal.audit_logs
where actor_user_profile_id in (
  'da100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000002'
);
delete from internal.domain_events
where actor_user_profile_id in (
  'da100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000002'
);
delete from internal.idempotency_keys
where principal_user_profile_id in (
  'da100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000002'
);
delete from public.supplier_ownership_claims
where claimant_user_profile_id in (
  'da100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000002'
);
delete from public.supplier_ownerships
where id = 'de500000-0000-4000-8000-000000000005';
delete from internal.identity_provider_links
where user_profile_id in (
  'da100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000002'
);
delete from public.supplier_profiles
where id::text like 'd%';
delete from public.user_profiles
where id in (
  'da100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000002',
  'dc300000-0000-4000-8000-000000000003'
);

select is((select pg_catalog.count(*) from public.supplier_ownership_claims), 0::bigint, 'no synthetic Claim persists after withdraw test');
select is((select pg_catalog.count(*) from internal.idempotency_keys), 0::bigint, 'no synthetic idempotency row persists after withdraw test');
select is((select pg_catalog.count(*) from internal.domain_events), 0::bigint, 'no synthetic event persists after withdraw test');
select is((select pg_catalog.count(*) from internal.audit_logs), 0::bigint, 'no synthetic audit row persists after withdraw test');

select * from finish();
