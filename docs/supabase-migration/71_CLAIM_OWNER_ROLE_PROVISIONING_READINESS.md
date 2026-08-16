# Claim owner-role privileged provisioning readiness

Status: **B4-P0 candidate security contract; documentation-only; awaiting
independent exact-head security review; the privileged provisioner and B4 remain
unimplemented and blocked**

Date: 2026-08-16

Verified starting `origin/main`:
`7f9d810006d12301365af747477257f5489b0009` (merge of PR #138)

Working branch: `codex/claim-owner-role-provisioning-readiness`

Primary task profile: Documentation

## 1. Decision and scope

The Owner security decision preserves the merged B1 zero-membership invariant.
The four future Claim owner roles must not retain the automatic PostgreSQL 17 /
local Supabase membership granted to an ordinary non-superuser role creator.
This contract selects the smallest reproducible local-only prerequisite that can
provision the roles cleanly before B4 and defines the later transaction-bounded
handoff that lets B4 remain an ordinary `postgres` migration.

The selected roles remain exactly:

1. `mujahiz_claim_human_command_owner`;
2. `mujahiz_claim_expiry_command_owner`;
3. `mujahiz_claim_target_conflict_helper_owner`; and
4. `mujahiz_claim_reviewer_prior_context_helper_owner`.

This document does not implement the provisioner, create a role, create or run a
migration, add pgTAP, change a grant or policy, transfer ownership, alter a
function body, populate data, access a hosted project, or deploy anything.

## 2. Binding authority and unchanged invariants

The merged [Claim v1 local RLS and command-ownership readiness
contract](70_CLAIM_RLS_AND_COMMAND_OWNERSHIP_READINESS.md) remains authoritative
for B4 ownership, grants, policies, target-conflict projection hardening, callable
surfaces, and validation. This prerequisite narrows only how the four roles and
the temporary ownership-transfer capability are established locally.

Each role must be `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`, with `rolpassword IS NULL`.
Before B4, and again at B4 commit, all four must have:

- zero `pg_auth_members` rows in either the granted-role or member direction;
- no `SET ROLE` path from `postgres`, runtime, worker, projection, browser/API,
  generic `service_role`, migration operator, or human principals;
- zero schema `CREATE`, default ACL, grant option, and protected-object
  privilege;
- no table, sequence, view, routine, schema, database, or extension ownership;
  and
- no credential, login, application-facing surface, or inherited capability.

B1's four-role separation, exact later grants, seven added technical RLS
policies, 19-column target-conflict hardening, and all command/read behavior are
unchanged.

## 3. Reproduced local PostgreSQL/Supabase behavior

The investigation used only disposable local containers and synthetic probe
objects. It used the repository-pinned image
`supabase/postgres:17.6.1.064`, image digest
`sha256:4c6d67181e482549bab276e8ae933f807be59ea1c371c225d85c189b0c14b9de`,
and PostgreSQL `17.6`. Every probe container was removed after inspection.

The image exposes these two relevant local actors after its initialization:

| Actor | Observed local attributes | Role in this contract |
|---|---|---|
| `postgres` | login, non-superuser, `CREATEROLE` | ordinary repository migration actor |
| `supabase_admin` | login, superuser | image bootstrap actor; local privileged provisioner only |

The exact reproduced results were:

| Probe | Result |
|---|---|
| `postgres` creates one restricted `NOLOGIN` role | The role attributes and null password are correct, but PostgreSQL adds one membership row: granted role = probe role, member = `postgres`, grantor = `supabase_admin`, `ADMIN=true`, `INHERIT=false`, `SET=false`. |
| `postgres` attempts to remove that automatic row | Fails with permission denied because only a role with `supabase_admin` privileges may revoke a grant made by `supabase_admin`; the row remains. |
| `supabase_admin` creates the same restricted role | The role has the exact restricted attributes, a null password, zero membership rows in either direction, and `postgres` has no `SET` path. |
| The privileged idempotent create-if-absent path is repeated | The role remains single, unchanged, and membership-free. |
| `postgres` attempts to transfer a probe function to the clean role | Fails with `must be able to SET ROLE` to the clean role. Role provisioning alone therefore cannot make an ordinary B4 ownership transfer succeed. |
| `supabase_admin` performs the transfer directly | Succeeds with zero membership, proving the local privileged actor is capable, but running all of B4 as superuser would be broader than required. |
| Privileged transaction grants only temporary `SET` membership plus schema `CREATE`, executes the transfer under `postgres`, then cleans up before commit | Succeeds. The final function owner is the clean role; membership rows are zero; `postgres` cannot `SET ROLE`; schema `CREATE` is false. |

This is the exact blocker: ordinary PostgreSQL 17 role creation is not defective,
but its managed creator-administration row contradicts B1's stricter committed
catalog invariant and the ordinary creator cannot remove the grantor-owned row.

## 4. Selected local provisioning architecture

Select a **repository-owned privileged bootstrap SQL asset executed by the
existing disposable test-harness boundary**, with a narrowly scoped privileged
transaction wrapper for the later B4 migration.

The future prerequisite implementation must add one non-migration,
local-bootstrap SQL asset dedicated to these four roles and one reusable runner
hook used by the disposable PostgreSQL harnesses. The SQL asset must not be
placed in `supabase/migrations`, because every tracked migration is currently
applied as ordinary `postgres` and repeating the failed creator path would
recreate the prohibited rows. It must not be represented as seed data.

The runner hook must:

1. wait for the pinned Supabase PostgreSQL image initialization to finish;
2. authenticate a container-local `supabase_admin` session using only the
   runner's existing disposable bootstrap credential, without logging it;
3. execute the dedicated allowlisted role-provisioning asset once before any
   ordinary migration that depends on the roles;
4. create only a missing expected role with the exact attributes in section 2;
5. fail closed, without repairing or dropping, when an expected role already has
   an unsafe attribute, password, membership, ownership, grant, or unexpected
   identity;
6. revalidate the complete clean pre-B4 catalog contract before returning; and
7. remain idempotent when invoked again in the same disposable cluster.

Roles are cluster-scoped, so one successful provisioning invocation per
disposable cluster is sufficient even when the current validator creates
multiple test databases. The current sequential database replay model must be
preserved while the later B4 handoff temporarily changes cluster-wide role
membership.

This mechanism is selected instead of materially broader alternatives:

- an ordinary migration cannot meet zero membership;
- privileged creation followed by an unwrapped ordinary B4 cannot transfer
  ownership;
- running all B4 statements as `supabase_admin` retains unnecessary superuser
  authority for grants, policies, and body hardening;
- pre-transferring functions would move B4 ownership scope into the
  prerequisite;
- a persistent privileged helper would introduce a new durable escalation
  surface; and
- a container-init convention is not an established repository mechanism and
  would not solve the later ordinary ownership-transfer boundary by itself.

No materially different equally narrow architecture remains after this
evidence, so this contract does not stop at `SECURITY_DECISION_REQUIRED`.

## 5. Separation between the prerequisite and B4

### A. Privileged role-provisioning prerequisite

The separate prerequisite implementation may add only:

- the four exact role definitions;
- fail-closed idempotency and catalog assertions for those roles;
- the local disposable-runner hook that invokes the allowlisted asset as
  `supabase_admin`; and
- the narrow B4 transaction-handoff capability described below, without a B4
  migration or any protected-object operation.

Before B4 exists or runs, the prerequisite must leave only the four inert clean
roles. It must grant no Claim or other table privilege, create no RLS policy,
transfer no routine, alter no function body, grant no application `EXECUTE`, and
create no identity, platform-role, access, security, Claim, ownership, audit,
idempotency, event, or other data row.

### B. Later normal B4 security migration

B4 remains solely responsible for:

- every selected function ownership transfer;
- all exact base, column, sequence, schema-`USAGE`, and routine grants and
  revocations;
- the seven exact owner-targeted Claim RLS policies;
- the target-conflict helper's exact 19-column projection hardening; and
- focused pgTAP, affected concurrency checks, and complete local SQL validation.

The prerequisite must not contain, duplicate, anticipate, or silently execute
those B4 statements. B4 remains blocked until the prerequisite contract and its
separate implementation are independently approved and manually merged.

## 6. Later B4 transaction handoff

Clean privileged creation intentionally leaves `postgres` unable to transfer
ownership. The later disposable runner must therefore apply B4 through one
atomic handoff controlled by the already authenticated `supabase_admin` session:

1. begin one transaction and assert the four roles still satisfy the clean
   pre-B4 contract;
2. grant each role to `postgres` with `SET=true`, `ADMIN=false`, and
   `INHERIT=false`, from `supabase_admin` only;
3. grant temporary schema `CREATE` only on `supplier_claim` to the human and
   expiry command owners, and only on `claim_security` to the two helper owners;
4. switch the effective role to ordinary `postgres` and execute the B4-owned
   migration file as B4's migration actor;
5. reset to the privileged session actor;
6. revoke every temporary schema `CREATE` and every membership using the same
   privileged grantor;
7. run the complete zero-residue catalog assertions before commit; and
8. commit only if B4 and every cleanup assertion succeeded.

Any error must roll back the ownership/grant/policy changes and every temporary
capability together. The runner must not retry cleanup outside the failed
transaction as a substitute for rollback. No temporary grant may commit between
steps, and no parallel migration/test database may observe the handoff.

This wrapper supplies only the capability that ordinary `postgres` demonstrably
lacks. B4 still supplies and owns the security migration statements. It must
order its statements so that its ordinary actor remains authorized without
expanding the wrapper or retaining schema `CREATE`.

## 7. Deterministic prerequisite validation contract

The later prerequisite implementation is acceptable only when focused local
validation proves, on the same exact head:

1. exactly the four expected role names exist and no similarly prefixed extra
   owner role was created;
2. every role has the exact attributes in section 2 and `rolpassword IS NULL`;
3. `pg_auth_members` has zero rows where any role is either `roleid` or `member`;
4. direct `SET ROLE` fails from `postgres`, `mujahiz_claim_runtime`,
   `mujahiz_claim_expiry_worker`, both projection roles, `anon`,
   `authenticated`, generic `service_role`, and an unlisted restricted probe;
5. all four have zero schema `CREATE` and zero grant option;
6. `pg_default_acl` grants none of the four any privilege for any object type or
   schema;
7. before B4, all four have zero privilege on protected relations, sequences,
   schemas, and routines, and own no database object of any supported ownership
   class;
8. none has a login, credential, role-administration path, or application-facing
   callable surface;
9. invoking the provisioner twice in one disposable cluster is a no-op after the
   first success and preserves the exact catalog result;
10. two clean disposable reset/replay runs produce the same exact role and
    zero-membership result with no retained container or host artifact;
11. a synthetic unsafe pre-existing role and a synthetic unexpected membership
    both fail closed without alteration or partial repair; and
12. a focused handoff probe proves ordinary ownership transfer fails before the
    wrapper, succeeds inside it, and finishes with zero membership, no `SET ROLE`,
    and no schema `CREATE` after commit.

The prerequisite validation is focused and local. It must not run B4, transfer a
Claim routine, add a Claim policy, or use the full SQL validator as a substitute
for the role-only assertions. B4's later merged contract still requires the full
validator for the actual security migration.

## 8. Hosted and Production boundary

The selected `supabase_admin` path is proven only inside the repository's pinned
disposable local image. It neither authorizes nor proves that the same role,
credential, connection, bootstrap actor, or transaction wrapper exists or is
supported in hosted Supabase.

Hosted owner-role provisioning remains a separate future hosted-security gate.
It must use a Supabase-supported mechanism verified against the exact hosted
environment at that time. No local role or privilege assumption may be copied to
hosted, staging, TEST, or Production by inference.

The prerequisite and B4 must not access hosted Supabase, Firebase, Production or
TEST data; link a project; migrate, seed, backfill, repair, delete, or populate
data; change Auth, provider, gateway, worker, DNS, billing, or credentials; or
deploy.

## 9. Validation for this documentation task and exact stop point

This contract requires documentation/static validation only:

- relative authority/link validation;
- contradiction and stale-state scan across this document, B1, and the Package B
  queue;
- exact role, attribute, membership, temporary-capability, and A/B separation
  review against the reproduced evidence;
- sensitive-value and executable-SQL scan;
- documentation-only diff confirmation; and
- `git diff --check`.

Exact stop point: one Draft documentation/security-contract PR at
`AWAITING_INDEPENDENT_REVIEW`. The independent Reviewer must inspect the exact
head and the reproduced local evidence, including the privileged actor boundary,
grantor-specific revocation, transaction rollback, cluster-wide membership,
schema-`CREATE` cleanup, idempotency, and hosted separation. Do not implement the
provisioner, resume B4, create SQL/pgTAP, mark Ready, merge, deploy, access hosted
Supabase or Firebase Production, or read/write Production/TEST data.
