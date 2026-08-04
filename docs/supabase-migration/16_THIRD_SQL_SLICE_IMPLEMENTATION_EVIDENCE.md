# Third SQL Slice — Supplier Profile Root Implementation Evidence

Status: merged PR #54 local-only implementation evidence; not hosted, remotely applied, deployed, or Production-active

## Scope

This slice creates exactly one application table: `public.supplier_profiles` in `20260804000300_supplier_profile_foundation.sql`.

The table is an organization- and Auth-independent canonical listed Supplier profile with:

- database-generated UUIDv4 identity and a bounded nullable Firestore alternate ID;
- separate original/display/Arabic/English naming values with explicit language-shape coherence;
- bounded current business type, listing status, profile-verification status, source, confidence, and direct-experience provenance;
- bounded optional description/source context and a bounded historical interaction year;
- nullable trusted creation/update actor references to `public.user_profiles`, both `ON DELETE RESTRICT`;
- explicit legacy-ID uniqueness and trusted future lookup indexes; and
- comments plus explicit revocation of direct `PUBLIC`, `anon`, `authenticated`, and `service_role` table privileges.

## Explicit exclusions

No Supplier location, contact, category, capability, payment, ownership, membership, claim, product, document, submission, import, duplicate fingerprint, eligibility, organization, membership, invitation, access ledger, taxonomy, administrative area, RFQ, quotation, notification, audit, event, idempotency, RLS, policy, grant, view, RPC, trigger, function, Auth bridge, Supabase Auth integration, application integration, seed, migration/backfill, hosted Supabase access, Firebase access/change, or deployment is included.

`supplier_profiles` remains empty except for disposable synthetic local pgTAP rows. A listed Supplier profile is not a claimed Supplier, verified owner, RFQ-ready Supplier, active Auth account, or paying Supplier.

## Gate and migration boundary

All fourteen approval gates remain Open: `ID-001`, `ORG-001`, `ORG-002`, `SUP-003`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

The table needs none of those decisions while it is an empty, local-only root. The existing migration-control contract can map a synthetic `suppliers/{id}` source disposition to the `supplier_profiles` logical target without creating or running a Migration Engine.

On merged `main`, the Core Phase 1 count is 7 implemented and 29 deferred, out of 36. Firebase remains the live Production backend and Auth authority. Supabase remains local-only.

## Validation record

- Clean local Supabase reset applied all three local migrations successfully.
- Focused synthetic `supplier_profile_foundation.sql` pgTAP passed 84/84.
- Complete local pgTAP suite passed 222/222.
- Warning-level database lint returned no schema errors. Catalog checks found 21 columns, 22 constraints, 6 indexes, two `ON DELETE RESTRICT` foreign keys, and zero policies, application triggers, public functions/views, or direct API-role table privileges.
- The required non-Emulator PR-gate checks passed: repository tests, Production build, Functions typecheck, and byte-stable Supplier-template generation.
- Scoped prohibited-SQL and sensitive-value scans returned no matches, and `git diff --check` passed.

The local Supabase stack is stopped after validation. No Production, Firebase, hosted Supabase, or data operation is part of this record.
