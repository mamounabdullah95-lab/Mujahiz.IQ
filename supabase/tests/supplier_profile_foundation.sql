\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(84);

select has_table('public', 'supplier_profiles', 'supplier_profiles exists');
select has_column('public', 'supplier_profiles', 'id', 'supplier profiles have a UUID identity');
select has_column('public', 'supplier_profiles', 'legacy_firestore_id', 'supplier profiles preserve a legacy alternate key');
select has_column('public', 'supplier_profiles', 'name_ar', 'supplier profiles retain a distinct Arabic name');
select has_column('public', 'supplier_profiles', 'name_en', 'supplier profiles retain a distinct English name');
select has_column('public', 'supplier_profiles', 'listing_status', 'supplier profiles have a listing lifecycle');
select has_column('public', 'supplier_profiles', 'verification_status', 'supplier profiles have a distinct verification signal');
select has_column('public', 'supplier_profiles', 'created_by_user_profile_id', 'supplier profiles retain nullable creation provenance');
select has_column('public', 'supplier_profiles', 'updated_by_user_profile_id', 'supplier profiles retain nullable update provenance');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.supplier_profiles'::regclass and attnum > 0 and not attisdropped),
  21::bigint,
  'supplier profiles have exactly the approved root-column count'
);
select is(
  (
    select md5(string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum))
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.supplier_profiles'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'd682d99a637aa5eeba7ac8f0bd100d87',
  'supplier profiles exact columns, types, order, and nullability match the approved contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_profiles'::regclass),
  22::bigint,
  'supplier profiles have exactly the approved constraint count'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.supplier_profiles'::regclass),
  6::bigint,
  'supplier profiles have exactly the primary-key and five approved indexes'
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
    where i.indrelid = 'public.supplier_profiles'::regclass
  ),
  'supplier_profiles_created_by_idx:false:true:created_by_user_profile_id,created_at,id|supplier_profiles_legacy_firestore_id_uidx:true:true:legacy_firestore_id|supplier_profiles_listing_display_created_idx:false:false:listing_status,display_name,created_at,id|supplier_profiles_pkey:true:false:id|supplier_profiles_updated_by_idx:false:true:updated_by_user_profile_id,updated_at,id|supplier_profiles_verification_created_idx:false:false:verification_status,created_at,id',
  'supplier profile index names, uniqueness, partiality, and key order match the approved contract'
);
select matches(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.supplier_profiles'::regclass and a.attname = 'id'
  ),
  'gen_random_uuid',
  'supplier profile IDs use the qualified database UUIDv4 default'
);
select ok(obj_description('public.supplier_profiles'::regclass) like '%no ownership%', 'table comment preserves the deferred ownership boundary');
select ok(col_description('public.supplier_profiles'::regclass, 5) like '%never silently backfilled%', 'name-language comment preserves bilingual normalization boundary');

select ok(not has_table_privilege('anon', 'public.supplier_profiles', 'select'), 'anon cannot select supplier profiles');
select ok(not has_table_privilege('authenticated', 'public.supplier_profiles', 'select'), 'authenticated cannot select supplier profiles');
select ok(not has_table_privilege('service_role', 'public.supplier_profiles', 'select'), 'service API role cannot select supplier profiles directly');
select ok(not exists (select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl where c.oid = 'public.supplier_profiles'::regclass and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)), 'PUBLIC and API roles have no supplier-profile table privilege');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'public.supplier_profiles'::regclass), false, 'RLS remains deferred on the non-granted supplier table');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.supplier_profiles'::regclass), 0::bigint, 'supplier profiles have no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'public.supplier_profiles'::regclass and not tgisinternal), 0::bigint, 'supplier profiles have no application trigger');
select is((select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f', 'p')), 0::bigint, 'supplier slice creates no public Supplier function or RPC');
select is((select count(*) from pg_catalog.pg_views where schemaname = 'public'), 0::bigint, 'supplier slice creates no public Supplier view');
select ok(to_regclass('public.supplier_locations') is null, 'deferred supplier_locations table is absent');
select ok(to_regclass('public.supplier_contacts') is null, 'deferred supplier_contacts table is absent');
select ok(to_regclass('public.supplier_ownerships') is null, 'deferred supplier_ownerships table is absent');
select ok(to_regclass('public.supplier_category_assignments') is null, 'deferred supplier_category_assignments table is absent');

create temporary table supplier_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values
    ('Synthetic Supplier Creation Actor', 'buyer'),
    ('Synthetic Supplier Update Actor', 'buyer')
  returning full_name, id
)
insert into supplier_test_ids (name, id)
select case full_name
  when 'Synthetic Supplier Creation Actor' then 'actor_created'
  else 'actor_updated'
end, id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    legacy_firestore_id, name_original, display_name, name_language, name_ar, name_en,
    short_description, business_type, source_type, confidence_level, has_direct_experience,
    last_interaction_year, related_material_service, source_note,
    created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    'synthetic-supplier-doc-1', 'شركة المورد الصناعي', 'Synthetic Industrial Supplier', 'mixed', 'شركة المورد الصناعي', 'Synthetic Industrial Supplier',
    'Synthetic local-only Supplier profile.', 'company', 'market_visit', 'high', 'yes',
    2024, 'industrial instrumentation', 'synthetic provenance only',
    (select id from supplier_test_ids where name = 'actor_created'),
    (select id from supplier_test_ids where name = 'actor_updated')
  ) returning id
)
insert into supplier_test_ids (name, id) select 'supplier', id from inserted;

select is((select count(*) from public.supplier_profiles), 1::bigint, 'one valid synthetic Supplier root is accepted');
select ok((select id is not null from public.supplier_profiles where id = (select id from supplier_test_ids where name = 'supplier')), 'accepted Supplier receives a generated UUID');
select is((select listing_status from public.supplier_profiles where id = (select id from supplier_test_ids where name = 'supplier')), 'approved', 'minimal lifecycle defaults to approved listing status');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_profiles where id = (select id from supplier_test_ids where name = 'supplier')), 'generated Supplier identity is UUIDv4 with the RFC variant');
select ok((select created_at = updated_at from public.supplier_profiles where id = (select id from supplier_test_ids where name = 'supplier')), 'default Supplier timestamps are coherent within one insert statement');
select lives_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_ar, name_en, business_type, source_type, confidence_level, has_direct_experience, listing_status, verification_status) values ('Archived Arabic', 'Archived Arabic', 'arabic', 'Arabic canonical name', null, 'company', 'other', 'low', 'no', 'archived', 'verified'), ('Archived Watchlist', 'Archived Watchlist', 'english', null, 'Archived Watchlist', 'company', 'other', 'low', 'no', 'archived', 'watchlist'), ('Current Watchlist', 'Current Watchlist', 'mixed', 'Current Watchlist Arabic', 'Current Watchlist', 'company', 'other', 'low', 'no', 'watchlist', 'watchlist') $$, 'approved, watchlist, and archived lifecycle states preserve the approved matrix');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, listing_status, verification_status) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', 'approved', 'watchlist') $$, null, 'approved listings cannot carry the current watchlist verification signal');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Name', 'unsupported', 'other', 'low', 'no') $$, null, 'unsupported business type is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Name', 'company', 'unsupported', 'low', 'no') $$, null, 'unsupported source type is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'unsupported', 'no') $$, null, 'unsupported confidence level is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'unsupported') $$, null, 'unsupported direct-experience value is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'unsupported', 'Name', 'company', 'other', 'low', 'no') $$, null, 'unsupported name language is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_ar, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Arabic only', 'company', 'other', 'low', 'no') $$, null, 'English naming shape requires an English name only');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'mixed', 'English only', 'company', 'other', 'low', 'no') $$, null, 'mixed naming shape cannot omit the Arabic canonical name');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('   ', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no') $$, null, 'whitespace-only original name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', '   ', 'english', 'Name', 'company', 'other', 'low', 'no') $$, null, 'whitespace-only display name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_ar, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'arabic', '   ', 'company', 'other', 'low', 'no') $$, null, 'whitespace-only Arabic name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', '   ', 'company', 'other', 'low', 'no') $$, null, 'whitespace-only English name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values (repeat('x', 201), 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no') $$, null, 'oversized original name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', repeat('x', 201), 'company', 'other', 'low', 'no') $$, null, 'oversized canonical language name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, short_description, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Name', '   ', 'company', 'other', 'low', 'no') $$, null, 'whitespace-only short description is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, short_description, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'english', 'Name', repeat('x', 2001), 'company', 'other', 'low', 'no') $$, null, 'oversized short description is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, related_material_service) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', '   ') $$, null, 'whitespace-only related material or service is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, related_material_service) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', repeat('x', 201)) $$, null, 'oversized related material or service is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, source_note) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', '   ') $$, null, 'whitespace-only source note is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, source_note) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', repeat('x', 1001)) $$, null, 'oversized source note is rejected');
select lives_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, last_interaction_year) values ('Current Year', 'Current Year', 'english', 'Current Year', 'company', 'other', 'low', 'no', extract(year from current_date)::integer) $$, 'current interaction year is accepted without a fixed future cutoff');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, last_interaction_year) values ('Too Old', 'Too Old', 'english', 'Too Old', 'company', 'other', 'low', 'no', 1899) $$, null, 'interaction year before 1900 is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, last_interaction_year) values ('Future Year', 'Future Year', 'english', 'Future Year', 'company', 'other', 'low', 'no', extract(year from current_date)::integer + 1) $$, null, 'future interaction year is rejected without freezing an upper calendar year');
select lives_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Null Legacy One', 'Null Legacy One', 'english', 'Null Legacy One', 'other', 'other', 'low', 'no'), ('Null Legacy Two', 'Null Legacy Two', 'english', 'Null Legacy Two', 'other', 'other', 'low', 'no') $$, 'multiple null legacy Supplier identifiers remain valid');
select is((select verification_status from public.supplier_profiles where id = (select id from supplier_test_ids where name = 'supplier')), 'community_submitted', 'minimal lifecycle defaults to a non-ownership verification signal');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_ar, business_type, source_type, confidence_level, has_direct_experience) values ('', 'Valid', 'arabic', 'Ø§Ø³Ù…', 'company', 'other', 'low', 'no') $$, null, 'empty original name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', repeat('x', 201), 'english', 'Name', 'company', 'other', 'low', 'no') $$, null, 'oversized display name is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'arabic', 'Name', 'company', 'other', 'low', 'no') $$, null, 'Arabic naming shape requires an Arabic name only');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_ar, business_type, source_type, confidence_level, has_direct_experience) values ('Valid', 'Valid', 'mixed', 'Ø§Ø³Ù…', 'company', 'other', 'low', 'no') $$, null, 'mixed naming shape requires both canonical names');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, listing_status) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', 'pending') $$, null, 'unsupported listing status is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, verification_status) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', 'pending') $$, null, 'unsupported verification status is rejected');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, listing_status, verification_status) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', 'watchlist', 'verified') $$, null, 'watchlist listing and verification states must remain coherent');
select throws_ok($$ insert into public.supplier_profiles (legacy_firestore_id, name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values (repeat('x', 513), 'Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no') $$, null, 'oversized legacy Supplier identifier is rejected');
select throws_ok($$ insert into public.supplier_profiles (legacy_firestore_id, name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('synthetic-supplier-doc-1', 'Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no') $$, null, 'non-null legacy Supplier identifiers are unique');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, created_at, updated_at) values ('Valid', 'Valid', 'english', 'Name', 'company', 'other', 'low', 'no', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'Supplier timestamps must be coherent');
select lives_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience) values ('Bootstrap Supplier', 'Bootstrap Supplier', 'english', 'Bootstrap Supplier', 'other', 'other', 'needs_verification', 'not_sure') $$, 'nullable actor references allow a migration/bootstrap state without fabricated actors');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, created_by_user_profile_id) values ('Orphan', 'Orphan', 'english', 'Orphan', 'other', 'other', 'low', 'no', gen_random_uuid()) $$, null, 'creation actor must reference an existing profile');
select throws_ok($$ insert into public.supplier_profiles (name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience, updated_by_user_profile_id) values ('Orphan', 'Orphan', 'english', 'Orphan', 'other', 'other', 'low', 'no', gen_random_uuid()) $$, null, 'update actor must reference an existing profile');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_test_ids where name = 'actor_created') $$, null, 'creation actor RESTRICT is enforced without another Supplier actor FK masking it');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_test_ids where name = 'actor_updated') $$, null, 'update actor RESTRICT is enforced without another Supplier actor FK masking it');

with inserted as (
  insert into internal.migration_batches (execution_environment, migration_scope, source_system, source_snapshot_reference, transformation_version, schema_version, status, initiated_by)
  values ('local', 'supplier_profile_foundation_test', 'synthetic', 'synthetic-supplier-snapshot-v1', 'supplier-transform-v1', 'supplier-schema-v1', 'planned', 'test-runner')
  returning id
), source as (
  insert into internal.migration_source_dispositions (migration_batch_id, source_collection, source_document_id, source_version, disposition, reason_code, transformation_version)
  select id, 'suppliers', 'synthetic-supplier-doc-1', 'v1', 'migrated', 'accepted', 'supplier-transform-v1' from inserted
  returning id, migration_batch_id
)
insert into internal.migration_record_mappings (migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome, target_logical_type, target_id, mapping_role, child_key, transformation_version, rollback_dependency_order)
select migration_batch_id, 'ordinary_mapping', id, 'migrated', 'supplier_profiles', (select id from supplier_test_ids where name = 'supplier'), 'root', 'profile', 'supplier-transform-v1', 0 from source;

select is((select target_logical_type from internal.migration_record_mappings where target_id = (select id from supplier_test_ids where name = 'supplier')), 'supplier_profiles', 'existing migration-control contract accepts Supplier root provenance');
select ok(to_regclass('public.supplier_profiles_legacy_firestore_id_uidx') is not null, 'legacy Supplier alternate-key index exists');
select ok(to_regclass('public.supplier_profiles_listing_display_created_idx') is not null, 'listing keyset lookup index exists');
select ok(to_regclass('public.supplier_profiles_verification_created_idx') is not null, 'trusted verification lookup index exists');
select ok(to_regclass('public.supplier_profiles_created_by_idx') is not null, 'trusted creation-provenance lookup index exists');
select ok(to_regclass('public.supplier_profiles_updated_by_idx') is not null, 'trusted update-provenance lookup index exists');
select is((select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_profiles'::regclass and contype = 'f' and confdeltype = 'r'), 2::bigint, 'all Supplier actor foreign keys use ON DELETE RESTRICT');
select is((select count(*) from pg_catalog.pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and relname in ('supplier_profiles', 'supplier_locations', 'supplier_contacts', 'supplier_category_assignments', 'supplier_capabilities', 'supplier_payment_options', 'supplier_ownerships', 'supplier_submissions', 'supplier_import_batches', 'supplier_duplicate_fingerprints')), 1::bigint, 'exactly one Supplier application table exists in this slice');

select * from finish();

rollback;
