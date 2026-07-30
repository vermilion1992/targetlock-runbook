import {
  buildCsvDocument,
  CSV_DATASETS_BY_REPORT,
  decimetresToMetres,
  type CsvDatasetName,
  type ReportDocumentData,
  type ReportType,
} from "@/domain";

function metres(dm: number): number {
  return decimetresToMetres(dm as never);
}

export type { CsvDatasetName } from "@/domain";

export function generateCsvDataset(
  dataset: CsvDatasetName,
  data: ReportDocumentData,
): string {
  switch (dataset) {
    case "runs":
      return buildCsvDocument(
        [
          "run_number",
          "rod_number",
          "rod_added_m",
          "rod_string_m",
          "stick_up_m",
          "end_depth_m",
          "drilled_m",
          "recovered_length_m",
          "recovery_percent",
          "shared",
          "shift_label",
        ],
        data.runsheet.map((row) => [
          row.runNumber,
          row.rodNumber,
          metres(row.rodAddedDm),
          metres(row.rodStringDm),
          metres(row.stickUpDm),
          metres(row.holeDepthDm),
          metres(row.drilledDm),
          metres(row.recoveredDm),
          row.recoveryPercentTenths / 10,
          row.shared ? "yes" : "no",
          row.shiftLabel ?? "",
        ]),
      );
    case "shifts":
      return buildCsvDocument(
        [
          "shift_id",
          "shift_type",
          "shift_date",
          "primary_driller",
          "starting_depth_m",
          "ending_depth_m",
          "handover_note",
        ],
        data.shifts.map((shift) => [
          shift.shiftId,
          shift.shiftType,
          shift.shiftDate,
          shift.primaryDrillerName,
          metres(shift.startingDepthDm),
          metres(shift.endingDepthDm),
          shift.handoverNote ?? "",
        ]),
      );
    case "surveys":
      return buildCsvDocument(
        [
          "depth_m",
          "dip_deg",
          "azimuth_deg",
          "north_reference",
          "tool",
          "serial",
          "recorded_at",
          "corrected",
        ],
        data.surveys.map((survey) => [
          metres(survey.depthDm),
          survey.dipTenths / 10,
          survey.azimuthTenths / 10,
          survey.northReference,
          survey.toolName,
          survey.toolSerial,
          survey.recordedAt,
          survey.corrected ? "yes" : "no",
        ]),
      );
    case "trays":
      return buildCsvDocument(
        [
          "tray_number",
          "start_depth_m",
          "end_depth_m",
          "related_runs",
          "photo_date",
          "final_partial",
        ],
        data.trays.map((tray) => [
          tray.trayNumber,
          metres(tray.startDepthDm),
          metres(tray.endDepthDm),
          tray.relatedRunNumbers.join(";"),
          tray.photoDate ?? "",
          tray.finalPartial ? "yes" : "no",
        ]),
      );
    case "casing":
      return buildCsvDocument(
        [
          "casing_id",
          "casing_size",
          "event_type",
          "start_depth_m",
          "end_depth_m",
          "status",
          "comment",
          "user",
          "recorded_at",
        ],
        data.casingEvents.map((event) => [
          event.casingId,
          event.casingSize,
          event.eventType,
          event.startDepthDm === undefined ? "" : metres(event.startDepthDm),
          event.endDepthDm === undefined ? "" : metres(event.endDepthDm),
          event.status,
          event.comment ?? "",
          event.userName,
          event.recordedAt,
        ]),
      );
    case "components":
      return buildCsvDocument(
        [
          "component_type",
          "serial_number",
          "manufacturer",
          "model_or_matrix",
          "size",
          "status",
          "start_depth_m",
          "end_depth_m",
          "recorded_metres_m",
          "runs_touched",
          "recovery_or_estimate",
          "is_estimate",
          "installed_at",
          "removed_at",
          "removal_reason",
        ],
        [...data.bits, ...data.reamers].map((row) => [
          row.componentType,
          row.serialNumber,
          row.manufacturer,
          row.modelOrMatrix,
          row.size,
          row.status,
          metres(row.startDepthDm),
          row.endDepthDm === undefined ? "" : metres(row.endDepthDm),
          metres(row.recordedMetresDm),
          row.runsTouched,
          row.recoveryOrEstimateLabel,
          row.isEstimate ? "yes" : "no",
          row.installedAt,
          row.removedAt ?? "",
          row.removalReason ?? "",
        ]),
      );
    case "corrections":
      return buildCsvDocument(
        [
          "entity_type",
          "entity_id",
          "field_name",
          "previous_value",
          "corrected_value",
          "reason",
          "corrected_by",
          "corrected_at",
        ],
        data.corrections.map((row) => [
          row.entityType,
          row.entityId,
          row.fieldName,
          row.previousValue,
          row.correctedValue,
          row.reason,
          row.correctedByName,
          row.correctedAt,
        ]),
      );
    default: {
      const _exhaustive: never = dataset;
      return String(_exhaustive);
    }
  }
}

export function generateCsvBundle(
  reportType: ReportType,
  data: ReportDocumentData,
): readonly { readonly dataset: CsvDatasetName; readonly content: string }[] {
  return CSV_DATASETS_BY_REPORT[reportType].map((dataset) => ({
    dataset,
    content: generateCsvDataset(dataset, data),
  }));
}
