/**
 * Shared visual theme for trajectory canvas, PNG export, and PDF graphics.
 * Presentation only — does not affect verified coordinates.
 */

export interface TrajectoryDrawColors {
  readonly background: string;
  readonly grid: string;
  readonly ink: string;
  readonly muted: string;
  readonly planned: string;
  readonly actual: string;
  readonly target: string;
  readonly selected: string;
  readonly collar: string;
}

/** Light TargetLock-aligned palette for canvas / PNG. */
export const TRAJECTORY_LIGHT_COLORS: TrajectoryDrawColors = {
  background: "#eef3f8",
  grid: "#cbd6e2",
  ink: "#172335",
  muted: "#5a6b7d",
  planned: "#5a6b7d",
  actual: "#1f6feb",
  target: "#b86e00",
  selected: "#d33c45",
  collar: "#1e4a8a",
};

/** Dark TargetLock-aligned palette for canvas / PNG. */
export const TRAJECTORY_DARK_COLORS: TrajectoryDrawColors = {
  background: "#111c29",
  grid: "#2c3e50",
  ink: "#eef3f8",
  muted: "#a9b8c8",
  planned: "#a9b8c8",
  actual: "#60a5fa",
  target: "#f5b942",
  selected: "#ff7b86",
  collar: "#3b82f6",
};

/** Deterministic PDF RGB (0–1) matching light TargetLock roles. */
export const TRAJECTORY_PDF_RGB = {
  planned: { r: 0.35, g: 0.42, b: 0.49 },
  actual: { r: 0.12, g: 0.44, b: 0.92 },
  target: { r: 0.72, g: 0.43, b: 0 },
  grid: { r: 0.8, g: 0.84, b: 0.89 },
  ink: { r: 0.09, g: 0.14, b: 0.21 },
  muted: { r: 0.35, g: 0.42, b: 0.49 },
} as const;

export function mergeTrajectoryColors(
  partial?: Partial<TrajectoryDrawColors>,
  base: TrajectoryDrawColors = TRAJECTORY_LIGHT_COLORS,
): TrajectoryDrawColors {
  return { ...base, ...partial };
}

export function resolveTrajectoryCanvasColors(
  root?: Element | null,
): TrajectoryDrawColors {
  if (typeof document === "undefined") {
    return TRAJECTORY_LIGHT_COLORS;
  }
  const dark =
    document.documentElement.classList.contains("dark") ||
    Boolean(root?.closest(".dark"));
  const host =
    root?.closest(".target-lock") ?? document.querySelector(".target-lock");
  if (!host) {
    return dark ? TRAJECTORY_DARK_COLORS : TRAJECTORY_LIGHT_COLORS;
  }
  const styles = getComputedStyle(host);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };
  const base = dark ? TRAJECTORY_DARK_COLORS : TRAJECTORY_LIGHT_COLORS;
  return {
    background: read("--tl-surface", base.background),
    grid: read("--tl-border", base.grid),
    ink: read("--tl-ink", base.ink),
    muted: read("--tl-ink-muted", base.muted),
    planned: read("--tl-ink-muted", base.planned),
    actual: read("--tl-primary", base.actual),
    target: read("--tl-warning", base.target),
    selected: read("--tl-danger", base.selected),
    collar: read("--tl-primary-deep", base.collar) || base.collar,
  };
}
