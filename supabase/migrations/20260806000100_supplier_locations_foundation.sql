-- Sixth local SQL slice: empty Supplier physical-presence and service-coverage foundation only.
-- This migration creates no location data, contact model, coverage assignment, RLS, API access, or mutation routine.

create table public.supplier_locations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  supplier_profile_id uuid not null,
  record_class text not null,
  record_kind text not null,
  position integer not null default 0,
  administrative_area_id uuid,
  coverage_code text,
  city text,
  market_area text,
  address_text text,
  map_url text,
  mapping_status text not null default 'unknown',
  mapping_rule_version text,
  mapping_reason text,
  source_origin text not null,
  source_field text not null,
  source_ordinal integer,
  original_source_text text,
  reviewed_by_user_profile_id uuid,
  reviewed_at timestamptz,
  record_status text not null default 'draft',
  valid_from date,
  valid_until date,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_locations_record_class_ck check (
    record_class in ('physical_location', 'service_coverage')
  ),
  constraint supplier_locations_record_kind_ck check (
    record_kind in ('headquarters', 'branch', 'unspecified_presence', 'administrative_area', 'national')
  ),
  constraint supplier_locations_class_kind_ck check (
    (record_class = 'physical_location' and record_kind in ('headquarters', 'branch', 'unspecified_presence'))
    or (record_class = 'service_coverage' and record_kind in ('administrative_area', 'national'))
  ),
  constraint supplier_locations_position_ck check (
    position >= 0
  ),
  constraint supplier_locations_coverage_code_ck check (
    coverage_code is null or coverage_code = 'all_iraq'
  ),
  constraint supplier_locations_target_shape_ck check (
    (
      mapping_status = 'mapped'
      and record_class = 'physical_location'
      and administrative_area_id is not null
      and coverage_code is null
    )
    or (
      mapping_status = 'mapped'
      and record_class = 'service_coverage'
      and record_kind = 'administrative_area'
      and administrative_area_id is not null
      and coverage_code is null
    )
    or (
      mapping_status = 'mapped'
      and record_class = 'service_coverage'
      and record_kind = 'national'
      and administrative_area_id is null
      and coverage_code is not null
      and coverage_code = 'all_iraq'
    )
    or (
      mapping_status <> 'mapped'
      and administrative_area_id is null
      and coverage_code is null
    )
  ),
  constraint supplier_locations_physical_evidence_ck check (
    record_class = 'physical_location'
    or (city is null and market_area is null and address_text is null and map_url is null)
  ),
  constraint supplier_locations_city_ck check (
    city is null or octet_length(btrim(city)) between 1 and 120
  ),
  constraint supplier_locations_market_area_ck check (
    market_area is null or octet_length(btrim(market_area)) between 1 and 160
  ),
  constraint supplier_locations_address_text_ck check (
    address_text is null or octet_length(btrim(address_text)) between 1 and 500
  ),
  constraint supplier_locations_map_url_ck check (
    map_url is null
    or (
      octet_length(btrim(map_url)) between 1 and 500
      and map_url = btrim(map_url)
      and map_url ~ '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+/|goo\.gl/maps/|maps\.app\.goo\.gl/)'
    )
  ),
  constraint supplier_locations_mapping_status_ck check (
    mapping_status in ('unknown', 'pending_review', 'mapped', 'unmapped', 'rejected')
  ),
  constraint supplier_locations_mapping_rule_version_ck check (
    mapping_rule_version is null or octet_length(btrim(mapping_rule_version)) between 1 and 128
  ),
  constraint supplier_locations_mapping_reason_ck check (
    mapping_reason is null or octet_length(btrim(mapping_reason)) between 1 and 1000
  ),
  constraint supplier_locations_source_origin_ck check (
    source_origin ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_locations_source_field_ck check (
    octet_length(btrim(source_field)) between 1 and 128
  ),
  constraint supplier_locations_source_ordinal_ck check (
    source_ordinal is null or source_ordinal >= 0
  ),
  constraint supplier_locations_original_source_text_ck check (
    original_source_text is null or octet_length(btrim(original_source_text)) between 1 and 1000
  ),
  constraint supplier_locations_review_provenance_ck check (
    (reviewed_by_user_profile_id is null) = (reviewed_at is null)
  ),
  constraint supplier_locations_record_status_ck check (
    record_status in ('draft', 'active', 'archived')
  ),
  constraint supplier_locations_validity_interval_ck check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  ),
  constraint supplier_locations_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_locations_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_locations_administrative_area_fk foreign key (administrative_area_id)
    references public.administrative_areas (id) on delete restrict,
  constraint supplier_locations_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_locations_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_locations_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.supplier_locations is
  'Trusted-only empty local Supplier location foundation. Physical presence and service coverage are distinct typed assertions; this table has no rows, contacts, RLS, API/browser grant, Auth bridge, mapping execution, RFQ behavior, or client integration.';
comment on column public.supplier_locations.id is
  'Database-generated UUIDv4 Supplier-location identity. Source child identity and replay remain in the existing internal migration-control relations.';
comment on column public.supplier_locations.supplier_profile_id is
  'Required restrictive Supplier aggregate root. A location row never establishes Supplier ownership, organization membership, listing approval, or RFQ eligibility.';
comment on column public.supplier_locations.record_class is
  'Separates physical-place assertions from commercial service-coverage assertions. Physical presence never implies coverage, and coverage never proves premises.';
comment on column public.supplier_locations.record_kind is
  'Physical kinds are headquarters, branch, and unspecified_presence; coverage kinds are administrative_area and national only.';
comment on column public.supplier_locations.administrative_area_id is
  'Optional restrictive governorate-only target for mapped physical or administrative-area coverage evidence. This slice creates no administrative-area rows.';
comment on column public.supplier_locations.coverage_code is
  'Bounded non-area national coverage target. The sole initial value all_iraq never creates a synthetic administrative-area row.';
comment on column public.supplier_locations.map_url is
  'Optional allowlisted physical-place map evidence only. It is not a coordinate, geocode, ownership proof, verification signal, or public projection.';
comment on column public.supplier_locations.mapping_status is
  'Trusted mapping outcome. Unmapped, pending-review, and rejected evidence has no geographic target and cannot silently qualify coverage.';
comment on column public.supplier_locations.source_origin is
  'Stable bounded source namespace, not a complete Firebase payload or a source-system credential.';
comment on column public.supplier_locations.original_source_text is
  'Optional bounded original evidence for later review. It must never contain a complete source document payload.';
comment on column public.supplier_locations.reviewed_by_user_profile_id is
  'Nullable trusted review provenance. The later trusted mutation path owns reviewer authority; this no-trigger slice stores no authorization behavior.';
comment on column public.supplier_locations.record_status is
  'Location lifecycle: draft, active, archived. This slice adds no search, recipient-selection, or mutation behavior.';
comment on column public.supplier_locations.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';
comment on column public.supplier_locations.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';

create unique index supplier_locations_active_headquarters_uidx
  on public.supplier_locations (supplier_profile_id)
  where record_status = 'active'
    and record_class = 'physical_location'
    and record_kind = 'headquarters';

create unique index supplier_locations_active_position_uidx
  on public.supplier_locations (supplier_profile_id, record_class, record_kind, position)
  where record_status = 'active';

create unique index supplier_locations_active_area_coverage_uidx
  on public.supplier_locations (supplier_profile_id, administrative_area_id)
  where record_status = 'active'
    and mapping_status = 'mapped'
    and record_class = 'service_coverage'
    and record_kind = 'administrative_area';

create unique index supplier_locations_active_national_coverage_uidx
  on public.supplier_locations (supplier_profile_id)
  where record_status = 'active'
    and mapping_status = 'mapped'
    and record_class = 'service_coverage'
    and record_kind = 'national'
    and coverage_code = 'all_iraq';

create index supplier_locations_supplier_class_status_kind_position_idx
  on public.supplier_locations (supplier_profile_id, record_class, record_status, record_kind, position, id);

create index supplier_locations_area_class_status_supplier_idx
  on public.supplier_locations (administrative_area_id, record_class, record_status, supplier_profile_id, id)
  where administrative_area_id is not null;

create index supplier_locations_coverage_code_class_status_supplier_idx
  on public.supplier_locations (coverage_code, record_class, record_status, supplier_profile_id, id)
  where coverage_code is not null;

create index supplier_locations_created_by_idx
  on public.supplier_locations (created_by_user_profile_id, created_at, id)
  where created_by_user_profile_id is not null;

create index supplier_locations_updated_by_idx
  on public.supplier_locations (updated_by_user_profile_id, updated_at, id)
  where updated_by_user_profile_id is not null;

revoke all on table public.supplier_locations from public, anon, authenticated, service_role;
