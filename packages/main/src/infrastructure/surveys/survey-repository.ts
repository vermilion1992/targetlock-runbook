import { z } from "zod";

import {
  decimetres,
  type CorrectionValue,
  type Decimetres,
  type NorthReference,
  type Survey,
  type SurveyTool,
  type SurveyToolStatus,
} from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

const SURVEY_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";

const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);
const metadataShape = {
  localId: z.string().min(1),
  serverId: z.string().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
};
const northReferenceSchema = z.enum([
  "MAGNETIC",
  "TRUE",
  "GRID",
  "NOT_SPECIFIED",
]);
const surveyToolSchema = z.object({
  ...metadataShape,
  organisationId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  manufacturer: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  serialNumber: z.string().trim().min(1).max(100).optional(),
  defaultNorthReference: northReferenceSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  createdByUserId: z.string().min(1),
  createdByNameSnapshot: z.string().trim().min(1),
});
const surveySchema = z.object({
  ...metadataShape,
  holeId: z.string().min(1),
  shiftId: z.string().min(1).optional(),
  depthDm: z.number().int().nonnegative(),
  dipTenths: z.number().int().min(-900).max(900),
  azimuthTenths: z.number().int().min(0).max(3599),
  northReference: northReferenceSchema,
  surveyToolId: z.string().min(1).optional(),
  toolNameSnapshot: z.string().trim().min(1).optional(),
  toolSerialSnapshot: z.string().trim().min(1).optional(),
  comment: z.string().trim().max(2_000).optional(),
  photoId: z.string().min(1).optional(),
  recordedByUserId: z.string().min(1),
  recordedByNameSnapshot: z.string().trim().min(1),
  recordedAt: z.string().datetime(),
});
const correctionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const correctionSchema = z.object({
  id: z.string().min(1),
  surveyId: z.string().min(1),
  fieldName: z.string().min(1),
  previousValue: correctionValueSchema,
  correctedValue: correctionValueSchema,
  reason: z.string().trim().min(1).max(500),
  correctedAt: z.string().datetime(),
  correctedByUserId: z.string().min(1),
  correctedByNameSnapshot: z.string().trim().min(1),
  operationId: z.string().min(1),
});
const operationSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum(["CREATE_SURVEY", "CORRECT_SURVEY", "ATTACH_PHOTO", "TOOL"]),
  inputJson: z.string(),
  entityId: z.string().min(1),
  completedAt: z.string().datetime(),
});
const envelopeSchema = z.object({
  version: z.literal(SURVEY_STORAGE_VERSION),
  organisationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  tools: z.array(surveyToolSchema),
  surveys: z.array(surveySchema),
  corrections: z.array(correctionSchema),
  operations: z.array(operationSchema),
});

export interface SurveyCorrection {
  readonly id: string;
  readonly surveyId: string;
  readonly fieldName: string;
  readonly previousValue: CorrectionValue;
  readonly correctedValue: CorrectionValue;
  readonly reason: string;
  readonly correctedAt: string;
  readonly correctedByUserId: string;
  readonly correctedByNameSnapshot: string;
  readonly operationId: string;
}

export interface CreateSurveyInput {
  readonly operationId: string;
  readonly surveyId: string;
  readonly holeId: string;
  readonly shiftId?: string;
  readonly depthDm: Decimetres;
  readonly dipTenths: number;
  readonly azimuthTenths: number;
  readonly northReference: NorthReference;
  readonly surveyToolId?: string;
  readonly comment?: string;
  readonly photoId?: string;
  readonly recordedByUserId: string;
  readonly recordedByNameSnapshot: string;
  readonly recordedAt: string;
}

export interface CorrectSurveyInput {
  readonly operationId: string;
  readonly correctionId: string;
  readonly surveyId: string;
  readonly holeId: string;
  readonly expectedVersion: number;
  readonly changes: Partial<
    Pick<
      Survey,
      | "depthDm"
      | "dipTenths"
      | "azimuthTenths"
      | "northReference"
      | "surveyToolId"
      | "comment"
    >
  >;
  readonly reason: string;
  readonly correctedByUserId: string;
  readonly correctedByNameSnapshot: string;
  readonly correctedAt: string;
}

export interface AttachSurveyPhotoInput {
  readonly operationId: string;
  readonly surveyId: string;
  readonly holeId: string;
  readonly photoId: string;
  readonly expectedVersion: number;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface CreateSurveyToolInput {
  readonly operationId: string;
  readonly toolId: string;
  readonly organisationId: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly serialNumber?: string;
  readonly defaultNorthReference?: NorthReference;
  readonly status?: SurveyToolStatus;
  readonly createdByUserId: string;
  readonly createdByNameSnapshot: string;
  readonly occurredAt: string;
}

export interface UpdateSurveyToolInput {
  readonly operationId: string;
  readonly toolId: string;
  readonly expectedVersion: number;
  readonly name?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly serialNumber?: string;
  readonly defaultNorthReference?: NorthReference;
  readonly status?: SurveyToolStatus;
  readonly userId: string;
  readonly userNameSnapshot: string;
  readonly occurredAt: string;
}

export interface SurveyRepository {
  listByHole(holeId: string): Promise<readonly Survey[]>;
  getById(surveyId: string): Promise<Survey | null>;
  assertHoleMutable(holeId: string): void;
  create(input: CreateSurveyInput): Promise<Survey>;
  correct(input: CorrectSurveyInput): Promise<Survey>;
  attachPhoto(input: AttachSurveyPhotoInput): Promise<Survey>;
  listCorrections(surveyId: string): Promise<readonly SurveyCorrection[]>;
}

export interface SurveyToolRepository {
  listActive(): Promise<readonly SurveyTool[]>;
  listAll(): Promise<readonly SurveyTool[]>;
  getById(toolId: string): Promise<SurveyTool | null>;
  create(input: CreateSurveyToolInput): Promise<SurveyTool>;
  update(input: UpdateSurveyToolInput): Promise<SurveyTool>;
}

type Envelope = z.infer<typeof envelopeSchema>;
type OperationKind = z.infer<typeof operationSchema>["kind"];

export class SurveyRepositoryError extends Error {
  constructor(
    readonly code:
      | "CORRUPTED_STORAGE"
      | "IDEMPOTENCY_CONFLICT"
      | "NOT_FOUND"
      | "STALE_VERSION"
      | "STORAGE_UNAVAILABLE"
      | "VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "SurveyRepositoryError";
  }
}

function storageKey(organisationId: string): string {
  return `targetlock:prototype:v${SURVEY_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:surveys`;
}

function asSurvey(value: z.infer<typeof surveySchema>): Survey {
  return { ...value, depthDm: decimetres(value.depthDm) };
}

function stableInput(value: unknown): string {
  return JSON.stringify(value);
}

export class LocalSurveyRepository
  implements SurveyRepository
{
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly organisationId: string,
    private readonly seedTools: readonly SurveyTool[] = [],
    private readonly seedSurveys: readonly Survey[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  private read(): Envelope {
    let raw: string | null;
    try {
      raw = this.storage.getItem(storageKey(this.organisationId));
    } catch {
      throw new SurveyRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) {
      return envelopeSchema.parse({
        version: SURVEY_STORAGE_VERSION,
        organisationId: this.organisationId,
        revision: 0,
        updatedAt: new Date(0).toISOString(),
        tools: this.seedTools.filter(
          ({ organisationId }) => organisationId === this.organisationId,
        ),
        surveys: this.seedSurveys,
        corrections: [],
        operations: [],
      });
    }
    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw) as unknown);
      if (
        !parsed.success ||
        parsed.data.organisationId !== this.organisationId
      ) {
        throw new SurveyRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted surveys are incompatible with this organisation.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof SurveyRepositoryError) throw error;
      throw new SurveyRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted surveys are not valid JSON.",
      );
    }
  }

  private write(envelope: Envelope): void {
    try {
      this.storage.setItem(
        storageKey(this.organisationId),
        JSON.stringify(envelopeSchema.parse(envelope)),
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new SurveyRepositoryError(
          "VALIDATION_FAILED",
          "Survey data did not pass local validation.",
        );
      }
      throw new SurveyRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save survey data.",
      );
    }
  }

  private idempotentEntity(
    envelope: Envelope,
    operationId: string,
    kind: OperationKind,
    inputJson: string,
  ): string | undefined {
    const operation = envelope.operations.find(
      (candidate) => candidate.operationId === operationId,
    );
    if (operation === undefined) return undefined;
    if (operation.kind !== kind || operation.inputJson !== inputJson) {
      throw new SurveyRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "The operation identifier is already used by different survey data.",
      );
    }
    return operation.entityId;
  }

  async listByHole(holeId: string): Promise<readonly Survey[]> {
    return this.read()
      .surveys.filter((survey) => survey.holeId === holeId)
      .map(asSurvey)
      .sort(
        (left, right) =>
          right.depthDm - left.depthDm ||
          Date.parse(right.recordedAt) - Date.parse(left.recordedAt),
      );
  }

  async getById(surveyId: string): Promise<Survey | null> {
    const survey = this.read().surveys.find(
      ({ localId }) => localId === surveyId,
    );
    return survey === undefined ? null : asSurvey(survey);
  }

  async listCorrections(
    surveyId: string,
  ): Promise<readonly SurveyCorrection[]> {
    return this.read()
      .corrections.filter((correction) => correction.surveyId === surveyId)
      .sort(
        (left, right) =>
          Date.parse(right.correctedAt) - Date.parse(left.correctedAt),
      );
  }

  assertHoleMutable(holeId: string): void {
    this.mutationGuard?.assertHoleMutable(holeId);
  }

  async create(input: CreateSurveyInput): Promise<Survey> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const envelope = this.read();
    const inputJson = stableInput(input);
    const existingId = this.idempotentEntity(
      envelope,
      input.operationId,
      "CREATE_SURVEY",
      inputJson,
    );
    if (existingId !== undefined) {
      const existing = envelope.surveys.find(
        ({ localId }) => localId === existingId,
      );
      if (existing !== undefined) return asSurvey(existing);
    }
    if (envelope.surveys.some(({ localId }) => localId === input.surveyId)) {
      throw new SurveyRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        "Survey identifier is already in use.",
      );
    }
    const tool =
      input.surveyToolId === undefined
        ? undefined
        : envelope.tools.find(({ localId }) => localId === input.surveyToolId);
    if (input.surveyToolId !== undefined && tool === undefined) {
      throw new SurveyRepositoryError(
        "NOT_FOUND",
        "The selected survey tool is not available.",
      );
    }
    const survey = surveySchema.parse({
      localId: input.surveyId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.recordedAt,
      updatedAt: input.recordedAt,
      deviceId: DEVICE_ID,
      version: 1,
      holeId: input.holeId,
      shiftId: input.shiftId,
      depthDm: input.depthDm,
      dipTenths: input.dipTenths,
      azimuthTenths: input.azimuthTenths,
      northReference: input.northReference,
      surveyToolId: tool?.localId,
      toolNameSnapshot: tool?.name,
      toolSerialSnapshot: tool?.serialNumber,
      comment: input.comment?.trim() || undefined,
      photoId: input.photoId,
      recordedByUserId: input.recordedByUserId,
      recordedByNameSnapshot: input.recordedByNameSnapshot,
      recordedAt: input.recordedAt,
    });
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.recordedAt,
      surveys: [...envelope.surveys, survey],
      operations: [
        ...envelope.operations,
        {
          operationId: input.operationId,
          kind: "CREATE_SURVEY",
          inputJson,
          entityId: input.surveyId,
          completedAt: input.recordedAt,
        },
      ],
    });
    return asSurvey(survey);
  }

  async correct(input: CorrectSurveyInput): Promise<Survey> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const envelope = this.read();
    const inputJson = stableInput(input);
    const existingId = this.idempotentEntity(
      envelope,
      input.operationId,
      "CORRECT_SURVEY",
      inputJson,
    );
    if (existingId !== undefined) {
      const existing = envelope.surveys.find(
        ({ localId }) => localId === existingId,
      );
      if (existing !== undefined) return asSurvey(existing);
    }
    const index = envelope.surveys.findIndex(
      ({ localId, holeId }) =>
        localId === input.surveyId && holeId === input.holeId,
    );
    const current = envelope.surveys[index];
    if (current === undefined) {
      throw new SurveyRepositoryError("NOT_FOUND", "Survey was not found.");
    }
    if (current.version !== input.expectedVersion) {
      throw new SurveyRepositoryError(
        "STALE_VERSION",
        "Survey changed after this form was opened.",
      );
    }
    const tool =
      input.changes.surveyToolId === undefined
        ? undefined
        : envelope.tools.find(
            ({ localId }) => localId === input.changes.surveyToolId,
          );
    if (input.changes.surveyToolId !== undefined && tool === undefined) {
      throw new SurveyRepositoryError(
        "NOT_FOUND",
        "The corrected survey tool was not found.",
      );
    }
    const corrected = surveySchema.parse({
      ...current,
      ...input.changes,
      ...(input.changes.surveyToolId === undefined
        ? {}
        : {
            toolNameSnapshot: tool?.name,
            toolSerialSnapshot: tool?.serialNumber,
          }),
      comment: input.changes.comment?.trim() || current.comment,
      updatedAt: input.correctedAt,
      version: current.version + 1,
      syncStatus: "local-only",
    });
    const corrections = Object.entries(input.changes)
      .filter(([fieldName, value]) => current[fieldName as keyof typeof current] !== value)
      .map(([fieldName, value], correctionIndex) =>
        correctionSchema.parse({
          id:
            correctionIndex === 0
              ? input.correctionId
              : `${input.correctionId}-${correctionIndex + 1}`,
          surveyId: input.surveyId,
          fieldName,
          previousValue:
            (current[fieldName as keyof typeof current] as CorrectionValue) ??
            null,
          correctedValue: (value as CorrectionValue) ?? null,
          reason: input.reason,
          correctedAt: input.correctedAt,
          correctedByUserId: input.correctedByUserId,
          correctedByNameSnapshot: input.correctedByNameSnapshot,
          operationId: input.operationId,
        }),
      );
    const surveys = [...envelope.surveys];
    surveys[index] = corrected;
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.correctedAt,
      surveys,
      corrections: [...envelope.corrections, ...corrections],
      operations: [
        ...envelope.operations,
        {
          operationId: input.operationId,
          kind: "CORRECT_SURVEY",
          inputJson,
          entityId: input.surveyId,
          completedAt: input.correctedAt,
        },
      ],
    });
    return asSurvey(corrected);
  }

  async attachPhoto(input: AttachSurveyPhotoInput): Promise<Survey> {
    this.mutationGuard?.assertHoleMutable(input.holeId);
    const envelope = this.read();
    const inputJson = stableInput(input);
    const existingId = this.idempotentEntity(
      envelope,
      input.operationId,
      "ATTACH_PHOTO",
      inputJson,
    );
    if (existingId !== undefined) {
      const existing = envelope.surveys.find(
        ({ localId }) => localId === existingId,
      );
      if (existing !== undefined) return asSurvey(existing);
    }
    const index = envelope.surveys.findIndex(
      ({ localId, holeId }) =>
        localId === input.surveyId && holeId === input.holeId,
    );
    const current = envelope.surveys[index];
    if (current === undefined) {
      throw new SurveyRepositoryError("NOT_FOUND", "Survey was not found.");
    }
    if (current.version !== input.expectedVersion) {
      throw new SurveyRepositoryError(
        "STALE_VERSION",
        "Survey changed after the photograph operation began.",
      );
    }
    const updated = surveySchema.parse({
      ...current,
      photoId: input.photoId,
      updatedAt: input.occurredAt,
      version: current.version + 1,
      syncStatus: "local-only",
    });
    const surveys = [...envelope.surveys];
    surveys[index] = updated;
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.occurredAt,
      surveys,
      operations: [
        ...envelope.operations,
        {
          operationId: input.operationId,
          kind: "ATTACH_PHOTO",
          inputJson,
          entityId: input.surveyId,
          completedAt: input.occurredAt,
        },
      ],
    });
    return asSurvey(updated);
  }

  async listActiveTools(): Promise<readonly SurveyTool[]> {
    return (await this.listAllTools()).filter(({ status }) => status === "ACTIVE");
  }

  async listAllTools(): Promise<readonly SurveyTool[]> {
    return [...this.read().tools].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  async getToolById(toolId: string): Promise<SurveyTool | null> {
    return (
      this.read().tools.find(({ localId }) => localId === toolId) ?? null
    );
  }

  async createTool(input: CreateSurveyToolInput): Promise<SurveyTool> {
    const envelope = this.read();
    const inputJson = stableInput(input);
    const existingId = this.idempotentEntity(
      envelope,
      input.operationId,
      "TOOL",
      inputJson,
    );
    if (existingId !== undefined) {
      const existing = envelope.tools.find(
        ({ localId }) => localId === existingId,
      );
      if (existing !== undefined) return existing;
    }
    if (input.organisationId !== this.organisationId) {
      throw new SurveyRepositoryError(
        "VALIDATION_FAILED",
        "Survey tool belongs to another organisation.",
      );
    }
    const tool = surveyToolSchema.parse({
      localId: input.toolId,
      serverId: null,
      syncStatus: "local-only",
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      deviceId: DEVICE_ID,
      version: 1,
      organisationId: input.organisationId,
      name: input.name,
      manufacturer: input.manufacturer,
      model: input.model,
      serialNumber: input.serialNumber,
      defaultNorthReference: input.defaultNorthReference,
      status: input.status ?? "ACTIVE",
      createdByUserId: input.createdByUserId,
      createdByNameSnapshot: input.createdByNameSnapshot,
    });
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.occurredAt,
      tools: [...envelope.tools, tool],
      operations: [
        ...envelope.operations,
        {
          operationId: input.operationId,
          kind: "TOOL",
          inputJson,
          entityId: input.toolId,
          completedAt: input.occurredAt,
        },
      ],
    });
    return tool;
  }

  async updateTool(input: UpdateSurveyToolInput): Promise<SurveyTool> {
    const envelope = this.read();
    const inputJson = stableInput(input);
    const existingId = this.idempotentEntity(
      envelope,
      input.operationId,
      "TOOL",
      inputJson,
    );
    if (existingId !== undefined) {
      const existing = envelope.tools.find(
        ({ localId }) => localId === existingId,
      );
      if (existing !== undefined) return existing;
    }
    const index = envelope.tools.findIndex(
      ({ localId }) => localId === input.toolId,
    );
    const current = envelope.tools[index];
    if (current === undefined) {
      throw new SurveyRepositoryError(
        "NOT_FOUND",
        "Survey tool was not found.",
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new SurveyRepositoryError(
        "STALE_VERSION",
        "Survey tool changed after this form was opened.",
      );
    }
    const updated = surveyToolSchema.parse({
      ...current,
      name: input.name ?? current.name,
      manufacturer: input.manufacturer ?? current.manufacturer,
      model: input.model ?? current.model,
      serialNumber: input.serialNumber ?? current.serialNumber,
      defaultNorthReference:
        input.defaultNorthReference ?? current.defaultNorthReference,
      status: input.status ?? current.status,
      updatedAt: input.occurredAt,
      version: current.version + 1,
      syncStatus: "local-only",
    });
    const tools = [...envelope.tools];
    tools[index] = updated;
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: input.occurredAt,
      tools,
      operations: [
        ...envelope.operations,
        {
          operationId: input.operationId,
          kind: "TOOL",
          inputJson,
          entityId: input.toolId,
          completedAt: input.occurredAt,
        },
      ],
    });
    return updated;
  }
}

export class LocalSurveyToolRepository implements SurveyToolRepository {
  constructor(private readonly surveys: LocalSurveyRepository) {}

  async listActive(): Promise<readonly SurveyTool[]> {
    return this.surveys.listActiveTools();
  }

  async listAll(): Promise<readonly SurveyTool[]> {
    return this.surveys.listAllTools();
  }

  async getById(toolId: string): Promise<SurveyTool | null> {
    return this.surveys.getToolById(toolId);
  }

  async create(input: CreateSurveyToolInput): Promise<SurveyTool> {
    return this.surveys.createTool(input);
  }

  async update(input: UpdateSurveyToolInput): Promise<SurveyTool> {
    return this.surveys.updateTool(input);
  }
}

export function createBrowserSurveyRepository(
  organisationId: string,
  seedTools: readonly SurveyTool[] = [],
  seedSurveys: readonly Survey[] = [],
  mutationGuard?: HoleMutationGuardPort,
): LocalSurveyRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalSurveyRepository(
        storage,
        organisationId,
        seedTools,
        seedSurveys,
        mutationGuard,
      );
}

export function createSurveyToolRepository(
  surveyRepository: LocalSurveyRepository,
): SurveyToolRepository {
  return new LocalSurveyToolRepository(surveyRepository);
}
