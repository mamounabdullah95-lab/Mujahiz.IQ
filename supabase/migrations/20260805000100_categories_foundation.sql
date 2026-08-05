-- Fourth local SQL slice: empty Supplier-offering category taxonomy foundation only.
-- This migration creates no taxonomy rows, aliases, Supplier assignments, API access, or mutation routine.

create table public.categories (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  category_type text not null default 'supplier_offering',
  code text not null,
  legacy_firestore_id text,
  parent_category_id uuid,
  hierarchy_depth smallint not null default 1,
  parent_depth smallint generated always as (
    case when parent_category_id is null then null else hierarchy_depth - 1 end
  ) stored,
  parent_must_be_non_assignable boolean generated always as (
    case when parent_category_id is null then null else false end
  ) stored,
  label_ar text not null,
  label_en text not null,
  label_ar_normalized text not null,
  label_en_normalized text not null,
  label_normalizer_version text not null default 'taxonomy_label_v1',
  description_ar text,
  description_en text,
  status text not null default 'draft',
  is_assignable boolean not null default false,
  is_archived boolean generated always as (status = 'archived') stored,
  parent_must_be_non_archived boolean generated always as (
    case
      when parent_category_id is null or status = 'archived' then null
      else false
    end
  ) stored,
  sort_order integer not null default 0,
  replacement_category_id uuid,
  replacement_target_status text generated always as (
    case when replacement_category_id is null then null else 'active' end
  ) stored,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint categories_category_type_ck check (
    category_type = 'supplier_offering'
  ),
  constraint categories_code_ck check (
    char_length(code) between 2 and 64
    and code ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'
  ),
  constraint categories_legacy_firestore_id_ck check (
    legacy_firestore_id is null
    or octet_length(legacy_firestore_id) between 1 and 512
  ),
  constraint categories_hierarchy_shape_ck check (
    hierarchy_depth between 1 and 3
    and (parent_category_id is null) = (hierarchy_depth = 1)
  ),
  constraint categories_not_self_parent_ck check (
    parent_category_id is null or parent_category_id <> id
  ),
  constraint categories_label_ar_ck check (
    char_length(label_ar) between 2 and 120
    and label_ar = btrim(label_ar)
    and label_ar !~ '[[:cntrl:]]'
    and label_ar !~ '[<>]'
    and label_ar !~ '[[:space:]]{2,}'
  ),
  constraint categories_label_en_ck check (
    char_length(label_en) between 2 and 120
    and label_en = btrim(label_en)
    and label_en !~ '[[:cntrl:]]'
    and label_en !~ '[<>]'
    and label_en !~ '[[:space:]]{2,}'
  ),
  constraint categories_label_ar_normalized_ck check (
    char_length(label_ar_normalized) between 2 and 120
    and label_ar_normalized = btrim(label_ar_normalized)
    and label_ar_normalized !~ '[[:cntrl:]]'
    and label_ar_normalized !~ '[<>]'
    and label_ar_normalized !~ '[[:space:]]{2,}'
  ),
  constraint categories_label_en_normalized_ck check (
    char_length(label_en_normalized) between 2 and 120
    and label_en_normalized = btrim(label_en_normalized)
    and label_en_normalized = lower(label_en_normalized)
    and label_en_normalized !~ '[[:cntrl:]]'
    and label_en_normalized !~ '[<>]'
    and label_en_normalized !~ '[[:space:]]{2,}'
  ),
  constraint categories_label_normalizer_version_ck check (
    label_normalizer_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint categories_description_ar_ck check (
    description_ar is null
    or (
      char_length(description_ar) between 1 and 2000
      and description_ar = btrim(description_ar)
      and description_ar !~ '[[:cntrl:]]'
      and description_ar !~ '[<>]'
    )
  ),
  constraint categories_description_en_ck check (
    description_en is null
    or (
      char_length(description_en) between 1 and 2000
      and description_en = btrim(description_en)
      and description_en !~ '[[:cntrl:]]'
      and description_en !~ '[<>]'
    )
  ),
  constraint categories_status_ck check (
    status in ('draft', 'active', 'deprecated', 'archived')
  ),
  constraint categories_assignability_ck check (
    (not is_assignable or status = 'active')
    and (parent_category_id is not null or not is_assignable)
  ),
  constraint categories_sort_order_ck check (
    sort_order >= 0
  ),
  constraint categories_not_self_replacement_ck check (
    replacement_category_id is null or replacement_category_id <> id
  ),
  constraint categories_replacement_source_status_ck check (
    replacement_category_id is null or status = 'deprecated'
  ),
  constraint categories_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint categories_id_type_depth_assignability_key unique (
    id, category_type, hierarchy_depth, is_assignable
  ),
  constraint categories_id_archived_key unique (id, is_archived),
  constraint categories_id_type_status_key unique (id, category_type, status),
  constraint categories_parent_hierarchy_fk foreign key (
    parent_category_id, category_type, parent_depth, parent_must_be_non_assignable
  ) references public.categories (
    id, category_type, hierarchy_depth, is_assignable
  ) on delete restrict,
  constraint categories_parent_non_archived_fk foreign key (
    parent_category_id, parent_must_be_non_archived
  ) references public.categories (id, is_archived) on delete restrict,
  constraint categories_replacement_fk foreign key (
    replacement_category_id, category_type, replacement_target_status
  ) references public.categories (id, category_type, status) on delete restrict,
  constraint categories_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint categories_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.categories is
  'Trusted-only empty local Supplier-offering taxonomy. It has no seed rows, aliases, Supplier assignments, RLS, API/browser grant, Auth bridge, or client integration.';
comment on column public.categories.id is
  'Database-generated UUIDv4 category identity. Canonical codes and legacy document IDs are alternate identifiers, never relational primary keys.';
comment on column public.categories.code is
  'Globally unique lowercase ASCII snake-case canonical category identity. Mutation immutability requires the later authorized trusted mutation path; this no-trigger slice does not claim database update enforcement.';
comment on column public.categories.legacy_firestore_id is
  'Optional bounded alternate identifier for a future reviewed categories/{id} mapping. This slice neither maps nor adopts Firebase values.';
comment on column public.categories.hierarchy_depth is
  'Stored bounded adjacency depth: 1 root, 2 group, 3 category. Composite self-references enforce parent depth, type coherence, leaf-only assignability, and acyclicity by strictly decreasing parent depth.';
comment on column public.categories.label_ar_normalized is
  'Versioned trusted comparison value for Arabic sibling-collision checks. The future trusted mutation path must derive it from the approved normalizer; this slice stores and constrains it but adds no normalization function.';
comment on column public.categories.label_en_normalized is
  'Versioned trusted comparison value for English sibling-collision checks. It must be lowercase and is unique only among non-archived siblings in the same reviewed branch.';
comment on column public.categories.status is
  'Taxonomy lifecycle: draft, active, deprecated, archived. The table enforces valid state combinations but transition history requires the later trusted mutation path.';
comment on column public.categories.is_assignable is
  'Only active non-root leaves can be assignable. The parent self-reference prevents adding a child below an assignable node.';
comment on column public.categories.replacement_category_id is
  'Optional same-type active replacement for a deprecated category. Replacement targets are restrictive and no application assignment is rewritten by this slice.';
comment on column public.categories.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';
comment on column public.categories.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';

create unique index categories_code_uidx on public.categories (code);

create unique index categories_non_archived_sibling_label_ar_uidx
  on public.categories (category_type, parent_category_id, label_ar_normalized) nulls not distinct
  where status in ('active', 'deprecated');

create unique index categories_non_archived_sibling_label_en_uidx
  on public.categories (category_type, parent_category_id, label_en_normalized) nulls not distinct
  where status in ('active', 'deprecated');

create unique index categories_legacy_firestore_id_uidx
  on public.categories (legacy_firestore_id)
  where legacy_firestore_id is not null;

create index categories_parent_status_sort_idx
  on public.categories (parent_category_id, status, sort_order, id);

create index categories_type_status_code_idx
  on public.categories (category_type, status, code);

create index categories_replacement_status_idx
  on public.categories (replacement_category_id, status, id)
  where replacement_category_id is not null;

create index categories_created_by_idx
  on public.categories (created_by_user_profile_id, created_at, id)
  where created_by_user_profile_id is not null;

create index categories_updated_by_idx
  on public.categories (updated_by_user_profile_id, updated_at, id)
  where updated_by_user_profile_id is not null;

revoke all on table public.categories from public, anon, authenticated, service_role;
