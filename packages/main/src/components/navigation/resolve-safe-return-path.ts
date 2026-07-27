import { runbookRoutes } from "@/components/navigation/runbook-routes";

export interface ResolveSafeReturnPathInput {
  readonly requestedReturnTo: string | null | undefined;
  readonly canonicalFallback: string;
  readonly currentHoleId: string;
}

export interface ResolvedReturnPath {
  readonly href: string;
  readonly label: string;
}

/**
 * Resolve a named parent destination for in-app Back.
 * Never trusts browser history; rejects open redirects and cross-hole paths.
 */
export function resolveSafeReturnPath({
  requestedReturnTo,
  canonicalFallback,
  currentHoleId,
}: ResolveSafeReturnPathInput): ResolvedReturnPath {
  const fallback = {
    href: canonicalFallback,
    label: destinationLabelForPath(canonicalFallback, currentHoleId),
  };

  const candidate = requestedReturnTo?.trim();
  if (!candidate) {
    return fallback;
  }

  if (!isSafeInternalReturnPath(candidate, currentHoleId)) {
    return fallback;
  }

  return {
    href: candidate,
    label: destinationLabelForPath(candidate, currentHoleId),
  };
}

export function isSafeInternalReturnPath(
  path: string,
  currentHoleId: string,
): boolean {
  if (!path.startsWith("/")) {
    return false;
  }
  if (path.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    return false;
  }
  if (
    path.includes("://") ||
    path.includes("\\") ||
    path.includes("..") ||
    path.includes("\0")
  ) {
    return false;
  }

  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return false;
  }

  const holeSegment = pathname.match(/(?:^|\/)holes\/([^/?#]+)/i)?.[1];
  if (!holeSegment) {
    return true;
  }

  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(holeSegment);
  } catch {
    decodedSegment = holeSegment;
  }

  if (decodedSegment === "new" || decodedSegment === "completed") {
    return true;
  }

  return decodedSegment === currentHoleId.trim();
}

export function destinationLabelForPath(
  path: string,
  currentHoleId: string,
): string {
  const pathname = (path.split(/[?#]/, 1)[0] ?? path).replace(/\/$/, "") || "/";
  const holeId = currentHoleId.trim();

  const exactMatches: ReadonlyArray<readonly [string, string]> = [
    [runbookRoutes.more(holeId), "More"],
    [runbookRoutes.trajectory(holeId), "Trajectory"],
    [runbookRoutes.surveySettings(holeId), "Survey Settings"],
    [runbookRoutes.reports(holeId), "Reports"],
    [runbookRoutes.reportHistory(holeId), "Report History"],
    [runbookRoutes.shifts(holeId), "Shifts"],
    [runbookRoutes.runbook(holeId), "Runbook"],
    [runbookRoutes.currentHole(holeId), "Overview"],
    [runbookRoutes.trays(holeId), "Trays"],
    [runbookRoutes.timeline(holeId), "Timeline"],
    [runbookRoutes.statistics(holeId), "Statistics"],
    [runbookRoutes.casing(holeId), "Casing"],
    [runbookRoutes.holeComponents(holeId), "Bottom Hole Assembly"],
    [runbookRoutes.updateBha(holeId), "Update BHA"],
    [runbookRoutes.surveys(holeId), "Surveys"],
    [runbookRoutes.surveyTools(holeId), "Tools"],
    [runbookRoutes.completeHole(holeId), "Complete Hole"],
    [runbookRoutes.reopenHole(holeId), "Reopen Hole"],
    [runbookRoutes.completedHoles(), "Completed Holes"],
    [runbookRoutes.newHole(), "New Hole"],
    [runbookRoutes.recordRun(holeId), "Record Run"],
    [runbookRoutes.handover(holeId), "Handover"],
  ];

  for (const [href, label] of exactMatches) {
    if (pathname === href) {
      return label;
    }
  }

  const prefixMatches: ReadonlyArray<readonly [string, string]> = [
    [`${runbookRoutes.reports(holeId)}/`, "Reports"],
    [`${runbookRoutes.shifts(holeId)}/`, "Shifts"],
    [`/holes/${encodeURIComponent(holeId)}/runs/`, "Runbook"],
    [`${runbookRoutes.casing(holeId)}/`, "Casing"],
    [`${runbookRoutes.surveys(holeId)}/`, "Surveys"],
    [`${runbookRoutes.trays(holeId)}/`, "Trays"],
    [`${runbookRoutes.holeComponents(holeId)}/`, "Bottom Hole Assembly"],
    [`${runbookRoutes.trajectory(holeId)}/`, "Trajectory"],
  ];

  for (const [prefix, label] of prefixMatches) {
    if (pathname.startsWith(prefix) || pathname === prefix.replace(/\/$/, "")) {
      return label;
    }
  }

  return "Back";
}
