\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, internal, extensions, pg_catalog;

select no_plan();

select has_function(
  'claim_security',
  'current_privileged_actor_v1',
  array[]::text[],
  'current-principal privileged-actor resolver exists with no arguments'
);
select is((
  select pg_catalog.pg_get_function_result(p.oid)
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'TABLE(decision text, role_code text)', 'resolver returns exactly decision and role_code text fields');
select is((
  select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'decision,role_code', 'resolver exposes no detailed reason or sensitive output field');
select is((
  select p.provolatile::text
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'v'::text, 'resolver is VOLATILE for its trusted clock observation');
select ok((
  select p.prosecdef
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'resolver is SECURITY DEFINER');
select is((
  select r.rolname
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'postgres', 'resolver has the explicit local postgres owner');
select is((
  select pg_catalog.array_to_string(p.proconfig, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'search_path=pg_catalog', 'resolver fixes search_path to pg_catalog');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
    and pg_catalog.regexp_count(
      pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)),
      'clock_timestamp\(\)'
    ) = 1
), 1::bigint, 'resolver captures clock_timestamp exactly once');
select ok((
  select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) !~ E'\\mexecute\\M'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'resolver contains no dynamic SQL');
select ok((
  select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) !~ E'\\m(insert|update|delete|merge|truncate)\\M'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'resolver body is read-only');
select ok(pg_catalog.to_regprocedure('claim_security.current_privileged_actor_v1(uuid)') is null, 'no arbitrary-profile resolver overload exists');
select is((
  select pg_catalog.string_agg(grantee_role.rolname, ',' order by grantee_role.rolname)
  from pg_catalog.pg_proc as p
  cross join lateral pg_catalog.aclexplode(p.proacl) as acl
  join pg_catalog.pg_roles as grantee_role on grantee_role.oid = acl.grantee
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
    and acl.privilege_type = 'EXECUTE'
    and acl.grantee <> p.proowner
), 'mujahiz_claim_runtime', 'runtime is the only non-owner resolver executor');
select ok(has_function_privilege('mujahiz_claim_runtime', 'claim_security.current_privileged_actor_v1()', 'execute'), 'Claim runtime can execute resolver');
select ok(not has_function_privilege('public', 'claim_security.current_privileged_actor_v1()', 'execute'), 'PUBLIC cannot execute resolver');
select ok(not has_function_privilege('anon', 'claim_security.current_privileged_actor_v1()', 'execute'), 'anon cannot execute resolver');
select ok(not has_function_privilege('authenticated', 'claim_security.current_privileged_actor_v1()', 'execute'), 'authenticated cannot execute resolver');
select ok(not has_function_privilege('service_role', 'claim_security.current_privileged_actor_v1()', 'execute'), 'service_role cannot execute resolver');
select ok(not exists (
  select 1
  from (
    values
      ('public.user_profiles'),
      ('internal.identity_provider_links'),
      ('public.platform_role_assignments'),
      ('public.access_grants'),
      ('internal.security_eligibility_assessments')
  ) as protected(table_name)
  cross join lateral (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  ) as privilege(privilege_name)
  where pg_catalog.has_table_privilege(
    'mujahiz_claim_runtime',
    protected.table_name,
    privilege.privilege_name
  )
), 'runtime has no direct privilege on any resolver source table');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal')
    and c.relkind in ('r', 'p')
), 24::bigint, 'resolver adds no physical table');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'claim_security'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
), 0::bigint, 'resolver adds no table or view in claim_security');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy), 1::bigint, 'resolver adds no RLS policy');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy where polcmd <> 'r'), 0::bigint, 'resolver adds no mutation policy');
select is((
  select pg_catalog.count(*)
  from pg_catalog.pg_trigger
  where not tgisinternal
    and tgfoid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 0::bigint, 'resolver adds no trigger');

create function pg_temp.actor_id(p_number integer)
returns uuid
language sql
immutable
set search_path = pg_catalog
as $function$
  select (
    '00000000-0000-4000-8000-'
    || pg_catalog.lpad(pg_catalog.to_hex(p_number), 12, '0')
  )::uuid
$function$;

create function pg_temp.seed_eligible_actor(
  p_actor uuid,
  p_role_code text default 'owner'
)
returns void
language plpgsql
volatile
set search_path = pg_catalog
as $function$
begin
  insert into public.user_profiles (
    id, full_name, account_context,
    verification_mirror_status, verification_mirror_observed_at
  ) values (
    p_actor, 'Synthetic privileged actor ' || p_actor::text, 'buyer',
    'verified', pg_catalog.statement_timestamp()
  );

  insert into internal.identity_provider_links (
    id, user_profile_id, provider_code, provider_subject, is_primary,
    link_status, identity_status, verification_status,
    provider_state_observed_at, provider_state_version, verified_at
  ) values (
    p_actor, p_actor, 'firebase', 'firebase-' || p_actor::text, true,
    'linked', 'active', 'verified',
    pg_catalog.statement_timestamp(), 'firebase-provider-state-v1',
    pg_catalog.statement_timestamp()
  );

  insert into public.platform_role_assignments (
    id, user_profile_id, role_code, assignment_status,
    valid_from, authorization_policy_version, assignment_source_type,
    assignment_reason_code, evidence_reference, assignment_system_source
  ) values (
    p_actor, p_actor, p_role_code, 'active',
    pg_catalog.statement_timestamp() - interval '1 day',
    'platform-role-policy-v1', 'bootstrap_manifest',
    'resolver_test', 'resolver-test-role', 'resolver_test'
  );

  insert into public.access_grants (
    id, user_profile_id, platform_role_assignment_id, role_code,
    access_status, valid_from, valid_until, authorization_policy_version,
    grant_source_type, grant_reason_code, evidence_reference, grant_system_source
  ) values (
    p_actor, p_actor, p_actor, p_role_code,
    'active', pg_catalog.statement_timestamp() - interval '1 hour',
    case when p_role_code = 'admin'
      then pg_catalog.statement_timestamp() + interval '1 day'
      else null
    end,
    'platform-access-policy-v1', 'bootstrap_manifest',
    'resolver_test', 'resolver-test-access', 'resolver_test'
  );

  insert into internal.security_eligibility_assessments (
    id, user_profile_id, assessment_result, condition_type,
    valid_from, assessment_status, assessment_source_type,
    assessment_reason_code, security_policy_version,
    required_coverage_version, evidence_minimization_version,
    evidence_reference, assessment_system_source
  ) values (
    p_actor, p_actor, 'clear', 'complete_clear',
    pg_catalog.statement_timestamp() - interval '1 hour', 'active',
    'bootstrap_manifest', 'resolver_test',
    'platform-admin-security-v1', 'platform-admin-coverage-v1',
    'platform-admin-minimization-v1', 'resolver-test-security', 'resolver_test'
  );
end
$function$;

create function pg_temp.resolve_actor(p_actor uuid)
returns table (decision text, role_code text)
language plpgsql
volatile
set search_path = pg_catalog
as $function$
begin
  perform claim_security.establish_claim_runtime_context(p_actor);
  return query select result.decision, result.role_code
  from claim_security.current_privileged_actor_v1() as result;
end
$function$;

select is((select result.decision from claim_security.current_privileged_actor_v1() as result), 'unknown', 'missing Claim context fails closed');
select is((select result.role_code from claim_security.current_privileged_actor_v1() as result), null::text, 'missing Claim context returns no role');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(1), 'owner');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(2), 'admin');

select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(1)) as result), 'eligible', 'exact supported Owner tuple is eligible');
select is((select result.role_code from pg_temp.resolve_actor(pg_temp.actor_id(1)) as result), 'owner', 'eligible Owner returns only owner role_code');
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(2)) as result), 'eligible', 'exact supported Admin tuple is eligible');
select is((select result.role_code from pg_temp.resolve_actor(pg_temp.actor_id(2)) as result), 'admin', 'eligible Admin returns only admin role_code');

select pg_catalog.set_config('mujahiz.claim.user_profile_id', 'not-a-uuid', true);
select pg_catalog.set_config('mujahiz.claim.purpose', 'claim_v1', true);
select pg_catalog.set_config('mujahiz.claim.environment', 'local', true);
select pg_catalog.set_config('mujahiz.claim.policy_version', 'sec-001-claim-v1', true);
select pg_catalog.set_config('mujahiz.claim.transaction_id', pg_catalog.pg_current_xact_id()::text, true);
select is((select result.decision from claim_security.current_privileged_actor_v1() as result), 'unknown', 'malformed principal context fails closed');

select claim_security.establish_claim_runtime_context(pg_temp.actor_id(1));
select pg_catalog.set_config('mujahiz.claim.purpose', 'claim_admin', true);
select is((select result.decision from claim_security.current_privileged_actor_v1() as result), 'unknown', 'wrong purpose fails closed');
select claim_security.establish_claim_runtime_context(pg_temp.actor_id(1));
select pg_catalog.set_config('mujahiz.claim.environment', 'production', true);
select is((select result.decision from claim_security.current_privileged_actor_v1() as result), 'unknown', 'wrong environment fails closed');
select claim_security.establish_claim_runtime_context(pg_temp.actor_id(1));
select pg_catalog.set_config('mujahiz.claim.policy_version', 'sec-001-claim-v2', true);
select is((select result.decision from claim_security.current_privileged_actor_v1() as result), 'unknown', 'wrong Claim policy fails closed');
select claim_security.establish_claim_runtime_context(pg_temp.actor_id(1));
select pg_catalog.set_config('mujahiz.claim.transaction_id', '', true);
select is((select result.decision from claim_security.current_privileged_actor_v1() as result), 'unknown', 'missing transaction binding fails closed with otherwise valid facts');
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(1)) as result), 'eligible', 'correct context is bound to the exact transaction-local principal');
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(999)) as result), 'unknown', 'missing profile is unknown');

insert into public.user_profiles (id, full_name, account_context, legacy_role)
values (pg_temp.actor_id(3), 'Synthetic substituted principal', 'buyer', 'owner');
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(3)) as result), 'unknown', 'another profile facts cannot substitute for the bound principal');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(10));
update public.user_profiles set account_status = 'suspended', suspended_at = pg_catalog.statement_timestamp(), suspension_reason = 'resolver_test' where id = pg_temp.actor_id(10);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(10)) as result), 'denied', 'suspended profile is conclusively denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(11));
update public.user_profiles set account_status = 'deactivated', deactivated_at = pg_catalog.statement_timestamp(), deactivation_reason = 'resolver_test' where id = pg_temp.actor_id(11);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(11)) as result), 'denied', 'deactivated profile is conclusively denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(12));
update public.user_profiles set account_context = 'supplier' where id = pg_temp.actor_id(12);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(12)) as result), 'denied', 'Supplier context is conclusively denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(13));
update public.user_profiles set account_context = 'unknown' where id = pg_temp.actor_id(13);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(13)) as result), 'denied', 'unknown account context is a conclusive supported blocker');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(14));
update public.user_profiles set verification_mirror_status = 'unverified' where id = pg_temp.actor_id(14);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(14)) as result), 'denied', 'unverified profile mirror is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(15));
update public.user_profiles set verification_mirror_status = 'unknown', verification_mirror_observed_at = null where id = pg_temp.actor_id(15);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(15)) as result), 'unknown', 'unknown profile verification is unknown');
insert into public.user_profiles (
  id, full_name, account_context, legacy_role, legacy_account_type,
  legacy_organization, normalized_email, verification_mirror_status,
  verification_mirror_observed_at
) values (
  pg_temp.actor_id(16), 'Synthetic legacy-only actor', 'buyer', 'owner', 'admin',
  'owner organization', 'owner@example.invalid', 'verified', pg_catalog.statement_timestamp()
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(16)) as result), 'unknown', 'legacy role, account type, organization, and email cannot rescue missing relational authority');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(20));
update internal.identity_provider_links set provider_state_version = null where user_profile_id = pg_temp.actor_id(20);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(20)) as result), 'unknown', 'NULL provider-state version is unsupported');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(21));
update internal.identity_provider_links set provider_state_version = 'firebase-provider-state-v2' where user_profile_id = pg_temp.actor_id(21);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(21)) as result), 'unknown', 'wrong provider-state version is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(22));
update internal.identity_provider_links set provider_code = 'google' where user_profile_id = pg_temp.actor_id(22);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(22)) as result), 'unknown', 'wrong provider cannot satisfy the Firebase mirror');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(23));
update internal.identity_provider_links set link_status = 'unlinked', is_primary = false, verification_status = 'unverified', verified_at = null, unlinked_at = pg_catalog.statement_timestamp() where user_profile_id = pg_temp.actor_id(23);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(23)) as result), 'denied', 'exact supported unlinked provider state is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(24));
update internal.identity_provider_links set identity_status = 'disabled', verification_status = 'unverified', verified_at = null, disabled_at = pg_catalog.statement_timestamp() where user_profile_id = pg_temp.actor_id(24);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(24)) as result), 'denied', 'exact supported disabled provider state is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(25));
update internal.identity_provider_links set identity_status = 'unknown', verification_status = 'unknown', verified_at = null where user_profile_id = pg_temp.actor_id(25);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(25)) as result), 'unknown', 'unknown provider identity state is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(26));
update internal.identity_provider_links set verification_status = 'unverified', verified_at = null where user_profile_id = pg_temp.actor_id(26);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(26)) as result), 'denied', 'exact supported unverified provider state is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(27));
update internal.identity_provider_links set verification_status = 'unknown', verified_at = null where user_profile_id = pg_temp.actor_id(27);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(27)) as result), 'unknown', 'unknown provider verification state is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(28));
update internal.identity_provider_links set is_primary = false where user_profile_id = pg_temp.actor_id(28);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(28)) as result), 'unknown', 'non-primary linked provider state is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(29));
delete from internal.identity_provider_links where user_profile_id = pg_temp.actor_id(29);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(29)) as result), 'unknown', 'another profile provider link cannot satisfy the bound principal');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(30));
insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject, is_primary,
  link_status, identity_status, verification_status,
  provider_state_observed_at, provider_state_version, verified_at
) values (
  pg_temp.actor_id(300), pg_temp.actor_id(30), 'firebase', 'firebase-ambiguous-30', false,
  'linked', 'active', 'verified', pg_catalog.statement_timestamp(),
  'firebase-provider-state-v1', pg_catalog.statement_timestamp()
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(30)) as result), 'unknown', 'multiple linked Firebase states are ambiguous');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(40));
update public.platform_role_assignments set authorization_policy_version = 'platform-role-policy-v2' where id = pg_temp.actor_id(40);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(40)) as result), 'unknown', 'wrong role-policy version is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(41));
delete from public.access_grants where id = pg_temp.actor_id(41);
delete from public.platform_role_assignments where id = pg_temp.actor_id(41);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(41)) as result), 'unknown', 'missing role is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(42));
update public.platform_role_assignments set valid_from = pg_catalog.statement_timestamp() + interval '1 hour', assigned_at = pg_catalog.statement_timestamp() + interval '1 hour', created_at = pg_catalog.statement_timestamp() + interval '1 hour', updated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(42);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(42)) as result), 'denied', 'supported future role is conclusively non-current');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(43));
update public.platform_role_assignments set valid_until = pg_catalog.statement_timestamp() - interval '1 second' where id = pg_temp.actor_id(43);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(43)) as result), 'denied', 'supported role after its half-open horizon is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(44));
update public.platform_role_assignments set assignment_status = 'revoked', valid_until = pg_catalog.statement_timestamp() + interval '1 hour', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp() where id = pg_temp.actor_id(44);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(44)) as result), 'denied', 'current revoked role is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(45));
update public.platform_role_assignments set assignment_status = 'expired', valid_until = pg_catalog.statement_timestamp() + interval '1 hour', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp() where id = pg_temp.actor_id(45);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(45)) as result), 'denied', 'current expired-lifecycle role is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(46));
update public.platform_role_assignments set valid_until = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(46);
insert into public.platform_role_assignments (
  id, user_profile_id, role_code, valid_from, assignment_source_type,
  assignment_reason_code, authorization_policy_version, evidence_reference,
  assignment_system_source, assigned_at, created_at, updated_at
) values (
  pg_temp.actor_id(460), pg_temp.actor_id(46), 'owner', pg_catalog.statement_timestamp() + interval '1 hour',
  'bootstrap_manifest', 'resolver_test', 'platform-role-policy-v1', 'resolver-test-role-successor',
  'resolver_test', pg_catalog.statement_timestamp() + interval '1 hour',
  pg_catalog.statement_timestamp() + interval '1 hour', pg_catalog.statement_timestamp() + interval '1 hour'
);
update public.platform_role_assignments set assignment_status = 'superseded', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp(), superseding_assignment_id = pg_temp.actor_id(460) where id = pg_temp.actor_id(46);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(46)) as result), 'denied', 'current superseded role is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(47));
delete from public.access_grants where id = pg_temp.actor_id(47);
delete from public.platform_role_assignments where id = pg_temp.actor_id(47);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(47)) as result), 'unknown', 'another subject role cannot authorize the bound principal');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(48));
update public.platform_role_assignments set authorization_policy_version = 'platform_roles_v1' where id = pg_temp.actor_id(48);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(48)) as result), 'unknown', 'synthetic platform_roles_v1 role label does not authorize');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(49));
update public.platform_role_assignments set authorization_policy_version = 'platform-access-policy-v1' where id = pg_temp.actor_id(49);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(49)) as result), 'unknown', 'access version cannot substitute for the distinct role version');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(50));
update public.platform_role_assignments set authorization_policy_version = 'sec-001-claim-v1' where id = pg_temp.actor_id(50);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(50)) as result), 'unknown', 'Claim policy cannot substitute for role policy');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(51), 'admin');
update public.access_grants set authorization_policy_version = 'platform-access-policy-v2' where id = pg_temp.actor_id(51);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(51)) as result), 'unknown', 'wrong access-policy version is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(52));
delete from public.access_grants where id = pg_temp.actor_id(52);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(52)) as result), 'unknown', 'missing access is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(53), 'admin');
update public.access_grants set valid_from = pg_catalog.statement_timestamp() + interval '1 hour', valid_until = pg_catalog.statement_timestamp() + interval '2 hours', granted_at = pg_catalog.statement_timestamp() + interval '1 hour', created_at = pg_catalog.statement_timestamp() + interval '1 hour', updated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(53);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(53)) as result), 'denied', 'supported future access is conclusively non-current');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(54), 'admin');
update public.access_grants set valid_from = pg_catalog.statement_timestamp() - interval '2 hours', valid_until = pg_catalog.statement_timestamp() - interval '1 second' where id = pg_temp.actor_id(54);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(54)) as result), 'denied', 'access at or after its half-open horizon is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(55), 'admin');
update public.access_grants set access_status = 'revoked', valid_until = pg_catalog.statement_timestamp() + interval '1 hour', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(55);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(55)) as result), 'denied', 'current revoked access is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(56), 'admin');
update public.access_grants set access_status = 'expired', valid_until = pg_catalog.statement_timestamp() + interval '1 hour', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(56);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(56)) as result), 'denied', 'current expired-lifecycle access is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(57), 'admin');
insert into public.access_grants (
  id, user_profile_id, platform_role_assignment_id, role_code,
  valid_from, valid_until, authorization_policy_version, grant_source_type,
  grant_reason_code, evidence_reference, grant_system_source,
  granted_at, created_at, updated_at
) values (
  pg_temp.actor_id(570), pg_temp.actor_id(57), pg_temp.actor_id(57), 'admin',
  pg_catalog.statement_timestamp() + interval '1 day', pg_catalog.statement_timestamp() + interval '2 days',
  'platform-access-policy-v1', 'bootstrap_manifest', 'resolver_test',
  'resolver-test-access-successor', 'resolver_test',
  pg_catalog.statement_timestamp() + interval '1 day', pg_catalog.statement_timestamp() + interval '1 day',
  pg_catalog.statement_timestamp() + interval '1 day'
);
update public.access_grants set access_status = 'superseded', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = valid_until, superseding_access_grant_id = pg_temp.actor_id(570) where id = pg_temp.actor_id(57);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(57)) as result), 'denied', 'current superseded access is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(58));
delete from public.access_grants where id = pg_temp.actor_id(58);
update public.platform_role_assignments set valid_from = pg_catalog.transaction_timestamp() - interval '1 hour' where id = pg_temp.actor_id(58);
insert into public.platform_role_assignments (
  id, user_profile_id, role_code, assignment_status, valid_from, valid_until,
  assignment_source_type, assignment_reason_code, authorization_policy_version,
  evidence_reference, assignment_system_source, terminal_reason_code,
  terminal_system_source, terminated_at
) values (
  pg_temp.actor_id(580), pg_temp.actor_id(58), 'owner', 'expired',
  pg_catalog.transaction_timestamp() - interval '2 days', pg_catalog.transaction_timestamp() - interval '1 hour',
  'bootstrap_manifest', 'resolver_test', 'platform-role-policy-v1',
  'resolver-test-old-role', 'resolver_test', 'resolver_test', 'resolver_test', pg_catalog.statement_timestamp()
);
insert into public.access_grants (
  id, user_profile_id, platform_role_assignment_id, role_code,
  valid_from, authorization_policy_version, grant_source_type,
  grant_reason_code, evidence_reference, grant_system_source
) values (
  pg_temp.actor_id(581), pg_temp.actor_id(58), pg_temp.actor_id(580), 'owner',
  pg_catalog.statement_timestamp() - interval '30 minutes', 'platform-access-policy-v1',
  'bootstrap_manifest', 'resolver_test', 'resolver-test-mismatched-access', 'resolver_test'
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(58)) as result), 'unknown', 'current access bound to a different role assignment is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(59));
delete from public.access_grants where id = pg_temp.actor_id(59);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(59)) as result), 'unknown', 'another subject access cannot authorize the bound principal');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(60));
update public.access_grants set authorization_policy_version = 'access_v1' where id = pg_temp.actor_id(60);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(60)) as result), 'unknown', 'synthetic access_v1 label does not authorize');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(61));
update public.access_grants set authorization_policy_version = 'platform-role-policy-v1' where id = pg_temp.actor_id(61);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(61)) as result), 'unknown', 'role version cannot substitute for the distinct access version');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(62));
update public.access_grants set authorization_policy_version = 'sec-001-claim-v1' where id = pg_temp.actor_id(62);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(62)) as result), 'unknown', 'Claim policy cannot substitute for access policy');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(70));
update internal.security_eligibility_assessments set valid_until = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(70);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(70)) as result), 'eligible', 'finite in-time exact clear assessment is eligible');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(71));
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(71)) as result), 'eligible', 'indefinite exact clear assessment is eligible');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(72));
update internal.security_eligibility_assessments set assessment_result = 'deny', condition_type = 'explicit_deny', assessment_source_type = 'trusted_security_system' where id = pg_temp.actor_id(72);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(72)) as result), 'denied', 'supported explicit deny is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(73));
update internal.security_eligibility_assessments set assessment_result = 'deny', condition_type = 'security_hold', assessment_source_type = 'trusted_security_system' where id = pg_temp.actor_id(73);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(73)) as result), 'denied', 'supported security hold is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(74));
update internal.security_eligibility_assessments set assessment_result = 'deny', condition_type = 'identity_quarantine', assessment_source_type = 'trusted_security_system' where id = pg_temp.actor_id(74);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(74)) as result), 'denied', 'supported identity quarantine is denied');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(75));
update internal.security_eligibility_assessments set assessment_result = 'unknown', condition_type = 'reconciliation_required', assessment_source_type = 'trusted_security_system' where id = pg_temp.actor_id(75);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(75)) as result), 'unknown', 'supported reconciliation-required result is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(76));
update internal.security_eligibility_assessments set security_policy_version = 'platform-admin-security-v2' where id = pg_temp.actor_id(76);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(76)) as result), 'unknown', 'wrong security-policy version is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(77));
update internal.security_eligibility_assessments set required_coverage_version = 'platform-admin-coverage-v2' where id = pg_temp.actor_id(77);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(77)) as result), 'unknown', 'wrong coverage version is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(78));
update internal.security_eligibility_assessments set evidence_minimization_version = 'platform-admin-minimization-v2' where id = pg_temp.actor_id(78);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(78)) as result), 'unknown', 'wrong minimization version is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(79));
delete from internal.security_eligibility_assessments where id = pg_temp.actor_id(79);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(79)) as result), 'unknown', 'missing security assessment is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(80));
update internal.security_eligibility_assessments set valid_from = pg_catalog.statement_timestamp() + interval '1 hour', assessed_at = pg_catalog.statement_timestamp() + interval '1 hour', created_at = pg_catalog.statement_timestamp() + interval '1 hour', updated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(80);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(80)) as result), 'unknown', 'future security assessment is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(81));
update internal.security_eligibility_assessments set valid_from = pg_catalog.statement_timestamp() - interval '2 hours', valid_until = pg_catalog.statement_timestamp() - interval '1 second' where id = pg_temp.actor_id(81);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(81)) as result), 'unknown', 'security assessment at or after its half-open horizon is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(82));
update internal.security_eligibility_assessments set assessment_status = 'resolved', valid_until = pg_catalog.statement_timestamp() + interval '1 hour', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(82);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(82)) as result), 'unknown', 'current resolved security row is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(83));
update internal.security_eligibility_assessments set assessment_status = 'expired', valid_until = pg_catalog.statement_timestamp() + interval '1 hour', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(83);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(83)) as result), 'unknown', 'current expired-lifecycle security row is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(84));
update internal.security_eligibility_assessments set valid_until = pg_catalog.statement_timestamp() + interval '1 hour' where id = pg_temp.actor_id(84);
insert into internal.security_eligibility_assessments (
  id, user_profile_id, assessment_result, condition_type,
  valid_from, assessment_source_type, assessment_reason_code,
  security_policy_version, required_coverage_version,
  evidence_minimization_version, evidence_reference, assessment_system_source,
  assessed_at, created_at, updated_at
) values (
  pg_temp.actor_id(840), pg_temp.actor_id(84), 'clear', 'complete_clear',
  pg_catalog.statement_timestamp() + interval '1 hour', 'bootstrap_manifest', 'resolver_test',
  'platform-admin-security-v1', 'platform-admin-coverage-v1', 'platform-admin-minimization-v1',
  'resolver-test-security-successor', 'resolver_test', pg_catalog.statement_timestamp() + interval '1 hour',
  pg_catalog.statement_timestamp() + interval '1 hour', pg_catalog.statement_timestamp() + interval '1 hour'
);
update internal.security_eligibility_assessments set assessment_status = 'superseded', terminal_reason_code = 'resolver_test', terminal_system_source = 'resolver_test', terminated_at = valid_until, superseding_assessment_id = pg_temp.actor_id(840) where id = pg_temp.actor_id(84);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(84)) as result), 'unknown', 'current superseded security row is unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(85));
insert into internal.security_eligibility_assessments (
  id, user_profile_id, assessment_result, condition_type, valid_from,
  assessment_source_type, assessment_reason_code, security_policy_version,
  required_coverage_version, evidence_minimization_version,
  evidence_reference, assessment_system_source
) values (
  pg_temp.actor_id(850), pg_temp.actor_id(85), 'clear', 'complete_clear',
  pg_catalog.statement_timestamp() - interval '1 hour', 'bootstrap_manifest', 'resolver_test',
  'platform-admin-security-unsupported', 'platform-admin-coverage-v1',
  'platform-admin-minimization-v1', 'resolver-test-unsupported-current', 'resolver_test'
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(85)) as result), 'unknown', 'supported clear plus current unsupported tuple is contradictory and unknown');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(86));
update internal.security_eligibility_assessments set security_policy_version = 'security_v1', required_coverage_version = 'coverage_v1', evidence_minimization_version = 'min_v1' where id = pg_temp.actor_id(86);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(86)) as result), 'unknown', 'synthetic security_v1 coverage_v1 min_v1 tuple does not authorize');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(87));
update internal.security_eligibility_assessments set security_policy_version = 'sec-001-claim-v1' where id = pg_temp.actor_id(87);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(87)) as result), 'unknown', 'Claim policy cannot substitute for security policy');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(88));
update internal.security_eligibility_assessments set required_coverage_version = 'sec-001-claim-v1' where id = pg_temp.actor_id(88);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(88)) as result), 'unknown', 'Claim policy cannot substitute for coverage version');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(89));
update internal.security_eligibility_assessments set evidence_minimization_version = 'sec-001-claim-v1' where id = pg_temp.actor_id(89);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(89)) as result), 'unknown', 'Claim policy cannot substitute for minimization version');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(90));
update internal.identity_provider_links set provider_state_version = 'sec-001-claim-v1' where user_profile_id = pg_temp.actor_id(90);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(90)) as result), 'unknown', 'Claim policy cannot substitute for provider-state version');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(91));
delete from internal.security_eligibility_assessments where id = pg_temp.actor_id(91);
delete from public.access_grants where id = pg_temp.actor_id(91);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(91)) as result), 'unknown', 'role alone is never eligible');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(92));
delete from internal.security_eligibility_assessments where id = pg_temp.actor_id(92);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(92)) as result), 'unknown', 'role plus access without security is not eligible');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(93));
delete from public.access_grants where id = pg_temp.actor_id(93);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(93)) as result), 'unknown', 'role plus security without access is not eligible');
select pg_temp.seed_eligible_actor(pg_temp.actor_id(94));
delete from internal.identity_provider_links where user_profile_id = pg_temp.actor_id(94);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(94)) as result), 'unknown', 'all other facts cannot replace the provider mirror');

select pg_temp.seed_eligible_actor(pg_temp.actor_id(95));
update public.user_profiles set account_status = 'suspended', suspended_at = pg_catalog.statement_timestamp(), suspension_reason = 'resolver_test' where id = pg_temp.actor_id(95);
insert into internal.security_eligibility_assessments (
  id, user_profile_id, assessment_result, condition_type, valid_from,
  assessment_source_type, assessment_reason_code, security_policy_version,
  required_coverage_version, evidence_minimization_version,
  evidence_reference, assessment_system_source
) values (
  pg_temp.actor_id(950), pg_temp.actor_id(95), 'clear', 'complete_clear',
  pg_catalog.statement_timestamp() - interval '1 hour', 'bootstrap_manifest', 'resolver_test',
  'unsupported-security-v1', 'platform-admin-coverage-v1',
  'platform-admin-minimization-v1', 'resolver-test-ambiguity-deny', 'resolver_test'
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(95)) as result), 'unknown', 'version ambiguity takes precedence over a conclusive profile blocker');
select is((select result.role_code from pg_temp.resolve_actor(pg_temp.actor_id(95)) as result), 'owner', 'role_code remains the conclusive supported role even when final decision is unknown');

alter table public.platform_role_assignments
  drop constraint platform_role_assignments_user_interval_excl;
select pg_temp.seed_eligible_actor(pg_temp.actor_id(96));
insert into public.platform_role_assignments (
  id, user_profile_id, role_code, valid_from, assignment_source_type,
  assignment_reason_code, authorization_policy_version, evidence_reference,
  assignment_system_source
) values (
  pg_temp.actor_id(960), pg_temp.actor_id(96), 'admin',
  pg_catalog.statement_timestamp() - interval '30 minutes',
  'bootstrap_manifest', 'resolver_test', 'platform-role-policy-v1',
  'resolver-test-ambiguous-role', 'resolver_test'
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(96)) as result), 'unknown', 'multiple current roles remain fail-closed if structural protection is bypassed');
select is((select result.role_code from pg_temp.resolve_actor(pg_temp.actor_id(96)) as result), null::text, 'ambiguous current roles return no role_code');

alter table public.access_grants
  drop constraint access_grants_subject_interval_excl;
alter table public.access_grants
  drop constraint access_grants_role_assignment_interval_excl;
select pg_temp.seed_eligible_actor(pg_temp.actor_id(97));
insert into public.access_grants (
  id, user_profile_id, platform_role_assignment_id, role_code,
  valid_from, authorization_policy_version, grant_source_type,
  grant_reason_code, evidence_reference, grant_system_source
) values (
  pg_temp.actor_id(970), pg_temp.actor_id(97), pg_temp.actor_id(97), 'owner',
  pg_catalog.statement_timestamp() - interval '30 minutes',
  'platform-access-policy-v1', 'bootstrap_manifest', 'resolver_test',
  'resolver-test-ambiguous-access', 'resolver_test'
);
select is((select result.decision from pg_temp.resolve_actor(pg_temp.actor_id(97)) as result), 'unknown', 'multiple current access grants remain fail-closed if structural protection is bypassed');

create temporary table resolver_source_counts on commit drop as
select
  (select pg_catalog.count(*) from public.user_profiles) as profile_count,
  (select pg_catalog.count(*) from internal.identity_provider_links) as provider_count,
  (select pg_catalog.count(*) from public.platform_role_assignments) as role_count,
  (select pg_catalog.count(*) from public.access_grants) as access_count,
  (select pg_catalog.count(*) from internal.security_eligibility_assessments) as security_count;
select pg_temp.resolve_actor(pg_temp.actor_id(1));
select ok((
  select snapshot.profile_count = (select pg_catalog.count(*) from public.user_profiles)
    and snapshot.provider_count = (select pg_catalog.count(*) from internal.identity_provider_links)
    and snapshot.role_count = (select pg_catalog.count(*) from public.platform_role_assignments)
    and snapshot.access_count = (select pg_catalog.count(*) from public.access_grants)
    and snapshot.security_count = (select pg_catalog.count(*) from internal.security_eligibility_assessments)
  from resolver_source_counts as snapshot
), 'resolver call writes no source row');
select ok((select result.decision = 'eligible' from pg_temp.resolve_actor(pg_temp.actor_id(1)) as result), 'eligible is authorization-positive');
select ok((select result.decision <> 'eligible' from pg_temp.resolve_actor(pg_temp.actor_id(10)) as result), 'denied is non-authorizing');
select ok((select result.decision <> 'eligible' from pg_temp.resolve_actor(pg_temp.actor_id(20)) as result), 'unknown is non-authorizing');

select * from finish();
rollback;
