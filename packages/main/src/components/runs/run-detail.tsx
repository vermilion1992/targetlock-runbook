"use client";

import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  decimetres,
  formatMetres,
  isSharedRun,
  type AuditEntry,
  type ComponentType,
  type Decimetres,
  type Run,
  type RunbookShift,
  type Survey,
  type Tray,
} from "@/domain";
import {
  targetLockStage3Seed,
} from "@/infrastructure/seed";
import type {
  RunCorrectionRecord,
  SavedRunSnapshot,
} from "@/infrastructure/drafts";

type DetailRun =
  | { source: "seed"; run: Run }
  | { source: "local"; run: SavedRunSnapshot };

interface RunComponentChange {
  readonly id: string;
  readonly componentType: ComponentType;
  readonly depthDm: Decimetres;
  readonly outgoingSerial: string;
  readonly incomingSerial: string;
  readonly removalReason?: string;
}

export function RunDetail({
  holeId,
  runId,
}: {
  holeId: string;
  runId: string;
}) {
  const [detail, setDetail] = useState<DetailRun | null>(null);
  const [shifts, setShifts] = useState<readonly RunbookShift[]>([]);
  const [audits, setAudits] = useState<readonly AuditEntry[]>([]);
  const [surveys, setSurveys] = useState<readonly Survey[]>([]);
  const [trays, setTrays] = useState<readonly Tray[]>([]);
  const [corrections, setCorrections] = useState<readonly RunCorrectionRecord[]>(
    [],
  );
  const [message, setMessage] = useState("Loading run…");

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      services.shifts.listByHole(holeId),
      Promise.resolve(services.runs.readCompletedRuns(holeId)),
      services.audits.listByHole(holeId),
      services.surveys.listByHole(holeId),
      services.trays.listByHole(holeId),
      services.runCorrections.listByRun(holeId, runId),
    ])
      .then(
        ([
          nextShifts,
          local,
          nextAudits,
          nextSurveys,
          nextTrays,
          nextCorrections,
        ]) => {
        if (local.status === "invalid") throw new Error(local.reason);
        const localRun = local.snapshots.find((run) => run.localId === runId);
        const seedRun = targetLockStage3Seed.runs.find((run) => run.localId === runId);
        if (localRun !== undefined) setDetail({ source: "local", run: localRun });
        else if (seedRun !== undefined) setDetail({ source: "seed", run: seedRun });
        else throw new Error("The run was not found.");
        setShifts(nextShifts);
        setAudits(nextAudits);
        setSurveys(nextSurveys);
        setTrays(nextTrays);
        setCorrections(nextCorrections);
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Run detail could not be loaded."),
      );
  }, [holeId, runId]);

  if (detail === null) return <p role="status">{message}</p>;
  const run = detail.run;
  const runStatus =
    detail.source === "local"
      ? detail.run.status
      : detail.run.status;
  const isVoid = runStatus === "void";
  const isCorrected = runStatus === "corrected" || corrections.length > 0;
  const startedShiftId = run.startedShiftId;
  const completedShiftId = run.completedShiftId;
  const startedShift = shifts.find((shift) => shift.localId === startedShiftId);
  const completedShift = shifts.find((shift) => shift.localId === completedShiftId);
  const shared = isSharedRun({ startedShiftId, completedShiftId });
  const holeDepth =
    detail.source === "seed" ? detail.run.holeDepth : detail.run.holeDepthDm;
  const drilled =
    detail.source === "seed" ? detail.run.drilledLength : detail.run.drilledLengthDm;
  const recovered =
    detail.source === "seed" ? detail.run.recoveredLength : detail.run.recoveredLengthDm;
  const startDepth =
    detail.source === "seed"
      ? detail.run.startDepth
      : detail.run.previousCompletedDepthDm;
  const bitSerial = run.activeBitSerialNumberSnapshot;
  const reamerSerial = run.activeReamerSerialNumberSnapshot;
  const auditedChanges: RunComponentChange[] = audits
    .filter(
      (audit) =>
        (audit.action === "bit_changed" ||
          audit.action === "reamer_changed") &&
        audit.depthDm !== undefined &&
        audit.depthDm > startDepth &&
        audit.depthDm < holeDepth,
    )
    .map((audit) => ({
      id: audit.localId,
      componentType: audit.action === "bit_changed" ? "BIT" : "REAMER",
      depthDm: audit.depthDm!,
      outgoingSerial:
        typeof audit.metadata.outgoingSerialNumber === "string"
          ? audit.metadata.outgoingSerialNumber
          : "Unknown",
      incomingSerial:
        typeof audit.metadata.incomingSerialNumber === "string"
          ? audit.metadata.incomingSerialNumber
          : "Unknown",
      removalReason:
        typeof audit.metadata.removalReason === "string"
          ? audit.metadata.removalReason
          : undefined,
    }));
  const seededChanges: RunComponentChange[] =
    targetLockStage3Seed.componentAssignments
      .filter(
        (assignment) =>
          assignment.holeId === holeId &&
          assignment.startDepthDm > startDepth &&
          assignment.startDepthDm < holeDepth,
      )
      .map((incoming) => {
        const outgoing = targetLockStage3Seed.componentAssignments.find(
          (assignment) =>
            assignment.holeId === holeId &&
            assignment.componentType === incoming.componentType &&
            assignment.endDepthDm === incoming.startDepthDm,
        );
        const serialFor = (componentId: string | undefined) =>
          targetLockStage3Seed.components.find(
            ({ localId }) => localId === componentId,
          )?.serialNumber ?? "Unknown";
        return {
          id: `seed-change-${incoming.localId}`,
          componentType: incoming.componentType,
          depthDm: incoming.startDepthDm,
          incomingSerial: serialFor(incoming.componentId),
          outgoingSerial: serialFor(outgoing?.componentId),
          removalReason: outgoing?.removalReason,
        };
      });
  const auditedChangeKeys = new Set(
    auditedChanges.map(
      (change) => `${change.componentType}-${String(change.depthDm)}`,
    ),
  );
  const changesWithinRun = [
    ...auditedChanges,
    ...seededChanges.filter(
      (change) =>
        !auditedChangeKeys.has(
          `${change.componentType}-${String(change.depthDm)}`,
        ),
    ),
  ].sort((left, right) => {
    if (left.depthDm === right.depthDm) return 0;
    return left.depthDm < right.depthDm ? -1 : 1;
  });
  const relatedSurveys = surveys.filter(
    (survey) => survey.depthDm > startDepth && survey.depthDm <= holeDepth,
  );
  const relatedTrays = trays.filter(
    (tray) =>
      tray.startDepthDm !== undefined &&
      tray.endDepthDm !== undefined &&
      Math.max(tray.startDepthDm, startDepth) <
        Math.min(tray.endDepthDm, holeDepth),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 3 · run and component ownership"
        title={`Run ${run.runNumber}`}
        description={
          isVoid
            ? "Voided — retained for audit history"
            : shared
              ? "Shared between shifts"
              : isCorrected
                ? "Completed and corrected"
                : "Completed within one shift"
        }
        action={
          isVoid ? (
            <StatusPill tone="warning">VOID</StatusPill>
          ) : isCorrected ? (
            <StatusPill tone="warning">Corrected</StatusPill>
          ) : shared ? (
            <StatusPill tone="info">
              <Share2 aria-hidden="true" className="size-4" />
              Shared run
            </StatusPill>
          ) : (
            <StatusPill tone="success">Completed</StatusPill>
          )
        }
      />
      <Link href={runbookRoutes.runbook(holeId)} className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]">
        <ArrowLeft aria-hidden="true" className="size-5" /> Back to runbook
      </Link>
      {!isVoid ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href={runbookRoutes.correctRun(holeId, runId)}
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-bold text-white"
          >
            Correct run
          </Link>
          <Link
            href={runbookRoutes.voidRun(holeId, runId)}
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] px-4 font-bold text-[var(--tl-danger)]"
            aria-label={`Void run ${run.runNumber}`}
          >
            Void run
          </Link>
        </div>
      ) : null}
      {isVoid && detail.source === "local" ? (
        <SectionPanel title="Void record" description="This run is excluded from production, recovery and depth calculations.">
          <p className="font-bold">
            {detail.run.voidReason?.replaceAll("_", " ") ?? "Voided"}
          </p>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Voided by {detail.run.voidedByNameSnapshot ?? "Unknown"}
            {detail.run.voidedAt
              ? ` · ${formatFieldDateTime(detail.run.voidedAt)}`
              : ""}
          </p>
          {detail.run.voidComment ? (
            <p className="mt-2 text-sm">{detail.run.voidComment}</p>
          ) : null}
        </SectionPanel>
      ) : null}
      <SectionPanel title="Shift ownership" description="The starting shift is never overwritten by the completing shift.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Started</p>
            <p className="mt-1 font-bold">{startedShift ? `${startedShift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — ${startedShift.primaryDrillerNameSnapshot}` : run.startedByNameSnapshot}</p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">{formatFieldDateTime(run.startedAt)}</p>
          </div>
          <div className="rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">Completed</p>
            <p className="mt-1 font-bold">{completedShift ? `${completedShift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — ${completedShift.primaryDrillerNameSnapshot}` : run.completedByNameSnapshot}</p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">{run.completedAt ? formatFieldDateTime(run.completedAt) : "In progress"}</p>
          </div>
        </div>
      </SectionPanel>
      <SectionPanel title="Run result" description="Derived from approved integer-decimetre domain calculations.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay label="End depth" value={formatMetres(decimetres(holeDepth))} emphasis="strong" />
          <MetricDisplay label="Drilled" value={formatMetres(decimetres(drilled))} />
          <MetricDisplay label="Recovered" value={formatMetres(decimetres(recovered))} />
          <MetricDisplay label="Rod number" value={run.rodNumber} />
        </div>
      </SectionPanel>
      <SectionPanel
        title="Components"
        description="Start-time serial and casing snapshots stay with this run; within-run changes come from immutable audit records."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricDisplay label="Active bit" value={bitSerial ?? "Not recorded"} />
          <MetricDisplay
            label="Active reamer"
            value={reamerSerial ?? "Not recorded"}
          />
          <MetricDisplay
            label="Casing at run start"
            value={run.casingSummarySnapshot ?? "Not recorded"}
            className="sm:col-span-2"
          />
        </div>
        {changesWithinRun.length > 0 ? (
          <div className="mt-4 space-y-3">
            {changesWithinRun.map(
              ({
                id,
                componentType,
                depthDm,
                incomingSerial,
                outgoingSerial,
                removalReason,
              }) => (
                <article
                  key={id}
                  className="rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4"
                >
                  <h3 className="font-bold text-[var(--tl-ink)]">
                    {componentType === "BIT" ? "Bit" : "Reamer"} changed at{" "}
                    {formatMetres(depthDm)} during this run
                  </h3>
                  <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
                    Outgoing {outgoingSerial} · Incoming {incomingSerial}
                  </p>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    Run interval {formatMetres(decimetres(startDepth))} –{" "}
                    {formatMetres(decimetres(holeDepth))}
                    {removalReason
                      ? ` · Removal reason ${removalReason.replaceAll("_", " ").toLocaleLowerCase("en-AU")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    Recovery remains a run-level estimate; the run was not split.
                  </p>
                </article>
              ),
            )}
          </div>
        ) : null}
      </SectionPanel>
      <SectionPanel
        title="Correction history"
        description="Original values remain preserved. Correction records are immutable."
      >
        {corrections.length === 0 &&
        !(detail.source === "local" && detail.run.originalSnapshot) ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            No corrections have been recorded for this run.
          </p>
        ) : (
          <div className="space-y-3">
            {detail.source === "local" && detail.run.originalSnapshot ? (
              <article className="rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
                <h3 className="font-bold">Original entry</h3>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  Stick-up{" "}
                  {formatMetres(
                    decimetres(detail.run.originalSnapshot.measuredStickUpDm),
                  )}{" "}
                  · Depth{" "}
                  {formatMetres(
                    decimetres(detail.run.originalSnapshot.holeDepthDm),
                  )}{" "}
                  · Recovered{" "}
                  {formatMetres(
                    decimetres(detail.run.originalSnapshot.recoveredLengthDm),
                  )}
                </p>
              </article>
            ) : null}
            {[...corrections]
              .sort((left, right) =>
                left.correctedAt.localeCompare(right.correctedAt),
              )
              .map((correction) => (
                <article
                  key={correction.id}
                  className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
                >
                  <p className="text-sm text-[var(--tl-ink-muted)]">
                    {formatFieldDateTime(correction.correctedAt)} ·{" "}
                    {correction.correctedByNameSnapshot}
                  </p>
                  <h3 className="mt-1 font-bold">
                    {correction.correctionType.replaceAll("_", " ")}
                  </h3>
                  <p className="mt-1 text-sm">
                    {correction.fieldName}: {String(correction.previousValue)} →{" "}
                    {String(correction.correctedValue)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    Reason: {correction.reason}
                  </p>
                  {correction.affectedRunIds.length > 1 ? (
                    <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                      Affected runs: {correction.affectedRunIds.length}
                    </p>
                  ) : null}
                </article>
              ))}
          </div>
        )}
      </SectionPanel>
      <SectionPanel
        title="Related surveys and trays"
        description="Relationships are derived from depth. Tray overlap never allocates recovered metres between photographs."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="font-bold">Surveys</h3>
            {relatedSurveys.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {relatedSurveys.map((survey) => (
                  <li key={survey.localId}>
                    <Link
                      href={runbookRoutes.surveyDetail(holeId, survey.localId)}
                      className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
                    >
                      Survey at {formatMetres(survey.depthDm)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
                No survey falls within this run interval.
              </p>
            )}
          </div>
          <div>
            <h3 className="font-bold">Core from this run appears in</h3>
            {relatedTrays.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {relatedTrays.map((tray) => (
                  <li key={tray.localId}>
                    <Link
                      href={runbookRoutes.trayDetail(holeId, tray.localId)}
                      className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
                    >
                      Tray {tray.trayNumber}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
                No tray depth range overlaps this run.
              </p>
            )}
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
