import { decimetres, type Decimetres } from "./measurements";
import type { NorthReference, Survey } from "./models";
import {
  canConvertToCalculationReference,
  convertAzimuthTenths,
  toAzimuthConversionConfig,
  type AzimuthConversionConfig,
} from "./trajectory-references";
import type {
  ActualTrajectoryConfiguration,
  HoleCoordinateConfiguration,
  PlannedHoleTrajectory,
  ReferenceConfiguration,
  TrajectoryStationInput,
  TrajectorySurveySelection,
  TrajectoryWarning,
} from "./trajectory-types";

export class TrajectoryStationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrajectoryStationError";
  }
}

function assertValidDipTenths(value: number): void {
  if (!Number.isInteger(value) || value < -900 || value > 900) {
    throw new TrajectoryStationError(`Invalid dip tenths: ${value}`);
  }
}

function assertValidAzimuthTenths(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 3599) {
    throw new TrajectoryStationError(`Invalid azimuth tenths: ${value}`);
  }
}

function resolveCalculationAzimuth(input: {
  azimuthTenths: number;
  originalReference: NorthReference;
  calculationReference: NorthReference;
  coordinateMode: HoleCoordinateConfiguration["coordinateMode"];
  config: AzimuthConversionConfig | null;
}): number {
  const convertible = canConvertToCalculationReference(
    input.originalReference,
    input.calculationReference,
    input.coordinateMode,
    input.config,
  );
  if (!convertible.ok) {
    throw new TrajectoryStationError(convertible.reason);
  }
  if (
    input.config === null ||
    input.originalReference === input.calculationReference
  ) {
    return input.azimuthTenths;
  }
  return convertAzimuthTenths(
    input.azimuthTenths,
    input.originalReference,
    input.calculationReference,
    input.config,
  );
}

export function validatePlannedStations(
  plan: PlannedHoleTrajectory,
): void {
  if (plan.stations.length < 2) {
    throw new TrajectoryStationError(
      "A planned trajectory requires at least two stations.",
    );
  }
  const first = plan.stations[0]!;
  if (first.measuredDepthDm !== 0) {
    throw new TrajectoryStationError(
      "The first planned station must be at measured depth 0.0 m.",
    );
  }
  let previousDepth = -1;
  const seen = new Set<number>();
  for (const station of plan.stations) {
    assertValidDipTenths(station.dipTenths);
    assertValidAzimuthTenths(station.azimuthTenths);
    const depth = Number(station.measuredDepthDm);
    if (depth < 0 || depth <= previousDepth) {
      throw new TrajectoryStationError(
        "Planned station depths must increase strictly.",
      );
    }
    if (seen.has(depth)) {
      throw new TrajectoryStationError(
        `Duplicate planned station depth at ${depth / 10} m.`,
      );
    }
    seen.add(depth);
    previousDepth = depth;
  }
}

export function buildPlannedTrajectoryStations(
  plan: PlannedHoleTrajectory,
  coordinateConfiguration: HoleCoordinateConfiguration,
  referenceConfiguration?: ReferenceConfiguration | null,
): {
  stations: TrajectoryStationInput[];
  warnings: TrajectoryWarning[];
} {
  validatePlannedStations(plan);
  const calculationReference =
    coordinateConfiguration.calculationNorthReference;
  const config =
    referenceConfiguration === undefined || referenceConfiguration === null
      ? null
      : toAzimuthConversionConfig(referenceConfiguration);
  const warnings: TrajectoryWarning[] = [];
  const mixed = plan.stations.some(
    (station) => station.northReference !== calculationReference,
  );

  if (
    coordinateConfiguration.coordinateMode === "MINE_GRID" &&
    mixed &&
    config === null
  ) {
    throw new TrajectoryStationError(
      "Mine-grid mode requires reference conversion configuration for planned stations.",
    );
  }

  const stations = plan.stations.map((station) => {
    const calculationAzimuthTenths = resolveCalculationAzimuth({
      azimuthTenths: station.azimuthTenths,
      originalReference: station.northReference,
      calculationReference,
      coordinateMode: coordinateConfiguration.coordinateMode,
      config,
    });
    return {
      sourceType: "PLANNED" as const,
      sourceId: station.id,
      measuredDepthDm: station.measuredDepthDm,
      dipTenths: station.dipTenths,
      originalAzimuthTenths: station.azimuthTenths,
      originalNorthReference: station.northReference,
      calculationAzimuthTenths,
      calculationNorthReference: calculationReference,
    };
  });

  if (mixed && config !== null) {
    warnings.push({
      code: "MIXED_REFERENCES_CONVERTED",
      severity: "info",
      message:
        "Planned station azimuths used mixed north references and were converted to the calculation reference.",
    });
  }

  return { stations, warnings };
}

export function resolveSurveySelections(
  holeId: string,
  surveys: readonly Survey[],
  selections: readonly TrajectorySurveySelection[],
): {
  selected: Survey[];
  warnings: TrajectoryWarning[];
  resolvedSelections: TrajectorySurveySelection[];
} {
  const holeSurveys = surveys.filter((survey) => survey.holeId === holeId);
  const byDepth = new Map<number, Survey[]>();
  for (const survey of holeSurveys) {
    const depth = Number(survey.depthDm);
    const list = byDepth.get(depth) ?? [];
    list.push(survey);
    byDepth.set(depth, list);
  }

  const selectionByDepth = new Map(
    selections
      .filter((selection) => selection.holeId === holeId)
      .map((selection) => [Number(selection.depthDm), selection]),
  );

  const warnings: TrajectoryWarning[] = [];
  const selected: Survey[] = [];
  const resolvedSelections: TrajectorySurveySelection[] = [];

  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const depth of depths) {
    const readings = [...(byDepth.get(depth) ?? [])].sort(
      (left, right) =>
        Date.parse(right.recordedAt) - Date.parse(left.recordedAt),
    );
    if (readings.length === 0) continue;

    if (readings.length > 1) {
      warnings.push({
        code: "DUPLICATE_SURVEY_DEPTHS",
        severity: "warning",
        message: `Multiple Survey readings exist at ${depth / 10} m. Trajectory uses one selected reading per depth.`,
      });
    }

    const existing = selectionByDepth.get(depth);
    let chosen = readings[0]!;
    let reason: TrajectorySurveySelection["selectionReason"] = "LATEST_READING";

    if (existing !== undefined) {
      const match = readings.find(
        (reading) => reading.localId === existing.selectedSurveyId,
      );
      if (match === undefined) {
        throw new TrajectoryStationError(
          `Selected Survey ${existing.selectedSurveyId} is missing for depth ${depth / 10} m.`,
        );
      }
      if (match.holeId !== holeId) {
        throw new TrajectoryStationError(
          `Selected Survey ${existing.selectedSurveyId} belongs to another Hole.`,
        );
      }
      chosen = match;
      reason = existing.selectionReason;
    } else if (readings.length > 1) {
      warnings.push({
        code: "LATEST_DUPLICATE_SELECTED",
        severity: "info",
        message: `Latest Survey reading automatically selected at ${depth / 10} m.`,
      });
    }

    selected.push(chosen);
    resolvedSelections.push(
      existing ?? {
        localId: `selection-${holeId}-${depth}`,
        serverId: null,
        syncStatus: "local-only",
        createdAt: chosen.recordedAt,
        updatedAt: chosen.recordedAt,
        deviceId: "derived",
        version: 1,
        holeId,
        depthDm: decimetres(depth),
        selectedSurveyId: chosen.localId,
        selectionReason: reason,
      },
    );
  }

  return { selected, warnings, resolvedSelections };
}

export function buildActualTrajectoryStations(
  configuration: ActualTrajectoryConfiguration,
  surveys: readonly Survey[],
  selections: readonly TrajectorySurveySelection[],
  coordinateConfiguration: HoleCoordinateConfiguration,
  referenceConfiguration?: ReferenceConfiguration | null,
): {
  stations: TrajectoryStationInput[];
  warnings: TrajectoryWarning[];
  selectedSurveys: Survey[];
} {
  assertValidDipTenths(configuration.collarDipTenths);
  assertValidAzimuthTenths(configuration.collarAzimuthTenths);

  const { selected, warnings: selectionWarnings } = resolveSurveySelections(
    configuration.holeId,
    surveys,
    selections,
  );

  const calculationReference =
    coordinateConfiguration.calculationNorthReference;
  const config =
    referenceConfiguration === undefined || referenceConfiguration === null
      ? null
      : toAzimuthConversionConfig(referenceConfiguration);

  const stations: TrajectoryStationInput[] = [];
  const collarAzimuth = resolveCalculationAzimuth({
    azimuthTenths: configuration.collarAzimuthTenths,
    originalReference: configuration.collarNorthReference,
    calculationReference,
    coordinateMode: coordinateConfiguration.coordinateMode,
    config,
  });

  stations.push({
    sourceType: "COLLAR",
    measuredDepthDm: decimetres(0),
    dipTenths: configuration.collarDipTenths,
    originalAzimuthTenths: configuration.collarAzimuthTenths,
    originalNorthReference: configuration.collarNorthReference,
    calculationAzimuthTenths: collarAzimuth,
    calculationNorthReference: calculationReference,
  });

  let previousDepth = 0;
  for (const survey of selected) {
    const depth = Number(survey.depthDm);
    if (depth < 0) {
      throw new TrajectoryStationError("Survey depth cannot be negative.");
    }
    if (depth === 0) {
      // Collar is synthetic; ignore a survey at zero rather than duplicating.
      continue;
    }
    if (depth <= previousDepth) {
      throw new TrajectoryStationError(
        "Selected Survey depths must increase strictly.",
      );
    }
    assertValidDipTenths(survey.dipTenths);
    assertValidAzimuthTenths(survey.azimuthTenths);

    const calculationAzimuthTenths = resolveCalculationAzimuth({
      azimuthTenths: survey.azimuthTenths,
      originalReference: survey.northReference,
      calculationReference,
      coordinateMode: coordinateConfiguration.coordinateMode,
      config,
    });

    stations.push({
      sourceType: "SURVEY",
      sourceId: survey.localId,
      measuredDepthDm: survey.depthDm,
      dipTenths: survey.dipTenths,
      originalAzimuthTenths: survey.azimuthTenths,
      originalNorthReference: survey.northReference,
      calculationAzimuthTenths,
      calculationNorthReference: calculationReference,
    });
    previousDepth = depth;
  }

  if (stations.length < 2) {
    throw new TrajectoryStationError(
      "Actual trajectory requires a collar direction and at least one Survey station.",
    );
  }

  const warnings = [...selectionWarnings];
  const mixed = stations.some(
    (station) => station.originalNorthReference !== calculationReference,
  );
  if (mixed && config !== null) {
    warnings.push({
      code: "MIXED_REFERENCES_CONVERTED",
      severity: "info",
      message:
        "Actual Survey azimuths used mixed north references and were converted to the calculation reference.",
    });
  }

  return { stations, warnings, selectedSurveys: selected };
}

export function buildStraightPlanStations(input: {
  collarDipTenths: number;
  collarAzimuthTenths: number;
  northReference: NorthReference;
  endpointMeasuredDepthDm: Decimetres;
  collarStationId?: string;
  endpointStationId?: string;
}): PlannedHoleTrajectory["stations"] {
  assertValidDipTenths(input.collarDipTenths);
  assertValidAzimuthTenths(input.collarAzimuthTenths);
  if (Number(input.endpointMeasuredDepthDm) <= 0) {
    throw new TrajectoryStationError(
      "Straight plan endpoint measured depth must be greater than 0.",
    );
  }
  return [
    {
      id: input.collarStationId ?? "planned-station-collar",
      measuredDepthDm: decimetres(0),
      dipTenths: input.collarDipTenths,
      azimuthTenths: input.collarAzimuthTenths,
      northReference: input.northReference,
      stationType: "COLLAR",
    },
    {
      id: input.endpointStationId ?? "planned-station-endpoint",
      measuredDepthDm: input.endpointMeasuredDepthDm,
      dipTenths: input.collarDipTenths,
      azimuthTenths: input.collarAzimuthTenths,
      northReference: input.northReference,
      stationType: "PLANNED_ENDPOINT",
    },
  ];
}
