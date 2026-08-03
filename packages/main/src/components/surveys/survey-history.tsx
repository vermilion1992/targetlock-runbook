"use client";

import { Compass, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { StatusPill } from "@/components/field/status-pill";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  calculateSurveyStatistics,
  formatMetres,
  formatTenths,
  type Decimetres,
  type Survey,
} from "@/domain";

const SURVEY_TABLE_HEADERS = [
  "Depth",
  "Dip",
  "Azimuth",
  "Reference",
  "Tool",
  "Recorded",
] as const;

const SURVEY_MOBILE_HEADERS = [
  { key: "depth", label: "Depth", title: "Depth" },
  { key: "dip", label: "Dip", title: "Dip" },
  { key: "az", label: "Az", title: "Azimuth" },
  { key: "tool", label: "Tool", title: "Tool" },
] as const;

function referenceLabel(reference: Survey["northReference"]): string {
  return reference === "NOT_SPECIFIED"
    ? "Not specified"
    : `${reference[0]}${reference.slice(1).toLocaleLowerCase("en-AU")}`;
}

function referenceShort(reference: Survey["northReference"]): string {
  switch (reference) {
    case "MAGNETIC":
      return "Mag";
    case "TRUE":
      return "True";
    case "GRID":
      return "Grid";
    default:
      return "—";
  }
}

function sortSurveysShallowToDeep(surveys: readonly Survey[]): Survey[] {
  return [...surveys].sort((left, right) => {
    if (left.depthDm !== right.depthDm) return left.depthDm - right.depthDm;
    return Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
  });
}

export function SurveyHistory({ holeId }: { holeId: string }) {
  const [surveys, setSurveys] = useState<readonly Survey[]>([]);
  const [currentDepth, setCurrentDepth] = useState<Decimetres | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      services.surveys.listByHole(holeId),
      getCurrentHoleState(holeId, services.currentState),
    ])
      .then(([records, state]) => {
        setSurveys(records);
        setCurrentDepth(state.currentDepthDm);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Survey history could not be loaded.",
        ),
      );
  }, [holeId]);

  const ordered = useMemo(() => sortSurveysShallowToDeep(surveys), [surveys]);

  const statistics =
    currentDepth === null
      ? null
      : calculateSurveyStatistics(surveys, currentDepth, new Set());

  const depthRangeLabel =
    ordered.length === 0
      ? "No surveys yet"
      : `${formatMetres(ordered[0]!.depthDm)}–${formatMetres(ordered.at(-1)!.depthDm)}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Surveys"
        title={`${holeId} surveys`}
        description="Manual survey records ordered from collar toward current depth."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
      />
      {error ? <p role="alert">{error}</p> : null}

      <Link
        href={runbookRoutes.addSurvey(holeId)}
        className="tl-action-primary flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-5 font-bold text-white no-underline"
      >
        <Plus aria-hidden="true" className="size-5" />
        Add survey
      </Link>

      {statistics ? (
        <section
          aria-label="Survey statistics"
          className="grid grid-cols-2 gap-3"
        >
          <MetricDisplay label="Total surveys" value={statistics.totalSurveys} />
          <MetricDisplay
            label="Latest depth"
            value={
              statistics.latestSurveyDepthDm === undefined
                ? "—"
                : formatMetres(statistics.latestSurveyDepthDm)
            }
            emphasis="strong"
          />
        </section>
      ) : null}

      <section
        aria-labelledby="survey-records-heading"
        className="overflow-hidden rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-sm)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="survey-records-heading" className="font-bold">
              Survey records
            </h2>
            <p className="mt-0.5 text-sm text-[var(--tl-ink-muted)]">
              {depthRangeLabel}
            </p>
          </div>
          <StatusPill tone="info">
            <Compass aria-hidden="true" className="size-4" />
            {ordered.length}
          </StatusPill>
        </header>

        {ordered.length === 0 ? (
          <p className="p-6 text-center text-[var(--tl-ink-muted)]">
            No surveys recorded yet.
          </p>
        ) : (
          <>
            <div className="md:hidden">
              <table
                className="w-full table-fixed border-collapse text-left text-sm"
                data-testid="survey-records-table-mobile"
              >
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[38%]" />
                </colgroup>
                <thead className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tl-ink-muted)]">
                  <tr>
                    {SURVEY_MOBILE_HEADERS.map((header) => (
                      <th
                        key={header.key}
                        title={header.title}
                        scope="col"
                        className="px-3 py-2"
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((survey) => (
                    <tr
                      key={survey.localId}
                      className="border-t border-[var(--tl-border)]"
                    >
                      <th scope="row" className="px-3 py-2.5 font-bold">
                        <Link
                          href={runbookRoutes.surveyDetail(
                            holeId,
                            survey.localId,
                          )}
                          className="tl-tabular text-[var(--tl-primary)] no-underline"
                        >
                          {formatMetres(survey.depthDm)}
                        </Link>
                        <span className="mt-0.5 block text-[0.65rem] font-semibold text-[var(--tl-ink-muted)]">
                          {referenceShort(survey.northReference)}
                        </span>
                      </th>
                      <td className="px-3 py-2.5 tl-tabular">
                        {formatTenths(survey.dipTenths)}°
                      </td>
                      <td className="px-3 py-2.5 tl-tabular">
                        {formatTenths(survey.azimuthTenths)}°
                      </td>
                      <td className="truncate px-3 py-2.5 text-[var(--tl-ink-muted)]">
                        {survey.toolNameSnapshot ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table
                className="w-full border-collapse text-left"
                data-testid="survey-records-table"
              >
                <thead className="text-xs uppercase text-[var(--tl-ink-muted)]">
                  <tr>
                    {SURVEY_TABLE_HEADERS.map((heading) => (
                      <th key={heading} className="px-4 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((survey) => (
                    <tr
                      key={survey.localId}
                      className="border-t border-[var(--tl-border)]"
                    >
                      <th className="px-4 py-3">
                        <Link
                          href={runbookRoutes.surveyDetail(
                            holeId,
                            survey.localId,
                          )}
                          className="tl-tabular font-bold text-[var(--tl-primary)] no-underline"
                        >
                          {formatMetres(survey.depthDm)}
                        </Link>
                      </th>
                      <td className="px-4 py-3 tl-tabular">
                        {formatTenths(survey.dipTenths)}°
                      </td>
                      <td className="px-4 py-3 tl-tabular">
                        {formatTenths(survey.azimuthTenths)}°
                      </td>
                      <td className="px-4 py-3">
                        {referenceLabel(survey.northReference)}
                      </td>
                      <td className="px-4 py-3">
                        {survey.toolNameSnapshot ?? "Not specified"}
                        {survey.toolSerialSnapshot
                          ? ` · ${survey.toolSerialSnapshot}`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--tl-ink-muted)]">
                        {formatFieldDateTime(survey.recordedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
