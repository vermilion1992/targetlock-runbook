declare const decimetresBrand: unique symbol;

/**
 * A non-negative whole number of decimetres.
 *
 * TargetLock stores operational lengths at 0.1 m precision. Keeping this
 * nominal type integer-only prevents floating-point drift in domain arithmetic.
 */
export type Decimetres<Value extends number = number> = Value & {
  readonly [decimetresBrand]: "Decimetres";
};

export function decimetres<const Value extends number>(
  value: Value,
): Decimetres<Value> {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `Decimetres must be a safe integer; received ${String(value)}.`,
    );
  }

  if (value < 0) {
    throw new RangeError(
      `Decimetres cannot be negative; received ${String(value)}.`,
    );
  }

  return value as Decimetres<Value>;
}

export const THREE_METRES = decimetres(30);
export const SIX_METRES = decimetres(60);
export const THREE_METRE_ROD_LENGTH = THREE_METRES;
export const SIX_METRE_ROD_LENGTH = SIX_METRES;

export type MetreInputParseResult =
  | { readonly ok: true; readonly value: Decimetres }
  | {
      readonly ok: false;
      readonly reason: "empty" | "invalid" | "negative" | "precision" | "range";
    };

/**
 * Parses a presentation metre string without floating-point arithmetic.
 * Additional decimal places are accepted only when they are trailing zeroes,
 * so pasted values such as "4.30" normalise safely while "4.35" is rejected.
 */
export function parseMetreInput(value: string): MetreInputParseResult {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (/^-\d/.test(normalized)) {
    return { ok: false, reason: "negative" };
  }
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, reason: "invalid" };
  }

  const [wholePart = "0", fractionPart = ""] = normalized.split(".");
  if (
    fractionPart.length > 1 &&
    /[1-9]/.test(fractionPart.slice(1))
  ) {
    return { ok: false, reason: "precision" };
  }

  const wholeMetres = Number.parseInt(wholePart, 10);
  const tenths = Number.parseInt(fractionPart.slice(0, 1) || "0", 10);
  const valueDm = wholeMetres * 10 + tenths;
  if (!Number.isSafeInteger(valueDm)) {
    return { ok: false, reason: "range" };
  }

  return { ok: true, value: decimetres(valueDm) };
}

/**
 * Converts a value already expressed at the domain's 0.1 m boundary.
 * Values with finer precision are rejected instead of silently rounded.
 */
export function metresToDecimetres(metres: number): Decimetres {
  if (!Number.isFinite(metres)) {
    throw new RangeError(`Metres must be finite; received ${String(metres)}.`);
  }

  if (metres < 0) {
    throw new RangeError(`Metres cannot be negative; received ${metres}.`);
  }

  const value = metres * 10;
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `Metres must have at most one decimal place; received ${metres}. Use roundToNearestDecimetre for explicit rounding.`,
    );
  }

  return decimetres(value);
}

export function roundToNearestDecimetre(metres: number): Decimetres {
  if (!Number.isFinite(metres)) {
    throw new RangeError(`Metres must be finite; received ${String(metres)}.`);
  }

  if (metres < 0) {
    throw new RangeError(`Metres cannot be negative; received ${metres}.`);
  }

  return decimetres(Math.round(metres * 10));
}

export function decimetresToMetres(value: Decimetres): number {
  return value / 10;
}

export function formatMetres(value: Decimetres): string {
  return `${decimetresToMetres(value).toFixed(1)} m`;
}

export function addDecimetres(
  ...values: readonly Decimetres[]
): Decimetres {
  return decimetres(values.reduce<number>((total, value) => total + value, 0));
}

export function subtractDecimetres(
  minuend: Decimetres,
  subtrahend: Decimetres,
  operation = "Length subtraction",
): Decimetres {
  const result = minuend - subtrahend;
  if (result < 0) {
    throw new RangeError(
      `${operation} cannot produce a negative length (${formatMetres(minuend)} - ${formatMetres(subtrahend)}).`,
    );
  }

  return decimetres(result);
}
