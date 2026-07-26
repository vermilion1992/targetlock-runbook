import { describe, expect, it } from "vitest";

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
        snapshot: () => "ready",
        list: async () => ["item"],
        save: async () => "saved",
      },
      coordinator,
      ["snapshot"],
    );
    let externalChanges = 0;
    coordinator.subscribe(() => {
      externalChanges += 1;
    });

    expect(repository.snapshot()).toBe("ready");
    await expect(repository.list()).resolves.toEqual(["item"]);
    expect(channel.messages).toHaveLength(0);
    await expect(repository.save()).resolves.toBe("saved");
    expect(channel.messages).toHaveLength(1);

    channel.emitExternal();
    await Promise.resolve();
    expect(externalChanges).toBe(1);
  });
});
