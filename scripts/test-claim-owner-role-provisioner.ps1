[CmdletBinding()]
param([string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Resolve-Path (Join-Path $PSScriptRoot '..')).Path).TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
)
$mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
$assetRepositoryPath = 'supabase/local-bootstrap/claim-owner-roles.sql'
$assetContainerPath = '/workspace/supabase/local-bootstrap/claim-owner-roles.sql'
$expectedAssetSha256 = '52fe86ad84f1ebb8c12c0439d7de7583dcbf69d76862274505667b5a62d10077'
$rolePattern = '^mujahiz_claim_.+_owner.*$'
$ownerRoles = @(
  'mujahiz_claim_human_command_owner',
  'mujahiz_claim_expiry_command_owner',
  'mujahiz_claim_target_conflict_helper_owner',
  'mujahiz_claim_reviewer_prior_context_helper_owner'
)
$ordinaryActors = @(
  'postgres',
  'mujahiz_claim_runtime',
  'mujahiz_claim_expiry_worker',
  'mujahiz_claim_owner_projection',
  'mujahiz_claim_reviewer_projection',
  'anon',
  'authenticated',
  'service_role',
  'b4p1_unlisted_actor'
)
$expectedRoleSql = @"
select oid, rolname
from pg_catalog.pg_roles
where rolname in (
  'mujahiz_claim_human_command_owner',
  'mujahiz_claim_expiry_command_owner',
  'mujahiz_claim_target_conflict_helper_owner',
  'mujahiz_claim_reviewer_prior_context_helper_owner'
)
"@
$createdContainers = [System.Collections.Generic.List[string]]::new()
$temporaryRoots = [System.Collections.Generic.List[string]]::new()
$checksPassed = 0
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$symlinkProbeStatus = 'not attempted'
$provisionerPath = Join-Path $PSScriptRoot 'claim-owner-role-provisioner.ps1'
$gitExecutable = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source

. $provisionerPath

function Invoke-ContainerSql {
  param(
    [Parameter(Mandatory)][string]$ContainerName,
    [Parameter(Mandatory)][string]$Sql,
    [switch]$Privileged
  )

  $databaseUser = if ($Privileged) { 'supabase_admin' } else { 'postgres' }
  $psqlArguments = @(
    '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--host=/var/run/postgresql', '--port=5432',
    "--username=$databaseUser",
    '--dbname=postgres', '--quiet', '--tuples-only', '--no-align', '--pset', 'footer=off',
    '--command', $Sql
  )
  $libpqEnvironmentToUnset = @(
    'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSFILE',
    'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR', 'PGOPTIONS', 'PGCONNECT_TIMEOUT',
    'PGCLIENTENCODING', 'PGTARGETSESSIONATTRS', 'PGLOADBALANCEHOSTS', 'PGCHANNELBINDING',
    'PGSSLMODE', 'PGREQUIRESSL', 'PGSSLNEGOTIATION', 'PGSSLCOMPRESSION', 'PGSSLCERT',
    'PGSSLKEY', 'PGSSLROOTCERT', 'PGSSLCRL', 'PGSSLCRLDIR', 'PGREQUIREPEER',
    'PGSSLMINPROTOCOLVERSION', 'PGSSLMAXPROTOCOLVERSION', 'PGGSSENCMODE',
    'PGKRBSRVNAME', 'PGGSSLIB'
  )
  $dockerArguments = @(
    'exec', '--env', 'PGAPPNAME=mujahiz_claim_owner_role_validation', $ContainerName, '/usr/bin/env'
  )
  foreach ($environmentName in $libpqEnvironmentToUnset) {
    $dockerArguments += @('-u', $environmentName)
  }
  $dockerArguments += '/usr/bin/psql'
  $dockerArguments += $psqlArguments

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = @(& docker @dockerArguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($exitCode -ne 0) {
    throw "Focused SQL probe failed.$([Environment]::NewLine)$($output -join [Environment]::NewLine)"
  }
  return @($output | Where-Object { $_ -ne '' })
}

function Start-TestContainer {
  param(
    [string[]]$MountSpecs = @($mount),
    [string[]]$AdditionalEnvironment = @()
  )

  $containerName = "mujahiz-b4p1-validation-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
  $runArguments = @('run', '--detach', '--rm', '--name', $containerName)
  foreach ($mountSpec in $MountSpecs) { $runArguments += @('--mount', $mountSpec) }
  $runArguments += @(
    '--env', 'POSTGRES_PASSWORD=postgres',
    '--env', 'PGPASSWORD=postgres',
    '--env', 'POSTGRES_DB=postgres'
  )
  foreach ($environmentValue in $AdditionalEnvironment) {
    $runArguments += @('--env', $environmentValue)
  }
  $runArguments += $PostgresImage
  $containerOutput = @(& docker @runArguments 2>&1 | ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to start focused disposable PostgreSQL container.$([Environment]::NewLine)$($containerOutput -join [Environment]::NewLine)"
  }
  $createdContainers.Add($containerName)

  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    docker exec $containerName pg_isready --host=/var/run/postgresql --port=5432 --username=postgres --dbname=postgres *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    docker exec $containerName sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
    $initializationInProgress = $LASTEXITCODE -eq 0
    if ($databaseReady -and -not $initializationInProgress) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'Focused disposable PostgreSQL readiness check failed.' }
  return $containerName
}

function Stop-TestContainer {
  param([string]$ContainerName)
  if ($ContainerName) { docker rm --force $ContainerName *> $null }
}

function Assert-Equal {
  param($Actual, $Expected, [string]$Label)
  if ([string]$Actual -ne [string]$Expected) {
    throw "$Label expected [$Expected] but observed [$Actual]."
  }
  $script:checksPassed++
}

function Assert-GreaterThanZero {
  param($Actual, [string]$Label)
  if ([int]$Actual -le 0) { throw "$Label expected a positive count but observed [$Actual]." }
  $script:checksPassed++
}

function Assert-Matches {
  param([string]$Actual, [string]$Pattern, [string]$Label)
  if ($Actual -notmatch $Pattern) {
    throw "$Label expected pattern [$Pattern] but observed [$Actual]."
  }
  $script:checksPassed++
}

function Get-RawGitBlobIdentity {
  param(
    [Parameter(Mandatory)][string]$RepositoryRoot,
    [Parameter(Mandatory)][string]$Revision,
    [Parameter(Mandatory)][string]$RepositoryPath
  )

  $objectIdOutput = @(& $gitExecutable -C $RepositoryRoot rev-parse "$Revision`:$RepositoryPath" 2>&1 |
    ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0 -or $objectIdOutput.Count -ne 1 -or $objectIdOutput[0] -notmatch '^[0-9a-f]{40,64}$') {
    throw "Unable to resolve the exact Git blob for $Revision`:$RepositoryPath."
  }

  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $gitExecutable
  $processInfo.Arguments = "cat-file blob $($objectIdOutput[0])"
  $processInfo.WorkingDirectory = $RepositoryRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::Start($processInfo)
  $rawBytes = [System.IO.MemoryStream]::new()
  try {
    $process.StandardOutput.BaseStream.CopyTo($rawBytes)
    $errorOutput = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      throw "Binary-safe git cat-file failed: $errorOutput"
    }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $digest = ([System.BitConverter]::ToString($sha256.ComputeHash($rawBytes.ToArray()))).Replace('-', '').ToLowerInvariant()
    }
    finally { $sha256.Dispose() }
    return [pscustomobject]@{
      ObjectId = $objectIdOutput[0]
      Size = $rawBytes.Length
      Sha256 = $digest
    }
  }
  finally {
    $rawBytes.Dispose()
    $process.Dispose()
  }
}

function Get-MountedAssetIdentity {
  param([Parameter(Mandatory)][string]$ContainerName)

  $sizeOutput = @(& docker exec $ContainerName stat '--format=%s' $assetContainerPath 2>&1 |
    ForEach-Object { $_.ToString() })
  $sizeExitCode = $LASTEXITCODE
  $hashOutput = @(& docker exec $ContainerName sha256sum $assetContainerPath 2>&1 |
    ForEach-Object { $_.ToString() })
  $hashExitCode = $LASTEXITCODE
  if ($sizeExitCode -ne 0 -or $sizeOutput.Count -ne 1 -or $sizeOutput[0] -notmatch '^\d+$' -or
      $hashExitCode -ne 0 -or $hashOutput.Count -ne 1 -or
      $hashOutput[0] -notmatch '^([0-9a-f]{64})\s+/workspace/supabase/local-bootstrap/claim-owner-roles\.sql$') {
    throw 'Unable to read the exact mounted asset byte identity.'
  }
  return [pscustomobject]@{
    Size = [long]$sizeOutput[0]
    Sha256 = $Matches[1]
  }
}

function Get-CarriageReturnCount {
  param([Parameter(Mandatory)][byte[]]$Bytes)
  $count = 0
  foreach ($value in $Bytes) {
    if ($value -eq 13) { $count++ }
  }
  return $count
}
function New-TemporaryRepositoryCopy {
  $temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $temporaryRoot = Join-Path $temporaryBase "mujahiz-b4p1-$PID-$([guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Path (Join-Path $temporaryRoot 'scripts') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $temporaryRoot 'supabase\local-bootstrap') -Force | Out-Null
  Copy-Item -LiteralPath $provisionerPath -Destination (Join-Path $temporaryRoot 'scripts\claim-owner-role-provisioner.ps1')
  Copy-Item -LiteralPath (Join-Path $repoRoot 'supabase\local-bootstrap\claim-owner-roles.sql') `
    -Destination (Join-Path $temporaryRoot 'supabase\local-bootstrap\claim-owner-roles.sql')
  $temporaryRoots.Add($temporaryRoot)
  return $temporaryRoot
}

function New-FreshAutocrlfCheckout {
  param([Parameter(Mandatory)][string]$HeadCommit)

  $temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $temporaryRoot = Join-Path $temporaryBase "mujahiz-b4p1-$PID-$([guid]::NewGuid().ToString('N'))"
  $temporaryRoots.Add($temporaryRoot)
  $cloneOutput = @(& $gitExecutable -c core.autocrlf=true clone --quiet --no-local --no-checkout -- $repoRoot $temporaryRoot 2>&1 |
    ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to create the disposable core.autocrlf=true checkout.$([Environment]::NewLine)$($cloneOutput -join [Environment]::NewLine)"
  }
  & $gitExecutable -C $temporaryRoot config --local core.autocrlf true
  if ($LASTEXITCODE -ne 0) { throw 'Unable to set disposable checkout core.autocrlf=true.' }
  $checkoutOutput = @(& $gitExecutable -C $temporaryRoot checkout --quiet --detach $HeadCommit 2>&1 |
    ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to check out the exact HEAD in the disposable repository.$([Environment]::NewLine)$($checkoutOutput -join [Environment]::NewLine)"
  }
  return $temporaryRoot
}
function Remove-TemporaryRoot {
  param([Parameter(Mandatory)][string]$Path)

  $resolvedPath = [System.IO.Path]::GetFullPath($Path).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $comparison = if ([System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT) {
    [System.StringComparison]::OrdinalIgnoreCase
  }
  else { [System.StringComparison]::Ordinal }
  $requiredPrefix = $temporaryBase + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedPath.StartsWith($requiredPrefix, $comparison) -or
      [System.IO.Path]::GetFileName($resolvedPath) -notlike 'mujahiz-b4p1-*') {
    throw "Refusing to recursively remove an unverified temporary path: $resolvedPath"
  }
  if (Test-Path -LiteralPath $resolvedPath) {
    Remove-Item -LiteralPath $resolvedPath -Recurse -Force
  }
}

function Get-CopiedProvisionerFailure {
  param(
    [Parameter(Mandatory)][string]$TemporaryRoot,
    [Parameter(Mandatory)][string]$ContainerName
  )

  $temporaryProvisioner = Join-Path $TemporaryRoot 'scripts\claim-owner-role-provisioner.ps1'
  return & {
    param($Provisioner, $Container)
    . $Provisioner
    try {
      Invoke-ClaimOwnerRoleProvisioner -ContainerName $Container | Out-Null
      return ''
    }
    catch { return $_.Exception.Message }
  } $temporaryProvisioner $ContainerName
}

function Invoke-ProvisionerWithHostileLibpqEnvironment {
  param([Parameter(Mandatory)][string]$ContainerName)

  $dockerExecutable = (Get-Command docker.exe -ErrorAction Stop).Source
  & {
    param($TargetContainer, $DockerExecutable)
    function docker {
      $forwardArguments = @($args)
      if ($forwardArguments.Count -gt 0 -and $forwardArguments[0] -eq 'exec') {
        $hostileArguments = @('exec')
        foreach ($hostileValue in @(
          'PGHOST=203.0.113.1',
          'PGHOSTADDR=192.0.2.1',
          'PGPORT=1',
          'PGDATABASE=definitely_not_postgres',
          'PGUSER=definitely_not_supabase_admin',
          'PGSERVICE=missing_service',
          'PGSERVICEFILE=/workspace/supabase/local-bootstrap/claim-owner-roles.sql',
          'PGSYSCONFDIR=/workspace/supabase/local-bootstrap',
          'PGOPTIONS=-c statement_timeout=1'
        )) {
          $hostileArguments += @('--env', $hostileValue)
        }
        if ($forwardArguments.Count -gt 1) {
          $hostileArguments += @($forwardArguments[1..($forwardArguments.Count - 1)])
        }
        & $DockerExecutable @hostileArguments
      }
      else { & $DockerExecutable @forwardArguments }
    }
    Invoke-ClaimOwnerRoleProvisioner -ContainerName $TargetContainer | Out-Null
  } $ContainerName $dockerExecutable
}

function Invoke-ProvisionerWithMountedHashMismatch {
  param([Parameter(Mandatory)][string]$ContainerName)

  $dockerExecutable = (Get-Command docker.exe -ErrorAction Stop).Source
  return & {
    param($TargetContainer, $DockerExecutable, $ExpectedAssetPath)
    $shimState = [pscustomobject]@{
      FailureMessage = ''
      Interceptions = 0
      ProvisionerSucceeded = $false
      ShimRemoved = $false
    }
    try {
      function docker {
        $forwardArguments = @($args)
        $isExactMountedHashCall = (
          $forwardArguments.Count -eq 4 -and
          $forwardArguments[0] -eq 'exec' -and
          $forwardArguments[1] -eq $TargetContainer -and
          $forwardArguments[2] -eq 'sha256sum' -and
          $forwardArguments[3] -eq $ExpectedAssetPath
        )
        if ($isExactMountedHashCall) {
          $realOutput = @(& $DockerExecutable @forwardArguments 2>&1 | ForEach-Object { $_.ToString() })
          if ($LASTEXITCODE -ne 0) {
            $realOutput
            return
          }
          $shimState.Interceptions++
          ('f' * 64) + "  $ExpectedAssetPath"
          return
        }
        & $DockerExecutable @forwardArguments
      }

      try {
        Invoke-ClaimOwnerRoleProvisioner -ContainerName $TargetContainer | Out-Null
        $shimState.ProvisionerSucceeded = $true
      }
      catch { $shimState.FailureMessage = $_.Exception.Message }
    }
    finally {
      Remove-Item -LiteralPath Function:\docker -Force -ErrorAction SilentlyContinue
      $shimState.ShimRemoved = -not (Test-Path -LiteralPath Function:\docker)
    }
    return $shimState
  } $ContainerName $dockerExecutable $assetContainerPath
}
function Get-ExpectedRoleCount {
  param([string]$ContainerName)
  return @(Invoke-ContainerSql -ContainerName $ContainerName -Sql "select count(*) from ($expectedRoleSql) expected;")[-1]
}

function Reset-ProbeState {
  param([string]$ContainerName)
  $resetSql = @'
do $block$
declare
  role_name text;
begin
  for role_name in
    select rolname
    from pg_catalog.pg_roles
    where rolname in (
      'mujahiz_claim_human_command_owner',
      'mujahiz_claim_expiry_command_owner',
      'mujahiz_claim_target_conflict_helper_owner',
      'mujahiz_claim_reviewer_prior_context_helper_owner',
      'mujahiz_claim_unexpected_owner',
      'mujahiz_claim_human_command_owner_backup',
      'mujahiz_claim_expiry_command_ownership',
      'b4p1_restricted_probe'
    )
  loop
    execute pg_catalog.format('drop owned by %I cascade', role_name);
  end loop;
end
$block$;
drop schema if exists b4p1_probe cascade;
do $block$
declare
  role_name text;
begin
  for role_name in
    select rolname
    from pg_catalog.pg_roles
    where rolname in (
      'mujahiz_claim_human_command_owner',
      'mujahiz_claim_expiry_command_owner',
      'mujahiz_claim_target_conflict_helper_owner',
      'mujahiz_claim_reviewer_prior_context_helper_owner',
      'mujahiz_claim_unexpected_owner',
      'mujahiz_claim_human_command_owner_backup',
      'mujahiz_claim_expiry_command_ownership',
      'b4p1_restricted_probe'
    )
  loop
    execute pg_catalog.format('drop role %I', role_name);
  end loop;
end
$block$;
'@
  Invoke-ContainerSql -ContainerName $ContainerName -Sql $resetSql -Privileged | Out-Null
}

function Assert-ProvisioningFails {
  param(
    [string]$ContainerName,
    [string]$Label,
    [string]$FailurePoint = '',
    [string]$ExpectedMessagePattern = ''
  )
  $failed = $false
  $failureMessage = ''
  try {
    Invoke-ClaimOwnerRoleProvisioner -ContainerName $ContainerName -FailurePoint $FailurePoint | Out-Null
  }
  catch {
    $failed = $true
    $failureMessage = $_.Exception.Message
  }
  Assert-Equal -Actual $failed -Expected $true -Label $Label
  if ($ExpectedMessagePattern) {
    Assert-Matches -Actual $failureMessage -Pattern $ExpectedMessagePattern -Label "$Label returns the expected fail-closed reason"
  }
}

function Ensure-TestActors {
  param([Parameter(Mandatory)][string]$ContainerName)

  $sql = @(
    'do $block$',
    'declare',
    '  actor_name text;',
    'begin',
    '  for actor_name in',
    '    select value from (values',
    "      ('mujahiz_claim_runtime'),",
    "      ('mujahiz_claim_expiry_worker'),",
    "      ('mujahiz_claim_owner_projection'),",
    "      ('mujahiz_claim_reviewer_projection'),",
    "      ('anon'),",
    "      ('authenticated'),",
    "      ('service_role'),",
    "      ('b4p1_unlisted_actor')",
    '    ) actors(value)',
    '  loop',
    '    if not exists (select 1 from pg_catalog.pg_roles where rolname = actor_name) then',
    "      execute pg_catalog.format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null', actor_name);",
    '    end if;',
    '  end loop;',
    'end',
    '$block$;'
  ) -join [Environment]::NewLine
  Invoke-ContainerSql -ContainerName $ContainerName -Sql $sql -Privileged | Out-Null
}

function Invoke-SetRoleDenialProbe {
  param(
    [Parameter(Mandatory)][string]$ContainerName,
    [Parameter(Mandatory)][string]$Actor,
    [Parameter(Mandatory)][string]$OwnerRole
  )

  if ($Actor -notmatch '^[a-z0-9_]+$' -or $OwnerRole -notmatch '^[a-z0-9_]+$') {
    throw 'SET ROLE probes accept only the fixed repository role inventories.'
  }
  $psqlArguments = @(
    '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose',
    '--host=/var/run/postgresql', '--port=5432', '--username=supabase_admin', '--dbname=postgres',
    '--quiet', '--tuples-only', '--no-align', '--pset', 'footer=off',
    '--command', "set session authorization $Actor; select 'B4P1_ACTOR:' || session_user || ':' || current_user;",
    '--command', "set role $OwnerRole;",
    '--command', "select 'B4P1_OWNER_ASSUMED:' || current_user;"
  )
  $libpqEnvironmentToUnset = @(
    'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSFILE',
    'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR', 'PGOPTIONS', 'PGCONNECT_TIMEOUT',
    'PGCLIENTENCODING', 'PGTARGETSESSIONATTRS', 'PGLOADBALANCEHOSTS', 'PGCHANNELBINDING',
    'PGSSLMODE', 'PGREQUIRESSL', 'PGSSLNEGOTIATION', 'PGSSLCOMPRESSION', 'PGSSLCERT',
    'PGSSLKEY', 'PGSSLROOTCERT', 'PGSSLCRL', 'PGSSLCRLDIR', 'PGREQUIREPEER',
    'PGSSLMINPROTOCOLVERSION', 'PGSSLMAXPROTOCOLVERSION', 'PGGSSENCMODE',
    'PGKRBSRVNAME', 'PGGSSLIB'
  )
  $dockerArguments = @(
    'exec', '--env', 'PGAPPNAME=mujahiz_claim_owner_set_role_validation', $ContainerName, '/usr/bin/env'
  )
  foreach ($environmentName in $libpqEnvironmentToUnset) {
    $dockerArguments += @('-u', $environmentName)
  }
  $dockerArguments += '/usr/bin/psql'
  $dockerArguments += $psqlArguments

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = @(& docker @dockerArguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  $combinedOutput = $output -join [Environment]::NewLine
  return [pscustomobject]@{
    ActorEstablished = $combinedOutput -match [regex]::Escape("B4P1_ACTOR:${Actor}:${Actor}")
    Denied = $exitCode -ne 0
    ExpectedSqlState = $combinedOutput -match '\b42501\b'
    OwnerSentinelAbsent = $combinedOutput -notmatch 'B4P1_OWNER_ASSUMED:'
  }
}

function Get-AcceptedFingerprint {
  param([string]$ContainerName)
  $sql = @"
with expected as ($expectedRoleSql),
role_shape as (
  select pg_catalog.string_agg(
    pg_catalog.concat_ws(':', a.rolname, a.rolsuper, a.rolinherit, a.rolcreaterole,
      a.rolcreatedb, a.rolcanlogin, a.rolreplication, a.rolbypassrls,
      a.rolconnlimit, a.rolpassword is null, a.rolvaliduntil is null),
    ',' order by a.rolname
  ) as value
  from pg_catalog.pg_authid a join expected e on e.oid = a.oid
)
select coalesce(role_shape.value, '<none>')
  || '|members=' || (select count(*) from pg_catalog.pg_auth_members m, expected e where m.roleid=e.oid or m.member=e.oid)
  || '|setpaths=' || (select count(*) from pg_catalog.pg_roles actor, expected e where not actor.rolsuper and actor.oid<>e.oid and pg_catalog.pg_has_role(actor.oid,e.oid,'SET'))
  || '|shdepend=' || (select count(*) from pg_catalog.pg_shdepend d, expected e where d.refclassid='pg_catalog.pg_authid'::pg_catalog.regclass and d.refobjid=e.oid)
  || '|settings=' || (select count(*) from pg_catalog.pg_db_role_setting s, expected e where s.setrole=e.oid)
  || '|parameter_acl=' || (select count(*) from pg_catalog.pg_parameter_acl p cross join lateral pg_catalog.aclexplode(p.paracl) acl, expected e where acl.grantee=e.oid)
from role_shape;
"@
  return @(Invoke-ContainerSql -ContainerName $ContainerName -Sql $sql -Privileged)[-1]
}

function Wait-ForPausedProvisioner {
  param([string]$ContainerName, [ValidateSet('cancellation', 'termination')][string]$InvocationKind)
  $applicationName = "mujahiz_claim_owner_role_provisioner_$InvocationKind"
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    $pidValue = @(Invoke-ContainerSql -ContainerName $ContainerName -Privileged -Sql "select pid from pg_catalog.pg_stat_activity where application_name='$applicationName' and wait_event='PgSleep';")[-1]
    if ($pidValue) { return $pidValue }
    Start-Sleep -Milliseconds 250
  }
  throw "The $InvocationKind interruption probe did not reach its pre-commit pause."
}

function Wait-ForProvisionerExit {
  param([string]$ContainerName, [ValidateSet('cancellation', 'termination')][string]$InvocationKind)
  $applicationName = "mujahiz_claim_owner_role_provisioner_$InvocationKind"
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    $count = @(Invoke-ContainerSql -ContainerName $ContainerName -Privileged -Sql "select count(*) from pg_catalog.pg_stat_activity where application_name='$applicationName';")[-1]
    if ($count -eq '0') { return }
    Start-Sleep -Milliseconds 250
  }
  throw "The $InvocationKind interruption probe did not exit."
}

$activeContainer = $null
try {
  $activeContainer = Start-TestContainer

  $provisionerCommand = Get-Command Invoke-ClaimOwnerRoleProvisioner
  Assert-Equal $provisionerCommand.Parameters.ContainsKey('DatabaseName') $false '-DatabaseName is not a supported provisioner parameter'
  $callerControlledTargetParameters = @(
    'DatabaseName', 'Host', 'HostAddress', 'Port', 'Username', 'Service',
    'ConnectionString', 'Uri', 'Conninfo', 'SqlPath'
  )
  $presentTargetParameters = @($callerControlledTargetParameters | Where-Object { $provisionerCommand.Parameters.ContainsKey($_) })
  Assert-Equal $presentTargetParameters.Count 0 'provisioner exposes no caller-controlled connection or SQL target parameter'
  $preBindingRoleCount = Get-ExpectedRoleCount $activeContainer
  foreach ($unsupportedTarget in @(
    @{ Label = 'PostgreSQL URI'; Value = 'postgresql://supabase_admin@203.0.113.1:1/external' },
    @{ Label = 'PostgreSQL conninfo'; Value = 'host=203.0.113.1 port=1 dbname=external user=redirected' }
  )) {
    $bindingRejected = $false
    try {
      $unsupportedArguments = @{
        ContainerName = $activeContainer
        DatabaseName = $unsupportedTarget.Value
      }
      Invoke-ClaimOwnerRoleProvisioner @unsupportedArguments | Out-Null
    }
    catch {
      $bindingRejected = $_.Exception -is [System.Management.Automation.ParameterBindingException]
    }
    Assert-Equal $bindingRejected $true "$($unsupportedTarget.Label) cannot be supplied through removed -DatabaseName"
  }
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) $preBindingRoleCount 'rejected URI and conninfo inputs execute no privileged SQL'

  $provisionerSource = Get-Content -Raw -LiteralPath $provisionerPath
  Assert-Matches $provisionerSource "--host=/var/run/postgresql'.*--port=5432" 'provisioner hard-binds the pinned Unix socket and port'
  Assert-Matches $provisionerSource "--username=supabase_admin'.*--dbname=postgres" 'provisioner hard-binds the bootstrap actor and postgres database'
  Assert-Matches $provisionerSource "'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER'" 'provisioner clears ambient libpq routing environment'
  Assert-Matches $provisionerSource 'FileAttributes]::ReparsePoint' 'provisioner explicitly rejects host reparse-point substitution'
  Assert-Equal ([regex]::Matches($provisionerSource, [regex]::Escape($expectedAssetSha256))).Count 1 'provisioner contains exactly one canonical reviewed SHA-256 literal'

  $attributeOutput = @(& $gitExecutable -C $repoRoot check-attr text eol -- $assetRepositoryPath)
  Assert-Equal $LASTEXITCODE 0 'Git resolves attributes for the fixed privileged asset'
  Assert-Equal $attributeOutput.Count 2 'Git reports exactly the requested text and eol attributes'
  Assert-Equal $attributeOutput[0] "$assetRepositoryPath`: text: set" 'privileged asset resolves as text'
  Assert-Equal $attributeOutput[1] "$assetRepositoryPath`: eol: lf" 'privileged asset resolves to canonical LF checkout behavior'

  $headCommit = @(& $gitExecutable -C $repoRoot rev-parse HEAD)[-1]
  Assert-Matches $headCommit '^[0-9a-f]{40}$' 'focused byte binding runs against an exact committed HEAD'
  $rawGitIdentity = Get-RawGitBlobIdentity -RepositoryRoot $repoRoot -Revision $headCommit -RepositoryPath $assetRepositoryPath
  $hostAssetPath = Join-Path $repoRoot 'supabase\local-bootstrap\claim-owner-roles.sql'
  $hostAssetBytes = [System.IO.File]::ReadAllBytes($hostAssetPath)
  $hostAssetHash = (Get-FileHash -LiteralPath $hostAssetPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-Equal (Get-CarriageReturnCount $hostAssetBytes) 0 'fixed host asset contains no CR or CRLF bytes'
  Assert-Equal $rawGitIdentity.Sha256 $expectedAssetSha256 'raw Git blob SHA-256 matches the reviewed literal'
  Assert-Equal $hostAssetHash $rawGitIdentity.Sha256 'host asset SHA-256 matches the raw Git blob'
  Assert-Equal $hostAssetBytes.Length $rawGitIdentity.Size 'host asset byte size matches the raw Git blob'

  $mountedAssetIdentity = Get-MountedAssetIdentity -ContainerName $activeContainer
  Assert-Equal $mountedAssetIdentity.Sha256 $rawGitIdentity.Sha256 'mounted asset SHA-256 matches the raw Git blob'
  Assert-Equal $mountedAssetIdentity.Size $rawGitIdentity.Size 'mounted asset byte size matches the raw Git blob'

  $freshCheckout = New-FreshAutocrlfCheckout -HeadCommit $headCommit
  $freshAssetPath = Join-Path $freshCheckout 'supabase\local-bootstrap\claim-owner-roles.sql'
  $freshAssetBytes = [System.IO.File]::ReadAllBytes($freshAssetPath)
  $freshAssetHash = (Get-FileHash -LiteralPath $freshAssetPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-Equal @(& $gitExecutable -C $freshCheckout config --local --get core.autocrlf)[-1] 'true' 'disposable checkout uses repository-local core.autocrlf=true'
  Assert-Equal (Get-CarriageReturnCount $freshAssetBytes) 0 'core.autocrlf=true fresh checkout preserves canonical LF bytes'
  Assert-Equal $freshAssetHash $rawGitIdentity.Sha256 'core.autocrlf=true fresh checkout SHA-256 matches the raw Git blob'
  Assert-Equal $freshAssetBytes.Length $rawGitIdentity.Size 'core.autocrlf=true fresh checkout byte size matches the raw Git blob'

  $mountedMismatchFingerprint = Get-AcceptedFingerprint $activeContainer
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' 'mounted-hash isolation starts before any owner role exists'
  $mountedMismatch = Invoke-ProvisionerWithMountedHashMismatch -ContainerName $activeContainer
  Assert-Equal $mountedMismatch.ProvisionerSucceeded $false 'test-only mounted sha256sum mismatch is rejected'
  Assert-Equal $mountedMismatch.Interceptions 1 'test-only Docker shim intercepts exactly the mounted sha256sum invocation'
  Assert-Matches $mountedMismatch.FailureMessage '^Claim owner-role provisioning rejected the mounted asset identity\.$' 'mounted sha256sum mismatch reaches the specific mounted-asset identity rejection'
  Assert-Equal $mountedMismatch.ShimRemoved $true 'test-only Docker command shim is removed in finally'
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' 'mounted sha256sum mismatch creates zero owner roles'
  Assert-Equal (Get-AcceptedFingerprint $activeContainer) $mountedMismatchFingerprint 'mounted sha256sum mismatch leaves the owner-role catalog fingerprint unchanged'

  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '4' 'clean provisioning role count'
  $exactShapeSql = "select count(*) from pg_catalog.pg_authid a where a.rolname ~ '$rolePattern' and not a.rolsuper and not a.rolinherit and not a.rolcreaterole and not a.rolcreatedb and not a.rolcanlogin and not a.rolreplication and not a.rolbypassrls and a.rolconnlimit=-1 and a.rolpassword is null and a.rolvaliduntil is null;"
  $exactShape = @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql $exactShapeSql)[-1]
  Assert-Equal $exactShape '4' 'exact role attributes and null credentials'
  $beforeOids = @(Invoke-ContainerSql -ContainerName $activeContainer -Sql "select pg_catalog.string_agg(oid::text,',' order by rolname) from ($expectedRoleSql) expected;")[-1]
  $firstFingerprint = Get-AcceptedFingerprint $activeContainer
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  $afterOids = @(Invoke-ContainerSql -ContainerName $activeContainer -Sql "select pg_catalog.string_agg(oid::text,',' order by rolname) from ($expectedRoleSql) expected;")[-1]
  Assert-Equal $afterOids $beforeOids 'same-cluster no-op preserves exact role OIDs'
  Assert-Equal (Get-AcceptedFingerprint $activeContainer) $firstFingerprint 'same-cluster no-op preserves accepted catalog'

  Invoke-ProvisionerWithHostileLibpqEnvironment -ContainerName $activeContainer
  Assert-Equal (Get-AcceptedFingerprint $activeContainer) $firstFingerprint 'hostile libpq routing environment cannot redirect the fixed local endpoint'

  $alternateRoot = New-TemporaryRepositoryCopy
  $alternateContainer = Start-TestContainer -MountSpecs @("type=bind,source=$alternateRoot,target=/workspace,readonly")
  try {
    Assert-ProvisioningFails -ContainerName $alternateContainer `
      -Label 'alternate read-only tree at /workspace is rejected' `
      -ExpectedMessagePattern 'outside the pinned disposable boundary'
  }
  finally { Stop-TestContainer $alternateContainer }

  $shadowRoot = New-TemporaryRepositoryCopy
  $shadowAsset = Join-Path $shadowRoot 'supabase\local-bootstrap\claim-owner-roles.sql'
  [System.IO.File]::AppendAllText($shadowAsset, "-- synthetic nested-mount substitution`r`n", [System.Text.UTF8Encoding]::new($false))
  $shadowDirectory = Join-Path $shadowRoot 'supabase\local-bootstrap'
  $nestedMountContainer = Start-TestContainer -MountSpecs @(
    $mount,
    "type=bind,source=$shadowDirectory,target=/workspace/supabase/local-bootstrap,readonly"
  )
  try {
    Assert-ProvisioningFails -ContainerName $nestedMountContainer `
      -Label 'additional nested mount shadowing the asset parent is rejected' `
      -ExpectedMessagePattern 'outside the pinned disposable boundary'
  }
  finally { Stop-TestContainer $nestedMountContainer }

  $volumeWorkspaceContainer = Start-TestContainer -MountSpecs @('type=volume,target=/workspace,readonly')
  try {
    Assert-ProvisioningFails -ContainerName $volumeWorkspaceContainer `
      -Label 'non-bind workspace volume is rejected' `
      -ExpectedMessagePattern 'outside the pinned disposable boundary'
  }
  finally { Stop-TestContainer $volumeWorkspaceContainer }

  $modifiedAssetRoot = New-TemporaryRepositoryCopy
  $modifiedAssetPath = Join-Path $modifiedAssetRoot 'supabase\local-bootstrap\claim-owner-roles.sql'
  $modifiedAssetText = [System.IO.File]::ReadAllText($modifiedAssetPath)
  if ($modifiedAssetText.Contains("`r")) { throw 'CRLF representation probe requires a canonical LF source asset.' }
  [System.IO.File]::WriteAllText(
    $modifiedAssetPath,
    $modifiedAssetText.Replace("`n", "`r`n"),
    [System.Text.UTF8Encoding]::new($false)
  )
  $modifiedAssetContainer = Start-TestContainer -MountSpecs @(
    "type=bind,source=$modifiedAssetRoot,target=/workspace,readonly"
  )
  try {
    $modifiedAssetFailure = Get-CopiedProvisionerFailure -TemporaryRoot $modifiedAssetRoot -ContainerName $modifiedAssetContainer
    Assert-Matches $modifiedAssetFailure 'host asset SHA-256 mismatch' 'CRLF checkout representation is rejected before privileged SQL'
    Assert-Equal (Get-ExpectedRoleCount $modifiedAssetContainer) '0' 'CRLF checkout representation creates no owner role'
  }
  finally { Stop-TestContainer $modifiedAssetContainer }

  $wrongHashRoot = New-TemporaryRepositoryCopy
  $wrongHashProvisioner = Join-Path $wrongHashRoot 'scripts\claim-owner-role-provisioner.ps1'
  $wrongHashSource = [System.IO.File]::ReadAllText($wrongHashProvisioner)
  if (([regex]::Matches($wrongHashSource, [regex]::Escape($expectedAssetSha256))).Count -ne 1) {
    throw 'Temporary wrong-hash probe expected exactly one reviewed SHA-256 literal.'
  }
  [System.IO.File]::WriteAllText(
    $wrongHashProvisioner,
    $wrongHashSource.Replace($expectedAssetSha256, ('0' * 64)),
    [System.Text.UTF8Encoding]::new($false)
  )
  $wrongHashContainer = Start-TestContainer -MountSpecs @(
    "type=bind,source=$wrongHashRoot,target=/workspace,readonly"
  )
  try {
    $wrongHashFailure = Get-CopiedProvisionerFailure -TemporaryRoot $wrongHashRoot -ContainerName $wrongHashContainer
    Assert-Matches $wrongHashFailure 'host asset SHA-256 mismatch' 'wrong literal asset SHA-256 is rejected'
    Assert-Equal (Get-ExpectedRoleCount $wrongHashContainer) '0' 'wrong asset SHA-256 creates no owner role'
  }
  finally { Stop-TestContainer $wrongHashContainer }

  $symlinkRoot = New-TemporaryRepositoryCopy
  $symlinkAsset = Join-Path $symlinkRoot 'supabase\local-bootstrap\claim-owner-roles.sql'
  $symlinkTarget = Join-Path $symlinkRoot 'synthetic-claim-owner-roles.sql'
  Copy-Item -LiteralPath $symlinkAsset -Destination $symlinkTarget
  $safeSymlinkRoot = [System.IO.Path]::GetFullPath($symlinkRoot) + [System.IO.Path]::DirectorySeparatorChar
  $safeSymlinkAsset = [System.IO.Path]::GetFullPath($symlinkAsset)
  if (-not $safeSymlinkAsset.StartsWith($safeSymlinkRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to replace an asset outside the verified symlink-probe root.'
  }
  Remove-Item -LiteralPath $symlinkAsset -Force
  $symlinkCreated = $false
  try {
    New-Item -ItemType SymbolicLink -Path $symlinkAsset -Target $symlinkTarget -ErrorAction Stop | Out-Null
    $symlinkCreated = $true
  }
  catch {
    $symlinkProbeStatus = "unavailable without host symlink privilege ($($_.Exception.GetType().Name)); explicit reparse guard and nested-mount substitution were exercised"
  }
  if ($symlinkCreated) {
    $symlinkContainer = Start-TestContainer -MountSpecs @(
      "type=bind,source=$symlinkRoot,target=/workspace,readonly"
    )
    try {
      $symlinkFailure = Get-CopiedProvisionerFailure -TemporaryRoot $symlinkRoot -ContainerName $symlinkContainer
      Assert-Matches $symlinkFailure 'reparse-point' 'host symlink asset substitution is rejected'
      $symlinkProbeStatus = 'created safely and rejected by the explicit host reparse-point guard'
    }
    finally { Stop-TestContainer $symlinkContainer }
  }
  else {
    Assert-Matches $provisionerSource 'FileAttributes]::ReparsePoint' 'unavailable symlink probe retains an explicit reparse-point rejection control'
  }

  Reset-ProbeState $activeContainer
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create role mujahiz_claim_human_command_owner with login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'unsafe expected role fails closed'
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '1' 'unsafe expected role creates no missing roles'
  Assert-Equal @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select rolcanlogin from pg_catalog.pg_roles where rolname='mujahiz_claim_human_command_owner';")[-1] 't' 'unsafe expected role is not repaired'

  Reset-ProbeState $activeContainer
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create role mujahiz_claim_unexpected_owner with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'unexpected similarly prefixed owner role fails closed'
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' 'unexpected namespace creates no expected roles'

  Reset-ProbeState $activeContainer
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create role mujahiz_claim_human_command_owner_backup with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'approved owner-name suffix variant fails closed'
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' 'owner-name backup suffix creates no expected roles'

  Reset-ProbeState $activeContainer
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create role mujahiz_claim_expiry_command_ownership with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'owner-like non-delimited suffix variant fails closed'
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' 'owner-like suffix creates no expected roles'

  Reset-ProbeState $activeContainer
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create role b4p1_restricted_probe nologin noinherit; grant mujahiz_claim_human_command_owner to b4p1_restricted_probe with admin false, inherit false, set false;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'synthetic membership fails closed'
  Assert-GreaterThanZero @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select count(*) from pg_catalog.pg_auth_members m where m.roleid=(select oid from pg_catalog.pg_roles where rolname='mujahiz_claim_human_command_owner');")[-1] 'synthetic membership is not repaired'

  Reset-ProbeState $activeContainer
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create schema b4p1_probe; create table b4p1_probe.owned_probe(id integer); alter table b4p1_probe.owned_probe owner to mujahiz_claim_human_command_owner;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'synthetic ownership fails closed'
  Assert-GreaterThanZero @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select count(*) from pg_catalog.pg_class where relowner=(select oid from pg_catalog.pg_roles where rolname='mujahiz_claim_human_command_owner');")[-1] 'synthetic ownership is not repaired'

  Reset-ProbeState $activeContainer
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  $residueSql = @'
create schema b4p1_probe;
create table b4p1_probe.residue_probe(id integer);
alter table b4p1_probe.residue_probe enable row level security;
create policy b4p1_residue_policy on b4p1_probe.residue_probe for select to mujahiz_claim_human_command_owner using (true);
grant select on b4p1_probe.residue_probe to mujahiz_claim_human_command_owner;
grant select(id) on b4p1_probe.residue_probe to mujahiz_claim_human_command_owner;
alter default privileges for role supabase_admin in schema b4p1_probe grant select on tables to mujahiz_claim_human_command_owner;
alter role mujahiz_claim_human_command_owner in database postgres set statement_timeout='1s';
grant set on parameter work_mem to mujahiz_claim_human_command_owner;
'@
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql $residueSql | Out-Null
  Assert-ProvisioningFails $activeContainer 'synthetic ACL/default-ACL/policy/setting/parameter residue fails closed'
  Assert-GreaterThanZero @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select count(*) from pg_catalog.pg_shdepend d where d.refobjid=(select oid from pg_catalog.pg_roles where rolname='mujahiz_claim_human_command_owner');")[-1] 'synthetic shared dependency residue is not repaired'
  Assert-GreaterThanZero @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select count(*) from pg_catalog.pg_db_role_setting s where s.setrole=(select oid from pg_catalog.pg_roles where rolname='mujahiz_claim_human_command_owner');")[-1] 'synthetic persistent setting is not repaired'
  Assert-GreaterThanZero @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select count(*) from pg_catalog.pg_parameter_acl p cross join lateral pg_catalog.aclexplode(p.paracl) acl where acl.grantee=(select oid from pg_catalog.pg_roles where rolname='mujahiz_claim_human_command_owner');")[-1] 'synthetic parameter ACL is not repaired'

  Reset-ProbeState $activeContainer
  Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "create role mujahiz_claim_human_command_owner with login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;" | Out-Null
  Assert-ProvisioningFails $activeContainer 'mixed missing and unsafe state fails before creation'
  Assert-Equal (Get-ExpectedRoleCount $activeContainer) '1' 'mixed state leaves missing roles missing'

  foreach ($failurePoint in @('before_create', 'after_role_1', 'after_role_2', 'after_role_3', 'after_role_4', 'final_assertion')) {
    Reset-ProbeState $activeContainer
    Assert-ProvisioningFails -ContainerName $activeContainer -Label "transaction rollback at $failurePoint" -FailurePoint $failurePoint
    Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' "$failurePoint leaves no committed partial role set"
  }

  foreach ($invocationKind in @('cancellation', 'termination')) {
    Reset-ProbeState $activeContainer
    Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer -InvocationKind $invocationKind -PauseBeforeCommit -Detach | Out-Null
    $backendPid = Wait-ForPausedProvisioner $activeContainer $invocationKind
    $signalFunction = if ($invocationKind -eq 'cancellation') { 'pg_cancel_backend' } else { 'pg_terminate_backend' }
    Assert-Equal @(Invoke-ContainerSql -ContainerName $activeContainer -Privileged -Sql "select pg_catalog.$signalFunction($backendPid);")[-1] 't' "$invocationKind signal accepted"
    Wait-ForProvisionerExit $activeContainer $invocationKind
    Assert-Equal (Get-ExpectedRoleCount $activeContainer) '0' "$invocationKind rolls back every role"
  }

  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  Ensure-TestActors -ContainerName $activeContainer
  $setRoleFingerprint = Get-AcceptedFingerprint $activeContainer
  Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
  Assert-Equal (Get-AcceptedFingerprint $activeContainer) $setRoleFingerprint 'legitimate runtime, worker, and projection role inventory is outside the reserved owner namespace'

  foreach ($actor in $ordinaryActors) {
    foreach ($ownerRole in $ownerRoles) {
      $probe = Invoke-SetRoleDenialProbe -ContainerName $activeContainer -Actor $actor -OwnerRole $ownerRole
      $label = "$actor SET ROLE $ownerRole"
      Assert-Equal $probe.ActorEstablished $true "$label evaluates with session_user and current_user set to the ordinary actor"
      Assert-Equal $probe.Denied $true "$label is denied by an actual session-level attempt"
      Assert-Equal $probe.ExpectedSqlState $true "$label returns authorization SQLSTATE 42501"
      Assert-Equal $probe.OwnerSentinelAbsent $true "$label executes no later command as the owner"
      Assert-Equal (Get-AcceptedFingerprint $activeContainer) $setRoleFingerprint "$label leaves the owner-role catalog fingerprint unchanged"
    }
  }

  Stop-TestContainer $activeContainer
  $activeContainer = $null

  $resetFingerprints = @()
  for ($resetRun = 1; $resetRun -le 2; $resetRun++) {
    $activeContainer = Start-TestContainer
    Invoke-ClaimOwnerRoleProvisioner -ContainerName $activeContainer | Out-Null
    $resetFingerprints += Get-AcceptedFingerprint $activeContainer
    Stop-TestContainer $activeContainer
    $activeContainer = $null
  }
  Assert-Equal $resetFingerprints[1] $resetFingerprints[0] 'two clean disposable reset/replays have identical accepted catalog results'
}
finally {
  if ($activeContainer) { Stop-TestContainer $activeContainer }
  $cleanupErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  foreach ($containerName in $createdContainers) {
    docker rm --force $containerName *> $null
  }
  foreach ($temporaryRoot in $temporaryRoots) {
    Remove-TemporaryRoot -Path $temporaryRoot
  }
  $ErrorActionPreference = $cleanupErrorActionPreference
  $stopwatch.Stop()
}

foreach ($containerName in $createdContainers) {
  $remaining = @(& docker ps --all --quiet --filter "name=^/$containerName$")
  Assert-Equal $remaining.Count 0 "disposable container $containerName removed"
}
foreach ($temporaryRoot in $temporaryRoots) {
  Assert-Equal (Test-Path -LiteralPath $temporaryRoot) $false "temporary synthetic repository $temporaryRoot removed"
}

Write-Output "Symlink/reparse probe: $symlinkProbeStatus."
Write-Output ("Asset byte identity: raw Git {0} bytes {1}; host {2} bytes {3}; mounted {4} bytes {5}; literal {6}." -f `
  $rawGitIdentity.Size, $rawGitIdentity.Sha256, $hostAssetBytes.Length, $hostAssetHash,
  $mountedAssetIdentity.Size, $mountedAssetIdentity.Sha256, $expectedAssetSha256)
Write-Output ("Fresh core.autocrlf=true checkout: {0} bytes {1}; mounted-hash shim interceptions: {2}; zero roles preserved." -f `
  $freshAssetBytes.Length, $freshAssetHash, $mountedMismatch.Interceptions)
Write-Output ("Claim owner-role provisioner validation passed: {0} checks; two clean reset/replays; {1:n1}s elapsed." -f $checksPassed, $stopwatch.Elapsed.TotalSeconds)
