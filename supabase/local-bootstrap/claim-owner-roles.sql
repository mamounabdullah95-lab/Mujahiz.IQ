-- Local disposable PostgreSQL bootstrap only. This is not a migration.
-- The runner opens and commits the transaction around this fixed asset.

create or replace function pg_temp.assert_claim_owner_roles(allow_missing boolean)
returns void
language plpgsql
set search_path = pg_catalog
as $function$
declare
  expected_roles constant name[] := array[
    'mujahiz_claim_human_command_owner',
    'mujahiz_claim_expiry_command_owner',
    'mujahiz_claim_target_conflict_helper_owner',
    'mujahiz_claim_reviewer_prior_context_helper_owner'
  ]::name[];
  target_role record;
begin
  if current_user <> 'supabase_admin'
     or not coalesce((select r.rolsuper from pg_catalog.pg_roles r where r.rolname = current_user), false)
     or current_database() <> 'postgres'
     or pg_catalog.inet_server_addr() is not null
     or pg_catalog.inet_server_port() is not null
     or pg_catalog.current_setting('port') <> '5432'
     or pg_catalog.current_setting('unix_socket_directories') <> '/var/run/postgresql' then
    raise exception using
      errcode = '42501',
      message = 'claim owner-role provisioning requires the fixed pinned-image local endpoint and bootstrap actor';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_roles r
    where r.rolname ~ '^mujahiz_claim_.+_owner.*$'
      and r.rolname <> all(expected_roles)
  ) then
    raise exception using errcode = 'P0001', message = 'unexpected similarly prefixed Claim owner role';
  end if;

  if not allow_missing and (
    select count(*) from pg_catalog.pg_roles r where r.rolname = any(expected_roles)
  ) <> cardinality(expected_roles) then
    raise exception using errcode = 'P0001', message = 'the complete Claim owner-role namespace is required';
  end if;

  for target_role in
    select a.oid, a.rolname from pg_catalog.pg_authid a where a.rolname = any(expected_roles)
  loop
    if exists (
      select 1
      from pg_catalog.pg_authid a
      where a.oid = target_role.oid
        and (
          a.rolsuper or a.rolinherit or a.rolcreaterole or a.rolcreatedb
          or a.rolcanlogin or a.rolreplication or a.rolbypassrls
          or a.rolconnlimit <> -1 or a.rolpassword is not null or a.rolvaliduntil is not null
        )
    ) then
      raise exception using errcode = 'P0001', message = 'unsafe pre-existing Claim owner role definition';
    end if;

    if exists (
      select 1 from pg_catalog.pg_auth_members m
      where m.roleid = target_role.oid or m.member = target_role.oid
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has membership residue';
    end if;

    if exists (
      select 1 from pg_catalog.pg_roles actor
      where not actor.rolsuper and actor.oid <> target_role.oid
        and pg_catalog.pg_has_role(actor.oid, target_role.oid, 'SET')
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has an ordinary SET ROLE path';
    end if;

    if exists (
      select 1 from pg_catalog.pg_shdepend d
      where d.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass and d.refobjid = target_role.oid
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has shared dependency residue';
    end if;

    if exists (
      select 1 from pg_catalog.pg_db_role_setting s where s.setrole = target_role.oid
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has persistent setting residue';
    end if;

    if exists (
      select 1 from pg_catalog.pg_parameter_acl p
      cross join lateral pg_catalog.aclexplode(p.paracl) acl where acl.grantee = target_role.oid
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has parameter ACL residue';
    end if;

    if exists (select 1 from pg_catalog.pg_database d where d.datdba = target_role.oid)
       or exists (select 1 from pg_catalog.pg_namespace n where n.nspowner = target_role.oid)
       or exists (select 1 from pg_catalog.pg_class c where c.relowner = target_role.oid)
       or exists (select 1 from pg_catalog.pg_proc p where p.proowner = target_role.oid)
       or exists (select 1 from pg_catalog.pg_extension e where e.extowner = target_role.oid)
       or exists (select 1 from pg_catalog.pg_largeobject_metadata l where l.lomowner = target_role.oid) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has object ownership residue';
    end if;

    if exists (
      select 1 from pg_catalog.pg_database d cross join lateral pg_catalog.aclexplode(d.datacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_namespace n cross join lateral pg_catalog.aclexplode(n.nspacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(c.relacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_attribute a cross join lateral pg_catalog.aclexplode(a.attacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_largeobject_metadata l cross join lateral pg_catalog.aclexplode(l.lomacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_default_acl d cross join lateral pg_catalog.aclexplode(d.defaclacl) acl where acl.grantee = target_role.oid
    ) or exists (
      select 1 from pg_catalog.pg_init_privs i cross join lateral pg_catalog.aclexplode(i.initprivs) acl where acl.grantee = target_role.oid
    ) then
      raise exception using errcode = 'P0001',
        message = 'Claim owner role has ACL, default-ACL, grant-option, or initial-ACL residue';
    end if;

    if exists (select 1 from pg_catalog.pg_policy p where target_role.oid = any(p.polroles)) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has policy-target residue';
    end if;

    if exists (
      select 1 from pg_catalog.pg_namespace n
      where n.nspname !~ '^pg_(temp|toast_temp)_'
        and pg_catalog.has_schema_privilege(target_role.oid, n.oid, 'CREATE')
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has schema CREATE';
    end if;

    if exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'internal', 'claim_security', 'supplier_claim', 'claim_api')
        and case when c.relkind in ('r', 'p', 'v', 'm', 'f') then
          (
            pg_catalog.has_table_privilege(target_role.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or pg_catalog.has_any_column_privilege(target_role.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
          )
        else false end
    ) or exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'internal', 'claim_security', 'supplier_claim', 'claim_api')
        and case when c.relkind = 'S' then
          pg_catalog.has_sequence_privilege(target_role.oid, c.oid, 'USAGE,SELECT,UPDATE')
        else false end
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has protected relation or sequence privilege';
    end if;

    if exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'internal', 'claim_security', 'supplier_claim', 'claim_api')
        and pg_catalog.has_function_privilege(target_role.oid, p.oid, 'EXECUTE')
    ) then
      raise exception using errcode = 'P0001', message = 'Claim owner role has an application-facing callable surface';
    end if;
  end loop;
end
$function$;

select pg_temp.assert_claim_owner_roles(true);

do $block$
begin
  if pg_catalog.current_setting('mujahiz.claim_owner_role_failure_point', true) = 'before_create' then
    raise exception 'injected failure before Claim owner-role creation';
  end if;
end
$block$;

do $block$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'mujahiz_claim_human_command_owner') then
    execute 'create role mujahiz_claim_human_command_owner with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
  if pg_catalog.current_setting('mujahiz.claim_owner_role_failure_point', true) = 'after_role_1' then
    raise exception 'injected failure after Claim owner-role creation point 1';
  end if;
end
$block$;

do $block$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'mujahiz_claim_expiry_command_owner') then
    execute 'create role mujahiz_claim_expiry_command_owner with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
  if pg_catalog.current_setting('mujahiz.claim_owner_role_failure_point', true) = 'after_role_2' then
    raise exception 'injected failure after Claim owner-role creation point 2';
  end if;
end
$block$;

do $block$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'mujahiz_claim_target_conflict_helper_owner') then
    execute 'create role mujahiz_claim_target_conflict_helper_owner with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
  if pg_catalog.current_setting('mujahiz.claim_owner_role_failure_point', true) = 'after_role_3' then
    raise exception 'injected failure after Claim owner-role creation point 3';
  end if;
end
$block$;

do $block$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'mujahiz_claim_reviewer_prior_context_helper_owner') then
    execute 'create role mujahiz_claim_reviewer_prior_context_helper_owner with nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null';
  end if;
  if pg_catalog.current_setting('mujahiz.claim_owner_role_failure_point', true) = 'after_role_4' then
    raise exception 'injected failure after Claim owner-role creation point 4';
  end if;
end
$block$;

select pg_temp.assert_claim_owner_roles(false);

do $block$
begin
  if pg_catalog.current_setting('mujahiz.claim_owner_role_failure_point', true) = 'final_assertion' then
    raise exception 'injected final Claim owner-role assertion failure';
  end if;
end
$block$;

drop function pg_temp.assert_claim_owner_roles(boolean);
