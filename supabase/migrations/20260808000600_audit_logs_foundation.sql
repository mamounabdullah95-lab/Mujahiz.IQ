-- Thirteenth local SQL slice: empty restricted audit-evidence foundation only.
-- This migration creates no audit data, writer, trigger, RLS, API access, event,
-- idempotency store, retention process, Firebase integration, or hosted capability.

create table internal.audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  legacy_source_identity text,
  action_code text not null,
  action_contract_version integer not null,
  action_class text not null,
  actor_kind text not null,
  actor_user_profile_id uuid,
  actor_source_code text,
  actor_authorization_snapshot text,
  target_entity_type text not null,
  target_id uuid,
  target_external_reference text,
  related_target_entity_type text,
  related_target_id uuid,
  related_target_external_reference text,
  occurred_at timestamptz not null default pg_catalog.statement_timestamp(),
  recorded_at timestamptz not null default pg_catalog.statement_timestamp(),
  source_occurred_at timestamptz,
  environment_code text not null,
  source_system_code text not null,
  producing_component_code text not null,
  source_operation_class text not null,
  outcome_class text not null,
  result_code text not null,
  reason_code text not null,
  safe_context_schema_version text,
  safe_context jsonb,
  correlation_id uuid not null,
  causation_type text,
  causation_id uuid,
  idempotency_reference uuid,
  domain_event_reference uuid,
  migration_batch_reference uuid,
  prior_state_code text,
  result_state_code text,
  prior_record_version integer,
  result_record_version integer,
  changed_field_codes text[] not null default '{}'::text[],
  evidence_digest text,
  evidence_digest_algorithm text,
  evidence_digest_version text,
  restricted_evidence_reference text,
  audit_schema_version text not null,
  action_evidence_schema_version text not null,
  authorization_policy_version text not null,
  producer_contract_version text not null,
  minimization_policy_version text not null,
  retention_class text not null,
  legal_hold_classification text,
  predecessor_audit_log_id uuid,
  correction_reason_code text,
  constraint audit_logs_legacy_source_identity_ck check (
    legacy_source_identity is null
    or octet_length(legacy_source_identity) between 1 and 256
  ),
  constraint audit_logs_action_code_ck check (
    octet_length(action_code) between 1 and 128
    and action_code ~ '^[a-z][a-z0-9_]{0,62}(\.[a-z][a-z0-9_]{0,62})*$'
  ),
  constraint audit_logs_action_contract_version_ck check (
    action_contract_version >= 1
  ),
  constraint audit_logs_action_class_ck check (
    action_class ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_actor_kind_ck check (
    actor_kind in ('human_user', 'trusted_service', 'migration_operator', 'automated_worker', 'system')
  ),
  constraint audit_logs_actor_source_code_ck check (
    actor_source_code is null
    or actor_source_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_actor_authorization_snapshot_ck check (
    actor_authorization_snapshot is null
    or octet_length(actor_authorization_snapshot) between 1 and 256
  ),
  constraint audit_logs_actor_shape_ck check (
    (actor_kind = 'human_user' and actor_user_profile_id is not null)
    or (actor_kind <> 'human_user' and actor_source_code is not null)
  ),
  constraint audit_logs_target_entity_type_ck check (
    target_entity_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_target_external_reference_ck check (
    target_external_reference is null
    or octet_length(target_external_reference) between 1 and 256
  ),
  constraint audit_logs_target_shape_ck check (
    (target_id is not null) <> (target_external_reference is not null)
  ),
  constraint audit_logs_related_target_entity_type_ck check (
    related_target_entity_type is null
    or related_target_entity_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_related_target_external_reference_ck check (
    related_target_external_reference is null
    or octet_length(related_target_external_reference) between 1 and 256
  ),
  constraint audit_logs_related_target_shape_ck check (
    (
      related_target_entity_type is null
      and related_target_id is null
      and related_target_external_reference is null
    )
    or (
      related_target_entity_type is not null
      and ((related_target_id is not null) <> (related_target_external_reference is not null))
    )
  ),
  constraint audit_logs_environment_code_ck check (
    environment_code in ('local', 'development', 'staging', 'production')
  ),
  constraint audit_logs_source_system_code_ck check (
    source_system_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_producing_component_code_ck check (
    producing_component_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_source_operation_class_ck check (
    source_operation_class ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_outcome_class_ck check (
    outcome_class in ('succeeded', 'rejected', 'conflicted', 'failed', 'corrected')
  ),
  constraint audit_logs_result_code_ck check (
    result_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_reason_code_ck check (
    reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_safe_context_shape_ck check (
    (safe_context_schema_version is null and safe_context is null)
    or (
      octet_length(safe_context_schema_version) between 1 and 64
      and pg_catalog.jsonb_typeof(safe_context) = 'object'
      and octet_length(safe_context::text) <= 4096
    )
  ),
  constraint audit_logs_causation_type_ck check (
    causation_type is null
    or causation_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_causation_shape_ck check (
    (causation_type is null and causation_id is null)
    or (causation_type is not null and causation_id is not null)
  ),
  constraint audit_logs_state_code_ck check (
    (prior_state_code is null or prior_state_code ~ '^[a-z][a-z0-9_]{0,62}$')
    and (result_state_code is null or result_state_code ~ '^[a-z][a-z0-9_]{0,62}$')
  ),
  constraint audit_logs_record_version_ck check (
    (prior_record_version is null or prior_record_version >= 1)
    and (result_record_version is null or result_record_version >= 1)
  ),
  constraint audit_logs_changed_field_codes_ck check (
    cardinality(changed_field_codes) <= 64
  ),
  constraint audit_logs_evidence_digest_shape_ck check (
    (evidence_digest is null and evidence_digest_algorithm is null and evidence_digest_version is null)
    or (
      octet_length(evidence_digest) between 1 and 256
      and evidence_digest_algorithm ~ '^[a-z][a-z0-9_]{0,62}$'
      and octet_length(evidence_digest_version) between 1 and 64
    )
  ),
  constraint audit_logs_restricted_evidence_reference_ck check (
    restricted_evidence_reference is null
    or octet_length(restricted_evidence_reference) between 1 and 256
  ),
  constraint audit_logs_audit_schema_version_ck check (
    octet_length(audit_schema_version) between 1 and 64
  ),
  constraint audit_logs_action_evidence_schema_version_ck check (
    octet_length(action_evidence_schema_version) between 1 and 64
  ),
  constraint audit_logs_authorization_policy_version_ck check (
    octet_length(authorization_policy_version) between 1 and 128
  ),
  constraint audit_logs_producer_contract_version_ck check (
    octet_length(producer_contract_version) between 1 and 128
  ),
  constraint audit_logs_minimization_policy_version_ck check (
    octet_length(minimization_policy_version) between 1 and 128
  ),
  constraint audit_logs_retention_class_ck check (
    retention_class in (
      'privilege_security_authority',
      'claim_ownership_decision',
      'migration_reconciliation',
      'audit_governance_maintenance'
    )
  ),
  constraint audit_logs_legal_hold_classification_ck check (
    legal_hold_classification is null
    or legal_hold_classification ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_correction_shape_ck check (
    (
      outcome_class = 'corrected'
      and predecessor_audit_log_id is not null
      and correction_reason_code is not null
    )
    or (
      outcome_class <> 'corrected'
      and predecessor_audit_log_id is null
      and correction_reason_code is null
    )
  ),
  constraint audit_logs_correction_reason_code_ck check (
    correction_reason_code is null
    or correction_reason_code ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint audit_logs_actor_user_profile_fk foreign key (actor_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint audit_logs_predecessor_audit_log_fk foreign key (predecessor_audit_log_id)
    references internal.audit_logs (id) on delete restrict
);

comment on table internal.audit_logs is
  'Trusted-only empty local durable audit evidence. It records minimized accountable attempts and outcomes, not an outbox, queue, retry store, domain-history replacement, application activity feed, analytics stream, request dump, or runtime log. This foundation creates no rows, writer, trigger, RLS, policy, routine, browser/API grant, idempotency table, domain-event table, retention job, or Firebase integration.';
comment on column internal.audit_logs.actor_user_profile_id is
  'Nullable provider-neutral accountable human profile. It is never a Firebase UID, email, display name, provider subject, session, token, account context, Supplier relationship, organization membership, or direct mutation authority.';
comment on column internal.audit_logs.actor_source_code is
  'Bounded trusted service, migration, worker, or system source identity. When a service acts for a human, both the human profile and source code may be retained; neither is a browser-supplied authority.';
comment on column internal.audit_logs.environment_code is
  'Stable bounded environment identity for the producing audit operation. It is not a hostname, deployment-instance identifier, URL, credential, or browser-supplied authority.';
comment on column internal.audit_logs.source_system_code is
  'Bounded code-owned source-system identity for evidence provenance. It is not a hostname, process identity, token, session, credential, or raw URL.';
comment on column internal.audit_logs.producing_component_code is
  'Bounded code-owned producing component or command identity. It records no deployment instance, process ID, hostname, token, credential, or free-text operator detail.';
comment on column internal.audit_logs.source_operation_class is
  'Bounded source-operation class for audit evidence provenance. It is separate from actor identity, action code, browser input, event delivery, and idempotency semantics.';
comment on column internal.audit_logs.safe_context is
  'Optional bounded versioned safe context only. Future action contracts must allowlist its shape and exclude request bodies, credentials, tokens, secrets, raw exceptions, full before/after snapshots, and protected evidence content.';
comment on column internal.audit_logs.idempotency_reference is
  'Optional opaque correlation UUID only. This foundation creates no internal.idempotency_keys table or foreign-key dependency.';
comment on column internal.audit_logs.domain_event_reference is
  'Optional opaque correlation UUID only. This foundation creates no internal.domain_events table or foreign-key dependency.';
comment on column internal.audit_logs.predecessor_audit_log_id is
  'Restrictive immutable-history link for a corrected interpretation. It never authorizes an in-place rewrite, ordinary deletion, or event delivery.';
comment on column internal.audit_logs.retention_class is
  'Conceptual retention classification only. It creates no duration, hold decision, purge, archive, compaction, privacy-erasure, pseudonymization, backup, or maintenance authority.';

create unique index audit_logs_legacy_source_identity_uk
  on internal.audit_logs (legacy_source_identity)
  where legacy_source_identity is not null;

create index audit_logs_actor_occurred_at_idx
  on internal.audit_logs (actor_user_profile_id, occurred_at desc, id)
  where actor_user_profile_id is not null;

create index audit_logs_target_occurred_at_idx
  on internal.audit_logs (target_entity_type, target_id, occurred_at desc, id)
  where target_id is not null;

create index audit_logs_action_occurred_at_idx
  on internal.audit_logs (action_code, occurred_at desc, id);

create index audit_logs_correlation_recorded_at_idx
  on internal.audit_logs (correlation_id, recorded_at desc, id);

revoke all on table internal.audit_logs from public, anon, authenticated, service_role;
