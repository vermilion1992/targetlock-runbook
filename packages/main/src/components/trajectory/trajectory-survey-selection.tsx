"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  saveTrajectorySurveySelection,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { formatTenths, type Survey } from "@/domain";

type DepthGroup = {
  depthDm: number;
  surveys: Survey[];
  selectedId: string;
};

export function TrajectorySurveySelection({ holeId }: { holeId: string }) {
  const [groups, setGroups] = useState<DepthGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyDepth, setBusyDepth] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (active) setMessage("Browser storage is unavailable.");
      });
      return () => {
        active = false;
      };
    }
    void Promise.all([
      services.surveys.listByHole(holeId),
      services.trajectory.listSelections(holeId),
    ]).then(([surveys, selections]) => {
      if (!active) return;
      const byDepth = new Map<number, Survey[]>();
      for (const survey of surveys) {
        const depth = Number(survey.depthDm);
        const list = byDepth.get(depth) ?? [];
        list.push(survey);
        byDepth.set(depth, list);
      }
      const selectionByDepth = new Map(
        selections.map((selection) => [
          Number(selection.depthDm),
          selection.selectedSurveyId,
        ]),
      );
      const next = [...byDepth.entries()]
        .filter(([, list]) => list.length > 1)
        .sort(([a], [b]) => a - b)
        .map(([depthDm, list]) => {
          const sorted = [...list].sort(
            (left, right) =>
              Date.parse(right.recordedAt) - Date.parse(left.recordedAt),
          );
          return {
            depthDm,
            surveys: sorted,
            selectedId: selectionByDepth.get(depthDm) ?? sorted[0]!.localId,
          };
        });
      setGroups(next);
    });
    return () => {
      active = false;
    };
  }, [holeId, reloadToken]);

  async function handleUseSelected(depthDm: number, selectedSurveyId: string) {
    const services = createBrowserRunbookServices();
    if (!services) return;
    setBusyDepth(depthDm);
    setMessage(null);
    try {
      const occurredAt = new Date().toISOString();
      await saveTrajectorySurveySelection(
        {
          operationId: `selection-${holeId}-${depthDm}-${occurredAt}`,
          holeId,
          depthDm,
          selectedSurveyId,
          selectedByUserId: "user-local",
          selectedByNameSnapshot: "Local operator",
          occurredAt,
        },
        services,
      );
      setMessage(
        `Selected reading saved for ${(depthDm / 10).toFixed(1)} m. Survey History is unchanged.`,
      );
      setReloadToken((token) => token + 1);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save selection.",
      );
    } finally {
      setBusyDepth(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="trajectory-survey-selection">
      <StagePageHeader
        eyebrow="Trajectory"
        title="Trajectory Survey review"
        description="Choose one Survey reading per duplicate depth for trajectory calculation. Survey History remains unchanged."
        backTarget={namedBackTarget(runbookRoutes.trajectory(holeId), "Trajectory")}
        action={
          <Link
            href={runbookRoutes.trajectory(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          >
            View trajectory
          </Link>
        }
      />

      {groups.length === 0 ? (
        <p className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 text-sm">
          No duplicate Survey depths require review.
        </p>
      ) : (
        groups.map((group) => (
          <section
            key={group.depthDm}
            className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
            data-testid={`duplicate-depth-${group.depthDm}`}
          >
            <h2 className="text-lg font-semibold">
              {(group.depthDm / 10).toFixed(1)} m
            </h2>
            <p className="text-sm text-[var(--tl-ink-muted)]">
              {group.surveys.length} Survey readings exist
            </p>
            <fieldset className="space-y-2">
              <legend className="sr-only">
                Select Survey at {(group.depthDm / 10).toFixed(1)} m
              </legend>
              {group.surveys.map((survey) => (
                <label
                  key={survey.localId}
                  className="flex min-h-11 items-center gap-2"
                >
                  <input
                    type="radio"
                    name={`depth-${group.depthDm}`}
                    checked={group.selectedId === survey.localId}
                    onChange={() =>
                      setGroups((current) =>
                        current.map((row) =>
                          row.depthDm === group.depthDm
                            ? { ...row, selectedId: survey.localId }
                            : row,
                        ),
                      )
                    }
                  />
                  <span>
                    {formatTenths(survey.azimuthTenths)}° {survey.northReference}{" "}
                    — {new Date(survey.recordedAt).toLocaleString()}
                    {survey.localId === group.surveys[0]?.localId
                      ? " (latest)"
                      : ""}
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              disabled={busyDepth === group.depthDm}
              className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-4 font-semibold text-white"
              onClick={() =>
                void handleUseSelected(group.depthDm, group.selectedId)
              }
            >
              Use selected reading
            </button>
          </section>
        ))
      )}

      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
