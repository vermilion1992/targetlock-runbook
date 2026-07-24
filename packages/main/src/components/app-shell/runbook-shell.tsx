"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { StaleServiceWorkerCleanup } from "@/components/app-shell/stale-service-worker-cleanup";
import { TargetLockBrand } from "@/components/app-shell/target-lock-brand";
import { ThemeModeControl } from "@/components/app-shell/theme-mode-control";
import { ConnectivityBadge } from "@/components/field/status-pill";
import { RunbookNavigation } from "@/components/navigation/runbook-navigation";
import {
  holeIdFromPathname,
  runbookRoutes,
} from "@/components/navigation/runbook-routes";

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
  const holeId = holeIdFromPathname(pathname);
  const [railExpanded, setRailExpanded] = useState(false);
  const browserOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    () => true,
  );

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
        <TargetLockBrand href={runbookRoutes.currentHole(holeId)} />

        <div
          className="min-w-0 flex-1 border-l border-[var(--tl-border)] pl-2 sm:pl-3"
          aria-label={`Current hole ${holeId}`}
        >
          <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)] sm:block">
            Current hole
          </span>
          <strong className="tl-tabular block truncate text-sm font-bold leading-tight text-[var(--tl-ink)] sm:text-base">
            {holeId}
          </strong>
        </div>

        <ConnectivityBadge
          mode={browserOnline ? "local" : "offline"}
          compactOnPhone
        />
        <ThemeModeControl />
      </header>

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
