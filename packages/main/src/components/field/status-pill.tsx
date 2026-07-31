import {
  CloudOff,
  HardDrive,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral:
    "border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] text-[var(--tl-ink-muted)]",
  info:
    "border-[color-mix(in_srgb,var(--tl-primary)_35%,transparent)] bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]",
  success:
    "border-[color-mix(in_srgb,var(--tl-success)_35%,transparent)] bg-[var(--tl-success-soft)] text-[var(--tl-success)]",
  warning:
    "border-[color-mix(in_srgb,var(--tl-warning)_35%,transparent)] bg-[var(--tl-warning-soft)] text-[var(--tl-warning)]",
  danger:
    "border-[color-mix(in_srgb,var(--tl-danger)_35%,transparent)] bg-[var(--tl-danger-soft)] text-[var(--tl-danger)]",
};

interface StatusPillProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
  live?: boolean;
  title?: string;
  "data-testid"?: string;
}

export function StatusPill({
  children,
  tone = "neutral",
  className,
  live = false,
  title,
  "data-testid": testId,
}: StatusPillProps) {
  return (
    <span
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      title={title}
      data-testid={testId}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-[var(--tl-radius-md)] border px-2.5 py-1 text-xs font-semibold leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type ConnectivityMode = "connected" | "local" | "offline";

interface ConnectivityConfig {
  label: string;
  detail: string;
  tone: StatusTone;
  icon: LucideIcon;
}

const connectivityConfig: Record<ConnectivityMode, ConnectivityConfig> = {
  connected: {
    label: "Connected",
    detail: "Remote service is connected",
    tone: "success",
    icon: Wifi,
  },
  local: {
    label: "Local only",
    detail: "Network may be available; remote sync is not configured",
    tone: "info",
    icon: HardDrive,
  },
  offline: {
    label: "Offline",
    detail: "Browser is offline; work remains local",
    tone: "warning",
    icon: CloudOff,
  },
};

interface ConnectivityBadgeProps {
  mode: ConnectivityMode;
  compactOnPhone?: boolean;
  className?: string;
}

export function ConnectivityBadge({
  mode,
  compactOnPhone = false,
  className,
}: ConnectivityBadgeProps) {
  const config = connectivityConfig[mode];
  const Icon = config.icon;

  return (
    <StatusPill
      tone={config.tone}
      live
      className={cn("shrink-0", className)}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className={cn(compactOnPhone && "hidden min-[480px]:inline")}>
        {config.label}
      </span>
      <span className="sr-only">. {config.detail}</span>
    </StatusPill>
  );
}
