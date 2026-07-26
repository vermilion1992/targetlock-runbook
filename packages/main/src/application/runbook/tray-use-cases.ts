import {
  validateTrayInput,
  type AuditEntry,
  type Decimetres,
  type JsonValue,
  type Tray,
  type TrayValidationIssue,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type {
  CreateTrayWithPhotoInput,
  ReplaceTrayPhotoInput,
  TrayRepository,
  UpdateTrayDetailsInput,
} from "@/infrastructure/trays";

const DEVICE_ID = "local-runbook-device";

export interface TrayServices {
  readonly trays: TrayRepository;
  readonly audits: AuditRepository;
}

export interface CreateOperationalTrayInput extends CreateTrayWithPhotoInput {
  readonly currentCompletedDepthDm: Decimetres;
  readonly warningsConfirmed?: boolean;
}

export class TrayWarningConfirmationRequired extends Error {
  constructor(readonly warnings: readonly TrayValidationIssue[]) {
    super("Check the tray warnings before saving.");
    this.name = "TrayWarningConfirmationRequired";
  }
}

function trayAudit(input: {
  readonly operationId: string;
  readonly holeId: string;
  readonly entityId: string;
  readonly action: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
  readonly depthDm?: Decimetres;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}): AuditEntry {
  return {
    localId: `audit-${input.operationId}-${input.action}`,
    serverId: null,
    syncStatus: "local-only",
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    deviceId: DEVICE_ID,
    version: 1,
    holeId: input.holeId,
    entityType: "tray",
    entityId: input.entityId,
    action: input.action,
    userId: input.userId,
    userNameSnapshot: input.userNameSnapshot,
    timestamp: input.occurredAt,
    depthDm: input.depthDm,
    metadata: {
      operationId: input.operationId,
      ...(input.metadata ?? {}),
    },
  };
}

export async function createOperationalTray(
  input: CreateOperationalTrayInput,
  services: TrayServices,
): Promise<Tray> {
  const existing = await services.trays.listByHole(input.holeId);
  const validation = validateTrayInput({
    trayNumber: input.trayNumber,
    startDepthDm: input.startDepthDm,
    endDepthDm: input.endDepthDm,
    currentCompletedDepthDm: input.currentCompletedDepthDm,
    trays: existing,
  });
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.map(({ message }) => message).join(" "));
  }
  if (validation.warnings.length > 0 && !input.warningsConfirmed) {
    throw new TrayWarningConfirmationRequired(validation.warnings);
  }
  const tray = await services.trays.createWithPhoto(input);
  await services.audits.append(
    trayAudit({
      operationId: input.operationId,
      holeId: input.holeId,
      entityId: tray.localId,
      action: "tray_photographed",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.capturedAt,
      depthDm: tray.endDepthDm ?? tray.startDepthDm,
      metadata: {
        shiftId: input.shiftId ?? null,
        trayNumber: tray.trayNumber,
        startDepthDm: tray.startDepthDm ?? null,
        endDepthDm: tray.endDepthDm ?? null,
        photoId: tray.primaryPhotoId,
        isFinalPartial: tray.isFinalPartial,
        warningsConfirmed: validation.warnings.length > 0,
      },
    }),
  );
  return tray;
}

export async function correctTrayDetails(
  input: UpdateTrayDetailsInput,
  services: TrayServices,
): Promise<Tray> {
  const previous = await services.trays.getById(input.trayId, input.holeId);
  const tray = await services.trays.updateDetails(input);
  await services.audits.append(
    trayAudit({
      operationId: input.operationId,
      holeId: input.holeId,
      entityId: tray.localId,
      action: "tray_details_corrected",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      depthDm: tray.endDepthDm ?? tray.startDepthDm,
      metadata: {
        reason: input.reason,
        previousTrayNumber: previous?.trayNumber ?? null,
        trayNumber: tray.trayNumber,
        previousStartDepthDm: previous?.startDepthDm ?? null,
        startDepthDm: tray.startDepthDm ?? null,
        previousEndDepthDm: previous?.endDepthDm ?? null,
        endDepthDm: tray.endDepthDm ?? null,
        previousIsFinalPartial: previous?.isFinalPartial ?? null,
        isFinalPartial: tray.isFinalPartial,
      },
    }),
  );
  return tray;
}

export async function replaceOperationalTrayPhoto(
  input: ReplaceTrayPhotoInput,
  services: TrayServices,
): Promise<Tray> {
  const previous = await services.trays.getById(input.trayId, input.holeId);
  const tray = await services.trays.replacePhoto(input);
  await services.audits.append(
    trayAudit({
      operationId: input.operationId,
      holeId: input.holeId,
      entityId: tray.localId,
      action: "tray_photograph_replaced",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.capturedAt,
      depthDm: tray.endDepthDm ?? tray.startDepthDm,
      metadata: {
        reason: input.reason,
        trayNumber: tray.trayNumber,
        previousPhotoId: previous?.primaryPhotoId ?? null,
        photoId: tray.primaryPhotoId,
      },
    }),
  );
  return tray;
}
