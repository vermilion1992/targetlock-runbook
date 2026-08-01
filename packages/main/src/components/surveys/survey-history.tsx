"use client";

import { Compass, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { StatusPill } from "@/components/field/status-pill";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  calculateSurveyStatistics,
  formatMetres,
  formatTenths,
  type Decimetres,
  type Survey,
} from "@/domain";

function referenceLabel(reference: Survey["northReference"]): string {
  return reference === "NOT_SPECIFIED"
    ? "Not specified"
    : `${reference[0]}${reference.slice(1).toLocaleLowerCase("en-AU")}`;
}

export function SurveyHistory({ holeId }: { holeId: string }) {
  const [surveys, setSurveys] = useState<readonly Survey[]>([]);
  const [currentDepth, setCurrentDepth] = useState<Decimetres | null>(null);
  const [correctedIds, setCorrectedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [search, setSearch] = useState("");
  const [reference, setReference] = useState("");
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
      services.audits.listByHole(holeId),
    ])
      .then(([records, state, audits]) => {
        setSurveys(records);
        setCurrentDepth(state.currentDepthDm);
        setCorrectedIds(
          new Set(
            audits
              .filter(({ action }) => action === "survey_corrected")
              .map(({ entityId }) => entityId),
          ),
        );
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Survey history could not be loaded.",
        ),
      );
  }, [holeId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-AU");
    return surveys.filter((survey) => {
      const matchesSearch =
        query.length === 0 ||
        formatMetres(survey.depthDm).toLocaleLowerCase("en-AU").includes(query) ||
        survey.toolNameSnapshot?.toLocaleLowerCase("en-AU").includes(query) ||
        survey.toolSerialSnapshot?.toLocaleLowerCase("en-AU").includes(query);
      return (
        matchesSearch &&
        (reference.length === 0 || survey.northReference === reference)
      );
    });
  }, [reference, search, surveys]);

  const statistics =
    currentDepth === null
      ? null
      : calculateSurveyStatistics(surveys, currentDepth, correctedIds);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Surveys"
        title={`${holeId} surveys`}
        description="Repository-backed manual survey records, ordered deepest and latest first."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
        action={
          <Link
            href={runbookRoutes.addSurvey(holeId)}
            className="tl-action-primary inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
          >
            <Plus aria-hidden="true" className="size-5" />
            Add survey
          </Link>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      <Link
        href={runbookRoutes.surveyTools(holeId)}
        className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
      >
        Manage survey tools
      </Link>

      {statistics ? (
        <section aria-label="Survey statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <MetricDisplay
            label="Distance since"
            value={
              statistics.distanceSinceLatestDm === undefined
                ? "—"
                : formatMetres(statistics.distanceSinceLatestDm)
            }
          />
          <MetricDisplay
            label="Average spacing"
            value={
              statistics.averageSpacingDm === undefined
                ? "—"
                : formatMetres(statistics.averageSpacingDm)
            }
          />
          <MetricDisplay
            label="Largest gap"
            value={
              statistics.largestGapDm === undefined
                ? "—"
                : formatMetres(statistics.largestGapDm)
            }
          />
          <MetricDisplay label="Tools used" value={statistics.toolsUsed} />
          <MetricDisplay
            label="With photos"
            value={statistics.surveysWithPhotographs}
          />
          <MetricDisplay
            label="Corrections / repeats"
            value={`${statistics.correctedSurveys} / ${statistics.duplicateDepthSurveys}`}
          />
        </section>
      ) : null}

      <section
        aria-labelledby="survey-filter-heading"
        className="grid gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 sm:grid-cols-2"
      >
        <h2 id="survey-filter-heading" className="sr-only">
          Search survey history
        </h2>
        <label>
          <span className="text-sm font-bold">Depth, tool or serial</span>
          <span className="relative mt-2 block">
            <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-[var(--tl-ink-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pl-10 pr-3"
            />
          </span>
        </label>
        <label>
          <span className="text-sm font-bold">North reference</span>
          <select
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"
          >
            <option value="">All references</option>
            <option value="MAGNETIC">Magnetic North</option>
            <option value="TRUE">True North</option>
            <option value="GRID">Grid North</option>
            <option value="NOT_SPECIFIED">Not specified</option>
          </select>
        </label>
      </section>

      <section aria-labelledby="survey-records-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="survey-records-heading" className="text-lg font-bold">
            Survey records
          </h2>
          <StatusPill tone="info">
            <Compass aria-hidden="true" className="size-4" />
            {filtered.length}
          </StatusPill>
        </div>
        <div className="space-y-3 md:hidden">
          {filtered.map((survey) => (
            <Link
              key={survey.localId}
              href={runbookRoutes.surveyDetail(holeId, survey.localId)}
              className="block rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 no-underline shadow-[var(--tl-shadow-sm)]"
            >
              <strong className="tl-tabular text-xl text-[var(--tl-ink)]">
                {formatMetres(survey.depthDm)}
              </strong>
              <p className="mt-2 font-bold text-[var(--tl-ink)]">
                Dip {formatTenths(survey.dipTenths)}° · Azimuth{" "}
                {formatTenths(survey.azimuthTenths)}°{" "}
                {referenceLabel(survey.northReference)}
              </p>
              <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
                {survey.toolNameSnapshot ?? "No tool specified"}
                {survey.toolSerialSnapshot
                  ? ` · ${survey.toolSerialSnapshot}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
                {formatFieldDateTime(survey.recordedAt)}
              </p>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] md:block">
          <table className="w-full border-collapse bg-[var(--tl-surface)] text-left">
            <thead className="bg-[var(--tl-surface-raised)] text-xs uppercase text-[var(--tl-ink-muted)]">
              <tr>
                {["Depth", "Dip", "Azimuth", "Reference", "Tool", "Recorded"].map(
                  (heading) => (
                    <th key={heading} className="px-4 py-3">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((survey) => (
                <tr key={survey.localId} className="border-t border-[var(--tl-border)]">
                  <td className="px-4 py-3 font-bold">
                    <Link href={runbookRoutes.surveyDetail(holeId, survey.localId)}>
                      {formatMetres(survey.depthDm)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatTenths(survey.dipTenths)}°</td>
                  <td className="px-4 py-3">{formatTenths(survey.azimuthTenths)}°</td>
                  <td className="px-4 py-3">{referenceLabel(survey.northReference)}</td>
                  <td className="px-4 py-3">
                    {survey.toolNameSnapshot ?? "Not specified"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatFieldDateTime(survey.recordedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <p className="rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] p-6 text-center text-[var(--tl-ink-muted)]">
            No surveys match this search.
          </p>
        ) : null}
      </section>
      <LocalPrototypeNotice />
    </div>
  );
}
