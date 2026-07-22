import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { BrowserRunbookServices } from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import {
  decimetres,
  formatMetres,
  type ComponentStatus,
  type ComponentType,
  type UsageRun,
} from "@/domain";
import { targetLockStage3Seed } from "@/infrastructure/seed";

export const COMPONENT_TYPES: readonly ComponentType[] = ["BIT", "REAMER"];

export const COMPONENT_STATUSES: readonly ComponentStatus[] = [
  "AVAILABLE",
  "SERVICEABLE",
  "ACTIVE",
  "REMOVED",
  "UNDER_INSPECTION",
  "RETIRED",
  "LOST_DOWNHOLE",
];

export const ASSIGNABLE_STATUSES: readonly ComponentStatus[] = [
  "AVAILABLE",
  "SERVICEABLE",
];

export function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("en-AU")
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("en-AU"));
}

export function formatComponentDepth(value: number): string {
  return formatMetres(decimetres(value));
}

export function formatComponentDate(value: string | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function createComponentLocalId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function defaultComponentActor(): {
  readonly userId: string;
  readonly userName: string;
} {
  const user =
    targetLockStage3Seed.users.find((candidate) => candidate.role === "supervisor") ??
    targetLockStage3Seed.users.find((candidate) => candidate.role === "driller") ??
    targetLockStage3Seed.users[0];
  return {
    userId: user?.localId ?? "local-operator",
    userName: user?.displayName ?? "Local operator",
  };
}

export function readCompletedUsageRuns(
  holeId: string,
  services: BrowserRunbookServices,
): readonly UsageRun[] {
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
  return [...seedRuns, ...localRuns].sort((left, right) => {
    if (left.startDepth !== right.startDepth) {
      return left.startDepth < right.startDepth ? -1 : 1;
    }
    if (left.holeDepth !== right.holeDepth) {
      return left.holeDepth < right.holeDepth ? -1 : 1;
    }
    return 0;
  });
}

export function ComponentStatusPill({
  status,
}: {
  status: ComponentStatus;
}) {
  const tone =
    status === "ACTIVE"
      ? "success"
      : status === "AVAILABLE" || status === "SERVICEABLE"
        ? "info"
        : status === "LOST_DOWNHOLE"
          ? "danger"
          : status === "UNDER_INSPECTION"
            ? "warning"
            : "neutral";
  return <StatusPill tone={tone}>{titleCase(status)}</StatusPill>;
}

export function OperationNotice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-[var(--tl-radius-md)] border p-4 ${
        tone === "error"
          ? "border-[var(--tl-danger)] bg-[var(--tl-danger-soft)]"
          : "border-[var(--tl-success)] bg-[var(--tl-success-soft)]"
      }`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-5 shrink-0 ${
          tone === "error"
            ? "text-[var(--tl-danger)]"
            : "text-[var(--tl-success)]"
        }`}
      />
      <div className="min-w-0 font-semibold leading-6 text-[var(--tl-ink)]">
        {children}
      </div>
    </div>
  );
}
