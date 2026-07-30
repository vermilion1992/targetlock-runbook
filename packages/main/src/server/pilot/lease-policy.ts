const STANDARD_OFFLINE_GRACE_MS = 30 * 60 * 1_000;
const COMPLETION_OFFLINE_GRACE_MS = 12 * 60 * 60 * 1_000;

export function maximumOfflineGraceMsForOperationType(
  operationType: string,
): number {
  return /complete|close|handover|finalize/i.test(operationType)
    ? COMPLETION_OFFLINE_GRACE_MS
    : STANDARD_OFFLINE_GRACE_MS;
}
