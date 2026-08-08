-- Eleventh local SQL slice: empty restricted Supplier ownership foundation only.
-- This migration creates no ownership data, Claim aggregate, transfer workflow, RLS,
-- API access, trusted mutation routine, mapping execution, or Firebase integration.

create extension if not exists btree_gist with schema extensions;

create table public.supplier_ownerships (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  supplier_profile_id uuid not null,
  controller_user_profile_id uuid not null,
  authority_type text not null default 'primary_controller',
  ownership_status text not null default 'active',
  valid_from timestamptz not null default pg_catalog.statement_timestamp(),
  valid_until timestamptz,
  record_version integer not null default 1,
  establishment_source_type text not null,
  establishment_reason_code text not null,
  established_by_user_profile_id uuid,
  establishment_system_source text,
  established_at timestamptz not null default pg_catalog.statement_timestamp(),
  closure_reason_code text,
  closed_by_user_profile_id uuid,
  closure_system_source text,
  closed_at timestamptz,
  transfer_successor_ownership_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_ownerships_authority_type_ck check (
    authority_type = 'primary_controller'
  ),
  constraint supplier_ownerships_ownership_status_ck check (
    ownership_status in ('active', 'transferred', 'revoked', 'superseded')
  ),
  constraint supplier_ownerships_validity_interval_ck check (
    valid_until is null or valid_until > valid_from
  ),
  constraint supplier_ownerships_record_version_ck check (
    record_version >= 1
  ),
  constraint supplier_ownerships_establishment_source_type_ck check (
    establishment_source_type in (
      'claim_approval', 'submission_approval', 'ownership_transfer', 'legacy_reconciliation'
    )
  ),
  constraint supplier_ownerships_establishment_reason_code_ck check (
    establishment_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_ownerships_establishment_system_source_ck check (
    establishment_system_source is null
    or establishment_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_ownerships_establishment_provenance_ck check (
    (established_by_user_profile_id is not null) <> (establishment_system_source is not null)
  ),
  constraint supplier_ownerships_closure_reason_code_ck check (
    closure_reason_code is null
    or closure_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_ownerships_closure_system_source_ck check (
    closure_system_source is null
    or closure_system_source ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_ownerships_lifecycle_shape_ck check (
    (
      ownership_status = 'active'
      and valid_until is null
      and closure_reason_code is null
      and closed_by_user_profile_id is null
      and closure_system_source is null
      and closed_at is null
      and transfer_successor_ownership_id is null
    )
    or (
      ownership_status = 'transferred'
      and valid_until is not null
      and closure_reason_code is not null
      and closed_at is not null
      and (closed_by_user_profile_id is not null) <> (closure_system_source is not null)
      and transfer_successor_ownership_id is not null
    )
    or (
      ownership_status in ('revoked', 'superseded')
      and valid_until is not null
      and closure_reason_code is not null
      and closed_at is not null
      and (closed_by_user_profile_id is not null) <> (closure_system_source is not null)
      and transfer_successor_ownership_id is null
    )
  ),
  constraint supplier_ownerships_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_ownerships_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_ownerships_controller_user_profile_fk foreign key (controller_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownerships_established_by_fk foreign key (established_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownerships_closed_by_fk foreign key (closed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownerships_transfer_successor_fk foreign key (transfer_successor_ownership_id)
    references public.supplier_ownerships (id) on delete restrict,
  constraint supplier_ownerships_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownerships_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_ownerships_supplier_interval_excl exclude using gist (
    supplier_profile_id with =,
    tstzrange(valid_from, coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  )
);

comment on table public.supplier_ownerships is
  'Trusted-only empty local Supplier primary-controller foundation. A row records one temporal verified human controller relationship, not organization identity, membership, Supplier verification, Claim evidence, or runtime authorization. No rows, Claim table, transfer workflow, routine, RLS, API/browser grant, mapping, or Firebase integration are created.';
comment on column public.supplier_ownerships.controller_user_profile_id is
  'Required provider-neutral accountable human controller. This restrictive foreign key is not a Firebase UID, platform role, organization, membership, Claim proof, or Supplier verification result.';
comment on column public.supplier_ownerships.authority_type is
  'First-boundary authority type is primary_controller only. Delegates and Supplier admins require a separately approved future membership model.';
comment on column public.supplier_ownerships.ownership_status is
  'Ownership lifecycle: active, transferred, revoked, superseded. superseded is only a reviewed representation correction; business changes use transferred or revoked.';
comment on column public.supplier_ownerships.establishment_source_type is
  'Bounded source class only. This empty foundation intentionally has no generic source ID and no Claim, submission, event, or audit foreign key before those target contracts exist.';
comment on column public.supplier_ownerships.established_by_user_profile_id is
  'Nullable establishing-actor provenance only. This foreign key grants no reviewer, platform-role, Supplier, Claim, or authorization authority.';
comment on column public.supplier_ownerships.closure_reason_code is
  'Write-once terminal provenance boundary for a future trusted command. The empty foundation implements no transfer, revocation, dispute, or restoration workflow.';
comment on column public.supplier_ownerships.transfer_successor_ownership_id is
  'Nullable restrictive successor reference reserved for a future atomic transfer. It is required only for transferred rows and creates no transfer command or automatic access inheritance.';

create unique index supplier_ownerships_one_active_primary_controller_uidx
  on public.supplier_ownerships (supplier_profile_id)
  where authority_type = 'primary_controller' and ownership_status = 'active';

create index supplier_ownerships_supplier_status_valid_from_idx
  on public.supplier_ownerships (supplier_profile_id, ownership_status, valid_from desc, id);

create index supplier_ownerships_controller_status_valid_from_idx
  on public.supplier_ownerships (controller_user_profile_id, ownership_status, valid_from desc, id);

revoke all on table public.supplier_ownerships from public, anon, authenticated, service_role;
