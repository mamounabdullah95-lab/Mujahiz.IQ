\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(47);

select has_table('public', 'supplier_contacts', 'supplier_contacts exists');
select is((select count(*) from public.supplier_contacts), 0::bigint, 'migration creates no supplier-contact rows');
select ok(to_regclass('public.supplier_locations_supplier_profile_id_id_record_class_uidx') is not null, 'non-partial Supplier/location/class supporting unique index exists');
select ok(
  lower(pg_catalog.pg_get_indexdef('public.supplier_locations_supplier_profile_id_id_record_class_uidx'::regclass))
    like '%(supplier_profile_id, id, record_class)%',
  'supporting location key has the exact composite foreign-key columns'
);
select ok(to_regclass('public.supplier_contacts_active_endpoint_uidx') is not null, 'active endpoint semantic unique index exists');
select ok(to_regclass('public.supplier_contacts_active_preference_rank_uidx') is not null, 'active scope/purpose preference-rank unique index exists');
select ok(to_regclass('public.supplier_contacts_supplier_scope_status_purpose_rank_idx') is not null, 'Supplier contact lifecycle lookup index exists');
select ok(to_regclass('public.supplier_contacts_location_status_idx') is not null, 'location-scoped contact lookup index exists');
select ok(to_regclass('public.supplier_contacts_reviewed_by_idx') is not null, 'review provenance lookup index exists');
select ok(to_regclass('public.supplier_contacts_verification_by_idx') is not null, 'verification provenance lookup index exists');
select ok(not has_table_privilege('anon', 'public.supplier_contacts', 'select'), 'anon cannot select supplier_contacts');
select ok(not has_table_privilege('authenticated', 'public.supplier_contacts', 'insert'), 'authenticated cannot insert supplier_contacts');
select ok(not has_table_privilege('service_role', 'public.supplier_contacts', 'select'), 'service API role cannot select supplier_contacts');
select ok(not exists (
  select 1
  from pg_catalog.pg_class c
  cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  where c.oid = 'public.supplier_contacts'::regclass
    and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
), 'PUBLIC and API roles receive no supplier-contact table privileges');
select ok(not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.supplier_contacts'::regclass), 'contacts foundation creates no RLS policy surface');
select ok(obj_description('public.supplier_contacts'::regclass) like '%no rows, mapping execution, trusted mutation routine, RLS%', 'table comment preserves the empty restricted boundary');
select ok(col_description('public.supplier_contacts'::regclass, 8) like '%never a replacement for the display value%', 'normalization comment preserves source-truth boundary');
select ok(col_description('public.supplier_contacts'::regclass, 6) like '%does not prove%', 'phone-kind comment preserves mobile non-inference');
select ok(col_description('public.supplier_contacts'::regclass, 24) like '%Firebase presence never supplies a basis or consent%', 'legal-basis comment preserves no Firebase inference');

create temporary table supplier_contact_test_ids (name text primary key, id uuid not null) on commit drop;

with inserted as (
  insert into public.user_profiles (full_name, account_context)
  values ('Synthetic Contact Actor', 'buyer')
  returning id
)
insert into supplier_contact_test_ids (name, id) select 'actor', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Contact Supplier A', 'Synthetic Contact Supplier A', 'english', 'Synthetic Contact Supplier A', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_contact_test_ids (name, id) select 'supplier_a', id from inserted;

with inserted as (
  insert into public.supplier_profiles (
    name_original, display_name, name_language, name_en, business_type, source_type, confidence_level, has_direct_experience
  ) values (
    'Synthetic Contact Supplier B', 'Synthetic Contact Supplier B', 'english', 'Synthetic Contact Supplier B', 'company', 'other', 'low', 'no'
  ) returning id
)
insert into supplier_contact_test_ids (name, id) select 'supplier_b', id from inserted;

with inserted as (
  insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field)
  values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'physical_location', 'branch', 'synthetic_test', 'branches[0]')
  returning id
)
insert into supplier_contact_test_ids (name, id) select 'physical_a', id from inserted;

with inserted as (
  insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field)
  values ((select id from supplier_contact_test_ids where name = 'supplier_b'), 'physical_location', 'branch', 'synthetic_test', 'branches[0]')
  returning id
)
insert into supplier_contact_test_ids (name, id) select 'physical_b', id from inserted;

with inserted as (
  insert into public.supplier_locations (supplier_profile_id, record_class, record_kind, source_origin, source_field)
  values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'service_coverage', 'national', 'synthetic_test', 'coverage')
  returning id
)
insert into supplier_contact_test_ids (name, id) select 'coverage_a', id from inserted;

with inserted as (
  insert into public.supplier_contacts (
    supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, purpose_code,
    preference_rank, verification_status, verification_method_version, verification_verified_at, verification_by_user_profile_id,
    verification_evidence_reference, source_type, source_namespace, source_field, mapping_outcome, reviewed_by_user_profile_id,
    reviewed_at, valid_from, record_status
  ) values (
    (select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'sales@Example.test', 'sales@example.test', 'email_idna_v1', 'company', 'sales',
    1, 'verified', 'email_challenge_v1', statement_timestamp(), (select id from supplier_contact_test_ids where name = 'actor'),
    'synthetic:verify:email:1', 'manual_curation', 'manual_review', 'email', 'mapped', (select id from supplier_contact_test_ids where name = 'actor'),
    statement_timestamp(), date '2026-01-01', 'active'
  ) returning id
)
insert into supplier_contact_test_ids (name, id) select 'company_email', id from inserted;

select ok((select id is not null from public.supplier_contacts where id = (select id from supplier_contact_test_ids where name = 'company_email')), 'reviewed verified active company email is accepted');
select ok((select substring(id::text from 15 for 1) = '4' and substring(id::text from 20 for 1) ~ '^[89ab]$' from public.supplier_contacts where id = (select id from supplier_contact_test_ids where name = 'company_email')), 'accepted contact receives a UUIDv4 identity');
select ok((select created_at = updated_at from public.supplier_contacts where id = (select id from supplier_contact_test_ids where name = 'company_email')), 'default contact timestamps are coherent within one insert statement');

select lives_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, phone_kind, endpoint_display_value, normalized_endpoint, phone_extension, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'phone', 'fixed_line', '+964 750 123 4567 ext 22', '+9647501234567', '22', 'e164_lib_v1', 'unspecified', 'manual_curation', 'manual_review', 'phones[0]') $$, 'draft phone accepts a separate extension and unspecified subject without inferring ownership');
select lives_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, person_display_name, person_role_title, personal_data_classification, legal_basis_status, legal_basis_reference, consent_subject_scope, consent_data_scope, consent_audience_scope, consent_purpose_scope, consent_capture_method, consent_captured_at, consent_evidence_reference, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'Person@Example.test', 'Person@example.test', 'email_idna_v1', 'named_person', 'Synthetic Person', 'Sales contact', 'personal', 'consent_recorded', 'synthetic:legal:1', 'named_person', 'email_endpoint', 'restricted_internal_review', 'supplier_contact_review', 'written_record', statement_timestamp(), 'synthetic:consent:1', 'manual_curation', 'manual_review', 'email') $$, 'named-person draft requires and accepts explicit consent evidence shape');
select lives_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'website', 'https://www.example.test/', 'https://www.example.test/', 'url_idna_v1', 'company', 'manual_curation', 'manual_review', 'website') $$, 'company website draft is accepted');

select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'phone', '+9647501234567', '+9647501234567', 'e164_lib_v1', 'company', 'manual_curation', 'manual_review', 'phones[1]') $$, null, 'phone requires an explicit technical phone kind');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, phone_kind, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'mobile', 'sales@example.test', 'sales@example.test', 'email_idna_v1', 'company', 'manual_curation', 'manual_review', 'email') $$, null, 'email cannot carry a phone classification');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, person_display_name, personal_data_classification, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'website', 'https://person.example.test', 'https://person.example.test', 'url_idna_v1', 'named_person', 'Synthetic Person', 'personal', 'manual_curation', 'manual_review', 'website') $$, null, 'website cannot be a named-person endpoint');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, person_display_name, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'sales@example.test', 'sales@example.test', 'email_idna_v1', 'company', 'Synthetic Person', 'manual_curation', 'manual_review', 'email') $$, null, 'company endpoint cannot carry a person name');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'website', 'example.test', 'example.test', 'url_idna_v1', 'company', 'manual_curation', 'manual_review', 'website') $$, null, 'website requires an absolute http or https endpoint');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, location_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), (select id from supplier_contact_test_ids where name = 'physical_a'), 'email', 'location@example.test', 'location@example.test', 'email_idna_v1', 'company', 'manual_curation', 'manual_review', 'email') $$, null, 'location ID and linked class must be present together');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, location_id, linked_location_class, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), (select id from supplier_contact_test_ids where name = 'coverage_a'), 'physical_location', 'email', 'coverage@example.test', 'coverage@example.test', 'email_idna_v1', 'company', 'manual_curation', 'manual_review', 'email') $$, null, 'service coverage cannot be linked as a physical contact location');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, location_id, linked_location_class, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), (select id from supplier_contact_test_ids where name = 'physical_b'), 'physical_location', 'email', 'cross@example.test', 'cross@example.test', 'email_idna_v1', 'company', 'manual_curation', 'manual_review', 'email') $$, null, 'cross-Supplier physical location link is rejected declaratively');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, record_status, source_type, source_namespace, source_field, mapping_outcome, reviewed_by_user_profile_id, reviewed_at, valid_from) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'unverified@example.test', 'unverified@example.test', 'email_idna_v1', 'company', 'active', 'manual_curation', 'manual_review', 'email', 'mapped', (select id from supplier_contact_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01') $$, null, 'active contact cannot treat missing verification evidence as verified');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, verification_status, verification_method_version, verification_verified_at, verification_by_user_profile_id, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'proof@example.test', 'proof@example.test', 'email_idna_v1', 'company', 'verified', 'email_challenge_v1', statement_timestamp(), (select id from supplier_contact_test_ids where name = 'actor'), 'manual_curation', 'manual_review', 'email') $$, null, 'verified status requires bounded verification evidence');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, reviewed_by_user_profile_id, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'review@example.test', 'review@example.test', 'email_idna_v1', 'company', (select id from supplier_contact_test_ids where name = 'actor'), 'manual_curation', 'manual_review', 'email') $$, null, 'review actor and timestamp must be present together');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, legal_basis_status, legal_basis_reference, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'consent@example.test', 'consent@example.test', 'email_idna_v1', 'company', 'consent_recorded', 'firebase_field_present', 'manual_curation', 'manual_review', 'email') $$, null, 'a Firebase field cannot stand in for complete consent evidence');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'legacy@example.test', 'legacy@example.test', 'email_idna_v1', 'company', 'legacy_migration', 'firebase_firestore', 'email') $$, null, 'transformed legacy source requires a mapping version');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, mapping_version, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'manual@example.test', 'manual@example.test', 'email_idna_v1', 'company', 'contact_mapping_v1', 'manual_curation', 'manual_review', 'email') $$, null, 'manual curation cannot fabricate a mapping version');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, preference_rank, source_type, source_namespace, source_field) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'rank@example.test', 'rank@example.test', 'email_idna_v1', 'company', 0, 'manual_curation', 'manual_review', 'email') $$, null, 'preference rank must be positive when known');

select lives_ok($$ insert into public.supplier_contacts (supplier_profile_id, location_id, linked_location_class, channel_type, phone_kind, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, purpose_code, preference_rank, verification_status, verification_method_version, verification_verified_at, verification_by_user_profile_id, verification_evidence_reference, source_type, source_namespace, source_field, mapping_outcome, reviewed_by_user_profile_id, reviewed_at, valid_from, record_status) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), (select id from supplier_contact_test_ids where name = 'physical_a'), 'physical_location', 'phone', 'mobile', '+964 750 123 4567', '+9647501234567', 'e164_lib_v1', 'company', 'support', 1, 'verified', 'call_back_v1', statement_timestamp(), (select id from supplier_contact_test_ids where name = 'actor'), 'synthetic:verify:phone:1', 'manual_curation', 'manual_review', 'branches[0].phone', 'mapped', (select id from supplier_contact_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', 'active') $$, 'same-Supplier physical location contact is accepted');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, purpose_code, preference_rank, verification_status, verification_method_version, verification_verified_at, verification_by_user_profile_id, verification_evidence_reference, source_type, source_namespace, source_field, mapping_outcome, reviewed_by_user_profile_id, reviewed_at, valid_from, record_status) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'sales@Example.test', 'sales@example.test', 'email_idna_v1', 'company', 'support', 2, 'verified', 'email_challenge_v1', statement_timestamp(), (select id from supplier_contact_test_ids where name = 'actor'), 'synthetic:verify:email:2', 'manual_curation', 'manual_review', 'email', 'mapped', (select id from supplier_contact_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', 'active') $$, null, 'active endpoint uniqueness ignores purpose and source evidence');
select throws_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, purpose_code, preference_rank, verification_status, verification_method_version, verification_verified_at, verification_by_user_profile_id, verification_evidence_reference, source_type, source_namespace, source_field, mapping_outcome, reviewed_by_user_profile_id, reviewed_at, valid_from, record_status) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'accounts@example.test', 'accounts@example.test', 'email_idna_v1', 'company', 'sales', 1, 'verified', 'email_challenge_v1', statement_timestamp(), (select id from supplier_contact_test_ids where name = 'actor'), 'synthetic:verify:email:3', 'manual_curation', 'manual_review', 'email', 'mapped', (select id from supplier_contact_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', 'active') $$, null, 'active preference ranks are unique within exact Supplier scope and purpose');
select lives_ok($$ insert into public.supplier_contacts (supplier_profile_id, channel_type, endpoint_display_value, normalized_endpoint, normalizer_version, subject_kind, person_display_name, personal_data_classification, purpose_code, preference_rank, verification_status, verification_method_version, verification_verified_at, verification_by_user_profile_id, verification_evidence_reference, legal_basis_status, legal_basis_reference, consent_subject_scope, consent_data_scope, consent_audience_scope, consent_purpose_scope, consent_capture_method, consent_captured_at, consent_evidence_reference, source_type, source_namespace, source_field, mapping_outcome, reviewed_by_user_profile_id, reviewed_at, valid_from, record_status) values ((select id from supplier_contact_test_ids where name = 'supplier_a'), 'email', 'sales@Example.test', 'sales@example.test', 'email_idna_v1', 'named_person', 'Synthetic Person Two', 'personal', 'management', 1, 'verified', 'email_challenge_v1', statement_timestamp(), (select id from supplier_contact_test_ids where name = 'actor'), 'synthetic:verify:email:4', 'consent_recorded', 'synthetic:legal:2', 'named_person', 'email_endpoint', 'restricted_internal_review', 'supplier_contact_review', 'written_record', statement_timestamp(), 'synthetic:consent:2', 'manual_curation', 'manual_review', 'email', 'mapped', (select id from supplier_contact_test_ids where name = 'actor'), statement_timestamp(), date '2026-01-01', 'active') $$, 'same endpoint with explicitly different subject is separately representable');
select throws_ok($$ delete from public.supplier_profiles where id = (select id from supplier_contact_test_ids where name = 'supplier_a') $$, null, 'Supplier parent uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.supplier_locations where id = (select id from supplier_contact_test_ids where name = 'physical_a') $$, null, 'linked physical location uses ON DELETE RESTRICT');
select throws_ok($$ delete from public.user_profiles where id = (select id from supplier_contact_test_ids where name = 'actor') $$, null, 'review and verification provenance use ON DELETE RESTRICT');

select * from finish();

rollback;
