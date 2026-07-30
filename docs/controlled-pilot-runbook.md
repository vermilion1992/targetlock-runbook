# Controlled Pilot Deployment Runbook

This runbook deploys **Stage 7C**: server-backed pilot accounts, organisation
membership, registered tablet context, lease-aware local mutations, a durable
browser outbox, an immutable validated Postgres operation journal and
authoritative normalised projections for the core Project/Rig/Hole/BHA/Shift/
Run/Rod/Handover workflow. Field records still commit locally first. Peripheral
records remain journal-only; media/report blobs are not uploaded.

## 1. Provision Railway

1. Create a Railway project and add a PostgreSQL service.
2. Deploy `packages/main` as the application root.
3. Generate the application HTTPS domain.
4. Set server-only variables:
   - `TARGETLOCK_MODE=pilot`
   - `DATABASE_URL` from the Railway PostgreSQL service
   - `PILOT_SESSION_SECRET` to a cryptographically random value of at least 32
     characters
   - `APP_ORIGIN=https://<the-exact-railway-domain>`
   - optionally `DATABASE_SSL=require` when using an external TLS endpoint
5. Do not set `ALLOW_LOCAL_DEMO_IN_PRODUCTION` or any bootstrap password on the
   running service.
6. Keep one application replica for Stage 7C. Login/provisioning rate-limit
   buckets are process-local; use a shared limiter before horizontal scaling.

Production requests fail with `503` when this configuration is absent or
invalid. `/api/health` is liveness only; `/api/readiness` validates
configuration, database reachability and the exact expected migration without
returning connection details.

## 2. Apply schema and create the first administrator

Run from `packages/main` in an environment with `DATABASE_URL`:

```text
npm ci
npm run pilot:migrate
npm run pilot:migrate:check
```

Set the six `PILOT_BOOTSTRAP_*` variables listed in `.env.example`, then run:

```text
npm run pilot:bootstrap
```

Bootstrap refuses an organisation that already has members. Remove the
bootstrap variables immediately after success. The password and password hash
are never printed.

## 3. Provision the controlled team

Sign in as the company administrator and open `/pilot-admin`. Create named
accounts with a server-assigned `COMPANY_ADMIN`, `SUPERVISOR` or `DRILLER`
role. Communicate the temporary password out-of-band; it is never returned
after submission. The user changes it from Pilot administration, which revokes
all prior sessions and requires a new sign-in. Every signed-in role can also
use `/pilot-account`; temporary-password sessions are redirected there before
field or administration work. SMTP is not included.

Use `POST /api/pilot/users/status` to disable or revoke a member. This
increments the account session version, invalidating all existing sessions.
The current administrator cannot disable their own active account.

All mutation endpoints require the exact `APP_ORIGIN` Origin header and the
HttpOnly session cookie. Login and provisioning are rate-limited. Do not put
account passwords in shell history, source files, tickets or chat logs.

## 4. Register and assign the rig tablet

On the physical tablet:

1. Sign in as a supervisor or company administrator.
2. Use `/pilot-admin` to register this browser once with a unique display name
   and optional site/project/rig references.
3. The server sets a durable HttpOnly device cookie; only its HMAC hash is
   stored in PostgreSQL.
4. Confirm `/api/pilot/session` reports `deviceVerified: true` and that Start
   shows the expected tablet and rig context.

Normal operator **Sign out** revokes only the operator session and deliberately
preserves the dedicated tablet's device cookie. Use **Remove/revoke this
device** only for retirement, loss, reassignment or suspected compromise; it
revokes the server record and clears only the device cookie. Active primary rig
assignments are unique per organisation. Registration, assignment and removal
are audited.

A Driller is fail-closed outside this device's project/rig assignment for lease,
write, snapshot, change, conflict and restore operations. A Supervisor or
Company admin may cross that boundary only for recovery/oversight; the server
records a `DEVICE_ASSIGNMENT_OVERRIDE` audit. Review those audits during any
cross-rig incident.

## 5. Operational verification

Before field use:

- Verify a Driller receives no project/rig administration, broad setup,
  completion, reopen or correction route access.
- On an assigned registered tablet, verify the Driller can create one Draft
  hole from a client plan reference, record its initial BHA/CSU, and activate it
  by starting the first Shift. Repeat or post-Shift setup attempts must be
  rejected as Supervisor-only.
- Verify disabling the test Driller ends access on the next request.
- Acquire the same hole lease from two registered test devices; the second
  must receive read-only/contention status.
- Perform one supervisor takeover with a meaningful reason and confirm its
  audit event.
- Submit the same typed operation envelope twice and confirm the same receipt is
  returned. Reuse its operation ID with different payload and confirm rejection.
- Confirm a second device is read-only while a lease is active. Confirm an
  operation with stale/missing lease evidence is conflict/rejected.
- Confirm forged client verification/grace timestamps, a stale lease version,
  release and takeover cannot extend write authority. The server's current
  lease row and server-issued grace deadlines are authoritative.
- Confirm Start says identity/device are server verified, local writes are
  journal-backed, and accepted core state is recoverable from the server.
- Confirm a fresh pilot browser contains no DDH041/demo projects or holes.
- Confirm Driller deep links to component assignment/change, trajectory
  setup/plan and correction pages return to Start with an access explanation.
  The BHA route is available only for the initial assigned Draft-hole setup;
  after that setup is recorded it must show Supervisor approval required.

The CI-ready database check requires `TEST_DATABASE_URL` and runs as
`npm run test:pilot-db`; it fails clearly when that variable is absent and
exercises journal replay idempotency, core materialisation/snapshots/cursors,
duplicate-run conflict and organisation isolation after migration. The
`targetlock-quality` GitHub Actions workflow
runs that command against a disposable Postgres 16 service without production
credentials. The required acceptance command is
`npm run test:pilot-acceptance`; it does not skip when database or browser
credentials are absent. The optional developer smoke is
`npm run test:e2e:pilot:optional`. Required live browser acceptance uses
`PILOT_E2E_BASE_URL`, `PILOT_E2E_ORGANISATION`,
`PILOT_E2E_ADMIN_EMAIL` and `PILOT_E2E_ADMIN_PASSWORD` set for a disposable
pilot environment.

## 6. Daily and shift-end field checklist

Before each shift:

1. Confirm the named operator, company role, device name, project, rig and hole.
2. Confirm the runbook shell says **Primary writer**. Do not record on a device
   showing **Read-only** or **Conflict**.
3. Confirm browser storage is below 80%, server readiness is green and the
   unsynced count is understood.
4. If offline, confirm the visible grace state. Normal writes have a 30-minute
   grace from the last verified lease. A previously authorised shift may use a
   bounded 12-hour completion/close grace; the operation is marked for review.

At handover or shift end:

1. Close/hand over the shift and confirm the writer lease releases.
2. Reconnect and use **Push then pull core state** until the unsynced count is
   zero and the shell says **Server current**. Do not log out, reassign or
   remove the tablet while pending,
   quarantined, unjournalled-failure or storage-error entries remain; export the
   metadata backup, explicitly acknowledge exported failure evidence and
   escalate recovery instead.
3. Generate and download the required shift/hole report.
4. Export a TargetLock pilot metadata backup and record its SHA-256 checksum.
5. Keep the dedicated tablet powered and protected. The JSON backup contains a
   media manifest, not recoverable image/report blobs.

## 7. Backups and rollback

Enable Railway PostgreSQL backups before live field data uses the Stage 7C
tables. Export and restore into a non-production database, rerun readiness, and
record the drill result. Database backup protects the control plane, accepted
journal and authoritative core tables. The in-app export protects versioned
local metadata/outbox records, server aggregate IDs/revisions/cursor and a
media manifest. It does not contain recoverable photo/report blobs. Dry-run
import validates structure, checksum and organisation without mutating browser
storage.

Rollback the application version only after confirming its migration
compatibility. Migrations are forward-applied and recorded in
`pilot_schema_migrations`; do not manually delete migration rows.

## 8. Replacement-tablet core restore

1. On the outgoing tablet, reconnect and push until no pending/conflict/
   rejected/failed operations remain. Export the pilot metadata backup and
   required reports. Never clear the browser profile as a shortcut.
2. Register the replacement browser to the same organisation and assign the
   correct project/rig. Do not take the writer lease merely to perform a
   read-only restore.
3. Open Pilot administration and choose **Preview server restore**. Verify the
   project, rig, hole count, authoritative record count, local replacement count
   and pending-operation count.
4. Restore is blocked if the new browser has pending local operations or
   durable unjournalled-failure evidence. Push or export those records,
   acknowledge only the evidence actually exported, and escalate any conflict;
   do not discard them.
5. Enter an incident/replacement reason and select **Confirm restore from
   server**. The server first durably prepares an idempotent restore audit,
   then the browser hydrates under the runbook Web Lock and rechecks the outbox
   immediately before storage commit. The browser then commits the audit; a
   failed commit remains visibly pending and is retried before the device can
   claim Server current.
6. Confirm Start has no DDH041/demo record, open the recovered hole, and compare
   BHA timeline, shifts, handovers, runs/rod events, completion/reopen history
   and current server revision with the outgoing backup/report. A restored
   completed hole must remain locked until an authorised reopen.
7. Media and generated reports do not transfer. Copy downloaded artefacts using
   company procedure. Any journal-only peripheral history must be checked
   against the outgoing backup until its server materialiser is implemented.
8. Only then acquire/take over the writer lease. If the shell shows
   **Conflict**, leave the replacement device read-only, export evidence and
   have a supervisor review current revision/operation details.

## Incident response

- For a lost tablet, revoke its device and affected users from another
  supervisor device. Preserve the last metadata backup and reports.
- For lease contention, establish which tablet holds the authoritative local
  record before takeover. Every takeover or stale release requires a reason.
- For storage/quota warnings, stop adding media, export metadata and reports,
  and preserve the browser profile. Do not clear site data.
- Record incident time, company/rig/hole, operator, device ID, unsynced count
  and operation IDs. Never include passwords, cookies or database credentials.
- Configure named company and TargetLock support contacts before mobilisation.

See `docs/pilot-terms-privacy-support.md`; it is an operational checklist, not
legal advice.

## Remaining work before live multi-device production

- Materialise remaining casing/component/survey/tray/report operation types and
  add a reviewed conflict-disposition/merge policy.
- Add cloud object storage for photographs and report blobs.
- Complete backup/restore drills for both PostgreSQL and future object storage.
- Validate the physical tablet, camera, glare/glove use and network recovery.
- Add shared rate limiting, monitoring/alerting and a field-facing
  conflict-resolution UI.

Until those items are complete, the safe operating model is one primary writer
tablet per rig, authorised read/recovery tablets, routine report/metadata
exports, and explicit acknowledgement that only the Stage 7C core workflow is
server-authoritative.
