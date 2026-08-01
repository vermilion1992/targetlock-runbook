"use client";

import { Clock3 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getOperationalTimelineEntries,
  mapBottomHoleAssemblyTimelineEntries,
} from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import {
  decimetres,
  formatMetres,
  formatTenths,
  type AuditEntry,
  type CasingEvent,
  type Component,
  type ComponentAssignment,
  type Decimetres,
  type Survey,
  type Tray,
} from "@/domain";
import type { SavedRunSnapshot } from "@/infrastructure/drafts";
import type { TargetLockStage1Seed } from "@/infrastructure/seed";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

type TimelineCategory =
  | "Run"
  | "Survey"
  | "Tray"
  | "Casing"
  | "Component"
  | "BHA"
  | "Shift"
  | "Hole";

interface TimelineEntry {
  readonly id: string;
  readonly category: TimelineCategory;
  readonly depth: Decimetres;
  readonly occurredAt: string;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
}

function categoryTone(
  category: TimelineCategory,
): "info" | "success" | "warning" | "neutral" | "danger" {
  if (category === "Run") return "success";
  if (category === "Survey") return "info";
  if (category === "Tray") return "success";
  if (category === "Casing") return "warning";
  if (category === "BHA") return "warning";
  if (category === "Shift") return "info";
  if (category === "Hole") return "warning";
  return "neutral";
}

function compareTimelineEntries(
  left: TimelineEntry,
  right: TimelineEntry,
): number {
  if (left.depth !== right.depth) {
    return left.depth > right.depth ? -1 : 1;
  }
  return Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
}

const casingEventTitles: Readonly<Record<CasingEvent["eventType"], string>> = {
  INSTALL: "Casing installed",
  ADVANCE: "Casing advanced",
  SHORTEN: "Casing shortened",
  REMOVE: "Casing removed",
  STATUS_CHANGE: "Casing status changed",
  CORRECT: "Casing depth corrected",
};

function runTimelineEntries(
  holeId: string,
  seed: TargetLockStage1Seed | null,
  localRuns: readonly SavedRunSnapshot[] = [],
): readonly TimelineEntry[] {
  const localIds = new Set(localRuns.map(({ localId }) => localId));
  const localNumbers = new Set(localRuns.map(({ runNumber }) => runNumber));
  const seedEntries: TimelineEntry[] = (
    seed !== null && holeId === seed.hole.localId ? seed.runs : []
  )
    .filter(
      (run) => !localIds.has(run.localId) && !localNumbers.has(run.runNumber),
    )
    .map((run) => ({
      id: run.localId,
      category: "Run" as const,
      depth: run.holeDepth,
      occurredAt: run.completedAt ?? run.startedAt,
      title: `Run ${run.runNumber} ${run.completedAt ? "completed" : "in progress"}`,
      detail: `${formatMetres(run.drilledLength)} drilled · ${formatMetres(run.recoveredLength)} recovered`,
      href: runbookRoutes.runDetail(holeId, run.localId),
    }));
  const localEntries: TimelineEntry[] = localRuns.map((run) => ({
    id: run.localId,
    category: "Run" as const,
    depth: decimetres(run.holeDepthDm),
    occurredAt: run.completedAt,
    title: `Run ${run.runNumber} completed`,
    detail: `${formatMetres(decimetres(run.drilledLengthDm))} drilled · ${formatMetres(decimetres(run.recoveredLengthDm))} recovered`,
    href: runbookRoutes.runDetail(holeId, run.localId),
  }));
  return [...seedEntries, ...localEntries].sort(compareTimelineEntries);
}

function surveyTimelineEntries(
  holeId: string,
  surveys: readonly Survey[],
): readonly TimelineEntry[] {
  return surveys.map((survey) => ({
    id: `survey-${survey.localId}-recorded`,
    category: "Survey",
    depth: survey.depthDm,
    occurredAt: survey.recordedAt,
    title: "Survey recorded",
    detail: `Dip ${formatTenths(survey.dipTenths)}° · azimuth ${formatTenths(survey.azimuthTenths)}° ${survey.northReference === "NOT_SPECIFIED" ? "" : survey.northReference}${survey.toolNameSnapshot ? ` · ${survey.toolNameSnapshot}` : ""}`,
    href: runbookRoutes.surveyDetail(holeId, survey.localId),
  }));
}

function trayTimelineEntries(
  holeId: string,
  trays: readonly Tray[],
): readonly TimelineEntry[] {
  return trays.map((tray) => ({
    id: `tray-${tray.localId}-photographed`,
    category: "Tray",
    depth: tray.endDepthDm ?? tray.startDepthDm ?? decimetres(0),
    occurredAt: tray.recordedAt,
    title: `Tray ${tray.trayNumber} photographed`,
    detail:
      tray.startDepthDm !== undefined && tray.endDepthDm !== undefined
        ? `${formatMetres(tray.startDepthDm)}–${formatMetres(tray.endDepthDm)}`
        : "Depth range not recorded",
    href: runbookRoutes.trayDetail(holeId, tray.localId),
  }));
}

function stageAuditTimelineEntries(
  holeId: string,
  audits: readonly AuditEntry[],
): readonly TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const audit of audits) {
    if (audit.depthDm === undefined) continue;
    if (
      audit.action === "hole_setup_created" ||
      audit.action === "hole_setup_updated"
    ) {
      const dip =
        typeof audit.metadata.collarDipTenths === "number"
          ? `${(audit.metadata.collarDipTenths / 10).toFixed(1)}°`
          : "not recorded";
      const azimuth =
        typeof audit.metadata.collarAzimuthTenths === "number"
          ? `${(audit.metadata.collarAzimuthTenths / 10).toFixed(1)}°`
          : "not recorded";
      const northReference =
        typeof audit.metadata.collarNorthReference === "string"
          ? ` ${audit.metadata.collarNorthReference}`
          : "";
      entries.push({
        id: audit.localId,
        category: "Hole",
        depth: audit.depthDm,
        occurredAt: audit.timestamp,
        title:
          audit.action === "hole_setup_created"
            ? "Initial hole setup recorded"
            : "Hole setup updated",
        detail: `Dip ${dip} · azimuth ${azimuth}${northReference} · ${audit.userNameSnapshot}`,
        href: runbookRoutes.surveySettings(holeId),
      });
      continue;
    }
    if (
      audit.action === "hole_completed_timeline" ||
      audit.action === "hole_abandoned_timeline" ||
      audit.action === "hole_reopened_timeline"
    ) {
      entries.push({
        id: audit.localId,
        category: "Hole",
        depth: audit.depthDm,
        occurredAt: audit.timestamp,
        title:
          audit.action === "hole_completed_timeline"
            ? "Hole completed"
            : audit.action === "hole_abandoned_timeline"
              ? "Hole abandoned"
              : "Hole reopened",
        detail: `${audit.userNameSnapshot} · lifecycle event`,
        href:
          audit.action === "hole_reopened_timeline"
            ? runbookRoutes.currentHole(holeId)
            : runbookRoutes.completeHole(holeId),
      });
      continue;
    }
    const title =
      audit.action === "survey_corrected"
        ? "Survey corrected"
        : audit.action === "tray_details_corrected"
          ? "Tray details corrected"
          : audit.action === "tray_photograph_replaced"
            ? "Tray photograph replaced"
            : audit.action === "run_corrected"
              ? "Run corrected"
              : audit.action === "rod_event_corrected"
                ? "Rod event corrected"
                : audit.action === "recovered_length_corrected"
                  ? "Recovered length corrected"
                  : audit.action === "run_voided"
                    ? "Run voided"
                    : null;
    if (title === null) continue;
    const category: TimelineCategory =
      audit.entityType === "survey"
        ? "Survey"
        : audit.entityType === "run"
          ? "Run"
          : "Tray";
    entries.push({
      id: audit.localId,
      category,
      depth: audit.depthDm,
      occurredAt: audit.timestamp,
      title,
      detail:
        typeof audit.metadata.reason === "string"
          ? audit.metadata.reason
          : typeof audit.metadata.voidReason === "string"
            ? audit.metadata.voidReason.replaceAll("_", " ")
            : typeof audit.metadata.correctionType === "string"
              ? audit.metadata.correctionType.replaceAll("_", " ")
              : "Audited correction",
      href:
        category === "Survey"
          ? runbookRoutes.surveyDetail(holeId, audit.entityId)
          : category === "Run"
            ? runbookRoutes.runDetail(holeId, audit.entityId)
            : runbookRoutes.trayDetail(holeId, audit.entityId),
    });
  }
  return entries;
}

function casingTimelineEntries(
  holeId: string,
  events: readonly CasingEvent[],
): readonly TimelineEntry[] {
  return events.map((event) => ({
    id: event.localId,
    category: "Casing",
    depth: event.newEndDepthDm,
    occurredAt: event.recordedAt,
    title: casingEventTitles[event.eventType],
    detail:
      event.eventType === "STATUS_CHANGE"
        ? `${event.previousStatus ?? "Unknown"} → ${event.newStatus ?? "Unknown"}${event.reason ? ` · ${event.reason}` : ""}`
        : event.previousEndDepthDm === undefined
          ? `Recorded to ${formatMetres(event.newEndDepthDm)}`
          : `${formatMetres(event.previousEndDepthDm)} → ${formatMetres(event.newEndDepthDm)}${event.reason ? ` · ${event.reason}` : ""}`,
    href: runbookRoutes.casingDetail(holeId, event.casingStringId),
  }));
}

function componentTimelineEntries(
  holeId: string,
  assignments: readonly ComponentAssignment[],
  components: readonly Component[],
): readonly TimelineEntry[] {
  const serialFor = (componentId: string) =>
    components.find(({ localId }) => localId === componentId)?.serialNumber ??
    componentId;
  const entries: TimelineEntry[] = [];

  for (const assignment of assignments) {
    const outgoing = assignments.find(
      (candidate) =>
        candidate.localId !== assignment.localId &&
        candidate.componentType === assignment.componentType &&
        candidate.endDepthDm === assignment.startDepthDm,
    );
    const label = assignment.componentType === "BIT" ? "Bit" : "Reamer";
    entries.push({
      id: `${assignment.localId}-${outgoing ? "changed" : "installed"}`,
      category: "Component",
      depth: assignment.startDepthDm,
      occurredAt: assignment.installedAt,
      title: outgoing ? `${label} changed` : `${label} installed`,
      detail: outgoing
        ? `${serialFor(outgoing.componentId)} → ${serialFor(assignment.componentId)}${outgoing.removalReason ? ` · ${outgoing.removalReason.replaceAll("_", " ")}` : ""}`
        : serialFor(assignment.componentId),
      href: runbookRoutes.holeComponents(holeId),
    });

    if (outgoing?.removalReason === "LOST_DOWNHOLE") {
      entries.push({
        id: `${outgoing.localId}-lost-downhole`,
        category: "Component",
        depth: outgoing.endDepthDm!,
        occurredAt: outgoing.removedAt ?? assignment.installedAt,
        title: "Component lost downhole",
        detail: serialFor(outgoing.componentId),
        href: runbookRoutes.holeComponents(holeId),
      });
    }
  }

  for (const assignment of assignments) {
    if (assignment.endDepthDm === undefined || assignment.removedAt === undefined) {
      continue;
    }
    const hasSuccessor = assignments.some(
      (candidate) =>
        candidate.componentType === assignment.componentType &&
        candidate.startDepthDm === assignment.endDepthDm,
    );
    if (!hasSuccessor) {
      entries.push({
        id: `${assignment.localId}-removed`,
        category: "Component",
        depth: assignment.endDepthDm,
        occurredAt: assignment.removedAt,
        title: `${assignment.componentType === "BIT" ? "Bit" : "Reamer"} removed`,
        detail: `${serialFor(assignment.componentId)}${assignment.removalReason ? ` · ${assignment.removalReason.replaceAll("_", " ")}` : ""}`,
        href: runbookRoutes.holeComponents(holeId),
      });
    }
  }

  return entries;
}

export function TimelinePreview({
  holeId,
  seed,
}: {
  holeId: string;
  seed: TargetLockStage1Seed | null;
}) {
  const [entries, setEntries] = useState<readonly TimelineEntry[]>(() =>
    runTimelineEntries(holeId, seed),
  );

  useEffect(() => {
    let active = true;
    const services = createBrowserRunbookServices();
    if (services === null) return;
    void Promise.all([
      services.audits.listByHole(holeId),
      services.casing.listByHole(holeId),
      services.componentAssignments.listByHole(holeId),
      services.components.list(),
      services.surveys.listByHole(holeId),
      services.trays.listByHole(holeId),
      Promise.resolve(services.runs.readCompletedRuns(holeId)),
      services.bhaSetups.listByHole(holeId),
    ]).then(async ([audits, casingStrings, assignments, components, surveys, trays, completedRuns, bhaSetups]) => {
      const localRuns =
        completedRuns.status === "invalid" ? [] : completedRuns.snapshots;
      const casingEvents = (
        await Promise.all(
          casingStrings.map((casing) =>
            services.casing.listEvents(holeId, casing.localId),
          ),
        )
      ).flat();
      const shiftAndHoleEntries: TimelineEntry[] =
        getOperationalTimelineEntries(audits)
          .filter(
            ({ category }) => category === "Shift" || category === "Hole",
          )
          .map((entry) => ({
            id: entry.id,
            category: entry.category,
            depth: entry.depthDm,
            occurredAt: entry.occurredAt,
            title: entry.title,
            detail: entry.detail,
            href:
              entry.category === "Hole"
                ? entry.title === "Hole reopened"
                  ? runbookRoutes.currentHole(holeId)
                  : runbookRoutes.completeHole(holeId)
                : entry.entityId
                  ? runbookRoutes.shiftDetail(holeId, entry.entityId)
                  : undefined,
          }));
      if (!active) return;
      const deduplicated = new Map(
        [
          ...runTimelineEntries(holeId, seed, localRuns),
          ...shiftAndHoleEntries,
          ...casingTimelineEntries(holeId, casingEvents),
          ...componentTimelineEntries(holeId, assignments, components),
          ...surveyTimelineEntries(holeId, surveys),
          ...trayTimelineEntries(holeId, trays),
          ...mapBottomHoleAssemblyTimelineEntries(bhaSetups).map((entry) => ({
            id: entry.id,
            category: entry.category,
            depth: entry.depthDm,
            occurredAt: entry.occurredAt,
            title: entry.title,
            detail: entry.detail,
            href: runbookRoutes.updateBha(holeId),
          })),
          ...stageAuditTimelineEntries(holeId, audits),
        ].map((entry) => [entry.id, entry] as const),
      );
      setEntries([...deduplicated.values()].sort(compareTimelineEntries));
    });
    return () => {
      active = false;
    };
  }, [holeId, seed]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Operational timeline"
        title={`${holeId} depth timeline`}
        description="Runs, shifts, BHA changes, surveys, trays, casing, components, and hole lifecycle events shown at their recorded depth position."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
        action={
          <StatusPill tone="info">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {entries.length} events
          </StatusPill>
        }
      />

      <section aria-labelledby="depth-events-heading">
        <h2 id="depth-events-heading" className="sr-only">
          Depth-ordered events
        </h2>
        <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.375rem] before:top-6 before:w-px before:bg-[var(--tl-border-strong)]">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3"
            >
              <span className="z-10 mt-5 flex size-11 items-center justify-center rounded-full border-4 border-[var(--tl-surface-sunken)] bg-[var(--tl-primary)] text-xs font-bold text-white">
                {entry.category.slice(0, 1)}
              </span>
              <article className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill tone={categoryTone(entry.category)}>
                    {entry.category}
                  </StatusPill>
                  <strong className="tl-tabular text-base text-[var(--tl-ink)]">
                    {formatMetres(entry.depth)}
                  </strong>
                </div>
                <h3 className="mt-3 font-bold text-[var(--tl-ink)]">
                  {entry.href ? (
                    <Link href={entry.href} className="text-[var(--tl-primary)]">
                      {entry.title}
                    </Link>
                  ) : (
                    entry.title
                  )}
                </h3>
                <p className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]">
                  {entry.detail}
                </p>
                <p className="mt-3 text-xs text-[var(--tl-ink-muted)]">
                  {formatFieldDateTime(entry.occurredAt)}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </section>
</div>
  );
}
