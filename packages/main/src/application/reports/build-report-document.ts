import {
  calculateComponentUsage,
  calculateCoreLossOrGain,
  calculateShiftAnalytics,
  decimetres,
  formatMetres,
  HOLE_STATUS_LABELS,
  isSharedRun,
  normalizeHoleStatus,
  shiftTypeLabel,
  type Decimetres,
  type HoleCompletionSnapshot,
  type ReportDocumentData,
  type ReportShiftAnalytics,
  type ReportSourceVersion,
  type ReportType,
  type Run,
  type ShiftAnalyticsRun,
} from "@/domain";
import type { HoleCompletionContext } from "@/application/runbook/hole-completion-use-cases";
import type { CasingRepository } from "@/infrastructure/casing";
import type { CompletionRepository } from "@/infrastructure/completion";
import type { SurveyRepository } from "@/infrastructure/surveys";

export interface BuildReportInput {
  readonly holeId: string;
  readonly reportType: ReportType;
  readonly shiftId?: string;
}

export interface BuildReportResult {
  readonly documentData: ReportDocumentData;
  readonly sourceVersions: readonly ReportSourceVersion[];
  readonly holeDepthSnapshotDm: Decimetres;
  readonly holeStatusSnapshot: string;
  readonly shiftId?: string;
  readonly completionSnapshot?: HoleCompletionSnapshot;
}

export interface ReportDocumentBuilderDependencies {
  readonly context: { get(holeId: string): Promise<HoleCompletionContext> };
  readonly completion: CompletionRepository;
  readonly casing: CasingRepository;
  readonly surveys: SurveyRepository;
}

function recoveryTenths(run: Run): number {
  return Math.round(run.recoveryPercentage * 10);
}

function rodAddedDm(run: Run): Decimetres {
  if (run.rodAddedLength !== null) {
    return run.rodAddedLength;
  }
  return decimetres(0);
}

function runToAnalyticsRun(
  run: Run,
  rodEvents: readonly {
    readonly localId: string;
    readonly runId: string | null;
    readonly action: "add" | "remove";
    readonly rodLength: number;
    readonly affectedRodNumber: number;
    readonly rodNumberAfterEvent: number;
  }[],
): ShiftAnalyticsRun {
  return {
    localId: run.localId,
    runNumber: run.runNumber,
    startedShiftId: run.startedShiftId,
    completedShiftId: run.completedShiftId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    drilledLengthDm: run.drilledLength,
    recoveredLengthDm: run.recoveredLength,
    holeDepthDm: run.holeDepth,
    previousCompletedDepthDm: run.previousCompletedDepth,
    status:
      run.status === "void"
        ? "void"
        : run.status === "corrected"
          ? "corrected"
          : run.status === "in_progress"
            ? "in_progress"
            : "completed",
    rodEvents: rodEvents
      .filter((event) => event.runId === run.localId)
      .map((event) => ({
        localId: event.localId,
        action: event.action,
        rodLengthDm: (Number(event.rodLength) === 60 ? 60 : 30) as 30 | 60,
        affectedRodNumber: event.affectedRodNumber,
        rodNumberAfterEvent: event.rodNumberAfterEvent,
        voided: false,
      })),
  };
}

function toReportShiftAnalytics(
  analytics: ReturnType<typeof calculateShiftAnalytics>,
): ReportShiftAnalytics {
  return {
    shiftId: analytics.shiftId,
    startingDepthDm: analytics.startingDepthDm,
    endingDepthDm: analytics.endingDepthDm,
    metresCompletedDm: analytics.metresCompletedDm,
    completedRunCount: analytics.completedRunCount,
    sharedRunCount: analytics.sharedRunCount,
    voidedRunCount: analytics.voidedRunCount,
    runCorrectionCount: analytics.runCorrectionCount,
    averageRunLengthDm: analytics.averageRunLengthDm,
    medianRunLengthDm: analytics.medianRunLengthDm,
    totalRecoveredDm: analytics.totalRecoveredDm,
    weightedRecoveryTenths: analytics.weightedRecoveryTenths,
    totalCoreLossDm: analytics.totalCoreLossDm,
    totalCoreGainDm: analytics.totalCoreGainDm,
    startingRodNumber: analytics.startingRodNumber,
    endingRodNumber: analytics.endingRodNumber,
    rodsAdded3m: analytics.rodsAdded3m,
    rodsAdded6m: analytics.rodsAdded6m,
    rodsRemoved: analytics.rodsRemoved,
    startingRodStringDm: analytics.startingRodStringDm,
    endingRodStringDm: analytics.endingRodStringDm,
    surveyCount: analytics.surveyCount,
    trayCount: analytics.trayCount,
    casingEventCount: analytics.casingEventCount,
    bitChangeCount: analytics.bitChangeCount,
    reamerChangeCount: analytics.reamerChangeCount,
    elapsedMinutes: analytics.elapsedMinutes,
    grossMetresPerElapsedHourTenths:
      analytics.grossMetresPerElapsedHourTenths,
    averageRecordedRunCycleMinutes:
      analytics.averageRecordedRunCycleMinutes,
    medianRecordedRunCycleMinutes: analytics.medianRecordedRunCycleMinutes,
    unresolvedItems: analytics.unresolvedItems.map((item) => item.message),
  };
}

export async function buildReportDocumentData(
  input: BuildReportInput,
  dependencies: ReportDocumentBuilderDependencies,
): Promise<BuildReportResult> {
  const context = await dependencies.context.get(input.holeId);
  if (context.holeId !== input.holeId) {
    throw new Error("Cross-hole isolation violation while building report.");
  }

  const completionRecord = await dependencies.completion.getLatestCompletion(
    input.holeId,
  );
  const completionSnapshot = completionRecord?.snapshot;
  const lifecycle = await dependencies.completion.getLifecycleState(input.holeId);
  const holeStatus = normalizeHoleStatus(
    lifecycle?.hole.status ?? context.hole.status,
  );
  const holeStatusSnapshot = HOLE_STATUS_LABELS[holeStatus];

  const completedRuns = context.completedRuns
    .filter((run) => run.holeId === input.holeId)
    .slice()
    .sort((left, right) => left.runNumber - right.runNumber);

  let runsForReport = completedRuns;
  let shifts = context.shifts
    .filter((shift) => shift.holeId === input.holeId)
    .slice()
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));

  if (input.reportType === "CURRENT_SHIFT_RUNBOOK") {
    const currentShift =
      (input.shiftId
        ? shifts.find((shift) => shift.localId === input.shiftId)
        : null) ??
      shifts.find((shift) => shift.status === "OPEN" || shift.status === "HANDOVER_PENDING") ??
      shifts.at(-1);
    if (currentShift) {
      shifts = [currentShift];
      runsForReport = completedRuns.filter(
        (run) =>
          run.startedShiftId === currentShift.localId ||
          run.completedShiftId === currentShift.localId,
      );
    } else {
      shifts = [];
      runsForReport = [];
    }
  }

  const shiftSections = shifts.map((shift) => {
    const shiftRuns = completedRuns.filter(
      (run) =>
        run.startedShiftId === shift.localId ||
        run.completedShiftId === shift.localId,
    );
    const sharedRunIds = shiftRuns
      .filter((run) => isSharedRun(run))
      .map((run) => run.localId);
    return {
      shiftId: shift.localId,
      shiftType: shift.shiftType,
      shiftDate: shift.shiftDate,
      label: `${shiftTypeLabel(shift.shiftType)} ${shift.shiftDate}`,
      primaryDrillerName: shift.primaryDrillerNameSnapshot,
      crewNames: shift.crewMembers.map((member) => member.name),
      startingDepthDm: shift.startingDepthDm,
      endingDepthDm:
        shift.endingDepthDm ??
        context.currentState.currentDepthDm ??
        shift.startingDepthDm,
      handoverNote: shift.handoverNote,
      runIds: shiftRuns.map((run) => run.localId),
      sharedRunIds,
    };
  });

  const shiftById = new Map(shifts.map((shift) => [shift.localId, shift]));
  const runsheet = runsForReport.map((run) => {
    const shift =
      shiftById.get(run.completedShiftId ?? run.startedShiftId) ??
      context.shifts.find((item) => item.localId === run.startedShiftId);
    return {
      runNumber: run.runNumber,
      runId: run.localId,
      shiftId: shift?.localId,
      shiftLabel: shift
        ? `${shiftTypeLabel(shift.shiftType)} ${shift.shiftDate}`
        : undefined,
      shared: isSharedRun(run),
      rodNumber: run.rodNumber,
      rodAddedDm: rodAddedDm(run),
      rodStringDm: run.rodStringLength,
      stickUpDm: run.measuredStickUp,
      holeDepthDm: run.holeDepth,
      drilledDm: run.drilledLength,
      recoveredDm: run.recoveredLength,
      recoveryPercentTenths: recoveryTenths(run),
    };
  });

  const casingEvents = await dependencies.casing.listEvents(input.holeId);
  const casingRows = casingEvents
    .filter((event) => event.holeId === input.holeId)
    .map((event) => {
      const casing = context.casingStrings.find(
        (item) => item.localId === event.casingStringId,
      );
      return {
        eventId: event.localId,
        casingId: event.casingStringId,
        casingSize: casing?.casingSize ?? "unknown",
        eventType: event.eventType,
        startDepthDm: casing?.startDepthDm,
        endDepthDm: event.newEndDepthDm,
        status: event.newStatus ?? casing?.status ?? "ACTIVE",
        comment: event.comment ?? event.reason,
        userName: event.recordedByNameSnapshot,
        recordedAt: event.recordedAt,
      };
    });

  const componentRows = context.componentAssignments
    .filter((assignment) => assignment.holeId === input.holeId)
    .map((assignment) => {
      const component = context.components.find(
        (item) => item.localId === assignment.componentId,
      );
      const usage = calculateComponentUsage(assignment, completedRuns);
      const isEstimate = usage.recoveryEstimateStatus === "RUN_LEVEL_ESTIMATE";
      const recoveryLabel =
        usage.averageRecoveryPercentTenths === undefined
          ? "Unavailable"
          : isEstimate
            ? `Estimate ${(usage.averageRecoveryPercentTenths / 10).toFixed(1)}% (partial-run limitation)`
            : `${(usage.averageRecoveryPercentTenths / 10).toFixed(1)}%`;
      return {
        assignmentId: assignment.localId,
        componentType: assignment.componentType,
        serialNumber: component?.serialNumber ?? "unknown",
        manufacturer: component?.manufacturer ?? "",
        modelOrMatrix: component?.model ?? component?.matrix ?? "",
        size: component?.size ?? "",
        status: assignment.status,
        startDepthDm: assignment.startDepthDm,
        endDepthDm: assignment.endDepthDm,
        recordedMetresDm: usage.drilledMetresDm,
        runsTouched: usage.runsTouched,
        recoveryOrEstimateLabel: recoveryLabel,
        isEstimate,
        installedAt: assignment.installedAt,
        removedAt: assignment.removedAt,
        removalReason: assignment.removalReason,
      };
    });

  const surveyCorrections = (
    await Promise.all(
      context.surveys.map((survey) =>
        dependencies.surveys.listCorrections(survey.localId),
      ),
    )
  ).flat();

  const depthCounts = new Map<number, number>();
  for (const survey of context.surveys) {
    depthCounts.set(survey.depthDm, (depthCounts.get(survey.depthDm) ?? 0) + 1);
  }
  const duplicateDepthCount = [...depthCounts.values()].filter(
    (count) => count > 1,
  ).length;

  const orderedSurveys = context.surveys
    .filter((survey) => survey.holeId === input.holeId)
    .slice()
    .sort((left, right) => left.depthDm - right.depthDm);
  const gaps: number[] = [];
  for (let index = 1; index < orderedSurveys.length; index += 1) {
    gaps.push(orderedSurveys[index]!.depthDm - orderedSurveys[index - 1]!.depthDm);
  }
  const averageSpacingDm =
    gaps.length === 0
      ? undefined
      : decimetres(Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length));
  const largestGapDm =
    gaps.length === 0 ? undefined : decimetres(Math.max(...gaps));

  const totalDrilledDm = decimetres(
    completedRuns.reduce((sum, run) => sum + run.drilledLength, 0),
  );
  const totalRecoveredDm = decimetres(
    completedRuns.reduce((sum, run) => sum + run.recoveredLength, 0),
  );
  const weightedRecoveryPercentTenths =
    totalDrilledDm === 0
      ? 0
      : Math.round((totalRecoveredDm / totalDrilledDm) * 1_000);
  // Match completion statistics: sum per-run loss and gain separately.
  let totalLoss = 0;
  let totalGain = 0;
  for (const run of completedRuns) {
    const variance = calculateCoreLossOrGain(
      run.drilledLength,
      run.recoveredLength,
    );
    if (variance.kind === "loss") totalLoss += variance.amount;
    if (variance.kind === "gain") totalGain += variance.amount;
  }
  const totalLossDm = decimetres(totalLoss);
  const totalGainDm = decimetres(totalGain);

  const holeDepthSnapshotDm =
    completionSnapshot?.finalDepthDm ??
    context.currentState.currentDepthDm ??
    decimetres(0);

  const plannedDepthDm =
    completionSnapshot?.plannedDepthDm ??
    context.hole.plannedDepth ??
    decimetres(0);

  const currentShift = shiftSections.at(-1);
  let shiftAnalytics: ReportShiftAnalytics | undefined;
  if (
    input.reportType === "CURRENT_SHIFT_RUNBOOK" &&
    currentShift !== undefined
  ) {
    const shiftEntity = shifts.find(
      (shift) => shift.localId === currentShift.shiftId,
    );
    if (shiftEntity !== undefined) {
      const analyticsRuns = context.completedRuns.map((run) =>
        runToAnalyticsRun(run, context.rodEvents),
      );
      shiftAnalytics = toReportShiftAnalytics(
        calculateShiftAnalytics({
          shift: shiftEntity,
          runs: analyticsRuns,
          surveys: context.surveys,
          trays: context.trays,
          casingEvents,
          componentAssignments: context.componentAssignments,
          corrections: [],
          nowIso: new Date().toISOString(),
          liveEndingDepthDm: context.currentState.currentDepthDm,
          liveEndingRodNumber: context.currentState.currentRodNumber,
          liveEndingRodStringDm: context.currentState.currentRodStringDm,
          unfinishedRunNumber: shiftEntity.handoverRunNumber,
          includeActiveComponentHandoverItems: true,
          activeBitSerial: context.currentState.activeBitSerialNumber,
          activeReamerSerial: context.currentState.activeReamerSerialNumber,
          surveyIntervalReminder: context.currentState.surveyIntervalReminder,
        }),
      );
    }
  }
  const latestSurvey = orderedSurveys.at(-1);
  const currentTray = context.trays
    .slice()
    .sort((left, right) => right.trayNumber - left.trayNumber)[0];

  const activeBit = context.componentAssignments.find(
    (assignment) =>
      assignment.componentType === "BIT" && assignment.status === "ACTIVE",
  );
  const activeReamer = context.componentAssignments.find(
    (assignment) =>
      assignment.componentType === "REAMER" && assignment.status === "ACTIVE",
  );

  const disclosures: string[] = [];
  if (componentRows.some((row) => row.isEstimate)) {
    disclosures.push(
      "Some component recovery values are run-level estimates because assignment boundaries fall inside runs.",
    );
  }
  if (surveyCorrections.length > 0) {
    disclosures.push(
      `${surveyCorrections.length} survey correction(s) are disclosed in this report.`,
    );
  }
  if (completionSnapshot?.warningAcknowledgements.length) {
    disclosures.push(
      "Completion warning acknowledgements are included from the Stage 5 completion snapshot.",
    );
  }

  const documentData: ReportDocumentData = {
    holeId: input.holeId,
    holeName: context.hole.name,
    projectName: context.projectName,
    rigName: context.rigName,
    holeStatus: holeStatusSnapshot,
    currentOrFinalDepthDm: holeDepthSnapshotDm,
    plannedDepthDm,
    completion: completionSnapshot
      ? {
          reason: completionSnapshot.reason,
          comment: completionSnapshot.comment,
          completedByName: completionSnapshot.completedByNameSnapshot,
          completedAt: completionSnapshot.capturedAt,
          finalStatus: completionSnapshot.finalStatus,
          warningAcknowledgements:
            completionSnapshot.warningAcknowledgements.map(
              (item) => `${item.checkCode}: ${item.reason}`,
            ),
        }
      : undefined,
    shifts: shiftSections,
    runsheet,
    rodEvents: context.rodEvents.map((event) => ({
      eventId: event.localId,
      action: event.action,
      rodLengthDm: event.rodLength,
      recordedAt: event.occurredAt,
      userName: event.recordedByNameSnapshot,
    })),
    rodConfigurationSummary:
      context.rodConfiguration === null
        ? "No rod configuration recorded."
        : `BHA ${formatMetres(context.rodConfiguration.bottomHoleAssemblyLength)} · constant stick-up ${formatMetres(context.rodConfiguration.constantStickUp)} · base R/S ${formatMetres(context.rodConfiguration.baseRodStringLength)}`,
    currentRodState:
      context.rodProjection === null
        ? `Rod ${context.currentState.currentRodNumber} · R/S ${formatMetres(context.currentState.currentRodStringDm)}`
        : `Rod ${context.rodProjection.rodNumber} · R/S ${formatMetres(context.rodProjection.rodStringDm)} · stick-up ${formatMetres(context.rodProjection.measuredStickUpDm)}`,
    casingSummary:
      context.casingStrings.length === 0
        ? "No casing recorded."
        : context.casingStrings
            .map(
              (casing) =>
                `${casing.casingSize} ${formatMetres(casing.startDepthDm)}–${formatMetres(casing.currentEndDepthDm)} (${casing.status})`,
            )
            .join("; "),
    casingEvents: casingRows,
    bits: componentRows.filter((row) => row.componentType === "BIT"),
    reamers: componentRows.filter((row) => row.componentType === "REAMER"),
    surveys: orderedSurveys.map((survey) => ({
      surveyId: survey.localId,
      depthDm: survey.depthDm,
      dipTenths: survey.dipTenths,
      azimuthTenths: survey.azimuthTenths,
      northReference: survey.northReference,
      toolName: survey.toolNameSnapshot ?? "Unspecified",
      toolSerial: survey.toolSerialSnapshot ?? "",
      recordedAt: survey.recordedAt,
      corrected: surveyCorrections.some(
        (correction) => correction.surveyId === survey.localId,
      ),
    })),
    surveySummary: {
      total: orderedSurveys.length,
      firstDepthDm: orderedSurveys[0]?.depthDm,
      latestDepthDm: latestSurvey?.depthDm,
      averageSpacingDm,
      largestGapDm,
      duplicateDepthCount,
      correctionCount: surveyCorrections.length,
    },
    trays: context.trays
      .filter((tray) => tray.holeId === input.holeId)
      .map((tray) => {
        const startDepthDm = tray.startDepthDm ?? decimetres(0);
        const endDepthDm = tray.endDepthDm ?? startDepthDm;
        return {
          trayId: tray.localId,
          trayNumber: tray.trayNumber,
          startDepthDm,
          endDepthDm,
          relatedRunNumbers: completedRuns
            .filter(
              (run) =>
                run.holeDepth > startDepthDm && run.startDepth < endDepthDm,
            )
            .map((run) => run.runNumber),
          photoDate: tray.recordedAt,
          finalPartial: tray.isFinalPartial,
        };
      }),
    corrections: surveyCorrections.map((correction) => ({
      correctionId: correction.id,
      entityType: "survey",
      entityId: correction.surveyId,
      fieldName: correction.fieldName,
          previousValue: String(correction.previousValue ?? ""),
      correctedValue: String(correction.correctedValue ?? ""),
      reason: correction.reason,
      correctedByName: correction.correctedByNameSnapshot,
      correctedAt: correction.correctedAt,
    })),
    timelineSummary: [
      ...shiftSections.map((shift) => `Shift ${shift.label}`),
      ...runsheet.slice(-5).map((row) => `Run ${row.runNumber} to ${formatMetres(row.holeDepthDm)}`),
    ],
    significantEvents: [
      ...context.casingStrings.map(
        (casing) =>
          `Casing ${casing.casingSize} installed at ${formatMetres(casing.startDepthDm)}`,
      ),
      ...(completionSnapshot
        ? [
            `Hole ${completionSnapshot.finalStatus.toLowerCase()} at ${formatMetres(completionSnapshot.finalDepthDm)}`,
          ]
        : []),
    ],
    statistics: {
      totalRuns: completedRuns.length,
      totalDrilledDm,
      totalRecoveredDm,
      weightedRecoveryPercentTenths,
      totalLossDm,
      totalGainDm,
      surveyCount: orderedSurveys.length,
      trayCount: context.trays.length,
      shiftCount: context.shifts.length,
    },
    activeBitSummary: activeBit
      ? context.components.find((item) => item.localId === activeBit.componentId)
          ?.serialNumber
      : undefined,
    activeReamerSummary: activeReamer
      ? context.components.find(
          (item) => item.localId === activeReamer.componentId,
        )?.serialNumber
      : undefined,
    latestSurveySummary: latestSurvey
      ? `${formatMetres(latestSurvey.depthDm)} · dip ${(latestSurvey.dipTenths / 10).toFixed(1)} · az ${(latestSurvey.azimuthTenths / 10).toFixed(1)}`
      : undefined,
    currentTraySummary: currentTray
      ? `Tray ${currentTray.trayNumber} ${formatMetres(currentTray.startDepthDm ?? decimetres(0))}–${formatMetres(currentTray.endDepthDm ?? currentTray.startDepthDm ?? decimetres(0))}`
      : undefined,
    currentShift,
    shiftAnalytics,
    disclosures,
  };

  const reopenHistory = await dependencies.completion.getReopenHistory(
    input.holeId,
  );

  const sourceVersions: ReportSourceVersion[] = [
    {
      entityType: "hole",
      entityId: context.hole.localId,
      version: context.hole.version,
    },
    ...completedRuns.map((run) => ({
      entityType: "run",
      entityId: run.localId,
      version: run.version,
    })),
    ...context.rodEvents
      .filter((event) => event.holeId === input.holeId)
      .map((event) => ({
        entityType: "rod_event",
        entityId: event.localId,
        version: event.version,
      })),
    ...context.shifts
      .filter((shift) => shift.holeId === input.holeId)
      .map((shift) => ({
        entityType: "shift",
        entityId: shift.localId,
        version: shift.version,
      })),
    ...context.casingStrings
      .filter((casing) => casing.holeId === input.holeId)
      .map((casing) => ({
        entityType: "casing",
        entityId: casing.localId,
        version: casing.version,
      })),
    ...casingEvents
      .filter((event) => event.holeId === input.holeId)
      .map((event) => ({
        entityType: "casing_event",
        entityId: event.localId,
        version: event.version,
      })),
    ...context.componentAssignments
      .filter((assignment) => assignment.holeId === input.holeId)
      .map((assignment) => ({
        entityType: "component_assignment",
        entityId: assignment.localId,
        version: assignment.version,
      })),
    ...context.surveys
      .filter((survey) => survey.holeId === input.holeId)
      .map((survey) => ({
        entityType: "survey",
        entityId: survey.localId,
        version: survey.version,
      })),
    ...context.trays
      .filter((tray) => tray.holeId === input.holeId)
      .map((tray) => ({
        entityType: "tray",
        entityId: tray.localId,
        version: tray.version,
      })),
    ...surveyCorrections.map((correction) => ({
      entityType: "correction",
      entityId: correction.id,
      version: 1,
    })),
    ...(completionRecord
      ? [
          {
            entityType: "completion",
            entityId: completionRecord.localId,
            version: completionRecord.version,
          },
        ]
      : []),
    ...reopenHistory.map((reopen) => ({
      entityType: "reopen",
      entityId: reopen.localId,
      version: reopen.version,
    })),
  ];

  return {
    documentData,
    sourceVersions,
    holeDepthSnapshotDm,
    holeStatusSnapshot,
    shiftId: currentShift?.shiftId,
    completionSnapshot,
  };
}
