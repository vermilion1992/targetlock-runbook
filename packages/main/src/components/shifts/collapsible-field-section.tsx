"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function CollapsibleFieldSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]">
      <h2 className="m-0">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left font-bold"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            <span className="block">{title}</span>
            {description ? (
              <span className="mt-1 block text-sm font-normal text-[var(--tl-ink-muted)]">
                {description}
              </span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      {open ? (
        <div id={panelId} className="border-t border-[var(--tl-border)] px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
