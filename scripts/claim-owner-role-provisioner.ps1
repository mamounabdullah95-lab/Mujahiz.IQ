function Invoke-ClaimOwnerRoleProvisioner {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ContainerName,
    [ValidateNotNullOrEmpty()][string]$DatabaseName = 'postgres',
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

  if ($ContainerName -notmatch '^mujahiz-(iq-sql-validation|b4p1-validation)-') {
    throw 'Claim owner-role provisioning is limited to the fixed disposable validation harness.'
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
  $workspaceMounts = @()
  if ($mountInspectExitCode -eq 0 -and $containerMountOutput.Count -gt 0) {
    try {
      $allMounts = @($containerMountOutput[-1] | ConvertFrom-Json)
      $workspaceMounts = @($allMounts | Where-Object { $_.Destination -eq '/workspace' })
    }
    catch { $workspaceMounts = @() }
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
    $workspaceMounts.Count -ne 1 -or
    $workspaceMounts[0].RW -ne $false
  )
  if ($containerRejected) {
    throw 'Claim owner-role provisioning rejected a container outside the pinned disposable boundary.'
  }

  $assetPath = '/workspace/supabase/local-bootstrap/claim-owner-roles.sql'
  $applicationName = "mujahiz_claim_owner_role_provisioner_$InvocationKind"
  $beginCommand = 'begin;'
  if ($FailurePoint) {
    $beginCommand += " select pg_catalog.set_config('mujahiz.claim_owner_role_failure_point', '$FailurePoint', true);"
  }

  $psqlArguments = @(
    '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--username=supabase_admin',
    "--dbname=$DatabaseName", '--quiet', '--command', $beginCommand,
    '--file', $assetPath
  )
  if ($PauseBeforeCommit) {
    $psqlArguments += @('--command', 'select pg_catalog.pg_sleep(30);')
  }
  $psqlArguments += @('--command', 'commit;')

  $dockerArguments = @('exec')
  if ($Detach) { $dockerArguments += '--detach' }
  $dockerArguments += @('--env', "PGAPPNAME=$applicationName", $ContainerName, 'psql')
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
