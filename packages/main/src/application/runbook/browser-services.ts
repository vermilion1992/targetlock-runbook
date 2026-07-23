import { createBrowserAuditRepository } from "@/infrastructure/audit";
import { createBrowserCasingRepository } from "@/infrastructure/casing";
import {
  createBrowserCompletionRepository,
  HoleMutationGuard,
} from "@/infrastructure/completion";
import { createBrowserComponentRepository } from "@/infrastructure/components";
import {
  createBrowserRunCorrectionRepository,
  createBrowserRunRepository,
} from "@/infrastructure/drafts";
import type { RunCorrectionServices } from "./run-correction-use-cases";
import { createBrowserMediaRepository } from "@/infrastructure/media";
import {
  createBrowserReportFileRepository,
  createBrowserReportMetadataRepository,
  createBrowserReportShareAdapter,
} from "@/infrastructure/reports";
import {
  ddh041Stage5AuditEntries,
  ddh041Stage2CurrentState,
  ddh041Stage2Shifts,
  stage6DefaultRecipients,
  targetLockStage5Seed,
} from "@/infrastructure/seed";
import { createShiftAnalyticsQueryServices } from "./shift-analytics-query";
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
  ReportServices;

export function createBrowserRunbookServices(): BrowserRunbookServices | null {
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

  const completion = createBrowserCompletionRepository(
    targetLockStage5Seed.organisation.localId,
    targetLockStage5Seed.completionSeed,
  );
  if (completion === null) return null;
  const mutationGuard = new HoleMutationGuard(completion);

  const runs = createBrowserRunRepository(migrationCandidates, mutationGuard);
  const shifts = createBrowserShiftRepository(
    ddh041Stage2Shifts,
    mutationGuard,
  );
  const audits = createBrowserAuditRepository(ddh041Stage5AuditEntries);
  const runCorrections = createBrowserRunCorrectionRepository(
    migrationCandidates,
    mutationGuard,
    audits ?? undefined,
  );
  let components: ReturnType<typeof createBrowserComponentRepository> = null;
  components = createBrowserComponentRepository(
    targetLockStage5Seed.organisation.localId,
    targetLockStage5Seed.components,
    targetLockStage5Seed.componentAssignments,
    async (input, result) => {
      if (components === null || audits === null) return;
      await recordComponentChangeAudit(input, result, {
        components,
        componentAssignments: components,
        audits,
      });
    },
    mutationGuard,
  );
  const casing = createBrowserCasingRepository(
    targetLockStage5Seed.casingStrings,
    targetLockStage5Seed.casingEvents,
    mutationGuard,
  );
  const media = createBrowserMediaRepository();
  const surveys = createBrowserSurveyRepository(
    targetLockStage5Seed.organisation.localId,
    targetLockStage5Seed.surveyTools,
    targetLockStage5Seed.surveys,
    mutationGuard,
  );
  const surveyTools =
    surveys === null ? null : createSurveyToolRepository(surveys);
  const trays = createBrowserTrayRepository(
    targetLockStage5Seed.trays,
    targetLockStage5Seed.photos,
    media ?? undefined,
    mutationGuard,
  );
  const photos = trays === null ? null : createBrowserPhotoRepository(trays);
  const reportFiles = createBrowserReportFileRepository();
  const reports = createBrowserReportMetadataRepository(
    targetLockStage5Seed.organisation.localId,
    stage6DefaultRecipients,
  );
  const share = createBrowserReportShareAdapter();
  if (
    runs === null ||
    shifts === null ||
    audits === null ||
    runCorrections === null ||
    components === null ||
    casing === null ||
    media === null ||
    surveys === null ||
    surveyTools === null ||
    trays === null ||
    photos === null ||
    reportFiles === null ||
    reports === null
  )
    return null;

  void runCorrections.recoverInterrupted(targetLockStage5Seed.hole.name);

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
  };
  const context = createHoleCompletionContextSource({
    currentState,
    completion,
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
      preferredSurveyIntervalDm:
        targetLockStage5Seed.holeConfigurations[0]?.preferredSurveyIntervalDm,
    },
  );

  return {
    runs,
    shifts,
    audits,
    runCorrections,
    mutationGuard,
    components,
    componentAssignments: components,
    casing,
    surveys,
    surveyTools,
    trays,
    photos,
    media,
    completion,
    context,
    currentState,
    reports,
    reportFiles,
    share,
    shiftAnalytics,
  };
}
