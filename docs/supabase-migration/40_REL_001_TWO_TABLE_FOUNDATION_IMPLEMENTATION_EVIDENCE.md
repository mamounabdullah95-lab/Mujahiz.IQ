# REL-001 two-table foundation implementation evidence

Status: **Local-only structural implementation evidence**
Starting `origin/main`: `f5ee83096851991de680183c072b16987cb8784f`
Primary task profile: Testing

## Scope and boundary

This evidence records only the fourteenth local SQL slice selected after PR #94 satisfied the REL-001 Option D revisit condition. It creates exactly `internal.idempotency_keys` and `internal.domain_events` as empty, fully revoked local PostgreSQL relations.

It does not create rows, a Claim aggregate/table, `supplier_ownership.decide_claim`, event registry runtime, notification table/materializer, audit writer, trigger, worker, RLS, Auth bridge, API grant, hosted Supabase resource, Firebase change, Production/TEST data operation, migration, seed, backfill, or deployment.

## Contract-to-physical mapping

| Approved logical field or invariant | Physical implementation |
|---|---|
| Provider-neutral trusted command namespace, command version, environment, caller/source, optional target, optional upstream identity | `idempotency_keys.command_name`, `command_contract_version`, `environment_code`, `principal_*`, `target_aggregate_*`, and `upstream_*`, with bounded-code and paired-nullability checks. |
| Stable caller key without raw-key retention | `key_digest bytea` constrained to 32 bytes with `key_digest_key_version`; namespace uniqueness is `(environment_code, command_name, command_contract_version, key_digest)`. |
| Canonical request mismatch detection without request-body retention | `request_fingerprint bytea` constrained to 32 bytes with its key-version column. No JSON/request/response column is present. |
| Fenced replay lifecycle and safe terminal result boundary | `status`, lease digest/version/expiry, attempt count, bounded outcome/failure/retry fields, opaque typed result reference, and lifecycle-shape/timestamp checks. |
| Event identity, immutable registry envelope, aggregate ordering, producer relationship | `domain_events.id`, event type/schema version, aggregate type/UUID/positive sequence, producer command/version, optional restrictive idempotency FK, and positive event ordinal. Aggregate sequence and producer/idempotency ordinal are unique. |
| Non-idempotent source and imported authoritative-event identity | Bounded `source_system_code`, optional durable `source_operation_identity`, optional source stream/event identity, plus partial unique indexes. At least one approved producer identity is required. |
| Safe bounded event payload and provenance | Required JSON-object `payload` capped at 16 KiB; provider-neutral actor/source, environment, component, correlation, optional restrictive causation, occurred/persisted timestamps. No notification, audit, request-body, contact, credential, token, URL, or unrestricted metadata field exists. |
| One internal materialization lifecycle, retry fencing, and safe errors | Bounded `processing_status`, availability/lease/attempt/retry/processed/dead-letter fields and lifecycle checks. This is structural only: no worker or materializer exists. |
| Historical migration/replay suppression | `is_historical`, `fanout_suppressed`, and bounded migration classification require terminal suppressed state. They create no importer, replay, fan-out, or data movement. |
| Strict reliability/audit/notification separation | The migration neither changes `internal.audit_logs` nor creates notifications. Audit references remain opaque as approved in the thirteenth slice. |
| Restrictive relationships and default deny | Only unambiguous provider-neutral actor, idempotency-producer, and event-causation FKs use `ON DELETE RESTRICT`; both internal tables revoke all access from `public`, `anon`, `authenticated`, and `service_role`. |

## Verification boundary

Focused pgTAP proves table shape, key constraints/indexes, empty initial state, absence of notification/registry/writer/worker objects and sensitive fields, no RLS/policies/triggers, no API-role access, and no regression to the existing audit-table FK boundary. The deterministic disposable local SQL runner validates all tracked migrations and pgTAP files.

Firebase and hosted Supabase are untouched. All validation data is local and disposable; this migration itself inserts no data.
