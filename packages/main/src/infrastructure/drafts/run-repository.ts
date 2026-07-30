import {
  appendSavedRunSnapshot,
  clearRunDraft,
  readRunDraft,
  readSavedRunSnapshots,
  writeRunDraft,
  type DraftReadResult,
  type PersistenceResult,
  type RunDraftPayload,
  type RunAssignmentMigrationCandidate,
  type SavedRunsReadResult,
  type SavedRunSnapshot,
  type SaveRunResult,
} from "./run-drafts";
import {
  getBrowserLocalStorageAdapter,
  type LocalStorageAdapter,
} from "./storage";
import {
  getBrowserRunbookOperationCoordinator,
  type RunbookOperationCoordinator,
} from "./runbook-operation-coordinator";
import type { HoleMutationGuardPort } from "@/infrastructure/completion";

/**
 * Stage 1 persistence boundary. Browser storage is an adapter detail so the
 * form and dashboard can later use SQLite/sync-backed implementations without
 * changing their domain contracts.
 */
export interface RunRepository {
  readDraft(holeId: string): DraftReadResult;
  writeDraft(
    holeId: string,
    payload: RunDraftPayload,
    savedAt?: string,
  ): Promise<PersistenceResult>;
  clearDraft(holeId: string): Promise<PersistenceResult>;
  readCompletedRuns(holeId: string): SavedRunsReadResult;
  saveCompletedRun(
    holeId: string,
    snapshot: SavedRunSnapshot,
  ): Promise<SaveRunResult>;
}

export class LocalRunRepository implements RunRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
    private readonly coordinator?: RunbookOperationCoordinator,
  ) {}

  readDraft(holeId: string): DraftReadResult {
    return readRunDraft(this.storage, holeId, this.migrationCandidates);
  }

  async writeDraft(
    holeId: string,
    payload: RunDraftPayload,
    savedAt?: string,
  ): Promise<PersistenceResult> {
    return this.runMutation(() => {
      this.mutationGuard?.assertHoleMutable(holeId);
      return writeRunDraft(this.storage, holeId, payload, savedAt);
    });
  }

  async clearDraft(holeId: string): Promise<PersistenceResult> {
    return this.runMutation(() => {
      this.mutationGuard?.assertHoleMutable(holeId);
      return clearRunDraft(this.storage, holeId);
    });
  }

  readCompletedRuns(holeId: string): SavedRunsReadResult {
    return readSavedRunSnapshots(
      this.storage,
      holeId,
      this.migrationCandidates,
    );
  }

  async saveCompletedRun(
    holeId: string,
    snapshot: SavedRunSnapshot,
  ): Promise<SaveRunResult> {
    return this.runMutation(() => {
      this.mutationGuard?.assertHoleMutable(holeId);
      return appendSavedRunSnapshot(this.storage, holeId, snapshot);
    });
  }

  private runMutation<T>(operation: () => T): Promise<T> {
    return this.coordinator === undefined
      ? Promise.resolve(operation())
      : this.coordinator.runExclusive(operation, true);
  }
}

export function createBrowserRunRepository(
  migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
  mutationGuard?: HoleMutationGuardPort,
  coordinateMutations = true,
): RunRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalRunRepository(
        storage,
        migrationCandidates,
        mutationGuard,
        coordinateMutations
          ? (getBrowserRunbookOperationCoordinator() ?? undefined)
          : undefined,
      );
}
