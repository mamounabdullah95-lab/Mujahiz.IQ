function Invoke-ClaimAuthorizationFinalizer {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ContainerName,
    [ValidateRange(0, 99)][int]$DatabaseOrdinal = 0,
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


  $databaseName = if ($DatabaseOrdinal -eq 0) { 'postgres' } else { "runner_test_$DatabaseOrdinal" }
  if ($ContainerName -notmatch '^mujahiz-(iq-sql-validation|b4-validation|approve-race|expire-race|reject-race|claim-(assign|hotfix|withdraw)-concurrency)-') {
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

  $preconditionsSql = @'
do $b4$
declare
  expected_roles constant name[] := array[
    'mujahiz_claim_human_command_owner','mujahiz_claim_expiry_command_owner',
    'mujahiz_claim_target_conflict_helper_owner','mujahiz_claim_reviewer_prior_context_helper_owner'
  ]::name[];
  role_name name;
  acl_actual text[];
begin
  if current_user <> 'supabase_admin' or session_user <> 'supabase_admin'
     or not (select rolsuper from pg_roles where rolname=current_user)
     or current_database() !~ '^(postgres|runner_test_[0-9]+)$'
     or inet_server_addr() is not null or inet_server_port() is not null then
    raise exception 'invalid privileged B4 endpoint or actor';
  end if;
  foreach role_name in array expected_roles loop
    if not exists (select 1 from pg_authid where rolname=role_name and not rolsuper
      and not rolinherit and not rolcreaterole and not rolcreatedb and not rolcanlogin
      and not rolreplication and not rolbypassrls and rolpassword is null)
      or exists (select 1 from pg_auth_members where roleid=(select oid from pg_roles where rolname=role_name)
        or member=(select oid from pg_roles where rolname=role_name))
      or exists (select 1 from pg_db_role_setting where setrole=(select oid from pg_roles where rolname=role_name))
      or exists (select 1 from pg_parameter_acl p cross join lateral aclexplode(p.paracl) a
        where a.grantee=(select oid from pg_roles where rolname=role_name))
      or exists (select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
        where a.grantee=(select oid from pg_roles where rolname=role_name)) then
      raise exception 'unsafe B4 role precondition: %',role_name;
    end if;
  end loop;
  if not has_schema_privilege('mujahiz_claim_human_command_owner','claim_security','USAGE')
     or has_schema_privilege('mujahiz_claim_human_command_owner','claim_security','CREATE') then
    raise exception 'unexpected human owner schema precondition';
  end if;
  select array_agg(grantee.rolname||'|'||grantor.rolname||'|'||a.privilege_type||'|'||a.is_grantable order by grantee.rolname)
  into acl_actual from pg_proc p cross join lateral aclexplode(p.proacl) a
  join pg_roles grantee on grantee.oid=a.grantee join pg_roles grantor on grantor.oid=a.grantor
  where p.oid='claim_security.current_privileged_actor_v1()'::regprocedure;
  if acl_actual <> array[
    'mujahiz_claim_owner_projection|mujahiz_claim_owner_projection|EXECUTE|false',
    'mujahiz_claim_reviewer_projection|mujahiz_claim_owner_projection|EXECUTE|false',
    'mujahiz_claim_runtime|mujahiz_claim_owner_projection|EXECUTE|false',
    'postgres|mujahiz_claim_owner_projection|EXECUTE|false'] then
    raise exception 'unexpected current_privileged_actor_v1 ACL precondition';
  end if;
  select array_agg(grantee.rolname||'|'||grantor.rolname||'|'||a.privilege_type||'|'||a.is_grantable order by grantee.rolname)
  into acl_actual from pg_proc p cross join lateral aclexplode(p.proacl) a
  join pg_roles grantee on grantee.oid=a.grantee join pg_roles grantor on grantor.oid=a.grantor
  where p.oid='claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure;
  if acl_actual <> array[
    'mujahiz_claim_owner_projection|mujahiz_claim_owner_projection|EXECUTE|false',
    'postgres|mujahiz_claim_owner_projection|EXECUTE|false'] then
    raise exception 'unexpected privileged_actor_for_profile_v1 ACL precondition';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='supplier_claim' and p.prosecdef)<>24
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='supplier_claim' and p.prosecdef
        and p.proconfig is distinct from array['search_path=pg_catalog'])
    or (select not (p.prosecdef and p.provolatile='v'
        and p.proconfig=array['search_path=pg_catalog']) from pg_proc p
      where p.oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure) is distinct from false
    or (select not (p.prosecdef and p.provolatile='s'
        and p.proconfig=array['search_path=pg_catalog']) from pg_proc p
      where p.oid='claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure) is distinct from false then
    raise exception 'unexpected SECURITY DEFINER mode or fixed search_path precondition';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_roles r on r.oid=p.proowner where ((n.nspname='supplier_claim' and p.prosecdef)
      or p.oid in ('claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure,
        'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure))
      and r.rolname<>'postgres') then
    raise exception 'unexpected ownership precondition';
  end if;
  if (select count(*) from pg_policy where polrelid='public.supplier_ownership_claims'::regclass)<>10 then
    raise exception 'ordinary B4 policy precondition missing';
  end if;
end
$b4$;
create temp table b4_helper_snapshot on commit drop as
select oid,prosrc,provolatile,prosecdef,proconfig from pg_proc where oid in (
  'claim_security.current_privileged_actor_v1()'::regprocedure,
  'claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure,
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure,
  'claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure);
'@

  $postconditionsSql = @'
do $b4$
declare acl_actual text[];
begin
  if exists (select 1 from b4_helper_snapshot s join pg_proc p using(oid)
    where (s.prosrc,s.provolatile,s.prosecdef,s.proconfig) is distinct from
      (p.prosrc,p.provolatile,p.prosecdef,p.proconfig)) then
    raise exception 'helper body/mode/search_path changed during finalization';
  end if;
  select array_agg(grantee.rolname||'|'||grantor.rolname||'|'||a.privilege_type||'|'||a.is_grantable order by grantee.rolname)
  into acl_actual from pg_proc p cross join lateral aclexplode(p.proacl) a
  join pg_roles grantee on grantee.oid=a.grantee join pg_roles grantor on grantor.oid=a.grantor
  where p.oid='claim_security.current_privileged_actor_v1()'::regprocedure;
  if acl_actual <> array[
    'mujahiz_claim_human_command_owner|mujahiz_claim_owner_projection|EXECUTE|false',
    'mujahiz_claim_owner_projection|mujahiz_claim_owner_projection|EXECUTE|false',
    'mujahiz_claim_reviewer_projection|mujahiz_claim_owner_projection|EXECUTE|false',
    'mujahiz_claim_runtime|mujahiz_claim_owner_projection|EXECUTE|false'] then
    raise exception 'unexpected current_privileged_actor_v1 final ACL';
  end if;
  select array_agg(grantee.rolname||'|'||grantor.rolname||'|'||a.privilege_type||'|'||a.is_grantable order by grantee.rolname)
  into acl_actual from pg_proc p cross join lateral aclexplode(p.proacl) a
  join pg_roles grantee on grantee.oid=a.grantee join pg_roles grantor on grantor.oid=a.grantor
  where p.oid='claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure;
  if acl_actual <> array[
    'mujahiz_claim_human_command_owner|mujahiz_claim_owner_projection|EXECUTE|false',
    'mujahiz_claim_owner_projection|mujahiz_claim_owner_projection|EXECUTE|false'] then
    raise exception 'unexpected privileged_actor_for_profile_v1 final ACL';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join pg_roles r on r.oid=p.proowner where n.nspname='supplier_claim' and p.prosecdef
      and r.rolname='mujahiz_claim_human_command_owner')<>10
    or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join pg_roles r on r.oid=p.proowner where n.nspname='supplier_claim' and p.prosecdef
      and r.rolname='mujahiz_claim_expiry_command_owner')<>14
    or (select pg_get_userbyid(proowner) from pg_proc where oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure)
      <> 'mujahiz_claim_target_conflict_helper_owner'
    or (select pg_get_userbyid(proowner) from pg_proc where oid='claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure)
      <> 'mujahiz_claim_reviewer_prior_context_helper_owner'
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='supplier_claim' and p.prosecdef and pg_get_userbyid(p.proowner)='postgres') then
    raise exception 'unexpected final routine-owner inventory';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join pg_roles r on r.oid=p.proowner where n.nspname='supplier_claim'
      and r.rolname in ('mujahiz_claim_human_command_owner','mujahiz_claim_expiry_command_owner')
      and p.proconfig is distinct from array['search_path=pg_catalog']) then
    raise exception 'transferred Claim definer lost its fixed search_path';
  end if;

  if exists (select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid or r.oid=m.member
      where r.rolname in ('mujahiz_claim_human_command_owner','mujahiz_claim_expiry_command_owner',
        'mujahiz_claim_target_conflict_helper_owner','mujahiz_claim_reviewer_prior_context_helper_owner'))
    or exists (select 1 from pg_namespace n cross join lateral aclexplode(n.nspacl) a
      join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner'
        and (a.privilege_type='CREATE' or a.is_grantable))
    or exists (select 1 from pg_class c cross join lateral aclexplode(c.relacl) a
      join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner' and a.is_grantable)
    or exists (select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a
      join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner' and a.is_grantable)
    or exists (select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a
      join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner' and a.is_grantable) then
    raise exception 'prohibited membership, schema CREATE, or grant option after B4';
  end if;
  if exists (select 1 from pg_shdepend d join pg_roles r on r.oid=d.refobjid
    where d.refclassid='pg_authid'::regclass
      and r.rolname in ('mujahiz_claim_human_command_owner','mujahiz_claim_expiry_command_owner',
        'mujahiz_claim_target_conflict_helper_owner','mujahiz_claim_reviewer_prior_context_helper_owner')
      and not ((d.classid='pg_class'::regclass and d.deptype='a')
        or (d.classid='pg_namespace'::regclass and d.deptype='a')
        or (d.classid='pg_policy'::regclass and d.deptype='r')
        or (d.classid='pg_proc'::regclass and d.deptype in ('a','o')))) then
    raise exception 'unexpected pg_shdepend tuple class after B4';
  end if;
end
$b4$;
'@

  $sqlParts = [System.Collections.Generic.List[string]]::new()
  $sqlParts.Add('begin;')
  $sqlParts.Add($preconditionsSql)
  for ($index = 0; $index -lt $aclManifest.Count; $index++) {
    $sqlParts.Add($aclManifest[$index] + ';')
    if ($FailurePoint -eq "after_acl_$($index + 1)") { $sqlParts.Add("do `$`$ begin raise exception 'injected after ACL-$($index + 1)'; end `$`$;") }
  }
  if ($FailurePoint -eq 'between_assets') { $sqlParts.Add("do `$`$ begin raise exception 'injected between assets'; end `$`$;") }
  for ($index = 0; $index -lt $ownershipManifest.Count; $index++) {
    $sqlParts.Add($ownershipManifest[$index] + ';')
    if ($FailurePoint -eq "after_owner_$($index + 1)") { $sqlParts.Add("do `$`$ begin raise exception 'injected after ownership $($index + 1)'; end `$`$;") }
  }
  $sqlParts.Add($postconditionsSql)
  if ($FailurePoint -eq 'final_assertion') { $sqlParts.Add("do `$`$ begin raise exception 'injected final assertion'; end `$`$;") }
  if ($PauseBeforeCommit) { $sqlParts.Add('select pg_catalog.pg_sleep(30);') }
  $sqlParts.Add('commit;')
  $fixedSql = $sqlParts -join [Environment]::NewLine

  $applicationName = "mujahiz_claim_authorization_finalizer_$InvocationKind"
  $dockerArguments = @('exec')
  if ($Detach) { $dockerArguments += '--detach' } else { $dockerArguments += '--interactive' }
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
    $dockerArguments += @('--command', $fixedSql)
    $output = @(& docker @dockerArguments 2>&1 | ForEach-Object { $_.ToString() })
  }
  else {
    $output = @($fixedSql | & docker @dockerArguments 2>&1 | ForEach-Object { $_.ToString() })
  }
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($exitCode -ne 0) {
    throw "Claim authorization finalization failed.$([Environment]::NewLine)$($output -join [Environment]::NewLine)"
  }
  return $output
}
