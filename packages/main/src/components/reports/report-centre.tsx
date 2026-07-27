"use client";

import {
  FileSpreadsheet,
  FileText,
  History,
  Mail,
  Share2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import {
  createBrowserRunbookServices,
  downloadReport,
  evaluateGeneratedReportCurrency,
  generateReport,
  listGeneratedReports,
  openReport,
  prepareEmailDraft,
  shareReport,
  type ReportGenerationProgress,
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
  REPORT_FORMATS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  formatFileSize,
  formatMetres,
  type GeneratedReportRecord,
  type ReportCurrencyResult,
  type ReportFormat,
  type ReportGenerationTransaction,
  type ReportType,
  type SavedReportRecipient,
} from "@/domain";

const ACTOR = {
  userId: "user-supervisor-lee",
  userName: "Morgan Lee",
} as const;

function activityTone(
  status: GeneratedReportRecord["activityStatus"],
): "success" | "info" | "warning" | "neutral" {
  if (status === "SHARED" || status === "GENERATED") return "success";
  if (status === "FAILED") return "warning";
  if (status === "EMAIL_DRAFT" || status === "DOWNLOADED") return "info";
  return "neutral";
}

function relativeGeneratedLabel(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(deltaMs) || deltaMs < 60_000) return "Generated just now";
  if (deltaMs < 3_600_000) {
    return `Generated ${Math.floor(deltaMs / 60_000)} min ago`;
  }
  return `Generated ${formatFieldDateTime(iso)}`;
}

export function ReportCentre({ holeId }: { holeId: string }) {
  const progressId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const [reportType, setReportType] = useState<ReportType>("FULL_HOLE_RUNBOOK");
  const [formats, setFormats] = useState<ReadonlySet<ReportFormat>>(
    new Set(["PDF", "XLSX"]),
  );
  const [reports, setReports] = useState<readonly GeneratedReportRecord[]>([]);
  const [currencyById, setCurrencyById] = useState<
    ReadonlyMap<string, ReportCurrencyResult>
  >(new Map());
  const [failedOps, setFailedOps] = useState<
    readonly ReportGenerationTransaction[]
  >([]);
  const [recipients, setRecipients] = useState<readonly SavedReportRecipient[]>(
    [],
  );
  const [holeStatus, setHoleStatus] = useState("Active");
  const [depthLabel, setDepthLabel] = useState<string>("—");
  const [progress, setProgress] = useState<ReportGenerationProgress | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successReport, setSuccessReport] =
    useState<GeneratedReportRecord | null>(null);
  const [successDismissed, setSuccessDismissed] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailReportId, setEmailReportId] = useState<string | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    const [list, lifecycle, failed] = await Promise.all([
      listGeneratedReports(holeId, services),
      services.completion.getLifecycleState(holeId),
      services.reports.listFailedTransactions(holeId),
    ]);
    const recipientList = await services.reports.listRecipients({
      holeId,
      projectId: lifecycle?.hole.projectId,
    });
    setReports(list);
    setFailedOps(failed);
    setRecipients(recipientList);
    if (lifecycle) {
      setHoleStatus(lifecycle.hole.status);
      const completion = await services.completion.getLatestCompletion(holeId);
      const depth =
        completion?.snapshot.finalDepthDm ??
        lifecycle.hole.currentDepth;
      setDepthLabel(formatMetres(depth));
    }
    const defaults = recipientList.filter((item) => item.isDefault);
    if (defaults[0] && toEmail.length === 0) {
      setToEmail(defaults.map((item) => item.email).join(", "));
    }

    const currencyEntries = await Promise.all(
      list.slice(0, 12).map(async (report) => {
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
            : "Report Centre could not be loaded.",
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [holeId]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function toggleFormat(format: ReportFormat) {
    setFormats((current) => {
      const next = new Set(current);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  }

  async function onGenerate(options?: {
    readonly type?: ReportType;
    readonly format?: ReportFormat;
  }) {
    setError(null);
    setStatusMessage(null);
    setSuccessDismissed(false);
    const selectedType = options?.type ?? reportType;
    const selectedFormats = options?.format
      ? [options.format]
      : REPORT_FORMATS.filter((format) => formats.has(format));
    if (selectedFormats.length === 0) {
      setError("Select at least one format.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    setBusy(true);
    setProgress("Building report snapshot…");
    try {
      let lastReport: GeneratedReportRecord | null = null;
      for (const format of selectedFormats) {
        const operationId = `report-${holeId}-${selectedType}-${format}-${crypto.randomUUID()}`;
        const result = await generateReport(
          {
            operationId,
            holeId,
            reportType: selectedType,
            format,
            csvDataset: format === "CSV" ? "runs" : undefined,
            generatedByUserId: ACTOR.userId,
            generatedByNameSnapshot: ACTOR.userName,
            onProgress: setProgress,
          },
          services,
        );
        lastReport = result.report;
        setStatusMessage(
          `${REPORT_TYPE_LABELS[selectedType]} ${format} Version ${result.report.version} generated locally.`,
        );
      }
      setProgress(null);
      if (lastReport) {
        setSuccessReport(lastReport);
      }
      await refresh();
    } catch (caught: unknown) {
      setProgress(null);
      setSuccessReport(null);
      setError(
        caught instanceof Error ? caught.message : "Report generation failed.",
      );
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function onOpen(report: GeneratedReportRecord) {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    setBusy(true);
    try {
      const result = await openReport(
        {
          operationId: `open-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: ACTOR.userId,
          userName: ACTOR.userName,
        },
        services,
      );
      if (result.status === "popup_blocked") {
        setStatusMessage(
          `Popup blocked. Download started for ${result.filename}.`,
        );
      } else {
        setStatusMessage(`Opened ${result.filename}.`);
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Open failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(report: GeneratedReportRecord) {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    setBusy(true);
    try {
      const result = await downloadReport(
        {
          operationId: `download-${report.localId}-${crypto.randomUUID()}`,
          reportId: report.localId,
          holeId,
          userId: ACTOR.userId,
          userName: ACTOR.userName,
        },
        services,
      );
      setStatusMessage(`Download started: ${result.filename}`);
      await refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onShare(report: GeneratedReportRecord) {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    setBusy(true);
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
        setStatusMessage(
          "Report shared from this device. Not delivered by TargetLock.",
        );
      } else if (result.status === "cancelled") {
        setStatusMessage("Share cancelled. Report was not shared.");
      } else {
        setStatusMessage(
          "File sharing is unavailable here. The file was downloaded instead. Not sent.",
        );
      }
      await refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Share failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onPrepareEmail() {
    if (!emailReportId) return;
    const services = createBrowserRunbookServices();
    if (services === null) return;
    const to = toEmail
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (to.length === 0) {
      setError("Enter at least one To recipient.");
      return;
    }
    setBusy(true);
    try {
      await prepareEmailDraft(
        {
          operationId: `email-${emailReportId}-${crypto.randomUUID()}`,
          reportId: emailReportId,
          holeId,
          toRecipients: to,
          ccRecipients: ccEmail
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          userId: ACTOR.userId,
          userName: ACTOR.userName,
          openMailClient: true,
        },
        services,
      );
      setEmailOpen(false);
      setStatusMessage(
        "Email draft prepared. Attachment downloaded for manual attach. Not sent or delivered.",
      );
      await refresh();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Email draft failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function reportActions(report: GeneratedReportRecord) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {report.format === "PDF" ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
            onClick={() => void onOpen(report)}
            disabled={busy}
            aria-label={`Open PDF ${report.filename}`}
          >
            <FileText aria-hidden="true" className="size-4" />
            Open PDF
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
          onClick={() => void onDownload(report)}
          disabled={busy}
          aria-label={`Download ${report.format} ${report.filename}`}
        >
          {report.format === "PDF" ? (
            <FileText aria-hidden="true" className="size-4" />
          ) : (
            <FileSpreadsheet aria-hidden="true" className="size-4" />
          )}
          Download {report.format === "XLSX" ? "Excel" : report.format}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
          onClick={() => void onShare(report)}
          disabled={busy}
          aria-label={`Share ${report.format} ${report.filename}`}
        >
          <Share2 aria-hidden="true" className="size-4" />
          Share
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
          onClick={() => {
            setEmailReportId(report.localId);
            setEmailOpen(true);
          }}
          disabled={busy}
        >
          <Mail aria-hidden="true" className="size-4" />
          Prepare Email
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
          onClick={() =>
            void onGenerate({
              type: report.reportType,
              format: report.format,
            })
          }
          disabled={busy}
        >
          Generate New Version
        </button>
      </div>
    );
  }

  const showSuccess =
    successReport !== null &&
    !successDismissed &&
    reports.some((report) => report.localId === successReport.localId);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Reports"
        title="Reports"
        description="Generate local PDF, Excel and CSV runbook exports from repository data. Sharing opens a device share sheet or download — TargetLock does not send email."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
      />

      <p className="rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] bg-[var(--tl-surface-muted,transparent)] px-3 py-2 text-sm text-[var(--tl-ink-muted)]">
        Reports are stored on this device. They are not backed up or synchronised
        by Railway. Download important reports to permanent storage.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section
          aria-labelledby="report-options-heading"
          className="space-y-4 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
        >
          <div className="flex flex-wrap gap-4">
            <MetricDisplay label="Hole" value={holeId} />
            <MetricDisplay label="Status" value={holeStatus} />
            <MetricDisplay label="Final depth" value={depthLabel} />
          </div>

          <div>
            <h2
              id="report-options-heading"
              className="text-base font-bold text-[var(--tl-ink)]"
            >
              Report type
            </h2>
            <div
              role="radiogroup"
              aria-label="Report type"
              className="mt-2 grid gap-2 sm:grid-cols-2"
            >
              {REPORT_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 py-2"
                >
                  <input
                    type="radio"
                    name="report-type"
                    value={type}
                    checked={reportType === type}
                    onChange={() => setReportType(type)}
                    className="size-5"
                    disabled={busy}
                  />
                  <span className="text-sm font-semibold text-[var(--tl-ink)]">
                    {REPORT_TYPE_LABELS[type]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <fieldset>
            <legend className="text-base font-bold text-[var(--tl-ink)]">
              Format
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {REPORT_FORMATS.map((format) => (
                <label
                  key={format}
                  className="flex min-h-11 min-w-28 cursor-pointer items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3"
                >
                  <input
                    type="checkbox"
                    checked={formats.has(format)}
                    onChange={() => toggleFormat(format)}
                    className="size-5"
                    disabled={busy}
                  />
                  <span className="text-sm font-semibold">{format}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-44 items-center justify-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
            onClick={() => void onGenerate()}
            disabled={busy}
          >
            Generate report
          </button>

          {busy && progress ? (
            <div
              id={progressId}
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="space-y-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] p-3"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--tl-ink)]">
                Generating report
              </p>
              <p className="text-sm text-[var(--tl-ink-muted)]">{progress}</p>
              <div
                className="h-2 overflow-hidden rounded-full bg-[var(--tl-border)]"
                aria-hidden="true"
              >
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--tl-primary)]" />
              </div>
            </div>
          ) : (
            <p
              id={progressId}
              role="status"
              aria-live="polite"
              className="min-h-5 text-sm text-[var(--tl-ink-muted)]"
            >
              {statusMessage}
            </p>
          )}
        </section>

        <section
          aria-labelledby="recipients-heading"
          className="space-y-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
        >
          <h2
            id="recipients-heading"
            className="text-base font-bold text-[var(--tl-ink)]"
          >
            Saved recipients
          </h2>
          <p className="text-sm text-[var(--tl-ink-muted)]">
            Local defaults for Prepare Email. No messages are delivered by
            TargetLock.
          </p>
          <ul className="space-y-2">
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] px-3 py-2 text-sm"
              >
                <strong className="block text-[var(--tl-ink)]">
                  {recipient.displayName ?? recipient.email}
                </strong>
                <span className="text-[var(--tl-ink-muted)]">
                  {recipient.email} · {recipient.scope}
                  {recipient.isDefault ? " · default" : ""}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={runbookRoutes.reportHistory(holeId)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--tl-primary)] no-underline"
          >
            <History aria-hidden="true" className="size-4" />
            Report Activity
          </Link>
        </section>
      </div>

      {error ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--tl-radius-sm)] border border-red-500 bg-red-50 p-3 text-sm text-red-900 outline-none dark:bg-red-950 dark:text-red-100"
        >
          <p className="font-bold uppercase tracking-wide">Generation failed</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-[var(--tl-radius-sm)] border border-red-700 px-3 text-sm font-bold uppercase tracking-wide"
            onClick={() => void onGenerate()}
            disabled={busy}
          >
            Retry
          </button>
        </div>
      ) : null}

      {showSuccess && successReport ? (
        <section
          aria-labelledby="report-success-heading"
          className="rounded-[var(--tl-radius-md)] border border-emerald-600 bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="report-success-heading"
                className="text-sm font-bold uppercase tracking-wide"
              >
                Report generated
              </h2>
              <p className="mt-2 break-all text-base font-bold">
                {successReport.filename}
              </p>
              <p className="mt-1 text-sm">
                {successReport.format} / Version {successReport.version} /{" "}
                {formatFileSize(successReport.sizeBytes)} /{" "}
                {relativeGeneratedLabel(successReport.generatedAt)}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--tl-radius-sm)] border border-emerald-700"
              onClick={() => setSuccessDismissed(true)}
              aria-label="Dismiss success card"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          {reportActions(successReport)}
        </section>
      ) : null}

      {failedOps.length > 0 ? (
        <section aria-labelledby="failed-ops-heading" className="space-y-3">
          <h2
            id="failed-ops-heading"
            className="text-lg font-bold text-[var(--tl-ink)]"
          >
            Failed generations
          </h2>
          <ul className="grid gap-3">
            {failedOps.slice(0, 5).map((op) => (
              <li
                key={op.operationId}
                className="rounded-[var(--tl-radius-md)] border border-amber-600 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-50"
              >
                <p className="text-sm font-bold uppercase tracking-wide">
                  Not generated
                </p>
                <p className="mt-1 text-sm">
                  {REPORT_TYPE_LABELS[op.reportType]} · {op.format} · failed at{" "}
                  {op.stage.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm">
                  {op.failureReason ?? "Unknown failure"}
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-[var(--tl-radius-sm)] border border-amber-800 px-3 text-sm font-bold uppercase tracking-wide"
                  disabled={busy}
                  onClick={() => {
                    setReportType(op.reportType);
                    setFormats(new Set([op.format]));
                    void onGenerate({
                      type: op.reportType,
                      format: op.format,
                    });
                  }}
                >
                  Retry
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="generated-heading" className="space-y-3">
        <h2
          id="generated-heading"
          className="text-lg font-bold text-[var(--tl-ink)]"
        >
          Generated Reports
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-[var(--tl-ink-muted)]">
            No reports generated yet for this hole.
          </p>
        ) : (
          <ul className="grid gap-3">
            {reports.slice(0, 8).map((report) => {
              const currency = currencyById.get(report.localId);
              return (
                <li
                  key={report.localId}
                  className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[var(--tl-ink)]">
                        {REPORT_TYPE_LABELS[report.reportType]}
                      </p>
                      <p className="mt-1 break-all text-sm text-[var(--tl-ink-muted)]">
                        {report.filename}
                      </p>
                      <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                        {report.format} · Version {report.version} ·{" "}
                        {formatFileSize(report.sizeBytes)} ·{" "}
                        {formatFieldDateTime(report.generatedAt)} ·{" "}
                        {report.generatedByNameSnapshot}
                      </p>
                      <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                        Hole-depth snapshot{" "}
                        {formatMetres(report.holeDepthSnapshotDm)} · Status
                        snapshot {report.holeStatusSnapshot}
                      </p>
                    </div>
                    <StatusPill tone={activityTone(report.activityStatus)}>
                      {report.activityStatus.replaceAll("_", " ")}
                    </StatusPill>
                  </div>
                  {currency?.status === "out_of_date" ? (
                    <div
                      role="status"
                      className="mt-3 rounded-[var(--tl-radius-sm)] border border-amber-600 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50"
                    >
                      <p className="font-bold uppercase tracking-wide">
                        Report out of date
                      </p>
                      <p className="mt-1">
                        The Hole record has changed since this report was
                        generated.
                      </p>
                      <p className="mt-1">
                        Generated version {report.version}
                        {currency.changesDetected.length > 0
                          ? ` · Changes detected: ${currency.changesDetected.join(", ")}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs">
                        Historical report / Generated before the latest Hole
                        changes
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-11 rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            void onGenerate({
                              type: report.reportType,
                              format: report.format,
                            })
                          }
                        >
                          Generate updated report
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-[var(--tl-radius-sm)] border border-amber-800 px-3 text-sm font-bold uppercase tracking-wide"
                          onClick={() => undefined}
                        >
                          Keep historical version
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {reportActions(report)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {emailOpen && emailReportId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="prepare-email-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-lg space-y-3 rounded-[var(--tl-radius-md)] bg-[var(--tl-surface)] p-4 shadow-lg">
            <h2
              id="prepare-email-title"
              className="text-lg font-bold text-[var(--tl-ink)]"
            >
              Prepare Email
            </h2>
            <p className="text-sm text-[var(--tl-ink-muted)]">
              Opens an email draft and downloads the attachment. TargetLock does
              not send or deliver email.
            </p>
            <label className="block text-sm font-semibold">
              To
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={toEmail}
                onChange={(event) => setToEmail(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-transparent px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              Cc
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={ccEmail}
                onChange={(event) => setCcEmail(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-transparent px-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 text-sm font-bold text-white"
                onClick={() => void onPrepareEmail()}
                disabled={busy}
              >
                Share to email app
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-4 text-sm font-bold"
                onClick={() => setEmailOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LocalPrototypeNotice />
    </div>
  );
}
