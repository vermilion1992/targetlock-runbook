import type { ReportSourceVersion } from "./types";

export type ReportCurrencyStatus = "current" | "out_of_date";

export interface ReportCurrencyResult {
  readonly status: ReportCurrencyStatus;
  readonly generatedFingerprint: string;
  readonly currentFingerprint: string;
  readonly changesDetected: readonly string[];
}

const RELEVANT_ENTITY_TYPES = new Set([
  "hole",
  "run",
  "rod_event",
  "shift",
  "casing",
  "casing_event",
  "component_assignment",
  "survey",
  "tray",
  "correction",
  "completion",
  "reopen",
]);

export function fingerprintSourceVersions(
  versions: readonly ReportSourceVersion[],
): string {
  return versions
    .filter((item) => RELEVANT_ENTITY_TYPES.has(item.entityType))
    .map((item) => `${item.entityType}:${item.entityId}:${item.version}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function summariseChanges(
  generated: readonly ReportSourceVersion[],
  current: readonly ReportSourceVersion[],
): string[] {
  const generatedMap = new Map(
    generated
      .filter((item) => RELEVANT_ENTITY_TYPES.has(item.entityType))
      .map((item) => [`${item.entityType}:${item.entityId}`, item.version] as const),
  );
  const currentMap = new Map(
    current
      .filter((item) => RELEVANT_ENTITY_TYPES.has(item.entityType))
      .map((item) => [`${item.entityType}:${item.entityId}`, item.version] as const),
  );
  const labels = new Set<string>();

  for (const [key, version] of currentMap) {
    const previous = generatedMap.get(key);
    if (previous === undefined) {
      labels.add(labelForKey(key, "added"));
    } else if (previous !== version) {
      labels.add(labelForKey(key, "updated"));
    }
  }
  for (const key of generatedMap.keys()) {
    if (!currentMap.has(key)) {
      labels.add(labelForKey(key, "removed"));
    }
  }
  return [...labels].sort((left, right) => left.localeCompare(right));
}

function labelForKey(key: string, change: "added" | "updated" | "removed"): string {
  const entityType = key.split(":")[0] ?? "record";
  const noun =
    entityType === "rod_event"
      ? "Rod events"
      : entityType === "component_assignment"
        ? "Component assignments"
        : entityType === "casing_event"
          ? "Casing"
          : entityType === "completion" || entityType === "reopen"
            ? "Completion"
            : `${entityType.charAt(0).toUpperCase()}${entityType.slice(1)}s`;
  if (change === "added") return `${noun} added`;
  if (change === "removed") return `${noun} removed`;
  return `${noun} changed`;
}

export function evaluateReportCurrency(
  generatedVersions: readonly ReportSourceVersion[],
  currentVersions: readonly ReportSourceVersion[],
): ReportCurrencyResult {
  const generatedFingerprint = fingerprintSourceVersions(generatedVersions);
  const currentFingerprint = fingerprintSourceVersions(currentVersions);
  if (generatedFingerprint === currentFingerprint) {
    return {
      status: "current",
      generatedFingerprint,
      currentFingerprint,
      changesDetected: [],
    };
  }
  return {
    status: "out_of_date",
    generatedFingerprint,
    currentFingerprint,
    changesDetected: summariseChanges(generatedVersions, currentVersions),
  };
}
