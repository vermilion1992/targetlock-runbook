export interface RunbookBackTarget {
  readonly href: string;
  readonly label: string;
  readonly ariaLabel?: string;
  /** When set, back uses a button and calls this instead of navigating immediately. */
  readonly onNavigate?: (href: string) => void;
}

export function backAriaLabel(
  target: Pick<RunbookBackTarget, "label" | "ariaLabel">,
): string {
  return target.ariaLabel?.trim() || `Back to ${target.label}`;
}

/** Phone short label; desktop uses the "Back to …" prefix for named parents. */
export function backVisibleLabel(label: string): {
  short: string;
  long: string;
} {
  const trimmed = label.trim() || "Back";
  const normalized = trimmed.toLowerCase();
  if (
    normalized === "cancel" ||
    normalized.startsWith("back ") ||
    normalized.startsWith("back to ")
  ) {
    return { short: trimmed, long: trimmed };
  }
  return {
    short: trimmed,
    long: `Back to ${trimmed}`,
  };
}

export function namedBackTarget(
  href: string,
  label: string,
  options?: { ariaLabel?: string; onNavigate?: (href: string) => void },
): RunbookBackTarget {
  const normalized = label.trim().toLowerCase();
  const defaultAria =
    normalized === "cancel" ? "Cancel" : `Back to ${label.trim()}`;
  return {
    href,
    label,
    ariaLabel: options?.ariaLabel ?? defaultAria,
    onNavigate: options?.onNavigate,
  };
}

export function cancelBackTarget(
  href: string,
  options?: { onNavigate?: (href: string) => void },
): RunbookBackTarget {
  return namedBackTarget(href, "Cancel", {
    ariaLabel: "Cancel",
    onNavigate: options?.onNavigate,
  });
}
