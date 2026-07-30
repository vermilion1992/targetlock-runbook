import { createBrowserAuditRepository } from "@/infrastructure/audit";
import { createBrowserCasingRepository } from "@/infrastructure/casing";
import {
  createBrowserCompletionRepository,
  HoleMutationGuard,
} from "@/infrastructure/completion";
import {
  createBrowserBottomHoleAssemblySetupRepository,
  createBrowserComponentRepository,
} from "@/infrastructure/components";
import {
  coordinateBrowserRepository,
  createBrowserRunCorrectionRepository,
  createBrowserRunRepository,
  getBrowserRunbookOperationCoordinator,
} from "@/infrastructure/drafts";
import type { RunCorrectionServices } from "./run-correction-use-cases";
import { createBrowserMediaRepository } from "@/infrastructure/media";
import {
  createBrowserReportFileRepository,
  createBrowserReportMetadataRepository,
  createBrowserReportShareAdapter,
} from "@/infrastructure/reports";
import {
  createBrowserProjectDirectoryRepository,
  type ProjectDirectoryRepository,
} from "@/infrastructure/projects";
import {
  ddh041Stage5AuditEntries,
  ddh041Stage2CurrentState,
  ddh041Stage2Shifts,
  stage6DefaultRecipients,
  targetLockStage5Seed,
  trajectorySeedByHole,
} from "@/infrastructure/seed";
import { createBrowserTrajectoryRepository } from "@/infrastructure/trajectory";
import { createHoleAnalyticsQueryServices } from "./hole-analytics-query";
import { createShiftAnalyticsQueryServices } from "./shift-analytics-query";
import { createTrajectoryComparisonQueryServices } from "./trajectory-comparison-query";
import { createMiniTargetLockQueryServices } from "./mini-target-lock-query";
import { createBrowserShiftRepository } from "@/infrastructure/shifts";
import {
  createBrowserSurveyRepository,
  createSurveyToolRepository,
} from "@/infrastructure/surveys";
import {
  createBrowserPhotoRepository,
  createBrowserTrayRepository,
} from "@/infrastructure/trays";
import type { ReportServices } from "@/application/reports";
import {
  getBrowserRuntimeMode,
  getPilotBrowserRuntimeContext,
} from "@/infrastructure/sync";
import type { RunServices } from "./run-use-cases";
import type { ShiftServices } from "./shift-use-cases";
import {
  recordComponentChangeAudit,
  type ComponentServices,
} from "./component-use-cases";
import type { CasingServices } from "./casing-use-cases";
import type { SurveyServices } from "./survey-use-cases";
import type { TrayServices } from "./tray-use-cases";
import {
  createHoleCompletionContextSource,
  type HoleCompletionApplicationServices,
} from "./hole-completion-use-cases";

export type BrowserRunbookServices = ShiftServices &
  RunServices &
  RunCorrectionServices &
  ComponentServices &
  CasingServices &
  SurveyServices &
  TrayServices &
  HoleCompletionApplicationServices &
  ReportServices & {
    readonly projects: ProjectDirectoryRepository;
    readonly bhaSetups: NonNullable<
      ReturnType<typeof createBrowserBottomHoleAssemblySetupRepository>
    >;
    readonly trajectory: NonNullable<
      ReturnType<typeof createBrowserTrajectoryRepository>
    >;
    readonly trajectoryComparison: ReturnType<
      typeof createTrajectoryComparisonQueryServices
    >;
    readonly miniTargetLock: ReturnType<
      typeof createMiniTargetLockQueryServices
    >;
  };

export function shouldHydrateDemoRunbookData(
  mode: "unknown" | "demo" | "pilot",
): boolean {
  return mode === "demo";
}

export function createBrowserRunbookServices(): BrowserRunbookServices | null {
  const runtimeMode = getBrowserRuntimeMode();
  const demoDataEnabled = shouldHydrateDemoRunbookData(runtimeMode);
  const pilotRuntime = getPilotBrowserRuntimeContext();
  const organisationId =
    pilotRuntime?.organisationId ?? targetLockStage5Seed.organisation.localId;
  const seedProjects = demoDataEnabled ? [targetLockStage5Seed.project] : [];
  const seedRigs = demoDataEnabled ? [targetLockStage5Seed.rig] : [];
  const seedHoles = demoDataEnabled
    ? targetLockStage5Seed.completionSeed
    : { holes: [] };
  const projectsRaw = createBrowserProjectDirectoryRepository(
    organisationId,
    seedProjects,
    seedRigs,
  );
  if (projectsRaw === null) return null;
  const migrationCandidates = (demoDataEnabled
    ? targetLockStage5Seed.componentAssignments
    : []
  ).flatMap(
    (assignment) => {
      const component = targetLockStage5Seed.components.find(
        ({ localId }) => localId === assignment.componentId,
      );
      return component === undefined
        ? []
        : [
            {
              assignmentId: assignment.localId,
              componentType: assignment.componentType,
              serialNumber: component.serialNumber,
              holeId: assignment.holeId,
              startDepthDm: assignment.startDepthDm,
              endDepthDm: assignment.endDepthDm,
            },
          ];
    },
  );

  const completionRaw = createBrowserCompletionRepository(
    organisationId,
    seedHoles,
  );
  if (completionRaw === null) return null;
  const mutationGuard = new HoleMutationGuard(completionRaw);
  const bhaSetupsRaw = createBrowserBottomHoleAssemblySetupRepository(
    demoDataEnabled
      ? targetLockStage5Seed.rodStringConfigurations.map((configuration) => ({
          ...configuration,
          holeId: targetLockStage5Seed.hole.localId,
        }))
      : [],
    mutationGuard,
  );

  // The manifest proxy below owns serialization for service mutations. Avoid
  // acquiring the same non-reentrant browser lock again inside the run store.
  const runsRaw = createBrowserRunRepository(
    migrationCandidates,
    mutationGuard,
    false,
  );
  const shiftsRaw = createBrowserShiftRepository(
    demoDataEnabled ? ddh041Stage2Shifts : [],
    mutationGuard,
  );
  const auditsRaw = createBrowserAuditRepository(
    demoDataEnabled ? ddh041Stage5AuditEntries : [],
  );
  const runCorrectionsRaw = createBrowserRunCorrectionRepository(
    migrationCandidates,
    mutationGuard,
    auditsRaw ?? undefined,
  );
  let componentsRaw: ReturnType<typeof createBrowserComponentRepository> = null;
  componentsRaw = createBrowserComponentRepository(
    organisationId,
    demoDataEnabled ? targetLockStage5Seed.components : [],
    demoDataEnabled ? targetLockStage5Seed.componentAssignments : [],
    async (input, result) => {
      if (componentsRaw === null || auditsRaw === null) return;
      await recordComponentChangeAudit(input, result, {
        components: componentsRaw,
        componentAssignments: componentsRaw,
        audits: auditsRaw,
      });
    },
    mutationGuard,
  );
  const casingRaw = createBrowserCasingRepository(
    demoDataEnabled ? targetLockStage5Seed.casingStrings : [],
    demoDataEnabled ? targetLockStage5Seed.casingEvents : [],
    mutationGuard,
  );
  const media = createBrowserMediaRepository(
    organisationId,
  );
  const surveysRaw = createBrowserSurveyRepository(
    organisationId,
    demoDataEnabled ? targetLockStage5Seed.surveyTools : [],
    demoDataEnabled ? targetLockStage5Seed.surveys : [],
    mutationGuard,
  );
  const surveyToolsRaw =
    surveysRaw === null ? null : createSurveyToolRepository(surveysRaw);
  const trajectoryRaw = createBrowserTrajectoryRepository(
    demoDataEnabled ? trajectorySeedByHole : new Map(),
    mutationGuard,
  );
  const traysRaw = createBrowserTrayRepository(
    demoDataEnabled ? targetLockStage5Seed.trays : [],
    demoDataEnabled ? targetLockStage5Seed.photos : [],
    media ?? undefined,
    mutationGuard,
  );
  const photosRaw =
    traysRaw === null ? null : createBrowserPhotoRepository(traysRaw);
  const reportFiles = createBrowserReportFileRepository(
    organisationId,
  );
  const reportsRaw = createBrowserReportMetadataRepository(
    organisationId,
    demoDataEnabled ? stage6DefaultRecipients : [],
  );
  const share = createBrowserReportShareAdapter();
  if (
    runsRaw === null ||
    shiftsRaw === null ||
    auditsRaw === null ||
    runCorrectionsRaw === null ||
    bhaSetupsRaw === null ||
    componentsRaw === null ||
    casingRaw === null ||
    media === null ||
    surveysRaw === null ||
    surveyToolsRaw === null ||
    trajectoryRaw === null ||
    traysRaw === null ||
    photosRaw === null ||
    reportFiles === null ||
    reportsRaw === null
  )
    return null;

  const coordinator = getBrowserRunbookOperationCoordinator();
  const coordinate = <T extends object>(
    repositoryName: string,
    repository: T,
  ): T =>
    coordinator === null
      ? repository
      : coordinateBrowserRepository(
          repository,
          coordinator,
          repositoryName,
        );
  const completion = coordinate("completion", completionRaw);
  const runs = coordinate("runs", runsRaw);
  const bhaSetups = coordinate("bha-setups", bhaSetupsRaw);
  const shifts = coordinate("shifts", shiftsRaw);
  const audits = coordinate("audits", auditsRaw);
  const runCorrections = coordinate("run-corrections", runCorrectionsRaw);
  const components = coordinate("components", componentsRaw);
  const casing = coordinate("casing", casingRaw);
  const surveys = coordinate("surveys", surveysRaw);
  const surveyTools = coordinate("survey-tools", surveyToolsRaw);
  const trajectory = coordinate("trajectory", trajectoryRaw);
  const trays = coordinate("trays", traysRaw);
  const photos = coordinate("photos", photosRaw);
  const reports = coordinate("reports", reportsRaw);
  const projects = coordinate("projects", projectsRaw);
  const coordinatedMedia = coordinate("media", media);
  const coordinatedReportFiles = coordinate("report-files", reportFiles);

  void completion
    .listHoles()
    .then((holes) =>
      Promise.all(
        holes.map((hole) => runCorrections.recoverInterrupted(hole.localId)),
      ),
    )
    .catch(() => undefined);

  const currentState = {
    seed: targetLockStage5Seed,
    seedCurrentState: ddh041Stage2CurrentState,
    enableSeedFallback: demoDataEnabled,
    runs,
    shifts,
    components,
    componentAssignments: components,
    casing,
    surveys,
    trays,
    trajectory,
    bhaSetups,
  };
  const context = createHoleCompletionContextSource({
    currentState,
    completion,
    projects,
    pendingOperations: {
      countPendingMediaOperations: async (holeId) =>
        (await trays.listPendingOperations(holeId)).length,
      countPendingCorrections: async (holeId) =>
        Number(await components.hasPendingChangeOperation(holeId)) +
        Number(await shifts.hasPendingHandoverOperation(holeId)),
    },
  });

  const shiftAnalytics = createShiftAnalyticsQueryServices(
    {
      shifts,
      runs,
      runCorrections,
      surveys,
      trays,
      casing,
      componentAssignments: components,
      currentState,
    },
    {
      runs: demoDataEnabled ? targetLockStage5Seed.runs : [],
      rodEvents: demoDataEnabled ? targetLockStage5Seed.rodEvents : [],
      holeId: demoDataEnabled
        ? targetLockStage5Seed.hole.localId
        : "__NO_DEMO_HOLE__",
      preferredSurveyIntervalDm:
        targetLockStage5Seed.holeConfigurations[0]?.preferredSurveyIntervalDm,
    },
  );

  const holeAnalytics = createHoleAnalyticsQueryServices(
    {
      shifts,
      runs,
      runCorrections,
      surveys,
      trays,
      casing,
      components,
      componentAssignments: components,
      bhaSetups,
      completion,
      currentState,
      shiftAnalytics,
    },
    {
      runs: demoDataEnabled ? targetLockStage5Seed.runs : [],
      rodEvents: demoDataEnabled ? targetLockStage5Seed.rodEvents : [],
      holeId: demoDataEnabled
        ? targetLockStage5Seed.hole.localId
        : "__NO_DEMO_HOLE__",
      plannedDepthDm: demoDataEnabled
        ? Number(targetLockStage5Seed.hole.plannedDepth)
        : 0,
      preferredSurveyIntervalDm:
        targetLockStage5Seed.holeConfigurations[0]?.preferredSurveyIntervalDm,
    },
  );

  const trajectoryComparison = createTrajectoryComparisonQueryServices({
    trajectory,
    surveys,
    currentState,
  });
  const miniTargetLock = createMiniTargetLockQueryServices({
    trajectory,
    surveys,
  });

  return {
    projects,
    runs,
    shifts,
    audits,
    runCorrections,
    mutationGuard,
    components,
    componentAssignments: components,
    bhaSetups,
    casing,
    surveys,
    surveyTools,
    trajectory,
    trajectoryComparison,
    miniTargetLock,
    trays,
    photos,
    media: coordinatedMedia,
    completion,
    context,
    currentState,
    reports,
    reportFiles: coordinatedReportFiles,
    share,
    shiftAnalytics,
    holeAnalytics,
  };
}
