-- Twenty-third tracked local SQL migration: read-only relational privileged-actor resolver only.
-- This migration creates no authority row, table, view, RLS policy, mutation, Firebase
-- integration, Reviewer assignment, target-Supplier rule, hosted capability, or Production action.

create function claim_security.current_privileged_actor_v1()
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
  principal_id uuid := claim_security.current_claim_user_profile_id();
  profile_row public.user_profiles%rowtype;
  provider_row internal.identity_provider_links%rowtype;
  role_row public.platform_role_assignments%rowtype;
  access_row public.access_grants%rowtype;
  security_row internal.security_eligibility_assessments%rowtype;
  matching_count bigint;
  total_count bigint;
  unsupported_count bigint;
  resolved_role_assignment_id uuid;
  resolved_role_code text;
  has_unknown boolean := false;
  has_denied boolean := false;
begin
  if principal_id is null then
    return query select 'unknown'::text, null::text;
    return;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.user_profiles as profile
  where profile.id = principal_id;

  if matching_count <> 1 then
    has_unknown := true;
  else
    select profile.*
    into profile_row
    from public.user_profiles as profile
    where profile.id = principal_id;

    if profile_row.account_status <> 'active'
       or profile_row.account_context <> 'buyer'
       or profile_row.verification_mirror_status = 'unverified'
    then
      has_denied := true;
    end if;

    if profile_row.verification_mirror_status = 'unknown' then
      has_unknown := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from internal.identity_provider_links as provider_link
  where provider_link.user_profile_id = principal_id
    and provider_link.provider_code = 'firebase'
    and provider_link.link_status = 'linked';

  if matching_count > 1 then
    has_unknown := true;
  elsif matching_count = 1 then
    select provider_link.*
    into provider_row
    from internal.identity_provider_links as provider_link
    where provider_link.user_profile_id = principal_id
      and provider_link.provider_code = 'firebase'
      and provider_link.link_status = 'linked';
  else
    select pg_catalog.count(*)
    into total_count
    from internal.identity_provider_links as provider_link
    where provider_link.user_profile_id = principal_id
      and provider_link.provider_code = 'firebase';

    if total_count <> 1 then
      has_unknown := true;
    else
      select provider_link.*
      into provider_row
      from internal.identity_provider_links as provider_link
      where provider_link.user_profile_id = principal_id
        and provider_link.provider_code = 'firebase';
    end if;
  end if;

  if provider_row.id is not null then
    if provider_row.provider_state_version is distinct from 'firebase-provider-state-v1' then
      has_unknown := true;
    end if;

    if provider_row.link_status = 'unlinked'
       or provider_row.identity_status = 'disabled'
       or provider_row.verification_status = 'unverified'
    then
      has_denied := true;
    end if;

    if (provider_row.link_status = 'linked' and not provider_row.is_primary)
       or provider_row.identity_status = 'unknown'
       or provider_row.verification_status = 'unknown'
    then
      has_unknown := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.platform_role_assignments as role_assignment
  where role_assignment.user_profile_id = principal_id
    and role_assignment.valid_from <= trusted_now
    and (
      role_assignment.valid_until is null
      or trusted_now < role_assignment.valid_until
    );

  if matching_count > 1 then
    has_unknown := true;
  elsif matching_count = 1 then
    select role_assignment.*
    into role_row
    from public.platform_role_assignments as role_assignment
    where role_assignment.user_profile_id = principal_id
      and role_assignment.valid_from <= trusted_now
      and (
        role_assignment.valid_until is null
        or trusted_now < role_assignment.valid_until
      );

    if role_row.authorization_policy_version is distinct from 'platform-role-policy-v1' then
      has_unknown := true;
    elsif role_row.assignment_status = 'active'
          and role_row.role_code in ('owner', 'admin')
    then
      resolved_role_assignment_id := role_row.id;
      resolved_role_code := role_row.role_code;
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
    where role_assignment.user_profile_id = principal_id;

    if total_count = 0 or unsupported_count > 0 then
      has_unknown := true;
    else
      has_denied := true;
    end if;
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.access_grants as access_grant
  where access_grant.user_profile_id = principal_id
    and access_grant.access_purpose = 'platform_administration'
    and access_grant.valid_from <= trusted_now
    and (
      access_grant.valid_until is null
      or trusted_now < access_grant.valid_until
    );

  if matching_count > 1 then
    has_unknown := true;
  elsif matching_count = 1 then
    select access_grant.*
    into access_row
    from public.access_grants as access_grant
    where access_grant.user_profile_id = principal_id
      and access_grant.access_purpose = 'platform_administration'
      and access_grant.valid_from <= trusted_now
      and (
        access_grant.valid_until is null
        or trusted_now < access_grant.valid_until
      );

    if access_row.authorization_policy_version is distinct from 'platform-access-policy-v1' then
      has_unknown := true;
    elsif access_row.access_status <> 'active' then
      has_denied := true;
    elsif resolved_role_assignment_id is not null
          and (
            access_row.platform_role_assignment_id <> resolved_role_assignment_id
            or access_row.role_code <> resolved_role_code
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
    where access_grant.user_profile_id = principal_id
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
  where security_assessment.user_profile_id = principal_id
    and security_assessment.assessment_scope = 'platform_administration'
    and security_assessment.valid_from <= trusted_now
    and (
      security_assessment.valid_until is null
      or trusted_now < security_assessment.valid_until
    );

  if matching_count <> 1 then
    has_unknown := true;
  else
    select security_assessment.*
    into security_row
    from internal.security_eligibility_assessments as security_assessment
    where security_assessment.user_profile_id = principal_id
      and security_assessment.assessment_scope = 'platform_administration'
      and security_assessment.valid_from <= trusted_now
      and (
        security_assessment.valid_until is null
        or trusted_now < security_assessment.valid_until
      );

    if security_row.security_policy_version is distinct from 'platform-admin-security-v1'
       or security_row.required_coverage_version is distinct from 'platform-admin-coverage-v1'
       or security_row.evidence_minimization_version is distinct from 'platform-admin-minimization-v1'
    then
      has_unknown := true;
    elsif security_row.assessment_status <> 'active' then
      has_unknown := true;
    elsif security_row.assessment_result = 'deny'
          and security_row.condition_type in (
            'explicit_deny', 'security_hold', 'identity_quarantine'
          )
    then
      has_denied := true;
    elsif security_row.assessment_result = 'unknown'
          and security_row.condition_type = 'reconciliation_required'
    then
      has_unknown := true;
    elsif not (
      security_row.assessment_result = 'clear'
      and security_row.condition_type = 'complete_clear'
    ) then
      has_unknown := true;
    end if;
  end if;

  if has_unknown then
    decision := 'unknown';
  elsif has_denied then
    decision := 'denied';
  elsif resolved_role_assignment_id is not null
        and access_row.id is not null
        and access_row.access_status = 'active'
        and access_row.authorization_policy_version = 'platform-access-policy-v1'
        and access_row.platform_role_assignment_id = resolved_role_assignment_id
        and access_row.role_code = resolved_role_code
        and security_row.id is not null
        and security_row.assessment_status = 'active'
        and security_row.assessment_result = 'clear'
        and security_row.condition_type = 'complete_clear'
  then
    decision := 'eligible';
  else
    decision := 'unknown';
  end if;

  role_code := resolved_role_code;
  return next;
end
$function$;

alter function claim_security.current_privileged_actor_v1() owner to postgres;

comment on function claim_security.current_privileged_actor_v1() is
  'Read-only LOCAL Claim-v1 current-principal observation. Only eligible is authorization-positive; denied and unknown are non-authorizing. The result is not a reservation, token, lease, or substitute for authority re-read and locking inside a future trusted mutation.';

revoke all on function claim_security.current_privileged_actor_v1()
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function claim_security.current_privileged_actor_v1()
  to mujahiz_claim_runtime;

revoke all privileges on table
  public.user_profiles,
  internal.identity_provider_links,
  public.platform_role_assignments,
  public.access_grants,
  internal.security_eligibility_assessments
from mujahiz_claim_runtime;
