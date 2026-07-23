# TargetLock Product Specification

## Product intent

TargetLock is an offline-first runbook for diamond-drilling crews. It gives field users a fast, dependable record of rod movements, stick-up, hole depth, and metres drilled, including when connectivity is poor or unavailable.

Stages 1–6 are a local browser prototype in `packages/main`. Stage 1 proves
drilling calculations and run capture; Stage 2 adds shift ownership, handover,
shared-run continuity, and local audits; Stage 3 adds permanent casing records,
an organisation component registry, exact-depth bit/reamer assignments, and
run-overlap usage statistics; Stage 4 adds simplified manual survey records and
completed-tray photography; Stage 5 adds final-hole completion review, lock,
reopen, and immutable completion snapshots; Stage 6 adds local Report Centre
PDF/Excel/CSV generation, IndexedDB report storage, share/download, and email
draft preparation without SMTP delivery. Authentication and synchronisation
remain later work.

## Users and core workflow

The primary user is a driller or supervisor recording a drilling run at the rig.

1. Open the current hole and confirm the BHA, CSU, rod length, and previous completed depth.
2. Record any rod additions and the current measured stick-up. Stage 1 domain
   history also represents removals; the full remove/correct UI remains later
   work.
3. Review the calculated current rod string (R/S), hole depth, and drilled length.
4. Correct validation errors, add an optional operational note, and complete the run.
5. Resume an unfinished local draft in the same browser.
6. Record casing lifecycle events and bit/reamer changes at exact depths. Runs
   retain the component assignments that owned them when they started.
7. Record a manual survey station, optionally with a result photograph, and
   review survey history without converting references or calculating a
   trajectory.
8. Photograph a completed core tray, retain its labelled depth range, and
   derive related completed runs without changing or splitting those runs.
9. Begin final-hole completion review when drilling is finished, resolve the
   checklist, acknowledge advisories, and lock the hole as completed or
   abandoned; reopen only with an explicit reason.

The interface must clearly distinguish editable observations from calculated values and retain the context needed for a shift handover.

V2 end-of-Shift analytics summarise metres completed, Runs, weighted recovery,
rod activity, and operational counts on Shift close, handover, Shift detail,
Shift history, Current Hole, and Current-Shift reports. Analytics are derived
from repositories (not manually edited). Shared Runs credit the completing
Shift. Closed-Shift amendments after Run corrections preserve the original
close snapshot. Time metrics use elapsed Shift / recorded Run-cycle wording
only — not penetration rate, productive hours, or utilisation.

V2 end-of-Hole analytics provide a repository-backed Hole overview on
`/holes/[holeId]/statistics`, completed-Hole teasers, and Full-Hole / Hole
Summary reports (executive summary, operational analysis tables, chart text
summaries, Excel analytics sheets). Weighted recovery, void exclusion, shared
Run attribution, observed component recovery (with partial-Run labels), and
per-category record completeness apply. Planned-versus-actual trajectories
(Implementation 5) and interactive 3D / report trajectory graphics
(Implementation 6) apply; graphics are presentation-only and not certified
anti-collision software. Payroll, downtime costing, and employee rankings
remain out of scope.

Completed Runs may be corrected or voided only through an audited workflow:
source values are edited, calculated R/S / depth / drilled / recovery remain
derived, original snapshots are retained, impact is previewed before save, and
voided Runs are never physically deleted.

## Stage 1 scope

- A dedicated TargetLock experience for the seeded hole `DDH041`.
- Hole/setup summary, current run entry, calculated results, recent run context, and draft status.
- Integer-decimetre domain arithmetic with metre values displayed to one decimal place.
- Validation for required values, impossible negative results, incompatible rod counts, and completion state.
- Versioned, hole-scoped local browser persistence for unfinished drafts,
  completed run snapshots, and the individual rod events attached to each
  locally completed run.
- Responsive operation on desktop, tablet, and field-sized mobile screens.
- System theme by default, with an explicit dark field mode.
- Reuse of the existing Next.js, React, Tailwind, shadcn/Radix, next-themes, React Hook Form, and Zod stack.

## Stage 2 scope: shift continuity

- Start a Day Shift or Night Shift with an operational `shiftDate`, primary
  driller, lightweight crew, and a captured hole-state snapshot.
- Enforce one active or handover-pending shift per hole. New runs require an
  `OPEN` shift and cannot be anonymous.
- Close a shift to `HANDOVER_PENDING` with ending depth/rod/R/S/stick-up/run
  state, transferable warnings, and an optional handover note.
- Accept handover idempotently, close the outgoing shift, create the incoming
  shift, and inherit the exact saved hole state.
- Keep an unfinished draft as one run. Its original shift/user/time remain the
  start owner; the incoming shift/user/time become the completion owner.
- Group completed runs under the completing shift and visibly identify shared
  runs in runbook, shift detail, and run detail.
- Provide shift history, runbook-focused counts, shift timeline events, and
  immutable local audit entries for shift/run actions.
- Persist shifts, handover operations, audits, drafts, and completed runs in
  hole-scoped, versioned, Zod-validated local repositories.

Shift date is operational, not a midnight rollover. ISO timestamps are stored
internally and local date/time is displayed to the operator.

Core-barrel capacity is unset optional future configuration. It is not part of
Stage 2 readiness and does not create a warning or run-entry block.

## Stage 3 scope: casing and components

- Keep casing as a current string projection backed by immutable install,
  advance, shorten, remove, status, and correction events.
- Use Current Hole and Casing History as the initial-casing entry points. A
  separate Hole Setup page is not introduced.
- Maintain an organisation-scoped registry for bits and reamers, with
  normalised type/serial duplicate checks, lifecycle status, optional equipment
  details, and audited corrections.
- Assign components to one hole over half-open depth intervals
  `[startDepthDm, endDepthDm)`. A standard assignment cannot activate a
  component that is already active in another known hole.
- Change a bit or reamer by atomically closing the outgoing assignment and
  opening the incoming assignment at the same integer-decimetre depth.
  Interrupted local operations are recovered idempotently on hydration.
- Default changes to completed hole depth. A change inside a completed run
  requires explicit confirmation and a comment; it remains one physical run
  and is disclosed through assignment history plus the immutable change audit
  shown on run detail.
- Calculate exact drilled usage and average-recovery statistics from positive
  overlap with deduplicated completed-run intervals. Recovery is exact only
  when every contributing run is fully covered; boundary runs are identified
  as run-level estimates with touched/full/partial counts, without inventing
  partial-run recovered metres.
- Capture active bit/reamer assignment IDs and immutable serial snapshots when
  a run starts, and preserve those values through completion and handover.
- Surface repository-backed casing, active components, operational history,
  and statistics on Current Hole, runbook, run detail, timeline, casing
  history, hole component history, and component detail. Timeline casing and
  component entries come directly from their repositories so one local
  operation is not duplicated by separate seed and audit representations.

## Stage 4 scope: surveys and completed trays

### Simplified surveys

- Record one manual station with depth, dip, azimuth, north reference, optional
  `SurveyTool`, comment, and optional result photograph. Records may be linked
  to the active shift but do not require a run or alter drilling arithmetic.
- Store depth as integer decimetres and dip/azimuth as integer tenths of a
  degree. Dip is `-90.0°` through `+90.0°`; azimuth is `0.0°` through `359.9°`.
  An entered `360.0°` is visibly normalised to `0.0°`.
- Compare azimuth changes around the circle:
  `min(abs(a - b), 3600 - abs(a - b))`. The default warning thresholds are
  `5.0°` for dip and `10.0°` for azimuth.
- Warn, focus the warning summary, and require deliberate confirmation for a
  depth beyond completed drilling, a repeated depth, a large dip/azimuth
  change, or a changed tool/reference. A repeated depth is a legitimate repeat
  reading: `SAVE ANYWAY` appends a second immutable record and never overwrites
  the existing station. Survey spacing statistics deduplicate depths.
- Provide searchable/filterable history, detail, immutable corrections,
  dashboard summary, a preferred-interval reminder, and depth-timeline entries.
- Provide a lightweight organisation survey-tool registry. The add form
  inherits the latest survey's tool and north reference when available,
  otherwise the first active tool and its default reference. The saved survey
  keeps tool name/serial snapshots, so later tool edits or deactivation do not
  rewrite history.

This survey scope intentionally excludes trajectory or deviation modelling,
reference conversion, declination, coordinate calculation, planned-versus-
actual path comparison, multi-shot import/export, telemetry, calibration,
maintenance, certificates, and vendor integrations. The optional photograph is
supporting evidence; the typed station remains the searchable record.

### Completed-tray photography

- Capture or choose one required photograph for a completed tray, with a
  positive whole tray number, optional start/end depths, comment, active-shift
  snapshot, and final-partial marker.
- Suggest the next number from the highest existing tray, inherit the previous
  tray end as the next start, and suggest current completed depth as the end.
  Gaps, overlaps, zero-length ranges, sequence gaps, and depths beyond completed
  drilling are confirmable warnings. Negative depth and end-before-start are
  errors.
- A tray number is unique for the hole. Duplicate capture is not a second tray:
  the operator is directed to the existing tray or the explicit photograph-
  replacement workflow.
- A tray never owns, rewrites, allocates, or splits runs. Related runs are
  derived from positive overlap between tray `[startDepthDm, endDepthDm)` and
  completed/corrected run intervals. Touching boundaries and in-progress runs
  do not count, and recovered metres are not apportioned between trays.
- Keep original and replacement `Photo` metadata. Replacing a photograph
  requires a reason, updates only `primaryPhotoId` after the new media is
  verified, and retains the prior photo plus an immutable before/after
  correction and audit record.

### Local media behavior

- Store original and preview image blobs in IndexedDB
  (`targetlock-runbook-media-v1`) and keep versioned survey, tray, photo,
  correction, operation, and storage-key metadata in localStorage.
- Accept non-empty `image/*` files up to `25 MB`. Generate a preview no larger
  than `1600 px` on either axis; preserve PNG output and encode other previews
  as JPEG at quality `0.82`. If preview generation is unavailable, retain and
  display the verified original.
- Completed-tray create/replace operations progress through `PENDING`,
  `ORIGINAL_SAVED`, `PREVIEW_SAVED`, `METADATA_SAVED`, `TRAY_CREATED`, and
  `COMPLETED`, with `FAILED` recording an operation that needs explicit retry.
  Originals and any stored previews are verified before metadata is activated;
  tray-library hydration can finish an eligible interrupted replacement when
  the verified blob and metadata exist.
- These stages reduce single-browser partial writes but are not one transaction
  across IndexedDB and localStorage. Survey-photo attachment uses the shared
  media repository but does not yet use the tray operation envelope.

### Implemented Stage 4 routes

- `/holes/[holeId]/surveys`, `/surveys/new`, `/surveys/[surveyId]`,
  `/surveys/[surveyId]/correct`, and `/surveys/tools`.
- `/holes/[holeId]/trays`, `/trays/new`, `/trays/[trayId]`,
  `/trays/[trayId]/correct`, and `/trays/[trayId]/replace-photo`.
- Current Hole, More, quick actions, record search, and the depth timeline link
  to repository-backed Stage 4 records.

## Stage 5 scope: final-hole completion

- Advance hole lifecycle through
  `DRAFT` / `ACTIVE` / `SUSPENDED` / `COMPLETION_REVIEW` /
  `COMPLETED` / `ABANDONED` / `ARCHIVED`. Legacy lowercase statuses
  (`planned`, `drilling`, `suspended`, `completed`) normalise at the boundary.
- Begin a completion review from Current Hole / More / Quick Actions. Capture
  disposition (`COMPLETED` or `ABANDONED`), a completion reason, optional
  comment (`OTHER` requires comment), component outcomes, and final-survey
  resolution (recorded survey or documented unavailable).
- Evaluate an `evaluateHoleCompletion` checklist. Blocking failures prevent
  completion; advisory failures require explicit acknowledgement with reason.
- Treat the deepest finished completed-run hole depth as the authoritative
  final depth. Rod-state projection must reconcile to that depth before lock.
- Persist an immutable completion snapshot (depth, runs, rod/casing/component
  summaries, checklist, acknowledgements, actor/time). Completing a hole locks
  mutators for runs, shifts, casing, components, surveys, and trays via
  `HoleMutationGuard` / `HoleLockedError` below the UI.
- Support recoverable staged completion
  `REVIEW_CREATED` → `SNAPSHOT_PERSISTED` → `COMPONENTS_CLOSED` →
  `HOLE_LOCKED` → `TIMELINE_APPENDED` → `AUDIT_APPENDED` → `COMPLETED`.
- Reopen a locked hole to `ACTIVE` with required reason, retained completion
  history, and reopen history. Completed/abandoned/reopened holes appear on
  `/holes/completed`; Current Hole shows a locked or completed-dashboard
  variant when applicable.
- Seed `targetLockStage5Seed`: `DDH041` remains `ACTIVE` for review demos;
  `DDH038` completed; `DDH039` abandoned; `DDH042` reopened with history; the
  organisation-wide duplicate-active bit stays on `DDH040` (not on completed
  `DDH038`).

### Implemented Stage 5 routes

- `/holes/[holeId]/complete` — completion review and lock.
- `/holes/[holeId]/reopen` — reopen a locked hole.
- `/holes/completed` — list/filter completed, abandoned, and reopened holes.
- Current Hole, More, and Quick Actions expose completion and reopen entry
  points; locked holes render a read-only locked panel.

## Authoritative calculation rules

All terms are integer decimetres (`dm`) in the domain model.

- Base R/S = `BHA - constant stick-up`.
- Current R/S = `base R/S + active rod lengths added - rod lengths removed`.
- Hole depth = `current R/S - stick-up`.
- Drilled = `current hole depth - previous completed hole depth`.

Constant stick-up is already excluded from Base R/S and must never be added
again when calculating hole depth. Each physical `3.0 m` or `6.0 m` rod changes
the rod number by exactly one.

Derived values are read-only. A run cannot be completed if constant stick-up
exceeds BHA, a length is not an integer decimetre, current R/S or hole depth is
negative, or drilled length is not positive.

## Acceptance criteria

- The prototype loads with internally consistent `DDH041` data.
- Changing pending additions or stick-up immediately updates all dependent
  values using the authoritative formulas.
- `1 dm` is displayed as `0.1 m`; binary floating-point values are never used for domain calculations.
- Invalid data produces a nearby, actionable message and cannot be marked complete.
- Reloading the same browser restores an unfinished draft. If the draft is
  absent but locally completed runs exist, the next run is rebuilt from the
  latest completed local snapshot rather than reverting to the seed run.
- Keyboard navigation, visible focus, labelled controls, and semantic status messages are supported.
- The TargetLock shell does not depend on or alter the existing dashboard layout.
- Casing and component changes survive refresh in the same browser, retain
  immutable before/after history, and reject invalid depth ranges.
- Surveys and tray capture survive refresh in the same browser. Repeated survey
  depths remain separate records; duplicate tray numbers do not.
- Tray capture does not complete until the original photograph is verified.
  Replacement preserves the previous photo and reason.
- Stage 3–5 pages target `360`, `390`, `430`, `768`, and `1024 px` in light and
  dark modes without horizontal page overflow.
- Completing a hole persists an immutable snapshot, locks operational mutators,
  and survives refresh. Reopen restores `ACTIVE` without rewriting the prior
  completion snapshot.

## V1 exclusions

- Real authentication, permissions, or user administration.
- Server APIs, database/ORM integration, SQLite, replication, or multi-device sync.
- Installable PWA behavior, service-worker caching, or a durable offline database.
- Concurrent multi-device editing, server conflict resolution, approval
  signatures, and audit-grade storage.
- Hardware telemetry, drilling-control integration, and push notifications.
- Production migration and production operations.
- Real SMTP / transactional email delivery, cloud report storage, and
  cross-device report history (local generate/share/draft only).
- Survey trajectory/coordinate calculation; tray image annotation, OCR,
  automatic depth recognition, and recovered-core allocation; payroll, hours,
  delays, and costs.

SQLite and synchronisation are explicitly deferred to Stage 7. Browser
persistence is a prototype convenience behind repository boundaries, not a
claim of production-grade offline durability or offline asset availability.

## Existing product baseline

The repository currently has no database/ORM, real authentication, service
worker, or server sync. Stage 4 uses IndexedDB only for local media blobs and
localStorage for operational metadata; Stage 5 adds an organisation-scoped
completion envelope in localStorage. Neither store is production durability.
TargetLock has focused Vitest coverage, while the
inherited template remains largely untested. Its seven packages are standalone
and duplicate-ish, with no root workspace. TargetLock work is confined to
`packages/main`.

## Stage 6 scope: reports, exports and sharing

Stage 6 delivers local Report Centre workflows:

- Generate Full-Hole, Current-Shift, Hole Summary, Survey History, Tray
  Register, Component History, and Casing History reports as PDF, Excel, and/or
  CSV from repository snapshots (including Stage 5 completion snapshots).
- Store binaries in IndexedDB; keep versioned metadata and Report Activity
  locally.
- Download, share (Web Share / download fallback), and Prepare Email draft with
  saved recipients and a local outbox — without SMTP and without claiming
  delivery.
- Routes: `/holes/[holeId]/reports`, `/holes/[holeId]/reports/history`.

Pilot limitations: no authentication, no server sync, no cloud report storage,
no cross-device report history, browser storage quota, and no physical-device
native-share validation unless performed separately.

## Pilot audit readiness

Stages 1–6 preserve integer-decimetre and integer-tenths arithmetic, circular
azimuth comparison, repeated survey stations, immutable tool/photo/completion
and report snapshots, unsplit runs, derived tray overlap, hole lock/reopen
history, and repository boundaries.

The final integrated pilot audit (2026-07-22) confirmed the local workflow from
open hole through runs, handover, casing, components, surveys, trays, timeline,
completion/lock, reports, download/share honesty, reopen, and refresh
persistence. Field pilot operators should use `docs/pilot-test-guide.md` and
`docs/local-installation.md`. Remaining constraints are listed in
`docs/known-limitations.md`.

Production claims still need authenticated identity, durable transactions,
backup, and synchronisation.
