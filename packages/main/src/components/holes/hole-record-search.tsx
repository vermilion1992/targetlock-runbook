"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  decimetres,
  formatMetres,
  shiftTypeLabel,
  type CasingString,
  type Component,
  type ComponentAssignment,
  type GeneratedReportRecord,
  type HoleCompletionRecord,
  type RunbookShift,
  type Survey,
  type Tray,
} from "@/domain";
import type {
  RunCorrectionRecord,
  SavedRunSnapshot,
} from "@/infrastructure/drafts";
import { targetLockStage5Seed } from "@/infrastructure/seed";

interface SearchResult {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly rank: number;
}

function matches(needle: string, values: readonly (string | undefined | null)[]) {
  return values.some(
    (value) =>
      typeof value === "string" &&
      value.toLocaleLowerCase("en-AU").includes(needle),
  );
}

export function HoleRecordSearch({ holeId }: { holeId: string }) {
  const [query, setQuery] = useState("");
  const [surveys, setSurveys] = useState<readonly Survey[]>([]);
  const [trays, setTrays] = useState<readonly Tray[]>([]);
  const [localRuns, setLocalRuns] = useState<readonly SavedRunSnapshot[]>([]);
  const [shifts, setShifts] = useState<readonly RunbookShift[]>([]);
  const [casingStrings, setCasingStrings] = useState<readonly CasingString[]>(
    [],
  );
  const [assignments, setAssignments] = useState<
    readonly ComponentAssignment[]
  >([]);
  const [components, setComponents] = useState<readonly Component[]>([]);
  const [completions, setCompletions] = useState<
    readonly HoleCompletionRecord[]
  >([]);
  const [reports, setReports] = useState<readonly GeneratedReportRecord[]>([]);
  const [runCorrections, setRunCorrections] = useState<
    readonly RunCorrectionRecord[]
  >([]);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    void Promise.all([
      services.surveys.listByHole(holeId),
      services.trays.listByHole(holeId),
      Promise.resolve(services.runs.readCompletedRuns(holeId)),
      services.shifts.listByHole(holeId),
      services.casing.listByHole(holeId),
      services.componentAssignments.listByHole(holeId),
      services.components.list(),
      services.completion.getCompletionHistory(holeId),
      services.reports.listReports(holeId),
      services.runCorrections.getEnvelope(holeId),
    ]).then(
      ([
        nextSurveys,
        nextTrays,
        completedRuns,
        nextShifts,
        nextCasing,
        nextAssignments,
        nextComponents,
        nextCompletions,
        nextReports,
        runEnvelope,
      ]) => {
        setSurveys(nextSurveys);
        setTrays(nextTrays);
        setLocalRuns(
          completedRuns.status === "invalid" ? [] : completedRuns.snapshots,
        );
        setShifts(nextShifts);
        setCasingStrings(nextCasing);
        setAssignments(nextAssignments);
        setComponents(nextComponents);
        setCompletions(nextCompletions);
        setReports(nextReports);
        setRunCorrections(runEnvelope?.corrections ?? []);
      },
    );
  }, [holeId]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en-AU");
    if (needle.length < 1) return [];

    const serialFor = (componentId: string) =>
      components.find(({ localId }) => localId === componentId)?.serialNumber ??
      componentId;

    const localIds = new Set(localRuns.map(({ localId }) => localId));
    const localNumbers = new Set(localRuns.map(({ runNumber }) => runNumber));
    const seedRuns =
      holeId === targetLockStage5Seed.hole.name
        ? targetLockStage5Seed.runs.filter(
            (run) =>
              !localIds.has(run.localId) && !localNumbers.has(run.runNumber),
          )
        : [];

    const found: SearchResult[] = [];

    for (const run of seedRuns) {
      if (
        matches(needle, [
          String(run.runNumber),
          formatMetres(run.holeDepth),
          formatMetres(run.drilledLength),
          "run",
          run.status,
          run.status === "corrected" ? "corrected" : "",
          run.status === "void" ? "void" : "",
        ])
      ) {
        found.push({
          id: `run-${run.localId}`,
          label: `Run ${run.runNumber}${run.status === "void" ? " · VOID" : run.status === "corrected" ? " · Corrected" : ""} · ${formatMetres(run.holeDepth)}`,
          href: runbookRoutes.runDetail(holeId, run.localId),
          rank: 1,
        });
      }
    }
    for (const run of localRuns) {
      const originalNumber = run.originalSnapshot?.runNumber;
      const relatedReasons = runCorrections
        .filter((correction) => correction.runId === run.localId)
        .map((correction) => correction.reason);
      if (
        matches(needle, [
          String(run.runNumber),
          originalNumber !== undefined ? String(originalNumber) : "",
          formatMetres(decimetres(run.holeDepthDm)),
          formatMetres(decimetres(run.drilledLengthDm)),
          "run",
          run.status,
          run.status === "corrected" ? "corrected" : "",
          run.status === "void" ? "void" : "",
          run.voidReason ?? "",
          run.voidComment ?? "",
          run.comment,
          ...relatedReasons,
        ])
      ) {
        found.push({
          id: `run-${run.localId}`,
          label: `Run ${run.runNumber}${run.status === "void" ? " · VOID" : run.status === "corrected" ? " · Corrected" : ""} · ${formatMetres(decimetres(run.holeDepthDm))}`,
          href: runbookRoutes.runDetail(holeId, run.localId),
          rank: 1,
        });
      }
    }

    for (const shift of shifts) {
      if (
        matches(needle, [
          shiftTypeLabel(shift.shiftType),
          shift.shiftDate,
          shift.primaryDrillerNameSnapshot,
          "shift",
          "handover",
        ])
      ) {
        found.push({
          id: `shift-${shift.localId}`,
          label: `${shiftTypeLabel(shift.shiftType)} · ${shift.shiftDate} · ${shift.primaryDrillerNameSnapshot}`,
          href: runbookRoutes.shiftDetail(holeId, shift.localId),
          rank: 2,
        });
      }
    }

    for (const casing of casingStrings) {
      if (
        matches(needle, [
          casing.casingSize,
          casing.label,
          formatMetres(casing.currentEndDepthDm),
          "casing",
        ])
      ) {
        found.push({
          id: `casing-${casing.localId}`,
          label: `${casing.label ?? casing.casingSize} casing · ${formatMetres(casing.currentEndDepthDm)}`,
          href: runbookRoutes.casingDetail(holeId, casing.localId),
          rank: 3,
        });
      }
    }

    for (const assignment of assignments) {
      const serial = serialFor(assignment.componentId);
      const label = assignment.componentType === "BIT" ? "Bit" : "Reamer";
      if (
        matches(needle, [
          serial,
          label,
          assignment.componentType,
          formatMetres(assignment.startDepthDm),
          assignment.endDepthDm === undefined
            ? undefined
            : formatMetres(assignment.endDepthDm),
        ])
      ) {
        found.push({
          id: `component-${assignment.localId}`,
          label: `${label} ${serial} · from ${formatMetres(assignment.startDepthDm)}`,
          href: runbookRoutes.holeComponents(holeId),
          rank: 4,
        });
      }
    }

    for (const survey of surveys) {
      if (
        matches(needle, [
          formatMetres(survey.depthDm),
          survey.toolNameSnapshot,
          survey.toolSerialSnapshot,
          "survey",
        ])
      ) {
        found.push({
          id: `survey-${survey.localId}`,
          label: `Survey ${formatMetres(survey.depthDm)} · ${survey.toolNameSnapshot ?? "No tool"}`,
          href: runbookRoutes.surveyDetail(holeId, survey.localId),
          rank: 5,
        });
      }
    }

    for (const tray of trays) {
      if (
        matches(needle, [
          String(tray.trayNumber),
          tray.startDepthDm === undefined
            ? undefined
            : formatMetres(tray.startDepthDm),
          tray.endDepthDm === undefined
            ? undefined
            : formatMetres(tray.endDepthDm),
          tray.comment,
          "tray",
        ])
      ) {
        found.push({
          id: `tray-${tray.localId}`,
          label: `Tray ${tray.trayNumber} · ${
            tray.startDepthDm !== undefined && tray.endDepthDm !== undefined
              ? `${formatMetres(tray.startDepthDm)}–${formatMetres(tray.endDepthDm)}`
              : "Depth not recorded"
          }`,
          href: runbookRoutes.trayDetail(holeId, tray.localId),
          rank: 6,
        });
      }
    }

    for (const completion of completions) {
      if (
        matches(needle, [
          completion.finalStatus,
          completion.snapshot.reason,
          completion.snapshot.comment,
          "complete",
          "completed",
          "abandoned",
          "completion",
        ])
      ) {
        found.push({
          id: `completion-${completion.localId}`,
          label: `Completion · ${completion.finalStatus} · ${formatMetres(completion.snapshot.finalDepthDm)}`,
          href: runbookRoutes.completeHole(holeId),
          rank: 7,
        });
      }
    }

    for (const report of reports) {
      if (
        matches(needle, [
          report.reportType,
          report.format,
          report.activityStatus,
          report.filename,
          "report",
          "pdf",
          "excel",
          "csv",
        ])
      ) {
        found.push({
          id: `report-${report.localId}`,
          label: `${report.reportType.replaceAll("_", " ")} · ${report.format} v${report.version}`,
          href: runbookRoutes.reportHistory(holeId),
          rank: 8,
        });
      }
    }

    if (
      matches(needle, ["timeline", "event", "hole event", "lifecycle"])
    ) {
      found.push({
        id: "hole-timeline",
        label: "Hole timeline and lifecycle events",
        href: runbookRoutes.timeline(holeId),
        rank: 9,
      });
    }

    return found
      .sort((left, right) => left.rank - right.rank || left.label.localeCompare(right.label))
      .slice(0, 12);
  }, [
    assignments,
    casingStrings,
    completions,
    components,
    holeId,
    localRuns,
    query,
    reports,
    runCorrections,
    shifts,
    surveys,
    trays,
  ]); // runCorrections included for reason search

  return (
    <section
      aria-labelledby="hole-search-heading"
      className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
    >
      <h2 id="hole-search-heading" className="font-bold">
        Search this hole
      </h2>
      <label className="relative mt-3 block">
        <span className="sr-only">
          Search runs, shifts, casing, bits, reamers, surveys, trays, completion
          records, or reports
        </span>
        <Search
          aria-hidden="true"
          className="absolute left-3 top-3.5 size-4 text-[var(--tl-ink-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Run, shift, casing, bit, survey, tray, report…"
          className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pl-10 pr-3"
        />
      </label>
      {query ? (
        <div className="mt-3">
          {results.length > 0 ? (
            <ul className="divide-y divide-[var(--tl-border)]">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    href={result.href}
                    className="flex min-h-11 items-center py-2 font-bold text-[var(--tl-primary)]"
                  >
                    {result.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="text-sm text-[var(--tl-ink-muted)]">
              No matching hole records.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
