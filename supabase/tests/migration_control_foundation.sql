\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(60);

select has_schema('internal', 'internal schema exists');
select has_table('internal', 'migration_batches', 'migration_batches exists');
select has_table('internal', 'migration_source_dispositions', 'migration_source_dispositions exists');
select has_table('internal', 'migration_record_mappings', 'migration_record_mappings exists');
select has_table('internal', 'migration_merge_group_members', 'migration_merge_group_members exists');
select has_table('internal', 'migration_validation_results', 'migration_validation_results exists');
select has_table('internal', 'import_errors', 'import_errors exists');

select ok(not has_schema_privilege('anon', 'internal', 'USAGE'), 'anon has no internal schema usage');
select ok(not has_schema_privilege('authenticated', 'internal', 'USAGE'), 'authenticated has no internal schema usage');

select matches(
  (
    select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
    from pg_catalog.pg_attrdef ad
    join pg_catalog.pg_attribute a
      on a.attrelid = ad.adrelid
     and a.attnum = ad.adnum
    where ad.adrelid = 'internal.migration_batches'::regclass
      and a.attname = 'id'
  ),
  'gen_random_uuid',
  'primary keys use the database UUIDv4 default'
);

select throws_ok(
  $$
    insert into internal.migration_batches (
      execution_environment,
      migration_scope,
      source_system,
      source_snapshot_reference,
      transformation_version,
      schema_version,
      status,
      initiated_by
    ) values (
      'local', 'migration_control_test', 'synthetic', 'invalid-status',
      'transform-v1', 'schema-v1', 'unknown', 'test-runner'
    )
  $$,
  null,
  'invalid batch status is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_batches (
      execution_environment,
      migration_scope,
      source_system,
      source_snapshot_reference,
      transformation_version,
      schema_version,
      status,
      initiated_by,
      started_at
    ) values (
      'local', 'migration_control_test', 'synthetic', 'invalid-planned-time',
      'transform-v1', 'schema-v1', 'planned', 'test-runner', statement_timestamp()
    )
  $$,
  null,
  'impossible planned batch timestamps are rejected'
);

create temporary table migration_test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

with inserted as (
  insert into internal.migration_batches (
    execution_environment,
    migration_scope,
    source_system,
    source_snapshot_reference,
    transformation_version,
    schema_version,
    code_version,
    status,
    initiated_by,
    started_at
  ) values (
    'local',
    'migration_control_test',
    'synthetic',
    'synthetic-snapshot-v1',
    'transform-v1',
    'schema-v1',
    'test-sha',
    'running',
    'test-runner',
    statement_timestamp()
  )
  returning id
)
insert into migration_test_ids (name, id)
select 'batch', id from inserted;

select is(
  (select count(*) from internal.migration_batches where id = (select id from migration_test_ids where name = 'batch')),
  1::bigint,
  'a valid synthetic batch is accepted'
);

select throws_ok(
  $$
    insert into internal.migration_batches (
      execution_environment, migration_scope, source_system, source_snapshot_reference,
      transformation_version, schema_version, status, initiated_by
    ) values (
      'local', 'migration_control_test', 'synthetic', 'synthetic-snapshot-v1',
      'transform-v1', 'schema-v1', 'planned', 'test-runner'
    )
  $$,
  null,
  'an exact batch replay identity is rejected'
);

select lives_ok(
  $$
    insert into internal.migration_batches (
      execution_environment, migration_scope, source_system, source_snapshot_reference,
      transformation_version, schema_version, status, initiated_by
    ) values (
      'local', 'migration_control_test', 'synthetic', 'synthetic-snapshot-v1',
      'transform-v1', 'schema-v2', 'planned', 'test-runner'
    )
  $$,
  'the same source and transformation may target a different schema version'
);

select throws_ok(
  $$
    insert into internal.migration_batches (
      execution_environment, migration_scope, source_system, source_snapshot_reference,
      transformation_version, schema_version, status, initiated_by, metadata
    ) values (
      'local', 'migration_control_test', 'synthetic', 'metadata-unknown-key',
      'transform-v1', 'schema-v1', 'planned', 'test-runner', '{"token":"forbidden"}'::jsonb
    )
  $$,
  null,
  'unallowlisted batch metadata keys are rejected'
);

select throws_ok(
  $$
    insert into internal.migration_source_dispositions (
      migration_batch_id,
      source_collection,
      source_document_id,
      source_version,
      disposition,
      reason_code,
      transformation_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'syntheticDocs', 'bad-disposition', 'v1', 'discarded', 'invalid', 'transform-v1'
    )
  $$,
  null,
  'invalid source disposition is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_source_dispositions (
      migration_batch_id, source_collection, source_document_id, source_version,
      disposition, reason_code, transformation_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'syntheticDocs', 'wrong-transform', 'v1', 'migrated', 'mapped', 'transform-v2'
    )
  $$,
  null,
  'source disposition transformation version must match its batch'
);

with inserted as (
  insert into internal.migration_source_dispositions (
    migration_batch_id,
    source_collection,
    source_document_id,
    source_version,
    disposition,
    reason_code,
    transformation_version
  ) values (
    (select id from migration_test_ids where name = 'batch'),
    'syntheticDocs', 'source-root', 'v1', 'migrated', 'mapped', 'transform-v1'
  )
  returning id
)
insert into migration_test_ids (name, id)
select 'source_root', id from inserted;

with inserted as (
  insert into internal.migration_source_dispositions (
    migration_batch_id,
    source_collection,
    source_document_id,
    source_version,
    disposition,
    reason_code,
    transformation_version
  ) values (
    (select id from migration_test_ids where name = 'batch'),
    'syntheticDocs', 'source-no-target', 'v1', 'no_target', 'not_applicable', 'transform-v1'
  )
  returning id
)
insert into migration_test_ids (name, id)
select 'source_no_target', id from inserted;

with inserted as (
  insert into internal.migration_source_dispositions (
    migration_batch_id,
    source_collection,
    source_document_id,
    source_version,
    disposition,
    reason_code,
    transformation_version
  ) values (
    (select id from migration_test_ids where name = 'batch'),
    'syntheticDocs', 'source-reverse', 'v1', 'migrated', 'mapped', 'transform-v1'
  )
  returning id
)
insert into migration_test_ids (name, id)
select 'source_reverse', id from inserted;

select throws_ok(
  $$
    insert into internal.migration_source_dispositions (
      migration_batch_id,
      source_collection,
      source_document_id,
      source_version,
      disposition,
      reason_code,
      transformation_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'syntheticDocs', 'source-root', 'v1', 'quarantined', 'duplicate', 'transform-v1'
    )
  $$,
  null,
  'a second active disposition for one source version is rejected'
);

select is(
  (
    select count(*)
    from internal.migration_record_mappings
    where source_disposition_id = (select id from migration_test_ids where name = 'source_no_target')
  ),
  0::bigint,
  'no-target disposition legitimately has zero target mappings'
);

select lives_ok(
  $$
    with previous as (
      update internal.migration_source_dispositions
      set is_active = false,
          superseded_at = statement_timestamp()
      where id = (select id from migration_test_ids where name = 'source_no_target')
      returning *
    ), replacement as (
      insert into internal.migration_source_dispositions (
        migration_batch_id,
        source_collection,
        source_document_id,
        source_version,
        disposition,
        reason_code,
        transformation_version,
        supersedes_disposition_id,
        supersession_reason_code
      )
      select
        migration_batch_id,
        source_collection,
        source_document_id,
        source_version,
        'quarantined',
        'review_required',
        'transform-v1',
        id,
        'reviewed_correction'
      from previous
      returning id
    )
    select count(*) from replacement
  $$,
  'source disposition can be superseded without deleting history'
);

select is(
  (
    select count(*)
    from internal.migration_source_dispositions
    where migration_batch_id = (select id from migration_test_ids where name = 'batch')
      and source_collection = 'syntheticDocs'
      and source_document_id = 'source-no-target'
      and source_version = 'v1'
  ),
  2::bigint,
  'source disposition supersession retains both history rows'
);

select is(
  (
    select count(*)
    from internal.migration_source_dispositions
    where migration_batch_id = (select id from migration_test_ids where name = 'batch')
      and source_collection = 'syntheticDocs'
      and source_document_id = 'source-no-target'
      and source_version = 'v1'
      and is_active
  ),
  1::bigint,
  'source disposition supersession leaves exactly one active row'
);

insert into internal.migration_record_mappings (
  migration_batch_id,
  record_kind,
  source_disposition_id,
  source_disposition_outcome,
  target_logical_type,
  target_id,
  mapping_role,
  child_key,
  child_ordinal,
  transformation_version,
  rollback_dependency_order
) values
  (
    (select id from migration_test_ids where name = 'batch'),
    'ordinary_mapping',
    (select id from migration_test_ids where name = 'source_root'),
    'migrated',
    'supplier_profiles',
    gen_random_uuid(),
    'root',
    'root',
    null,
    'transform-v1',
    0
  ),
  (
    (select id from migration_test_ids where name = 'batch'),
    'ordinary_mapping',
    (select id from migration_test_ids where name = 'source_root'),
    'migrated',
    'supplier_locations',
    gen_random_uuid(),
    'normalized_child',
    'branch:1',
    null,
    'transform-v1',
    1
  ),
  (
    (select id from migration_test_ids where name = 'batch'),
    'ordinary_mapping',
    (select id from migration_test_ids where name = 'source_root'),
    'migrated',
    'supplier_locations',
    gen_random_uuid(),
    'normalized_child',
    'branch:2',
    null,
    'transform-v1',
    1
  ),
  (
    (select id from migration_test_ids where name = 'batch'),
    'ordinary_mapping',
    (select id from migration_test_ids where name = 'source_root'),
    'migrated',
    'supplier_contacts',
    gen_random_uuid(),
    'normalized_child',
    null,
    0,
    'transform-v1',
    1
  );

with selected as (
  select id
  from internal.migration_record_mappings
  where source_disposition_id = (select id from migration_test_ids where name = 'source_root')
    and target_logical_type = 'supplier_locations'
    and child_key = 'branch:1'
)
insert into migration_test_ids (name, id)
select 'branch_one_mapping', id from selected;

select is(
  (
    select count(*)
    from internal.migration_record_mappings
    where source_disposition_id = (select id from migration_test_ids where name = 'source_root')
      and is_active
  ),
  4::bigint,
  'one source version maps to multiple deterministic normalized targets'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping', gen_random_uuid(),
      'supplier_locations', gen_random_uuid(), 'normalized_child', 'null-outcome',
      'transform-v1', 1
    )
  $$,
  null,
  'ordinary mapping cannot bypass source integrity with a null outcome'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping', (select id from migration_test_ids where name = 'source_root'), 'migrated',
      'supplier_locations', gen_random_uuid(), 'normalized_child', 'wrong-transform',
      'transform-v2', 1
    )
  $$,
  null,
  'mapping transformation version must match its batch'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key, child_ordinal,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping',
      (select id from migration_test_ids where name = 'source_root'),
      'migrated', 'supplier_locations', gen_random_uuid(), 'normalized_child',
      'both', 9, 'transform-v1', 1
    )
  $$,
  null,
  'mapping with both child key and ordinal is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping',
      (select id from migration_test_ids where name = 'source_root'),
      'migrated', 'supplier_locations', gen_random_uuid(), 'normalized_child',
      'transform-v1', 1
    )
  $$,
  null,
  'mapping with neither child key nor ordinal is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping',
      (select id from migration_test_ids where name = 'source_root'),
      'migrated', 'supplier_locations', gen_random_uuid(), 'normalized_child',
      'branch:1', 'transform-v1', 1
    )
  $$,
  null,
  'duplicate active logical child slot is rejected independently of target UUID'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    )
    select
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping',
      (select id from migration_test_ids where name = 'source_reverse'),
      'migrated', target_logical_type, target_id, mapping_role,
      'branch:other', 'transform-v1', 1
    from internal.migration_record_mappings
    where id = (select id from migration_test_ids where name = 'branch_one_mapping')
  $$,
  null,
  'ambiguous active reverse target is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_ordinal,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping',
      (select id from migration_test_ids where name = 'source_root'),
      'migrated', 'supplier_locations', gen_random_uuid(), 'normalized_child',
      -1, 'transform-v1', 1
    )
  $$,
  null,
  'negative deterministic child ordinal is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping', gen_random_uuid(), 'migrated',
      'supplier_locations', gen_random_uuid(), 'normalized_child',
      'orphan', 'transform-v1', 1
    )
  $$,
  null,
  'orphan source-disposition foreign key is rejected'
);

select lives_ok(
  $$
    with previous as (
      update internal.migration_record_mappings
      set is_active = false,
          superseded_at = statement_timestamp()
      where id = (select id from migration_test_ids where name = 'branch_one_mapping')
      returning *
    ), replacement as (
      insert into internal.migration_record_mappings (
        migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
        target_logical_type, target_id, mapping_role, child_key,
        transformation_version, rollback_dependency_order, mapping_lineage_id,
        supersedes_mapping_id, supersession_reason_code
      )
      select
        migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
        target_logical_type, gen_random_uuid(), mapping_role, child_key,
        'transform-v1', rollback_dependency_order, mapping_lineage_id,
        id, 'reviewed_correction'
      from previous
      returning id
    )
    select count(*) from replacement
  $$,
  'a corrected mapping supersedes the active slot without deleting its predecessor'
);

select is(
  (
    select count(*)
    from internal.migration_record_mappings
    where source_disposition_id = (select id from migration_test_ids where name = 'source_root')
      and target_logical_type = 'supplier_locations'
      and mapping_role = 'normalized_child'
      and child_key = 'branch:1'
  ),
  2::bigint,
  'mapping supersession retains predecessor and successor rows'
);

select is(
  (
    select count(*)
    from internal.migration_record_mappings
    where source_disposition_id = (select id from migration_test_ids where name = 'source_root')
      and target_logical_type = 'supplier_locations'
      and mapping_role = 'normalized_child'
      and child_key = 'branch:1'
      and is_active
  ),
  1::bigint,
  'mapping supersession leaves one active logical child slot'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order, is_active, superseded_at,
      mapping_lineage_id, supersedes_mapping_id
    )
    select
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, gen_random_uuid(), mapping_role, child_key,
      transformation_version, rollback_dependency_order, false, statement_timestamp(),
      mapping_lineage_id, id
    from internal.migration_record_mappings
    where source_disposition_id = (select id from migration_test_ids where name = 'source_root')
      and target_logical_type = 'supplier_locations'
      and child_key = 'branch:2'
      and is_active
  $$,
  null,
  'mapping supersession requires a bounded reason code'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order, supersedes_mapping_id,
      supersession_reason_code
    )
    select
      migration_batch_id, record_kind,
      (select id from migration_test_ids where name = 'source_reverse'), 'migrated',
      target_logical_type, gen_random_uuid(), mapping_role, child_key,
      transformation_version, rollback_dependency_order, id, 'unrelated_source'
    from internal.migration_record_mappings
    where source_disposition_id = (select id from migration_test_ids where name = 'source_root')
      and target_logical_type = 'supplier_locations'
      and child_key = 'branch:2'
      and is_active
  $$,
  null,
  'a mapping cannot supersede an unrelated source lineage with the same child key'
);

select throws_ok(
  $$
    update internal.migration_source_dispositions
    set is_active = false, superseded_at = statement_timestamp()
    where id = (select id from migration_test_ids where name = 'source_root')
  $$,
  null,
  'an active source disposition cannot be deactivated while active mappings reference it'
);

with inserted as (
  insert into internal.migration_source_dispositions (
    migration_batch_id, source_collection, source_document_id, source_version,
    disposition, reason_code, transformation_version
  ) values (
    (select id from migration_test_ids where name = 'batch'),
    'syntheticDocs', 'merge-source-a', 'v1', 'merged', 'reviewed_merge', 'transform-v1'
  ) returning id
)
insert into migration_test_ids (name, id)
select 'merge_source_a', id from inserted;

with inserted as (
  insert into internal.migration_source_dispositions (
    migration_batch_id, source_collection, source_document_id, source_version,
    disposition, reason_code, transformation_version
  ) values (
    (select id from migration_test_ids where name = 'batch'),
    'syntheticDocs', 'merge-source-b', 'v1', 'merged', 'reviewed_merge', 'transform-v1'
  ) returning id
)
insert into migration_test_ids (name, id)
select 'merge_source_b', id from inserted;

select lives_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'ordinary_mapping', (select id from migration_test_ids where name = 'merge_source_a'), 'merged',
      'supplier_legacy_aliases', gen_random_uuid(), 'normalized_child', 'legacy-alias',
      'transform-v1', 1
    )
  $$,
  'a merged source disposition may also emit a distinct ordinary child mapping'
);

with inserted as (
  insert into internal.migration_record_mappings (
    migration_batch_id, record_kind, target_logical_type, target_id, mapping_role,
    transformation_version, rollback_dependency_order, merge_reason_code,
    review_status, reviewed_by, reviewed_at, approval_reference,
    reconciliation_reference, reconciliation_evidence_digest, reconciliation_status
  ) values (
    (select id from migration_test_ids where name = 'batch'),
    'merge_group', 'supplier_profiles', gen_random_uuid(), 'root',
    'transform-v1', 0, 'duplicate_legacy_sources',
    'approved', 'synthetic-reviewer', statement_timestamp(), 'TEST-APPROVAL-1',
    'synthetic-reconciliation-1', repeat('a', 64), 'passed'
  ) returning id
)
insert into migration_test_ids (name, id)
select 'merge_group', id from inserted;

insert into internal.migration_merge_group_members (
  migration_batch_id,
  merge_group_mapping_id,
  target_logical_type,
  target_mapping_role,
  source_disposition_id,
  child_key,
  member_role,
  contribution_order,
  transformation_version
) values
  (
    (select id from migration_test_ids where name = 'batch'),
    (select id from migration_test_ids where name = 'merge_group'),
    'supplier_profiles', 'root',
    (select id from migration_test_ids where name = 'merge_source_a'),
    'root', 'canonical_source', 0, 'transform-v1'
  ),
  (
    (select id from migration_test_ids where name = 'batch'),
    (select id from migration_test_ids where name = 'merge_group'),
    'supplier_profiles', 'root',
    (select id from migration_test_ids where name = 'merge_source_b'),
    'root', 'contributor', 1, 'transform-v1'
  );

select is(
  (
    select count(*)
    from internal.migration_merge_group_members
    where merge_group_mapping_id = (select id from migration_test_ids where name = 'merge_group')
      and is_active
  ),
  2::bigint,
  'reviewed merge group records every active contributor'
);

select is(
  (
    select count(*)
    from internal.migration_merge_group_members
    where merge_group_mapping_id = (select id from migration_test_ids where name = 'merge_group')
      and is_active
      and member_role = 'canonical_source'
  ),
  1::bigint,
  'reviewed merge group has one canonical source contributor'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, target_logical_type, target_id, mapping_role,
      transformation_version, rollback_dependency_order
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'merge_group', 'supplier_profiles', gen_random_uuid(), 'root', 'transform-v1', 0
    )
  $$,
  null,
  'merge group without review and reconciliation evidence is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, target_logical_type, target_id, mapping_role,
      transformation_version, rollback_dependency_order, merge_reason_code,
      review_status, reviewed_by, reviewed_at, approval_reference,
      reconciliation_reference, reconciliation_evidence_digest, reconciliation_status
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'merge_group', 'supplier_profiles', gen_random_uuid(), 'root',
      'transform-v1', 0, 'unreconciled_sources',
      'approved', 'synthetic-reviewer', statement_timestamp(), 'TEST-APPROVAL-2',
      'synthetic-reconciliation-2', repeat('b', 64), 'pending'
    )
  $$,
  null,
  'an active merge group must have passed reconciliation evidence'
);

select throws_ok(
  $$
    insert into internal.migration_record_mappings (
      migration_batch_id, record_kind, source_disposition_id, source_disposition_outcome,
      target_logical_type, target_id, mapping_role, child_key,
      transformation_version, rollback_dependency_order
    )
    select
      migration_batch_id,
      'ordinary_mapping',
      (select id from migration_test_ids where name = 'source_reverse'),
      'migrated', target_logical_type, target_id, mapping_role, 'root',
      'transform-v1', rollback_dependency_order
    from internal.migration_record_mappings
    where id = (select id from migration_test_ids where name = 'merge_group')
  $$,
  null,
  'ordinary mapping cannot bypass a reviewed merge-group target binding'
);

select throws_ok(
  $$
    insert into internal.migration_merge_group_members (
      migration_batch_id, merge_group_mapping_id, target_logical_type, target_mapping_role,
      source_disposition_id, child_key, member_role, contribution_order, transformation_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      (select id from migration_test_ids where name = 'merge_group'),
      'supplier_profiles', 'root',
      (select id from migration_test_ids where name = 'merge_source_b'),
      'root', 'contributor', 2, 'transform-v1'
    )
  $$,
  null,
  'one active merged source child cannot fork into duplicate memberships'
);

select throws_ok(
  $$
    insert into internal.migration_merge_group_members (
      migration_batch_id, merge_group_mapping_id, target_logical_type, target_mapping_role,
      source_disposition_id, child_key, member_role, contribution_order, transformation_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      (select id from migration_test_ids where name = 'merge_group'),
      'supplier_profiles', 'root',
      (select id from migration_test_ids where name = 'merge_source_b'),
      'wrong-transform', 'contributor', 2, 'transform-v2'
    )
  $$,
  null,
  'merge member transformation version must match its batch'
);

select throws_ok(
  $$
    insert into internal.migration_merge_group_members (
      migration_batch_id, merge_group_mapping_id, target_logical_type, target_mapping_role,
      source_disposition_id, child_key, member_role, contribution_order, transformation_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      (select id from migration_test_ids where name = 'merge_group'),
      'supplier_locations', 'root',
      (select id from migration_test_ids where name = 'merge_source_b'),
      'different-target', 'contributor', 2, 'transform-v1'
    )
  $$,
  null,
  'merge member target identity must match its reviewed group binding'
);

select throws_ok(
  $$
    insert into internal.migration_merge_group_members (
      migration_batch_id, merge_group_mapping_id, target_logical_type, target_mapping_role,
      source_disposition_id, child_key, member_role, contribution_order,
      transformation_version, is_active, superseded_at, supersedes_member_id,
      supersession_reason_code
    )
    select
      migration_batch_id, merge_group_mapping_id, target_logical_type, target_mapping_role,
      (select id from migration_test_ids where name = 'merge_source_b'), child_key,
      'contributor', 3, transformation_version, false, statement_timestamp(), id,
      'unrelated_source'
    from internal.migration_merge_group_members
    where merge_group_mapping_id = (select id from migration_test_ids where name = 'merge_group')
      and member_role = 'canonical_source'
      and is_active
  $$,
  null,
  'a merge member cannot supersede an unrelated source lineage with the same child key'
);

select throws_ok(
  $$
    update internal.migration_record_mappings
    set is_active = false, superseded_at = statement_timestamp()
    where id = (select id from migration_test_ids where name = 'merge_group')
  $$,
  null,
  'an active merge group cannot be deactivated while active members reference it'
);

insert into internal.migration_validation_results (
  migration_batch_id, validation_run_reference, validation_scope, validation_type,
  check_code, outcome, expected_count, actual_count, validator_version
) values
  (
    (select id from migration_test_ids where name = 'batch'),
    'run-1', 'batch', 'mapping_integrity', 'active_mapping_count',
    'passed', 7, 7, 'validator-v1'
  ),
  (
    (select id from migration_test_ids where name = 'batch'),
    'run-2', 'batch', 'mapping_integrity', 'active_mapping_count',
    'passed', 7, 7, 'validator-v1'
  );

select is(
  (
    select count(*)
    from internal.migration_validation_results
    where migration_batch_id = (select id from migration_test_ids where name = 'batch')
      and check_code = 'active_mapping_count'
  ),
  2::bigint,
  'repeated validation runs append historical evidence'
);

select throws_ok(
  $$
    insert into internal.migration_validation_results (
      migration_batch_id, validation_run_reference, validation_scope, validation_type,
      check_code, outcome, expected_count, actual_count, validator_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'run-1', 'batch', 'mapping_integrity', 'active_mapping_count',
      'passed', 7, 7, 'validator-v1'
    )
  $$,
  null,
  'duplicate check within one validation run is rejected'
);

select throws_ok(
  $$
    insert into internal.migration_validation_results (
      migration_batch_id, validation_run_reference, validation_scope, validation_type,
      check_code, outcome, expected_count, validator_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'run-3', 'batch', 'count', 'partial_pair', 'failed', 1, 'validator-v1'
    )
  $$,
  null,
  'validation expected and actual evidence must be paired'
);

select throws_ok(
  $$
    insert into internal.migration_validation_results (
      migration_batch_id, validation_run_reference, validation_scope, validation_type,
      check_code, outcome, expected_count, actual_count, validator_version
    ) values (
      (select id from migration_test_ids where name = 'batch'),
      'run-4', 'batch', 'count', 'false_pass', 'passed', 7, 2, 'validator-v1'
    )
  $$,
  null,
  'a passed validation result cannot disagree with expected evidence'
);

insert into internal.import_errors (
  migration_batch_id,
  source_disposition_id,
  process_type,
  process_reference,
  occurrence_key,
  source_reference,
  error_category,
  error_code,
  safe_message,
  field_path,
  retryable
) values (
  (select id from migration_test_ids where name = 'batch'),
  (select id from migration_test_ids where name = 'source_root'),
  'migration',
  'synthetic-run-1',
  'source-root:invalid-field',
  'syntheticDocs/source-root',
  'validation',
  'invalid_field',
  'Synthetic bounded validation error.',
  'safe_field',
  false
);

select is(
  (
    select count(*)
    from internal.import_errors
    where process_reference = 'synthetic-run-1'
  ),
  1::bigint,
  'safe bounded import error is accepted'
);

select throws_ok(
  $$
    insert into internal.import_errors (
      process_type, process_reference, occurrence_key, error_category,
      error_code, safe_message, resolution_status
    ) values (
      'validation', 'synthetic-run-2', 'incomplete-resolution', 'validation',
      'invalid_resolution', 'Synthetic error.', 'resolved'
    )
  $$,
  null,
  'resolved error requires complete trusted resolution evidence'
);

select throws_ok(
  $$
    insert into internal.import_errors (
      process_type, process_reference, occurrence_key, error_category,
      error_code, safe_message, severity
    ) values (
      'validation', 'synthetic-run-2', 'invalid-severity', 'validation',
      'invalid_severity', 'Synthetic error.', 'urgent'
    )
  $$,
  null,
  'unrecognized import-error severity is rejected'
);

select throws_ok(
  $$
    insert into internal.import_errors (
      process_type, process_reference, occurrence_key, error_category,
      error_code, safe_message, retryable, resolution_status
    ) values (
      'validation', 'synthetic-run-2', 'invalid-retry-state', 'validation',
      'invalid_retry_state', 'Synthetic error.', false, 'retry_pending'
    )
  $$,
  null,
  'retry-pending errors must be marked retryable'
);

select throws_ok(
  $$
    insert into internal.import_errors (
      process_type, process_reference, occurrence_key, error_category,
      error_code, safe_message
    ) values (
      'validation', 'synthetic-run-3', 'oversized-message', 'validation',
      'oversized_message', repeat('x', 1001)
    )
  $$,
  null,
  'unbounded import error message is rejected'
);

select throws_ok(
  $$
    delete from internal.migration_batches
    where id = (select id from migration_test_ids where name = 'batch')
  $$,
  null,
  'referenced migration batch evidence cannot be deleted'
);

select throws_ok(
  $$
    delete from internal.migration_source_dispositions
    where id = (select id from migration_test_ids where name = 'source_root')
  $$,
  null,
  'referenced source-disposition history cannot be deleted'
);

select * from finish();

rollback;
