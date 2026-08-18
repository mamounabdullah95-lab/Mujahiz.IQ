\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_catalog;

select plan(67);

select has_schema('supplier_claim', 'trusted Supplier Claim command schema remains present');
select has_function(
  'supplier_claim',
  'reserve_submit',
  array['text','uuid','text','text','jsonb','uuid'],
  'phase-1 reserve/replay/reclaim boundary exists with exact semantic inputs'
);
select has_function(
  'supplier_claim',
  'submit',
  array['text','uuid','text','text','jsonb','uuid','uuid','uuid'],
  'phase-2 submit executor exists with the opaque execution fence'
);
select ok(
  pg_catalog.to_regprocedure('supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)') is null,
  'the one-transaction seven-argument submit entrypoint no longer exists'
);
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and (not :'claim_post_b4_replay'::boolean or p.proname in (
      '_canonicalize_submit_request_v1','reserve_submit','submit'))
), 3::bigint, 'command schema contains only canonicalization, reservation, and submit execution');
select is((
  select pg_catalog.string_agg(p.proname, ',' order by p.proname)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and (not :'claim_post_b4_replay'::boolean or p.proname in (
      '_canonicalize_submit_request_v1','reserve_submit','submit'))
), '_canonicalize_submit_request_v1,reserve_submit,submit', 'no other Claim command is introduced');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and p.prosecdef
    and (not :'claim_post_b4_replay'::boolean or p.proname in ('reserve_submit','submit'))
), 2::bigint, 'only the reservation and submit executor are SECURITY DEFINER');
select ok(not (
  select p.prosecdef
  from pg_catalog.pg_proc p
  where p.oid = 'supplier_claim._canonicalize_submit_request_v1(text,uuid,text,text,jsonb,uuid)'::regprocedure
), 'the private canonicalizer is SECURITY INVOKER');
select is((
  select pg_catalog.string_agg(distinct r.rolname, ',' order by r.rolname)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_roles r on r.oid = p.proowner
  where n.nspname = 'supplier_claim'
    and (not :'claim_post_b4_replay'::boolean or p.proname in (
      '_canonicalize_submit_request_v1','reserve_submit','submit'))
), case when :'claim_post_b4_replay'::boolean
    then 'mujahiz_claim_human_command_owner,postgres' else 'postgres' end,
  'all hotfix routines have an explicit trusted owner');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and p.proconfig @> array['search_path=pg_catalog']::text[]
    and (not :'claim_post_b4_replay'::boolean or p.proname in (
      '_canonicalize_submit_request_v1','reserve_submit','submit'))
), 3::bigint, 'all hotfix routines fix search_path to pg_catalog');
select ok(
  pg_catalog.pg_get_function_identity_arguments(
    'supplier_claim.reserve_submit(text,uuid,text,text,jsonb,uuid)'::regprocedure
  ) !~ 'claimant|hmac|firebase|provider',
  'reservation inputs expose no caller-selected claimant, HMAC, or provider identity'
);
select ok(
  pg_catalog.pg_get_function_identity_arguments(
    'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
  ) !~ 'claimant|hmac|firebase|provider',
  'submit inputs expose no caller-selected claimant, HMAC, or provider identity'
);
select is(
  pg_catalog.pg_get_function_result(
    'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
  ),
  'TABLE(command text, command_contract_version integer, outcome_code text, claim_id uuid, claim_status text, claim_version integer, supplier_profile_id uuid, submitted_at timestamp with time zone, expires_at timestamp with time zone, idempotent_replay boolean)',
  'phase-2 submit preserves the exact safe business-result envelope'
);
select ok(has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim.reserve_submit(text,uuid,text,text,jsonb,uuid)',
  'execute'
), 'runtime can execute only the narrow phase-1 boundary');
select ok(has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)',
  'execute'
), 'runtime can execute the fenced phase-2 submit executor');
select ok(not has_function_privilege(
  'mujahiz_claim_runtime',
  'supplier_claim._canonicalize_submit_request_v1(text,uuid,text,text,jsonb,uuid)',
  'execute'
), 'runtime cannot call the digest-returning canonicalizer directly');
select ok(not exists (
  select 1
  from (values ('public'), ('anon'), ('authenticated'), ('service_role')) api_role(role_name)
  cross join lateral (values
    ('supplier_claim.reserve_submit(text,uuid,text,text,jsonb,uuid)'),
    ('supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)'),
    ('supplier_claim._canonicalize_submit_request_v1(text,uuid,text,text,jsonb,uuid)')
  ) routine(signature)
  where has_function_privilege(api_role.role_name, routine.signature, 'execute')
), 'PUBLIC and Supabase API roles cannot execute any hotfix routine');
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
    and polcmd in ('a', 'w', 'd')
), case when :'claim_post_b4_replay'::boolean then 3 else 0 end::bigint,
  'Claim has the expected exact mutation-policy count');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal')
    and c.relkind in ('r', 'p')
), case when :'claim_post_b4_replay'::boolean then 24 else 22 end::bigint,
  'public/internal schemas have the expected exact physical-table count');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
), case when :'claim_post_b4_replay'::boolean then 10 else 1 end::bigint,
  'Claim has the expected exact policy count');
select ok(not exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim'
    and p.prosecdef
    and (not :'claim_post_b4_replay'::boolean or p.proname in ('reserve_submit','submit'))
    and pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) ~
      'insert into internal\.audit_logs|insert into .*notifications|execute[[:space:]]'
), 'definer routines contain no audit/notification write or dynamic SQL');
select ok(exists (
  select 1
  from pg_catalog.pg_class i
  join pg_catalog.pg_namespace n on n.oid = i.relnamespace
  join pg_catalog.pg_index x on x.indexrelid = i.oid
  join pg_catalog.pg_class t on t.oid = x.indrelid
  where n.nspname = 'public'
    and t.relname = 'supplier_ownership_claims'
    and i.relname = 'supplier_ownership_claims_one_active_pair_uidx'
    and x.indisunique
), 'the exact active-pair partial unique index identity remains present');

insert into public.user_profiles (
  id, full_name, account_context, verification_mirror_status,
  verification_mirror_observed_at, display_email, phone_number,
  job_title, legacy_organization
)
values
  (
    'aa100000-0000-4000-8000-000000000001',
    'Hotfix Claimant A', 'supplier', 'verified',
    pg_catalog.statement_timestamp(), 'claimant-a@example.test', '+9647000000011',
    'Director', 'Hotfix Organization A'
  ),
  (
    'bb200000-0000-4000-8000-000000000002',
    'Hotfix Claimant B', 'supplier', 'verified',
    pg_catalog.statement_timestamp(), 'claimant-b@example.test', null,
    null, null
  );

insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject,
  is_primary, link_status, identity_status, verification_status,
  linked_at, provider_state_observed_at, verified_at
)
values
  (
    'aa110000-0000-4000-8000-000000000001',
    'aa100000-0000-4000-8000-000000000001',
    'firebase', 'synthetic-hotfix-claimant-a', true, 'linked', 'active', 'verified',
    pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
  ),
  (
    'bb220000-0000-4000-8000-000000000002',
    'bb200000-0000-4000-8000-000000000002',
    'firebase', 'synthetic-hotfix-claimant-b', true, 'linked', 'active', 'verified',
    pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
  );

insert into public.supplier_profiles (
  id, name_original, display_name, name_language, name_en,
  business_type, listing_status, verification_status,
  source_type, confidence_level, has_direct_experience
)
values
  ('11000000-0000-4000-8000-000000000001', 'Replay Supplier', 'Replay Supplier', 'english', 'Replay Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('11000000-0000-4000-8000-000000000002', 'Lease Supplier', 'Lease Supplier', 'english', 'Lease Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('11000000-0000-4000-8000-000000000003', 'Fault Supplier', 'Fault Supplier', 'english', 'Fault Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no');

grant mujahiz_claim_runtime to postgres with set true;
grant usage on schema extensions to mujahiz_claim_runtime;

set role mujahiz_claim_runtime;
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[]'::jsonb,
    null
  )$$,
  'P5100', 'claim_context_invalid',
  'phase 1 denies missing trusted principal context'
);
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[]'::jsonb,
    null
  )$$,
  'P5100', 'claim_context_invalid',
  'phase 1 denies missing transaction-local HMAC context'
);
rollback;

begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '  Authorized representative evidence for replay verification.  ',
  'claim_evidence_v1',
  '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
  null
) \gset first_reservation_
commit;
reset role;

select is(:'first_reservation_reservation_outcome'::text, 'execute', 'new phase-1 call returns execute');
select ok(:'first_reservation_execution_fence'::uuid is not null, 'new phase-1 call returns an opaque execution fence');
select ok((
  select status = 'processing'
    and attempt_count = 1
    and lease_token_digest is not null
    and octet_length(lease_token_digest) = 32
    and lease_expires_at > created_at
    and result_resource_id is null
  from internal.idempotency_keys
  where command_name = 'supplier_claim.submit'
    and principal_user_profile_id = 'aa100000-0000-4000-8000-000000000001'
), 'phase-1 commit durably stores one fenced processing attempt without a result');
select ok(not exists (
  select 1
  from internal.idempotency_keys
  where lease_token_digest::text like '%' || :'first_reservation_execution_fence' || '%'
), 'the raw execution fence is not persisted');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  pg_catalog.format(
    $sql$select * from supplier_claim.submit(
      'claim-a0000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001',
      'Authorized representative evidence for replay verification.',
      'claim_evidence_v1',
      '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
      null, null, %L::uuid
    )$sql$,
    'f0000000-0000-4000-8000-000000000001'
  ),
  'P5109', 'command_in_progress',
  'phase 2 rejects a fence that does not own the durable reservation'
);
rollback;

begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.submit(
  'claim-a0000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'Authorized representative evidence for replay verification.',
  'claim_evidence_v1',
  '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
  null,
  '51000000-0000-4000-8000-000000000001',
  :'first_reservation_execution_fence'::uuid
) \gset first_submit_
commit;
reset role;

select is(:'first_submit_outcome_code'::text, 'submitted', 'phase 2 returns submitted');
select ok(not :'first_submit_idempotent_replay'::boolean, 'phase 2 result is not a replay');
select is((
  select pg_catalog.count(*)
  from public.supplier_ownership_claims
  where id = :'first_submit_claim_id'::uuid
), 1::bigint, 'phase 2 inserts exactly one Claim');
select ok((
  select event_type = 'supplier_ownership.claim_submitted'
    and aggregate_type = 'supplier_ownership_claim'
    and aggregate_id = :'first_submit_claim_id'::uuid
    and aggregate_sequence = 1
    and producer_command_name = 'supplier_claim.submit'
    and producer_command_contract_version = 1
    and event_ordinal = 1
    and actor_user_profile_id = 'aa100000-0000-4000-8000-000000000001'
    and payload = pg_catalog.jsonb_build_object(
      'claim_id', :'first_submit_claim_id'::uuid,
      'supplier_profile_id', '11000000-0000-4000-8000-000000000001'::uuid,
      'claimant_user_profile_id', 'aa100000-0000-4000-8000-000000000001'::uuid,
      'claim_version', 1
    )
  from internal.domain_events
  where aggregate_id = :'first_submit_claim_id'::uuid
), 'phase 2 inserts the exact minimized ordinal-1 submit event');
select ok((
  select status = 'completed'
    and outcome_code = 'submitted'
    and result_resource_type = 'supplier_ownership_claim'
    and result_resource_id = :'first_submit_claim_id'::uuid
    and result_version_token = '1'
    and lease_token_digest is null
    and completed_at = :'first_submit_submitted_at'::timestamptz
    and expires_at = :'first_submit_expires_at'::timestamptz
  from internal.idempotency_keys
  where result_resource_id = :'first_submit_claim_id'::uuid
), 'Claim, event, and exact idempotency completion commit together');
select is((select pg_catalog.count(*) from internal.audit_logs), 0::bigint, 'ordinary submit still writes no durable audit row');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.count(*)::text as own_claim_count
from public.supplier_ownership_claims_claimant_v1
\gset claimant_a_
commit;
begin;
select claim_security.establish_claim_runtime_context(
  'bb200000-0000-4000-8000-000000000002'
);
select pg_catalog.count(*)::text as own_claim_count
from public.supplier_ownership_claims_claimant_v1
\gset claimant_b_
commit;
reset role;
select is(:'claimant_a_own_claim_count'::bigint, 1::bigint, 'claimant self-read still returns the submitted Claim');
select is(:'claimant_b_own_claim_count'::bigint, 0::bigint, 'another claimant still cannot read the Claim');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'Authorized representative evidence for replay verification.',
  'claim_evidence_v1',
  '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
  null
) \gset first_replay_
commit;
reset role;

select is(:'first_replay_reservation_outcome'::text, 'replay', 'completed phase 1 returns replay-ready state');
select is(:'first_replay_claim_id'::uuid, :'first_submit_claim_id'::uuid, 'completed replay returns the original Claim UUID');
select ok(
  :'first_replay_claim_status'::text = 'submitted'
  and :'first_replay_claim_version'::integer = 1
  and :'first_replay_idempotent_replay'::boolean,
  'completed replay returns the immutable submitted/version-1 result'
);
select ok(
  :'first_replay_submitted_at'::timestamptz = :'first_submit_submitted_at'::timestamptz
  and :'first_replay_expires_at'::timestamptz = :'first_submit_expires_at'::timestamptz,
  'completed replay returns the original immutable timestamps'
);
select ok((
  select pg_catalog.count(*) = 1
  from internal.domain_events
  where aggregate_id = :'first_submit_claim_id'::uuid
), 'completed replay creates no duplicate event');

update public.supplier_ownership_claims
set status = 'withdrawn',
    record_version = 2,
    withdrawn_at = submitted_at + interval '1 hour',
    withdrawn_by_user_profile_id = claimant_user_profile_id,
    withdrawal_reason_code = 'synthetic_hotfix_test',
    updated_at = submitted_at + interval '1 hour'
where id = :'first_submit_claim_id'::uuid;

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'Authorized representative evidence for replay verification.',
  'claim_evidence_v1',
  '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
  null
) \gset later_state_replay_
commit;
reset role;

select ok(
  :'later_state_replay_reservation_outcome'::text = 'replay'
  and :'later_state_replay_claim_id'::uuid = :'first_submit_claim_id'::uuid
  and :'later_state_replay_claim_status'::text = 'submitted'
  and :'later_state_replay_claim_version'::integer = 1,
  'later mutable Claim lifecycle state does not alter the original submit replay'
);
select ok(
  :'later_state_replay_submitted_at'::timestamptz = :'first_submit_submitted_at'::timestamptz
  and :'later_state_replay_expires_at'::timestamptz = :'first_submit_expires_at'::timestamptz,
  'later-state replay preserves the original submission timestamps'
);

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000001',
  'A different authorized submission after the earlier Claim became terminal.',
  'claim_evidence_v1',
  '[]'::jsonb,
  null
) \gset second_reservation_
commit;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.submit(
  'claim-a0000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000001',
  'A different authorized submission after the earlier Claim became terminal.',
  'claim_evidence_v1',
  '[]'::jsonb,
  null,
  null,
  :'second_reservation_execution_fence'::uuid
) \gset second_submit_
commit;
reset role;

select ok(
  :'second_submit_claim_id'::uuid <> :'first_submit_claim_id'::uuid
  and :'second_submit_claim_status'::text = 'submitted',
  'a later eligible same-pair submission has a distinct Claim result'
);

select id::text as id
from internal.idempotency_keys
where result_resource_id = :'first_submit_claim_id'::uuid
\gset first_idempotency_

begin;
update internal.idempotency_keys
set result_resource_id = :'second_submit_claim_id'::uuid
where id = :'first_idempotency_id'::uuid;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
    null
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'wrong same-pair result_resource_id binding fails closed'
);
reset role;
rollback;

begin;
update public.supplier_ownership_claims
set submission_fingerprint = repeat('f', 64)
where id = :'first_submit_claim_id'::uuid;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
    null
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'Claim submission fingerprint mismatch fails closed'
);
reset role;
rollback;

begin;
delete from internal.domain_events
where producer_idempotency_key_id = :'first_idempotency_id'::uuid;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
    null
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'missing ordinal-1 producer event fails closed'
);
reset role;
rollback;

begin;
update internal.domain_events
set payload = pg_catalog.jsonb_set(
  payload,
  '{supplier_profile_id}',
  pg_catalog.to_jsonb('11000000-0000-4000-8000-000000000099'::uuid)
)
where producer_idempotency_key_id = :'first_idempotency_id'::uuid;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
    null
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'mismatched producer-event payload fails closed'
);
reset role;
rollback;

begin;
insert into internal.domain_events (
  id, event_type, event_schema_version, aggregate_type, aggregate_id,
  aggregate_sequence, producer_command_name,
  producer_command_contract_version, producer_idempotency_key_id,
  source_system_code, event_ordinal, actor_kind, actor_user_profile_id,
  environment_code, producing_component_code, correlation_id,
  occurred_at, persisted_at, payload, processing_status, available_at
)
select
  pg_catalog.gen_random_uuid(), event_type, event_schema_version,
  aggregate_type, aggregate_id, 2,
  producer_command_name, producer_command_contract_version,
  producer_idempotency_key_id, source_system_code, 2,
  actor_kind, actor_user_profile_id, environment_code,
  producing_component_code, pg_catalog.gen_random_uuid(),
  occurred_at, persisted_at,
  pg_catalog.jsonb_set(payload, '{claim_version}', '2'::jsonb),
  'pending', available_at
from internal.domain_events
where producer_idempotency_key_id = :'first_idempotency_id'::uuid
  and event_ordinal = 1;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Authorized representative evidence for replay verification.',
    'claim_evidence_v1',
    '[{"summary":"Company website evidence for the Claim.","kind":"company_website","reference_url":"https://Example.test/about"}]'::jsonb,
    null
  )$$,
  'P5199', 'integrity_reconciliation_required',
  'contradictory duplicate producer event fails closed'
);
reset role;
rollback;

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000010',
  '11000000-0000-4000-8000-000000000002',
  'Authorized representative evidence for durable lease verification.',
  'claim_evidence_v1',
  '[]'::jsonb,
  null
) \gset lease_one_
commit;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  $$select * from supplier_claim.reserve_submit(
    'claim-a0000000-0000-4000-8000-000000000010',
    '11000000-0000-4000-8000-000000000002',
    'Authorized representative evidence for durable lease verification.',
    'claim_evidence_v1',
    '[]'::jsonb,
    null
  )$$,
  'P5109', 'command_in_progress',
  'another transaction sees the committed unexpired reservation immediately'
);
rollback;
reset role;

update internal.idempotency_keys
set lease_expires_at = pg_catalog.clock_timestamp() - interval '1 millisecond'
where command_name = 'supplier_claim.submit'
  and principal_user_profile_id = 'aa100000-0000-4000-8000-000000000001'
  and target_aggregate_id <> (
    select target_aggregate_id
    from internal.idempotency_keys
    where id = :'first_idempotency_id'::uuid
  )
  and status = 'processing';

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000010',
  '11000000-0000-4000-8000-000000000002',
  'Authorized representative evidence for durable lease verification.',
  'claim_evidence_v1',
  '[]'::jsonb,
  null
) \gset lease_two_
commit;
reset role;

select ok(
  :'lease_two_reservation_outcome'::text = 'execute'
  and :'lease_two_execution_fence'::uuid <> :'lease_one_execution_fence'::uuid,
  'expired reservation is reclaimed with a new opaque fence'
);
select is((
  select attempt_count
  from internal.idempotency_keys
  where status = 'processing'
    and principal_user_profile_id = 'aa100000-0000-4000-8000-000000000001'
    and target_aggregate_id <> (
      select target_aggregate_id
      from internal.idempotency_keys
      where id = :'first_idempotency_id'::uuid
    )
), 2, 'reclaim durably increments the attempt fence');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  pg_catalog.format(
    $sql$select * from supplier_claim.submit(
      'claim-a0000000-0000-4000-8000-000000000010',
      '11000000-0000-4000-8000-000000000002',
      'Authorized representative evidence for durable lease verification.',
      'claim_evidence_v1', '[]'::jsonb, null, null, %L::uuid
    )$sql$,
    :'lease_one_execution_fence'
  ),
  'P5109', 'command_in_progress',
  'stale phase-2 fence cannot execute after reclaim'
);
rollback;

begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.submit(
  'claim-a0000000-0000-4000-8000-000000000010',
  '11000000-0000-4000-8000-000000000002',
  'Authorized representative evidence for durable lease verification.',
  'claim_evidence_v1',
  '[]'::jsonb,
  null,
  null,
  :'lease_two_execution_fence'::uuid
) \gset lease_submit_
commit;
reset role;
select is(:'lease_submit_outcome_code'::text, 'submitted', 'current reclaimed fence can complete phase 2');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select *
from supplier_claim.reserve_submit(
  'claim-a0000000-0000-4000-8000-000000000020',
  '11000000-0000-4000-8000-000000000003',
  'Authorized representative evidence for durable rollback verification.',
  'claim_evidence_v1',
  '[]'::jsonb,
  null
) \gset fault_reservation_
commit;
reset role;

create function pg_temp.reject_hotfix_claim_submit_event()
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

create trigger claim_submit_hotfix_event_failure_test
before insert on internal.domain_events
for each row execute function pg_temp.reject_hotfix_claim_submit_event();

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context(
  'aa100000-0000-4000-8000-000000000001'
);
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true) \gset
select throws_ok(
  pg_catalog.format(
    $sql$select * from supplier_claim.submit(
      'claim-a0000000-0000-4000-8000-000000000020',
      '11000000-0000-4000-8000-000000000003',
      'Authorized representative evidence for durable rollback verification.',
      'claim_evidence_v1', '[]'::jsonb, null, null, %L::uuid
    )$sql$,
    :'fault_reservation_execution_fence'
  ),
  'P5199', 'integrity_reconciliation_required',
  'domain-event failure rolls back the phase-2 domain transaction'
);
rollback;
reset role;

drop trigger claim_submit_hotfix_event_failure_test on internal.domain_events;
drop function pg_temp.reject_hotfix_claim_submit_event();

select ok(
  (select pg_catalog.count(*) from public.supplier_ownership_claims where supplier_profile_id = '11000000-0000-4000-8000-000000000003') = 0
  and (select pg_catalog.count(*) from internal.domain_events where payload ->> 'supplier_profile_id' = '11000000-0000-4000-8000-000000000003') = 0,
  'domain failure leaves no partial Claim or event'
);
select ok((
  select status = 'processing'
    and attempt_count = 1
    and lease_token_digest is not null
  from internal.idempotency_keys
  where principal_user_profile_id = 'aa100000-0000-4000-8000-000000000001'
    and status = 'processing'
), 'domain failure does not erase the committed phase-1 reservation');

set role mujahiz_claim_runtime;
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'transaction-local principal context is absent after commit and rollback');
reset role;

select ok(not exists (
  select 1
  from public.supplier_ownership_claims claim_row
  where claim_row::text like '%' || repeat('k', 32) || '%'
) and not exists (
  select 1
  from internal.idempotency_keys idempotency_row
  where idempotency_row::text like '%' || repeat('k', 32) || '%'
) and not exists (
  select 1
  from internal.domain_events event_row
  where event_row::text like '%' || repeat('k', 32) || '%'
), 'HMAC secret is absent from Claim, idempotency, and event rows');
select is((select pg_catalog.count(*) from internal.audit_logs), 0::bigint, 'all hotfix paths preserve the ordinary-submit no-audit classification');

revoke usage on schema extensions from mujahiz_claim_runtime;
revoke mujahiz_claim_runtime from postgres granted by postgres;
select is((
  select m.admin_option::text || ':' || m.inherit_option::text || ':' || m.set_option::text
  from pg_catalog.pg_auth_members m
  where m.roleid = 'mujahiz_claim_runtime'::regrole
    and m.member = 'postgres'::regrole
), 'true:false:false', 'hotfix test restores the managed postgres membership');

delete from internal.domain_events
where actor_user_profile_id in (
  'aa100000-0000-4000-8000-000000000001',
  'bb200000-0000-4000-8000-000000000002'
);
delete from internal.idempotency_keys
where principal_user_profile_id in (
  'aa100000-0000-4000-8000-000000000001',
  'bb200000-0000-4000-8000-000000000002'
);
delete from public.supplier_ownership_claims
where claimant_user_profile_id in (
  'aa100000-0000-4000-8000-000000000001',
  'bb200000-0000-4000-8000-000000000002'
);
delete from internal.identity_provider_links
where user_profile_id in (
  'aa100000-0000-4000-8000-000000000001',
  'bb200000-0000-4000-8000-000000000002'
);
delete from public.supplier_profiles
where id in (
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000003'
);
delete from public.user_profiles
where id in (
  'aa100000-0000-4000-8000-000000000001',
  'bb200000-0000-4000-8000-000000000002'
);

select is((select pg_catalog.count(*) from public.supplier_ownership_claims), 0::bigint, 'no synthetic Claim persists after the hotfix test');
select is((select pg_catalog.count(*) from internal.idempotency_keys), 0::bigint, 'no synthetic idempotency row persists after the hotfix test');
select is((select pg_catalog.count(*) from internal.domain_events), 0::bigint, 'no synthetic event persists after the hotfix test');
select is((select pg_catalog.count(*) from internal.audit_logs), 0::bigint, 'no synthetic audit row persists after the hotfix test');

select * from finish();
