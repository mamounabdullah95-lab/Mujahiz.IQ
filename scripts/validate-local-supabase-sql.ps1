[CmdletBinding()]
param([switch]$VerifyFailureDetection, [string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
$testsDirectory = Join-Path $repoRoot 'supabase/tests'
$containerName = "mujahiz-iq-sql-validation-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$failureDetails = [System.Collections.Generic.List[string]]::new()
$containerStarted = $false
$success = $false

function Invoke-Psql {
  param([string]$Label, [string]$ContainerPath, [string]$Sql, [string]$DatabaseName = 'postgres')

  $arguments = @(
    'exec', $containerName, 'psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--username=postgres', "--dbname=$DatabaseName", '--quiet', '--tuples-only',
    '--no-align', '--pset', 'footer=off'
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

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required but was not found on PATH.' }
  if (-not (Test-Path -LiteralPath $migrationsDirectory) -or -not (Test-Path -LiteralPath $testsDirectory)) {
    throw 'Expected repository-relative supabase/migrations and supabase/tests directories were not found.'
  }

  $migrations = @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)
  $tests = @(Get-ChildItem -LiteralPath $testsDirectory -File -Filter '*.sql' | Sort-Object Name)
  if ($migrations.Count -eq 0 -or $tests.Count -eq 0) { throw 'At least one migration and one pgTAP SQL test file are required.' }
  $testMigrationAliases = @{ identity_provider_foundation = 'provider_neutral_identity_foundation' }

  $mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
  $containerId = & docker run --detach --rm --name $containerName --mount $mount --env 'POSTGRES_PASSWORD=postgres' --env 'POSTGRES_DB=postgres' $PostgresImage 2>&1
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

  $bootstrapSql = @(
    'create schema if not exists extensions;',
    'create extension if not exists pgtap with schema extensions;',
    'do $$',
    'begin',
    "  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;",
    "  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;",
    "  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;",
    'end', '$$;'
  ) -join [Environment]::NewLine
  Invoke-Psql -Label 'Supabase local-role bootstrap' -Sql $bootstrapSql | Out-Null

  $testTemplateDatabase = 'runner_test_template'
  Invoke-Psql -Label 'Test database template' -Sql "create database $testTemplateDatabase template template0;" | Out-Null
  Invoke-Psql -Label 'Test database platform bootstrap' -Sql $bootstrapSql -DatabaseName $testTemplateDatabase | Out-Null

  foreach ($migration in $migrations) {
    Invoke-Psql -Label "Migration $($migration.Name)" -ContainerPath "/workspace/supabase/migrations/$($migration.Name)" | Out-Null
  }

  $assertionsPassed = 0
  $assertionsFailed = 0
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
    for ($migrationIndex = 0; $migrationIndex -le $migrationLimit; $migrationIndex++) {
      $migration = $migrations[$migrationIndex]
      Invoke-Psql -Label "Test setup $($migration.Name)" -ContainerPath "/workspace/supabase/migrations/$($migration.Name)" -DatabaseName $testDatabase | Out-Null
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
  Write-Output ("Local SQL validation passed: {0} migrations applied; {1} test files run; {2} assertions passed, {3} failed; {4:n1}s elapsed." -f $migrations.Count, $tests.Count, $assertionsPassed, $assertionsFailed, $stopwatch.Elapsed.TotalSeconds)
  exit 0
}

Write-Error "Local SQL validation failed.$([Environment]::NewLine)$($failureDetails -join [Environment]::NewLine)"
exit 1