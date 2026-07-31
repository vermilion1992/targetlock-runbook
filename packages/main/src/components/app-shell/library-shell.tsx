"use client";

import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { TargetLockBrand } from "./target-lock-brand";
import { ThemeModeControl } from "./theme-mode-control";
import { OperatorMenu, useOperatorSession } from "@/components/session";

export function LibraryShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { runtimeMode } = useOperatorSession();
  const isStart = pathname === "/start" || pathname.startsWith("/start/");
  return (
    <div className="target-lock min-h-dvh bg-[var(--tl-canvas)] text-[var(--tl-ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--tl-border)] bg-[var(--tl-surface)]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center gap-3 px-3 sm:px-5 lg:px-8">
          <TargetLockBrand href="/start" />
          <div className="h-7 w-px bg-[var(--tl-border)]" aria-hidden="true" />
          <Link
            href={isStart ? "/start" : "/projects"}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-sm font-semibold text-[var(--tl-ink)] no-underline"
          >
            <FolderKanban
              aria-hidden="true"
              className="size-[1.125rem] shrink-0 text-[var(--tl-primary)]"
            />
            <span className="truncate">
              {isStart ? "Field Start" : "Project Library"}
            </span>
          </Link>
          <ThemeModeControl />
          <OperatorMenu />
        </div>
      </header>
      {runtimeMode === "demo" ? (
        <div
          role="status"
          data-testid="demo-local-only-banner"
          className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950"
        >
          Demo mode — data is local-only on this device and is not synced to the
          pilot server.
        </div>
      ) : null}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-3 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 lg:px-8 lg:py-7"
      >
        {children}
      </main>
    </div>
  );
}
