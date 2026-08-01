import type { ReactNode } from "react";

import { RunbookPageBackLink } from "@/components/navigation/runbook-page-back-link";
import type { RunbookBackTarget } from "@/components/navigation/runbook-page-back";

export interface StagePageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  backTarget?: RunbookBackTarget;
  /** @deprecated Prefer `actions`. Kept for existing call sites. */
  action?: ReactNode;
  actions?: ReactNode;
}

export function StagePageHeader({
  eyebrow,
  title,
  description,
  backTarget,
  action,
  actions,
}: StagePageHeaderProps) {
  const trailing = actions ?? action;
  const showMetaRow = Boolean(eyebrow?.trim()) || Boolean(backTarget);

  return (
    <header className="space-y-3">
      {showMetaRow ? (
        <div className="flex items-center justify-between gap-3">
          {eyebrow?.trim() ? (
            <p className="min-w-0 text-xs font-bold uppercase tracking-[0.1em] text-[var(--tl-primary)]">
              {eyebrow}
            </p>
          ) : (
            <span className="min-w-0" />
          )}
          {backTarget ? (
            <RunbookPageBackLink
              target={backTarget}
              className="-mr-1 shrink-0"
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--tl-ink)] sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tl-ink-muted)] sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}
