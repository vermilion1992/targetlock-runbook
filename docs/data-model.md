# TargetLock Data Model

## Canonical units

Every operational domain length is a non-negative, safe integer number of
decimetres:

```ts
type Decimetres = number & { readonly __unit: "Decimetres" };
```

Metres are presentation only. Display with `lengthDm / 10` to one decimal
place. The shared parser accepts a decimal point or comma and harmless trailing
zeroes (`4.30`), but rejects precision that would require rounding (`4.35`).

Identifiers, timestamps, status, and notes are not lengths and retain their natural types.

Survey angles are also integers, but use tenths of a degree rather than the
`Decimetres` brand:

- `dipTenths`: `-900` through `900` (`-90.0°` through `+90.0°`).
- `azimuthTenths`: `0` through `3599` (`0.0°` through `359.9°`).
- An input of `3600` is normalised to `0`; no other out-of-range value is
  wrapped or rounded.

The authoritative angular difference is circular:

```text
absolute = abs(leftTenths - rightTenths) % 3600
azimuth difference = min(absolute, 3600 - absolute)
```

## Core records

### Hole and rod-string configuration

- `Hole` identifies the project, rig, size, plan, current depth, and lifecycle
  state.
- Canonical Stage 5 statuses:
  `DRAFT`, `ACTIVE`, `SUSPENDED`, `COMPLETION_REVIEW`, `COMPLETED`,
  `ABANDONED`, `ARCHIVED`. Legacy lowercase values
  (`planned`, `drilling`, `suspended`, `completed`) remain readable at the
  storage boundary and normalise before lifecycle decisions.
- `COMPLETED`, `ABANDONED`, and `ARCHIVED` are locked statuses.
- `HoleConfiguration` is effective-dated for plan and orientation changes.
- `RodStringConfiguration` stores BHA, constant stick-up, and the calculated
  base R/S as branded decimetres.

Base R/S is derived as `BHA - constant stick-up`.

### Rod event

- Stable local/server identity and sync metadata.
- Hole, optional run, optional shift, and monotonic sequence.
- `action`: `add` or `remove`.
- `rodLength`: exactly `30 dm` or `60 dm`.
- `affectedRodNumber` and `rodNumberAfterEvent`.
- ISO occurrence timestamp and recorder snapshot.

`Run.rodEventIds` links any number of movements to a run. A
`Correction` with `entityType: "rod_event"` represents `CORRECT` without
rewriting or deleting the original movement.

### Run draft

- `localId`: stable idempotency identifier reused when save is retried.
- `holeId`: parent hole.
- `startedShiftId`, `startedByUserId`, and `startedByNameSnapshot`: immutable
  original ownership, retained through a handover.
- `context.runNumber`: monotonic run number.
- `context.rodNumber`, `currentRodStringDm`, and
  `previousCompletedDepthDm`: immutable starting context.
- `startedAt`: ISO timestamp.
- Nullable `activeBitAssignmentId` and `activeReamerAssignmentId`, immutable
  serial-number snapshots, and a casing-summary snapshot captured at run start.
- `pendingRodEvents`: individual local events, never only totals.
- `stickUpMetresInput` and `recoveredMetresInput`: transient presentation
  strings so incomplete typing survives reload.
- condition-tag IDs and comment.

Current R/S, hole depth, drilled length, recovery, and loss/gain are recomputed
from domain inputs while editing.

### Completed local run snapshot

- `startedShiftId`/`startedBy*` and `completedShiftId`/`completedBy*` preserve
  both owners when a run crosses shifts.
- Calculated values use explicit `*Dm` names and remain derived after
  corrections (users edit source fields only).
- Start-time component assignment IDs and serial snapshots are copied unchanged
  into the completed record. A component change within the run does not split
  or rewrite the run.
- Individual rod events are expanded with sequence, affected/resulting rod
  number, and occurrence time.
- `localId` makes identical retries idempotent.
- A second local record with the same run number or conflicting local ID is
  rejected (voided runs do not block reuse of a run number).
- V5 fields: `version`, `status` (`completed` | `corrected` | `void`),
  `correctionIds`, `originalSnapshot` (frozen on first correction/void), and
  void metadata. Envelope collections hold correction records, staged
  operations, and rod-event effective overrides.

### Local draft envelope

- `version`: currently `5`; valid V1–V4 records are migrated on read.
- Legacy component serial snapshots are retained. Assignment IDs are populated
  only when one candidate matches component type, normalised serial, hole, and
  ownership at the run start depth; zero or multiple matches remain null.
- Legacy records without Stage 3 serial fields receive null assignment IDs,
  serial snapshots, and casing summary.
- `savedAt`: ISO timestamp.
- `holeId`: prevents restoring data against the wrong hole.
- `syncStatus`: explicitly `local-only`.
- validated draft or completed-run payload.

Invalid or unsupported data is reported and left unchanged.

### Casing string and event

`CasingString` is the current hole-scoped projection: identity, label, size,
start depth, current end depth, lifecycle status, installation metadata, and
sync metadata. Nested active strings are allowed.

`CasingEvent` is immutable and records `INSTALL`, `ADVANCE`, `SHORTEN`,
`REMOVE`, `STATUS_CHANGE`, or `CORRECT`, the before/after depths or status,
reason, actor, occurrence time, operation ID, and targeted prior event where
applicable. Corrections preserve the original event and previous projection
values. Every range uses integer decimetres and requires
`startDepthDm < endDepthDm`.

### Component registry

`Component` is organisation-scoped and stores type (`BIT` or `REAMER`), display
serial, optional manufacturer/model/size/matrix/supplier/crown-height details,
lifecycle status, notes, correction history, and sync metadata. Duplicate
comparison normalises `(type, serialNumber)` while preserving the entered
display text.

Statuses include `AVAILABLE`, `SERVICEABLE`, `ACTIVE`, `REMOVED`,
`UNDER_INSPECTION`, `RETIRED`, and `LOST_DOWNHOLE`. A lost-downhole removal
sets the matching component status. New records cannot be created directly as
active; activation is owned by an assignment transaction.

### Component assignment

An assignment links one component to one hole and type over a half-open
interval `[startDepthDm, endDepthDm)`. `endDepthDm` is null while active.
Removal reason/comment, actor/time snapshots, operation identity, and
assignment corrections are retained. A standard assignment enforces:

- one active assignment per type on a hole;
- no overlapping intervals for a component or same operational type;
- no active assignment of that component on another known hole;
- exact boundary equality when changing from outgoing to incoming;
- `OTHER` removal requires a comment.

Corrections append before/after values and a required reason rather than
deleting historical ownership.

### Component usage

Usage intersects an assignment interval with deduplicated completed-run
intervals. Only positive overlap contributes drilled or recovered length.
Touched, fully covered, and partially covered run counts are retained.

Average recovery is exact only when every contributing run is fully covered by
the assignment. A boundary run contributes its run-level recovery percentage
weighted by overlapped drilled metres and makes the aggregate status estimated;
partial recovered metres are never invented. Overlapping completed-run
intervals are rejected instead of double-counted.

### Survey tool

`SurveyTool` is an organisation-scoped, lightweight reusable record:

- identity and normal sync metadata;
- name plus optional manufacturer, model, and serial number;
- optional default north reference (`MAGNETIC`, `TRUE`, `GRID`, or
  `NOT_SPECIFIED`);
- `ACTIVE` or `INACTIVE` status; and
- creator ID/name snapshot.

This is selection metadata, not an equipment-maintenance model. Calibration,
service history, certificates, and vendor exports are not represented.

The survey form inherits the latest hole survey's `surveyToolId` and
`northReference` when present. If there is no previous survey, it falls back to
the first active tool and that tool's default reference. Inactive tools remain
historical records but are omitted from new-survey selection.

### Survey

`Survey` is one immutable station identity with mutable current projection and
append-only corrections:

- hole and optional shift identity;
- `depthDm`, `dipTenths`, `azimuthTenths`, and `northReference`;
- optional `surveyToolId`, immutable `toolNameSnapshot`, and immutable
  `toolSerialSnapshot`;
- optional comment and optional result `photoId`;
- recorder ID/name snapshot and ISO `recordedAt`; and
- normal local/server/sync/version metadata.

Tool snapshots are copied at creation. Renaming, deactivating, or editing the
registry tool does not rewrite a prior survey. A survey correction appends one
`SurveyCorrection` per changed field with previous/corrected values, reason,
actor, time, and operation ID; optimistic version checking rejects a stale
form.

Duplicate depth is not a uniqueness violation. It raises a confirmation warning
and a confirmed save creates a separate survey ID/timestamp. History therefore
shows repeated readings, while spacing statistics use unique depths. Ordering
uses depth and then `recordedAt`; "latest" means deepest, then latest at that
depth. The default warning thresholds are `50` tenths for dip and `100` tenths
for circular azimuth change.

Survey depth, angle, reference, tool, and photograph are observations. Survey
records themselves remain unchanged by trajectory selection.

### Hole trajectory (V2 Implementation 5)

Hole-scoped trajectory storage holds:

- `HoleCoordinateConfiguration` — `RELATIVE` or `MINE_GRID`, optional collar
  E/N/RL (dm), calculation north reference;
- `ReferenceConfiguration` — grid rotation and magnetic declination (degrees);
- `PlannedHoleTrajectory` — ordered planned stations (MD, dip tenths, azimuth
  tenths, north reference, station type), draft/active/superseded;
- `HoleTarget` — optional E/N/RL (and radius) separate from planned stations /
  desired attitude;
- `ActualTrajectoryConfiguration` — collar dip/azimuth/reference for Survey path;
- `TrajectorySurveySelection` — one selected Survey ID per duplicate depth;
- optional display-only `TrajectoryTrackingTolerance`.

Calculated trajectories and tracking are derived (not stored as authoritative).

### Completed tray

`Tray` represents a photographed physical completed core tray:

- hole and optional shift identity;
- positive whole `trayNumber`, unique within the hole;
- optional `startDepthDm` and `endDepthDm`;
- optional comment and `isFinalPartial`;
- required active `primaryPhotoId`;
- recorder ID/name snapshot and ISO `recordedAt`; and
- normal local/server/sync/version metadata.

The next suggested number is `max(existing positive tray numbers) + 1`; gaps
are not filled automatically. Suggested start depth is the previous tray's end,
and suggested end depth is current completed hole depth. Depth gaps, overlaps,
zero-length ranges, sequence gaps, starts before the previous tray, and ends
beyond completed depth are confirmable warnings. Negative depths and
`endDepthDm < startDepthDm` are errors. A duplicate number is never saved as a
second tray; the workflow links to the existing tray or its photo replacement.

Tray corrections preserve each previous value and required reason. Runs are
not children of trays and no run IDs are persisted on a tray.

### Photo

`Photo` metadata is stored separately from its image blobs:

- hole, `entityType`/`category` (`TRAY`, `SURVEY`, `COMPONENT`, or `EVENT`),
  and entity ID;
- IndexedDB `originalStorageKey` and optional `previewStorageKey`;
- optional filename, MIME type, byte size, optional preview width/height;
- capture time, optional description, creator snapshots; and
- normal sync/version metadata.

Stage 4 uses `TRAY` and `SURVEY`. Originals and previews are blobs in IndexedDB;
the `Photo` and keys are in the tray localStorage envelope. Originals must be a
non-empty `image/*` no larger than `25 MB`. Generated previews have a maximum
dimension of `1600 px`; PNG is preserved and other formats use JPEG quality
`0.82`. Preview metadata stores the generated preview dimensions.

Photo replacement creates a new `Photo`, changes only the tray's
`primaryPhotoId`, and appends both a `primaryPhotoId` correction and a
`tray_photograph_replaced` audit containing old/new IDs and reason. The old
`Photo` metadata/blob is retained as history.

### Tray media operation

The hole-scoped tray envelope records a stable operation ID, `CREATE` or
`REPLACE`, input fingerprint, tray/photo IDs, optional prior photo ID, storage
keys, error, update time, and one of:

```text
PENDING
ORIGINAL_SAVED
PREVIEW_SAVED
METADATA_SAVED
TRAY_CREATED
COMPLETED
FAILED
```

Retries with the same operation and input are idempotent. Reusing an operation
ID for another file conflicts. Recovery verifies the original blob; it can
finish a replacement when photo metadata and the tray exist, or mark an
incomplete operation `FAILED` when required metadata is absent. There is no
atomic transaction spanning IndexedDB and localStorage.

### Derived tray/run overlap

Related runs are calculated on read, not stored:

```text
positive overlap =
  max(tray.startDepthDm, run.startDepthDm)
    < min(tray.endDepthDm, run.endDepthDm)
```

Only completed/corrected runs participate. In-progress runs, touching
boundaries, missing tray ranges, and non-positive tray ranges return no
overlap. One run can overlap several trays and one tray can overlap several
runs; neither record is split or rewritten. Stage 4 does not apportion
recovered metres to trays.

### Runbook shift

- Lifecycle: `OPEN` → `HANDOVER_PENDING` → `CLOSED`.
- `shiftType`: `DAY` or `NIGHT`.
- `shiftDate`: operational start date; it does not change at midnight.
- Primary-driller and lightweight crew ID/name snapshots.
- ISO `startedAt`, optional `closedAt`, and optional handover-acceptance
  user/name/time.
- Starting and ending snapshots for depth, rod number, current R/S, measured
  stick-up, and run number.
- Optional `handoverRunId`/`handoverRunNumber` references the same unfinished
  draft continued by the incoming shift.
- Optimistic `version` detects stale close and acceptance attempts.
- Optional immutable `closeAnalyticsSnapshot` written once at close (metres,
  recovery, rod activity counts). Not manually editable. Post-close Run
  corrections update derived current analytics only.

### HoleAnalytics (derived, not stored as an editable entity)

Calculated by `calculateHoleAnalytics` from effective Runs, Shift analytics
rollups, component usage, casing, Surveys, and Trays:

- Production: starting / current-or-final / planned depth, total drilled /
  recovered, weighted recovery, loss/gain, Run length stats, void/corrected
  counts.
- Shift rollup: Day/Night counts, avg/median metres, shared Runs, gross metres
  per elapsed Shift hour when timestamps support it.
- Rods, components (observed recovery + partial-Run labels), casing timeline,
  Survey spacing / mixed north-reference warning, Tray coverage.
- Record completeness categories (`Complete` | `Review recommended` |
  `Incomplete` | `Not applicable`) — no combined Hole score.
- Chart datasets: metres by Shift, cumulative depth, recovery by depth, Run
  length, loss/gain, component intervals (each with text summary).
- Optional `completionId` scopes historical analytics after reopen.

### ShiftAnalytics (derived, not stored as an editable entity)

Calculated by `calculateShiftAnalytics` from effective Runs, rod events,
surveys, trays, casing events, component assignments, and corrections:

- Metres completed = ending completed depth − starting completed depth.
- Completed / shared / voided / corrected Run counts; average, median, shortest,
  longest positive drilled lengths.
- Weighted recovery tenths; total core loss and gain.
- Rod activity: 3.0 m / 6.0 m adds, removals, start/end rod number and R/S.
- Operational counts attributable to the Shift ID.
- Optional elapsed minutes and gross metres per elapsed Shift hour; recorded
  Run-cycle average/median when timestamps are trustworthy.
- `unresolvedItems` for handover (unfinished Run, survey interval, active bit,
  etc.) — only when a real issue exists.

Only one `OPEN` or `HANDOVER_PENDING` shift may exist for a hole in a shift
envelope.

### Audit entry

Audit entries are immutable and hole-scoped. Each entry records operation ID,
entity type/ID, hole, optional shift, acting user ID/name snapshot, ISO
timestamp, optional captured depth, reason, before/after values, and JSON
metadata. Deterministic IDs make acceptance and component-change recovery
idempotent.

### Handover operation

One prepared operation envelope stores the operation ID, outgoing shift,
expected version, fully built incoming shift, actor, and acceptance time. The
shift-envelope write is atomic within localStorage. `PREPARED` operations are
resumed; `COMPLETE` operations return the existing result without duplicating
the incoming shift or audit entries.

### Hole completion review

`HoleCompletionReview` is the in-progress finalisation record:

- hole identity and review status
  (`DRAFT`, `BLOCKED`, `READY`, `COMPLETING`, `COMPLETED`, `CANCELLED`);
- disposition `COMPLETED` or `ABANDONED`;
- completion reason from the Stage 5 reason set
  (`PLANNED_DEPTH_REACHED`, `TARGET_INTERSECTED`, `CLIENT_STOPPED`,
  `HOLE_ABANDONED`, `GROUND_CONDITIONS`, `EXCESSIVE_DEVIATION`, `RODS_STUCK`,
  `EQUIPMENT_LOST`, `EQUIPMENT_LIMITATION`, `DAUGHTER_HOLE_COMMENCED`,
  `OTHER`);
- optional comment (`OTHER` requires text);
- final-survey resolution (`RECORDED` + survey ID, or `UNAVAILABLE` + reason);
- checklist results, component outcomes, and warning acknowledgements; and
- starter ID/name snapshot and start time.

`evaluateHoleCompletion` classifies each check as `BLOCKING` or `ADVISORY`.
Completion requires zero blocking failures and an acknowledgement (with reason)
for every failing advisory. Authoritative final depth is the deepest finished
completed-run hole depth; `FINAL_DEPTH_RECONCILED` requires that rod-state
projection match that depth.

### Hole completion record and snapshot

`HoleCompletionRecord` is append-only. Its immutable `HoleCompletionSnapshot`
captures project/rig name snapshots, final status/depth/run number, run IDs,
rod and stick-up state, casing/bit/reamer summaries, survey/tray counts,
drilled/recovered totals, reason/comment, checklist, component outcomes,
acknowledgements, actor, and capture time. Reopen never rewrites this snapshot.

### Hole reopen record

`HoleReopenRecord` links a prior completion record, previous locked status,
reopened `ACTIVE` status, required reason, optional comment, actor/time, and
operation ID. Reopen history is retained for list/filter and Current Hole
context.

### Completion transaction

Organisation-scoped completion envelopes record recoverable stages:

```text
REVIEW_CREATED
SNAPSHOT_PERSISTED
COMPONENTS_CLOSED
HOLE_LOCKED
TIMELINE_APPENDED
AUDIT_APPENDED
COMPLETED
```

Retries with the same operation ID are idempotent. Hydration resumes incomplete
stages. This is single-browser recovery, not a cross-device transaction.

## Authoritative derivations

```text
base R/S = BHA - CSU
current R/S = base R/S + active 3.0 m and 6.0 m rods - removed rods
hole depth = current R/S - stick-up
drilled = current hole depth - previous completed hole depth
rod number = physical rod additions - physical rod removals
```

Rod number is event-based and is never derived by dividing a length. A `3.0 m` rod and a `6.0 m` rod each change the rod number by one. Runs without a rod event leave both rod number and current R/S unchanged.

## Stage 1 `DDH041` seed

The seed uses a mixed string of `3.0 m` (`30 dm`) and `6.0 m` (`60 dm`) rods:

- BHA: `43 dm` (`4.3 m`).
- CSU: `18 dm` (`1.8 m`).
- Base R/S: `25 dm` (`2.5 m`).
- Active rod number: `112`.
- Current R/S before and during run 220: `6625 dm` (`662.5 m`).
- Previous completed hole depth: `6586 dm` (`658.6 m`).
- Run 220 rod movements: none.
- Current stick-up: `10 dm` (`1.0 m`).
- Current hole depth: `6615 dm` (`661.5 m`).
- Drilled this run: `29 dm` (`2.9 m`).

The consistency checks are:

```text
43 - 18 = 25 dm base R/S
(108 × 60 dm) + (4 × 30 dm) = 6600 dm across 112 rods
25 + 6600 = 6625 dm current R/S
run 220 has no rod event, so rod number remains 112
6625 - 10 = 6615 dm hole depth
6615 - 6586 = 29 dm drilled
```

This replaces the inconsistent `Rod 87 / R/S 662.5 m` example with the mathematically valid mixed-string value `Rod 112 / R/S 662.5 m`.

## Stage 2 `DDH041` continuity seed

- Day Shift on `2026-07-21`, primary driller M. Hoffman, starts at `6268 dm`
  and completes runs 221–232 at `6615 dm`.
- Run 233 starts on Day Shift and completes on Night Shift under J. Smith.
- Night Shift owns completed runs 233–245.
- Mixed `30 dm` and `60 dm` rod events preserve event-based rod numbering.
- Final fixture state is rod 118, current R/S `6985 dm`, measured stick-up
  `1 dm`, and hole depth `6984 dm`.
- An unfinished run-246 draft fixture preserves Night Shift ownership and a
  pending `30 dm` rod event.

No barrel-capacity value is stored or inferred.

## Stage 3 casing and component seed

- The Stage 2-compatible browser scope is `DDH041`; legacy
  `hole-ddh041` foreign keys are mapped explicitly during bootstrap.
- PQ and HQ casing strings include immutable install/advance history.
- Historical and active bits/reamers cover the seeded completed-run intervals.
- Available bit and reamer records support incoming changes.
- One active bit assignment on another hole demonstrates organisation-wide
  duplicate-active protection.
- Runs retain assignment IDs and serial snapshots for their start-time
  component owners.

## Stage 4 survey, tray, and media seed

- `targetLockStage4Seed` spreads the Stage 3 seed rather than replacing its
  hole, run, shift, casing, component, and assignment identities.
- The latest Stage 2 hole configuration is copied with
  `preferredSurveyIntervalDm: 250` (`25.0 m`).
- Two active Briggs survey tools and four DDH041 survey stations seed tool
  inheritance, history, a photograph, and a corrected station.
- Trays 109–111 seed contiguous completed-tray ranges and bundled local image
  metadata. A Stage 4 replacement audit demonstrates old/new photo identity.
- Bundled seed media uses `bundled:` storage keys; user-captured media uses
  IndexedDB keys.
- A missing survey/tray localStorage envelope reads these deterministic seeds.
  The first local write persists the seeded records plus the new record.
  Subsequent hydration reads the local envelope and does not duplicate seeds.
- Stage 4 does not change run schema V4. Existing V1–V3 run records continue
  through the Stage 3 migration path, using inherited Stage 3 component
  assignment candidates only when the match is unambiguous.

## Stage 5 completion seed

- `targetLockStage5Seed` spreads the Stage 4 seed and overlays
  `stage5CompletionSeed`.
- `DDH041` remains `ACTIVE` for completion-review demos.
- `DDH038` is seeded `COMPLETED` with an immutable snapshot
  (`PLANNED_DEPTH_REACHED`).
- `DDH039` is seeded `ABANDONED` (`HOLE_ABANDONED`).
- `DDH042` is seeded with a prior completion plus reopen history and current
  status `ACTIVE`.
- The organisation-wide duplicate-active bit assignment remains on `DDH040`.
  Completed `DDH038` must not host an active assignment fixture.
- A missing completion envelope hydrates these records; the first local write
  persists them and later hydration does not duplicate seeds.

## Stage 6 report records

- `ReportSnapshot` is immutable: hole/shift ids, report type, generator actor,
  hole-depth/status snapshots, source versions, `documentData`, `operationId`,
  and report version.
- `GeneratedReportRecord` stores metadata only (filename, mime, storage key,
  size, activity status). Binaries live in IndexedDB
  `targetlock-runbook-reports-v1` via `ReportFileRepository`.
- Generation stages (V2 reliability transaction):
  `SNAPSHOT_BUILDING` → `SNAPSHOT_SAVED` → `DOCUMENT_GENERATING` →
  `DOCUMENT_GENERATED` → `FILE_SAVING` → `FILE_VERIFIED` →
  `METADATA_SAVED` → `COMPLETED` / `FAILED`.
  Legacy `FILE_SAVED` may still appear when resuming V1 envelopes and is
  treated as needing verification before metadata save.
- A report is not marked `GENERATED` until the binary Blob exists, size > 0,
  is stored in IndexedDB, can be retrieved, and passes format validation
  (PDF `%PDF-` + EOF, XLSX ZIP signature, UTF-8 CSV).
- `sourceVersions` fingerprint relevant operational entities (runs, rod events,
  shifts, casing, component assignments, surveys, trays, corrections,
  completion/reopen). Currency compares the immutable snapshot fingerprint to
  the current repository; out-of-date reports stay historical and are never
  overwritten.
- `SavedReportRecipient` scopes: `ORGANISATION` | `PROJECT` | `HOLE`.
- `ReportOutboxItem` tracks draft/share intent with
  `DRAFT` | `READY_TO_SHARE` | `SHARED` | `QUEUED_FOR_FUTURE_PROVIDER` |
  `FAILED` | `CANCELLED` — never email delivery.
- Legacy Stage 1 `SentReport` seed remains unused by Report Centre.
- Spreadsheet/CSV exports escape formula-like user text (`=`, `+`, `-`, `@`).
- Audits record snapshot/generate/download/share/open/draft events without
  binary payloads or credentials.

## Validation invariants

- All length values are integers.
- BHA and CSU are non-negative, and BHA is not less than CSU.
- Additions and removals are non-negative.
- Current R/S, stick-up, hole depth, and drilled length cannot be negative for a completed run.
- Every movement is exactly one supported physical rod, so a `3.0 m` or `6.0 m`
  event changes rod number by one.
- A complete run requires all observations and a valid timestamp; notes remain optional.
- Derived values are recomputed from authoritative inputs after draft restore.
- Run creation/completion requires an `OPEN` shift.
- A shared run has one stable run ID/number and different non-null start and
  completion shift IDs; it must never be duplicated into two shift records.
- Casing and component lengths are integer decimetres with positive ranges.
- Component assignment intervals are half-open; an active interval has no end.
- A change closes and opens assignments at the same depth and operation ID.
- Usage consumes deduplicated, non-overlapping completed-run intervals only.
- Survey depths are integer decimetres; survey angles are integer tenths.
- Survey dip is `[-900, 900]`; stored azimuth is `[0, 3599]`; only entered
  `3600` normalises to zero.
- Azimuth warning differences are circular across north.
- Repeated survey depths are separate records and do not replace one another.
- Survey tool name/serial snapshots do not follow later registry changes.
- Tray numbers are positive and unique per hole. A tray always has one active
  `primaryPhotoId`; replacement retains the previous photo.
- Tray/run relationships are derived from positive completed-run overlap.
  Physical runs are never split or assigned recovered metres by tray.
- Tray activation follows verified original storage. Local media recovery is
  idempotent but not a cross-store or cross-device transaction.
- Hole statuses normalise legacy lowercase values before lock or completion
  decisions.
- Authoritative final depth is the deepest finished completed-run depth and
  must reconcile with rod-state projection before completion.
- Blocking checklist failures prevent completion; advisory failures require
  reasoned acknowledgement.
- Completion snapshots and reopen history are append-only. Locked statuses
  reject operational mutators via `HoleLockedError`.
- Seed rod-event sequences must remain chronological across stage extensions.
  Stage 2 Night additions continue from Stage 1 rod 112; Day Stage 2 rod events
  are not duplicated on top of Stage 1 history.
- Report statistics loss/gain sum per-run variance (same rule as hole
  completion), not a single net hole drilled−recovered pair.
- Search indexes hole-scoped runs, shifts, casing, component assignments,
  surveys, trays, completion records, and generated reports from repositories.
