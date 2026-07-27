"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getHoleAnalytics,
  listHoleAnalyticsVersions,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { HoleAnalytics } from "@/domain";

import {
  HoleBarrelChangesPanel,
  HoleBitStatisticsPanel,
  HoleRunStatisticsPanel,
  HoleShiftStatisticsPanel,
  HoleSurveyRegisterPanel,
} from "./hole-analytics-panels";

type VersionOption = {
  readonly completionId: string;
  readonly completedAt: string;
  readonly finalStatus: string;
  readonly superseded: boolean;
  readonly label: string;
};

export function HoleAnalyticsDashboard({ holeId }: { holeId: string }) {
  const [analytics, setAnalytics] = useState<HoleAnalytics | null>(null);
  const [versions, setVersions] = useState<readonly VersionOption[]>([]);
  const [selected, setSelected] = useState<"current" | string>("current");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const services = createBrowserRunbookServices();
    if (services === null || services.holeAnalytics === undefined) {
      void Promise.resolve().then(() => {
        if (active) {
          setMessage("Browser storage is unavailable.");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }

    const holeAnalytics = services.holeAnalytics;
    void listHoleAnalyticsVersions(holeId, holeAnalytics)
      .then((nextVersions) => {
        if (active) setVersions(nextVersions);
      })
      .catch(() => {
        if (active) setVersions([]);
      });

    void getHoleAnalytics(
        holeId,
        holeAnalytics,
        selected === "current" ? {} : { completionId: selected },
      )
      .then((nextAnalytics) => {
        if (!active) return;
        setAnalytics(nextAnalytics);
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error ? error.message : "Unable to load Hole analytics.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [holeId, selected]);

  return (
    <div className="space-y-4" data-testid="hole-analytics-dashboard">
      <StagePageHeader
        eyebrow="Analytics"
        title="Hole statistics"
        description={`Run, Shift, bit, barrel and Survey records for ${holeId}.`}
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
        action={
          <Link
            href={runbookRoutes.currentHole(holeId)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-4 font-semibold"
          >
            Overview
          </Link>
        }
      />

      {versions.length > 0 ? (
        <fieldset
          className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
          data-testid="hole-analytics-version-selector"
        >
          <legend className="px-1 font-bold">Analytics view</legend>
          <div className="mt-2 space-y-2">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="analytics-view"
                checked={selected === "current"}
                onChange={() => {
                  setLoading(true);
                  setSelected("current");
                }}
              />
              <span>Current active Hole</span>
            </label>
            {versions.map((version) => (
              <label
                key={version.completionId}
                className="flex min-h-11 items-center gap-3"
              >
                <input
                  type="radio"
                  name="analytics-view"
                  checked={selected === version.completionId}
                  onChange={() => {
                    setLoading(true);
                    setSelected(version.completionId);
                  }}
                />
                <span>
                  {version.label}
                  {version.superseded ? " (superseded)" : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {message ? (
        <p role="alert" className="text-sm text-[var(--tl-danger,#b42318)]">
          {message}
        </p>
      ) : null}

      {loading || analytics === null ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">Loading analytics…</p>
      ) : (
        <div className="space-y-4">
          {analytics.completionId ? (
            <p className="text-sm text-[var(--tl-ink-muted)]">
              Showing completion snapshot {analytics.completionId}.
            </p>
          ) : null}
          <HoleRunStatisticsPanel analytics={analytics} />
          <HoleShiftStatisticsPanel analytics={analytics} />
          <HoleBitStatisticsPanel analytics={analytics} />
          <HoleBarrelChangesPanel analytics={analytics} />
          <HoleSurveyRegisterPanel analytics={analytics} />
        </div>
      )}
    </div>
  );
}
