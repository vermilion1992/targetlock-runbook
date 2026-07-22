"use client";

import { AlertTriangle, CheckCircle2, Info, PencilLine } from "lucide-react";
import type { ReactNode } from "react";

import type { BrowserRunbookServices } from "@/application/runbook";
import { completedDepthFromRuns } from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import {
  calculateCasingLength,
  decimetres,
  formatMetres,
  type CasingEvent,
  type CasingStatus,
  type CasingString,
  type Decimetres,
  type UsageRun,
} from "@/domain";
import { targetLockStage3Seed } from "@/infrastructure/seed";

export const CASING_STATUSES: readonly CasingStatus[] = [
  "ACTIVE",
  "COMPLETED",
  "REMOVED",
  "ABANDONED",
];

export interface CasingHistoryRecord {
  readonly casing: CasingString;
  readonly events: readonly CasingEvent[];
}

export function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("en-AU")
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("en-AU"));
}

export function formatCasingDepth(value: number): string {
  return formatMetres(decimetres(value));
}

export function formatCasingLength(
  startDepthDm: Decimetres,
  endDepthDm: Decimetres,
): string {
  return formatMetres(calculateCasingLength(startDepthDm, endDepthDm));
}

export function formatCasingDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function createCasingId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultCasingActor(): {
  readonly userId: string;
  readonly userName: string;
} {
  const user =
    targetLockStage3Seed.users.find(({ role }) => role === "supervisor") ??
    targetLockStage3Seed.users.find(({ role }) => role === "driller") ??
    targetLockStage3Seed.users[0];
  return {
    userId: user?.localId ?? "local-operator",
    userName: user?.displayName ?? "Local operator",
  };
}

export function completedHoleDepth(
  holeId: string,
  services: BrowserRunbookServices,
): Decimetres {
  const localResult = services.runs.readCompletedRuns(holeId);
  if (localResult.status === "invalid") throw new Error(localResult.reason);

  const localIds = new Set(localResult.snapshots.map(({ localId }) => localId));
  const seedRuns: readonly UsageRun[] = targetLockStage3Seed.runs
    .filter(
      (run) =>
        run.status !== "in_progress" &&
        !localIds.has(run.localId) &&
        (run.holeId === targetLockStage3Seed.hole.localId ||
          run.holeNameSnapshot === holeId),
    )
    .map((run) => ({
      localId: run.localId,
      startDepth: run.startDepth,
      holeDepth: run.holeDepth,
      drilledLength: run.drilledLength,
      recoveredLength: run.recoveredLength,
      recoveryPercentage: run.recoveryPercentage,
      status: run.status,
    }));
  const localRuns: readonly UsageRun[] = localResult.snapshots.map((run) => ({
    localId: run.localId,
    startDepth: decimetres(run.previousCompletedDepthDm),
    holeDepth: decimetres(run.holeDepthDm),
    drilledLength: decimetres(run.drilledLengthDm),
    recoveredLength: decimetres(run.recoveredLengthDm),
    recoveryPercentage: run.recoveryPercentage,
    status: "completed",
  }));
  return completedDepthFromRuns([...seedRuns, ...localRuns]);
}

export function CasingStatusPill({ status }: { status: CasingStatus }) {
  const tone =
    status === "ACTIVE"
      ? "success"
      : status === "COMPLETED"
        ? "info"
        : status === "ABANDONED"
          ? "warning"
          : "neutral";
  return <StatusPill tone={tone}>{titleCase(status)}</StatusPill>;
}

export function CasingNotice({
  tone,
  children,
}: {
  tone: "error" | "success" | "warning" | "info";
  children: ReactNode;
}) {
  const Icon =
    tone === "error" || tone === "warning"
      ? AlertTriangle
      : tone === "success"
        ? CheckCircle2
        : Info;
  const role = tone === "error" ? "alert" : "status";
  const classes =
    tone === "error"
      ? "border-[var(--tl-danger)] bg-[var(--tl-danger-soft)]"
      : tone === "warning"
        ? "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)]"
        : tone === "success"
          ? "border-[var(--tl-success)] bg-[var(--tl-success-soft)]"
          : "border-[var(--tl-primary)] bg-[var(--tl-primary-soft)]";
  return (
    <div
      role={role}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-[var(--tl-radius-md)] border p-4 ${classes}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 text-sm font-semibold leading-6 text-[var(--tl-ink)]">
        {children}
      </div>
    </div>
  );
}

export function CasingEventHistory({
  events,
  headingLevel = 3,
}: {
  events: readonly CasingEvent[];
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const ordered = [...events].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt),
  );

  return (
    <div>
      <Heading className="text-sm font-bold uppercase tracking-[0.07em] text-[var(--tl-ink-muted)]">
        Immutable event history
      </Heading>
      {ordered.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--tl-ink-muted)]">
          No casing events have been recorded.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {ordered.map((event) => {
            const corrected = event.eventType === "CORRECT";
            return (
              <li
                key={event.localId}
                className={`rounded-[var(--tl-radius-md)] border p-4 ${
                  corrected
                    ? "border-[var(--tl-warning)] bg-[var(--tl-warning-soft)]"
                    : "border-[var(--tl-border)] bg-[var(--tl-surface-raised)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {corrected ? (
                      <PencilLine
                        aria-hidden="true"
                        className="size-4 text-[var(--tl-warning)]"
                      />
                    ) : null}
                    <span className="font-bold text-[var(--tl-ink)]">
                      {titleCase(event.eventType)}
                    </span>
                    {corrected ? (
                      <StatusPill tone="warning">Correction</StatusPill>
                    ) : null}
                  </div>
                  <time
                    dateTime={event.recordedAt}
                    className="text-xs font-semibold text-[var(--tl-ink-muted)]"
                  >
                    {formatCasingDate(event.recordedAt)}
                  </time>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-[var(--tl-ink-muted)]">
                      Previous depth
                    </dt>
                    <dd className="mt-0.5 font-bold text-[var(--tl-ink)]">
                      {event.previousEndDepthDm === undefined
                        ? "—"
                        : formatCasingDepth(event.previousEndDepthDm)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--tl-ink-muted)]">
                      New depth
                    </dt>
                    <dd className="mt-0.5 font-bold text-[var(--tl-ink)]">
                      {formatCasingDepth(event.newEndDepthDm)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--tl-ink-muted)]">
                      Recorded by
                    </dt>
                    <dd className="mt-0.5 text-[var(--tl-ink)]">
                      {event.recordedByNameSnapshot}
                    </dd>
                  </div>
                </dl>
                {event.previousStatus !== event.newStatus &&
                event.newStatus !== undefined ? (
                  <p className="mt-3 text-sm text-[var(--tl-ink)]">
                    Status:{" "}
                    <strong>{titleCase(event.previousStatus ?? "unknown")}</strong>
                    {" → "}
                    <strong>{titleCase(event.newStatus)}</strong>
                  </p>
                ) : null}
                {event.reason ? (
                  <p className="mt-2 text-sm leading-5 text-[var(--tl-ink)]">
                    <strong>Reason:</strong> {event.reason}
                  </p>
                ) : null}
                {event.comment ? (
                  <p className="mt-2 text-sm leading-5 text-[var(--tl-ink-muted)]">
                    <strong>Comment:</strong> {event.comment}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
