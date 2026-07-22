import {
  assessSurveyWarnings,
  type AuditEntry,
  type Decimetres,
  type JsonValue,
  type NorthReference,
  type Survey,
  type SurveyWarning,
} from "@/domain";
import type { AuditRepository } from "@/infrastructure/audit";
import {
  generateImagePreview,
  validateImageBlob,
  type MediaRepository,
} from "@/infrastructure/media";
import type { PhotoRepository } from "@/infrastructure/trays";
import type {
  CreateSurveyToolInput,
  CorrectSurveyInput,
  SurveyRepository,
  SurveyToolRepository,
  UpdateSurveyToolInput,
} from "@/infrastructure/surveys";

const DEVICE_ID = "local-runbook-device";

export interface SurveyServices {
  readonly surveys: SurveyRepository;
  readonly surveyTools: SurveyToolRepository;
  readonly photos: PhotoRepository;
  readonly media: MediaRepository;
  readonly audits: AuditRepository;
}

export interface RecordSurveyInput {
  readonly operationId: string;
  readonly surveyId: string;
  readonly photoId?: string;
  readonly holeId: string;
  readonly shiftId?: string;
  readonly depthDm: Decimetres;
  readonly dipTenths: number;
  readonly azimuthTenths: number;
  readonly northReference: NorthReference;
  readonly surveyToolId?: string;
  readonly comment?: string;
  readonly currentCompletedDepthDm: Decimetres;
  readonly warningsConfirmed?: boolean;
  readonly photo?: Blob;
  readonly photoFilename?: string;
  readonly recordedByUserId: string;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: string;
}

export class SurveyWarningConfirmationRequired extends Error {
  constructor(readonly warnings: readonly SurveyWarning[]) {
    super("Check the survey warnings before saving.");
    this.name = "SurveyWarningConfirmationRequired";
  }
}

function auditEntry(input: {
  readonly operationId: string;
  readonly holeId: string;
  readonly entityId: string;
  readonly entityType?: string;
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
    entityType: input.entityType ?? "survey",
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

export async function recordSurvey(
  input: RecordSurveyInput,
  services: SurveyServices,
): Promise<Survey> {
  const existing = await services.surveys.listByHole(input.holeId);
  const warnings = assessSurveyWarnings({
    depthDm: input.depthDm,
    dipTenths: input.dipTenths,
    azimuthTenths: input.azimuthTenths,
    northReference: input.northReference,
    surveyToolId: input.surveyToolId,
    currentCompletedDepthDm: input.currentCompletedDepthDm,
    surveys: existing,
  });
  if (warnings.length > 0 && !input.warningsConfirmed) {
    throw new SurveyWarningConfirmationRequired(warnings);
  }

  // Reject locked holes before writing media blobs that cannot be rolled back.
  services.surveys.assertHoleMutable(input.holeId);

  let photoId: string | undefined;
  if (input.photo !== undefined) {
    validateImageBlob(input.photo);
    photoId = input.photoId ?? `photo-${input.surveyId}`;
    const savedOriginal = await services.media.saveOriginal({
      operationId: `${input.operationId}-photo`,
      blob: input.photo,
    });
    if (!(await services.media.verify(savedOriginal.storageKey))) {
      throw new Error("Survey photograph could not be verified locally.");
    }
    let previewStorageKey: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    try {
      const preview = await generateImagePreview(input.photo);
      width = preview.width;
      height = preview.height;
      const savedPreview = await services.media.savePreview({
        operationId: `${input.operationId}-photo`,
        blob: preview.blob,
      });
      if (await services.media.verify(savedPreview.storageKey)) {
        previewStorageKey = savedPreview.storageKey;
      }
    } catch {
      previewStorageKey = undefined;
    }
    await services.photos.create({
      photo: {
        localId: photoId,
        serverId: null,
        syncStatus: "local-only",
        createdAt: input.recordedAt,
        updatedAt: input.recordedAt,
        deviceId: DEVICE_ID,
        version: 1,
        holeId: input.holeId,
        entityType: "SURVEY",
        entityId: input.surveyId,
        category: "SURVEY",
        originalStorageKey: savedOriginal.storageKey,
        previewStorageKey,
        originalFilename: input.photoFilename,
        mimeType: input.photo.type,
        sizeBytes: input.photo.size,
        width,
        height,
        capturedAt: input.recordedAt,
        description: `Survey result at ${String(input.depthDm / 10)} metres`,
        createdByUserId: input.recordedByUserId,
        createdByNameSnapshot: input.recordedByNameSnapshot,
      },
    });
  }

  const survey = await services.surveys.create({
    operationId: input.operationId,
    surveyId: input.surveyId,
    holeId: input.holeId,
    shiftId: input.shiftId,
    depthDm: input.depthDm,
    dipTenths: input.dipTenths,
    azimuthTenths: input.azimuthTenths,
    northReference: input.northReference,
    surveyToolId: input.surveyToolId,
    comment: input.comment,
    photoId,
    recordedByUserId: input.recordedByUserId,
    recordedByNameSnapshot: input.recordedByNameSnapshot,
    recordedAt: input.recordedAt,
  });
  await services.audits.append(
    auditEntry({
      operationId: input.operationId,
      holeId: input.holeId,
      entityId: survey.localId,
      action: "survey_recorded",
      userId: input.recordedByUserId,
      userNameSnapshot: input.recordedByNameSnapshot,
      occurredAt: input.recordedAt,
      depthDm: survey.depthDm,
      metadata: {
        shiftId: input.shiftId ?? null,
        dipTenths: survey.dipTenths,
        azimuthTenths: survey.azimuthTenths,
        northReference: survey.northReference,
        surveyToolId: survey.surveyToolId ?? null,
        toolName: survey.toolNameSnapshot ?? null,
        photoId: survey.photoId ?? null,
        warningsConfirmed: warnings.length > 0,
      },
    }),
  );
  if (photoId !== undefined) {
    await services.audits.append(
      auditEntry({
        operationId: input.operationId,
        holeId: input.holeId,
        entityId: survey.localId,
        action: "survey_photograph_attached",
        userId: input.recordedByUserId,
        userNameSnapshot: input.recordedByNameSnapshot,
        occurredAt: input.recordedAt,
        depthDm: survey.depthDm,
        metadata: { photoId },
      }),
    );
  }
  return survey;
}

export async function correctSurvey(
  input: CorrectSurveyInput,
  services: SurveyServices,
): Promise<Survey> {
  const previous = await services.surveys.getById(input.surveyId);
  const survey = await services.surveys.correct(input);
  await services.audits.append(
    auditEntry({
      operationId: input.operationId,
      holeId: input.holeId,
      entityId: input.surveyId,
      action: "survey_corrected",
      userId: input.correctedByUserId,
      userNameSnapshot: input.correctedByNameSnapshot,
      occurredAt: input.correctedAt,
      depthDm: survey.depthDm,
      metadata: {
        reason: input.reason,
        previousDepthDm: previous?.depthDm ?? null,
        depthDm: survey.depthDm,
        previousDipTenths: previous?.dipTenths ?? null,
        dipTenths: survey.dipTenths,
        previousAzimuthTenths: previous?.azimuthTenths ?? null,
        azimuthTenths: survey.azimuthTenths,
        previousNorthReference: previous?.northReference ?? null,
        northReference: survey.northReference,
      },
    }),
  );
  return survey;
}

export async function createSurveyTool(
  input: CreateSurveyToolInput & { readonly auditHoleId: string },
  services: SurveyServices,
) {
  const tool = await services.surveyTools.create(input);
  await services.audits.append(
    auditEntry({
      operationId: input.operationId,
      holeId: input.auditHoleId,
      entityType: "survey_tool",
      entityId: tool.localId,
      action: "survey_tool_created",
      userId: input.createdByUserId,
      userNameSnapshot: input.createdByNameSnapshot,
      occurredAt: input.occurredAt,
      metadata: {
        name: tool.name,
        serialNumber: tool.serialNumber ?? null,
        defaultNorthReference: tool.defaultNorthReference ?? null,
      },
    }),
  );
  return tool;
}

export async function correctSurveyTool(
  input: UpdateSurveyToolInput & { readonly auditHoleId: string },
  services: SurveyServices,
) {
  const previous = await services.surveyTools.getById(input.toolId);
  const tool = await services.surveyTools.update(input);
  await services.audits.append(
    auditEntry({
      operationId: input.operationId,
      holeId: input.auditHoleId,
      entityType: "survey_tool",
      entityId: tool.localId,
      action: "survey_tool_corrected",
      userId: input.userId,
      userNameSnapshot: input.userNameSnapshot,
      occurredAt: input.occurredAt,
      metadata: {
        previousName: previous?.name ?? null,
        name: tool.name,
        previousSerialNumber: previous?.serialNumber ?? null,
        serialNumber: tool.serialNumber ?? null,
        previousStatus: previous?.status ?? null,
        status: tool.status,
      },
    }),
  );
  return tool;
}
