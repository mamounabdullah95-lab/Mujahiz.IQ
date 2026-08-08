-- Eighth local SQL slice: empty reviewed Supplier capability foundation only.
-- This migration creates no capability vocabulary rows, mappings, payment options, RLS, API access, or mutation routine.

create table public.supplier_capabilities (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  supplier_profile_id uuid not null,
  category_id uuid,
  capability_kind text not null,
  capability_code text,
  custom_label_original text,
  custom_display_label text,
  custom_language_tag text,
  custom_normalized_value text,
  normalizer_version text,
  position integer not null default 0,
  record_status text not null default 'draft',
  source_type text not null,
  source_namespace text not null,
  evidence_reference text,
  mapping_version text,
  confidence_level text,
  reviewed_by_user_profile_id uuid,
  reviewed_at timestamptz,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_capabilities_capability_kind_ck check (
    capability_kind in ('operational', 'service', 'documentary', 'experience', 'custom')
  ),
  constraint supplier_capabilities_capability_code_ck check (
    capability_code is null
    or (capability_code ~ '^[a-z][a-z0-9_]{0,62}$' and capability_code <> 'import_only')
  ),
  constraint supplier_capabilities_custom_text_bounds_ck check (
    (custom_label_original is null or (octet_length(custom_label_original) between 1 and 300 and btrim(custom_label_original) <> ''))
    and (custom_display_label is null or (octet_length(custom_display_label) between 1 and 300 and btrim(custom_display_label) <> ''))
  ),
  constraint supplier_capabilities_custom_language_tag_ck check (
    custom_language_tag is null or custom_language_tag ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$'
  ),
  constraint supplier_capabilities_custom_normalized_value_ck check (
    custom_normalized_value is null
    or (octet_length(custom_normalized_value) between 1 and 300 and custom_normalized_value = btrim(custom_normalized_value) and custom_normalized_value <> 'import_only')
  ),
  constraint supplier_capabilities_normalizer_version_ck check (
    normalizer_version is null or normalizer_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_capabilities_semantic_shape_ck check (
    (
      capability_kind in ('operational', 'service', 'documentary', 'experience')
      and capability_code is not null
      and custom_label_original is null
      and custom_display_label is null
      and custom_language_tag is null
      and custom_normalized_value is null
    )
    or (
      capability_kind = 'custom'
      and capability_code is null
      and custom_label_original is not null
      and custom_display_label is not null
      and custom_normalized_value is not null
      and normalizer_version is not null
    )
  ),
  constraint supplier_capabilities_position_ck check (
    position >= 0
  ),
  constraint supplier_capabilities_record_status_ck check (
    record_status in ('draft', 'active', 'superseded', 'archived')
  ),
  constraint supplier_capabilities_source_type_ck check (
    source_type in ('legacy_migration', 'import_submission', 'supplier_proposal', 'manual_curation')
  ),
  constraint supplier_capabilities_source_namespace_ck check (
    source_namespace ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_capabilities_evidence_reference_ck check (
    evidence_reference is null
    or (octet_length(btrim(evidence_reference)) between 1 and 512 and evidence_reference = btrim(evidence_reference))
  ),
  constraint supplier_capabilities_mapping_version_ck check (
    mapping_version is null or mapping_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_capabilities_confidence_level_ck check (
    confidence_level is null or confidence_level in ('high', 'medium', 'low')
  ),
  constraint supplier_capabilities_review_provenance_ck check (
    (reviewed_by_user_profile_id is null) = (reviewed_at is null)
  ),
  constraint supplier_capabilities_transformation_versions_ck check (
    (
      source_type in ('legacy_migration', 'import_submission')
      and mapping_version is not null
      and normalizer_version is not null
    )
    or (
      source_type in ('supplier_proposal', 'manual_curation')
      and mapping_version is null
      and (
        (capability_kind = 'custom' and normalizer_version is not null)
        or (capability_kind <> 'custom' and normalizer_version is null)
      )
    )
  ),
  constraint supplier_capabilities_lifecycle_shape_ck check (
    (
      record_status = 'draft'
      and valid_from is null
      and valid_until is null
    )
    or (
      record_status = 'active'
      and reviewed_by_user_profile_id is not null
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
  constraint supplier_capabilities_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_capabilities_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_capabilities_category_fk foreign key (category_id)
    references public.categories (id) on delete restrict,
  constraint supplier_capabilities_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_capabilities_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_capabilities_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.supplier_capabilities is
  'Trusted-only empty local reviewed Supplier capability assertions. Capabilities are indicative profile claims, not contractual guarantees. This table has no rows, vocabulary, mapping execution, payment options, trusted mutation routine, RLS, API/browser grant, Auth bridge, directory projection, search behavior, or client integration.';
comment on column public.supplier_capabilities.id is
  'Database-generated UUIDv4 capability identity. Deterministic source child identity belongs to the later approved migration-control and transformation boundary.';
comment on column public.supplier_capabilities.supplier_profile_id is
  'Required restrictive Supplier aggregate root. A capability establishes no ownership, verification, listing approval, RFQ eligibility, service coverage, or authorization.';
comment on column public.supplier_capabilities.category_id is
  'Optional restrictive canonical category scope. Null means Supplier-global; no category is inferred from adjacent legacy arrays or presentation position.';
comment on column public.supplier_capabilities.capability_kind is
  'Controlled semantic kind or custom. imports_outside_iraq is operational and official_invoice is documentary; import_only is excluded pending a separate decision.';
comment on column public.supplier_capabilities.capability_code is
  'Controlled stable code only. No candidate vocabulary row or code mapping is created by this empty local foundation.';
comment on column public.supplier_capabilities.custom_label_original is
  'Required bounded original custom wording without invented translation or transliteration. Custom terms require later human moderation before activation.';
comment on column public.supplier_capabilities.custom_normalized_value is
  'Required versioned comparison value for custom semantic duplicate prevention; it does not overwrite the original wording.';
comment on column public.supplier_capabilities.position is
  'Non-negative active-set presentation order only. It is not evidence, category identity, commercial priority, or a contractual ranking.';
comment on column public.supplier_capabilities.record_status is
  'Capability lifecycle: draft, active, superseded, archived. Partial indexes enforce active semantic and position conflicts; no mutation or activation authority is created here.';
comment on column public.supplier_capabilities.source_type is
  'Trusted bounded decision source: reviewed legacy migration, reviewed import/submission, Supplier proposal, or manual curation. Browser identity is never authoritative.';
comment on column public.supplier_capabilities.evidence_reference is
  'Optional bounded internal or repository reference to reviewed evidence. It must not contain a raw workbook, complete Supplier payload, secret, token, contact data, or public evidence URL.';
comment on column public.supplier_capabilities.mapping_version is
  'Required for reviewed transformed legacy/import candidates and absent for Supplier proposals or manual curation.';
comment on column public.supplier_capabilities.normalizer_version is
  'Required for custom semantic comparison and reviewed transformed source decisions; controlled manual curation and Supplier proposals do not fabricate a normalizer version.';
comment on column public.supplier_capabilities.reviewed_by_user_profile_id is
  'Reviewer provenance required before activation. A later trusted mutation path owns reviewer authority; this no-trigger slice creates no authorization behavior.';
comment on column public.supplier_capabilities.valid_from is
  'Activation date. Active and closed reviewed capabilities require it; a directly archived draft has no effective interval.';
comment on column public.supplier_capabilities.valid_until is
  'Exclusive terminal date for a reviewed active-history closure. It is later than valid_from and absent while active.';
comment on column public.supplier_capabilities.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';
comment on column public.supplier_capabilities.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';

create unique index supplier_capabilities_active_controlled_semantic_uidx
  on public.supplier_capabilities (supplier_profile_id, (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)), capability_kind, capability_code)
  where record_status = 'active'
    and capability_kind <> 'custom';

create unique index supplier_capabilities_active_custom_semantic_uidx
  on public.supplier_capabilities (supplier_profile_id, (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)), normalizer_version, custom_normalized_value)
  where record_status = 'active'
    and capability_kind = 'custom';

create unique index supplier_capabilities_active_position_uidx
  on public.supplier_capabilities (supplier_profile_id, position)
  where record_status = 'active';

create index supplier_capabilities_supplier_status_kind_position_idx
  on public.supplier_capabilities (supplier_profile_id, record_status, capability_kind, position, id);

create index supplier_capabilities_category_status_supplier_idx
  on public.supplier_capabilities (category_id, record_status, supplier_profile_id, id);

revoke all on table public.supplier_capabilities from public, anon, authenticated, service_role;
