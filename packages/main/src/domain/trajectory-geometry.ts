/**
 * Pure geometry helpers ported from TargetLock IQ
 * (`packages/starterkit/src/lib/drilling/geometry.ts`).
 *
 * Dip convention (identical to IQ / TargetLock Runbook):
 *   -90° = vertically downward, 0° = horizontal, +90° = vertically upward
 *
 * Direction vector (metres, D down-positive locally):
 *   e = cos(dip) * sin(az)
 *   n = cos(dip) * cos(az)
 *   d = -sin(dip)
 *
 * Inclination from vertical down: inclination = 90° + dip
 * (documented for engineers; MC uses the dip-vector form above for IQ parity).
 */

export interface TrajectoryVec3 {
  readonly e: number;
  readonly n: number;
  readonly d: number;
}

export const TRAJECTORY_DEG = Math.PI / 180;
export const TRAJECTORY_RAD = 180 / Math.PI;
export const TRAJECTORY_EPS = 1e-9;

export function clampTrajectory(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAzimuthDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Signed shortest angle from → to in (−180, 180]. */
export function shortestAzimuthDifferenceDegrees(
  from: number,
  to: number,
): number {
  return ((to - from + 540) % 360) - 180;
}

/** Absolute circular difference in [0, 180]. */
export function circularAzimuthDifferenceDegrees(
  left: number,
  right: number,
): number {
  return Math.abs(shortestAzimuthDifferenceDegrees(left, right));
}

export function vectorLength(v: TrajectoryVec3): number {
  return Math.hypot(v.e, v.n, v.d);
}

export function normalizeVector(
  v: TrajectoryVec3,
  fallback?: TrajectoryVec3,
): TrajectoryVec3 {
  const length = vectorLength(v);
  if (length < TRAJECTORY_EPS) {
    return fallback ?? { e: 0, n: 0, d: 1 };
  }
  return { e: v.e / length, n: v.n / length, d: v.d / length };
}

export function addVec(
  a: TrajectoryVec3,
  b: TrajectoryVec3,
): TrajectoryVec3 {
  return { e: a.e + b.e, n: a.n + b.n, d: a.d + b.d };
}

export function subtractVec(
  a: TrajectoryVec3,
  b: TrajectoryVec3,
): TrajectoryVec3 {
  return { e: a.e - b.e, n: a.n - b.n, d: a.d - b.d };
}

export function scaleVec(v: TrajectoryVec3, amount: number): TrajectoryVec3 {
  return { e: v.e * amount, n: v.n * amount, d: v.d * amount };
}

export function dotVec(a: TrajectoryVec3, b: TrajectoryVec3): number {
  return a.e * b.e + a.n * b.n + a.d * b.d;
}

export function vectorFromDipAz(
  dipDegrees: number,
  azimuthDegrees: number,
): TrajectoryVec3 {
  const dipRad = dipDegrees * TRAJECTORY_DEG;
  const aziRad = azimuthDegrees * TRAJECTORY_DEG;
  const horizontal = Math.cos(dipRad);
  return {
    e: horizontal * Math.sin(aziRad),
    n: horizontal * Math.cos(aziRad),
    d: -Math.sin(dipRad),
  };
}

export function dipAzFromVector(vector: TrajectoryVec3): {
  dip: number;
  azimuth: number;
} {
  const v = normalizeVector(vector);
  const horizontal = Math.hypot(v.e, v.n);
  return {
    dip: -Math.atan2(v.d, horizontal) * TRAJECTORY_RAD,
    azimuth: normalizeAzimuthDegrees(Math.atan2(v.e, v.n) * TRAJECTORY_RAD),
  };
}

export function doglegDegrees(
  a: TrajectoryVec3,
  b: TrajectoryVec3,
): number {
  const av = normalizeVector(a);
  const bv = normalizeVector(b);
  return (
    Math.acos(clampTrajectory(dotVec(av, bv), -1, 1)) * TRAJECTORY_RAD
  );
}

export function slerpDirection(
  a: TrajectoryVec3,
  b: TrajectoryVec3,
  t: number,
): TrajectoryVec3 {
  const av = normalizeVector(a);
  const bv = normalizeVector(b);
  const cosine = clampTrajectory(dotVec(av, bv), -1, 1);
  const angle = Math.acos(cosine);
  if (angle < TRAJECTORY_EPS) return av;

  let tangent = subtractVec(bv, scaleVec(av, cosine));
  if (vectorLength(tangent) < TRAJECTORY_EPS) {
    const basis =
      Math.abs(av.e) <= Math.abs(av.n) && Math.abs(av.e) <= Math.abs(av.d)
        ? { e: 1, n: 0, d: 0 }
        : Math.abs(av.n) <= Math.abs(av.d)
          ? { e: 0, n: 1, d: 0 }
          : { e: 0, n: 0, d: 1 };
    tangent = subtractVec(basis, scaleVec(av, dotVec(basis, av)));
  }
  const orthogonal = normalizeVector(tangent);
  return normalizeVector(
    addVec(
      scaleVec(av, Math.cos(t * angle)),
      scaleVec(orthogonal, Math.sin(t * angle)),
    ),
    av,
  );
}

/**
 * Minimum-curvature interval displacement (metres).
 * RF = 1 for tiny doglegs; otherwise RF = (2/θ)·tan(θ/2).
 */
export function minCurveDisplacement(
  from: { readonly dip: number; readonly azimuth: number },
  to: { readonly dip: number; readonly azimuth: number },
  lengthM: number,
): TrajectoryVec3 {
  const v1 = vectorFromDipAz(from.dip, from.azimuth);
  const v2 = vectorFromDipAz(to.dip, to.azimuth);
  const angle = Math.acos(clampTrajectory(dotVec(v1, v2), -1, 1));
  const ratioFactor =
    angle < TRAJECTORY_EPS ? 1 : (2 / angle) * Math.tan(angle / 2);
  return scaleVec(addVec(v1, v2), (lengthM / 2) * ratioFactor);
}

export function directionWording(
  valueM: number,
  negativeLabel: string,
  positiveLabel: string,
): { amountM: number; direction: string } {
  if (!Number.isFinite(valueM) || Math.abs(valueM) < 0.05) {
    return { amountM: 0, direction: "on plan" };
  }
  return {
    amountM: Math.abs(valueM),
    direction: valueM < 0 ? negativeLabel : positiveLabel,
  };
}
