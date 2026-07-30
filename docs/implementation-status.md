# TargetLock Implementation Status

Status date: 2026-07-29
Target: `packages/main` only
Stage: Stage 7C authoritative core recovery + PDF Visual Parity v1

## Stage 7C — Authoritative core workflow and cross-device recovery

- Migrations `0004_stage_7c_core_materialisation.sql` and
  `0005_stage_7c_review_hardening.sql` extend the existing
  organisation-scoped project/rig/hole identities and adds normalised BHA,
  configuration, shift, handover, run, rod-event, correction, aggregate-head
  and durable change-feed tables. The hardening migration adds server-issued
  lease-grace timestamps, completion/reopen projections, durable two-phase
  restore evidence and a database-enforced one-active-shift-per-hole rule.
- The canonical manifest marks the authoritative subset. Per-operation Zod
  handlers retain integer-decimetre facts and actor/device/client-time evidence.
  Receipt, lease/version checks, projection application, revision/head/cursor
  update and audit execute in one Postgres transaction.
- Authenticated, organisation-scoped APIs serve the authorised directory,
  complete versioned hole snapshots, bounded cursor pulls and current conflict
  details. Readiness now requires the Stage 7C migration.
- Pilot browsers push the durable outbox before pulling. With no unsynced local
  work, server snapshots hydrate the established local repository envelopes
  directly and idempotently without generating new outbox operations.
- Pilot administration includes a replacement-device restore dry-run,
  pending-work block, explicit confirmation/reason and a durable, idempotent
  prepare/commit audit. Recovery runs under the runbook Web Lock, rechecks the
  outbox before storage commit and keys cursors to the assignment identity.
  Backup format v2 includes server IDs, aggregate revisions and pull cursor.
- Drillers are denied outside their registered project/rig assignment.
  Supervisors and company admins may use a cross-assignment override for
  recovery/oversight, with `DEVICE_ASSIGNMENT_OVERRIDE` audit evidence.
  Lease grace is evaluated from the current Postgres lease/version/device and
  server-issued grace deadlines; client timestamps are retained only as
  evidence.
- Start reads only the hydrated organisation directory in pilot mode. The
  runbook distinguishes Local saved, Journal backed up, Server current and
  Conflict.

Operational honesty: Postgres is authoritative for the core Project → Rig →
Hole → BHA → Shift → Run/Rod → Handover projection after acceptance. Media and
generated report blobs remain local; peripheral modules remain journal-only;
conflicts require manual supervisor review rather than automatic merge.

## Stage 7B — Operationally honest shadow pilot

- Explicit demo mode alone hydrates DDH041 training data; fresh pilot browsers
  start with no demo project/hole.
- Exact server roles flow into client context and report attribution. Setup,
  component/BHA/trajectory and correction deep links have server route
  boundaries; typed journal operations repeat the permission check server-side.
- Pilot administration provides user status/provisioning, temporary-password
  handling, password change/session revocation, device registration/assignment/
  removal, lease status/takeover/stale release, diagnostics and support links.
- Coordinated browser repository mutations use an IndexedDB outbox with
  pending/sending/accepted/conflict/rejected/failed states and retry/backoff.
  Validated payload JSON, immutable references, timestamps, expected version,
  hash and lease evidence persist in `pilot_domain_operations`.
- The runbook shell exposes Primary writer, Read-only, Offline grace and
  Conflict states. Online non-owners cannot mutate. Offline grace is bounded
  and completion/close operations retain a longer, visible emergency window.
- The metadata backup is versioned/checksummed and has an import dry-run.
  Storage quota is visible. The export contains a media manifest, not
  recoverable blobs.
- Stage 7B originally required migration
  `0003_stage_7b_revision_and_atomicity.sql`; Stage 7C supersedes readiness with
  `0005_stage_7c_review_hardening.sql`.
  Accepted versioned journal operations advance an organisation-scoped,
  Postgres-backed revision registry transactionally; stale expected versions
  conflict without claiming materialised domain state. Railway
  migration execution remains a controlled release command protected by a
  Postgres advisory lock; it is not run from every replica.

The Stage 7B journal-only limitation still applies to operation types outside
the Stage 7C core manifest.

## Report modernisation — PDF Visual Parity v1

Full-Hole and Hole Summary PDFs now open with a TargetLock-branded hero using
repository-backed hole/project/client/site/rig context, lifecycle status,
recorded collar coordinates and direction, coordinate/grid label, active
operator attribution, report time/version and an eight-card KPI grid. Two real
deterministic `pdf-lib` vector graphics—depth progression by Shift and recovery
by Run depth—consume the existing analytics snapshot arrays. Existing
trajectory plan/section/3D vectors remain unchanged and continue to use
verified comparison render paths.

Report generation and subsequent open/download/share/email-draft audits now use
the active device-local operator rather than a hardcoded seed user. Report
snapshot and generated-record metadata retain optional ID/name/role snapshots;
legacy local records remain readable. CSV exports use report-specific defaults,
show an accessible dataset selector for multi-dataset reports, preserve the
dataset on Generate New Version, and reject incompatible combinations.

The PDF location panel is an honest offline coordinate/trajectory view, not a
satellite map. No map key/provider/dependency was added and no mine-grid
coordinates are sent off-device. The adapter has an optional in-memory static
image boundary for future work, which still requires project CRS/EPSG or stored
WGS84, attribution/licensing, privacy controls, fetch/cache policy and offline
fallback.

## Professional foundation hardening — Project and Hole Library

The application now opens through a polished device-local `/sign-in` and
phone-first `/start` decision page. The implemented sequence is Identity →
Choose/confirm work → Runbook. Start makes the operator's last valid hole
primary, derives its safest readiness-aware next action, labels other records
as available on this device, and confirms project/client or site, rig, hole
identity/lifecycle and operator role before navigation. Signed-out hole deep
links are preserved through Start instead of bypassing confirmation.

Drillers can choose open local holes and create a Draft from a client-issued
plan when the registered tablet is assigned to the authoritative project and
rig. This narrow permission records the plan reference and allows only the
first BHA/CSU before any Shift or Run; project/rig creation, later setup,
correction and completion remain privileged. In demo mode, self-selected roles
remain workflow aids only. In pilot mode, protected layouts resolve the server
session, operation permissions are rechecked server-side and Driller setup is
rejected outside the assigned Draft-hole boundary.

`/projects` remains the full organisation directory, where projects lead to a
project-owned hole register. Every listed hole opens through its canonical
`/holes/[holeId]` runbook; the runbook header provides a stable change-hole
escape path. New holes are created under `/projects/[projectId]/holes/new` with
an explicit project, project-owned rig, hole size, planned depth and collar
direction, then open on Current Hole for readiness work. Legacy `/holes/new`
redirects to the current pilot project.

Unknown syntactically valid hole URLs no longer render seed-derived "ghost"
records: a storage-backed route boundary verifies the hole before rendering
runbook children. Reserved route words cannot be created as hole IDs. Completion
and report context now resolves the persisted hole's project and rig rather
than substituting the original seed identities.

Project creation persists the project and its first rig as one coordinated,
idempotent browser operation. New holes remain `DRAFT` until a valid BHA length
and CSU are recorded and the first shift starts. Shift and run use cases enforce
the same derived readiness rule as their direct pages. Initial setup stays
short on phones; optional component fields are collapsed, while later BHA/CSU
changes require a reason and appear at their effective depth on the timeline.
Initial collar direction and later hole-setup updates also append depth-aware
timeline audit entries. Signed-in operator snapshots now attribute project/hole
onboarding, BHA changes and trajectory setup; shift ownership still requires an
explicit primary driller.

Gemini credentials are server-only. The production request proxy blocks inherited
template pages and APIs by default while preserving TargetLock routes, health
checks and required assets; `ENABLE_TEMPLATE_DEMOS=true` is an explicit
deployment opt-in. The legacy Basic gate is limited to demo previews; secure
pilot mode uses account sessions.

## V2 Implementation 6 — Interactive 3D Trajectory and Report Graphics

Presentation-only interactive trajectory graphics consume verified
Implementation 5 `HoleTrajectoryComparison` / `renderPath` coordinates without
changing desurvey mathematics. Canvas viewer supports rotate, pan, zoom, reset,
plan / vertical-section / 3D modes, equal and exaggerated vertical scale,
collar / planned / Survey / endpoint / target markers, dashed planned vs solid
actual paths, target radius, Survey inspection with same-depth deviation,
current tracking callout, phone/tablet fallback, PNG export, and an explicit
non-certified anti-collision disclaimer. Hole Summary, Full-Hole, and
Current-Shift PDFs embed deterministic plan / section / 3D vector graphics from
the same path coordinates. Out of scope: steering recommendations, certified
anti-collision, geographic reprojection, changing `minimum-curvature-v1`.

## V2 Implementation 5 — Planned versus actual Survey trajectories

Authoritative minimum-curvature trajectory engine (`minimum-curvature-v1`)
calculates independent planned and actual paths from planned directional
stations and selected Survey readings. Hole coordinate configuration supports
relative and mine-grid modes; optional targets store E/N/RL separately from
endpoint attitude. Same-MD tracking, target distance / closest approach,
plan/setup/comparison UI, Current Hole card, Hole Analytics Trajectory
section, and Hole Summary / Full-Hole / Excel trajectory summaries share one
comparison query. Interactive 3D and PDF trajectory graphics delivered in
Implementation 6. Out of scope: steering recommendations, certified
anti-collision, geographic reprojection.

## V2 Implementation 4 — End-of-Hole analytics and analytical reports

Hole Statistics (`/holes/[holeId]/statistics`), completed-Hole teaser, Full-Hole
and Hole Summary reports share one pure `calculateHoleAnalytics` result via
`getHoleAnalytics`. Production, Shift rollups, rods, components, casing,
Surveys, Trays, record completeness, and six chart datasets are derived from
repository-backed effective records (voids excluded; weighted recovery; shared
Runs credited to the completing Shift). Live UI charts use Recharts; PDF embeds
analytical tables, searchable notes and deterministic vector depth/recovery
charts. Excel adds Hole / Shift / Run / Component / Survey / Tray /
Completeness analytics sheets.
Completion versions remain selectable after reopen. Out of scope: survey
desurveying / 3D trajectory, payroll, downtime costing, employee rankings,
component causation claims.

## V2 Implementation 3 — End-of-Shift analytics and handover breakdown

Shift close, handover, Shift detail, Shift history, Current Hole, and
Current-Shift reports share one pure `calculateShiftAnalytics` result derived
from repository-backed effective Runs (voids excluded; shared Runs credited to
the completing Shift). Weighted recovery is total recovered ÷ total drilled.
Median Run length uses integer-domain median rules. Close persists an immutable
`closeAnalyticsSnapshot`; post-close corrections update current analytics while
preserving the original snapshot (SHIFT ANALYTICS AMENDED). Time metrics are
labelled as elapsed Shift / recorded Run-cycle values only. Out of scope for
Imp 3: payroll, downtime, costing, employee rankings (end-of-hole delivered in
Imp 4).

## V2 Implementation 2 — Audited Run corrections and voiding

Completed Runs support an audited Correct / Void workflow. Original snapshots
are frozen; field-level correction records and staged `operationId` transactions
update the current projection. Stick-up, recovered length, rod-event, and
comment corrections share one impact engine for preview and save. Voided Runs
remain searchable and visible with a `VOID` label but are excluded from
operational calculations. Locked holes block calculation-affecting corrections
until reopen. Report `sourceVersions` bump when Runs change so prior reports
become out of date without altering historical binaries.

## V2 Implementation 1 — Report generation reliability

Report Centre now runs a verified generation transaction
(`SNAPSHOT_BUILDING` … `FILE_VERIFIED` … `COMPLETED`), shows staged progress
and a persistent success card, supports Open PDF / Download / Share / Prepare
Email, versions without overwrite, and flags out-of-date reports via
`sourceVersions` fingerprints. Empty or unsigned blobs cannot be marked
generated.

## Final pilot audit result (V1 retained)

The local TargetLock workflow was integration-audited end-to-end. Authoritative
drilling maths remain in `src/domain/rods.ts`. Repository boundaries, hole
lock enforcement, report honesty, and refresh persistence were verified.
Material defects found during the audit were fixed. Stage 7A supplies a
deployable controlled-pilot identity/control-plane foundation, but the package
must not be described as fully production-ready while domain sync, cloud blobs,
backup drills, hardware validation, monitoring and conflict UI remain open.

**CONTROLLED PILOT FOUNDATION IMPLEMENTED — REMAINING GATES APPLY**

## Railway deployment preparation

`packages/main` is isolated (own lockfile; no root workspace). Railway Root
Directory is `/packages/main` with config at `/packages/main/railway.json`,
readiness check at `/api/readiness`, and Railway PostgreSQL for secure pilot
control-plane records. Browser-local Runs, photos and reports are not yet
synchronised. See `docs/railway-deployment.md`.

## Maths authority

Single implementations remain:

| Formula | Function | File |
|---------|----------|------|
| Base R/S | `calculateBaseRodString` | `src/domain/rods.ts` |
| Current R/S | `calculateCurrentRodString` | `src/domain/rods.ts` |
| Hole depth | `calculateHoleDepth` | `src/domain/rods.ts` |
| Drilled | `calculateDrilledLength` | `src/domain/rods.ts` |

Operational lengths stay integer decimetres internally and display to one
decimal place.

## Final audit fixes

- Timeline includes local completed runs (not seed-only) with run links.
- Current Hole recovery no longer double-counts seed + local runs.
- Report loss/gain uses per-run variance, matching completion statistics.
- Handover recovery cannot open a new shift after hole lock.
- Component recovery cleans stale prepared ops instead of breaking locked reads.
- Survey media writes assert hole mutability before IndexedDB blob save.
- Operational timeline titles for component assign/correct no longer fall through
  to shared-run wording.
- Hole search covers runs, shifts, casing, bits/reamers, surveys, trays,
  completions, reports, and timeline.
- Close Shift exposes **Close as final shift** so completion can proceed.
- Stage 2 seed night rod events continue Stage 1 rod history without duplicating
  Day Shift rods (fixes `FINAL_DEPTH_RECONCILED` for DDH041).
- More menu / prototype wording cleaned for one-product pilot presentation.

## Implemented surface retained

Stages 1–6 remain: runs, shifts/handover, casing, components, surveys, trays,
completion/lock/reopen, Report Centre/Activity, Timeline, Search, Statistics
(via shift history and domain aggregates), and completed-hole list.

## Verification

Run from `packages/main`:

- [x] 2026-07-28 Stage 7A: 27 focused pilot/config/proxy tests, 483 total
  unit tests, scoped lint, production typecheck, Next.js 16.2.12 demo-mode
  production build, three project/sign-in Playwright smokes and
  `git diff --check`
- [x] 2026-07-28 PDF Visual Parity v1: 27 focused report tests, 464 total
  unit tests, report attribution/CSV browser workflow (8 Playwright tests),
  scoped lint, production typecheck, production build and `git diff --check`
- [x] 2026-07-28 professional foundation and route-gap audit: 456 unit tests,
  safe post-sign-in deep links, component registry/detail routes, recoverable
  project-hole setup, reserved-route rejection, and expanded scoped
  typecheck, expanded lint, and Next.js production build
- [x] Production browser smoke: Sign In → Start → confirmed project-scoped
  new-hole flow → BHA setup → Shift; recent-hole resume and sign-out; unknown
  hole recovery; inherited dashboard/API 404 policy
- [x] GitHub Actions quality workflow for install, typecheck, lint, unit tests,
  and production build
- [x] `npm run test` — unit tests including trajectory engine, view-model
  coordinate fidelity, and PDF trajectory graphics
- [x] `npm run test:e2e` — `e2e/reports.spec.ts` V2 workflows 1–5 plus share/email
  and responsive Report Centre checks; other Stage suites retained
- [x] `npm run typecheck`
- [x] `npm run lint` — scoped TargetLock lint
- [x] `npm run build`
- [x] Local production build succeeded; Hole Summary PDF evidence
  `DDH041_Hole_Summary_v001_2026-07-24.pdf` non-zero `%PDF-` blob with ≥1 page
- [x] Responsive/light-dark review at `360`, `390`, `430`, `768`, `1024` px in
  the reports Playwright workflow
- [ ] Manual accessibility/device review: keyboard-only, screen reader, 200%
  zoom, gloves, glare, physical camera, safe-area on hardware
- [x] Live Railway browser verify after deploy — `e2e/run-corrections.spec.ts`
  (7 workflows) against production URL with temporary Playwright config

### Manual checks still required

- Physical tablet/phone outdoors (glare, gloves, safe-area insets)
- Screen-reader walkthrough of complete/lock/reopen
- Keyboard-only complete workflow on a hardware keyboard
- Native share sheet on Capacitor/device if packaged later

## Still deferred

See `docs/known-limitations.md`. Stage 7A now supplies secure pilot account,
device, lease and operation-receipt boundaries, but domain sync, cloud media,
SMTP delivery, backup drills, physical-device validation and conflict UI remain
deferred. Barrel capacity is unset, TargetLock IQ is deferred, and inherited
template modules remain in the package but are disabled in production unless
explicitly enabled.

## Baseline constraints

- `packages/main` is the sole implementation target.
- The seven packages remain standalone; no root workspace is introduced.
- `docs/index.html` remains untouched.
- The authoritative external product-plan file must not be modified.

## Stage 7A — controlled pilot foundation

Implemented:

- Railway-compatible PostgreSQL migration for organisations, users,
  memberships, sessions, project/rig/hole identity references, registered
  devices, work leases, operation receipts, sync cursors and audit events.
- One-time company-admin bootstrap plus authenticated user provisioning,
  disable/revoke, device register/assign/revoke and logout endpoints.
- Server-assigned `COMPANY_ADMIN`, `SUPERVISOR` and `DRILLER` roles with
  central permissions. Drillers are denied setup, completion, reopen,
  correction, provisioning and lease takeover.
- Secure HttpOnly/SameSite session and device cookies, bcrypt password hashing,
  HMAC token storage, expiry/revocation, exact-origin CSRF checks, endpoint rate
  limits, safe errors and security headers.
- Server route gates for protected Library/Runbook pages and privileged setup,
  complete, reopen, correction and void segments.
- Organisation-scoped device/rig context, lease acquire/status/heartbeat/
  release/takeover APIs and idempotent operation receipts with expected-version
  conflict status.
- Public liveness and non-leaking readiness checks; production fail-closed
  environment validation.
- Explicit `demo` mode retaining existing seed/E2E/local operator workflows.

Truthful boundary: operational project/hole/run/media/report writes remain in
localStorage/IndexedDB. The Stage 7A sync endpoint validates context and records
receipts only; it does not apply existing domain writes. See
`docs/controlled-pilot-runbook.md`.

Still required before claiming full production-pilot readiness: migrate all
domain writes into the offline sync queue/application path, cloud media/report
blobs, restore drills, physical tablet validation, monitoring/alerting and
field conflict-resolution UI.
