"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  Compass,
  Ellipsis,
  Layers3,
  LocateFixed,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  isRunbookRouteActive,
  runbookRoutes,
} from "@/components/navigation/runbook-routes";

interface NavigationItem {
  label: "Current Hole" | "Runbook" | "Trays" | "Trajectory" | "More";
  href: (holeId: string) => string;
  icon: LucideIcon;
}

const navigationItems: readonly NavigationItem[] = [
  {
    label: "Current Hole",
    href: runbookRoutes.currentHole,
    icon: LocateFixed,
  },
  { label: "Runbook", href: runbookRoutes.runbook, icon: BookOpenCheck },
  { label: "Trays", href: runbookRoutes.trays, icon: Layers3 },
  { label: "Trajectory", href: runbookRoutes.trajectory, icon: Compass },
  { label: "More", href: runbookRoutes.more, icon: Ellipsis },
];

interface RunbookNavigationProps {
  holeId: string;
  variant: "bottom" | "rail";
  expanded?: boolean;
}

export function RunbookNavigation({
  holeId,
  variant,
  expanded = true,
}: RunbookNavigationProps) {
  const pathname = usePathname();
  const isBottomNavigation = variant === "bottom";

  return (
    <nav
      aria-label={isBottomNavigation ? "Primary navigation" : "Runbook navigation"}
      className={cn(
        isBottomNavigation
          ? "tl-safe-bottom fixed inset-x-0 bottom-0 z-50 grid min-h-[var(--tl-phone-nav-height)] grid-cols-5 border-t border-[var(--tl-border)] bg-[var(--tl-surface)] px-1 shadow-[var(--tl-shadow-md)] md:hidden"
          : "flex w-full flex-1 flex-col gap-1 px-3 py-4",
      )}
    >
      {navigationItems.map((item) => {
        const href = item.href(holeId);
        const runCaptureActive =
          item.label === "Current Hole" &&
          pathname.startsWith(
            `/holes/${encodeURIComponent(holeId)}/runs/`,
          );
        const active = isRunbookRouteActive(pathname, href) || runCaptureActive;
        const Icon = item.icon;

        return (
          <Link
            key={item.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-11 items-center rounded-[var(--tl-radius-sm)] font-semibold no-underline transition-colors",
              "text-[var(--tl-ink-muted)] focus-visible:text-[var(--tl-primary)]",
              active &&
                "bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]",
              isBottomNavigation
                ? "flex-col justify-center gap-1 px-1 py-1 text-[0.6875rem]"
                : "gap-3 px-3 py-2.5 text-sm",
              !isBottomNavigation &&
                !expanded &&
                "md:justify-center md:px-0 min-[1025px]:justify-start min-[1025px]:px-3",
            )}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
            <span
              className={cn(
                "leading-tight",
                !isBottomNavigation &&
                  !expanded &&
                  "md:sr-only min-[1025px]:not-sr-only",
              )}
            >
              {item.label}
            </span>
            {active && isBottomNavigation ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-[30%] top-0 h-0.5 rounded-full bg-[var(--tl-primary)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
