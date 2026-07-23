import { decimetres, decimetresToMetres, type Decimetres } from "./measurements";
import {
  addVec,
  clampTrajectory,
  dipAzFromVector,
  doglegDegrees,
  minCurveDisplacement,
  slerpDirection,
  TRAJECTORY_EPS,
  vectorFromDipAz,
} from "./trajectory-geometry";
import {
  TRAJECTORY_ENGINE_VERSION,
  type CalculatedTrajectory,
  type CalculatedTrajectoryPosition,
  type CalculatedTrajectoryStation,
  type TrajectoryBoundingBox,
  type TrajectoryCalculationOptions,
  type TrajectoryCollar,
  type TrajectoryStationInput,
  type TrajectoryWarning,
} from "./trajectory-types";

const DEFAULT_RENDER_SEGMENT_DM = decimetres(50);

function tenthsToDegrees(tenths: number): number {
  return tenths / 10;
}

function assertFiniteStation(station: CalculatedTrajectoryStation): void {
  const values = [
    station.measuredDepthM,
    station.dipDegrees,
    station.azimuthDegrees,
    station.relativeEastingM,
    station.relativeNorthingM,
    station.verticalDisplacementM,
    station.tvdM,
    station.eastingM,
    station.northingM,
    station.rlM,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("Trajectory calculation produced a non-finite value.");
  }
}

function boundingBoxOf(
  stations: readonly CalculatedTrajectoryStation[],
): TrajectoryBoundingBox {
  const eastings = stations.map((s) => s.eastingM);
  const northings = stations.map((s) => s.northingM);
  const rls = stations.map((s) => s.rlM);
  return {
    minEastingM: Math.min(...eastings),
    maxEastingM: Math.max(...eastings),
    minNorthingM: Math.min(...northings),
    maxNorthingM: Math.max(...northings),
    minRlM: Math.min(...rls),
    maxRlM: Math.max(...rls),
  };
}

function toCalculatedStation(input: {
  index: number;
  sourceType: CalculatedTrajectoryStation["sourceType"];
  sourceId?: string;
  measuredDepthM: number;
  dipDegrees: number;
  azimuthDegrees: number;
  northReference: CalculatedTrajectoryStation["northReference"];
  relativeEastingM: number;
  relativeNorthingM: number;
  relativeDownM: number;
  collar: TrajectoryCollar;
  doglegDegreesFromPrevious?: number;
}): CalculatedTrajectoryStation {
  const verticalDisplacementM = -input.relativeDownM;
  const station: CalculatedTrajectoryStation = {
    index: input.index,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    measuredDepthM: input.measuredDepthM,
    dipDegrees: input.dipDegrees,
    azimuthDegrees: input.azimuthDegrees,
    northReference: input.northReference,
    relativeEastingM: input.relativeEastingM,
    relativeNorthingM: input.relativeNorthingM,
    verticalDisplacementM,
    tvdM: input.relativeDownM,
    eastingM: input.collar.eastingM + input.relativeEastingM,
    northingM: input.collar.northingM + input.relativeNorthingM,
    rlM: input.collar.rlM + verticalDisplacementM,
    doglegDegreesFromPrevious: input.doglegDegreesFromPrevious,
  };
  assertFiniteStation(station);
  return station;
}

function mapSourceType(
  sourceType: TrajectoryStationInput["sourceType"],
): CalculatedTrajectoryStation["sourceType"] {
  if (sourceType === "PLANNED") return "PLANNED";
  if (sourceType === "SURVEY") return "SURVEY";
  return "COLLAR";
}

/**
 * Build analytical stations via minimum curvature.
 * Relative down (d) is positive below collar — TVD.
 * Vertical displacement / RL use opposite sign of d.
 */
export function buildMinimumCurvatureStations(
  collar: TrajectoryCollar,
  stations: readonly TrajectoryStationInput[],
): CalculatedTrajectoryStation[] {
  if (stations.length === 0) return [];

  const result: CalculatedTrajectoryStation[] = [];
  let position = { e: 0, n: 0, d: 0 };

  stations.forEach((station, index) => {
    const dip = tenthsToDegrees(station.dipTenths);
    const azimuth = tenthsToDegrees(station.calculationAzimuthTenths);

    if (index > 0) {
      const previous = stations[index - 1]!;
      const lengthM = Math.max(
        0,
        decimetresToMetres(station.measuredDepthDm) -
          decimetresToMetres(previous.measuredDepthDm),
      );
      const displacement = minCurveDisplacement(
        {
          dip: tenthsToDegrees(previous.dipTenths),
          azimuth: tenthsToDegrees(previous.calculationAzimuthTenths),
        },
        { dip, azimuth },
        lengthM,
      );
      position = addVec(position, displacement);
    }

    const previous = stations[index - 1];
    const dogleg = previous
      ? doglegDegrees(
          vectorFromDipAz(
            tenthsToDegrees(previous.dipTenths),
            tenthsToDegrees(previous.calculationAzimuthTenths),
          ),
          vectorFromDipAz(dip, azimuth),
        )
      : undefined;

    result.push(
      toCalculatedStation({
        index,
        sourceType: mapSourceType(station.sourceType),
        sourceId: station.sourceId,
        measuredDepthM: decimetresToMetres(station.measuredDepthDm),
        dipDegrees: dip,
        azimuthDegrees: azimuth,
        northReference: station.calculationNorthReference,
        relativeEastingM: position.e,
        relativeNorthingM: position.n,
        relativeDownM: position.d,
        collar,
        doglegDegreesFromPrevious: dogleg,
      }),
    );
  });

  return result;
}

/**
 * Position at MD along the MC path through the input stations.
 * Uses slerp mid-station insertion (IQ `positionOnPlanAtMd`) so coordinates
 * follow the curve rather than linear E/N/D chords between endpoints.
 */
export function getTrajectoryPositionAtMeasuredDepth(
  stations: readonly TrajectoryStationInput[],
  collar: TrajectoryCollar,
  measuredDepthM: number,
): CalculatedTrajectoryPosition | null {
  if (stations.length === 0) return null;

  const first = stations[0]!;
  const firstMd = decimetresToMetres(first.measuredDepthDm);
  if (measuredDepthM <= firstMd + TRAJECTORY_EPS) {
    const built = buildMinimumCurvatureStations(collar, [first])[0]!;
    return positionFromStation(built, false);
  }

  let upperIdx = 1;
  while (
    upperIdx < stations.length &&
    decimetresToMetres(stations[upperIdx]!.measuredDepthDm) <
      measuredDepthM - TRAJECTORY_EPS
  ) {
    upperIdx += 1;
  }

  if (upperIdx >= stations.length) {
    const built = buildMinimumCurvatureStations(collar, stations);
    return extrapolateBeyondEndpoint(built, collar, measuredDepthM);
  }

  const upper = stations[upperIdx]!;
  const lower = stations[upperIdx - 1]!;
  const upperMd = decimetresToMetres(upper.measuredDepthDm);
  const lowerMd = decimetresToMetres(lower.measuredDepthDm);

  if (Math.abs(upperMd - measuredDepthM) < TRAJECTORY_EPS) {
    const built = buildMinimumCurvatureStations(
      collar,
      stations.slice(0, upperIdx + 1),
    );
    return positionFromStation(built.at(-1)!, false);
  }
  if (Math.abs(lowerMd - measuredDepthM) < TRAJECTORY_EPS) {
    const built = buildMinimumCurvatureStations(
      collar,
      stations.slice(0, upperIdx),
    );
    return positionFromStation(built.at(-1)!, false);
  }

  const span = upperMd - lowerMd;
  const t = clampTrajectory((measuredDepthM - lowerMd) / span, 0, 1);
  const aim = dipAzFromVector(
    slerpDirection(
      vectorFromDipAz(
        tenthsToDegrees(lower.dipTenths),
        tenthsToDegrees(lower.calculationAzimuthTenths),
      ),
      vectorFromDipAz(
        tenthsToDegrees(upper.dipTenths),
        tenthsToDegrees(upper.calculationAzimuthTenths),
      ),
      t,
    ),
  );

  const midDepthDm = Math.round(measuredDepthM * 10);
  const mid: TrajectoryStationInput = {
    sourceType: "PLANNED",
    measuredDepthDm: decimetres(Math.max(0, midDepthDm)),
    dipTenths: Math.round(aim.dip * 10),
    originalAzimuthTenths: Math.round(aim.azimuth * 10) % 3600,
    originalNorthReference: lower.calculationNorthReference,
    calculationAzimuthTenths: Math.round(aim.azimuth * 10) % 3600,
    calculationNorthReference: lower.calculationNorthReference,
  };

  // Prefer exact MD metres over dm rounding for the mid station build.
  const prefix = stations.slice(0, upperIdx);
  const builtPrefix = buildMinimumCurvatureStations(collar, prefix);
  const lowerBuilt = builtPrefix.at(-1)!;
  const lengthM = measuredDepthM - lowerMd;
  const displacement = minCurveDisplacement(
    { dip: lowerBuilt.dipDegrees, azimuth: lowerBuilt.azimuthDegrees },
    { dip: aim.dip, azimuth: aim.azimuth },
    lengthM,
  );
  const relativeEastingM = lowerBuilt.relativeEastingM + displacement.e;
  const relativeNorthingM = lowerBuilt.relativeNorthingM + displacement.n;
  const relativeDownM = lowerBuilt.tvdM + displacement.d;
  const verticalDisplacementM = -relativeDownM;

  void mid;

  return {
    measuredDepthM,
    dipDegrees: aim.dip,
    azimuthDegrees: aim.azimuth,
    northReference: lower.calculationNorthReference,
    relativeEastingM,
    relativeNorthingM,
    verticalDisplacementM,
    tvdM: relativeDownM,
    eastingM: collar.eastingM + relativeEastingM,
    northingM: collar.northingM + relativeNorthingM,
    rlM: collar.rlM + verticalDisplacementM,
    beyondEndpoint: false,
  };
}

function positionFromStation(
  station: CalculatedTrajectoryStation,
  beyondEndpoint: boolean,
): CalculatedTrajectoryPosition {
  return {
    measuredDepthM: station.measuredDepthM,
    dipDegrees: station.dipDegrees,
    azimuthDegrees: station.azimuthDegrees,
    northReference: station.northReference,
    relativeEastingM: station.relativeEastingM,
    relativeNorthingM: station.relativeNorthingM,
    verticalDisplacementM: station.verticalDisplacementM,
    tvdM: station.tvdM,
    eastingM: station.eastingM,
    northingM: station.northingM,
    rlM: station.rlM,
    beyondEndpoint,
  };
}

function extrapolateBeyondEndpoint(
  built: readonly CalculatedTrajectoryStation[],
  collar: TrajectoryCollar,
  measuredDepthM: number,
): CalculatedTrajectoryPosition {
  const last = built.at(-1)!;
  const extra = measuredDepthM - last.measuredDepthM;
  const vector = vectorFromDipAz(last.dipDegrees, last.azimuthDegrees);
  const relativeEastingM = last.relativeEastingM + vector.e * extra;
  const relativeNorthingM = last.relativeNorthingM + vector.n * extra;
  const relativeDownM = last.tvdM + vector.d * extra;
  const verticalDisplacementM = -relativeDownM;
  return {
    measuredDepthM,
    dipDegrees: last.dipDegrees,
    azimuthDegrees: last.azimuthDegrees,
    northReference: last.northReference,
    relativeEastingM,
    relativeNorthingM,
    verticalDisplacementM,
    tvdM: relativeDownM,
    eastingM: collar.eastingM + relativeEastingM,
    northingM: collar.northingM + relativeNorthingM,
    rlM: collar.rlM + verticalDisplacementM,
    beyondEndpoint: true,
  };
}

function sampleRenderPath(
  stations: readonly TrajectoryStationInput[],
  collar: TrajectoryCollar,
  analytical: readonly CalculatedTrajectoryStation[],
  maximumRenderSegmentDm: Decimetres,
): CalculatedTrajectoryStation[] {
  if (analytical.length === 0) return [];
  if (analytical.length === 1) return [...analytical];

  const maxSegmentM = decimetresToMetres(maximumRenderSegmentDm);
  const path: CalculatedTrajectoryStation[] = [];
  let index = 0;

  for (let i = 0; i < analytical.length; i += 1) {
    const station = analytical[i]!;
    if (i === 0) {
      path.push({ ...station, index: index++ });
      continue;
    }

    const previous = analytical[i - 1]!;
    const spanM = station.measuredDepthM - previous.measuredDepthM;
    const steps = Math.max(1, Math.ceil(spanM / maxSegmentM));

    for (let step = 1; step < steps; step += 1) {
      const md = previous.measuredDepthM + (spanM * step) / steps;
      const position = getTrajectoryPositionAtMeasuredDepth(
        stations,
        collar,
        md,
      );
      if (position === null) continue;
      path.push(
        toCalculatedStation({
          index: index++,
          sourceType: "INTERPOLATED",
          measuredDepthM: position.measuredDepthM,
          dipDegrees: position.dipDegrees,
          azimuthDegrees: position.azimuthDegrees,
          northReference: position.northReference,
          relativeEastingM: position.relativeEastingM,
          relativeNorthingM: position.relativeNorthingM,
          relativeDownM: position.tvdM,
          collar,
        }),
      );
    }

    path.push({ ...station, index: index++ });
  }

  return path;
}

export function calculateMinimumCurvatureTrajectory(
  collar: TrajectoryCollar,
  stations: readonly TrajectoryStationInput[],
  options: TrajectoryCalculationOptions & {
    readonly trajectoryType: "PLANNED" | "ACTUAL";
    readonly holeId: string;
    readonly warnings?: readonly TrajectoryWarning[];
    readonly sourceVersions?: CalculatedTrajectory["sourceVersions"];
  },
): CalculatedTrajectory {
  if (stations.length < 1) {
    throw new RangeError("At least one trajectory station is required.");
  }

  const analytical = buildMinimumCurvatureStations(collar, stations);
  const maximumRenderSegmentDm =
    options.maximumRenderSegmentDm ?? DEFAULT_RENDER_SEGMENT_DM;
  const renderPath = sampleRenderPath(
    stations,
    collar,
    analytical,
    maximumRenderSegmentDm,
  );
  const endpoint = analytical.at(-1)!;
  const lateralDisplacementM = Math.hypot(
    endpoint.relativeEastingM,
    endpoint.relativeNorthingM,
  );

  return {
    trajectoryType: options.trajectoryType,
    holeId: options.holeId,
    coordinateMode: collar.coordinateMode,
    coordinateSystemName: collar.coordinateSystemName,
    northReference: collar.calculationNorthReference,
    desurveyMethod: "MINIMUM_CURVATURE",
    engineVersion: TRAJECTORY_ENGINE_VERSION,
    collar: analytical[0]!,
    stations: analytical,
    renderPath,
    endpoint,
    measuredDepthM: endpoint.measuredDepthM,
    tvdM: endpoint.tvdM,
    eastingDisplacementM: endpoint.relativeEastingM,
    northingDisplacementM: endpoint.relativeNorthingM,
    verticalDisplacementM: endpoint.verticalDisplacementM,
    lateralDisplacementM,
    boundingBox: boundingBoxOf(renderPath),
    warnings: options.warnings ?? [],
    sourceVersions: options.sourceVersions ?? [],
  };
}

/** Convenience: position lookup against an already-calculated trajectory. */
export function getCalculatedTrajectoryPositionAtMeasuredDepth(
  trajectory: CalculatedTrajectory,
  stations: readonly TrajectoryStationInput[],
  measuredDepthM: number,
): CalculatedTrajectoryPosition | null {
  const collar: TrajectoryCollar = {
    eastingM: trajectory.collar.eastingM,
    northingM: trajectory.collar.northingM,
    rlM: trajectory.collar.rlM,
    coordinateMode: trajectory.coordinateMode,
    coordinateSystemName: trajectory.coordinateSystemName,
    calculationNorthReference: trajectory.northReference,
  };
  return getTrajectoryPositionAtMeasuredDepth(stations, collar, measuredDepthM);
}
