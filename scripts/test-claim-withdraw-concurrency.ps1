[CmdletBinding()]
param([string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
$containerName = "mujahiz-claim-withdraw-concurrency-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
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
  [pscustomobject]@{ ExitCode = $exitCode; Output = $output; Text = $output -join [Environment]::NewLine }
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
  param([string]$PrincipalId, [string]$Key, [string]$ClaimId, [int]$ExpectedVersion, [switch]$AllowFailure)
  $body = @"
select pg_catalog.row_to_json(reservation_row)::text
from supplier_claim.reserve_withdraw('$Key', '$ClaimId', $ExpectedVersion) as reservation_row;
"@
  Invoke-Psql -Sql (New-RuntimeSql -PrincipalId $PrincipalId -Body $body) -Label "reserve $Key" -AllowFailure:$AllowFailure
}

function New-WithdrawSql {
  param([string]$PrincipalId, [string]$Key, [string]$ClaimId, [int]$ExpectedVersion, [string]$Fence)
  $body = @"
select pg_catalog.row_to_json(result_row)::text
from supplier_claim.withdraw('$Key', '$ClaimId', $ExpectedVersion, null, '$Fence'::uuid) as result_row;
"@
  New-RuntimeSql -PrincipalId $PrincipalId -Body $body
}

function Invoke-Withdraw {
  param([string]$PrincipalId, [string]$Key, [string]$ClaimId, [int]$ExpectedVersion, [string]$Fence, [switch]$AllowFailure)
  Invoke-Psql -Sql (New-WithdrawSql $PrincipalId $Key $ClaimId $ExpectedVersion $Fence) -Label "withdraw $Key" -AllowFailure:$AllowFailure
}

function Expire-Lease {
  param([string]$ClaimId)
  Invoke-Psql -Label "age lease for $ClaimId" -Sql @"
update internal.idempotency_keys
set lease_expires_at = pg_catalog.clock_timestamp() - interval '1 millisecond'
where environment_code = 'local'
  and command_name = 'supplier_claim.withdraw'
  and command_contract_version = 1
  and target_aggregate_id = '$ClaimId'::uuid
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
    if (@($jobs | Where-Object State -ne 'Completed').Count -gt 0 -or $blocker.State -ne 'Completed') {
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

  foreach ($migration in @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)) {
    $arguments = @('exec', $containerName, 'psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--username=postgres', '--dbname=postgres', '--quiet', '--file', "/workspace/supabase/migrations/$($migration.Name)")
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $migrationOutput = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
    $migrationExit = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($migrationExit -ne 0) { throw "Migration $($migration.Name) failed.$([Environment]::NewLine)$($migrationOutput -join [Environment]::NewLine)" }
  }

  Invoke-Psql -Label 'synthetic fixture setup' -Sql @'
insert into public.user_profiles (
  id, full_name, account_context, verification_mirror_status,
  verification_mirror_observed_at, display_email
)
values
  ('ca100000-0000-4000-8000-000000000001', 'Withdraw Claimant', 'supplier', 'verified', pg_catalog.statement_timestamp(), 'withdraw@example.test'),
  ('cc300000-0000-4000-8000-000000000003', 'Synthetic Reviewer', 'buyer', 'verified', pg_catalog.statement_timestamp(), 'reviewer@example.test');

insert into internal.identity_provider_links (
  id, user_profile_id, provider_code, provider_subject,
  is_primary, link_status, identity_status, verification_status,
  linked_at, provider_state_observed_at, verified_at
)
values (
  'ca110000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000001',
  'firebase', 'synthetic-withdraw-claimant', true,
  'linked', 'active', 'verified',
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
);

insert into public.supplier_profiles (
  id, name_original, display_name, name_language, name_en,
  business_type, listing_status, verification_status,
  source_type, confidence_level, has_direct_experience
)
select
  fixture.supplier_id,
  'Withdraw Race Supplier ' || fixture.supplier_number,
  'Withdraw Race Supplier ' || fixture.supplier_number,
  'english', 'Withdraw Race Supplier ' || fixture.supplier_number,
  'company', 'approved', 'verified', 'other', 'low', 'no'
from (
  values
    (1, 'c2000001-0000-4000-8000-000000000001'::uuid),
    (2, 'c2000002-0000-4000-8000-000000000002'::uuid),
    (3, 'c2000003-0000-4000-8000-000000000003'::uuid),
    (4, 'c2000004-0000-4000-8000-000000000004'::uuid),
    (5, 'c2000005-0000-4000-8000-000000000005'::uuid),
    (6, 'c2000006-0000-4000-8000-000000000006'::uuid),
    (7, 'c2000007-0000-4000-8000-000000000007'::uuid),
    (8, 'c2000008-0000-4000-8000-000000000008'::uuid)
) as fixture(supplier_number, supplier_id);

insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status, record_version,
  submitted_at, expires_at, submitted_reason,
  claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors, created_at, updated_at
)
select
  fixture.claim_id, 'ca100000-0000-4000-8000-000000000001', fixture.supplier_id,
  'submitted', 1, fixture.submitted_at, fixture.expires_at, fixture.reason,
  'claimant_snapshot_v1', '{}'::jsonb, 'claim_submit_v1', repeat('f', 64),
  'claim_evidence_v1', '[]'::jsonb, fixture.submitted_at, fixture.submitted_at
from (
  values
    ('f1000001-0000-4000-8000-000000000001'::uuid, 'c2000001-0000-4000-8000-000000000001'::uuid, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Concurrent withdraw race Claim.'),
    ('f1000002-0000-4000-8000-000000000002'::uuid, 'c2000002-0000-4000-8000-000000000002'::uuid, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Lease visibility and reclaim Claim.'),
    ('f1000003-0000-4000-8000-000000000003'::uuid, 'c2000003-0000-4000-8000-000000000003'::uuid, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Event rollback and retry Claim.'),
    ('f1000004-0000-4000-8000-000000000004'::uuid, 'c2000004-0000-4000-8000-000000000004'::uuid, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Attempt exhaustion Claim.'),
    ('f1000005-0000-4000-8000-000000000005'::uuid, 'c2000005-0000-4000-8000-000000000005'::uuid, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Reviewer assignment serialization Claim.'),
    ('f1000006-0000-4000-8000-000000000006'::uuid, 'c2000006-0000-4000-8000-000000000006'::uuid, pg_catalog.statement_timestamp() - interval '721 hours', pg_catalog.statement_timestamp() - interval '1 hour', 'Expiry writer serialization Claim.'),
    ('f1000007-0000-4000-8000-000000000007'::uuid, 'c2000007-0000-4000-8000-000000000007'::uuid, pg_catalog.statement_timestamp() - interval '721 hours', pg_catalog.statement_timestamp() - interval '1 hour', 'Due without expiry writer Claim.'),
    ('f1000008-0000-4000-8000-000000000008'::uuid, 'c2000008-0000-4000-8000-000000000008'::uuid, pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() + interval '719 hours', 'Eligibility loss serialization Claim.')
) as fixture(claim_id, supplier_id, submitted_at, expires_at, reason);

grant mujahiz_claim_runtime to postgres with set true;
'@ | Out-Null

  $principal = 'ca100000-0000-4000-8000-000000000001'
  $reviewer = 'cc300000-0000-4000-8000-000000000003'

  $raceClaim = 'f1000001-0000-4000-8000-000000000001'
  $raceKeyOne = 'claim-d0000000-0000-4000-8000-000000000001'
  $raceKeyTwo = 'claim-d0000000-0000-4000-8000-000000000002'
  $raceOne = Get-JsonResult (Invoke-Reservation $principal $raceKeyOne $raceClaim 1) 'race reservation one'
  $raceTwo = Get-JsonResult (Invoke-Reservation $principal $raceKeyTwo $raceClaim 1) 'race reservation two'
  Assert-True ($raceOne.reservation_outcome -eq 'execute' -and $raceTwo.reservation_outcome -eq 'execute') 'same-Claim phase-A reservations commit independently'
  $principalBlock = "begin; select pg_catalog.pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$principal')); select pg_catalog.pg_sleep(3); commit;"
  $raceResults = Invoke-ConcurrentSql `
    (New-WithdrawSql $principal $raceKeyOne $raceClaim 1 $raceOne.execution_fence) `
    (New-WithdrawSql $principal $raceKeyTwo $raceClaim 1 $raceTwo.execution_fence) `
    $principalBlock
  $raceSuccess = @($raceResults | Where-Object ExitCode -eq 0)
  $raceFailure = @($raceResults | Where-Object ExitCode -ne 0)
  Assert-True ($raceSuccess.Count -eq 1 -and $raceFailure.Count -eq 1) 'same-Claim true race has exactly one success and one loser'
  Assert-True ($raceFailure[0].Text -match 'P5112.*claim_version_conflict') 'same-Claim true-race loser is deterministic P5112 version conflict'
  $raceState = (Invoke-Psql -Label 'same-Claim race state' -Sql "select status||'/'||record_version||'/'||(select count(*) from internal.domain_events where aggregate_id='$raceClaim'::uuid and event_type='supplier_ownership.claim_withdrawn')||'/'||(select count(*) from internal.idempotency_keys where target_aggregate_id='$raceClaim'::uuid and status='completed') from public.supplier_ownership_claims where id='$raceClaim'::uuid;").Output | Where-Object { $_ -match '^withdrawn/' } | Select-Object -Last 1
  Assert-True ($raceState -eq 'withdrawn/2/1/1') 'same-Claim race commits one version and one withdrawal event/completion'
  $winnerIndex = if ($raceResults[0].ExitCode -eq 0) { 0 } else { 1 }
  $winnerKey = @($raceKeyOne, $raceKeyTwo)[$winnerIndex]
  $raceOriginal = Get-JsonResult $raceResults[$winnerIndex] 'race winner result'
  $raceReplay = Get-JsonResult (Invoke-Reservation $principal $winnerKey $raceClaim 1) 'race winner replay'
  Assert-True ($raceReplay.reservation_outcome -eq 'replay' -and $raceReplay.claim_version -eq 2 -and $raceReplay.withdrawn_at -eq $raceOriginal.withdrawn_at -and $raceReplay.idempotent_replay) 'winner replay returns the original immutable withdrawal result'

  $leaseClaim = 'f1000002-0000-4000-8000-000000000002'
  $leaseKey = 'claim-d0000000-0000-4000-8000-000000000011'
  $leaseOne = Get-JsonResult (Invoke-Reservation $principal $leaseKey $leaseClaim 1) 'lease reservation'
  $leaseTimer = [System.Diagnostics.Stopwatch]::StartNew()
  $inProgress = Invoke-Reservation $principal $leaseKey $leaseClaim 1 -AllowFailure
  $leaseTimer.Stop()
  Assert-True ($inProgress.ExitCode -ne 0 -and $inProgress.Text -match 'P5109.*command_in_progress') 'another session observes a committed unexpired reservation'
  Assert-True ($leaseTimer.Elapsed.TotalSeconds -lt 5) 'unexpired reservation response is bounded'
  $leaseAttemptOne = (Invoke-Psql -Label 'lease attempt one' -Sql "select status||'/'||attempt_count from internal.idempotency_keys where target_aggregate_id='$leaseClaim'::uuid;").Output | Where-Object { $_ -match '^processing/' } | Select-Object -Last 1
  Assert-True ($leaseAttemptOne -eq 'processing/1') 'phase-A attempt one is durable and visible'
  Expire-Lease $leaseClaim
  $leaseTwo = Get-JsonResult (Invoke-Reservation $principal $leaseKey $leaseClaim 1) 'lease reclaim'
  Assert-True ($leaseTwo.execution_fence -ne $leaseOne.execution_fence) 'expired lease reclaim rotates the opaque execution fence'
  $leaseAttemptTwo = (Invoke-Psql -Label 'lease attempt two' -Sql "select attempt_count::text from internal.idempotency_keys where target_aggregate_id='$leaseClaim'::uuid;").Output | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
  Assert-True ($leaseAttemptTwo -eq '2') 'reclaim durably increments attempt_count'
  $leaseStale = Invoke-Withdraw $principal $leaseKey $leaseClaim 1 $leaseOne.execution_fence -AllowFailure
  Assert-True ($leaseStale.ExitCode -ne 0 -and $leaseStale.Text -match 'P5109.*command_in_progress') 'stale phase-B fence is denied after reclaim'
  $leaseSuccess = Get-JsonResult (Invoke-Withdraw $principal $leaseKey $leaseClaim 1 $leaseTwo.execution_fence) 'reclaimed withdrawal'
  Assert-True ($leaseSuccess.outcome_code -eq 'withdrawn' -and $leaseSuccess.claim_version -eq 2) 'current reclaimed fence completes withdrawal once'

  $failureClaim = 'f1000003-0000-4000-8000-000000000003'
  $failureKey = 'claim-d0000000-0000-4000-8000-000000000021'
  $failureOne = Get-JsonResult (Invoke-Reservation $principal $failureKey $failureClaim 1) 'event-failure reservation'
  Invoke-Psql -Label 'install withdrawal event fault' -Sql @'
create function public.claim_withdraw_reject_event_test()
returns trigger language plpgsql as $$
begin
  if new.producer_command_name = 'supplier_claim.withdraw' then
    raise exception 'synthetic claim withdraw event failure';
  end if;
  return new;
end
$$;
create trigger claim_withdraw_event_failure_test
before insert on internal.domain_events
for each row execute function public.claim_withdraw_reject_event_test();
'@ | Out-Null
  $eventFailure = Invoke-Withdraw $principal $failureKey $failureClaim 1 $failureOne.execution_fence -AllowFailure
  Assert-True ($eventFailure.ExitCode -ne 0 -and $eventFailure.Text -match 'P5199.*integrity_reconciliation_required') 'event failure rolls back phase B with P5199'
  Invoke-Psql -Label 'remove withdrawal event fault' -Sql @'
drop trigger claim_withdraw_event_failure_test on internal.domain_events;
drop function public.claim_withdraw_reject_event_test();
'@ | Out-Null
  $failureState = (Invoke-Psql -Label 'event-failure durable state' -Sql "select claim_row.status||'/'||claim_row.record_version||'/'||key_row.status||'/'||key_row.attempt_count||'/'||(select count(*) from internal.domain_events where aggregate_id='$failureClaim'::uuid) from public.supplier_ownership_claims claim_row cross join internal.idempotency_keys key_row where claim_row.id='$failureClaim'::uuid and key_row.target_aggregate_id='$failureClaim'::uuid;").Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($failureState -eq 'submitted/1/processing/1/0') 'event rollback preserves Claim, durable reservation, and no event/completion'
  Expire-Lease $failureClaim
  $failureTwo = Get-JsonResult (Invoke-Reservation $principal $failureKey $failureClaim 1) 'event-failure reclaim'
  $failureStale = Invoke-Withdraw $principal $failureKey $failureClaim 1 $failureOne.execution_fence -AllowFailure
  Assert-True ($failureStale.ExitCode -ne 0 -and $failureStale.Text -match 'P5109.*command_in_progress') 'rollback attempt stale fence remains denied'
  $failureSuccess = Get-JsonResult (Invoke-Withdraw $principal $failureKey $failureClaim 1 $failureTwo.execution_fence) 'event-failure retry'
  Assert-True ($failureSuccess.outcome_code -eq 'withdrawn') 'approved reclaim/retry succeeds after event fault removal'
  $failureReplay = Get-JsonResult (Invoke-Reservation $principal $failureKey $failureClaim 1) 'event-failure completed replay'
  Assert-True ($failureReplay.reservation_outcome -eq 'replay' -and $failureReplay.withdrawn_at -eq $failureSuccess.withdrawn_at) 'retry result replays its original committed timestamp'
  $failureCounts = (Invoke-Psql -Label 'event retry counts' -Sql "select record_version||'/'||(select count(*) from internal.domain_events where aggregate_id='$failureClaim'::uuid and event_type='supplier_ownership.claim_withdrawn') from public.supplier_ownership_claims where id='$failureClaim'::uuid;").Output | Where-Object { $_ -match '^\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($failureCounts -eq '2/1') 'rollback/reclaim/replay creates one version increment and one event'

  $attemptClaim = 'f1000004-0000-4000-8000-000000000004'
  $attemptKey = 'claim-d0000000-0000-4000-8000-000000000031'
  $attemptReservation = Get-JsonResult (Invoke-Reservation $principal $attemptKey $attemptClaim 1) 'attempt one reservation'
  for ($attempt = 2; $attempt -le 10; $attempt++) {
    Expire-Lease $attemptClaim
    $attemptReservation = Get-JsonResult (Invoke-Reservation $principal $attemptKey $attemptClaim 1) "attempt $attempt reservation"
    $storedAttempt = (Invoke-Psql -Label "attempt $attempt state" -Sql "select attempt_count::text from internal.idempotency_keys where target_aggregate_id='$attemptClaim'::uuid;").Output | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
    Assert-True ([int]$storedAttempt -eq $attempt) "attempt $attempt is durably fenced"
  }
  Expire-Lease $attemptClaim
  $attemptTerminal = Get-JsonResult (Invoke-Reservation $principal $attemptKey $attemptClaim 1) 'attempt terminalization'
  Assert-True ($attemptTerminal.reservation_outcome -eq 'reconciliation_required' -and -not $attemptTerminal.execution_fence) 'expired attempt ten terminalizes to reconciliation_required'
  $attemptState = (Invoke-Psql -Label 'attempt terminal state' -Sql "select status||'/'||attempt_count||'/'||failure_code||'/'||retry_disposition||'/'||(lease_token_digest is null)::text from internal.idempotency_keys where target_aggregate_id='$attemptClaim'::uuid;").Output | Where-Object { $_ -match '^failed/' } | Select-Object -Last 1
  Assert-True ($attemptState -eq 'failed/10/attempt_limit_exceeded/terminal/true') 'attempt terminal state is durable and clears the lease'
  $attemptReplay = Get-JsonResult (Invoke-Reservation $principal $attemptKey $attemptClaim 1) 'attempt terminal replay'
  Assert-True ($attemptReplay.reservation_outcome -eq 'reconciliation_required') 'terminal reconciliation behavior remains stable'

  $assignmentClaim = 'f1000005-0000-4000-8000-000000000005'
  $assignmentSupplier = 'c2000005-0000-4000-8000-000000000005'
  $assignmentKeyOne = 'claim-d0000000-0000-4000-8000-000000000041'
  $assignmentOne = Get-JsonResult (Invoke-Reservation $principal $assignmentKeyOne $assignmentClaim 1) 'assignment-race reservation'
  $assignmentWriter = @"
begin;
select pg_catalog.pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$principal'));
select pg_catalog.pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$assignmentSupplier'));
select id from public.user_profiles where id in ('$principal'::uuid) order by id for update;
select id from internal.identity_provider_links where user_profile_id in ('$principal'::uuid) order by id for update;
select id from public.supplier_profiles where id='$assignmentSupplier'::uuid for update;
select id from public.supplier_ownerships where supplier_profile_id='$assignmentSupplier'::uuid order by id for update;
select id from public.supplier_ownership_claims where id='$assignmentClaim'::uuid for update;
update public.supplier_ownership_claims
set status='under_review', record_version=2,
    reviewer_user_profile_id='$reviewer'::uuid, reviewer_assignment_version=1,
    reviewer_assigned_at=pg_catalog.clock_timestamp(), reviewer_assigned_by_user_profile_id='$reviewer'::uuid,
    reviewer_assignment_source_code='manual', reviewer_assignment_policy_version='claim_review_assignment_v1',
    updated_at=pg_catalog.clock_timestamp()
where id='$assignmentClaim'::uuid;
select pg_catalog.pg_sleep(3);
commit;
"@
  $assignmentResults = Invoke-ConcurrentSql `
    (New-WithdrawSql $principal $assignmentKeyOne $assignmentClaim 1 $assignmentOne.execution_fence) `
    'select 1;' $assignmentWriter
  Assert-True ($assignmentResults[0].ExitCode -ne 0 -and $assignmentResults[0].Text -match 'P5112.*claim_version_conflict') 'future reviewer assignment serializes before withdrawal as version conflict'
  $assignmentState = (Invoke-Psql -Label 'assignment race state' -Sql "select status||'/'||record_version||'/'||reviewer_assignment_version||'/'||reviewer_assignment_source_code from public.supplier_ownership_claims where id='$assignmentClaim'::uuid;").Output | Where-Object { $_ -match '^under_review/' } | Select-Object -Last 1
  Assert-True ($assignmentState -eq 'under_review/2/1/manual') 'assignment race retains authoritative reviewer provenance'
  $assignmentKeyTwo = 'claim-d0000000-0000-4000-8000-000000000042'
  $assignmentTwo = Get-JsonResult (Invoke-Reservation $principal $assignmentKeyTwo $assignmentClaim 2) 'under-review reservation'
  $assignmentSuccess = Get-JsonResult (Invoke-Withdraw $principal $assignmentKeyTwo $assignmentClaim 2 $assignmentTwo.execution_fence) 'under-review withdrawal'
  $assignmentRetained = (Invoke-Psql -Label 'assignment provenance after withdrawal' -Sql "select status||'/'||record_version||'/'||reviewer_user_profile_id||'/'||reviewer_assignment_version||'/'||reviewer_assignment_source_code from public.supplier_ownership_claims where id='$assignmentClaim'::uuid;").Output | Where-Object { $_ -match '^withdrawn/' } | Select-Object -Last 1
  Assert-True ($assignmentSuccess.claim_version -eq 3 -and $assignmentRetained -eq "withdrawn/3/$reviewer/1/manual") 'under-review withdrawal increments once and preserves reviewer provenance'

  $expiryClaim = 'f1000006-0000-4000-8000-000000000006'
  $expirySupplier = 'c2000006-0000-4000-8000-000000000006'
  $expiryKey = 'claim-d0000000-0000-4000-8000-000000000051'
  $expiryReservation = Get-JsonResult (Invoke-Reservation $principal $expiryKey $expiryClaim 1) 'expiry-race reservation'
  $expiryWriter = @"
begin;
select pg_catalog.pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$principal'));
select pg_catalog.pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$expirySupplier'));
select id from public.user_profiles where id in ('$principal'::uuid) order by id for update;
select id from internal.identity_provider_links where user_profile_id in ('$principal'::uuid) order by id for update;
select id from public.supplier_profiles where id='$expirySupplier'::uuid for update;
select id from public.supplier_ownerships where supplier_profile_id='$expirySupplier'::uuid order by id for update;
select id from public.supplier_ownership_claims where id='$expiryClaim'::uuid for update;
update public.supplier_ownership_claims
set status='expired', record_version=2, expired_at=pg_catalog.clock_timestamp(),
    expiry_system_source_code='claim_expiry_worker', expiry_policy_version='claim_expiry_v1',
    updated_at=pg_catalog.clock_timestamp()
where id='$expiryClaim'::uuid;
select pg_catalog.pg_sleep(3);
commit;
"@
  $expiryResults = Invoke-ConcurrentSql `
    (New-WithdrawSql $principal $expiryKey $expiryClaim 1 $expiryReservation.execution_fence) `
    'select 1;' $expiryWriter
  Assert-True ($expiryResults[0].ExitCode -ne 0 -and $expiryResults[0].Text -match 'P5112.*claim_version_conflict') 'future expiry writer serializes before withdrawal as version conflict'
  $expiryState = (Invoke-Psql -Label 'expiry race state' -Sql "select status||'/'||record_version||'/'||(select count(*) from internal.domain_events where aggregate_id='$expiryClaim'::uuid and event_type='supplier_ownership.claim_withdrawn') from public.supplier_ownership_claims where id='$expiryClaim'::uuid;").Output | Where-Object { $_ -match '^expired/' } | Select-Object -Last 1
  Assert-True ($expiryState -eq 'expired/2/0') 'expiry winner remains terminal with no withdrawal event'

  $dueClaim = 'f1000007-0000-4000-8000-000000000007'
  $dueKey = 'claim-d0000000-0000-4000-8000-000000000061'
  $dueReservation = Get-JsonResult (Invoke-Reservation $principal $dueKey $dueClaim 1) 'due reservation'
  $dueFailure = Invoke-Withdraw $principal $dueKey $dueClaim 1 $dueReservation.execution_fence -AllowFailure
  Assert-True ($dueFailure.ExitCode -ne 0 -and $dueFailure.Text -match 'P5114.*claim_expired') 'due Claim returns claimant-safe P5114 without silent expiry'
  $dueState = (Invoke-Psql -Label 'due Claim state' -Sql "select status||'/'||record_version||'/'||(expired_at is null)::text from public.supplier_ownership_claims where id='$dueClaim'::uuid;").Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($dueState -eq 'submitted/1/true') 'due Claim remains active for the future expiry command'

  $identityClaim = 'f1000008-0000-4000-8000-000000000008'
  $identityKey = 'claim-d0000000-0000-4000-8000-000000000071'
  $identityReservation = Get-JsonResult (Invoke-Reservation $principal $identityKey $identityClaim 1) 'identity-race reservation'
  $identityWriter = @"
begin;
select pg_catalog.pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$principal'));
select id from public.user_profiles where id='$principal'::uuid for update;
update public.user_profiles
set verification_mirror_status='unverified', verification_mirror_observed_at=pg_catalog.clock_timestamp()
where id='$principal'::uuid;
select pg_catalog.pg_sleep(3);
commit;
"@
  $identityResults = Invoke-ConcurrentSql `
    (New-WithdrawSql $principal $identityKey $identityClaim 1 $identityReservation.execution_fence) `
    'select 1;' $identityWriter
  Assert-True ($identityResults[0].ExitCode -ne 0 -and $identityResults[0].Text -match 'P5103.*claimant_ineligible') 'eligibility loss under the principal lock fails withdrawal closed'
  $identityState = (Invoke-Psql -Label 'identity race Claim state' -Sql "select status||'/'||record_version from public.supplier_ownership_claims where id='$identityClaim'::uuid;").Output | Where-Object { $_ -match '^submitted/' } | Select-Object -Last 1
  Assert-True ($identityState -eq 'submitted/1') 'eligibility-loss race leaves Claim unchanged'
  Invoke-Psql -Label 'restore synthetic eligibility' -Sql "update public.user_profiles set verification_mirror_status='verified', verification_mirror_observed_at=pg_catalog.clock_timestamp() where id='$principal'::uuid;" | Out-Null

  $globalCounts = (Invoke-Psql -Label 'global withdraw effects' -Sql "select (select count(*) from public.supplier_ownership_claims where status='withdrawn')||'/'||(select count(*) from internal.domain_events where event_type='supplier_ownership.claim_withdrawn')||'/'||(select count(*) from internal.audit_logs);" ).Output | Where-Object { $_ -match '^\d+/\d+/\d+$' } | Select-Object -Last 1
  Assert-True ($globalCounts -eq '4/4/0') 'all race/retry paths retain four withdrawals, four events, and zero ordinary audits'
  $hmacLeak = (Invoke-Psql -Label 'HMAC persistence scan' -Sql "select ((select count(*) from public.supplier_ownership_claims claim_row where claim_row::text like '%'||repeat('k',32)||'%')+(select count(*) from internal.idempotency_keys key_row where key_row::text like '%'||repeat('k',32)||'%')+(select count(*) from internal.domain_events event_row where event_row::text like '%'||repeat('k',32)||'%')+(select count(*) from internal.audit_logs audit_row where audit_row::text like '%'||repeat('k',32)||'%'))::text;" ).Output | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
  Assert-True ($hmacLeak -eq '0') 'HMAC secret is absent from Claim, idempotency, event, and audit rows'

  $stopwatch.Stop()
  Write-Output ("Claim withdraw concurrency validation passed: {0} checks; same-Claim=P5112 with 1 version/1 event; assignment and expiry writers serialize; eligibility loss fails closed; attempt-limit=failed terminal at 10; {1:n1}s elapsed." -f $checks.Count, $stopwatch.Elapsed.TotalSeconds)
}
finally {
  if ($containerStarted) { docker rm --force $containerName *> $null }
}
