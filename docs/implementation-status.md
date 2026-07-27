# TargetLock Implementation Status

Status date: 2026-07-28
Target: `packages/main` only
Stage: Professional foundation hardening — Operator Start, Project and Hole Library

## Professional foundation hardening — Project and Hole Library

The application now opens through a polished device-local `/sign-in` and
phone-first `/start` decision page. Start derives the safest next action for the
operator's last valid hole, confirms existing-hole context, and requires an
explicit project selection before new-hole onboarding. Operator profiles,
roles and recent-hole state remain browser-local and are not security
credentials.

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
deployment opt-in. The optional pilot Basic access gate remains independent.

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
analytical tables and chart text summaries (chart images deferred). Excel adds
Hole / Shift / Run / Component / Survey / Tray / Completeness analytics sheets.
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

The local TargetLock pilot was integration-audited end-to-end. Authoritative
drilling maths remain in `src/domain/rods.ts`. Repository boundaries, hole
lock enforcement, report honesty, and refresh persistence were verified.
Material defects found during the audit were fixed. The package is ready for
supervised field pilot use with the limitations in `docs/known-limitations.md`.

**READY FOR FIELD PILOT**

## Railway deployment preparation

`packages/main` is isolated (own lockfile; no root workspace). Railway Root
Directory is `/packages/main` with config at `/packages/main/railway.json`,
healthcheck at `/api/health`, and an optional server-side pilot access gate.
Railway hosts application code only; browser-local Runs, photos and reports are
not synchronised. See `docs/railway-deployment.md`.

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

See `docs/known-limitations.md`. Highlights: no account auth, no sync, no cloud
media, no SMTP delivery, barrel capacity unset, TargetLock IQ deferred, and
inherited template modules remain in the package but are disabled in production
unless explicitly enabled.

## Baseline constraints

- `packages/main` is the sole implementation target.
- The seven packages remain standalone; no root workspace is introduced.
- `docs/index.html` remains untouched.
- The authoritative external product-plan file must not be modified.
