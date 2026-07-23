import type { NorthReference } from "./models";
import { normalizeAzimuthDegrees } from "./trajectory-geometry";
import type { ReferenceConfiguration } from "./trajectory-types";

export interface AzimuthConversionConfig {
  readonly gridRotationDeg: number;
  readonly magneticDeclinationDeg: number;
}

export function toAzimuthConversionConfig(
  reference?: ReferenceConfiguration | null,
): AzimuthConversionConfig {
  return {
    gridRotationDeg: reference?.gridRotationDeg ?? 0,
    magneticDeclinationDeg: reference?.magneticDeclinationDeg ?? 0,
  };
}

/** Convert an azimuth from the given reference into true north (IQ signs). */
export function toTrueAzimuthDegrees(
  azimuthDegrees: number,
  fromReference: NorthReference,
  config: AzimuthConversionConfig,
): number {
  if (fromReference === "TRUE" || fromReference === "NOT_SPECIFIED") {
    return normalizeAzimuthDegrees(azimuthDegrees);
  }
  if (fromReference === "GRID") {
    return normalizeAzimuthDegrees(
      azimuthDegrees + config.gridRotationDeg,
    );
  }
  return normalizeAzimuthDegrees(
    azimuthDegrees + config.magneticDeclinationDeg,
  );
}

/** Convert a true-north azimuth into the given calculation reference. */
export function fromTrueAzimuthDegrees(
  trueAzimuthDegrees: number,
  toReference: NorthReference,
  config: AzimuthConversionConfig,
): number {
  if (toReference === "TRUE" || toReference === "NOT_SPECIFIED") {
    return normalizeAzimuthDegrees(trueAzimuthDegrees);
  }
  if (toReference === "GRID") {
    return normalizeAzimuthDegrees(
      trueAzimuthDegrees - config.gridRotationDeg,
    );
  }
  return normalizeAzimuthDegrees(
    trueAzimuthDegrees - config.magneticDeclinationDeg,
  );
}

export function convertAzimuthDegrees(
  azimuthDegrees: number,
  fromReference: NorthReference,
  toReference: NorthReference,
  config: AzimuthConversionConfig,
): number {
  if (fromReference === toReference) {
    return normalizeAzimuthDegrees(azimuthDegrees);
  }
  const trueAz = toTrueAzimuthDegrees(azimuthDegrees, fromReference, config);
  return fromTrueAzimuthDegrees(trueAz, toReference, config);
}

export function convertAzimuthTenths(
  azimuthTenths: number,
  fromReference: NorthReference,
  toReference: NorthReference,
  config: AzimuthConversionConfig,
): number {
  const degrees = convertAzimuthDegrees(
    azimuthTenths / 10,
    fromReference,
    toReference,
    config,
  );
  return Math.round(degrees * 10) % 3600;
}

export function canConvertToCalculationReference(
  originalReference: NorthReference,
  calculationReference: NorthReference,
  coordinateMode: "RELATIVE" | "MINE_GRID",
  config: AzimuthConversionConfig | null,
): { ok: true } | { ok: false; reason: string } {
  if (originalReference === calculationReference) {
    return { ok: true };
  }

  if (coordinateMode === "RELATIVE") {
    if (
      originalReference === "NOT_SPECIFIED" &&
      calculationReference === "NOT_SPECIFIED"
    ) {
      return { ok: true };
    }
    if (
      originalReference === "NOT_SPECIFIED" ||
      calculationReference === "NOT_SPECIFIED"
    ) {
      // Relative shape comparison with mixed unspecified is allowed with warning upstream.
      return { ok: true };
    }
  }

  if (coordinateMode === "MINE_GRID") {
    if (calculationReference !== "GRID") {
      return {
        ok: false,
        reason:
          "Mine-grid trajectory comparison requires calculation north reference Grid North.",
      };
    }
    if (config === null) {
      return {
        ok: false,
        reason:
          "Mine-grid mode requires a reference configuration to convert azimuths to Grid North.",
      };
    }
    if (originalReference === "NOT_SPECIFIED") {
      return {
        ok: false,
        reason:
          "Mine-grid mode cannot convert unspecified north references to Grid North.",
      };
    }
  }

  if (config === null && originalReference !== calculationReference) {
    return {
      ok: false,
      reason:
        "North-reference conversion configuration is missing for mixed azimuth references.",
    };
  }

  return { ok: true };
}

export function requiresReferenceConversion(
  references: readonly NorthReference[],
): boolean {
  const distinct = new Set(references.filter((ref) => ref !== "NOT_SPECIFIED"));
  return distinct.size > 1;
}
