import {
  decimetres,
  type AuditEntry,
  type Hole,
  type HoleCompletionRecord,
  type HoleCompletionReview,
  type HoleReopenRecord,
  type SyncMetadata,
} from "@/domain";
import type { CompletionRepositorySeed } from "@/infrastructure/completion";
import {
  ddh041Stage4AuditEntries,
  targetLockStage4Seed,
} from "./target-lock-stage4";

const DEVICE_ID = "seed-tablet-rig-10";
const COMPLETED_AT = "2026-07-15T10:00:00.000Z";
const ABANDONED_AT = "2026-07-16T08:30:00.000Z";
const REOPENED_AT = "2026-07-18T09:00:00.000Z";

function metadata(localId: string, updatedAt: string): SyncMetadata {
  return {
    localId,
    serverId: `server-${localId}`,
    syncStatus: "synced",
    createdAt: updatedAt,
    updatedAt,
    deviceId: DEVICE_ID,
    version: 3,
  };
}

function seedHole(
  name: string,
  status: Hole["status"],
  currentDepthDm: number,
  updatedAt: string,
): Hole {
  return {
    ...metadata(name, updatedAt),
    projectId: targetLockStage4Seed.project.localId,
    rigId: targetLockStage4Seed.rig.localId,
    name,
    holeSize: "HQ",
    plannedDepth: decimetres(7_500),
    currentDepth: decimetres(currentDepthDm),
    status,
    collarEasting: 482_300,
    collarNorthing: 7_514_800,
    collarElevation: 480,
  };
}

function seedReview(
  localId: string,
  holeId: string,
  disposition: "COMPLETED" | "ABANDONED",
  reason: HoleCompletionReview["reason"],
  startedAt: string,
): HoleCompletionReview {
  return {
    ...metadata(localId, startedAt),
    holeId,
    reviewStatus: "COMPLETED",
    disposition,
    reason,
    comment: "Seeded Stage 5 completion review.",
    finalSurveyResolution: {
      status: "UNAVAILABLE",
      reason: "Final survey unavailable in seed fixture.",
    },
    checklist: [],
    componentOutcomes: [],
    warningAcknowledgements: [
      {
        checkCode: "FINAL_PARTIAL_TRAY",
        reason: "Final partial tray confirmed in seed fixture.",
        acknowledgedAt: startedAt,
        acknowledgedByUserId: "user-supervisor-lee",
        acknowledgedByNameSnapshot: "Morgan Lee",
      },
    ],
    startedByUserId: "user-supervisor-lee",
    startedByNameSnapshot: "Morgan Lee",
    startedAt,
  };
}

function seedCompletion(
  localId: string,
  holeId: string,
  reviewId: string,
  operationId: string,
  finalStatus: "COMPLETED" | "ABANDONED",
  completedAt: string,
  finalDepthDm: number,
  reason: HoleCompletionRecord["snapshot"]["reason"],
): HoleCompletionRecord {
  return {
    ...metadata(localId, completedAt),
    holeId,
    reviewId,
    finalStatus,
    completedAt,
    completedByUserId: "user-supervisor-lee",
    completedByNameSnapshot: "Morgan Lee",
    operationId,
    snapshot: {
      holeId,
      projectId: targetLockStage4Seed.project.localId,
      projectNameSnapshot: targetLockStage4Seed.project.name,
      rigId: targetLockStage4Seed.rig.localId,
      rigNameSnapshot: targetLockStage4Seed.rig.name,
      finalStatus,
      finalDepthDm: decimetres(finalDepthDm),
      plannedDepthDm: decimetres(7_500),
      finalRunNumber: finalStatus === "ABANDONED" ? 88 : 120,
      runIds: [`run-seed-${holeId.toLocaleLowerCase("en-AU")}`],
      finalRodNumber: finalStatus === "ABANDONED" ? 44 : 60,
      currentRodStringDm: decimetres(finalDepthDm + 10),
      measuredStickUpDm: decimetres(10),
      bottomHoleAssemblyLengthDm: decimetres(30),
      constantStickUpDm: decimetres(10),
      baseRodStringDm: decimetres(20),
      rodStringConfigurationId: "rod-config-seed",
      casingSummary: "HQ to 18.0 m",
      finalBitSummary: "BIT-HQ-SEED",
      finalPartialTrayConfirmed: true,
      surveyCount: 4,
      trayCount: 12,
      totalRuns: finalStatus === "ABANDONED" ? 88 : 120,
      totalDrilledDm: decimetres(finalDepthDm),
      totalRecoveredDm: decimetres(finalDepthDm - 40),
      totalLossDm: decimetres(40),
      totalGainDm: decimetres(0),
      overallRecoveryPercentTenths: 990,
      reason,
      comment: "Seeded Stage 5 completion snapshot.",
      checklist: [],
      componentOutcomes: [],
      warningAcknowledgements: [
        {
          checkCode: "FINAL_PARTIAL_TRAY",
          reason: "Final partial tray confirmed in seed fixture.",
          acknowledgedAt: completedAt,
          acknowledgedByUserId: "user-supervisor-lee",
          acknowledgedByNameSnapshot: "Morgan Lee",
        },
      ],
      finalSurveyUnavailableReason: "Final survey unavailable in seed fixture.",
      completedByUserId: "user-supervisor-lee",
      completedByNameSnapshot: "Morgan Lee",
      capturedAt: completedAt,
    },
  };
}

const reviewDdh038 = seedReview(
  "review-ddh038",
  "DDH038",
  "COMPLETED",
  "PLANNED_DEPTH_REACHED",
  COMPLETED_AT,
);
const reviewDdh039 = seedReview(
  "review-ddh039",
  "DDH039",
  "ABANDONED",
  "HOLE_ABANDONED",
  ABANDONED_AT,
);
const reviewDdh042 = seedReview(
  "review-ddh042",
  "DDH042",
  "COMPLETED",
  "CLIENT_STOPPED",
  "2026-07-17T11:00:00.000Z",
);

const completionDdh038 = seedCompletion(
  "completion-ddh038",
  "DDH038",
  reviewDdh038.localId,
  "seed-complete-ddh038",
  "COMPLETED",
  COMPLETED_AT,
  3_600,
  "PLANNED_DEPTH_REACHED",
);
const completionDdh039 = seedCompletion(
  "completion-ddh039",
  "DDH039",
  reviewDdh039.localId,
  "seed-complete-ddh039",
  "ABANDONED",
  ABANDONED_AT,
  2_140,
  "HOLE_ABANDONED",
);
const completionDdh042 = seedCompletion(
  "completion-ddh042",
  "DDH042",
  reviewDdh042.localId,
  "seed-complete-ddh042",
  "COMPLETED",
  "2026-07-17T11:00:00.000Z",
  2_880,
  "CLIENT_STOPPED",
);

const reopenDdh042: HoleReopenRecord = {
  ...metadata("reopen-ddh042", REOPENED_AT),
  holeId: "DDH042",
  completionRecordId: completionDdh042.localId,
  previousStatus: "COMPLETED",
  reopenedStatus: "ACTIVE",
  reason: "Client approved a short extension for Stage 5 reopen testing.",
  reopenedAt: REOPENED_AT,
  reopenedByUserId: "user-supervisor-lee",
  reopenedByNameSnapshot: "Morgan Lee",
  operationId: "seed-reopen-ddh042",
};

export const stage5CompletionSeed: CompletionRepositorySeed = {
  holes: [
    {
      ...targetLockStage4Seed.hole,
      localId: targetLockStage4Seed.hole.name,
      status: "ACTIVE",
    },
    seedHole("DDH038", "COMPLETED", 3_600, COMPLETED_AT),
    seedHole("DDH039", "ABANDONED", 2_140, ABANDONED_AT),
    seedHole("DDH042", "ACTIVE", 2_880, REOPENED_AT),
  ],
  reviews: [reviewDdh038, reviewDdh039, reviewDdh042],
  completions: [completionDdh038, completionDdh039, completionDdh042],
  reopens: [reopenDdh042],
};

function lifecycleAudit(
  localId: string,
  holeId: string,
  action: string,
  entityType: "hole" | "hole_timeline",
  timestamp: string,
  depthDm: number,
  metadata: AuditEntry["metadata"],
): AuditEntry {
  return {
    localId,
    serverId: `server-${localId}`,
    syncStatus: "synced",
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceId: DEVICE_ID,
    version: 1,
    holeId,
    entityType,
    entityId: holeId,
    action,
    userId: "user-supervisor-lee",
    userNameSnapshot: "Morgan Lee",
    timestamp,
    depthDm: decimetres(depthDm),
    metadata,
  };
}

export const stage5LifecycleAuditEntries: readonly AuditEntry[] = [
  lifecycleAudit(
    "audit-seed-complete-ddh038-timeline",
    "DDH038",
    "hole_completed_timeline",
    "hole_timeline",
    COMPLETED_AT,
    3_600,
    {
      operationId: "seed-complete-ddh038",
      completionRecordId: "completion-ddh038",
      finalStatus: "COMPLETED",
    },
  ),
  lifecycleAudit(
    "audit-seed-complete-ddh038-audit",
    "DDH038",
    "hole_completed",
    "hole",
    COMPLETED_AT,
    3_600,
    {
      operationId: "seed-complete-ddh038",
      completionRecordId: "completion-ddh038",
      finalStatus: "COMPLETED",
    },
  ),
  lifecycleAudit(
    "audit-seed-complete-ddh039-timeline",
    "DDH039",
    "hole_abandoned_timeline",
    "hole_timeline",
    ABANDONED_AT,
    2_140,
    {
      operationId: "seed-complete-ddh039",
      completionRecordId: "completion-ddh039",
      finalStatus: "ABANDONED",
    },
  ),
  lifecycleAudit(
    "audit-seed-complete-ddh039-audit",
    "DDH039",
    "hole_abandoned",
    "hole",
    ABANDONED_AT,
    2_140,
    {
      operationId: "seed-complete-ddh039",
      completionRecordId: "completion-ddh039",
      finalStatus: "ABANDONED",
    },
  ),
  lifecycleAudit(
    "audit-seed-reopen-ddh042-timeline",
    "DDH042",
    "hole_reopened_timeline",
    "hole_timeline",
    REOPENED_AT,
    2_880,
    {
      operationId: "seed-reopen-ddh042",
      completionRecordId: "completion-ddh042",
      reopenRecordId: "reopen-ddh042",
      previousStatus: "COMPLETED",
    },
  ),
  lifecycleAudit(
    "audit-seed-reopen-ddh042-audit",
    "DDH042",
    "hole_reopened",
    "hole",
    REOPENED_AT,
    2_880,
    {
      operationId: "seed-reopen-ddh042",
      completionRecordId: "completion-ddh042",
      reopenRecordId: "reopen-ddh042",
      previousStatus: "COMPLETED",
    },
  ),
];

export const ddh041Stage5AuditEntries: readonly AuditEntry[] = [
  ...ddh041Stage4AuditEntries,
  ...stage5LifecycleAuditEntries,
];

/**
 * Stage 5 keeps Stage 4 operational records for active DDH041 and adds
 * repository-compatible completed, abandoned, and reopened hole fixtures.
 */
export const targetLockStage5Seed = {
  ...targetLockStage4Seed,
  completionSeed: stage5CompletionSeed,
};

export type TargetLockStage5Seed = typeof targetLockStage5Seed;
