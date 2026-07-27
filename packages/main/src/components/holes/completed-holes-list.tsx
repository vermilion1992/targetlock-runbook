"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  createBrowserRunbookServices,
  listCompletedHoles,
} from "@/application/runbook";
import type { CompletedHoleIndexEntry } from "@/infrastructure/completion";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatusPill } from "@/components/field/status-pill";
import {
  completionReasonLabel,
  holeStatusLabel,
} from "@/components/holes/completion-support";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatMetres } from "@/domain";

type StatusFilter = "ALL" | "COMPLETED" | "ABANDONED";

export function CompletedHolesList() {
  const [entries, setEntries] = useState<readonly CompletedHoleIndexEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setMessage("Browser storage is unavailable."),
      );
      return;
    }
    void listCompletedHoles({}, services)
      .then(setEntries)
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Completed holes could not be loaded.",
        ),
      );
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-AU");
    return entries.filter((entry) => {
      if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        entry.hole.name,
        entry.completion.snapshot.projectNameSnapshot,
        entry.completion.snapshot.rigNameSnapshot,
        completionReasonLabel(entry.completion.snapshot.reason),
      ]
        .join(" ")
        .toLocaleLowerCase("en-AU");
      return haystack.includes(query);
    });
  }, [entries, search, statusFilter]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Hole history"
        title="Completed and abandoned holes"
        description="Immutable completion snapshots with final depth, reason, and lock-aware actions."
        backTarget={namedBackTarget("/projects", "Project library")}
        action={
          <StatusPill tone="neutral">{filtered.length} shown</StatusPill>
        }
      />

      {message ? (
        <p role="alert" className="font-semibold text-[var(--tl-danger)]">
          {message}
        </p>
      ) : null}

      <SectionPanel title="Filters">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block text-sm font-bold">
            Search
            <input
              className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hole, project, rig, or reason"
            />
          </label>
          <label className="block text-sm font-bold">
            Status
            <select
              className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 md:w-48"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">All locked</option>
              <option value="COMPLETED">Completed</option>
              <option value="ABANDONED">Abandoned</option>
            </select>
          </label>
        </div>
      </SectionPanel>

      <div className="grid gap-3 md:hidden">
        {filtered.map((entry) => (
          <CompletedHoleCard key={entry.hole.localId} entry={entry} />
        ))}
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            No completed or abandoned holes match these filters.
          </p>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--tl-border)] text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              <th className="px-3 py-3">Hole</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Final depth</th>
              <th className="px-3 py-3">Reason</th>
              <th className="px-3 py-3">Completed</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr
                key={entry.hole.localId}
                className="border-b border-[var(--tl-border)]"
              >
                <td className="px-3 py-4 font-bold">{entry.hole.name}</td>
                <td className="px-3 py-4">
                  <StatusPill
                    tone={entry.status === "ABANDONED" ? "danger" : "success"}
                  >
                    {holeStatusLabel(entry.status)}
                  </StatusPill>
                </td>
                <td className="px-3 py-4">
                  {formatMetres(entry.completion.snapshot.finalDepthDm)}
                </td>
                <td className="px-3 py-4">
                  {completionReasonLabel(entry.completion.snapshot.reason)}
                </td>
                <td className="px-3 py-4">
                  {formatFieldDateTime(entry.completion.completedAt)}
                </td>
                <td className="px-3 py-4">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={runbookRoutes.currentHole(entry.hole.localId)}
                      className="font-bold text-[var(--tl-primary)]"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={runbookRoutes.completeHole(entry.hole.localId)}
                      className="font-bold text-[var(--tl-primary)]"
                    >
                      Snapshot
                    </Link>
                    <Link
                      href={runbookRoutes.reopenHole(entry.hole.localId)}
                      className="font-bold text-[var(--tl-primary)]"
                    >
                      Reopen
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-[var(--tl-ink-muted)]">
            No completed or abandoned holes match these filters.
          </p>
        ) : null}
      </div>

      <LocalPrototypeNotice />
    </div>
  );
}

function CompletedHoleCard({ entry }: { entry: CompletedHoleIndexEntry }) {
  return (
    <article className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{entry.hole.name}</h2>
        <StatusPill tone={entry.status === "ABANDONED" ? "danger" : "success"}>
          {holeStatusLabel(entry.status)}
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
        {entry.completion.snapshot.projectNameSnapshot} ·{" "}
        {entry.completion.snapshot.rigNameSnapshot}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricDisplay
          label="Final depth"
          value={formatMetres(entry.completion.snapshot.finalDepthDm)}
          emphasis="strong"
        />
        <MetricDisplay
          label="Completed"
          value={formatFieldDateTime(entry.completion.completedAt)}
        />
      </div>
      <p className="mt-3 text-sm font-bold">
        {completionReasonLabel(entry.completion.snapshot.reason)}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={runbookRoutes.currentHole(entry.hole.localId)}
          className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
        >
          Dashboard
        </Link>
        <Link
          href={runbookRoutes.completeHole(entry.hole.localId)}
          className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
        >
          Snapshot
        </Link>
        <Link
          href={runbookRoutes.reopenHole(entry.hole.localId)}
          className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
        >
          Reopen
        </Link>
      </div>
    </article>
  );
}
