import type { HoleStatus } from "@/domain";

export type DrillingReadinessBlockerCode =
  | "HOLE_STATUS_NOT_OPERATIONAL"
  | "FULL_BHA_LENGTH_REQUIRED"
  | "CONSTANT_STICK_UP_REQUIRED"
  | "FULL_BHA_LENGTH_INVALID"
  | "CONSTANT_STICK_UP_INVALID"
  | "CONSTANT_STICK_UP_EXCEEDS_BHA";

export interface DrillingReadinessBlocker {
  readonly code: DrillingReadinessBlockerCode;
  readonly message: string;
}

export interface DrillingReadinessInput {
  readonly holeStatus?: HoleStatus | null;
  readonly bhaSetup?: {
    readonly bottomHoleAssemblyLengthDm?: number;
    readonly constantStickUpDm?: number;
  } | null;
}

export interface DrillingReadiness {
  readonly ready: boolean;
  readonly source: "configured" | "legacy-active" | "blocked";
  readonly blockers: readonly DrillingReadinessBlocker[];
}

/**
 * Readiness is derived from the append-only BHA history and hole lifecycle.
 * ACTIVE holes are grandfathered so existing field data remains operable;
 * newly-created DRAFT holes must record both measurements before drilling.
 */
export function deriveDrillingReadiness(
  input: DrillingReadinessInput,
): DrillingReadiness {
  if (
    input.holeStatus !== null &&
    input.holeStatus !== undefined &&
    input.holeStatus !== "DRAFT" &&
    input.holeStatus !== "ACTIVE"
  ) {
    const status = input.holeStatus
      .toLocaleLowerCase("en-AU")
      .replaceAll("_", " ");
    return {
      ready: false,
      source: "blocked",
      blockers: [
        {
          code: "HOLE_STATUS_NOT_OPERATIONAL",
          message: `Hole status ${status} does not allow drilling operations.`,
        },
      ],
    };
  }

  const setup = input.bhaSetup;
  if (setup === null || setup === undefined) {
    if (input.holeStatus === "ACTIVE") {
      return { ready: true, source: "legacy-active", blockers: [] };
    }
    return {
      ready: false,
      source: "blocked",
      blockers: [
        {
          code: "FULL_BHA_LENGTH_REQUIRED",
          message: "Full BHA length has not been recorded.",
        },
        {
          code: "CONSTANT_STICK_UP_REQUIRED",
          message: "Constant stick-up has not been recorded.",
        },
      ],
    };
  }

  const blockers: DrillingReadinessBlocker[] = [];
  const bha = setup.bottomHoleAssemblyLengthDm;
  const stickUp = setup.constantStickUpDm;

  if (bha === undefined) {
    blockers.push({
      code: "FULL_BHA_LENGTH_REQUIRED",
      message: "Full BHA length has not been recorded.",
    });
  } else if (!Number.isFinite(bha) || bha <= 0) {
    blockers.push({
      code: "FULL_BHA_LENGTH_INVALID",
      message: "Full BHA length must be greater than 0 m.",
    });
  }

  if (stickUp === undefined) {
    blockers.push({
      code: "CONSTANT_STICK_UP_REQUIRED",
      message: "Constant stick-up has not been recorded.",
    });
  } else if (!Number.isFinite(stickUp) || stickUp < 0) {
    blockers.push({
      code: "CONSTANT_STICK_UP_INVALID",
      message: "Constant stick-up must be 0 m or greater.",
    });
  }

  if (
    bha !== undefined &&
    stickUp !== undefined &&
    Number.isFinite(bha) &&
    Number.isFinite(stickUp) &&
    stickUp > bha
  ) {
    blockers.push({
      code: "CONSTANT_STICK_UP_EXCEEDS_BHA",
      message: "Constant stick-up cannot exceed full BHA length.",
    });
  }

  return blockers.length === 0
    ? { ready: true, source: "configured", blockers: [] }
    : { ready: false, source: "blocked", blockers };
}

export function drillingReadinessError(
  readiness: DrillingReadiness,
  action: "start a shift" | "record a run",
): Error {
  return new Error(
    `${readiness.blockers.map(({ message }) => message).join(" ")} Update BHA before attempting to ${action}.`,
  );
}
