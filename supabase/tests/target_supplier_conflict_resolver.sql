\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, internal, extensions, pg_catalog;

select no_plan();

select has_function(
  'claim_security',
  'target_supplier_conflict_v1',
  array['uuid', 'uuid', 'uuid'],
  'private target-Supplier conflict resolver exists with the exact UUID inputs'
);
select is((select pg_catalog.pg_get_function_result(p.oid)
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'text', 'resolver returns one bounded text decision');
select is((select pg_catalog.array_to_string(p.proargnames, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'actor_user_profile_id,target_supplier_profile_id,target_claim_id',
  'resolver accepts only actor, target Supplier, and target Claim identifiers');
select is((select p.provolatile::text from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'v', 'resolver is VOLATILE for its trusted clock observation');
select ok((select p.prosecdef from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'resolver is SECURITY DEFINER');
select is((select r.rolname from pg_catalog.pg_proc as p
  join pg_catalog.pg_roles as r on r.oid = p.proowner
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'postgres', 'resolver has the explicit local postgres owner');
select is((select pg_catalog.array_to_string(p.proconfig, ',')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'search_path=pg_catalog', 'resolver fixes search_path to pg_catalog');
select is((select pg_catalog.regexp_count(
    pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)), 'clock_timestamp\(\)')
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 1, 'resolver captures clock_timestamp exactly once');
select ok((select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) !~ E'\\mexecute\\M'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'resolver contains no dynamic SQL');
select ok((select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) !~
    E'\\m(insert|update|delete|merge|truncate)\\M'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'resolver body is read-only');
select ok((select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) !~
    'normalized_email|display_email|phone_number|provider_subject|legacy_organization'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'resolver source contains no PII or legacy-relationship inference');
select ok((select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) !~
    'supplier_contacts|identity_provider_links|platform_role_assignments|access_grants'
  from pg_catalog.pg_proc as p
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 'contacts, provider data, account authority, and role alone are not conflict evidence');
select ok(pg_catalog.obj_description(
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure,
  'pg_proc') ilike '%private read-only local%',
  'function comment preserves the private local-only boundary');
select is((select pg_catalog.string_agg(grantee_role.rolname, ',' order by grantee_role.rolname)
  from pg_catalog.pg_proc as p
  cross join lateral pg_catalog.aclexplode(p.proacl) as acl
  join pg_catalog.pg_roles as grantee_role on grantee_role.oid = acl.grantee
  where p.oid = 'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
    and acl.privilege_type = 'EXECUTE' and acl.grantee <> p.proowner
), null::text, 'no non-owner role can execute the arbitrary-actor helper');
select ok(not has_function_privilege('public',
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'PUBLIC cannot execute the arbitrary-actor helper');
select ok(not has_function_privilege('anon',
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'anon cannot execute the arbitrary-actor helper');
select ok(not has_function_privilege('authenticated',
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'authenticated cannot execute the arbitrary-actor helper');
select ok(not has_function_privilege('service_role',
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'service_role cannot execute the arbitrary-actor helper');
select ok(not has_function_privilege('mujahiz_claim_runtime',
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'Claim runtime cannot execute the arbitrary-actor helper');
select ok(not exists (
  select 1
  from (values ('public.user_profiles'), ('public.supplier_profiles'),
    ('public.supplier_ownerships'), ('public.supplier_ownership_claims'))
    as protected(table_name)
  cross join lateral (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'))
    as privilege(privilege_name)
  where pg_catalog.has_table_privilege('mujahiz_claim_runtime',
    protected.table_name, privilege.privilege_name)
), 'runtime has no direct privilege on any resolver source table');
select is((select pg_catalog.count(*) from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname in ('public', 'internal') and c.relkind in ('r', 'p')
), 24::bigint, 'resolver adds no physical table');
select is((select pg_catalog.count(*) from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'claim_security' and c.relkind in ('r', 'p', 'v', 'm', 'f')
), 0::bigint, 'resolver adds no table or view in claim_security');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy), 1::bigint,
  'resolver adds no RLS policy');
select is((select pg_catalog.count(*) from pg_catalog.pg_policy where polcmd <> 'r'),
  0::bigint, 'resolver adds no mutation policy');
select is((select pg_catalog.count(*) from pg_catalog.pg_trigger
  where not tgisinternal and tgfoid =
    'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)'::regprocedure
), 0::bigint, 'resolver adds no trigger');
select ok(pg_catalog.to_regprocedure('claim_security.target_supplier_conflict_v1(uuid,uuid)') is null,
  'no Supplier-only overload can omit the target Claim');
select ok(pg_catalog.to_regprocedure('claim_security.current_target_supplier_conflict_v1(uuid,uuid)') is null,
  'no current-principal relationship-oracle wrapper is added');
select ok(not exists (select 1 from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'supplier_claim' and p.proname = 'assign_reviewer'),
  'resolver slice does not implement assign_reviewer');

create function pg_temp.conflict_id(p_number integer)
returns uuid language sql immutable set search_path = pg_catalog
as $function$
  select ('10000000-0000-4000-8000-' ||
    pg_catalog.lpad(pg_catalog.to_hex(p_number), 12, '0'))::uuid
$function$;

create function pg_temp.seed_conflict_actor(p_number integer)
returns uuid language plpgsql volatile set search_path = pg_catalog
as $function$
declare actor_id uuid := pg_temp.conflict_id(p_number);
begin
  insert into public.user_profiles (
    id, full_name, account_context, normalized_email, legacy_role, legacy_organization
  ) values (
    actor_id, 'Synthetic conflict actor ' || p_number::text, 'buyer',
    'actor' || p_number::text || '@shared.example.invalid',
    'owner', 'Shared Synthetic Organization'
  );
  return actor_id;
end
$function$;

create function pg_temp.seed_conflict_supplier(p_number integer)
returns uuid language plpgsql volatile set search_path = pg_catalog
as $function$
declare supplier_id uuid := pg_temp.conflict_id(p_number);
begin
  insert into public.supplier_profiles (
    id, name_original, display_name, name_language, name_en,
    business_type, source_type, confidence_level, has_direct_experience
  ) values (
    supplier_id, 'Shared Synthetic Organization', 'Shared Synthetic Organization',
    'english', 'Shared Synthetic Organization', 'company', 'other', 'low', 'no'
  );
  return supplier_id;
end
$function$;

create function pg_temp.seed_submitted_claim(
  p_claim integer, p_claimant integer, p_supplier integer
)
returns uuid language plpgsql volatile set search_path = pg_catalog
as $function$
declare claim_id uuid := pg_temp.conflict_id(p_claim);
begin
  insert into public.supplier_ownership_claims (
    id, claimant_user_profile_id, supplier_profile_id, submitted_at, expires_at,
    submitted_reason, claimant_snapshot_schema_version, claimant_snapshot,
    submission_fingerprint_version, submission_fingerprint,
    evidence_schema_version, evidence_descriptors
  ) values (
    claim_id, pg_temp.conflict_id(p_claimant), pg_temp.conflict_id(p_supplier),
    pg_catalog.statement_timestamp() - interval '1 hour',
    pg_catalog.statement_timestamp() + interval '30 days',
    'synthetic conflict resolver claim', 'claimant_snapshot_v1', '{}'::jsonb,
    'claim_submission_v1', 'fingerprint-' || p_claim::text,
    'claim_evidence_v1', '[]'::jsonb
  );
  return claim_id;
end
$function$;

create function pg_temp.seed_under_review_claim(
  p_claim integer, p_claimant integer, p_supplier integer,
  p_reviewer integer, p_assigner integer,
  p_assignment_version integer default 1,
  p_assignment_policy text default 'claim_reviewer_assignment_v1'
)
returns uuid language plpgsql volatile set search_path = pg_catalog
as $function$
declare claim_id uuid := pg_temp.conflict_id(p_claim);
begin
  insert into public.supplier_ownership_claims (
    id, claimant_user_profile_id, supplier_profile_id, status,
    submitted_at, expires_at, submitted_reason,
    claimant_snapshot_schema_version, claimant_snapshot,
    submission_fingerprint_version, submission_fingerprint,
    evidence_schema_version, evidence_descriptors,
    reviewer_user_profile_id, reviewer_assignment_version,
    reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
    reviewer_assignment_source_code, reviewer_assignment_policy_version
  ) values (
    claim_id, pg_temp.conflict_id(p_claimant), pg_temp.conflict_id(p_supplier),
    'under_review', pg_catalog.statement_timestamp() - interval '2 hours',
    pg_catalog.statement_timestamp() + interval '30 days',
    'synthetic conflict resolver reviewed claim', 'claimant_snapshot_v1',
    '{}'::jsonb, 'claim_submission_v1', 'fingerprint-' || p_claim::text,
    'claim_evidence_v1', '[]'::jsonb,
    pg_temp.conflict_id(p_reviewer), p_assignment_version,
    pg_catalog.statement_timestamp() - interval '1 hour',
    pg_temp.conflict_id(p_assigner), 'owner_assignment', p_assignment_policy
  );
  return claim_id;
end
$function$;

select pg_temp.seed_conflict_actor(actor_number)
from pg_catalog.generate_series(1, 10) as actors(actor_number);
select pg_temp.seed_conflict_supplier(supplier_number)
from pg_catalog.generate_series(101, 120) as suppliers(supplier_number);

select pg_temp.seed_submitted_claim(1001, 2, 101);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'clear', 'complete supported local subset with no actor conflict is clear');
select is(claim_security.target_supplier_conflict_v1(
  null, pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'unknown', 'null actor is unknown');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), null, pg_temp.conflict_id(1001)
), 'unknown', 'null target Supplier is unknown');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), null
), 'unknown', 'null target Claim is unknown');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(999), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'unknown', 'missing actor profile is unknown');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(999), pg_temp.conflict_id(1001)
), 'unknown', 'missing target Supplier is unknown');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(999)
), 'unknown', 'missing target Claim is unknown');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(102), pg_temp.conflict_id(1001)
), 'unknown', 'Claim-to-Supplier substitution or binding mismatch is unknown');

update public.user_profiles set account_context = 'supplier',
  legacy_account_type = 'admin', job_title = 'Target Supplier Administrator'
where id = pg_temp.conflict_id(1);
update public.supplier_profiles set created_by_user_profile_id = pg_temp.conflict_id(1),
  updated_by_user_profile_id = pg_temp.conflict_id(1)
where id = pg_temp.conflict_id(101);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'clear', 'email/domain, legacy organization, account context, role text, names, and creator/updater provenance are non-evidence');

insert into internal.identity_provider_links (
  user_profile_id, provider_code, provider_subject, is_primary, link_status,
  identity_status, verification_status, provider_state_observed_at
) values (
  pg_temp.conflict_id(1), 'firebase', 'synthetic-provider-subject', true,
  'linked', 'active', 'unknown', pg_catalog.statement_timestamp()
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'clear', 'provider data alone is not target-Supplier conflict evidence');

insert into public.supplier_contacts (
  id, supplier_profile_id, channel_type, endpoint_display_value,
  normalized_endpoint, normalizer_version, subject_kind, source_type,
  source_namespace, source_field
) values (
  pg_temp.conflict_id(3001), pg_temp.conflict_id(101), 'email',
  'actor1@shared.example.invalid', 'actor1@shared.example.invalid',
  'contact_normalizer_v1', 'company', 'manual_curation',
  'conflict_resolver_test', 'synthetic_contact'
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'clear', 'matching Supplier contact endpoint is not relationship evidence');

select pg_temp.seed_submitted_claim(1002, 2, 102);
update public.supplier_ownership_claims set status = 'withdrawn',
  withdrawn_at = pg_catalog.statement_timestamp(),
  withdrawn_by_user_profile_id = pg_temp.conflict_id(2),
  withdrawal_reason_code = 'synthetic_withdrawal'
where id = pg_temp.conflict_id(1002);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(102), pg_temp.conflict_id(1002)
), 'unknown', 'terminal target Claim is outside the v1 Reviewer resolver boundary');

select pg_temp.seed_submitted_claim(1003, 2, 103);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(2), pg_temp.conflict_id(103), pg_temp.conflict_id(1003)
), 'conflict', 'target Claim claimant conflict remains explicit');

select pg_temp.seed_submitted_claim(1004, 2, 104);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, valid_from,
  establishment_source_type, establishment_reason_code, establishment_system_source
) values (
  pg_temp.conflict_id(2004), pg_temp.conflict_id(104), pg_temp.conflict_id(3),
  pg_catalog.statement_timestamp() - interval '1 day', 'legacy_reconciliation',
  'synthetic_current_controller', 'conflict_resolver_test'
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(104), pg_temp.conflict_id(1004)
), 'conflict', 'exact effective current primary controller conflicts');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(104), pg_temp.conflict_id(1004)
), 'clear', 'another user current controller row does not conflict with actor');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'clear', 'actor ownership on Supplier A does not conflict on Supplier B');

select pg_temp.seed_submitted_claim(1005, 2, 105);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, valid_from,
  establishment_source_type, establishment_reason_code, establishment_system_source
) values (
  pg_temp.conflict_id(2005), pg_temp.conflict_id(105), pg_temp.conflict_id(3),
  pg_catalog.statement_timestamp() + interval '1 day', 'legacy_reconciliation',
  'synthetic_future_controller', 'conflict_resolver_test'
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(105), pg_temp.conflict_id(1005)
), 'clear', 'future active controller is not yet a current conflict');

select pg_temp.seed_submitted_claim(1006, 2, 106);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, ownership_status,
  valid_from, valid_until, establishment_source_type, establishment_reason_code,
  establishment_system_source, closure_reason_code, closure_system_source, closed_at
) values (
  pg_temp.conflict_id(2006), pg_temp.conflict_id(106), pg_temp.conflict_id(3),
  'revoked', pg_catalog.statement_timestamp() - interval '2 days',
  pg_catalog.clock_timestamp(), 'legacy_reconciliation',
  'synthetic_historical_controller', 'conflict_resolver_test',
  'synthetic_revocation', 'conflict_resolver_test', pg_catalog.statement_timestamp()
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(106), pg_temp.conflict_id(1006)
), 'clear', 'revoked ownership at or after its exclusive valid_until boundary is historical');

select pg_temp.seed_submitted_claim(1007, 2, 107);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, ownership_status,
  valid_from, valid_until, establishment_source_type, establishment_reason_code,
  establishment_system_source, closure_reason_code, closure_system_source, closed_at
) values (
  pg_temp.conflict_id(2007), pg_temp.conflict_id(107), pg_temp.conflict_id(3),
  'superseded', pg_catalog.statement_timestamp() - interval '4 days',
  pg_catalog.statement_timestamp() - interval '3 days', 'legacy_reconciliation',
  'synthetic_superseded_controller', 'conflict_resolver_test',
  'synthetic_correction', 'conflict_resolver_test',
  pg_catalog.statement_timestamp() - interval '3 days'
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(107), pg_temp.conflict_id(1007)
), 'clear', 'superseded ownership history is not a current conflict');

select pg_temp.seed_submitted_claim(1008, 2, 108);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, valid_from,
  establishment_source_type, establishment_reason_code, establishment_system_source
) values (
  pg_temp.conflict_id(2108), pg_temp.conflict_id(108), pg_temp.conflict_id(3),
  pg_catalog.statement_timestamp() + interval '2 days', 'ownership_transfer',
  'synthetic_transfer_successor', 'conflict_resolver_test'
);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, ownership_status,
  valid_from, valid_until, establishment_source_type, establishment_reason_code,
  establishment_system_source, closure_reason_code, closure_system_source,
  closed_at, transfer_successor_ownership_id
) values (
  pg_temp.conflict_id(2008), pg_temp.conflict_id(108), pg_temp.conflict_id(3),
  'transferred', pg_catalog.statement_timestamp() - interval '2 days',
  (select valid_from from public.supplier_ownerships where id = pg_temp.conflict_id(2108)),
  'legacy_reconciliation', 'synthetic_transferred_controller',
  'conflict_resolver_test', 'synthetic_transfer', 'conflict_resolver_test',
  pg_catalog.statement_timestamp(), pg_temp.conflict_id(2108)
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(108), pg_temp.conflict_id(1008)
), 'clear', 'transferred history and a future successor are not current conflict');

select pg_temp.seed_submitted_claim(1009, 2, 109);
select pg_temp.seed_submitted_claim(1010, 4, 109);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(109), pg_temp.conflict_id(1009)
), 'conflict', 'another submitted same-Supplier Claim by actor conflicts');

select pg_temp.seed_submitted_claim(1011, 2, 110);
select pg_temp.seed_under_review_claim(1012, 4, 110, 6, 7);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(110), pg_temp.conflict_id(1011)
), 'conflict', 'another under-review same-Supplier Claim by actor conflicts');

select pg_temp.seed_submitted_claim(1013, 2, 111);
select pg_temp.seed_submitted_claim(1014, 4, 112);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(111), pg_temp.conflict_id(1013)
), 'clear', 'actor active Claim on Supplier A does not conflict on Supplier B');

savepoint inactive_withdrawn_claim;
select pg_temp.seed_submitted_claim(1019, 4, 111);
update public.supplier_ownership_claims
set status = 'withdrawn', withdrawn_at = pg_catalog.statement_timestamp(),
    withdrawn_by_user_profile_id = pg_temp.conflict_id(4),
    withdrawal_reason_code = 'synthetic_withdrawal'
where id = pg_temp.conflict_id(1019);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(111), pg_temp.conflict_id(1013)
), 'clear', 'withdrawn same-Supplier Claim is inactive');
rollback to savepoint inactive_withdrawn_claim;

savepoint inactive_expired_claim;
select pg_temp.seed_submitted_claim(1020, 4, 111);
update public.supplier_ownership_claims
set status = 'expired', expires_at = pg_catalog.statement_timestamp(),
    expired_at = pg_catalog.statement_timestamp(),
    expiry_system_source_code = 'conflict_resolver_test',
    expiry_policy_version = 'claim_expiry_v1'
where id = pg_temp.conflict_id(1020);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(111), pg_temp.conflict_id(1013)
), 'clear', 'expired same-Supplier Claim is inactive');
rollback to savepoint inactive_expired_claim;

savepoint inactive_superseded_claim;
select pg_temp.seed_submitted_claim(1021, 4, 111);
update public.supplier_ownership_claims
set status = 'superseded', superseded_at = pg_catalog.statement_timestamp(),
    supersession_reason_code = 'synthetic_supersession',
    superseded_by_claim_id = pg_temp.conflict_id(1013)
where id = pg_temp.conflict_id(1021);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(111), pg_temp.conflict_id(1013)
), 'clear', 'superseded same-Supplier Claim is inactive');
rollback to savepoint inactive_superseded_claim;

savepoint inactive_rejected_claim;
select pg_temp.seed_under_review_claim(1022, 4, 111, 6, 7);
update public.supplier_ownership_claims
set status = 'rejected', decided_by_user_profile_id = pg_temp.conflict_id(6),
    decided_at = pg_catalog.statement_timestamp(),
    decision_reason_code = 'synthetic_rejection',
    evidence_verification_method_code = 'synthetic_review',
    evidence_verification_version = 1,
    evidence_verification_outcome_code = 'rejected',
    decision_authorization_policy_version = 'claim_decision_v1'
where id = pg_temp.conflict_id(1022);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(111), pg_temp.conflict_id(1013)
), 'clear', 'rejected same-Supplier Claim is inactive');
rollback to savepoint inactive_rejected_claim;

savepoint inactive_approved_claim;
select pg_temp.seed_under_review_claim(1023, 4, 111, 6, 7);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, ownership_status,
  valid_from, valid_until, establishment_source_type, establishment_reason_code,
  establishment_system_source, closure_reason_code, closure_system_source, closed_at
) values (
  pg_temp.conflict_id(2023), pg_temp.conflict_id(111), pg_temp.conflict_id(4),
  'revoked', pg_catalog.statement_timestamp() - interval '2 days',
  pg_catalog.statement_timestamp() - interval '1 day', 'claim_approval',
  'synthetic_approved_claim', 'conflict_resolver_test',
  'synthetic_revocation', 'conflict_resolver_test',
  pg_catalog.statement_timestamp() - interval '1 day'
);
update public.supplier_ownership_claims
set status = 'approved', decided_by_user_profile_id = pg_temp.conflict_id(6),
    decided_at = pg_catalog.statement_timestamp(),
    decision_reason_code = 'synthetic_approval',
    evidence_verification_method_code = 'synthetic_review',
    evidence_verification_version = 1,
    evidence_verification_outcome_code = 'approved',
    decision_authorization_policy_version = 'claim_decision_v1',
    resulting_supplier_ownership_id = pg_temp.conflict_id(2023)
where id = pg_temp.conflict_id(1023);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(4), pg_temp.conflict_id(111), pg_temp.conflict_id(1013)
), 'clear', 'approved same-Supplier Claim is inactive');
rollback to savepoint inactive_approved_claim;
select pg_temp.seed_under_review_claim(1015, 2, 113, 6, 7, 1,
  'claim_reviewer_assignment_v2');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(113), pg_temp.conflict_id(1015)
), 'unknown', 'unsupported active Claim assignment policy is unknown');
update public.supplier_ownership_claims
set reviewer_assignment_policy_version = 'claim_reviewer_assignment_v1',
    reviewer_assignment_version = 2
where id = pg_temp.conflict_id(1015);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(113), pg_temp.conflict_id(1015)
), 'unknown', 'unsupported active Claim assignment version is unknown');

select pg_temp.seed_under_review_claim(1016, 2, 114, 6, 6);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(114), pg_temp.conflict_id(1016)
), 'unknown', 'persisted self-assignment contradiction is unknown');

select pg_temp.seed_submitted_claim(1017, 2, 115);
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, ownership_status,
  valid_from, valid_until, establishment_source_type, establishment_reason_code,
  establishment_system_source, closure_reason_code, closure_system_source, closed_at
) values (
  pg_temp.conflict_id(2017), pg_temp.conflict_id(116), pg_temp.conflict_id(4),
  'revoked', pg_catalog.statement_timestamp() - interval '3 days',
  pg_catalog.statement_timestamp() - interval '2 days', 'claim_approval',
  'synthetic_mismatched_claim_result', 'conflict_resolver_test',
  'synthetic_revocation', 'conflict_resolver_test',
  pg_catalog.statement_timestamp() - interval '2 days'
);
insert into public.supplier_ownership_claims (
  id, claimant_user_profile_id, supplier_profile_id, status,
  submitted_at, expires_at, submitted_reason,
  claimant_snapshot_schema_version, claimant_snapshot,
  submission_fingerprint_version, submission_fingerprint,
  evidence_schema_version, evidence_descriptors,
  reviewer_user_profile_id, reviewer_assignment_version,
  reviewer_assigned_at, reviewer_assigned_by_user_profile_id,
  reviewer_assignment_source_code, reviewer_assignment_policy_version,
  decided_by_user_profile_id, decided_at, decision_reason_code,
  evidence_verification_method_code, evidence_verification_version,
  evidence_verification_outcome_code, decision_authorization_policy_version,
  resulting_supplier_ownership_id
) values (
  pg_temp.conflict_id(1018), pg_temp.conflict_id(4), pg_temp.conflict_id(115),
  'approved', pg_catalog.statement_timestamp() - interval '4 days',
  pg_catalog.statement_timestamp() + interval '26 days',
  'synthetic mismatched approved claim', 'claimant_snapshot_v1', '{}'::jsonb,
  'claim_submission_v1', 'fingerprint-1018', 'claim_evidence_v1', '[]'::jsonb,
  pg_temp.conflict_id(6), 1, pg_catalog.statement_timestamp() - interval '3 days',
  pg_temp.conflict_id(7), 'owner_assignment', 'claim_reviewer_assignment_v1',
  pg_temp.conflict_id(6), pg_catalog.statement_timestamp() - interval '2 days',
  'approved', 'manual_review', 'claim_evidence_review_v1', 'verified',
  'claim_decision_v1', pg_temp.conflict_id(2017)
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(115), pg_temp.conflict_id(1017)
), 'unknown', 'approved Claim-to-ownership Supplier binding mismatch is unknown');

savepoint future_relationship_authority;
create table public.supplier_memberships (id uuid primary key);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(1001)
), 'unknown', 'even an empty enabled future membership relation forces unknown');
rollback to savepoint future_relationship_authority;

select pg_temp.seed_submitted_claim(1019, 2, 117);
savepoint malformed_ownership;
alter table public.supplier_ownerships drop constraint supplier_ownerships_lifecycle_shape_ck;
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id, ownership_status,
  valid_from, valid_until, establishment_source_type,
  establishment_reason_code, establishment_system_source
) values (
  pg_temp.conflict_id(2019), pg_temp.conflict_id(117), pg_temp.conflict_id(3),
  'active', pg_catalog.statement_timestamp() - interval '1 day',
  pg_catalog.statement_timestamp() + interval '1 day', 'legacy_reconciliation',
  'synthetic_malformed_active', 'conflict_resolver_test'
);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(117), pg_temp.conflict_id(1019)
), 'unknown', 'malformed active ownership interval/state is unknown');
rollback to savepoint malformed_ownership;

select pg_temp.seed_submitted_claim(1020, 2, 118);
savepoint multiple_current_controllers;
alter table public.supplier_ownerships drop constraint supplier_ownerships_supplier_interval_excl;
drop index public.supplier_ownerships_one_active_primary_controller_uidx;
insert into public.supplier_ownerships (
  id, supplier_profile_id, controller_user_profile_id,
  establishment_source_type, establishment_reason_code, establishment_system_source
) values
  (pg_temp.conflict_id(2020), pg_temp.conflict_id(118), pg_temp.conflict_id(3),
   'legacy_reconciliation', 'synthetic_multiple_controller_one', 'conflict_resolver_test'),
  (pg_temp.conflict_id(2021), pg_temp.conflict_id(118), pg_temp.conflict_id(4),
   'legacy_reconciliation', 'synthetic_multiple_controller_two', 'conflict_resolver_test');
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(3), pg_temp.conflict_id(118), pg_temp.conflict_id(1020)
), 'unknown', 'multiple effective active controllers are unknown, not precedence-selected');
rollback to savepoint multiple_current_controllers;

select pg_temp.seed_submitted_claim(1021, 2, 119);
savepoint partial_assignment_shape;
alter table public.supplier_ownership_claims
  drop constraint supplier_ownership_claims_reviewer_assignment_shape_ck;
alter table public.supplier_ownership_claims
  drop constraint supplier_ownership_claims_lifecycle_shape_ck;
update public.supplier_ownership_claims
set reviewer_user_profile_id = pg_temp.conflict_id(6)
where id = pg_temp.conflict_id(1021);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(119), pg_temp.conflict_id(1021)
), 'unknown', 'partial active Claim assignment shape is unknown');
rollback to savepoint partial_assignment_shape;

select pg_temp.seed_submitted_claim(1022, 2, 120);
savepoint duplicate_active_claim;
drop index public.supplier_ownership_claims_one_active_pair_uidx;
select pg_temp.seed_submitted_claim(1023, 2, 120);
select is(claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(2), pg_temp.conflict_id(120), pg_temp.conflict_id(1022)
), 'unknown', 'ambiguity takes precedence over explicit claimant conflict');
rollback to savepoint duplicate_active_claim;

select pg_catalog.count(*) as claims_before_read
from public.supplier_ownership_claims \gset read_only_
select pg_catalog.count(*) as ownerships_before_read
from public.supplier_ownerships \gset read_only_
select claim_security.target_supplier_conflict_v1(
  pg_temp.conflict_id(1), pg_temp.conflict_id(101), pg_temp.conflict_id(1001));
select is((select pg_catalog.count(*) from public.supplier_ownership_claims),
  :'read_only_claims_before_read'::bigint, 'resolver call writes no Claim row');
select is((select pg_catalog.count(*) from public.supplier_ownerships),
  :'read_only_ownerships_before_read'::bigint, 'resolver call writes no ownership row');

alter function claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
  security invoker;
grant usage on schema claim_security to service_role;
grant execute on function claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
  to service_role;
set role service_role;
select claim_security.target_supplier_conflict_v1(
  '10000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000065'::uuid,
  '10000000-0000-4000-8000-0000000003e9'::uuid
) as unreadable_decision \gset unreadable_
reset role;
alter function claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
  security definer;
revoke all on function claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
  from service_role;
revoke usage on schema claim_security from service_role;
select is(:'unreadable_unreadable_decision'::text, 'unknown',
  'unreadable required relation is caught and classified unknown');
select ok(not has_function_privilege('service_role',
  'claim_security.target_supplier_conflict_v1(uuid,uuid,uuid)', 'execute'),
  'temporary unreadable-state proof leaves service_role execution revoked');

select * from finish();

rollback;
