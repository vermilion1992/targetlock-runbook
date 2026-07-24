import { z } from "zod";

import {
  decimetres,
  type ActualTrajectoryConfiguration,
  type HoleCoordinateConfiguration,
  type HoleTarget,
  type NorthReference,
  type PlannedHoleTrajectory,
  type PlannedTrajectoryStation,
  type ReferenceConfiguration,
  type TargetAttitudeMode,
  type TrajectorySurveySelection,
  type TrajectoryTrackingTolerance,
} from "@/domain";
import { migrateTargetAttitudeMode } from "@/domain/target-migration";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const TRAJECTORY_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";
const EPOCH = new Date(0).toISOString();

const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);
const metadataShape = {
  localId: z.string().min(1),
  serverId: z.string().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
};
const northReferenceSchema = z.enum([
  "MAGNETIC",
  "TRUE",
  "GRID",
  "NOT_SPECIFIED",
]);

const plannedStationSchema = z.object({
  id: z.string().min(1),
  measuredDepthDm: z.number().int().nonnegative(),
  dipTenths: z.number().int().min(-900).max(900),
  azimuthTenths: z.number().int().min(0).max(3599),
  northReference: northReferenceSchema,
  stationType: z.enum([
    "COLLAR",
    "CONTROL",
    "TARGET_DEPTH",
    "PLANNED_ENDPOINT",
  ]),
  note: z.string().max(2_000).optional(),
});

const plannedSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2_000).optional(),
  northReference: northReferenceSchema,
  desurveyMethod: z.literal("MINIMUM_CURVATURE"),
  stations: z.array(plannedStationSchema).min(2),
  targetId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "SUPERSEDED"]),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().min(1),
});

const coordinateSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  coordinateMode: z.enum(["RELATIVE", "MINE_GRID"]),
  coordinateSystemName: z.string().max(200).optional(),
  epsgCode: z.string().max(50).optional(),
  collarEastingDm: z.number().int().optional(),
  collarNorthingDm: z.number().int().optional(),
  collarRlDm: z.number().int().optional(),
  calculationNorthReference: northReferenceSchema,
  referenceConfigurationId: z.string().min(1).optional(),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().min(1),
});

const referenceSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  gridRotationDeg: z.number().finite(),
  magneticDeclinationDeg: z.number().finite(),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().min(1),
});

const targetAttitudeModeSchema = z.enum([
  "AUTO_SMOOTH",
  "MATCH_ENTRY_DIRECTION",
  "SAME_AS_COLLAR",
  // Legacy storage values — migrated on read.
  "UNCONSTRAINED",
  "CUSTOM",
]);

const targetSchema = z.object({
  id: z.string().min(1),
  holeId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  coordinateMode: z.enum(["RELATIVE", "MINE_GRID"]),
  eastingDm: z.number().int(),
  northingDm: z.number().int(),
  rlDm: z.number().int(),
  radiusDm: z.number().int().nonnegative().optional(),
  targetMeasuredDepthDm: z.number().int().nonnegative().optional(),
  attitudeMode: targetAttitudeModeSchema.optional(),
  desiredDipTenths: z.number().int().min(-900).max(900).optional(),
  desiredAzimuthTenths: z.number().int().min(0).max(3599).optional(),
  desiredNorthReference: northReferenceSchema.optional(),
  note: z.string().max(2_000).optional(),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

const actualSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  collarDipTenths: z.number().int().min(-900).max(900),
  collarAzimuthTenths: z.number().int().min(0).max(3599),
  collarNorthReference: northReferenceSchema,
  desurveyMethod: z.literal("MINIMUM_CURVATURE"),
  preferredSurveyIntervalDm: z.number().int().positive().optional(),
});

const selectionSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  depthDm: z.number().int().nonnegative(),
  selectedSurveyId: z.string().min(1),
  selectionReason: z.enum(["LATEST_READING", "USER_SELECTED"]),
  selectedByUserId: z.string().min(1).optional(),
  selectedByNameSnapshot: z.string().min(1).optional(),
  selectedAt: z.string().datetime().optional(),
});

const toleranceSchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  horizontalReviewDm: z.number().int().nonnegative().optional(),
  horizontalOutsideDm: z.number().int().nonnegative().optional(),
  verticalReviewDm: z.number().int().nonnegative().optional(),
  verticalOutsideDm: z.number().int().nonnegative().optional(),
  spatialReviewDm: z.number().int().nonnegative().optional(),
  spatialOutsideDm: z.number().int().nonnegative().optional(),
  dipReviewTenths: z.number().int().nonnegative().optional(),
  azimuthReviewTenths: z.number().int().nonnegative().optional(),
  source: z.enum(["PROJECT_CONFIGURED", "DISPLAY_ONLY"]),
});

const operationSchema = z.object({
  operationId: z.string().min(1),
  kind: z.string().min(1),
  entityId: z.string().min(1),
  completedAt: z.string().datetime(),
});

const envelopeSchema = z.object({
  version: z.literal(TRAJECTORY_STORAGE_VERSION),
  holeId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  coordinateConfiguration: coordinateSchema.nullable(),
  referenceConfiguration: referenceSchema.nullable(),
  plans: z.array(plannedSchema),
  target: targetSchema.nullable(),
  actualConfiguration: actualSchema.nullable(),
  selections: z.array(selectionSchema),
  tolerance: toleranceSchema.nullable(),
  operations: z.array(operationSchema),
});

type Envelope = z.infer<typeof envelopeSchema>;

export type TrajectoryRepositoryErrorCode =
  | "CORRUPTED_STORAGE"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_STATE"
  | "NOT_FOUND"
  | "STALE_VERSION"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_FAILED";

export class TrajectoryRepositoryError extends Error {
  constructor(
    readonly code: TrajectoryRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TrajectoryRepositoryError";
  }
}

export interface SaveCoordinateConfigurationInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly configurationId?: string;
  readonly expectedVersion?: number;
  readonly coordinateMode: HoleCoordinateConfiguration["coordinateMode"];
  readonly coordinateSystemName?: string;
  readonly epsgCode?: string;
  readonly collarEastingDm?: number;
  readonly collarNorthingDm?: number;
  readonly collarRlDm?: number;
  readonly calculationNorthReference: NorthReference;
  readonly referenceConfigurationId?: string;
  readonly createdByUserId: string;
  readonly createdByNameSnapshot: string;
  readonly occurredAt: string;
}

export interface SaveReferenceConfigurationInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly configurationId?: string;
  readonly expectedVersion?: number;
  readonly gridRotationDeg: number;
  readonly magneticDeclinationDeg: number;
  readonly createdByUserId: string;
  readonly createdByNameSnapshot: string;
  readonly occurredAt: string;
}

export interface SavePlannedTrajectoryInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly planId?: string;
  readonly expectedVersion?: number;
  readonly name: string;
  readonly description?: string;
  readonly northReference: NorthReference;
  readonly stations: readonly PlannedTrajectoryStation[];
  readonly targetId?: string;
  readonly createdByUserId: string;
  readonly createdByNameSnapshot: string;
  readonly occurredAt: string;
}

export interface SaveHoleTargetInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly targetId?: string;
  readonly expectedVersion?: number;
  readonly name: string;
  readonly coordinateMode: HoleTarget["coordinateMode"];
  readonly eastingDm: number;
  readonly northingDm: number;
  readonly rlDm: number;
  readonly radiusDm?: number;
  readonly targetMeasuredDepthDm: number;
  readonly attitudeMode?: TargetAttitudeMode;
  readonly desiredDipTenths?: number;
  readonly desiredAzimuthTenths?: number;
  readonly desiredNorthReference?: NorthReference;
  readonly note?: string;
  readonly occurredAt: string;
}

export interface SaveActualConfigurationInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly configurationId?: string;
  readonly expectedVersion?: number;
  readonly collarDipTenths: number;
  readonly collarAzimuthTenths: number;
  readonly collarNorthReference: NorthReference;
  /** Pass null to clear a previously saved Survey interval. */
  readonly preferredSurveyIntervalDm?: number | null;
  readonly occurredAt: string;
}

export interface SaveSurveySelectionInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly depthDm: number;
  readonly selectedSurveyId: string;
  readonly selectedByUserId: string;
  readonly selectedByNameSnapshot: string;
  readonly occurredAt: string;
}

export interface TrajectorySeed {
  readonly coordinateConfiguration?: HoleCoordinateConfiguration | null;
  readonly referenceConfiguration?: ReferenceConfiguration | null;
  readonly plans?: readonly PlannedHoleTrajectory[];
  readonly target?: HoleTarget | null;
  readonly actualConfiguration?: ActualTrajectoryConfiguration | null;
  readonly selections?: readonly TrajectorySurveySelection[];
  readonly tolerance?: TrajectoryTrackingTolerance | null;
}

export interface TrajectoryRepository {
  getCoordinateConfiguration(
    holeId: string,
  ): Promise<HoleCoordinateConfiguration | null>;
  saveCoordinateConfiguration(
    input: SaveCoordinateConfigurationInput,
  ): Promise<HoleCoordinateConfiguration>;
  getReferenceConfiguration(
    holeId: string,
  ): Promise<ReferenceConfiguration | null>;
  saveReferenceConfiguration(
    input: SaveReferenceConfigurationInput,
  ): Promise<ReferenceConfiguration>;
  getActivePlan(holeId: string): Promise<PlannedHoleTrajectory | null>;
  listPlans(holeId: string): Promise<readonly PlannedHoleTrajectory[]>;
  saveDraft(input: SavePlannedTrajectoryInput): Promise<PlannedHoleTrajectory>;
  activate(
    holeId: string,
    planId: string,
    operationId: string,
    occurredAt: string,
  ): Promise<PlannedHoleTrajectory>;
  supersede(
    holeId: string,
    planId: string,
    operationId: string,
    occurredAt: string,
  ): Promise<PlannedHoleTrajectory>;
  getTarget(holeId: string): Promise<HoleTarget | null>;
  saveTarget(input: SaveHoleTargetInput): Promise<HoleTarget>;
  getActualConfiguration(
    holeId: string,
  ): Promise<ActualTrajectoryConfiguration | null>;
  saveActualConfiguration(
    input: SaveActualConfigurationInput,
  ): Promise<ActualTrajectoryConfiguration>;
  listSelections(holeId: string): Promise<readonly TrajectorySurveySelection[]>;
  saveSurveySelection(
    input: SaveSurveySelectionInput,
  ): Promise<TrajectorySurveySelection>;
  getTolerance(holeId: string): Promise<TrajectoryTrackingTolerance | null>;
}

function storageKey(holeId: string): string {
  return `targetlock:prototype:v${TRAJECTORY_STORAGE_VERSION}:hole:${encodeURIComponent(holeId)}:trajectory`;
}

function emptyEnvelope(holeId: string): Envelope {
  return {
    version: TRAJECTORY_STORAGE_VERSION,
    holeId,
    revision: 0,
    updatedAt: EPOCH,
    coordinateConfiguration: null,
    referenceConfiguration: null,
    plans: [],
    target: null,
    actualConfiguration: null,
    selections: [],
    tolerance: null,
    operations: [],
  };
}

function asPlan(value: z.infer<typeof plannedSchema>): PlannedHoleTrajectory {
  return {
    ...value,
    stations: value.stations.map((station) => ({
      ...station,
      measuredDepthDm: decimetres(station.measuredDepthDm),
    })),
  };
}

function asSelection(
  value: z.infer<typeof selectionSchema>,
): TrajectorySurveySelection {
  return {
    ...value,
    depthDm: decimetres(value.depthDm),
  };
}

function asTarget(value: z.infer<typeof targetSchema>): HoleTarget {
  const attitudeMode = migrateTargetAttitudeMode(value);
  return {
    ...value,
    attitudeMode,
    targetMeasuredDepthDm:
      value.targetMeasuredDepthDm === undefined
        ? undefined
        : decimetres(value.targetMeasuredDepthDm),
  };
}

function asActualConfiguration(
  value: z.infer<typeof actualSchema>,
): ActualTrajectoryConfiguration {
  return {
    ...value,
    preferredSurveyIntervalDm:
      value.preferredSurveyIntervalDm === undefined
        ? undefined
        : decimetres(value.preferredSurveyIntervalDm),
  };
}

function asTolerance(
  value: z.infer<typeof toleranceSchema>,
): TrajectoryTrackingTolerance {
  return value;
}

export class LocalTrajectoryRepository implements TrajectoryRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly seedByHole: ReadonlyMap<string, TrajectorySeed> = new Map(),
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private read(holeId: string): Envelope {
    const raw = this.storage.getItem(storageKey(holeId));
    if (raw === null) {
      const seed = this.seedByHole.get(holeId);
      if (!seed) return emptyEnvelope(holeId);
      return {
        ...emptyEnvelope(holeId),
        coordinateConfiguration: seed.coordinateConfiguration
          ? {
              ...seed.coordinateConfiguration,
              collarEastingDm: seed.coordinateConfiguration.collarEastingDm,
              collarNorthingDm: seed.coordinateConfiguration.collarNorthingDm,
              collarRlDm: seed.coordinateConfiguration.collarRlDm,
            }
          : null,
        referenceConfiguration: seed.referenceConfiguration ?? null,
        plans: (seed.plans ?? []).map((plan) => ({
          ...plan,
          stations: plan.stations.map((station) => ({
            ...station,
            measuredDepthDm: Number(station.measuredDepthDm),
          })),
        })),
        target: seed.target
          ? {
              ...seed.target,
              targetMeasuredDepthDm:
                seed.target.targetMeasuredDepthDm === undefined
                  ? undefined
                  : Number(seed.target.targetMeasuredDepthDm),
            }
          : null,
        actualConfiguration: seed.actualConfiguration ?? null,
        selections: (seed.selections ?? []).map((selection) => ({
          ...selection,
          depthDm: Number(selection.depthDm),
        })),
        tolerance: seed.tolerance ?? null,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new TrajectoryRepositoryError(
        "CORRUPTED_STORAGE",
        "Trajectory storage could not be parsed.",
      );
    }
    const result = envelopeSchema.safeParse(parsed);
    if (!result.success) {
      throw new TrajectoryRepositoryError(
        "CORRUPTED_STORAGE",
        "Trajectory storage failed validation.",
      );
    }
    return result.data;
  }

  private write(envelope: Envelope): void {
    try {
      this.storage.setItem(
        storageKey(envelope.holeId),
        JSON.stringify(envelope),
      );
    } catch {
      throw new TrajectoryRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Trajectory storage is unavailable.",
      );
    }
  }

  private withMutation<T>(
    holeId: string,
    operationId: string,
    mutate: (envelope: Envelope) => { envelope: Envelope; result: T },
    resolveExisting?: (envelope: Envelope, entityId: string) => T | null,
  ): T {
    this.mutationGuard?.assertHoleMutable(holeId);
    const current = this.read(holeId);
    const existingOp = current.operations.find(
      (operation) => operation.operationId === operationId,
    );
    if (existingOp) {
      const resolved = resolveExisting?.(current, existingOp.entityId);
      if (resolved !== undefined && resolved !== null) return resolved;
      throw new TrajectoryRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        `Operation ${operationId} was already applied.`,
      );
    }
    const { envelope, result } = mutate(current);
    this.write(envelope);
    return result;
  }

  async getCoordinateConfiguration(
    holeId: string,
  ): Promise<HoleCoordinateConfiguration | null> {
    return this.read(holeId).coordinateConfiguration;
  }

  async saveCoordinateConfiguration(
    input: SaveCoordinateConfigurationInput,
  ): Promise<HoleCoordinateConfiguration> {
    return this.withMutation(input.holeId, input.operationId, (envelope) => {
      const existing = envelope.coordinateConfiguration;
      if (
        existing &&
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      ) {
        throw new TrajectoryRepositoryError(
          "STALE_VERSION",
          "Coordinate configuration version is stale.",
        );
      }
      const next: HoleCoordinateConfiguration = {
        localId: existing?.localId ?? input.configurationId ?? `coord-${input.holeId}`,
        serverId: existing?.serverId ?? null,
        syncStatus: "local-only",
        createdAt: existing?.createdAt ?? input.occurredAt,
        updatedAt: input.occurredAt,
        deviceId: DEVICE_ID,
        version: (existing?.version ?? 0) + 1,
        holeId: input.holeId,
        coordinateMode: input.coordinateMode,
        coordinateSystemName: input.coordinateSystemName,
        epsgCode: input.epsgCode,
        collarEastingDm: input.collarEastingDm,
        collarNorthingDm: input.collarNorthingDm,
        collarRlDm: input.collarRlDm,
        calculationNorthReference: input.calculationNorthReference,
        referenceConfigurationId: input.referenceConfigurationId,
        createdByUserId: input.createdByUserId,
        createdByNameSnapshot: input.createdByNameSnapshot,
      };
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: input.occurredAt,
          coordinateConfiguration: next,
          operations: [
            ...envelope.operations,
            {
              operationId: input.operationId,
              kind: "SAVE_COORDINATE",
              entityId: next.localId,
              completedAt: input.occurredAt,
            },
          ],
        },
        result: next,
      };
    });
  }

  async getReferenceConfiguration(
    holeId: string,
  ): Promise<ReferenceConfiguration | null> {
    return this.read(holeId).referenceConfiguration;
  }

  async saveReferenceConfiguration(
    input: SaveReferenceConfigurationInput,
  ): Promise<ReferenceConfiguration> {
    return this.withMutation(input.holeId, input.operationId, (envelope) => {
      const existing = envelope.referenceConfiguration;
      if (
        existing &&
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      ) {
        throw new TrajectoryRepositoryError(
          "STALE_VERSION",
          "Reference configuration version is stale.",
        );
      }
      const next: ReferenceConfiguration = {
        localId:
          existing?.localId ?? input.configurationId ?? `ref-${input.holeId}`,
        serverId: existing?.serverId ?? null,
        syncStatus: "local-only",
        createdAt: existing?.createdAt ?? input.occurredAt,
        updatedAt: input.occurredAt,
        deviceId: DEVICE_ID,
        version: (existing?.version ?? 0) + 1,
        holeId: input.holeId,
        gridRotationDeg: input.gridRotationDeg,
        magneticDeclinationDeg: input.magneticDeclinationDeg,
        createdByUserId: input.createdByUserId,
        createdByNameSnapshot: input.createdByNameSnapshot,
      };
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: input.occurredAt,
          referenceConfiguration: next,
          operations: [
            ...envelope.operations,
            {
              operationId: input.operationId,
              kind: "SAVE_REFERENCE",
              entityId: next.localId,
              completedAt: input.occurredAt,
            },
          ],
        },
        result: next,
      };
    });
  }

  async getActivePlan(holeId: string): Promise<PlannedHoleTrajectory | null> {
    const plans = await this.listPlans(holeId);
    return plans.find((plan) => plan.status === "ACTIVE") ?? null;
  }

  async listPlans(holeId: string): Promise<readonly PlannedHoleTrajectory[]> {
    return this.read(holeId).plans.map(asPlan);
  }

  async saveDraft(
    input: SavePlannedTrajectoryInput,
  ): Promise<PlannedHoleTrajectory> {
    if (input.stations.length < 2) {
      throw new TrajectoryRepositoryError(
        "VALIDATION_FAILED",
        "A planned trajectory requires at least two stations.",
      );
    }
    return this.withMutation(input.holeId, input.operationId, (envelope) => {
      const existing = envelope.plans.find(
        (plan) => plan.localId === input.planId,
      );
      if (
        existing &&
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      ) {
        throw new TrajectoryRepositoryError(
          "STALE_VERSION",
          "Planned trajectory version is stale.",
        );
      }
      if (existing && existing.status === "ACTIVE") {
        throw new TrajectoryRepositoryError(
          "INVALID_STATE",
          "Do not silently rewrite an active plan. Supersede it and save a new draft.",
        );
      }
      const next: z.infer<typeof plannedSchema> = {
        localId:
          existing?.localId ??
          input.planId ??
          `plan-${input.holeId}-${Date.parse(input.occurredAt)}`,
        serverId: existing?.serverId ?? null,
        syncStatus: "local-only",
        createdAt: existing?.createdAt ?? input.occurredAt,
        updatedAt: input.occurredAt,
        deviceId: DEVICE_ID,
        version: (existing?.version ?? 0) + 1,
        holeId: input.holeId,
        name: input.name,
        description: input.description,
        northReference: input.northReference,
        desurveyMethod: "MINIMUM_CURVATURE",
        stations: input.stations.map((station) => ({
          ...station,
          measuredDepthDm: Number(station.measuredDepthDm),
        })),
        targetId: input.targetId,
        status: "DRAFT",
        createdByUserId: input.createdByUserId,
        createdByNameSnapshot: input.createdByNameSnapshot,
      };
      const plans = existing
        ? envelope.plans.map((plan) =>
            plan.localId === next.localId ? next : plan,
          )
        : [...envelope.plans, next];
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: input.occurredAt,
          plans,
          operations: [
            ...envelope.operations,
            {
              operationId: input.operationId,
              kind: "SAVE_DRAFT",
              entityId: next.localId,
              completedAt: input.occurredAt,
            },
          ],
        },
        result: asPlan(next),
      };
    });
  }

  async activate(
    holeId: string,
    planId: string,
    operationId: string,
    occurredAt: string,
  ): Promise<PlannedHoleTrajectory> {
    return this.withMutation(holeId, operationId, (envelope) => {
      const target = envelope.plans.find((plan) => plan.localId === planId);
      if (!target) {
        throw new TrajectoryRepositoryError(
          "NOT_FOUND",
          `Plan ${planId} was not found.`,
        );
      }
      const plans = envelope.plans.map((plan) => {
        if (plan.localId === planId) {
          return {
            ...plan,
            status: "ACTIVE" as const,
            updatedAt: occurredAt,
            version: plan.version + 1,
          };
        }
        if (plan.status === "ACTIVE") {
          return {
            ...plan,
            status: "SUPERSEDED" as const,
            updatedAt: occurredAt,
            version: plan.version + 1,
          };
        }
        return plan;
      });
      const activated = plans.find((plan) => plan.localId === planId)!;
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: occurredAt,
          plans,
          operations: [
            ...envelope.operations,
            {
              operationId,
              kind: "ACTIVATE_PLAN",
              entityId: planId,
              completedAt: occurredAt,
            },
          ],
        },
        result: asPlan(activated),
      };
    });
  }

  async supersede(
    holeId: string,
    planId: string,
    operationId: string,
    occurredAt: string,
  ): Promise<PlannedHoleTrajectory> {
    return this.withMutation(holeId, operationId, (envelope) => {
      const target = envelope.plans.find((plan) => plan.localId === planId);
      if (!target) {
        throw new TrajectoryRepositoryError(
          "NOT_FOUND",
          `Plan ${planId} was not found.`,
        );
      }
      const next = {
        ...target,
        status: "SUPERSEDED" as const,
        updatedAt: occurredAt,
        version: target.version + 1,
      };
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: occurredAt,
          plans: envelope.plans.map((plan) =>
            plan.localId === planId ? next : plan,
          ),
          operations: [
            ...envelope.operations,
            {
              operationId,
              kind: "SUPERSEDE_PLAN",
              entityId: planId,
              completedAt: occurredAt,
            },
          ],
        },
        result: asPlan(next),
      };
    });
  }

  async getTarget(holeId: string): Promise<HoleTarget | null> {
    const target = this.read(holeId).target;
    return target ? asTarget(target) : null;
  }

  async saveTarget(input: SaveHoleTargetInput): Promise<HoleTarget> {
    return this.withMutation(input.holeId, input.operationId, (envelope) => {
      const existing = envelope.target;
      if (
        existing &&
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      ) {
        throw new TrajectoryRepositoryError(
          "STALE_VERSION",
          "Target version is stale.",
        );
      }
      if (
        input.targetMeasuredDepthDm === undefined ||
        input.targetMeasuredDepthDm <= 0
      ) {
        throw new TrajectoryRepositoryError(
          "VALIDATION_FAILED",
          "Target measured depth must be positive.",
        );
      }
      if (input.radiusDm !== undefined && input.radiusDm <= 0) {
        throw new TrajectoryRepositoryError(
          "VALIDATION_FAILED",
          "Target diameter must be positive.",
        );
      }
      const attitudeMode = migrateTargetAttitudeMode({
        attitudeMode: input.attitudeMode,
        desiredDipTenths: input.desiredDipTenths,
        desiredAzimuthTenths: input.desiredAzimuthTenths,
        desiredNorthReference: input.desiredNorthReference,
      });
      const next: z.infer<typeof targetSchema> = {
        id: existing?.id ?? input.targetId ?? `target-${input.holeId}`,
        holeId: input.holeId,
        name: input.name,
        coordinateMode: input.coordinateMode,
        eastingDm: input.eastingDm,
        northingDm: input.northingDm,
        rlDm: input.rlDm,
        radiusDm: input.radiusDm,
        targetMeasuredDepthDm: input.targetMeasuredDepthDm,
        attitudeMode,
        desiredDipTenths: input.desiredDipTenths,
        desiredAzimuthTenths: input.desiredAzimuthTenths,
        desiredNorthReference: input.desiredNorthReference,
        note: input.note,
        version: (existing?.version ?? 0) + 1,
        updatedAt: input.occurredAt,
      };
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: input.occurredAt,
          target: next,
          operations: [
            ...envelope.operations,
            {
              operationId: input.operationId,
              kind: "SAVE_TARGET",
              entityId: next.id,
              completedAt: input.occurredAt,
            },
          ],
        },
        result: asTarget(next),
      };
    });
  }

  async getActualConfiguration(
    holeId: string,
  ): Promise<ActualTrajectoryConfiguration | null> {
    const value = this.read(holeId).actualConfiguration;
    return value ? asActualConfiguration(value) : null;
  }

  async saveActualConfiguration(
    input: SaveActualConfigurationInput,
  ): Promise<ActualTrajectoryConfiguration> {
    return this.withMutation(input.holeId, input.operationId, (envelope) => {
      const existing = envelope.actualConfiguration;
      if (
        existing &&
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      ) {
        throw new TrajectoryRepositoryError(
          "STALE_VERSION",
          "Actual configuration version is stale.",
        );
      }
      const preferredSurveyIntervalDm =
        input.preferredSurveyIntervalDm === null
          ? undefined
          : input.preferredSurveyIntervalDm !== undefined
            ? input.preferredSurveyIntervalDm
            : existing?.preferredSurveyIntervalDm === undefined
              ? undefined
              : Number(existing.preferredSurveyIntervalDm);
      const next: z.infer<typeof actualSchema> = {
        localId:
          existing?.localId ??
          input.configurationId ??
          `actual-${input.holeId}`,
        serverId: existing?.serverId ?? null,
        syncStatus: "local-only",
        createdAt: existing?.createdAt ?? input.occurredAt,
        updatedAt: input.occurredAt,
        deviceId: DEVICE_ID,
        version: (existing?.version ?? 0) + 1,
        holeId: input.holeId,
        collarDipTenths: input.collarDipTenths,
        collarAzimuthTenths: input.collarAzimuthTenths,
        collarNorthReference: input.collarNorthReference,
        desurveyMethod: "MINIMUM_CURVATURE",
        ...(preferredSurveyIntervalDm === undefined
          ? {}
          : { preferredSurveyIntervalDm }),
      };
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: input.occurredAt,
          actualConfiguration: next,
          operations: [
            ...envelope.operations,
            {
              operationId: input.operationId,
              kind: "SAVE_ACTUAL",
              entityId: next.localId,
              completedAt: input.occurredAt,
            },
          ],
        },
        result: asActualConfiguration(next),
      };
    });
  }

  async listSelections(
    holeId: string,
  ): Promise<readonly TrajectorySurveySelection[]> {
    return this.read(holeId).selections.map(asSelection);
  }

  async saveSurveySelection(
    input: SaveSurveySelectionInput,
  ): Promise<TrajectorySurveySelection> {
    return this.withMutation(input.holeId, input.operationId, (envelope) => {
      const existing = envelope.selections.find(
        (selection) => selection.depthDm === input.depthDm,
      );
      const next: z.infer<typeof selectionSchema> = {
        localId:
          existing?.localId ??
          `selection-${input.holeId}-${input.depthDm}`,
        serverId: existing?.serverId ?? null,
        syncStatus: "local-only",
        createdAt: existing?.createdAt ?? input.occurredAt,
        updatedAt: input.occurredAt,
        deviceId: DEVICE_ID,
        version: (existing?.version ?? 0) + 1,
        holeId: input.holeId,
        depthDm: input.depthDm,
        selectedSurveyId: input.selectedSurveyId,
        selectionReason: "USER_SELECTED",
        selectedByUserId: input.selectedByUserId,
        selectedByNameSnapshot: input.selectedByNameSnapshot,
        selectedAt: input.occurredAt,
      };
      const selections = existing
        ? envelope.selections.map((selection) =>
            selection.depthDm === input.depthDm ? next : selection,
          )
        : [...envelope.selections, next];
      return {
        envelope: {
          ...envelope,
          revision: envelope.revision + 1,
          updatedAt: input.occurredAt,
          selections,
          operations: [
            ...envelope.operations,
            {
              operationId: input.operationId,
              kind: "SAVE_SELECTION",
              entityId: next.localId,
              completedAt: input.occurredAt,
            },
          ],
        },
        result: asSelection(next),
      };
    });
  }

  async getTolerance(
    holeId: string,
  ): Promise<TrajectoryTrackingTolerance | null> {
    const tolerance = this.read(holeId).tolerance;
    return tolerance ? asTolerance(tolerance) : null;
  }
}

export function createBrowserTrajectoryRepository(
  seedByHole: ReadonlyMap<string, TrajectorySeed> = new Map(),
  mutationGuard?: HoleMutationGuardPort,
): LocalTrajectoryRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  if (storage === null) return null;
  return new LocalTrajectoryRepository(storage, seedByHole, mutationGuard);
}

export function createMemoryTrajectoryRepository(
  seedByHole: ReadonlyMap<string, TrajectorySeed> = new Map(),
): LocalTrajectoryRepository {
  const memory = new Map<string, string>();
  const storage: LocalStorageAdapter = {
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
    },
    removeItem(key) {
      memory.delete(key);
    },
  };
  return new LocalTrajectoryRepository(storage, seedByHole);
}
