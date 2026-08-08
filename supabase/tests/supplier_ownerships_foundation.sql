\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(44);

select has_table('public', 'supplier_ownerships', 'supplier_ownerships exists');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.supplier_ownerships'::regclass and attnum > 0 and not attisdropped),
  22::bigint,
  'supplier_ownerships has exactly the approved physical-column count'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.supplier_ownerships'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,supplier_profile_id:uuid:true,controller_user_profile_id:uuid:true,authority_type:text:true,ownership_status:text:true,valid_from:timestamp with time zone:true,valid_until:timestamp with time zone:false,record_version:integer:true,establishment_source_type:text:true,establishment_reason_code:text:true,established_by_user_profile_id:uuid:false,establishment_system_source:text:false,established_at:timestamp with time zone:true,closure_reason_code:text:false,closed_by_user_profile_id:uuid:false,closure_system_source:text:false,closed_at:timestamp with time zone:false,transfer_successor_ownership_id:uuid:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'supplier_ownerships exact columns, types, order, and nullability match the approved local contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_ownerships'::regclass),
  21::bigint,
  'supplier_ownerships has the exact constraint count'
);
select is(
  (
    select string_agg(conname || ':' || contype::text, '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_ownerships'::regclass
  ),
  'supplier_ownerships_authority_type_ck:c|supplier_ownerships_closed_by_fk:f|supplier_ownerships_closure_reason_code_ck:c|supplier_ownerships_closure_system_source_ck:c|supplier_ownerships_controller_user_profile_fk:f|supplier_ownerships_created_by_fk:f|supplier_ownerships_established_by_fk:f|supplier_ownerships_establishment_provenance_ck:c|supplier_ownerships_establishment_reason_code_ck:c|supplier_ownerships_establishment_source_type_ck:c|supplier_ownerships_establishment_system_source_ck:c|supplier_ownerships_lifecycle_shape_ck:c|supplier_ownerships_ownership_status_ck:c|supplier_ownerships_pkey:p|supplier_ownerships_record_version_ck:c|supplier_ownerships_supplier_interval_excl:x|supplier_ownerships_supplier_profile_fk:f|supplier_ownerships_timestamp_order_ck:c|supplier_ownerships_transfer_successor_fk:f|supplier_ownerships_updated_by_fk:f|supplier_ownerships_validity_interval_ck:c',
  'supplier_ownerships constraint names and types match the approved local contract'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_ownerships'::regclass and contype = 'f'
  ),
  'supplier_ownerships_closed_by_fk:FOREIGN KEY (closed_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_ownerships_controller_user_profile_fk:FOREIGN KEY (controller_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_ownerships_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_ownerships_established_by_fk:FOREIGN KEY (established_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_ownerships_supplier_profile_fk:FOREIGN KEY (supplier_profile_id) REFERENCES supplier_profiles(id) ON DELETE RESTRICT|supplier_ownerships_transfer_successor_fk:FOREIGN KEY (transfer_successor_ownership_id) REFERENCES supplier_ownerships(id) ON DELETE RESTRICT|supplier_ownerships_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'ownership foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.supplier_ownerships'::regclass),
  5::bigint,
  'supplier_ownerships has the primary key, temporal exclusion, and approved structural indexes'
);
select ok(to_regclass('public.supplier_ownerships_one_active_primary_controller_uidx') is not null, 'one-active-primary-controller unique index exists');
select ok(to_regclass('public.supplier_ownerships_supplier_status_valid_from_idx') is not null, 'Supplier lifecycle lookup index exists');
select ok(to_regclass('public.supplier_ownerships_controller_status_valid_from_idx') is not null, 'controller lifecycle lookup index exists');
select ok(
  (select lower(pg_catalog.pg_get_indexdef('public.supplier_ownerships_one_active_primary_controller_uidx'::regclass)))
    like '%where ((authority_type = ''primary_controller''::text) and (ownership_status = ''active''::text))%',
  'active-controller uniqueness is limited to the approved primary active boundary'
);
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.supplier_ownerships'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'supplier_ownerships use the qualified database UUIDv4 default'
);
select ok(obj_description('public.supplier_ownerships'::regclass) ilike '%no rows, Claim table, transfer workflow%', 'table comment preserves the empty structural boundary');
select ok(col_description('public.supplier_ownerships'::regclass, 3) like '%not a Firebase UID%', 'controller comment preserves provider-neutral identity');
select ok(col_description('public.supplier_ownerships'::regclass, 9) like '%no generic source ID%', 'source comment preserves the no-polymorphic-reference boundary');
select is((select count(*) from public.supplier_ownerships), 0::bigint, 'migration creates no Supplier ownership rows');
select ok(to_regclass('public.supplier_ownership_claims') is null, 'no Claim aggregate table is created');
select ok(to_regclass('public.supplier_memberships') is null, 'no Supplier membership table is created');

select ok(not has_table_privilege('anon', 'public.supplier_ownerships', 'select'), 'anon cannot select supplier_ownerships');
select ok(not has_table_privilege('authenticated', 'public.supplier_ownerships', 'select'), 'authenticated cannot select supplier_ownerships');
select ok(not has_table_privilege('service_role', 'public.supplier_ownerships', 'select'), 'service API role cannot select supplier_ownerships');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_ownerships'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no supplier_ownerships table privileges');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'public.supplier_ownerships'::regclass), false, 'supplier_ownerships has no RLS enabled');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.supplier_ownerships'::regclass), 0::bigint, 'supplier_ownerships has no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'public.supplier_ownerships'::regclass and not tgisinternal), 0::bigint, 'supplier_ownerships has no trusted trigger or runtime mutation path');

create temporary table supplier_ownership_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Ownership Controller One', 'supplier')
  returning id
)
insert into supplier_ownership_test_ids (name, id) select 'controller_one', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Ownership Controller Two', 'supplier')
  returning id
)
insert into supplier_ownership_test_ids (name, id) select 'controller_two', id from inserted;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Ownership Actor', 'buyer')
  returning id
)
insert into supplier_ownership_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Ownership Supplier One', 'Synthetic Ownership Supplier One', 'english', 'Synthetic Ownership Supplier One', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_ownership_test_ids (name, id) select 'supplier_one', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Ownership Supplier Two', 'Synthetic Ownership Supplier Two', 'english', 'Synthetic Ownership Supplier Two', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_ownership_test_ids (name, id) select 'supplier_two', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Ownership Supplier Three', 'Synthetic Ownership Supplier Three', 'english', 'Synthetic Ownership Supplier Three', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_ownership_test_ids (name, id) select 'supplier_three', id from inserted;

with inserted as (
  insert into public.supplier_ownerships (
    supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code,
    establishment_system_source, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    (select id from supplier_ownership_test_ids where name = 'supplier_one'),
    (select id from supplier_ownership_test_ids where name = 'controller_one'),
    'legacy_reconciliation', 'synthetic_exact_match', 'synthetic_reconciliation',
    (select id from supplier_ownership_test_ids where name = 'actor'),
    (select id from supplier_ownership_test_ids where name = 'actor')
  ) returning id
)
insert into supplier_ownership_test_ids (name, id) select 'active_one', id from inserted;

select is((select count(*) from public.supplier_ownerships), 1::bigint, 'one valid synthetic active primary controller is accepted');
select ok((select id is not null from public.supplier_ownerships where id = (select id from supplier_ownership_test_ids where name = 'active_one')), 'accepted ownership receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_ownerships where id = (select id from supplier_ownership_test_ids where name = 'active_one')), 'generated ownership identity is UUIDv4 with the RFC variant');
select ok((select ownership_status = 'active' and valid_until is null from public.supplier_ownerships where id = (select id from supplier_ownership_test_ids where name = 'active_one')), 'active ownership has no terminal timestamp or closure provenance');
select ok((select created_at = updated_at from public.supplier_ownerships where id = (select id from supplier_ownership_test_ids where name = 'active_one')), 'default ownership timestamps are coherent within one insert statement');

select lives_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code, established_by_user_profile_id) values ((select id from supplier_ownership_test_ids where name = 'supplier_two'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'submission_approval', 'synthetic_submission_approval', (select id from supplier_ownership_test_ids where name = 'actor')) $$, 'one controller may own multiple Suppliers');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code, establishment_system_source) values ((select id from supplier_ownership_test_ids where name = 'supplier_one'), (select id from supplier_ownership_test_ids where name = 'controller_two'), 'legacy_reconciliation', 'synthetic_conflict', 'synthetic_reconciliation') $$, null, 'a Supplier cannot have a second active primary controller');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, authority_type, establishment_source_type, establishment_reason_code, establishment_system_source) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'delegate', 'legacy_reconciliation', 'synthetic_conflict', 'synthetic_reconciliation') $$, null, 'delegate authority cannot be encoded as ownership');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, ownership_status, valid_until, establishment_source_type, establishment_reason_code, establishment_system_source) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'active', statement_timestamp() + interval '1 day', 'legacy_reconciliation', 'synthetic_conflict', 'synthetic_reconciliation') $$, null, 'active ownership cannot carry a terminal timestamp');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, ownership_status, valid_from, valid_until, establishment_source_type, establishment_reason_code, establishment_system_source) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'revoked', statement_timestamp(), statement_timestamp() + interval '1 day', 'legacy_reconciliation', 'synthetic_revocation', 'synthetic_reconciliation') $$, null, 'terminal ownership requires closure provenance');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code, establishment_system_source, established_by_user_profile_id) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'legacy_reconciliation', 'synthetic_conflict', 'synthetic_reconciliation', (select id from supplier_ownership_test_ids where name = 'actor')) $$, null, 'establishment provenance must name exactly one actor or system source');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code, establishment_system_source) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'email_match', 'synthetic_conflict', 'synthetic_reconciliation') $$, null, 'ambiguous email evidence cannot become a canonical ownership source');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code, establishment_system_source) values (gen_random_uuid(), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'legacy_reconciliation', 'synthetic_fk', 'synthetic_reconciliation') $$, null, 'Supplier parent uses ON DELETE RESTRICT');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, establishment_source_type, establishment_reason_code, establishment_system_source) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), gen_random_uuid(), 'legacy_reconciliation', 'synthetic_fk', 'synthetic_reconciliation') $$, null, 'controller parent uses ON DELETE RESTRICT');

select lives_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, ownership_status, valid_from, valid_until, establishment_source_type, establishment_reason_code, establishment_system_source, closure_reason_code, closure_system_source, closed_at) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_one'), 'revoked', timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-02-01 00:00:00+00', 'legacy_reconciliation', 'synthetic_historical', 'synthetic_reconciliation', 'synthetic_revocation', 'synthetic_reconciliation', timestamptz '2026-02-01 00:00:00+00') $$, 'terminal revoked history with exclusive timestamps is accepted');
select throws_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, ownership_status, valid_from, valid_until, establishment_source_type, establishment_reason_code, establishment_system_source, closure_reason_code, closure_system_source, closed_at) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_two'), 'superseded', timestamptz '2026-01-15 00:00:00+00', timestamptz '2026-02-15 00:00:00+00', 'legacy_reconciliation', 'synthetic_overlap', 'synthetic_reconciliation', 'synthetic_correction', 'synthetic_reconciliation', timestamptz '2026-02-15 00:00:00+00') $$, null, 'overlapping Supplier ownership intervals are rejected');
select lives_ok($$ insert into public.supplier_ownerships (supplier_profile_id, controller_user_profile_id, ownership_status, valid_from, valid_until, establishment_source_type, establishment_reason_code, establishment_system_source, closure_reason_code, closure_system_source, closed_at) values ((select id from supplier_ownership_test_ids where name = 'supplier_three'), (select id from supplier_ownership_test_ids where name = 'controller_two'), 'superseded', timestamptz '2026-02-01 00:00:00+00', timestamptz '2026-03-01 00:00:00+00', 'legacy_reconciliation', 'synthetic_adjacent', 'synthetic_reconciliation', 'synthetic_correction', 'synthetic_reconciliation', timestamptz '2026-03-01 00:00:00+00') $$, 'adjacent exclusive historical intervals are accepted');
select throws_ok($$ delete from public.supplier_profiles where id = (select id from supplier_ownership_test_ids where name = 'supplier_one') $$, null, 'Supplier ownership FK uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_ownership_test_ids where name = 'controller_one') $$, null, 'controller ownership FK uses ON DELETE RESTRICT');

select * from finish();

rollback;
