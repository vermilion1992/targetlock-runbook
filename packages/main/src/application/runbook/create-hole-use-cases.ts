import type {
  AuditEntry,
  HoleSize,
  NorthReference,
  TargetAttitudeMode,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type {
  CanonicalHole,
  CompletionRepository,
  CreateHoleInput,
} from "@/infrastructure/completion";
import type { ProjectDirectoryRepository } from "@/infrastructure/projects";
import type { TrajectoryRepository } from "@/infrastructure/trajectory";
import {
  DEFAULT_TARGET_DIAMETER_M,
  decimetres,
  diameterMToRadiusDm,
  metresToDecimetres,
  validateHoleTargetAttitude,
} from "@/domain";
import { targetLockStage5Seed } from "@/infrastructure/seed";

const DEFAULT_ACTOR = {
  userId: "user-driller-hoffman",
  nameSnapshot: "M. Hoffman",
} as const;

export interface CreateHoleTargetInput {
  readonly targetMeasuredDepthM: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly diameterM?: number;
  readonly attitudeMode?: TargetAttitudeMode;
  readonly desiredDipDegrees?: number;
  readonly desiredAzimuthDegrees?: number;
  readonly desiredNorthReference?: NorthReference;
}

export interface CreateHoleWithTrajectoryInput {
  readonly operationId: string;
  readonly holeId: string;
  readonly name?: string;
  readonly holeSize?: HoleSize;
  readonly plannedDepthM?: number;
  readonly collarDipTenths: number;
  readonly collarAzimuthTenths: number;
  readonly collarNorthReference: NorthReference;
  readonly collarEastingM?: number;
  readonly collarNorthingM?: number;
  readonly collarRlM?: number;
  readonly planReference?: string;
  readonly planRevision?: string;
  readonly preferredSurveyIntervalM?: number;
  readonly preferredSurveyNorthReference?: NorthReference;
  readonly calculationNorthReference?: NorthReference;
  readonly gridRotationDeg?: number;
  readonly magneticDeclinationDeg?: number;
  readonly coordinateSystemName?: string;
  readonly target?: CreateHoleTargetInput;
  readonly occurredAt: string;
  readonly projectId?: string;
  readonly rigId?: string;
  readonly createdByUserId?: string;
  readonly createdByNameSnapshot?: string;
}

export interface CreateHoleServices {
  readonly completion: CompletionRepository;
  readonly trajectory: TrajectoryRepository;
  readonly projects?: ProjectDirectoryRepository;
  readonly audits?: Pick<AuditRepository, "append">;
}

export interface CreateHoleWithTrajectoryResult {
  readonly hole: CanonicalHole;
  readonly hasCollarCoordinates: boolean;
  readonly hasTarget: boolean;
}

function toOptionalCollarDm(metres: number | undefined): number | undefined {
  if (metres === undefined || !Number.isFinite(metres)) return undefined;
  const sign = metres < 0 ? -1 : 1;
  return sign * Number(metresToDecimetres(Math.abs(metres)));
}

function validateCoordinateTrio(
  eastingM?: number,
  northingM?: number,
  rlM?: number,
): "ok" | "partial" | "none" {
  const present = [eastingM, northingM, rlM].map(
    (value) => value !== undefined && Number.isFinite(value),
  );
  const count = present.filter(Boolean).length;
  if (count === 0) return "none";
  if (count === 3) return "ok";
  return "partial";
}

export async function createHoleWithTrajectoryDefaults(
  input: CreateHoleWithTrajectoryInput,
  services: CreateHoleServices,
): Promise<CreateHoleWithTrajectoryResult> {
  const holeId = input.holeId.trim();
  if (!holeId) {
    throw new Error("Hole ID is required.");
  }
  const plannedDepthM =
    input.plannedDepthM ?? targetLockStage5Seed.hole.plannedDepth / 10;
  if (!Number.isFinite(plannedDepthM) || plannedDepthM <= 0) {
    throw new Error("Planned depth must be greater than zero.");
  }
  if (input.collarNorthReference === "NOT_SPECIFIED") {
    throw new Error("Choose the north reference used by the collar azimuth.");
  }

  const name = (input.name ?? holeId).trim();
  const projectId =
    input.projectId ?? targetLockStage5Seed.project.localId;
  const rigId = input.rigId ?? targetLockStage5Seed.rig.localId;
  if (services.projects) {
    const [project, rig] = await Promise.all([
      services.projects.getProject(projectId),
      services.projects.getRig(rigId),
    ]);
    if (!project) {
      throw new Error("The selected project is not available.");
    }
    if (!rig || rig.projectId !== project.localId) {
      throw new Error("The selected rig does not belong to this project.");
    }
  }
  const actorUserId = input.createdByUserId ?? DEFAULT_ACTOR.userId;
  const actorName = input.createdByNameSnapshot ?? DEFAULT_ACTOR.nameSnapshot;

  const collarCoordState = validateCoordinateTrio(
    input.collarEastingM,
    input.collarNorthingM,
    input.collarRlM,
  );
  if (collarCoordState === "partial") {
    throw new Error(
      "Enter Easting, Northing and RL together, or leave all three blank.",
    );
  }

  if (input.target) {
    const targetCoordState = validateCoordinateTrio(
      input.target.eastingM,
      input.target.northingM,
      input.target.rlM,
    );
    if (targetCoordState !== "ok" || !(input.target.targetMeasuredDepthM > 0)) {
      throw new Error(
        "A target requires measured depth plus Easting, Northing and RL together.",
      );
    }
    const attitudeMode = input.target.attitudeMode ?? "AUTO_SMOOTH";
    const attitudeError = validateHoleTargetAttitude({
      attitudeMode,
      desiredDipTenths:
        input.target.desiredDipDegrees === undefined
          ? undefined
          : Math.round(input.target.desiredDipDegrees * 10),
      desiredAzimuthTenths:
        input.target.desiredAzimuthDegrees === undefined
          ? undefined
          : Math.round(input.target.desiredAzimuthDegrees * 10),
      desiredNorthReference: input.target.desiredNorthReference,
    });
    if (attitudeError) throw new Error(attitudeError);
  }

  const collarEastingDm = toOptionalCollarDm(input.collarEastingM);
  const collarNorthingDm = toOptionalCollarDm(input.collarNorthingM);
  const collarRlDm = toOptionalCollarDm(input.collarRlM);
  const hasCollarCoordinates =
    collarEastingDm !== undefined &&
    collarNorthingDm !== undefined &&
    collarRlDm !== undefined;

  const createInput: CreateHoleInput = {
    operationId: input.operationId,
    holeId,
    name,
    projectId,
    rigId,
    holeSize: input.holeSize ?? targetLockStage5Seed.hole.holeSize,
    plannedDepthDm: Number(metresToDecimetres(plannedDepthM)),
    createdAt: input.occurredAt,
    collarEasting: input.collarEastingM,
    collarNorthing: input.collarNorthingM,
    collarElevation: input.collarRlM,
    planReference: input.planReference?.trim() || undefined,
    planRevision: input.planRevision?.trim() || undefined,
  };

  let hole: CanonicalHole;
  try {
    hole = await services.completion.createHole(createInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|duplicate/i.test(message)) {
      throw new Error(`Hole ID ${holeId} already exists.`);
    }
    throw error;
  }

  try {
    const preferredSurveyIntervalDm =
      input.preferredSurveyIntervalM !== undefined &&
      input.preferredSurveyIntervalM > 0
        ? Number(metresToDecimetres(input.preferredSurveyIntervalM))
        : 300;

    await services.trajectory.saveActualConfiguration({
      operationId: `${input.operationId}:actual`,
      holeId,
      collarDipTenths: input.collarDipTenths,
      collarAzimuthTenths: input.collarAzimuthTenths,
      collarNorthReference: input.collarNorthReference,
      preferredSurveyNorthReference:
        input.preferredSurveyNorthReference ?? input.collarNorthReference,
      preferredSurveyIntervalDm,
      occurredAt: input.occurredAt,
    });

    const reference = await services.trajectory.saveReferenceConfiguration({
      operationId: `${input.operationId}:reference`,
      holeId,
      gridRotationDeg: input.gridRotationDeg ?? 0,
      magneticDeclinationDeg: input.magneticDeclinationDeg ?? 0,
      createdByUserId: actorUserId,
      createdByNameSnapshot: actorName,
      occurredAt: input.occurredAt,
    });

    await services.trajectory.saveCoordinateConfiguration({
      operationId: `${input.operationId}:coordinates`,
      holeId,
      coordinateMode: "MINE_GRID",
      coordinateSystemName:
        input.coordinateSystemName?.trim() || "Local Mine Grid",
      collarEastingDm,
      collarNorthingDm,
      collarRlDm,
      calculationNorthReference: input.calculationNorthReference ?? "GRID",
      referenceConfigurationId: reference.localId,
      createdByUserId: actorUserId,
      createdByNameSnapshot: actorName,
      occurredAt: input.occurredAt,
    });

    let hasTarget = false;
    if (input.target) {
      const diameterM = input.target.diameterM ?? DEFAULT_TARGET_DIAMETER_M;
      const attitudeMode = input.target.attitudeMode ?? "AUTO_SMOOTH";
      const matchEntry =
        attitudeMode === "MATCH_ENTRY_DIRECTION" ||
        attitudeMode === "CUSTOM";
      const rlSign = input.target.rlM < 0 ? -1 : 1;
      await services.trajectory.saveTarget({
        operationId: `${input.operationId}:target`,
        holeId,
        name: "Target",
        coordinateMode: "MINE_GRID",
        eastingDm: Number(metresToDecimetres(input.target.eastingM)),
        northingDm: Number(metresToDecimetres(input.target.northingM)),
        rlDm: rlSign * Number(metresToDecimetres(Math.abs(input.target.rlM))),
        radiusDm: diameterMToRadiusDm(diameterM),
        targetMeasuredDepthDm: Number(
          metresToDecimetres(input.target.targetMeasuredDepthM),
        ),
        attitudeMode,
        desiredDipTenths:
          matchEntry && input.target.desiredDipDegrees !== undefined
            ? Math.round(input.target.desiredDipDegrees * 10)
            : undefined,
        desiredAzimuthTenths:
          matchEntry && input.target.desiredAzimuthDegrees !== undefined
            ? Math.round(input.target.desiredAzimuthDegrees * 10)
            : undefined,
        desiredNorthReference: matchEntry
          ? input.target.desiredNorthReference
          : undefined,
        occurredAt: input.occurredAt,
      });
      hasTarget = true;
    }

    if (services.audits) {
      await services.audits.append({
        localId: `${input.operationId}:hole-setup`,
        serverId: null,
        syncStatus: "local-only",
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        deviceId: "local-runbook-device",
        version: 1,
        holeId,
        entityType: "hole",
        entityId: holeId,
        action: "hole_setup_created",
        userId: actorUserId,
        userNameSnapshot: actorName,
        timestamp: input.occurredAt,
        depthDm: decimetres(0),
        metadata: {
          collarDipTenths: input.collarDipTenths,
          collarAzimuthTenths: input.collarAzimuthTenths,
          collarNorthReference: input.collarNorthReference,
          collarCoordinatesRecorded: hasCollarCoordinates,
          targetRecorded: hasTarget,
          ...(input.planReference?.trim()
            ? { planReference: input.planReference.trim() }
            : {}),
          ...(input.planRevision?.trim()
            ? { planRevision: input.planRevision.trim() }
            : {}),
        },
      } satisfies AuditEntry);
    }

    return { hole, hasCollarCoordinates, hasTarget };
  } catch (error) {
    // Compensating note: trajectory writes are idempotent by operationId suffix.
    // Hole creation may already have succeeded; surface the failure clearly.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Hole ${holeId} was created but trajectory defaults failed: ${message}. Retry with the same operationId to recover safely.`,
    );
  }
}
