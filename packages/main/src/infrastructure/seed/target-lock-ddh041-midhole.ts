/**
 * Rich mid-hole demo sandbox for DDH041 (Try demo).
 *
 * Planned ~800 m / current ~630 m with many completed shifts, reconciled
 * runs/rods, surveys for trajectory guidance, trays, and an open day shift.
 * Labels stay clearly demo/relative — not a real mine site.
 */
import {
  calculateActiveRodInventory,
  calculateBaseRodString,
  calculateCurrentRodString,
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRecoveryPercentage,
  calculateRodNumber,
  decimetres,
  metresToDecimetres,
  SIX_METRE_ROD_LENGTH,
  type Hole,
  type HoleConfiguration,
  type HoleEvent,
  type Photo,
  type RodAddition,
  type RodStringConfiguration,
  type Run,
  type RunbookShift,
  type Survey,
  type SyncMetadata,
  type Tray,
} from "../../domain";

const DEVICE_ID = "seed-tablet-rig-10";
const HOLE_ID = "DDH041";
const SEED_CREATED_AT = "2026-06-01T06:00:00.000Z";
const DRILLING_START_DATE = "2026-06-16";

/** Planned depth for the active demo hole. */
export const DDH041_DEMO_PLANNED_DEPTH_M = 800;
/** Live current depth shown on Overview (open run in progress). */
export const DDH041_DEMO_CURRENT_DEPTH_M = 630;
/** Depth at end of last closed shift / start of open day shift. */
export const DDH041_DEMO_COMPLETED_BEFORE_OPEN_M = 627;

const BHA_DM = metresToDecimetres(4.3);
const CONSTANT_STICK_UP_DM = metresToDecimetres(1.8);
const BASE_ROD_STRING_DM = calculateBaseRodString(BHA_DM, CONSTANT_STICK_UP_DM);

const DAY_DRILLERS = [
  { id: "user-driller-hayes", name: "Jordan Hayes" },
  { id: "user-driller-hoffman", name: "M. Hoffman" },
] as const;
const NIGHT_DRILLERS = [
  { id: "user-driller-ward", name: "Casey Ward" },
  { id: "user-driller-smith", name: "J. Smith" },
] as const;

function metadata(
  localId: string,
  updatedAt = SEED_CREATED_AT,
): SyncMetadata {
  return {
    localId,
    serverId: `server-${localId}`,
    syncStatus: "synced",
    createdAt: SEED_CREATED_AT,
    updatedAt,
    deviceId: DEVICE_ID,
    version: 1,
  };
}

function isoAfter(base: string, minutes: number): string {
  return new Date(Date.parse(base) + minutes * 60_000).toISOString();
}

function dateStringAfter(startDate: string, dayOffset: number): string {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Closed-shift advances (metres) summing to 627.0 m.
 * Day shifts trend higher (20–32 m); night shifts lower (14–24 m).
 */
const CLOSED_SHIFT_ADVANCES_M = [
  // Day / Night pairs — early hole
  28, 18, 30, 16, 26, 20, 32, 14, 24, 22, 29, 17, 27, 19, 31, 15, 25, 21,
  // Mid hole (last night trimmed so the closed total is exactly 627 m)
  28, 16, 26, 18, 30, 14, 22, 20, 24, 15,
] as const;

const closedAdvanceSum = CLOSED_SHIFT_ADVANCES_M.reduce(
  (sum, value) => sum + value,
  0,
);
if (closedAdvanceSum !== DDH041_DEMO_COMPLETED_BEFORE_OPEN_M) {
  throw new Error(
    `DDH041 mid-hole closed advances sum to ${closedAdvanceSum} m; expected ${DDH041_DEMO_COMPLETED_BEFORE_OPEN_M} m.`,
  );
}

interface SimRun {
  readonly runNumber: number;
  readonly shiftId: string;
  readonly previousDepthDm: number;
  readonly holeDepthDm: number;
  readonly rodStringDm: number;
  readonly stickUpDm: number;
  readonly rodNumber: number;
  readonly rodAdded: boolean;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly status: Run["status"];
  readonly drillerId: string;
  readonly drillerName: string;
  readonly conditionTagId: string;
  readonly comment: string | null;
}

interface SimShift {
  readonly localId: string;
  readonly shiftType: "DAY" | "NIGHT";
  readonly shiftDate: string;
  readonly dayOffset: number;
  readonly drillerId: string;
  readonly drillerName: string;
  readonly startedAt: string;
  readonly closedAt: string | null;
  readonly status: "OPEN" | "CLOSED";
  readonly startingDepthDm: number;
  readonly endingDepthDm: number | null;
  readonly startingRodNumber: number;
  readonly endingRodNumber: number | null;
  readonly startingRodStringDm: number;
  readonly endingRodStringDm: number | null;
  readonly startingStickUpDm: number;
  readonly endingStickUpDm: number | null;
  readonly startingRunNumber: number;
  readonly endingRunNumber: number | null;
  readonly advanceM: number;
  readonly handoverNote?: string;
  readonly handoverRunId?: string;
}

function buildSimulation(): {
  readonly shifts: readonly SimShift[];
  readonly runs: readonly SimRun[];
  readonly rodAddTimes: readonly {
    readonly runNumber: number;
    readonly shiftId: string;
    readonly occurredAt: string;
    readonly rodNumberAfter: number;
  }[];
  readonly openShiftStartedAt: string;
  readonly openRunStartedAt: string;
} {
  const shifts: SimShift[] = [];
  const runs: SimRun[] = [];
  const rodAddTimes: {
    runNumber: number;
    shiftId: string;
    occurredAt: string;
    rodNumberAfter: number;
  }[] = [];

  let depthDm = 0;
  let rodStringDm = Number(BASE_ROD_STRING_DM);
  let stickUpDm = rodStringDm; // depth 0
  let rodNumber = 0;
  let runNumber = 0;

  const startDate = DRILLING_START_DATE;

  for (let index = 0; index < CLOSED_SHIFT_ADVANCES_M.length; index += 1) {
    const advanceM = CLOSED_SHIFT_ADVANCES_M[index]!;
    const isDay = index % 2 === 0;
    const dayOffset = Math.floor(index / 2);
    const shiftDate = dateStringAfter(startDate, dayOffset);
    const driller = isDay
      ? DAY_DRILLERS[dayOffset % DAY_DRILLERS.length]!
      : NIGHT_DRILLERS[dayOffset % NIGHT_DRILLERS.length]!;
    const shiftId = isDay
      ? `shift-ddh041-day-${shiftDate}`
      : `shift-ddh041-night-${shiftDate}`;
    const startedAt = isDay
      ? `${shiftDate}T06:00:00.000Z`
      : `${shiftDate}T18:00:00.000Z`;
    const closedAt = isDay
      ? `${shiftDate}T18:00:00.000Z`
      : `${dateStringAfter(startDate, dayOffset + 1)}T06:00:00.000Z`;

    const startingDepthDm = depthDm;
    const startingRodNumber = rodNumber;
    const startingRodStringDm = rodStringDm;
    const startingStickUpDm = stickUpDm;
    const startingRunNumber = runNumber + 1;
    let remainingDm = advanceM * 10;
    let runIndexInShift = 0;

    while (remainingDm > 0) {
      // Keep enough stick-up headroom for a typical ~3 m run.
      if (stickUpDm < 35) {
        rodStringDm += Number(SIX_METRE_ROD_LENGTH);
        stickUpDm += Number(SIX_METRE_ROD_LENGTH);
        rodNumber += 1;
        const upcomingRun = runNumber + 1;
        rodAddTimes.push({
          runNumber: upcomingRun,
          shiftId,
          occurredAt: isoAfter(startedAt, 15 + runIndexInShift * 28),
          rodNumberAfter: rodNumber,
        });
      }

      const maxByStickUp = Math.max(10, stickUpDm - 5);
      const drilledDm = Math.min(30, remainingDm, maxByStickUp);
      const previousDepthDm = depthDm;
      depthDm += drilledDm;
      stickUpDm -= drilledDm;
      remainingDm -= drilledDm;
      runNumber += 1;
      runIndexInShift += 1;

      const conditionTagId =
        runNumber % 11 === 0
          ? "run-tag-broken"
          : runNumber % 7 === 0
            ? "run-tag-core-gain"
            : "run-tag-competent";
      const recoveredBias = runNumber % 11 === 0 ? -2 : runNumber % 7 === 0 ? 1 : 0;

      runs.push({
        runNumber,
        shiftId,
        previousDepthDm,
        holeDepthDm: depthDm,
        rodStringDm,
        stickUpDm,
        rodNumber,
        rodAdded: rodAddTimes.some(
          (entry) =>
            entry.runNumber === runNumber && entry.shiftId === shiftId,
        ),
        startedAt: isoAfter(startedAt, 10 + (runIndexInShift - 1) * 28),
        completedAt: isoAfter(startedAt, 25 + (runIndexInShift - 1) * 28),
        status: "completed",
        drillerId: driller.id,
        drillerName: driller.name,
        conditionTagId,
        comment:
          conditionTagId === "run-tag-broken"
            ? "Broken ground; recovery watched closely."
            : conditionTagId === "run-tag-core-gain"
              ? "Minor measured core gain after tray check."
              : null,
        // recovered applied later from drilled
      });

      // Annotate recovered via drilled length once we materialize runs.
      void recoveredBias;
    }

    const nextDriller = isDay
      ? NIGHT_DRILLERS[dayOffset % NIGHT_DRILLERS.length]!
      : DAY_DRILLERS[(dayOffset + 1) % DAY_DRILLERS.length]!;

    shifts.push({
      localId: shiftId,
      shiftType: isDay ? "DAY" : "NIGHT",
      shiftDate,
      dayOffset,
      drillerId: driller.id,
      drillerName: driller.name,
      startedAt,
      closedAt,
      status: "CLOSED",
      startingDepthDm,
      endingDepthDm: depthDm,
      startingRodNumber,
      endingRodNumber: rodNumber,
      startingRodStringDm,
      endingRodStringDm: rodStringDm,
      startingStickUpDm,
      endingStickUpDm: stickUpDm,
      startingRunNumber,
      endingRunNumber: runNumber,
      advanceM,
      handoverNote: isDay
        ? `Day advance ${advanceM} m. String and trays reconciled.`
        : `Night advance ${advanceM} m. Ready for day crew.`,
      handoverRunId: undefined,
    });

    void nextDriller;
  }

  if (depthDm !== metresToDecimetres(DDH041_DEMO_COMPLETED_BEFORE_OPEN_M)) {
    throw new Error(
      `DDH041 mid-hole simulation ended closed depth at ${depthDm} dm; expected ${metresToDecimetres(DDH041_DEMO_COMPLETED_BEFORE_OPEN_M)} dm.`,
    );
  }

  // Open day shift with in-progress run advancing 627 → 630 m.
  const openDayOffset = Math.floor(CLOSED_SHIFT_ADVANCES_M.length / 2);
  const openDate = dateStringAfter(startDate, openDayOffset);
  const openShiftStartedAt = `${openDate}T06:00:00.000Z`;
  const openRunStartedAt = `${openDate}T07:20:00.000Z`;
  const openDriller = DAY_DRILLERS[0]!;
  const openShiftId = `shift-ddh041-day-${openDate}`;
  const openStartingDepthDm = depthDm;
  const openStartingRodNumber = rodNumber;
  const openStartingRodStringDm = rodStringDm;
  const openStartingStickUpDm = stickUpDm;
  const openStartingRunNumber = runNumber + 1;

  const openPreviousDepthDm = depthDm;
  const openDrilledDm =
    metresToDecimetres(DDH041_DEMO_CURRENT_DEPTH_M) - depthDm;
  if (openDrilledDm <= 0 || stickUpDm < openDrilledDm + 5) {
    throw new Error(
      `DDH041 open run cannot advance to ${DDH041_DEMO_CURRENT_DEPTH_M} m from stick-up ${stickUpDm} dm.`,
    );
  }
  depthDm += openDrilledDm;
  stickUpDm -= openDrilledDm;
  runNumber += 1;

  runs.push({
    runNumber,
    shiftId: openShiftId,
    previousDepthDm: openPreviousDepthDm,
    holeDepthDm: depthDm,
    rodStringDm,
    stickUpDm,
    rodNumber,
    rodAdded: false,
    startedAt: openRunStartedAt,
    completedAt: null,
    status: "in_progress",
    drillerId: openDriller.id,
    drillerName: openDriller.name,
    conditionTagId: "run-tag-competent",
    comment: "Open demo run — local sandbox only.",
  });

  shifts.push({
    localId: openShiftId,
    shiftType: "DAY",
    shiftDate: openDate,
    dayOffset: openDayOffset,
    drillerId: openDriller.id,
    drillerName: openDriller.name,
    startedAt: openShiftStartedAt,
    closedAt: null,
    status: "OPEN",
    startingDepthDm: openStartingDepthDm,
    endingDepthDm: null,
    startingRodNumber: openStartingRodNumber,
    endingRodNumber: null,
    startingRodStringDm: openStartingRodStringDm,
    endingRodStringDm: null,
    startingStickUpDm: openStartingStickUpDm,
    endingStickUpDm: null,
    startingRunNumber: openStartingRunNumber,
    endingRunNumber: null,
    advanceM: openDrilledDm / 10,
    handoverRunId: `run-ddh041-${runNumber}`,
  });

  if (depthDm !== metresToDecimetres(DDH041_DEMO_CURRENT_DEPTH_M)) {
    throw new Error(
      `DDH041 mid-hole current depth ${depthDm} dm; expected ${metresToDecimetres(DDH041_DEMO_CURRENT_DEPTH_M)} dm.`,
    );
  }

  return {
    shifts,
    runs,
    rodAddTimes,
    openShiftStartedAt,
    openRunStartedAt,
  };
}

const simulation = buildSimulation();

const TAG_LABELS: Record<string, string> = {
  "run-tag-competent": "Competent ground",
  "run-tag-broken": "Broken ground",
  "run-tag-core-gain": "Measured core gain",
};

export const ddh041MidholeRodStringConfigurations: readonly RodStringConfiguration[] =
  [
    {
      ...metadata("rod-config-ddh041-01"),
      holeId: HOLE_ID,
      effectiveAt: "2026-06-01T06:00:00.000Z",
      bottomHoleAssemblyLength: metresToDecimetres(4.5),
      constantStickUp: metresToDecimetres(2),
      baseRodStringLength: calculateBaseRodString(
        metresToDecimetres(4.5),
        metresToDecimetres(2),
      ),
      reason: "Initial HQ assembly (demo)",
    },
    {
      ...metadata("rod-config-ddh041-02", "2026-06-20T06:00:00.000Z"),
      holeId: HOLE_ID,
      effectiveAt: "2026-06-20T06:00:00.000Z",
      bottomHoleAssemblyLength: BHA_DM,
      constantStickUp: metresToDecimetres(2),
      baseRodStringLength: calculateBaseRodString(
        BHA_DM,
        metresToDecimetres(2),
      ),
      reason: "BHA shortened after reamer replacement (demo)",
    },
    {
      ...metadata("rod-config-ddh041-03", "2026-07-01T06:00:00.000Z"),
      holeId: HOLE_ID,
      effectiveAt: "2026-07-01T06:00:00.000Z",
      bottomHoleAssemblyLength: BHA_DM,
      constantStickUp: CONSTANT_STICK_UP_DM,
      baseRodStringLength: BASE_ROD_STRING_DM,
      reason: "Constant stick-up remeasured at 1.8 m (demo)",
    },
  ];

export const ddh041MidholeHoleConfigurations: readonly HoleConfiguration[] = [
  {
    ...metadata("hole-config-ddh041-01"),
    holeId: HOLE_ID,
    effectiveAt: "2026-06-01T06:00:00.000Z",
    holeSize: "HQ",
    plannedDepth: metresToDecimetres(DDH041_DEMO_PLANNED_DEPTH_M),
    preferredSurveyIntervalDm: decimetres(300),
    dipDegrees: -60,
    azimuthDegrees: 128,
    holeDiameterMillimetres: 96,
    reason: "Approved demo collar plan (relative)",
  },
  {
    ...metadata("hole-config-ddh041-02", "2026-06-10T06:00:00.000Z"),
    holeId: HOLE_ID,
    effectiveAt: "2026-06-10T06:00:00.000Z",
    holeSize: "HQ",
    plannedDepth: metresToDecimetres(DDH041_DEMO_PLANNED_DEPTH_M),
    preferredSurveyIntervalDm: decimetres(300),
    dipDegrees: -60,
    azimuthDegrees: 128,
    holeDiameterMillimetres: 96,
    reason: "HQ configuration confirmed after casing shoe (demo)",
  },
];

function createRodEvents(): readonly RodAddition[] {
  // Historical bulk adds covering rods that were in the string before the
  // first simulated run-linked add, then run-linked adds from the simulation.
  const linked = simulation.rodAddTimes;
  const maxRod = simulation.runs.reduce(
    (maximum, run) => Math.max(maximum, run.rodNumber),
    0,
  );
  const linkedRodNumbers = new Set(linked.map((entry) => entry.rodNumberAfter));
  const events: RodAddition[] = [];
  let sequence = 0;
  let rodNumber = 0;

  for (let target = 1; target <= maxRod; target += 1) {
    sequence += 1;
    rodNumber = target;
    const linkedEntry = linked.find(
      (entry) => entry.rodNumberAfter === target,
    );
    const occurredAt =
      linkedEntry?.occurredAt ??
      isoAfter(SEED_CREATED_AT, target * 90);
    events.push({
      ...metadata(
        `rod-event-ddh041-${String(sequence).padStart(3, "0")}`,
        occurredAt,
      ),
      holeId: HOLE_ID,
      runId: linkedEntry ? `run-ddh041-${linkedEntry.runNumber}` : null,
      shiftId: linkedEntry?.shiftId ?? null,
      sequence,
      action: "add",
      rodLength: SIX_METRE_ROD_LENGTH,
      affectedRodNumber: target,
      rodNumberAfterEvent: target,
      occurredAt,
      recordedByUserId: "user-driller-hayes",
      recordedByNameSnapshot: "Jordan Hayes",
    });
    void linkedRodNumbers;
  }

  return events;
}

export const ddh041MidholeRodEvents = createRodEvents();

const rodEventInputs = ddh041MidholeRodEvents.map(({ action, rodLength }) => ({
  action,
  rodLength,
}));
const activeRodInventory = calculateActiveRodInventory(rodEventInputs);
const projectedRodString = calculateCurrentRodString(
  BASE_ROD_STRING_DM,
  rodEventInputs,
);
const openRun = simulation.runs[simulation.runs.length - 1]!;
const measuredStickUp = decimetres(openRun.stickUpDm);
const currentHoleDepth = calculateHoleDepth(projectedRodString, measuredStickUp);
const previousCompletedDepth = decimetres(openRun.previousDepthDm);
const drilledLength = calculateDrilledLength(
  currentHoleDepth,
  previousCompletedDepth,
);
const recoveredLength = decimetres(
  Math.max(0, Number(drilledLength) - (openRun.runNumber % 11 === 0 ? 2 : 0)),
);

export const ddh041MidholeCurrentState = {
  activeThreeMetreRods: activeRodInventory.threeMetreRods,
  activeSixMetreRods: activeRodInventory.sixMetreRods,
  activeRodLength: activeRodInventory.totalLength,
  rodNumber: calculateRodNumber(rodEventInputs),
  bottomHoleAssemblyLength: BHA_DM,
  constantStickUp: CONSTANT_STICK_UP_DM,
  baseRodStringLength: BASE_ROD_STRING_DM,
  currentRodString: projectedRodString,
  measuredStickUp,
  currentHoleDepth,
  previousCompletedDepth,
  drilledLength,
  recoveredLength,
  recoveryPercentage: calculateRecoveryPercentage(
    drilledLength,
    recoveredLength,
  ),
} as const;

if (Number(currentHoleDepth) !== metresToDecimetres(DDH041_DEMO_CURRENT_DEPTH_M)) {
  throw new Error(
    `DDH041 mid-hole projected depth ${String(currentHoleDepth)} dm !== ${DDH041_DEMO_CURRENT_DEPTH_M} m.`,
  );
}
if (Number(projectedRodString) !== openRun.rodStringDm) {
  throw new Error(
    `DDH041 mid-hole rod string mismatch: projected ${String(projectedRodString)} vs run ${openRun.rodStringDm}.`,
  );
}

export const ddh041MidholeHole: Hole = {
  ...metadata(HOLE_ID, simulation.openShiftStartedAt),
  projectId: "project-briggs",
  rigId: "rig-10",
  name: HOLE_ID,
  holeSize: "HQ",
  plannedDepth: metresToDecimetres(DDH041_DEMO_PLANNED_DEPTH_M),
  currentDepth: currentHoleDepth,
  status: "drilling",
  // Relative demo collar offsets — not mine-grid coordinates.
  collarEasting: 1_000,
  collarNorthing: 2_000,
  collarElevation: 100,
  planReference: "DEMO-REL-041",
  planRevision: "A",
};

export const ddh041MidholeShifts: readonly RunbookShift[] =
  simulation.shifts.map((shift) => {
    const handoverAcceptor =
      shift.shiftType === "DAY"
        ? NIGHT_DRILLERS[shift.dayOffset % NIGHT_DRILLERS.length]!
        : DAY_DRILLERS[(shift.dayOffset + 1) % DAY_DRILLERS.length]!;

    return {
      ...metadata(shift.localId, shift.closedAt ?? simulation.openShiftStartedAt),
      holeId: HOLE_ID,
      rigId: "rig-10",
      shiftType: shift.shiftType,
      shiftDate: shift.shiftDate,
      primaryDrillerId: shift.drillerId,
      primaryDrillerNameSnapshot: shift.drillerName,
      crewMembers: [
        {
          userId: shift.drillerId,
          name: shift.drillerName,
          role: "Driller",
        },
      ],
      startedAt: shift.startedAt,
      ...(shift.closedAt === null ? {} : { closedAt: shift.closedAt }),
      startingDepthDm: decimetres(shift.startingDepthDm),
      ...(shift.endingDepthDm === null
        ? {}
        : { endingDepthDm: decimetres(shift.endingDepthDm) }),
      startingRodNumber: shift.startingRodNumber,
      ...(shift.endingRodNumber === null
        ? {}
        : { endingRodNumber: shift.endingRodNumber }),
      startingRodStringDm: decimetres(shift.startingRodStringDm),
      ...(shift.endingRodStringDm === null
        ? {}
        : { endingRodStringDm: decimetres(shift.endingRodStringDm) }),
      startingMeasuredStickUpDm: decimetres(shift.startingStickUpDm),
      ...(shift.endingStickUpDm === null
        ? {}
        : { endingMeasuredStickUpDm: decimetres(shift.endingStickUpDm) }),
      startingRunNumber: shift.startingRunNumber,
      ...(shift.endingRunNumber === null
        ? {}
        : { endingRunNumber: shift.endingRunNumber }),
      ...(shift.status === "CLOSED"
        ? {
            handoverNote: shift.handoverNote,
            handoverAcceptedBy: handoverAcceptor.id,
            handoverAcceptedByNameSnapshot: handoverAcceptor.name,
            handoverAcceptedAt: shift.closedAt!,
          }
        : {
            handoverRunId: shift.handoverRunId,
          }),
      status: shift.status,
    };
  });

export const ddh041MidholeRuns: readonly Run[] = simulation.runs.map((run) => {
  const previousDepth = decimetres(run.previousDepthDm);
  const stickUp = decimetres(run.stickUpDm);
  const rodString = decimetres(run.rodStringDm);
  const holeDepth = calculateHoleDepth(rodString, stickUp);
  const drilled = calculateDrilledLength(holeDepth, previousDepth);
  const recovered = decimetres(
    Math.max(
      0,
      Number(drilled) +
        (run.conditionTagId === "run-tag-core-gain"
          ? 1
          : run.conditionTagId === "run-tag-broken"
            ? -2
            : 0),
    ),
  );
  const rodEventIds = ddh041MidholeRodEvents
    .filter(({ runId }) => runId === `run-ddh041-${run.runNumber}`)
    .map(({ localId }) => localId);

  return {
    ...metadata(
      `run-ddh041-${run.runNumber}`,
      run.completedAt ?? simulation.openRunStartedAt,
    ),
    holeId: HOLE_ID,
    startedShiftId: run.shiftId,
    completedShiftId: run.completedAt === null ? null : run.shiftId,
    runNumber: run.runNumber,
    rodNumber: run.rodNumber,
    startedAt: run.startedAt,
    startedByUserId: run.drillerId,
    startedByNameSnapshot: run.drillerName,
    completedAt: run.completedAt,
    completedByUserId: run.completedAt === null ? null : run.drillerId,
    completedByNameSnapshot: run.completedAt === null ? null : run.drillerName,
    rodEventIds,
    rodAddedLength: run.rodAdded ? SIX_METRE_ROD_LENGTH : null,
    previousCompletedDepth: previousDepth,
    startDepth: previousDepth,
    measuredStickUp: stickUp,
    rodStringLength: rodString,
    holeDepth,
    drilledLength: drilled,
    recoveredLength: recovered,
    recoveryPercentage: calculateRecoveryPercentage(drilled, recovered),
    conditionTagIds: [run.conditionTagId],
    conditionTagLabelsSnapshot: [TAG_LABELS[run.conditionTagId] ?? "Competent ground"],
    comment: run.comment,
    correctionIds: [],
    activeBitSerialNumberSnapshot: "BIT-HQ-002193",
    activeReamerSerialNumberSnapshot: "REA-HQ-000912",
    activeBitAssignmentId: "assignment-bit-002193-ddh041",
    activeReamerAssignmentId: "assignment-reamer-000912-ddh041",
    casingSummarySnapshot: "PQ to 18.0 m; HQ to 42.0 m",
    status: run.status,
    holeNameSnapshot: HOLE_ID,
    rigNameSnapshot: "Rig 10",
  };
});

/** Surveys 0 → ~630 m at ~30 m spacing with slight plan deviation. */
export const ddh041MidholeSurveys: readonly Survey[] = (() => {
  const surveys: Survey[] = [];
  const intervalM = 30;
  const maxM = DDH041_DEMO_CURRENT_DEPTH_M;
  for (let depthM = 0; depthM <= maxM; depthM += intervalM) {
    const t = depthM / DDH041_DEMO_PLANNED_DEPTH_M;
    // Track the demo plan with a small, realistic actual offset so mid-hole
    // recovery guidance stays gently achievable (not REVIEW_REQUIRED).
    const planDipTenths = Math.round(-600 - t * 140);
    const planAzimuthTenths = Math.round(1_280 + t * 170);
    const dipTenths = planDipTenths - 2;
    const azimuthTenths = planAzimuthTenths + 2;
    const recordedAt = isoAfter(
      "2026-06-16T08:00:00.000Z",
      (depthM / intervalM) * 360,
    );
    surveys.push({
      ...metadata(`survey-ddh041-${depthM}`, recordedAt),
      holeId: HOLE_ID,
      surveyToolId: "survey-tool-reflex-01",
      depthDm: metresToDecimetres(depthM),
      dipTenths,
      azimuthTenths,
      northReference: "GRID",
      toolNameSnapshot: "EZ-TRAC",
      toolSerialSnapshot: "EZT-18427",
      comment:
        depthM === 0
          ? "Collar survey (demo relative)."
          : depthM === maxM
            ? "Latest survey near current depth (demo)."
            : undefined,
      photoId:
        depthM === 420 ? "photo-ddh041-survey-425" : undefined,
      recordedByUserId: "user-driller-hoffman",
      recordedByNameSnapshot: "M. Hoffman",
      recordedAt,
    });
  }
  return surveys;
})();

export const ddh041MidholeHoleEvents: readonly HoleEvent[] = [
  {
    ...metadata("hole-event-ddh041-started"),
    holeId: HOLE_ID,
    shiftId: null,
    eventType: "started",
    occurredAt: "2026-06-01T06:00:00.000Z",
    depth: metresToDecimetres(0),
    summary: "DDH041 demo drilling commenced",
    details: {
      plannedDepthDm: metresToDecimetres(DDH041_DEMO_PLANNED_DEPTH_M),
    },
    recordedByNameSnapshot: "Morgan Lee",
  },
  {
    ...metadata("hole-event-ddh041-casing", "2026-06-02T10:00:00.000Z"),
    holeId: HOLE_ID,
    shiftId: null,
    eventType: "casing_changed",
    occurredAt: "2026-06-02T10:00:00.000Z",
    depth: metresToDecimetres(18),
    summary: "PQ casing advanced from 6.0 m to 18.0 m",
    details: { casingSize: "PQ", previousDepthDm: 60, newDepthDm: 180 },
    recordedByNameSnapshot: "M. Hoffman",
  },
  {
    ...metadata("hole-event-ddh041-components", "2026-06-28T08:15:00.000Z"),
    holeId: HOLE_ID,
    shiftId: null,
    eventType: "component_changed",
    occurredAt: "2026-06-28T08:15:00.000Z",
    depth: metresToDecimetres(412.6),
    summary: "Bit changed at 412.6 m",
    details: {
      outgoingBitSerial: "BIT-HQ-001842",
      incomingBitSerial: "BIT-HQ-002193",
    },
    recordedByNameSnapshot: "M. Hoffman",
  },
  {
    ...metadata("hole-event-ddh041-bha", "2026-06-20T06:00:00.000Z"),
    holeId: HOLE_ID,
    shiftId: null,
    eventType: "configuration_changed",
    occurredAt: "2026-06-20T06:00:00.000Z",
    depth: metresToDecimetres(120),
    summary: "BHA changed from 4.5 m to 4.3 m",
    details: { previousBhaLengthDm: 45, newBhaLengthDm: 43 },
    recordedByNameSnapshot: "Morgan Lee",
  },
  {
    ...metadata("hole-event-ddh041-stick-up", "2026-07-01T06:00:00.000Z"),
    holeId: HOLE_ID,
    shiftId: null,
    eventType: "configuration_changed",
    occurredAt: "2026-07-01T06:00:00.000Z",
    depth: metresToDecimetres(360),
    summary: "Constant stick-up remeasured from 2.0 m to 1.8 m",
    details: {
      previousConstantStickUpDm: 20,
      newConstantStickUpDm: 18,
    },
    recordedByNameSnapshot: "Morgan Lee",
  },
];

/** Recent trays near current depth; photos reuse bundled placeholders. */
export const ddh041MidholeTrays: readonly Tray[] = [
  {
    ...metadata("tray-ddh041-103", "2026-07-14T12:00:00.000Z"),
    holeId: HOLE_ID,
    trayNumber: 103,
    startDepthDm: metresToDecimetres(612),
    endDepthDm: metresToDecimetres(618),
    comment: "Competent core; demo tray metadata.",
    primaryPhotoId: "photo-ddh041-tray-109",
    isFinalPartial: false,
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-14T12:00:00.000Z",
  },
  {
    ...metadata("tray-ddh041-104", "2026-07-14T18:00:00.000Z"),
    holeId: HOLE_ID,
    trayNumber: 104,
    startDepthDm: metresToDecimetres(618),
    endDepthDm: metresToDecimetres(624),
    comment: "Minor natural breaks near tray mid-point.",
    primaryPhotoId: "photo-ddh041-tray-110",
    isFinalPartial: false,
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-14T18:00:00.000Z",
  },
  {
    ...metadata("tray-ddh041-105", "2026-07-15T06:30:00.000Z"),
    holeId: HOLE_ID,
    trayNumber: 105,
    startDepthDm: metresToDecimetres(624),
    endDepthDm: metresToDecimetres(630),
    comment: "Current metre marks on open day shift (demo).",
    primaryPhotoId: "photo-ddh041-tray-111-a",
    isFinalPartial: false,
    recordedByUserId: "user-driller-hoffman",
    recordedByNameSnapshot: "M. Hoffman",
    recordedAt: "2026-07-15T06:30:00.000Z",
  },
];

export const ddh041MidholePhotos: readonly Photo[] = [
  {
    ...metadata("photo-ddh041-tray-109"),
    holeId: HOLE_ID,
    entityType: "TRAY",
    entityId: "tray-ddh041-103",
    category: "TRAY",
    originalStorageKey: "bundled:/images/targetlock/tray-109.svg",
    previewStorageKey: "bundled:/images/targetlock/tray-109.svg",
    originalFilename: "tray-109.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 4_096,
    capturedAt: "2026-07-14T11:40:00.000Z",
    description: "Demo core tray 103 photograph",
    createdByUserId: "user-geologist-patel",
    createdByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("photo-ddh041-tray-110"),
    holeId: HOLE_ID,
    entityType: "TRAY",
    entityId: "tray-ddh041-104",
    category: "TRAY",
    originalStorageKey: "bundled:/images/targetlock/tray-110.svg",
    previewStorageKey: "bundled:/images/targetlock/tray-110.svg",
    originalFilename: "tray-110.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 4_096,
    capturedAt: "2026-07-14T17:35:00.000Z",
    description: "Demo core tray 104 photograph",
    createdByUserId: "user-geologist-patel",
    createdByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("photo-ddh041-tray-111-a"),
    holeId: HOLE_ID,
    entityType: "TRAY",
    entityId: "tray-ddh041-105",
    category: "TRAY",
    originalStorageKey: "bundled:/images/targetlock/tray-111.svg",
    previewStorageKey: "bundled:/images/targetlock/tray-111.svg",
    originalFilename: "tray-111.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 4_096,
    capturedAt: "2026-07-15T06:10:00.000Z",
    description: "Demo core tray 105 photograph",
    createdByUserId: "user-geologist-patel",
    createdByNameSnapshot: "Priya Patel",
  },
  {
    ...metadata("photo-ddh041-survey-425", "2026-07-10T14:00:00.000Z"),
    holeId: HOLE_ID,
    entityType: "SURVEY",
    entityId: "survey-ddh041-420",
    category: "SURVEY",
    originalStorageKey: "bundled:/images/targetlock/survey-425.svg",
    previewStorageKey: "bundled:/images/targetlock/survey-425.svg",
    originalFilename: "survey-425.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 3_072,
    capturedAt: "2026-07-10T14:00:00.000Z",
    description: "EZ-TRAC result display for the 420.0 m demo survey",
    createdByUserId: "user-driller-hoffman",
    createdByNameSnapshot: "M. Hoffman",
  },
];
