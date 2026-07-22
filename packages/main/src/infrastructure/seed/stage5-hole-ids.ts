import { stage5CompletionSeed } from "./target-lock-stage5";

/** Hole names (route IDs) known to the Stage 5 completion seed. */
export const STAGE5_HOLE_IDS = stage5CompletionSeed.holes.map(
  ({ name }) => name,
);

export function isStage5HoleId(holeId: string): boolean {
  return STAGE5_HOLE_IDS.includes(holeId);
}
