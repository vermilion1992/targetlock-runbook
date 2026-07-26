import { z } from "zod";

import {
  decimetres,
  isHoleLockedError,
  type Component,
  type ComponentAssignment,
  type ComponentRemovalReason,
  type ComponentStatus,
  type ComponentType,
  type CorrectionValue,
  type Decimetres,
  type HoleCompletionComponentOutcomeCode,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const COMPONENT_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";
const isoTimestampSchema = z.string().datetime();
const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);
const componentTypeSchema = z.enum(["BIT", "REAMER"]);
const componentStatusSchema = z.enum([
  "AVAILABLE",
  "ACTIVE",
  "REMOVED",
  "SERVICEABLE",
  "RETIRED",
  "LOST_DOWNHOLE",
  "UNDER_INSPECTION",
]);
const removalReasonSchema = z.enum([
  "WORN",
  "POLISHED",
  "BURNT",
  "DAMAGED",
  "MATRIX_CHANGE",
  "LOST_DOWNHOLE",
  "INSPECTION",
  "HOLE_COMPLETED",
  "OTHER",
]);
const completionOutcomeSchema = z.enum([
  "SERVICEABLE",
  "UNDER_INSPECTION",
  "RETIRED",
  "LOST_DOWNHOLE",
  "CARRIED_FORWARD",
]);

const metadataSchema = {
  localId: z.string().min(1),
  serverId: z.string().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
};

const componentSchema = z.object({
  ...metadataSchema,
  organisationId: z.string().min(1),
  type: componentTypeSchema,
  serialNumber: z.string().trim().min(1).max(100),
  normalizedSerialNumber: z.string().min(1).max(100),
  manufacturer: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  matrix: z.string().trim().min(1).max(100).optional(),
  size: z.string().trim().min(1).max(30),
  supplier: z.string().trim().min(1).max(100).optional(),
  startingCrownHeightDm: z.number().int().nonnegative().optional(),
  status: componentStatusSchema,
  notes: z.string().trim().max(1_000).optional(),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().trim().min(1),
});

const assignmentSchema = z.object({
  ...metadataSchema,
  componentId: z.string().min(1),
  holeId: z.string().min(1),
  componentType: componentTypeSchema,
  startDepthDm: z.number().int().nonnegative(),
  endDepthDm: z.number().int().nonnegative().optional(),
  installedShiftId: z.string().min(1).optional(),
  removedShiftId: z.string().min(1).optional(),
  installedAt: isoTimestampSchema,
  removedAt: isoTimestampSchema.optional(),
  installedByUserId: z.string().min(1),
  installedByNameSnapshot: z.string().trim().min(1),
  removedByUserId: z.string().min(1).optional(),
  removedByNameSnapshot: z.string().trim().min(1).optional(),
  removalReason: removalReasonSchema.optional(),
  removalComment: z.string().trim().max(1_000).optional(),
  status: z.enum(["ACTIVE", "CLOSED"]),
});

const correctionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const correctionSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(["COMPONENT", "ASSIGNMENT"]),
  entityId: z.string().min(1),
  fieldName: z.string().min(1),
  previousValue: correctionValueSchema,
  correctedValue: correctionValueSchema,
  reason: z.string().trim().min(1).max(500),
  correctedAt: isoTimestampSchema,
  correctedByUserId: z.string().min(1),
  correctedByNameSnapshot: z.string().trim().min(1),
  operationId: z.string().min(1),
});
const operationRecordSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum([
    "ASSIGN_INITIAL",
    "CHANGE_COMPONENT",
    "RESOLVE_AT_HOLE_COMPLETION",
    "CORRECT",
  ]),
  inputJson: z.string(),
  outgoingAssignmentId: z.string().min(1).optional(),
  incomingAssignmentId: z.string().min(1).optional(),
  completedAt: isoTimestampSchema,
});
const componentEnvelopeSchema = z.object({
  version: z.literal(COMPONENT_STORAGE_VERSION),
  organisationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: isoTimestampSchema,
  components: z.array(componentSchema),
  assignments: z.array(assignmentSchema),
  corrections: z.array(correctionSchema),
  operations: z.array(operationRecordSchema),
});

export interface ComponentCorrection {
  readonly id: string;
  readonly entityType: "COMPONENT" | "ASSIGNMENT";
  readonly entityId: string;
  readonly fieldName: string;
  readonly previousValue: CorrectionValue;
  readonly correctedValue: CorrectionValue;
  readonly reason: string;
  readonly correctedAt: string;
  readonly correctedByUserId: string;
  readonly correctedByNameSnapshot: string;
  readonly operationId: string;
}

export interface ComponentFilters {
  readonly type?: ComponentType;
  readonly status?: ComponentStatus;
  readonly search?: string;
}

export interface CreateComponentInput {
  readonly id: string;
  readonly organisationId: string;
  readonly type: ComponentType;
  readonly serialNumber: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly matrix?: string;
  readonly size: string;
  readonly supplier?: string;
  readonly startingCrownHeightDm?: Decimetres;
  readonly status?: Exclude<ComponentStatus, "ACTIVE">;
  readonly notes?: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface UpdateComponentInput {
  readonly operationId: string;
  readonly componentId: string;
  readonly expectedVersion: number;
  readonly serialNumber?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly matrix?: string;
  readonly size?: string;
  readonly supplier?: string;
  readonly startingCrownHeightDm?: Decimetres;
  readonly status?: ComponentStatus;
  readonly notes?: string;
  readonly reason: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface AssignComponentInput {
  readonly operationId: string;
  readonly assignmentId: string;
  readonly componentId: string;
  readonly holeId: string;
  readonly componentType: ComponentType;
  readonly startDepthDm: Decimetres;
  readonly shiftId?: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface ChangeComponentInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly componentType: ComponentType;
  readonly outgoingAssignmentId: string;
  readonly incomingComponentId: string;
  readonly changeDepthDm: Decimetres;
  readonly removalReason: ComponentRemovalReason;
  readonly removalComment?: string;
  readonly shiftId: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface ResolveAtHoleCompletionInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly assignmentId: string;
  readonly componentId: string;
  readonly componentType: ComponentType;
  readonly expectedVersion: number;
  readonly finalDepthDm: Decimetres;
  readonly outcome: HoleCompletionComponentOutcomeCode;
  readonly targetHoleId?: string;
  readonly comment?: string;
  readonly shiftId?: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface CorrectAssignmentInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly assignmentId: string;
  readonly expectedVersion: number;
  readonly startDepthDm?: Decimetres;
  readonly endDepthDm?: Decimetres;
  readonly removalReason?: ComponentRemovalReason;
  readonly removalComment?: string;
  readonly reason: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface ComponentChangeResult {
  readonly outgoingAssignment: ComponentAssignment;
  readonly incomingAssignment: ComponentAssignment;
  readonly status: "changed" | "already-changed" | "recovered";
}

export interface ComponentCompletionResolutionResult {
  readonly assignment: ComponentAssignment;
  readonly component: Component;
  readonly status: "resolved" | "already-resolved" | "recovered";
}

export type ComponentRecoveryHandler = (
  input: ChangeComponentInput,
  result: ComponentChangeResult,
) => Promise<void>;

export type ComponentRepositoryErrorCode =
  | "ACTIVE_ASSIGNMENT_EXISTS"
  | "COMPONENT_ALREADY_ACTIVE"
  | "CORRUPTED_STORAGE"
  | "DUPLICATE_SERIAL"
  | "INVALID_ASSIGNMENT"
  | "INVALID_STATUS"
  | "NOT_FOUND"
  | "OPERATION_CONFLICT"
  | "STALE_VERSION"
  | "STORAGE_UNAVAILABLE";

export class ComponentRepositoryError extends Error {
  constructor(
    readonly code: ComponentRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ComponentRepositoryError";
  }
}

export interface ComponentRepository {
  list(filters?: ComponentFilters): Promise<readonly Component[]>;
  getById(componentId: string): Promise<Component | null>;
  findBySerial(
    type: ComponentType,
    serialNumber: string,
  ): Promise<Component | null>;
  create(input: CreateComponentInput): Promise<Component>;
  update(input: UpdateComponentInput): Promise<Component>;
  listCorrections(componentId: string): Promise<readonly ComponentCorrection[]>;
}

export interface ComponentAssignmentRepository {
  getActive(
    holeId: string,
    type: ComponentType,
  ): Promise<ComponentAssignment | null>;
  listByHole(holeId: string): Promise<readonly ComponentAssignment[]>;
  listByComponent(
    componentId: string,
  ): Promise<readonly ComponentAssignment[]>;
  getAssignmentById(
    assignmentId: string,
    holeId: string,
  ): Promise<ComponentAssignment | null>;
  assignInitial(input: AssignComponentInput): Promise<ComponentAssignment>;
  changeComponent(input: ChangeComponentInput): Promise<ComponentChangeResult>;
  resolveAtHoleCompletion(
    input: ResolveAtHoleCompletionInput,
  ): Promise<ComponentCompletionResolutionResult>;
  correctAssignment(
    input: CorrectAssignmentInput,
  ): Promise<ComponentAssignment>;
  listCorrections(
    assignmentId: string,
  ): Promise<readonly ComponentCorrection[]>;
  hasPendingChangeOperation(holeId?: string): Promise<boolean>;
  recoverInterruptedChange(): Promise<ComponentChangeResult | null>;
  recoverInterruptedCompletionResolution(): Promise<ComponentCompletionResolutionResult | null>;
}

interface ComponentState {
  readonly revision: number;
  readonly updatedAt: string;
  readonly components: readonly Component[];
  readonly assignments: readonly ComponentAssignment[];
  readonly corrections: readonly ComponentCorrection[];
  readonly operations: readonly z.infer<typeof operationRecordSchema>[];
}

const changeOperationSchema = z.object({
  version: z.literal(COMPONENT_STORAGE_VERSION),
  organisationId: z.string().min(1),
  input: z.object({
    operationId: z.string().min(1),
    holeId: z.string().min(1),
    componentType: componentTypeSchema,
    outgoingAssignmentId: z.string().min(1),
    incomingComponentId: z.string().min(1),
    changeDepthDm: z.number().int().nonnegative(),
    removalReason: removalReasonSchema,
    removalComment: z.string().trim().max(1_000).optional(),
    shiftId: z.string().min(1),
    userId: z.string().min(1),
    userNameSnapshot: z.string().trim().min(1),
    occurredAt: isoTimestampSchema,
  }),
  status: z.enum(["PREPARED", "COMPLETE"]),
});

const completionResolutionInputSchema = z
  .object({
    operationId: z.string().min(1),
    holeId: z.string().min(1),
    assignmentId: z.string().min(1),
    componentId: z.string().min(1),
    componentType: componentTypeSchema,
    expectedVersion: z.number().int().positive(),
    finalDepthDm: z.number().int().nonnegative(),
    outcome: completionOutcomeSchema,
    targetHoleId: z.string().min(1).optional(),
    comment: z.string().trim().max(1_000).optional(),
    shiftId: z.string().min(1).optional(),
    userId: z.string().min(1),
    userNameSnapshot: z.string().trim().min(1),
    occurredAt: isoTimestampSchema,
  })
  .superRefine((input, context) => {
    if (input.outcome !== "CARRIED_FORWARD" && input.targetHoleId !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only a carried-forward component can name a target hole.",
        path: ["targetHoleId"],
      });
    }
    if (
      input.outcome === "CARRIED_FORWARD" &&
      input.targetHoleId === input.holeId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A carried-forward component must target another hole.",
        path: ["targetHoleId"],
      });
    }
  });

const completionResolutionOperationSchema = z.object({
  version: z.literal(COMPONENT_STORAGE_VERSION),
  organisationId: z.string().min(1),
  fingerprint: z.string().min(1),
  input: completionResolutionInputSchema,
  status: z.literal("PREPARED"),
});

function componentsKey(organisationId: string): string {
  return `targetlock:prototype:v${COMPONENT_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:components`;
}

function changeOperationKey(organisationId: string): string {
  return `targetlock:prototype:v${COMPONENT_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:component-change-operation`;
}

function completionResolutionOperationKey(organisationId: string): string {
  return `targetlock:prototype:v${COMPONENT_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:component-completion-resolution-operation`;
}

export function normalizeComponentSerial(serialNumber: string): string {
  return serialNumber.trim().replace(/\s+/g, " ").toLocaleUpperCase("en-AU");
}

function asComponent(value: z.infer<typeof componentSchema>): Component {
  return {
    ...value,
    startingCrownHeightDm:
      value.startingCrownHeightDm === undefined
        ? undefined
        : decimetres(value.startingCrownHeightDm),
  };
}

function asAssignment(
  value: z.infer<typeof assignmentSchema>,
): ComponentAssignment {
  return {
    ...value,
    startDepthDm: decimetres(value.startDepthDm),
    endDepthDm:
      value.endDepthDm === undefined
        ? undefined
        : decimetres(value.endDepthDm),
  };
}

function asCorrection(
  value: z.infer<typeof correctionSchema>,
): ComponentCorrection {
  return value;
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function localComponent(
  input: CreateComponentInput,
  normalizedSerialNumber: string,
): Component {
  return {
    localId: input.id,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    deviceId: DEVICE_ID,
    version: 1,
    organisationId: input.organisationId,
    type: input.type,
    serialNumber: input.serialNumber.trim(),
    normalizedSerialNumber,
    manufacturer: cleanOptional(input.manufacturer),
    model: cleanOptional(input.model),
    matrix: cleanOptional(input.matrix),
    size: input.size.trim(),
    supplier: cleanOptional(input.supplier),
    startingCrownHeightDm: input.startingCrownHeightDm,
    status: input.status ?? "AVAILABLE",
    notes: cleanOptional(input.notes),
    createdByUserId: input.userId,
    createdByNameSnapshot: input.userNameSnapshot.trim(),
  };
}

function operationInputJson(input: object): string {
  return JSON.stringify(input);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function componentStatusForCompletionOutcome(
  outcome: HoleCompletionComponentOutcomeCode,
): ComponentStatus {
  return outcome === "CARRIED_FORWARD" ? "SERVICEABLE" : outcome;
}

function intervalsOverlap(
  firstStart: Decimetres,
  firstEnd: Decimetres | undefined,
  secondStart: Decimetres,
  secondEnd: Decimetres | undefined,
): boolean {
  const firstUpper = firstEnd ?? Number.POSITIVE_INFINITY;
  const secondUpper = secondEnd ?? Number.POSITIVE_INFINITY;
  return firstStart < secondUpper && secondStart < firstUpper;
}

export class LocalComponentRepository
  implements ComponentRepository, ComponentAssignmentRepository
{
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly organisationId: string,
    private readonly seedComponents: readonly Component[] = [],
    private readonly seedAssignments: readonly ComponentAssignment[] = [],
    private readonly onRecovered?: ComponentRecoveryHandler,
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private seedState(): ComponentState {
    return {
      revision: 0,
      updatedAt: "2026-07-21T00:00:00.000Z",
      components: this.seedComponents.filter(
        (component) => component.organisationId === this.organisationId,
      ),
      assignments: this.seedAssignments,
      corrections: [],
      operations: [],
    };
  }

  private readState(): ComponentState {
    let raw: string | null;
    try {
      raw = this.storage.getItem(componentsKey(this.organisationId));
    } catch {
      throw new ComponentRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) return this.seedState();

    try {
      const parsed = componentEnvelopeSchema.safeParse(
        JSON.parse(raw) as unknown,
      );
      if (
        !parsed.success ||
        parsed.data.organisationId !== this.organisationId
      ) {
        throw new ComponentRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted component records are incompatible or belong to another organisation.",
        );
      }
      return {
        revision: parsed.data.revision,
        updatedAt: parsed.data.updatedAt,
        components: parsed.data.components.map(asComponent),
        assignments: parsed.data.assignments.map(asAssignment),
        corrections: parsed.data.corrections.map(asCorrection),
        operations: parsed.data.operations,
      };
    } catch (error) {
      if (error instanceof ComponentRepositoryError) throw error;
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted component records are not valid JSON.",
      );
    }
  }

  private writeState(state: ComponentState): void {
    const parsed = componentEnvelopeSchema.safeParse({
      version: COMPONENT_STORAGE_VERSION,
      organisationId: this.organisationId,
      revision: state.revision,
      updatedAt: state.updatedAt,
      components: state.components,
      assignments: state.assignments,
      corrections: state.corrections,
      operations: state.operations,
    });
    if (!parsed.success) {
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        "Component values did not pass storage validation.",
      );
    }
    try {
      this.storage.setItem(
        componentsKey(this.organisationId),
        JSON.stringify(parsed.data),
      );
    } catch {
      throw new ComponentRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save the component record.",
      );
    }
  }

  private readPreparedChangeOperation(): z.infer<
    typeof changeOperationSchema
  > | null {
    let raw: string | null;
    try {
      raw = this.storage.getItem(changeOperationKey(this.organisationId));
    } catch {
      throw new ComponentRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) return null;
    try {
      const parsed = changeOperationSchema.safeParse(JSON.parse(raw) as unknown);
      if (
        !parsed.success ||
        parsed.data.organisationId !== this.organisationId
      ) {
        throw new ComponentRepositoryError(
          "CORRUPTED_STORAGE",
          "The pending component change is incompatible.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ComponentRepositoryError) throw error;
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        "The pending component change is not valid JSON.",
      );
    }
  }

  private readPreparedCompletionResolution(): z.infer<
    typeof completionResolutionOperationSchema
  > | null {
    let raw: string | null;
    try {
      raw = this.storage.getItem(
        completionResolutionOperationKey(this.organisationId),
      );
    } catch {
      throw new ComponentRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) return null;
    try {
      const parsed = completionResolutionOperationSchema.safeParse(
        JSON.parse(raw) as unknown,
      );
      if (
        !parsed.success ||
        parsed.data.organisationId !== this.organisationId
      ) {
        throw new ComponentRepositoryError(
          "CORRUPTED_STORAGE",
          "The pending component completion resolution is incompatible.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ComponentRepositoryError) throw error;
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        "The pending component completion resolution is not valid JSON.",
      );
    }
  }

  private operationResult(
    state: ComponentState,
    operationId: string,
    input: object,
  ): z.infer<typeof operationRecordSchema> | null {
    const operation =
      state.operations.find((candidate) => candidate.operationId === operationId) ??
      null;
    if (
      operation !== null &&
      operation.inputJson !== operationInputJson(input)
    ) {
      throw new ComponentRepositoryError(
        "OPERATION_CONFLICT",
        "This operation identifier is already used by different data.",
      );
    }
    return operation;
  }

  async list(filters: ComponentFilters = {}): Promise<readonly Component[]> {
    await this.recoverInterruptedChange();
    const query = filters.search?.trim().toLocaleLowerCase("en-AU");
    return this.readState()
      .components.filter(
        (component) =>
          (filters.type === undefined || component.type === filters.type) &&
          (filters.status === undefined ||
            component.status === filters.status) &&
          (query === undefined ||
            query.length === 0 ||
            [
              component.serialNumber,
              component.manufacturer,
              component.model,
              component.matrix,
            ].some((value) => value?.toLocaleLowerCase("en-AU").includes(query))),
      )
      .sort((left, right) =>
        left.serialNumber.localeCompare(right.serialNumber),
      );
  }

  async getById(componentId: string): Promise<Component | null> {
    await this.recoverInterruptedChange();
    return (
      this.readState().components.find(
        (component) => component.localId === componentId,
      ) ?? null
    );
  }

  async findBySerial(
    type: ComponentType,
    serialNumber: string,
  ): Promise<Component | null> {
    const normalized = normalizeComponentSerial(serialNumber);
    return (
      (await this.list({ type })).find(
        (component) => component.normalizedSerialNumber === normalized,
      ) ?? null
    );
  }

  async create(input: CreateComponentInput): Promise<Component> {
    if (input.organisationId !== this.organisationId) {
      throw new ComponentRepositoryError(
        "NOT_FOUND",
        "The component belongs to another organisation.",
      );
    }
    const state = this.readState();
    const existingId = state.components.find(
      (component) => component.localId === input.id,
    );
    const normalizedSerialNumber = normalizeComponentSerial(input.serialNumber);
    const candidate = localComponent(input, normalizedSerialNumber);
    if (existingId !== undefined) {
      if (JSON.stringify(existingId) === JSON.stringify(candidate)) {
        return existingId;
      }
      throw new ComponentRepositoryError(
        "OPERATION_CONFLICT",
        "The component identifier is already used by different data.",
      );
    }
    if (
      state.components.some(
        (component) =>
          component.type === input.type &&
          component.normalizedSerialNumber === normalizedSerialNumber,
      )
    ) {
      throw new ComponentRepositoryError(
        "DUPLICATE_SERIAL",
        `A ${input.type.toLocaleLowerCase("en-AU")} with this serial number already exists.`,
      );
    }
    const parsed = componentSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        "The component values did not pass validation.",
      );
    }
    this.writeState({
      ...state,
      revision: state.revision + 1,
      updatedAt: input.occurredAt,
      components: [...state.components, asComponent(parsed.data)],
    });
    return candidate;
  }

  async update(input: UpdateComponentInput): Promise<Component> {
    const state = this.readState();
    const previous = state.components.find(
      (component) => component.localId === input.componentId,
    );
    if (previous === undefined) {
      throw new ComponentRepositoryError("NOT_FOUND", "Component not found.");
    }
    const priorOperation = this.operationResult(state, input.operationId, input);
    if (priorOperation !== null) return previous;
    if (previous.version !== input.expectedVersion) {
      throw new ComponentRepositoryError(
        "STALE_VERSION",
        "The component changed after this form was opened.",
      );
    }
    if (!input.reason.trim()) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "A correction reason is required.",
      );
    }
    const hasActiveAssignment = state.assignments.some(
      (assignment) =>
        assignment.componentId === previous.localId &&
        assignment.status === "ACTIVE",
    );
    if (
      hasActiveAssignment &&
      input.status !== undefined &&
      input.status !== "ACTIVE"
    ) {
      throw new ComponentRepositoryError(
        "INVALID_STATUS",
        "Close the active assignment before changing this component status.",
      );
    }
    if (!hasActiveAssignment && input.status === "ACTIVE") {
      throw new ComponentRepositoryError(
        "INVALID_STATUS",
        "A component can only become active through an assignment.",
      );
    }

    const serialNumber = input.serialNumber?.trim() ?? previous.serialNumber;
    const normalizedSerialNumber = normalizeComponentSerial(serialNumber);
    if (
      state.components.some(
        (component) =>
          component.localId !== previous.localId &&
          component.type === previous.type &&
          component.normalizedSerialNumber === normalizedSerialNumber,
      )
    ) {
      throw new ComponentRepositoryError(
        "DUPLICATE_SERIAL",
        "Another component of this type already uses that serial number.",
      );
    }

    const updated: Component = {
      ...previous,
      serialNumber,
      normalizedSerialNumber,
      manufacturer:
        input.manufacturer === undefined
          ? previous.manufacturer
          : cleanOptional(input.manufacturer),
      model:
        input.model === undefined ? previous.model : cleanOptional(input.model),
      matrix:
        input.matrix === undefined
          ? previous.matrix
          : cleanOptional(input.matrix),
      size: input.size?.trim() ?? previous.size,
      supplier:
        input.supplier === undefined
          ? previous.supplier
          : cleanOptional(input.supplier),
      startingCrownHeightDm:
        input.startingCrownHeightDm ?? previous.startingCrownHeightDm,
      status: input.status ?? previous.status,
      notes:
        input.notes === undefined ? previous.notes : cleanOptional(input.notes),
      updatedAt: input.occurredAt,
      version: previous.version + 1,
      syncStatus: "local-only",
    };

    const fields: readonly (keyof Component)[] = [
      "serialNumber",
      "manufacturer",
      "model",
      "matrix",
      "size",
      "supplier",
      "startingCrownHeightDm",
      "status",
      "notes",
    ];
    const corrections = fields
      .filter((field) => previous[field] !== updated[field])
      .map<ComponentCorrection>((field, index) => ({
        id: `${input.operationId}-${index + 1}`,
        entityType: "COMPONENT",
        entityId: previous.localId,
        fieldName: field,
        previousValue: (previous[field] ?? null) as CorrectionValue,
        correctedValue: (updated[field] ?? null) as CorrectionValue,
        reason: input.reason.trim(),
        correctedAt: input.occurredAt,
        correctedByUserId: input.userId,
        correctedByNameSnapshot: input.userNameSnapshot,
        operationId: input.operationId,
      }));
    if (corrections.length === 0) return previous;

    this.writeState({
      ...state,
      revision: state.revision + 1,
      updatedAt: input.occurredAt,
      components: state.components.map((component) =>
        component.localId === updated.localId ? updated : component,
      ),
      corrections: [...state.corrections, ...corrections],
      operations: [
        ...state.operations,
        {
          operationId: input.operationId,
          kind: "CORRECT",
          inputJson: operationInputJson(input),
          completedAt: input.occurredAt,
        },
      ],
    });
    return updated;
  }

  async listCorrections(
    entityId: string,
  ): Promise<readonly ComponentCorrection[]> {
    return this.readState().corrections.filter(
      (correction) => correction.entityId === entityId,
    );
  }

  async getActive(
    holeId: string,
    type: ComponentType,
  ): Promise<ComponentAssignment | null> {
    await this.recoverInterruptedChange();
    const active = this.readState().assignments.filter(
      (assignment) =>
        assignment.holeId === holeId &&
        assignment.componentType === type &&
        assignment.status === "ACTIVE",
    );
    if (active.length > 1) {
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        `More than one active ${type.toLocaleLowerCase("en-AU")} exists for ${holeId}.`,
      );
    }
    return active[0] ?? null;
  }

  async listByHole(
    holeId: string,
  ): Promise<readonly ComponentAssignment[]> {
    await this.recoverInterruptedChange();
    return this.readState()
      .assignments.filter((assignment) => assignment.holeId === holeId)
      .sort((left, right) => left.startDepthDm - right.startDepthDm);
  }

  async listByComponent(
    componentId: string,
  ): Promise<readonly ComponentAssignment[]> {
    await this.recoverInterruptedChange();
    return this.readState()
      .assignments.filter(
        (assignment) => assignment.componentId === componentId,
      )
      .sort((left, right) => left.startDepthDm - right.startDepthDm);
  }

  async getAssignmentById(
    assignmentId: string,
    holeId: string,
  ): Promise<ComponentAssignment | null> {
    await this.recoverInterruptedChange();
    return (
      this.readState().assignments.find(
        (assignment) =>
          assignment.localId === assignmentId && assignment.holeId === holeId,
      ) ?? null
    );
  }

  async assignInitial(
    input: AssignComponentInput,
  ): Promise<ComponentAssignment> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const state = this.readState();
    const priorOperation = this.operationResult(state, input.operationId, input);
    if (priorOperation !== null) {
      const existing = state.assignments.find(
        (assignment) => assignment.localId === priorOperation.incomingAssignmentId,
      );
      if (existing === undefined) {
        throw new ComponentRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed assignment operation has no result.",
        );
      }
      return existing;
    }
    const component = state.components.find(
      (candidate) => candidate.localId === input.componentId,
    );
    if (component === undefined || component.type !== input.componentType) {
      throw new ComponentRepositoryError(
        "NOT_FOUND",
        "The selected component is not available.",
      );
    }
    if (!["AVAILABLE", "SERVICEABLE"].includes(component.status)) {
      throw new ComponentRepositoryError(
        component.status === "ACTIVE"
          ? "COMPONENT_ALREADY_ACTIVE"
          : "INVALID_STATUS",
        "The selected component is not available for assignment.",
      );
    }
    const activeElsewhere = state.assignments.find(
      (assignment) =>
        assignment.componentId === component.localId &&
        assignment.status === "ACTIVE",
    );
    if (activeElsewhere !== undefined) {
      throw new ComponentRepositoryError(
        "COMPONENT_ALREADY_ACTIVE",
        `${component.serialNumber} is already active in ${activeElsewhere.holeId}.`,
      );
    }
    if (
      state.assignments.some(
        (assignment) =>
          assignment.holeId === input.holeId &&
          assignment.componentType === input.componentType &&
          assignment.status === "ACTIVE",
      )
    ) {
      throw new ComponentRepositoryError(
        "ACTIVE_ASSIGNMENT_EXISTS",
        `This hole already has an active ${input.componentType.toLocaleLowerCase("en-AU")}.`,
      );
    }
    const assignment: ComponentAssignment = {
      localId: input.assignmentId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      deviceId: DEVICE_ID,
      version: 1,
      componentId: input.componentId,
      holeId: input.holeId,
      componentType: input.componentType,
      startDepthDm: input.startDepthDm,
      installedShiftId: input.shiftId,
      installedAt: input.occurredAt,
      installedByUserId: input.userId,
      installedByNameSnapshot: input.userNameSnapshot,
      status: "ACTIVE",
    };
    this.writeState({
      ...state,
      revision: state.revision + 1,
      updatedAt: input.occurredAt,
      components: state.components.map((candidate) =>
        candidate.localId === component.localId
          ? {
              ...candidate,
              status: "ACTIVE",
              updatedAt: input.occurredAt,
              version: candidate.version + 1,
              syncStatus: "local-only",
            }
          : candidate,
      ),
      assignments: [...state.assignments, assignment],
      operations: [
        ...state.operations,
        {
          operationId: input.operationId,
          kind: "ASSIGN_INITIAL",
          inputJson: operationInputJson(input),
          incomingAssignmentId: assignment.localId,
          completedAt: input.occurredAt,
        },
      ],
    });
    return assignment;
  }

  private applyChange(
    input: ChangeComponentInput,
    recovered: boolean,
  ): ComponentChangeResult {
    const state = this.readState();
    const priorOperation = this.operationResult(state, input.operationId, input);
    if (priorOperation !== null) {
      const outgoing = state.assignments.find(
        ({ localId }) => localId === priorOperation.outgoingAssignmentId,
      );
      const incoming = state.assignments.find(
        ({ localId }) => localId === priorOperation.incomingAssignmentId,
      );
      if (outgoing === undefined || incoming === undefined) {
        throw new ComponentRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed component change has incomplete assignment records.",
        );
      }
      return {
        outgoingAssignment: outgoing,
        incomingAssignment: incoming,
        status: recovered ? "recovered" : "already-changed",
      };
    }
    if (input.removalReason === "OTHER" && !input.removalComment?.trim()) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "A removal comment is required when Other is selected.",
      );
    }
    const outgoing = state.assignments.find(
      (assignment) => assignment.localId === input.outgoingAssignmentId,
    );
    if (
      outgoing === undefined ||
      outgoing.status !== "ACTIVE" ||
      outgoing.holeId !== input.holeId ||
      outgoing.componentType !== input.componentType
    ) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "The outgoing component is no longer the active assignment.",
      );
    }
    if (input.changeDepthDm < outgoing.startDepthDm) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "Change depth cannot precede the outgoing assignment start depth.",
      );
    }
    const incomingComponent = state.components.find(
      (component) => component.localId === input.incomingComponentId,
    );
    if (
      incomingComponent === undefined ||
      incomingComponent.type !== input.componentType
    ) {
      throw new ComponentRepositoryError(
        "NOT_FOUND",
        "The incoming component was not found.",
      );
    }
    if (!["AVAILABLE", "SERVICEABLE"].includes(incomingComponent.status)) {
      throw new ComponentRepositoryError(
        incomingComponent.status === "ACTIVE"
          ? "COMPONENT_ALREADY_ACTIVE"
          : "INVALID_STATUS",
        "The incoming component is not available.",
      );
    }
    const activeElsewhere = state.assignments.find(
      (assignment) =>
        assignment.componentId === incomingComponent.localId &&
        assignment.status === "ACTIVE",
    );
    if (activeElsewhere !== undefined) {
      throw new ComponentRepositoryError(
        "COMPONENT_ALREADY_ACTIVE",
        `${incomingComponent.serialNumber} is already active in ${activeElsewhere.holeId}.`,
      );
    }
    const outgoingComponent = state.components.find(
      (component) => component.localId === outgoing.componentId,
    );
    if (outgoingComponent === undefined) {
      throw new ComponentRepositoryError(
        "CORRUPTED_STORAGE",
        "The outgoing component registry record is missing.",
      );
    }

    const incomingAssignmentId = `${input.operationId}-incoming`;
    const closedOutgoing: ComponentAssignment = {
      ...outgoing,
      endDepthDm: input.changeDepthDm,
      removedShiftId: input.shiftId,
      removedAt: input.occurredAt,
      removedByUserId: input.userId,
      removedByNameSnapshot: input.userNameSnapshot,
      removalReason: input.removalReason,
      removalComment: cleanOptional(input.removalComment),
      status: "CLOSED",
      updatedAt: input.occurredAt,
      version: outgoing.version + 1,
      syncStatus: "local-only",
    };
    const incomingAssignment: ComponentAssignment = {
      localId: incomingAssignmentId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      deviceId: DEVICE_ID,
      version: 1,
      componentId: incomingComponent.localId,
      holeId: input.holeId,
      componentType: input.componentType,
      startDepthDm: input.changeDepthDm,
      installedShiftId: input.shiftId,
      installedAt: input.occurredAt,
      installedByUserId: input.userId,
      installedByNameSnapshot: input.userNameSnapshot,
      status: "ACTIVE",
    };
    const outgoingStatus: ComponentStatus =
      input.removalReason === "LOST_DOWNHOLE" ? "LOST_DOWNHOLE" : "REMOVED";
    const nextState: ComponentState = {
      ...state,
      revision: state.revision + 1,
      updatedAt: input.occurredAt,
      components: state.components.map((component) => {
        if (component.localId === outgoingComponent.localId) {
          return {
            ...component,
            status: outgoingStatus,
            updatedAt: input.occurredAt,
            version: component.version + 1,
            syncStatus: "local-only" as const,
          };
        }
        if (component.localId === incomingComponent.localId) {
          return {
            ...component,
            status: "ACTIVE" as const,
            updatedAt: input.occurredAt,
            version: component.version + 1,
            syncStatus: "local-only" as const,
          };
        }
        return component;
      }),
      assignments: [
        ...state.assignments.map((assignment) =>
          assignment.localId === closedOutgoing.localId
            ? closedOutgoing
            : assignment,
        ),
        incomingAssignment,
      ],
      operations: [
        ...state.operations,
        {
          operationId: input.operationId,
          kind: "CHANGE_COMPONENT",
          inputJson: operationInputJson(input),
          outgoingAssignmentId: closedOutgoing.localId,
          incomingAssignmentId,
          completedAt: input.occurredAt,
        },
      ],
    };
    this.writeState(nextState);
    return {
      outgoingAssignment: closedOutgoing,
      incomingAssignment,
      status: recovered ? "recovered" : "changed",
    };
  }

  private applyCompletionResolution(
    input: ResolveAtHoleCompletionInput,
    fingerprint: string,
    recovered: boolean,
  ): ComponentCompletionResolutionResult {
    const state = this.readState();
    const priorOperation = state.operations.find(
      (operation) => operation.operationId === input.operationId,
    );
    if (priorOperation !== undefined) {
      if (
        priorOperation.kind !== "RESOLVE_AT_HOLE_COMPLETION" ||
        priorOperation.inputJson !== fingerprint
      ) {
        throw new ComponentRepositoryError(
          "OPERATION_CONFLICT",
          "This operation identifier is already used by different component data.",
        );
      }
      const assignment = state.assignments.find(
        (candidate) => candidate.localId === priorOperation.outgoingAssignmentId,
      );
      const component = state.components.find(
        (candidate) => candidate.localId === assignment?.componentId,
      );
      if (assignment === undefined || component === undefined) {
        throw new ComponentRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed component resolution has incomplete records.",
        );
      }
      return {
        assignment,
        component,
        status: recovered ? "recovered" : "already-resolved",
      };
    }

    const assignment = state.assignments.find(
      (candidate) => candidate.localId === input.assignmentId,
    );
    if (
      assignment === undefined ||
      assignment.status !== "ACTIVE" ||
      assignment.holeId !== input.holeId ||
      assignment.componentId !== input.componentId ||
      assignment.componentType !== input.componentType
    ) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "The component is no longer the active assignment for this hole.",
      );
    }
    if (assignment.version !== input.expectedVersion) {
      throw new ComponentRepositoryError(
        "STALE_VERSION",
        "The component assignment changed before hole completion.",
      );
    }
    if (input.finalDepthDm < assignment.startDepthDm) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "Final depth cannot precede the component assignment start depth.",
      );
    }
    const component = state.components.find(
      (candidate) => candidate.localId === assignment.componentId,
    );
    if (
      component === undefined ||
      component.type !== input.componentType ||
      component.status !== "ACTIVE"
    ) {
      throw new ComponentRepositoryError(
        component === undefined ? "NOT_FOUND" : "INVALID_STATUS",
        "The active component registry record does not match the assignment.",
      );
    }

    const closedAssignment: ComponentAssignment = {
      ...assignment,
      endDepthDm: input.finalDepthDm,
      removedShiftId: input.shiftId,
      removedAt: input.occurredAt,
      removedByUserId: input.userId,
      removedByNameSnapshot: input.userNameSnapshot,
      removalReason:
        input.outcome === "LOST_DOWNHOLE"
          ? "LOST_DOWNHOLE"
          : "HOLE_COMPLETED",
      removalComment: cleanOptional(input.comment),
      status: "CLOSED",
      updatedAt: input.occurredAt,
      version: assignment.version + 1,
      syncStatus: "local-only",
    };
    const resolvedComponent: Component = {
      ...component,
      status: componentStatusForCompletionOutcome(input.outcome),
      updatedAt: input.occurredAt,
      version: component.version + 1,
      syncStatus: "local-only",
    };
    this.writeState({
      ...state,
      revision: state.revision + 1,
      updatedAt: input.occurredAt,
      components: state.components.map((candidate) =>
        candidate.localId === resolvedComponent.localId
          ? resolvedComponent
          : candidate,
      ),
      assignments: state.assignments.map((candidate) =>
        candidate.localId === closedAssignment.localId
          ? closedAssignment
          : candidate,
      ),
      operations: [
        ...state.operations,
        {
          operationId: input.operationId,
          kind: "RESOLVE_AT_HOLE_COMPLETION",
          inputJson: fingerprint,
          outgoingAssignmentId: closedAssignment.localId,
          completedAt: input.occurredAt,
        },
      ],
    });
    return {
      assignment: closedAssignment,
      component: resolvedComponent,
      status: recovered ? "recovered" : "resolved",
    };
  }

  async resolveAtHoleCompletion(
    input: ResolveAtHoleCompletionInput,
  ): Promise<ComponentCompletionResolutionResult> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const parsed = completionResolutionInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "The component completion values did not pass validation.",
      );
    }
    const normalizedInput: ResolveAtHoleCompletionInput = {
      ...parsed.data,
      finalDepthDm: decimetres(parsed.data.finalDepthDm),
    };
    const fingerprint = canonicalJson(parsed.data);
    const pendingResolution = this.readPreparedCompletionResolution();
    if (pendingResolution !== null) {
      if (
        pendingResolution.input.operationId !== input.operationId ||
        pendingResolution.fingerprint !== fingerprint
      ) {
        throw new ComponentRepositoryError(
          "OPERATION_CONFLICT",
          "Another component completion resolution must be recovered first.",
        );
      }
      const result = this.applyCompletionResolution(
        normalizedInput,
        fingerprint,
        true,
      );
      try {
        this.storage.removeItem(
          completionResolutionOperationKey(this.organisationId),
        );
      } catch {
        // The completed operation can be cleaned up idempotently on retry.
      }
      return result;
    }
    if (this.readPreparedChangeOperation()?.status === "PREPARED") {
      throw new ComponentRepositoryError(
        "OPERATION_CONFLICT",
        "A component change must be recovered before hole completion.",
      );
    }

    const prepared = completionResolutionOperationSchema.parse({
      version: COMPONENT_STORAGE_VERSION,
      organisationId: this.organisationId,
      fingerprint,
      input: parsed.data,
      status: "PREPARED",
    });
    try {
      this.storage.setItem(
        completionResolutionOperationKey(this.organisationId),
        JSON.stringify(prepared),
      );
    } catch {
      throw new ComponentRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not prepare the component completion resolution.",
      );
    }

    let result: ComponentCompletionResolutionResult;
    try {
      result = this.applyCompletionResolution(
        normalizedInput,
        fingerprint,
        false,
      );
    } catch (error) {
      if (
        !(error instanceof ComponentRepositoryError) ||
        error.code !== "STORAGE_UNAVAILABLE"
      ) {
        try {
          this.storage.removeItem(
            completionResolutionOperationKey(this.organisationId),
          );
        } catch {
          // An invalid prepared envelope is reported on the next hydration.
        }
      }
      throw error;
    }
    try {
      this.storage.removeItem(
        completionResolutionOperationKey(this.organisationId),
      );
    } catch {
      // The state record makes a repeated cleanup idempotent.
    }
    return result;
  }

  async changeComponent(
    input: ChangeComponentInput,
  ): Promise<ComponentChangeResult> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const prepared = changeOperationSchema.safeParse({
      version: COMPONENT_STORAGE_VERSION,
      organisationId: this.organisationId,
      input,
      status: "PREPARED",
    });
    if (!prepared.success) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "The component change values did not pass validation.",
      );
    }
    try {
      this.storage.setItem(
        changeOperationKey(this.organisationId),
        JSON.stringify(prepared.data),
      );
    } catch {
      throw new ComponentRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not prepare the component change.",
      );
    }

    let result: ComponentChangeResult;
    try {
      result = this.applyChange(input, false);
    } catch (error) {
      if (
        !(error instanceof ComponentRepositoryError) ||
        error.code !== "STORAGE_UNAVAILABLE"
      ) {
        try {
          this.storage.removeItem(changeOperationKey(this.organisationId));
        } catch {
          // The invalid prepared record will be surfaced as storage corruption.
        }
      }
      throw error;
    }
    try {
      this.storage.removeItem(changeOperationKey(this.organisationId));
    } catch {
      // The committed operation is recovered and cleaned up on hydration.
    }
    return result;
  }

  async recoverInterruptedChange(): Promise<ComponentChangeResult | null> {
    const operation = this.readPreparedChangeOperation();
    if (operation === null) return null;

    const input: ChangeComponentInput = {
      ...operation.input,
      changeDepthDm: decimetres(operation.input.changeDepthDm),
    };
    const priorOperation = this.operationResult(
      this.readState(),
      input.operationId,
      input,
    );
    if (priorOperation === null) {
      try {
        this.mutationGuard?.assertHoleMutable(operation.input.holeId);
      } catch (error) {
        try {
          this.storage.removeItem(changeOperationKey(this.organisationId));
        } catch {
          // Best-effort cleanup of an unusable prepared operation.
        }
        if (isHoleLockedError(error)) return null;
        throw error;
      }
    }

    const result = this.applyChange(input, true);
    try {
      this.storage.removeItem(changeOperationKey(this.organisationId));
    } catch {
      // The operation is already idempotently committed.
    }
    await this.onRecovered?.(input, result);
    return result;
  }

  async hasPendingChangeOperation(holeId?: string): Promise<boolean> {
    const change = this.readPreparedChangeOperation();
    if (
      change?.status === "PREPARED" &&
      (holeId === undefined || change.input.holeId === holeId)
    ) {
      return true;
    }
    const resolution = this.readPreparedCompletionResolution();
    return (
      resolution !== null &&
      (holeId === undefined || resolution.input.holeId === holeId)
    );
  }

  async recoverInterruptedCompletionResolution(): Promise<ComponentCompletionResolutionResult | null> {
    const operation = this.readPreparedCompletionResolution();
    if (operation === null) return null;
    const input: ResolveAtHoleCompletionInput = {
      ...operation.input,
      finalDepthDm: decimetres(operation.input.finalDepthDm),
    };
    const state = this.readState();
    const priorResolution = state.operations.find(
      (candidate) =>
        candidate.kind === "RESOLVE_AT_HOLE_COMPLETION" &&
        candidate.operationId === input.operationId,
    );
    if (priorResolution === undefined) {
      try {
        this.mutationGuard?.assertHoleMutable(operation.input.holeId);
      } catch (error) {
        try {
          this.storage.removeItem(
            completionResolutionOperationKey(this.organisationId),
          );
        } catch {
          // Best-effort cleanup of an unusable prepared operation.
        }
        if (isHoleLockedError(error)) return null;
        throw error;
      }
    }
    const result = this.applyCompletionResolution(
      input,
      operation.fingerprint,
      true,
    );
    try {
      this.storage.removeItem(
        completionResolutionOperationKey(this.organisationId),
      );
    } catch {
      // The operation is already idempotently committed.
    }
    return result;
  }

  async correctAssignment(
    input: CorrectAssignmentInput,
  ): Promise<ComponentAssignment> {
    const state = this.readState();
    const previous = state.assignments.find(
      (assignment) =>
        assignment.localId === input.assignmentId &&
        assignment.holeId === input.holeId,
    );
    if (previous === undefined) {
      throw new ComponentRepositoryError("NOT_FOUND", "Assignment not found.");
    }
    this.mutationGuard?.assertHoleMutable(previous.holeId);
    const priorOperation = this.operationResult(state, input.operationId, input);
    if (priorOperation !== null) return previous;
    if (previous.version !== input.expectedVersion) {
      throw new ComponentRepositoryError(
        "STALE_VERSION",
        "The assignment changed after this form was opened.",
      );
    }
    if (!input.reason.trim()) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "A correction reason is required.",
      );
    }
    const startDepthDm = input.startDepthDm ?? previous.startDepthDm;
    const endDepthDm =
      input.endDepthDm === undefined ? previous.endDepthDm : input.endDepthDm;
    if (endDepthDm !== undefined && endDepthDm < startDepthDm) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "Assignment end depth cannot precede its start depth.",
      );
    }
    if (
      state.assignments.some(
        (assignment) =>
          assignment.localId !== previous.localId &&
          assignment.holeId === previous.holeId &&
          assignment.componentType === previous.componentType &&
          intervalsOverlap(
            startDepthDm,
            endDepthDm,
            assignment.startDepthDm,
            assignment.endDepthDm,
          ),
      )
    ) {
      throw new ComponentRepositoryError(
        "INVALID_ASSIGNMENT",
        "The corrected boundary would overlap another assignment.",
      );
    }
    const updated: ComponentAssignment = {
      ...previous,
      startDepthDm,
      endDepthDm,
      removalReason: input.removalReason ?? previous.removalReason,
      removalComment:
        input.removalComment === undefined
          ? previous.removalComment
          : cleanOptional(input.removalComment),
      updatedAt: input.occurredAt,
      version: previous.version + 1,
      syncStatus: "local-only",
    };
    const fields: readonly (keyof ComponentAssignment)[] = [
      "startDepthDm",
      "endDepthDm",
      "removalReason",
      "removalComment",
    ];
    const corrections = fields
      .filter((field) => previous[field] !== updated[field])
      .map<ComponentCorrection>((field, index) => ({
        id: `${input.operationId}-${index + 1}`,
        entityType: "ASSIGNMENT",
        entityId: previous.localId,
        fieldName: field,
        previousValue: (previous[field] ?? null) as CorrectionValue,
        correctedValue: (updated[field] ?? null) as CorrectionValue,
        reason: input.reason.trim(),
        correctedAt: input.occurredAt,
        correctedByUserId: input.userId,
        correctedByNameSnapshot: input.userNameSnapshot,
        operationId: input.operationId,
      }));
    if (corrections.length === 0) return previous;
    this.writeState({
      ...state,
      revision: state.revision + 1,
      updatedAt: input.occurredAt,
      assignments: state.assignments.map((assignment) =>
        assignment.localId === updated.localId ? updated : assignment,
      ),
      corrections: [...state.corrections, ...corrections],
      operations: [
        ...state.operations,
        {
          operationId: input.operationId,
          kind: "CORRECT",
          inputJson: operationInputJson(input),
          completedAt: input.occurredAt,
        },
      ],
    });
    return updated;
  }
}

export function createBrowserComponentRepository(
  organisationId: string,
  seedComponents: readonly Component[] = [],
  seedAssignments: readonly ComponentAssignment[] = [],
  onRecovered?: ComponentRecoveryHandler,
  mutationGuard?: HoleMutationGuardPort,
): LocalComponentRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalComponentRepository(
        storage,
        organisationId,
        seedComponents,
        seedAssignments,
        onRecovered,
        mutationGuard,
      );
}
