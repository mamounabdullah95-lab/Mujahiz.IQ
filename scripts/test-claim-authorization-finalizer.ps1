[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsDirectory = Join-Path $repoRoot 'supabase/migrations'
$provisionerPath = Join-Path $PSScriptRoot 'claim-owner-role-provisioner.ps1'
$finalizerPath = Join-Path $PSScriptRoot 'claim-authorization-finalizer.ps1'
$allowlistPath = Join-Path $repoRoot 'supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'
$b4MigrationName = '20260817000100_claim_rls_authorization_foundation.sql'
$normalizerContainerPath = '/workspace/supabase/local-bootstrap/claim-authorization-catalog-normalization.sql'
$b4ContainerPath = "/workspace/supabase/migrations/$b4MigrationName"
$containerName = "mujahiz-b4-security-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$postgresImage = 'supabase/postgres:17.6.1.064'
$containerStarted = $false
$checksPassed = 0
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Add-PassedCheck { $script:checksPassed++ }

function Invoke-PsqlRaw {
  param(
    [Parameter(Mandatory)][string]$DatabaseName,
    [string]$Sql,
    [string]$ContainerPath,
    [string]$Username = 'postgres',
    [string]$PgOptions
  )
  if (($Sql.Length -gt 0) -eq ($ContainerPath.Length -gt 0)) {
    throw 'The security harness requires exactly one psql input mode.'
  }
  $arguments = @('exec')
  if ($PgOptions.Length -gt 0) { $arguments += @('--env', "PGOPTIONS=$PgOptions") }
  $arguments += @($containerName, '/usr/bin/psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--host=/var/run/postgresql', '--port=5432', "--username=$Username",
    "--dbname=$DatabaseName", '--quiet', '--tuples-only', '--no-align', '--pset', 'footer=off')
  if ($Sql.Length -gt 0) { $arguments += @('--command', $Sql) }
  else { $arguments += @('--file', $ContainerPath) }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  return [pscustomobject]@{ ExitCode = $exitCode; Output = [string[]]$output }
}

function Invoke-PsqlSuccess {
  param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory)][string]$DatabaseName,
    [string]$Sql,
    [string]$ContainerPath,
    [string]$Username = 'postgres',
    [string]$PgOptions
  )
  $result = Invoke-PsqlRaw -DatabaseName $DatabaseName -Sql $Sql -ContainerPath $ContainerPath `
    -Username $Username -PgOptions $PgOptions
  if ($result.ExitCode -ne 0) {
    throw "$Label failed.$([Environment]::NewLine)$($result.Output -join [Environment]::NewLine)"
  }
  return $result.Output
}

function Invoke-PsqlExpectedFailure {
  param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory)][string]$DatabaseName,
    [string]$Sql,
    [string]$ContainerPath,
    [string]$Username = 'postgres',
    [string]$PgOptions,
    [Parameter(Mandatory)][string]$ExpectedPattern
  )
  $result = Invoke-PsqlRaw -DatabaseName $DatabaseName -Sql $Sql -ContainerPath $ContainerPath `
    -Username $Username -PgOptions $PgOptions
  $joined = $result.Output -join [Environment]::NewLine
  if ($result.ExitCode -eq 0 -or $joined -notmatch $ExpectedPattern) {
    throw "$Label did not fail at the required point.$([Environment]::NewLine)$joined"
  }
  Add-PassedCheck
}

function Get-CatalogTuples([string]$DatabaseName) {
  return @(Invoke-PsqlSuccess -Label "Catalog normalization for $DatabaseName" `
    -DatabaseName $DatabaseName -ContainerPath $normalizerContainerPath -Username 'supabase_admin')
}

function Get-ExpectedCatalog([ValidateSet('PRE', 'POST')][string]$State) {
  $prefix = "$State|"
  return @(Get-Content -LiteralPath $allowlistPath | Where-Object {
    $_.StartsWith($prefix, [System.StringComparison]::Ordinal)
  } | ForEach-Object { $_.Substring($prefix.Length) })
}

function Assert-CatalogEqual {
  param(
    [Parameter(Mandatory)][string[]]$Expected,
    [Parameter(Mandatory)][string[]]$Actual,
    [Parameter(Mandatory)][string]$Label
  )
  $difference = @(Compare-Object $Expected $Actual -SyncWindow 0)
  if ($difference.Count -ne 0) {
    $sample = @($difference | Select-Object -First 6 | ForEach-Object {
      $tuple = [string]$_.InputObject
      if ($tuple.Length -gt 240) { $tuple = $tuple.Substring(0, 240) + '...' }
      "$($_.SideIndicator) $tuple"
    })
    throw "$Label catalog mismatch: $($difference.Count) tuple differences.$([Environment]::NewLine)$($sample -join [Environment]::NewLine)"
  }
  Add-PassedCheck
}

function Assert-CommittedCatalog {
  param(
    [Parameter(Mandatory)][string]$DatabaseName,
    [Parameter(Mandatory)][ValidateSet('PRE', 'POST')][string]$State
  )
  Assert-CatalogEqual -Expected (Get-ExpectedCatalog $State) -Actual (Get-CatalogTuples $DatabaseName) `
    -Label "$DatabaseName $State"
}

function Assert-CommittedCatalogMismatch {
  param(
    [Parameter(Mandatory)][string]$DatabaseName,
    [Parameter(Mandatory)][ValidateSet('PRE', 'POST')][string]$State,
    [Parameter(Mandatory)][string]$Label
  )
  $difference = @(Compare-Object (Get-ExpectedCatalog $State) (Get-CatalogTuples $DatabaseName) -SyncWindow 0)
  if ($difference.Count -eq 0) { throw "$Label was not detected by the exact catalog allowlist." }
  Add-PassedCheck
}

function Invoke-FinalizerExpectedFailure {
  param(
    [Parameter(Mandatory)][string[]]$ExpectedPatterns,
    [string]$FailurePoint,
    [string]$InvocationKind = 'normal',
    [switch]$PauseBeforeCommit,
    [switch]$Detach
  )
  $failed = $false
  $message = ''
  try {
    Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName -FailurePoint $FailurePoint `
      -InvocationKind $InvocationKind -PauseBeforeCommit:$PauseBeforeCommit -Detach:$Detach | Out-Null
  }
  catch {
    $failed = $true
    $message = $_.Exception.Message
  }
  if (-not $failed) { throw 'The Claim authorization finalizer unexpectedly succeeded.' }
  foreach ($pattern in $ExpectedPatterns) {
    if ($message -notmatch $pattern) { throw "Finalizer failure did not contain required evidence: $pattern" }
  }
  Add-PassedCheck
}

function Set-RunnerDatabaseAcl {
  $sql = @(
    'grant connect, create, temporary on database runner_test_1 to dashboard_user;',
    'grant create on database runner_test_1 to supabase_etl_admin;',
    'grant create on database runner_test_1 to supabase_storage_admin;'
  ) -join [Environment]::NewLine
  Invoke-PsqlSuccess -Label 'Restore runner database ACL' -DatabaseName 'template1' `
    -Username 'supabase_admin' -Sql $sql | Out-Null
}

function Reset-RunnerDatabase {
  Invoke-PsqlSuccess -Label 'Drop runner database' -DatabaseName 'template1' -Username 'supabase_admin' `
    -Sql 'drop database if exists runner_test_1 with (force);' | Out-Null
  Invoke-PsqlSuccess -Label 'Recreate runner PRE database' -DatabaseName 'template1' -Username 'supabase_admin' `
    -Sql 'create database runner_test_1 template runner_test_template_b4_pre owner postgres;' | Out-Null
  Set-RunnerDatabaseAcl
}

function Wait-ForPausedFinalizer([ValidateSet('cancellation', 'termination')][string]$Kind) {
  $applicationName = "mujahiz_claim_authorization_finalizer_$Kind"
  for ($attempt = 1; $attempt -le 80; $attempt++) {
    $rows = @(Invoke-PsqlSuccess -Label "Observe $Kind finalizer" -DatabaseName 'postgres' -Username 'supabase_admin' -Sql (
      "select pid::text || '|' || coalesce(wait_event,'') from pg_catalog.pg_stat_activity " +
      "where datname='runner_test_1' and application_name='$applicationName' order by pid;"
    ))
    if ($rows.Count -eq 1 -and $rows[0] -match '^(\d+)\|PgSleep$') {
      Add-PassedCheck
      return [int]$Matches[1]
    }
    Start-Sleep -Milliseconds 250
  }
  throw "The $Kind finalizer never reached the fixed pre-commit PgSleep sentinel."
}

function Wait-ForFinalizerExit([ValidateSet('cancellation', 'termination')][string]$Kind) {
  $applicationName = "mujahiz_claim_authorization_finalizer_$Kind"
  for ($attempt = 1; $attempt -le 80; $attempt++) {
    $rows = @(Invoke-PsqlSuccess -Label "Observe $Kind finalizer exit" -DatabaseName 'postgres' -Username 'supabase_admin' `
      -Sql "select count(*) from pg_catalog.pg_stat_activity where application_name='$applicationName';")
    if ($rows.Count -eq 1 -and $rows[0] -eq '0') { Add-PassedCheck; return }
    Start-Sleep -Milliseconds 250
  }
  throw "The $Kind finalizer session did not exit after interruption."
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required.' }
  . $provisionerPath
  . $finalizerPath

  $mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
  $containerOutput = @(& docker run --detach --rm --name $containerName --mount $mount `
    --env 'POSTGRES_PASSWORD=postgres' --env 'PGPASSWORD=postgres' --env 'POSTGRES_DB=postgres' `
    $postgresImage 2>&1 | ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL startup failed: $($containerOutput -join ' ')" }
  $containerStarted = $true

  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    & docker exec $containerName pg_isready --username=postgres --dbname=postgres *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    & docker exec $containerName sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
    if ($databaseReady -and $LASTEXITCODE -ne 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }

  Invoke-ClaimOwnerRoleProvisioner -ContainerName $containerName | Out-Null
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $containerName | Out-Null
  $bootstrapSql = @(
    'create schema if not exists extensions;',
    'create extension if not exists pgtap with schema extensions;',
    'do $$', 'begin',
    "if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin noinherit; end if;",
    "if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;",
    "if not exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then create role service_role nologin noinherit; end if;",
    'end', '$$;'
  ) -join [Environment]::NewLine
  Invoke-PsqlSuccess -Label 'Security harness bootstrap' -DatabaseName 'postgres' -Sql $bootstrapSql | Out-Null

  $migrations = @(Get-ChildItem -LiteralPath $migrationsDirectory -File -Filter '*.sql' | Sort-Object Name)
  $b4Index = [array]::IndexOf(@($migrations.Name), $b4MigrationName)
  if ($b4Index -lt 0) { throw 'The exact B4 migration was not found.' }
  for ($index = 0; $index -lt $b4Index; $index++) {
    Invoke-PsqlSuccess -Label "Pre-B4 migration $($migrations[$index].Name)" -DatabaseName 'postgres' `
      -ContainerPath "/workspace/supabase/migrations/$($migrations[$index].Name)" | Out-Null
  }

  $ordinaryBaseline = @(Get-CatalogTuples 'postgres')
  $ordinaryFailurePoints = [ordered]@{
    after_helper = 'injected ordinary B4 failure after helper replacement'
    after_policies = 'injected ordinary B4 failure after policy creation'
    final_assertion = 'injected ordinary B4 final assertion failure'
  }
  foreach ($entry in $ordinaryFailurePoints.GetEnumerator()) {
    Invoke-PsqlExpectedFailure -Label "Ordinary B4 $($entry.Key)" -DatabaseName 'postgres' `
      -ContainerPath $b4ContainerPath -PgOptions "-c mujahiz.claim_b4_failure_point=$($entry.Key)" `
      -ExpectedPattern ([regex]::Escape($entry.Value))
    Assert-CatalogEqual -Expected $ordinaryBaseline -Actual (Get-CatalogTuples 'postgres') `
      -Label "Ordinary B4 rollback $($entry.Key)"
  }
  Invoke-PsqlSuccess -Label 'Ordinary B4 clean replay' -DatabaseName 'postgres' `
    -ContainerPath $b4ContainerPath | Out-Null
  Assert-CommittedCatalog -DatabaseName 'postgres' -State PRE

  Invoke-PsqlSuccess -Label 'Disable PRE source connections' -DatabaseName 'template1' -Username 'supabase_admin' `
    -Sql 'alter database postgres with allow_connections false;' | Out-Null
  try {
    Invoke-PsqlSuccess -Label 'Terminate PRE source sessions' -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql "select pg_catalog.pg_terminate_backend(pid) from pg_catalog.pg_stat_activity where datname='postgres';" | Out-Null
    Invoke-PsqlSuccess -Label 'Create ignored PRE template' -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql 'create database runner_test_template_b4_pre template postgres owner postgres;' | Out-Null
  }
  finally {
    Invoke-PsqlSuccess -Label 'Re-enable PRE source connections' -DatabaseName 'template1' -Username 'supabase_admin' `
      -Sql 'alter database postgres with allow_connections true;' | Out-Null
  }
  Invoke-PsqlSuccess -Label 'Create second eligible candidate' -DatabaseName 'template1' -Username 'supabase_admin' `
    -Sql 'create database runner_test_1 template runner_test_template_b4_pre owner postgres;' | Out-Null
  Set-RunnerDatabaseAcl
  Assert-CommittedCatalog -DatabaseName 'postgres' -State PRE
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State PRE
  Invoke-FinalizerExpectedFailure -ExpectedPatterns @('exactly one exact pre-finalization candidate; found 2')
  Assert-CommittedCatalog -DatabaseName 'postgres' -State PRE
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State PRE
  Invoke-PsqlSuccess -Label 'Drop second eligible candidate' -DatabaseName 'template1' -Username 'supabase_admin' `
    -Sql 'drop database runner_test_1 with (force);' | Out-Null

  Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
  Assert-CommittedCatalog -DatabaseName 'postgres' -State POST
  Invoke-FinalizerExpectedFailure -ExpectedPatterns @('exactly one exact pre-finalization candidate; found 0')

  $privilegedFailurePoints = @(
    'after_acl_1', 'after_acl_2', 'after_acl_3', 'after_acl_4', 'between_assets',
    'after_owner_1', 'after_owner_13', 'after_owner_26', 'final_assertion'
  )
  foreach ($failurePoint in $privilegedFailurePoints) {
    Reset-RunnerDatabase
    Invoke-FinalizerExpectedFailure -FailurePoint $failurePoint `
      -ExpectedPatterns @("B4_REACHED:$failurePoint", "B4_INJECTED:$failurePoint")
    Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State PRE
  }
  Reset-RunnerDatabase
  $shadowSql = @"
create domain public.text as pg_catalog.text;
create function public.b4_shadow_text_concat(pg_catalog.text, pg_catalog.text)
returns pg_catalog.text language sql immutable set search_path=pg_catalog
as `$shadow`$ select pg_catalog.concat('shadow:', `$1, `$2)::pg_catalog.text `$shadow`$;
create operator public.|| (
  function = public.b4_shadow_text_concat,
  leftarg = pg_catalog.text,
  rightarg = pg_catalog.text
);
"@
  Invoke-PsqlSuccess -Label 'Create harmless public normalizer shadows' -DatabaseName 'runner_test_1' `
    -Sql $shadowSql -Username 'supabase_admin' | Out-Null
  $shadowProbe = @(Invoke-PsqlSuccess -Label 'Prove public operator shadow is selectable' `
    -DatabaseName 'runner_test_1' -Username 'supabase_admin' `
    -Sql "set search_path=public,pg_catalog; select 'left'::pg_catalog.text || 'right'::pg_catalog.text;")
  if ($shadowProbe.Count -ne 1 -or $shadowProbe[0] -ne 'shadow:leftright') {
    throw 'The harmless public operator shadow was not active under the adversarial search path.'
  }
  Add-PassedCheck

  Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State POST

  foreach ($kind in @('cancellation', 'termination')) {
    Reset-RunnerDatabase
    Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName -InvocationKind $kind `
      -PauseBeforeCommit -Detach | Out-Null
    $backendPid = Wait-ForPausedFinalizer $kind
    $interruptFunction = if ($kind -eq 'cancellation') { 'pg_cancel_backend' } else { 'pg_terminate_backend' }
    $result = @(Invoke-PsqlSuccess -Label "$kind finalizer backend" -DatabaseName 'postgres' -Username 'supabase_admin' `
      -Sql "select pg_catalog.$interruptFunction($backendPid);")
    if ($result.Count -ne 1 -or $result[0] -ne 't') { throw "$kind did not interrupt the finalizer backend." }
    Add-PassedCheck
    Wait-ForFinalizerExit $kind
    Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State PRE
  }
  Reset-RunnerDatabase
  Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State POST

  Reset-RunnerDatabase
  $bridgeSql = @'
create function public.b4_unallowlisted_owner_bridge()
returns bigint language sql security definer set search_path=pg_catalog
as $$ select pg_catalog.count(*) from public.supplier_ownership_claims $$;
alter function public.b4_unallowlisted_owner_bridge()
owner to mujahiz_claim_human_command_owner;
'@
  Invoke-PsqlSuccess -Label 'Create adversarial owner bridge' -DatabaseName 'runner_test_1' `
    -Sql $bridgeSql -Username 'supabase_admin' | Out-Null
  Invoke-PsqlSuccess -Label 'Prove adversarial PUBLIC bridge callability' -DatabaseName 'runner_test_1' `
    -Sql 'set role anon; select public.b4_unallowlisted_owner_bridge();' -Username 'supabase_admin' | Out-Null
  Add-PassedCheck
  $contaminatedCatalog = @(Get-CatalogTuples 'runner_test_1')
  Invoke-FinalizerExpectedFailure -ExpectedPatterns @('exactly one exact pre-finalization candidate; found 0')
  Assert-CatalogEqual -Expected $contaminatedCatalog -Actual (Get-CatalogTuples 'runner_test_1') `
    -Label 'Adversarial rejection rollback'
  Invoke-PsqlSuccess -Label 'Remove rejected adversarial fixture' -DatabaseName 'runner_test_1' `
    -Sql 'drop function public.b4_unallowlisted_owner_bridge();' -Username 'supabase_admin' | Out-Null
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State PRE

  Invoke-ClaimAuthorizationFinalizer -ContainerName $containerName | Out-Null
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State POST

  $restrictedRoleSql = @'
do $$ begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='mujahiz_claim_unlisted_restricted') then
    create role mujahiz_claim_unlisted_restricted nologin noinherit;
  end if;
end $$;
'@
  Invoke-PsqlSuccess -Label 'Create unlisted restricted role' -DatabaseName 'runner_test_1' `
    -Sql $restrictedRoleSql -Username 'supabase_admin' | Out-Null
  $restrictedRoles = @('anon', 'authenticated', 'service_role', 'mujahiz_claim_runtime',
    'mujahiz_claim_expiry_worker', 'mujahiz_claim_owner_projection',
    'mujahiz_claim_reviewer_projection', 'mujahiz_claim_unlisted_restricted')
  $dmlStatements = @(
    'insert into public.supplier_ownership_claims default values;',
    'update public.supplier_ownership_claims set status=status where false;',
    'delete from public.supplier_ownership_claims where false;'
  )
  foreach ($roleName in $restrictedRoles) {
    foreach ($statement in $dmlStatements) {
      Invoke-PsqlExpectedFailure -Label "$roleName direct Claim DML" -DatabaseName 'runner_test_1' `
        -Sql "set role $roleName; $statement" -Username 'supabase_admin' `
        -ExpectedPattern 'permission denied for table supplier_ownership_claims'
    }
  }
  $ownerRoles = @('mujahiz_claim_human_command_owner', 'mujahiz_claim_expiry_command_owner',
    'mujahiz_claim_target_conflict_helper_owner', 'mujahiz_claim_reviewer_prior_context_helper_owner')
  foreach ($roleName in $restrictedRoles) {
    foreach ($ownerRoleName in $ownerRoles) {
      Invoke-PsqlExpectedFailure -Label "$roleName SET ROLE $ownerRoleName" -DatabaseName 'runner_test_1' `
        -Sql "set session authorization $roleName; set role $ownerRoleName;" -Username 'supabase_admin' `
        -ExpectedPattern ([regex]::Escape("permission denied to set role `"$ownerRoleName`""))
    }
  }
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State POST

  $postOwnerMutationSql = @'
create function public.b4_post_owner_mutation()
returns integer language sql security definer set search_path=pg_catalog as $$ select 1 $$;
alter function public.b4_post_owner_mutation() owner to mujahiz_claim_human_command_owner;
'@
  Invoke-PsqlSuccess -Label 'Create post-state ownership mutation' -DatabaseName 'runner_test_1' `
    -Sql $postOwnerMutationSql -Username 'supabase_admin' | Out-Null
  Assert-CommittedCatalogMismatch -DatabaseName 'runner_test_1' -State POST -Label 'Extra owner mutation'
  Invoke-PsqlSuccess -Label 'Remove post-state ownership mutation' -DatabaseName 'runner_test_1' `
    -Sql 'drop function public.b4_post_owner_mutation();' -Username 'supabase_admin' | Out-Null
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State POST

  $submitSignature = 'supplier_claim.reserve_submit(text,uuid,text,text,jsonb,uuid)'
  Invoke-PsqlSuccess -Label 'Create post-state ACL mutation' -DatabaseName 'runner_test_1' `
    -Sql "grant execute on function $submitSignature to anon;" -Username 'supabase_admin' | Out-Null
  Assert-CommittedCatalogMismatch -DatabaseName 'runner_test_1' -State POST -Label 'Extra ACL mutation'
  Invoke-PsqlSuccess -Label 'Remove post-state ACL mutation' -DatabaseName 'runner_test_1' `
    -Sql "revoke execute on function $submitSignature from anon;" -Username 'supabase_admin' | Out-Null
  Assert-CommittedCatalog -DatabaseName 'runner_test_1' -State POST

  $stopwatch.Stop()
  Write-Output ("Claim authorization security validation passed: {0} checks; {1:n1}s elapsed." -f `
    $checksPassed, $stopwatch.Elapsed.TotalSeconds)
}
finally {
  if ($stopwatch.IsRunning) { $stopwatch.Stop() }
  if ($containerStarted) { & docker rm --force $containerName *> $null }
}
