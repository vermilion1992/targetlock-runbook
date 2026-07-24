import type { NorthReference } from "./models";
import type { TargetAttitudeMode } from "./trajectory-types";

/** Modes written by current TargetLock UI / solvers. */
export type CanonicalTargetAttitudeMode =
  | "AUTO_SMOOTH"
  | "MATCH_ENTRY_DIRECTION"
  | "SAME_AS_COLLAR";

export function isAutoSmoothAttitudeMode(
  mode: TargetAttitudeMode | null | undefined,
): boolean {
  return mode === "AUTO_SMOOTH" || mode === "UNCONSTRAINED" || !mode;
}

export function isMatchEntryAttitudeMode(
  mode: TargetAttitudeMode | null | undefined,
): boolean {
  return (
    mode === "MATCH_ENTRY_DIRECTION" ||
    mode === "CUSTOM" ||
    mode === "SAME_AS_COLLAR"
  );
}

/**
 * Idempotent attitude-mode migration for stored HoleTarget records.
 * Never invents target MD. Does not alter radius/diameter semantics.
 */
export function migrateTargetAttitudeMode(input: {
  readonly attitudeMode?: TargetAttitudeMode | null;
  readonly desiredDipTenths?: number;
  readonly desiredAzimuthTenths?: number;
  readonly desiredNorthReference?: NorthReference;
}): CanonicalTargetAttitudeMode {
  const mode = input.attitudeMode;
  if (mode === "AUTO_SMOOTH" || mode === "UNCONSTRAINED") {
    return "AUTO_SMOOTH";
  }
  if (mode === "MATCH_ENTRY_DIRECTION" || mode === "CUSTOM") {
    return "MATCH_ENTRY_DIRECTION";
  }
  if (mode === "SAME_AS_COLLAR") {
    return "SAME_AS_COLLAR";
  }
  if (
    input.desiredDipTenths !== undefined ||
    input.desiredAzimuthTenths !== undefined
  ) {
    return "MATCH_ENTRY_DIRECTION";
  }
  return "AUTO_SMOOTH";
}

export function validateHoleTargetAttitude(input: {
  readonly attitudeMode: TargetAttitudeMode;
  readonly desiredDipTenths?: number;
  readonly desiredAzimuthTenths?: number;
  readonly desiredNorthReference?: NorthReference;
}): string | null {
  if (!isMatchEntryAttitudeMode(input.attitudeMode)) return null;
  if (input.attitudeMode === "SAME_AS_COLLAR") return null;
  if (input.desiredDipTenths === undefined) {
    return "Target entry direction requires target dip.";
  }
  if (input.desiredAzimuthTenths === undefined) {
    return "Target entry direction requires target azimuth.";
  }
  if (
    input.desiredNorthReference === undefined ||
    input.desiredNorthReference === "NOT_SPECIFIED"
  ) {
    return "Target entry direction requires a target north reference.";
  }
  if (input.desiredDipTenths < -900 || input.desiredDipTenths > 900) {
    return "Target entry dip is outside the accepted range.";
  }
  if (
    input.desiredAzimuthTenths < 0 ||
    input.desiredAzimuthTenths > 3599
  ) {
    return "Target entry azimuth must normalise to 0–360°.";
  }
  return null;
}
