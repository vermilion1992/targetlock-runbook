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
