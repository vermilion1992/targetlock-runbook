import type { NorthReference } from "./models";
import type { TargetAttitudeMode } from "./trajectory-types";

/**
 * Idempotent attitude-mode inference for stored HoleTarget records.
 * Never invents target MD. Does not alter radius/diameter semantics.
 */
export function migrateTargetAttitudeMode(input: {
  readonly attitudeMode?: TargetAttitudeMode | null;
  readonly desiredDipTenths?: number;
  readonly desiredAzimuthTenths?: number;
  readonly desiredNorthReference?: NorthReference;
}): TargetAttitudeMode {
  if (
    input.attitudeMode === "UNCONSTRAINED" ||
    input.attitudeMode === "SAME_AS_COLLAR" ||
    input.attitudeMode === "CUSTOM"
  ) {
    return input.attitudeMode;
  }
  if (
    input.desiredDipTenths !== undefined ||
    input.desiredAzimuthTenths !== undefined
  ) {
    return "CUSTOM";
  }
  return "UNCONSTRAINED";
}

export function validateHoleTargetAttitude(input: {
  readonly attitudeMode: TargetAttitudeMode;
  readonly desiredDipTenths?: number;
  readonly desiredAzimuthTenths?: number;
  readonly desiredNorthReference?: NorthReference;
}): string | null {
  if (input.attitudeMode !== "CUSTOM") return null;
  if (input.desiredDipTenths === undefined) {
    return "Custom target attitude requires target dip.";
  }
  if (input.desiredAzimuthTenths === undefined) {
    return "Custom target attitude requires target azimuth.";
  }
  if (
    input.desiredNorthReference === undefined ||
    input.desiredNorthReference === "NOT_SPECIFIED"
  ) {
    return "Custom target attitude requires a target north reference.";
  }
  if (
    input.desiredDipTenths < -900 ||
    input.desiredDipTenths > 900
  ) {
    return "Custom target dip is outside the accepted range.";
  }
  if (
    input.desiredAzimuthTenths < 0 ||
    input.desiredAzimuthTenths > 3599
  ) {
    return "Custom target azimuth must normalise to 0–360°.";
  }
  return null;
}
