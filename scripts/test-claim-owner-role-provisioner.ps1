[CmdletBinding()]
param([string]$PostgresImage = 'supabase/postgres:17.6.1.064')

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
$rolePattern = '^mujahiz_claim_.*_owner$'
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
$checksPassed = 0
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

. (Join-Path $PSScriptRoot 'claim-owner-role-provisioner.ps1')

function Invoke-ContainerSql {
  param(
    [Parameter(Mandatory)][string]$ContainerName,
    [Parameter(Mandatory)][string]$Sql,
    [switch]$Privileged
  )

  $databaseUser = if ($Privileged) { 'supabase_admin' } else { 'postgres' }
  $psqlArguments = @(
    '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    "--username=$databaseUser",
    '--dbname=postgres', '--quiet', '--tuples-only', '--no-align', '--pset', 'footer=off',
    '--command', $Sql
  )
  $dockerArguments = @('exec')
  if ($Privileged) {
    $dockerArguments += @('--env', 'PGAPPNAME=mujahiz_claim_owner_role_validation', $ContainerName, 'psql')
  }
  else {
    $dockerArguments += @($ContainerName, 'psql')
  }
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
  $containerName = "mujahiz-b4p1-validation-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
  docker run --detach --rm --name $containerName --mount $mount `
    --env 'POSTGRES_PASSWORD=postgres' --env 'PGPASSWORD=postgres' --env 'POSTGRES_DB=postgres' $PostgresImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Unable to start focused disposable PostgreSQL container.' }
  $createdContainers.Add($containerName)

  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    docker exec $containerName pg_isready --username=postgres --dbname=postgres *> $null
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
  param([string]$ContainerName, [string]$Label, [string]$FailurePoint = '')
  $failed = $false
  try {
    Invoke-ClaimOwnerRoleProvisioner -ContainerName $ContainerName -FailurePoint $FailurePoint | Out-Null
  }
  catch { $failed = $true }
  Assert-Equal -Actual $failed -Expected $true -Label $Label
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
select role_shape.value
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
  $ErrorActionPreference = $cleanupErrorActionPreference
  $stopwatch.Stop()
}

foreach ($containerName in $createdContainers) {
  $remaining = @(& docker ps --all --quiet --filter "name=^/$containerName$")
  Assert-Equal $remaining.Count 0 "disposable container $containerName removed"
}

Write-Output ("Claim owner-role provisioner validation passed: {0} checks; two clean reset/replays; {1:n1}s elapsed." -f $checksPassed, $stopwatch.Elapsed.TotalSeconds)
