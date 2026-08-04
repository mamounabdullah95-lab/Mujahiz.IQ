\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(78);

select has_schema('internal', 'internal schema exists');
select has_table('public', 'user_profiles', 'user_profiles exists');
select has_table('internal', 'identity_provider_links', 'identity_provider_links exists');
select has_column('public', 'user_profiles', 'id', 'user_profiles has UUID identity column');
select has_column('public', 'user_profiles', 'legacy_firestore_id', 'user_profiles preserves a separate legacy Firestore alternate key');
select has_column('public', 'user_profiles', 'account_status', 'user_profiles has account lifecycle status');
select has_column('public', 'user_profiles', 'account_context', 'user_profiles has business account context');
select has_column('internal', 'identity_provider_links', 'user_profile_id', 'provider links reference an application profile');
select has_column('internal', 'identity_provider_links', 'provider_code', 'provider links retain a provider code');
select has_column('internal', 'identity_provider_links', 'provider_subject', 'provider links retain a provider subject');
select has_column('internal', 'identity_provider_links', 'migration_batch_id', 'provider links retain optional migration provenance');
select is(
  (
    select md5(string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum))
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.user_profiles'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  '2720de0985e6deb38f2f7cc9009bdf3d',
  'user_profiles exact columns, types, order, and nullability match the approved contract'
);
select is(
  (
    select md5(string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum))
    from pg_catalog.pg_attribute a
    where a.attrelid = 'internal.identity_provider_links'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'cd4094a6828eb6bf209e171d79c1f76c',
  'identity_provider_links exact columns, types, order, and nullability match the approved contract'
);

select matches(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.user_profiles'::regclass and a.attname = 'id'
  ),
  'gen_random_uuid',
  'user profile IDs use the qualified database UUIDv4 default'
);
select matches(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'internal.identity_provider_links'::regclass and a.attname = 'id'
  ),
  'gen_random_uuid',
  'provider-link IDs use the qualified database UUIDv4 default'
);
select ok(
  obj_description('public.user_profiles'::regclass) like '%no Auth authority%',
  'profile comment preserves the provider-neutral Auth boundary'
);
select ok(
  col_description('internal.identity_provider_links'::regclass, 5) like '%never linked or merged by email%',
  'provider subject comment prohibits email-only linkage'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
    where c.oid = 'public.user_profiles'::regclass
      and acl.grantee = 0
      and acl.privilege_type = 'SELECT'
  ),
  'PUBLIC cannot select profiles'
);
select ok(not has_table_privilege('anon', 'public.user_profiles', 'select'), 'anon cannot select profiles');
select ok(not has_table_privilege('authenticated', 'public.user_profiles', 'select'), 'authenticated cannot select profiles');
select ok(not has_table_privilege('service_role', 'public.user_profiles', 'select'), 'service API role cannot select profiles directly');
select ok(not exists (select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl where c.oid = 'public.user_profiles'::regclass and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)), 'PUBLIC and API roles have no profile-table privilege');
select ok(not exists (select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl where c.oid = 'internal.identity_provider_links'::regclass and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)), 'PUBLIC and API roles have no provider-link table privilege');
select ok(not has_schema_privilege('service_role', 'internal', 'USAGE'), 'service API role has no internal schema usage');
select ok(not has_schema_privilege('anon', 'internal', 'USAGE'), 'anon has no internal schema usage');
select ok(not has_schema_privilege('authenticated', 'internal', 'USAGE'), 'authenticated has no internal schema usage');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_profiles'::regclass), false, 'RLS remains deferred on the non-granted profile table');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.user_profiles'::regclass), 0::bigint, 'profile table has no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'public.user_profiles'::regclass and not tgisinternal), 0::bigint, 'profile table has no application trigger');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'internal.identity_provider_links'::regclass and not tgisinternal), 0::bigint, 'provider link table has no application trigger');
select ok(to_regclass('public.platform_role_assignments') is null, 'deferred platform_role_assignments table is absent');
select is(
  (
    select count(*)
    from pg_catalog.pg_constraint
    where conrelid in ('public.user_profiles'::regclass, 'internal.identity_provider_links'::regclass)
      and contype = 'f'
      and confdeltype = 'r'
  ),
  10::bigint,
  'all profile, actor, and migration-batch foreign keys use ON DELETE RESTRICT'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, account_status) values ('Synthetic', 'buyer', 'pending') $$,
  null,
  'invalid profile status is rejected'
);

select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context) values ('Synthetic', 'admin') $$,
  null,
  'invalid account context is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, preferred_locale) values ('Synthetic', 'buyer', 'ku') $$,
  null,
  'unsupported profile locale is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, normalized_email) values ('Synthetic', 'buyer', 'Synthetic@Example.test') $$,
  null,
  'non-normalized support email is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, normalized_email) values ('Synthetic', 'buyer', ' synthetic@example.test ') $$,
  null,
  'support email with surrounding whitespace is not normalized and is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context) values ('', 'buyer') $$,
  null,
  'empty profile name is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context) values (repeat('x', 201), 'buyer') $$,
  null,
  'oversized profile name is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (legacy_firestore_id, full_name, account_context) values (repeat('x', 513), 'Synthetic', 'buyer') $$,
  null,
  'oversized legacy Firestore identifier is rejected'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, created_at, updated_at) values ('Synthetic', 'buyer', statement_timestamp(), statement_timestamp() - interval '1 second') $$,
  null,
  'profile timestamps must be coherent'
);

create temporary table identity_test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

with inserted as (
  insert into internal.migration_batches (
    execution_environment, migration_scope, source_system, source_snapshot_reference,
    transformation_version, schema_version, status, initiated_by
  ) values (
    'local', 'identity_foundation_test', 'synthetic', 'synthetic-identity-snapshot-v1',
    'identity-transform-v1', 'identity-schema-v1', 'planned', 'test-runner'
  ) returning id
)
insert into identity_test_ids (name, id)
select 'batch', id from inserted;

with inserted as (
  insert into internal.migration_source_dispositions (
    migration_batch_id, source_collection, source_document_id, source_version,
    disposition, reason_code, transformation_version
  ) values (
    (select id from identity_test_ids where name = 'batch'),
    'users', 'synthetic-user-doc-1', 'v1', 'migrated', 'accepted', 'identity-transform-v1'
  ) returning id
)
insert into identity_test_ids (name, id)
select 'source', id from inserted;

with inserted as (
  insert into public.user_profiles (
    legacy_firestore_id, full_name, account_context, preferred_locale,
    normalized_email, display_email, legacy_account_type, legacy_role
  ) values (
    'synthetic-user-doc-1', 'Synthetic Buyer', 'buyer', 'en',
    'synthetic.buyer@example.test', 'Synthetic.Buyer@example.test', 'buyer', 'viewer'
  ) returning id
)
insert into identity_test_ids (name, id)
select 'profile', id from inserted;

select is(
  (select count(*) from public.user_profiles where id = (select id from identity_test_ids where name = 'profile')),
  1::bigint,
  'valid provider-neutral profile is accepted'
);
select ok((select id is not null from public.user_profiles where id = (select id from identity_test_ids where name = 'profile')), 'profile uses an opaque generated UUID rather than the legacy identifier');
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, suspended_by_user_profile_id) values ('Contradictory suspension actor', 'buyer', (select id from identity_test_ids where name = 'profile')) $$,
  null,
  'an active profile cannot carry a suspension actor without a suspension state'
);
select throws_ok(
  $$ insert into public.user_profiles (full_name, account_context, deactivated_by_user_profile_id) values ('Contradictory deactivation actor', 'buyer', (select id from identity_test_ids where name = 'profile')) $$,
  null,
  'an active profile cannot carry a deactivation actor without a deactivation state'
);

with inserted as (
  insert into internal.identity_provider_links (
    user_profile_id, migration_batch_id, provider_code, provider_subject,
    identity_status, verification_status, provider_state_observed_at
  ) values (
    (select id from identity_test_ids where name = 'profile'),
    (select id from identity_test_ids where name = 'batch'),
    'firebase', 'synthetic-firebase-subject-001',
    'active', 'unverified', statement_timestamp()
  ) returning id
)
insert into identity_test_ids (name, id)
select 'link', id from inserted;

select is(
  (select provider_subject from internal.identity_provider_links where id = (select id from identity_test_ids where name = 'link')),
  'synthetic-firebase-subject-001',
  'Firebase traceability uses a bounded text provider subject rather than a UUID'
);
select is(
  (select count(*) from internal.identity_provider_links where provider_code = 'firebase' and link_status = 'linked'),
  1::bigint,
  'unverified Firebase bootstrap creates one inert active provider link without a role or benefit table'
);

select throws_ok(
  $$ insert into public.user_profiles (legacy_firestore_id, full_name, account_context) values ('synthetic-user-doc-1', 'Duplicate', 'buyer') $$,
  null,
  'non-null legacy Firestore IDs are unique'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'Firebase', 'synthetic-subject', statement_timestamp()) $$,
  null,
  'provider code must be bounded lowercase provider-neutral text'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, link_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'invalid-link-status', 'pending', statement_timestamp()) $$,
  null,
  'invalid provider-link status is rejected'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, identity_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'invalid-identity-status', 'pending', statement_timestamp()) $$,
  null,
  'invalid provider identity status is rejected'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, verification_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'invalid-verification-status', 'pending', statement_timestamp()) $$,
  null,
  'invalid provider verification status is rejected'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'firebase', repeat('x', 256), statement_timestamp()) $$,
  null,
  'oversized provider subject is rejected'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, identity_status, verification_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'firebase', 'synthetic-firebase-subject-001', 'active', 'unverified', statement_timestamp()) $$,
  null,
  'active provider and subject pair can map to only one profile'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, identity_status, verification_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'firebase', 'synthetic-second-subject', 'active', 'unverified', statement_timestamp()) $$,
  null,
  'a profile has at most one active primary link for a provider'
);
select lives_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, is_primary, link_status, identity_status, verification_status, provider_state_observed_at, unlinked_at) values ((select id from identity_test_ids where name = 'profile'), 'firebase', 'synthetic-firebase-subject-001', false, 'unlinked', 'unknown', 'unknown', statement_timestamp(), statement_timestamp()) $$,
  'inactive provider-link history remains possible after an unlink'
);
select is(
  (select count(*) from internal.identity_provider_links where provider_subject = 'synthetic-firebase-subject-001'),
  2::bigint,
  'active and inactive provider-link histories coexist without relaxing active uniqueness'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, is_primary, link_status, identity_status, verification_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'missing-unlink-time', false, 'unlinked', 'unknown', 'unknown', statement_timestamp()) $$,
  null,
  'unlinked identity requires an unlink timestamp'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, provider_state_observed_at, unlinked_by_user_profile_id) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'contradictory-unlink-actor', statement_timestamp(), (select id from identity_test_ids where name = 'profile')) $$,
  null,
  'a linked provider row cannot carry an unlink actor without an unlink state'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, identity_status, verification_status, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'missing-disabled-time', 'disabled', 'unknown', statement_timestamp()) $$,
  null,
  'disabled identity requires a disabled timestamp'
);
select lives_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, identity_status, verification_status, provider_state_observed_at, disabled_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'synthetic-disabled-system-state', 'disabled', 'unknown', statement_timestamp(), statement_timestamp()) $$,
  'provider disablement can retain a system or migration state without fabricating an actor'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, identity_status, verification_status, provider_state_observed_at, verified_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'verified-while-unknown', 'unknown', 'verified', statement_timestamp(), statement_timestamp()) $$,
  null,
  'verified state requires an active linked non-disabled identity'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, linked_at, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), 'oidc', 'observation-before-link', statement_timestamp(), statement_timestamp() - interval '1 second') $$,
  null,
  'provider-state observation cannot precede link creation'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, provider_code, provider_subject, provider_state_observed_at) values (gen_random_uuid(), 'oidc', 'orphan-profile', statement_timestamp()) $$,
  null,
  'provider link requires an existing application profile'
);
select throws_ok(
  $$ insert into internal.identity_provider_links (user_profile_id, migration_batch_id, provider_code, provider_subject, provider_state_observed_at) values ((select id from identity_test_ids where name = 'profile'), gen_random_uuid(), 'oidc', 'orphan-batch', statement_timestamp()) $$,
  null,
  'provider-link migration provenance requires an existing batch'
);
select lives_ok(
  $$ update public.user_profiles set account_status = 'suspended', suspended_at = statement_timestamp(), suspension_reason = 'synthetic system suspension' where id = (select id from identity_test_ids where name = 'profile') $$,
  'profile suspension can retain a system or migration state without fabricating an actor'
);

select throws_ok(
  $$ delete from public.user_profiles where id = (select id from identity_test_ids where name = 'profile') $$,
  null,
  'referenced profile cannot be cascade-deleted'
);

select lives_ok(
  $$ insert into internal.migration_record_mappings (migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome, target_logical_type, target_id, mapping_role, child_key, transformation_version, rollback_dependency_order) values ((select id from identity_test_ids where name = 'batch'), 'ordinary_mapping', (select id from identity_test_ids where name = 'source'), 'migrated', 'user_profiles', (select id from identity_test_ids where name = 'profile'), 'root', 'profile', 'identity-transform-v1', 0) $$,
  'existing migration-control contract accepts synthetic profile provenance'
);
select lives_ok(
  $$ insert into internal.migration_record_mappings (migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome, target_logical_type, target_id, mapping_role, child_key, transformation_version, rollback_dependency_order) values ((select id from identity_test_ids where name = 'batch'), 'ordinary_mapping', (select id from identity_test_ids where name = 'source'), 'migrated', 'identity_provider_links', (select id from identity_test_ids where name = 'link'), 'normalized_child', 'provider:firebase', 'identity-transform-v1', 1) $$,
  'existing migration-control contract accepts synthetic provider-link provenance'
);
select is(
  (select count(*) from internal.migration_record_mappings where source_disposition_id = (select id from identity_test_ids where name = 'source')),
  2::bigint,
  'profile and provider link retain distinct deterministic migration targets'
);
select ok(to_regclass('internal.identity_provider_links_active_provider_subject_uidx') is not null, 'active provider-subject lookup index exists');
select ok(to_regclass('internal.identity_provider_links_active_primary_uidx') is not null, 'active primary-link uniqueness index exists');
select ok(to_regclass('internal.identity_provider_links_user_provider_link_idx') is not null, 'trusted user/provider link lookup index exists');
select ok(to_regclass('internal.identity_provider_links_user_identity_verification_idx') is not null, 'trusted identity reconciliation index exists');
select ok(to_regclass('public.user_profiles_status_context_created_idx') is not null, 'trusted profile keyset index exists');
select ok(not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.user_profiles'::regclass and contype = 'u' and pg_catalog.pg_get_constraintdef(oid) ~ 'normalized_email|display_email'), 'email is not an identity-linking unique constraint');
select is((select migration_batch_id from internal.identity_provider_links where id = (select id from identity_test_ids where name = 'link')), (select id from identity_test_ids where name = 'batch'), 'provider link retains explicit migration batch provenance');
select is((select target_logical_type from internal.migration_record_mappings where target_id = (select id from identity_test_ids where name = 'profile')), 'user_profiles', 'profile provenance uses its approved logical target type');

select * from finish();

rollback;