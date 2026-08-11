-- Twenty-fourth tracked local SQL migration: private read-only target-Supplier
-- conflict resolver only. This migration creates no relationship row, table,
-- view, RLS policy, Claim mutation, Reviewer surface, hosted capability, or
-- Production action.

create function claim_security.target_supplier_conflict_v1(
  actor_user_profile_id uuid,
  target_supplier_profile_id uuid,
  target_claim_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  trusted_now timestamptz := pg_catalog.clock_timestamp();
  target_claim public.supplier_ownership_claims%rowtype;
  matching_count bigint;
  malformed_count bigint;
begin
  if actor_user_profile_id is null
     or target_supplier_profile_id is null
     or target_claim_id is null
  then
    return 'unknown';
  end if;

  -- This v1 helper is deliberately complete only for the current LOCAL schema.
  -- Once any known future relationship authority exists, even while empty, v1
  -- cannot return clear until a successor covers it explicitly.
  if pg_catalog.to_regclass('public.supplier_memberships') is not null
     or pg_catalog.to_regclass('public.organizations') is not null
     or pg_catalog.to_regclass('public.organization_memberships') is not null
  then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.user_profiles as actor_profile
  where actor_profile.id = actor_user_profile_id;

  if matching_count <> 1 then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.supplier_profiles as supplier_profile
  where supplier_profile.id = target_supplier_profile_id;

  if matching_count <> 1 then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.supplier_ownership_claims as claim
  where claim.id = target_claim_id;

  if matching_count <> 1 then
    return 'unknown';
  end if;

  select claim.*
  into target_claim
  from public.supplier_ownership_claims as claim
  where claim.id = target_claim_id;

  if target_claim.supplier_profile_id <> target_supplier_profile_id
     or target_claim.status not in ('submitted', 'under_review')
  then
    return 'unknown';
  end if;

  -- Re-prove the ownership lifecycle shape before using any row as current or
  -- historical evidence. Declarative constraints are not treated as permission
  -- to choose one contradictory row by precedence.
  select pg_catalog.count(*)
  into malformed_count
  from public.supplier_ownerships as ownership
  where ownership.supplier_profile_id = target_supplier_profile_id
    and (
      ownership.authority_type <> 'primary_controller'
      or ownership.ownership_status not in (
        'active', 'transferred', 'revoked', 'superseded'
      )
      or ownership.valid_until is not null
         and ownership.valid_until <= ownership.valid_from
      or ownership.updated_at < ownership.created_at
      or (
        ownership.ownership_status = 'active'
        and not (
          ownership.valid_until is null
          and ownership.closure_reason_code is null
          and ownership.closed_by_user_profile_id is null
          and ownership.closure_system_source is null
          and ownership.closed_at is null
          and ownership.transfer_successor_ownership_id is null
        )
      )
      or (
        ownership.ownership_status = 'transferred'
        and not (
          ownership.valid_until is not null
          and ownership.closure_reason_code is not null
          and ownership.closed_at is not null
          and (
            ownership.closed_by_user_profile_id is not null
          ) <> (
            ownership.closure_system_source is not null
          )
          and ownership.transfer_successor_ownership_id is not null
        )
      )
      or (
        ownership.ownership_status in ('revoked', 'superseded')
        and not (
          ownership.valid_until is not null
          and ownership.closure_reason_code is not null
          and ownership.closed_at is not null
          and (
            ownership.closed_by_user_profile_id is not null
          ) <> (
            ownership.closure_system_source is not null
          )
          and ownership.transfer_successor_ownership_id is null
        )
      )
    );

  if malformed_count > 0 then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into malformed_count
  from public.supplier_ownerships as ownership
  left join public.supplier_ownerships as successor
    on successor.id = ownership.transfer_successor_ownership_id
  where ownership.supplier_profile_id = target_supplier_profile_id
    and ownership.ownership_status = 'transferred'
    and (
      successor.id is null
      or successor.supplier_profile_id <> ownership.supplier_profile_id
      or successor.valid_from <> ownership.valid_until
    );

  if malformed_count > 0 then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into malformed_count
  from public.supplier_ownerships as first_ownership
  join public.supplier_ownerships as second_ownership
    on second_ownership.supplier_profile_id = first_ownership.supplier_profile_id
   and second_ownership.id > first_ownership.id
   and pg_catalog.tstzrange(
     first_ownership.valid_from,
     coalesce(first_ownership.valid_until, 'infinity'::timestamptz),
     '[)'
   ) && pg_catalog.tstzrange(
     second_ownership.valid_from,
     coalesce(second_ownership.valid_until, 'infinity'::timestamptz),
     '[)'
   )
  where first_ownership.supplier_profile_id = target_supplier_profile_id;

  if malformed_count > 0 then
    return 'unknown';
  end if;

  -- Active Claim assignment compatibility is code-owned for Claim v1: an
  -- under-review row must carry assignment version 1 and the exact approved
  -- owner-assignment policy. Submitted rows must remain wholly unassigned.
  select pg_catalog.count(*)
  into malformed_count
  from public.supplier_ownership_claims as claim
  where claim.supplier_profile_id = target_supplier_profile_id
    and claim.status in ('submitted', 'under_review')
    and (
      claim.expires_at <= claim.submitted_at
      or claim.updated_at < claim.created_at
      or (
        claim.status = 'submitted'
        and not (
          claim.reviewer_user_profile_id is null
          and claim.reviewer_assignment_version is null
          and claim.reviewer_assigned_at is null
          and claim.reviewer_assigned_by_user_profile_id is null
          and claim.reviewer_assignment_source_code is null
          and claim.reviewer_assignment_policy_version is null
          and claim.decided_at is null
          and claim.withdrawn_at is null
          and claim.expired_at is null
          and claim.superseded_at is null
          and claim.resulting_supplier_ownership_id is null
        )
      )
      or (
        claim.status = 'under_review'
        and not (
          claim.reviewer_user_profile_id is not null
          and claim.reviewer_assignment_version = 1
          and claim.reviewer_assigned_at is not null
          and claim.reviewer_assigned_by_user_profile_id is not null
          and claim.reviewer_assignment_source_code = 'owner_assignment'
          and claim.reviewer_assignment_policy_version =
            'claim_reviewer_assignment_v1'
          and claim.reviewer_user_profile_id <>
            claim.claimant_user_profile_id
          and claim.reviewer_user_profile_id <>
            claim.reviewer_assigned_by_user_profile_id
          and claim.reviewer_assigned_at >= claim.submitted_at
          and claim.reviewer_assigned_at < claim.expires_at
          and claim.decided_at is null
          and claim.withdrawn_at is null
          and claim.expired_at is null
          and claim.superseded_at is null
          and claim.resulting_supplier_ownership_id is null
        )
      )
    );

  if malformed_count > 0 then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into malformed_count
  from (
    select claim.claimant_user_profile_id
    from public.supplier_ownership_claims as claim
    where claim.supplier_profile_id = target_supplier_profile_id
      and claim.status in ('submitted', 'under_review')
    group by claim.claimant_user_profile_id
    having pg_catalog.count(*) > 1
  ) as duplicate_active_pair;

  if malformed_count > 0 then
    return 'unknown';
  end if;

  -- Cross-table approval provenance must bind the same Supplier and claimant to
  -- the same ownership row. This is integrity evidence only, never a source of
  -- current conflict by itself.
  select pg_catalog.count(*)
  into malformed_count
  from public.supplier_ownership_claims as claim
  left join public.supplier_ownerships as ownership
    on ownership.id = claim.resulting_supplier_ownership_id
  where claim.resulting_supplier_ownership_id is not null
    and (
      claim.supplier_profile_id = target_supplier_profile_id
      or ownership.supplier_profile_id = target_supplier_profile_id
    )
    and (
      claim.status <> 'approved'
      or ownership.id is null
      or ownership.supplier_profile_id <> claim.supplier_profile_id
      or ownership.controller_user_profile_id <>
        claim.claimant_user_profile_id
      or ownership.authority_type <> 'primary_controller'
      or ownership.establishment_source_type <> 'claim_approval'
    );

  if malformed_count > 0 then
    return 'unknown';
  end if;

  select pg_catalog.count(*)
  into matching_count
  from public.supplier_ownerships as ownership
  where ownership.supplier_profile_id = target_supplier_profile_id
    and ownership.authority_type = 'primary_controller'
    and ownership.ownership_status = 'active'
    and ownership.valid_from <= trusted_now
    and (
      ownership.valid_until is null
      or trusted_now < ownership.valid_until
    );

  if matching_count > 1 then
    return 'unknown';
  end if;

  -- Unknown/integrity conditions above deliberately take precedence over these
  -- conclusive conflict facts.
  if target_claim.claimant_user_profile_id = actor_user_profile_id then
    return 'conflict';
  end if;

  if exists (
    select 1
    from public.supplier_ownerships as ownership
    where ownership.supplier_profile_id = target_supplier_profile_id
      and ownership.controller_user_profile_id = actor_user_profile_id
      and ownership.authority_type = 'primary_controller'
      and ownership.ownership_status = 'active'
      and ownership.valid_from <= trusted_now
      and (
        ownership.valid_until is null
        or trusted_now < ownership.valid_until
      )
  ) then
    return 'conflict';
  end if;

  if exists (
    select 1
    from public.supplier_ownership_claims as competing_claim
    where competing_claim.supplier_profile_id = target_supplier_profile_id
      and competing_claim.claimant_user_profile_id = actor_user_profile_id
      and competing_claim.status in ('submitted', 'under_review')
      and competing_claim.id <> target_claim_id
  ) then
    return 'conflict';
  end if;

  return 'clear';
exception
  when others then
    return 'unknown';
end
$function$;

alter function claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
  owner to postgres;

comment on function claim_security.target_supplier_conflict_v1(uuid, uuid, uuid) is
  'Private read-only LOCAL Claim-v1 target-Supplier conflict observation over the implemented ownership/Claim subset. Only clear is authorization-positive. Self-assignment remains a later command-layer comparison. Any enabled external or future relationship authority requires complete successor coverage and an approved environment manifest before hosted use.';

revoke all on function
  claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
from public, anon, authenticated, service_role, mujahiz_claim_runtime;

revoke all privileges on table
  public.user_profiles,
  public.supplier_profiles,
  public.supplier_ownerships,
  public.supplier_ownership_claims
from mujahiz_claim_runtime;
