function Invoke-ClaimOwnerRoleProvisioner {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ContainerName,
    [ValidateSet('', 'before_create', 'after_role_1', 'after_role_2', 'after_role_3', 'after_role_4', 'final_assertion')]
    [string]$FailurePoint = '',
    [ValidateSet('normal', 'cancellation', 'termination')][string]$InvocationKind = 'normal',
    [switch]$PauseBeforeCommit,
    [switch]$Detach
  )

  if ($Detach -and -not $PauseBeforeCommit) {
    throw 'Detached Claim owner-role provisioning is allowed only for the fixed interruption probes.'
  }
  if ($InvocationKind -ne 'normal' -and -not $PauseBeforeCommit) {
    throw 'Interruption probe invocation kinds require the fixed pre-commit pause.'
  }

  if ($ContainerName -notmatch '^mujahiz-(iq-sql-validation|b4p1-validation|approve-race|expire-race|reject-race|claim-(assign|hotfix|withdraw)-concurrency|b4-security)-') {
    throw 'Claim owner-role provisioning is limited to the fixed disposable validation harness.'
  }

  $repoRoot = [System.IO.Path]::GetFullPath((Resolve-Path (Join-Path $PSScriptRoot '..')).Path).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $hostAssetPath = Join-Path $repoRoot 'supabase\local-bootstrap\claim-owner-roles.sql'
  $assetPath = '/workspace/supabase/local-bootstrap/claim-owner-roles.sql'
  $expectedAssetSha256 = '52fe86ad84f1ebb8c12c0439d7de7583dcbf69d76862274505667b5a62d10077'
  $assetPathChain = @(
    $repoRoot,
    (Join-Path $repoRoot 'supabase'),
    (Join-Path $repoRoot 'supabase\local-bootstrap'),
    $hostAssetPath
  )
  foreach ($candidatePath in $assetPathChain) {
    $candidate = Get-Item -Force -LiteralPath $candidatePath -ErrorAction Stop
    if (($candidate.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Claim owner-role provisioning rejected a reparse-point in the fixed asset path.'
    }
  }
  $asset = Get-Item -Force -LiteralPath $hostAssetPath -ErrorAction Stop
  if ($asset.PSIsContainer -or -not [System.IO.File]::Exists($asset.FullName)) {
    throw 'Claim owner-role provisioning requires the fixed repository asset to be a regular file.'
  }
  $hostAssetSha256 = (Get-FileHash -LiteralPath $hostAssetPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hostAssetSha256 -cne $expectedAssetSha256) {
    throw 'Claim owner-role provisioning rejected a host asset SHA-256 mismatch.'
  }

  $expectedImage = 'supabase/postgres:17.6.1.064'
  $expectedImageId = 'sha256:4c6d67181e482549bab276e8ae933f807be59ea1c371c225d85c189b0c14b9de'
  $inspectFormat = '{{.Config.Image}}|{{.Image}}|{{.HostConfig.AutoRemove}}|{{.State.Running}}|{{json .HostConfig.PortBindings}}'
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $containerMetadataOutput = @(& docker inspect --format $inspectFormat $ContainerName 2>&1 | ForEach-Object { $_.ToString() })
  $inspectExitCode = $LASTEXITCODE
  $containerMountOutput = @(& docker inspect --format '{{json .Mounts}}' $ContainerName 2>&1 | ForEach-Object { $_.ToString() })
  $mountInspectExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  $containerMetadata = if ($containerMetadataOutput.Count -gt 0) { @($containerMetadataOutput[-1] -split '\|', 5) } else { @() }
  $allMounts = @()
  if ($mountInspectExitCode -eq 0 -and $containerMountOutput.Count -gt 0) {
    try { $allMounts = @($containerMountOutput[-1] | ConvertFrom-Json) }
    catch { $allMounts = @() }
  }

  $workspaceMountMatches = $false
  if ($allMounts.Count -eq 1) {
    $workspaceMount = $allMounts[0]
    try {
      $mountSource = [System.IO.Path]::GetFullPath([string]$workspaceMount.Source).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
      )
      $pathComparison = if ([System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT) {
        [System.StringComparison]::OrdinalIgnoreCase
      }
      else { [System.StringComparison]::Ordinal }
      $workspaceMountMatches = (
        $workspaceMount.Type -eq 'bind' -and
        $workspaceMount.Destination -eq '/workspace' -and
        $workspaceMount.RW -eq $false -and
        [string]::Equals($mountSource, $repoRoot, $pathComparison)
      )
    }
    catch { $workspaceMountMatches = $false }
  }

  $containerRejected = (
    $inspectExitCode -ne 0 -or
    $mountInspectExitCode -ne 0 -or
    $containerMetadata.Count -ne 5 -or
    $containerMetadata[0] -ne $expectedImage -or
    $containerMetadata[1] -ne $expectedImageId -or
    $containerMetadata[2] -ne 'true' -or
    $containerMetadata[3] -ne 'true' -or
    $containerMetadata[4] -notin @('null', '{}') -or
    $allMounts.Count -ne 1 -or
    -not $workspaceMountMatches
  )
  if ($containerRejected) {
    throw 'Claim owner-role provisioning rejected a container outside the pinned disposable boundary.'
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $containerAssetTypeOutput = @(& docker exec $ContainerName stat '--format=%F' $assetPath 2>&1 | ForEach-Object { $_.ToString() })
  $containerAssetTypeExitCode = $LASTEXITCODE
  $containerAssetHashOutput = @(& docker exec $ContainerName sha256sum $assetPath 2>&1 | ForEach-Object { $_.ToString() })
  $containerAssetHashExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  $containerAssetHash = if (
    $containerAssetHashOutput.Count -eq 1 -and
    $containerAssetHashOutput[0] -match '^([0-9a-f]{64})\s+/workspace/supabase/local-bootstrap/claim-owner-roles\.sql$'
  ) { $Matches[1] } else { '' }
  if (
    $containerAssetTypeExitCode -ne 0 -or
    $containerAssetTypeOutput.Count -ne 1 -or
    $containerAssetTypeOutput[0] -ne 'regular file' -or
    $containerAssetHashExitCode -ne 0 -or
    $containerAssetHash -cne $expectedAssetSha256
  ) {
    throw 'Claim owner-role provisioning rejected the mounted asset identity.'
  }

  $applicationName = "mujahiz_claim_owner_role_provisioner_$InvocationKind"
  $beginCommand = 'begin;'
  if ($FailurePoint) {
    $beginCommand += " select pg_catalog.set_config('mujahiz.claim_owner_role_failure_point', '$FailurePoint', true);"
  }

  $psqlArguments = @(
    '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--host=/var/run/postgresql', '--port=5432',
    '--username=supabase_admin', '--dbname=postgres', '--quiet', '--command', $beginCommand,
    '--file', $assetPath
  )
  if ($PauseBeforeCommit) {
    $psqlArguments += @('--command', 'select pg_catalog.pg_sleep(30);')
  }
  $psqlArguments += @('--command', 'commit;')

  $dockerArguments = @('exec')
  if ($Detach) { $dockerArguments += '--detach' }
  $libpqEnvironmentToUnset = @(
    'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSFILE',
    'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR', 'PGOPTIONS', 'PGCONNECT_TIMEOUT',
    'PGCLIENTENCODING', 'PGTARGETSESSIONATTRS', 'PGLOADBALANCEHOSTS', 'PGCHANNELBINDING',
    'PGSSLMODE', 'PGREQUIRESSL', 'PGSSLNEGOTIATION', 'PGSSLCOMPRESSION', 'PGSSLCERT',
    'PGSSLKEY', 'PGSSLROOTCERT', 'PGSSLCRL', 'PGSSLCRLDIR', 'PGREQUIREPEER',
    'PGSSLMINPROTOCOLVERSION', 'PGSSLMAXPROTOCOLVERSION', 'PGGSSENCMODE',
    'PGKRBSRVNAME', 'PGGSSLIB'
  )
  $dockerArguments += @('--env', "PGAPPNAME=$applicationName", '--env', 'PGPASSWORD=postgres', $ContainerName, '/usr/bin/env')
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
    throw "Claim owner-role provisioning failed.$([Environment]::NewLine)$($output -join [Environment]::NewLine)"
  }
  return $output
}
