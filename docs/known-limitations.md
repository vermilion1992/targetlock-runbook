# TargetLock Known Limitations

Status date: 2026-07-24
Scope: local pilot of Stages 1–6 in `packages/main` + V2 report reliability +
Run corrections/voiding

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

- **Browser-only storage.** Records live in localStorage and IndexedDB on one
  browser profile. Clearing site data loses local work.
- **Reports are device-local.** Generated PDF/Excel/CSV blobs are verified in
  IndexedDB on this browser only. They are not backed up or synchronised by
  Railway; download important reports to permanent storage.
- **Railway hosts code only.** A public Railway deployment serves the Next.js
  app; Runs, photographs and reports still remain local to each browser and are
  not synchronised or backed up by Railway.
- **Open PDF depends on the browser.** Popup blockers may force a download
  fallback. Object URLs are temporary and revoked after open.
- **No authentication.** Operator identity is seed/local snapshot based. An
  optional Railway HTTP Basic pilot-access gate may protect the public URL; it
  is not user-account authentication.
- **No cloud database.** There is no server persistence or audit-grade store.
- **No multi-device sync.** Two devices can diverge silently.
- **No cross-device locking.** Lock enforcement is local to this browser.
- **No cloud media backup.** Tray/survey photos are local IndexedDB blobs.
- **No real email provider.** Prepare Email / share never means sent or
  delivered.
- **Browser storage quota.** Large photo/report history can hit quota; there is
  no retention dashboard or garbage collection.
- **No physical-device accessibility certification.** Automated checks cover
  names, focus-ish flows, and widths; gloves, glare, screen readers, and 200%
  zoom still need manual device review.
- **Barrel capacity deferred.** Core-barrel capacity remains optional/unset.
- **TargetLock IQ integration deferred.** No hardware telemetry or IQ sync.
- **Inherited demo routes remain in the Next.js app.** They are outside
  TargetLock navigation but are not fully removed from the package build.
- **Survey photos** do not use the tray staged-recovery envelope.
- **Boundary-run recovered metres** are estimates when recovery is aggregate.

## Production / cloud blockers

These must be solved before production or multi-device deployment:

- Authenticated identity and authorisation
- Durable transactional storage with backup/restore
- Server revision / conflict policy and synchronisation
- Cross-device hole locking
- Cloud media and report storage
- Real SMTP or transactional email if delivery is required
- Removal or hard isolation of inherited demo routes and unused template deps
- Production dependency advisory review beyond the local pilot scope
- Physical-device accessibility sign-off

## Trajectory limitations (V2 Implementation 5)

- **Polished interactive 3D renderer is deferred** to Implementation 6.
  Foundation plan view, vertical section, and dip/azimuth trends are available.
- **No steering recommendations** and **no certified anti-collision**.
- **Display tolerances are visual only** unless supplied by an authorised
  project source.
- **Mine-grid mode does not reproject** between EPSG systems; entered
  coordinates must already belong to the named grid.
- **Endpoint dip/azimuth alone do not prove target intersection.** Target
  coordinates are stored and checked separately from the directional plan.
- **PDF report graphics** for trajectories remain deferred; text/Excel
  summaries are included.

## Hole analytics limitations (V2 Implementation 4)

- PDF Hole Summary / Full-Hole reports include analytical tables and chart text
  summaries only; deterministic chart-image embedding is deferred.
- Observed component recovery does not prove causation; partial boundary Runs
  remain labelled as run-level estimates.
- Driller breakdown is an operational record, not a performance leaderboard.
- Employee rankings, payroll, downtime costing, and predictive scoring remain
  out of scope.

## Future enhancements

- Polished interactive 3D trajectory renderer (Implementation 6)
- Deterministic PDF chart-image embedding for Hole analytics and trajectories
- Tray OCR / annotation
- Payroll, hours, delays, costs
- SQLite and service-worker offline packaging
- Quota / retention controls for photos and report versions
- Capacitor native share validation on hardware
