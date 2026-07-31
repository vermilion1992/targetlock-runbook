"use client";

import { StatusPill } from "@/components/field/status-pill";

/** Compact local-demo indicator for shell headers (replaces the full-width banner). */
export function DemoModeChip({ className }: { className?: string }) {
  return (
    <StatusPill
      tone="warning"
      live
      className={className}
      data-testid="demo-local-only-chip"
      title="Demo mode — data stays local-only on this device and is not synced to the pilot server."
    >
      <span aria-hidden="true">Demo</span>
      <span className="sr-only">
        Demo mode. Data is local-only on this device and is not synced to the
        pilot server.
      </span>
    </StatusPill>
  );
}
