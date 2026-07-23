import {
  calculateHoleTrajectoryComparison,
  type HoleTrajectoryComparison,
} from "@/domain";
import type { SurveyRepository } from "@/infrastructure/surveys";
import type { TrajectoryRepository } from "@/infrastructure/trajectory";
import {
  getCurrentHoleState,
  type CurrentHoleStateDependencies,
} from "./current-hole-state";

export interface TrajectoryComparisonQueryServices {
  readonly trajectory: TrajectoryRepository;
  readonly surveys: SurveyRepository;
  readonly currentState: CurrentHoleStateDependencies;
}

export async function getHoleTrajectoryComparison(
  holeId: string,
  services: TrajectoryComparisonQueryServices,
): Promise<HoleTrajectoryComparison> {
  const [
    coordinateConfiguration,
    referenceConfiguration,
    planned,
    actualConfiguration,
    selections,
    target,
    tolerance,
    surveys,
  ] = await Promise.all([
    services.trajectory.getCoordinateConfiguration(holeId),
    services.trajectory.getReferenceConfiguration(holeId),
    services.trajectory.getActivePlan(holeId),
    services.trajectory.getActualConfiguration(holeId),
    services.trajectory.listSelections(holeId),
    services.trajectory.getTarget(holeId),
    services.trajectory.getTolerance(holeId),
    services.surveys.listByHole(holeId),
  ]);

  let holeCurrentDepthDm: number | undefined;
  try {
    const state = await getCurrentHoleState(holeId, services.currentState);
    holeCurrentDepthDm = Number(state.currentDepthDm);
  } catch {
    holeCurrentDepthDm = undefined;
  }

  return calculateHoleTrajectoryComparison({
    holeId,
    surveys,
    coordinateConfiguration,
    planned,
    actualConfiguration,
    selections,
    referenceConfiguration,
    target,
    tolerance,
    holeCurrentDepthDm,
  });
}

export function createTrajectoryComparisonQueryServices(
  services: TrajectoryComparisonQueryServices,
): TrajectoryComparisonQueryServices & {
  getComparison(holeId: string): Promise<HoleTrajectoryComparison>;
} {
  return {
    ...services,
    getComparison: (holeId) => getHoleTrajectoryComparison(holeId, services),
  };
}
