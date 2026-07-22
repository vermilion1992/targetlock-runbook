import {
  calculateComponentUsage,
  decimetres,
  type AuditEntry,
  type Component,
  type ComponentAssignment,
  type ComponentUsage,
  type Decimetres,
  type JsonValue,
  type UsageRun,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import {
  type AssignComponentInput,
  type ChangeComponentInput,
  type ComponentAssignmentRepository,
  type ComponentChangeResult,
  type ComponentFilters,
  type ComponentRepository,
  type CreateComponentInput,
  type CorrectAssignmentInput,
  type UpdateComponentInput,
} from "@/infrastructure/components";

const DEVICE_ID = "local-runbook-device";

export interface ComponentServices {
  readonly components: ComponentRepository;
  readonly componentAssignments: ComponentAssignmentRepository;
  readonly audits: AuditRepository;
}

function componentAudit(input: {
  readonly operationId: string;
  readonly holeId: string;
  readonly entityType: "component" | "component_assignment";
  readonly entityId: string;
  readonly action: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
  readonly depthDm?: Decimetres;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}): AuditEntry {
  return {
    localId: `audit-${input.operationId}-${input.action}`,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    userId: input.userId,
    userNameSnapshot: input.userNameSnapshot,
    timestamp: input.occurredAt,
    depthDm: input.depthDm,
    metadata: {
      operationId: input.operationId,
      ...(input.metadata ?? {}),
    },
  };
}

export async function createComponent(
  input: CreateComponentInput & { readonly auditHoleId: string },
  services: ComponentServices,
): Promise<Component> {
  const component = await services.components.create(input);
  await services.audits.append(
    componentAudit({
      operationId: `create-${component.localId}`,
      holeId: input.auditHoleId,
      entityType: "component",
      entityId: component.localId,
      action: "component_created",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      metadata: {
        componentType: component.type,
        serialNumber: component.serialNumber,
        status: component.status,
      },
    }),
  );
  return component;
}

export async function correctComponent(
  input: UpdateComponentInput & { readonly auditHoleId: string },
  services: ComponentServices,
): Promise<Component> {
  const previous = await services.components.getById(input.componentId);
  const component = await services.components.update(input);
  await services.audits.append(
    componentAudit({
      operationId: input.operationId,
      holeId: input.auditHoleId,
      entityType: "component",
      entityId: component.localId,
      action: "component_registry_corrected",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      metadata: {
        reason: input.reason,
        previousSerialNumber: previous?.serialNumber ?? null,
        serialNumber: component.serialNumber,
        previousStatus: previous?.status ?? null,
        status: component.status,
      },
    }),
  );
  return component;
}

export async function assignInitialComponent(
  input: AssignComponentInput,
  services: ComponentServices,
): Promise<ComponentAssignment> {
  const assignment = await services.componentAssignments.assignInitial(input);
  const component = await services.components.getById(assignment.componentId);
  await services.audits.append(
    componentAudit({
      operationId: input.operationId,
      holeId: input.holeId,
      entityType: "component_assignment",
      entityId: assignment.localId,
      action: "component_assigned",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      depthDm: input.startDepthDm,
      metadata: {
        componentType: assignment.componentType,
        componentId: assignment.componentId,
        serialNumber: component?.serialNumber ?? null,
        shiftId: input.shiftId ?? null,
      },
    }),
  );
  return assignment;
}

export interface ComponentChangeDepthAssessment {
  readonly valid: boolean;
  readonly reason?: string;
  readonly boundaryRun?: UsageRun;
}

export function assessComponentChangeDepth(
  changeDepthDm: Decimetres,
  outgoingStartDepthDm: Decimetres,
  currentCompletedDepthDm: Decimetres,
  completedRuns: readonly UsageRun[],
): ComponentChangeDepthAssessment {
  if (changeDepthDm < outgoingStartDepthDm) {
    return {
      valid: false,
      reason: "Change depth cannot precede the outgoing assignment start.",
    };
  }
  if (changeDepthDm > currentCompletedDepthDm) {
    return {
      valid: false,
      reason: "Change depth cannot exceed the current completed hole depth.",
    };
  }
  const boundaryRun = completedRuns.find(
    (run) =>
      run.status !== "in_progress" &&
      changeDepthDm > run.startDepth &&
      changeDepthDm < run.holeDepth,
  );
  return { valid: true, boundaryRun };
}

export interface ChangeOperationalComponentInput
  extends ChangeComponentInput {
  readonly currentCompletedDepthDm: Decimetres;
  readonly completedRuns: readonly UsageRun[];
  readonly confirmWithinRun?: boolean;
}

export class ComponentChangeValidationError extends Error {
  constructor(
    readonly code: "INVALID_DEPTH" | "WITHIN_RUN_CONFIRMATION_REQUIRED",
    message: string,
    readonly boundaryRun?: UsageRun,
  ) {
    super(message);
    this.name = "ComponentChangeValidationError";
  }
}

export async function recordComponentChangeAudit(
  input: ChangeComponentInput & { readonly boundaryRunId?: string | null },
  result: ComponentChangeResult,
  services: ComponentServices,
): Promise<void> {
  const [outgoingComponent, incomingComponent] = await Promise.all([
    services.components.getById(result.outgoingAssignment.componentId),
    services.components.getById(result.incomingAssignment.componentId),
  ]);
  const action =
    input.componentType === "BIT" ? "bit_changed" : "reamer_changed";
  await services.audits.append(
    componentAudit({
      operationId: input.operationId,
      holeId: input.holeId,
      entityType: "component_assignment",
      entityId: result.incomingAssignment.localId,
      action,
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      depthDm: input.changeDepthDm,
      metadata: {
        componentType: input.componentType,
        outgoingAssignmentId: result.outgoingAssignment.localId,
        outgoingComponentId: result.outgoingAssignment.componentId,
        outgoingSerialNumber: outgoingComponent?.serialNumber ?? null,
        incomingAssignmentId: result.incomingAssignment.localId,
        incomingComponentId: result.incomingAssignment.componentId,
        incomingSerialNumber: incomingComponent?.serialNumber ?? null,
        removalReason: input.removalReason,
        removalComment: input.removalComment ?? null,
        shiftId: input.shiftId,
        boundaryRunId: input.boundaryRunId ?? null,
      },
    }),
  );
  if (input.removalReason === "LOST_DOWNHOLE") {
    await services.audits.append(
      componentAudit({
        operationId: input.operationId,
        holeId: input.holeId,
        entityType: "component",
        entityId: result.outgoingAssignment.componentId,
        action: "component_lost_downhole",
        userId: input.userId,
        userNameSnapshot: input.userNameSnapshot,
        occurredAt: input.occurredAt,
        depthDm: input.changeDepthDm,
        metadata: {
          componentType: input.componentType,
          serialNumber: outgoingComponent?.serialNumber ?? null,
        },
      }),
    );
  }
}

export async function changeOperationalComponent(
  input: ChangeOperationalComponentInput,
  services: ComponentServices,
): Promise<ComponentChangeResult> {
  const outgoing = await services.componentAssignments.getAssignmentById(
    input.outgoingAssignmentId,
  );
  if (outgoing === null) {
    throw new ComponentChangeValidationError(
      "INVALID_DEPTH",
      "The outgoing assignment is no longer available.",
    );
  }
  const assessment = assessComponentChangeDepth(
    input.changeDepthDm,
    outgoing.startDepthDm,
    input.currentCompletedDepthDm,
    input.completedRuns,
  );
  if (!assessment.valid) {
    throw new ComponentChangeValidationError(
      "INVALID_DEPTH",
      assessment.reason ?? "The change depth is invalid.",
    );
  }
  if (assessment.boundaryRun !== undefined && !input.confirmWithinRun) {
    throw new ComponentChangeValidationError(
      "WITHIN_RUN_CONFIRMATION_REQUIRED",
      "This component change occurred within a completed run.",
      assessment.boundaryRun,
    );
  }
  if (
    assessment.boundaryRun !== undefined &&
    !input.removalComment?.trim()
  ) {
    throw new ComponentChangeValidationError(
      "WITHIN_RUN_CONFIRMATION_REQUIRED",
      "A comment is required for a component change within a run.",
      assessment.boundaryRun,
    );
  }

  const result = await services.componentAssignments.changeComponent(input);
  await recordComponentChangeAudit(
    {
      ...input,
      boundaryRunId: assessment.boundaryRun?.localId ?? null,
    },
    result,
    services,
  );
  return result;
}

export function changeBit(
  input: Omit<ChangeOperationalComponentInput, "componentType">,
  services: ComponentServices,
): Promise<ComponentChangeResult> {
  return changeOperationalComponent(
    { ...input, componentType: "BIT" },
    services,
  );
}

export function changeReamer(
  input: Omit<ChangeOperationalComponentInput, "componentType">,
  services: ComponentServices,
): Promise<ComponentChangeResult> {
  return changeOperationalComponent(
    { ...input, componentType: "REAMER" },
    services,
  );
}

export async function correctComponentAssignment(
  input: CorrectAssignmentInput,
  services: ComponentServices,
): Promise<ComponentAssignment> {
  const previous = await services.componentAssignments.getAssignmentById(
    input.assignmentId,
  );
  if (previous === null) throw new Error("Assignment not found.");
  const assignment =
    await services.componentAssignments.correctAssignment(input);
  await services.audits.append(
    componentAudit({
      operationId: input.operationId,
      holeId: assignment.holeId,
      entityType: "component_assignment",
      entityId: assignment.localId,
      action: "component_assignment_corrected",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      depthDm: assignment.startDepthDm,
      metadata: {
        reason: input.reason,
        previousStartDepthDm: previous.startDepthDm,
        startDepthDm: assignment.startDepthDm,
        previousEndDepthDm: previous.endDepthDm ?? null,
        endDepthDm: assignment.endDepthDm ?? null,
        previousRemovalReason: previous.removalReason ?? null,
        removalReason: assignment.removalReason ?? null,
      },
    }),
  );
  return assignment;
}

export function getComponentRegistry(
  filters: ComponentFilters,
  services: ComponentServices,
): Promise<readonly Component[]> {
  return services.components.list(filters);
}

export async function getActiveComponents(
  holeId: string,
  services: ComponentServices,
): Promise<{
  readonly bit: ComponentAssignment | null;
  readonly reamer: ComponentAssignment | null;
}> {
  const [bit, reamer] = await Promise.all([
    services.componentAssignments.getActive(holeId, "BIT"),
    services.componentAssignments.getActive(holeId, "REAMER"),
  ]);
  return { bit, reamer };
}

export async function getComponentHistory(
  componentId: string,
  completedRuns: readonly UsageRun[],
  services: ComponentServices,
): Promise<{
  readonly component: Component | null;
  readonly assignments: readonly ComponentAssignment[];
  readonly usage: readonly ComponentUsage[];
}> {
  const [component, assignments] = await Promise.all([
    services.components.getById(componentId),
    services.componentAssignments.listByComponent(componentId),
  ]);
  return {
    component,
    assignments,
    usage: assignments.map((assignment) =>
      calculateComponentUsage(assignment, completedRuns),
    ),
  };
}

export async function getHoleComponentStatistics(
  holeId: string,
  completedRuns: readonly UsageRun[],
  services: ComponentServices,
): Promise<
  readonly {
    readonly component: Component;
    readonly assignment: ComponentAssignment;
    readonly usage: ComponentUsage;
  }[]
> {
  const assignments = await services.componentAssignments.listByHole(holeId);
  return Promise.all(
    assignments.map(async (assignment) => {
      const component = await services.components.getById(
        assignment.componentId,
      );
      if (component === null) {
        throw new Error(`Component ${assignment.componentId} is missing.`);
      }
      return {
        component,
        assignment,
        usage: calculateComponentUsage(assignment, completedRuns),
      };
    }),
  );
}

export function completedDepthFromRuns(
  runs: readonly UsageRun[],
): Decimetres {
  return decimetres(
    runs.reduce<number>(
      (depth, run) =>
        run.status === "in_progress" ? depth : Math.max(depth, run.holeDepth),
      0,
    ),
  );
}
