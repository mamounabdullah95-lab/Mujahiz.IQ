[CmdletBinding()]
param([string]$PostgresImage='supabase/postgres:17.6.1.064')
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name="mujahiz-expire-race-$PID-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$started=$false
$checks=[Collections.Generic.List[string]]::new()
$sw=[Diagnostics.Stopwatch]::StartNew()

function Assert([bool]$ok,[string]$message){if(-not $ok){throw "Assertion failed: $message"};$script:checks.Add($message)}
function Id([int]$n){'c1000000-0000-4000-8000-'+$n.ToString('000000000000')}
function Key([int]$n){'claim-c1000000-0000-4000-8000-'+$n.ToString('000000000000')}
function Q([string]$sql,[string]$label,[switch]$allow){
  $args=@('exec',$name,'psql','--no-psqlrc','--set=ON_ERROR_STOP=1','--set=VERBOSITY=verbose',
    '-U','postgres','-d','postgres','-qAt','-P','footer=off','-c',$sql)
  $old=$ErrorActionPreference;$ErrorActionPreference='Continue'
  $out=@(& docker @args 2>&1|ForEach-Object{$_.ToString()});$code=$LASTEXITCODE
  $ErrorActionPreference=$old
  if($code-ne 0-and-not $allow){throw "$label failed. $($out-join[Environment]::NewLine)"}
  [pscustomobject]@{ExitCode=$code;Output=$out;Text=$out-join[Environment]::NewLine}
}
function J($call,[string]$label){
  if($call.ExitCode){throw "$label failed. $($call.Text)"}
  $line=@($call.Output|Where-Object{$_-match'^\{'}|Select-Object -Last 1)
  if($line.Count-ne 1){throw "$label returned no JSON. $($call.Text)"}
  $line[0]|ConvertFrom-Json
}
function V([string]$sql,[string]$pattern,[string]$label){
  $call=Q $sql $label
  @($call.Output|Where-Object{$_-match$pattern}|Select-Object -Last 1)[0]
}
function WorkerSql([string]$body){
  "set role mujahiz_claim_expiry_worker;begin;select set_config('mujahiz.claim.environment','local',true);select set_config('mujahiz.claim.worker_purpose','supplier_claim_expiry',true);select set_config('mujahiz.claim.expiry_policy_version','claim_expiry_v1',true);select set_config('mujahiz.claim.hmac_key',repeat('k',32),true);$body commit;"
}
function RuntimeSql([string]$principal,[string]$body){
  "set role mujahiz_claim_runtime;begin;select claim_security.establish_claim_runtime_context('$principal');select set_config('mujahiz.claim.hmac_key',repeat('k',32),true);$body commit;"
}
function ReserveExpire([string]$source,[string]$claim,[int]$version){
  Q (WorkerSql "select row_to_json(x)::text from supplier_claim.expire('$source','$claim',$version,null)x;") "reserve expire $source"
}
function ExpireSql([string]$source,[string]$claim,[int]$version,[string]$fence){
  WorkerSql "select row_to_json(x)::text from supplier_claim._execute_expire('$source','$claim',$version,null,'$fence')x;"
}
function ReserveWithdraw([string]$principal,[string]$key,[string]$claim){
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reserve_withdraw('$key','$claim',2)x;") "reserve withdraw"
}
function WithdrawSql([string]$principal,[string]$key,[string]$claim,[string]$fence){
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.withdraw('$key','$claim',2,null,'$fence')x;"
}
function ReserveReject([string]$principal,[string]$key,[string]$claim){
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reject('$key','$claim',2,1,'supplier_mismatch','manual_review','claim_evidence_review_v1','verified','expire-race-ref',null)x;") "reserve reject"
}
function RejectSql([string]$principal,[string]$key,[string]$claim,[string]$fence){
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim._execute_reject('$key','$claim',2,1,'supplier_mismatch','manual_review','claim_evidence_review_v1','verified','expire-race-ref',null,'$fence')x;"
}
function ReserveApprove([string]$principal,[string]$key,[string]$claim){
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.approve('$key','$claim',2,1,'manual_review','claim_evidence_review_v1','verified',array['authorized_officer_confirmation'],'expire-race-ref',null)x;") "reserve approve"
}
function ApproveSql([string]$principal,[string]$key,[string]$claim,[string]$fence){
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim._execute_approve('$key','$claim',2,1,'manual_review','claim_evidence_review_v1','verified',array['authorized_officer_confirmation'],'expire-race-ref',gen_random_uuid(),'$fence')x;"
}
function ReserveAssign([string]$principal,[string]$key,[string]$claim,[string]$candidate){
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reserve_assign_reviewer('$key','$claim',1,'$candidate')x;") "reserve assign"
}
function AssignSql([string]$principal,[string]$key,[string]$claim,[string]$candidate,[string]$fence){
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.assign_reviewer('$key','$claim',1,'$candidate',null,'$fence')x;"
}
function ReserveSubmit([string]$principal,[string]$key,[string]$supplier){
  Q (RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.reserve_submit('$key','$supplier','expire race submit request','claim_evidence_v1','[]'::jsonb,null)x;") "reserve submit"
}
function SubmitSql([string]$principal,[string]$key,[string]$supplier,[string]$fence){
  RuntimeSql $principal "select row_to_json(x)::text from supplier_claim.submit('$key','$supplier','expire race submit request','claim_evidence_v1','[]'::jsonb,null,null,'$fence')x;"
}
function Block([string]$supplier,[int]$seconds=3){
  "begin;select pg_advisory_xact_lock(claim_security.claim_supplier_lock_key_v1('$supplier'));select pg_sleep($seconds);commit;"
}
function Race([string]$one,[string]$two,[string]$block){
  $docker=(Get-Command docker).Source
  $run={param($dockerPath,$container,$sql)
    $args=@('exec',$container,'psql','--no-psqlrc','--set=ON_ERROR_STOP=1','--set=VERBOSITY=verbose',
      '-U','postgres','-d','postgres','-qAt','-P','footer=off','-c',$sql)
    $out=@(& $dockerPath @args 2>&1|ForEach-Object{$_.ToString()})
    [pscustomobject]@{ExitCode=$LASTEXITCODE;Output=$out;Text=$out-join[Environment]::NewLine}
  }
  $b=Start-Job $run -ArgumentList $docker,$name,$block;Start-Sleep -Milliseconds 500
  $a=Start-Job $run -ArgumentList $docker,$name,$one
  $c=Start-Job $run -ArgumentList $docker,$name,$two
  try{
    Wait-Job @($a,$c,$b) -Timeout 35|Out-Null
    if($a.State-ne'Completed'-or$c.State-ne'Completed'-or$b.State-ne'Completed'){throw 'race timeout'}
    $br=Receive-Job $b;if($br.ExitCode){throw "blocker failed. $($br.Text)"}
    @((Receive-Job $a),(Receive-Job $c))
  }finally{Remove-Job @($a,$c,$b) -Force -ErrorAction SilentlyContinue}
}

function RaceOrdered([string]$first,[string]$second,[string]$block,[int]$staggerMs=600){
  $docker=(Get-Command docker).Source
  $run={param($dockerPath,$container,$sql)
    $args=@('exec',$container,'psql','--no-psqlrc','--set=ON_ERROR_STOP=1','--set=VERBOSITY=verbose',
      '-U','postgres','-d','postgres','-qAt','-P','footer=off','-c',$sql)
    $out=@(& $dockerPath @args 2>&1|ForEach-Object{$_.ToString()})
    [pscustomobject]@{ExitCode=$LASTEXITCODE;Output=$out;Text=$out-join[Environment]::NewLine}
  }
  $b=Start-Job $run -ArgumentList $docker,$name,$block;Start-Sleep -Milliseconds 500
  $a=Start-Job $run -ArgumentList $docker,$name,$first;Start-Sleep -Milliseconds $staggerMs
  $c=Start-Job $run -ArgumentList $docker,$name,$second
  try{
    Wait-Job @($a,$c,$b) -Timeout 35|Out-Null
    if($a.State-ne'Completed'-or$c.State-ne'Completed'-or$b.State-ne'Completed'){throw 'ordered race timeout'}
    $br=Receive-Job $b;if($br.ExitCode){throw "ordered blocker failed. $($br.Text)"}
    @((Receive-Job $a),(Receive-Job $c))
  }finally{Remove-Job @($a,$c,$b) -Force -ErrorAction SilentlyContinue}
}
try{
  $mount="type=bind,source=$root,target=/workspace,readonly"
  docker run -d --rm --name $name --mount $mount -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres $PostgresImage|Out-Null
  if($LASTEXITCODE){throw 'container start failed'};$started=$true;$ready=$false
  1..60|ForEach-Object{if(-not$ready){docker exec $name pg_isready -U postgres -d postgres *> $null
    $db=$LASTEXITCODE-eq 0;docker exec $name sh -c "ps -eo args | grep '[m]igrate.sh' > /dev/null" *> $null
    if($db-and$LASTEXITCODE-ne 0){$ready=$true}else{Start-Sleep -Milliseconds 500}}}
  if(-not$ready){throw 'postgres not ready'}
  $boot="create schema if not exists extensions;create extension if not exists pgtap with schema extensions;do "+'$x$'+" begin if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin noinherit;end if;if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin noinherit;end if;if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin noinherit;end if;end "+'$x$'+";"
  Q $boot bootstrap|Out-Null
  Get-ChildItem (Join-Path $root 'supabase/migrations') -File -Filter '*.sql'|Sort-Object Name|ForEach-Object{
    $old=$ErrorActionPreference;$ErrorActionPreference='Continue'
    $out=@(docker exec $name psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -f "/workspace/supabase/migrations/$($_.Name)" 2>&1)
    $code=$LASTEXITCODE;$ErrorActionPreference=$old;if($code){throw "migration failed: $($_.Name) $out"}}
  $source=[IO.File]::ReadAllText((Join-Path $root 'supabase/tests/approve_trusted_command.sql'))
  $begin=$source.IndexOf('create function pg_temp.approve_id');$end=$source.IndexOf('-- Successful approval paths')
  $helpers=$source.Substring($begin,$end-$begin).Replace('pg_temp.','public.')
  $temp=[IO.Path]::GetTempFileName()
  try{[IO.File]::WriteAllText($temp,$helpers,[Text.UTF8Encoding]::new($false));docker cp $temp ($name+':/tmp/helpers.sql')|Out-Null
    $old=$ErrorActionPreference;$ErrorActionPreference='Continue'
    $out=@(docker exec $name psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -f /tmp/helpers.sql 2>&1)
    $code=$LASTEXITCODE;$ErrorActionPreference=$old;if($code){throw "helpers failed: $out"}
  }finally{Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
  $fixture=@("select public.seed_eligible_actor(1,'owner')","select public.seed_eligible_actor(2,'admin')",
    "select public.seed_eligible_actor(3,'owner')","select public.seed_claimant(n) from generate_series(101,112)n",
    "select public.seed_supplier(n) from generate_series(201,212)n",
    "select public.seed_claim(1001,101,201,'under_review',1,3,true)",
    "select public.seed_claim(1002,102,202,'under_review',1,3,true)",
    "select public.seed_claim(1003,103,203,'under_review',1,3,true)",
    "select public.seed_claim(1004,104,204,'under_review',1,3,true)",
    "select public.seed_claim(1005,105,205,'submitted',1,3,true)",
    "select public.seed_claim(1006,106,206,'under_review',1,3,true)",
    "select public.seed_claim(1007,107,207,'under_review',1,3,false)",
    "select public.seed_claim(1008,108,208,'under_review',1,3,true)",
    "select public.seed_claim(1009,109,209,'under_review',1,3,false)",
    "select public.seed_claim(1010,110,210,'submitted',1,3,false)",
    "select public.seed_claim(1011,111,211,'under_review',1,3,false)",
    "select public.seed_claim(1012,112,212,'under_review',1,3,false)",
    'grant mujahiz_claim_runtime to postgres with set true',
    'grant mujahiz_claim_expiry_worker to postgres with set true')
  Q (($fixture-join';')+';') fixture|Out-Null
  $owner=Id 1;$admin=Id 2

  $claim=Id 1001;$supplier=Id 201;$source='expire-race-same';$r=J (ReserveExpire $source $claim 2) reserve-same
  $race=Race (ExpireSql $source $claim 2 $r.execution_fence) (ExpireSql $source $claim 2 $r.execution_fence) (Block $supplier)
  Assert (@($race|Where-Object ExitCode -eq 0).Count-eq 1-and@($race|Where-Object ExitCode -ne 0)[0].Text-match'P5110.*retry_later') 'same observation and fence has one Phase-B winner'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from internal.domain_events where aggregate_id='$claim')from public.supplier_ownership_claims where id='$claim';" '^expired/' same-state)-eq'expired/3/1') 'same observation commits one expiry and event'

  $claim=Id 1002;$supplier=Id 202;$a=J (ReserveExpire 'expire-race-a' $claim 2) reserve-a;$b=J (ReserveExpire 'expire-race-b' $claim 2) reserve-b
  $race=Race (ExpireSql 'expire-race-a' $claim 2 $a.execution_fence) (ExpireSql 'expire-race-b' $claim 2 $b.execution_fence) (Block $supplier)
  $results=@($race|ForEach-Object{J $_ different-observation})
  Assert ((@($results.outcome_code|Sort-Object)-join',')-eq'already_terminal,expired') 'different observations produce one expiry and one validated terminal no-op'
  Assert ((V "select record_version||'/'||(select count(*)from internal.domain_events where aggregate_id='$claim')||'/'||(select count(*)from internal.idempotency_keys where result_resource_id='$claim'and status='completed')from public.supplier_ownership_claims where id='$claim';" '^3/' different-state)-eq'3/1/2') 'different observations increment once and complete both items'

  $claim=Id 1003;$supplier=Id 203;$source='expire-race-withdraw';$e=J (ReserveExpire $source $claim 2) reserve-expire-withdraw;$key=Key 301;$w=J (ReserveWithdraw (Id 103) $key $claim) reserve-withdraw
  $race=Race (ExpireSql $source $claim 2 $e.execution_fence) (WithdrawSql (Id 103) $key $claim $w.execution_fence) (Block $supplier)
  Assert ($race[0].ExitCode-eq 0-and$race[1].ExitCode-ne 0-and$race[1].Text-match'P511[234]') 'due Expire defeats concurrent Withdraw'
  Assert ((V "select status||'/'||record_version from public.supplier_ownership_claims where id='$claim';" '^expired/' withdraw-state)-eq'expired/3') 'Expire versus Withdraw has one terminal transition'

  $claim=Id 1004;$supplier=Id 204;$source='expire-race-reject';$e=J (ReserveExpire $source $claim 2) reserve-expire-reject;$key=Key 302;$rj=J (ReserveReject $owner $key $claim) reserve-reject
  $race=Race (ExpireSql $source $claim 2 $e.execution_fence) (RejectSql $owner $key $claim $rj.execution_fence) (Block $supplier)
  Assert ($race[0].ExitCode-eq 0-and$race[1].ExitCode-ne 0-and$race[1].Text-match'P511[234]') 'due Expire defeats concurrent Reject'

  $claim=Id 1005;$supplier=Id 205;$source='expire-race-assign';$e=J (ReserveExpire $source $claim 1) reserve-expire-assign;$key=Key 303;$ar=J (ReserveAssign $owner $key $claim $admin) reserve-assign
  $race=Race (ExpireSql $source $claim 1 $e.execution_fence) (AssignSql $owner $key $claim $admin $ar.execution_fence) (Block $supplier)
  Assert ($race[0].ExitCode-eq 0-and$race[1].ExitCode-ne 0-and$race[1].Text-match'P511[234]') 'due Expire defeats concurrent reviewer assignment'
  Assert ((V "select status||'/'||coalesce(reviewer_user_profile_id::text,'none')from public.supplier_ownership_claims where id='$claim';" '^expired/' assign-state)-eq'expired/none') 'Expire does not write reviewer fields'

  $claim=Id 1006;$supplier=Id 206;$source='expire-race-approve';$e=J (ReserveExpire $source $claim 2) reserve-expire-approve;$key=Key 304;$ap=J (ReserveApprove $owner $key $claim) reserve-approve
  $race=Race (ExpireSql $source $claim 2 $e.execution_fence) (ApproveSql $owner $key $claim $ap.execution_fence) (Block $supplier)
  Assert ($race[0].ExitCode-eq 0-and$race[1].ExitCode-ne 0-and$race[1].Text-match'P511[234]') 'due Expire defeats concurrent Approve'
  Assert ((V "select status||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier')from public.supplier_ownership_claims where id='$claim';" '^expired/' approve-state)-eq'expired/0') 'Expire versus Approve creates no ownership'
  $claim=Id 1009;$supplier=Id 209;$source='pre-expiry-withdraw';$e=J (ReserveExpire $source $claim 2) reserve-pre-withdraw;$key=Key 306;$w=J (ReserveWithdraw (Id 109) $key $claim) reserve-pre-withdraw-human
  $race=RaceOrdered (WithdrawSql (Id 109) $key $claim $w.execution_fence) (ExpireSql $source $claim 2 $e.execution_fence) (Block $supplier)
  $expireResult=J $race[1] pre-withdraw-expire
  Assert ($race[0].ExitCode-eq 0-and$expireResult.outcome_code-eq'already_terminal') 'pre-expiry Withdraw wins and Expire validates the terminal no-op'
  Assert ((V "select status||'/'||record_version from public.supplier_ownership_claims where id='$claim';" '^withdrawn/' pre-withdraw-state)-eq'withdrawn/3') 'pre-expiry Withdraw remains the sole terminal transition'

  $claim=Id 1010;$supplier=Id 210;$source='pre-expiry-assign';$e=J (ReserveExpire $source $claim 1) reserve-pre-assign;$key=Key 307;$ar=J (ReserveAssign $owner $key $claim $admin) reserve-pre-assign-human
  $race=RaceOrdered (AssignSql $owner $key $claim $admin $ar.execution_fence) (ExpireSql $source $claim 1 $e.execution_fence) (Block $supplier)
  Assert ($race[0].ExitCode-eq 0-and$race[1].ExitCode-ne 0-and$race[1].Text-match'P5112.*claim_version_conflict') 'pre-expiry reviewer assignment wins and stale Expire is fenced by version'
  Assert ((V "select status||'/'||record_version||'/'||reviewer_user_profile_id from public.supplier_ownership_claims where id='$claim';" '^under_review/' pre-assign-state)-eq"under_review/2/$admin") 'pre-expiry assignment provenance remains authoritative'

  $claim=Id 1011;$supplier=Id 211;$source='pre-expiry-reject';$e=J (ReserveExpire $source $claim 2) reserve-pre-reject;$key=Key 308;$rj=J (ReserveReject $owner $key $claim) reserve-pre-reject-human
  $race=RaceOrdered (RejectSql $owner $key $claim $rj.execution_fence) (ExpireSql $source $claim 2 $e.execution_fence) (Block $supplier)
  $expireResult=J $race[1] pre-reject-expire
  Assert ($race[0].ExitCode-eq 0-and$expireResult.outcome_code-eq'already_terminal') 'pre-expiry Reject wins and Expire validates the terminal no-op'
  Assert ((V "select status||'/'||record_version from public.supplier_ownership_claims where id='$claim';" '^rejected/' pre-reject-state)-eq'rejected/3') 'pre-expiry Reject remains the sole terminal transition'

  $claim=Id 1012;$supplier=Id 212;$source='pre-expiry-approve';$e=J (ReserveExpire $source $claim 2) reserve-pre-approve;$key=Key 309;$ap=J (ReserveApprove $owner $key $claim) reserve-pre-approve-human
  $race=RaceOrdered (ApproveSql $owner $key $claim $ap.execution_fence) (ExpireSql $source $claim 2 $e.execution_fence) (Block $supplier)
  $expireResult=J $race[1] pre-approve-expire
  Assert ($race[0].ExitCode-eq 0-and$expireResult.outcome_code-eq'already_terminal') 'pre-expiry Approve wins and Expire validates the terminal no-op'
  Assert ((V "select status||'/'||record_version||'/'||(select count(*)from public.supplier_ownerships where supplier_profile_id='$supplier'and ownership_status='active')from public.supplier_ownership_claims where id='$claim';" '^approved/' pre-approve-state)-eq'approved/3/1') 'pre-expiry Approve creates exactly one active ownership'

  $claim=Id 1007;$supplier=Id 207
  Q "update public.supplier_ownership_claims set submitted_at=statement_timestamp()-interval '720 hours'+interval '2 seconds',expires_at=statement_timestamp()+interval '2 seconds',created_at=statement_timestamp()-interval '720 hours'+interval '2 seconds',updated_at=statement_timestamp()where id='$claim';" boundary-fixture|Out-Null
  $source='expire-race-boundary';$e=J (ReserveExpire $source $claim 2) reserve-boundary
  $race=Race (ExpireSql $source $claim 2 $e.execution_fence) 'select 1;' (Block $supplier 3)
  $result=J $race[0] boundary-result
  Assert ($result.outcome_code-eq'expired') 'post-lock trusted time expires a Claim that crosses the boundary while waiting'

  $claim=Id 1008;$supplier=Id 208;$source='expire-race-submit';$e=J (ReserveExpire $source $claim 2) reserve-expire-submit;$key=Key 305;$sr=J (ReserveSubmit (Id 109) $key $supplier) reserve-submit
  $race=Race (ExpireSql $source $claim 2 $e.execution_fence) (SubmitSql (Id 109) $key $supplier $sr.execution_fence) (Block $supplier)
  Assert ($race[0].ExitCode-eq 0-and$race[1].ExitCode-eq 0) 'Expire and independent competing Submit both serialize and complete'
  Assert ((V "select c.status||'/'||(select count(*)from public.supplier_ownership_claims n where n.supplier_profile_id='$supplier'and n.id<>c.id and n.status='submitted')||'/'||(select count(*)from internal.domain_events where aggregate_id=c.id)from public.supplier_ownership_claims c where c.id='$claim';" '^expired/' submit-state)-eq'expired/1/1') 'Expire mutates only its target and leaves the new competing Claim active'

  $counts=V "select (select count(*)from public.supplier_ownership_claims where status='expired')||'/'||(select count(*)from internal.domain_events where event_type='supplier_ownership.claim_expired')||'/'||(select count(*)from internal.audit_logs where action_code='supplier_claim.expire')||'/'||(select count(*)from public.supplier_ownerships);" '^\d+/\d+/\d+/\d+$' totals
  Assert ($counts-eq'8/8/0/1') 'all races preserve expiry event cardinality zero Expire audit and one approved ownership'
  $sw.Stop();Write-Output ("Claim expire concurrency validation passed: {0} checks; twelve true-session races; {1:n1}s elapsed."-f$checks.Count,$sw.Elapsed.TotalSeconds)
}finally{if($started){docker rm -f $name *> $null}}
