import { describe, expect, it } from "vitest";

import { PILOT_OPERATION_MANIFEST } from "@/domain/pilot-operation-manifest";
import {
  coordinateBrowserRepository,
  RunbookOperationCoordinator,
} from "./runbook-operation-coordinator";

class TestChannel {
  readonly messages: unknown[] = [];
  private listener?: (event: MessageEvent<unknown>) => void;

  postMessage(message: unknown): void {
    this.messages.push(message);
  }
  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listener = listener;
  }
  emitExternal(): void {
    this.listener?.({ data: { type: "storage-changed" } } as MessageEvent);
  }
  close(): void {}
}

class TestLockManager {
  private queue: Promise<void> = Promise.resolve();

  request<T>(
    _name: string,
    _options: { readonly mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T> {
    const result = this.queue.then(callback, callback);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

describe("RunbookOperationCoordinator", () => {
  it("serializes overlapping operations in one browser tab", async () => {
    const coordinator = new RunbookOperationCoordinator();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = coordinator.runExclusive(async () => {
      order.push("first-start");
      await firstGate;
      order.push("first-end");
    });
    const second = coordinator.runExclusive(() => {
      order.push("second");
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("uses a shared browser lock across coordinator instances", async () => {
    const lockManager = new TestLockManager();
    const firstCoordinator = new RunbookOperationCoordinator({ lockManager });
    const secondCoordinator = new RunbookOperationCoordinator({ lockManager });
    const order: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = firstCoordinator.runExclusive(async () => {
      order.push("first-start");
      await gate;
      order.push("first-end");
    });
    const second = secondCoordinator.runExclusive(() => {
      order.push("second");
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("coordinates async repository methods and reports external changes", async () => {
    const channel = new TestChannel();
    const coordinator = new RunbookOperationCoordinator({ channel });
    const repository = coordinateBrowserRepository(
      {
        readDraft: () => "ready",
        readCompletedRuns: () => ["item"],
        saveCompletedRun: async () => "saved",
      },
      coordinator,
      "runs",
      {
        prepare: async (repositoryName, method, args) => ({
          enabled: true,
          repository: repositoryName,
          method,
          arguments: args,
          clientTime: new Date().toISOString(),
          projectRef: null,
          rigRef: null,
          holeRef: null,
          shiftRef: null,
          expectedVersion: null,
          leaseEvidence: null,
        }),
        complete: async () => undefined,
      },
    );
    let externalChanges = 0;
    coordinator.subscribe(() => {
      externalChanges += 1;
    });

    expect(repository.readDraft()).toBe("ready");
    expect(repository.readCompletedRuns()).toEqual(["item"]);
    expect(channel.messages).toHaveLength(0);
    await expect(repository.saveCompletedRun()).resolves.toBe("saved");
    expect(channel.messages).toHaveLength(1);

    channel.emitExternal();
    await Promise.resolve();
    expect(externalChanges).toBe(1);
  });

  it("coordinates every explicit mutator exactly once and never coordinates reads", async () => {
    for (const [repositoryName, definitions] of Object.entries(
      PILOT_OPERATION_MANIFEST,
    )) {
      const channel = new TestChannel();
      const coordinator = new RunbookOperationCoordinator({ channel });
      const prepared: string[] = [];
      const completed: string[] = [];
      const methods = Object.fromEntries(
        Object.keys(definitions).map((method) => [
          method,
          () => `${repositoryName}.${method}`,
        ]),
      );
      const repository = coordinateBrowserRepository(
        methods,
        coordinator,
        repositoryName,
        {
          prepare: async (name, method, args) => {
            prepared.push(`${name}.${method}`);
            return {
              enabled: true,
              repository: name,
              method,
              arguments: args,
              clientTime: new Date().toISOString(),
              projectRef: null,
              rigRef: null,
              holeRef: null,
              shiftRef: null,
              expectedVersion: null,
              leaseEvidence: null,
            };
          },
          complete: async (preparation) => {
            completed.push(
              `${preparation.repository}.${preparation.method}`,
            );
          },
        },
      ) as Record<string, () => unknown>;

      for (const [method, definition] of Object.entries(definitions)) {
        const result = repository[method]();
        if (!definition.synchronous) await result;
      }
      const expectedMutations = Object.entries(definitions)
        .filter(([, definition]) => definition.kind === "mutation")
        .map(([method]) => `${repositoryName}.${method}`);
      expect(prepared, repositoryName).toEqual(expectedMutations);
      expect(completed, repositoryName).toEqual(expectedMutations);
      expect(channel.messages, repositoryName).toHaveLength(
        expectedMutations.length,
      );
    }
  });

  it("fails closed when a repository method is absent from the manifest", () => {
    const repository = coordinateBrowserRepository(
      { surpriseMutation: async () => undefined },
      new RunbookOperationCoordinator(),
      "runs",
    ) as { surpriseMutation: () => Promise<void> };
    expect(() => repository.surpriseMutation).toThrow(/missing from/);
  });
});
