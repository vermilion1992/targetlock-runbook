"use client";

import { Share2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getShiftRunGroups,
  loadShiftAnalytics,
  type ShiftRunGroup,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatMetres, type AuditEntry, type ShiftAnalytics } from "@/domain";
import { targetLockStage2Seed } from "@/infrastructure/seed";

import { ShiftDetailAnalyticsSections } from "./shift-analytics-panels";

export function ShiftDetail({
  holeId,
  shiftId,
}: {
  holeId: string;
  shiftId: string;
}) {
  const [group, setGroup] = useState<ShiftRunGroup | null>(null);
  const [audits, setAudits] = useState<readonly AuditEntry[]>([]);
  const [analytics, setAnalytics] = useState<ShiftAnalytics | null>(null);
  const [message, setMessage] = useState("Loading shift…");

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
      services.audits.listByEntity(holeId, "shift", shiftId),
      services.shiftAnalytics
        ? loadShiftAnalytics(holeId, shiftId, services.shiftAnalytics, {
            includeActiveComponentHandoverItems: true,
          })
        : Promise.resolve(null),
    ])
      .then(([shifts, runs, entries, nextAnalytics]) => {
        if (runs.status === "invalid") throw new Error(runs.reason);
        const next = getShiftRunGroups({
          shifts,
          seedRuns: targetLockStage2Seed.runs,
          localRuns: runs.snapshots,
        }).find(({ shift }) => shift.localId === shiftId);
        if (next === undefined) throw new Error("The shift was not found.");
        setGroup(next);
        setAudits(entries);
        setAnalytics(nextAnalytics);
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Shift detail could not be loaded.",
        ),
      );
  }, [holeId, shiftId]);

  if (group === null) return <p role="status">{message}</p>;
  const { shift, runs } = group;

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="shift-detail">
      <StagePageHeader
        eyebrow="Stage 2 · shift detail"
        title={`${shift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} — ${shift.shiftDate}`}
        description={`Primary driller: ${shift.primaryDrillerNameSnapshot}`}
        backTarget={namedBackTarget(runbookRoutes.shifts(holeId), "Shifts")}
        action={
          <StatusPill
            tone={
              shift.status === "OPEN"
                ? "success"
                : shift.status === "HANDOVER_PENDING"
                  ? "warning"
                  : "neutral"
            }
          >
            {shift.status.replaceAll("_", " ")}
          </StatusPill>
        }
      />

      {shift.status === "OPEN" || shift.status === "HANDOVER_PENDING" ? (
        <div className="flex flex-wrap gap-2">
          {shift.status === "OPEN" ? (
            <Link
              href={runbookRoutes.closeShift(holeId, shift.localId)}
              className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-warning)] px-4 font-bold text-black no-underline"
            >
              Close shift
            </Link>
          ) : null}
          {shift.status === "HANDOVER_PENDING" ? (
            <Link
              href={runbookRoutes.handover(holeId)}
              className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white no-underline"
            >
              Accept handover
            </Link>
          ) : null}
        </div>
      ) : null}

      {analytics ? (
        <ShiftDetailAnalyticsSections analytics={analytics} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionPanel
          title="Starting snapshot"
          description={formatFieldDateTime(shift.startedAt)}
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricDisplay
              label="Depth"
              value={formatMetres(shift.startingDepthDm)}
            />
            <MetricDisplay label="Run number" value={shift.startingRunNumber} />
            <MetricDisplay label="Rod number" value={shift.startingRodNumber} />
            <MetricDisplay
              label="R/S"
              value={formatMetres(shift.startingRodStringDm)}
            />
            <MetricDisplay
              label="Stick-up"
              value={
                shift.startingMeasuredStickUpDm === undefined
                  ? "Not entered"
                  : formatMetres(shift.startingMeasuredStickUpDm)
              }
            />
          </div>
        </SectionPanel>
        <SectionPanel
          title="Ending snapshot"
          description={
            shift.closedAt
              ? formatFieldDateTime(shift.closedAt)
              : "Shift remains open"
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricDisplay
              label="Depth"
              value={
                shift.endingDepthDm === undefined
                  ? "Open"
                  : formatMetres(shift.endingDepthDm)
              }
            />
            <MetricDisplay
              label="Last completed run"
              value={shift.endingRunNumber ?? "—"}
            />
            <MetricDisplay
              label="Rod number"
              value={shift.endingRodNumber ?? "—"}
            />
            <MetricDisplay
              label="R/S"
              value={
                shift.endingRodStringDm === undefined
                  ? "—"
                  : formatMetres(shift.endingRodStringDm)
              }
            />
            <MetricDisplay
              label="Stick-up"
              value={
                shift.endingMeasuredStickUpDm === undefined
                  ? "Not entered"
                  : formatMetres(shift.endingMeasuredStickUpDm)
              }
            />
          </div>
        </SectionPanel>
      </div>

      <SectionPanel
        title="Crew"
        description="Lightweight shift snapshots; no employee management."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {shift.crewMembers.map((member, index) => (
            <li
              key={`${member.userId ?? member.name}-${index}`}
              className="flex min-h-12 items-center gap-3 rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] px-4"
            >
              <UserRound aria-hidden="true" className="size-5" />
              <span>
                <strong>{member.name}</strong>
                {member.role ? ` · ${member.role}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </SectionPanel>

      <SectionPanel
        title={`Runs (${runs.length})`}
        description="Shared runs are grouped under the shift that completed them."
      >
        <div className="space-y-2">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={runbookRoutes.runDetail(holeId, run.id)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] px-4 no-underline"
            >
              <span className="font-bold">Run {run.runNumber}</span>
              <span className="flex items-center gap-3">
                {run.shared ? (
                  <StatusPill tone="info">
                    <Share2 aria-hidden="true" className="size-4" />
                    Shared run
                  </StatusPill>
                ) : null}
                <span className="tl-tabular">
                  {formatMetres(run.holeDepthDm)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel
        title="Handover"
        description="Acceptance and operational note."
      >
        <p>{shift.handoverNote || "No handover note supplied."}</p>
        <p className="mt-3 text-sm text-[var(--tl-ink-muted)]">
          {shift.handoverAcceptedAt
            ? `Accepted by ${shift.handoverAcceptedByNameSnapshot} at ${formatFieldDateTime(shift.handoverAcceptedAt)}`
            : "Not yet accepted."}
        </p>
      </SectionPanel>

      <SectionPanel
        title="Audit history"
        description="Immutable local records suitable for later synchronisation."
      >
        {audits.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            No local audit entries for this shift.
          </p>
        ) : (
          <ol className="space-y-2">
            {audits.map((entry) => (
              <li
                key={entry.localId}
                className="rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] p-3"
              >
                <strong>{entry.action.replaceAll("_", " ")}</strong>
                <p className="text-sm text-[var(--tl-ink-muted)]">
                  {entry.userNameSnapshot} ·{" "}
                  {formatFieldDateTime(entry.timestamp)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </SectionPanel>
    </div>
  );
}
