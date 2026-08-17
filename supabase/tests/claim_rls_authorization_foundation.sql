begin;
create extension if not exists pgtap with schema extensions;
set search_path = pg_catalog, extensions;
select plan(52);

select is((select count(*)::integer from pg_roles where rolname in (
  'mujahiz_claim_human_command_owner','mujahiz_claim_expiry_command_owner',
  'mujahiz_claim_target_conflict_helper_owner','mujahiz_claim_reviewer_prior_context_helper_owner')),4,
  'exactly four B4 owner roles exist');
select is((select count(*)::integer from pg_authid where rolname like 'mujahiz_claim_%_owner'
  and not rolsuper and not rolinherit and not rolcreaterole and not rolcreatedb
  and not rolcanlogin and not rolreplication and not rolbypassrls
  and rolpassword is null and rolvaliduntil is null),4,'all B4 owner roles are inert');
select is((select count(*)::integer from pg_auth_members m join pg_roles r
  on r.oid=m.roleid or r.oid=m.member where r.rolname like 'mujahiz_claim_%_owner'),0,
  'B4 owner roles have zero membership');
select ok(not exists(select 1 from pg_roles actor cross join pg_roles target
  where actor.rolname in ('postgres','mujahiz_claim_runtime','mujahiz_claim_expiry_worker',
    'mujahiz_claim_owner_projection','mujahiz_claim_reviewer_projection','anon','authenticated','service_role')
    and target.rolname like 'mujahiz_claim_%_owner' and pg_has_role(actor.oid,target.oid,'SET')),
  'ordinary actors have no SET ROLE path to a B4 owner');
select is((select count(*)::integer from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
  join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner'),0,'no owner default ACL');
select is((select count(*)::integer from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
  where r.rolname like 'mujahiz_claim_%_owner'),0,'no owner persistent setting');
select is((select count(*)::integer from pg_parameter_acl p cross join lateral aclexplode(p.paracl) a
  join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner'),0,'no owner parameter ACL');
select ok(not exists(select 1 from pg_namespace n where n.nspname !~ '^pg_(temp|toast_temp)_' and exists(
  select 1 from pg_roles r where r.rolname like 'mujahiz_claim_%_owner'
    and has_schema_privilege(r.oid,n.oid,'CREATE'))),'no B4 owner has schema CREATE');
select ok(not exists(select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a
  join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner' and a.is_grantable)
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a
  join pg_roles r on r.oid=a.grantee where r.rolname like 'mujahiz_claim_%_owner' and a.is_grantable),
  'B4 owners have no explicit grant option');
select ok((select relrowsecurity from pg_class where oid='public.supplier_ownership_claims'::regclass),
  'Claim RLS remains enabled');
select ok((select relforcerowsecurity from pg_class where oid='public.supplier_ownership_claims'::regclass),
  'Claim FORCE RLS remains enabled');
select is((select count(*)::integer from pg_policy where polrelid='public.supplier_ownership_claims'::regclass and polcmd='r'),7,'seven SELECT policies');
select is((select count(*)::integer from pg_policy where polrelid='public.supplier_ownership_claims'::regclass and polcmd='a'),1,'one INSERT policy');
select is((select count(*)::integer from pg_policy where polrelid='public.supplier_ownership_claims'::regclass and polcmd='w'),2,'two UPDATE policies');
select is((select count(*)::integer from pg_policy where polrelid='public.supplier_ownership_claims'::regclass and polcmd='d'),0,'zero DELETE policies');
select is((select array_agg(polname||'|'||polcmd::text||'|'||pg_get_userbyid(polroles[1]) order by polname)::text
  from pg_policy where polrelid='public.supplier_ownership_claims'::regclass),
  '{supplier_ownership_claims_assigned_reviewer_select|r|mujahiz_claim_reviewer_projection,supplier_ownership_claims_claimant_self_select|r|mujahiz_claim_runtime,supplier_ownership_claims_expiry_command_select|r|mujahiz_claim_expiry_command_owner,supplier_ownership_claims_expiry_command_update|w|mujahiz_claim_expiry_command_owner,supplier_ownership_claims_human_command_insert|a|mujahiz_claim_human_command_owner,supplier_ownership_claims_human_command_select|r|mujahiz_claim_human_command_owner,supplier_ownership_claims_human_command_update|w|mujahiz_claim_human_command_owner,supplier_ownership_claims_owner_assignment_select|r|mujahiz_claim_owner_projection,supplier_ownership_claims_reviewer_prior_context_helper_select|r|mujahiz_claim_reviewer_prior_context_helper_owner,supplier_ownership_claims_target_conflict_helper_select|r|mujahiz_claim_target_conflict_helper_owner}',
  'exact Claim policy names, commands, and targets');
select ok(not exists(select 1 from pg_policy p join pg_roles r on r.oid=any(p.polroles)
  where p.polrelid='public.supplier_ownership_claims'::regclass and p.polcmd in ('a','w','d')
    and r.rolname not in ('mujahiz_claim_human_command_owner','mujahiz_claim_expiry_command_owner')),
  'no application mutation policy');
select ok((select prosrc !~* '%rowtype' from pg_proc where oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure),'target helper has no rowtype');
select ok((select prosrc !~* 'select\s+claim\.\*' from pg_proc where oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure),'target helper has no claim wildcard');
select ok((select prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog']
  from pg_proc where oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure),
  'target helper retains VOLATILE SECURITY DEFINER fixed path');
select ok((select prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog']
  from pg_proc where oid='claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure),
  'prior-context helper retains STABLE SECURITY DEFINER fixed path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure),'mujahiz_claim_target_conflict_helper_owner','target helper owner exact');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure),'mujahiz_claim_reviewer_prior_context_helper_owner','prior helper owner exact');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.prosecdef and pg_get_userbyid(p.proowner)='mujahiz_claim_human_command_owner'),10,'ten human definers');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.prosecdef and pg_get_userbyid(p.proowner)='mujahiz_claim_expiry_command_owner'),14,'fourteen expiry definers');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='supplier_claim' and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'),0,'no Claim definer remains postgres-owned');

select is((select array_agg(g.rolname||'|'||o.rolname||'|'||a.is_grantable order by g.rolname)::text
  from pg_proc p cross join lateral aclexplode(p.proacl) a join pg_roles g on g.oid=a.grantee
  join pg_roles o on o.oid=a.grantor where p.oid='claim_security.current_privileged_actor_v1()'::regprocedure),
  '{mujahiz_claim_human_command_owner|mujahiz_claim_owner_projection|false,mujahiz_claim_owner_projection|mujahiz_claim_owner_projection|false,mujahiz_claim_reviewer_projection|mujahiz_claim_owner_projection|false,mujahiz_claim_runtime|mujahiz_claim_owner_projection|false}',
  'current privileged actor ACL exact');
select is((select array_agg(g.rolname||'|'||o.rolname||'|'||a.is_grantable order by g.rolname)::text
  from pg_proc p cross join lateral aclexplode(p.proacl) a join pg_roles g on g.oid=a.grantee
  join pg_roles o on o.oid=a.grantor where p.oid='claim_security.privileged_actor_for_profile_v1(uuid)'::regprocedure),
  '{mujahiz_claim_human_command_owner|mujahiz_claim_owner_projection|false,mujahiz_claim_owner_projection|mujahiz_claim_owner_projection|false}',
  'profile privileged actor ACL exact');
select ok(has_function_privilege('mujahiz_claim_human_command_owner','claim_security.current_privileged_actor_v1()','EXECUTE')
  and has_function_privilege('mujahiz_claim_human_command_owner','claim_security.privileged_actor_for_profile_v1(uuid)','EXECUTE'),
  'human owner executes both projection helpers');
select ok(not has_function_privilege('postgres','claim_security.current_privileged_actor_v1()','EXECUTE')
  and not has_function_privilege('postgres','claim_security.privileged_actor_for_profile_v1(uuid)','EXECUTE'),
  'postgres helper execution removed');
select ok(not exists(select 1 from unnest(array['PUBLIC','anon','authenticated','service_role','mujahiz_claim_expiry_worker',
  'mujahiz_claim_expiry_command_owner','mujahiz_claim_target_conflict_helper_owner','mujahiz_claim_reviewer_prior_context_helper_owner']) r
  where (r='PUBLIC' and has_function_privilege('public','claim_security.current_privileged_actor_v1()','EXECUTE'))
     or (r<>'PUBLIC' and has_function_privilege(r,'claim_security.current_privileged_actor_v1()','EXECUTE'))),
  'unrelated roles cannot execute privileged helper');

select is((select array_agg(attname order by attnum)::text from pg_attribute c where c.attrelid='public.supplier_ownership_claims'::regclass
  and c.attnum>0 and not c.attisdropped and has_column_privilege('mujahiz_claim_target_conflict_helper_owner',c.attrelid,c.attnum,'SELECT')),
  '{id,claimant_user_profile_id,supplier_profile_id,status,submitted_at,expires_at,reviewer_user_profile_id,reviewer_assignment_version,reviewer_assigned_at,reviewer_assigned_by_user_profile_id,reviewer_assignment_source_code,reviewer_assignment_policy_version,decided_at,withdrawn_at,expired_at,superseded_at,resulting_supplier_ownership_id,created_at,updated_at}',
  'target owner has exactly 19 Claim columns');
select is((select array_agg(attname order by attnum)::text from pg_attribute c where c.attrelid='public.supplier_ownerships'::regclass
  and c.attnum>0 and not c.attisdropped and has_column_privilege('mujahiz_claim_target_conflict_helper_owner',c.attrelid,c.attnum,'SELECT')),
  '{id,supplier_profile_id,controller_user_profile_id,authority_type,ownership_status,valid_from,valid_until,establishment_source_type,closure_reason_code,closed_by_user_profile_id,closure_system_source,closed_at,transfer_successor_ownership_id,created_at,updated_at}',
  'target owner has exactly 15 ownership columns');
select ok((select array_agg(n.nspname||'.'||c.relname||'.'||a.attname order by n.nspname,c.relname)::text
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where a.attnum>0 and not a.attisdropped and c.relname in ('user_profiles','supplier_profiles')
    and has_column_privilege('mujahiz_claim_target_conflict_helper_owner',a.attrelid,a.attnum,'SELECT'))
  = '{public.supplier_profiles.id,public.user_profiles.id}','target owner has only two identity id columns');
select is((select array_agg(attname order by attnum)::text from pg_attribute c where c.attrelid='public.supplier_ownership_claims'::regclass
  and c.attnum>0 and not c.attisdropped and has_column_privilege('mujahiz_claim_reviewer_prior_context_helper_owner',c.attrelid,c.attnum,'SELECT')),
  '{id,claimant_user_profile_id,supplier_profile_id,status,decided_at,decision_reason_code}',
  'prior-context owner has exactly six Claim columns');
select ok(not has_any_column_privilege('mujahiz_claim_target_conflict_helper_owner','public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES')
  and not has_any_column_privilege('mujahiz_claim_reviewer_prior_context_helper_owner','public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES'),
  'read-only helper owners have no mutation');
select ok(not has_any_column_privilege('mujahiz_claim_runtime','public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES'),
  'runtime has no direct Claim mutation');
select ok(not has_any_column_privilege('mujahiz_claim_expiry_worker','public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES'),
  'expiry worker has no direct Claim mutation');
select ok(not has_any_column_privilege('mujahiz_claim_owner_projection','public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES')
  and not has_any_column_privilege('mujahiz_claim_reviewer_projection','public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES'),
  'projection roles have no direct Claim mutation');
select ok(not exists(select 1 from unnest(array['anon','authenticated','service_role']) r
  where has_any_column_privilege(r,'public.supplier_ownership_claims','INSERT,UPDATE,REFERENCES')),
  'browser and service roles have no direct Claim mutation');
select ok(not exists(select 1 from pg_roles r where r.rolname like 'mujahiz_claim_%'
  and has_table_privilege(r.oid,'public.supplier_ownership_claims','DELETE,TRUNCATE')),'no Claim DELETE or TRUNCATE grant');

select is((select array_agg(g.rolname order by g.rolname)::text from pg_proc p
  cross join lateral aclexplode(p.proacl) a join pg_roles g on g.oid=a.grantee
  where p.oid='claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure),
  '{mujahiz_claim_human_command_owner,mujahiz_claim_owner_projection,mujahiz_claim_reviewer_projection,mujahiz_claim_target_conflict_helper_owner}',
  'target helper caller ACL exact');
select is((select array_agg(g.rolname order by g.rolname)::text from pg_proc p
  cross join lateral aclexplode(p.proacl) a join pg_roles g on g.oid=a.grantee
  where p.oid='claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)'::regprocedure),
  '{mujahiz_claim_reviewer_prior_context_helper_owner,mujahiz_claim_reviewer_projection}',
  'prior helper caller ACL exact');
select ok(has_schema_privilege('mujahiz_claim_human_command_owner','claim_security','USAGE')
  and not has_schema_privilege('mujahiz_claim_human_command_owner','claim_security','CREATE'),
  'human owner has claim_security USAGE only');
select ok(not has_function_privilege('mujahiz_claim_expiry_command_owner','claim_security.current_privileged_actor_v1()','EXECUTE')
  and not has_function_privilege('mujahiz_claim_expiry_command_owner','claim_security.privileged_actor_for_profile_v1(uuid)','EXECUTE'),
  'expiry owner has no human privileged-actor helper');
select ok((select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
  from pg_proc p cross join lateral aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee
  where r.rolname='mujahiz_claim_expiry_worker' and a.privilege_type='EXECUTE'
    and p.pronamespace='supplier_claim'::regnamespace) = array[
      'supplier_claim._execute_expire(text,uuid,integer,uuid,uuid)',
      'supplier_claim.expire(text,uuid,integer,uuid)'
    ],
  'expiry worker callable surface exact');
select ok(not has_function_privilege('mujahiz_claim_runtime','supplier_claim.expire(text,uuid,integer,uuid)','EXECUTE')
  and not has_function_privilege('mujahiz_claim_runtime','supplier_claim._execute_expire(text,uuid,integer,uuid,uuid)','EXECUTE'),
  'human runtime cannot execute Expire');
select ok(has_function_privilege('mujahiz_claim_human_command_owner','supplier_claim._canonicalize_submit_request_v1(text,uuid,text,text,jsonb,uuid)','EXECUTE')
  and has_function_privilege('mujahiz_claim_human_command_owner','supplier_claim._canonicalize_approve_request_v1(text,uuid,integer,integer,text,text,text,text[],text)','EXECUTE'),
  'human owner has required canonicalizer execution');
select ok(has_function_privilege('mujahiz_claim_expiry_command_owner','supplier_claim._assert_expiry_worker_context_v1()','EXECUTE')
  and has_function_privilege('mujahiz_claim_expiry_command_owner','supplier_claim._canonicalize_expire_request_v1(text,uuid,integer,timestamptz)','EXECUTE'),
  'expiry owner has only expiry plumbing execution');
select ok(not exists(select 1 from pg_class c join pg_roles r on r.oid=c.relowner where r.rolname like 'mujahiz_claim_%_owner')
  and not exists(select 1 from pg_namespace n join pg_roles r on r.oid=n.nspowner where r.rolname like 'mujahiz_claim_%_owner'),
  'B4 owners own no relation or schema');
select ok(not exists(select 1 from pg_shdepend d join pg_roles r on r.oid=d.refobjid
  where d.refclassid='pg_authid'::regclass and r.rolname like 'mujahiz_claim_%_owner'
    and not ((d.classid='pg_class'::regclass and d.deptype='a')
      or (d.classid='pg_namespace'::regclass and d.deptype='a')
      or (d.classid='pg_policy'::regclass and d.deptype='r')
      or (d.classid='pg_proc'::regclass and d.deptype in ('a','o')))),
  'pg_shdepend contains only approved dependency classes');
select ok(not exists(select 1 from pg_shdepend d join pg_roles r on r.oid=d.refobjid
  where d.refclassid='pg_authid'::regclass and r.rolname like 'mujahiz_claim_%_owner' and d.dbid=0),
  'B4 owner dependencies are database-local only');

select * from finish();
rollback;
