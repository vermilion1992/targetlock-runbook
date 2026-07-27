import {
  stage5CompletionSeed,
  targetLockStage5Seed,
} from "./target-lock-stage5";

/** Hole names (route IDs) known to the Stage 5 completion seed. */
export const STAGE5_HOLE_IDS = stage5CompletionSeed.holes.map(
  ({ name }) => name,
);

export function isStage5HoleId(holeId: string): boolean {
  return STAGE5_HOLE_IDS.includes(holeId);
}

const RESERVED_HOLE_ROUTE_SEGMENTS = new Set(["new", "completed"]);

/** SSR-safe route gate: seed holes or valid user-created hole ID pattern. */
export function isRoutableHoleId(holeId: string): boolean {
  const value = holeId.trim();
  if (!value) return false;
  if (isStage5HoleId(value)) return true;
  if (RESERVED_HOLE_ROUTE_SEGMENTS.has(value.toLocaleLowerCase("en-AU"))) {
    return false;
  }
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
}

export function isSeedRunCompatibleWithHole(
  holeId: string,
  runId: string,
): boolean {
  const seedRun = targetLockStage5Seed.runs.find(
    (run) => run.localId === runId,
  );
  return seedRun === undefined || seedRun.holeId === holeId;
}
