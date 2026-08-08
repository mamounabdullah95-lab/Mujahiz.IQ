# Supplier ownership and Claim Supplier Profile product/data/security contract

Status: **Owner-approved contract; SUP-001 Resolved; one empty, fully revoked, local-only `public.supplier_ownerships` foundation selected as the proposed next SQL slice; no SQL or runtime implementation authorized**
Contract date: 8 August 2026
Verified refresh: `origin/main` `b1afb5a92d2b2e6f1182076c900a8947e049ebf3` after merged PR #81
Primary task profile: Documentation

Successor note: merged PR #85 implemented the selected empty, fully revoked, local-only `public.supplier_ownerships` foundation as the eleventh SQL slice. Current `main` is `22da8db4433c4fe7ca90ebe3b776a4da0a86eef2` with 17 physical tables, 15 implemented / 21 deferred Core Phase 1 concepts, and 11 Open gates after ID-001 resolution. The historical starting point, validation, and PR #82 stop point below remain evidence for this contract's decision task.

## 1. Decision boundary and recommendation

This document defines the approved future contract for `public.supplier_ownerships` and the Claim Supplier Profile workflow. It succeeds the higher-level SUP-001 direction in documents 02, 09, 10, and 11 and fixes the command dependency named by REL-001 in document 31 for design purposes only.

The approved smallest safe architecture is:

- a Supplier profile is a business listing, not a user, Auth identity, organization, ownership proof, or entitlement;
- `public.supplier_ownerships` records temporal, verified primary platform-control authority between one `user_profiles` row and one `supplier_profiles` row;
- a Supplier has zero or one active primary owner/controller; historical ownership rows are retained;
- one user may own or manage multiple Suppliers; no active uniqueness constraint is placed on `owner_user_profile_id` alone;
- additional Supplier delegates/admins are future `supplier_memberships`, not additional primary ownership rows;
- future organizations and organization memberships remain separate legal/tenant and workforce concepts. They do not become ownership evidence and are not prerequisites for an empty ownership foundation;
- Claim Supplier Profile is an unowned-Supplier acquisition workflow. An already-owned Supplier conflict cannot be approved through the ordinary Claim command and is routed to a separately approved transfer/dispute workflow;
- Claim evidence, claimant snapshot, and submitted reason are private and immutable after submission. Decisions, ownership activation/closure, events, and audit evidence are never inferred or silently rewritten; and
- Firebase remains authoritative for Production ownership until an explicitly approved feature cutover. Local Supabase remains non-authoritative and contains no ownership or Claim rows.

On 8 August 2026, the Product/Data/Security Owner approved this contract, resolved SUP-001, and selected one empty, fully revoked, local-only `public.supplier_ownerships` foundation as the proposed next SQL slice. This planning approval authorizes no SQL, pgTAP, RLS, Auth bridge, trusted command, audit, notification, Firebase change, data movement, hosted work, or Production/TEST action.

## 2. Verified starting state and authority separation

- PR #81 is merged into `origin/main` at `b1afb5a92d2b2e6f1182076c900a8947e049ebf3`.
- The tracked local migrations contain 16 physical tables representing 14 implemented Core Phase 1 concepts; 22 of 36 remain deferred.
- `public.user_profiles` and `public.supplier_profiles` exist locally. `public.supplier_ownerships` and `public.supplier_ownership_claims` do not.
- `supplier_ownerships` is a deferred Core Phase 1 concept. `supplier_ownership_claims` is Core Later because the Firebase collections have a verified Production count of zero and the repository Claim feature is not deployed or enabled.
- Firebase remains authoritative in Production. Current Production ownership, if present, is represented by the two-sided agreement between `users.supplierProfileId` and `suppliers.accountOwnerId`.
- Supabase remains local-only, unhosted, unlinked, and non-authoritative. No RLS, Auth bridge, application grants, client access, rows, migration engine, or hosted environment exists.
- REL-001 is decision-complete under Option D: no reliability SQL exists. The approved future producer path is `supplier_ownership.decide_claim`; its first concrete consumer is one claim-decision notification materializer.
- ID-001 is Resolved under approved document 33. The 11 Open gates remain `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

Current Firebase Claim behavior is implementation evidence, not a relational storage template. Repository code currently uses `pending_review|approved|rejected|withdrawn|expired|superseded`, a 30-day horizon, one active Claim per claimant, concurrent claims by different claimants, deterministic events/audits/notices, and two-sided ownership backlinks. The feature is not deployed; no live Claim or ownership-foundation record was found.

## 3. Identity, Supplier, ownership, membership, and organization model

| Concept | Recommended meaning | Must not mean |
|---|---|---|
| `user_profiles` | Provider-neutral application person/profile used as the accountable human principal | Auth provider subject, company, Supplier listing, ownership proof, or role grant |
| `identity_provider_links` | Link from a user profile to a provider subject and trusted provider-state mirror | Application role, Supplier ownership, or email-based account merge |
| `supplier_profiles` | Canonical listed Supplier/business profile | Login account, verified ownership, organization membership, RFQ eligibility, or payment status |
| `supplier_ownerships` | Temporal verified primary platform-control relationship between a human principal and Supplier | Corporate beneficial ownership, employment, general membership, or permanent entitlement |
| `supplier_memberships` | Future temporal operational authorization such as Supplier admin or delegate | Proof of primary ownership or legal entity identity |
| `organizations` | Future reviewed legal/business or tenant identity | A row inferred from free-text organization, email domain, or Supplier name |
| `organization_memberships` | Future temporal user-to-organization workforce/tenant authority | Automatic Supplier authority or Claim approval authority |

The organization model is deliberately not embedded into `supplier_ownerships`. A later approved organization-to-Supplier association may identify the legal/tenant entity behind a Supplier, while the ownership row continues to identify the accountable verified human controller. If the product later requires organizations themselves to be the authoritative ownership subject, that is a material SUP-001/ORG-001 redesign and must not be introduced through a nullable polymorphic owner column.

## 4. Viable architecture options

| Option | Boundary | Benefit | Cost/risk | Disposition |
|---|---|---|---|---|
| A | Keep `users.supplierProfileId` and `suppliers.accountOwnerId` as the long-term model | Minimal conceptual change | Duplicated mutable authority, no temporal history, one-Supplier-per-user assumption, difficult transfer/reconciliation | Reject for relational authority; retain only as Firebase source evidence/compatibility during transition |
| B | One active primary human owner/controller per Supplier in temporal `supplier_ownerships`; future delegates/admins in `supplier_memberships`; organizations separate | Smallest enforceable authority model, clear accountable controller, supports one user across multiple Suppliers, clean transfer/revocation history | Requires separate future membership and organization work | **Approved** |
| C | Multiple active ownership rows/co-owners per Supplier | Represents several legal/operational controllers directly | Quorum, conflict, transfer, recovery, notification, and final-owner rules become substantially more complex; current evidence does not justify them | Defer pending explicit multi-controller product/security contract |
| D | Organization is the only owner and users act only through organization membership | Strong tenant model if organizations are authoritative | ORG-001/ORG-002 are Open; no current organization collection or reliable bootstrap evidence; would fabricate relationships | Reject for the next slice; reconsider only after organization gates |
| E | Membership alone grants all Supplier authority | One relationship surface | Loses the distinction between verified controller and delegated operator; weakens transfer/dispute evidence | Reject |

Option B does not assert legal share ownership. “Owner” in this contract means the single verified accountable platform controller for the Supplier profile.

## 5. Cardinality and authority decisions

| Question | Approved contract |
|---|---|
| Active primary owner per Supplier | Zero or one |
| Historical owners per Supplier | Zero to many non-overlapping temporal rows |
| Suppliers per primary owner user | Zero to many |
| Operational users per Supplier | Zero to many through future memberships |
| Supplier admins/delegates | Future membership roles; never additional primary ownership rows by implication |
| Organization relationship | Optional and separately approved later; no organization row or membership is fabricated |
| Ownership derived from membership | Never |
| Membership derived from ownership | Only through a later trusted, explicit policy; not automatic in the empty foundation |

An owner may also receive an operational membership after the membership policy exists, but that membership is a projection of separately granted operating authority and is not the canonical proof of ownership. Revoking a membership does not rewrite ownership; revoking ownership does not silently preserve privileged memberships.

## 6. Recommended `supplier_ownerships` contract

The exact SQL names, types, lengths, constraint/index expressions, and pgTAP assertion count remain a later technical task. The product/data/security field groups are:

| Field group | Recommended contract |
|---|---|
| Identity | Database UUID; immutable |
| Relationship | Non-null restrictive Supplier FK and non-null restrictive owner user-profile FK |
| Authority | Bounded authority type fixed initially to `primary_controller` |
| Lifecycle | `active`, `transferred`, `revoked`, or `superseded`; `valid_from`, nullable exclusive `valid_until`, record version |
| Establishment provenance | Bounded source type such as `claim_approval`, `submission_approval`, `ownership_transfer`, or `legacy_reconciliation`; provider-neutral establishing actor/system and reason code |
| Closure provenance | Nullable closing actor/system, close reason code, transfer successor reference where applicable, and closed time |
| Future references | Claim, submission, idempotency, domain-event, and audit references are added only when their target contracts/tables exist; the empty foundation must not use unvalidated polymorphic IDs as substitutes |
| Timestamps | Trusted database times for creation and lifecycle transitions |

Required invariants are:

- at most one `active` primary-controller row per Supplier;
- no uniqueness on owner alone, so one user may own multiple Suppliers;
- active rows have `valid_until = null` and no closure fields;
- terminal rows have a valid exclusive `valid_until`, closure reason/source, and no later reactivation;
- intervals for one Supplier never overlap;
- transfer closes the prior row and creates a successor row in one trusted transaction;
- the relationship, authority type, establishment source, and `valid_from` are immutable;
- closure fields are write-once through a trusted command;
- normal hard delete is prohibited and foreign-key deletion is restrictive; and
- actor/provenance FKs record who acted but grant no authority.

`superseded` is limited to a reviewed correction of duplicate/invalid relational representation. A business ownership change uses `transferred` or `revoked`, never `superseded` to hide the prior controller.

## 7. Claim aggregate and lifecycle

`supplier_ownership_claims` remains one private Core Later table. Submitted reason, claimant snapshot, target Supplier, and bounded evidence descriptors are immutable. A separate `supplier_ownership_claim_evidence` table is not created before a future evidence/file need proves it.

Recommended statuses and transitions are:

| Status | Meaning | Allowed next status |
|---|---|---|
| `submitted` | Accepted immutable Claim awaiting reviewer assignment | `under_review`, `withdrawn`, `expired`, `superseded` |
| `under_review` | Assigned to a current authorized reviewer; no ownership change yet | `approved`, `rejected`, `withdrawn`, `expired`, `superseded` |
| `approved` | Terminal decision that created exactly one ownership row | None; later ownership change is transfer/revocation, not Claim mutation |
| `rejected` | Terminal reviewed decision with bounded reason code | None; a resubmission is a new Claim |
| `withdrawn` | Terminal claimant-initiated closure before decision | None |
| `expired` | Terminal close when the active 30-day review horizon ends | None |
| `superseded` | Terminal close because another Claim for the Supplier was approved or a reviewed replacement Claim was submitted | None |

The existing Firebase `pending_review` value maps to `submitted` unless independent reviewer-assignment evidence proves `under_review`. Opening a page or reading a row does not establish review assignment.

The initial active horizon remains 30 calendar days from trusted submission time. It applies to both `submitted` and `under_review`; no silent extension occurs. A future extension policy requires a new reviewed decision and immutable reason evidence.

## 8. Who may submit, review, and decide

### Claimant

A Claim may be submitted only by the claimant for themself through a trusted boundary. At submission and approval, the claimant must have:

- a current authenticated provider identity accepted under the approved ID-001 contract;
- an active, non-suspended `user_profiles` row;
- current provider verification where the approved ownership evidence method requires it;
- Supplier account context under the current hybrid product model; and
- no active Claim for the same claimant/Supplier pair.

Anonymous users, public visitors, unverified/disabled identities, and a platform operator impersonating a claimant cannot submit an ordinary Claim. Existing ownership of another Supplier does not block submission because one user may manage multiple Suppliers.

### Reviewer and decision actor

Review assignment and decision require a current authorized platform Admin or Owner under the resolved identity/role/access boundary. A reviewer/decision actor must not be:

- the claimant;
- the current or proposed primary owner in another role;
- an active member/admin/delegate of the target Supplier; or
- otherwise subject to a recorded security/conflict hold.

The assigned reviewer may decide an `under_review` Claim. A platform Owner may use a separately audited override/reassignment path; no browser row update grants reviewer authority. A reviewer may reject an unproven Claim but cannot approve an already-owned Supplier through `decide_claim`.

## 9. Evidence, verification, and provenance

Claim evidence is a set of at most three bounded immutable descriptors, preserving the current maximum while avoiding a premature file model. Each descriptor records:

- controlled evidence kind;
- claimant-supplied summary;
- source/provider class and bounded source reference;
- allowlisted HTTPS reference only where the controlled pre-FILE-001 rules permit it;
- submitted-at and submitting user-profile identity;
- optional digest/identifier only when its algorithm, sensitivity, and retention are approved; and
- no raw token, password, identity document, private file URL, complete registry extract, unrestricted note, or secret.

Recommended evidence kinds remain `company_domain_email`, `company_website`, `commercial_registration`, `authorization_letter`, and `other`, but the kind is only a label. It does not prove the asserted relationship.

Approval requires at least one reviewed high-assurance path:

1. an official registry or registration source that identifies the Supplier/legal entity plus evidence that the claimant is authorized to control the profile;
2. an independently verified authorization from a currently authorized officer/controller; or
3. a trusted company-domain challenge tied to reviewed Supplier-domain evidence, with an independent corroborating Supplier/legal-entity signal.

A public website, matching email domain, free-text job title, phone number, social account, Supplier name, listing verification, prior submission, or organization string alone is insufficient. Company-domain email is corroboration, not conclusive ownership proof.

The review record is separate from submitted evidence and is write-once at decision. It includes method code/version, outcome, checked source class, reviewer, reviewed time, bounded reason code, and restricted notes/evidence reference. Evidence descriptors and decision evidence remain private, immutable, retention-governed, and excluded from domain-event and notification payloads.

## 10. Duplicate, concurrent, conflict, and resubmission behavior

- One active Claim is allowed per `(claimant_user_profile_id, supplier_profile_id)`, not per claimant globally.
- Different claimants may hold concurrent active Claims for the same unowned Supplier so legitimate conflicts can be reviewed explicitly.
- An identical idempotent submission returns the existing result. Same-key reuse with a different fingerprint fails closed.
- A submitted Claim is never edited. The claimant withdraws it and creates a new Claim if material evidence must change.
- Approval locks/re-reads the Claim, claimant, Supplier, active ownership slot, and every active competing Claim for that Supplier in deterministic order.
- Approval creates one ownership row and atomically marks every other active Claim for that Supplier `superseded`. It never relies on an arbitrary maximum-conflict query for correctness.
- If an active ownership exists at submission, the ordinary Claim is not accepted. If ownership appears after submission, approval fails closed; an authorized reviewer may reject with `existing_owner`, while an unresolved integrity mismatch remains under a restricted security hold for reconciliation. The Claim is never linked automatically.
- Duplicate, ownership, identity, or source conflicts are quarantined with bounded reason evidence. Email/name/domain similarity never resolves them.

A rejected Claim may be resubmitted only as a new row that references the prior Claim and only when:

- the Supplier remains unowned;
- no active Claim exists for the same claimant/Supplier pair;
- the rejection reason permits resubmission;
- materially new evidence or a corrected target is supplied; and
- any `resubmission_not_before` or security hold has elapsed or been cleared by an authorized actor.

`insufficient_evidence`, `claimant_ineligible`, and `supplier_mismatch` may permit a corrected resubmission. `existing_owner` routes to transfer/dispute. `fraud_or_abuse` prohibits resubmission until a separately authorized security review clears the hold. The original rejected Claim and evidence are never reopened or overwritten.

## 11. Existing-owner conflicts, transfer, and revocation

Claim Supplier Profile is not the transfer command.

- An existing active owner blocks ordinary Claim approval.
- A voluntary transfer requires the current owner’s current authorization plus the new owner’s verified eligibility and approved evidence.
- A disputed/involuntary transfer requires a separately approved elevated policy, stronger evidence, conflict review, and audit; ordinary Admin convenience is insufficient.
- Transfer closes the current ownership as `transferred`, creates the successor ownership, recomputes Supplier eligibility, closes or explicitly reauthorizes memberships/participant intervals, and writes the required audit/event facts in one transaction.
- Revocation closes the active ownership as `revoked`, records reason/effective time/actor, removes or suspends derived privileged access, invalidates `can_receive_rfqs` unless another separately approved authorization basis remains, and leaves the Supplier unowned unless a transfer occurs in the same transaction.
- Restoration after revocation creates a new ownership row through an approved command. It never reactivates or edits the old row.
- Transfer/revocation never changes an approved Claim’s terminal status and never deletes ownership history.

No new owner inherits old private conversation/message access. Future participant authorization begins at a new explicit interval.

## 12. Verification, ownership, listing, and eligibility are distinct

- Supplier `verification_status` describes reviewed facts about the listing/data under its own method/version.
- Claim evidence verification describes whether evidence supports the claimant-to-Supplier control assertion.
- An active `supplier_ownerships` row records the platform’s current verified controller relationship.
- User/Auth verification describes the identity provider’s current account state.
- `can_receive_rfqs` is a separate trusted, versioned eligibility projection.

None implies another. A verified listing may be unowned. An active owner does not make a watchlisted/archived Supplier eligible. A verified email does not prove Supplier control. Revoking ownership does not falsify historical listing verification.

## 13. `supplierProfileId` and authoritative ownership source

During Firebase authority:

- `users.supplierProfileId` and `suppliers.accountOwnerId` remain the Production ownership source only when they agree exactly in both directions and the current account/profile eligibility checks pass;
- either side alone is insufficient; and
- contradictions, duplicates, missing users/Suppliers, or ambiguous provider identities are quarantined and never inferred.

After a separately approved Supabase ownership cutover:

- the one active `supplier_ownerships` row is authoritative;
- `supplierProfileId` and `accountOwnerId` become read-only legacy compatibility/mapping evidence until parity and rollback horizons close;
- they must not be dual-written as a second authority; and
- application authorization resolves Supplier scope from relational ownership/membership, not a client field, email, JWT application role, or cached backlink.

## 14. Same-Supplier authorization and future RLS boundary

The base ownership and Claim tables are critical private relations and start fully revoked. No anonymous or ordinary authenticated direct table access is approved.

- A claimant may read only their own Claim through a field-minimized path, including their submitted evidence and safe decision result but excluding internal security notes.
- A current authorized reviewer may read the full bounded review record required for assigned work.
- A primary owner, Supplier admin, or delegate does **not** gain raw access to another claimant’s Claim, contact snapshot, evidence, reviewer identity, or notes merely because the Claim names the same Supplier.
- An existing owner may receive only a separately approved minimized transfer/dispute request projection where their participation is required.
- Supplier-scoped operational access is based on current ownership/membership plus current user/provider/account/Supplier eligibility; it never grants Claim decision authority.
- Ownership history visible to a Supplier audience is field-minimized. Establishment/closure evidence, reviewer/actor identities, security reasons, provider subjects, and migration exceptions remain restricted.
- All ownership activation, transfer, revocation, Claim review assignment, and Claim decision writes occur through trusted commands. Direct browser writes are denied.

RLS is not column security. Any later client access requires reviewed security-invoker views/RPCs or equivalent field-minimized service responses and positive/negative tests for self, unrelated user, same-Supplier member, current/previous owner, conflicting claimant, Admin, Owner, suspended identity, stale provider link, and cross-Supplier access.

## 15. Future trusted command: `supplier_ownership.decide_claim`

This command can be contractually defined before REL-001 SQL exists. It cannot be implemented until its dependencies in section 19 are approved.

### 15.1 Version-1 inputs

| Input | Contract |
|---|---|
| `idempotency_key` | Caller-generated high-entropy key accepted only at the trusted boundary; handled under document 31 |
| `claim_id` | Stable Claim UUID |
| `expected_claim_version` | Positive version observed by the reviewer; stale values fail closed |
| `decision` | Exactly `approve` or `reject` |
| `decision_reason_code` | Bounded code from the approved review policy; required for rejection and recorded for approval |
| `reviewer_notes` | Optional bounded restricted text; never returned to claimant, event payload, or notification |
| `evidence_verification` | Bounded method code/version, outcome, checked source classes, and restricted evidence references; no raw documents or secrets |
| `correlation_id` | Optional opaque UUID validated or generated at trusted ingress |

Actor identity, role, Supplier/claimant IDs, current ownership, current eligibility, timestamps, event IDs, audit IDs, notification content, and result IDs are server-derived and cannot be caller-selected.

### 15.2 Required reads, locks, and preconditions

The command serializes and re-reads in a documented order:

1. idempotency record/lease;
2. actor profile, provider state, platform role/access, and conflict relationship;
3. Claim row/version/reviewer assignment and immutable submission fingerprint;
4. claimant profile/provider/account eligibility;
5. Supplier profile/listing/verification eligibility;
6. active ownership slot and relevant ownership history;
7. every active competing Claim for the Supplier in deterministic order; and
8. source-specific evidence verification and security/quarantine holds.

Approval requires `under_review`, current assignment/override authority, an unexpired Claim, unchanged version, an unowned Supplier, an eligible claimant/Supplier, approved evidence result, and no unresolved conflict. Rejection requires the same actor/Claim integrity checks but does not require ownership eligibility to remain true.

### 15.3 Atomic effects

For approval, one transaction:

- terminalizes the Claim as `approved` with write-once decision fields;
- creates exactly one active primary-controller ownership row;
- terminalizes every other active Claim for the Supplier as `superseded` with a reference to the approved Claim;
- completes the idempotency result binding;
- writes the required AUD-001 audit outcome; and
- writes deterministic domain events for the approved Claim and each superseded Claim.

For rejection, one transaction terminalizes the Claim as `rejected`, completes the idempotency result binding, writes the required audit outcome, and writes one deterministic rejection event. It creates or changes no ownership row.

The command never inserts a notification. The notification materializer is the only notification-creation path after the outbox design is active.

### 15.4 Version-1 result

The safe result contains:

- `outcome_code`;
- `claim_id`;
- terminal `claim_status`;
- committed `claim_version`;
- `supplier_profile_id`;
- nullable `ownership_id` for approval;
- primary `domain_event_id`;
- `superseded_claim_count` for approval, without exposing other claimant/Claim identities; and
- `idempotent_replay`.

It contains no other claimant data, evidence, reviewer notes, internal reason detail, notification copy, provider subject, or unrestricted row snapshot. A completed replay rehydrates this safe result only after current read authorization, as required by REL-001.

### 15.5 Stable failure classes

At minimum: `actor_not_authorized`, `reviewer_conflict`, `claim_not_found`, `claim_not_reviewable`, `claim_expired`, `claim_version_conflict`, `claim_integrity_conflict`, `claimant_ineligible`, `supplier_ineligible`, `supplier_already_owned`, `evidence_not_verified`, `security_quarantined`, `idempotency_key_conflict`, and `integrity_reconciliation_required`. Failures reveal no unrelated user, owner, or Claim details.

## 16. Idempotency, events, audit, and notification dependency

Document 31 remains authoritative for the reliability foundation:

- the command name is `supplier_ownership.decide_claim`, contract version 1;
- the idempotency fingerprint includes Claim ID, expected Claim version, decision, reason code, reviewer-notes digest, evidence-verification projection/version, and relevant explicit preconditions;
- the same scoped key/fingerprint replays the committed safe result; any changed binding fails `idempotency_key_conflict`;
- domain mutation, idempotency completion, audit success outcome, and domain events commit atomically;
- the initial replay horizon is at least 30 days, while a minimized privileged-ownership conflict tombstone persists through the ownership/cutover/rollback horizon under the later retention approval; and
- no reliability row, lease, worker, or SQL is implemented by this contract.

Proposed event registry entries are:

| Event type | Aggregate | Minimum version-1 payload | Consumer |
|---|---|---|---|
| `supplier_ownership.claim_approved` | Approved Claim | Claim ID, Supplier ID, claimant user-profile ID, ownership ID, committed Claim version | `supplier_claim_decision_notification_materializer` |
| `supplier_ownership.claim_rejected` | Rejected Claim | Claim ID, Supplier ID, claimant user-profile ID, committed Claim version, bounded decision reason code | Same materializer |
| `supplier_ownership.claim_superseded` | Superseded competing Claim | Claim ID, Supplier ID, claimant user-profile ID, approved Claim ID, committed Claim version | Same materializer |

Payloads contain no names, email/phone, evidence, notes, notification text, provider subjects, or raw source data. Event ordinals are deterministic: the primary decision event is first; superseded Claim events follow stable Claim-ID order. Each affected Claim remains its event’s primary aggregate.

AUD-001 remains the source for attempt/outcome/actor/reason/investigation retention. The audit record is not an outbox and the event is not a complete audit history.

MSG-003 remains the source for bilingual rendering snapshots, protected-notice behavior, class-based retention, read state, channels, and external delivery. The first materializer creates at most one notification per `(event_id, recipient_id, channel)` and marks the event processed in the same transaction. Historical/imported events are fan-out-suppressed.

## 17. Firebase-to-Supabase mapping and reconciliation

| Firebase evidence | Relational treatment |
|---|---|
| Exact two-sided `users/{uid}.supplierProfileId == supplierId` and `suppliers/{supplierId}.accountOwnerId == uid` | May create one historical/current ownership row only after provider/user/Supplier mapping and eligibility reconciliation pass |
| One backlink missing, mismatched, duplicated, or pointing to an unknown identity/Supplier | Quarantine; create no ownership row and infer nothing from email/name/domain |
| `supplierOwnershipClaims` | Preserve legacy ID and immutable source snapshot only in a separately approved Claim migration; `pending_review` maps to `submitted` absent reviewer-assignment proof |
| Terminal Claim status | Map only when timestamps, actor/source, target, and transition evidence reconcile; otherwise quarantine |
| `supplierClaimantLocks` | Concurrency evidence only; prefer relational active-Claim constraints/locking and create no permanent business row by default |
| `supplierOwnershipClaimRequests` | Preserve source disposition/digest metadata only under approved retention; never reuse the opaque Firebase digest as a raw Supabase key |
| `supplierOwnershipEvents` | Map through source dispositions to ownership/Claim/domain/audit targets only where semantics are proven; create no separate ownership-events table |
| Existing notifications | Import as already materialized/fan-out-suppressed; never regenerate from historical events |

Reconciliation requires:

- preserved Firebase collection/document IDs and provider-subject mappings;
- exact one-to-one agreement for every migrated active ownership slot;
- no overlapping active Supplier ownership intervals;
- no ownership target without a mapped eligible user and Supplier;
- Claim/evidence/status/decision source hashes and zero-to-many mapping evidence;
- event/audit/notification linkage checks without exposing complete protected records;
- explicit dispositions for migrated, skipped, quarantined, rejected, merged, or no-target source records; and
- a provider-authority manifest that names exactly one ownership authority at a time.

Ambiguous or conflicting Firebase ownership evidence is always quarantined. Manual review may resolve it only through an approved evidence record and trusted command; reconciliation tooling never guesses.

## 18. Rollback and correction implications

- Before Supabase authority, rollback leaves Firebase authoritative and removes no Firebase data.
- After a future cutover, rollback changes the provider manifest only through an approved freeze/reconciliation runbook; it does not blindly copy relational ownership back into both Firebase backlinks.
- If target-only ownership changes exist, writes remain frozen until reverse-delta or compensating reconciliation is proven.
- Completed Claim decisions, ownership rows, idempotency bindings, audit facts, and domain events are retained; rollback never deletes or rewrites them.
- A committed ownership change is corrected by a new transfer, revocation, or reviewed supersession command with new causal/idempotency evidence.
- Any backlink mismatch, overlapping ownership, approved Claim without ownership, ownership without approved source, missing decision audit/event, duplicate materialization, or ambiguous in-flight command is a fail-closed exception that blocks cutover/rollback for the affected Supplier.
- Revocation/transfer recomputes Supplier authorization and closes future access intervals; old private messages are not inherited by a successor.

## 19. Dependency and gate decision

| Dependency | Empty revoked `supplier_ownerships` foundation | Claim/ownership rows or mapping | `decide_claim` implementation and notification path |
|---|---|---|---|
| SUP-001 Product/Data/Security Owner approval | **Resolved**; empty one-table selection approved | Approved contract governs any later rows/mapping | Command contract approved for design only; runtime remains separately gated |
| ID-001 | **Resolved**; does not block empty provider-neutral FKs | Approved contract must be implemented before authoritative principal/provider validation and real rows | Document 33 approves the complete actor/claimant authentication contract; runtime remains blocked until implementation |
| Platform role/access foundation | Does not block the ownership table | Required before non-synthetic privileged decisions | `platform_role_assignments` is required but insufficient; current Firebase/profile/link/access/security and reviewer-conflict checks must also pass |
| ORG-001 / ORG-002 | Do not block under recommended Option B | Block only organization-owned tenancy/bootstrap or organization-derived access | Not required for unowned-Supplier Claim v1; required if organization authority is later added |
| AUD-001 | Does not block empty table | Blocks non-synthetic ownership decisions/transfer/revocation | Blocks required decision audit implementation |
| MSG-003 | Does not block empty table or ownership history | Does not block an inert empty table | Blocks notification materializer and therefore the approved REL-001 producer/consumer delivery path |
| REL-001 Option D | No reliability table is included | No event/idempotency runtime yet | Command can be documented now; runtime waits for the coherent reliability foundation and approved consumer |
| FILE-001 | Does not block ownership table | Blocks file-backed Claim evidence; bounded controlled descriptors remain the only pre-FILE-001 path | Not required if approved evidence uses no stored file object |
| MIG-002 / RES-001 | Do not block empty local-only DDL | Block hosted environment/data movement | Block hosted/Production execution |

No organization/account gate is required by the recommended empty ownership model. Choosing organization as the actual owner/tenant would change that conclusion and require ORG-001/ORG-002 before DDL selection.

## 20. Smallest safe SQL-slice conclusion

An empty, fully revoked, local-only `public.supplier_ownerships` foundation is approved as the proposed next local SQL slice and is structurally dependency-safe now. It does not need to wait for ID-001, ORG-001, ORG-002, AUD-001, MSG-003, or REL-001 SQL when all of the following restrictions hold:

- exactly one empty table is created against the existing `user_profiles` and `supplier_profiles` roots;
- it implements the temporal/cardinality/lifecycle/provenance field groups and constraints in sections 5-6;
- it has one-active-primary-owner-per-Supplier enforcement and deliberately no one-Supplier-per-owner enforcement;
- it includes restrictive FKs, structural indexes/comments, complete API-role privilege revocation, and zero rows/access objects;
- it includes no organization, membership, Claim, audit, notification, event, idempotency, routine, trigger, RLS, policy, view, RPC, Auth bridge, mapping execution, data migration, seed, backfill, Firebase, hosted, Production, or TEST work; and
- no row may be activated until source-specific provenance/FKs, the approved ID-001 contract, trusted commands, audit, security policy, and migration approvals required for that source are implemented.

The table must not contain generic unvalidated `source_type/source_id` polymorphic references as a substitute for future Claim/submission/event FKs. The empty foundation may reserve bounded source classes; source-specific relationships are added before the first row of that class.

If later separately implemented and merged, the projected local state would be 17 physical tables, 15 implemented Core Phase 1 concepts, and 21 deferred. This documentation task leaves the verified state at 16 / 14 / 22.

`supplier_ownership_claims` is not part of that slice. It remains Core Later and waits for separate Claim retention/evidence, implementation of the approved ID-001 contract, AUD-001, trusted-command runtime, RLS, and REL/MSG delivery approvals.

## 21. Decision status and remaining owner decisions

The future `supplier_ownership.decide_claim` version-1 contract is approved for design purposes before reliability SQL exists, but it is not implementation-authorized. Its inputs, outputs, locks, aggregate effects, idempotency boundary, events, audit separation, and notification dependency are contractually explicit.

The Product/Data/Security Owner approved these SUP-001 decisions on 8 August 2026:

1. Option B: one active primary human controller per Supplier, one user may own multiple Suppliers, and delegates/admins use future memberships;
2. organization independence: no organization owner subject or fabricated organization/membership in the empty foundation;
3. Claim lifecycle, 30-day horizon, one active Claim per claimant/Supplier pair, concurrent different claimants, immutable evidence, and new-row resubmission rules;
4. evidence threshold and reviewer conflict-of-interest boundary;
5. ordinary Claim hard stop for already-owned Suppliers and separate transfer/dispute semantics;
6. authoritative relational ownership after cutover, with Firebase backlinks retained only as reconciled compatibility evidence; and
7. the exact empty one-table boundary in section 20 as the proposed next SQL slice.

No additional Owner decision remains for SUP-001, the approved Claim contract, the design-only `decide_claim` contract, or selection of the empty structural table. Exact SQL/pgTAP remains a separate technical task. Real rows and runtime still require implementation of the approved ID-001 contract, AUD-001, MSG-003/REL-001, security/RLS, mapping, retention, migration, hosted, and Production approvals.

## 22. Risks, validation, and exact stop point

Key risks are treating a listing or verified email as ownership; preserving the one-Supplier-per-user Firebase limitation; representing delegates as co-owners; exposing competing claimant PII to same-Supplier users; approving over an existing owner; rewriting historical ownership; regenerating notifications during migration; and inferring from conflicting backlinks. This contract fails closed on each risk.

Required validation is documentation-only: latest refreshed `origin/main` after merged PR #81; 16 physical tables; 14 implemented / 22 deferred Core Phase 1 concepts; 12 unchanged Open gates; cross-document links; terminology; sensitive-content patterns; documentation-only diff; and `git diff --check`.

Do not start Supabase, execute migrations, run pgTAP, access Firebase, inspect Production/TEST data, implement SQL, create rows, change Auth/RLS, implement audit/notification/reliability code, merge, or deploy.

Exact stop point: PR #82 marked Ready for review with Owner approval recorded, SUP-001 Resolved, and the empty one-table foundation selected as the proposed next local SQL slice. Stop before SQL/pgTAP implementation, Claim/command/RLS/Auth implementation, audit/notification work, data movement, hosted access, merge, or deployment.

## 23. References

- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`03_AUTH_AND_IDENTITY_OPTIONS.md`](03_AUTH_AND_IDENTITY_OPTIONS.md)
- [`06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md`](06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md`](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md)
- [`../claim-supplier-backend-deployment.md`](../claim-supplier-backend-deployment.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
