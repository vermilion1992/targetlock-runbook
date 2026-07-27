import { describe, expect, it } from "vitest";

import type { Project, Rig } from "@/domain";
import type { LocalStorageAdapter } from "@/infrastructure/drafts";
import {
  LocalProjectDirectoryRepository,
  SeedProjectDirectoryRepository,
  projectDirectoryStorageKey,
  type CreateProjectWithInitialRigInput,
} from "./project-directory-repository";

const metadata = {
  serverId: null,
  syncStatus: "local-only" as const,
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
  deviceId: "test",
  version: 1,
};

function project(
  localId: string,
  name: string,
  code = localId.toUpperCase(),
  organisationId = "org-1",
): Project {
  return {
    ...metadata,
    localId,
    organisationId,
    code,
    name,
    clientName: "Client",
    location: "Location",
    status: "active",
  };
}

function rig(
  localId: string,
  projectId: string,
  name: string,
  serialNumber = `${localId}-serial`,
  organisationId = "org-1",
): Rig {
  return {
    ...metadata,
    localId,
    organisationId,
    projectId,
    name,
    serialNumber,
    model: "Drill",
    status: "operating",
  };
}

class MemoryStorage implements LocalStorageAdapter {
  readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const createInput: CreateProjectWithInitialRigInput = {
  operationId: "operation-create-project-1",
  projectId: "project-local-1",
  rigId: "rig-local-1",
  projectCode: "NRM-26-02",
  projectName: "North Ridge Extension",
  clientName: "North Ridge Minerals",
  location: "Pilbara, Western Australia",
  rigName: "Rig 12",
  rigSerialNumber: "BRG-R12-2024",
  rigModel: "Sandvik DE150",
  occurredAt: "2026-07-27T12:00:00.000Z",
};

describe("SeedProjectDirectoryRepository", () => {
  it("lists projects and project-owned rigs in display order", async () => {
    const repository = new SeedProjectDirectoryRepository(
      [project("project-b", "Zulu"), project("project-a", "Alpha")],
      [
        rig("rig-b", "project-a", "Rig 20"),
        rig("rig-a", "project-a", "Rig 10"),
        rig("rig-c", "project-b", "Rig 30"),
      ],
    );

    await expect(repository.listProjects()).resolves.toMatchObject([
      { localId: "project-a" },
      { localId: "project-b" },
    ]);
    await expect(repository.listRigs("project-a")).resolves.toMatchObject([
      { localId: "rig-a" },
      { localId: "rig-b" },
    ]);
  });

  it("returns null for unknown project and rig identities", async () => {
    const repository = new SeedProjectDirectoryRepository([], []);

    await expect(repository.getProject("missing")).resolves.toBeNull();
    await expect(repository.getRig("missing")).resolves.toBeNull();
  });
});

describe("LocalProjectDirectoryRepository", () => {
  it("starts from organisation-owned seeds and persists a usable project and rig pair", async () => {
    const storage = new MemoryStorage();
    const seedProject = project(
      "project-briggs",
      "Briggs North Ridge",
      "BRG-26-01",
    );
    const seedRig = rig(
      "rig-10",
      seedProject.localId,
      "Rig 10",
      "BRG-R10-2019",
    );
    const repository = new LocalProjectDirectoryRepository(
      storage,
      "org-1",
      [
        seedProject,
        project("foreign-project", "Foreign", "FOREIGN", "org-2"),
      ],
      [seedRig, rig("foreign-rig", "foreign-project", "Foreign", "F-1", "org-2")],
    );

    await expect(repository.listProjects()).resolves.toMatchObject([
      { localId: "project-briggs" },
    ]);

    const result = await repository.createProjectWithInitialRig(createInput);

    expect(result).toMatchObject({
      project: {
        localId: "project-local-1",
        code: "NRM-26-02",
        status: "active",
        syncStatus: "local-only",
      },
      rig: {
        localId: "rig-local-1",
        projectId: "project-local-1",
        serialNumber: "BRG-R12-2024",
        status: "operating",
        syncStatus: "local-only",
      },
    });
    expect(result.project.localId).not.toBe(result.project.code);
    expect(result.rig.localId).not.toBe(result.rig.serialNumber);
    await expect(repository.listRigs(result.project.localId)).resolves.toEqual([
      result.rig,
    ]);

    const reloaded = new LocalProjectDirectoryRepository(storage, "org-1");
    await expect(reloaded.getProject(result.project.localId)).resolves.toEqual(
      result.project,
    );
    await expect(reloaded.getRig(result.rig.localId)).resolves.toEqual(
      result.rig,
    );

    const stored = JSON.parse(
      storage.values.get(projectDirectoryStorageKey("org-1"))!,
    ) as { version: number; organisationId: string; revision: number };
    expect(stored).toMatchObject({
      version: 1,
      organisationId: "org-1",
      revision: 1,
    });
    expect(projectDirectoryStorageKey("org-2")).not.toBe(
      projectDirectoryStorageKey("org-1"),
    );
  });

  it("replays the same operation without writing a second project or rig", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalProjectDirectoryRepository(storage, "org-1");

    const first = await repository.createProjectWithInitialRig(createInput);
    const replay = await repository.createProjectWithInitialRig(createInput);

    expect(replay).toEqual(first);
    expect(storage.writes).toBe(1);
    await expect(repository.listProjects()).resolves.toHaveLength(1);
    await expect(repository.listRigs(first.project.localId)).resolves.toHaveLength(
      1,
    );
  });

  it("rejects operation reuse with changed input", async () => {
    const repository = new LocalProjectDirectoryRepository(
      new MemoryStorage(),
      "org-1",
    );
    await repository.createProjectWithInitialRig(createInput);

    await expect(
      repository.createProjectWithInitialRig({
        ...createInput,
        projectName: "Different project",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it.each([
    [
      "normalised project code",
      { projectCode: "  brg-26-01  " },
      "DUPLICATE_PROJECT_CODE",
    ],
    [
      "normalised rig serial",
      { projectCode: "NEW-01", rigSerialNumber: "  brg-r10-2019  " },
      "DUPLICATE_RIG_SERIAL",
    ],
  ])("rejects a duplicate %s without a partial write", async (_, changes, code) => {
    const storage = new MemoryStorage();
    const seedProject = project(
      "project-briggs",
      "Briggs North Ridge",
      "BRG-26-01",
    );
    const repository = new LocalProjectDirectoryRepository(
      storage,
      "org-1",
      [seedProject],
      [rig("rig-10", seedProject.localId, "Rig 10", "BRG-R10-2019")],
    );

    await expect(
      repository.createProjectWithInitialRig({ ...createInput, ...changes }),
    ).rejects.toMatchObject({ code });
    expect(storage.writes).toBe(0);
    await expect(repository.listProjects()).resolves.toHaveLength(1);
    await expect(repository.listRigs(createInput.projectId)).resolves.toEqual([]);
  });

  it("reports validation and browser storage failures safely", async () => {
    const repository = new LocalProjectDirectoryRepository(
      new MemoryStorage(),
      "org-1",
    );
    await expect(
      repository.createProjectWithInitialRig({
        ...createInput,
        projectName: " ",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const unavailable: LocalStorageAdapter = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    };
    const unavailableRepository = new LocalProjectDirectoryRepository(
      unavailable,
      "org-1",
    );
    await expect(unavailableRepository.listProjects()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });

    const cannotWrite: LocalStorageAdapter = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("quota exceeded");
      },
      removeItem() {
        return;
      },
    };
    await expect(
      new LocalProjectDirectoryRepository(
        cannotWrite,
        "org-1",
      ).createProjectWithInitialRig(createInput),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      message: "This browser could not save the project and initial rig.",
    });
  });
});
