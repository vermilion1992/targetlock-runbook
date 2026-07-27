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

export function createBrowserRunbookServices(): BrowserRunbookServices | null {
  const projectsRaw = createBrowserProjectDirectoryRepository(
    targetLockStage5Seed.organisation.localId,
    [targetLockStage5Seed.project],
    [targetLockStage5Seed.rig],
  );
  if (projectsRaw === null) return null;
  const migrationCandidates = targetLockStage5Seed.componentAssignments.flatMap(
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
    targetLockStage5Seed.organisation.localId,
    targetLockStage5Seed.completionSeed,
  );
  if (completionRaw === null) return null;
  const mutationGuard = new HoleMutationGuard(completionRaw);
  const bhaSetupsRaw = createBrowserBottomHoleAssemblySetupRepository(
    targetLockStage5Seed.rodStringConfigurations.map((configuration) => ({
      ...configuration,
      holeId: targetLockStage5Seed.hole.localId,
    })),
    mutationGuard,
  );

  const runs = createBrowserRunRepository(migrationCandidates, mutationGuard);
  const shiftsRaw = createBrowserShiftRepository(
    ddh041Stage2Shifts,
    mutationGuard,
  );
  const auditsRaw = createBrowserAuditRepository(ddh041Stage5AuditEntries);
  const runCorrectionsRaw = createBrowserRunCorrectionRepository(
    migrationCandidates,
    mutationGuard,
    auditsRaw ?? undefined,
  );
  let componentsRaw: ReturnType<typeof createBrowserComponentRepository> = null;
  componentsRaw = createBrowserComponentRepository(
    targetLockStage5Seed.organisation.localId,
    targetLockStage5Seed.components,
    targetLockStage5Seed.componentAssignments,
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
    targetLockStage5Seed.casingStrings,
    targetLockStage5Seed.casingEvents,
    mutationGuard,
  );
  const media = createBrowserMediaRepository(
    targetLockStage5Seed.organisation.localId,
  );
  const surveysRaw = createBrowserSurveyRepository(
    targetLockStage5Seed.organisation.localId,
    targetLockStage5Seed.surveyTools,
    targetLockStage5Seed.surveys,
    mutationGuard,
  );
  const surveyToolsRaw =
    surveysRaw === null ? null : createSurveyToolRepository(surveysRaw);
  const trajectoryRaw = createBrowserTrajectoryRepository(
    trajectorySeedByHole,
    mutationGuard,
  );
  const traysRaw = createBrowserTrayRepository(
    targetLockStage5Seed.trays,
    targetLockStage5Seed.photos,
    media ?? undefined,
    mutationGuard,
  );
  const photosRaw =
    traysRaw === null ? null : createBrowserPhotoRepository(traysRaw);
  const reportFiles = createBrowserReportFileRepository(
    targetLockStage5Seed.organisation.localId,
  );
  const reportsRaw = createBrowserReportMetadataRepository(
    targetLockStage5Seed.organisation.localId,
    stage6DefaultRecipients,
  );
  const share = createBrowserReportShareAdapter();
  if (
    runs === null ||
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
    repository: T,
    synchronousMethods: readonly string[] = [],
  ): T =>
    coordinator === null
      ? repository
      : coordinateBrowserRepository(
          repository,
          coordinator,
          synchronousMethods,
        );
  const completion = coordinate(completionRaw, [
    "getHoleMutationSnapshot",
  ]);
  const bhaSetups = coordinate(bhaSetupsRaw);
  const shifts = coordinate(shiftsRaw);
  const audits = coordinate(auditsRaw);
  const runCorrections = coordinate(runCorrectionsRaw);
  const components = coordinate(componentsRaw);
  const casing = coordinate(casingRaw);
  const surveys = coordinate(surveysRaw, ["assertHoleMutable"]);
  const surveyTools = coordinate(surveyToolsRaw);
  const trajectory = coordinate(trajectoryRaw);
  const trays = coordinate(traysRaw);
  const photos = coordinate(photosRaw);
  const reports = coordinate(reportsRaw);
  const projects = coordinate(projectsRaw);
  const coordinatedMedia = coordinate(media);
  const coordinatedReportFiles = coordinate(reportFiles);

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
      runs: targetLockStage5Seed.runs,
      rodEvents: targetLockStage5Seed.rodEvents,
      holeId: targetLockStage5Seed.hole.localId,
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
      runs: targetLockStage5Seed.runs,
      rodEvents: targetLockStage5Seed.rodEvents,
      holeId: targetLockStage5Seed.hole.localId,
      plannedDepthDm: Number(targetLockStage5Seed.hole.plannedDepth),
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
