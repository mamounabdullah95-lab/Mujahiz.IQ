# Claim owner-role privileged provisioning readiness

Status: **Merged B4-P0 authority from PR #139; B4-P1 merged by PR #140; B4 is
blocked by the separate B4-P2 projection-helper ACL finalization readiness
contract**

Date: 2026-08-16

Verified starting `origin/main`:
`7f9d810006d12301365af747477257f5489b0009` (merge of PR #138)

Working branch: `codex/claim-owner-role-provisioning-readiness`

Primary task profile: Documentation

Post-B4-P1 evidence proved one additional prerequisite that this document did
not authorize: the future human command owner cannot receive the two required
projection-helper EXECUTEs from ordinary non-owner `postgres`. The separate
[B4-P2 projection-helper ACL finalization readiness](72_CLAIM_PROJECTION_HELPER_ACL_FINALIZATION_READINESS.md)
selects one exact privileged ACL exception. It keeps the ACL and ownership
assets distinct but executes both inside one privileged finalization
transaction. Where this document refers to the ownership-finalization
transaction, that later refinement governs the shared transaction; every
ownership asset restriction below remains unchanged.

## 1. Owner decision and scope

The Owner security decision preserves the merged B1 zero-membership invariant
and selects the smallest local privileged boundary:

1. B4-P1 uses the validated local privileged actor only for clean creation and
   validation of four inert roles;
2. B4 runs every operation except the exact privileged finalization in the
   ordinary repository `postgres` migration context; and
3. B4 ends with one privileged transaction containing the separately exact B4-P2
   ACL asset and ownership-transfer-only asset, followed by final validation.

The rejected design that ran arbitrary B4 SQL in a `supabase_admin`-authenticated
session after `SET ROLE postgres` is removed. Temporary membership, temporary
schema `CREATE`, role handoff, and arbitrary privileged migration execution are
prohibited.

The selected roles remain exactly:

1. `mujahiz_claim_human_command_owner`;
2. `mujahiz_claim_expiry_command_owner`;
3. `mujahiz_claim_target_conflict_helper_owner`; and
4. `mujahiz_claim_reviewer_prior_context_helper_owner`.

This document does not implement a provisioner, role, migration, ownership
transfer, grant, policy, function-body change, pgTAP test, data operation,
hosted action, or deployment.

## 2. Binding authority and temporal invariants

The merged [Claim v1 local RLS and command-ownership readiness
contract](70_CLAIM_RLS_AND_COMMAND_OWNERSHIP_READINESS.md) remains authoritative
for B4 ownership, grants, policies, target-conflict projection hardening,
callable surfaces, and validation. This prerequisite narrows only clean local
role creation and B1's exact ownership-finalization mechanism.

Each role must always be `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`, with `rolpassword IS NULL`.

### 2.1 Clean pre-B4 state

After B4-P1 and before B4, all four roles must have:

- zero `pg_auth_members` rows in either the granted-role or member direction;
- no `SET ROLE` path from `postgres`, runtime, worker, projection, browser/API,
  generic `service_role`, migration operator, human, or other ordinary role;
- zero schema `CREATE`, default-ACL grant, grant option, protected-object
  privilege, protected routine ownership, and application-facing surface; and
- no table, sequence, view, routine, schema, database, extension, or other
  database-object ownership.

### 2.2 Successful post-B4 state

After the ordinary B4 phase, exact privileged ownership finalization, and final
validation all succeed, the roles must have exactly the B1-authorized:

- routine ownership;
- table, column, sequence, schema-`USAGE`, and routine privileges;
- Claim technical-policy targeting; and
- internal callable relationships.

They may have no additional ownership, privilege, policy target, or callable
surface.

### 2.3 Invariants that remain zero before and after B4

Both before and after B4 the four roles retain zero:

- credentials or login;
- unauthorized membership or ordinary role-assumption path;
- schema `CREATE`;
- default-ACL grant or grant option;
- unauthorized ownership or protected privilege; and
- unrelated application, runtime, worker, projection, API, migration-operator,
  or human callable surface.

B4's exact authorized ownership and privilege allowlist is required post-B4 and
must not be misclassified as residue.

## 3. Reproduced local PostgreSQL/Supabase behavior

The investigation and independent review used disposable local containers and
synthetic probe objects only. They used the repository-pinned image
`supabase/postgres:17.6.1.064`, image digest
`sha256:4c6d67181e482549bab276e8ae933f807be59ea1c371c225d85c189b0c14b9de`,
and PostgreSQL `17.6`. Every probe container was removed.

The image exposes these relevant local actors after initialization:

| Actor | Observed local attributes | Role in this contract |
|---|---|---|
| `postgres` | login, non-superuser, `CREATEROLE` | ordinary repository migration actor |
| `supabase_admin` | login, superuser | disposable-image bootstrap actor; exact local privileged operations only |

The reproduced results were:

| Probe | Result |
|---|---|
| `postgres` creates one restricted `NOLOGIN` role | Attributes and null password are correct, but PostgreSQL adds one membership: role = probe, member = `postgres`, grantor = `supabase_admin`, `ADMIN=true`, `INHERIT=false`, `SET=false`. |
| `postgres` attempts to remove that row | It cannot remove the `supabase_admin`-granted row; the membership remains. |
| `supabase_admin` creates the same restricted role | Exact restricted attributes, null password, zero memberships, and no `postgres` `SET ROLE` path. |
| Privileged create-if-absent repeats | The role remains single, unchanged, and membership-free. |
| `postgres` attempts to transfer its probe function to the clean role | Fails with `must be able to SET ROLE` to the clean role. |
| `supabase_admin` performs only that ownership transfer | Succeeds with zero membership and without schema `CREATE`. |
| Privileged session uses `SET ROLE postgres` before arbitrary SQL | Rejected: `RESET ROLE` restores `supabase_admin`; an early `COMMIT` can persist temporary membership and schema `CREATE`. |

Clean role creation, the exact B4-P2 helper ACL reconciliation, and exact routine
ownership transfer therefore require the validated privileged actor in the
current local image. Every other B1 grant, revocation, policy, projection
hardening, assertion, and test remains ordinary B4 work.

## 4. Selected architecture and privilege boundary

The Owner-selected architecture has three independent PostgreSQL transactions
and a final acceptance gate. B4-P2 refines only the contents of the third
transaction; it does not create cross-session atomicity:

1. **B4-P1 role-provisioning transaction:** privileged, role-only, atomic;
2. **ordinary B4 transaction:** authenticated and executed directly as ordinary
   `postgres`, with no privileged session behind it;
3. **privileged finalization transaction:** privileged, one exact ACL asset plus
   one separately exact transfer-only ownership asset, atomic; and
4. **final validation:** accept the disposable database only when the complete
   post-B4 allowlist passes.

Only role creation, the exact B4-P2 helper ACL reconciliation, and the exact
routine ownership transfers cross the local privileged boundary. B4-P2 proves
that no materially different unresolved safe architecture remains.

B4-P1 and the later B4 runner integration may extend only the established local
disposable harness. They must introduce no runtime/application entrypoint,
persistent privileged helper, generic privileged SQL executor, hosted
credential, or reusable arbitrary-file parameter.

The current validator replays migrations sequentially in one disposable
cluster and creates test databases sequentially. B4 integration must preserve
that model: provision cluster-scoped roles once, apply ordinary migrations per
database, run exact ownership finalization immediately after the B4 migration
in every database that reaches B4, and never run tests or later migrations in a
database whose finalization or final validation failed.

## 5. B4-P1 clean role provisioning

B4-P1 may add one repository-owned, non-migration local-bootstrap asset for the
four fixed role definitions and one reusable disposable-runner hook. It must not
place role creation in `supabase/migrations` or seed data.

The runner must:

1. wait for pinned-image initialization;
2. authenticate a container-local `supabase_admin` session using only the
   existing disposable bootstrap credential and never log it;
3. begin one provisioning transaction;
4. validate all four role names before creating anything, failing closed on any
   unsafe existing role, unexpected similarly prefixed role, membership,
   ownership, ACL, policy target, persistent setting, or identity;
5. create only missing expected roles with the exact section 2 attributes;
6. run the complete pre-B4 catalog allowlist in the same transaction; and
7. commit only when all four roles are exact and inert.

Any error, assertion failure, cancellation, or connection termination rolls back
all role creations in that attempt. The runner must not repair, alter, drop, or
partially normalize an unsafe existing role. Re-execution in the same cluster is
a validated no-op.

B4-P1 must not create or exercise temporary `SET`, `ADMIN`, or `INHERIT`
membership; grant or revoke schema `CREATE`; transfer a routine; add a Claim
privilege or policy; alter a function body; grant application `EXECUTE`; or add
identity, access, security, Claim, ownership, audit, idempotency, event, or other
data.

## 6. Ordinary B4 phase

B4's normal migration must run in a separate connection authenticated directly
as the established non-superuser `postgres` migration actor. It must not run in
a `supabase_admin`-authenticated session, under `SET ROLE`, or through the
privileged ownership-finalization runner.

Subject to merged B1, the ordinary B4 transaction remains responsible for:

- the target-conflict helper's exact 19-column projection hardening;
- all exact grants and revocations ordinary `postgres` is authorized to perform;
- the seven exact owner-targeted Claim RLS policies;
- every non-ownership catalog/security assertion;
- focused pgTAP and affected helper, projection, command, and concurrency
  validation; and
- the required complete local SQL validation.

The ordinary migration must be atomic on its own: migration errors and assertion
failures roll back that transaction. It contains no privileged ownership
transfer and cannot assume an owner role. Successful ordinary B4 does not by
itself make the database acceptable; ownership finalization and the final
post-B4 allowlist must also succeed.

## 7. Exact privileged ownership finalization

B4-P2 adds no GRANT or REVOKE to this ownership asset. Its separately fixed ACL
asset executes first in the same runner-owned transaction; then this exact
ownership asset executes; then one combined post-finalization allowlist must
pass before commit.

B4 may add one separate non-migration ownership-finalization asset. The
privileged runner must accept no caller-supplied SQL path and execute only the
fixed repository path declared by the B4 implementation.

The B4 implementation must commit an exact ownership manifest with one tuple for
each transfer:

- fully qualified routine signature using identity argument types;
- verified pre-transfer owner;
- exact B1-selected new owner; and
- expected `SECURITY DEFINER` state.

The manifest and asset must be one-to-one: no missing, duplicate, or extra
statement is allowed. The manifest must enumerate every current
`supplier_claim` definer in the five human command families, every Expire
Phase-A/Phase-B and expiry-only definer, the exact target-conflict helper, and
the exact Reviewer-prior-context helper, while excluding the projection-owned
and `SECURITY INVOKER` routines that B1 leaves unchanged.

The runner must contain the expected canonical SHA-256 of the exact asset as a
literal reviewed with the same Git head. It must hash the mounted read-only file
before connecting or executing and fail on mismatch. The fixed path, exact
manifest, digest, and B4 head bind the reviewed bytes without a secret; the hash
prevents runtime file substitution but does not replace statement-inventory
validation or independent review.

The asset may contain only the enumerated, signature-qualified `ALTER FUNCTION
... OWNER TO ...` statements. It must contain no:

- arbitrary B4 SQL, role creation, dynamic SQL, or generic privileged mechanism;
- RLS policy, table/column/sequence/schema/routine grant or revoke;
- function-body or application-`EXECUTE` change;
- membership grant/revoke or schema `CREATE` grant/revoke;
- `SET ROLE`, `RESET ROLE`, `SET SESSION AUTHORIZATION`, or `RESET SESSION
  AUTHORIZATION`;
- transaction-control statement; or
- psql meta-command.

The runner, not either asset, begins one transaction, validates the exact clean
roles and both assets/manifests, executes the B4-P2 ACL asset and then this fixed
ownership asset directly as `supabase_admin`, validates the exact helper ACLs,
resulting owners, and zero prohibited residue, and commits. A wrong/missing
role, unexpected owner or ACL, substituted statement/file, error, assertion
failure, cancellation, or connection termination rolls back every ACL change
and transfer in that transaction.

The runner must never execute the ordinary B4 migration or any arbitrary file as
`supabase_admin`.

## 8. Multi-phase failure and rollback model

The three transactions are independently atomic; there is no invented
cross-session atomicity.

- **B4-P1 failure:** the provisioning transaction rolls back. Injected failures
  before creation, after each partial-creation point, on unsafe pre-existing and
  mixed missing/unsafe roles, and on connection termination must leave the
  pre-attempt catalog unchanged.
- **Ordinary B4 failure:** a migration error or assertion failure rolls back the
  ordinary transaction. Ownership finalization must not start.
- **Privileged-finalization failure:** a failure before or after any B4-P2 ACL
  statement, between the two assets, before or midway through ownership
  transfer, on a final assertion, on connection termination, on wrong/missing
  role, owner, or ACL, or on substituted/unapproved content rolls back the
  entire ACL-plus-ownership finalization transaction.
- **Incomplete workflow:** if ordinary B4 committed but finalization or final
  validation failed, the disposable cluster is incomplete, must run no tests or
  later migrations, must not be accepted as B4-valid, and must be destroyed and
  replayed cleanly. Out-of-transaction repair is not an acceptance path.

No temporary membership or schema `CREATE` residue is introduced by the
workflow because neither capability is ever used. Failure validation must prove
absence rather than rely on cleanup.

Merged B1 requires the exact final catalog and transaction-safe individual
changes; it does not authorize weakening the final state or claiming a
cross-session transaction. This local disposable fail-closed model does not
select or prove a hosted rollout model.

## 9. Complete catalog allowlists

Validation must use exact role OIDs and direct catalog evidence, not only
information-schema views or effective privilege helpers.

At minimum inspect:

- `pg_roles` plus privileged boolean/null checks from `pg_authid` without
  printing password values;
- cluster-wide `pg_auth_members`, `pg_shdepend`, `pg_db_role_setting`, and
  PostgreSQL 17 `pg_parameter_acl`;
- `pg_default_acl` in every relevant database;
- database ownership and ACLs;
- schema ownership and ACLs;
- relation, view, materialized-view, and sequence ownership and ACLs, including
  column ACLs;
- routine ownership, definer mode, configuration, and ACLs;
- policy role targets and their `pg_shdepend` policy dependencies; and
- owner, ACL, initial-ACL, and policy dependency residue represented by
  `pg_shdepend`.

`pg_parameter_acl` is available in the pinned PostgreSQL 17 image and must prove
that no target role is a grantee. `pg_db_role_setting` must contain no row for a
target role.

### 9.1 Pre-B4 allowlist

The four inert roles may have only the verified role definitions. The expected
`pg_shdepend` allowlist is empty unless implementation-time evidence proves an
unavoidable pinned-image role-definition dependency; any such dependency must be
enumerated by catalog class, object, database, and dependency type in the B4-P1
contract/evidence before acceptance. Ownership, ACL, initial-ACL, policy, role
setting, parameter ACL, default ACL, and membership dependencies are forbidden.

### 9.2 Post-B4 allowlist

After finalization, `pg_shdepend` and database-local catalogs must contain
exactly the B1-authorized routine-owner, ACL, and Claim-policy dependencies for
the four roles and nothing else. The final validator must compare normalized
actual tuples against an exact committed expected set; count-only or
zero-dependency assertions are insufficient.

The post-B4 allowlist must also prove zero unauthorized database/schema/relation/
sequence/routine ownership or ACL, zero schema `CREATE`, zero default ACL and
grant option, zero membership/role setting/parameter ACL, exact routine owners,
exact policy targets, and no unintended application-facing execute surface.

## 10. Deterministic validation requirements

B4-P1 focused validation must prove:

1. exactly the four role names and attributes;
2. atomic clean creation and an unchanged catalog after every injected failure;
3. zero memberships and failed `SET ROLE` from `postgres`, runtime, worker,
   projection, `anon`, `authenticated`, `service_role`, and an unlisted probe;
4. the complete section 9.1 pre-B4 allowlist;
5. same-cluster idempotent replay;
6. two deterministic clean disposable reset/replays; and
7. unsafe, unexpected-membership, and mixed missing/unsafe cases fail without
   alteration or partial repair.

B4 validation must prove:

1. ordinary B4 runs in a direct `postgres` session and rolls back on migration
   error or assertion failure;
2. both exact finalization asset paths, manifests, SHA-256 values, statement
   inventories, and type-specific prohibited-content checks;
3. every ACL, between-assets, ownership, and final-assertion injected-failure
   case selected by B4-P2 and section 8;
4. the exact section 9.2 post-B4 allowlist;
5. no temporary membership or schema `CREATE` exists at any phase because none
   is used;
6. idempotent clean disposable replay of the complete multi-phase workflow; and
7. all focused and complete-local-SQL validation still required by merged B1.

B4-P1 validation must not run B4 or transfer a Claim routine. This documentation
correction does not create any validation SQL or harness implementation.

## 11. Hosted and Production boundary

The selected `supabase_admin` operations are proven only inside the repository's
pinned disposable local image. They neither authorize nor prove that the same
role, credential, connection, bootstrap actor, provisioner, or ownership
finalization exists or is supported in hosted Supabase.

Hosted owner-role provisioning and ownership transfer remain a separate future
hosted-security gate using a Supabase-supported mechanism verified against the
exact hosted environment at that time. No local role or privilege assumption may
be copied to hosted, staging, TEST, or Production by inference.

B4-P1 and B4 must not access hosted Supabase, Firebase, Production or TEST data;
link a project; migrate, seed, backfill, repair, delete, or populate data; change
Auth, provider, gateway, worker, DNS, billing, secrets, or credentials; or
deploy.

## 12. Validation for this documentation correction and exact stop point

Correction Loop 1 requires documentation/static validation only:

- authority and relative-link validation;
- contradiction and stale-state scan across this document, B1, and Package B;
- pre-B4/post-B4 temporal-invariant consistency;
- privileged-boundary and exact ownership-inventory feasibility review;
- catalog-coverage and multi-phase failure-model review;
- hosted-boundary, sensitive-value, and executable-SQL scans;
- documentation-only diff confirmation; and
- `git diff --check`.

Historical B4-P0 stop point: PR #139 reached independent review and was manually
merged; B4-P1 later merged through PR #140. The current B4-P2 stop point is
owned by document 72. Do not implement or resume B4, create SQL/pgTAP, mark
Ready, merge, deploy, access hosted Supabase or Firebase Production, or
read/write Production/TEST data.
