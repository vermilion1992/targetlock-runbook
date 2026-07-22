import {
  ddh041CasingEvents,
  ddh041CasingStrings,
  rig10ComponentAssignments,
  rig10Components,
} from "./target-lock-stage1";
import { targetLockStage2Seed } from "./target-lock-stage2";

/**
 * Stage 3 keeps Stage 2 run/shift continuity while replacing casing and
 * component preview strings with records consumed by versioned repositories.
 */
export const targetLockStage3Seed = {
  ...targetLockStage2Seed,
  casingStrings: ddh041CasingStrings,
  casingEvents: ddh041CasingEvents,
  components: rig10Components,
  componentAssignments: rig10ComponentAssignments,
};

export type TargetLockStage3Seed = typeof targetLockStage3Seed;
