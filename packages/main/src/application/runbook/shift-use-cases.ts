import {
  type AuditEntry,
  type Decimetres,
  type RunbookShift,
  type ShiftCrewMember,
  type ShiftType,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type { RunRepository } from "@/infrastructure/drafts";
import type {
  AcceptHandoverInput,
  HandoverResult,
  ShiftRepository,
} from "@/infrastructure/shifts";
import type {
  CurrentHoleState,
  CurrentHoleStateDependencies,
} from "./current-hole-state";
import { getCurrentHoleState } from "./current-hole-state";
import {
  buildCloseAnalyticsSnapshot,
  type ShiftAnalyticsQueryServices,
} from "./shift-analytics-query";

const DEVICE_ID = "local-runbook-device";

export interface ShiftServices {
  readonly currentState: CurrentHoleStateDependencies;
  readonly shifts: ShiftRepository;
  readonly audits: AuditRepository;
  readonly runs: RunRepository;
  /** Optional: when present, close persists a Shift analytics snapshot. */
  readonly shiftAnalytics?: ShiftAnalyticsQueryServices;
}

interface Actor {
  readonly id: string;
  readonly name: string;
}

function auditEntry(input: {
  readonly id: string;
  readonly holeId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly actor: Actor;
  readonly timestamp: string;
  readonly depthDm?: Decimetres;
  readonly metadata?: AuditEntry["metadata"];
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
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    userId: input.actor.id,
    userNameSnapshot: input.actor.name,
    timestamp: input.timestamp,
    depthDm: input.depthDm,
    metadata: input.metadata ?? {},
  };
}

export interface StartRunbookShiftInput {
  readonly id: string;
  readonly holeId: string;
  readonly rigId: string;
  readonly shiftType: ShiftType;
  readonly shiftDate: string;
  readonly primaryDrillerId: string;
  readonly primaryDrillerNameSnapshot: string;
  readonly crewMembers: readonly ShiftCrewMember[];
  readonly startedAt: string;
}

export async function startRunbookShift(
  input: StartRunbookShiftInput,
  services: ShiftServices,
): Promise<RunbookShift> {
  const state = await getCurrentHoleState(input.holeId, services.currentState);
  const shift = await services.shifts.startShift({
    ...input,
    startingState: {
      depthDm: state.currentDepthDm,
      rodNumber: state.currentRodNumber,
      rodStringDm: state.currentRodStringDm,
      measuredStickUpDm: state.measuredStickUpDm,
      runNumber: state.nextRunNumber,
    },
  });
  await services.audits.append(
    auditEntry({
      id: `audit-${input.id}-started`,
      holeId: input.holeId,
      entityType: "shift",
      entityId: shift.localId,
      action: "shift_started",
      actor: {
        id: input.primaryDrillerId,
        name: input.primaryDrillerNameSnapshot,
      },
      timestamp: input.startedAt,
      depthDm: state.currentDepthDm,
      metadata: {
        shiftType: input.shiftType,
        shiftDate: input.shiftDate,
        runNumber: state.nextRunNumber,
        rodNumber: state.currentRodNumber,
        rodStringDm: state.currentRodStringDm,
      },
    }),
  );
  return shift;
}

export interface ShiftCloseWarning {
  readonly code: string;
  readonly message: string;
}

export interface ShiftCloseReadiness {
  readonly state: CurrentHoleState;
  readonly mustResolve: readonly ShiftCloseWarning[];
  readonly mayHandOver: readonly ShiftCloseWarning[];
  readonly unfinishedRunId?: string;
  readonly unfinishedRunNumber?: number;
}

export async function getShiftCloseReadiness(
  holeId: string,
  services: ShiftServices,
): Promise<ShiftCloseReadiness> {
  const state = await getCurrentHoleState(holeId, services.currentState);
  const mustResolve: ShiftCloseWarning[] = [];
  const mayHandOver: ShiftCloseWarning[] = [];

  if (state.activeShift === null) {
    mustResolve.push({
      code: "NO_ACTIVE_SHIFT",
      message: "There is no open shift to close.",
    });
  }
  if (state.pendingHandover !== null) {
    mustResolve.push({
      code: "HANDOVER_ALREADY_PENDING",
      message: "A handover is already awaiting acceptance.",
    });
  }

  let unfinishedRunId: string | undefined;
  let unfinishedRunNumber: number | undefined;
  if (state.draft.status === "valid") {
    unfinishedRunId = state.draft.envelope.payload.localId;
    unfinishedRunNumber = state.draft.envelope.payload.context.runNumber;
    mayHandOver.push({
      code: "UNFINISHED_RUN",
      message: `Run ${unfinishedRunNumber} is in progress and can be handed over.`,
    });
    if (state.measuredStickUpDm === undefined) {
      mayHandOver.push({
        code: "MISSING_STICK_UP",
        message: "Measured stick-up has not yet been entered.",
      });
    }
    if (state.draft.envelope.payload.pendingRodEvents.length > 0) {
      mayHandOver.push({
        code: "PENDING_ROD_EVENTS",
        message: `${state.draft.envelope.payload.pendingRodEvents.length} pending rod event(s) will remain with the run.`,
      });
    }
  }

  return {
    state,
    mustResolve,
    mayHandOver,
    unfinishedRunId,
    unfinishedRunNumber,
  };
}

export interface CloseRunbookShiftInput {
  readonly holeId: string;
  readonly shiftId: string;
  readonly expectedVersion: number;
  readonly closedAt: string;
  readonly handoverNote?: string;
  readonly actor: Actor;
}

export async function closeRunbookShift(
  input: CloseRunbookShiftInput,
  services: ShiftServices,
): Promise<RunbookShift> {
  const readiness = await getShiftCloseReadiness(input.holeId, services);
  if (readiness.mustResolve.length > 0) {
    throw new Error(readiness.mustResolve.map(({ message }) => message).join(" "));
  }
  const state = readiness.state;
  const closeAnalyticsSnapshot =
    services.shiftAnalytics === undefined
      ? undefined
      : await buildCloseAnalyticsSnapshot(
          input.holeId,
          input.shiftId,
          input.closedAt,
          services.shiftAnalytics,
        );
  const shift = await services.shifts.closeForHandover({
    holeId: input.holeId,
    shiftId: input.shiftId,
    expectedVersion: input.expectedVersion,
    closedAt: input.closedAt,
    endingState: {
      depthDm: state.currentDepthDm,
      rodNumber: state.currentRodNumber,
      rodStringDm: state.currentRodStringDm,
      measuredStickUpDm: state.measuredStickUpDm,
      runNumber: state.lastCompletedRunNumber,
    },
    handoverNote: input.handoverNote,
    handoverRunId: readiness.unfinishedRunId,
    handoverRunNumber: readiness.unfinishedRunNumber,
    closeAnalyticsSnapshot,
  });
  await Promise.all([
    services.audits.append(
      auditEntry({
        id: `audit-${shift.localId}-close-requested-v${shift.version}`,
        holeId: input.holeId,
        entityType: "shift",
        entityId: shift.localId,
        action: "shift_close_requested",
        actor: input.actor,
        timestamp: input.closedAt,
        depthDm: state.currentDepthDm,
        metadata: { version: shift.version },
      }),
    ),
    services.audits.append(
      auditEntry({
        id: `audit-${shift.localId}-handover-created-v${shift.version}`,
        holeId: input.holeId,
        entityType: "shift",
        entityId: shift.localId,
        action: "handover_created",
        actor: input.actor,
        timestamp: input.closedAt,
        depthDm: state.currentDepthDm,
        metadata: {
          unfinishedRunId: readiness.unfinishedRunId ?? null,
          unfinishedRunNumber: readiness.unfinishedRunNumber ?? null,
        },
      }),
    ),
  ]);
  return shift;
}

export async function acceptShiftHandover(
  input: AcceptHandoverInput,
  services: ShiftServices,
): Promise<HandoverResult> {
  const result = await services.shifts.acceptHandover(input);
  const depth =
    result.outgoingShift.endingDepthDm ??
    result.outgoingShift.startingDepthDm;
  const actor = {
    id: input.incomingDrillerId,
    name: input.incomingDrillerNameSnapshot,
  };
  const common = {
    holeId: input.holeId,
    actor,
    timestamp: input.acceptedAt,
    depthDm: depth,
  } as const;
  const entries: AuditEntry[] = [
    auditEntry({
      ...common,
      id: `audit-${input.operationId}-accepted`,
      entityType: "shift",
      entityId: result.outgoingShift.localId,
      action: "handover_accepted",
      metadata: { incomingShiftId: result.incomingShift.localId },
    }),
    auditEntry({
      ...common,
      id: `audit-${input.operationId}-incoming-created`,
      entityType: "shift",
      entityId: result.incomingShift.localId,
      action: "incoming_shift_created",
      metadata: { outgoingShiftId: result.outgoingShift.localId },
    }),
  ];
  if (result.outgoingShift.handoverRunId !== undefined) {
    entries.push(
      auditEntry({
        ...common,
        id: `audit-${input.operationId}-run-transferred`,
        entityType: "run",
        entityId: result.outgoingShift.handoverRunId,
        action: "unfinished_run_transferred",
        metadata: {
          runNumber: result.outgoingShift.handoverRunNumber ?? null,
          startedShiftId: result.outgoingShift.localId,
          incomingShiftId: result.incomingShift.localId,
        },
      }),
    );
  }
  await Promise.all(entries.map((entry) => services.audits.append(entry)));
  return result;
}
