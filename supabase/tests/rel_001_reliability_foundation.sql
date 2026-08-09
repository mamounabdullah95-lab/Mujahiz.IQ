\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = internal, public, extensions, pg_catalog;

select plan(62);

select has_table('internal', 'idempotency_keys', 'idempotency_keys exists in the internal schema');
select has_table('internal', 'domain_events', 'domain_events exists in the internal schema');
select is((select count(*) from pg_catalog.pg_attribute where attrelid = 'internal.idempotency_keys'::regclass and attnum > 0 and not attisdropped), 31::bigint, 'idempotency_keys has the approved physical-column count');
select is((select count(*) from pg_catalog.pg_attribute where attrelid = 'internal.domain_events'::regclass and attnum > 0 and not attisdropped), 38::bigint, 'domain_events has the approved physical-column count');

select has_column('internal', 'idempotency_keys', 'command_name', 'idempotency keys bind a command identity');
select has_column('internal', 'idempotency_keys', 'command_contract_version', 'idempotency keys version the command contract');
select has_column('internal', 'idempotency_keys', 'environment_code', 'idempotency keys isolate replay namespaces by environment');
select has_column('internal', 'idempotency_keys', 'principal_user_profile_id', 'idempotency keys can bind a provider-neutral human principal');
select has_column('internal', 'idempotency_keys', 'key_digest', 'idempotency keys store an opaque key digest instead of a raw key');
select has_column('internal', 'idempotency_keys', 'request_fingerprint', 'idempotency keys store a request fingerprint');
select has_column('internal', 'idempotency_keys', 'status', 'idempotency keys have a bounded lifecycle');
select has_column('internal', 'idempotency_keys', 'result_resource_id', 'idempotency keys retain an opaque safe result reference');
select has_column('internal', 'idempotency_keys', 'expires_at', 'idempotency keys retain a structural replay expiry boundary');

select has_column('internal', 'domain_events', 'event_type', 'domain events retain a registry event type');
select has_column('internal', 'domain_events', 'event_schema_version', 'domain events version their schema contract');
select has_column('internal', 'domain_events', 'aggregate_sequence', 'domain events retain aggregate-local sequence');
select has_column('internal', 'domain_events', 'producer_idempotency_key_id', 'domain events can bind their producing idempotency record');
select has_column('internal', 'domain_events', 'event_ordinal', 'domain events retain deterministic producer ordinal');
select has_column('internal', 'domain_events', 'payload', 'domain events retain only a bounded safe payload');
select has_column('internal', 'domain_events', 'processing_status', 'domain events retain one approved processor lifecycle');
select has_column('internal', 'domain_events', 'fanout_suppressed', 'domain events retain historical fan-out suppression');
select has_column('internal', 'domain_events', 'causation_event_id', 'domain events retain an optional direct causation link');

select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.idempotency_keys'::regclass and conname = 'idempotency_keys_status_ck'), 'idempotency lifecycle status is constrained');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.idempotency_keys'::regclass and conname = 'idempotency_keys_namespace_uk'), 'idempotency replay namespace is unique');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.idempotency_keys'::regclass and conname = 'idempotency_keys_lifecycle_shape_ck'), 'idempotency lifecycle shape is constrained');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.idempotency_keys'::regclass and conname = 'idempotency_keys_request_fingerprint_ck'), 'idempotency fingerprint is constrained to an HMAC-SHA-256 digest length');
select is((select count(*) from pg_catalog.pg_constraint where conrelid = 'internal.idempotency_keys'::regclass and contype = 'f'), 1::bigint, 'idempotency keys have only the approved restrictive principal foreign key');

select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.domain_events'::regclass and conname = 'domain_events_event_schema_version_ck'), 'event schema version is positive');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.domain_events'::regclass and conname = 'domain_events_aggregate_sequence_uk'), 'aggregate sequence is unique per aggregate');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.domain_events'::regclass and conname = 'domain_events_processing_status_ck'), 'event processing status is constrained');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.domain_events'::regclass and conname = 'domain_events_migration_suppression_ck'), 'historical events require terminal fan-out suppression');
select ok(exists (select 1 from pg_catalog.pg_constraint where conrelid = 'internal.domain_events'::regclass and conname = 'domain_events_payload_ck'), 'event payload is a bounded JSON object');
select is((select count(*) from pg_catalog.pg_constraint where conrelid = 'internal.domain_events'::regclass and contype = 'f'), 3::bigint, 'domain events have only approved restrictive idempotency, actor, and causation foreign keys');
select ok(to_regclass('internal.domain_events_producer_idempotency_ordinal_uk') is not null, 'idempotent producer and ordinal uniqueness index exists');
select ok(to_regclass('internal.domain_events_source_operation_ordinal_uk') is not null, 'source operation and ordinal uniqueness index exists');
select ok(to_regclass('internal.domain_events_import_source_identity_uk') is not null, 'import source identity uniqueness index exists');
select ok(to_regclass('internal.domain_events_processing_queue_idx') is not null, 'one processor queue index exists');

select ok((select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) from pg_catalog.pg_attrdef ad join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum where ad.adrelid = 'internal.idempotency_keys'::regclass and a.attname = 'id') ~ 'gen_random_uuid', 'idempotency keys use the qualified database UUIDv4 default');
select ok((select pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) from pg_catalog.pg_attrdef ad join pg_catalog.pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum where ad.adrelid = 'internal.domain_events'::regclass and a.attname = 'id') ~ 'gen_random_uuid', 'domain events use the qualified database UUIDv4 default');
select ok(obj_description('internal.idempotency_keys'::regclass) ilike '%Raw keys%', 'idempotency table comment prohibits raw keys and request bodies');
select ok(obj_description('internal.domain_events'::regclass) ilike '%not event sourcing%', 'domain event table comment preserves event and audit/notification separation');
select ok(col_description('internal.domain_events'::regclass, (select attnum from pg_catalog.pg_attribute where attrelid = 'internal.domain_events'::regclass and attname = 'fanout_suppressed')) ilike '%no migration importer%', 'fan-out suppression comment preserves the no-migration boundary');

select is((select count(*) from internal.idempotency_keys), 0::bigint, 'migration creates no idempotency rows');
select is((select count(*) from internal.domain_events), 0::bigint, 'migration creates no domain-event rows');
select is((select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'internal') and c.relkind = 'r'), 21::bigint, 'all migrations produce exactly 21 physical application tables');
select ok(to_regclass('public.notifications') is null, 'no notifications table is created');
select ok(to_regclass('internal.domain_event_registry') is null, 'no domain-event registry table is created');
select ok(to_regclass('internal.idempotency_key_writers') is null, 'no idempotency writer runtime object is created');
select ok(to_regclass('internal.domain_event_workers') is null, 'no domain-event worker runtime object is created');
select ok(not exists (select 1 from pg_catalog.pg_attribute where attrelid in ('internal.idempotency_keys'::regclass, 'internal.domain_events'::regclass) and attnum > 0 and not attisdropped and attname in ('raw_key', 'request_body', 'response_body', 'notification_title', 'notification_body', 'email', 'phone')), 'no raw request, response, notification, or contact fields are introduced');

select ok(not has_table_privilege('anon', 'internal.idempotency_keys', 'select'), 'anon cannot select idempotency keys');
select ok(not has_table_privilege('authenticated', 'internal.idempotency_keys', 'select'), 'authenticated cannot select idempotency keys');
select ok(not has_table_privilege('service_role', 'internal.idempotency_keys', 'select'), 'service API role cannot select idempotency keys');
select ok(not has_table_privilege('anon', 'internal.domain_events', 'select'), 'anon cannot select domain events');
select ok(not has_table_privilege('authenticated', 'internal.domain_events', 'select'), 'authenticated cannot select domain events');
select ok(not has_table_privilege('service_role', 'internal.domain_events', 'select'), 'service API role cannot select domain events');
select ok(not exists (select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl where c.oid in ('internal.idempotency_keys'::regclass, 'internal.domain_events'::regclass) and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)), 'PUBLIC and API roles receive no reliability-table privileges');
select is((select count(*) from pg_catalog.pg_policy where polrelid in ('internal.idempotency_keys'::regclass, 'internal.domain_events'::regclass)), 0::bigint, 'reliability tables have no policies');
select is((select count(*) from pg_catalog.pg_class where oid in ('internal.idempotency_keys'::regclass, 'internal.domain_events'::regclass) and relrowsecurity), 0::bigint, 'reliability tables have no RLS enabled');
select is((select count(*) from pg_catalog.pg_trigger where tgrelid in ('internal.idempotency_keys'::regclass, 'internal.domain_events'::regclass) and not tgisinternal), 0::bigint, 'reliability tables have no triggers');
select is((select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'internal' and p.proname in ('idempotency_keys_writer', 'domain_events_worker', 'supplier_ownership_decide_claim')), 0::bigint, 'slice introduces no trusted command or worker function');
select is((select count(*) from pg_catalog.pg_constraint where conrelid = 'internal.audit_logs'::regclass and contype = 'f'), 2::bigint, 'existing audit-table foreign-key boundary remains unchanged');

select * from finish();

rollback;
