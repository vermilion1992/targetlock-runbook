import {
  decimetres,
  previewRunCorrection,
  previewVoidRun,
  type EffectiveRunProjection,
  type PreviewRunCorrectionInput,
  type PreviewVoidRunInput,
  type RunCorrectionImpact,
} from "@/domain";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";
import type { AuditRepository } from "@/infrastructure/audit";
import {
  freezeOriginalRunSnapshot,
  readSavedRunSnapshots,
  writeSavedRunsEnvelope,
  withDefaultRunCorrectionFields,
  type RunAssignmentMigrationCandidate,
  type RunCorrectionOperation,
  type RunCorrectionRecord,
  type RunCorrectionType,
  type RunVoidReason,
  type SavedRunSnapshot,
  type SavedRunsEnvelope,
} from "./run-drafts";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "./storage";

function stableInput(value: unknown): string {
  return JSON.stringify(value);
}

export class RunCorrectionRepositoryError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "BLOCKED"
      | "LOCKED"
      | "INVALID"
      | "FAILED",
    message: string,
  ) {
    super(message);
    this.name = "RunCorrectionRepositoryError";
  }
}

export interface ApplyRunCorrectionInput {
  readonly operationId: string;
  readonly correctionId: string;
  readonly holeId: string;
  readonly runId: string;
  readonly expectedVersion: number;
  readonly correctionType: Exclude<RunCorrectionType, "VOID">;
  readonly reason: string;
  readonly comment?: string;
  readonly measuredStickUpDm?: number;
  readonly recoveredLengthDm?: number;
  readonly runNumber?: number;
  readonly operationalNote?: string;
  readonly activeBitSerialNumberSnapshot?: string | null;
  readonly activeReamerSerialNumberSnapshot?: string | null;
  readonly rodEvent?: PreviewRunCorrectionInput["rodEvent"];
  readonly addRodEvent?: PreviewRunCorrectionInput["addRodEvent"];
  readonly correctedAt: string;
  readonly correctedByUserId: string;
  readonly correctedByNameSnapshot: string;
  readonly surveyDepthsDm?: readonly number[];
  readonly reportIds?: readonly string[];
  readonly acknowledgeWarnings?: boolean;
}

export interface VoidRunInput {
  readonly operationId: string;
  readonly correctionId: string;
  readonly holeId: string;
  readonly runId: string;
  readonly expectedVersion: number;
  readonly voidReason: RunVoidReason;
  readonly comment?: string;
  readonly rodEventResolution: "VOID_WITH_RUN" | "REASSIGN" | "CANCEL";
  readonly reassignToRunId?: string;
  readonly voidedAt: string;
  readonly voidedByUserId: string;
  readonly voidedByNameSnapshot: string;
  readonly surveyDepthsDm?: readonly number[];
  readonly reportIds?: readonly string[];
  readonly acknowledgeWarnings?: boolean;
}

export interface RunCorrectionResult {
  readonly impact: RunCorrectionImpact;
  readonly corrections: readonly RunCorrectionRecord[];
  readonly operation: RunCorrectionOperation;
  readonly snapshots: readonly SavedRunSnapshot[];
  readonly alreadyApplied: boolean;
}

export interface RunCorrectionRepository {
  listByRun(holeId: string, runId: string): Promise<readonly RunCorrectionRecord[]>;
  listOperations(holeId: string): Promise<readonly RunCorrectionOperation[]>;
  getEnvelope(holeId: string): Promise<SavedRunsEnvelope | null>;
  previewCorrection(
    input: Omit<PreviewRunCorrectionInput, "runs"> & {
      readonly seedRuns?: readonly EffectiveRunProjection[];
    },
  ): Promise<RunCorrectionImpact>;
  previewVoid(
    input: Omit<PreviewVoidRunInput, "runs"> & {
      readonly seedRuns?: readonly EffectiveRunProjection[];
    },
  ): Promise<RunCorrectionImpact>;
  apply(input: ApplyRunCorrectionInput): Promise<RunCorrectionResult>;
  voidRun(input: VoidRunInput): Promise<RunCorrectionResult>;
  recoverInterrupted(holeId: string): Promise<number>;
  materializeSeedRun(
    holeId: string,
    snapshot: SavedRunSnapshot,
  ): Promise<SavedRunSnapshot>;
}

function snapshotToEffective(
  snapshot: SavedRunSnapshot,
  overrides: SavedRunsEnvelope["rodEventOverrides"],
): EffectiveRunProjection {
  const overrideByEvent = new Map(
    overrides
      .filter((item) => item.runId === snapshot.localId)
      .map((item) => [item.rodEventId, item]),
  );
  return {
    localId: snapshot.localId,
    holeId: snapshot.holeId,
    runNumber: snapshot.runNumber,
    rodNumber: snapshot.rodNumber,
    rodStringDm: snapshot.rodStringDm,
    measuredStickUpDm: snapshot.measuredStickUpDm,
    previousCompletedDepthDm: snapshot.previousCompletedDepthDm,
    holeDepthDm: snapshot.holeDepthDm,
    drilledLengthDm: snapshot.drilledLengthDm,
    recoveredLengthDm: snapshot.recoveredLengthDm,
    recoveryPercentage: snapshot.recoveryPercentage,
    comment: snapshot.comment,
    status: snapshot.status,
    version: snapshot.version,
    activeBitSerialNumberSnapshot: snapshot.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot: snapshot.activeReamerSerialNumberSnapshot,
    rodEvents: snapshot.rodEvents.map((event) => {
      const override = overrideByEvent.get(event.localId);
      return {
        localId: event.localId,
        action: override?.action ?? event.action,
        rodLengthDm: override?.rodLengthDm ?? event.rodLengthDm,
        affectedRodNumber: override?.affectedRodNumber ?? event.affectedRodNumber,
        rodNumberAfterEvent: event.rodNumberAfterEvent,
        voided: override?.voided ?? false,
      };
    }),
  };
}

function applyProjectedToSnapshot(
  previous: SavedRunSnapshot,
  projected: EffectiveRunProjection,
  now: string,
): SavedRunSnapshot {
  const original =
    previous.originalSnapshot ?? freezeOriginalRunSnapshot(previous);
  const rodEventsById = new Map(
    previous.rodEvents.map((event) => [event.localId, event]),
  );
  return withDefaultRunCorrectionFields({
    ...previous,
    originalSnapshot: original,
    version: previous.version + 1,
    status: projected.status,
    runNumber: projected.runNumber,
    rodNumber: projected.rodNumber,
    rodStringDm: projected.rodStringDm,
    measuredStickUpDm: projected.measuredStickUpDm,
    previousCompletedDepthDm: projected.previousCompletedDepthDm,
    holeDepthDm: projected.holeDepthDm,
    drilledLengthDm: projected.drilledLengthDm,
    recoveredLengthDm: projected.recoveredLengthDm,
    recoveryPercentage: projected.recoveryPercentage,
    comment: projected.comment,
    activeBitSerialNumberSnapshot: projected.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot:
      projected.activeReamerSerialNumberSnapshot,
    rodEvents: projected.rodEvents.map((event, index) => {
      const existing = rodEventsById.get(event.localId);
      return {
        localId: event.localId,
        action: event.action,
        rodLengthDm: event.rodLengthDm,
        sequence: existing?.sequence ?? index + 1,
        affectedRodNumber: event.affectedRodNumber,
        rodNumberAfterEvent: event.rodNumberAfterEvent,
        occurredAt: existing?.occurredAt ?? now,
      };
    }),
  });
}

function buildFieldCorrections(input: {
  readonly correctionId: string;
  readonly holeId: string;
  readonly runId: string;
  readonly correctionType: RunCorrectionType;
  readonly reason: string;
  readonly comment?: string;
  readonly affectedRunIds: readonly string[];
  readonly correctedAt: string;
  readonly correctedByUserId: string;
  readonly correctedByNameSnapshot: string;
  readonly operationId: string;
  readonly impact: RunCorrectionImpact;
}): RunCorrectionRecord[] {
  const targetChanges = input.impact.affectedRuns.filter(
    (change) => change.runId === input.runId,
  );
  if (targetChanges.length === 0) {
    return [
      {
        id: input.correctionId,
        holeId: input.holeId,
        runId: input.runId,
        correctionType: input.correctionType,
        fieldName: "status",
        previousValue: input.impact.previousRun.status,
        correctedValue: input.impact.correctedRun.status,
        reason: input.reason,
        comment: input.comment,
        affectedRunIds: [...input.affectedRunIds],
        affectedEntityIds: [],
        correctedAt: input.correctedAt,
        correctedByUserId: input.correctedByUserId,
        correctedByNameSnapshot: input.correctedByNameSnapshot,
        operationId: input.operationId,
      },
    ];
  }
  return targetChanges.map((change, index) => ({
    id: index === 0 ? input.correctionId : `${input.correctionId}-${index + 1}`,
    holeId: input.holeId,
    runId: input.runId,
    correctionType: input.correctionType,
    fieldName: change.field,
    previousValue: change.previousValue,
    correctedValue: change.correctedValue,
    reason: input.reason,
    comment: input.comment,
    affectedRunIds: [...input.affectedRunIds],
    affectedEntityIds: [],
    correctedAt: input.correctedAt,
    correctedByUserId: input.correctedByUserId,
    correctedByNameSnapshot: input.correctedByNameSnapshot,
    operationId: input.operationId,
  }));
}

export class LocalRunCorrectionRepository implements RunCorrectionRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
    private readonly audits?: AuditRepository,
  ) {}

  private readEnvelope(holeId: string): SavedRunsEnvelope | null {
    const result = readSavedRunSnapshots(
      this.storage,
      holeId,
      this.migrationCandidates,
    );
    if (result.status === "invalid") {
      throw new RunCorrectionRepositoryError("INVALID", result.reason);
    }
    if (result.status === "empty") return null;
    return result.envelope;
  }

  private writeEnvelope(envelope: SavedRunsEnvelope): void {
    const result = writeSavedRunsEnvelope(
      this.storage,
      envelope.holeId,
      envelope,
    );
    if (!result.ok) {
      throw new RunCorrectionRepositoryError("FAILED", result.reason);
    }
  }

  private mergedRuns(
    holeId: string,
    envelope: SavedRunsEnvelope | null,
    seedRuns: readonly EffectiveRunProjection[] = [],
  ): EffectiveRunProjection[] {
    const local = envelope?.snapshots ?? [];
    const localIds = new Set(local.map((snapshot) => snapshot.localId));
    const localNumbers = new Set(local.map((snapshot) => snapshot.runNumber));
    const fromSeed = seedRuns.filter(
      (run) =>
        run.holeId === holeId &&
        !localIds.has(run.localId) &&
        !localNumbers.has(run.runNumber),
    );
    const fromLocal = local.map((snapshot) =>
      snapshotToEffective(snapshot, envelope?.rodEventOverrides ?? []),
    );
    return [...fromSeed, ...fromLocal].sort(
      (left, right) => left.runNumber - right.runNumber,
    );
  }

  async getEnvelope(holeId: string): Promise<SavedRunsEnvelope | null> {
    return this.readEnvelope(holeId);
  }

  async listByRun(
    holeId: string,
    runId: string,
  ): Promise<readonly RunCorrectionRecord[]> {
    const envelope = this.readEnvelope(holeId);
    if (envelope === null) return [];
    return envelope.corrections.filter((item) => item.runId === runId);
  }

  async listOperations(
    holeId: string,
  ): Promise<readonly RunCorrectionOperation[]> {
    return this.readEnvelope(holeId)?.operations ?? [];
  }

  async materializeSeedRun(
    holeId: string,
    snapshot: SavedRunSnapshot,
  ): Promise<SavedRunSnapshot> {
    this.mutationGuard?.assertHoleMutable(holeId);
    const normalized = withDefaultRunCorrectionFields({
      ...snapshot,
      holeId,
    });
    const existing = this.readEnvelope(holeId);
    if (existing?.snapshots.some((item) => item.localId === normalized.localId)) {
      return existing.snapshots.find((item) => item.localId === normalized.localId)!;
    }
    const envelope: SavedRunsEnvelope = {
      version: 5,
      holeId,
      syncStatus: "local-only",
      updatedAt: normalized.completedAt,
      revision: (existing?.revision ?? 0) + 1,
      snapshots: [...(existing?.snapshots ?? []), normalized],
      corrections: existing?.corrections ?? [],
      operations: existing?.operations ?? [],
      rodEventOverrides: existing?.rodEventOverrides ?? [],
    };
    this.writeEnvelope(envelope);
    return normalized;
  }

  async previewCorrection(
    input: Omit<PreviewRunCorrectionInput, "runs"> & {
      readonly seedRuns?: readonly EffectiveRunProjection[];
    },
  ): Promise<RunCorrectionImpact> {
    const envelope = this.readEnvelope(input.holeId);
    let holeLocked = input.holeLocked ?? false;
    try {
      this.mutationGuard?.assertHoleMutable(input.holeId);
    } catch {
      holeLocked = true;
    }
    return previewRunCorrection({
      ...input,
      holeLocked,
      runs: this.mergedRuns(input.holeId, envelope, input.seedRuns),
    });
  }

  async previewVoid(
    input: Omit<PreviewVoidRunInput, "runs"> & {
      readonly seedRuns?: readonly EffectiveRunProjection[];
    },
  ): Promise<RunCorrectionImpact> {
    const envelope = this.readEnvelope(input.holeId);
    let holeLocked = input.holeLocked ?? false;
    try {
      this.mutationGuard?.assertHoleMutable(input.holeId);
    } catch {
      holeLocked = true;
    }
    return previewVoidRun({
      ...input,
      holeLocked,
      runs: this.mergedRuns(input.holeId, envelope, input.seedRuns),
    });
  }

  private findCompletedOperation(
    envelope: SavedRunsEnvelope,
    operationId: string,
    kind: "CORRECT_RUN" | "VOID_RUN",
    inputJson: string,
  ): RunCorrectionOperation | undefined {
    return envelope.operations.find(
      (operation) =>
        operation.operationId === operationId &&
        operation.kind === kind &&
        operation.inputJson === inputJson &&
        operation.stage === "COMPLETED",
    );
  }

  async apply(input: ApplyRunCorrectionInput): Promise<RunCorrectionResult> {
    try {
      this.mutationGuard?.assertHoleMutable(input.holeId);
    } catch {
      throw new RunCorrectionRepositoryError(
        "LOCKED",
        "This hole is completed and locked. Reopen the hole before correcting operational run data.",
      );
    }

    const inputJson = stableInput({
      ...input,
      correctedAt: undefined,
    });
    let envelope = this.readEnvelope(input.holeId);
    if (envelope === null) {
      throw new RunCorrectionRepositoryError(
        "NOT_FOUND",
        "No local runs exist for this hole.",
      );
    }

    const existingOp = this.findCompletedOperation(
      envelope,
      input.operationId,
      "CORRECT_RUN",
      inputJson,
    );
    if (existingOp !== undefined) {
      const impact = await this.previewCorrection({
        ...input,
        reportIdsByFingerprintRelevance: input.reportIds,
      });
      return {
        impact,
        corrections: envelope.corrections.filter(
          (item) => item.operationId === input.operationId,
        ),
        operation: existingOp,
        snapshots: envelope.snapshots,
        alreadyApplied: true,
      };
    }

    const target = envelope.snapshots.find(
      (snapshot) => snapshot.localId === input.runId,
    );
    if (target === undefined) {
      throw new RunCorrectionRepositoryError("NOT_FOUND", "The run was not found.");
    }
    if (target.version !== input.expectedVersion) {
      throw new RunCorrectionRepositoryError(
        "INVALID",
        "The run changed after this form was opened.",
      );
    }

    const impact = await this.previewCorrection({
      ...input,
      reportIdsByFingerprintRelevance: input.reportIds,
    });
    if (impact.blockers.length > 0) {
      throw new RunCorrectionRepositoryError(
        "BLOCKED",
        impact.blockers.map((item) => item.message).join(" "),
      );
    }
    if (impact.warnings.length > 0 && !input.acknowledgeWarnings) {
      throw new RunCorrectionRepositoryError(
        "BLOCKED",
        "Acknowledge correction warnings before saving.",
      );
    }

    let operation: RunCorrectionOperation = {
      operationId: input.operationId,
      kind: "CORRECT_RUN",
      correctionType: input.correctionType,
      runId: input.runId,
      inputJson,
      stage: "VALIDATED",
      affectedRunIds: [
        ...new Set(impact.affectedRuns.map((change) => change.runId)),
      ],
      correctionIds: [],
      createdAt: input.correctedAt,
      updatedAt: input.correctedAt,
      completedAt: null,
      failureReason: null,
    };

    const corrections = buildFieldCorrections({
      correctionId: input.correctionId,
      holeId: input.holeId,
      runId: input.runId,
      correctionType: input.correctionType,
      reason: input.reason,
      comment: input.comment,
      affectedRunIds: operation.affectedRunIds,
      correctedAt: input.correctedAt,
      correctedByUserId: input.correctedByUserId,
      correctedByNameSnapshot: input.correctedByNameSnapshot,
      operationId: input.operationId,
      impact,
    });
    operation = {
      ...operation,
      stage: "CORRECTION_SAVED",
      correctionIds: corrections.map((item) => item.id),
      updatedAt: input.correctedAt,
    };

    const projectedById = new Map(
      impact.projectedRuns.map((run) => [run.localId, run]),
    );
    const snapshots = envelope.snapshots.map((snapshot) => {
      const projected = projectedById.get(snapshot.localId);
      if (projected === undefined) return snapshot;
      if (
        snapshot.localId !== input.runId &&
        !operation.affectedRunIds.includes(snapshot.localId)
      ) {
        return snapshot;
      }
      const next = applyProjectedToSnapshot(
        snapshot,
        projected,
        input.correctedAt,
      );
      if (snapshot.localId === input.runId) {
        return {
          ...next,
          correctionIds: [...next.correctionIds, ...operation.correctionIds],
          status: "corrected" as const,
        };
      }
      return {
        ...next,
        correctionIds: [...next.correctionIds, ...operation.correctionIds],
      };
    });

    operation = {
      ...operation,
      stage: "DEPENDENT_PROJECTIONS_UPDATED",
      updatedAt: input.correctedAt,
    };

    const rodEventOverrides = [...envelope.rodEventOverrides];
    if (input.rodEvent !== undefined) {
      const existingIndex = rodEventOverrides.findIndex(
        (item) => item.rodEventId === input.rodEvent!.rodEventId,
      );
      const override = {
        rodEventId: input.rodEvent.rodEventId,
        runId: input.runId,
        action: input.rodEvent.action,
        rodLengthDm: input.rodEvent.rodLengthDm,
        affectedRodNumber: input.rodEvent.affectedRodNumber,
        voided: input.rodEvent.voided ?? false,
        version:
          existingIndex >= 0
            ? rodEventOverrides[existingIndex]!.version + 1
            : 1,
      };
      if (existingIndex >= 0) rodEventOverrides[existingIndex] = override;
      else rodEventOverrides.push(override);
    }
    operation = {
      ...operation,
      stage: "ROD_PROJECTION_UPDATED",
      updatedAt: input.correctedAt,
    };

    if (this.audits) {
      const action =
        input.correctionType === "RECOVERED_LENGTH"
          ? "recovered_length_corrected"
          : input.correctionType === "ROD_EVENT"
            ? "rod_event_corrected"
            : "run_corrected";
      await this.audits.append({
        localId: `audit-${input.operationId}`,
        serverId: null,
        syncStatus: "local-only",
        createdAt: input.correctedAt,
        updatedAt: input.correctedAt,
        deviceId: "local-runbook-device",
        version: 1,
        holeId: input.holeId,
        entityType: "run",
        entityId: input.runId,
        action,
        userId: input.correctedByUserId,
        userNameSnapshot: input.correctedByNameSnapshot,
        timestamp: input.correctedAt,
        depthDm: decimetres(Math.max(0, impact.correctedRun.holeDepthDm)),
        metadata: {
          operationId: input.operationId,
          correctionType: input.correctionType,
          reason: input.reason,
          affectedRunIds: [...operation.affectedRunIds],
          staleReportIds: [...impact.staleReportIds],
        },
      });
    }
    operation = {
      ...operation,
      stage: "AUDIT_WRITTEN",
      updatedAt: input.correctedAt,
    };
    operation = {
      ...operation,
      stage: "REPORTS_MARKED_STALE",
      updatedAt: input.correctedAt,
    };
    operation = {
      ...operation,
      stage: "COMPLETED",
      completedAt: input.correctedAt,
      updatedAt: input.correctedAt,
    };

    envelope = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.correctedAt,
      snapshots,
      corrections: [...envelope.corrections, ...corrections],
      operations: [...envelope.operations, operation],
      rodEventOverrides,
    };
    this.writeEnvelope(envelope);

    return {
      impact,
      corrections,
      operation,
      snapshots,
      alreadyApplied: false,
    };
  }

  async voidRun(input: VoidRunInput): Promise<RunCorrectionResult> {
    try {
      this.mutationGuard?.assertHoleMutable(input.holeId);
    } catch {
      throw new RunCorrectionRepositoryError(
        "LOCKED",
        "This hole is completed and locked. Reopen the hole before voiding operational run data.",
      );
    }

    if (input.voidReason === "OTHER" && !input.comment?.trim()) {
      throw new RunCorrectionRepositoryError(
        "INVALID",
        "Enter a comment when choosing Other as the void reason.",
      );
    }

    const inputJson = stableInput({
      ...input,
      voidedAt: undefined,
    });
    let envelope = this.readEnvelope(input.holeId);
    if (envelope === null) {
      throw new RunCorrectionRepositoryError(
        "NOT_FOUND",
        "No local runs exist for this hole.",
      );
    }

    const existingOp = this.findCompletedOperation(
      envelope,
      input.operationId,
      "VOID_RUN",
      inputJson,
    );
    if (existingOp !== undefined) {
      const impact = await this.previewVoid({
        holeId: input.holeId,
        runId: input.runId,
        reason: input.voidReason,
        comment: input.comment,
        rodEventResolution: input.rodEventResolution,
        reassignToRunId: input.reassignToRunId,
        reportIdsByFingerprintRelevance: input.reportIds,
      });
      return {
        impact,
        corrections: envelope.corrections.filter(
          (item) => item.operationId === input.operationId,
        ),
        operation: existingOp,
        snapshots: envelope.snapshots,
        alreadyApplied: true,
      };
    }

    const target = envelope.snapshots.find(
      (snapshot) => snapshot.localId === input.runId,
    );
    if (target === undefined) {
      throw new RunCorrectionRepositoryError("NOT_FOUND", "The run was not found.");
    }
    if (target.version !== input.expectedVersion) {
      throw new RunCorrectionRepositoryError(
        "INVALID",
        "The run changed after this form was opened.",
      );
    }

    const impact = await this.previewVoid({
      holeId: input.holeId,
      runId: input.runId,
      reason: input.voidReason,
      comment: input.comment,
      rodEventResolution: input.rodEventResolution,
      reassignToRunId: input.reassignToRunId,
      surveyDepthsDm: input.surveyDepthsDm,
      reportIdsByFingerprintRelevance: input.reportIds,
    });
    if (impact.blockers.length > 0) {
      throw new RunCorrectionRepositoryError(
        "BLOCKED",
        impact.blockers.map((item) => item.message).join(" "),
      );
    }
    if (impact.warnings.length > 0 && !input.acknowledgeWarnings) {
      throw new RunCorrectionRepositoryError(
        "BLOCKED",
        "Acknowledge void warnings before confirming.",
      );
    }

    let operation: RunCorrectionOperation = {
      operationId: input.operationId,
      kind: "VOID_RUN",
      correctionType: "VOID",
      runId: input.runId,
      inputJson,
      stage: "VALIDATED",
      affectedRunIds: [
        ...new Set(impact.affectedRuns.map((change) => change.runId)),
      ],
      correctionIds: [input.correctionId],
      createdAt: input.voidedAt,
      updatedAt: input.voidedAt,
      completedAt: null,
      failureReason: null,
    };

    const corrections: RunCorrectionRecord[] = [
      {
        id: input.correctionId,
        holeId: input.holeId,
        runId: input.runId,
        correctionType: "VOID",
        fieldName: "status",
        previousValue: target.status,
        correctedValue: "void",
        reason: input.voidReason,
        comment: input.comment,
        affectedRunIds: [...operation.affectedRunIds],
        affectedEntityIds: target.rodEvents.map((event) => event.localId),
        correctedAt: input.voidedAt,
        correctedByUserId: input.voidedByUserId,
        correctedByNameSnapshot: input.voidedByNameSnapshot,
        operationId: input.operationId,
      },
    ];

    const projectedById = new Map(
      impact.projectedRuns.map((run) => [run.localId, run]),
    );
    const snapshots = envelope.snapshots.map((snapshot) => {
      const projected = projectedById.get(snapshot.localId);
      if (projected === undefined) return snapshot;
      const next = applyProjectedToSnapshot(snapshot, projected, input.voidedAt);
      if (snapshot.localId === input.runId) {
        return {
          ...next,
          status: "void" as const,
          voidReason: input.voidReason,
          voidComment: input.comment?.trim() || null,
          voidedAt: input.voidedAt,
          voidedByUserId: input.voidedByUserId,
          voidedByNameSnapshot: input.voidedByNameSnapshot,
          correctionIds: [...next.correctionIds, input.correctionId],
        };
      }
      if (!operation.affectedRunIds.includes(snapshot.localId)) return snapshot;
      return {
        ...next,
        correctionIds: [...next.correctionIds, input.correctionId],
      };
    });

    const rodEventOverrides = [...envelope.rodEventOverrides];
    if (input.rodEventResolution === "VOID_WITH_RUN") {
      for (const event of target.rodEvents) {
        const existingIndex = rodEventOverrides.findIndex(
          (item) => item.rodEventId === event.localId,
        );
        const override = {
          rodEventId: event.localId,
          runId: input.runId,
          action: event.action,
          rodLengthDm: event.rodLengthDm,
          affectedRodNumber: event.affectedRodNumber,
          voided: true,
          version:
            existingIndex >= 0
              ? rodEventOverrides[existingIndex]!.version + 1
              : 1,
        };
        if (existingIndex >= 0) rodEventOverrides[existingIndex] = override;
        else rodEventOverrides.push(override);
      }
    }

    if (this.audits) {
      await this.audits.append({
        localId: `audit-${input.operationId}`,
        serverId: null,
        syncStatus: "local-only",
        createdAt: input.voidedAt,
        updatedAt: input.voidedAt,
        deviceId: "local-runbook-device",
        version: 1,
        holeId: input.holeId,
        entityType: "run",
        entityId: input.runId,
        action: "run_voided",
        userId: input.voidedByUserId,
        userNameSnapshot: input.voidedByNameSnapshot,
        timestamp: input.voidedAt,
        depthDm: decimetres(Math.max(0, impact.previousRun.holeDepthDm)),
        metadata: {
          operationId: input.operationId,
          voidReason: input.voidReason,
          comment: input.comment ?? null,
          rodEventResolution: input.rodEventResolution,
          affectedRunIds: [...operation.affectedRunIds],
          staleReportIds: [...impact.staleReportIds],
        },
      });
    }

    operation = {
      ...operation,
      stage: "COMPLETED",
      completedAt: input.voidedAt,
      updatedAt: input.voidedAt,
    };

    envelope = {
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.voidedAt,
      snapshots,
      corrections: [...envelope.corrections, ...corrections],
      operations: [...envelope.operations, operation],
      rodEventOverrides,
    };
    this.writeEnvelope(envelope);

    return {
      impact,
      corrections,
      operation,
      snapshots,
      alreadyApplied: false,
    };
  }

  async recoverInterrupted(holeId: string): Promise<number> {
    const envelope = this.readEnvelope(holeId);
    if (envelope === null) return 0;
    let recovered = 0;
    const operations = envelope.operations.map((operation) => {
      if (
        operation.stage === "COMPLETED" ||
        operation.stage === "FAILED" ||
        operation.completedAt !== null
      ) {
        return operation;
      }
      recovered += 1;
      return {
        ...operation,
        stage: "FAILED" as const,
        failureReason:
          operation.failureReason ??
          "Interrupted correction recovered during hydration.",
        updatedAt: new Date().toISOString(),
      };
    });
    if (recovered === 0) return 0;
    this.writeEnvelope({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: new Date().toISOString(),
      operations,
    });
    return recovered;
  }
}

export function createBrowserRunCorrectionRepository(
  migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
  mutationGuard?: HoleMutationGuardPort,
  audits?: AuditRepository,
): RunCorrectionRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalRunCorrectionRepository(
        storage,
        migrationCandidates,
        mutationGuard,
        audits,
      );
}
