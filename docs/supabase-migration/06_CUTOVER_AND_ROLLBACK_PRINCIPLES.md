# Cutover and rollback principles

## Non-negotiable baseline

- **[Verified current fact]** This task performed read-only Firebase verification and no Supabase access/write. It did not copy data or prepare executable Production commands.
- **[Verified current fact]** Live Firebase and GitHub `main` differ; a future cutover baseline must name the actual authoritative Firebase deployment/configuration, not merely a Git commit.
- **[Future plan]** Firebase remains authoritative until a feature passes rehearsal, mapping, security, parity, cutover, and observation gates and an owner explicitly approves the authority change.
- **[Future plan]** Disabling/deleting Firebase Hosting, Auth, Firestore, Functions, Rules, indexes, Storage, or records is always a later destructive task requiring separate approval.

## Required version ledger

**[Future plan]** Every rehearsal/cutover report records:

- GitHub base/head commit and approved PR.
- Firebase Hosting release/version and mapped application commit where known.
- Active Firestore Ruleset hash/ID and deployed index/Function inventory.
- Firebase source snapshot/checkpoint and bounded counts/hashes.
- Supabase project/environment, schema migration version, RLS/grant version, deployment version, and backup/restore point.
- Provider-authority manifest per feature.
- Migration tool version, manifest hash, start/end times, operator/task, and approval reference.
- Rollback owner, decision deadline, and retained-source expiry.

## Rehearsal principles

1. **[Future plan]** Rehearse in an isolated environment with synthetic or explicitly approved protected copies; never point developer tests at Production Supabase/Firebase.
2. **[Future plan]** Use the same schema migrations, transformation version, RLS/grants, import order, verification queries, and rollback runbook intended for cutover.
3. **[Future plan]** Include malformed, legacy, orphan, conflict, duplicate, null timestamp, ownership mismatch, missing revision, and retry/concurrency fixtures.
4. **[Future plan]** Run the full Buyer/Supplier/Admin/Owner allow/deny matrix and browser UAT for Arabic/English and RTL/LTR on affected paths.
5. **[Future plan]** Perform at least one timed full-volume rehearsal and one restore/rollback rehearsal before Production authority changes.
6. **[Future plan]** Preserve rehearsal evidence as counts, hashes, timings, exceptions, and test results; do not retain unnecessary Production content.

## Mapping verification

- **[Future plan]** Keep source-record disposition separate from source-to-target mappings. Every migration batch/source collection/document/source-version key has exactly one active disposition: migrated, skipped, quarantined, merged, rejected, or no-target, with reason or exception evidence where applicable.
- **[Future plan]** One source document/version may map to zero target rows, one target row, or multiple normalized child rows. Every active target mapping belongs to its disposition and has exactly one deterministic semantic `child_key` or deterministic `child_ordinal`, plus source identity, transformation version, migration batch, mapping role, target logical type, and target UUID.
- **[Future plan]** Active logical-child-slot uniqueness excludes the target UUID, so no active child slot can fork into multiple target UUIDs. Active reverse target uniqueness provides target-to-source traceability; a reviewed many-source-to-one merge instead uses an explicit merge-group/reconciliation record that names the canonical target and every contributor.
- **[Future plan]** Every migrated root entity preserves its Firestore ID and source collection as a legacy alternate key where applicable; normalized child rows retain traceability through their source mapping, and no generated key may erase the original source evidence.
- **[Future plan]** Replay recomputes the same mapping plan idempotently. Identical replay returns existing targets; reviewed corrections atomically supersede active mappings without deleting predecessor/successor history or silently replacing a target.
- **[Future plan]** Reconciliation compares dispositions, active mappings, reverse traces, merge contributors, counts, relationships, and deterministic content evidence. Exceptions quarantine or reject the bounded source unit without a partial target graph; rollback follows verified active mappings in dependency order and preserves superseded evidence.
- **[Future plan]** Ambiguous one-to-many mappings, duplicate active child mappings, uncontrolled many-source-to-one merges, silent target replacement, lost Firestore IDs, source-evidence deletion before validation, and cutover without reconciliation are prohibited.
- **[Future plan]** Duplicate-index records are reconciliation evidence, not normal business data. Imported historical events and notifications are marked already materialized or fan-out suppressed and are never replayed as new notifications.
- **[Future plan]** Two-sided Supplier ownership, RFQ recipient eligibility, quotation ownership, conversation participation, and message receipts have explicit integrity queries.
- **[Future plan]** Unknown enum/field/type variants fail into an exception report; they are not coerced to a convenient default.
- **[Future plan]** Transformation algorithms for names, contacts, fingerprints, currency/number values, timestamps, and deterministic IDs are versioned and tested.

## Count and referential-integrity verification

| Gate | Required evidence |
|---|---|
| Collection/table counts | **[Future plan]** Source snapshot counts reconcile to the explicit dispositions; target counts reconcile to active zero-to-many mapping rows by logical type, mapping role, child slot, and status. |
| Primary/legacy and mapping uniqueness | **[Future plan]** No duplicate target primary key or applicable legacy ID; no active logical child slot forks, no reverse target is ambiguous, and every approved merge is represented by one reviewed merge group. |
| Foreign keys | **[Future plan]** Zero unexpected orphan users, Suppliers, claims, RFQs, recipients, quotations, revisions, conversations, participants, messages, notifications, files, events, or audits. |
| Ownership | **[Future plan]** Exactly one active canonical owner under current rules and complete agreement with source two-sided links. |
| Revision integrity | **[Future plan]** Positive monotonic sequence; current pointer equals maximum revision; immutable snapshot/event relationships exist. |
| Event/notification integrity | **[Future plan]** Deterministic event uniqueness and required notification/outbox linkage with no duplicates. |
| Access/entitlement | **[Future plan]** Grant/credit histories reconcile and effective access matches source at the snapshot time. |

## Hash and deterministic comparison

- **[Future plan]** Build canonical per-record and per-collection hashes from explicitly ordered, normalized, non-secret fields.
- **[Future plan]** Preserve separate hashes for identity keys, relationships, mutable current values, and immutable history so a mismatch is diagnosable.
- **[Future plan]** Do not place raw protected records, emails, UIDs, phone numbers, message bodies, or file paths in routine reports.
- **[Future plan]** Recompute deterministic response/revision/event/notification/import/idempotency/fingerprint keys and compare them to preserved legacy keys.
- **[Future plan]** A hash mismatch blocks the affected feature; “close enough” counts do not authorize cutover.

## Freeze and delta strategy

### Preferred bounded-feature freeze

- **[Future plan]** Announce a maintenance window and stop new writes only for the feature being cut over.
- **[Future plan]** Record a final source checkpoint, copy/transform the delta, verify it, then change the explicit provider authority.
- **[Future plan]** Keep unaffected features operational on Firebase.
- **[Future plan]** Do not freeze authentication or the entire application when a narrower safe freeze suffices.

### Delta migration

- **[Future plan]** Define an immutable source cursor/checkpoint before implementation: Firestore update timestamp plus document ID, or a trusted event/change ledger where ordering is complete.
- **[Future plan]** Run initial copy, then bounded deltas until lag is inside the maintenance-window budget.
- **[Future plan]** Freeze source writes, apply the final delta, and prove zero unexplained source changes after the checkpoint.
- **[Future plan]** Delta application is idempotent by source legacy ID/version and never creates a new business event/notification as an import side effect.
- **[Future plan]** If no reliable delta source exists for a feature, use a full freeze-and-copy or first build an audited change ledger in a separate phase.

## Feature-by-feature cutover

- **[Future plan]** Candidate order favors lower-coupling, read-heavy data after identity/RLS foundations: Supplier directory rehearsal before Claim; Claim before RFQ/quotation only after ownership is stable; messaging/Storage later because privacy/linkage risks are higher.
- **[Future plan]** Each feature PR defines the aggregate boundary, authoritative source/target, dependencies, migration set, freeze, tests, monitoring, and rollback.
- **[Future plan]** Do not split a command's invariant across providers. Examples: Supplier approval plus uniqueness/credits/audit; Claim decision plus ownership/event/audit/notification; quotation plus revision/event/notification.
- **[Future plan]** Reads and writes switch only through an explicit provider manifest. There is no record-existence routing or exception fallback.

## Cutover decision gate

**[Future plan]** Cutover requires all of the following:

- Exact version ledger and approved change window.
- Recent verified backups and successful restore rehearsal.
- Zero critical/high unresolved migration/security defect.
- Successful full-volume rehearsal within the window.
- Complete mapping/count/FK/hash/deterministic verification.
- RLS/grant/command security matrix passed independently.
- Browser/UAT passed for affected roles and locales.
- Monitoring/alerts and accountable on-call/rollback owner active.
- Firebase source retained and final delta/freeze proven.
- Explicit approval to change that feature's Production authority.

## Rollback triggers

- **[Future plan]** Any unauthorized cross-user/role/organization/Supplier access.
- **[Future plan]** Ownership mismatch, duplicate Supplier creation, lost Firebase UID link, or role escalation.
- **[Future plan]** Missing/duplicated quotation revision, event, notification, message, or audit artifact.
- **[Future plan]** Count/hash/FK divergence after final delta.
- **[Future plan]** Material error/latency/availability above the approved threshold, including Supabase pause/quota restriction.
- **[Future plan]** Auth verification/recovery/session failure that blocks affected TEST/Production roles.
- **[Future plan]** Storage hash/policy/broken-link failure.
- **[Future plan]** Inability to identify the authoritative backend or reconcile an ambiguous commit.

## Rollback execution principles

- **[Future plan]** The named rollback owner makes the decision within the pre-agreed observation threshold; avoid ad hoc shared ownership during an incident.
- **[Future plan]** Immediately freeze the affected feature's writes and capture the checkpoint/telemetry before changing authority.
- **[Future plan]** If no target-only writes occurred, verify the retained Firebase source and restore the provider manifest to Firebase.
- **[Future plan]** If target-only writes occurred, do not flip blindly. Execute the rehearsed reverse-delta/reconciliation or keep a maintenance freeze until data is safe.
- **[Future plan]** Disable target subscriptions/workers that could continue side effects before replay or reverse-delta.
- **[Future plan]** Preserve audit/event/idempotency records; rollback uses compensating actions, not history deletion.
- **[Future plan]** Communicate user-visible impact without exposing protected data or internal credentials.

## Monitoring and retention window

- **[Future plan]** Observe authorization denials, command errors, idempotent retries, event/outbox backlog, count/hash drift, latency, connection/quota/storage usage, Auth refresh failures, and file-link failures.
- **[Future plan]** Run automated reconciliation frequently during the initial window, then reduce frequency only after owner approval.
- **[Future plan]** Retain Firebase data/resources read-only for a period based on business recovery needs, legal/privacy retention, backup availability, and the longest migrated workflow lifecycle.
- **[Future plan]** The retention period starts after the last feature cutover and successful reconciliation, not after the first copy.
- **[Future plan]** Closing the window requires an explicit report: no open critical/high issue, completed reconciliation, recoverable backups, owner sign-off, and a separate decommission proposal.

## Explicitly excluded from these principles

- **[Verified current fact]** No executable Production command, schema SQL, migration, Supabase link, data copy, deployment, freeze, feature flag, DNS/Hosting/Auth change, or deletion is included.
- **[Future plan]** Every Production migration/cutover/rollback remains a separate approved task with exact commands reviewed at that time.
