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
  ): PersistenceResult;
  clearDraft(holeId: string): PersistenceResult;
  readCompletedRuns(holeId: string): SavedRunsReadResult;
  saveCompletedRun(
    holeId: string,
    snapshot: SavedRunSnapshot,
  ): SaveRunResult;
}

export class LocalRunRepository implements RunRepository {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
    private readonly mutationGuard?: HoleMutationGuardPort,
  ) {}

  readDraft(holeId: string): DraftReadResult {
    return readRunDraft(this.storage, holeId, this.migrationCandidates);
  }

  writeDraft(
    holeId: string,
    payload: RunDraftPayload,
    savedAt?: string,
  ): PersistenceResult {
    this.mutationGuard?.assertHoleMutable(holeId);
    return writeRunDraft(this.storage, holeId, payload, savedAt);
  }

  clearDraft(holeId: string): PersistenceResult {
    this.mutationGuard?.assertHoleMutable(holeId);
    return clearRunDraft(this.storage, holeId);
  }

  readCompletedRuns(holeId: string): SavedRunsReadResult {
    return readSavedRunSnapshots(
      this.storage,
      holeId,
      this.migrationCandidates,
    );
  }

  saveCompletedRun(
    holeId: string,
    snapshot: SavedRunSnapshot,
  ): SaveRunResult {
    this.mutationGuard?.assertHoleMutable(holeId);
    return appendSavedRunSnapshot(this.storage, holeId, snapshot);
  }
}

export function createBrowserRunRepository(
  migrationCandidates: readonly RunAssignmentMigrationCandidate[] = [],
  mutationGuard?: HoleMutationGuardPort,
): RunRepository | null {
  const storage = getBrowserLocalStorageAdapter();
  return storage === null
    ? null
    : new LocalRunRepository(storage, migrationCandidates, mutationGuard);
}
