[CmdletBinding()]
param([string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
$containerName = "mujahiz-iq-privileged-resolver-context-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$containerStarted = $false
$success = $false
$failureOutput = @()

function Invoke-Psql {
  param([string]$Label, [string]$Sql, [string]$ContainerPath)

  $arguments = @(
    'exec', $containerName, 'psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--username=postgres', '--dbname=postgres', '--quiet'
  )
  if ($ContainerPath) { $arguments += @('--file', $ContainerPath) }
  else { $arguments += @('--command', $Sql) }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($exitCode -ne 0) {
    $script:failureOutput = @("$Label failed.") + $output
    throw "$Label failed."
  }
  return $output
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is required but was not found on PATH.'
  }
  if (-not (Test-Path -LiteralPath $migrationsDirectory)) {
    throw 'Expected repository-relative supabase/migrations directory was not found.'
  }

  $mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
  & docker run --detach --rm --name $containerName --mount $mount `
    --env 'POSTGRES_PASSWORD=postgres' --env 'POSTGRES_DB=postgres' `
    $PostgresImage *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL startup failed.' }
  $containerStarted = $true

  $stableReadyChecks = 0
  for ($attempt = 1; $attempt -le 90; $attempt++) {
    & docker exec $containerName pg_isready --username=postgres --dbname=postgres *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    & docker exec $containerName sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
    $initializationInProgress = $LASTEXITCODE -eq 0
    if ($databaseReady -and -not $initializationInProgress) {
      $stableReadyChecks++
    }
    else {
      $stableReadyChecks = 0
    }
    if ($stableReadyChecks -ge 6) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($stableReadyChecks -lt 6) {
    throw 'Disposable PostgreSQL did not become stably ready.'
  }

  $bootstrapSql = @'
create schema if not exists extensions;
do $role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit;
  end if;
end
$role$;
'@
  Invoke-Psql -Label 'Local-role bootstrap' -Sql $bootstrapSql | Out-Null

  $migrations = @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)
  foreach ($migration in $migrations) {
    Invoke-Psql -Label "Migration $($migration.Name)" `
      -ContainerPath "/workspace/supabase/migrations/$($migration.Name)" | Out-Null
  }

  $harnessSql = @'
create temporary table resolver_harness_backend (
  backend_pid integer not null
) on commit preserve rows;
insert into resolver_harness_backend values (pg_catalog.pg_backend_pid());

create function pg_temp.seed_resolver_actor(p_actor uuid, p_role text)
returns void
language plpgsql
volatile
set search_path = pg_catalog
as $function$
begin
  insert into public.user_profiles (
    id, full_name, account_context,
    verification_mirror_status, verification_mirror_observed_at
  ) values (
    p_actor, 'Synthetic context harness actor', 'buyer',
    'verified', pg_catalog.statement_timestamp()
  );

  insert into internal.identity_provider_links (
    id, user_profile_id, provider_code, provider_subject, is_primary,
    link_status, identity_status, verification_status,
    provider_state_observed_at, provider_state_version, verified_at
  ) values (
    p_actor, p_actor, 'firebase', 'firebase-' || p_actor::text, true,
    'linked', 'active', 'verified', pg_catalog.statement_timestamp(),
    'firebase-provider-state-v1', pg_catalog.statement_timestamp()
  );

  insert into public.platform_role_assignments (
    id, user_profile_id, role_code, valid_from, assignment_source_type,
    assignment_reason_code, authorization_policy_version,
    evidence_reference, assignment_system_source
  ) values (
    p_actor, p_actor, p_role, pg_catalog.statement_timestamp() - interval '1 day',
    'bootstrap_manifest', 'context_harness', 'platform-role-policy-v1',
    'context-harness-role', 'context_harness'
  );

  insert into public.access_grants (
    id, user_profile_id, platform_role_assignment_id, role_code,
    valid_from, valid_until, grant_source_type, grant_reason_code,
    authorization_policy_version, evidence_reference, grant_system_source
  ) values (
    p_actor, p_actor, p_actor, p_role,
    pg_catalog.statement_timestamp() - interval '1 hour',
    case when p_role = 'admin'
      then pg_catalog.statement_timestamp() + interval '1 day'
      else null
    end,
    'bootstrap_manifest', 'context_harness', 'platform-access-policy-v1',
    'context-harness-access', 'context_harness'
  );

  insert into internal.security_eligibility_assessments (
    id, user_profile_id, assessment_result, condition_type, valid_from,
    assessment_source_type, assessment_reason_code, security_policy_version,
    required_coverage_version, evidence_minimization_version,
    evidence_reference, assessment_system_source
  ) values (
    p_actor, p_actor, 'clear', 'complete_clear',
    pg_catalog.statement_timestamp() - interval '1 hour',
    'bootstrap_manifest', 'context_harness', 'platform-admin-security-v1',
    'platform-admin-coverage-v1', 'platform-admin-minimization-v1',
    'context-harness-security', 'context_harness'
  );
end
$function$;

begin;
select pg_temp.seed_resolver_actor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid, 'owner');
select pg_temp.seed_resolver_actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid, 'admin');
commit;

begin;
select claim_security.establish_claim_runtime_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid);
do $check$
declare
  current_decision text;
  resolved_role_code text;
begin
  select result.decision, result.role_code
  into current_decision, resolved_role_code
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'eligible' or resolved_role_code <> 'owner' then
    raise exception 'Principal A did not resolve as the exact eligible Owner: decision=%, role=%', current_decision, resolved_role_code;
  end if;
end
$check$;
commit;

do $check$
declare
  current_decision text;
begin
  if pg_catalog.pg_backend_pid() <> (select backend_pid from resolver_harness_backend) then
    raise exception 'Harness did not reuse one PostgreSQL backend';
  end if;
  if claim_security.current_claim_user_profile_id() is not null then
    raise exception 'Principal context survived commit';
  end if;
  select result.decision into current_decision
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'unknown' then
    raise exception 'Resolver authorized after committed context cleanup';
  end if;
end
$check$;

begin;
select claim_security.establish_claim_runtime_context('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid);
do $check$
declare
  current_decision text;
  resolved_role_code text;
begin
  select result.decision, result.role_code
  into current_decision, resolved_role_code
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'eligible' or resolved_role_code <> 'admin' then
    raise exception 'Principal B did not resolve only its exact eligible Admin facts';
  end if;
end
$check$;
rollback;

do $check$
declare
  current_decision text;
begin
  if pg_catalog.pg_backend_pid() <> (select backend_pid from resolver_harness_backend) then
    raise exception 'Harness backend changed after rollback';
  end if;
  if claim_security.current_claim_user_profile_id() is not null then
    raise exception 'Principal context survived rollback';
  end if;
  select result.decision into current_decision
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'unknown' then
    raise exception 'Resolver authorized after rolled-back context cleanup';
  end if;
end
$check$;

begin;
select claim_security.establish_claim_runtime_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid);
do $check$
declare
  current_decision text;
begin
  select result.decision into current_decision
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'eligible' then
    raise exception 'Principal A was not eligible before authority change';
  end if;
end
$check$;
commit;

begin;
update public.user_profiles
set verification_mirror_status = 'unverified'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid;
commit;

begin;
select claim_security.establish_claim_runtime_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid);
do $check$
declare
  current_decision text;
begin
  select result.decision into current_decision
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'denied' then
    raise exception 'Resolver reused a stale eligible decision after authority changed';
  end if;
end
$check$;
rollback;

begin;
update public.user_profiles
set verification_mirror_status = 'verified'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid;
commit;

begin;
select claim_security.establish_claim_runtime_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid);
do $check$
declare
  current_decision text;
begin
  select result.decision into current_decision
  from claim_security.current_privileged_actor_v1() as result;
  if current_decision <> 'eligible' then
    raise exception 'Restored exact authority did not re-resolve as eligible';
  end if;
end
$check$;
commit;

begin;
delete from internal.security_eligibility_assessments
where user_profile_id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);
delete from public.access_grants
where user_profile_id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);
delete from public.platform_role_assignments
where user_profile_id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);
delete from internal.identity_provider_links
where user_profile_id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);
delete from public.user_profiles
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
);
commit;

do $check$
begin
  if exists (
    select 1 from public.user_profiles
    where id in (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
    )
  ) then
    raise exception 'Synthetic resolver harness fixtures were not cleaned up';
  end if;
end
$check$;
'@

  Invoke-Psql -Label 'Reused-backend resolver context harness' -Sql $harnessSql | Out-Null
  $success = $true
}
catch {
  if ($failureOutput.Count -eq 0) { $failureOutput = @($_.Exception.Message) }
}
finally {
  if ($containerStarted) { & docker rm --force $containerName *> $null }
}

if ($success) {
  Write-Output 'Privileged resolver context harness passed: one reused PostgreSQL backend proved commit/rollback cleanup and current-state re-read; disposable local container only, not driver/pool/pooler evidence.'
  exit 0
}

Write-Error "Privileged resolver context harness failed.$([Environment]::NewLine)$($failureOutput -join [Environment]::NewLine)"
exit 1
