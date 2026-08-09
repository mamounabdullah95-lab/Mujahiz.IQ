\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_catalog;

select plan(52);

select ok(exists (
  select 1 from pg_catalog.pg_roles where rolname = 'mujahiz_claim_runtime'
), 'dedicated Claim runtime role exists');
select ok((
  select not rolcanlogin
    and not rolinherit
    and not rolsuper
    and not rolcreatedb
    and not rolcreaterole
    and not rolreplication
    and not rolbypassrls
    and rolconfig is null
  from pg_catalog.pg_roles
  where rolname = 'mujahiz_claim_runtime'
), 'Claim runtime role has exact fail-closed capability attributes');
select is((
  select string_agg(
    granted.rolname || ':' || member.rolname || ':'
      || m.admin_option || ':' || m.inherit_option || ':' || m.set_option,
    ',' order by granted.rolname, member.rolname
  )
  from pg_catalog.pg_auth_members m
  join pg_catalog.pg_roles granted on granted.oid = m.roleid
  join pg_catalog.pg_roles member on member.oid = m.member
  where m.roleid = 'mujahiz_claim_runtime'::regrole
     or m.member = 'mujahiz_claim_runtime'::regrole
), 'mujahiz_claim_runtime:postgres:true:false:false', 'only the Supabase-managed non-inheriting postgres administration membership exists');
select is((
  select count(*)
  from (
    select n.oid from pg_catalog.pg_namespace n where n.nspowner = 'mujahiz_claim_runtime'::regrole
    union all
    select c.oid from pg_catalog.pg_class c where c.relowner = 'mujahiz_claim_runtime'::regrole
    union all
    select p.oid from pg_catalog.pg_proc p where p.proowner = 'mujahiz_claim_runtime'::regrole
  ) owned_objects
), 0::bigint, 'Claim runtime role owns no schema, relation, or routine');
select ok((select rolpassword is null from pg_catalog.pg_authid where rolname = 'mujahiz_claim_runtime'), 'Claim runtime role has no password verifier');

select has_schema('claim_security', 'non-exposed Claim security schema exists');
select ok((select nspowner <> 'mujahiz_claim_runtime'::regrole from pg_catalog.pg_namespace where nspname = 'claim_security'), 'Claim runtime role does not own the security schema');
select ok(has_schema_privilege('mujahiz_claim_runtime', 'claim_security', 'usage'), 'Claim runtime role can resolve the narrow security helpers');
select ok(not has_schema_privilege('mujahiz_claim_runtime', 'claim_security', 'create'), 'Claim runtime role cannot create objects in the security schema');
select ok(not exists (
  select 1
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) acl
  where n.nspname = 'claim_security'
    and acl.grantee in (
      0,
      'anon'::regrole::oid,
      'authenticated'::regrole::oid,
      'service_role'::regrole::oid
    )
), 'PUBLIC and Supabase API roles have no Claim security schema privilege');
select ok(not has_schema_privilege('mujahiz_claim_runtime', 'internal', 'usage'), 'Claim runtime role has no generic internal schema access');

select has_function('claim_security', 'establish_claim_runtime_context', array['uuid'], 'transaction-local context setter exists');
select has_function('claim_security', 'current_claim_user_profile_id', array[]::text[], 'provider-neutral principal accessor exists');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
), 2::bigint, 'security schema contains only the two bounded context routines');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security' and not p.prosecdef
), 2::bigint, 'both context routines are SECURITY INVOKER');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
    and p.proconfig @> array['search_path=pg_catalog']::text[]
), 2::bigint, 'both context routines use the fixed pg_catalog search path');
select is((
  select string_agg(p.proname || ':' || p.provolatile::text, ',' order by p.proname)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
), 'current_claim_user_profile_id:s,establish_claim_runtime_context:v', 'setter and accessor volatility match their narrow responsibilities');
select is((
  select count(distinct p.proowner)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
    and p.proowner <> 'mujahiz_claim_runtime'::regrole
), 1::bigint, 'context routines share one non-runtime owner');
select ok(has_function_privilege('mujahiz_claim_runtime', 'claim_security.establish_claim_runtime_context(uuid)', 'execute'), 'Claim runtime role can establish its transaction context');
select ok(has_function_privilege('mujahiz_claim_runtime', 'claim_security.current_claim_user_profile_id()', 'execute'), 'Claim runtime role can resolve its transaction principal');
select ok(not exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
  where n.nspname = 'claim_security'
    and acl.privilege_type = 'EXECUTE'
    and acl.grantee in (
      0,
      'anon'::regrole::oid,
      'authenticated'::regrole::oid,
      'service_role'::regrole::oid
    )
), 'PUBLIC and Supabase API roles cannot execute Claim context routines');
select is((
  select pg_catalog.pg_get_function_identity_arguments(p.oid) || '->' || pg_catalog.format_type(p.prorettype, null)
  from pg_catalog.pg_proc p
  where p.oid = 'claim_security.establish_claim_runtime_context(uuid)'::regprocedure
), 'p_user_profile_id uuid->void', 'context setter accepts only one provider-neutral UUID');
select is((
  select pg_catalog.pg_get_function_identity_arguments(p.oid) || '->' || pg_catalog.format_type(p.prorettype, null)
  from pg_catalog.pg_proc p
  where p.oid = 'claim_security.current_claim_user_profile_id()'::regprocedure
), '->uuid', 'context accessor takes no caller identity and returns only UUID');
select is((
  select string_agg(distinct setting_match[1], ',' order by setting_match[1])
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_functiondef(p.oid),
    '''(mujahiz\.claim\.[a-z_]+)''',
    'g'
  ) setting_match
  where n.nspname = 'claim_security'
), 'mujahiz.claim.environment,mujahiz.claim.policy_version,mujahiz.claim.purpose,mujahiz.claim.transaction_id,mujahiz.claim.user_profile_id', 'context routines use only the five approved project-scoped settings');
select ok((
  select lower(string_agg(pg_catalog.pg_get_functiondef(p.oid), E'\n'))
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
) !~ 'firebase|provider_subject|provider_uid|email', 'context routines introduce no provider UID, subject, or email identity setting');

select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privilege(privilege_name)
  where n.nspname in ('public', 'internal')
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('mujahiz_claim_runtime', c.oid, privilege.privilege_name)
), 'Claim runtime role has no table or view privilege in public or internal');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral (values ('USAGE'), ('SELECT'), ('UPDATE')) privilege(privilege_name)
  where n.nspname in ('public', 'internal')
    and c.relkind = 'S'
    and has_sequence_privilege('mujahiz_claim_runtime', c.oid, privilege.privilege_name)
), 'Claim runtime role has no public or internal sequence privilege');
select ok(not exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'internal')
    and has_function_privilege('mujahiz_claim_runtime', p.oid, 'execute')
), 'Claim runtime role has no public or internal routine execution authority');
select ok(not exists (
  select 1
  from (
    values
      ('public.supplier_ownership_claims'),
      ('public.supplier_ownerships'),
      ('public.platform_role_assignments'),
      ('internal.identity_provider_links'),
      ('internal.audit_logs'),
      ('internal.idempotency_keys'),
      ('internal.domain_events')
  ) protected_table(table_name)
  cross join lateral (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  ) privilege(privilege_name)
  where has_table_privilege(
    'mujahiz_claim_runtime',
    protected_table.table_name,
    privilege.privilege_name
  )
), 'Claim runtime role has no authority on every SEC-001 protected base table');
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) api_role(role_name)
  cross join lateral (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privilege(privilege_name)
  where has_table_privilege(
    api_role.role_name,
    'public.supplier_ownership_claims',
    privilege.privilege_name
  )
), 'anon, authenticated, and service_role gain no Claim base-table authority');
select is((
  select count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal')
    and c.relkind in ('r', 'p')
    and (c.relrowsecurity or c.relforcerowsecurity)
), 0::bigint, 'no public or internal base table has RLS enabled or forced yet');
select is((select count(*) from pg_catalog.pg_policy), 0::bigint, 'no RLS policies exist yet');
select is((
  select count(*)
  from pg_catalog.pg_proc
  where proname in ('decide_claim', 'submit_claim', 'withdraw_claim', 'assign_claim_reviewer')
), 0::bigint, 'no Claim command routine is introduced');
select is((select count(*) from public.supplier_ownership_claims), 0::bigint, 'no Claim runtime row is introduced');
select is((
  select count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal') and c.relkind in ('r', 'p')
), 22::bigint, 'identity-context infrastructure adds no physical table');
select is((
  select count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'claim_security' and c.relkind in ('r', 'p', 'v', 'm', 'f')
), 0::bigint, 'Claim security schema contains no table, view, or foreign table');

select is(claim_security.current_claim_user_profile_id(), null::uuid, 'missing context fails closed');

select pg_catalog.pg_backend_pid() as initial_backend_pid \gset

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('11111111-1111-4111-8111-111111111111'::uuid);
-- No role switch is needed for this function-behavior assertion.
select is(
  claim_security.current_claim_user_profile_id(),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'valid transaction-local provider-neutral context is readable'
);
select ok(
  pg_catalog.current_setting('mujahiz.claim.purpose', true) = 'claim_v1'
  and pg_catalog.current_setting('mujahiz.claim.environment', true) = 'local'
  and pg_catalog.current_setting('mujahiz.claim.policy_version', true) = 'sec-001-claim-v1'
  and pg_catalog.current_setting('mujahiz.claim.transaction_id', true) = pg_catalog.pg_current_xact_id()::text,
  'valid context is bound to exact purpose, local environment, policy, and transaction'
);
commit;

select ok(
  nullif(pg_catalog.current_setting('mujahiz.claim.user_profile_id', true), '') is null,
  'principal setting disappears after commit'
);
select ok(
  pg_catalog.pg_backend_pid() = :initial_backend_pid
  and claim_security.current_claim_user_profile_id() is null,
  'same reused backend inherits no principal after commit'
);

begin;
select pg_catalog.set_config('mujahiz.claim.user_profile_id', 'not-a-uuid', true);
select pg_catalog.set_config('mujahiz.claim.purpose', 'claim_v1', true);
select pg_catalog.set_config('mujahiz.claim.environment', 'local', true);
select pg_catalog.set_config('mujahiz.claim.policy_version', 'sec-001-claim-v1', true);
select pg_catalog.set_config('mujahiz.claim.transaction_id', pg_catalog.pg_current_xact_id()::text, true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'malformed UUID context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.purpose', '', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'missing purpose context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.purpose', 'claim_admin', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'wrong-purpose context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.environment', '', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'missing environment context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.environment', 'production', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'wrong-environment context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.policy_version', '', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'missing policy-version context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.policy_version', 'sec-001-claim-v2', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'wrong-policy context fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.transaction_id', '', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'missing transaction binding fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('22222222-2222-4222-8222-222222222222'::uuid);
-- No role switch is needed for this function-behavior assertion.
select pg_catalog.set_config('mujahiz.claim.transaction_id', '0', true);
select is(claim_security.current_claim_user_profile_id(), null::uuid, 'mismatched transaction binding fails closed');
commit;

begin;
-- Runtime EXECUTE authority is proved by the catalog assertions above.
select claim_security.establish_claim_runtime_context('33333333-3333-4333-8333-333333333333'::uuid);
-- No role switch is needed for this function-behavior assertion.
rollback;

select ok(
  nullif(pg_catalog.current_setting('mujahiz.claim.user_profile_id', true), '') is null,
  'principal setting disappears after rollback'
);
select ok(
  pg_catalog.pg_backend_pid() = :initial_backend_pid
  and claim_security.current_claim_user_profile_id() is null,
  'same reused backend inherits no principal after rollback'
);

select * from finish();
