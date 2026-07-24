/**
 * Constrained geometric curved recovery-path solver for Mini TargetLock V2.
 *
 * Builds current → control(~1/3) → control(~2/3) → target stations and
 * optimises internal dip/azimuth with the verified minimum-curvature engine.
 *
 * IQ well-path-design `curve-to-target` is position-only with free final MD and
 * no target-attitude modes, so it is not reused as the primary solver. Runbook
 * keeps a single deterministic MC-backed source for recovery paths.
 *
 * Geometric guidance only — not steering-tool feasibility certification.
 */

import { decimetres } from "./measurements";
import type { NorthReference } from "./models";
import {
  convertAzimuthDegrees,
  toAzimuthConversionConfig,
} from "./trajectory-references";
import { getTrajectoryPositionAtMeasuredDepth } from "./trajectory-desurvey";
import {
  clampTrajectory,
  circularAzimuthDifferenceDegrees,
  dipAzFromVector,
  doglegDegrees,
  minCurveDisplacement,
  normalizeAzimuthDegrees,
  shortestAzimuthDifferenceDegrees,
  vectorFromDipAz,
} from "./trajectory-geometry";
import type {
  CalculatedTrajectoryStation,
  ReferenceConfiguration,
  TargetAttitudeMode,
  TrajectoryStationInput,
} from "./trajectory-types";
import { TRAJECTORY_ENGINE_VERSION } from "./trajectory-types";

export const CURVED_TARGET_SOLVER_VERSION = "curved-target-mc-v1" as const;

/** Numerical convergence residual (metres) — separate from target radius. */
export const CURVED_SOLVER_POSITION_TOLERANCE_M = 0.25;
export const CURVED_SOLVER_ATTITUDE_TOLERANCE_DEG = 0.75;
/** Advisory dogleg sharpness threshold (°/30 m). */
export const CURVED_SOLVER_REVIEW_DLS_PER_30M = 8;

export type CurvedTargetSolutionStatus =
  | "SOLVED"
  | "REVIEW_REQUIRED"
  | "NO_SOLUTION"
  | "INSUFFICIENT_INPUT";

export type CurvedTargetWarningCode =
  | "TARGET_UNREACHABLE_AT_MD"
  | "TARGET_MD_SHALLOWER_THAN_SURVEY"
  | "SURVEY_AT_TARGET_OUTSIDE"
  | "MISSING_NEXT_SURVEY_DEPTH"
  | "SHARP_CURVATURE"
  | "ATTITUDE_RESIDUAL"
  | "POSITION_RESIDUAL"
  | "COLLAR_BASED_GUIDANCE";

export interface CurvedTargetWarning {
  readonly code: CurvedTargetWarningCode;
  readonly message: string;
}

export interface CurvedTargetSolutionStation {
  readonly measuredDepthM: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
}

export interface CurvedTargetSolutionInput {
  readonly currentStation: {
    readonly measuredDepthM: number;
    readonly eastingM: number;
    readonly northingM: number;
    readonly rlM: number;
    readonly dipDegrees: number;
    readonly azimuthDegrees: number;
    readonly northReference: NorthReference;
  };
  readonly target: {
    readonly measuredDepthM: number;
    readonly eastingM: number;
    readonly northingM: number;
    readonly rlM: number;
    readonly radiusM: number;
    readonly attitudeMode: TargetAttitudeMode;
    readonly desiredDipDegrees?: number;
    readonly desiredAzimuthDegrees?: number;
    readonly desiredNorthReference?: NorthReference;
  };
  readonly collarAttitude?: {
    readonly dipDegrees: number;
    readonly azimuthDegrees: number;
    readonly northReference: NorthReference;
  };
  readonly nextSurveyMeasuredDepthM?: number;
  readonly calculationReference: NorthReference;
  readonly referenceConfiguration?: ReferenceConfiguration | null;
  readonly holeId?: string;
}

export interface CurvedTargetSolution {
  readonly status: CurvedTargetSolutionStatus;
  readonly path: readonly CurvedTargetSolutionStation[];
  readonly pathStations: readonly CalculatedTrajectoryStation[];
  readonly nextSurveyTarget: {
    readonly measuredDepthM: number;
    readonly dipDegrees: number;
    readonly azimuthDegrees: number;
  } | null;
  readonly endpoint: CurvedTargetSolutionStation | null;
  readonly targetResidualM: number | null;
  readonly targetAttitudeResidual?: {
    readonly dipDegrees: number;
    readonly azimuthDegrees: number;
  };
  readonly remainingMeasuredDepthM: number | null;
  readonly straightDistanceM: number | null;
  readonly maximumDoglegDegrees?: number;
  readonly maximumDoglegPer30mDegrees?: number;
  readonly solverConverged: boolean;
  readonly engineVersion: typeof TRAJECTORY_ENGINE_VERSION;
  readonly solverVersion: typeof CURVED_TARGET_SOLVER_VERSION;
  readonly warnings: readonly CurvedTargetWarning[];
}

interface AttitudePair {
  dipDegrees: number;
  azimuthDegrees: number;
}

function emptySolution(
  status: CurvedTargetSolutionStatus,
  warnings: readonly CurvedTargetWarning[],
  extras: Partial<CurvedTargetSolution> = {},
): CurvedTargetSolution {
  return {
    status,
    path: [],
    pathStations: [],
    nextSurveyTarget: null,
    endpoint: null,
    targetResidualM: null,
    remainingMeasuredDepthM: extras.remainingMeasuredDepthM ?? null,
    straightDistanceM: extras.straightDistanceM ?? null,
    solverConverged: false,
    engineVersion: TRAJECTORY_ENGINE_VERSION,
    solverVersion: CURVED_TARGET_SOLVER_VERSION,
    warnings,
    ...extras,
  };
}

function spatialDistance(
  a: { eastingM: number; northingM: number; rlM: number },
  b: { eastingM: number; northingM: number; rlM: number },
): number {
  return Math.hypot(
    a.eastingM - b.eastingM,
    a.northingM - b.northingM,
    a.rlM - b.rlM,
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAzimuth(from: number, to: number, t: number): number {
  const delta = shortestAzimuthDifferenceDegrees(from, to);
  return normalizeAzimuthDegrees(from + delta * t);
}

function convertAttitude(
  dipDegrees: number,
  azimuthDegrees: number,
  fromReference: NorthReference,
  toReference: NorthReference,
  referenceConfiguration?: ReferenceConfiguration | null,
): AttitudePair {
  return {
    dipDegrees: clampTrajectory(dipDegrees, -90, 90),
    azimuthDegrees: convertAzimuthDegrees(
      azimuthDegrees,
      fromReference,
      toReference,
      toAzimuthConversionConfig(referenceConfiguration),
    ),
  };
}

function resolveEndpointAttitude(
  input: CurvedTargetSolutionInput,
): AttitudePair | "UNCONSTRAINED" | null {
  const mode = input.target.attitudeMode;
  if (mode === "UNCONSTRAINED") return "UNCONSTRAINED";
  if (mode === "SAME_AS_COLLAR") {
    if (!input.collarAttitude) return null;
    return convertAttitude(
      input.collarAttitude.dipDegrees,
      input.collarAttitude.azimuthDegrees,
      input.collarAttitude.northReference,
      input.calculationReference,
      input.referenceConfiguration,
    );
  }
  if (
    input.target.desiredDipDegrees === undefined ||
    input.target.desiredAzimuthDegrees === undefined ||
    input.target.desiredNorthReference === undefined ||
    input.target.desiredNorthReference === "NOT_SPECIFIED"
  ) {
    return null;
  }
  return convertAttitude(
    input.target.desiredDipDegrees,
    input.target.desiredAzimuthDegrees,
    input.target.desiredNorthReference,
    input.calculationReference,
    input.referenceConfiguration,
  );
}

function degreesToTenths(degrees: number): number {
  return Math.round(degrees * 10);
}

function metresToDm(metres: number): number {
  return Math.round(metres * 10);
}

function buildStationInputs(
  current: CurvedTargetSolutionInput["currentStation"],
  calculationReference: NorthReference,
  md1: number,
  md2: number,
  targetMd: number,
  attitudes: readonly [AttitudePair, AttitudePair, AttitudePair],
): TrajectoryStationInput[] {
  const mk = (
    md: number,
    attitude: AttitudePair,
    sourceType: TrajectoryStationInput["sourceType"],
    sourceId?: string,
  ): TrajectoryStationInput => ({
    sourceType,
    sourceId,
    measuredDepthDm: decimetres(Math.max(0, metresToDm(md))),
    dipTenths: degreesToTenths(attitude.dipDegrees),
    originalAzimuthTenths: degreesToTenths(
      normalizeAzimuthDegrees(attitude.azimuthDegrees),
    ),
    originalNorthReference: calculationReference,
    calculationAzimuthTenths: degreesToTenths(
      normalizeAzimuthDegrees(attitude.azimuthDegrees),
    ),
    calculationNorthReference: calculationReference,
  });

  const start: AttitudePair = {
    dipDegrees: current.dipDegrees,
    azimuthDegrees: normalizeAzimuthDegrees(current.azimuthDegrees),
  };

  const stations: TrajectoryStationInput[] = [
    mk(current.measuredDepthM, start, "SURVEY", "solver-current"),
  ];
  if (md1 > current.measuredDepthM + 0.05) {
    stations.push(mk(md1, attitudes[0], "PLANNED", "solver-c1"));
  }
  if (md2 > md1 + 0.05 && md2 < targetMd - 0.05) {
    stations.push(mk(md2, attitudes[1], "PLANNED", "solver-c2"));
  }
  stations.push(mk(targetMd, attitudes[2], "PLANNED", "solver-target"));
  return stations;
}

interface SolverStationPose {
  readonly measuredDepthM: number;
  readonly dipDegrees: number;
  readonly azimuthDegrees: number;
  readonly eastingM: number;
  readonly northingM: number;
  readonly rlM: number;
  readonly doglegDegreesFromPrevious?: number;
}

/** High-precision MC evaluation used during optimisation (avoids tenths quantisation). */
function evaluatePathDegrees(
  input: CurvedTargetSolutionInput,
  poses: readonly { measuredDepthM: number; dipDegrees: number; azimuthDegrees: number }[],
): {
  residualM: number;
  attitudeResidual?: { dipDegrees: number; azimuthDegrees: number };
  maxDogleg: number;
  maxDoglegPer30m: number;
  endpoint: SolverStationPose;
  stations: readonly SolverStationPose[];
} | null {
  if (poses.length < 2) return null;
  try {
    const stations: SolverStationPose[] = [];
    let eastingM = input.currentStation.eastingM;
    let northingM = input.currentStation.northingM;
    let rlM = input.currentStation.rlM;
    for (let i = 0; i < poses.length; i += 1) {
      const pose = poses[i]!;
      let dogleg: number | undefined;
      if (i > 0) {
        const prev = poses[i - 1]!;
        const lengthM = Math.max(0, pose.measuredDepthM - prev.measuredDepthM);
        const displacement = minCurveDisplacement(
          { dip: prev.dipDegrees, azimuth: prev.azimuthDegrees },
          { dip: pose.dipDegrees, azimuth: pose.azimuthDegrees },
          lengthM,
        );
        eastingM += displacement.e;
        northingM += displacement.n;
        rlM -= displacement.d;
        dogleg = doglegDegrees(
          vectorFromDipAz(prev.dipDegrees, prev.azimuthDegrees),
          vectorFromDipAz(pose.dipDegrees, pose.azimuthDegrees),
        );
      }
      stations.push({
        measuredDepthM: pose.measuredDepthM,
        dipDegrees: pose.dipDegrees,
        azimuthDegrees: normalizeAzimuthDegrees(pose.azimuthDegrees),
        eastingM,
        northingM,
        rlM,
        doglegDegreesFromPrevious: dogleg,
      });
    }
    const endpoint = stations[stations.length - 1]!;
    const residualM = spatialDistance(endpoint, input.target);
    let maxDogleg = 0;
    let maxDoglegPer30m = 0;
    for (let i = 1; i < stations.length; i += 1) {
      const prev = stations[i - 1]!;
      const curr = stations[i]!;
      const dogleg = curr.doglegDegreesFromPrevious ?? 0;
      maxDogleg = Math.max(maxDogleg, dogleg);
      const deltaMd = Math.max(1e-6, curr.measuredDepthM - prev.measuredDepthM);
      maxDoglegPer30m = Math.max(maxDoglegPer30m, (dogleg / deltaMd) * 30);
    }
    const fixed = resolveEndpointAttitude(input);
    let attitudeResidual:
      | { dipDegrees: number; azimuthDegrees: number }
      | undefined;
    if (fixed && fixed !== "UNCONSTRAINED") {
      attitudeResidual = {
        dipDegrees: endpoint.dipDegrees - fixed.dipDegrees,
        azimuthDegrees: shortestAzimuthDifferenceDegrees(
          fixed.azimuthDegrees,
          endpoint.azimuthDegrees,
        ),
      };
    }
    return {
      residualM,
      attitudeResidual,
      maxDogleg,
      maxDoglegPer30m,
      endpoint,
      stations,
    };
  } catch {
    return null;
  }
}

function posesFromAttitudes(
  input: CurvedTargetSolutionInput,
  attitudes: readonly [AttitudePair, AttitudePair, AttitudePair],
  md1: number,
  md2: number,
): { measuredDepthM: number; dipDegrees: number; azimuthDegrees: number }[] {
  const start = {
    measuredDepthM: input.currentStation.measuredDepthM,
    dipDegrees: input.currentStation.dipDegrees,
    azimuthDegrees: normalizeAzimuthDegrees(input.currentStation.azimuthDegrees),
  };
  const poses = [start];
  if (md1 > start.measuredDepthM + 0.05) {
    poses.push({
      measuredDepthM: md1,
      dipDegrees: attitudes[0].dipDegrees,
      azimuthDegrees: attitudes[0].azimuthDegrees,
    });
  }
  if (md2 > md1 + 0.05 && md2 < input.target.measuredDepthM - 0.05) {
    poses.push({
      measuredDepthM: md2,
      dipDegrees: attitudes[1].dipDegrees,
      azimuthDegrees: attitudes[1].azimuthDegrees,
    });
  }
  poses.push({
    measuredDepthM: input.target.measuredDepthM,
    dipDegrees: attitudes[2].dipDegrees,
    azimuthDegrees: attitudes[2].azimuthDegrees,
  });
  return poses;
}

function evaluatePath(
  input: CurvedTargetSolutionInput,
  attitudes: readonly [AttitudePair, AttitudePair, AttitudePair],
  md1: number,
  md2: number,
): {
  residualM: number;
  attitudeResidual?: { dipDegrees: number; azimuthDegrees: number };
  maxDogleg: number;
  maxDoglegPer30m: number;
  endpoint: CalculatedTrajectoryStation;
  stations: readonly CalculatedTrajectoryStation[];
  stationInputs: TrajectoryStationInput[];
} | null {
  try {
    const degreeEval = evaluatePathDegrees(
      input,
      posesFromAttitudes(input, attitudes, md1, md2),
    );
    if (!degreeEval) return null;

    const stationInputs = buildStationInputs(
      input.currentStation,
      input.calculationReference,
      md1,
      md2,
      input.target.measuredDepthM,
      attitudes,
    );
    const fixed = resolveEndpointAttitude(input);
    let attitudeResidual = degreeEval.attitudeResidual;
    if (fixed && fixed !== "UNCONSTRAINED") {
      attitudeResidual = {
        dipDegrees: degreeEval.endpoint.dipDegrees - fixed.dipDegrees,
        azimuthDegrees: shortestAzimuthDifferenceDegrees(
          fixed.azimuthDegrees,
          degreeEval.endpoint.azimuthDegrees,
        ),
      };
    }

    // Prefer high-precision MC stations for the solved path (same RF formula as
    // the verified engine). Tenths-quantised stationInputs remain for MD sampling.
    const stations: CalculatedTrajectoryStation[] = degreeEval.stations.map(
      (station, index) => ({
        index,
        sourceType: index === 0 ? "SURVEY" : "PLANNED",
        sourceId: index === 0 ? "solver-current" : `solver-${index}`,
        measuredDepthM: station.measuredDepthM,
        dipDegrees: station.dipDegrees,
        azimuthDegrees: station.azimuthDegrees,
        northReference: input.calculationReference,
        relativeEastingM: station.eastingM - input.currentStation.eastingM,
        relativeNorthingM: station.northingM - input.currentStation.northingM,
        verticalDisplacementM: station.rlM - input.currentStation.rlM,
        tvdM: Math.max(0, input.currentStation.rlM - station.rlM),
        eastingM: station.eastingM,
        northingM: station.northingM,
        rlM: station.rlM,
        doglegDegreesFromPrevious: station.doglegDegreesFromPrevious,
      }),
    );

    return {
      residualM: degreeEval.residualM,
      attitudeResidual,
      maxDogleg: degreeEval.maxDogleg,
      maxDoglegPer30m: degreeEval.maxDoglegPer30m,
      endpoint: stations[stations.length - 1]!,
      stations,
      stationInputs,
    };
  } catch {
    return null;
  }
}

function evaluateForOptimisation(
  input: CurvedTargetSolutionInput,
  attitudes: readonly [AttitudePair, AttitudePair, AttitudePair],
  md1: number,
  md2: number,
): {
  residualM: number;
  attitudeResidual?: { dipDegrees: number; azimuthDegrees: number };
  maxDogleg: number;
  maxDoglegPer30m: number;
} | null {
  return evaluatePathDegrees(
    input,
    posesFromAttitudes(input, attitudes, md1, md2),
  );
}

function costOf(evalResult: {
  residualM: number;
  attitudeResidual?: { dipDegrees: number; azimuthDegrees: number };
  maxDogleg: number;
  maxDoglegPer30m: number;
}): number {
  const attitudePenalty = evalResult.attitudeResidual
    ? evalResult.attitudeResidual.dipDegrees ** 2 +
      evalResult.attitudeResidual.azimuthDegrees ** 2
    : 0;
  const curvaturePenalty =
    Math.max(0, evalResult.maxDoglegPer30m - CURVED_SOLVER_REVIEW_DLS_PER_30M) **
    2;
  return (
    evalResult.residualM ** 2 * 100 +
    attitudePenalty * 4 +
    curvaturePenalty * 0.05 +
    evalResult.maxDogleg * 0.01
  );
}

function seedAttitudes(
  input: CurvedTargetSolutionInput,
  endpointFixed: AttitudePair | "UNCONSTRAINED",
): [AttitudePair, AttitudePair, AttitudePair] {
  const start: AttitudePair = {
    dipDegrees: input.currentStation.dipDegrees,
    azimuthDegrees: normalizeAzimuthDegrees(input.currentStation.azimuthDegrees),
  };
  let end: AttitudePair;
  if (endpointFixed === "UNCONSTRAINED") {
    const aim = dipAzFromVector({
      e: input.target.eastingM - input.currentStation.eastingM,
      n: input.target.northingM - input.currentStation.northingM,
      d: -(input.target.rlM - input.currentStation.rlM),
    });
    end = {
      dipDegrees: clampTrajectory(aim.dip, -90, 90),
      azimuthDegrees: normalizeAzimuthDegrees(aim.azimuth),
    };
  } else {
    end = endpointFixed;
  }
  const c1: AttitudePair = {
    dipDegrees: lerp(start.dipDegrees, end.dipDegrees, 1 / 3),
    azimuthDegrees: lerpAzimuth(start.azimuthDegrees, end.azimuthDegrees, 1 / 3),
  };
  const c2: AttitudePair = {
    dipDegrees: lerp(start.dipDegrees, end.dipDegrees, 2 / 3),
    azimuthDegrees: lerpAzimuth(start.azimuthDegrees, end.azimuthDegrees, 2 / 3),
  };
  return [c1, c2, end];
}

function cloneAttitudes(
  attitudes: readonly [AttitudePair, AttitudePair, AttitudePair],
): [AttitudePair, AttitudePair, AttitudePair] {
  return [
    { ...attitudes[0] },
    { ...attitudes[1] },
    { ...attitudes[2] },
  ];
}

function applyParamDelta(
  attitudes: readonly [AttitudePair, AttitudePair, AttitudePair],
  param: number,
  delta: number,
  freeEnd: boolean,
  endpointFixed: AttitudePair | "UNCONSTRAINED",
): [AttitudePair, AttitudePair, AttitudePair] {
  const next = cloneAttitudes(attitudes);
  const stationIndex = Math.floor(param / 2);
  const isDip = param % 2 === 0;
  const attitude = next[stationIndex]!;
  if (isDip) {
    attitude.dipDegrees = clampTrajectory(
      attitude.dipDegrees + delta,
      -89.5,
      89.5,
    );
  } else {
    attitude.azimuthDegrees = normalizeAzimuthDegrees(
      attitude.azimuthDegrees + delta,
    );
  }
  if (!freeEnd && endpointFixed !== "UNCONSTRAINED") {
    next[2] = { ...endpointFixed };
  }
  return next;
}

function buildSeedVariants(
  input: CurvedTargetSolutionInput,
  endpointFixed: AttitudePair | "UNCONSTRAINED",
): Array<[AttitudePair, AttitudePair, AttitudePair]> {
  const primary = seedAttitudes(input, endpointFixed);
  const start: AttitudePair = {
    dipDegrees: input.currentStation.dipDegrees,
    azimuthDegrees: normalizeAzimuthDegrees(input.currentStation.azimuthDegrees),
  };
  const aim = dipAzFromVector({
    e: input.target.eastingM - input.currentStation.eastingM,
    n: input.target.northingM - input.currentStation.northingM,
    d: -(input.target.rlM - input.currentStation.rlM),
  });
  const aimAttitude: AttitudePair = {
    dipDegrees: clampTrajectory(aim.dip, -89.5, 89.5),
    azimuthDegrees: normalizeAzimuthDegrees(aim.azimuth),
  };
  const end =
    endpointFixed === "UNCONSTRAINED" ? aimAttitude : endpointFixed;

  const holdThenCurve: [AttitudePair, AttitudePair, AttitudePair] = [
    { ...start },
    {
      dipDegrees: lerp(start.dipDegrees, end.dipDegrees, 0.5),
      azimuthDegrees: lerpAzimuth(start.azimuthDegrees, end.azimuthDegrees, 0.5),
    },
    { ...end },
  ];
  const earlyCurve: [AttitudePair, AttitudePair, AttitudePair] = [
    {
      dipDegrees: lerp(start.dipDegrees, end.dipDegrees, 0.7),
      azimuthDegrees: lerpAzimuth(start.azimuthDegrees, end.azimuthDegrees, 0.7),
    },
    { ...end },
    { ...end },
  ];
  const sCurve: [AttitudePair, AttitudePair, AttitudePair] = [
    {
      dipDegrees: clampTrajectory(start.dipDegrees + (end.dipDegrees - start.dipDegrees) * 1.2, -89.5, 89.5),
      azimuthDegrees: lerpAzimuth(start.azimuthDegrees, end.azimuthDegrees, 0.4),
    },
    {
      dipDegrees: lerp(start.dipDegrees, end.dipDegrees, 0.85),
      azimuthDegrees: lerpAzimuth(start.azimuthDegrees, end.azimuthDegrees, 0.85),
    },
    { ...end },
  ];

  return [primary, holdThenCurve, earlyCurve, sCurve];
}

function optimiseAttitudes(
  input: CurvedTargetSolutionInput,
  md1: number,
  md2: number,
  endpointFixed: AttitudePair | "UNCONSTRAINED",
): NonNullable<ReturnType<typeof evaluatePath>> | null {
  const freeEnd = endpointFixed === "UNCONSTRAINED";
  const paramCount = freeEnd ? 6 : 4;

  let bestAttitudes = seedAttitudes(input, endpointFixed);
  let bestOpt = evaluateForOptimisation(input, bestAttitudes, md1, md2);
  if (!bestOpt) return null;
  let bestCost = costOf(bestOpt);

  for (const seed of buildSeedVariants(input, endpointFixed)) {
    const evaluated = evaluateForOptimisation(input, seed, md1, md2);
    if (!evaluated) continue;
    const cost = costOf(evaluated);
    if (cost < bestCost) {
      bestCost = cost;
      bestAttitudes = cloneAttitudes(seed);
      bestOpt = evaluated;
    }
  }

  // Coordinate descent with shrinking steps.
  const steps = [20, 10, 5, 2.5, 1.25, 0.6, 0.3, 0.15, 0.08, 0.04];
  for (const step of steps) {
    let improved = true;
    let pass = 0;
    while (improved && pass < 12) {
      improved = false;
      pass += 1;
      for (let param = 0; param < paramCount; param += 1) {
        for (const sign of [-1, 1] as const) {
          const candidate = applyParamDelta(
            bestAttitudes,
            param,
            sign * step,
            freeEnd,
            endpointFixed,
          );
          const evaluated = evaluateForOptimisation(input, candidate, md1, md2);
          if (!evaluated) continue;
          const cost = costOf(evaluated);
          if (cost + 1e-12 < bestCost) {
            bestCost = cost;
            bestAttitudes = candidate;
            bestOpt = evaluated;
            improved = true;
          }
        }
      }
    }
  }

  // Finite-difference gradient refinement on position (+ attitude) cost.
  let learningRate = 0.35;
  for (let iter = 0; iter < 120; iter += 1) {
    const gradients: number[] = [];
    const eps = 0.2;
    for (let param = 0; param < paramCount; param += 1) {
      const plus = applyParamDelta(
        bestAttitudes,
        param,
        eps,
        freeEnd,
        endpointFixed,
      );
      const minus = applyParamDelta(
        bestAttitudes,
        param,
        -eps,
        freeEnd,
        endpointFixed,
      );
      const plusEval = evaluateForOptimisation(input, plus, md1, md2);
      const minusEval = evaluateForOptimisation(input, minus, md1, md2);
      if (!plusEval || !minusEval) {
        gradients.push(0);
        continue;
      }
      gradients.push((costOf(plusEval) - costOf(minusEval)) / (2 * eps));
    }

    let candidate = cloneAttitudes(bestAttitudes);
    for (let param = 0; param < paramCount; param += 1) {
      candidate = applyParamDelta(
        candidate,
        param,
        -learningRate * gradients[param]!,
        freeEnd,
        endpointFixed,
      );
    }
    const evaluated = evaluateForOptimisation(input, candidate, md1, md2);
    if (!evaluated) {
      learningRate *= 0.5;
      continue;
    }
    const cost = costOf(evaluated);
    if (cost + 1e-12 < bestCost) {
      bestCost = cost;
      bestAttitudes = candidate;
      bestOpt = evaluated;
    } else {
      learningRate *= 0.6;
    }
    if (bestOpt.residualM <= CURVED_SOLVER_POSITION_TOLERANCE_M) {
      const attitudeOk =
        bestOpt.attitudeResidual === undefined ||
        (Math.abs(bestOpt.attitudeResidual.dipDegrees) <=
          CURVED_SOLVER_ATTITUDE_TOLERANCE_DEG &&
          Math.abs(bestOpt.attitudeResidual.azimuthDegrees) <=
            CURVED_SOLVER_ATTITUDE_TOLERANCE_DEG);
      if (attitudeOk) break;
    }
    if (learningRate < 1e-4) break;
  }

  return evaluatePath(input, bestAttitudes, md1, md2);
}

function toSolutionStation(
  station: CalculatedTrajectoryStation,
): CurvedTargetSolutionStation {
  return {
    measuredDepthM: station.measuredDepthM,
    eastingM: station.eastingM,
    northingM: station.northingM,
    rlM: station.rlM,
    dipDegrees: station.dipDegrees,
    azimuthDegrees: station.azimuthDegrees,
  };
}

export function nextSurveyMeasuredDepth(input: {
  readonly latestMeasuredDepthM: number;
  readonly targetMeasuredDepthM: number;
  readonly surveyIntervalM?: number | null;
}): number | null {
  if (
    input.surveyIntervalM === undefined ||
    input.surveyIntervalM === null ||
    !(input.surveyIntervalM > 0)
  ) {
    return null;
  }
  const candidate = input.latestMeasuredDepthM + input.surveyIntervalM;
  return Math.min(candidate, input.targetMeasuredDepthM);
}

export function solveCurvedTarget(
  input: CurvedTargetSolutionInput,
): CurvedTargetSolution {
  const warnings: CurvedTargetWarning[] = [];
  const current = input.currentStation;
  const target = input.target;

  if (
    !Number.isFinite(target.measuredDepthM) ||
    target.measuredDepthM <= 0 ||
    !Number.isFinite(target.eastingM) ||
    !Number.isFinite(target.northingM) ||
    !Number.isFinite(target.rlM) ||
    !(target.radiusM > 0)
  ) {
    return emptySolution("INSUFFICIENT_INPUT", [
      {
        code: "TARGET_UNREACHABLE_AT_MD",
        message: "Target measured depth and coordinates are required.",
      },
    ]);
  }

  const remainingMeasuredDepthM = target.measuredDepthM - current.measuredDepthM;
  const straightDistanceM = spatialDistance(current, target);

  if (remainingMeasuredDepthM < -1e-6) {
    return emptySolution(
      "NO_SOLUTION",
      [
        {
          code: "TARGET_MD_SHALLOWER_THAN_SURVEY",
          message:
            "TARGET CANNOT BE REACHED AT THE ENTERED MD. Target MD is shallower than the latest Survey MD.",
        },
      ],
      { remainingMeasuredDepthM, straightDistanceM },
    );
  }

  if (Math.abs(remainingMeasuredDepthM) <= 1e-6) {
    const alreadyInside = straightDistanceM <= target.radiusM + 1e-6;
    if (alreadyInside) {
      const station = toSolutionStation({
        index: 0,
        sourceType: "SURVEY",
        measuredDepthM: current.measuredDepthM,
        dipDegrees: current.dipDegrees,
        azimuthDegrees: current.azimuthDegrees,
        northReference: input.calculationReference,
        relativeEastingM: 0,
        relativeNorthingM: 0,
        verticalDisplacementM: 0,
        tvdM: 0,
        eastingM: current.eastingM,
        northingM: current.northingM,
        rlM: current.rlM,
      });
      return {
        status: "SOLVED",
        path: [station],
        pathStations: [],
        nextSurveyTarget: input.nextSurveyMeasuredDepthM
          ? {
              measuredDepthM: current.measuredDepthM,
              dipDegrees: current.dipDegrees,
              azimuthDegrees: current.azimuthDegrees,
            }
          : null,
        endpoint: station,
        targetResidualM: straightDistanceM,
        remainingMeasuredDepthM: 0,
        straightDistanceM,
        solverConverged: true,
        engineVersion: TRAJECTORY_ENGINE_VERSION,
        solverVersion: CURVED_TARGET_SOLVER_VERSION,
        warnings,
      };
    }
    return emptySolution(
      "NO_SOLUTION",
      [
        {
          code: "SURVEY_AT_TARGET_OUTSIDE",
          message:
            "TARGET CANNOT BE REACHED AT THE ENTERED MD. Latest Survey is at target MD but outside the target.",
        },
      ],
      { remainingMeasuredDepthM: 0, straightDistanceM },
    );
  }

  if (straightDistanceM > remainingMeasuredDepthM + 1e-6) {
    return emptySolution(
      "NO_SOLUTION",
      [
        {
          code: "TARGET_UNREACHABLE_AT_MD",
          message: [
            "TARGET CANNOT BE REACHED AT THE ENTERED MD",
            "",
            `Remaining measured depth`,
            `${remainingMeasuredDepthM.toFixed(1)} m`,
            "",
            `Straight distance to target`,
            `${straightDistanceM.toFixed(1)} m`,
            "",
            "Increase target MD or review the target coordinates.",
          ].join("\n"),
        },
      ],
      { remainingMeasuredDepthM, straightDistanceM },
    );
  }

  const endpointFixed = resolveEndpointAttitude(input);
  if (endpointFixed === null) {
    return emptySolution("INSUFFICIENT_INPUT", [
      {
        code: "ATTITUDE_RESIDUAL",
        message:
          "Target attitude mode requires collar or custom dip/azimuth/reference.",
      },
    ], { remainingMeasuredDepthM, straightDistanceM });
  }

  const md1 = current.measuredDepthM + remainingMeasuredDepthM / 3;
  const md2 = current.measuredDepthM + (2 * remainingMeasuredDepthM) / 3;
  const evaluated = optimiseAttitudes(input, md1, md2, endpointFixed);
  if (!evaluated) {
    return emptySolution(
      "NO_SOLUTION",
      [
        {
          code: "TARGET_UNREACHABLE_AT_MD",
          message: "Unable to compute a finite curved recovery path.",
        },
      ],
      { remainingMeasuredDepthM, straightDistanceM },
    );
  }

  const converged =
    evaluated.residualM <= CURVED_SOLVER_POSITION_TOLERANCE_M &&
    (evaluated.attitudeResidual === undefined ||
      (Math.abs(evaluated.attitudeResidual.dipDegrees) <=
        CURVED_SOLVER_ATTITUDE_TOLERANCE_DEG &&
        Math.abs(evaluated.attitudeResidual.azimuthDegrees) <=
          CURVED_SOLVER_ATTITUDE_TOLERANCE_DEG));

  if (!converged) {
    warnings.push({
      code: "POSITION_RESIDUAL",
      message: `Numerical endpoint residual ${evaluated.residualM.toFixed(2)} m (tolerance ${CURVED_SOLVER_POSITION_TOLERANCE_M.toFixed(2)} m). Target radius ${target.radiusM.toFixed(2)} m.`,
    });
    if (evaluated.attitudeResidual) {
      warnings.push({
        code: "ATTITUDE_RESIDUAL",
        message: `Endpoint attitude residual dip ${evaluated.attitudeResidual.dipDegrees.toFixed(1)}°, azimuth ${evaluated.attitudeResidual.azimuthDegrees.toFixed(1)}°.`,
      });
    }
  }

  if (evaluated.maxDoglegPer30m > CURVED_SOLVER_REVIEW_DLS_PER_30M) {
    warnings.push({
      code: "SHARP_CURVATURE",
      message:
        "REVIEW CURVATURE\n\nA geometric path was found, but the required curvature may exceed practical steering capability.",
    });
  }

  let nextSurveyTarget: CurvedTargetSolution["nextSurveyTarget"] = null;
  if (
    input.nextSurveyMeasuredDepthM === undefined ||
    !Number.isFinite(input.nextSurveyMeasuredDepthM)
  ) {
    warnings.push({
      code: "MISSING_NEXT_SURVEY_DEPTH",
      message: "Survey interval required before next-Survey KPIs can be calculated.",
    });
  } else {
    const nextMd = clampTrajectory(
      input.nextSurveyMeasuredDepthM,
      current.measuredDepthM,
      target.measuredDepthM,
    );
    const position = getTrajectoryPositionAtMeasuredDepth(
      evaluated.stationInputs,
      {
        eastingM: current.eastingM,
        northingM: current.northingM,
        rlM: current.rlM,
        coordinateMode: "MINE_GRID",
        calculationNorthReference: input.calculationReference,
      },
      nextMd,
    );
    if (position) {
      nextSurveyTarget = {
        measuredDepthM: nextMd,
        dipDegrees: position.dipDegrees,
        azimuthDegrees: normalizeAzimuthDegrees(position.azimuthDegrees),
      };
    }
  }

  const path = evaluated.stations.map(toSolutionStation);
  const status: CurvedTargetSolutionStatus = !converged
    ? "NO_SOLUTION"
    : evaluated.maxDoglegPer30m > CURVED_SOLVER_REVIEW_DLS_PER_30M
      ? "REVIEW_REQUIRED"
      : "SOLVED";

  // Sanity: dogleg between start and first control should be finite
  void doglegDegrees(
    vectorFromDipAz(current.dipDegrees, current.azimuthDegrees),
    vectorFromDipAz(path[1]?.dipDegrees ?? current.dipDegrees, path[1]?.azimuthDegrees ?? current.azimuthDegrees),
  );

  return {
    status,
    path,
    pathStations: evaluated.stations,
    nextSurveyTarget,
    endpoint: toSolutionStation(evaluated.endpoint),
    targetResidualM: evaluated.residualM,
    targetAttitudeResidual: evaluated.attitudeResidual,
    remainingMeasuredDepthM,
    straightDistanceM,
    maximumDoglegDegrees: evaluated.maxDogleg,
    maximumDoglegPer30mDegrees: evaluated.maxDoglegPer30m,
    solverConverged: converged,
    engineVersion: TRAJECTORY_ENGINE_VERSION,
    solverVersion: CURVED_TARGET_SOLVER_VERSION,
    warnings,
  };
}

export function circularAzimuthChangeDegrees(
  current: number,
  required: number,
): number {
  return shortestAzimuthDifferenceDegrees(current, required);
}

export { circularAzimuthDifferenceDegrees };
