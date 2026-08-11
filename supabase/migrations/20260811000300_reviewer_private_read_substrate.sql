-- Twenty-fifth tracked local SQL migration: Reviewer private-read substrate.
-- This migration adds read-only Owner/reviewer projections, their exact RLS
-- audiences, and one private candidate eligibility core. It creates no Claim
-- mutation, assignment write, authority row, hosted capability, or data move.

do $role$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'mujahiz_claim_owner_projection'
  ) then
    create role mujahiz_claim_owner_projection
      nologin noinherit nosuperuser nocreatedb nocreaterole
      noreplication nobypassrls;
  elsif exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'mujahiz_claim_owner_projection'
      and (
        rolcanlogin or rolinherit or rolsuper or rolcreatedb
        or rolcreaterole or rolreplication or rolbypassrls
      )
  ) then
    raise exception 'Existing mujahiz_claim_owner_projection role has unsafe attributes';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'mujahiz_claim_reviewer_projection'
  ) then
    create role mujahiz_claim_reviewer_projection
      nologin noinherit nosuperuser nocreatedb nocreaterole
      noreplication nobypassrls;
  elsif exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'mujahiz_claim_reviewer_projection'
      and (
        rolcanlogin or rolinherit or rolsuper or rolcreatedb
        or rolcreaterole or rolreplication or rolbypassrls
      )
  ) then
    raise exception 'Existing mujahiz_claim_reviewer_projection role has unsafe attributes';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members
    where (
      roleid in (
        'mujahiz_claim_owner_projection'::regrole,
        'mujahiz_claim_reviewer_projection'::regrole
      )
      or member in (
        'mujahiz_claim_owner_projection'::regrole,
        'mujahiz_claim_reviewer_projection'::regrole
      )
    )
      and not (
        roleid in (
          'mujahiz_claim_owner_projection'::regrole,
          'mujahiz_claim_reviewer_projection'::regrole
        )
        and member = 'postgres'::regrole
        and admin_option
        and not inherit_option
        and not set_option
      )
  ) then
    raise exception 'Reviewer projection roles have unexpected memberships';
  end if;
end
$role$;

comment on role mujahiz_claim_owner_projection is
  'NOLOGIN, NOINHERIT, non-owner, non-BYPASSRLS implementation principal for the Claim-v1 Owner assignment queue and claim-scoped reviewer candidates. It is not an application user or platform role.';
comment on role mujahiz_claim_reviewer_projection is
  'NOLOGIN, NOINHERIT, non-owner, non-BYPASSRLS implementation principal for exact assigned-reviewer Claim-v1 queue/detail reads. It is not an application user or platform role.';

create schema if not exists claim_api;

comment on schema claim_api is
  'Fixed typed server-mediated Claim-v1 projections only. It is not a base-table browser, generic Data API surface, or mutation boundary.';

revoke all on schema claim_api
  from public, anon, authenticated, service_role,
       mujahiz_claim_runtime,
       mujahiz_claim_owner_projection,
       mujahiz_claim_reviewer_projection;
grant usage on schema claim_api
  to mujahiz_claim_runtime,
     mujahiz_claim_owner_projection,
     mujahiz_claim_reviewer_projection;

revoke create on schema public, internal, claim_security, claim_api
  from mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
grant usage on schema public, claim_security
  to mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
grant usage on schema internal to mujahiz_claim_owner_projection;

-- PostgreSQL 17 requires the migration actor to be able to SET ROLE to a
-- prospective function owner and that owner to have CREATE on the containing
-- schema. These capabilities are removed after ownership is assigned.
grant create on schema claim_security, claim_api
  to mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
grant mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection
  to postgres with inherit false, set true;

-- The Owner projection principal owns the private arbitrary-profile evaluator.
-- These are the evaluator's exact relational source columns; it receives no
-- provider subject, email, phone, evidence/reason, or mutation privilege.
revoke all on table
  public.user_profiles,
  internal.identity_provider_links,
  public.platform_role_assignments,
  public.access_grants,
  internal.security_eligibility_assessments
from mujahiz_claim_owner_projection;

grant select (
  id, full_name, account_status, account_context,
  verification_mirror_status
) on table public.user_profiles
  to mujahiz_claim_owner_projection;

grant select (
  id, user_profile_id, provider_code, is_primary, link_status,
  identity_status, verification_status, provider_state_version
) on table internal.identity_provider_links
  to mujahiz_claim_owner_projection;

grant select (
  id, user_profile_id, role_code, assignment_status, valid_from,
  valid_until, authorization_policy_version
) on table public.platform_role_assignments
  to mujahiz_claim_owner_projection;

grant select (
  id, user_profile_id, platform_role_assignment_id, role_code,
  access_purpose, access_status, valid_from, valid_until,
  authorization_policy_version
) on table public.access_grants
  to mujahiz_claim_owner_projection;

grant select (
  id, user_profile_id, assessment_scope, assessment_result,
  condition_type, valid_from, valid_until, assessment_status,
  security_policy_version, required_coverage_version,
  evidence_minimization_version
) on table internal.security_eligibility_assessments
  to mujahiz_claim_owner_projection;

create function claim_security.privileged_actor_for_profile_v1(
  p_user_profile_id uuid
)
returns table (
  decision text,
  role_code text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
  profile_account_status text;
  profile_account_context text;
  profile_verification_status text;
  provider_id uuid;
  provider_link_status text;
  provider_is_primary boolean;
  provider_identity_status text;
  provider_verification_status text;
  provider_state_version text;
  role_assignment_id uuid;
  role_assignment_status text;
  role_assignment_code text;
  role_policy_version text;
  access_id uuid;
  access_status text;
  access_role_assignment_id uuid;
  access_role_code text;
  access_policy_version text;
  security_id uuid;
  security_status text;
  security_result text;
  security_condition text;
  security_policy_version text;
  security_coverage_version text;
  security_minimization_version text;
  matching_count bigint;
  total_count bigint;
  unsupported_count bigint;
  resolved_role_assignment_id uuid;
  resolved_role_code text;
  has_unknown boolean := false;
  has_denied boolean := false;
begin
  if p_user_profile_id is null then
    return query select 'unknown'::text, null::text;
    return;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.user_profiles as profile
  where profile.id = p_user_profile_id;

  if matching_count <> 1 then
    has_unknown := true;
  else
    select
      profile.account_status,
      profile.account_context,
      profile.verification_mirror_status
    into
      profile_account_status,
      profile_account_context,
      profile_verification_status
    from public.user_profiles as profile
    where profile.id = p_user_profile_id;

    if profile_account_status <> 'active'
       or profile_account_context <> 'buyer'
       or profile_verification_status = 'unverified'
    then
      has_denied := true;
    end if;

    if profile_verification_status = 'unknown' then
      has_unknown := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from internal.identity_provider_links as provider_link
  where provider_link.user_profile_id = p_user_profile_id
    and provider_link.provider_code = 'firebase'
    and provider_link.link_status = 'linked';

  if matching_count > 1 then
    has_unknown := true;
  elsif matching_count = 1 then
    select
      provider_link.id,
      provider_link.link_status,
      provider_link.is_primary,
      provider_link.identity_status,
      provider_link.verification_status,
      provider_link.provider_state_version
    into
      provider_id,
      provider_link_status,
      provider_is_primary,
      provider_identity_status,
      provider_verification_status,
      provider_state_version
    from internal.identity_provider_links as provider_link
    where provider_link.user_profile_id = p_user_profile_id
      and provider_link.provider_code = 'firebase'
      and provider_link.link_status = 'linked';
  else
    select pg_catalog.count(*)
    into total_count
    from internal.identity_provider_links as provider_link
    where provider_link.user_profile_id = p_user_profile_id
      and provider_link.provider_code = 'firebase';

    if total_count <> 1 then
      has_unknown := true;
    else
      select
        provider_link.id,
        provider_link.link_status,
        provider_link.is_primary,
        provider_link.identity_status,
        provider_link.verification_status,
        provider_link.provider_state_version
      into
        provider_id,
        provider_link_status,
        provider_is_primary,
        provider_identity_status,
        provider_verification_status,
        provider_state_version
      from internal.identity_provider_links as provider_link
      where provider_link.user_profile_id = p_user_profile_id
        and provider_link.provider_code = 'firebase';
    end if;
  end if;

  if provider_id is not null then
    if provider_state_version is distinct from 'firebase-provider-state-v1' then
      has_unknown := true;
    end if;

    if provider_link_status = 'unlinked'
       or provider_identity_status = 'disabled'
       or provider_verification_status = 'unverified'
    then
      has_denied := true;
    end if;

    if (provider_link_status = 'linked' and not provider_is_primary)
       or provider_identity_status = 'unknown'
       or provider_verification_status = 'unknown'
    then
      has_unknown := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.platform_role_assignments as role_assignment
  where role_assignment.user_profile_id = p_user_profile_id
    and role_assignment.valid_from <= trusted_now
    and (
      role_assignment.valid_until is null
      or trusted_now < role_assignment.valid_until
    );

  if matching_count > 1 then
    has_unknown := true;
  elsif matching_count = 1 then
    select
      role_assignment.id,
      role_assignment.assignment_status,
      role_assignment.role_code,
      role_assignment.authorization_policy_version
    into
      role_assignment_id,
      role_assignment_status,
      role_assignment_code,
      role_policy_version
    from public.platform_role_assignments as role_assignment
    where role_assignment.user_profile_id = p_user_profile_id
      and role_assignment.valid_from <= trusted_now
      and (
        role_assignment.valid_until is null
        or trusted_now < role_assignment.valid_until
      );

    if role_policy_version is distinct from 'platform-role-policy-v1' then
      has_unknown := true;
    elsif role_assignment_status = 'active'
          and role_assignment_code in ('owner', 'admin')
    then
      resolved_role_assignment_id := role_assignment_id;
      resolved_role_code := role_assignment_code;
    else
      has_denied := true;
    end if;
  else
    select
      pg_catalog.count(*),
      pg_catalog.count(*) filter (
        where role_assignment.authorization_policy_version
          is distinct from 'platform-role-policy-v1'
      )
    into total_count, unsupported_count
    from public.platform_role_assignments as role_assignment
    where role_assignment.user_profile_id = p_user_profile_id;

    if total_count = 0 or unsupported_count > 0 then
      has_unknown := true;
    else
      has_denied := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.access_grants as access_grant
  where access_grant.user_profile_id = p_user_profile_id
    and access_grant.access_purpose = 'platform_administration'
    and access_grant.valid_from <= trusted_now
    and (
      access_grant.valid_until is null
      or trusted_now < access_grant.valid_until
    );

  if matching_count > 1 then
    has_unknown := true;
  elsif matching_count = 1 then
    select
      access_grant.id,
      access_grant.access_status,
      access_grant.platform_role_assignment_id,
      access_grant.role_code,
      access_grant.authorization_policy_version
    into
      access_id,
      access_status,
      access_role_assignment_id,
      access_role_code,
      access_policy_version
    from public.access_grants as access_grant
    where access_grant.user_profile_id = p_user_profile_id
      and access_grant.access_purpose = 'platform_administration'
      and access_grant.valid_from <= trusted_now
      and (
        access_grant.valid_until is null
        or trusted_now < access_grant.valid_until
      );

    if access_policy_version is distinct from 'platform-access-policy-v1' then
      has_unknown := true;
    elsif access_status <> 'active' then
      has_denied := true;
    elsif resolved_role_assignment_id is not null
          and (
            access_role_assignment_id <> resolved_role_assignment_id
            or access_role_code <> resolved_role_code
          )
    then
      has_unknown := true;
    end if;
  else
    select
      pg_catalog.count(*),
      pg_catalog.count(*) filter (
        where access_grant.authorization_policy_version
          is distinct from 'platform-access-policy-v1'
      )
    into total_count, unsupported_count
    from public.access_grants as access_grant
    where access_grant.user_profile_id = p_user_profile_id
      and access_grant.access_purpose = 'platform_administration';

    if total_count = 0 or unsupported_count > 0 then
      has_unknown := true;
    else
      has_denied := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from internal.security_eligibility_assessments as security_assessment
  where security_assessment.user_profile_id = p_user_profile_id
    and security_assessment.assessment_scope = 'platform_administration'
    and security_assessment.valid_from <= trusted_now
    and (
      security_assessment.valid_until is null
      or trusted_now < security_assessment.valid_until
    );

  if matching_count <> 1 then
    has_unknown := true;
  else
    select
      security_assessment.id,
      security_assessment.assessment_status,
      security_assessment.assessment_result,
      security_assessment.condition_type,
      security_assessment.security_policy_version,
      security_assessment.required_coverage_version,
      security_assessment.evidence_minimization_version
    into
      security_id,
      security_status,
      security_result,
      security_condition,
      security_policy_version,
      security_coverage_version,
      security_minimization_version
    from internal.security_eligibility_assessments as security_assessment
    where security_assessment.user_profile_id = p_user_profile_id
      and security_assessment.assessment_scope = 'platform_administration'
      and security_assessment.valid_from <= trusted_now
      and (
        security_assessment.valid_until is null
        or trusted_now < security_assessment.valid_until
      );

    if security_policy_version is distinct from 'platform-admin-security-v1'
       or security_coverage_version is distinct from 'platform-admin-coverage-v1'
       or security_minimization_version is distinct from 'platform-admin-minimization-v1'
    then
      has_unknown := true;
    elsif security_status <> 'active' then
      has_unknown := true;
    elsif security_result = 'deny'
          and security_condition in (
            'explicit_deny', 'security_hold', 'identity_quarantine'
          )
    then
      has_denied := true;
    elsif security_result = 'unknown'
          and security_condition = 'reconciliation_required'
    then
      has_unknown := true;
    elsif not (
      security_result = 'clear'
      and security_condition = 'complete_clear'
    ) then
      has_unknown := true;
    end if;
  end if;

  if has_unknown then
    decision := 'unknown';
  elsif has_denied then
    decision := 'denied';
  elsif resolved_role_assignment_id is not null
        and access_id is not null
        and access_status = 'active'
        and access_policy_version = 'platform-access-policy-v1'
        and access_role_assignment_id = resolved_role_assignment_id
        and access_role_code = resolved_role_code
        and security_id is not null
        and security_status = 'active'
        and security_result = 'clear'
        and security_condition = 'complete_clear'
  then
    decision := 'eligible';
  else
    decision := 'unknown';
  end if;

  role_code := resolved_role_code;
  return next;
exception
  when others then
    decision := 'unknown';
    role_code := null;
    return next;
end
$function$;

comment on function claim_security.privileged_actor_for_profile_v1(uuid) is
  'Private read-only LOCAL Claim-v1 relational evaluator for one provider-neutral profile UUID. It returns only eligible|denied|unknown and a conclusive owner|admin role, authenticates no provider, and is not executable by runtime, browser, API, or service roles.';

revoke all on function claim_security.privileged_actor_for_profile_v1(uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime,
       mujahiz_claim_reviewer_projection;

alter function claim_security.privileged_actor_for_profile_v1(uuid)
  owner to mujahiz_claim_owner_projection;

-- Preserve the existing public/runtime contract while making the current
-- principal path delegate to the exact same evaluator used for candidates.
create or replace function claim_security.current_privileged_actor_v1()
returns table (
  decision text,
  role_code text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  principal_id uuid := claim_security.current_claim_user_profile_id();
begin
  if principal_id is null then
    return query select 'unknown'::text, null::text;
    return;
  end if;

  return query
  select evaluator.decision, evaluator.role_code
  from claim_security.privileged_actor_for_profile_v1(principal_id) as evaluator;
end
$function$;

revoke all on function claim_security.current_privileged_actor_v1()
  from public, anon, authenticated, service_role, mujahiz_claim_runtime,
       mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
grant execute on function claim_security.current_privileged_actor_v1()
  to mujahiz_claim_runtime,
     mujahiz_claim_owner_projection,
     mujahiz_claim_reviewer_projection;

alter function claim_security.current_privileged_actor_v1()
  owner to mujahiz_claim_owner_projection;

set role mujahiz_claim_owner_projection;
grant execute on function claim_security.current_privileged_actor_v1()
  to postgres;
reset role;

grant execute on function claim_security.current_claim_user_profile_id()
  to mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
grant execute on function
  claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
  to mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;

-- Owner queue/candidate source columns. RLS remains responsible for row
-- eligibility; these column grants are not inherited by the runtime caller.
revoke all on table public.supplier_ownership_claims
  from mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
revoke all on table public.supplier_profiles
  from mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;

-- PR #118 revoked the historical claimant-view source grants while locking down
-- conflict-helper sources. Restore exactly the original eleven safe columns so
-- the unchanged SECURITY INVOKER claimant projection remains executable.
grant select (
  id, supplier_profile_id, status, record_version, submitted_at, expires_at,
  decided_at, withdrawn_at, expired_at, superseded_at, updated_at
) on table public.supplier_ownership_claims
  to mujahiz_claim_runtime;
revoke all on table public.supplier_ownerships
  from mujahiz_claim_reviewer_projection;

grant select (
  id, claimant_user_profile_id, supplier_profile_id, status, record_version,
  submitted_at, expires_at, reviewer_user_profile_id,
  reviewer_assignment_version, reviewer_assigned_at,
  reviewer_assigned_by_user_profile_id, reviewer_assignment_source_code,
  reviewer_assignment_policy_version, decided_at, withdrawn_at, expired_at,
  superseded_at, resulting_supplier_ownership_id
) on table public.supplier_ownership_claims
  to mujahiz_claim_owner_projection;

grant select (id, display_name, name_ar, name_en)
  on table public.supplier_profiles
  to mujahiz_claim_owner_projection;

grant select (
  id, claimant_user_profile_id, supplier_profile_id, status, record_version,
  submitted_at, expires_at, submitted_reason,
  claimant_snapshot_schema_version, claimant_snapshot,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version,
  reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
  reviewer_assignment_source_code, reviewer_assignment_policy_version,
  decided_at, withdrawn_at, expired_at,
  superseded_at, prior_claim_id, resulting_supplier_ownership_id
) on table public.supplier_ownership_claims
  to mujahiz_claim_reviewer_projection;

grant select (
  id, display_name, name_ar, name_en, business_type,
  short_description, listing_status, verification_status
) on table public.supplier_profiles
  to mujahiz_claim_reviewer_projection;

grant select (
  id, supplier_profile_id, authority_type, ownership_status,
  valid_from, valid_until
) on table public.supplier_ownerships
  to mujahiz_claim_reviewer_projection;

create policy supplier_ownership_claims_owner_assignment_select
  on public.supplier_ownership_claims
  for select
  to mujahiz_claim_owner_projection
  using (
    status = 'submitted'
    and pg_catalog.clock_timestamp() < expires_at
    and reviewer_user_profile_id is null
    and reviewer_assignment_version is null
    and reviewer_assigned_at is null
    and reviewer_assigned_by_user_profile_id is null
    and reviewer_assignment_source_code is null
    and reviewer_assignment_policy_version is null
    and decided_at is null
    and withdrawn_at is null
    and expired_at is null
    and superseded_at is null
    and resulting_supplier_ownership_id is null
    and exists (
      select 1
      from claim_security.current_privileged_actor_v1() as actor
      where actor.decision = 'eligible'
        and actor.role_code = 'owner'
    )
    and claim_security.target_supplier_conflict_v1(
      claim_security.current_claim_user_profile_id(),
      supplier_profile_id,
      id
    ) = 'clear'
  );

comment on policy supplier_ownership_claims_owner_assignment_select
  on public.supplier_ownership_claims is
  'Only the dedicated Owner projection principal may see coherent, unexpired, wholly unassigned submitted rows when the current Claim principal is a relationally eligible Owner and target-Supplier conflict is clear.';

create policy supplier_ownership_claims_assigned_reviewer_select
  on public.supplier_ownership_claims
  for select
  to mujahiz_claim_reviewer_projection
  using (
    status = 'under_review'
    and pg_catalog.clock_timestamp() < expires_at
    and reviewer_user_profile_id is not null
    and reviewer_assignment_version = 1
    and reviewer_assigned_at is not null
    and reviewer_assigned_by_user_profile_id is not null
    and reviewer_assignment_source_code = 'owner_assignment'
    and reviewer_assignment_policy_version = 'claim_reviewer_assignment_v1'
    and reviewer_user_profile_id <> claimant_user_profile_id
    and reviewer_user_profile_id <> reviewer_assigned_by_user_profile_id
    and reviewer_assigned_at >= submitted_at
    and reviewer_assigned_at < expires_at
    and decided_at is null
    and withdrawn_at is null
    and expired_at is null
    and superseded_at is null
    and resulting_supplier_ownership_id is null
    and reviewer_user_profile_id =
      claim_security.current_claim_user_profile_id()
    and exists (
      select 1
      from claim_security.current_privileged_actor_v1() as actor
      where actor.decision = 'eligible'
        and actor.role_code in ('owner', 'admin')
    )
    and claim_security.target_supplier_conflict_v1(
      claim_security.current_claim_user_profile_id(),
      supplier_profile_id,
      id
    ) = 'clear'
  );

comment on policy supplier_ownership_claims_assigned_reviewer_select
  on public.supplier_ownership_claims is
  'Only the dedicated reviewer projection principal may see a coherent, unexpired, supported under-review row for the exact currently assigned relationally eligible Owner/Admin reviewer when target-Supplier conflict is clear.';

create type claim_api.reviewer_evidence_descriptor_v1 as (
  kind text,
  summary text,
  reference_hostname text,
  reference_unavailable boolean
);

comment on type claim_api.reviewer_evidence_descriptor_v1 is
  'Typed claimant-supplied Claim evidence descriptor. Raw reference URLs remain hidden; a sanitized public DNS hostname may be shown only with reference_unavailable=true.';

revoke all on type claim_api.reviewer_evidence_descriptor_v1
  from public, anon, authenticated, service_role, mujahiz_claim_runtime,
       mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
grant usage on type claim_api.reviewer_evidence_descriptor_v1
  to mujahiz_claim_runtime, mujahiz_claim_reviewer_projection;

create function claim_security.reviewer_evidence_projection_v1(
  evidence_schema_version text,
  evidence_descriptors jsonb
)
returns claim_api.reviewer_evidence_descriptor_v1[]
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  descriptor jsonb;
  descriptor_kind text;
  descriptor_summary text;
  reference_url text;
  url_tail text;
  authority text;
  hostname text;
  label text;
  seen_references text[] := array[]::text[];
  projected claim_api.reviewer_evidence_descriptor_v1[] :=
    array[]::claim_api.reviewer_evidence_descriptor_v1[];
begin
  if evidence_schema_version is distinct from 'claim_evidence_v1'
     or evidence_descriptors is null
     or pg_catalog.jsonb_typeof(evidence_descriptors) <> 'array'
     or pg_catalog.jsonb_array_length(evidence_descriptors) > 3
  then
    return null;
  end if;

  for descriptor in
    select item.value
    from pg_catalog.jsonb_array_elements(evidence_descriptors)
      with ordinality as item(value, ordinal)
    order by item.ordinal
  loop
    if pg_catalog.jsonb_typeof(descriptor) <> 'object'
       or not (descriptor ? 'kind')
       or not (descriptor ? 'summary')
       or exists (
         select 1
         from pg_catalog.jsonb_object_keys(descriptor) as item_key(key_name)
         where item_key.key_name not in ('kind', 'summary', 'reference_url')
       )
       or pg_catalog.jsonb_typeof(descriptor -> 'kind') <> 'string'
       or pg_catalog.jsonb_typeof(descriptor -> 'summary') <> 'string'
       or (
         descriptor ? 'reference_url'
         and pg_catalog.jsonb_typeof(descriptor -> 'reference_url') <> 'string'
       )
    then
      return null;
    end if;

    descriptor_kind := descriptor ->> 'kind';
    if descriptor_kind not in (
      'company_domain_email',
      'company_website',
      'commercial_registration',
      'authorization_letter',
      'other'
    ) then
      return null;
    end if;

    descriptor_summary := descriptor ->> 'summary';
    if pg_catalog.char_length(descriptor_summary) not between 20 and 1600
       or pg_catalog.octet_length(descriptor_summary) > 4000
       or pg_catalog.translate(descriptor_summary, E'\n\r\t', '') ~ '[[:cntrl:]]'
       or descriptor_summary <> pg_catalog.btrim(
         pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(descriptor_summary, E'\r\n?', E'\n', 'g'),
           E'[ \t]+',
           ' ',
           'g'
         )
       )
    then
      return null;
    end if;

    reference_url := null;
    hostname := null;
    if descriptor ? 'reference_url' then
      reference_url := descriptor ->> 'reference_url';
      if pg_catalog.char_length(reference_url) not between 1 and 500
         or pg_catalog.octet_length(reference_url) > 1000
         or reference_url <> pg_catalog.btrim(reference_url)
         or reference_url ~ '[[:space:]]'
         or pg_catalog.translate(reference_url, E'\n\r\t', '') ~ '[[:cntrl:]]'
         or pg_catalog.left(reference_url, 8) <> 'https://'
      then
        return null;
      end if;

      url_tail := pg_catalog.substr(reference_url, 9);
      authority := pg_catalog.substring(url_tail, '^([^/?#]+)');
      if authority is null
         or authority = ''
         or authority like '%@%'
         or authority like '%[%'
         or authority like '%]%'
         or authority ~ ':[0-9]+$'
         or pg_catalog.strpos(authority, ':') > 0
      then
        return null;
      end if;

      hostname := pg_catalog.lower(authority);
      if authority <> hostname
         or pg_catalog.char_length(hostname) not between 3 and 253
         or pg_catalog.strpos(hostname, '.') = 0
         or hostname like '%.%.'
         or hostname like '%.localhost'
         or hostname like '%.local'
         or hostname like '%.internal'
         or hostname like '%.lan'
         or hostname like '%.home'
         or hostname like '%.localdomain'
         or hostname like '%.invalid'
         or hostname in ('localhost', 'local', 'internal')
         or hostname ~ '^[0-9.]+$'
      then
        return null;
      end if;

      foreach label in array pg_catalog.string_to_array(hostname, '.')
      loop
        if pg_catalog.char_length(label) not between 1 and 63
           or label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
        then
          return null;
        end if;
      end loop;

      if reference_url = any(seen_references) then
        return null;
      end if;
      seen_references := pg_catalog.array_append(seen_references, reference_url);
    end if;

    projected := pg_catalog.array_append(
      projected,
      row(
        descriptor_kind,
        descriptor_summary,
        hostname,
        reference_url is not null
      )::claim_api.reviewer_evidence_descriptor_v1
    );
  end loop;

  return projected;
exception
  when others then
    return null;
end
$function$;

comment on function claim_security.reviewer_evidence_projection_v1(text, jsonb) is
  'Private fail-closed Claim-v1 evidence allowlist and typed projection. It returns no raw reference URL, arbitrary JSON, file identity, credential, or unsupported descriptor.';

revoke all on function
  claim_security.reviewer_evidence_projection_v1(text, jsonb)
from public, anon, authenticated, service_role, mujahiz_claim_runtime,
     mujahiz_claim_owner_projection;

alter function claim_security.reviewer_evidence_projection_v1(text, jsonb)
  owner to mujahiz_claim_reviewer_projection;

-- The narrow Reviewer RLS policy intentionally exposes only the current
-- under-review assignment, never a historical rejected row. Read the bounded
-- resubmission context through a private fixed-output helper instead of
-- broadening that policy or granting historical Claim browsing.
create function claim_security.reviewer_prior_claim_context_v1(
  p_prior_claim_id uuid,
  p_claimant_user_profile_id uuid,
  p_supplier_profile_id uuid
)
returns table (
  prior_claim_id uuid,
  prior_claim_status text,
  prior_claim_result_code text,
  prior_claim_decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
begin
  if p_prior_claim_id is null then
    return query
    select null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  if p_claimant_user_profile_id is null or p_supplier_profile_id is null then
    return;
  end if;

  return query
  select
    prior_claim.id,
    'rejected'::text,
    'not_approved'::text,
    prior_claim.decided_at
  from public.supplier_ownership_claims as prior_claim
  where prior_claim.id = p_prior_claim_id
    and prior_claim.claimant_user_profile_id = p_claimant_user_profile_id
    and prior_claim.supplier_profile_id = p_supplier_profile_id
    and prior_claim.status = 'rejected'
    and prior_claim.decision_reason_code in (
      'insufficient_evidence',
      'claimant_ineligible',
      'supplier_mismatch'
    )
    and prior_claim.decided_at is not null;
exception
  when others then
    return;
end
$function$;

comment on function
  claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid) is
  'Private fail-closed resubmission-context projection. It validates the submit-approved same-claimant/same-Supplier rejected prior Claim and returns only the approved safe ID, bounded status/result, and decision time.';

revoke all on function
  claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid)
from public, anon, authenticated, service_role, mujahiz_claim_runtime,
     mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;

alter function claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid)
  owner to postgres;

grant execute on function
  claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid)
to mujahiz_claim_reviewer_projection;

create function claim_api.owner_assignment_queue_v1(
  cursor_expires_at timestamptz default null,
  cursor_claim_id uuid default null,
  result_limit integer default 50
)
returns table (
  claim_id uuid,
  claim_version integer,
  supplier_profile_id uuid,
  supplier_display_name text,
  supplier_name_ar text,
  supplier_name_en text,
  submitted_at timestamptz,
  expires_at timestamptz,
  status text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
begin
  if result_limit is null
     or result_limit not between 1 and 100
     or (cursor_expires_at is null) <> (cursor_claim_id is null)
  then
    return;
  end if;

  return query
  select
    claim_row.id,
    claim_row.record_version,
    claim_row.supplier_profile_id,
    supplier.display_name,
    supplier.name_ar,
    supplier.name_en,
    claim_row.submitted_at,
    claim_row.expires_at,
    'submitted'::text
  from public.supplier_ownership_claims as claim_row
  join public.supplier_profiles as supplier
    on supplier.id = claim_row.supplier_profile_id
  where trusted_now < claim_row.expires_at
    and (
      cursor_expires_at is null
      or (claim_row.expires_at, claim_row.id) >
         (cursor_expires_at, cursor_claim_id)
    )
  order by claim_row.expires_at, claim_row.id
  limit result_limit;
end
$function$;


comment on function claim_api.owner_assignment_queue_v1(timestamptz, uuid, integer) is
  'Bounded keyset-paginated metadata-only Owner assignment queue ordered by expires_at and Claim UUID. RLS composes current eligible Owner, unassigned submitted state, trusted non-expiry, and target-Supplier conflict clear.';

create function claim_api.owner_reviewer_candidates_v1(
  p_claim_id uuid,
  cursor_reviewer_user_profile_id uuid default null,
  result_limit integer default 50
)
returns table (
  reviewer_user_profile_id uuid,
  reviewer_display_name text,
  role_code text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
  current_owner_id uuid := claim_security.current_claim_user_profile_id();
  target_claim record;
begin
  if p_claim_id is null
     or current_owner_id is null
     or result_limit is null
     or result_limit not between 1 and 100
  then
    return;
  end if;

  select
    claim_row.id,
    claim_row.claimant_user_profile_id,
    claim_row.supplier_profile_id
  into target_claim
  from public.supplier_ownership_claims as claim_row
  where claim_row.id = p_claim_id
    and trusted_now < claim_row.expires_at;

  if not found then
    return;
  end if;

  return query
  select
    candidate.id,
    candidate.full_name,
    eligibility.role_code
  from public.user_profiles as candidate
  cross join lateral
    claim_security.privileged_actor_for_profile_v1(candidate.id) as eligibility
  where candidate.id <> current_owner_id
    and candidate.id <> target_claim.claimant_user_profile_id
    and (
      cursor_reviewer_user_profile_id is null
      or candidate.id > cursor_reviewer_user_profile_id
    )
    and eligibility.decision = 'eligible'
    and eligibility.role_code in ('owner', 'admin')
    and claim_security.target_supplier_conflict_v1(
      candidate.id,
      target_claim.supplier_profile_id,
      target_claim.id
    ) = 'clear'
  order by candidate.id
  limit result_limit;
end
$function$;


comment on function claim_api.owner_reviewer_candidates_v1(uuid, uuid, integer) is
  'Bounded claim-scoped advisory candidate projection for a currently usable Owner and still coherent unassigned Claim. A future assign_reviewer command must repeat the complete candidate predicate after deterministic locks.';

create function claim_api.reviewer_queue_v1(
  cursor_expires_at timestamptz default null,
  cursor_claim_id uuid default null,
  result_limit integer default 50
)
returns table (
  claim_id uuid,
  claim_version integer,
  status text,
  supplier_profile_id uuid,
  supplier_display_name text,
  supplier_name_ar text,
  supplier_name_en text,
  supplier_business_type text,
  submitted_at timestamptz,
  expires_at timestamptz,
  reviewer_assignment_version integer,
  reviewer_assigned_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
begin
  if result_limit is null
     or result_limit not between 1 and 100
     or (cursor_expires_at is null) <> (cursor_claim_id is null)
  then
    return;
  end if;

  return query
  select
    claim_row.id,
    claim_row.record_version,
    claim_row.status,
    claim_row.supplier_profile_id,
    supplier.display_name,
    supplier.name_ar,
    supplier.name_en,
    supplier.business_type,
    claim_row.submitted_at,
    claim_row.expires_at,
    claim_row.reviewer_assignment_version,
    claim_row.reviewer_assigned_at
  from public.supplier_ownership_claims as claim_row
  join public.supplier_profiles as supplier
    on supplier.id = claim_row.supplier_profile_id
  where trusted_now < claim_row.expires_at
    and (
      cursor_expires_at is null
      or (claim_row.expires_at, claim_row.id) >
         (cursor_expires_at, cursor_claim_id)
    )
  order by claim_row.expires_at, claim_row.id
  limit result_limit;
end
$function$;


comment on function claim_api.reviewer_queue_v1(timestamptz, uuid, integer) is
  'Bounded keyset-paginated exact assigned-reviewer queue. RLS removes due, terminal, malformed, unsupported, unusable, conflicted, and cross-reviewer assignments on every request.';

create function claim_api.reviewer_detail_v1(p_claim_id uuid)
returns table (
  claim_id uuid,
  claim_version integer,
  status text,
  submitted_at timestamptz,
  expires_at timestamptz,
  reviewer_assignment_version integer,
  reviewer_assigned_at timestamptz,
  submitted_reason text,
  evidence_schema_version text,
  evidence_descriptors claim_api.reviewer_evidence_descriptor_v1[],
  claimant_display_name text,
  claimant_organization_label text,
  claimant_job_title text,
  supplier_profile_id uuid,
  supplier_display_name text,
  supplier_name_ar text,
  supplier_name_en text,
  supplier_business_type text,
  supplier_short_description text,
  supplier_listing_status text,
  supplier_verification_status text,
  supplier_review_eligibility_code text,
  prior_claim_id uuid,
  prior_claim_status text,
  prior_claim_result_code text,
  prior_claim_decided_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_claim_id is null then
    return;
  end if;

  return query
  select
    claim_row.id,
    claim_row.record_version,
    claim_row.status,
    claim_row.submitted_at,
    claim_row.expires_at,
    claim_row.reviewer_assignment_version,
    claim_row.reviewer_assigned_at,
    claim_row.submitted_reason,
    claim_row.evidence_schema_version,
    evidence.projected,
    claim_row.claimant_snapshot ->> 'full_name',
    claim_row.claimant_snapshot ->> 'organization',
    claim_row.claimant_snapshot ->> 'job_title',
    claim_row.supplier_profile_id,
    supplier.display_name,
    supplier.name_ar,
    supplier.name_en,
    supplier.business_type,
    supplier.short_description,
    supplier.listing_status,
    supplier.verification_status,
    case
      when exists (
        select 1
        from public.supplier_ownerships as ownership
        where ownership.supplier_profile_id = claim_row.supplier_profile_id
          and ownership.authority_type = 'primary_controller'
          and ownership.ownership_status = 'active'
          and ownership.valid_from <= trusted_now
          and (
            ownership.valid_until is null
            or trusted_now < ownership.valid_until
          )
      ) then 'already_owned'
      when supplier.listing_status = 'approved'
           and supplier.verification_status <> 'watchlist'
      then 'eligible'
      else 'unavailable'
    end::text,
    prior_context.prior_claim_id,
    prior_context.prior_claim_status,
    prior_context.prior_claim_result_code,
    prior_context.prior_claim_decided_at
  from public.supplier_ownership_claims as claim_row
  join public.supplier_profiles as supplier
    on supplier.id = claim_row.supplier_profile_id
  cross join lateral (
    select claim_security.reviewer_evidence_projection_v1(
      claim_row.evidence_schema_version,
      claim_row.evidence_descriptors
    ) as projected
  ) as evidence
  cross join lateral claim_security.reviewer_prior_claim_context_v1(
    claim_row.prior_claim_id,
    claim_row.claimant_user_profile_id,
    claim_row.supplier_profile_id
  ) as prior_context
  where claim_row.id = p_claim_id
    and trusted_now < claim_row.expires_at
    and claim_row.claimant_snapshot_schema_version = 'claimant_snapshot_v1'
    and pg_catalog.jsonb_typeof(claim_row.claimant_snapshot) = 'object'
    and pg_catalog.jsonb_typeof(claim_row.claimant_snapshot -> 'full_name') = 'string'
    and pg_catalog.char_length(claim_row.claimant_snapshot ->> 'full_name')
      between 1 and 200
    and (
      not (claim_row.claimant_snapshot ? 'organization')
      or (
        pg_catalog.jsonb_typeof(claim_row.claimant_snapshot -> 'organization') = 'string'
        and pg_catalog.char_length(claim_row.claimant_snapshot ->> 'organization')
          between 1 and 200
      )
    )
    and (
      not (claim_row.claimant_snapshot ? 'job_title')
      or (
        pg_catalog.jsonb_typeof(claim_row.claimant_snapshot -> 'job_title') = 'string'
        and pg_catalog.char_length(claim_row.claimant_snapshot ->> 'job_title')
          between 1 and 200
      )
    )
    and evidence.projected is not null;
end
$function$;


comment on function claim_api.reviewer_detail_v1(uuid) is
  'Exact assigned-reviewer Claim-v1 detail. It repeats current RLS authorization and returns only typed bounded Claim state, claimant-submitted labels, sanitized evidence descriptors, Supplier summary/eligibility, and validated same-party resubmission context.';

revoke all on function
  claim_api.owner_assignment_queue_v1(timestamptz, uuid, integer),
  claim_api.owner_reviewer_candidates_v1(uuid, uuid, integer),
  claim_api.reviewer_queue_v1(timestamptz, uuid, integer),
  claim_api.reviewer_detail_v1(uuid)
from public, anon, authenticated, service_role, mujahiz_claim_runtime,
     mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;

grant execute on function
  claim_api.owner_assignment_queue_v1(timestamptz, uuid, integer),
  claim_api.owner_reviewer_candidates_v1(uuid, uuid, integer),
  claim_api.reviewer_queue_v1(timestamptz, uuid, integer),
  claim_api.reviewer_detail_v1(uuid)
to mujahiz_claim_runtime;

alter function claim_api.owner_assignment_queue_v1(timestamptz, uuid, integer)
  owner to mujahiz_claim_owner_projection;
alter function claim_api.owner_reviewer_candidates_v1(uuid, uuid, integer)
  owner to mujahiz_claim_owner_projection;
alter function claim_api.reviewer_queue_v1(timestamptz, uuid, integer)
  owner to mujahiz_claim_reviewer_projection;
alter function claim_api.reviewer_detail_v1(uuid)
  owner to mujahiz_claim_reviewer_projection;

-- Reassert the client and generic service boundary after all objects exist.
revoke all on schema claim_api
  from public, anon, authenticated, service_role;

revoke create on schema claim_security, claim_api
  from mujahiz_claim_owner_projection, mujahiz_claim_reviewer_projection;
revoke mujahiz_claim_owner_projection,
  mujahiz_claim_reviewer_projection from postgres;
