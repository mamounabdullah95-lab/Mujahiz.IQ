\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = internal, public, extensions, pg_catalog;

select plan(35);

select has_table('internal', 'audit_logs', 'audit_logs exists in the internal schema');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'internal.audit_logs'::regclass and attnum > 0 and not attisdropped),
  47::bigint,
  'audit_logs has the approved physical-column count'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'internal.audit_logs'::regclass and contype = 'f'),
  2::bigint,
  'audit_logs has only the approved restrictive actor and predecessor foreign keys'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'internal.audit_logs'::regclass and contype = 'f'
  ),
  'audit_logs_actor_user_profile_fk:FOREIGN KEY (actor_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|audit_logs_predecessor_audit_log_fk:FOREIGN KEY (predecessor_audit_log_id) REFERENCES audit_logs(id) ON DELETE RESTRICT',
  'audit_logs foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'internal.audit_logs'::regclass),
  6::bigint,
  'audit_logs has its primary key, legacy identity, and approved investigation indexes'
);
select ok(to_regclass('internal.audit_logs_legacy_source_identity_uk') is not null, 'unique legacy source identity index exists');
select ok(to_regclass('internal.audit_logs_actor_occurred_at_idx') is not null, 'actor and time investigation index exists');
select ok(to_regclass('internal.audit_logs_target_occurred_at_idx') is not null, 'target and time investigation index exists');
select ok(to_regclass('internal.audit_logs_action_occurred_at_idx') is not null, 'action and time investigation index exists');
select ok(to_regclass('internal.audit_logs_correlation_recorded_at_idx') is not null, 'correlation and record-time investigation index exists');
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'internal.audit_logs'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'audit_logs uses the qualified database UUIDv4 default'
);
select ok(obj_description('internal.audit_logs'::regclass) ilike '%not an outbox%', 'table comment preserves audit and event separation');
select ok(col_description('internal.audit_logs'::regclass, 27) ilike '%no internal.idempotency_keys%', 'idempotency reference comment preserves table separation');
select ok(col_description('internal.audit_logs'::regclass, 28) ilike '%no internal.domain_events%', 'event reference comment preserves table separation');
select is((select count(*) from internal.audit_logs), 0::bigint, 'migration creates no audit rows');
select ok(to_regclass('internal.idempotency_keys') is null, 'no idempotency table is created');
select ok(to_regclass('internal.domain_events') is null, 'no domain-event table is created');
select ok(to_regclass('internal.audit_log_writers') is null, 'no audit writer registry is created');

select ok(not has_table_privilege('anon', 'internal.audit_logs', 'select'), 'anon cannot select audit_logs');
select ok(not has_table_privilege('authenticated', 'internal.audit_logs', 'select'), 'authenticated cannot select audit_logs');
select ok(not has_table_privilege('service_role', 'internal.audit_logs', 'select'), 'service API role cannot select audit_logs');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'internal.audit_logs'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no audit_logs table privileges');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'internal.audit_logs'::regclass), false, 'audit_logs has no RLS enabled');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'internal.audit_logs'::regclass), 0::bigint, 'audit_logs has no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'internal.audit_logs'::regclass and not tgisinternal), 0::bigint, 'audit_logs has no trusted trigger or runtime mutation path');

create temporary table audit_log_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Audit Actor', 'buyer')
  returning id
)
insert into audit_log_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into internal.audit_logs (
    action_code, action_contract_version, action_class, actor_kind, actor_user_profile_id,
    target_entity_type, target_id, outcome_class, result_code, reason_code, correlation_id,
    audit_schema_version, action_evidence_schema_version, authorization_policy_version,
    producer_contract_version, minimization_policy_version, retention_class
  ) values (
    'supplier_ownership.decide_claim', 1, 'claim_ownership', 'human_user',
    (select id from audit_log_test_ids where name = 'actor'), 'supplier_profile', pg_catalog.gen_random_uuid(),
    'rejected', 'reviewer_conflict', 'reviewer_conflict', pg_catalog.gen_random_uuid(),
    'audit_v1', 'claim_decision_v1', 'claim_policy_v1', 'trusted_command_v1',
    'minimization_v1', 'claim_ownership_decision'
  ) returning id
)
insert into audit_log_test_ids (name, id) select 'rejected_attempt', id from inserted;

select is((select count(*) from internal.audit_logs), 1::bigint, 'one valid minimized synthetic audit row is accepted');
select ok((select id is not null from internal.audit_logs where id = (select id from audit_log_test_ids where name = 'rejected_attempt')), 'accepted audit row receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from internal.audit_logs where id = (select id from audit_log_test_ids where name = 'rejected_attempt')), 'generated audit identity is UUIDv4 with the RFC variant');
select ok((select occurred_at = recorded_at from internal.audit_logs where id = (select id from audit_log_test_ids where name = 'rejected_attempt')), 'default occurrence and record times are coherent within one insert statement');
select lives_ok($$ insert into internal.audit_logs (action_code, action_contract_version, action_class, actor_kind, actor_source_code, target_entity_type, target_external_reference, outcome_class, result_code, reason_code, correlation_id, audit_schema_version, action_evidence_schema_version, authorization_policy_version, producer_contract_version, minimization_policy_version, retention_class) values ('migration.reconcile', 2, 'migration_reconciliation', 'migration_operator', 'migration_service', 'migration_batch', 'synthetic-batch-ref', 'succeeded', 'reconciled', 'approved_batch', gen_random_uuid(), 'audit_v1', 'migration_evidence_v1', 'migration_policy_v1', 'migration_service_v2', 'minimization_v1', 'migration_reconciliation') $$, 'trusted migration source without a human profile is structurally supported');
select throws_ok($$ insert into internal.audit_logs (action_code, action_contract_version, action_class, actor_kind, target_entity_type, target_id, outcome_class, result_code, reason_code, correlation_id, audit_schema_version, action_evidence_schema_version, authorization_policy_version, producer_contract_version, minimization_policy_version, retention_class) values ('role.assign', 1, 'platform_privilege', 'human_user', 'user_profile', gen_random_uuid(), 'rejected', 'missing_actor', 'missing_actor', gen_random_uuid(), 'audit_v1', 'role_evidence_v1', 'role_policy_v1', 'role_command_v1', 'minimization_v1', 'privilege_security_authority') $$, null, 'human audit actor must use a provider-neutral profile');
select throws_ok($$ insert into internal.audit_logs (action_code, action_contract_version, action_class, actor_kind, actor_source_code, target_entity_type, target_id, target_external_reference, outcome_class, result_code, reason_code, correlation_id, audit_schema_version, action_evidence_schema_version, authorization_policy_version, producer_contract_version, minimization_policy_version, retention_class) values ('role.assign', 1, 'platform_privilege', 'trusted_service', 'role_service', 'user_profile', gen_random_uuid(), 'raw-ref', 'failed', 'invalid_target', 'invalid_target', gen_random_uuid(), 'audit_v1', 'role_evidence_v1', 'role_policy_v1', 'role_command_v1', 'minimization_v1', 'privilege_security_authority') $$, null, 'target uses exactly one opaque identifier form');
select throws_ok($$ insert into internal.audit_logs (action_code, action_contract_version, action_class, actor_kind, actor_source_code, target_entity_type, target_id, outcome_class, result_code, reason_code, correlation_id, audit_schema_version, action_evidence_schema_version, authorization_policy_version, producer_contract_version, minimization_policy_version, retention_class, predecessor_audit_log_id, correction_reason_code) values ('role.correct', 1, 'platform_privilege', 'trusted_service', 'role_service', 'user_profile', gen_random_uuid(), 'rejected', 'invalid_correction', 'invalid_correction', gen_random_uuid(), 'audit_v1', 'role_evidence_v1', 'role_policy_v1', 'role_command_v1', 'minimization_v1', 'privilege_security_authority', (select id from audit_log_test_ids where name = 'rejected_attempt'), 'synthetic_correction') $$, null, 'only corrected rows may link a predecessor audit record');
select lives_ok($$ insert into internal.audit_logs (action_code, action_contract_version, action_class, actor_kind, actor_source_code, target_entity_type, target_id, outcome_class, result_code, reason_code, correlation_id, audit_schema_version, action_evidence_schema_version, authorization_policy_version, producer_contract_version, minimization_policy_version, retention_class, predecessor_audit_log_id, correction_reason_code) values ('role.correct', 1, 'platform_privilege', 'trusted_service', 'role_service', 'user_profile', gen_random_uuid(), 'corrected', 'corrected_record', 'approved_correction', gen_random_uuid(), 'audit_v1', 'role_evidence_v1', 'role_policy_v1', 'role_command_v1', 'minimization_v1', 'privilege_security_authority', (select id from audit_log_test_ids where name = 'rejected_attempt'), 'synthetic_correction') $$, 'corrected audit row retains a restrictive predecessor link');
select throws_ok($$ insert into internal.audit_logs (action_code, action_contract_version, action_class, actor_kind, actor_source_code, target_entity_type, target_id, outcome_class, result_code, reason_code, safe_context_schema_version, safe_context, correlation_id, audit_schema_version, action_evidence_schema_version, authorization_policy_version, producer_contract_version, minimization_policy_version, retention_class) values ('role.assign', 1, 'platform_privilege', 'trusted_service', 'role_service', 'user_profile', gen_random_uuid(), 'failed', 'invalid_context', 'invalid_context', 'safe_context_v1', '[]'::jsonb, gen_random_uuid(), 'audit_v1', 'role_evidence_v1', 'role_policy_v1', 'role_command_v1', 'minimization_v1', 'privilege_security_authority') $$, null, 'safe context must be a bounded versioned JSON object');

select * from finish();

rollback;
