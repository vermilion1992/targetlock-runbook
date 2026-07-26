import { z } from "zod";

import type { NorthReference } from "@/domain";
import {
  getBrowserLocalStorageAdapter,
  getBrowserRunbookOperationCoordinator,
  type LocalStorageAdapter,
  type RunbookOperationCoordinator,
} from "@/infrastructure/drafts";

function storageKey(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error("Project ID is required for trajectory defaults.");
  }
  return `targetlock:prototype:v1:project:${encodeURIComponent(normalized)}:trajectory-settings`;
}

const defaultsSchema = z.object({
  version: z.literal(1),
  surveyNorthReference: z.enum(["MAGNETIC", "TRUE", "GRID"]),
  preferredSurveyIntervalDm: z.number().int().positive(),
  calculationNorthReference: z.enum(["MAGNETIC", "TRUE", "GRID"]),
  gridRotationDeg: z.number().finite(),
  magneticDeclinationDeg: z.number().finite(),
  coordinateSystemName: z.string().trim().min(1).max(200),
  updatedAt: z.string().datetime(),
});

export interface TrajectoryProjectDefaults {
  readonly surveyNorthReference: Exclude<NorthReference, "NOT_SPECIFIED">;
  readonly preferredSurveyIntervalDm: number;
  readonly calculationNorthReference: Exclude<
    NorthReference,
    "NOT_SPECIFIED"
  >;
  readonly gridRotationDeg: number;
  readonly magneticDeclinationDeg: number;
  readonly coordinateSystemName: string;
  readonly updatedAt: string;
}

export interface TrajectoryProjectDefaultsRepository {
  read(projectId: string): TrajectoryProjectDefaults | null;
  save(
    projectId: string,
    defaults: TrajectoryProjectDefaults,
  ): Promise<void>;
}

export class LocalTrajectoryProjectDefaultsRepository
  implements TrajectoryProjectDefaultsRepository
{
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly coordinator?: RunbookOperationCoordinator,
  ) {}

  read(projectId: string): TrajectoryProjectDefaults | null {
    try {
      const raw = this.storage.getItem(storageKey(projectId));
      if (raw === null) return null;
      const parsed = defaultsSchema.safeParse(JSON.parse(raw) as unknown);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async save(
    projectId: string,
    defaults: TrajectoryProjectDefaults,
  ): Promise<void> {
    const operation = () => {
      this.storage.setItem(
        storageKey(projectId),
        JSON.stringify(defaultsSchema.parse({ version: 1, ...defaults })),
      );
    };
    if (this.coordinator === undefined) {
      operation();
      return;
    }
    await this.coordinator.runExclusive(operation, true);
  }
}

export function createBrowserTrajectoryProjectDefaultsRepository(): TrajectoryProjectDefaultsRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalTrajectoryProjectDefaultsRepository(
        storage,
        getBrowserRunbookOperationCoordinator() ?? undefined,
      );
}
