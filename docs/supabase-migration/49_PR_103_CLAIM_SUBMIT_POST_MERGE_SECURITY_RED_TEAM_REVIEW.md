# PR #103 `supplier_claim.submit` post-merge security red-team review

Status: **Independent post-merge security/correctness review; documentation only; corrective implementation required before another Claim mutation command**

Review date: 2026-08-10

Primary task profile: Testing and CI

Repository: `mamounabdullah95-lab/Mujahiz.IQ`

Target PR: `#103`

Reviewed implementation head: `9c450f49a0d539c69bd9a80249b9632a81f7ca2b`

Merge commit: `fce7a0b3b0f8c5f8f130d91b16f748b6d9f2966c`

Review base: refreshed `origin/main` at `52b2043775d74374595c4cfbb12e16aaef465d10`

## 1. Post-merge state and scope

The review verified before writing this record that:

- `fce7a0b3b0f8c5f8f130d91b16f748b6d9f2966c` is an ancestor of refreshed `origin/main`;
- PR #103 head `9c450f49a0d539c69bd9a80249b9632a81f7ca2b` is represented by that merge;
- the SQL and pgTAP implementation at the merge is unchanged in current `main`; and
- the only later `main` changes are the documentation-only [Reviewer assignment/read readiness](51_CLAIM_REVIEWER_ASSIGNMENT_AND_READ_SECURITY_READINESS.md) and [trusted gateway HMAC/pool readiness](52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md) records.

This review inspected the authoritative [REL-001](31_REL_001_IDEMPOTENCY_AND_DOMAIN_EVENTS_FOUNDATION_CONTRACT.md), [Supplier Ownership and Claim](32_SUPPLIER_OWNERSHIP_AND_CLAIM_PROFILE_PRODUCT_DATA_SECURITY_CONTRACT.md), [ID-001](33_ID_001_IDENTITY_AUTHORITY_AND_PRIVILEGED_ACTOR_CONTRACT.md), [AUD-001](35_AUD_001_AUDIT_EVIDENCE_AND_TRUSTED_MUTATION_CONTRACT.md), [SEC-001](42_CLAIM_FIRST_RLS_AND_TRUSTED_AUTHORIZATION_SECURITY_CONTRACT.md), [runtime identity-context evidence](45_CLAIM_RUNTIME_IDENTITY_CONTEXT_FOUNDATION_EVIDENCE.md), [CLAIM-CMD-001](46_CLAIM_V1_TRUSTED_COMMAND_ATOMICITY_AND_LOCKING_CONTRACT.md), [Claim self-read evidence](47_CLAIM_RLS_SELF_READ_FOUNDATION_EVIDENCE.md), and [PR #103 implementation evidence](48_CLAIM_SUBMIT_TRUSTED_COMMAND_IMPLEMENTATION_EVIDENCE.md) before reviewing the exact merged [migration](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql) and [113-assertion pgTAP file](../../supabase/tests/claim_submit_trusted_command.sql).

No PR #103 implementation, test, validator, shared baseline, Decision Register, or Schema Design file was modified. No Firebase, hosted Supabase, Production, or controlled TEST operation occurred.

## 2. Executive conclusion

The merged command preserves the primary write-integrity boundary in the tested happy path: one initial execution commits one Claim, one minimized `claim_submitted` event, and one completed idempotency row atomically. Same-key parallel execution produced one initial result and one replay with no duplicate effects. Direct Claim insertion remains denied, API roles cannot execute the command, and the event-failure fault injection proves transaction rollback.

It is not contract-correct enough to extend unchanged. Three medium findings require correction before implementing another Claim mutation:

1. completed replay does not verify the exact immutable Claim/event/request binding and can return a wrongly rebound same-claimant/Supplier Claim;
2. a normal same-claimant/Supplier parallel submission with different keys is misclassified as an integrity incident instead of `active_claim_exists`; and
3. the documented processing-lease/attempt lifecycle is not durably exercised by the one-transaction function, while the focused tests manufacture those states directly.

No Critical or High vulnerability was found. The current implementation is local-only, unhosted, and unreachable from an application gateway, so urgent disablement is not warranted. The correction must be implemented in a separate hotfix; this review does not implement it.

## 3. Findings summary

| Severity | ID | Finding | Blocks additional Claim mutations |
|---|---|---|---|
| Critical | — | None | — |
| High | — | None | — |
| Medium | M-1 | Completed replay accepts an insufficiently verified result binding and returns mutable later state | **Yes** |
| Medium | M-2 | Normal same-pair parallel submit is mapped to `integrity_reconciliation_required` | **Yes** |
| Medium | M-3 | Processing lease, attempt fencing, and retry-limit states are not durably produced by the command path | **Yes** |
| Low | L-1 | The focused suite overstates runtime/concurrency/replay-integrity coverage | **Yes, as part of the hotfix proof** |
| Low | L-2 | URL validation is syntactic and cannot prove that a DNS host is public | No, unless a later path dereferences URLs |
| Low | L-3 | Unicode, evidence-order, and URL canonicalization equivalence is narrower than user-visible semantic equivalence | No, but fix or document before client activation |

## 4. Medium findings

### M-1 — Completed replay does not prove the exact committed result binding

**Evidence**

The completed path checks the idempotency outcome/resource type/non-null resource ID and a literal version token, then loads the referenced Claim. Its Claim-integrity check is limited to claimant and Supplier equality ([migration lines 500–536](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L500-L536)). It does not verify:

- the Claim's `submission_fingerprint_version` and `submission_fingerprint` against the completed idempotency request fingerprint;
- the unique ordinal-1 `supplier_ownership.claim_submitted` event linked through `producer_idempotency_key_id`;
- event aggregate ID/type/version/producer/sequence and immutable payload agreement; or
- an immutable original submit-result status/version contract.

A disposable PostgreSQL diagnostic demonstrated both consequences:

1. after the original Claim was advanced synthetically to `withdrawn`, version 2, replay returned the original ID but `outcome_code = submitted`, `claim_status = withdrawn`, and `claim_version = 2`; and
2. after a second Claim for the same claimant/Supplier was created, changing only the first completed idempotency row's `result_resource_id` to the second Claim caused replay of the first key/request to return the second Claim instead of `P5199 integrity_reconciliation_required`.

The second diagnostic reproduced the exact corrupt-result case required by REL-001. The corruption required privileged synthetic setup; it is not a demonstrated browser/API exploit. It nevertheless proves the command does not meet the mandated fail-closed integrity check.

**Failure scenario**

A future command, maintenance path, migration defect, restore anomaly, or privileged repair incorrectly changes a completed result UUID while leaving it pointed at another Claim for the same claimant/Supplier. The claimant's later identical retry is accepted and returns the wrong Claim. Once withdrawal, rejection, expiry, or another terminal transition permits sequential same-pair Claims, this is no longer a purely theoretical shape.

**Affected invariant**

- REL-001 completed-result corruption must produce an integrity-reconciliation failure and must never authorize re-execution or return another result.
- Same-key/same-request replay must return the command's stable safe result.
- A completed idempotency binding, aggregate, and producer event must be mutually consistent.

**Minimum corrective action**

Before another Claim mutation is implemented:

1. define the immutable submit replay envelope explicitly—either return the original `submitted`/version-1 result or separate current Claim status into an independently authorized read response;
2. verify the Claim fingerprint/version against `encode(idempotency.request_fingerprint, 'hex')`;
3. verify exactly one ordinal-1 `claim_submitted` event for the idempotency row, including aggregate, producer, sequence, actor, Supplier, claimant, and payload agreement;
4. return `P5199 integrity_reconciliation_required` on any mismatch; and
5. add focused tests for later-state replay, a missing/mismatched event, a same-pair wrong result UUID, and a fingerprint mismatch.

**Blocks additional Claim mutations:** **Yes.** The defect becomes materially reachable when another command can terminalize a Claim and permit a later same-pair submission.

### M-2 — A normal same-pair race is reported as an integrity incident

**Evidence**

The command obtains the principal and Supplier advisory locks, then locks/rechecks active same-pair Claims ([migration lines 592–698](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L592-L698)). It intends to map the active-pair unique index to `P5106 active_claim_exists` ([migration lines 894–903](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L894-L903)).

In a true two-session disposable diagnostic using the runtime role, the same claimant submitted the same Supplier with two different valid keys and different requests. The database retained exactly one Claim, but the loser returned:

```text
P5199 integrity_reconciliation_required
```

instead of the contracted:

```text
P5106 active_claim_exists
```

The same diagnostic proved that two different claimants can submit one unowned Supplier concurrently: both calls succeeded and exactly two claimant-distinct Claims were retained.

**Failure scenario**

A claimant double-submits through two tabs/devices or a gateway issues two independently keyed attempts. The normal business race is escalated as an integrity incident. A gateway following the approved mapping may show `result_unavailable`, trigger reconciliation/alerts, or suppress the correct claimant guidance even though the stored state is coherent.

**Affected invariant**

- Same claimant/Supplier parallel submit must deterministically yield one success and one stable `active_claim_exists` for different keys.
- `integrity_reconciliation_required` must remain reserved for contradictory/corrupt state, not an expected race.
- Anti-oracle errors must be stable without conflating normal contention with corruption.

**Minimum corrective action**

Reproduce the exact two-session path in a committed regression test, identify the swallowed underlying SQLSTATE/constraint path in restricted diagnostics, and map the expected active-pair race to `P5106` without passing raw database errors through. Preserve exactly-one-row behavior and keep `P5199` for genuine integrity mismatches.

**Blocks additional Claim mutations:** **Yes.** The shared Claim locking/error pattern must be correct before it is copied into withdrawal, assignment, expiry, rejection, or approval.

### M-3 — The lease/attempt lifecycle is not durable on the implemented command path

**Evidence**

The function inserts a `processing` idempotency row ([migration lines 427–468](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L427-L468)), performs all domain work, and marks the row `completed` ([migration lines 754–864](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L754-L864)) inside the same PostgreSQL function invocation and transaction. A PostgreSQL function cannot commit the reservation independently.

Consequences:

- another session cannot observe the first uncommitted `processing` row; it waits on the namespace uniqueness conflict and then sees either rollback/absence or a completed row;
- a command error rolls back the reservation, reclaimed attempt increment, and failure state together with the domain transaction;
- normal executions therefore do not durably accumulate `attempt_count` or leave a reclaimable processing lease; and
- the attempt-limit branch leaves a seeded row at `processing`, attempt 10, and returns `retry_later` indefinitely instead of terminalizing it for reconciliation.

The same-key parallel diagnostic confirmed the actual behavior: one session completed and the other returned the completed replay; exactly one Claim, event, and idempotency row existed. The focused suite's `command_in_progress` and retry-limit cases do not arise from parallel command executions—they manually insert `processing` rows as `postgres` before invoking the function ([test lines 914–1135](../../supabase/tests/claim_submit_trusted_command.sql#L914-L1135)).

**Failure scenario**

A long-running command holds the uncommitted namespace row while duplicate requests wait rather than receiving the bounded in-progress response. Gateway/pool timeouts can consume connections, and retry/attempt operational behavior differs from the approved contract. Later commands copied from this pattern would appear fenced in tests while lacking the intended durable reservation lifecycle.

This does **not** create duplicate Claims in the validated path: PostgreSQL uniqueness, transaction atomicity, and the shared locks remain protective. The defect is contract/availability/recovery correctness, not a demonstrated privilege escalation.

**Affected invariant**

- REL-001 requires a short durable reservation transaction before the authoritative domain transaction.
- An unexpired processing lease must produce a bounded in-progress result rather than hidden blocking.
- Retry attempts and the ten-attempt terminal reconciliation boundary must be durable and fenced.

**Minimum corrective action**

Choose and implement one coherent model before another command:

1. provide a narrow reservation/reclaim boundary that commits before domain execution, with no direct gateway access to `internal.idempotency_keys`; then lock and complete that exact fenced row atomically with Claim/event writes; or
2. formally revise the contract to a single-transaction blocking model and remove unsupported lease/attempt claims.

The approved REL model favors option 1. Add true multi-session tests for live lease visibility, expiry reclaim, stale fencing, attempt persistence, attempt exhaustion, rollback, and ambiguous commit.

**Blocks additional Claim mutations:** **Yes.** This is the shared idempotency architecture for every later Claim command.

## 5. Low findings

### L-1 — Focused tests do not prove several claimed runtime properties

**Evidence**

- The success and ordinary replay paths execute as `mujahiz_claim_runtime`, but after `RESET ROLE` most validation/eligibility/idempotency-conflict negatives execute as `postgres` ([test lines 478–846](../../supabase/tests/claim_submit_trusted_command.sql#L478-L846)). They test definer-body logic, not the complete runtime entry path.
- Processing and attempt-limit states are inserted directly rather than produced by competing command sessions.
- The 113 assertions contain no true parallel session, later-state replay, corrupt result binding, event/result mismatch, session-global HMAC, or Unicode-equivalence case.
- The forced event failure is meaningful and does prove Claim/event/idempotency rollback ([test lines 1143–1195](../../supabase/tests/claim_submit_trusted_command.sql#L1143-L1195)); cleanup and role restoration are correct.

**Failure scenario**

The suite passes while the three medium defects remain undetected, producing stronger confidence claims than its execution model supports.

**Affected invariant**

The security review and definition of done require role-correct, negative, race, replay, and rollback proof for the actual command path.

**Minimum corrective action**

Add runtime-role multi-session integration tests for M-1 through M-3. Keep superuser use limited to fixture setup and deliberate corruption/fault injection, and label those assertions accordingly.

**Blocks additional Claim mutations:** **Yes, as the required proof of the corrective hotfix.**

### L-2 — DNS-form validation does not prove a URL is public

**Evidence**

The parser requires HTTPS, removes default `:443`, lowercases and validates a DNS-style host, rejects credentials, brackets/IPv6, numeric IP literals, trailing-dot forms, and several local suffixes ([migration lines 270–360](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L270-L360)). SQL does not resolve or fetch the URL.

It can still accept a public-looking DNS name that resolves to loopback, link-local, RFC1918, or another private address, including rebinding/wildcard-DNS services. It also accepts reserved documentation/testing domains such as `.test`; the focused fixtures use them. Redirect destinations are not and cannot be validated by this inert SQL parser.

**Failure scenario**

There is no current SQL SSRF because the value is stored as private evidence text and no request is issued. A later reviewer/gateway/background service that dereferences it as if SQL had proved public could reach an internal endpoint or follow a redirect into a private network.

**Affected invariant**

`reference_url` must remain an untrusted inert descriptor unless a separately reviewed fetch boundary proves destination safety.

**Minimum corrective action**

Keep the database value inert. Any future fetcher must resolve and validate all A/AAAA results against explicit public-address rules, pin/recheck the connection destination, reject mixed/private results, validate every redirect hop, bound response size/type/time, and defend against DNS rebinding. Do not describe the current syntax check as proof of a public network destination.

**Blocks additional Claim mutations:** No, unless the new mutation/runtime dereferences evidence URLs.

### L-3 — Canonicalization is deterministic but not fully semantic

**Evidence**

Reason and summary normalization converts CRLF, collapses space/tab runs, and trims ordinary spaces, but it does not apply a declared Unicode normalization form. Evidence descriptor order is preserved. URL normalization covers scheme/host case, default port, and empty path, but not equivalent percent-encoding, dot-segment, query-order, or Unicode/IDN presentation forms.

**Failure scenario**

Visually equivalent NFC/NFD text, reordered evidence descriptors, or equivalent URL spellings can produce different fingerprints and `idempotency_key_conflict` under the same raw key. This does not enable a meaningful-request collision—the fingerprint is HMAC-SHA-256—but it can surprise a retrying client that reconstructs rather than preserves its canonical request.

**Affected invariant**

Equivalent retries must behave predictably under one documented canonicalization version.

**Minimum corrective action**

Before external client activation, either add a reviewed Unicode/URL/order normalization rule and increment the precondition/fingerprint version, or explicitly define code-point-exact text, descriptor-order significance, and current URL spelling rules as semantic. Clients must persist and resend the same logical request/key rather than reconstruct it ambiguously.

**Blocks additional Claim mutations:** No, but the shared canonicalization contract should be settled before gateway/client activation.

## 6. SECURITY DEFINER verdict

`SECURITY DEFINER` is necessary for this local design because `mujahiz_claim_runtime` deliberately has no direct mutation/read authority over the Claim, identity-link, ownership, idempotency, event, or audit bases. The exact merged routine has these positive controls:

- fixed `search_path = pg_catalog`;
- fully qualified relations and non-built-in routines, including `extensions.hmac`, `claim_security.*`, `public.*`, and `internal.*`;
- no dynamic SQL, `EXECUTE`, caller-selected object/schema/routine name, identifier interpolation, or generic SQL surface;
- no nested definer routine; the called principal/lock helpers are fixed-path `SECURITY INVOKER` routines;
- no attacker-writable schema is consulted;
- `PUBLIC`, `anon`, `authenticated`, and `service_role` cannot use the schema or execute submit; and
- only `mujahiz_claim_runtime` has `USAGE` plus the exact submit `EXECUTE` grant.

No function-shadowing or current nested-routine privilege-escalation path was found. Direct Claim `INSERT` remains denied and there is no mutation RLS policy.

The owner is explicitly `postgres`, a superuser ([migration lines 914–920](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L914-L920)). That maximizes the blast radius of any future injection/qualification defect and does not satisfy the approved hosted command-owner model. Because the current body is fixed/qualified, the runtime role is `NOLOGIN`, no gateway exists, and the feature is local-only, owner identity is not a current exploitable Critical/High defect. Before any gateway/hosted use, replace it with a dedicated `NOLOGIN`, non-superuser, non-`BYPASSRLS` command owner holding only exact required object privileges, as already recorded by document 52. Do not copy the superuser-owner pattern into later commands.

**SECURITY DEFINER verdict:** the exact local routine body is hardened against the reviewed shadowing/injection paths, but its superuser owner is local evidence only and is not activation-ready.

## 7. HMAC verdict and gateway/PostgreSQL boundary

### 7.1 What PostgreSQL currently enforces correctly

- Missing/empty, shorter-than-32-byte, longer-than-256-byte, or control-character-bearing key context fails closed as `claim_context_invalid` ([migration lines 142–154](../../supabase/migrations/20260809000500_claim_submit_trusted_command.sql#L142-L154)).
- Raw caller keys are format-bounded and never stored.
- Key, request, and lease digests use HMAC-SHA-256 with separate domain prefixes.
- The key-digest namespace includes environment, command, contract version, and raw-key length.
- The secret is not returned in results or written to Claim, idempotency, event, or audit rows; stable exceptions contain no secret/detail.
- Missing key cannot silently fall back to an unkeyed digest.

### 7.2 What the future gateway must enforce

PostgreSQL cannot infer entropy or trusted provenance from a 32–256-byte string. The future gateway must generate/load at least 32 random bytes per environment, keep the key server-only, inject it with a bound parameter, disable parameter/query/error capture, and never accept a request-supplied key/version.

The routine reads `current_setting` but cannot prove that the value was set transaction-locally. A stale session-global custom setting would be accepted if a valid principal context were established in a later transaction. No generic SQL or login path exists today, so this is a gateway/pool release gate rather than a current external exploit. The selected wrapper must set the HMAC inside the explicit transaction, prove it absent before/after on reused backends, roll back on every failure, and destroy any connection whose cleanup is uncertain.

PR #103 supports only one `local_v1` key. Blind replacement changes both key and request digests and can make the same raw retry reserve a second row. Before hosted use, implement the active-plus-one-retiring lookup/rotation model specified by [document 52](52_CLAIM_TRUSTED_GATEWAY_HMAC_POOL_SECURITY_READINESS.md#8-hmac-lifecycle). Key entropy, custody, zero logging, environment isolation, rotation, and pool cleanup are gateway responsibilities; exact digest generation, binding comparison, and fail-closed missing-key behavior remain PostgreSQL responsibilities.

**HMAC verdict:** no cryptographic primitive or direct secret-leak defect was found in the local SQL, but single-key rotation and transaction-local pool provenance are unimplemented activation blockers. Idempotency correctness is still unacceptable as-is because of M-1 and M-3.

## 8. Locking and race verdict

The implemented order is idempotency row, principal advisory lock, Supplier advisory lock, profile/provider rows, Supplier, ownership set, active same-pair Claims, optional prior Claim, and then allocation/writes. Within the current single-command surface, this preserves the intended empty-slot and same-pair invariants.

Independent parallel results:

| Race | Result |
|---|---|
| Same key, same claimant/Supplier/request | One initial success plus one replay; one Claim, one event, one idempotency row |
| Different keys, same claimant/Supplier | One Claim retained; loser incorrectly returned `P5199` instead of `P5106` (M-2) |
| Different claimants, same Supplier | Both succeeded; two claimant-distinct active Claims |

Future ownership creation, profile/provider-link state changes, and later Claim commands must share the exact versioned Supplier/principal lock helpers before they mutate the corresponding facts. PostgreSQL cannot lock a concurrent Firebase disablement; the future gateway must make the current Firebase observation at ingress and meet the approved bounded command-window release gate.

The 64-bit advisory hashes may collide. A collision only serializes unrelated principals/Suppliers: authorization and state checks still use the real UUIDs under row locks, so a collision cannot substitute one actor/Supplier or relax correctness. No hash-collision privilege escalation was found.

**Locking/race verdict:** data cardinality and duplicate-effect behavior are sound in the executed submit races, but the error taxonomy and lease lifecycle require the M-2/M-3 correction before the protocol is reused.

## 9. Identity, RLS, grants, and anti-oracle verdict

- The command derives the claimant only from `claim_security.current_claim_user_profile_id()`; its signature contains no claimant, Firebase UID, provider subject/link, role, status, or server time input.
- It checks one active Supplier-context profile and exactly one active linked Firebase row that is also the one usable primary active/verified mirror.
- SQL does not claim that these mirrors prove live Firebase state. Current token/current-user/disablement/verification authority remains the future trusted gateway's responsibility.
- Missing, inactive, duplicate, or ambiguous relational state fails closed.
- Direct Claim mutation is impossible for the runtime and API roles; the existing claimant-self FORCE-RLS policy/projection is unchanged.
- The command owner receives hidden authority only inside the fixed definer routine; the runtime receives no direct `internal.*` read.
- Stable errors generally avoid owner/competitor/provider/evidence/row identifiers. Unknown versus ineligible Supplier and unknown/invalid prior Claim are intentionally collapsed. M-2 overclassifies a normal race but leaks no hidden identity.

No cross-claimant, current-owner, provider-identity, or private-evidence oracle was found in the exact safe result/error body.

## 10. Event and audit verdict

The initial non-replay path inserts exactly one `supplier_ownership.claim_submitted` version-1 event with:

- aggregate `supplier_ownership_claim` and sequence 1;
- producer `supplier_claim.submit` version 1 and ordinal 1;
- the completed idempotency row reference;
- provider-neutral human actor and `local` environment; and
- payload limited to Claim ID, Supplier ID, claimant profile ID, and Claim version.

Reason, evidence, claimant snapshot/contact fields, Firebase/provider identity, raw idempotency material, notification text, and unrestricted metadata are absent. Unique producer-idempotency/ordinal and aggregate-sequence indexes prevent duplicate events. Same-key replay produced no duplicate.

AUD-001 does not classify ordinary claimant self-service submit as a mandatory privileged durable-audit action. The Claim aggregate and immutable `claim_submitted` event are the correct history for this slice. The absence of an `internal.audit_logs` row on initial execution and replay is contract-correct.

## 11. Fault-injection verdict

The focused test installs a temporary trigger that rejects PR #103 event insertion. The command maps the underlying failure to `P5199`, and the assertions prove:

- no Claim remains;
- no event remains;
- the idempotency reservation count is unchanged; and
- no audit row is created.

This is a valid proof that Claim/event/idempotency completion share one rollback boundary. It does not prove the separate durable reservation lifecycle claimed by REL-001, which is the subject of M-3. A completion-update failure would also roll back the Claim/event by PostgreSQL transaction semantics, but an explicit fenced-completion fault test should be added with the hotfix.

## 12. Validation performed

### 12.1 Official current merged suite

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-local-supabase-sql.ps1
```

Result: **passed** — 18 migrations applied; 18 pgTAP files; **1,181/1,181 assertions passed**, 0 failed, 60.4 seconds. This includes the PR #103 focused file's **113/113** assertions.

### 12.2 Independent disposable diagnostics

All diagnostics applied the 18 current migrations to isolated PostgreSQL 17.6 containers with synthetic rows and removed the containers afterward.

| Diagnostic | Exact result |
|---|---|
| Same key/same request in parallel | Both calls succeeded; one `idempotent_replay = false`, one `true`; same Claim ID; Claim/event/idempotency counts `1/1/1` |
| Different keys/same claimant/Supplier in parallel | One success, one `P5199`; Claim count 1; expected loser class was `P5106` |
| Different claimants/same Supplier in parallel | Both succeeded; Claim count 2 with two distinct claimants |
| Replay after synthetic later transition | Original Claim ID returned with `outcome_code = submitted`, `claim_status = withdrawn`, version 2 |
| Corrupt completed result binding | Replay returned the wrongly rebound second same-pair Claim; no integrity error |

One preliminary replay diagnostic stopped before command execution because its synthetic provider-link timestamps violated an existing constraint; the fixture was corrected. A second preliminary container encountered the known disposable-image initialization restart before migrations; the final diagnostics added the readiness window and completed. Neither preliminary failure changed repository state or indicates a PR #103 SQL failure.

## 13. Production impact and retained boundaries

Production impact: **None**.

The review used repository reads and disposable local PostgreSQL/Docker only. It accessed no Firebase service, hosted Supabase project, Production/TEST data, secret, DNS, billing, deployment, migration target, seed, or backfill. No Claim feature is deployed through this work.

The merged implementation may remain in `main` as inaccessible local substrate while the hotfix is prepared. It must not be treated as gateway-, hosted-, staging-, or Production-ready. The later documentation-only records 51 and 52 remain separate readiness guidance and do not correct any SQL finding in this review.

## 14. Final verdict

**B. HOTFIX REQUIRED BEFORE FURTHER CLAIM MUTATIONS**

No urgent disablement is required because there is no deployed or hosted execution path and the validated data-integrity invariants prevented duplicate effects. Do not implement `supplier_claim.withdraw`, reviewer assignment, expiry, rejection, approval, ownership mutation, or another Claim command until M-1 through M-3 are corrected and the role-correct multi-session regression proof in L-1 passes.

## 15. Exact stop point

Stop after this post-merge review document, validation evidence, commit/push, and one Draft review PR. Do not modify or revert PR #103 implementation/tests, create a hotfix, implement another Claim mutation, mark the review PR Ready, merge, deploy, access hosted/Firebase/Production state, or move data.
