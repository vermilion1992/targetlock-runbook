"use client";

import { useState } from "react";

import type { HoleTrajectoryComparison } from "@/domain";

import {
  buildActualVsPlanStatus,
  buildCalculationStatus,
  buildPlanToTargetStatus,
  reviewItems,
} from "./trajectory-status-model";

function StatusBlock({
  title,
  detail,
  tone,
  extra,
}: {
  title: string;
  detail: string;
  tone: "neutral" | "ok" | "warn" | "danger";
  extra?: string;
}) {
  const toneClass =
    tone === "ok"
      ? "border-[var(--tl-success)]/40"
      : tone === "warn"
        ? "border-[var(--tl-warning)]/50"
        : tone === "danger"
          ? "border-[var(--tl-danger)]/50"
          : "border-[var(--tl-border)]";
  return (
    <div className={`rounded-[var(--tl-radius-md)] border ${toneClass} px-3 py-2`}>
      <p className="text-[0.65rem] font-bold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-sm tabular-nums">{detail}</p>
      {extra ? (
        <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">{extra}</p>
      ) : null}
    </div>
  );
}

export function TrajectoryStatusPanel({
  comparison,
}: {
  comparison: HoleTrajectoryComparison;
}) {
  const [open, setOpen] = useState(false);
  const calc = buildCalculationStatus(comparison);
  const plan = buildPlanToTargetStatus(comparison);
  const actual = buildActualVsPlanStatus(comparison);
  const items = reviewItems(comparison.warnings);

  return (
    <section className="space-y-2" data-testid="trajectory-status-panel">
      <div className="grid gap-2 md:grid-cols-3">
        <StatusBlock
          title={calc.title}
          detail={calc.detail}
          tone={calc.kind === "BLOCKED" ? "danger" : "ok"}
        />
        <StatusBlock
          title={plan.title}
          detail={plan.detail}
          tone={
            plan.kind === "PLAN_REVIEW_REQUIRED"
              ? "warn"
              : plan.kind === "PLAN_WITHIN_TARGET"
                ? "ok"
                : "neutral"
          }
          extra={
            plan.targetRadiusLabel
              ? `Target radius ${plan.targetRadiusLabel}`
              : undefined
          }
        />
        <StatusBlock
          title={actual.title}
          detail={actual.detail}
          tone={
            actual.kind === "OUTSIDE_TOLERANCE"
              ? "danger"
              : actual.kind === "REVIEW" || actual.kind === "NO_TOLERANCE"
                ? "warn"
                : actual.kind === "WITHIN_TOLERANCE"
                  ? "ok"
                  : "neutral"
          }
          extra={
            actual.kind === "NO_TOLERANCE"
              ? "No project tolerance configured"
              : undefined
          }
        />
      </div>

      {items.length > 0 ? (
        <div data-testid="trajectory-warnings">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] px-4 text-sm font-semibold text-[var(--tl-warning)]"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {items.length} ITEM{items.length === 1 ? "" : "S"} REQUIRE REVIEW
          </button>
          {open ? (
            <ul className="mt-2 list-disc space-y-1 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] px-5 py-3 text-sm">
              {items.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>
                  <strong>{warning.severity}</strong>: {warning.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="hidden" data-testid="trajectory-warnings" />
      )}
    </section>
  );
}
