# TargetLock Architecture

## Repository boundary

`packages/main` is the sole TargetLock target. The repository contains seven standalone, duplicate-ish packages and no root workspace, so TargetLock must not introduce cross-package imports, root orchestration, or parallel implementations.

The existing application baseline is:

- Next.js 16 App Router and React 19.
- TypeScript with strict mode enabled.
- Tailwind CSS v4 using CSS-first configuration.
- shadcn-style components backed by Radix primitives.
- `next-themes`, React Hook Form, and Zod.
- Stage 7C extends the Postgres control plane and immutable JSON operation
  journal with transactional, normalised authoritative projections for the core
  Project → Rig → Hole → BHA → Shift → Run/Rod → Handover vertical. Peripheral
  modules remain journal-only. Stage 4 uses IndexedDB for local
  media blobs; Stage 5 adds
  organisation-scoped completion metadata in localStorage; Stage 6 adds a
  separate IndexedDB database for report binaries plus a reports metadata
  envelope. Focused Vitest and Playwright coverage is configured for TargetLock.

## Application shape

TargetLock lives as a feature slice inside `packages/main`. Public device-local
sign-in uses `PublicLayout`; field start and global project/hole selection use
`LibraryLayout`; hole-owned work uses `RunbookLayout`. The root layout provides
global CSS, fonts, theme, toast infrastructure and the local operator-session
provider, but none of these surfaces inherit dashboard navigation or
dashboard-specific state.

The implemented feature boundary is:

```text
src/
  app/(PublicLayout)/
    sign-in/              device-local operator identification
  app/(LibraryLayout)/
    start/                 recent-hole and new-work decision page
    projects/              project index
    projects/new/          local Project + initial Rig onboarding
    projects/[projectId]/  project-owned hole register
    projects/[projectId]/holes/new/
                           explicit project/rig hole onboarding
    holes/completed/       completed/abandoned/reopened hole list
  app/(RunbookLayout)/holes/[holeId]/
    layout.tsx             storage-backed existence boundary
    page.tsx              redirect to Current Hole
    current/               current-hole dashboard
    runs/                  redirect to Record Run
    runs/new/              shift-gated Record Run route
    runs/[runId]/          explicit run ownership detail
    shifts/start/          Day/Night Shift start
    shifts/[shiftId]/      shift detail and close route
    shifts/                shift history and statistics
    handover/              recoverable acceptance
    runbook/               shift-grouped runbook
    runs/[runId]/          run detail with Correct / Void entry points
    runs/[runId]/correct/  audited run correction workflow + impact preview
    runs/[runId]/void/     audited void workflow with rod-event resolution
    casing/                history and install workflow
    casing/[casingId]/     detail, advance, and correction workflows
    components/            active assignments and hole history
    components/[type]/     initial assignment and exact-depth change
    surveys/               history and manual station entry
    surveys/[surveyId]/    detail and correction
    surveys/tools/         lightweight organisation tool registry
    trays/                 completed-tray photograph library and capture
    trays/[trayId]/        detail, correction, and photo replacement
    complete/              final-hole completion review and lock
    reopen/                reopen a locked hole
    reports/               Report Centre generate/download/share/email draft
    reports/history/       Report Activity filters and version history
    timeline/              repository-backed operational timeline
    more/                  More Tools landing (stable parent for secondary tools)
    trajectory/            trajectory cockpit (+ plan/setup redirects)
    survey-settings/       Survey & Reference Settings (optional returnTo)
    statistics/            hole analytics
  app/(RunbookLayout)/components/
    page.tsx               organisation component registry
    new/                   fast component creation
    [componentId]/         registry identity, corrections, assignment history
  components/
    app-shell/             isolated shell and theme controls
    casing/                casing history/forms/detail/support
    components/            registry/assignment/change/detail/support
    field/                 shared field controls and states
    holes/                 dashboard, completion review, reopen, locked panel
    projects/              project index and project-owned hole register
    media/                 camera/file input and local-media rendering
    navigation/            primary rail/bottom nav, runbookRoutes,
                           resolveSafeReturnPath, RunbookPageBackLink,
                           discard leave guard
    reports/               Report Centre and Report Activity UI
    runs/                  Record Run client workflow
    shifts/                start/close/handover/history/detail workflows
    surveys/               record/history/detail/correction/tool workflows
    trays/                 capture/library/detail/correction/replacement
    trajectory/            cockpit, survey settings, graphics
  application/runbook/     UI-independent run, shift, casing/component,
                           and hole-completion use cases plus mutation guard
  application/reports/     snapshot builder, generate/share/email use cases
  domain/                  units, formulas, models, invariants, completion,
                           reports
  infrastructure/
    sync/                  typed durable outbox, retry coordinator, lease guard
    backup/                checksummed metadata export and import dry-run
    casing/                versioned string projection and immutable events
    components/            organisation registry, assignments, recovery
    completion/            org-scoped completion envelope, lock, reopen
    drafts/                repository, schema migration, storage adapter
    media/                 IndexedDB blobs, previews, verification
    projects/              versioned local project/rig directory and onboarding
    reports/               PDF/Excel/CSV adapters, file + metadata repos, share
    shifts/                versioned shift repository and operation recovery
    surveys/               versioned survey/tool metadata repository
    trays/                 tray/photo metadata and media operation recovery
    audit/                 immutable hole-scoped audit appends
    seed/                  cumulative DDH041 Stage 1–5 fixtures
  server/pilot/            Postgres control plane + authoritative core boundary
```

Domain calculations do not depend on React or browser storage.

## Stage 7C authoritative core write and recovery path

Explicit demo mode alone enables cumulative DDH041 training seeds. Pilot and
unknown runtime modes initialise organisation-scoped directories with no demo
projects/holes. The server session provider configures exact organisation,
operator role and registered-device context before the field workspace opens.

Browser repository methods are classified by one explicit, fail-closed
operation manifest; unknown methods are configuration errors rather than
being guessed from method-name prefixes. Mutations are serialised through the
existing `RunbookOperationCoordinator`. In pilot mode the coordinator:

1. checks client role and the active hole writer lease;
2. permits an online primary writer, a 30-minute bounded offline grace, or a
   12-hour completion/close grace for a previously authorised shift;
3. commits the established browser repository mutation;
4. serialises the validated operation input/result (blobs become
   metadata/checksum only) into IndexedDB; and
5. retries the idempotent typed envelope to Postgres without rolling back the
   already-committed local field change.

The server independently verifies organisation/device/operator identity,
privileged operation permission, payload hash, size, reference context and
lease evidence. Drillers are fail-closed outside the registered device
project/rig assignment; supervisor/admin recovery overrides are separately
audited. Offline acceptance uses the current Postgres lease ID/version/writer,
release/takeover state and server-issued grace deadlines, never client
timestamps as authority. Immutable local project/rig/hole references are registered
under organisation-scoped uniqueness so a new hole is not rejected merely
because the server reference table was empty.

Pending outbox rows are partitioned by organisation/device/operator. Context
changes quarantine older unsynced rows instead of retrying them under a new
identity, and active-context logout/removal is blocked until sync is clear or a
recovery backup is exported.

`pilot_domain_operations` remains the immutable receipt. Core manifest handlers
validate operation-specific payloads with Zod and derive normalised projections.
Inside one Postgres transaction the repository checks lease evidence and the
canonical expected revision, applies the project-directory or hole aggregate,
updates the revision registry and aggregate head, appends the durable change
cursor, writes audit, and stores the stable operation receipt. Duplicate
operation IDs replay their original result. Stale revisions, duplicate run
numbers and conflicting entity versions produce explicit conflict receipts;
there is no last-write-wins path.

`pilot_projects`, `pilot_rigs` and `pilot_holes` retain their Stage 7A identity
role and now hold authoritative state. Hole configurations, BHA setups, shifts,
handovers, runs, rod events, run corrections, completion reviews, immutable
completion records and reopen history use organisation-scoped tables and
immutable local IDs. A partial unique index permits only one `OPEN` or
`HANDOVER_PENDING` shift per organisation/hole. Peripheral operation types
continue to be journal and revision controlled only.

Authenticated core APIs return the assigned/available directory, a versioned
complete hole snapshot, bounded changes since a durable cursor, and conflict
details. In pilot mode the browser always pushes its durable outbox first. Once
there is no pending/conflicted local operation, it pulls server changes and
hydrates established local repository envelopes without passing through the
mutation/outbox coordinator. First-use and explicit replacement-tablet restore
use the same assignment-keyed hydration transaction under the runbook Web Lock,
with a final outbox check immediately before storage commit. A restore dry-run
is blocked by pending operations or durable unjournalled-failure evidence,
requires confirmation/reason, prepares a durable idempotent server audit before
local replacement and commits it afterwards, and stores aggregate
IDs/revisions/cursor in backup metadata. Assignment changes and empty server
directories become explicit stale/clear-confirmation states. Demo mode never
uses this path.

The local write remains the field-speed/offline commit, while Postgres is the
authoritative recoverable core projection after journal acceptance. Media and
generated-report blobs are not uploaded.

## Runbook navigation model

`/sign-in` is the public entry and `/start` is the work-context boundary:
Identity → Choose/confirm work → Runbook. In demo mode identity is local; in
secure pilot mode protected layouts resolve the PostgreSQL-backed session.
Start makes the
operator's recent hole primary, exposes other open records as "Available on
this device", and confirms project/client or site, rig, hole identity,
lifecycle and operator role before navigation. A signed-out hole deep link is
sanitised, preserved as `/start?next=…`, matched to a local hole and confirmed
before the original destination opens. Ordinary resume/choose actions still
derive BHA setup, handover, active-run or start-shift routing from repository
state.

Drillers can resume or choose local holes and may create a Draft from a client
plan only for the registered device's assigned project/rig. That narrow route
captures the plan reference and permits initial trajectory defaults, the first
BHA/CSU, and Draft activation at the first Shift. Server lifecycle checks close
the Driller setup window after the first matching configuration, BHA, Shift or
Run. Project/rig creation, broad hole setup, later configuration, correction,
completion and reopen routes remain privileged. Supervisors receive a separated
Set up work area. Demo mode retains the lightweight client gate; secure pilot
mode additionally enforces the same granular permission and assignment checks
in server layouts and operation handling.
Within a selected hole, primary destinations (no in-page Back) are Current
Hole, Runbook, Trays, Trajectory and More — shared by desktop rail and phone
bottom nav via `RunbookNavigation`.

Secondary pages use `StagePageHeader.backTarget` with a named parent. Canonical
parents for More tools resolve to `/holes/[holeId]/more`. Nested detail pages
return to their collection (Shifts, Reports, Runbook, Casing, Surveys, Trays).
Survey Settings may accept a sanitized `?returnTo=` (for example Trajectory);
`resolveSafeReturnPath` rejects open redirects and cross-hole paths.

See ADR-047 and `docs/runbook-navigation-matrix.md`.

## Runtime and data flow

1. The root gateway asks `/api/pilot/session` for runtime mode. Demo mode reads
   the versioned browser-local operator session. Secure pilot mode validates the
   HttpOnly cookie, active organisation/membership/account/session version and
   optional registered device. Library and Runbook server layouts require that
   identity before the existing client session boundary renders.
2. The route renders the TargetLock shell and stable seed context.
3. Client-side form controls collect observations through React state and
   React Hook Form where the existing workflow uses it.
4. Zod validates input at the boundary and normalises display metres into integer decimetres.
   Project creation atomically establishes the initial Rig. Hole creation
   establishes identity/direction while optional collar/target details may be
   deferred.
4. Pure domain functions calculate initial/current R/S, hole depth, drilled length, and rod-count consistency.
5. UI components render editable, calculated, valid, warning, and error states.
6. A `RunRepository` saves and restores an unfinished draft and idempotent,
   append-only completed-run snapshots from local browser storage.
7. Each completed local run stores its individual rod events, including action,
   length, sequence, affected rod number, resulting rod number, and timestamp.
8. `getCurrentHoleState` is the single merger of seed baseline, local
   completions, unfinished draft/rod events, active/pending shift,
   repository-backed casing strings, active component assignments and usage,
   surveys, trays, and survey-interval state.
9. Drilling readiness is derived from current repository state. A valid
   effective BHA/CSU setup gates the first Shift and Run; optional design data
   does not. Direct routes render the same blockers as Overview. Starting the
   first Shift idempotently promotes its ready Hole from `DRAFT` to `ACTIVE`.
10. Shift use cases capture start/end snapshots and append audit records without
   changing drilling arithmetic. Close freezes `closeAnalyticsSnapshot` from
   shared `calculateShiftAnalytics` (`domain/shift-analytics.ts`), loaded via
   `shift-analytics-query.ts` for close, handover, detail, history, Current
   Hole, and Current-Shift reports.
11. Hole analytics reuse the same effective-record loaders via
    `calculateHoleAnalytics` / `getHoleAnalytics` for Statistics UI,
    completed-Hole teasers, and Full-Hole / Hole Summary
    `ReportDocumentData.holeAnalytics`. Optional `completionId` scopes
    historical completion analytics after reopen.
12. Casing use cases append immutable events and update the current projection.
    Component use cases transact an outgoing assignment close and incoming
    assignment open at one exact depth.
13. The operational timeline reads casing events, component assignments,
    surveys, and trays from their repositories. Audits supply shift events and
    Stage 4 correction/replacement events, preventing create-event duplicates
    after local changes.
14. Run detail renders start-time component/casing snapshots from the run and
    reconstructs within-run change disclosure from immutable component-change
    audits rather than mutable current assignment projections.
15. `LocalSurveyRepository` stores organisation-scoped tool records, hole-
    scoped surveys, immutable corrections, and idempotent operation IDs in one
    version-1 localStorage envelope. Survey creation copies the selected tool
    name and serial into the survey.
16. Survey input parses depth to integer decimetres and angles to integer
    tenths. Warning assessment uses circular azimuth difference, allows a
    deliberately confirmed repeated depth as a new record, and never performs
    a trajectory or north-reference conversion inside the Survey layer.
    Trajectory comparison is owned by `LocalTrajectoryRepository` plus
    `getHoleTrajectoryComparison` / pure domain desurvey modules.
16a. Trajectory graphics (Implementation 6) build a presentation view-model
    from verified comparison coordinates and render Canvas UI / PDF vector
    panels / PNG exports without recalculating desurvey mathematics. Report
    cover location panels reuse those verified render paths and recorded collar
    values; they do not geocode mine-grid coordinates or fetch map imagery.
17. `LocalTrayRepository` stores hole-scoped tray, photo metadata, corrections,
    and operation stages in localStorage. `IndexedDbMediaRepository` stores the
    original/preview blobs separately. A tray is activated only after its
    original is saved and verified.
18. Tray detail derives related completed runs by positive interval overlap
    from seed plus local completions. It does not persist run IDs on the tray,
    split a run, include an in-progress run, or allocate run recovery.
19. Current Hole merges survey/tray repositories into latest-survey, interval-
    reminder, and latest-tray summaries. The timeline reads survey/tray
    records directly and correction/replacement audits separately.
20. `LocalCompletionRepository` stores organisation-scoped hole statuses,
    reviews, immutable completion snapshots, reopen history, and staged
    completion transactions in a version-1 Zod envelope. Legacy hole statuses
    normalise before lifecycle decisions.
21. `evaluateHoleCompletion` produces blocking versus advisory checklist
    results. Authoritative final depth is the deepest finished completed-run
    depth; rod projection must reconcile before lock.
22. Completion use cases progress
    `REVIEW_CREATED` → `SNAPSHOT_PERSISTED` → `COMPONENTS_CLOSED` →
    `HOLE_LOCKED` → `TIMELINE_APPENDED` → `AUDIT_APPENDED` → `COMPLETED`,
    with hydration recovery for interrupted stages.
23. `HoleMutationGuard` wraps run/shift/casing/component/survey/tray mutators
    and throws `HoleLockedError` for `COMPLETED` / `ABANDONED` / `ARCHIVED`
    holes. Lock enforcement lives below the UI so route omission cannot bypass
    it. Reopen restores `ACTIVE` and appends reopen history without rewriting
    prior snapshots.
24. Current Hole reads completion lifecycle for locked/completed dashboard
    variants. Browser services wire Stage 5 seed, completion repository, and
    the mutation guard.

Browser APIs must remain behind client boundaries. Seed data and pure calculations should be importable without `window`, allowing later verification and replacement of persistence without rewriting the UI.

## State ownership

- **Seed state:** immutable multi-hole fixtures; `DDH041` carries the full
  operational history and lifecycle examples use additional canonical hole IDs.
- **Casing state:** hole-scoped current strings plus immutable lifecycle and
  correction events.
- **Component state:** organisation-scoped registry and assignments so
  duplicate-active checks include every known hole.
- **Shift state:** one hole-scoped `OPEN` or `HANDOVER_PENDING` record plus
  immutable closed history.
- **Draft state:** user-entered pending additions, stick-up, recovered length,
  condition tags, and comment.
- **Survey state:** organisation-scoped `SurveyTool` records plus hole-scoped
  stations and immutable corrections. Tool name/serial are snapshots.
- **Tray state:** hole-scoped completed trays, immutable detail/photo
  corrections, and the active `primaryPhotoId`.
- **Media state:** original/preview blobs in IndexedDB under
  organisation/hole-prefixed keys; `Photo` metadata and exact storage keys in
  the tray localStorage envelope.
- **Completion state:** organisation-scoped hole status, active review,
  immutable completion snapshots, reopen history, and recoverable transaction
  stage. Locked statuses block operational mutators.
- **Report state:** immutable repository snapshots include project/client/site,
  rig, recorded collar/grid/direction context, generation time/version and the
  active browser-local operator ID/name/role snapshot. Old local snapshots
  remain readable because visual-parity fields and role are optional.
- **Derived state:** calculated on demand; never persisted as authoritative input.
- **View state:** panel expansion, active field, theme choice, and transient messages.

### Browser storage coordination

Browser repositories created by `createBrowserRunbookServices` pass through a
shared `RunbookOperationCoordinator`. On supported browsers, the Web Locks API
serialises operations across tabs on the same origin. A module-level promise
queue also serialises service instances within one tab. Run-draft mutations and
project-default writes use the same coordinator when created directly.

Writes publish a `BroadcastChannel` message. The shell also listens for native
`storage` events and prompts a stale tab to reload. Reads remain behind
repository boundaries; UI code must not access localStorage or IndexedDB
directly. If Web Locks is unavailable, only same-tab ordering is guaranteed.

New binary keys are scoped independently of their global IndexedDB stores:

```text
targetlock:v2:org:{organisationId}:hole:{holeId}:media:{operationId}:{kind}:…
targetlock:v2:org:{organisationId}:hole:{holeId}:report:{operationId}
```

Existing metadata remains compatible because it stores the complete legacy
blob key. There is no automatic blob garbage collection when metadata is
removed.

Run persistence schema V4 adds nullable active bit/reamer assignment IDs,
immutable serial snapshots, and a casing summary to V3 ownership. Valid V1–V3
records retain IDs and ownership during migration; an assignment reference is
resolved only when type, serial, hole, and interval identify one unambiguous
record. Otherwise the available serial snapshot is retained and the reference
remains null. Legacy records without serial snapshots initialise all Stage 3
references and snapshots as null. Browser bootstrap supplies the run repository
with read-only assignment candidates for this migration only. Shift, audit,
casing, and component envelopes are versioned
separately. Unknown, invalid, or cross-hole payloads are reported and left
unchanged. If a draft is missing, the form prepares the next run from the
latest valid local completed snapshot.

Stage 4 does not bump the run envelope. `targetLockStage4Seed` extends the Stage
3 seed, retains the Stage 2 shifts/current-state fixtures, and overlays
repository-compatible surveys, survey tools, trays, photos, Stage 4 audits, and
the `250 dm` preferred survey interval. Seed survey/tray records are read-only
fallback data until the first local write creates the corresponding version-1
envelope. Browser services still supply the inherited Stage 3 component
assignments as conservative V2/V3-to-V4 run-migration candidates under
canonical `DDH041` ownership.
Stage 4 must not reseed or overwrite a valid local envelope after restart.

`targetLockStage5Seed` spreads the Stage 4 seed, keeps `DDH041` `ACTIVE` for
completion-review demos, and overlays repository-compatible completion fixtures
for completed `DDH038`, abandoned `DDH039`, and reopened `DDH042`. The
organisation-wide duplicate-active bit remains on `DDH040` so completed
`DDH038` is not an active assignment host. A missing completion envelope
hydrates these fixtures; the first local write persists them and later
hydration does not duplicate seeds.

Handover acceptance first writes a prepared operation envelope. It then writes
the outgoing `CLOSED` shift and incoming `OPEN` shift in one hole-scoped shift
envelope, appends deterministic audit IDs, and marks the operation complete.
Retrying the same operation is idempotent; a prepared operation is resumed on
the next repository read.

Component changes use the same local recovery principle across separate
registry/assignment/audit writes. A prepared operation validates the incoming
component and exact depth, closes the outgoing half-open interval, creates the
incoming interval at the same depth, updates statuses, and appends deterministic
audit data. Hydration resumes incomplete stages. This prevents duplicate local
records but is not a cross-device transaction.

Completed-tray capture and replacement use a media operation record with these
stages:

```text
PENDING → ORIGINAL_SAVED → PREVIEW_SAVED → METADATA_SAVED
        → TRAY_CREATED → COMPLETED
        ↘ FAILED
```

The original and optional preview are written and verified in IndexedDB before
the `Photo` metadata and tray pointer are written to localStorage. Replacement
keeps the previous `primaryPhotoId` active until the new blob and metadata are
available, then appends a `primaryPhotoId` correction and an audit. On
tray-library hydration, `recoverInterruptedOperations` can complete an
interrupted operation when its verified original, photo metadata, and required
tray record exist; otherwise it marks the operation `FAILED` for explicit
retry. This is a compensating protocol across two browser stores, not an atomic
transaction. Survey photographs use IndexedDB plus `Photo` metadata but
currently do not have this staged recovery envelope.

Hole completion uses a staged transaction record with these stages:

```text
REVIEW_CREATED → SNAPSHOT_PERSISTED → COMPONENTS_CLOSED → HOLE_LOCKED
              → TIMELINE_APPENDED → AUDIT_APPENDED → COMPLETED
```

Hydration resumes incomplete stages. The immutable completion snapshot is
written before the hole status becomes locked. Reopen is a separate append-only
history record that returns the hole to `ACTIVE` without mutating prior
snapshots. This recovers single-browser interruptions but is not a cross-device
transaction.

Preview generation is client-only canvas work. Images are limited to `25 MB`;
the longest preview edge is at most `1600 px`; PNG remains PNG; other previews
use JPEG quality `0.82`. Preview failure is non-fatal after the original is
verified, and rendering falls back from preview to original.

## Offline strategy by stage

Stage 5 is local-first only in the narrow sense that runs, shifts, audits,
handover operations, casing, components, assignments, survey/tray metadata,
IndexedDB image blobs, and organisation-scoped completion/reopen records
survive reload in one browser. It does not include a service worker, offline
asset guarantee, backup, SQLite, server replication, or cross-device conflict
handling. Clearing either browser store can leave the other store orphaned.

Stage 7 remains the planned SQLite/sync boundary. Stage 5 exposes
`RunRepository`, `ShiftRepository`, `AuditRepository`, `CasingRepository`,
`ComponentRepository`, `ComponentAssignmentRepository`, `SurveyRepository`,
`SurveyToolRepository`, `TrayRepository`, `PhotoRepository`,
`MediaRepository`, and `CompletionRepository` operations, plus
`HoleMutationGuard` on operational mutators.
`LocalRunRepository` and `LocalCompletionRepository` own browser adapters; UI
components do not call `window.localStorage` directly. A SQLite implementation
can preserve the same domain and form contracts.

## Error and integrity boundaries

- Reject non-decimetre precision instead of silently rounding.
- Keep all formula inputs and outputs as integers.
- Treat persisted browser content as untrusted and validate it with Zod.
- Use optimistic shift versions to reject stale close/accept operations.
- Reject casing/component depth ranges outside their valid bounds and prevent
  overlapping assignments of the same type on a hole.
- Reject survey precision beyond one decimal place; constrain dip to
  `[-900, 900]` tenths and azimuth to `[0, 3599]`, normalising only `3600` to
  zero. Use circular azimuth difference for warnings.
- Treat survey duplicates as confirmable repeat readings with separate IDs and
  timestamps, not updates. Deduplicate depth only when calculating spacing.
- Enforce one positive tray number per hole. Keep warning-only tray range
  anomalies distinct from negative/end-before-start errors.
- Validate and verify local image blobs before activating tray metadata. Never
  remove prior photo metadata as a side effect of replacement.
- Treat component assignments as half-open intervals and require both sides of
  a change to share one exact boundary.
- Block standard activation when the component has an active assignment on
  another known hole.
- Treat unfinished drafts, missing stick-up, and pending rod events as
  transferable work; do not fabricate measurements to close a shift.
- Block completion when any blocking checklist item fails. Require reasoned
  acknowledgement for every failing advisory before `canComplete`.
- Lock `COMPLETED` / `ABANDONED` / `ARCHIVED` holes in repository/use-case
  mutators via `HoleMutationGuard`; never rely on UI routing alone.
- Keep completion snapshots and reopen history append-only; reopen must not
  rewrite a prior snapshot.
- Show recoverable validation errors in the runbook; reserve exceptions for programming failures.
- Do not fabricate authentication or sync status in any prototype stage.

## Deployment and verification

Local pilot verification uses the existing `packages/main` commands:

```text
npm run test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

Focused coverage includes domain maths, repositories, lock enforcement,
recovery, reports, seed continuity, and Playwright suites through
`e2e/pilot-end-to-end.spec.ts` and `e2e/reports.spec.ts`. Responsive checks
cover `360`, `390`, `430`, `768`, and `1024 px` in light/dark mode.
Installation and field checklist live in `docs/local-installation.md` and
`docs/pilot-test-guide.md`. Results and deferred risks are recorded in
`implementation-status.md` and `docs/known-limitations.md`.

## V2 report generation reliability

Report Centre generation is a recoverable, idempotent transaction keyed by
`operationId` + fingerprint. Stages are
`SNAPSHOT_BUILDING` → `SNAPSHOT_SAVED` → `DOCUMENT_GENERATING` →
`DOCUMENT_GENERATED` → `FILE_SAVING` → `FILE_VERIFIED` → `METADATA_SAVED` →
`COMPLETED` / `FAILED`. Metadata is written only after IndexedDB save and
binary format validation (`assertValidReportBlob`). Open PDF creates a
temporary object URL on the user gesture (not before) and revokes it after the
tab can load. Download never offers a zero-byte file. Report currency compares
immutable `sourceVersions` fingerprints; out-of-date reports remain historical
and are never auto-regenerated. The Stage 7A Railway database does not store
report blobs; they remain browser-local.

## PDF Visual Parity v1

The client-side `pdf-lib` adapter now uses shared PDF design tokens and layout
primitives for TargetLock navy/blue branding, surface cards, status colour,
section headings, striped tables and headers/footers. Full-Hole and Hole
Summary page 1 is a dedicated hero with project/client/site/rig context,
recorded collar/grid/direction values, generation attribution, report version,
an eight-card KPI grid and deterministic vector depth-progression and
recovery-by-depth charts. Searchable report text, the existing trajectory
plan/section/3D panels, pagination, signatures, validation and offline
generation remain in the same `pdf-lib` pipeline.

Chart points are presentation projections of `ReportHoleAnalytics.shiftRows`
and `runRows`; they do not recalculate drilling or trajectory domain values.
CSV compatibility lives in the report domain: each report type has an ordered
dataset list, the UI exposes a labelled selector only when multiple datasets
are available, and the generation use case rejects incompatible requests
instead of silently substituting another dataset.

The cover location panel has an optional in-memory static-image asset boundary
for a future map, but this increment supplies only recorded coordinates and
offline vector trajectory context. A real orthophoto/satellite implementation
requires project CRS/EPSG or stored WGS84, provider attribution/licensing,
privacy controls, online fetch and cache policy, and an explicit offline
fallback. Raw mine-grid Easting/Northing values must never be sent to a
geographic satellite API as though they were longitude/latitude.

**Original V1 reliability gap:** generation could complete in repositories while
the UI only showed a transient status line, had no Open PDF path, and verified
storage by size alone — so operators could believe no real PDF was created even
when a blob existed, or accept insufficiently validated files.

## Final pilot audit architecture notes

- UI components must not access localStorage or IndexedDB directly; browser
  services and repositories remain the only persistence boundary.
- Hole mutation guard is repository-level for runs, shifts, casing, components,
  surveys, and trays. Reports and reopen remain intentionally allowed.
- Interrupted handover/component recovery must not mutate a locked hole; stale
  prepared operations are cleared when lock prevents finish.
- Timeline and statistics merge seed and local completed runs by run number to
  avoid double-counting.
- Close Shift supports both handover close and final-shift close for completion.

## Stage 7A controlled-pilot server boundary

Stage 7A adds a deliberately narrow Postgres-backed control plane under
`src/server/pilot`:

- opaque random session and device credentials are held only in Secure,
  HttpOnly, SameSite cookies; PostgreSQL stores HMAC-SHA-256 hashes;
- bcrypt password hashes, session expiry/revocation and account
  `session_version` make disabled/revoked membership effective on the next
  request;
- `COMPANY_ADMIN`, `SUPERVISOR` and `DRILLER` permissions are centralised and
  reused by API and server route boundaries;
- every protected Library/Runbook request resolves membership server-side in
  pilot mode. Setup, complete, reopen, void and correction route segments add
  explicit server permission boundaries;
- registered devices are organisation-scoped and can carry optional
  site/project/rig references. A unique partial index permits one active
  primary registration for an organisation/rig pair;
- work leases serialize acquisition per organisation/resource, expire unless
  heartbeated, support normal release, and require a supervisor takeover reason;
- Stage 7A operation receipts validate organisation/user/device context and
  provide the original idempotent boundary.

`TARGETLOCK_MODE=demo` preserves the existing browser-local operator selector
for development and E2E. Production requires an explicit mode; secure pilot
mode fails closed without PostgreSQL, session secret and exact HTTPS origin.
The optional Basic gate remains only for legacy demo previews and is bypassed
by secure pilot mode.

Stage 7B extends this foundation with the outbox/lease-aware mutation path and
bounded JSON payloads. Stage 7C applies the explicitly registered core subset to
authoritative server tables and provides snapshot/cursor recovery as described
above. This is not a claim that every module is synchronised: casing,
components, surveys, trays, report metadata and all blobs still require later
materialisers or cloud object storage. Conflicts are surfaced for supervisor
review and export-before-discard; automatic merge is intentionally absent.
