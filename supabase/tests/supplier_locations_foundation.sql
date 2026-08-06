\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(56);

select has_table('public', 'supplier_locations', 'supplier_locations exists');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.supplier_locations'::regclass and attnum > 0 and not attisdropped),
  27::bigint,
  'supplier_locations have exactly the approved physical-column count'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.supplier_locations'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,supplier_profile_id:uuid:true,record_class:text:true,record_kind:text:true,position:integer:true,administrative_area_id:uuid:false,coverage_code:text:false,city:text:false,market_area:text:false,address_text:text:false,map_url:text:false,mapping_status:text:true,mapping_rule_version:text:false,mapping_reason:text:false,source_origin:text:true,source_field:text:true,source_ordinal:integer:false,original_source_text:text:false,reviewed_by_user_profile_id:uuid:false,reviewed_at:timestamp with time zone:false,record_status:text:true,valid_from:date:false,valid_until:date:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'supplier_locations exact columns, types, order, and nullability match the approved local contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_locations'::regclass),
  28::bigint,
  'supplier_locations have exactly the approved constraint count'
);
select is(
  (
    select string_agg(conname || ':' || contype::text, '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_locations'::regclass
  ),
  'supplier_locations_address_text_ck:c|supplier_locations_administrative_area_fk:f|supplier_locations_city_ck:c|supplier_locations_class_kind_ck:c|supplier_locations_coverage_code_ck:c|supplier_locations_created_by_fk:f|supplier_locations_map_url_ck:c|supplier_locations_mapping_reason_ck:c|supplier_locations_mapping_rule_version_ck:c|supplier_locations_mapping_status_ck:c|supplier_locations_market_area_ck:c|supplier_locations_original_source_text_ck:c|supplier_locations_physical_evidence_ck:c|supplier_locations_pkey:p|supplier_locations_position_ck:c|supplier_locations_record_class_ck:c|supplier_locations_record_kind_ck:c|supplier_locations_record_status_ck:c|supplier_locations_review_provenance_ck:c|supplier_locations_reviewed_by_fk:f|supplier_locations_source_field_ck:c|supplier_locations_source_ordinal_ck:c|supplier_locations_source_origin_ck:c|supplier_locations_supplier_profile_fk:f|supplier_locations_target_shape_ck:c|supplier_locations_timestamp_order_ck:c|supplier_locations_updated_by_fk:f|supplier_locations_validity_interval_ck:c',
  'supplier-location constraint names and types match the approved contract'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_locations'::regclass and contype = 'f'
  ),
  'supplier_locations_administrative_area_fk:FOREIGN KEY (administrative_area_id) REFERENCES administrative_areas(id) ON DELETE RESTRICT|supplier_locations_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_locations_reviewed_by_fk:FOREIGN KEY (reviewed_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_locations_supplier_profile_fk:FOREIGN KEY (supplier_profile_id) REFERENCES supplier_profiles(id) ON DELETE RESTRICT|supplier_locations_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'supplier-location foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.supplier_locations'::regclass),
  10::bigint,
  'supplier_locations have exactly the primary-key and approved explicit indexes'
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
    where i.indrelid = 'public.supplier_locations'::regclass
  ),
  'supplier_locations_active_area_coverage_uidx:true:true:supplier_profile_id,administrative_area_id|supplier_locations_active_headquarters_uidx:true:true:supplier_profile_id|supplier_locations_active_national_coverage_uidx:true:true:supplier_profile_id|supplier_locations_active_position_uidx:true:true:supplier_profile_id,record_class,record_kind,position|supplier_locations_area_class_status_supplier_idx:false:true:administrative_area_id,record_class,record_status,supplier_profile_id,id|supplier_locations_coverage_code_class_status_supplier_idx:false:true:coverage_code,record_class,record_status,supplier_profile_id,id|supplier_locations_created_by_idx:false:true:created_by_user_profile_id,created_at,id|supplier_locations_pkey:true:false:id|supplier_locations_supplier_class_status_kind_position_idx:false:false:supplier_profile_id,record_class,record_status,record_kind,position,id|supplier_locations_updated_by_idx:false:true:updated_by_user_profile_id,updated_at,id',
  'supplier-location index names, uniqueness, partiality, and key order match the approved contract'
);
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.supplier_locations'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'supplier_locations use the qualified database UUIDv4 default'
);
select ok(obj_description('public.supplier_locations'::regclass) like '%Physical presence and service coverage are distinct%', 'table comment preserves the typed assertion boundary');
select ok(col_description('public.supplier_locations'::regclass, 7) like '%all_iraq%', 'coverage-code comment preserves the non-area national target');
select ok(col_description('public.supplier_locations'::regclass, 11) like '%not a coordinate%', 'map comment excludes coordinates and geocoding');
select is((select count(*) from public.supplier_locations), 0::bigint, 'migration creates no supplier-location rows');
select ok(to_regclass('public.supplier_contacts') is null, 'deferred supplier_contacts table is absent');
select ok(to_regclass('public.supplier_service_areas') is null, 'deferred split coverage table is absent');
select ok(to_regclass('public.supplier_location_coordinates') is null, 'deferred coordinate table is absent');

select ok(not has_table_privilege('anon', 'public.supplier_locations', 'select'), 'anon cannot select supplier_locations');
select ok(not has_table_privilege('authenticated', 'public.supplier_locations', 'select'), 'authenticated cannot select supplier_locations');
select ok(not has_table_privilege('service_role', 'public.supplier_locations', 'select'), 'service API role cannot select supplier_locations');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_locations'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no supplier-location table privileges');

create temporary table supplier_location_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Location Actor', 'buyer')
  returning id
)
insert into supplier_location_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Location Supplier', 'Synthetic Location Supplier', 'english', 'Synthetic Location Supplier', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_location_test_ids (name, id) select 'supplier', id from inserted;

with inserted as (
  insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized)
  values ('synthetic_location_area', U&'\0645\0646\0637\0642\0629 \0627\062E\062A\0628\0627\0631\064A\0629', 'Synthetic location area', U&'\0645\0646\0637\0642\0629 \0627\062E\062A\0628\0627\0631\064A\0629', 'synthetic location area')
  returning id
)
insert into supplier_location_test_ids (name, id) select 'area', id from inserted;

with inserted as (
  insert into public.supplier_locations (
    supplier_profile_id, record_class, record_kind, administrative_area_id, city, market_area, address_text, map_url,
    mapping_status, mapping_rule_version, source_origin, source_field, reviewed_by_user_profile_id, reviewed_at,
    record_status, valid_from, valid_until, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    (select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'headquarters',
    (select id from supplier_location_test_ids where name = 'area'), 'Baghdad', 'Synthetic market', 'Synthetic address', 'https://maps.google.com/?q=synthetic',
    'mapped', 'supplier_location_v1', 'firebase_firestore', 'governorate',
    (select id from supplier_location_test_ids where name = 'actor'), statement_timestamp(),
    'active', date '2026-01-01', date '2026-01-01',
    (select id from supplier_location_test_ids where name = 'actor'), (select id from supplier_location_test_ids where name = 'actor')
  ) returning id
)
insert into supplier_location_test_ids (name, id) select 'headquarters', id from inserted;

select is((select count(*) from public.supplier_locations), 1::bigint, 'one valid synthetic mapped headquarters is accepted');
select ok((select id is not null from public.supplier_locations where id = (select id from supplier_location_test_ids where name = 'headquarters')), 'accepted location receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_locations where id = (select id from supplier_location_test_ids where name = 'headquarters')), 'generated location identity is UUIDv4 with the RFC variant');
select ok((select created_at = updated_at from public.supplier_locations where id = (select id from supplier_location_test_ids where name = 'headquarters')), 'default location timestamps are coherent within one insert statement');
select is((select position from public.supplier_locations where id = (select id from supplier_location_test_ids where name = 'headquarters')), 0, 'position defaults to zero');

select lives_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, coverage_code, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'national', 'all_iraq', 'mapped', 'firebase_firestore', 'coverageAreas[0]', 'active') $$, 'mapped all_iraq national coverage is accepted without an administrative area');
select lives_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, mapping_status, mapping_reason, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'administrative_area', 'pending_review', 'unresolved exact target', 'firebase_firestore', 'coverageAreas[1]') $$, 'non-mapped coverage is retained without a target for review');
select lives_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, position, administrative_area_id, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 0, (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'branches[0]', 'active'), ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 1, (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'branches[1]', 'active') $$, 'multiple active same-area branches remain distinct');
select lives_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'unspecified_presence', 'unmapped', 'firebase_firestore', 'governorates[1]', 'active') $$, 'unmapped physical presence is accepted without geographic target');

select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'unsupported', 'branch', 'firebase_firestore', 'branches[2]') $$, null, 'unsupported record class is rejected');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'national', 'firebase_firestore', 'branches[2]') $$, null, 'record class and kind compatibility is enforced');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, position, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', -1, 'firebase_firestore', 'branches[2]') $$, null, 'negative positions are rejected');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, coverage_code, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'national', 'iraq', 'mapped', 'firebase_firestore', 'coverageAreas[2]') $$, null, 'unsupported coverage codes are rejected');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'mapped', 'firebase_firestore', 'branches[2]') $$, null, 'mapped physical evidence requires one administrative area');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, coverage_code, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'all_iraq', 'mapped', 'firebase_firestore', 'branches[2]') $$, null, 'mapped physical evidence cannot carry a coverage code');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, administrative_area_id, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', (select id from supplier_location_test_ids where name = 'area'), 'unmapped', 'firebase_firestore', 'branches[2]') $$, null, 'non-mapped physical evidence cannot retain an administrative-area target');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, administrative_area_id, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'national', (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'coverageAreas[2]') $$, null, 'mapped national coverage cannot retain an administrative-area target');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'national', 'mapped', 'firebase_firestore', 'coverageAreas[2]') $$, null, 'mapped national coverage requires all_iraq');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, city, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'administrative_area', 'Baghdad', 'pending_review', 'firebase_firestore', 'coverageAreas[2]') $$, null, 'coverage rows cannot store physical city evidence');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, map_url, mapping_status, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'https://example.test/location', 'unmapped', 'firebase_firestore', 'branches[2]') $$, null, 'map URLs are limited to the approved allowlist');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'Firebase-Firestore', 'branches[2]') $$, null, 'source origin uses a bounded stable code');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field, source_ordinal) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'firebase_firestore', 'branches[2]', -1) $$, null, 'negative source ordinals are rejected');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field, reviewed_by_user_profile_id) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'firebase_firestore', 'branches[2]', (select id from supplier_location_test_ids where name = 'actor')) $$, null, 'review actor and review timestamp must be present together');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field, valid_from, valid_until) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'firebase_firestore', 'branches[2]', date '2026-01-02', date '2026-01-01') $$, null, 'validity intervals must be ordered');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field, created_at, updated_at) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'firebase_firestore', 'branches[2]', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'location timestamps must be coherent');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field) values (gen_random_uuid(), 'physical_location', 'branch', 'firebase_firestore', 'branches[2]') $$, null, 'supplier parent must exist');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field, created_by_user_profile_id) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 'firebase_firestore', 'branches[2]', gen_random_uuid()) $$, null, 'creation actor must exist');

select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, position, administrative_area_id, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'branch', 0, (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'branches[3]', 'active') $$, null, 'active position is unique within Supplier, class, and kind');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, administrative_area_id, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'headquarters', (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'governorate_duplicate', 'active') $$, null, 'at most one active headquarters exists per Supplier');
select lives_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, administrative_area_id, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'physical_location', 'headquarters', (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'governorate_archived', 'archived') $$, 'archived headquarters retain historical evidence without consuming the active uniqueness slot');
select lives_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, administrative_area_id, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'administrative_area', (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'coverageAreas[3]', 'active') $$, 'one active mapped administrative-area coverage is accepted');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, administrative_area_id, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'administrative_area', (select id from supplier_location_test_ids where name = 'area'), 'mapped', 'firebase_firestore', 'coverageAreas[4]', 'active') $$, null, 'active mapped coverage is unique per Supplier and administrative area');
select throws_ok($$ insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, coverage_code, mapping_status, source_origin, source_field, record_status) values ((select id from supplier_location_test_ids where name = 'supplier'), 'service_coverage', 'national', 'all_iraq', 'mapped', 'firebase_firestore', 'coverageAreas[4]', 'active') $$, null, 'at most one active all_iraq coverage row exists per Supplier');
select throws_ok($$ delete from public.supplier_profiles where id = (select id from supplier_location_test_ids where name = 'supplier') $$, null, 'Supplier parent uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.administrative_areas where id = (select id from supplier_location_test_ids where name = 'area') $$, null, 'administrative-area target uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_location_test_ids where name = 'actor') $$, null, 'review and actor provenance use ON DELETE RESTRICT');

select * from finish();

rollback;
