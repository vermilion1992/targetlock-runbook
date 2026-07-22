# TargetLock Design System

## Experience principles

- **Field-first:** prioritise fast scanning, large targets, and operation in glare, dust, and low light.
- **Calculation confidence:** visibly separate observed inputs from derived results and show units everywhere.
- **Low cognitive load:** keep the current hole, run state, and completion action continuously apparent.
- **Recoverable:** make draft, media-save, completion-transaction, and
  validation state explicit; never imply that local data has synchronised.
- **Accessible:** preserve semantic controls, keyboard operation, visible focus, and non-colour status cues.

## Foundation

TargetLock uses the existing `packages/main` foundation:

- Tailwind CSS v4 CSS-first tokens and utilities.
- Existing shadcn-style components and Radix primitives.
- `next-themes` class-based theming.
- DM Sans for interface text.
- Existing semantic variables such as background, foreground, card, border, primary, success, warning, and destructive.

Prefer semantic CSS variables over hard-coded colours. Feature-specific tokens should be defined in CSS and mapped through Tailwind v4 rather than adding a JavaScript Tailwind configuration.

## Theme behavior

The default theme follows the operating-system preference. Users can explicitly choose light, dark, or system behavior through the existing theme infrastructure.

Dark mode is also the field mode: high contrast without pure-black glare, subdued surfaces, clearly bounded inputs, and bright but restrained status accents. Theme changes must not alter meaning or hide validation, focus, or disabled states.

## `RunbookLayout`

TargetLock uses an isolated `RunbookLayout`, not the dashboard shell.

- A compact top bar identifies TargetLock, `DDH041`, theme, and local draft state.
- The primary work area puts current-run inputs beside or above calculated depth results.
- Recent context and setup data are secondary but reachable without leaving the run.
- On narrow screens, content becomes one column and the primary completion action remains easy to reach.
- On the Current Hole dashboard, `Record Next Run` and `Photograph completed
  tray`
  appear before secondary metric and equipment detail so they are visible in
  the initial phone viewport.
- Latest survey and current tray cards show repository state and link directly
  to add/history workflows. The 25.0 m survey interval is advisory, not an
  error or run-entry gate.
- Current Hole has explicit loading, no-active, active, handover-pending,
  completion-review, and locked/completed states. Record Next Run is dominant
  only for an `OPEN` unlocked shift.
- Locked holes show a read-only locked panel with final depth, reason, and
  reopen entry when reopen is allowed. Do not present operational mutators as
  available.
- Do not expose unrelated admin navigation, marketing chrome, or dashboard customisation.

Use a restrained content width on desktop while allowing numerical run rows to use available horizontal space. Touch targets should be at least `44 × 44 px`.

## Typography and numbers

- Use the existing DM Sans setup.
- Use a clear hierarchy: page/hole title, section title, field label, value, supporting text.
- Use tabular numerals for measurements and rod counts.
- Display all lengths in metres with exactly one decimal place, for example `662.5 m`.
- Keep the unit adjacent to the number; never rely on a section heading as the only unit cue.
- Use concise field language: `BHA`, `CSU`, `R/S`, `Stick-up`, `Hole depth`, and `Drilled`.

## Component conventions

### Inputs

Use labelled numeric inputs with a visible `m` suffix, appropriate mobile input mode, and helper/error text. Accept only tenth-metre precision. Additions and removals should make direction unambiguous.

Survey depth follows the same tenth-metre input. Dip and azimuth use decimal
input mode with visible degree suffixes and exactly one decimal place in
history/detail. Dip helper text explains negative/down and positive/up.
`360.0°` produces a visible status and is shown/stored as `0.0°`.

### Calculated values

Render calculated values in read-only summary cards or rows with a `Calculated` cue. They must not look editable. The current hole depth and drilled value receive the strongest numerical emphasis.

### Status

Use text and icon together for `Local draft`, `Saved locally`, `Open`,
`Handover pending`, `Closed`, `Shared run`, `Invalid`, `Complete`,
`Completion review`, `Completed`, `Abandoned`, `Archived`, and `Locked`. Never
use a cloud/synchronised icon or wording for local Stage 2–5 data. Warning and
error colour must be paired with explanatory text.

Casing lifecycle and component statuses always include readable text.
`Available`, `Active`, `Under inspection`, `Lost downhole`, and related states
must not rely on pill colour alone. Local Stage 2–5 records remain labelled as
local-only, never synchronised. Hole-lifecycle status always includes readable
text; locked presentation must not rely on colour alone.

Stage 4 success messages say `saved locally` or `verified and saved locally`.
Photographs must never display a cloud/synchronised badge. A missing IndexedDB
blob renders a text-and-icon `Photograph unavailable` fallback with an
accessible image label.

### Actions

Provide one visually primary completion action. Do not use a sticky action
surface that obscures form fields above the phone navigation. Destructive
actions such as clearing a draft require confirmation and explain that only
local browser data is affected.

### Feedback

Run entry validates on blur and completion attempts and updates derived values
immediately. Stage 4 survey/tray forms validate on save, while photo type/size
validates on selection. Keep messages near the affected field and provide a
form-level summary when completion is blocked.

Shift-close summaries separate **must resolve** integrity conflicts from
**may hand over** unfinished work. Handover acceptance and shift start use live
status messages. Validation summaries receive focus when a submit fails.
Casing-depth and within-run component-change warnings receive programmatic
focus, explain the consequence, and require an explicit confirmation/reason or
comment before save. Successful local writes use a polite live status.

Survey and tray warning summaries use `role="alert"`, programmatic focus, and
plain-language consequences. Survey warnings offer `CHECK ENTRY` and
`SAVE ANYWAY`; a repeated-depth warning also links to existing history and a
confirmed save creates another reading. A duplicate tray number does not offer
save-anyway: it links to `VIEW EXISTING` and `REPLACE PHOTOGRAPH`.

Photo capture exposes one labelled `TAKE OR CHOOSE PHOTO` control with
`accept="image/*"` and environment-camera preference. It names the chosen file,
shows an immediate local preview, allows removal, and associates file-size/type
errors with the input. Saving text and a polite live region explain that a tray
is incomplete until the local original is verified. Replacement shows the
current image beside the new selection when space permits and requires a
reason.

## Interaction and accessibility

- Maintain logical document and tab order.
- Associate every input with a programmatic label and error description.
- Provide a visible focus ring in light and dark themes.
- Announce calculation/status changes without repeatedly interrupting typing.
- Do not encode addition/removal, valid/invalid, or draft/complete by colour alone.
- Respect reduced-motion preferences and avoid decorative motion in the run workflow.
- Preserve useful content at 200% zoom and at a `320 px` viewport.
- Label Day/Night and driller selectors programmatically; status must not rely
  on colour.
- Shift/run actions retain at least `44 × 44 px` targets. Phone runbook groups
  use native collapsibles; tablet layouts use horizontally safe tables.
- Store ISO timestamps but display them using the device's local date/time.
- Stage 4 buttons/links use at least `44 px` (`min-h-11`) targets; primary
  survey/tray saves use at least `56 px` (`min-h-14`).
- Survey/tray loading uses `role="status"`, failures use `role="alert"`, and
  save progress is announced through a polite live region without repeatedly
  interrupting typing.
- Every captured or bundled image has contextual alt text. Decorative camera,
  compass, warning, and save icons are hidden from assistive technology.

## Stage 2 responsive patterns

- Approved automated widths are `360`, `390`, `430`, `768`, and `1024 px` in
  light and dark modes.
- Start/close forms are one column on phones and use two-column field groups
  only when space permits.
- Handover uses stacked outgoing/incoming panels on phones and a two-column
  comparison on larger tablets.
- Shift history uses cards; the runbook uses collapsible phone cards and a
  tablet table. Shared-run text/icon remains visible in both.
- Safe-area padding and the existing phone tab bar remain unchanged; shifts
  are linked from Current Hole and More rather than adding another phone tab.

## Stage 3 responsive patterns

- Casing history, casing lifecycle forms, component history, and change forms
  use stacked cards and full-width `44 px` controls on phones.
- Tablet layouts may use summary/detail columns. Registry tables are reserved
  for widths that can contain every column; narrower tablets use cards rather
  than creating page-level horizontal overflow.
- Registry filters collapse to one column on phones and expand only when each
  labelled control retains useful width.
- Long serial numbers wrap safely. Units stay attached to tabular
  one-decimal-metre values.
- Incoming component selectors keep active records visible so the
  non-overridable cross-hole duplicate warning is explicit.
- Change forms show outgoing ownership, incoming status, the exact boundary,
  and removal reason before the primary action.
- Component registry cards/tables show the current hole and recorded metres;
  hole history shows average recovery, exact/run-level-estimate status, and
  shared boundary-run counts without presenting estimated recovered metres as
  exact.
- Run detail presents immutable start-time bit, reamer, and casing snapshots.
  A within-run change uses a warning panel with exact depth, run interval,
  outgoing/incoming serials, removal reason, and run-level estimate disclosure.
- Approved automated widths remain `360`, `390`, `430`, `768`, and `1024 px`
  in both light and dark modes.

## Stage 4 survey patterns

- Add/correct forms are one column on phones and two columns from medium widths.
  Labels, visible units, helper text, and warnings remain adjacent to their
  controls.
- Survey history is stacked linked cards below tablet width and a horizontally
  contained table at tablet widths. Search and north-reference filters stack on
  phones.
- Statistics use a two-column phone grid and expand without hiding labels.
  Tool names and serial snapshots wrap rather than widening the page.
- Survey detail keeps result values, optional image, shift context, and
  correction history in document order. The image is contained to `70vh`.
- Tool registry cards remain usable on phones; creation fields become two
  columns only when enough width is available.

## Stage 4 tray and photo patterns

- The primary dashboard action is `PHOTOGRAPH COMPLETED TRAY`; the tray library
  remains two columns on phones, three at medium widths, and four only at wide
  widths. Each image uses a `4:3` frame with a text tray number/depth caption.
- Capture/correction forms stack on phones. Start/end depth controls become a
  pair only at medium widths.
- Tray detail stacks image before metadata and changes to a `2fr / 1fr` layout
  only on large screens. Full images use `object-contain` and at most `75vh`.
- Replacement stacks the current and new photograph on phones and uses two
  columns on large screens. The current photograph remains visibly active
  while storing/verifying the replacement.
- Run-overlap links are derived chips with readable `Run N` text. They do not
  imply that a run was split or assigned to a tray.
- Approved verification widths are `360`, `390`, `430`, `768`, and `1024 px`
  in light and dark modes. Automated overflow and warning-focus checks passed;
  physical-device glare, gloves, safe-area, 200% zoom, and screen-reader checks
  remain manual and are listed in `implementation-status.md`.

## Stage 5 completion patterns

- Completion review is one column on phones. Checklist groups separate
  **must resolve** blocking failures from **acknowledge to continue**
  advisories. Advisory acknowledgement requires a visible reason field.
- Final depth, disposition, reason, and final-survey resolution stay adjacent
  to their controls. Authoritative final depth is read-only calculated context
  from completed runs, not a free-typed override.
- Locked panel and completed-dashboard variant keep final depth, reason,
  completed/abandoned status, and reopen/history links in document order.
  Operational create/edit actions are absent or clearly disabled with lock
  explanation.
- Completed-holes list uses stacked cards on phones and a horizontally safe
  table at tablet widths. Filters for status/reason stack on phones.
- Reopen form shows the prior immutable snapshot summary, requires a reason,
  and explains that history is retained.
- More and Quick Actions expose `Complete hole`, `Reopen hole`, and
  `Completed holes` with implemented (not preview) labels.
- Approved verification widths remain `360`, `390`, `430`, `768`, and
  `1024 px` in light and dark modes, including completion list, locked
  snapshot, reopen, and DDH041 review flows.

## Stage 6 report patterns

- Report Centre: large report-type radios, clear format checkboxes, visible
  generation progress via a polite live region, and filename wrapping.
- Actions are labelled with file type (`Download PDF`, `Share XLSX`). Touch
  targets remain at least 44×44 px.
- Activity statuses are **Generated**, **Downloaded**, **Shared**,
  **Email draft**, or **Failed** — never Sent or Delivered. Status is not
  colour-only.
- Prepare Email dialog labels To/Cc, explains manual attach when mailto cannot
  attach files, and never claims delivery.
- Phones use stacked Generated Report cards; tablets may place options and
  recipients side by side and use a Report Activity table.
- Approved widths remain `360`, `390`, `430`, `768`, and `1024 px` in light and
  dark modes.

## Preview convention

Reports, surveys, completed-tray photography, and final-hole completion are
implemented workflows and must not be labelled preview-only. Remaining deferred
items (real SMTP, cloud sync, auth, payroll, trajectory) keep deferred language.
Shift, casing, component, runbook, and operational timeline workflows remain
implemented.

## Final pilot presentation

- Prefer product eyebrows (`Hole completion`, `Reports`, `Operational timeline`)
  over stage-number badges in field navigation.
- More menu Settings stays visible but non-interactive with an explicit deferred
  note; do not imply configuration editing exists in the local pilot.
- Local prototype notice language is “local pilot only”, not stage-numbered.
- Close Shift presents both **Close and hand over** and **Close as final shift**
  with distinct purpose copy so completion remains reachable without handover.
