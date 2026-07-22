# TargetLock Railway Deployment

Deploy the TargetLock Runbook V1 field pilot from GitHub to Railway.

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
| Healthcheck Path | `/api/health` |
| Healthcheck Timeout | `300` seconds |
| Restart Policy | `ON_FAILURE` (max 10 retries) |
| Watch Paths | `/packages/main/**` |
| Volumes | none |
| Databases | none |

## Optional pilot access variables

Server-only. Never use `NEXT_PUBLIC_` for these values.

| Variable | Required | Notes |
|----------|----------|-------|
| `PILOT_ACCESS_ENABLED` | optional | Set to `true` to enable the gate |
| `PILOT_ACCESS_USERNAME` | required when enabled | Set in Railway Variables |
| `PILOT_ACCESS_PASSWORD` | required when enabled | Set in Railway Variables |

When the gate is enabled, browsers receive an HTTP Basic Auth challenge.
`/api/health` remains public. This is a deployment access gate, not full
authentication.

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
/api/health
```

12. Confirm **Watch Paths**:

```text
/packages/main/**
```

13. Under **Variables**, optionally add:

```text
PILOT_ACCESS_ENABLED=true
PILOT_ACCESS_USERNAME=<set-in-railway>
PILOT_ACCESS_PASSWORD=<set-in-railway>
```

14. Deploy.
15. Open **Settings → Networking**.
16. Generate a public Railway domain.
17. Test:

```text
https://<railway-domain>/api/health
https://<railway-domain>/
https://<railway-domain>/holes/DDH041/current
```

18. Confirm GitHub automatic deployments are enabled for `main`.

## Storage limitation (unchanged by Railway)

Railway hosts the TargetLock application code only.

Operational records, photographs and generated reports remain in each device’s
browser (localStorage / IndexedDB). They are **not** synchronised, shared or
backed up by Railway. Records entered on one device will not appear on another.

## Local production smoke test

From `packages/main` after `npm run build`:

```powershell
$env:PORT="3456"
npm run start -- --hostname 0.0.0.0 --port $env:PORT
```

Then verify:

```text
http://localhost:3456/api/health
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
