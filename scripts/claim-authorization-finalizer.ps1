function Invoke-ClaimAuthorizationFinalizer {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ContainerName,
    [ValidateSet('', 'after_acl_1', 'after_acl_2', 'after_acl_3', 'after_acl_4',
      'between_assets', 'after_owner_1', 'after_owner_13', 'after_owner_26',
      'final_assertion')]
    [string]$FailurePoint = '',
    [ValidateSet('normal', 'cancellation', 'termination')]
    [string]$InvocationKind = 'normal',
    [switch]$PauseBeforeCommit,
    [switch]$Detach
  )

  if ($Detach -and -not $PauseBeforeCommit) {
    throw 'Detached Claim authorization finalization is allowed only for fixed interruption probes.'
  }
  if ($InvocationKind -ne 'normal' -and -not $PauseBeforeCommit) {
    throw 'Interruption probe invocation kinds require the fixed pre-commit pause.'
  }

  if ($ContainerName -notmatch '^mujahiz-(iq-sql-validation|b4-validation|approve-race|expire-race|reject-race|claim-(assign|hotfix|withdraw)-concurrency|b4-security)-') {
    throw 'Claim authorization finalization is limited to the fixed disposable validation harness.'
  }

  $repoRoot = [System.IO.Path]::GetFullPath((Resolve-Path (Join-Path $PSScriptRoot '..')).Path).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $assetDefinitions = @(
    [pscustomobject]@{
      RelativePath = 'supabase/local-bootstrap/claim-projection-helper-acl-finalization.sql'
      ContainerPath = '/workspace/supabase/local-bootstrap/claim-projection-helper-acl-finalization.sql'
      Sha256 = '13e3fd68dacf74036d95a2e96b7fec0db5ed91fb5f34830b0adfcc81d240a21f'
      Kind = 'acl'
    },
    [pscustomobject]@{
      RelativePath = 'supabase/local-bootstrap/claim-routine-ownership-finalization.sql'
      ContainerPath = '/workspace/supabase/local-bootstrap/claim-routine-ownership-finalization.sql'
      Sha256 = '1832ed403d168a73f61346952c42ebfcd632589e93ac95698311bbb49ed26aa4'
      Kind = 'ownership'
    },
    [pscustomobject]@{
      RelativePath = 'supabase/local-bootstrap/claim-authorization-catalog-normalization.sql'
      ContainerPath = '/workspace/supabase/local-bootstrap/claim-authorization-catalog-normalization.sql'
      Sha256 = '5873cdab006165aa8ce4b6bf0720f4d432264ab8438dcb78e75e4ec479e2dac6'
      Kind = 'normalizer'
    },
    [pscustomobject]@{
      RelativePath = 'supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'
      ContainerPath = '/workspace/supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'
      Sha256 = '0322bd136f209cbe0dabd82575abf7620b9acdb3d51a20bb20ef60d2a7702071'
      Kind = 'allowlist'
    }
  )

  $aclManifest = @(
    'GRANT EXECUTE ON FUNCTION claim_security.current_privileged_actor_v1() TO mujahiz_claim_human_command_owner',
    'GRANT EXECUTE ON FUNCTION claim_security.privileged_actor_for_profile_v1(uuid) TO mujahiz_claim_human_command_owner',
    'REVOKE EXECUTE ON FUNCTION claim_security.current_privileged_actor_v1() FROM postgres',
    'REVOKE EXECUTE ON FUNCTION claim_security.privileged_actor_for_profile_v1(uuid) FROM postgres'
  )
  $ownershipManifest = @(
    'ALTER FUNCTION supplier_claim.reserve_submit(text, uuid, text, text, jsonb, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.reserve_withdraw(text, uuid, integer) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.withdraw(text, uuid, integer, uuid, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.reserve_assign_reviewer(text, uuid, integer, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.assign_reviewer(text, uuid, integer, uuid, uuid, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.reject(text, uuid, integer, integer, text, text, text, text, text, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim._execute_reject(text, uuid, integer, integer, text, text, text, text, text, uuid, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim.approve(text, uuid, integer, integer, text, text, text, text[], text, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim._execute_approve(text, uuid, integer, integer, text, text, text, text[], text, uuid, uuid) OWNER TO mujahiz_claim_human_command_owner',
    'ALTER FUNCTION supplier_claim._claim_history_envelope_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._claim_assignment_history_coherent_v1(uuid, boolean) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._withdrawn_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._rejected_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._approval_ownership_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._approval_audit_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._approval_competitor_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._approved_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._expired_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._superseded_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._terminal_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._active_claim_history_coherent_v1(uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim.expire(text, uuid, integer, uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION supplier_claim._execute_expire(text, uuid, integer, uuid, uuid) OWNER TO mujahiz_claim_expiry_command_owner',
    'ALTER FUNCTION claim_security.target_supplier_conflict_v1(uuid, uuid, uuid) OWNER TO mujahiz_claim_target_conflict_helper_owner',
    'ALTER FUNCTION claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid) OWNER TO mujahiz_claim_reviewer_prior_context_helper_owner'
  )

  function Get-NormalizedStatements([string]$Sql) {
    @($Sql -split ';' | ForEach-Object { ($_ -replace '\s+', ' ').Trim() } | Where-Object { $_ })
  }

  foreach ($pathPart in @($repoRoot, (Join-Path $repoRoot 'supabase'),
      (Join-Path $repoRoot 'supabase/local-bootstrap'))) {
    $item = Get-Item -Force -LiteralPath $pathPart -ErrorAction Stop
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Claim authorization finalization rejected a reparse-point in the fixed repository path.'
    }
  }

  foreach ($assetDefinition in $assetDefinitions) {
    $hostPath = Join-Path $repoRoot $assetDefinition.RelativePath
    $item = Get-Item -Force -LiteralPath $hostPath -ErrorAction Stop
    if ($item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Claim authorization finalization requires fixed regular asset files.'
    }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $hostPath).Hash.ToLowerInvariant() -cne $assetDefinition.Sha256) {
      throw "Claim authorization finalization rejected the $($assetDefinition.Kind) host SHA-256."
    }

    $indexLine = @(& git -C $repoRoot ls-files --stage -- $assetDefinition.RelativePath)
    if ($LASTEXITCODE -ne 0 -or $indexLine.Count -ne 1 -or $indexLine[0] -notmatch '^100644 ([0-9a-f]{40,64}) 0\s+') {
      throw "Claim authorization finalization requires one exact staged Git blob for the $($assetDefinition.Kind) asset."
    }
    $indexBlob = $Matches[1]
    $hostBlob = @(& git -C $repoRoot hash-object --no-filters -- $assetDefinition.RelativePath)
    if ($LASTEXITCODE -ne 0 -or $hostBlob.Count -ne 1 -or $hostBlob[0] -cne $indexBlob) {
      throw "Claim authorization finalization rejected a raw Git/host byte mismatch for the $($assetDefinition.Kind) asset."
    }
    $attribute = @(& git -C $repoRoot check-attr eol -- $assetDefinition.RelativePath)
    if ($LASTEXITCODE -ne 0 -or $attribute.Count -ne 1 -or $attribute[0] -notmatch ': eol: lf$') {
      throw "Claim authorization finalization requires the exact LF rule for the $($assetDefinition.Kind) asset."
    }

    $sql = [System.IO.File]::ReadAllText($hostPath, [System.Text.UTF8Encoding]::new($false))
    if ($sql.Contains("`r") -or $sql.Contains([char]0)) {
      throw "Claim authorization finalization rejected non-LF or NUL $($assetDefinition.Kind) content."
    }
    if ($assetDefinition.Kind -in @('acl', 'ownership')) {
      $actualStatements = @(Get-NormalizedStatements $sql)
      $expectedStatements = if ($assetDefinition.Kind -eq 'acl') { $aclManifest } else { $ownershipManifest }
      if ($actualStatements.Count -ne $expectedStatements.Count -or
          (Compare-Object $expectedStatements $actualStatements -SyncWindow 0)) {
        throw "Claim authorization finalization rejected the $($assetDefinition.Kind) manifest inventory."
      }
      if ($assetDefinition.Kind -eq 'acl' -and $sql -match '(?im)\b(?:alter|create|drop|truncate|insert|update|delete|set|reset|begin|commit|rollback|copy)\b|\\') {
        throw 'Claim authorization finalization rejected prohibited ACL asset content.'
      }
      if ($assetDefinition.Kind -eq 'ownership' -and
          @($actualStatements | Where-Object { $_ -notmatch '^ALTER FUNCTION .+ OWNER TO mujahiz_claim_.+_owner$' }).Count -gt 0) {
        throw 'Claim authorization finalization rejected prohibited ownership asset content.'
      }
    }
  }

  $normalizerPath = Join-Path $repoRoot 'supabase/local-bootstrap/claim-authorization-catalog-normalization.sql'
  $normalizationSql = [System.IO.File]::ReadAllText(
    $normalizerPath, [System.Text.UTF8Encoding]::new($false)
  )
  if (-not $normalizationSql.EndsWith(";`n", [System.StringComparison]::Ordinal)) {
    throw 'Claim authorization finalization requires one LF-terminated normalizer statement.'
  }
  $expectedBoundOperators = [ordered]@{
    'OPERATOR(pg_catalog.||)' = 22
    'OPERATOR(pg_catalog.=)' = 90
    'OPERATOR(pg_catalog.>)' = 2
  }
  foreach ($entry in $expectedBoundOperators.GetEnumerator()) {
    if ([regex]::Matches($normalizationSql, [regex]::Escape($entry.Key)).Count -ne $entry.Value) {
      throw "Claim authorization finalization rejected the exact bound normalizer operator inventory: $($entry.Key)."
    }
  }
  $normalizerWithoutBoundOperators = $normalizationSql
  foreach ($operatorToken in $expectedBoundOperators.Keys) {
    $normalizerWithoutBoundOperators = $normalizerWithoutBoundOperators.Replace($operatorToken, '')
  }
  if ($normalizationSql -match '::(?!pg_catalog\.)' -or
      $normalizerWithoutBoundOperators -match '\|\||(?<![<>=!])=(?!=)|(?<![<>=])>(?!=)|(?i)\bin\s*\(') {
    throw 'Claim authorization finalization rejected an unbound normalizer cast or operator.'
  }
  $normalizerBareCallTokens = @([regex]::Matches(
      $normalizationSql, '(?im)(?<![\w.])([a-z_][a-z0-9_]*)\s*\('
    ) | ForEach-Object { $_.Groups[1].Value.ToLowerInvariant() } | Sort-Object -Unique)
  $expectedBareCallTokens = @(
    'and', 'any', 'as', 'coalesce', 'exists', 'operator',
    'relevant_roles', 'setting', 'transfer_signatures', 'values'
  )
  if (Compare-Object $expectedBareCallTokens $normalizerBareCallTokens -SyncWindow 0) {
    throw 'Claim authorization finalization rejected an unqualified normalizer call token.'
  }
  $normalizationBody = $normalizationSql.Substring(0, $normalizationSql.Length - 2)

  $allowlistPath = Join-Path $repoRoot 'supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'
  $allowlistText = [System.IO.File]::ReadAllText(
    $allowlistPath, [System.Text.UTF8Encoding]::new($false)
  )
  $allowlistLines = @($allowlistText -split "`n")
  if ($allowlistLines.Count -eq 0 -or $allowlistLines[-1] -ne '') {
    throw 'Claim authorization finalization requires an LF-terminated catalog allowlist.'
  }
  $allowlistLines = @($allowlistLines | Select-Object -First ($allowlistLines.Count - 1))
  if ($allowlistLines.Count -ne 702 -or
      $allowlistLines[0] -cne '# Claim authorization catalog allowlist v1' -or
      $allowlistLines[1] -cne '# Fixed normalized tuples; runtime self-reference is prohibited.' -or
      $allowlistLines[2] -cne '# PRE' -or $allowlistLines[346] -cne '# POST') {
    throw 'Claim authorization finalization rejected the catalog allowlist structure.'
  }
  $unexpectedAllowlistLines = @($allowlistLines | Where-Object {
    $_ -notin @('# Claim authorization catalog allowlist v1',
      '# Fixed normalized tuples; runtime self-reference is prohibited.', '# PRE', '# POST') -and
      -not $_.StartsWith('PRE|', [System.StringComparison]::Ordinal) -and
      -not $_.StartsWith('POST|', [System.StringComparison]::Ordinal)
  })
  $expectedPreCatalog = @($allowlistLines | Where-Object {
    $_.StartsWith('PRE|', [System.StringComparison]::Ordinal)
  } | ForEach-Object { $_.Substring(4) })
  $expectedPostCatalog = @($allowlistLines | Where-Object {
    $_.StartsWith('POST|', [System.StringComparison]::Ordinal)
  } | ForEach-Object { $_.Substring(5) })
  if ($unexpectedAllowlistLines.Count -ne 0 -or
      $expectedPreCatalog.Count -ne 343 -or $expectedPostCatalog.Count -ne 355 -or
      @($expectedPreCatalog | Group-Object | Where-Object Count -ne 1).Count -ne 0 -or
      @($expectedPostCatalog | Group-Object | Where-Object Count -ne 1).Count -ne 0 -or
      (Compare-Object $expectedPreCatalog @($expectedPreCatalog | Sort-Object) -SyncWindow 0) -or
      (Compare-Object $expectedPostCatalog @($expectedPostCatalog | Sort-Object) -SyncWindow 0)) {
    throw 'Claim authorization finalization rejected the exact catalog tuple inventory.'
  }

  function Get-CatalogPayloadSha256([string[]]$CatalogTuples) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($CatalogTuples -join "`n"))
      return ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $sha256.Dispose() }
  }
  if ((Get-CatalogPayloadSha256 $expectedPreCatalog) -cne
        '9a5a533adf878617b72010e18de9d2b78bec0d1eb914162f3768e3a34eefd22d' -or
      (Get-CatalogPayloadSha256 $expectedPostCatalog) -cne
        '46aa89a6b3b5e3bc9fa9ec07e163d30cc468530631a0176ab80c246ab6b72a3f') {
    throw 'Claim authorization finalization rejected the catalog payload SHA-256.'
  }

  $expectedImage = 'supabase/postgres:17.6.1.064'
  $expectedImageId = 'sha256:4c6d67181e482549bab276e8ae933f807be59ea1c371c225d85c189b0c14b9de'
  $metadata = @(& docker inspect --format '{{.Config.Image}}|{{.Image}}|{{.HostConfig.AutoRemove}}|{{.State.Running}}|{{json .HostConfig.PortBindings}}' $ContainerName)
  $mountJson = @(& docker inspect --format '{{json .Mounts}}' $ContainerName)
  if ($LASTEXITCODE -ne 0 -or $metadata.Count -ne 1 -or $mountJson.Count -ne 1) {
    throw 'Claim authorization finalization could not inspect the disposable container.'
  }
  $parts = @($metadata[0] -split '\|', 5)
  $mounts = @($mountJson[0] | ConvertFrom-Json)
  $expectedSource = $repoRoot
  if ($parts.Count -ne 5 -or $parts[0] -ne $expectedImage -or $parts[1] -ne $expectedImageId -or
      $parts[2] -ne 'true' -or $parts[3] -ne 'true' -or $parts[4] -notin @('null', '{}') -or
      $mounts.Count -ne 1 -or $mounts[0].Type -ne 'bind' -or
      $mounts[0].Destination -ne '/workspace' -or $mounts[0].RW -ne $false -or
      -not [string]::Equals([System.IO.Path]::GetFullPath([string]$mounts[0].Source).TrimEnd('\'),
        $expectedSource.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Claim authorization finalization rejected a container outside the pinned disposable boundary.'
  }
  foreach ($assetDefinition in $assetDefinitions) {
    $mounted = @(& docker exec $ContainerName sha256sum $assetDefinition.ContainerPath)
    if ($LASTEXITCODE -ne 0 -or $mounted.Count -ne 1 -or
        $mounted[0] -notmatch "^$($assetDefinition.Sha256)\s+$([regex]::Escape($assetDefinition.ContainerPath))$") {
      throw "Claim authorization finalization rejected the mounted $($assetDefinition.Kind) bytes."
    }
  }

  function Invoke-FixedCatalogPsql {
    param(
      [Parameter(Mandatory)][string]$DatabaseName,
      [string]$Command,
      [string]$ContainerFile
    )
    if (($Command.Length -gt 0) -eq ($ContainerFile.Length -gt 0)) {
      throw 'Fixed catalog psql requires exactly one repository-owned input mode.'
    }
    $arguments = @('exec', '--env', 'PGPASSWORD=postgres', $ContainerName, '/usr/bin/env')
    foreach ($environmentName in @('PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSFILE',
        'PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGSSLMODE','PGSSLKEY','PGSSLCERT')) {
      $arguments += @('-u', $environmentName)
    }
    $arguments += @('/usr/bin/psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
      '--host=/var/run/postgresql', '--port=5432', '--username=supabase_admin',
      "--dbname=$DatabaseName", '--tuples-only', '--no-align', '--quiet')
    if ($Command.Length -gt 0) { $arguments += @('--command', $Command) }
    else { $arguments += @('--file', $ContainerFile) }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $probeOutput = @(& docker @arguments 2>&1 | ForEach-Object { $_.ToString() })
    $probeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    return [pscustomobject]@{ ExitCode = $probeExitCode; Output = [string[]]$probeOutput }
  }

  $candidateSql = "select datname from pg_catalog.pg_database where datallowconn and not datistemplate and datname ~ '^(postgres|runner_test_[0-9]+)$' order by datname;"
  $candidateList = Invoke-FixedCatalogPsql -DatabaseName 'postgres' -Command $candidateSql
  $candidateNames = @($candidateList.Output | Where-Object { $_ -ne '' })
  if ($candidateList.ExitCode -ne 0 -or $candidateNames.Count -eq 0 -or
      @($candidateNames | Where-Object { $_ -notmatch '^(postgres|runner_test_[0-9]+)$' }).Count -ne 0 -or
      @($candidateNames | Group-Object | Where-Object Count -ne 1).Count -ne 0) {
    throw 'Claim authorization finalization could not enumerate the fixed local database candidates.'
  }

  $eligibleDatabaseNames = [System.Collections.Generic.List[string]]::new()
  foreach ($candidateName in $candidateNames) {
    $catalogProbe = Invoke-FixedCatalogPsql -DatabaseName $candidateName `
      -ContainerFile '/workspace/supabase/local-bootstrap/claim-authorization-catalog-normalization.sql'
    if ($catalogProbe.ExitCode -eq 0 -and
        $catalogProbe.Output.Count -eq $expectedPreCatalog.Count -and
        -not (Compare-Object $expectedPreCatalog $catalogProbe.Output -SyncWindow 0)) {
      $eligibleDatabaseNames.Add($candidateName)
    }
  }
  if ($eligibleDatabaseNames.Count -ne 1) {
    throw "Claim authorization finalization requires exactly one exact pre-finalization candidate; found $($eligibleDatabaseNames.Count)."
  }
  $databaseName = $eligibleDatabaseNames[0]

  $transactionPreludeSql = @"
do `$b4_endpoint`$
begin
  if current_user <> 'supabase_admin' or session_user <> 'supabase_admin'
     or not (select rolsuper from pg_catalog.pg_roles where rolname = current_user)
     or current_database() !~ '^(postgres|runner_test_[0-9]+)$'
     or pg_catalog.inet_server_addr() is not null
     or pg_catalog.inet_server_port() is not null then
    raise exception 'invalid privileged B4 endpoint or actor';
  end if;
end
`$b4_endpoint`$;

create function pg_temp.b4_catalog_normalize()
returns table (catalog_tuple pg_catalog.text)
language sql
volatile
set search_path = pg_catalog
as `$b4_normalizer`$
$normalizationBody
`$b4_normalizer`$;

do `$b4_normalizer_config`$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid OPERATOR(pg_catalog.=)
          pg_catalog.to_regprocedure('pg_temp.b4_catalog_normalize()'::pg_catalog.text)
      and p.proconfig OPERATOR(pg_catalog.=)
          array['search_path=pg_catalog'::pg_catalog.text]::pg_catalog.text[]
  ) then
    raise exception 'B4_NORMALIZER_SEARCH_PATH_MISMATCH';
  end if;
end
`$b4_normalizer_config`$;
"@

  function New-CatalogAssertionSql {
    param(
      [Parameter(Mandatory)][ValidateSet('PRE', 'POST')][string]$State,
      [Parameter(Mandatory)][int]$ExpectedCount,
      [Parameter(Mandatory)][string]$ExpectedSha256,
      [Parameter(Mandatory)][int]$TupleStart
    )
    return @"
do `$b4_catalog`$
declare
  observed_expected_count bigint;
  observed_expected_sha256 text;
begin
  with expected(catalog_tuple) as (
    select pg_catalog.substr(line, $TupleStart)
    from pg_catalog.regexp_split_to_table(
      pg_catalog.pg_read_file('/workspace/supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'),
      E'\n'
    ) line
    where line like '$State|%'
  )
  select pg_catalog.count(*),
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      pg_catalog.string_agg(catalog_tuple, E'\n' order by catalog_tuple), 'UTF8'
    ), 'sha256'), 'hex')
  into observed_expected_count, observed_expected_sha256
  from expected;

  if observed_expected_count <> $ExpectedCount
     or observed_expected_sha256 <> '$ExpectedSha256' then
    raise exception 'B4_CATALOG_EXPECTED_ASSET_MISMATCH:$State';
  end if;

  if exists (
    with expected(catalog_tuple) as (
      select pg_catalog.substr(line, $TupleStart)
      from pg_catalog.regexp_split_to_table(
        pg_catalog.pg_read_file('/workspace/supabase/local-bootstrap/claim-authorization-catalog-allowlist.txt'),
        E'\n'
      ) line
      where line like '$State|%'
    ),
    actual(catalog_tuple) as (
      select catalog_tuple from pg_temp.b4_catalog_normalize()
    )
    select 1
    from (
      (select catalog_tuple from expected except all select catalog_tuple from actual)
      union all
      (select catalog_tuple from actual except all select catalog_tuple from expected)
    ) mismatch
  ) then
    raise exception 'B4_CATALOG_MISMATCH:$State';
  end if;
end
`$b4_catalog`$;
"@
  }

  $preCatalogAssertionSql = New-CatalogAssertionSql -State 'PRE' -ExpectedCount 343 `
    -ExpectedSha256 '9a5a533adf878617b72010e18de9d2b78bec0d1eb914162f3768e3a34eefd22d' `
    -TupleStart 5
  $postCatalogAssertionSql = New-CatalogAssertionSql -State 'POST' -ExpectedCount 355 `
    -ExpectedSha256 '46aa89a6b3b5e3bc9fa9ec07e163d30cc468530631a0176ab80c246ab6b72a3f' `
    -TupleStart 6

  $sqlParts = [System.Collections.Generic.List[string]]::new()
  function Add-B4FailureInjection([string]$Point) {
    $sqlParts.Add("do `$b4_injected`$ begin raise notice 'B4_REACHED:$Point'; raise exception 'B4_INJECTED:$Point'; end `$b4_injected`$;")
  }

  $sqlParts.Add('begin;')
  $sqlParts.Add($transactionPreludeSql)
  $sqlParts.Add($preCatalogAssertionSql)
  for ($index = 0; $index -lt $aclManifest.Count; $index++) {
    $sqlParts.Add($aclManifest[$index] + ';')
    $point = "after_acl_$($index + 1)"
    if ($FailurePoint -eq $point) { Add-B4FailureInjection $point }
  }
  if ($FailurePoint -eq 'between_assets') { Add-B4FailureInjection 'between_assets' }
  for ($index = 0; $index -lt $ownershipManifest.Count; $index++) {
    $sqlParts.Add($ownershipManifest[$index] + ';')
    $point = "after_owner_$($index + 1)"
    if ($FailurePoint -eq $point) { Add-B4FailureInjection $point }
  }
  $sqlParts.Add($postCatalogAssertionSql)
  if ($FailurePoint -eq 'final_assertion') { Add-B4FailureInjection 'final_assertion' }
  if ($PauseBeforeCommit) { $sqlParts.Add('select pg_catalog.pg_sleep(30);') }
  $sqlParts.Add('commit;')
  $fixedSql = $sqlParts -join [Environment]::NewLine

  $applicationName = "mujahiz_claim_authorization_finalizer_$InvocationKind"
  $dockerArguments = @('exec', '--interactive')
  $dockerArguments += @('--env', "PGAPPNAME=$applicationName", '--env', 'PGPASSWORD=postgres', $ContainerName, '/usr/bin/env')
  foreach ($environmentName in @('PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSFILE',
      'PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGSSLMODE','PGSSLKEY','PGSSLCERT')) {
    $dockerArguments += @('-u', $environmentName)
  }
  $dockerArguments += @('/usr/bin/psql', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--host=/var/run/postgresql', '--port=5432', '--username=supabase_admin',
    "--dbname=$databaseName", '--quiet')

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  if ($Detach) {
    $dockerCommand = (Get-Command docker -ErrorAction Stop).Source
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $dockerCommand
    $startInfo.Arguments = @($dockerArguments | ForEach-Object {
      '"' + $_.Replace('"', '\"') + '"'
    }) -join ' '
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw 'Claim authorization finalization could not start the fixed interruption process.' }
    $process.StandardInput.Write($fixedSql)
    $process.StandardInput.Close()
    $processId = $process.Id
    $process.Dispose()
    $ErrorActionPreference = $previousErrorActionPreference
    return @("HOST_PROCESS_ID=$processId")
  }
  $output = @($fixedSql | & docker @dockerArguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($exitCode -ne 0) {
    throw "Claim authorization finalization failed.$([Environment]::NewLine)$($output -join [Environment]::NewLine)"
  }
  return $output
}
