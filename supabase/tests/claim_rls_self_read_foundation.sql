\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_catalog;

select plan(63);

select has_table('public', 'supplier_ownership_claims', 'Claim base table exists');
select has_view('public', 'supplier_ownership_claims_claimant_v1', 'Claimant-v1 minimized projection exists');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.supplier_ownership_claims'::regclass), 'Claim base table has RLS enabled');
select ok((select relforcerowsecurity from pg_catalog.pg_class where oid = 'public.supplier_ownership_claims'::regclass), 'Claim base table has FORCE ROW LEVEL SECURITY enabled');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.supplier_ownership_claims'::regclass), 1::bigint, 'Claim base table has exactly one RLS policy');
select is((
  select polname || ':' || polcmd::text || ':' || polpermissive::text || ':' || pg_catalog.pg_get_expr(polqual, polrelid)
  from pg_catalog.pg_policy
  where polrelid = 'public.supplier_ownership_claims'::regclass
), 'supplier_ownership_claims_claimant_self_select:r:true:(claimant_user_profile_id = claim_security.current_claim_user_profile_id())', 'sole policy is the exact permissive claimant self-select predicate');
select is((
  select string_agg(r.rolname, ',' order by r.rolname)
  from pg_catalog.pg_policy p
  cross join lateral unnest(p.polroles) policy_role(oid)
  join pg_catalog.pg_roles r on r.oid = policy_role.oid
  where p.polrelid = 'public.supplier_ownership_claims'::regclass
), 'mujahiz_claim_runtime', 'sole Claim policy applies only to the dedicated runtime role');
select ok((select polwithcheck is null from pg_catalog.pg_policy where polrelid = 'public.supplier_ownership_claims'::regclass), 'Claim self-read policy has no WITH CHECK expression');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.supplier_ownership_claims'::regclass and polcmd in ('a', 'w', 'd')), 0::bigint, 'no Claim mutation policy exists');
select ok(not exists (
  select 1
  from pg_catalog.pg_policy p
  cross join lateral unnest(p.polroles) policy_role(oid)
  join pg_catalog.pg_roles r on r.oid = policy_role.oid
  where p.polrelid = 'public.supplier_ownership_claims'::regclass
    and r.rolname in ('anon', 'authenticated', 'service_role')
), 'no browser, generic API, or service-role Claim policy exists');

select is((
  select string_agg(option, ',' order by option)
  from pg_catalog.pg_class c
  cross join lateral unnest(c.reloptions) option
  where c.oid = 'public.supplier_ownership_claims_claimant_v1'::regclass
  group by c.oid
), 'security_barrier=true,security_invoker=true', 'Claimant projection is a security-barrier SECURITY INVOKER view');
select is((
  select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.supplier_ownership_claims_claimant_v1'::regclass
    and a.attnum > 0
    and not a.attisdropped
), 'id:uuid,supplier_profile_id:uuid,status:text,claimant_result_code:text,submitted_at:timestamp with time zone,expires_at:timestamp with time zone,decided_at:timestamp with time zone,withdrawn_at:timestamp with time zone,expired_at:timestamp with time zone,superseded_at:timestamp with time zone,updated_at:timestamp with time zone,record_version:integer', 'Claimant projection exposes the exact minimized typed status/history fields');
select ok((
  select lower(pg_catalog.pg_get_viewdef('public.supplier_ownership_claims_claimant_v1'::regclass, true))
) !~ 'claimant_user_profile_id|submitted_reason|claimant_snapshot|evidence_descriptors|reviewer_user_profile_id|reviewer_notes|decided_by_user_profile_id|decision_reason_code|assignment|policy_version|audit|event|idempotency|provider|firebase|superseded_by_claim_id|prior_claim_id|resulting_supplier_ownership_id', 'projection definition references no restricted Claim field or internal identity/provenance surface');
select ok(obj_description('public.supplier_ownership_claims_claimant_v1'::regclass) ilike '%excludes claimant-authored private content%', 'projection comment records the minimization boundary');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security'
), 2::bigint, 'self-read slice adds no authorization routine');
select is((
  select count(*)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'claim_security' and p.prosecdef
), 0::bigint, 'Claim security boundary contains no SECURITY DEFINER routine');
select is((
  select count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal') and c.relkind in ('r', 'p')
), 22::bigint, 'self-read slice adds no physical table');
select is((
  select count(*)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal') and c.relkind = 'v'
), 1::bigint, 'self-read slice introduces exactly one public/internal view');

select ok(has_table_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims_claimant_v1', 'select'), 'runtime role can select the minimized projection');
select ok(not has_table_privilege('anon', 'public.supplier_ownership_claims_claimant_v1', 'select'), 'anon cannot select the Claim projection');
select ok(not has_table_privilege('authenticated', 'public.supplier_ownership_claims_claimant_v1', 'select'), 'authenticated cannot select the Claim projection');
select ok(not has_table_privilege('service_role', 'public.supplier_ownership_claims_claimant_v1', 'select'), 'service_role cannot select the Claim projection');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_ownership_claims_claimant_v1'::regclass
    and acl.grantee = 0
), 'PUBLIC receives no Claim projection privilege');
select ok(not has_table_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'select'), 'runtime role has no unrestricted base-table SELECT privilege');
select is((
  select string_agg(a.attname, ',' order by a.attnum)
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.supplier_ownership_claims'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', a.attname, 'select')
), 'id,supplier_profile_id,status,record_version,submitted_at,expires_at,decided_at,withdrawn_at,expired_at,superseded_at,updated_at', 'runtime base-column grants are exactly the projection inputs');
select is((
  select count(*)
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.supplier_ownership_claims'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', a.attname, 'select')
), 11::bigint, 'runtime receives exactly eleven safe base-column SELECT grants');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'claimant_user_profile_id', 'select'), 'runtime cannot read claimant identity from the base table');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'submitted_reason', 'select'), 'runtime cannot read claimant-authored reason from the base table');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'claimant_snapshot', 'select'), 'runtime cannot read claimant snapshot from the base table');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'evidence_descriptors', 'select'), 'runtime cannot read Claim evidence from the base table');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'reviewer_user_profile_id', 'select'), 'runtime cannot read reviewer identity from the base table');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'reviewer_notes', 'select'), 'runtime cannot read reviewer notes from the base table');
select ok(not has_column_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'decision_reason_code', 'select'), 'runtime cannot read restricted decision codes from the base table');
select ok(not has_table_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'insert'), 'runtime role has no Claim INSERT privilege');
select ok(not has_table_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'update'), 'runtime role has no Claim UPDATE privilege');
select ok(not has_table_privilege('mujahiz_claim_runtime', 'public.supplier_ownership_claims', 'delete'), 'runtime role has no Claim DELETE privilege');
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) api_role(role_name)
  where has_table_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'SELECT')
     or has_table_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'INSERT')
     or has_table_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'UPDATE')
     or has_table_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'DELETE')
     or has_any_column_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'SELECT')
     or has_any_column_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'INSERT')
     or has_any_column_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'UPDATE')
     or has_any_column_privilege(api_role.role_name, 'public.supplier_ownership_claims', 'REFERENCES')
), 'anon, authenticated, and service_role receive no Claim base-table authority');

insert into public.user_profiles (id, full_name, account_context)
values
  ('a1111111-1111-4111-8111-111111111111', 'Synthetic Claimant A', 'supplier'),
  ('b2222222-2222-4222-8222-222222222222', 'Synthetic Claimant B', 'supplier');

insert into public.supplier_profiles (
  id, name_original, display_name, name_language, name_en,
  business_type, source_type, confidence_level, has_direct_experience
)
values (
  'c3333333-3333-4333-8333-333333333333',
  'Synthetic RLS Supplier', 'Synthetic RLS Supplier', 'english',
  'Synthetic RLS Supplier', 'company', 'other', 'low', 'no'
);

insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, expires_at,
  submitted_reason, claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors
)
values
  (
    'd4444444-4444-4444-8444-444444444444',
    'a1111111-1111-4111-8111-111111111111',
    'c3333333-3333-4333-8333-333333333333',
    pg_catalog.statement_timestamp() + interval '30 days',
    'synthetic-private-reason-a', 'v1',
    '{"private":"synthetic-claimant-a-snapshot"}'::jsonb,
    'v1', 'synthetic-fingerprint-a', 'v1',
    '[{"kind":"synthetic-private-evidence-a"}]'::jsonb
  ),
  (
    'e5555555-5555-4555-8555-555555555555',
    'b2222222-2222-4222-8222-222222222222',
    'c3333333-3333-4333-8333-333333333333',
    pg_catalog.statement_timestamp() + interval '30 days',
    'synthetic-private-reason-b', 'v1',
    '{"private":"synthetic-claimant-b-snapshot"}'::jsonb,
    'v1', 'synthetic-fingerprint-b', 'v1',
    '[{"kind":"synthetic-private-evidence-b"}]'::jsonb
  );

grant mujahiz_claim_runtime to postgres with set true;
set role mujahiz_claim_runtime;
select pg_catalog.pg_backend_pid() as runtime_backend_pid \gset

begin;
select claim_security.establish_claim_runtime_context('a1111111-1111-4111-8111-111111111111');
select
  count(*)::text as row_count,
  min(id::text) as only_claim_id,
  coalesce(min(claimant_result_code), '<null>') as result_code,
  count(*) filter (where id = 'e5555555-5555-4555-8555-555555555555')::text as claim_b_count,
  count(*) filter (where id = 'f6666666-6666-4666-8666-666666666666')::text as unknown_count
from public.supplier_ownership_claims_claimant_v1 \gset claim_a_
select
  count(*)::text as row_count,
  count(*) filter (where id = 'e5555555-5555-4555-8555-555555555555')::text as claim_b_count
from public.supplier_ownership_claims \gset claim_a_base_
commit;

begin;
select
  (claim_security.current_claim_user_profile_id() is null)::text as principal_missing,
  (select count(*) from public.supplier_ownership_claims_claimant_v1)::text as row_count,
  (pg_catalog.pg_backend_pid() = :runtime_backend_pid)::text as same_backend
\gset context_after_commit_
commit;

\set ON_ERROR_STOP off
select * from public.supplier_ownership_claims;
\set runtime_select_star_sqlstate :SQLSTATE
select submitted_reason from public.supplier_ownership_claims;
\set runtime_reason_sqlstate :SQLSTATE
select claimant_snapshot from public.supplier_ownership_claims;
\set runtime_snapshot_sqlstate :SQLSTATE
select evidence_descriptors from public.supplier_ownership_claims;
\set runtime_evidence_sqlstate :SQLSTATE
select reviewer_user_profile_id from public.supplier_ownership_claims;
\set runtime_reviewer_id_sqlstate :SQLSTATE
select reviewer_notes from public.supplier_ownership_claims;
\set runtime_reviewer_notes_sqlstate :SQLSTATE
insert into public.supplier_ownership_claims (claimant_user_profile_id)
values ('a1111111-1111-4111-8111-111111111111');
\set runtime_insert_sqlstate :SQLSTATE
update public.supplier_ownership_claims
set record_version = record_version + 1
where id = 'd4444444-4444-4444-8444-444444444444';
\set runtime_update_sqlstate :SQLSTATE
delete from public.supplier_ownership_claims
where id = 'd4444444-4444-4444-8444-444444444444';
\set runtime_delete_sqlstate :SQLSTATE
\set ON_ERROR_STOP on

reset role;
select is(:'claim_a_row_count'::bigint, 1::bigint, 'Claimant A sees exactly one projected Claim');
select is(:'claim_a_only_claim_id'::uuid, 'd4444444-4444-4444-8444-444444444444'::uuid, 'Claimant A sees only Claim A');
select is(:'claim_a_result_code'::text, '<null>'::text, 'active Claim has no fabricated claimant result code');
select is(:'claim_a_claim_b_count'::bigint, 0::bigint, 'Claimant A cannot see Claim B by exact ID');
select is(:'claim_a_unknown_count'::bigint, 0::bigint, 'unknown Claim ID has the same zero-row projection result');
select is(:'claim_a_base_row_count'::bigint, 1::bigint, 'direct safe-column base query is still self-filtered by RLS');
select is(:'claim_a_base_claim_b_count'::bigint, 0::bigint, 'direct base exact-ID lookup cannot reveal Claim B');
select is(:'runtime_select_star_sqlstate'::text, '42501'::text, 'runtime SELECT star on the Claim base table is denied');
select is(:'runtime_reason_sqlstate'::text, '42501'::text, 'runtime cannot directly read claimant-authored reason');
select is(:'runtime_snapshot_sqlstate'::text, '42501'::text, 'runtime cannot directly read claimant snapshot');
select is(:'runtime_evidence_sqlstate'::text, '42501'::text, 'runtime cannot directly read evidence descriptors');
select is(:'runtime_reviewer_id_sqlstate'::text, '42501'::text, 'runtime cannot directly read reviewer identity');
select is(:'runtime_reviewer_notes_sqlstate'::text, '42501'::text, 'runtime cannot directly read reviewer notes');
select is(:'runtime_insert_sqlstate'::text, '42501'::text, 'runtime cannot INSERT a Claim');
select is(:'runtime_update_sqlstate'::text, '42501'::text, 'runtime cannot UPDATE a Claim');
select is(:'runtime_delete_sqlstate'::text, '42501'::text, 'runtime cannot DELETE a Claim');
select ok(:'context_after_commit_principal_missing'::boolean, 'principal context from Claimant A does not survive commit');
select is(:'context_after_commit_row_count'::bigint, 0::bigint, 'missing context returns zero projected rows on the reused backend');
select ok(:'context_after_commit_same_backend'::boolean, 'missing-context proof uses the same physical backend');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('b2222222-2222-4222-8222-222222222222');
select
  count(*)::text as row_count,
  min(id::text) as only_claim_id,
  count(*) filter (where id = 'd4444444-4444-4444-8444-444444444444')::text as claim_a_count
from public.supplier_ownership_claims_claimant_v1 \gset claim_b_
commit;
reset role;
select is(:'claim_b_row_count'::bigint, 1::bigint, 'Claimant B sees exactly one projected Claim');
select is(:'claim_b_only_claim_id'::uuid, 'e5555555-5555-4555-8555-555555555555'::uuid, 'Claimant B sees only Claim B');
select is(:'claim_b_claim_a_count'::bigint, 0::bigint, 'Claimant B cannot see Claim A');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('a1111111-1111-4111-8111-111111111111');
select pg_catalog.set_config('mujahiz.claim.purpose', 'wrong_purpose', true);
select count(*)::text as row_count
from public.supplier_ownership_claims_claimant_v1 \gset wrong_bound_
commit;
reset role;
select is(:'wrong_bound_row_count'::bigint, 0::bigint, 'wrong-bound purpose context returns zero rows');

set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('a1111111-1111-4111-8111-111111111111');
select pg_catalog.set_config('mujahiz.claim.user_profile_id', 'not-a-uuid', true);
select count(*)::text as row_count
from public.supplier_ownership_claims_claimant_v1 \gset malformed_
commit;
reset role;
select is(:'malformed_row_count'::bigint, 0::bigint, 'malformed principal context returns zero rows');

revoke mujahiz_claim_runtime from postgres granted by postgres;
select is((
  select m.admin_option::text || ':' || m.inherit_option::text || ':' || m.set_option::text
  from pg_catalog.pg_auth_members m
  where m.roleid = 'mujahiz_claim_runtime'::regrole
    and m.member = 'postgres'::regrole
), 'true:false:false', 'runtime behavior test restores the exact managed postgres membership options');

delete from public.supplier_ownership_claims
where id in (
  'd4444444-4444-4444-8444-444444444444',
  'e5555555-5555-4555-8555-555555555555'
);
delete from public.supplier_profiles
where id = 'c3333333-3333-4333-8333-333333333333';
delete from public.user_profiles
where id in (
  'a1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222'
);

select is((select count(*) from public.supplier_ownership_claims), 0::bigint, 'no synthetic Claim row persists after the security test');

select * from finish();
