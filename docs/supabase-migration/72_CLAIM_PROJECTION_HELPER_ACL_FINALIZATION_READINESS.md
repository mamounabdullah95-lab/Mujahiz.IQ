# Claim projection-helper ACL finalization readiness

Status: **B4-P2 candidate security contract; documentation-only; awaiting
independent exact-head security review; B4 remains blocked**

Date: 2026-08-17

Verified starting `origin/main`:
`b531ad3331e9e77d3e562e92b5477ca667aa804e` (merge of PR #140 / B4-P1)

Working branch: `codex/claim-projection-helper-acl-readiness`

Primary task profile: Documentation

## 1. Decision and scope

B4 has one previously undocumented privileged ACL prerequisite. The future
`mujahiz_claim_human_command_owner` must execute exactly two functions that
remain owned by `mujahiz_claim_owner_projection`:

- `claim_security.current_privileged_actor_v1()`; and
- `claim_security.privileged_actor_for_profile_v1(uuid)`.

The selected architecture is one exact privileged ACL reconciliation that
preserves both projection-helper owners. It grants those two EXECUTEs to the
human command owner without grant option and removes the two historical direct
EXECUTEs from `postgres`. There is no third required projection-owned helper.

The future privileged B4 finalizer must execute two separately fixed,
manifested, hash-bound non-migration assets in one transaction:

1. the four-statement projection-helper ACL asset selected here; then
2. the separately inventoried ownership-transfer-only asset selected by
   [B4-P0](71_CLAIM_OWNER_ROLE_PROVISIONING_READINESS.md).

The assets remain semantically separate. A failure in either asset or any final
assertion rolls back both the helper ACL reconciliation and every ownership
transfer. The ordinary `postgres` B4 migration remains a separate earlier
transaction; no cross-session atomicity is claimed.

This document does not create an ACL or ownership asset, runner, migration,
function, role, grant, revoke, policy, test, hosted capability, real row, or
deployment. It does not implement or resume B4.

## 2. Binding authority and verified starting state

The merged [B1 Claim RLS and command-ownership contract](70_CLAIM_RLS_AND_COMMAND_OWNERSHIP_READINESS.md)
and [B4-P0 privileged-provisioning contract](71_CLAIM_OWNER_ROLE_PROVISIONING_READINESS.md)
remain conjunctive authority. B4-P1 is merged by PR #140 at the verified base
and provides exactly four clean inert local owner roles through the fixed
role-only provisioner. It provides no B4 ACL, ownership transfer, policy, or
function change.

B1 requires the five human command families to move from local `postgres`
ownership to `mujahiz_claim_human_command_owner`, while the two privileged-
actor helpers stay under `mujahiz_claim_owner_projection`. B4-P0 prohibits
using membership, `SET ROLE`, temporary schema `CREATE`, or arbitrary
privileged SQL to bridge that boundary. The previously conceptual
ownership-transfer asset is explicitly transfer-only and cannot issue the
required helper grants.

Direct replay of all 29 migrations on the repository-pinned
`supabase/postgres:17.6.1.064` image (digest
`sha256:4c6d67181e482549bab276e8ae933f807be59ea1c371c225d85c189b0c14b9de`)
confirmed PostgreSQL `17.6`, the call graph and ACL tuples below. The container
had one canonical read-only repository mount, no published ports, synthetic
objects only, and was removed after the probe.

## 3. Complete five-family helper call graph

All `supplier_claim` functions in the five human command migrations were
inspected, including Phase A, fenced/private Phase B, and private canonicalizer
functions. Only these four exact SECURITY DEFINER call sites reach either
projection-owned helper:

| Human command family | Exact calling definer | Direct projection-helper call |
|---|---|---|
| Submit | `supplier_claim.submit(text,uuid,text,text,jsonb,uuid,uuid)` and its private lock helpers | None |
| Withdraw | `supplier_claim.reserve_withdraw(text,uuid,integer)`, `supplier_claim.withdraw(text,uuid,integer,uuid,uuid)`, and the private canonicalizer | None |
| Assign Reviewer | `supplier_claim.assign_reviewer(text,uuid,integer,uuid,uuid,uuid)` | `current_privileged_actor_v1()` and `privileged_actor_for_profile_v1(uuid)` |
| Reject | `supplier_claim.reject(text,uuid,integer,integer,text,text,text,text,text,uuid)` | None |
| Reject | `supplier_claim._execute_reject(text,uuid,integer,integer,text,text,text,text,text,uuid,uuid)` | `current_privileged_actor_v1()` |
| Approve | `supplier_claim.approve(text,uuid,integer,integer,text,text,text,text[],text,uuid)` | `current_privileged_actor_v1()` |
| Approve | `supplier_claim._execute_approve(text,uuid,integer,integer,text,text,text,text[],text,uuid,uuid)` | `current_privileged_actor_v1()` |

Each listed caller is currently owned by `postgres`, is SECURITY DEFINER, and
is selected by B1 for future ownership by
`mujahiz_claim_human_command_owner`. Therefore the future human owner needs
direct EXECUTE on both helpers. Submit and Withdraw add no helper requirement.

The complete claim_security token comparison also found the principal/Supplier
lock-key functions, current-principal accessor, and target-conflict helper in the
five command files. B1 does not retain any of those under a projection owner:
the accessor is non-authorizing transaction plumbing, and the target-conflict
helper has its separate B1 helper owner. The only other projection-owned
claim_security function is the Reviewer evidence projection; it is absent from
all five human command families. None is a third ACL dependency here.

The helper-to-helper edge is also exact:

`current_privileged_actor_v1()` delegates once to
`privileged_actor_for_profile_v1(uuid)`. Because the outer helper is itself
SECURITY DEFINER under `mujahiz_claim_owner_projection`, this nested edge uses
the projection owner privilege. It does not eliminate the human owner's direct
need for `privileged_actor_for_profile_v1(uuid)`, because Assign Reviewer calls
that helper directly.

## 4. Current helper ownership, mode, ACL and provenance

Both helpers are VOLATILE SECURITY DEFINER functions with the sole fixed
configuration `search_path=pg_catalog`. Both are owned by
`mujahiz_claim_owner_projection`.

Direct `pg_proc.proacl` plus `aclexplode` evidence after all current migrations
is exactly:

| Signature | Grantee | Grantor | EXECUTE | `is_grantable` |
|---|---|---|---|---|
| `claim_security.current_privileged_actor_v1()` | `mujahiz_claim_owner_projection` | `mujahiz_claim_owner_projection` | Yes | False |
| same | `mujahiz_claim_reviewer_projection` | `mujahiz_claim_owner_projection` | Yes | False |
| same | `mujahiz_claim_runtime` | `mujahiz_claim_owner_projection` | Yes | False |
| same | `postgres` | `mujahiz_claim_owner_projection` | Yes | False |
| `claim_security.privileged_actor_for_profile_v1(uuid)` | `mujahiz_claim_owner_projection` | `mujahiz_claim_owner_projection` | Yes | False |
| same | `postgres` | `mujahiz_claim_owner_projection` | Yes | False |

There is no PUBLIC ACL row. `PUBLIC`, `anon`, `authenticated`, `service_role`,
the expiry worker, and every B4 owner role are denied. The owner is always
treated as having implicit grant options even though its stored ordinary ACL
row reports `is_grantable=false`; this implicit owner authority is expected and
must not be misclassified as an explicit grant option.

Current effective `claim_security` schema state is also material:

- the owner projection, reviewer projection, Claim runtime, and `postgres` have
  USAGE;
- the future human command owner has neither USAGE nor CREATE in the clean
  pre-B4 state;
- `postgres` currently has CREATE as the schema owner; and
- the browser/API roles, expiry worker, and expiry command owner have neither
  USAGE nor CREATE.

The ordinary B4 migration must grant the human command owner only the B1-
required schema USAGE and must leave it without schema CREATE. Schema USAGE is
not part of the privileged ACL asset.

### 4.1 Historical bootstrap versus the desired final state

The two direct `postgres` EXECUTEs were migration bootstrap capabilities:

1. migration `20260811000300_reviewer_private_read_substrate.sql` transferred
   `current_privileged_actor_v1()` to the projection owner, used `SET ROLE
   mujahiz_claim_owner_projection`, granted EXECUTE back to `postgres`, then
   reset the role; and
2. migration `20260812000100_assign_reviewer_trusted_command.sql` temporarily
   granted the projection role to `postgres` with `SET TRUE`, set that role,
   granted `privileged_actor_for_profile_v1(uuid)` to `postgres`, reset, and
   revoked that temporary grant.

The final ACL catalog correctly records both grants as issued by the affected
function owner. Current PostgreSQL 17 role catalogs also contain older creator-
administration rows from the original ordinary creation of runtime/projection
roles; the projection rows have `SET=false` and are outside the four clean B1
owner roles provisioned by B4-P1. B4-P2 neither uses nor changes those historical
rows. It requires zero new membership, zero SET-enabled membership, and zero
membership involving any of the four B1 owner roles at every phase.

Historical migration bootstrap is not a reason to retain `postgres` as a final
runtime executor. Once B4 transfers every human command definer to the human
command owner, repository inspection shows no remaining `postgres`-owned Claim
call site that needs either direct helper grant.

## 5. PostgreSQL 17 semantics and local feasibility

The PostgreSQL 17 [GRANT reference](https://www.postgresql.org/docs/17/sql-grant.html)
and [privilege model](https://www.postgresql.org/docs/17/ddl-priv.html) establish:

1. EXECUTE without grant option does not let a non-owner grant EXECUTE onward;
2. an object owner is always treated as holding all grant options;
3. a superuser can grant or revoke an object privilege;
4. a superuser object-privilege GRANT or REVOKE acts as the object owner, so the
   recorded grantor is the object owner; and
5. that superuser operation needs neither membership in nor `SET ROLE` to the
   object owner.

The pinned PostgreSQL 17.6 micro-probe confirmed all five points with synthetic
roles and a synthetic function:

| Probe | Result |
|---|---|
| Non-owner has EXECUTE, `is_grantable=false`, then attempts an onward GRANT | PostgreSQL returned `GRANT` with the warning `no privileges were granted`; the target had zero ACL rows. Failure checks must inspect the catalog, not only the client exit code. |
| Object owner grants onward after its stored owner ACL row reports `is_grantable=false` | Succeeded, proving the owner's implicit grant option. |
| `supabase_admin` grants directly while `current_user=session_user=supabase_admin` | Succeeded with zero probe membership rows and no `SET ROLE`. |
| Catalog after the superuser grant | Grantor was the synthetic object owner, not `supabase_admin`. |
| Current non-superuser `postgres` attempts the real helper grant | Produced the same no-privileges warning and left the helper ACL byte-for-tuple unchanged. |

The exact privileged ACL reconciliation is therefore feasible in the pinned
local image without membership, role handoff, schema CREATE, or grant option.
This proves only the disposable local mechanism; it does not select or prove a
hosted Supabase actor or rollout path.

## 6. Architecture evaluation

| Option | Security result | Decision |
|---|---|---|
| A. Exact privileged ACL finalization; preserve projection owners | Adds only two necessary non-grantable EXECUTEs, can remove both obsolete bootstrap grants, is statically enumerable, and needs no membership or role assumption. | **Selected** |
| B. Transfer both helpers to the human command owner | Collapses projection/helper and mutation-command ownership, gives the human owner implicit grant options, requires the helper relational identity/access/security footprint to follow the new owner, and expands shared Owner/Reviewer projection dependence on a mutation owner. | Rejected |
| C. Reintroduce temporary projection-role membership and `SET ROLE` | Contradicts B4-P0, creates a role-assumption path and additional rollback residue, and repeats the historical bootstrap mechanism that the final boundary removes. | Rejected |
| D. Give `postgres` or an intermediary WITH GRANT OPTION | Creates a persistent or temporary delegation capability not required at runtime and contradicts the zero-grant-option boundary. | Rejected |
| E. Duplicate, wrap, or redefine the helpers under another owner | Duplicates security logic and source privileges, expands callable surface and drift risk, or still requires an ACL bridge to the original helper. | Rejected |

No second materially safe architecture remains under merged B1 and B4-P0.

## 7. Exact final ACL contract

The approved post-B4 ACL inventory is:

| Signature | Final non-PUBLIC EXECUTE grantees | Removed grantee |
|---|---|---|
| `claim_security.current_privileged_actor_v1()` | owner `mujahiz_claim_owner_projection`; `mujahiz_claim_runtime`; `mujahiz_claim_reviewer_projection`; `mujahiz_claim_human_command_owner` | `postgres` |
| `claim_security.privileged_actor_for_profile_v1(uuid)` | owner `mujahiz_claim_owner_projection`; `mujahiz_claim_human_command_owner` | `postgres` |

Every stored row is non-grantable. The new human-owner rows must have grantor
`mujahiz_claim_owner_projection`, as required by PostgreSQL superuser grantor
semantics. `PUBLIC`, `anon`, `authenticated`, `service_role`, the expiry worker,
the expiry command owner, the two B1 read-only helper owners, and all unlisted
roles remain denied.

Both historical `postgres` grants are revoked. Their only proven purpose was to
let the current `postgres`-owned human commands call the helpers. B4 removes
that owner/caller relationship; retaining the grants would leave an unrelated
migration actor on the application helper surface without a final call site.

### 7.1 Exact future ACL asset inventory

The future fixed path is
`supabase/local-bootstrap/claim-projection-helper-acl-finalization.sql`. It is a
non-migration asset and contains exactly these four statements in this order:

| Manifest ID | Exact approved statement |
|---|---|
| `ACL-001` | `GRANT EXECUTE ON FUNCTION claim_security.current_privileged_actor_v1() TO mujahiz_claim_human_command_owner;` |
| `ACL-002` | `GRANT EXECUTE ON FUNCTION claim_security.privileged_actor_for_profile_v1(uuid) TO mujahiz_claim_human_command_owner;` |
| `ACL-003` | `REVOKE EXECUTE ON FUNCTION claim_security.current_privileged_actor_v1() FROM postgres;` |
| `ACL-004` | `REVOKE EXECUTE ON FUNCTION claim_security.privileged_actor_for_profile_v1(uuid) FROM postgres;` |

The manifest and statement inventory are one-to-one. No statement uses WITH
GRANT OPTION. The asset contains no membership, role/session authorization,
schema, table, column, sequence, default-ACL, ownership, body, RLS, dynamic SQL,
transaction control, or psql meta-command.

## 8. Fixed assets and one privileged finalization transaction

The future runner must have no caller-supplied path, hash, database, host, user,
manifest, or SQL. Before connecting it validates both fixed assets completely:

- exact repository paths with no reparse-point or nested-mount substitution;
- exact-path LF `.gitattributes` rules;
- raw Git blob, host file, and canonical read-only mounted bytes are identical;
- one reviewed literal SHA-256 per asset;
- one fixed exact manifest per asset;
- one-to-one manifest/statement inventories; and
- prohibited-content scans specific to the ACL and ownership asset types.

Only the repository-pinned disposable image, exact digest, local Unix socket,
fixed local bootstrap actor, canonical repository mount, and no published ports
are accepted. The ownership asset remains restricted to its exact signature-
qualified `ALTER FUNCTION ... OWNER TO ...` inventory and cannot absorb an ACL
statement. The ACL asset cannot absorb an ownership transfer.

After all file/manifest checks pass, one privileged database transaction does:

1. validate every section 9 precondition before mutation;
2. execute ACL-001 through ACL-004 from the fixed ACL asset;
3. execute the complete fixed ownership-transfer asset;
4. validate every section 10 postcondition and the complete B1 post-B4
   allowlist; and
5. commit only if every assertion succeeds.

## 9. Fail-closed preconditions

Before ACL-001, the transaction must prove with direct catalogs:

1. each exact helper signature resolves once, has owner
   `mujahiz_claim_owner_projection`, is VOLATILE SECURITY DEFINER, and has only
   `search_path=pg_catalog` in `proconfig`;
2. the complete `proacl`/`aclexplode` tuples equal section 4 exactly, including
   the two non-grantable `postgres` bootstrap rows and no PUBLIC row;
3. `mujahiz_claim_human_command_owner` exists with the exact B4-P1 attributes,
   has no helper EXECUTE, has the ordinary-B4-required `claim_security` USAGE,
   and has no schema CREATE;
4. the other three B1 owner roles are exact and inert, and all four have zero
   `pg_auth_members` rows in either direction, zero role settings, zero
   parameter ACL, and no unapproved dependency;
5. expected current runtime/projection executor rows exist only where section 4
   lists them; PUBLIC, browser/API, worker, helper-owner, and unrelated roles
   remain denied;
6. no explicit grant option exists for `postgres`, the human owner, or any
   unexpected role; the projection owner's implicit owner grant option is the
   sole expected grant authority;
7. schema ACL, default ACL, `pg_shdepend`, role/policy/ownership, and ordinary
   B4 state equal their separately approved pre-finalization allowlists; and
8. both assets, hashes, manifests, statement counts, and prohibited-content
   scans are exact before any database mutation.

Any mismatch aborts before ACL-001. The runner does not repair or normalize an
unexpected database or file state.

## 10. Exact postconditions

Before commit, direct `pg_proc`, `proacl`, `aclexplode`, `pg_namespace`,
`pg_auth_members`, `pg_default_acl`, and `pg_shdepend` evidence must prove:

- both helper owners, SECURITY DEFINER modes, volatility, fixed search paths,
  signatures, and bodies are unchanged;
- the final ACL tuple inventory equals section 7 exactly;
- the human owner has EXECUTE on both helpers, each row is non-grantable, and
  each grantor is `mujahiz_claim_owner_projection`;
- `postgres` has no direct or effective helper EXECUTE under the approved role-
  membership prestate;
- PUBLIC, `anon`, `authenticated`, `service_role`, the expiry worker, unrelated
  callers/owners, and unlisted roles remain denied;
- the human owner has `claim_security` USAGE and no CREATE; no B1 owner role has
  schema CREATE, a default ACL, parameter ACL, role setting, or grant option;
- the four B1 owner roles retain zero membership in either direction, and the
  transaction added or altered no projection/runtime membership row;
- `pg_shdepend` contains only the exact approved owner, ACL, and policy
  dependencies from B1 plus the two new human-owner helper ACL dependencies,
  with both obsolete `postgres` helper ACL dependencies absent; and
- the separate ownership manifest and complete B1 post-B4 catalog allowlist are
  exact, with no Claim SECURITY DEFINER left under `postgres`.

Count-only and `information_schema`-only checks are insufficient.

## 11. Failure and rollback model

The future B4 implementation must inject and verify failure for:

- wrong/missing/duplicate helper signature, wrong helper owner, wrong definer
  mode, wrong search path, unexpected ACL, and unexpected grant option;
- missing/unsafe human owner or wrong ordinary-B4 schema USAGE state;
- substituted ACL manifest, missing/duplicate/extra manifest entry, substituted
  ACL asset, wrong literal or mounted hash, and prohibited statement content;
- immediately after ACL-001, ACL-002, ACL-003, and ACL-004;
- between the ACL and ownership assets;
- every ownership-transfer failure point required by B4-P0;
- ownership-asset failure after all four ACL changes;
- complete final-allowlist assertion failure;
- cancellation; and
- connection termination.

Every such failure in the privileged transaction must restore the exact
pre-attempt helper ACL and routine ownership, with zero new membership, SET
path, schema CREATE, grant option, default ACL, or other residue. Successful
re-execution after a clean replay must be deterministic. Repair-in-place is not
an acceptance path.

The earlier ordinary B4 transaction remains independently atomic. If it commits
but privileged finalization fails, that disposable database is incomplete,
runs no tests or later migrations, and is destroyed and replayed cleanly.

## 12. Validation, exclusions and stop point

B4-P2 requires documentation/static validation only:

- authority and relative-link checks;
- exact helper signature, call-site, owner, ACL/grantor, and final-matrix checks;
- PostgreSQL 17 documentation and pinned-image feasibility evidence;
- contradiction scan against B1, B4-P0, and merged B4-P1;
- fixed-asset, manifest, hash, prohibited-capability, and failure-model review;
- sensitive-value and documentation-only diff scans; and
- `git diff --check`.

Do not run the complete SQL validator or any Firebase suite for this document.
The bounded catalog and semantic probes above used only disposable local
PostgreSQL and synthetic objects and were cleaned up.

The seven Open gates remain exactly `ORG-001`, `ORG-002`, `MSG-002`,
`FILE-001`, `BILL-001`, `RES-001`, and `MIG-002`. Firebase remains live
Production authority; hosted Supabase remains unlinked, undeployed, and
non-authoritative. No Production/TEST data, hosted system, Firebase, Auth,
configuration, DNS, billing, migration, seed, backfill, role/grant, deployment,
or runtime state is read or changed by this task.

Exact stop point: one Draft documentation/security PR at
`AWAITING_INDEPENDENT_REVIEW`. Do not implement B4, create either fixed asset or
the finalizer, mark Ready, merge, deploy, access hosted Supabase or Firebase
Production, or read/write Production/TEST data.
