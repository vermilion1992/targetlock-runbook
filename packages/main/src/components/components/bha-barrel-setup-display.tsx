import type { BottomHoleAssemblySetup } from "@/infrastructure/components";
import { MetricDisplay } from "@/components/field/metric-display";
import {
  formatBarrelStyle,
  formatMetres,
  formatReamerStyle,
} from "@/domain";

function SlotRow({
  label,
  primary,
  serial,
}: {
  label: string;
  primary: string;
  serial?: string;
}) {
  return (
    <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-[var(--tl-ink)]">{primary}</p>
      <p className="mt-0.5 break-all text-sm text-[var(--tl-ink-muted)]">
        {serial?.trim() ? serial : "No serial"}
      </p>
    </div>
  );
}

export function BhaBarrelSetupDisplay({
  setup,
}: {
  setup: BottomHoleAssemblySetup | null;
}) {
  if (!setup) {
    return (
      <p className="text-[var(--tl-ink-muted)]">
        No bottom-hole assembly recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricDisplay
          label="Full BHA size"
          value={formatMetres(setup.bottomHoleAssemblyLengthDm)}
          emphasis="strong"
        />
        <MetricDisplay
          label="Constant stick-up"
          value={formatMetres(setup.constantStickUpDm)}
          emphasis="strong"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SlotRow
          label="Bit"
          primary={setup.bitStyle?.trim() || "Style not set"}
          serial={setup.bitSerialNumber}
        />
        <SlotRow
          label="Front reamer"
          primary={formatReamerStyle(setup.frontReamerStyle)}
          serial={setup.frontReamerSerialNumber}
        />
        <SlotRow
          label="Barrel"
          primary={formatBarrelStyle(setup.barrelStyle)}
          serial={setup.barrelSerialNumber}
        />
        <SlotRow
          label="Rear reamer"
          primary={formatReamerStyle(setup.rearReamerStyle)}
          serial={setup.rearReamerSerialNumber}
        />
      </div>
    </div>
  );
}
