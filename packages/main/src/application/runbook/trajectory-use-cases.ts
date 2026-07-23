import type {
  ActualTrajectoryConfiguration,
  HoleCoordinateConfiguration,
  HoleTarget,
  PlannedHoleTrajectory,
  PlannedTrajectoryStation,
  ReferenceConfiguration,
  TrajectorySurveySelection,
} from "@/domain";
import { buildStraightPlanStations, decimetres } from "@/domain";
import type {
  SaveActualConfigurationInput,
  SaveCoordinateConfigurationInput,
  SaveHoleTargetInput,
  SavePlannedTrajectoryInput,
  SaveReferenceConfigurationInput,
  SaveSurveySelectionInput,
  TrajectoryRepository,
} from "@/infrastructure/trajectory";

export interface TrajectoryServices {
  readonly trajectory: TrajectoryRepository;
}

export async function getTrajectorySetup(holeId: string, services: TrajectoryServices) {
  const [
    coordinateConfiguration,
    referenceConfiguration,
    activePlan,
    plans,
    target,
    actualConfiguration,
    selections,
  ] = await Promise.all([
    services.trajectory.getCoordinateConfiguration(holeId),
    services.trajectory.getReferenceConfiguration(holeId),
    services.trajectory.getActivePlan(holeId),
    services.trajectory.listPlans(holeId),
    services.trajectory.getTarget(holeId),
    services.trajectory.getActualConfiguration(holeId),
    services.trajectory.listSelections(holeId),
  ]);
  return {
    coordinateConfiguration,
    referenceConfiguration,
    activePlan,
    plans,
    target,
    actualConfiguration,
    selections,
  };
}

export async function saveCoordinateConfiguration(
  input: SaveCoordinateConfigurationInput,
  services: TrajectoryServices,
): Promise<HoleCoordinateConfiguration> {
  return services.trajectory.saveCoordinateConfiguration(input);
}

export async function saveReferenceConfiguration(
  input: SaveReferenceConfigurationInput,
  services: TrajectoryServices,
): Promise<ReferenceConfiguration> {
  return services.trajectory.saveReferenceConfiguration(input);
}

export async function savePlannedTrajectoryDraft(
  input: SavePlannedTrajectoryInput,
  services: TrajectoryServices,
): Promise<PlannedHoleTrajectory> {
  return services.trajectory.saveDraft(input);
}

export async function saveStraightPlanDraft(
  input: {
    readonly operationId: string;
    readonly holeId: string;
    readonly planId?: string;
    readonly expectedVersion?: number;
    readonly name: string;
    readonly description?: string;
    readonly northReference: SavePlannedTrajectoryInput["northReference"];
    readonly collarDipTenths: number;
    readonly collarAzimuthTenths: number;
    readonly endpointMeasuredDepthDm: number;
    readonly createdByUserId: string;
    readonly createdByNameSnapshot: string;
    readonly occurredAt: string;
  },
  services: TrajectoryServices,
): Promise<PlannedHoleTrajectory> {
  const stations = buildStraightPlanStations({
    collarDipTenths: input.collarDipTenths,
    collarAzimuthTenths: input.collarAzimuthTenths,
    northReference: input.northReference,
    endpointMeasuredDepthDm: decimetres(input.endpointMeasuredDepthDm),
    collarStationId: `${input.planId ?? "plan"}-collar`,
    endpointStationId: `${input.planId ?? "plan"}-endpoint`,
  }) as PlannedTrajectoryStation[];

  return services.trajectory.saveDraft({
    operationId: input.operationId,
    holeId: input.holeId,
    planId: input.planId,
    expectedVersion: input.expectedVersion,
    name: input.name,
    description:
      input.description ?? "Straight directional plan",
    northReference: input.northReference,
    stations,
    createdByUserId: input.createdByUserId,
    createdByNameSnapshot: input.createdByNameSnapshot,
    occurredAt: input.occurredAt,
  });
}

export async function activatePlannedTrajectory(
  input: {
    readonly holeId: string;
    readonly planId: string;
    readonly operationId: string;
    readonly occurredAt: string;
  },
  services: TrajectoryServices,
): Promise<PlannedHoleTrajectory> {
  return services.trajectory.activate(
    input.holeId,
    input.planId,
    input.operationId,
    input.occurredAt,
  );
}

export async function supersedePlannedTrajectory(
  input: {
    readonly holeId: string;
    readonly planId: string;
    readonly operationId: string;
    readonly occurredAt: string;
  },
  services: TrajectoryServices,
): Promise<PlannedHoleTrajectory> {
  return services.trajectory.supersede(
    input.holeId,
    input.planId,
    input.operationId,
    input.occurredAt,
  );
}

export async function saveHoleTarget(
  input: SaveHoleTargetInput,
  services: TrajectoryServices,
): Promise<HoleTarget> {
  return services.trajectory.saveTarget(input);
}

export async function saveActualTrajectoryConfiguration(
  input: SaveActualConfigurationInput,
  services: TrajectoryServices,
): Promise<ActualTrajectoryConfiguration> {
  return services.trajectory.saveActualConfiguration(input);
}

export async function saveTrajectorySurveySelection(
  input: SaveSurveySelectionInput,
  services: TrajectoryServices,
): Promise<TrajectorySurveySelection> {
  return services.trajectory.saveSurveySelection(input);
}
