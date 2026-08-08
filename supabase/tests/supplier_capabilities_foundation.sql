\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(62);

select has_table('public', 'supplier_capabilities', 'supplier_capabilities exists');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.supplier_capabilities'::regclass and attnum > 0 and not attisdropped),
  25::bigint,
  'supplier_capabilities have exactly the approved physical-column count'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.supplier_capabilities'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,supplier_profile_id:uuid:true,category_id:uuid:false,capability_kind:text:true,capability_code:text:false,custom_label_original:text:false,custom_display_label:text:false,custom_language_tag:text:false,custom_normalized_value:text:false,normalizer_version:text:false,position:integer:true,record_status:text:true,source_type:text:true,source_namespace:text:true,evidence_reference:text:false,mapping_version:text:false,confidence_level:text:false,reviewed_by_user_profile_id:uuid:false,reviewed_at:timestamp with time zone:false,valid_from:date:false,valid_until:date:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'supplier_capabilities exact columns, types, order, and nullability match the approved local contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_capabilities'::regclass),
  24::bigint,
  'supplier_capabilities have exactly the approved constraint count'
);
select is(
  (
    select string_agg(conname || ':' || contype::text, '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_capabilities'::regclass
  ),
  'supplier_capabilities_capability_code_ck:c|supplier_capabilities_capability_kind_ck:c|supplier_capabilities_category_fk:f|supplier_capabilities_confidence_level_ck:c|supplier_capabilities_created_by_fk:f|supplier_capabilities_custom_language_tag_ck:c|supplier_capabilities_custom_normalized_value_ck:c|supplier_capabilities_custom_text_bounds_ck:c|supplier_capabilities_evidence_reference_ck:c|supplier_capabilities_lifecycle_shape_ck:c|supplier_capabilities_mapping_version_ck:c|supplier_capabilities_normalizer_version_ck:c|supplier_capabilities_pkey:p|supplier_capabilities_position_ck:c|supplier_capabilities_record_status_ck:c|supplier_capabilities_review_provenance_ck:c|supplier_capabilities_reviewed_by_fk:f|supplier_capabilities_semantic_shape_ck:c|supplier_capabilities_source_namespace_ck:c|supplier_capabilities_source_type_ck:c|supplier_capabilities_supplier_profile_fk:f|supplier_capabilities_timestamp_order_ck:c|supplier_capabilities_transformation_versions_ck:c|supplier_capabilities_updated_by_fk:f',
  'capability constraint names and types match the approved contract'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_capabilities'::regclass and contype = 'f'
  ),
  'supplier_capabilities_category_fk:FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT|supplier_capabilities_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_capabilities_reviewed_by_fk:FOREIGN KEY (reviewed_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_capabilities_supplier_profile_fk:FOREIGN KEY (supplier_profile_id) REFERENCES supplier_profiles(id) ON DELETE RESTRICT|supplier_capabilities_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'capability foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.supplier_capabilities'::regclass),
  6::bigint,
  'supplier_capabilities have exactly the primary-key and approved explicit indexes'
);
select ok(
  (select lower(pg_catalog.pg_get_indexdef('public.supplier_capabilities_active_controlled_semantic_uidx'::regclass)))
    like '%coalesce(category_id, ''00000000-0000-0000-0000-000000000000''::uuid)%capability_kind, capability_code%',
  'controlled active semantic index includes a nullable-category-safe target'
);
select ok(
  (select lower(pg_catalog.pg_get_indexdef('public.supplier_capabilities_active_custom_semantic_uidx'::regclass)))
    like '%coalesce(category_id, ''00000000-0000-0000-0000-000000000000''::uuid)%normalizer_version, custom_normalized_value%',
  'custom active semantic index includes a nullable-category-safe normalized target'
);
select ok(to_regclass('public.supplier_capabilities_active_position_uidx') is not null, 'active Supplier position unique index exists');
select ok(to_regclass('public.supplier_capabilities_supplier_status_kind_position_idx') is not null, 'Supplier lifecycle lookup index exists');
select ok(to_regclass('public.supplier_capabilities_category_status_supplier_idx') is not null, 'category lifecycle lookup index exists');
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.supplier_capabilities'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'supplier_capabilities use the qualified database UUIDv4 default'
);
select ok(obj_description('public.supplier_capabilities'::regclass) like '%indicative profile claims, not contractual guarantees%', 'table comment preserves the indicative non-contractual boundary');
select ok(col_description('public.supplier_capabilities'::regclass, 4) like '%import_only is excluded%', 'kind comment preserves imports_outside_iraq and import_only distinction');
select ok(col_description('public.supplier_capabilities'::regclass, 9) like '%does not overwrite the original wording%', 'normalization comment preserves original custom wording');
select is((select count(*) from public.supplier_capabilities), 0::bigint, 'migration creates no supplier-capability rows');
select ok(to_regclass('public.supplier_payment_options') is null, 'deferred supplier_payment_options table is absent');
select ok(not exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid = 'public.supplier_capabilities'::regclass
    and attname in ('is_import_only', 'payment_method', 'currency_code', 'credit_days')
    and attnum > 0 and not attisdropped
), 'no unresolved import-only or payment-option fields are created');

select ok(not has_table_privilege('anon', 'public.supplier_capabilities', 'select'), 'anon cannot select supplier_capabilities');
select ok(not has_table_privilege('authenticated', 'public.supplier_capabilities', 'select'), 'authenticated cannot select supplier_capabilities');
select ok(not has_table_privilege('service_role', 'public.supplier_capabilities', 'select'), 'service API role cannot select supplier_capabilities');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_capabilities'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no supplier-capability table privileges');

create temporary table supplier_capability_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Capability Actor', 'buyer')
  returning id
)
insert into supplier_capability_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Capability Supplier', 'Synthetic Capability Supplier', 'english', 'Synthetic Capability Supplier', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_capability_test_ids (name, id) select 'supplier', id from inserted;

with inserted as (
  insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status)
  values ('synthetic_capability_root', 'جذر قدرة تجريبي', 'Synthetic capability root', 'جذر قدرة تجريبي', 'synthetic capability root', 'active')
  returning id
)
insert into supplier_capability_test_ids (name, id) select 'category_root', id from inserted;

with inserted as (
  insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable)
  values ('synthetic_capability_category', (select id from supplier_capability_test_ids where name = 'category_root'), 2, 'تصنيف قدرة تجريبي', 'Synthetic capability category', 'تصنيف قدرة تجريبي', 'synthetic capability category', 'active', true)
  returning id
)
insert into supplier_capability_test_ids (name, id) select 'category', id from inserted;

with inserted as (
  insert into public.supplier_capabilities (
    supplier_profile_id, capability_kind, capability_code, position, record_status, source_type, source_namespace,
    reviewed_by_user_profile_id, reviewed_at, valid_from, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    (select id from supplier_capability_test_ids where name = 'supplier'), 'operational', 'imports_outside_iraq', 0, 'active', 'manual_curation', 'manual_review',
    (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01',
    (select id from supplier_capability_test_ids where name = 'actor'), (select id from supplier_capability_test_ids where name = 'actor')
  ) returning id
)
insert into supplier_capability_test_ids (name, id) select 'imports_outside_iraq', id from inserted;

select is((select count(*) from public.supplier_capabilities), 1::bigint, 'one valid synthetic global imports_outside_iraq capability is accepted');
select ok((select id is not null from public.supplier_capabilities where id = (select id from supplier_capability_test_ids where name = 'imports_outside_iraq')), 'accepted capability receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_capabilities where id = (select id from supplier_capability_test_ids where name = 'imports_outside_iraq')), 'generated capability identity is UUIDv4 with the RFC variant');
select ok((select created_at = updated_at from public.supplier_capabilities where id = (select id from supplier_capability_test_ids where name = 'imports_outside_iraq')), 'default capability timestamps are coherent within one insert statement');
select is((select position from public.supplier_capabilities where id = (select id from supplier_capability_test_ids where name = 'imports_outside_iraq')), 0, 'position persists for the accepted active capability');

select lives_ok($$ insert into public.supplier_capabilities (supplier_profile_id, category_id, capability_kind, custom_label_original, custom_display_label, custom_language_tag, custom_normalized_value, normalizer_version, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), (select id from supplier_capability_test_ids where name = 'category'), 'custom', 'خدمة فنية مخصصة', 'Custom technical service', 'ar-Arab', 'custom technical service', 'capability_custom_v1', 1, 'active', 'supplier_proposal', 'supplier_portal', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'reviewed custom capability accepts optional category scope and its versioned normalized representation');
select lives_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'documentary', 'official_invoice', 2, 'active', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'official_invoice is accepted only as a documentary capability');
select lives_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, custom_label_original, custom_display_label, custom_normalized_value, normalizer_version, record_status, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'custom', 'Historical custom', 'Historical custom', 'historical custom', 'capability_custom_v1', 'archived', 'manual_curation', 'manual_review') $$, 'a never-active custom draft may be archived without inventing an effective interval');

select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'payment', 'cash', 'manual_curation', 'manual_review') $$, null, 'unsupported capability kind is rejected');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'manual_curation', 'manual_review') $$, null, 'controlled capability requires a controlled code');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, custom_label_original, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'Custom', 'manual_curation', 'manual_review') $$, null, 'controlled and custom shapes cannot overlap');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, custom_label_original, custom_display_label, custom_normalized_value, normalizer_version, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'custom', 'custom_code', 'Custom', 'Custom', 'custom', 'capability_custom_v1', 'manual_curation', 'manual_review') $$, null, 'custom capability cannot carry a controlled code');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, custom_display_label, custom_normalized_value, normalizer_version, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'custom', 'Custom', 'custom', 'capability_custom_v1', 'manual_curation', 'manual_review') $$, null, 'custom capability requires original wording');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, custom_label_original, custom_display_label, custom_normalized_value, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'custom', 'Custom', 'Custom', 'custom', 'manual_curation', 'manual_review') $$, null, 'custom capability requires a normalizer version');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, custom_label_original, custom_display_label, custom_language_tag, custom_normalized_value, normalizer_version, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'custom', 'Custom', 'Custom', 'arabic', 'custom', 'capability_custom_v1', 'manual_curation', 'manual_review') $$, null, 'custom language tag must be bounded');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, custom_label_original, custom_display_label, custom_normalized_value, normalizer_version, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'custom', 'Custom', 'Custom', 'import_only', 'capability_custom_v1', 'manual_curation', 'manual_review') $$, null, 'unresolved import_only cannot become a custom canonical semantic target');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'operational', 'import_only', 'manual_curation', 'manual_review') $$, null, 'unresolved import_only cannot become a controlled capability');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, mapping_version) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'legacy_migration', 'firebase_firestore', 'capability_v1') $$, null, 'transformed controlled source requires normalizer version');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, mapping_version) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', 'capability_v1') $$, null, 'manual controlled curation cannot claim a mapping version');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, reviewed_by_user_profile_id) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor')) $$, null, 'review actor and review timestamp must be present together');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, record_status, source_type, source_namespace, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'active', 'manual_curation', 'manual_review', date '2026-01-01') $$, null, 'active capabilities require completed review');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'active', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp()) $$, null, 'active capabilities require valid_from');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'active', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', date '2026-01-02') $$, null, 'active capabilities cannot have a terminal date');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', date '2026-01-01') $$, null, 'draft capabilities cannot carry an effective interval');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'superseded', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-02', date '2026-01-02') $$, null, 'closed reviewed capabilities require a strictly increasing interval');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, created_at, updated_at) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'capability timestamps must be coherent');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace) values (gen_random_uuid(), 'service', 'technical_support', 'manual_curation', 'manual_review') $$, null, 'supplier parent must exist');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, category_id, capability_kind, capability_code, source_type, source_namespace) values ((select id from supplier_capability_test_ids where name = 'supplier'), gen_random_uuid(), 'service', 'technical_support', 'manual_curation', 'manual_review') $$, null, 'optional category scope must reference an existing category');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', gen_random_uuid(), statement_timestamp()) $$, null, 'reviewer parent must exist');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, created_by_user_profile_id) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', gen_random_uuid()) $$, null, 'creation actor must exist');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, source_type, source_namespace, updated_by_user_profile_id) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 'manual_curation', 'manual_review', gen_random_uuid()) $$, null, 'update actor must exist');

select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'operational', 'imports_outside_iraq', 3, 'active', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'one active global controlled semantic target exists per Supplier');
select lives_ok($$ insert into public.supplier_capabilities (supplier_profile_id, category_id, capability_kind, capability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), (select id from supplier_capability_test_ids where name = 'category'), 'operational', 'imports_outside_iraq', 3, 'active', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'same controlled code may be a distinct active category-scoped capability');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, category_id, capability_kind, custom_label_original, custom_display_label, custom_normalized_value, normalizer_version, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), (select id from supplier_capability_test_ids where name = 'category'), 'custom', 'Duplicate custom', 'Duplicate custom', 'custom technical service', 'capability_custom_v1', 4, 'active', 'supplier_proposal', 'supplier_portal', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'one active custom normalized semantic target exists per Supplier and category scope');
select throws_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'service', 'technical_support', 2, 'active', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'active positions are unique within each Supplier capability set');
select lives_ok($$ insert into public.supplier_capabilities (supplier_profile_id, capability_kind, capability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_capability_test_ids where name = 'supplier'), 'operational', 'imports_outside_iraq', 3, 'superseded', 'manual_curation', 'manual_review', (select id from supplier_capability_test_ids where name = 'actor'), statement_timestamp(), date '2025-01-01', date '2025-02-01') $$, 'historical superseded capabilities may repeat an active semantic target and position');
select throws_ok($$ delete from public.supplier_profiles where id = (select id from supplier_capability_test_ids where name = 'supplier') $$, null, 'Supplier parent uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.categories where id = (select id from supplier_capability_test_ids where name = 'category') $$, null, 'category scope uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_capability_test_ids where name = 'actor') $$, null, 'review and actor provenance use ON DELETE RESTRICT');

select * from finish();

rollback;
