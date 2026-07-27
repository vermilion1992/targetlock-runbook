import { z } from "zod";

import type { Project, Rig } from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "@/infrastructure/drafts";

const PROJECT_DIRECTORY_STORAGE_VERSION = 1 as const;
const DEVICE_ID = "local-runbook-device";
const EPOCH = new Date(0).toISOString();

const syncStatusSchema = z.enum([
  "local-only",
  "queued",
  "syncing",
  "synced",
  "conflict",
  "failed",
]);
const metadataShape = {
  localId: z.string().trim().min(1).max(200),
  serverId: z.string().min(1).nullable(),
  syncStatus: syncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  version: z.number().int().positive(),
};
const projectSchema = z.object({
  ...metadataShape,
  organisationId: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  clientName: z.string().trim().min(1).max(150),
  location: z.string().trim().min(1).max(200),
  status: z.enum(["planned", "active", "completed", "archived"]),
});
const rigSchema = z.object({
  ...metadataShape,
  organisationId: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  serialNumber: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  status: z.enum(["available", "operating", "maintenance", "retired"]),
});

export const createProjectWithInitialRigInputSchema = z.object({
  operationId: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  rigId: z.string().trim().min(1).max(200),
  projectCode: z
    .string()
    .trim()
    .min(1, "Project code is required.")
    .max(50, "Project code must be 50 characters or fewer."),
  projectName: z
    .string()
    .trim()
    .min(1, "Project name is required.")
    .max(150, "Project name must be 150 characters or fewer."),
  clientName: z
    .string()
    .trim()
    .min(1, "Client is required.")
    .max(150, "Client must be 150 characters or fewer."),
  location: z
    .string()
    .trim()
    .min(1, "Location is required.")
    .max(200, "Location must be 200 characters or fewer."),
  rigName: z
    .string()
    .trim()
    .min(1, "Rig name is required.")
    .max(100, "Rig name must be 100 characters or fewer."),
  rigSerialNumber: z
    .string()
    .trim()
    .min(1, "Rig serial is required.")
    .max(100, "Rig serial must be 100 characters or fewer."),
  rigModel: z
    .string()
    .trim()
    .min(1, "Rig model is required.")
    .max(100, "Rig model must be 100 characters or fewer."),
  projectStatus: z
    .enum(["planned", "active", "completed", "archived"])
    .default("active"),
  rigStatus: z
    .enum(["available", "operating", "maintenance", "retired"])
    .default("operating"),
  createdByUserId: z.string().trim().min(1).max(200).default("local-operator"),
  createdByNameSnapshot: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .default("Local operator"),
  occurredAt: z.string().datetime(),
});

export type CreateProjectWithInitialRigInput = z.input<
  typeof createProjectWithInitialRigInputSchema
>;

export interface ProjectOnboardingResult {
  readonly project: Project;
  readonly rig: Rig;
}

const operationSchema = z.object({
  operationId: z.string().min(1),
  inputJson: z.string(),
  projectId: z.string().min(1),
  rigId: z.string().min(1),
  completedAt: z.string().datetime(),
});
const envelopeSchema = z.object({
  version: z.literal(PROJECT_DIRECTORY_STORAGE_VERSION),
  organisationId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  projects: z.array(projectSchema),
  rigs: z.array(rigSchema),
  operations: z.array(operationSchema),
});

type ProjectDirectoryEnvelope = z.infer<typeof envelopeSchema>;
type ParsedCreateInput = z.output<
  typeof createProjectWithInitialRigInputSchema
>;

/**
 * Organisation-owned directory data used to resolve project and rig context.
 *
 * Project and rig local IDs are immutable identities. Display codes, serials
 * and operation IDs are deliberately separate values.
 */
export interface ProjectDirectoryRepository {
  listProjects(): Promise<readonly Project[]>;
  getProject(projectId: string): Promise<Project | null>;
  listRigs(projectId: string): Promise<readonly Rig[]>;
  getRig(rigId: string): Promise<Rig | null>;
  createProjectWithInitialRig(
    input: CreateProjectWithInitialRigInput,
  ): Promise<ProjectOnboardingResult>;
}

export class ProjectDirectoryRepositoryError extends Error {
  constructor(
    readonly code:
      | "CORRUPTED_STORAGE"
      | "DUPLICATE_PROJECT_CODE"
      | "DUPLICATE_RIG_SERIAL"
      | "IDENTITY_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "STORAGE_UNAVAILABLE"
      | "VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ProjectDirectoryRepositoryError";
  }
}

export function normalizeProjectCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toLocaleUpperCase("en-AU");
}

export function normalizeRigSerial(serialNumber: string): string {
  return serialNumber
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("en-AU");
}

function sortProjects(projects: readonly Project[]): readonly Project[] {
  return [...projects].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "en-AU") ||
      left.localId.localeCompare(right.localId),
  );
}

function sortRigs(rigs: readonly Rig[]): readonly Rig[] {
  return [...rigs].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "en-AU") ||
      left.localId.localeCompare(right.localId),
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function localMetadata(localId: string, occurredAt: string) {
  return {
    localId,
    serverId: null,
    syncStatus: "local-only" as const,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    deviceId: DEVICE_ID,
    version: 1,
  };
}

function createRecords(
  organisationId: string,
  input: ParsedCreateInput,
): ProjectOnboardingResult {
  return {
    project: {
      ...localMetadata(input.projectId, input.occurredAt),
      organisationId,
      code: normalizeProjectCode(input.projectCode),
      name: input.projectName,
      clientName: input.clientName,
      location: input.location,
      status: input.projectStatus,
    },
    rig: {
      ...localMetadata(input.rigId, input.occurredAt),
      organisationId,
      projectId: input.projectId,
      name: input.rigName,
      serialNumber: normalizeRigSerial(input.rigSerialNumber),
      model: input.rigModel,
      status: input.rigStatus,
    },
  };
}

export class LocalProjectDirectoryRepository
  implements ProjectDirectoryRepository
{
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly organisationId: string,
    private readonly seedProjects: readonly Project[] = [],
    private readonly seedRigs: readonly Rig[] = [],
  ) {}

  private seedEnvelope(): ProjectDirectoryEnvelope {
    return envelopeSchema.parse({
      version: PROJECT_DIRECTORY_STORAGE_VERSION,
      organisationId: this.organisationId,
      revision: 0,
      updatedAt: EPOCH,
      projects: this.seedProjects.filter(
        (project) => project.organisationId === this.organisationId,
      ),
      rigs: this.seedRigs.filter(
        (rig) => rig.organisationId === this.organisationId,
      ),
      operations: [],
    });
  }

  private read(): ProjectDirectoryEnvelope {
    let raw: string | null;
    try {
      raw = this.storage.getItem(projectDirectoryStorageKey(this.organisationId));
    } catch {
      throw new ProjectDirectoryRepositoryError(
        "STORAGE_UNAVAILABLE",
        "Browser storage is unavailable.",
      );
    }
    if (raw === null) return this.seedEnvelope();

    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw) as unknown);
      if (
        !parsed.success ||
        parsed.data.organisationId !== this.organisationId
      ) {
        throw new ProjectDirectoryRepositoryError(
          "CORRUPTED_STORAGE",
          "Persisted projects are incompatible with this organisation.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ProjectDirectoryRepositoryError) throw error;
      throw new ProjectDirectoryRepositoryError(
        "CORRUPTED_STORAGE",
        "Persisted projects are not valid JSON.",
      );
    }
  }

  private write(envelope: ProjectDirectoryEnvelope): void {
    const parsed = envelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      throw new ProjectDirectoryRepositoryError(
        "VALIDATION_FAILED",
        "Project data did not pass local validation.",
      );
    }
    try {
      this.storage.setItem(
        projectDirectoryStorageKey(this.organisationId),
        JSON.stringify(parsed.data),
      );
    } catch {
      throw new ProjectDirectoryRepositoryError(
        "STORAGE_UNAVAILABLE",
        "This browser could not save the project and initial rig.",
      );
    }
  }

  async listProjects(): Promise<readonly Project[]> {
    return sortProjects(this.read().projects);
  }

  async getProject(projectId: string): Promise<Project | null> {
    return (
      this.read().projects.find(
        ({ localId }) => localId === projectId.trim(),
      ) ?? null
    );
  }

  async listRigs(projectId: string): Promise<readonly Rig[]> {
    const normalized = projectId.trim();
    return sortRigs(
      this.read().rigs.filter((rig) => rig.projectId === normalized),
    );
  }

  async getRig(rigId: string): Promise<Rig | null> {
    return (
      this.read().rigs.find(({ localId }) => localId === rigId.trim()) ?? null
    );
  }

  async createProjectWithInitialRig(
    input: CreateProjectWithInitialRigInput,
  ): Promise<ProjectOnboardingResult> {
    const parsed = createProjectWithInitialRigInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ProjectDirectoryRepositoryError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Project details are invalid.",
      );
    }

    const envelope = this.read();
    const inputJson = canonicalJson(parsed.data);
    const previous = envelope.operations.find(
      ({ operationId }) => operationId === parsed.data.operationId,
    );
    if (previous !== undefined) {
      if (previous.inputJson !== inputJson) {
        throw new ProjectDirectoryRepositoryError(
          "IDEMPOTENCY_CONFLICT",
          "The operation identifier is already used by different project data.",
        );
      }
      const project = envelope.projects.find(
        ({ localId }) => localId === previous.projectId,
      );
      const rig = envelope.rigs.find(({ localId }) => localId === previous.rigId);
      if (project === undefined || rig === undefined) {
        throw new ProjectDirectoryRepositoryError(
          "CORRUPTED_STORAGE",
          "The completed project operation has missing records.",
        );
      }
      return { project, rig };
    }

    if (
      envelope.projects.some(
        ({ localId }) => localId === parsed.data.projectId,
      ) ||
      envelope.rigs.some(({ localId }) => localId === parsed.data.rigId)
    ) {
      throw new ProjectDirectoryRepositoryError(
        "IDENTITY_CONFLICT",
        "A project or rig already uses one of these local identities.",
      );
    }
    const normalizedCode = normalizeProjectCode(parsed.data.projectCode);
    if (
      envelope.projects.some(
        ({ code }) => normalizeProjectCode(code) === normalizedCode,
      )
    ) {
      throw new ProjectDirectoryRepositoryError(
        "DUPLICATE_PROJECT_CODE",
        "A project with this code already exists.",
      );
    }
    const normalizedSerial = normalizeRigSerial(parsed.data.rigSerialNumber);
    if (
      envelope.rigs.some(
        ({ serialNumber }) =>
          normalizeRigSerial(serialNumber) === normalizedSerial,
      )
    ) {
      throw new ProjectDirectoryRepositoryError(
        "DUPLICATE_RIG_SERIAL",
        "A rig with this serial number already exists.",
      );
    }

    const result = createRecords(this.organisationId, parsed.data);
    this.write({
      ...envelope,
      revision: envelope.revision + 1,
      updatedAt: parsed.data.occurredAt,
      projects: [...envelope.projects, result.project],
      rigs: [...envelope.rigs, result.rig],
      operations: [
        ...envelope.operations,
        {
          operationId: parsed.data.operationId,
          inputJson,
          projectId: result.project.localId,
          rigId: result.rig.localId,
          completedAt: parsed.data.occurredAt,
        },
      ],
    });
    return result;
  }
}

/**
 * Read-only compatibility repository used by non-browser consumers and simple
 * fixtures. Mutations require the local-storage-backed repository.
 */
export class SeedProjectDirectoryRepository
  implements ProjectDirectoryRepository
{
  constructor(
    private readonly projects: readonly Project[],
    private readonly rigs: readonly Rig[],
  ) {}

  async listProjects(): Promise<readonly Project[]> {
    return sortProjects(this.projects);
  }

  async getProject(projectId: string): Promise<Project | null> {
    return (
      this.projects.find(({ localId }) => localId === projectId.trim()) ?? null
    );
  }

  async listRigs(projectId: string): Promise<readonly Rig[]> {
    const normalized = projectId.trim();
    return sortRigs(this.rigs.filter((rig) => rig.projectId === normalized));
  }

  async getRig(rigId: string): Promise<Rig | null> {
    return this.rigs.find(({ localId }) => localId === rigId.trim()) ?? null;
  }

  async createProjectWithInitialRig(): Promise<ProjectOnboardingResult> {
    throw new ProjectDirectoryRepositoryError(
      "STORAGE_UNAVAILABLE",
      "Project creation requires browser storage.",
    );
  }
}

export function projectDirectoryStorageKey(organisationId: string): string {
  return `targetlock:prototype:v${PROJECT_DIRECTORY_STORAGE_VERSION}:organisation:${encodeURIComponent(organisationId)}:project-directory`;
}

export function createProjectDirectoryRepository(input: {
  readonly projects: readonly Project[];
  readonly rigs: readonly Rig[];
}): ProjectDirectoryRepository {
  return new SeedProjectDirectoryRepository(input.projects, input.rigs);
}

export function createBrowserProjectDirectoryRepository(
  organisationId: string,
  seedProjects: readonly Project[] = [],
  seedRigs: readonly Rig[] = [],
): LocalProjectDirectoryRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalProjectDirectoryRepository(
        storage,
        organisationId,
        seedProjects,
        seedRigs,
      );
}
