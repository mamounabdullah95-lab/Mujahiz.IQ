-- Tenth local SQL slice: empty restricted Supplier contact endpoint foundation only.
-- This migration creates no contact data, mapping execution, RLS, API access, projection, or mutation routine.

create unique index supplier_locations_supplier_profile_id_id_record_class_uidx
  on public.supplier_locations (supplier_profile_id, id, record_class);

create table public.supplier_contacts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  supplier_profile_id uuid not null,
  location_id uuid,
  linked_location_class text,
  channel_type text not null,
  phone_kind text,
  endpoint_display_value text not null,
  normalized_endpoint text not null,
  phone_extension text,
  normalizer_version text not null,
  subject_kind text not null,
  person_display_name text,
  person_role_title text,
  purpose_code text,
  preference_rank integer,
  verification_status text not null default 'unverified',
  verification_method_version text,
  verification_verified_at timestamptz,
  verification_failed_at timestamptz,
  verification_by_user_profile_id uuid,
  verification_system_source text,
  verification_evidence_reference text,
  personal_data_classification text not null default 'potentially_personal',
  legal_basis_status text not null default 'not_assessed',
  legal_basis_reference text,
  consent_subject_scope text,
  consent_data_scope text,
  consent_audience_scope text,
  consent_purpose_scope text,
  consent_capture_method text,
  consent_captured_at timestamptz,
  consent_evidence_reference text,
  consent_withdrawn_at timestamptz,
  maximum_disclosure_classification text not null default 'restricted',
  source_type text not null,
  source_namespace text not null,
  source_field text not null,
  source_ordinal integer,
  source_evidence_reference text,
  mapping_version text,
  mapping_outcome text not null default 'unknown',
  reviewed_by_user_profile_id uuid,
  reviewed_at timestamptz,
  valid_from date,
  valid_until date,
  record_status text not null default 'draft',
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_contacts_location_shape_ck check (
    (location_id is null and linked_location_class is null)
    or (location_id is not null and linked_location_class is not null and linked_location_class = 'physical_location')
  ),
  constraint supplier_contacts_channel_type_ck check (
    channel_type in ('phone', 'email', 'website')
  ),
  constraint supplier_contacts_phone_kind_ck check (
    phone_kind is null or phone_kind in ('fixed_line', 'mobile', 'unspecified')
  ),
  constraint supplier_contacts_endpoint_display_value_ck check (
    octet_length(btrim(endpoint_display_value)) between 1 and 500
  ),
  constraint supplier_contacts_normalized_endpoint_ck check (
    octet_length(normalized_endpoint) between 1 and 500
    and normalized_endpoint = btrim(normalized_endpoint)
  ),
  constraint supplier_contacts_phone_extension_ck check (
    phone_extension is null or phone_extension ~ '^[0-9]{1,10}$'
  ),
  constraint supplier_contacts_normalizer_version_ck check (
    normalizer_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_contacts_channel_shape_ck check (
    (
      channel_type = 'phone'
      and phone_kind is not null
      and normalized_endpoint ~ '^[+][1-9][0-9]{1,14}$'
    )
    or (
      channel_type = 'email'
      and phone_kind is null
      and phone_extension is null
      and normalized_endpoint ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and split_part(normalized_endpoint, '@', 2) = lower(split_part(normalized_endpoint, '@', 2))
    )
    or (
      channel_type = 'website'
      and phone_kind is null
      and phone_extension is null
      and normalized_endpoint ~ '^https?://[^/?#@]+(?::[0-9]{1,5})?(?:/[^#]*)?$'
      and position('@' in split_part(normalized_endpoint, '/', 3)) = 0
    )
  ),
  constraint supplier_contacts_subject_kind_ck check (
    subject_kind in ('company', 'named_person', 'unspecified')
  ),
  constraint supplier_contacts_subject_shape_ck check (
    (
      subject_kind = 'named_person'
      and octet_length(btrim(person_display_name)) between 1 and 160
      and (person_role_title is null or octet_length(btrim(person_role_title)) between 1 and 160)
    )
    or (
      subject_kind in ('company', 'unspecified')
      and person_display_name is null
      and person_role_title is null
    )
  ),
  constraint supplier_contacts_website_subject_ck check (
    channel_type <> 'website' or subject_kind = 'company'
  ),
  constraint supplier_contacts_purpose_code_ck check (
    purpose_code is null or purpose_code in ('general', 'sales', 'procurement', 'accounts', 'support', 'management')
  ),
  constraint supplier_contacts_preference_rank_ck check (
    preference_rank is null or preference_rank > 0
  ),
  constraint supplier_contacts_verification_status_ck check (
    verification_status in ('unverified', 'pending', 'verified', 'failed', 'stale')
  ),
  constraint supplier_contacts_verification_method_version_ck check (
    verification_method_version is null or verification_method_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_contacts_verification_system_source_ck check (
    verification_system_source is null or verification_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_contacts_verification_evidence_reference_ck check (
    verification_evidence_reference is null
    or (octet_length(btrim(verification_evidence_reference)) between 1 and 512 and verification_evidence_reference = btrim(verification_evidence_reference))
  ),
  constraint supplier_contacts_verification_shape_ck check (
    (
      verification_status in ('unverified', 'pending')
      and verification_method_version is null
      and verification_verified_at is null
      and verification_failed_at is null
      and verification_by_user_profile_id is null
      and verification_system_source is null
      and verification_evidence_reference is null
    )
    or (
      verification_status in ('verified', 'stale')
      and verification_method_version is not null
      and verification_verified_at is not null
      and verification_failed_at is null
      and verification_evidence_reference is not null
      and (verification_by_user_profile_id is not null) <> (verification_system_source is not null)
    )
    or (
      verification_status = 'failed'
      and verification_method_version is not null
      and verification_verified_at is null
      and verification_failed_at is not null
      and verification_evidence_reference is not null
      and (verification_by_user_profile_id is not null) <> (verification_system_source is not null)
    )
  ),
  constraint supplier_contacts_personal_data_classification_ck check (
    personal_data_classification in ('non_personal', 'potentially_personal', 'personal')
  ),
  constraint supplier_contacts_subject_privacy_ck check (
    (subject_kind <> 'named_person' or personal_data_classification = 'personal')
    and (subject_kind <> 'unspecified' or personal_data_classification = 'potentially_personal')
  ),
  constraint supplier_contacts_legal_basis_status_ck check (
    legal_basis_status in ('not_assessed', 'not_required', 'consent_recorded', 'withdrawn')
  ),
  constraint supplier_contacts_bounded_legal_evidence_ck check (
    (legal_basis_reference is null or (octet_length(btrim(legal_basis_reference)) between 1 and 512 and legal_basis_reference = btrim(legal_basis_reference)))
    and (consent_subject_scope is null or (octet_length(btrim(consent_subject_scope)) between 1 and 160 and consent_subject_scope = btrim(consent_subject_scope)))
    and (consent_data_scope is null or (octet_length(btrim(consent_data_scope)) between 1 and 160 and consent_data_scope = btrim(consent_data_scope)))
    and (consent_audience_scope is null or (octet_length(btrim(consent_audience_scope)) between 1 and 160 and consent_audience_scope = btrim(consent_audience_scope)))
    and (consent_purpose_scope is null or (octet_length(btrim(consent_purpose_scope)) between 1 and 160 and consent_purpose_scope = btrim(consent_purpose_scope)))
    and (consent_capture_method is null or (octet_length(btrim(consent_capture_method)) between 1 and 128 and consent_capture_method = btrim(consent_capture_method)))
    and (consent_evidence_reference is null or (octet_length(btrim(consent_evidence_reference)) between 1 and 512 and consent_evidence_reference = btrim(consent_evidence_reference)))
  ),
  constraint supplier_contacts_legal_basis_shape_ck check (
    (
      legal_basis_status in ('not_assessed', 'not_required')
      and legal_basis_reference is null
      and consent_subject_scope is null
      and consent_data_scope is null
      and consent_audience_scope is null
      and consent_purpose_scope is null
      and consent_capture_method is null
      and consent_captured_at is null
      and consent_evidence_reference is null
      and consent_withdrawn_at is null
    )
    or (
      legal_basis_status = 'consent_recorded'
      and legal_basis_reference is not null
      and consent_subject_scope is not null
      and consent_data_scope is not null
      and consent_audience_scope is not null
      and consent_purpose_scope is not null
      and consent_capture_method is not null
      and consent_captured_at is not null
      and consent_evidence_reference is not null
      and consent_withdrawn_at is null
    )
    or (
      legal_basis_status = 'withdrawn'
      and legal_basis_reference is not null
      and consent_subject_scope is not null
      and consent_data_scope is not null
      and consent_audience_scope is not null
      and consent_purpose_scope is not null
      and consent_capture_method is not null
      and consent_captured_at is not null
      and consent_evidence_reference is not null
      and consent_withdrawn_at >= consent_captured_at
    )
  ),
  constraint supplier_contacts_maximum_disclosure_classification_ck check (
    maximum_disclosure_classification = 'restricted'
  ),
  constraint supplier_contacts_source_type_ck check (
    source_type in ('legacy_migration', 'import_submission', 'supplier_proposal', 'manual_curation')
  ),
  constraint supplier_contacts_source_namespace_ck check (
    source_namespace ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_contacts_source_field_ck check (
    octet_length(btrim(source_field)) between 1 and 128
  ),
  constraint supplier_contacts_source_ordinal_ck check (
    source_ordinal is null or source_ordinal >= 0
  ),
  constraint supplier_contacts_source_evidence_reference_ck check (
    source_evidence_reference is null
    or (octet_length(btrim(source_evidence_reference)) between 1 and 512 and source_evidence_reference = btrim(source_evidence_reference))
  ),
  constraint supplier_contacts_mapping_version_ck check (
    mapping_version is null or mapping_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_contacts_mapping_outcome_ck check (
    mapping_outcome in ('unknown', 'pending_review', 'mapped', 'unmapped', 'rejected')
  ),
  constraint supplier_contacts_transformation_versions_ck check (
    (
      source_type in ('legacy_migration', 'import_submission')
      and mapping_version is not null
    )
    or (
      source_type in ('supplier_proposal', 'manual_curation')
      and mapping_version is null
    )
  ),
  constraint supplier_contacts_review_provenance_ck check (
    (reviewed_by_user_profile_id is null) = (reviewed_at is null)
  ),
  constraint supplier_contacts_validity_interval_ck check (
    valid_until is null or valid_from is null or valid_until > valid_from
  ),
  constraint supplier_contacts_record_status_ck check (
    record_status in ('draft', 'active', 'superseded', 'archived')
  ),
  constraint supplier_contacts_lifecycle_shape_ck check (
    (
      record_status = 'draft'
      and valid_from is null
      and valid_until is null
    )
    or (
      record_status = 'active'
      and reviewed_by_user_profile_id is not null
      and mapping_outcome = 'mapped'
      and verification_status = 'verified'
      and valid_from is not null
      and valid_until is null
    )
    or (
      record_status = 'superseded'
      and reviewed_by_user_profile_id is not null
      and valid_from is not null
      and valid_until > valid_from
    )
    or (
      record_status = 'archived'
      and (
        (valid_from is null and valid_until is null)
        or (reviewed_by_user_profile_id is not null and valid_from is not null and valid_until > valid_from)
      )
    )
  ),
  constraint supplier_contacts_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_contacts_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_contacts_supplier_location_fk foreign key (supplier_profile_id, location_id, linked_location_class)
    references public.supplier_locations (supplier_profile_id, id, record_class) on delete restrict,
  constraint supplier_contacts_verification_by_fk foreign key (verification_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_contacts_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_contacts_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_contacts_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.supplier_contacts is
  'Trusted-only empty local Supplier contact endpoint foundation. One row is one restricted normalized phone, email, or website endpoint; no rows, mapping execution, trusted mutation routine, RLS, API/browser grant, projection, search, RFQ behavior, Auth bridge, or client integration are created.';
comment on column public.supplier_contacts.supplier_profile_id is
  'Required restrictive Supplier aggregate root. It establishes no legal endpoint ownership, Supplier account ownership, verification, RFQ eligibility, or authority.';
comment on column public.supplier_contacts.location_id is
  'Optional exact physical Supplier-location scope. Null means Supplier-wide rather than headquarters; the composite foreign key rejects another Supplier or service coverage.';
comment on column public.supplier_contacts.normalized_endpoint is
  'Versioned protected comparison value, never a replacement for the display value or an inference of source truth, ownership, reachability, consent, or disclosure.';
comment on column public.supplier_contacts.phone_kind is
  'Technical number classification only. mobile does not prove person or company ownership, consent, WhatsApp capability, public exposure, or preference.';
comment on column public.supplier_contacts.subject_kind is
  'Endpoint subject is company, named_person, or unspecified; a named person is not a channel type and person-only evidence has no row.';
comment on column public.supplier_contacts.preference_rank is
  'Nullable positive explicit routing rank within an active Supplier scope and purpose set. Array order and source position never imply this value.';
comment on column public.supplier_contacts.verification_status is
  'Explicit endpoint verification state. Missing approved evidence is unverified; verification never proves consent, legal basis, disclosure, ownership, or authority.';
comment on column public.supplier_contacts.verification_by_user_profile_id is
  'Nullable verifier provenance only. This foreign key grants no review, activation, disclosure, deletion, or Supplier authority.';
comment on column public.supplier_contacts.legal_basis_status is
  'Explicit privacy/legal-basis evidence state. Missing evidence remains not_assessed and Firebase presence never supplies a basis or consent.';
comment on column public.supplier_contacts.maximum_disclosure_classification is
  'Restricted-only first-boundary disclosure ceiling. No public, authenticated, search, Supplier-owner, Buyer, or RFQ projection is approved.';
comment on column public.supplier_contacts.mapping_outcome is
  'Explicit source disposition. Ambiguous, incomplete, unmapped, and rejected legacy values create no active contact row.';
comment on column public.supplier_contacts.reviewed_by_user_profile_id is
  'Nullable reviewer provenance only. A later trusted mutation path owns reviewer authority; this no-trigger slice creates no authorization behavior.';
comment on column public.supplier_contacts.record_status is
  'Contact lifecycle: draft, active, superseded, archived. Active rows require reviewed mapped evidence and verified endpoint evidence; no activation command exists here.';

create unique index supplier_contacts_active_endpoint_uidx
  on public.supplier_contacts (
    supplier_profile_id,
    (coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    subject_kind,
    channel_type,
    normalized_endpoint,
    (coalesce(phone_extension, ''))
  )
  where record_status = 'active';

create unique index supplier_contacts_active_preference_rank_uidx
  on public.supplier_contacts (
    supplier_profile_id,
    (coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    (coalesce(purpose_code, '')),
    preference_rank
  )
  where record_status = 'active' and preference_rank is not null;

create index supplier_contacts_supplier_scope_status_purpose_rank_idx
  on public.supplier_contacts (supplier_profile_id, location_id, record_status, purpose_code, preference_rank, id);

create index supplier_contacts_location_status_idx
  on public.supplier_contacts (location_id, record_status, supplier_profile_id, id)
  where location_id is not null;

create index supplier_contacts_reviewed_by_idx
  on public.supplier_contacts (reviewed_by_user_profile_id, reviewed_at, id)
  where reviewed_by_user_profile_id is not null;

create index supplier_contacts_verification_by_idx
  on public.supplier_contacts (verification_by_user_profile_id, verification_verified_at, id)
  where verification_by_user_profile_id is not null;

revoke all on table public.supplier_contacts from public, anon, authenticated, service_role;
