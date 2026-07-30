# TargetLock controlled-pilot terms, privacy and support checklist

Operational planning aid only; not legal advice. The drilling company and
TargetLock operator must obtain appropriate legal, privacy, employment,
contract and records-management advice for their jurisdiction.

## Scope acknowledgement

- Stage 7C is a one-rig pilot with recoverable authoritative core records, not a
  certified safety, anti-collision, telemetry or complete live multi-device
  system.
- Field writes commit to the dedicated tablet first. Once accepted, Postgres is
  authoritative for the core Project/Rig/Hole/BHA/Shift/Run/Rod/Handover
  projection. Peripheral records remain journal-only.
- Conflicts are not automatically merged. Photo and generated-report blobs are
  not uploaded.

## Data ownership and permitted use

- Record the drilling company as controller/owner of its operational data and
  define TargetLock's support/processor role in the pilot agreement.
- Use data only to operate, support, secure and evaluate the agreed pilot.
- Prohibit shared accounts. Assign least-privilege roles and review access at
  mobilisation, crew changes and demobilisation.
- Define ownership/licensing of reports, photographs and derived analytics.

## Privacy and retention

- Document collected fields: names/emails, role and session events, device/rig
  assignment, IP hash, audit reasons, operational metadata and local media.
- Define retention and deletion periods separately for Postgres, browser data,
  exported backups and reports.
- Do not enter health, payroll or unrelated personal information in free-text
  notes.
- Provide a contact and process for access, correction, export and deletion
  requests where applicable.

## Support and incidents

- Configure named company and TargetLock contacts, hours, severity definitions,
  acknowledgement targets and an out-of-band escalation path.
- For device loss/compromise: revoke the device and affected user sessions,
  preserve backups/reports, rotate exposed credentials and record the timeline.
- For conflicting tablets: stop duplicate entry, compare the current server
  revision with both local exports, preserve all evidence, and require
  supervisor review plus a reason for takeover or stale release.
- Never place passwords, cookies, database URLs, session secrets or CA private
  keys in tickets, screenshots or chat.
- Record post-incident actions and explicitly decide whether field use can
  resume.

## Exit criteria

- Export final metadata and reports, preserve tablets until acceptance is
  signed, revoke pilot access, agree retention/deletion and record unresolved
  conflicts, journal-only peripheral records or missing blobs.
- Do not promote Stage 7C as complete live multi-device production until
  peripheral materialisation, reviewed conflict disposition and durable blob
  storage are implemented and restore-tested.
