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

  if (data.shiftAnalytics) {
    const analytics = data.shiftAnalytics;
    addSheet(
      workbook,
      "Shift Analytics",
      ["metric", "value"],
      [
        ["starting_depth_m", metres(analytics.startingDepthDm)],
        ["ending_depth_m", metres(analytics.endingDepthDm)],
        ["metres_completed_m", metres(analytics.metresCompletedDm)],
        ["completed_runs", analytics.completedRunCount],
        ["shared_runs", analytics.sharedRunCount],
        ["voided_runs", analytics.voidedRunCount],
        ["corrections", analytics.runCorrectionCount],
        [
          "average_run_m",
          analytics.averageRunLengthDm === undefined
            ? "Not available"
            : metres(analytics.averageRunLengthDm),
        ],
        [
          "median_run_m",
          analytics.medianRunLengthDm === undefined
            ? "Not available"
            : metres(analytics.medianRunLengthDm),
        ],
        ["total_recovered_m", metres(analytics.totalRecoveredDm)],
        [
          "weighted_recovery_percent",
          analytics.weightedRecoveryTenths === undefined
            ? "Not available"
            : analytics.weightedRecoveryTenths / 10,
        ],
        ["core_loss_m", metres(analytics.totalCoreLossDm)],
        ["core_gain_m", metres(analytics.totalCoreGainDm)],
        ["rods_added_3m", analytics.rodsAdded3m],
        ["rods_added_6m", analytics.rodsAdded6m],
        ["rods_removed", analytics.rodsRemoved],
        ["starting_rod_number", analytics.startingRodNumber],
        ["ending_rod_number", analytics.endingRodNumber],
        ["surveys", analytics.surveyCount],
        ["trays", analytics.trayCount],
        ["casing_events", analytics.casingEventCount],
        ["bit_changes", analytics.bitChangeCount],
        ["reamer_changes", analytics.reamerChangeCount],
        [
          "gross_metres_per_elapsed_hour",
          analytics.grossMetresPerElapsedHourTenths === undefined
            ? "Not available"
            : analytics.grossMetresPerElapsedHourTenths / 10,
        ],
        [
          "unresolved_items",
          analytics.unresolvedItems.join("; ") || "None",
        ],
      ],
    );
  }

  if (data.holeAnalytics) {
    const hole = data.holeAnalytics;
    addSheet(
      workbook,
      "Hole Analytics",
      ["metric", "value"],
      [
        ["calculated_at", hole.calculatedAt],
        ["completion_id", hole.completionId ?? ""],
        ["starting_depth_m", metres(hole.startingDepthDm)],
        ["current_or_final_depth_m", metres(hole.currentOrFinalDepthDm)],
        ["planned_depth_m", metres(hole.plannedDepthDm)],
        ["difference_from_planned_m", hole.differenceFromPlannedDm / 10],
        ["total_drilled_m", metres(hole.totalDrilledDm)],
        ["total_recovered_m", metres(hole.totalRecoveredDm)],
        [
          "weighted_recovery_percent",
          hole.weightedRecoveryTenths === undefined
            ? "Not available"
            : hole.weightedRecoveryTenths / 10,
        ],
        ["core_loss_m", metres(hole.totalCoreLossDm)],
        ["core_gain_m", metres(hole.totalCoreGainDm)],
        ["completed_runs", hole.totalCompletedRuns],
        ["voided_runs", hole.totalVoidedRuns],
        ["corrected_runs", hole.totalCorrectedRuns],
        [
          "average_run_m",
          hole.averageRunLengthDm === undefined
            ? "Not available"
            : metres(hole.averageRunLengthDm),
        ],
        [
          "median_run_m",
          hole.medianRunLengthDm === undefined
            ? "Not available"
            : metres(hole.medianRunLengthDm),
        ],
        ["completed_shifts", hole.completedShifts],
        ["day_shifts", hole.dayShifts],
        ["night_shifts", hole.nightShifts],
        ["shared_runs", hole.sharedRuns],
        [
          "average_metres_per_shift_m",
          hole.averageMetresPerCompletedShiftDm === undefined
            ? "Not available"
            : metres(hole.averageMetresPerCompletedShiftDm),
        ],
        [
          "median_metres_per_shift_m",
          hole.medianMetresPerCompletedShiftDm === undefined
            ? "Not available"
            : metres(hole.medianMetresPerCompletedShiftDm),
        ],
        ["rods_added_3m", hole.rodsAdded3m],
        ["rods_added_6m", hole.rodsAdded6m],
        ["rods_removed", hole.rodsRemoved],
        ["bits_used", hole.bitsUsed],
        ["reamers_used", hole.reamersUsed],
        ["surveys", hole.surveyCount],
        ["trays", hole.trayCount],
      ],
    );

    addSheet(
      workbook,
      "Shift Analytics Hole",
      [
        "shift_id",
        "shift_type",
        "shift_date",
        "metres_completed_m",
        "ending_depth_m",
        "weighted_recovery_percent",
        "amended",
      ],
      hole.shiftRows.map((row) => [
        row.shiftId,
        row.shiftType,
        row.shiftDate,
        metres(row.metresCompletedDm),
        metres(row.endingDepthDm),
        row.weightedRecoveryTenths === undefined
          ? "Not available"
          : row.weightedRecoveryTenths / 10,
        row.analyticsAmended ? "yes" : "no",
      ]),
    );

    addSheet(
      workbook,
      "Run Analytics",
      [
        "run_number",
        "depth_m",
        "drilled_m",
        "recovery_percent",
        "loss_m",
        "gain_m",
      ],
      hole.runRows.map((row) => [
        row.runNumber,
        row.depthDm / 10,
        row.drilledLengthDm / 10,
        row.recoveryPercentTenths / 10,
        row.lossDm / 10,
        row.gainDm / 10,
      ]),
    );

    addSheet(
      workbook,
      "Component Analytics",
      [
        "component_type",
        "serial_number",
        "start_depth_m",
        "end_depth_m",
        "recorded_metres_m",
        "observed_recovery_percent",
        "recovery_estimate_status",
        "partial_boundary_runs",
      ],
      hole.componentRows.map((row) => [
        row.componentType,
        row.serialNumber,
        row.startDepthDm / 10,
        row.endDepthDm / 10,
        row.recordedMetresDm / 10,
        row.observedRecoveryTenths === undefined
          ? "Not available"
          : row.observedRecoveryTenths / 10,
        row.recoveryEstimateStatus,
        row.partialBoundaryRuns,
      ]),
    );

    addSheet(
      workbook,
      "Survey Analytics",
      ["metric", "value"],
      [
        ["survey_count", hole.surveyCount],
        ["mixed_north_references", hole.mixedNorthReferences ? "yes" : "no"],
        [
          "mixed_north_reference_warning",
          hole.mixedNorthReferenceWarning ?? "",
        ],
      ],
    );

    addSheet(
      workbook,
      "Tray Analytics",
      ["metric", "value"],
      [["tray_count", hole.trayCount]],
    );

    addSheet(
      workbook,
      "Record Completeness",
      ["category", "status", "notes"],
      hole.completeness.map((category) => [
        category.category,
        category.status,
        category.notes.join("; "),
      ]),
    );

    addSheet(
      workbook,
      "Chart Summaries",
      ["chart", "summary"],
      hole.chartSummaries.map((item) => [item.chart, item.summary]),
    );
  }

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
