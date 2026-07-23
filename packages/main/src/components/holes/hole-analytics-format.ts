import { formatMetres, type Decimetres } from "@/domain";

export {
  formatGrossMetresPerHour,
  formatOptionalMetres,
  formatRecoveryTenths,
} from "@/components/shifts/shift-analytics-format";

export function formatSignedMetres(valueDm: number): string {
  const metres = valueDm / 10;
  const sign = metres > 0 ? "+" : "";
  return `${sign}${metres.toFixed(1)} m`;
}

export function formatOptionalSignedMetres(
  valueDm: number | undefined,
): string {
  if (valueDm === undefined) return "Not available";
  return formatSignedMetres(valueDm);
}

export function formatDepthRange(
  start: Decimetres,
  end: Decimetres,
): string {
  return `${formatMetres(start)} – ${formatMetres(end)}`;
}

export const HOLE_METRIC_DEFINITIONS = {
  weightedRecovery:
    "Weighted recovery: total recovered divided by total drilled. Not a simple average of Run percentages.",
  averageMetresPerShift:
    "Average metres per Shift: total metres credited to completed Shifts divided by completed Shift count.",
  grossMetresPerHour:
    "Gross metres per elapsed Shift hour: includes all elapsed Shift time and is not a machine penetration rate.",
  observedComponentRecovery:
    "Observed recovery during assignment: recovery recorded during the component assignment. It does not prove component causation.",
  shortLongRuns:
    "Unusually short Runs are under 1.5 m; unusually long Runs are over 6.0 m (documented pilot thresholds).",
} as const;
