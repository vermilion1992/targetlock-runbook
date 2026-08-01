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

/**
 * Visible back label: parent name (or Cancel). Arrow is rendered separately.
 * Keep full "Back to …" in aria-label via backAriaLabel.
 */
export function backVisibleLabel(label: string): {
  short: string;
  long: string;
} {
  const trimmed = label.trim() || "Back";
  return { short: trimmed, long: trimmed };
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
