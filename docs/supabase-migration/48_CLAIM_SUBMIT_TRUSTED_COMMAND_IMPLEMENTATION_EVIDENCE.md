# Claim submit trusted command implementation evidence

Status: **Local-only supplier_claim.submit v1 implemented and validated; no other Claim command, hosted capability, real data, Production activation, notification, ownership creation, review, or decision runtime**

Date: 2026-08-09

Starting origin/main: a985793e18e919e2b89361d6dfe6c8605ba8f8af, the verified handoff after merged PR #100 and including the PR #101/#102 Claim identity-context and self-read foundations

Primary task profile: Supplier

## 1. Result and exact boundary

The eighteenth tracked local migration implements exactly one trusted mutation command:

supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid)

The inputs are limited to:

1. idempotency key;
2. Supplier profile UUID;
3. bounded private submitted reason;
4. evidence schema version;
5. zero to three bounded evidence descriptors;
6. optional prior Claim UUID; and
7. optional opaque correlation UUID.

The claimant, status, version, submission time, and expiry are not caller inputs. The safe typed result returns only command/version, outcome, Claim UUID, Claim status/version, Supplier UUID, trusted submission/expiry timestamps, and an idempotent-replay flag.

No assign, withdraw, approve, reject, expire, supersede, ownership-creation, notification, or placeholder command is introduced. No table, view, RLS mutation policy, real row, seed, backfill, file/storage integration, hosted Supabase resource, Firebase call, or Production/TEST operation is introduced.

## 2. Trusted actor, eligibility, and serialization

The effective claimant is derived only from claim_security.current_claim_user_profile_id(). Missing, malformed, wrong-purpose, wrong-environment, wrong-policy, or wrong-transaction context resolves no principal and produces stable SQLSTATE P5100 / claim_context_invalid. The function signature contains no claimant UUID, Firebase UID, provider subject, link ID, role, reviewer, browser timestamp, status, or version input.

After the idempotency reservation/replay boundary, the command acquires versioned transaction advisory locks in deterministic order:

1. provider-neutral claimant principal; then
2. target Supplier.

Under those locks it re-reads and row-locks every mutable eligibility fact used by the decision. A successful ordinary submission requires:

- active Supplier-context profile;
- trusted verification mirror status verified;
- exactly one active linked Firebase provider row for the profile and exactly one usable primary row whose mirrored identity is active and verified;
- approved Supplier listing not in watchlist verification;
- no active authoritative primary-controller ownership;
- no active submitted/under_review Claim for the same claimant/Supplier pair; and
- when supplied, a same-claimant, same-Supplier rejected prior Claim with an allowed resubmission reason, no existing successor, and materially changed normalized reason or evidence.

The SQL command validates only the currently available relational mirrors. It does not contact Firebase and does not prove live Firebase token/account usability. A future trusted gateway remains responsible for current Firebase observation before establishing transaction-local Claim context.

## 3. Reason and evidence boundary

The private submitted reason is normalized, rejects control characters, and is bounded to 20–1,200 characters and at most 2,000 bytes.

The only accepted evidence schema is claim_evidence_v1. It permits zero to three descriptors, each with exactly:

- kind;
- summary; and
- optional reference_url.

The minimum current-product kind allowlist is:

- company_domain_email
- company_website
- commercial_registration
- authorization_letter
- other

Summaries are normalized and bounded to 20–1,600 characters and at most 4,000 bytes. Optional references must be bounded public HTTPS URLs with a DNS-style host, no credentials, no IP literal, no private/local hostname suffix, and no duplicate canonical reference. Unknown schemas/types and generic metadata fail closed. No file identity, upload metadata, signed URL, binary content, or arbitrary evidence object is accepted.

The Claim stores a server-derived claimant_snapshot_v1, claim_submit_v1 request fingerprint, normalized claim_evidence_v1 descriptors, status submitted, record version 1, trusted database time, and the exact 720 hours expiry interval. Review, decision, terminal, ownership-result, and supersession fields remain null.

## 4. Idempotency and stable errors

The command uses only internal.idempotency_keys. It stores no raw idempotency key. A transaction-local mujahiz.claim.hmac_key secret of 32–256 bytes derives the namespaced key digest and canonical request fingerprint with HMAC-SHA-256; the secret is neither persisted nor returned.

The canonical request includes every semantic caller input that can change the Claim result:

- Supplier UUID;
- normalized private reason;
- evidence schema;
- canonical evidence descriptors; and
- optional prior Claim UUID.

The correlation UUID is deliberately observability metadata rather than result semantics: the first successful execution persists it on the event, while a replay returns the already-committed safe result and does not rewrite the event.

Behavior is deterministic:

- new key plus valid request creates one Claim and one event and completes one idempotency row;
- same scoped key plus the same canonical request replays the original safe result;
- same key plus a different canonical request returns P5108 / idempotency_key_conflict;
- an unexpired processing lease returns P5109 / command_in_progress;
- an expired lease at the ten-attempt bound returns P5110 / retry_later;
- completed-result corruption and unexpected internal failures map to P5199 / integrity_reconciliation_required.

Other stable anti-oracle classes cover invalid input, unsupported evidence, claimant/Supplier ineligibility, active ownership, active same-pair Claim, and invalid prior Claim without exposing unrelated private state.

## 5. Atomic write set, event, and audit decision

A successful non-replay transaction atomically:

1. reserves the shared idempotency namespace;
2. validates current state under principal/Supplier serialization;
3. inserts exactly one public.supplier_ownership_claims row;
4. inserts exactly one immutable supplier_ownership.claim_submitted version-1 event; and
5. marks the idempotency result completed.

The event aggregate is supplier_ownership_claim, sequence 1, producer supplier_claim.submit version 1, and payload is limited to Claim UUID, Supplier UUID, claimant profile UUID, and Claim version. It excludes private reason/evidence, snapshot/contact data, Firebase/provider identity, raw request, idempotency material, audit payload, and tokens. No notification is written.

AUD-001 does not classify ordinary claimant self-service submission as a privileged durable-audit action. The authoritative Claim row plus immutable domain event provide the approved history evidence, so this slice intentionally writes no internal.audit_logs row. Focused tests prove both initial execution and replay leave audit count unchanged.

A synthetic test-only trigger forces domain-event insertion to fail. The command maps the failure to the stable integrity error and the test proves that no Claim, event, or idempotency reservation is partially retained.

## 6. SQL security model and exact privileges

The non-exposed supplier_claim schema contains exactly one routine. supplier_claim.submit is the only new SECURITY DEFINER routine because the runtime role must not receive direct authority over fully revoked Claim, identity, ownership, idempotency, event, or audit tables.

Safety controls are:

- explicit owner postgres;
- fixed search_path=pg_catalog;
- fully qualified relation and non-built-in function references;
- no dynamic SQL or caller-controlled object name;
- PUBLIC, anon, authenticated, and service_role schema/function authority revoked;
- only mujahiz_claim_runtime receives schema USAGE and submit EXECUTE;
- no direct runtime table mutation or internal-table read authority;
- no Claim INSERT, UPDATE, or DELETE RLS policy; and
- versioned lock-key helpers are strict immutable SECURITY INVOKER routines with execution revoked from the runtime and API roles.

The two and only two positive grants introduced are:

1. USAGE on schema supplier_claim to mujahiz_claim_runtime;
2. EXECUTE on supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid) to mujahiz_claim_runtime.

The existing claimant self-read projection remains unchanged. Focused tests prove claimant A can see both newly submitted Claims through it while claimant B sees neither.

## 7. Validation evidence and exact counts

- Focused disposable PostgreSQL 17.6 pgTAP: **113/113 passed**.
- Complete repository SQL validator: **18 migrations applied; 18 pgTAP files; 1,181/1,181 assertions passed; 0 failed**.
- Tracked migrations: **18**.
- pgTAP files: **18**.
- Physical PostgreSQL tables: **22**, unchanged.
- Claim RLS policies: **1**, the existing claimant self-select policy only.
- New mutation RLS policies: **0**.
- Routines introduced: **3** — two non-callable lock-key helpers and one callable submit command.
- Positive grants introduced: **2**, both limited to mujahiz_claim_runtime as listed above.
- Core Phase 1 concepts: **20 implemented / 16 deferred**, unchanged because no table/concept was added.
- Sensitive-value scan of the migration/test: **0 matches** for private-key, cloud-key, GitHub-token, JWT, database-credential URI, and common secret-token patterns.
- Privilege/grant scan: **passed**; no unexpected positive grant.
- SECURITY DEFINER safety scan: **passed**; one new definer, explicit owner, fixed minimal search path, no dynamic SQL, API/PUBLIC execution denied.
- git diff --check: **passed**.
- Disposable validation/diagnostic Docker containers remaining: **0**.

The official validator initially encountered the disposable Supabase image's transient initialization shutdown before any migration ran. The successful full run used a one-process delay for the first readiness probe only; the repository runner and PostgreSQL image were not modified.

## 8. Production impact, residual risks, and stop point

Production impact is **none**. All execution used disposable local PostgreSQL and synthetic rows that were deleted before each test completed. No Firebase service, hosted Supabase project, real user or Claim, Production/TEST data, secret, deployment, DNS, billing, configuration, seed, or backfill was accessed or changed.

Residual work remains deliberately outside this slice:

- build and review the real trusted gateway that validates current Firebase state, establishes context, and injects the HMAC secret through an approved pooled-connection boundary;
- complete hosted isolation and key-management review before any hosted use;
- implement the other five CLAIM-CMD-001 commands only as separate approved slices;
- implement reviewer/Admin authorization, ownership creation, notification materialization, and FILE-001 evidence custody separately; and
- update shared baseline/register/schema-design documents only after the implementation PR is reviewed/merged.

Exact stop point: local implementation and deterministic validation of supplier_claim.submit, evidence document, intentional commit/push, and Draft PR only. Stop before Ready status, merge, deployment, hosted access, Production/TEST data, another Claim command, or any notification/reviewer/decision/ownership runtime.