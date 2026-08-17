[CmdletBinding()]
param([switch]$VerifyFailureDetection, [string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
$testsDirectory = Join-Path $repoRoot 'supabase/tests'
$claimOwnerRoleProvisioner = Join-Path $PSScriptRoot 'claim-owner-role-provisioner.ps1'
$claimAuthorizationFinalizer = Join-Path $PSScriptRoot 'claim-authorization-finalizer.ps1'
$claimAuthorizationSecurityHarness = Join-Path $PSScriptRoot 'test-claim-authorization-finalizer.ps1'
$claimAuthorizationCatalogAllowlist = Join-Path $repoRoot 'supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'
$claimAuthorizationCatalogNormalizer = '/workspace/supabase/local-bootstrap/claim-authorization-catalog-normalization.sql'
$b4MigrationName = '20260817000100_claim_rls_authorization_foundation.sql'
$postB4TestNames = @(
  'claim_submit_idempotency_hotfix.sql',
  'claim_withdraw_trusted_command.sql',
  'assign_reviewer_trusted_command.sql',
  'approve_trusted_command.sql',
  'reject_trusted_command.sql',
  'expire_trusted_command.sql',
  'claim_rls_self_read_foundation.sql',
  'reviewer_private_read_substrate.sql',
  'claim_rls_authorization_foundation.sql'
)
$containerName = "mujahiz-iq-sql-validation-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$failureDetails = [System.Collections.Generic.List[string]]::new()
$containerStarted = $false
$success = $false

function Invoke-Psql {
  param([string]$Label, [string]$ContainerPath, [string]$Sql, [string]$DatabaseName = 'postgres',
    [string]$Username = 'postgres', [switch]$PostB4Replay)

  $arguments = @(
    'exec', $containerName, 'psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    "--username=$Username", "--dbname=$DatabaseName", '--quiet', '--tuples-only',
    '--no-align', '--pset', 'footer=off', '--set',
    "claim_post_b4_replay=$(if ($PostB4Replay) { '1' } else { '0' })"
  )
  if ($ContainerPath) { $arguments += @('--file', $ContainerPath) }
  else { $arguments += @('--command', $Sql) }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($exitCode -ne 0) {
    $failureDetails.Add("$Label produced a SQL error.$([Environment]::NewLine)$($output -join [Environment]::NewLine)")
    throw "$Label failed."
  }
  return $output
}

function Test-TapOutput {
  param([string[]]$Output, [string]$Label)

  $assertions = @()
  $plans = @()
  foreach ($line in $Output) {
    if ($line -match '^(not )?ok\s+(\d+)(?:\s+-.*)?$') {
      $assertions += [pscustomobject]@{ Failed = $Matches[1] -eq 'not '; Number = [int]$Matches[2] }
    }
    elseif ($line -match '^1\.\.(\d+)$') { $plans += [int]$Matches[1] }
  }

  $failed = @($assertions | Where-Object Failed)
  $passed = @($assertions | Where-Object { -not $_.Failed })
  $planned = if ($plans.Count -gt 0) { $plans[-1] } else { 0 }
  $planMismatch = $plans.Count -eq 0 -or @($plans | Where-Object { $_ -ne $planned }).Count -gt 0 -or $assertions.Count -ne $planned
  $numbers = @($assertions | ForEach-Object Number | Sort-Object -Unique)
  $sequenceMismatch = $numbers.Count -ne $planned -or (($numbers -join ',') -ne ((@(1..$planned)) -join ','))

  if ($failed.Count -gt 0 -or $planMismatch -or $sequenceMismatch) {
    $failureDetails.Add((@(
      "$Label did not produce a passing pgTAP result.",
      "Planned assertions: $planned; observed assertions: $($assertions.Count); passed: $($passed.Count); failed: $($failed.Count).",
      'TAP output:', ($Output -join [Environment]::NewLine)
    ) -join [Environment]::NewLine))
    throw "$Label failed."
  }
  return [pscustomobject]@{ Passed = $passed.Count; Failed = $failed.Count }
}

function Assert-ClaimAuthorizationCatalog {
  param(
    [Parameter(Mandatory)][string]$DatabaseName,
    [Parameter(Mandatory)][ValidateSet('PRE', 'POST')][string]$State
  )
  $prefix = "$State|"
  $expected = @(Get-Content -LiteralPath $claimAuthorizationCatalogAllowlist | Where-Object {
    $_.StartsWith($prefix, [System.StringComparison]::Ordinal)
  } | ForEach-Object { $_.Substring($prefix.Length) })
  $actual = @(Invoke-Psql -Label "$State Claim authorization catalog" -DatabaseName $DatabaseName `
    -ContainerPath $claimAuthorizationCatalogNormalizer)
  $difference = @(Compare-Object $expected $actual -SyncWindow 0)
  if ($difference.Count -ne 0) {
    $failureDetails.Add("$State Claim authorization catalog mismatch in ${DatabaseName}: $($difference.Count) tuple differences.")
    throw "$State Claim authorization catalog validation failed."
  }
}

function Set-RunnerDatabaseAcl([string]$DatabaseName) {
  if ($DatabaseName -notmatch '^(runner_test|post_b4_test)_[0-9]+$') { throw 'Unexpected validation database ACL target.' }
  $sql = @(
    "grant connect, create, temporary on database $DatabaseName to dashboard_user;",
    "grant create on database $DatabaseName to supabase_etl_admin;",
    "grant create on database $DatabaseName to supabase_storage_admin;"
  ) -join [Environment]::NewLine
  Invoke-Psql -Label "Database ACL $DatabaseName" -Sql $sql | Out-Null
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required but was not found on PATH.' }
  if (-not (Test-Path -LiteralPath $migrationsDirectory) -or -not (Test-Path -LiteralPath $testsDirectory)) {
    throw 'Expected repository-relative supabase/migrations and supabase/tests directories were not found.'
  }
  if (-not (Test-Path -LiteralPath $claimOwnerRoleProvisioner)) {
    throw 'The fixed Claim owner-role provisioner hook was not found.'
  }
  if (-not (Test-Path -LiteralPath $claimAuthorizationFinalizer)) {
    throw 'The fixed Claim authorization finalizer hook was not found.'
  }
  foreach ($requiredPath in @($claimAuthorizationSecurityHarness, $claimAuthorizationCatalogAllowlist)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "Required Claim authorization validation asset was not found: $requiredPath"
    }
  }
  . $claimOwnerRoleProvisioner
  . $claimAuthorizationFinalizer

  $migrations = @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)
  $tests = @(Get-ChildItem -LiteralPath $testsDirectory -File -Filter '*.sql' | Sort-Object Name)
  if ($migrations.Count -eq 0 -or $tests.Count -eq 0) { throw 'At least one migration and one pgTAP SQL test file are required.' }
  if (@($migrations | Where-Object Name -eq $b4MigrationName).Count -ne 1) {
    throw 'The exact B4 migration is required.'
  }
  $testMigrationAliases = @{ identity_provider_foundation = 'provider_neutral_identity_foundation' }

  $authorizationSecuritySummary = 'skipped for synthetic failure-detection mode'
  if (-not $VerifyFailureDetection) {
    $securityHarnessOutput = @(& $claimAuthorizationSecurityHarness)
    if ($securityHarnessOutput.Count -eq 0 -or
        $securityHarnessOutput[-1] -notmatch '^Claim authorization security validation passed:') {
      throw 'Claim authorization security harness did not return its fixed success summary.'
    }
    $authorizationSecuritySummary = $securityHarnessOutput[-1]
  }

  $mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
  $containerId = & docker run --detach --rm --name $containerName --mount $mount --env 'POSTGRES_PASSWORD=postgres' --env 'PGPASSWORD=postgres' --env 'POSTGRES_DB=postgres' $PostgresImage 2>&1
  if ($LASTEXITCODE -ne 0) {
    $failureDetails.Add("Unable to start disposable PostgreSQL container.$([Environment]::NewLine)$($containerId -join [Environment]::NewLine)")
    throw 'Disposable PostgreSQL startup failed.'
  }
  $containerStarted = $true

  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    & docker exec $containerName pg_isready --username=postgres --dbname=postgres *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    & docker exec $containerName sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
    $initializationInProgress = $LASTEXITCODE -eq 0
    if ($databaseReady -and -not $initializationInProgress) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    $containerLogs = @(& docker logs $containerName 2>&1 | ForEach-Object { $_.ToString() })
    $failureDetails.Add("Disposable PostgreSQL did not become ready.$([Environment]::NewLine)$($containerLogs -join [Environment]::NewLine)")
    throw 'Disposable PostgreSQL readiness check failed.'
  }

  Invoke-ClaimOwnerRoleProvisioner -ContainerName $containerName | Out-Null
  # Re-execution before B4 proves the cluster roles remain exact and inert.
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $containerName | Out-Null

  $bootstrapSql = @(
    'create schema if not exists extensions;',
    'create extension if not exists pgtap with schema extensions;',
    'do $$',
    'begin',
    "  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;",
    "  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;",
    "  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;",
    'end', '$$;',
    'grant usage on schema public to postgres, anon, authenticated, service_role;',
    'grant usage on schema extensions to anon, authenticated, service_role;',
    'grant usage, create on schema extensions to dashboard_user;'
  ) -join [Environment]::NewLine
  Invoke-Psql -Label 'Supabase local-role bootstrap' -Sql $bootstrapSql | Out-Null

  $testTemplateDatabase = 'runner_test_template'
  Invoke-Psql -Label 'Test database template' -Sql "create database $testTemplateDatabase template template0;" | Out-Null
  Invoke-Psql -Label 'Test database platform bootstrap' -Sql $bootstrapSql -DatabaseName $testTemplateDatabase | Out-Null

  foreach ($migration in $migrations) {
    Invoke-Psql -Label "Migration $($migration.Name)" -ContainerPath "/workspace/supabase/migrations/$($migration.Name)" | Out-Null
    if ($migration.Name -eq $b4MigrationName) {
      Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
      Assert-ClaimAuthorizationCatalog -DatabaseName 'postgres' -State POST
    }
  }

  $postB4TemplateDatabase = 'runner_post_b4_template'
  Invoke-Psql -Label 'Disable post-B4 source connections' -DatabaseName 'template1' -Username 'supabase_admin' `
    -Sql 'alter database postgres with allow_connections false;' | Out-Null
  try {
    Invoke-Psql -Label 'Terminate post-B4 source sessions' -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql "select pg_catalog.pg_terminate_backend(pid) from pg_catalog.pg_stat_activity where datname = 'postgres';" | Out-Null
    Invoke-Psql -Label 'Create post-B4 test template' -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql "create database $postB4TemplateDatabase template postgres owner postgres;" | Out-Null
  }
  finally {
    Invoke-Psql -Label 'Re-enable post-B4 source connections' -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql 'alter database postgres with allow_connections true;' | Out-Null
  }

  $assertionsPassed = 0
  $assertionsFailed = 0
  $postB4TestsRun = 0
  foreach ($postB4TestName in $postB4TestNames) {
    $postB4Test = @($tests | Where-Object { $_.Name -ceq $postB4TestName })
    if ($postB4Test.Count -ne 1) { throw "Required post-B4 test was not found exactly once: $postB4TestName" }
    $postB4Database = "post_b4_test_$($postB4TestsRun + 1)"
    Invoke-Psql -Label "Post-B4 database $postB4TestName" -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql "create database $postB4Database template $postB4TemplateDatabase owner postgres;" | Out-Null
    Set-RunnerDatabaseAcl -DatabaseName $postB4Database
    Assert-ClaimAuthorizationCatalog -DatabaseName $postB4Database -State POST
    $tapOutput = @(Invoke-Psql -Label "Post-B4 test $postB4TestName" `
      -ContainerPath "/workspace/supabase/tests/$postB4TestName" -DatabaseName $postB4Database -PostB4Replay)
    $result = Test-TapOutput -Output $tapOutput -Label "Post-B4 test $postB4TestName"
    $assertionsPassed += $result.Passed
    $assertionsFailed += $result.Failed
    $postB4TestsRun++
  }
  for ($testIndex = 0; $testIndex -lt $tests.Count; $testIndex++) {
    $test = $tests[$testIndex]
    $expectedMigrationSuffix = if ($testMigrationAliases.ContainsKey($test.BaseName)) { $testMigrationAliases[$test.BaseName] } else { $test.BaseName }
    $testMigration = @($migrations | Where-Object { $_.BaseName -like "*_$expectedMigrationSuffix" })
    if ($testMigration.Count -ne 1) {
      throw "Test $($test.Name) must match exactly one migration basename."
    }
    $migrationLimit = [array]::IndexOf([object[]]$migrations, $testMigration[0])
    if ($migrationLimit -lt 0) {
      throw "Could not determine the migration prefix for test $($test.Name)."
    }

    $testDatabase = "runner_test_$($testIndex + 1)"
    Invoke-Psql -Label "Test database $($test.Name)" -Sql "create database $testDatabase template $testTemplateDatabase;" | Out-Null
    Set-RunnerDatabaseAcl -DatabaseName $testDatabase
    for ($migrationIndex = 0; $migrationIndex -le $migrationLimit; $migrationIndex++) {
      $migration = $migrations[$migrationIndex]
      Invoke-Psql -Label "Test setup $($migration.Name)" -ContainerPath "/workspace/supabase/migrations/$($migration.Name)" -DatabaseName $testDatabase | Out-Null
      if ($migration.Name -eq $b4MigrationName) {
        Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
        Assert-ClaimAuthorizationCatalog -DatabaseName $testDatabase -State POST
      }
    }

    $tapOutput = @(Invoke-Psql -Label "Test $($test.Name)" -ContainerPath "/workspace/supabase/tests/$($test.Name)" -DatabaseName $testDatabase)
    $result = Test-TapOutput -Output $tapOutput -Label "Test $($test.Name)"
    $assertionsPassed += $result.Passed
    $assertionsFailed += $result.Failed
  }

  if ($VerifyFailureDetection) {
    $tapOutput = @(Invoke-Psql -Label 'Synthetic pgTAP failure check' -Sql "select plan(1); select ok(false, 'synthetic runner failure check'); select * from finish();")
    Test-TapOutput -Output $tapOutput -Label 'Synthetic pgTAP failure check' | Out-Null
    throw 'Synthetic failure detection unexpectedly passed.'
  }
  $success = $true
}
catch {
  if ($failureDetails.Count -eq 0) { $failureDetails.Add($_.Exception.Message) }
}
finally {
  $stopwatch.Stop()
  if ($containerStarted) { & docker rm --force $containerName *> $null }
}

if ($success) {
  Write-Output ("Local SQL validation passed: {0} migrations applied; {1} isolated test files plus {2} post-B4 replays run; {3} assertions passed, {4} failed; security: {5}; {6:n1}s elapsed." -f $migrations.Count, $tests.Count, $postB4TestsRun, $assertionsPassed, $assertionsFailed, $authorizationSecuritySummary, $stopwatch.Elapsed.TotalSeconds)
  exit 0
}

Write-Error "Local SQL validation failed.$([Environment]::NewLine)$($failureDetails -join [Environment]::NewLine)"
exit 1
