import {
  decimetresToMetres,
  escapeSpreadsheetCell,
  type ReportDocumentData,
  type ReportSnapshot,
} from "@/domain";

// exceljs typings vary by module interop; keep a structural any for workbook ops.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcelWorkbook = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcelWorksheet = any;

function metres(dm: number): number {
  return decimetresToMetres(dm as never);
}

function text(value: unknown): string | number | boolean {
  return escapeSpreadsheetCell(value);
}

function styleHeader(sheet: ExcelWorksheet): void {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.commit();
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
}

function addSheet(
  workbook: ExcelWorkbook,
  name: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers.map((header) => text(header)));
  for (const row of rows) {
    sheet.addRow(row.map((cell) => text(cell)));
  }
  for (let index = 1; index <= headers.length; index += 1) {
    sheet.getColumn(index).width = Math.min(
      36,
      Math.max(12, String(headers[index - 1]).length + 4),
    );
  }
  styleHeader(sheet);
}

export async function generateExcelWorkbook(
  snapshot: ReportSnapshot,
): Promise<Blob> {
  const excelModule = await import("exceljs");
  const ExcelJS =
    "default" in excelModule && excelModule.default
      ? excelModule.default
      : excelModule;
  const data = snapshot.documentData;
  const workbook = new (ExcelJS as { Workbook: new () => ExcelWorkbook }).Workbook();
  workbook.creator = "TargetLock Runbook";
  workbook.created = new Date(snapshot.generatedAt);

  addSheet(
    workbook,
    "Hole Summary",
    [
      "hole_id",
      "project",
      "rig",
      "status",
      "current_or_final_depth_m",
      "planned_depth_m",
      "total_runs",
      "total_drilled_m",
      "total_recovered_m",
      "weighted_recovery_percent",
      "generated_at",
      "report_version",
    ],
    [
      [
        data.holeId,
        data.projectName,
        data.rigName,
        data.holeStatus,
        metres(data.currentOrFinalDepthDm),
        metres(data.plannedDepthDm),
        data.statistics.totalRuns,
        metres(data.statistics.totalDrilledDm),
        metres(data.statistics.totalRecoveredDm),
        data.statistics.weightedRecoveryPercentTenths / 10,
        snapshot.generatedAt,
        snapshot.version,
      ],
    ],
  );

  addSheet(
    workbook,
    "Shifts",
    [
      "shift_id",
      "shift_type",
      "shift_date",
      "primary_driller",
      "crew",
      "starting_depth_m",
      "ending_depth_m",
      "handover_note",
    ],
    data.shifts.map((shift) => [
      shift.shiftId,
      shift.shiftType,
      shift.shiftDate,
      shift.primaryDrillerName,
      shift.crewNames.join("; "),
      metres(shift.startingDepthDm),
      metres(shift.endingDepthDm),
      shift.handoverNote ?? "",
    ]),
  );

  addSheet(
    workbook,
    "Runs",
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

  addSheet(
    workbook,
    "Rod Events",
    ["event_id", "action", "rod_length_m", "recorded_at", "user"],
    data.rodEvents.map((event) => [
      event.eventId,
      event.action,
      metres(event.rodLengthDm),
      event.recordedAt,
      event.userName,
    ]),
  );

  addSheet(
    workbook,
    "Rod Configurations",
    ["summary", "current_rod_state"],
    [[data.rodConfigurationSummary, data.currentRodState]],
  );

  addSheet(
    workbook,
    "Casing",
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

  addComponentSheet(workbook, "Bits", data.bits);
  addComponentSheet(workbook, "Reamers", data.reamers);

  addSheet(
    workbook,
    "Component Assignments",
    [
      "component_type",
      "serial_number",
      "start_depth_m",
      "end_depth_m",
      "status",
      "runs_touched",
      "recovery_or_estimate",
    ],
    [...data.bits, ...data.reamers].map((row) => [
      row.componentType,
      row.serialNumber,
      metres(row.startDepthDm),
      row.endDepthDm === undefined ? "" : metres(row.endDepthDm),
      row.status,
      row.runsTouched,
      row.recoveryOrEstimateLabel,
    ]),
  );

  addSheet(
    workbook,
    "Surveys",
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

  addSheet(
    workbook,
    "Trays",
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

  addSheet(
    workbook,
    "Hole Events",
    ["event"],
    data.significantEvents.map((event) => [event]),
  );

  addSheet(
    workbook,
    "Corrections",
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

  addSheet(
    workbook,
    "Timeline",
    ["entry"],
    data.timelineSummary.map((entry) => [entry]),
  );

  addSheet(
    workbook,
    "Completion",
    [
      "final_status",
      "reason",
      "comment",
      "completed_by",
      "completed_at",
      "warnings",
    ],
    data.completion
      ? [
          [
            data.completion.finalStatus,
            data.completion.reason,
            data.completion.comment ?? "",
            data.completion.completedByName,
            data.completion.completedAt,
            data.completion.warningAcknowledgements.join("; "),
          ],
        ]
      : [],
  );

  // Apply one-decimal number formats on depth columns where present.
  for (const sheet of workbook.worksheets as ExcelWorksheet[]) {
    sheet.eachRow((row: { eachCell: (cb: (cell: { value: unknown; numFmt?: string }) => void) => void }, rowNumber: number) => {
      if (rowNumber === 1) return;
      row.eachCell((cell: { value: unknown; numFmt?: string }) => {
        if (typeof cell.value === "number" && !Number.isInteger(cell.value)) {
          cell.numFmt = "0.0";
        }
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes =
    buffer instanceof ArrayBuffer
      ? buffer
      : Uint8Array.from(buffer as ArrayLike<number>);
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function addComponentSheet(
  workbook: ExcelWorkbook,
  name: string,
  rows: ReportDocumentData["bits"],
): void {
  addSheet(
    workbook,
    name,
    [
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
    rows.map((row) => [
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
}

export const EXCEL_REQUIRED_SHEETS = [
  "Hole Summary",
  "Shifts",
  "Runs",
  "Rod Events",
  "Rod Configurations",
  "Casing",
  "Bits",
  "Reamers",
  "Component Assignments",
  "Surveys",
  "Trays",
  "Hole Events",
  "Corrections",
  "Timeline",
  "Completion",
] as const;
