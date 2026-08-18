[CmdletBinding()]
param([string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
. (Join-Path $PSScriptRoot 'claim-owner-role-provisioner.ps1')
. (Join-Path $PSScriptRoot 'claim-authorization-finalizer.ps1')
$b4MigrationName = '20260817000100_claim_rls_authorization_foundation.sql'
$containerName = "mujahiz-claim-assign-concurrency-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
$containerStarted = $false
$checks = [System.Collections.Generic.List[string]]::new()
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "Assertion failed: $Message" }
  $script:checks.Add($Message)
}

function Invoke-Psql {
  param([string]$Sql, [string]$Label, [switch]$AllowFailure)
  $arguments = @(
    'exec', $containerName, 'psql', '--no-psqlrc',
    '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose',
    '--username=postgres', '--dbname=postgres', '--quiet',
    '--tuples-only', '--no-align', '--pset', 'footer=off',
    '--command', $Sql
  )
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "$Label failed.$([Environment]::NewLine)$($output -join [Environment]::NewLine)"
  }
  [pscustomobject]@{
    ExitCode = $exitCode
    Output = $output
    Text = $output -join [Environment]::NewLine
  }
}

function Get-JsonResult {
  param([object]$Invocation, [string]$Label)
  if ($Invocation.ExitCode -ne 0) {
    throw "$Label unexpectedly failed.$([Environment]::NewLine)$($Invocation.Text)"
  }
  $jsonLine = @($Invocation.Output | Where-Object { $_ -match '^\{' } | Select-Object -Last 1)
  if ($jsonLine.Count -ne 1) {
    throw "$Label returned no unique JSON result.$([Environment]::NewLine)$($Invocation.Text)"
  }
  $jsonLine[0] | ConvertFrom-Json
}

function New-RuntimeSql {
  param([string]$PrincipalId, [string]$Body)
  @"
set role mujahiz_claim_runtime;
begin;
select claim_security.establish_claim_runtime_context('$PrincipalId');
select pg_catalog.set_config('mujahiz.claim.hmac_key', repeat('k', 32), true);
$Body
commit;
"@
}

function Invoke-AssignmentReservation {
  param(
    [string]$PrincipalId, [string]$Key, [string]$ClaimId,
    [int]$ExpectedVersion, [string]$CandidateId, [switch]$AllowFailure
  )
  $body = @"
select pg_catalog.row_to_json(reservation_row)::text
from supplier_claim.reserve_assign_reviewer(
  '$Key', '$ClaimId', $ExpectedVersion, '$CandidateId'
) as reservation_row;
"@
  Invoke-Psql -Sql (New-RuntimeSql $PrincipalId $body) `
    -Label "reserve assignment $Key" -AllowFailure:$AllowFailure
}

function New-AssignmentSql {
  param(
    [string]$PrincipalId, [string]$Key, [string]$ClaimId,
    [int]$ExpectedVersion, [string]$CandidateId, [string]$Fence
  )
  $body = @"
select pg_catalog.row_to_json(result_row)::text
from supplier_claim.assign_reviewer(
  '$Key', '$ClaimId', $ExpectedVersion, '$CandidateId', null, '$Fence'::uuid
) as result_row;
"@
  New-RuntimeSql $PrincipalId $body
}

function Invoke-Assignment {
  param(
    [string]$PrincipalId, [string]$Key, [string]$ClaimId,
    [int]$ExpectedVersion, [string]$CandidateId, [string]$Fence,
    [switch]$AllowFailure
  )
  Invoke-Psql -Sql (New-AssignmentSql $PrincipalId $Key $ClaimId `
    $ExpectedVersion $CandidateId $Fence) -Label "assign $Key" `
    -AllowFailure:$AllowFailure
}

function Invoke-WithdrawReservation {
  param([string]$PrincipalId, [string]$Key, [string]$ClaimId, [int]$ExpectedVersion)
  $body = @"
select pg_catalog.row_to_json(reservation_row)::text
from supplier_claim.reserve_withdraw('$Key', '$ClaimId', $ExpectedVersion)
  as reservation_row;
"@
  Invoke-Psql -Sql (New-RuntimeSql $PrincipalId $body) -Label "reserve withdraw $Key"
}

function New-WithdrawSql {
  param(
    [string]$PrincipalId, [string]$Key, [string]$ClaimId,
    [int]$ExpectedVersion, [string]$Fence
  )
  $body = @"
select pg_catalog.row_to_json(result_row)::text
from supplier_claim.withdraw(
  '$Key', '$ClaimId', $ExpectedVersion, null, '$Fence'::uuid
) as result_row;
"@
  New-RuntimeSql $PrincipalId $body
}

function New-SupplierBlockerSql {
  param([string]$SupplierId, [int]$Seconds = 3)
  @"
begin;
select pg_catalog.pg_advisory_xact_lock(
  claim_security.claim_supplier_lock_key_v1('$SupplierId')
);
select pg_catalog.pg_sleep($Seconds);
commit;
"@
}

function Invoke-ConcurrentSql {
  param([string]$SqlOne, [string]$SqlTwo, [string]$BlockSql)
  $dockerPath = (Get-Command docker).Source
  $jobScript = {
    param($DockerPath, $Container, $Sql)
    $arguments = @(
      'exec', $Container, 'psql', '--no-psqlrc',
      '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose',
      '--username=postgres', '--dbname=postgres', '--quiet',
      '--tuples-only', '--no-align', '--pset', 'footer=off',
      '--command', $Sql
    )
    $output = @(& $DockerPath @arguments 2>&1 | ForEach-Object { $_.ToString() })
    [pscustomobject]@{
      ExitCode = $LASTEXITCODE
      Output = $output
      Text = $output -join [Environment]::NewLine
    }
  }
  $blocker = Start-Job -ScriptBlock $jobScript `
    -ArgumentList $dockerPath, $containerName, $BlockSql
  Start-Sleep -Milliseconds 500
  $jobOne = Start-Job -ScriptBlock $jobScript `
    -ArgumentList $dockerPath, $containerName, $SqlOne
  $jobTwo = Start-Job -ScriptBlock $jobScript `
    -ArgumentList $dockerPath, $containerName, $SqlTwo
  $jobs = @($jobOne, $jobTwo)
  try {
    Wait-Job -Job $jobs -Timeout 25 | Out-Null
    Wait-Job -Job $blocker -Timeout 25 | Out-Null
    if (@($jobs | Where-Object State -ne 'Completed').Count -gt 0 `
        -or $blocker.State -ne 'Completed') {
      throw 'Concurrent SQL sessions did not finish within 25 seconds.'
    }
    @($jobs | ForEach-Object { Receive-Job -Job $_ })
  }
  finally {
    Remove-Job -Job ($jobs + $blocker) -Force -ErrorAction SilentlyContinue
  }
}
try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is required but was not found on PATH.'
  }
  $mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
  docker run --detach --rm --name $containerName --mount $mount --env 'POSTGRES_PASSWORD=postgres' --env 'POSTGRES_DB=postgres' $PostgresImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Unable to start disposable PostgreSQL.' }
  $containerStarted = $true

  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    docker exec $containerName pg_isready --username=postgres --dbname=postgres *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    docker exec $containerName sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
    $initializationInProgress = $LASTEXITCODE -eq 0
    if ($databaseReady -and -not $initializationInProgress) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'Disposable PostgreSQL readiness check failed.' }

  Invoke-Psql -Label 'Supabase local-role bootstrap' -Sql @'
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
do $$
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
$$;
'@ | Out-Null

  Invoke-ClaimOwnerRoleProvisioner -ContainerName $containerName | Out-Null
  foreach ($migration in @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)) {
    $arguments = @(
      'exec', $containerName, 'psql', '--no-psqlrc',
      '--set=ON_ERROR_STOP=1', '--username=postgres', '--dbname=postgres',
      '--quiet', '--file', "/workspace/supabase/migrations/$($migration.Name)"
    )
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $migrationOutput = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
    $migrationExit = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($migrationExit -ne 0) {
      throw "Migration $($migration.Name) failed.$([Environment]::NewLine)$($migrationOutput -join [Environment]::NewLine)"
    }
    if ($migration.Name -eq $b4MigrationName) {
      Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
    }
  }

  Invoke-Psql -Label 'synthetic assignment fixture setup' -Sql @'
create function public.assign_race_id(p_number integer)
returns uuid language sql immutable set search_path=pg_catalog
return ('b1000000-0000-4000-8000-' || pg_catalog.lpad(p_number::text,12,'0'))::uuid;

create function public.assign_race_actor(p_number integer, p_role text)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare actor_id uuid := public.assign_race_id(p_number);
  now_value timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(
    id, full_name, account_context, verification_mirror_status,
    verification_mirror_observed_at, created_at, updated_at
  ) values (
    actor_id, 'Assignment race actor ' || p_number, 'buyer', 'verified',
    now_value, now_value, now_value
  );
  insert into internal.identity_provider_links(
    id, user_profile_id, provider_code, provider_subject, is_primary,
    link_status, identity_status, verification_status,
    provider_state_observed_at, provider_state_version,
    linked_at, verified_at, created_at
  ) values (
    actor_id, actor_id, 'firebase', 'assignment-race-' || p_number, true,
    'linked', 'active', 'verified', now_value, 'firebase-provider-state-v1',
    now_value, now_value, now_value
  );
  insert into public.platform_role_assignments(
    id, user_profile_id, role_code, assignment_status, valid_from,
    assignment_source_type, assignment_reason_code,
    authorization_policy_version, evidence_reference,
    assignment_system_source, assigned_at, created_at, updated_at
  ) values (
    actor_id, actor_id, p_role, 'active', now_value - interval '2 days',
    'bootstrap_manifest', 'assignment_race', 'platform-role-policy-v1',
    'assignment-race-role', 'assignment_race',
    now_value, now_value, now_value
  );
  insert into public.access_grants(
    id, user_profile_id, platform_role_assignment_id, role_code,
    access_status, valid_from, valid_until, grant_source_type,
    grant_reason_code, authorization_policy_version, evidence_reference,
    grant_system_source, granted_at, created_at, updated_at
  ) values (
    actor_id, actor_id, actor_id, p_role, 'active',
    now_value - interval '1 day',
    case when p_role = 'admin' then now_value + interval '30 days' else null end,
    'bootstrap_manifest', 'assignment_race', 'platform-access-policy-v1',
    'assignment-race-access', 'assignment_race',
    now_value, now_value, now_value
  );
  insert into internal.security_eligibility_assessments(
    id, user_profile_id, assessment_result, condition_type, valid_from,
    assessment_status, assessment_source_type, assessment_reason_code,
    security_policy_version, required_coverage_version,
    evidence_minimization_version, evidence_reference,
    assessment_system_source, assessed_at, created_at, updated_at
  ) values (
    actor_id, actor_id, 'clear', 'complete_clear', now_value - interval '1 day',
    'active', 'bootstrap_manifest', 'assignment_race',
    'platform-admin-security-v1', 'platform-admin-coverage-v1',
    'platform-admin-minimization-v1', 'assignment-race-security',
    'assignment_race', now_value, now_value, now_value
  );
  return actor_id;
end
$$;

create function public.assign_race_claimant(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare claimant_id uuid := public.assign_race_id(p_number);
  now_value timestamptz := pg_catalog.statement_timestamp();
begin
  insert into public.user_profiles(
    id, full_name, account_context, verification_mirror_status,
    verification_mirror_observed_at, created_at, updated_at
  ) values (
    claimant_id, 'Assignment race claimant ' || p_number, 'supplier',
    'verified', now_value, now_value, now_value
  );
  insert into internal.identity_provider_links(
    id, user_profile_id, provider_code, provider_subject, is_primary,
    link_status, identity_status, verification_status,
    provider_state_observed_at, provider_state_version,
    linked_at, verified_at, created_at
  ) values (
    claimant_id, claimant_id, 'firebase', 'assignment-race-claimant-' || p_number,
    true, 'linked', 'active', 'verified', now_value,
    'firebase-provider-state-v1', now_value, now_value, now_value
  );
  return claimant_id;
end
$$;

create function public.assign_race_supplier(p_number integer)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare supplier_id uuid := public.assign_race_id(p_number);
begin
  insert into public.supplier_profiles(
    id, name_original, display_name, name_language, name_en,
    business_type, listing_status, verification_status,
    source_type, confidence_level, has_direct_experience
  ) values (
    supplier_id, 'Assignment Race Supplier ' || p_number,
    'Assignment Race Supplier ' || p_number, 'english',
    'Assignment Race Supplier ' || p_number, 'company',
    'approved', 'verified', 'other', 'low', 'no'
  );
  return supplier_id;
end
$$;

create function public.assign_race_claim(
  p_number integer, p_claimant integer, p_supplier integer,
  p_expiry_offset interval default interval '719 hours'
)
returns uuid language plpgsql volatile set search_path=pg_catalog as $$
declare claim_id uuid := public.assign_race_id(p_number);
  expires_value timestamptz := pg_catalog.statement_timestamp() + p_expiry_offset;
  submitted_value timestamptz := expires_value - interval '720 hours';
begin
  insert into public.supplier_ownership_claims(
    id, claimant_user_profile_id, supplier_profile_id, status, record_version,
    submitted_at, expires_at, submitted_reason,
    claimant_snapshot_schema_version, claimant_snapshot,
    submission_fingerprint_version, submission_fingerprint,
    evidence_schema_version, evidence_descriptors, created_at, updated_at
  ) values (
    claim_id, public.assign_race_id(p_claimant),
    public.assign_race_id(p_supplier), 'submitted', 1,
    submitted_value, expires_value,
    'Synthetic assignment concurrency Claim ' || p_number,
    'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1',
    repeat('e',64), 'claim_evidence_v1', '[]'::jsonb,
    submitted_value, submitted_value
  );
  return claim_id;
end
$$;

select public.assign_race_actor(1, 'owner');
select public.assign_race_actor(2, 'owner');
select public.assign_race_actor(3, 'owner');
select public.assign_race_actor(4, 'admin');
select public.assign_race_actor(5, 'admin');
select public.assign_race_claimant(n) from pg_catalog.generate_series(101,108) n;
select public.assign_race_supplier(n) from pg_catalog.generate_series(201,208) n;
select public.assign_race_claim(1001,101,201);
select public.assign_race_claim(1002,102,202);
select public.assign_race_claim(1003,103,203);
select public.assign_race_claim(1004,104,204);
select public.assign_race_claim(1005,105,205);
select public.assign_race_claim(1006,106,206, interval '3 seconds');
select public.assign_race_claim(1007,107,207);
select public.assign_race_claim(1008,108,208);
grant mujahiz_claim_runtime to postgres with set true;
'@ | Out-Null

  $ownerOne = 'b1000000-0000-4000-8000-000000000001'
  $ownerTwo = 'b1000000-0000-4000-8000-000000000002'
  $ownerThree = 'b1000000-0000-4000-8000-000000000003'
  $adminOne = 'b1000000-0000-4000-8000-000000000004'
  $adminTwo = 'b1000000-0000-4000-8000-000000000005'
  $claimantOne = 'b1000000-0000-4000-8000-000000000101'
  $claimantFour = 'b1000000-0000-4000-8000-000000000104'
  # 1. Two Owners / two candidates / different keys: one write-once winner.
  $raceClaim = 'b1000000-0000-4000-8000-000000001001'
  $raceSupplier = 'b1000000-0000-4000-8000-000000000201'
  $raceKeyOne = 'claim-b0000000-0000-4000-8000-000000000001'
  $raceKeyTwo = 'claim-b0000000-0000-4000-8000-000000000002'
  $raceOne = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $raceKeyOne $raceClaim 1 $adminOne) 'different-key reservation one'
  $raceTwo = Get-JsonResult (Invoke-AssignmentReservation $ownerTwo $raceKeyTwo $raceClaim 1 $adminTwo) 'different-key reservation two'
  Assert-True ($raceOne.reservation_outcome -eq 'execute' -and $raceTwo.reservation_outcome -eq 'execute') 'different-key assignment reservations commit independently'
  $raceResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerOne $raceKeyOne $raceClaim 1 $adminOne $raceOne.execution_fence) (New-AssignmentSql $ownerTwo $raceKeyTwo $raceClaim 1 $adminTwo $raceTwo.execution_fence) (New-SupplierBlockerSql $raceSupplier)
  $raceSuccess = @($raceResults | Where-Object ExitCode -eq 0)
  $raceFailure = @($raceResults | Where-Object ExitCode -ne 0)
  Assert-True ($raceSuccess.Count -eq 1 -and $raceFailure.Count -eq 1) 'two assigners and candidates produce one committed assignment'
  Assert-True ($raceFailure[0].Text -match 'P5112.*claim_version_conflict') 'different-key race loser is the deterministic version conflict'
  $raceState = (Invoke-Psql -Label 'different-key race state' -Sql @"
select status||'/'||record_version||'/'||
  (reviewer_user_profile_id in ('$adminOne'::uuid,'$adminTwo'::uuid))::text||'/'||
  (select count(*) from internal.domain_events
   where aggregate_id='$raceClaim'::uuid
     and event_type='supplier_ownership.claim_under_review')||'/'||
  (select count(*) from internal.audit_logs
   where target_id='$raceClaim'::uuid and outcome_class='succeeded')
from public.supplier_ownership_claims where id='$raceClaim'::uuid;
"@).Output | Where-Object { $_ -match '^under_review/' } | Select-Object -Last 1
  Assert-True ($raceState -eq 'under_review/2/true/1/1') 'different-key race commits one version, one event, and one audit'

  # 2. Same key / same fingerprint concurrent retry: one logical result.
  $sameClaim = 'b1000000-0000-4000-8000-000000001002'
  $sameSupplier = 'b1000000-0000-4000-8000-000000000202'
  $sameKey = 'claim-b0000000-0000-4000-8000-000000000011'
  $sameReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $sameKey $sameClaim 1 $adminOne) 'same-key reservation'
  $sameResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerOne $sameKey $sameClaim 1 $adminOne $sameReservation.execution_fence) (New-AssignmentSql $ownerOne $sameKey $sameClaim 1 $adminOne $sameReservation.execution_fence) (New-SupplierBlockerSql $sameSupplier)
  $sameSuccess = @($sameResults | Where-Object ExitCode -eq 0)
  $sameFailure = @($sameResults | Where-Object ExitCode -ne 0)
  Assert-True ($sameSuccess.Count -eq 1 -and $sameFailure.Count -eq 1) 'same key/fingerprint concurrent Phase B has one worker winner'
  Assert-True ($sameFailure[0].Text -match 'P5110.*retry_later') 'same-key losing worker observes completed reservation without executing'
  $sameReplay = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $sameKey $sameClaim 1 $adminOne) 'same-key replay'
  Assert-True ($sameReplay.reservation_outcome -eq 'replay' -and $sameReplay.idempotent_replay) 'same-key retry returns the committed logical result'
  $sameState = (Invoke-Psql -Label 'same-key effects' -Sql @"
select record_version||'/'||
 (select count(*) from internal.domain_events where aggregate_id='$sameClaim'::uuid)||'/'||
 (select count(*) from internal.audit_logs where target_id='$sameClaim'::uuid
  and outcome_class='succeeded')
from public.supplier_ownership_claims where id='$sameClaim'::uuid;
"@).Output | Where-Object { $_ -match '^\d+/\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($sameState -eq '2/1/1') 'same-key retry leaves one version, one event, and one audit'

  # 3. Same key / different candidate: no wrong replay.
  $swapClaim = 'b1000000-0000-4000-8000-000000001003'
  $swapKey = 'claim-b0000000-0000-4000-8000-000000000021'
  $swapReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $swapKey $swapClaim 1 $adminOne) 'candidate-swap reservation'
  $swapFailure = Invoke-Assignment $ownerOne $swapKey $swapClaim 1 $adminTwo $swapReservation.execution_fence -AllowFailure
  Assert-True ($swapFailure.ExitCode -ne 0 -and $swapFailure.Text -match 'P5108.*idempotency_key_conflict') 'same key with another candidate never executes or replays the wrong reviewer'
  $swapState = (Invoke-Psql -Label 'candidate-swap state' -Sql @"
select status||'/'||record_version||'/'||(reviewer_user_profile_id is null)::text||'/'||
 (select count(*) from internal.domain_events where aggregate_id='$swapClaim'::uuid)
from public.supplier_ownership_claims where id='$swapClaim'::uuid;
"@).Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($swapState -eq 'submitted/1/true/0') 'candidate swap leaves the Claim wholly unassigned'

  # 4. Assignment vs withdraw: Supplier-lock serialization yields one coherent winner.
  $crossClaim = 'b1000000-0000-4000-8000-000000001004'
  $crossSupplier = 'b1000000-0000-4000-8000-000000000204'
  $assignKey = 'claim-b0000000-0000-4000-8000-000000000031'
  $withdrawKey = 'claim-b0000000-0000-4000-8000-000000000032'
  $assignReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $assignKey $crossClaim 1 $adminOne) 'cross-command assignment reservation'
  $withdrawReservation = Get-JsonResult (Invoke-WithdrawReservation $claimantFour $withdrawKey $crossClaim 1) 'cross-command withdraw reservation'
  $crossResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerOne $assignKey $crossClaim 1 $adminOne $assignReservation.execution_fence) (New-WithdrawSql $claimantFour $withdrawKey $crossClaim 1 $withdrawReservation.execution_fence) (New-SupplierBlockerSql $crossSupplier)
  $crossSuccess = @($crossResults | Where-Object ExitCode -eq 0)
  $crossFailure = @($crossResults | Where-Object ExitCode -ne 0)
  Assert-True ($crossSuccess.Count -eq 1 -and $crossFailure.Count -eq 1) 'assignment versus withdraw has exactly one successful command'
  Assert-True ($crossFailure[0].Text -match 'P5112.*claim_version_conflict') 'assignment/withdraw loser re-reads the changed Claim version'
  $crossState = (Invoke-Psql -Label 'cross-command state' -Sql @"
select status||'/'||record_version||'/'||
 (select count(*) from internal.domain_events where aggregate_id='$crossClaim'::uuid)||'/'||
 (select count(*) from internal.audit_logs where target_id='$crossClaim'::uuid
  and outcome_class='succeeded')
from public.supplier_ownership_claims where id='$crossClaim'::uuid;
"@).Output | Where-Object { $_ -match '^(under_review|withdrawn)/' } | Select-Object -Last 1
  Assert-True ($crossState -in @('under_review/2/1/1','withdrawn/2/1/0')) 'assignment/withdraw race leaves one coherent lifecycle, event, and audit shape'
  # 5. Assignment near expiry cannot commit after trusted expiry.
  $expiryClaim = 'b1000000-0000-4000-8000-000000001006'
  $expirySupplier = 'b1000000-0000-4000-8000-000000000206'
  $expiryKey = 'claim-b0000000-0000-4000-8000-000000000041'
  $expiryReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $expiryKey $expiryClaim 1 $adminOne) 'near-expiry reservation'
  $expiryResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerOne $expiryKey $expiryClaim 1 $adminOne $expiryReservation.execution_fence) 'select 1;' (New-SupplierBlockerSql $expirySupplier 4)
  Assert-True ($expiryResults[0].ExitCode -ne 0 -and $expiryResults[0].Text -match 'P5114.*claim_expired') 'assignment blocked across the due boundary fails with trusted-time expiry'
  $expiryState = (Invoke-Psql -Label 'near-expiry state' -Sql @"
select status||'/'||record_version||'/'||(reviewer_user_profile_id is null)::text||'/'||
 (select count(*) from internal.domain_events where aggregate_id='$expiryClaim'::uuid)
from public.supplier_ownership_claims where id='$expiryClaim'::uuid;
"@).Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($expiryState -eq 'submitted/1/true/0') 'due-boundary loser leaves no partial assignment or event'

  # 6. Assigner authority removal wins under the principal-authority lock.
  $authorityClaim = 'b1000000-0000-4000-8000-000000001007'
  $authorityKey = 'claim-b0000000-0000-4000-8000-000000000051'
  $authorityReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerThree $authorityKey $authorityClaim 1 $adminOne) 'authority-loss reservation'
  $authorityWriter = @"
begin;
select pg_catalog.pg_advisory_xact_lock(
  claim_security.claim_principal_lock_key_v1('$ownerThree')
);
select id from public.user_profiles where id='$ownerThree'::uuid for update;
select id from internal.identity_provider_links
where user_profile_id='$ownerThree'::uuid order by id for update;
select id from public.platform_role_assignments
where user_profile_id='$ownerThree'::uuid order by id for update;
select id from public.access_grants
where user_profile_id='$ownerThree'::uuid order by id for update;
select id from internal.security_eligibility_assessments
where user_profile_id='$ownerThree'::uuid order by id for update;
update internal.security_eligibility_assessments
set assessment_result='deny', condition_type='security_hold',
    assessment_source_type='trusted_security_system'
where user_profile_id='$ownerThree'::uuid;
select pg_catalog.pg_sleep(3);
commit;
"@
  $authorityResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerThree $authorityKey $authorityClaim 1 $adminOne $authorityReservation.execution_fence) 'select 1;' $authorityWriter
  $authorityResult = Get-JsonResult $authorityResults[0] 'authority-loss assignment'
  Assert-True ($authorityResult.outcome_code -eq 'actor_not_authorized') 'assigner eligibility loss is re-read after the principal lock'
  $authorityState = (Invoke-Psql -Label 'authority-loss state' -Sql @"
select status||'/'||record_version||'/'||(reviewer_user_profile_id is null)::text||'/'||
 (select count(*) from internal.audit_logs
  where target_id='$authorityClaim'::uuid and result_code='actor_not_authorized')
from public.supplier_ownership_claims where id='$authorityClaim'::uuid;
"@).Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($authorityState -eq 'submitted/1/true/1') 'authority-loss denial leaves Claim unchanged and one bounded audit'

  # Candidate authority removal uses the same deterministic principal lock.
  $candidateClaim = 'b1000000-0000-4000-8000-000000001005'
  $candidateKey = 'claim-b0000000-0000-4000-8000-000000000052'
  $candidateReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $candidateKey $candidateClaim 1 $adminTwo) 'candidate-loss reservation'
  $candidateWriter = @"
begin;
select pg_catalog.pg_advisory_xact_lock(
  claim_security.claim_principal_lock_key_v1('$adminTwo')
);
select id from public.user_profiles where id='$adminTwo'::uuid for update;
select id from internal.identity_provider_links
where user_profile_id='$adminTwo'::uuid order by id for update;
select id from public.platform_role_assignments
where user_profile_id='$adminTwo'::uuid order by id for update;
select id from public.access_grants
where user_profile_id='$adminTwo'::uuid order by id for update;
select id from internal.security_eligibility_assessments
where user_profile_id='$adminTwo'::uuid order by id for update;
update internal.security_eligibility_assessments
set assessment_result='deny', condition_type='security_hold',
    assessment_source_type='trusted_security_system'
where user_profile_id='$adminTwo'::uuid;
select pg_catalog.pg_sleep(3);
commit;
"@
  $candidateResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerOne $candidateKey $candidateClaim 1 $adminTwo $candidateReservation.execution_fence) 'select 1;' $candidateWriter
  $candidateResult = Get-JsonResult $candidateResults[0] 'candidate-loss assignment'
  Assert-True ($candidateResult.outcome_code -eq 'reviewer_conflict') 'candidate eligibility loss is re-read after the principal lock'
  $candidateState = (Invoke-Psql -Label 'candidate-loss state' -Sql @"
select status||'/'||record_version||'/'||(reviewer_user_profile_id is null)::text
from public.supplier_ownership_claims where id='$candidateClaim'::uuid;
"@).Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($candidateState -eq 'submitted/1/true') 'candidate-loss denial leaves no assignment'

  # 7. Supplier-conflict writer wins under the Supplier lock.
  $conflictClaim = 'b1000000-0000-4000-8000-000000001008'
  $conflictSupplier = 'b1000000-0000-4000-8000-000000000208'
  $conflictKey = 'claim-b0000000-0000-4000-8000-000000000061'
  $conflictReservation = Get-JsonResult (Invoke-AssignmentReservation $ownerOne $conflictKey $conflictClaim 1 $adminOne) 'Supplier-conflict reservation'
  $conflictWriter = @"
begin;
select pg_catalog.pg_advisory_xact_lock(
  claim_security.claim_supplier_lock_key_v1('$conflictSupplier')
);
select id from public.supplier_profiles where id='$conflictSupplier'::uuid for update;
select id from public.supplier_ownerships
where supplier_profile_id='$conflictSupplier'::uuid order by id for update;
select id from public.supplier_ownership_claims
where supplier_profile_id='$conflictSupplier'::uuid order by id for update;
insert into public.supplier_ownerships(
  id, supplier_profile_id, controller_user_profile_id,
  establishment_source_type, establishment_reason_code,
  establishment_system_source, valid_from, established_at, created_at, updated_at
) values (
  'b2000000-0000-4000-8000-000000000001'::uuid,
  '$conflictSupplier'::uuid, '$adminOne'::uuid,
  'legacy_reconciliation', 'assignment_race',
  'assignment_race', pg_catalog.statement_timestamp()-interval '1 day',
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp()
);
select pg_catalog.pg_sleep(3);
commit;
"@
  $conflictResults = Invoke-ConcurrentSql (New-AssignmentSql $ownerOne $conflictKey $conflictClaim 1 $adminOne $conflictReservation.execution_fence) 'select 1;' $conflictWriter
  Assert-True ($conflictResults[0].ExitCode -ne 0 -and
    $conflictResults[0].Text -match 'P5113.*claim_not_actionable') 'active ownership established first is re-read under Supplier serialization'
  $conflictState = (Invoke-Psql -Label 'Supplier-conflict state' -Sql @"
select status||'/'||record_version||'/'||(reviewer_user_profile_id is null)::text||'/'||
 (select count(*) from internal.domain_events where aggregate_id='$conflictClaim'::uuid)
from public.supplier_ownership_claims where id='$conflictClaim'::uuid;
"@).Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($conflictState -eq 'submitted/1/true/0') 'Supplier-conflict race leaves Claim unassigned with no event'

  $global = (Invoke-Psql -Label 'global assignment effects' -Sql @"
select
  (select count(*) from public.supplier_ownership_claims where status='under_review')||'/'||
  (select count(*) from internal.domain_events
   where event_type='supplier_ownership.claim_under_review')||'/'||
  (select count(*) from internal.audit_logs
   where action_code='supplier_claim.assign_reviewer' and outcome_class='succeeded')||'/'||
  (select count(*) from internal.domain_events
   where event_type='supplier_ownership.claim_under_review'
     and payload ? 'reviewer_user_profile_id');
"@).Output | Where-Object { $_ -match '^\d+/\d+/\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($global -match '^([23])/\1/\1/0$') 'all races preserve equal assignment/event/success-audit totals and no reviewer event leak'

  $stopwatch.Stop()
  Write-Output ("Claim assign-reviewer concurrency validation passed: {0} checks; true sessions prove different-key, same-key, candidate-swap, withdraw, expiry, authority-loss, candidate-loss, and Supplier-conflict serialization; {1:n1}s elapsed." -f $checks.Count, $stopwatch.Elapsed.TotalSeconds)
}
finally {
  if ($containerStarted) { docker rm --force $containerName *> $null }
}
