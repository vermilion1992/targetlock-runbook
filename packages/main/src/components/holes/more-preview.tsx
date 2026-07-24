import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Compass,
  Cylinder,
  History,
  PackageSearch,
  RotateCcw,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

interface MoreItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly href?: string;
  readonly deferredNote?: string;
}

function MoreItemCard({ item }: { item: MoreItem }) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-base text-[var(--tl-ink)]">{item.label}</strong>
        </span>
        <span className="mt-1 block text-sm leading-5 text-[var(--tl-ink-muted)]">
          {item.description}
        </span>
        {item.deferredNote ? (
          <span className="mt-1 block text-xs leading-5 text-[var(--tl-ink-muted)]">
            {item.deferredNote}
          </span>
        ) : null}
      </span>
      {item.href ? (
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-[var(--tl-ink-muted)]"
        />
      ) : null}
    </>
  );

  if (item.href) {
    return (
      <Link
        id={item.id}
        href={item.href}
        className="flex min-h-20 scroll-mt-24 items-center gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 no-underline shadow-[var(--tl-shadow-sm)]"
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      id={item.id}
      className="flex min-h-20 scroll-mt-24 items-center gap-3 rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] p-4"
    >
      {content}
    </article>
  );
}

export function MorePreview({ holeId }: { holeId: string }) {
  const operations: readonly MoreItem[] = [
    {
      id: "surveys",
      label: "Surveys",
      description: "Review depth, dip, azimuth, tool, and operator records.",
      icon: Compass,
      href: runbookRoutes.surveys(holeId),
    },
    {
      id: "trajectory",
      label: "Trajectory",
      description:
        "Direct-to-target attitude, projected miss, and surveyed path tracking.",
      icon: Compass,
      href: runbookRoutes.trajectory(holeId),
    },
    {
      id: "survey-settings",
      label: "Survey & Reference Settings",
      description:
        "Survey azimuth reference, north conversion, and collar configuration.",
      icon: Settings,
      href: runbookRoutes.surveySettings(holeId),
    },
    {
      id: "new-hole",
      label: "New Hole",
      description: "Create a hole with collar direction and optional coordinates.",
      icon: CircleDot,
      href: runbookRoutes.newHole(),
    },
    {
      id: "components",
      label: "Components",
      description: "Review bit and reamer installation and removal events.",
      icon: CircleDot,
      href: runbookRoutes.holeComponents(holeId),
    },
    {
      id: "component-registry",
      label: "Component registry",
      description: "Search all registered bits and reamers across known holes.",
      icon: PackageSearch,
      href: runbookRoutes.componentRegistry(),
    },
    {
      id: "casing",
      label: "Casing",
      description: "Review surface casing depths and recorded changes.",
      icon: Cylinder,
      href: runbookRoutes.casing(holeId),
    },
    {
      id: "complete-hole",
      label: "Final hole review",
      description: "Reconcile depth, components, surveys, and trays before locking.",
      icon: CheckCircle2,
      href: runbookRoutes.completeHole(holeId),
    },
    {
      id: "reopen-hole",
      label: "Reopen hole",
      description: "Restore a completed or abandoned hole to Active with audit history.",
      icon: RotateCcw,
      href: runbookRoutes.reopenHole(holeId),
    },
  ];
  const management: readonly MoreItem[] = [
    {
      id: "completed-holes",
      label: "Completed holes",
      description: "Browse locked holes with final depth, reason, and reopen actions.",
      icon: CheckCircle2,
      href: runbookRoutes.completedHoles(),
    },
    {
      id: "statistics",
      label: "Statistics",
      description: "Hole production, Shift, recovery, component, Survey and Tray analytics.",
      icon: BarChart3,
      href: runbookRoutes.statistics(holeId),
    },
    {
      id: "shifts",
      label: "Shift history",
      description: "Review Day and Night Shift snapshots, shared runs, and handovers.",
      icon: History,
      href: runbookRoutes.shifts(holeId),
    },
    {
      id: "reports",
      label: "Reports",
      description: "Generate local PDF, Excel and CSV runbook exports and share from this device.",
      icon: ClipboardList,
      href: runbookRoutes.reports(holeId),
    },
    {
      id: "settings",
      label: "Settings",
      description: "Hole and organisation configuration.",
      icon: Settings,
      deferredNote: "Not available in the local pilot. Configuration stays seed-backed.",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="More tools"
        title="More runbook tools"
        description="Hole completion, reports, surveys, trays, casing, components, shifts, and runs for this hole."
      />

      <section aria-labelledby="operations-heading">
        <h2
          id="operations-heading"
          className="mb-3 text-lg font-bold text-[var(--tl-ink)]"
        >
          Hole operations
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {operations.map((item) => (
            <MoreItemCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section aria-labelledby="management-heading">
        <h2
          id="management-heading"
          className="mb-3 text-lg font-bold text-[var(--tl-ink)]"
        >
          Insights and management
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {management.map((item) => (
            <MoreItemCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <LocalPrototypeNotice />
    </div>
  );
}
