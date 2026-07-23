# TargetLock Local Pilot Test Guide

Practical checklist for field testing the Stage 1–6 local pilot in
`packages/main`. Use seeded hole **DDH041** unless testing completed/abandoned
fixtures (`DDH038`, `DDH039`, `DDH042`).

## Before you start

- Install and run per `docs/local-installation.md`.
- Prefer Chrome or Edge on the tablet/phone used at the rig.
- Confirm light and dark theme both remain readable outdoors.
- Clear site data only when you intentionally want a fresh seed.

## Drill-site checklist

### Starting Shift

- [ ] Open Current Hole for `DDH041`.
- [ ] Confirm **No active shift** when none is open.
- [ ] Start Day or Night Shift with the correct primary driller.
- [ ] Confirm success status and that **Record Next Run** is enabled.

### Entering Runs

- [ ] Record a run with a **3.0 m** rod; confirm R/S, depth, and drilled update.
- [ ] Record a run with a **6.0 m** rod; confirm rod number increments once.
- [ ] Confirm values display to one decimal metre.
- [ ] Refresh the browser; completed runs remain.

### Rod changes

- [ ] Add rods only through Record Run.
- [ ] Confirm 3.0 m and 6.0 m each increment rod number once.
- [ ] Confirm Current R/S updates from Base R/S ± active rod events.

### Handover

- [ ] Start a run, leave it unfinished, close shift with a handover note.
- [ ] On Close Shift, confirm SHIFT BREAKDOWN (metres, Runs, average/median,
      weighted recovery), ROD ACTIVITY, and SHIFT RECORDS before closing.
- [ ] Accept Night/Day handover with a new driller; confirm Completed work and
      Outstanding items on the handover screen.
- [ ] After a post-close Run correction, open Shift Detail and confirm
      SHIFT ANALYTICS AMENDED with original close snapshot still visible.
- [ ] Generate a Current-Shift PDF and confirm Shift analytics appear.
- [ ] Complete the same run number; confirm **Shared between shifts**.
- [ ] Refresh; shared ownership remains on Runbook and run detail.

### Casing

- [ ] Open Casing history and advance an active string.
- [ ] Refresh; previous and new end depths remain in the event list.
- [ ] Confirm Current Hole casing summary updates.

### Bit and reamer

- [ ] Change bit at the recorded depth; confirm serial history.
- [ ] Change reamer at the recorded depth; confirm serial history.
- [ ] Confirm Timeline shows the change and Current Hole shows the active serials.

### Survey

- [ ] Add a survey with depth, dip, azimuth, and tool.
- [ ] Confirm dashboard latest survey, history, and Timeline update after refresh.
- [ ] If a warning appears, confirm focus moves to the warning before save.

### Tray photograph

- [ ] Photograph the next tray; confirm local verification message.
- [ ] Open library and tray detail; confirm image and alt text.
- [ ] Refresh; tray and image metadata remain.

### Completing Hole

- [ ] Close the open shift with **Close as final shift** (not handover).
- [ ] Open Final hole review.
- [ ] Resolve active component outcomes.
- [ ] Select final survey (or mark unavailable with reason).
- [ ] Confirm final partial tray if advised.
- [ ] Acknowledge every advisory with a short reason.
- [ ] Save completion reason and confirm lock.
- [ ] Confirm Current Hole shows locked state and Record Next Run is gone.

### Generating reports

- [ ] Generate Full-Hole PDF and Excel from Report Centre.
- [ ] Confirm Version 1 labels; regenerate to create Version 2.
- [ ] Download a report; confirm filename is safe and local-only.
- [ ] Confirm UI never says sent or delivered.

### Correcting and voiding runs

- [ ] Open Run Detail → Correct run → measured stick-up; review impact; save.
- [ ] Confirm correction history and that the following run’s drilled length updated.
- [ ] Correct recovered length; confirm hole depth unchanged.
- [ ] Correct a 6.0 m rod event to 3.0 m; confirm rod count stays one physical rod.
- [ ] Void an accidental duplicate; confirm VOID label and exclusion from stats.
- [ ] Generate a report, correct a run, confirm the report is out of date.
- [ ] On a completed/locked hole, confirm Correct/Void is blocked until reopen.

### Reporting a fault

Record and send to the pilot owner:

1. Hole ID and approximate depth/run.
2. Exact screen and action taken.
3. Whether refresh recovered or lost data.
4. Screenshot and browser/device.
5. Whether site data was cleared recently.

## Automated proof

From `packages/main`:

```text
npm run test:e2e -- e2e/pilot-end-to-end.spec.ts
```

This covers the full local pilot workflow including refresh persistence.
