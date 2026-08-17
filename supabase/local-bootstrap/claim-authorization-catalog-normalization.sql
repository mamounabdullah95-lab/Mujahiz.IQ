with
relevant_roles(role_name) as (
  values
    ('mujahiz_claim_human_command_owner'::name),
    ('mujahiz_claim_expiry_command_owner'::name),
    ('mujahiz_claim_target_conflict_helper_owner'::name),
    ('mujahiz_claim_reviewer_prior_context_helper_owner'::name)
),
relevant_role_oids as (
  select r.oid, r.rolname
  from pg_catalog.pg_roles r
  join relevant_roles expected on expected.role_name = r.rolname
),
transfer_signatures(signature) as (
  values
    ('supplier_claim.reserve_submit(text,uuid,text,text,jsonb,uuid)'),
    ('supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid,uuid)'),
    ('supplier_claim.reserve_withdraw(text,uuid,integer)'),
    ('supplier_claim.withdraw(text,uuid,integer,uuid,uuid)'),
    ('supplier_claim.reserve_assign_reviewer(text,uuid,integer,uuid)'),
    ('supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)'),
    ('supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)'),
    ('supplier_claim._execute_reject(text,uuid,integer,integer,text,text,text,text,text,uuid,uuid)'),
    ('supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)'),
    ('supplier_claim._execute_approve(text,uuid,integer,integer,text,text,text,text[],text,uuid,uuid)'),
    ('supplier_claim._claim_history_envelope_coherent_v1(uuid)'),
    ('supplier_claim._claim_assignment_history_coherent_v1(uuid,boolean)'),
    ('supplier_claim._withdrawn_history_coherent_v1(uuid)'),
    ('supplier_claim._rejected_history_coherent_v1(uuid)'),
    ('supplier_claim._approval_ownership_history_coherent_v1(uuid)'),
    ('supplier_claim._approval_audit_history_coherent_v1(uuid)'),
    ('supplier_claim._approval_competitor_history_coherent_v1(uuid)'),
    ('supplier_claim._approved_history_coherent_v1(uuid)'),
    ('supplier_claim._expired_history_coherent_v1(uuid)'),
    ('supplier_claim._superseded_history_coherent_v1(uuid)'),
    ('supplier_claim._terminal_history_coherent_v1(uuid)'),
    ('supplier_claim._active_claim_history_coherent_v1(uuid)'),
    ('supplier_claim.expire(text,uuid,integer,uuid)'),
    ('supplier_claim._execute_expire(text,uuid,integer,uuid,uuid)'),
    ('claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'),
    ('claim_security.reviewer_prior_claim_context_v1(uuid,uuid,uuid)')
),
role_inventory as (
  select 'ROLE|' || pg_catalog.jsonb_build_array(
    a.rolname, a.rolsuper, a.rolinherit, a.rolcreaterole, a.rolcreatedb,
    a.rolcanlogin, a.rolreplication, a.rolbypassrls, a.rolconnlimit,
    a.rolvaliduntil is null, a.rolpassword is null
  )::text as catalog_tuple
  from pg_catalog.pg_authid a
  join relevant_roles expected on expected.role_name = a.rolname
),
membership_inventory as (
  select 'MEMBERSHIP|' || pg_catalog.jsonb_build_array(
    role_role.rolname, member_role.rolname, grantor_role.rolname,
    m.admin_option, m.inherit_option, m.set_option
  )::text as catalog_tuple
  from pg_catalog.pg_auth_members m
  join pg_catalog.pg_roles role_role on role_role.oid = m.roleid
  join pg_catalog.pg_roles member_role on member_role.oid = m.member
  join pg_catalog.pg_roles grantor_role on grantor_role.oid = m.grantor
  where m.roleid in (select oid from relevant_role_oids)
     or m.member in (select oid from relevant_role_oids)
     or m.grantor in (select oid from relevant_role_oids)
),
role_setting_inventory as (
  select 'ROLE_SETTING|' || pg_catalog.jsonb_build_array(
    case when s.setdatabase = 0 then '*' else d.datname end,
    r.rolname, setting.setting
  )::text as catalog_tuple
  from pg_catalog.pg_db_role_setting s
  join pg_catalog.pg_roles r on r.oid = s.setrole
  left join pg_catalog.pg_database d on d.oid = s.setdatabase
  cross join lateral pg_catalog.unnest(s.setconfig) setting(setting)
  where s.setrole in (select oid from relevant_role_oids)
),
parameter_acl_inventory as (
  select 'PARAMETER_ACL|' || pg_catalog.jsonb_build_array(
    p.parname,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    grantor.rolname, acl.privilege_type, acl.is_grantable
  )::text as catalog_tuple
  from pg_catalog.pg_parameter_acl p
  cross join lateral pg_catalog.aclexplode(p.paracl) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
  where acl.grantee in (select oid from relevant_role_oids)
     or acl.grantor in (select oid from relevant_role_oids)
),
default_acl_inventory as (
  select 'DEFAULT_ACL|' || pg_catalog.jsonb_build_array(
    owner_role.rolname,
    case when d.defaclnamespace = 0 then null else n.nspname end,
    d.defaclobjtype,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    grantor.rolname, acl.privilege_type, acl.is_grantable
  )::text as catalog_tuple
  from pg_catalog.pg_default_acl d
  join pg_catalog.pg_roles owner_role on owner_role.oid = d.defaclrole
  left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
  where d.defaclrole in (select oid from relevant_role_oids)
     or acl.grantee in (select oid from relevant_role_oids)
     or acl.grantor in (select oid from relevant_role_oids)
),
database_object_inventory as (
  select 'DATABASE_OBJECT|' || pg_catalog.jsonb_build_array(
    case when d.datname = pg_catalog.current_database() then 'TARGET_DATABASE' else d.datname end,
    owner_role.rolname, d.datdba = any(select oid from relevant_role_oids),
    d.datistemplate, d.datallowconn, d.datconnlimit
  )::text as catalog_tuple
  from pg_catalog.pg_database d
  join pg_catalog.pg_roles owner_role on owner_role.oid = d.datdba
  where d.datname = pg_catalog.current_database()
     or d.datdba in (select oid from relevant_role_oids)
     or exists (
       select 1 from pg_catalog.aclexplode(
         coalesce(d.datacl, pg_catalog.acldefault('d', d.datdba))
       ) acl
       where acl.grantee in (select oid from relevant_role_oids)
          or acl.grantor in (select oid from relevant_role_oids)
     )
),
selected_databases as (
  select d.*
  from pg_catalog.pg_database d
  where d.datname = pg_catalog.current_database()
     or d.datdba in (select oid from relevant_role_oids)
     or exists (
       select 1 from pg_catalog.aclexplode(
         coalesce(d.datacl, pg_catalog.acldefault('d', d.datdba))
       ) acl
       where acl.grantee in (select oid from relevant_role_oids)
          or acl.grantor in (select oid from relevant_role_oids)
     )
),
database_acl_inventory as (
  select 'DATABASE_ACL|' || pg_catalog.jsonb_build_array(
    case when d.datname = pg_catalog.current_database() then 'TARGET_DATABASE' else d.datname end,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    grantor.rolname, acl.privilege_type, acl.is_grantable
  )::text as catalog_tuple
  from selected_databases d
  cross join lateral pg_catalog.aclexplode(
    coalesce(d.datacl, pg_catalog.acldefault('d', d.datdba))
  ) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
),
selected_schemas as (
  select n.*
  from pg_catalog.pg_namespace n
  where n.nspname in ('public', 'internal', 'claim_security', 'supplier_claim', 'extensions')
     or n.nspowner in (select oid from relevant_role_oids)
     or exists (
       select 1 from pg_catalog.aclexplode(
         coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
       ) acl
       where acl.grantee in (select oid from relevant_role_oids)
          or acl.grantor in (select oid from relevant_role_oids)
     )
),
schema_object_inventory as (
  select 'SCHEMA_OBJECT|' || pg_catalog.jsonb_build_array(
    n.nspname, owner_role.rolname
  )::text as catalog_tuple
  from selected_schemas n
  join pg_catalog.pg_roles owner_role on owner_role.oid = n.nspowner
),
schema_acl_inventory as (
  select 'SCHEMA_ACL|' || pg_catalog.jsonb_build_array(
    n.nspname,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    grantor.rolname, acl.privilege_type, acl.is_grantable
  )::text as catalog_tuple
  from selected_schemas n
  cross join lateral pg_catalog.aclexplode(
    coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
  ) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
),
selected_relations as (
  select c.*
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    and (
      c.oid = 'public.supplier_ownership_claims'::pg_catalog.regclass
      or c.relowner in (select oid from relevant_role_oids)
      or exists (
        select 1 from pg_catalog.aclexplode(
          coalesce(
            c.relacl,
            pg_catalog.acldefault(case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end, c.relowner)
          )
        ) acl
        where acl.grantee in (select oid from relevant_role_oids)
           or acl.grantor in (select oid from relevant_role_oids)
      )
      or exists (
        select 1
        from pg_catalog.pg_attribute a
        cross join lateral pg_catalog.aclexplode(a.attacl) acl
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          and (acl.grantee in (select oid from relevant_role_oids)
            or acl.grantor in (select oid from relevant_role_oids))
      )
    )
),
relation_object_inventory as (
  select 'RELATION_OBJECT|' || pg_catalog.jsonb_build_array(
    n.nspname || '.' || c.relname, c.relkind::text, owner_role.rolname,
    c.relrowsecurity, c.relforcerowsecurity
  )::text as catalog_tuple
  from selected_relations c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_roles owner_role on owner_role.oid = c.relowner
),
relation_acl_inventory as (
  select 'RELATION_ACL|' || pg_catalog.jsonb_build_array(
    n.nspname || '.' || c.relname,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    grantor.rolname, acl.privilege_type, acl.is_grantable
  )::text as catalog_tuple
  from selected_relations c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      c.relacl,
      pg_catalog.acldefault(case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end, c.relowner)
    )
  ) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
),
column_acl_rows as (
  select n.nspname || '.' || c.relname as relation_name,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee_name,
    grantor.rolname as grantor_name, acl.privilege_type, acl.is_grantable,
    a.attname
  from selected_relations c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid
    and a.attnum > 0 and not a.attisdropped
  cross join lateral pg_catalog.aclexplode(a.attacl) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
),
column_acl_inventory as (
  select 'COLUMN_ACL|' || pg_catalog.jsonb_build_array(
    relation_name, grantee_name, grantor_name, privilege_type, is_grantable,
    pg_catalog.jsonb_agg(attname order by attname)
  )::text as catalog_tuple
  from column_acl_rows
  group by relation_name, grantee_name, grantor_name, privilege_type, is_grantable
),
selected_routines as (
  select p.*
  from pg_catalog.pg_proc p
  where p.oid::pg_catalog.regprocedure::text in (select signature from transfer_signatures)
     or p.proowner in (select oid from relevant_role_oids)
     or exists (
       select 1 from pg_catalog.aclexplode(
         coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
       ) acl
       where acl.grantee in (select oid from relevant_role_oids)
          or acl.grantor in (select oid from relevant_role_oids)
     )
),
routine_object_inventory as (
  select 'ROUTINE_OBJECT|' || pg_catalog.jsonb_build_array(
    p.oid::pg_catalog.regprocedure::text, owner_role.rolname, p.prokind::text,
    p.prosecdef, p.proleakproof, p.provolatile::text, p.proparallel::text,
    p.proconfig, pg_catalog.md5(p.prosrc)
  )::text as catalog_tuple
  from selected_routines p
  join pg_catalog.pg_roles owner_role on owner_role.oid = p.proowner
),
routine_acl_inventory as (
  select 'ROUTINE_ACL|' || pg_catalog.jsonb_build_array(
    p.oid::pg_catalog.regprocedure::text,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    grantor.rolname, acl.privilege_type, acl.is_grantable
  )::text as catalog_tuple
  from selected_routines p
  cross join lateral pg_catalog.aclexplode(
    coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
  ) acl
  left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
),
policy_inventory as (
  select 'POLICY|' || pg_catalog.jsonb_build_array(
    p.polname, p.polcmd::text, p.polpermissive,
    (
      select pg_catalog.jsonb_agg(
        case when role_oid = 0 then 'PUBLIC' else role_name.rolname end
        order by case when role_oid = 0 then 'PUBLIC' else role_name.rolname end
      )
      from pg_catalog.unnest(p.polroles) role_oid
      left join pg_catalog.pg_roles role_name on role_name.oid = role_oid
    ),
    pg_catalog.pg_get_expr(p.polqual, p.polrelid, true),
    pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, true)
  )::text as catalog_tuple
  from pg_catalog.pg_policy p
  where p.polrelid = 'public.supplier_ownership_claims'::pg_catalog.regclass
),
shared_dependency_inventory as (
  select 'SHDEPEND|' || pg_catalog.jsonb_build_array(
    case when d.dbid = 0 then 'SHARED' else 'TARGET_DATABASE' end,
    d.classid::pg_catalog.regclass::text,
    ref_role.rolname,
    d.deptype::text,
    pg_catalog.jsonb_agg(
      pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid)
      order by pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid)
    )
  )::text as catalog_tuple
  from pg_catalog.pg_shdepend d
  join relevant_role_oids ref_role on ref_role.oid = d.refobjid
  where d.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
    and (d.dbid = 0 or d.dbid = (
      select oid from pg_catalog.pg_database where datname = pg_catalog.current_database()
    ))
  group by
    case when d.dbid = 0 then 'SHARED' else 'TARGET_DATABASE' end,
    d.classid,
    ref_role.rolname,
    d.deptype
),
inventory as (
  select catalog_tuple from role_inventory
  union all select catalog_tuple from membership_inventory
  union all select catalog_tuple from role_setting_inventory
  union all select catalog_tuple from parameter_acl_inventory
  union all select catalog_tuple from default_acl_inventory
  union all select catalog_tuple from database_object_inventory
  union all select catalog_tuple from database_acl_inventory
  union all select catalog_tuple from schema_object_inventory
  union all select catalog_tuple from schema_acl_inventory
  union all select catalog_tuple from relation_object_inventory
  union all select catalog_tuple from relation_acl_inventory
  union all select catalog_tuple from column_acl_inventory
  union all select catalog_tuple from routine_object_inventory
  union all select catalog_tuple from routine_acl_inventory
  union all select catalog_tuple from policy_inventory
  union all select catalog_tuple from shared_dependency_inventory
)
select catalog_tuple
from inventory
order by catalog_tuple;
