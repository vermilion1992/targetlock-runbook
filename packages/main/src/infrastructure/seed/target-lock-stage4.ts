import { decimetres, type AuditEntry } from "@/domain";
import {
  ddh041Photos,
  ddh041Surveys,
  ddh041Trays,
  briggsSurveyTools,
} from "./target-lock-stage1";
import {
  ddh041Stage2AuditEntries,
  targetLockStage2Seed,
} from "./target-lock-stage2";
import { targetLockStage3Seed } from "./target-lock-stage3";

const stage4AuditEntries: readonly AuditEntry[] = [
  {
    localId: "audit-stage4-seed-survey-correction",
    serverId: "server-audit-stage4-seed-survey-correction",
    syncStatus: "synced",
    createdAt: "2026-07-20T14:05:00.000Z",
    updatedAt: "2026-07-20T14:05:00.000Z",
    deviceId: "seed-tablet-rig-10",
    version: 1,
    holeId: "DDH041",
    entityType: "survey",
    entityId: "survey-ddh041-425",
    action: "survey_corrected",
    userId: "user-driller-hoffman",
    userNameSnapshot: "M. Hoffman",
    timestamp: "2026-07-20T14:05:00.000Z",
    depthDm: decimetres(4_250),
    metadata: {
      operationId: "seed-survey-correction-425",
      reason: "Typing mistake",
      previousAzimuthTenths: 1398,
      azimuthTenths: 1298,
    },
  },
  {
    localId: "audit-stage4-seed-tray-replacement",
    serverId: "server-audit-stage4-seed-tray-replacement",
    syncStatus: "synced",
    createdAt: "2026-07-20T15:00:00.000Z",
    updatedAt: "2026-07-20T15:00:00.000Z",
    deviceId: "seed-tablet-rig-10",
    version: 1,
    holeId: "DDH041",
    entityType: "tray",
    entityId: "tray-ddh041-110",
    action: "tray_photograph_replaced",
    userId: "user-driller-hoffman",
    userNameSnapshot: "M. Hoffman",
    timestamp: "2026-07-20T15:00:00.000Z",
    depthDm: decimetres(6_556),
    metadata: {
      operationId: "seed-tray-replacement-110",
      reason: "First photograph was blurred",
      trayNumber: 110,
      previousPhotoId: "photo-ddh041-tray-110-original",
      photoId: "photo-ddh041-tray-110",
    },
  },
];

export const ddh041Stage4AuditEntries: readonly AuditEntry[] = [
  ...ddh041Stage2AuditEntries,
  ...stage4AuditEntries,
];

/**
 * Stage 4 keeps Stage 3 operational records and replaces survey/tray previews
 * with repository-compatible records. The seed is read-only until a local
 * write creates a versioned envelope, making hydration idempotent.
 */
export const targetLockStage4Seed = {
  ...targetLockStage3Seed,
  surveys: ddh041Surveys,
  surveyTools: briggsSurveyTools,
  trays: ddh041Trays,
  photos: ddh041Photos,
  holeConfigurations: targetLockStage2Seed.holeConfigurations.map(
    (configuration, index, configurations) =>
      index === configurations.length - 1
        ? {
            ...configuration,
            preferredSurveyIntervalDm: decimetres(250),
          }
        : configuration,
  ),
};

export type TargetLockStage4Seed = typeof targetLockStage4Seed;
