-- Seventeenth local SQL slice: Claimant self-read RLS and minimized projection only.
-- This migration creates no Claim mutation, reviewer/Admin access, Supplier-controller
-- access, browser/API grant, Auth bridge, hosted capability, or data movement.

alter table public.supplier_ownership_claims enable row level security;
alter table public.supplier_ownership_claims force row level security;

create policy supplier_ownership_claims_claimant_self_select
  on public.supplier_ownership_claims
  for select
  to mujahiz_claim_runtime
  using (
    claimant_user_profile_id =
      claim_security.current_claim_user_profile_id()
  );

comment on policy supplier_ownership_claims_claimant_self_select
  on public.supplier_ownership_claims is
  'Claim-v1 runtime principals may select only Claims whose provider-neutral claimant profile matches the fail-closed transaction-local principal. This policy grants no mutation, reviewer, Admin/Owner, Supplier-controller, or browser/API access.';

create view public.supplier_ownership_claims_claimant_v1
with (security_barrier = true, security_invoker = true)
as
select
  id,
  supplier_profile_id,
  status,
  case status
    when 'approved' then 'approved'
    when 'rejected' then 'not_approved'
    when 'withdrawn' then 'withdrawn'
    when 'expired' then 'expired'
    when 'superseded' then 'superseded'
    else null
  end::text as claimant_result_code,
  submitted_at,
  expires_at,
  decided_at,
  withdrawn_at,
  expired_at,
  superseded_at,
  updated_at,
  record_version
from public.supplier_ownership_claims;

comment on view public.supplier_ownership_claims_claimant_v1 is
  'SECURITY INVOKER, RLS-filtered Claimant-v1 status/history projection. It excludes claimant-authored private content, evidence, reviewer and decision internals, provider identity, competing Claims, ownership provenance, and security metadata.';
comment on column public.supplier_ownership_claims_claimant_v1.claimant_result_code is
  'Status-only claimant-safe result. Rejections are minimized to not_approved because this slice does not grant the runtime role access to restricted decision reason codes.';

revoke all on table public.supplier_ownership_claims
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
revoke all on table public.supplier_ownership_claims_claimant_v1
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;

grant select (
  id,
  supplier_profile_id,
  status,
  record_version,
  submitted_at,
  expires_at,
  decided_at,
  withdrawn_at,
  expired_at,
  superseded_at,
  updated_at
) on table public.supplier_ownership_claims
  to mujahiz_claim_runtime;

grant select on table public.supplier_ownership_claims_claimant_v1
  to mujahiz_claim_runtime;
