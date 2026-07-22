import { Lock } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/field/status-pill";
import { holeStatusLabel } from "@/components/holes/completion-support";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { HoleStatus } from "@/domain";

export function HoleLockedPanel({
  holeId,
  status,
  description,
  showReopen = true,
}: {
  holeId: string;
  status: Extract<HoleStatus, "COMPLETED" | "ABANDONED" | "ARCHIVED">;
  description?: string;
  showReopen?: boolean;
}) {
  return (
    <aside
      role="status"
      className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--tl-warning-soft)] text-[var(--tl-warning)]">
          <Lock aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--tl-ink)]">
              Hole locked
            </h2>
            <StatusPill tone={status === "ABANDONED" ? "danger" : "success"}>
              {holeStatusLabel(status)}
            </StatusPill>
          </div>
          <p className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]">
            {description ??
              "Drilling mutations are blocked. History, statistics, trays, surveys, and timeline remain available."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={runbookRoutes.completeHole(holeId)}
              className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold no-underline"
            >
              View completion
            </Link>
            <Link
              href={runbookRoutes.timeline(holeId)}
              className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold no-underline"
            >
              Timeline
            </Link>
            {showReopen && status !== "ARCHIVED" ? (
              <Link
                href={runbookRoutes.reopenHole(holeId)}
                className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white no-underline"
              >
                Reopen hole
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
