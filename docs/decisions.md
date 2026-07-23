# TargetLock Architecture Decisions

## ADR-001: Select `packages/main`

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** The repository has seven standalone, duplicate-ish packages and no root workspace. Building TargetLock in more than one package would create ambiguity and divergent implementations.

**Decision:** `packages/main` is the sole TargetLock implementation target. Do not add a root workspace or cross-package dependencies for Stage 1.

**Consequences:** Existing package boundaries remain intact. TargetLock commands and dependencies are managed from `packages/main`, and no duplicate feature is created elsewhere.

## ADR-002: Use an isolated `RunbookLayout`

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** TargetLock is a focused field workflow, while the existing dashboard shell contains unrelated navigation and state.

**Decision:** Render TargetLock inside a dedicated `RunbookLayout`. It may consume root-level global CSS, font, theme, and toast providers but must not depend on the dashboard layout.

**Consequences:** The field experience stays compact and purpose-built, existing dashboard behavior is preserved, and TargetLock can evolve without coupling to admin navigation.

## ADR-003: Store lengths as integer decimetres

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Runbook measurements require one-decimal-metre precision. Floating-point metre arithmetic can introduce equality and display errors in authoritative calculations.

**Decision:** Store and calculate every length as an integer number of decimetres. Convert to and from one-decimal metres only at input/output boundaries, rejecting unsupported precision rather than rounding silently.

**Consequences:** Formula results are deterministic and easy to validate. Domain types and persisted drafts use `dm`, while the interface consistently displays `m`.

## ADR-004: Reuse the existing application libraries

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** `packages/main` already provides Next.js 16 App Router, React 19, strict TypeScript, Tailwind v4 CSS-first styling, shadcn/Radix primitives, `next-themes`, React Hook Form, and Zod.

**Decision:** Build Stage 1 with those libraries and conventions. Add no replacement form, schema, component, styling, or theme framework.

**Consequences:** The implementation remains compatible with the package and avoids unnecessary bundle and maintenance cost. Domain formulas remain framework-independent.

## ADR-005: Default to system theme with dark field mode

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Field use spans bright daylight and low-light environments, and the existing application already supports class-based themes through `next-themes`.

**Decision:** Follow the system theme by default and allow explicit light, dark, and system selection. Treat dark mode as the low-glare field presentation while preserving contrast, focus, and semantic status.

**Consequences:** TargetLock respects device preference without removing operator control. Components must be reviewed in both light and dark conditions.

## ADR-006: Use local-only Stage 1 draft persistence

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Stage 1 needs draft continuity for a browser prototype, but the repository has no database/ORM, PWA/offline database, authentication, or sync foundation.

**Decision:** Save a versioned, Zod-validated unfinished draft in local browser storage behind a small persistence adapter. Do not represent it as synced or production-durable.

**Consequences:** A draft can survive reload in the same browser. Clearing browser data loses it, there is no cross-device availability or conflict resolution, and SQLite/sync remain deferred to Stage 7.

## ADR-007: Correct the `Rod 87 / R/S 662.5 m` example

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** With a `4.3 m` BHA and `1.8 m` CSU, the base R/S is `2.5 m`. An R/S of `662.5 m` requires `660.0 m` of active rods, which cannot correspond to rod 87 when every physical rod is either `3.0 m` or `6.0 m`.

**Decision:** Use rod count 112 with a mathematically consistent mixed string:

```text
BHA - CSU = 4.3 - 1.8 = 2.5 m
(108 × 6.0 m) + (4 × 3.0 m) = 660.0 m
Base R/S 2.5 m + active rods 660.0 m = Current R/S 662.5 m
Rod number = 108 + 4 = 112
```

The `DDH041` seed can represent the latest change as previous rod 111/R/S `659.5 m`, followed by one `3.0 m` rod to reach rod 112/R/S `662.5 m`.

**Consequences:** The seed and UI examples satisfy the documented formula and whole-rod invariant. Rod 87 must not be retained as cosmetic seed text.

## ADR-008: Add focused verification tooling

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** The selected package had no test runner or ESLint configuration, and its `next lint` script is not supported by Next.js 16. The inherited demo tree also contains extensive pre-existing lint violations unrelated to TargetLock.

**Decision:** Add Vitest, strict `typecheck`, and a Next-aligned ESLint flat configuration. `npm run lint` checks the TargetLock route group, components, domain, infrastructure, root layout, and Vitest configuration; `npm run lint:all` remains available to expose inherited template debt.

**Consequences:** Stage 1 has deterministic, passing quality gates without turning the implementation into a template-wide cleanup. Legacy lint debt remains explicit in `docs/implementation-status.md`.

## ADR-009: Make the seeded field prototype the default entry

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** The original `/` route opened a generic admin dashboard, while Stage 1 must demonstrate the field workflow without backend setup.

**Decision:** Redirect `/` to `/holes/DDH041/current`. Keep the original template’s other routes and components intact for reference.

**Consequences:** Running `packages/main` opens the TargetLock prototype immediately. No existing demo feature is deleted, but the generic dashboard is no longer the default landing page.

## ADR-010: Harden local run persistence behind a repository

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** The original Stage 1 draft functions could append completed
snapshots, but the working form did not recover from those snapshots when the
next draft was absent. Reopening the seed run could then create a duplicate run
number. Saved rod additions also lacked stable event identity and physical rod
position.

**Decision:** Introduce `RunRepository`, use schema V2 with V1 read migration,
keep drafts and completed runs hole-scoped and separate, make completed saves
idempotent, reject conflicting IDs/run numbers, and persist each rod movement
with identity, sequence, affected rod number, resulting rod number, and
timestamp. If no draft exists, prepare the next run from the latest completed
local snapshot.

**Consequences:** Refresh and browser restart preserve the local run chain
without reverting to seed totals. SQLite/sync can replace the browser adapter
without changing the form contract. Browser storage remains prototype
persistence and does not provide transactions across keys or offline assets.

## ADR-011: Represent rod corrections without rewriting history

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Future rod history needs `ADD`, `REMOVE`, and `CORRECT`, while
inventory calculations must consume only physical movements.

**Decision:** Rod events remain immutable `add`/`remove` movements.
`Run.rodEventIds` preserves the ordered relationship, and `Correction` accepts
`entityType: "rod_event"` to target a prior event. Corrections do not masquerade
as physical movements.

**Consequences:** Existing rod-string calculations remain simple and
authoritative. Audit history can preserve both the original event and its
correction without replacing the Stage 1 run model.

## ADR-012: Apply targeted dependency security updates

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** The inherited package reported vulnerable direct dependencies,
including the Next.js runtime used by TargetLock. Broad forced remediation
would introduce unrelated major upgrades.

**Decision:** Update the same-major/same-contract direct packages `next`,
`eslint-config-next`, `@casl/ability`, `dompurify`, `lodash`, and `uuid` to
patched releases. Do not force-upgrade `jspdf`, `swiper`, or
`react-syntax-highlighter` during the Stage 1 audit.

**Consequences:** TargetLock no longer runs on the audited vulnerable Next.js
version. Remaining advisories are isolated to inherited demo dependencies or
require separately tested major upgrades and remain documented.

## ADR-013: Constrain the inherited code-preview API

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** The inherited `/api/code` development helper joined an
untrusted query parameter to `process.cwd()` and synchronously returned that
file. A deployed caller could request files outside the intended demo source
tree. The unconstrained filesystem expression also caused Next.js output
tracing to include unexpected project files.

**Decision:** Retain the helper only for inherited chart previews, restrict
reads to `.ts`, `.tsx`, and `.css` files below
`src/app/components/charts`, reject path traversal and unsupported extensions,
and return explicit `400`, `403`, and `404` responses. Include this route in the
scoped lint and unit-test boundaries.

**Consequences:** The arbitrary-file-read vulnerability and broad tracing
warning are removed without expanding TargetLock scope into a full demo
cleanup. The inherited routes still must be removed or isolated before a
production TargetLock deployment.

## ADR-014: Defer core-barrel capacity as optional configuration

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** No authoritative capacity is supplied by the Stage 1 seed or
operational configuration. Inventing a limit would create a false safety rule.

**Decision:** Remove barrel capacity from the Stage 2 readiness gate. Keep it
unset optional future configuration and add no warning or run-entry block.

**Consequences:** Stage 2 can ship without fabricated drilling constraints. A
later capacity feature requires an authoritative source, effective dating, and
separate unit/browser acceptance criteria.

## ADR-015: Use an operational shift date and one active shift per hole

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Night Shift crosses midnight, so calendar rollover cannot change
the operational shift date. Parallel active shifts would make run ownership
ambiguous.

**Decision:** Capture `shiftDate` when the shift begins and retain it across
midnight. Store ISO timestamps for ordering, display local date/time, and make
`ShiftRepository` reject a second `OPEN` or `HANDOVER_PENDING` shift.

**Consequences:** History groups remain operationally meaningful and run
creation has one unambiguous owner.

## ADR-016: Preserve start and completion ownership on one run

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** A legitimate run may start before handover and finish after it.
Duplicating the run or overwriting the starting owner would break continuity.

**Decision:** Run schema V3 stores `startedShiftId`/`startedBy*`/`startedAt`
separately from `completedShiftId`/`completedBy*`/`completedAt`. The same draft
ID and run number continue under the incoming shift.

**Consequences:** Shared attribution is explicit, run numbering remains
continuous, and the runbook groups the one record under its completing shift.
Valid V1/V2 local records migrate with visible legacy ownership snapshots.

## ADR-017: Make local handover acceptance recoverable and idempotent

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** localStorage has atomic single-key writes but no transaction across
shift and audit keys. Refresh or duplicate taps must not create two incoming
shifts.

**Decision:** Write a prepared operation envelope with a stable operation ID,
then atomically replace the hole's shift envelope, append deterministic audit
IDs, and mark the operation complete. Resume `PREPARED` operations and return
the existing result for repeated IDs.

**Consequences:** Single-browser interruptions are recoverable and duplicate
acceptance is safe. This is not cross-device concurrency control; a server
revision/transaction model remains required for synchronisation.

## ADR-018: Use the selected driller as the local acting user

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Stage 2 requires user attribution but authentication and employee
management are excluded.

**Decision:** Use the selected primary/incoming driller as the local acting
user and persist both ID and display-name snapshot.

**Consequences:** Shift/run/audit records are attributable without pretending
that authentication exists. Server identity verification remains a later
prerequisite.

## ADR-019: Model casing as a projection over immutable events

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Operators need the current nested casing state quickly, while
advance, shortening, removal, status changes, and corrections must remain
auditable.

**Decision:** Store a hole-scoped `CasingString` current projection and append
immutable `CasingEvent` records for every lifecycle operation. Corrections
retain before/after values and target history rather than replacing it. All
depths are integer decimetres and operations are idempotent by operation ID.

**Consequences:** Current Hole and casing history can load directly without
replaying every event, while the original record remains visible. A future
server repository must update projection and event transactionally.

## ADR-020: Use half-open exact-depth component assignments

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Bit and reamer ownership must be unambiguous at a change boundary
and must support overlap with completed runs without double-counting.

**Decision:** Represent assignments as `[startDepthDm, endDepthDm)`, with null
end for the active assignment. A change closes the outgoing and opens the
incoming assignment at the same exact integer-decimetre depth. A within-run
change remains one run and is disclosed through assignment history plus the
immutable component-change audit on run detail.

**Consequences:** Adjacent assignments do not overlap at their shared boundary,
usage arithmetic is deterministic, and run records are not fabricated or
split.

## ADR-021: Make component changes recoverable across local stores

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Component changes update assignments, registry statuses, and audit
history, while localStorage cannot transact across keys. Refresh or duplicate
taps must not leave two active components or duplicate history.

**Decision:** Persist a prepared operation envelope with a stable operation ID,
apply validated outgoing/incoming assignment and status stages idempotently,
append deterministic audit data, and resume incomplete operations during
repository hydration.

**Consequences:** Single-browser interruption and retry are safe. This does not
provide cross-device serialisation; Stage 7 requires server revisions or a
transactional sync model.

## ADR-022: Enforce duplicate-active components at organisation scope

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** A bit or reamer physically cannot be active in two holes. A
hole-only store would miss known assignments elsewhere.

**Decision:** Keep the component registry and assignment envelope
organisation-scoped, normalise `(type, serial)` for comparison, preserve the
display serial, and block standard activation when any known other hole has an
active assignment. Keep active options visible in the change UI so the warning
is explicit.

**Consequences:** All records in one browser participate in duplicate
protection. Unsynchronised devices remain a documented limitation.

## ADR-023: Reuse casing services instead of adding Hole Setup

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** Stage 3 requires initial casing entry but does not otherwise need a
new Hole Setup/Edit workflow.

**Decision:** Provide `Add Casing` from Current Hole and Casing History. Keep
validation and persistence in reusable casing application services so a future
Hole Setup/Edit page can call the same methods.

**Consequences:** Stage 3 gains the required operational entry points without a
single-purpose route or duplicated domain logic.

## ADR-024: Resolve migrated assignment IDs conservatively

- **Date:** 2026-07-21
- **Status:** Accepted

**Context:** A legacy run may retain a bit or reamer serial snapshot without a
Stage 3 assignment ID. Serial alone is insufficient when equipment has been
reused or duplicate historical candidates exist.

**Decision:** Preserve every valid legacy serial snapshot. During V2/V3-to-V4
migration, resolve an assignment ID only when component type, normalised serial,
hole, and ownership at the run start depth produce exactly one candidate.
Leave the ID null for zero or multiple candidates.

**Consequences:** Historical serial evidence is never discarded or linked by
guesswork. Browser bootstrap provides read-only migration candidates; normal
V4 capture continues to persist both assignment ID and serial snapshot.

## ADR-025: Keep Stage 4 surveys manual and integer-based

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Field users need a searchable station record now, but trajectory,
coordinate, declination, reference-conversion, and vendor-import behavior need
separate geospatial requirements. Floating-point degree arithmetic and naïve
absolute azimuth difference would also create inconsistent warnings near north.

**Decision:** Store survey depth as integer decimetres and dip/azimuth as
integer tenths of a degree. Permit dip `[-900, 900]`, persist azimuth
`[0, 3599]`, and visibly normalise only entered `3600` to zero. Compare azimuth
with `min(abs(a-b), 3600-abs(a-b))`. Stage 4 captures manual station values,
north reference, optional tool/comment/photo, and no trajectory or reference
conversion.

**Consequences:** Input and warning behavior is deterministic across the north
boundary. The typed station remains authoritative and photographs are only
supporting evidence. Geospatial calculation/import work requires a later ADR
and cannot be inferred from Stage 4 fields.

## ADR-026: Treat repeated survey depths as separate readings

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Operators may intentionally repeat a station to check a result.
Making depth unique would either discard evidence or force a correction when no
mistake occurred.

**Decision:** Warn and require deliberate confirmation when a survey already
exists at the entered depth. `SAVE ANYWAY` appends a new ID and timestamp; it
does not update the prior station. History and repeat counts include every
record, while spacing calculations deduplicate depths.

**Consequences:** Repeat evidence remains visible and correction history keeps
its distinct meaning. Consumers must not use `(holeId, depthDm)` as a unique
survey key.

## ADR-027: Snapshot and inherit survey-tool context

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Re-entering a tool and north reference for every station is slow,
but registry edits or deactivation must not rewrite historical readings.
Calibration and maintenance are outside the simplified survey scope.

**Decision:** Maintain an organisation-scoped `SurveyTool` registry with
active/inactive status and optional default north reference. New survey entry
inherits the latest hole survey's tool/reference, falling back to the first
active tool and its default. On save, copy tool name and serial snapshots into
the survey.

**Consequences:** Entry is faster and history remains intelligible after tool
changes. The registry is not a maintenance system; certificates, calibration,
service, and vendor telemetry remain deferred.

## ADR-028: Keep completed trays independent from runs

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** A physical run can cross a tray boundary and a tray can contain
several runs. Splitting runs to fit tray photographs would corrupt Stage 1–3
run identity, shift ownership, component snapshots, and recovery totals.

**Decision:** Store a tray's optional integer-decimetre range but no run IDs.
Derive related runs from positive overlap with completed/corrected run
intervals. Exclude touching boundaries and in-progress runs. Never split or
rewrite a run and never allocate recovered metres between trays.

**Consequences:** Existing run history remains authoritative and one run may
appear on several tray details. Tray/run links are reproducible views, not
ownership records.

## ADR-029: Split media blobs from operational metadata

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** localStorage is suitable for small prototype metadata but not
camera-sized binary images. The product still needs repository-backed photo
identity, searchable tray/survey metadata, and a quick display asset.

**Decision:** Store original and preview blobs in IndexedDB
`targetlock-runbook-media-v1`; store `Photo`, tray/survey references,
corrections, operation state, and IndexedDB keys in versioned localStorage
envelopes. Accept non-empty images up to `25 MB`. Generate previews with a
maximum `1600 px` edge, preserve PNG, and use JPEG quality `0.82` otherwise.
Fall back to the verified original if no preview is available.

**Consequences:** Large media does not consume localStorage quota and the UI can
prefer smaller previews. Clearing one browser store can orphan the other,
there is no backup/sync, and quota, retention, export, and garbage collection
remain Stage 5/production concerns.

## ADR-030: Stage and preserve tray photograph replacement

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Tray creation and replacement write IndexedDB blobs and
localStorage metadata, which cannot participate in one browser transaction. A
failed replacement must not remove the current usable photograph, and retry or
refresh must not duplicate records.

**Decision:** Persist idempotent `CREATE`/`REPLACE` operations through
`PENDING`, `ORIGINAL_SAVED`, `PREVIEW_SAVED`, `METADATA_SAVED`,
`TRAY_CREATED`, and `COMPLETED`, with `FAILED` for incomplete recovery.
Verify blobs before activation. For replacement, retain the old `Photo`, keep
it active until the new photo is ready, then append a reasoned
`primaryPhotoId` correction and audit.

**Consequences:** Eligible interrupted local replacements can finish when the
tray library invokes repository recovery, and old/new identity remains
inspectable. This is not an atomic cross-store or cross-device transaction.
Survey photographs currently use the same media repository without this staged
operation envelope.

## ADR-031: Extend the Stage 3 seed without changing run schema

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Stage 4 adds survey/tray repositories but does not change run
ownership or component/casing snapshots. Replacing the Stage 3 seed or bumping
run persistence would risk breaking V1–V4 migration and deterministic browser
bootstrap.

**Decision:** Build `targetLockStage4Seed` by spreading the Stage 3 seed,
retaining Stage 2 current-state/shift fixtures, and overlaying survey tools,
surveys, trays, photos, Stage 4 audits, and a `250 dm` preferred survey
interval. A missing version-1 survey/tray envelope reads seed fallback data; the
first local write persists it, and later hydration uses the local envelope.
Keep run schema V4 and its conservative Stage 3 assignment resolution and
legacy hole mapping unchanged.

**Consequences:** Stage 1–3 identifiers and migrations remain stable, seed data
does not duplicate after a local write, and Stage 5 must preserve this bootstrap
contract or provide an explicit migration.

## ADR-032: Enforce hole lock below the UI

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Completed, abandoned, and archived holes must not accept new runs,
shifts, casing/component changes, surveys, or trays. Hiding buttons alone would
leave repository and use-case entry points writable if a route or client call
bypassed the UI.

**Decision:** Throw `HoleLockedError` from domain/repository boundaries and wrap
run/shift/casing/component/survey/tray mutators with `HoleMutationGuard`. The
UI may render a locked panel and omit actions, but lock authority is the
mutation guard and completion status, not navigation alone.

**Consequences:** Locked holes remain immutable even if a route is omitted or
mis-wired. Reopen is an explicit use case that returns the hole to `ACTIVE`
and appends reopen history. Cross-device lock coordination still requires a
later server revision model.

## ADR-033: Persist immutable completion snapshots

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Final-hole completion must preserve the measured and reviewed state
at lock time. Later reopen, component registry edits, or seed refresh must not
rewrite what was completed.

**Decision:** Write an immutable `HoleCompletionSnapshot` inside an append-only
`HoleCompletionRecord` during the staged completion transaction, before the
hole status becomes locked. Capture final depth, run IDs, rod/casing/component
summaries, checklist, acknowledgements, reason, and actor/time. Reopen appends
a separate `HoleReopenRecord` and never mutates prior snapshots.

**Consequences:** Completed/abandoned list and locked-panel views can trust
historical values. Stage 6 reports can read snapshots without reconstructing
live hole state. Storage grows with each completion/reopen; retention/export
remain later concerns.

## ADR-034: Separate blocking and advisory completion checks

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Some completion conditions are hard integrity failures (unfinished
runs, open shifts, unresolved components, unreconciled final depth), while
others are operational warnings operators may deliberately accept (active
casing remaining, tray coverage gaps, final survey unavailable).

**Decision:** `evaluateHoleCompletion` classifies every check as `BLOCKING` or
`ADVISORY`. Blocking failures prevent completion. Advisory failures require an
explicit acknowledgement with reason before `canComplete` becomes true.
Authoritative final depth remains the deepest finished completed-run depth and
is a blocking reconciliation target, not an advisory override.

**Consequences:** Operators can complete with documented exceptions without
weakening integrity gates. Checklist policy stays in domain code shared by UI
and tests. Changing a check between blocking and advisory requires an explicit
product decision, not a UI-only tweak.

## ADR-035: Use pdf-lib for TargetLock PDF reports

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Stage 6 requires A4 PDF runbooks built from repository snapshots.
Inherited `jspdf` / `html-to-image` / `react-to-print` are invoice-demo
screenshot paths and must not define TargetLock report architecture.

**Decision:** Generate PDFs with `pdf-lib` from immutable `ReportDocumentData`.
Do not render unsanitised HTML or use `eval`. Sanitize text to WinAnsi-safe
glyphs for StandardFonts. Landscape pages carry wide Runsheet tables.

**Consequences:** PDF generation stays isolated in infrastructure adapters and
works in the browser without DOM capture. Layout tests assert structure, not
pixels.

## ADR-036: Use exceljs and a hand-rolled CSV writer

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Stage 6 needs professional workbooks and separate CSV datasets
with numeric cells, dates, percentages, and formula-injection protection.

**Decision:** Use `exceljs` for `.xlsx` (freeze panes, filters, typed values).
Emit UTF-8 CSV with BOM via a small domain helper. Escape user text beginning
with `=`, `+`, `-`, or `@` by prefixing `'`.

**Consequences:** Spreadsheet consumers receive numbers rather than text metres.
Injection-prone comments cannot become live formulas. No full-resolution images
are embedded.

## ADR-037: Store report binaries in IndexedDB behind ReportFileRepository

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** PDF/Excel/CSV blobs must not live in localStorage. Media already
uses a separate IndexedDB database.

**Decision:** Persist report files in `targetlock-runbook-reports-v1` through
`ReportFileRepository` (`save` / `get` / `verify` / `delete`) keyed by
`operationId`. Metadata, recipients, outbox, and generation transactions stay
in a Zod localStorage envelope. A report is not marked generated until the file
verifies.

**Consequences:** Binaries and metadata remain separable. Clearing either store
can orphan the other; recovery fails clearly. No cloud backup in V1.

## ADR-038: Recoverable report generation and no false delivery claims

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Interrupted generation must not duplicate snapshots/files/audits.
Share sheets and mailto drafts are not email delivery.

**Decision:** Stage generation as
`SNAPSHOT_BUILDING` → `SNAPSHOT_SAVED` → `DOCUMENT_GENERATING` →
`DOCUMENT_GENERATED` → `FILE_SAVING` → `FILE_VERIFIED` → `METADATA_SAVED` →
`COMPLETED` / `FAILED`, idempotent by `operationId` + fingerprint. Legacy
`FILE_SAVED` remains readable for resume. Activity statuses are Generated /
Downloaded / Shared / Email draft / Failed. Outbox uses `DRAFT` /
`READY_TO_SHARE` / `SHARED` / `CANCELLED` / etc. Never record SENT or
DELIVERED. Cancelled share is not success.

**Consequences:** UI language stays honest for the pilot. Real SMTP remains a
future provider behind the same outbox boundary.

## ADR-041: V2 report binary verification and currency

- **Date:** 2026-07-24
- **Status:** Accepted

**Context:** V1 Report Centre could leave operators unsure whether Generate
produced a real, openable file. Size-only IndexedDB checks were insufficient,
Open PDF was missing, and Hole changes did not surface stale reports.

**Decision:** Require `FILE_VERIFIED` with MIME/filename/signature validation
before metadata completion; create object URLs only on Open/Download user
gestures; version reports without overwrite; compare `sourceVersions`
fingerprints for out-of-date detection; keep historical versions immutable.

**Consequences:** Generate shows staged progress and a persistent success card.
Failed ops stay failed with retry. Railway still does not store report blobs.

## ADR-039: Reports read Stage 5 completion snapshots without mutating holes

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Completed/abandoned holes must still export reports. Generation
must not unlock the hole or rewrite operational records. Reopen must retain
prior reports.

**Decision:** `buildReportDocumentData` reads repositories and, when present,
the immutable Stage 5 `HoleCompletionSnapshot`. Regeneration creates a new
versioned `GeneratedReportRecord`. Report use cases never call hole mutators.

**Consequences:** Locked-hole Report Centre works for the pilot. Historical
reports survive reopen. Legacy Stage 1 `SentReport` seed remains unused by
Report Activity.

## ADR-040: Final pilot audit — lock-safe recovery and continuous rod history

- **Date:** 2026-07-22
- **Status:** Accepted

**Context:** Interrupted handover/component recovery could mutate or break reads
after lock. Stage 2 seed rod events duplicated Stage 1 Day rods and restarted
sequence numbers, so `FINAL_DEPTH_RECONCILED` failed for DDH041 after local
runs. Close Shift only offered handover, blocking final completion from the UI.

**Decision:**

1. Recover prepared handover/component operations only when already applied or
   the hole is mutable; otherwise clear the stale prepared envelope.
2. Keep Stage 2 Night rod events only, sequenced after Stage 1, starting at rod
   112.
3. Expose **Close as final shift** beside handover close.
4. Align report loss/gain with per-run completion statistics; merge timeline and
   dashboard runs by run number; expand hole search across repository entities.

**Consequences:** Local pilot completion, lock, reports, and refresh persistence
are coherent for field testing. Seed edits do not rewrite already-persisted
browser data unless storage is cleared.

## ADR-025: Audited Run corrections preserve original snapshots

- **Date:** 2026-07-24
- **Status:** Accepted

**Context:** Drillers need to correct completed Run mistakes without silently
overwriting history, editing calculated fields, or breaking later Run continuity.

**Decision:** Extend the existing `Correction` foundation rather than invent a
parallel `RunCorrection` type. Local saved-run envelopes move to V5 with
`originalSnapshot` frozen on first mutation, field-level correction records,
rod-event effective overrides (ADR-011), and staged `operationId` transactions.
`previewRunCorrection` / `previewVoidRun` share the same projection engine used
on save. Run status becomes `completed | corrected | void`. Void never deletes.
Locked holes block calculation-affecting correct/void until reopen. Run version
bumps feed V2 report fingerprints so prior reports become out of date.

**Consequences:** Original entry values remain inspectable; downstream stick-up
and rod-event recalculation is explicit and previewable; accidental duplicates
are voided instead of mass-renumbered.
