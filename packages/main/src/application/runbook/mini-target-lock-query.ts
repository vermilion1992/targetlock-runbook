import {
  calculateMiniTargetLock,
  type MiniTargetLockResult,
} from "@/domain";
import type { SurveyRepository } from "@/infrastructure/surveys";
import type { TrajectoryRepository } from "@/infrastructure/trajectory";

export interface MiniTargetLockQueryServices {
  readonly trajectory: TrajectoryRepository;
  readonly surveys: SurveyRepository;
}

export async function getMiniTargetLock(
  holeId: string,
  services: MiniTargetLockQueryServices,
): Promise<MiniTargetLockResult> {
  const [
    coordinateConfiguration,
    referenceConfiguration,
    actualConfiguration,
    selections,
    target,
    surveys,
  ] = await Promise.all([
    services.trajectory.getCoordinateConfiguration(holeId),
    services.trajectory.getReferenceConfiguration(holeId),
    services.trajectory.getActualConfiguration(holeId),
    services.trajectory.listSelections(holeId),
    services.trajectory.getTarget(holeId),
    services.surveys.listByHole(holeId),
  ]);

  return calculateMiniTargetLock({
    holeId,
    surveys,
    coordinateConfiguration,
    actualConfiguration,
    selections,
    referenceConfiguration,
    target,
  });
}

export function createMiniTargetLockQueryServices(
  services: MiniTargetLockQueryServices,
): MiniTargetLockQueryServices & {
  getMiniTargetLock(holeId: string): Promise<MiniTargetLockResult>;
} {
  return {
    ...services,
    getMiniTargetLock: (holeId) => getMiniTargetLock(holeId, services),
  };
}
