-- Sixteenth local SQL slice: Claim runtime identity-context foundation only.
-- This migration creates no RLS, Claim command, browser/API grant, Auth bridge,
-- Claim row, hosted capability, Firebase integration, or data movement.

do $role$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'mujahiz_claim_runtime'
  ) then
    create role mujahiz_claim_runtime
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  elsif exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'mujahiz_claim_runtime'
      and (
        rolcanlogin
        or rolinherit
        or rolsuper
        or rolcreatedb
        or rolcreaterole
        or rolreplication
        or rolbypassrls
      )
  ) then
    raise exception 'Existing mujahiz_claim_runtime role has unsafe attributes';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members
    where (
      roleid = 'mujahiz_claim_runtime'::regrole
      or member = 'mujahiz_claim_runtime'::regrole
    )
      and not (
        roleid = 'mujahiz_claim_runtime'::regrole
        and member = 'postgres'::regrole
        and admin_option
        and not inherit_option
        and not set_option
      )
  ) then
    raise exception 'Existing mujahiz_claim_runtime role has unexpected memberships';
  end if;
end
$role$;

comment on role mujahiz_claim_runtime is
  'NOLOGIN, NOINHERIT, non-owner Claim-v1 database execution role. It is not a browser identity, Supabase API role, platform role, Firebase identity, or general SQL authority.';

create schema if not exists claim_security;

comment on schema claim_security is
  'Non-exposed Claim authorization helpers only. It contains no domain rows, provider subjects, commands, RLS policies, or browser/API surface.';

revoke all on schema claim_security from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant usage on schema claim_security to mujahiz_claim_runtime;

alter default privileges in schema claim_security
  revoke execute on functions from public, anon, authenticated, service_role, mujahiz_claim_runtime;

create function claim_security.establish_claim_runtime_context(
  p_user_profile_id uuid
)
returns void
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $function$
begin
  if p_user_profile_id is null then
    raise exception using
      errcode = '22004',
      message = 'Claim runtime principal is required';
  end if;

  perform pg_catalog.set_config(
    'mujahiz.claim.user_profile_id',
    p_user_profile_id::text,
    true
  );
  perform pg_catalog.set_config('mujahiz.claim.purpose', 'claim_v1', true);
  perform pg_catalog.set_config('mujahiz.claim.environment', 'local', true);
  perform pg_catalog.set_config(
    'mujahiz.claim.policy_version',
    'sec-001-claim-v1',
    true
  );
  perform pg_catalog.set_config(
    'mujahiz.claim.transaction_id',
    pg_catalog.pg_current_xact_id()::text,
    true
  );
end
$function$;

comment on function claim_security.establish_claim_runtime_context(uuid) is
  'Trusted-server entry point for one local Claim-v1 transaction. It accepts only a provider-neutral user_profiles UUID and writes fixed transaction-local purpose, environment, policy, and transaction bindings.';

create function claim_security.current_claim_user_profile_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $function$
declare
  principal_text text := nullif(
    pg_catalog.current_setting('mujahiz.claim.user_profile_id', true),
    ''
  );
  purpose_text text := nullif(
    pg_catalog.current_setting('mujahiz.claim.purpose', true),
    ''
  );
  environment_text text := nullif(
    pg_catalog.current_setting('mujahiz.claim.environment', true),
    ''
  );
  policy_version_text text := nullif(
    pg_catalog.current_setting('mujahiz.claim.policy_version', true),
    ''
  );
  transaction_id_text text := nullif(
    pg_catalog.current_setting('mujahiz.claim.transaction_id', true),
    ''
  );
  principal_id uuid;
begin
  if principal_text is null
     or purpose_text is null
     or purpose_text <> 'claim_v1'
     or environment_text is null
     or environment_text <> 'local'
     or policy_version_text is null
     or policy_version_text <> 'sec-001-claim-v1'
     or transaction_id_text is distinct from pg_catalog.pg_current_xact_id()::text
  then
    return null;
  end if;

  begin
    principal_id := principal_text::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  return principal_id;
end
$function$;

comment on function claim_security.current_claim_user_profile_id() is
  'Fail-closed Claim-v1 accessor. It returns only a valid provider-neutral principal bound to the current local transaction, purpose, environment, and SEC-001 policy version; it never returns provider identity.';

revoke all on function claim_security.establish_claim_runtime_context(uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
revoke all on function claim_security.current_claim_user_profile_id()
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;

grant execute on function claim_security.establish_claim_runtime_context(uuid)
  to mujahiz_claim_runtime;
grant execute on function claim_security.current_claim_user_profile_id()
  to mujahiz_claim_runtime;

revoke all privileges on all tables in schema public, internal
  from mujahiz_claim_runtime;
revoke all privileges on all sequences in schema public, internal
  from mujahiz_claim_runtime;
revoke all privileges on all functions in schema public, internal
  from mujahiz_claim_runtime;
