import { formatMetres, type Decimetres, type ShiftAnalytics } from "@/domain";

export function formatRecoveryTenths(
  tenths: number | undefined,
): string {
  if (tenths === undefined) return "Not available";
  return `${(tenths / 10).toFixed(1)}%`;
}

export function formatOptionalMetres(
  value: Decimetres | undefined,
): string {
  if (value === undefined) return "Not available";
  return formatMetres(value);
}

export function formatOptionalMinutes(
  value: number | undefined,
): string {
  if (value === undefined) return "Not available";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function formatGrossMetresPerHour(
  tenths: number | undefined,
): string {
  if (tenths === undefined) return "Not available";
  return `${(tenths / 10).toFixed(1)} m/h`;
}

export function runRangeLabel(analytics: ShiftAnalytics): string {
  if (
    analytics.firstRunNumber === undefined ||
    analytics.lastRunNumber === undefined
  ) {
    return "None";
  }
  if (analytics.firstRunNumber === analytics.lastRunNumber) {
    return `Run ${analytics.firstRunNumber}`;
  }
  return `Runs ${analytics.firstRunNumber}–${analytics.lastRunNumber}`;
}
