"use client";

import { ArrowLeft, FileSpreadsheet, FileText, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  downloadReport,
  listGeneratedReports,
  shareReport,
} from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  REPORT_FORMATS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  formatMetres,
  type GeneratedReportRecord,
  type ReportActivityStatus,
  type ReportFormat,
  type ReportType,
} from "@/domain";

const ACTOR = {
  userId: "user-supervisor-lee",
  userName: "Morgan Lee",
} as const;

export function ReportActivity({ holeId }: { holeId: string }) {
  const [reports, setReports] = useState<readonly GeneratedReportRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState<ReportType | "">("");
  const [formatFilter, setFormatFilter] = useState<ReportFormat | "">("");
  const [statusFilter, setStatusFilter] = useState<ReportActivityStatus | "">(
    "",
  );
  const [dateFilter, setDateFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void listGeneratedReports(holeId, services)
      .then(setReports)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Report Activity could not be loaded.",
        ),
      );
  }, [holeId]);

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      if (typeFilter && report.reportType !== typeFilter) return false;
      if (formatFilter && report.format !== formatFilter) return false;
      if (statusFilter && report.activityStatus !== statusFilter) return false;
      if (dateFilter && !report.generatedAt.startsWith(dateFilter)) return false;
      return true;
    });
  }, [dateFilter, formatFilter, reports, statusFilter, typeFilter]);

  async function onDownload(report: GeneratedReportRecord) {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    try {
      await downloadReport(
        {
          operationId: `download-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: ACTOR.userId,
          userName: ACTOR.userName,
        },
        services,
      );
      setMessage(`Downloaded ${report.format}. Not sent.`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Download failed.");
    }
  }

  async function onShare(report: GeneratedReportRecord) {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    try {
      const result = await shareReport(
        {
          operationId: `share-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: ACTOR.userId,
          userName: ACTOR.userName,
        },
        services,
      );
      if (result.status === "shared") {
        setMessage("Shared again. Not delivered by TargetLock.");
      } else if (result.status === "cancelled") {
        setMessage("Share cancelled.");
      } else {
        setMessage("Downloaded as share fallback. Not sent.");
      }
      const next = await listGeneratedReports(holeId, services);
      setReports(next);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Share failed.");
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 6 · report activity"
        title="Report Activity"
        description="Locally generated report versions for this hole. Status means generated, downloaded, shared, or drafted — never delivered."
      />

      <Link
        href={runbookRoutes.reports(holeId)}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--tl-primary)] no-underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to Report Centre
      </Link>

      <section
        aria-label="Filters"
        className="grid gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="text-sm font-semibold">
          Type
          <select
            className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-transparent px-2"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as ReportType | "")
            }
          >
            <option value="">All</option>
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Format
          <select
            className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-transparent px-2"
            value={formatFilter}
            onChange={(event) =>
              setFormatFilter(event.target.value as ReportFormat | "")
            }
          >
            <option value="">All</option>
            {REPORT_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Status
          <select
            className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-transparent px-2"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ReportActivityStatus | "")
            }
          >
            <option value="">All</option>
            <option value="GENERATED">Generated</option>
            <option value="DOWNLOADED">Downloaded</option>
            <option value="SHARED">Shared</option>
            <option value="EMAIL_DRAFT">Email draft</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Date
          <input
            type="date"
            className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-transparent px-2"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </label>
      </section>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-[var(--tl-ink-muted)]">
        {message}
      </p>
      {error ? (
        <div role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <ul className="grid gap-3 lg:hidden">
        {filtered.map((report) => (
          <li
            key={report.localId}
            className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
          >
            <p className="font-bold uppercase tracking-wide text-[var(--tl-ink)]">
              {REPORT_TYPE_LABELS[report.reportType]}
            </p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              {report.format} · Version {report.version}
            </p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              Generated {formatFieldDateTime(report.generatedAt)}
            </p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              Generated by {report.generatedByNameSnapshot}
            </p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              Hole-depth snapshot {formatMetres(report.holeDepthSnapshotDm)}
            </p>
            <div className="mt-2">
              <StatusPill tone="info">
                {report.activityStatus.replaceAll("_", " ")}
              </StatusPill>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold"
                onClick={() => void onDownload(report)}
                aria-label={`Download ${report.format}`}
              >
                Download
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold"
                onClick={() => void onShare(report)}
                aria-label={`Share ${report.format} again`}
              >
                Share again
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--tl-border)]">
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Generated</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Depth</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((report) => (
              <tr
                key={report.localId}
                className="border-b border-[var(--tl-border)]"
              >
                <td className="px-3 py-3 font-semibold">
                  {REPORT_TYPE_LABELS[report.reportType]}
                </td>
                <td className="px-3 py-3">{report.format}</td>
                <td className="px-3 py-3">{report.version}</td>
                <td className="px-3 py-3">
                  {formatFieldDateTime(report.generatedAt)}
                </td>
                <td className="px-3 py-3">{report.generatedByNameSnapshot}</td>
                <td className="px-3 py-3">
                  {formatMetres(report.holeDepthSnapshotDm)}
                </td>
                <td className="px-3 py-3">
                  <StatusPill tone="info">
                    {report.activityStatus.replaceAll("_", " ")}
                  </StatusPill>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-2 font-bold"
                      onClick={() => void onDownload(report)}
                      aria-label={`Download ${report.format}`}
                    >
                      {report.format === "PDF" ? (
                        <FileText aria-hidden="true" className="size-4" />
                      ) : (
                        <FileSpreadsheet aria-hidden="true" className="size-4" />
                      )}
                      Download
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-2 font-bold"
                      onClick={() => void onShare(report)}
                      aria-label={`Share ${report.format} again`}
                    >
                      <Share2 aria-hidden="true" className="size-4" />
                      Share again
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LocalPrototypeNotice />
    </div>
  );
}
