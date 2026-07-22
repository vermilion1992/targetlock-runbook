# TargetLock Local Installation

Local pilot installation for the TargetLock Runbook V1 app in `packages/main`.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Chrome or Edge recommended for field tablets
- Enough free disk for `node_modules` and browser storage

## Install

```text
cd packages/main
npm install
```

## Development

```text
cd packages/main
npm run dev
```

Open:

```text
http://localhost:3000/holes/DDH041/current
```

Playwright uses `http://127.0.0.1:3100` when running `npm run test:e2e`.

## Production build (local)

```text
cd packages/main
npm run build
npm run start
```

Then open the same Current Hole URL on the start port (default `3000`).

## Useful verification commands

```text
npm run test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

## Storage behaviour

- Operational records use versioned localStorage envelopes.
- Tray photographs and report binaries use IndexedDB databases
  (`targetlock-runbook-media-v1`, `targetlock-runbook-reports-v1`).
- Data is hole/organisation scoped and browser-local.
- Clearing site data restores seed fixtures on next load.
- Seed data never overwrites already-persisted local user records.

## Browser recommendations

- Prefer current Chrome or Edge.
- Allow local storage and IndexedDB for the app origin.
- Avoid private/ephemeral profiles if you need records to survive restart.
- Test both light and dark themes before field use.

## Backup and export limitations

- There is no cloud backup.
- Download/share writes files from this device only.
- Prepare Email opens a local draft path; TargetLock does not send mail.
- Export reports before clearing browser data if you need a copy.
- See `docs/known-limitations.md` for the full pilot constraint list.

## Railway / public hosting note

Railway can host the TargetLock Next.js app on a public domain, but operational
data, photographs and generated reports remain local to each browser. Deploying
does not create shared cloud storage or synchronisation between devices.

Deployment steps: `docs/railway-deployment.md`.
