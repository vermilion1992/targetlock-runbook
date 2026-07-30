"use client";

import { FileSpreadsheet, FileText, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  downloadReport,
  evaluateGeneratedReportCurrency,
  listGeneratedReports,
  openReport,
  shareReport,
} from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import { formatFieldDateTime } from "@/components/holes/prototype-format";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { useOperatorSession } from "@/components/session";
import {
  REPORT_FORMATS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  formatFileSize,
  formatMetres,
  type GeneratedReportRecord,
  type ReportActivityStatus,
  type ReportCurrencyResult,
  type ReportFormat,
  type ReportGenerationTransaction,
  type ReportType,
} from "@/domain";

export function ReportActivity({ holeId }: { holeId: string }) {
  const { session } = useOperatorSession();
  const [reports, setReports] = useState<readonly GeneratedReportRecord[]>([]);
  const [failedOps, setFailedOps] = useState<
    readonly ReportGenerationTransaction[]
  >([]);
  const [currencyById, setCurrencyById] = useState<
    ReadonlyMap<string, ReportCurrencyResult>
  >(new Map());
  const [typeFilter, setTypeFilter] = useState<ReportType | "">("");
  const [formatFilter, setFormatFilter] = useState<ReportFormat | "">("");
  const [statusFilter, setStatusFilter] = useState<ReportActivityStatus | "">(
    "",
  );
  const [dateFilter, setDateFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    const [list, failed] = await Promise.all([
      listGeneratedReports(holeId, services),
      services.reports.listFailedTransactions(holeId),
    ]);
    setReports(list);
    setFailedOps(failed);
    const currencyEntries = await Promise.all(
      list.map(async (report) => {
        const result = await evaluateGeneratedReportCurrency(report, services);
        return [report.localId, result] as const;
      }),
    );
    setCurrencyById(new Map(currencyEntries));
  }

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Report Activity could not be loaded.",
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hole load
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

  async function onOpen(report: GeneratedReportRecord) {
    if (session === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) return;
    try {
      const result = await openReport(
        {
          operationId: `open-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: session.operator.localId,
          userName: session.operator.displayName,
          userRole: session.operator.role,
        },
        services,
      );
      setMessage(
        result.status === "popup_blocked"
          ? `Popup blocked. Download started for ${result.filename}.`
          : `Opened ${result.filename}.`,
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Open failed.");
    }
  }

  async function onDownload(report: GeneratedReportRecord) {
    if (session === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) return;
    try {
      const result = await downloadReport(
        {
          operationId: `download-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: session.operator.localId,
          userName: session.operator.displayName,
          userRole: session.operator.role,
        },
        services,
      );
      setMessage(`Download started: ${result.filename}`);
      await refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Download failed.");
    }
  }

  async function onShare(report: GeneratedReportRecord) {
    if (session === null) return;
    const services = createBrowserRunbookServices();
    if (services === null) return;
    try {
      const result = await shareReport(
        {
          operationId: `share-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: session.operator.localId,
          userName: session.operator.displayName,
          userRole: session.operator.role,
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
      await refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Share failed.");
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Reports"
        title="Report Activity"
        description="Locally generated report versions for this hole. Status means generated, downloaded, shared, or drafted — never delivered."
        backTarget={namedBackTarget(runbookRoutes.reports(holeId), "Reports")}
      />

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

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-[var(--tl-ink-muted)]"
      >
        {message}
      </p>
      {error ? (
        <div role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {failedOps.length > 0 ? (
        <section aria-labelledby="failed-heading" className="space-y-2">
          <h2 id="failed-heading" className="text-base font-bold">
            Failed operations
          </h2>
          <ul className="grid gap-2">
            {failedOps.map((op) => (
              <li
                key={op.operationId}
                className="rounded-[var(--tl-radius-sm)] border border-amber-600 p-3 text-sm"
              >
                <p className="font-bold uppercase tracking-wide">Not generated</p>
                <p>
                  {REPORT_TYPE_LABELS[op.reportType]} · {op.format} · failed at{" "}
                  {op.stage.replaceAll("_", " ")}
                </p>
                <p>{op.failureReason ?? "Unknown failure"}</p>
                <Link
                  href={runbookRoutes.reports(holeId)}
                  className="mt-2 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)] no-underline"
                >
                  Retry in Report Centre
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="grid gap-3 lg:hidden">
        {filtered.map((report) => {
          const currency = currencyById.get(report.localId);
          return (
            <li
              key={report.localId}
              className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4"
            >
              <p className="font-bold uppercase tracking-wide text-[var(--tl-ink)]">
                {REPORT_TYPE_LABELS[report.reportType]}
              </p>
              <p className="mt-1 break-all text-sm text-[var(--tl-ink-muted)]">
                {report.filename}
              </p>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                {report.format} · Version {report.version} ·{" "}
                {formatFileSize(report.sizeBytes)}
              </p>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Generated {formatFieldDateTime(report.generatedAt)} by{" "}
                {report.generatedByNameSnapshot}
              </p>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Hole-depth snapshot {formatMetres(report.holeDepthSnapshotDm)} ·{" "}
                {report.holeStatusSnapshot}
              </p>
              {currency?.status === "out_of_date" ? (
                <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Historical report / Generated before the latest Hole changes
                </p>
              ) : null}
              <div className="mt-2">
                <StatusPill tone="info">
                  {report.activityStatus.replaceAll("_", " ")}
                </StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.format === "PDF" ? (
                  <button
                    type="button"
                    className="min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold"
                    onClick={() => void onOpen(report)}
                    aria-label={`Open PDF ${report.filename}`}
                  >
                    Open PDF
                  </button>
                ) : null}
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
                <Link
                  href={runbookRoutes.reports(holeId)}
                  className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold no-underline"
                >
                  Generate New Version
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--tl-border)]">
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Filename</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Generated</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Depth</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((report) => {
              const currency = currencyById.get(report.localId);
              return (
                <tr
                  key={report.localId}
                  className="border-b border-[var(--tl-border)]"
                >
                  <td className="px-3 py-3 font-semibold">
                    {REPORT_TYPE_LABELS[report.reportType]}
                    {currency?.status === "out_of_date" ? (
                      <span className="mt-1 block text-xs font-normal text-amber-800 dark:text-amber-200">
                        Historical report
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{report.format}</td>
                  <td className="px-3 py-3">{report.version}</td>
                  <td className="max-w-[14rem] break-all px-3 py-3">
                    {report.filename}
                  </td>
                  <td className="px-3 py-3">
                    {formatFileSize(report.sizeBytes)}
                  </td>
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
                    <div className="flex flex-wrap gap-2">
                      {report.format === "PDF" ? (
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-2 font-bold"
                          onClick={() => void onOpen(report)}
                          aria-label={`Open PDF ${report.filename}`}
                        >
                          Open PDF
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-2 font-bold"
                        onClick={() => void onDownload(report)}
                        aria-label={`Download ${report.format}`}
                      >
                        {report.format === "PDF" ? (
                          <FileText aria-hidden="true" className="size-4" />
                        ) : (
                          <FileSpreadsheet
                            aria-hidden="true"
                            className="size-4"
                          />
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
              );
            })}
          </tbody>
        </table>
      </div>

      <LocalPrototypeNotice />
    </div>
  );
}
