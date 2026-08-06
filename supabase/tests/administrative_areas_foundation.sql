\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(85);

select has_table('public', 'administrative_areas', 'administrative_areas exists');
select has_column('public', 'administrative_areas', 'id', 'administrative_areas have a UUID identity');
select has_column('public', 'administrative_areas', 'code', 'administrative_areas retain a canonical code');
select has_column('public', 'administrative_areas', 'area_type', 'administrative_areas declare their bounded first-slice type');
select has_column('public', 'administrative_areas', 'parent_area_id', 'administrative_areas retain a hierarchy-ready parent reference');
select has_column('public', 'administrative_areas', 'hierarchy_depth', 'administrative_areas record hierarchy depth');
select has_column('public', 'administrative_areas', 'name_ar', 'administrative_areas require an Arabic name');
select has_column('public', 'administrative_areas', 'name_en', 'administrative_areas require an English name');
select has_column('public', 'administrative_areas', 'name_ar_normalized', 'administrative_areas retain Arabic comparison values');
select has_column('public', 'administrative_areas', 'name_en_normalized', 'administrative_areas retain English comparison values');
select has_column('public', 'administrative_areas', 'name_normalizer_version', 'administrative_areas version their name normalizer');
select has_column('public', 'administrative_areas', 'status', 'administrative_areas have a lifecycle');
select has_column('public', 'administrative_areas', 'sort_order', 'administrative_areas retain deterministic ordering');
select has_column('public', 'administrative_areas', 'reference_source_namespace', 'administrative_areas keep a separate optional reference namespace');
select has_column('public', 'administrative_areas', 'reference_code', 'administrative_areas keep a separate optional reference code');
select has_column('public', 'administrative_areas', 'reference_version', 'administrative_areas keep a separate optional reference version');
select has_column('public', 'administrative_areas', 'reference_published_on', 'administrative_areas keep a separate optional reference date');
select has_column('public', 'administrative_areas', 'created_by_user_profile_id', 'administrative_areas retain nullable creation provenance');
select has_column('public', 'administrative_areas', 'updated_by_user_profile_id', 'administrative_areas retain nullable update provenance');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.administrative_areas'::regclass and attnum > 0 and not attisdropped),
  20::bigint,
  'administrative_areas have exactly the approved physical-column count'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.administrative_areas'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,code:text:true,area_type:text:true,parent_area_id:uuid:false,hierarchy_depth:smallint:true,name_ar:text:true,name_en:text:true,name_ar_normalized:text:true,name_en_normalized:text:true,name_normalizer_version:text:true,status:text:true,sort_order:integer:true,reference_source_namespace:text:false,reference_code:text:false,reference_version:text:false,reference_published_on:date:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'administrative_areas exact columns, types, order, and nullability match the approved local contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.administrative_areas'::regclass),
  20::bigint,
  'administrative_areas have exactly the approved constraint count'
);
select is(
  (
    select string_agg(conname || ':' || contype::text, '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.administrative_areas'::regclass
  ),
  'administrative_areas_area_type_ck:c|administrative_areas_code_ck:c|administrative_areas_created_by_fk:f|administrative_areas_governorate_shape_ck:c|administrative_areas_name_ar_ck:c|administrative_areas_name_ar_normalized_ck:c|administrative_areas_name_en_ck:c|administrative_areas_name_en_normalized_ck:c|administrative_areas_name_normalizer_version_ck:c|administrative_areas_not_self_parent_ck:c|administrative_areas_parent_fk:f|administrative_areas_pkey:p|administrative_areas_reference_code_ck:c|administrative_areas_reference_metadata_ck:c|administrative_areas_reference_source_namespace_ck:c|administrative_areas_reference_version_ck:c|administrative_areas_sort_order_ck:c|administrative_areas_status_ck:c|administrative_areas_timestamp_order_ck:c|administrative_areas_updated_by_fk:f',
  'administrative-area constraint names and types match the approved contract'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.administrative_areas'::regclass and contype = 'f'
  ),
  'administrative_areas_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|administrative_areas_parent_fk:FOREIGN KEY (parent_area_id) REFERENCES administrative_areas(id) ON DELETE RESTRICT|administrative_areas_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'administrative-area foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.administrative_areas'::regclass),
  9::bigint,
  'administrative_areas have exactly the primary-key and approved explicit indexes'
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
    where i.indrelid = 'public.administrative_areas'::regclass
  ),
  'administrative_areas_active_deprecated_sibling_name_ar_uidx:true:true:area_type,parent_area_id,name_ar_normalized|administrative_areas_active_deprecated_sibling_name_en_uidx:true:true:area_type,parent_area_id,name_en_normalized|administrative_areas_code_uidx:true:false:code|administrative_areas_created_by_idx:false:true:created_by_user_profile_id,created_at,id|administrative_areas_parent_status_sort_idx:false:false:parent_area_id,status,sort_order,id|administrative_areas_pkey:true:false:id|administrative_areas_reference_code_idx:false:true:reference_source_namespace,reference_code|administrative_areas_type_status_code_idx:false:false:area_type,status,code|administrative_areas_updated_by_idx:false:true:updated_by_user_profile_id,updated_at,id',
  'administrative-area index names, uniqueness, partiality, and key order match the approved contract'
);
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.administrative_areas'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'administrative_areas use the qualified database UUIDv4 default'
);
select ok(obj_description('public.administrative_areas'::regclass) like '%no reference rows%', 'table comment preserves the empty reference boundary');
select ok(col_description('public.administrative_areas'::regclass, 2) like '%no-trigger slice%', 'code comment names the deferred mutation-enforcement boundary');
select ok(col_description('public.administrative_areas'::regclass, 4) like '%Hierarchy-ready%', 'parent comment documents the later hierarchy expansion boundary');
select ok(col_description('public.administrative_areas'::regclass, 14) like '%external code%', 'reference-code comment keeps external identifiers separate');
select is((select count(*) from public.administrative_areas), 0::bigint, 'migration creates no administrative-area rows');

select ok(not has_table_privilege('anon', 'public.administrative_areas', 'select'), 'anon cannot select administrative_areas');
select ok(not has_table_privilege('authenticated', 'public.administrative_areas', 'select'), 'authenticated cannot select administrative_areas');
select ok(not has_table_privilege('service_role', 'public.administrative_areas', 'select'), 'service API role cannot select administrative_areas');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.administrative_areas'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles have no administrative_areas table privilege');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'public.administrative_areas'::regclass), false, 'RLS remains deferred on the non-granted administrative_areas table');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.administrative_areas'::regclass), 0::bigint, 'administrative_areas have no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'public.administrative_areas'::regclass and not tgisinternal), 0::bigint, 'administrative_areas have no application trigger');
select is((select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f', 'p')), 0::bigint, 'administrative-area slice creates no public function or RPC');
select is((select count(*) from pg_catalog.pg_views where schemaname = 'public'), 0::bigint, 'administrative-area slice creates no public view');
select ok(to_regclass('public.supplier_locations') is null, 'deferred supplier_locations table is absent');
select ok(to_regclass('public.administrative_area_aliases') is null, 'deferred administrative-area aliases table is absent');

create temporary table administrative_area_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Area Creation Actor', 'buyer'), ('Synthetic Area Update Actor', 'buyer')
  returning full_name, id
)
insert into administrative_area_test_ids (name, id)
select case full_name
  when 'Synthetic Area Creation Actor' then 'actor_created'
  else 'actor_updated'
end, id from inserted;

with inserted as (
  insert into public.administrative_areas (
    code, name_ar, name_en, name_ar_normalized, name_en_normalized,
    status, reference_source_namespace, reference_code, reference_version,
    reference_published_on, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    'synthetic_governorate', U&'\0627\0644\0645\0646\0637\0642\0629 \0627\0644\0627\062E\062A\0628\0627\0631\064A\0629', 'Synthetic governorate', U&'\0627\0644\0645\0646\0637\0642\0629 \0627\0644\0627\062E\062A\0628\0627\0631\064A\0629', 'synthetic governorate',
    'active', 'iraq_moj_gazette', 'synthetic-001', '2026-08-05', date '2026-08-05',
    (select id from administrative_area_test_ids where name = 'actor_created'), (select id from administrative_area_test_ids where name = 'actor_updated')
  ) returning id
)
insert into administrative_area_test_ids (name, id) select 'governorate', id from inserted;

select is((select count(*) from public.administrative_areas), 1::bigint, 'valid synthetic governorate is accepted');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.administrative_areas where id = (select id from administrative_area_test_ids where name = 'governorate')), 'generated administrative-area identity is UUIDv4 with the RFC variant');
select is((select area_type from public.administrative_areas where id = (select id from administrative_area_test_ids where name = 'governorate')), 'governorate', 'the default area type is governorate');
select is((select hierarchy_depth from public.administrative_areas where id = (select id from administrative_area_test_ids where name = 'governorate')), 1::smallint, 'the default hierarchy depth is one');
select ok((select parent_area_id is null from public.administrative_areas where id = (select id from administrative_area_test_ids where name = 'governorate')), 'the first-slice governorate has no parent');
select ok((select created_at = updated_at from public.administrative_areas where id = (select id from administrative_area_test_ids where name = 'governorate')), 'default administrative-area timestamps are coherent within one insert statement');
select lives_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_draft_area', U&'\0645\0633\0648\062F\0629 \0627\0644\0645\0646\0637\0642\0629', 'Synthetic draft area', U&'\0645\0633\0648\062F\0629 \0627\0644\0645\0646\0637\0642\0629', 'synthetic draft area') $$, 'minimal governorate draft is accepted without a fabricated reference or actor');
select lives_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, status) values ('synthetic_archived_area', U&'\0645\0646\0637\0642\0629 \0645\0624\0631\0634\0641\0629', 'Synthetic archived area', U&'\0645\0646\0637\0642\0629 \0645\0624\0631\0634\0641\0629', 'synthetic archived area', 'archived') $$, 'archived governorate is accepted as a terminal local state');

select throws_ok($$ insert into public.administrative_areas (code, area_type, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_district', 'district', U&'\0642\0636\0627\0621 \0627\062E\062A\0628\0627\0631\064A', 'Synthetic district', U&'\0642\0636\0627\0621 \0627\062E\062A\0628\0627\0631\064A', 'synthetic district') $$, null, 'district type is rejected in the governorate-only slice');
select throws_ok($$ insert into public.administrative_areas (code, hierarchy_depth, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_depth_two', 2, U&'\0639\0645\0642 \062B\0627\0646', 'Depth two', U&'\0639\0645\0642 \062B\0627\0646', 'depth two') $$, null, 'depth two is rejected in the governorate-only slice');
select throws_ok($$ insert into public.administrative_areas (code, parent_area_id, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_parented', (select id from administrative_area_test_ids where name = 'governorate'), U&'\0644\0647 \0623\0628', 'Parented', U&'\0644\0647 \0623\0628', 'parented') $$, null, 'a parent is rejected in the governorate-only slice');
select throws_ok($$ insert into public.administrative_areas (id, code, parent_area_id, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('11111111-1111-4111-8111-111111111111', 'synthetic_self_parent', '11111111-1111-4111-8111-111111111111', U&'\0630\0627\062A\064A \0627\062E\062A\0628\0627\0631\064A', 'Self parent', U&'\0630\0627\062A\064A \0627\062E\062A\0628\0627\0631\064A', 'self parent') $$, null, 'self-parenting is rejected');
select throws_ok($$ update public.administrative_areas set parent_area_id = (select id from administrative_area_test_ids where name = 'governorate') where id = (select id from administrative_area_test_ids where name = 'governorate') $$, null, 'parent updates remain rejected before hierarchy expansion');
select throws_ok($$ update public.administrative_areas set hierarchy_depth = 2 where id = (select id from administrative_area_test_ids where name = 'governorate') $$, null, 'depth updates remain rejected before hierarchy expansion');

select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('Synthetic_Bad_Code', U&'\0631\0645\0632 \063A\064A\0631 \0635\0627\0644\062D', 'Bad code', U&'\0631\0645\0632 \063A\064A\0631 \0635\0627\0644\062D', 'bad code') $$, null, 'canonical code rejects uppercase characters');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic__separator', U&'\0631\0645\0632 \063A\064A\0631 \0635\0627\0644\062D \062B\0627\0646', 'Bad separator', U&'\0631\0645\0632 \063A\064A\0631 \0635\0627\0644\062D \062B\0627\0646', 'bad separator') $$, null, 'canonical code rejects a repeated separator');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_governorate', U&'\0645\0643\0631\0631 \0631\0645\0632', 'Duplicate code', U&'\0645\0643\0631\0631 \0631\0645\0632', 'duplicate code') $$, null, 'canonical code is globally unique');
select lives_ok($$ update public.administrative_areas set code = 'synthetic_governorate_revised' where id = (select id from administrative_area_test_ids where name = 'governorate') $$, 'no-trigger slice deliberately leaves update immutability to the later trusted mutation path');
select lives_ok($$ update public.administrative_areas set code = 'synthetic_governorate' where id = (select id from administrative_area_test_ids where name = 'governorate') $$, 'test restores canonical code after documenting the deferred update guard');

select throws_ok($$ insert into public.administrative_areas (code, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_missing_ar', 'Missing Arabic', U&'\0645\0641\0642\0648\062F \0639\0631\0628\064A', 'missing arabic') $$, null, 'Arabic name is required');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_ar_normalized, name_en_normalized) values ('synthetic_missing_en', U&'\0645\0641\0642\0648\062F \0625\0646\062C\0644\064A\0632\064A', U&'\0645\0641\0642\0648\062F \0625\0646\062C\0644\064A\0632\064A', 'missing english') $$, null, 'English name is required');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_trim_ar', U&' \0639\0631\0628\064A ', 'Trim Arabic', U&'\0639\0631\0628\064A', 'trim arabic') $$, null, 'Arabic names reject leading or trailing whitespace');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_trim_en', U&'\0639\0631\0628\064A', ' Trim English ', U&'\0639\0631\0628\064A', 'trim english') $$, null, 'English names reject leading or trailing whitespace');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_unicode_trim_ar', U&'\00A0\0639\0631\0628\064A', 'Unicode trim Arabic', U&'\0639\0631\0628\064A', 'unicode trim arabic') $$, null, 'Arabic names reject leading Unicode whitespace');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_normalized_case', U&'\062A\0637\0628\064A\0639', 'Normalization', U&'\062A\0637\0628\064A\0639', 'Not Lowercase') $$, null, 'English normalized comparison values must be lowercase');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, name_normalizer_version) values ('synthetic_normalizer', U&'\0625\0635\062F\0627\0631', 'Version', U&'\0625\0635\062F\0627\0631', 'version', 'bad-version') $$, null, 'normalizer version uses a bounded stable code');

select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, status) values ('synthetic_duplicate_active_ar', U&'\0645\0646\0637\0642\0629 \0645\0645\0627\062B\0644\0629', 'Different English', U&'\0627\0644\0645\0646\0637\0642\0629 \0627\0644\0627\062E\062A\0628\0627\0631\064A\0629', 'different english', 'active') $$, null, 'active governorates cannot share normalized Arabic names');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, status) values ('synthetic_duplicate_active_en', U&'\0645\0646\0637\0642\0629 \0645\062E\062A\0644\0641\0629', 'Different English', U&'\0645\0646\0637\0642\0629 \0645\062E\062A\0644\0641\0629', 'synthetic governorate', 'active') $$, null, 'active governorates cannot share normalized English names');
select lives_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, status) values ('synthetic_duplicate_draft', U&'\0645\0633\0648\062F\0629 \0645\0645\0627\062B\0644\0629', 'Draft duplicate', U&'\0627\0644\0645\0646\0637\0642\0629 \0627\0644\0627\062E\062A\0628\0627\0631\064A\0629', 'synthetic governorate', 'draft') $$, 'draft governorates may retain provisional normalized names until activation review');
select lives_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, status) values ('synthetic_duplicate_archived', U&'\0645\0646\0637\0642\0629 \0645\0624\0631\0634\0641\0629 \0645\0645\0627\062B\0644\0629', 'Archived duplicate', U&'\0627\0644\0645\0646\0637\0642\0629 \0627\0644\0627\062E\062A\0628\0627\0631\064A\0629', 'synthetic governorate', 'archived') $$, 'archived governorates may retain historical normalized names');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, status) values ('synthetic_bad_status', U&'\062D\0627\0644\0629 \063A\064A\0631 \0635\0627\0644\062D\0629', 'Invalid status', U&'\062D\0627\0644\0629 \063A\064A\0631 \0635\0627\0644\062D\0629', 'invalid status', 'unsupported') $$, null, 'unsupported lifecycle status is rejected');

select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, reference_code) values ('synthetic_missing_namespace', U&'\0645\0635\062F\0631 \0645\0641\0642\0648\062F', 'Missing namespace', U&'\0645\0635\062F\0631 \0645\0641\0642\0648\062F', 'missing namespace', 'external-1') $$, null, 'reference codes require a source namespace');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, reference_source_namespace) values ('synthetic_bad_namespace', U&'\0645\0635\062F\0631 \063A\064A\0631 \0635\0627\0644\062D', 'Bad namespace', U&'\0645\0635\062F\0631 \063A\064A\0631 \0635\0627\0644\062D', 'bad namespace', 'Bad-Namespace') $$, null, 'reference source namespace uses a stable lowercase code');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, reference_source_namespace, reference_code) values ('synthetic_trim_reference', U&'\0631\0645\0632 \0645\0631\062C\0639\064A', 'Trim reference', U&'\0631\0645\0632 \0645\0631\062C\0639\064A', 'trim reference', 'iraq_moj_gazette', ' external-1 ') $$, null, 'reference code rejects leading or trailing whitespace');
select lives_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, reference_source_namespace, reference_version, reference_published_on) values ('synthetic_reference_metadata', U&'\0628\064A\0627\0646\0627\062A \0645\0631\062C\0639\064A\0629', 'Reference metadata', U&'\0628\064A\0627\0646\0627\062A \0645\0631\062C\0639\064A\0629', 'reference metadata', 'iraq_moj_gazette', '2026-08-05', date '2026-08-05') $$, 'reference version and date remain nullable metadata independent of a reference code');

select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, created_at, updated_at) values ('synthetic_bad_time', U&'\0648\0642\062A \0633\064A\0621', 'Bad time', U&'\0648\0642\062A \0633\064A\0621', 'bad time', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'administrative-area timestamps must be coherent');
select lives_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized) values ('synthetic_bootstrap', U&'\062A\0645\0647\064A\062F \0627\062E\062A\0628\0627\0631\064A', 'Synthetic bootstrap', U&'\062A\0645\0647\064A\062F \0627\062E\062A\0628\0627\0631\064A', 'synthetic bootstrap') $$, 'nullable actor references permit bootstrap rows without fabricated actors');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, created_by_user_profile_id) values ('synthetic_orphan_created', U&'\0641\0627\0639\0644 \0645\0641\0642\0648\062F', 'Orphan actor', U&'\0641\0627\0639\0644 \0645\0641\0642\0648\062F', 'orphan actor', gen_random_uuid()) $$, null, 'creation actor must reference an existing profile');
select throws_ok($$ insert into public.administrative_areas (code, name_ar, name_en, name_ar_normalized, name_en_normalized, updated_by_user_profile_id) values ('synthetic_orphan_updated', U&'\0641\0627\0639\0644 \0645\0641\0642\0648\062F', 'Orphan actor', U&'\0641\0627\0639\0644 \0645\0641\0642\0648\062F', 'orphan actor', gen_random_uuid()) $$, null, 'update actor must reference an existing profile');
select throws_ok($$ delete from public.user_profiles where id = (select id from administrative_area_test_ids where name = 'actor_created') $$, null, 'creation actor uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from administrative_area_test_ids where name = 'actor_updated') $$, null, 'update actor uses ON DELETE RESTRICT');
select lives_ok($$ update public.administrative_areas set status = 'deprecated' where id = (select id from administrative_area_test_ids where name = 'governorate') $$, 'a governorate may be deprecated without rewriting its identity');

select * from finish();

rollback;
