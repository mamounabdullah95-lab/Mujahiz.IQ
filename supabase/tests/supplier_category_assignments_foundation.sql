\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(54);

select has_table('public', 'supplier_category_assignments', 'supplier_category_assignments exists');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.supplier_category_assignments'::regclass and attnum > 0 and not attisdropped),
  20::bigint,
  'supplier_category_assignments have exactly the approved physical-column count'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.supplier_category_assignments'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,supplier_profile_id:uuid:true,category_id:uuid:true,assignment_role:text:true,position:integer:true,record_status:text:true,source_type:text:true,source_namespace:text:true,evidence_reference:text:false,mapping_version:text:false,normalizer_version:text:false,confidence_level:text:false,reviewed_by_user_profile_id:uuid:false,reviewed_at:timestamp with time zone:false,valid_from:date:false,valid_until:date:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'supplier_category_assignments exact columns, types, order, and nullability match the approved local contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_category_assignments'::regclass),
  19::bigint,
  'supplier_category_assignments have exactly the approved constraint count'
);
select is(
  (
    select string_agg(conname || ':' || contype::text, '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_category_assignments'::regclass
  ),
  'supplier_category_assignments_assignment_role_ck:c|supplier_category_assignments_category_fk:f|supplier_category_assignments_confidence_level_ck:c|supplier_category_assignments_created_by_fk:f|supplier_category_assignments_evidence_reference_ck:c|supplier_category_assignments_lifecycle_shape_ck:c|supplier_category_assignments_mapping_version_ck:c|supplier_category_assignments_normalizer_version_ck:c|supplier_category_assignments_pkey:p|supplier_category_assignments_position_ck:c|supplier_category_assignments_record_status_ck:c|supplier_category_assignments_review_provenance_ck:c|supplier_category_assignments_reviewed_by_fk:f|supplier_category_assignments_source_namespace_ck:c|supplier_category_assignments_source_type_ck:c|supplier_category_assignments_supplier_profile_fk:f|supplier_category_assignments_timestamp_order_ck:c|supplier_category_assignments_transformation_versions_ck:c|supplier_category_assignments_updated_by_fk:f',
  'assignment constraint names and types match the approved contract'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_category_assignments'::regclass and contype = 'f'
  ),
  'supplier_category_assignments_category_fk:FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT|supplier_category_assignments_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_category_assignments_reviewed_by_fk:FOREIGN KEY (reviewed_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_category_assignments_supplier_profile_fk:FOREIGN KEY (supplier_profile_id) REFERENCES supplier_profiles(id) ON DELETE RESTRICT|supplier_category_assignments_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'assignment foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.supplier_category_assignments'::regclass),
  6::bigint,
  'supplier_category_assignments have exactly the primary-key and approved explicit indexes'
);
select is(
  (
    select string_agg(
      c.relname || ':' || i.indisunique::text || ':' || (i.indpred is not null)::text || ':' ||
      (
        select string_agg(a.attname::text, ',' order by k.ordinality)
        from unnest(i.indkey::smallint[]) with ordinality k(attnum, ordinality)
        join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
      ),
      '|' order by c.relname
    )
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    where i.indrelid = 'public.supplier_category_assignments'::regclass
  ),
  'supplier_category_assignments_active_position_uidx:true:true:supplier_profile_id,position|supplier_category_assignments_active_primary_uidx:true:true:supplier_profile_id|supplier_category_assignments_active_supplier_category_uidx:true:true:supplier_profile_id,category_id|supplier_category_assignments_category_status_supplier_idx:false:false:category_id,record_status,supplier_profile_id,id|supplier_category_assignments_pkey:true:false:id|supplier_category_assignments_supplier_status_role_position_idx:false:false:supplier_profile_id,record_status,assignment_role,position,id',
  'assignment index names, uniqueness, partiality, and key order match the approved contract'
);
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.supplier_category_assignments'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'supplier_category_assignments use the qualified database UUIDv4 default'
);
select ok(obj_description('public.supplier_category_assignments'::regclass) like '%no rows, aliases, mapping execution%', 'table comment preserves the empty local-only boundary');
select ok(col_description('public.supplier_category_assignments'::regclass, 4) like '%Position never infers%', 'role comment forbids primary inference from legacy array order');
select ok(col_description('public.supplier_category_assignments'::regclass, 6) like '%exactly one reviewed primary%', 'lifecycle comment records the future trusted-command exact-primary postcondition');
select is((select count(*) from public.supplier_category_assignments), 0::bigint, 'migration creates no supplier-category-assignment rows');
select ok(to_regclass('public.category_aliases') is null, 'out-of-scope category_aliases table is absent');
select ok(not exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.supplier_category_assignments'::regclass and attname in ('is_primary', 'source_ordinal') and attnum > 0 and not attisdropped
), 'no competing primary boolean or legacy-array-order column can infer primary status');

select ok(not has_table_privilege('anon', 'public.supplier_category_assignments', 'select'), 'anon cannot select supplier_category_assignments');
select ok(not has_table_privilege('authenticated', 'public.supplier_category_assignments', 'select'), 'authenticated cannot select supplier_category_assignments');
select ok(not has_table_privilege('service_role', 'public.supplier_category_assignments', 'select'), 'service API role cannot select supplier_category_assignments');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_category_assignments'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no supplier-category-assignment table privileges');

create temporary table supplier_category_assignment_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Assignment Actor', 'buyer')
  returning id
)
insert into supplier_category_assignment_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Assignment Supplier', 'Synthetic Assignment Supplier', 'english', 'Synthetic Assignment Supplier', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_category_assignment_test_ids (name, id) select 'supplier', id from inserted;

with inserted as (
  insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status)
  values ('synthetic_assignment_root', 'جذر تصنيف تجريبي', 'Synthetic assignment root', 'جذر تصنيف تجريبي', 'synthetic assignment root', 'active')
  returning id
)
insert into supplier_category_assignment_test_ids (name, id) select 'root', id from inserted;

with inserted as (
  insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable)
  values
    ('synthetic_assignment_leaf_one', (select id from supplier_category_assignment_test_ids where name = 'root'), 2, 'تصنيف تجريبي واحد', 'Synthetic assignment one', 'تصنيف تجريبي واحد', 'synthetic assignment one', 'active', true),
    ('synthetic_assignment_leaf_two', (select id from supplier_category_assignment_test_ids where name = 'root'), 2, 'تصنيف تجريبي اثنان', 'Synthetic assignment two', 'تصنيف تجريبي اثنان', 'synthetic assignment two', 'active', true),
    ('synthetic_assignment_leaf_three', (select id from supplier_category_assignment_test_ids where name = 'root'), 2, 'تصنيف تجريبي ثلاثة', 'Synthetic assignment three', 'تصنيف تجريبي ثلاثة', 'synthetic assignment three', 'active', true)
  returning code, id
)
insert into supplier_category_assignment_test_ids (name, id)
select replace(code, 'synthetic_assignment_', ''), id from inserted;

with inserted as (
  insert into public.supplier_category_assignments (
    supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace,
    evidence_reference, mapping_version, normalizer_version, confidence_level, reviewed_by_user_profile_id, reviewed_at,
    valid_from, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    (select id from supplier_category_assignment_test_ids where name = 'supplier'),
    (select id from supplier_category_assignment_test_ids where name = 'leaf_one'),
    'primary', 9, 'active', 'legacy_migration', 'firebase_firestore',
    'mapping:synthetic-assignment-v1', 'supplier_category_v1', 'taxonomy_label_v1', 'high',
    (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(),
    date '2026-01-01',
    (select id from supplier_category_assignment_test_ids where name = 'actor'),
    (select id from supplier_category_assignment_test_ids where name = 'actor')
  ) returning id
)
insert into supplier_category_assignment_test_ids (name, id) select 'primary', id from inserted;

select is((select count(*) from public.supplier_category_assignments), 1::bigint, 'one valid reviewed active primary assignment is accepted');
select ok((select id is not null from public.supplier_category_assignments where id = (select id from supplier_category_assignment_test_ids where name = 'primary')), 'accepted assignment receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_category_assignments where id = (select id from supplier_category_assignment_test_ids where name = 'primary')), 'generated assignment identity is UUIDv4 with the RFC variant');
select ok((select created_at = updated_at from public.supplier_category_assignments where id = (select id from supplier_category_assignment_test_ids where name = 'primary')), 'default assignment timestamps are coherent within one insert statement');
select is((select assignment_role from public.supplier_category_assignments where id = (select id from supplier_category_assignment_test_ids where name = 'primary')), 'primary', 'role is authoritative even when the primary presentation position is not zero');

select lives_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace, mapping_version, normalizer_version, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_two'), 'secondary', 0, 'active', 'import_submission', 'reviewed_submission', 'supplier_category_v1', 'taxonomy_label_v1', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'a reviewed active secondary assignment is accepted without changing the primary role');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'lead', 'manual_curation', 'manual_review') $$, null, 'unsupported assignment roles are rejected');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, source_type, source_namespace) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', -1, 'manual_curation', 'manual_review') $$, null, 'negative positions are rejected');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'system', 'manual_review') $$, null, 'untraceable generic system source is rejected');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'Manual-Review') $$, null, 'source namespace uses a bounded stable code');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, evidence_reference) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', ' ') $$, null, 'blank evidence references are rejected');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, mapping_version) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'legacy_migration', 'firebase_firestore', 'supplier_category_v1') $$, null, 'transformed sources require both mapping and normalizer versions');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, mapping_version, normalizer_version) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', 'supplier_category_v1', 'taxonomy_label_v1') $$, null, 'manual curation does not claim transformation versions');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, confidence_level) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', 'certain') $$, null, 'confidence is limited to approved bounded evidence values');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, reviewed_by_user_profile_id) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', (select id from supplier_category_assignment_test_ids where name = 'actor')) $$, null, 'review actor and review timestamp must be present together');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, record_status, source_type, source_namespace, valid_from) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'active', 'manual_curation', 'manual_review', date '2026-01-01') $$, null, 'active assignments require completed review');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'active', 'manual_curation', 'manual_review', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp()) $$, null, 'active assignments require valid_from');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'active', 'manual_curation', 'manual_review', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', date '2026-01-02') $$, null, 'active assignments cannot have a terminal date');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, valid_from) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', date '2026-01-01') $$, null, 'draft assignments cannot carry an effective interval');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'superseded', 'manual_curation', 'manual_review', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-02', date '2026-01-02') $$, null, 'closed reviewed assignments require a strictly increasing interval');
select lives_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, record_status, source_type, source_namespace) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'archived', 'manual_curation', 'manual_review') $$, 'a never-active synthetic draft may be archived without inventing an effective interval');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, created_at, updated_at) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'assignment timestamps must be coherent');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace) values (gen_random_uuid(), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review') $$, null, 'supplier parent must exist');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), gen_random_uuid(), 'secondary', 'manual_curation', 'manual_review') $$, null, 'category parent must exist');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', gen_random_uuid(), statement_timestamp()) $$, null, 'reviewer parent must exist');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, created_by_user_profile_id) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', gen_random_uuid()) $$, null, 'creation actor must exist');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, source_type, source_namespace, updated_by_user_profile_id) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 'manual_curation', 'manual_review', gen_random_uuid()) $$, null, 'update actor must exist');

select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace, mapping_version, normalizer_version, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_one'), 'secondary', 1, 'active', 'legacy_migration', 'firebase_firestore', 'supplier_category_v1', 'taxonomy_label_v1', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'one active Supplier/category target exists regardless of role or source');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace, mapping_version, normalizer_version, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'primary', 1, 'active', 'legacy_migration', 'firebase_firestore', 'supplier_category_v1', 'taxonomy_label_v1', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'at most one active primary exists per Supplier');
select throws_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace, mapping_version, normalizer_version, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_three'), 'secondary', 9, 'active', 'legacy_migration', 'firebase_firestore', 'supplier_category_v1', 'taxonomy_label_v1', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'active positions are unique within each Supplier assignment set');
select lives_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace, mapping_version, normalizer_version, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_one'), 'secondary', 9, 'superseded', 'legacy_migration', 'firebase_firestore', 'supplier_category_v1', 'taxonomy_label_v1', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2025-01-01', date '2025-02-01') $$, 'historical superseded rows may repeat a prior Supplier/category and position');
select lives_ok($$ insert into public.supplier_category_assignments (supplier_profile_id, category_id, assignment_role, position, record_status, source_type, source_namespace, mapping_version, normalizer_version, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_category_assignment_test_ids where name = 'supplier'), (select id from supplier_category_assignment_test_ids where name = 'leaf_two'), 'primary', 0, 'archived', 'legacy_migration', 'firebase_firestore', 'supplier_category_v1', 'taxonomy_label_v1', (select id from supplier_category_assignment_test_ids where name = 'actor'), statement_timestamp(), date '2025-01-01', date '2025-02-01') $$, 'historical primary rows remain outside active uniqueness');
select throws_ok($$ delete from public.supplier_profiles where id = (select id from supplier_category_assignment_test_ids where name = 'supplier') $$, null, 'Supplier parent uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.categories where id = (select id from supplier_category_assignment_test_ids where name = 'leaf_one') $$, null, 'category target uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_category_assignment_test_ids where name = 'actor') $$, null, 'review and actor provenance use ON DELETE RESTRICT');

select * from finish();

rollback;
