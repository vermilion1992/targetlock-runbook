import {
  addDecimetres,
  type Decimetres,
  decimetres,
  formatMetres,
  SIX_METRE_ROD_LENGTH,
  subtractDecimetres,
  THREE_METRE_ROD_LENGTH,
} from "./measurements";

export type RodLength =
  | typeof THREE_METRE_ROD_LENGTH
  | typeof SIX_METRE_ROD_LENGTH;

export type RodEventAction = "add" | "remove";

export interface RodEventInput {
  readonly action: RodEventAction;
  readonly rodLength: RodLength;
}

export interface ActiveRodInventory {
  readonly threeMetreRods: number;
  readonly sixMetreRods: number;
  readonly totalRods: number;
  readonly totalLength: Decimetres;
}

function assertRodLength(value: Decimetres): asserts value is RodLength {
  if (
    value !== THREE_METRE_ROD_LENGTH &&
    value !== SIX_METRE_ROD_LENGTH
  ) {
    throw new RangeError(
      `Rod length must be ${formatMetres(THREE_METRE_ROD_LENGTH)} or ${formatMetres(SIX_METRE_ROD_LENGTH)}; received ${formatMetres(value)}.`,
    );
  }
}

export function calculateBaseRodString(
  bottomHoleAssemblyLength: Decimetres,
  constantStickUp: Decimetres,
): Decimetres {
  return subtractDecimetres(
    bottomHoleAssemblyLength,
    constantStickUp,
    "Base rod string (BHA - constant stick-up)",
  );
}

export function calculateCurrentRodString(
  baseRodString: Decimetres,
  events: readonly RodEventInput[],
): Decimetres {
  let current = baseRodString;

  for (const event of events) {
    assertRodLength(event.rodLength);
    current =
      event.action === "add"
        ? addDecimetres(current, event.rodLength)
        : subtractDecimetres(
            current,
            event.rodLength,
            "Rod removal from current rod string",
          );
  }

  return current;
}

/**
 * Hole depth is current rod string minus measured stick-up. Constant stick-up
 * is already excluded from the base rod string and must not be added here.
 */
export function calculateHoleDepth(
  currentRodString: Decimetres,
  measuredStickUp: Decimetres,
): Decimetres {
  return subtractDecimetres(
    currentRodString,
    measuredStickUp,
    "Hole depth (current rod string - stick-up)",
  );
}

export function calculateDrilledLength(
  currentHoleDepth: Decimetres,
  previousCompletedDepth: Decimetres,
): Decimetres {
  return subtractDecimetres(
    currentHoleDepth,
    previousCompletedDepth,
    "Drilled length (current depth - previous completed depth)",
  );
}

export function calculateRodNumber(
  events: readonly RodEventInput[],
  initialRodNumber = 0,
): number {
  if (!Number.isSafeInteger(initialRodNumber) || initialRodNumber < 0) {
    throw new RangeError(
      `Initial rod number must be a non-negative safe integer; received ${String(initialRodNumber)}.`,
    );
  }

  let rodNumber = initialRodNumber;
  for (const event of events) {
    assertRodLength(event.rodLength);
    rodNumber += event.action === "add" ? 1 : -1;
    if (rodNumber < 0) {
      throw new RangeError(
        "Rod removal cannot reduce the rod number below zero.",
      );
    }
  }

  return rodNumber;
}

export function calculateActiveRodInventory(
  events: readonly RodEventInput[],
): ActiveRodInventory {
  let threeMetreRods = 0;
  let sixMetreRods = 0;

  for (const event of events) {
    assertRodLength(event.rodLength);
    const delta = event.action === "add" ? 1 : -1;

    if (event.rodLength === THREE_METRE_ROD_LENGTH) {
      threeMetreRods += delta;
      if (threeMetreRods < 0) {
        throw new RangeError(
          "A 3.0 m rod cannot be removed when none are active.",
        );
      }
    } else {
      sixMetreRods += delta;
      if (sixMetreRods < 0) {
        throw new RangeError(
          "A 6.0 m rod cannot be removed when none are active.",
        );
      }
    }
  }

  return {
    threeMetreRods,
    sixMetreRods,
    totalRods: threeMetreRods + sixMetreRods,
    totalLength: decimetres(
      threeMetreRods * THREE_METRE_ROD_LENGTH +
        sixMetreRods * SIX_METRE_ROD_LENGTH,
    ),
  };
}
