\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(67);

select has_table('public', 'supplier_payment_options', 'supplier_payment_options exists');
select is(
  (select count(*) from pg_catalog.pg_attribute where attrelid = 'public.supplier_payment_options'::regclass and attnum > 0 and not attisdropped),
  26::bigint,
  'supplier_payment_options have exactly the approved physical-column count'
);
select is(
  (
    select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.supplier_payment_options'::regclass and a.attnum > 0 and not a.attisdropped
  ),
  'id:uuid:true,supplier_profile_id:uuid:true,option_type:text:true,method_code:text:false,currency_code:text:false,credit_availability_code:text:false,credit_days:integer:false,credit_start_code:text:false,timing_code:text:false,advance_percentage:numeric(5,2):false,position:integer:true,record_status:text:true,source_type:text:true,source_namespace:text:true,evidence_reference:text:false,mapping_version:text:false,confidence_level:text:false,review_note:text:false,reviewed_by_user_profile_id:uuid:false,reviewed_at:timestamp with time zone:false,valid_from:date:false,valid_until:date:false,created_at:timestamp with time zone:true,created_by_user_profile_id:uuid:false,updated_at:timestamp with time zone:true,updated_by_user_profile_id:uuid:false',
  'supplier_payment_options exact columns, types, order, and nullability match the approved local contract'
);
select is(
  (select count(*) from pg_catalog.pg_constraint where conrelid = 'public.supplier_payment_options'::regclass),
  26::bigint,
  'supplier_payment_options have exactly the approved constraint count'
);
select is(
  (
    select string_agg(conname || ':' || contype::text, '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_payment_options'::regclass
  ),
  'supplier_payment_options_advance_percentage_ck:c|supplier_payment_options_confidence_level_ck:c|supplier_payment_options_created_by_fk:f|supplier_payment_options_credit_availability_code_ck:c|supplier_payment_options_credit_days_ck:c|supplier_payment_options_credit_start_code_ck:c|supplier_payment_options_currency_code_ck:c|supplier_payment_options_evidence_reference_ck:c|supplier_payment_options_lifecycle_shape_ck:c|supplier_payment_options_mapping_version_ck:c|supplier_payment_options_method_code_ck:c|supplier_payment_options_option_type_ck:c|supplier_payment_options_pkey:p|supplier_payment_options_position_ck:c|supplier_payment_options_record_status_ck:c|supplier_payment_options_review_note_ck:c|supplier_payment_options_review_provenance_ck:c|supplier_payment_options_reviewed_by_fk:f|supplier_payment_options_semantic_shape_ck:c|supplier_payment_options_source_namespace_ck:c|supplier_payment_options_source_type_ck:c|supplier_payment_options_supplier_profile_fk:f|supplier_payment_options_timestamp_order_ck:c|supplier_payment_options_timing_code_ck:c|supplier_payment_options_transformation_versions_ck:c|supplier_payment_options_updated_by_fk:f',
  'payment-option constraint names and types match the approved contract'
);
select is(
  (
    select string_agg(conname || ':' || pg_catalog.pg_get_constraintdef(oid), '|' order by conname)
    from pg_catalog.pg_constraint
    where conrelid = 'public.supplier_payment_options'::regclass and contype = 'f'
  ),
  'supplier_payment_options_created_by_fk:FOREIGN KEY (created_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_payment_options_reviewed_by_fk:FOREIGN KEY (reviewed_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT|supplier_payment_options_supplier_profile_fk:FOREIGN KEY (supplier_profile_id) REFERENCES supplier_profiles(id) ON DELETE RESTRICT|supplier_payment_options_updated_by_fk:FOREIGN KEY (updated_by_user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT',
  'payment-option foreign keys use exact restrictive targets and delete actions'
);
select is(
  (select count(*) from pg_catalog.pg_index where indrelid = 'public.supplier_payment_options'::regclass),
  9::bigint,
  'supplier_payment_options have exactly the primary-key and approved explicit indexes'
);
select ok(to_regclass('public.supplier_payment_options_active_method_uidx') is not null, 'active method semantic unique index exists');
select ok(to_regclass('public.supplier_payment_options_active_currency_uidx') is not null, 'active currency semantic unique index exists');
select ok(to_regclass('public.supplier_payment_options_active_credit_offered_uidx') is not null, 'active offered-credit semantic unique index exists');
select ok(to_regclass('public.supplier_payment_options_active_credit_not_offered_uidx') is not null, 'active no-credit unique index exists');
select ok(
  (select lower(pg_catalog.pg_get_indexdef('public.supplier_payment_options_active_advance_uidx'::regclass)))
    like '%coalesce(advance_percentage, ''-1''::numeric)%',
  'active advance semantic index treats a null percentage as one explicit unspecified value'
);
select ok(to_regclass('public.supplier_payment_options_active_position_uidx') is not null, 'active Supplier position unique index exists');
select ok(to_regclass('public.supplier_payment_options_supplier_status_type_position_idx') is not null, 'Supplier lifecycle lookup index exists');
select ok(to_regclass('public.supplier_payment_options_type_status_supplier_idx') is not null, 'type lifecycle lookup index exists');
select ok(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
    where ad.adrelid = 'public.supplier_payment_options'::regclass and a.attname = 'id'
  ) ~ 'gen_random_uuid',
  'supplier_payment_options use the qualified database UUIDv4 default'
);
select ok(obj_description('public.supplier_payment_options'::regclass) like '%not RFQ, quotation, purchase-order, invoice, or contract terms%', 'table comment preserves independent transaction-term authority');
select ok(col_description('public.supplier_payment_options'::regclass, 8) like '%Ambiguous legacy Firebase labels are not inferred%', 'credit-start comment preserves the no-inference boundary');
select ok(col_description('public.supplier_payment_options'::regclass, 10) like '%never means 100 percent%', 'advance comment preserves null-percentage meaning');
select is((select count(*) from public.supplier_payment_options), 0::bigint, 'migration creates no supplier-payment-option rows');
select ok(to_regclass('public.supplier_payment_option_notes') is null, 'no separate payment notes table is created');
select ok(to_regclass('public.supplier_payment_option_projection') is null, 'no client payment-option projection is created');

select ok(not has_table_privilege('anon', 'public.supplier_payment_options', 'select'), 'anon cannot select supplier_payment_options');
select ok(not has_table_privilege('authenticated', 'public.supplier_payment_options', 'select'), 'authenticated cannot select supplier_payment_options');
select ok(not has_table_privilege('service_role', 'public.supplier_payment_options', 'select'), 'service API role cannot select supplier_payment_options');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_payment_options'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no supplier-payment-option table privileges');

create temporary table supplier_payment_option_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Payment Actor', 'buyer')
  returning id
)
insert into supplier_payment_option_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Payment Supplier', 'Synthetic Payment Supplier', 'english', 'Synthetic Payment Supplier', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_payment_option_test_ids (name, id) select 'supplier', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic No Credit Supplier', 'Synthetic No Credit Supplier', 'english', 'Synthetic No Credit Supplier', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_payment_option_test_ids (name, id) select 'no_credit_supplier', id from inserted;

with inserted as (
  insert into public.supplier_payment_options (
    supplier_profile_id, option_type, method_code, position, record_status, source_type, source_namespace,
    reviewed_by_user_profile_id, reviewed_at, valid_from, created_by_user_profile_id, updated_by_user_profile_id
  ) values (
    (select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cash', 0, 'active', 'manual_curation', 'manual_review',
    (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01',
    (select id from supplier_payment_option_test_ids where name = 'actor'), (select id from supplier_payment_option_test_ids where name = 'actor')
  ) returning id
)
insert into supplier_payment_option_test_ids (name, id) select 'cash', id from inserted;

select is((select count(*) from public.supplier_payment_options), 1::bigint, 'one valid synthetic payment method is accepted');
select ok((select id is not null from public.supplier_payment_options where id = (select id from supplier_payment_option_test_ids where name = 'cash')), 'accepted option receives a generated UUID');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_payment_options where id = (select id from supplier_payment_option_test_ids where name = 'cash')), 'generated payment-option identity is UUIDv4 with the RFC variant');
select ok((select created_at = updated_at from public.supplier_payment_options where id = (select id from supplier_payment_option_test_ids where name = 'cash')), 'default payment-option timestamps are coherent within one insert statement');
select is((select position from public.supplier_payment_options where id = (select id from supplier_payment_option_test_ids where name = 'cash')), 0, 'position persists for the accepted active option');

select lives_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, currency_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'settlement_currency', 'USD', 1, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'reviewed USD settlement-currency option is accepted');
select lives_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, credit_days, credit_start_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, review_note) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'credit_term', 'credit_offered', 30, 'invoice_date', 2, 'active', 'supplier_proposal', 'supplier_portal', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', 'Reviewed synthetic evidence') $$, 'reviewed positive credit plan uses one exact days/start pair');
select lives_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, timing_code, advance_percentage, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'payment_timing', 'advance_payment', null, 3, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'reviewed advance arrangement accepts an unknown percentage without inferring one');
select lives_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'no_credit_supplier'), 'credit_term', 'credit_not_offered', 0, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, 'reviewed explicit no-credit assertion is accepted without days or start event');
select lives_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, timing_code, advance_percentage, source_type, source_namespace, mapping_version) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'payment_timing', 'advance_payment', 25.50, 'legacy_migration', 'firebase_firestore', 'payment_mapping_v1') $$, 'transformed advance draft accepts a bounded reviewed percentage and mapping version');

select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'unsupported', 'cash', 'manual_curation', 'manual_review') $$, null, 'unsupported option type is rejected');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'manual_curation', 'manual_review') $$, null, 'method shape requires a controlled method code');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, currency_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cash', 'USD', 'manual_curation', 'manual_review') $$, null, 'method shape cannot carry a settlement currency');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, currency_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'settlement_currency', 'usd', 'manual_curation', 'manual_review') $$, null, 'settlement currency must use an approved uppercase code');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, credit_days, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'credit_term', 'credit_offered', 30, 'manual_curation', 'manual_review') $$, null, 'positive credit requires an exact approved start event');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, credit_days, credit_start_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'credit_term', 'credit_offered', 0, 'invoice_date', 'manual_curation', 'manual_review') $$, null, 'credit days must be 1 through 365');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, credit_days, credit_start_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'credit_term', 'credit_not_offered', 30, 'invoice_date', 'manual_curation', 'manual_review') $$, null, 'explicit no credit cannot carry days or a start event');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, timing_code, advance_percentage, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'payment_timing', 'advance_payment', 0, 'manual_curation', 'manual_review') $$, null, 'advance percentage must be 1 through 100 when present');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, timing_code, advance_percentage, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'payment_timing', 'advance_payment', 100.01, 'manual_curation', 'manual_review') $$, null, 'advance percentage above 100 is rejected');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, timing_code, credit_start_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'payment_timing', 'advance_payment', 'delivery_date', 'manual_curation', 'manual_review') $$, null, 'ambiguous legacy delivery labels cannot enter a canonical timing option');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, mapping_version) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', 'payment_mapping_v1') $$, null, 'manual curation cannot fabricate a mapping version');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'legacy_migration', 'firebase_firestore') $$, null, 'transformed legacy source requires a mapping version');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, reviewed_by_user_profile_id) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor')) $$, null, 'review actor and review timestamp must be present together');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, record_status, source_type, source_namespace, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'active', 'manual_curation', 'manual_review', date '2026-01-01') $$, null, 'active options require completed review');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', date '2026-01-01') $$, null, 'draft options cannot carry an effective interval');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'superseded', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-02', date '2026-01-02') $$, null, 'closed reviewed options require a strictly increasing interval');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, review_note) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', ' ') $$, null, 'review note must be bounded nonblank restricted evidence');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, created_at, updated_at) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', statement_timestamp(), statement_timestamp() - interval '1 second') $$, null, 'payment-option timestamps must be coherent');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace) values (gen_random_uuid(), 'method', 'cheque', 'manual_curation', 'manual_review') $$, null, 'supplier parent must exist');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', gen_random_uuid(), statement_timestamp()) $$, null, 'reviewer parent must exist');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, created_by_user_profile_id) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', gen_random_uuid()) $$, null, 'creation actor must exist');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, source_type, source_namespace, updated_by_user_profile_id) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 'manual_curation', 'manual_review', gen_random_uuid()) $$, null, 'update actor must exist');

select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cash', 4, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'one active method semantic target exists per Supplier');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, currency_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'settlement_currency', 'USD', 4, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'one active currency semantic target exists per Supplier');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, credit_days, credit_start_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'credit_term', 'credit_offered', 30, 'invoice_date', 4, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'one active positive credit days/start semantic target exists per Supplier');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, credit_availability_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'no_credit_supplier'), 'credit_term', 'credit_not_offered', 1, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'at most one active explicit no-credit assertion exists per Supplier');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, timing_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'payment_timing', 'advance_payment', 4, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'at most one active unspecified-percentage advance assertion exists per Supplier');
select throws_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cheque', 0, 'active', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'active positions are unique within each Supplier payment-option set');
select lives_ok($$ insert into public.supplier_payment_options (supplier_profile_id, option_type, method_code, position, record_status, source_type, source_namespace, reviewed_by_user_profile_id, reviewed_at, valid_from, valid_until) values ((select id from supplier_payment_option_test_ids where name = 'supplier'), 'method', 'cash', 0, 'superseded', 'manual_curation', 'manual_review', (select id from supplier_payment_option_test_ids where name = 'actor'), statement_timestamp(), date '2025-01-01', date '2025-02-01') $$, 'historical superseded options may repeat an active semantic target and position');
select throws_ok($$ delete from public.supplier_profiles where id = (select id from supplier_payment_option_test_ids where name = 'supplier') $$, null, 'Supplier parent uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_payment_option_test_ids where name = 'actor') $$, null, 'review and actor provenance use ON DELETE RESTRICT');

select * from finish();

rollback;
