# TargetLock Known Limitations

Status date: 2026-07-29
Scope: local pilot of Stages 1–6 and Stage 7C authoritative core recovery in `packages/main` + V2 report reliability +
Run corrections/voiding + project/hole library and multi-hole isolation P0–P2 +
PDF Visual Parity v1

## Acceptable local-pilot limitations

- **Run restore-from-void is not supported.** Voided Runs remain in audit
  history; reversing a void requires a new operational entry after review.
- **Mass automatic renumbering of later Runs is not supported.** Prefer voiding
  accidental duplicates; run-number correction only updates the target Run after
  duplicate/gap preview.
- **Component snapshot correction is display-scoped.** Assignment interval
  boundaries are not rewritten by Run corrections; discrepancies surface as
  warnings.
- **Metadata-only amendments on locked completed holes remain deferred.**
  Calculation-affecting corrections require reopen.

- **Local-first storage with a bounded authoritative server subset.** Field
  writes first commit to localStorage/IndexedDB. Accepted Project/Rig/Hole/BHA/
  Shift/Handover/Run/Rod/Run-correction operations are materialised to
  Postgres and can reconstruct a replacement tablet. Casing, component,
  survey, tray and report metadata are still journal-only. Clearing site data
  before core operations are accepted can lose unsynced records; all media and
  report blobs remain at risk.
- **Cross-tab scope is browser-local.** Current Chrome/Edge tabs serialise
  repository operations with Web Locks and stale tabs show a reload prompt.
  Browsers without Web Locks only receive same-tab ordering; operators must
  reload before continuing after another tab changes data.
- **Reports are device-local.** Generated PDF/Excel/CSV blobs are verified in
  IndexedDB on this browser only. They are not backed up or synchronised by
  Railway; download important reports to permanent storage.
- **Report attribution is journal-backed, not independently materialised.**
  Secure pilot mode preserves the exact server role (including Company admin)
  in report snapshots, but generated
  records and blobs remain on the tablet and are not independently attested by
  PostgreSQL.
- **Railway PostgreSQL stores the control plane, journal and core projection.**
  Accounts, memberships, sessions, devices, leases, validated JSON journal rows
  and audits are durable. Normalised core hole state and change cursors are
  recoverable. Peripheral records, photographs and generated report blobs are
  not backed up by that database.
- **Open PDF depends on the browser.** Popup blockers may force a download
  fallback. Object URLs are temporary and revoked after open.
- **Demo mode is not authentication.** `TARGETLOCK_MODE=demo` deliberately
  retains self-selected local operators for development and E2E. It must not be
  used as a public controlled-pilot deployment.
- **Stage 7C authority is intentionally narrow.** Secure pilot mode has real
  account, organisation, server-role, session and device checks plus
  authoritative core aggregates. It does not convert every local repository
  into a server-authorised projection.
- **Rate limits are single-replica.** Login and provisioning throttles are
  process-local for the controlled Railway service. Horizontal scaling needs a
  shared Postgres/Redis-backed limiter.
- **No complete materialised domain cloud database.** PostgreSQL stores the
  core drilling vertical, typed payloads, expected revisions and lease
  evidence. Casing, components, surveys, trays, reporting and blobs remain
  incomplete.
- **No automatic multi-device merge.** A second authorised tablet can pull and
  reconstruct accepted core state. Stale, duplicate or divergent writes enter
  explicit conflict state and require supervisor review; TargetLock does not
  use last-write-wins or silently discard local operations.
- **Assignment overrides are privileged and audited.** A Driller can acquire,
  write, read snapshots/changes/conflicts and restore only within the active
  device project/rig assignment. Supervisors and company admins can cross that
  boundary for oversight, recovery and reassignment; every override records a
  `DEVICE_ASSIGNMENT_OVERRIDE` audit. This is not an invisible Driller bypass.
- **Lease guard is central but not certified conflict resolution.** Coordinated
  browser repository mutations require a writer lease in pilot mode. Normal
  offline grace is 30 minutes; already-authorised completion/close gets a
  bounded 12-hour grace. Postgres stores and evaluates issuance/expiry against
  the current lease ID, version, writer device, release and takeover state;
  client-supplied verification/grace timestamps are not authoritative. Local
  browser tampering can still corrupt that browser's unaccepted state, and
  queued conflicts need supervisor review.
- **No cloud media backup.** Tray/survey photos are local IndexedDB blobs.
- **No real email provider.** Prepare Email / share never means sent or
  delivered.
- **Browser storage quota.** Diagnostics shows quota estimates and warns from
  80%, but there is no automatic retention/garbage collection.
- **Metadata backup is not full blob backup.** Export is versioned and
  checksummed and dry-run import validates structure/organisation, but the file
  contains local metadata, outbox rows, server aggregate IDs/revisions/cursor
  and a media manifest. It does not contain recoverable photo/report blobs.
- **Restore is core-only.** Replacement-device restore is blocked by pending
  local operations or durable unjournalled-failure markers, is
  dry-run/confirmed/two-phase-audited and hydrates accepted core records.
  Completion reviews, immutable completion records and reopen history are
  included. It cannot reconstruct journal-only peripheral records or blobs.
- **Context handover does not silently adopt work.** Pending rows from an older
  operator or device are quarantined and require metadata export/manual
  recovery. Logout and current-device removal are blocked while the active
  context is unsynced or journal storage is unavailable. If IndexedDB enqueue
  fails after a local commit, a separate organisation/device/operator-scoped
  localStorage marker survives reload; export plus explicit acknowledgement is
  required before the marker is cleared. If both browser stores are
  unavailable, the UI can warn only for the current page lifetime.
- **Legacy binary keys remain in place.** New media/report blobs are
  organisation/hole namespaced, while existing metadata continues to reference
  exact legacy IndexedDB keys. There is no automatic lazy migration or orphan
  cleanup.
- **No physical-device accessibility certification.** Automated checks cover
  names, focus-ish flows, and widths; gloves, glare, screen readers, and 200%
  zoom still need manual device review.
- **Barrel capacity deferred.** Core-barrel capacity remains optional/unset.
- **TargetLock IQ integration deferred.** No hardware telemetry or IQ sync.
- **Inherited demo modules remain in the package build.** The production request proxy
  returns 404 for inherited pages and APIs by default. They are reachable only
  when a deployment explicitly sets `ENABLE_TEMPLATE_DEMOS=true`; full source
  and dependency removal remains deferred.
- **Production dependency advisories remain.** Direct critical `jspdf` and
  `swiper` advisories were removed and Next.js was patched to the latest stable
  16.2 release. `npm audit --omit=dev` still reports transitive high-severity
  chains in Next.js (`postcss`/`sharp`) and ExcelJS/archiver plus one nested
  UUID advisory; npm offers only breaking or incorrect downgrade paths. Review
  patched upstream releases before public pilot promotion.
- **Project/rig editing breadth is limited.** The directory is now
  server-authoritative and recoverable, but editing, archiving and broad
  additional-rig management remain deferred.
- **Survey photos** do not use the tray staged-recovery envelope.
- **Boundary-run recovered metres** are estimates when recovery is aggregate.

## Production / cloud blockers

These must be solved before full production-pilot or multi-device claims:

- Implement server materialisers for the remaining journal-only domains
- Exercise PostgreSQL and future object-storage backup/restore in field drills
- Add a reviewed conflict-disposition workflow beyond read-only details/export
- Extend aggregate/version policy to peripheral records
- Add cloud-backed tray/media/report uniqueness and relationship enforcement
- Cloud media and report storage under organisation/hole namespaces with
  retention and deletion policies
- Real SMTP or transactional email if delivery is required
- Removal of inherited demo modules and unused template dependencies from the
  production build (runtime routes are already isolated by default)
- Production dependency advisory review beyond the local pilot scope
- Physical-device accessibility sign-off

## Trajectory limitations (V2 Implementation 5–6)

- Interactive 3D / plan / section graphics are **presentation-only** and must
  not be treated as certified anti-collision software.
- Next-Survey dip/azimuth guidance is released only when the geometric recovery
  path fits the hole's configured dogleg, lift, drop and turn envelope. The
  envelope must be validated for the active BHA and ground conditions; this is
  **not steering-tool certification** or certified anti-collision software.
- **Display tolerances are visual only** unless supplied by an authorised
  project source.
- **Mine-grid mode does not reproject** between EPSG systems; entered
  coordinates must already belong to the named grid.
- **Endpoint dip/azimuth alone do not prove target intersection.** Target
  coordinates are stored and checked separately from the directional plan.
- Trajectory PDF panels are deterministic vector graphics from verified path
  coordinates; they do not screenshot the live WebGL/canvas session.
- **No satellite/orthophoto map is fetched or implied.** PDF location heroes
  show recorded collar values and deterministic offline trajectory vectors.
  Mine-grid coordinates are not WGS84 and are never sent to a satellite API.
  A future static map requires project CRS/EPSG or stored WGS84, provider
  attribution/licensing, privacy controls, online fetch/caching and an offline
  fallback.

## Hole analytics limitations (V2 Implementation 4)

- PDF Hole Summary / Full-Hole reports include analytical tables, searchable
  notes and deterministic depth-progression and recovery-by-depth vector
  charts. Additional analytics graphics remain future extensions.
- Observed component recovery does not prove causation; partial boundary Runs
  remain labelled as run-level estimates.
- Driller breakdown is an operational record, not a performance leaderboard.
- Employee rankings, payroll, downtime costing, and predictive scoring remain
  out of scope.

## Future enhancements

- Additional deterministic PDF analytics graphics (for example component
  intervals and core loss/gain)
- CRS-aware, licensed static orthophoto/map support with privacy controls,
  caching and an offline fallback
- Tray OCR / annotation
- Payroll, hours, delays, costs
- SQLite and service-worker offline packaging
- Quota / retention controls for photos and report versions
- Capacitor native share validation on hardware
