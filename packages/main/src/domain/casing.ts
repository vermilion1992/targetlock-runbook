import {
  decimetres,
  subtractDecimetres,
  type Decimetres,
} from "./measurements";
import type { CasingEvent, CasingStatus, CasingString } from "./models";

export type CasingRangeValidation =
  | { readonly ok: true; readonly requiresDepthConfirmation: false }
  | {
      readonly ok: true;
      readonly requiresDepthConfirmation: true;
      readonly warning: string;
    }
  | { readonly ok: false; readonly reason: string };

export function validateCasingRange(
  startDepthDm: Decimetres,
  endDepthDm: Decimetres,
  currentHoleDepthDm: Decimetres,
): CasingRangeValidation {
  if (endDepthDm < startDepthDm) {
    return {
      ok: false,
      reason: "Casing end depth cannot be shallower than its start depth.",
    };
  }

  if (endDepthDm > currentHoleDepthDm) {
    return {
      ok: true,
      requiresDepthConfirmation: true,
      warning: "Casing end depth is deeper than the current completed hole depth.",
    };
  }

  return { ok: true, requiresDepthConfirmation: false };
}

export function casingEventTypeForDepthChange(
  previousEndDepthDm: Decimetres,
  newEndDepthDm: Decimetres,
): "ADVANCE" | "SHORTEN" {
  if (newEndDepthDm === previousEndDepthDm) {
    throw new RangeError("The new casing depth must differ from the current depth.");
  }

  return newEndDepthDm > previousEndDepthDm ? "ADVANCE" : "SHORTEN";
}

export interface CasingProjection {
  readonly endDepthDm: Decimetres;
  readonly status: CasingStatus;
}

/**
 * Replays immutable casing events without changing the supplied snapshot.
 * Repositories use this to verify that their current projection is recoverable.
 */
export function projectCasingEvents(
  casing: Pick<CasingString, "startDepthDm" | "status">,
  events: readonly CasingEvent[],
): CasingProjection {
  let endDepthDm = casing.startDepthDm;
  let status = casing.status;

  for (const event of [...events].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt),
  )) {
    if (
      event.previousEndDepthDm !== undefined &&
      event.previousEndDepthDm !== endDepthDm
    ) {
      throw new RangeError(
        `Casing event ${event.localId} does not continue from the previous depth.`,
      );
    }
    if (event.newEndDepthDm < casing.startDepthDm) {
      throw new RangeError(
        `Casing event ${event.localId} ends before the casing start depth.`,
      );
    }

    endDepthDm = decimetres(event.newEndDepthDm);
    status = event.newStatus ?? status;
  }

  return { endDepthDm, status };
}

export function formatCasingSummary(
  casingStrings: readonly CasingString[],
): string | null {
  const active = casingStrings
    .filter(({ status }) => status === "ACTIVE" || status === "COMPLETED")
    .sort((left, right) => left.currentEndDepthDm - right.currentEndDepthDm);

  if (active.length === 0) return null;

  return active
    .map(
      ({ casingSize, currentEndDepthDm }) =>
        `${casingSize} to ${(currentEndDepthDm / 10).toFixed(1)} m`,
    )
    .join("; ");
}

export function calculateCasingLength(
  startDepthDm: Decimetres,
  endDepthDm: Decimetres,
): Decimetres {
  return subtractDecimetres(
    endDepthDm,
    startDepthDm,
    "Casing length calculation",
  );
}
