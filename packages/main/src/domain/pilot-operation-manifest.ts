export type CanonicalPilotPermission =
  | "PROJECT_SETUP"
  | "CREATE_ASSIGNED_HOLE"
  | "INITIALISE_ASSIGNED_HOLE"
  | "START_ASSIGNED_HOLE"
  | "HOLE_SETUP"
  | "HOLE_COMPLETE"
  | "HOLE_REOPEN"
  | "RECORD_CORRECTION";

export interface PilotRepositoryMethodDefinition {
  readonly kind: "read" | "mutation";
  readonly journal: boolean;
  readonly synchronous?: boolean;
  readonly permission: CanonicalPilotPermission | null;
  readonly materializer:
    | "PROJECT_DIRECTORY"
    | "HOLE"
    | "HOLE_CONFIGURATION"
    | "BHA_SETUP"
    | "SHIFT"
    | "HANDOVER"
    | "RUN"
    | "RUN_CORRECTION"
    | "COMPLETION"
    | null;
}

const read = (
  synchronous = false,
): PilotRepositoryMethodDefinition => ({
  kind: "read",
  journal: false,
  synchronous,
  permission: null,
  materializer: null,
});

const mutation = (
  permission: CanonicalPilotPermission | null = null,
  journal = true,
  materializer: PilotRepositoryMethodDefinition["materializer"] = null,
): PilotRepositoryMethodDefinition => ({
  kind: "mutation",
  journal,
  permission,
  materializer,
});

export const PILOT_OPERATION_MANIFEST = {
  completion: {
    getLifecycleState: read(),
    getStatus: read(),
    getLifecycleStatus: read(),
    getHole: read(),
    listHoles: read(),
    getCurrentReview: read(),
    getLatestCompletion: read(),
    getCompletionHistory: read(),
    getCompletionHistoryEntries: read(),
    getReopenHistory: read(),
    listCompletedHoles: read(),
    inspectPendingCompletionOperation: read(),
    getPendingCompletionOperation: read(),
    getHoleMutationSnapshot: read(true),
    createHole: mutation("CREATE_ASSIGNED_HOLE", true, "HOLE"),
    activateDraftHole: mutation("START_ASSIGNED_HOLE", true, "HOLE"),
    beginReview: mutation("HOLE_COMPLETE", true, "COMPLETION"),
    saveReviewDraft: mutation("HOLE_COMPLETE", true, "COMPLETION"),
    beginCompletionOperation: mutation("HOLE_COMPLETE"),
    advanceCompletionOperation: mutation("HOLE_COMPLETE"),
    persistCompletionRecord: mutation("HOLE_COMPLETE", true, "COMPLETION"),
    lockHole: mutation("HOLE_COMPLETE", true, "HOLE"),
    commitCompletion: mutation("HOLE_COMPLETE", true, "HOLE"),
    reopenHole: mutation("HOLE_REOPEN", true, "HOLE"),
  },
  runs: {
    readDraft: read(true),
    readCompletedRuns: read(true),
    writeDraft: mutation(null, false),
    clearDraft: mutation(null, false),
    saveCompletedRun: mutation(null, true, "RUN"),
  },
  "bha-setups": {
    listByHole: read(),
    getCurrent: read(),
    save: mutation("INITIALISE_ASSIGNED_HOLE", true, "BHA_SETUP"),
  },
  shifts: {
    getActiveShift: read(),
    getPendingHandover: read(),
    listByHole: read(),
    getById: read(),
    hasPendingHandoverOperation: read(),
    startShift: mutation(null, true, "SHIFT"),
    closeForHandover: mutation(null, true, "HANDOVER"),
    closeFinalShift: mutation(null, true, "HANDOVER"),
    reopenShift: mutation(null, true, "HANDOVER"),
    acceptHandover: mutation(null, true, "HANDOVER"),
    recoverInterruptedAcceptance: mutation(),
  },
  audits: {
    listByHole: read(),
    listByEntity: read(),
    append: mutation(),
  },
  "run-corrections": {
    listByRun: read(),
    listOperations: read(),
    getEnvelope: read(),
    previewCorrection: read(),
    previewVoid: read(),
    apply: mutation("RECORD_CORRECTION", true, "RUN_CORRECTION"),
    voidRun: mutation("RECORD_CORRECTION", true, "RUN_CORRECTION"),
    recoverInterrupted: mutation("RECORD_CORRECTION"),
    materializeSeedRun: mutation("RECORD_CORRECTION"),
  },
  components: {
    list: read(),
    getById: read(),
    findBySerial: read(),
    listCorrections: read(),
    getActive: read(),
    listByHole: read(),
    listByComponent: read(),
    getAssignmentById: read(),
    hasPendingChangeOperation: read(),
    create: mutation("HOLE_SETUP"),
    update: mutation("HOLE_SETUP"),
    assignInitial: mutation("HOLE_SETUP"),
    changeComponent: mutation("HOLE_SETUP"),
    resolveAtHoleCompletion: mutation("HOLE_COMPLETE"),
    correctAssignment: mutation("RECORD_CORRECTION"),
    recoverInterruptedChange: mutation("HOLE_SETUP"),
    recoverInterruptedCompletionResolution: mutation("HOLE_COMPLETE"),
  },
  casing: {
    listByHole: read(),
    getById: read(),
    listEvents: read(),
    install: mutation("HOLE_SETUP"),
    advance: mutation("HOLE_SETUP"),
    shorten: mutation("HOLE_SETUP"),
    remove: mutation("HOLE_SETUP"),
    correct: mutation("RECORD_CORRECTION"),
    setStatus: mutation("HOLE_SETUP"),
    updateStatus: mutation("HOLE_SETUP"),
  },
  surveys: {
    listByHole: read(),
    getById: read(),
    listCorrections: read(),
    assertHoleMutable: read(true),
    create: mutation(),
    correct: mutation("RECORD_CORRECTION"),
    attachPhoto: mutation(),
  },
  "survey-tools": {
    listActive: read(),
    listAll: read(),
    getById: read(),
    create: mutation("HOLE_SETUP"),
    update: mutation("HOLE_SETUP"),
  },
  trajectory: {
    getCoordinateConfiguration: read(),
    getReferenceConfiguration: read(),
    getActivePlan: read(),
    listPlans: read(),
    getTarget: read(),
    getActualConfiguration: read(),
    listSelections: read(),
    getTolerance: read(),
    saveCoordinateConfiguration: mutation(
      "INITIALISE_ASSIGNED_HOLE",
      true,
      "HOLE_CONFIGURATION",
    ),
    saveReferenceConfiguration: mutation(
      "INITIALISE_ASSIGNED_HOLE",
      true,
      "HOLE_CONFIGURATION",
    ),
    saveDraft: mutation("HOLE_SETUP", true, "HOLE_CONFIGURATION"),
    activate: mutation("HOLE_SETUP", true, "HOLE_CONFIGURATION"),
    supersede: mutation("HOLE_SETUP", true, "HOLE_CONFIGURATION"),
    saveTarget: mutation(
      "INITIALISE_ASSIGNED_HOLE",
      true,
      "HOLE_CONFIGURATION",
    ),
    saveActualConfiguration: mutation(
      "INITIALISE_ASSIGNED_HOLE",
      true,
      "HOLE_CONFIGURATION",
    ),
    saveSurveySelection: mutation("HOLE_SETUP", true, "HOLE_CONFIGURATION"),
  },
  trays: {
    listByHole: read(),
    getById: read(),
    findByNumber: read(),
    listCorrections: read(),
    listPendingOperations: read(),
    createWithPhoto: mutation(),
    updateDetails: mutation(),
    replacePhoto: mutation("RECORD_CORRECTION"),
    recoverInterruptedOperations: mutation(),
  },
  photos: {
    getById: read(),
    listByEntity: read(),
    create: mutation(),
  },
  reports: {
    listReports: read(),
    getReport: read(),
    getSnapshot: read(),
    nextVersion: read(),
    getPendingTransaction: read(),
    listFailedTransactions: read(),
    listRecipients: read(),
    listOutbox: read(),
    beginGeneration: mutation(),
    saveSnapshot: mutation(),
    advanceGeneration: mutation(),
    saveGeneratedReport: mutation(),
    updateActivityStatus: mutation(),
    saveRecipient: mutation(),
    saveOutboxItem: mutation(),
  },
  projects: {
    listProjects: read(),
    getProject: read(),
    listRigs: read(),
    getRig: read(),
    createProjectWithInitialRig: mutation(
      "PROJECT_SETUP",
      true,
      "PROJECT_DIRECTORY",
    ),
  },
  media: {
    getBlob: read(),
    verify: read(),
    saveOriginal: mutation(),
    savePreview: mutation(),
    delete: mutation("RECORD_CORRECTION"),
  },
  "report-files": {
    get: read(),
    verify: read(),
    save: mutation(),
    delete: mutation("RECORD_CORRECTION"),
  },
} as const satisfies Readonly<
  Record<string, Readonly<Record<string, PilotRepositoryMethodDefinition>>>
>;

export type PilotRepositoryName = keyof typeof PILOT_OPERATION_MANIFEST;

export function pilotRepositoryMethodDefinition(
  repository: string,
  method: string,
): PilotRepositoryMethodDefinition | null {
  const methods = PILOT_OPERATION_MANIFEST[
    repository as PilotRepositoryName
  ] as Readonly<Record<string, PilotRepositoryMethodDefinition>> | undefined;
  return methods?.[method] ?? null;
}

export function canonicalPilotOperationType(
  repository: string,
  method: string,
): string | null {
  const definition = pilotRepositoryMethodDefinition(repository, method);
  return definition?.kind === "mutation" && definition.journal
    ? `${repository}.${method}.v1`
    : null;
}

const REVISION_ID_KEYS: Readonly<Record<string, readonly string[]>> = {
  completion: ["holeId", "holeRef", "name"],
  runs: ["runId", "localId", "holeId", "holeRef"],
  "bha-setups": ["setupId", "localId", "holeId", "holeRef"],
  shifts: ["shiftId", "incomingShiftId", "outgoingShiftId", "id", "localId", "holeId", "holeRef"],
  "run-corrections": ["runId", "localId", "holeId", "holeRef"],
  components: [
    "assignmentId",
    "componentId",
    "localId",
    "holeId",
    "holeRef",
  ],
  casing: ["casingStringId", "casingId", "localId", "holeId", "holeRef"],
  surveys: ["surveyId", "localId", "holeId", "holeRef"],
  "survey-tools": ["toolId", "localId"],
  trajectory: ["planId", "localId", "holeId", "holeRef"],
  trays: ["trayId", "localId", "holeId", "holeRef"],
  photos: ["photoId", "localId", "holeId", "holeRef"],
  reports: ["reportId", "localId", "holeId", "holeRef"],
  projects: ["projectId", "localId", "projectRef"],
  media: ["storageKey", "operationId", "holeId", "holeRef"],
  "report-files": ["storageKey", "operationId", "holeId", "holeRef"],
};

function firstRevisionIdentifier(
  value: unknown,
  keys: readonly string[],
  depth = 0,
): string | null {
  if (depth > 5 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstRevisionIdentifier(item, keys, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (
      (typeof candidate === "string" || typeof candidate === "number") &&
      String(candidate).trim()
    ) {
      return String(candidate).trim();
    }
  }
  for (const candidate of Object.values(record)) {
    const found = firstRevisionIdentifier(candidate, keys, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

export function derivePilotRevisionRef(
  repository: string,
  payloadArguments: unknown,
): string | null {
  const positional = Array.isArray(payloadArguments) ? payloadArguments : [];
  if (
    repository === "completion" &&
    typeof positional[0] === "string" &&
    positional[0].trim()
  ) {
    return `completion:${positional[0].trim()}`;
  }
  if (
    repository === "trajectory" &&
    typeof positional[1] === "string" &&
    positional[1].trim()
  ) {
    return `trajectory:${positional[1].trim()}`;
  }
  const keys = REVISION_ID_KEYS[repository];
  if (!keys) return null;
  const identifier = firstRevisionIdentifier(payloadArguments, keys);
  if (identifier === null) return null;
  const namespace = repository === "run-corrections" ? "runs" : repository;
  return `${namespace}:${identifier}`;
}

export interface PilotOperationContext {
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly holeRef: string | null;
  readonly shiftRef: string | null;
  readonly expectedVersion: number | null;
}

function contextValue(
  value: unknown,
  keys: ReadonlySet<string>,
  depth = 0,
): string | null {
  if (depth > 5 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = contextValue(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  for (const candidate of Object.values(record)) {
    const found = contextValue(candidate, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

export function derivePilotOperationContext(
  repository: string,
  method: string,
  args: readonly unknown[],
  assignment: {
    readonly projectRef?: string | null;
    readonly rigRef?: string | null;
  } = {},
): PilotOperationContext {
  const positionalHole =
    (repository === "completion" && method === "activateDraftHole") ||
    (repository === "trajectory" &&
      (method === "activate" || method === "supersede"))
      ? typeof args[0] === "string"
        ? args[0].trim() || null
        : null
      : null;
  const expectedVersion = (() => {
    const find = (value: unknown, depth = 0): number | null => {
      if (depth > 5 || value === null || typeof value !== "object") return null;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = find(item, depth + 1);
          if (found !== null) return found;
        }
        return null;
      }
      const candidate = (value as Record<string, unknown>).expectedVersion;
      if (
        typeof candidate === "number" &&
        Number.isInteger(candidate) &&
        candidate >= 0
      ) {
        return candidate;
      }
      for (const nested of Object.values(value as Record<string, unknown>)) {
        const found = find(nested, depth + 1);
        if (found !== null) return found;
      }
      return null;
    };
    return find(args);
  })();
  return {
    projectRef:
      contextValue(args, new Set(["projectId", "projectRef"])) ??
      assignment.projectRef ??
      null,
    rigRef:
      contextValue(args, new Set(["rigId", "rigRef"])) ??
      assignment.rigRef ??
      null,
    holeRef:
      positionalHole ??
      contextValue(args, new Set(["holeId", "holeRef"])),
    shiftRef: contextValue(
      args,
      new Set([
        "shiftId",
        "shiftRef",
        "startedShiftId",
        "completedShiftId",
        "incomingShiftId",
        "outgoingShiftId",
      ]),
    ),
    expectedVersion,
  };
}
