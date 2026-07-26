import {
  type EffectiveRunProjection,
  type Run,
  type RunCorrectionImpact,
} from "@/domain";
import type {
  ApplyRunCorrectionInput,
  RunCorrectionRepository,
  RunCorrectionResult,
  VoidRunInput,
} from "@/infrastructure/drafts";
import type { SavedRunSnapshot } from "@/infrastructure/drafts";
import {
  freezeOriginalRunSnapshot,
  withDefaultRunCorrectionFields,
} from "@/infrastructure/drafts";
import type { AuditRepository } from "@/infrastructure/audit";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";
import {
  assertServicesHoleMutable,
  withHoleLockAudit,
} from "./hole-mutation-guard";

export interface RunCorrectionServices {
  readonly runCorrections: RunCorrectionRepository;
  readonly audits: AuditRepository;
  readonly mutationGuard?: HoleMutationGuardPort;
}

function seedRunsForHole(
  holeId: string,
  seedRuns: readonly Run[] | undefined,
): readonly Run[] {
  return (seedRuns ?? []).filter((run) => run.holeId === holeId);
}

export function runToEffectiveProjection(run: Run): EffectiveRunProjection {
  return {
    localId: run.localId,
    holeId: run.holeId,
    runNumber: run.runNumber,
    rodNumber: run.rodNumber,
    rodStringDm: run.rodStringLength,
    measuredStickUpDm: run.measuredStickUp,
    previousCompletedDepthDm: run.previousCompletedDepth,
    holeDepthDm: run.holeDepth,
    drilledLengthDm: run.drilledLength,
    recoveredLengthDm: run.recoveredLength,
    recoveryPercentage: run.recoveryPercentage,
    comment: run.comment ?? "",
    status:
      run.status === "in_progress"
        ? "completed"
        : run.status === "void"
          ? "void"
          : run.status === "corrected"
            ? "corrected"
            : "completed",
    version: run.version,
    activeBitSerialNumberSnapshot: run.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: run.activeReamerSerialNumberSnapshot,
    rodEvents: [],
  };
}

export function seedRunToLocalSnapshot(run: Run): SavedRunSnapshot {
  return withDefaultRunCorrectionFields({
    localId: run.localId,
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? run.startedAt,
    startedShiftId: run.startedShiftId,
    completedShiftId: run.completedShiftId ?? run.startedShiftId,
    startedByUserId: run.startedByUserId,
    startedByNameSnapshot: run.startedByNameSnapshot,
    completedByUserId: run.completedByUserId ?? run.startedByUserId,
    completedByNameSnapshot:
      run.completedByNameSnapshot ?? run.startedByNameSnapshot,
    holeId: run.holeId,
    syncStatus: "local-only",
    runNumber: run.runNumber,
    rodNumber: run.rodNumber,
    rodStringDm: run.rodStringLength,
    measuredStickUpDm: run.measuredStickUp,
    previousCompletedDepthDm: run.previousCompletedDepth,
    holeDepthDm: run.holeDepth,
    drilledLengthDm: run.drilledLength,
    recoveredLengthDm: run.recoveredLength,
    recoveryPercentage: run.recoveryPercentage,
    rodEvents: [],
    conditionTagIds: [...run.conditionTagIds],
    comment: run.comment ?? "",
    activeBitAssignmentId: run.activeBitAssignmentId,
    activeReamerAssignmentId: run.activeReamerAssignmentId,
    activeBitSerialNumberSnapshot: run.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: run.activeReamerSerialNumberSnapshot,
    casingSummarySnapshot: run.casingSummarySnapshot,
    version: run.version,
    status:
      run.status === "void"
        ? "void"
        : run.status === "corrected"
          ? "corrected"
          : "completed",
    correctionIds: [...run.correctionIds],
    originalSnapshot: null,
    voidReason: null,
    voidComment: null,
    voidedAt: null,
    voidedByUserId: null,
    voidedByNameSnapshot: null,
  });
}

export async function previewRunCorrectionForHole(
  input: {
    readonly holeId: string;
    readonly runId: string;
    readonly correctionType: ApplyRunCorrectionInput["correctionType"];
    readonly reason: string;
    readonly comment?: string;
    readonly measuredStickUpDm?: number;
    readonly recoveredLengthDm?: number;
    readonly runNumber?: number;
    readonly operationalNote?: string;
    readonly activeBitSerialNumberSnapshot?: string | null;
    readonly activeReamerSerialNumberSnapshot?: string | null;
    readonly rodEvent?: ApplyRunCorrectionInput["rodEvent"];
    readonly addRodEvent?: ApplyRunCorrectionInput["addRodEvent"];
    readonly surveyDepthsDm?: readonly number[];
    readonly reportIds?: readonly string[];
    readonly seedRuns?: readonly Run[];
  },
  services: RunCorrectionServices,
): Promise<RunCorrectionImpact> {
  return services.runCorrections.previewCorrection({
    holeId: input.holeId,
    runId: input.runId,
    correctionType: input.correctionType,
    reason: input.reason,
    comment: input.comment,
    measuredStickUpDm: input.measuredStickUpDm,
    recoveredLengthDm: input.recoveredLengthDm,
    runNumber: input.runNumber,
    operationalNote: input.operationalNote,
    activeBitSerialNumberSnapshot: input.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: input.activeReamerSerialNumberSnapshot,
    rodEvent: input.rodEvent,
    addRodEvent: input.addRodEvent,
    surveyDepthsDm: input.surveyDepthsDm,
    reportIdsByFingerprintRelevance: input.reportIds,
    seedRuns: seedRunsForHole(input.holeId, input.seedRuns).map(
      runToEffectiveProjection,
    ),
  });
}

export async function applyRunCorrection(
  input: ApplyRunCorrectionInput & { readonly seedRuns?: readonly Run[] },
  services: RunCorrectionServices,
): Promise<RunCorrectionResult> {
  return withHoleLockAudit(
    {
      holeId: input.holeId,
      entityType: "run",
      entityId: input.runId,
      attemptedAction: "correct_run",
      userId: input.correctedByUserId,
      userNameSnapshot: input.correctedByNameSnapshot,
      occurredAt: input.correctedAt,
      audits: services.audits,
    },
    async () => {
      assertServicesHoleMutable(input.holeId, services.mutationGuard);
      const envelope = await services.runCorrections.getEnvelope(input.holeId);
      const hasLocal = envelope?.snapshots.some(
        (snapshot) => snapshot.localId === input.runId,
      );
      if (!hasLocal && input.seedRuns) {
        const seed = seedRunsForHole(input.holeId, input.seedRuns).find(
          (run) => run.localId === input.runId,
        );
        if (seed !== undefined) {
          await services.runCorrections.materializeSeedRun(
            input.holeId,
            seedRunToLocalSnapshot(seed),
          );
        }
      }
      return services.runCorrections.apply(input);
    },
  );
}

export async function voidRun(
  input: VoidRunInput & { readonly seedRuns?: readonly Run[] },
  services: RunCorrectionServices,
): Promise<RunCorrectionResult> {
  return withHoleLockAudit(
    {
      holeId: input.holeId,
      entityType: "run",
      entityId: input.runId,
      attemptedAction: "void_run",
      userId: input.voidedByUserId,
      userNameSnapshot: input.voidedByNameSnapshot,
      occurredAt: input.voidedAt,
      audits: services.audits,
    },
    async () => {
      assertServicesHoleMutable(input.holeId, services.mutationGuard);
      const envelope = await services.runCorrections.getEnvelope(input.holeId);
      const hasLocal = envelope?.snapshots.some(
        (snapshot) => snapshot.localId === input.runId,
      );
      if (!hasLocal && input.seedRuns) {
        const seed = seedRunsForHole(input.holeId, input.seedRuns).find(
          (run) => run.localId === input.runId,
        );
        if (seed !== undefined) {
          await services.runCorrections.materializeSeedRun(
            input.holeId,
            {
              ...seedRunToLocalSnapshot(seed),
              originalSnapshot: freezeOriginalRunSnapshot(
                seedRunToLocalSnapshot(seed),
              ),
            },
          );
        }
      }
      return services.runCorrections.voidRun(input);
    },
  );
}

export async function previewVoidRunForHole(
  input: {
    readonly holeId: string;
    readonly runId: string;
    readonly reason: string;
    readonly comment?: string;
    readonly rodEventResolution: "VOID_WITH_RUN" | "REASSIGN" | "CANCEL";
    readonly reassignToRunId?: string;
    readonly surveyDepthsDm?: readonly number[];
    readonly reportIds?: readonly string[];
    readonly seedRuns?: readonly Run[];
  },
  services: RunCorrectionServices,
): Promise<RunCorrectionImpact> {
  return services.runCorrections.previewVoid({
    holeId: input.holeId,
    runId: input.runId,
    reason: input.reason,
    comment: input.comment,
    rodEventResolution: input.rodEventResolution,
    reassignToRunId: input.reassignToRunId,
    surveyDepthsDm: input.surveyDepthsDm,
    reportIdsByFingerprintRelevance: input.reportIds,
    seedRuns: seedRunsForHole(input.holeId, input.seedRuns).map(
      runToEffectiveProjection,
    ),
  });
}
