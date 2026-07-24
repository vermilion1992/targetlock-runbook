export function formatMetresValue(valueM: number, digits = 1): string {
  if (!Number.isFinite(valueM)) return "—";
  return `${valueM.toFixed(digits)} m`;
}

export function formatDegrees(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}°`;
}

export function formatSignedMetres(valueM: number, digits = 1): string {
  if (!Number.isFinite(valueM)) return "—";
  const sign = valueM > 0 ? "+" : valueM < 0 ? "−" : "";
  return `${sign}${Math.abs(valueM).toFixed(digits)} m`;
}

export function formatCoordinate(valueM: number, digits = 1): string {
  if (!Number.isFinite(valueM)) return "—";
  return valueM.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatEastOfPlan(deltaEastingM: number): string {
  if (Math.abs(deltaEastingM) < 0.05) return "on easting";
  return `${Math.abs(deltaEastingM).toFixed(1)} m ${deltaEastingM > 0 ? "east" : "west"} of plan`;
}

export function formatNorthOfPlan(deltaNorthingM: number): string {
  if (Math.abs(deltaNorthingM) < 0.05) return "on northing";
  return `${Math.abs(deltaNorthingM).toFixed(1)} m ${deltaNorthingM > 0 ? "north" : "south"} of plan`;
}

export function formatVerticalOfPlan(deltaRlM: number): string {
  if (Math.abs(deltaRlM) < 0.05) return "on vertical";
  return `${Math.abs(deltaRlM).toFixed(1)} m ${deltaRlM > 0 ? "above" : "below"} plan`;
}

export function formatEastShort(deltaEastingM: number): string {
  if (Math.abs(deltaEastingM) < 0.05) return "on easting";
  return `${Math.abs(deltaEastingM).toFixed(1)} ${deltaEastingM > 0 ? "E" : "W"}`;
}

export function formatNorthShort(deltaNorthingM: number): string {
  if (Math.abs(deltaNorthingM) < 0.05) return "on northing";
  return `${Math.abs(deltaNorthingM).toFixed(1)} ${deltaNorthingM > 0 ? "N" : "S"}`;
}

export function formatDipDifferenceNarrative(deltaDegrees: number): string {
  const abs = Math.abs(deltaDegrees).toFixed(1);
  if (Math.abs(deltaDegrees) < 0.05) return "0.0°";
  // Positive actual−planned with steeper negative dips → flatter when actual is less steep.
  return deltaDegrees > 0 ? `${abs}° flatter` : `${abs}° steeper`;
}

export function formatAzimuthDifferenceNarrative(
  circularDifferenceDegrees: number,
  plannedAzimuthDegrees: number,
  actualAzimuthDegrees: number,
): string {
  const abs = Math.abs(circularDifferenceDegrees).toFixed(1);
  if (Math.abs(circularDifferenceDegrees) < 0.05) return "0.0°";
  let delta = actualAzimuthDegrees - plannedAzimuthDegrees;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta < 0
    ? `${abs}° anticlockwise`
    : `${abs}° clockwise`;
}

export function formatDeviationNarrative(point: {
  deltaEastingM: number;
  deltaNorthingM: number;
  deltaRlM: number;
}): string {
  const east =
    Math.abs(point.deltaEastingM) < 0.05
      ? "on easting"
      : `${Math.abs(point.deltaEastingM).toFixed(1)} m ${point.deltaEastingM > 0 ? "east" : "west"}`;
  const north =
    Math.abs(point.deltaNorthingM) < 0.05
      ? "on northing"
      : `${Math.abs(point.deltaNorthingM).toFixed(1)} m ${point.deltaNorthingM > 0 ? "north" : "south"}`;
  const vertical =
    Math.abs(point.deltaRlM) < 0.05
      ? "on vertical"
      : `${Math.abs(point.deltaRlM).toFixed(1)} m ${point.deltaRlM > 0 ? "above" : "below"} plan`;
  return `${east}, ${north} and ${vertical}.`;
}
