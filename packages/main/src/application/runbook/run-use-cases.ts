import {
  decimetres,
  type AuditEntry,
  type Decimetres,
  type JsonValue,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type { CasingRepository } from "@/infrastructure/casing";
import type {
  ComponentAssignmentRepository,
  ComponentRepository,
} from "@/infrastructure/components";
import {
  type RunDraftContext,
  type RunDraftPayload,
  type RunRepository,
  type SavedRunSnapshot,
  type SaveRunResult,
} from "@/infrastructure/drafts";
import type { ShiftRepository } from "@/infrastructure/shifts";

const DEVICE_ID = "local-runbook-device";

export interface RunServices {
  readonly runs: RunRepository;
  readonly shifts: ShiftRepository;
  readonly audits: AuditRepository;
  readonly components?: ComponentRepository;
  readonly componentAssignments?: ComponentAssignmentRepository;
  readonly casing?: CasingRepository;
}

interface Actor {
  readonly id: string;
  readonly name: string;
}

function runAudit(input: {
  id: string;
  holeId: string;
  entityId: string;
  action: string;
  actor: Actor;
  timestamp: string;
  depthDm?: Decimetres;
  metadata?: Readonly<Record<string, JsonValue>>;
}): AuditEntry {
  return {
    localId: input.id,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    entityType: "run",
    entityId: input.entityId,
    action: input.action,
    userId: input.actor.id,
    userNameSnapshot: input.actor.name,
    timestamp: input.timestamp,
    depthDm: input.depthDm,
    metadata: input.metadata ?? {},
  };
}

export interface StartRunInput {
  readonly holeId: string;
  readonly localId: string;
  readonly startedAt: string;
  readonly context: RunDraftContext;
}

export async function startRun(
  input: StartRunInput,
  services: RunServices,
): Promise<RunDraftPayload> {
  const existing = services.runs.readDraft(input.holeId);
  if (existing.status === "invalid") throw new Error(existing.reason);
  if (existing.status === "valid") return existing.envelope.payload;

  const activeShift = await services.shifts.getActiveShift(input.holeId);
  if (activeShift === null) {
    throw new Error("Start a Day Shift or Night Shift before recording runs.");
  }
  const [activeBit, activeReamer, casingStrings] = await Promise.all([
    services.componentAssignments?.getActive(input.holeId, "BIT") ??
      Promise.resolve(null),
    services.componentAssignments?.getActive(input.holeId, "REAMER") ??
      Promise.resolve(null),
    services.casing?.listByHole(input.holeId) ?? Promise.resolve([]),
  ]);
  const [bit, reamer] = await Promise.all([
    activeBit === null || services.components === undefined
      ? Promise.resolve(null)
      : services.components.getById(activeBit.componentId),
    activeReamer === null || services.components === undefined
      ? Promise.resolve(null)
      : services.components.getById(activeReamer.componentId),
  ]);
  const casingSummary =
    casingStrings.length === 0
      ? null
      : casingStrings
          .filter(({ status }) => status === "ACTIVE" || status === "COMPLETED")
          .map(
            ({ casingSize, currentEndDepthDm }) =>
              `${casingSize} to ${(currentEndDepthDm / 10).toFixed(1)} m`,
          )
          .join("; ");
  const payload: RunDraftPayload = {
    localId: input.localId,
    startedAt: input.startedAt,
    startedShiftId: activeShift.localId,
    startedByUserId: activeShift.primaryDrillerId,
    startedByNameSnapshot: activeShift.primaryDrillerNameSnapshot,
    context: input.context,
    pendingRodEvents: [],
    stickUpMetresInput: "",
    recoveredMetresInput: "",
    conditionTagIds: [],
    comment: "",
    activeBitAssignmentId: activeBit?.localId ?? null,
    activeReamerAssignmentId: activeReamer?.localId ?? null,
    activeBitSerialNumberSnapshot: bit?.serialNumber ?? null,
    activeReamerSerialNumberSnapshot: reamer?.serialNumber ?? null,
    casingSummarySnapshot: casingSummary,
  };
  const saved = services.runs.writeDraft(input.holeId, payload, input.startedAt);
  if (!saved.ok) throw new Error(saved.reason);
  await services.audits.append(
    runAudit({
      id: `audit-${input.localId}-started`,
      holeId: input.holeId,
      entityId: input.localId,
      action: "run_started",
      actor: {
        id: activeShift.primaryDrillerId,
        name: activeShift.primaryDrillerNameSnapshot,
      },
      timestamp: input.startedAt,
      metadata: {
        runNumber: input.context.runNumber,
        startedShiftId: activeShift.localId,
      },
    }),
  );
  return payload;
}

type CompletionValues = Omit<
  SavedRunSnapshot,
  | "startedAt"
  | "completedAt"
  | "startedShiftId"
  | "completedShiftId"
  | "startedByUserId"
  | "startedByNameSnapshot"
  | "completedByUserId"
  | "completedByNameSnapshot"
  | "syncStatus"
  | "activeBitAssignmentId"
  | "activeReamerAssignmentId"
  | "activeBitSerialNumberSnapshot"
  | "activeReamerSerialNumberSnapshot"
  | "casingSummarySnapshot"
>;

export async function completeRun(
  values: CompletionValues & { readonly completedAt: string },
  services: RunServices,
): Promise<SaveRunResult> {
  const draft = services.runs.readDraft(values.holeId);
  if (draft.status !== "valid") {
    throw new Error(
      draft.status === "invalid"
        ? draft.reason
        : "The unfinished run draft is missing.",
    );
  }
  if (draft.envelope.payload.localId !== values.localId) {
    throw new Error("The run draft changed before completion.");
  }
  const activeShift = await services.shifts.getActiveShift(values.holeId);
  if (activeShift === null) {
    throw new Error("An active shift is required to complete this run.");
  }
  const payload = draft.envelope.payload;
  const snapshot: SavedRunSnapshot = {
    ...values,
    startedAt: payload.startedAt,
    completedAt: values.completedAt,
    startedShiftId: payload.startedShiftId,
    completedShiftId: activeShift.localId,
    startedByUserId: payload.startedByUserId,
    startedByNameSnapshot: payload.startedByNameSnapshot,
    completedByUserId: activeShift.primaryDrillerId,
    completedByNameSnapshot: activeShift.primaryDrillerNameSnapshot,
    syncStatus: "local-only",
    activeBitAssignmentId: payload.activeBitAssignmentId,
    activeReamerAssignmentId: payload.activeReamerAssignmentId,
    activeBitSerialNumberSnapshot: payload.activeBitSerialNumberSnapshot,
    activeReamerSerialNumberSnapshot:
      payload.activeReamerSerialNumberSnapshot,
    casingSummarySnapshot: payload.casingSummarySnapshot,
  };
  const result = services.runs.saveCompletedRun(values.holeId, snapshot);
  if (!result.ok) return result;

  const actor = {
    id: activeShift.primaryDrillerId,
    name: activeShift.primaryDrillerNameSnapshot,
  };
  await services.audits.append(
    runAudit({
      id: `audit-${values.localId}-completed`,
      holeId: values.holeId,
      entityId: values.localId,
      action: "run_completed",
      actor,
      timestamp: values.completedAt,
      depthDm: decimetres(values.holeDepthDm),
      metadata: {
        runNumber: values.runNumber,
        startedShiftId: payload.startedShiftId,
        completedShiftId: activeShift.localId,
      },
    }),
  );
  if (payload.startedShiftId !== activeShift.localId) {
    await services.audits.append(
      runAudit({
        id: `audit-${values.localId}-completed-shared`,
        holeId: values.holeId,
        entityId: values.localId,
        action: "run_completed_by_different_shift",
        actor,
        timestamp: values.completedAt,
        depthDm: decimetres(values.holeDepthDm),
        metadata: {
          runNumber: values.runNumber,
          startedShiftId: payload.startedShiftId,
          completedShiftId: activeShift.localId,
        },
      }),
    );
  }
  services.runs.clearDraft(values.holeId);
  return result;
}
