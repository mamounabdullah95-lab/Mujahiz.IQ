\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(107);

select has_table('public', 'categories', 'categories exists');
select has_column('public', 'categories', 'id', 'categories have a UUID identity');
select has_column('public', 'categories', 'category_type', 'categories declare the approved taxonomy type');
select has_column('public', 'categories', 'code', 'categories retain a canonical code');
select has_column('public', 'categories', 'legacy_firestore_id', 'categories retain an optional legacy alternate key');
select has_column('public', 'categories', 'parent_category_id', 'categories support one parent');
select has_column('public', 'categories', 'hierarchy_depth', 'categories record their bounded hierarchy depth');
select has_column('public', 'categories', 'label_ar', 'categories require an Arabic label');
select has_column('public', 'categories', 'label_en', 'categories require an English label');
select has_column('public', 'categories', 'label_ar_normalized', 'categories retain Arabic collision values');
select has_column('public', 'categories', 'label_en_normalized', 'categories retain English collision values');
select has_column('public', 'categories', 'label_normalizer_version', 'categories version their label normalizer');
select has_column('public', 'categories', 'status', 'categories have a lifecycle');
select has_column('public', 'categories', 'is_assignable', 'categories declare assignability');
select has_column('public', 'categories', 'replacement_category_id', 'categories can identify a replacement');
select has_column('public', 'categories', 'created_by_user_profile_id', 'categories retain nullable creation provenance');
select has_column('public', 'categories', 'updated_by_user_profile_id', 'categories retain nullable update provenance');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.categories'::regclass and attnum > 0 and not attisdropped),
  26::bigint,
  'categories have exactly the approved physical-column count including declarative hierarchy guards'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.categories'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,category_type:text:true,code:text:true,legacy_firestore_id:text:false,parent_category_id:uuid:false,hierarchy_depth:smallint:true,parent_depth:smallint:false,parent_must_be_non_assignable:boolean:false,label_ar:text:true,label_en:text:true,label_ar_normalized:text:true,label_en_normalized:text:true,label_normalizer_version:text:true,description_ar:text:false,description_en:text:false,status:text:true,is_assignable:boolean:true,is_archived:boolean:false,parent_must_be_non_archived:boolean:false,sort_order:integer:true,replacement_category_id:uuid:false,replacement_target_status:text:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'categories exact columns, types, order, and nullability match the approved local contract'
);
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.categories'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'categories use the qualified database UUIDv4 default'
);
select ok(obj_description('public.categories'::regclass) like '%no seed rows%', 'table comment preserves the empty taxonomy boundary');
select ok(col_description('public.categories'::regclass, 3) like '%no-trigger slice%', 'code comment names the deferred mutation-enforcement boundary');
select ok(col_description('public.categories'::regclass, 6) like '%acyclicity%', 'hierarchy comment describes declarative depth and cycle enforcement');
select is((select count(*) from public.categories), 0::bigint, 'migration creates no taxonomy rows');

select ok(not has_table_privilege('anon', 'public.categories', 'select'), 'anon cannot select categories');
select ok(not has_table_privilege('authenticated', 'public.categories', 'select'), 'authenticated cannot select categories');
select ok(not has_table_privilege('service_role', 'public.categories', 'select'), 'service API role cannot select categories');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.categories'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles have no categories table privilege');
select is((select relrowsecurity from pg_catalog.pg_class where oid = 'public.categories'::regclass), false, 'RLS remains deferred on the non-granted categories table');
select is((select count(*) from pg_catalog.pg_policy where polrelid = 'public.categories'::regclass), 0::bigint, 'categories have no policies');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid = 'public.categories'::regclass and not tgisinternal), 0::bigint, 'categories have no application trigger');
select is((select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f', 'p')), 0::bigint, 'categories slice creates no public function or RPC');
select is((select count(*) from pg_catalog.pg_views where schemaname = 'public'), 0::bigint, 'categories slice creates no public view');
select ok(to_regclass('public.category_aliases') is null, 'deferred category_aliases table is absent');
select ok(to_regclass('public.supplier_category_assignments') is null, 'deferred supplier_category_assignments table is absent');
select ok(to_regclass('public.category_translations') is null, 'removed category_translations table is absent');

create temporary table category_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Category Creation Actor', 'buyer'), ('Synthetic Category Update Actor', 'buyer')
  returning full_name, id
)
insert into category_test_ids (name, id)
select case full_name
  when 'Synthetic Category Creation Actor' then 'actor_created'
  else 'actor_updated'
end, id from inserted;

with inserted as (
  insert into public.categories (
    code, label_ar, label_en, label_ar_normalized, label_en_normalized,
    status, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    'synthetic_root', 'تصنيف تجريبي رئيسي', 'Synthetic root', 'تصنيف تجريبي رئيسي', 'synthetic root',
    'active', (select id from category_test_ids where name = 'actor_created'), (select id from category_test_ids where name = 'actor_updated')
  ) returning id
)
insert into category_test_ids (name, id) select 'root', id from inserted;

with inserted as (
  insert into public.categories (
    code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status
  ) values (
    'synthetic_group', (select id from category_test_ids where name = 'root'), 2,
    'مجموعة تجريبية', 'Synthetic group', 'مجموعة تجريبية', 'synthetic group', 'active'
  ) returning id
)
insert into category_test_ids (name, id) select 'group', id from inserted;

with inserted as (
  insert into public.categories (
    code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable
  ) values (
    'synthetic_leaf', (select id from category_test_ids where name = 'group'), 3,
    'فئة تجريبية', 'Synthetic leaf', 'فئة تجريبية', 'synthetic leaf', 'active', true
  ) returning id
)
insert into category_test_ids (name, id) select 'leaf', id from inserted;

select is((select count(*) from public.categories), 3::bigint, 'valid synthetic root, level-two group, and level-three leaf are accepted');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.categories where id = (select id from category_test_ids where name = 'root')), 'generated category identity is UUIDv4 with the RFC variant');
select is((select hierarchy_depth from public.categories where id = (select id from category_test_ids where name = 'leaf')), 3::smallint, 'leaf records the approved maximum depth');
select ok((select is_assignable from public.categories where id = (select id from category_test_ids where name = 'leaf')), 'active leaf can be assignable');
select ok((select created_at = updated_at from public.categories where id = (select id from category_test_ids where name = 'root')), 'default category timestamps are coherent within one insert statement');
select lives_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_draft', 'مسودة تجريبية', 'Synthetic draft', 'مسودة تجريبية', 'synthetic draft') $$, 'minimal non-assignable draft category is accepted');
select lives_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_archived', 'مؤرشف تجريبي', 'Synthetic archived', 'مؤرشف تجريبي', 'synthetic archived', 'archived') $$, 'archived root is accepted as a terminal local state');

select throws_ok($$ insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_too_deep', (select id from category_test_ids where name = 'leaf'), 4, 'مستوى زائد', 'Too deep', 'مستوى زائد', 'too deep') $$, null, 'depth greater than three is rejected');
select throws_ok($$ insert into public.categories (code, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_missing_parent', 2, 'بدون أب', 'Missing parent', 'بدون أب', 'missing parent') $$, null, 'non-root depth requires a parent');
select throws_ok($$ insert into public.categories (id, code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('11111111-1111-4111-8111-111111111111', 'synthetic_self_parent', '11111111-1111-4111-8111-111111111111', 2, 'ذات تجريبية', 'Self parent', 'ذات تجريبية', 'self parent') $$, null, 'self-parenting is rejected');
select throws_ok($$ update public.categories set parent_category_id = (select id from category_test_ids where name = 'leaf'), hierarchy_depth = 2 where id = (select id from category_test_ids where name = 'group') $$, null, 'a cycle-related parent update is rejected by strict parent-depth references');
select throws_ok($$ update public.categories set parent_category_id = (select id from category_test_ids where name = 'group'), hierarchy_depth = 1 where id = (select id from category_test_ids where name = 'root') $$, null, 'root nodes cannot acquire a parent');
select throws_ok($$ update public.categories set status = 'archived' where id = (select id from category_test_ids where name = 'root') $$, null, 'a parent with non-archived descendants cannot be archived');
select throws_ok($$ insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable) values ('synthetic_child_of_leaf', (select id from category_test_ids where name = 'leaf'), 4, 'ابن ورقة', 'Child of leaf', 'ابن ورقة', 'child of leaf', 'active', true) $$, null, 'a child below a level-three leaf is rejected by the maximum-depth constraint');

with inserted as (
  insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable)
  values ('synthetic_assignable_group', (select id from category_test_ids where name = 'root'), 2, 'ورقة مستوى ثان', 'Level two leaf', 'ورقة مستوى ثان', 'level two leaf', 'active', true)
  returning id
)
insert into category_test_ids (name, id) select 'assignable_group', id from inserted;
select throws_ok($$ insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_child_of_assignable_group', (select id from category_test_ids where name = 'assignable_group'), 3, 'ابن ورقة ثانية', 'Child of level two leaf', 'ابن ورقة ثانية', 'child of level two leaf', 'active') $$, null, 'a level-two a child below a level-three leaf is rejected by the maximum-depth constraint');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable) values ('synthetic_assignable_root', 'جذر قابل', 'Assignable root', 'جذر قابل', 'assignable root', 'active', true) $$, null, 'root nodes are never assignable');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status, is_assignable) values ('synthetic_draft_assignable', 'مسودة قابلة', 'Assignable draft', 'مسودة قابلة', 'assignable draft', 'draft', true) $$, null, 'only active leaves may be assignable');

select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('Upper_case', 'رمز غير صالح', 'Invalid code', 'رمز غير صالح', 'invalid code') $$, null, 'canonical code must be lowercase ASCII snake case');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('a', 'رمز قصير', 'Short code', 'رمز قصير', 'short code') $$, null, 'canonical code has a minimum length');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic__double', 'رمز غير صالح اثنين', 'Double separator', 'رمز غير صالح اثنين', 'double separator') $$, null, 'canonical code rejects repeated separators');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_trailing_', 'رمز غير صالح ثلاثة', 'Trailing separator', 'رمز غير صالح ثلاثة', 'trailing separator') $$, null, 'canonical code rejects a trailing separator');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values (repeat('a', 65), 'رمز طويل', 'Long code', 'رمز طويل', 'long code') $$, null, 'canonical code has a maximum length');
select throws_ok($$ insert into public.categories (code, category_type, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_other_type', 'other_taxonomy', 'نوع تجريبي', 'Unsupported type', 'نوع تجريبي', 'unsupported type') $$, null, 'only the approved supplier_offering taxonomy type is accepted');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_root', 'تكرار رمز', 'Duplicate code', 'تكرار رمز', 'duplicate code') $$, null, 'canonical code is globally unique');
select lives_ok($$ update public.categories set code = 'synthetic_root_revised' where id = (select id from category_test_ids where name = 'root') $$, 'no-trigger slice deliberately leaves update immutability to the later trusted mutation path');
select lives_ok($$ update public.categories set code = 'synthetic_root' where id = (select id from category_test_ids where name = 'root') $$, 'test restores canonical code after documenting the deferred update guard');

select throws_ok($$ insert into public.categories (code, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_missing_ar', 'Missing Arabic', 'مفقود عربي', 'missing arabic') $$, null, 'Arabic label is required');
select throws_ok($$ insert into public.categories (code, label_ar, label_ar_normalized, label_en_normalized) values ('synthetic_missing_en', 'مفقود إنجليزي', 'مفقود إنجليزي', 'missing english') $$, null, 'English label is required');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_trim_ar', ' عربى ', 'Trim Arabic', 'عربى', 'trim arabic') $$, null, 'Arabic labels reject leading or trailing whitespace');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_trim_en', 'إنجليزي', ' Trim English ', 'إنجليزي', 'trim english') $$, null, 'English labels reject leading or trailing whitespace');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_ws_ar', 'عربي  مكرر', 'Repeated Arabic whitespace', 'عربي مكرر', 'repeated arabic whitespace') $$, null, 'Arabic labels reject repeated internal whitespace');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_markup_en', 'علامة ترميز', '<b>Markup</b>', 'علامة ترميز', 'markup') $$, null, 'English labels reject markup characters');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_control_en', 'تحكم', E'Control\nLabel', 'تحكم', 'control label') $$, null, 'English labels reject control characters and line breaks');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_short_label', 'أ', 'A', 'أ', 'a') $$, null, 'labels have a two-character minimum');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_long_label', repeat('أ', 121), 'Long label', repeat('أ', 121), 'long label') $$, null, 'Arabic labels have a 120-character maximum');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_normalized_case', 'تطبيع', 'Normalization', 'تطبيع', 'Not Lowercase') $$, null, 'English normalized collision values must be lowercase');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, label_normalizer_version) values ('synthetic_normalizer', 'إصدار', 'Version', 'إصدار', 'version', 'bad-version') $$, null, 'normalizer version uses a bounded stable code');

select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_duplicate_root_ar', 'تصنيف بديل', 'Different root', 'تصنيف تجريبي رئيسي', 'different root', 'active') $$, null, 'active root siblings cannot share normalized Arabic labels');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_duplicate_root_en', 'جذر مختلف', 'Different root', 'جذر مختلف', 'synthetic root', 'active') $$, null, 'active root siblings cannot share normalized English labels');
select lives_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_archived_duplicate', 'تصنيف مؤرشف مماثل', 'Archived duplicate', 'تصنيف تجريبي رئيسي', 'synthetic root', 'archived') $$, 'archived siblings may retain historical normalized labels');

with roots as (
  insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status)
  values
    ('synthetic_branch_one', 'فرع اختبار واحد', 'Synthetic branch one', 'فرع اختبار واحد', 'synthetic branch one', 'active'),
    ('synthetic_branch_two', 'فرع اختبار اثنان', 'Synthetic branch two', 'فرع اختبار اثنان', 'synthetic branch two', 'active')
  returning code, id
)
insert into category_test_ids (name, id)
select case code when 'synthetic_branch_one' then 'branch_one' else 'branch_two' end, id from roots;
select lives_ok($$ insert into public.categories (code, parent_category_id, hierarchy_depth, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_branch_one_child', (select id from category_test_ids where name = 'branch_one'), 2, 'فرع مشترك', 'Shared child', 'فرع مشترك', 'shared child', 'active'), ('synthetic_branch_two_child', (select id from category_test_ids where name = 'branch_two'), 2, 'فرع مشترك', 'Shared child', 'فرع مشترك', 'shared child', 'active') $$, 'identical normalized labels are allowed in separate reviewed branches');

with inserted as (
  insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status)
  values ('synthetic_replacement_target', 'بديل تجريبي', 'Synthetic replacement', 'بديل تجريبي', 'synthetic replacement', 'active')
  returning id
)
insert into category_test_ids (name, id) select 'replacement_target', id from inserted;
select lives_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status, replacement_category_id) values ('synthetic_deprecated', 'متوقف تجريبي', 'Synthetic deprecated', 'متوقف تجريبي', 'synthetic deprecated', 'deprecated', (select id from category_test_ids where name = 'replacement_target')) $$, 'deprecated category can reference a different active same-type replacement');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status, replacement_category_id) values ('synthetic_active_replacement', 'بديل نشط', 'Active replacement source', 'بديل نشط', 'active replacement source', 'active', (select id from category_test_ids where name = 'replacement_target')) $$, null, 'replacement links require a deprecated source');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status, replacement_category_id) values ('synthetic_bad_replacement', 'بديل مسودة', 'Draft replacement', 'بديل مسودة', 'draft replacement', 'deprecated', (select id from category_test_ids where name = 'leaf')) $$, null, 'replacement target must be active');
select throws_ok($$ insert into public.categories (id, code, label_ar, label_en, label_ar_normalized, label_en_normalized, status, replacement_category_id) values ('22222222-2222-4222-8222-222222222222', 'synthetic_self_replacement', 'ذات بديل', 'Self replacement', 'ذات بديل', 'self replacement', 'deprecated', '22222222-2222-4222-8222-222222222222') $$, null, 'self replacement is rejected');
select throws_ok($$ update public.categories set status = 'archived' where id = (select id from category_test_ids where name = 'replacement_target') $$, null, 'an active replacement target cannot be archived while referenced');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, status) values ('synthetic_bad_status', 'حالة تجريبية', 'Invalid status', 'حالة تجريبية', 'invalid status', 'unsupported') $$, null, 'unsupported lifecycle status is rejected');

select lives_ok($$ update public.categories set status = 'archived' where id = (select id from category_test_ids where name = 'leaf') $$, 'archiving a leaf is allowed');
select lives_ok($$ update public.categories set status = 'archived' where id = (select id from category_test_ids where name = 'group') $$, 'archiving a parent after its direct child is archived is allowed');
select lives_ok($$ update public.categories set status = 'archived' where id = (select id from category_test_ids where name = 'assignable_group') $$, 'archiving another resolved level-two branch is allowed');
select lives_ok($$ update public.categories set status = 'archived' where id = (select id from category_test_ids where name = 'root') $$, 'archiving a root after the non-archived branch is resolved is allowed');

select lives_ok($$ insert into public.categories (code, legacy_firestore_id, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_null_legacy_one', null, 'بدون معرف واحد', 'Null legacy one', 'بدون معرف واحد', 'null legacy one'), ('synthetic_null_legacy_two', null, 'بدون معرف اثنان', 'Null legacy two', 'بدون معرف اثنان', 'null legacy two') $$, 'multiple null legacy identifiers remain valid');
insert into public.categories (code, legacy_firestore_id, label_ar, label_en, label_ar_normalized, label_en_normalized)
values ('synthetic_legacy_source', 'synthetic-category-doc-1', 'إرث مصدر', 'Legacy source', 'إرث مصدر', 'legacy source');
select throws_ok($$ insert into public.categories (code, legacy_firestore_id, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_duplicate_legacy_after', 'synthetic-category-doc-1', 'إرث مكرر بعد', 'Duplicate legacy after', 'إرث مكرر بعد', 'duplicate legacy after') $$, null, 'non-null legacy identifiers are unique');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, created_at, updated_at) values ('synthetic_bad_time', 'وقت سيء', 'Bad time', 'وقت سيء', 'bad time', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'category timestamps must be coherent');
select lives_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized) values ('synthetic_bootstrap', 'تمهيد تجريبي', 'Synthetic bootstrap', 'تمهيد تجريبي', 'synthetic bootstrap') $$, 'nullable actor references permit bootstrap rows without fabricated actors');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, created_by_user_profile_id) values ('synthetic_orphan_created', 'فاعل مفقود', 'Orphan actor', 'فاعل مفقود', 'orphan actor', gen_random_uuid()) $$, null, 'creation actor must reference an existing profile');
select throws_ok($$ insert into public.categories (code, label_ar, label_en, label_ar_normalized, label_en_normalized, updated_by_user_profile_id) values ('synthetic_orphan_updated', 'فاعل تعديل مفقود', 'Orphan update actor', 'فاعل تعديل مفقود', 'orphan update actor', gen_random_uuid()) $$, null, 'update actor must reference an existing profile');
select throws_ok($$ delete from public.user_profiles where id = (select id from category_test_ids where name = 'actor_created') $$, null, 'creation actor uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from category_test_ids where name = 'actor_updated') $$, null, 'update actor uses ON DELETE RESTRICT');

with inserted as (
  insert into internal.migration_batches (execution_environment, migration_scope, source_system, source_snapshot_reference, transformation_version, schema_version, status, initiated_by)
  values ('local', 'categories_foundation_test', 'synthetic', 'synthetic-category-snapshot-v1', 'category-transform-v1', 'category-schema-v1', 'planned', 'test-runner')
  returning id
), source as (
  insert into internal.migration_source_dispositions (migration_batch_id, source_collection, source_document_id, source_version, disposition, reason_code, transformation_version)
  select id, 'categories', 'synthetic-category-doc-1', 'v1', 'migrated', 'accepted', 'category-transform-v1' from inserted
  returning id, migration_batch_id
)
insert into internal.migration_record_mappings (migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome, target_logical_type, target_id, mapping_role, child_key, transformation_version, rollback_dependency_order)
select migration_batch_id, 'ordinary_mapping', id, 'migrated', 'categories', id, 'root', 'taxonomy', 'category-transform-v1', 0
from source cross join lateral (select id from public.categories where code = 'synthetic_legacy_source') category;
select is((select target_logical_type from internal.migration_record_mappings where target_logical_type = 'categories' limit 1), 'categories', 'existing migration-control contract accepts synthetic category provenance');

select ok(to_regclass('public.categories_code_uidx') is not null, 'canonical code index exists');
select ok(to_regclass('public.categories_non_archived_sibling_label_ar_uidx') is not null, 'Arabic sibling collision index exists');
select ok(to_regclass('public.categories_non_archived_sibling_label_en_uidx') is not null, 'English sibling collision index exists');
select ok(to_regclass('public.categories_legacy_firestore_id_uidx') is not null, 'legacy alternate-key index exists');
select ok(to_regclass('public.categories_parent_status_sort_idx') is not null, 'hierarchy traversal index exists');
select ok(to_regclass('public.categories_type_status_code_idx') is not null, 'type/status/code lookup index exists');
select ok(to_regclass('public.categories_replacement_status_idx') is not null, 'replacement lookup index exists');
select ok(to_regclass('public.categories_created_by_idx') is not null, 'creation actor lookup index exists');
select ok(to_regclass('public.categories_updated_by_idx') is not null, 'update actor lookup index exists');
select is((select count(*) from pg_catalog.pg_constraint where conrelid = 'public.categories'::regclass and contype = 'f' and confdeltype = 'r'), 5::bigint, 'all category foreign keys use ON DELETE RESTRICT');
select is((select count(*) from pg_catalog.pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and relname in ('categories', 'category_aliases', 'supplier_category_assignments', 'category_translations')), 1::bigint, 'exactly one taxonomy application table exists in this slice');

select * from finish();

rollback;
