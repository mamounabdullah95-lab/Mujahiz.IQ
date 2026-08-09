-- Eighteenth local SQL slice: supplier_claim.submit v1 only.
-- This migration creates no other Claim command, mutation RLS policy, notification,
-- hosted capability, Firebase integration, real row, or data movement.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists supplier_claim;

comment on schema supplier_claim is
  'Non-exposed trusted Claim mutation commands only. It is not a browser/API schema and contains no generic CRUD, reviewer, decision, expiry, supersession, or notification surface.';

revoke all on schema supplier_claim
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant usage on schema supplier_claim to mujahiz_claim_runtime;

alter default privileges in schema supplier_claim
  revoke execute on functions
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;

create function claim_security.claim_principal_lock_key_v1(
  p_user_profile_id uuid
)
returns bigint
language sql
immutable
strict
security invoker
set search_path = pg_catalog
as $function$
  select pg_catalog.hashtextextended(
    'claim-principal-lock-v1:' || p_user_profile_id::text,
    0
  )
$function$;

comment on function claim_security.claim_principal_lock_key_v1(uuid) is
  'Versioned transaction-advisory-lock key for one provider-neutral Claim principal. Hash collisions may serialize unrelated principals but cannot permit conflicting work.';

create function claim_security.claim_supplier_lock_key_v1(
  p_supplier_profile_id uuid
)
returns bigint
language sql
immutable
strict
security invoker
set search_path = pg_catalog
as $function$
  select pg_catalog.hashtextextended(
    'claim-supplier-lock-v1:' || p_supplier_profile_id::text,
    0
  )
$function$;

comment on function claim_security.claim_supplier_lock_key_v1(uuid) is
  'Versioned transaction-advisory-lock key shared by Claim and Supplier ownership mutations. Hash collisions may serialize unrelated Suppliers but cannot permit conflicting work.';

revoke all on function claim_security.claim_principal_lock_key_v1(uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
revoke all on function claim_security.claim_supplier_lock_key_v1(uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;

create function supplier_claim.submit(
  p_idempotency_key text,
  p_supplier_profile_id uuid,
  p_submitted_reason text,
  p_evidence_schema_version text,
  p_evidence_descriptors jsonb default '[]'::jsonb,
  p_prior_claim_id uuid default null,
  p_correlation_id uuid default null
)
returns table (
  command text,
  command_contract_version integer,
  outcome_code text,
  claim_id uuid,
  claim_status text,
  claim_version integer,
  supplier_profile_id uuid,
  submitted_at timestamptz,
  expires_at timestamptz,
  idempotent_replay boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_principal_id uuid;
  v_hmac_key text;
  v_reason text;
  v_evidence jsonb := '[]'::jsonb;
  v_descriptor jsonb;
  v_normalized_descriptor jsonb;
  v_kind text;
  v_summary text;
  v_reference text;
  v_url_tail text;
  v_authority text;
  v_host text;
  v_url_suffix text;
  v_label text;
  v_seen_references text[] := '{}'::text[];
  v_canonical_request jsonb;
  v_key_digest bytea;
  v_request_fingerprint bytea;
  v_request_fingerprint_hex text;
  v_slot_hex text;
  v_slot_id uuid;
  v_lease_token text;
  v_lease_digest bytea;
  v_reservation_now timestamptz;
  v_command_now timestamptz;
  v_idempotency internal.idempotency_keys%rowtype;
  v_new_reservation boolean := false;
  v_profile public.user_profiles%rowtype;
  v_provider_link internal.identity_provider_links%rowtype;
  v_supplier public.supplier_profiles%rowtype;
  v_ownership public.supplier_ownerships%rowtype;
  v_prior_claim public.supplier_ownership_claims%rowtype;
  v_replay_claim public.supplier_ownership_claims%rowtype;
  v_active_firebase_link_count integer := 0;
  v_usable_firebase_link_count integer := 0;
  v_active_ownership_count integer := 0;
  v_active_pair_claim_count integer := 0;
  v_claimant_snapshot jsonb;
  v_claim_id uuid;
  v_event_id uuid;
  v_correlation_id uuid;
  v_attempt_count integer;
  v_updated_count integer;
  v_constraint_name text;
begin
  v_principal_id := claim_security.current_claim_user_profile_id();
  if v_principal_id is null then
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
  end if;

  v_hmac_key := nullif(
    pg_catalog.current_setting('mujahiz.claim.hmac_key', true),
    ''
  );
  if v_hmac_key is null
     or pg_catalog.octet_length(v_hmac_key) < 32
     or pg_catalog.octet_length(v_hmac_key) > 256
     or pg_catalog.translate(v_hmac_key, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using
      errcode = 'P5100',
      message = 'claim_context_invalid';
  end if;

  if p_supplier_profile_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^claim-([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
  then
    raise exception using
      errcode = 'P5101',
      message = 'invalid_request';
  end if;

  if p_submitted_reason is null
     or pg_catalog.translate(p_submitted_reason, E'\n\r\t', '') ~ '[[:cntrl:]]'
  then
    raise exception using
      errcode = 'P5101',
      message = 'invalid_request';
  end if;

  v_reason := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(p_submitted_reason, E'\r\n?', E'\n', 'g'),
      E'[ \t]+',
      ' ',
      'g'
    )
  );
  if pg_catalog.char_length(v_reason) not between 20 and 1200
     or pg_catalog.octet_length(v_reason) > 2000
  then
    raise exception using
      errcode = 'P5101',
      message = 'invalid_request';
  end if;

  if p_evidence_schema_version is distinct from 'claim_evidence_v1' then
    raise exception using
      errcode = 'P5102',
      message = 'unsupported_evidence_schema';
  end if;

  if p_evidence_descriptors is null
     or pg_catalog.jsonb_typeof(p_evidence_descriptors) <> 'array'
     or pg_catalog.jsonb_array_length(p_evidence_descriptors) > 3
  then
    raise exception using
      errcode = 'P5101',
      message = 'invalid_request';
  end if;

  for v_descriptor in
    select descriptor.value
    from pg_catalog.jsonb_array_elements(p_evidence_descriptors)
      with ordinality as descriptor(value, ordinal)
    order by descriptor.ordinal
  loop
    if pg_catalog.jsonb_typeof(v_descriptor) <> 'object'
       or not (v_descriptor ? 'kind')
       or not (v_descriptor ? 'summary')
       or exists (
         select 1
         from pg_catalog.jsonb_object_keys(v_descriptor) as descriptor_key(key_name)
         where descriptor_key.key_name not in ('kind', 'summary', 'reference_url')
       )
       or pg_catalog.jsonb_typeof(v_descriptor -> 'kind') <> 'string'
       or pg_catalog.jsonb_typeof(v_descriptor -> 'summary') <> 'string'
       or (
         v_descriptor ? 'reference_url'
         and pg_catalog.jsonb_typeof(v_descriptor -> 'reference_url') <> 'string'
       )
    then
      raise exception using
        errcode = 'P5101',
        message = 'invalid_request';
    end if;

    v_kind := v_descriptor ->> 'kind';
    if v_kind not in (
      'company_domain_email',
      'company_website',
      'commercial_registration',
      'authorization_letter',
      'other'
    ) then
      raise exception using
        errcode = 'P5102',
        message = 'unsupported_evidence_type';
    end if;

    v_summary := v_descriptor ->> 'summary';
    if pg_catalog.translate(v_summary, E'\n\r\t', '') ~ '[[:cntrl:]]' then
      raise exception using
        errcode = 'P5101',
        message = 'invalid_request';
    end if;
    v_summary := pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(v_summary, E'\r\n?', E'\n', 'g'),
        E'[ \t]+',
        ' ',
        'g'
      )
    );
    if pg_catalog.char_length(v_summary) not between 20 and 1600
       or pg_catalog.octet_length(v_summary) > 4000
    then
      raise exception using
        errcode = 'P5101',
        message = 'invalid_request';
    end if;

    v_normalized_descriptor := pg_catalog.jsonb_build_object(
      'kind', v_kind,
      'summary', v_summary
    );

    if v_descriptor ? 'reference_url' then
      v_reference := pg_catalog.btrim(v_descriptor ->> 'reference_url');
      if pg_catalog.char_length(v_reference) not between 1 and 500
         or pg_catalog.octet_length(v_reference) > 1000
         or v_reference ~ '[[:space:]]'
         or pg_catalog.translate(v_reference, E'\n\r\t', '') ~ '[[:cntrl:]]'
         or pg_catalog.lower(pg_catalog.left(v_reference, 8)) <> 'https://'
      then
        raise exception using
          errcode = 'P5101',
          message = 'invalid_request';
      end if;

      v_url_tail := pg_catalog.substr(v_reference, 9);
      v_authority := pg_catalog.substring(v_url_tail, '^([^/?#]+)');
      if v_authority is null
         or v_authority = ''
         or v_authority like '%@%'
         or v_authority like '%[%'
         or v_authority like '%]%'
      then
        raise exception using
          errcode = 'P5101',
          message = 'invalid_request';
      end if;

      if v_authority ~ ':[0-9]+$' then
        if pg_catalog.right(v_authority, 4) <> ':443' then
          raise exception using
            errcode = 'P5101',
            message = 'invalid_request';
        end if;
        v_host := pg_catalog.left(v_authority, pg_catalog.char_length(v_authority) - 4);
      else
        v_host := v_authority;
      end if;

      if pg_catalog.strpos(v_host, ':') > 0 then
        raise exception using
          errcode = 'P5101',
          message = 'invalid_request';
      end if;

      v_host := pg_catalog.lower(v_host);
      if pg_catalog.char_length(v_host) not between 3 and 253
         or pg_catalog.strpos(v_host, '.') = 0
         or v_host like '%.%.'
         or v_host like '%.localhost'
         or v_host like '%.local'
         or v_host like '%.internal'
         or v_host like '%.lan'
         or v_host like '%.home'
         or v_host like '%.localdomain'
         or v_host like '%.invalid'
         or v_host in ('localhost', 'local', 'internal')
         or v_host ~ '^[0-9.]+$'
      then
        raise exception using
          errcode = 'P5101',
          message = 'invalid_request';
      end if;

      foreach v_label in array pg_catalog.string_to_array(v_host, '.')
      loop
        if pg_catalog.char_length(v_label) not between 1 and 63
           or v_label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
        then
          raise exception using
            errcode = 'P5101',
            message = 'invalid_request';
        end if;
      end loop;

      v_url_suffix := pg_catalog.substr(
        v_url_tail,
        pg_catalog.char_length(v_authority) + 1
      );
      if v_url_suffix is null or v_url_suffix = '' then
        v_url_suffix := '/';
      end if;
      v_reference := 'https://' || v_host || v_url_suffix;

      if v_reference = any(v_seen_references) then
        raise exception using
          errcode = 'P5101',
          message = 'invalid_request';
      end if;
      v_seen_references := pg_catalog.array_append(v_seen_references, v_reference);
      v_normalized_descriptor := v_normalized_descriptor
        || pg_catalog.jsonb_build_object('reference_url', v_reference);
    end if;

    v_evidence := v_evidence || pg_catalog.jsonb_build_array(v_normalized_descriptor);
  end loop;

  if pg_catalog.octet_length(v_evidence::text) > 12288 then
    raise exception using
      errcode = 'P5101',
      message = 'invalid_request';
  end if;

  v_canonical_request := pg_catalog.jsonb_build_object(
    'command_precondition_version', 'claim_submit_preconditions_v1',
    'supplier_profile_id', p_supplier_profile_id,
    'submitted_reason', v_reason,
    'evidence_schema_version', p_evidence_schema_version,
    'evidence_descriptors', v_evidence,
    'prior_claim_id', p_prior_claim_id
  );

  v_key_digest := extensions.hmac(
    pg_catalog.convert_to(
      'claim-idempotency-key-v1|local|supplier_claim.submit|1|'
        || pg_catalog.octet_length(p_idempotency_key)::text
        || ':' || p_idempotency_key,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  v_request_fingerprint := extensions.hmac(
    pg_catalog.convert_to(
      'claim-request-fingerprint-v1|' || v_canonical_request::text,
      'UTF8'
    ),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );
  v_request_fingerprint_hex := pg_catalog.encode(v_request_fingerprint, 'hex');

  v_slot_hex := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'supplier-claim-slot-v1|' || v_principal_id::text
          || '|' || p_supplier_profile_id::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  v_slot_id := (
    pg_catalog.substr(v_slot_hex, 1, 8) || '-'
    || pg_catalog.substr(v_slot_hex, 9, 4) || '-5'
    || pg_catalog.substr(v_slot_hex, 14, 3) || '-8'
    || pg_catalog.substr(v_slot_hex, 18, 3) || '-'
    || pg_catalog.substr(v_slot_hex, 21, 12)
  )::uuid;

  v_reservation_now := pg_catalog.clock_timestamp();
  v_lease_token := pg_catalog.gen_random_uuid()::text;
  v_lease_digest := extensions.hmac(
    pg_catalog.convert_to('claim-lease-v1|' || v_lease_token, 'UTF8'),
    pg_catalog.convert_to(v_hmac_key, 'UTF8'),
    'sha256'
  );

  insert into internal.idempotency_keys (
    command_name,
    command_contract_version,
    environment_code,
    principal_kind,
    principal_user_profile_id,
    target_aggregate_type,
    target_aggregate_id,
    key_digest,
    key_digest_key_version,
    request_fingerprint,
    request_fingerprint_key_version,
    status,
    lease_token_digest,
    lease_digest_key_version,
    lease_expires_at,
    attempt_count,
    created_at,
    expires_at
  ) values (
    'supplier_claim.submit',
    1,
    'local',
    'human_user',
    v_principal_id,
    'supplier_claim_slot',
    v_slot_id,
    v_key_digest,
    'local_v1',
    v_request_fingerprint,
    'local_v1',
    'processing',
    v_lease_digest,
    'local_v1',
    v_reservation_now + interval '60 seconds',
    1,
    v_reservation_now,
    v_reservation_now + interval '720 hours'
  )
  on conflict on constraint idempotency_keys_namespace_uk do nothing
  returning * into v_idempotency;
  v_new_reservation := found;

  if not v_new_reservation then
    select idempotency_row.*
    into v_idempotency
    from internal.idempotency_keys as idempotency_row
    where idempotency_row.environment_code = 'local'
      and idempotency_row.command_name = 'supplier_claim.submit'
      and idempotency_row.command_contract_version = 1
      and idempotency_row.key_digest = v_key_digest
    for update;

    if not found then
      raise exception using
        errcode = 'P5199',
        message = 'integrity_reconciliation_required';
    end if;

    if v_idempotency.principal_kind <> 'human_user'
       or v_idempotency.principal_user_profile_id is distinct from v_principal_id
       or v_idempotency.principal_source_code is not null
       or v_idempotency.target_aggregate_type is distinct from 'supplier_claim_slot'
       or v_idempotency.target_aggregate_id is distinct from v_slot_id
       or v_idempotency.key_digest_key_version <> 'local_v1'
       or v_idempotency.request_fingerprint is distinct from v_request_fingerprint
       or v_idempotency.request_fingerprint_key_version <> 'local_v1'
    then
      raise exception using
        errcode = 'P5108',
        message = 'idempotency_key_conflict';
    end if;

    if v_idempotency.status = 'completed' then
      if v_idempotency.outcome_code <> 'submitted'
         or v_idempotency.result_resource_type <> 'supplier_ownership_claim'
         or v_idempotency.result_resource_id is null
         or v_idempotency.result_version_token <> '1'
      then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      select claim_row.*
      into v_replay_claim
      from public.supplier_ownership_claims as claim_row
      where claim_row.id = v_idempotency.result_resource_id;

      if not found
         or v_replay_claim.claimant_user_profile_id <> v_principal_id
         or v_replay_claim.supplier_profile_id <> p_supplier_profile_id
      then
        raise exception using
          errcode = 'P5199',
          message = 'integrity_reconciliation_required';
      end if;

      return query
      select
        'supplier_claim.submit'::text,
        1,
        'submitted'::text,
        v_replay_claim.id,
        v_replay_claim.status,
        v_replay_claim.record_version,
        v_replay_claim.supplier_profile_id,
        v_replay_claim.submitted_at,
        v_replay_claim.expires_at,
        true;
      return;
    elsif v_idempotency.status = 'processing' then
      if v_idempotency.lease_expires_at > v_reservation_now then
        raise exception using
          errcode = 'P5109',
          message = 'command_in_progress';
      end if;
      if v_idempotency.attempt_count >= 10 then
        raise exception using
          errcode = 'P5110',
          message = 'retry_later';
      end if;

      update internal.idempotency_keys as idempotency_row
      set lease_token_digest = v_lease_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_reservation_now + interval '60 seconds',
          attempt_count = idempotency_row.attempt_count + 1
      where idempotency_row.id = v_idempotency.id
      returning * into v_idempotency;
    elsif v_idempotency.status = 'failed' then
      if v_idempotency.retry_disposition = 'terminal' then
        raise exception using
          errcode = 'P5107',
          message = 'claim_not_actionable';
      end if;
      if v_idempotency.next_attempt_at > v_reservation_now
         or v_idempotency.attempt_count >= 10
      then
        raise exception using
          errcode = 'P5110',
          message = 'retry_later';
      end if;

      update internal.idempotency_keys as idempotency_row
      set status = 'processing',
          lease_token_digest = v_lease_digest,
          lease_digest_key_version = 'local_v1',
          lease_expires_at = v_reservation_now + interval '60 seconds',
          attempt_count = idempotency_row.attempt_count + 1,
          failure_code = null,
          retry_disposition = null,
          next_attempt_at = null,
          failed_at = null
      where idempotency_row.id = v_idempotency.id
      returning * into v_idempotency;
    else
      raise exception using
        errcode = 'P5199',
        message = 'integrity_reconciliation_required';
    end if;
  end if;

  v_attempt_count := v_idempotency.attempt_count;

  perform pg_catalog.pg_advisory_xact_lock(
    claim_security.claim_principal_lock_key_v1(v_principal_id)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    claim_security.claim_supplier_lock_key_v1(p_supplier_profile_id)
  );

  select profile_row.*
  into v_profile
  from public.user_profiles as profile_row
  where profile_row.id = v_principal_id
  for update;

  if not found
     or v_profile.account_status <> 'active'
     or v_profile.account_context <> 'supplier'
     or v_profile.verification_mirror_status <> 'verified'
  then
    raise exception using
      errcode = 'P5103',
      message = 'claimant_ineligible';
  end if;

  for v_provider_link in
    select provider_link_row.*
    from internal.identity_provider_links as provider_link_row
    where provider_link_row.user_profile_id = v_principal_id
    order by provider_link_row.id
    for update
  loop
    if v_provider_link.provider_code = 'firebase'
       and v_provider_link.link_status = 'linked'
    then
      v_active_firebase_link_count := v_active_firebase_link_count + 1;
      if v_provider_link.is_primary
         and v_provider_link.identity_status = 'active'
         and v_provider_link.verification_status = 'verified'
      then
        v_usable_firebase_link_count := v_usable_firebase_link_count + 1;
      end if;
    end if;
  end loop;

  if v_active_firebase_link_count <> 1
     or v_usable_firebase_link_count <> 1
  then
    raise exception using
      errcode = 'P5103',
      message = 'claimant_ineligible';
  end if;

  select supplier_row.*
  into v_supplier
  from public.supplier_profiles as supplier_row
  where supplier_row.id = p_supplier_profile_id
  for update;

  if not found
     or v_supplier.listing_status <> 'approved'
     or v_supplier.verification_status = 'watchlist'
  then
    raise exception using
      errcode = 'P5104',
      message = 'supplier_ineligible';
  end if;

  for v_ownership in
    select ownership_row.*
    from public.supplier_ownerships as ownership_row
    where ownership_row.supplier_profile_id = p_supplier_profile_id
    order by ownership_row.id
    for update
  loop
    if v_ownership.authority_type = 'primary_controller'
       and v_ownership.ownership_status = 'active'
    then
      v_active_ownership_count := v_active_ownership_count + 1;
    end if;
  end loop;

  if v_active_ownership_count > 1 then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  elsif v_active_ownership_count = 1 then
    raise exception using
      errcode = 'P5105',
      message = 'supplier_already_owned';
  end if;

  for v_prior_claim in
    select claim_row.*
    from public.supplier_ownership_claims as claim_row
    where claim_row.supplier_profile_id = p_supplier_profile_id
      and claim_row.claimant_user_profile_id = v_principal_id
      and claim_row.status in ('submitted', 'under_review')
    order by claim_row.id
    for update
  loop
    v_active_pair_claim_count := v_active_pair_claim_count + 1;
  end loop;

  if v_active_pair_claim_count > 0 then
    raise exception using
      errcode = 'P5106',
      message = 'active_claim_exists';
  end if;

  if p_prior_claim_id is not null then
    select claim_row.*
    into v_prior_claim
    from public.supplier_ownership_claims as claim_row
    where claim_row.id = p_prior_claim_id
    for update;

    if not found
       or v_prior_claim.claimant_user_profile_id <> v_principal_id
       or v_prior_claim.supplier_profile_id <> p_supplier_profile_id
       or v_prior_claim.status <> 'rejected'
       or v_prior_claim.decision_reason_code not in (
         'insufficient_evidence',
         'claimant_ineligible',
         'supplier_mismatch'
       )
       or (
         v_prior_claim.submitted_reason = v_reason
         and v_prior_claim.evidence_schema_version = 'claim_evidence_v1'
         and v_prior_claim.evidence_descriptors = v_evidence
       )
    then
      raise exception using
        errcode = 'P5107',
        message = 'prior_claim_invalid';
    end if;

    perform 1
    from public.supplier_ownership_claims as successor_claim
    where successor_claim.prior_claim_id = p_prior_claim_id
    order by successor_claim.id
    for update;

    if found then
      raise exception using
        errcode = 'P5107',
        message = 'prior_claim_invalid';
    end if;
  end if;

  v_command_now := pg_catalog.clock_timestamp();
  v_claim_id := pg_catalog.gen_random_uuid();
  v_event_id := pg_catalog.gen_random_uuid();
  v_correlation_id := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());
  v_claimant_snapshot := pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'full_name', v_profile.full_name,
      'organization', v_profile.legacy_organization,
      'job_title', v_profile.job_title,
      'email', v_profile.display_email,
      'phone', v_profile.phone_number
    )
  );

  insert into public.supplier_ownership_claims (
    id,
    claimant_user_profile_id,
    supplier_profile_id,
    status,
    record_version,
    submitted_at,
    expires_at,
    submitted_reason,
    claimant_snapshot_schema_version,
    claimant_snapshot,
    submission_fingerprint_version,
    submission_fingerprint,
    evidence_schema_version,
    evidence_descriptors,
    prior_claim_id,
    created_at,
    updated_at
  ) values (
    v_claim_id,
    v_principal_id,
    p_supplier_profile_id,
    'submitted',
    1,
    v_command_now,
    v_command_now + interval '720 hours',
    v_reason,
    'claimant_snapshot_v1',
    v_claimant_snapshot,
    'claim_submit_v1',
    v_request_fingerprint_hex,
    'claim_evidence_v1',
    v_evidence,
    p_prior_claim_id,
    v_command_now,
    v_command_now
  );

  insert into internal.domain_events (
    id,
    event_type,
    event_schema_version,
    aggregate_type,
    aggregate_id,
    aggregate_sequence,
    producer_command_name,
    producer_command_contract_version,
    producer_idempotency_key_id,
    source_system_code,
    event_ordinal,
    actor_kind,
    actor_user_profile_id,
    environment_code,
    producing_component_code,
    correlation_id,
    occurred_at,
    persisted_at,
    payload,
    processing_status,
    available_at
  ) values (
    v_event_id,
    'supplier_ownership.claim_submitted',
    1,
    'supplier_ownership_claim',
    v_claim_id,
    1,
    'supplier_claim.submit',
    1,
    v_idempotency.id,
    'mujahiz',
    1,
    'human_user',
    v_principal_id,
    'local',
    'supplier_claim_command',
    v_correlation_id,
    v_command_now,
    v_command_now,
    pg_catalog.jsonb_build_object(
      'claim_id', v_claim_id,
      'supplier_profile_id', p_supplier_profile_id,
      'claimant_user_profile_id', v_principal_id,
      'claim_version', 1
    ),
    'pending',
    v_command_now
  );

  update internal.idempotency_keys as idempotency_row
  set status = 'completed',
      lease_token_digest = null,
      lease_digest_key_version = null,
      lease_expires_at = null,
      outcome_code = 'submitted',
      result_resource_type = 'supplier_ownership_claim',
      result_resource_id = v_claim_id,
      result_version_token = '1',
      completed_at = v_command_now,
      expires_at = v_command_now + interval '720 hours'
  where idempotency_row.id = v_idempotency.id
    and idempotency_row.status = 'processing'
    and idempotency_row.attempt_count = v_attempt_count
    and idempotency_row.lease_token_digest = v_lease_digest;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  end if;

  return query
  select
    'supplier_claim.submit'::text,
    1,
    'submitted'::text,
    v_claim_id,
    'submitted'::text,
    1,
    p_supplier_profile_id,
    v_command_now,
    v_command_now + interval '720 hours',
    false;
  return;
exception
  when sqlstate 'P5100'
    or sqlstate 'P5101'
    or sqlstate 'P5102'
    or sqlstate 'P5103'
    or sqlstate 'P5104'
    or sqlstate 'P5105'
    or sqlstate 'P5106'
    or sqlstate 'P5107'
    or sqlstate 'P5108'
    or sqlstate 'P5109'
    or sqlstate 'P5110'
    or sqlstate 'P5199'
  then
    raise;
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'supplier_ownership_claims_one_active_pair_uidx' then
      raise exception using
        errcode = 'P5106',
        message = 'active_claim_exists';
    end if;
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
  when others then
    raise exception using
      errcode = 'P5199',
      message = 'integrity_reconciliation_required';
end
$function$;

comment on function supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid) is
  'Local trusted supplier_claim.submit v1 command. It derives the claimant only from claim_security.current_claim_user_profile_id(), validates bounded non-file evidence, reserves shared idempotency, takes versioned principal/Supplier locks, inserts one submitted Claim and one claim_submitted event, completes the safe result atomically, and writes no notification or ordinary-submit audit row.';

alter function supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid)
  owner to postgres;

revoke all on function supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid)
  from public, anon, authenticated, service_role, mujahiz_claim_runtime;
grant execute on function supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid)
  to mujahiz_claim_runtime;
