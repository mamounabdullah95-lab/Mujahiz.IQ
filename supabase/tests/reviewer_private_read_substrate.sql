\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, internal, extensions, pg_catalog;

select no_plan();

-- Object, role, RLS, ACL, and regression contract.
select has_schema('claim_api', 'fixed Claim API schema exists');
select has_function('claim_security', 'privileged_actor_for_profile_v1', array['uuid'],
  'private arbitrary-profile eligibility evaluator exists');
select has_function('claim_security', 'reviewer_prior_claim_context_v1',
  array['uuid', 'uuid', 'uuid'], 'private prior-Claim context helper exists');
select has_function('claim_api', 'owner_assignment_queue_v1',
  array['timestamp with time zone', 'uuid', 'integer'], 'Owner queue exists');
select has_function('claim_api', 'owner_reviewer_candidates_v1',
  array['uuid', 'uuid', 'integer'], 'claim-scoped candidate projection exists');
select has_function('claim_api', 'reviewer_queue_v1',
  array['timestamp with time zone', 'uuid', 'integer'], 'reviewer queue exists');
select has_function('claim_api', 'reviewer_detail_v1', array['uuid'],
  'reviewer detail exists');
select ok(pg_catalog.to_regprocedure('supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid)') is null,
  'assign_reviewer remains absent');

select is((
  select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_api.owner_assignment_queue_v1(timestamptz,uuid,integer)'::regprocedure
), 'cursor_expires_at,cursor_claim_id,result_limit,claim_id,claim_version,supplier_profile_id,supplier_display_name,supplier_name_ar,supplier_name_en,submitted_at,expires_at,status',
  'Owner queue has the exact fixed output columns');
select is((
  select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_api.owner_reviewer_candidates_v1(uuid,uuid,integer)'::regprocedure
), 'p_claim_id,cursor_reviewer_user_profile_id,result_limit,reviewer_user_profile_id,reviewer_display_name,role_code',
  'candidate projection has the exact fixed output columns');
select is((
  select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_api.reviewer_queue_v1(timestamptz,uuid,integer)'::regprocedure
), 'cursor_expires_at,cursor_claim_id,result_limit,claim_id,claim_version,status,supplier_profile_id,supplier_display_name,supplier_name_ar,supplier_name_en,supplier_business_type,submitted_at,expires_at,reviewer_assignment_version,reviewer_assigned_at',
  'reviewer queue has the exact fixed output columns');
select is((
  select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_api.reviewer_detail_v1(uuid)'::regprocedure
), 'p_claim_id,claim_id,claim_version,status,submitted_at,expires_at,reviewer_assignment_version,reviewer_assigned_at,submitted_reason,evidence_schema_version,evidence_descriptors,claimant_display_name,claimant_organization_label,claimant_job_title,supplier_profile_id,supplier_display_name,supplier_name_ar,supplier_name_en,supplier_business_type,supplier_short_description,supplier_listing_status,supplier_verification_status,supplier_review_eligibility_code,prior_claim_id,prior_claim_status,prior_claim_result_code,prior_claim_decided_at',
  'reviewer detail has the exact fixed output columns');
select is((
  select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'claim_api.reviewer_evidence_descriptor_v1'::regclass
    and a.attnum > 0 and not a.attisdropped
), 'kind:text,summary:text,reference_hostname:text,reference_unavailable:boolean',
  'evidence descriptor type contains only the approved sanitized fields');

select is((select count(*) from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass), 3::bigint,
  'Claim has exactly three SELECT policies');
select is((select count(*) from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
    and polcmd <> 'r'), 0::bigint, 'Claim has zero mutation policies');
select is((
  select pg_catalog.string_agg(polname, ',' order by polname)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
), 'supplier_ownership_claims_assigned_reviewer_select,supplier_ownership_claims_claimant_self_select,supplier_ownership_claims_owner_assignment_select',
  'Claim policies are exactly claimant, Owner queue, and assigned reviewer');
select is((
  select polname || ':' || polcmd::text || ':' || polpermissive::text || ':' || pg_catalog.pg_get_expr(polqual, polrelid)
  from pg_catalog.pg_policy
  where polname = 'supplier_ownership_claims_claimant_self_select'
    and polrelid = 'public.supplier_ownership_claims'::regclass
), 'supplier_ownership_claims_claimant_self_select:r:true:(claimant_user_profile_id = claim_security.current_claim_user_profile_id())',
  'existing claimant self-read policy is unchanged');
select is((
  select pg_catalog.string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.supplier_ownership_claims_claimant_v1'::regclass
    and a.attnum > 0 and not a.attisdropped
), 'id,supplier_profile_id,status,claimant_result_code,submitted_at,expires_at,decided_at,withdrawn_at,expired_at,superseded_at,updated_at,record_version',
  'existing claimant projection remains identical');
select ok((select relrowsecurity and relforcerowsecurity
  from pg_catalog.pg_class where oid = 'public.supplier_ownership_claims'::regclass),
  'Claim RLS remains enabled and forced');

select is((
  select pg_catalog.string_agg(r.rolname || ':' || p.polname, ',' order by r.rolname, p.polname)
  from pg_catalog.pg_policy as p
  cross join lateral pg_catalog.unnest(p.polroles) as policy_role(oid)
  join pg_catalog.pg_roles as r on r.oid = policy_role.oid
  where p.polrelid = 'public.supplier_ownership_claims'::regclass
), 'mujahiz_claim_owner_projection:supplier_ownership_claims_owner_assignment_select,mujahiz_claim_reviewer_projection:supplier_ownership_claims_assigned_reviewer_select,mujahiz_claim_runtime:supplier_ownership_claims_claimant_self_select',
  'each permissive policy is isolated to one audience role');
select ok(not exists (
  select 1 from pg_catalog.pg_policy as p
  cross join lateral pg_catalog.unnest(p.polroles) as policy_role(oid)
  join pg_catalog.pg_roles as r on r.oid = policy_role.oid
  where p.polrelid = 'public.supplier_ownership_claims'::regclass
    and r.rolname in ('anon', 'authenticated', 'service_role')
), 'browser/API/service roles have no Claim policy');

select is((
  select pg_catalog.string_agg(
    r.rolname || ':' || r.rolcanlogin::text || ':' || r.rolinherit::text || ':' ||
    r.rolsuper::text || ':' || r.rolbypassrls::text,
    ',' order by r.rolname
  )
  from pg_catalog.pg_roles as r
  where r.rolname in ('mujahiz_claim_owner_projection', 'mujahiz_claim_reviewer_projection')
), 'mujahiz_claim_owner_projection:false:false:false:false,mujahiz_claim_reviewer_projection:false:false:false:false',
  'projection roles are NOLOGIN, NOINHERIT, non-superuser, non-BYPASSRLS');
select is((
  select pg_catalog.string_agg(
    granted_role.rolname || ':' || member_role.rolname || ':' ||
    membership.admin_option::text || ':' || membership.inherit_option::text || ':' ||
    membership.set_option::text,
    ',' order by granted_role.rolname, member_role.rolname
  )
  from pg_catalog.pg_auth_members as membership
  join pg_catalog.pg_roles as granted_role on granted_role.oid = membership.roleid
  join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
  where membership.roleid in (
    'mujahiz_claim_owner_projection'::regrole,
    'mujahiz_claim_reviewer_projection'::regrole
  )
), 'mujahiz_claim_owner_projection:postgres:true:false:false,mujahiz_claim_reviewer_projection:postgres:true:false:false',
  'projection roles retain only non-executable database-admin control, with no inheritance or SET path');
select ok(not has_schema_privilege('mujahiz_claim_owner_projection', 'claim_api', 'create')
  and not has_schema_privilege('mujahiz_claim_owner_projection', 'claim_security', 'create')
  and not has_schema_privilege('mujahiz_claim_reviewer_projection', 'claim_api', 'create')
  and not has_schema_privilege('mujahiz_claim_reviewer_projection', 'claim_security', 'create'),
  'projection roles retain no schema CREATE privilege');
select ok(not exists (
  select 1 from pg_catalog.pg_class as c
  where c.relowner in (
    'mujahiz_claim_owner_projection'::regrole,
    'mujahiz_claim_reviewer_projection'::regrole
  ) and c.relkind in ('r', 'p', 'v', 'm', 'S')
), 'projection roles own no table, view, materialized view, or sequence');

select is((
  select pg_catalog.string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.user_profiles'::regclass
    and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('mujahiz_claim_owner_projection', 'public.user_profiles', a.attname, 'select')
), 'id,full_name,account_status,account_context,verification_mirror_status',
  'Owner projection has only exact profile columns');
select ok(not has_column_privilege('mujahiz_claim_owner_projection', 'public.user_profiles', 'normalized_email', 'select')
  and not has_column_privilege('mujahiz_claim_owner_projection', 'public.user_profiles', 'phone_number', 'select')
  and not has_column_privilege('mujahiz_claim_owner_projection', 'internal.identity_provider_links', 'provider_subject', 'select')
  and not has_column_privilege('mujahiz_claim_owner_projection', 'internal.identity_provider_links', 'email_at_link', 'select'),
  'Owner projection cannot read profile/provider PII');
select ok(not has_any_column_privilege('mujahiz_claim_reviewer_projection', 'public.user_profiles', 'select')
  and not has_any_column_privilege('mujahiz_claim_reviewer_projection', 'internal.identity_provider_links', 'select')
  and not has_schema_privilege('mujahiz_claim_reviewer_projection', 'internal', 'usage'),
  'Reviewer projection cannot browse profiles or internal schema');
select is((
  select pg_catalog.string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.supplier_ownerships'::regclass
    and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('mujahiz_claim_reviewer_projection', 'public.supplier_ownerships', a.attname, 'select')
), 'id,supplier_profile_id,authority_type,ownership_status,valid_from,valid_until',
  'Reviewer ownership source grant omits controller identity and provenance');
select ok(not has_column_privilege('mujahiz_claim_reviewer_projection', 'public.supplier_ownerships', 'controller_user_profile_id', 'select'),
  'Reviewer projection cannot read controller identity');
select ok(not has_table_privilege('mujahiz_claim_owner_projection', 'public.supplier_ownership_claims', 'select')
  and not has_table_privilege('mujahiz_claim_reviewer_projection', 'public.supplier_ownership_claims', 'select'),
  'projection roles have no table-level Claim SELECT');
select ok(not exists (
  select 1
  from (values ('mujahiz_claim_owner_projection'), ('mujahiz_claim_reviewer_projection')) as role_name(name)
  cross join lateral (values ('INSERT'), ('UPDATE'), ('DELETE')) as privilege_name(name)
  where has_table_privilege(role_name.name, 'public.supplier_ownership_claims', privilege_name.name)
), 'projection roles have no Claim mutation grant');
select is((
  select pg_catalog.string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.supplier_ownership_claims'::regclass
    and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', a.attname, 'select')
), 'id,supplier_profile_id,status,record_version,submitted_at,expires_at,decided_at,withdrawn_at,expired_at,superseded_at,updated_at',
  'runtime direct Claim columns remain the original claimant-safe eleven');
select is((
  select pg_catalog.string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.supplier_ownership_claims'::regclass
    and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('mujahiz_claim_owner_projection', 'public.supplier_ownership_claims', a.attname, 'select')
), 'id,claimant_user_profile_id,supplier_profile_id,status,record_version,submitted_at,expires_at,reviewer_user_profile_id,reviewer_assignment_version,reviewer_assigned_at,reviewer_assigned_by_user_profile_id,reviewer_assignment_source_code,reviewer_assignment_policy_version,decided_at,withdrawn_at,expired_at,superseded_at,resulting_supplier_ownership_id',
  'Owner projection Claim source columns are exact');
select is((
  select pg_catalog.string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.supplier_ownership_claims'::regclass
    and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('mujahiz_claim_reviewer_projection', 'public.supplier_ownership_claims', a.attname, 'select')
), 'id,claimant_user_profile_id,supplier_profile_id,status,record_version,submitted_at,expires_at,submitted_reason,claimant_snapshot_schema_version,claimant_snapshot,evidence_schema_version,evidence_descriptors,reviewer_user_profile_id,reviewer_assignment_version,reviewer_assigned_at,reviewer_assigned_by_user_profile_id,reviewer_assignment_source_code,reviewer_assignment_policy_version,decided_at,withdrawn_at,expired_at,superseded_at,prior_claim_id,resulting_supplier_ownership_id',
  'Reviewer projection Claim source columns are exact and omit prior decision internals');

select ok((select p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=pg_catalog']
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure),
  'private evaluator is VOLATILE SECURITY DEFINER with fixed pg_catalog search_path');
select is((select r.rolname from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure),
  'mujahiz_claim_owner_projection', 'private evaluator has the dedicated least-privilege owner');
select ok((
  select pg_catalog.regexp_count(pg_catalog.pg_get_functiondef(p.oid), 'clock_timestamp') = 1
    and pg_catalog.pg_get_functiondef(p.oid) like '%firebase-provider-state-v1%'
    and pg_catalog.pg_get_functiondef(p.oid) like '%platform-role-policy-v1%'
    and pg_catalog.pg_get_functiondef(p.oid) like '%platform-access-policy-v1%'
    and pg_catalog.pg_get_functiondef(p.oid) like '%platform-admin-security-v1%'
    and pg_catalog.pg_get_functiondef(p.oid) like '%platform-admin-coverage-v1%'
    and pg_catalog.pg_get_functiondef(p.oid) like '%platform-admin-minimization-v1%'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure
), 'private evaluator fixes the exact version tuple and captures one trusted time');
select ok((
  select p.prosecdef and p.provolatile = 'v'
    and p.proconfig = array['search_path=pg_catalog']
    and r.rolname = 'mujahiz_claim_owner_projection'
    and pg_catalog.regexp_count(pg_catalog.pg_get_functiondef(p.oid), 'claim_security[.]privileged_actor_for_profile_v1') = 1
    and pg_catalog.regexp_count(pg_catalog.pg_get_functiondef(p.oid), 'clock_timestamp') = 0
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_security.current_privileged_actor_v1()'::regprocedure
), 'current resolver preserves VOLATILE SECURITY DEFINER contract and delegates once');
select ok((
  select p.prosecdef and p.provolatile = 's'
    and p.proconfig = array['search_path=pg_catalog']
    and r.rolname = 'postgres'
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure
), 'private prior-context helper is STABLE SECURITY DEFINER with fixed owner and search path');
select is((
  select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure
), 'p_prior_claim_id,p_claimant_user_profile_id,p_supplier_profile_id,prior_claim_id,prior_claim_status,prior_claim_result_code,prior_claim_decided_at',
  'private prior-context helper has only fixed routing inputs and safe outputs');
select is((select r.rolname from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_api.owner_assignment_queue_v1(timestamptz,uuid,integer)'::regprocedure),
  'mujahiz_claim_owner_projection', 'Owner queue has the Owner projection owner');
select is((select r.rolname from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_api.reviewer_detail_v1(uuid)'::regprocedure),
  'mujahiz_claim_reviewer_projection', 'Reviewer detail has the reviewer projection owner');
select ok(not has_function_privilege('public', 'claim_security.privileged_actor_for_profile_v1(uuid)', 'execute')
  and not has_function_privilege('anon', 'claim_security.privileged_actor_for_profile_v1(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'claim_security.privileged_actor_for_profile_v1(uuid)', 'execute')
  and not has_function_privilege('service_role', 'claim_security.privileged_actor_for_profile_v1(uuid)', 'execute')
  and not has_function_privilege('mujahiz_claim_runtime', 'claim_security.privileged_actor_for_profile_v1(uuid)', 'execute')
  and not has_function_privilege('mujahiz_claim_reviewer_projection', 'claim_security.privileged_actor_for_profile_v1(uuid)', 'execute'),
  'private arbitrary-profile evaluator is not a browser/API/service/runtime oracle');
select ok(has_function_privilege('mujahiz_claim_reviewer_projection',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('public',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('anon',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('service_role',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('mujahiz_claim_runtime',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('mujahiz_claim_owner_projection',
    'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)', 'execute'),
  'private prior-context helper is callable only by the isolated Reviewer projection');
select ok(has_function_privilege('postgres', 'claim_security.current_privileged_actor_v1()', 'execute')
  and has_function_privilege('mujahiz_claim_runtime', 'claim_security.current_privileged_actor_v1()', 'execute')
  and not has_function_privilege('public', 'claim_security.current_privileged_actor_v1()', 'execute')
  and not has_function_privilege('anon', 'claim_security.current_privileged_actor_v1()', 'execute')
  and not has_function_privilege('authenticated', 'claim_security.current_privileged_actor_v1()', 'execute')
  and not has_function_privilege('service_role', 'claim_security.current_privileged_actor_v1()', 'execute'),
  'current-principal resolver preserves the prior postgres/runtime ACL outside trusted projections');
select ok(not has_function_privilege('mujahiz_claim_runtime', 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute')
  and has_function_privilege('mujahiz_claim_owner_projection', 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute')
  and has_function_privilege('mujahiz_claim_reviewer_projection', 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'conflict helper remains runtime-private and is executable only by exact projection roles');
select ok(has_function_privilege('mujahiz_claim_runtime', 'claim_api.owner_assignment_queue_v1(timestamptz,uuid,integer)', 'execute')
  and has_function_privilege('mujahiz_claim_runtime', 'claim_api.reviewer_detail_v1(uuid)', 'execute')
  and not has_function_privilege('anon', 'claim_api.reviewer_detail_v1(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'claim_api.reviewer_detail_v1(uuid)', 'execute')
  and not has_function_privilege('service_role', 'claim_api.reviewer_detail_v1(uuid)', 'execute'),
  'only Claim runtime can execute fixed projection routines');
select ok(not has_schema_privilege('anon', 'claim_api', 'usage')
  and not has_schema_privilege('authenticated', 'claim_api', 'usage')
  and not has_schema_privilege('service_role', 'claim_api', 'usage'),
  'browser/API/service roles cannot discover the Claim API schema');
select ok(has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)', 'execute')
  and has_function_privilege('mujahiz_claim_runtime',
  'supplier_claim.withdraw(text,uuid,integer,uuid,uuid)', 'execute')
  and not has_function_privilege('mujahiz_claim_owner_projection',
  'supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)', 'execute')
  and not has_function_privilege('mujahiz_claim_reviewer_projection',
  'supplier_claim.withdraw(text,uuid,integer,uuid,uuid)', 'execute'),
  'submit/withdraw execution privileges remain unchanged');
select is((select count(*) from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal') and c.relkind in ('r', 'p')),
  24::bigint, 'Reviewer substrate adds no physical table');

-- Deterministic synthetic fixtures.
create function pg_temp.reviewer_id(p_number integer)
returns uuid language sql immutable set search_path = pg_catalog
as $function$
  select ('20000000-0000-4000-8000-' ||
    pg_catalog.lpad(pg_catalog.to_hex(p_number), 12, '0'))::uuid
$function$;

create function pg_temp.seed_eligible_actor(p_number integer, p_role text)
returns uuid language plpgsql volatile set search_path = pg_catalog
as $function$
declare actor_id uuid := pg_temp.reviewer_id(p_number);
begin
  insert into public.user_profiles (
    id, full_name, account_context, verification_mirror_status,
    verification_mirror_observed_at
  ) values (
    actor_id, 'Synthetic eligible ' || p_role || ' ' || p_number::text,
    'buyer', 'verified', pg_catalog.statement_timestamp()
  );
  insert into internal.identity_provider_links (
    id, user_profile_id, provider_code, provider_subject, is_primary,
    link_status, identity_status, verification_status,
    provider_state_observed_at, provider_state_version, verified_at
  ) values (
    actor_id, actor_id, 'firebase', 'firebase-reviewer-' || p_number::text,
    true, 'linked', 'active', 'verified', pg_catalog.statement_timestamp(),
    'firebase-provider-state-v1', pg_catalog.statement_timestamp()
  );
  insert into public.platform_role_assignments (
    id, user_profile_id, role_code, assignment_status, valid_from,
    authorization_policy_version, assignment_source_type,
    assignment_reason_code, evidence_reference, assignment_system_source
  ) values (
    actor_id, actor_id, p_role, 'active',
    pg_catalog.statement_timestamp() - interval '2 days',
    'platform-role-policy-v1', 'bootstrap_manifest', 'reviewer_test',
    'reviewer-role-evidence', 'reviewer_test'
  );
  insert into public.access_grants (
    id, user_profile_id, platform_role_assignment_id, role_code,
    access_status, valid_from, valid_until, authorization_policy_version,
    grant_source_type, grant_reason_code, evidence_reference,
    grant_system_source
  ) values (
    actor_id, actor_id, actor_id, p_role, 'active',
    pg_catalog.statement_timestamp() - interval '1 day',
    case when p_role = 'admin' then pg_catalog.statement_timestamp() + interval '30 days' else null end,
    'platform-access-policy-v1', 'bootstrap_manifest', 'reviewer_test',
    'reviewer-access-evidence', 'reviewer_test'
  );
  insert into internal.security_eligibility_assessments (
    id, user_profile_id, assessment_result, condition_type, valid_from,
    assessment_status, assessment_source_type, assessment_reason_code,
    security_policy_version, required_coverage_version,
    evidence_minimization_version, evidence_reference,
    assessment_system_source
  ) values (
    actor_id, actor_id, 'clear', 'complete_clear',
    pg_catalog.statement_timestamp() - interval '1 day', 'active',
    'bootstrap_manifest', 'reviewer_test', 'platform-admin-security-v1',
    'platform-admin-coverage-v1', 'platform-admin-minimization-v1',
    'reviewer-security-evidence', 'reviewer_test'
  );
  return actor_id;
end
$function$;

create function pg_temp.seed_supplier(p_number integer, p_status text default 'approved')
returns uuid language plpgsql volatile set search_path = pg_catalog
as $function$
declare supplier_id uuid := pg_temp.reviewer_id(p_number);
begin
  insert into public.supplier_profiles (
    id, name_original, display_name, name_language, name_ar, name_en,
    short_description, business_type, listing_status, verification_status,
    source_type, confidence_level, has_direct_experience, source_note
  ) values (
    supplier_id, 'Synthetic Supplier ' || p_number::text,
    'Synthetic Supplier ' || p_number::text, 'mixed',
    'مجهز تجريبي ' || p_number::text, 'Synthetic Supplier ' || p_number::text,
    'Reviewer-safe synthetic supplier summary', 'company', p_status,
    case when p_status = 'watchlist' then 'watchlist' else 'verified' end,
    'other', 'low', 'no', 'HIDDEN-SUPPLIER-SOURCE-NOTE'
  );
  return supplier_id;
end
$function$;

select pg_temp.seed_eligible_actor(1, 'owner');
select pg_temp.seed_eligible_actor(2, 'admin');
select pg_temp.seed_eligible_actor(3, 'owner');
select pg_temp.seed_eligible_actor(4, 'owner');
select pg_temp.seed_eligible_actor(5, 'owner');
select pg_temp.seed_eligible_actor(6, 'admin');
select pg_temp.seed_eligible_actor(7, 'admin');
select pg_temp.seed_eligible_actor(8, 'owner');
select pg_temp.seed_eligible_actor(9, 'owner');
select pg_temp.seed_eligible_actor(13, 'admin');
select pg_temp.seed_eligible_actor(14, 'owner');
select pg_temp.seed_eligible_actor(15, 'admin');
select pg_temp.seed_eligible_actor(16, 'admin');
select pg_temp.seed_eligible_actor(17, 'owner');
select pg_temp.seed_eligible_actor(18, 'owner');
select pg_temp.seed_eligible_actor(19, 'owner');
select pg_temp.seed_eligible_actor(20, 'admin');
select pg_temp.seed_eligible_actor(21, 'admin');
select pg_temp.seed_eligible_actor(22, 'owner');
select pg_temp.seed_eligible_actor(23, 'admin');
select pg_temp.seed_eligible_actor(24, 'owner');
select pg_temp.seed_eligible_actor(25, 'owner');

update public.user_profiles set account_status = 'suspended',
  suspended_at = pg_catalog.statement_timestamp(), suspension_reason = 'reviewer_test'
where id = pg_temp.reviewer_id(5);
delete from internal.security_eligibility_assessments
where user_profile_id = pg_temp.reviewer_id(6);
update internal.identity_provider_links set provider_state_version = 'unsupported-provider-state'
where user_profile_id = pg_temp.reviewer_id(13);
update public.user_profiles set account_context = 'supplier'
where id = pg_temp.reviewer_id(14);
update public.access_grants set valid_from = pg_catalog.statement_timestamp() - interval '2 days',
  valid_until = pg_catalog.statement_timestamp() - interval '1 day'
where user_profile_id = pg_temp.reviewer_id(15);
update internal.security_eligibility_assessments set assessment_result = 'deny',
  condition_type = 'security_hold',
  assessment_source_type = 'trusted_security_system'
where user_profile_id = pg_temp.reviewer_id(16);
update public.platform_role_assignments set authorization_policy_version = 'unsupported-role-policy'
where user_profile_id = pg_temp.reviewer_id(17);
update public.user_profiles set verification_mirror_status = 'unverified'
where id = pg_temp.reviewer_id(18);
delete from public.access_grants where user_profile_id = pg_temp.reviewer_id(19);
delete from public.platform_role_assignments where user_profile_id = pg_temp.reviewer_id(19);
delete from public.access_grants where user_profile_id = pg_temp.reviewer_id(20);
update public.access_grants set authorization_policy_version = 'unsupported-access-policy'
where user_profile_id = pg_temp.reviewer_id(21);
update internal.security_eligibility_assessments
set assessment_result = 'unknown', condition_type = 'reconciliation_required',
    assessment_source_type = 'trusted_security_system'
where user_profile_id = pg_temp.reviewer_id(22);
update internal.security_eligibility_assessments
set security_policy_version = 'unsupported-security-policy'
where user_profile_id = pg_temp.reviewer_id(23);
update internal.identity_provider_links set provider_code = 'oidc'
where user_profile_id = pg_temp.reviewer_id(24);
update public.platform_role_assignments
set valid_until = pg_catalog.statement_timestamp() - interval '1 second'
where user_profile_id = pg_temp.reviewer_id(25);

select throws_ok(
  $sql$
    insert into public.platform_role_assignments (
      id, user_profile_id, role_code, assignment_status, valid_from,
      authorization_policy_version, assignment_source_type,
      assignment_reason_code, evidence_reference, assignment_system_source
    ) values (
      '20000000-0000-4000-8000-000000000709'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'admin', 'active', pg_catalog.statement_timestamp() - interval '1 day',
      'platform-role-policy-v1', 'bootstrap_manifest', 'reviewer_test',
      'ambiguous-role-evidence', 'reviewer_test'
    )
  $sql$,
  null,
  'role interval exclusion prevents an ambiguous current role state'
);

insert into public.user_profiles (
  id, full_name, account_context, display_email, phone_number,
  legacy_organization, job_title
) values
  (pg_temp.reviewer_id(10), 'Synthetic Claimant Ten', 'supplier',
   'HIDDEN-CLAIMANT-EMAIL@example.invalid', 'HIDDEN-CLAIMANT-PHONE',
   'Claimant Submitted Organization', 'Claimant Submitted Job'),
  (pg_temp.reviewer_id(11), 'Synthetic Claimant Eleven', 'supplier',
   'hidden-eleven@example.invalid', 'hidden-eleven-phone', null, null),
  (pg_temp.reviewer_id(12), 'Synthetic Claimant Twelve', 'supplier',
   'hidden-twelve@example.invalid', 'hidden-twelve-phone', null, null);

select pg_temp.seed_supplier(101);
select pg_temp.seed_supplier(102);
select pg_temp.seed_supplier(103);
select pg_temp.seed_supplier(104);
select pg_temp.seed_supplier(105);
select pg_temp.seed_supplier(106);
select pg_temp.seed_supplier(107, 'watchlist');
select pg_temp.seed_supplier(108);
select pg_temp.seed_supplier(109);

insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, valid_from,
  establishment_source_type, establishment_reason_code,
  establishment_system_source, established_at
) values
  (pg_temp.reviewer_id(801), pg_temp.reviewer_id(101), pg_temp.reviewer_id(8),
   pg_catalog.statement_timestamp() - interval '10 days', 'legacy_reconciliation',
   'reviewer_test', 'reviewer_test', pg_catalog.statement_timestamp() - interval '10 days'),
  (pg_temp.reviewer_id(802), pg_temp.reviewer_id(102), pg_temp.reviewer_id(8),
   pg_catalog.statement_timestamp() - interval '10 days', 'legacy_reconciliation',
   'reviewer_test', 'reviewer_test', pg_catalog.statement_timestamp() - interval '10 days');

-- Owner queue target, competing claimant conflict, due queue row.
insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, submitted_at, expires_at,
  submitted_reason, claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors, created_at, updated_at
) values
  (pg_temp.reviewer_id(1001), pg_temp.reviewer_id(4), pg_temp.reviewer_id(101),
   pg_catalog.statement_timestamp() - interval '1 hour',
   pg_catalog.statement_timestamp() + interval '10 days',
   'Owner queue synthetic submitted reason', 'claimant_snapshot_v1',
   '{"full_name":"Hidden Owner Queue Claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-QUEUE-FINGERPRINT', 'claim_evidence_v1', '[]'::jsonb,
   pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'),
  (pg_temp.reviewer_id(1003), pg_temp.reviewer_id(10), pg_temp.reviewer_id(103),
   pg_catalog.statement_timestamp() - interval '2 hours',
   pg_catalog.statement_timestamp(),
   'Due Owner queue synthetic reason', 'claimant_snapshot_v1',
   '{"full_name":"Due Hidden Claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-DUE-FINGERPRINT', 'claim_evidence_v1', '[]'::jsonb,
   pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() - interval '2 hours');

insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status,
  submitted_at, expires_at, submitted_reason,
  claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version,
  reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
  reviewer_assignment_source_code, reviewer_assignment_policy_version,
  created_at, updated_at
) values
  (pg_temp.reviewer_id(1002), pg_temp.reviewer_id(9), pg_temp.reviewer_id(101),
   'under_review', pg_catalog.statement_timestamp() - interval '2 hours',
   pg_catalog.statement_timestamp() + interval '10 days',
   'Competing synthetic claim', 'claimant_snapshot_v1',
   '{"full_name":"Competing Hidden Claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-COMPETING-FINGERPRINT', 'claim_evidence_v1', '[]'::jsonb,
   pg_temp.reviewer_id(7), 1, pg_catalog.statement_timestamp() - interval '1 hour',
   pg_temp.reviewer_id(3), 'owner_assignment', 'claim_reviewer_assignment_v1',
   pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() - interval '1 hour');

-- Valid rejected predecessor and assigned-reviewer detail rows.
insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status, submitted_at, expires_at,
  submitted_reason, claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version, reviewer_assigned_at,
  reviewer_assigned_by_user_profile_id, reviewer_assignment_source_code,
  reviewer_assignment_policy_version, decided_by_user_profile_id, decided_at,
  decision_reason_code, evidence_verification_method_code,
  evidence_verification_version, evidence_verification_outcome_code,
  decision_authorization_policy_version, reviewer_notes, created_at, updated_at
) values (
  pg_temp.reviewer_id(1999), pg_temp.reviewer_id(10), pg_temp.reviewer_id(102),
  'rejected', pg_catalog.statement_timestamp() - interval '20 days',
  pg_catalog.statement_timestamp() + interval '10 days', 'Prior hidden reason',
  'claimant_snapshot_v1', '{"full_name":"Prior Hidden Claimant"}'::jsonb,
  'claim_submit_v1', 'HIDDEN-PRIOR-FINGERPRINT', 'claim_evidence_v1', '[]'::jsonb,
  pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '19 days',
  pg_temp.reviewer_id(1), 'owner_assignment', 'claim_reviewer_assignment_v1',
  pg_temp.reviewer_id(2), pg_catalog.statement_timestamp() - interval '18 days',
  'insufficient_evidence', 'manual_review', 'claim_evidence_review_v1', 'not_verified',
  'claim_decision_v1', 'HIDDEN-REVIEWER-NOTES',
  pg_catalog.statement_timestamp() - interval '20 days', pg_catalog.statement_timestamp() - interval '18 days'
);

insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status, record_version,
  submitted_at, expires_at, submitted_reason,
  claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version, reviewer_assigned_at,
  reviewer_assigned_by_user_profile_id, reviewer_assignment_source_code,
  reviewer_assignment_policy_version, prior_claim_id, created_at, updated_at
) values
  (pg_temp.reviewer_id(2001), pg_temp.reviewer_id(10), pg_temp.reviewer_id(102),
   'under_review', 2, pg_catalog.statement_timestamp() - interval '2 days',
   pg_catalog.statement_timestamp() + interval '20 days',
   'Reviewer-visible bounded submitted reason', 'claimant_snapshot_v1',
   '{"full_name":"Synthetic Claimant Ten","organization":"Claimant Submitted Organization","job_title":"Claimant Submitted Job","email":"HIDDEN-CLAIMANT-EMAIL@example.invalid","phone":"HIDDEN-CLAIMANT-PHONE","city":"HIDDEN-CLAIMANT-CITY"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-DETAIL-FINGERPRINT', 'claim_evidence_v1',
   '[{"kind":"company_domain_email","summary":"Claimant supplied company domain email evidence.","reference_url":"https://evidence.example.com/private/path?secret=HIDDEN"},{"kind":"company_website","summary":"Claimant supplied public company website evidence."},{"kind":"commercial_registration","summary":"Claimant supplied commercial registration evidence."}]'::jsonb,
   pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '1 day',
   pg_temp.reviewer_id(1), 'owner_assignment', 'claim_reviewer_assignment_v1',
   pg_temp.reviewer_id(1999), pg_catalog.statement_timestamp() - interval '2 days',
   pg_catalog.statement_timestamp() - interval '1 day'),
  (pg_temp.reviewer_id(2002), pg_temp.reviewer_id(11), pg_temp.reviewer_id(106),
   'under_review', 2, pg_catalog.statement_timestamp() - interval '2 days',
   pg_catalog.statement_timestamp() + interval '21 days',
   'Second Reviewer-visible bounded reason', 'claimant_snapshot_v1',
   '{"full_name":"Synthetic Claimant Eleven"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-SECOND-FINGERPRINT', 'claim_evidence_v1',
   '[{"kind":"authorization_letter","summary":"Claimant supplied authorization letter description."},{"kind":"other","summary":"Claimant supplied other bounded evidence description."}]'::jsonb,
   pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '1 day',
   pg_temp.reviewer_id(1), 'owner_assignment', 'claim_reviewer_assignment_v1',
   null, pg_catalog.statement_timestamp() - interval '2 days',
   pg_catalog.statement_timestamp() - interval '1 day'),
  (pg_temp.reviewer_id(2003), pg_temp.reviewer_id(12), pg_temp.reviewer_id(107),
   'under_review', 2, pg_catalog.statement_timestamp() - interval '2 days',
   pg_catalog.statement_timestamp() + interval '22 days',
   'Unavailable Supplier Reviewer reason', 'claimant_snapshot_v1',
   '{"full_name":"Synthetic Claimant Twelve"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-THIRD-FINGERPRINT', 'claim_evidence_v1', '[]'::jsonb,
   pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '1 day',
   pg_temp.reviewer_id(1), 'owner_assignment', 'claim_reviewer_assignment_v1',
   null, pg_catalog.statement_timestamp() - interval '2 days',
   pg_catalog.statement_timestamp() - interval '1 day');

-- Due, unsupported-version/policy, malformed self-assignment, and other reviewer rows.
insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status, submitted_at, expires_at,
  submitted_reason, claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version, reviewer_assigned_at,
  reviewer_assigned_by_user_profile_id, reviewer_assignment_source_code,
  reviewer_assignment_policy_version, created_at, updated_at
) values
  (pg_temp.reviewer_id(2101), pg_temp.reviewer_id(10), pg_temp.reviewer_id(104),
   'under_review', pg_catalog.statement_timestamp() - interval '3 hours',
   pg_catalog.statement_timestamp() - interval '1 hour', 'Due review reason',
   'claimant_snapshot_v1', '{"full_name":"Due reviewer claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-2101', 'claim_evidence_v1', '[]'::jsonb,
   pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '2 hours',
   pg_temp.reviewer_id(1), 'owner_assignment', 'claim_reviewer_assignment_v1',
   pg_catalog.statement_timestamp() - interval '3 hours', pg_catalog.statement_timestamp() - interval '2 hours'),
  (pg_temp.reviewer_id(2102), pg_temp.reviewer_id(10), pg_temp.reviewer_id(105),
   'under_review', pg_catalog.statement_timestamp() - interval '2 hours',
   pg_catalog.statement_timestamp() + interval '2 days', 'Unsupported assignment version',
   'claimant_snapshot_v1', '{"full_name":"Unsupported version claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-2102', 'claim_evidence_v1', '[]'::jsonb,
   pg_temp.reviewer_id(2), 2, pg_catalog.statement_timestamp() - interval '1 hour',
   pg_temp.reviewer_id(1), 'owner_assignment', 'claim_reviewer_assignment_v1',
   pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() - interval '1 hour'),
  (pg_temp.reviewer_id(2103), pg_temp.reviewer_id(11), pg_temp.reviewer_id(108),
   'under_review', pg_catalog.statement_timestamp() - interval '2 hours',
   pg_catalog.statement_timestamp() + interval '2 days', 'Unsupported assignment policy',
   'claimant_snapshot_v1', '{"full_name":"Unsupported policy claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-2103', 'claim_evidence_v1', '[]'::jsonb,
   pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '1 hour',
   pg_temp.reviewer_id(1), 'owner_assignment', 'unsupported_assignment_policy',
   pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() - interval '1 hour'),
  (pg_temp.reviewer_id(2104), pg_temp.reviewer_id(12), pg_temp.reviewer_id(109),
   'under_review', pg_catalog.statement_timestamp() - interval '2 hours',
   pg_catalog.statement_timestamp() + interval '2 days', 'Persisted self assignment',
   'claimant_snapshot_v1', '{"full_name":"Self assignment claimant"}'::jsonb,
   'claim_submit_v1', 'HIDDEN-2104', 'claim_evidence_v1', '[]'::jsonb,
   pg_temp.reviewer_id(2), 1, pg_catalog.statement_timestamp() - interval '1 hour',
   pg_temp.reviewer_id(2), 'owner_assignment', 'claim_reviewer_assignment_v1',
   pg_catalog.statement_timestamp() - interval '2 hours', pg_catalog.statement_timestamp() - interval '1 hour');

-- Private evaluator and current-resolver parity.
grant mujahiz_claim_owner_projection to postgres with set true;
set role mujahiz_claim_owner_projection;
select
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(1))) as owner_decision,
  (select decision || ':' || coalesce(role_code, '<null>') from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(1))) as owner_result,
  (select role_code from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(2))) as admin_role,
  (select decision || ':' || coalesce(role_code, '<null>') from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(2))) as admin_result,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(5))) as suspended_decision,
  (select decision || ':' || coalesce(role_code, '<null>') from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(5))) as suspended_result,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(6))) as missing_security_decision,
  (select decision || ':' || coalesce(role_code, '<null>') from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(6))) as missing_security_result,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(13))) as unsupported_provider_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(14))) as wrong_context_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(15))) as expired_access_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(16))) as security_hold_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(17))) as unsupported_role_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(18))) as unverified_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(19))) as missing_role_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(20))) as missing_access_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(21))) as unsupported_access_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(22))) as security_unknown_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(23))) as unsupported_security_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(24))) as provider_mismatch_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(25))) as expired_role_decision,
  (select decision from claim_security.privileged_actor_for_profile_v1(null::uuid)) as null_profile_decision
\gset private_
reset role;
revoke set option for mujahiz_claim_owner_projection from postgres;

select is(:'private_owner_decision'::text, 'eligible', 'private evaluator recognizes eligible Owner');
select is(:'private_admin_role'::text, 'admin', 'private evaluator returns eligible Admin role');
select is(:'private_suspended_decision'::text, 'denied', 'suspended actor is denied');
select is(:'private_missing_security_decision'::text, 'unknown', 'missing security assessment is unknown');
select is(:'private_unsupported_provider_decision'::text, 'unknown', 'unsupported provider state is unknown');
select is(:'private_wrong_context_decision'::text, 'denied', 'wrong Buyer account context is denied');
select is(:'private_expired_access_decision'::text, 'denied', 'expired access is denied under half-open time');
select is(:'private_security_hold_decision'::text, 'denied', 'current security hold is denied');
select is(:'private_unsupported_role_decision'::text, 'unknown', 'unsupported role policy is unknown');
select is(:'private_unverified_decision'::text, 'denied', 'unverified profile state is denied');
select is(:'private_missing_role_decision'::text, 'unknown', 'missing role assignment is unknown');
select is(:'private_missing_access_decision'::text, 'unknown', 'missing platform-administration access is unknown');
select is(:'private_unsupported_access_decision'::text, 'unknown', 'unsupported access policy is unknown');
select is(:'private_security_unknown_decision'::text, 'unknown', 'explicit security reconciliation state is unknown');
select is(:'private_unsupported_security_decision'::text, 'unknown', 'unsupported security policy is unknown');
select is(:'private_provider_mismatch_decision'::text, 'unknown', 'missing Firebase provider match is unknown');
select is(:'private_expired_role_decision'::text, 'denied', 'role ending at the half-open boundary is denied');
select is(:'private_null_profile_decision'::text, 'unknown', 'null arbitrary profile is unknown');

grant mujahiz_claim_runtime to postgres with set true;
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(1));
select decision || ':' || coalesce(role_code, '<null>') as result
from claim_security.current_privileged_actor_v1() \gset current_owner_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select decision || ':' || coalesce(role_code, '<null>') as result
from claim_security.current_privileged_actor_v1() \gset current_admin_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(5));
select decision || ':' || coalesce(role_code, '<null>') as result
from claim_security.current_privileged_actor_v1() \gset current_suspended_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(6));
select decision || ':' || coalesce(role_code, '<null>') as result
from claim_security.current_privileged_actor_v1() \gset current_missing_security_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(15));
select decision from claim_security.current_privileged_actor_v1() \gset current_expired_access_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(16));
select decision from claim_security.current_privileged_actor_v1() \gset current_security_deny_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(17));
select decision from claim_security.current_privileged_actor_v1() \gset current_unsupported_role_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(21));
select decision from claim_security.current_privileged_actor_v1() \gset current_unsupported_access_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(23));
select decision from claim_security.current_privileged_actor_v1() \gset current_unsupported_security_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(25));
select decision from claim_security.current_privileged_actor_v1() \gset current_expired_role_
reset role;

select is(:'current_owner_result'::text, :'private_owner_result'::text,
  'current resolver and private evaluator have eligible Owner parity');
select is(:'current_admin_result'::text, :'private_admin_result'::text,
  'current resolver and private evaluator have eligible Admin parity');
select is(:'current_suspended_result'::text, :'private_suspended_result'::text,
  'current resolver and private evaluator have denied parity');
select is(:'current_missing_security_result'::text, :'private_missing_security_result'::text,
  'current resolver and private evaluator have unknown parity');
select is(:'current_expired_access_decision'::text, :'private_expired_access_decision'::text,
  'current resolver and private evaluator have expired-access parity');
select is(:'current_security_deny_decision'::text, :'private_security_hold_decision'::text,
  'current resolver and private evaluator have security-deny parity');
select is(:'current_unsupported_role_decision'::text, :'private_unsupported_role_decision'::text,
  'current resolver and private evaluator have unsupported-role-version parity');
select is(:'current_unsupported_access_decision'::text, :'private_unsupported_access_decision'::text,
  'current resolver and private evaluator have unsupported-access-version parity');
select is(:'current_unsupported_security_decision'::text, :'private_unsupported_security_decision'::text,
  'current resolver and private evaluator have unsupported-security-version parity');
select is(:'current_expired_role_decision'::text, :'private_expired_role_decision'::text,
  'current resolver and private evaluator have role-boundary parity');

-- Runtime projection behavior is captured under the exact execution role.
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(1));
select count(*)::text as row_count,
  min(claim_id::text) as first_claim,
  min(status) as only_status,
  count(*) filter (where claim_id = pg_temp.reviewer_id(1003))::text as due_count
from claim_api.owner_assignment_queue_v1(null, null, 50) \gset owner_queue_
select count(*)::text as bounded_count
from claim_api.owner_assignment_queue_v1(null, null, 1) \gset owner_limit_
select count(*)::text as invalid_limit_count
from claim_api.owner_assignment_queue_v1(null, null, 101) \gset owner_invalid_
select count(*)::text as mismatched_cursor_count
from claim_api.owner_assignment_queue_v1(pg_catalog.statement_timestamp(), null, 50) \gset owner_cursor_
select count(*)::text as candidate_count,
  count(*) filter (where reviewer_user_profile_id = pg_temp.reviewer_id(2) and role_code = 'admin')::text as admin_count,
  count(*) filter (where reviewer_user_profile_id = pg_temp.reviewer_id(3) and role_code = 'owner')::text as owner_count,
  count(*) filter (where reviewer_user_profile_id in (
    pg_temp.reviewer_id(1), pg_temp.reviewer_id(4), pg_temp.reviewer_id(5),
    pg_temp.reviewer_id(6), pg_temp.reviewer_id(8), pg_temp.reviewer_id(9),
    pg_temp.reviewer_id(13), pg_temp.reviewer_id(14), pg_temp.reviewer_id(15),
    pg_temp.reviewer_id(16), pg_temp.reviewer_id(17), pg_temp.reviewer_id(18),
    pg_temp.reviewer_id(19), pg_temp.reviewer_id(20), pg_temp.reviewer_id(21),
    pg_temp.reviewer_id(22), pg_temp.reviewer_id(23), pg_temp.reviewer_id(24),
    pg_temp.reviewer_id(25)
  ))::text as prohibited_count
from claim_api.owner_reviewer_candidates_v1(pg_temp.reviewer_id(1001), null, 50) \gset candidates_
select count(*)::text as bounded_count
from claim_api.owner_reviewer_candidates_v1(pg_temp.reviewer_id(1001), null, 1) \gset candidate_limit_
reset role;

select is(:'owner_queue_row_count'::bigint, 1::bigint,
  'usable Owner receives only the coherent unexpired unassigned submitted row');
select is(:'owner_queue_first_claim'::text, pg_temp.reviewer_id(1001)::text,
  'Owner queue returns the expected Claim');
select is(:'owner_queue_only_status'::text, 'submitted', 'Owner queue status is literal submitted');
select is(:'owner_queue_due_count'::bigint, 0::bigint, 'due submitted Claim is absent at the boundary');
select is(:'owner_limit_bounded_count'::bigint, 1::bigint, 'Owner queue limit is bounded');
select is(:'owner_invalid_invalid_limit_count'::bigint, 0::bigint, 'Owner queue rejects over-limit input without SQL detail');
select is(:'owner_cursor_mismatched_cursor_count'::bigint, 0::bigint, 'Owner queue rejects partial cursor input');
select is(:'candidates_candidate_count'::bigint, 3::bigint,
  'candidate list returns only eligible conflict-clear Owner/Admin candidates');
select is(:'candidates_admin_count'::bigint, 1::bigint, 'eligible Admin candidate is returned');
select is(:'candidates_owner_count'::bigint, 1::bigint, 'eligible Owner candidate is returned');
select is(:'candidates_prohibited_count'::bigint, 0::bigint,
  'assigner, claimant, denied/unknown, controller, and competing claimant are omitted');
select is(:'candidate_limit_bounded_count'::bigint, 1::bigint, 'candidate projection is bounded');

set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as queue_count,
  count(*) filter (where claim_id = pg_temp.reviewer_id(2101))::text as due_count,
  count(*) filter (where claim_id in (pg_temp.reviewer_id(2102), pg_temp.reviewer_id(2103), pg_temp.reviewer_id(2104)))::text as unsupported_count
from claim_api.reviewer_queue_v1(null, null, 50) \gset reviewer_queue_
select count(*)::text as detail_count,
  min(supplier_review_eligibility_code) as eligibility_code,
  min(prior_claim_id::text) as prior_id,
  min(prior_claim_status) as prior_status,
  min(prior_claim_result_code) as prior_result,
  min(claimant_display_name) as claimant_label,
  min(claimant_organization_label) as organization_label,
  min(claimant_job_title) as job_title,
  min(evidence_descriptors::text) as evidence_text,
  min(row(detail_row.*)::text) as complete_text
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) as detail_row \gset reviewer_detail_
select pg_catalog.string_agg(kind, ',' order by ordinal)::text as kinds,
  pg_catalog.string_agg(coalesce(reference_hostname, '<null>'), ',' order by ordinal)::text as hosts,
  pg_catalog.string_agg(reference_unavailable::text, ',' order by ordinal)::text as unavailable
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) as detail_row
cross join lateral pg_catalog.unnest(detail_row.evidence_descriptors)
  with ordinality as evidence(kind, summary, reference_hostname, reference_unavailable, ordinal) \gset evidence_main_
select pg_catalog.string_agg(kind, ',' order by ordinal)::text as kinds
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2002)) as detail_row
cross join lateral pg_catalog.unnest(detail_row.evidence_descriptors)
  with ordinality as evidence(kind, summary, reference_hostname, reference_unavailable, ordinal) \gset evidence_second_
select min(supplier_review_eligibility_code) as eligibility_code
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2002)) \gset eligible_supplier_
select min(supplier_review_eligibility_code) as eligibility_code
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2003)) \gset unavailable_supplier_
reset role;

select is(:'reviewer_queue_queue_count'::bigint, 3::bigint,
  'exact assigned reviewer sees only three supported current assignments');
select is(:'reviewer_queue_due_count'::bigint, 0::bigint,
  'under-review Claim at/after expires_at is absent');
select is(:'reviewer_queue_unsupported_count'::bigint, 0::bigint,
  'unsupported assignment version/policy and self-assignment are absent');
select is(:'reviewer_detail_detail_count'::bigint, 1::bigint,
  'exact assigned reviewer receives one authorized detail row');
select is(:'reviewer_detail_eligibility_code'::text, 'already_owned',
  'detail derives already_owned without controller identity');
select is(:'eligible_supplier_eligibility_code'::text, 'eligible',
  'detail derives eligible for an approved unowned Supplier');
select is(:'unavailable_supplier_eligibility_code'::text, 'unavailable',
  'detail derives unavailable for a watchlisted Supplier');
select is(:'reviewer_detail_prior_id'::text, pg_temp.reviewer_id(1999)::text,
  'detail returns only the validated same-party prior Claim UUID');
select is(:'reviewer_detail_prior_status'::text, 'rejected', 'prior safe status is rejected');
select is(:'reviewer_detail_prior_result'::text, 'not_approved', 'prior result is minimized');
select is(:'reviewer_detail_claimant_label'::text, 'Synthetic Claimant Ten',
  'detail returns claimant-submitted display label');
select is(:'reviewer_detail_organization_label'::text, 'Claimant Submitted Organization',
  'detail returns nullable claimant-submitted organization label');
select is(:'reviewer_detail_job_title'::text, 'Claimant Submitted Job',
  'detail returns nullable claimant-submitted job title');
select is(:'evidence_main_kinds'::text, 'company_domain_email,company_website,commercial_registration',
  'first detail covers the first three approved evidence kinds in stored order');
select is(:'evidence_second_kinds'::text, 'authorization_letter,other',
  'second detail covers the remaining approved evidence kinds in stored order');
select is(:'evidence_main_hosts'::text, 'evidence.example.com,<null>,<null>',
  'detail returns only a sanitized reference hostname');
select is(:'evidence_main_unavailable'::text, 'true,false,false',
  'raw evidence reference remains unavailable');
select ok(:'reviewer_detail_evidence_text'::text !~ 'https://|private/path|secret=HIDDEN',
  'typed evidence output contains no raw reference URL, path, or query secret');
select ok(:'reviewer_detail_complete_text'::text !~ 'HIDDEN-CLAIMANT-EMAIL|HIDDEN-CLAIMANT-PHONE|HIDDEN-CLAIMANT-CITY|HIDDEN-DETAIL-FINGERPRINT|HIDDEN-REVIEWER-NOTES|HIDDEN-SUPPLIER-SOURCE-NOTE|owner_assignment|claim_reviewer_assignment_v1',
  'detail output excludes claimant contact, fingerprint, notes, Supplier provenance, and assignment provenance');

-- Cross-audience and current-eligibility denial cases.
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(7));
select count(*)::text as cross_detail_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset cross_reviewer_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(1));
select count(*)::text as assigning_owner_detail_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset assigning_owner_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(10));
select count(*)::text as claimant_detail_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset claimant_private_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as admin_owner_queue_count
from claim_api.owner_assignment_queue_v1(null, null, 50) \gset admin_owner_queue_
reset role;
select is(:'cross_reviewer_cross_detail_count'::bigint, 0::bigint,
  'a different usable reviewer cannot open the target detail');
select is(:'assigning_owner_assigning_owner_detail_count'::bigint, 0::bigint,
  'assigning Owner cannot open reviewer detail');
select is(:'claimant_private_claimant_detail_count'::bigint, 0::bigint,
  'claimant cannot open reviewer detail');
select is(:'admin_owner_queue_admin_owner_queue_count'::bigint, 0::bigint,
  'Admin cannot use the Owner assignment queue');

set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(8));
select count(*)::text as controller_queue_count
from claim_api.owner_assignment_queue_v1(null, null, 50) \gset controller_owner_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(9));
select count(*)::text as competing_queue_count
from claim_api.owner_assignment_queue_v1(null, null, 50) \gset competing_owner_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(5));
select count(*)::text as unusable_queue_count
from claim_api.owner_assignment_queue_v1(null, null, 50) \gset unusable_owner_
reset role;
select is(:'controller_owner_controller_queue_count'::bigint, 0::bigint,
  'target Supplier controller conflict denies Owner queue row');
select is(:'competing_owner_competing_queue_count'::bigint, 0::bigint,
  'same-Supplier competing claimant conflict denies Owner queue row');
select is(:'unusable_owner_unusable_queue_count'::bigint, 0::bigint,
  'unusable Owner receives no queue row');

update internal.security_eligibility_assessments
set assessment_result = 'deny', condition_type = 'security_hold',
    assessment_source_type = 'trusted_security_system'
where user_profile_id = pg_temp.reviewer_id(2);
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as held_queue_count
from claim_api.reviewer_queue_v1(null, null, 50) \gset held_reviewer_
select count(*)::text as held_detail_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset held_detail_
reset role;
select is(:'held_reviewer_held_queue_count'::bigint, 0::bigint,
  'security-held assigned reviewer loses queue access immediately');
select is(:'held_detail_held_detail_count'::bigint, 0::bigint,
  'security-held assigned reviewer loses detail access immediately');
update internal.security_eligibility_assessments
set assessment_result = 'clear', condition_type = 'complete_clear',
    assessment_source_type = 'bootstrap_manifest'
where user_profile_id = pg_temp.reviewer_id(2);

update public.supplier_ownerships
set controller_user_profile_id = pg_temp.reviewer_id(2)
where id = pg_temp.reviewer_id(802);
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as conflicted_detail_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset conflicted_reviewer_
reset role;
select is(:'conflicted_reviewer_conflicted_detail_count'::bigint, 0::bigint,
  'assigned reviewer controller conflict denies detail immediately');
update public.supplier_ownerships
set controller_user_profile_id = pg_temp.reviewer_id(8)
where id = pg_temp.reviewer_id(802);

-- Evidence and snapshot corruption fail closed without exposing SQL/internal detail.
update public.supplier_ownership_claims
set evidence_descriptors = '[{"kind":"other","summary":"Valid bounded summary with hidden extra field.","email":"HIDDEN-EXTRA-EMAIL"}]'::jsonb
where id = pg_temp.reviewer_id(2001);
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as extra_field_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset invalid_extra_
reset role;
select is(:'invalid_extra_extra_field_count'::bigint, 0::bigint,
  'evidence descriptor extra field fails closed');
update public.supplier_ownership_claims
set evidence_schema_version = 'unsupported_evidence_v2'
where id = pg_temp.reviewer_id(2001);
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as unsupported_schema_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset invalid_schema_
reset role;
select is(:'invalid_schema_unsupported_schema_count'::bigint, 0::bigint,
  'unsupported evidence schema fails closed');
update public.supplier_ownership_claims
set evidence_schema_version = 'claim_evidence_v1',
    evidence_descriptors = '[]'::jsonb,
    claimant_snapshot = '{"full_name":7,"email":"HIDDEN-SNAPSHOT-EMAIL"}'::jsonb
where id = pg_temp.reviewer_id(2001);
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as invalid_snapshot_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2001)) \gset invalid_snapshot_
reset role;
select is(:'invalid_snapshot_invalid_snapshot_count'::bigint, 0::bigint,
  'malformed claimant label snapshot fails closed');

-- Known future relationship coverage forces unknown/deny even when empty.
create table public.supplier_memberships (id uuid primary key);
set role mujahiz_claim_runtime;
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(1));
select count(*)::text as future_owner_count
from claim_api.owner_assignment_queue_v1(null, null, 50) \gset future_owner_
select count(*)::text as future_candidate_count
from claim_api.owner_reviewer_candidates_v1(pg_temp.reviewer_id(1001), null, 50) \gset future_candidates_
select claim_security.establish_claim_runtime_context(pg_temp.reviewer_id(2));
select count(*)::text as future_reviewer_count
from claim_api.reviewer_queue_v1(null, null, 50) \gset future_reviewer_
select count(*)::text as future_detail_count
from claim_api.reviewer_detail_v1(pg_temp.reviewer_id(2002)) \gset future_detail_
reset role;
select is(:'future_owner_future_owner_count'::bigint, 0::bigint,
  'future membership authority makes Owner conflict coverage unknown');
select is(:'future_candidates_future_candidate_count'::bigint, 0::bigint,
  'future membership authority omits every candidate');
select is(:'future_reviewer_future_reviewer_count'::bigint, 0::bigint,
  'future membership authority removes reviewer queue rows');
select is(:'future_detail_future_detail_count'::bigint, 0::bigint,
  'future membership authority denies reviewer detail');
drop table public.supplier_memberships;

-- Direct access remains denied and no writes occurred through any projection.
-- Test-only pgTAP schema visibility lets the runtime role invoke throws_ok;
-- the grant is transaction-local and revoked immediately after the checks.
grant usage on schema extensions to mujahiz_claim_runtime;
set role mujahiz_claim_runtime;
select throws_ok(
  $sql$select submitted_reason from public.supplier_ownership_claims$sql$,
  null,
  'runtime cannot read Reviewer-private base column'
);
select throws_ok(
  $sql$update public.supplier_ownership_claims set record_version = record_version + 1$sql$,
  null,
  'runtime cannot mutate Claim rows'
);
select throws_ok(
  $sql$select * from claim_security.privileged_actor_for_profile_v1('20000000-0000-4000-8000-000000000001'::uuid)$sql$,
  null,
  'runtime cannot call arbitrary-profile evaluator'
);
reset role;
revoke usage on schema extensions from mujahiz_claim_runtime;

-- An unreadable required dependency is contained inside the private evaluator.
revoke usage on schema internal from mujahiz_claim_owner_projection;
grant mujahiz_claim_owner_projection to postgres with set true;
set role mujahiz_claim_owner_projection;
select decision, coalesce(role_code, '<null>') as role_code
from claim_security.privileged_actor_for_profile_v1(pg_temp.reviewer_id(1))
\gset unreadable_dependency_
reset role;
revoke set option for mujahiz_claim_owner_projection from postgres;
select is(:'unreadable_dependency_decision'::text, 'unknown',
  'unreadable eligibility dependency fails closed without SQL detail');
select is(:'unreadable_dependency_role_code'::text, '<null>',
  'unreadable eligibility dependency exposes no role result');

select is((select count(*) from public.supplier_ownership_claims), 11::bigint,
  'read substrate created no Claim row and retained only synthetic fixtures');
select is((select count(*) from internal.audit_logs), 0::bigint,
  'read substrate wrote no audit row');
select is((select count(*) from internal.domain_events), 0::bigint,
  'read substrate wrote no event row');
select is((select count(*) from internal.idempotency_keys), 0::bigint,
  'read substrate wrote no idempotency row');

select * from finish();
rollback;
