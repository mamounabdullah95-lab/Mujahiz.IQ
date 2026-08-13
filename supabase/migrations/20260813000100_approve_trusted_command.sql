-- Twenty-eighth tracked local SQL migration: supplier_claim.approve v1 only.
-- This migration adds no table, mutation RLS policy, notification, hosted
-- capability, file-dependent evidence path, gateway, or data movement.

create function supplier_claim._canonicalize_approve_request_v1(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_expected_reviewer_assignment_version integer,
  p_evidence_verification_method_code text,
  p_evidence_verification_version text,
  p_evidence_verification_outcome_code text,
  p_checked_source_classes text[],
  p_restricted_evidence_reference text
)
returns table (
  reviewer_user_profile_id uuid,
  key_digest bytea,
  request_fingerprint bytea,
  canonical_checked_source_classes text[],
  canonical_restricted_evidence_reference text,
  evidence_digest text
)
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $function$
declare
  v_principal_id uuid;
  v_hmac_key text;
  v_source_classes text[];
  v_reference text;
  v_reference_binding text;
  v_canonical_request jsonb;
begin
  v_principal_id := claim_security.current_claim_user_profile_id();
  if v_principal_id is null then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  if p_claim_id is null
     or p_expected_claim_version is null
     or p_expected_claim_version < 1
     or p_expected_reviewer_assignment_version is null
     or p_expected_reviewer_assignment_version < 1
     or p_idempotency_key is null
     or p_idempotency_key !~ '^claim-([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
     or p_evidence_verification_method_code is distinct from 'manual_review'
     or p_evidence_verification_version is distinct from 'claim_evidence_review_v1'
     or p_evidence_verification_outcome_code is distinct from 'verified'
     or p_checked_source_classes is null
     or pg_catalog.cardinality(p_checked_source_classes) not between 1 and 8
  then
    raise exception using errcode = 'P5101', message = 'invalid_request';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_checked_source_classes) as source_class(value)
    where source_class.value is null
       or pg_catalog.btrim(source_class.value) = ''
       or pg_catalog.octet_length(pg_catalog.btrim(source_class.value)) > 64
       or pg_catalog.lower(pg_catalog.btrim(source_class.value)) !~ '^[a-z][a-z0-9_]{0,62}$'
  ) then
    raise exception using errcode = 'P5101', message = 'invalid_request';
  end if;

  select pg_catalog.array_agg(normalized.value order by normalized.value)
  into v_source_classes
  from (
    select distinct pg_catalog.lower(pg_catalog.btrim(source_class.value)) as value
    from pg_catalog.unnest(p_checked_source_classes) as source_class(value)
  ) as normalized;

  if v_source_classes is distinct from array['authorized_officer_confirmation']::text[]
     and v_source_classes is distinct from array['claimant_authority', 'official_registry']::text[]
     and v_source_classes is distinct from array[
       'company_domain_challenge', 'independent_supplier_corroboration'
     ]::text[]
  then
    raise exception using errcode = 'P5101', message = 'invalid_request';
  end if;

  v_reference := pg_catalog.btrim(p_restricted_evidence_reference);
  if v_reference is null
     or pg_catalog.octet_length(v_reference) not between 1 and 256
     or v_reference ~ '[[:space:]]'
     or pg_catalog.translate(v_reference, E'\n\r\t', '') ~ '[[:cntrl:]]'
     or v_reference ~ '[/\\?#=&]'
     or pg_catalog.lower(v_reference) ~ '^[a-z][a-z0-9+.-]*:'
     or pg_catalog.lower(v_reference) ~ '^(file|storage|attachment|object)([_-]?(id|key|path))?[-_:]'
  then
    raise exception using errcode = 'P5101', message = 'invalid_request';
  end if;

  evidence_digest := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'claim-approve-evidence-digest-v1|'
          || pg_catalog.octet_length(v_reference)::text || ':' || v_reference,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  v_reference_binding := pg_catalog.encode(
    extensions.hmac(
      pg_catalog.convert_to(
        'claim-approve-evidence-reference-v1|'
          || pg_catalog.jsonb_build_object(
            'restricted_evidence_reference', v_reference,
            'evidence_digest', evidence_digest,
            'evidence_digest_version', 'claim_approve_evidence_digest_v1'
          )::text,
        'UTF8'
      ),
      pg_catalog.convert_to(v_hmac_key, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  v_canonical_request := pg_catalog.jsonb_build_object(
    'claim_id', p_claim_id,
    'expected_claim_version', p_expected_claim_version,
    'expected_reviewer_assignment_version', p_expected_reviewer_assignment_version,
    'evidence_verification_method_code', p_evidence_verification_method_code,
    'evidence_verification_version', p_evidence_verification_version,
    'evidence_verification_outcome_code', p_evidence_verification_outcome_code,
    'checked_source_classes', pg_catalog.to_jsonb(v_source_classes),
    'approval_evidence_policy_version', 'claim_approval_evidence_policy_v1',
    'reason_registry_version', 'claim_approval_reason_registry_v1',
    'restricted_evidence_binding', v_reference_binding,
    'evidence_digest_version', 'claim_approve_evidence_digest_v1',
    'disclosure_policy_version', 'claim_approve_disclosure_v1',
    'decision_authorization_policy_version', 'sec-001-claim-v1',
    'supersession_policy_version', 'claim_approval_reason_registry_v1',
    'reviewer_notes_marker', 'null'
  );

  key_digest := extensions.hmac(
    pg_catalog.convert_to(
      'claim-idempotency-key-v1|local|supplier_claim.approve|1|'
        || pg_catalog.octet_length(p_idempotency_key)::text || ':' || p_idempotency_key,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  request_fingerprint := extensions.hmac(
    pg_catalog.convert_to('claim-request-fingerprint-v1|' || v_canonical_request::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  reviewer_user_profile_id := v_principal_id;
  canonical_checked_source_classes := v_source_classes;
  canonical_restricted_evidence_reference := v_reference;
  return next;
end
$function$;

comment on function supplier_claim._canonicalize_approve_request_v1(
  text, uuid, integer, integer, text, text, text, text[], text
) is
  'Private approve-v1 canonicalizer. It normalizes and exact-match allowlists one high-assurance source-class path, validates one bounded opaque non-file reference, derives its SHA-256 digest, and binds only a keyed reference projection into idempotency state.';

alter function supplier_claim._canonicalize_approve_request_v1(
  text, uuid, integer, integer, text, text, text, text[], text
) owner to postgres;
revoke all on function supplier_claim._canonicalize_approve_request_v1(
  text, uuid, integer, integer, text, text, text, text[], text
) from public, anon, authenticated, service_role, mujahiz_claim_runtime;

create function supplier_claim.approve(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_expected_reviewer_assignment_version integer,
  p_evidence_verification_method_code text,
  p_evidence_verification_version text,
  p_evidence_verification_outcome_code text,
  p_checked_source_classes text[],
  p_restricted_evidence_reference text,
  p_correlation_id uuid default null
)
returns table (
  reservation_outcome text,
  execution_fence uuid,
  command text,
  command_contract_version integer,
  outcome_code text,
  claim_id uuid,
  claim_status text,
  claim_version integer,
  supplier_profile_id uuid,
  ownership_id uuid,
  decided_at timestamptz,
  superseded_claim_count integer,
  idempotent_replay boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_request record;
  v_hmac_key text;
  v_fence uuid;
  v_fence_digest bytea;
  v_now timestamptz;
  v_idempotency internal.idempotency_keys%rowtype;
  v_replay_claim public.supplier_ownership_claims%rowtype;
  v_replay_ownership public.supplier_ownerships%rowtype;
  v_approved_event internal.domain_events%rowtype;
  v_approve_audit internal.audit_logs%rowtype;
  v_expected_audit_context jsonb;
  v_original_request jsonb;
  v_original_fingerprint bytea;
  v_reference_binding text;
  v_expected_evidence_digest text;
  v_audit_source_classes text[];
  v_event_claim_ids uuid[];
  v_expected_ordinals integer[];
  v_result_version integer;
  v_event_count integer;
  v_audit_count integer;
  v_active_ownership_count integer;
  v_superseded_count integer;
  v_replay_claimant_id uuid;
  v_replay_supplier_id uuid;
  v_replay_lock_principal_id uuid;
  v_replay_authorization_now timestamptz;
  v_replay_reviewer_decision text;
  v_replay_reviewer_role text;
  v_replay_reviewer_conflict text;
  v_replay_current_role_count integer;
  v_replay_current_access_count integer;
  v_replay_current_security_count integer;
  v_completed_request_matches boolean := false;
  v_new_reservation boolean := false;
  v_expected_denial_outcome text;
begin
  select canonical.* into v_request
  from supplier_claim._canonicalize_approve_request_v1(
    p_idempotency_key,
    p_claim_id,
    p_expected_claim_version,
    p_expected_reviewer_assignment_version,
    p_evidence_verification_method_code,
    p_evidence_verification_version,
    p_evidence_verification_outcome_code,
    p_checked_source_classes,
    p_restricted_evidence_reference
  ) as canonical;
  if not found then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;

  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_fence := pg_catalog.gen_random_uuid();
  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-approve-fence-v1|' || v_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );

  insert into internal.idempotency_keys (
    command_name, command_contract_version, environment_code,
    principal_kind, principal_user_profile_id,
    target_aggregate_type, target_aggregate_id,
    key_digest, key_digest_key_version,
    request_fingerprint, request_fingerprint_key_version,
    status, lease_token_digest, lease_digest_key_version, lease_expires_at,
    attempt_count, created_at, expires_at
  ) values (
    'supplier_claim.approve', 1, 'local',
    'human_user', v_request.reviewer_user_profile_id,
    'supplier_ownership_claim', p_claim_id,
    v_request.key_digest, 'local_v1',
    v_request.request_fingerprint, 'local_v1',
    'processing', v_fence_digest, 'local_v1', v_now + interval '60 seconds',
    1, v_now, v_now + interval '720 hours'
  )
  on conflict on constraint idempotency_keys_namespace_uk do nothing
  returning * into v_idempotency;
  v_new_reservation := found;

  if not v_new_reservation then
    select row_value.* into v_idempotency
    from internal.idempotency_keys as row_value
    where row_value.environment_code = 'local'
      and row_value.command_name = 'supplier_claim.approve'
      and row_value.command_contract_version = 1
      and row_value.key_digest = v_request.key_digest
    for update;

    if not found then
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;

    if v_idempotency.status = 'completed' then
      if v_idempotency.environment_code <> 'local'
         or v_idempotency.command_name <> 'supplier_claim.approve'
         or v_idempotency.command_contract_version <> 1
         or v_idempotency.principal_kind <> 'human_user'
         or v_idempotency.principal_user_profile_id is null
         or v_idempotency.principal_source_code is not null
         or v_idempotency.target_aggregate_type <> 'supplier_ownership_claim'
         or v_idempotency.target_aggregate_id is null
         or v_idempotency.upstream_source_system_code is not null
         or v_idempotency.upstream_request_identity is not null
         or pg_catalog.octet_length(v_idempotency.key_digest) <> 32
         or v_idempotency.key_digest_key_version <> 'local_v1'
         or pg_catalog.octet_length(v_idempotency.request_fingerprint) <> 32
         or v_idempotency.request_fingerprint_key_version <> 'local_v1'
         or v_idempotency.outcome_code <> 'approved'
         or v_idempotency.result_resource_type <> 'supplier_ownership_claim'
         or v_idempotency.result_resource_id is distinct from v_idempotency.target_aggregate_id
         or v_idempotency.result_version_token !~ '^[1-9][0-9]{0,9}$'
         or v_idempotency.completed_at is null
         or v_idempotency.lease_token_digest is not null
         or v_idempotency.lease_digest_key_version is not null
         or v_idempotency.lease_expires_at is not null
         or v_idempotency.failure_code is not null
         or v_idempotency.retry_disposition is not null
         or v_idempotency.next_attempt_at is not null
         or v_idempotency.failed_at is not null
         or v_idempotency.expires_at <= v_idempotency.completed_at
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      v_result_version := v_idempotency.result_version_token::integer;
      v_completed_request_matches :=
        v_idempotency.principal_user_profile_id is not distinct from
          v_request.reviewer_user_profile_id
        and v_idempotency.target_aggregate_id is not distinct from p_claim_id
        and v_idempotency.request_fingerprint is not distinct from
          v_request.request_fingerprint;

      select claim_row.claimant_user_profile_id, claim_row.supplier_profile_id
      into v_replay_claimant_id, v_replay_supplier_id
      from public.supplier_ownership_claims as claim_row
      where claim_row.id = v_idempotency.result_resource_id;

      if not found then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      -- An exact completed replay is a currently authorized read, not an
      -- unconditional response cache. Use the same lock hierarchy as Phase B
      -- before re-reading the immutable result and all mutable authorization
      -- facts. A mismatched request is still classified only after the stored
      -- completed result has passed its integrity proof below.
      if v_completed_request_matches then
        for v_replay_lock_principal_id in
          select lock_principal.principal_id
          from (
            values (v_request.reviewer_user_profile_id), (v_replay_claimant_id)
          ) as lock_principal(principal_id)
          where lock_principal.principal_id is not null
          group by lock_principal.principal_id
          order by lock_principal.principal_id
        loop
          perform pg_catalog.pg_advisory_xact_lock(
            claim_security.claim_principal_lock_key_v1(v_replay_lock_principal_id)
          );
        end loop;

        perform pg_catalog.pg_advisory_xact_lock(
          claim_security.claim_supplier_lock_key_v1(v_replay_supplier_id)
        );

        perform 1
        from public.user_profiles as row_value
        where row_value.id in (
          v_request.reviewer_user_profile_id, v_replay_claimant_id
        )
        order by row_value.id
        for update;

        perform 1
        from internal.identity_provider_links as row_value
        where row_value.user_profile_id in (
          v_request.reviewer_user_profile_id, v_replay_claimant_id
        )
        order by row_value.id
        for update;

        perform 1
        from public.platform_role_assignments as row_value
        where row_value.user_profile_id = v_request.reviewer_user_profile_id
        order by row_value.id
        for update;

        perform 1
        from public.access_grants as row_value
        where row_value.user_profile_id = v_request.reviewer_user_profile_id
        order by row_value.id
        for update;

        perform 1
        from internal.security_eligibility_assessments as row_value
        where row_value.user_profile_id = v_request.reviewer_user_profile_id
        order by row_value.id
        for update;

        perform 1
        from public.supplier_profiles as supplier_row
        where supplier_row.id = v_replay_supplier_id
        for update;

        perform 1
        from public.supplier_ownerships as ownership_row
        where ownership_row.supplier_profile_id = v_replay_supplier_id
        order by ownership_row.id
        for update;

        perform 1
        from public.supplier_ownership_claims as claim_row
        where claim_row.supplier_profile_id = v_replay_supplier_id
        order by claim_row.id
        for update;

        v_replay_authorization_now := pg_catalog.clock_timestamp();
      end if;

      select claim_row.* into v_replay_claim
      from public.supplier_ownership_claims as claim_row
      where claim_row.id = v_idempotency.result_resource_id;

      if not found
         or v_replay_claim.status <> 'approved'
         or v_replay_claim.record_version <> v_result_version
         or v_replay_claim.reviewer_user_profile_id is distinct from v_idempotency.principal_user_profile_id
         or v_replay_claim.reviewer_assignment_version <> 1
         or v_replay_claim.reviewer_assigned_at is null
         or v_replay_claim.reviewer_assigned_by_user_profile_id is null
         or v_replay_claim.reviewer_assignment_source_code <> 'owner_assignment'
         or v_replay_claim.reviewer_assignment_policy_version <> 'claim_reviewer_assignment_v1'
         or v_replay_claim.reviewer_user_profile_id = v_replay_claim.claimant_user_profile_id
         or v_replay_claim.reviewer_user_profile_id = v_replay_claim.reviewer_assigned_by_user_profile_id
         or v_replay_claim.decided_by_user_profile_id is distinct from v_replay_claim.reviewer_user_profile_id
         or v_replay_claim.decided_at is distinct from v_idempotency.completed_at
         or v_replay_claim.decision_reason_code <> 'verified_claim_approved'
         or v_replay_claim.evidence_verification_method_code <> 'manual_review'
         or v_replay_claim.evidence_verification_version <> 'claim_evidence_review_v1'
         or v_replay_claim.evidence_verification_outcome_code <> 'verified'
         or v_replay_claim.decision_authorization_policy_version <> 'claim_approval_reason_registry_v1'
         or v_replay_claim.reviewer_notes is not null
         or v_replay_claim.resulting_supplier_ownership_id is null
         or v_replay_claim.withdrawn_at is not null
         or v_replay_claim.expired_at is not null
         or v_replay_claim.superseded_at is not null
         or v_replay_claim.expires_at <> v_replay_claim.submitted_at + interval '720 hours'
         or v_replay_claim.created_at <> v_replay_claim.submitted_at
         or v_replay_claim.claimant_snapshot_schema_version <> 'claimant_snapshot_v1'
         or v_replay_claim.submission_fingerprint_version <> 'claim_submit_v1'
         or v_replay_claim.submission_fingerprint !~ '^[0-9a-f]{64}$'
         or v_replay_claim.evidence_schema_version <> 'claim_evidence_v1'
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      select ownership_row.* into v_replay_ownership
      from public.supplier_ownerships as ownership_row
      where ownership_row.id = v_replay_claim.resulting_supplier_ownership_id;

      select pg_catalog.count(*) into v_active_ownership_count
      from public.supplier_ownerships as ownership_row
      where ownership_row.supplier_profile_id = v_replay_claim.supplier_profile_id
        and ownership_row.authority_type = 'primary_controller'
        and ownership_row.ownership_status = 'active';

      if v_replay_ownership.id is null
         or v_active_ownership_count <> 1
         or v_replay_ownership.supplier_profile_id <> v_replay_claim.supplier_profile_id
         or v_replay_ownership.controller_user_profile_id <> v_replay_claim.claimant_user_profile_id
         or v_replay_ownership.authority_type <> 'primary_controller'
         or v_replay_ownership.ownership_status <> 'active'
         or v_replay_ownership.valid_from is distinct from v_replay_claim.decided_at
         or v_replay_ownership.valid_until is not null
         or v_replay_ownership.record_version <> 1
         or v_replay_ownership.establishment_source_type <> 'claim_approval'
         or v_replay_ownership.establishment_reason_code <> 'verified_claim_approved'
         or v_replay_ownership.established_by_user_profile_id is distinct from v_replay_claim.reviewer_user_profile_id
         or v_replay_ownership.establishment_system_source is not null
         or v_replay_ownership.established_at is distinct from v_replay_claim.decided_at
         or v_replay_ownership.closure_reason_code is not null
         or v_replay_ownership.closed_by_user_profile_id is not null
         or v_replay_ownership.closure_system_source is not null
         or v_replay_ownership.closed_at is not null
         or v_replay_ownership.transfer_successor_ownership_id is not null
         or v_replay_ownership.created_at is distinct from v_replay_claim.decided_at
         or v_replay_ownership.created_by_user_profile_id is distinct from v_replay_claim.reviewer_user_profile_id
         or v_replay_ownership.updated_at is distinct from v_replay_claim.decided_at
         or v_replay_ownership.updated_by_user_profile_id is distinct from v_replay_claim.reviewer_user_profile_id
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      if v_completed_request_matches then
        -- The current response boundary is evaluated only after the completed
        -- Claim and ownership have been re-read under the Phase-B lock order.
        -- Loss of authorization suppresses disclosure without changing history.
        select evaluator.decision, evaluator.role_code
        into v_replay_reviewer_decision, v_replay_reviewer_role
        from claim_security.current_privileged_actor_v1() as evaluator;

        select pg_catalog.count(*) into v_replay_current_role_count
        from public.platform_role_assignments as role_row
        where role_row.user_profile_id = v_request.reviewer_user_profile_id
          and role_row.assignment_status = 'active'
          and role_row.authorization_policy_version = 'platform-role-policy-v1'
          and role_row.valid_from <= v_replay_authorization_now
          and (
            role_row.valid_until is null
            or v_replay_authorization_now < role_row.valid_until
          );

        select pg_catalog.count(*) into v_replay_current_access_count
        from public.access_grants as access_row
        join public.platform_role_assignments as role_row
          on role_row.id = access_row.platform_role_assignment_id
         and role_row.user_profile_id = access_row.user_profile_id
         and role_row.role_code = access_row.role_code
        where access_row.user_profile_id = v_request.reviewer_user_profile_id
          and access_row.access_status = 'active'
          and access_row.access_purpose = 'platform_administration'
          and access_row.authorization_policy_version = 'platform-access-policy-v1'
          and access_row.valid_from <= v_replay_authorization_now
          and (
            access_row.valid_until is null
            or v_replay_authorization_now < access_row.valid_until
          )
          and role_row.assignment_status = 'active'
          and role_row.authorization_policy_version = 'platform-role-policy-v1'
          and role_row.valid_from <= v_replay_authorization_now
          and (
            role_row.valid_until is null
            or v_replay_authorization_now < role_row.valid_until
          );

        select pg_catalog.count(*) into v_replay_current_security_count
        from internal.security_eligibility_assessments as security_row
        where security_row.user_profile_id = v_request.reviewer_user_profile_id
          and security_row.assessment_scope = 'platform_administration'
          and security_row.assessment_status = 'active'
          and security_row.assessment_result = 'clear'
          and security_row.condition_type = 'complete_clear'
          and security_row.security_policy_version = 'platform-admin-security-v1'
          and security_row.required_coverage_version = 'platform-admin-coverage-v1'
          and security_row.evidence_minimization_version = 'platform-admin-minimization-v1'
          and security_row.valid_from <= v_replay_authorization_now
          and (
            security_row.valid_until is null
            or v_replay_authorization_now < security_row.valid_until
          );

        -- target_supplier_conflict_v1 deliberately rejects terminal Claims.
        -- This approved-status response check uses the same currently approved
        -- relational conflict sources while the Supplier rows remain locked.
        v_replay_reviewer_conflict := case
          when pg_catalog.to_regclass('public.supplier_memberships') is not null
            or pg_catalog.to_regclass('public.organizations') is not null
            or pg_catalog.to_regclass('public.organization_memberships') is not null
            then 'unknown'
          when v_request.reviewer_user_profile_id = v_replay_claim.claimant_user_profile_id
            or v_request.reviewer_user_profile_id =
              v_replay_claim.reviewer_assigned_by_user_profile_id
            then 'conflict'
          when exists (
            select 1
            from public.supplier_ownerships as ownership_row
            where ownership_row.supplier_profile_id = v_replay_claim.supplier_profile_id
              and ownership_row.controller_user_profile_id =
                v_request.reviewer_user_profile_id
              and ownership_row.authority_type = 'primary_controller'
              and ownership_row.ownership_status = 'active'
              and ownership_row.valid_from <= v_replay_authorization_now
              and (
                ownership_row.valid_until is null
                or v_replay_authorization_now < ownership_row.valid_until
              )
          ) then 'conflict'
          when exists (
            select 1
            from public.supplier_ownership_claims as claim_row
            where claim_row.supplier_profile_id = v_replay_claim.supplier_profile_id
              and claim_row.claimant_user_profile_id =
                v_request.reviewer_user_profile_id
              and claim_row.status in ('submitted', 'under_review')
              and claim_row.id <> v_replay_claim.id
          ) then 'conflict'
          else 'clear'
        end;

        if v_replay_reviewer_decision is distinct from 'eligible'
           or v_replay_reviewer_role not in ('owner', 'admin')
           or v_replay_current_role_count <> 1
           or v_replay_current_access_count <> 1
           or v_replay_current_security_count <> 1
           or v_replay_claim.reviewer_user_profile_id is distinct from
             v_request.reviewer_user_profile_id
           or v_replay_reviewer_conflict is distinct from 'clear'
        then
          raise exception using errcode = 'P5100', message = 'claim_context_invalid';
        end if;
      end if;

      select pg_catalog.count(*) into v_audit_count
      from internal.audit_logs as audit_row
      where audit_row.idempotency_reference = v_idempotency.id
        and audit_row.source_operation_class <> 'idempotency_conflict';
      select audit_row.* into v_approve_audit
      from internal.audit_logs as audit_row
      where audit_row.idempotency_reference = v_idempotency.id
        and audit_row.source_operation_class <> 'idempotency_conflict';

      begin
        v_superseded_count := (v_approve_audit.safe_context ->> 'superseded_claim_count')::integer;
        select pg_catalog.array_agg(source_class.value order by source_class.value)
        into v_audit_source_classes
        from pg_catalog.jsonb_array_elements_text(
          v_approve_audit.safe_context -> 'checked_source_classes'
        ) as source_class(value);
      exception when others then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end;

      v_expected_audit_context := pg_catalog.jsonb_build_object(
        'reason_registry_version', 'claim_approval_reason_registry_v1',
        'approval_evidence_policy_version', 'claim_approval_evidence_policy_v1',
        'evidence_verification_method_code', v_replay_claim.evidence_verification_method_code,
        'evidence_verification_version', v_replay_claim.evidence_verification_version,
        'evidence_verification_outcome_code', v_replay_claim.evidence_verification_outcome_code,
        'checked_source_classes', pg_catalog.to_jsonb(v_audit_source_classes),
        'evidence_digest_version', 'claim_approve_evidence_digest_v1',
        'disclosure_policy_version', 'claim_approve_disclosure_v1',
        'decision_authorization_policy_version', 'sec-001-claim-v1',
        'reviewer_role_code', v_approve_audit.actor_authorization_snapshot,
        'reviewer_conflict_result', 'clear',
        'provider_state_version', 'firebase-provider-state-v1',
        'role_policy_version', 'platform-role-policy-v1',
        'access_policy_version', 'platform-access-policy-v1',
        'security_policy_version', 'platform-admin-security-v1',
        'security_coverage_version', 'platform-admin-coverage-v1',
        'evidence_minimization_version', 'platform-admin-minimization-v1',
        'resulting_supplier_ownership_id', v_replay_ownership.id,
        'superseded_claim_count', v_superseded_count
      );

      v_expected_evidence_digest := pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(
            'claim-approve-evidence-digest-v1|'
              || pg_catalog.octet_length(v_approve_audit.restricted_evidence_reference)::text
              || ':' || v_approve_audit.restricted_evidence_reference,
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      );

      if v_audit_count <> 1
         or not found
         or v_superseded_count is null
         or v_superseded_count < 0
         or v_approve_audit.action_code is distinct from 'supplier_claim.approve'
         or v_approve_audit.action_contract_version is distinct from 1
         or v_approve_audit.action_class is distinct from 'claim_ownership'
         or v_approve_audit.actor_kind is distinct from 'human_user'
         or v_approve_audit.actor_user_profile_id is distinct from v_idempotency.principal_user_profile_id
         or v_approve_audit.actor_source_code is not null
         or v_approve_audit.actor_authorization_snapshot is null
         or v_approve_audit.actor_authorization_snapshot not in ('owner', 'admin')
         or v_approve_audit.target_entity_type is distinct from 'supplier_ownership_claim'
         or v_approve_audit.target_id is distinct from v_replay_claim.id
         or v_approve_audit.related_target_entity_type is distinct from 'supplier_profile'
         or v_approve_audit.related_target_id is distinct from v_replay_claim.supplier_profile_id
         or v_approve_audit.occurred_at is distinct from v_replay_claim.decided_at
         or v_approve_audit.recorded_at is distinct from v_replay_claim.decided_at
         or v_approve_audit.environment_code is distinct from 'local'
         or v_approve_audit.source_system_code is distinct from 'mujahiz'
         or v_approve_audit.producing_component_code is distinct from 'supplier_claim_command'
         or v_approve_audit.source_operation_class is distinct from 'trusted_command'
         or v_approve_audit.outcome_class is distinct from 'succeeded'
         or v_approve_audit.result_code is distinct from 'approved'
         or v_approve_audit.reason_code is distinct from 'verified_claim_approved'
         or v_approve_audit.safe_context_schema_version is distinct from 'claim_approve_context_v1'
         or v_approve_audit.safe_context is distinct from v_expected_audit_context
         or v_approve_audit.idempotency_reference is distinct from v_idempotency.id
         or v_approve_audit.prior_state_code is distinct from 'under_review'
         or v_approve_audit.result_state_code is distinct from 'approved'
         or v_approve_audit.prior_record_version is distinct from v_result_version - 1
         or v_approve_audit.result_record_version is distinct from v_result_version
         or v_approve_audit.changed_field_codes is distinct from array[
           'status', 'record_version', 'decided_by_user_profile_id', 'decided_at',
           'decision_reason_code', 'evidence_verification_method_code',
           'evidence_verification_version', 'evidence_verification_outcome_code',
           'decision_authorization_policy_version', 'resulting_supplier_ownership_id'
         ]::text[]
         or v_approve_audit.evidence_digest is distinct from v_expected_evidence_digest
         or v_approve_audit.evidence_digest !~ '^[0-9a-f]{64}$'
         or v_approve_audit.evidence_digest_algorithm is distinct from 'sha256'
         or v_approve_audit.evidence_digest_version is distinct from 'claim_approve_evidence_digest_v1'
         or v_approve_audit.restricted_evidence_reference is null
         or pg_catalog.octet_length(v_approve_audit.restricted_evidence_reference) not between 1 and 256
         or v_approve_audit.audit_schema_version is distinct from 'audit_log_v1'
         or v_approve_audit.action_evidence_schema_version is distinct from 'claim_approve_success_v1'
         or v_approve_audit.authorization_policy_version is distinct from 'sec-001-claim-v1'
         or v_approve_audit.producer_contract_version is distinct from 'supplier_claim.approve.v1'
         or v_approve_audit.minimization_policy_version is distinct from 'aud-001-minimized-v1'
         or v_approve_audit.retention_class is distinct from 'claim_ownership_decision'
         or v_approve_audit.legal_hold_classification is not null
         or v_approve_audit.predecessor_audit_log_id is not null
         or v_approve_audit.correction_reason_code is not null
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      select pg_catalog.count(*) into v_event_count
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id;
      select event_row.* into v_approved_event
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id
        and event_row.event_ordinal = 1;

      if v_event_count <> v_superseded_count + 1
         or not found
         or v_approve_audit.domain_event_reference is distinct from v_approved_event.id
         or v_approve_audit.correlation_id is distinct from v_approved_event.correlation_id
         or v_approved_event.event_type <> 'supplier_ownership.claim_approved'
         or v_approved_event.event_schema_version <> 1
         or v_approved_event.aggregate_type <> 'supplier_ownership_claim'
         or v_approved_event.aggregate_id is distinct from v_replay_claim.id
         or v_approved_event.aggregate_sequence <> v_result_version
         or v_approved_event.producer_command_name <> 'supplier_claim.approve'
         or v_approved_event.producer_command_contract_version <> 1
         or v_approved_event.source_system_code <> 'mujahiz'
         or v_approved_event.event_ordinal <> 1
         or v_approved_event.actor_kind <> 'human_user'
         or v_approved_event.actor_user_profile_id is distinct from v_idempotency.principal_user_profile_id
         or v_approved_event.environment_code <> 'local'
         or v_approved_event.producing_component_code <> 'supplier_claim_command'
         or v_approved_event.occurred_at is distinct from v_replay_claim.decided_at
         or v_approved_event.persisted_at is distinct from v_replay_claim.decided_at
         or v_approved_event.available_at is distinct from v_replay_claim.decided_at
         or v_approved_event.processing_status <> 'pending'
         or v_approved_event.is_historical
         or v_approved_event.fanout_suppressed
         or v_approved_event.payload is distinct from pg_catalog.jsonb_build_object(
           'claim_id', v_replay_claim.id,
           'supplier_profile_id', v_replay_claim.supplier_profile_id,
           'claimant_user_profile_id', v_replay_claim.claimant_user_profile_id,
           'ownership_id', v_replay_ownership.id,
           'claim_version', v_result_version
         )
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      select coalesce(pg_catalog.array_agg(event_row.event_ordinal order by event_row.event_ordinal), '{}'::integer[]),
             coalesce(pg_catalog.array_agg(event_row.aggregate_id order by event_row.event_ordinal), '{}'::uuid[])
      into v_expected_ordinals, v_event_claim_ids
      from internal.domain_events as event_row
      where event_row.producer_idempotency_key_id = v_idempotency.id
        and event_row.event_ordinal >= 2;

      if v_expected_ordinals is distinct from coalesce(
           (select pg_catalog.array_agg(value) from pg_catalog.generate_series(2, v_superseded_count + 1) as value),
           '{}'::integer[]
         )
         or v_event_claim_ids is distinct from coalesce(
           (select pg_catalog.array_agg(event_row.aggregate_id order by event_row.aggregate_id)
            from internal.domain_events as event_row
            where event_row.producer_idempotency_key_id = v_idempotency.id
              and event_row.event_ordinal >= 2),
           '{}'::uuid[]
         )
         or exists (
           select 1
           from internal.domain_events as event_row
           left join public.supplier_ownership_claims as claim_row
             on claim_row.id = event_row.aggregate_id
           where event_row.producer_idempotency_key_id = v_idempotency.id
             and event_row.event_ordinal >= 2
             and (
               event_row.event_type <> 'supplier_ownership.claim_superseded'
               or event_row.event_schema_version <> 1
               or event_row.aggregate_type <> 'supplier_ownership_claim'
               or claim_row.id is null
               or claim_row.supplier_profile_id <> v_replay_claim.supplier_profile_id
               or claim_row.status <> 'superseded'
               or claim_row.superseded_by_claim_id is distinct from v_replay_claim.id
               or claim_row.supersession_reason_code <> 'competing_claim_superseded_by_approval'
               or claim_row.superseded_at is distinct from v_replay_claim.decided_at
               or event_row.aggregate_sequence <> claim_row.record_version
               or event_row.producer_command_name <> 'supplier_claim.approve'
               or event_row.producer_command_contract_version <> 1
               or event_row.source_system_code <> 'mujahiz'
               or event_row.actor_kind <> 'human_user'
               or event_row.actor_user_profile_id is distinct from v_idempotency.principal_user_profile_id
               or event_row.environment_code <> 'local'
               or event_row.producing_component_code <> 'supplier_claim_command'
               or event_row.occurred_at is distinct from v_replay_claim.decided_at
               or event_row.persisted_at is distinct from v_replay_claim.decided_at
               or event_row.available_at is distinct from v_replay_claim.decided_at
               or event_row.processing_status <> 'pending'
               or event_row.is_historical
               or event_row.fanout_suppressed
               or event_row.payload is distinct from pg_catalog.jsonb_build_object(
                 'claim_id', claim_row.id,
                 'supplier_profile_id', claim_row.supplier_profile_id,
                 'claimant_user_profile_id', claim_row.claimant_user_profile_id,
                 'approved_claim_id', v_replay_claim.id,
                 'claim_version', claim_row.record_version
               )
             )
         )
         or (select pg_catalog.count(*)
             from public.supplier_ownership_claims as claim_row
             where claim_row.superseded_by_claim_id = v_replay_claim.id
               and claim_row.supersession_reason_code = 'competing_claim_superseded_by_approval'
               and claim_row.superseded_at = v_replay_claim.decided_at) <> v_superseded_count
         or exists (
           select 1
           from public.supplier_ownership_claims as claim_row
           where claim_row.superseded_by_claim_id = v_replay_claim.id
             and claim_row.supersession_reason_code = 'competing_claim_superseded_by_approval'
             and claim_row.superseded_at = v_replay_claim.decided_at
             and not (claim_row.id = any(v_event_claim_ids))
         )
         or exists (
           select 1
           from public.supplier_ownership_claims as claim_row
           where claim_row.supplier_profile_id = v_replay_claim.supplier_profile_id
             and claim_row.status in ('submitted', 'under_review')
         )
      then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;

      v_reference_binding := pg_catalog.encode(
        extensions.hmac(
          pg_catalog.convert_to(
            'claim-approve-evidence-reference-v1|'
              || pg_catalog.jsonb_build_object(
                'restricted_evidence_reference', v_approve_audit.restricted_evidence_reference,
                'evidence_digest', v_approve_audit.evidence_digest,
                'evidence_digest_version', 'claim_approve_evidence_digest_v1'
              )::text,
            'UTF8'
          ),
          pg_catalog.convert_to(v_hmac_key, 'UTF8'),
          'sha256'
        ),
        'hex'
      );
      v_original_request := pg_catalog.jsonb_build_object(
        'claim_id', v_replay_claim.id,
        'expected_claim_version', v_result_version - 1,
        'expected_reviewer_assignment_version', v_replay_claim.reviewer_assignment_version,
        'evidence_verification_method_code', v_replay_claim.evidence_verification_method_code,
        'evidence_verification_version', v_replay_claim.evidence_verification_version,
        'evidence_verification_outcome_code', v_replay_claim.evidence_verification_outcome_code,
        'checked_source_classes', pg_catalog.to_jsonb(v_audit_source_classes),
        'approval_evidence_policy_version', 'claim_approval_evidence_policy_v1',
        'reason_registry_version', 'claim_approval_reason_registry_v1',
        'restricted_evidence_binding', v_reference_binding,
        'evidence_digest_version', 'claim_approve_evidence_digest_v1',
        'disclosure_policy_version', 'claim_approve_disclosure_v1',
        'decision_authorization_policy_version', 'sec-001-claim-v1',
        'supersession_policy_version', 'claim_approval_reason_registry_v1',
        'reviewer_notes_marker', 'null'
      );
      v_original_fingerprint := extensions.hmac(
        pg_catalog.convert_to('claim-request-fingerprint-v1|' || v_original_request::text, 'UTF8'),
        pg_catalog.convert_to(v_hmac_key, 'UTF8'),
        'sha256'
      );
      if v_idempotency.request_fingerprint is distinct from v_original_fingerprint then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;
    end if;

    if v_idempotency.principal_kind <> 'human_user'
       or v_idempotency.principal_user_profile_id is distinct from v_request.reviewer_user_profile_id
       or v_idempotency.principal_source_code is not null
       or v_idempotency.target_aggregate_type <> 'supplier_ownership_claim'
       or v_idempotency.target_aggregate_id is distinct from p_claim_id
       or v_idempotency.key_digest_key_version <> 'local_v1'
       or v_idempotency.request_fingerprint is distinct from v_request.request_fingerprint
       or v_idempotency.request_fingerprint_key_version <> 'local_v1'
    then
      begin
        insert into internal.audit_logs (
          action_code, action_contract_version, action_class,
          actor_kind, actor_user_profile_id,
          target_entity_type, target_id,
          occurred_at, recorded_at, environment_code, source_system_code,
          producing_component_code, source_operation_class,
          outcome_class, result_code, reason_code, correlation_id,
          idempotency_reference, audit_schema_version,
          action_evidence_schema_version, authorization_policy_version,
          producer_contract_version, minimization_policy_version, retention_class
        ) values (
          'supplier_claim.approve', 1, 'claim_ownership',
          'human_user', v_request.reviewer_user_profile_id,
          'supplier_ownership_claim', p_claim_id,
          v_now, v_now, 'local', 'mujahiz',
          'supplier_claim_command', 'idempotency_conflict',
          'conflicted', 'idempotency_key_conflict', 'idempotency_key_conflict',
          coalesce(p_correlation_id, pg_catalog.gen_random_uuid()), v_idempotency.id,
          'audit_log_v1', 'claim_approve_denial_v1',
          'sec-001-claim-v1', 'supplier_claim.approve.v1',
          'aud-001-minimized-v1', 'claim_ownership_decision'
        );
      exception when others then
        raise exception using errcode = 'P5116', message = 'audit_unavailable';
      end;

      return query select
        'idempotency_key_conflict'::text, null::uuid,
        'supplier_claim.approve'::text, 1,
        'idempotency_key_conflict'::text, p_claim_id,
        null::text, null::integer, null::uuid, null::uuid,
        null::timestamptz, null::integer, false;
      return;
    end if;

    if v_idempotency.status = 'completed' then
      return query select
        'replay'::text, null::uuid,
        'supplier_claim.approve'::text, 1, 'approved'::text,
        v_replay_claim.id, 'approved'::text, v_result_version,
        v_replay_claim.supplier_profile_id, v_replay_ownership.id,
        v_replay_claim.decided_at, v_superseded_count, true;
      return;
    elsif v_idempotency.status = 'processing' then
      if v_idempotency.lease_expires_at > v_now then
        raise exception using errcode = 'P5109', message = 'command_in_progress';
      end if;
      if v_idempotency.attempt_count >= 10 then
        update internal.idempotency_keys as row_value
        set status = 'failed', lease_token_digest = null,
            lease_digest_key_version = null, lease_expires_at = null,
            failure_code = 'attempt_limit_exceeded', retry_disposition = 'terminal',
            next_attempt_at = null, failed_at = v_now
        where row_value.id = v_idempotency.id;
        return query select
          'reconciliation_required'::text, null::uuid,
          'supplier_claim.approve'::text, 1,
          'reconciliation_required'::text, p_claim_id,
          null::text, null::integer, null::uuid, null::uuid,
          null::timestamptz, null::integer, false;
        return;
      end if;
      update internal.idempotency_keys as row_value
      set lease_token_digest = v_fence_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_now + interval '60 seconds',
          attempt_count = row_value.attempt_count + 1
      where row_value.id = v_idempotency.id;
    elsif v_idempotency.status = 'failed' then
      if v_idempotency.retry_disposition = 'terminal' then
        if v_idempotency.failure_code in (
             'actor_not_authorized', 'reviewer_conflict', 'claimant_ineligible',
             'supplier_ineligible', 'supplier_already_owned',
             'integrity_reconciliation_required'
           )
        then
          v_expected_denial_outcome := case v_idempotency.failure_code
            when 'reviewer_conflict' then 'conflicted'
            when 'supplier_already_owned' then 'conflicted'
            when 'integrity_reconciliation_required' then 'failed'
            else 'rejected'
          end;
          select pg_catalog.count(*) into v_audit_count
          from internal.audit_logs as audit_row
          where audit_row.idempotency_reference = v_idempotency.id
            and audit_row.source_operation_class <> 'idempotency_conflict';
          select audit_row.* into v_approve_audit
          from internal.audit_logs as audit_row
          where audit_row.idempotency_reference = v_idempotency.id
            and audit_row.source_operation_class <> 'idempotency_conflict';

          if v_audit_count <> 1
             or not found
             or v_idempotency.lease_token_digest is not null
             or v_idempotency.lease_digest_key_version is not null
             or v_idempotency.lease_expires_at is not null
             or v_idempotency.next_attempt_at is not null
             or v_idempotency.failed_at is null
             or v_idempotency.outcome_code is not null
             or v_idempotency.result_resource_type is not null
             or v_idempotency.result_resource_id is not null
             or v_idempotency.result_version_token is not null
             or v_idempotency.completed_at is not null
             or v_approve_audit.action_code <> 'supplier_claim.approve'
             or v_approve_audit.action_contract_version <> 1
             or v_approve_audit.action_class <> 'claim_ownership'
             or v_approve_audit.actor_kind <> 'human_user'
             or v_approve_audit.actor_user_profile_id is distinct from v_request.reviewer_user_profile_id
             or v_approve_audit.target_entity_type <> 'supplier_ownership_claim'
             or v_approve_audit.target_id is distinct from p_claim_id
             or v_approve_audit.occurred_at is distinct from v_idempotency.failed_at
             or v_approve_audit.recorded_at is distinct from v_idempotency.failed_at
             or v_approve_audit.environment_code <> 'local'
             or v_approve_audit.source_system_code <> 'mujahiz'
             or v_approve_audit.producing_component_code <> 'supplier_claim_command'
             or v_approve_audit.source_operation_class <> 'trusted_command_denial'
             or v_approve_audit.outcome_class is distinct from v_expected_denial_outcome
             or v_approve_audit.result_code is distinct from v_idempotency.failure_code
             or v_approve_audit.reason_code is distinct from v_idempotency.failure_code
             or v_approve_audit.safe_context_schema_version is not null
             or v_approve_audit.safe_context is not null
             or v_approve_audit.idempotency_reference is distinct from v_idempotency.id
             or v_approve_audit.prior_state_code <> 'under_review'
             or v_approve_audit.prior_record_version <> p_expected_claim_version
             or v_approve_audit.result_state_code is not null
             or v_approve_audit.result_record_version is not null
             or v_approve_audit.domain_event_reference is not null
             or v_approve_audit.changed_field_codes is distinct from '{}'::text[]
             or v_approve_audit.evidence_digest is not null
             or v_approve_audit.restricted_evidence_reference is not null
             or v_approve_audit.audit_schema_version <> 'audit_log_v1'
             or v_approve_audit.action_evidence_schema_version <> 'claim_approve_denial_v1'
             or v_approve_audit.authorization_policy_version <> 'sec-001-claim-v1'
             or v_approve_audit.producer_contract_version <> 'supplier_claim.approve.v1'
             or v_approve_audit.minimization_policy_version <> 'aud-001-minimized-v1'
             or v_approve_audit.retention_class <> 'claim_ownership_decision'
          then
            raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
          end if;

          return query select
            'replay'::text, null::uuid,
            'supplier_claim.approve'::text, 1,
            v_idempotency.failure_code, p_claim_id,
            null::text, null::integer, null::uuid, null::uuid,
            null::timestamptz, null::integer, true;
          return;
        end if;
        return query select
          'reconciliation_required'::text, null::uuid,
          'supplier_claim.approve'::text, 1,
          'reconciliation_required'::text, p_claim_id,
          null::text, null::integer, null::uuid, null::uuid,
          null::timestamptz, null::integer, false;
        return;
      end if;
      if v_idempotency.next_attempt_at > v_now then
        raise exception using errcode = 'P5110', message = 'retry_later';
      end if;
      if v_idempotency.attempt_count >= 10 then
        update internal.idempotency_keys as row_value
        set failure_code = 'attempt_limit_exceeded', retry_disposition = 'terminal',
            next_attempt_at = null, failed_at = v_now
        where row_value.id = v_idempotency.id;
        return query select
          'reconciliation_required'::text, null::uuid,
          'supplier_claim.approve'::text, 1,
          'reconciliation_required'::text, p_claim_id,
          null::text, null::integer, null::uuid, null::uuid,
          null::timestamptz, null::integer, false;
        return;
      end if;
      update internal.idempotency_keys as row_value
      set status = 'processing', lease_token_digest = v_fence_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_now + interval '60 seconds',
          attempt_count = row_value.attempt_count + 1,
          failure_code = null, retry_disposition = null,
          next_attempt_at = null, failed_at = null
      where row_value.id = v_idempotency.id;
    else
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;
  end if;

  return query select
    'execute'::text, v_fence,
    'supplier_claim.approve'::text, 1, null::text,
    p_claim_id, null::text, null::integer, null::uuid, null::uuid,
    null::timestamptz, null::integer, false;
  return;
exception
  when sqlstate 'P5100' or sqlstate 'P5101' or sqlstate 'P5109'
    or sqlstate 'P5110' or sqlstate 'P5116' or sqlstate 'P5199' then raise;
  when others then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
end
$function$;

comment on function supplier_claim.approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid
) is
  'Trusted approve-v1 business boundary and durable Phase-A reservation/replay. Its exact signature accepts no caller-selected actor, Supplier, claimant, ownership, reason, role, time, digest, reviewer note, event, audit, or execution fence.';

alter function supplier_claim.approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid
) owner to postgres;
revoke all on function supplier_claim.approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid
) from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim.approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid
) to mujahiz_claim_runtime;

create function supplier_claim._execute_approve(
  p_idempotency_key text,
  p_claim_id uuid,
  p_expected_claim_version integer,
  p_expected_reviewer_assignment_version integer,
  p_evidence_verification_method_code text,
  p_evidence_verification_version text,
  p_evidence_verification_outcome_code text,
  p_checked_source_classes text[],
  p_restricted_evidence_reference text,
  p_correlation_id uuid,
  p_execution_fence uuid
)
returns table (
  command text,
  command_contract_version integer,
  outcome_code text,
  claim_id uuid,
  claim_status text,
  claim_version integer,
  supplier_profile_id uuid,
  ownership_id uuid,
  decided_at timestamptz,
  superseded_claim_count integer,
  idempotent_replay boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_request record;
  v_hmac_key text;
  v_fence_digest bytea;
  v_reservation_now timestamptz;
  v_command_now timestamptz;
  v_idempotency internal.idempotency_keys%rowtype;
  v_routed_claimant_id uuid;
  v_routed_supplier_id uuid;
  v_lock_principal_id uuid;
  v_supplier public.supplier_profiles%rowtype;
  v_claim public.supplier_ownership_claims%rowtype;
  v_competitor public.supplier_ownership_claims%rowtype;
  v_reviewer_decision text;
  v_reviewer_role text;
  v_reviewer_conflict text;
  v_active_ownership_count integer := 0;
  v_invalid_history_count integer := 0;
  v_claimant_eligibility_count integer := 0;
  v_current_role_count integer := 0;
  v_current_access_count integer := 0;
  v_current_security_count integer := 0;
  v_invalid_competitor_count integer := 0;
  v_attempt_count integer;
  v_result_version integer;
  v_competitor_result_version integer;
  v_ownership_id uuid;
  v_event_id uuid;
  v_primary_event_id uuid;
  v_audit_id uuid;
  v_correlation_id uuid;
  v_competitor_ids uuid[] := '{}'::uuid[];
  v_competitor_id uuid;
  v_event_ordinal integer := 1;
  v_superseded_count integer := 0;
  v_updated_count integer;
  v_denial_code text;
  v_denial_outcome_class text;
begin
  select canonical.* into v_request
  from supplier_claim._canonicalize_approve_request_v1(
    p_idempotency_key,
    p_claim_id,
    p_expected_claim_version,
    p_expected_reviewer_assignment_version,
    p_evidence_verification_method_code,
    p_evidence_verification_version,
    p_evidence_verification_outcome_code,
    p_checked_source_classes,
    p_restricted_evidence_reference
  ) as canonical;
  if not found or p_execution_fence is null then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_hmac_key := nullif(pg_catalog.current_setting('mujahiz.claim.hmac_key', true), '');
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using errcode = 'P5100', message = 'claim_context_invalid';
  end if;

  v_fence_digest := extensions.hmac(
    pg_catalog.convert_to('claim-approve-fence-v1|' || p_execution_fence::text, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  v_reservation_now := pg_catalog.clock_timestamp();

  select row_value.* into v_idempotency
  from internal.idempotency_keys as row_value
  where row_value.environment_code = 'local'
    and row_value.command_name = 'supplier_claim.approve'
    and row_value.command_contract_version = 1
    and row_value.key_digest = v_request.key_digest
  for update;

  if not found then
    raise exception using errcode = 'P5110', message = 'retry_later';
  end if;
  if v_idempotency.principal_kind <> 'human_user'
     or v_idempotency.principal_user_profile_id is distinct from v_request.reviewer_user_profile_id
     or v_idempotency.principal_source_code is not null
     or v_idempotency.target_aggregate_type <> 'supplier_ownership_claim'
     or v_idempotency.target_aggregate_id is distinct from p_claim_id
     or v_idempotency.key_digest_key_version <> 'local_v1'
     or v_idempotency.request_fingerprint is distinct from v_request.request_fingerprint
     or v_idempotency.request_fingerprint_key_version <> 'local_v1'
  then
    raise exception using errcode = 'P5108', message = 'idempotency_key_conflict';
  end if;
  if v_idempotency.status = 'failed'
     and v_idempotency.retry_disposition = 'terminal'
  then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;
  if v_idempotency.status <> 'processing'
     or v_idempotency.lease_expires_at <= v_reservation_now
  then
    raise exception using errcode = 'P5110', message = 'retry_later';
  end if;
  if v_idempotency.lease_digest_key_version <> 'local_v1'
     or v_idempotency.lease_token_digest is distinct from v_fence_digest
  then
    raise exception using errcode = 'P5109', message = 'command_in_progress';
  end if;
  v_attempt_count := v_idempotency.attempt_count;

  select claim_row.claimant_user_profile_id, claim_row.supplier_profile_id
  into v_routed_claimant_id, v_routed_supplier_id
  from public.supplier_ownership_claims as claim_row
  where claim_row.id = p_claim_id;

  if not found then
    raise exception using errcode = 'P5111', message = 'claim_not_found';
  end if;

  for v_lock_principal_id in
    select lock_principal.principal_id
    from (
      values (v_request.reviewer_user_profile_id), (v_routed_claimant_id)
    ) as lock_principal(principal_id)
    where lock_principal.principal_id is not null
    group by lock_principal.principal_id
    order by lock_principal.principal_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      claim_security.claim_principal_lock_key_v1(v_lock_principal_id)
    );
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    claim_security.claim_supplier_lock_key_v1(v_routed_supplier_id)
  );

  perform 1
  from public.user_profiles as row_value
  where row_value.id in (v_request.reviewer_user_profile_id, v_routed_claimant_id)
  order by row_value.id
  for update;

  perform 1
  from internal.identity_provider_links as row_value
  where row_value.user_profile_id in (v_request.reviewer_user_profile_id, v_routed_claimant_id)
  order by row_value.id
  for update;

  perform 1
  from public.platform_role_assignments as row_value
  where row_value.user_profile_id = v_request.reviewer_user_profile_id
  order by row_value.id
  for update;

  perform 1
  from public.access_grants as row_value
  where row_value.user_profile_id = v_request.reviewer_user_profile_id
  order by row_value.id
  for update;

  perform 1
  from internal.security_eligibility_assessments as row_value
  where row_value.user_profile_id = v_request.reviewer_user_profile_id
  order by row_value.id
  for update;

  select supplier_row.* into v_supplier
  from public.supplier_profiles as supplier_row
  where supplier_row.id = v_routed_supplier_id
  for update;
  if not found then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;

  perform 1
  from public.supplier_ownerships as ownership_row
  where ownership_row.supplier_profile_id = v_routed_supplier_id
  order by ownership_row.id
  for update;

  -- The Supplier lock is acquired first; then every Claim for that Supplier is
  -- locked in deterministic UUID order. This covers both the complete active
  -- competing set and every historical approved Claim reconciled below.
  perform 1
  from public.supplier_ownership_claims as claim_row
  where claim_row.supplier_profile_id = v_routed_supplier_id
  order by claim_row.id
  for update;

  select claim_row.* into v_claim
  from public.supplier_ownership_claims as claim_row
  where claim_row.id = p_claim_id;
  if not found
     or v_claim.claimant_user_profile_id <> v_routed_claimant_id
     or v_claim.supplier_profile_id <> v_routed_supplier_id
  then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;

  select coalesce(pg_catalog.array_agg(claim_row.id order by claim_row.id), '{}'::uuid[])
  into v_competitor_ids
  from public.supplier_ownership_claims as claim_row
  where claim_row.supplier_profile_id = v_routed_supplier_id
    and claim_row.id <> p_claim_id
    and claim_row.status in ('submitted', 'under_review');

  -- No separate approval-evidence, quarantine, hold, or file table exists in
  -- the approved local model. Conflict facts are the already locked rows.
  v_command_now := pg_catalog.clock_timestamp();

  if v_claim.record_version <> p_expected_claim_version then
    raise exception using errcode = 'P5112', message = 'claim_version_conflict';
  end if;
  if v_claim.status <> 'under_review' then
    raise exception using errcode = 'P5113', message = 'claim_not_actionable';
  end if;
  if v_claim.reviewer_assignment_version <> p_expected_reviewer_assignment_version then
    raise exception using errcode = 'P5112', message = 'claim_version_conflict';
  end if;

  if v_claim.reviewer_user_profile_id is null
     or v_claim.reviewer_assignment_version <> 1
     or v_claim.reviewer_assigned_at is null
     or v_claim.reviewer_assigned_by_user_profile_id is null
     or v_claim.reviewer_assignment_source_code <> 'owner_assignment'
     or v_claim.reviewer_assignment_policy_version <> 'claim_reviewer_assignment_v1'
     or v_claim.reviewer_user_profile_id = v_claim.claimant_user_profile_id
     or v_claim.reviewer_user_profile_id = v_claim.reviewer_assigned_by_user_profile_id
     or v_claim.reviewer_assigned_at < v_claim.submitted_at
     or v_claim.reviewer_assigned_at >= v_claim.expires_at
     or v_claim.expires_at <> v_claim.submitted_at + interval '720 hours'
     or v_claim.created_at <> v_claim.submitted_at
     or v_claim.updated_at < v_claim.reviewer_assigned_at
     or v_claim.claimant_snapshot_schema_version <> 'claimant_snapshot_v1'
     or v_claim.submission_fingerprint_version <> 'claim_submit_v1'
     or v_claim.submission_fingerprint !~ '^[0-9a-f]{64}$'
     or v_claim.evidence_schema_version <> 'claim_evidence_v1'
     or v_claim.decided_by_user_profile_id is not null
     or v_claim.decided_at is not null
     or v_claim.decision_reason_code is not null
     or v_claim.evidence_verification_method_code is not null
     or v_claim.evidence_verification_version is not null
     or v_claim.evidence_verification_outcome_code is not null
     or v_claim.decision_authorization_policy_version is not null
     or v_claim.reviewer_notes is not null
     or v_claim.withdrawn_at is not null
     or v_claim.withdrawn_by_user_profile_id is not null
     or v_claim.withdrawal_reason_code is not null
     or v_claim.expired_at is not null
     or v_claim.expiry_system_source_code is not null
     or v_claim.expiry_policy_version is not null
     or v_claim.superseded_at is not null
     or v_claim.supersession_reason_code is not null
     or v_claim.superseded_by_claim_id is not null
     or v_claim.resulting_supplier_ownership_id is not null
  then
    v_denial_code := 'integrity_reconciliation_required';
    v_denial_outcome_class := 'failed';
  elsif v_command_now >= v_claim.expires_at then
    raise exception using errcode = 'P5114', message = 'claim_expired';
  elsif v_claim.reviewer_user_profile_id <> v_request.reviewer_user_profile_id then
    v_denial_code := 'actor_not_authorized';
    v_denial_outcome_class := 'rejected';
  end if;

  if v_denial_code is null then
    select pg_catalog.count(*) into v_invalid_history_count
    from public.supplier_ownership_claims as approved_claim
    left join public.supplier_ownerships as ownership_row
      on ownership_row.id = approved_claim.resulting_supplier_ownership_id
    where approved_claim.supplier_profile_id = v_routed_supplier_id
      and approved_claim.status = 'approved'
      and (
        -- Immutable submission and terminal-state coherence.
        approved_claim.record_version <> 3
        or approved_claim.expires_at is distinct from
          approved_claim.submitted_at + interval '720 hours'
        or approved_claim.created_at is distinct from approved_claim.submitted_at
        or approved_claim.claimant_snapshot_schema_version is distinct from
          'claimant_snapshot_v1'
        or approved_claim.submission_fingerprint_version is distinct from
          'claim_submit_v1'
        or approved_claim.submission_fingerprint is null
        or approved_claim.submission_fingerprint !~ '^[0-9a-f]{64}$'
        or approved_claim.evidence_schema_version is distinct from
          'claim_evidence_v1'
        or approved_claim.withdrawn_at is not null
        or approved_claim.withdrawn_by_user_profile_id is not null
        or approved_claim.withdrawal_reason_code is not null
        or approved_claim.expired_at is not null
        or approved_claim.expiry_system_source_code is not null
        or approved_claim.expiry_policy_version is not null
        or approved_claim.superseded_at is not null
        or approved_claim.supersession_reason_code is not null
        or approved_claim.superseded_by_claim_id is not null
        or approved_claim.reviewer_notes is not null

        -- Write-once reviewer assignment coherence.
        or approved_claim.reviewer_user_profile_id is null
        or approved_claim.reviewer_assignment_version is distinct from 1
        or approved_claim.reviewer_assigned_at is null
        or approved_claim.reviewer_assigned_by_user_profile_id is null
        or approved_claim.reviewer_assignment_source_code is distinct from
          'owner_assignment'
        or approved_claim.reviewer_assignment_policy_version is distinct from
          'claim_reviewer_assignment_v1'
        or approved_claim.reviewer_user_profile_id =
          approved_claim.claimant_user_profile_id
        or approved_claim.reviewer_user_profile_id =
          approved_claim.reviewer_assigned_by_user_profile_id
        or approved_claim.reviewer_assigned_at < approved_claim.submitted_at
        or approved_claim.reviewer_assigned_at >= approved_claim.expires_at

        -- Approval decision and supported evidence tuple.
        or approved_claim.decided_at is null
        or approved_claim.decided_by_user_profile_id is distinct from approved_claim.reviewer_user_profile_id
        or approved_claim.decided_at < approved_claim.reviewer_assigned_at
        or approved_claim.decided_at >= approved_claim.expires_at
        or approved_claim.updated_at is distinct from approved_claim.decided_at
        or approved_claim.decision_reason_code is distinct from
          'verified_claim_approved'
        or approved_claim.evidence_verification_method_code is distinct from
          'manual_review'
        or approved_claim.evidence_verification_version is distinct from
          'claim_evidence_review_v1'
        or approved_claim.evidence_verification_outcome_code is distinct from
          'verified'
        or approved_claim.decision_authorization_policy_version is distinct from
          'claim_approval_reason_registry_v1'
        or approved_claim.resulting_supplier_ownership_id is null

        -- Resulting ownership establishment and closed-history lifecycle.
        or ownership_row.id is null
        or ownership_row.supplier_profile_id is distinct from approved_claim.supplier_profile_id
        or ownership_row.controller_user_profile_id is distinct from approved_claim.claimant_user_profile_id
        or ownership_row.authority_type is distinct from 'primary_controller'
        or ownership_row.ownership_status not in (
          'active', 'transferred', 'revoked', 'superseded'
        )
        or ownership_row.establishment_source_type is distinct from
          'claim_approval'
        or ownership_row.establishment_reason_code is distinct from
          'verified_claim_approved'
        or ownership_row.established_by_user_profile_id is distinct from approved_claim.reviewer_user_profile_id
        or ownership_row.establishment_system_source is not null
        or ownership_row.valid_from is distinct from approved_claim.decided_at
        or ownership_row.established_at is distinct from approved_claim.decided_at
        or ownership_row.created_at is distinct from approved_claim.decided_at
        or ownership_row.created_by_user_profile_id is distinct from approved_claim.reviewer_user_profile_id
        or ownership_row.updated_at < ownership_row.created_at
        or (
          ownership_row.ownership_status = 'active'
          and not (
            ownership_row.record_version = 1
            and ownership_row.valid_until is null
            and ownership_row.closure_reason_code is null
            and ownership_row.closed_by_user_profile_id is null
            and ownership_row.closure_system_source is null
            and ownership_row.closed_at is null
            and ownership_row.transfer_successor_ownership_id is null
            and ownership_row.updated_at = ownership_row.created_at
            and ownership_row.updated_by_user_profile_id is not distinct from
              approved_claim.reviewer_user_profile_id
          )
        )
        or (
          ownership_row.ownership_status in ('transferred', 'revoked', 'superseded')
          and not (
            ownership_row.record_version >= 2
            and ownership_row.valid_until is not null
            and ownership_row.valid_until > ownership_row.valid_from
            and ownership_row.closure_reason_code is not null
            and ownership_row.closed_at is not null
            and ownership_row.closed_at >= ownership_row.valid_from
            and ownership_row.updated_at >= ownership_row.closed_at
            and (
              ownership_row.closed_by_user_profile_id is not null
            ) <> (
              ownership_row.closure_system_source is not null
            )
            and (
              ownership_row.ownership_status = 'transferred'
            ) = (
              ownership_row.transfer_successor_ownership_id is not null
            )
          )
        )
        or (
          ownership_row.ownership_status = 'transferred'
          and not exists (
            select 1
            from public.supplier_ownerships as successor_ownership
            where successor_ownership.id =
                ownership_row.transfer_successor_ownership_id
              and successor_ownership.supplier_profile_id =
                ownership_row.supplier_profile_id
              and successor_ownership.valid_from = ownership_row.valid_until
          )
        )

        -- A current v1 approval is corroborated by exactly one bounded primary
        -- audit carrying an allowlisted source path and the approved reason
        -- registry. Historical source classes are private audit evidence.
        or (
          select pg_catalog.count(*)
          from internal.audit_logs as approval_audit
          where approval_audit.action_code = 'supplier_claim.approve'
            and approval_audit.source_operation_class = 'trusted_command'
            and approval_audit.target_entity_type =
              'supplier_ownership_claim'
            and approval_audit.target_id = approved_claim.id
        ) <> 1
        or not exists (
          select 1
          from internal.audit_logs as approval_audit
          join internal.idempotency_keys as approval_idempotency
            on approval_idempotency.id =
              approval_audit.idempotency_reference
          join internal.domain_events as approval_event
            on approval_event.id = approval_audit.domain_event_reference
          where approval_audit.action_code = 'supplier_claim.approve'
            and approval_audit.action_contract_version = 1
            and approval_audit.action_class = 'claim_ownership'
            and approval_audit.actor_kind = 'human_user'
            and approval_audit.actor_user_profile_id =
              approved_claim.reviewer_user_profile_id
            and approval_audit.actor_authorization_snapshot in ('owner', 'admin')
            and approval_audit.target_entity_type =
              'supplier_ownership_claim'
            and approval_audit.target_id = approved_claim.id
            and approval_audit.related_target_entity_type =
              'supplier_profile'
            and approval_audit.related_target_id =
              approved_claim.supplier_profile_id
            and approval_audit.occurred_at = approved_claim.decided_at
            and approval_audit.recorded_at = approved_claim.decided_at
            and approval_audit.environment_code = 'local'
            and approval_audit.source_system_code = 'mujahiz'
            and approval_audit.producing_component_code =
              'supplier_claim_command'
            and approval_audit.source_operation_class = 'trusted_command'
            and approval_audit.outcome_class = 'succeeded'
            and approval_audit.result_code = 'approved'
            and approval_audit.reason_code = 'verified_claim_approved'
            and approval_audit.safe_context_schema_version =
              'claim_approve_context_v1'
            and (
              select pg_catalog.count(*)
              from pg_catalog.jsonb_object_keys(approval_audit.safe_context)
            ) = 19
            and approval_audit.safe_context -> 'reason_registry_version' =
              pg_catalog.to_jsonb('claim_approval_reason_registry_v1'::text)
            and approval_audit.safe_context ->
              'approval_evidence_policy_version' =
              pg_catalog.to_jsonb('claim_approval_evidence_policy_v1'::text)
            and approval_audit.safe_context ->
              'evidence_verification_method_code' =
              pg_catalog.to_jsonb(approved_claim.evidence_verification_method_code)
            and approval_audit.safe_context ->
              'evidence_verification_version' =
              pg_catalog.to_jsonb(approved_claim.evidence_verification_version)
            and approval_audit.safe_context ->
              'evidence_verification_outcome_code' =
              pg_catalog.to_jsonb(approved_claim.evidence_verification_outcome_code)
            and approval_audit.safe_context -> 'checked_source_classes' in (
              '["authorized_officer_confirmation"]'::jsonb,
              '["claimant_authority","official_registry"]'::jsonb,
              '["company_domain_challenge","independent_supplier_corroboration"]'::jsonb
            )
            and approval_audit.safe_context -> 'evidence_digest_version' =
              pg_catalog.to_jsonb('claim_approve_evidence_digest_v1'::text)
            and approval_audit.safe_context -> 'disclosure_policy_version' =
              pg_catalog.to_jsonb('claim_approve_disclosure_v1'::text)
            and approval_audit.safe_context ->
              'decision_authorization_policy_version' =
              pg_catalog.to_jsonb('sec-001-claim-v1'::text)
            and approval_audit.safe_context -> 'reviewer_role_code' =
              pg_catalog.to_jsonb(approval_audit.actor_authorization_snapshot)
            and approval_audit.safe_context -> 'reviewer_conflict_result' =
              pg_catalog.to_jsonb('clear'::text)
            and approval_audit.safe_context -> 'provider_state_version' =
              pg_catalog.to_jsonb('firebase-provider-state-v1'::text)
            and approval_audit.safe_context -> 'role_policy_version' =
              pg_catalog.to_jsonb('platform-role-policy-v1'::text)
            and approval_audit.safe_context -> 'access_policy_version' =
              pg_catalog.to_jsonb('platform-access-policy-v1'::text)
            and approval_audit.safe_context -> 'security_policy_version' =
              pg_catalog.to_jsonb('platform-admin-security-v1'::text)
            and approval_audit.safe_context -> 'security_coverage_version' =
              pg_catalog.to_jsonb('platform-admin-coverage-v1'::text)
            and approval_audit.safe_context -> 'evidence_minimization_version' =
              pg_catalog.to_jsonb('platform-admin-minimization-v1'::text)
            and approval_audit.safe_context ->
              'resulting_supplier_ownership_id' =
              pg_catalog.to_jsonb(ownership_row.id)
            and pg_catalog.jsonb_typeof(
              approval_audit.safe_context -> 'superseded_claim_count'
            ) = 'number'
            and coalesce(
              approval_audit.safe_context ->> 'superseded_claim_count'
                !~ '^(0|[1-9][0-9]*)$',
              true
            ) = false
            and approval_audit.prior_state_code = 'under_review'
            and approval_audit.result_state_code = 'approved'
            and approval_audit.prior_record_version =
              approved_claim.record_version - 1
            and approval_audit.result_record_version =
              approved_claim.record_version
            and approval_audit.changed_field_codes is not distinct from array[
              'status', 'record_version', 'decided_by_user_profile_id', 'decided_at',
              'decision_reason_code', 'evidence_verification_method_code',
              'evidence_verification_version', 'evidence_verification_outcome_code',
              'decision_authorization_policy_version',
              'resulting_supplier_ownership_id'
            ]::text[]
            and approval_audit.evidence_digest = pg_catalog.encode(
              extensions.digest(
                pg_catalog.convert_to(
                  'claim-approve-evidence-digest-v1|'
                    || pg_catalog.octet_length(
                      approval_audit.restricted_evidence_reference
                    )::text
                    || ':' || approval_audit.restricted_evidence_reference,
                  'UTF8'
                ),
                'sha256'
              ),
              'hex'
            )
            and approval_audit.evidence_digest_algorithm = 'sha256'
            and approval_audit.evidence_digest_version =
              'claim_approve_evidence_digest_v1'
            and approval_audit.restricted_evidence_reference is not null
            and pg_catalog.octet_length(
              approval_audit.restricted_evidence_reference
            ) between 1 and 256
            and approval_audit.audit_schema_version = 'audit_log_v1'
            and approval_audit.action_evidence_schema_version =
              'claim_approve_success_v1'
            and approval_audit.authorization_policy_version =
              'sec-001-claim-v1'
            and approval_audit.producer_contract_version =
              'supplier_claim.approve.v1'
            and approval_audit.minimization_policy_version =
              'aud-001-minimized-v1'
            and approval_audit.retention_class =
              'claim_ownership_decision'
            and approval_idempotency.environment_code = 'local'
            and approval_idempotency.command_name = 'supplier_claim.approve'
            and approval_idempotency.command_contract_version = 1
            and approval_idempotency.principal_kind = 'human_user'
            and approval_idempotency.principal_user_profile_id =
              approved_claim.reviewer_user_profile_id
            and approval_idempotency.target_aggregate_type =
              'supplier_ownership_claim'
            and approval_idempotency.target_aggregate_id = approved_claim.id
            and approval_idempotency.status = 'completed'
            and approval_idempotency.outcome_code = 'approved'
            and approval_idempotency.result_resource_type =
              'supplier_ownership_claim'
            and approval_idempotency.result_resource_id = approved_claim.id
            and approval_idempotency.result_version_token =
              approved_claim.record_version::text
            and approval_idempotency.completed_at is not distinct from
              approved_claim.decided_at
            and approval_idempotency.principal_source_code is null
            and approval_idempotency.upstream_source_system_code is null
            and approval_idempotency.upstream_request_identity is null
            and pg_catalog.octet_length(approval_idempotency.key_digest) = 32
            and approval_idempotency.key_digest_key_version = 'local_v1'
            and pg_catalog.octet_length(
              approval_idempotency.request_fingerprint
            ) = 32
            and approval_idempotency.request_fingerprint_key_version =
              'local_v1'
            and approval_idempotency.request_fingerprint is not distinct from
              extensions.hmac(
                pg_catalog.convert_to(
                  'claim-request-fingerprint-v1|'
                    || pg_catalog.jsonb_build_object(
                      'claim_id', approved_claim.id,
                      'expected_claim_version',
                        approved_claim.record_version - 1,
                      'expected_reviewer_assignment_version',
                        approved_claim.reviewer_assignment_version,
                      'evidence_verification_method_code',
                        approved_claim.evidence_verification_method_code,
                      'evidence_verification_version',
                        approved_claim.evidence_verification_version,
                      'evidence_verification_outcome_code',
                        approved_claim.evidence_verification_outcome_code,
                      'checked_source_classes',
                        approval_audit.safe_context ->
                          'checked_source_classes',
                      'approval_evidence_policy_version',
                        'claim_approval_evidence_policy_v1',
                      'reason_registry_version',
                        'claim_approval_reason_registry_v1',
                      'restricted_evidence_binding',
                        pg_catalog.encode(
                          extensions.hmac(
                            pg_catalog.convert_to(
                              'claim-approve-evidence-reference-v1|'
                                || pg_catalog.jsonb_build_object(
                                  'restricted_evidence_reference',
                                    approval_audit.restricted_evidence_reference,
                                  'evidence_digest',
                                    approval_audit.evidence_digest,
                                  'evidence_digest_version',
                                    'claim_approve_evidence_digest_v1'
                                )::text,
                              'UTF8'
                            ),
                            pg_catalog.convert_to(v_hmac_key, 'UTF8'),
                            'sha256'
                          ),
                          'hex'
                        ),
                      'evidence_digest_version',
                        'claim_approve_evidence_digest_v1',
                      'disclosure_policy_version',
                        'claim_approve_disclosure_v1',
                      'decision_authorization_policy_version',
                        'sec-001-claim-v1',
                      'supersession_policy_version',
                        'claim_approval_reason_registry_v1',
                      'reviewer_notes_marker', 'null'
                    )::text,
                  'UTF8'
                ),
                pg_catalog.convert_to(v_hmac_key, 'UTF8'),
                'sha256'
              )
            and approval_idempotency.lease_token_digest is null
            and approval_idempotency.lease_digest_key_version is null
            and approval_idempotency.lease_expires_at is null
            and approval_idempotency.attempt_count >= 1
            and approval_idempotency.failure_code is null
            and approval_idempotency.retry_disposition is null
            and approval_idempotency.next_attempt_at is null
            and approval_idempotency.failed_at is null
            and approval_idempotency.created_at <= approved_claim.decided_at
            and approval_idempotency.expires_at is not distinct from
              approval_idempotency.created_at + interval '720 hours'
            and approval_idempotency.expires_at > approval_idempotency.completed_at
            and approval_event.event_type =
              'supplier_ownership.claim_approved'
            and approval_event.event_schema_version = 1
            and approval_event.aggregate_type =
              'supplier_ownership_claim'
            and approval_event.aggregate_id = approved_claim.id
            and approval_event.aggregate_sequence =
              approved_claim.record_version
            and approval_event.producer_command_name =
              'supplier_claim.approve'
            and approval_event.producer_command_contract_version = 1
            and approval_event.producer_idempotency_key_id =
              approval_idempotency.id
            and approval_event.event_ordinal = 1
            and approval_event.actor_kind = 'human_user'
            and approval_event.actor_user_profile_id =
              approved_claim.reviewer_user_profile_id
            and approval_event.occurred_at = approved_claim.decided_at
            and approval_event.persisted_at = approved_claim.decided_at
            and approval_event.source_operation_identity is null
            and approval_event.source_system_code = 'mujahiz'
            and approval_event.source_stream_code is null
            and approval_event.source_event_id is null
            and approval_event.actor_source_code is null
            and approval_event.environment_code = 'local'
            and approval_event.producing_component_code =
              'supplier_claim_command'
            and approval_event.correlation_id is not distinct from
              approval_audit.correlation_id
            and approval_event.causation_event_id is null
            and approval_event.available_at = approved_claim.decided_at
            and approval_event.processing_status = 'pending'
            and approval_event.lease_token_digest is null
            and approval_event.lease_digest_key_version is null
            and approval_event.lease_expires_at is null
            and approval_event.attempt_count = 0
            and approval_event.next_attempt_at is null
            and approval_event.last_error_class is null
            and approval_event.last_error_code is null
            and approval_event.processed_at is null
            and approval_event.dead_lettered_at is null
            and not approval_event.is_historical
            and not approval_event.fanout_suppressed
            and approval_event.migration_classification_code is null
            and approval_event.payload is not distinct from
              pg_catalog.jsonb_build_object(
                'claim_id', approved_claim.id,
                'supplier_profile_id', approved_claim.supplier_profile_id,
                'claimant_user_profile_id',
                  approved_claim.claimant_user_profile_id,
                'ownership_id', ownership_row.id,
                'claim_version', approved_claim.record_version
              )
            and (
              select pg_catalog.count(*)::numeric
              from internal.domain_events as produced_event
              where produced_event.producer_idempotency_key_id =
                approval_idempotency.id
            ) = (
              approval_audit.safe_context ->> 'superseded_claim_count'
            )::numeric + 1
            and (
              select pg_catalog.min(produced_event.event_ordinal)
              from internal.domain_events as produced_event
              where produced_event.producer_idempotency_key_id =
                approval_idempotency.id
            ) = 1
            and (
              select pg_catalog.max(produced_event.event_ordinal)::numeric
              from internal.domain_events as produced_event
              where produced_event.producer_idempotency_key_id =
                approval_idempotency.id
            ) = (
              approval_audit.safe_context ->> 'superseded_claim_count'
            )::numeric + 1
            and (
              select pg_catalog.count(
                distinct produced_event.event_ordinal
              )::numeric
              from internal.domain_events as produced_event
              where produced_event.producer_idempotency_key_id =
                approval_idempotency.id
            ) = (
              approval_audit.safe_context ->> 'superseded_claim_count'
            )::numeric + 1
            and (
              select pg_catalog.count(*)
              from internal.domain_events as primary_event
              where primary_event.event_type =
                  'supplier_ownership.claim_approved'
                and primary_event.aggregate_type =
                  'supplier_ownership_claim'
                and primary_event.aggregate_id = approved_claim.id
            ) = 1
            and coalesce(
              (
                select pg_catalog.array_agg(
                  produced_event.aggregate_id
                  order by produced_event.event_ordinal
                )
                from internal.domain_events as produced_event
                where produced_event.producer_idempotency_key_id =
                    approval_idempotency.id
                  and produced_event.event_ordinal >= 2
              ),
              '{}'::uuid[]
            ) is not distinct from coalesce(
              (
                select pg_catalog.array_agg(
                  superseded_claim.id order by superseded_claim.id
                )
                from public.supplier_ownership_claims as superseded_claim
                where superseded_claim.supplier_profile_id =
                    approved_claim.supplier_profile_id
                  and superseded_claim.status = 'superseded'
                  and superseded_claim.superseded_by_claim_id =
                    approved_claim.id
                  and superseded_claim.supersession_reason_code =
                    'competing_claim_superseded_by_approval'
                  and superseded_claim.superseded_at =
                    approved_claim.decided_at
              ),
              '{}'::uuid[]
            )
            and not exists (
              select 1
              from internal.domain_events as produced_event
              left join public.supplier_ownership_claims as superseded_claim
                on superseded_claim.id = produced_event.aggregate_id
              where produced_event.producer_idempotency_key_id =
                  approval_idempotency.id
                and (
                  produced_event.event_ordinal < 1
                  or (
                    produced_event.event_ordinal = 1
                    and produced_event.id is distinct from approval_event.id
                  )
                  or (
                    produced_event.event_ordinal >= 2
                    and (
                      produced_event.event_type is distinct from
                        'supplier_ownership.claim_superseded'
                      or produced_event.event_schema_version is distinct from 1
                      or produced_event.aggregate_type is distinct from
                        'supplier_ownership_claim'
                      or superseded_claim.id is null
                      or superseded_claim.supplier_profile_id is distinct from
                        approved_claim.supplier_profile_id
                      or superseded_claim.status is distinct from 'superseded'
                      or superseded_claim.superseded_by_claim_id is distinct from
                        approved_claim.id
                      or superseded_claim.supersession_reason_code is distinct from
                        'competing_claim_superseded_by_approval'
                      or superseded_claim.superseded_at is distinct from
                        approved_claim.decided_at
                      or produced_event.aggregate_sequence is distinct from
                        superseded_claim.record_version
                      or produced_event.producer_command_name is distinct from
                        'supplier_claim.approve'
                      or produced_event.producer_command_contract_version is
                        distinct from 1
                      or produced_event.source_operation_identity is not null
                      or produced_event.source_system_code is distinct from
                        'mujahiz'
                      or produced_event.source_stream_code is not null
                      or produced_event.source_event_id is not null
                      or produced_event.actor_kind is distinct from 'human_user'
                      or produced_event.actor_user_profile_id is distinct from
                        approved_claim.reviewer_user_profile_id
                      or produced_event.actor_source_code is not null
                      or produced_event.environment_code is distinct from 'local'
                      or produced_event.producing_component_code is distinct from
                        'supplier_claim_command'
                      or produced_event.correlation_id is distinct from
                        approval_audit.correlation_id
                      or produced_event.causation_event_id is not null
                      or produced_event.occurred_at is distinct from
                        approved_claim.decided_at
                      or produced_event.persisted_at is distinct from
                        approved_claim.decided_at
                      or produced_event.available_at is distinct from
                        approved_claim.decided_at
                      or produced_event.processing_status is distinct from
                        'pending'
                      or produced_event.lease_token_digest is not null
                      or produced_event.lease_digest_key_version is not null
                      or produced_event.lease_expires_at is not null
                      or produced_event.attempt_count is distinct from 0
                      or produced_event.next_attempt_at is not null
                      or produced_event.last_error_class is not null
                      or produced_event.last_error_code is not null
                      or produced_event.processed_at is not null
                      or produced_event.dead_lettered_at is not null
                      or produced_event.is_historical
                      or produced_event.fanout_suppressed
                      or produced_event.migration_classification_code is not null
                      or produced_event.payload is distinct from
                        pg_catalog.jsonb_build_object(
                          'claim_id', superseded_claim.id,
                          'supplier_profile_id',
                            superseded_claim.supplier_profile_id,
                          'claimant_user_profile_id',
                            superseded_claim.claimant_user_profile_id,
                          'approved_claim_id', approved_claim.id,
                          'claim_version', superseded_claim.record_version
                        )
                    )
                  )
                )
            )
        )
      );

    select v_invalid_history_count + pg_catalog.count(*) into v_invalid_history_count
    from public.supplier_ownerships as ownership_row
    left join public.supplier_ownership_claims as approved_claim
      on approved_claim.resulting_supplier_ownership_id = ownership_row.id
     and approved_claim.status = 'approved'
    where ownership_row.supplier_profile_id = v_routed_supplier_id
      and ownership_row.establishment_source_type = 'claim_approval'
      and approved_claim.id is null;

    select v_invalid_history_count + pg_catalog.count(*) into v_invalid_history_count
    from public.supplier_ownerships as ownership_row
    where ownership_row.supplier_profile_id = v_routed_supplier_id
      and ownership_row.ownership_status <> 'active'
      and ownership_row.valid_from <= v_command_now
      and (ownership_row.valid_until is null or v_command_now < ownership_row.valid_until);

    if v_invalid_history_count <> 0 then
      if exists (
        select 1
        from public.supplier_ownership_claims as approved_claim
        join internal.audit_logs as approval_audit
          on approval_audit.action_code = 'supplier_claim.approve'
         and approval_audit.source_operation_class = 'trusted_command'
         and approval_audit.target_entity_type = 'supplier_ownership_claim'
         and approval_audit.target_id = approved_claim.id
        join internal.idempotency_keys as approval_idempotency
          on approval_idempotency.id = approval_audit.idempotency_reference
        where approved_claim.supplier_profile_id = v_routed_supplier_id
          and approved_claim.status = 'approved'
          and approval_idempotency.status = 'completed'
          and approval_idempotency.expires_at <= approval_idempotency.completed_at
      ) then
        raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
      end if;
      v_denial_code := 'integrity_reconciliation_required';
      v_denial_outcome_class := 'failed';
    end if;
  end if;

  select pg_catalog.count(*) into v_active_ownership_count
  from public.supplier_ownerships as ownership_row
  where ownership_row.supplier_profile_id = v_routed_supplier_id
    and ownership_row.authority_type = 'primary_controller'
    and ownership_row.ownership_status = 'active';

  if v_denial_code is null and v_active_ownership_count > 1 then
    v_denial_code := 'integrity_reconciliation_required';
    v_denial_outcome_class := 'failed';
  elsif v_denial_code is null and v_active_ownership_count = 1 then
    v_denial_code := 'supplier_already_owned';
    v_denial_outcome_class := 'conflicted';
  end if;

  if v_denial_code is null then
    select pg_catalog.count(*) into v_claimant_eligibility_count
    from public.user_profiles as profile_row
    join internal.identity_provider_links as link_row
      on link_row.user_profile_id = profile_row.id
    where profile_row.id = v_routed_claimant_id
      and profile_row.account_status = 'active'
      and profile_row.account_context = 'supplier'
      and profile_row.verification_mirror_status = 'verified'
      and link_row.provider_code = 'firebase'
      and link_row.is_primary
      and link_row.link_status = 'linked'
      and link_row.identity_status = 'active'
      and link_row.verification_status = 'verified'
      and link_row.provider_state_version = 'firebase-provider-state-v1';

    if v_claimant_eligibility_count <> 1 then
      v_denial_code := 'claimant_ineligible';
      v_denial_outcome_class := 'rejected';
    end if;
  end if;

  if v_denial_code is null
     and (v_supplier.listing_status <> 'approved' or v_supplier.verification_status = 'watchlist')
  then
    v_denial_code := 'supplier_ineligible';
    v_denial_outcome_class := 'rejected';
  end if;

  if v_denial_code is null then
    select evaluator.decision, evaluator.role_code
    into v_reviewer_decision, v_reviewer_role
    from claim_security.current_privileged_actor_v1() as evaluator;

    if v_reviewer_decision is distinct from 'eligible'
       or v_reviewer_role not in ('owner', 'admin')
    then
      v_denial_code := 'actor_not_authorized';
      v_denial_outcome_class := 'rejected';
    end if;
  end if;

  if v_denial_code is null then
    select pg_catalog.count(*) into v_current_role_count
    from public.platform_role_assignments as role_row
    where role_row.user_profile_id = v_request.reviewer_user_profile_id
      and role_row.assignment_status = 'active'
      and role_row.authorization_policy_version = 'platform-role-policy-v1'
      and role_row.valid_from <= v_command_now
      and (role_row.valid_until is null or v_command_now < role_row.valid_until);

    select pg_catalog.count(*) into v_current_access_count
    from public.access_grants as access_row
    join public.platform_role_assignments as role_row
      on role_row.id = access_row.platform_role_assignment_id
     and role_row.user_profile_id = access_row.user_profile_id
     and role_row.role_code = access_row.role_code
    where access_row.user_profile_id = v_request.reviewer_user_profile_id
      and access_row.access_status = 'active'
      and access_row.access_purpose = 'platform_administration'
      and access_row.authorization_policy_version = 'platform-access-policy-v1'
      and access_row.valid_from <= v_command_now
      and (access_row.valid_until is null or v_command_now < access_row.valid_until)
      and role_row.assignment_status = 'active'
      and role_row.authorization_policy_version = 'platform-role-policy-v1'
      and role_row.valid_from <= v_command_now
      and (role_row.valid_until is null or v_command_now < role_row.valid_until);

    select pg_catalog.count(*) into v_current_security_count
    from internal.security_eligibility_assessments as security_row
    where security_row.user_profile_id = v_request.reviewer_user_profile_id
      and security_row.assessment_scope = 'platform_administration'
      and security_row.assessment_status = 'active'
      and security_row.assessment_result = 'clear'
      and security_row.condition_type = 'complete_clear'
      and security_row.security_policy_version = 'platform-admin-security-v1'
      and security_row.required_coverage_version = 'platform-admin-coverage-v1'
      and security_row.evidence_minimization_version = 'platform-admin-minimization-v1'
      and security_row.valid_from <= v_command_now
      and (security_row.valid_until is null or v_command_now < security_row.valid_until);

    if v_current_role_count <> 1
       or v_current_access_count <> 1
       or v_current_security_count <> 1
    then
      v_denial_code := 'actor_not_authorized';
      v_denial_outcome_class := 'rejected';
    end if;
  end if;

  if v_denial_code is null then
    v_reviewer_conflict := claim_security.target_supplier_conflict_v1(
      v_request.reviewer_user_profile_id,
      v_routed_supplier_id,
      p_claim_id
    );
    if v_reviewer_conflict is distinct from 'clear'
       or v_request.reviewer_user_profile_id = v_claim.claimant_user_profile_id
       or v_request.reviewer_user_profile_id = v_claim.reviewer_assigned_by_user_profile_id
    then
      v_denial_code := 'reviewer_conflict';
      v_denial_outcome_class := 'conflicted';
    end if;
  end if;

  if v_denial_code is null then
    select pg_catalog.count(*) into v_invalid_competitor_count
    from public.supplier_ownership_claims as competitor
    where competitor.id = any(v_competitor_ids)
      and (
        competitor.expires_at <> competitor.submitted_at + interval '720 hours'
        or competitor.created_at <> competitor.submitted_at
        or competitor.claimant_snapshot_schema_version <> 'claimant_snapshot_v1'
        or competitor.submission_fingerprint_version <> 'claim_submit_v1'
        or competitor.submission_fingerprint !~ '^[0-9a-f]{64}$'
        or competitor.evidence_schema_version <> 'claim_evidence_v1'
        or competitor.decided_at is not null
        or competitor.withdrawn_at is not null
        or competitor.expired_at is not null
        or competitor.superseded_at is not null
        or competitor.resulting_supplier_ownership_id is not null
        or (
          competitor.status = 'under_review'
          and (
            competitor.reviewer_user_profile_id is null
            or competitor.reviewer_assignment_version <> 1
            or competitor.reviewer_assigned_at is null
            or competitor.reviewer_assigned_by_user_profile_id is null
            or competitor.reviewer_assignment_source_code <> 'owner_assignment'
            or competitor.reviewer_assignment_policy_version <> 'claim_reviewer_assignment_v1'
            or competitor.reviewer_user_profile_id = competitor.claimant_user_profile_id
            or competitor.reviewer_user_profile_id = competitor.reviewer_assigned_by_user_profile_id
            or competitor.reviewer_assigned_at < competitor.submitted_at
            or competitor.reviewer_assigned_at >= competitor.expires_at
          )
        )
      );
    if v_invalid_competitor_count <> 0 then
      v_denial_code := 'integrity_reconciliation_required';
      v_denial_outcome_class := 'failed';
    end if;
  end if;

  v_correlation_id := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());

  if v_denial_code is not null then
    begin
      insert into internal.audit_logs (
        action_code, action_contract_version, action_class,
        actor_kind, actor_user_profile_id,
        target_entity_type, target_id,
        related_target_entity_type, related_target_id,
        occurred_at, recorded_at, environment_code, source_system_code,
        producing_component_code, source_operation_class,
        outcome_class, result_code, reason_code, correlation_id,
        idempotency_reference, prior_state_code, prior_record_version,
        audit_schema_version, action_evidence_schema_version,
        authorization_policy_version, producer_contract_version,
        minimization_policy_version, retention_class
      ) values (
        'supplier_claim.approve', 1, 'claim_ownership',
        'human_user', v_request.reviewer_user_profile_id,
        'supplier_ownership_claim', p_claim_id,
        'supplier_profile', v_routed_supplier_id,
        v_command_now, v_command_now, 'local', 'mujahiz',
        'supplier_claim_command', 'trusted_command_denial',
        v_denial_outcome_class, v_denial_code, v_denial_code,
        v_correlation_id, v_idempotency.id,
        'under_review', v_claim.record_version,
        'audit_log_v1', 'claim_approve_denial_v1',
        'sec-001-claim-v1', 'supplier_claim.approve.v1',
        'aud-001-minimized-v1', 'claim_ownership_decision'
      );
    exception when others then
      raise exception using errcode = 'P5116', message = 'audit_unavailable';
    end;

    update internal.idempotency_keys as row_value
    set status = 'failed',
        lease_token_digest = null,
        lease_digest_key_version = null,
        lease_expires_at = null,
        failure_code = v_denial_code,
        retry_disposition = 'terminal',
        next_attempt_at = null,
        failed_at = v_command_now
    where row_value.id = v_idempotency.id
      and row_value.status = 'processing'
      and row_value.attempt_count = v_attempt_count
      and row_value.lease_token_digest = v_fence_digest;

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;

    return query select
      'supplier_claim.approve'::text, 1, v_denial_code,
      p_claim_id, null::text, null::integer, null::uuid, null::uuid,
      null::timestamptz, null::integer, false;
    return;
  end if;

  v_result_version := v_claim.record_version + 1;
  v_ownership_id := pg_catalog.gen_random_uuid();
  v_primary_event_id := pg_catalog.gen_random_uuid();
  v_audit_id := pg_catalog.gen_random_uuid();

  insert into public.supplier_ownerships (
    id, supplier_profile_id, controller_user_profile_id,
    authority_type, ownership_status, valid_from, valid_until, record_version,
    establishment_source_type, establishment_reason_code,
    established_by_user_profile_id, establishment_system_source, established_at,
    closure_reason_code, closed_by_user_profile_id, closure_system_source,
    closed_at, transfer_successor_ownership_id,
    created_at, created_by_user_profile_id, updated_at, updated_by_user_profile_id
  ) values (
    v_ownership_id, v_routed_supplier_id, v_routed_claimant_id,
    'primary_controller', 'active', v_command_now, null, 1,
    'claim_approval', 'verified_claim_approved',
    v_request.reviewer_user_profile_id, null, v_command_now,
    null, null, null, null, null,
    v_command_now, v_request.reviewer_user_profile_id,
    v_command_now, v_request.reviewer_user_profile_id
  );

  update public.supplier_ownership_claims as claim_row
  set status = 'approved',
      record_version = v_result_version,
      decided_by_user_profile_id = v_request.reviewer_user_profile_id,
      decided_at = v_command_now,
      decision_reason_code = 'verified_claim_approved',
      evidence_verification_method_code = p_evidence_verification_method_code,
      evidence_verification_version = p_evidence_verification_version,
      evidence_verification_outcome_code = p_evidence_verification_outcome_code,
      decision_authorization_policy_version = 'claim_approval_reason_registry_v1',
      reviewer_notes = null,
      resulting_supplier_ownership_id = v_ownership_id,
      updated_at = v_command_now
  where claim_row.id = p_claim_id
    and claim_row.record_version = p_expected_claim_version
    and claim_row.status = 'under_review'
    and claim_row.reviewer_user_profile_id = v_request.reviewer_user_profile_id
    and claim_row.reviewer_assignment_version = p_expected_reviewer_assignment_version
    and claim_row.decided_at is null;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;

  insert into internal.domain_events (
    id, event_type, event_schema_version,
    aggregate_type, aggregate_id, aggregate_sequence,
    producer_command_name, producer_command_contract_version,
    producer_idempotency_key_id, source_system_code, event_ordinal,
    actor_kind, actor_user_profile_id,
    environment_code, producing_component_code, correlation_id,
    occurred_at, persisted_at, payload, processing_status, available_at
  ) values (
    v_primary_event_id, 'supplier_ownership.claim_approved', 1,
    'supplier_ownership_claim', p_claim_id, v_result_version,
    'supplier_claim.approve', 1,
    v_idempotency.id, 'mujahiz', 1,
    'human_user', v_request.reviewer_user_profile_id,
    'local', 'supplier_claim_command', v_correlation_id,
    v_command_now, v_command_now,
    pg_catalog.jsonb_build_object(
      'claim_id', p_claim_id,
      'supplier_profile_id', v_routed_supplier_id,
      'claimant_user_profile_id', v_routed_claimant_id,
      'ownership_id', v_ownership_id,
      'claim_version', v_result_version
    ),
    'pending', v_command_now
  );

  foreach v_competitor_id in array v_competitor_ids
  loop
    select claim_row.* into v_competitor
    from public.supplier_ownership_claims as claim_row
    where claim_row.id = v_competitor_id;
    if not found or v_competitor.status not in ('submitted', 'under_review') then
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;

    v_competitor_result_version := v_competitor.record_version + 1;
    update public.supplier_ownership_claims as claim_row
    set status = 'superseded',
        record_version = v_competitor_result_version,
        superseded_at = v_command_now,
        supersession_reason_code = 'competing_claim_superseded_by_approval',
        superseded_by_claim_id = p_claim_id,
        updated_at = v_command_now
    where claim_row.id = v_competitor_id
      and claim_row.record_version = v_competitor.record_version
      and claim_row.status = v_competitor.status;

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
    end if;

    v_superseded_count := v_superseded_count + 1;
    v_event_ordinal := v_event_ordinal + 1;
    v_event_id := pg_catalog.gen_random_uuid();
    insert into internal.domain_events (
      id, event_type, event_schema_version,
      aggregate_type, aggregate_id, aggregate_sequence,
      producer_command_name, producer_command_contract_version,
      producer_idempotency_key_id, source_system_code, event_ordinal,
      actor_kind, actor_user_profile_id,
      environment_code, producing_component_code, correlation_id,
      occurred_at, persisted_at, payload, processing_status, available_at
    ) values (
      v_event_id, 'supplier_ownership.claim_superseded', 1,
      'supplier_ownership_claim', v_competitor_id, v_competitor_result_version,
      'supplier_claim.approve', 1,
      v_idempotency.id, 'mujahiz', v_event_ordinal,
      'human_user', v_request.reviewer_user_profile_id,
      'local', 'supplier_claim_command', v_correlation_id,
      v_command_now, v_command_now,
      pg_catalog.jsonb_build_object(
        'claim_id', v_competitor_id,
        'supplier_profile_id', v_routed_supplier_id,
        'claimant_user_profile_id', v_competitor.claimant_user_profile_id,
        'approved_claim_id', p_claim_id,
        'claim_version', v_competitor_result_version
      ),
      'pending', v_command_now
    );
  end loop;

  begin
    insert into internal.audit_logs (
      id, action_code, action_contract_version, action_class,
      actor_kind, actor_user_profile_id, actor_authorization_snapshot,
      target_entity_type, target_id,
      related_target_entity_type, related_target_id,
      occurred_at, recorded_at, environment_code, source_system_code,
      producing_component_code, source_operation_class,
      outcome_class, result_code, reason_code,
      safe_context_schema_version, safe_context,
      correlation_id, idempotency_reference, domain_event_reference,
      prior_state_code, result_state_code,
      prior_record_version, result_record_version,
      changed_field_codes,
      evidence_digest, evidence_digest_algorithm, evidence_digest_version,
      restricted_evidence_reference,
      audit_schema_version, action_evidence_schema_version,
      authorization_policy_version, producer_contract_version,
      minimization_policy_version, retention_class
    ) values (
      v_audit_id, 'supplier_claim.approve', 1, 'claim_ownership',
      'human_user', v_request.reviewer_user_profile_id, v_reviewer_role,
      'supplier_ownership_claim', p_claim_id,
      'supplier_profile', v_routed_supplier_id,
      v_command_now, v_command_now, 'local', 'mujahiz',
      'supplier_claim_command', 'trusted_command',
      'succeeded', 'approved', 'verified_claim_approved',
      'claim_approve_context_v1',
      pg_catalog.jsonb_build_object(
        'reason_registry_version', 'claim_approval_reason_registry_v1',
        'approval_evidence_policy_version', 'claim_approval_evidence_policy_v1',
        'evidence_verification_method_code', p_evidence_verification_method_code,
        'evidence_verification_version', p_evidence_verification_version,
        'evidence_verification_outcome_code', p_evidence_verification_outcome_code,
        'checked_source_classes', pg_catalog.to_jsonb(v_request.canonical_checked_source_classes),
        'evidence_digest_version', 'claim_approve_evidence_digest_v1',
        'disclosure_policy_version', 'claim_approve_disclosure_v1',
        'decision_authorization_policy_version', 'sec-001-claim-v1',
        'reviewer_role_code', v_reviewer_role,
        'reviewer_conflict_result', v_reviewer_conflict,
        'provider_state_version', 'firebase-provider-state-v1',
        'role_policy_version', 'platform-role-policy-v1',
        'access_policy_version', 'platform-access-policy-v1',
        'security_policy_version', 'platform-admin-security-v1',
        'security_coverage_version', 'platform-admin-coverage-v1',
        'evidence_minimization_version', 'platform-admin-minimization-v1',
        'resulting_supplier_ownership_id', v_ownership_id,
        'superseded_claim_count', v_superseded_count
      ),
      v_correlation_id, v_idempotency.id, v_primary_event_id,
      'under_review', 'approved', v_claim.record_version, v_result_version,
      array[
        'status', 'record_version', 'decided_by_user_profile_id', 'decided_at',
        'decision_reason_code', 'evidence_verification_method_code',
        'evidence_verification_version', 'evidence_verification_outcome_code',
        'decision_authorization_policy_version', 'resulting_supplier_ownership_id'
      ]::text[],
      v_request.evidence_digest, 'sha256', 'claim_approve_evidence_digest_v1',
      v_request.canonical_restricted_evidence_reference,
      'audit_log_v1', 'claim_approve_success_v1',
      'sec-001-claim-v1', 'supplier_claim.approve.v1',
      'aud-001-minimized-v1', 'claim_ownership_decision'
    );
  exception when others then
    raise exception using errcode = 'P5116', message = 'audit_unavailable';
  end;

  update internal.idempotency_keys as row_value
  set status = 'completed',
      lease_token_digest = null,
      lease_digest_key_version = null,
      lease_expires_at = null,
      outcome_code = 'approved',
      result_resource_type = 'supplier_ownership_claim',
      result_resource_id = p_claim_id,
      result_version_token = v_result_version::text,
      completed_at = v_command_now
  where row_value.id = v_idempotency.id
    and row_value.status = 'processing'
    and row_value.attempt_count = v_attempt_count
    and row_value.lease_token_digest = v_fence_digest;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
  end if;

  return query select
    'supplier_claim.approve'::text, 1, 'approved'::text,
    p_claim_id, 'approved'::text, v_result_version,
    v_routed_supplier_id, v_ownership_id, v_command_now,
    v_superseded_count, false;
  return;
exception
  when sqlstate 'P5100'
    or sqlstate 'P5101'
    or sqlstate 'P5108'
    or sqlstate 'P5109'
    or sqlstate 'P5110'
    or sqlstate 'P5111'
    or sqlstate 'P5112'
    or sqlstate 'P5113'
    or sqlstate 'P5114'
    or sqlstate 'P5116'
    or sqlstate 'P5199'
  then raise;
  when others then
    raise exception using errcode = 'P5199', message = 'integrity_reconciliation_required';
end
$function$;

comment on function supplier_claim._execute_approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid, uuid
) is
  'Private-named fenced Phase-B approve-v1 executor. It serializes the Supplier aggregate, re-proves reviewer, claimant, Supplier, ownership, Claim, conflict, and evidence state, creates one ownership, approves one winner, supersedes the complete competing set, writes ordered events and one audit, and completes idempotency atomically.';

alter function supplier_claim._execute_approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid, uuid
) owner to postgres;
revoke all on function supplier_claim._execute_approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid, uuid
) from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim._execute_approve(
  text, uuid, integer, integer, text, text, text, text[], text, uuid, uuid
) to mujahiz_claim_runtime;
