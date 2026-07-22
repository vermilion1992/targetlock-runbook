"use client";

import {
  Box,
  Camera,
  CheckCircle2,
  Compass,
  Cylinder,
  Gauge,
  History,
  ListPlus,
  Plus,
  Send,
  Settings2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

interface QuickAction {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

function actionsForHole(holeId: string): readonly QuickAction[] {
  const base = `/holes/${encodeURIComponent(holeId)}`;

  return [
    { label: "Add 3.0 m rod", href: `${base}/runs/new?rod=3`, icon: Plus },
    { label: "Add 6.0 m rod", href: `${base}/runs/new?rod=6`, icon: Plus },
    {
      label: "Add survey",
      href: runbookRoutes.addSurvey(holeId),
      icon: Compass,
    },
    {
      label: "Photograph tray",
      href: runbookRoutes.addTray(holeId),
      icon: Camera,
    },
    {
      label: "Casing history",
      href: runbookRoutes.casing(holeId),
      icon: Cylinder,
    },
    {
      label: "Change bit",
      href: runbookRoutes.changeBit(holeId),
      icon: Gauge,
    },
    {
      label: "Change reamer",
      href: runbookRoutes.changeReamer(holeId),
      icon: Settings2,
    },
    {
      label: "Hole timeline",
      href: runbookRoutes.timeline(holeId),
      icon: ListPlus,
    },
    {
      label: "Shift history",
      href: `${base}/shifts`,
      icon: History,
    },
    {
      label: "Final hole review",
      href: runbookRoutes.completeHole(holeId),
      icon: CheckCircle2,
    },
    {
      label: "Reports",
      href: runbookRoutes.reports(holeId),
      icon: Send,
    },
  ];
}

function ActionGrid({
  actions,
  closeOnSelect,
}: {
  actions: readonly QuickAction[];
  closeOnSelect: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const link = (
          <Link
            href={action.href}
            className="flex min-h-14 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 py-2 text-sm font-bold leading-5 text-[var(--tl-ink)] no-underline"
          >
            <Icon
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--tl-primary)]"
            />
            <span>{action.label}</span>
          </Link>
        );

        return closeOnSelect ? (
          <DrawerClose asChild key={action.label}>
            {link}
          </DrawerClose>
        ) : (
          <div key={action.label}>{link}</div>
        );
      })}
    </div>
  );
}

export function QuickActions({ holeId }: { holeId: string }) {
  const actions = actionsForHole(holeId);

  return (
    <>
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 text-base font-bold text-[var(--tl-ink)]"
            >
              <Wrench aria-hidden="true" className="size-5" />
              Open quick actions
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[82dvh] border border-[var(--tl-border)] bg-[var(--tl-surface)] text-[var(--tl-ink)]">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--tl-border-strong)]" />
            <DrawerHeader className="text-left">
              <DrawerTitle>Quick actions</DrawerTitle>
              <DrawerDescription className="text-[var(--tl-ink-muted)]">
                Choose an action for {holeId}. Casing and component changes save
                to this browser before success is shown.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <ActionGrid actions={actions} closeOnSelect />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <section
        aria-labelledby="quick-actions-heading"
        className="hidden rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] md:block"
      >
        <div className="mb-3 flex items-center gap-2">
          <Box aria-hidden="true" className="size-5 text-[var(--tl-primary)]" />
          <h2
            id="quick-actions-heading"
            className="text-base font-bold text-[var(--tl-ink)]"
          >
            Quick actions
          </h2>
        </div>
        <ActionGrid actions={actions} closeOnSelect={false} />
      </section>
    </>
  );
}
