"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { StaleServiceWorkerCleanup } from "@/components/app-shell/stale-service-worker-cleanup";
import { TargetLockBrand } from "@/components/app-shell/target-lock-brand";
import { ThemeModeControl } from "@/components/app-shell/theme-mode-control";
import { ConnectivityBadge } from "@/components/field/status-pill";
import { RunbookNavigation } from "@/components/navigation/runbook-navigation";
import { holeIdFromPathname } from "@/components/navigation/runbook-routes";
import { subscribeToExternalRunbookStorageChanges } from "@/infrastructure/drafts";
import { isRoutableHoleId } from "@/infrastructure/seed";
import { OperatorMenu } from "@/components/session";
import { useOperatorSession } from "@/components/session";
import {
  emptyOutboxSummary,
  getBrowserCoreRecoveryCoordinator,
  getBrowserPilotLeaseCoordinator,
  getBrowserSyncCoordinator,
} from "@/infrastructure/sync";

const subscribeToNothing = () => () => {};
const emptySyncSnapshot = emptyOutboxSummary();
const unavailableSyncSnapshot = {
  ...emptyOutboxSummary("unavailable"),
  incomplete: 1,
  storageErrors: 1,
  unsynced: 1,
  warning:
    "Durable journal storage is unavailable. Export or recover browser storage before field work.",
};

function subscribeToConnectivity(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getConnectivitySnapshot(): boolean {
  return window.navigator.onLine;
}

interface RunbookShellProps {
  children: ReactNode;
}

export function RunbookShell({ children }: RunbookShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedHoleId = searchParams.get("holeId")?.trim();
  const holeId =
    pathname?.startsWith("/components") &&
    requestedHoleId !== undefined &&
    isRoutableHoleId(requestedHoleId)
      ? requestedHoleId
      : holeIdFromPathname(pathname);
  const [railExpanded, setRailExpanded] = useState(false);
  const [externalChange, setExternalChange] = useState(false);
  const { runtimeMode, pilot } = useOperatorSession();
  const syncCoordinator = getBrowserSyncCoordinator();
  const recoveryCoordinator = getBrowserCoreRecoveryCoordinator();
  const leaseCoordinator = getBrowserPilotLeaseCoordinator();
  const syncSummary = useSyncExternalStore(
    syncCoordinator?.subscribe ?? subscribeToNothing,
    syncCoordinator?.getSnapshot ?? (() => unavailableSyncSnapshot),
    () => emptySyncSnapshot,
  );
  const recoveryState = useSyncExternalStore(
    recoveryCoordinator?.subscribe ?? subscribeToNothing,
    recoveryCoordinator?.getSnapshot ?? (() => ({
      status: "unavailable" as const,
      cursor: null,
      lastPulledAt: null,
      holeCount: 0,
      aggregateRevisions: {},
      message: "Authoritative server recovery is unavailable.",
    })),
    () => ({
      status: "unknown" as const,
      cursor: null,
      lastPulledAt: null,
      holeCount: 0,
      aggregateRevisions: {},
      message: null,
    }),
  );
  const leaseState = useSyncExternalStore(
    leaseCoordinator.subscribe,
    leaseCoordinator.getSnapshot,
    leaseCoordinator.getSnapshot,
  );
  const browserOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    () => true,
  );
  useEffect(() => {
    const markExternalChange = () => setExternalChange(true);
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key.startsWith("targetlock:prototype:")
      ) {
        markExternalChange();
      }
    };
    const unsubscribe =
      subscribeToExternalRunbookStorageChanges(markExternalChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);
  useEffect(() => {
    if (runtimeMode !== "pilot" || !pilot || !holeId) {
      leaseCoordinator.deactivate();
      return;
    }
    void leaseCoordinator
      .activateHole(holeId, pilot.device?.projectRef ?? null)
      .catch(() => undefined);
  }, [holeId, leaseCoordinator, pilot, runtimeMode]);

  return (
    <div className="target-lock">
      <StaleServiceWorkerCleanup />
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:not-sr-only focus:rounded-md focus:bg-[var(--tl-primary)] focus:px-4 focus:py-3 focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>
      <header className="tl-safe-top sticky top-0 z-40 flex min-h-[var(--tl-header-height)] items-center gap-1.5 border-b border-[var(--tl-border)] bg-[var(--tl-surface)] px-2 shadow-[var(--tl-shadow-sm)] sm:gap-3 sm:px-4">
        <TargetLockBrand
          href="/start"
          ariaLabel="TargetLock field start"
        />

        <Link
          href="/start"
          className="min-w-0 flex-1 border-l border-[var(--tl-border)] pl-2 text-[var(--tl-ink)] no-underline sm:pl-3"
          aria-label={`Current hole ${holeId}`}
        >
          <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)] sm:block">
            Current hole · change
          </span>
          <strong className="tl-tabular block truncate text-sm font-bold leading-tight text-[var(--tl-ink)] sm:text-base">
            {holeId}
          </strong>
        </Link>

        <ConnectivityBadge
          mode={browserOnline ? "local" : "offline"}
          compactOnPhone
        />
        <ThemeModeControl />
        <OperatorMenu compact />
      </header>

      {runtimeMode === "pilot" ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-4 py-2 text-xs font-semibold"
          data-testid="pilot-operation-status"
        >
          <span
            className={
              leaseState.kind === "PRIMARY_WRITER"
                ? "text-emerald-700"
                : leaseState.kind === "OFFLINE_GRACE"
                  ? "text-amber-700"
                  : "text-[var(--tl-danger)]"
            }
          >
            {leaseState.kind === "PRIMARY_WRITER"
              ? "Primary writer"
              : leaseState.kind === "READ_ONLY"
                ? "Read-only"
                : leaseState.kind === "OFFLINE_GRACE"
                  ? "Offline grace"
                  : leaseState.kind === "CHECKING"
                    ? "Checking writer lease"
                    : leaseState.kind === "DEVICE_REQUIRED"
                      ? "Device required"
                      : leaseState.kind === "CONFLICT"
                        ? "Lease conflict"
                        : "Lease inactive"}
          </span>
          <span className="text-[var(--tl-ink-muted)]">
            Local saved
          </span>
          <span className="text-[var(--tl-ink-muted)]">
            {syncSummary.availability === "initializing"
              ? "Journal loading"
              : syncSummary.availability === "unavailable"
                ? "Journal unavailable"
                : syncSummary.unsynced === 0
                  ? "Journal backed up"
                  : `${syncSummary.unsynced} awaiting journal`}
          </span>
          <span
            className={
              recoveryState.status === "server-current"
                ? "text-emerald-700"
                : recoveryState.status === "conflict" ||
                    syncSummary.conflict > 0
                  ? "text-[var(--tl-danger)]"
                  : "text-[var(--tl-ink-muted)]"
            }
          >
            {recoveryState.status === "server-current"
              ? "Server current"
              : recoveryState.status === "pulling"
                ? "Server pull in progress"
                : recoveryState.status === "conflict" ||
                    syncSummary.conflict > 0
                  ? "Conflict — supervisor review required"
                  : "Server state not yet confirmed"}
          </span>
          {syncSummary.unsynced > 0 && browserOnline ? (
            <button
              type="button"
              className="min-h-8 rounded-md border border-[var(--tl-border-strong)] px-3"
              onClick={() => void syncCoordinator?.flush(true)}
            >
              Retry now
            </button>
          ) : null}
          <span className="basis-full text-[var(--tl-ink-muted)] sm:basis-auto">
            {syncSummary.warning ?? recoveryState.message ?? leaseState.message}
          </span>
        </div>
      ) : null}

      {externalChange ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950"
        >
          <span>Another tab updated local runbook data.</span>
          <button
            type="button"
            className="min-h-9 rounded-md bg-amber-900 px-3 py-1.5 text-white"
            onClick={() => window.location.reload()}
          >
            Reload this view
          </button>
        </div>
      ) : null}

      <div className="flex min-h-[calc(100dvh-var(--tl-header-height))]">
        <aside
          aria-label="Runbook sidebar"
          className={cn(
            "sticky top-[var(--tl-header-height)] hidden h-[calc(100dvh-var(--tl-header-height))] shrink-0 flex-col border-r border-[var(--tl-border)] bg-[var(--tl-surface)] transition-[width] md:flex min-[1025px]:w-64",
            railExpanded ? "md:w-64" : "md:w-20",
          )}
        >
          <div className="flex min-h-14 items-center border-b border-[var(--tl-border)] px-3 lg:justify-start">
            <button
              type="button"
              aria-expanded={railExpanded}
              aria-controls="targetlock-rail-navigation"
              aria-label={railExpanded ? "Collapse navigation" : "Expand navigation"}
              onClick={() => setRailExpanded((expanded) => !expanded)}
              className="flex size-11 items-center justify-center rounded-lg border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)] min-[1025px]:hidden"
            >
              {railExpanded ? (
                <PanelLeftClose aria-hidden="true" className="size-5" />
              ) : (
                <PanelLeftOpen aria-hidden="true" className="size-5" />
              )}
            </button>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)] min-[1025px]:inline">
              Field runbook
            </span>
          </div>

          <div id="targetlock-rail-navigation" className="flex min-h-0 flex-1">
            <RunbookNavigation
              holeId={holeId}
              variant="rail"
              expanded={railExpanded}
            />
          </div>
        </aside>

        <main id="main-content" className="tl-mobile-content min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[90rem] p-4 sm:p-5 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <RunbookNavigation holeId={holeId} variant="bottom" />
    </div>
  );
}
