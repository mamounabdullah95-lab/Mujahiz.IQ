# Second SQL slice implementation evidence

Status: merged PR #51 evidence; local-only, synthetic-data-only, not hosted or deployed
Scope: `public.user_profiles` and `internal.identity_provider_links` only

## Implemented local schema

Migration `20260804000200_provider_neutral_identity_foundation.sql` adds exactly the approved provider-neutral identity root:

- `public.user_profiles` has a database UUIDv4 primary key, bounded alternate Firestore ID, trusted account/context and lifecycle fields, bounded legacy/support evidence, nullable bootstrap/system actor references, and `ON DELETE RESTRICT` self references.
- `internal.identity_provider_links` maps a bounded provider code and text subject to a profile, retains optional migration-batch provenance, enforces active provider-subject and active primary-link uniqueness, and records bounded trusted link, verification, disablement, unlink, and provider-observation state.
- Firebase traceability is represented only by `provider_code = 'firebase'` with a text `provider_subject`; Firebase UID is not a PostgreSQL key and email is not an identity-linking constraint.
- The migration explicitly grants no table privilege to `PUBLIC`, `anon`, `authenticated`, or `service_role`. It creates no RLS, policy, function, trigger, Auth user, JWT hook, RPC, view, role assignment, application integration, or data.

## Local verification

- Clean `supabase db reset` applied the merged migration-control foundation first, then this migration, on the disposable local database.
- Focused synthetic pgTAP test `identity_provider_foundation.sql` passed 78/78 assertions.
- Complete local pgTAP suite passed 138/138 assertions.
- `supabase db lint --level warning` returned no schema errors.
- Catalog inspection verified both tables, UUID defaults, `ON DELETE RESTRICT` foreign keys, expected indexes, zero application triggers/functions/policies, no RLS, no `anon`/`authenticated` use on `internal`, and no direct `anon`, `authenticated`, or `service_role` SELECT privilege.

## Explicit boundary and unresolved gates

`ID-001` remains Open. Firebase Auth remains authoritative for verification and disablement during the approved hybrid phase. These tables are inert provider-state mirrors until a separately approved trusted validation/reconciliation and Auth-integration phase; no Auth authority, browser access, migration data, hosted Supabase change, or Production action is implied.

All deferred concepts, including `platform_role_assignments`, remain uncreated. `MIG-002` and `RES-001` remain Open, so expected deployment scope is none.
