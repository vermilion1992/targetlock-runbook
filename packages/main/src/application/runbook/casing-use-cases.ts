import {
  type AuditEntry,
  type CasingEvent,
  type CasingString,
  type JsonValue,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import type {
  AdvanceCasingInput,
  CasingRepository,
  CorrectCasingInput,
  InstallCasingInput,
  RemoveCasingInput,
  ShortenCasingInput,
  UpdateCasingStatusInput,
} from "@/infrastructure/casing";

const DEVICE_ID = "local-runbook-device";

export interface CasingServices {
  readonly casing: CasingRepository;
  readonly audits: AuditRepository;
}

function casingAudit(input: {
  readonly operationId: string;
  readonly holeId: string;
  readonly casingStringId: string;
  readonly action: string;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
  readonly depthDm: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
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
    entityType: "casing",
    entityId: input.casingStringId,
    action: input.action,
    userId: input.userId,
    userNameSnapshot: input.userNameSnapshot,
    timestamp: input.occurredAt,
    depthDm: input.depthDm as AuditEntry["depthDm"],
    metadata: {
      operationId: input.operationId,
      ...input.metadata,
    },
  };
}

async function appendCasingAudit(
  casing: CasingString,
  event: CasingEvent,
  action: string,
  services: CasingServices,
): Promise<void> {
  await services.audits.append(
    casingAudit({
      operationId: event.operationId,
      holeId: casing.holeId,
      casingStringId: casing.localId,
      action,
      userId: event.recordedByUserId,
      userNameSnapshot: event.recordedByNameSnapshot,
      occurredAt: event.recordedAt,
      depthDm: event.newEndDepthDm,
      metadata: {
        eventId: event.localId,
        eventType: event.eventType,
        casingSize: casing.casingSize,
        shiftId: event.shiftId ?? null,
        previousEndDepthDm: event.previousEndDepthDm ?? null,
        newEndDepthDm: event.newEndDepthDm,
        previousStatus: event.previousStatus ?? null,
        newStatus: event.newStatus ?? casing.status,
        reason: event.reason ?? null,
        comment: event.comment ?? null,
      },
    }),
  );
}

async function latestOperationEvent(
  holeId: string,
  casingStringId: string,
  operationId: string,
  repository: CasingRepository,
): Promise<CasingEvent> {
  const event = (await repository.listEvents(holeId, casingStringId)).find(
    (candidate) => candidate.operationId === operationId,
  );
  if (event === undefined) {
    throw new Error("The casing event could not be reloaded after saving.");
  }
  return event;
}

export async function installCasing(
  input: InstallCasingInput,
  services: CasingServices,
): Promise<CasingString> {
  const casing = await services.casing.install(input);
  const event = await latestOperationEvent(
    input.holeId,
    casing.localId,
    input.operationId,
    services.casing,
  );
  await appendCasingAudit(casing, event, "casing_installed", services);
  return casing;
}

export async function advanceCasing(
  input: AdvanceCasingInput,
  services: CasingServices,
): Promise<CasingString> {
  const casing = await services.casing.advance(input);
  const event = await latestOperationEvent(
    input.holeId,
    casing.localId,
    input.operationId,
    services.casing,
  );
  await appendCasingAudit(casing, event, "casing_advanced", services);
  return casing;
}

export async function shortenCasing(
  input: ShortenCasingInput,
  services: CasingServices,
): Promise<CasingString> {
  const casing = await services.casing.shorten(input);
  const event = await latestOperationEvent(
    input.holeId,
    casing.localId,
    input.operationId,
    services.casing,
  );
  await appendCasingAudit(casing, event, "casing_shortened", services);
  return casing;
}

export async function correctCasing(
  input: CorrectCasingInput,
  services: CasingServices,
): Promise<CasingString> {
  const casing = await services.casing.correct(input);
  const event = await latestOperationEvent(
    input.holeId,
    casing.localId,
    input.operationId,
    services.casing,
  );
  await appendCasingAudit(casing, event, "casing_corrected", services);
  return casing;
}

export async function removeCasing(
  input: RemoveCasingInput,
  services: CasingServices,
): Promise<CasingString> {
  const casing = await services.casing.remove(input);
  const event = await latestOperationEvent(
    input.holeId,
    casing.localId,
    input.operationId,
    services.casing,
  );
  await appendCasingAudit(casing, event, "casing_removed", services);
  return casing;
}

export async function updateCasingStatus(
  input: UpdateCasingStatusInput,
  services: CasingServices,
): Promise<CasingString> {
  const casing = await services.casing.setStatus(input);
  const event = await latestOperationEvent(
    input.holeId,
    casing.localId,
    input.operationId,
    services.casing,
  );
  await appendCasingAudit(casing, event, "casing_status_changed", services);
  return casing;
}

export async function getCurrentCasingState(
  holeId: string,
  services: CasingServices,
): Promise<readonly CasingString[]> {
  return (await services.casing.listByHole(holeId)).filter(
    ({ status }) => status === "ACTIVE" || status === "COMPLETED",
  );
}

export async function getCasingHistory(
  holeId: string,
  services: CasingServices,
): Promise<
  readonly {
    readonly casing: CasingString;
    readonly events: readonly CasingEvent[];
  }[]
> {
  const casingStrings = await services.casing.listByHole(holeId);
  return Promise.all(
    casingStrings.map(async (casing) => ({
      casing,
      events: await services.casing.listEvents(holeId, casing.localId),
    })),
  );
}

export async function getCasingStatistics(
  holeId: string,
  services: CasingServices,
): Promise<{
  readonly activeStrings: number;
  readonly sizes: readonly string[];
  readonly totalChanges: number;
  readonly casingStrings: readonly CasingString[];
}> {
  const [casingStrings, events] = await Promise.all([
    services.casing.listByHole(holeId),
    services.casing.listEvents(holeId),
  ]);
  return {
    activeStrings: casingStrings.filter(({ status }) => status === "ACTIVE")
      .length,
    sizes: [...new Set(casingStrings.map(({ casingSize }) => casingSize))],
    totalChanges: events.filter(({ eventType }) => eventType !== "INSTALL")
      .length,
    casingStrings,
  };
}
