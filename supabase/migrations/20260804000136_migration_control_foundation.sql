-- Local-only migration governance foundation.
-- The internal schema is intentionally absent from Supabase Data API exposed schemas.

create schema if not exists internal;

comment on schema internal is
  'Trusted-only operational relations. Browser clients and the Supabase Data API must never expose this schema.';

create table internal.migration_batches (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  execution_environment text not null,
  migration_scope text not null,
  source_system text not null,
  source_snapshot_reference text not null,
  transformation_version text not null,
  schema_version text not null,
  code_version text,
  status text not null,
  initiated_by text not null,
  metadata_schema_version text not null default 'migration-batch-metadata-v1',
  metadata jsonb not null default '{}'::jsonb,
  failure_reason text,
  rollback_reference text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint migration_batches_environment_ck check (
    execution_environment in ('local', 'development', 'staging', 'production')
  ),
  constraint migration_batches_scope_ck check (
    migration_scope ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint migration_batches_source_system_ck check (
    source_system ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint migration_batches_source_snapshot_reference_ck check (
    octet_length(source_snapshot_reference) between 1 and 256
  ),
  constraint migration_batches_transformation_version_ck check (
    octet_length(transformation_version) between 1 and 64
  ),
  constraint migration_batches_schema_version_ck check (
    octet_length(schema_version) between 1 and 64
  ),
  constraint migration_batches_code_version_ck check (
    code_version is null or octet_length(code_version) between 1 and 64
  ),
  constraint migration_batches_status_ck check (
    status in ('planned', 'running', 'validating', 'completed', 'failed', 'cancelled', 'rolled_back')
  ),
  constraint migration_batches_initiated_by_ck check (
    octet_length(initiated_by) between 1 and 200
  ),
  constraint migration_batches_metadata_schema_version_ck check (
    metadata_schema_version = 'migration-batch-metadata-v1'
  ),
  constraint migration_batches_metadata_ck check (
    pg_catalog.jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 16384
    and metadata - array['approval_reference', 'source_manifest_digest', 'execution_reference'] = '{}'::jsonb
    and (
      not metadata ? 'approval_reference'
      or (
        pg_catalog.jsonb_typeof(metadata -> 'approval_reference') = 'string'
        and octet_length(metadata ->> 'approval_reference') between 1 and 256
      )
    )
    and (
      not metadata ? 'source_manifest_digest'
      or (
        pg_catalog.jsonb_typeof(metadata -> 'source_manifest_digest') = 'string'
        and (metadata ->> 'source_manifest_digest') ~ '^[0-9a-f]{64}$'
      )
    )
    and (
      not metadata ? 'execution_reference'
      or (
        pg_catalog.jsonb_typeof(metadata -> 'execution_reference') = 'string'
        and octet_length(metadata ->> 'execution_reference') between 1 and 128
      )
    )
  ),
  constraint migration_batches_failure_reason_ck check (
    failure_reason is null or octet_length(failure_reason) between 1 and 1000
  ),
  constraint migration_batches_rollback_reference_ck check (
    rollback_reference is null or octet_length(rollback_reference) between 1 and 256
  ),
  constraint migration_batches_status_timestamps_ck check (
    (status = 'planned' and started_at is null and completed_at is null)
    or (status in ('running', 'validating') and started_at is not null and completed_at is null)
    or (status in ('completed', 'failed', 'rolled_back') and started_at is not null and completed_at is not null)
    or (status = 'cancelled' and completed_at is not null)
  ),
  constraint migration_batches_failure_state_ck check (
    (status in ('failed', 'cancelled')) = (failure_reason is not null)
  ),
  constraint migration_batches_rollback_state_ck check (
    status <> 'rolled_back' or rollback_reference is not null
  ),
  constraint migration_batches_timestamp_order_ck check (
    (started_at is null or started_at >= created_at)
    and (completed_at is null or completed_at >= created_at)
    and (started_at is null or completed_at is null or completed_at >= started_at)
  ),
  constraint migration_batches_id_transformation_uk unique (
    id,
    transformation_version
  ),
  constraint migration_batches_replay_identity_uk unique (
    execution_environment,
    source_system,
    source_snapshot_reference,
    migration_scope,
    transformation_version,
    schema_version
  )
);

comment on table internal.migration_batches is
  'Trusted migration execution units. Rows contain bounded operational metadata only and never source documents.';
comment on column internal.migration_batches.source_snapshot_reference is
  'Immutable, bounded reference to an approved source checkpoint; never a raw export or credential.';
comment on column internal.migration_batches.initiated_by is
  'Trusted actor or process reference; deliberately has no application-user foreign key in this slice.';
comment on column internal.migration_batches.metadata is
  'Bounded non-secret object metadata. Full source records and unrestricted payloads are prohibited.';

create index migration_batches_status_created_idx
  on internal.migration_batches (status, created_at, id);

create table internal.migration_source_dispositions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  migration_batch_id uuid not null,
  source_collection text not null,
  source_document_id text not null,
  source_version text not null,
  disposition text not null,
  reason_code text not null,
  transformation_version text not null,
  source_classification text not null default 'unknown',
  evidence_digest text,
  is_active boolean not null default true,
  supersedes_disposition_id uuid,
  supersession_reason_code text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  superseded_at timestamptz,
  constraint migration_source_dispositions_batch_fk foreign key (
    migration_batch_id,
    transformation_version
  ) references internal.migration_batches (
    id,
    transformation_version
  ) on delete restrict,
  constraint migration_source_dispositions_source_collection_ck check (
    source_collection ~ '^[A-Za-z][A-Za-z0-9_]{0,126}$'
  ),
  constraint migration_source_dispositions_source_document_id_ck check (
    octet_length(source_document_id) between 1 and 512
  ),
  constraint migration_source_dispositions_source_version_ck check (
    octet_length(source_version) between 1 and 128
  ),
  constraint migration_source_dispositions_disposition_ck check (
    disposition in ('pending', 'migrated', 'skipped', 'quarantined', 'merged', 'rejected', 'no_target')
  ),
  constraint migration_source_dispositions_reason_code_ck check (
    reason_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
  ),
  constraint migration_source_dispositions_transformation_version_ck check (
    octet_length(transformation_version) between 1 and 64
  ),
  constraint migration_source_dispositions_classification_ck check (
    source_classification in ('production', 'test', 'unknown')
  ),
  constraint migration_source_dispositions_evidence_digest_ck check (
    evidence_digest is null or evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint migration_source_dispositions_active_state_ck check (
    is_active = (superseded_at is null)
  ),
  constraint migration_source_dispositions_supersession_time_ck check (
    superseded_at is null or superseded_at >= created_at
  ),
  constraint migration_source_dispositions_no_self_supersession_ck check (
    supersedes_disposition_id is null or supersedes_disposition_id <> id
  ),
  constraint migration_source_dispositions_supersession_reason_ck check (
    (supersedes_disposition_id is null) = (supersession_reason_code is null)
    and (
      supersession_reason_code is null
      or supersession_reason_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
    )
  ),
  constraint migration_source_dispositions_id_batch_uk unique (id, migration_batch_id),
  constraint migration_source_dispositions_id_batch_outcome_uk unique (
    id,
    migration_batch_id,
    disposition
  ),
  constraint migration_source_dispositions_id_batch_outcome_active_uk unique (
    id,
    migration_batch_id,
    disposition,
    is_active
  ),
  constraint migration_source_dispositions_identity_uk unique (
    id,
    source_collection,
    source_document_id,
    source_version
  ),
  constraint migration_source_dispositions_single_successor_uk unique (supersedes_disposition_id),
  constraint migration_source_dispositions_supersedes_fk foreign key (
    supersedes_disposition_id,
    source_collection,
    source_document_id,
    source_version
  ) references internal.migration_source_dispositions (
    id,
    source_collection,
    source_document_id,
    source_version
  ) on delete restrict
);

comment on table internal.migration_source_dispositions is
  'One active outcome per batch/source collection/document/version plus append-and-supersede history.';
comment on column internal.migration_source_dispositions.source_document_id is
  'Bounded legacy source identity. It is trace evidence, never a relational primary key.';
comment on column internal.migration_source_dispositions.source_version is
  'Deterministic source version identity such as an approved update-time or content-version token.';
comment on column internal.migration_source_dispositions.evidence_digest is
  'Optional lowercase SHA-256 evidence digest; source payloads are never stored here.';

create unique index migration_source_dispositions_active_identity_uidx
  on internal.migration_source_dispositions (
    migration_batch_id,
    source_collection,
    source_document_id,
    source_version
  )
  where is_active;

create index migration_source_dispositions_active_outcome_idx
  on internal.migration_source_dispositions (
    migration_batch_id,
    disposition,
    created_at,
    id
  )
  where is_active;

create index migration_source_dispositions_identity_history_idx
  on internal.migration_source_dispositions (
    migration_batch_id,
    source_collection,
    source_document_id,
    source_version,
    created_at,
    id
  );

create table internal.migration_record_mappings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  mapping_lineage_id uuid not null default pg_catalog.gen_random_uuid(),
  migration_batch_id uuid not null,
  record_kind text not null,
  source_disposition_id uuid,
  source_disposition_outcome text,
  source_disposition_is_active boolean not null default true,
  target_logical_type text not null,
  target_id uuid not null,
  mapping_role text not null,
  child_key text,
  child_ordinal integer,
  logical_child_locator text generated always as (
    case
      when child_key is not null then 'key:' || child_key
      when child_ordinal is not null then 'ordinal:' || child_ordinal::text
      else 'merge_group'
    end
  ) stored,
  transformation_version text not null,
  rollback_dependency_order integer not null,
  target_evidence_digest text,
  merge_reason_code text,
  review_status text,
  reviewed_by text,
  reviewed_at timestamptz,
  approval_reference text,
  reconciliation_reference text,
  reconciliation_evidence_digest text,
  reconciliation_status text,
  is_active boolean not null default true,
  supersedes_mapping_id uuid,
  supersession_reason_code text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  superseded_at timestamptz,
  constraint migration_record_mappings_batch_fk foreign key (
    migration_batch_id,
    transformation_version
  ) references internal.migration_batches (
    id,
    transformation_version
  ) on delete restrict,
  constraint migration_record_mappings_record_kind_ck check (
    record_kind in ('ordinary_mapping', 'merge_group')
  ),
  constraint migration_record_mappings_target_logical_type_ck check (
    target_logical_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint migration_record_mappings_mapping_role_ck check (
    mapping_role in ('root', 'normalized_child', 'legacy_event', 'reconciliation_evidence')
  ),
  constraint migration_record_mappings_child_key_ck check (
    child_key is null or octet_length(child_key) between 1 and 256
  ),
  constraint migration_record_mappings_child_ordinal_ck check (
    child_ordinal is null or child_ordinal >= 0
  ),
  constraint migration_record_mappings_transformation_version_ck check (
    octet_length(transformation_version) between 1 and 64
  ),
  constraint migration_record_mappings_rollback_order_ck check (
    rollback_dependency_order >= 0
  ),
  constraint migration_record_mappings_target_digest_ck check (
    target_evidence_digest is null or target_evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint migration_record_mappings_merge_reason_code_ck check (
    merge_reason_code is null or merge_reason_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
  ),
  constraint migration_record_mappings_review_status_ck check (
    review_status is null or review_status in ('approved', 'rejected')
  ),
  constraint migration_record_mappings_reviewed_by_ck check (
    reviewed_by is null or octet_length(reviewed_by) between 1 and 200
  ),
  constraint migration_record_mappings_approval_reference_ck check (
    approval_reference is null or octet_length(approval_reference) between 1 and 256
  ),
  constraint migration_record_mappings_reconciliation_reference_ck check (
    reconciliation_reference is null or octet_length(reconciliation_reference) between 1 and 128
  ),
  constraint migration_record_mappings_reconciliation_digest_ck check (
    reconciliation_evidence_digest is null
    or reconciliation_evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint migration_record_mappings_reconciliation_status_ck check (
    reconciliation_status is null
    or reconciliation_status in ('pending', 'passed', 'warning', 'failed')
  ),
  constraint migration_record_mappings_kind_shape_ck check (
    (
      record_kind = 'ordinary_mapping'
      and source_disposition_id is not null
      and source_disposition_outcome is not null
      and source_disposition_outcome in ('migrated', 'merged')
      and ((child_key is not null)::integer + (child_ordinal is not null)::integer) = 1
      and merge_reason_code is null
      and review_status is null
      and reviewed_by is null
      and reviewed_at is null
      and approval_reference is null
      and reconciliation_reference is null
      and reconciliation_evidence_digest is null
      and reconciliation_status is null
    )
    or
    (
      record_kind = 'merge_group'
      and source_disposition_id is null
      and source_disposition_outcome is null
      and child_key is null
      and child_ordinal is null
      and merge_reason_code is not null
      and review_status = 'approved'
      and reviewed_by is not null
      and reviewed_at is not null
      and approval_reference is not null
      and reconciliation_reference is not null
      and reconciliation_evidence_digest is not null
      and reconciliation_status = 'passed'
    )
  ),
  constraint migration_record_mappings_active_source_ck check (
    record_kind <> 'ordinary_mapping'
    or not is_active
    or source_disposition_is_active
  ),
  constraint migration_record_mappings_active_state_ck check (
    is_active = (superseded_at is null)
  ),
  constraint migration_record_mappings_supersession_time_ck check (
    superseded_at is null or superseded_at >= created_at
  ),
  constraint migration_record_mappings_no_self_supersession_ck check (
    supersedes_mapping_id is null or supersedes_mapping_id <> id
  ),
  constraint migration_record_mappings_supersession_reason_ck check (
    (supersedes_mapping_id is null) = (supersession_reason_code is null)
    and (
      supersession_reason_code is null
      or supersession_reason_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
    )
  ),
  constraint migration_record_mappings_id_batch_kind_uk unique (
    id,
    migration_batch_id,
    record_kind
  ),
  constraint migration_record_mappings_id_kind_uk unique (
    id,
    record_kind
  ),
  constraint migration_record_mappings_supersession_identity_uk unique (
    id,
    mapping_lineage_id,
    record_kind,
    target_logical_type,
    mapping_role,
    logical_child_locator
  ),
  constraint migration_record_mappings_id_batch_kind_active_uk unique (
    id,
    migration_batch_id,
    record_kind,
    is_active
  ),
  constraint migration_record_mappings_group_identity_active_uk unique (
    id,
    migration_batch_id,
    record_kind,
    target_logical_type,
    mapping_role,
    is_active
  ),
  constraint migration_record_mappings_single_successor_uk unique (supersedes_mapping_id),
  constraint migration_record_mappings_source_fk foreign key (
    source_disposition_id,
    migration_batch_id,
    source_disposition_outcome,
    source_disposition_is_active
  ) references internal.migration_source_dispositions (
    id,
    migration_batch_id,
    disposition,
    is_active
  ) on delete restrict deferrable initially immediate,
  constraint migration_record_mappings_supersedes_fk foreign key (
    supersedes_mapping_id,
    mapping_lineage_id,
    record_kind,
    target_logical_type,
    mapping_role,
    logical_child_locator
  ) references internal.migration_record_mappings (
    id,
    mapping_lineage_id,
    record_kind,
    target_logical_type,
    mapping_role,
    logical_child_locator
  ) on delete restrict
);

comment on table internal.migration_record_mappings is
  'Active and superseded ordinary source-child mappings plus reviewed merge-group target bindings.';
comment on column internal.migration_record_mappings.record_kind is
  'ordinary_mapping binds one migrated or merged source child; merge_group binds one reviewed canonical many-source target.';
comment on column internal.migration_record_mappings.mapping_lineage_id is
  'Opaque database-generated lineage identity. A reviewed successor must copy its predecessor lineage ID.';
comment on column internal.migration_record_mappings.child_key is
  'Preferred versioned semantic child identity. Exactly one of child_key or child_ordinal is required for ordinary mappings.';
comment on column internal.migration_record_mappings.child_ordinal is
  'Deterministic nonnegative ordinal used only when no stable semantic child key exists.';
comment on column internal.migration_record_mappings.rollback_dependency_order is
  'Target dependency rank used by a separately approved rollback planner; higher dependencies reverse first.';

create unique index migration_record_mappings_active_lineage_uidx
  on internal.migration_record_mappings (mapping_lineage_id)
  where is_active;

create unique index migration_record_mappings_active_key_slot_uidx
  on internal.migration_record_mappings (
    source_disposition_id,
    target_logical_type,
    mapping_role,
    child_key
  )
  where is_active and record_kind = 'ordinary_mapping' and child_key is not null;

create unique index migration_record_mappings_active_ordinal_slot_uidx
  on internal.migration_record_mappings (
    source_disposition_id,
    target_logical_type,
    mapping_role,
    child_ordinal
  )
  where is_active and record_kind = 'ordinary_mapping' and child_ordinal is not null;

create unique index migration_record_mappings_active_reverse_target_uidx
  on internal.migration_record_mappings (
    target_logical_type,
    target_id,
    mapping_role
  )
  where is_active;

create index migration_record_mappings_source_history_idx
  on internal.migration_record_mappings (
    source_disposition_id,
    created_at,
    id
  )
  where source_disposition_id is not null;

create index migration_record_mappings_target_history_idx
  on internal.migration_record_mappings (
    target_logical_type,
    target_id,
    mapping_role,
    created_at,
    id
  );

create index migration_record_mappings_rollback_trace_idx
  on internal.migration_record_mappings (
    migration_batch_id,
    rollback_dependency_order desc,
    target_logical_type,
    target_id
  )
  where is_active;

create index migration_record_mappings_batch_history_idx
  on internal.migration_record_mappings (
    migration_batch_id,
    created_at,
    id
  );

create table internal.migration_merge_group_members (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  member_lineage_id uuid not null default pg_catalog.gen_random_uuid(),
  migration_batch_id uuid not null,
  merge_group_mapping_id uuid not null,
  merge_group_record_kind text not null default 'merge_group',
  merge_group_is_active boolean not null default true,
  target_logical_type text not null,
  target_mapping_role text not null,
  source_disposition_id uuid not null,
  source_disposition_outcome text not null default 'merged',
  source_disposition_is_active boolean not null default true,
  child_key text,
  child_ordinal integer,
  logical_child_locator text generated always as (
    case
      when child_key is not null then 'key:' || child_key
      else 'ordinal:' || child_ordinal::text
    end
  ) stored,
  member_role text not null,
  contribution_order integer not null,
  transformation_version text not null,
  evidence_digest text,
  is_active boolean not null default true,
  supersedes_member_id uuid,
  supersession_reason_code text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  superseded_at timestamptz,
  constraint migration_merge_group_members_batch_fk foreign key (
    migration_batch_id,
    transformation_version
  ) references internal.migration_batches (
    id,
    transformation_version
  ) on delete restrict,
  constraint migration_merge_group_members_group_kind_ck check (
    merge_group_record_kind = 'merge_group'
  ),
  constraint migration_merge_group_members_source_outcome_ck check (
    source_disposition_outcome = 'merged'
  ),
  constraint migration_merge_group_members_target_type_ck check (
    target_logical_type ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint migration_merge_group_members_target_role_ck check (
    target_mapping_role in ('root', 'normalized_child', 'legacy_event', 'reconciliation_evidence')
  ),
  constraint migration_merge_group_members_child_shape_ck check (
    ((child_key is not null)::integer + (child_ordinal is not null)::integer) = 1
  ),
  constraint migration_merge_group_members_child_key_ck check (
    child_key is null or octet_length(child_key) between 1 and 256
  ),
  constraint migration_merge_group_members_child_ordinal_ck check (
    child_ordinal is null or child_ordinal >= 0
  ),
  constraint migration_merge_group_members_role_ck check (
    member_role in ('canonical_source', 'contributor')
  ),
  constraint migration_merge_group_members_order_ck check (
    contribution_order >= 0
  ),
  constraint migration_merge_group_members_transformation_version_ck check (
    octet_length(transformation_version) between 1 and 64
  ),
  constraint migration_merge_group_members_evidence_digest_ck check (
    evidence_digest is null or evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint migration_merge_group_members_active_state_ck check (
    is_active = (superseded_at is null)
  ),
  constraint migration_merge_group_members_active_parents_ck check (
    not is_active
    or (source_disposition_is_active and merge_group_is_active)
  ),
  constraint migration_merge_group_members_supersession_time_ck check (
    superseded_at is null or superseded_at >= created_at
  ),
  constraint migration_merge_group_members_no_self_supersession_ck check (
    supersedes_member_id is null or supersedes_member_id <> id
  ),
  constraint migration_merge_group_members_supersession_reason_ck check (
    (supersedes_member_id is null) = (supersession_reason_code is null)
    and (
      supersession_reason_code is null
      or supersession_reason_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
    )
  ),
  constraint migration_merge_group_members_id_group_uk unique (
    id,
    migration_batch_id,
    merge_group_mapping_id
  ),
  constraint migration_merge_group_members_supersession_identity_uk unique (
    id,
    member_lineage_id,
    target_logical_type,
    target_mapping_role,
    logical_child_locator
  ),
  constraint migration_merge_group_members_single_successor_uk unique (supersedes_member_id),
  constraint migration_merge_group_members_group_fk foreign key (
    merge_group_mapping_id,
    migration_batch_id,
    merge_group_record_kind,
    target_logical_type,
    target_mapping_role,
    merge_group_is_active
  ) references internal.migration_record_mappings (
    id,
    migration_batch_id,
    record_kind,
    target_logical_type,
    mapping_role,
    is_active
  ) on delete restrict deferrable initially immediate,
  constraint migration_merge_group_members_source_fk foreign key (
    source_disposition_id,
    migration_batch_id,
    source_disposition_outcome,
    source_disposition_is_active
  ) references internal.migration_source_dispositions (
    id,
    migration_batch_id,
    disposition,
    is_active
  ) on delete restrict deferrable initially immediate,
  constraint migration_merge_group_members_supersedes_fk foreign key (
    supersedes_member_id,
    member_lineage_id,
    target_logical_type,
    target_mapping_role,
    logical_child_locator
  ) references internal.migration_merge_group_members (
    id,
    member_lineage_id,
    target_logical_type,
    target_mapping_role,
    logical_child_locator
  ) on delete restrict
);

comment on table internal.migration_merge_group_members is
  'Contributing merged source-child identities for an approved canonical target binding.';
comment on column internal.migration_merge_group_members.member_lineage_id is
  'Opaque database-generated lineage identity. A reviewed successor must copy its predecessor lineage ID.';
comment on column internal.migration_merge_group_members.contribution_order is
  'Reviewed deterministic order within a merge group; it is not an implicit source-array position.';

create unique index migration_merge_group_members_active_lineage_uidx
  on internal.migration_merge_group_members (member_lineage_id)
  where is_active;

create unique index migration_merge_group_members_active_key_source_uidx
  on internal.migration_merge_group_members (
    source_disposition_id,
    target_logical_type,
    target_mapping_role,
    child_key
  )
  where is_active and child_key is not null;

create unique index migration_merge_group_members_active_ordinal_source_uidx
  on internal.migration_merge_group_members (
    source_disposition_id,
    target_logical_type,
    target_mapping_role,
    child_ordinal
  )
  where is_active and child_ordinal is not null;

create unique index migration_merge_group_members_active_order_uidx
  on internal.migration_merge_group_members (merge_group_mapping_id, contribution_order)
  where is_active;

create unique index migration_merge_group_members_active_canonical_uidx
  on internal.migration_merge_group_members (merge_group_mapping_id)
  where is_active and member_role = 'canonical_source';

create index migration_merge_group_members_group_history_idx
  on internal.migration_merge_group_members (
    merge_group_mapping_id,
    created_at,
    id
  );

create index migration_merge_group_members_source_history_idx
  on internal.migration_merge_group_members (
    source_disposition_id,
    created_at,
    id
  );

create table internal.migration_validation_results (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  migration_batch_id uuid not null,
  source_disposition_id uuid,
  validation_run_reference text not null,
  validation_scope text not null,
  validation_type text not null,
  check_code text not null,
  outcome text not null,
  expected_count bigint,
  actual_count bigint,
  expected_value text,
  actual_value text,
  validator_version text not null,
  source_query_version text,
  target_query_version text,
  evidence_digest text,
  safe_details text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint migration_validation_results_batch_fk foreign key (migration_batch_id)
    references internal.migration_batches (id) on delete restrict,
  constraint migration_validation_results_source_fk foreign key (
    source_disposition_id,
    migration_batch_id
  ) references internal.migration_source_dispositions (
    id,
    migration_batch_id
  ) on delete restrict,
  constraint migration_validation_results_run_reference_ck check (
    octet_length(validation_run_reference) between 1 and 64
  ),
  constraint migration_validation_results_scope_ck check (
    (validation_scope = 'batch' and source_disposition_id is null)
    or (validation_scope = 'source_unit' and source_disposition_id is not null)
  ),
  constraint migration_validation_results_type_ck check (
    validation_type in (
      'count',
      'referential_integrity',
      'content_digest',
      'mapping_integrity',
      'merge_reconciliation',
      'replay',
      'rollback_trace'
    )
  ),
  constraint migration_validation_results_check_code_ck check (
    check_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
  ),
  constraint migration_validation_results_outcome_ck check (
    outcome in ('passed', 'failed', 'warning')
  ),
  constraint migration_validation_results_count_pair_ck check (
    (expected_count is null) = (actual_count is null)
    and (expected_count is null or expected_count >= 0)
    and (actual_count is null or actual_count >= 0)
  ),
  constraint migration_validation_results_value_pair_ck check (
    (expected_value is null) = (actual_value is null)
    and (expected_value is null or octet_length(expected_value) between 1 and 256)
    and (actual_value is null or octet_length(actual_value) between 1 and 256)
  ),
  constraint migration_validation_results_has_comparison_ck check (
    expected_count is not null or expected_value is not null
  ),
  constraint migration_validation_results_passed_matches_ck check (
    outcome <> 'passed'
    or (
      (expected_count is null or expected_count = actual_count)
      and (expected_value is null or expected_value = actual_value)
    )
  ),
  constraint migration_validation_results_validator_version_ck check (
    octet_length(validator_version) between 1 and 64
  ),
  constraint migration_validation_results_source_query_version_ck check (
    source_query_version is null or octet_length(source_query_version) between 1 and 64
  ),
  constraint migration_validation_results_target_query_version_ck check (
    target_query_version is null or octet_length(target_query_version) between 1 and 64
  ),
  constraint migration_validation_results_evidence_digest_ck check (
    evidence_digest is null or evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint migration_validation_results_safe_details_ck check (
    safe_details is null or octet_length(safe_details) between 1 and 1000
  )
);

comment on table internal.migration_validation_results is
  'Versioned batch/source-unit reconciliation evidence intended for append-only trusted workflows, with bounded counts, values, digests, and safe details.';
comment on column internal.migration_validation_results.validation_run_reference is
  'Versioned run identity. A later run appends evidence instead of overwriting an earlier result.';
comment on column internal.migration_validation_results.safe_details is
  'Minimized non-secret detail only; full source records and unrestricted samples are prohibited.';

create unique index migration_validation_results_run_check_uidx
  on internal.migration_validation_results (
    migration_batch_id,
    validation_run_reference,
    validation_scope,
    validation_type,
    check_code,
    source_disposition_id
  ) nulls not distinct;

create index migration_validation_results_batch_outcome_idx
  on internal.migration_validation_results (
    migration_batch_id,
    outcome,
    created_at,
    id
  );

create index migration_validation_results_source_history_idx
  on internal.migration_validation_results (
    source_disposition_id,
    created_at,
    id
  )
  where source_disposition_id is not null;

create table internal.import_errors (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  migration_batch_id uuid,
  source_disposition_id uuid,
  process_type text not null,
  process_reference text not null,
  occurrence_key text not null,
  source_reference text,
  error_category text not null,
  error_code text not null,
  safe_message text not null,
  field_path text,
  severity text not null default 'error',
  retryable boolean not null default false,
  resolution_status text not null default 'open',
  resolution_code text,
  resolved_by text,
  source_evidence_digest text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  resolved_at timestamptz,
  constraint import_errors_batch_fk foreign key (migration_batch_id)
    references internal.migration_batches (id) on delete restrict,
  constraint import_errors_source_fk foreign key (
    source_disposition_id,
    migration_batch_id
  ) references internal.migration_source_dispositions (
    id,
    migration_batch_id
  ) on delete restrict,
  constraint import_errors_source_requires_batch_ck check (
    source_disposition_id is null or migration_batch_id is not null
  ),
  constraint import_errors_process_type_ck check (
    process_type in ('migration', 'supplier_import', 'validation')
  ),
  constraint import_errors_process_reference_ck check (
    octet_length(process_reference) between 1 and 128
  ),
  constraint import_errors_occurrence_key_ck check (
    octet_length(occurrence_key) between 1 and 128
  ),
  constraint import_errors_source_reference_ck check (
    source_reference is null or octet_length(source_reference) between 1 and 512
  ),
  constraint import_errors_category_ck check (
    error_category in ('validation', 'transformation', 'constraint', 'reference', 'conflict', 'security', 'system')
  ),
  constraint import_errors_code_ck check (
    error_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
  ),
  constraint import_errors_safe_message_ck check (
    octet_length(safe_message) between 1 and 1000
  ),
  constraint import_errors_field_path_ck check (
    field_path is null or octet_length(field_path) between 1 and 256
  ),
  constraint import_errors_severity_ck check (
    severity in ('info', 'warning', 'error', 'critical')
  ),
  constraint import_errors_resolution_status_ck check (
    resolution_status in ('open', 'retry_pending', 'resolved', 'waived')
  ),
  constraint import_errors_retry_state_ck check (
    resolution_status <> 'retry_pending' or retryable
  ),
  constraint import_errors_resolution_code_ck check (
    resolution_code is null or resolution_code ~ '^[a-z][a-z0-9_.-]{0,62}$'
  ),
  constraint import_errors_resolved_by_ck check (
    resolved_by is null or octet_length(resolved_by) between 1 and 200
  ),
  constraint import_errors_evidence_digest_ck check (
    source_evidence_digest is null or source_evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint import_errors_resolution_shape_ck check (
    (
      resolution_status in ('open', 'retry_pending')
      and resolution_code is null
      and resolved_by is null
      and resolved_at is null
    )
    or
    (
      resolution_status in ('resolved', 'waived')
      and resolution_code is not null
      and resolved_by is not null
      and resolved_at is not null
      and resolved_at >= created_at
    )
  ),
  constraint import_errors_occurrence_uk unique (
    process_type,
    process_reference,
    occurrence_key
  )
);

comment on table internal.import_errors is
  'Safe bounded migration/import error evidence. Credentials, raw payloads, workbooks, and full source documents are prohibited.';
comment on column internal.import_errors.safe_message is
  'Operator-safe bounded summary; it must not contain secrets or complete sensitive source values.';
comment on column internal.import_errors.source_evidence_digest is
  'Optional lowercase SHA-256 digest for correlation without retaining the sensitive source payload.';

create index import_errors_batch_created_idx
  on internal.import_errors (migration_batch_id, created_at, id)
  where migration_batch_id is not null;

create index import_errors_resolution_queue_idx
  on internal.import_errors (
    resolution_status,
    severity,
    error_category,
    retryable,
    created_at,
    id
  );

create index import_errors_source_history_idx
  on internal.import_errors (source_disposition_id, created_at, id)
  where source_disposition_id is not null;
