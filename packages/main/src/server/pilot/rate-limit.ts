import { PilotRateLimitError } from "./http";

interface Bucket {
  count: number;
  resetsAt: number;
}

declare global {
  var __targetLockRateLimitBuckets: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  globalThis.__targetLockRateLimitBuckets ??= new Map();
  return globalThis.__targetLockRateLimitBuckets;
}

export function consumeRateLimit(
  key: string,
  options: {
    readonly limit: number;
    readonly windowMs: number;
    readonly now?: number;
  },
): void {
  const now = options.now ?? Date.now();
  const store = buckets();
  const current = store.get(key);
  if (current === undefined || current.resetsAt <= now) {
    store.set(key, { count: 1, resetsAt: now + options.windowMs });
    return;
  }
  if (current.count >= options.limit) {
    throw new PilotRateLimitError(
      Math.max(1, Math.ceil((current.resetsAt - now) / 1_000)),
    );
  }
  current.count += 1;
}

export function resetRateLimitsForTests(): void {
  buckets().clear();
}
