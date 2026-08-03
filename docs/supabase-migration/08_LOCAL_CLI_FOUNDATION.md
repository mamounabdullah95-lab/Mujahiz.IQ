# Local Supabase CLI Foundation

Status: local development scaffolding only
Base commit: `b13aae18a8e7de01e3e6ac85c53c0ec49a7f8b74`
Validated: 2026-08-03 on Windows with Docker Desktop

## Foundation

- Supabase CLI: `2.111.0`, pinned exactly as the root npm development dependency `supabase`.
- Installation method: `npm install --save-dev --save-exact supabase@2.111.0`.
- Runtime requirement: the npm/npx distribution requires Node.js 20 or later. The repository PR gate uses Node.js 22. Local validation used Node.js `v24.14.0` and npm `11.19.0`.
- Container prerequisite: Docker Desktop or another healthy Docker-compatible runtime. Local validation used Docker `29.6.2`.
- Local project identifier: `mujahiz-iq-local`.
- Official reference: <https://supabase.com/docs/guides/local-development/cli/getting-started>.

The CLI is a project dependency, not a global installation. npm scripts resolve the executable from `node_modules/.bin`.

## Setup and commands

From the repository root:

```powershell
npm ci
npx supabase init
npm run supabase:version
npm run supabase:start
npm run supabase:status
npm run supabase:stop
```

`supabase init` has already been run. Do not run it with `--force` over reviewed configuration. `supabase:start` keeps the normal health checks enabled. The stop script performs a normal project-scoped stop; it does not use `--no-backup` or `--all`.

## Tracked and ignored structure

```text
supabase/
|-- .gitignore       # ignores .branches, .temp, and local dotenv overrides
`-- config.toml      # reproducible local project and service configuration
```

The CLI creates runtime state and generated local credentials under `supabase/.temp/`; that directory is ignored. Local dotenv keys and overrides under `supabase/` are also ignored. No migration, schema, seed, Edge Function, bucket definition, or application data file exists in this foundation. Future migrations and schema files remain trackable because neither the root nor Supabase ignore file excludes them.

## Ports and conflict review

The generated Supabase ports were compared with Firebase Auth `9099`, Firestore `8080`, Firebase Functions `5001`, Vite's default `5173`, and the repository static preview `4180`. No configured port conflicted, and no listener was present on the Supabase, Firebase Emulator, Vite, or preview ports before startup. Firebase ports were not changed.

| Port | Local purpose | State in this foundation |
|---:|---|---|
| `54320` | Shadow database for diff operations | Reserved; not running during validation |
| `54321` | API gateway: REST, GraphQL, Auth, Storage, Realtime | Enabled |
| `54322` | PostgreSQL | Enabled |
| `54323` | Studio | Enabled |
| `54324` | Inbucket email UI | Enabled |
| `54327` | Analytics | Disabled on Windows; see below |
| `54329` | Connection pooler | Disabled |
| `8083` | Edge Runtime inspector | Configured; no host listener was observed |

Safe URLs observed during validation were:

- API: `http://127.0.0.1:54321`
- GraphQL: `http://127.0.0.1:54321/graphql/v1`
- Studio: `http://127.0.0.1:54323`
- Inbucket: `http://127.0.0.1:54324`

Do not record the database URL, generated passwords, JWT secrets, publishable/secret keys, or connection strings.

## Windows compatibility and binding finding

Supabase local Analytics/Vector expects access to Docker logs. On this Windows host, Vector restarted because `tcp://localhost:2375` was not exposed. Docker was not reconfigured because exposing its daemon is a host-level security change. `[analytics].enabled` is therefore `false`; the core local stack does not require it.

CLI `2.111.0` reports loopback URLs, but its generated Docker port publications bind enabled host ports to `0.0.0.0` and `::`. The CLI exposes no `supabase start` flag or project `config.toml` option to override the host bind address. Consequently, Studio and the other published services could not be proven reachable only from the local machine.

Keep the stack stopped when it is not in use. Before starting it on an untrusted or shared network, a machine administrator must enforce host firewall/network policy that blocks inbound access to `54321` through `54324`. Do not configure router forwarding, tunnels, external ingress, or public exposure for this stack.

## Validation result

With Analytics disabled, `npm run supabase:start` completed with its normal health checks and `npm run supabase:status` exited successfully. The following local services were running: PostgreSQL, Auth, API gateway, REST, Realtime, Storage, Studio, Inbucket, Postgres Meta, and Edge Runtime. Studio returned HTTP `200` at the loopback URL. The stack was then stopped normally with `npm run supabase:stop`.

The generated configuration retained the default seed path, but `supabase/seed.sql` does not exist. Startup explicitly skipped it, and no seed data was loaded.

## Security and scope boundaries

This stack is disposable and development-only. It uses generated local/default credentials, has no Production hardening, and must not be exposed publicly. Generated credentials must never be copied into documentation, commits, PR descriptions, logs checked into GitHub, or test snapshots.

- No hosted Supabase project was linked, authenticated, queried, or changed.
- No hosted project reference, remote URL, or hosted credential is present.
- No Mujahiz application schema exists yet.
- No application table, RLS policy, Storage bucket, Edge Function, or frontend integration was created.
- Firebase Production and all repository Firebase configuration were untouched.
- CI was not changed and does not start Supabase or Docker in this phase.
- Deployment scope is none.

The recommended next phase is PostgreSQL schema design and review only. Schema implementation, hosted linking, and deployment require separate approval.
