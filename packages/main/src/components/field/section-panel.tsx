import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionPanelProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
  contentClassName?: string;
}

export function SectionPanel({
  title,
  description,
  action,
  children,
  footer,
  headingLevel = 2,
  className,
  contentClassName,
}: SectionPanelProps) {
  const generatedId = useId();
  const headingId = `${generatedId}-heading`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "overflow-hidden rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-sm)]",
        className,
      )}
    >
      <header className="flex min-h-16 items-start justify-between gap-4 border-b border-[var(--tl-border)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <Heading
            id={headingId}
            className="text-base font-bold leading-6 text-[var(--tl-ink)] sm:text-lg"
          >
            {title}
          </Heading>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>

      {footer ? (
        <footer className="border-t border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-4 py-3 sm:px-5">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
