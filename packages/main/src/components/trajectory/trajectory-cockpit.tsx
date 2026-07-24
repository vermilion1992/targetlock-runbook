"use client";

import { useMemo, useState } from "react";

import {
  buildTrajectoryViewModel,
  crossSectionOffsetM,
  findTrackingPointForSurvey,
  type HoleTrajectoryComparison,
} from "@/domain";

import { TrajectoryCockpitHeader } from "./trajectory-cockpit-header";
import { TrajectoryDetailTabs } from "./trajectory-detail-tabs";
import { TrajectoryMetricStrip } from "./trajectory-metric-strip";
import { TrajectoryStatusPanel } from "./trajectory-status";
import { TrajectorySurveyInspector } from "./trajectory-survey-inspector";
import { TrajectoryWorkspace } from "./trajectory-workspace";

export function TrajectoryCockpit({
  holeId,
  comparison,
  onExportCsv,
}: {
  holeId: string;
  comparison: HoleTrajectoryComparison;
  onExportCsv: () => void;
}) {
  const model = useMemo(
    () => buildTrajectoryViewModel(comparison),
    [comparison],
  );
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(
    comparison.currentTrackingPoint?.actualSurveyId ?? null,
  );

  const selectedPoint =
    (selectedSurveyId
      ? findTrackingPointForSurvey(model, selectedSurveyId)
      : undefined) ?? comparison.currentTrackingPoint;

  const sectionOffset = useMemo(() => {
    if (
      !selectedPoint ||
      model.sectionBearingDegrees === null ||
      !model.collar
    ) {
      return null;
    }
    return crossSectionOffsetM({
      eastingM: selectedPoint.actualPosition.eastingM,
      northingM: selectedPoint.actualPosition.northingM,
      originEastingM: model.collar.eastingM,
      originNorthingM: model.collar.northingM,
      bearingDegrees: model.sectionBearingDegrees,
    });
  }, [selectedPoint, model]);

  return (
    <div className="space-y-3" data-testid="trajectory-cockpit">
      <TrajectoryCockpitHeader
        holeId={holeId}
        comparison={comparison}
        onExportCsv={onExportCsv}
      />

      {!comparison.blocked ? (
        <TrajectoryMetricStrip comparison={comparison} />
      ) : null}

      <TrajectoryStatusPanel comparison={comparison} />

      {!comparison.blocked ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28%)]">
          <TrajectoryWorkspace
            model={model}
            comparison={comparison}
            selectedSurveyId={selectedSurveyId}
            selectedPoint={selectedPoint}
            crossSectionOffsetM={sectionOffset}
            onSelectSurveyId={setSelectedSurveyId}
          />
          <TrajectorySurveyInspector
            point={selectedPoint}
            toleranceConfigured={comparison.toleranceConfigured}
            trackingPoints={comparison.trackingPoints}
            selectedSurveyId={selectedSurveyId}
            onSelectSurveyId={setSelectedSurveyId}
          />
        </div>
      ) : (
        <p role="alert" className="text-sm text-[var(--tl-danger)]">
          Calculation blocked: {comparison.blockReason}
        </p>
      )}

      <TrajectoryDetailTabs
        comparison={comparison}
        onExportCsv={onExportCsv}
      />
    </div>
  );
}
