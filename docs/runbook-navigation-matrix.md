# Runbook navigation matrix

Global selection and history:

| Route | Title / behavior |
|-------|------------------|
| `/` | Local-session gateway to Sign In or Start |
| `/sign-in` | Device-local operator identification; public pilot route |
| `/start` | Confirm recent/existing hole, choose project for new hole, or create project |
| `/projects` | Organisation project library |
| `/projects/new` | Create a project and its initial rig |
| `/projects/[projectId]` | Project-owned hole register |
| `/projects/[projectId]/holes/new` | New draft hole with explicit project and rig |
| `/holes/new` | Legacy redirect to pilot project onboarding |
| `/holes/completed` | Completed and abandoned hole history |

Authoritative primary destinations (no in-page Back):

| Route | Title |
|-------|--------|
| `/holes/[holeId]/current` | Current Hole |
| `/holes/[holeId]/runbook` | Runbook |
| `/holes/[holeId]/trays` | Trays |
| `/holes/[holeId]/trajectory` | Trajectory |
| `/holes/[holeId]/more` | More |

Secondary / nested parents (in-app Back):

| Route | Canonical parent | Notes |
|-------|------------------|--------|
| `/trajectory` | More | |
| `/timeline` | More | |
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
| `/projects/[projectId]/holes/new` | Project hole register | Cancel + dirty; success opens Current Hole |
| `/holes/completed` | Project Library | Global history |
| `/components` (registry) | More | |
| `/components/[componentId]` | Component registry | Organisation assignment history |
| `/trajectory/plan` | → `/trajectory` | Redirect |
| `/trajectory/setup` | → `/survey-settings` | Redirect; canonical More |

Hole isolation: parent `href` always uses the route’s `holeId`, not a different
active hole. `/holes/[holeId]/*` children render only after the local completion
repository confirms that the hole exists; only then is it stored as the
operator's recent hole.
