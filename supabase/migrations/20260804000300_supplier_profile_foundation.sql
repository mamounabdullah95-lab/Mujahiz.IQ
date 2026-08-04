-- Third local SQL slice: Supplier business-profile root only.
-- This migration creates no ownership, location, contact, taxonomy, eligibility, Auth, or API behavior.

create table public.supplier_profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  legacy_firestore_id text,
  name_original text not null,
  display_name text not null,
  name_language text not null,
  name_ar text,
  name_en text,
  short_description text,
  business_type text not null,
  listing_status text not null default 'approved',
  verification_status text not null default 'community_submitted',
  source_type text not null,
  confidence_level text not null,
  has_direct_experience text not null,
  last_interaction_year integer,
  related_material_service text,
  source_note text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_profiles_legacy_firestore_id_ck check (
    legacy_firestore_id is null
    or octet_length(legacy_firestore_id) between 1 and 512
  ),
  constraint supplier_profiles_name_original_ck check (
    octet_length(btrim(name_original)) between 1 and 200
  ),
  constraint supplier_profiles_display_name_ck check (
    octet_length(btrim(display_name)) between 1 and 200
  ),
  constraint supplier_profiles_name_language_ck check (
    name_language in ('arabic', 'english', 'mixed')
  ),
  constraint supplier_profiles_name_ar_ck check (
    name_ar is null or octet_length(btrim(name_ar)) between 1 and 200
  ),
  constraint supplier_profiles_name_en_ck check (
    name_en is null or octet_length(btrim(name_en)) between 1 and 200
  ),
  constraint supplier_profiles_name_language_values_ck check (
    (name_language = 'arabic' and name_ar is not null and name_en is null)
    or (name_language = 'english' and name_ar is null and name_en is not null)
    or (name_language = 'mixed' and name_ar is not null and name_en is not null)
  ),
  constraint supplier_profiles_short_description_ck check (
    short_description is null or octet_length(btrim(short_description)) between 1 and 2000
  ),
  constraint supplier_profiles_business_type_ck check (
    business_type in (
      'company', 'office', 'workshop', 'factory', 'trader',
      'authorized_distributor', 'importer', 'service_provider',
      'individual_supplier', 'other'
    )
  ),
  constraint supplier_profiles_listing_status_ck check (
    listing_status in ('approved', 'watchlist', 'archived')
  ),
  constraint supplier_profiles_verification_status_ck check (
    verification_status in ('verified', 'community_submitted', 'needs_more_info', 'watchlist')
  ),
  constraint supplier_profiles_lifecycle_coherence_ck check (
    (listing_status = 'watchlist') = (verification_status = 'watchlist')
  ),
  constraint supplier_profiles_source_type_ck check (
    source_type in (
      'purchased_before', 'requested_quotation', 'trusted_recommendation',
      'market_visit', 'found_online', 'known_market_supplier', 'other'
    )
  ),
  constraint supplier_profiles_confidence_level_ck check (
    confidence_level in ('high', 'medium', 'low', 'needs_verification')
  ),
  constraint supplier_profiles_direct_experience_ck check (
    has_direct_experience in ('yes', 'no', 'not_sure')
  ),
  constraint supplier_profiles_last_interaction_year_ck check (
    last_interaction_year is null or last_interaction_year between 1900 and 2100
  ),
  constraint supplier_profiles_related_material_service_ck check (
    related_material_service is null or octet_length(btrim(related_material_service)) between 1 and 200
  ),
  constraint supplier_profiles_source_note_ck check (
    source_note is null or octet_length(btrim(source_note)) between 1 and 1000
  ),
  constraint supplier_profiles_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_profiles_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_profiles_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.supplier_profiles is
  'Trusted-only canonical listed Supplier business profiles. This local root has no ownership, organization, Auth authority, RLS, browser/API grant, or client integration.';
comment on column public.supplier_profiles.id is
  'Database-generated Supplier UUIDv4 identity. It is independent of legacy document IDs and every Auth-provider subject.';
comment on column public.supplier_profiles.legacy_firestore_id is
  'Bounded alternate key for a migrated suppliers/{id} document. It is never the relational primary key, ownership link, or authorization relationship.';
comment on column public.supplier_profiles.name_language is
  'Declares the original canonical-name language shape. Arabic and English values remain distinct and are never silently backfilled.';
comment on column public.supplier_profiles.listing_status is
  'Trusted listing lifecycle only. Listed, claimed, verified owner, RFQ-ready, and paying states remain distinct.';
comment on column public.supplier_profiles.verification_status is
  'Trusted profile-verification signal only. It does not establish Supplier ownership, user eligibility, or Auth verification.';
comment on column public.supplier_profiles.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits migration/bootstrap rows without fabricating an actor.';
comment on column public.supplier_profiles.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits migration/bootstrap rows without fabricating an actor.';

create unique index supplier_profiles_legacy_firestore_id_uidx
  on public.supplier_profiles (legacy_firestore_id)
  where legacy_firestore_id is not null;

create index supplier_profiles_listing_display_created_idx
  on public.supplier_profiles (listing_status, display_name, created_at, id);

create index supplier_profiles_verification_created_idx
  on public.supplier_profiles (verification_status, created_at, id);

create index supplier_profiles_created_by_idx
  on public.supplier_profiles (created_by_user_profile_id, created_at, id)
  where created_by_user_profile_id is not null;

create index supplier_profiles_updated_by_idx
  on public.supplier_profiles (updated_by_user_profile_id, updated_at, id)
  where updated_by_user_profile_id is not null;

revoke all on table public.supplier_profiles from public, anon, authenticated, service_role;
