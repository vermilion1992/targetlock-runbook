"use client";

import { BookOpenCheck, ChevronDown, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getShiftRunGroups,
  type ShiftRunGroup,
} from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatMetres, formatRecoveryPercentage } from "@/domain";
import { targetLockStage3Seed } from "@/infrastructure/seed";

export const RUNBOOK_SHIFT_TABLE_HEADERS = [
  "Run",
  "Shift",
  "Rod string",
  "Stick up",
  "Hole depth",
  "Drilled",
  "Recovered",
  "Recovery",
  "Bit",
] as const;

const RIGHT_ALIGNED_RUNBOOK_HEADERS = new Set([
  "Rod string",
  "Stick up",
  "Hole depth",
  "Drilled",
  "Recovered",
  "Recovery",
]);

export function RunbookPreview({ holeId }: { holeId: string }) {
  const [groups, setGroups] = useState<readonly ShiftRunGroup[]>([]);
  const [message, setMessage] = useState("Loading shift-grouped runbook…");

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
    ])
      .then(([shifts, local]) => {
        if (local.status === "invalid") throw new Error(local.reason);
        setGroups(
          getShiftRunGroups({
            holeId,
            shifts,
            seedRuns: targetLockStage3Seed.runs,
            localRuns: local.snapshots,
          }).filter((group) => group.runs.length > 0),
        );
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "The runbook could not be loaded."),
      );
  }, [holeId]);

  const runCount = groups.reduce((total, group) => total + group.runs.length, 0);
  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 3 · shift-grouped runbook"
        title={`${holeId} runbook`}
        description="Runs remain continuous and are grouped under the shift that completed them."
        action={<StatusPill tone="info"><BookOpenCheck aria-hidden="true" className="size-4" />{runCount} runs</StatusPill>}
      />
      {message ? <p role="status" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4">{message}</p> : null}

      <div className="space-y-5">
        {groups.map((group, groupIndex) => (
          <section key={group.shift.localId} aria-labelledby={`shift-group-${group.shift.localId}`}>
            <details open={groupIndex === 0} className="group md:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
                <span>
                  <strong id={`shift-group-${group.shift.localId}`} className="block">
                    {group.shift.shiftType === "DAY" ? "DAY SHIFT" : "NIGHT SHIFT"} — {group.shift.shiftDate}
                  </strong>
                  <span className="text-sm text-[var(--tl-ink-muted)]">
                    {group.shift.primaryDrillerNameSnapshot} · Runs {group.firstRunNumber}–{group.lastRunNumber}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 space-y-3">
                {group.runs.map((run) => (
                  <Link
                    key={run.id}
                    href={runbookRoutes.runDetail(holeId, run.id)}
                    className="block rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 no-underline"
                    data-testid="shift-run-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xl font-bold">Run {run.runNumber}</span>
                      <span className="flex flex-wrap justify-end gap-2">
                        {run.shared ? (
                          <StatusPill tone="info"><Share2 aria-hidden="true" className="size-4" />Shared</StatusPill>
                        ) : (
                          <span className="pt-1 text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                            {group.shift.shiftType === "DAY" ? "Day" : "Night"}
                          </span>
                        )}
                        {run.status === "void" ? (
                          <StatusPill tone="danger">VOID</StatusPill>
                        ) : run.status === "corrected" ? (
                          <StatusPill tone="warning">Corrected</StatusPill>
                        ) : null}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Rod string</dt><dd className="font-bold tl-tabular">{formatMetres(run.rodStringDm)}</dd></div>
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Stick up</dt><dd className="font-bold tl-tabular">{formatMetres(run.measuredStickUpDm)}</dd></div>
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Hole depth</dt><dd className="font-bold tl-tabular">{formatMetres(run.holeDepthDm)}</dd></div>
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Drilled</dt><dd className="font-bold tl-tabular">{formatMetres(run.drilledLengthDm)}</dd></div>
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Recovered</dt><dd className="font-bold tl-tabular">{formatMetres(run.recoveredLengthDm)}</dd></div>
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Recovery</dt><dd className="font-bold tl-tabular">{formatRecoveryPercentage(run.recoveryPercentage)}</dd></div>
                      <div className="contents"><dt className="text-[var(--tl-ink-muted)]">Bit</dt><dd className="max-w-[13rem] break-all text-right font-bold">{run.activeBitSerialNumberSnapshot ?? "—"}</dd></div>
                    </dl>
                  </Link>
                ))}
                {group.shift.handoverNote ? <p className="rounded-[var(--tl-radius-sm)] bg-[var(--tl-surface-raised)] p-3 text-sm">{group.shift.handoverNote}</p> : null}
                <Link href={runbookRoutes.shiftDetail(holeId, group.shift.localId)} className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]">Shift detail</Link>
              </div>
            </details>

            <div className="hidden overflow-hidden rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] md:block">
              <header className="flex items-start justify-between gap-4 bg-[var(--tl-surface-raised)] p-4">
                <div>
                  <h2 id={`shift-group-${group.shift.localId}-tablet`} className="font-bold">
                    {group.shift.shiftType === "DAY" ? "DAY SHIFT" : "NIGHT SHIFT"} — {group.shift.shiftDate}
                  </h2>
                  <p className="text-sm text-[var(--tl-ink-muted)]">
                    Driller: {group.shift.primaryDrillerNameSnapshot} · Runs {group.firstRunNumber}–{group.lastRunNumber} · Starting {formatMetres(group.shift.startingDepthDm)} · Ending {group.shift.endingDepthDm ? formatMetres(group.shift.endingDepthDm) : "open"}
                  </p>
                  {group.shift.handoverNote ? <p className="mt-2 text-sm">{group.shift.handoverNote}</p> : null}
                </div>
                <Link href={runbookRoutes.shiftDetail(holeId, group.shift.localId)} className="min-h-11 shrink-0 font-bold text-[var(--tl-primary)]">Shift detail</Link>
              </header>
              <div className="overflow-x-auto" data-testid="shift-runs-scroll">
                <table className="w-full min-w-[72rem] border-collapse text-left" data-testid="shift-runs-table">
                  <thead className="text-xs uppercase text-[var(--tl-ink-muted)]">
                    <tr>
                      {RUNBOOK_SHIFT_TABLE_HEADERS.map((header) => (
                        <th
                          key={header}
                          className={`px-4 py-3 ${RIGHT_ALIGNED_RUNBOOK_HEADERS.has(header) ? "text-right" : ""}`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.runs.map((run) => (
                      <tr key={run.id} className="border-t border-[var(--tl-border)]">
                        <th className="px-4 py-3">
                          <Link href={runbookRoutes.runDetail(holeId, run.id)} className="font-bold text-[var(--tl-primary)]">
                            {run.runNumber}
                          </Link>
                          {run.status === "void" ? (
                            <StatusPill tone="danger" className="ml-2">VOID</StatusPill>
                          ) : run.status === "corrected" ? (
                            <StatusPill tone="warning" className="ml-2">Corrected</StatusPill>
                          ) : null}
                        </th>
                        <td className="px-4 py-3">{run.shared ? <StatusPill tone="info">Shared</StatusPill> : group.shift.shiftType === "DAY" ? "Day" : "Night"}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.rodStringDm)}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.measuredStickUpDm)}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.holeDepthDm)}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.drilledLengthDm)}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.recoveredLengthDm)}</td>
                        <td className="px-4 py-3 text-right">{formatRecoveryPercentage(run.recoveryPercentage)}</td>
                        {/* Reamer remains in Run history and reports, but this operational table is intentionally bit-only. */}
                        <td className="px-4 py-3 text-sm">{run.activeBitSerialNumberSnapshot ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>
      <LocalPrototypeNotice />
    </div>
  );
}
