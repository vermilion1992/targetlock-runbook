"use client";

import { BookOpenCheck, ChevronDown } from "lucide-react";
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
import {
  decimetresToMetres,
  formatMetres,
  formatRecoveryPercentage,
  type Decimetres,
} from "@/domain";
import { targetLockStage3Seed } from "@/infrastructure/seed";
import { getBrowserRuntimeMode } from "@/infrastructure/sync";

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

/** Compact phone columns — no horizontal scroll, no unit suffix. */
export const RUNBOOK_SHIFT_MOBILE_TABLE_HEADERS = [
  { key: "run", label: "Run", title: "Run" },
  { key: "rs", label: "R/S", title: "Rod string" },
  { key: "su", label: "S/U", title: "Stick up" },
  { key: "hd", label: "HD", title: "Hole depth" },
  { key: "d", label: "D", title: "Drilled" },
  { key: "r", label: "R", title: "Recovered" },
] as const;

function formatMetresCompact(value: Decimetres): string {
  return decimetresToMetres(value).toFixed(1);
}

const RIGHT_ALIGNED_RUNBOOK_HEADERS = new Set([
  "Rod string",
  "Stick up",
  "Hole depth",
  "Drilled",
  "Recovered",
  "Recovery",
]);

function RunStatusMarks({
  run,
}: {
  run: ShiftRunGroup["runs"][number];
}) {
  if (run.status === "void") {
    return (
      <StatusPill tone="danger" className="ml-1">
        VOID
      </StatusPill>
    );
  }
  if (run.status === "corrected") {
    return (
      <StatusPill tone="warning" className="ml-1">
        Corr
      </StatusPill>
    );
  }
  if (run.shared) {
    return (
      <span
        className="ml-1 text-[0.65rem] font-bold uppercase text-[var(--tl-primary)]"
        title="Shared across shifts"
      >
        S
      </span>
    );
  }
  return null;
}

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
            seedRuns:
              getBrowserRuntimeMode() === "demo"
                ? targetLockStage3Seed.runs
                : [],
            localRuns: local.snapshots,
          }).filter((group) => group.runs.length > 0),
        );
        setMessage("");
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "The runbook could not be loaded.",
        ),
      );
  }, [holeId]);

  const runCount = groups.reduce((total, group) => total + group.runs.length, 0);
  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Runbook"
        title={`${holeId} runbook`}
        description="Runs remain continuous and are grouped under the shift that completed them."
        action={
          <StatusPill tone="info">
            <BookOpenCheck aria-hidden="true" className="size-4" />
            {runCount} runs
          </StatusPill>
        }
      />
      {message ? (
        <p
          role="status"
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
        >
          {message}
        </p>
      ) : null}

      <div className="space-y-5">
        {groups.map((group, groupIndex) => (
          <section
            key={group.shift.localId}
            aria-labelledby={`shift-group-${group.shift.localId}`}
          >
            <details
              open={groupIndex === 0}
              className="group overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] md:hidden"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 border-b border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-3 py-3">
                <span>
                  <strong
                    id={`shift-group-${group.shift.localId}`}
                    className="block"
                  >
                    {group.shift.shiftType === "DAY" ? "DAY SHIFT" : "NIGHT SHIFT"}{" "}
                    — {group.shift.shiftDate}
                  </strong>
                  <span className="text-sm text-[var(--tl-ink-muted)]">
                    {group.shift.primaryDrillerNameSnapshot} · Runs{" "}
                    {group.firstRunNumber}–{group.lastRunNumber}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <table
                className="w-full table-fixed border-collapse text-left text-sm"
                data-testid="shift-runs-table-mobile"
              >
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[17.2%]" />
                  <col className="w-[17.2%]" />
                  <col className="w-[17.2%]" />
                  <col className="w-[17.2%]" />
                  <col className="w-[17.2%]" />
                </colgroup>
                <thead className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
                  <tr>
                    {RUNBOOK_SHIFT_MOBILE_TABLE_HEADERS.map((header) => (
                      <th
                        key={header.key}
                        title={header.title}
                        scope="col"
                        className="px-2 py-2 text-left"
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.runs.map((run) => (
                    <tr
                      key={run.id}
                      className="border-t border-[var(--tl-border)]"
                      data-testid="shift-run-row-mobile"
                    >
                      <th scope="row" className="px-2 py-2 text-left font-bold">
                        <Link
                          href={runbookRoutes.runDetail(holeId, run.id)}
                          className="text-[var(--tl-primary)] no-underline"
                        >
                          {run.runNumber}
                        </Link>
                        <RunStatusMarks run={run} />
                      </th>
                      <td className="px-2 py-2 text-left tl-tabular">
                        {formatMetresCompact(run.rodStringDm)}
                      </td>
                      <td className="px-2 py-2 text-left tl-tabular">
                        {formatMetresCompact(run.measuredStickUpDm)}
                      </td>
                      <td className="px-2 py-2 text-left tl-tabular">
                        {formatMetresCompact(run.holeDepthDm)}
                      </td>
                      <td className="px-2 py-2 text-left tl-tabular">
                        {formatMetresCompact(run.drilledLengthDm)}
                      </td>
                      <td className="px-2 py-2 text-left tl-tabular">
                        {formatMetresCompact(run.recoveredLengthDm)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {group.shift.handoverNote ? (
                <p className="border-t border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-sm">
                  {group.shift.handoverNote}
                </p>
              ) : null}
            </details>

            <div className="hidden overflow-hidden rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] md:block">
              <header className="flex items-start justify-between gap-4 bg-[var(--tl-surface-raised)] p-4">
                <div>
                  <h2
                    id={`shift-group-${group.shift.localId}-tablet`}
                    className="font-bold"
                  >
                    {group.shift.shiftType === "DAY" ? "DAY SHIFT" : "NIGHT SHIFT"}{" "}
                    — {group.shift.shiftDate}
                  </h2>
                  <p className="text-sm text-[var(--tl-ink-muted)]">
                    Driller: {group.shift.primaryDrillerNameSnapshot} · Runs{" "}
                    {group.firstRunNumber}–{group.lastRunNumber} · Starting{" "}
                    {formatMetres(group.shift.startingDepthDm)} · Ending{" "}
                    {group.shift.endingDepthDm
                      ? formatMetres(group.shift.endingDepthDm)
                      : "open"}
                  </p>
                  {group.shift.handoverNote ? (
                    <p className="mt-2 text-sm">{group.shift.handoverNote}</p>
                  ) : null}
                </div>
                <Link
                  href={runbookRoutes.shiftDetail(holeId, group.shift.localId)}
                  className="min-h-11 shrink-0 font-bold text-[var(--tl-primary)]"
                >
                  Shift detail
                </Link>
              </header>
              <div className="overflow-x-auto" data-testid="shift-runs-scroll">
                <table
                  className="w-full min-w-[72rem] border-collapse text-left"
                  data-testid="shift-runs-table"
                >
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
                      <tr
                        key={run.id}
                        className="border-t border-[var(--tl-border)]"
                      >
                        <th className="px-4 py-3">
                          <Link
                            href={runbookRoutes.runDetail(holeId, run.id)}
                            className="font-bold text-[var(--tl-primary)]"
                          >
                            {run.runNumber}
                          </Link>
                          {run.status === "void" ? (
                            <StatusPill tone="danger" className="ml-2">
                              VOID
                            </StatusPill>
                          ) : run.status === "corrected" ? (
                            <StatusPill tone="warning" className="ml-2">
                              Corrected
                            </StatusPill>
                          ) : null}
                        </th>
                        <td className="px-4 py-3">
                          {run.shared ? (
                            <StatusPill tone="info">Shared</StatusPill>
                          ) : group.shift.shiftType === "DAY" ? (
                            "Day"
                          ) : (
                            "Night"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMetres(run.rodStringDm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMetres(run.measuredStickUpDm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMetres(run.holeDepthDm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMetres(run.drilledLengthDm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMetres(run.recoveredLengthDm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatRecoveryPercentage(run.recoveryPercentage)}
                        </td>
                        {/* Reamer remains in Run history and reports, but this operational table is intentionally bit-only. */}
                        <td className="px-4 py-3 text-sm">
                          {run.activeBitSerialNumberSnapshot ?? "—"}
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
