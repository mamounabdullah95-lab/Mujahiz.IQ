-- Second local SQL slice: provider-neutral application identities only.
-- This migration does not select an authentication authority or add an Auth bridge.

create table public.user_profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  legacy_firestore_id text,
  full_name text not null,
  account_status text not null default 'active',
  account_context text not null,
  preferred_locale text not null default 'ar',
  normalized_email text,
  display_email text,
  phone_number text,
  job_title text,
  city text,
  legacy_account_type text,
  legacy_role text,
  legacy_organization text,
  legacy_sector text,
  verification_mirror_status text not null default 'unknown',
  verification_mirror_observed_at timestamptz,
  security_eligibility_reference text,
  suspended_at timestamptz,
  suspended_by_user_profile_id uuid,
  suspension_reason text,
  deactivated_at timestamptz,
  deactivated_by_user_profile_id uuid,
  deactivation_reason text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint user_profiles_legacy_firestore_id_ck check (
    legacy_firestore_id is null
    or octet_length(legacy_firestore_id) between 1 and 512
  ),
  constraint user_profiles_full_name_ck check (
    octet_length(full_name) between 1 and 200
  ),
  constraint user_profiles_account_status_ck check (
    account_status in ('active', 'suspended', 'deactivated')
  ),
  constraint user_profiles_account_context_ck check (
    account_context in ('buyer', 'supplier', 'unknown')
  ),
  constraint user_profiles_preferred_locale_ck check (
    preferred_locale in ('ar', 'en')
  ),
  constraint user_profiles_normalized_email_ck check (
    normalized_email is null
    or (
      octet_length(normalized_email) between 3 and 320
      and normalized_email = lower(normalized_email)
    )
  ),
  constraint user_profiles_display_email_ck check (
    display_email is null or octet_length(display_email) between 3 and 320
  ),
  constraint user_profiles_phone_number_ck check (
    phone_number is null or octet_length(phone_number) between 1 and 64
  ),
  constraint user_profiles_job_title_ck check (
    job_title is null or octet_length(job_title) between 1 and 200
  ),
  constraint user_profiles_city_ck check (
    city is null or octet_length(city) between 1 and 200
  ),
  constraint user_profiles_legacy_account_type_ck check (
    legacy_account_type is null or octet_length(legacy_account_type) between 1 and 64
  ),
  constraint user_profiles_legacy_role_ck check (
    legacy_role is null or octet_length(legacy_role) between 1 and 64
  ),
  constraint user_profiles_legacy_organization_ck check (
    legacy_organization is null or octet_length(legacy_organization) between 1 and 200
  ),
  constraint user_profiles_legacy_sector_ck check (
    legacy_sector is null or octet_length(legacy_sector) between 1 and 200
  ),
  constraint user_profiles_verification_mirror_status_ck check (
    verification_mirror_status in ('unknown', 'unverified', 'verified')
  ),
  constraint user_profiles_verification_mirror_observed_at_ck check (
    (verification_mirror_status = 'unknown') = (verification_mirror_observed_at is null)
  ),
  constraint user_profiles_security_eligibility_reference_ck check (
    security_eligibility_reference is null
    or octet_length(security_eligibility_reference) between 1 and 256
  ),
  constraint user_profiles_suspension_state_ck check (
    (account_status = 'suspended') = (suspended_at is not null)
    and (account_status = 'suspended') = (suspension_reason is not null)
  ),
  constraint user_profiles_suspension_reason_ck check (
    suspension_reason is null or octet_length(suspension_reason) between 1 and 1000
  ),
  constraint user_profiles_deactivation_state_ck check (
    (account_status = 'deactivated') = (deactivated_at is not null)
    and (account_status = 'deactivated') = (deactivation_reason is not null)
  ),
  constraint user_profiles_deactivation_reason_ck check (
    deactivation_reason is null or octet_length(deactivation_reason) between 1 and 1000
  ),
  constraint user_profiles_timestamp_order_ck check (
    updated_at >= created_at
    and (verification_mirror_observed_at is null or verification_mirror_observed_at >= created_at)
    and (suspended_at is null or suspended_at >= created_at)
    and (deactivated_at is null or deactivated_at >= created_at)
  ),
  constraint user_profiles_suspended_by_fk foreign key (suspended_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint user_profiles_deactivated_by_fk foreign key (deactivated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint user_profiles_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint user_profiles_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.user_profiles is
  'Trusted-only provider-neutral application profiles. This local table has no Auth authority, browser grant, policy, or client integration.';
comment on column public.user_profiles.id is
  'Database-generated application profile identity. It is deliberately independent of every authentication provider subject.';
comment on column public.user_profiles.legacy_firestore_id is
  'Bounded alternate key for a migrated users/{uid} document. It is never the relational primary key or an authorization relationship.';
comment on column public.user_profiles.account_context is
  'Trusted current Buyer/Supplier business context, not a platform role, organization membership, or PostgreSQL role.';
comment on column public.user_profiles.verification_mirror_status is
  'Trusted provider-state mirror only. Firebase Auth remains authoritative during the approved hybrid phase.';
comment on column public.user_profiles.security_eligibility_reference is
  'Bounded trusted reference only; this slice creates no audit or security-event relation.';

create unique index user_profiles_legacy_firestore_id_uidx
  on public.user_profiles (legacy_firestore_id)
  where legacy_firestore_id is not null;

create index user_profiles_status_context_created_idx
  on public.user_profiles (account_status, account_context, created_at, id);

create table internal.identity_provider_links (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_profile_id uuid not null,
  migration_batch_id uuid,
  provider_code text not null,
  provider_subject text not null,
  is_primary boolean not null default true,
  link_status text not null default 'linked',
  identity_status text not null default 'unknown',
  verification_status text not null default 'unknown',
  provider_state_observed_at timestamptz not null,
  provider_state_version text,
  provider_state_evidence_reference text,
  email_at_link text,
  linked_at timestamptz not null default pg_catalog.statement_timestamp(),
  linked_by_user_profile_id uuid,
  verified_at timestamptz,
  verification_observed_by_user_profile_id uuid,
  disabled_at timestamptz,
  disabled_by_user_profile_id uuid,
  unlinked_at timestamptz,
  unlinked_by_user_profile_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint identity_provider_links_provider_code_ck check (
    provider_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint identity_provider_links_provider_subject_ck check (
    octet_length(provider_subject) between 1 and 255
  ),
  constraint identity_provider_links_link_status_ck check (
    link_status in ('linked', 'unlinked')
  ),
  constraint identity_provider_links_identity_status_ck check (
    identity_status in ('unknown', 'active', 'disabled')
  ),
  constraint identity_provider_links_verification_status_ck check (
    verification_status in ('unknown', 'unverified', 'verified')
  ),
  constraint identity_provider_links_provider_state_version_ck check (
    provider_state_version is null or octet_length(provider_state_version) between 1 and 128
  ),
  constraint identity_provider_links_provider_state_evidence_reference_ck check (
    provider_state_evidence_reference is null
    or octet_length(provider_state_evidence_reference) between 1 and 256
  ),
  constraint identity_provider_links_email_at_link_ck check (
    email_at_link is null or octet_length(email_at_link) between 3 and 320
  ),
  constraint identity_provider_links_unlink_state_ck check (
    (link_status = 'unlinked') = (unlinked_at is not null)
    and (link_status = 'linked' or not is_primary)
  ),
  constraint identity_provider_links_disabled_state_ck check (
    (identity_status = 'disabled') = (disabled_at is not null)
    and (identity_status = 'disabled' or disabled_by_user_profile_id is null)
  ),
  constraint identity_provider_links_verification_state_ck check (
    (verification_status = 'verified') = (verified_at is not null)
    and (
      verification_status <> 'verified'
      or (
        link_status = 'linked'
        and identity_status = 'active'
      )
    )
  ),
  constraint identity_provider_links_timestamp_order_ck check (
    provider_state_observed_at >= linked_at
    and created_at >= linked_at
    and (verified_at is null or verified_at >= linked_at)
    and (disabled_at is null or disabled_at >= linked_at)
    and (unlinked_at is null or unlinked_at >= linked_at)
  ),
  constraint identity_provider_links_user_profile_fk foreign key (user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint identity_provider_links_migration_batch_fk foreign key (migration_batch_id)
    references internal.migration_batches (id) on delete restrict,
  constraint identity_provider_links_linked_by_fk foreign key (linked_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint identity_provider_links_verification_observed_by_fk foreign key (verification_observed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint identity_provider_links_disabled_by_fk foreign key (disabled_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint identity_provider_links_unlinked_by_fk foreign key (unlinked_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table internal.identity_provider_links is
  'Trusted-only provider subject mappings and provider-state mirrors. Firebase UID is stored as provider_code=firebase plus provider_subject; no token, claim payload, credential, or Auth authority is stored.';
comment on column internal.identity_provider_links.provider_subject is
  'Immutable bounded provider subject, such as a Firebase UID. It is text, not a PostgreSQL UUID, and is never linked or merged by email.';
comment on column internal.identity_provider_links.provider_state_evidence_reference is
  'Bounded non-secret trusted evidence reference. Full provider records, token payloads, and credentials are prohibited.';
comment on column internal.identity_provider_links.verification_status is
  'Trusted provider-state mirror only. It cannot select or supersede Firebase Auth as verification authority.';

create unique index identity_provider_links_active_provider_subject_uidx
  on internal.identity_provider_links (provider_code, provider_subject)
  where link_status = 'linked';

create unique index identity_provider_links_active_primary_uidx
  on internal.identity_provider_links (user_profile_id, provider_code)
  where link_status = 'linked' and is_primary;

create index identity_provider_links_user_provider_link_idx
  on internal.identity_provider_links (user_profile_id, provider_code, link_status);

create index identity_provider_links_user_identity_verification_idx
  on internal.identity_provider_links (user_profile_id, identity_status, verification_status);

revoke all on table public.user_profiles from public, anon, authenticated, service_role;
revoke all on table internal.identity_provider_links from public, anon, authenticated, service_role;
