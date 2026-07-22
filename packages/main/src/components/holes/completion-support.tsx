import type { CompletionActor } from "@/application/runbook";
import {
  HOLE_COMPLETION_REASON_LABELS,
  HOLE_STATUS_LABELS,
  type HoleCompletionComponentOutcomeCode,
  type HoleCompletionReason,
  type HoleStatus,
} from "@/domain";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export function createCompletionOperationId(prefix: string): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultCompletionActor(): CompletionActor {
  const user =
    targetLockStage4Seed.users.find(({ role }) => role === "supervisor") ??
    targetLockStage4Seed.users.find(({ role }) => role === "driller") ??
    targetLockStage4Seed.users[0];
  return {
    id: user?.localId ?? "local-operator",
    name: user?.displayName ?? "Local operator",
  };
}

export function completionReasonLabel(reason: HoleCompletionReason): string {
  return HOLE_COMPLETION_REASON_LABELS[reason];
}

export function holeStatusLabel(status: HoleStatus): string {
  return HOLE_STATUS_LABELS[status];
}

export const COMPONENT_OUTCOME_OPTIONS: readonly {
  readonly value: HoleCompletionComponentOutcomeCode;
  readonly label: string;
}[] = [
  { value: "SERVICEABLE", label: "Serviceable" },
  { value: "UNDER_INSPECTION", label: "Under inspection" },
  { value: "RETIRED", label: "Retired" },
  { value: "LOST_DOWNHOLE", label: "Lost downhole" },
  { value: "CARRIED_FORWARD", label: "Carried forward" },
];

export function correctionHrefForCheck(
  holeId: string,
  checkCode: string,
): string | null {
  switch (checkCode) {
    case "RUNS_FINISHED":
    case "RUN_NUMBERS_UNIQUE":
    case "RUN_SEQUENCE_COMPLETE":
    case "RUN_DEPTH_GAPS":
    case "RUN_DEPTH_OVERLAPS":
    case "RUN_LENGTHS_POSITIVE":
    case "RUN_DEPTHS_RECONCILED":
    case "FINAL_DEPTH_AVAILABLE":
    case "FINAL_DEPTH_RECONCILED":
      return `/holes/${encodeURIComponent(holeId)}/runs`;
    case "ROD_CONFIGURATION_VALID":
    case "ROD_FIELDS_COMPLETE":
    case "ROD_EVENTS_SETTLED":
      return `/holes/${encodeURIComponent(holeId)}/runs/new`;
    case "SHIFTS_CLOSED":
    case "HANDOVERS_RESOLVED":
      return `/holes/${encodeURIComponent(holeId)}/shifts`;
    case "CASING_VALID":
    case "CASING_REVIEWED":
      return `/holes/${encodeURIComponent(holeId)}/casing`;
    case "COMPONENTS_RESOLVED":
      return `/holes/${encodeURIComponent(holeId)}/components`;
    case "FINAL_SURVEY_RESOLVED":
    case "FINAL_SURVEY_UNAVAILABLE":
      return `/holes/${encodeURIComponent(holeId)}/surveys`;
    case "TRAYS_RECONCILED":
    case "FINAL_PARTIAL_TRAY":
      return `/holes/${encodeURIComponent(holeId)}/trays`;
    default:
      return null;
  }
}
