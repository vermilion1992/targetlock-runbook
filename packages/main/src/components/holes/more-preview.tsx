import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Compass,
  Cylinder,
  History,
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

function MoreSection({
  headingId,
  title,
  items,
}: {
  headingId: string;
  title: string;
  items: readonly MoreItem[];
}) {
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--tl-ink-muted)]"
      >
        {title}
      </h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <MoreItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function MorePreview({ holeId }: { holeId: string }) {
  const holePlanning: readonly MoreItem[] = [
    {
      id: "survey-settings",
      label: "Survey & Reference Settings",
      description:
        "Survey azimuth reference, north conversion, and collar configuration.",
      icon: Settings,
      href: runbookRoutes.surveySettings(holeId),
    },
  ];

  const holeRecords: readonly MoreItem[] = [
    {
      id: "casing",
      label: "Casing",
      description: "Review surface casing depths and recorded changes.",
      icon: Cylinder,
      href: runbookRoutes.casing(holeId),
    },
    {
      id: "components",
      label: "Bottom hole assembly",
      description:
        "Active barrel setup, full BHA size, stick-up, and bit/reamer serials.",
      icon: CircleDot,
      href: runbookRoutes.holeComponents(holeId),
    },
    {
      id: "surveys",
      label: "Surveys",
      description: "Review depth, dip, azimuth, tool, and operator records.",
      icon: Compass,
      href: runbookRoutes.surveys(holeId),
    },
  ];

  const analysisOutput: readonly MoreItem[] = [
    {
      id: "timeline",
      label: "Timeline",
      description:
        "Review runs, shifts, surveys, trays and equipment changes by depth.",
      icon: Clock3,
      href: runbookRoutes.timeline(holeId),
    },
    {
      id: "statistics",
      label: "Hole statistics",
      description:
        "Hole production, Shift, recovery, component, Survey and Tray analytics.",
      icon: BarChart3,
      href: runbookRoutes.statistics(holeId),
    },
    {
      id: "reports",
      label: "Reports",
      description:
        "Generate local PDF, Excel and CSV runbook exports and share from this device.",
      icon: ClipboardList,
      href: runbookRoutes.reports(holeId),
    },
    {
      id: "report-history",
      label: "Report history",
      description: "Open previously generated local report versions for this hole.",
      icon: History,
      href: runbookRoutes.reportHistory(holeId),
    },
  ];

  const holeManagement: readonly MoreItem[] = [
    {
      id: "shifts",
      label: "Shift history",
      description:
        "Review Day and Night Shift snapshots, shared runs, and handovers.",
      icon: History,
      href: runbookRoutes.shifts(holeId),
    },
    {
      id: "complete-hole",
      label: "Complete Hole",
      description:
        "Reconcile depth, components, surveys, and trays before locking.",
      icon: CheckCircle2,
      href: runbookRoutes.completeHole(holeId),
    },
    {
      id: "reopen-hole",
      label: "Reopen hole",
      description:
        "Restore a completed or abandoned hole to Active with audit history.",
      icon: RotateCcw,
      href: runbookRoutes.reopenHole(holeId),
    },
    {
      id: "completed-holes",
      label: "Completed holes",
      description:
        "Browse locked holes with final depth, reason, and reopen actions.",
      icon: CheckCircle2,
      href: runbookRoutes.completedHoles(),
    },
    {
      id: "new-hole",
      label: "New Hole",
      description: "Create a hole with collar direction and optional coordinates.",
      icon: CircleDot,
      href: runbookRoutes.newHole(),
    },
    {
      id: "settings",
      label: "Settings",
      description: "Hole and organisation configuration.",
      icon: Settings,
      deferredNote:
        "Not available in the local pilot. Configuration stays seed-backed.",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="More tools"
        title="More runbook tools"
        description="Hole planning, records, analysis, and management tools for this hole."
      />

      <MoreSection
        headingId="hole-planning-heading"
        title="Hole planning"
        items={holePlanning}
      />
      <MoreSection
        headingId="hole-records-heading"
        title="Hole records"
        items={holeRecords}
      />
      <MoreSection
        headingId="analysis-output-heading"
        title="Analysis & output"
        items={analysisOutput}
      />
      <MoreSection
        headingId="hole-management-heading"
        title="Hole management"
        items={holeManagement}
      />

      <LocalPrototypeNotice />
    </div>
  );
}
