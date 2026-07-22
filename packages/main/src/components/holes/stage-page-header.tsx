import { HardDrive, Save } from "lucide-react";
import type { ReactNode } from "react";

import { StatusPill } from "@/components/field/status-pill";

interface StagePageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function StagePageHeader({
  eyebrow,
  title,
  description,
  action,
}: StagePageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--tl-primary)]">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--tl-ink)] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tl-ink-muted)] sm:text-base">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function LocalPrototypeNotice() {
  return (
    <aside
      aria-label="Prototype data status"
      className="flex flex-col gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-primary-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--tl-surface)] text-[var(--tl-primary)]">
          <Save aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="font-bold text-[var(--tl-ink)]">
            Drafts auto-save on this browser
          </p>
          <p className="mt-0.5 text-sm leading-5 text-[var(--tl-ink-muted)]">
            Local pilot only. Nothing is synced or sent to a remote service.
          </p>
        </div>
      </div>
      <StatusPill tone="info" className="self-start sm:self-auto">
        <HardDrive aria-hidden="true" className="size-3.5" />
        Local-only
      </StatusPill>
    </aside>
  );
}
