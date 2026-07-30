import {
  completePilotMutation,
  preparePilotMutation,
} from "@/infrastructure/sync";
import { pilotRepositoryMethodDefinition } from "@/domain/pilot-operation-manifest";

const RUNBOOK_LOCK_NAME = "targetlock:runbook-storage:v1";
const RUNBOOK_CHANNEL_NAME = "targetlock:runbook-storage-changes:v1";

interface ExclusiveLockManager {
  request<T>(
    name: string,
    options: { readonly mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
}

interface ChangeChannel {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  close(): void;
}

export interface RunbookOperationCoordinatorOptions {
  readonly lockManager?: ExclusiveLockManager;
  readonly channel?: ChangeChannel;
  readonly storageEventTarget?: Pick<
    Window,
    "addEventListener" | "removeEventListener"
  >;
}

export type RunbookStorageChangeListener = () => void;

export class RunbookOperationCoordinator {
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<RunbookStorageChangeListener>();
  private externalChangeScheduled = false;

  constructor(
    private readonly options: RunbookOperationCoordinatorOptions = {},
  ) {
    this.options.channel?.addEventListener("message", () => {
      this.scheduleExternalChange();
    });
    this.options.storageEventTarget?.addEventListener(
      "storage",
      this.handleStorageEvent,
    );
  }

  runExclusive<T>(
    operation: () => Promise<T> | T,
    notifyOtherTabs = false,
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      const run = async () => operation();
      const result =
        this.options.lockManager === undefined
          ? await run()
          : await this.options.lockManager.request(
              RUNBOOK_LOCK_NAME,
              { mode: "exclusive" },
              run,
            );
      if (notifyOtherTabs) {
        this.options.channel?.postMessage({ type: "storage-changed" });
      }
      return result;
    };
    const result = this.queue.then(execute, execute);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  subscribe(listener: RunbookStorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.options.storageEventTarget?.removeEventListener(
      "storage",
      this.handleStorageEvent,
    );
    this.options.channel?.close();
    this.listeners.clear();
  }

  private readonly handleStorageEvent = (event: Event): void => {
    const key = (event as StorageEvent).key;
    if (key !== null && !key.startsWith("targetlock:prototype:")) return;
    this.scheduleExternalChange();
  };

  private scheduleExternalChange(): void {
    if (this.externalChangeScheduled) return;
    this.externalChangeScheduled = true;
    queueMicrotask(() => {
      this.externalChangeScheduled = false;
      for (const listener of this.listeners) listener();
    });
  }
}

export interface PilotMutationCoordinationHooks {
  readonly prepare: typeof preparePilotMutation;
  readonly complete: typeof completePilotMutation;
}

const defaultPilotMutationHooks: PilotMutationCoordinationHooks = {
  prepare: preparePilotMutation,
  complete: completePilotMutation,
};

export function coordinateBrowserRepository<T extends object>(
  repository: T,
  coordinator: RunbookOperationCoordinator,
  repositoryName = "repository",
  hooks: PilotMutationCoordinationHooks = defaultPilotMutationHooks,
): T {
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      const methodName = String(property);
      const definition = pilotRepositoryMethodDefinition(
        repositoryName,
        methodName,
      );
      if (definition === null) {
        throw new Error(
          `Repository method ${repositoryName}.${methodName} is missing from the pilot operation manifest.`,
        );
      }
      if (definition.synchronous) return value.bind(target);
      return (...args: unknown[]) =>
        coordinator.runExclusive(
          async () => {
            const preparation =
              definition.kind === "mutation"
              ? await hooks.prepare(repositoryName, methodName, args)
              : null;
            const result = await Promise.resolve(value.apply(target, args));
            if (preparation !== null) {
              await hooks.complete(preparation, result);
            }
            return result;
          },
          definition.kind === "mutation",
        );
    },
  });
}

let browserCoordinator: RunbookOperationCoordinator | null = null;

export function getBrowserRunbookOperationCoordinator(): RunbookOperationCoordinator | null {
  if (typeof window === "undefined") return null;
  if (browserCoordinator !== null) return browserCoordinator;
  const lockManager =
    typeof navigator !== "undefined" && navigator.locks !== undefined
      ? (navigator.locks as unknown as ExclusiveLockManager)
      : undefined;
  const channel =
    typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel(RUNBOOK_CHANNEL_NAME);
  browserCoordinator = new RunbookOperationCoordinator({
    lockManager,
    channel,
    storageEventTarget: window,
  });
  return browserCoordinator;
}

export function subscribeToExternalRunbookStorageChanges(
  listener: RunbookStorageChangeListener,
): () => void {
  return getBrowserRunbookOperationCoordinator()?.subscribe(listener) ?? (() => {});
}
