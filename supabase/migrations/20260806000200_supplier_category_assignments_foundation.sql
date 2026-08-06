-- Seventh local SQL slice: empty reviewed Supplier/category classification foundation only.
-- This migration creates no category aliases, taxonomy or assignment data, mapping execution, RLS, API access, or mutation routine.

create table public.supplier_category_assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  supplier_profile_id uuid not null,
  category_id uuid not null,
  assignment_role text not null,
  position integer not null default 0,
  record_status text not null default 'draft',
  source_type text not null,
  source_namespace text not null,
  evidence_reference text,
  mapping_version text,
  normalizer_version text,
  confidence_level text,
  reviewed_by_user_profile_id uuid,
  reviewed_at timestamptz,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_category_assignments_assignment_role_ck check (
    assignment_role in ('primary', 'secondary')
  ),
  constraint supplier_category_assignments_position_ck check (
    position >= 0
  ),
  constraint supplier_category_assignments_record_status_ck check (
    record_status in ('draft', 'active', 'superseded', 'archived')
  ),
  constraint supplier_category_assignments_source_type_ck check (
    source_type in ('legacy_migration', 'import_submission', 'manual_curation')
  ),
  constraint supplier_category_assignments_source_namespace_ck check (
    source_namespace ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_category_assignments_evidence_reference_ck check (
    evidence_reference is null
    or (octet_length(btrim(evidence_reference)) between 1 and 512 and evidence_reference = btrim(evidence_reference))
  ),
  constraint supplier_category_assignments_mapping_version_ck check (
    mapping_version is null or mapping_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_category_assignments_normalizer_version_ck check (
    normalizer_version is null or normalizer_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_category_assignments_transformation_versions_ck check (
    (
      source_type = 'manual_curation'
      and mapping_version is null
      and normalizer_version is null
    )
    or (
      source_type in ('legacy_migration', 'import_submission')
      and mapping_version is not null
      and normalizer_version is not null
    )
  ),
  constraint supplier_category_assignments_confidence_level_ck check (
    confidence_level is null or confidence_level in ('high', 'medium', 'low')
  ),
  constraint supplier_category_assignments_review_provenance_ck check (
    (reviewed_by_user_profile_id is null) = (reviewed_at is null)
  ),
  constraint supplier_category_assignments_lifecycle_shape_ck check (
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
  constraint supplier_category_assignments_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_category_assignments_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_category_assignments_category_fk foreign key (category_id)
    references public.categories (id) on delete restrict,
  constraint supplier_category_assignments_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_category_assignments_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_category_assignments_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.supplier_category_assignments is
  'Trusted-only empty local reviewed Supplier-offering classifications. This table has no rows, aliases, mapping execution, trusted mutation routine, RLS, API/browser grant, Auth bridge, directory projection, search behavior, or client integration.';
comment on column public.supplier_category_assignments.id is
  'Database-generated UUIDv4 assignment identity. Deterministic source child identity belongs to the later approved migration-control and transformation boundary.';
comment on column public.supplier_category_assignments.supplier_profile_id is
  'Required restrictive Supplier aggregate root. An assignment establishes no ownership, verification, listing approval, RFQ eligibility, service coverage, or authorization.';
comment on column public.supplier_category_assignments.category_id is
  'Required restrictive canonical category identity only. It deliberately does not encode category lifecycle or assignability, preserving resolvable historical assignments.';
comment on column public.supplier_category_assignments.assignment_role is
  'Authoritative classification role: primary or secondary. Position never infers or changes primary status, including from legacy array order.';
comment on column public.supplier_category_assignments.position is
  'Non-negative active-set presentation order only. It is not confidence, category identity, or a primary-selection signal.';
comment on column public.supplier_category_assignments.record_status is
  'Assignment lifecycle: draft, active, superseded, archived. Partial indexes enforce active conflicts; the later trusted mutation enforces exactly one reviewed primary whenever its post-commit active set is non-empty.';
comment on column public.supplier_category_assignments.source_type is
  'Trusted bounded decision source: reviewed legacy migration, reviewed import/submission, or manual curation. An untraceable generic system source is prohibited.';
comment on column public.supplier_category_assignments.source_namespace is
  'Stable bounded source-contract namespace, not a user identity, credential, full source payload, or browser-supplied authority.';
comment on column public.supplier_category_assignments.evidence_reference is
  'Optional bounded internal or repository reference to reviewed evidence. It must not contain a URL token, raw workbook, complete Supplier payload, or personal data.';
comment on column public.supplier_category_assignments.mapping_version is
  'Required with normalizer version for reviewed transformed source decisions and absent for trusted manual curation.';
comment on column public.supplier_category_assignments.normalizer_version is
  'Required with mapping version for reviewed transformed source decisions and absent for trusted manual curation.';
comment on column public.supplier_category_assignments.confidence_level is
  'Optional trusted bounded evidence only. Confidence never substitutes for completed review or resolves ambiguity.';
comment on column public.supplier_category_assignments.reviewed_by_user_profile_id is
  'Reviewer provenance required before activation. The later trusted mutation path owns reviewer authority; this no-trigger slice creates no authorization behavior.';
comment on column public.supplier_category_assignments.valid_from is
  'Activation date. Active and closed reviewed assignments require it; a directly archived draft has no effective interval.';
comment on column public.supplier_category_assignments.valid_until is
  'Exclusive terminal date for a reviewed active-history closure. It is later than valid_from and is absent while active.';
comment on column public.supplier_category_assignments.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';
comment on column public.supplier_category_assignments.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';

create unique index supplier_category_assignments_active_supplier_category_uidx
  on public.supplier_category_assignments (supplier_profile_id, category_id)
  where record_status = 'active';

create unique index supplier_category_assignments_active_primary_uidx
  on public.supplier_category_assignments (supplier_profile_id)
  where record_status = 'active'
    and assignment_role = 'primary';

create unique index supplier_category_assignments_active_position_uidx
  on public.supplier_category_assignments (supplier_profile_id, position)
  where record_status = 'active';

create index supplier_category_assignments_supplier_status_role_position_idx
  on public.supplier_category_assignments (supplier_profile_id, record_status, assignment_role, position, id);

create index supplier_category_assignments_category_status_supplier_idx
  on public.supplier_category_assignments (category_id, record_status, supplier_profile_id, id);

revoke all on table public.supplier_category_assignments from public, anon, authenticated, service_role;
