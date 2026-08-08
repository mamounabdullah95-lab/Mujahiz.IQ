\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(41);

select has_table('public', 'platform_role_assignments', 'platform_role_assignments exists');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.platform_role_assignments'::regclass and attnum > 0 and not attisdropped),
  25::bigint,
  'platform_role_assignments has the approved physical-column count'
);
select ok(to_regclass('public.platform_role_assignments_user_interval_excl') is not null, 'per-user half-open validity exclusion constraint exists');
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.platform_role_assignments'::regclass and contype = 'f'),
  7::bigint,
  'platform_role_assignments has all restrictive profile and successor foreign keys'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.platform_role_assignments'::regclass and contype = 'f'
  ),
  'platform_role_assignments_assigned_by_fk:FOREIGN KEY (assigned_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|platform_role_assignments_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|platform_role_assignments_reviewed_by_fk:FOREIGN KEY (reviewed_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|platform_role_assignments_superseding_assignment_fk:FOREIGN KEY (superseding_assignment_id) REFERENCES platform_role_assignments(id) ON DELETE RESTRICT|platform_role_assignments_terminated_by_fk:FOREIGN KEY (terminated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|platform_role_assignments_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|platform_role_assignments_user_profile_fk:FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'platform-role foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.platform_role_assignments'::regclass),
  5::bigint,
  'platform_role_assignments has primary, temporal exclusion, and approved structural indexes'
);
select ok(to_regclass('public.platform_role_assignments_active_user_lookup_idx') is not null, 'direct active-role lookup index exists');
select ok(to_regclass('public.platform_role_assignments_user_status_valid_from_idx') is not null, 'user lifecycle history index exists');
select ok(to_regclass('public.platform_role_assignments_role_status_valid_from_idx') is not null, 'role lifecycle lookup index exists');
select ok(
  (select lower(pg_catalog.pg_get_indexdef('public.platform_role_assignments_active_user_lookup_idx'::regclass)))
    like '%where (assignment_status = ''active''::text)%',
  'active-role lookup index is limited to active assignments'
);
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.platform_role_assignments'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'platform_role_assignments uses the qualified database UUIDv4 default'
);
select ok(obj_description('public.platform_role_assignments'::regclass) ilike '%not Firebase authentication or email verification%', 'table comment preserves the authority boundary');
select ok(col_description('public.platform_role_assignments'::regclass, 3) like '%reviewer is a future Claim work assignment%', 'role comment excludes reviewer as a platform role');
select is((select count(*) from public.platform_role_assignments), 0::bigint, 'migration creates no platform role rows');
select ok(to_regclass('public.platform_role_assignment_commands') is null, 'no role-assignment command surface is created');
select ok(to_regclass('public.platform_access_grants') is null, 'no forward access-grant relation is created');

select ok(not has_table_privilege('anon', 'public.platform_role_assignments', 'select'), 'anon cannot select platform_role_assignments');
select ok(not has_table_privilege('authenticated', 'public.platform_role_assignments', 'select'), 'authenticated cannot select platform_role_assignments');
select ok(not has_table_privilege('service_role', 'public.platform_role_assignments', 'select'), 'service API role cannot select platform_role_assignments');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.platform_role_assignments'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no platform_role_assignments table privileges');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'public.platform_role_assignments'::regclass), false, 'platform_role_assignments has no RLS enabled');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.platform_role_assignments'::regclass), 0::bigint, 'platform_role_assignments has no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'public.platform_role_assignments'::regclass and not tgisinternal), 0::bigint, 'platform_role_assignments has no trusted trigger or runtime mutation path');

create temporary table platform_role_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Role Subject One', 'buyer')
  returning id
)
insert into platform_role_test_ids (name, id) select 'subject_one', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Role Subject Two', 'supplier')
  returning id
)
insert into platform_role_test_ids (name, id) select 'subject_two', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Role Subject Three', 'unknown')
  returning id
)
insert into platform_role_test_ids (name, id) select 'subject_three', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Role Grantor', 'buyer')
  returning id
)
insert into platform_role_test_ids (name, id) select 'grantor', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Role Reviewer', 'supplier')
  returning id
)
insert into platform_role_test_ids (name, id) select 'reviewer', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Role Subject Four', 'buyer')
  returning id
)
insert into platform_role_test_ids (name, id) select 'subject_four', id from inserted;

with inserted as (
  insert into public.platform_role_assignments (
    user_profile_id, role_code, assignment_source_type, assignment_reason_code,
    authorization_policy_version, evidence_reference, correlation_reference,
    assigned_by_user_profile_id, reviewed_by_user_profile_id,
    created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    (select id from platform_role_test_ids where name = 'subject_one'), 'owner',
    'role_administration', 'synthetic_owner_assignment', 'platform_roles_v1',
    'synthetic-evidence-owner', 'synthetic-correlation-owner',
    (select id from platform_role_test_ids where name = 'grantor'),
    (select id from platform_role_test_ids where name = 'reviewer'),
    (select id from platform_role_test_ids where name = 'grantor'),
    (select id from platform_role_test_ids where name = 'grantor')
  ) returning id
)
insert into platform_role_test_ids (name, id) select 'owner_one', id from inserted;

select is((select count(*) from public.platform_role_assignments), 1::bigint, 'one valid synthetic active owner assignment is accepted');
select ok((select id is not null from public.platform_role_assignments where id = (select id from platform_role_test_ids where name = 'owner_one')), 'accepted assignment receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.platform_role_assignments where id = (select id from platform_role_test_ids where name = 'owner_one')), 'generated assignment identity is UUIDv4 with the RFC variant');
select ok((select assignment_status = 'active' and valid_until is null and terminated_at is null from public.platform_role_assignments where id = (select id from platform_role_test_ids where name = 'owner_one')), 'active assignment has coherent nonterminal lifecycle fields');
select ok((select created_at = updated_at and created_at = assigned_at from public.platform_role_assignments where id = (select id from platform_role_test_ids where name = 'owner_one')), 'default assignment timestamps are coherent within one insert statement');

select lives_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_two'), 'owner', 'role_administration', 'synthetic_second_owner', 'platform_roles_v1', 'synthetic-evidence-second-owner', (select id from platform_role_test_ids where name = 'grantor')) $$, 'multiple users may hold owner');
select lives_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_three'), 'admin', 'role_administration', 'synthetic_admin_assignment', 'platform_roles_v1', 'synthetic-evidence-admin', (select id from platform_role_test_ids where name = 'grantor')) $$, 'admin is an accepted platform role');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_four'), 'reviewer', 'role_administration', 'synthetic_reviewer_rejection', 'platform_roles_v1', 'synthetic-evidence-reviewer', (select id from platform_role_test_ids where name = 'grantor')) $$, null, 'reviewer is rejected as a platform role');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_one'), 'admin', 'role_administration', 'synthetic_role_conflict', 'platform_roles_v1', 'synthetic-evidence-conflict', (select id from platform_role_test_ids where name = 'grantor')) $$, null, 'one user cannot hold overlapping active owner and admin assignments');
select lives_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_status, valid_from, valid_until, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_four'), 'owner', 'active', timestamptz '2025-01-01 00:00:00+00', timestamptz '2030-01-01 00:00:00+00', 'role_administration', 'synthetic_finite_active', 'platform_roles_v1', 'synthetic-evidence-finite-active', (select id from platform_role_test_ids where name = 'grantor')) $$, 'finite active assignment is accepted and evaluated against its validity horizon by a future runtime');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_status, valid_from, valid_until, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_four'), 'admin', 'revoked', timestamptz '2024-01-01 00:00:00+00', timestamptz '2024-02-01 00:00:00+00', 'role_administration', 'synthetic_missing_terminal', 'platform_roles_v1', 'synthetic-evidence-missing-terminal', (select id from platform_role_test_ids where name = 'grantor')) $$, null, 'terminal lifecycle requires terminal provenance');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, valid_from, valid_until, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id) values ((select id from platform_role_test_ids where name = 'subject_four'), 'admin', timestamptz '2026-03-01 00:00:00+00', timestamptz '2026-03-01 00:00:00+00', 'role_administration', 'synthetic_bad_interval', 'platform_roles_v1', 'synthetic-evidence-bad-interval', (select id from platform_role_test_ids where name = 'grantor')) $$, null, 'validity interval must be half-open and non-empty');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assignment_system_source) values ((select id from platform_role_test_ids where name = 'subject_four'), 'admin', 'role_administration', 'synthetic_wrong_provenance', 'platform_roles_v1', 'synthetic-evidence-wrong-provenance', 'synthetic_system') $$, null, 'ordinary assignments require a human grantor rather than a system source');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id, assignment_system_source) values ((select id from platform_role_test_ids where name = 'subject_four'), 'owner', 'bootstrap_manifest', 'synthetic_bootstrap', 'platform_roles_v1', 'synthetic-evidence-bootstrap', (select id from platform_role_test_ids where name = 'grantor'), 'synthetic_bootstrap') $$, null, 'bootstrap provenance cannot fabricate a relational grantor');

select lives_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_status, valid_from, valid_until, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id, terminal_reason_code, terminal_system_source, terminated_at) values ((select id from platform_role_test_ids where name = 'subject_three'), 'owner', 'revoked', timestamptz '2025-01-01 00:00:00+00', timestamptz '2025-02-01 00:00:00+00', 'legacy_reconciliation', 'synthetic_historical_revocation', 'platform_roles_v1', 'synthetic-evidence-revocation', (select id from platform_role_test_ids where name = 'grantor'), 'synthetic_revoked', 'synthetic_reconciliation', timestamptz '2025-02-02 00:00:00+00') $$, 'terminal revoked history is accepted outside the active interval');
select throws_ok($$ insert into public.platform_role_assignments (user_profile_id, role_code, assignment_status, valid_from, valid_until, assignment_source_type, assignment_reason_code, authorization_policy_version, evidence_reference, assigned_by_user_profile_id, terminal_reason_code, terminal_system_source, terminated_at) values ((select id from platform_role_test_ids where name = 'subject_three'), 'owner', 'expired', timestamptz '2025-01-15 00:00:00+00', timestamptz '2025-02-15 00:00:00+00', 'legacy_reconciliation', 'synthetic_historical_overlap', 'platform_roles_v1', 'synthetic-evidence-overlap', (select id from platform_role_test_ids where name = 'grantor'), 'synthetic_expired', 'synthetic_reconciliation', timestamptz '2025-02-16 00:00:00+00') $$, null, 'overlapping historical role intervals for one user are rejected');
select throws_ok($$ delete from public.user_profiles where id = (select id from platform_role_test_ids where name = 'subject_one') $$, null, 'subject role foreign key uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from platform_role_test_ids where name = 'grantor') $$, null, 'grantor role foreign key uses ON DELETE RESTRICT');

select * from finish();

rollback;
