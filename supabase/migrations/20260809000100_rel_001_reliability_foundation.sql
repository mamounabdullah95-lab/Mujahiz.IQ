-- Fourteenth local SQL slice: empty, fully revoked REL-001 reliability foundation.
-- This migration creates no rows, trusted command, Claim aggregate, audit writer,
-- notification table/materializer, trigger, worker, RLS, API grant, hosted capability,
-- Firebase integration, or migration/replay execution.

create table internal.idempotency_keys (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  command_name text not null,
  command_contract_version integer not null,
  environment_code text not null,
  principal_kind text not null,
  principal_user_profile_id uuid,
  principal_source_code text,
  target_aggregate_type text,
  target_aggregate_id uuid,
  upstream_source_system_code text,
  upstream_request_identity text,
  key_digest bytea not null,
  key_digest_key_version text not null,
  request_fingerprint bytea not null,
  request_fingerprint_key_version text not null,
  status text not null default 'processing',
  lease_token_digest bytea,
  lease_digest_key_version text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 1,
  outcome_code text,
  result_resource_type text,
  result_resource_id uuid,
  result_version_token text,
  failure_code text,
  retry_disposition text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  completed_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz not null,
  constraint idempotency_keys_command_name_ck check (
    command_name ~ '^[a-z][a-z0-9_]{0,62}(\.[a-z][a-z0-9_]{0,62})*$'
  ),
  constraint idempotency_keys_command_contract_version_ck check (command_contract_version >= 1),
  constraint idempotency_keys_environment_code_ck check (
    environment_code in ('local', 'development', 'staging', 'production')
  ),
  constraint idempotency_keys_principal_kind_ck check (
    principal_kind in ('human_user', 'trusted_service', 'migration_operator', 'automated_worker', 'system')
  ),
  constraint idempotency_keys_principal_source_code_ck check (
    principal_source_code is null or principal_source_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint idempotency_keys_principal_shape_ck check (
    (principal_kind = 'human_user' and principal_user_profile_id is not null)
    or (principal_kind <> 'human_user' and principal_source_code is not null)
  ),
  constraint idempotency_keys_target_aggregate_type_ck check (
    target_aggregate_type is null or target_aggregate_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint idempotency_keys_target_aggregate_shape_ck check (
    (target_aggregate_type is null and target_aggregate_id is null)
    or (target_aggregate_type is not null and target_aggregate_id is not null)
  ),
  constraint idempotency_keys_upstream_source_system_code_ck check (
    upstream_source_system_code is null or upstream_source_system_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint idempotency_keys_upstream_request_identity_ck check (
    upstream_request_identity is null or octet_length(upstream_request_identity) between 1 and 256
  ),
  constraint idempotency_keys_upstream_source_shape_ck check (
    (upstream_source_system_code is null) = (upstream_request_identity is null)
  ),
  constraint idempotency_keys_key_digest_ck check (octet_length(key_digest) = 32),
  constraint idempotency_keys_key_digest_key_version_ck check (
    octet_length(key_digest_key_version) between 1 and 64
  ),
  constraint idempotency_keys_request_fingerprint_ck check (octet_length(request_fingerprint) = 32),
  constraint idempotency_keys_request_fingerprint_key_version_ck check (
    octet_length(request_fingerprint_key_version) between 1 and 64
  ),
  constraint idempotency_keys_status_ck check (status in ('processing', 'completed', 'failed')),
  constraint idempotency_keys_lease_shape_ck check (
    (lease_token_digest is null and lease_digest_key_version is null and lease_expires_at is null)
    or (
      octet_length(lease_token_digest) = 32
      and octet_length(lease_digest_key_version) between 1 and 64
      and lease_expires_at > created_at
    )
  ),
  constraint idempotency_keys_attempt_count_ck check (attempt_count >= 1),
  constraint idempotency_keys_outcome_code_ck check (
    outcome_code is null or outcome_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint idempotency_keys_result_resource_type_ck check (
    result_resource_type is null or result_resource_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint idempotency_keys_result_resource_shape_ck check (
    (result_resource_type is null and result_resource_id is null)
    or (result_resource_type is not null and result_resource_id is not null)
  ),
  constraint idempotency_keys_result_version_token_ck check (
    result_version_token is null or octet_length(result_version_token) between 1 and 128
  ),
  constraint idempotency_keys_failure_code_ck check (
    failure_code is null or failure_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint idempotency_keys_retry_disposition_ck check (
    retry_disposition is null or retry_disposition in ('retryable', 'terminal')
  ),
  constraint idempotency_keys_lifecycle_shape_ck check (
    (
      status = 'processing'
      and lease_token_digest is not null
      and outcome_code is null
      and result_resource_type is null
      and result_resource_id is null
      and result_version_token is null
      and failure_code is null
      and retry_disposition is null
      and next_attempt_at is null
      and completed_at is null
      and failed_at is null
    )
    or (
      status = 'completed'
      and lease_token_digest is null
      and outcome_code is not null
      and failure_code is null
      and retry_disposition is null
      and next_attempt_at is null
      and completed_at is not null
      and failed_at is null
    )
    or (
      status = 'failed'
      and lease_token_digest is null
      and outcome_code is null
      and result_resource_type is null
      and result_resource_id is null
      and result_version_token is null
      and failure_code is not null
      and retry_disposition is not null
      and failed_at is not null
      and completed_at is null
      and (retry_disposition = 'retryable') = (next_attempt_at is not null)
    )
  ),
  constraint idempotency_keys_terminal_timestamp_order_ck check (
    (completed_at is null or completed_at >= created_at)
    and (failed_at is null or failed_at >= created_at)
    and expires_at > created_at
  ),
  constraint idempotency_keys_namespace_uk unique (
    environment_code, command_name, command_contract_version, key_digest
  ),
  constraint idempotency_keys_principal_user_profile_fk foreign key (principal_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

create table internal.domain_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_type text not null,
  event_schema_version integer not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_sequence bigint not null,
  producer_command_name text not null,
  producer_command_contract_version integer not null,
  producer_idempotency_key_id uuid,
  source_operation_identity text,
  source_system_code text not null,
  source_stream_code text,
  source_event_id text,
  event_ordinal integer not null,
  actor_kind text not null,
  actor_user_profile_id uuid,
  actor_source_code text,
  environment_code text not null,
  producing_component_code text not null,
  correlation_id uuid not null,
  causation_event_id uuid,
  occurred_at timestamptz not null default pg_catalog.statement_timestamp(),
  persisted_at timestamptz not null default pg_catalog.statement_timestamp(),
  payload jsonb not null,
  processing_status text not null default 'pending',
  available_at timestamptz not null default pg_catalog.statement_timestamp(),
  lease_token_digest bytea,
  lease_digest_key_version text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error_class text,
  last_error_code text,
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  is_historical boolean not null default false,
  fanout_suppressed boolean not null default false,
  migration_classification_code text,
  constraint domain_events_event_type_ck check (
    event_type ~ '^[a-z][a-z0-9_]{0,62}(\.[a-z][a-z0-9_]{0,62})*$'
  ),
  constraint domain_events_event_schema_version_ck check (event_schema_version >= 1),
  constraint domain_events_aggregate_type_ck check (
    aggregate_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_aggregate_sequence_ck check (aggregate_sequence >= 1),
  constraint domain_events_producer_command_name_ck check (
    producer_command_name ~ '^[a-z][a-z0-9_]{0,62}(\.[a-z][a-z0-9_]{0,62})*$'
  ),
  constraint domain_events_producer_command_contract_version_ck check (producer_command_contract_version >= 1),
  constraint domain_events_source_operation_identity_ck check (
    source_operation_identity is null or octet_length(source_operation_identity) between 1 and 256
  ),
  constraint domain_events_source_system_code_ck check (
    source_system_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_source_stream_code_ck check (
    source_stream_code is null or source_stream_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_source_event_id_ck check (
    source_event_id is null or octet_length(source_event_id) between 1 and 256
  ),
  constraint domain_events_source_event_shape_ck check (
    (source_stream_code is null) = (source_event_id is null)
  ),
  constraint domain_events_producer_identity_ck check (
    producer_idempotency_key_id is not null
    or source_operation_identity is not null
    or (source_stream_code is not null and source_event_id is not null)
  ),
  constraint domain_events_event_ordinal_ck check (event_ordinal >= 1),
  constraint domain_events_actor_kind_ck check (
    actor_kind in ('human_user', 'trusted_service', 'migration_operator', 'automated_worker', 'system')
  ),
  constraint domain_events_actor_source_code_ck check (
    actor_source_code is null or actor_source_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_actor_shape_ck check (
    (actor_kind = 'human_user' and actor_user_profile_id is not null)
    or (actor_kind <> 'human_user' and actor_source_code is not null)
  ),
  constraint domain_events_environment_code_ck check (
    environment_code in ('local', 'development', 'staging', 'production')
  ),
  constraint domain_events_producing_component_code_ck check (
    producing_component_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_causation_ck check (
    causation_event_id is null or causation_event_id <> id
  ),
  constraint domain_events_timestamp_order_ck check (persisted_at >= occurred_at),
  constraint domain_events_payload_ck check (
    pg_catalog.jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 16384
  ),
  constraint domain_events_processing_status_ck check (
    processing_status in ('pending', 'processing', 'processed', 'retryable_failed', 'dead_letter')
  ),
  constraint domain_events_lease_shape_ck check (
    (lease_token_digest is null and lease_digest_key_version is null and lease_expires_at is null)
    or (
      octet_length(lease_token_digest) = 32
      and octet_length(lease_digest_key_version) between 1 and 64
      and lease_expires_at > persisted_at
    )
  ),
  constraint domain_events_attempt_count_ck check (attempt_count >= 0),
  constraint domain_events_last_error_class_ck check (
    last_error_class is null or last_error_class ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_last_error_code_ck check (
    last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint domain_events_processing_shape_ck check (
    (
      processing_status = 'pending'
      and lease_token_digest is null
      and next_attempt_at is null
      and last_error_class is null
      and last_error_code is null
      and processed_at is null
      and dead_lettered_at is null
    )
    or (
      processing_status = 'processing'
      and lease_token_digest is not null
      and attempt_count >= 1
      and next_attempt_at is null
      and processed_at is null
      and dead_lettered_at is null
    )
    or (
      processing_status = 'processed'
      and lease_token_digest is null
      and next_attempt_at is null
      and processed_at is not null
      and dead_lettered_at is null
    )
    or (
      processing_status = 'retryable_failed'
      and lease_token_digest is null
      and next_attempt_at is not null
      and last_error_class is not null
      and last_error_code is not null
      and processed_at is null
      and dead_lettered_at is null
    )
    or (
      processing_status = 'dead_letter'
      and lease_token_digest is null
      and next_attempt_at is null
      and last_error_class is not null
      and last_error_code is not null
      and processed_at is null
      and dead_lettered_at is not null
    )
  ),
  constraint domain_events_processing_timestamp_order_ck check (
    (processed_at is null or processed_at >= persisted_at)
    and (dead_lettered_at is null or dead_lettered_at >= persisted_at)
  ),
  constraint domain_events_migration_suppression_ck check (
    (not is_historical and not fanout_suppressed and migration_classification_code is null)
    or (
      is_historical
      and fanout_suppressed
      and migration_classification_code ~ '^[a-z][a-z0-9_]{0,62}$'
      and processing_status in ('processed', 'dead_letter')
    )
  ),
  constraint domain_events_aggregate_sequence_uk unique (aggregate_type, aggregate_id, aggregate_sequence),
  constraint domain_events_producer_idempotency_key_fk foreign key (producer_idempotency_key_id)
    references internal.idempotency_keys (id) on delete restrict,
  constraint domain_events_actor_user_profile_fk foreign key (actor_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint domain_events_causation_event_fk foreign key (causation_event_id)
    references internal.domain_events (id) on delete restrict
);

comment on table internal.idempotency_keys is
  'Trusted-only empty local REL-001 replay foundation. Each row binds one registered command invocation to opaque HMAC digests, a bounded safe result reference, and a fenced lifecycle. It is not a request log, response cache, audit record, aggregate lock, event history, notification, queue, worker, or runtime command implementation. Raw keys, request bodies, credentials, tokens, PII, and serialized responses are prohibited.';
comment on column internal.idempotency_keys.key_digest is
  'Required 32-byte HMAC-SHA-256 digest of the versioned length-delimited command namespace and caller key. The raw caller key is never stored, logged, returned, or copied into a domain event.';
comment on column internal.idempotency_keys.request_fingerprint is
  'Required 32-byte HMAC-SHA-256 digest of the command-owned canonical request projection. It excludes raw request bodies, authentication material, transport metadata, retry counts, and server-generated timestamps.';
comment on column internal.idempotency_keys.result_resource_id is
  'Optional opaque UUID result binding only. This generic foundation intentionally adds no polymorphic result foreign key before a registered command defines an unambiguous target.';
comment on column internal.idempotency_keys.expires_at is
  'Structural replay-expiry boundary only. It creates no TTL, compaction, tombstone, deletion, retention, or maintenance authority.';

comment on table internal.domain_events is
  'Trusted-only empty local REL-001 immutable integration-fact and one-processor outbox foundation. It is not event sourcing, an audit log, notification content, a general job queue, mutable aggregate state, a notification table, worker, trigger, or runtime materializer. Payloads are bounded safe registry-controlled JSON only; request bodies, audit details, notification copy, PII, credentials, tokens, URLs, and unrestricted metadata are prohibited.';
comment on column internal.domain_events.producer_idempotency_key_id is
  'Optional restrictive producer-command replay link. Commands without caller keys require separately reviewed durable source-operation identity; this column does not create a command, registry, or writer.';
comment on column internal.domain_events.causation_event_id is
  'Optional restrictive direct-cause link to an earlier event. It is not a mutable workflow pointer, user-supplied event identity, or authorization source.';
comment on column internal.domain_events.payload is
  'Required immutable JSON object limited to 16 KiB. A future code/documentation-owned event registry defines its exact minimum shape and forbidden fields; this foundation stores no notification snapshot or audit detail.';
comment on column internal.domain_events.fanout_suppressed is
  'Historical migration/replay suppression boundary only. It creates no migration importer, event replay, notification fan-out, cleanup, or data movement authority.';

create unique index domain_events_producer_idempotency_ordinal_uk
  on internal.domain_events (producer_idempotency_key_id, event_ordinal)
  where producer_idempotency_key_id is not null;

create unique index domain_events_source_operation_ordinal_uk
  on internal.domain_events (source_system_code, source_operation_identity, event_ordinal)
  where source_operation_identity is not null;

create unique index domain_events_import_source_identity_uk
  on internal.domain_events (source_system_code, source_stream_code, source_event_id)
  where source_stream_code is not null;

create index domain_events_processing_queue_idx
  on internal.domain_events (processing_status, available_at, persisted_at, id)
  where processing_status in ('pending', 'retryable_failed');

create index domain_events_aggregate_history_idx
  on internal.domain_events (aggregate_type, aggregate_id, aggregate_sequence);

revoke all on table internal.idempotency_keys from public, anon, authenticated, service_role;
revoke all on table internal.domain_events from public, anon, authenticated, service_role;
