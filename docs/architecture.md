# TargetLock Architecture

## Repository boundary

`packages/main` is the sole TargetLock target. The repository contains seven standalone, duplicate-ish packages and no root workspace, so TargetLock must not introduce cross-package imports, root orchestration, or parallel implementations.

The existing application baseline is:

- Next.js 16 App Router and React 19.
- TypeScript with strict mode enabled.
- Tailwind CSS v4 using CSS-first configuration.
- shadcn-style components backed by Radix primitives.
- `next-themes`, React Hook Form, and Zod.
- No server database/ORM, real authentication, or PWA/service-worker offline
  database. Stage 4 uses IndexedDB for local media blobs; Stage 5 adds
  organisation-scoped completion metadata in localStorage; Stage 6 adds a
  separate IndexedDB database for report binaries plus a reports metadata
  envelope. Focused Vitest and Playwright coverage is configured for TargetLock.

## Application shape

TargetLock should live as a feature slice inside `packages/main`, exposed by an App Router route and wrapped in an isolated `RunbookLayout`. The root layout may continue to provide global CSS, fonts, theme, and toast infrastructure, but the feature must not inherit the dashboard navigation or dashboard-specific state.

The implemented feature boundary is:

```text
src/
  app/(RunbookLayout)/holes/[holeId]/
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
    more/                  implemented navigation including reports
  app/(RunbookLayout)/holes/completed/
    page.tsx               completed/abandoned/reopened hole list
  app/(RunbookLayout)/components/
    page.tsx               organisation component registry
    new/                   fast component creation
    [componentId]/         registry correction, assignment history, usage
  components/
    app-shell/             isolated shell and theme controls
    casing/                casing history/forms/detail/support
    components/            registry/assignment/change/detail/support
    field/                 shared field controls and states
    holes/                 dashboard, completion review, reopen, locked panel
    media/                 camera/file input and local-media rendering
    navigation/            phone and tablet navigation
    reports/               Report Centre and Report Activity UI
    runs/                  Record Run client workflow
    shifts/                start/close/handover/history/detail workflows
    surveys/               record/history/detail/correction/tool workflows
    trays/                 capture/library/detail/correction/replacement
  application/runbook/     UI-independent run, shift, casing/component,
                           and hole-completion use cases plus mutation guard
  application/reports/     snapshot builder, generate/share/email use cases
  domain/                  units, formulas, models, invariants, completion,
                           reports
  infrastructure/
    casing/                versioned string projection and immutable events
    components/            organisation registry, assignments, recovery
    completion/            org-scoped completion envelope, lock, reopen
    drafts/                repository, schema migration, storage adapter
    media/                 IndexedDB blobs, previews, verification
    reports/               PDF/Excel/CSV adapters, file + metadata repos, share
    shifts/                versioned shift repository and operation recovery
    surveys/               versioned survey/tool metadata repository
    trays/                 tray/photo metadata and media operation recovery
    audit/                 immutable hole-scoped audit appends
    seed/                  cumulative DDH041 Stage 1–5 fixtures
```

Domain calculations do not depend on React or browser storage.

## Runtime and data flow

1. The route renders the TargetLock shell and stable seed context.
2. Client-side form controls collect observations through React state and
   React Hook Form where the existing workflow uses it.
3. Zod validates input at the boundary and normalises display metres into integer decimetres.
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
9. Shift use cases capture start/end snapshots and append audit records without
   changing drilling arithmetic.
10. Casing use cases append immutable events and update the current projection.
    Component use cases transact an outgoing assignment close and incoming
    assignment open at one exact depth.
11. The operational timeline reads casing events, component assignments,
    surveys, and trays from their repositories. Audits supply shift events and
    Stage 4 correction/replacement events, preventing create-event duplicates
    after local changes.
12. Run detail renders start-time component/casing snapshots from the run and
    reconstructs within-run change disclosure from immutable component-change
    audits rather than mutable current assignment projections.
13. `LocalSurveyRepository` stores organisation-scoped tool records, hole-
    scoped surveys, immutable corrections, and idempotent operation IDs in one
    version-1 localStorage envelope. Survey creation copies the selected tool
    name and serial into the survey.
14. Survey input parses depth to integer decimetres and angles to integer
    tenths. Warning assessment uses circular azimuth difference, allows a
    deliberately confirmed repeated depth as a new record, and never performs
    a trajectory or north-reference conversion.
15. `LocalTrayRepository` stores hole-scoped tray, photo metadata, corrections,
    and operation stages in localStorage. `IndexedDbMediaRepository` stores the
    original/preview blobs separately. A tray is activated only after its
    original is saved and verified.
16. Tray detail derives related completed runs by positive interval overlap
    from seed plus local completions. It does not persist run IDs on the tray,
    split a run, include an in-progress run, or allocate run recovery.
17. Current Hole merges survey/tray repositories into latest-survey, interval-
    reminder, and latest-tray summaries. The timeline reads survey/tray
    records directly and correction/replacement audits separately.
18. `LocalCompletionRepository` stores organisation-scoped hole statuses,
    reviews, immutable completion snapshots, reopen history, and staged
    completion transactions in a version-1 Zod envelope. Legacy hole statuses
    normalise before lifecycle decisions.
19. `evaluateHoleCompletion` produces blocking versus advisory checklist
    results. Authoritative final depth is the deepest finished completed-run
    depth; rod projection must reconcile before lock.
20. Completion use cases progress
    `REVIEW_CREATED` → `SNAPSHOT_PERSISTED` → `COMPONENTS_CLOSED` →
    `HOLE_LOCKED` → `TIMELINE_APPENDED` → `AUDIT_APPENDED` → `COMPLETED`,
    with hydration recovery for interrupted stages.
21. `HoleMutationGuard` wraps run/shift/casing/component/survey/tray mutators
    and throws `HoleLockedError` for `COMPLETED` / `ABANDONED` / `ARCHIVED`
    holes. Lock enforcement lives below the UI so route omission cannot bypass
    it. Reopen restores `ACTIVE` and appends reopen history without rewriting
    prior snapshots.
22. Current Hole reads completion lifecycle for locked/completed dashboard
    variants. Browser services wire Stage 5 seed, completion repository, and
    the mutation guard.

Browser APIs must remain behind client boundaries. Seed data and pure calculations should be importable without `window`, allowing later verification and replacement of persistence without rewriting the UI.

## State ownership

- **Seed state:** immutable, realistic `DDH041` fixture.
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
- **Media state:** original/preview blobs in IndexedDB; `Photo` metadata and
  storage keys in the tray localStorage envelope.
- **Completion state:** organisation-scoped hole status, active review,
  immutable completion snapshots, reopen history, and recoverable transaction
  stage. Locked statuses block operational mutators.
- **Derived state:** calculated on demand; never persisted as authoritative input.
- **View state:** panel expansion, active field, theme choice, and transient messages.

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
assignments as conservative V2/V3-to-V4 run-migration candidates, including the
legacy `hole-ddh041` handling already performed by the Stage 3 bootstrap.
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
and are never auto-regenerated. Railway still hosts code only — report blobs
remain browser-local.

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
