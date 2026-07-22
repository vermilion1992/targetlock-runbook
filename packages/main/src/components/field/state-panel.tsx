import {
  CircleAlert,
  CloudOff,
  Inbox,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FieldState = "loading" | "empty" | "error" | "offline";

interface StateConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}

const stateConfig: Record<FieldState, StateConfig> = {
  loading: {
    title: "Loading field data",
    description: "This should only take a moment.",
    icon: LoaderCircle,
    iconClassName: "animate-spin text-[var(--tl-primary)]",
  },
  empty: {
    title: "Nothing recorded yet",
    description: "New field records will appear here.",
    icon: Inbox,
    iconClassName: "text-[var(--tl-ink-muted)]",
  },
  error: {
    title: "Field data could not load",
    description: "Try again. Your saved local work has not been removed.",
    icon: CircleAlert,
    iconClassName: "text-[var(--tl-danger)]",
  },
  offline: {
    title: "Working offline",
    description: "Remote data is unavailable. Continue with locally available work.",
    icon: CloudOff,
    iconClassName: "text-[var(--tl-warning)]",
  },
};

interface StatePanelProps {
  state: FieldState;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StatePanel({
  state,
  title,
  description,
  action,
  className,
}: StatePanelProps) {
  const config = stateConfig[state];
  const Icon = config.icon;
  const isError = state === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      aria-busy={state === "loading" || undefined}
      data-state={state}
      className={cn(
        "flex min-h-52 flex-col items-center justify-center rounded-[var(--tl-radius-lg)] border border-dashed border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-6 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--tl-surface-sunken)]">
        <Icon
          aria-hidden="true"
          className={cn("size-6", config.iconClassName)}
        />
      </span>
      <p className="mt-4 text-base font-bold leading-6 text-[var(--tl-ink)]">
        {title ?? config.title}
      </p>
      <div className="mt-1 max-w-md text-sm leading-5 text-[var(--tl-ink-muted)]">
        {description ?? config.description}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
