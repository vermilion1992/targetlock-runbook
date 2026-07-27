import {
  calculateCurrentRodString,
  calculateComponentUsage,
  calculateDistanceSinceLatestSurvey,
  calculateSurveyIntervalReminder,
  calculateRodNumber,
  decimetres,
  parseMetreInput,
  SIX_METRE_ROD_LENGTH,
  THREE_METRE_ROD_LENGTH,
  type Decimetres,
  type RunbookShift,
  type CasingString,
  type ComponentAssignment,
  type ComponentUsage,
  type Survey,
  type SurveyIntervalReminder,
  type Tray,
} from "@/domain";
import {
  latestSavedRunSnapshot,
  type DraftReadResult,
  type RunRepository,
  type SavedRunSnapshot,
} from "@/infrastructure/drafts";
import type {
  TargetLockStage1Seed,
  ddh041CurrentState,
} from "@/infrastructure/seed";
import type { ShiftRepository } from "@/infrastructure/shifts";
import type { CasingRepository } from "@/infrastructure/casing";
import type {
  BottomHoleAssemblySetupRepository,
  ComponentAssignmentRepository,
  ComponentRepository,
  BottomHoleAssemblySetup,
} from "@/infrastructure/components";
import type { SurveyRepository } from "@/infrastructure/surveys";
import type { TrayRepository } from "@/infrastructure/trays";
import type { TrajectoryRepository } from "@/infrastructure/trajectory";

type SeedCurrentState = typeof ddh041CurrentState;

export interface CurrentHoleState {
  readonly holeId: string;
  readonly currentDepthDm: Decimetres;
  readonly previousCompletedDepthDm: Decimetres;
  readonly currentRodNumber: number;
  readonly currentRodStringDm: Decimetres;
  readonly measuredStickUpDm?: Decimetres;
  readonly nextRunNumber: number;
  readonly lastCompletedRunNumber: number;
  readonly activeShift: RunbookShift | null;
  readonly pendingHandover: RunbookShift | null;
  readonly draft: DraftReadResult;
  readonly completedLocalRuns: readonly SavedRunSnapshot[];
  readonly currentTrayNumber?: number;
  readonly latestSurveyDepthDm?: Decimetres;
  readonly latestSurvey?: Survey;
  readonly lastCompletedTray?: Tray;
  readonly surveys: readonly Survey[];
  readonly trays: readonly Tray[];
  readonly distanceSinceLatestSurveyDm?: Decimetres;
  readonly surveyIntervalReminder?: SurveyIntervalReminder;
  readonly activeBitSerialNumber?: string;
  readonly activeReamerSerialNumber?: string;
  readonly activeBitAssignment?: ComponentAssignment;
  readonly activeReamerAssignment?: ComponentAssignment;
  readonly activeBitUsage?: ComponentUsage;
  readonly activeReamerUsage?: ComponentUsage;
  readonly casingStrings: readonly CasingString[];
  readonly bhaSetup: BottomHoleAssemblySetup | null;
}

export interface CurrentHoleStateDependencies {
  readonly seed: TargetLockStage1Seed;
  readonly seedCurrentState: SeedCurrentState;
  readonly runs: RunRepository;
  readonly shifts: ShiftRepository;
  readonly casing: CasingRepository;
  readonly components: ComponentRepository;
  readonly componentAssignments: ComponentAssignmentRepository;
  readonly bhaSetups?: BottomHoleAssemblySetupRepository;
  readonly surveys: SurveyRepository;
  readonly trays: TrayRepository;
  readonly trajectory?: Pick<TrajectoryRepository, "getActualConfiguration">;
}

export class CurrentHoleStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurrentHoleStateError";
  }
}

export async function getCurrentHoleState(
  holeId: string,
  dependencies: CurrentHoleStateDependencies,
): Promise<CurrentHoleState> {
  const {
    seed,
    seedCurrentState,
    runs,
    shifts,
    casing,
    components,
    componentAssignments,
    bhaSetups,
    surveys,
    trays,
    trajectory,
  } = dependencies;
  const isPrimarySeedHole = seed.hole.name === holeId;

  const completedResult = runs.readCompletedRuns(holeId);
  if (completedResult.status === "invalid") {
    throw new CurrentHoleStateError(completedResult.reason);
  }
  const completedLocalRuns = completedResult.snapshots;
  const latestLocal = latestSavedRunSnapshot(completedLocalRuns);
  const draft = runs.readDraft(holeId);
  if (draft.status === "invalid") {
    throw new CurrentHoleStateError(draft.reason);
  }

  const seedCompletedRuns = isPrimarySeedHole
    ? seed.runs.filter((run) => run.status !== "in_progress")
    : [];
  const latestSeedCompleted = seedCompletedRuns.reduce<
    (typeof seedCompletedRuns)[number] | undefined
  >(
    (latest, run) =>
      latest === undefined || run.runNumber > latest.runNumber ? run : latest,
    undefined,
  );
  const seedInProgress = isPrimarySeedHole
    ? seed.runs.find((run) => run.status === "in_progress")
    : undefined;

  let currentDepthDm = decimetres(
    latestLocal?.holeDepthDm ??
      (isPrimarySeedHole ? seedCurrentState.currentHoleDepth : 0),
  );
  let currentRodNumber =
    latestLocal?.rodNumber ??
    (isPrimarySeedHole ? seedCurrentState.rodNumber : 0);
  let currentRodStringDm = decimetres(
    latestLocal?.rodStringDm ??
      (isPrimarySeedHole ? seedCurrentState.currentRodString : 0),
  );
  let measuredStickUpDm: Decimetres | undefined =
    latestLocal?.measuredStickUpDm !== undefined
      ? decimetres(latestLocal.measuredStickUpDm)
      : isPrimarySeedHole
        ? decimetres(seedCurrentState.measuredStickUp)
        : undefined;
  let nextRunNumber =
    latestLocal?.runNumber !== undefined
      ? latestLocal.runNumber + 1
      : (seedInProgress?.runNumber ??
        (latestSeedCompleted?.runNumber ?? 0) + 1);

  if (draft.status === "valid") {
    const payload = draft.envelope.payload;
    const events = payload.pendingRodEvents.map((event) => ({
      action: event.action,
      rodLength:
        event.rodLengthDm === 30
          ? THREE_METRE_ROD_LENGTH
          : SIX_METRE_ROD_LENGTH,
    }));
    currentRodStringDm = calculateCurrentRodString(
      decimetres(payload.context.currentRodStringDm),
      events,
    );
    currentRodNumber = calculateRodNumber(
      events,
      payload.context.rodNumber,
    );
    const parsedStickUp = parseMetreInput(payload.stickUpMetresInput);
    measuredStickUpDm = parsedStickUp.ok ? parsedStickUp.value : undefined;
    currentDepthDm = decimetres(payload.context.previousCompletedDepthDm);
    nextRunNumber = payload.context.runNumber;
  }

  const [
    activeShift,
    pendingHandover,
    activeBitAssignment,
    activeReamerAssignment,
    casingStrings,
    surveyRecords,
    trayRecords,
    actualTrajectoryConfiguration,
    bhaSetupHistory,
  ] = await Promise.all([
    shifts.getActiveShift(holeId),
    shifts.getPendingHandover(holeId),
    componentAssignments.getActive(holeId, "BIT"),
    componentAssignments.getActive(holeId, "REAMER"),
    casing.listByHole(holeId),
    surveys.listByHole(holeId),
    trays.listByHole(holeId),
    trajectory?.getActualConfiguration(holeId) ?? Promise.resolve(null),
    bhaSetups?.listByHole(holeId) ?? Promise.resolve([]),
  ]);
  const currentBhaSetup = bhaSetupHistory.at(-1);
  if (currentBhaSetup !== undefined) {
    const latestRunCompletedAt = latestLocal?.completedAt;
    const baseAtLatestRun =
      latestRunCompletedAt === undefined
        ? isPrimarySeedHole
          ? seed.rodStringConfigurations.at(-1)?.baseRodStringLength ??
            decimetres(0)
          : decimetres(0)
        : [...bhaSetupHistory]
            .reverse()
            .find(
              ({ effectiveAt }) =>
                Date.parse(effectiveAt) <= Date.parse(latestRunCompletedAt),
            )?.baseRodStringLengthDm ??
          (isPrimarySeedHole
            ? seed.rodStringConfigurations.at(-1)?.baseRodStringLength
            : decimetres(0)) ??
          decimetres(0);
    currentRodStringDm = decimetres(
      Number(currentRodStringDm) +
        Number(currentBhaSetup.baseRodStringLengthDm) -
        Number(baseAtLatestRun),
    );
  }
  const latestSurvey = [...surveyRecords].sort(
    (left, right) =>
      right.depthDm - left.depthDm ||
      Date.parse(right.recordedAt) - Date.parse(left.recordedAt),
  )[0];
  const lastCompletedTray = [...trayRecords].sort(
    (left, right) => right.trayNumber - left.trayNumber,
  )[0];
  const preferredSurveyIntervalDm =
    actualTrajectoryConfiguration?.preferredSurveyIntervalDm ??
    (isPrimarySeedHole
      ? [...seed.holeConfigurations].sort(
          (left, right) =>
            Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt),
        )[0]?.preferredSurveyIntervalDm
      : undefined);
  const [activeBit, activeReamer] = await Promise.all([
    activeBitAssignment === null
      ? Promise.resolve(null)
      : components.getById(activeBitAssignment.componentId),
    activeReamerAssignment === null
      ? Promise.resolve(null)
      : components.getById(activeReamerAssignment.componentId),
  ]);
  const localRunNumbers = new Set(
    completedLocalRuns.map(({ runNumber }) => runNumber),
  );
  const usageRuns = [
    ...(isPrimarySeedHole
      ? seed.runs
          .filter(
            (run) =>
              run.status !== "in_progress" &&
              !localRunNumbers.has(run.runNumber),
          )
          .map((run) => ({
            localId: run.localId,
            startDepth: run.startDepth,
            holeDepth: run.holeDepth,
            drilledLength: run.drilledLength,
            recoveredLength: run.recoveredLength,
            recoveryPercentage: run.recoveryPercentage,
            status: run.status,
          }))
      : []),
    ...completedLocalRuns.map((run) => ({
      localId: run.localId,
      startDepth: decimetres(run.previousCompletedDepthDm),
      holeDepth: decimetres(run.holeDepthDm),
      drilledLength: decimetres(run.drilledLengthDm),
      recoveredLength: decimetres(run.recoveredLengthDm),
      recoveryPercentage: run.recoveryPercentage,
      status: "completed" as const,
    })),
  ];

  return {
    holeId,
    currentDepthDm,
    previousCompletedDepthDm: decimetres(
      latestLocal?.previousCompletedDepthDm ??
        (isPrimarySeedHole ? seedCurrentState.previousCompletedDepth : 0),
    ),
    currentRodNumber,
    currentRodStringDm,
    measuredStickUpDm,
    nextRunNumber,
    lastCompletedRunNumber:
      latestLocal?.runNumber ?? latestSeedCompleted?.runNumber ?? 0,
    activeShift,
    pendingHandover,
    draft,
    completedLocalRuns,
    currentTrayNumber: lastCompletedTray?.trayNumber,
    latestSurveyDepthDm: latestSurvey?.depthDm,
    latestSurvey,
    lastCompletedTray,
    surveys: surveyRecords,
    trays: trayRecords,
    distanceSinceLatestSurveyDm: calculateDistanceSinceLatestSurvey(
      currentDepthDm,
      surveyRecords,
    ),
    surveyIntervalReminder: calculateSurveyIntervalReminder(
      currentDepthDm,
      surveyRecords,
      preferredSurveyIntervalDm,
    ),
    activeBitSerialNumber:
      currentBhaSetup?.bitSerialNumber ?? activeBit?.serialNumber,
    activeReamerSerialNumber:
      currentBhaSetup?.frontReamerSerialNumber ?? activeReamer?.serialNumber,
    activeBitAssignment: activeBitAssignment ?? undefined,
    activeReamerAssignment: activeReamerAssignment ?? undefined,
    activeBitUsage:
      activeBitAssignment === null
        ? undefined
        : calculateComponentUsage(activeBitAssignment, usageRuns),
    activeReamerUsage:
      activeReamerAssignment === null
        ? undefined
        : calculateComponentUsage(activeReamerAssignment, usageRuns),
    casingStrings,
    bhaSetup: currentBhaSetup ?? null,
  };
}
