[CmdletBinding()]
param([string]$PostgresImage='supabase/postgres:17.6.1.064')
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name="mujahiz-approve-race-$PID-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$started=$false
$checks=[Collections.Generic.List[string]]::new()
$sw=[Diagnostics.Stopwatch]::StartNew()

function Assert([bool]$ok,[string]$message) {
  if(-not $ok){throw "Assertion failed: $message"}
  $script:checks.Add($message)
}
function Id([int]$number) {
  'c1000000-0000-4000-8000-'+$number.ToString('000000000000')
}
function Key([int]$number) {
  'claim-c1000000-0000-4000-8000-'+$number.ToString('000000000000')
}
function Q([string]$sql,[string]$label,[switch]$allow) {
  $args=@('exec',$name,'psql','--no-psqlrc','--set=ON_ERROR_STOP=1',
    '--set=VERBOSITY=verbose','-U','postgres','-d','postgres','-qAt',
    '-P','footer=off','-c',$sql)
  $old=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  $output=@(& docker @args 2>&1|ForEach-Object{$_.ToString()})
  $code=$LASTEXITCODE
  $ErrorActionPreference=$old
  if($code-ne 0-and-not $allow){
    throw "$label failed. $($output-join[Environment]::NewLine)"
  }
  [pscustomobject]@{
    ExitCode=$code
    Output=$output
    Text=$output-join[Environment]::NewLine
  }
}
function J($call,[string]$label) {
  if($call.ExitCode){throw "$label failed. $($call.Text)"}
  $line=@($call.Output|Where-Object{$_-match'^\{'}|Select-Object -Last 1)
  if($line.Count-ne 1){throw "$label returned no JSON. $($call.Text)"}
  $line[0]|ConvertFrom-Json
}
function V([string]$sql,[string]$pattern,[string]$label) {
  $call=Q $sql $label
  @($call.Output|Where-Object{$_-match$pattern}|Select-Object -Last 1)[0]
}
function RuntimeSql([string]$principal,[string]$body) {
  "set role mujahiz_claim_runtime;begin;select claim_security.establish_claim_runtime_context('$principal');select pg_catalog.set_config('mujahiz.claim.hmac_key',repeat('k',32),true);$body commit;"
}
function ReserveApprove([string]$principal,[string]$key,[string]$claim) {
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.approve('$key','$claim',2,1,'manual_review','claim_evidence_review_v1','verified',array['authorized_officer_confirmation'],'approve-race-ref',null)x;") "reserve approve $key"
}
function ApproveSql([string]$principal,[string]$key,[string]$claim,[string]$fence) {
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim._execute_approve('$key','$claim',2,1,'manual_review','claim_evidence_review_v1','verified',array['authorized_officer_confirmation'],'approve-race-ref',gen_random_uuid(),'$fence')x;"
}
function ReserveWithdraw([string]$principal,[string]$key,[string]$claim) {
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reserve_withdraw('$key','$claim',2)x;") "reserve withdraw $key"
}
function WithdrawSql([string]$principal,[string]$key,[string]$claim,[string]$fence) {
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.withdraw('$key','$claim',2,null,'$fence')x;"
}
function ReserveReject([string]$principal,[string]$key,[string]$claim) {
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reject('$key','$claim',2,1,'supplier_mismatch','manual_review','claim_evidence_review_v1','verified','reject-race-ref',null)x;") "reserve reject $key"
}
function RejectSql([string]$principal,[string]$key,[string]$claim,[string]$fence) {
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim._execute_reject('$key','$claim',2,1,'supplier_mismatch','manual_review','claim_evidence_review_v1','verified','reject-race-ref',null,'$fence')x;"
}
function ReserveSubmit([string]$principal,[string]$key,[string]$supplier) {
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reserve_submit('$key','$supplier','approve race submit request','claim_evidence_v1','[]'::jsonb,null)x;") "reserve submit $key"
}
function SubmitSql([string]$principal,[string]$key,[string]$supplier,[string]$fence) {
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.submit('$key','$supplier','approve race submit request','claim_evidence_v1','[]'::jsonb,null,null,'$fence')x;"
}
function Block([string]$supplier,[int]$seconds=3) {
  "begin;select pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$supplier'));select pg_sleep($seconds);commit;"
}
function Race([string]$one,[string]$two,[string]$block) {
  $docker=(Get-Command docker).Source
  $run={
    param($dockerPath,$container,$sql)
    $args=@('exec',$container,'psql','--no-psqlrc','--set=ON_ERROR_STOP=1',
      '--set=VERBOSITY=verbose','-U','postgres','-d','postgres','-qAt',
      '-P','footer=off','-c',$sql)
    $output=@(& $dockerPath @args 2>&1|ForEach-Object{$_.ToString()})
    [pscustomobject]@{
      ExitCode=$LASTEXITCODE
      Output=$output
      Text=$output-join[Environment]::NewLine
    }
  }
  $blocker=Start-Job $run -ArgumentList $docker,$name,$block
  Start-Sleep -Milliseconds 500
  $jobOne=Start-Job $run -ArgumentList $docker,$name,$one
  $jobTwo=Start-Job $run -ArgumentList $docker,$name,$two
  try {
    Wait-Job @($jobOne,$jobTwo,$blocker) -Timeout 30|Out-Null
    if($jobOne.State-ne'Completed'-or$jobTwo.State-ne'Completed'-or$blocker.State-ne'Completed'){
      throw 'race timeout'
    }
    $blockResult=Receive-Job $blocker
    if($blockResult.ExitCode){throw "race blocker failed. $($blockResult.Text)"}
    @((Receive-Job $jobOne),(Receive-Job $jobTwo))
  }
  finally {
    Remove-Job @($jobOne,$jobTwo,$blocker) -Force -ErrorAction SilentlyContinue
  }
}

try {
  $mount="type=bind,source=$root,target=/workspace,readonly"
  docker run -d --rm --name $name --mount $mount -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres $PostgresImage|Out-Null
  if($LASTEXITCODE){throw 'container start failed'}
  $started=$true
  $ready=$false
  1..60|ForEach-Object{
    if(-not $ready){
      docker exec $name pg_isready -U postgres -d postgres *> $null
      $databaseReady=$LASTEXITCODE-eq 0
      docker exec $name sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
      if($databaseReady-and$LASTEXITCODE-ne 0){$ready=$true}
      else{Start-Sleep -Milliseconds 500}
    }
  }
  if(-not $ready){throw 'postgres not ready'}
  $boot="create schema if not exists extensions;create extension if not exists pgtap with schema extensions;do "+'$x$'+" begin if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin noinherit;end if;if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin noinherit;end if;if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin noinherit;end if;end "+'$x$'+";"
  Q $boot bootstrap|Out-Null
  Get-ChildItem (Join-Path $root 'supabase/migrations') -File -Filter '*.sql'|
    Sort-Object Name|ForEach-Object{
      $old=$ErrorActionPreference
      $ErrorActionPreference='Continue'
      $output=@(docker exec $name psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -f "/workspace/supabase/migrations/$($_.Name)" 2>&1)
      $code=$LASTEXITCODE
      $ErrorActionPreference=$old
      if($code){throw "migration failed: $($_.Name) $output"}
    }
  $source=[IO.File]::ReadAllText((Join-Path $root 'supabase/tests/approve_trusted_command.sql'))
  $begin=$source.IndexOf('create function pg_temp.approve_id')
  $end=$source.IndexOf('-- Successful approval paths')
  $helpers=$source.Substring($begin,$end-$begin).Replace('pg_temp.','public.')
  $temp=[IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($temp,$helpers,[Text.UTF8Encoding]::new($false))
    docker cp $temp ($name+':/tmp/approve-race-helpers.sql')|Out-Null
    if($LASTEXITCODE){throw 'helper copy failed'}
    $old=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    $output=@(docker exec $name psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -f /tmp/approve-race-helpers.sql 2>&1)
    $code=$LASTEXITCODE
    $ErrorActionPreference=$old
    if($code){throw "helpers failed: $output"}
  }
  finally {Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}

  $fixture=@(
    "select public.seed_eligible_actor(1,'owner')",
    "select public.seed_eligible_actor(2,'admin')",
    "select public.seed_eligible_actor(3,'owner')",
    "select public.seed_claimant(n) from generate_series(101,114)n",
    "select public.seed_supplier(n) from generate_series(201,210)n",
    "select public.seed_claim(1001,101,201,'under_review',1,3,false)",
    "select public.seed_claim(1002,102,202,'under_review',1,3,false)",
    "select public.seed_claim(1003,103,202,'under_review',2,3,false)",
    "select public.seed_claim(1004,104,203,'under_review',1,3,false)",
    "select public.seed_claim(1005,105,204,'under_review',1,3,false)",
    "select public.seed_claim(1006,106,205,'under_review',1,3,false)",
    "select public.seed_claim(1007,107,206,'under_review',1,3,false)",
    "select public.seed_claim(1008,108,207,'under_review',1,3,false)",
    "select public.seed_claim(1009,109,208,'under_review',2,3,false)",
    "select public.seed_claim(1010,110,209,'under_review',1,3,false)",
    "select public.seed_claim(1011,111,210,'under_review',1,3,false)",
    'grant mujahiz_claim_runtime to postgres with set true',
    'grant usage on schema extensions to mujahiz_claim_runtime'
  )
  Q (($fixture-join';')+';') fixture|Out-Null
  $owner=Id 1
  $admin=Id 2

  # Same key and fence: only one Phase-B execution may commit.
  $claim=Id 1001;$supplier=Id 201;$key=Key 201
  $reservation=J (ReserveApprove $owner $key $claim) same-key-reserve
  $race=Race (ApproveSql $owner $key $claim $reservation.execution_fence) (ApproveSql $owner $key $claim $reservation.execution_fence) (Block $supplier)
  Assert (@($race|Where-Object ExitCode -eq 0).Count-eq 1-and@($race|Where-Object ExitCode -ne 0)[0].Text-match'P5110.*retry_later') 'same approve key and fence has one Phase-B winner'
  $replay=J (ReserveApprove $owner $key $claim) same-key-replay
  Assert ($replay.reservation_outcome-eq'replay'-and$replay.idempotent_replay) 'same approve key returns one coherent replay'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')||'/'||(select count(*)from internal.domain_events where aggregate_id='$claim')||'/'||(select count(*)from internal.audit_logs where target_id='$claim'and outcome_class='succeeded')from public.supplier_ownership_claims where id='$claim';" '^approved/' same-key-state)-eq'approved/3/1/1/1') 'same key leaves one ownership mutation event and success audit'

  # Different keys against the same Claim.
  $claim=Id 1011;$supplier=Id 210;$keyOne=Key 202;$keyTwo=Key 203
  $one=J (ReserveApprove $owner $keyOne $claim) same-claim-one
  $two=J (ReserveApprove $owner $keyTwo $claim) same-claim-two
  $race=Race (ApproveSql $owner $keyOne $claim $one.execution_fence) (ApproveSql $owner $keyTwo $claim $two.execution_fence) (Block $supplier)
  Assert (@($race|Where-Object ExitCode -eq 0).Count-eq 1-and@($race|Where-Object ExitCode -ne 0)[0].Text-match'P5112.*claim_version_conflict') 'different approve keys against one Claim commit once'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^approved/' same-claim-state)-eq'approved/3/1') 'different keys leave one approved aggregate and ownership'

  # Different Claims compete for one Supplier.
  $claimOne=Id 1002;$claimTwo=Id 1003;$supplier=Id 202;$keyOne=Key 204;$keyTwo=Key 205
  $one=J (ReserveApprove $owner $keyOne $claimOne) two-claims-one
  $two=J (ReserveApprove $admin $keyTwo $claimTwo) two-claims-two
  $race=Race (ApproveSql $owner $keyOne $claimOne $one.execution_fence) (ApproveSql $admin $keyTwo $claimTwo $two.execution_fence) (Block $supplier)
  Assert (@($race|Where-Object ExitCode -eq 0).Count-eq 1-and@($race|Where-Object ExitCode -ne 0)[0].Text-match'P5112.*claim_version_conflict') 'two Claims for one Supplier have one approval winner'
  Assert ((V "select string_agg(status,','order by status)||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier'and ownership_status='active')||'/'||(select count(*)from internal.domain_events where aggregate_id in('$claimOne','$claimTwo'))from public.supplier_ownership_claims where id in('$claimOne','$claimTwo');" '^approved,superseded/' two-claims-state)-eq'approved,superseded/1/2') 'two-Claim race commits one owner and deterministic supersession'

  # Concurrent ownership creator wins the shared empty slot.
  $claim=Id 1004;$supplier=Id 203;$key=Key 206
  $reservation=J (ReserveApprove $owner $key $claim) ownership-reserve
  $writer="begin;select pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$supplier'));insert into public.supplier_ownerships(id,supplier_profile_id,controller_user_profile_id,valid_from,establishment_source_type,establishment_reason_code,establishment_system_source)values('d1000000-0000-4000-8000-000000000203','$supplier','$admin',statement_timestamp()-interval '1 minute','legacy_reconciliation','synthetic_concurrent_ownership','approve_race');select pg_sleep(3);commit;"
  $race=Race (ApproveSql $owner $key $claim $reservation.execution_fence) 'select 1;' $writer
  $result=J $race[0] ownership-result
  Assert ($result.outcome_code-eq'supplier_already_owned') 'concurrent ownership creation denies stale approval'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')||'/'||(select count(*)from internal.domain_events where aggregate_id='$claim')from public.supplier_ownership_claims where id='$claim';" '^under_review/' ownership-state)-eq'under_review/2/1/0') 'ownership race leaves no partial approval aggregate'

  # Submit either precedes approval and is superseded, or observes the new owner.
  $claim=Id 1005;$supplier=Id 204;$submitter=Id 114;$approveKey=Key 207;$submitKey=Key 208
  $approval=J (ReserveApprove $owner $approveKey $claim) submit-approve-reserve
  $submit=J (ReserveSubmit $submitter $submitKey $supplier) submit-reserve
  $race=Race (ApproveSql $owner $approveKey $claim $approval.execution_fence) (SubmitSql $submitter $submitKey $supplier $submit.execution_fence) (Block $supplier)
  $approvalResult=J $race[0] submit-approval-result
  $submitSucceeded=$race[1].ExitCode-eq 0
  Assert ($approvalResult.outcome_code-eq'approved'-and($submitSucceeded-or$race[1].Text-match'P5105.*supplier_already_owned')) 'approve versus submit has only approved/superseded or owned-denial outcomes'
  Assert ([int]$approvalResult.superseded_claim_count-eq($(if($submitSucceeded){1}else{0}))) 'approve reports the concurrently committed submit exactly when present'
  Assert ((V "select status||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier'and ownership_status='active')||'/'||(select count(*)from public.supplier_ownership_claims where supplier_profile_id='$supplier'and claimant_user_profile_id='$submitter'and status not in('superseded'))from public.supplier_ownership_claims where id='$claim';" '^approved/' submit-state)-eq'approved/1/0') 'approve versus submit leaves one owner and no live competitor'

  # Withdraw and Reject each serialize against approval on the same Claim.
  $claim=Id 1006;$supplier=Id 205;$claimant=Id 106;$approveKey=Key 209;$otherKey=Key 210
  $approval=J (ReserveApprove $owner $approveKey $claim) withdraw-approve
  $withdraw=J (ReserveWithdraw $claimant $otherKey $claim) withdraw-reserve
  $race=Race (ApproveSql $owner $approveKey $claim $approval.execution_fence) (WithdrawSql $claimant $otherKey $claim $withdraw.execution_fence) (Block $supplier)
  Assert (@($race|Where-Object ExitCode -eq 0).Count-eq 1-and@($race|Where-Object ExitCode -ne 0)[0].Text-match'P5112.*claim_version_conflict') 'approve versus withdraw has one terminal winner'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^(approved|withdrawn)/' withdraw-state)-in@('approved/3/1','withdrawn/3/0')) 'approve versus withdraw leaves a complete matching aggregate'

  $claim=Id 1007;$supplier=Id 206;$approveKey=Key 211;$otherKey=Key 212
  $approval=J (ReserveApprove $owner $approveKey $claim) reject-approve
  $reject=J (ReserveReject $owner $otherKey $claim) reject-reserve
  $race=Race (ApproveSql $owner $approveKey $claim $approval.execution_fence) (RejectSql $owner $otherKey $claim $reject.execution_fence) (Block $supplier)
  Assert (@($race|Where-Object ExitCode -eq 0).Count-eq 1-and@($race|Where-Object ExitCode -ne 0)[0].Text-match'P5112.*claim_version_conflict') 'approve versus reject has one terminal winner'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^(approved|rejected)/' reject-state)-in@('approved/3/1','rejected/3/0')) 'approve versus reject leaves a complete matching aggregate'

  # Expire is intentionally absent; this writer models its approved shared-lock transition.
  $claim=Id 1008;$supplier=Id 207;$key=Key 213
  $reservation=J (ReserveApprove $owner $key $claim) expiry-reserve
  $writer="begin;select pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$supplier'));update public.supplier_ownership_claims set status='expired',record_version=record_version+1,expired_at=clock_timestamp(),expiry_system_source_code='approve_race',expiry_policy_version='claim_expiry_v1',updated_at=clock_timestamp()where id='$claim';select pg_sleep(3);commit;"
  $race=Race (ApproveSql $owner $key $claim $reservation.execution_fence) 'select 1;' $writer
  Assert ($race[0].ExitCode-ne 0-and$race[0].Text-match'P5112.*claim_version_conflict') 'expiry-equivalent transition invalidates stale approval'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^expired/' expiry-state)-eq'expired/3/0') 'expiry race leaves no ownership or partial approval'

  # Reviewer and claimant eligibility loss are re-read after shared principal locks.
  $claim=Id 1009;$supplier=Id 208;$key=Key 214
  $reservation=J (ReserveApprove $admin $key $claim) reviewer-loss-reserve
  $writer="begin;select pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$admin'));update internal.security_eligibility_assessments set assessment_result='deny',condition_type='security_hold',assessment_source_type='trusted_security_system'where user_profile_id='$admin';select pg_sleep(3);commit;"
  $race=Race (ApproveSql $admin $key $claim $reservation.execution_fence) 'select 1;' $writer
  $result=J $race[0] reviewer-loss-result
  Assert ($result.outcome_code-eq'actor_not_authorized') 'reviewer authority loss is re-read after the principal lock'
  Assert ((V "select status||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^under_review/' reviewer-loss-state)-eq'under_review/0') 'reviewer loss leaves no ownership or Claim mutation'

  $claim=Id 1010;$supplier=Id 209;$claimant=Id 110;$key=Key 215
  $reservation=J (ReserveApprove $owner $key $claim) claimant-loss-reserve
  $writer="begin;select pg_advisory_xact_lock(claim_security.claim_principal_lock_key_v1('$claimant'));update public.user_profiles set verification_mirror_status='unverified',verification_mirror_observed_at=clock_timestamp(),updated_at=clock_timestamp()where id='$claimant';select pg_sleep(3);commit;"
  $race=Race (ApproveSql $owner $key $claim $reservation.execution_fence) 'select 1;' $writer
  $result=J $race[0] claimant-loss-result
  Assert ($result.outcome_code-eq'claimant_ineligible') 'claimant eligibility loss is re-read after the principal lock'
  Assert ((V "select status||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^under_review/' claimant-loss-state)-eq'under_review/0') 'claimant loss leaves no ownership or Claim mutation'

  $counts=V "select (select count(*)from public.supplier_ownership_claims where status='approved')||'/'||(select count(*)from public.supplier_ownerships where establishment_source_type='claim_approval')||'/'||(select count(*)from internal.domain_events where event_type='supplier_ownership.claim_approved')||'/'||(select count(*)from internal.audit_logs where action_code='supplier_claim.approve'and outcome_class='succeeded');" '^\d+/\d+/\d+/\d+$' global-counts
  Assert ($counts-match'^([4-6])/\1/\1/\1$') 'global approved Claim ownership event and success-audit totals match'
  $integrity=V "select (not exists(select 1 from public.supplier_ownership_claims c left join public.supplier_ownerships o on o.id=c.resulting_supplier_ownership_id where c.status='approved'and(o.id is null or o.supplier_profile_id<>c.supplier_profile_id or o.controller_user_profile_id<>c.claimant_user_profile_id or o.ownership_status<>'active'))and not exists(select 1 from public.supplier_ownerships o left join public.supplier_ownership_claims c on c.resulting_supplier_ownership_id=o.id and c.status='approved'where o.establishment_source_type='claim_approval'and c.id is null)and not exists(select 1 from public.supplier_ownerships where ownership_status='active'group by supplier_profile_id having count(*)>1)and not exists(select 1 from internal.domain_events where producer_command_name='supplier_claim.approve'and(payload?'checked_source_classes'or payload?'restricted_evidence_reference'or payload?'evidence_digest')));" '^[tf]$' global-integrity
  Assert ($integrity-eq't') 'all races preserve aggregate integrity uniqueness and event minimization'

  $sw.Stop()
  Write-Output ("Claim approve concurrency validation passed: {0} checks; ten true-session races; {1:n1}s elapsed."-f$checks.Count,$sw.Elapsed.TotalSeconds)
}
finally {
  if($started){docker rm -f $name *> $null}
}
