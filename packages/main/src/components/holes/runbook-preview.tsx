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
                  <Link key={run.id} href={runbookRoutes.runDetail(holeId, run.id)} className="block rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 no-underline">
                    <div className="flex items-start justify-between">
                      <span className="text-xl font-bold">Run {run.runNumber}</span>
                      {run.shared ? <StatusPill tone="info"><Share2 aria-hidden="true" className="size-4" />Shared run</StatusPill> : null}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-[var(--tl-ink-muted)]">End depth</dt><dd className="font-bold">{formatMetres(run.holeDepthDm)}</dd></div>
                      <div><dt className="text-[var(--tl-ink-muted)]">Recovery</dt><dd className="font-bold">{formatRecoveryPercentage(run.recoveryPercentage)}</dd></div>
                    </dl>
                    <p className="mt-3 text-sm text-[var(--tl-ink-muted)]">
                      Bit {run.activeBitSerialNumberSnapshot ?? "not recorded"} ·
                      Reamer{" "}
                      {run.activeReamerSerialNumberSnapshot ?? "not recorded"}
                    </p>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[54rem] border-collapse text-left">
                  <thead className="text-xs uppercase text-[var(--tl-ink-muted)]">
                    <tr>
                      <th className="px-4 py-3">Run</th>
                      <th className="px-4 py-3">Shift</th>
                      <th className="px-4 py-3 text-right">End depth</th>
                      <th className="px-4 py-3 text-right">Drilled</th>
                      <th className="px-4 py-3 text-right">Recovered</th>
                      <th className="px-4 py-3 text-right">Recovery</th>
                      <th className="px-4 py-3">Bit / reamer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.runs.map((run) => (
                      <tr key={run.id} className="border-t border-[var(--tl-border)]">
                        <th className="px-4 py-3"><Link href={runbookRoutes.runDetail(holeId, run.id)} className="font-bold text-[var(--tl-primary)]">{run.runNumber}</Link></th>
                        <td className="px-4 py-3">{run.shared ? <StatusPill tone="info">Shared</StatusPill> : group.shift.shiftType === "DAY" ? "Day" : "Night"}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.holeDepthDm)}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.drilledLengthDm)}</td>
                        <td className="px-4 py-3 text-right">{formatMetres(run.recoveredLengthDm)}</td>
                        <td className="px-4 py-3 text-right">{formatRecoveryPercentage(run.recoveryPercentage)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="block">
                            {run.activeBitSerialNumberSnapshot ?? "Bit not recorded"}
                          </span>
                          <span className="block text-[var(--tl-ink-muted)]">
                            {run.activeReamerSerialNumberSnapshot ??
                              "Reamer not recorded"}
                          </span>
                        </td>
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
