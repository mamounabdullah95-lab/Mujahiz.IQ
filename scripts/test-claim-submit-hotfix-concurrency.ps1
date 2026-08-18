[CmdletBinding()]
param([string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
. (Join-Path $PSScriptRoot 'claim-owner-role-provisioner.ps1')
. (Join-Path $PSScriptRoot 'claim-authorization-finalizer.ps1')
$b4MigrationName = '20260817000100_claim_rls_authorization_foundation.sql'
$containerName = "mujahiz-claim-hotfix-concurrency-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
$containerStarted = $false
$checks = [System.Collections.Generic.List[string]]::new()
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "Assertion failed: $Message" }
  $script:checks.Add($Message)
}

function Invoke-Psql {
  param(
    [string]$Sql,
    [string]$Label,
    [switch]$AllowFailure
  )

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
  if ($Invocation.ExitCode -ne 0) { throw "$Label unexpectedly failed.$([Environment]::NewLine)$($Invocation.Text)" }
  $jsonLine = @($Invocation.Output | Where-Object { $_ -match '^\{' } | Select-Object -Last 1)
  if ($jsonLine.Count -ne 1) { throw "$Label returned no unique JSON result.$([Environment]::NewLine)$($Invocation.Text)" }
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

function Invoke-Reservation {
  param(
    [string]$PrincipalId,
    [string]$Key,
    [string]$SupplierId,
    [string]$Reason,
    [switch]$AllowFailure
  )
  $body = @"
select pg_catalog.row_to_json(reservation_row)::text
from supplier_claim.reserve_submit(
  '$Key', '$SupplierId', '$Reason',
  'claim_evidence_v1', '[]'::jsonb, null
) as reservation_row;
"@
  Invoke-Psql -Sql (New-RuntimeSql -PrincipalId $PrincipalId -Body $body) -Label "reserve $Key" -AllowFailure:$AllowFailure
}

function New-SubmitSql {
  param(
    [string]$PrincipalId,
    [string]$Key,
    [string]$SupplierId,
    [string]$Reason,
    [string]$Fence
  )
  $body = @"
select pg_catalog.row_to_json(result_row)::text
from supplier_claim.submit(
  '$Key', '$SupplierId', '$Reason',
  'claim_evidence_v1', '[]'::jsonb, null, null, '$Fence'::uuid
) as result_row;
"@
  New-RuntimeSql -PrincipalId $PrincipalId -Body $body
}

function Invoke-Submit {
  param(
    [string]$PrincipalId,
    [string]$Key,
    [string]$SupplierId,
    [string]$Reason,
    [string]$Fence,
    [switch]$AllowFailure
  )
  Invoke-Psql -Sql (New-SubmitSql -PrincipalId $PrincipalId -Key $Key -SupplierId $SupplierId -Reason $Reason -Fence $Fence) -Label "submit $Key" -AllowFailure:$AllowFailure
}

function Get-SlotId {
  param([string]$PrincipalId, [string]$SupplierId)
  $sql = @"
with slot_hash as (
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to('supplier-claim-slot-v1|$PrincipalId|$SupplierId', 'UTF8'),
      'sha256'
    ),
    'hex'
  ) as value
)
select (
  pg_catalog.substr(value, 1, 8) || '-'
  || pg_catalog.substr(value, 9, 4) || '-5'
  || pg_catalog.substr(value, 14, 3) || '-8'
  || pg_catalog.substr(value, 18, 3) || '-'
  || pg_catalog.substr(value, 21, 12)
)::uuid::text
from slot_hash;
"@
  $invocation = Invoke-Psql -Sql $sql -Label 'derive deterministic Claim slot'
  @($invocation.Output | Where-Object { $_ -match '^[0-9a-f-]{36}$' } | Select-Object -Last 1)[0]
}

function Expire-Lease {
  param([string]$SlotId)
  Invoke-Psql -Label "age lease for $SlotId" -Sql @"
update internal.idempotency_keys
set lease_expires_at = pg_catalog.clock_timestamp() - interval '1 millisecond'
where environment_code = 'local'
  and command_name = 'supplier_claim.submit'
  and command_contract_version = 1
  and target_aggregate_id = '$SlotId'::uuid
  and status = 'processing';
"@ | Out-Null
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
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output; Text = $output -join [Environment]::NewLine }
  }

  $blocker = Start-Job -ScriptBlock $jobScript -ArgumentList $dockerPath, $containerName, $BlockSql
  Start-Sleep -Milliseconds 500
  $jobOne = Start-Job -ScriptBlock $jobScript -ArgumentList $dockerPath, $containerName, $SqlOne
  $jobTwo = Start-Job -ScriptBlock $jobScript -ArgumentList $dockerPath, $containerName, $SqlTwo
  $jobs = @($jobOne, $jobTwo)
  try {
    Wait-Job -Job $jobs -Timeout 20 | Out-Null
    Wait-Job -Job $blocker -Timeout 20 | Out-Null
    if (@($jobs | Where-Object State -ne 'Completed').Count -gt 0) {
      throw 'Concurrent SQL sessions did not finish within 20 seconds.'
    }
    @($jobs | ForEach-Object { Receive-Job -Job $_ })
  }
  finally {
    Remove-Job -Job ($jobs + $blocker) -Force -ErrorAction SilentlyContinue
  }
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required but was not found on PATH.' }
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
    if ($databaseReady -and -not $initializationInProgress) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'Disposable PostgreSQL readiness check failed.' }
  Start-Sleep -Seconds 1

  Invoke-Psql -Label 'Supabase local-role bootstrap' -Sql @'
create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;
end
$$;
'@ | Out-Null

  Invoke-ClaimOwnerRoleProvisioner -ContainerName $containerName | Out-Null
  foreach ($migration in @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)) {
    $arguments = @(
      'exec', $containerName, 'psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
      '--username=postgres', '--dbname=postgres', '--quiet',
      '--file', "/workspace/supabase/migrations/$($migration.Name)"
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

  Invoke-Psql -Label 'synthetic fixture setup' -Sql @'
insert into public.user_profiles (
  id, full_name, account_context, verification_mirror_status,
  verification_mirror_observed_at, display_email
)
values
  ('ca100000-0000-4000-8000-000000000001', 'Concurrent Claimant A', 'supplier', 'verified', pg_catalog.statement_timestamp(), 'concurrent-a@example.test'),
  ('cb200000-0000-4000-8000-000000000002', 'Concurrent Claimant B', 'supplier', 'verified', pg_catalog.statement_timestamp(), 'concurrent-b@example.test');

insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject,
  is_primary, link_status, identity_status, verification_status,
  linked_at, provider_state_observed_at, verified_at
)
values
  ('ca110000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001', 'firebase', 'synthetic-concurrency-a', true, 'linked', 'active', 'verified', pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()),
  ('cb220000-0000-4000-8000-000000000002', 'cb200000-0000-4000-8000-000000000002', 'firebase', 'synthetic-concurrency-b', true, 'linked', 'active', 'verified', pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp());

insert into public.supplier_profiles (
  id, name_original, display_name, name_language, name_en,
  business_type, listing_status, verification_status,
  source_type, confidence_level, has_direct_experience
)
values
  ('c1000000-0000-4000-8000-000000000001', 'Same Pair Race Supplier', 'Same Pair Race Supplier', 'english', 'Same Pair Race Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('c1000000-0000-4000-8000-000000000002', 'Different Claimant Race Supplier', 'Different Claimant Race Supplier', 'english', 'Different Claimant Race Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('c1000000-0000-4000-8000-000000000003', 'Lease Visibility Supplier', 'Lease Visibility Supplier', 'english', 'Lease Visibility Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('c1000000-0000-4000-8000-000000000004', 'Domain Failure Supplier', 'Domain Failure Supplier', 'english', 'Domain Failure Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no'),
  ('c1000000-0000-4000-8000-000000000005', 'Attempt Limit Supplier', 'Attempt Limit Supplier', 'english', 'Attempt Limit Supplier', 'company', 'approved', 'verified', 'other', 'low', 'no');

grant mujahiz_claim_runtime to postgres with set true;
'@ | Out-Null

  $principalA = 'ca100000-0000-4000-8000-000000000001'
  $principalB = 'cb200000-0000-4000-8000-000000000002'
  $sameSupplier = 'c1000000-0000-4000-8000-000000000001'
  $sameReasonOne = 'First concurrent same-pair submission from the eligible claimant.'
  $sameReasonTwo = 'Second concurrent same-pair submission from the eligible claimant.'
  $sameKeyOne = 'claim-c0000000-0000-4000-8000-000000000001'
  $sameKeyTwo = 'claim-c0000000-0000-4000-8000-000000000002'

  $sameReservationOne = Get-JsonResult (Invoke-Reservation $principalA $sameKeyOne $sameSupplier $sameReasonOne) 'same-pair reservation one'
  $sameReservationTwo = Get-JsonResult (Invoke-Reservation $principalA $sameKeyTwo $sameSupplier $sameReasonTwo) 'same-pair reservation two'
  Assert-True ($sameReservationOne.reservation_outcome -eq 'execute' -and $sameReservationTwo.reservation_outcome -eq 'execute') 'same-pair phase-1 reservations commit independently'

  $principalBlock = "begin; select pg_catalog.pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$principalA')); select pg_catalog.pg_sleep(3); commit;"
  $sameResults = Invoke-ConcurrentSql `
    (New-SubmitSql $principalA $sameKeyOne $sameSupplier $sameReasonOne $sameReservationOne.execution_fence) `
    (New-SubmitSql $principalA $sameKeyTwo $sameSupplier $sameReasonTwo $sameReservationTwo.execution_fence) `
    $principalBlock
  $sameSuccess = @($sameResults | Where-Object { $_.ExitCode -eq 0 })
  $sameFailure = @($sameResults | Where-Object { $_.ExitCode -ne 0 })
  Assert-True ($sameSuccess.Count -eq 1 -and $sameFailure.Count -eq 1) 'same-pair true race has exactly one success and one loser'
  Assert-True ($sameFailure[0].Text -match 'P5106.*active_claim_exists') 'same-pair true-race loser is P5106 active_claim_exists'
  $sameCounts = (Invoke-Psql -Label 'same-pair race counts' -Sql "select (select count(*) from public.supplier_ownership_claims where supplier_profile_id='$sameSupplier')||'/'||(select count(*) from internal.domain_events where payload->>'supplier_profile_id'='$sameSupplier')||'/'||(select count(*) from internal.idempotency_keys where target_aggregate_id='$(Get-SlotId $principalA $sameSupplier)'::uuid);").Output | Where-Object { $_ -match '^\d+/\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($sameCounts -eq '1/1/2') 'same-pair race retains one Claim, one event, and both durable reservations'

  $differentSupplier = 'c1000000-0000-4000-8000-000000000002'
  $differentKeyA = 'claim-c0000000-0000-4000-8000-000000000011'
  $differentKeyB = 'claim-c0000000-0000-4000-8000-000000000012'
  $differentReasonA = 'Concurrent submission from the first independently eligible claimant.'
  $differentReasonB = 'Concurrent submission from the second independently eligible claimant.'
  $differentReservationA = Get-JsonResult (Invoke-Reservation $principalA $differentKeyA $differentSupplier $differentReasonA) 'different-claimant reservation A'
  $differentReservationB = Get-JsonResult (Invoke-Reservation $principalB $differentKeyB $differentSupplier $differentReasonB) 'different-claimant reservation B'
  $supplierBlock = "begin; select pg_catalog.pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$differentSupplier')); select pg_catalog.pg_sleep(3); commit;"
  $differentResults = Invoke-ConcurrentSql `
    (New-SubmitSql $principalA $differentKeyA $differentSupplier $differentReasonA $differentReservationA.execution_fence) `
    (New-SubmitSql $principalB $differentKeyB $differentSupplier $differentReasonB $differentReservationB.execution_fence) `
    $supplierBlock
  Assert-True (@($differentResults | Where-Object ExitCode -ne 0).Count -eq 0) 'different claimants may submit the same eligible Supplier concurrently'
  $differentCounts = (Invoke-Psql -Label 'different-claimant race counts' -Sql "select (select count(*) from public.supplier_ownership_claims where supplier_profile_id='$differentSupplier')||'/'||(select count(*) from internal.domain_events where payload->>'supplier_profile_id'='$differentSupplier');").Output | Where-Object { $_ -match '^\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($differentCounts -eq '2/2') 'different-claimant race retains two claimant-distinct Claims and two events'

  $visibilitySupplier = 'c1000000-0000-4000-8000-000000000003'
  $visibilityKey = 'claim-c0000000-0000-4000-8000-000000000021'
  $visibilityReason = 'Durable committed reservation visibility and reclaim verification.'
  $visibilityOne = Get-JsonResult (Invoke-Reservation $principalA $visibilityKey $visibilitySupplier $visibilityReason) 'visibility reservation'
  $inProgressTimer = [System.Diagnostics.Stopwatch]::StartNew()
  $inProgress = Invoke-Reservation $principalA $visibilityKey $visibilitySupplier $visibilityReason -AllowFailure
  $inProgressTimer.Stop()
  Assert-True ($inProgress.ExitCode -ne 0 -and $inProgress.Text -match 'P5109.*command_in_progress') 'another session observes the committed unexpired lease as command_in_progress'
  Assert-True ($inProgressTimer.Elapsed.TotalSeconds -lt 5) 'unexpired reservation response is bounded without hidden lock wait'
  $visibilitySlot = Get-SlotId $principalA $visibilitySupplier
  $visibleAttempt = (Invoke-Psql -Label 'visible reservation state' -Sql "select status||'/'||attempt_count from internal.idempotency_keys where target_aggregate_id='$visibilitySlot'::uuid;").Output | Where-Object { $_ -match '^processing/\d+$' } | Select-Object -Last 1
  Assert-True ($visibleAttempt -eq 'processing/1') 'phase-1 processing attempt is durable and visible'
  Expire-Lease $visibilitySlot
  $visibilityTwo = Get-JsonResult (Invoke-Reservation $principalA $visibilityKey $visibilitySupplier $visibilityReason) 'visibility reclaim'
  Assert-True ($visibilityTwo.execution_fence -ne $visibilityOne.execution_fence) 'expired lease reclaim issues a new execution fence'
  $visibilityAttemptTwo = (Invoke-Psql -Label 'reclaimed reservation state' -Sql "select attempt_count::text from internal.idempotency_keys where target_aggregate_id='$visibilitySlot'::uuid;").Output | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
  Assert-True ($visibilityAttemptTwo -eq '2') 'reclaim durably increments attempt_count'
  $staleVisibility = Invoke-Submit $principalA $visibilityKey $visibilitySupplier $visibilityReason $visibilityOne.execution_fence -AllowFailure
  Assert-True ($staleVisibility.ExitCode -ne 0 -and $staleVisibility.Text -match 'P5109.*command_in_progress') 'stale phase-2 execution cannot commit after reclaim'
  $visibilitySuccess = Get-JsonResult (Invoke-Submit $principalA $visibilityKey $visibilitySupplier $visibilityReason $visibilityTwo.execution_fence) 'reclaimed visibility submit'
  Assert-True ($visibilitySuccess.outcome_code -eq 'submitted') 'current reclaimed fence completes successfully'

  $failureSupplier = 'c1000000-0000-4000-8000-000000000004'
  $failureKey = 'claim-c0000000-0000-4000-8000-000000000031'
  $failureReason = 'Durable reservation survives a synthetic domain-event failure.'
  $failureReservation = Get-JsonResult (Invoke-Reservation $principalA $failureKey $failureSupplier $failureReason) 'domain-failure reservation'
  Invoke-Psql -Label 'install domain-event fault injection' -Sql @'
create function public.claim_submit_hotfix_reject_event_test()
returns trigger
language plpgsql
as $$
begin
  if new.producer_command_name = 'supplier_claim.submit' then
    raise exception 'synthetic claim submit event failure';
  end if;
  return new;
end
$$;
create trigger claim_submit_hotfix_event_failure_test
before insert on internal.domain_events
for each row execute function public.claim_submit_hotfix_reject_event_test();
'@ | Out-Null
  $domainFailure = Invoke-Submit $principalA $failureKey $failureSupplier $failureReason $failureReservation.execution_fence -AllowFailure
  Assert-True ($domainFailure.ExitCode -ne 0 -and $domainFailure.Text -match 'P5199.*integrity_reconciliation_required') 'domain-event failure rolls back phase 2 with P5199'
  Invoke-Psql -Label 'remove domain-event fault injection' -Sql @'
drop trigger claim_submit_hotfix_event_failure_test on internal.domain_events;
drop function public.claim_submit_hotfix_reject_event_test();
'@ | Out-Null
  $failureSlot = Get-SlotId $principalA $failureSupplier
  $failureState = (Invoke-Psql -Label 'domain-failure durable state' -Sql "select status||'/'||attempt_count||'/'||(select count(*) from public.supplier_ownership_claims where supplier_profile_id='$failureSupplier')||'/'||(select count(*) from internal.domain_events where payload->>'supplier_profile_id'='$failureSupplier') from internal.idempotency_keys where target_aggregate_id='$failureSlot'::uuid;").Output | Where-Object { $_ -match '^processing/\d+/\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($failureState -eq 'processing/1/0/0') 'domain failure leaves the committed reservation and no Claim/event'
  Expire-Lease $failureSlot
  $failureRetry = Get-JsonResult (Invoke-Reservation $principalA $failureKey $failureSupplier $failureReason) 'domain-failure retry reservation'
  $staleFailure = Invoke-Submit $principalA $failureKey $failureSupplier $failureReason $failureReservation.execution_fence -AllowFailure
  Assert-True ($staleFailure.ExitCode -ne 0 -and $staleFailure.Text -match 'P5109.*command_in_progress') 'domain-failure stale fence remains denied after reclaim'
  $failureSuccess = Get-JsonResult (Invoke-Submit $principalA $failureKey $failureSupplier $failureReason $failureRetry.execution_fence) 'domain-failure retry submit'
  Assert-True ($failureSuccess.outcome_code -eq 'submitted') 'retry under the current fence succeeds after domain rollback'
  $failureReplay = Get-JsonResult (Invoke-Reservation $principalA $failureKey $failureSupplier $failureReason) 'completed replay'
  Assert-True ($failureReplay.reservation_outcome -eq 'replay' -and $failureReplay.claim_id -eq $failureSuccess.claim_id -and $failureReplay.claim_status -eq 'submitted' -and $failureReplay.claim_version -eq 1 -and $failureReplay.idempotent_replay) 'completed request replays the immutable original submit result'
  $keyConflict = Invoke-Reservation $principalA $failureKey $failureSupplier 'Materially different request under the already completed key.' -AllowFailure
  Assert-True ($keyConflict.ExitCode -ne 0 -and $keyConflict.Text -match 'P5108.*idempotency_key_conflict') 'same key with a different canonical request returns P5108'
  $failureCounts = (Invoke-Psql -Label 'retry duplicate counts' -Sql "select (select count(*) from public.supplier_ownership_claims where supplier_profile_id='$failureSupplier')||'/'||(select count(*) from internal.domain_events where payload->>'supplier_profile_id'='$failureSupplier');").Output | Where-Object { $_ -match '^\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($failureCounts -eq '1/1') 'rollback/reclaim/replay path creates no duplicate Claim or event'

  $attemptSupplier = 'c1000000-0000-4000-8000-000000000005'
  $attemptKey = 'claim-c0000000-0000-4000-8000-000000000041'
  $attemptReason = 'Durable attempt-limit terminal reconciliation verification.'
  $attemptReservation = Get-JsonResult (Invoke-Reservation $principalA $attemptKey $attemptSupplier $attemptReason) 'attempt one reservation'
  $attemptSlot = Get-SlotId $principalA $attemptSupplier
  for ($attempt = 2; $attempt -le 10; $attempt++) {
    Expire-Lease $attemptSlot
    $attemptReservation = Get-JsonResult (Invoke-Reservation $principalA $attemptKey $attemptSupplier $attemptReason) "attempt $attempt reservation"
    $storedAttempt = (Invoke-Psql -Label "attempt $attempt state" -Sql "select attempt_count::text from internal.idempotency_keys where target_aggregate_id='$attemptSlot'::uuid;").Output | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
    Assert-True ([int]$storedAttempt -eq $attempt) "attempt $attempt is durably fenced"
  }
  Expire-Lease $attemptSlot
  $attemptTerminal = Get-JsonResult (Invoke-Reservation $principalA $attemptKey $attemptSupplier $attemptReason) 'attempt-limit terminalization'
  Assert-True ($attemptTerminal.reservation_outcome -eq 'reconciliation_required' -and -not $attemptTerminal.execution_fence) 'expired attempt 10 terminalizes to bounded reconciliation state'
  $terminalState = (Invoke-Psql -Label 'attempt-limit terminal state' -Sql "select status||'/'||attempt_count||'/'||failure_code||'/'||retry_disposition||'/'||(lease_token_digest is null)::text from internal.idempotency_keys where target_aggregate_id='$attemptSlot'::uuid;").Output | Where-Object { $_ -match '^failed/' } | Select-Object -Last 1
  Assert-True ($terminalState -eq 'failed/10/attempt_limit_exceeded/terminal/true') 'attempt-limit terminal state is durable and clears its lease'
  $attemptTerminalReplay = Get-JsonResult (Invoke-Reservation $principalA $attemptKey $attemptSupplier $attemptReason) 'attempt-limit stable replay'
  Assert-True ($attemptTerminalReplay.reservation_outcome -eq 'reconciliation_required') 'terminal reconciliation behavior is stable on later reservations'
  $terminalStateAgain = (Invoke-Psql -Label 'stable attempt-limit state' -Sql "select status||'/'||attempt_count||'/'||failure_code||'/'||retry_disposition from internal.idempotency_keys where target_aggregate_id='$attemptSlot'::uuid;").Output | Where-Object { $_ -match '^failed/' } | Select-Object -Last 1
  Assert-True ($terminalStateAgain -eq 'failed/10/attempt_limit_exceeded/terminal') 'terminal reservation does not return retry_later or increment forever'

  $globalCounts = (Invoke-Psql -Label 'global hotfix effect counts' -Sql "select (select count(*) from public.supplier_ownership_claims)||(select '/'||count(*) from internal.domain_events)||(select '/'||count(*) from internal.audit_logs);").Output | Where-Object { $_ -match '^\d+/\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($globalCounts -eq '5/5/0') 'all concurrency/retry paths retain exactly five Claims, five events, and zero audits'

  $stopwatch.Stop()
  Write-Output ("Claim submit concurrency validation passed: {0} checks; same-pair=P5106 with 1 Claim/1 event; different-claimants=2 Claims/2 events; attempt-limit=failed terminal at 10; {1:n1}s elapsed." -f $checks.Count, $stopwatch.Elapsed.TotalSeconds)
}
finally {
  if ($containerStarted) { docker rm --force $containerName *> $null }
}
