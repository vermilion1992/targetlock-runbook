import { formatMetres, type Decimetres } from "@/domain";
import type { BottomHoleAssemblySetup } from "@/infrastructure/components";

export interface BottomHoleAssemblyTimelineEntry {
  readonly id: string;
  readonly category: "BHA";
  readonly depthDm: Decimetres;
  readonly occurredAt: string;
  readonly title: string;
  readonly detail: string;
}

export function mapBottomHoleAssemblyTimelineEntries(
  setups: readonly BottomHoleAssemblySetup[],
): readonly BottomHoleAssemblyTimelineEntry[] {
  const chronological = [...setups].sort(
    (left, right) =>
      Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt) ||
      left.localId.localeCompare(right.localId),
  );

  return chronological.map((setup, index) => {
    const previous = chronological[index - 1];
    const measurementDetail =
      previous === undefined
        ? `Initial full BHA ${formatMetres(setup.bottomHoleAssemblyLengthDm)} · initial constant stick-up ${formatMetres(setup.constantStickUpDm)}`
        : `Full BHA ${formatMetres(previous.bottomHoleAssemblyLengthDm)} → ${formatMetres(setup.bottomHoleAssemblyLengthDm)} · constant stick-up ${formatMetres(previous.constantStickUpDm)} → ${formatMetres(setup.constantStickUpDm)}`;
    return {
      id: `bha-${setup.localId}`,
      category: "BHA",
      depthDm: setup.effectiveDepthDm,
      occurredAt: setup.effectiveAt,
      title:
        previous === undefined
          ? "Initial BHA setup recorded"
          : "BHA setup updated",
      detail: `${measurementDetail} · ${setup.recordedByNameSnapshot} · ${setup.reason}`,
    };
  });
}
