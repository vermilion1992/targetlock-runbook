# Runbook navigation matrix

Authoritative primary destinations (no in-page Back):

| Route | Title |
|-------|--------|
| `/holes/[holeId]/current` | Current Hole |
| `/holes/[holeId]/runbook` | Runbook |
| `/holes/[holeId]/trays` | Trays |
| `/holes/[holeId]/timeline` | Timeline |
| `/holes/[holeId]/more` | More |

Secondary / nested parents (in-app Back):

| Route | Canonical parent | Notes |
|-------|------------------|--------|
| `/trajectory` | More | |
| `/survey-settings` | More | Optional safe `returnTo` (e.g. Trajectory) |
| `/statistics` | More | |
| `/casing` | More | |
| `/components` (hole) | More | |
| `/surveys` | More | |
| `/surveys/tools` | More | |
| `/reports` | More | |
| `/reports/history` | Reports | |
| `/complete` | More | |
| `/reopen` | More | |
| `/shifts` | More | |
| `/shifts/[shiftId]` | Shifts | |
| `/shifts/[shiftId]/close` | Shift detail / Cancel | Dirty guard |
| `/shifts/start` | Current Hole / Cancel | Dirty guard |
| `/runs/new` | Current Hole | Auto-save drafts; no discard dialog |
| `/runs/[runId]` | Runbook | |
| `/runs/[runId]/correct\|void` | Run detail / Cancel | Dirty guard |
| `/casing/*` nested | Casing or casing detail | Forms use Cancel + dirty guard |
| `/surveys/*` nested | Surveys or survey detail | Forms use Cancel + dirty guard |
| `/trays/*` nested | Trays or tray detail | Forms use Cancel + dirty guard |
| `/holes/new` | More (DEFAULT_HOLE_ID) | Cancel + dirty; success uses `replace` |
| `/holes/completed` | More | |
| `/components` (registry) | More | |
| `/trajectory/plan` | → `/trajectory` | Redirect |
| `/trajectory/setup` | → `/survey-settings` | Redirect; canonical More |

Hole isolation: parent `href` always uses the route’s `holeId`, not a different active Hole.
