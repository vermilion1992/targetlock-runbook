"use client";

import { Edit3, ImageIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { LocalMediaImage } from "@/components/media/local-media-image";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  formatMetres,
  formatTenths,
  type Photo,
  type Survey,
  type RunbookShift,
} from "@/domain";
import type { SurveyCorrection } from "@/infrastructure/surveys";

export function SurveyDetail({
  holeId,
  surveyId,
}: {
  holeId: string;
  surveyId: string;
}) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [shift, setShift] = useState<RunbookShift | null>(null);
  const [corrections, setCorrections] = useState<
    readonly SurveyCorrection[]
  >([]);
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
      services.surveys.getById(surveyId, holeId),
      services.surveys.listCorrections(surveyId, holeId),
      services.shifts.listByHole(holeId),
    ])
      .then(async ([record, history, shifts]) => {
        if (record === null || record.holeId !== holeId) {
          throw new Error("Survey was not found.");
        }
        setSurvey(record);
        setCorrections(history);
        setShift(
          shifts.find(({ localId }) => localId === record.shiftId) ?? null,
        );
        if (record.photoId) {
          setPhoto(await services.photos.getById(record.photoId, holeId));
        }
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Survey detail could not be loaded.",
        ),
      );
  }, [holeId, surveyId]);

  if (error) return <p role="alert">{error}</p>;
  if (survey === null) return <p role="status">Loading survey…</p>;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 4 · survey detail"
        title={`Survey — ${formatMetres(survey.depthDm)}`}
        description="The searchable runbook values and immutable correction history."
        backTarget={namedBackTarget(runbookRoutes.surveys(holeId), "Surveys")}
        action={
          <Link
            href={runbookRoutes.correctSurvey(holeId, survey.localId)}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 font-bold no-underline"
          >
            <Edit3 aria-hidden="true" className="size-4" />
            Edit survey
          </Link>
        }
      />
      <SectionPanel title="Survey result">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricDisplay label="Depth" value={formatMetres(survey.depthDm)} emphasis="strong" />
          <MetricDisplay label="Dip" value={`${formatTenths(survey.dipTenths)}°`} />
          <MetricDisplay
            label="Azimuth"
            value={`${formatTenths(survey.azimuthTenths)}°`}
          />
          <MetricDisplay
            label="Reference"
            value={survey.northReference.replace("_", " ")}
          />
          <MetricDisplay label="Tool" value={survey.toolNameSnapshot ?? "Not specified"} />
          <MetricDisplay
            label="Tool serial"
            value={survey.toolSerialSnapshot ?? "Not specified"}
          />
          <MetricDisplay label="Recorded by" value={survey.recordedByNameSnapshot} />
          <MetricDisplay
            label="Recorded"
            value={formatFieldDateTime(survey.recordedAt)}
          />
        </div>
        {shift ? (
          <p className="mt-4 text-sm text-[var(--tl-ink-muted)]">
            Shift: {shift.shiftType === "DAY" ? "Day Shift" : "Night Shift"} —{" "}
            {shift.shiftDate}
          </p>
        ) : null}
        {survey.comment ? (
          <div className="mt-4 rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-raised)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
              Comment
            </p>
            <p className="mt-1">{survey.comment}</p>
          </div>
        ) : null}
      </SectionPanel>

      {photo ? (
        <SectionPanel
          title="Result photograph"
          description="Supporting evidence only; entered values remain the official searchable record."
        >
          <div className="max-w-3xl overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)]">
            <LocalMediaImage
              photo={photo}
              alt={
                photo.description ??
                `Survey result photograph at ${formatMetres(survey.depthDm)}`
              }
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        </SectionPanel>
      ) : (
        <div className="flex items-center gap-3 rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] p-4 text-[var(--tl-ink-muted)]">
          <ImageIcon aria-hidden="true" className="size-5" />
          No result photograph was attached.
        </div>
      )}

      <SectionPanel
        title="Correction history"
        description="Corrections never erase the values that were previously recorded."
      >
        {corrections.length > 0 ? (
          <ul className="space-y-3">
            {corrections.map((correction) => (
              <li
                key={correction.id}
                className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] p-4"
              >
                <p className="font-bold">
                  {correction.fieldName}: {String(correction.previousValue)} →{" "}
                  {String(correction.correctedValue)}
                </p>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  {correction.reason} · {correction.correctedByNameSnapshot} ·{" "}
                  {formatFieldDateTime(correction.correctedAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--tl-ink-muted)]">No local corrections.</p>
        )}
      </SectionPanel>
    </div>
  );
}
