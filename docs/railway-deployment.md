# TargetLock Railway Deployment

Deploy the TargetLock Stage 7C authoritative-core pilot from GitHub to
Railway. See `docs/controlled-pilot-runbook.md` for bootstrap and field checks.

## Isolation result

`packages/main` is an **isolated** application package:

- No root `package.json` or npm/pnpm/yarn workspace
- Own `package.json` and `package-lock.json`
- No imports from sibling packages under `packages/*`
- Install/build/start succeed from `packages/main` alone

Therefore Railway **Root Directory** must be `/packages/main`.

## Exact Railway settings

| Setting | Value |
|---------|-------|
| Repository | `vermilion1992/targetlock-runbook` |
| Branch | `main` |
| Root Directory | `/packages/main` |
| Config File Path | `/packages/main/railway.json` |
| Builder | Railpack (`RAILPACK`) |
| Install | `npm ci` (Railpack default when lockfile present) |
| Build Command | `npm run build` |
| Start Command | `npm run start -- --hostname 0.0.0.0 --port $PORT` |
| Healthcheck Path | `/api/readiness` |
| Healthcheck Timeout | `300` seconds |
| Restart Policy | `ON_FAILURE` (max 10 retries) |
| Watch Paths | `/packages/main/**` |
| Volumes | none |
| Databases | Railway PostgreSQL required for secure pilot mode |

## Secure pilot variables

Server-only. Never use `NEXT_PUBLIC_` for these values.

| Variable | Required | Notes |
|----------|----------|-------|
| `TARGETLOCK_MODE` | yes | Set to `pilot` |
| `DATABASE_URL` | yes | Railway PostgreSQL reference |
| `PILOT_SESSION_SECRET` | yes | Random value, at least 32 characters |
| `APP_ORIGIN` | yes | Exact generated HTTPS origin |
| `PILOT_SESSION_TTL_SECONDS` | optional | Defaults to eight hours |
| `DATABASE_SSL` | optional | Unset/`disable` on Railway private networking; `require` encrypts an external endpoint without CA identity verification; prefer `verify-ca` when a CA is available |
| `DATABASE_CA_CERT` | for `verify-ca` | PEM CA certificate; server-only |

Production fails closed when the runtime mode or secure pilot variables are
missing. `/api/health` is public liveness; `/api/readiness` checks safe
configuration, database state and exact expected migration. The legacy
`PILOT_ACCESS_*` Basic gate is only
for demo previews and is ignored in secure pilot mode.

Other optional variables (not required for TargetLock pilot):

| Variable | Client-safe? | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_BASE_URL` | yes | Optional display/base URL |
| `GEMINI_API_KEY` | no | Inherited demo AI routes only |
| `NEXT_PUBLIC_GEMINI_API_KEY` | yes (legacy) | Inherited demo code; avoid for new secrets |
| `PORT` | n/a | Injected by Railway |

See `packages/main/.env.example` for names only.

## Dashboard workflow

1. Open [Railway](https://railway.app).
2. Create a new Project.
3. Select **Deploy from GitHub repo**.
4. Select:

```text
vermilion1992/targetlock-runbook
```

5. Select the `main` branch.
6. Open the service → **Settings** → **Source**.
7. Set **Root Directory** to:

```text
/packages/main
```

8. Set the Railway config-file path to:

```text
/packages/main/railway.json
```

9. Confirm **Build Command**:

```text
npm run build
```

10. Confirm **Start Command**:

```text
npm run start -- --hostname 0.0.0.0 --port $PORT
```

11. Confirm **Healthcheck Path**:

```text
/api/readiness
```

12. Confirm **Watch Paths**:

```text
/packages/main/**
```

13. Generate the application HTTPS domain, add a Railway PostgreSQL service,
    and set:

```text
TARGETLOCK_MODE=pilot
DATABASE_URL=<railway-postgres-reference>
PILOT_SESSION_SECRET=<random-server-secret>
APP_ORIGIN=https://<railway-domain>
```

14. Stop/hold application rollout, then run `npm run pilot:migrate` exactly once
    as a controlled release command. The migrator takes a Postgres advisory
    lock, but migrations are intentionally not part of every replica's start
    command. Stage 7C readiness requires
    `0004_stage_7c_core_materialisation.sql`; do not deploy the Stage 7C
    application before that forward-only migration succeeds.
15. Run `npm run pilot:migrate:check`; deployment readiness remains `503` until
    the expected migration is present.
16. Run the one-time `npm run pilot:bootstrap` workflow from the controlled
    pilot runbook and remove all bootstrap variables.
17. Deploy.
18. Test:

```text
https://<railway-domain>/api/health
https://<railway-domain>/api/readiness
https://<railway-domain>/
https://<railway-domain>/holes/DDH041/current
```

19. Confirm GitHub automatic deployments are enabled only after the migration
    step is part of the release checklist.

## Storage limitation

Railway PostgreSQL stores organisations, accounts, sessions, registered
devices, work leases, validated JSON operation journal rows, journal revision
registries, authoritative core project/hole/BHA/shift/run/rod/handover
projections, durable change cursors and audit events. Operational records still
commit to browser localStorage/IndexedDB first; accepted core operations are
then applied transactionally to Postgres. Peripheral journal rows are not yet
materialised. Photograph and generated-report blobs remain local. The in-app
backup contains metadata/outbox rows, server aggregate IDs/revisions/cursor and
a media manifest, not recoverable blobs.

Railway service-to-Postgres private networking normally does not require TLS;
leave `DATABASE_SSL` unset or set `disable` there. For external endpoints,
`require` provides encryption but sets `rejectUnauthorized: false`. Prefer
`verify-ca` plus the Railway/provider CA PEM in `DATABASE_CA_CERT` when
certificate verification is available.

Stage 7C rate-limit buckets remain process-local. Keep exactly one application
replica. Horizontal scaling requires a shared Postgres/Redis limiter first.

## Local production smoke test

From `packages/main` after `npm run build`:

```powershell
$env:TARGETLOCK_MODE="demo"
$env:ALLOW_LOCAL_DEMO_IN_PRODUCTION="true"
$env:PORT="3456"
npm run start -- --hostname 0.0.0.0 --port $env:PORT
```

Then verify:

```text
http://localhost:3456/api/health
http://localhost:3456/api/readiness
http://localhost:3456/
http://localhost:3456/holes/DDH041/current
```

Stop the server when finished.

## CLI note

If the Railway CLI is installed but not authenticated, run:

```text
railway login
```

Then link/deploy only with the correct project identifiers. Do not guess
account, workspace, project or service IDs.

## Post-deploy tag (optional)

Only after a successful live Railway verification, an optional tag may be
created:

```text
v0.1.1-railway-pilot
```

Do not move or overwrite `v0.1.0-field-pilot`.
