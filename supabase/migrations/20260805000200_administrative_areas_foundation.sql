-- Fifth local SQL slice: empty Iraqi administrative-area foundation only.
-- This migration creates no reference rows, lower hierarchy, Supplier assignments, API access, or mutation routine.

create table public.administrative_areas (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null,
  area_type text not null default 'governorate',
  parent_area_id uuid,
  hierarchy_depth smallint not null default 1,
  name_ar text not null,
  name_en text not null,
  name_ar_normalized text not null,
  name_en_normalized text not null,
  name_normalizer_version text not null default 'administrative_area_name_v1',
  status text not null default 'draft',
  sort_order integer not null default 0,
  reference_source_namespace text,
  reference_code text,
  reference_version text,
  reference_published_on date,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint administrative_areas_code_ck check (
    char_length(code) between 2 and 64
    and code ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'
  ),
  constraint administrative_areas_area_type_ck check (
    area_type = 'governorate'
  ),
  constraint administrative_areas_governorate_shape_ck check (
    hierarchy_depth = 1
    and parent_area_id is null
  ),
  constraint administrative_areas_not_self_parent_ck check (
    parent_area_id is null or parent_area_id <> id
  ),
  constraint administrative_areas_name_ar_ck check (
    char_length(name_ar) between 2 and 120
    and name_ar = btrim(name_ar)
    and name_ar !~ '^[[:space:]]'
    and name_ar !~ '[[:space:]]$'
    and name_ar !~ '[[:cntrl:]]'
    and name_ar !~ '[<>]'
    and name_ar !~ '[[:space:]]{2,}'
  ),
  constraint administrative_areas_name_en_ck check (
    char_length(name_en) between 2 and 120
    and name_en = btrim(name_en)
    and name_en !~ '^[[:space:]]'
    and name_en !~ '[[:space:]]$'
    and name_en !~ '[[:cntrl:]]'
    and name_en !~ '[<>]'
    and name_en !~ '[[:space:]]{2,}'
  ),
  constraint administrative_areas_name_ar_normalized_ck check (
    char_length(name_ar_normalized) between 2 and 120
    and name_ar_normalized = btrim(name_ar_normalized)
    and name_ar_normalized !~ '^[[:space:]]'
    and name_ar_normalized !~ '[[:space:]]$'
    and name_ar_normalized !~ '[[:cntrl:]]'
    and name_ar_normalized !~ '[<>]'
    and name_ar_normalized !~ '[[:space:]]{2,}'
  ),
  constraint administrative_areas_name_en_normalized_ck check (
    char_length(name_en_normalized) between 2 and 120
    and name_en_normalized = btrim(name_en_normalized)
    and name_en_normalized !~ '^[[:space:]]'
    and name_en_normalized !~ '[[:space:]]$'
    and name_en_normalized = lower(name_en_normalized)
    and name_en_normalized !~ '[[:cntrl:]]'
    and name_en_normalized !~ '[<>]'
    and name_en_normalized !~ '[[:space:]]{2,}'
  ),
  constraint administrative_areas_name_normalizer_version_ck check (
    name_normalizer_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint administrative_areas_status_ck check (
    status in ('draft', 'active', 'deprecated', 'archived')
  ),
  constraint administrative_areas_sort_order_ck check (
    sort_order >= 0
  ),
  constraint administrative_areas_reference_metadata_ck check (
    reference_code is null or reference_source_namespace is not null
  ),
  constraint administrative_areas_reference_source_namespace_ck check (
    reference_source_namespace is null
    or reference_source_namespace ~ '^[a-z][a-z0-9_]{1,62}$'
  ),
  constraint administrative_areas_reference_code_ck check (
    reference_code is null
    or (octet_length(btrim(reference_code)) between 1 and 128 and reference_code = btrim(reference_code))
  ),
  constraint administrative_areas_reference_version_ck check (
    reference_version is null
    or (octet_length(btrim(reference_version)) between 1 and 128 and reference_version = btrim(reference_version))
  ),
  constraint administrative_areas_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint administrative_areas_parent_fk foreign key (parent_area_id)
    references public.administrative_areas (id) on delete restrict,
  constraint administrative_areas_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint administrative_areas_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.administrative_areas is
  'Trusted-only empty local Iraqi administrative-area foundation. It has no reference rows, districts, subdistricts, Supplier assignments, RLS, API/browser grant, Auth bridge, or client integration.';
comment on column public.administrative_areas.id is
  'Database-generated UUIDv4 administrative-area identity. Canonical and official/reference codes are alternate identifiers, never relational primary keys.';
comment on column public.administrative_areas.code is
  'Globally unique lowercase ASCII snake-case canonical Mujahiz area identity. Mutation immutability requires the later authorized trusted mutation path; this no-trigger slice does not claim database update enforcement.';
comment on column public.administrative_areas.area_type is
  'The fifth slice accepts governorate only. District and subdistrict area types require a separately approved expansion of this constraint.';
comment on column public.administrative_areas.parent_area_id is
  'Hierarchy-ready restrictive adjacency reference. Fifth-slice governorate rows must have no parent; later hierarchy support requires an approved constraint expansion.';
comment on column public.administrative_areas.hierarchy_depth is
  'Stored hierarchy depth. Fifth-slice governorate rows are depth 1 only; lower depths are deferred with district and subdistrict support.';
comment on column public.administrative_areas.name_ar_normalized is
  'Versioned trusted comparison value for Arabic sibling-collision checks. The future trusted mutation path must derive it from the approved normalizer; this slice stores and constrains it but adds no normalization function.';
comment on column public.administrative_areas.name_en_normalized is
  'Versioned trusted comparison value for English sibling-collision checks. It must be lowercase and is unique only among active or deprecated siblings in the same reviewed branch.';
comment on column public.administrative_areas.status is
  'Area lifecycle: draft, active, deprecated, archived. Transition history, replacement lineage, and assignment eligibility require later approved work.';
comment on column public.administrative_areas.reference_source_namespace is
  'Optional namespace for a separately sourced official or reference identifier. It is independent of the stable Mujahiz canonical code.';
comment on column public.administrative_areas.reference_code is
  'Optional external code from the separately named reference source. This empty slice neither selects a source nor maps or seeds any reference value.';
comment on column public.administrative_areas.reference_version is
  'Optional source version retained separately from identity and external code when a later reviewed reference population supplies it.';
comment on column public.administrative_areas.reference_published_on is
  'Optional publication or effective date from a later reviewed official/reference source; it is not a row lifecycle timestamp.';
comment on column public.administrative_areas.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';
comment on column public.administrative_areas.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';

create unique index administrative_areas_code_uidx on public.administrative_areas (code);

create unique index administrative_areas_active_deprecated_sibling_name_ar_uidx
  on public.administrative_areas (area_type, parent_area_id, name_ar_normalized) nulls not distinct
  where status in ('active', 'deprecated');

create unique index administrative_areas_active_deprecated_sibling_name_en_uidx
  on public.administrative_areas (area_type, parent_area_id, name_en_normalized) nulls not distinct
  where status in ('active', 'deprecated');

create index administrative_areas_parent_status_sort_idx
  on public.administrative_areas (parent_area_id, status, sort_order, id);

create index administrative_areas_type_status_code_idx
  on public.administrative_areas (area_type, status, code);

create index administrative_areas_reference_code_idx
  on public.administrative_areas (reference_source_namespace, reference_code)
  where reference_code is not null;

create index administrative_areas_created_by_idx
  on public.administrative_areas (created_by_user_profile_id, created_at, id)
  where created_by_user_profile_id is not null;

create index administrative_areas_updated_by_idx
  on public.administrative_areas (updated_by_user_profile_id, updated_at, id)
  where updated_by_user_profile_id is not null;

revoke all on table public.administrative_areas from public, anon, authenticated, service_role;
